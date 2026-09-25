const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const pool = require('../db');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Helper to get active transporter or config
const getTransporter = async () => {
    // 1. Try DB config first
    try {
        const result = await pool.query(
            "SELECT config_value FROM system_configs WHERE config_key = 'smtp_config'"
        );
        if (result.rows.length > 0 && result.rows[0].config_value) {
            const cfg = result.rows[0].config_value;
            const host = cfg.host || cfg.smtp_host;
            const user = cfg.user || cfg.username || cfg.smtp_user;
            const pass = cfg.pass || cfg.password || cfg.smtp_pass;
            if (host && user && pass) {
                return nodemailer.createTransport({
                    host,
                    port: Number(cfg.port || cfg.smtp_port || 587),
                    secure: Boolean(cfg.secure === true || cfg.smtp_secure === true),
                    auth: { user, pass }
                });
            }
        }
    } catch (err) {
        console.warn('Could not read DB smtp_config, using env vars:', err.message);
    }

    // 2. Try env vars
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true';

    if (user && pass) {
        return nodemailer.createTransport({
            host,
            port,
            secure,
            auth: { user, pass }
        });
    }

    return null;
};

/**
 * Send Facility Invitation Email to new Caregiver or Medical Staff
 */
const sendFacilityInvitationEmail = async ({ to, facilityName, role, token, expiresAt }) => {
    const roleLabel = role === 'medical_staff' ? 'Medical Staff' : 'Caregiver';
    const formattedExpiry = expiresAt 
        ? new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '7 days';

    const subject = `Invitation: Join ${facilityName} on Alaga Healthcare`;
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@alagamonitoringsystem.me';

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Facility Invitation</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="560px" style="max-width: 560px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #E2E8F0;" cellpadding="0" cellspacing="0">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0F766E 0%, #0D9488 100%); padding: 32px 28px; text-align: center;">
                  <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">ALAGA</h1>
                  <p style="color: #CCFBF1; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">Smart Healthcare Monitoring System</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 32px 28px;">
                  <h2 style="font-size: 18px; font-weight: 700; color: #0F172A; margin: 0 0 12px 0;">
                    You're invited to join <span style="color: #0D9488;">${facilityName}</span>
                  </h2>
                  <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                    The facility administrator of <strong>${facilityName}</strong> has invited you to register on the <strong>Alaga</strong> platform as a <strong>${roleLabel}</strong>.
                  </p>

                  <!-- Token Box -->
                  <div style="background-color: #F0FDFA; border: 2px dashed #0D9488; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0F766E; letter-spacing: 1px; display: block; margin-bottom: 8px;">
                      Your Facility Affiliation Token
                    </span>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: 800; letter-spacing: 4px; color: #115E59; margin-bottom: 8px; user-select: all;">
                      ${token}
                    </div>
                    <span style="font-size: 11px; color: #64748B;">
                      Designated Role: <strong style="color: #0F766E;">${roleLabel}</strong> &bull; Valid until: ${formattedExpiry}
                    </span>
                  </div>

                  <!-- Instructions -->
                  <h3 style="font-size: 14px; font-weight: 700; color: #0F172A; margin: 0 0 10px 0;">
                    How to activate your facility account:
                  </h3>
                  <ol style="font-size: 13px; line-height: 1.7; color: #475569; margin: 0 0 24px 0; padding-left: 20px;">
                    <li>Open the <strong>Alaga</strong> Web App or Mobile App.</li>
                    <li>Go to <strong>Sign Up</strong> and select <strong>${roleLabel}</strong>.</li>
                    <li>When asked <em>"Are you affiliated with a facility?"</em>, choose <strong>Yes</strong>.</li>
                    <li>Enter your invitation token: <code style="background-color: #E2E8F0; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #0F766E;">${token}</code>.</li>
                    <li>Complete your account details to be immediately linked to <strong>${facilityName}</strong>.</li>
                  </ol>

                  <p style="font-size: 12px; line-height: 1.5; color: #94A3B8; margin: 0;">
                    If you were not expecting this invitation, you can safely ignore this email.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 18px 28px; text-align: center;">
                  <p style="font-size: 11px; color: #94A3B8; margin: 0;">
                    Alaga Healthcare &bull; Secure Caregiver & Patient Monitoring
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    try {
        // Try Resend first if available
        if (resend) {
            try {
                // Resend requires verified domain or 'onboarding@resend.dev' for sandbox.
                // Gmail addresses are strictly rejected by Resend.
                let resendFrom = process.env.RESEND_FROM;
                if (!resendFrom || resendFrom.includes('@gmail.com')) {
                    resendFrom = 'Alaga Healthcare <onboarding@resend.dev>';
                }

                const resendResult = await resend.emails.send({
                    from: resendFrom,
                    to: [to],
                    subject,
                    html: htmlContent
                });

                if (resendResult && resendResult.error) {
                    console.warn('[EmailService] Resend returned error:', resendResult.error);
                    throw new Error(resendResult.error.message || JSON.stringify(resendResult.error));
                }

                console.log(`[EmailService] Invitation email sent successfully via Resend to ${to}:`, resendResult);
                return { success: true, method: 'resend', result: resendResult };
            } catch (resendErr) {
                console.warn('[EmailService] Resend failed, trying Nodemailer fallback:', resendErr.message);
                // If it's a domain restriction on Resend sandbox, preserve the hint
                var resendFailureMsg = resendErr.message;
            }
        }

        // Try Nodemailer
        const transporter = await getTransporter();
        if (transporter) {
            try {
                const mailInfo = await transporter.sendMail({
                    from: `"Alaga Healthcare" <${fromAddress}>`,
                    to,
                    subject,
                    html: htmlContent,
                    text: `You have been invited to join ${facilityName} on Alaga as a ${roleLabel}.\nYour Invitation Token: ${token}\nEnter this token during sign-up to join your facility.`
                });
                console.log(`[EmailService] Invitation email sent via Nodemailer to ${to}:`, mailInfo.messageId);
                return { success: true, method: 'nodemailer', result: mailInfo };
            } catch (smtpErr) {
                console.warn('[EmailService] Nodemailer SMTP failed:', smtpErr.message);
            }
        }

        console.warn(`[EmailService] No active transport delivered the email to ${to}. Token: ${token}`);
        throw new Error(resendFailureMsg || 'Email delivery failed. Please check SMTP/Resend credentials or provide token directly.');
    } catch (err) {
        console.error(`[EmailService] Error sending invitation email to ${to}:`, err.message);
        throw err;
    }
};

module.exports = {
    getTransporter,
    sendFacilityInvitationEmail
};
