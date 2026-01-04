export type TierName = 'starter' | 'growth' | 'scale' | 'enterprise';

export interface PricingTier {
  name: string;
  slug: TierName;
  description: string;
  monthlyPrice: number | null; // null for custom/enterprise
  annualPrice: number | null;
  features: {
    icpProfiles: number | 'unlimited';
    enrichmentsPerMonth: number | 'custom';
    viewSignals: boolean;
    csvExport: boolean;
    emailNotifications: boolean;
    contractSignals: boolean;
    batchOperations: boolean;
    aiClassification: boolean;
    hubspotIntegration: boolean;
    prioritySupport: boolean;
    dedicatedAccountManager: boolean;
  };
  highlighted?: boolean;
  cta: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Starter',
    slug: 'starter',
    description: 'For small teams getting started with signal intelligence',
    monthlyPrice: 149,
    annualPrice: 1430,
    features: {
      icpProfiles: 3,
      enrichmentsPerMonth: 100,
      viewSignals: true,
      csvExport: true,
      emailNotifications: true,
      contractSignals: true,
      batchOperations: true,
      aiClassification: false,
      hubspotIntegration: false,
      prioritySupport: false,
      dedicatedAccountManager: false,
    },
    cta: 'Start Free Trial',
  },
  {
    name: 'Growth',
    slug: 'growth',
    description: 'For growing agencies that need more power',
    monthlyPrice: 299,
    annualPrice: 2870,
    features: {
      icpProfiles: 5,
      enrichmentsPerMonth: 300,
      viewSignals: true,
      csvExport: true,
      emailNotifications: true,
      contractSignals: true,
      batchOperations: true,
      aiClassification: true,
      hubspotIntegration: false,
      prioritySupport: false,
      dedicatedAccountManager: false,
    },
    highlighted: true,
    cta: 'Start Free Trial',
  },
  {
    name: 'Scale',
    slug: 'scale',
    description: 'For established agencies with advanced needs',
    monthlyPrice: 499,
    annualPrice: 4790,
    features: {
      icpProfiles: 10,
      enrichmentsPerMonth: 500,
      viewSignals: true,
      csvExport: true,
      emailNotifications: true,
      contractSignals: true,
      batchOperations: true,
      aiClassification: true,
      hubspotIntegration: true,
      prioritySupport: true,
      dedicatedAccountManager: false,
    },
    cta: 'Start Free Trial',
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Custom solutions for large organizations',
    monthlyPrice: null,
    annualPrice: null,
    features: {
      icpProfiles: 'unlimited',
      enrichmentsPerMonth: 'custom',
      viewSignals: true,
      csvExport: true,
      emailNotifications: true,
      contractSignals: true,
      batchOperations: true,
      aiClassification: true,
      hubspotIntegration: true,
      prioritySupport: true,
      dedicatedAccountManager: true,
    },
    cta: 'Contact Sales',
  },
];

export const FEATURE_LABELS: Record<keyof PricingTier['features'], { label: string; tooltip: string }> = {
  icpProfiles: {
    label: 'ICP Profiles',
    tooltip: 'Create ideal customer profiles to target specific company types',
  },
  enrichmentsPerMonth: {
    label: 'Enrichments/month',
    tooltip: 'Get contact details and company data for your signals',
  },
  viewSignals: {
    label: 'View Signals',
    tooltip: 'See all pain signals detected for companies matching your ICPs',
  },
  csvExport: {
    label: 'CSV Export',
    tooltip: 'Export your signals and contacts to CSV for use in other tools',
  },
  emailNotifications: {
    label: 'Email Notifications',
    tooltip: 'Get daily or weekly email digests of new signals',
  },
  contractSignals: {
    label: 'Contract Signals',
    tooltip: 'Detect government contract awards and opportunities',
  },
  batchOperations: {
    label: 'Batch Operations',
    tooltip: 'Enrich multiple contacts at once to save time',
  },
  aiClassification: {
    label: 'AI Classification',
    tooltip: 'Automatically filter out recruitment agencies from your results',
  },
  hubspotIntegration: {
    label: 'HubSpot Integration',
    tooltip: 'Push signals and contacts directly to your HubSpot CRM',
  },
  prioritySupport: {
    label: 'Priority Support',
    tooltip: 'Get faster response times and dedicated support',
  },
  dedicatedAccountManager: {
    label: 'Dedicated Account Manager',
    tooltip: 'Your own account manager for strategic guidance',
  },
};

export const FAQ_ITEMS = [
  {
    question: 'What happens after my trial ends?',
    answer: "After your 5-day trial, you'll be automatically subscribed to your chosen plan. You can cancel anytime before the trial ends and won't be charged.",
  },
  {
    question: 'Can I change plans later?',
    answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express) and can arrange invoicing for Enterprise plans.',
  },
  {
    question: 'Do enrichments roll over?',
    answer: 'No, unused enrichments do not roll over to the next month. We recommend choosing a plan that matches your typical monthly usage.',
  },
];
