import type { IncomingMessage, ServerResponse } from 'http';
import { MultiProtocolAggregator } from '../core/aggregator.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end(
      JSON.stringify({
        success: false,
        error: `Method Not Allowed: ${req.method}. Supported methods: GET`,
      })
    );
    return;
  }

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const address = url.searchParams.get('address');

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        success: false,
        error: "Invalid or missing 'address' query parameter. Provide a 40-hex character EVM address (e.g. 0x...).",
      })
    );
    return;
  }

  const aggregator = new MultiProtocolAggregator();

  try {
    const positions = await aggregator.getUserPositions(address);
    res.statusCode = 200;
    res.end(
      JSON.stringify(
        {
          success: true,
          address,
          timestamp: new Date().toISOString(),
          positions,
        },
        null,
        2
      )
    );
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }));
  }
}
