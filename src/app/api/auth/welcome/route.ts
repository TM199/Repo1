/**
 * Welcome Email API
 *
 * Sends a styled welcome email to new users.
 * Called after user completes signup/email verification.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST() {
  try {
    const supabase = await createClient();

    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { success: false, error: 'No email found' },
        { status: 400 }
      );
    }

    // Check if welcome email was already sent (using user metadata)
    if (user.user_metadata?.welcome_email_sent) {
      return NextResponse.json({
        success: true,
        message: 'Welcome email already sent',
        skipped: true,
      });
    }

    // Send welcome email
    const userName = user.user_metadata?.full_name || user.user_metadata?.name;
    const success = await sendWelcomeEmail(user.email, userName);

    if (success) {
      // Mark welcome email as sent in user metadata
      await supabase.auth.updateUser({
        data: { welcome_email_sent: true },
      });

      return NextResponse.json({
        success: true,
        message: 'Welcome email sent',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to send email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Welcome API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
