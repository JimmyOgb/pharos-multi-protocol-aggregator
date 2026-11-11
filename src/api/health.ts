import type { IncomingMessage, ServerResponse } from 'http';
import { MultiProtocolAggregator } from '../core/aggregator.ts';
import { PHAROS_CHAIN_ID } from '../core/rpc-client.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const aggregator = new MultiProtocolAggregator();

  try {
    const venues = await aggregator.getAllVenues();
    const onlineCount = venues.filter((v) => v.status === 'ONLINE').length;

    const payload = {
      status: onlineCount > 0 ? 'HEALTHY' : 'DEGRADED',
      network: 'Pharos Pacific Mainnet',
      chainId: PHAROS_CHAIN_ID,
      timestamp: new Date().toISOString(),
      activeProtocols: onlineCount,
      totalIntegratedProtocols: venues.length,
      protocols: venues.map((v) => ({
        id: v.id,
        name: v.name,
        status: v.status,
        contract: v.contractAddress,
        tvl: v.metrics.tvlFormatted,
        apy: `${v.metrics.netApyPercent}%`,
        freshness: v.dataFreshness,
      })),
    };

    res.statusCode = 200;
    res.end(JSON.stringify(payload, null, 2));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ status: 'ERROR', error: err.message }));
  }
}
