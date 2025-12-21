'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Target, Download, Search } from 'lucide-react';

interface SearchResult {
  success: boolean;
  signals_found?: number;
  run_id?: string;
  error?: string;
  profile_name?: string;
}

interface LiveSignal {
  company_name: string;
  signal_title: string;
  signal_type: string;
}

const signalTypeLabels: Record<string, string> = {
  new_job: 'Hiring',
  planning_submitted: 'Planning',
  planning_approved: 'Approved',
  contract_awarded: 'Contract',
  funding_announced: 'Funding',
  leadership_change: 'Leadership',
  cqc_rating_change: 'CQC',
  company_expansion: 'Expansion',
};

export default function RunSearchPage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [profileName, setProfileName] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('Initializing search...');
  const [queryCount, setQueryCount] = useState<number>(0);
  const [liveSignals, setLiveSignals] = useState<LiveSignal[]>([]);

  async function handleExport() {
    if (!result?.run_id) return;
    setExporting(true);
    try {
      const response = await fetch(`/api/signals/export?search_run_id=${result.run_id}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signals-${profileName || 'search'}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    async function runSearch() {
      try {
        // First, fetch the profile to get its name
        const profileResponse = await fetch(`/api/search/profiles/${profileId}`);
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setProfileName(profileData.name);
        }

        // Run search with streaming
        const response = await fetch('/api/search/run/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ profileId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Search failed');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case 'queries':
                  setQueryCount(event.count);
                  setProgressMessage(`Generated ${event.count} search queries`);
                  break;
                case 'progress':
                  setProgressMessage(event.message);
                  break;
                case 'signal':
                  setLiveSignals(prev => [...prev, event.signal]);
                  break;
                case 'complete':
                  setResult({
                    success: true,
                    signals_found: event.signals_found,
                    run_id: event.run_id,
                    profile_name: profileName,
                  });
                  setLoading(false);
                  break;
                case 'error':
                  throw new Error(event.message);
              }
            }
          }
        }
      } catch (error) {
        setResult({
          success: false,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
        });
        setLoading(false);
      }
    }

    runSearch();
  }, [profileId, profileName]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Button */}
      <Link href={`/search/${profileId}`}>
        <Button variant="ghost" size="sm" className="text-[#6B7C93] hover:text-[#0A2540]">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Profile
        </Button>
      </Link>

      {/* Main Card */}
      <Card className="bg-white border-[#E3E8EE]">
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-[#0A2540]">
            {loading ? 'Running Search...' : result?.success ? 'Search Complete' : 'Search Failed'}
          </CardTitle>
          {profileName && (
            <CardDescription className="text-[#6B7C93]">
              {profileName}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Loading State with Live Progress */}
          {loading && (
            <div className="space-y-6">
              {/* Progress Header */}
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative">
                  <Loader2 className="h-12 w-12 text-[#635BFF] animate-spin" />
                  {liveSignals.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#635BFF] rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{liveSignals.length}</span>
                    </div>
                  )}
                </div>
                <p className="text-[#0A2540] font-medium mt-4 text-center">
                  {progressMessage}
                </p>
                {queryCount > 0 && (
                  <p className="text-xs text-[#6B7C93] mt-1">
                    Running {queryCount} queries
                  </p>
                )}
              </div>

              {/* Live Signals Feed */}
              {liveSignals.length > 0 && (
                <div className="border border-[#E3E8EE] rounded-lg overflow-hidden">
                  <div className="bg-[#F6F9FC] px-4 py-2 border-b border-[#E3E8EE]">
                    <p className="text-xs font-medium text-[#6B7C93]">
                      SIGNALS FOUND ({liveSignals.length})
                    </p>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-[#E3E8EE]">
                    {liveSignals.map((signal, idx) => (
                      <div key={idx} className="px-4 py-2 flex items-center gap-3 animate-fadeIn">
                        <Badge
                          className="text-[9px] font-medium px-1.5 py-0.5 border-0 shrink-0"
                          style={{ backgroundColor: '#EEF2FF', color: '#4338CA' }}
                        >
                          {signalTypeLabels[signal.signal_type] || signal.signal_type}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[#0A2540] truncate">
                            {signal.company_name}
                          </p>
                          <p className="text-[10px] text-[#6B7C93] truncate">
                            {signal.signal_title}
                          </p>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-[#047857] shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success State */}
          {!loading && result?.success && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 bg-[#D1FAE5] rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-10 w-10 text-[#047857]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0A2540] mb-2">
                {result.signals_found} {result.signals_found === 1 ? 'Signal' : 'Signals'} Found
              </h3>
              <p className="text-[#6B7C93] text-center max-w-md mb-6">
                Your search has been completed successfully.
                {result.signals_found && result.signals_found > 0
                  ? ' New signals have been added to your dashboard.'
                  : ' No new signals were found matching your criteria.'}
              </p>

              {result.signals_found && result.signals_found > 0 && (
                <div className="flex gap-3">
                  <Button
                    onClick={handleExport}
                    disabled={exporting}
                    className="bg-[#635BFF] hover:bg-[#5851DF] text-white"
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download CSV
                  </Button>
                  <Link href="/signals">
                    <Button variant="outline" className="border-[#E3E8EE]">
                      <Target className="h-4 w-4 mr-2" />
                      View Signals
                    </Button>
                  </Link>
                </div>
              )}

              {(!result.signals_found || result.signals_found === 0) && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => router.push(`/search/${profileId}`)}
                    variant="outline"
                    className="border-[#E3E8EE]"
                  >
                    Edit Profile
                  </Button>
                  <Button
                    onClick={() => window.location.reload()}
                    className="bg-[#635BFF] hover:bg-[#5851DF] text-white"
                  >
                    Run Again
                  </Button>
                </div>
              )}

              {/* Search Details */}
              <div className="w-full mt-8 p-4 bg-[#F6F9FC] rounded-lg border border-[#E3E8EE]">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[#6B7C93] text-xs mb-1">Search Run ID</p>
                    <p className="text-[#0A2540] font-mono text-xs">{result.run_id?.slice(0, 8)}...</p>
                  </div>
                  <div>
                    <p className="text-[#6B7C93] text-xs mb-1">Completed At</p>
                    <p className="text-[#0A2540] text-xs">{new Date().toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {!loading && result && !result.success && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 bg-[#FEE2E2] rounded-full flex items-center justify-center mb-4">
                <XCircle className="h-10 w-10 text-[#CD3D64]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0A2540] mb-2">Search Failed</h3>
              <p className="text-[#6B7C93] text-center max-w-md mb-6">
                We encountered an error while running your search. Please try again or contact support if the issue persists.
              </p>

              {result.error && (
                <div className="w-full p-4 bg-[#FEE2E2] rounded-lg border border-[#FCA5A5] mb-6">
                  <p className="text-[#CD3D64] text-sm font-mono">{result.error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => window.location.reload()}
                  className="bg-[#635BFF] hover:bg-[#5851DF] text-white"
                >
                  Try Again
                </Button>
                <Link href={`/search/${profileId}`}>
                  <Button variant="outline" className="border-[#E3E8EE]">
                    Back to Profile
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="bg-[#F6F9FC] border-[#E3E8EE]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <Search className="h-4 w-4 text-[#635BFF]" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-[#0A2540] mb-1">About Search Runs</h4>
              <p className="text-xs text-[#6B7C93] leading-relaxed">
                Search runs scan your connected sources for signals that match your profile criteria.
                Results are automatically deduplicated and added to your signals dashboard. You can view
                the history of all search runs in your profile details.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
