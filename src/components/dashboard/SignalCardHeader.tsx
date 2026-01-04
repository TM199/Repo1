'use client';

import { Badge } from '@/components/ui/badge';
import { Signal } from '@/types';
import { Clock, ShieldCheck, Check, Globe, Building2 } from 'lucide-react';

interface AgencyClassification {
  isRecruitmentAgency: boolean | null;
  confidence: number | null;
  reasoning: string | null;
  domain: string | null;
  domainSource: string | null;
}

interface ConfidenceScore {
  total: number;
  label: string;
  sourceScore: number;
  domainScore: number;
  completenessScore: number;
}

interface SignalCardHeaderProps {
  signal: Signal;
  agencyStatus: AgencyClassification | null;
  confidenceScore: ConfidenceScore;
  displayDomain: string | null;
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

// Format relative time (e.g., "2 hours ago", "3 days ago")
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Get confidence label color class
function getConfidenceLabelColorClass(label: string): string {
  switch (label) {
    case 'High':
      return 'bg-green-100 text-green-700';
    case 'Medium':
      return 'bg-yellow-100 text-yellow-700';
    case 'Low':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function SignalCardHeader({
  signal,
  agencyStatus,
  confidenceScore,
  displayDomain,
}: SignalCardHeaderProps) {
  const style = signalTypeStyles[signal.signal_type] || { bg: 'var(--muted)', text: 'var(--muted-foreground)' };
  const confidenceColorClass = getConfidenceLabelColorClass(confidenceScore.label);

  return (
    <div className="flex-1 min-w-0">
      {/* Badges row */}
      <div className="flex items-center gap-2 mb-2">
        {/* Signal type badge */}
        <Badge
          className="text-[10px] font-medium px-2 py-0.5 border-0"
          style={{ backgroundColor: style.bg, color: style.text }}
        >
          {signalTypeLabels[signal.signal_type] || signal.signal_type}
        </Badge>

        {/* Source type badge */}
        <Badge
          className="text-[10px] font-medium px-2 py-0.5 border-0"
          style={{
            backgroundColor: signal.source_type === 'search' ? '#CFFAFE' : undefined,
            color: signal.source_type === 'search' ? '#0E7490' : undefined,
          }}
          variant={signal.source_type === 'search' ? undefined : 'secondary'}
        >
          {signal.source_type === 'search' ? 'AI Search' : 'URL Monitor'}
        </Badge>

        {/* Confidence score badge */}
        <span
          className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${confidenceColorClass}`}
          title={`Confidence: ${confidenceScore.total}/100 (Source: ${confidenceScore.sourceScore}/40, Domain: ${confidenceScore.domainScore}/30, Data: ${confidenceScore.completenessScore}/30)`}
        >
          <ShieldCheck className="h-3 w-3" />
          {confidenceScore.label}
        </span>

        {/* New indicator */}
        {signal.is_new && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            New
          </span>
        )}

        {/* Agency classification badges */}
        {agencyStatus?.isRecruitmentAgency === true && (
          <span
            className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
            title={`Recruitment Agency (${agencyStatus.confidence}% confidence): ${agencyStatus.reasoning}`}
          >
            <Building2 className="h-3 w-3" />
            Recruitment Agency
          </span>
        )}
        {agencyStatus?.isRecruitmentAgency === false && (
          <span
            className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700"
            title={`Direct Employer (${agencyStatus.confidence}% confidence)`}
          >
            <Check className="h-3 w-3" />
            Direct Employer
          </span>
        )}
      </div>

      {/* Company name and domain */}
      <div className="flex items-center gap-2 mb-0.5">
        <h3 className="font-semibold text-foreground text-sm truncate">
          {signal.company_name || 'Unknown Company'}
        </h3>
        {displayDomain && (
          <a
            href={`https://${displayDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors shrink-0"
            title={`Visit ${displayDomain}`}
          >
            <Globe className="h-3 w-3" />
            <span className="hidden sm:inline">{displayDomain}</span>
          </a>
        )}
      </div>

      {/* Signal title */}
      <p className="text-sm text-muted-foreground truncate mb-1">
        {signal.signal_title}
      </p>

      {/* Signal detail */}
      {signal.signal_detail && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {signal.signal_detail}
        </p>
      )}

      {/* Timestamp and source */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1" title={new Date(signal.detected_at).toLocaleString()}>
          <Clock className="h-3 w-3" />
          {formatTimeAgo(signal.detected_at)}
        </span>
        {signal.source?.name && (
          <>
            <span className="text-border">•</span>
            <span className="truncate">{signal.source.name}</span>
          </>
        )}
      </div>
    </div>
  );
}
