'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, X, Plus, Info, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { ICPSignalType, PullFrequency, EmploymentType } from '@/types';
import { INDUSTRIES, ROLE_CATEGORIES, RoleCategory } from '@/lib/signal-mapping';

// Map industry labels to values for the form
const INDUSTRY_LABEL_TO_VALUE: Record<string, string> = {
  'Construction & Infrastructure': 'construction',
  'Healthcare & Life Sciences': 'healthcare',
  'Technology & Software': 'technology',
  'Manufacturing & Engineering': 'manufacturing',
  'Financial Services': 'finance',
  'Energy & Utilities': 'energy',
  'Logistics & Supply Chain': 'logistics',
  'Property & Real Estate': 'property',
  'Retail & Consumer': 'retail',
  'Education': 'education',
  'Legal & Professional Services': 'legal',
  'Hospitality & Leisure': 'hospitality',
};

const LOCATIONS = [
  'London',
  'Manchester',
  'Birmingham',
  'Leeds',
  'Bristol',
  'Glasgow',
  'Edinburgh',
  'Liverpool',
  'Sheffield',
  'Newcastle',
  'Nottingham',
  'Cardiff',
];

const SENIORITY_LEVELS = ['Executive', 'Senior', 'Mid-Level', 'Junior'];

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'both', label: 'All Types' },
  { value: 'permanent', label: 'Permanent Only' },
  { value: 'contract', label: 'Contract Only' },
];

const SIGNAL_TYPES: { value: ICPSignalType; label: string; description: string; hasConfig?: boolean }[] = [
  {
    value: 'job_pain',
    label: 'Job Board Signals',
    description: 'Companies struggling to hire: stale jobs (30/60/90+ days), reposted roles, salary increases'
  },
  {
    value: 'contracts_awarded',
    label: 'Government Contracts',
    description: 'Companies winning public sector contracts - they\'ll need to hire to deliver',
    hasConfig: true
  },
  {
    value: 'tenders',
    label: 'Major Tender Wins',
    description: 'High-value contract awards (£118k+) from Find a Tender - major scaling opportunities',
    hasConfig: true
  },
];

const CONTRACT_VALUE_OPTIONS = [
  { value: 0, label: 'Any value' },
  { value: 50000, label: '£50k+' },
  { value: 100000, label: '£100k+' },
  { value: 500000, label: '£500k+' },
  { value: 1000000, label: '£1M+' },
];

const PULL_FREQUENCIES: { value: PullFrequency; label: string; description: string }[] = [
  { value: 'daily', label: 'Daily', description: 'Updates once per day' },
  { value: 'every_4h', label: 'Every 4 Hours', description: 'More frequent updates' },
  { value: 'hourly', label: 'Hourly', description: 'Most up-to-date signals' },
];

export default function NewICPProfilePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStats, setScanStats] = useState<{ jobs: number; contracts: number; signals: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [industries, setIndustries] = useState<string[]>([]);
  const [roleCategories, setRoleCategories] = useState<string[]>([]);
  const [specificRoles, setSpecificRoles] = useState<string[]>([]);
  const [seniorityLevels, setSeniorityLevels] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [employmentType, setEmploymentType] = useState<EmploymentType>('both');
  const [signalTypes, setSignalTypes] = useState<ICPSignalType[]>(['job_pain']);
  const [pullFrequency, setPullFrequency] = useState<PullFrequency>('daily');

  // Contract/Tender config
  const [minContractValue, setMinContractValue] = useState<number>(0);
  const [contractKeywords, setContractKeywords] = useState<string[]>([]);
  const [contractKeywordInput, setContractKeywordInput] = useState('');
  const [showContractConfig, setShowContractConfig] = useState(false);

  // Get available role categories based on selected industries
  const availableCategories = useMemo(() => {
    const categories: { category: string; industry: string; roles: string[]; seniority: string }[] = [];

    for (const industryLabel of industries) {
      const industryValue = INDUSTRY_LABEL_TO_VALUE[industryLabel];
      if (industryValue && ROLE_CATEGORIES[industryValue]) {
        for (const cat of ROLE_CATEGORIES[industryValue]) {
          categories.push({
            category: cat.category,
            industry: industryLabel,
            roles: cat.roles,
            seniority: cat.seniority,
          });
        }
      }
    }

    return categories;
  }, [industries]);

  // Get unique category names
  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    return availableCategories.filter(c => {
      if (seen.has(c.category)) return false;
      seen.add(c.category);
      return true;
    });
  }, [availableCategories]);

  // Get available roles based on selected categories
  const availableRoles = useMemo(() => {
    const roles = new Set<string>();

    for (const cat of availableCategories) {
      if (roleCategories.includes(cat.category)) {
        for (const role of cat.roles) {
          roles.add(role);
        }
      }
    }

    return Array.from(roles).sort();
  }, [availableCategories, roleCategories]);

  const toggleIndustry = (industry: string) => {
    const newIndustries = industries.includes(industry)
      ? industries.filter((i) => i !== industry)
      : [...industries, industry];
    setIndustries(newIndustries);

    // Clear categories and roles that are no longer valid
    if (!newIndustries.includes(industry)) {
      const industryValue = INDUSTRY_LABEL_TO_VALUE[industry];
      if (industryValue && ROLE_CATEGORIES[industryValue]) {
        const removedCategories = ROLE_CATEGORIES[industryValue].map(c => c.category);
        setRoleCategories(prev => prev.filter(c => !removedCategories.includes(c)));
        const removedRoles = ROLE_CATEGORIES[industryValue].flatMap(c => c.roles);
        setSpecificRoles(prev => prev.filter(r => !removedRoles.includes(r)));
      }
    }
  };

  const toggleCategory = (category: string) => {
    const newCategories = roleCategories.includes(category)
      ? roleCategories.filter((c) => c !== category)
      : [...roleCategories, category];
    setRoleCategories(newCategories);

    // Clear roles from removed category
    if (!newCategories.includes(category)) {
      const rolesInCategory = availableCategories
        .filter(c => c.category === category)
        .flatMap(c => c.roles);
      setSpecificRoles(prev => prev.filter(r => !rolesInCategory.includes(r)));
    }
  };

  const toggleRole = (role: string) => {
    setSpecificRoles(
      specificRoles.includes(role)
        ? specificRoles.filter((r) => r !== role)
        : [...specificRoles, role]
    );
  };

  const selectAllRolesInCategory = (category: string) => {
    const rolesInCategory = availableCategories
      .filter(c => c.category === category)
      .flatMap(c => c.roles);
    const newRoles = new Set([...specificRoles, ...rolesInCategory]);
    setSpecificRoles(Array.from(newRoles));
  };

  const toggleLocation = (location: string) => {
    setLocations(
      locations.includes(location)
        ? locations.filter((l) => l !== location)
        : [...locations, location]
    );
  };

  const toggleSeniority = (level: string) => {
    setSeniorityLevels(
      seniorityLevels.includes(level)
        ? seniorityLevels.filter((l) => l !== level)
        : [...seniorityLevels, level]
    );
  };

  const toggleSignalType = (type: ICPSignalType) => {
    const isEnabled = signalTypes.includes(type);
    setSignalTypes(
      isEnabled
        ? signalTypes.filter((t) => t !== type)
        : [...signalTypes, type]
    );
    if (!isEnabled && (type === 'contracts_awarded' || type === 'tenders')) {
      setShowContractConfig(true);
    }
  };

  const addContractKeyword = () => {
    if (contractKeywordInput.trim() && !contractKeywords.includes(contractKeywordInput.trim())) {
      setContractKeywords([...contractKeywords, contractKeywordInput.trim()]);
      setContractKeywordInput('');
    }
  };

  const removeContractKeyword = (keyword: string) => {
    setContractKeywords(contractKeywords.filter((k) => k !== keyword));
  };

  const hasContractSignals = signalTypes.includes('contracts_awarded') || signalTypes.includes('tenders');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Profile name is required');
      return;
    }

    if (industries.length === 0) {
      setError('Select at least one industry');
      return;
    }

    if (specificRoles.length === 0 && signalTypes.includes('job_pain')) {
      setError('Select at least one role for job pain signals');
      return;
    }

    if (locations.length === 0) {
      setError('Select at least one location');
      return;
    }

    if (signalTypes.length === 0) {
      setError('Select at least one signal type');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/icp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          industries,
          role_categories: roleCategories,
          specific_roles: specificRoles,
          seniority_levels: seniorityLevels,
          locations,
          employment_type: employmentType,
          signal_types: signalTypes,
          pull_frequency: pullFrequency,
          min_contract_value: hasContractSignals ? minContractValue : null,
          contract_keywords: hasContractSignals ? contractKeywords : [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create profile');
      }

      const profileId = data.profile.id;

      setIsSubmitting(false);
      setIsScanning(true);

      const scanResponse = await fetch(`/api/icp/${profileId}/scan`, {
        method: 'POST',
      });

      const scanData = await scanResponse.json();

      if (scanData.success && scanData.stats) {
        setScanStats({
          jobs: scanData.stats.jobs_processed || 0,
          contracts: scanData.stats.contracts_matched || 0,
          signals: scanData.stats.signals_generated || 0,
        });
      }

      setTimeout(() => {
        router.push('/pain');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
      setIsSubmitting(false);
      setIsScanning(false);
    }
  };

  if (isScanning) {
    return (
      <div className="max-w-xl mx-auto mt-20">
        <Card className="bg-white border-[#E3E8EE]">
          <CardContent className="py-12 text-center">
            {!scanStats ? (
              <>
                <Loader2 className="h-12 w-12 text-[#635BFF] mx-auto mb-4 animate-spin" />
                <h2 className="text-xl font-bold text-[#0A2540] mb-2">
                  Scanning for Pain Signals
                </h2>
                <p className="text-sm text-[#6B7C93] mb-4">
                  Searching for companies matching your ICP...
                </p>
                <div className="flex justify-center gap-2 text-xs text-[#6B7C93]">
                  <Badge variant="outline">{locations.length} locations</Badge>
                  <Badge variant="outline">{specificRoles.length} roles</Badge>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-[#0A2540] mb-2">
                  Scan Complete!
                </h2>
                <div className="flex justify-center gap-6 mb-4">
                  {scanStats.jobs > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[#0A2540]">{scanStats.jobs}</p>
                      <p className="text-xs text-[#6B7C93]">Jobs Analyzed</p>
                    </div>
                  )}
                  {scanStats.contracts > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[#0A2540]">{scanStats.contracts}</p>
                      <p className="text-xs text-[#6B7C93]">Contracts Found</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#635BFF]">{scanStats.signals}</p>
                    <p className="text-xs text-[#6B7C93]">Pain Signals</p>
                  </div>
                </div>
                <p className="text-sm text-[#6B7C93]">
                  Redirecting to Companies in Pain...
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0A2540]">Create ICP Profile</h1>
        <p className="text-sm text-[#6B7C93] mt-1">
          Define your Ideal Client Profile to receive tailored hiring pain signals
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Name */}
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base text-[#0A2540]">Profile Name</CardTitle>
            <CardDescription>Give this profile a descriptive name</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Construction London, Tech Startups UK"
              className="max-w-md"
            />
          </CardContent>
        </Card>

        {/* Industries */}
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base text-[#0A2540]">Industries</CardTitle>
            <CardDescription>Which industries do you recruit for?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map((industry) => (
                <Badge
                  key={industry.value}
                  variant="outline"
                  className={`cursor-pointer transition-all ${
                    industries.includes(industry.label)
                      ? 'bg-[#635BFF] text-white border-[#635BFF]'
                      : 'bg-[#F6F9FC] border-[#E3E8EE] hover:border-[#635BFF]'
                  }`}
                  onClick={() => toggleIndustry(industry.label)}
                >
                  {industry.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Role Categories - only show when industries selected */}
        {industries.length > 0 && (
          <Card className="bg-white border-[#E3E8EE]">
            <CardHeader>
              <CardTitle className="text-base text-[#0A2540]">Role Categories (Teams)</CardTitle>
              <CardDescription>Select the teams/departments you recruit for</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {uniqueCategories.map((cat) => (
                  <Badge
                    key={cat.category}
                    variant="outline"
                    className={`cursor-pointer transition-all ${
                      roleCategories.includes(cat.category)
                        ? 'bg-[#635BFF] text-white border-[#635BFF]'
                        : 'bg-[#F6F9FC] border-[#E3E8EE] hover:border-[#635BFF]'
                    }`}
                    onClick={() => toggleCategory(cat.category)}
                  >
                    {cat.category}
                  </Badge>
                ))}
              </div>
              {uniqueCategories.length === 0 && (
                <p className="text-sm text-[#6B7C93]">Select industries above to see available role categories</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Specific Roles - only show when categories selected */}
        {roleCategories.length > 0 && (
          <Card className="bg-white border-[#E3E8EE]">
            <CardHeader>
              <CardTitle className="text-base text-[#0A2540]">Specific Roles</CardTitle>
              <CardDescription>Select the job titles you recruit for (these are searched on Reed)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {roleCategories.map((category) => {
                const rolesInCategory = availableCategories
                  .filter(c => c.category === category)
                  .flatMap(c => c.roles);
                const uniqueRoles = [...new Set(rolesInCategory)];
                const selectedCount = uniqueRoles.filter(r => specificRoles.includes(r)).length;

                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-[#0A2540]">{category}</Label>
                      <button
                        type="button"
                        onClick={() => selectAllRolesInCategory(category)}
                        className="text-xs text-[#635BFF] hover:underline"
                      >
                        Select all ({uniqueRoles.length})
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {uniqueRoles.map((role) => (
                        <Badge
                          key={role}
                          variant="outline"
                          className={`cursor-pointer transition-all text-xs ${
                            specificRoles.includes(role)
                              ? 'bg-[#EEF2FF] text-[#635BFF] border-[#635BFF]'
                              : 'bg-white border-[#E3E8EE] hover:border-[#635BFF]'
                          }`}
                          onClick={() => toggleRole(role)}
                        >
                          {role}
                          {specificRoles.includes(role) && (
                            <X className="h-3 w-3 ml-1" />
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}

              {specificRoles.length > 0 && (
                <div className="pt-3 border-t border-[#E3E8EE]">
                  <p className="text-xs text-[#6B7C93] mb-2">
                    {specificRoles.length} role{specificRoles.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Employment Type */}
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base text-[#0A2540]">Employment Type</CardTitle>
            <CardDescription>Filter by permanent or contract roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {EMPLOYMENT_TYPES.map((type) => (
                <Badge
                  key={type.value}
                  variant="outline"
                  className={`cursor-pointer transition-all ${
                    employmentType === type.value
                      ? 'bg-[#635BFF] text-white border-[#635BFF]'
                      : 'bg-[#F6F9FC] border-[#E3E8EE] hover:border-[#635BFF]'
                  }`}
                  onClick={() => setEmploymentType(type.value)}
                >
                  {type.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Seniority Levels */}
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base text-[#0A2540]">Seniority Levels</CardTitle>
            <CardDescription>What seniority levels do you focus on?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {SENIORITY_LEVELS.map((level) => (
                <Badge
                  key={level}
                  variant="outline"
                  className={`cursor-pointer transition-all ${
                    seniorityLevels.includes(level)
                      ? 'bg-[#635BFF] text-white border-[#635BFF]'
                      : 'bg-[#F6F9FC] border-[#E3E8EE] hover:border-[#635BFF]'
                  }`}
                  onClick={() => toggleSeniority(level)}
                >
                  {level}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Locations */}
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base text-[#0A2540]">Locations</CardTitle>
            <CardDescription>Where do your clients hire?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {LOCATIONS.map((location) => (
                <Badge
                  key={location}
                  variant="outline"
                  className={`cursor-pointer transition-all ${
                    locations.includes(location)
                      ? 'bg-[#635BFF] text-white border-[#635BFF]'
                      : 'bg-[#F6F9FC] border-[#E3E8EE] hover:border-[#635BFF]'
                  }`}
                  onClick={() => toggleLocation(location)}
                >
                  {location}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Signal Types */}
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base text-[#0A2540]">Signal Types to Track</CardTitle>
            <CardDescription>What types of signals do you want to receive?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {SIGNAL_TYPES.map((signal) => (
              <div key={signal.value} className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id={signal.value}
                    checked={signalTypes.includes(signal.value)}
                    onCheckedChange={() => toggleSignalType(signal.value)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor={signal.value} className="text-sm font-medium text-[#0A2540] cursor-pointer">
                      {signal.label}
                    </Label>
                    <p className="text-xs text-[#6B7C93]">{signal.description}</p>
                  </div>
                </div>
              </div>
            ))}

            {hasContractSignals && (
              <div className="mt-4 pt-4 border-t border-[#E3E8EE]">
                <button
                  type="button"
                  onClick={() => setShowContractConfig(!showContractConfig)}
                  className="flex items-center gap-2 text-sm font-medium text-[#635BFF] hover:text-[#5851DF]"
                >
                  {showContractConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Contract Settings
                </button>

                {showContractConfig && (
                  <div className="mt-4 space-y-4 pl-6">
                    <div className="space-y-2">
                      <Label className="text-sm text-[#0A2540]">Minimum Contract Value</Label>
                      <div className="flex flex-wrap gap-2">
                        {CONTRACT_VALUE_OPTIONS.map((opt) => (
                          <Badge
                            key={opt.value}
                            variant="outline"
                            className={`cursor-pointer transition-all ${
                              minContractValue === opt.value
                                ? 'bg-[#635BFF] text-white border-[#635BFF]'
                                : 'bg-[#F6F9FC] border-[#E3E8EE] hover:border-[#635BFF]'
                            }`}
                            onClick={() => setMinContractValue(opt.value)}
                          >
                            {opt.label}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-[#6B7C93]">Filter to contracts above this value</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#0A2540]">Keywords (Optional)</Label>
                      <div className="flex gap-2 max-w-md">
                        <Input
                          value={contractKeywordInput}
                          onChange={(e) => setContractKeywordInput(e.target.value)}
                          placeholder="e.g., construction, highways, IT"
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addContractKeyword())}
                        />
                        <Button type="button" onClick={addContractKeyword} variant="outline">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {contractKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {contractKeywords.map((kw) => (
                            <Badge key={kw} className="bg-[#EEF2FF] text-[#635BFF] border-0">
                              {kw}
                              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => removeContractKeyword(kw)} />
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-[#6B7C93]">Only show contracts matching these keywords (leave empty for all)</p>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-[#EEF2FF] rounded-lg">
                      <Info className="h-4 w-4 text-[#635BFF] mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-[#635BFF]">
                        <p className="font-medium">How this works</p>
                        <p>We scan UK government contract databases daily. When a company wins a contract, they often need to hire to deliver - that&apos;s your opportunity.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pull Frequency */}
        <Card className="bg-white border-[#E3E8EE]">
          <CardHeader>
            <CardTitle className="text-base text-[#0A2540]">Update Frequency</CardTitle>
            <CardDescription>How often should we check for new signals?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {PULL_FREQUENCIES.map((freq) => (
                <Badge
                  key={freq.value}
                  variant="outline"
                  className={`cursor-pointer transition-all py-2 px-4 ${
                    pullFrequency === freq.value
                      ? 'bg-[#635BFF] text-white border-[#635BFF]'
                      : 'bg-[#F6F9FC] border-[#E3E8EE] hover:border-[#635BFF]'
                  }`}
                  onClick={() => setPullFrequency(freq.value)}
                >
                  <div>
                    <span className="font-medium">{freq.label}</span>
                    <span className="text-xs ml-2 opacity-80">{freq.description}</span>
                  </div>
                </Badge>
              ))}
            </div>
            <div className="flex items-start gap-2 p-3 bg-[#FEF3C7] rounded-lg">
              <Info className="h-4 w-4 text-[#92400E] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[#92400E]">
                More frequent updates mean more up-to-date signals, helping you reach out faster.
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="p-3 bg-[#FEE2E2] rounded-lg">
            <p className="text-sm text-[#CD3D64]">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="bg-[#635BFF] hover:bg-[#5851DF] text-white">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Profile'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
