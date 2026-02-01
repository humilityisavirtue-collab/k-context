import { env } from '$env/dynamic/private';

// Send license key via Resend
export async function sendLicenseEmail(
  email: string,
  licenseKey: string
): Promise<boolean> {
  const RESEND_API_KEY = env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - skipping email');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'k-context <noreply@k-context.dev>',
        to: email,
        subject: 'Your k-context Pro License Key',
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #8b5cf6; }
    .license-box { background: #f8f5ff; border: 2px solid #8b5cf6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .license-key { font-family: monospace; font-size: 20px; font-weight: bold; color: #1f2937; letter-spacing: 2px; }
    .instructions { background: #f9fafb; border-radius: 8px; padding: 15px; margin: 20px 0; }
    .command { font-family: monospace; background: #1f2937; color: #10b981; padding: 10px 15px; border-radius: 4px; display: inline-block; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">k-context</div>
      <p>Thank you for purchasing Pro!</p>
    </div>

    <div class="license-box">
      <p style="margin: 0 0 10px 0; color: #6b7280;">Your License Key</p>
      <div class="license-key">${licenseKey}</div>
    </div>

    <div class="instructions">
      <p style="margin: 0 0 10px 0;"><strong>To activate:</strong></p>
      <div class="command">npx k-context activate ${email}</div>
      <p style="margin: 10px 0 0 0; font-size: 14px; color: #6b7280;">
        Then enter your license key when prompted.
      </p>
    </div>

    <p>With Pro, you get:</p>
    <ul>
      <li>Unlimited files per project</li>
      <li>Up to 5 projects</li>
      <li>Cloud sync (coming soon)</li>
      <li>Priority support</li>
    </ul>

    <div class="footer">
      <p>Questions? Reply to this email.</p>
      <p>k-context - AI context for your codebase</p>
    </div>
  </div>
</body>
</html>
        `
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend API error:', error);
      return false;
    }

    console.log(`License email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}
