import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, MapPin, Briefcase, Zap, Clock } from 'lucide-react';
import { ICPProfile } from '@/types';

export default async function ICPProfilesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: profiles } = await supabase
    .from('icp_profiles')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false });

  const icpProfiles = (profiles || []) as ICPProfile[];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0A2540]">ICP Profiles</h1>
          <p className="text-sm text-[#6B7C93] mt-1">
            Define your Ideal Client Profile to filter signals and data collection
          </p>
        </div>
        <Link href="/icp/new">
          <Button className="bg-[#635BFF] hover:bg-[#5851DF] text-white">
            <Plus className="h-4 w-4 mr-2" />
            New ICP Profile
          </Button>
        </Link>
      </div>

      {/* Profiles Grid */}
      {icpProfiles.length === 0 ? (
        <Card className="bg-white border-[#E3E8EE]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-[#6B7C93] mb-4" />
            <h3 className="text-lg font-semibold text-[#0A2540] mb-2">No ICP Profiles Yet</h3>
            <p className="text-sm text-[#6B7C93] text-center max-w-md mb-6">
              Create your first ICP profile to start receiving signals tailored to your recruitment niche.
              Define the roles, industries, and locations you focus on.
            </p>
            <Link href="/icp/new">
              <Button className="bg-[#635BFF] hover:bg-[#5851DF] text-white">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First ICP
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {icpProfiles.map((profile) => (
            <Link key={profile.id} href={`/icp/${profile.id}`}>
              <Card className="bg-white border-[#E3E8EE] hover:border-[#635BFF] hover:shadow-md transition-all cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg text-[#0A2540]">{profile.name}</CardTitle>
                      <CardDescription className="text-xs text-[#6B7C93]">
                        Created {new Date(profile.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge className={profile.is_active ? 'bg-[#D1FAE5] text-[#047857] border-0' : 'bg-[#F3F4F6] text-[#6B7C93] border-0'}>
                      {profile.is_active ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Industries */}
                  {profile.industries.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Briefcase className="h-4 w-4 text-[#6B7C93] mt-0.5 flex-shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {profile.industries.slice(0, 3).map((ind) => (
                          <Badge key={ind} variant="outline" className="text-xs bg-[#F6F9FC] border-[#E3E8EE]">
                            {ind}
                          </Badge>
                        ))}
                        {profile.industries.length > 3 && (
                          <Badge variant="outline" className="text-xs bg-[#F6F9FC] border-[#E3E8EE]">
                            +{profile.industries.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Locations */}
                  {profile.locations.length > 0 && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-[#6B7C93] mt-0.5 flex-shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {profile.locations.slice(0, 3).map((loc) => (
                          <Badge key={loc} variant="outline" className="text-xs bg-[#F6F9FC] border-[#E3E8EE]">
                            {loc}
                          </Badge>
                        ))}
                        {profile.locations.length > 3 && (
                          <Badge variant="outline" className="text-xs bg-[#F6F9FC] border-[#E3E8EE]">
                            +{profile.locations.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Signal Types */}
                  {profile.signal_types.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Zap className="h-4 w-4 text-[#6B7C93] mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-[#6B7C93]">
                        {profile.signal_types.length} signal type{profile.signal_types.length !== 1 ? 's' : ''} tracked
                      </span>
                    </div>
                  )}

                  {/* Pull Frequency */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#E3E8EE]">
                    <Clock className="h-4 w-4 text-[#6B7C93]" />
                    <span className="text-xs text-[#6B7C93]">
                      Updates {profile.pull_frequency}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
