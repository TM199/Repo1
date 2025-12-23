'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Briefcase, MapPin, Zap, Clock, Trash2, Play, Loader2 } from 'lucide-react';
import { ICPProfile, ICPSignalType } from '@/types';

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
    try {
      // For now, redirect to pain dashboard
      // TODO: Trigger actual scan based on ICP
      router.push(`/pain?industry=${encodeURIComponent(profile.industries[0] || '')}`);
    } catch (error) {
      console.error('Error scanning:', error);
      setIsScanning(false);
    }
  };

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
            disabled={isScanning || !profile.is_active}
            className="bg-[#635BFF] hover:bg-[#5851DF] text-white"
          >
            {isScanning ? (
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
