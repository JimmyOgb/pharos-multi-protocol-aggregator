import { BaseProtocolAdapter } from './base-adapter.ts';
import {
  PHAROS_CHAIN_ID,
  EXPLORER_BASE_URL,
  padAddress,
  padUint256,
  formatEther,
  parseEther,
} from '../core/rpc-client.ts';
import type { ProtocolVenue, UserPosition, UnsignedTransactionPayload } from '../types/index.ts';

export const WPROS_CONTRACT_ADDRESS = '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0';

export class WPROSAdapter extends BaseProtocolAdapter {
  getId(): string {
    return 'wpros';
  }

  getName(): string {
    return 'Wrapped PROS Canonical Native Vault';
  }

  getContractAddress(): string {
    return WPROS_CONTRACT_ADDRESS;
  }

  async fetchVenueInfo(forceLive = false): Promise<ProtocolVenue> {
    this.checkInjectedFault();

    const now = Date.now();
    if (!forceLive && this.cachedVenue && now - this.cachedVenue.timestamp < 10000) {
      return {
        ...this.cachedVenue.venue,
        dataFreshness: 'CACHED',
      };
    }

    const observedAt = new Date().toISOString();
    try {
      // Query totalSupply() -> 0x18160ddd
      const supplyHex = await this.rpcClient.call(WPROS_CONTRACT_ADDRESS, '0x18160ddd', this.timeoutMs);
      const supplyBn = BigInt(supplyHex !== '0x' ? supplyHex : '0x0');
      const supplyFormatted = formatEther(supplyBn);

      const venue: ProtocolVenue = {
        id: 'wpros',
        name: 'Wrapped PROS Canonical Native Vault',
        category: 'Liquid Native Wrapper',
        protocolWebsite: 'https://docs.pharos.xyz/getting-started/token-registry',
        contractAddress: WPROS_CONTRACT_ADDRESS,
        network: 'Pharos Pacific Mainnet',
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: 'PROS',
        underlyingAssetAddress: '0x0000000000000000000000000000000000000000',
        shareAsset: 'WPROS',
        status: 'ONLINE',
        metrics: {
          tvlRaw: supplyBn.toString(),
          tvlFormatted: `${Number(supplyFormatted).toLocaleString(undefined, { maximumFractionDigits: 2 })} PROS`,
          totalSharesRaw: supplyBn.toString(),
          totalSharesFormatted: `${Number(supplyFormatted).toLocaleString(undefined, { maximumFractionDigits: 2 })} WPROS`,
          baseApyPercent: 0.0,
          netApyPercent: 0.0,
          exchangeRate: 1.0,
          exchangeRateDescription: '1 WPROS = 1.0000 PROS (Fixed 1:1 Peg)',
          unbondingPeriodSeconds: 0,
          unbondingPeriodDays: 0,
          lockupDurationSeconds: 0,
          lockupDurationDays: 0,
          depositFeeBps: 0,
          withdrawalFeeBps: 0,
          minDepositFormatted: '0.0001 PROS',
          riskTier: 'LOW',
          riskSummary: 'Zero credit risk; canonical 1:1 reserve-backed asset wrapper with immediate liquidity.',
        },
        supportedActions: ['DEPOSIT', 'WITHDRAW'],
        dataFreshness: 'LIVE',
        lastObservedAt: observedAt,
        verifiedSource: `${this.rpcClient.getRpcUrl()} (eth_call: totalSupply)`,
      };

      this.cachedVenue = { venue, timestamp: now };
      return venue;
    } catch (err: any) {
      return {
        id: 'wpros',
        name: 'Wrapped PROS Canonical Native Vault',
        category: 'Liquid Native Wrapper',
        protocolWebsite: 'https://docs.pharos.xyz/getting-started/token-registry',
        contractAddress: WPROS_CONTRACT_ADDRESS,
        network: 'Pharos Pacific Mainnet',
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: 'PROS',
        underlyingAssetAddress: '0x0000000000000000000000000000000000000000',
        shareAsset: 'WPROS',
        status: 'UNAVAILABLE',
        errorMessage: err.message || 'Failed to query WPROS contract',
        metrics: {
          tvlRaw: '0',
          tvlFormatted: '0 PROS',
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
          minDepositFormatted: '0 PROS',
          riskTier: 'LOW',
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
      const balanceHex = await this.rpcClient.call(WPROS_CONTRACT_ADDRESS, calldata, this.timeoutMs);
      const balanceBn = BigInt(balanceHex !== '0x' ? balanceHex : '0x0');
      const formatted = formatEther(balanceBn);

      return {
        protocolId: 'wpros',
        protocolName: 'Wrapped PROS Canonical Native Vault',
        contractAddress: WPROS_CONTRACT_ADDRESS,
        assetSymbol: 'WPROS',
        rawBalance: balanceBn.toString(),
        formattedBalance: `${Number(formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} WPROS`,
        rawShareBalance: balanceBn.toString(),
        formattedShareBalance: `${Number(formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} WPROS`,
        underlyingValueFormatted: `${Number(formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} PROS`,
        unbondingActive: false,
        canWithdrawImmediately: balanceBn > 0n,
        dataFreshness: 'LIVE',
        observedAt,
      };
    } catch (err: any) {
      return {
        protocolId: 'wpros',
        protocolName: 'Wrapped PROS Canonical Native Vault',
        contractAddress: WPROS_CONTRACT_ADDRESS,
        assetSymbol: 'WPROS',
        rawBalance: '0',
        formattedBalance: '0.0000 WPROS (Query Failed)',
        underlyingValueFormatted: '0.0000 PROS',
        unbondingActive: false,
        canWithdrawImmediately: false,
        dataFreshness: 'STALE',
        observedAt,
      };
    }
  }

  async prepareDeposit(userAddress: string, amount: string): Promise<UnsignedTransactionPayload> {
    const wei = parseEther(amount);
    if (wei <= 0n) {
      throw new Error('Deposit amount must be greater than zero');
    }

    return {
      to: WPROS_CONTRACT_ADDRESS,
      from: userAddress,
      value: '0x' + wei.toString(16),
      data: '0xd0e30db0',
      gasLimit: '0xafc8',
      chainId: PHAROS_CHAIN_ID,
      description: `Wrap ${amount} native PROS into 1:1 Wrapped PROS (WPROS)`,
      protocolId: 'wpros',
      protocolName: 'Wrapped PROS Canonical Native Vault',
      operation: 'DEPOSIT',
      functionSelector: '0xd0e30db0',
      functionSignature: 'deposit()',
      decodedParameters: {
        method: 'deposit',
        amountNativeWei: wei.toString(),
        amountPROS: amount,
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${WPROS_CONTRACT_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: false,
    };
  }

  async prepareWithdraw(userAddress: string, amount: string): Promise<UnsignedTransactionPayload> {
    const wei = parseEther(amount);
    if (wei <= 0n) {
      throw new Error('Withdrawal amount must be greater than zero');
    }

    const calldata = '0x2e1a7d4d' + padUint256(wei);

    return {
      to: WPROS_CONTRACT_ADDRESS,
      from: userAddress,
      value: '0x0',
      data: calldata,
      gasLimit: '0xc350',
      chainId: PHAROS_CHAIN_ID,
      description: `Unwrap ${amount} WPROS into native PROS`,
      protocolId: 'wpros',
      protocolName: 'Wrapped PROS Canonical Native Vault',
      operation: 'WITHDRAW',
      functionSelector: '0x2e1a7d4d',
      functionSignature: 'withdraw(uint256 wad)',
      decodedParameters: {
        wadWei: wei.toString(),
        wadFormatted: amount,
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${WPROS_CONTRACT_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: false,
    };
  }
}
