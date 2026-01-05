'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Flame,
  TrendingUp,
  Clock,
  AlertTriangle,
  Building2,
  Briefcase,
  RefreshCw,
  ExternalLink,
  Users,
  Mail,
  Phone,
  Linkedin,
  Check,
  X,
  Search,
  DollarSign,
  MapPin,
  Zap,
  Award,
  ChevronDown,
  ChevronUp,
  Bot,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSignalExplanation, getQuickExplanation } from '@/lib/signal-explanations';
import { staggerItem } from '@/lib/animations';

// Interfaces
export interface CompanyContact {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  seniority: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
}

export interface JobAnalysis {
  workMode: string;
  salaryRange: string | null;
  techStack: string[];
  benefits: string[];
  hiringUrgency: string;
  confidence: number;
}

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
  // Validation fields
  validation_status?: string | null;
  relevance_score?: number | null;
  signal_explanation?: string | null;
  relevance_reasoning?: string | null;
  recommended_action?: string | null;
  talking_points?: string[] | null;
}

export interface CompanyWithPain {
  id: string;
  name: string;
  domain: string | null;
  domain_source: string | null;
  is_recruitment_agency: boolean | null;
  agency_confidence: number | null;
  industry: string | null;
  region: string | null;
  hiring_pain_score: number;
  pain_signals: PainSignal[];
  contacts: CompanyContact[];
  active_jobs_count: number;
  job_analysis?: JobAnalysis;
}

// Props interface
interface CompanyCardProps {
  company: CompanyWithPain;
  onFindContacts: (companyId: string, companyName: string) => void;
  onClassify: (companyId: string, companyName: string) => void;
  onResolveDomain: (companyId: string, companyName: string) => void;
  onAnalyzeJobs: (companyId: string, companyName: string) => void;
  enrichingCompanyId: string | null;
  classifyingCompanyId: string | null;
  resolvingDomainId: string | null;
  analyzingJobsForCompanyId: string | null;
  successCompanyId: string | null;
  expandedCompanyId: string | null;
  onToggleExpand: (companyId: string | null) => void;
  enrichmentError: string | null;
}

// Helper functions
const getPainScoreColor = (score: number) => {
  if (score >= 70) return 'text-red-600 bg-red-100';
  if (score >= 40) return 'text-orange-600 bg-orange-100';
  return 'text-yellow-600 bg-yellow-100';
};

const emailStatusColors: Record<string, { bg: string; text: string; valid: boolean }> = {
  verified: { bg: '#D1FAE5', text: '#047857', valid: true },
  valid: { bg: '#D1FAE5', text: '#047857', valid: true },
  risky: { bg: '#FEF3C7', text: '#92400E', valid: true },
  invalid: { bg: '#FEE2E2', text: '#B91C1C', valid: false },
  unknown: { bg: '#F0F3F7', text: '#6B7C93', valid: true },
};

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

// Signal item component for rendering individual signals
function SignalItem({ signal }: { signal: PainSignal }) {
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
        {signal.signal_explanation && (
          <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
            <p className="text-xs font-medium text-blue-900 mb-1">
              AI Analysis:
            </p>
            <p className="text-xs text-blue-800">
              {signal.signal_explanation}
            </p>
          </div>
        )}
        {signal.validation_status && (
          <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200 flex items-center gap-2 flex-wrap">
            <Badge
              className={`text-xs ${
                signal.validation_status === 'validated'
                  ? 'bg-green-100 text-green-800'
                  : signal.validation_status === 'skipped'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-red-100 text-red-800'
              }`}
            >
              {signal.validation_status === 'validated' ? '✓ Validated' : signal.validation_status === 'skipped' ? '◦ Skipped' : '✗ Failed'}
            </Badge>
            {signal.relevance_score !== undefined && signal.relevance_score !== null && (
              <span className="text-xs text-gray-600">
                {Math.round(signal.relevance_score * 100)}% relevant
              </span>
            )}
            {signal.recommended_action && (
              <Badge variant="outline" className="text-xs">
                {signal.recommended_action.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CompanyCard({
  company,
  onFindContacts,
  onClassify,
  onResolveDomain,
  onAnalyzeJobs,
  enrichingCompanyId,
  classifyingCompanyId,
  resolvingDomainId,
  analyzingJobsForCompanyId,
  successCompanyId,
  expandedCompanyId,
  onToggleExpand,
  enrichmentError,
}: CompanyCardProps) {
  const isExpanded = expandedCompanyId === company.id;

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
    >
      <Card
        className={`border-border transition-all duration-300 ${
          successCompanyId === company.id ? 'ring-2 ring-green-500 ring-opacity-50' : ''
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg text-foreground">
                    {company.name}
                  </CardTitle>
                  {/* Agency Status Badge */}
                  {company.is_recruitment_agency === true && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Recruitment Agency
                    </Badge>
                  )}
                  {company.is_recruitment_agency === false && (
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Direct Employer
                    </Badge>
                  )}
                  {company.is_recruitment_agency === null && (
                    <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                      Unclassified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {company.industry || 'Unknown Industry'}
                    {company.region && ` - ${company.region}`}
                    {company.active_jobs_count > 0 &&
                      ` - ${company.active_jobs_count} open roles`}
                  </span>
                  {/* Domain Badge */}
                  {company.domain && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(company.domain) && (
                    <a
                      href={`https://${company.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {company.domain}
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div
              className={`px-4 py-2 rounded-full font-bold text-sm ${getPainScoreColor(company.hiring_pain_score)}`}
            >
              Pain Score: {company.hiring_pain_score}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Pain Signals */}
          <div className="space-y-2 mb-4">
            {/* Always show first 3 signals */}
            {company.pain_signals.slice(0, 3).map((signal) => (
              <SignalItem key={signal.id} signal={signal} />
            ))}

            {/* Animated expanded signals */}
            <AnimatePresence>
              {isExpanded && company.pain_signals.length > 3 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2 overflow-hidden"
                >
                  {company.pain_signals.slice(3).map((signal) => (
                    <SignalItem key={signal.id} signal={signal} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {company.pain_signals.length > 3 && (
              <button
                onClick={() => onToggleExpand(isExpanded ? null : company.id)}
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
                    {company.pain_signals.length - 3} more signals
                  </>
                )}
              </button>
            )}
          </div>

          {/* Contacts Section */}
          {company.contacts && company.contacts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[10px] font-medium text-muted-foreground mb-2">CONTACTS</p>
              <div className="space-y-2">
                {company.contacts.map((contact) => {
                  const emailStatus = emailStatusColors[contact.email_status || 'unknown'] || emailStatusColors.unknown;
                  return (
                    <div key={contact.id} className="flex items-center justify-between gap-2 text-xs bg-background p-2 rounded">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-foreground truncate">{contact.full_name}</p>
                          {contact.seniority && contact.seniority !== 'unknown' && (
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                              contact.seniority === 'executive' ? 'bg-purple-100 text-purple-700' :
                              contact.seniority === 'senior' ? 'bg-blue-100 text-blue-700' :
                              contact.seniority === 'manager' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {contact.seniority}
                            </span>
                          )}
                        </div>
                        {contact.job_title && (
                          <p className="text-muted-foreground truncate">{contact.job_title}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Email Button */}
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
                            {emailStatus.valid ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                          </button>
                        ) : (
                          <span className="h-6 px-1.5 rounded flex items-center gap-1 bg-[#FEE2E2] text-[#B91C1C]">
                            <Mail className="h-3 w-3" />
                            <X className="h-2.5 w-2.5" />
                          </span>
                        )}
                        {/* Phone Button */}
                        {contact.phone ? (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(contact.phone!);
                              toast.success('Phone copied to clipboard');
                            }}
                            className="h-6 px-1.5 rounded flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                            style={{ backgroundColor: '#D1FAE5', color: '#047857' }}
                            title={`Click to copy: ${contact.phone}`}
                          >
                            <Phone className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="h-6 px-1.5 rounded flex items-center gap-1 bg-muted text-muted-foreground">
                            <Phone className="h-3 w-3" />
                          </span>
                        )}
                        {/* LinkedIn Button */}
                        {contact.linkedin_url && (
                          <a
                            href={contact.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-6 px-1.5 rounded flex items-center gap-1 hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}
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

          {/* Job Analysis Section */}
          {company.job_analysis && company.job_analysis.confidence > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[10px] font-medium text-muted-foreground mb-2">JOB INSIGHTS</p>
              <div className="flex flex-wrap gap-2">
                {company.job_analysis.workMode && company.job_analysis.workMode !== 'unknown' && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">
                    <MapPin className="h-3 w-3" />
                    {company.job_analysis.workMode}
                  </span>
                )}
                {company.job_analysis.salaryRange && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-50 text-green-700">
                    <DollarSign className="h-3 w-3" />
                    {company.job_analysis.salaryRange}
                  </span>
                )}
                {company.job_analysis.hiringUrgency === 'urgent' && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-50 text-red-700">
                    <Zap className="h-3 w-3" />
                    Urgent Hire
                  </span>
                )}
                {company.job_analysis.techStack && company.job_analysis.techStack.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Tech: {company.job_analysis.techStack.slice(0, 3).join(', ')}
                    {company.job_analysis.techStack.length > 3 && ' ...'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Enrichment Error */}
          {enrichmentError && enrichingCompanyId === null && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {enrichmentError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap mt-4">
            <Button
              variant="default"
              size="sm"
              className="bg-primary hover:bg-primary/90"
              onClick={() => onFindContacts(company.id, company.name)}
              disabled={enrichingCompanyId === company.id}
            >
              {enrichingCompanyId === company.id ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Finding...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-1" />
                  Find Decision Makers
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onClassify(company.id, company.name)}
              disabled={classifyingCompanyId === company.id}
              title="Check if this is a recruitment agency using AI"
            >
              {classifyingCompanyId === company.id ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Classifying...
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4 mr-1" />
                  Check if Agency
                </>
              )}
            </Button>
            {!company.domain && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onResolveDomain(company.id, company.name)}
                disabled={resolvingDomainId === company.id}
                title="Find company website"
              >
                {resolvingDomainId === company.id ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    Finding...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4 mr-1" />
                    Find Website
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAnalyzeJobs(company.id, company.name)}
              disabled={analyzingJobsForCompanyId === company.id || !company.pain_signals.some(s => s.job_url)}
              title={company.pain_signals.some(s => s.job_url) ? 'Analyze job posting for insights' : 'No job URL available'}
            >
              {analyzingJobsForCompanyId === company.id ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-1" />
                  Analyze Hiring Need
                </>
              )}
            </Button>
            {company.domain && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(company.domain) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(`https://${company.domain}`, '_blank')
                }
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Website
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
