import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const signalType = searchParams.get('signal_type');
  const sourceType = searchParams.get('source_type');
  const isNew = searchParams.get('is_new');
  const limit = parseInt(searchParams.get('limit') || '100');

  let query = supabase
    .from('signals')
    .select('*, source:sources(name)')
    .eq('user_id', user.id)
    .order('detected_at', { ascending: false })
    .limit(limit);

  if (signalType) {
    query = query.eq('signal_type', signalType);
  }

  if (sourceType) {
    query = query.eq('source_type', sourceType);
  }

  if (isNew === 'true') {
    query = query.eq('is_new', true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
