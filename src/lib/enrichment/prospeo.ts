export async function findEmail(
  firstName: string,
  lastName: string,
  domain: string,
  apiKey: string
): Promise<{ email: string; status: string } | null> {
  const response = await fetch('https://api.prospeo.io/email-finder', {
    method: 'POST',
    headers: {
      'X-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      company: domain,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data.error) return null;

  return {
    email: data.response.email,
    status: data.response.email_status,
  };
}

export async function findPhone(
  linkedinUrl: string,
  apiKey: string
): Promise<string | null> {
  const response = await fetch('https://api.prospeo.io/mobile-finder', {
    method: 'POST',
    headers: {
      'X-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: linkedinUrl }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data.error) return null;

  return data.response?.raw_format || null;
}
