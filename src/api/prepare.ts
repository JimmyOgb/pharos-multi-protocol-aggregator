import type { IncomingMessage, ServerResponse } from 'http';
import { MultiProtocolAggregator } from '../core/aggregator.ts';
import type { ActionPreparationRequest, ProtocolId, ActionType } from '../types/index.ts';

const VALID_PROTOCOLS: readonly ProtocolId[] = [
  'wpros',
  'faroo-stpros',
  'uniswap-v2-pros',
  'harbor-apc3m',
];

const VALID_OPERATIONS: readonly ActionType[] = [
  'DEPOSIT',
  'WITHDRAW',
  'WRAP',
  'UNWRAP',
  'STAKE',
  'UNSTAKE',
  'APPROVE',
  'ADD_LIQUIDITY',
  'REMOVE_LIQUIDITY',
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
      let params: Partial<ActionPreparationRequest> = {};

      if (req.method === 'POST') {
        if (!body.trim()) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Missing JSON request body. Provide protocolId, operation, amount, and userAddress.',
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
          protocolId: (url.searchParams.get('protocolId') as any) || undefined,
          operation: (url.searchParams.get('operation') as any) || undefined,
          amount: url.searchParams.get('amount') || undefined,
          userAddress: url.searchParams.get('userAddress') || undefined,
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

      if (!VALID_PROTOCOLS.includes(params.protocolId as ProtocolId)) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            error: `Invalid protocolId '${params.protocolId}'. Supported protocols: ${VALID_PROTOCOLS.join(', ')}`,
          })
        );
        return;
      }

      if (!VALID_OPERATIONS.includes(params.operation.toUpperCase() as ActionType)) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            error: `Invalid operation '${params.operation}'. Supported operations: ${VALID_OPERATIONS.join(', ')}`,
          })
        );
        return;
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(params.userAddress)) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            error: `Invalid userAddress '${params.userAddress}'. Must be a 40-hex character EVM address.`,
          })
        );
        return;
      }

      const prepRequest: ActionPreparationRequest = {
        protocolId: params.protocolId as ProtocolId,
        operation: params.operation.toUpperCase() as ActionType,
        amount: String(params.amount),
        userAddress: params.userAddress,
        receiverAddress: params.receiverAddress,
      };

      const aggregator = new MultiProtocolAggregator();
      const unsignedTx = await aggregator.prepareAction(prepRequest);

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, transaction: unsignedTx }, null, 2));
    } catch (err: any) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, error: err.message || 'Action preparation failed' }));
    }
  });
}
