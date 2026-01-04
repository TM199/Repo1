/**
 * Department Classifier
 *
 * Classifies job titles into departments for concentration analysis.
 * Used to detect when a company is heavily hiring in one area.
 */

export type Department =
  | 'Engineering'
  | 'Sales'
  | 'Operations'
  | 'Finance'
  | 'HR'
  | 'Marketing'
  | 'Customer Success'
  | 'Product'
  | 'Legal'
  | 'Other';

const DEPARTMENT_PATTERNS: Record<Department, RegExp[]> = {
  Engineering: [
    /\b(developer|engineer|devops|software|frontend|backend|full.?stack|sre|platform|architect|programmer|coder)\b/i,
    /\b(cloud|infrastructure|systems|network|security)\s*(engineer|specialist|admin)/i,
    /\b(data\s*(engineer|scientist)|machine\s*learning|ml\s*engineer|ai\s*engineer)\b/i,
    /\b(qa|test|quality)\s*(engineer|lead|analyst)/i,
    /\b(mobile|ios|android|react\s*native)\s*(developer|engineer)/i,
  ],
  Sales: [
    /\b(sales|business\s*development|account\s*(executive|manager)|bdm|bdr|sdr)\b/i,
    /\b(sales\s*(rep|representative|director|manager|lead|executive))\b/i,
    /\b(inside\s*sales|field\s*sales|enterprise\s*sales)\b/i,
    /\b(revenue|commercial)\s*(manager|director|lead)/i,
  ],
  Operations: [
    /\b(operations|ops|logistics|supply\s*chain|warehouse|fleet|facilities)\b/i,
    /\b(operations\s*(manager|director|analyst|coordinator))\b/i,
    /\b(production|manufacturing|process)\s*(manager|supervisor|lead)/i,
    /\b(inventory|procurement|purchasing)\s*(manager|specialist)/i,
  ],
  Finance: [
    /\b(accountant|finance|financial|auditor|controller|treasury|bookkeeper)\b/i,
    /\b(finance\s*(manager|director|analyst|controller))\b/i,
    /\b(accounts\s*(payable|receivable)|payroll|billing)\b/i,
    /\b(cfo|financial\s*controller|finance\s*director)\b/i,
    /\b(tax|credit|collections)\s*(manager|analyst|specialist)/i,
  ],
  HR: [
    /\b(hr|human\s*resources|talent|recruiter|recruiting|people\s*ops|people\s*operations)\b/i,
    /\b(hr\s*(manager|director|business\s*partner|advisor|generalist))\b/i,
    /\b(talent\s*(acquisition|partner|manager)|recruitment\s*consultant)\b/i,
    /\b(learning\s*(&|and)\s*development|l&d|training)\s*(manager|specialist)/i,
    /\b(employee\s*relations|compensation|benefits)\s*(manager|specialist)/i,
  ],
  Marketing: [
    /\b(marketing|brand|content|digital\s*marketing|seo|ppc|growth|social\s*media)\b/i,
    /\b(marketing\s*(manager|director|executive|coordinator|specialist))\b/i,
    /\b(content\s*(writer|creator|strategist|manager))\b/i,
    /\b(email\s*marketing|demand\s*generation|performance\s*marketing)\b/i,
    /\b(communications|pr|public\s*relations)\s*(manager|specialist)/i,
    /\b(creative|design|graphic)\s*(director|manager|lead)/i,
  ],
  'Customer Success': [
    /\b(customer\s*(success|service|support)|client\s*(success|services?))\b/i,
    /\b(customer\s*(success|support)\s*(manager|lead|specialist|representative))\b/i,
    /\b(account\s*manager|relationship\s*manager|client\s*manager)\b/i,
    /\b(support\s*(engineer|specialist|analyst)|technical\s*support)\b/i,
    /\b(customer\s*experience|cx)\s*(manager|lead)/i,
  ],
  Product: [
    /\b(product\s*(manager|owner|lead|director|vp))\b/i,
    /\b(ux|ui|user\s*experience|user\s*interface)\s*(designer|researcher|lead)/i,
    /\b(product\s*design|design\s*lead|head\s*of\s*design)\b/i,
    /\b(user\s*research|ux\s*research|product\s*analyst)\b/i,
  ],
  Legal: [
    /\b(lawyer|solicitor|legal|paralegal|barrister|counsel|attorney)\b/i,
    /\b(legal\s*(counsel|advisor|manager|director))\b/i,
    /\b(compliance|regulatory)\s*(manager|officer|specialist)/i,
    /\b(contracts?\s*(manager|specialist)|legal\s*ops)\b/i,
  ],
  Other: [], // Catch-all, no patterns
};

/**
 * Classify a job title into a department
 *
 * @param title - The job title to classify
 * @returns The department name or null if no match
 */
export function classifyJobByDepartment(title: string): Department | null {
  if (!title) return null;

  const titleLower = title.toLowerCase();

  // Check each department's patterns
  for (const [department, patterns] of Object.entries(DEPARTMENT_PATTERNS)) {
    if (department === 'Other') continue; // Skip catch-all

    for (const pattern of patterns) {
      if (pattern.test(titleLower)) {
        return department as Department;
      }
    }
  }

  return null; // No match found
}

/**
 * Get all departments for display purposes
 */
export function getAllDepartments(): Department[] {
  return [
    'Engineering',
    'Sales',
    'Operations',
    'Finance',
    'HR',
    'Marketing',
    'Customer Success',
    'Product',
    'Legal',
  ];
}

/**
 * Classify multiple jobs and return department distribution
 */
export function classifyJobsByDepartment(
  jobs: Array<{ title: string }>
): Record<Department, number> {
  const counts: Record<Department, number> = {
    Engineering: 0,
    Sales: 0,
    Operations: 0,
    Finance: 0,
    HR: 0,
    Marketing: 0,
    'Customer Success': 0,
    Product: 0,
    Legal: 0,
    Other: 0,
  };

  for (const job of jobs) {
    const department = classifyJobByDepartment(job.title);
    if (department) {
      counts[department]++;
    } else {
      counts.Other++;
    }
  }

  return counts;
}
