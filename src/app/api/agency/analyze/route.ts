import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeAgencyWebsite } from '@/lib/agency-analyzer';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { domain } = body;

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    const { analysis, error } = await analyzeAgencyWebsite(domain);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ analysis });

  } catch (error) {
    console.error('[API /agency/analyze] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze agency' },
      { status: 500 }
    );
  }
}
