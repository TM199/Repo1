'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonBadge, SkeletonButton } from '@/components/ui/skeleton';

export function SignalCardSkeleton() {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Badge row: Type, Source, Confidence */}
            <div className="flex items-center gap-2">
              <SkeletonBadge className="w-16" />
              <SkeletonBadge className="w-20" />
              <SkeletonBadge className="w-14" />
            </div>

            {/* Company name + domain */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>

            {/* Signal title */}
            <Skeleton className="h-4 w-full max-w-md" />

            {/* Signal detail */}
            <Skeleton className="h-3 w-full max-w-sm" />

            {/* Time + source row */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>

          {/* Right buttons */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Multiple cards skeleton for loading states
export function SignalCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SignalCardSkeleton key={i} />
      ))}
    </div>
  );
}
