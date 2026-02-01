// k-context - Generate CLAUDE.md and Cursor rules from any codebase
// Now with K-inference: Azure-competitive distributed AI routing

// Original exports
export { scan } from './scanner.js';
export { generate } from './generator.js';
export { classify, classifyBatch, groupBySuit } from './k-route.js';

// K-Inference exports (the Azure-competitive bits)
export { classifyQuery, routeQuery, selectHandler } from './k-inference.js';
export { execute, infer } from './k-execute.js';
export {
  loadPool,
  savePool,
  addKey,
  removeKey,
  getNextKey,
  recordUsage,
  getPoolStats,
  listKeys,
  resetHealth
} from './k-pool.js';

// K-Server exports
export { startServer, stopServer } from './k-server.js';

// K-Templates exports
export {
  loadTemplates,
  findTemplate,
  getResponse,
  templateLookup,
  getAllTemplates,
  getTemplateStats
} from './k-templates.js';

// K-BABEL: Multi-cultural interchange (The Moat)
export {
  toK,
  fromK,
  interchange,
  listSystems,
  hexagramToK,
  kToHexagram,
  chakraToK,
  rasaToK,
  directionToK,
  runeToK,
  sephiraToK,
  SUITS,
  TRIGRAMS,
  HEXAGRAMS,
  CHAKRAS,
  NAVARASA,
  MEDICINE_WHEEL,
  RUNES,
  SEPHIROT
} from './k-babel.js';

// K-Chain: Golden chain logging
export {
  loadChain,
  saveChain,
  logExchange,
  getRecent,
  getChainStats,
  verifyChain,
  searchChain,
  getByKVector,
  exportChain
} from './k-chain.js';
