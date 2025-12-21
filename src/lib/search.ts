import Firecrawl from '@mendable/firecrawl-js';
import {
  SearchProfile,
  Signal,
  SignalType,
  ExtractedSignal,
  SearchRun
} from '@/types';
import {
  getIndustryLabel,
  getLocationSearchTerms,
  getSignalTypeConfig,
  SIGNAL_TYPES_CONFIG,
} from './signal-mapping';
import { createAdminClient } from './supabase/server';

const firecrawl = new Firecrawl({
  apiKey: (process.env.FIRECRAWL_API_KEY || '').trim()
});

// =============================================
// TIMEOUT WRAPPER
// =============================================

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMsg: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMsg)), ms)
  );
  return Promise.race([promise, timeout]);
}

// =============================================
// QUERY GENERATION
// =============================================

interface GeneratedQuery {
  query: string;
  signalType: SignalType;
  location: string;
}

export function generateSearchQueries(profile: SearchProfile): GeneratedQuery[] {
  const queries: GeneratedQuery[] = [];

  const currentDate = new Date();
  const dateStrings = [
    currentDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
    currentDate.getFullYear().toString(),
    'latest',
    'recent',
    '2024', // Include recent past
  ];

  const industryLabel = getIndustryLabel(profile.industry);
  const locationTerms = getLocationSearchTerms(profile.locations);

  // Limit to avoid too many queries
  const limitedLocations = locationTerms.slice(0, 4);
  const limitedDates = dateStrings.slice(0, 2);

  for (const signalType of profile.signal_types) {
    const signalConfig = getSignalTypeConfig(signalType);
    if (!signalConfig) continue;

    for (const template of signalConfig.searchQueryTemplates) {
      for (const location of limitedLocations) {
        for (const date of limitedDates) {
          let query = template
            .replace('{industry}', industryLabel)
            .replace('{location}', location)
            .replace('{date}', date);

          // Handle role types
          if (template.includes('{role_types}')) {
            if (profile.specific_roles.length > 0) {
              const roleStr = profile.specific_roles.slice(0, 2).join(' OR ');
              query = query.replace('{role_types}', roleStr);
            } else {
              continue; // Skip this template if no roles specified
            }
          }

          // Add additional keywords
          if (profile.additional_keywords.length > 0) {
            query += ' ' + profile.additional_keywords.slice(0, 2).join(' ');
          }

          // Clean up
          query = query.replace(/\s+/g, ' ').trim();

          if (query.length > 10) {
            queries.push({
              query,
              signalType: signalType as SignalType,
              location,
            });
          }
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = queries.filter(q => {
    const key = q.query.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Limit queries based on profile settings (default 2 for speed)
  const maxQueries = profile.search_count || 2;
  return unique.slice(0, maxQueries);
}

// =============================================
// EXTRACTION PROMPTS
// =============================================

function getExtractionPrompt(
  signalType: SignalType,
  industry: string,
  roles: string[]
): string {
  const roleStr = roles.slice(0, 5).join(', ') || 'relevant staff';
  const industryLabel = getIndustryLabel(industry);

  const prompts: Record<string, string> = {
    contract_awarded: `Extract all contract awards from this page. For each contract found, return:
- company_name: The company/supplier who won the contract
- company_domain: Their website domain (e.g. example.com), extract from links or text
- signal_title: Contract title or reference number
- signal_detail: Contract value, buyer/authority name, duration, and scope of work
- signal_url: Link to full contract details

Focus on ${industryLabel} sector contracts. These contracts mean the winner will likely be hiring ${roleStr}.
Return as JSON array. If no contracts found, return empty array [].`,

    planning_approved: `Extract all planning approvals/permissions from this page. For each approval:
- company_name: The developer or applicant name
- company_domain: Their website domain if visible
- signal_title: Planning reference and development type
- signal_detail: Site address, size (sq ft/hectares/units), what's being built
- signal_url: Link to planning portal or full details

Focus on ${industryLabel} related developments. Large approvals = hiring ${roleStr}.
Return as JSON array. If nothing found, return [].`,

    planning_submitted: `Extract all planning applications from this page. For each application:
- company_name: The applicant or developer
- company_domain: Their website if visible
- signal_title: Application reference
- signal_detail: Site address, description, proposed development
- signal_url: Link to application details

Return as JSON array.`,

    funding_announced: `Extract all funding/investment announcements from this page. For each:
- company_name: Company that raised funding
- company_domain: Their website domain
- signal_title: Funding round type and amount (e.g. "Series A - £5m")
- signal_detail: Investors, what funding will be used for, growth plans
- signal_url: Link to announcement

Focus on ${industryLabel} companies. Funded companies typically hire ${roleStr}.
Return as JSON array.`,

    company_expansion: `Extract all company expansion news from this page. For each expansion:
- company_name: Company expanding
- company_domain: Their website
- signal_title: Type of expansion (new office/facility/warehouse/factory)
- signal_detail: Location, size, number of jobs created, investment amount, timeline
- signal_url: Link to announcement

Focus on ${industryLabel} expansions. New facilities require ${roleStr}.
Return as JSON array.`,

    leadership_change: `Extract all executive/leadership appointments from this page. For each:
- company_name: Company making the appointment
- company_domain: Their website
- signal_title: Person's name and new role (e.g. "John Smith appointed CEO")
- signal_detail: Previous role, background, company's growth plans
- signal_url: Link to announcement

Focus on ${industryLabel} appointments. New leaders often restructure teams and hire.
Return as JSON array.`,

    cqc_rating_change: `Extract all CQC inspection results from this page. For each:
- company_name: Care provider name
- company_domain: Their website if visible
- signal_title: Overall rating (Outstanding/Good/Requires Improvement/Inadequate)
- signal_detail: Address, service type, what was flagged, inspection date
- signal_url: Link to full CQC report

"Requires Improvement" ratings = urgent need for ${roleStr}.
Return as JSON array.`,

    project_announced: `Extract all major project announcements from this page. For each:
- company_name: Lead company or developer
- company_domain: Their website
- signal_title: Project name and type
- signal_detail: Value, location, timeline, scope, jobs to be created
- signal_url: Link to announcement

Focus on ${industryLabel} projects. Major projects need ${roleStr}.
Return as JSON array.`,

    company_hiring: `Extract all hiring announcements from this page. For each:
- company_name: Company hiring
- company_domain: Their website
- signal_title: Scale of hiring (e.g. "100 new roles", "expansion hiring")
- signal_detail: Types of roles, locations, growth plans, timeline
- signal_url: Link to careers page or announcement
- hiring_manager: If visible, extract hiring manager or HR contact details as an object:
  - name: Full name of the hiring manager, HR contact, or recruiter
  - job_title: Their job title
  - email: Their email address if shown
  - phone: Their phone number if shown
  - linkedin_url: Their LinkedIn profile URL if linked
  - department: The department they represent

Focus on ${industryLabel} companies hiring ${roleStr}.
Return as JSON array with hiring_manager as a nested object (or null if not found).`,

    acquisition_merger: `Extract all M&A activity from this page. For each deal:
- company_name: Company being acquired OR the acquirer
- company_domain: Their website
- signal_title: Deal type and parties (e.g. "ABC acquires XYZ")
- signal_detail: Deal value, rationale, integration plans, impact on jobs
- signal_url: Link to announcement

${industryLabel} M&A often leads to restructuring and hiring ${roleStr}.
Return as JSON array.`,

    regulatory_change: `Extract all regulatory/compliance news from this page. For each:
- company_name: Regulator or affected company
- company_domain: Website
- signal_title: Regulation name or change
- signal_detail: What's changing, when, who's affected, compliance requirements
- signal_url: Link to details

${industryLabel} regulatory changes drive hiring of ${roleStr}.
Return as JSON array.`,

    layoffs_restructure: `Extract all layoff/restructuring announcements from this page. For each:
- company_name: Company making cuts
- company_domain: Their website
- signal_title: Number of jobs affected
- signal_detail: Roles affected, locations, timing, reasons given
- signal_url: Link to announcement

${industryLabel} layoffs = experienced ${roleStr} now available to hire.
Return as JSON array.`,

    new_job: `Extract all job postings from this page. For each job:
- company_name: Company posting the job
- company_domain: Their website domain
- signal_title: Job title
- signal_detail: Location, salary range, contract type, department
- signal_url: Link to apply or view full job
- hiring_manager: If visible, extract hiring manager details as an object:
  - name: Full name of the hiring manager or recruiter
  - job_title: Their job title (e.g. "Talent Acquisition Manager")
  - email: Their email address if shown
  - phone: Their phone number if shown
  - linkedin_url: Their LinkedIn profile URL if linked
  - department: The department they're hiring for

Focus on ${roleStr} roles in ${industryLabel}.
Return as JSON array with hiring_manager as a nested object (or null if not found).`,
  };

  return prompts[signalType] || prompts.company_hiring;
}

// =============================================
// SEARCH EXECUTION
// =============================================

interface SearchResult {
  signals: ExtractedSignal[];
  queriesUsed: string[];
  urlsFound: number;
  urlsScraped: number;
  errors: string[];
}

export async function executeSearch(
  profile: SearchProfile,
  onProgress?: (message: string) => void
): Promise<SearchResult> {
  const queries = generateSearchQueries(profile);
  const allSignals: ExtractedSignal[] = [];
  const urlsScraped = new Set<string>();
  const errors: string[] = [];
  let urlsFound = 0;

  console.log('[Search] ========== SEARCH DEBUG START ==========');
  console.log('[Search] Profile:', JSON.stringify({
    id: profile.id,
    name: profile.name,
    industry: profile.industry,
    locations: profile.locations,
    signal_types: profile.signal_types,
    specific_roles: profile.specific_roles,
  }));
  console.log(`[Search] Generated ${queries.length} queries`);
  if (queries.length > 0) {
    console.log('[Search] First 3 queries:', queries.slice(0, 3).map(q => q.query));
  }

  onProgress?.(`Generated ${queries.length} search queries`);

  for (let i = 0; i < queries.length; i++) {
    const { query, signalType } = queries[i];
    onProgress?.(`Searching (${i + 1}/${queries.length}): ${query.slice(0, 50)}...`);

    try {
      // Use Firecrawl search with timeout protection
      console.log(`[Search] Query ${i + 1}/${queries.length}: "${query}"`);
      const searchResults = await withTimeout(
        firecrawl.search(query, { limit: 5 }),
        10000,
        'Search timed out after 10s'
      );

      // Log raw response structure
      console.log(`[Search] Raw response type: ${typeof searchResults}`);
      console.log(`[Search] Raw response keys:`, searchResults ? Object.keys(searchResults) : 'null');
      console.log(`[Search] Raw response (first 800 chars):`, JSON.stringify(searchResults).slice(0, 800));

      // Firecrawl v2 returns { success: true, data: [...] }
      // or could return { web: [...] } or just an array
      type FirecrawlResult = { url: string; title?: string; markdown?: string };
      let results: FirecrawlResult[] = [];

      if (Array.isArray(searchResults)) {
        results = searchResults;
        console.log(`[Search] Response is array with ${results.length} items`);
      } else if (searchResults && typeof searchResults === 'object') {
        const sr = searchResults as {
          success?: boolean;
          data?: FirecrawlResult[];
          web?: FirecrawlResult[];
          results?: FirecrawlResult[];
        };
        results = sr.data || sr.web || sr.results || [];
        console.log(`[Search] Response is object. success=${sr.success}, found ${results.length} results`);
      }

      if (results.length > 0) {
        console.log(`[Search] First result URL: ${results[0].url}`);
      }

      if (!results || results.length === 0) {
        errors.push(`No results for: ${query.slice(0, 50)}...`);
        continue;
      }

      urlsFound += results.length;

      // Scrape top result from each query (limit for speed)
      for (const result of results.slice(0, 1)) {
        if (urlsScraped.has(result.url)) continue;

        if (profile.excluded_keywords.some(kw =>
          result.url.toLowerCase().includes(kw.toLowerCase())
        )) {
          continue;
        }

        urlsScraped.add(result.url);

        try {
          onProgress?.(`Extracting from: ${result.url.slice(0, 50)}...`);

          const prompt = getExtractionPrompt(
            signalType,
            profile.industry,
            profile.specific_roles
          );

          console.log(`[Search] Scraping URL: ${result.url}`);
          const scrapeResult = await withTimeout(
            firecrawl.scrape(result.url, {
            formats: [
              {
                type: 'json',
                prompt: prompt,
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
                          hiring_manager: {
                            type: 'object',
                            properties: {
                              name: { type: 'string' },
                              job_title: { type: 'string' },
                              email: { type: 'string' },
                              phone: { type: 'string' },
                              linkedin_url: { type: 'string' },
                              department: { type: 'string' },
                            },
                            nullable: true,
                          },
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
            'Scrape timed out after 15s'
          );

          console.log(`[Search] Scrape response keys:`, Object.keys(scrapeResult));
          console.log(`[Search] Scrape json:`, JSON.stringify(scrapeResult.json).slice(0, 500));

          const jsonResult = scrapeResult.json as { signals?: ExtractedSignal[] } | undefined;
          if (jsonResult?.signals) {
            const extracted = Array.isArray(jsonResult.signals)
              ? jsonResult.signals
              : [];

            console.log(`[Search] Extracted ${extracted.length} signals from ${result.url}`);

            for (const signal of extracted) {
              if (signal.company_name && signal.signal_title) {
                allSignals.push({
                  company_name: signal.company_name,
                  company_domain: cleanDomain(signal.company_domain),
                  signal_title: signal.signal_title,
                  signal_detail: signal.signal_detail || '',
                  signal_url: signal.signal_url || result.url,
                });
              }
            }
          } else {
            console.log(`[Search] No signals in scrape response for ${result.url}`);
          }
        } catch (scrapeError) {
          console.log(`[Search] Scrape error for ${result.url}:`, scrapeError);
          continue;
        }

        // Short delay between scrapes
        await sleep(500);
      }
    } catch (searchError) {
      console.error(`[Search] Error for query "${query}":`, searchError);
      errors.push(`Search failed: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`);
    }

    // Short delay between queries
    await sleep(500);
  }

  const uniqueSignals = deduplicateSignals(allSignals);

  console.log('[Search] ========== SEARCH DEBUG END ==========');
  console.log('[Search] Summary:', {
    queriesRun: queries.length,
    urlsFound,
    urlsScraped: urlsScraped.size,
    signalsExtracted: allSignals.length,
    uniqueSignals: uniqueSignals.length,
    errors: errors.length,
  });
  if (errors.length > 0) {
    console.log('[Search] Errors:', errors.slice(0, 5));
  }

  onProgress?.(`Found ${uniqueSignals.length} unique signals`);

  return {
    signals: uniqueSignals,
    queriesUsed: queries.map(q => q.query),
    urlsFound,
    urlsScraped: urlsScraped.size,
    errors,
  };
}

// =============================================
// FULL SEARCH RUN (with database)
// =============================================

export async function runSearch(
  profileId: string,
  userId: string,
  onProgress?: (message: string) => void
): Promise<{ searchRun: SearchRun; newSignals: number }> {
  const supabase = createAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from('search_profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (profileError || !profile) {
    throw new Error('Search profile not found');
  }

  const { data: searchRun, error: runError } = await supabase
    .from('search_runs')
    .insert({
      user_id: userId,
      search_profile_id: profileId,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (runError || !searchRun) {
    throw new Error('Failed to create search run');
  }

  try {
    const result = await executeSearch(profile as SearchProfile, onProgress);
    console.log(`[Search] executeSearch returned ${result.signals.length} signals`);

    // Table uses 'hash' column, not 'fingerprint', and has no user_id column
    const { data: existingSignals, error: existingError } = await supabase
      .from('signals')
      .select('hash')
      .eq('source_type', 'search');

    if (existingError) {
      console.error('[Search] Error fetching existing signals:', existingError);
    }
    console.log(`[Search] Found ${existingSignals?.length || 0} existing signals`);

    const existingHashes = new Set(
      existingSignals?.map(s => s.hash).filter(Boolean) || []
    );

    const newSignals = result.signals.filter(signal => {
      const hash = generateFingerprint(signal);
      return !existingHashes.has(hash);
    });
    console.log(`[Search] After dedup: ${newSignals.length} new signals`);

    if (newSignals.length > 0) {
      console.log(`[Search] Inserting ${newSignals.length} new signals to database...`);
      const signalsToInsert = newSignals.map(signal => ({
        // Match actual Supabase schema - only include columns that exist
        source_type: 'search',
        search_run_id: searchRun.id,
        signal_type: detectSignalType(signal, profile.signal_types),
        company_name: signal.company_name,
        company_domain: signal.company_domain,
        signal_title: signal.signal_title,
        signal_detail: signal.signal_detail,
        signal_url: signal.signal_url,
        location: profile.locations[0] || null,
        industry: profile.industry,
        hash: generateFingerprint(signal),
        detected_at: new Date().toISOString(),
        is_new: true,
      }));

      console.log('[Search] First signal to insert:', JSON.stringify(signalsToInsert[0]));
      console.log('[Search] All signal types to insert:', signalsToInsert.map(s => s.signal_type));

      const { data: insertedData, error: insertError } = await supabase
        .from('signals')
        .insert(signalsToInsert)
        .select();

      if (insertError) {
        console.error('[Search] CRITICAL - Insert failed:', JSON.stringify(insertError));
        console.error('[Search] Insert error code:', insertError.code);
        console.error('[Search] Insert error details:', insertError.details);
        console.error('[Search] Insert error hint:', insertError.hint);
        console.error('[Search] Signal type attempted:', signalsToInsert[0]?.signal_type);
        console.error('[Search] Profile signal_types:', profile.signal_types);
      } else {
        console.log(`[Search] Successfully inserted ${insertedData?.length || 0} signals to database`);
      }
    } else {
      console.log('[Search] No new signals to insert (all duplicates or none found)');
    }

    await supabase
      .from('search_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        queries_used: result.queriesUsed,
        signal_types_searched: profile.signal_types,
        locations_searched: profile.locations,
        urls_found: result.urlsFound,
        urls_scraped: result.urlsScraped,
        signals_found: result.signals.length,
        new_signals: newSignals.length,
      })
      .eq('id', searchRun.id);

    const { data: updatedRun } = await supabase
      .from('search_runs')
      .select('*')
      .eq('id', searchRun.id)
      .single();

    return {
      searchRun: updatedRun as SearchRun,
      newSignals: newSignals.length,
    };

  } catch (error) {
    await supabase
      .from('search_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', searchRun.id);

    throw error;
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function cleanDomain(domain: string | undefined): string {
  if (!domain) return '';
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .split('/')[0]
    .toLowerCase();
}

function generateFingerprint(signal: ExtractedSignal): string {
  const str = `${signal.company_name}|${signal.signal_title}|${signal.signal_url}`.toLowerCase();
  return Buffer.from(str).toString('base64').slice(0, 64);
}

function deduplicateSignals(signals: ExtractedSignal[]): ExtractedSignal[] {
  const seen = new Set<string>();
  return signals.filter(signal => {
    const key = `${signal.company_name}|${signal.signal_title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectSignalType(signal: ExtractedSignal, allowedTypes: string[]): string {
  const text = `${signal.signal_title} ${signal.signal_detail}`.toLowerCase();

  // Job postings detection (common patterns from job boards like Indeed)
  if (text.includes('engineer') || text.includes('developer') || text.includes('manager') ||
      text.includes('analyst') || text.includes('designer') || text.includes('permanent') ||
      text.includes('salary') || text.includes('remote') || text.includes('hybrid') ||
      text.includes('£') || text.includes('hiring') || text.includes('job')) {
    if (allowedTypes.includes('new_job')) return 'new_job';
    if (allowedTypes.includes('company_hiring')) return 'company_hiring';
  }

  if (text.includes('contract') || text.includes('tender') || text.includes('awarded')) {
    return allowedTypes.includes('contract_awarded') ? 'contract_awarded' : allowedTypes[0];
  }
  if (text.includes('planning') || text.includes('permission') || text.includes('approved')) {
    return allowedTypes.includes('planning_approved') ? 'planning_approved' : allowedTypes[0];
  }
  if (text.includes('funding') || text.includes('series') || text.includes('investment') || text.includes('raised')) {
    return allowedTypes.includes('funding_announced') ? 'funding_announced' : allowedTypes[0];
  }
  if (text.includes('expansion') || text.includes('new office') || text.includes('opening') || text.includes('facility')) {
    return allowedTypes.includes('company_expansion') ? 'company_expansion' : allowedTypes[0];
  }
  if (text.includes('appointed') || text.includes('ceo') || text.includes('director') || text.includes('joins')) {
    return allowedTypes.includes('leadership_change') ? 'leadership_change' : allowedTypes[0];
  }
  if (text.includes('cqc') || text.includes('rating') || text.includes('inspection')) {
    return allowedTypes.includes('cqc_rating_change') ? 'cqc_rating_change' : allowedTypes[0];
  }
  if (text.includes('redundan') || text.includes('layoff') || text.includes('restructur') || text.includes('job cuts')) {
    return allowedTypes.includes('layoffs_restructure') ? 'layoffs_restructure' : allowedTypes[0];
  }
  if (text.includes('acqui') || text.includes('merger') || text.includes('buyout') || text.includes('takeover')) {
    return allowedTypes.includes('acquisition_merger') ? 'acquisition_merger' : allowedTypes[0];
  }

  // Default to first allowed type or new_job for job-like content
  return allowedTypes[0] || 'new_job';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
