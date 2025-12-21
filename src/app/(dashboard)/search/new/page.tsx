'use client';

import { SearchProfileWizard } from '@/components/forms/SearchProfileWizard';

export default function NewSearchProfilePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0A2540]">Create Search Profile</h1>
        <p className="text-sm text-[#6B7C93] mt-1">
          Define criteria to find relevant signals from your target audience
        </p>
      </div>
      <SearchProfileWizard />
    </div>
  );
}
