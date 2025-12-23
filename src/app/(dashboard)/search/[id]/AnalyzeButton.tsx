'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Zap } from 'lucide-react';

interface AnalyzeButtonProps {
  profileId: string;
  industry: string;
}

export function AnalyzeButton({ profileId, industry }: AnalyzeButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search/profiles/${profileId}/analyze`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      // Redirect to pain dashboard filtered by industry
      router.push(data.redirect_url || `/pain?industry=${encodeURIComponent(industry)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleAnalyze}
        disabled={isLoading}
        variant="outline"
        className="border-[#635BFF] text-[#635BFF] hover:bg-[#EEF2FF]"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 mr-2" />
            Analyze ICP
          </>
        )}
      </Button>
      {error && (
        <span className="text-sm text-red-500">{error}</span>
      )}
    </div>
  );
}
