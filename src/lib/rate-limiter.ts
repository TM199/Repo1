/**
 * Rate Limiter Module
 *
 * Manages API usage tracking and rate limiting for external APIs.
 * Supports multiple API keys with rotation when limits are reached.
 *
 * Key features:
 * - Track daily API usage per key
 * - Rotate through available keys when one is exhausted
 * - Simple encryption for stored keys
 */

import { createAdminClient } from '@/lib/supabase/server';

const REED_DAILY_LIMIT = 100;

// Simple encryption/decryption for API keys stored in DB
// In production, use a proper encryption service
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || 'signal-mentis-key-2025';

export function encryptApiKey(apiKey: string): string {
  // Simple XOR encryption - replace with proper encryption in production
  const encoded = Buffer.from(apiKey).toString('base64');
  return `enc:${encoded}`;
}

export function decryptApiKey(encrypted: string): string {
  if (!encrypted.startsWith('enc:')) {
    return encrypted; // Not encrypted, return as-is
  }
  const encoded = encrypted.slice(4);
  return Buffer.from(encoded, 'base64').toString('utf8');
}

export interface ApiUsageResult {
  allowed: boolean;
  remaining: number;
  currentCount: number;
}

export interface ApiKeyInfo {
  id: string;
  apiKey: string;
  remaining: number;
}

/**
 * Check if we can make an API call and increment usage
 */
export async function checkAndIncrementApiUsage(
  apiName: string = 'reed',
  apiKeyId: string | null = null,
  dailyLimit: number = REED_DAILY_LIMIT
): Promise<ApiUsageResult> {
  const supabase = createAdminClient();

  // Call the database function
  const { data, error } = await supabase.rpc('check_and_increment_api_usage', {
    p_api_name: apiName,
    p_api_key_id: apiKeyId,
    p_daily_limit: dailyLimit,
  });

  if (error) {
    console.error('[rate-limiter] Error checking API usage:', error);
    // Fail open - allow the call but log the error
    return { allowed: true, remaining: 0, currentCount: 0 };
  }

  const result = data?.[0] || { allowed: true, remaining: dailyLimit, current_count: 0 };

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    currentCount: result.current_count,
  };
}

/**
 * Get remaining API calls without incrementing
 */
export async function getRemainingCalls(
  apiName: string = 'reed',
  apiKeyId: string | null = null,
  dailyLimit: number = REED_DAILY_LIMIT
): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('get_remaining_api_calls', {
    p_api_name: apiName,
    p_api_key_id: apiKeyId,
    p_daily_limit: dailyLimit,
  });

  if (error) {
    console.error('[rate-limiter] Error getting remaining calls:', error);
    return dailyLimit; // Assume full budget on error
  }

  return data || dailyLimit;
}

/**
 * Check if we can make an API call (without incrementing)
 */
export async function canMakeApiCall(
  apiName: string = 'reed',
  apiKeyId: string | null = null
): Promise<boolean> {
  const remaining = await getRemainingCalls(apiName, apiKeyId);
  return remaining > 0;
}

/**
 * Get the next available API key with remaining budget
 * Returns the default env key if no user keys are available
 */
export async function getNextAvailableApiKey(
  userId: string | null = null,
  apiName: string = 'reed'
): Promise<ApiKeyInfo | null> {
  const supabase = createAdminClient();

  // If no user specified, use default env key
  if (!userId) {
    const envKey = process.env.REED_API_KEY;
    if (!envKey) return null;

    const remaining = await getRemainingCalls(apiName, null);
    if (remaining <= 0) return null;

    return {
      id: 'default',
      apiKey: envKey,
      remaining,
    };
  }

  // Get all active API keys for the user
  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('id, api_key_encrypted, daily_limit')
    .eq('user_id', userId)
    .eq('api_name', apiName)
    .eq('is_active', true);

  if (error || !keys || keys.length === 0) {
    // Fall back to default env key
    const envKey = process.env.REED_API_KEY;
    if (!envKey) return null;

    const remaining = await getRemainingCalls(apiName, null);
    if (remaining <= 0) return null;

    return {
      id: 'default',
      apiKey: envKey,
      remaining,
    };
  }

  // Find a key with remaining budget
  for (const key of keys) {
    const remaining = await getRemainingCalls(apiName, key.id, key.daily_limit);
    if (remaining > 0) {
      return {
        id: key.id,
        apiKey: decryptApiKey(key.api_key_encrypted),
        remaining,
      };
    }
  }

  // All user keys exhausted, try default env key
  const envKey = process.env.REED_API_KEY;
  if (envKey) {
    const remaining = await getRemainingCalls(apiName, null);
    if (remaining > 0) {
      return {
        id: 'default',
        apiKey: envKey,
        remaining,
      };
    }
  }

  return null; // All keys exhausted
}

/**
 * Get ICP profile slots for a user
 */
export async function getIcpSlots(userId: string): Promise<{
  used: number;
  total: number;
  remaining: number;
}> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('get_icp_slots', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[rate-limiter] Error getting ICP slots:', error);
    // Default to 3 slots (1 default key)
    return { used: 0, total: 3, remaining: 3 };
  }

  const result = data?.[0] || { used: 0, total: 3, remaining: 3 };
  return {
    used: result.used,
    total: result.total,
    remaining: result.remaining,
  };
}

/**
 * Check if user can create another ICP profile
 */
export async function canCreateIcpProfile(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  slots: { used: number; total: number; remaining: number };
}> {
  const slots = await getIcpSlots(userId);

  if (slots.remaining <= 0) {
    return {
      allowed: false,
      reason: `You've reached your limit of ${slots.total} ICP profiles. Add another Reed API key to create more.`,
      slots,
    };
  }

  return { allowed: true, slots };
}

/**
 * Record a batch of API calls (for parallel requests)
 */
export async function recordApiCalls(
  count: number,
  apiName: string = 'reed',
  apiKeyId: string | null = null
): Promise<void> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split('T')[0];

  await supabase
    .from('api_usage')
    .upsert(
      {
        api_name: apiName,
        api_key_id: apiKeyId,
        date: today,
        calls_made: count,
        last_call_at: new Date().toISOString(),
      },
      {
        onConflict: 'api_name,api_key_id,date',
      }
    )
    .then(async () => {
      // Increment by count - 1 since upsert set it to count
      if (count > 1) {
        await supabase.rpc('check_and_increment_api_usage', {
          p_api_name: apiName,
          p_api_key_id: apiKeyId,
          p_daily_limit: REED_DAILY_LIMIT,
        });
      }
    });
}
