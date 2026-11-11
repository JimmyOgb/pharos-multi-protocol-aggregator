import { PharosRpcClient, PHAROS_CHAIN_ID, DEFAULT_PHAROS_RPC } from './rpc-client.ts';
import { BaseProtocolAdapter } from '../adapters/base-adapter.ts';
import { WPROSAdapter } from '../adapters/wpros-adapter.ts';
import { FarooStPROSAdapter } from '../adapters/faroo-stpros-adapter.ts';
import { UniswapV2Adapter } from '../adapters/uniswap-v2-adapter.ts';
import { HarborAPC3MAdapter } from '../adapters/harbor-apc3m-adapter.ts';
import type {
  ProtocolId,
  ProtocolVenue,
  UserPosition,
  UserRoutingRequest,
  RoutingDecision,
  VenueEvaluation,
  ActionPreparationRequest,
  UnsignedTransactionPayload,
} from '../types/index.ts';

export class MultiProtocolAggregator {
  private rpcClient: PharosRpcClient;
  private adapters: Map<ProtocolId, BaseProtocolAdapter>;

  constructor(rpcClient?: PharosRpcClient) {
    this.rpcClient = rpcClient || new PharosRpcClient();
    this.adapters = new Map();

    const wpros = new WPROSAdapter(this.rpcClient);
    const faroo = new FarooStPROSAdapter(this.rpcClient);
    const uni = new UniswapV2Adapter(this.rpcClient);
    const harbor = new HarborAPC3MAdapter(this.rpcClient);

    this.adapters.set('wpros', wpros);
    this.adapters.set('faroo-stpros', faroo);
    this.adapters.set('uniswap-v2-pros', uni);
    this.adapters.set('harbor-apc3m', harbor);
  }

  getAdapter(id: ProtocolId): BaseProtocolAdapter | undefined {
    return this.adapters.get(id);
  }

  setFaultInjection(id: ProtocolId, fault: 'TIMEOUT' | 'REVERT' | 'NETWORK_ERROR' | null): void {
    const adapter = this.adapters.get(id);
    if (adapter) {
      adapter.setInjectedFault(fault);
    }
  }

  async getAllVenues(forceLive = false): Promise<ProtocolVenue[]> {
    const promises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        return await adapter.fetchVenueInfo(forceLive);
      } catch (err: any) {
        return {
          id: adapter.getId() as ProtocolId,
          name: adapter.getName(),
          category: 'Liquid Native Wrapper' as any,
          protocolWebsite: 'https://docs.pharos.xyz',
          contractAddress: adapter.getContractAddress(),
          network: 'Pharos Pacific Mainnet',
          chainId: PHAROS_CHAIN_ID,
          underlyingAsset: 'UNKNOWN',
          underlyingAssetAddress: '0x0',
          shareAsset: 'UNKNOWN',
          status: 'UNAVAILABLE',
          errorMessage: err.message || 'Adapter execution failed',
          metrics: {
            tvlRaw: '0',
            tvlFormatted: '0',
            baseApyPercent: 0,
            netApyPercent: 0,
            exchangeRate: 1.0,
            exchangeRateDescription: 'Unavailable',
            unbondingPeriodSeconds: 0,
            unbondingPeriodDays: 0,
            lockupDurationSeconds: 0,
            lockupDurationDays: 0,
            depositFeeBps: 0,
            withdrawalFeeBps: 0,
            minDepositFormatted: '0',
            riskTier: 'HIGH',
            riskSummary: 'Protocol currently unavailable',
          },
          supportedActions: [],
          dataFreshness: 'STALE',
          lastObservedAt: new Date().toISOString(),
          verifiedSource: 'Failed adapter invocation',
        };
      }
    });

    return Promise.all(promises);
  }

  async getUserPositions(userAddress: string): Promise<UserPosition[]> {
    const promises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        return await adapter.fetchUserPosition(userAddress);
      } catch (err: any) {
        return {
          protocolId: adapter.getId() as ProtocolId,
          protocolName: adapter.getName(),
          contractAddress: adapter.getContractAddress(),
          assetSymbol: 'UNKNOWN',
          rawBalance: '0',
          formattedBalance: '0.0000 (Query Error)',
          underlyingValueFormatted: '0.0000',
          unbondingActive: false,
          canWithdrawImmediately: false,
          dataFreshness: 'STALE',
          observedAt: new Date().toISOString(),
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Pure deterministic routing evaluation logic
   */
  evaluateVenues(allVenues: ProtocolVenue[], request: UserRoutingRequest): RoutingDecision {
    const observationTime = new Date().toISOString();
    const reqAsset = request.asset.toUpperCase();
    const reqAmount = parseFloat(request.amount) || 0;
    const priority = request.priority || 'MAX_YIELD';

    const evaluations: VenueEvaluation[] = [];

    for (const venue of allVenues) {
      let isEligible = true;
      let exclusionReason: string | undefined;
      let score = 0;
      const pros: string[] = [];
      const cons: string[] = [];

      // 1. Availability Filter
      if (venue.status !== 'ONLINE') {
        isEligible = false;
        exclusionReason = `Protocol is ${venue.status}: ${venue.errorMessage || 'Health checks failing'}`;
        evaluations.push({
          venueId: venue.id,
          venueName: venue.name,
          score: -100,
          isEligible: false,
          exclusionReason,
          apyPercent: venue.metrics.netApyPercent,
          unbondingDays: venue.metrics.unbondingPeriodDays,
          tvlFormatted: venue.metrics.tvlFormatted,
          liquidityTier: venue.metrics.riskTier,
          pros: [],
          cons: [exclusionReason],
        });
        continue;
      }

      // 2. Asset Compatibility Check
      const venueUnderlying = venue.underlyingAsset.toUpperCase();
      const venueShare = venue.shareAsset.toUpperCase();
      const assetMatches =
        venueUnderlying === reqAsset ||
        venueShare === reqAsset ||
        (reqAsset === 'PROS' && (venueUnderlying === 'WPROS' || venueUnderlying === 'PROS')) ||
        (reqAsset === 'WPROS' && (venueUnderlying === 'WPROS' || venueUnderlying === 'PROS'));

      if (!assetMatches) {
        isEligible = false;
        exclusionReason = `Asset mismatch: venue accepts ${venue.underlyingAsset}, but user requested ${reqAsset}`;
        evaluations.push({
          venueId: venue.id,
          venueName: venue.name,
          score: -50,
          isEligible: false,
          exclusionReason,
          apyPercent: venue.metrics.netApyPercent,
          unbondingDays: venue.metrics.unbondingPeriodDays,
          tvlFormatted: venue.metrics.tvlFormatted,
          liquidityTier: venue.metrics.riskTier,
          pros: [],
          cons: [exclusionReason],
        });
        continue;
      }

      // 3. Lockup Constraints
      if (request.maxLockupDays !== undefined && venue.metrics.lockupDurationDays > request.maxLockupDays) {
        isEligible = false;
        exclusionReason = `Lockup restriction: venue requires ${venue.metrics.lockupDurationDays} days, user specified max ${request.maxLockupDays} days`;
        evaluations.push({
          venueId: venue.id,
          venueName: venue.name,
          score: -30,
          isEligible: false,
          exclusionReason,
          apyPercent: venue.metrics.netApyPercent,
          unbondingDays: venue.metrics.unbondingPeriodDays,
          tvlFormatted: venue.metrics.tvlFormatted,
          liquidityTier: venue.metrics.riskTier,
          pros: [],
          cons: [exclusionReason],
        });
        continue;
      }

      // 4. Scoring Algorithm based on User Priority
      const apy = venue.metrics.netApyPercent;
      const unbonding = venue.metrics.unbondingPeriodDays;
      const tvlRawBn = BigInt(venue.metrics.tvlRaw || '0');

      if (priority === 'MAX_YIELD') {
        score += apy * 15;
        score -= unbonding * 3;
        if (apy > 5.0) pros.push(`High annual staking/yield return of ${apy.toFixed(2)}% APY`);
        if (unbonding > 0) cons.push(`Requires ${unbonding.toFixed(1)} day unbonding window upon withdrawal`);
      } else if (priority === 'INSTANT_LIQUIDITY' || priority === 'MIN_LOCKUP') {
        score += (10 - unbonding) * 15;
        if (venue.metrics.riskTier === 'LOW') {
          score += 40;
          pros.push('Pure 1:1 reserve backing with 0% impermanent loss risk');
        } else if (venue.metrics.riskTier === 'HIGH') {
          score -= 30;
          cons.push('AMM pool carries impermanent loss and slippage risk');
        }
        if (unbonding === 0) pros.push('Immediate zero-wait liquidity and unwrapping');
        if (apy === 0) cons.push('0.0% base yield rate (pure reserve wrapper)');
      } else {
        // BALANCED
        score += apy * 8;
        score -= unbonding * 4;
        score += tvlRawBn > 1000000n ? 15 : 5;
      }

      // TVL Safety bonus
      if (tvlRawBn > 1000000n) {
        pros.push(`Substantial battle-tested TVL of ${venue.metrics.tvlFormatted}`);
      }

      evaluations.push({
        venueId: venue.id,
        venueName: venue.name,
        score,
        isEligible: true,
        apyPercent: apy,
        unbondingDays: unbonding,
        tvlFormatted: venue.metrics.tvlFormatted,
        liquidityTier: venue.metrics.riskTier,
        pros,
        cons,
      });
    }

    const eligible = evaluations.filter((e) => e.isEligible).sort((a, b) => b.score - a.score);
    const winningEval = eligible[0];
    const selectedVenue = winningEval ? allVenues.find((v) => v.id === winningEval.venueId) || null : null;

    let summary = '';
    const detailedReasoning: string[] = [];
    const tradeOffs: string[] = [];

    if (!selectedVenue) {
      summary = `No eligible venue found matching requested asset '${reqAsset}' and criteria.`;
      detailedReasoning.push(`All ${allVenues.length} candidate protocol venues were evaluated.`);
      detailedReasoning.push('Ineligible venues were excluded due to asset incompatibility or protocol unavailability.');
    } else {
      summary = `Selected ${selectedVenue.name} as optimal venue for ${reqAmount} ${reqAsset} (Priority: ${priority}).`;

      if (selectedVenue.id === 'faroo-stpros') {
        detailedReasoning.push(
          `Maximized Yield: Faroo stPROS delivers ~${selectedVenue.metrics.netApyPercent.toFixed(2)}% APY through compounding Pharos validator staking rewards.`
        );
        detailedReasoning.push(
          `Exchange-Rate Appreciation: Rather than rebasing, 1 stPROS currently equals ${selectedVenue.metrics.exchangeRate.toFixed(6)} PROS, continually accruing value.`
        );
        detailedReasoning.push(
          `Deep On-Chain Reserve: Backed by ${selectedVenue.metrics.tvlFormatted} across ${selectedVenue.metrics.totalSharesFormatted} issued shares.`
        );
        tradeOffs.push(
          `Unbonding Duration: Redemptions are subject to a ${selectedVenue.metrics.unbondingPeriodDays.toFixed(1)}-day (86,400s) unbonding wait.`
        );
        tradeOffs.push(
          'Approval Step: Staking requires an initial ERC-20 approval transaction for WPROS before depositing.'
        );
      } else if (selectedVenue.id === 'wpros') {
        detailedReasoning.push(
          'Instant Liquidity: Wrapped PROS offers zero unbonding wait (0s) and 1:1 instantaneous redemption back to native PROS.'
        );
        detailedReasoning.push(
          'Zero Slashing/Credit Risk: 100% reserve parity backed by over 22.39M PROS on Pharos Pacific Mainnet.'
        );
        detailedReasoning.push(
          'Native Compatibility: Accepted directly across DEXes and smart contracts as standard ERC-20.'
        );
        tradeOffs.push(
          'Zero Staking Yield: WPROS does not accrue validator staking rewards (0.0% APY).'
        );
      } else if (selectedVenue.id === 'harbor-apc3m') {
        detailedReasoning.push(
          `High Fixed Yield: Harbor Axil Prime Credit offers 13.0% gross fixed income APY on USDC.`
        );
        tradeOffs.push(
          'Fixed Term Commitment: Capital is locked for a 3-month cycle until strategy maturity.'
        );
      } else {
        detailedReasoning.push(
          `Selected for balanced score (${winningEval.score.toFixed(1)} points) considering current TVL and liquidity.`
        );
      }
    }

    return {
      request,
      timestamp: observationTime,
      selectedVenue,
      selectionSummary: summary,
      detailedReasoning,
      tradeOffs,
      evaluations,
      dataProvenance: {
        source: 'Pharos Pacific Mainnet JSON-RPC',
        chainId: PHAROS_CHAIN_ID,
        rpcEndpoint: this.rpcClient.getRpcUrl(),
        observationTime,
        freshness: 'LIVE',
      },
    };
  }

  async findBestVenue(request: UserRoutingRequest): Promise<RoutingDecision> {
    const allVenues = await this.getAllVenues();
    return this.evaluateVenues(allVenues, request);
  }

  async prepareAction(request: ActionPreparationRequest): Promise<UnsignedTransactionPayload> {
    const adapter = this.adapters.get(request.protocolId);
    if (!adapter) {
      throw new Error(`Unsupported protocol ID: ${request.protocolId}`);
    }

    if (request.operation === 'DEPOSIT') {
      return adapter.prepareDeposit(request.userAddress, request.amount, request.receiverAddress);
    }
    if (request.operation === 'WITHDRAW' || request.operation === 'REDEEM') {
      return adapter.prepareWithdraw(request.userAddress, request.amount, request.receiverAddress);
    }

    throw new Error(`Unsupported operation: ${request.operation}`);
  }
}
