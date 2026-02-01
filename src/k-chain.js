/**
 * K-Chain: Golden chain logging for K-inference
 *
 * Every query/response pair gets logged to a chain.
 * Provides audit trail, learning data, and replay capability.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';

const CHAIN_DIR = join(homedir(), '.k-context', 'chain');
const CHAIN_FILE = join(CHAIN_DIR, 'golden_chain.json');

/**
 * Ensure chain directory exists
 */
function ensureChainDir() {
  if (!existsSync(CHAIN_DIR)) {
    mkdirSync(CHAIN_DIR, { recursive: true });
  }
}

/**
 * Load the chain
 */
export function loadChain() {
  ensureChainDir();
  if (!existsSync(CHAIN_FILE)) {
    return { blocks: [], metadata: { created: new Date().toISOString(), version: '0.4.0' } };
  }
  try {
    return JSON.parse(readFileSync(CHAIN_FILE, 'utf8'));
  } catch {
    return { blocks: [], metadata: { created: new Date().toISOString(), version: '0.4.0' } };
  }
}

/**
 * Save the chain
 */
export function saveChain(chain) {
  ensureChainDir();
  writeFileSync(CHAIN_FILE, JSON.stringify(chain, null, 2));
}

/**
 * Hash a block for chain integrity
 */
function hashBlock(block, prevHash) {
  const content = JSON.stringify({ ...block, prevHash });
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Log an inference exchange to the chain
 */
export function logExchange(query, response, kVector, metadata = {}) {
  const chain = loadChain();
  const prevHash = chain.blocks.length > 0
    ? chain.blocks[chain.blocks.length - 1].hash
    : '0000000000000000';

  const block = {
    id: chain.blocks.length + 1,
    timestamp: new Date().toISOString(),
    query,
    response: typeof response === 'string' ? response : response?.response,
    kVector: kVector?.shorthand || kVector,
    suit: kVector?.suit,
    polarity: kVector?.polarity,
    rank: kVector?.rank,
    tier: metadata.tier || 'unknown',
    tokens: metadata.tokens || 0,
    ...metadata
  };

  block.hash = hashBlock(block, prevHash);
  block.prevHash = prevHash;

  chain.blocks.push(block);
  chain.metadata.lastUpdated = new Date().toISOString();
  chain.metadata.blockCount = chain.blocks.length;

  saveChain(chain);
  return block;
}

/**
 * Get recent exchanges
 */
export function getRecent(count = 10) {
  const chain = loadChain();
  return chain.blocks.slice(-count);
}

/**
 * Get chain statistics
 */
export function getChainStats() {
  const chain = loadChain();
  const blocks = chain.blocks;

  if (blocks.length === 0) {
    return { total: 0, byTier: {}, bySuit: {}, tokens: 0 };
  }

  const stats = {
    total: blocks.length,
    byTier: {},
    bySuit: {},
    byPolarity: { '+': 0, '-': 0, '~': 0 },
    tokens: 0,
    firstBlock: blocks[0]?.timestamp,
    lastBlock: blocks[blocks.length - 1]?.timestamp
  };

  for (const block of blocks) {
    // By tier
    const tier = block.tier || 'unknown';
    stats.byTier[tier] = (stats.byTier[tier] || 0) + 1;

    // By suit
    if (block.suit) {
      stats.bySuit[block.suit] = (stats.bySuit[block.suit] || 0) + 1;
    }

    // By polarity
    if (block.polarity) {
      stats.byPolarity[block.polarity] = (stats.byPolarity[block.polarity] || 0) + 1;
    }

    // Tokens
    stats.tokens += block.tokens || 0;
  }

  return stats;
}

/**
 * Verify chain integrity
 */
export function verifyChain() {
  const chain = loadChain();
  const blocks = chain.blocks;

  if (blocks.length === 0) return { valid: true, errors: [] };

  const errors = [];
  let prevHash = '0000000000000000';

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Check prevHash matches
    if (block.prevHash !== prevHash) {
      errors.push(`Block ${block.id}: prevHash mismatch`);
    }

    // Check hash is valid
    const expectedHash = hashBlock({ ...block, hash: undefined, prevHash: undefined }, prevHash);
    if (block.hash !== expectedHash) {
      errors.push(`Block ${block.id}: hash mismatch`);
    }

    prevHash = block.hash;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Search chain by query content
 */
export function searchChain(searchTerm) {
  const chain = loadChain();
  const term = searchTerm.toLowerCase();

  return chain.blocks.filter(block =>
    block.query?.toLowerCase().includes(term) ||
    block.response?.toLowerCase().includes(term)
  );
}

/**
 * Get exchanges by K-vector pattern
 */
export function getByKVector(pattern) {
  const chain = loadChain();

  // Pattern can be suit, polarity, or full shorthand
  return chain.blocks.filter(block => {
    if (!block.kVector) return false;
    if (block.kVector === pattern) return true;
    if (block.suit === pattern) return true;
    if (block.polarity === pattern) return true;
    return false;
  });
}

/**
 * Export chain to markdown
 */
export function exportChain(format = 'md') {
  const chain = loadChain();
  const stats = getChainStats();

  if (format === 'md') {
    let md = `# K-Context Golden Chain\n\n`;
    md += `**Blocks:** ${stats.total}\n`;
    md += `**Tokens:** ${stats.tokens}\n`;
    md += `**Period:** ${stats.firstBlock} → ${stats.lastBlock}\n\n`;

    md += `## By Tier\n`;
    for (const [tier, count] of Object.entries(stats.byTier)) {
      md += `- ${tier}: ${count}\n`;
    }

    md += `\n## Recent Exchanges\n\n`;
    const recent = chain.blocks.slice(-20);
    for (const block of recent) {
      md += `### ${block.id}. [${block.kVector || '?'}] ${block.timestamp}\n`;
      md += `**Q:** ${block.query?.slice(0, 100)}...\n`;
      md += `**A:** ${block.response?.slice(0, 100)}...\n\n`;
    }

    return md;
  }

  if (format === 'redacted') {
    return exportRedacted(chain, stats);
  }

  return JSON.stringify(chain, null, 2);
}

/**
 * Export redacted chain - hashes + summaries, declassified docs style
 */
function exportRedacted(chain, stats) {
  const blocks = chain.blocks;

  let out = `╔══════════════════════════════════════════════════════════════════╗
║                    GOLDEN CHAIN — REDACTED LOG                   ║
║                     Classification: UNCLASSIFIED                 ║
╚══════════════════════════════════════════════════════════════════╝

DOCUMENT ID: ${createHash('sha256').update(JSON.stringify(chain.metadata)).digest('hex').slice(0, 16)}
GENERATED:   ${new Date().toISOString()}
CHAIN START: ${stats.firstBlock || 'N/A'}
CHAIN END:   ${stats.lastBlock || 'N/A'}
TOTAL BLOCKS: ${stats.total}
TOTAL TOKENS: ${stats.tokens}

═══════════════════════════════════════════════════════════════════
                          CHAIN INTEGRITY
═══════════════════════════════════════════════════════════════════

`;

  // Verify and show integrity
  const integrity = verifyChain();
  out += `STATUS: ${integrity.valid ? '✓ VERIFIED' : '✗ INTEGRITY ERRORS'}\n`;
  if (!integrity.valid) {
    integrity.errors.forEach(e => { out += `  ERROR: ${e}\n`; });
  }

  out += `\n═══════════════════════════════════════════════════════════════════
                         STATISTICAL SUMMARY
═══════════════════════════════════════════════════════════════════

BY TIER:
`;
  for (const [tier, count] of Object.entries(stats.byTier)) {
    const pct = ((count / stats.total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    out += `  ${tier.padEnd(10)} ${bar} ${count} (${pct}%)\n`;
  }

  out += `\nBY SUIT:\n`;
  for (const [suit, count] of Object.entries(stats.bySuit)) {
    const pct = ((count / stats.total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    out += `  ${suit.padEnd(10)} ${bar} ${count} (${pct}%)\n`;
  }

  out += `\n═══════════════════════════════════════════════════════════════════
                          BLOCK MANIFEST
═══════════════════════════════════════════════════════════════════

`;

  for (const block of blocks) {
    const queryPreview = summarizeContent(block.query);
    const responsePreview = summarizeContent(block.response);

    out += `┌─────────────────────────────────────────────────────────────────┐
│ BLOCK ${String(block.id).padStart(4, '0')}                                                      │
├─────────────────────────────────────────────────────────────────┤
│ TIMESTAMP: ${block.timestamp.padEnd(51)}│
│ K-VECTOR:  ${(typeof block.kVector === 'object' ? block.kVector?.shorthand : block.kVector || '???').padEnd(51)}│
│ SUIT:      ${String(block.suit || '???').padEnd(51)}│
│ TIER:      ${String(block.tier || '???').padEnd(51)}│
│ TOKENS:    ${String(block.tokens || 0).padEnd(51)}│
├─────────────────────────────────────────────────────────────────┤
│ HASH:      ${block.hash.padEnd(51)}│
│ PREV:      ${block.prevHash.padEnd(51)}│
├─────────────────────────────────────────────────────────────────┤
│ QUERY:     ${queryPreview.padEnd(51)}│
│ RESPONSE:  ${responsePreview.padEnd(51)}│
└─────────────────────────────────────────────────────────────────┘

`;
  }

  out += `═══════════════════════════════════════════════════════════════════
                           END OF DOCUMENT
                    This log is cryptographically
                     verifiable via block hashes.
═══════════════════════════════════════════════════════════════════
`;

  return out;
}

/**
 * Summarize content for redacted view - show keywords, redact details
 */
function summarizeContent(text) {
  if (!text) return '████████████████████████████████████';

  const words = text.split(/\s+/).slice(0, 6);
  let preview = words.join(' ');

  if (preview.length > 40) {
    preview = preview.slice(0, 37) + '...';
  } else if (text.length > preview.length) {
    preview += ' ██████████';
  }

  // Redact anything that looks like code or sensitive
  preview = preview.replace(/[a-zA-Z0-9_]{20,}/g, '████████');
  preview = preview.replace(/https?:\/\/\S+/g, '████████');
  preview = preview.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '████████');

  return preview.slice(0, 51);
}
