'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';

export default function ExportPage() {
  const [exportState, setExportState] = useState<'idle' | 'preparing' | 'downloading'>('idle');
  const [counts, setCounts] = useState<{ companies: number; signals: number } | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const response = await fetch('/api/companies/export?format=json&limit=0');
        const data = await response.json();
        setCounts({
          companies: data.summary?.totalCompanies ?? 0,
          signals: data.summary?.totalSignals ?? 0,
        });
      } catch {
        setCounts(null);
      } finally {
        setLoadingCounts(false);
      }
    }
    fetchCounts();
  }, []);

  async function handleExport() {
    setExportState('preparing');

    const response = await fetch('/api/signals/export');

    setExportState('downloading');
    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signals-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    setExportState('idle');
  }

  const isLoading = exportState !== 'idle';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Export Signals</h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Export to CSV</CardTitle>
          <CardDescription>
            Download all your signals as a CSV file ready for enrichment in Clay or Prospeo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingCounts ? (
            <p className="text-sm text-muted-foreground">Loading export data...</p>
          ) : counts ? (
            <p className="text-sm text-muted-foreground">
              Ready to export {counts.companies} companies with {counts.signals} signals
            </p>
          ) : null}

          <Button onClick={handleExport} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {exportState === 'preparing' ? 'Preparing export...' : 'Downloading...'}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
