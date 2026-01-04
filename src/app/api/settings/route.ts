import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// Encryption helpers for API keys
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes hex string
const IV_LENGTH = 16;

function encrypt(text: string): string {
  if (!ENCRYPTION_KEY || !text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch {
    return text; // Return unencrypted if encryption fails
  }
}

function decrypt(text: string): string {
  if (!ENCRYPTION_KEY || !text || !text.includes(':')) return text;
  try {
    const parts = text.split(':');
    if (parts.length !== 2) return text;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    return text; // Return as-is if decryption fails (likely not encrypted)
  }
}

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Try to get existing settings
  let { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // Create default settings if none exist
  if (!settings) {
    const { data: newSettings, error } = await supabase
      .from('user_settings')
      .insert({
        user_id: user.id,
        notify_email: true,
        email_frequency: 'weekly',
        notify_url_sources: true,
        notify_ai_search: true,
        notification_sound_enabled: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    settings = newSettings;
  }

  // Decrypt API keys before returning
  if (settings.leadmagic_api_key) {
    settings.leadmagic_api_key = decrypt(settings.leadmagic_api_key);
  }
  if (settings.prospeo_api_key) {
    settings.prospeo_api_key = decrypt(settings.prospeo_api_key);
  }

  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Encrypt API keys before storing
  const encryptedLeadmagic = body.leadmagic_api_key ? encrypt(body.leadmagic_api_key) : null;
  const encryptedProspeo = body.prospeo_api_key ? encrypt(body.prospeo_api_key) : null;

  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      notify_email: body.notify_email,
      email_frequency: body.email_frequency,
      notify_url_sources: body.notify_url_sources,
      notify_ai_search: body.notify_ai_search,
      notification_sound_enabled: body.notification_sound_enabled ?? true,
      leadmagic_api_key: encryptedLeadmagic,
      prospeo_api_key: encryptedProspeo,
      enrichment_include_phone: body.enrichment_include_phone,
      default_enrichment_roles: body.default_enrichment_roles,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Decrypt API keys before returning
  if (data.leadmagic_api_key) {
    data.leadmagic_api_key = decrypt(data.leadmagic_api_key);
  }
  if (data.prospeo_api_key) {
    data.prospeo_api_key = decrypt(data.prospeo_api_key);
  }

  return NextResponse.json(data);
}
