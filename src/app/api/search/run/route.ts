import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runSearch } from '@/lib/search';

// Increase timeout for search (60s on Pro, 10s on Hobby)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { profileId } = await request.json();

  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
  }

  // Verify user owns this profile
  const { data: profile, error: profileError } = await supabase
    .from('search_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  try {
    const result = await runSearch(profileId, user.id);
    return NextResponse.json({
      success: true,
      newSignals: result.newSignals,  // For SearchProfileCard component
      signals_found: result.newSignals,  // For run page
      run_id: result.searchRun.id,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
