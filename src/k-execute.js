/**
 * K-Execute: Actually run inference through the routed handler
 *
 * Tiers:
 * - template (80%): Pre-built responses from the_speech corpus, instant, zero API cost
 * - local (16%): Ollama/local model, no API cost
 * - opus (4%): Escalate to Claude/GPT, API cost
 */

import { getNextKey, recordUsage, markUnhealthy } from './k-pool.js';
import { templateLookup, findTemplate, getResponse } from './k-templates.js';
import { logExchange } from './k-chain.js';

// Fallback templates when corpus not available
const FALLBACK_TEMPLATES = {
  hearts_light: ["I hear you. What would feel supportive right now?"],
  hearts_dark: ["That sounds difficult. I'm here to listen."],
  hearts_neutral: ["I'm listening. What's on your mind?"],
  spades_light: ["Let me break that down systematically."],
  spades_dark: ["Let's debug this. What's the exact issue?"],
  spades_neutral: ["Let me think through this."],
  diamonds_light: ["Here's the information you need."],
  diamonds_dark: ["Let me help you find what's missing."],
  diamonds_neutral: ["The data breaks down as follows..."],
  clubs_light: ["Let's build that. First step..."],
  clubs_dark: ["Let's fix this. The action needed is..."],
  clubs_neutral: ["Here's what to do next..."]
};

/**
 * Execute a routed query
 */
export async function execute(routedQuery, options = {}) {
  const { handler, kVector, query } = routedQuery;
  const { tier, template: templateKey } = handler;

  // Force local overrides everything
  if (options.forceLocal) {
    return await executeLocal(query, kVector, options);
  }

  // Template path (instant, free) — try corpus first
  if (tier === 'template') {
    // Try the_speech corpus lookup
    const corpusResult = templateLookup(query, options.voice || 'default');
    if (corpusResult) {
      return {
        response: corpusResult.response,
        tier: 'template',
        template: corpusResult.template,
        tokens: 0,
        cost: 0,
        kVector: corpusResult.kVector || kVector
      };
    }

    // Fallback to suit-based templates
    if (templateKey && FALLBACK_TEMPLATES[templateKey]) {
      const responses = FALLBACK_TEMPLATES[templateKey];
      const response = responses[Math.floor(Math.random() * responses.length)];
      return {
        response,
        tier: 'template',
        tokens: 0,
        cost: 0,
        kVector
      };
    }
  }

  // Local model path (Ollama)
  if (tier === 'local') {
    return await executeLocal(query, kVector, options);
  }

  // API path (escalation)
  return await executeAPI(query, kVector, options);
}

/**
 * Execute via local Ollama
 */
async function executeLocal(query, kVector, options = {}) {
  const model = options.model || 'gemma3:27b';
  const endpoint = 'http://localhost:11434/api/generate';

  const systemPrompt = buildSystemPrompt(kVector);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: query,
        system: systemPrompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return {
      response: data.response,
      tier: 'local',
      model,
      tokens: data.eval_count || 0,
      cost: 0,
      kVector
    };
  } catch (err) {
    // Fallback to template if local fails
    console.warn('Local model unavailable, falling back to template');
    const templateKey = `${kVector.suit}_neutral`;
    if (TEMPLATES[templateKey]) {
      const responses = TEMPLATES[templateKey];
      return {
        response: responses[0],
        tier: 'template',
        tokens: 0,
        cost: 0,
        kVector,
        fallback: true
      };
    }
    throw err;
  }
}

/**
 * Execute via pooled API
 */
async function executeAPI(query, kVector, options = {}) {
  const key = getNextKey(options.provider);

  if (!key) {
    // No API keys available, fall back to local
    return await executeLocal(query, kVector, options);
  }

  if (key.local) {
    // Pool returned local as fallback
    return await executeLocal(query, kVector, options);
  }

  const systemPrompt = buildSystemPrompt(kVector);

  try {
    let response, data, tokens;

    if (key.provider === 'google') {
      response = await fetch(`${key.endpoint}?key=${key.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nUser: ${query}` }] }]
        })
      });
      data = await response.json();
      tokens = data.usageMetadata?.totalTokenCount || 100;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      recordUsage(key.id, tokens);
      return { response: text, tier: 'api', provider: key.provider, tokens, cost: 0, kVector };
    }

    if (key.provider === 'anthropic') {
      response = await fetch(key.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key.key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: options.model || 'claude-3-haiku-20240307',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: query }]
        })
      });
      data = await response.json();
      tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
      recordUsage(key.id, tokens);
      return {
        response: data.content?.[0]?.text || '',
        tier: 'api',
        provider: key.provider,
        tokens,
        cost: tokens * 0.00000025, // Haiku pricing
        kVector
      };
    }

    if (key.provider === 'openrouter') {
      response = await fetch(key.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key.key}`
        },
        body: JSON.stringify({
          model: options.model || 'google/gemma-2-9b-it:free',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
          ]
        })
      });
      data = await response.json();
      tokens = data.usage?.total_tokens || 100;
      recordUsage(key.id, tokens);
      return {
        response: data.choices?.[0]?.message?.content || '',
        tier: 'api',
        provider: key.provider,
        tokens,
        cost: 0, // Free models
        kVector
      };
    }

    throw new Error(`Unknown provider: ${key.provider}`);
  } catch (err) {
    markUnhealthy(key.id);
    // Try next key or fall back to local
    return await executeLocal(query, kVector, options);
  }
}

/**
 * Build system prompt based on K-vector
 */
function buildSystemPrompt(kVector) {
  const suitPrompts = {
    hearts: 'You are a warm, empathetic assistant focused on emotional support and connection.',
    spades: 'You are a precise, analytical assistant focused on logic, reasoning, and problem-solving.',
    diamonds: 'You are a knowledgeable assistant focused on data, information, and clear explanations.',
    clubs: 'You are an action-oriented assistant focused on creating, building, and getting things done.',
    unknown: 'You are a helpful assistant. Be concise and direct.'
  };

  const polarityPrompts = {
    '+': 'Approach this constructively and optimistically.',
    '-': 'Acknowledge difficulties while remaining helpful.',
    '~': 'Be balanced and neutral in your approach.'
  };

  const rankPrompts = kVector.rank >= 10
    ? 'This is a complex topic. Provide thorough, nuanced responses.'
    : kVector.rank <= 4
      ? 'Keep your response simple and direct.'
      : 'Provide a balanced level of detail.';

  return [
    suitPrompts[kVector.suit] || suitPrompts.unknown,
    polarityPrompts[kVector.polarity] || '',
    rankPrompts,
    `[K-vector: ${kVector.shorthand}]`
  ].join(' ');
}

/**
 * Quick inference (single function call)
 */
export async function infer(query, options = {}) {
  const { routeQuery } = await import('./k-inference.js');
  const routed = await routeQuery(query, options);
  const result = await execute(routed, options);

  // Log to golden chain (unless disabled)
  if (!options.noLog) {
    try {
      logExchange(query, result.response, result.kVector, {
        tier: result.tier,
        tokens: result.tokens,
        cost: result.cost
      });
    } catch (e) {
      // Don't fail on logging errors
    }
  }

  return result;
}
