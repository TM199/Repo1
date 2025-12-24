'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Briefcase, MapPin, Zap, Clock, Trash2, Play, Loader2, CheckCircle, AlertCircle, Building, Users } from 'lucide-react';
import { ICPProfile, ICPSignalType, ScanProgress } from '@/types';

const SIGNAL_TYPE_LABELS: Record<ICPSignalType, string> = {
  job_pain: 'Job Board Signals',
  contracts_awarded: 'Contracts Awarded',
  tenders: 'Large Tenders',
  planning: 'Planning Applications',
  leadership: 'Leadership Changes',
  funding: 'Funding Rounds',
};

interface Props {
  profile: ICPProfile;
}

export function ICPProfileDetail({ profile: initialProfile }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Poll for scan progress when status is 'scanning' or 'expanding'
  useEffect(() => {
    if (profile.scan_status !== 'scanning' && profile.scan_status !== 'expanding') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/icp/${profile.id}`);
        if (response.ok) {
          const data = await response.json();
          setProfile(data.profile);

          // Stop polling if scan is complete
          if (data.profile.scan_status !== 'scanning' && data.profile.scan_status !== 'expanding') {
            clearInterval(pollInterval);
            setIsScanning(false);
          }
        }
      } catch (error) {
        console.error('Error polling scan status:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [profile.id, profile.scan_status]);

  const handleToggleActive = async () => {
    setIsToggling(true);
    try {
      const response = await fetch(`/api/icp/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !profile.is_active }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
      }
    } catch (error) {
      console.error('Error toggling profile:', error);
    }
    setIsToggling(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this ICP profile?')) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/icp/${profile.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/icp');
      }
    } catch (error) {
      console.error('Error deleting profile:', error);
    }
    setIsDeleting(false);
  };

  const handleScan = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const response = await fetch(`/api/icp/${profile.id}/scan`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setScanError(data.error || 'Scan failed');
        setIsScanning(false);
        return;
      }

      // Update profile with new scan status
      setProfile(prev => ({
        ...prev,
        scan_status: 'scanning',
        scan_progress: {
          jobs_found: 0,
          companies_found: 0,
          signals_generated: 0,
          tasks_pending: 0,
          tasks_completed: 0,
          last_updated: new Date().toISOString(),
        },
      }));

      // Refresh profile data
      const profileResponse = await fetch(`/api/icp/${profile.id}`);
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setProfile(profileData.profile);
      }

    } catch (error) {
      console.error('Error scanning:', error);
      setScanError('Failed to start scan');
      setIsScanning(false);
    }
  };

  const getScanStatusBadge = () => {
    switch (profile.scan_status) {
      case 'scanning':
        return (
          <Badge className="bg-blue-100 text-blue-700 border-0">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Scanning...
          </Badge>
        );
      case 'expanding':
        return (
          <Badge className="bg-amber-100 text-amber-700 border-0">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Expanding... {profile.scan_progress?.jobs_found || 0} jobs
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-700 border-0">
            <CheckCircle className="h-3 w-3 mr-1" />
            Scan Complete
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-700 border-0">
            <AlertCircle className="h-3 w-3 mr-1" />
            Scan Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const scanProgress = profile.scan_progress as ScanProgress | undefined;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/icp">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#0A2540]">{profile.name}</h1>
              <Badge className={profile.is_active ? 'bg-[#D1FAE5] text-[#047857] border-0' : 'bg-[#F3F4F6] text-[#6B7C93] border-0'}>
                {profile.is_active ? 'Active' : 'Paused'}
              </Badge>
              {getScanStatusBadge()}
            </div>
            <p className="text-sm text-[#6B7C93]">
              Created {new Date(profile.created_at).toLocaleDateString()}
              {profile.last_synced_at && (
                <> · Last synced {new Date(profile.last_synced_at).toLocaleString()}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4">
            <span className="text-sm text-[#6B7C93]">Active</span>
            <Switch
              checked={profile.is_active}
              onCheckedChange={handleToggleActive}
              disabled={isToggling}
            />
          </div>
          <Button
            onClick={handleScan}
            disabled={isScanning || !profile.is_active || profile.scan_status === 'scanning' || profile.scan_status === 'expanding'}
            className="bg-[#635BFF] hover:bg-[#5851DF] text-white"
          >
            {isScanning || profile.scan_status === 'scanning' || profile.scan_status === 'expanding' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Scan Now
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-600 hover:bg-red-50"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Scan Error */}
      {scanError && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{scanError}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Progress */}
      {(profile.scan_status === 'scanning' || profile.scan_status === 'expanding' || profile.scan_status === 'completed') && scanProgress && (
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-[#0A2540]">
              {profile.scan_status === 'completed' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-[#635BFF]" />
              )}
              Scan Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-[#F6F9FC] rounded-lg">
                <div className="text-2xl font-bold text-[#0A2540]">{scanProgress.jobs_found}</div>
                <div className="text-xs text-[#6B7C93]">Jobs Found</div>
              </div>
              <div className="text-center p-3 bg-[#F6F9FC] rounded-lg">
                <div className="text-2xl font-bold text-[#0A2540]">{scanProgress.companies_found}</div>
                <div className="text-xs text-[#6B7C93]">Companies</div>
              </div>
              <div className="text-center p-3 bg-[#F6F9FC] rounded-lg">
                <div className="text-2xl font-bold text-[#0A2540]">{scanProgress.signals_generated}</div>
                <div className="text-xs text-[#6B7C93]">Signals</div>
              </div>
              {profile.scan_status === 'expanding' && (
                <div className="text-center p-3 bg-[#F6F9FC] rounded-lg">
                  <div className="text-2xl font-bold text-[#0A2540]">
                    {scanProgress.tasks_completed}/{scanProgress.tasks_completed + scanProgress.tasks_pending}
                  </div>
                  <div className="text-xs text-[#6B7C93]">Tasks</div>
                </div>
              )}
            </div>
            {profile.scan_status === 'expanding' && (
              <p className="text-xs text-[#6B7C93] mt-3 text-center">
                Background expansion in progress. Results are being added automatically.
              </p>
            )}
            {profile.scan_status === 'completed' && (
              <div className="flex justify-center mt-4">
                <Link href={`/pain?icp=${profile.id}`}>
                  <Button variant="outline" className="text-[#635BFF] border-[#635BFF]">
                    <Building className="h-4 w-4 mr-2" />
                    View Companies in Pain
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Profile Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Industries */}
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-[#0A2540]">
              <Briefcase className="h-4 w-4" />
              Industries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile.industries.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.industries.map((ind) => (
                  <Badge key={ind} variant="outline" className="bg-[#F6F9FC] border-[#E3E8EE]">
                    {ind}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#6B7C93]">No industries selected</p>
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
            {profile.locations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.locations.map((loc) => (
                  <Badge key={loc} variant="outline" className="bg-[#F6F9FC] border-[#E3E8EE]">
                    {loc}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#6B7C93]">No locations selected</p>
            )}
          </CardContent>
        </Card>

        {/* Specific Roles */}
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base text-[#0A2540]">Specific Roles</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.specific_roles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.specific_roles.map((role) => (
                  <Badge key={role} className="bg-[#EEF2FF] text-[#635BFF] border-0">
                    {role}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#6B7C93]">No specific roles defined</p>
            )}
          </CardContent>
        </Card>

        {/* Seniority Levels */}
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base text-[#0A2540]">Seniority Levels</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.seniority_levels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.seniority_levels.map((level) => (
                  <Badge key={level} variant="outline" className="bg-[#F6F9FC] border-[#E3E8EE]">
                    {level}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#6B7C93]">All seniority levels</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Signal Types */}
      <Card className="bg-white border-[#E3E8EE]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-[#0A2540]">
            <Zap className="h-4 w-4" />
            Signal Types Tracked
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {profile.signal_types.map((type) => (
              <div key={type} className="flex items-center gap-2 p-2 bg-[#F6F9FC] rounded-lg">
                <div className="w-2 h-2 rounded-full bg-[#635BFF]" />
                <span className="text-sm text-[#0A2540]">
                  {SIGNAL_TYPE_LABELS[type as ICPSignalType] || type}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Update Frequency */}
      <Card className="bg-white border-[#E3E8EE]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-[#0A2540]">
            <Clock className="h-4 w-4" />
            Update Frequency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#0A2540]">
            {profile.pull_frequency === 'hourly' && 'Updates every hour'}
            {profile.pull_frequency === 'every_4h' && 'Updates every 4 hours'}
            {profile.pull_frequency === 'daily' && 'Updates once per day'}
            {profile.pull_frequency === 'weekly' && 'Updates once per week'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
