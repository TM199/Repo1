/**
 * Companies in Pain Export API
 *
 * Exports companies with their pain signals and contacts as CSV or JSON.
 * For use with CRMs (HubSpot, Salesforce) or enrichment tools (Clay).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

interface CompanyContact {
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  seniority: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
}

interface PainSignal {
  pain_signal_type: string;
  signal_title: string;
  pain_score_contribution: number;
  urgency: string | null;
  job_url: string | null;
  detected_at: string;
}

interface ExportCompany {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  location: string | null;
  total_pain_score: number;
  last_enriched_at: string | null;
  company_pain_signals: PainSignal[];
  company_contacts?: CompanyContact[];
}

const escapeField = (value: string | null | undefined): string => {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

function companiesToCsv(companies: ExportCompany[]): string {
  const headers = [
    'company_name',
    'company_domain',
    'industry',
    'location',
    'total_pain_score',
    'top_signal_type',
    'top_signal_title',
    'top_signal_urgency',
    'job_url',
    'signals_count',
    'contact_name',
    'contact_title',
    'contact_seniority',
    'contact_email',
    'contact_email_status',
    'contact_phone',
    'contact_linkedin',
    'last_enriched_at',
  ];

  const rows: string[] = [];

  for (const company of companies) {
    // Get top signal (highest pain score contribution)
    const topSignal = company.company_pain_signals?.sort(
      (a, b) => b.pain_score_contribution - a.pain_score_contribution
    )[0];

    const baseRow = [
      escapeField(company.name),
      escapeField(company.domain),
      escapeField(company.industry),
      escapeField(company.location),
      String(company.total_pain_score || 0),
      escapeField(topSignal?.pain_signal_type),
      escapeField(topSignal?.signal_title),
      escapeField(topSignal?.urgency),
      escapeField(topSignal?.job_url),
      String(company.company_pain_signals?.length || 0),
    ];

    const contacts = company.company_contacts || [];

    if (contacts.length > 0) {
      // One row per contact
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
          escapeField(company.last_enriched_at),
        ].join(','));
      }
    } else {
      // Company without contacts
      rows.push([...baseRow, '', '', '', '', '', '', '', escapeField(company.last_enriched_at)].join(','));
    }
  }

  return [headers.join(','), ...rows].join('\n');
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'csv';
  const minPainScore = parseInt(searchParams.get('minPainScore') || '0');
  const enrichedOnly = searchParams.get('enrichedOnly') === 'true';

  const adminSupabase = createAdminClient();

  // Build query
  let query = adminSupabase
    .from('companies')
    .select(`
      id,
      name,
      domain,
      industry,
      location,
      total_pain_score,
      last_enriched_at,
      company_pain_signals(
        pain_signal_type,
        signal_title,
        pain_score_contribution,
        urgency,
        job_url,
        detected_at
      )
    `)
    .gte('total_pain_score', minPainScore)
    .order('total_pain_score', { ascending: false });

  if (enrichedOnly) {
    query = query.not('last_enriched_at', 'is', null);
  }

  const { data: companies, error } = await query;

  if (error) {
    console.error('[export] Query error:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }

  // Fetch contacts separately (table may not exist)
  const companiesWithContacts: ExportCompany[] = [];

  for (const company of (companies || [])) {
    let contacts: CompanyContact[] = [];
    try {
      const { data: contactsData } = await adminSupabase
        .from('company_contacts')
        .select('full_name, first_name, last_name, job_title, seniority, email, email_status, phone, linkedin_url')
        .eq('company_id', company.id);
      contacts = (contactsData || []) as CompanyContact[];
    } catch {
      // Table doesn't exist yet
    }

    companiesWithContacts.push({
      ...company,
      company_contacts: contacts,
    } as ExportCompany);
  }

  if (format === 'json') {
    return NextResponse.json(companiesWithContacts);
  }

  // Default: CSV
  const csv = companiesToCsv(companiesWithContacts);
  const timestamp = new Date().toISOString().split('T')[0];

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="companies-in-pain-${timestamp}.csv"`,
    },
  });
}
