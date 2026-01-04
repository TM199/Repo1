'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Bot,
  ShieldCheck,
  AlertTriangle,
  Bell,
  Key,
  Plug,
  Settings2
} from 'lucide-react';

const DEFAULT_ROLES = [
  'CEO',
  'Founder',
  'Head of Talent',
  'Hiring Manager',
  'HR Director',
  'VP Sales',
  'CTO',
  'Managing Director',
  'Operations Director',
  'Head of People',
];

interface UserSettings {
  notify_email: boolean;
  email_frequency: 'daily' | 'weekly' | 'monthly';
  notify_url_sources: boolean;
  notify_ai_search: boolean;
  notification_sound_enabled: boolean;
  leadmagic_api_key: string;
  prospeo_api_key: string;
  enrichment_include_phone: boolean;
  default_enrichment_roles: string[];
}

interface HubSpotStatus {
  connected: boolean;
  error?: string;
}

interface ApiTestResult {
  valid: boolean;
  message?: string;
  warning?: string;
  error?: string;
  credits?: { used: number; total: number };
}

interface ClassificationStatus {
  unclassified: number;
  agencies: number;
  verified: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({
    notify_email: false,
    email_frequency: 'weekly',
    notify_url_sources: false,
    notify_ai_search: false,
    notification_sound_enabled: true,
    leadmagic_api_key: '',
    prospeo_api_key: '',
    enrichment_include_phone: false,
    default_enrichment_roles: ['CEO', 'Founder', 'Head of Talent', 'Hiring Manager'],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hubspotStatus, setHubspotStatus] = useState<HubSpotStatus | null>(null);
  const [hubspotLoading, setHubspotLoading] = useState(false);
  const [testingLeadMagic, setTestingLeadMagic] = useState(false);
  const [leadMagicResult, setLeadMagicResult] = useState<ApiTestResult | null>(null);
  const [testingProspeo, setTestingProspeo] = useState(false);
  const [prospeoResult, setProspeoResult] = useState<ApiTestResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [classificationStatus, setClassificationStatus] = useState<ClassificationStatus | null>(null);
  const [classifying, setClassifying] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchHubSpotStatus();
    fetchClassificationStatus();
  }, []);

  const fetchClassificationStatus = async () => {
    try {
      const response = await fetch('/api/admin/classify-companies');
      if (response.ok) {
        const data = await response.json();
        setClassificationStatus(data);
      }
    } catch {
      // Ignore errors - feature may not be available
    }
  };

  const handleClassifyAll = async () => {
    setClassifying(true);
    try {
      const response = await fetch('/api/admin/classify-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50 }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || `Queued ${data.queued} companies`);
        setTimeout(fetchClassificationStatus, 2000);
      } else {
        toast.error(data.error || 'Failed to start classification');
      }
    } catch {
      toast.error('Failed to start classification');
    } finally {
      setClassifying(false);
    }
  };

  const fetchHubSpotStatus = async () => {
    try {
      const response = await fetch('/api/integrations/hubspot');
      const data = await response.json();
      setHubspotStatus(data);
    } catch {
      setHubspotStatus({ connected: false });
    }
  };

  const handleHubSpotConnect = async () => {
    setHubspotLoading(true);
    try {
      const response = await fetch('/api/integrations/hubspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_auth_url' }),
      });
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error(data.error || 'Failed to get authorization URL');
      }
    } catch {
      toast.error('Failed to connect to HubSpot');
    } finally {
      setHubspotLoading(false);
    }
  };

  const handleHubSpotDisconnect = async () => {
    setHubspotLoading(true);
    try {
      const response = await fetch('/api/integrations/hubspot', { method: 'DELETE' });
      if (response.ok) {
        setHubspotStatus({ connected: false });
        toast.success('HubSpot disconnected');
      } else {
        toast.error('Failed to disconnect HubSpot');
      }
    } catch {
      toast.error('Failed to disconnect HubSpot');
    } finally {
      setHubspotLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaved(false);
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success('Settings saved successfully');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestLeadMagic = async () => {
    if (!settings.leadmagic_api_key) {
      toast.error('Please enter a LeadMagic API key first');
      return;
    }
    setTestingLeadMagic(true);
    setLeadMagicResult(null);
    try {
      const response = await fetch('/api/settings/test-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'leadmagic', apiKey: settings.leadmagic_api_key }),
      });
      const result = await response.json();
      setLeadMagicResult(result);
      if (result.valid) {
        toast.success(result.message || 'LeadMagic API key is valid');
      } else {
        toast.error(result.error || 'Invalid API key');
      }
    } catch {
      toast.error('Failed to test API key');
      setLeadMagicResult({ valid: false, error: 'Network error' });
    } finally {
      setTestingLeadMagic(false);
    }
  };

  const handleTestProspeo = async () => {
    if (!settings.prospeo_api_key) {
      toast.error('Please enter a Prospeo API key first');
      return;
    }
    setTestingProspeo(true);
    setProspeoResult(null);
    try {
      const response = await fetch('/api/settings/test-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'prospeo', apiKey: settings.prospeo_api_key }),
      });
      const result = await response.json();
      setProspeoResult(result);
      if (result.valid) {
        toast.success(result.message || 'Prospeo API key is valid');
      } else {
        toast.error(result.error || 'Invalid API key');
      }
    } catch {
      toast.error('Failed to test API key');
      setProspeoResult({ valid: false, error: 'Network error' });
    } finally {
      setTestingProspeo(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <Card className="max-w-4xl">
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="hidden lg:flex"
          style={{ backgroundColor: saved ? '#047857' : '#635BFF' }}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : saved ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Saved!
            </>
          ) : (
            'Save settings'
          )}
        </Button>
      </div>

      <Tabs defaultValue="notifications" className="max-w-4xl">
        {/* Mobile: Horizontal tabs */}
        <TabsList className="lg:hidden w-full grid grid-cols-4 h-auto p-1">
          <TabsTrigger value="notifications" className="flex flex-col gap-1 py-2 px-1">
            <Bell className="h-4 w-4" />
            <span className="text-xs">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="flex flex-col gap-1 py-2 px-1">
            <Key className="h-4 w-4" />
            <span className="text-xs">API</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex flex-col gap-1 py-2 px-1">
            <Plug className="h-4 w-4" />
            <span className="text-xs">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex flex-col gap-1 py-2 px-1">
            <Settings2 className="h-4 w-4" />
            <span className="text-xs">Advanced</span>
          </TabsTrigger>
        </TabsList>

        {/* Desktop: Vertical tabs layout */}
        <div className="hidden lg:flex gap-6">
          <TabsList className="flex flex-col h-fit w-48 bg-muted p-1 rounded-lg">
            <TabsTrigger value="notifications" className="w-full justify-start gap-2 px-3">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="w-full justify-start gap-2 px-3">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="integrations" className="w-full justify-start gap-2 px-3">
              <Plug className="h-4 w-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="advanced" className="w-full justify-start gap-2 px-3">
              <Settings2 className="h-4 w-4" />
              Advanced
            </TabsTrigger>
          </TabsList>

          <div className="flex-1">
            <TabsContent value="notifications" className="mt-0">
              <NotificationsTab settings={settings} setSettings={setSettings} />
            </TabsContent>
            <TabsContent value="api-keys" className="mt-0">
              <ApiKeysTab
                settings={settings}
                setSettings={setSettings}
                testingLeadMagic={testingLeadMagic}
                leadMagicResult={leadMagicResult}
                handleTestLeadMagic={handleTestLeadMagic}
                testingProspeo={testingProspeo}
                prospeoResult={prospeoResult}
                handleTestProspeo={handleTestProspeo}
                setLeadMagicResult={setLeadMagicResult}
                setProspeoResult={setProspeoResult}
              />
            </TabsContent>
            <TabsContent value="integrations" className="mt-0">
              <IntegrationsTab
                hubspotStatus={hubspotStatus}
                hubspotLoading={hubspotLoading}
                handleHubSpotConnect={handleHubSpotConnect}
                handleHubSpotDisconnect={handleHubSpotDisconnect}
              />
            </TabsContent>
            <TabsContent value="advanced" className="mt-0">
              <AdvancedTab
                classificationStatus={classificationStatus}
                classifying={classifying}
                handleClassifyAll={handleClassifyAll}
              />
            </TabsContent>
          </div>
        </div>

        {/* Mobile: Tab content */}
        <div className="lg:hidden mt-4">
          <TabsContent value="notifications">
            <NotificationsTab settings={settings} setSettings={setSettings} />
          </TabsContent>
          <TabsContent value="api-keys">
            <ApiKeysTab
              settings={settings}
              setSettings={setSettings}
              testingLeadMagic={testingLeadMagic}
              leadMagicResult={leadMagicResult}
              handleTestLeadMagic={handleTestLeadMagic}
              testingProspeo={testingProspeo}
              prospeoResult={prospeoResult}
              handleTestProspeo={handleTestProspeo}
              setLeadMagicResult={setLeadMagicResult}
              setProspeoResult={setProspeoResult}
            />
          </TabsContent>
          <TabsContent value="integrations">
            <IntegrationsTab
              hubspotStatus={hubspotStatus}
              hubspotLoading={hubspotLoading}
              handleHubSpotConnect={handleHubSpotConnect}
              handleHubSpotDisconnect={handleHubSpotDisconnect}
            />
          </TabsContent>
          <TabsContent value="advanced">
            <AdvancedTab
              classificationStatus={classificationStatus}
              classifying={classifying}
              handleClassifyAll={handleClassifyAll}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Mobile: Sticky save button */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-10">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full shadow-lg"
          style={{ backgroundColor: saved ? '#047857' : '#635BFF' }}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : saved ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Saved!
            </>
          ) : (
            'Save settings'
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Tab Components
// ============================================================================

interface NotificationsTabProps {
  settings: UserSettings;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
}

function NotificationsTab({ settings, setSettings }: NotificationsTabProps) {
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-foreground">Notification Settings</CardTitle>
        <CardDescription>
          Manage your notification preferences and signal alerts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Notifications Toggle */}
        <div className="flex items-center justify-between space-x-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="notify-email" className="text-foreground">
              Enable email notifications
            </Label>
            <p className="text-sm text-muted-foreground">
              Receive notifications about new signals via email
            </p>
          </div>
          <Switch
            id="notify-email"
            checked={settings.notify_email}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, notify_email: checked })
            }
          />
        </div>

        {/* Email Frequency */}
        <div className="space-y-2">
          <Label htmlFor="email-frequency" className="text-foreground">
            Email frequency
          </Label>
          <Select
            value={settings.email_frequency}
            onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
              setSettings({ ...settings, email_frequency: value })
            }
            disabled={!settings.notify_email}
          >
            <SelectTrigger id="email-frequency" className="w-full max-w-xs bg-background">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            How often you'd like to receive email digests
          </p>
        </div>

        {/* Notification Sound Toggle */}
        <div className="flex items-center justify-between space-x-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="notification-sound" className="text-foreground">
              Notification sound
            </Label>
            <p className="text-sm text-muted-foreground">
              Play a sound when new notifications arrive
            </p>
          </div>
          <Switch
            id="notification-sound"
            checked={settings.notification_sound_enabled}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, notification_sound_enabled: checked })
            }
          />
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Signal Type Notifications</h3>

          {/* URL Sources Checkbox */}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="notify-url-sources"
              checked={settings.notify_url_sources}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, notify_url_sources: checked as boolean })
              }
              disabled={!settings.notify_email}
            />
            <div className="space-y-1">
              <Label
                htmlFor="notify-url-sources"
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                Notify me about URL source signals
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified when new signals are detected from your monitored URLs
              </p>
            </div>
          </div>

          {/* AI Search Checkbox */}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="notify-ai-search"
              checked={settings.notify_ai_search}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, notify_ai_search: checked as boolean })
              }
              disabled={!settings.notify_email}
            />
            <div className="space-y-1">
              <Label
                htmlFor="notify-ai-search"
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                Notify me about AI Search signals
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified when new signals are found through AI-powered searches
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ApiKeysTabProps {
  settings: UserSettings;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  testingLeadMagic: boolean;
  leadMagicResult: ApiTestResult | null;
  handleTestLeadMagic: () => void;
  testingProspeo: boolean;
  prospeoResult: ApiTestResult | null;
  handleTestProspeo: () => void;
  setLeadMagicResult: React.Dispatch<React.SetStateAction<ApiTestResult | null>>;
  setProspeoResult: React.Dispatch<React.SetStateAction<ApiTestResult | null>>;
}

function ApiKeysTab({
  settings,
  setSettings,
  testingLeadMagic,
  leadMagicResult,
  handleTestLeadMagic,
  testingProspeo,
  prospeoResult,
  handleTestProspeo,
  setLeadMagicResult,
  setProspeoResult
}: ApiKeysTabProps) {
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-foreground">Lead Enrichment API Keys</CardTitle>
        <CardDescription>
          Configure API keys for contact enrichment (LeadMagic + Prospeo).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* LeadMagic API Key */}
        <div className="space-y-2">
          <Label htmlFor="leadmagic-key" className="text-foreground">
            LeadMagic API Key
          </Label>
          <div className="flex gap-2">
            <Input
              id="leadmagic-key"
              type="password"
              placeholder="Enter your LeadMagic API key"
              value={settings.leadmagic_api_key}
              onChange={(e) => {
                setSettings({ ...settings, leadmagic_api_key: e.target.value });
                setLeadMagicResult(null);
              }}
              className="bg-background flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestLeadMagic}
              disabled={testingLeadMagic || !settings.leadmagic_api_key}
              className="shrink-0"
            >
              {testingLeadMagic ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : leadMagicResult?.valid ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : leadMagicResult?.valid === false ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                'Test'
              )}
            </Button>
          </div>
          {leadMagicResult && (
            <p className={`text-xs ${leadMagicResult.valid ? 'text-green-600' : 'text-red-600'}`}>
              {leadMagicResult.valid ? (leadMagicResult.message || 'API key valid') : (leadMagicResult.error || 'Invalid API key')}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Used to find decision makers by job title at companies
          </p>
        </div>

        {/* Prospeo API Key */}
        <div className="space-y-2">
          <Label htmlFor="prospeo-key" className="text-foreground">
            Prospeo API Key
          </Label>
          <div className="flex gap-2">
            <Input
              id="prospeo-key"
              type="password"
              placeholder="Enter your Prospeo API key"
              value={settings.prospeo_api_key}
              onChange={(e) => {
                setSettings({ ...settings, prospeo_api_key: e.target.value });
                setProspeoResult(null);
              }}
              className="bg-background flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestProspeo}
              disabled={testingProspeo || !settings.prospeo_api_key}
              className="shrink-0"
            >
              {testingProspeo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : prospeoResult?.valid ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : prospeoResult?.valid === false ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                'Test'
              )}
            </Button>
          </div>
          {prospeoResult && (
            <p className={`text-xs ${prospeoResult.valid ? 'text-green-600' : 'text-red-600'}`}>
              {prospeoResult.valid
                ? (prospeoResult.credits
                  ? `Valid - ${prospeoResult.credits.used}/${prospeoResult.credits.total} credits used`
                  : (prospeoResult.message || 'API key valid'))
                : (prospeoResult.error || 'Invalid API key')}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Used to find email addresses and phone numbers
          </p>
        </div>

        {/* Include Phone Toggle */}
        <div className="flex items-center justify-between space-x-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="include-phone" className="text-foreground">
              Include phone numbers
            </Label>
            <p className="text-sm text-muted-foreground">
              Phone lookups cost 10x more than email (10 credits vs 1 credit)
            </p>
          </div>
          <Switch
            id="include-phone"
            checked={settings.enrichment_include_phone}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, enrichment_include_phone: checked })
            }
          />
        </div>

        {/* Default Enrichment Roles */}
        <div className="border-t border-border pt-6 space-y-4">
          <div className="space-y-1">
            <Label className="text-foreground">Default Roles to Enrich</Label>
            <p className="text-sm text-muted-foreground">
              Select which roles to search for by default when enriching signals
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEFAULT_ROLES.map((role) => (
              <div key={role} className="flex items-center space-x-2">
                <Checkbox
                  id={`role-${role}`}
                  checked={settings.default_enrichment_roles?.includes(role) ?? false}
                  onCheckedChange={(checked) => {
                    const currentRoles = settings.default_enrichment_roles || [];
                    if (checked) {
                      setSettings({
                        ...settings,
                        default_enrichment_roles: [...currentRoles, role],
                      });
                    } else {
                      setSettings({
                        ...settings,
                        default_enrichment_roles: currentRoles.filter((r) => r !== role),
                      });
                    }
                  }}
                />
                <Label
                  htmlFor={`role-${role}`}
                  className="text-sm text-foreground cursor-pointer"
                >
                  {role}
                </Label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            You can override these when enriching individual signals
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface IntegrationsTabProps {
  hubspotStatus: HubSpotStatus | null;
  hubspotLoading: boolean;
  handleHubSpotConnect: () => void;
  handleHubSpotDisconnect: () => void;
}

function IntegrationsTab({
  hubspotStatus,
  hubspotLoading,
  handleHubSpotConnect,
  handleHubSpotDisconnect
}: IntegrationsTabProps) {
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#FF7A59">
            <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.981 2.202 2.202 0 00-2.201-2.201 2.202 2.202 0 00-2.201 2.201c0 .858.493 1.599 1.21 1.958v2.88a5.15 5.15 0 00-2.212 1.063L6.39 3.201A2.61 2.61 0 006.55 2.07a2.615 2.615 0 00-2.614-2.614A2.615 2.615 0 001.322 2.07a2.61 2.61 0 002.614 2.614c.48 0 .928-.13 1.314-.356l7.576 5.727a5.14 5.14 0 00-.764 2.693 5.15 5.15 0 00.731 2.636l-2.326 2.326a2.093 2.093 0 00-.614-.097 2.116 2.116 0 00-2.113 2.113 2.116 2.116 0 002.113 2.113 2.116 2.116 0 002.113-2.113c0-.22-.034-.432-.097-.632l2.297-2.297a5.161 5.161 0 003.064 1.012 5.168 5.168 0 005.159-5.159 5.155 5.155 0 00-4.225-5.07zm-.933 7.502a2.425 2.425 0 01-2.423-2.423 2.425 2.425 0 012.423-2.423 2.425 2.425 0 012.423 2.423 2.425 2.425 0 01-2.423 2.423z" />
          </svg>
          HubSpot Integration
        </CardTitle>
        <CardDescription>
          Push signals and contacts directly to your HubSpot CRM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hubspotStatus === null ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : hubspotStatus.connected ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-green-600">Connected</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Not connected</span>
              </>
            )}
          </div>
          {hubspotStatus?.connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleHubSpotDisconnect}
              disabled={hubspotLoading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {hubspotLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleHubSpotConnect}
              disabled={hubspotLoading}
              style={{ backgroundColor: '#FF7A59' }}
              className="hover:opacity-90"
            >
              {hubspotLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Connect HubSpot
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          When connected, you can push signals and their contacts to HubSpot as Companies and Contacts.
        </p>
      </CardContent>
    </Card>
  );
}

interface AdvancedTabProps {
  classificationStatus: ClassificationStatus | null;
  classifying: boolean;
  handleClassifyAll: () => void;
}

function AdvancedTab({ classificationStatus, classifying, handleClassifyAll }: AdvancedTabProps) {
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          AI Agency Classification
        </CardTitle>
        <CardDescription>
          Classify companies as recruitment agencies using AI-powered analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {classificationStatus && (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-background rounded-lg border">
              <div className="text-2xl font-bold text-muted-foreground">
                {classificationStatus.unclassified}
              </div>
              <div className="text-xs text-muted-foreground">Unclassified</div>
            </div>
            <div className="p-3 bg-background rounded-lg border">
              <div className="flex items-center justify-center gap-1">
                <ShieldCheck className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold text-green-600">
                  {classificationStatus.verified}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">Verified</div>
            </div>
            <div className="p-3 bg-background rounded-lg border">
              <div className="flex items-center justify-center gap-1">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold text-red-600">
                  {classificationStatus.agencies}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">Agencies</div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Uses Tavily + Claude to analyze company websites
          </p>
          <Button
            size="sm"
            onClick={handleClassifyAll}
            disabled={classifying || classificationStatus?.unclassified === 0}
            style={{ backgroundColor: '#635BFF' }}
            className="hover:opacity-90"
          >
            {classifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Classifying...
              </>
            ) : (
              <>
                <Bot className="h-4 w-4 mr-2" />
                Classify {Math.min(classificationStatus?.unclassified || 0, 50)} Companies
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Classifies up to 50 companies per batch. Agencies are flagged in the UI and exports.
        </p>
      </CardContent>
    </Card>
  );
}
