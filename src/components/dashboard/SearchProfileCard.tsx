'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchProfile } from '@/types';
import { Play, Trash2, Edit, Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { getIndustryLabel, getLocationLabel, getSignalTypeConfig } from '@/lib/signal-mapping';

interface SearchProfileCardProps {
  profile: SearchProfile;
  lastRunDate?: string | null;
}

export function SearchProfileCard({ profile, lastRunDate }: SearchProfileCardProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ newSignals?: number; error?: string } | null>(null);

  async function handleRun() {
    setRunning(true);
    setResult(null);

    try {
      const response = await fetch('/api/search/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile.id }),
      });

      const data = await response.json();
      setResult(data);
      setRunning(false);
      router.refresh();
    } catch (error) {
      setResult({ error: 'Failed to run search' });
      setRunning(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete "${profile.name}"?`)) return;

    try {
      await fetch(`/api/search/profiles/${profile.id}`, {
        method: 'DELETE',
      });

      router.refresh();
    } catch (error) {
      alert('Failed to delete search profile');
    }
  }

  function handleEdit() {
    router.push(`/search/${profile.id}`);
  }

  return (
    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-all duration-200 group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-foreground text-sm">{profile.name}</h3>
              <Badge
                variant="outline"
                className={`text-[10px] font-medium px-2 py-0.5 border-0 ${
                  profile.is_active
                    ? 'bg-[#D1FAE5] text-[#047857]'
                    : 'bg-[#F0F3F7] text-muted-foreground'
                }`}
              >
                {profile.is_active ? 'Active' : 'Paused'}
              </Badge>
            </div>

            <div className="mb-3">
              <Badge className="bg-primary/10 text-primary text-[10px] font-medium px-2 py-0.5 border-0">
                {getIndustryLabel(profile.industry)}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {profile.locations.slice(0, 3).map(loc => (
                <Badge
                  key={loc}
                  variant="outline"
                  className="text-[10px] bg-muted text-muted-foreground border-border px-2 py-0.5"
                >
                  {getLocationLabel(loc)}
                </Badge>
              ))}
              {profile.locations.length > 3 && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-muted text-muted-foreground border-border px-2 py-0.5"
                >
                  +{profile.locations.length - 3} more
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {profile.signal_types.slice(0, 3).map(signalType => {
                const config = getSignalTypeConfig(signalType);
                return (
                  <Badge
                    key={signalType}
                    variant="outline"
                    className="text-[10px] bg-card text-muted-foreground border-border px-2 py-0.5"
                  >
                    {config?.icon} {config?.label || signalType}
                  </Badge>
                );
              })}
              {profile.signal_types.length > 3 && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-card text-muted-foreground border-border px-2 py-0.5"
                >
                  +{profile.signal_types.length - 3} more
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="capitalize px-2 py-0.5 bg-muted rounded text-muted-foreground font-medium">
                {profile.search_frequency}
              </span>
              {lastRunDate && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-[#0BBF7D]" />
                  Last run: {new Date(lastRunDate).toLocaleDateString()}
                </span>
              )}
              {!lastRunDate && (
                <span className="flex items-center gap-1 text-[#CD3D64]">
                  <Clock className="h-3 w-3" />
                  Not yet run
                </span>
              )}
            </div>

            {result && (
              <p
                className={`text-xs mt-3 font-medium ${
                  result.error ? 'text-[#CD3D64]' : 'text-[#0BBF7D]'
                }`}
              >
                {result.error || `Found ${result.newSignals} new signals`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRun}
              disabled={running}
              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
              title="Run search"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEdit}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              title="Edit profile"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="h-8 w-8 text-muted-foreground hover:text-[#CD3D64] hover:bg-[#FEE2E2]"
              title="Delete profile"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
