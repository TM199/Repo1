import Firecrawl from '@mendable/firecrawl-js';
import { SignalType, ExtractedSignal } from '@/types';

function getFirecrawlClient() {
  return new Firecrawl({
    apiKey: (process.env.FIRECRAWL_API_KEY || '').trim()
  });
}

const EXTRACTION_PROMPTS: Record<SignalType, string> = {
  new_job: `Extract all job listings from this page. For each job, return:
- company_name: the company posting the job
- company_domain: the company's website domain without https://
- signal_title: the job title
- signal_detail: the job location and any salary/contract type info
- signal_url: the full URL link to view or apply for the job
Return an array of objects. If no jobs found, return empty array.`,

  planning_submitted: `Extract all planning applications from this page. For each application, return:
- company_name: the applicant or developer name
- company_domain: their website domain if visible
- signal_title: the application reference number
- signal_detail: the site address and brief description
- signal_url: the link to view full application details
Return an array of objects.`,

  planning_approved: `Extract all approved planning permissions from this page. For each approval, return:
- company_name: the applicant or developer name
- company_domain: their website domain if visible
- signal_title: the application reference number
- signal_detail: the site address, description, and decision date
- signal_url: the link to view full decision details
Return an array of objects.`,

  contract_awarded: `Extract all contract awards from this page. For each contract, return:
- company_name: the supplier or contractor who won
- company_domain: the winner's website domain if visible
- signal_title: the contract title or reference
- signal_detail: the contract value, buyer name, and dates
- signal_url: the link to view full contract details
Return an array of objects.`,

  funding_announced: `Extract all funding announcements from this page. For each funding round, return:
- company_name: the company that raised funding
- company_domain: the company's website domain
- signal_title: the funding round type
- signal_detail: the amount raised and lead investors
- signal_url: the link to the full article
Return an array of objects.`,

  leadership_change: `Extract all leadership appointments from this page. For each appointment, return:
- company_name: the company where the person is joining
- company_domain: the company's website domain if visible
- signal_title: the person's name and new role
- signal_detail: previous role and background
- signal_url: the link to the full announcement
Return an array of objects.`,

  cqc_rating_change: `Extract all CQC rating information from this page. For each provider, return:
- company_name: the care provider name
- company_domain: their website if visible
- signal_title: the current overall rating
- signal_detail: the address and service type
- signal_url: the link to the full CQC report
Return an array of objects.`,

  company_expansion: `Extract all company expansion announcements from this page. For each expansion, return:
- company_name: the company expanding
- company_domain: the company's website domain
- signal_title: the type of expansion
- signal_detail: the location, size, number of jobs
- signal_url: the link to the full announcement
Return an array of objects.`,

  project_announced: `Extract all major project announcements from this page. For each project, return:
- company_name: the lead company or developer
- company_domain: the company's website domain
- signal_title: the project name and type
- signal_detail: project value, location, timeline, scope
- signal_url: the link to the full announcement
Return an array of objects.`,

  company_hiring: `Extract all hiring announcements from this page. For each hiring initiative, return:
- company_name: the company that is hiring
- company_domain: the company's website domain
- signal_title: the scale of hiring (e.g. "100 new roles")
- signal_detail: types of roles, locations, growth plans
- signal_url: the link to the careers page or announcement
Return an array of objects.`,

  acquisition_merger: `Extract all M&A activity from this page. For each deal, return:
- company_name: the company being acquired or the acquirer
- company_domain: the company's website domain
- signal_title: the deal type and parties involved
- signal_detail: deal value, rationale, integration plans
- signal_url: the link to the full announcement
Return an array of objects.`,

  regulatory_change: `Extract all regulatory or compliance news from this page. For each change, return:
- company_name: the regulator or affected company
- company_domain: their website domain
- signal_title: the regulation name or change
- signal_detail: what's changing, when, who's affected
- signal_url: the link to the full details
Return an array of objects.`,

  layoffs_restructure: `Extract all layoff or restructuring announcements from this page. For each announcement, return:
- company_name: the company making cuts
- company_domain: their website domain
- signal_title: the number of jobs affected
- signal_detail: roles affected, locations, timing, reasons
- signal_url: the link to the full announcement
Return an array of objects.`,
};

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    signals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          company_name: { type: 'string' },
          company_domain: { type: 'string' },
          signal_title: { type: 'string' },
          signal_detail: { type: 'string' },
          signal_url: { type: 'string' },
        },
        required: ['company_name', 'signal_title'],
      },
    },
  },
  required: ['signals'],
};

export async function scrapeAndExtract(
  url: string,
  signalType: SignalType
): Promise<{ signals: ExtractedSignal[]; error?: string }> {
  try {
    const prompt = EXTRACTION_PROMPTS[signalType];

    const firecrawl = getFirecrawlClient();
    const response = await firecrawl.scrape(url, {
      formats: [
        {
          type: 'json',
          prompt: prompt,
          schema: EXTRACTION_SCHEMA,
        }
      ],
    });

    if (!response.json) {
      return {
        signals: [],
        error: 'No data extracted'
      };
    }

    const extracted = response.json as { signals: ExtractedSignal[] };

    const cleanedSignals = (extracted?.signals || []).map(signal => ({
      ...signal,
      company_domain: cleanDomain(signal.company_domain),
      signal_url: signal.signal_url || url,
    }));

    return { signals: cleanedSignals };

  } catch (error) {
    console.error('Firecrawl error:', error);
    return {
      signals: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function cleanDomain(domain: string | undefined): string {
  if (!domain) return '';
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase();
}
