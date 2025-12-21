import { createClient, createAdminClient } from '@/lib/supabase/server';
import { Signal } from '@/types';
import { SignalsPageClient } from './SignalsPageClient';
import { getSignalsForUser, getSignalIdsForUser } from '@/lib/supabase/queries';

export default async function SignalsPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in</div>;
  }

  // Get signals filtered by user
  const { data: signals, error } = await getSignalsForUser(user.id, { limit: 100 });

  if (error) {
    console.error('[Signals] Error fetching signals:', error);
  }

  // Mark user's signals as read when viewing this page
  if (signals && signals.length > 0) {
    const newSignalIds = signals.filter(s => s.is_new).map(s => s.id);
    if (newSignalIds.length > 0) {
      await adminSupabase
        .from('signals')
        .update({ is_new: false })
        .in('id', newSignalIds);
    }
  }

  return <SignalsPageClient signals={(signals as Signal[]) || []} />;
}
