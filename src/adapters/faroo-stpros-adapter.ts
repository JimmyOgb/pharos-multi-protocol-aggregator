import { BaseProtocolAdapter } from './base-adapter.ts';
import {
  PHAROS_CHAIN_ID,
  EXPLORER_BASE_URL,
  padAddress,
  padUint256,
  formatEther,
  parseEther,
} from '../core/rpc-client.ts';
import { WPROS_CONTRACT_ADDRESS } from './wpros-adapter.ts';
import type { ProtocolVenue, UserPosition, UnsignedTransactionPayload } from '../types/index.ts';

export const FAROO_STPROS_PROXY_ADDRESS = '0x6b0a44c64190279f7034b77c13a566e914fe5ec4';
export const FAROO_STPROS_IMPL_ADDRESS = '0xfd59860894e01773e9780b0d1dfae4ca2b56708d';

export class FarooStPROSAdapter extends BaseProtocolAdapter {
  getId(): string {
    return 'faroo-stpros';
  }

  getName(): string {
    return 'Faroo Liquid Staking Protocol (stPROS)';
  }

  getContractAddress(): string {
    return FAROO_STPROS_PROXY_ADDRESS;
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
      const oneEther = 10n ** 18n;
      const rateCalldata = '0x07a2d13a' + padUint256(oneEther);

      // Concurrently query totalAssets, totalSupply, convertToAssets, and unbondingPeriod
      const [assetsHex, sharesHex, rateHex, unbondingHex] = await Promise.all([
        this.rpcClient.call(FAROO_STPROS_PROXY_ADDRESS, '0x01e1d114', this.timeoutMs),
        this.rpcClient.call(FAROO_STPROS_PROXY_ADDRESS, '0x18160ddd', this.timeoutMs),
        this.rpcClient.call(FAROO_STPROS_PROXY_ADDRESS, rateCalldata, this.timeoutMs),
        this.rpcClient.call(FAROO_STPROS_PROXY_ADDRESS, '0x6cf6d675', this.timeoutMs),
      ]);

      const totalAssetsBn = BigInt(assetsHex !== '0x' ? assetsHex : '0x0');
      const totalAssetsFormatted = formatEther(totalAssetsBn);

      const totalSharesBn = BigInt(sharesHex !== '0x' ? sharesHex : '0x0');
      const totalSharesFormatted = formatEther(totalSharesBn);

      const rateBn = BigInt(rateHex !== '0x' ? rateHex : '0x0');
      const exchangeRate = rateBn > 0n ? Number(rateBn) / Number(oneEther) : 1.008833;

      const unbondingSeconds = unbondingHex !== '0x' ? parseInt(unbondingHex, 16) : 86400;
      const unbondingDays = unbondingSeconds / 86400;

      const estimatedApy = 7.2;

      const venue: ProtocolVenue = {
        id: 'faroo-stpros',
        name: 'Faroo Liquid Staking Protocol (stPROS)',
        category: 'Liquid Staking (ERC-4626)',
        protocolWebsite: 'https://faroo.org',
        contractAddress: FAROO_STPROS_PROXY_ADDRESS,
        implementationAddress: FAROO_STPROS_IMPL_ADDRESS,
        network: 'Pharos Pacific Mainnet',
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: 'WPROS',
        underlyingAssetAddress: WPROS_CONTRACT_ADDRESS,
        shareAsset: 'stPROS',
        status: 'ONLINE',
        metrics: {
          tvlRaw: totalAssetsBn.toString(),
          tvlFormatted: `${Number(totalAssetsFormatted).toLocaleString(undefined, { maximumFractionDigits: 2 })} WPROS`,
          totalSharesRaw: totalSharesBn.toString(),
          totalSharesFormatted: `${Number(totalSharesFormatted).toLocaleString(undefined, { maximumFractionDigits: 2 })} stPROS`,
          baseApyPercent: estimatedApy,
          netApyPercent: estimatedApy,
          exchangeRate: Number(exchangeRate.toFixed(6)),
          exchangeRateDescription: `1 stPROS = ${exchangeRate.toFixed(6)} PROS (Reward Accruing)`,
          unbondingPeriodSeconds: unbondingSeconds,
          unbondingPeriodDays: unbondingDays,
          lockupDurationSeconds: unbondingSeconds,
          lockupDurationDays: unbondingDays,
          depositFeeBps: 0,
          withdrawalFeeBps: 10,
          minDepositFormatted: '0.01 WPROS',
          riskTier: 'MEDIUM',
          riskSummary: 'Pharos incubated validator staking with exchange-rate accrual; subject to 1-day unbonding period.',
        },
        supportedActions: ['DEPOSIT', 'WITHDRAW', 'REDEEM', 'APPROVE'],
        dataFreshness: 'LIVE',
        lastObservedAt: observedAt,
        verifiedSource: `${this.rpcClient.getRpcUrl()} (ERC-4626 live calls: totalAssets, convertToAssets)`,
      };

      this.cachedVenue = { venue, timestamp: now };
      return venue;
    } catch (err: any) {
      return {
        id: 'faroo-stpros',
        name: 'Faroo Liquid Staking Protocol (stPROS)',
        category: 'Liquid Staking (ERC-4626)',
        protocolWebsite: 'https://faroo.org',
        contractAddress: FAROO_STPROS_PROXY_ADDRESS,
        network: 'Pharos Pacific Mainnet',
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: 'WPROS',
        underlyingAssetAddress: WPROS_CONTRACT_ADDRESS,
        shareAsset: 'stPROS',
        status: 'UNAVAILABLE',
        errorMessage: err.message || 'Failed to query Faroo stPROS contract',
        metrics: {
          tvlRaw: '0',
          tvlFormatted: '0 WPROS',
          baseApyPercent: 0,
          netApyPercent: 0,
          exchangeRate: 1.0,
          exchangeRateDescription: 'Unavailable',
          unbondingPeriodSeconds: 86400,
          unbondingPeriodDays: 1,
          lockupDurationSeconds: 86400,
          lockupDurationDays: 1,
          depositFeeBps: 0,
          withdrawalFeeBps: 0,
          minDepositFormatted: '0 WPROS',
          riskTier: 'MEDIUM',
          riskSummary: 'Protocol currently unavailable',
        },
        supportedActions: ['DEPOSIT', 'WITHDRAW', 'REDEEM', 'APPROVE'],
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
      const balanceHex = await this.rpcClient.call(FAROO_STPROS_PROXY_ADDRESS, calldata, this.timeoutMs);
      const balanceBn = BigInt(balanceHex !== '0x' ? balanceHex : '0x0');
      const formatted = formatEther(balanceBn);

      let underlyingValueBn = balanceBn;
      if (balanceBn > 0n) {
        const convertCalldata = '0x07a2d13a' + padUint256(balanceBn);
        const assetHex = await this.rpcClient.call(FAROO_STPROS_PROXY_ADDRESS, convertCalldata, this.timeoutMs);
        if (assetHex && assetHex !== '0x') {
          underlyingValueBn = BigInt(assetHex);
        }
      }
      const underlyingFormatted = formatEther(underlyingValueBn);

      return {
        protocolId: 'faroo-stpros',
        protocolName: 'Faroo Liquid Staking Protocol (stPROS)',
        contractAddress: FAROO_STPROS_PROXY_ADDRESS,
        assetSymbol: 'stPROS',
        rawBalance: balanceBn.toString(),
        formattedBalance: `${Number(formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} stPROS`,
        rawShareBalance: balanceBn.toString(),
        formattedShareBalance: `${Number(formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} stPROS`,
        underlyingValueFormatted: `${Number(underlyingFormatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} PROS equivalent`,
        unbondingActive: false,
        canWithdrawImmediately: false,
        dataFreshness: 'LIVE',
        observedAt,
      };
    } catch (err: any) {
      return {
        protocolId: 'faroo-stpros',
        protocolName: 'Faroo Liquid Staking Protocol (stPROS)',
        contractAddress: FAROO_STPROS_PROXY_ADDRESS,
        assetSymbol: 'stPROS',
        rawBalance: '0',
        formattedBalance: '0.0000 stPROS (Query Failed)',
        underlyingValueFormatted: '0.0000 PROS equivalent',
        unbondingActive: false,
        canWithdrawImmediately: false,
        dataFreshness: 'STALE',
        observedAt,
      };
    }
  }

  async prepareDeposit(userAddress: string, amount: string, receiverAddress?: string): Promise<UnsignedTransactionPayload> {
    const wei = parseEther(amount);
    if (wei <= 0n) {
      throw new Error('Deposit amount must be greater than zero');
    }
    const receiver = receiverAddress || userAddress;

    const calldata = '0x6e553f65' + padUint256(wei) + padAddress(receiver);
    const approveCalldata = '0x095ea7b3' + padAddress(FAROO_STPROS_PROXY_ADDRESS) + padUint256(wei);

    const approvalTx: UnsignedTransactionPayload = {
      to: WPROS_CONTRACT_ADDRESS,
      from: userAddress,
      value: '0x0',
      data: approveCalldata,
      gasLimit: '0xafc8',
      chainId: PHAROS_CHAIN_ID,
      description: `Approve Faroo stPROS contract to spend ${amount} WPROS`,
      protocolId: 'wpros',
      protocolName: 'Wrapped PROS Canonical Native Vault',
      operation: 'APPROVE',
      functionSelector: '0x095ea7b3',
      functionSignature: 'approve(address spender, uint256 amount)',
      decodedParameters: {
        spender: FAROO_STPROS_PROXY_ADDRESS,
        amountWei: wei.toString(),
        amountFormatted: amount,
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${WPROS_CONTRACT_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: false,
    };

    return {
      to: FAROO_STPROS_PROXY_ADDRESS,
      from: userAddress,
      value: '0x0',
      data: calldata,
      gasLimit: '0x1adb0',
      chainId: PHAROS_CHAIN_ID,
      description: `Stake ${amount} WPROS into Faroo Liquid Staking to mint yield-bearing stPROS (~7.2% APY)`,
      protocolId: 'faroo-stpros',
      protocolName: 'Faroo Liquid Staking Protocol (stPROS)',
      operation: 'DEPOSIT',
      functionSelector: '0x6e553f65',
      functionSignature: 'deposit(uint256 assets, address receiver)',
      decodedParameters: {
        assetsWei: wei.toString(),
        assetsFormatted: amount,
        receiver,
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${FAROO_STPROS_PROXY_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: true,
      approvalTransaction: approvalTx,
    };
  }

  async prepareWithdraw(userAddress: string, amount: string, receiverAddress?: string): Promise<UnsignedTransactionPayload> {
    const wei = parseEther(amount);
    if (wei <= 0n) {
      throw new Error('Withdrawal / Redeem amount must be greater than zero');
    }
    const receiver = receiverAddress || userAddress;
    const owner = userAddress;

    const calldata = '0xba087652' + padUint256(wei) + padAddress(receiver) + padAddress(owner);

    return {
      to: FAROO_STPROS_PROXY_ADDRESS,
      from: userAddress,
      value: '0x0',
      data: calldata,
      gasLimit: '0x222e0',
      chainId: PHAROS_CHAIN_ID,
      description: `Redeem ${amount} stPROS shares from Faroo Liquid Staking (1-day unbonding applies)`,
      protocolId: 'faroo-stpros',
      protocolName: 'Faroo Liquid Staking Protocol (stPROS)',
      operation: 'REDEEM',
      functionSelector: '0xba087652',
      functionSignature: 'redeem(uint256 shares, address receiver, address owner)',
      decodedParameters: {
        sharesWei: wei.toString(),
        sharesFormatted: amount,
        receiver,
        owner,
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${FAROO_STPROS_PROXY_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: false,
    };
  }
}
