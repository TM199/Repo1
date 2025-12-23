/**
 * Job URL Analyzer
 *
 * Uses Firecrawl to scrape job posting URLs and extract additional company information.
 * This provides enrichment data beyond what's available from the job board API.
 */

import Firecrawl from '@mendable/firecrawl-js';

function getFirecrawlClient() {
  return new Firecrawl({
    apiKey: (process.env.FIRECRAWL_API_KEY || '').trim()
  });
}

export interface JobUrlAnalysis {
  companyDescription: string | null;
  companySize: string | null;
  companyBenefits: string[];
  salaryRange: string | null;
  workMode: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  requiredExperience: string | null;
  techStack: string[];
  hiringUrgency: 'urgent' | 'standard' | 'unknown';
  applicationDeadline: string | null;
  interviewProcess: string | null;
  teamSize: string | null;
  reportingTo: string | null;
  confidence: number;
}

const JOB_ANALYSIS_PROMPT = `Analyze this job posting page and extract the following information about the company and role:

1. Company description or "About Us" section
2. Company size (number of employees)
3. Benefits and perks offered
4. Salary range (if mentioned)
5. Work mode: remote, hybrid, or onsite
6. Required years of experience
7. Technologies/tools mentioned (tech stack)
8. Any urgency indicators (e.g., "urgent", "immediate start", "ASAP")
9. Application deadline
10. Interview process description
11. Team size or team description
12. Who the role reports to

Return structured JSON data. If information is not found, leave it null or empty.`;

const JOB_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    companyDescription: {
      type: 'string',
      description: 'Company description or about section (2-3 sentences)',
    },
    companySize: {
      type: 'string',
      description: 'Company size in employees (e.g., "50-100", "500+")',
    },
    companyBenefits: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of benefits/perks mentioned',
    },
    salaryRange: {
      type: 'string',
      description: 'Salary range if mentioned (e.g., "£50,000 - £70,000")',
    },
    workMode: {
      type: 'string',
      enum: ['remote', 'hybrid', 'onsite', 'unknown'],
      description: 'Work arrangement',
    },
    requiredExperience: {
      type: 'string',
      description: 'Years of experience required (e.g., "3-5 years")',
    },
    techStack: {
      type: 'array',
      items: { type: 'string' },
      description: 'Technologies, tools, or skills mentioned',
    },
    hiringUrgency: {
      type: 'string',
      enum: ['urgent', 'standard', 'unknown'],
      description: 'Hiring urgency level',
    },
    applicationDeadline: {
      type: 'string',
      description: 'Application deadline if mentioned',
    },
    interviewProcess: {
      type: 'string',
      description: 'Description of interview process if mentioned',
    },
    teamSize: {
      type: 'string',
      description: 'Team size or team description',
    },
    reportingTo: {
      type: 'string',
      description: 'Who the role reports to',
    },
  },
  required: ['workMode', 'hiringUrgency'],
};

/**
 * Analyze a job posting URL to extract additional company/role information
 */
export async function analyzeJobUrl(jobUrl: string): Promise<{
  analysis: JobUrlAnalysis | null;
  error?: string;
}> {
  if (!jobUrl) {
    return { analysis: null, error: 'No job URL provided' };
  }

  // Validate URL
  try {
    new URL(jobUrl);
  } catch {
    return { analysis: null, error: 'Invalid job URL' };
  }

  try {
    const firecrawl = getFirecrawlClient();

    console.log(`[JobUrlAnalyzer] Analyzing: ${jobUrl}`);

    const response = await firecrawl.scrape(jobUrl, {
      formats: [
        {
          type: 'json',
          prompt: JOB_ANALYSIS_PROMPT,
          schema: JOB_ANALYSIS_SCHEMA,
        }
      ],
    });

    if (!response.json) {
      return {
        analysis: null,
        error: 'Could not extract data from job posting'
      };
    }

    const extracted = response.json as Partial<JobUrlAnalysis>;

    // Calculate confidence based on how much we extracted
    const confidence = calculateAnalysisConfidence(extracted);

    const analysis: JobUrlAnalysis = {
      companyDescription: extracted.companyDescription || null,
      companySize: extracted.companySize || null,
      companyBenefits: extracted.companyBenefits || [],
      salaryRange: extracted.salaryRange || null,
      workMode: extracted.workMode || 'unknown',
      requiredExperience: extracted.requiredExperience || null,
      techStack: extracted.techStack || [],
      hiringUrgency: extracted.hiringUrgency || 'unknown',
      applicationDeadline: extracted.applicationDeadline || null,
      interviewProcess: extracted.interviewProcess || null,
      teamSize: extracted.teamSize || null,
      reportingTo: extracted.reportingTo || null,
      confidence,
    };

    console.log(`[JobUrlAnalyzer] Analysis complete, confidence: ${confidence}`);

    return { analysis };

  } catch (error) {
    console.error('[JobUrlAnalyzer] Error:', error);
    return {
      analysis: null,
      error: error instanceof Error ? error.message : 'Failed to analyze job URL'
    };
  }
}

/**
 * Calculate confidence score for the analysis
 */
function calculateAnalysisConfidence(extracted: Partial<JobUrlAnalysis>): number {
  let score = 0;
  const maxScore = 100;

  // Company description (20 points)
  if (extracted.companyDescription && extracted.companyDescription.length > 50) {
    score += 20;
  }

  // Work mode specified (15 points)
  if (extracted.workMode && extracted.workMode !== 'unknown') {
    score += 15;
  }

  // Salary mentioned (15 points)
  if (extracted.salaryRange) {
    score += 15;
  }

  // Benefits listed (10 points)
  if (extracted.companyBenefits && extracted.companyBenefits.length > 0) {
    score += Math.min(10, extracted.companyBenefits.length * 3);
  }

  // Tech stack (10 points)
  if (extracted.techStack && extracted.techStack.length > 0) {
    score += Math.min(10, extracted.techStack.length * 2);
  }

  // Experience requirement (10 points)
  if (extracted.requiredExperience) {
    score += 10;
  }

  // Company size (10 points)
  if (extracted.companySize) {
    score += 10;
  }

  // Hiring urgency (5 points)
  if (extracted.hiringUrgency && extracted.hiringUrgency !== 'unknown') {
    score += 5;
  }

  // Team info (5 points)
  if (extracted.teamSize || extracted.reportingTo) {
    score += 5;
  }

  return Math.min(maxScore, score);
}

/**
 * Batch analyze multiple job URLs
 */
export async function analyzeJobUrls(jobUrls: string[]): Promise<Map<string, JobUrlAnalysis | null>> {
  const results = new Map<string, JobUrlAnalysis | null>();

  for (const url of jobUrls) {
    const { analysis } = await analyzeJobUrl(url);
    results.set(url, analysis);

    // Rate limiting - wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}
