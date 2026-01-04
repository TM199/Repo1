/**
 * Daily Job Queue Scheduler - Inngest Function
 *
 * Runs at 6 AM daily to queue all job fetch tasks for the day.
 * Creates individual tasks for each role+location combination,
 * distributed throughout the day.
 *
 * Schedule: 6 AM daily
 */

import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity-logger';

export const scheduleDailyJobsFunction = inngest.createFunction(
  {
    id: 'schedule-daily-jobs',
    retries: 2,
  },
  [
    { cron: '0 6 * * *' }, // 6 AM daily
    { event: 'jobs/schedule-daily' }, // Manual trigger
  ],
  async ({ step }) => {
    const supabase = createAdminClient();

    // ==========================================
    // STEP 1: Get ICP Configuration
    // ==========================================
    const icpConfig = await step.run('get-icp-config', async () => {
      const { data: profiles } = await supabase
        .from('icp_profiles')
        .select('id, name, locations, specific_roles, signal_types')
        .eq('is_active', true);

      if (!profiles || profiles.length === 0) {
        return { tasks: [], profiles: 0 };
      }

      // Collect unique role+location combinations from profiles with job_pain enabled
      const taskMap = new Map<string, { role: string; location: string; icpId: string }>();

      for (const profile of profiles) {
        const signalTypes = profile.signal_types || [];
        if (!signalTypes.includes('job_pain')) {
          continue; // Skip profiles without job_pain
        }

        const roles = profile.specific_roles || [];
        const locations = profile.locations || [];

        for (const role of roles) {
          for (const location of locations) {
            const key = `${role}|${location}`;
            // Use first ICP that needs this combo (for tracking)
            if (!taskMap.has(key)) {
              taskMap.set(key, { role, location, icpId: profile.id });
            }
          }
        }
      }

      return {
        tasks: Array.from(taskMap.values()),
        profiles: profiles.length,
      };
    });

    if (icpConfig.tasks.length === 0) {
      await logActivity({
        type: 'queue_processed',
        title: 'Job ingestion schedule',
        detail: 'No tasks scheduled - no active ICPs with job_pain enabled',
      });
      return {
        success: true,
        message: 'No active ICPs with job_pain enabled',
        tasks_created: 0,
      };
    }

    // ==========================================
    // STEP 2: Create Queue Entries
    // ==========================================
    const queueStats = await step.run('create-queue-entries', async () => {
      const batchId = crypto.randomUUID();
      const now = new Date();
      const tasksToCreate: any[] = [];

      // Distribute tasks throughout the day (20 min intervals)
      // 72 slots per day (24 hours × 3 per hour)
      const intervalMinutes = 20;
      let slotIndex = 0;

      for (const task of icpConfig.tasks) {
        // Schedule Reed fetch
        const reedScheduledFor = new Date(now.getTime() + slotIndex * intervalMinutes * 60 * 1000);
        tasksToCreate.push({
          icp_profile_id: task.icpId,
          batch_id: batchId,
          task_type: 'job_fetch_reed',
          keywords: task.role,
          location: task.location,
          status: 'pending',
          priority: 1,
          attempts: 0,
          max_attempts: 3,
          scheduled_for: reedScheduledFor.toISOString(),
        });
        slotIndex++;

        // Schedule Adzuna fetch (next slot)
        const adzunaScheduledFor = new Date(now.getTime() + slotIndex * intervalMinutes * 60 * 1000);
        tasksToCreate.push({
          icp_profile_id: task.icpId,
          batch_id: batchId,
          task_type: 'job_fetch_adzuna',
          keywords: task.role,
          location: task.location,
          status: 'pending',
          priority: 1,
          attempts: 0,
          max_attempts: 3,
          scheduled_for: adzunaScheduledFor.toISOString(),
        });
        slotIndex++;
      }

      // Insert all tasks in batch
      const { error } = await supabase.from('scan_queue').insert(tasksToCreate);

      if (error) {
        throw new Error(`Failed to create queue entries: ${error.message}`);
      }

      await logActivity({
        type: 'queue_processed',
        title: 'Job ingestion scheduled',
        detail: `Scheduled ${tasksToCreate.length} tasks across ${icpConfig.tasks.length} role+location combinations`,
        metadata: { tasksCount: tasksToCreate.length, combinations: icpConfig.tasks.length },
      });

      return {
        batchId,
        tasksCreated: tasksToCreate.length,
        uniqueCombinations: icpConfig.tasks.length,
        estimatedCompletionHours: Math.ceil((tasksToCreate.length * intervalMinutes) / 60),
      };
    });

    return {
      success: true,
      stats: queueStats,
      timestamp: new Date().toISOString(),
    };
  }
);
