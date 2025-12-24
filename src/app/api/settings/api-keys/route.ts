/**
 * API Keys Management Route
 *
 * CRUD operations for user Reed API keys.
 * Each API key allows 3 additional ICP profiles.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { encryptApiKey, decryptApiKey, getIcpSlots } from '@/lib/rate-limiter';
import { ApiKey } from '@/types';

// GET /api/settings/api-keys - List all API keys for the user
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user's API keys
  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('id, api_name, label, daily_limit, is_active, is_unlimited, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[api-keys] Error fetching keys:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get ICP slots info
  const slots = await getIcpSlots(user.id);

  // Mask API keys for security (we never return the actual key)
  const maskedKeys = (keys || []).map(key => ({
    ...key,
    api_key_masked: '****', // We don't store or return the actual key
  }));

  return NextResponse.json({
    keys: maskedKeys,
    slots,
    // Include default key status
    has_default_key: !!process.env.REED_API_KEY,
  });
}

// POST /api/settings/api-keys - Add a new API key
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { api_key, label } = body;

  if (!api_key) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  // Validate the API key by making a test call
  const isValid = await validateReedApiKey(api_key);
  if (!isValid) {
    return NextResponse.json({
      error: 'Invalid Reed API key. Please check the key and try again.',
    }, { status: 400 });
  }

  // Encrypt and store the key
  const encryptedKey = encryptApiKey(api_key);

  const { data: newKey, error } = await adminClient
    .from('api_keys')
    .insert({
      user_id: user.id,
      api_name: 'reed',
      api_key_encrypted: encryptedKey,
      label: label || `Reed API Key ${Date.now()}`,
      daily_limit: 100,
      is_active: true,
    })
    .select('id, api_name, label, daily_limit, is_active, created_at')
    .single();

  if (error) {
    console.error('[api-keys] Error creating key:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get updated slots
  const slots = await getIcpSlots(user.id);

  return NextResponse.json({
    key: {
      ...newKey,
      api_key_masked: `****${api_key.slice(-4)}`,
    },
    slots,
    message: 'API key added successfully. You can now create 3 more ICP profiles.',
  }, { status: 201 });
}

// DELETE /api/settings/api-keys - Delete an API key
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const keyId = searchParams.get('id');

  if (!keyId) {
    return NextResponse.json({ error: 'Key ID is required' }, { status: 400 });
  }

  // Check if any ICP profiles are using this key
  const { count: profileCount } = await supabase
    .from('icp_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', keyId);

  if ((profileCount || 0) > 0) {
    return NextResponse.json({
      error: `Cannot delete this API key. ${profileCount} ICP profile(s) are using it. Please delete or reassign them first.`,
    }, { status: 400 });
  }

  // Delete the key
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', keyId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[api-keys] Error deleting key:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get updated slots
  const slots = await getIcpSlots(user.id);

  return NextResponse.json({
    message: 'API key deleted successfully.',
    slots,
  });
}

/**
 * Validate a Reed API key by making a test call
 */
async function validateReedApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(
      'https://www.reed.co.uk/api/1.0/search?keywords=test&resultsToTake=1',
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
        },
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}
