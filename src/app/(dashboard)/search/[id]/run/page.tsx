'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, ArrowLeft, ExternalLink, Target, Download } from 'lucide-react';

interface SearchResult {
  success: boolean;
  signals_found?: number;
  run_id?: string;
  error?: string;
  profile_name?: string;
}

export default function RunSearchPage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [profileName, setProfileName] = useState<string>('');
  const [exporting, setExporting] = useState(false);

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

        // Then run the search
        const response = await fetch('/api/search/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ profileId }),
        });

        const data = await response.json();

        if (response.ok) {
          setResult({
            success: true,
            signals_found: data.signals_found || 0,
            run_id: data.run_id,
            profile_name: profileName,
          });
        } else {
          setResult({
            success: false,
            error: data.error || 'Search failed',
          });
        }
      } catch (error) {
        setResult({
          success: false,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
        });
      } finally {
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
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-16 w-16 text-[#635BFF] animate-spin mb-4" />
              <p className="text-[#6B7C93] text-center">
                Searching for signals matching your profile criteria...
              </p>
              <p className="text-xs text-[#9CA3AF] mt-2">
                This may take a few moments
              </p>
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
              <span className="text-[#635BFF] font-bold">?</span>
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
