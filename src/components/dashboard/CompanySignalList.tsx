'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  Flame,
  TrendingUp,
  Clock,
  AlertTriangle,
  Briefcase,
  ExternalLink,
  Award,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getSignalExplanation, getQuickExplanation } from '@/lib/signal-explanations';

export interface PainSignal {
  id: string;
  pain_signal_type: string;
  signal_title: string;
  signal_detail: string;
  signal_value: number;
  days_since_refresh?: number;
  urgency: string;
  detected_at: string;
  source_job_posting_id: string | null;
  source: string;
  job_url: string | null;
}

interface CompanySignalListProps {
  painSignals: PainSignal[];
  expandedCompanyId: string | null;
  companyId: string;
  onToggleExpand: (companyId: string | null) => void;
}

const isHardToFillSignal = (signalType: string) => signalType.startsWith('hard_to_fill');

const isHighValueSignal = (signalType: string) =>
  signalType === 'contract_awarded_first' ||
  signalType === 'contract_awarded_large' ||
  signalType === 'contract_awarded_multiple';

const getPainIcon = (signalType: string) => {
  if (signalType.startsWith('hard_to_fill')) return <Flame className="h-4 w-4" />;
  if (signalType.includes('stale')) return <Clock className="h-4 w-4" />;
  if (signalType.includes('repost')) return <TrendingUp className="h-4 w-4" />;
  if (signalType.includes('salary')) return <Flame className="h-4 w-4" />;
  if (signalType === 'contract_awarded_first') return <Award className="h-4 w-4" />;
  if (signalType.includes('contract')) return <AlertTriangle className="h-4 w-4" />;
  if (signalType.includes('referral')) return <Briefcase className="h-4 w-4" />;
  return <Briefcase className="h-4 w-4" />;
};

const getUrgencyVariant = (urgency: string): 'destructive' | 'secondary' | 'outline' => {
  switch (urgency) {
    case 'immediate':
      return 'destructive';
    case 'short_term':
      return 'secondary';
    default:
      return 'outline';
  }
};

const SignalItem = ({ signal }: { signal: PainSignal }) => {
  const explanation = getSignalExplanation(signal.pain_signal_type);
  const isHighValue = isHighValueSignal(signal.pain_signal_type);

  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-lg border transition-colors ${
        isHighValue
          ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 hover:border-amber-300'
          : 'bg-background border-transparent hover:border-primary/20'
      }`}
    >
      <div className={`mt-0.5 ${isHighValue ? 'text-amber-600' : 'text-primary'}`}>
        {getPainIcon(signal.pain_signal_type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-foreground truncate">
            {signal.signal_title}
          </span>
          {isHighValue && (
            <Badge className="bg-amber-500 text-white border-amber-600">
              STRONG SIGNAL
            </Badge>
          )}
          <Badge variant={getUrgencyVariant(signal.urgency)}>
            {signal.urgency.replace('_', ' ')}
          </Badge>
          {isHardToFillSignal(signal.pain_signal_type) ? (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              ACTIVE
            </Badge>
          ) : signal.pain_signal_type.includes('stale') ? (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              POSSIBLY STALE
            </Badge>
          ) : null}
          <span className="text-[10px] text-muted-foreground">
            Detected: {new Date(signal.detected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {signal.job_url && (
            <a
              href={signal.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View Job
            </a>
          )}
        </div>
        {signal.signal_detail && (
          <p className="text-xs text-muted-foreground mt-1">
            {signal.signal_detail}
          </p>
        )}
        {explanation && (
          <div className="mt-2 p-2 bg-card rounded border border-border">
            <p className="text-xs font-medium text-primary mb-1">
              Why this matters:
            </p>
            <p className="text-xs text-muted-foreground">
              {getQuickExplanation(signal.pain_signal_type)}
            </p>
            <p className="text-xs text-foreground mt-1 font-medium">
              {explanation.actionAdvice}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export function CompanySignalList({
  painSignals,
  expandedCompanyId,
  companyId,
  onToggleExpand,
}: CompanySignalListProps) {
  const isExpanded = expandedCompanyId === companyId;
  const hasMoreSignals = painSignals.length > 3;

  return (
    <div className="space-y-2 mb-4">
      {/* Always show first 3 signals */}
      {painSignals.slice(0, 3).map((signal) => (
        <SignalItem key={signal.id} signal={signal} />
      ))}

      {/* Animated expanded signals */}
      <AnimatePresence>
        {isExpanded && hasMoreSignals && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 overflow-hidden"
          >
            {painSignals.slice(3).map((signal) => (
              <SignalItem key={signal.id} signal={signal} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      {hasMoreSignals && (
        <button
          onClick={() => onToggleExpand(isExpanded ? null : companyId)}
          className="text-xs text-primary hover:underline pl-6 cursor-pointer flex items-center gap-1"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {painSignals.length - 3} more signals
            </>
          )}
        </button>
      )}
    </div>
  );
}
