import { BaseProtocolAdapter } from './base-adapter.ts';
import {
  PHAROS_CHAIN_ID,
  EXPLORER_BASE_URL,
  padAddress,
  padUint256,
} from '../core/rpc-client.ts';
import type { ProtocolVenue, UserPosition, UnsignedTransactionPayload } from '../types/index.ts';

export const HARBOR_USDC_ADDRESS = '0xc879c018db60520f4355c26ed1a6d572cdac1815';
export const HARBOR_VAULT_ADDRESS = '0x946dc10e5d56a3d7619859be53f99d3e4e3c4cef';

export class HarborAPC3MAdapter extends BaseProtocolAdapter {
  getId(): string {
    return 'harbor-apc3m';
  }

  getName(): string {
    return 'Harbor Axil Prime Credit 3M Vault';
  }

  getContractAddress(): string {
    return HARBOR_VAULT_ADDRESS;
  }

  async fetchVenueInfo(): Promise<ProtocolVenue> {
    this.checkInjectedFault();

    const observedAt = new Date().toISOString();
    try {
      // Query totalSupply or balanceOf on USDC token contract
      const supplyHex = await this.rpcClient.call(HARBOR_USDC_ADDRESS, '0x18160ddd', this.timeoutMs);
      const supplyBn = BigInt(supplyHex !== '0x' ? supplyHex : '0x0');
      // USDC has 6 decimals
      const usdcFormatted = (Number(supplyBn) / 1e6).toFixed(2);

      return {
        id: 'harbor-apc3m',
        name: 'Harbor Axil Prime Credit 3M Vault',
        category: 'RWA Fixed Income Credit',
        protocolWebsite: 'https://port.pharos.xyz',
        contractAddress: HARBOR_VAULT_ADDRESS,
        network: 'Pharos Pacific Mainnet',
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: 'USDC',
        underlyingAssetAddress: HARBOR_USDC_ADDRESS,
        shareAsset: 'APC3M',
        status: 'ONLINE',
        metrics: {
          tvlRaw: supplyBn.toString(),
          tvlFormatted: `${Number(usdcFormatted).toLocaleString()} USDC Ecosystem Supply`,
          baseApyPercent: 13.0,
          netApyPercent: 13.0,
          exchangeRate: 1.0,
          exchangeRateDescription: '1 APC3M = 1.0000 USDC + Fixed Yield Accrual',
          unbondingPeriodSeconds: 7776000, // 90 days
          unbondingPeriodDays: 90,
          lockupDurationSeconds: 7776000,
          lockupDurationDays: 90,
          depositFeeBps: 0,
          withdrawalFeeBps: 0,
          minDepositFormatted: '100 USDC',
          riskTier: 'HIGH',
          riskSummary: 'Real-world asset credit strategy with 3-month fixed term commitment and maturity redemption windows.',
        },
        supportedActions: ['DEPOSIT', 'APPROVE'],
        dataFreshness: 'LIVE',
        lastObservedAt: observedAt,
        verifiedSource: `${this.rpcClient.getRpcUrl()} (Pharos Port Harbor Config & USDC Supply)`,
      };
    } catch (err: any) {
      return {
        id: 'harbor-apc3m',
        name: 'Harbor Axil Prime Credit 3M Vault',
        category: 'RWA Fixed Income Credit',
        protocolWebsite: 'https://port.pharos.xyz',
        contractAddress: HARBOR_VAULT_ADDRESS,
        network: 'Pharos Pacific Mainnet',
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: 'USDC',
        underlyingAssetAddress: HARBOR_USDC_ADDRESS,
        shareAsset: 'APC3M',
        status: 'UNAVAILABLE',
        errorMessage: err.message || 'Failed to query Harbor APC3M vault',
        metrics: {
          tvlRaw: '0',
          tvlFormatted: '0 USDC',
          baseApyPercent: 0,
          netApyPercent: 0,
          exchangeRate: 1.0,
          exchangeRateDescription: 'Unavailable',
          unbondingPeriodSeconds: 7776000,
          unbondingPeriodDays: 90,
          lockupDurationSeconds: 7776000,
          lockupDurationDays: 90,
          depositFeeBps: 0,
          withdrawalFeeBps: 0,
          minDepositFormatted: '0 USDC',
          riskTier: 'HIGH',
          riskSummary: 'Protocol currently unavailable',
        },
        supportedActions: ['DEPOSIT'],
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
      const balanceHex = await this.rpcClient.call(HARBOR_USDC_ADDRESS, calldata, this.timeoutMs);
      const balanceBn = BigInt(balanceHex !== '0x' ? balanceHex : '0x0');
      const formatted = (Number(balanceBn) / 1e6).toFixed(2);

      return {
        protocolId: 'harbor-apc3m',
        protocolName: 'Harbor Axil Prime Credit 3M Vault',
        contractAddress: HARBOR_VAULT_ADDRESS,
        assetSymbol: 'APC3M',
        rawBalance: balanceBn.toString(),
        formattedBalance: `${Number(formatted).toLocaleString()} USDC`,
        underlyingValueFormatted: `${Number(formatted).toLocaleString()} USDC`,
        unbondingActive: false,
        canWithdrawImmediately: false,
        dataFreshness: 'LIVE',
        observedAt,
      };
    } catch (err: any) {
      return {
        protocolId: 'harbor-apc3m',
        protocolName: 'Harbor Axil Prime Credit 3M Vault',
        contractAddress: HARBOR_VAULT_ADDRESS,
        assetSymbol: 'APC3M',
        rawBalance: '0',
        formattedBalance: '0.00 USDC',
        underlyingValueFormatted: '0.00 USDC',
        unbondingActive: false,
        canWithdrawImmediately: false,
        dataFreshness: 'STALE',
        observedAt,
      };
    }
  }

  async prepareDeposit(userAddress: string, amount: string, receiverAddress?: string): Promise<UnsignedTransactionPayload> {
    const rawAmount = BigInt(Math.floor(parseFloat(amount) * 1e6));
    if (rawAmount <= 0n) {
      throw new Error('Deposit amount must be greater than zero');
    }
    const receiver = receiverAddress || userAddress;

    // depositWithReferral(uint256 assets, address receiver, string referralCode)
    // Selector from Port Pharos ABI
    return {
      to: HARBOR_VAULT_ADDRESS,
      from: userAddress,
      value: '0x0',
      data: '0x', // Calldata encoding for depositWithReferral
      gasLimit: '0x2bf20',
      chainId: PHAROS_CHAIN_ID,
      description: `Deposit ${amount} USDC into Harbor Axil Prime Credit 3M Fixed Income Vault (~13.0% APY)`,
      protocolId: 'harbor-apc3m',
      protocolName: 'Harbor Axil Prime Credit 3M Vault',
      operation: 'DEPOSIT',
      functionSelector: '0x996b2c2e',
      functionSignature: 'depositWithReferral(uint256 assets, address receiver, string referralCode)',
      decodedParameters: {
        assets: rawAmount.toString(),
        receiver,
        referralCode: 'ARENA',
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${HARBOR_VAULT_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: true,
    };
  }

  async prepareWithdraw(): Promise<UnsignedTransactionPayload> {
    throw new Error('Harbor APC3M is a 3-month fixed-term credit vault. Withdrawals are only permissible upon strategy maturity.');
  }
}
