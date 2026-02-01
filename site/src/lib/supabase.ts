import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

// Server-side client with service role (for webhooks)
export function getServiceClient() {
  const url = publicEnv.PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Generate a license key
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoiding ambiguous chars
  const segments = 4;
  const segmentLength = 4;

  const parts: string[] = [];
  for (let i = 0; i < segments; i++) {
    let segment = '';
    for (let j = 0; j < segmentLength; j++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    parts.push(segment);
  }

  return `KC-${parts.join('-')}`; // e.g., KC-ABCD-1234-EFGH-5678
}

export interface License {
  id: string;
  email: string;
  tier: string;
  license_key: string;
  stripe_session_id: string | null;
  stripe_subscription_id: string | null;
  status: 'active' | 'cancelled' | 'expired';
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

// Create a new license
export async function createLicense(
  email: string,
  stripeSessionId: string,
  stripeSubscriptionId?: string
): Promise<License | null> {
  const client = getServiceClient();
  const licenseKey = generateLicenseKey();

  const { data, error } = await client
    .from('licenses')
    .insert({
      email,
      tier: 'pro',
      license_key: licenseKey,
      stripe_session_id: stripeSessionId,
      stripe_subscription_id: stripeSubscriptionId || null,
      status: 'active'
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create license:', error);
    return null;
  }

  return data;
}

// Verify a license key
export async function verifyLicense(licenseKey: string): Promise<License | null> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('licenses')
    .select()
    .eq('license_key', licenseKey)
    .eq('status', 'active')
    .single();

  if (error || !data) {
    return null;
  }

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  return data;
}

// Get license by email
export async function getLicenseByEmail(email: string): Promise<License | null> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('licenses')
    .select()
    .eq('email', email)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

// Cancel license by subscription ID
export async function cancelLicenseBySubscription(subscriptionId: string): Promise<boolean> {
  const client = getServiceClient();

  const { error } = await client
    .from('licenses')
    .update({ status: 'cancelled' })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    console.error('Failed to cancel license:', error);
    return false;
  }

  return true;
}
