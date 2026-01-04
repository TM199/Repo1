// src/lib/ai/provider.ts
import { createAnthropic } from '@ai-sdk/anthropic';

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Use Claude Sonnet for classification (best reasoning for this task)
export const classificationModel = anthropic('claude-sonnet-4-20250514');
