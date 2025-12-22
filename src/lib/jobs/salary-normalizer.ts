// Normalize salaries to annual figures for comparison

interface SalaryInput {
  salary_min?: number;
  salary_max?: number;
  salary_type?: string; // from job board API
  raw_salary_string?: string; // if parsing from text
}

interface NormalizedSalary {
  annual_min: number | null;
  annual_max: number | null;
  salary_type: 'annual' | 'daily' | 'hourly' | 'monthly';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Convert salary to annual equivalent
 */
export function normalizeToAnnual(
  amount: number,
  type: 'annual' | 'daily' | 'hourly' | 'monthly'
): number {
  switch (type) {
    case 'annual':
      return amount;
    case 'monthly':
      return amount * 12;
    case 'daily':
      // Assume 220 working days per year (UK standard)
      return amount * 220;
    case 'hourly':
      // Assume 37.5 hours/week, 52 weeks
      return Math.round(amount * 37.5 * 52);
    default:
      return amount;
  }
}

/**
 * Detect salary type from Reed/Adzuna API response
 * Uses heuristics based on typical UK salary ranges
 */
export function detectSalaryType(
  minimumSalary: number,
  maximumSalary: number
): 'annual' | 'daily' | 'hourly' {
  const avgSalary = (minimumSalary + maximumSalary) / 2;

  // Daily rates typically £100-£1500 (contractors)
  if (avgSalary >= 100 && avgSalary <= 1500) {
    return 'daily';
  }

  // Hourly rates typically £8-£100
  if (avgSalary >= 8 && avgSalary < 100) {
    return 'hourly';
  }

  // Otherwise assume annual
  return 'annual';
}

/**
 * Parse salary from Reed API response
 */
export function parseReedSalary(job: {
  minimumSalary?: number;
  maximumSalary?: number;
}): NormalizedSalary {
  if (!job.minimumSalary && !job.maximumSalary) {
    return {
      annual_min: null,
      annual_max: null,
      salary_type: 'annual',
      confidence: 'low',
    };
  }

  const min = job.minimumSalary || job.maximumSalary!;
  const max = job.maximumSalary || job.minimumSalary!;

  const salaryType = detectSalaryType(min, max);

  return {
    annual_min: normalizeToAnnual(min, salaryType),
    annual_max: normalizeToAnnual(max, salaryType),
    salary_type: salaryType,
    confidence: 'high',
  };
}

/**
 * Parse salary from Adzuna API response
 */
export function parseAdzunaSalary(job: {
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: boolean;
}): NormalizedSalary {
  if (!job.salary_min && !job.salary_max) {
    return {
      annual_min: null,
      annual_max: null,
      salary_type: 'annual',
      confidence: 'low',
    };
  }

  // Adzuna provides annual salaries by default
  return {
    annual_min: job.salary_min || null,
    annual_max: job.salary_max || null,
    salary_type: 'annual',
    confidence: job.salary_is_predicted ? 'medium' : 'high',
  };
}

/**
 * Calculate salary increase percentage between two jobs
 */
export function calculateSalaryIncrease(
  oldSalaryMin: number | null,
  oldSalaryMax: number | null,
  newSalaryMin: number | null,
  newSalaryMax: number | null
): number | null {
  // Calculate midpoints
  const oldMid =
    oldSalaryMin && oldSalaryMax
      ? (oldSalaryMin + oldSalaryMax) / 2
      : oldSalaryMin || oldSalaryMax;

  const newMid =
    newSalaryMin && newSalaryMax
      ? (newSalaryMin + newSalaryMax) / 2
      : newSalaryMin || newSalaryMax;

  if (!oldMid || !newMid) return null;
  if (newMid <= oldMid) return 0;

  return Math.round(((newMid - oldMid) / oldMid) * 100);
}

/**
 * Format salary for display
 */
export function formatSalary(
  min: number | null,
  max: number | null,
  type: string = 'annual'
): string {
  if (!min && !max) return 'Not specified';

  const format = (n: number) => {
    if (n >= 1000) {
      return `£${Math.round(n / 1000)}k`;
    }
    return `£${n}`;
  };

  const suffix = type === 'daily' ? '/day' : type === 'hourly' ? '/hr' : '/yr';

  if (min && max && min !== max) {
    return `${format(min)} - ${format(max)}${suffix}`;
  }

  return `${format(min || max!)}${suffix}`;
}

/**
 * Detect if salary mentions referral bonus
 */
export function detectReferralBonus(description: string): {
  hasBonus: boolean;
  amount: number | null;
} {
  const bonusPattern =
    /referral\s*bonus[:\s]*(?:of\s*)?[£$]?([\d,]+)/i;
  const match = description.match(bonusPattern);

  if (match) {
    const amount = parseInt(match[1].replace(/,/g, ''), 10);
    return { hasBonus: true, amount: isNaN(amount) ? null : amount };
  }

  // Check for general mention without amount
  if (/referral\s*bonus/i.test(description)) {
    return { hasBonus: true, amount: null };
  }

  return { hasBonus: false, amount: null };
}
