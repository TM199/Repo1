'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Radio, Loader2, Link as LinkIcon, Type, Zap, Building2, Clock } from 'lucide-react';

const SIGNAL_TYPES = [
  { value: 'new_job', label: 'New Job Postings' },
  { value: 'planning_submitted', label: 'Planning Applications Submitted' },
  { value: 'planning_approved', label: 'Planning Permissions Approved' },
  { value: 'contract_awarded', label: 'Contracts Awarded' },
  { value: 'funding_announced', label: 'Funding Announced' },
  { value: 'leadership_change', label: 'Leadership Changes' },
  { value: 'cqc_rating_change', label: 'CQC Rating Changes' },
  { value: 'company_expansion', label: 'Company Expansions' },
];

const INDUSTRIES = [
  { value: 'construction', label: 'Construction' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'technology', label: 'Technology' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'finance', label: 'Financial Services' },
  { value: 'energy', label: 'Energy' },
  { value: 'logistics', label: 'Logistics' },
];

export function AddSourceForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signalType, setSignalType] = useState('');
  const [industry, setIndustry] = useState('');
  const [frequency, setFrequency] = useState('weekly');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);

    const response = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name'),
        url: formData.get('url'),
        signal_type: signalType,
        industry: industry || null,
        scrape_frequency: frequency,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Failed to add source');
      setLoading(false);
      return;
    }

    router.push('/sources');
    router.refresh();
  }

  return (
    <Card className="max-w-lg border-[#E3E8EE] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.02)] bg-white">
      <CardHeader className="pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-[#EEF2FF] rounded-xl">
            <Radio className="h-5 w-5 text-[#635BFF]" />
          </div>
          <div>
            <CardTitle className="text-[#0A2540] text-lg">Add New Source</CardTitle>
            <CardDescription className="text-[#6B7C93] text-sm">
              Configure a new website to monitor for signals
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 text-sm text-[#CD3D64] bg-[#FEE2E2] rounded-lg border border-[#FECACA]">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name" className="text-[#0A2540] text-sm font-medium flex items-center gap-2">
              <Type className="h-3.5 w-3.5 text-[#6B7C93]" />
              Source Name
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Balfour Beatty Careers"
              required
              className="h-11 border-[#E3E8EE] bg-white focus:border-[#635BFF] focus:ring-[#635BFF]/20 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url" className="text-[#0A2540] text-sm font-medium flex items-center gap-2">
              <LinkIcon className="h-3.5 w-3.5 text-[#6B7C93]" />
              URL to Monitor
            </Label>
            <Input
              id="url"
              name="url"
              type="url"
              placeholder="https://example.com/careers"
              required
              className="h-11 border-[#E3E8EE] bg-white focus:border-[#635BFF] focus:ring-[#635BFF]/20 font-mono text-sm transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#0A2540] text-sm font-medium flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-[#6B7C93]" />
              Signal Type
            </Label>
            <Select value={signalType} onValueChange={setSignalType} required>
              <SelectTrigger className="h-11 border-[#E3E8EE] bg-white focus:border-[#635BFF] focus:ring-[#635BFF]/20 transition-colors">
                <SelectValue placeholder="What are you tracking?" />
              </SelectTrigger>
              <SelectContent className="border-[#E3E8EE]">
                {SIGNAL_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value} className="focus:bg-[#F6F9FC]">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[#0A2540] text-sm font-medium flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-[#6B7C93]" />
              Industry
              <span className="text-[#6B7C93] font-normal">(Optional)</span>
            </Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger className="h-11 border-[#E3E8EE] bg-white focus:border-[#635BFF] focus:ring-[#635BFF]/20 transition-colors">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent className="border-[#E3E8EE]">
                {INDUSTRIES.map(ind => (
                  <SelectItem key={ind.value} value={ind.value} className="focus:bg-[#F6F9FC]">
                    {ind.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[#0A2540] text-sm font-medium flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-[#6B7C93]" />
              Check Frequency
            </Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="h-11 border-[#E3E8EE] bg-white focus:border-[#635BFF] focus:ring-[#635BFF]/20 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[#E3E8EE]">
                <SelectItem value="daily" className="focus:bg-[#F6F9FC]">Daily</SelectItem>
                <SelectItem value="weekly" className="focus:bg-[#F6F9FC]">Weekly</SelectItem>
                <SelectItem value="monthly" className="focus:bg-[#F6F9FC]">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full h-11 bg-[#635BFF] hover:bg-[#5851ea] text-white font-medium shadow-sm transition-all duration-200 hover:shadow-md"
              disabled={loading || !signalType}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding source...
                </>
              ) : (
                'Add Source'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
