// lib/signal-mapping.ts

import { SignalType, Seniority } from '@/types';

// =============================================
// INDUSTRIES
// =============================================

export const INDUSTRIES = [
  { value: 'construction', label: 'Construction & Infrastructure' },
  { value: 'healthcare', label: 'Healthcare & Life Sciences' },
  { value: 'technology', label: 'Technology & Software' },
  { value: 'manufacturing', label: 'Manufacturing & Engineering' },
  { value: 'finance', label: 'Financial Services' },
  { value: 'energy', label: 'Energy & Utilities' },
  { value: 'logistics', label: 'Logistics & Supply Chain' },
  { value: 'property', label: 'Property & Real Estate' },
  { value: 'retail', label: 'Retail & Consumer' },
  { value: 'education', label: 'Education' },
  { value: 'legal', label: 'Legal & Professional Services' },
  { value: 'hospitality', label: 'Hospitality & Leisure' },
] as const;

export type IndustryValue = typeof INDUSTRIES[number]['value'];

// =============================================
// ROLE CATEGORIES BY INDUSTRY
// =============================================

export interface RoleCategory {
  category: string;
  roles: string[];
  seniority: Seniority;
}

export const ROLE_CATEGORIES: Record<string, RoleCategory[]> = {
  construction: [
    {
      category: 'Site Operations',
      roles: ['Site Manager', 'Site Engineer', 'Site Supervisor', 'Foreman', 'General Foreman', 'Site Agent'],
      seniority: 'mid'
    },
    {
      category: 'Project Management',
      roles: ['Project Manager', 'Senior Project Manager', 'Project Director', 'Programme Manager', 'Planning Manager', 'Contracts Manager'],
      seniority: 'senior'
    },
    {
      category: 'Commercial',
      roles: ['Quantity Surveyor', 'Senior QS', 'Commercial Manager', 'Commercial Director', 'Estimator', 'Bid Manager', 'Cost Manager'],
      seniority: 'mid'
    },
    {
      category: 'Design & Technical',
      roles: ['Design Manager', 'Technical Manager', 'BIM Manager', 'BIM Coordinator', 'CAD Technician', 'Architect', 'Structural Engineer'],
      seniority: 'mid'
    },
    {
      category: 'Health & Safety',
      roles: ['Health & Safety Manager', 'SHEQ Manager', 'HSE Advisor', 'CDM Coordinator', 'Safety Officer', 'Environmental Manager'],
      seniority: 'mid'
    },
    {
      category: 'Executive',
      roles: ['Construction Director', 'Operations Director', 'Managing Director', 'Regional Director', 'Divisional Director', 'CEO'],
      seniority: 'executive'
    },
    {
      category: 'Trades & Labour',
      roles: ['Electrician', 'Plumber', 'Carpenter', 'Joiner', 'Steel Fixer', 'Plant Operator', 'Groundworker', 'Bricklayer', 'Scaffolder'],
      seniority: 'junior'
    },
    {
      category: 'M&E',
      roles: ['M&E Manager', 'M&E Coordinator', 'Mechanical Engineer', 'Electrical Engineer', 'Building Services Engineer', 'Commissioning Manager'],
      seniority: 'mid'
    },
  ],

  healthcare: [
    {
      category: 'Nursing',
      roles: ['Registered Nurse', 'Senior Staff Nurse', 'Nurse Manager', 'Ward Sister', 'Ward Manager', 'Matron', 'Community Nurse', 'District Nurse', 'Practice Nurse'],
      seniority: 'mid'
    },
    {
      category: 'Care',
      roles: ['Care Assistant', 'Senior Carer', 'Team Leader', 'Care Home Manager', 'Deputy Manager', 'Regional Manager', 'Registered Manager', 'Support Worker'],
      seniority: 'mid'
    },
    {
      category: 'Clinical',
      roles: ['Clinical Director', 'Medical Director', 'Consultant', 'Registrar', 'Junior Doctor', 'GP', 'Specialist Doctor'],
      seniority: 'senior'
    },
    {
      category: 'Allied Health',
      roles: ['Physiotherapist', 'Occupational Therapist', 'Speech Therapist', 'Radiographer', 'Pharmacist', 'Dietitian', 'Podiatrist', 'Paramedic'],
      seniority: 'mid'
    },
    {
      category: 'Mental Health',
      roles: ['Mental Health Nurse', 'RMN', 'Psychologist', 'Clinical Psychologist', 'Psychiatrist', 'Counsellor', 'Therapist', 'Support Worker'],
      seniority: 'mid'
    },
    {
      category: 'Executive',
      roles: ['CEO', 'COO', 'Director of Nursing', 'Director of Operations', 'Director of Care', 'HR Director', 'Finance Director'],
      seniority: 'executive'
    },
    {
      category: 'Admin & Support',
      roles: ['Medical Secretary', 'Practice Manager', 'Healthcare Administrator', 'Ward Clerk', 'Receptionist'],
      seniority: 'junior'
    },
  ],

  technology: [
    {
      category: 'Software Engineering',
      roles: ['Software Engineer', 'Senior Software Engineer', 'Staff Engineer', 'Principal Engineer', 'Engineering Manager', 'Tech Lead', 'Architect'],
      seniority: 'mid'
    },
    {
      category: 'Frontend',
      roles: ['Frontend Developer', 'Frontend Engineer', 'React Developer', 'Vue Developer', 'Angular Developer', 'UI Engineer', 'Frontend Lead'],
      seniority: 'mid'
    },
    {
      category: 'Backend',
      roles: ['Backend Developer', 'Backend Engineer', 'Python Developer', 'Java Developer', 'Node.js Developer', 'Go Developer', 'Ruby Developer', 'PHP Developer'],
      seniority: 'mid'
    },
    {
      category: 'Full Stack',
      roles: ['Full Stack Developer', 'Full Stack Engineer', 'Web Developer', 'Software Developer'],
      seniority: 'mid'
    },
    {
      category: 'Data',
      roles: ['Data Engineer', 'Data Scientist', 'ML Engineer', 'Machine Learning Engineer', 'Data Analyst', 'Analytics Engineer', 'Head of Data', 'AI Engineer'],
      seniority: 'mid'
    },
    {
      category: 'DevOps & Platform',
      roles: ['DevOps Engineer', 'Platform Engineer', 'SRE', 'Site Reliability Engineer', 'Cloud Engineer', 'Infrastructure Engineer', 'Systems Engineer'],
      seniority: 'mid'
    },
    {
      category: 'Security',
      roles: ['Security Engineer', 'Cyber Security Analyst', 'Security Architect', 'Penetration Tester', 'SOC Analyst', 'CISO'],
      seniority: 'mid'
    },
    {
      category: 'Product',
      roles: ['Product Manager', 'Senior Product Manager', 'Product Owner', 'Product Director', 'Head of Product', 'CPO', 'Product Analyst'],
      seniority: 'senior'
    },
    {
      category: 'Design',
      roles: ['UX Designer', 'UI Designer', 'Product Designer', 'UX Researcher', 'Design Lead', 'Head of Design', 'Interaction Designer'],
      seniority: 'mid'
    },
    {
      category: 'QA & Testing',
      roles: ['QA Engineer', 'Test Engineer', 'SDET', 'Test Lead', 'QA Manager', 'Automation Engineer'],
      seniority: 'mid'
    },
    {
      category: 'Executive',
      roles: ['CTO', 'VP Engineering', 'Engineering Director', 'CEO', 'COO', 'CFO', 'Head of Engineering'],
      seniority: 'executive'
    },
  ],

  manufacturing: [
    {
      category: 'Production',
      roles: ['Production Manager', 'Production Supervisor', 'Production Planner', 'Shift Manager', 'Plant Manager', 'Operations Manager', 'Manufacturing Manager'],
      seniority: 'mid'
    },
    {
      category: 'Engineering',
      roles: ['Manufacturing Engineer', 'Process Engineer', 'Maintenance Engineer', 'Tooling Engineer', 'Engineering Manager', 'Continuous Improvement Engineer', 'Lean Engineer'],
      seniority: 'mid'
    },
    {
      category: 'Quality',
      roles: ['Quality Manager', 'Quality Engineer', 'QA Inspector', 'Quality Technician', 'Quality Director', 'QC Manager'],
      seniority: 'mid'
    },
    {
      category: 'Supply Chain',
      roles: ['Supply Chain Manager', 'Procurement Manager', 'Buyer', 'Purchasing Manager', 'Materials Planner', 'Logistics Manager', 'Warehouse Manager'],
      seniority: 'mid'
    },
    {
      category: 'Technical & Design',
      roles: ['Design Engineer', 'R&D Engineer', 'CAD Designer', 'Technical Director', 'Development Engineer', 'Applications Engineer'],
      seniority: 'mid'
    },
    {
      category: 'Health & Safety',
      roles: ['EHS Manager', 'Health & Safety Manager', 'Environmental Manager', 'Safety Officer'],
      seniority: 'mid'
    },
    {
      category: 'Executive',
      roles: ['Operations Director', 'Managing Director', 'Site Director', 'VP Manufacturing', 'General Manager', 'CEO', 'Plant Director'],
      seniority: 'executive'
    },
    {
      category: 'Skilled Trades',
      roles: ['CNC Machinist', 'CNC Programmer', 'Welder', 'Fabricator', 'Fitter', 'Electrician', 'Maintenance Technician', 'Tool Maker'],
      seniority: 'junior'
    },
  ],

  finance: [
    {
      category: 'Accounting',
      roles: ['Accountant', 'Senior Accountant', 'Financial Accountant', 'Management Accountant', 'Finance Manager', 'Financial Controller', 'Group Accountant'],
      seniority: 'mid'
    },
    {
      category: 'Audit & Tax',
      roles: ['Auditor', 'Senior Auditor', 'Audit Manager', 'Tax Advisor', 'Tax Manager', 'Internal Auditor'],
      seniority: 'mid'
    },
    {
      category: 'Banking & Investment',
      roles: ['Relationship Manager', 'Credit Analyst', 'Investment Analyst', 'Portfolio Manager', 'Trader', 'Fund Manager', 'Wealth Manager', 'Private Banker'],
      seniority: 'mid'
    },
    {
      category: 'Compliance & Risk',
      roles: ['Compliance Officer', 'Compliance Manager', 'Risk Manager', 'Risk Analyst', 'AML Analyst', 'Financial Crime Analyst', 'Compliance Director', 'Head of Risk'],
      seniority: 'senior'
    },
    {
      category: 'FinTech',
      roles: ['Product Manager', 'Software Engineer', 'Data Scientist', 'Growth Manager', 'Head of Product', 'CTO'],
      seniority: 'mid'
    },
    {
      category: 'Insurance',
      roles: ['Underwriter', 'Claims Handler', 'Actuary', 'Insurance Broker', 'Account Executive'],
      seniority: 'mid'
    },
    {
      category: 'Executive',
      roles: ['CFO', 'Finance Director', 'Head of Finance', 'Financial Controller', 'VP Finance', 'CEO', 'Managing Director'],
      seniority: 'executive'
    },
  ],

  energy: [
    {
      category: 'Renewables',
      roles: ['Wind Turbine Technician', 'Solar Engineer', 'Solar Installer', 'Renewables Project Manager', 'Energy Analyst', 'Sustainability Manager', 'Wind Farm Manager'],
      seniority: 'mid'
    },
    {
      category: 'Oil & Gas',
      roles: ['Drilling Engineer', 'Reservoir Engineer', 'Production Engineer', 'HSE Manager', 'Project Engineer', 'Operations Manager', 'Petroleum Engineer'],
      seniority: 'mid'
    },
    {
      category: 'Nuclear',
      roles: ['Nuclear Engineer', 'Radiation Protection Advisor', 'Safety Case Engineer', 'Project Manager', 'Mechanical Engineer', 'Electrical Engineer', 'Decommissioning Manager'],
      seniority: 'senior'
    },
    {
      category: 'Utilities',
      roles: ['Network Engineer', 'Field Technician', 'Planning Engineer', 'Asset Manager', 'Grid Engineer', 'Metering Technician'],
      seniority: 'mid'
    },
    {
      category: 'Executive',
      roles: ['Operations Director', 'Technical Director', 'Head of Projects', 'Managing Director', 'CEO', 'Commercial Director'],
      seniority: 'executive'
    },
  ],

  logistics: [
    {
      category: 'Warehouse',
      roles: ['Warehouse Manager', 'Warehouse Supervisor', 'Warehouse Team Leader', 'Stock Controller', 'Inventory Manager', 'Shift Manager', 'Operations Manager', 'Warehouse Operative'],
      seniority: 'mid'
    },
    {
      category: 'Transport',
      roles: ['Transport Manager', 'Fleet Manager', 'Transport Planner', 'Route Planner', 'HGV Driver', 'Van Driver', 'Driver Trainer', 'Traffic Office Manager'],
      seniority: 'mid'
    },
    {
      category: 'Supply Chain',
      roles: ['Supply Chain Manager', 'Logistics Manager', 'Demand Planner', 'Supply Planner', 'Procurement Manager', 'Purchasing Manager', 'Category Manager'],
      seniority: 'senior'
    },
    {
      category: 'Import/Export',
      roles: ['Import/Export Manager', 'Customs Specialist', 'Freight Forwarder', 'Shipping Coordinator', 'Trade Compliance Manager'],
      seniority: 'mid'
    },
    {
      category: 'Executive',
      roles: ['Operations Director', 'Supply Chain Director', 'Logistics Director', 'Managing Director', 'CEO', 'COO'],
      seniority: 'executive'
    },
  ],

  property: [
    {
      category: 'Agency',
      roles: ['Estate Agent', 'Senior Negotiator', 'Sales Negotiator', 'Lettings Negotiator', 'Branch Manager', 'Area Manager', 'Lettings Manager', 'Valuer'],
      seniority: 'mid'
    },
    {
      category: 'Property Management',
      roles: ['Property Manager', 'Building Manager', 'Facilities Manager', 'Block Manager', 'Asset Manager', 'Portfolio Manager', 'Estate Manager'],
      seniority: 'mid'
    },
    {
      category: 'Development',
      roles: ['Development Manager', 'Land Manager', 'Land Buyer', 'Planning Manager', 'Project Manager', 'Development Surveyor'],
      seniority: 'senior'
    },
    {
      category: 'Surveying',
      roles: ['Building Surveyor', 'Chartered Surveyor', 'Quantity Surveyor', 'Commercial Surveyor', 'Residential Surveyor'],
      seniority: 'mid'
    },
    {
      category: 'Investment',
      roles: ['Investment Manager', 'Fund Manager', 'Acquisitions Manager', 'Investment Analyst', 'Asset Manager'],
      seniority: 'senior'
    },
    {
      category: 'Executive',
      roles: ['Managing Director', 'Development Director', 'Investment Director', 'Head of Asset Management', 'CEO', 'Commercial Director'],
      seniority: 'executive'
    },
  ],

  retail: [
    {
      category: 'Store Operations',
      roles: ['Store Manager', 'Assistant Manager', 'Department Manager', 'Supervisor', 'Team Leader', 'Retail Assistant'],
      seniority: 'mid'
    },
    {
      category: 'Buying & Merchandising',
      roles: ['Buyer', 'Senior Buyer', 'Merchandiser', 'Merchandise Planner', 'Category Manager', 'Head of Buying'],
      seniority: 'mid'
    },
    {
      category: 'E-commerce',
      roles: ['E-commerce Manager', 'Digital Manager', 'Online Trading Manager', 'Content Manager', 'SEO Manager'],
      seniority: 'mid'
    },
    {
      category: 'Executive',
      roles: ['Retail Director', 'Operations Director', 'Commercial Director', 'CEO', 'Managing Director'],
      seniority: 'executive'
    },
  ],

  education: [
    {
      category: 'Teaching',
      roles: ['Teacher', 'Senior Teacher', 'Head of Department', 'Head of Year', 'SENCO', 'Teaching Assistant', 'Lecturer'],
      seniority: 'mid'
    },
    {
      category: 'Leadership',
      roles: ['Headteacher', 'Deputy Head', 'Assistant Head', 'Principal', 'Vice Principal', 'Academy Director'],
      seniority: 'executive'
    },
    {
      category: 'Support',
      roles: ['School Business Manager', 'Bursar', 'Office Manager', 'Exams Officer', 'Admissions Officer'],
      seniority: 'mid'
    },
  ],

  legal: [
    {
      category: 'Solicitors',
      roles: ['Solicitor', 'Senior Solicitor', 'Associate', 'Senior Associate', 'Partner', 'Legal Director', 'Managing Partner'],
      seniority: 'mid'
    },
    {
      category: 'Support',
      roles: ['Paralegal', 'Legal Secretary', 'Legal Assistant', 'Legal Executive', 'Trainee Solicitor'],
      seniority: 'junior'
    },
    {
      category: 'In-House',
      roles: ['Legal Counsel', 'Senior Legal Counsel', 'General Counsel', 'Head of Legal', 'Company Secretary'],
      seniority: 'senior'
    },
  ],

  hospitality: [
    {
      category: 'Hotel',
      roles: ['General Manager', 'Hotel Manager', 'Front Office Manager', 'Reservations Manager', 'Revenue Manager', 'Duty Manager', 'Concierge'],
      seniority: 'mid'
    },
    {
      category: 'Food & Beverage',
      roles: ['Restaurant Manager', 'F&B Manager', 'Head Chef', 'Sous Chef', 'Chef de Partie', 'Bar Manager', 'Sommelier'],
      seniority: 'mid'
    },
    {
      category: 'Events',
      roles: ['Events Manager', 'Conference Manager', 'Banqueting Manager', 'Wedding Coordinator'],
      seniority: 'mid'
    },
    {
      category: 'Executive',
      roles: ['Operations Director', 'Regional Manager', 'Area Manager', 'CEO', 'Managing Director'],
      seniority: 'executive'
    },
  ],
};

// =============================================
// LOCATIONS (UK)
// =============================================

export interface LocationConfig {
  value: string;
  label: string;
  searchTerms: string[];
}

export const LOCATIONS: LocationConfig[] = [
  { value: 'uk_all', label: 'All UK', searchTerms: ['UK', 'United Kingdom', 'Britain', 'British'] },
  { value: 'london', label: 'London', searchTerms: ['London', 'City of London', 'Greater London', 'Central London'] },
  { value: 'south_east', label: 'South East', searchTerms: ['South East', 'Surrey', 'Kent', 'Sussex', 'Hampshire', 'Berkshire', 'Oxford', 'Oxfordshire', 'Brighton', 'Reading', 'Milton Keynes'] },
  { value: 'south_west', label: 'South West', searchTerms: ['South West', 'Bristol', 'Bath', 'Devon', 'Cornwall', 'Somerset', 'Dorset', 'Gloucestershire', 'Exeter', 'Plymouth', 'Swindon'] },
  { value: 'east_anglia', label: 'East of England', searchTerms: ['East Anglia', 'East of England', 'Cambridge', 'Cambridgeshire', 'Norfolk', 'Suffolk', 'Essex', 'Hertfordshire', 'Norwich', 'Ipswich', 'Peterborough'] },
  { value: 'west_midlands', label: 'West Midlands', searchTerms: ['West Midlands', 'Birmingham', 'Coventry', 'Wolverhampton', 'Solihull', 'Dudley', 'Walsall', 'Warwickshire'] },
  { value: 'east_midlands', label: 'East Midlands', searchTerms: ['East Midlands', 'Nottingham', 'Nottinghamshire', 'Leicester', 'Leicestershire', 'Derby', 'Derbyshire', 'Northampton', 'Lincoln'] },
  { value: 'north_west', label: 'North West', searchTerms: ['North West', 'Manchester', 'Greater Manchester', 'Liverpool', 'Merseyside', 'Chester', 'Cheshire', 'Preston', 'Lancashire', 'Bolton', 'Warrington'] },
  { value: 'north_east', label: 'North East', searchTerms: ['North East', 'Newcastle', 'Newcastle upon Tyne', 'Tyneside', 'Sunderland', 'Durham', 'Middlesbrough', 'Teesside', 'Gateshead'] },
  { value: 'yorkshire', label: 'Yorkshire & Humber', searchTerms: ['Yorkshire', 'Yorkshire and Humber', 'Leeds', 'Sheffield', 'Bradford', 'York', 'Hull', 'Doncaster', 'Wakefield', 'Huddersfield', 'South Yorkshire', 'West Yorkshire'] },
  { value: 'scotland', label: 'Scotland', searchTerms: ['Scotland', 'Scottish', 'Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness', 'Highlands'] },
  { value: 'wales', label: 'Wales', searchTerms: ['Wales', 'Welsh', 'Cardiff', 'Swansea', 'Newport', 'Wrexham'] },
  { value: 'northern_ireland', label: 'Northern Ireland', searchTerms: ['Northern Ireland', 'Belfast', 'Derry', 'Londonderry'] },
];

// =============================================
// SIGNAL TYPES
// =============================================

export interface SignalTypeConfig {
  value: SignalType;
  label: string;
  description: string;
  icon: string;
  relevantIndustries: string[];
  relevantSeniorities: Seniority[];
  searchQueryTemplates: string[];
  sources: string[];
}

export const SIGNAL_TYPES_CONFIG: SignalTypeConfig[] = [
  {
    value: 'contract_awarded',
    label: 'Contract Awards',
    description: 'Government and private contracts won by companies',
    icon: '📜',
    relevantIndustries: ['construction', 'healthcare', 'technology', 'manufacturing', 'energy', 'logistics'],
    relevantSeniorities: ['mid', 'senior', 'executive'],
    searchQueryTemplates: [
      '{industry} contract awarded {location} {date}',
      '{industry} tender won {location}',
      'government {industry} contract {location}',
      '{industry} framework agreement awarded {location}',
      '{industry} contract win announcement',
    ],
    sources: ['https://www.contractsfinder.service.gov.uk', 'https://ted.europa.eu'],
  },
  {
    value: 'planning_approved',
    label: 'Planning Approvals',
    description: 'Planning permissions granted for new developments',
    icon: '🏗️',
    relevantIndustries: ['construction', 'property', 'logistics', 'manufacturing', 'retail', 'healthcare'],
    relevantSeniorities: ['mid', 'senior', 'executive'],
    searchQueryTemplates: [
      'planning permission approved {location} {date}',
      'planning application granted {industry} {location}',
      'development approved {location}',
      '{industry} planning consent {location}',
      'planning permission {location} warehouse',
      'planning approved {location} office',
    ],
    sources: [],
  },
  {
    value: 'planning_submitted',
    label: 'Planning Submitted',
    description: 'New planning applications submitted',
    icon: '📋',
    relevantIndustries: ['construction', 'property', 'logistics', 'manufacturing', 'retail'],
    relevantSeniorities: ['mid', 'senior', 'executive'],
    searchQueryTemplates: [
      'planning application submitted {location} {date}',
      'planning submission {industry} {location}',
      'new development proposed {location}',
    ],
    sources: [],
  },
  {
    value: 'funding_announced',
    label: 'Funding Rounds',
    description: 'Companies raising investment (Seed, Series A-D, PE)',
    icon: '💰',
    relevantIndustries: ['technology', 'healthcare', 'finance', 'energy'],
    relevantSeniorities: ['mid', 'senior', 'executive'],
    searchQueryTemplates: [
      '{industry} funding round UK {date}',
      '{industry} startup raises investment {location}',
      '{industry} series A {location}',
      '{industry} series B {location}',
      '{industry} venture capital UK {date}',
      '{industry} company secures funding',
      'UK {industry} investment round {date}',
    ],
    sources: ['https://techcrunch.com', 'https://sifted.eu', 'https://www.uktech.news'],
  },
  {
    value: 'company_expansion',
    label: 'Company Expansions',
    description: 'New offices, facilities, warehouses opening',
    icon: '🏢',
    relevantIndustries: ['construction', 'manufacturing', 'logistics', 'technology', 'retail', 'property', 'healthcare', 'finance', 'energy', 'hospitality'],
    relevantSeniorities: ['mid', 'senior', 'executive'],
    searchQueryTemplates: [
      '{industry} company expansion {location} {date}',
      '{industry} new office {location}',
      '{industry} new facility {location}',
      '{industry} warehouse opening {location}',
      '{industry} factory {location} jobs',
      '{industry} headquarters {location}',
      '{industry} opens {location}',
      'new {industry} jobs {location}',
    ],
    sources: [],
  },
  {
    value: 'leadership_change',
    label: 'Leadership Changes',
    description: 'New CEO, Director, VP appointments',
    icon: '👔',
    relevantIndustries: ['construction', 'healthcare', 'technology', 'manufacturing', 'finance', 'energy', 'logistics', 'property', 'retail', 'education', 'legal', 'hospitality'],
    relevantSeniorities: ['executive'],
    searchQueryTemplates: [
      '{industry} CEO appointed {location} {date}',
      '{industry} new director {location}',
      '{industry} VP appointed',
      '{industry} executive hire {location}',
      '{industry} leadership announcement',
      '{industry} managing director appointed {location}',
      '{industry} board appointment',
    ],
    sources: [],
  },
  {
    value: 'cqc_rating_change',
    label: 'CQC Rating Changes',
    description: 'Care Quality Commission inspection results',
    icon: '⭐',
    relevantIndustries: ['healthcare'],
    relevantSeniorities: ['mid', 'senior', 'executive'],
    searchQueryTemplates: [
      'CQC rating {location} {date}',
      'care home inspection {location}',
      'CQC requires improvement {location}',
      'CQC outstanding {location}',
      'CQC inspection results {date}',
      'care home rating {location}',
    ],
    sources: ['https://www.cqc.org.uk'],
  },
  {
    value: 'new_job',
    label: 'New Job Postings',
    description: 'Individual job postings detected',
    icon: '📄',
    relevantIndustries: ['construction', 'healthcare', 'technology', 'manufacturing', 'finance', 'energy', 'logistics', 'property', 'retail', 'education', 'legal', 'hospitality'],
    relevantSeniorities: ['junior', 'mid', 'senior', 'executive'],
    searchQueryTemplates: [
      '{role_types} vacancy {location}',
      '{role_types} job {location}',
      'hiring {role_types} {location}',
    ],
    sources: [],
  },
];

// =============================================
// HELPER FUNCTIONS
// =============================================

export function getIndustryLabel(value: string): string {
  return INDUSTRIES.find(i => i.value === value)?.label || value;
}

export function getLocationLabel(value: string): string {
  return LOCATIONS.find(l => l.value === value)?.label || value;
}

export function getLocationSearchTerms(values: string[]): string[] {
  const terms: string[] = [];
  for (const value of values) {
    const location = LOCATIONS.find(l => l.value === value);
    if (location) {
      terms.push(...location.searchTerms);
    }
  }
  return [...new Set(terms)];
}

export function getRoleCategories(industry: string): RoleCategory[] {
  return ROLE_CATEGORIES[industry] || [];
}

export function getAllRolesForCategories(industry: string, categories: string[]): string[] {
  const industryRoles = ROLE_CATEGORIES[industry] || [];
  const roles: string[] = [];

  for (const cat of industryRoles) {
    if (categories.includes(cat.category)) {
      roles.push(...cat.roles);
    }
  }

  return roles;
}

export function getSenioritiesForCategories(industry: string, categories: string[]): Seniority[] {
  const industryRoles = ROLE_CATEGORIES[industry] || [];
  const seniorities: Set<Seniority> = new Set();

  for (const cat of industryRoles) {
    if (categories.includes(cat.category)) {
      seniorities.add(cat.seniority);
    }
  }

  return Array.from(seniorities);
}

export function getRelevantSignalTypes(
  industry: string,
  seniorities: Seniority[]
): SignalTypeConfig[] {
  return SIGNAL_TYPES_CONFIG.filter(signal => {
    const industryMatch = signal.relevantIndustries.includes(industry) ||
                          signal.relevantIndustries.includes('all');
    const seniorityMatch = seniorities.length === 0 ||
                           seniorities.some(s => signal.relevantSeniorities.includes(s));

    return industryMatch && seniorityMatch;
  });
}

export function getSignalTypeConfig(value: string): SignalTypeConfig | undefined {
  return SIGNAL_TYPES_CONFIG.find(s => s.value === value);
}
