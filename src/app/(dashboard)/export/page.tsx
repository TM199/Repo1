'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';

export default function ExportPage() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);

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

    setLoading(false);
  }

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
        <CardContent>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
