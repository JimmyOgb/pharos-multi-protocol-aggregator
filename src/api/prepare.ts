import type { IncomingMessage, ServerResponse } from 'http';
import { MultiProtocolAggregator } from '../core/aggregator.ts';
import type { ActionPreparationRequest } from '../types/index.ts';

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
      let params: ActionPreparationRequest;

      if (req.method === 'POST' && body.trim()) {
        params = JSON.parse(body);
      } else {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        params = {
          protocolId: url.searchParams.get('protocolId') as any,
          operation: (url.searchParams.get('operation') as any) || 'DEPOSIT',
          amount: url.searchParams.get('amount') || '1',
          userAddress: url.searchParams.get('userAddress') || '0x0000000000000000000000000000000000000001',
          receiverAddress: url.searchParams.get('receiverAddress') || undefined,
        };
      }

      if (!params.protocolId || !params.operation || !params.amount || !params.userAddress) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            error: 'Missing required parameters: protocolId, operation, amount, userAddress',
          })
        );
        return;
      }

      const aggregator = new MultiProtocolAggregator();
      const unsignedTx = await aggregator.prepareAction(params);

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, transaction: unsignedTx }, null, 2));
    } catch (err: any) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  });
}
