'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

interface UserSettings {
  notify_email: boolean;
  email_frequency: 'daily' | 'weekly' | 'monthly';
  notify_url_sources: boolean;
  notify_ai_search: boolean;
  leadmagic_api_key: string;
  prospeo_api_key: string;
  enrichment_include_phone: boolean;
}

interface HubSpotStatus {
  connected: boolean;
  error?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({
    notify_email: false,
    email_frequency: 'weekly',
    notify_url_sources: false,
    notify_ai_search: false,
    leadmagic_api_key: '',
    prospeo_api_key: '',
    enrichment_include_phone: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hubspotStatus, setHubspotStatus] = useState<HubSpotStatus | null>(null);
  const [hubspotLoading, setHubspotLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchHubSpotStatus();
  }, []);

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
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[#0A2540]">Settings</h1>
        <Card className="max-w-2xl">
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#635BFF] border-t-transparent"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#0A2540]">Settings</h1>

      <Card className="max-w-2xl" style={{ backgroundColor: '#F6F9FC' }}>
        <CardHeader>
          <CardTitle className="text-[#0A2540]">Notification Settings</CardTitle>
          <CardDescription>
            Manage your notification preferences and signal alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Notifications Toggle */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="notify-email" className="text-[#0A2540]">
                Enable email notifications
              </Label>
              <p className="text-sm text-gray-600">
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
            <Label htmlFor="email-frequency" className="text-[#0A2540]">
              Email frequency
            </Label>
            <Select
              value={settings.email_frequency}
              onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                setSettings({ ...settings, email_frequency: value })
              }
              disabled={!settings.notify_email}
            >
              <SelectTrigger id="email-frequency" className="w-full max-w-xs bg-white">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-600">
              How often you'd like to receive email digests
            </p>
          </div>

          <div className="border-t border-gray-200 pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-[#0A2540]">Signal Type Notifications</h3>

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
                  className="text-sm font-medium text-[#0A2540] cursor-pointer"
                >
                  Notify me about URL source signals
                </Label>
                <p className="text-sm text-gray-600">
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
                  className="text-sm font-medium text-[#0A2540] cursor-pointer"
                >
                  Notify me about AI Search signals
                </Label>
                <p className="text-sm text-gray-600">
                  Get notified when new signals are found through AI-powered searches
                </p>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Enrichment API Settings */}
      <Card className="max-w-2xl" style={{ backgroundColor: '#F6F9FC' }}>
        <CardHeader>
          <CardTitle className="text-[#0A2540]">Lead Enrichment API Keys</CardTitle>
          <CardDescription>
            Configure API keys for contact enrichment (LeadMagic + Prospeo).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* LeadMagic API Key */}
          <div className="space-y-2">
            <Label htmlFor="leadmagic-key" className="text-[#0A2540]">
              LeadMagic API Key
            </Label>
            <Input
              id="leadmagic-key"
              type="password"
              placeholder="Enter your LeadMagic API key"
              value={settings.leadmagic_api_key}
              onChange={(e) =>
                setSettings({ ...settings, leadmagic_api_key: e.target.value })
              }
              className="bg-white"
            />
            <p className="text-sm text-gray-600">
              Used to find decision makers by job title at companies
            </p>
          </div>

          {/* Prospeo API Key */}
          <div className="space-y-2">
            <Label htmlFor="prospeo-key" className="text-[#0A2540]">
              Prospeo API Key
            </Label>
            <Input
              id="prospeo-key"
              type="password"
              placeholder="Enter your Prospeo API key"
              value={settings.prospeo_api_key}
              onChange={(e) =>
                setSettings({ ...settings, prospeo_api_key: e.target.value })
              }
              className="bg-white"
            />
            <p className="text-sm text-gray-600">
              Used to find email addresses and phone numbers
            </p>
          </div>

          {/* Include Phone Toggle */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="include-phone" className="text-[#0A2540]">
                Include phone numbers
              </Label>
              <p className="text-sm text-gray-600">
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
        </CardContent>
      </Card>

      {/* HubSpot Integration */}
      <Card className="max-w-2xl" style={{ backgroundColor: '#F6F9FC' }}>
        <CardHeader>
          <CardTitle className="text-[#0A2540] flex items-center gap-2">
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
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : hubspotStatus.connected ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-green-600">Connected</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Not connected</span>
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
          <p className="text-xs text-gray-500">
            When connected, you can push signals and their contacts to HubSpot as Companies and Contacts.
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="max-w-2xl">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto"
          style={{ backgroundColor: '#635BFF' }}
        >
          {saving ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
              Saving...
            </>
          ) : (
            'Save settings'
          )}
        </Button>
      </div>
    </div>
  );
}
