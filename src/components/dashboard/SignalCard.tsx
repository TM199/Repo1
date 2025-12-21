'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Signal, SignalContact } from '@/types';
import { ExternalLink, Clock, UserPlus, Mail, Phone, Linkedin, Loader2, Check, X, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SignalCardProps {
  signal: Signal & { contacts?: SignalContact[] };
}

interface EnrichmentStep {
  role: string;
  status: 'pending' | 'searching' | 'found' | 'not_found' | 'getting_email' | 'getting_phone' | 'complete';
  name?: string;
  email?: string;
  emailStatus?: string;
}

// Human-readable status messages
const statusMessages: Record<string, { label: string; api?: string }> = {
  pending: { label: 'Queued' },
  searching: { label: 'Finding contact...', api: 'LeadMagic' },
  found: { label: 'Contact found' },
  not_found: { label: 'Not found' },
  getting_email: { label: 'Finding email...', api: 'Prospeo' },
  getting_phone: { label: 'Finding phone...', api: 'Prospeo' },
  complete: { label: 'Complete' },
};

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

const signalTypeStyles: Record<string, { bg: string; text: string }> = {
  new_job: { bg: '#EEF2FF', text: '#4338CA' },
  planning_submitted: { bg: '#FEF3C7', text: '#B45309' },
  planning_approved: { bg: '#D1FAE5', text: '#047857' },
  contract_awarded: { bg: '#F3E8FF', text: '#7C3AED' },
  funding_announced: { bg: '#FCE7F3', text: '#BE185D' },
  leadership_change: { bg: '#FFEDD5', text: '#C2410C' },
  cqc_rating_change: { bg: '#FEE2E2', text: '#B91C1C' },
  company_expansion: { bg: '#CCFBF1', text: '#0F766E' },
};

const emailStatusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  verified: { bg: '#D1FAE5', text: '#047857', icon: <Check className="h-2.5 w-2.5" /> },
  valid: { bg: '#D1FAE5', text: '#047857', icon: <Check className="h-2.5 w-2.5" /> },
  risky: { bg: '#FEE2E2', text: '#B91C1C', icon: <AlertCircle className="h-2.5 w-2.5" /> },
  invalid: { bg: '#FEE2E2', text: '#B91C1C', icon: <X className="h-2.5 w-2.5" /> },
  unknown: { bg: '#F0F3F7', text: '#6B7C93', icon: null },
};

export function SignalCard({ signal }: SignalCardProps) {
  const style = signalTypeStyles[signal.signal_type] || { bg: '#F0F3F7', text: '#425466' };
  const [enriching, setEnriching] = useState(false);
  const [contacts, setContacts] = useState<SignalContact[]>(signal.contacts || []);
  const [enrichmentSteps, setEnrichmentSteps] = useState<EnrichmentStep[]>([]);
  const [enrichmentPhase, setEnrichmentPhase] = useState<string>('');

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichmentSteps([]);
    setEnrichmentPhase('Connecting...');

    try {
      const response = await fetch(`/api/signals/${signal.id}/enrich/stream`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Enrichment failed');
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
              case 'roles':
                setEnrichmentPhase(`Searching for ${event.roles.length} decision makers`);
                setEnrichmentSteps(event.roles.map((role: string) => ({
                  role,
                  status: 'pending',
                })));
                break;
              case 'searching_role':
                setEnrichmentPhase(`Finding ${event.role} (${event.index + 1}/${event.total})`);
                setEnrichmentSteps(prev => prev.map(step =>
                  step.role === event.role ? { ...step, status: 'searching' } : step
                ));
                break;
              case 'found_contact':
                setEnrichmentPhase(`Found ${event.name}, getting email...`);
                setEnrichmentSteps(prev => prev.map(step =>
                  step.role === event.role ? { ...step, status: 'getting_email', name: event.name } : step
                ));
                break;
              case 'role_not_found':
                setEnrichmentSteps(prev => prev.map(step =>
                  step.role === event.role ? { ...step, status: 'not_found' } : step
                ));
                break;
              case 'finding_email':
                setEnrichmentPhase(`Looking up email for ${event.name}...`);
                break;
              case 'email_found':
                setEnrichmentSteps(prev => {
                  const idx = prev.findIndex(s => s.status === 'getting_email');
                  if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], email: event.email, emailStatus: event.status };
                    return updated;
                  }
                  return prev;
                });
                break;
              case 'finding_phone':
                setEnrichmentPhase(`Looking up phone for ${event.name}...`);
                setEnrichmentSteps(prev => prev.map(step =>
                  step.name === event.name ? { ...step, status: 'getting_phone' } : step
                ));
                break;
              case 'phone_found':
                // Phone found, will be in contact_complete
                break;
              case 'contact_complete':
                setEnrichmentSteps(prev => prev.map(step =>
                  step.role === event.contact.job_title ? { ...step, status: 'complete' } : step
                ));
                setContacts(prev => [...prev, event.contact]);
                break;
              case 'complete':
                setEnrichmentPhase('');
                if (event.contacts.length > 0) {
                  toast.success(`Found ${event.contacts.length} contact${event.contacts.length > 1 ? 's' : ''}`);
                } else {
                  toast.info('No contacts found for this company');
                }
                break;
              case 'error':
                throw new Error(event.message);
            }
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enrichment failed');
    } finally {
      setEnriching(false);
      setEnrichmentSteps([]);
    }
  };

  const hasContacts = contacts.length > 0;

  return (
    <Card className={`bg-white border-[#E3E8EE] shadow-sm hover:shadow-md transition-all duration-200 group ${signal.is_new ? 'ring-2 ring-[#635BFF]/20 ring-offset-2' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                className="text-[10px] font-medium px-2 py-0.5 border-0"
                style={{ backgroundColor: style.bg, color: style.text }}
              >
                {signalTypeLabels[signal.signal_type] || signal.signal_type}
              </Badge>
              <Badge
                className="text-[10px] font-medium px-2 py-0.5 border-0"
                style={{
                  backgroundColor: signal.source_type === 'search' ? '#CFFAFE' : '#F0F3F7',
                  color: signal.source_type === 'search' ? '#0E7490' : '#425466'
                }}
              >
                {signal.source_type === 'search' ? 'AI Search' : 'URL Monitor'}
              </Badge>
              {signal.is_new && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-[#635BFF]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#635BFF] animate-pulse" />
                  New
                </span>
              )}
            </div>
            <h3 className="font-semibold text-[#0A2540] text-sm mb-0.5 truncate">
              {signal.company_name || 'Unknown Company'}
            </h3>
            <p className="text-sm text-[#425466] truncate mb-1">
              {signal.signal_title}
            </p>
            {signal.signal_detail && (
              <p className="text-xs text-[#6B7C93] line-clamp-2 mb-2">
                {signal.signal_detail}
              </p>
            )}
            <div className="flex items-center gap-3 text-[11px] text-[#6B7C93]">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(signal.detected_at).toLocaleDateString()}
              </span>
              {signal.source?.name && (
                <>
                  <span className="text-[#E3E8EE]">•</span>
                  <span className="truncate">{signal.source.name}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {signal.signal_url && (
              <a
                href={signal.signal_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-[#F6F9FC] flex items-center justify-center text-[#6B7C93] hover:bg-[#635BFF] hover:text-white transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {!hasContacts && !enriching && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleEnrich}
                disabled={enriching}
                className="h-8 px-2 text-xs"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            )}
            {hasContacts && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleEnrich}
                disabled={enriching}
                className="h-8 px-2 text-xs text-[#6B7C93]"
                title="Re-enrich contacts"
              >
                {enriching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Enrichment Progress Panel */}
        {enriching && (
          <div className="mt-3 pt-3 border-t border-[#E3E8EE]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-medium text-[#6B7C93]">ENRICHING CONTACTS</p>
              {enrichmentSteps.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 text-[#635BFF] animate-spin" />
                  <span className="text-[10px] text-[#635BFF] font-medium">
                    {enrichmentSteps.filter(s => s.status === 'complete').length}/{enrichmentSteps.length}
                  </span>
                </div>
              )}
            </div>

            {/* Current phase message */}
            {enrichmentPhase && (
              <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-[#635BFF]/5 rounded-md">
                <Loader2 className="w-3 h-3 text-[#635BFF] animate-spin flex-shrink-0" />
                <p className="text-[11px] text-[#635BFF] font-medium truncate">
                  {enrichmentPhase}
                </p>
              </div>
            )}

            {/* Steps list - only show if we have steps */}
            {enrichmentSteps.length === 0 && (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="w-4 h-4 text-[#635BFF] animate-spin" />
                <span className="text-xs text-[#6B7C93]">Initializing...</span>
              </div>
            )}
            <div className="space-y-2">
              {enrichmentSteps.map((step) => {
                const statusInfo = statusMessages[step.status] || { label: step.status };
                const isActive = ['searching', 'getting_email', 'getting_phone'].includes(step.status);

                return (
                  <div key={step.role} className={`p-2 rounded-lg ${isActive ? 'bg-[#F6F9FC] border border-[#635BFF]/20' : 'bg-transparent'}`}>
                    <div className="flex items-center gap-2 text-xs">
                      {step.status === 'pending' && (
                        <span className="w-4 h-4 rounded-full border border-[#E3E8EE] flex items-center justify-center text-[#6B7C93]">
                          <span className="w-1 h-1 rounded-full bg-[#6B7C93]" />
                        </span>
                      )}
                      {isActive && (
                        <Loader2 className="w-4 h-4 text-[#635BFF] animate-spin" />
                      )}
                      {step.status === 'complete' && (
                        <span className="w-4 h-4 rounded-full bg-[#D1FAE5] flex items-center justify-center text-[#047857]">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                      {step.status === 'not_found' && (
                        <span className="w-4 h-4 rounded-full bg-[#FEE2E2] flex items-center justify-center text-[#B91C1C]">
                          <X className="h-2.5 w-2.5" />
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className={step.status === 'not_found' ? 'text-[#6B7C93] line-through' : 'text-[#0A2540] font-medium'}>
                          {step.name || step.role}
                        </span>
                      </div>
                      {statusInfo.api && isActive && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#635BFF]/10 text-[#635BFF]">
                          {statusInfo.api}
                        </span>
                      )}
                    </div>
                    {isActive && (
                      <p className="text-[10px] text-[#6B7C93] mt-1 ml-6">
                        {statusInfo.label}
                      </p>
                    )}
                    {step.status === 'not_found' && (
                      <p className="text-[10px] text-[#B91C1C] mt-1 ml-6">
                        No {step.role} found at this company
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contacts Display */}
        {hasContacts && !enriching && (
          <div className="mt-3 pt-3 border-t border-[#E3E8EE]">
            <p className="text-[10px] font-medium text-[#6B7C93] mb-2">CONTACTS</p>
            <div className="space-y-2">
              {contacts.map((contact) => {
                const emailStatus = emailStatusColors[contact.email_status || 'unknown'] || emailStatusColors.unknown;
                return (
                  <div key={contact.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#0A2540] truncate">{contact.full_name}</p>
                      <p className="text-[#6B7C93] truncate">{contact.job_title}</p>
                    </div>
                    <div className="flex items-center gap-1">
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
                          {emailStatus.icon}
                        </button>
                      ) : (
                        <span className="h-6 px-1.5 rounded flex items-center gap-1 bg-[#FEE2E2] text-[#B91C1C] text-[9px]">
                          <Mail className="h-3 w-3" />
                          <X className="h-2.5 w-2.5" />
                        </span>
                      )}
                      {contact.phone ? (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(contact.phone!);
                            toast.success('Phone copied to clipboard');
                          }}
                          className="w-6 h-6 rounded bg-[#D1FAE5] flex items-center justify-center text-[#047857] hover:opacity-80 transition-opacity cursor-pointer"
                          title={`Click to copy: ${contact.phone}`}
                        >
                          <Phone className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="w-6 h-6 rounded bg-[#FEE2E2] flex items-center justify-center text-[#B91C1C]" title="Phone not found">
                          <Phone className="h-3 w-3" />
                        </span>
                      )}
                      {contact.linkedin_url && (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-6 h-6 rounded bg-[#F6F9FC] flex items-center justify-center text-[#6B7C93] hover:bg-[#0A66C2] hover:text-white transition-colors"
                          title="LinkedIn Profile"
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
      </CardContent>
    </Card>
  );
}
