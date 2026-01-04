# Pricing Page Build

## Overview
Build a pricing page for Signal Mentis at `/app/(marketing)/pricing/page.tsx` with tier cards, annual/monthly toggle, feature comparison, and FAQ section.

## Tasks

### 1. Create Route Structure
- [ ] Create `src/app/(marketing)/layout.tsx` - Marketing layout with nav/footer
- [ ] Create `src/app/(marketing)/pricing/page.tsx` - Main pricing page

### 2. Create Tier Configuration
- [ ] Create `src/lib/subscription/tiers.ts` - Centralized tier data (prices, features)

### 3. Build Pricing Page Components
- [ ] Hero section with headline and billing toggle (monthly/annual)
- [ ] Pricing cards grid (Starter, Growth, Scale, Enterprise)
- [ ] "Growth" card highlighted as "Most Popular"
- [ ] Feature comparison table
- [ ] FAQ accordion section

### 4. Styling & Polish
- [ ] Match existing brand colors (gradient-mesh background, card-premium style)
- [ ] Responsive design (mobile-first with md/lg breakpoints)
- [ ] Hover effects on cards and buttons

### 5. Verification
- [ ] Run `npm run build` and fix any errors
- [ ] Visual check in browser

## Design Decisions
- Use existing `card`, `button`, `badge` components from shadcn/ui
- Toggle is client-side state for monthly/annual switch
- Primary color (#635BFF) for CTAs and "Most Popular" badge
- Trial banner above pricing cards

## Review

### Files Created
1. **src/lib/subscription/tiers.ts** - Centralized pricing tier configuration with:
   - `PRICING_TIERS` array (Starter £149, Growth £299, Scale £499, Enterprise Custom)
   - `FEATURE_LABELS` with tooltips for feature comparison table
   - `FAQ_ITEMS` for the FAQ accordion

2. **src/app/(marketing)/layout.tsx** - Marketing layout with shared nav/footer

3. **src/app/(marketing)/pricing/page.tsx** - Full pricing page with:
   - Hero section with trial banner
   - Monthly/Annual billing toggle (20% annual discount)
   - 4 pricing cards (Growth highlighted as "Most Popular")
   - Feature comparison table
   - FAQ accordion
   - CTA section

### Design Decisions
- Used existing brand colors (#635BFF primary, gradient-mesh background)
- Client-side toggle for billing period (minimal JS)
- "Growth" tier scaled 105% with purple border/shadow to highlight
- Mobile-responsive grid (1 col → 2 cols → 4 cols)

### Build Status
- Build: Passed
- Route: `/pricing` (static page)

---

# Phase 3: Component Refactoring

## Overview
Break down large components and convert hardcoded colors to CSS variables.

## Color Mapping Reference
| Hardcoded | CSS Variable Class |
|-----------|-------------------|
| `text-[#0A2540]` | `text-foreground` |
| `bg-[#F6F9FC]` | `bg-background` |
| `bg-[#635BFF]` | `bg-primary` |
| `border-[#E3E8EE]` | `border-border` |
| `text-[#6B7C93]` | `text-muted-foreground` |
| `text-[#425466]` | `text-secondary-foreground` |
| `bg-[#F0F3F7]` | `bg-muted` |
| `hover:bg-[#5851DF]` | `hover:bg-primary/90` |

## Tasks

### 3.1 CompaniesInPainDashboard Refactoring
- [ ] Create `CompanyCard.tsx` - Extract single company card
- [ ] Create `CompanyFilters.tsx` - Extract ICP selector + signal tabs + filters
- [ ] Create `CompanySignalList.tsx` - Extract pain signals display
- [ ] Update `CompaniesInPainDashboard.tsx` to import and use new components

### 3.2 SignalCard Refactoring
- [ ] Create `SignalCardHeader.tsx` - Extract badges, company name, domain
- [ ] Create `SignalEnrichmentDialog.tsx` - Extract role picker and enrichment progress
- [ ] Create `ContactsList.tsx` - Extract contacts display section
- [ ] Update `SignalCard.tsx` to import and use new components

### 3.3 Color Conversions
- [ ] Convert colors in CompaniesInPainDashboard and child components
- [ ] Convert colors in SignalCard and child components

### 3.4 Verification
- [ ] Run `npm run build` and fix any errors
- [ ] Visual check in browser

## Review
(To be filled after completion)

---

# Phase 5: Polish & Empty States (COMPLETED)

## Summary
Added reusable UI components and micro-interactions for a polished user experience.

## Completed Tasks

### 5.1 Empty State Component
- Created `src/components/ui/empty-state.tsx`
- Reusable component with icon, title, description, and optional action button
- Uses CSS variable classes for dark mode support

### 5.2 Skeleton Presets
- Updated `src/components/ui/skeleton.tsx` with:
  - `SignalCardSkeleton` - Loading state for signal cards
  - `CompanyCardSkeleton` - Loading state for company cards
  - `StatsCardSkeleton` - Loading state for dashboard stats

### 5.3 Micro-interactions (globals.css)
- `.btn-interactive` - Button hover lift and press scale
- `.card-interactive` - Card hover lift with shadow
- `.theme-icon` - Rotation animation for theme toggle
- `.sidebar-transition` - Smooth width transitions
- `.sidebar-content-fade` - Text fade on collapse
- `.icon-btn-interactive` - Icon button scale effects

### 5.4 Component Updates
- **Sidebar.tsx**: Added `btn-interactive` and `icon-btn-interactive` classes
- **Navbar.tsx**: Added `icon-btn-interactive` to all icon buttons

## Deployment
- Build: Successful
- Production URL: https://signal-mentis.vercel.app
