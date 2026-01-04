export interface LeadMagicContact {
  name: string;
  first_name: string;
  last_name: string;
  profile_url: string; // LinkedIn URL
  company_name: string;
  company_website: string | null; // Domain returned by LeadMagic
}

export async function findContactByRole(
  domain: string,
  companyName: string,
  jobTitle: string,
  apiKey: string
): Promise<LeadMagicContact | null> {
  const response = await fetch('https://api.leadmagic.io/v1/people/role-finder', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      company_domain: domain,
      company_name: companyName,
      job_title: jobTitle,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data.message !== 'Role Found') return null;

  return {
    name: data.name,
    first_name: data.first_name,
    last_name: data.last_name,
    profile_url: data.profile_url,
    company_name: data.company_name,
    company_website: data.company_website || null,
  };
}
