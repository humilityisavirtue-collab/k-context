import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      customer_email: string;
      customer_details?: {
        email: string;
        name?: string;
      };
      amount_total: number;
      metadata?: Record<string, string>;
      payment_status: string;
      subscription?: string;
    };
  };
}

// Verify Stripe webhook signature
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const crypto = await import('crypto');
    const parts = signature.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
    const v1Signature = parts.find(p => p.startsWith('v1='))?.split('=')[1];

    if (!timestamp || !v1Signature) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return expectedSignature === v1Signature;
  } catch {
    return false;
  }
}

// TODO: Implement Supabase integration for license storage
async function recordLicense(email: string, tier: string, stripeSessionId: string) {
  console.log(`Recording license: ${email}, tier: ${tier}, session: ${stripeSessionId}`);
  // Will implement Supabase storage later
  return true;
}

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');
  const STRIPE_WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !STRIPE_WEBHOOK_SECRET) {
    return json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  // Verify signature
  const isValid = await verifyStripeSignature(payload, signature, STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    console.error('Invalid Stripe signature');
    return json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event: StripeEvent = JSON.parse(payload);

  // Handle checkout completion
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    if (session.payment_status === 'paid') {
      const email = session.customer_details?.email || session.customer_email;

      if (email) {
        console.log(`Processing Pro purchase for ${email}`);
        await recordLicense(email, 'pro', session.id);
      }
    }
  }

  // Handle subscription cancellation
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    console.log(`Subscription cancelled: ${subscription.id}`);
    // TODO: Revoke license
  }

  return json({ received: true });
};
