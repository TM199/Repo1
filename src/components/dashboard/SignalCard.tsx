'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Signal, SignalContact } from '@/types';
import { ExternalLink, Loader2, AlertCircle, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { calculateConfidenceScore } from '@/lib/signal-scoring';
import { SignalCardHeader } from './SignalCardHeader';
import { SignalEnrichmentDialog, EnrichmentProgressPanel, EnrichmentStep, AgencyClassification } from './SignalEnrichmentDialog';
import { ContactsList } from './ContactsList';

interface SignalCardProps {
  signal: Signal & { contacts?: SignalContact[] };
}

// Check if a string is an IP address (not a valid domain for display)
function isIPAddress(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(str);
}

// Get displayable domain (null if IP or empty)
function getDisplayDomain(domain: string | null | undefined): string | null {
  if (!domain || isIPAddress(domain)) return null;
  return domain;
}

export function SignalCard({ signal }: SignalCardProps) {
  const [enriching, setEnriching] = useState(false);
  const displayDomain = getDisplayDomain(signal.company_domain);
  const [contacts, setContacts] = useState<SignalContact[]>(signal.contacts || []);
  const [enrichmentSteps, setEnrichmentSteps] = useState<EnrichmentStep[]>([]);
  const [enrichmentPhase, setEnrichmentPhase] = useState<string>('');
  const [pushingToHubSpot, setPushingToHubSpot] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['CEO', 'Founder', 'Head of Talent', 'Hiring Manager']);
  const [agencyStatus, setAgencyStatus] = useState<AgencyClassification | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [showAgencyWarning, setShowAgencyWarning] = useState(false);
  const [pendingEnrichRoles, setPendingEnrichRoles] = useState<string[] | null>(null);

  // Fetch user's default roles on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.default_enrichment_roles?.length > 0) {
          setSelectedRoles(data.default_enrichment_roles);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch agency classification status for this company
  useEffect(() => {
    if (!signal.company_name) return;
    fetch(`/api/companies/classify?company_name=${encodeURIComponent(signal.company_name)}`)
      .then(res => res.json())
      .then(data => {
        if (data.found && data.classification) {
          setAgencyStatus(data.classification);
        }
      })
      .catch(() => {});
  }, [signal.company_name]);

  // Calculate confidence score
  const confidenceScore = calculateConfidenceScore(signal);

  // Handle agency classification
  const handleClassify = async () => {
    if (!signal.company_name) return;
    setClassifying(true);
    try {
      const response = await fetch('/api/companies/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: signal.company_name,
          company_domain: signal.company_domain,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setAgencyStatus({
          isRecruitmentAgency: data.result.isRecruitmentAgency,
          confidence: data.result.confidence,
          reasoning: data.result.reasoning,
          domain: data.result.domain,
          domainSource: 'ai_tavily',
        });
        toast.success(
          data.result.isRecruitmentAgency
            ? 'Classified as recruitment agency'
            : 'Classified as NOT a recruitment agency'
        );
      } else {
        throw new Error(data.error || 'Classification failed');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Classification failed');
    } finally {
      setClassifying(false);
    }
  };

  // Check agency status before enriching
  const handleEnrichWithAgencyCheck = (roles?: string[]) => {
    const rolesToUse = roles || selectedRoles;
    // If company is classified as agency, show warning
    if (agencyStatus?.isRecruitmentAgency === true) {
      setPendingEnrichRoles(rolesToUse);
      setShowAgencyWarning(true);
      setShowRolePicker(false);
    } else {
      handleEnrich(rolesToUse);
    }
  };

  const handleEnrich = async (roles?: string[]) => {
    const rolesToUse = roles || selectedRoles;
    setShowRolePicker(false);
    setEnriching(true);
    setEnrichmentSteps([]);
    setEnrichmentPhase('Connecting...');

    try {
      const rolesParam = encodeURIComponent(rolesToUse.join(','));
      const response = await fetch(`/api/signals/${signal.id}/enrich/stream?roles=${rolesParam}`);

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

  const handlePushToHubSpot = async () => {
    setPushingToHubSpot(true);
    try {
      const response = await fetch('/api/integrations/hubspot/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId: signal.id }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('Pushed to HubSpot successfully');
      } else {
        throw new Error(data.error || 'Failed to push to HubSpot');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to push to HubSpot');
    } finally {
      setPushingToHubSpot(false);
    }
  };

  return (
    <Card className={`bg-card border-border shadow-sm hover:shadow-md transition-all duration-200 group ${signal.is_new ? 'ring-2 ring-primary/20 ring-offset-2' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Header Section */}
          <SignalCardHeader
            signal={signal}
            agencyStatus={agencyStatus}
            confidenceScore={confidenceScore}
            displayDomain={displayDomain}
          />

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            {signal.signal_url && (
              <a
                href={signal.signal_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <SignalEnrichmentDialog
              signalId={signal.id}
              showRolePicker={showRolePicker}
              setShowRolePicker={setShowRolePicker}
              selectedRoles={selectedRoles}
              setSelectedRoles={setSelectedRoles}
              enriching={enriching}
              enrichmentSteps={enrichmentSteps}
              enrichmentPhase={enrichmentPhase}
              onEnrich={handleEnrichWithAgencyCheck}
              onClassify={handleClassify}
              classifying={classifying}
              agencyStatus={agencyStatus}
              companyName={signal.company_name || ''}
              hasContacts={hasContacts}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePushToHubSpot}
              disabled={pushingToHubSpot}
              className="h-8 px-2 text-xs text-[#FF7A59] hover:text-[#FF7A59] hover:bg-[#FF7A59]/10"
              title="Push to HubSpot"
            >
              {pushingToHubSpot ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Enrichment Progress Panel */}
        {enriching && (
          <EnrichmentProgressPanel
            enrichmentSteps={enrichmentSteps}
            enrichmentPhase={enrichmentPhase}
          />
        )}

        {/* Contacts Display */}
        {hasContacts && !enriching && (
          <ContactsList contacts={contacts} />
        )}

        {/* Agency Warning Dialog */}
        <Dialog open={showAgencyWarning} onOpenChange={setShowAgencyWarning}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Recruitment Agency Detected
              </DialogTitle>
              <DialogDescription asChild>
                <div>
                  <strong>{signal.company_name}</strong> is classified as a recruitment agency
                  ({agencyStatus?.confidence}% confidence).
                  <br /><br />
                  Enrichment may return contacts who are recruiters rather than decision-makers
                  at your target companies.
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAgencyWarning(false);
                  setPendingEnrichRoles(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowAgencyWarning(false);
                  if (pendingEnrichRoles) {
                    handleEnrich(pendingEnrichRoles);
                  }
                  setPendingEnrichRoles(null);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                Enrich Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
