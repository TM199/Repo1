import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Edit, Trash2, Clock, Calendar, Target, MapPin, Briefcase, Building2, Filter } from 'lucide-react';
import { DeleteProfileButton } from './DeleteProfileButton';
import { AnalyzeButton } from './AnalyzeButton';

interface SearchProfile {
  id: string;
  name: string;
  industry: string;
  role_categories: string[];
  specific_roles: string[];
  seniority_levels: string[];
  locations: string[];
  signal_types: string[];
  target_company_types?: string;
  additional_keywords: string[];
  excluded_keywords: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface SearchRun {
  id: string;
  run_at: string;
  signals_found: number;
  status: string;
}

export default async function SearchProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch the profile
  const { data: profile, error } = await supabase
    .from('search_profiles')
    .select('*')
    .eq('id', id)
    .eq('user_id', user?.id)
    .single();

  if (error || !profile) {
    notFound();
  }

  // Fetch recent search runs
  const { data: searchRuns } = await supabase
    .from('search_runs')
    .select('*')
    .eq('search_profile_id', id)
    .eq('user_id', user?.id)
    .order('run_at', { ascending: false })
    .limit(5);

  const profileData = profile as SearchProfile;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-[#0A2540]">{profileData.name}</h1>
            <Badge className="bg-[#EEF2FF] text-[#635BFF] border-0">
              {profileData.industry}
            </Badge>
          </div>
          <p className="text-sm text-[#6B7C93]">
            Created {new Date(profileData.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AnalyzeButton profileId={id} industry={profileData.industry} />
          <Link href={`/search/${id}/run`}>
            <Button className="bg-[#635BFF] hover:bg-[#5851DF] text-white">
              <Play className="h-4 w-4 mr-2" />
              Run Search
            </Button>
          </Link>
          <DeleteProfileButton profileId={id} />
        </div>
      </div>

      {/* Profile Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Roles */}
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-[#0A2540]">
              <Briefcase className="h-4 w-4" />
              Roles & Seniority
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profileData.specific_roles && profileData.specific_roles.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[#6B7C93] mb-2">Specific Roles</p>
                <div className="flex flex-wrap gap-2">
                  {profileData.specific_roles.map((role) => (
                    <Badge key={role} variant="outline" className="text-xs bg-[#F6F9FC] border-[#E3E8EE]">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {profileData.seniority_levels && profileData.seniority_levels.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[#6B7C93] mb-2">Seniority Levels</p>
                <div className="flex flex-wrap gap-2">
                  {profileData.seniority_levels.map((level) => (
                    <Badge key={level} variant="outline" className="text-xs bg-[#F6F9FC] border-[#E3E8EE]">
                      {level}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Locations */}
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-[#0A2540]">
              <MapPin className="h-4 w-4" />
              Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profileData.locations && profileData.locations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profileData.locations.map((location) => (
                  <Badge key={location} variant="outline" className="text-xs bg-[#F6F9FC] border-[#E3E8EE]">
                    {location}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#6B7C93]">No specific locations</p>
            )}
          </CardContent>
        </Card>

        {/* Signal Types */}
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-[#0A2540]">
              <Target className="h-4 w-4" />
              Signal Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profileData.signal_types && profileData.signal_types.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profileData.signal_types.map((type) => (
                  <Badge key={type} variant="outline" className="text-xs bg-[#EEF2FF] text-[#635BFF] border-[#E3E8EE]">
                    {type.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#6B7C93]">All signal types</p>
            )}
          </CardContent>
        </Card>

        {/* Company Types */}
        {profileData.target_company_types && (
          <Card className="bg-white border-[#E3E8EE]">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-[#0A2540]">
                <Building2 className="h-4 w-4" />
                Company Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#0A2540]">{profileData.target_company_types}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Keywords */}
      {((profileData.additional_keywords && profileData.additional_keywords.length > 0) ||
        (profileData.excluded_keywords && profileData.excluded_keywords.length > 0)) && (
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-[#0A2540]">
              <Filter className="h-4 w-4" />
              Keywords
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profileData.additional_keywords && profileData.additional_keywords.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[#6B7C93] mb-2">Include</p>
                <div className="flex flex-wrap gap-2">
                  {profileData.additional_keywords.map((keyword) => (
                    <Badge key={keyword} className="text-xs bg-[#D1FAE5] text-[#047857] border-0">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {profileData.excluded_keywords && profileData.excluded_keywords.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[#6B7C93] mb-2">Exclude</p>
                <div className="flex flex-wrap gap-2">
                  {profileData.excluded_keywords.map((keyword) => (
                    <Badge key={keyword} className="text-xs bg-[#FEE2E2] text-[#CD3D64] border-0">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {profileData.notes && (
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base text-[#0A2540]">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#6B7C93] whitespace-pre-wrap">{profileData.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Recent Search Runs */}
      <Card className="bg-white border-[#E3E8EE]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-[#0A2540]">
            <Clock className="h-4 w-4" />
            Recent Search Runs
          </CardTitle>
          <CardDescription className="text-sm text-[#6B7C93]">
            History of searches executed with this profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          {searchRuns && searchRuns.length > 0 ? (
            <div className="space-y-2">
              {searchRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 bg-[#F6F9FC] rounded-lg border border-[#E3E8EE]"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-[#6B7C93]" />
                    <div>
                      <p className="text-sm font-medium text-[#0A2540]">
                        {new Date(run.run_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-[#6B7C93]">
                        {run.signals_found} signals found
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={`text-xs ${
                      run.status === 'completed'
                        ? 'bg-[#D1FAE5] text-[#047857] border-0'
                        : run.status === 'failed'
                        ? 'bg-[#FEE2E2] text-[#CD3D64] border-0'
                        : 'bg-[#FEF3C7] text-[#92400E] border-0'
                    }`}
                  >
                    {run.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#6B7C93] text-center py-6">
              No search runs yet. Click "Run Search" to execute this profile.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
