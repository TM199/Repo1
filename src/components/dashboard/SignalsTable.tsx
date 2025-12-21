'use client';

import { useState, useMemo } from 'react';
import { Signal, SignalContact } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ExternalLink, Download, ChevronUp, ChevronDown, Users } from 'lucide-react';

type SignalWithContacts = Signal & { contacts?: SignalContact[] };

interface SignalsTableProps {
  signals: SignalWithContacts[];
  onExport?: (selectedIds: string[]) => void;
}

type SortField = 'company_name' | 'signal_type' | 'detected_at' | 'location';
type SortDirection = 'asc' | 'desc';

const signalTypeColors: Record<string, string> = {
  new_job: 'bg-indigo-100 text-indigo-800',
  planning_submitted: 'bg-amber-100 text-amber-800',
  planning_approved: 'bg-green-100 text-green-800',
  contract_awarded: 'bg-purple-100 text-purple-800',
  funding_announced: 'bg-emerald-100 text-emerald-800',
  leadership_change: 'bg-blue-100 text-blue-800',
  cqc_rating_change: 'bg-rose-100 text-rose-800',
  company_expansion: 'bg-cyan-100 text-cyan-800',
  project_announced: 'bg-orange-100 text-orange-800',
  company_hiring: 'bg-violet-100 text-violet-800',
  acquisition_merger: 'bg-pink-100 text-pink-800',
  regulatory_change: 'bg-yellow-100 text-yellow-800',
  layoffs_restructure: 'bg-red-100 text-red-800',
};

export function SignalsTable({ signals, onExport }: SignalsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('detected_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedSignals = useMemo(() => {
    return [...signals].sort((a, b) => {
      let aVal: string | null = null;
      let bVal: string | null = null;

      if (sortField === 'detected_at') {
        return sortDirection === 'asc'
          ? new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime()
          : new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
      }

      aVal = a[sortField] ?? '';
      bVal = b[sortField] ?? '';
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [signals, sortField, sortDirection]);

  const toggleAll = () => {
    if (selectedIds.size === signals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(signals.map(s => s.id)));
    }
  };

  const toggleOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc'
      ? <ChevronUp className="h-4 w-4 inline ml-1" />
      : <ChevronDown className="h-4 w-4 inline ml-1" />;
  };

  const handleExportSelected = async () => {
    if (onExport) {
      onExport(Array.from(selectedIds));
    } else {
      // Default export behavior
      const ids = Array.from(selectedIds).join(',');
      const response = await fetch(`/api/signals/export?ids=${ids}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signals-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#6B7C93]">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${signals.length} signals`}
        </span>
        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSelected}
            className="border-[#E3E8EE] text-[#0A2540] hover:bg-[#F6F9FC]"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Selected
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border border-[#E3E8EE] rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F6F9FC]">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.size === signals.length && signals.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-[#0A2540]"
                onClick={() => handleSort('company_name')}
              >
                Company <SortIcon field="company_name" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-[#0A2540]"
                onClick={() => handleSort('signal_type')}
              >
                Signal Type <SortIcon field="signal_type" />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead
                className="cursor-pointer hover:text-[#0A2540]"
                onClick={() => handleSort('location')}
              >
                Location <SortIcon field="location" />
              </TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead
                className="cursor-pointer hover:text-[#0A2540]"
                onClick={() => handleSort('detected_at')}
              >
                Detected <SortIcon field="detected_at" />
              </TableHead>
              <TableHead className="w-10">Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSignals.map((signal) => (
              <TableRow key={signal.id} className="hover:bg-[#F6F9FC]">
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(signal.id)}
                    onCheckedChange={() => toggleOne(signal.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-[#0A2540]">
                  <div>
                    {signal.company_name || 'Unknown'}
                    {signal.company_domain && (
                      <span className="block text-xs text-[#6B7C93]">
                        {signal.company_domain}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-xs ${signalTypeColors[signal.signal_type] || 'bg-gray-100 text-gray-800'}`}
                  >
                    {signal.signal_type.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <span className="block truncate" title={signal.signal_title || ''}>
                    {signal.signal_title}
                  </span>
                </TableCell>
                <TableCell className="text-[#6B7C93]">
                  {signal.location || '-'}
                </TableCell>
                <TableCell>
                  {signal.contacts && signal.contacts.length > 0 ? (
                    <div className="flex items-center gap-1 text-xs">
                      <Users className="h-3.5 w-3.5 text-[#635BFF]" />
                      <span className="text-[#0A2540]">{signal.contacts.length}</span>
                    </div>
                  ) : (
                    <span className="text-[#6B7C93]">-</span>
                  )}
                </TableCell>
                <TableCell className="text-[#6B7C93] text-sm">
                  {new Date(signal.detected_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {signal.signal_url && (
                    <a
                      href={signal.signal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#635BFF] hover:text-[#5046E4]"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {signals.length === 0 && (
        <div className="text-center py-8 text-[#6B7C93]">
          No signals found
        </div>
      )}
    </div>
  );
}
