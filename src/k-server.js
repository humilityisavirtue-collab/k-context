/**
 * K-Server: HTTP API for K-inference
 *
 * Endpoints:
 * - POST /route   — K-classify a query (no execution)
 * - POST /ask     — Full inference pipeline
 * - GET  /stats   — Pool statistics
 * - POST /pool    — Manage API keys
 *
 * Run: k-context serve --port 3000
 */

import { createServer } from 'http';
import { classifyQuery, routeQuery } from './k-inference.js';
import { execute } from './k-execute.js';
import { getPoolStats, addKey, listKeys, removeKey } from './k-pool.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

/**
 * Parse JSON body from request
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJSON(res, data, status = 200) {
  res.writeHead(status, CORS_HEADERS);
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Send error response
 */
function sendError(res, message, status = 400) {
  res.writeHead(status, CORS_HEADERS);
  res.end(JSON.stringify({ error: message }));
}

/**
 * Handle routes
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  try {
    // GET /health — Health check
    if (method === 'GET' && path === '/health') {
      sendJSON(res, { status: 'ok', version: '0.3.0' });
      return;
    }

    // GET /stats — Pool statistics
    if (method === 'GET' && path === '/stats') {
      const stats = getPoolStats();
      sendJSON(res, stats);
      return;
    }

    // GET /keys — List API keys (masked)
    if (method === 'GET' && path === '/keys') {
      const keys = listKeys();
      sendJSON(res, { keys });
      return;
    }

    // POST /route — Classify query without execution
    if (method === 'POST' && path === '/route') {
      const body = await parseBody(req);
      if (!body.query) {
        sendError(res, 'Missing query field');
        return;
      }
      const kVector = classifyQuery(body.query);
      sendJSON(res, {
        query: body.query,
        kVector,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // POST /ask — Full inference
    if (method === 'POST' && path === '/ask') {
      const body = await parseBody(req);
      if (!body.query) {
        sendError(res, 'Missing query field');
        return;
      }

      const routed = await routeQuery(body.query);
      const result = await execute(routed, {
        forceLocal: body.local || false,
        model: body.model || null,
        provider: body.provider || null
      });

      sendJSON(res, {
        query: body.query,
        response: result.response,
        kVector: result.kVector,
        tier: result.tier,
        tokens: result.tokens,
        cost: result.cost || 0,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // POST /batch — Batch inference
    if (method === 'POST' && path === '/batch') {
      const body = await parseBody(req);
      if (!body.queries || !Array.isArray(body.queries)) {
        sendError(res, 'Missing queries array');
        return;
      }

      const results = await Promise.all(
        body.queries.map(async (query) => {
          const routed = await routeQuery(query);
          const result = await execute(routed, {
            forceLocal: body.local || false
          });
          return {
            query,
            response: result.response,
            kVector: result.kVector,
            tier: result.tier,
            tokens: result.tokens
          };
        })
      );

      sendJSON(res, {
        results,
        totalTokens: results.reduce((sum, r) => sum + r.tokens, 0),
        timestamp: new Date().toISOString()
      });
      return;
    }

    // POST /pool/add — Add API key
    if (method === 'POST' && path === '/pool/add') {
      const body = await parseBody(req);
      if (!body.provider || !body.key) {
        sendError(res, 'Missing provider or key');
        return;
      }
      const entry = addKey(body.provider, body.key, body.label);
      sendJSON(res, { success: true, id: entry.id });
      return;
    }

    // POST /pool/remove — Remove API key
    if (method === 'POST' && path === '/pool/remove') {
      const body = await parseBody(req);
      if (!body.id) {
        sendError(res, 'Missing key id');
        return;
      }
      removeKey(body.id);
      sendJSON(res, { success: true });
      return;
    }

    // 404
    sendError(res, `Not found: ${method} ${path}`, 404);

  } catch (err) {
    console.error('Server error:', err);
    sendError(res, err.message, 500);
  }
}

/**
 * Start the server
 */
export function startServer(port = 3000, host = '0.0.0.0') {
  const server = createServer(handleRequest);

  server.listen(port, host, () => {
    console.log(`K-Context server running at http://${host}:${port}`);
    console.log();
    console.log('Endpoints:');
    console.log('  GET  /health     — Health check');
    console.log('  GET  /stats      — Pool statistics');
    console.log('  GET  /keys       — List API keys');
    console.log('  POST /route      — K-classify query');
    console.log('  POST /ask        — Full inference');
    console.log('  POST /batch      — Batch inference');
    console.log('  POST /pool/add   — Add API key');
    console.log('  POST /pool/remove — Remove API key');
    console.log();
    console.log('Example:');
    console.log('  curl -X POST http://localhost:' + port + '/ask \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"query": "What is 2+2?"}\'');
  });

  return server;
}

/**
 * Stop the server gracefully
 */
export function stopServer(server) {
  return new Promise((resolve) => {
    server.close(resolve);
  });
}
