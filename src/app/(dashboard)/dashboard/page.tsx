import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { SignalCard } from '@/components/dashboard/SignalCard';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { Button } from '@/components/ui/button';
import { Signal } from '@/types';
import { Download } from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();
  // Use admin client for signals since table has no user_id and RLS blocks access
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Use admin client to bypass RLS for signals
  const { data: signals, error: signalsError } = await adminSupabase
    .from('signals')
    .select('*, source:sources(name)')
    .order('detected_at', { ascending: false })
    .limit(20);

  if (signalsError) {
    console.error('[Dashboard] Error fetching signals:', signalsError);
  }
  console.log('[Dashboard] Fetched signals count:', signals?.length || 0);

  const { count: totalSignals } = await adminSupabase
    .from('signals')
    .select('*', { count: 'exact', head: true });

  const { count: newSignals } = await adminSupabase
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .eq('is_new', true);

  const { count: totalSources } = await supabase
    .from('sources')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0A2540]">Dashboard</h1>
        <Link href="/export">
          <Button variant="outline" className="border-[#E3E8EE] text-[#425466] hover:bg-[#F6F9FC]">
            <Download className="h-4 w-4 mr-2" />
            Download Signals
          </Button>
        </Link>
      </div>

      <StatsCards
        totalSignals={totalSignals || 0}
        newSignals={newSignals || 0}
        totalSources={totalSources || 0}
      />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recent Signals</h2>
        {signals && signals.length > 0 ? (
          signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal as Signal} />
          ))
        ) : (
          <p className="text-muted-foreground py-8 text-center">
            No signals yet. Add a source to start tracking.
          </p>
        )}
      </div>
    </div>
  );
}
