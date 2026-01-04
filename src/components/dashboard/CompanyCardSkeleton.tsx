'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton, SkeletonBadge, SkeletonIcon } from '@/components/ui/skeleton';

interface CompanyCardSkeletonProps {
  /** Number of signal skeletons to show (default: 3) */
  signalCount?: number;
}

export function CompanyCardSkeleton({ signalCount = 3 }: CompanyCardSkeletonProps) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          {/* Left side: Icon + Name + Meta */}
          <div className="flex items-center gap-3">
            {/* Building icon placeholder */}
            <SkeletonIcon className="h-6 w-6" />
            <div className="space-y-2">
              {/* Company name + badge row */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-40" />
                <SkeletonBadge className="w-20" />
              </div>
              {/* Meta row: Industry • Region • X open roles */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
              {/* Domain link */}
              <Skeleton className="h-5 w-28 rounded" />
            </div>
          </div>
          {/* Pain Score pill */}
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        {/* Pain Signals */}
        <div className="space-y-2">
          {Array.from({ length: signalCount }).map((_, i) => (
            <SignalRowSkeleton key={i} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SignalRowSkeleton() {
  return (
    <div className="flex items-start gap-2 p-3 bg-background rounded-lg">
      {/* Signal icon */}
      <SkeletonIcon className="h-4 w-4 mt-0.5" />
      <div className="flex-1 space-y-2">
        {/* Title row with badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-4 w-48" />
          <SkeletonBadge className="w-16" />
          <SkeletonBadge className="w-14" />
        </div>
        {/* Detected date + View Job */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

// Multiple cards skeleton for loading states
export function CompanyCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <CompanyCardSkeleton key={i} signalCount={i === 0 ? 3 : 2} />
      ))}
    </div>
  );
}
