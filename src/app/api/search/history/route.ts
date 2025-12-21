import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profile_id');
  const limit = parseInt(searchParams.get('limit') || '20');

  let query = supabase
    .from('search_runs')
    .select('*, search_profile:search_profiles(name, industry)')
    .eq('user_id', user.id)
    .order('run_at', { ascending: false })
    .limit(limit);

  if (profileId) {
    query = query.eq('search_profile_id', profileId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
