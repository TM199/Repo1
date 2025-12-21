'use client';

import { useState } from 'react';
import { Signal, SignalContact } from '@/types';

type SignalWithContacts = Signal & { contacts?: SignalContact[] };
import { SignalCard } from '@/components/dashboard/SignalCard';
import { SignalsTable } from '@/components/dashboard/SignalsTable';
import { Button } from '@/components/ui/button';
import { LayoutGrid, TableIcon, Download, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SignalsPageClientProps {
  signals: SignalWithContacts[];
}

export function SignalsPageClient({ signals }: SignalsPageClientProps) {
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 });

  const handleEnrichAll = async () => {
    const signalsToEnrich = signals.filter(s => !s.contacts || s.contacts.length === 0);
    if (signalsToEnrich.length === 0) {
      toast.info('All signals already have contacts');
      return;
    }

    setEnrichingAll(true);
    setEnrichProgress({ current: 0, total: signalsToEnrich.length });
    let successCount = 0;

    for (let i = 0; i < signalsToEnrich.length; i++) {
      setEnrichProgress({ current: i + 1, total: signalsToEnrich.length });
      try {
        const response = await fetch(`/api/signals/${signalsToEnrich[i].id}/enrich`, {
          method: 'POST',
        });
        if (response.ok) successCount++;
      } catch {
        // Continue to next signal
      }
    }

    setEnrichingAll(false);
    toast.success(`Enriched ${successCount} of ${signalsToEnrich.length} signals`);
    window.location.reload();
  };

  const handleExportAll = async () => {
    const response = await fetch('/api/signals/export');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signals-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0A2540]">All Signals</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEnrichAll}
            disabled={enrichingAll}
            className="border-[#E3E8EE] text-[#425466] hover:bg-[#F6F9FC]"
          >
            {enrichingAll ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {enrichProgress.current}/{enrichProgress.total}
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Enrich All
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            className="border-[#E3E8EE] text-[#425466] hover:bg-[#F6F9FC]"
          >
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
          <div className="flex border border-[#E3E8EE] rounded-lg overflow-hidden">
            <button
              onClick={() => setView('cards')}
              className={`px-3 py-1.5 flex items-center gap-1.5 text-sm transition-colors ${
                view === 'cards'
                  ? 'bg-[#635BFF] text-white'
                  : 'bg-white text-[#6B7C93] hover:bg-[#F6F9FC]'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Cards
            </button>
            <button
              onClick={() => setView('table')}
              className={`px-3 py-1.5 flex items-center gap-1.5 text-sm transition-colors ${
                view === 'table'
                  ? 'bg-[#635BFF] text-white'
                  : 'bg-white text-[#6B7C93] hover:bg-[#F6F9FC]'
              }`}
            >
              <TableIcon className="h-4 w-4" />
              Table
            </button>
          </div>
        </div>
      </div>

      {signals.length > 0 ? (
        view === 'cards' ? (
          <div className="space-y-4">
            {signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        ) : (
          <SignalsTable signals={signals} />
        )
      ) : (
        <p className="text-muted-foreground py-8 text-center">
          No signals yet. Scrape a source to detect signals.
        </p>
      )}
    </div>
  );
}
