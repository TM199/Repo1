/**
 * SIC Code to Industry Mapping
 *
 * Maps UK Standard Industrial Classification (SIC) codes to human-readable industry names.
 * Source: https://www.gov.uk/government/publications/standard-industrial-classification-of-economic-activities-sic
 */

// Major SIC code sections (first 2 digits)
const SIC_SECTIONS: Record<string, string> = {
  '01': 'Agriculture',
  '02': 'Forestry',
  '03': 'Fishing',
  '05': 'Mining - Coal',
  '06': 'Oil & Gas',
  '07': 'Mining - Metal Ores',
  '08': 'Mining - Other',
  '09': 'Mining Support Services',
  '10': 'Food Products',
  '11': 'Beverages',
  '12': 'Tobacco',
  '13': 'Textiles',
  '14': 'Clothing',
  '15': 'Leather Goods',
  '16': 'Wood Products',
  '17': 'Paper Products',
  '18': 'Printing & Media',
  '19': 'Petroleum Products',
  '20': 'Chemicals',
  '21': 'Pharmaceuticals',
  '22': 'Rubber & Plastics',
  '23': 'Non-Metallic Minerals',
  '24': 'Basic Metals',
  '25': 'Fabricated Metals',
  '26': 'Electronics',
  '27': 'Electrical Equipment',
  '28': 'Machinery',
  '29': 'Motor Vehicles',
  '30': 'Transport Equipment',
  '31': 'Furniture',
  '32': 'Other Manufacturing',
  '33': 'Repair & Installation',
  '35': 'Energy & Utilities',
  '36': 'Water Supply',
  '37': 'Sewerage',
  '38': 'Waste Management',
  '39': 'Remediation',
  '41': 'Building Construction',
  '42': 'Civil Engineering',
  '43': 'Specialised Construction',
  '45': 'Motor Trade',
  '46': 'Wholesale Trade',
  '47': 'Retail Trade',
  '49': 'Land Transport',
  '50': 'Water Transport',
  '51': 'Air Transport',
  '52': 'Warehousing & Logistics',
  '53': 'Postal & Courier',
  '55': 'Accommodation',
  '56': 'Food & Beverage Services',
  '58': 'Publishing',
  '59': 'Film & TV Production',
  '60': 'Broadcasting',
  '61': 'Telecommunications',
  '62': 'Computer Programming',
  '63': 'Information Services',
  '64': 'Financial Services',
  '65': 'Insurance',
  '66': 'Financial Auxiliaries',
  '68': 'Real Estate',
  '69': 'Legal & Accounting',
  '70': 'Management Consultancy',
  '71': 'Architecture & Engineering',
  '72': 'Scientific R&D',
  '73': 'Advertising & Marketing',
  '74': 'Professional Services',
  '75': 'Veterinary',
  '77': 'Rental & Leasing',
  '78': 'Employment Services',
  '79': 'Travel & Tourism',
  '80': 'Security Services',
  '81': 'Facilities Management',
  '82': 'Business Support',
  '84': 'Public Administration',
  '85': 'Education',
  '86': 'Healthcare',
  '87': 'Residential Care',
  '88': 'Social Work',
  '90': 'Creative Arts',
  '91': 'Libraries & Museums',
  '92': 'Gambling',
  '93': 'Sports & Recreation',
  '94': 'Membership Organisations',
  '95': 'Repair Services',
  '96': 'Personal Services',
  '97': 'Household Employment',
  '98': 'Household Production',
  '99': 'International Organisations',
};

// More specific mappings for common tech/business SIC codes
const SPECIFIC_SIC_CODES: Record<string, string> = {
  '62011': 'Software Development',
  '62012': 'Software Publishing',
  '62020': 'IT Consulting',
  '62090': 'IT Services',
  '63110': 'Data Processing',
  '63120': 'Web Portals',
  '70100': 'Holding Companies',
  '70210': 'PR & Communications',
  '70229': 'Management Consultancy',
  '73110': 'Advertising Agencies',
  '73120': 'Media Representation',
  '73200': 'Market Research',
  '64110': 'Banking',
  '64191': 'Banks',
  '64192': 'Building Societies',
  '64205': 'Financial Holding',
  '64209': 'Other Holding',
  '64301': 'Investment Trusts',
  '64302': 'Unit Trusts',
  '64303': 'Venture Capital',
  '64304': 'Open-ended Funds',
  '64305': 'Property Unit Trusts',
  '64306': 'Real Estate Funds',
  '64910': 'Financial Leasing',
  '64921': 'Mortgage Finance',
  '64922': 'Other Credit',
  '64929': 'Credit Granting',
  '64991': 'Security Dealing',
  '64992': 'Investment Activities',
  '64999': 'Other Financial',
  '65110': 'Life Insurance',
  '65120': 'Non-Life Insurance',
  '65201': 'Life Reinsurance',
  '65202': 'Non-Life Reinsurance',
  '65300': 'Pension Funding',
  '66110': 'Securities Administration',
  '66120': 'Securities Broking',
  '66190': 'Financial Auxiliaries',
  '66210': 'Risk Evaluation',
  '66220': 'Insurance Agencies',
  '66290': 'Insurance Auxiliaries',
  '66300': 'Fund Management',
  '68100': 'Real Estate Purchase',
  '68201': 'Residential Letting',
  '68202': 'Commercial Letting',
  '68209': 'Other Letting',
  '68310': 'Real Estate Agencies',
  '68320': 'Property Management',
  '69101': 'Barristers',
  '69102': 'Solicitors',
  '69109': 'Legal Services',
  '69201': 'Accountancy',
  '69202': 'Bookkeeping',
  '69203': 'Tax Consultancy',
  '71111': 'Architectural',
  '71112': 'Urban Planning',
  '71121': 'Engineering Consulting',
  '71122': 'Engineering Design',
  '71129': 'Technical Consulting',
  '71200': 'Technical Testing',
  '72110': 'Biotech R&D',
  '72190': 'Scientific R&D',
  '72200': 'Social Science R&D',
  '74100': 'Design',
  '74201': 'Photography',
  '74202': 'Film Photography',
  '74209': 'Photography Services',
  '74300': 'Translation',
  '74901': 'Environmental Consulting',
  '74902': 'Quantity Surveying',
  '74909': 'Professional Services',
  '82110': 'Business Admin',
  '82190': 'Business Support',
  '82200': 'Call Centres',
  '82300': 'Conference Organisation',
  '82911': 'Credit Agencies',
  '82912': 'Debt Collection',
  '82920': 'Packaging',
  '82990': 'Business Services',
  '85100': 'Pre-Primary Education',
  '85200': 'Primary Education',
  '85310': 'Secondary Education',
  '85320': 'Technical Education',
  '85410': 'Post-Secondary Education',
  '85421': 'University Education',
  '85422': 'Higher Education',
  '85510': 'Sports Education',
  '85520': 'Cultural Education',
  '85530': 'Driving Schools',
  '85590': 'Other Education',
  '85600': 'Education Support',
  '86101': 'Hospitals (NHS)',
  '86102': 'Hospitals (Private)',
  '86210': 'GP Practices',
  '86220': 'Specialist Practice',
  '86230': 'Dental Practice',
  '86900': 'Healthcare Services',
};

/**
 * Get industry name from SIC code
 * Returns the most specific match available
 */
export function getIndustryFromSicCode(sicCode: string): string | null {
  if (!sicCode) return null;

  // Clean the code - remove any non-numeric characters
  const cleanCode = sicCode.replace(/\D/g, '');

  // Try exact match first
  if (SPECIFIC_SIC_CODES[cleanCode]) {
    return SPECIFIC_SIC_CODES[cleanCode];
  }

  // Try first 5 digits
  if (cleanCode.length >= 5 && SPECIFIC_SIC_CODES[cleanCode.substring(0, 5)]) {
    return SPECIFIC_SIC_CODES[cleanCode.substring(0, 5)];
  }

  // Fall back to section (first 2 digits)
  const section = cleanCode.substring(0, 2);
  if (SIC_SECTIONS[section]) {
    return SIC_SECTIONS[section];
  }

  return null;
}

/**
 * Get industry from multiple SIC codes
 * Returns the first non-null industry match
 */
export function getIndustryFromSicCodes(sicCodes: string[]): string | null {
  if (!sicCodes || sicCodes.length === 0) return null;

  for (const code of sicCodes) {
    const industry = getIndustryFromSicCode(code);
    if (industry) return industry;
  }

  return null;
}

/**
 * Get all matching industries for a set of SIC codes
 * Useful for displaying multiple industry tags
 */
export function getAllIndustriesFromSicCodes(sicCodes: string[]): string[] {
  if (!sicCodes || sicCodes.length === 0) return [];

  const industries = new Set<string>();
  for (const code of sicCodes) {
    const industry = getIndustryFromSicCode(code);
    if (industry) industries.add(industry);
  }

  return Array.from(industries);
}
