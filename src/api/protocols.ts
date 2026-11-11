import type { IncomingMessage, ServerResponse } from 'http';
import { MultiProtocolAggregator } from '../core/aggregator.ts';

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
    res.statusCode = 200;
    res.end(
      JSON.stringify(
        {
          success: true,
          count: venues.length,
          timestamp: new Date().toISOString(),
          venues,
        },
        null,
        2
      )
    );
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}
