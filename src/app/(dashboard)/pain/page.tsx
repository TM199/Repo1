import { CompaniesInPainDashboard } from '@/components/dashboard/CompaniesInPainDashboard';

export default function PainDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0A2540]">Companies in Pain</h1>
        <p className="text-[#425466] mt-1">
          Companies showing hiring pain signals - stale jobs, reposts, salary increases
        </p>
      </div>

      <CompaniesInPainDashboard />
    </div>
  );
}
