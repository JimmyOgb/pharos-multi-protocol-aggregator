import test from 'node:test';
import assert from 'node:assert/strict';
import { MultiProtocolAggregator } from '../../src/core/aggregator.ts';
import type { ProtocolVenue } from '../../src/types/index.ts';

const mockVenues: ProtocolVenue[] = [
  {
    id: 'wpros',
    name: 'Wrapped PROS Canonical Native Vault',
    category: 'Liquid Native Wrapper',
    protocolWebsite: 'https://docs.pharos.xyz',
    contractAddress: '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0',
    network: 'Pharos Pacific Mainnet',
    chainId: 1672,
    underlyingAsset: 'PROS',
    underlyingAssetAddress: '0x0000000000000000000000000000000000000000',
    shareAsset: 'WPROS',
    status: 'ONLINE',
    metrics: {
      tvlRaw: '22399104000000000000000000',
      tvlFormatted: '22,399,104 PROS',
      baseApyPercent: 0.0,
      netApyPercent: 0.0,
      exchangeRate: 1.0,
      exchangeRateDescription: '1 WPROS = 1.0000 PROS',
      unbondingPeriodSeconds: 0,
      unbondingPeriodDays: 0,
      lockupDurationSeconds: 0,
      lockupDurationDays: 0,
      depositFeeBps: 0,
      withdrawalFeeBps: 0,
      minDepositFormatted: '0.0001 PROS',
      riskTier: 'LOW',
      riskSummary: 'Zero credit risk',
    },
    supportedActions: ['DEPOSIT', 'WITHDRAW'],
    dataFreshness: 'LIVE',
    lastObservedAt: new Date().toISOString(),
    verifiedSource: 'Mock RPC',
  },
  {
    id: 'faroo-stpros',
    name: 'Faroo Liquid Staking Protocol (stPROS)',
    category: 'Liquid Staking (ERC-4626)',
    protocolWebsite: 'https://faroo.org',
    contractAddress: '0x6b0a44c64190279f7034b77c13a566e914fe5ec4',
    network: 'Pharos Pacific Mainnet',
    chainId: 1672,
    underlyingAsset: 'WPROS',
    underlyingAssetAddress: '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0',
    shareAsset: 'stPROS',
    status: 'ONLINE',
    metrics: {
      tvlRaw: '5122346000000000000000000',
      tvlFormatted: '5,122,346 WPROS',
      baseApyPercent: 7.2,
      netApyPercent: 7.2,
      exchangeRate: 1.008833,
      exchangeRateDescription: '1 stPROS = 1.008833 PROS',
      unbondingPeriodSeconds: 86400,
      unbondingPeriodDays: 1.0,
      lockupDurationSeconds: 86400,
      lockupDurationDays: 1.0,
      depositFeeBps: 0,
      withdrawalFeeBps: 10,
      minDepositFormatted: '0.01 WPROS',
      riskTier: 'MEDIUM',
      riskSummary: 'Validator staking',
    },
    supportedActions: ['DEPOSIT', 'WITHDRAW', 'REDEEM'],
    dataFreshness: 'LIVE',
    lastObservedAt: new Date().toISOString(),
    verifiedSource: 'Mock RPC',
  },
  {
    id: 'uniswap-v2-pros',
    name: 'Uniswap V2 WPROS Pool',
    category: 'AMM Liquidity Pool',
    protocolWebsite: 'https://docs.pharos.xyz',
    contractAddress: '0x0a438d3ecebb6c4221dd54905c7329975e88584f',
    network: 'Pharos Pacific Mainnet',
    chainId: 1672,
    underlyingAsset: 'WPROS',
    underlyingAssetAddress: '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0',
    shareAsset: 'UNI-V2',
    status: 'ONLINE',
    metrics: {
      tvlRaw: '1731000000000000000000',
      tvlFormatted: '1,731 WPROS',
      baseApyPercent: 4.8,
      netApyPercent: 4.8,
      exchangeRate: 1.0,
      exchangeRateDescription: 'AMM Constant Product',
      unbondingPeriodSeconds: 0,
      unbondingPeriodDays: 0,
      lockupDurationSeconds: 0,
      lockupDurationDays: 0,
      depositFeeBps: 0,
      withdrawalFeeBps: 0,
      minDepositFormatted: '1.0 WPROS',
      riskTier: 'HIGH',
      riskSummary: 'AMM pool',
    },
    supportedActions: ['DEPOSIT', 'WITHDRAW'],
    dataFreshness: 'LIVE',
    lastObservedAt: new Date().toISOString(),
    verifiedSource: 'Mock RPC',
  },
  {
    id: 'harbor-apc3m',
    name: 'Harbor Axil Prime Credit 3M',
    category: 'RWA Fixed Income Credit',
    protocolWebsite: 'https://port.pharos.xyz',
    contractAddress: '0x946dc10e5d56a3d7619859be53f99d3e4e3c4cef',
    network: 'Pharos Pacific Mainnet',
    chainId: 1672,
    underlyingAsset: 'USDC',
    underlyingAssetAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815',
    shareAsset: 'APC3M',
    status: 'ONLINE',
    metrics: {
      tvlRaw: '18000000000000',
      tvlFormatted: '18,000,000 USDC',
      baseApyPercent: 13.0,
      netApyPercent: 13.0,
      exchangeRate: 1.0,
      exchangeRateDescription: 'Fixed income yield',
      unbondingPeriodSeconds: 7776000,
      unbondingPeriodDays: 90,
      lockupDurationSeconds: 7776000,
      lockupDurationDays: 90,
      depositFeeBps: 0,
      withdrawalFeeBps: 0,
      minDepositFormatted: '100 USDC',
      riskTier: 'HIGH',
      riskSummary: 'Corporate credit strategy',
    },
    supportedActions: ['DEPOSIT'],
    dataFreshness: 'LIVE',
    lastObservedAt: new Date().toISOString(),
    verifiedSource: 'Mock RPC',
  },
];

test('Routing Engine (Unit): Selects Faroo stPROS when Priority is MAX_YIELD', () => {
  const aggregator = new MultiProtocolAggregator();
  const decision = aggregator.evaluateVenues(mockVenues, {
    asset: 'PROS',
    amount: '100',
    priority: 'MAX_YIELD',
  });

  assert.ok(decision.selectedVenue);
  assert.equal(decision.selectedVenue.id, 'faroo-stpros');
  assert.ok(decision.selectedVenue.metrics.netApyPercent > 5.0);
  assert.ok(decision.detailedReasoning.length > 0);
  assert.ok(decision.tradeOffs.length > 0);
  assert.ok(decision.tradeOffs.some((t) => t.toLowerCase().includes('unbonding')));
});

test('Routing Engine (Unit): Selects WPROS when Priority is INSTANT_LIQUIDITY', () => {
  const aggregator = new MultiProtocolAggregator();
  const decision = aggregator.evaluateVenues(mockVenues, {
    asset: 'PROS',
    amount: '100',
    priority: 'INSTANT_LIQUIDITY',
  });

  assert.ok(decision.selectedVenue);
  assert.equal(decision.selectedVenue.id, 'wpros');
  assert.equal(decision.selectedVenue.metrics.unbondingPeriodDays, 0);
  assert.ok(decision.detailedReasoning.some((r) => r.toLowerCase().includes('instant liquidity')));
});

test('Routing Engine (Unit): Excludes Incompatible Assets', () => {
  const aggregator = new MultiProtocolAggregator();
  const decision = aggregator.evaluateVenues(mockVenues, {
    asset: 'USDC',
    amount: '500',
    priority: 'MAX_YIELD',
  });

  assert.ok(decision.selectedVenue);
  assert.equal(decision.selectedVenue.id, 'harbor-apc3m');

  const wprosEval = decision.evaluations.find((e) => e.venueId === 'wpros');
  assert.equal(wprosEval?.isEligible, false);
  assert.ok(wprosEval?.exclusionReason?.includes('Asset mismatch'));
});
