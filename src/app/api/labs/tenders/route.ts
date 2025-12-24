import { NextRequest, NextResponse } from 'next/server';
import { fetchFTSAwards } from '@/lib/find-a-tender';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const daysBack = parseInt(searchParams.get('daysBack') || '7', 10);

  try {
    const result = await fetchFTSAwards(daysBack);
    return NextResponse.json({
      signals: result.signals,
      count: result.signals.length,
      error: result.error,
    });
  } catch (error) {
    console.error('[Labs/Tenders] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
