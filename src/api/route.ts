import type { IncomingMessage, ServerResponse } from 'http';
import { MultiProtocolAggregator } from '../core/aggregator.ts';
import type { UserRoutingRequest } from '../types/index.ts';

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

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      let params: UserRoutingRequest;

      if (req.method === 'POST' && body.trim()) {
        params = JSON.parse(body);
      } else {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        params = {
          asset: url.searchParams.get('asset') || 'PROS',
          amount: url.searchParams.get('amount') || '10',
          priority: (url.searchParams.get('priority') as any) || 'MAX_YIELD',
          maxLockupDays: url.searchParams.get('maxLockupDays')
            ? parseInt(url.searchParams.get('maxLockupDays')!, 10)
            : undefined,
        };
      }

      const aggregator = new MultiProtocolAggregator();
      const decision = await aggregator.findBestVenue(params);

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, decision }, null, 2));
    } catch (err: any) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  });
}
