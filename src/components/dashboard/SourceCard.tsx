'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Source } from '@/types';
import { Play, Trash2, ExternalLink, Loader2, MoreHorizontal, Clock, CheckCircle2 } from 'lucide-react';

interface SourceCardProps {
  source: Source;
}

export function SourceCard({ source }: SourceCardProps) {
  const router = useRouter();
  const [scraping, setScraping] = useState(false);
  const [result, setResult] = useState<{ newItems?: number; error?: string } | null>(null);

  async function handleScrape() {
    setScraping(true);
    setResult(null);

    const response = await fetch(`/api/sources/${source.id}/scrape`, {
      method: 'POST',
    });

    const data = await response.json();
    setResult(data);
    setScraping(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this source?')) return;

    await fetch(`/api/sources/${source.id}`, {
      method: 'DELETE',
    });

    router.refresh();
  }

  return (
    <Card className="bg-white border-[#E3E8EE] shadow-sm hover:shadow-md transition-all duration-200 group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-[#0A2540] text-sm">{source.name}</h3>
              <Badge
                variant="outline"
                className={`text-[10px] font-medium px-2 py-0.5 border-0 ${
                  source.is_active
                    ? 'bg-[#D1FAE5] text-[#047857]'
                    : 'bg-[#F0F3F7] text-[#6B7C93]'
                }`}
              >
                {source.is_active ? 'Active' : 'Paused'}
              </Badge>
            </div>
            <p className="text-xs text-[#6B7C93] truncate mb-3 font-mono">
              {source.url}
            </p>
            <div className="flex items-center gap-4 text-[11px] text-[#6B7C93]">
              <span className="capitalize px-2 py-0.5 bg-[#F6F9FC] rounded text-[#425466] font-medium">
                {source.signal_type.replace('_', ' ')}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {source.scrape_frequency}
              </span>
              {source.last_scraped_at && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-[#0BBF7D]" />
                  {new Date(source.last_scraped_at).toLocaleDateString()}
                </span>
              )}
            </div>
            {result && (
              <p className={`text-xs mt-3 font-medium ${result.error ? 'text-[#CD3D64]' : 'text-[#0BBF7D]'}`}>
                {result.error || `Found ${result.newItems} new signals`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleScrape}
              disabled={scraping}
              className="h-8 w-8 text-[#6B7C93] hover:text-[#635BFF] hover:bg-[#EEF2FF]"
            >
              {scraping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 w-8 rounded-md flex items-center justify-center text-[#6B7C93] hover:text-[#0A2540] hover:bg-[#F6F9FC] transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="h-8 w-8 text-[#6B7C93] hover:text-[#CD3D64] hover:bg-[#FEE2E2]"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
