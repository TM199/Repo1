/**
 * HubSpot Integration Client
 *
 * Handles OAuth flow and API interactions for pushing signals/contacts to HubSpot.
 * API Documentation: https://developers.hubspot.com/docs/api/overview
 */

const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';
const HUBSPOT_API_URL = 'https://api.hubapi.com';

// Required scopes for our integration
const SCOPES = [
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
];

interface HubSpotTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
}

interface HubSpotCompany {
  id?: string;
  properties: {
    name: string;
    domain?: string;
    industry?: string;
    city?: string;
    description?: string;
  };
}

interface HubSpotContact {
  id?: string;
  properties: {
    firstname: string;
    lastname: string;
    email?: string;
    phone?: string;
    jobtitle?: string;
    linkedin?: string;
  };
}

/**
 * Generate HubSpot OAuth authorization URL
 */
export function getAuthorizationUrl(redirectUri: string, state?: string): string {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  if (!clientId) {
    throw new Error('HUBSPOT_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    response_type: 'code',
  });

  if (state) {
    params.set('state', state);
  }

  return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ tokens: HubSpotTokens | null; error?: string }> {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { tokens: null, error: 'HubSpot credentials not configured' };
  }

  try {
    const response = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { tokens: null, error: errorData.message || 'Token exchange failed' };
    }

    const tokens: HubSpotTokens = await response.json();
    tokens.expires_at = Date.now() + tokens.expires_in * 1000;

    return { tokens };
  } catch (error) {
    return {
      tokens: null,
      error: error instanceof Error ? error.message : 'Token exchange failed',
    };
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ tokens: HubSpotTokens | null; error?: string }> {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { tokens: null, error: 'HubSpot credentials not configured' };
  }

  try {
    const response = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { tokens: null, error: errorData.message || 'Token refresh failed' };
    }

    const tokens: HubSpotTokens = await response.json();
    tokens.expires_at = Date.now() + tokens.expires_in * 1000;

    return { tokens };
  } catch (error) {
    return {
      tokens: null,
      error: error instanceof Error ? error.message : 'Token refresh failed',
    };
  }
}

/**
 * Create or update a company in HubSpot
 */
export async function upsertCompany(
  accessToken: string,
  company: HubSpotCompany
): Promise<{ company: HubSpotCompany | null; error?: string }> {
  try {
    // First, search for existing company by domain
    if (company.properties.domain) {
      const searchResponse = await fetch(
        `${HUBSPOT_API_URL}/crm/v3/objects/companies/search`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'domain',
                    operator: 'EQ',
                    value: company.properties.domain,
                  },
                ],
              },
            ],
            properties: ['name', 'domain', 'industry', 'city'],
          }),
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.results && searchData.results.length > 0) {
          // Update existing company
          const existingId = searchData.results[0].id;
          const updateResponse = await fetch(
            `${HUBSPOT_API_URL}/crm/v3/objects/companies/${existingId}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ properties: company.properties }),
            }
          );

          if (updateResponse.ok) {
            const updatedCompany = await updateResponse.json();
            return { company: updatedCompany };
          }
        }
      }
    }

    // Create new company
    const createResponse = await fetch(
      `${HUBSPOT_API_URL}/crm/v3/objects/companies`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties: company.properties }),
      }
    );

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      return { company: null, error: errorData.message || 'Failed to create company' };
    }

    const createdCompany = await createResponse.json();
    return { company: createdCompany };
  } catch (error) {
    return {
      company: null,
      error: error instanceof Error ? error.message : 'Failed to upsert company',
    };
  }
}

/**
 * Create or update a contact in HubSpot
 */
export async function upsertContact(
  accessToken: string,
  contact: HubSpotContact,
  companyId?: string
): Promise<{ contact: HubSpotContact | null; error?: string }> {
  try {
    // First, search for existing contact by email
    if (contact.properties.email) {
      const searchResponse = await fetch(
        `${HUBSPOT_API_URL}/crm/v3/objects/contacts/search`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'email',
                    operator: 'EQ',
                    value: contact.properties.email,
                  },
                ],
              },
            ],
            properties: ['firstname', 'lastname', 'email', 'phone', 'jobtitle'],
          }),
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.results && searchData.results.length > 0) {
          // Update existing contact
          const existingId = searchData.results[0].id;
          const updateResponse = await fetch(
            `${HUBSPOT_API_URL}/crm/v3/objects/contacts/${existingId}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ properties: contact.properties }),
            }
          );

          if (updateResponse.ok) {
            const updatedContact = await updateResponse.json();

            // Associate with company if provided
            if (companyId) {
              await associateContactToCompany(accessToken, updatedContact.id, companyId);
            }

            return { contact: updatedContact };
          }
        }
      }
    }

    // Create new contact
    const createResponse = await fetch(
      `${HUBSPOT_API_URL}/crm/v3/objects/contacts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties: contact.properties }),
      }
    );

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      return { contact: null, error: errorData.message || 'Failed to create contact' };
    }

    const createdContact = await createResponse.json();

    // Associate with company if provided
    if (companyId) {
      await associateContactToCompany(accessToken, createdContact.id, companyId);
    }

    return { contact: createdContact };
  } catch (error) {
    return {
      contact: null,
      error: error instanceof Error ? error.message : 'Failed to upsert contact',
    };
  }
}

/**
 * Associate a contact to a company
 */
async function associateContactToCompany(
  accessToken: string,
  contactId: string,
  companyId: string
): Promise<void> {
  await fetch(
    `${HUBSPOT_API_URL}/crm/v3/objects/contacts/${contactId}/associations/companies/${companyId}/contact_to_company`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Push a signal with its contacts to HubSpot
 */
export async function pushSignalToHubSpot(
  accessToken: string,
  signal: {
    company_name: string | null;
    company_domain: string | null;
    location: string | null;
    industry: string | null;
    signal_title: string | null;
    signal_detail: string | null;
  },
  contacts: Array<{
    full_name: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    job_title: string | null;
    linkedin_url: string | null;
  }>
): Promise<{ success: boolean; companyId?: string; contactIds?: string[]; error?: string }> {
  try {
    // Create/update company
    const { company: hubspotCompany, error: companyError } = await upsertCompany(
      accessToken,
      {
        properties: {
          name: signal.company_name || 'Unknown Company',
          domain: signal.company_domain || undefined,
          industry: signal.industry || undefined,
          city: signal.location || undefined,
          description: `${signal.signal_title || ''}\n\n${signal.signal_detail || ''}`.trim() || undefined,
        },
      }
    );

    if (companyError || !hubspotCompany) {
      return { success: false, error: companyError || 'Failed to create company' };
    }

    const companyId = hubspotCompany.id;
    const contactIds: string[] = [];

    // Create/update contacts
    for (const contact of contacts) {
      if (!contact.email && !contact.full_name) continue;

      const { contact: hubspotContact, error: contactError } = await upsertContact(
        accessToken,
        {
          properties: {
            firstname: contact.first_name || contact.full_name?.split(' ')[0] || '',
            lastname: contact.last_name || contact.full_name?.split(' ').slice(1).join(' ') || '',
            email: contact.email || undefined,
            phone: contact.phone || undefined,
            jobtitle: contact.job_title || undefined,
            linkedin: contact.linkedin_url || undefined,
          },
        },
        companyId
      );

      if (hubspotContact?.id) {
        contactIds.push(hubspotContact.id);
      } else if (contactError) {
        console.error(`[HubSpot] Failed to create contact: ${contactError}`);
      }
    }

    return { success: true, companyId, contactIds };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to push to HubSpot',
    };
  }
}

/**
 * Test HubSpot connection
 */
export async function testConnection(accessToken: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/companies?limit=1`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid or expired access token' };
    }

    return { valid: false, error: `API error: ${response.status}` };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    };
  }
}
