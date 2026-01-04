// src/tools/fetch-companies-house.ts

/**
 * Fetch official UK company data from Companies House API.
 * Returns: Company number, SIC codes, status, registered address.
 * Use for: UK companies only. Free API.
 */
export async function fetchCompaniesHouse(
  companyName?: string,
  companyNumber?: string
) {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return { found: false, error: 'COMPANIES_HOUSE_API_KEY not configured' };
  }

  const baseUrl = 'https://api.companieshouse.gov.uk';
  const auth = `Basic ${Buffer.from(apiKey + ':').toString('base64')}`;

  try {
    let company;

    if (companyNumber) {
      const response = await fetch(`${baseUrl}/company/${companyNumber}`, {
        headers: { Authorization: auth },
      });
      if (response.ok) company = await response.json();
    } else if (companyName) {
      const searchResponse = await fetch(
        `${baseUrl}/search/companies?q=${encodeURIComponent(companyName)}&items_per_page=3`,
        { headers: { Authorization: auth } }
      );
      if (searchResponse.ok) {
        const results = await searchResponse.json();
        company = results.items?.[0];
      }
    }

    if (!company) {
      return { found: false, error: 'Company not found' };
    }

    return {
      found: true,
      companyNumber: company.company_number,
      companyName: company.company_name,
      companyStatus: company.company_status,
      sicCodes: company.sic_codes || [],
      incorporationDate: company.date_of_creation,
    };
  } catch (error) {
    return { found: false, error: String(error) };
  }
}
