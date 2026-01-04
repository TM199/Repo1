/**
 * Admin API: Trigger batch classification of unclassified companies
 *
 * POST /api/admin/classify-companies
 * - Finds companies without agency classification
 * - Triggers Inngest batch function to classify them
 * - Returns count and job ID for tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { inngest } from '@/inngest/client';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(body.limit || 50, 100); // Max 100 companies per batch

  const adminSupabase = createAdminClient();

  // Find unclassified companies (no agency_classified_at)
  const { data: companies, error } = await adminSupabase
    .from('companies')
    .select('id, name')
    .is('agency_classified_at', null)
    .limit(limit);

  if (error) {
    console.error('[classify-companies] Query error:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }

  if (!companies || companies.length === 0) {
    return NextResponse.json({
      message: 'No unclassified companies found',
      queued: 0,
    });
  }

  const companyIds = companies.map((c) => c.id);

  // Trigger Inngest function
  const { ids } = await inngest.send({
    name: 'company/classify.requested',
    data: { companyIds },
  });

  return NextResponse.json({
    message: `Queued ${companyIds.length} companies for classification`,
    queued: companyIds.length,
    eventId: ids[0],
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  // Count unclassified companies
  const { count: unclassifiedCount } = await adminSupabase
    .from('companies')
    .select('id', { count: 'exact', head: true })
    .is('agency_classified_at', null);

  // Count classified as agency
  const { count: agencyCount } = await adminSupabase
    .from('companies')
    .select('id', { count: 'exact', head: true })
    .eq('is_recruitment_agency', true);

  // Count classified as not agency
  const { count: verifiedCount } = await adminSupabase
    .from('companies')
    .select('id', { count: 'exact', head: true })
    .eq('is_recruitment_agency', false);

  return NextResponse.json({
    unclassified: unclassifiedCount || 0,
    agencies: agencyCount || 0,
    verified: verifiedCount || 0,
  });
}
