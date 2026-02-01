/**
 * K-Templates: Load and serve templates from the_speech corpus
 *
 * Maps speech templates to K-vectors for instant, free responses.
 * This is the 80% path - most queries hit templates, no API cost.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

// Default template paths to try
const SPEECH_PATHS = [
  '/c/claude-projects/satus/the_speech',           // Absolute Unix-style
  'C:\\claude-projects\\satus\\the_speech',        // Absolute Windows
  '../../satus/the_speech',                        // Relative from src
  '../../../satus/the_speech',                     // Relative from k-context
  process.env.K_SPEECH_PATH                        // Environment override
].filter(Boolean);

// K-vector mapping for speech categories
const CATEGORY_TO_KVECTOR = {
  everyday: { suit: 'hearts', rankBase: 5 },    // Emotional everyday
  health: { suit: 'diamonds', rankBase: 8 },    // Body/material
  archetypes: { suit: 'spades', rankBase: 10 }, // Deep patterns
  chakra: { suit: 'hearts', rankBase: 7 },      // Energy/spiritual
  tree: { suit: 'spades', rankBase: 11 },       // Kabbalistic
  moments: { suit: 'hearts', rankBase: 3 }      // Simple presence
};

// Template corpus (loaded on init)
let TEMPLATES = {};
let TRIGGER_INDEX = {};
let initialized = false;

/**
 * Load all templates from speech directory
 */
export function loadTemplates(speechPath = null) {
  let basePath = speechPath;

  // If no path provided, try multiple known locations
  if (!basePath) {
    for (const tryPath of SPEECH_PATHS) {
      if (existsSync(tryPath)) {
        basePath = tryPath;
        break;
      }
    }
  }

  if (!basePath || !existsSync(basePath)) {
    console.warn(`Speech corpus not found, using built-in templates`);
    loadBuiltInTemplates();
    return;
  }

  TEMPLATES = {};
  TRIGGER_INDEX = {};

  // Scan subdirectories
  const categories = readdirSync(basePath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const category of categories) {
    const categoryPath = join(basePath, category);
    const files = readdirSync(categoryPath).filter(f => f.endsWith('.speech'));

    for (const file of files) {
      try {
        const content = readFileSync(join(categoryPath, file), 'utf8');
        const template = JSON.parse(content);
        const id = template.block_id || basename(file, '.speech');

        // Assign K-vector based on category
        const kMapping = CATEGORY_TO_KVECTOR[category] || { suit: 'hearts', rankBase: 5 };

        TEMPLATES[id] = {
          ...template,
          category,
          kVector: {
            suit: kMapping.suit,
            rank: kMapping.rankBase,
            polarity: determinePolarity(template)
          }
        };

        // Index triggers for fast lookup
        if (template.triggers) {
          for (const trigger of template.triggers) {
            const lowerTrigger = trigger.toLowerCase();
            if (!TRIGGER_INDEX[lowerTrigger]) {
              TRIGGER_INDEX[lowerTrigger] = [];
            }
            TRIGGER_INDEX[lowerTrigger].push(id);
          }
        }
      } catch (err) {
        console.warn(`Failed to load template ${file}:`, err.message);
      }
    }
  }

  initialized = true;
  console.log(`Loaded ${Object.keys(TEMPLATES).length} templates with ${Object.keys(TRIGGER_INDEX).length} triggers`);
}

/**
 * Load built-in minimal templates (fallback)
 */
function loadBuiltInTemplates() {
  TEMPLATES = {
    // Hearts (emotional)
    sad: {
      block_id: 'sad',
      surfaces: [
        "Sadness is just love with nowhere to go.",
        "You're allowed to feel this.",
        "The weight is real. You're not making it up."
      ],
      triggers: ['sad', 'sadness', 'unhappy', 'down'],
      kVector: { suit: 'hearts', rank: 5, polarity: '-' }
    },
    happy: {
      block_id: 'happy',
      surfaces: [
        "This is a good moment. Notice it.",
        "Joy doesn't need justification.",
        "Let it land. You earned this."
      ],
      triggers: ['happy', 'joy', 'glad', 'excited'],
      kVector: { suit: 'hearts', rank: 5, polarity: '+' }
    },
    lonely: {
      block_id: 'lonely',
      surfaces: [
        "Connection is a need, not a want.",
        "You're here. That's not nothing.",
        "Lonely doesn't mean alone forever."
      ],
      triggers: ['lonely', 'alone', 'isolated'],
      kVector: { suit: 'hearts', rank: 6, polarity: '-' }
    },
    // Spades (analytical)
    stuck: {
      block_id: 'stuck',
      surfaces: [
        "What's the smallest possible next step?",
        "Stuck is not permanent. Stuck is a rest stop.",
        "The obstacle is information. What's it telling you?"
      ],
      triggers: ['stuck', 'blocked', 'frozen', 'confused'],
      kVector: { suit: 'spades', rank: 6, polarity: '-' }
    },
    // Diamonds (practical)
    help: {
      block_id: 'help',
      surfaces: [
        "Asking is the first step. You took it.",
        "What specifically? Let's narrow it down.",
        "One piece at a time. Where do we start?"
      ],
      triggers: ['help', 'help me', 'assist', 'how do'],
      kVector: { suit: 'diamonds', rank: 5, polarity: '+' }
    },
    // Clubs (action)
    morning: {
      block_id: 'morning',
      surfaces: [
        "New day. Fresh page.",
        "What's the one thing today?",
        "Start small. Build momentum."
      ],
      triggers: ['morning', 'good morning', 'wake up', 'start'],
      kVector: { suit: 'clubs', rank: 4, polarity: '+' }
    }
  };

  // Build trigger index
  TRIGGER_INDEX = {};
  for (const [id, template] of Object.entries(TEMPLATES)) {
    if (template.triggers) {
      for (const trigger of template.triggers) {
        const lowerTrigger = trigger.toLowerCase();
        if (!TRIGGER_INDEX[lowerTrigger]) {
          TRIGGER_INDEX[lowerTrigger] = [];
        }
        TRIGGER_INDEX[lowerTrigger].push(id);
      }
    }
  }

  initialized = true;
}

/**
 * Determine polarity from template content
 */
function determinePolarity(template) {
  const darkWords = ['sad', 'grief', 'angry', 'fear', 'stuck', 'lost', 'pain', 'hurt', 'low', 'critical'];
  const lightWords = ['happy', 'joy', 'love', 'peace', 'calm', 'stable', 'good', 'well', 'thanks'];

  const text = JSON.stringify(template).toLowerCase();
  let darkScore = 0;
  let lightScore = 0;

  for (const word of darkWords) {
    if (text.includes(word)) darkScore++;
  }
  for (const word of lightWords) {
    if (text.includes(word)) lightScore++;
  }

  if (darkScore > lightScore) return '-';
  if (lightScore > darkScore) return '+';
  return '~';
}

/**
 * Find matching template for query
 */
export function findTemplate(query) {
  if (!initialized) loadTemplates();

  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);

  // Score each template by trigger matches
  const scores = {};

  for (const word of words) {
    // Exact trigger match
    if (TRIGGER_INDEX[word]) {
      for (const id of TRIGGER_INDEX[word]) {
        scores[id] = (scores[id] || 0) + 2;
      }
    }

    // Partial trigger match
    for (const trigger of Object.keys(TRIGGER_INDEX)) {
      if (trigger.includes(word) || word.includes(trigger)) {
        for (const id of TRIGGER_INDEX[trigger]) {
          scores[id] = (scores[id] || 0) + 1;
        }
      }
    }
  }

  // Find best match
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0 || sorted[0][1] < 2) {
    return null; // No good match
  }

  const templateId = sorted[0][0];
  return TEMPLATES[templateId];
}

/**
 * Get a random surface from template
 */
export function getResponse(template, voice = 'default') {
  if (!template || !template.surfaces) return null;

  // Check for companion voice
  if (voice === 'cat' && template.cat_voice) return template.cat_voice;
  if (voice === 'dog' && template.dog_voice) return template.dog_voice;
  if (voice === 'turtle' && template.turtle_voice) return template.turtle_voice;

  // Random surface
  const surfaces = template.surfaces;
  return surfaces[Math.floor(Math.random() * surfaces.length)];
}

/**
 * Full template lookup: query → response
 */
export function templateLookup(query, voice = 'default') {
  const template = findTemplate(query);
  if (!template) return null;

  return {
    response: getResponse(template, voice),
    template: template.block_id,
    kVector: template.kVector,
    category: template.category
  };
}

/**
 * Get all templates
 */
export function getAllTemplates() {
  if (!initialized) loadTemplates();
  return TEMPLATES;
}

/**
 * Get template count by category
 */
export function getTemplateStats() {
  if (!initialized) loadTemplates();

  const stats = {
    total: Object.keys(TEMPLATES).length,
    triggers: Object.keys(TRIGGER_INDEX).length,
    byCategory: {},
    bySuit: { hearts: 0, spades: 0, diamonds: 0, clubs: 0 }
  };

  for (const template of Object.values(TEMPLATES)) {
    const cat = template.category || 'unknown';
    stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

    if (template.kVector) {
      stats.bySuit[template.kVector.suit] = (stats.bySuit[template.kVector.suit] || 0) + 1;
    }
  }

  return stats;
}

// Auto-initialize on import
loadTemplates();
