import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Flame,
  Award,
  Building2,
  TrendingUp,
  Users,
  ArrowRight,
} from 'lucide-react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { QuickActions } from '@/components/dashboard/QuickActions';

function getSignalTypeLabel(type: string): string {
  if (type.startsWith('hard_to_fill')) return 'Hard to Fill Role';
  if (type.startsWith('contract_awarded')) return 'Contract Awarded';
  if (type.includes('leadership')) return 'Leadership Change';
  if (type.includes('repost')) return 'Job Reposted';
  if (type.includes('salary')) return 'Salary Increase';
  return type.replace(/_/g, ' ');
}

function getSignalIcon(source: string) {
  switch (source) {
    case 'job_board': return <Flame className="h-4 w-4 text-orange-500" />;
    case 'contracts_finder': return <Award className="h-4 w-4 text-green-500" />;
    case 'companies_house': return <Building2 className="h-4 w-4 text-purple-500" />;
    default: return <Flame className="h-4 w-4 text-gray-500" />;
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in</div>;
  }

  // Get active ICP profiles for this user FIRST (needed for filtering)
  const { data: icpProfiles } = await supabase
    .from('icp_profiles')
    .select('id, name, signal_types, industries, locations')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const userIcpIds = (icpProfiles || []).map(icp => icp.id);

  // Get signal counts by source (only for user's ICPs)
  let signalsBySource: { source: string }[] = [];
  if (userIcpIds.length > 0) {
    const { data } = await supabase
      .from('company_pain_signals')
      .select('source')
      .eq('is_active', true)
      .in('icp_profile_id', userIcpIds);
    signalsBySource = data || [];
  }

  const sourceCounts = signalsBySource.reduce((acc, s) => {
    acc[s.source] = (acc[s.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get unique companies with pain signals for user's ICPs
  let totalCompanies = 0;
  let criticalCount = 0;
  if (userIcpIds.length > 0) {
    const { data: signalsWithCompanies } = await supabase
      .from('company_pain_signals')
      .select('company_id, companies:company_id(hiring_pain_score)')
      .eq('is_active', true)
      .in('icp_profile_id', userIcpIds);

    const uniqueCompanies = new Map<string, number>();
    for (const signal of (signalsWithCompanies || [])) {
      const company = signal.companies as unknown as { hiring_pain_score: number } | null;
      if (company && !uniqueCompanies.has(signal.company_id)) {
        uniqueCompanies.set(signal.company_id, company.hiring_pain_score || 0);
      }
    }
    totalCompanies = uniqueCompanies.size;
    criticalCount = Array.from(uniqueCompanies.values()).filter(score => score >= 70).length;
  }

  // Get recent high-value signals (last 24 hours, only for user's ICPs)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  interface RecentSignal {
    id: string;
    pain_signal_type: string;
    signal_title: string;
    urgency: string;
    source: string;
    detected_at: string;
    pain_score_contribution: number;
    companies: { name: string; domain: string | null; hiring_pain_score: number } | null;
  }

  let recentSignals: RecentSignal[] = [];
  if (userIcpIds.length > 0) {
    const { data } = await supabase
      .from('company_pain_signals')
      .select(`
        id, pain_signal_type, signal_title, urgency, source, detected_at,
        pain_score_contribution,
        companies:company_id(name, domain, hiring_pain_score)
      `)
      .eq('is_active', true)
      .in('icp_profile_id', userIcpIds)
      .gte('detected_at', yesterday.toISOString())
      .order('pain_score_contribution', { ascending: false })
      .limit(10);
    recentSignals = (data || []) as unknown as RecentSignal[];
  }

  // Calculate total signals
  const totalSignals = Object.values(sourceCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0A2540]">Dashboard</h1>
        <Link href="/pain">
          <Button className="bg-[#635BFF] hover:bg-[#5851DF] text-white">
            View All Signals
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>

      {/* Animated Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          title="Total Signals"
          value={totalSignals}
          icon={<TrendingUp className="h-5 w-5" />}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
        />
        <StatsCard
          title="Job Board Signals"
          value={sourceCounts['job_board'] || 0}
          icon={<Flame className="h-5 w-5" />}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
        />
        <StatsCard
          title="Contract Signals"
          value={sourceCounts['contracts_finder'] || 0}
          icon={<Award className="h-5 w-5" />}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
        />
        <StatsCard
          title="Critical Companies"
          value={criticalCount}
          icon={<TrendingUp className="h-5 w-5" />}
          iconBgColor="bg-red-100"
          iconColor="text-red-600"
        />
      </div>

      {/* Quick Actions + Activity Feed */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* Quick Actions */}
          <QuickActions />

          {/* Active ICP Profiles */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#635BFF]" />
                  Your ICP Profiles
                </CardTitle>
                <Link href="/icp/new">
                  <Button size="sm" variant="outline" className="text-xs">
                    + New ICP
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {icpProfiles && icpProfiles.length > 0 ? (
                <div className="space-y-3">
                  {icpProfiles.slice(0, 4).map((icp) => (
                    <Link key={icp.id} href={`/icp/${icp.id}`}>
                      <div className="p-3 bg-[#F6F9FC] rounded-lg hover:bg-[#E3E8EE] transition-colors cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm text-[#0A2540]">{icp.name}</span>
                          <ArrowRight className="h-4 w-4 text-[#6B7C93]" />
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {icp.signal_types?.slice(0, 3).map((type: string) => (
                            <Badge key={type} variant="outline" className="text-[10px] bg-white">
                              {type.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                          {(icp.signal_types?.length || 0) > 3 && (
                            <Badge variant="outline" className="text-[10px] bg-white">
                              +{icp.signal_types.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Users className="h-8 w-8 text-[#6B7C93] mx-auto mb-2" />
                  <p className="text-sm text-[#6B7C93]">No ICP profiles yet</p>
                  <Link href="/icp/new">
                    <Button size="sm" className="mt-2 bg-[#635BFF]">
                      Create Your First ICP
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed Sidebar */}
        <div className="col-span-1">
          <ActivityFeed />
        </div>
      </div>

      {/* Recent High-Value Signals */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#635BFF]" />
              Recent High-Value Signals (Last 24 Hours)
            </CardTitle>
            <Link href="/pain">
              <Button size="sm" variant="ghost" className="text-xs text-[#635BFF]">
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentSignals && recentSignals.length > 0 ? (
            <div className="space-y-2">
              {recentSignals.map((signal) => {
                const company = signal.companies;
                return (
                  <div key={signal.id} className="flex items-center justify-between py-2 border-b border-[#E3E8EE] last:border-0">
                    <div className="flex items-center gap-3">
                      {getSignalIcon(signal.source)}
                      <div>
                        <p className="text-sm font-medium text-[#0A2540]">
                          {company?.name || 'Unknown Company'}
                        </p>
                        <p className="text-xs text-[#6B7C93]">
                          {signal.signal_title || getSignalTypeLabel(signal.pain_signal_type)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={signal.urgency === 'immediate' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {signal.urgency?.replace('_', ' ') || 'normal'}
                      </Badge>
                      {company?.hiring_pain_score && (
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          company.hiring_pain_score >= 70 ? 'bg-red-100 text-red-700' :
                          company.hiring_pain_score >= 40 ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {company.hiring_pain_score}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="h-8 w-8 text-[#6B7C93] mx-auto mb-2" />
              <p className="text-sm text-[#6B7C93]">No signals in the last 24 hours</p>
              <p className="text-xs text-[#6B7C93] mt-1">New signals are collected automatically throughout the day</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#F6F9FC]">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-[#0A2540]">{totalCompanies}</p>
            <p className="text-xs text-[#6B7C93]">Total Companies Tracked</p>
          </CardContent>
        </Card>
        <Card className="bg-[#F6F9FC]">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-[#0A2540]">{totalSignals}</p>
            <p className="text-xs text-[#6B7C93]">Total Active Signals</p>
          </CardContent>
        </Card>
        <Card className="bg-[#F6F9FC]">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-[#0A2540]">{icpProfiles?.length || 0}</p>
            <p className="text-xs text-[#6B7C93]">Active ICP Profiles</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
