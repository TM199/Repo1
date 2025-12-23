'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ExtractedSignal, SignalType, SignalContact } from '@/types';
import { ExternalLink, Download, Building2, Loader2, UserPlus, Save, Check, Mail, Phone, Linkedin, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { getSignalTypeConfig } from '@/lib/signal-mapping';
import { SIGNAL_HIRING_URGENCY } from '@/lib/agency-signal-mapping';

export interface AgencySignal extends ExtractedSignal {
  signal_type: SignalType;
  industry: string;
  hash: string;
  exists_in_db: boolean;
  saved_id?: string;
  contacts?: SignalContact[];
}

interface AgencyResultsPanelProps {
  signals: AgencySignal[];
  onSignalsUpdated: (signals: AgencySignal[]) => void;
}

const signalTypeStyles: Record<string, { bg: string; text: string }> = {
  contract_awarded: { bg: '#F3E8FF', text: '#7C3AED' },
  planning_approved: { bg: '#D1FAE5', text: '#047857' },
  planning_submitted: { bg: '#FEF3C7', text: '#B45309' },
  funding_announced: { bg: '#FCE7F3', text: '#BE185D' },
  company_expansion: { bg: '#CCFBF1', text: '#0F766E' },
  leadership_change: { bg: '#FFEDD5', text: '#C2410C' },
  cqc_rating_change: { bg: '#FEE2E2', text: '#B91C1C' },
  project_announced: { bg: '#DBEAFE', text: '#1D4ED8' },
  company_hiring: { bg: '#EEF2FF', text: '#4338CA' },
  acquisition_merger: { bg: '#E0E7FF', text: '#4F46E5' },
  new_job: { bg: '#EEF2FF', text: '#4338CA' },
};

const emailStatusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  verified: { bg: '#D1FAE5', text: '#047857', icon: <Check className="h-2.5 w-2.5" /> },
  valid: { bg: '#D1FAE5', text: '#047857', icon: <Check className="h-2.5 w-2.5" /> },
  risky: { bg: '#FEE2E2', text: '#B91C1C', icon: <AlertCircle className="h-2.5 w-2.5" /> },
  invalid: { bg: '#FEE2E2', text: '#B91C1C', icon: <X className="h-2.5 w-2.5" /> },
  unknown: { bg: '#F0F3F7', text: '#6B7C93', icon: null },
};

export function AgencyResultsPanel({ signals, onSignalsUpdated }: AgencyResultsPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
  const [enrichingSignals, setEnrichingSignals] = useState<Set<string>>(new Set());

  const newSignals = signals.filter(s => !s.exists_in_db && !s.saved_id);
  const savedSignals = signals.filter(s => s.saved_id);
  const existingSignals = signals.filter(s => s.exists_in_db && !s.saved_id);

  const handleToggleSelect = (hash: string) => {
    setSelectedHashes(prev => {
      const next = new Set(prev);
      if (next.has(hash)) {
        next.delete(hash);
      } else {
        next.add(hash);
      }
      return next;
    });
  };

  const handleSelectAllNew = () => {
    setSelectedHashes(new Set(newSignals.map(s => s.hash)));
  };

  const handleSaveSelected = async () => {
    const toSave = signals.filter(s => selectedHashes.has(s.hash) && !s.exists_in_db && !s.saved_id);
    if (toSave.length === 0) {
      toast.error('No new signals selected');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/agency/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signals: toSave }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Save failed');
      }

      // Update signals with saved IDs
      const hashToId = new Map<string, string>(data.savedSignals.map((s: { hash: string; id: string }) => [s.hash, s.id]));
      const updatedSignals: AgencySignal[] = signals.map(s => {
        if (hashToId.has(s.hash)) {
          return { ...s, saved_id: hashToId.get(s.hash) as string };
        }
        return s;
      });

      onSignalsUpdated(updatedSignals);
      setSelectedHashes(new Set());
      toast.success(`Saved ${data.saved} signals${data.skipped > 0 ? ` (${data.skipped} already existed)` : ''}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleEnrich = async (signal: AgencySignal) => {
    if (!signal.saved_id) {
      toast.error('Signal must be saved before enriching');
      return;
    }

    setEnrichingSignals(prev => new Set(prev).add(signal.hash));

    try {
      const response = await fetch(`/api/signals/${signal.saved_id}/enrich/stream`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Enrichment failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      const contacts: SignalContact[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'contact_saved') {
              contacts.push(event.contact);
            } else if (event.type === 'complete') {
              // Update signal with contacts
              const updatedSignals = signals.map(s => {
                if (s.hash === signal.hash) {
                  return { ...s, contacts };
                }
                return s;
              });
              onSignalsUpdated(updatedSignals);

              if (contacts.length > 0) {
                toast.success(`Found ${contacts.length} contact${contacts.length > 1 ? 's' : ''}`);
              } else {
                toast.info('No contacts found for this signal');
              }
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enrichment failed');
    } finally {
      setEnrichingSignals(prev => {
        const next = new Set(prev);
        next.delete(signal.hash);
        return next;
      });
    }
  };

  const handleExportCSV = () => {
    if (signals.length === 0) {
      toast.error('No signals to export');
      return;
    }

    setExporting(true);

    try {
      const headers = ['Company Name', 'Domain', 'Signal Type', 'Industry', 'Title', 'Details', 'URL', 'Contact Name', 'Contact Email', 'Contact Phone'];
      const rows = signals.flatMap(s => {
        if (s.contacts && s.contacts.length > 0) {
          return s.contacts.map(c => [
            s.company_name,
            s.company_domain || '',
            s.signal_type,
            s.industry,
            s.signal_title,
            s.signal_detail?.replace(/"/g, '""') || '',
            s.signal_url || '',
            c.full_name || '',
            c.email || '',
            c.phone || '',
          ]);
        }
        return [[
          s.company_name,
          s.company_domain || '',
          s.signal_type,
          s.industry,
          s.signal_title,
          s.signal_detail?.replace(/"/g, '""') || '',
          s.signal_url || '',
          '', '', '',
        ]];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `agency-signals-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${signals.length} signals to CSV`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (signals.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-[#6B7C93]">No signals found. Try broadening your criteria.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex gap-2">
          {newSignals.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllNew}
                disabled={saving}
              >
                Select All New ({newSignals.length})
              </Button>
              <Button
                size="sm"
                onClick={handleSaveSelected}
                disabled={saving || selectedHashes.size === 0}
                className="bg-[#635BFF] hover:bg-[#5851ea]"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Selected ({selectedHashes.size})
              </Button>
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-[#6B7C93]">
        <span>{newSignals.length} new</span>
        <span>{savedSignals.length} saved</span>
        <span>{existingSignals.length} already in database</span>
      </div>

      {/* Signal cards */}
      <div className="grid gap-3">
        {signals.map((signal) => {
          const style = signalTypeStyles[signal.signal_type] || { bg: '#F0F3F7', text: '#425466' };
          const config = getSignalTypeConfig(signal.signal_type);
          const urgency = SIGNAL_HIRING_URGENCY[signal.signal_type];
          const isNew = !signal.exists_in_db && !signal.saved_id;
          const isSaved = !!signal.saved_id;
          const isExisting = signal.exists_in_db && !signal.saved_id;
          const isEnriching = enrichingSignals.has(signal.hash);
          const hasContacts = signal.contacts && signal.contacts.length > 0;

          return (
            <Card
              key={signal.hash}
              className={`transition-all ${isExisting ? 'opacity-50 bg-gray-50' : 'hover:shadow-md'}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Checkbox for new signals */}
                  {isNew && (
                    <Checkbox
                      checked={selectedHashes.has(signal.hash)}
                      onCheckedChange={() => handleToggleSelect(signal.hash)}
                      className="mt-1"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge
                        style={{ backgroundColor: style.bg, color: style.text }}
                        className="text-xs font-medium"
                      >
                        {config?.label || signal.signal_type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {signal.industry}
                      </Badge>
                      {urgency === 'immediate' && (
                        <Badge className="bg-red-100 text-red-700 text-xs">
                          High Urgency
                        </Badge>
                      )}
                      {isExisting && (
                        <Badge className="bg-gray-200 text-gray-600 text-xs">
                          Already Saved
                        </Badge>
                      )}
                      {isSaved && (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Saved
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-semibold text-[#0A2540] mb-1 truncate">
                      {signal.company_name}
                    </h3>

                    <p className="text-sm font-medium text-[#0A2540] mb-1">
                      {signal.signal_title}
                    </p>

                    {signal.signal_detail && (
                      <p className="text-sm text-[#6B7C93] line-clamp-2">
                        {signal.signal_detail}
                      </p>
                    )}

                    {signal.company_domain && (
                      <p className="text-xs text-[#6B7C93] mt-2">
                        {signal.company_domain}
                      </p>
                    )}

                    {/* Contacts display */}
                    {hasContacts && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-[#0A2540] mb-2">
                          Contacts ({signal.contacts!.length})
                        </p>
                        <div className="space-y-2">
                          {signal.contacts!.map((contact, idx) => {
                            const emailColor = emailStatusColors[contact.email_status || 'unknown'];
                            return (
                              <div key={idx} className="flex items-center gap-3 text-sm flex-wrap">
                                <span className="font-medium text-[#0A2540]">{contact.full_name}</span>
                                {contact.job_title && (
                                  <span className="text-[#6B7C93]">({contact.job_title})</span>
                                )}
                                {contact.email && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3 text-[#6B7C93]" />
                                    <span
                                      className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                                      style={{ backgroundColor: emailColor.bg, color: emailColor.text }}
                                    >
                                      {emailColor.icon}
                                      {contact.email}
                                    </span>
                                  </div>
                                )}
                                {contact.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-[#6B7C93]" />
                                    <span className="text-xs">{contact.phone}</span>
                                  </div>
                                )}
                                {contact.linkedin_url && (
                                  <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer">
                                    <Linkedin className="h-3 w-3 text-blue-600" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isSaved && !hasContacts && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEnrich(signal)}
                        disabled={isEnriching}
                      >
                        {isEnriching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-1" />
                            Enrich
                          </>
                        )}
                      </Button>
                    )}
                    {signal.signal_url && (
                      <a
                        href={signal.signal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#635BFF] hover:text-[#5851ea]"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
