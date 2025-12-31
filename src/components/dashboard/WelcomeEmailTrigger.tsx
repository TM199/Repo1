'use client';

import { useEffect, useRef } from 'react';

/**
 * Invisible component that triggers welcome email for new users.
 * Only runs once per session and skips if already sent.
 */
export function WelcomeEmailTrigger() {
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;

    // Trigger welcome email (endpoint handles deduplication)
    fetch('/api/auth/welcome', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success && !data.skipped) {
          console.log('[Welcome] Email sent to new user');
        }
      })
      .catch(err => {
        console.error('[Welcome] Failed to trigger email:', err);
      });
  }, []);

  return null;
}
