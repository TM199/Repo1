# Pricing Page Build Prompt

## Context

**Signal Mentis** is a B2B lead intelligence SaaS for recruitment agencies. It identifies companies that are "in pain" (hiring challenges, long-open roles, etc.) and surfaces them as sales opportunities for recruiters.

The full subscription tier implementation plan is at: `.claude/plans/pure-dreaming-coral.md`

---

## Task

Build a **pricing page** for Signal Mentis at `/app/(marketing)/pricing/page.tsx` (or similar route structure).

The page should have:
1. A modern, clean design matching the existing dashboard aesthetic
2. Pricing tier cards with feature comparison checkmarks
3. Toggle for monthly/annual pricing (20% annual discount)
4. Clear CTAs for each tier

---

## Pricing Tiers

### Trial (5 Days)
- **Price**: Free (credit card required)
- **Purpose**: Let prospects experience full value before committing

### Starter - £149/month (£1,430/year)
- 3 ICP Profiles
- 100 Enrichments/month
- Unlimited Signal Viewing
- CSV Export
- Email Notifications
- Contract Signals
- Batch Operations
- ❌ HubSpot Integration
- ❌ AI Classification
- ❌ Priority Support

### Growth - £299/month (£2,870/year) - **MOST POPULAR**
- 5 ICP Profiles
- 300 Enrichments/month
- Unlimited Signal Viewing
- CSV Export
- Email Notifications
- Contract Signals
- Batch Operations
- AI Classification
- ❌ HubSpot Integration
- ❌ Priority Support

### Scale - £499/month (£4,790/year)
- 10 ICP Profiles
- 500 Enrichments/month
- Unlimited Signal Viewing
- CSV Export
- Email Notifications
- Contract Signals
- Batch Operations
- AI Classification
- ✅ HubSpot Integration
- ✅ Priority Support

### Enterprise - Custom Pricing
- Unlimited ICP Profiles
- Custom Enrichment Volume
- All Features
- Dedicated Account Manager
- Custom Integrations
- SLA Guarantees

---

## Feature Comparison Table

| Feature | Starter | Growth | Scale | Enterprise |
|---------|---------|--------|-------|------------|
| ICP Profiles | 3 | 5 | 10 | Unlimited |
| Enrichments/month | 100 | 300 | 500 | Custom |
| View Signals | ✓ | ✓ | ✓ | ✓ |
| CSV Export | ✓ | ✓ | ✓ | ✓ |
| Email Notifications | ✓ | ✓ | ✓ | ✓ |
| Contract Signals | ✓ | ✓ | ✓ | ✓ |
| Batch Operations | ✓ | ✓ | ✓ | ✓ |
| AI Classification | ✗ | ✓ | ✓ | ✓ |
| HubSpot Integration | ✗ | ✗ | ✓ | ✓ |
| Priority Support | ✗ | ✗ | ✓ | ✓ |
| Dedicated Account Mgr | ✗ | ✗ | ✗ | ✓ |

---

## Design Requirements

1. **Pricing Cards**
   - Each tier as a card
   - "Growth" tier highlighted as "Most Popular" with accent border/badge
   - Monthly price prominent, annual savings shown below
   - List of included features with ✓ checkmarks
   - CTA button: "Start Free Trial" for all paid tiers, "Contact Sales" for Enterprise

2. **Annual/Monthly Toggle**
   - Default to monthly view
   - When annual selected, show:
     - Annual price (e.g., £1,430/year)
     - "Save 20%" badge
     - Crossed out monthly equivalent

3. **Feature Comparison Section**
   - Full feature matrix below the cards
   - Hover tooltips explaining each feature
   - Clearly show what's NOT included per tier

4. **Trial Banner**
   - Above pricing cards: "Try Signal Mentis free for 5 days. Full access, no restrictions."

5. **FAQ Section**
   - "What happens after my trial ends?"
   - "Can I change plans later?"
   - "What payment methods do you accept?"
   - "Do enrichments roll over?"

---

## Technical Notes

- Use existing UI components from `src/components/ui/` (shadcn/ui style)
- Colors should match existing brand (check `globals.css` and existing dashboard pages)
- Page should be server-rendered, no client-side state needed initially
- Consider using Tailwind CSS grid for responsive card layout

---

## Reference Files

- Tier configuration will be at: `src/lib/subscription/tiers.ts`
- Existing dashboard styles: `src/app/(dashboard)/`
- Full implementation plan: `.claude/plans/pure-dreaming-coral.md`

---

## Example Structure

```tsx
// /app/(marketing)/pricing/page.tsx

export default function PricingPage() {
  return (
    <div>
      {/* Hero Section */}
      <section>
        <h1>Simple, transparent pricing</h1>
        <p>Start free, scale as you grow</p>
        {/* Monthly/Annual Toggle */}
      </section>

      {/* Pricing Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Starter Card */}
        {/* Growth Card (highlighted) */}
        {/* Scale Card */}
        {/* Enterprise Card */}
      </section>

      {/* Feature Comparison Table */}
      <section>
        <h2>Compare all features</h2>
        {/* Full feature matrix */}
      </section>

      {/* FAQ Section */}
      <section>
        <h2>Frequently asked questions</h2>
        {/* Accordion FAQ items */}
      </section>
    </div>
  );
}
```

---

## Deliverables

1. Pricing page component at appropriate route
2. Responsive design (mobile-first)
3. Feature comparison with clear visual hierarchy
4. Annual/monthly pricing toggle
5. Styled to match existing Signal Mentis aesthetic
