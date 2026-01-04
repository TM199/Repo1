import { Suspense } from 'react';
import { CompaniesInPainDashboard } from '@/components/dashboard/CompaniesInPainDashboard';

function LoadingState() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin h-6 w-6 border-2 border-[#635BFF] border-t-transparent rounded-full" />
      <span className="ml-2 text-[#425466]">Loading companies in pain...</span>
    </div>
  );
}

export default function PainDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0A2540]">Companies in Pain</h1>
        <p className="text-[#425466] mt-1">
          Companies showing hiring pain signals - stale jobs, reposts, salary increases
        </p>
      </div>

      <Suspense fallback={<LoadingState />}>
        <CompaniesInPainDashboard />
      </Suspense>
    </div>
  );
}
