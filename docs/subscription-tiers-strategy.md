# Signal Mentis Subscription Tiers Strategy

## The Goal

**5-day trial** then paid subscription:
1. **Proves value** - User experiences full product for 5 days
2. **Creates urgency** - Deadline to subscribe
3. **Clean conversion** - Either they pay or they're out

---

## Tier Philosophy

### Trial (5 Days): "The Full Experience"
> Let them fall in love with the product

- Full access to everything
- Create ICPs, see signals, enrich contacts, export
- No frustrating limits during trial
- Capped enrichments (50) to prevent abuse
- Clear countdown: "3 days left in trial"

### Starter Tier (£99/mo): "The Worker"
> Enough for a solo recruiter to run BD

- Can do their job with Signal Mentis
- 100 enrichments/month
- No HubSpot (creates natural Pro upsell)

### Pro Tier (£249/mo): "The Team"
> Full power, team-ready, integrations

- 500 enrichments/month
- 10 ICP profiles
- HubSpot integration
- The "don't think about it" tier

---

## Trial Strategy

### Why 5-Day Trial Works Better Than Free Tier

| Approach | Pros | Cons |
|----------|------|------|
| **Free tier with limits** | Always available to re-engage | Complex to implement, users game the system |
| **5-day trial (chosen)** | Simple, full experience, clear deadline | Must convert within window |

### The Trial User Journey

```
Day 1:
├── Signs up (no credit card required)
├── Creates ICP profile
├── Sees 100+ signals → "Wow this actually works"
├── Enriches 5 contacts → Gets real emails
├── Exports to CSV → Takes to spreadsheet
└── Sends first outreach

Day 3:
├── Banner: "2 days left in your trial"
├── Has enriched ~20 contacts
├── Getting replies to outreach
├── Sees value clearly

Day 5:
├── "Your trial ends today"
├── Must choose: Subscribe or lose access
├── Data is preserved (can reactivate later)

Day 6+ (no subscription):
├── Can log in
├── Sees "Subscribe to continue" screen
├── Can view pricing, choose plan
├── All data still there, just locked
```

### Trial Limits

| Feature | Trial Limit | Reason |
|---------|-------------|--------|
| Duration | 5 days | Long enough to prove value, short enough to create urgency |
| ICP Profiles | 3 | Same as Starter tier |
| Enrichments | 50 total | Enough to test, prevents abuse |
| Everything else | Full access | Let them experience the product |

---

## Starter Tier Deep Dive

### Sweet Spot: £99/month

**What they get:**
- 3 ICP profiles (can cover 3 niches/locations)
- Unlimited signal viewing
- 100 enrichments/month
- CSV export
- Email notifications
- Contract signals
- Batch operations

**What they DON'T get:**
- HubSpot integration (manual workflow)
- High volume enrichment (100/mo = ~3/day)
- More than 3 ICPs

### The Starter User Journey

```
Week 1:
├── Upgrades from free
├── Creates 3 ICP profiles
├── Sees ALL signals → Relief
├── Uses 30 enrichments finding contacts
├── Exports to spreadsheet
└── Starts outreach manually

Week 2-3:
├── Using enrichments regularly
├── Getting meetings from leads
├── Realizes manual CRM entry is painful
└── "I wish this pushed to HubSpot"

Month 2:
├── Hitting 100 enrichment limit
├── "I need more enrichments"
├── Team members want access
└── Considers Pro
```

---

## Pro Tier Deep Dive

### Premium: £249/month

**What they get:**
- 10 ICP profiles (cover all their niches)
- 500 enrichments/month
- HubSpot integration (one-click push)
- Everything in Starter

**Who it's for:**
- Agencies with 5-15 consultants
- People who value time over money
- Teams who need CRM integration

---

## Feature Gating Strategy

### Hard Gates (Can't do at all)
- Enrichment (Free: 0)
- Export (Free: blocked)
- HubSpot (Free + Starter: blocked)
- Creating >1 ICP (Free: blocked)
- Creating >3 ICPs (Starter: blocked)

### Soft Gates (Can do, but limited)
- View signals (Free: 5/day after day 1)
- Contract signals (Free: blurred/teaser)
- Email alerts (Free: none)

### Teaser Gates (Show but lock)
- Contract signals shown with blur + "Pro feature"
- HubSpot button visible but disabled + "Pro feature"
- This creates awareness of what they're missing

---

## Quota Reset Strategy

### Monthly Reset (Enrichments)
- Resets on 1st of each month
- No rollover (use it or lose it)
- Creates urgency at month end
- "You have 12 enrichments left. Resets in 3 days."

### Daily Reset (Free Signal Views)
- New signals unlocked each day
- Old signals lock after 24h
- Keeps free users engaged daily

---

## Upgrade Prompts Strategy

### When to Show Upgrade Prompts

| Trigger | Prompt |
|---------|--------|
| Click "Find Contacts" (Free) | "Unlock contact enrichment from £99/mo" |
| Click "Export" (Free) | "Export your leads from £99/mo" |
| View blurred signal (Free) | "Upgrade to see all signals" |
| Try to create 2nd ICP (Free) | "Upgrade for more ICP profiles" |
| Click HubSpot push (Starter) | "HubSpot integration available on Pro" |
| Hit enrichment limit | "Need more enrichments? Upgrade to Pro" |
| Day 2+ login (Free) | Banner: "You're missing 145 signals" |

### Upgrade Prompt Tone
- Not aggressive, but clear
- Show value: "Agencies on Starter book 4x more meetings"
- Show cost/benefit: "£99/mo = less than 1 placement fee"

---

## Conversion Metrics to Track

1. **Free → Starter conversion rate**
   - Target: 10-15% within 14 days
   - Track: When do they convert? What triggers it?

2. **Starter → Pro conversion rate**
   - Target: 20-30% within 3 months
   - Track: What feature requests precede upgrade?

3. **Feature gate hits**
   - Which gates get hit most?
   - Which gates lead to upgrades?

4. **Time to first upgrade prompt**
   - How quickly do free users hit a wall?
   - Should be within first session

---

## Implementation Priorities

### Phase 1: Core Gating (MVP)
1. Add `pricing_tier` to user settings
2. ICP profile limits
3. Enrichment monthly quotas
4. Export blocking
5. Admin bypass

### Phase 2: Signal Viewing Gates
1. Day 1 vs Day 2+ logic for free users
2. Signal blurring/locking
3. "X signals hidden" messaging

### Phase 3: Upgrade UX
1. Upgrade prompts at gate points
2. Usage displays (enrichments remaining, etc.)
3. Settings page subscription section

### Phase 4: Advanced
1. Contract signal teasing
2. HubSpot gate with teaser
3. Email notification gates

---

## Technical Implementation Notes

### Signal Viewing for Free Users

```typescript
// In signals API route
const tier = await getUserTier(user.id);
const isFirstDay = await isUserFirstDay(user.id);

if (tier === 'free') {
  if (isFirstDay) {
    // Day 1: Return up to 50 signals
    signals = signals.slice(0, 50);
  } else {
    // Day 2+: Return only signals from last 24h, max 5
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    signals = signals
      .filter(s => new Date(s.detected_at) > oneDayAgo)
      .slice(0, 5);
  }

  // Add metadata about hidden signals
  response.hiddenCount = totalSignals - signals.length;
  response.upgradeMessage = `Upgrade to see all ${totalSignals} signals`;
}
```

### Enrichment Quota Tracking

```typescript
// Track per contact found, not per request
async function trackEnrichment(userId: string, contactsFound: number) {
  const month = getCurrentMonth(); // '2024-01'

  await supabase.rpc('increment_enrichment_usage', {
    p_user_id: userId,
    p_month: month,
    p_count: contactsFound
  });
}
```

### Admin Bypass

```typescript
// Start of every gated function
const tier = await getUserTier(user.id);
if (tier === 'admin') {
  // Skip all checks, allow everything
  return { allowed: true, reason: 'admin' };
}
```

---

## Summary Table

| Feature | Trial (5 days) | Starter (£99) | Pro (£249) | Admin |
|---------|----------------|---------------|------------|-------|
| Duration | 5 days | Ongoing | Ongoing | Ongoing |
| ICP Profiles | 3 | 3 | 10 | ∞ |
| View Signals | ∞ | ∞ | ∞ | ∞ |
| Enrichments | 50 (total) | 100/month | 500/month | ∞ |
| Export | ✓ | ✓ | ✓ | ✓ |
| Contract Signals | ✓ | ✓ | ✓ | ✓ |
| Email Notifications | ✓ | ✓ | ✓ | ✓ |
| HubSpot | ✓ | ✗ | ✓ | ✓ |
| Batch Operations | ✓ | ✓ | ✓ | ✓ |
| AI Classification | ✓ | ✓ | ✓ | ✓ |

**After Trial Expires (no subscription):**
- Can log in and see "Subscribe to continue" page
- All data preserved
- No feature access until subscription
