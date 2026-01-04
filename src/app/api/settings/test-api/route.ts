import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/settings/test-api
 * Test API key validity for LeadMagic or Prospeo
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { provider, apiKey } = await request.json();

  if (!provider || !apiKey) {
    return NextResponse.json({ error: 'Missing provider or apiKey' }, { status: 400 });
  }

  try {
    if (provider === 'leadmagic') {
      // Test LeadMagic API key by checking credits/account
      const response = await fetch('https://api.leadmagic.io/business/company-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({
          company_name: 'Test Company',
          limit: 1,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({
          valid: false,
          error: 'Invalid API key'
        });
      }

      if (response.ok) {
        return NextResponse.json({
          valid: true,
          message: 'LeadMagic API key is valid'
        });
      }

      // Other errors might indicate network issues, treat as valid key but warn
      return NextResponse.json({
        valid: true,
        warning: 'API key accepted, but could not verify credits'
      });
    }

    if (provider === 'prospeo') {
      // Test Prospeo API key by checking credits
      const response = await fetch('https://api.prospeo.io/credits', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-KEY': apiKey,
        },
      });

      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({
          valid: false,
          error: 'Invalid API key'
        });
      }

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          valid: true,
          message: 'Prospeo API key is valid',
          credits: data.credits_used !== undefined ? {
            used: data.credits_used,
            total: data.credits_total,
          } : undefined,
        });
      }

      return NextResponse.json({
        valid: true,
        warning: 'API key accepted, but could not verify credits'
      });
    }

    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  } catch (error) {
    console.error('API test error:', error);
    return NextResponse.json({
      valid: false,
      error: 'Network error testing API key'
    }, { status: 500 });
  }
}
