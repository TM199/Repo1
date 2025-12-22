import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Firecrawl from '@mendable/firecrawl-js';
import { SignalType, ExtractedSignal } from '@/types';
import { getSignalTypeConfig, getLocationSearchTerms } from '@/lib/signal-mapping';

const firecrawl = new Firecrawl({
  apiKey: (process.env.FIRECRAWL_API_KEY || '').trim()
});

const MAX_SIGNALS = 10;
const MAX_QUERIES = 3;

/**
 * SSE streaming endpoint for agency signal search
 * Returns signals in real-time as they're found
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { industries, signalTypes, locations } = body as {
    industries: string[];
    signalTypes: SignalType[];
    locations: string[];
  };

  if (!industries?.length || !signalTypes?.length) {
    return new Response(JSON.stringify({ error: 'Industries and signal types required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const signals: ExtractedSignal[] = [];
        const queries = generateAgencyQueries(industries, signalTypes, locations);

        send('status', { message: `Generated ${queries.length} search queries`, total: queries.length });

        for (let i = 0; i < queries.length && signals.length < MAX_SIGNALS; i++) {
          const { query, signalType, industry } = queries[i];

          send('status', { message: `Searching: ${query.slice(0, 50)}...`, current: i + 1, total: queries.length });

          try {
            const searchResults = await withTimeout(
              firecrawl.search(query, { limit: 3 }),
              10000,
              'Search timed out'
            );

            type FirecrawlResult = { url: string; title?: string };
            let results: FirecrawlResult[] = [];

            if (Array.isArray(searchResults)) {
              results = searchResults;
            } else if (searchResults && typeof searchResults === 'object') {
              const sr = searchResults as { data?: FirecrawlResult[]; web?: FirecrawlResult[]; results?: FirecrawlResult[] };
              results = sr.data || sr.web || sr.results || [];
            }

            // Scrape first result
            for (const result of results.slice(0, 1)) {
              if (signals.length >= MAX_SIGNALS) break;

              send('status', { message: `Extracting from: ${new URL(result.url).hostname}...` });

              try {
                const extracted = await scrapeForSignals(result.url, signalType, industry);

                for (const signal of extracted) {
                  if (signals.length >= MAX_SIGNALS) break;

                  // Check for duplicates
                  const isDupe = signals.some(s =>
                    s.company_name.toLowerCase() === signal.company_name.toLowerCase() &&
                    s.signal_title.toLowerCase() === signal.signal_title.toLowerCase()
                  );

                  if (!isDupe) {
                    signals.push(signal);
                    send('signal', {
                      ...signal,
                      signal_type: signalType,
                      industry,
                    });
                  }
                }
              } catch {
                // Skip failed scrapes
              }

              await sleep(300);
            }
          } catch {
            // Skip failed searches
          }

          await sleep(300);
        }

        send('complete', { count: signals.length });
        controller.close();

      } catch (error) {
        send('error', { message: error instanceof Error ? error.message : 'Search failed' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Generate search queries for agency-selected industries and signal types
 */
function generateAgencyQueries(
  industries: string[],
  signalTypes: SignalType[],
  locations: string[]
): { query: string; signalType: SignalType; industry: string }[] {
  const queries: { query: string; signalType: SignalType; industry: string }[] = [];
  const locationTerms = getLocationSearchTerms(locations);
  const location = locationTerms[0] || 'UK';

  const currentYear = new Date().getFullYear();
  const dateStr = `${currentYear}`;

  for (const signalType of signalTypes) {
    const config = getSignalTypeConfig(signalType);
    if (!config) continue;

    for (const industry of industries) {
      // Take first template for each signal type
      const template = config.searchQueryTemplates[0];
      if (!template) continue;

      const query = template
        .replace('{industry}', industry)
        .replace('{location}', location)
        .replace('{date}', dateStr)
        .replace('{role_types}', '') // Remove role placeholders
        .replace(/\s+/g, ' ')
        .trim();

      if (query.length > 10) {
        queries.push({ query, signalType, industry });
      }
    }
  }

  // Dedupe and limit
  const seen = new Set<string>();
  return queries
    .filter(q => {
      const key = q.query.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_QUERIES);
}

/**
 * Scrape a URL for signals of a specific type
 */
async function scrapeForSignals(
  url: string,
  signalType: SignalType,
  industry: string
): Promise<ExtractedSignal[]> {
  const prompt = getExtractionPrompt(signalType, industry);

  const scrapeResult = await withTimeout(
    firecrawl.scrape(url, {
      formats: [
        {
          type: 'json',
          prompt,
          schema: {
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
          },
        }
      ],
    }),
    15000,
    'Scrape timed out'
  );

  const jsonResult = scrapeResult.json as { signals?: ExtractedSignal[] } | undefined;
  if (!jsonResult?.signals) return [];

  return jsonResult.signals
    .filter(s => s.company_name && s.signal_title)
    .map(s => ({
      company_name: s.company_name,
      company_domain: cleanDomain(s.company_domain),
      signal_title: s.signal_title,
      signal_detail: s.signal_detail || '',
      signal_url: s.signal_url || url,
    }));
}

function getExtractionPrompt(signalType: SignalType, industry: string): string {
  const prompts: Record<string, string> = {
    contract_awarded: `Extract contract awards from this page. For each: company_name (winner), company_domain, signal_title (contract reference), signal_detail (value, buyer, scope), signal_url. Focus on ${industry} contracts.`,
    planning_approved: `Extract planning approvals. For each: company_name (developer), company_domain, signal_title (reference), signal_detail (address, size, type), signal_url. Focus on ${industry}.`,
    funding_announced: `Extract funding announcements. For each: company_name, company_domain, signal_title (round type + amount), signal_detail (investors, use of funds), signal_url. Focus on ${industry}.`,
    company_expansion: `Extract expansion news. For each: company_name, company_domain, signal_title (expansion type), signal_detail (location, jobs, investment), signal_url. Focus on ${industry}.`,
    leadership_change: `Extract leadership appointments. For each: company_name, company_domain, signal_title (name + role), signal_detail (background), signal_url. Focus on ${industry}.`,
    cqc_rating_change: `Extract CQC ratings. For each: company_name (provider), company_domain, signal_title (rating), signal_detail (address, issues), signal_url.`,
    project_announced: `Extract project announcements. For each: company_name, company_domain, signal_title (project name), signal_detail (value, scope), signal_url. Focus on ${industry}.`,
    company_hiring: `Extract hiring announcements. For each: company_name, company_domain, signal_title (scale), signal_detail (roles, locations), signal_url. Focus on ${industry}.`,
    acquisition_merger: `Extract M&A news. For each: company_name (acquirer/target), company_domain, signal_title (deal type), signal_detail (value, rationale), signal_url. Focus on ${industry}.`,
  };

  return prompts[signalType] || prompts.company_hiring;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMsg)), ms)
  );
  return Promise.race([promise, timeout]);
}

function cleanDomain(domain: string | undefined): string {
  if (!domain) return '';
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .split('/')[0]
    .toLowerCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
