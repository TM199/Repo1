'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Briefcase, MapPin, Zap, Clock, Trash2, Play, Loader2, CheckCircle, AlertCircle, Building, Users, Search, Sparkles, Pencil, Download, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: initialProfile.name,
    industries: initialProfile.industries.join(', '),
    locations: initialProfile.locations.join(', '),
    specific_roles: initialProfile.specific_roles.join(', '),
  });
  const [isSaving, setIsSaving] = useState(false);
  const prevScanStatus = useRef(initialProfile.scan_status);

  // Delete modal state
  const [deleteStats, setDeleteStats] = useState<{ total_signals: number; total_companies: number; enriched_companies: number; unenriched_companies: number } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ current: number; total: number; company?: string } | null>(null);
  const [exportComplete, setExportComplete] = useState(false);

  // Poll for scan progress when status is 'scanning' or 'expanding'
  useEffect(() => {
    if (profile.scan_status !== 'scanning' && profile.scan_status !== 'expanding') {
      return;
    }

    const MAX_POLL_TIME = 5 * 60 * 1000; // 5 minutes max
    const POLL_INTERVAL = 3000; // 3 seconds
    const startTime = Date.now();

    const pollInterval = setInterval(async () => {
      // Check timeout
      if (Date.now() - startTime > MAX_POLL_TIME) {
        clearInterval(pollInterval);
        setIsScanning(false);
        setScanError('Scan timed out. Please try again or contact support.');
        return;
      }

      try {
        const response = await fetch(`/api/icp/${profile.id}`);
        if (response.ok) {
          const data = await response.json();
          setProfile(data.profile);

          // Stop polling if scan is complete or failed
          if (data.profile.scan_status !== 'scanning' && data.profile.scan_status !== 'expanding') {
            clearInterval(pollInterval);
            setIsScanning(false);
            if (data.profile.scan_status === 'failed') {
              setScanError('Scan failed. Please try again.');
            }
          }
        }
      } catch (error) {
        console.error('Error polling scan status:', error);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(pollInterval);
  }, [profile.id, profile.scan_status]);

  // Show success banner and auto-navigate when scan completes with signals
  useEffect(() => {
    const wasScanning = prevScanStatus.current === 'scanning' || prevScanStatus.current === 'expanding';
    const isNowComplete = profile.scan_status === 'completed';
    const progress = profile.scan_progress as ScanProgress | undefined;
    const hasSignals = progress && progress.signals_generated > 0;

    if (wasScanning && isNowComplete && hasSignals) {
      setShowSuccessBanner(true);
      // Auto-navigate to pain page after 4 seconds
      const timer = setTimeout(() => {
        router.push(`/pain?icp=${profile.id}`);
      }, 4000);
      return () => clearTimeout(timer);
    }

    prevScanStatus.current = profile.scan_status;
  }, [profile.scan_status, profile.scan_progress, profile.id, router]);

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
    setShowDeleteModal(false);
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/icp/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          industries: editForm.industries.split(',').map(s => s.trim()).filter(Boolean),
          locations: editForm.locations.split(',').map(s => s.trim()).filter(Boolean),
          specific_roles: editForm.specific_roles.split(',').map(s => s.trim()).filter(Boolean),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        setEditMode(false);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
    }
    setIsSaving(false);
  };

  const handleCancelEdit = () => {
    setEditForm({
      name: profile.name,
      industries: profile.industries.join(', '),
      locations: profile.locations.join(', '),
      specific_roles: profile.specific_roles.join(', '),
    });
    setEditMode(false);
  };

  // Fetch stats when delete modal opens
  const handleOpenDeleteModal = async () => {
    setShowDeleteModal(true);
    setIsLoadingStats(true);
    setExportComplete(false);
    setEnrichProgress(null);

    try {
      const response = await fetch(`/api/icp/${profile.id}/bulk-enrich`);
      if (response.ok) {
        const data = await response.json();
        setDeleteStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
    setIsLoadingStats(false);
  };

  // Export signals as CSV
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/icp/${profile.id}/export`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `icp-${profile.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-signals.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setExportComplete(true);
      }
    } catch (error) {
      console.error('Error exporting:', error);
    }
    setIsExporting(false);
  };

  // Enrich all signals then export
  const handleEnrichAndExport = async () => {
    setIsEnriching(true);
    setEnrichProgress({ current: 0, total: deleteStats?.unenriched_companies || 0 });

    try {
      const response = await fetch(`/api/icp/${profile.id}/bulk-enrich`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to enrich');
        setIsEnriching(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'progress') {
                  setEnrichProgress({
                    current: data.current,
                    total: data.total,
                    company: data.company,
                  });
                } else if (data.type === 'complete') {
                  // Enrichment complete, now export
                  setIsEnriching(false);
                  await handleExport();
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error enriching:', error);
    }
    setIsEnriching(false);
  };

  const handleCloseDeleteModal = () => {
    if (!isDeleting && !isEnriching && !isExporting) {
      setShowDeleteModal(false);
      setDeleteStats(null);
      setExportComplete(false);
      setEnrichProgress(null);
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
              {editMode ? (
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="text-2xl font-bold text-[#0A2540] h-10 w-64"
                />
              ) : (
                <h1 className="text-2xl font-bold text-[#0A2540]">{profile.name}</h1>
              )}
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
            onClick={() => setEditMode(true)}
            disabled={editMode}
            className="text-[#635BFF] hover:bg-[#EEF2FF]"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenDeleteModal}
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

      {/* Edit Mode Banner */}
      {editMode && (
        <Card className="bg-[#EEF2FF] border-[#635BFF]">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-[#635BFF]" />
                <span className="text-sm font-medium text-[#635BFF]">Edit Mode</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-[#635BFF] hover:bg-[#5851DF] text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Error */}
      {scanError && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{scanError}</span>
              </div>
              <Button
                onClick={() => {
                  setScanError(null);
                  handleScan();
                }}
                variant="outline"
                size="sm"
                className="text-red-700 border-red-300 hover:bg-red-100"
              >
                Retry Scan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Banner with Auto-Navigate */}
      {showSuccessBanner && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 overflow-hidden">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-900">
                    {scanProgress?.signals_generated || 0} Companies in Pain Found!
                  </h3>
                  <p className="text-sm text-green-700">
                    Taking you to your results...
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => router.push(`/pain?icp=${profile.id}`)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Building className="h-4 w-4 mr-2" />
                  View Now
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSuccessBanner(false)}
                  className="border-green-300 text-green-700 hover:bg-green-100"
                >
                  Stay Here
                </Button>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-1 bg-green-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 animate-[progress_4s_linear]" style={{ width: '100%' }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Progress - Show during any scan state */}
      {(profile.scan_status === 'scanning' || profile.scan_status === 'expanding' || profile.scan_status === 'completed') && (
        <Card className={`border-[#E3E8EE] ${profile.scan_status === 'scanning' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200' : 'bg-white'}`}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-[#0A2540]">
              {profile.scan_status === 'completed' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : profile.scan_status === 'scanning' ? (
                <Search className="h-4 w-4 animate-pulse text-blue-600" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-[#635BFF]" />
              )}
              {profile.scan_status === 'scanning' ? 'Searching Job Boards...' :
               profile.scan_status === 'expanding' ? 'Expanding Results...' : 'Scan Results'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile.scan_status === 'scanning' && !scanProgress?.jobs_found ? (
              /* Show searching animation when no results yet */
              <div className="text-center py-6">
                <div className="inline-flex items-center gap-3 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span className="text-sm text-[#0A2540]">Searching {profile.locations.length} locations for {profile.specific_roles.length} roles...</span>
                </div>
                <div className="flex justify-center gap-2">
                  {profile.locations.slice(0, 4).map((loc) => (
                    <Badge key={loc} variant="outline" className="bg-white/50 text-xs">
                      {loc}
                    </Badge>
                  ))}
                  {profile.locations.length > 4 && (
                    <Badge variant="outline" className="bg-white/50 text-xs">
                      +{profile.locations.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              /* Show stats when we have results */
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-[#F6F9FC] rounded-lg">
                    <div className="text-2xl font-bold text-[#0A2540]">{scanProgress?.jobs_found || 0}</div>
                    <div className="text-xs text-[#6B7C93]">Jobs Found</div>
                  </div>
                  <div className="text-center p-3 bg-[#F6F9FC] rounded-lg">
                    <div className="text-2xl font-bold text-[#0A2540]">{scanProgress?.companies_found || 0}</div>
                    <div className="text-xs text-[#6B7C93]">Companies</div>
                  </div>
                  <div className="text-center p-3 bg-[#F6F9FC] rounded-lg">
                    <div className="text-2xl font-bold text-[#635BFF]">{scanProgress?.signals_generated || 0}</div>
                    <div className="text-xs text-[#6B7C93]">Pain Signals</div>
                  </div>
                  {profile.scan_status === 'expanding' && (
                    <div className="text-center p-3 bg-[#F6F9FC] rounded-lg">
                      <div className="text-2xl font-bold text-[#0A2540]">
                        {(scanProgress?.tasks_completed || 0)}/{(scanProgress?.tasks_completed || 0) + (scanProgress?.tasks_pending || 0)}
                      </div>
                      <div className="text-xs text-[#6B7C93]">Tasks</div>
                    </div>
                  )}
                </div>
                {profile.scan_status === 'expanding' && (
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div className="flex items-center gap-2 text-amber-800 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Background expansion in progress. New results are being added automatically.</span>
                    </div>
                  </div>
                )}
                {profile.scan_status === 'completed' && !showSuccessBanner && (
                  <div className="flex justify-center mt-4">
                    <Link href={`/pain?icp=${profile.id}`}>
                      <Button className="bg-[#635BFF] hover:bg-[#5851DF] text-white">
                        <Building className="h-4 w-4 mr-2" />
                        View Companies in Pain
                      </Button>
                    </Link>
                  </div>
                )}
              </>
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
            {editMode ? (
              <Textarea
                value={editForm.industries}
                onChange={(e) => setEditForm({ ...editForm, industries: e.target.value })}
                placeholder="Technology, Healthcare, Finance (comma-separated)"
                className="min-h-[80px]"
              />
            ) : profile.industries.length > 0 ? (
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
            {editMode ? (
              <Textarea
                value={editForm.locations}
                onChange={(e) => setEditForm({ ...editForm, locations: e.target.value })}
                placeholder="London, Manchester, Birmingham (comma-separated)"
                className="min-h-[80px]"
              />
            ) : profile.locations.length > 0 ? (
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
            {editMode ? (
              <Textarea
                value={editForm.specific_roles}
                onChange={(e) => setEditForm({ ...editForm, specific_roles: e.target.value })}
                placeholder="Software Engineer, DevOps, Data Analyst (comma-separated)"
                className="min-h-[80px]"
              />
            ) : profile.specific_roles.length > 0 ? (
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-lg mx-4 bg-white">
            <CardHeader>
              <CardTitle className="text-[#0A2540] flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Delete ICP Profile?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Warning */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Warning:</strong> Deleting <span className="font-medium">"{profile.name}"</span> will permanently remove all associated pain signals. This cannot be undone.
                </p>
              </div>

              {/* Stats */}
              {isLoadingStats ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-[#6B7C93]" />
                  <span className="ml-2 text-sm text-[#6B7C93]">Loading stats...</span>
                </div>
              ) : deleteStats && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-[#F6F9FC] rounded-lg text-center">
                    <div className="text-xl font-bold text-[#0A2540]">{deleteStats.total_signals}</div>
                    <div className="text-xs text-[#6B7C93]">Pain Signals</div>
                  </div>
                  <div className="p-3 bg-[#F6F9FC] rounded-lg text-center">
                    <div className="text-xl font-bold text-[#0A2540]">{deleteStats.total_companies}</div>
                    <div className="text-xs text-[#6B7C93]">Companies</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <div className="text-xl font-bold text-green-700">{deleteStats.enriched_companies}</div>
                    <div className="text-xs text-green-600">Enriched</div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg text-center">
                    <div className="text-xl font-bold text-amber-700">{deleteStats.unenriched_companies}</div>
                    <div className="text-xs text-amber-600">Not Enriched</div>
                  </div>
                </div>
              )}

              {/* Enrichment Progress */}
              {isEnriching && enrichProgress && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-800">
                      Enriching {enrichProgress.current} of {enrichProgress.total}...
                    </span>
                  </div>
                  {enrichProgress.company && (
                    <p className="text-xs text-blue-600 truncate">{enrichProgress.company}</p>
                  )}
                  <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${(enrichProgress.current / enrichProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Export Success */}
              {exportComplete && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-800">Export downloaded successfully!</span>
                </div>
              )}

              {/* Export Options */}
              {deleteStats && deleteStats.total_signals > 0 && !isEnriching && (
                <div className="space-y-2">
                  <p className="text-sm text-[#6B7C93] font-medium">Before deleting, you can:</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleExport}
                      disabled={isExporting || isEnriching}
                      className="flex-1"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV
                        </>
                      )}
                    </Button>
                    {deleteStats.unenriched_companies > 0 && (
                      <Button
                        variant="outline"
                        onClick={handleEnrichAndExport}
                        disabled={isExporting || isEnriching}
                        className="flex-1 text-[#635BFF] border-[#635BFF] hover:bg-[#EEF2FF]"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Enrich & Export
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={handleCloseDeleteModal}
                  disabled={isDeleting || isEnriching || isExporting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting || isEnriching || isExporting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Forever
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
