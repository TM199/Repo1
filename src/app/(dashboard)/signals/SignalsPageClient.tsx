'use client';

import { useState } from 'react';
import { Signal } from '@/types';
import { SignalCard } from '@/components/dashboard/SignalCard';
import { SignalsTable } from '@/components/dashboard/SignalsTable';
import { Button } from '@/components/ui/button';
import { LayoutGrid, TableIcon, Download } from 'lucide-react';

interface SignalsPageClientProps {
  signals: Signal[];
}

export function SignalsPageClient({ signals }: SignalsPageClientProps) {
  const [view, setView] = useState<'cards' | 'table'>('cards');

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
