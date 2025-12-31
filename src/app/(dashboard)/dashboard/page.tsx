import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Flame,
  Award,
  FileText,
  Building2,
  Clock,
  TrendingUp,
  Users,
  ArrowRight,
  RefreshCw,
  Calendar,
} from 'lucide-react';

// Cron schedules with human-readable descriptions
const CRON_JOBS = [
  { name: 'Job Ingestion (London)', schedule: 'Every 4 hours', icon: Flame, color: 'text-orange-500' },
  { name: 'Job Ingestion (Major Cities)', schedule: 'Every 2 hours', icon: Flame, color: 'text-orange-500' },
  { name: 'Pain Signal Generation', schedule: 'Every 2 hours (x:45)', icon: TrendingUp, color: 'text-red-500' },
  { name: 'Government Data', schedule: 'Daily at 5:00 AM', icon: FileText, color: 'text-blue-500' },
  { name: 'Companies House Signals', schedule: 'Daily at 5:30 AM', icon: Building2, color: 'text-purple-500' },
  { name: 'Contracts Finder Signals', schedule: 'Daily at 6:00 AM', icon: Award, color: 'text-green-500' },
  { name: 'ICP Job Rescan', schedule: '6 AM, 12 PM, 6 PM', icon: RefreshCw, color: 'text-indigo-500' },
];

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
    default: return <FileText className="h-4 w-4 text-gray-500" />;
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in</div>;
  }

  // Get signal counts by source
  const { data: signalsBySource } = await supabase
    .from('company_pain_signals')
    .select('source')
    .eq('is_active', true);

  const sourceCounts = (signalsBySource || []).reduce((acc, s) => {
    acc[s.source] = (acc[s.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get total companies with pain signals
  const { data: companiesWithPain } = await supabase
    .from('companies')
    .select('id')
    .gt('hiring_pain_score', 0);

  const totalCompanies = companiesWithPain?.length || 0;

  // Get critical companies (score >= 70)
  const { data: criticalCompanies } = await supabase
    .from('companies')
    .select('id')
    .gte('hiring_pain_score', 70);

  const criticalCount = criticalCompanies?.length || 0;

  // Get active ICP profiles for this user
  const { data: icpProfiles } = await supabase
    .from('icp_profiles')
    .select('id, name, signal_types, industries, locations')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // Get recent high-value signals (last 24 hours, sorted by pain score)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const { data: recentSignals } = await supabase
    .from('company_pain_signals')
    .select(`
      id, pain_signal_type, signal_title, urgency, source, detected_at,
      pain_score_contribution,
      companies:company_id(name, domain, hiring_pain_score)
    `)
    .eq('is_active', true)
    .gte('detected_at', yesterday.toISOString())
    .order('pain_score_contribution', { ascending: false })
    .limit(10);

  // Get signals created today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count: signalsToday } = await supabase
    .from('company_pain_signals')
    .select('*', { count: 'exact', head: true })
    .gte('detected_at', today.toISOString());

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

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Flame className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#0A2540]">{sourceCounts['job_board'] || 0}</div>
                <p className="text-xs text-[#6B7C93]">Job Board Signals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Award className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#0A2540]">{sourceCounts['contracts_finder'] || 0}</div>
                <p className="text-xs text-[#6B7C93]">Contract Signals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#0A2540]">{sourceCounts['companies_house'] || 0}</div>
                <p className="text-xs text-[#6B7C93]">Companies House</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#0A2540]">{criticalCount}</div>
                <p className="text-xs text-[#6B7C93]">Critical Companies (70+)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Activity */}
      <Card className="bg-gradient-to-r from-[#635BFF]/5 to-transparent border-[#635BFF]/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-[#635BFF]" />
              <div>
                <p className="text-sm font-medium text-[#0A2540]">Today&apos;s Activity</p>
                <p className="text-xs text-[#6B7C93]">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#635BFF]">{signalsToday || 0}</p>
              <p className="text-xs text-[#6B7C93]">new signals detected</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Cron Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#635BFF]" />
              Signal Collection Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {CRON_JOBS.map((job) => {
              const Icon = job.icon;
              return (
                <div key={job.name} className="flex items-center justify-between py-2 border-b border-[#E3E8EE] last:border-0">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${job.color}`} />
                    <span className="text-sm text-[#0A2540]">{job.name}</span>
                  </div>
                  <span className="text-xs text-[#6B7C93]">{job.schedule}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

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
                const companyData = signal.companies as unknown as { name: string; domain: string | null; hiring_pain_score: number } | null;
                const company = companyData;
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
              <Clock className="h-8 w-8 text-[#6B7C93] mx-auto mb-2" />
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
            <p className="text-2xl font-bold text-[#0A2540]">
              {Object.values(sourceCounts).reduce((a, b) => a + b, 0)}
            </p>
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
