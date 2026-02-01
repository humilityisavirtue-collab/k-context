/**
 * K-Pool: Distributed API key pool management
 *
 * The Visa Whale Router math:
 * - 2013 nodes × Google Free Tier = ~2B tokens/day
 * - K-route classification = 5-15 tokens per transaction
 * - Capacity: 133-400M transactions/day
 * - Visa does ~150M/day
 *
 * This runs on pooled free API keys.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const POOL_FILE = join(homedir(), '.k-context', 'api-pool.json');

// Provider configurations
const PROVIDERS = {
  google: {
    name: 'Google AI (Gemini)',
    freeLimit: 1000000, // ~1M tokens/day on free tier
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    tokenHeader: 'x-goog-api-key'
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    freeLimit: 0, // No free tier, but including for paid pool
    endpoint: 'https://api.anthropic.com/v1/messages',
    tokenHeader: 'x-api-key'
  },
  openrouter: {
    name: 'OpenRouter (Free models)',
    freeLimit: 200000, // Free models available
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    tokenHeader: 'Authorization'
  },
  ollama: {
    name: 'Ollama (Local)',
    freeLimit: Infinity, // Local = unlimited
    endpoint: 'http://localhost:11434/api/generate',
    tokenHeader: null
  }
};

/**
 * Load the API key pool
 */
export function loadPool() {
  if (!existsSync(POOL_FILE)) {
    return {
      keys: [],
      usage: {},
      lastRotation: null
    };
  }

  try {
    return JSON.parse(readFileSync(POOL_FILE, 'utf8'));
  } catch {
    return { keys: [], usage: {}, lastRotation: null };
  }
}

/**
 * Save the API key pool
 */
export function savePool(pool) {
  const dir = join(homedir(), '.k-context');
  if (!existsSync(dir)) {
    const { mkdirSync } = require('fs');
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2));
}

/**
 * Add a key to the pool
 */
export function addKey(provider, key, label = null) {
  const pool = loadPool();

  const keyEntry = {
    id: `${provider}-${Date.now()}`,
    provider,
    key,
    label: label || `${provider}-key`,
    addedAt: new Date().toISOString(),
    usageToday: 0,
    lastUsed: null,
    healthy: true
  };

  pool.keys.push(keyEntry);
  pool.usage[keyEntry.id] = { today: 0, total: 0 };

  savePool(pool);
  return keyEntry;
}

/**
 * Remove a key from the pool
 */
export function removeKey(keyId) {
  const pool = loadPool();
  pool.keys = pool.keys.filter(k => k.id !== keyId);
  delete pool.usage[keyId];
  savePool(pool);
}

/**
 * Get the next available key (round-robin with health check)
 */
export function getNextKey(provider = null) {
  const pool = loadPool();
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Reset daily usage if new day
  if (pool.lastRotation !== today) {
    pool.keys.forEach(k => {
      pool.usage[k.id] = pool.usage[k.id] || { today: 0, total: 0 };
      pool.usage[k.id].today = 0;
    });
    pool.lastRotation = today;
    savePool(pool);
  }

  // Filter by provider if specified
  let candidates = pool.keys.filter(k => k.healthy);
  if (provider) {
    candidates = candidates.filter(k => k.provider === provider);
  }

  if (candidates.length === 0) {
    // Fallback to local if no API keys
    if (PROVIDERS.ollama) {
      return { provider: 'ollama', key: null, local: true };
    }
    return null;
  }

  // Sort by usage (least used first)
  candidates.sort((a, b) => {
    const usageA = pool.usage[a.id]?.today || 0;
    const usageB = pool.usage[b.id]?.today || 0;
    return usageA - usageB;
  });

  const selected = candidates[0];
  const providerConfig = PROVIDERS[selected.provider];

  // Check if under limit
  const currentUsage = pool.usage[selected.id]?.today || 0;
  if (currentUsage >= providerConfig.freeLimit) {
    // This key is exhausted, mark and try next
    selected.healthy = false;
    savePool(pool);
    return getNextKey(provider);
  }

  return {
    ...selected,
    endpoint: providerConfig.endpoint,
    tokenHeader: providerConfig.tokenHeader
  };
}

/**
 * Record usage for a key
 */
export function recordUsage(keyId, tokens) {
  const pool = loadPool();

  if (!pool.usage[keyId]) {
    pool.usage[keyId] = { today: 0, total: 0 };
  }

  pool.usage[keyId].today += tokens;
  pool.usage[keyId].total += tokens;

  const key = pool.keys.find(k => k.id === keyId);
  if (key) {
    key.lastUsed = new Date().toISOString();
    key.usageToday = pool.usage[keyId].today;
  }

  savePool(pool);
}

/**
 * Mark a key as unhealthy (failed request)
 */
export function markUnhealthy(keyId) {
  const pool = loadPool();
  const key = pool.keys.find(k => k.id === keyId);
  if (key) {
    key.healthy = false;
    savePool(pool);
  }
}

/**
 * Reset all keys to healthy (daily reset)
 */
export function resetHealth() {
  const pool = loadPool();
  pool.keys.forEach(k => { k.healthy = true; });
  savePool(pool);
}

/**
 * Get pool statistics
 */
export function getPoolStats() {
  const pool = loadPool();

  const stats = {
    totalKeys: pool.keys.length,
    healthyKeys: pool.keys.filter(k => k.healthy).length,
    byProvider: {},
    todayUsage: 0,
    totalUsage: 0,
    estimatedCapacity: 0
  };

  for (const key of pool.keys) {
    const provider = key.provider;
    if (!stats.byProvider[provider]) {
      stats.byProvider[provider] = { count: 0, usage: 0, limit: PROVIDERS[provider]?.freeLimit || 0 };
    }
    stats.byProvider[provider].count++;
    stats.byProvider[provider].usage += pool.usage[key.id]?.today || 0;
  }

  for (const usage of Object.values(pool.usage)) {
    stats.todayUsage += usage.today || 0;
    stats.totalUsage += usage.total || 0;
  }

  // Calculate estimated daily capacity
  for (const [provider, data] of Object.entries(stats.byProvider)) {
    stats.estimatedCapacity += data.count * (PROVIDERS[provider]?.freeLimit || 0);
  }

  return stats;
}

/**
 * List all keys (masked for security)
 */
export function listKeys() {
  const pool = loadPool();
  return pool.keys.map(k => ({
    id: k.id,
    provider: k.provider,
    label: k.label,
    keyMasked: k.key ? `${k.key.slice(0, 8)}...${k.key.slice(-4)}` : null,
    healthy: k.healthy,
    usageToday: pool.usage[k.id]?.today || 0,
    lastUsed: k.lastUsed
  }));
}
