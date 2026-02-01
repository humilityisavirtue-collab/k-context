-- K-Context licenses table
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'pro',
  license_key TEXT UNIQUE NOT NULL,
  stripe_session_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, cancelled, expired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- NULL = never expires
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);

-- Index for license key verification
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);

-- Index for Stripe subscription tracking
CREATE INDEX IF NOT EXISTS idx_licenses_stripe_sub ON licenses(stripe_subscription_id);

-- Row-level security
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access" ON licenses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
