import test from 'node:test';
import assert from 'node:assert/strict';
import { MultiProtocolAggregator } from '../../src/core/aggregator.ts';

test('Requirement 4 Isolation Test: One Unavailable Protocol Does Not Break the Others', async () => {
  const aggregator = new MultiProtocolAggregator();

  // 1. Inject simulated timeout into Faroo stPROS
  aggregator.setFaultInjection('faroo-stpros', 'TIMEOUT');

  // 2. Query all venues concurrently
  const venues = await aggregator.getAllVenues(true);

  // 3. Faroo must be UNAVAILABLE with error diagnostic
  const faroo = venues.find((v) => v.id === 'faroo-stpros');
  assert.ok(faroo);
  assert.equal(faroo.status, 'UNAVAILABLE');
  assert.ok(faroo.errorMessage?.includes('timed out'));

  // 4. WPROS and Uniswap must remain ONLINE with genuine live data
  const wpros = venues.find((v) => v.id === 'wpros');
  assert.ok(wpros);
  assert.equal(wpros.status, 'ONLINE');
  assert.equal(wpros.dataFreshness, 'LIVE');
  assert.ok(BigInt(wpros.metrics.tvlRaw) > 0n);

  const uni = venues.find((v) => v.id === 'uniswap-v2-pros');
  assert.ok(uni);
  assert.equal(uni.status, 'ONLINE');

  // 5. Intelligent routing under MAX_YIELD must failover to highest surviving yield venue
  const yieldDecision = await aggregator.findBestVenue({
    asset: 'PROS',
    amount: '50',
    priority: 'MAX_YIELD',
  });

  assert.ok(yieldDecision.selectedVenue);
  // Faroo must be excluded
  const farooEval = yieldDecision.evaluations.find((e) => e.venueId === 'faroo-stpros');
  assert.equal(farooEval?.isEligible, false);
  assert.ok(farooEval?.exclusionReason?.includes('UNAVAILABLE'));
  // Failover selects the highest yield surviving venue (Uniswap V2 or WPROS)
  assert.ok(['uniswap-v2-pros', 'wpros'].includes(yieldDecision.selectedVenue.id));

  // 6. Intelligent routing under INSTANT_LIQUIDITY must route to WPROS
  const liquidityDecision = await aggregator.findBestVenue({
    asset: 'PROS',
    amount: '50',
    priority: 'INSTANT_LIQUIDITY',
  });
  assert.ok(liquidityDecision.selectedVenue);
  assert.equal(liquidityDecision.selectedVenue.id, 'wpros');

  // 7. Clear fault injection and verify complete recovery
  aggregator.setFaultInjection('faroo-stpros', null);
  const recoveredVenues = await aggregator.getAllVenues(true);
  const recoveredFaroo = recoveredVenues.find((v) => v.id === 'faroo-stpros');
  assert.equal(recoveredFaroo?.status, 'ONLINE');
});
