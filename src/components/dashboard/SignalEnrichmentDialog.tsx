'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserPlus, Loader2, Check, X, RefreshCw, ChevronDown, Search } from 'lucide-react';

const AVAILABLE_ROLES = [
  'CEO',
  'Founder',
  'Head of Talent',
  'Hiring Manager',
  'HR Director',
  'VP Sales',
  'CTO',
  'Managing Director',
  'Operations Director',
  'Head of People',
];

export interface EnrichmentStep {
  role: string;
  status: 'pending' | 'searching' | 'found' | 'not_found' | 'getting_email' | 'getting_phone' | 'complete';
  name?: string;
  email?: string;
  emailStatus?: string;
}

export interface AgencyClassification {
  isRecruitmentAgency: boolean | null;
  confidence: number | null;
  reasoning: string | null;
  domain: string | null;
  domainSource: string | null;
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

interface SignalEnrichmentDialogProps {
  signalId: string;
  showRolePicker: boolean;
  setShowRolePicker: (show: boolean) => void;
  selectedRoles: string[];
  setSelectedRoles: (roles: string[]) => void;
  enriching: boolean;
  enrichmentSteps: EnrichmentStep[];
  enrichmentPhase: string;
  onEnrich: (roles: string[]) => void;
  onClassify: () => void;
  classifying: boolean;
  agencyStatus: AgencyClassification | null;
  companyName: string;
  hasContacts?: boolean;
}

export function SignalEnrichmentDialog({
  signalId,
  showRolePicker,
  setShowRolePicker,
  selectedRoles,
  setSelectedRoles,
  enriching,
  enrichmentSteps,
  enrichmentPhase,
  onEnrich,
  onClassify,
  classifying,
  agencyStatus,
  companyName,
  hasContacts = false,
}: SignalEnrichmentDialogProps) {
  return (
    <>
      {/* Role Picker Dropdown */}
      {!enriching && (
        <DropdownMenu open={showRolePicker} onOpenChange={setShowRolePicker}>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant={hasContacts ? "ghost" : "outline"}
              disabled={enriching}
              className={`h-8 px-2 text-xs ${hasContacts ? 'text-muted-foreground' : ''}`}
              title={hasContacts ? "Re-enrich contacts" : "Enrich contacts"}
            >
              {hasContacts ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 p-3" align="end">
            <div className="space-y-3">
              {/* Classify Company Button */}
              {agencyStatus?.isRecruitmentAgency === null && companyName && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={onClassify}
                  disabled={classifying}
                >
                  {classifying ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5 mr-1" />
                  )}
                  {classifying ? 'Analyzing...' : 'Check if Agency'}
                </Button>
              )}

              <p className="text-xs font-medium text-foreground">Select roles to find:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {AVAILABLE_ROLES.map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${signalId}-${role}`}
                      checked={selectedRoles.includes(role)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRoles([...selectedRoles, role]);
                        } else {
                          setSelectedRoles(selectedRoles.filter((r) => r !== role));
                        }
                      }}
                    />
                    <label
                      htmlFor={`role-${signalId}-${role}`}
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      {role}
                    </label>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                className="w-full text-xs bg-primary hover:bg-primary/90"
                onClick={() => onEnrich(selectedRoles)}
                disabled={selectedRoles.length === 0}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Find {selectedRoles.length} role{selectedRoles.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Loading Button while Enriching */}
      {enriching && (
        <Button
          size="sm"
          variant="ghost"
          disabled
          className="h-8 px-2 text-xs text-muted-foreground"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </Button>
      )}
    </>
  );
}

interface EnrichmentProgressPanelProps {
  enrichmentSteps: EnrichmentStep[];
  enrichmentPhase: string;
}

export function EnrichmentProgressPanel({
  enrichmentSteps,
  enrichmentPhase,
}: EnrichmentProgressPanelProps) {
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-medium text-muted-foreground">ENRICHING CONTACTS</p>
        {enrichmentSteps.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 text-primary animate-spin" />
            <span className="text-[10px] text-primary font-medium">
              {enrichmentSteps.filter(s => s.status === 'complete').length}/{enrichmentSteps.length}
            </span>
          </div>
        )}
      </div>

      {/* Current phase message */}
      {enrichmentPhase && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-primary/5 rounded-md">
          <Loader2 className="w-3 h-3 text-primary animate-spin flex-shrink-0" />
          <p className="text-[11px] text-primary font-medium truncate">
            {enrichmentPhase}
          </p>
        </div>
      )}

      {/* Steps list - only show if we have steps */}
      {enrichmentSteps.length === 0 && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground">Initializing...</span>
        </div>
      )}
      <div className="space-y-2">
        {enrichmentSteps.map((step) => {
          const statusInfo = statusMessages[step.status] || { label: step.status };
          const isActive = ['searching', 'getting_email', 'getting_phone'].includes(step.status);

          return (
            <div key={step.role} className={`p-2 rounded-lg ${isActive ? 'bg-background border border-primary/20' : 'bg-transparent'}`}>
              <div className="flex items-center gap-2 text-xs">
                {step.status === 'pending' && (
                  <span className="w-4 h-4 rounded-full border border-border flex items-center justify-center text-muted-foreground">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                  </span>
                )}
                {isActive && (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
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
                  <span className={step.status === 'not_found' ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}>
                    {step.name || step.role}
                  </span>
                </div>
                {statusInfo.api && isActive && (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {statusInfo.api}
                  </span>
                )}
              </div>
              {isActive && (
                <p className="text-[10px] text-muted-foreground mt-1 ml-6">
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
  );
}

export { AVAILABLE_ROLES };
