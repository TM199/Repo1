'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  INDUSTRIES,
  ROLE_CATEGORIES,
  LOCATIONS,
  SIGNAL_TYPES_CONFIG,
  getRoleCategories,
  getAllRolesForCategories,
  getSenioritiesForCategories,
  getRelevantSignalTypes,
} from '@/lib/signal-mapping';

type Step = 'industry' | 'roles' | 'location' | 'signals' | 'context';

export function SearchProfileWizard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('industry');

  // Step 1: Industry
  const [industry, setIndustry] = useState('');

  // Step 2: Roles
  const [roleCategories, setRoleCategories] = useState<string[]>([]);
  const [specificRoles, setSpecificRoles] = useState<string[]>([]);

  // Step 3: Location
  const [locations, setLocations] = useState<string[]>([]);

  // Step 4: Signals
  const [signalTypes, setSignalTypes] = useState<string[]>([]);

  // Step 5: Context
  const [name, setName] = useState('');
  const [targetCompanyTypes, setTargetCompanyTypes] = useState('');
  const [additionalKeywords, setAdditionalKeywords] = useState('');
  const [excludedKeywords, setExcludedKeywords] = useState('');
  const [notes, setNotes] = useState('');

  // Search configuration
  const [searchCount, setSearchCount] = useState(3);
  const [searchBreadth, setSearchBreadth] = useState<'narrow' | 'normal' | 'wide'>('normal');

  // Scheduling
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // Computed values
  const availableRoleCategories = useMemo(() => {
    return getRoleCategories(industry);
  }, [industry]);

  const availableRoles = useMemo(() => {
    return getAllRolesForCategories(industry, roleCategories);
  }, [industry, roleCategories]);

  const seniorities = useMemo(() => {
    return getSenioritiesForCategories(industry, roleCategories);
  }, [industry, roleCategories]);

  const recommendedSignals = useMemo(() => {
    return getRelevantSignalTypes(industry, seniorities);
  }, [industry, seniorities]);

  const steps = [
    { id: 'industry', label: 'Industry' },
    { id: 'roles', label: 'Roles' },
    { id: 'location', label: 'Location' },
    { id: 'signals', label: 'Signals' },
    { id: 'context', label: 'Context' },
  ];

  const currentIndex = steps.findIndex(s => s.id === step);

  async function handleSubmit() {
    setLoading(true);

    const profileData = {
      name: name || `${INDUSTRIES.find(i => i.value === industry)?.label} Search`,
      industry,
      role_categories: roleCategories,
      specific_roles: specificRoles,
      seniority_levels: seniorities,
      locations,
      signal_types: signalTypes,
      target_company_types: targetCompanyTypes || null,
      additional_keywords: additionalKeywords ? additionalKeywords.split(',').map(k => k.trim()) : [],
      excluded_keywords: excludedKeywords ? excludedKeywords.split(',').map(k => k.trim()) : [],
      notes: notes || null,
      is_active: true,
      auto_search: scheduleEnabled,
      search_frequency: scheduleFrequency,
      search_count: searchCount,
      search_breadth: searchBreadth,
      schedule_enabled: scheduleEnabled,
      schedule_frequency: scheduleEnabled ? scheduleFrequency : null,
    };

    try {
      const response = await fetch('/api/search/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        throw new Error('Failed to create profile');
      }

      const result = await response.json();
      router.push(`/search?created=${result.id}`);
    } catch (error) {
      console.error('Error creating profile:', error);
      alert('Failed to create search profile. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                i <= currentIndex
                  ? 'bg-[#635BFF] text-white'
                  : 'bg-[#F6F9FC] text-[#6B7C93]'
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 transition-all ${
                  i < currentIndex ? 'bg-[#635BFF]' : 'bg-[#E3E8EE]'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Industry */}
      {step === 'industry' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[#0A2540]">What industry do you recruit in?</h2>
          <div className="grid grid-cols-2 gap-3">
            {INDUSTRIES.map(ind => (
              <button
                key={ind.value}
                onClick={() => {
                  setIndustry(ind.value);
                  setRoleCategories([]);
                  setSpecificRoles([]);
                }}
                className={`p-4 border rounded-lg text-left hover:border-[#635BFF] transition ${
                  industry === ind.value
                    ? 'border-[#635BFF] bg-[#EEF2FF]'
                    : 'border-[#E3E8EE]'
                }`}
              >
                <span className="text-[#0A2540] font-medium">{ind.label}</span>
              </button>
            ))}
          </div>
          <Button
            onClick={() => setStep('roles')}
            disabled={!industry}
            className="mt-4 bg-[#635BFF] hover:bg-[#5046E4] text-white"
          >
            Continue
          </Button>
        </div>
      )}

      {/* Step 2: Roles */}
      {step === 'roles' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-[#0A2540]">What types of roles do you recruit?</h2>

          <div>
            <Label className="text-base font-medium text-[#0A2540]">Role Categories</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {availableRoleCategories.map(cat => (
                <label
                  key={cat.category}
                  className="flex items-center space-x-2 p-2 border border-[#E3E8EE] rounded hover:bg-[#F6F9FC] cursor-pointer"
                >
                  <Checkbox
                    checked={roleCategories.includes(cat.category)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setRoleCategories([...roleCategories, cat.category]);
                      } else {
                        setRoleCategories(roleCategories.filter(c => c !== cat.category));
                      }
                    }}
                  />
                  <span className="text-[#0A2540]">{cat.category}</span>
                  <span className="text-xs text-[#6B7C93]">({cat.seniority})</span>
                </label>
              ))}
            </div>
          </div>

          {roleCategories.length > 0 && (
            <div>
              <Label className="text-base font-medium text-[#0A2540]">
                Specific Roles (optional)
              </Label>
              <p className="text-sm text-[#6B7C93] mb-2">
                Select specific roles to focus your search
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 border border-[#E3E8EE] rounded bg-[#F6F9FC]">
                {availableRoles.map(role => (
                  <label
                    key={role}
                    className="flex items-center space-x-2 p-2 border border-[#E3E8EE] bg-white rounded hover:bg-[#F6F9FC] cursor-pointer"
                  >
                    <Checkbox
                      checked={specificRoles.includes(role)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSpecificRoles([...specificRoles, role]);
                        } else {
                          setSpecificRoles(specificRoles.filter(r => r !== role));
                        }
                      }}
                    />
                    <span className="text-sm text-[#0A2540]">{role}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep('industry')}
              className="border-[#E3E8EE] text-[#0A2540]"
            >
              Back
            </Button>
            <Button
              onClick={() => setStep('location')}
              disabled={roleCategories.length === 0}
              className="bg-[#635BFF] hover:bg-[#5046E4] text-white"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Location */}
      {step === 'location' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[#0A2540]">Where do you recruit?</h2>
          <p className="text-[#6B7C93]">Select all regions where you place candidates</p>

          <div className="grid grid-cols-2 gap-2">
            {LOCATIONS.map(loc => (
              <label
                key={loc.value}
                className="flex items-center space-x-2 p-3 border border-[#E3E8EE] rounded hover:bg-[#F6F9FC] cursor-pointer"
              >
                <Checkbox
                  checked={locations.includes(loc.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setLocations([...locations, loc.value]);
                    } else {
                      setLocations(locations.filter(l => l !== loc.value));
                    }
                  }}
                />
                <span className="text-[#0A2540]">{loc.label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep('roles')}
              className="border-[#E3E8EE] text-[#0A2540]"
            >
              Back
            </Button>
            <Button
              onClick={() => setStep('signals')}
              disabled={locations.length === 0}
              className="bg-[#635BFF] hover:bg-[#5046E4] text-white"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Signals */}
      {step === 'signals' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[#0A2540]">What signals matter to you?</h2>
          <p className="text-[#6B7C93]">
            We've recommended signals based on your industry and roles
          </p>

          <div>
            <Label className="text-sm font-medium text-[#047857]">Recommended</Label>
            <div className="grid gap-2 mt-2">
              {recommendedSignals.map(signal => (
                <label
                  key={signal.value}
                  className="flex items-start space-x-3 p-3 border border-[#6EE7B7] rounded hover:bg-[#D1FAE5] cursor-pointer bg-[#ECFDF5]"
                >
                  <Checkbox
                    checked={signalTypes.includes(signal.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSignalTypes([...signalTypes, signal.value]);
                      } else {
                        setSignalTypes(signalTypes.filter(s => s !== signal.value));
                      }
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{signal.icon}</span>
                      <span className="font-medium text-[#0A2540]">{signal.label}</span>
                    </div>
                    <p className="text-sm text-[#6B7C93]">{signal.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-[#0A2540]">Other Signals</Label>
            <div className="grid gap-2 mt-2">
              {SIGNAL_TYPES_CONFIG.filter(
                s => !recommendedSignals.find(r => r.value === s.value)
              ).map(signal => (
                <label
                  key={signal.value}
                  className="flex items-start space-x-3 p-3 border border-[#E3E8EE] rounded hover:bg-[#F6F9FC] cursor-pointer"
                >
                  <Checkbox
                    checked={signalTypes.includes(signal.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSignalTypes([...signalTypes, signal.value]);
                      } else {
                        setSignalTypes(signalTypes.filter(s => s !== signal.value));
                      }
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{signal.icon}</span>
                      <span className="font-medium text-[#0A2540]">{signal.label}</span>
                    </div>
                    <p className="text-sm text-[#6B7C93]">{signal.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep('location')}
              className="border-[#E3E8EE] text-[#0A2540]"
            >
              Back
            </Button>
            <Button
              onClick={() => setStep('context')}
              disabled={signalTypes.length === 0}
              className="bg-[#635BFF] hover:bg-[#5046E4] text-white"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Additional Context */}
      {step === 'context' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[#0A2540]">Any additional context?</h2>
          <p className="text-[#6B7C93]">Optional details to improve your search results</p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-[#0A2540]">
                Profile Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`${INDUSTRIES.find(i => i.value === industry)?.label} Search`}
                className="border-[#E3E8EE]"
              />
            </div>

            <div>
              <Label htmlFor="companyTypes" className="text-[#0A2540]">
                Target Company Types
              </Label>
              <Input
                id="companyTypes"
                value={targetCompanyTypes}
                onChange={(e) => setTargetCompanyTypes(e.target.value)}
                placeholder="e.g. SMEs, Startups, Enterprise, 50-500 employees"
                className="border-[#E3E8EE]"
              />
            </div>

            <div>
              <Label htmlFor="keywords" className="text-[#0A2540]">
                Additional Keywords (comma separated)
              </Label>
              <Input
                id="keywords"
                value={additionalKeywords}
                onChange={(e) => setAdditionalKeywords(e.target.value)}
                placeholder="e.g. automotive, aerospace, precision engineering"
                className="border-[#E3E8EE]"
              />
            </div>

            <div>
              <Label htmlFor="excluded" className="text-[#0A2540]">
                Exclude Keywords (comma separated)
              </Label>
              <Input
                id="excluded"
                value={excludedKeywords}
                onChange={(e) => setExcludedKeywords(e.target.value)}
                placeholder="e.g. recruitment agency, jobs board"
                className="border-[#E3E8EE]"
              />
            </div>

            <div>
              <Label htmlFor="notes" className="text-[#0A2540]">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any other details that might help..."
                rows={3}
                className="border-[#E3E8EE]"
              />
            </div>

            {/* Search Configuration */}
            <div className="pt-4 border-t border-[#E3E8EE]">
              <h3 className="text-lg font-semibold text-[#0A2540] mb-4">Search Configuration</h3>

              <div className="space-y-4">
                <div>
                  <Label className="text-[#0A2540]">Number of Searches</Label>
                  <p className="text-sm text-[#6B7C93] mb-3">
                    More searches = more signals found, but takes longer
                  </p>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={searchCount}
                      onChange={(e) => setSearchCount(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-[#E3E8EE] rounded-lg appearance-none cursor-pointer accent-[#635BFF]"
                    />
                    <span className="w-12 text-center font-medium text-[#0A2540] bg-[#F6F9FC] px-2 py-1 rounded">
                      {searchCount}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7C93] mt-2">
                    Estimated time: ~{searchCount * 15} seconds
                  </p>
                </div>

                <div>
                  <Label className="text-[#0A2540]">Search Breadth</Label>
                  <p className="text-sm text-[#6B7C93] mb-2">
                    How wide should the search criteria be?
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['narrow', 'normal', 'wide'] as const).map(breadth => (
                      <button
                        key={breadth}
                        type="button"
                        onClick={() => setSearchBreadth(breadth)}
                        className={`p-3 border rounded-lg text-center capitalize transition ${
                          searchBreadth === breadth
                            ? 'border-[#635BFF] bg-[#EEF2FF] text-[#635BFF]'
                            : 'border-[#E3E8EE] text-[#425466] hover:bg-[#F6F9FC]'
                        }`}
                      >
                        {breadth}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[#6B7C93] mt-2">
                    {searchBreadth === 'narrow' && 'Focused on exact matches only'}
                    {searchBreadth === 'normal' && 'Balanced coverage of results'}
                    {searchBreadth === 'wide' && 'Broader results, may include less relevant signals'}
                  </p>
                </div>
              </div>
            </div>

            {/* Scheduling */}
            <div className="pt-4 border-t border-[#E3E8EE]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Label className="text-[#0A2540]">Automatic Scheduling</Label>
                  <p className="text-sm text-[#6B7C93]">
                    Run this search automatically on a schedule
                  </p>
                </div>
                <Switch
                  checked={scheduleEnabled}
                  onCheckedChange={setScheduleEnabled}
                />
              </div>

              {scheduleEnabled && (
                <div className="grid grid-cols-3 gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map(freq => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setScheduleFrequency(freq)}
                      className={`p-3 border rounded-lg text-center capitalize transition ${
                        scheduleFrequency === freq
                          ? 'border-[#635BFF] bg-[#EEF2FF] text-[#635BFF]'
                          : 'border-[#E3E8EE] text-[#425466] hover:bg-[#F6F9FC]'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep('signals')}
              className="border-[#E3E8EE] text-[#0A2540]"
            >
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-[#635BFF] hover:bg-[#5046E4] text-white"
            >
              {loading ? 'Creating...' : 'Create Search Profile'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
