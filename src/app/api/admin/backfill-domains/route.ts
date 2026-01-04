/**
 * Admin Endpoint: Domain Backfill
 *
 * GET /api/admin/backfill-domains?statsOnly=true
 *   - Returns coverage stats only
 *
 * POST /api/admin/backfill-domains
 *   - Triggers Inngest background job for domain resolution
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDomainCoverageStats } from '@/lib/company/backfill-domains';
import { inngest } from '@/inngest/client';

// GET: Return domain coverage stats
export async function GET() {
  try {
    const stats = await getDomainCoverageStats();

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST: Trigger Inngest background job for domain resolution
export async function POST(request: NextRequest) {
  // Require authentication
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const batchSize = body.batchSize || 50;

    // Send Inngest event
    await inngest.send({
      name: 'domains/backfill.requested',
      data: { batchSize },
    });

    return NextResponse.json({
      started: true,
      message: `Domain backfill started (batch size: ${batchSize})`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[admin/backfill-domains] Error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
