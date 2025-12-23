/**
 * ICP Profiles API
 * CRUD operations for Ideal Client Profiles
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ICPProfile } from '@/types';

// GET /api/icp - List all ICP profiles for the user
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profiles, error } = await supabase
    .from('icp_profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ICP API] Error fetching profiles:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profiles });
}

// POST /api/icp - Create new ICP profile
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Validate required fields
  if (!body.name) {
    return NextResponse.json({ error: 'Profile name is required' }, { status: 400 });
  }

  const profile: Partial<ICPProfile> = {
    user_id: user.id,
    name: body.name,
    industries: body.industries || [],
    role_categories: body.role_categories || [],
    specific_roles: body.specific_roles || [],
    seniority_levels: body.seniority_levels || [],
    locations: body.locations || [],
    employment_type: body.employment_type || 'both',
    signal_types: body.signal_types || [],
    company_size_min: body.company_size_min || null,
    company_size_max: body.company_size_max || null,
    exclude_keywords: body.exclude_keywords || [],
    // Contract/Tender config
    min_contract_value: body.min_contract_value || null,
    contract_sectors: body.contract_sectors || [],
    contract_keywords: body.contract_keywords || [],
    pull_frequency: body.pull_frequency || 'daily',
    is_active: body.is_active ?? true,
  };

  const { data, error } = await supabase
    .from('icp_profiles')
    .insert(profile)
    .select()
    .single();

  if (error) {
    console.error('[ICP API] Error creating profile:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data }, { status: 201 });
}
