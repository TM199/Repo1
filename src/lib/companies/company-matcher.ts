// Company matching using fuzzy logic and multiple identifiers

import { createAdminClient } from '@/lib/supabase/server';

interface CompanyMatchResult {
  company_id: string | null;
  match_type: 'exact_domain' | 'exact_ch_number' | 'fuzzy_name' | 'new';
  confidence: number;
}

interface CompanyInput {
  name: string;
  domain?: string;
  companies_house_number?: string;
  location?: string;
  industry?: string;
}

interface Company {
  id: string;
  name: string;
  name_normalized: string;
  domain: string | null;
  companies_house_number: string | null;
  industry: string | null;
  region: string | null;
  hiring_pain_score: number;
}

/**
 * Normalize company name for matching
 * Removes common suffixes, converts to lowercase, strips punctuation
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|llp|inc|corp|corporation)\b\.?/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-100) between two strings
 */
export function calculateSimilarity(a: string, b: string): number {
  const normalizedA = normalizeCompanyName(a);
  const normalizedB = normalizeCompanyName(b);

  if (normalizedA === normalizedB) return 100;

  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  if (maxLength === 0) return 100;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  return Math.round((1 - distance / maxLength) * 100);
}

/**
 * Find or create a company, with intelligent matching
 */
export async function findOrCreateCompany(
  input: CompanyInput
): Promise<CompanyMatchResult & { company: Company }> {
  const supabase = createAdminClient();
  const normalizedName = normalizeCompanyName(input.name);

  // Strategy 1: Exact domain match (highest confidence)
  if (input.domain) {
    const { data: domainMatch } = await supabase
      .from('companies')
      .select('*')
      .eq('domain', input.domain.toLowerCase())
      .single();

    if (domainMatch) {
      return {
        company_id: domainMatch.id,
        match_type: 'exact_domain',
        confidence: 100,
        company: domainMatch as Company,
      };
    }
  }

  // Strategy 2: Companies House number match (highest confidence)
  if (input.companies_house_number) {
    const { data: chMatch } = await supabase
      .from('companies')
      .select('*')
      .eq('companies_house_number', input.companies_house_number)
      .single();

    if (chMatch) {
      return {
        company_id: chMatch.id,
        match_type: 'exact_ch_number',
        confidence: 100,
        company: chMatch as Company,
      };
    }
  }

  // Strategy 3: Exact normalized name match
  const { data: exactNameMatch } = await supabase
    .from('companies')
    .select('*')
    .eq('name_normalized', normalizedName)
    .single();

  if (exactNameMatch) {
    return {
      company_id: exactNameMatch.id,
      match_type: 'fuzzy_name',
      confidence: 100,
      company: exactNameMatch as Company,
    };
  }

  // Strategy 4: Fuzzy name match (similarity > 85%)
  // Search for candidates with similar names
  const { data: candidates } = await supabase
    .from('companies')
    .select('*')
    .textSearch('name', normalizedName.split(' ').join(' | '));

  if (candidates && candidates.length > 0) {
    let bestMatch: Company | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = calculateSimilarity(input.name, candidate.name);
      if (score > bestScore && score >= 85) {
        bestScore = score;
        bestMatch = candidate as Company;
      }
    }

    if (bestMatch) {
      return {
        company_id: bestMatch.id,
        match_type: 'fuzzy_name',
        confidence: bestScore,
        company: bestMatch,
      };
    }
  }

  // Strategy 5: Create new company
  const { data: newCompany, error } = await supabase
    .from('companies')
    .insert({
      name: input.name,
      name_normalized: normalizedName,
      domain: input.domain?.toLowerCase(),
      companies_house_number: input.companies_house_number,
      industry: input.industry,
      region: input.location,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    company_id: newCompany.id,
    match_type: 'new',
    confidence: 100,
    company: newCompany as Company,
  };
}

/**
 * Update company's last activity timestamp
 */
export async function updateCompanyActivity(companyId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from('companies')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', companyId);
}

/**
 * Update company's pain score
 */
export async function updateCompanyPainScore(
  companyId: string,
  score: number
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from('companies')
    .update({
      hiring_pain_score: Math.min(score, 100),
      pain_score_updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', companyId);
}
