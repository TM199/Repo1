/**
 * Urgency Detector
 *
 * Detects urgency signals in job descriptions.
 * Used to boost pain scores for urgent hiring needs.
 */

export type UrgencyLevel = 'high' | 'medium' | null;

// High urgency patterns - immediate need, critical roles
const HIGH_URGENCY_PATTERNS: RegExp[] = [
  /\b(urgent(ly)?|immediate(ly)?|asap|a\.s\.a\.p\.)\b/i,
  /\b(start\s*(immediately|asap|right\s*away|now))\b/i,
  /\b(critical(ly)?\s*(need|hiring|role|position))\b/i,
  /\b(must\s*(start|fill|hire)\s*(immediately|asap|urgently))\b/i,
  /\b(needed\s*(urgently|immediately|asap))\b/i,
  /\b(immediate\s*(start|hire|need|vacancy|opening))\b/i,
  /\b(fast[\s-]?track(ed)?\s*(hiring|role|process))\b/i,
  /\b(same\s*day\s*(interview|start))\b/i,
  /\b(emergency\s*(hire|hiring|cover|replacement))\b/i,
];

// Medium urgency patterns - growth signals, scaling
const MEDIUM_URGENCY_PATTERNS: RegExp[] = [
  /\b(growing\s*team|expanding\s*(team|rapidly|quickly))\b/i,
  /\b(scaling\s*(up|rapidly|quickly|fast))\b/i,
  /\b(rapid(ly)?\s*(growing|expanding|scaling|hiring))\b/i,
  /\b(building\s*(out|new)\s*team)\b/i,
  /\b(new\s*team|greenfield|ground[\s-]?up)\b/i,
  /\b(high[\s-]?growth|hyper[\s-]?growth)\b/i,
  /\b(multiple\s*(positions?|openings?|roles?|vacancies))\b/i,
  /\b(several\s*(positions?|openings?|roles?))\b/i,
  /\b(ambitious\s*(growth|plans?|targets?))\b/i,
  /\b(aggressive\s*(growth|hiring|timeline))\b/i,
  /\b(due\s*to\s*(growth|expansion|new\s*contract))\b/i,
];

/**
 * Detect urgency level from job description
 *
 * @param description - The job description text
 * @returns 'high', 'medium', or null
 */
export function detectUrgencyLevel(description: string): UrgencyLevel {
  if (!description) return null;

  // Check high urgency first (takes precedence)
  for (const pattern of HIGH_URGENCY_PATTERNS) {
    if (pattern.test(description)) {
      return 'high';
    }
  }

  // Check medium urgency
  for (const pattern of MEDIUM_URGENCY_PATTERNS) {
    if (pattern.test(description)) {
      return 'medium';
    }
  }

  return null;
}

/**
 * Check if job has any urgency keywords
 */
export function hasUrgencyKeywords(description: string): boolean {
  return detectUrgencyLevel(description) !== null;
}

/**
 * Get the pain score boost for an urgency level
 */
export function getUrgencyBoost(urgencyLevel: UrgencyLevel): number {
  switch (urgencyLevel) {
    case 'high':
      return 10;
    case 'medium':
      return 5;
    default:
      return 0;
  }
}

/**
 * Extract urgency details for signal metadata
 */
export function getUrgencyDetails(description: string): {
  urgency_level: UrgencyLevel;
  urgency_boost: number;
  has_urgency_keywords: boolean;
} {
  const urgency_level = detectUrgencyLevel(description);
  return {
    urgency_level,
    urgency_boost: getUrgencyBoost(urgency_level),
    has_urgency_keywords: urgency_level !== null,
  };
}
