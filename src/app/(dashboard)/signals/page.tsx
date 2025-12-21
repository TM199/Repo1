import { createClient, createAdminClient } from '@/lib/supabase/server';
import { Signal } from '@/types';
import { SignalsPageClient } from './SignalsPageClient';

export default async function SignalsPage() {
  const supabase = await createClient();
  // Use admin client for signals since table has no user_id and RLS blocks access
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Use admin client to bypass RLS for signals
  const { data: signals, error } = await adminSupabase
    .from('signals')
    .select('*, source:sources(name)')
    .order('detected_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[Signals] Error fetching signals:', error);
  }

  // Mark signals as read when viewing this page (use admin client)
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
