export type SignalType =
  | 'new_job'
  | 'planning_submitted'
  | 'planning_approved'
  | 'contract_awarded'
  | 'funding_announced'
  | 'leadership_change'
  | 'cqc_rating_change'
  | 'company_expansion'
  | 'project_announced'
  | 'company_hiring'
  | 'acquisition_merger'
  | 'regulatory_change'
  | 'layoffs_restructure';

export type ScrapeFrequency = 'daily' | 'weekly' | 'monthly';

export type ScrapeStatus = 'success' | 'failed' | 'blocked';

export type SearchRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export type Seniority = 'junior' | 'mid' | 'senior' | 'executive';

export type SourceType = 'scrape' | 'search';

export interface Profile {
  id: string;
  email: string;
  company_name: string | null;
  industry: string | null;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  user_id: string;
  name: string;
  url: string;
  signal_type: SignalType;
  industry: string | null;
  scrape_frequency: ScrapeFrequency;
  is_active: boolean;
  last_scraped_at: string | null;
  created_at: string;
}

export interface Scrape {
  id: string;
  source_id: string;
  scraped_at: string;
  status: ScrapeStatus;
  items_found: number;
  new_items: number;
  error_message: string | null;
}

export interface SearchProfile {
  id: string;
  user_id: string;
  name: string;
  industry: string;
  role_categories: string[];
  specific_roles: string[];
  seniority_levels: Seniority[];
  locations: string[];
  signal_types: string[];
  target_company_types: string | null;
  additional_keywords: string[];
  excluded_keywords: string[];
  notes: string | null;
  is_active: boolean;
  auto_search: boolean;
  search_frequency: string;
  created_at: string;
  updated_at: string;
  // Optional fields (may not exist in DB yet)
  search_count?: number;
  search_breadth?: 'narrow' | 'normal' | 'wide';
  schedule_enabled?: boolean;
  schedule_frequency?: 'daily' | 'weekly' | 'monthly' | null;
  last_scheduled_run?: string | null;
}

export interface SearchRun {
  id: string;
  user_id: string;
  search_profile_id: string | null;
  queries_used: string[];
  signal_types_searched: string[];
  locations_searched: string[];
  urls_found: number;
  urls_scraped: number;
  signals_found: number;
  new_signals: number;
  status: SearchRunStatus;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  run_at: string;
}

export interface Signal {
  id: string;
  source_type: SourceType;
  source_id: string | null;
  search_run_id: string | null;
  signal_type: SignalType;
  company_name: string | null;
  company_domain: string | null;
  signal_title: string | null;
  signal_detail: string | null;
  signal_url: string | null;
  location: string | null;
  industry: string | null;
  detected_at: string;
  is_new: boolean;
  hash: string | null;
  source?: { name: string };
}

export interface UserSettings {
  id: string;
  user_id: string;
  notify_email: boolean;
  email_frequency: 'daily' | 'weekly' | 'monthly';
  notify_url_sources: boolean;
  notify_ai_search: boolean;
  leadmagic_api_key?: string;
  prospeo_api_key?: string;
  enrichment_include_phone?: boolean;
  // HubSpot integration
  hubspot_access_token?: string;
  hubspot_refresh_token?: string;
  hubspot_expires_at?: number;
  created_at: string;
  updated_at: string;
}

export type SeniorityLevel = 'executive' | 'senior' | 'manager' | 'individual' | 'unknown';

export interface SignalContact {
  id: string;
  signal_id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  seniority: SeniorityLevel | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
  enrichment_source: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface ExtractedSignal {
  company_name: string;
  company_domain: string;
  industry?: string;
  signal_title: string;
  signal_detail: string;
  signal_url: string;
}

export interface AgencyAnalysis {
  industries: string[];
  roleTypes: string[];
  focus: ('permanent' | 'contract' | 'temp' | 'mixed')[];
  confidence: number;
  summary: string;
}

// ICP Profile Types
export type ICPSignalType =
  | 'job_pain'           // Stale jobs, reposts, salary increases, referral bonuses
  | 'contracts_awarded'  // Public sector contract wins (Contracts Finder)
  | 'tenders'            // High-value tender awards (Find a Tender)
  | 'planning'           // Planning applications (Planning Data)
  | 'leadership'         // New directors/officers (Companies House)
  | 'funding';           // Funding rounds (Firecrawl)

export type PullFrequency = 'hourly' | 'every_4h' | 'daily' | 'weekly';

export type EmploymentType = 'permanent' | 'contract' | 'both';

export interface ICPProfile {
  id: string;
  user_id: string;
  name: string;

  // Industry & Roles
  industries: string[];
  role_categories: string[];       // e.g., ["Site Operations", "Project Management"]
  specific_roles: string[];
  seniority_levels: string[];
  employment_type: EmploymentType; // Filter by permanent/contract

  // Locations
  locations: string[];

  // Signal Types to Track
  signal_types: ICPSignalType[];

  // Company Filters
  company_size_min: number | null;
  company_size_max: number | null;
  exclude_keywords: string[];

  // Contract/Tender Configuration
  min_contract_value: number | null;
  contract_sectors: string[];
  contract_keywords: string[];

  // Data Pull Configuration
  pull_frequency: PullFrequency;
  is_active: boolean;
  last_synced_at: string | null;

  created_at: string;
  updated_at: string;

  // Scan status (added for queue system)
  scan_status?: 'idle' | 'scanning' | 'expanding' | 'completed' | 'failed';
  scan_batch_id?: string;
  scan_progress?: ScanProgress;

  // API key assignment
  api_key_id?: string;
}

// Scan progress tracking
export interface ScanProgress {
  jobs_found: number;
  companies_found: number;
  signals_generated: number;
  tasks_pending: number;
  tasks_completed: number;
  last_updated: string;
}

// Scan queue task
export type ScanQueueTaskType = 'role_variation' | 'expanded_location' | 'industry_search';
export type ScanQueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface ScanQueueTask {
  id: string;
  icp_profile_id: string;
  batch_id: string;

  task_type: ScanQueueTaskType;
  keywords: string;
  location: string;

  status: ScanQueueStatus;
  priority: number;
  attempts: number;
  max_attempts: number;

  jobs_found: number;
  error_message: string | null;

  created_at: string;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
}

// API usage tracking
export interface ApiUsage {
  id: string;
  api_name: string;
  api_key_id: string | null;
  date: string;
  calls_made: number;
  calls_limit: number;
  last_call_at: string | null;
}

// API key management
export interface ApiKey {
  id: string;
  user_id: string;
  api_name: string;
  api_key_encrypted: string;
  label: string | null;
  daily_limit: number;
  is_active: boolean;
  is_unlimited: boolean;
  created_at: string;
  updated_at: string;
}

// ICP slots info
export interface IcpSlots {
  used: number;
  total: number;
  remaining: number;
}
