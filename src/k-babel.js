/**
 * K-BABEL: Multi-cultural semantic interchange layer
 *
 * UN-BABELING: Recovering the interchange format that got fragmented.
 *
 * Every culture kept their piece of the coordinate system:
 * - Western: 52 cards, tarot, rank/suit
 * - Chinese: 64 hexagrams, I Ching, Wu Xing (5 elements)
 * - Indian: Sanskrit, 5 elements + Akasha, Navarasa (9 emotions), chakras
 * - Indigenous: Medicine Wheel (4 directions)
 * - African (Dogon): Binary cosmology, drum networks
 * - European: Maypole (axis mundi + weave), runes (Futhark)
 *
 * Same underlying geometry. Different notation. K is the interchange.
 */

// ═══════════════════════════════════════════════════════════════
// WESTERN: K-VECTOR (The base format)
// ═══════════════════════════════════════════════════════════════

const SUITS = {
  hearts: { element: 'water', direction: 'west', domain: 'emotion', chinese: 'water', sanskrit: 'apas', chakra: 'svadhisthana' },
  spades: { element: 'air', direction: 'east', domain: 'mind', chinese: 'metal', sanskrit: 'vayu', chakra: 'ajna' },
  diamonds: { element: 'earth', direction: 'north', domain: 'matter', chinese: 'earth', sanskrit: 'prithvi', chakra: 'muladhara' },
  clubs: { element: 'fire', direction: 'south', domain: 'action', chinese: 'fire', sanskrit: 'agni', chakra: 'manipura' }
};

// ═══════════════════════════════════════════════════════════════
// CHINESE: I CHING (64 hexagrams → K-vectors)
// ═══════════════════════════════════════════════════════════════

const TRIGRAMS = {
  qian:  { bits: '111', element: 'heaven', suit: 'clubs',    nature: 'creative' },
  kun:   { bits: '000', element: 'earth',  suit: 'diamonds', nature: 'receptive' },
  zhen:  { bits: '001', element: 'thunder',suit: 'clubs',    nature: 'arousing' },
  kan:   { bits: '010', element: 'water',  suit: 'hearts',   nature: 'abysmal' },
  gen:   { bits: '100', element: 'mountain',suit: 'diamonds',nature: 'stillness' },
  xun:   { bits: '110', element: 'wind',   suit: 'spades',   nature: 'gentle' },
  li:    { bits: '101', element: 'fire',   suit: 'clubs',    nature: 'clinging' },
  dui:   { bits: '011', element: 'lake',   suit: 'hearts',   nature: 'joyous' }
};

const HEXAGRAMS = {
  1:  { name: 'qian', english: 'The Creative', trigrams: ['qian', 'qian'] },
  2:  { name: 'kun', english: 'The Receptive', trigrams: ['kun', 'kun'] },
  3:  { name: 'zhun', english: 'Difficulty at Beginning', trigrams: ['kan', 'zhen'] },
  // ... (64 total - key ones for routing)
  11: { name: 'tai', english: 'Peace', trigrams: ['kun', 'qian'] },
  12: { name: 'pi', english: 'Standstill', trigrams: ['qian', 'kun'] },
  29: { name: 'kan', english: 'The Abysmal', trigrams: ['kan', 'kan'] },
  30: { name: 'li', english: 'The Clinging', trigrams: ['li', 'li'] },
  63: { name: 'ji_ji', english: 'After Completion', trigrams: ['kan', 'li'] },
  64: { name: 'wei_ji', english: 'Before Completion', trigrams: ['li', 'kan'] }
};

/**
 * Convert I Ching hexagram to K-vector
 */
export function hexagramToK(hexNumber) {
  const hex = HEXAGRAMS[hexNumber];
  if (!hex) return null;

  const lower = TRIGRAMS[hex.trigrams[0]];
  const upper = TRIGRAMS[hex.trigrams[1]];

  // Suit from dominant trigram element
  const suit = lower.suit;

  // Rank from hexagram number (1-64 → 1-13)
  const rank = Math.ceil((hexNumber / 64) * 13);

  // Polarity from nature (creative/receptive pairs)
  const polarity = ['qian', 'zhen', 'li', 'dui'].includes(hex.trigrams[0]) ? '+' : '-';

  return {
    shorthand: `${polarity}${rank}${suit.charAt(0).toUpperCase()}`,
    suit,
    rank,
    polarity,
    source: 'iching',
    hexagram: hexNumber,
    name: hex.name,
    english: hex.english
  };
}

/**
 * Find I Ching hexagram from K-vector
 */
export function kToHexagram(kVector) {
  const { suit, rank, polarity } = kVector;

  // Approximate hexagram from K-vector
  const targetNumber = Math.ceil((rank / 13) * 64);

  // Find closest hexagram with matching suit
  let bestMatch = null;
  let bestScore = -Infinity;

  for (const [num, hex] of Object.entries(HEXAGRAMS)) {
    const lower = TRIGRAMS[hex.trigrams[0]];
    if (!lower) continue;

    let score = 0;
    if (lower.suit === suit) score += 10;
    score -= Math.abs(parseInt(num) - targetNumber);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { number: parseInt(num), ...hex };
    }
  }

  return bestMatch;
}

// ═══════════════════════════════════════════════════════════════
// INDIAN: CHAKRAS + NAVARASA (9 emotions)
// ═══════════════════════════════════════════════════════════════

const CHAKRAS = {
  muladhara:    { rank: 1, suit: 'diamonds', element: 'earth', english: 'Root' },
  svadhisthana: { rank: 3, suit: 'hearts',   element: 'water', english: 'Sacral' },
  manipura:     { rank: 5, suit: 'clubs',    element: 'fire',  english: 'Solar Plexus' },
  anahata:      { rank: 7, suit: 'hearts',   element: 'air',   english: 'Heart' },
  vishuddha:    { rank: 9, suit: 'spades',   element: 'ether', english: 'Throat' },
  ajna:         { rank: 11, suit: 'spades',  element: 'light', english: 'Third Eye' },
  sahasrara:    { rank: 13, suit: 'spades',  element: 'consciousness', english: 'Crown' }
};

const NAVARASA = {
  shringara: { english: 'Love/Beauty', suit: 'hearts', polarity: '+' },
  hasya:     { english: 'Joy/Laughter', suit: 'hearts', polarity: '+' },
  karuna:    { english: 'Compassion/Sadness', suit: 'hearts', polarity: '-' },
  raudra:    { english: 'Anger/Fury', suit: 'clubs', polarity: '-' },
  veera:     { english: 'Courage/Heroism', suit: 'clubs', polarity: '+' },
  bhayanaka: { english: 'Fear/Terror', suit: 'spades', polarity: '-' },
  bibhatsa:  { english: 'Disgust', suit: 'diamonds', polarity: '-' },
  adbhuta:   { english: 'Wonder/Awe', suit: 'spades', polarity: '+' },
  shanta:    { english: 'Peace/Serenity', suit: 'hearts', polarity: '~' }
};

/**
 * Convert chakra to K-vector
 */
export function chakraToK(chakraName) {
  const chakra = CHAKRAS[chakraName.toLowerCase()];
  if (!chakra) return null;

  return {
    shorthand: `+${chakra.rank}${chakra.suit.charAt(0).toUpperCase()}`,
    suit: chakra.suit,
    rank: chakra.rank,
    polarity: '+',
    source: 'chakra',
    name: chakraName,
    english: chakra.english
  };
}

/**
 * Convert emotional state (rasa) to K-vector
 */
export function rasaToK(rasaName) {
  const rasa = NAVARASA[rasaName.toLowerCase()];
  if (!rasa) return null;

  return {
    shorthand: `${rasa.polarity}7${rasa.suit.charAt(0).toUpperCase()}`,
    suit: rasa.suit,
    rank: 7, // Middle intensity
    polarity: rasa.polarity,
    source: 'navarasa',
    name: rasaName,
    english: rasa.english
  };
}

// ═══════════════════════════════════════════════════════════════
// INDIGENOUS: MEDICINE WHEEL (4 directions)
// ═══════════════════════════════════════════════════════════════

const MEDICINE_WHEEL = {
  east:  { suit: 'spades',   element: 'air',   season: 'spring', life: 'birth',     color: 'yellow' },
  south: { suit: 'clubs',    element: 'fire',  season: 'summer', life: 'youth',     color: 'red' },
  west:  { suit: 'hearts',   element: 'water', season: 'autumn', life: 'adult',     color: 'black' },
  north: { suit: 'diamonds', element: 'earth', season: 'winter', life: 'elder',     color: 'white' }
};

/**
 * Convert direction to K-vector
 */
export function directionToK(direction, intensity = 7) {
  const wheel = MEDICINE_WHEEL[direction.toLowerCase()];
  if (!wheel) return null;

  return {
    shorthand: `+${intensity}${wheel.suit.charAt(0).toUpperCase()}`,
    suit: wheel.suit,
    rank: intensity,
    polarity: '+',
    source: 'medicine_wheel',
    direction,
    element: wheel.element,
    season: wheel.season
  };
}

// ═══════════════════════════════════════════════════════════════
// EUROPEAN: RUNES (Elder Futhark)
// ═══════════════════════════════════════════════════════════════

const RUNES = {
  fehu:    { meaning: 'Wealth', suit: 'diamonds', polarity: '+', rank: 3 },
  uruz:    { meaning: 'Strength', suit: 'clubs', polarity: '+', rank: 8 },
  thurisaz:{ meaning: 'Giant/Thorn', suit: 'clubs', polarity: '-', rank: 9 },
  ansuz:   { meaning: 'God/Message', suit: 'spades', polarity: '+', rank: 11 },
  raido:   { meaning: 'Journey', suit: 'clubs', polarity: '+', rank: 5 },
  kenaz:   { meaning: 'Torch/Knowledge', suit: 'spades', polarity: '+', rank: 7 },
  gebo:    { meaning: 'Gift', suit: 'hearts', polarity: '+', rank: 6 },
  wunjo:   { meaning: 'Joy', suit: 'hearts', polarity: '+', rank: 8 },
  hagalaz: { meaning: 'Hail/Disruption', suit: 'spades', polarity: '-', rank: 10 },
  nauthiz: { meaning: 'Need/Constraint', suit: 'diamonds', polarity: '-', rank: 5 },
  isa:     { meaning: 'Ice/Stillness', suit: 'diamonds', polarity: '~', rank: 4 },
  jera:    { meaning: 'Harvest/Year', suit: 'diamonds', polarity: '+', rank: 10 },
  eihwaz:  { meaning: 'Yew/Death', suit: 'spades', polarity: '-', rank: 13 },
  perthro:{ meaning: 'Mystery/Fate', suit: 'spades', polarity: '~', rank: 12 },
  algiz:   { meaning: 'Protection', suit: 'diamonds', polarity: '+', rank: 8 },
  sowilo:  { meaning: 'Sun/Victory', suit: 'clubs', polarity: '+', rank: 13 }
};

/**
 * Convert rune to K-vector
 */
export function runeToK(runeName) {
  const rune = RUNES[runeName.toLowerCase()];
  if (!rune) return null;

  return {
    shorthand: `${rune.polarity}${rune.rank}${rune.suit.charAt(0).toUpperCase()}`,
    suit: rune.suit,
    rank: rune.rank,
    polarity: rune.polarity,
    source: 'rune',
    name: runeName,
    meaning: rune.meaning
  };
}

// ═══════════════════════════════════════════════════════════════
// TREE OF LIFE: SEPHIROT (10 stations)
// ═══════════════════════════════════════════════════════════════

const SEPHIROT = {
  kether:    { rank: 13, suit: 'spades',   english: 'Crown', world: 'atziluth' },
  chokmah:   { rank: 12, suit: 'spades',   english: 'Wisdom', world: 'atziluth' },
  binah:     { rank: 11, suit: 'spades',   english: 'Understanding', world: 'atziluth' },
  chesed:    { rank: 10, suit: 'hearts',   english: 'Mercy', world: 'briah' },
  geburah:   { rank: 9,  suit: 'clubs',    english: 'Strength', world: 'briah' },
  tiphareth: { rank: 8,  suit: 'hearts',   english: 'Beauty', world: 'briah' },
  netzach:   { rank: 7,  suit: 'hearts',   english: 'Victory', world: 'yetzirah' },
  hod:       { rank: 6,  suit: 'spades',   english: 'Glory', world: 'yetzirah' },
  yesod:     { rank: 5,  suit: 'hearts',   english: 'Foundation', world: 'yetzirah' },
  malkuth:   { rank: 1,  suit: 'diamonds', english: 'Kingdom', world: 'assiah' }
};

/**
 * Convert sephira to K-vector
 */
export function sephiraToK(sephiraName) {
  const sephira = SEPHIROT[sephiraName.toLowerCase()];
  if (!sephira) return null;

  return {
    shorthand: `+${sephira.rank}${sephira.suit.charAt(0).toUpperCase()}`,
    suit: sephira.suit,
    rank: sephira.rank,
    polarity: '+',
    source: 'sephirot',
    name: sephiraName,
    english: sephira.english,
    world: sephira.world
  };
}

// ═══════════════════════════════════════════════════════════════
// UNIVERSAL INTERCHANGE
// ═══════════════════════════════════════════════════════════════

/**
 * Convert ANY cultural notation to K-vector
 */
export function toK(input, system = null) {
  // Auto-detect system if not specified
  if (!system) {
    if (typeof input === 'number' && input >= 1 && input <= 64) {
      return hexagramToK(input);
    }
    if (CHAKRAS[input?.toLowerCase?.()]) {
      return chakraToK(input);
    }
    if (NAVARASA[input?.toLowerCase?.()]) {
      return rasaToK(input);
    }
    if (MEDICINE_WHEEL[input?.toLowerCase?.()]) {
      return directionToK(input);
    }
    if (RUNES[input?.toLowerCase?.()]) {
      return runeToK(input);
    }
    if (SEPHIROT[input?.toLowerCase?.()]) {
      return sephiraToK(input);
    }
    return null;
  }

  // Explicit system
  switch (system.toLowerCase()) {
    case 'iching':
    case 'hexagram':
      return hexagramToK(input);
    case 'chakra':
      return chakraToK(input);
    case 'rasa':
    case 'navarasa':
      return rasaToK(input);
    case 'direction':
    case 'medicine_wheel':
      return directionToK(input);
    case 'rune':
    case 'futhark':
      return runeToK(input);
    case 'sephira':
    case 'sephirot':
    case 'tree':
      return sephiraToK(input);
    default:
      return null;
  }
}

/**
 * Convert K-vector to ALL cultural notations
 */
export function fromK(kVector) {
  const { suit, rank, polarity } = kVector;

  const result = {
    k: kVector.shorthand || `${polarity}${rank}${suit.charAt(0).toUpperCase()}`,
    translations: {}
  };

  // I Ching
  const hexagram = kToHexagram(kVector);
  if (hexagram) {
    result.translations.iching = {
      number: hexagram.number,
      name: hexagram.name,
      english: hexagram.english
    };
  }

  // Chakra (by rank)
  for (const [name, chakra] of Object.entries(CHAKRAS)) {
    if (Math.abs(chakra.rank - rank) <= 1 && chakra.suit === suit) {
      result.translations.chakra = { name, english: chakra.english };
      break;
    }
  }

  // Medicine Wheel (by suit)
  for (const [direction, wheel] of Object.entries(MEDICINE_WHEEL)) {
    if (wheel.suit === suit) {
      result.translations.medicine_wheel = { direction, element: wheel.element };
      break;
    }
  }

  // Rune (by suit + rank + polarity)
  let bestRune = null;
  let bestRuneScore = 0;
  for (const [name, rune] of Object.entries(RUNES)) {
    let score = 0;
    if (rune.suit === suit) score += 10;
    if (rune.polarity === polarity) score += 5;
    score -= Math.abs(rune.rank - rank);
    if (score > bestRuneScore) {
      bestRuneScore = score;
      bestRune = { name, meaning: rune.meaning };
    }
  }
  if (bestRune) {
    result.translations.rune = bestRune;
  }

  // Sephira (by rank + suit)
  for (const [name, sephira] of Object.entries(SEPHIROT)) {
    if (Math.abs(sephira.rank - rank) <= 1 && sephira.suit === suit) {
      result.translations.sephirot = { name, english: sephira.english };
      break;
    }
  }

  return result;
}

/**
 * Get interchange for a query (route through K, output all systems)
 */
export function interchange(kVector) {
  return fromK(kVector);
}

/**
 * List all supported cultural systems
 */
export function listSystems() {
  return {
    western: { name: 'Western (K-Vector)', count: 104, format: '+3H, -7S, etc.' },
    iching: { name: 'I Ching', count: 64, format: 'Hexagram 1-64' },
    chakra: { name: 'Chakras', count: 7, format: 'muladhara, anahata, etc.' },
    navarasa: { name: 'Navarasa', count: 9, format: 'shringara, karuna, etc.' },
    medicine_wheel: { name: 'Medicine Wheel', count: 4, format: 'east, south, west, north' },
    rune: { name: 'Elder Futhark', count: 24, format: 'fehu, uruz, etc.' },
    sephirot: { name: 'Tree of Life', count: 10, format: 'kether, malkuth, etc.' }
  };
}

export {
  SUITS,
  TRIGRAMS,
  HEXAGRAMS,
  CHAKRAS,
  NAVARASA,
  MEDICINE_WHEEL,
  RUNES,
  SEPHIROT
};
