/**
 * ICP Profile Scan API
 *
 * Queues job ingestion tasks for a specific ICP profile using distributed system.
 * Called after profile creation to populate initial data.
 *
 * Now uses the distributed job queue instead of trying to fetch everything at once.
 */

export const maxDuration = 60; // Reduced from 300s - just queues tasks now

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { inngest } from '@/inngest/client';
import { ICPProfile } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Verify user owns this profile
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('icp_profiles')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const icpProfile = profile as ICPProfile;

  try {
    console.log(`[ICP Scan] Starting scan for profile: ${icpProfile.name}`);

    // Only scan if job_pain signal type is enabled
    if (!icpProfile.signal_types.includes('job_pain')) {
      return NextResponse.json({
        success: true,
        message: 'Job pain signals not enabled for this profile',
        stats: { tasks_queued: 0 },
      });
    }

    // Get locations and roles from profile
    const locations = icpProfile.locations.length > 0
      ? icpProfile.locations
      : ['London', 'Manchester', 'Birmingham'];

    const roles = icpProfile.specific_roles || [];

    if (roles.length === 0) {
      console.log(`[ICP Scan] No specific roles defined, skipping job search`);
      return NextResponse.json({
        success: true,
        message: 'No specific roles defined for this profile',
        stats: { tasks_queued: 0 },
      });
    }

    // ==========================================
    // Queue tasks for distributed processing
    // ==========================================
    console.log(`[ICP Scan] Queuing ${roles.length} roles × ${locations.length} locations for distributed processing`);

    const batchId = crypto.randomUUID();
    const tasksToCreate: any[] = [];
    const now = new Date();

    // Create queue entries for each role+location combination
    // Process them immediately (scheduled_for = now)
    for (const role of roles) {
      for (const location of locations) {
        // Queue Reed task
        tasksToCreate.push({
          icp_profile_id: id,
          batch_id: batchId,
          task_type: 'job_fetch_reed',
          keywords: role,
          location: location,
          status: 'pending',
          priority: 1,
          attempts: 0,
          max_attempts: 3,
          scheduled_for: now.toISOString(), // Process ASAP
        });

        // Queue Adzuna task
        tasksToCreate.push({
          icp_profile_id: id,
          batch_id: batchId,
          task_type: 'job_fetch_adzuna',
          keywords: role,
          location: location,
          status: 'pending',
          priority: 1,
          attempts: 0,
          max_attempts: 3,
          scheduled_for: new Date(now.getTime() + 60000).toISOString(), // 1 min after Reed
        });
      }
    }

    // Insert all tasks in batch
    const { error: queueError } = await adminClient.from('scan_queue').insert(tasksToCreate);

    if (queueError) {
      throw new Error(`Failed to queue tasks: ${queueError.message}`);
    }

    // Update profile status
    await adminClient
      .from('icp_profiles')
      .update({
        scan_status: 'scanning',
        scan_batch_id: batchId,
        scan_progress: {
          jobs_found: 0,
          companies_found: 0,
          signals_generated: 0,
          tasks_pending: tasksToCreate.length,
          tasks_completed: 0,
          last_updated: new Date().toISOString(),
        },
      })
      .eq('id', id);

    console.log(`[ICP Scan] Queued ${tasksToCreate.length} tasks for ${icpProfile.name}`);

    // Trigger the worker to start processing immediately
    try {
      await inngest.send({
        name: 'queue/process',
        data: { limit: 1 },
      });
    } catch (inngestError) {
      console.warn('[ICP Scan] Failed to trigger worker (will process on schedule):', inngestError);
    }

    // Build detailed user-friendly message
    const estimatedHours = Math.ceil((tasksToCreate.length * 20) / 60);
    const estimatedCompletionTime = new Date(Date.now() + estimatedHours * 60 * 60 * 1000);
    const completionTimeFormatted = estimatedCompletionTime.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // Build search summary
    const searchSummary = {
      job_boards: {
        enabled: true,
        sources: ['Reed.co.uk', 'Adzuna'],
        searches: `${roles.length} roles × ${locations.length} locations`,
        total_searches: tasksToCreate.length,
        history_window: '60 days',
        roles_being_searched: roles.slice(0, 5), // Show first 5 roles
        locations_being_searched: locations,
      },
      contracts_and_tenders: {
        enabled: icpProfile.signal_types.includes('contracts_awarded') || icpProfile.signal_types.includes('tenders'),
        contracts_finder: icpProfile.signal_types.includes('contracts_awarded'),
        find_a_tender: icpProfile.signal_types.includes('tenders'),
        note: icpProfile.signal_types.includes('contracts_awarded') || icpProfile.signal_types.includes('tenders')
          ? 'Contract signals are generated separately and will appear alongside job signals'
          : 'Enable contracts_awarded or tenders signal types to receive contract signals',
      },
      timeline: {
        first_signals_expected: '~20 minutes',
        full_completion_expected: `~${estimatedHours} hours (by ${completionTimeFormatted})`,
        processing_frequency: 'Every 20 minutes',
        total_tasks: tasksToCreate.length,
      },
    };

    const userMessage = `
🔍 **Search Initiated for "${icpProfile.name}"**

**Job Board Searches (60 days of history)**
• Sources: Reed.co.uk & Adzuna
• Roles: ${roles.slice(0, 3).join(', ')}${roles.length > 3 ? ` + ${roles.length - 3} more` : ''}
• Locations: ${locations.join(', ')}
• Total searches: ${tasksToCreate.length} (${roles.length} roles × ${locations.length} locations × 2 sources)

${searchSummary.contracts_and_tenders.enabled ? `
**Government Contracts & Tenders**
• ${icpProfile.signal_types.includes('contracts_awarded') ? '✓ Contracts Finder' : '✗ Contracts Finder'}
• ${icpProfile.signal_types.includes('tenders') ? '✓ Find a Tender' : '✗ Find a Tender'}
• These signals are generated separately from job signals
` : ''}

**Timeline**
• First signals: ~20 minutes
• New signals every: 20 minutes
• Full completion: ~${estimatedHours} hours (by ${completionTimeFormatted})

**What to Expect**
Each search will find jobs and automatically generate pain signals for:
✓ Jobs open 30+ days (hard to fill)
✓ Jobs open 60+ days (very hard to fill)
✓ Reposted roles (failed hiring attempts)
✓ Salary increases (desperation signals)
✓ Referral bonuses (struggling to hire)

You'll see signals appearing in your dashboard as each search completes. No need to refresh - they'll appear automatically!
    `.trim();

    return NextResponse.json({
      success: true,
      message: userMessage,
      summary: searchSummary,
      stats: {
        tasks_queued: tasksToCreate.length,
        roles: roles.length,
        locations: locations.length,
        estimated_completion_hours: estimatedHours,
        estimated_completion_time: estimatedCompletionTime.toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ICP Scan] Error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
