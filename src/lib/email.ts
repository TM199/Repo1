import { Resend } from 'resend';
import { createAdminClient } from './supabase/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSignalDigest(
  email: string,
  signalCount: number,
  signalsByType: Record<string, number>,
  topSignals: { company_name: string; signal_title: string; signal_type: string }[]
): Promise<boolean> {
  try {
    const signalTypeBreakdown = Object.entries(signalsByType)
      .map(([type, count]) => {
        const typeLabel = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `
          <tr>
            <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">${typeLabel}</td>
            <td style="padding: 8px 0; color: #0A2540; font-size: 14px; font-weight: 600; text-align: right;">${count}</td>
          </tr>
        `;
      })
      .join('');

    const topSignalsList = topSignals
      .slice(0, 5)
      .map(s => {
        const typeLabel = s.signal_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB;">
              <div style="font-size: 14px; font-weight: 600; color: #0A2540; margin-bottom: 4px;">${s.company_name || 'Unknown Company'}</div>
              <div style="font-size: 13px; color: #6B7280;">${s.signal_title || 'No title'}</div>
              <div style="font-size: 12px; color: #635BFF; margin-top: 4px;">${typeLabel}</div>
            </td>
          </tr>
        `;
      })
      .join('');

    await resend.emails.send({
      from: 'Mentis Signals <signals@mentisdigital.co.uk>',
      to: email,
      subject: `${signalCount} new signals detected`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9FAFB;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #635BFF 0%, #4F46E5 100%); padding: 40px 32px; text-align: center;">
                      <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Signal Tracker</h1>
                      <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">by Mentis Digital</p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 32px;">
                      <!-- Signal Count Banner -->
                      <div style="background-color: #F0EDFF; border-left: 4px solid #635BFF; padding: 20px; border-radius: 6px; margin-bottom: 32px;">
                        <div style="font-size: 36px; font-weight: 700; color: #0A2540; margin-bottom: 4px;">${signalCount}</div>
                        <div style="font-size: 16px; color: #6B7280;">New signals detected</div>
                      </div>

                      <!-- Signal Type Breakdown -->
                      <h2 style="margin: 0 0 16px 0; color: #0A2540; font-size: 18px; font-weight: 600;">Signal Breakdown</h2>
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                        ${signalTypeBreakdown}
                      </table>

                      <!-- Top Signals -->
                      <h2 style="margin: 0 0 16px 0; color: #0A2540; font-size: 18px; font-weight: 600;">Top Signals</h2>
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                        ${topSignalsList}
                      </table>

                      <!-- Action Buttons -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                        <tr>
                          <td style="padding: 0 8px 0 0;" width="50%">
                            <a href="${process.env.NEXT_PUBLIC_APP_URL}/signals" style="display: block; background-color: #635BFF; color: white; text-align: center; padding: 14px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">View Signals</a>
                          </td>
                          <td style="padding: 0 0 0 8px;" width="50%">
                            <a href="${process.env.NEXT_PUBLIC_APP_URL}/signals?export=csv" style="display: block; background-color: white; color: #635BFF; text-align: center; padding: 14px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; border: 2px solid #635BFF;">Download CSV</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #F9FAFB; padding: 24px 32px; border-top: 1px solid #E5E7EB;">
                      <p style="margin: 0 0 12px 0; color: #6B7280; font-size: 13px; text-align: center;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings" style="color: #635BFF; text-decoration: none;">Manage notification preferences</a>
                      </p>
                      <p style="margin: 0; color: #9CA3AF; font-size: 12px; text-align: center;">
                        &copy; ${new Date().getFullYear()} Mentis Digital. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export async function sendSignalNotifications(
  frequency: 'daily' | 'weekly' | 'monthly'
): Promise<{ sent: number; failed: number }> {
  const supabase = createAdminClient();

  let sent = 0;
  let failed = 0;

  // Query user_settings for users with matching frequency and notify_email: true
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('user_id, profiles!inner(email)')
    .eq('notify_email', true)
    .eq('email_frequency', frequency);

  if (!userSettings || userSettings.length === 0) {
    console.log(`No users found with ${frequency} email notifications enabled`);
    return { sent: 0, failed: 0 };
  }

  // Process each user
  for (const setting of userSettings) {
    try {
      const userId = setting.user_id;
      const userEmail = (setting.profiles as any)?.email;

      if (!userEmail) {
        console.error(`No email found for user ${userId}`);
        failed++;
        continue;
      }

      // Get count of new signals (is_new: true)
      const { data: newSignals, count } = await supabase
        .from('signals')
        .select('signal_type, company_name, signal_title', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_new', true);

      // Skip if no new signals
      if (!count || count === 0) {
        console.log(`No new signals for user ${userId}`);
        continue;
      }

      // Calculate signal breakdown by type
      const signalsByType: Record<string, number> = {};
      if (newSignals) {
        newSignals.forEach(signal => {
          const type = signal.signal_type || 'unknown';
          signalsByType[type] = (signalsByType[type] || 0) + 1;
        });
      }

      // Get top signals (first 5)
      const topSignals = (newSignals || []).slice(0, 5).map(s => ({
        company_name: s.company_name || 'Unknown Company',
        signal_title: s.signal_title || 'No title',
        signal_type: s.signal_type || 'unknown',
      }));

      // Send email
      const success = await sendSignalDigest(
        userEmail,
        count,
        signalsByType,
        topSignals
      );

      if (success) {
        sent++;
        console.log(`Sent ${frequency} digest to ${userEmail} (${count} signals)`);
      } else {
        failed++;
        console.error(`Failed to send ${frequency} digest to ${userEmail}`);
      }

      // Small delay between emails
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error processing user ${setting.user_id}:`, error);
      failed++;
    }
  }

  return { sent, failed };
}
