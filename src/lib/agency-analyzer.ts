import Firecrawl from '@mendable/firecrawl-js';
import { AgencyAnalysis } from '@/types';

function getFirecrawlClient() {
  return new Firecrawl({
    apiKey: (process.env.FIRECRAWL_API_KEY || '').trim()
  });
}

const AGENCY_EXTRACTION_PROMPT = `Analyze this recruitment agency's website and extract:

1. Industries they recruit for - look for sector pages, job categories, or industry mentions
2. Types of roles they typically recruit - look at job listings, specializations, or service descriptions
3. Their recruitment focus - permanent roles, contract/temp, or mixed
4. A brief summary of what this agency does

Return structured data. If you cannot determine something, leave it empty.`;

const AGENCY_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    industries: {
      type: 'array',
      items: { type: 'string' },
      description: 'Industry sectors they recruit for (e.g. "construction", "healthcare", "technology")',
    },
    roleTypes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Types of roles they recruit (e.g. "Project Managers", "Engineers", "Nurses")',
    },
    focus: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['permanent', 'contract', 'temp', 'mixed'],
      },
      description: 'Their recruitment focus types',
    },
    summary: {
      type: 'string',
      description: 'Brief summary of the agency (1-2 sentences)',
    },
  },
  required: ['industries', 'roleTypes', 'focus', 'summary'],
};

/**
 * Analyze a recruitment agency website to detect their specializations
 */
export async function analyzeAgencyWebsite(domain: string): Promise<{
  analysis: AgencyAnalysis | null;
  error?: string;
}> {
  try {
    // Clean and validate domain
    const cleanedDomain = cleanDomain(domain);
    if (!cleanedDomain) {
      return { analysis: null, error: 'Invalid domain provided' };
    }

    const url = `https://${cleanedDomain}`;
    const firecrawl = getFirecrawlClient();

    const response = await firecrawl.scrape(url, {
      formats: [
        {
          type: 'json',
          prompt: AGENCY_EXTRACTION_PROMPT,
          schema: AGENCY_EXTRACTION_SCHEMA,
        }
      ],
    });

    if (!response.json) {
      return {
        analysis: null,
        error: 'Could not extract data from website'
      };
    }

    const extracted = response.json as {
      industries?: string[];
      roleTypes?: string[];
      focus?: ('permanent' | 'contract' | 'temp' | 'mixed')[];
      summary?: string;
    };

    // Normalize industries to match our system's industry values
    const normalizedIndustries = normalizeIndustries(extracted.industries || []);

    // Calculate confidence based on how much data we extracted
    const confidence = calculateConfidence(extracted);

    const analysis: AgencyAnalysis = {
      industries: normalizedIndustries,
      roleTypes: extracted.roleTypes || [],
      focus: extracted.focus || ['mixed'],
      confidence,
      summary: extracted.summary || 'Recruitment agency',
    };

    return { analysis };

  } catch (error) {
    console.error('[AgencyAnalyzer] Error:', error);
    return {
      analysis: null,
      error: error instanceof Error ? error.message : 'Failed to analyze website'
    };
  }
}

/**
 * Normalize extracted industries to match our system's industry values
 */
function normalizeIndustries(industries: string[]): string[] {
  const mapping: Record<string, string> = {
    // Direct matches
    'construction': 'construction',
    'healthcare': 'healthcare',
    'technology': 'technology',
    'manufacturing': 'manufacturing',
    'finance': 'finance',
    'energy': 'energy',
    'logistics': 'logistics',
    'property': 'property',
    'retail': 'retail',
    'education': 'education',
    'legal': 'legal',
    'hospitality': 'hospitality',

    // Common variations
    'it': 'technology',
    'tech': 'technology',
    'software': 'technology',
    'engineering': 'manufacturing',
    'financial services': 'finance',
    'banking': 'finance',
    'medical': 'healthcare',
    'health': 'healthcare',
    'nhs': 'healthcare',
    'care': 'healthcare',
    'nursing': 'healthcare',
    'building': 'construction',
    'civil engineering': 'construction',
    'real estate': 'property',
    'commercial property': 'property',
    'transport': 'logistics',
    'supply chain': 'logistics',
    'warehouse': 'logistics',
    'oil and gas': 'energy',
    'renewables': 'energy',
    'utilities': 'energy',
    'hotels': 'hospitality',
    'leisure': 'hospitality',
    'schools': 'education',
    'professional services': 'legal',
    'accountancy': 'legal',
    'law': 'legal',
    'consumer': 'retail',
    'fmcg': 'retail',
  };

  const normalized = new Set<string>();

  for (const industry of industries) {
    const lower = industry.toLowerCase().trim();

    // Check direct mapping
    if (mapping[lower]) {
      normalized.add(mapping[lower]);
      continue;
    }

    // Check if any mapping key is contained in the industry string
    for (const [key, value] of Object.entries(mapping)) {
      if (lower.includes(key)) {
        normalized.add(value);
        break;
      }
    }
  }

  return Array.from(normalized);
}

/**
 * Calculate confidence score based on extraction quality
 */
function calculateConfidence(extracted: {
  industries?: string[];
  roleTypes?: string[];
  focus?: string[];
  summary?: string;
}): number {
  let score = 0;

  // Industries detected (0-40 points)
  if (extracted.industries && extracted.industries.length > 0) {
    score += Math.min(40, extracted.industries.length * 15);
  }

  // Role types detected (0-30 points)
  if (extracted.roleTypes && extracted.roleTypes.length > 0) {
    score += Math.min(30, extracted.roleTypes.length * 10);
  }

  // Focus detected (0-15 points)
  if (extracted.focus && extracted.focus.length > 0) {
    score += 15;
  }

  // Summary provided (0-15 points)
  if (extracted.summary && extracted.summary.length > 20) {
    score += 15;
  }

  return Math.min(100, score);
}

function cleanDomain(domain: string | undefined): string {
  if (!domain) return '';
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase()
    .trim();
}
