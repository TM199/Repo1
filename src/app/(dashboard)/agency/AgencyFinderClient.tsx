'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AgencyAnalysis, SignalType } from '@/types';
import { AGENCY_INDUSTRIES, getSignalTypesForIndustries, getHighUrgencySignals, SIGNAL_HIRING_URGENCY, getSignalHiringContext } from '@/lib/agency-signal-mapping';
import { LOCATIONS, getSignalTypeConfig } from '@/lib/signal-mapping';
import { Building2, Search, Loader2, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { AgencyResultsPanel, AgencySignal } from '@/components/dashboard/AgencyResultsPanel';

type Step = 'input' | 'review' | 'searching' | 'results';

export function AgencyFinderClient() {
  const [step, setStep] = useState<Step>('input');
  const [domain, setDomain] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AgencyAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Review step state
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedSignalTypes, setSelectedSignalTypes] = useState<SignalType[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(['uk_all']);

  // Search state
  const [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState('');
  const [signals, setSignals] = useState<AgencySignal[]>([]);

  const handleAnalyze = async () => {
    if (!domain.trim()) {
      toast.error('Please enter a domain');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/agency/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze agency');
      }

      if (data.analysis) {
        setAnalysis(data.analysis);
        setSelectedIndustries(data.analysis.industries);

        // Auto-select high urgency signals for detected industries
        const urgentSignals = getHighUrgencySignals(data.analysis.industries);
        setSelectedSignalTypes(urgentSignals.slice(0, 5));

        setStep('review');
        toast.success('Agency analyzed successfully');
      } else {
        // No analysis - let user select manually
        setStep('review');
        toast.info('Could not detect specializations - please select manually');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      toast.error('Failed to analyze agency website');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSearch = async () => {
    if (selectedIndustries.length === 0 || selectedSignalTypes.length === 0) {
      toast.error('Please select at least one industry and signal type');
      return;
    }

    setStep('searching');
    setSearching(true);
    setSignals([]);
    setSearchProgress('Starting search...');

    try {
      const response = await fetch('/api/agency/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industries: selectedIndustries,
          signalTypes: selectedSignalTypes,
          locations: selectedLocations,
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const event = line.replace('event: ', '');
            const dataLine = lines[lines.indexOf(line) + 1];
            if (dataLine?.startsWith('data: ')) {
              const data = JSON.parse(dataLine.replace('data: ', ''));

              if (event === 'status') {
                setSearchProgress(data.message);
              } else if (event === 'signal') {
                setSignals(prev => [...prev, data as AgencySignal]);
              } else if (event === 'complete') {
                setSearchProgress(`Found ${data.count} signals`);
              } else if (event === 'error') {
                throw new Error(data.message);
              }
            }
          }
        }
      }

      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      toast.error('Search failed');
      setStep('review');
    } finally {
      setSearching(false);
    }
  };

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries(prev =>
      prev.includes(industry)
        ? prev.filter(i => i !== industry)
        : [...prev, industry]
    );
  };

  const toggleSignalType = (signalType: SignalType) => {
    setSelectedSignalTypes(prev =>
      prev.includes(signalType)
        ? prev.filter(s => s !== signalType)
        : [...prev, signalType]
    );
  };

  const toggleLocation = (location: string) => {
    setSelectedLocations(prev =>
      prev.includes(location)
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  // Get recommended signal types based on selected industries
  const recommendedSignalTypes = getSignalTypesForIndustries(selectedIndustries);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0A2540] flex items-center gap-2">
          <Building2 className="h-6 w-6 text-[#635BFF]" />
          Agency Finder
        </h1>
        <p className="text-[#6B7C93] mt-1">
          Analyze a recruitment agency&apos;s website to find targeted hiring signals
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {['input', 'review', 'searching', 'results'].map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s ? 'bg-[#635BFF] text-white' :
              ['input', 'review', 'searching', 'results'].indexOf(step) > i ? 'bg-green-500 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {['input', 'review', 'searching', 'results'].indexOf(step) > i ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            {i < 3 && <div className="w-8 h-0.5 bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Input */}
      {step === 'input' && (
        <Card>
          <CardHeader>
            <CardTitle>Enter Agency Details</CardTitle>
            <CardDescription>
              We&apos;ll analyze their website to detect industry specializations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="domain">Agency Website Domain</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="domain"
                    placeholder="e.g., haysplc.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="pl-9"
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  />
                </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing || !domain.trim()}
                  className="bg-[#635BFF] hover:bg-[#5851ea]"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Analyze
                    </>
                  )}
                </Button>
              </div>
              {error && (
                <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </p>
              )}
            </div>

            <div className="text-sm text-[#6B7C93] bg-[#F6F9FC] p-3 rounded-lg">
              <p className="font-medium text-[#0A2540] mb-1">How it works:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>We scan the agency&apos;s website to detect their specializations</li>
                <li>You review and adjust the detected industries</li>
                <li>We find 5-10 relevant hiring signals for those industries</li>
                <li>You can enrich and export the signals as CSV</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          {analysis && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900">{analysis.summary}</p>
                    <p className="text-sm text-green-700 mt-1">
                      Confidence: {analysis.confidence}% | Focus: {analysis.focus.join(', ')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Select Industries</CardTitle>
              <CardDescription>
                Choose the industries this agency recruits for
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {AGENCY_INDUSTRIES.map((ind) => (
                  <Badge
                    key={ind.value}
                    variant={selectedIndustries.includes(ind.value) ? 'default' : 'outline'}
                    className={`cursor-pointer transition-all ${
                      selectedIndustries.includes(ind.value)
                        ? 'bg-[#635BFF] hover:bg-[#5851ea]'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => toggleIndustry(ind.value)}
                  >
                    {ind.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signal Types</CardTitle>
              <CardDescription>
                Select the types of hiring signals to find (sorted by urgency)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recommendedSignalTypes.map((signalType) => {
                  const config = getSignalTypeConfig(signalType);
                  const urgency = SIGNAL_HIRING_URGENCY[signalType];
                  const context = getSignalHiringContext(signalType);
                  const urgencyColors = {
                    immediate: 'bg-red-100 text-red-700',
                    short_term: 'bg-orange-100 text-orange-700',
                    medium_term: 'bg-yellow-100 text-yellow-700',
                    speculative: 'bg-gray-100 text-gray-600',
                  };

                  return (
                    <div
                      key={signalType}
                      className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${
                        selectedSignalTypes.includes(signalType)
                          ? 'border-[#635BFF] bg-[#F6F9FC]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleSignalType(signalType)}
                    >
                      <Checkbox
                        checked={selectedSignalTypes.includes(signalType)}
                        onCheckedChange={() => toggleSignalType(signalType)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{config?.label || signalType}</span>
                          <Badge className={`text-xs ${urgencyColors[urgency]}`}>
                            {urgency.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#6B7C93]">{context}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
              <CardDescription>
                Where should we search for signals?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {LOCATIONS.slice(0, 8).map((loc) => (
                  <Badge
                    key={loc.value}
                    variant={selectedLocations.includes(loc.value) ? 'default' : 'outline'}
                    className={`cursor-pointer transition-all ${
                      selectedLocations.includes(loc.value)
                        ? 'bg-[#635BFF] hover:bg-[#5851ea]'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => toggleLocation(loc.value)}
                  >
                    {loc.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('input')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleSearch}
              disabled={selectedIndustries.length === 0 || selectedSignalTypes.length === 0}
              className="bg-[#635BFF] hover:bg-[#5851ea]"
            >
              Find Signals
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Searching */}
      {step === 'searching' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-[#635BFF] animate-spin mb-4" />
            <p className="text-lg font-medium text-[#0A2540]">Searching for signals...</p>
            <p className="text-[#6B7C93] mt-2">{searchProgress}</p>
            {signals.length > 0 && (
              <p className="text-sm text-green-600 mt-2">
                Found {signals.length} signal{signals.length !== 1 ? 's' : ''} so far
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Results */}
      {step === 'results' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-[#0A2540]">
                Found {signals.length} Signal{signals.length !== 1 ? 's' : ''}
              </h2>
              <p className="text-sm text-[#6B7C93]">
                For {selectedIndustries.join(', ')} industries
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('review')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Adjust Criteria
              </Button>
              <Button variant="outline" onClick={() => {
                setStep('input');
                setDomain('');
                setAnalysis(null);
                setSignals([]);
              }}>
                New Search
              </Button>
            </div>
          </div>

          <AgencyResultsPanel signals={signals} onSignalsUpdated={setSignals} />
        </div>
      )}
    </div>
  );
}
