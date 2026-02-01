/**
 * K-routing: Semantic classification using K-vector notation
 *
 * K-vectors classify files/modules by domain:
 * - H (Hearts): Relationship, connection, user-facing
 * - S (Spades): Logic, analysis, computation
 * - D (Diamonds): Data, storage, material
 * - C (Clubs): Action, energy, side effects
 *
 * Polarity:
 * - + (light): Creative, additive, public
 * - - (dark): Defensive, internal, private
 *
 * Rank (1-13): Intensity/complexity level
 */

// Domain classification patterns
const DOMAIN_PATTERNS = {
  hearts: {
    patterns: [
      /component/i,
      /ui\//i,
      /view/i,
      /page/i,
      /layout/i,
      /theme/i,
      /style/i,
      /css$/,
      /\.vue$/,
      /\.svelte$/,
      /\.jsx$/,
      /\.tsx$/,
    ],
    keywords: ['render', 'display', 'show', 'view', 'component', 'ui', 'user', 'interface'],
  },
  spades: {
    patterns: [
      /util/i,
      /helper/i,
      /lib\//i,
      /core\//i,
      /logic/i,
      /algorithm/i,
      /parser/i,
      /validator/i,
      /transform/i,
    ],
    keywords: ['parse', 'validate', 'calculate', 'compute', 'analyze', 'transform', 'process'],
  },
  diamonds: {
    patterns: [
      /model/i,
      /schema/i,
      /type/i,
      /interface/i,
      /entity/i,
      /data/i,
      /store/i,
      /state/i,
      /\.d\.ts$/,
      /migration/i,
    ],
    keywords: ['data', 'model', 'schema', 'type', 'interface', 'entity', 'record', 'store'],
  },
  clubs: {
    patterns: [
      /api\//i,
      /service/i,
      /action/i,
      /handler/i,
      /controller/i,
      /hook/i,
      /middleware/i,
      /route.*server/i,
      /\+server\./,
    ],
    keywords: ['fetch', 'send', 'post', 'get', 'create', 'update', 'delete', 'handle', 'action'],
  },
};

// Polarity indicators
const POLARITY_PATTERNS = {
  light: [
    /^public\//,
    /^src\//,
    /^app\//,
    /export\s+default/,
    /^index\./,
  ],
  dark: [
    /^internal\//,
    /^private\//,
    /^_/,
    /\.internal\./,
    /\.private\./,
    /test/i,
    /spec/i,
    /mock/i,
  ],
};

// Complexity/rank indicators
const RANK_INDICATORS = {
  low: [/config/i, /const/i, /simple/i, /basic/i],
  medium: [/service/i, /store/i, /component/i],
  high: [/engine/i, /core/i, /framework/i, /system/i],
};

/**
 * Classify a file/module with K-vector notation
 */
export function classify(filePath, content = '') {
  const suit = classifySuit(filePath, content);
  const polarity = classifyPolarity(filePath, content);
  const rank = classifyRank(filePath, content);

  return {
    suit,
    polarity,
    rank,
    shorthand: `${polarity}${rank}${suit.charAt(0).toUpperCase()}`,
    description: describeKVector(suit, polarity, rank),
  };
}

/**
 * Classify the suit (domain)
 */
function classifySuit(filePath, content) {
  const scores = { hearts: 0, spades: 0, diamonds: 0, clubs: 0 };
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();

  for (const [suit, config] of Object.entries(DOMAIN_PATTERNS)) {
    // Check path patterns
    for (const pattern of config.patterns) {
      if (pattern.test(filePath)) {
        scores[suit] += 2;
      }
    }

    // Check content keywords
    for (const keyword of config.keywords) {
      if (lowerPath.includes(keyword)) {
        scores[suit] += 1;
      }
      if (lowerContent.includes(keyword)) {
        scores[suit] += 0.5;
      }
    }
  }

  // Return highest scoring suit
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0 ? sorted[0][0] : 'spades'; // Default to spades (logic)
}

/**
 * Classify polarity (light/dark)
 */
function classifyPolarity(filePath, content) {
  let lightScore = 0;
  let darkScore = 0;

  for (const pattern of POLARITY_PATTERNS.light) {
    if (pattern.test(filePath) || pattern.test(content)) {
      lightScore++;
    }
  }

  for (const pattern of POLARITY_PATTERNS.dark) {
    if (pattern.test(filePath) || pattern.test(content)) {
      darkScore++;
    }
  }

  return lightScore >= darkScore ? '+' : '-';
}

/**
 * Classify rank (1-13)
 */
function classifyRank(filePath, content) {
  let score = 7; // Default to middle

  for (const pattern of RANK_INDICATORS.low) {
    if (pattern.test(filePath) || pattern.test(content)) {
      score -= 2;
    }
  }

  for (const pattern of RANK_INDICATORS.high) {
    if (pattern.test(filePath) || pattern.test(content)) {
      score += 2;
    }
  }

  // Clamp to 1-13
  return Math.max(1, Math.min(13, score));
}

/**
 * Generate human-readable description of K-vector
 */
function describeKVector(suit, polarity, rank) {
  const suitDescriptions = {
    hearts: 'user interface',
    spades: 'logic/computation',
    diamonds: 'data/state',
    clubs: 'actions/effects',
  };

  const polarityDescriptions = {
    '+': 'public',
    '-': 'internal',
  };

  const rankDescription = rank <= 4 ? 'simple' : rank <= 9 ? 'standard' : 'complex';

  return `${polarityDescriptions[polarity]} ${rankDescription} ${suitDescriptions[suit]}`;
}

/**
 * Batch classify multiple files
 */
export function classifyBatch(files) {
  return files.map(file => ({
    ...file,
    kVector: classify(file.path, ''),
  }));
}

/**
 * Group files by K-vector suit
 */
export function groupBySuit(files) {
  const groups = {
    hearts: [],
    spades: [],
    diamonds: [],
    clubs: [],
  };

  for (const file of files) {
    const { suit } = classify(file.path, '');
    groups[suit].push(file);
  }

  return groups;
}
