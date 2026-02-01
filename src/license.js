import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.k-context');
const LICENSE_FILE = join(CONFIG_DIR, 'license.json');

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
      activatedAt: data.activatedAt || null,
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
 * Activate a Pro license
 */
export function activateLicense(email, licenseKey) {
  // TODO: Verify license key against server
  // For now, just store it locally

  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const license = {
    tier: 'pro',
    email,
    licenseKey,
    activatedAt: new Date().toISOString(),
  };

  writeFileSync(LICENSE_FILE, JSON.stringify(license, null, 2));
  return license;
}

/**
 * Deactivate license (revert to free)
 */
export function deactivateLicense() {
  if (existsSync(LICENSE_FILE)) {
    writeFileSync(LICENSE_FILE, JSON.stringify({ tier: 'free' }, null, 2));
  }
}
