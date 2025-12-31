/**
 * Companies House Signal Detection
 *
 * Detects leadership changes and expansion signals from CH filing history.
 * Filing types: AP01 (appoint), TM01 (terminate), SH01 (shares), CC01 (capital)
 */

import { getFilingHistory } from '../companies-house';
import { PAIN_SCORES } from '../signals/detection';

export interface SignalCandidate {
  companyId: string;
  signalType: string;
  painScore: number;
  urgency: 'immediate' | 'short_term' | 'medium_term';
  confidence: number;
  title: string;
  detail: string;
  filingDate: string;
  filingType: string;
  officerName?: string;
  rawFiling: Record<string, unknown>;
}

interface Filing {
  category: string;
  type: string;
  date: string;
  description: string;
  description_values?: Record<string, string>;
}

/**
 * Detect leadership signals from CH filing history
 * - AP01: Director appointment → new_director_appointment
 * - TM01: Director termination → contributes to director_gap or leadership_reorganisation
 */
export async function detectLeadershipSignals(
  companyId: string,
  chNumber: string,
  lookbackDays: number = 90
): Promise<SignalCandidate[]> {
  const { filings, error } = await getFilingHistory(chNumber, 'officers');

  if (error || !filings.length) {
    return [];
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  const signals: SignalCandidate[] = [];
  const recentFilings = filings.filter((f: Filing) => new Date(f.date) >= cutoffDate);

  // Count appointments and terminations
  const appointments = recentFilings.filter((f: Filing) => f.type.startsWith('AP'));
  const terminations = recentFilings.filter((f: Filing) => f.type.startsWith('TM'));

  // Signal: New director appointment
  for (const filing of appointments) {
    const officerName = filing.description_values?.officer_name || 'Unknown';
    const config = PAIN_SCORES.new_director_appointment;

    signals.push({
      companyId,
      signalType: 'new_director_appointment',
      painScore: config.pain_score,
      urgency: config.urgency,
      confidence: config.confidence_base,
      title: `New Director: ${officerName}`,
      detail: `${officerName} appointed as director on ${filing.date}. New leadership often means new priorities and budget decisions.`,
      filingDate: filing.date,
      filingType: filing.type,
      officerName,
      rawFiling: filing as unknown as Record<string, unknown>,
    });
  }

  // Signal: Leadership reorganisation (2+ terminations + 1+ appointment)
  if (terminations.length >= 2 && appointments.length >= 1) {
    const config = PAIN_SCORES.leadership_reorganisation;
    signals.push({
      companyId,
      signalType: 'leadership_reorganisation',
      painScore: config.pain_score,
      urgency: config.urgency,
      confidence: config.confidence_base,
      title: `Leadership Reorganisation`,
      detail: `${terminations.length} directors departed and ${appointments.length} appointed in ${lookbackDays} days. Major restructuring often triggers hiring needs.`,
      filingDate: terminations[0].date,
      filingType: 'reorganisation',
      rawFiling: { terminations: terminations.length, appointments: appointments.length },
    });
  }

  // Signal: Director gap (more terminations than appointments)
  if (terminations.length > appointments.length && terminations.length >= 1) {
    const gap = terminations.length - appointments.length;
    const config = PAIN_SCORES.director_gap;
    signals.push({
      companyId,
      signalType: 'director_gap',
      painScore: config.pain_score,
      urgency: config.urgency,
      confidence: config.confidence_base,
      title: `Director Gap: ${gap} unfilled position${gap > 1 ? 's' : ''}`,
      detail: `${terminations.length} directors left but only ${appointments.length} appointed. Company may be struggling to fill leadership roles.`,
      filingDate: terminations[0].date,
      filingType: 'gap',
      rawFiling: { terminations: terminations.length, appointments: appointments.length, gap },
    });
  }

  return signals;
}

/**
 * Detect expansion signals from CH filing history
 * - SH01: Allotment of shares → capital_raise
 * - CC01: Capital confirmation → capital_raise
 */
export async function detectExpansionSignals(
  companyId: string,
  chNumber: string,
  lookbackDays: number = 180
): Promise<SignalCandidate[]> {
  const { filings, error } = await getFilingHistory(chNumber, 'capital');

  if (error || !filings.length) {
    return [];
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  const signals: SignalCandidate[] = [];
  const recentFilings = filings.filter((f: Filing) => new Date(f.date) >= cutoffDate);

  // Capital-related filings
  const capitalFilings = recentFilings.filter(
    (f: Filing) => f.type.startsWith('SH') || f.type.startsWith('CC')
  );

  for (const filing of capitalFilings) {
    const config = PAIN_SCORES.capital_raise;
    signals.push({
      companyId,
      signalType: 'capital_raise',
      painScore: config.pain_score,
      urgency: config.urgency,
      confidence: config.confidence_base,
      title: `Capital Activity: ${filing.type}`,
      detail: `${filing.description || 'Capital structure change'} filed on ${filing.date}. Companies raising capital often expand headcount.`,
      filingDate: filing.date,
      filingType: filing.type,
      rawFiling: filing as unknown as Record<string, unknown>,
    });
  }

  return signals;
}

/**
 * Detect all Companies House signals for a company
 */
export async function detectAllCHSignals(
  companyId: string,
  chNumber: string,
  options?: {
    leadershipLookbackDays?: number;
    expansionLookbackDays?: number;
  }
): Promise<SignalCandidate[]> {
  const [leadershipSignals, expansionSignals] = await Promise.all([
    detectLeadershipSignals(
      companyId,
      chNumber,
      options?.leadershipLookbackDays ?? 90
    ),
    detectExpansionSignals(
      companyId,
      chNumber,
      options?.expansionLookbackDays ?? 180
    ),
  ]);

  return [...leadershipSignals, ...expansionSignals];
}
