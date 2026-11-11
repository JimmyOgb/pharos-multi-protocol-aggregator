import type { IncomingMessage, ServerResponse } from 'http';
import { MultiProtocolAggregator } from '../core/aggregator.ts';
import type { UserRoutingRequest, RoutingPriority } from '../types/index.ts';

const VALID_PRIORITIES: readonly RoutingPriority[] = [
  'MAX_YIELD',
  'INSTANT_LIQUIDITY',
  'MIN_LOCKUP',
  'LOW_RISK',
  'CAPITAL_PRESERVATION',
];

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405;
    res.end(
      JSON.stringify({
        success: false,
        error: `Method Not Allowed: ${req.method}. Supported methods: POST, GET`,
      })
    );
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      let params: Partial<UserRoutingRequest> = {};

      if (req.method === 'POST') {
        if (!body.trim()) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Missing JSON request body. Provide asset, amount, and optional priority.',
            })
          );
          return;
        }

        try {
          params = JSON.parse(body);
        } catch (jsonErr: any) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              error: `Invalid JSON payload: ${jsonErr.message}`,
            })
          );
          return;
        }
      } else {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        params = {
          asset: url.searchParams.get('asset') || undefined,
          amount: url.searchParams.get('amount') || undefined,
          priority: (url.searchParams.get('priority') as RoutingPriority) || undefined,
          maxLockupDays: url.searchParams.get('maxLockupDays')
            ? parseInt(url.searchParams.get('maxLockupDays')!, 10)
            : undefined,
        };
      }

      // Input Validation
      const asset = (params.asset || 'PROS').trim().toUpperCase();
      const amountStr = params.amount !== undefined ? String(params.amount).trim() : '10';
      const parsedAmount = parseFloat(amountStr);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            error: `Invalid 'amount' parameter: must be a positive number. Received '${amountStr}'.`,
          })
        );
        return;
      }

      let priority: RoutingPriority = 'MAX_YIELD';
      if (params.priority) {
        if (!VALID_PRIORITIES.includes(params.priority)) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              error: `Invalid 'priority' parameter. Valid choices are: ${VALID_PRIORITIES.join(', ')}.`,
            })
          );
          return;
        }
        priority = params.priority;
      }

      const routingRequest: UserRoutingRequest = {
        asset,
        amount: amountStr,
        priority,
        maxLockupDays: params.maxLockupDays,
      };

      const aggregator = new MultiProtocolAggregator();
      const decision = await aggregator.findBestVenue(routingRequest);

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, decision }, null, 2));
    } catch (err: any) {
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }));
    }
  });
}
