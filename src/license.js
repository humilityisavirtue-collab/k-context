import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.k-context');
const LICENSE_FILE = join(CONFIG_DIR, 'license.json');
const VERIFY_URL = 'https://k-context.vercel.app/api/verify';

// Free tier limits
const FREE_LIMITS = {
  maxFiles: 100,
  maxProjects: 1,
};

// Pro tier limits
const PRO_LIMITS = {
  maxFiles: Infinity,
  maxProjects: 5,
};

/**
 * Get current license info
 */
export function getLicense() {
  if (!existsSync(LICENSE_FILE)) {
    return { tier: 'free', email: null };
  }

  try {
    const data = JSON.parse(readFileSync(LICENSE_FILE, 'utf8'));
    return {
      tier: data.tier || 'free',
      email: data.email || null,
      licenseKey: data.licenseKey || null,
      activatedAt: data.activatedAt || null,
      verifiedAt: data.verifiedAt || null,
    };
  } catch {
    return { tier: 'free', email: null };
  }
}

/**
 * Get limits for current license
 */
export function getLimits() {
  const license = getLicense();
  return license.tier === 'pro' ? PRO_LIMITS : FREE_LIMITS;
}

/**
 * Check if a scan is within limits
 */
export function checkLimits(fileCount) {
  const limits = getLimits();

  if (fileCount > limits.maxFiles) {
    return {
      allowed: false,
      reason: `Free tier limited to ${limits.maxFiles} files. Upgrade to Pro for unlimited files.`,
      currentCount: fileCount,
      maxCount: limits.maxFiles,
    };
  }

  return {
    allowed: true,
    currentCount: fileCount,
    maxCount: limits.maxFiles,
  };
}

/**
 * Verify license key against server
 */
export async function verifyLicenseKey(licenseKey, email) {
  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, email })
    });

    if (!response.ok) {
      return { valid: false, error: 'Server error' };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    // Offline fallback: trust local license if recently verified
    const license = getLicense();
    if (license.tier === 'pro' && license.verifiedAt) {
      const lastVerified = new Date(license.verifiedAt);
      const daysSinceVerified = (Date.now() - lastVerified.getTime()) / (1000 * 60 * 60 * 24);

      // Trust local license for up to 7 days offline
      if (daysSinceVerified < 7) {
        return { success: true, tier: 'pro', offline: true };
      }
    }

    return { valid: false, error: 'Could not verify license (offline?)' };
  }
}

/**
 * Activate a Pro license
 */
export async function activateLicense(email, licenseKey) {
  // Verify with server
  const verification = await verifyLicenseKey(licenseKey, email);

  if (!verification.success) {
    throw new Error(verification.error || 'Invalid license key');
  }

  // Store locally
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const license = {
    tier: 'pro',
    email: verification.email || email,
    licenseKey,
    activatedAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
  };

  writeFileSync(LICENSE_FILE, JSON.stringify(license, null, 2));
  return license;
}

/**
 * Re-verify existing license (call periodically)
 */
export async function refreshLicense() {
  const license = getLicense();

  if (license.tier !== 'pro' || !license.licenseKey) {
    return false;
  }

  const verification = await verifyLicenseKey(license.licenseKey, license.email);

  if (verification.success) {
    // Update verified timestamp
    const updated = {
      ...license,
      verifiedAt: new Date().toISOString(),
    };
    writeFileSync(LICENSE_FILE, JSON.stringify(updated, null, 2));
    return true;
  }

  return false;
}

/**
 * Deactivate license (revert to free)
 */
export function deactivateLicense() {
  if (existsSync(LICENSE_FILE)) {
    writeFileSync(LICENSE_FILE, JSON.stringify({ tier: 'free' }, null, 2));
  }
}
