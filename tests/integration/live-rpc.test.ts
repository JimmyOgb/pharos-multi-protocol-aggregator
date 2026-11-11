import test from 'node:test';
import assert from 'node:assert/strict';
import { PharosRpcClient, PHAROS_CHAIN_ID } from '../../src/core/rpc-client.ts';
import { MultiProtocolAggregator } from '../../src/core/aggregator.ts';

test('Live RPC Integration: Connects to Pharos Pacific Mainnet (1672)', async () => {
  const rpc = new PharosRpcClient();
  const block = await rpc.getBlockNumber();
  assert.ok(block > 22000000, `Expected block height > 22M, got ${block}`);
});

test('Live RPC Integration: Fetches Real Metrics for WPROS and Faroo stPROS', async () => {
  const aggregator = new MultiProtocolAggregator();
  const venues = await aggregator.getAllVenues();

  assert.equal(venues.length, 4);

  const wpros = venues.find((v) => v.id === 'wpros');
  assert.ok(wpros);
  assert.equal(wpros.status, 'ONLINE');
  assert.equal(wpros.dataFreshness, 'LIVE');
  assert.ok(BigInt(wpros.metrics.tvlRaw) > 20000000n * 10n ** 18n); // > 20M PROS

  const faroo = venues.find((v) => v.id === 'faroo-stpros');
  assert.ok(faroo);
  assert.equal(faroo.status, 'ONLINE');
  assert.equal(faroo.dataFreshness, 'LIVE');
  assert.ok(BigInt(faroo.metrics.tvlRaw) > 5000000n * 10n ** 18n); // > 5M PROS
  assert.ok(faroo.metrics.exchangeRate >= 1.0);
  assert.equal(faroo.metrics.unbondingPeriodDays, 1.0);
});

test('Live RPC Integration: Queries Real User Positions (Empty State Test)', async () => {
  const aggregator = new MultiProtocolAggregator();
  const testAddr = '0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2';
  const positions = await aggregator.getUserPositions(testAddr);

  assert.equal(positions.length, 4);
  for (const pos of positions) {
    assert.ok(pos.formattedBalance);
    assert.equal(pos.dataFreshness, 'LIVE');
  }
});
