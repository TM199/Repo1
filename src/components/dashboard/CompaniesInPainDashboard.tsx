'use client';

import { useEffect, useState } from 'react';
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
} from 'lucide-react';

interface CompanyWithPain {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  region: string | null;
  hiring_pain_score: number;
  pain_signals: PainSignal[];
  active_jobs_count: number;
}

interface PainSignal {
  id: string;
  pain_signal_type: string;
  signal_title: string;
  signal_detail: string;
  signal_value: number;
  urgency: string;
  detected_at: string;
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

const getPainIcon = (signalType: string) => {
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

export function CompaniesInPainDashboard() {
  const [companies, setCompanies] = useState<CompanyWithPain[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [minPainScore, setMinPainScore] = useState<number>(0);

  useEffect(() => {
    fetchCompaniesInPain();
  }, [selectedIndustry, selectedRegion, minPainScore]);

  async function fetchCompaniesInPain() {
    const supabase = createClient();
    setLoading(true);

    try {
      // Build query for companies with pain scores
      let query = supabase
        .from('companies')
        .select(
          `
          *,
          company_pain_signals!inner(
            id, pain_signal_type, signal_title, signal_detail,
            signal_value, urgency, detected_at
          )
        `
        )
        .gte('hiring_pain_score', minPainScore > 0 ? minPainScore : 1)
        .eq('company_pain_signals.is_active', true)
        .order('hiring_pain_score', { ascending: false })
        .limit(100);

      if (selectedIndustry !== 'all') {
        query = query.eq('industry', selectedIndustry);
      }
      if (selectedRegion !== 'all') {
        query = query.ilike('region', `%${selectedRegion}%`);
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

            return {
              ...company,
              pain_signals: company.company_pain_signals || [],
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
            <div className="text-2xl font-bold text-orange-600">
              {
                companies.filter((c) =>
                  c.pain_signals.some((s) => s.urgency === 'immediate')
                ).length
              }
            </div>
            <p className="text-xs text-[#6B7C93]">Immediate Urgency</p>
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

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
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

        <Button
          variant="outline"
          size="sm"
          onClick={fetchCompaniesInPain}
          className="ml-auto"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

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
                  {company.pain_signals.slice(0, 3).map((signal) => (
                    <div
                      key={signal.id}
                      className="flex items-start gap-2 p-2 bg-[#F6F9FC] rounded"
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
                        </div>
                        <p className="text-xs text-[#6B7C93] mt-1 line-clamp-2">
                          {signal.signal_detail}
                        </p>
                      </div>
                    </div>
                  ))}
                  {company.pain_signals.length > 3 && (
                    <p className="text-xs text-[#6B7C93] pl-6">
                      +{company.pain_signals.length - 3} more signals
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <Button variant="default" size="sm" className="bg-[#635BFF]">
                    Find Contacts
                  </Button>
                  <Button variant="outline" size="sm">
                    View All Signals
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
