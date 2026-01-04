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

/**
 * Send notification when new companies in pain are found
 * Called after ICP scan or generate-pain-signals cron
 */
export async function sendPainSignalNotification(
  userEmail: string,
  icpName: string,
  newCompaniesCount: number,
  totalSignals: number,
  topCompanies: { name: string; pain_score: number; top_signal: string }[]
): Promise<boolean> {
  try {
    const companyList = topCompanies
      .slice(0, 5)
      .map(c => `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #E5E7EB;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="70%">
                  <div style="font-size: 15px; font-weight: 600; color: #1E3A5F; margin-bottom: 4px;">${c.name}</div>
                  <div style="font-size: 13px; color: #6B7280;">${c.top_signal}</div>
                </td>
                <td width="30%" align="right">
                  <div style="background-color: #E8ECFF; color: #5B6DFF; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                    ${c.pain_score}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `)
      .join('');

    await resend.emails.send({
      from: 'Mentis Signals <signals@mentisdigital.co.uk>',
      to: userEmail,
      subject: `${newCompaniesCount} new companies detected for ${icpName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F0F4F8;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F0F4F8; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(30, 58, 95, 0.08); overflow: hidden;">

                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #1E3A5F 0%, #2D5A8C 100%); padding: 40px 32px; text-align: center;">
                      <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Signal Tracker</h1>
                      <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.85); font-size: 15px; font-weight: 500;">New opportunities for ${icpName}</p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 40px 32px;">

                      <!-- Stats Banner -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                        <tr>
                          <td width="50%" style="background-color: #E8ECFF; padding: 24px; border-radius: 10px 0 0 10px; text-align: center;">
                            <div style="font-size: 40px; font-weight: 700; color: #5B6DFF;">${newCompaniesCount}</div>
                            <div style="font-size: 14px; color: #3B47A6; font-weight: 500; margin-top: 6px;">New Companies</div>
                          </td>
                          <td width="50%" style="background-color: #DBEAFE; padding: 24px; border-radius: 0 10px 10px 0; text-align: center;">
                            <div style="font-size: 40px; font-weight: 700; color: #2563EB;">${totalSignals}</div>
                            <div style="font-size: 14px; color: #1E40AF; font-weight: 500; margin-top: 6px;">Growth Signals</div>
                          </td>
                        </tr>
                      </table>

                      <!-- Top Companies Section -->
                      <h2 style="margin: 0 0 20px 0; color: #1E3A5F; font-size: 20px; font-weight: 700;">Top Companies in Focus</h2>

                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                        ${companyList}
                      </table>

                      <!-- CTA Section -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                        <tr>
                          <td align="center">
                            <a href="${process.env.NEXT_PUBLIC_APP_URL}/pain" style="display: inline-block; background-color: #5B6DFF; color: white; text-align: center; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; box-shadow: 0 2px 6px rgba(91, 109, 255, 0.3);">Explore All Signals</a>
                          </td>
                        </tr>
                      </table>

                      <!-- Subtext -->
                      <p style="margin: 0; color: #6B7280; font-size: 13px; text-align: center;">
                        Track hiring, planning, contracts and more to close deals faster.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #F9FAFB; padding: 24px 32px; border-top: 1px solid #E5E7EB;">
                      <p style="margin: 0 0 12px 0; color: #6B7280; font-size: 13px; text-align: center;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings" style="color: #5B6DFF; text-decoration: none; font-weight: 500;">Manage notification preferences</a>
                      </p>
                      <p style="margin: 0; color: #9CA3AF; font-size: 12px; text-align: center;">
                        &copy; ${new Date().getFullYear()} Signal Tracker by Mentis Digital. All rights reserved.
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
    console.error('Pain signal email error:', error);
    return false;
  }
}

/**
 * Notify ICP owner about NEW companies in pain (only un-notified signals)
 * Marks signals as notified after sending to avoid duplicate emails
 */
export async function notifyICPOwner(
  icpProfileId: string,
  _newSignalsCount?: number // Kept for backward compatibility but not used
): Promise<boolean> {
  const supabase = createAdminClient();

  try {
    // Get ICP profile with owner details
    const { data: icp } = await supabase
      .from('icp_profiles')
      .select('name, user_id')
      .eq('id', icpProfileId)
      .single();

    if (!icp) return false;

    // Get user email from auth.users
    const { data: userData } = await supabase.auth.admin.getUserById(icp.user_id);
    const userEmail = userData?.user?.email;

    if (!userEmail) {
      console.log(`[email] No email for ICP owner ${icp.user_id}`);
      return false;
    }

    // Check user notification preferences
    const { data: settings } = await supabase
      .from('user_settings')
      .select('notify_email')
      .eq('user_id', icp.user_id)
      .single();

    if (settings && settings.notify_email === false) {
      console.log(`[email] User ${icp.user_id} has email notifications disabled`);
      return false;
    }

    // Get ONLY un-notified signals (notified_at IS NULL)
    // First try with notified_at filter, fall back to all active signals if column doesn't exist
    let signals;
    const { data: signalsData, error: signalsError } = await supabase
      .from('company_pain_signals')
      .select(`
        id,
        company_id,
        pain_signal_type,
        signal_title,
        companies!inner(id, name, hiring_pain_score)
      `)
      .eq('icp_profile_id', icpProfileId)
      .eq('is_active', true)
      .is('notified_at', null)
      .order('detected_at', { ascending: false })
      .limit(50);

    if (signalsError) {
      // notified_at column might not exist - try without it
      console.log(`[email] Query with notified_at failed, trying without: ${signalsError.message}`);
      const { data: fallbackSignals, error: fallbackError } = await supabase
        .from('company_pain_signals')
        .select(`
          id,
          company_id,
          pain_signal_type,
          signal_title,
          companies!inner(id, name, hiring_pain_score)
        `)
        .eq('icp_profile_id', icpProfileId)
        .eq('is_active', true)
        .order('detected_at', { ascending: false })
        .limit(50);

      if (fallbackError) {
        console.error(`[email] Fallback query also failed: ${fallbackError.message}`);
        return false;
      }
      signals = fallbackSignals;
      console.log(`[email] Using fallback query - found ${signals?.length || 0} signals`);
    } else {
      signals = signalsData;
    }

    if (!signals || signals.length === 0) {
      console.log(`[email] No signals to notify for ICP ${icpProfileId}`);
      return false;
    }

    console.log(`[email] Found ${signals.length} signals to notify for ICP ${icpProfileId}`);

    // Collect signal IDs to mark as notified
    const signalIds = signals.map(s => s.id);

    // Aggregate by company
    const companyMap = new Map<string, { name: string; pain_score: number; top_signal: string }>();
    for (const signal of signals) {
      const company = signal.companies as unknown as { id: string; name: string; hiring_pain_score: number };
      if (!companyMap.has(company.id)) {
        companyMap.set(company.id, {
          name: company.name,
          pain_score: company.hiring_pain_score || 0,
          top_signal: signal.signal_title,
        });
      }
    }

    const topCompanies = Array.from(companyMap.values())
      .sort((a, b) => b.pain_score - a.pain_score)
      .slice(0, 5);

    // Send the email
    const success = await sendPainSignalNotification(
      userEmail,
      icp.name,
      companyMap.size,
      signals.length,
      topCompanies
    );

    if (success) {
      // Mark these signals as notified
      await supabase
        .from('company_pain_signals')
        .update({ notified_at: new Date().toISOString() })
        .in('id', signalIds);

      console.log(`[email] Sent notification for ${signals.length} NEW signals to ${userEmail} for ICP "${icp.name}"`);
    }

    return success;
  } catch (error) {
    console.error('[email] notifyICPOwner error:', error);
    return false;
  }
}

/**
 * Send styled welcome email to new users
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName?: string
): Promise<boolean> {
  try {
    const displayName = userName || userEmail.split('@')[0];

    await resend.emails.send({
      from: 'Mentis Signals <signals@mentisdigital.co.uk>',
      to: userEmail,
      subject: 'Welcome to Signal Tracker',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F0F4F8;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F0F4F8; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(30, 58, 95, 0.08); overflow: hidden;">

                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #1E3A5F 0%, #2D5A8C 100%); padding: 48px 32px; text-align: center;">
                      <h1 style="margin: 0; color: white; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Signal Tracker</h1>
                      <p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.85); font-size: 16px; font-weight: 500;">Find companies struggling to hire</p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 40px 32px;">
                      <h2 style="margin: 0 0 16px 0; color: #1E3A5F; font-size: 24px; font-weight: 700;">Welcome, ${displayName}!</h2>

                      <p style="margin: 0 0 24px 0; color: #6B7280; font-size: 15px; line-height: 1.6;">
                        You're now ready to discover companies actively struggling with recruitment - perfect opportunities for your business.
                      </p>

                      <!-- Feature Cards -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                        <tr>
                          <td style="background-color: #F8FAFC; padding: 20px; border-radius: 10px; margin-bottom: 12px;">
                            <table cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding-right: 16px; vertical-align: top;">
                                  <div style="width: 40px; height: 40px; background-color: #E8ECFF; border-radius: 8px; text-align: center; line-height: 40px; font-size: 18px;">🎯</div>
                                </td>
                                <td>
                                  <div style="font-size: 15px; font-weight: 600; color: #1E3A5F; margin-bottom: 4px;">Create Your ICP</div>
                                  <div style="font-size: 13px; color: #6B7280;">Define your ideal customer profile with industries, roles, and locations.</div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr><td style="height: 12px;"></td></tr>
                        <tr>
                          <td style="background-color: #F8FAFC; padding: 20px; border-radius: 10px;">
                            <table cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding-right: 16px; vertical-align: top;">
                                  <div style="width: 40px; height: 40px; background-color: #DBEAFE; border-radius: 8px; text-align: center; line-height: 40px; font-size: 18px;">📊</div>
                                </td>
                                <td>
                                  <div style="font-size: 15px; font-weight: 600; color: #1E3A5F; margin-bottom: 4px;">Track Hiring Signals</div>
                                  <div style="font-size: 13px; color: #6B7280;">We monitor job boards and detect re-posts, salary increases, and referral bonuses.</div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr><td style="height: 12px;"></td></tr>
                        <tr>
                          <td style="background-color: #F8FAFC; padding: 20px; border-radius: 10px;">
                            <table cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding-right: 16px; vertical-align: top;">
                                  <div style="width: 40px; height: 40px; background-color: #D1FAE5; border-radius: 8px; text-align: center; line-height: 40px; font-size: 18px;">🔔</div>
                                </td>
                                <td>
                                  <div style="font-size: 15px; font-weight: 600; color: #1E3A5F; margin-bottom: 4px;">Get Notified</div>
                                  <div style="font-size: 13px; color: #6B7280;">Receive email alerts when we find new companies matching your ICP.</div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                        <tr>
                          <td align="center">
                            <a href="${process.env.NEXT_PUBLIC_APP_URL}/icp/new" style="display: inline-block; background-color: #5B6DFF; color: white; text-align: center; padding: 16px 48px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 2px 6px rgba(91, 109, 255, 0.3);">Create Your First ICP</a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 0; color: #9CA3AF; font-size: 13px; text-align: center;">
                        Questions? Reply to this email - we're here to help.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #F9FAFB; padding: 24px 32px; border-top: 1px solid #E5E7EB;">
                      <p style="margin: 0; color: #9CA3AF; font-size: 12px; text-align: center;">
                        &copy; ${new Date().getFullYear()} Signal Tracker by Mentis Digital. All rights reserved.
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

    console.log(`[email] Welcome email sent to ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Welcome email error:', error);
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

        // Mark signals as no longer new to prevent duplicate notifications
        await supabase
          .from('signals')
          .update({ is_new: false })
          .eq('user_id', userId)
          .eq('is_new', true);
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
