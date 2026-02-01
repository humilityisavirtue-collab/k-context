import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyLicense, getLicenseByEmail } from '$lib/supabase';

export const prerender = false;

// Verify license by key
export const GET: RequestHandler = async ({ url }) => {
  const licenseKey = url.searchParams.get('key');
  const email = url.searchParams.get('email');

  if (!licenseKey && !email) {
    return json({ valid: false, error: 'Missing key or email parameter' }, { status: 400 });
  }

  try {
    let license = null;

    if (licenseKey) {
      license = await verifyLicense(licenseKey);
    } else if (email) {
      license = await getLicenseByEmail(email);
    }

    if (!license) {
      return json({ valid: false });
    }

    return json({
      valid: true,
      tier: license.tier,
      email: license.email,
      status: license.status,
      createdAt: license.created_at
    });
  } catch (error) {
    console.error('License verification error:', error);
    return json({ valid: false, error: 'Verification failed' }, { status: 500 });
  }
};

// POST for activation (validates key and returns license info)
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { licenseKey, email } = await request.json();

    if (!licenseKey) {
      return json({ success: false, error: 'Missing license key' }, { status: 400 });
    }

    const license = await verifyLicense(licenseKey);

    if (!license) {
      return json({ success: false, error: 'Invalid or expired license key' });
    }

    // Optional: verify email matches
    if (email && license.email.toLowerCase() !== email.toLowerCase()) {
      return json({ success: false, error: 'Email does not match license' });
    }

    return json({
      success: true,
      tier: license.tier,
      email: license.email,
      expiresAt: license.expires_at
    });
  } catch (error) {
    console.error('Activation error:', error);
    return json({ success: false, error: 'Activation failed' }, { status: 500 });
  }
};
