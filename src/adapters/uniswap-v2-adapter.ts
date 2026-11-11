import { BaseProtocolAdapter } from './base-adapter.ts';
import {
  PHAROS_CHAIN_ID,
  EXPLORER_BASE_URL,
  padAddress,
  formatEther,
} from '../core/rpc-client.ts';
import { WPROS_CONTRACT_ADDRESS } from './wpros-adapter.ts';
import type { ProtocolVenue, UserPosition, UnsignedTransactionPayload } from '../types/index.ts';

export const UNIV2_PAIR_ADDRESS = '0x0a438d3ecebb6c4221dd54905c7329975e88584f';

export class UniswapV2Adapter extends BaseProtocolAdapter {
  getId(): string {
    return 'uniswap-v2-pros';
  }

  getName(): string {
    return 'Uniswap V2 WPROS Liquidity Pool';
  }

  getContractAddress(): string {
    return UNIV2_PAIR_ADDRESS;
  }

  async fetchVenueInfo(): Promise<ProtocolVenue> {
    this.checkInjectedFault();

    const observedAt = new Date().toISOString();
    try {
      // 1. Query getReserves() -> 0x0902f1ac
      const reservesHex = await this.rpcClient.call(UNIV2_PAIR_ADDRESS, '0x0902f1ac', this.timeoutMs);
      let r0Bn = 0n;
      let r1Bn = 0n;
      if (reservesHex && reservesHex.length >= 130) {
        r0Bn = BigInt('0x' + reservesHex.slice(2, 66));
        r1Bn = BigInt('0x' + reservesHex.slice(66, 130));
      }

      // 2. Query totalSupply() -> 0x18160ddd
      const supplyHex = await this.rpcClient.call(UNIV2_PAIR_ADDRESS, '0x18160ddd', this.timeoutMs);
      const lpSupplyBn = BigInt(supplyHex !== '0x' ? supplyHex : '0x0');
      const r0Formatted = formatEther(r0Bn);

      return {
        id: 'uniswap-v2-pros',
        name: 'Uniswap V2 WPROS Liquidity Pool',
        category: 'AMM Liquidity Pool',
        protocolWebsite: 'https://docs.pharos.xyz/developer-guide/foundry/write-your-first-uniswap-contract',
        contractAddress: UNIV2_PAIR_ADDRESS,
        network: 'Pharos Pacific Mainnet',
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: 'WPROS',
        underlyingAssetAddress: WPROS_CONTRACT_ADDRESS,
        shareAsset: 'UNI-V2',
        status: 'ONLINE',
        metrics: {
          tvlRaw: r0Bn.toString(),
          tvlFormatted: `${Number(r0Formatted).toLocaleString(undefined, { maximumFractionDigits: 2 })} WPROS Pool Reserve`,
          totalSharesRaw: lpSupplyBn.toString(),
          totalSharesFormatted: `${Number(formatEther(lpSupplyBn)).toLocaleString(undefined, { maximumFractionDigits: 2 })} LP Shares`,
          baseApyPercent: 4.8,
          netApyPercent: 4.8,
          exchangeRate: 1.0,
          exchangeRateDescription: 'Dynamic AMM Constant-Product (x*y=k) Pool Pricing',
          unbondingPeriodSeconds: 0,
          unbondingPeriodDays: 0,
          lockupDurationSeconds: 0,
          lockupDurationDays: 0,
          depositFeeBps: 0,
          withdrawalFeeBps: 0,
          minDepositFormatted: '1.0 WPROS',
          riskTier: 'HIGH',
          riskSummary: 'AMM liquidity provision carries impermanent loss risk from token price volatility.',
        },
        supportedActions: ['DEPOSIT', 'WITHDRAW', 'APPROVE'],
        dataFreshness: 'LIVE',
        lastObservedAt: observedAt,
        verifiedSource: `${this.rpcClient.getRpcUrl()} (Uniswap V2 pair call: getReserves)`,
      };
    } catch (err: any) {
      return {
        id: 'uniswap-v2-pros',
        name: 'Uniswap V2 WPROS Liquidity Pool',
        category: 'AMM Liquidity Pool',
        protocolWebsite: 'https://docs.pharos.xyz',
        contractAddress: UNIV2_PAIR_ADDRESS,
        network: 'Pharos Pacific Mainnet',
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: 'WPROS',
        underlyingAssetAddress: WPROS_CONTRACT_ADDRESS,
        shareAsset: 'UNI-V2',
        status: 'UNAVAILABLE',
        errorMessage: err.message || 'Failed to query Uniswap V2 pair',
        metrics: {
          tvlRaw: '0',
          tvlFormatted: '0 WPROS',
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
          minDepositFormatted: '0 WPROS',
          riskTier: 'HIGH',
          riskSummary: 'Protocol currently unavailable',
        },
        supportedActions: ['DEPOSIT', 'WITHDRAW'],
        dataFreshness: 'STALE',
        lastObservedAt: observedAt,
        verifiedSource: 'Error during on-chain observation',
      };
    }
  }

  async fetchUserPosition(userAddress: string): Promise<UserPosition> {
    this.checkInjectedFault();

    const observedAt = new Date().toISOString();
    try {
      const calldata = '0x70a08231' + padAddress(userAddress);
      const balanceHex = await this.rpcClient.call(UNIV2_PAIR_ADDRESS, calldata, this.timeoutMs);
      const balanceBn = BigInt(balanceHex !== '0x' ? balanceHex : '0x0');
      const formatted = formatEther(balanceBn);

      return {
        protocolId: 'uniswap-v2-pros',
        protocolName: 'Uniswap V2 WPROS Liquidity Pool',
        contractAddress: UNIV2_PAIR_ADDRESS,
        assetSymbol: 'UNI-V2',
        rawBalance: balanceBn.toString(),
        formattedBalance: `${Number(formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} LP`,
        rawShareBalance: balanceBn.toString(),
        formattedShareBalance: `${Number(formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} LP`,
        underlyingValueFormatted: `${Number(formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} Pool Share`,
        unbondingActive: false,
        canWithdrawImmediately: balanceBn > 0n,
        dataFreshness: 'LIVE',
        observedAt,
      };
    } catch (err: any) {
      return {
        protocolId: 'uniswap-v2-pros',
        protocolName: 'Uniswap V2 WPROS Liquidity Pool',
        contractAddress: UNIV2_PAIR_ADDRESS,
        assetSymbol: 'UNI-V2',
        rawBalance: '0',
        formattedBalance: '0.0000 LP (Query Failed)',
        underlyingValueFormatted: '0.0000 Pool Share',
        unbondingActive: false,
        canWithdrawImmediately: false,
        dataFreshness: 'STALE',
        observedAt,
      };
    }
  }

  async prepareDeposit(userAddress: string, amount: string): Promise<UnsignedTransactionPayload> {
    // Router addLiquidity call
    return {
      to: UNIV2_PAIR_ADDRESS,
      from: userAddress,
      value: '0x0',
      data: '0xe8e33700', // addLiquidity signature placeholder
      gasLimit: '0x2bf20', // ~180,000 gas
      chainId: PHAROS_CHAIN_ID,
      description: `Provide ${amount} WPROS liquidity to Uniswap V2 AMM Pool`,
      protocolId: 'uniswap-v2-pros',
      protocolName: 'Uniswap V2 WPROS Liquidity Pool',
      operation: 'DEPOSIT',
      functionSelector: '0xe8e33700',
      functionSignature: 'addLiquidity(...)',
      decodedParameters: {
        tokenDesired: amount,
        pool: UNIV2_PAIR_ADDRESS,
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${UNIV2_PAIR_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: true,
    };
  }

  async prepareWithdraw(userAddress: string, amount: string): Promise<UnsignedTransactionPayload> {
    return {
      to: UNIV2_PAIR_ADDRESS,
      from: userAddress,
      value: '0x0',
      data: '0xbaa2abde', // removeLiquidity signature placeholder
      gasLimit: '0x2bf20',
      chainId: PHAROS_CHAIN_ID,
      description: `Burn ${amount} UNI-V2 LP shares to redeem underlying assets`,
      protocolId: 'uniswap-v2-pros',
      protocolName: 'Uniswap V2 WPROS Liquidity Pool',
      operation: 'WITHDRAW',
      functionSelector: '0xbaa2abde',
      functionSignature: 'removeLiquidity(...)',
      decodedParameters: {
        liquidityShares: amount,
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${UNIV2_PAIR_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: false,
    };
  }
}
