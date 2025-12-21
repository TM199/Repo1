export type Department =
  | 'engineering'
  | 'sales'
  | 'marketing'
  | 'finance'
  | 'hr'
  | 'operations'
  | 'product'
  | 'design'
  | 'legal'
  | 'customer_success'
  | 'general';

const DEPARTMENT_HIRING_MANAGERS: Record<Department, string[]> = {
  engineering: ['Engineering Manager', 'VP Engineering', 'CTO', 'Tech Lead'],
  sales: ['Sales Director', 'VP Sales', 'Head of Sales', 'Sales Manager'],
  marketing: ['Marketing Director', 'CMO', 'Head of Marketing', 'Marketing Manager'],
  finance: ['Finance Director', 'CFO', 'Financial Controller', 'Head of Finance'],
  hr: ['HR Director', 'Head of People', 'Talent Director', 'CHRO'],
  operations: ['Operations Director', 'COO', 'Head of Operations', 'Ops Manager'],
  product: ['Product Director', 'VP Product', 'Head of Product', 'CPO'],
  design: ['Design Director', 'Head of Design', 'Creative Director', 'UX Director'],
  legal: ['General Counsel', 'Legal Director', 'Head of Legal', 'CLO'],
  customer_success: ['CS Director', 'VP Customer Success', 'Head of CS', 'CS Manager'],
  general: ['CEO', 'Managing Director', 'General Manager', 'Director'],
};

const SIGNAL_TYPE_ROLES: Record<string, string[]> = {
  funding_announced: ['CEO', 'Founder', 'CFO', 'VP Growth', 'VP Sales', 'Head of People'],
  contract_awarded: ['Managing Director', 'Project Director', 'Operations Director', 'Contracts Manager'],
  company_expansion: ['HR Director', 'Operations Director', 'Regional Manager', 'Head of People'],
  leadership_change: [], // Contact is already in the signal (the new leader)
  planning_approved: ['Managing Director', 'Development Director', 'Project Manager'],
  company_hiring: ['HR Director', 'Talent Acquisition Manager', 'Head of People'],
  acquisition_merger: ['CEO', 'CFO', 'Integration Director', 'HR Director'],
  layoffs_restructure: ['HR Director', 'CEO', 'Operations Director'],
  new_job: [], // Special case - detect department from job title
  planning_submitted: ['Managing Director', 'Development Director', 'Project Manager'],
  project_announced: ['Project Director', 'Managing Director', 'Operations Director'],
  cqc_rating_change: ['Registered Manager', 'Operations Director', 'CEO'],
  regulatory_change: ['Compliance Director', 'General Counsel', 'CEO'],
};

// Detect department from job title keywords
export function detectDepartment(jobTitle: string): Department {
  const title = jobTitle.toLowerCase();

  if (/engineer|developer|software|devops|sre|architect|tech lead|cto/i.test(title)) return 'engineering';
  if (/sales|account exec|business develop|bdr|sdr/i.test(title)) return 'sales';
  if (/marketing|growth|brand|content|seo|ppc|cmo/i.test(title)) return 'marketing';
  if (/finance|accountant|cfo|controller|treasury/i.test(title)) return 'finance';
  if (/hr|human resource|people|talent|recruit/i.test(title)) return 'hr';
  if (/operations|ops|supply chain|logistics|coo/i.test(title)) return 'operations';
  if (/product|pm|product manager|cpo/i.test(title)) return 'product';
  if (/design|ux|ui|creative|graphic/i.test(title)) return 'design';
  if (/legal|counsel|compliance|regulatory/i.test(title)) return 'legal';
  if (/customer success|cs|support|client/i.test(title)) return 'customer_success';

  return 'general';
}

// Get target roles to search for based on signal type
export function getTargetRoles(signalType: string, signalTitle?: string): string[] {
  // For job postings, find the hiring manager for that department
  if (signalType === 'new_job' && signalTitle) {
    const department = detectDepartment(signalTitle);
    return DEPARTMENT_HIRING_MANAGERS[department];
  }

  // For other signal types, use predefined roles
  return SIGNAL_TYPE_ROLES[signalType] || SIGNAL_TYPE_ROLES.company_hiring;
}
