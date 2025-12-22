import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  testConnection,
} from '@/lib/integrations/hubspot';

/**
 * GET /api/integrations/hubspot
 * Returns HubSpot connection status
 */
export async function GET() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user's HubSpot tokens from settings
  const { data: settings } = await adminSupabase
    .from('user_settings')
    .select('hubspot_access_token, hubspot_refresh_token, hubspot_expires_at')
    .eq('user_id', user.id)
    .single();

  if (!settings?.hubspot_access_token) {
    return NextResponse.json({ connected: false });
  }

  // Check if token is expired
  const expiresAt = settings.hubspot_expires_at;
  if (expiresAt && Date.now() > expiresAt) {
    // Try to refresh
    if (settings.hubspot_refresh_token) {
      const { tokens, error } = await refreshAccessToken(settings.hubspot_refresh_token);
      if (tokens) {
        await adminSupabase
          .from('user_settings')
          .update({
            hubspot_access_token: tokens.access_token,
            hubspot_refresh_token: tokens.refresh_token,
            hubspot_expires_at: tokens.expires_at,
          })
          .eq('user_id', user.id);

        return NextResponse.json({ connected: true });
      }
      console.error('[HubSpot] Token refresh failed:', error);
    }
    return NextResponse.json({ connected: false, error: 'Token expired' });
  }

  // Test connection
  const { valid, error } = await testConnection(settings.hubspot_access_token);
  return NextResponse.json({ connected: valid, error });
}

/**
 * POST /api/integrations/hubspot
 * Initiates OAuth flow or handles callback
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, code, redirectUri } = body;

  if (action === 'get_auth_url') {
    // Generate authorization URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackUri = redirectUri || `${baseUrl}/api/integrations/hubspot/callback`;

    try {
      const authUrl = getAuthorizationUrl(callbackUri, user.id);
      return NextResponse.json({ authUrl });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to generate auth URL' },
        { status: 500 }
      );
    }
  }

  if (action === 'exchange_code') {
    // Exchange authorization code for tokens
    if (!code || !redirectUri) {
      return NextResponse.json({ error: 'Missing code or redirectUri' }, { status: 400 });
    }

    const { tokens, error } = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens) {
      return NextResponse.json({ error: error || 'Token exchange failed' }, { status: 500 });
    }

    // Save tokens to user settings
    const adminSupabase = createAdminClient();
    await adminSupabase
      .from('user_settings')
      .update({
        hubspot_access_token: tokens.access_token,
        hubspot_refresh_token: tokens.refresh_token,
        hubspot_expires_at: tokens.expires_at,
      })
      .eq('user_id', user.id);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

/**
 * DELETE /api/integrations/hubspot
 * Disconnects HubSpot integration
 */
export async function DELETE() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await adminSupabase
    .from('user_settings')
    .update({
      hubspot_access_token: null,
      hubspot_refresh_token: null,
      hubspot_expires_at: null,
    })
    .eq('user_id', user.id);

  return NextResponse.json({ success: true });
}
