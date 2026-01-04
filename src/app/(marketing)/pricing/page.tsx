'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PRICING_TIERS, FEATURE_LABELS, FAQ_ITEMS } from '@/lib/subscription/tiers';
import { Check, X, ChevronDown, Sparkles } from 'lucide-react';

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden gradient-mesh">
        <div className="absolute top-10 left-10 w-72 h-72 bg-[#635BFF]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#00D4FF]/10 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6 text-center">
          {/* Trial Banner */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#635BFF]/10 border border-[#635BFF]/20 rounded-full text-sm font-medium text-[#635BFF] mb-8">
            <Sparkles className="h-4 w-4" />
            Try Signal Mentis free for 5 days. Full access, no restrictions.
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-[#0A2540] mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-[#425466] max-w-xl mx-auto mb-10">
            Start free, scale as you grow. All plans include a 5-day trial with full access.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 p-1 bg-white rounded-full border border-[#E3E8EE] shadow-sm">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !isAnnual
                  ? 'bg-[#635BFF] text-white'
                  : 'text-[#425466] hover:text-[#0A2540]'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                isAnnual
                  ? 'bg-[#635BFF] text-white'
                  : 'text-[#425466] hover:text-[#0A2540]'
              }`}
            >
              Annual
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isAnnual ? 'bg-white/20' : 'bg-[#0BBF7D]/10 text-[#0BBF7D]'
              }`}>
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.slug}
                className={`relative p-6 rounded-xl border transition-all ${
                  tier.highlighted
                    ? 'border-[#635BFF] shadow-lg shadow-[#635BFF]/10 scale-105'
                    : 'border-[#E3E8EE] hover:border-[#635BFF]/30 hover:shadow-lg'
                }`}
              >
                {tier.highlighted && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#635BFF] text-white px-3">
                    Most Popular
                  </Badge>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-[#0A2540] mb-1">{tier.name}</h3>
                  <p className="text-sm text-[#6B7C93]">{tier.description}</p>
                </div>

                <div className="mb-6">
                  {tier.monthlyPrice ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-[#0A2540]">
                          £{isAnnual ? Math.round(tier.annualPrice! / 12) : tier.monthlyPrice}
                        </span>
                        <span className="text-[#6B7C93]">/month</span>
                      </div>
                      {isAnnual && (
                        <p className="text-sm text-[#0BBF7D] mt-1">
                          £{tier.annualPrice}/year (save £{tier.monthlyPrice * 12 - tier.annualPrice!})
                        </p>
                      )}
                      {!isAnnual && (
                        <p className="text-sm text-[#6B7C93] mt-1">
                          Billed monthly
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-3xl font-bold text-[#0A2540]">Custom</div>
                  )}
                </div>

                <Link href={tier.slug === 'enterprise' ? '/contact' : '/signup'}>
                  <Button
                    className={`w-full mb-6 ${
                      tier.highlighted
                        ? 'bg-[#635BFF] hover:bg-[#5851ea] text-white'
                        : tier.slug === 'enterprise'
                        ? 'bg-[#0A2540] hover:bg-[#0A2540]/90 text-white'
                        : 'bg-white border border-[#E3E8EE] text-[#0A2540] hover:bg-[#F6F9FC]'
                    }`}
                  >
                    {tier.cta}
                  </Button>
                </Link>

                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-[#0BBF7D] flex-shrink-0" />
                    <span className="text-[#0A2540]">
                      {tier.features.icpProfiles === 'unlimited'
                        ? 'Unlimited ICP Profiles'
                        : `${tier.features.icpProfiles} ICP Profiles`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-[#0BBF7D] flex-shrink-0" />
                    <span className="text-[#0A2540]">
                      {tier.features.enrichmentsPerMonth === 'custom'
                        ? 'Custom Enrichments'
                        : `${tier.features.enrichmentsPerMonth} Enrichments/mo`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-[#0BBF7D] flex-shrink-0" />
                    <span className="text-[#0A2540]">Unlimited Signal Viewing</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-[#0BBF7D] flex-shrink-0" />
                    <span className="text-[#0A2540]">CSV Export</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    {tier.features.aiClassification ? (
                      <>
                        <Check className="h-4 w-4 text-[#0BBF7D] flex-shrink-0" />
                        <span className="text-[#0A2540]">AI Classification</span>
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 text-[#C4CAD4] flex-shrink-0" />
                        <span className="text-[#6B7C93]">AI Classification</span>
                      </>
                    )}
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    {tier.features.hubspotIntegration ? (
                      <>
                        <Check className="h-4 w-4 text-[#0BBF7D] flex-shrink-0" />
                        <span className="text-[#0A2540]">HubSpot Integration</span>
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 text-[#C4CAD4] flex-shrink-0" />
                        <span className="text-[#6B7C93]">HubSpot Integration</span>
                      </>
                    )}
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    {tier.features.prioritySupport ? (
                      <>
                        <Check className="h-4 w-4 text-[#0BBF7D] flex-shrink-0" />
                        <span className="text-[#0A2540]">Priority Support</span>
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 text-[#C4CAD4] flex-shrink-0" />
                        <span className="text-[#6B7C93]">Priority Support</span>
                      </>
                    )}
                  </li>
                  {tier.features.dedicatedAccountManager && (
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-[#0BBF7D] flex-shrink-0" />
                      <span className="text-[#0A2540]">Dedicated Account Manager</span>
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-16 bg-[#F6F9FC]">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0A2540] text-center mb-12">
            Compare all features
          </h2>

          <div className="bg-white rounded-xl border border-[#E3E8EE] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E3E8EE]">
                    <th className="text-left px-6 py-4 text-sm font-medium text-[#6B7C93]">Feature</th>
                    {PRICING_TIERS.map((tier) => (
                      <th
                        key={tier.slug}
                        className={`text-center px-6 py-4 text-sm font-semibold ${
                          tier.highlighted ? 'text-[#635BFF]' : 'text-[#0A2540]'
                        }`}
                      >
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(FEATURE_LABELS).map(([key, { label }]) => (
                    <tr key={key} className="border-b border-[#E3E8EE] last:border-0">
                      <td className="px-6 py-4 text-sm text-[#0A2540]">{label}</td>
                      {PRICING_TIERS.map((tier) => {
                        const value = tier.features[key as keyof typeof tier.features];
                        return (
                          <td key={tier.slug} className="text-center px-6 py-4">
                            {typeof value === 'boolean' ? (
                              value ? (
                                <Check className="h-5 w-5 text-[#0BBF7D] mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-[#C4CAD4] mx-auto" />
                              )
                            ) : (
                              <span className="text-sm font-medium text-[#0A2540]">
                                {value === 'unlimited' ? 'Unlimited' : value === 'custom' ? 'Custom' : value}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0A2540] text-center mb-12">
            Frequently asked questions
          </h2>

          <div className="space-y-4">
            {FAQ_ITEMS.map((item, index) => (
              <div
                key={index}
                className="border border-[#E3E8EE] rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#F6F9FC] transition-colors"
                >
                  <span className="font-medium text-[#0A2540]">{item.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-[#6B7C93] transition-transform ${
                      openFaq === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4 text-sm text-[#425466] leading-relaxed">
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-mesh-dark text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to find your next customers?
          </h2>
          <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto">
            Start your 5-day free trial today. No credit card required.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-white text-[#0A2540] hover:bg-white/90 px-8 h-12 text-base font-medium shadow-lg">
              Start free trial
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
