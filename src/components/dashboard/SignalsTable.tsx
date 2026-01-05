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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ExternalLink, Download, ChevronUp, ChevronDown, Users, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

type SignalWithContacts = Signal & {
  contacts?: SignalContact[];
  validation_status?: string | null;
  relevance_score?: number | null;
  signal_explanation?: string | null;
  relevance_reasoning?: string | null;
  recommended_action?: string | null;
  talking_points?: string[] | null;
};

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

const validationStatusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  validated: {
    color: 'bg-green-100 text-green-800',
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: 'Validated',
  },
  skipped: {
    color: 'bg-gray-100 text-gray-800',
    icon: <AlertCircle className="h-4 w-4" />,
    label: 'Skipped',
  },
  failed: {
    color: 'bg-red-100 text-red-800',
    icon: <AlertCircle className="h-4 w-4" />,
    label: 'Failed',
  },
  pending: {
    color: 'bg-amber-100 text-amber-800',
    icon: <Zap className="h-4 w-4" />,
    label: 'Pending',
  },
};

export function SignalsTable({ signals, onExport }: SignalsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('detected_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedSignal, setSelectedSignal] = useState<SignalWithContacts | null>(null);

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
        <span className="text-sm text-muted-foreground">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${signals.length} signals`}
        </span>
        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSelected}
            className="border-border text-foreground hover:bg-background"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Selected
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-background">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.size === signals.length && signals.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort('company_name')}
              >
                Company <SortIcon field="company_name" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort('signal_type')}
              >
                Signal Type <SortIcon field="signal_type" />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort('location')}
              >
                Location <SortIcon field="location" />
              </TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort('detected_at')}
              >
                Detected <SortIcon field="detected_at" />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10">Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSignals.map((signal) => (
              <TableRow key={signal.id} className="hover:bg-background">
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(signal.id)}
                    onCheckedChange={() => toggleOne(signal.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  <div>
                    {signal.company_name || 'Unknown'}
                    {signal.company_domain && (
                      <span className="block text-xs text-muted-foreground">
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
                <TableCell className="text-muted-foreground">
                  {signal.location || '-'}
                </TableCell>
                <TableCell>
                  {signal.contacts && signal.contacts.length > 0 ? (
                    <div className="flex items-center gap-1 text-xs">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      <span className="text-foreground">{signal.contacts.length}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(signal.detected_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {signal.validation_status ? (
                    <button
                      onClick={() => setSelectedSignal(signal)}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <Badge
                        variant="outline"
                        className={`text-xs flex items-center gap-1 ${
                          validationStatusConfig[signal.validation_status]?.color || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {validationStatusConfig[signal.validation_status]?.icon}
                        {validationStatusConfig[signal.validation_status]?.label || signal.validation_status}
                      </Badge>
                      {signal.relevance_score !== undefined && signal.relevance_score !== null && (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(signal.relevance_score * 100)}%
                        </span>
                      )}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not validated</span>
                  )}
                </TableCell>
                <TableCell>
                  {signal.signal_url && (
                    <a
                      href={signal.signal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
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
        <div className="text-center py-8 text-muted-foreground">
          No signals found
        </div>
      )}

      {/* Signal Details Dialog */}
      <Dialog open={!!selectedSignal} onOpenChange={(open) => !open && setSelectedSignal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedSignal?.company_name}</DialogTitle>
            <DialogDescription>
              {selectedSignal?.signal_title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedSignal?.signal_explanation && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Signal Explanation</h4>
                <p className="text-sm text-foreground">{selectedSignal.signal_explanation}</p>
              </div>
            )}

            {selectedSignal?.relevance_reasoning && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Why It's Relevant</h4>
                <p className="text-sm text-foreground">{selectedSignal.relevance_reasoning}</p>
              </div>
            )}

            {selectedSignal?.recommended_action && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Recommended Action</h4>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    selectedSignal.recommended_action === 'reach_out'
                      ? 'bg-green-100 text-green-800'
                      : selectedSignal.recommended_action === 'monitor'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {selectedSignal.recommended_action.replace(/_/g, ' ')}
                </Badge>
              </div>
            )}

            {selectedSignal?.talking_points && selectedSignal.talking_points.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Talking Points</h4>
                <ul className="space-y-1">
                  {selectedSignal.talking_points.map((point, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-primary font-semibold">{i + 1}.</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedSignal?.relevance_score !== undefined && selectedSignal.relevance_score !== null && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Relevance Score</h4>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.round(selectedSignal.relevance_score * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">
                    {Math.round(selectedSignal.relevance_score * 100)}%
                  </span>
                </div>
              </div>
            )}

            {selectedSignal?.validation_status && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Validation Status</h4>
                <Badge
                  variant="outline"
                  className={`text-xs flex w-fit items-center gap-1 ${
                    validationStatusConfig[selectedSignal.validation_status]?.color ||
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {validationStatusConfig[selectedSignal.validation_status]?.icon}
                  {validationStatusConfig[selectedSignal.validation_status]?.label || selectedSignal.validation_status}
                </Badge>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
