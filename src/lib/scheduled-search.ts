import { createAdminClient } from './supabase/server';
import { runSearch } from './search';

interface ScheduledSearchResult {
  processed: number;
  successful: number;
  totalNewSignals: number;
  errors: string[];
}

export async function processScheduledSearches(
  frequency: 'daily' | 'weekly' | 'monthly'
): Promise<ScheduledSearchResult> {
  const supabase = createAdminClient();

  console.log(`[ScheduledSearch] Processing ${frequency} scheduled searches...`);

  // Get all active search profiles with matching schedule
  const { data: profiles, error } = await supabase
    .from('search_profiles')
    .select('id, user_id, name')
    .eq('is_active', true)
    .eq('schedule_enabled', true)
    .eq('schedule_frequency', frequency);

  if (error) {
    console.error('[ScheduledSearch] Error fetching profiles:', error);
    return { processed: 0, successful: 0, totalNewSignals: 0, errors: [error.message] };
  }

  if (!profiles || profiles.length === 0) {
    console.log(`[ScheduledSearch] No ${frequency} scheduled profiles found`);
    return { processed: 0, successful: 0, totalNewSignals: 0, errors: [] };
  }

  console.log(`[ScheduledSearch] Found ${profiles.length} profiles to process`);

  let successful = 0;
  let totalNewSignals = 0;
  const errors: string[] = [];

  for (const profile of profiles) {
    try {
      console.log(`[ScheduledSearch] Running search for profile: ${profile.name} (${profile.id})`);

      const result = await runSearch(profile.id, profile.user_id);
      successful++;
      totalNewSignals += result.newSignals;

      console.log(`[ScheduledSearch] Profile ${profile.name}: ${result.newSignals} new signals`);

      // Update last_scheduled_run timestamp
      await supabase
        .from('search_profiles')
        .update({ last_scheduled_run: new Date().toISOString() })
        .eq('id', profile.id);

    } catch (err) {
      const errorMsg = `Profile ${profile.id}: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`[ScheduledSearch] Error:`, errorMsg);
      errors.push(errorMsg);
    }

    // Delay between profiles to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`[ScheduledSearch] Completed: ${successful}/${profiles.length} successful, ${totalNewSignals} new signals`);

  return {
    processed: profiles.length,
    successful,
    totalNewSignals,
    errors,
  };
}
