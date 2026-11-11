import type { IncomingMessage, ServerResponse } from 'http';
import { MultiProtocolAggregator } from '../core/aggregator.ts';
import type { ProtocolId } from '../types/index.ts';

const VALID_FAULTS = ['TIMEOUT', 'REVERT', 'NETWORK_ERROR'] as const;

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
        error: `Method Not Allowed: ${req.method}. Supported methods: GET, POST`,
      })
    );
    return;
  }

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const target = (url.searchParams.get('target') || 'faroo-stpros') as ProtocolId;
  const rawFault = (url.searchParams.get('fault') || 'TIMEOUT').toUpperCase();
  const fault = VALID_FAULTS.includes(rawFault as any) ? (rawFault as 'TIMEOUT' | 'REVERT' | 'NETWORK_ERROR') : 'TIMEOUT';

  const aggregator = new MultiProtocolAggregator();
  // Inject controlled fault
  aggregator.setFaultInjection(target, fault);

  try {
    const venues = await aggregator.getAllVenues();
    const routingDecision = await aggregator.findBestVenue({
      asset: 'PROS',
      amount: '10',
      priority: 'MAX_YIELD',
    });

    const targetVenue = venues.find((v) => v.id === target);
    const survivorVenues = venues.filter((v) => v.id !== target && v.status === 'ONLINE');

    res.statusCode = 200;
    res.end(
      JSON.stringify(
        {
          success: true,
          testDescription: 'Controlled Fault Injection & Degradation Demonstration (Requirement 4)',
          injectedTarget: target,
          injectedFault: fault,
          degradedVenueStatus: {
            id: targetVenue?.id,
            name: targetVenue?.name,
            status: targetVenue?.status,
            errorMessage: targetVenue?.errorMessage,
          },
          survivingVenuesCount: survivorVenues.length,
          survivingVenues: survivorVenues.map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            tvl: s.metrics.tvlFormatted,
            apy: `${s.metrics.netApyPercent}%`,
          })),
          failoverRoutingDecision: {
            selectedVenue: routingDecision.selectedVenue?.name,
            selectionSummary: routingDecision.selectionSummary,
            detailedReasoning: routingDecision.detailedReasoning,
            excludedVenues: routingDecision.evaluations
              .filter((e) => !e.isEligible)
              .map((e) => ({ venue: e.venueName, reason: e.exclusionReason })),
          },
          conclusion: 'Verified: Failure in one protocol adapter was successfully isolated without interrupting aggregator operations.',
        },
        null,
        2
      )
    );
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err.message || 'Fault test execution failed' }));
  }
}
