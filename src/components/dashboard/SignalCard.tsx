'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Signal, SignalContact } from '@/types';
import { ExternalLink, Clock, UserPlus, Mail, Phone, Linkedin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SignalCardProps {
  signal: Signal & { contacts?: SignalContact[] };
}

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

export function SignalCard({ signal }: SignalCardProps) {
  const style = signalTypeStyles[signal.signal_type] || { bg: '#F0F3F7', text: '#425466' };
  const [enriching, setEnriching] = useState(false);
  const [contacts, setContacts] = useState<SignalContact[]>(signal.contacts || []);

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const response = await fetch(`/api/signals/${signal.id}/enrich`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Enrichment failed');
      }

      setContacts(data.contacts);
      toast.success(`Found ${data.contacts.length} contacts`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enrichment failed');
    } finally {
      setEnriching(false);
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
            {!hasContacts && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleEnrich}
                disabled={enriching}
                className="h-8 px-2 text-xs"
              >
                {enriching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Contacts Display */}
        {hasContacts && (
          <div className="mt-3 pt-3 border-t border-[#E3E8EE]">
            <p className="text-[10px] font-medium text-[#6B7C93] mb-2">CONTACTS</p>
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#0A2540] truncate">{contact.full_name}</p>
                    <p className="text-[#6B7C93] truncate">{contact.job_title}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="w-6 h-6 rounded bg-[#F6F9FC] flex items-center justify-center text-[#6B7C93] hover:bg-[#635BFF] hover:text-white transition-colors"
                        title={contact.email}
                      >
                        <Mail className="h-3 w-3" />
                      </a>
                    )}
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="w-6 h-6 rounded bg-[#F6F9FC] flex items-center justify-center text-[#6B7C93] hover:bg-[#635BFF] hover:text-white transition-colors"
                        title={contact.phone}
                      >
                        <Phone className="h-3 w-3" />
                      </a>
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
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
