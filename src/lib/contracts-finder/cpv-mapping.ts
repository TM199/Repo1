/**
 * CPV (Common Procurement Vocabulary) Code Mapping
 *
 * Maps CPV codes used in government contracts to industry categories.
 * CPV codes are hierarchical - we match on prefixes (e.g., '72' matches all IT services).
 *
 * Reference: https://simap.ted.europa.eu/cpv
 */

/**
 * Map of CPV code prefixes to industries
 * CPV codes are 8 digits, but we match on 2-digit division level for broader coverage
 */
export const CPV_TO_INDUSTRY: Record<string, string[]> = {
  // IT & Software Services (Division 72)
  '72': ['Technology & Software', 'IT Services', 'Software Development'],
  '48': ['Technology & Software', 'Software Development'], // Software packages

  // Construction (Division 45)
  '45': ['Construction & Infrastructure', 'Construction'],

  // Healthcare & Medical (Division 85, 33)
  '85': ['Healthcare & Life Sciences', 'Healthcare'],
  '33': ['Healthcare & Life Sciences', 'Medical Equipment'],

  // Financial & Insurance Services (Division 66)
  '66': ['Financial Services', 'Insurance'],

  // Legal Services (Division 79.1)
  '791': ['Legal & Professional Services', 'Legal'],

  // Accounting & Audit (Division 79.2)
  '792': ['Financial Services', 'Accounting'],

  // Management Consulting (Division 79.4)
  '794': ['Legal & Professional Services', 'Consulting'],

  // Engineering Services (Division 71)
  '71': ['Engineering & Manufacturing', 'Engineering'],

  // Transport & Logistics (Division 60, 63)
  '60': ['Logistics & Supply Chain', 'Transport'],
  '63': ['Logistics & Supply Chain', 'Warehousing'],

  // Energy & Utilities (Division 09, 65)
  '09': ['Energy & Utilities', 'Energy'],
  '65': ['Energy & Utilities', 'Utilities'],

  // Education & Training (Division 80)
  '80': ['Education', 'Training'],

  // Property & Real Estate (Division 70)
  '70': ['Property & Real Estate', 'Real Estate'],

  // Environmental Services (Division 90)
  '90': ['Environmental Services', 'Waste Management'],

  // Telecommunications (Division 64)
  '64': ['Telecommunications', 'Technology & Software'],

  // Security Services (Division 79.7)
  '797': ['Security Services', 'Professional Services'],

  // Recruitment & HR (Division 79.6)
  '796': ['HR & Recruitment', 'Professional Services'],

  // Research & Development (Division 73)
  '73': ['Research & Development', 'Technology & Software'],

  // Manufacturing & Industrial (Division 31-35)
  '31': ['Engineering & Manufacturing', 'Electrical Equipment'],
  '32': ['Engineering & Manufacturing', 'Electronics'],
  '34': ['Engineering & Manufacturing', 'Automotive'],
  '35': ['Engineering & Manufacturing', 'Defence'],

  // Food & Agriculture (Division 03, 15)
  '03': ['Agriculture', 'Food & Beverage'],
  '15': ['Food & Beverage', 'Manufacturing'],

  // Retail & Consumer (Division 39)
  '39': ['Retail & Consumer', 'Furniture'],
};

/**
 * Reverse mapping: Industry to CPV prefixes
 */
const INDUSTRY_TO_CPV: Record<string, string[]> = {};

// Build reverse mapping
for (const [cpv, industries] of Object.entries(CPV_TO_INDUSTRY)) {
  for (const industry of industries) {
    if (!INDUSTRY_TO_CPV[industry]) {
      INDUSTRY_TO_CPV[industry] = [];
    }
    if (!INDUSTRY_TO_CPV[industry].includes(cpv)) {
      INDUSTRY_TO_CPV[industry].push(cpv);
    }
  }
}

/**
 * Get CPV code prefixes for given industries
 *
 * @param industries - Array of industry names (e.g., ['Technology & Software', 'Healthcare'])
 * @returns Array of CPV prefixes to filter on (e.g., ['72', '48', '85', '33'])
 */
export function getCPVCodesForIndustries(industries: string[]): string[] {
  const cpvPrefixes = new Set<string>();

  for (const industry of industries) {
    // Check exact match
    const prefixes = INDUSTRY_TO_CPV[industry];
    if (prefixes) {
      prefixes.forEach(p => cpvPrefixes.add(p));
    }

    // Also check partial matches (e.g., "Software" matches "Technology & Software")
    for (const [key, keyPrefixes] of Object.entries(INDUSTRY_TO_CPV)) {
      if (
        key.toLowerCase().includes(industry.toLowerCase()) ||
        industry.toLowerCase().includes(key.toLowerCase())
      ) {
        keyPrefixes.forEach(p => cpvPrefixes.add(p));
      }
    }
  }

  return Array.from(cpvPrefixes);
}

/**
 * Check if any CPV codes match target industries
 *
 * @param cpvCodes - Array of full CPV codes from a contract (e.g., ['72000000-5', '72200000-7'])
 * @param targetIndustries - Array of industry names to match against
 * @returns true if any CPV code matches any target industry
 */
export function matchCPVToIndustry(
  cpvCodes: string[],
  targetIndustries: string[]
): boolean {
  if (!cpvCodes || cpvCodes.length === 0) return false;
  if (!targetIndustries || targetIndustries.length === 0) return true; // No filter = match all

  const targetPrefixes = getCPVCodesForIndustries(targetIndustries);

  for (const cpv of cpvCodes) {
    // Extract numeric part (remove suffix like '-5')
    const numericPart = cpv.replace(/[^0-9]/g, '');

    for (const prefix of targetPrefixes) {
      if (numericPart.startsWith(prefix)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get industry name from a CPV code
 *
 * @param cpvCode - Full CPV code (e.g., '72000000-5')
 * @returns Primary industry name or null if no match
 */
export function getIndustryFromCPV(cpvCode: string): string | null {
  const numericPart = cpvCode.replace(/[^0-9]/g, '');

  // Try 3-digit match first (more specific)
  const prefix3 = numericPart.slice(0, 3);
  if (CPV_TO_INDUSTRY[prefix3]) {
    return CPV_TO_INDUSTRY[prefix3][0];
  }

  // Fall back to 2-digit match
  const prefix2 = numericPart.slice(0, 2);
  if (CPV_TO_INDUSTRY[prefix2]) {
    return CPV_TO_INDUSTRY[prefix2][0];
  }

  return null;
}

/**
 * Extract all industries from a list of CPV codes
 *
 * @param cpvCodes - Array of CPV codes
 * @returns Array of unique industry names
 */
export function getIndustriesFromCPVs(cpvCodes: string[]): string[] {
  const industries = new Set<string>();

  for (const cpv of cpvCodes) {
    const industry = getIndustryFromCPV(cpv);
    if (industry) {
      industries.add(industry);
    }
  }

  return Array.from(industries);
}
