/**
 * K-Inference: Route queries through K-classification to pooled APIs
 *
 * This is where k-context becomes Azure-competitive.
 * Instead of just classifying files, we classify QUERIES
 * and route them to appropriate handlers.
 */

// Query classification patterns (natural language, not file paths)
const QUERY_PATTERNS = {
  hearts: {
    patterns: [
      /feel/i, /emotion/i, /relationship/i, /friend/i, /love/i,
      /sad/i, /happy/i, /angry/i, /afraid/i, /lonely/i,
      /connect/i, /understand/i, /help me/i, /support/i
    ],
    keywords: ['feel', 'emotion', 'relationship', 'friend', 'connect', 'understand', 'support', 'care']
  },
  spades: {
    patterns: [
      /analyze/i, /explain/i, /why/i, /how does/i, /logic/i,
      /reason/i, /think/i, /understand/i, /compare/i, /difference/i,
      /debug/i, /error/i, /fix/i, /solve/i, /problem/i,
      /bug/i, /issue/i, /broken/i, /wrong/i, /code/i
    ],
    keywords: ['analyze', 'explain', 'logic', 'reason', 'think', 'compare', 'debug', 'solve', 'problem', 'bug', 'fix', 'error', 'issue', 'code']
  },
  diamonds: {
    patterns: [
      /data/i, /store/i, /save/i, /database/i, /schema/i,
      /type/i, /structure/i, /format/i, /json/i, /api/i,
      /what is/i, /define/i, /list/i, /show/i
    ],
    keywords: ['data', 'store', 'save', 'database', 'type', 'structure', 'format', 'define', 'list']
  },
  clubs: {
    patterns: [
      /create/i, /build/i, /make/i, /generate/i, /write/i,
      /run/i, /execute/i, /do/i, /action/i, /start/i,
      /deploy/i, /send/i, /post/i, /update/i, /delete/i
    ],
    keywords: ['create', 'build', 'make', 'generate', 'write', 'run', 'execute', 'action', 'deploy']
  }
};

// Polarity from query tone
const POLARITY_PATTERNS = {
  light: [/please/i, /help/i, /would/i, /could/i, /thanks/i, /good/i, /great/i, /love/i],
  dark: [/hate/i, /angry/i, /frustrated/i, /broken/i, /wrong/i, /fail/i, /error/i, /bug/i]
};

// Rank from query complexity
const RANK_INDICATORS = {
  low: [/simple/i, /basic/i, /quick/i, /just/i, /only/i],    // 1-4
  medium: [/how to/i, /explain/i, /help with/i],              // 5-9
  high: [/complex/i, /advanced/i, /architecture/i, /system/i, /design/i] // 10-13
};

/**
 * Classify a natural language query into K-vector
 */
export function classifyQuery(query) {
  const suit = classifyQuerySuit(query);
  const polarity = classifyQueryPolarity(query);
  const rank = classifyQueryRank(query);

  return {
    suit,
    polarity,
    rank,
    shorthand: `${polarity}${rank}${suit.charAt(0).toUpperCase()}`,
    description: describeKVector(suit, polarity, rank),
    escalate: shouldEscalate(query, suit, rank)
  };
}

function classifyQuerySuit(query) {
  const scores = { hearts: 0, spades: 0, diamonds: 0, clubs: 0 };
  const lowerQuery = query.toLowerCase();

  for (const [suit, config] of Object.entries(QUERY_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(query)) scores[suit] += 2;
    }
    for (const keyword of config.keywords) {
      if (lowerQuery.includes(keyword)) scores[suit] += 1;
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  // If no clear winner, return 'unknown' for escalation
  if (sorted[0][1] === 0) return 'unknown';
  if (sorted[0][1] === sorted[1][1]) return 'unknown'; // tie = uncertain

  return sorted[0][0];
}

function classifyQueryPolarity(query) {
  let lightScore = 0;
  let darkScore = 0;

  for (const pattern of POLARITY_PATTERNS.light) {
    if (pattern.test(query)) lightScore++;
  }
  for (const pattern of POLARITY_PATTERNS.dark) {
    if (pattern.test(query)) darkScore++;
  }

  if (lightScore === darkScore) return '~'; // neutral
  return lightScore > darkScore ? '+' : '-';
}

function classifyQueryRank(query) {
  let score = 7;

  for (const pattern of RANK_INDICATORS.low) {
    if (pattern.test(query)) score -= 2;
  }
  for (const pattern of RANK_INDICATORS.high) {
    if (pattern.test(query)) score += 2;
  }

  // Longer queries tend to be more complex
  const wordCount = query.split(/\s+/).length;
  if (wordCount > 30) score += 2;
  else if (wordCount < 5) score -= 1;

  return Math.max(1, Math.min(13, score));
}

function describeKVector(suit, polarity, rank) {
  const suitDesc = {
    hearts: 'emotional/relational',
    spades: 'analytical/logical',
    diamonds: 'data/information',
    clubs: 'action/creation',
    unknown: 'uncertain domain'
  };
  const polarityDesc = { '+': 'constructive', '-': 'challenging', '~': 'neutral' };
  const rankDesc = rank <= 4 ? 'simple' : rank <= 9 ? 'moderate' : 'complex';

  return `${polarityDesc[polarity]} ${rankDesc} ${suitDesc[suit]}`;
}

/**
 * Determine if query should escalate to higher-tier model
 */
function shouldEscalate(query, suit, rank) {
  // Unknown suit = can't route confidently = escalate
  if (suit === 'unknown') return { escalate: true, reason: 'uncertain_domain' };

  // High complexity = escalate
  if (rank >= 11) return { escalate: true, reason: 'high_complexity' };

  // Certain keywords always escalate
  const escalationTriggers = [
    /novel/i, /new approach/i, /never been done/i,
    /synthesis/i, /combine/i, /integrate/i,
    /what if/i, /imagine/i, /hypothetically/i
  ];

  for (const trigger of escalationTriggers) {
    if (trigger.test(query)) {
      return { escalate: true, reason: 'requires_synthesis' };
    }
  }

  return { escalate: false, reason: 'routable' };
}

/**
 * Select appropriate handler based on K-vector
 */
export function selectHandler(kVector) {
  const { suit, polarity, rank, escalate } = kVector;

  // Escalation path
  if (escalate.escalate) {
    return {
      tier: 'opus',
      reason: escalate.reason,
      template: null
    };
  }

  // Template path (80%)
  if (rank <= 6) {
    return {
      tier: 'template',
      reason: 'low_complexity',
      template: `${suit}_${polarity === '+' ? 'light' : polarity === '-' ? 'dark' : 'neutral'}`
    };
  }

  // Local model path (16%)
  if (rank <= 10) {
    return {
      tier: 'local',
      reason: 'moderate_complexity',
      template: null
    };
  }

  // Fallback to escalation
  return {
    tier: 'opus',
    reason: 'high_complexity',
    template: null
  };
}

/**
 * Route a query through the full inference pipeline
 */
export async function routeQuery(query, options = {}) {
  const kVector = classifyQuery(query);
  const handler = selectHandler(kVector);

  return {
    query,
    kVector,
    handler,
    timestamp: new Date().toISOString()
  };
}

/**
 * Batch route multiple queries
 */
export function routeBatch(queries) {
  return queries.map(q => ({
    query: q,
    ...routeQuery(q)
  }));
}
