import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { pushSignalToHubSpot, refreshAccessToken } from '@/lib/integrations/hubspot';

/**
 * POST /api/integrations/hubspot/push
 * Push a signal with contacts to HubSpot
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { signalId } = await request.json();
  if (!signalId) {
    return NextResponse.json({ error: 'Missing signalId' }, { status: 400 });
  }

  // Get user's HubSpot tokens
  const { data: settings } = await adminSupabase
    .from('user_settings')
    .select('hubspot_access_token, hubspot_refresh_token, hubspot_expires_at')
    .eq('user_id', user.id)
    .single();

  if (!settings?.hubspot_access_token) {
    return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
  }

  let accessToken = settings.hubspot_access_token;

  // Check if token is expired and refresh if needed
  if (settings.hubspot_expires_at && Date.now() > settings.hubspot_expires_at) {
    if (!settings.hubspot_refresh_token) {
      return NextResponse.json({ error: 'HubSpot token expired' }, { status: 400 });
    }

    const { tokens, error } = await refreshAccessToken(settings.hubspot_refresh_token);
    if (!tokens) {
      return NextResponse.json({ error: error || 'Token refresh failed' }, { status: 400 });
    }

    accessToken = tokens.access_token;

    // Save new tokens
    await adminSupabase
      .from('user_settings')
      .update({
        hubspot_access_token: tokens.access_token,
        hubspot_refresh_token: tokens.refresh_token,
        hubspot_expires_at: tokens.expires_at,
      })
      .eq('user_id', user.id);
  }

  // Get signal with contacts
  const { data: signal, error: signalError } = await adminSupabase
    .from('signals')
    .select('*, contacts:signal_contacts(*)')
    .eq('id', signalId)
    .single();

  if (signalError || !signal) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
  }

  // Push to HubSpot
  const result = await pushSignalToHubSpot(
    accessToken,
    {
      company_name: signal.company_name,
      company_domain: signal.company_domain,
      location: signal.location,
      industry: signal.industry,
      signal_title: signal.signal_title,
      signal_detail: signal.signal_detail,
    },
    signal.contacts || []
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    companyId: result.companyId,
    contactIds: result.contactIds,
  });
}
