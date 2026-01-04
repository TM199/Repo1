'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { staggerContainer } from '@/lib/animations';
import { CompanyCardSkeletonList } from '@/components/dashboard/CompanyCardSkeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Flame,
  Building2,
  RefreshCw,
  Plus,
  HelpCircle,
  Award,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { ICPProfile } from '@/types';

// Import extracted components and types
import {
  CompanyFilters,
  SIGNAL_TABS,
  SignalTab,
  DateFilter,
  SortOption,
} from './CompanyFilters';
import {
  CompanyCard,
  CompanyWithPain,
  CompanyContact,
  PainSignal,
} from './CompanyCard';

// Signal priority for sorting (lower = higher priority, shown first)
const getSignalPriority = (signalType: string): number => {
  if (signalType === 'contract_awarded_first') return 1;
  if (signalType === 'contract_awarded_large') return 2;
  if (signalType === 'contract_awarded_multiple') return 3;
  if (signalType.startsWith('hard_to_fill')) return 4;
  if (signalType.includes('contract_awarded')) return 5;
  return 10;
};

export function CompaniesInPainDashboard() {
  const searchParams = useSearchParams();
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
  const [activeTab, setActiveTab] = useState<SignalTab>('all');
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [classifyingCompanyId, setClassifyingCompanyId] = useState<string | null>(null);
  const [batchClassifying, setBatchClassifying] = useState(false);
  const [classificationProgress, setClassificationProgress] = useState<{ current: number; total: number } | null>(null);
  const [resolvingDomainId, setResolvingDomainId] = useState<string | null>(null);
  const [batchResolvingDomains, setBatchResolvingDomains] = useState(false);
  const [successCompanyId, setSuccessCompanyId] = useState<string | null>(null);
  const [domainProgress, setDomainProgress] = useState<{ current: number; total: number } | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
    const urlDateFilter = searchParams.get('dateFilter');
    if (urlDateFilter && ['today', '7days', '30days', 'all'].includes(urlDateFilter)) {
      return urlDateFilter as DateFilter;
    }
    return 'all';
  });
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    const urlSort = searchParams.get('sort');
    if (urlSort && ['pain_score', 'newest', 'oldest'].includes(urlSort)) {
      return urlSort as SortOption;
    }
    return 'pain_score';
  });

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
        setSuccessCompanyId(companyId);
        setTimeout(() => setSuccessCompanyId(null), 1500);
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
                fetchCompaniesInPain();
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

  // Classify a single company
  async function handleClassifyCompany(companyId: string, companyName: string) {
    setClassifyingCompanyId(companyId);
    try {
      const response = await fetch(`/api/companies/${companyId}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to classify company');
        return;
      }

      const domainInfo = result.result?.domain ? ` - ${result.result.domain}` : '';
      if (result.result?.isRecruitmentAgency) {
        toast.warning(`${companyName} is a recruitment agency (${result.result.confidence}%)${domainInfo}`);
      } else {
        toast.success(`${companyName} verified (${result.result?.confidence}%)${domainInfo}`);
      }

      setSuccessCompanyId(companyId);
      setTimeout(() => setSuccessCompanyId(null), 1500);
      fetchCompaniesInPain();
    } catch {
      toast.error('Network error during classification');
    } finally {
      setClassifyingCompanyId(null);
    }
  }

  // Batch classify all visible companies
  async function handleClassifyAll() {
    setBatchClassifying(true);
    setClassificationProgress({ current: 0, total: companies.length });

    let classified = 0;
    let agencies = 0;

    for (const company of companies) {
      setClassificationProgress({ current: classified + 1, total: companies.length });

      try {
        const response = await fetch(`/api/companies/${company.id}/classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.isRecruitmentAgency) {
            agencies++;
          }
        }
        classified++;
      } catch {
        // Continue with next company
      }
    }

    toast.success(`Classified ${classified} companies. Found ${agencies} agencies.`);
    setBatchClassifying(false);
    setClassificationProgress(null);
    fetchCompaniesInPain();
  }

  // Resolve domain for a single company
  async function handleResolveDomain(companyId: string, companyName: string) {
    setResolvingDomainId(companyId);
    try {
      const response = await fetch(`/api/companies/${companyId}/resolve-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to find website');
        return;
      }

      if (result.success && result.domain) {
        toast.success(`Found website: ${result.domain} (${result.confidence}% confidence)`);
        setSuccessCompanyId(companyId);
        setTimeout(() => setSuccessCompanyId(null), 1500);
        fetchCompaniesInPain();
      } else {
        toast.info(`Could not find website for ${companyName}`);
      }
    } catch {
      toast.error('Network error during domain resolution');
    } finally {
      setResolvingDomainId(null);
    }
  }

  // Batch resolve domains for companies without websites
  async function handleResolveAllDomains() {
    const companiesWithoutDomains = companies.filter(c => !c.domain);
    if (companiesWithoutDomains.length === 0) {
      toast.info('All companies already have websites');
      return;
    }

    setBatchResolvingDomains(true);
    setDomainProgress({ current: 0, total: companiesWithoutDomains.length });

    let resolved = 0;
    let notFound = 0;

    for (const company of companiesWithoutDomains) {
      setDomainProgress({ current: resolved + notFound + 1, total: companiesWithoutDomains.length });

      try {
        const response = await fetch(`/api/companies/${company.id}/resolve-domain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.domain) {
            resolved++;
          } else {
            notFound++;
          }
        } else {
          notFound++;
        }
      } catch {
        notFound++;
      }
    }

    toast.success(`Found ${resolved} websites, ${notFound} not found`);
    setBatchResolvingDomains(false);
    setDomainProgress(null);
    fetchCompaniesInPain();
  }

  // Fetch ICP profiles on mount (filtered by current user)
  useEffect(() => {
    async function fetchICPProfiles() {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIcpProfiles([]);
        return;
      }

      const { data } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('user_id', user.id)
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
  }, [selectedIcpId, selectedIndustry, selectedRegion, minPainScore, activeTab, dateFilter, sortOption, icpProfiles]);

  async function fetchCompaniesInPain() {
    const supabase = createClient();
    setLoading(true);

    try {
      let query = supabase
        .from('companies')
        .select(
          `
          *,
          company_pain_signals!inner(
            id, pain_signal_type, signal_title, signal_detail,
            signal_value, days_since_refresh, urgency, detected_at, source_job_posting_id,
            source, source_contract_id,
            job_postings:source_job_posting_id(source_url)
          )
        `
        )
        .gte('hiring_pain_score', minPainScore > 0 ? minPainScore : 1)
        .eq('company_pain_signals.is_active', true)
        .order('hiring_pain_score', { ascending: false })
        .limit(100);

      if (selectedIcp) {
        query = query.eq('company_pain_signals.icp_profile_id', selectedIcp.id);
      } else if (icpProfiles.length > 0) {
        const userIcpIds = icpProfiles.map(p => p.id);
        query = query.in('company_pain_signals.icp_profile_id', userIcpIds);

        if (selectedIndustry !== 'all') {
          query = query.eq('industry', selectedIndustry);
        }
        if (selectedRegion !== 'all') {
          query = query.ilike('region', `%${selectedRegion}%`);
        }
      } else {
        if (selectedIndustry !== 'all') {
          query = query.eq('industry', selectedIndustry);
        }
        if (selectedRegion !== 'all') {
          query = query.ilike('region', `%${selectedRegion}%`);
        }
      }

      const activeTabConfig = SIGNAL_TABS.find(t => t.id === activeTab);
      if (activeTabConfig && activeTabConfig.sources.length > 0) {
        query = query.in('company_pain_signals.source', activeTabConfig.sources);
      }

      if (dateFilter !== 'all') {
        const now = new Date();
        let filterDate: Date;

        switch (dateFilter) {
          case 'today':
            filterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case '7days':
            filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30days':
            filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            filterDate = new Date(0);
        }

        query = query.gte('company_pain_signals.detected_at', filterDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching companies:', error);
        setCompanies([]);
      } else {
        const companiesWithCounts = await Promise.all(
          (data || []).map(async (company) => {
            const { count } = await supabase
              .from('job_postings')
              .select('*', { count: 'exact', head: true })
              .eq('company_id', company.id)
              .eq('is_active', true);

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const rawSignals = (company.company_pain_signals || [])
              .filter((signal: { source: string; detected_at: string }) => {
                if (signal.source === 'contracts_finder') {
                  return new Date(signal.detected_at) >= thirtyDaysAgo;
                }
                return true;
              })
              .map((signal: {
                id: string;
                pain_signal_type: string;
                signal_title: string;
                signal_detail: string;
                signal_value: number;
                urgency: string;
                detected_at: string;
                source_job_posting_id: string | null;
                source_contract_id?: string | null;
                source: string;
                job_postings: { source_url: string } | null;
              }) => ({
                ...signal,
                job_url: signal.job_postings?.source_url || null,
              }));

            const seenSignals = new Set<string>();
            const painSignals = rawSignals
              .filter((signal: {
                pain_signal_type: string;
                source_job_posting_id: string | null;
                source_contract_id?: string | null;
              }) => {
                const sourceId = signal.source_job_posting_id || signal.source_contract_id || signal.pain_signal_type;
                const key = `${sourceId}-${signal.pain_signal_type}`;
                if (seenSignals.has(key)) {
                  return false;
                }
                seenSignals.add(key);
                return true;
              })
              .sort((a: { pain_signal_type: string }, b: { pain_signal_type: string }) =>
                getSignalPriority(a.pain_signal_type) - getSignalPriority(b.pain_signal_type)
              );

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

            const mostRecentSignalDate = painSignals.length > 0
              ? Math.max(...painSignals.map((s: PainSignal) => new Date(s.detected_at).getTime()))
              : 0;

            return {
              ...company,
              pain_signals: painSignals,
              contacts,
              active_jobs_count: count || 0,
              mostRecentSignalDate,
            };
          })
        );

        let sortedCompanies = [...companiesWithCounts];
        switch (sortOption) {
          case 'newest':
            sortedCompanies.sort((a, b) => (b.mostRecentSignalDate || 0) - (a.mostRecentSignalDate || 0));
            break;
          case 'oldest':
            sortedCompanies.sort((a, b) => (a.mostRecentSignalDate || 0) - (b.mostRecentSignalDate || 0));
            break;
          case 'pain_score':
          default:
            break;
        }

        setCompanies(sortedCompanies);
      }
    } catch (err) {
      console.error('Error:', err);
      setCompanies([]);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <CompanyCardSkeletonList count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{companies.length}</div>
            <p className="text-xs text-muted-foreground">Companies in Pain</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {companies.filter((c) => c.hiring_pain_score >= 70).length}
            </div>
            <p className="text-xs text-muted-foreground">Critical (70+)</p>
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
            <p className="text-xs text-muted-foreground">Actively Recruiting</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">
              {companies.reduce((sum, c) => sum + c.active_jobs_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Open Roles</p>
          </CardContent>
        </Card>
      </div>

      {/* Signal Key - Always Visible */}
      <Card className="border-border">
        <div className="px-6 py-3 flex items-center gap-2 border-b border-border">
          <HelpCircle className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Signal Key</span>
        </div>
        <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Job Board Signals */}
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="h-5 w-5 text-orange-600" />
                  <h3 className="font-semibold text-foreground">Job Board Signals</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">From Reed API - indicates hiring difficulties</p>
                <div className="space-y-2 text-xs">
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-700 shrink-0">Hard to Fill</Badge>
                    <span className="text-muted-foreground">Job open 30+ days AND still being refreshed (active pain)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-amber-100 text-amber-700 shrink-0">Stale</Badge>
                    <span className="text-muted-foreground">Job open 30+ days but NOT refreshed recently (may be abandoned)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="shrink-0">Reposted</Badge>
                    <span className="text-muted-foreground">Same job posted multiple times (struggling to fill)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="shrink-0">Salary Increase</Badge>
                    <span className="text-muted-foreground">Salary raised 10%+ on existing listing (desperate)</span>
                  </div>
                </div>
              </div>

              {/* Contract Signals */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-foreground">Contract Award Signals</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">From Contracts Finder - government contract wins</p>
                <div className="space-y-2 text-xs">
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-700 shrink-0">Contract Won</Badge>
                    <span className="text-muted-foreground">Company won a government contract - likely needs staff to deliver</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="shrink-0">First Contract</Badge>
                    <span className="text-muted-foreground">First government win - major growth indicator</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="shrink-0">Large (£2M+)</Badge>
                    <span className="text-muted-foreground">Significant contract = significant hiring needs</span>
                  </div>
                </div>
              </div>

              {/* Companies House Signals */}
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-foreground">Companies House Signals</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">From Companies House API - leadership changes</p>
                <div className="space-y-2 text-xs">
                  <div className="flex gap-2">
                    <Badge className="bg-purple-100 text-purple-700 shrink-0">New Director</Badge>
                    <span className="text-muted-foreground">New leadership = new initiatives and hiring</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="shrink-0">Leadership Change</Badge>
                    <span className="text-muted-foreground">Reorganization often means team restructuring</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="shrink-0">Director Gap</Badge>
                    <span className="text-muted-foreground">Director resigned without replacement - opportunity</span>
                  </div>
                </div>
              </div>

              {/* Tender Signals */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-foreground">Tender Signals</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">From Find a Tender - upcoming opportunities</p>
                <div className="space-y-2 text-xs">
                  <div className="flex gap-2">
                    <Badge className="bg-blue-100 text-blue-700 shrink-0">Tender Won</Badge>
                    <span className="text-muted-foreground">Company won a tender - will need to staff the project</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="shrink-0">High Value</Badge>
                    <span className="text-muted-foreground">Larger tenders = larger teams needed</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics Explained */}
            <div className="mt-4 p-4 bg-background rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2 text-sm">Understanding the Numbers</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="font-medium text-foreground">Pain Score (0-100)</span>
                  <p className="text-muted-foreground">Combined score from all signals. Higher = more hiring pain. 70+ is critical.</p>
                </div>
                <div>
                  <span className="font-medium text-foreground">Days Open</span>
                  <p className="text-muted-foreground">How long the job has been posted on the job board (from original post date).</p>
                </div>
                <div>
                  <span className="font-medium text-foreground">Refreshed X days ago</span>
                  <p className="text-muted-foreground">When the employer last updated/refreshed the listing. 0 days = still actively recruiting.</p>
                </div>
              </div>
            </div>
          </CardContent>
      </Card>

      {/* Filters Component */}
      <CompanyFilters
        icpProfiles={icpProfiles}
        selectedIcpId={selectedIcpId}
        setSelectedIcpId={setSelectedIcpId}
        selectedIcp={selectedIcp}
        selectedIndustry={selectedIndustry}
        setSelectedIndustry={setSelectedIndustry}
        selectedRegion={selectedRegion}
        setSelectedRegion={setSelectedRegion}
        minPainScore={minPainScore}
        setMinPainScore={setMinPainScore}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        sortOption={sortOption}
        setSortOption={setSortOption}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExport={handleExport}
        onClassifyAll={handleClassifyAll}
        onResolveAllDomains={handleResolveAllDomains}
        onEnrichAll={handleEnrichAll}
        onRefresh={fetchCompaniesInPain}
        exporting={exporting}
        batchClassifying={batchClassifying}
        batchResolvingDomains={batchResolvingDomains}
        batchEnriching={batchEnriching}
        classificationProgress={classificationProgress}
        domainProgress={domainProgress}
        companiesCount={companies.length}
      />

      {/* Batch Enrichment Progress */}
      {batchEnriching && batchProgress && (
        <Card className="bg-primary/10 border-primary">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <RefreshCw className="h-5 w-5 text-primary animate-spin" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{batchProgress.message}</p>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {batchProgress.current} of {batchProgress.total} companies
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Company Cards */}
      {companies.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="py-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No companies found</h3>
            {dateFilter !== 'all' ? (
              <>
                <p className="text-muted-foreground mb-4">
                  No signals detected in the selected time period.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setDateFilter('all')}
                  className="mx-auto"
                >
                  View All Time
                </Button>
              </>
            ) : selectedIcpId !== 'all' ? (
              <>
                <p className="text-muted-foreground mb-2">
                  No signals found for this ICP profile yet.
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Signals are detected automatically throughout the day from job boards, government contracts, and Companies House.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedIcpId('all')}
                  >
                    View All Companies
                  </Button>
                  <Link href={`/icp/${selectedIcpId}`}>
                    <Button className="bg-primary">
                      Edit ICP Profile
                    </Button>
                  </Link>
                </div>
              </>
            ) : icpProfiles.length === 0 ? (
              <>
                <p className="text-muted-foreground mb-2">
                  Create an ICP profile to start detecting signals for your ideal clients.
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  An ICP (Ideal Customer Profile) defines the industries, locations, and signal types you want to track.
                </p>
                <Link href="/icp/new">
                  <Button className="bg-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First ICP
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-2">
                  No companies match your current filters.
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Try adjusting your industry, region, or pain score filters.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedIndustry('all');
                    setSelectedRegion('all');
                    setMinPainScore(0);
                  }}
                >
                  Reset Filters
                </Button>
              </>
            )}
            </motion.div>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          className="space-y-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onFindContacts={handleFindContacts}
              onClassify={handleClassifyCompany}
              onResolveDomain={handleResolveDomain}
              onAnalyzeJobs={handleAnalyzeJobs}
              enrichingCompanyId={enrichingCompanyId}
              classifyingCompanyId={classifyingCompanyId}
              resolvingDomainId={resolvingDomainId}
              analyzingJobsForCompanyId={analyzingJobsForCompanyId}
              successCompanyId={successCompanyId}
              expandedCompanyId={expandedCompanyId}
              onToggleExpand={setExpandedCompanyId}
              enrichmentError={enrichmentError}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
