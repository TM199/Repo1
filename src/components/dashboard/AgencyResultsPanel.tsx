'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExtractedSignal, SignalType } from '@/types';
import { ExternalLink, Download, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSignalTypeConfig } from '@/lib/signal-mapping';
import { SIGNAL_HIRING_URGENCY } from '@/lib/agency-signal-mapping';

interface AgencySignal extends ExtractedSignal {
  signal_type: SignalType;
  industry: string;
}

interface AgencyResultsPanelProps {
  signals: AgencySignal[];
}

const signalTypeStyles: Record<string, { bg: string; text: string }> = {
  contract_awarded: { bg: '#F3E8FF', text: '#7C3AED' },
  planning_approved: { bg: '#D1FAE5', text: '#047857' },
  planning_submitted: { bg: '#FEF3C7', text: '#B45309' },
  funding_announced: { bg: '#FCE7F3', text: '#BE185D' },
  company_expansion: { bg: '#CCFBF1', text: '#0F766E' },
  leadership_change: { bg: '#FFEDD5', text: '#C2410C' },
  cqc_rating_change: { bg: '#FEE2E2', text: '#B91C1C' },
  project_announced: { bg: '#DBEAFE', text: '#1D4ED8' },
  company_hiring: { bg: '#EEF2FF', text: '#4338CA' },
  acquisition_merger: { bg: '#E0E7FF', text: '#4F46E5' },
  new_job: { bg: '#EEF2FF', text: '#4338CA' },
};

export function AgencyResultsPanel({ signals }: AgencyResultsPanelProps) {
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = () => {
    if (signals.length === 0) {
      toast.error('No signals to export');
      return;
    }

    setExporting(true);

    try {
      // Build CSV content
      const headers = ['Company Name', 'Domain', 'Signal Type', 'Industry', 'Title', 'Details', 'URL'];
      const rows = signals.map(s => [
        s.company_name,
        s.company_domain || '',
        s.signal_type,
        s.industry,
        s.signal_title,
        s.signal_detail?.replace(/"/g, '""') || '',
        s.signal_url || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `agency-signals-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${signals.length} signals to CSV`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (signals.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-[#6B7C93]">No signals found. Try broadening your criteria.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={handleExportCSV}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export CSV
        </Button>
      </div>

      <div className="grid gap-3">
        {signals.map((signal, index) => {
          const style = signalTypeStyles[signal.signal_type] || { bg: '#F0F3F7', text: '#425466' };
          const config = getSignalTypeConfig(signal.signal_type);
          const urgency = SIGNAL_HIRING_URGENCY[signal.signal_type];

          return (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge
                        style={{ backgroundColor: style.bg, color: style.text }}
                        className="text-xs font-medium"
                      >
                        {config?.label || signal.signal_type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {signal.industry}
                      </Badge>
                      {urgency === 'immediate' && (
                        <Badge className="bg-red-100 text-red-700 text-xs">
                          High Urgency
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-semibold text-[#0A2540] mb-1 truncate">
                      {signal.company_name}
                    </h3>

                    <p className="text-sm font-medium text-[#0A2540] mb-1">
                      {signal.signal_title}
                    </p>

                    {signal.signal_detail && (
                      <p className="text-sm text-[#6B7C93] line-clamp-2">
                        {signal.signal_detail}
                      </p>
                    )}

                    {signal.company_domain && (
                      <p className="text-xs text-[#6B7C93] mt-2">
                        {signal.company_domain}
                      </p>
                    )}
                  </div>

                  {signal.signal_url && (
                    <a
                      href={signal.signal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#635BFF] hover:text-[#5851ea] flex-shrink-0"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
