/**
 * Role Search Variations
 *
 * Maps specific roles to their common variations/synonyms used in job postings.
 * This ensures Reed API searches find jobs regardless of how the title is written.
 */

export const ROLE_VARIATIONS: Record<string, string[]> = {
  // =============================================
  // CONSTRUCTION
  // =============================================
  'Site Manager': ['Site Mgr', 'Construction Site Manager', 'Building Site Manager', 'Site Management'],
  'Site Engineer': ['Site Eng', 'Construction Site Engineer', 'Building Engineer'],
  'Site Supervisor': ['Site Foreman', 'Construction Supervisor'],
  'Foreman': ['Site Foreman', 'General Foreman', 'Trades Foreman'],
  'Project Manager': ['PM', 'Construction Project Manager', 'Senior PM', 'Project Management'],
  'Senior Project Manager': ['Senior PM', 'Lead Project Manager'],
  'Programme Manager': ['Program Manager', 'Programme Director'],
  'Quantity Surveyor': ['QS', 'Commercial QS', 'Senior QS', 'Quantity Surveying'],
  'Senior QS': ['Senior Quantity Surveyor', 'Lead QS'],
  'Commercial Manager': ['Commercial Mgr', 'Contracts Manager'],
  'Estimator': ['Estimating Manager', 'Senior Estimator', 'Pre-Construction Estimator'],
  'Bid Manager': ['Tender Manager', 'Proposals Manager'],
  'Design Manager': ['Design Mgr', 'Design Coordinator'],
  'BIM Manager': ['BIM Coordinator', 'BIM Lead', 'Digital Construction Manager'],
  'Health & Safety Manager': ['HSE Manager', 'SHEQ Manager', 'H&S Manager', 'Safety Manager'],
  'HSE Advisor': ['Health & Safety Advisor', 'EHS Advisor', 'Safety Advisor'],
  'M&E Manager': ['MEP Manager', 'Building Services Manager', 'Mechanical Electrical Manager'],
  'Mechanical Engineer': ['Mech Engineer', 'Mechanical Eng'],
  'Electrical Engineer': ['Elec Engineer', 'Electrical Eng'],
  'Contracts Manager': ['Contract Manager', 'Commercial Contracts Manager'],

  // =============================================
  // TECHNOLOGY
  // =============================================
  'Software Engineer': ['Software Developer', 'SWE', 'Programmer', 'Developer'],
  'Senior Software Engineer': ['Senior Developer', 'Senior SWE', 'Lead Developer'],
  'Staff Engineer': ['Staff Software Engineer', 'Principal Developer'],
  'Principal Engineer': ['Principal Software Engineer', 'Staff Engineer'],
  'Tech Lead': ['Technical Lead', 'Engineering Lead', 'Team Lead'],
  'Frontend Developer': ['Front End Developer', 'Frontend Engineer', 'UI Developer'],
  'Frontend Engineer': ['Front End Engineer', 'Frontend Developer', 'UI Engineer'],
  'React Developer': ['ReactJS Developer', 'React Engineer', 'React.js Developer'],
  'Backend Developer': ['Back End Developer', 'Backend Engineer', 'Server Developer'],
  'Backend Engineer': ['Back End Engineer', 'Backend Developer'],
  'Python Developer': ['Python Engineer', 'Python Programmer'],
  'Java Developer': ['Java Engineer', 'Java Programmer', 'J2EE Developer'],
  'Node.js Developer': ['NodeJS Developer', 'Node Developer', 'Node Engineer'],
  'Full Stack Developer': ['Fullstack Developer', 'Full-Stack Developer', 'Web Developer'],
  'Full Stack Engineer': ['Fullstack Engineer', 'Full-Stack Engineer'],
  'Data Engineer': ['Data Platform Engineer', 'Data Infrastructure Engineer'],
  'Data Scientist': ['Data Science', 'ML Scientist', 'Research Scientist'],
  'ML Engineer': ['Machine Learning Engineer', 'AI Engineer', 'MLOps Engineer'],
  'Data Analyst': ['Business Analyst', 'Analytics Analyst', 'BI Analyst'],
  'DevOps Engineer': ['DevOps', 'Infrastructure Engineer', 'Platform Engineer'],
  'Platform Engineer': ['Infrastructure Engineer', 'DevOps Engineer'],
  'SRE': ['Site Reliability Engineer', 'Reliability Engineer'],
  'Cloud Engineer': ['Cloud Infrastructure Engineer', 'AWS Engineer', 'Azure Engineer'],
  'Security Engineer': ['InfoSec Engineer', 'Application Security Engineer', 'Cybersecurity Engineer'],
  'Product Manager': ['PM', 'Product Owner', 'Product Lead'],
  'Product Owner': ['PO', 'Product Manager', 'Scrum Product Owner'],
  'UX Designer': ['User Experience Designer', 'UX/UI Designer', 'Product Designer'],
  'UI Designer': ['User Interface Designer', 'Visual Designer', 'UX/UI Designer'],
  'Product Designer': ['UX Designer', 'Design Lead'],
  'QA Engineer': ['Quality Assurance Engineer', 'Test Engineer', 'SDET'],
  'Test Engineer': ['QA Engineer', 'Automation Engineer', 'Quality Engineer'],
  'CTO': ['Chief Technology Officer', 'VP Engineering', 'Head of Technology'],

  // =============================================
  // HEALTHCARE
  // =============================================
  'Registered Nurse': ['RN', 'Staff Nurse', 'General Nurse', 'Adult Nurse'],
  'Senior Staff Nurse': ['Senior Nurse', 'Band 6 Nurse', 'Charge Nurse'],
  'Nurse Manager': ['Ward Manager', 'Nursing Manager', 'Unit Manager'],
  'Ward Sister': ['Senior Sister', 'Ward Manager'],
  'Mental Health Nurse': ['RMN', 'Psychiatric Nurse', 'MH Nurse'],
  'RMN': ['Registered Mental Nurse', 'Mental Health Nurse', 'Psychiatric Nurse'],
  'Care Assistant': ['Carer', 'Healthcare Assistant', 'HCA', 'Support Worker'],
  'Senior Carer': ['Senior Care Assistant', 'Senior HCA'],
  'Care Home Manager': ['Home Manager', 'Registered Manager', 'Care Manager'],
  'Registered Manager': ['Care Home Manager', 'Home Manager'],
  'Support Worker': ['Care Support Worker', 'Healthcare Support', 'Care Worker'],
  'Physiotherapist': ['Physio', 'Physical Therapist', 'PT'],
  'Occupational Therapist': ['OT', 'Occupational Therapy'],
  'GP': ['General Practitioner', 'Family Doctor', 'Doctor'],
  'Pharmacist': ['Clinical Pharmacist', 'Hospital Pharmacist', 'Community Pharmacist'],

  // =============================================
  // MANUFACTURING
  // =============================================
  'Production Manager': ['Manufacturing Manager', 'Factory Manager', 'Plant Manager'],
  'Production Supervisor': ['Manufacturing Supervisor', 'Line Supervisor', 'Shift Supervisor'],
  'Shift Manager': ['Shift Supervisor', 'Shift Leader', 'Production Shift Manager'],
  'Plant Manager': ['Factory Manager', 'Site Manager', 'Operations Manager'],
  'Manufacturing Engineer': ['Production Engineer', 'Industrial Engineer'],
  'Process Engineer': ['Manufacturing Process Engineer', 'Production Engineer'],
  'Maintenance Engineer': ['Maintenance Technician', 'Plant Engineer', 'Facilities Engineer'],
  'Quality Manager': ['QA Manager', 'Quality Assurance Manager', 'Quality Director'],
  'Quality Engineer': ['QA Engineer', 'Quality Assurance Engineer'],
  'CNC Machinist': ['CNC Operator', 'CNC Setter', 'CNC Turner', 'CNC Miller'],
  'CNC Programmer': ['CNC Programming', 'CAM Programmer'],
  'Welder': ['Welder/Fabricator', 'MIG Welder', 'TIG Welder', 'Coded Welder'],
  'Fabricator': ['Metal Fabricator', 'Sheet Metal Worker', 'Welder/Fabricator'],

  // =============================================
  // FINANCE
  // =============================================
  'Accountant': ['Accounts Manager', 'Finance Officer', 'Book Keeper'],
  'Senior Accountant': ['Lead Accountant', 'Accounts Supervisor'],
  'Financial Accountant': ['Finance Accountant', 'Statutory Accountant'],
  'Management Accountant': ['Cost Accountant', 'Business Partner'],
  'Finance Manager': ['Financial Manager', 'Accounts Manager', 'Finance Business Partner'],
  'Financial Controller': ['FC', 'Group Financial Controller', 'Divisional Controller'],
  'Auditor': ['External Auditor', 'Internal Auditor', 'Audit Associate'],
  'Compliance Officer': ['Compliance Analyst', 'Regulatory Compliance'],
  'Risk Manager': ['Risk Analyst', 'Head of Risk', 'Operational Risk Manager'],
  'CFO': ['Chief Financial Officer', 'Finance Director', 'VP Finance'],
  'Finance Director': ['FD', 'CFO', 'Head of Finance'],

  // =============================================
  // LOGISTICS
  // =============================================
  'Warehouse Manager': ['Distribution Manager', 'Warehouse Operations Manager', 'DC Manager'],
  'Warehouse Supervisor': ['Warehouse Team Leader', 'Shift Supervisor', 'Warehouse Lead'],
  'Transport Manager': ['Fleet Manager', 'Logistics Manager', 'Distribution Manager'],
  'Fleet Manager': ['Transport Manager', 'Vehicle Manager'],
  'Logistics Manager': ['Supply Chain Manager', 'Operations Manager', 'Distribution Manager'],
  'Supply Chain Manager': ['SCM', 'Logistics Manager', 'Head of Supply Chain'],
  'HGV Driver': ['Truck Driver', 'Class 1 Driver', 'Class 2 Driver', 'LGV Driver', 'Lorry Driver'],

  // =============================================
  // ENERGY
  // =============================================
  'Wind Turbine Technician': ['Wind Technician', 'WTG Technician', 'Turbine Technician'],
  'Solar Engineer': ['PV Engineer', 'Solar Installer', 'Photovoltaic Engineer'],
  'Renewables Project Manager': ['Renewable Energy PM', 'Clean Energy Project Manager'],
  'HSE Manager': ['Health & Safety Manager', 'HSEQ Manager', 'EHS Manager'],

  // =============================================
  // PROPERTY
  // =============================================
  'Property Manager': ['Building Manager', 'Estate Manager', 'Facilities Manager'],
  'Estate Agent': ['Sales Negotiator', 'Property Consultant', 'Lettings Negotiator'],
  'Facilities Manager': ['FM', 'Building Manager', 'Site Manager'],
  'Building Surveyor': ['Property Surveyor', 'Chartered Surveyor'],

  // =============================================
  // RETAIL
  // =============================================
  'Store Manager': ['Shop Manager', 'Retail Manager', 'Branch Manager'],
  'Assistant Store Manager': ['Deputy Manager', 'Assistant Manager', 'ASM'],
  'Area Manager': ['Regional Manager', 'District Manager', 'Multi-Site Manager'],
  'Retail Assistant': ['Sales Assistant', 'Shop Assistant', 'Customer Advisor'],

  // =============================================
  // LEGAL
  // =============================================
  'Solicitor': ['Lawyer', 'Associate Solicitor', 'Legal Counsel'],
  'Paralegal': ['Legal Assistant', 'Legal Executive', 'Trainee Solicitor'],
  'Legal Secretary': ['Legal PA', 'Legal Admin', 'Secretary'],
  'Partner': ['Senior Partner', 'Equity Partner', 'Salaried Partner'],
};

/**
 * Get all search terms for a role (primary role + variations)
 */
export function getRoleSearchTerms(role: string): string[] {
  const variations = ROLE_VARIATIONS[role] || [];
  return [role, ...variations];
}

/**
 * Get all search terms for multiple roles
 */
export function getAllRoleSearchTerms(roles: string[]): string[] {
  const allTerms: string[] = [];
  for (const role of roles) {
    allTerms.push(...getRoleSearchTerms(role));
  }
  // Remove duplicates
  return [...new Set(allTerms)];
}
