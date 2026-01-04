/**
 * ICP Profile API - Individual operations
 * GET, PUT, DELETE for single ICP profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/icp/[id] - Get single ICP profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from('icp_profiles')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

// PUT /api/icp/[id] - Update ICP profile
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};
  const allowedFields = [
    'name', 'industries', 'specific_roles', 'seniority_levels',
    'locations', 'signal_types', 'company_size_min', 'company_size_max',
    'exclude_keywords', 'pull_frequency', 'is_active'
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  const { data: profile, error } = await supabase
    .from('icp_profiles')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('[ICP API] Error updating profile:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Trigger contracts cron if contracts_awarded was just enabled (async, don't block response)
  if (body.signal_types?.includes('contracts_awarded')) {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    fetch(`${baseUrl}/api/cron/contracts-finder-signals`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
    }).catch(err => {
      console.error('[ICP API] Failed to trigger contracts cron:', err);
    });

    console.log('[ICP API] Triggered contracts-finder-signals cron for updated ICP');
  }

  return NextResponse.json({ profile });
}

// DELETE /api/icp/[id] - Delete ICP profile
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // First, mark the ICP as inactive to stop new tasks
  await supabase
    .from('icp_profiles')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', user.id);

  // Cancel any pending scan_queue tasks for this ICP
  const { error: queueError } = await supabase
    .from('scan_queue')
    .update({ status: 'cancelled' })
    .eq('icp_profile_id', id)
    .in('status', ['pending', 'queued']);

  if (queueError) {
    console.log('[ICP API] Note: Could not cancel queue tasks:', queueError.message);
    // Continue with deletion even if queue update fails (table may not exist)
  }

  // Now delete the ICP profile (cascades to pain signals)
  const { error } = await supabase
    .from('icp_profiles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[ICP API] Error deleting profile:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
