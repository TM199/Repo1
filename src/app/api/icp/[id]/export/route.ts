/**
 * ICP Export API
 * Exports all signals for a specific ICP profile as CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

interface SignalWithCompany {
  id: string;
  pain_signal_type: string;
  signal_title: string;
  signal_detail: string | null;
  signal_value: number | null;
  pain_score_contribution: number;
  urgency: string;
  detected_at: string;
  source: string | null;
  job_url: string | null;
  companies: {
    name: string;
    domain: string | null;
    industry: string | null;
    location: string | null;
  } | null;
}

interface Contact {
  full_name: string;
  job_title: string | null;
  seniority: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
}

const escapeField = (value: string | null | undefined): string => {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

function signalsToCsv(signals: SignalWithCompany[], contactsMap: Map<string, Contact[]>): string {
  const headers = [
    'company_name',
    'company_domain',
    'industry',
    'location',
    'signal_type',
    'signal_title',
    'signal_detail',
    'urgency',
    'pain_score',
    'source',
    'job_url',
    'detected_at',
    'contact_name',
    'contact_title',
    'contact_seniority',
    'contact_email',
    'contact_email_status',
    'contact_phone',
    'contact_linkedin',
  ];

  const rows: string[] = [];

  for (const signal of signals) {
    const baseRow = [
      escapeField(signal.companies?.name),
      escapeField(signal.companies?.domain),
      escapeField(signal.companies?.industry),
      escapeField(signal.companies?.location),
      escapeField(signal.pain_signal_type),
      escapeField(signal.signal_title),
      escapeField(signal.signal_detail),
      escapeField(signal.urgency),
      String(signal.pain_score_contribution || 0),
      escapeField(signal.source),
      escapeField(signal.job_url),
      escapeField(signal.detected_at),
    ];

    // Get contacts for this signal's company
    const companyId = (signal as unknown as { company_id: string }).company_id;
    const contacts = contactsMap.get(companyId) || [];

    if (contacts.length > 0) {
      for (const contact of contacts) {
        rows.push([
          ...baseRow,
          escapeField(contact.full_name),
          escapeField(contact.job_title),
          escapeField(contact.seniority),
          escapeField(contact.email),
          escapeField(contact.email_status),
          escapeField(contact.phone),
          escapeField(contact.linkedin_url),
        ].join(','));
      }
    } else {
      rows.push([...baseRow, '', '', '', '', '', '', ''].join(','));
    }
  }

  return [headers.join(','), ...rows].join('\n');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user owns this ICP
  const { data: profile, error: profileError } = await supabase
    .from('icp_profiles')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'ICP profile not found' }, { status: 404 });
  }

  const adminSupabase = createAdminClient();

  // Get all signals for this ICP with company info
  const { data: signals, error: signalsError } = await adminSupabase
    .from('company_pain_signals')
    .select(`
      id,
      company_id,
      pain_signal_type,
      signal_title,
      signal_detail,
      signal_value,
      pain_score_contribution,
      urgency,
      detected_at,
      source,
      job_url,
      companies(name, domain, industry, location)
    `)
    .eq('icp_profile_id', id)
    .eq('is_active', true)
    .order('detected_at', { ascending: false });

  if (signalsError) {
    console.error('[ICP Export] Error fetching signals:', signalsError);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }

  // Get unique company IDs
  const companyIds = [...new Set((signals || []).map(s => s.company_id))];

  // Fetch contacts for all companies
  const contactsMap = new Map<string, Contact[]>();

  if (companyIds.length > 0) {
    const { data: contacts } = await adminSupabase
      .from('company_contacts')
      .select('company_id, full_name, job_title, seniority, email, email_status, phone, linkedin_url')
      .in('company_id', companyIds);

    for (const contact of (contacts || [])) {
      const existing = contactsMap.get(contact.company_id) || [];
      existing.push(contact as Contact);
      contactsMap.set(contact.company_id, existing);
    }
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'csv';

  if (format === 'json') {
    return NextResponse.json({
      icp_name: profile.name,
      signal_count: signals?.length || 0,
      signals: signals || [],
    });
  }

  // Default: CSV
  const csv = signalsToCsv((signals || []) as unknown as SignalWithCompany[], contactsMap);
  const timestamp = new Date().toISOString().split('T')[0];
  const safeName = profile.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="icp-${safeName}-signals-${timestamp}.csv"`,
    },
  });
}
