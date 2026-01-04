# Agency Analyzer Implementation Plan

## Overview
Create a new module that uses Firecrawl to analyze recruitment agency websites and extract structured information about their specializations, role types, and focus areas.

## Implementation Steps

### 1. Define TypeScript Types
- [ ] Add `AgencyAnalysis` interface to `/Users/trisdenmills/signal-mentis/src/types/index.ts`
  - industries: string[]
  - roleTypes: string[]
  - focus: ("permanent" | "contract" | "temp" | "mixed")[]
  - confidence: number (0-100)
  - summary: string

### 2. Create Agency Analyzer Module
- [ ] Create new file `/Users/trisdenmills/signal-mentis/src/lib/agency-analyzer.ts`
  - Import Firecrawl SDK (pattern from firecrawl.ts)
  - Define extraction prompt for agency analysis
  - Define JSON schema for structured extraction
  - Implement `analyzeAgencyWebsite(domain: string)` function
  - Return structured AgencyAnalysis with error handling

### 3. Implementation Details
- Use same Firecrawl client pattern (`getFirecrawlClient()`)
- Use Firecrawl's `scrape()` method with JSON format extraction
- Extraction prompt should focus on:
  - Industries mentioned (Technology, Healthcare, etc.)
  - Job roles/types they recruit (Software Engineers, etc.)
  - Permanent vs contract vs temp focus
  - Calculate confidence score based on clarity of information
  - Generate brief summary
- Handle errors gracefully (return null analysis with error message)

## Key Patterns to Follow
- Mirror structure of `scrapeAndExtract()` from firecrawl.ts
- Use same error handling pattern
- Use JSON schema for structured extraction
- Keep code simple and minimal
- Only import what's needed

## Review
_To be completed after implementation_
