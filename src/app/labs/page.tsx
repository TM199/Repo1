'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function LabsPage() {
  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-amber-800 text-sm">
          <strong>Experimental Features:</strong> These tools are for testing data sources.
          Results are not saved and may be incomplete or unreliable.
        </p>
      </div>

      {/* Search Cards */}
      <div className="grid gap-6">
        <CompaniesHouseCard />
        <PlanningDataCard />
        <TendersCard />
      </div>
    </div>
  );
}

function CompaniesHouseCard() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/labs/companies-house?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResults(data);
    } catch (e) {
      setError('Failed to fetch');
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Companies House Search
          <Badge variant="outline">UK Only</Badge>
        </CardTitle>
        <CardDescription>
          Search UK companies and view officers/directors
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="ch-query" className="sr-only">Company name or number</Label>
            <Input
              id="ch-query"
              placeholder="Company name or number..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
            />
          </div>
          <Button onClick={search} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {results?.companies && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Company</th>
                  <th className="text-left p-3">Number</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.companies.slice(0, 10).map((c: any) => (
                  <tr key={c.company_number} className="border-t">
                    <td className="p-3">{c.company_name}</td>
                    <td className="p-3 font-mono text-gray-600">{c.company_number}</td>
                    <td className="p-3">
                      <Badge variant={c.company_status === 'active' ? 'default' : 'secondary'}>
                        {c.company_status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlanningDataCard() {
  const [daysBack, setDaysBack] = useState('7');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');

  const search = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/labs/planning?daysBack=${daysBack}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResults(data);
    } catch (e) {
      setError('Failed to fetch');
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Planning Data Search
          <Badge variant="outline">England Only</Badge>
        </CardTitle>
        <CardDescription>
          Recent significant planning applications (commercial, industrial)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="w-32">
            <Label htmlFor="planning-days">Days back</Label>
            <Input
              id="planning-days"
              type="number"
              value={daysBack}
              onChange={(e) => setDaysBack(e.target.value)}
              min="1"
              max="30"
            />
          </div>
          <Button onClick={search} disabled={loading}>
            {loading ? 'Fetching...' : 'Fetch Applications'}
          </Button>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {results && (
          <div>
            <p className="text-sm text-gray-600 mb-2">Found {results.count} applications</p>
            {results.signals?.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3">Title</th>
                      <th className="text-left p-3">Location</th>
                      <th className="text-left p-3">Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.signals.slice(0, 10).map((s: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-3 max-w-md truncate">{s.signal_title}</td>
                        <td className="p-3 text-gray-600">{s.location || '-'}</td>
                        <td className="p-3">
                          <Badge variant={s.decision === 'Approved' ? 'default' : 'secondary'}>
                            {s.decision}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TendersCard() {
  const [daysBack, setDaysBack] = useState('7');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');

  const search = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/labs/tenders?daysBack=${daysBack}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResults(data);
    } catch (e) {
      setError('Failed to fetch');
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Find a Tender (Contract Awards)
          <Badge variant="outline">UK Public Sector</Badge>
        </CardTitle>
        <CardDescription>
          High-value UK public sector contract awards (usually &gt;£118k)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="w-32">
            <Label htmlFor="tender-days">Days back</Label>
            <Input
              id="tender-days"
              type="number"
              value={daysBack}
              onChange={(e) => setDaysBack(e.target.value)}
              min="1"
              max="30"
            />
          </div>
          <Button onClick={search} disabled={loading}>
            {loading ? 'Fetching...' : 'Fetch Awards'}
          </Button>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {results && (
          <div>
            <p className="text-sm text-gray-600 mb-2">Found {results.count} awards</p>
            {results.signals?.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3">Supplier</th>
                      <th className="text-left p-3">Contract</th>
                      <th className="text-right p-3">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.signals.slice(0, 10).map((s: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-3 font-medium">{s.company_name}</td>
                        <td className="p-3 max-w-md truncate text-gray-600">
                          {s.signal_title.replace('Won major contract: ', '')}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {s.value ? `£${s.value.toLocaleString()}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
