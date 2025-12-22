'use client';

import { useState, useEffect, useCallback } from 'react';
import { Signal, SignalContact, SignalType } from '@/types';
import { SignalCard } from '@/components/dashboard/SignalCard';
import { SignalsTable } from '@/components/dashboard/SignalsTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  LayoutGrid,
  TableIcon,
  Download,
  UserPlus,
  Loader2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

type SignalWithContacts = Signal & { contacts?: SignalContact[] };

const SIGNAL_TYPES: { value: SignalType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'contract_awarded', label: 'Contract Awarded' },
  { value: 'leadership_change', label: 'Leadership Change' },
  { value: 'planning_submitted', label: 'Planning Submitted' },
  { value: 'planning_approved', label: 'Planning Approved' },
  { value: 'funding_announced', label: 'Funding Announced' },
  { value: 'new_job', label: 'New Job' },
  { value: 'company_hiring', label: 'Company Hiring' },
  { value: 'company_expansion', label: 'Company Expansion' },
  { value: 'acquisition_merger', label: 'Acquisition/Merger' },
  { value: 'project_announced', label: 'Project Announced' },
  { value: 'regulatory_change', label: 'Regulatory Change' },
  { value: 'layoffs_restructure', label: 'Layoffs/Restructure' },
  { value: 'cqc_rating_change', label: 'CQC Rating Change' },
];

const CONTACTS_FILTER: { value: string; label: string }[] = [
  { value: '', label: 'All Signals' },
  { value: 'true', label: 'Has Contacts' },
  { value: 'false', label: 'Needs Enrichment' },
];

const INDUSTRY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Industries' },
  { value: 'Software Development', label: 'Software Development' },
  { value: 'IT Consulting', label: 'IT Consulting' },
  { value: 'Financial Services', label: 'Financial Services' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Construction', label: 'Building Construction' },
  { value: 'Real Estate', label: 'Real Estate' },
  { value: 'Management Consultancy', label: 'Management Consultancy' },
  { value: 'Legal & Accounting', label: 'Legal & Accounting' },
  { value: 'Education', label: 'Education' },
  { value: 'Retail Trade', label: 'Retail Trade' },
  { value: 'Wholesale Trade', label: 'Wholesale Trade' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Telecommunications', label: 'Telecommunications' },
  { value: 'Advertising & Marketing', label: 'Advertising & Marketing' },
];

const PAGE_SIZE = 50;

interface SignalsPageClientProps {
  initialSignals?: SignalWithContacts[];
}

export function SignalsPageClient({ initialSignals }: SignalsPageClientProps) {
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [signals, setSignals] = useState<SignalWithContacts[]>(initialSignals || []);
  const [loading, setLoading] = useState(!initialSignals);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 });

  // Filter state
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [signalType, setSignalType] = useState<SignalType | ''>('');
  const [industry, setIndustry] = useState('');
  const [hasContacts, setHasContacts] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (signalType) params.set('signal_type', signalType);
      if (industry) params.set('industry', industry);
      if (hasContacts) params.set('has_contacts', hasContacts);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      params.set('limit', PAGE_SIZE.toString());
      params.set('offset', offset.toString());

      const response = await fetch(`/api/signals?${params.toString()}`);
      const result = await response.json();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setSignals(result.data || []);
      setTotal(result.total || 0);
      setHasMore(result.hasMore || false);
    } catch (error) {
      toast.error('Failed to fetch signals');
    } finally {
      setLoading(false);
    }
  }, [search, signalType, industry, hasContacts, dateFrom, dateTo, offset]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  const handleSearch = () => {
    setSearch(searchInput);
    setOffset(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setSignalType('');
    setIndustry('');
    setHasContacts('');
    setDateFrom('');
    setDateTo('');
    setOffset(0);
  };

  const hasActiveFilters = search || signalType || industry || hasContacts || dateFrom || dateTo;

  const handleEnrichAll = async () => {
    const signalsToEnrich = signals.filter(s => !s.contacts || s.contacts.length === 0);
    if (signalsToEnrich.length === 0) {
      toast.info('All visible signals already have contacts');
      return;
    }

    setEnrichingAll(true);
    setEnrichProgress({ current: 0, total: signalsToEnrich.length });
    let successCount = 0;

    for (let i = 0; i < signalsToEnrich.length; i++) {
      setEnrichProgress({ current: i + 1, total: signalsToEnrich.length });
      try {
        const response = await fetch(`/api/signals/${signalsToEnrich[i].id}/enrich`, {
          method: 'POST',
        });
        if (response.ok) successCount++;
      } catch {
        // Continue to next signal
      }
    }

    setEnrichingAll(false);
    toast.success(`Enriched ${successCount} of ${signalsToEnrich.length} signals`);
    fetchSignals();
  };

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

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0A2540]">All Signals</h1>
          <p className="text-sm text-[#6B7C93] mt-1">
            {total} signal{total !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEnrichAll}
            disabled={enrichingAll}
            className="border-[#E3E8EE] text-[#425466] hover:bg-[#F6F9FC]"
          >
            {enrichingAll ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {enrichProgress.current}/{enrichProgress.total}
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Enrich All
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            className="border-[#E3E8EE] text-[#425466] hover:bg-[#F6F9FC]"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
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

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-[#E3E8EE] p-4 space-y-4">
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7C93]" />
            <Input
              placeholder="Search by company name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 border-[#E3E8EE]"
            />
          </div>
          <Button onClick={handleSearch} className="bg-[#635BFF] hover:bg-[#5851DB]">
            Search
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`border-[#E3E8EE] ${showFilters ? 'bg-[#F6F9FC]' : ''}`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 bg-[#635BFF] text-white text-xs rounded-full px-2 py-0.5">
                {[search, signalType, industry, hasContacts, dateFrom, dateTo].filter(Boolean).length}
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-[#6B7C93] hover:text-[#0A2540]"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4 border-t border-[#E3E8EE]">
            {/* Signal Type */}
            <div>
              <label className="block text-sm font-medium text-[#425466] mb-1">
                Signal Type
              </label>
              <select
                value={signalType}
                onChange={(e) => {
                  setSignalType(e.target.value as SignalType | '');
                  setOffset(0);
                }}
                className="w-full rounded-md border border-[#E3E8EE] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
              >
                {SIGNAL_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Industry */}
            <div>
              <label className="block text-sm font-medium text-[#425466] mb-1">
                Industry
              </label>
              <select
                value={industry}
                onChange={(e) => {
                  setIndustry(e.target.value);
                  setOffset(0);
                }}
                className="w-full rounded-md border border-[#E3E8EE] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
              >
                {INDUSTRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Contact Status */}
            <div>
              <label className="block text-sm font-medium text-[#425466] mb-1">
                Contact Status
              </label>
              <select
                value={hasContacts}
                onChange={(e) => {
                  setHasContacts(e.target.value);
                  setOffset(0);
                }}
                className="w-full rounded-md border border-[#E3E8EE] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
              >
                {CONTACTS_FILTER.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-[#425466] mb-1">
                From Date
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setOffset(0);
                }}
                className="border-[#E3E8EE]"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-[#425466] mb-1">
                To Date
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setOffset(0);
                }}
                className="border-[#E3E8EE]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#635BFF]" />
        </div>
      ) : signals.length > 0 ? (
        <>
          {/* Signals Display */}
          {view === 'cards' ? (
            <div className="space-y-4">
              {signals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          ) : (
            <SignalsTable signals={signals} />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#E3E8EE] pt-4">
              <p className="text-sm text-[#6B7C93]">
                Showing {offset + 1} - {Math.min(offset + PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="border-[#E3E8EE]"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-[#425466]">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={!hasMore}
                  className="border-[#E3E8EE]"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-[#E3E8EE]">
          <p className="text-[#6B7C93]">
            {hasActiveFilters
              ? 'No signals match your filters. Try adjusting your search criteria.'
              : 'No signals yet. Run a search or scrape a source to detect signals.'}
          </p>
          {hasActiveFilters && (
            <Button
              variant="link"
              onClick={clearFilters}
              className="mt-2 text-[#635BFF]"
            >
              Clear all filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
