'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Flame,
  TrendingUp,
  Clock,
  AlertTriangle,
  Building2,
  Briefcase,
  RefreshCw,
  ExternalLink,
  Users,
  Plus,
  Mail,
  Phone,
  Linkedin,
  Check,
  X,
  Download,
  Sparkles,
  Search,
  DollarSign,
  MapPin,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { ICPProfile } from '@/types';
import { getSignalExplanation, getQuickExplanation } from '@/lib/signal-explanations';

interface CompanyContact {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  seniority: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
}

interface JobAnalysis {
  workMode: string;
  salaryRange: string | null;
  techStack: string[];
  benefits: string[];
  hiringUrgency: string;
  confidence: number;
}

interface CompanyWithPain {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  region: string | null;
  hiring_pain_score: number;
  pain_signals: PainSignal[];
  contacts: CompanyContact[];
  active_jobs_count: number;
  job_analysis?: JobAnalysis;
}

interface PainSignal {
  id: string;
  pain_signal_type: string;
  signal_title: string;
  signal_detail: string;
  signal_value: number;
  days_since_refresh?: number;
  urgency: string;
  detected_at: string;
  source_job_posting_id: string | null;
  job_url: string | null;
}

// All supported industries
const INDUSTRIES = [
  'Technology & Software',
  'Construction & Infrastructure',
  'Healthcare & Life Sciences',
  'Financial Services',
  'Legal & Professional Services',
  'Engineering & Manufacturing',
  'Energy & Utilities',
  'Logistics & Supply Chain',
  'Retail & Consumer',
  'Education',
  'Hospitality & Leisure',
  'Property & Real Estate',
  'Other',
];

// All UK regions
const UK_REGIONS = [
  'London',
  'South East',
  'South West',
  'East of England',
  'West Midlands',
  'East Midlands',
  'North West',
  'North East',
  'Yorkshire & Humber',
  'Scotland',
  'Wales',
  'Northern Ireland',
];

const isHardToFillSignal = (signalType: string) => signalType.startsWith('hard_to_fill');

const getPainIcon = (signalType: string) => {
  if (signalType.startsWith('hard_to_fill')) return <Flame className="h-4 w-4" />;
  if (signalType.includes('stale')) return <Clock className="h-4 w-4" />;
  if (signalType.includes('repost')) return <TrendingUp className="h-4 w-4" />;
  if (signalType.includes('salary')) return <Flame className="h-4 w-4" />;
  if (signalType.includes('contract')) return <AlertTriangle className="h-4 w-4" />;
  if (signalType.includes('referral')) return <Briefcase className="h-4 w-4" />;
  return <Briefcase className="h-4 w-4" />;
};

const getUrgencyVariant = (urgency: string): 'destructive' | 'secondary' | 'outline' => {
  switch (urgency) {
    case 'immediate':
      return 'destructive';
    case 'short_term':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getPainScoreColor = (score: number) => {
  if (score >= 70) return 'text-red-600 bg-red-100';
  if (score >= 40) return 'text-orange-600 bg-orange-100';
  return 'text-yellow-600 bg-yellow-100';
};

// Email status colors matching SignalCard
const emailStatusColors: Record<string, { bg: string; text: string; valid: boolean }> = {
  verified: { bg: '#D1FAE5', text: '#047857', valid: true },
  valid: { bg: '#D1FAE5', text: '#047857', valid: true },
  risky: { bg: '#FEF3C7', text: '#92400E', valid: true },
  invalid: { bg: '#FEE2E2', text: '#B91C1C', valid: false },
  unknown: { bg: '#F0F3F7', text: '#6B7C93', valid: true },
};

export function CompaniesInPainDashboard() {
  const [companies, setCompanies] = useState<CompanyWithPain[]>([]);
  const [loading, setLoading] = useState(true);
  const [icpProfiles, setIcpProfiles] = useState<ICPProfile[]>([]);
  const [selectedIcpId, setSelectedIcpId] = useState<string>('all');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [minPainScore, setMinPainScore] = useState<number>(0);
  const [enrichingCompanyId, setEnrichingCompanyId] = useState<string | null>(null);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [batchEnriching, setBatchEnriching] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [analyzingJobsForCompanyId, setAnalyzingJobsForCompanyId] = useState<string | null>(null);

  // Find contacts for a company
  async function handleFindContacts(companyId: string, companyName: string) {
    setEnrichingCompanyId(companyId);
    setEnrichmentError(null);

    try {
      const response = await fetch(`/api/companies/${companyId}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.needs_domain) {
          setEnrichmentError(`${companyName} has no domain. Add domain in company settings.`);
        } else {
          setEnrichmentError(result.error || 'Failed to find contacts');
        }
        return;
      }

      // Update local state with new contacts
      if (result.contacts && result.contacts.length > 0) {
        setCompanies(prev => prev.map(company => {
          if (company.id === companyId) {
            return {
              ...company,
              contacts: result.contacts.map((c: CompanyContact, i: number) => ({
                id: `new-${i}`,
                full_name: c.full_name,
                first_name: c.first_name,
                last_name: c.last_name,
                job_title: c.job_title,
                seniority: c.seniority,
                email: c.email,
                email_status: c.email_status,
                phone: c.phone,
                linkedin_url: c.linkedin_url,
              }))
            };
          }
          return company;
        }));
        toast.success(`Found ${result.contacts.length} contacts for ${companyName}`);
      } else {
        toast.info(`No contacts found for ${companyName}`);
      }
    } catch (err) {
      setEnrichmentError('Network error. Please try again.');
    } finally {
      setEnrichingCompanyId(null);
    }
  }

  // Batch enrich all companies
  async function handleEnrichAll() {
    setBatchEnriching(true);
    setBatchProgress({ current: 0, total: 0, message: 'Starting batch enrichment...' });

    try {
      const response = await fetch('/api/companies/enrich-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50, skipEnriched: true })
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to start batch enrichment');
        return;
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        toast.error('Failed to read response stream');
        return;
      }

      let enrichedCount = 0;
      let failedCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.replace('data: ', ''));

            switch (data.type) {
              case 'start':
                setBatchProgress({ current: 0, total: data.total, message: data.message });
                break;
              case 'progress':
                setBatchProgress({ current: data.current, total: data.total, message: data.message });
                break;
              case 'success':
                enrichedCount++;
                break;
              case 'error':
              case 'no_contacts':
                failedCount++;
                break;
              case 'complete':
                toast.success(`Enrichment complete: ${enrichedCount} companies enriched, ${failedCount} failed`);
                fetchCompaniesInPain(); // Refresh the list
                break;
            }
          } catch {
            // Skip malformed SSE messages
          }
        }
      }
    } catch (err) {
      toast.error('Network error during batch enrichment');
    } finally {
      setBatchEnriching(false);
      setBatchProgress(null);
    }
  }

  // Analyze job URLs for a company
  async function handleAnalyzeJobs(companyId: string, companyName: string) {
    setAnalyzingJobsForCompanyId(companyId);

    try {
      const response = await fetch(`/api/companies/${companyId}/analyze-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to analyze job posting');
        return;
      }

      if (result.analysis) {
        // Update local state with analysis
        setCompanies(prev => prev.map(company => {
          if (company.id === companyId) {
            return {
              ...company,
              job_analysis: {
                workMode: result.analysis.workMode,
                salaryRange: result.analysis.salaryRange,
                techStack: result.analysis.techStack || [],
                benefits: result.analysis.companyBenefits || [],
                hiringUrgency: result.analysis.hiringUrgency,
                confidence: result.analysis.confidence
              }
            };
          }
          return company;
        }));
        toast.success(`Job analysis complete for ${companyName}`);
      } else {
        toast.info('No additional information found from job posting');
      }
    } catch {
      toast.error('Network error analyzing job');
    } finally {
      setAnalyzingJobsForCompanyId(null);
    }
  }

  // Export companies as CSV
  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        format: 'csv',
        minPainScore: String(minPainScore),
        enrichedOnly: 'false'
      });

      const response = await fetch(`/api/companies/export?${params}`);

      if (!response.ok) {
        toast.error('Failed to export companies');
        return;
      }

      // Download the CSV
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `companies-in-pain-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('CSV exported successfully');
    } catch (err) {
      toast.error('Failed to download export');
    } finally {
      setExporting(false);
    }
  }

  // Fetch ICP profiles on mount
  useEffect(() => {
    async function fetchICPProfiles() {
      const supabase = createClient();
      const { data } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      setIcpProfiles((data || []) as ICPProfile[]);
    }
    fetchICPProfiles();
  }, []);

  // Get the selected ICP profile
  const selectedIcp = icpProfiles.find(p => p.id === selectedIcpId);

  useEffect(() => {
    fetchCompaniesInPain();
  }, [selectedIcpId, selectedIndustry, selectedRegion, minPainScore]);

  async function fetchCompaniesInPain() {
    const supabase = createClient();
    setLoading(true);

    try {
      // Build query for companies with pain scores
      // Note: company_contacts is fetched separately to avoid errors if table doesn't exist
      let query = supabase
        .from('companies')
        .select(
          `
          *,
          company_pain_signals!inner(
            id, pain_signal_type, signal_title, signal_detail,
            signal_value, days_since_refresh, urgency, detected_at, source_job_posting_id,
            job_postings:source_job_posting_id(source_url)
          )
        `
        )
        .gte('hiring_pain_score', minPainScore > 0 ? minPainScore : 1)
        .eq('company_pain_signals.is_active', true)
        .order('hiring_pain_score', { ascending: false })
        .limit(100);

      // Apply ICP filtering if an ICP is selected
      if (selectedIcp) {
        // Filter by ICP industries
        if (selectedIcp.industries.length > 0) {
          query = query.in('industry', selectedIcp.industries);
        }
        // Filter by ICP locations (using region field with partial match)
        if (selectedIcp.locations.length > 0) {
          // Build OR condition for location matching
          const locationFilters = selectedIcp.locations.map(loc => `region.ilike.%${loc}%`).join(',');
          query = query.or(locationFilters);
        }
      } else {
        // Use manual filters when no ICP selected
        if (selectedIndustry !== 'all') {
          query = query.eq('industry', selectedIndustry);
        }
        if (selectedRegion !== 'all') {
          query = query.ilike('region', `%${selectedRegion}%`);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching companies:', error);
        setCompanies([]);
      } else {
        // Transform data and get job counts
        const companiesWithCounts = await Promise.all(
          (data || []).map(async (company) => {
            // Get active job count for this company
            const { count } = await supabase
              .from('job_postings')
              .select('*', { count: 'exact', head: true })
              .eq('company_id', company.id)
              .eq('is_active', true);

            // Transform pain signals to include job URL
            const painSignals = (company.company_pain_signals || []).map((signal: {
              id: string;
              pain_signal_type: string;
              signal_title: string;
              signal_detail: string;
              signal_value: number;
              urgency: string;
              detected_at: string;
              source_job_posting_id: string | null;
              job_postings: { source_url: string } | null;
            }) => ({
              ...signal,
              job_url: signal.job_postings?.source_url || null,
            }));

            // Try to get contacts (table may not exist yet)
            let contacts: CompanyContact[] = [];
            try {
              const { data: contactsData } = await supabase
                .from('company_contacts')
                .select('id, full_name, first_name, last_name, job_title, seniority, email, email_status, phone, linkedin_url')
                .eq('company_id', company.id);
              contacts = (contactsData || []) as CompanyContact[];
            } catch {
              // Table doesn't exist yet, ignore
            }

            return {
              ...company,
              pain_signals: painSignals,
              contacts,
              active_jobs_count: count || 0,
            };
          })
        );

        setCompanies(companiesWithCounts);
      }
    } catch (err) {
      console.error('Error:', err);
      setCompanies([]);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-6 w-6 animate-spin text-[#635BFF]" />
        <span className="ml-2 text-[#425466]">Loading companies in pain...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-[#0A2540]">{companies.length}</div>
            <p className="text-xs text-[#6B7C93]">Companies in Pain</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {companies.filter((c) => c.hiring_pain_score >= 70).length}
            </div>
            <p className="text-xs text-[#6B7C93]">Critical (70+)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {
                companies.filter((c) =>
                  c.pain_signals.some((s) => s.pain_signal_type.startsWith('hard_to_fill'))
                ).length
              }
            </div>
            <p className="text-xs text-[#6B7C93]">Actively Recruiting</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-[#0A2540]">
              {companies.reduce((sum, c) => sum + c.active_jobs_count, 0)}
            </div>
            <p className="text-xs text-[#6B7C93]">Open Roles</p>
          </CardContent>
        </Card>
      </div>

      {/* ICP Profile Selector */}
      {icpProfiles.length > 0 ? (
        <Card className="bg-[#F6F9FC] border-[#E3E8EE]">
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#635BFF]" />
                <span className="text-sm font-medium text-[#0A2540]">Filter by ICP:</span>
              </div>
              <select
                value={selectedIcpId}
                onChange={(e) => {
                  setSelectedIcpId(e.target.value);
                  // Reset manual filters when ICP is selected
                  if (e.target.value !== 'all') {
                    setSelectedIndustry('all');
                    setSelectedRegion('all');
                  }
                }}
                className="border border-[#E3E8EE] rounded-md px-3 py-2 text-sm bg-white text-[#0A2540] min-w-[200px]"
              >
                <option value="all">All Companies (No ICP Filter)</option>
                {icpProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              {selectedIcp && (
                <div className="flex items-center gap-2 text-xs text-[#6B7C93]">
                  <Badge variant="outline" className="bg-white">
                    {selectedIcp.industries.length} industries
                  </Badge>
                  <Badge variant="outline" className="bg-white">
                    {selectedIcp.locations.length} locations
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#FEF3C7] border-[#F59E0B]">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#92400E]" />
                <span className="text-sm text-[#92400E]">
                  No ICP profiles found. Create one to filter signals by your ideal clients.
                </span>
              </div>
              <Link href="/icp/new">
                <Button size="sm" className="bg-[#635BFF] hover:bg-[#5851DF] text-white">
                  <Plus className="h-4 w-4 mr-1" />
                  Create ICP
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Filters (shown when no ICP selected) */}
      <div className="flex gap-4 flex-wrap">
        {!selectedIcp && (
          <>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="border border-[#E3E8EE] rounded-md px-3 py-2 text-sm bg-white text-[#0A2540]"
            >
              <option value="all">All Industries</option>
              {INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>

            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="border border-[#E3E8EE] rounded-md px-3 py-2 text-sm bg-white text-[#0A2540]"
            >
              <option value="all">All Regions</option>
              {UK_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </>
        )}

        <select
          value={minPainScore}
          onChange={(e) => setMinPainScore(Number(e.target.value))}
          className="border border-[#E3E8EE] rounded-md px-3 py-2 text-sm bg-white text-[#0A2540]"
        >
          <option value={0}>Any Pain Score</option>
          <option value={20}>20+ (Moderate)</option>
          <option value={40}>40+ (High)</option>
          <option value={70}>70+ (Critical)</option>
        </select>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || companies.length === 0}
          >
            {exporting ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={handleEnrichAll}
            disabled={batchEnriching || companies.length === 0}
            className="bg-[#635BFF] hover:bg-[#5851DF] text-white"
          >
            {batchEnriching ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Enrich All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCompaniesInPain}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Batch Enrichment Progress */}
      {batchEnriching && batchProgress && (
        <Card className="bg-[#F0F4FF] border-[#635BFF]">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <RefreshCw className="h-5 w-5 text-[#635BFF] animate-spin" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#0A2540]">{batchProgress.message}</p>
                <div className="w-full bg-[#E3E8EE] rounded-full h-2 mt-2">
                  <div
                    className="bg-[#635BFF] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-[#6B7C93] mt-1">
                  {batchProgress.current} of {batchProgress.total} companies
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Company Cards */}
      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-[#6B7C93] mb-4" />
            <p className="text-[#425466]">No companies found with pain signals.</p>
            <p className="text-sm text-[#6B7C93] mt-2">
              Try adjusting your filters or run the job ingestion cron to populate data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {companies.map((company) => (
            <Card
              key={company.id}
              className="hover:shadow-lg transition-shadow border-[#E3E8EE]"
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-[#6B7C93]" />
                    <div>
                      <CardTitle className="text-lg text-[#0A2540]">
                        {company.name}
                      </CardTitle>
                      <p className="text-sm text-[#6B7C93]">
                        {company.industry || 'Unknown Industry'}
                        {company.region && ` • ${company.region}`}
                        {company.active_jobs_count > 0 &&
                          ` • ${company.active_jobs_count} open roles`}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`px-4 py-2 rounded-full font-bold text-sm ${getPainScoreColor(company.hiring_pain_score)}`}
                  >
                    Pain Score: {company.hiring_pain_score}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Pain Signals */}
                <div className="space-y-2 mb-4">
                  {company.pain_signals.slice(0, 3).map((signal) => {
                    const explanation = getSignalExplanation(signal.pain_signal_type);
                    return (
                      <div
                        key={signal.id}
                        className="flex items-start gap-2 p-3 bg-[#F6F9FC] rounded-lg border border-transparent hover:border-[#635BFF]/20 transition-colors"
                      >
                        <div className="text-[#635BFF] mt-0.5">
                          {getPainIcon(signal.pain_signal_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-[#0A2540] truncate">
                              {signal.signal_title}
                            </span>
                            <Badge variant={getUrgencyVariant(signal.urgency)}>
                              {signal.urgency.replace('_', ' ')}
                            </Badge>
                            {isHardToFillSignal(signal.pain_signal_type) ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200">
                                ACTIVE
                              </Badge>
                            ) : signal.pain_signal_type.includes('stale') ? (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                POSSIBLY STALE
                              </Badge>
                            ) : null}
                            {signal.job_url && (
                              <a
                                href={signal.job_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[#635BFF] hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View Job
                              </a>
                            )}
                          </div>
                          {/* Why This Matters - Explanation */}
                          {explanation && (
                            <div className="mt-2 p-2 bg-white rounded border border-[#E3E8EE]">
                              <p className="text-xs font-medium text-[#635BFF] mb-1">
                                Why this matters:
                              </p>
                              <p className="text-xs text-[#425466]">
                                {getQuickExplanation(signal.pain_signal_type)}
                              </p>
                              <p className="text-xs text-[#0A2540] mt-1 font-medium">
                                {explanation.actionAdvice}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {company.pain_signals.length > 3 && (
                    <p className="text-xs text-[#6B7C93] pl-6">
                      +{company.pain_signals.length - 3} more signals
                    </p>
                  )}
                </div>

                {/* Contacts Section */}
                {company.contacts && company.contacts.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#E3E8EE]">
                    <p className="text-[10px] font-medium text-[#6B7C93] mb-2">CONTACTS</p>
                    <div className="space-y-2">
                      {company.contacts.map((contact) => {
                        const emailStatus = emailStatusColors[contact.email_status || 'unknown'] || emailStatusColors.unknown;
                        return (
                          <div key={contact.id} className="flex items-center justify-between gap-2 text-xs bg-[#F6F9FC] p-2 rounded">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-[#0A2540] truncate">{contact.full_name}</p>
                                {contact.seniority && contact.seniority !== 'unknown' && (
                                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                                    contact.seniority === 'executive' ? 'bg-purple-100 text-purple-700' :
                                    contact.seniority === 'senior' ? 'bg-blue-100 text-blue-700' :
                                    contact.seniority === 'manager' ? 'bg-green-100 text-green-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {contact.seniority}
                                  </span>
                                )}
                              </div>
                              {contact.job_title && (
                                <p className="text-[#6B7C93] truncate">{contact.job_title}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Email Button */}
                              {contact.email ? (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(contact.email!);
                                    toast.success('Email copied to clipboard');
                                  }}
                                  className="h-6 px-1.5 rounded flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                                  style={{ backgroundColor: emailStatus.bg, color: emailStatus.text }}
                                  title={`Click to copy: ${contact.email}`}
                                >
                                  <Mail className="h-3 w-3" />
                                  {emailStatus.valid ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                                </button>
                              ) : (
                                <span className="h-6 px-1.5 rounded flex items-center gap-1 bg-[#FEE2E2] text-[#B91C1C]">
                                  <Mail className="h-3 w-3" />
                                  <X className="h-2.5 w-2.5" />
                                </span>
                              )}
                              {/* Phone Button */}
                              {contact.phone ? (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(contact.phone!);
                                    toast.success('Phone copied to clipboard');
                                  }}
                                  className="h-6 px-1.5 rounded flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                                  style={{ backgroundColor: '#D1FAE5', color: '#047857' }}
                                  title={`Click to copy: ${contact.phone}`}
                                >
                                  <Phone className="h-3 w-3" />
                                </button>
                              ) : (
                                <span className="h-6 px-1.5 rounded flex items-center gap-1 bg-[#F0F3F7] text-[#6B7C93]">
                                  <Phone className="h-3 w-3" />
                                </span>
                              )}
                              {/* LinkedIn Button */}
                              {contact.linkedin_url && (
                                <a
                                  href={contact.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="h-6 px-1.5 rounded flex items-center gap-1 hover:opacity-80 transition-opacity"
                                  style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}
                                >
                                  <Linkedin className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Job Analysis Section */}
                {company.job_analysis && company.job_analysis.confidence > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#E3E8EE]">
                    <p className="text-[10px] font-medium text-[#6B7C93] mb-2">JOB INSIGHTS</p>
                    <div className="flex flex-wrap gap-2">
                      {company.job_analysis.workMode && company.job_analysis.workMode !== 'unknown' && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">
                          <MapPin className="h-3 w-3" />
                          {company.job_analysis.workMode}
                        </span>
                      )}
                      {company.job_analysis.salaryRange && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-50 text-green-700">
                          <DollarSign className="h-3 w-3" />
                          {company.job_analysis.salaryRange}
                        </span>
                      )}
                      {company.job_analysis.hiringUrgency === 'urgent' && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-50 text-red-700">
                          <Zap className="h-3 w-3" />
                          Urgent Hire
                        </span>
                      )}
                      {company.job_analysis.techStack && company.job_analysis.techStack.length > 0 && (
                        <span className="text-xs text-[#6B7C93]">
                          Tech: {company.job_analysis.techStack.slice(0, 3).join(', ')}
                          {company.job_analysis.techStack.length > 3 && ' ...'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Enrichment Error */}
                {enrichmentError && enrichingCompanyId === null && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {enrichmentError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap mt-4">
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-[#635BFF]"
                    onClick={() => handleFindContacts(company.id, company.name)}
                    disabled={enrichingCompanyId === company.id}
                  >
                    {enrichingCompanyId === company.id ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        Finding...
                      </>
                    ) : (
                      <>
                        <Users className="h-4 w-4 mr-1" />
                        Find Contacts
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAnalyzeJobs(company.id, company.name)}
                    disabled={analyzingJobsForCompanyId === company.id || !company.pain_signals.some(s => s.job_url)}
                    title={company.pain_signals.some(s => s.job_url) ? 'Analyze job posting for insights' : 'No job URL available'}
                  >
                    {analyzingJobsForCompanyId === company.id ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-1" />
                        Analyze Job
                      </>
                    )}
                  </Button>
                  {company.domain && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(`https://${company.domain}`, '_blank')
                      }
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Website
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
