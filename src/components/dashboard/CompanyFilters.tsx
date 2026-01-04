'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Plus,
  RefreshCw,
  Download,
  Sparkles,
  Briefcase,
  Flame,
  Award,
  FileText,
  Bot,
  Globe,
} from 'lucide-react';
import { ICPProfile } from '@/types';

// All supported industries
export const INDUSTRIES = [
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
export const UK_REGIONS = [
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

// Signal source tabs
export type SignalTab = 'all' | 'job_board' | 'contracts_finder' | 'companies_house' | 'tenders';

// Date filter options
export type DateFilter = 'all' | 'today' | '7days' | '30days';

// Sort options
export type SortOption = 'pain_score' | 'newest' | 'oldest';

export const SIGNAL_TABS: { id: SignalTab; label: string; icon: React.ReactNode; sources: string[] }[] = [
  { id: 'all', label: 'All Signals', icon: <Briefcase className="h-4 w-4" />, sources: [] },
  { id: 'job_board', label: 'Job Board', icon: <Flame className="h-4 w-4" />, sources: ['job_board'] },
  { id: 'contracts_finder', label: 'Contracts', icon: <Award className="h-4 w-4" />, sources: ['contracts_finder'] },
  { id: 'companies_house', label: 'Companies House', icon: <FileText className="h-4 w-4" />, sources: ['companies_house'] },
  { id: 'tenders', label: 'Tenders', icon: <FileText className="h-4 w-4" />, sources: ['tenders'] },
];

interface CompanyFiltersProps {
  icpProfiles: ICPProfile[];
  selectedIcpId: string;
  setSelectedIcpId: (id: string) => void;
  selectedIcp: ICPProfile | undefined;
  selectedIndustry: string;
  setSelectedIndustry: (industry: string) => void;
  selectedRegion: string;
  setSelectedRegion: (region: string) => void;
  minPainScore: number;
  setMinPainScore: (score: number) => void;
  dateFilter: DateFilter;
  setDateFilter: (filter: DateFilter) => void;
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  activeTab: SignalTab;
  setActiveTab: (tab: SignalTab) => void;
  onExport: () => void;
  onClassifyAll: () => void;
  onResolveAllDomains: () => void;
  onEnrichAll: () => void;
  onRefresh: () => void;
  exporting: boolean;
  batchClassifying: boolean;
  batchResolvingDomains: boolean;
  batchEnriching: boolean;
  classificationProgress: { current: number; total: number } | null;
  domainProgress: { current: number; total: number } | null;
  companiesCount: number;
}

export function CompanyFilters({
  icpProfiles,
  selectedIcpId,
  setSelectedIcpId,
  selectedIcp,
  selectedIndustry,
  setSelectedIndustry,
  selectedRegion,
  setSelectedRegion,
  minPainScore,
  setMinPainScore,
  dateFilter,
  setDateFilter,
  sortOption,
  setSortOption,
  activeTab,
  setActiveTab,
  onExport,
  onClassifyAll,
  onResolveAllDomains,
  onEnrichAll,
  onRefresh,
  exporting,
  batchClassifying,
  batchResolvingDomains,
  batchEnriching,
  classificationProgress,
  domainProgress,
  companiesCount,
}: CompanyFiltersProps) {
  return (
    <>
      {/* ICP Profile Selector */}
      {icpProfiles.length > 0 ? (
        <Card className="bg-background border-border">
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Filter by ICP:</span>
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
                className="border border-border rounded-md px-3 py-2 text-sm bg-card text-foreground min-w-[200px]"
              >
                <option value="all">All Companies (No ICP Filter)</option>
                {icpProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              {selectedIcp && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="bg-card">
                    {selectedIcp.industries.length} industries
                  </Badge>
                  <Badge variant="outline" className="bg-card">
                    {selectedIcp.locations.length} locations
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-amber-100 border-amber-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-700" />
                <span className="text-sm text-amber-700">
                  No ICP profiles found. Create one to filter signals by your ideal clients.
                </span>
              </div>
              <Link href="/icp/new">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">
                  <Plus className="h-4 w-4 mr-1" />
                  Create ICP
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signal Type Tabs */}
      <div className="flex gap-1 p-1 bg-background rounded-lg border border-border">
        {SIGNAL_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-card rounded-md shadow-sm"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Manual Filters (shown when no ICP selected) */}
      <div className="flex gap-4 flex-wrap">
        {!selectedIcp && (
          <>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="border border-border rounded-md px-3 py-2 text-sm bg-card text-foreground"
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
              className="border border-border rounded-md px-3 py-2 text-sm bg-card text-foreground"
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
          className="border border-border rounded-md px-3 py-2 text-sm bg-card text-foreground"
        >
          <option value={0}>Any Pain Score</option>
          <option value={20}>20+ (Moderate)</option>
          <option value={40}>40+ (High)</option>
          <option value={70}>70+ (Critical)</option>
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="border border-border rounded-md px-3 py-2 text-sm bg-card text-foreground"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
        </select>

        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
          className="border border-border rounded-md px-3 py-2 text-sm bg-card text-foreground"
        >
          <option value="pain_score">Sort by Pain Score</option>
          <option value="newest">Sort by Newest</option>
          <option value="oldest">Sort by Oldest</option>
        </select>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={exporting || companiesCount === 0}
          >
            {exporting ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClassifyAll}
            disabled={batchClassifying || companiesCount === 0}
          >
            {batchClassifying ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {classificationProgress ? `${classificationProgress.current}/${classificationProgress.total}` : 'Classifying...'}
              </>
            ) : (
              <>
                <Bot className="h-4 w-4 mr-2" />
                Check All for Agencies
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onResolveAllDomains}
            disabled={batchResolvingDomains || companiesCount === 0}
            title="Find websites for companies without domains"
          >
            {batchResolvingDomains ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {domainProgress ? `${domainProgress.current}/${domainProgress.total}` : 'Finding...'}
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 mr-2" />
                Find Websites
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={onEnrichAll}
            disabled={batchEnriching || companiesCount === 0}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {batchEnriching ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Find All Contacts
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
    </>
  );
}
