import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens } from '@/lib/integrations/hubspot';

/**
 * GET /api/integrations/hubspot/callback
 * OAuth callback handler - exchanges code for tokens
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // User ID passed as state
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const settingsUrl = `${baseUrl}/settings`;

  if (error) {
    console.error('[HubSpot Callback] OAuth error:', error);
    return NextResponse.redirect(`${settingsUrl}?hubspot_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${settingsUrl}?hubspot_error=missing_code`);
  }

  // Verify user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${settingsUrl}?hubspot_error=unauthorized`);
  }

  // Optional: Verify state matches user ID
  if (state && state !== user.id) {
    console.warn('[HubSpot Callback] State mismatch:', { expected: user.id, got: state });
  }

  // Exchange code for tokens
  const redirectUri = `${baseUrl}/api/integrations/hubspot/callback`;
  const { tokens, error: tokenError } = await exchangeCodeForTokens(code, redirectUri);

  if (!tokens) {
    console.error('[HubSpot Callback] Token exchange failed:', tokenError);
    return NextResponse.redirect(`${settingsUrl}?hubspot_error=${encodeURIComponent(tokenError || 'token_exchange_failed')}`);
  }

  // Save tokens to user settings
  const adminSupabase = createAdminClient();
  const { error: updateError } = await adminSupabase
    .from('user_settings')
    .update({
      hubspot_access_token: tokens.access_token,
      hubspot_refresh_token: tokens.refresh_token,
      hubspot_expires_at: tokens.expires_at,
    })
    .eq('user_id', user.id);

  if (updateError) {
    console.error('[HubSpot Callback] Failed to save tokens:', updateError);
    return NextResponse.redirect(`${settingsUrl}?hubspot_error=save_failed`);
  }

  console.log('[HubSpot Callback] Successfully connected HubSpot for user:', user.id);
  return NextResponse.redirect(`${settingsUrl}?hubspot_success=true`);
}
