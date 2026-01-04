/**
 * ICP Profile Job Count API
 *
 * Returns estimated job counts from Reed and Adzuna APIs
 * without fetching all job data. Uses minimal API calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getReedJobCount } from '@/lib/job-boards';
import { getAdzunaJobCount } from '@/lib/adzuna';
import { ICPProfile } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Verify user owns this profile
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('icp_profiles')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const icpProfile = profile as ICPProfile;

  // Get roles and locations from profile
  const roles = icpProfile.specific_roles || [];
  const locations = icpProfile.locations.length > 0
    ? icpProfile.locations
    : ['London', 'Manchester', 'Birmingham'];

  if (roles.length === 0) {
    return NextResponse.json({
      success: true,
      counts: { reed: 0, adzuna: 0, total: 0 },
      message: 'No specific roles defined',
    });
  }

  // Count jobs from each source
  // Use first 3 roles and first 3 locations to estimate (6-9 API calls each)
  const sampleRoles = roles.slice(0, 3);
  const sampleLocations = locations.slice(0, 3);

  let reedTotal = 0;
  let adzunaTotal = 0;
  const seenCombos = new Set<string>();

  // Count Reed jobs (uses 1 API call per keyword+location)
  for (const role of sampleRoles) {
    for (const location of sampleLocations) {
      const key = `${role.toLowerCase()}|${location.toLowerCase()}`;
      if (seenCombos.has(key)) continue;
      seenCombos.add(key);

      try {
        const count = await getReedJobCount(role, location);
        reedTotal += count;
        // Small delay between calls
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        console.error(`[count-jobs] Reed error for ${role}/${location}:`, err);
      }
    }
  }

  // Count Adzuna jobs
  seenCombos.clear();
  for (const role of sampleRoles) {
    for (const location of sampleLocations) {
      const key = `${role.toLowerCase()}|${location.toLowerCase()}`;
      if (seenCombos.has(key)) continue;
      seenCombos.add(key);

      try {
        const count = await getAdzunaJobCount(role, location);
        adzunaTotal += count;
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        console.error(`[count-jobs] Adzuna error for ${role}/${location}:`, err);
      }
    }
  }

  // Extrapolate if we sampled less than the full set
  const roleMultiplier = roles.length / sampleRoles.length;
  const locationMultiplier = locations.length / sampleLocations.length;
  const extrapolationFactor = Math.sqrt(roleMultiplier * locationMultiplier);

  const estimatedReed = Math.round(reedTotal * extrapolationFactor);
  const estimatedAdzuna = Math.round(adzunaTotal * extrapolationFactor);

  return NextResponse.json({
    success: true,
    counts: {
      reed: estimatedReed,
      adzuna: estimatedAdzuna,
      total: estimatedReed + estimatedAdzuna,
    },
    sampled: {
      roles: sampleRoles.length,
      locations: sampleLocations.length,
      totalRoles: roles.length,
      totalLocations: locations.length,
    },
    isEstimate: roles.length > sampleRoles.length || locations.length > sampleLocations.length,
  });
}
