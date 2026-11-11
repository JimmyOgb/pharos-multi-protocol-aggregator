import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import type { IncomingMessage, ServerResponse } from 'http';

import healthHandler from '../../src/api/health.ts';
import protocolsHandler from '../../src/api/protocols.ts';
import positionsHandler from '../../src/api/positions.ts';
import routeHandler from '../../src/api/route.ts';
import prepareHandler from '../../src/api/prepare.ts';
import faultTestHandler from '../../src/api/fault-test.ts';

// Helper to simulate IncomingMessage and ServerResponse
function createMockHttp(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}) {
  const req = new EventEmitter() as unknown as IncomingMessage & EventEmitter;
  req.method = options.method || 'GET';
  req.url = options.url || '/';
  req.headers = options.headers || { host: 'localhost:3000' };

  let statusCode = 200;
  const headers: Record<string, string> = {};
  let responseData = '';

  let resolvePromise: (val: any) => void;
  const resPromise = new Promise<{ statusCode: number; headers: Record<string, string>; body: string; json: any }>(
    (resolve) => {
      resolvePromise = resolve;
    }
  );

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(val: number) {
      statusCode = val;
    },
    setHeader(name: string, val: string) {
      headers[name.toLowerCase()] = val;
    },
    end(chunk?: any) {
      if (chunk) responseData += chunk;
      let parsedJson = null;
      try {
        parsedJson = JSON.parse(responseData);
      } catch {
        // non-json body
      }
      resolvePromise({
        statusCode,
        headers,
        body: responseData,
        json: parsedJson,
      });
    },
  } as unknown as ServerResponse;

  // Execute handler in next tick and emit data
  process.nextTick(() => {
    if (options.body !== undefined) {
      req.emit('data', Buffer.from(options.body));
    }
    req.emit('end');
  });

  return { req, res, resPromise };
}

test('API /api/health: Supports GET with 200 and valid schema', async () => {
  const { req, res, resPromise } = createMockHttp({ method: 'GET', url: '/api/health' });
  healthHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 200);
  assert.equal(result.headers['content-type'], 'application/json');
  assert.ok(result.json);
  assert.ok(['HEALTHY', 'DEGRADED'].includes(result.json.status));
  assert.equal(result.json.chainId, 1672);
  assert.equal(result.json.network, 'Pharos Pacific Mainnet');
});

test('API /api/health: Rejects POST with 405 Method Not Allowed', async () => {
  const { req, res, resPromise } = createMockHttp({ method: 'POST', url: '/api/health' });
  healthHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 405);
  assert.equal(result.headers['content-type'], 'application/json');
  assert.ok(result.json);
  assert.equal(result.json.success, false);
  assert.match(result.json.error, /Method Not Allowed/);
});

test('API /api/protocols: Supports GET with 200 and returns active venues', async () => {
  const { req, res, resPromise } = createMockHttp({ method: 'GET', url: '/api/protocols' });
  protocolsHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 200);
  assert.equal(result.headers['content-type'], 'application/json');
  assert.ok(result.json);
  assert.equal(result.json.success, true);
  assert.ok(Array.isArray(result.json.venues));
  assert.equal(result.json.count, 4);
});

test('API /api/protocols: Rejects DELETE with 405 Method Not Allowed', async () => {
  const { req, res, resPromise } = createMockHttp({ method: 'DELETE', url: '/api/protocols' });
  protocolsHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 405);
  assert.ok(result.json);
  assert.equal(result.json.success, false);
});

test('API /api/positions: Returns 400 for missing address query parameter', async () => {
  const { req, res, resPromise } = createMockHttp({ method: 'GET', url: '/api/positions' });
  positionsHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 400);
  assert.equal(result.headers['content-type'], 'application/json');
  assert.ok(result.json);
  assert.equal(result.json.success, false);
  assert.match(result.json.error, /address/i);
});

test('API /api/positions: Returns 400 for invalid address format', async () => {
  const { req, res, resPromise } = createMockHttp({ method: 'GET', url: '/api/positions?address=not-an-address' });
  positionsHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 400);
  assert.ok(result.json);
  assert.equal(result.json.success, false);
});

test('API /api/positions: Supports GET with valid EVM address', async () => {
  const { req, res, resPromise } = createMockHttp({
    method: 'GET',
    url: '/api/positions?address=0x1111111111111111111111111111111111111111',
  });
  positionsHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 200);
  assert.ok(result.json);
  assert.equal(result.json.success, true);
  assert.equal(result.json.address, '0x1111111111111111111111111111111111111111');
  assert.ok(Array.isArray(result.json.positions));
});

test('API /api/route: Supports POST with valid JSON body', async () => {
  const { req, res, resPromise } = createMockHttp({
    method: 'POST',
    url: '/api/route',
    body: JSON.stringify({ asset: 'PROS', amount: '10', priority: 'MAX_YIELD' }),
  });
  routeHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 200);
  assert.equal(result.headers['content-type'], 'application/json');
  assert.ok(result.json);
  assert.equal(result.json.success, true);
  assert.ok(result.json.decision);
  assert.ok(result.json.decision.selectedVenue);
  assert.ok(['faroo-stpros', 'uniswap-v2-pros'].includes(result.json.decision.selectedVenue.id));
});

test('API /api/route: Returns 400 for malformed JSON body', async () => {
  const { req, res, resPromise } = createMockHttp({
    method: 'POST',
    url: '/api/route',
    body: '{"asset": "PROS", malformed',
  });
  routeHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 400);
  assert.ok(result.json);
  assert.equal(result.json.success, false);
  assert.match(result.json.error, /Invalid JSON/i);
});

test('API /api/route: Returns 400 for invalid amount', async () => {
  const { req, res, resPromise } = createMockHttp({
    method: 'POST',
    url: '/api/route',
    body: JSON.stringify({ asset: 'PROS', amount: '-5' }),
  });
  routeHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 400);
  assert.ok(result.json);
  assert.equal(result.json.success, false);
  assert.match(result.json.error, /positive number/i);
});

test('API /api/route: Returns 400 for invalid priority', async () => {
  const { req, res, resPromise } = createMockHttp({
    method: 'POST',
    url: '/api/route',
    body: JSON.stringify({ asset: 'PROS', amount: '10', priority: 'INVALID_PRIORITY' }),
  });
  routeHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 400);
  assert.ok(result.json);
  assert.equal(result.json.success, false);
  assert.match(result.json.error, /priority/i);
});

test('API /api/route: Rejects DELETE with 405 Method Not Allowed', async () => {
  const { req, res, resPromise } = createMockHttp({ method: 'DELETE', url: '/api/route' });
  routeHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 405);
  assert.ok(result.json);
  assert.equal(result.json.success, false);
  assert.match(result.json.error, /Method Not Allowed/i);
});

test('API /api/prepare: Returns 400 for missing required parameters', async () => {
  const { req, res, resPromise } = createMockHttp({
    method: 'POST',
    url: '/api/prepare',
    body: JSON.stringify({ protocolId: 'wpros' }),
  });
  prepareHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 400);
  assert.ok(result.json);
  assert.equal(result.json.success, false);
  assert.match(result.json.error, /Missing required parameters/i);
});

test('API /api/prepare: Returns 200 and unsigned tx for valid WPROS WRAP action', async () => {
  const { req, res, resPromise } = createMockHttp({
    method: 'POST',
    url: '/api/prepare',
    body: JSON.stringify({
      protocolId: 'wpros',
      operation: 'DEPOSIT',
      amount: '5',
      userAddress: '0x1111111111111111111111111111111111111111',
    }),
  });
  prepareHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 200);
  assert.ok(result.json);
  assert.equal(result.json.success, true);
  assert.ok(result.json.transaction);
  assert.equal(result.json.transaction.to, '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0');
  assert.equal(result.json.transaction.signed, false);
  assert.equal(result.json.transaction.broadcast, false);
});

test('API /api/fault-test: Executes controlled fault injection with 200', async () => {
  const { req, res, resPromise } = createMockHttp({
    method: 'GET',
    url: '/api/fault-test?target=faroo-stpros&fault=TIMEOUT',
  });
  faultTestHandler(req, res);
  const result = await resPromise;

  assert.equal(result.statusCode, 200);
  assert.ok(result.json);
  assert.equal(result.json.success, true);
  assert.equal(result.json.injectedTarget, 'faroo-stpros');
  assert.equal(result.json.injectedFault, 'TIMEOUT');
  assert.ok(['DEGRADED', 'UNAVAILABLE'].includes(result.json.degradedVenueStatus.status));
  assert.equal(result.json.survivingVenuesCount, 3);
});
