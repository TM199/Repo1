import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    settings = newSettings;
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

  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      notify_email: body.notify_email,
      email_frequency: body.email_frequency,
      notify_url_sources: body.notify_url_sources,
      notify_ai_search: body.notify_ai_search,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
