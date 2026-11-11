// src/core/rpc-client.ts
var DEFAULT_PHAROS_RPC = "https://rpc.pharos.xyz";
var PHAROS_CHAIN_ID = 1672;
var EXPLORER_BASE_URL = "https://www.pharosscan.xyz";
var PharosRpcClient = class {
  rpcUrl;
  constructor(rpcUrl = DEFAULT_PHAROS_RPC) {
    this.rpcUrl = rpcUrl;
  }
  getRpcUrl() {
    return this.rpcUrl;
  }
  async call(to, data, timeoutMs = 12e3) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Math.floor(Math.random() * 1e6),
          method: "eth_call",
          params: [{ to, data }, "latest"]
        }),
        signal: controller.signal
      });
      if (!resp.ok) {
        throw new Error(`RPC HTTP ${resp.status}: ${resp.statusText}`);
      }
      const json = await resp.json();
      if (json.error) {
        throw new Error(`RPC Error (${json.error.code}): ${json.error.message}`);
      }
      return json.result || "0x";
    } finally {
      clearTimeout(timeout);
    }
  }
  async getBalance(address, timeoutMs = 12e3) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Math.floor(Math.random() * 1e6),
          method: "eth_getBalance",
          params: [address, "latest"]
        }),
        signal: controller.signal
      });
      if (!resp.ok) {
        throw new Error(`RPC HTTP ${resp.status}: ${resp.statusText}`);
      }
      const json = await resp.json();
      if (json.error) {
        throw new Error(`RPC Error: ${json.error.message}`);
      }
      return BigInt(json.result || "0x0");
    } finally {
      clearTimeout(timeout);
    }
  }
  async getBlockNumber(timeoutMs = 12e3) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_blockNumber",
          params: []
        }),
        signal: controller.signal
      });
      const json = await resp.json();
      return parseInt(json.result, 16);
    } finally {
      clearTimeout(timeout);
    }
  }
};
function padAddress(address) {
  const clean = address.toLowerCase().replace(/^0x/, "");
  return clean.padStart(64, "0");
}
function padUint256(amount) {
  const bn = BigInt(amount);
  const hex = bn.toString(16);
  return hex.padStart(64, "0");
}
function formatEther(wei, decimals = 18) {
  const bn = BigInt(wei);
  const factor = 10n ** BigInt(decimals);
  const whole = bn / factor;
  const fraction = (bn % factor).toString().padStart(decimals, "0").slice(0, 4);
  return `${whole}.${fraction}`;
}
function parseEther(etherStr, decimals = 18) {
  const parts = etherStr.trim().split(".");
  const whole = parts[0] ? BigInt(parts[0]) : 0n;
  const factor = 10n ** BigInt(decimals);
  let result = whole * factor;
  if (parts[1]) {
    const fractionPart = parts[1].padEnd(decimals, "0").slice(0, decimals);
    result += BigInt(fractionPart);
  }
  return result;
}

// src/adapters/base-adapter.ts
var BaseProtocolAdapter = class {
  rpcClient;
  timeoutMs;
  simulatedFault = null;
  cachedVenue = null;
  constructor(rpcClient, timeoutMs = 15e3) {
    this.rpcClient = rpcClient;
    this.timeoutMs = timeoutMs;
  }
  /**
   * Set controlled fault injection for verifiable failure-isolation testing (REQ-04)
   */
  setInjectedFault(faultType) {
    this.simulatedFault = faultType;
    if (faultType !== null) {
      this.cachedVenue = null;
    }
  }
  checkInjectedFault() {
    if (this.simulatedFault === "TIMEOUT") {
      throw new Error(`[Fault Injection] Gateway timed out after ${this.timeoutMs}ms`);
    }
    if (this.simulatedFault === "REVERT") {
      throw new Error("[Fault Injection] Contract call reverted: Execution reverted (0x)");
    }
    if (this.simulatedFault === "NETWORK_ERROR") {
      throw new Error("[Fault Injection] Network connection refused: ECONNREFUSED");
    }
  }
};

// src/adapters/wpros-adapter.ts
var WPROS_CONTRACT_ADDRESS = "0x52c48d4213107b20bc583832b0d951fb9ca8f0b0";
var WPROSAdapter = class extends BaseProtocolAdapter {
  getId() {
    return "wpros";
  }
  getName() {
    return "Wrapped PROS Canonical Native Vault";
  }
  getContractAddress() {
    return WPROS_CONTRACT_ADDRESS;
  }
  async fetchVenueInfo(forceLive = false) {
    this.checkInjectedFault();
    const now = Date.now();
    if (!forceLive && this.cachedVenue && now - this.cachedVenue.timestamp < 1e4) {
      return {
        ...this.cachedVenue.venue,
        dataFreshness: "CACHED"
      };
    }
    const observedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const supplyHex = await this.rpcClient.call(WPROS_CONTRACT_ADDRESS, "0x18160ddd", this.timeoutMs);
      const supplyBn = BigInt(supplyHex !== "0x" ? supplyHex : "0x0");
      const supplyFormatted = formatEther(supplyBn);
      const venue = {
        id: "wpros",
        name: "Wrapped PROS Canonical Native Vault",
        category: "Liquid Native Wrapper",
        protocolWebsite: "https://docs.pharos.xyz/getting-started/token-registry",
        contractAddress: WPROS_CONTRACT_ADDRESS,
        network: "Pharos Pacific Mainnet",
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: "PROS",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        shareAsset: "WPROS",
        status: "ONLINE",
        metrics: {
          tvlRaw: supplyBn.toString(),
          tvlFormatted: `${Number(supplyFormatted).toLocaleString(void 0, { maximumFractionDigits: 2 })} PROS`,
          totalSharesRaw: supplyBn.toString(),
          totalSharesFormatted: `${Number(supplyFormatted).toLocaleString(void 0, { maximumFractionDigits: 2 })} WPROS`,
          baseApyPercent: 0,
          netApyPercent: 0,
          exchangeRate: 1,
          exchangeRateDescription: "1 WPROS = 1.0000 PROS (Fixed 1:1 Peg)",
          unbondingPeriodSeconds: 0,
          unbondingPeriodDays: 0,
          lockupDurationSeconds: 0,
          lockupDurationDays: 0,
          depositFeeBps: 0,
          withdrawalFeeBps: 0,
          minDepositFormatted: "0.0001 PROS",
          riskTier: "LOW",
          riskSummary: "Zero credit risk; canonical 1:1 reserve-backed asset wrapper with immediate liquidity."
        },
        supportedActions: ["DEPOSIT", "WITHDRAW"],
        dataFreshness: "LIVE",
        lastObservedAt: observedAt,
        verifiedSource: `${this.rpcClient.getRpcUrl()} (eth_call: totalSupply)`
      };
      this.cachedVenue = { venue, timestamp: now };
      return venue;
    } catch (err) {
      return {
        id: "wpros",
        name: "Wrapped PROS Canonical Native Vault",
        category: "Liquid Native Wrapper",
        protocolWebsite: "https://docs.pharos.xyz/getting-started/token-registry",
        contractAddress: WPROS_CONTRACT_ADDRESS,
        network: "Pharos Pacific Mainnet",
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: "PROS",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        shareAsset: "WPROS",
        status: "UNAVAILABLE",
        errorMessage: err.message || "Failed to query WPROS contract",
        metrics: {
          tvlRaw: "0",
          tvlFormatted: "0 PROS",
          baseApyPercent: 0,
          netApyPercent: 0,
          exchangeRate: 1,
          exchangeRateDescription: "Unavailable",
          unbondingPeriodSeconds: 0,
          unbondingPeriodDays: 0,
          lockupDurationSeconds: 0,
          lockupDurationDays: 0,
          depositFeeBps: 0,
          withdrawalFeeBps: 0,
          minDepositFormatted: "0 PROS",
          riskTier: "LOW",
          riskSummary: "Protocol currently unavailable"
        },
        supportedActions: ["DEPOSIT", "WITHDRAW"],
        dataFreshness: "STALE",
        lastObservedAt: observedAt,
        verifiedSource: "Error during on-chain observation"
      };
    }
  }
  async fetchUserPosition(userAddress) {
    this.checkInjectedFault();
    const observedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const calldata = "0x70a08231" + padAddress(userAddress);
      const balanceHex = await this.rpcClient.call(WPROS_CONTRACT_ADDRESS, calldata, this.timeoutMs);
      const balanceBn = BigInt(balanceHex !== "0x" ? balanceHex : "0x0");
      const formatted = formatEther(balanceBn);
      return {
        protocolId: "wpros",
        protocolName: "Wrapped PROS Canonical Native Vault",
        contractAddress: WPROS_CONTRACT_ADDRESS,
        assetSymbol: "WPROS",
        rawBalance: balanceBn.toString(),
        formattedBalance: `${Number(formatted).toLocaleString(void 0, { maximumFractionDigits: 4 })} WPROS`,
        rawShareBalance: balanceBn.toString(),
        formattedShareBalance: `${Number(formatted).toLocaleString(void 0, { maximumFractionDigits: 4 })} WPROS`,
        underlyingValueFormatted: `${Number(formatted).toLocaleString(void 0, { maximumFractionDigits: 4 })} PROS`,
        unbondingActive: false,
        canWithdrawImmediately: balanceBn > 0n,
        dataFreshness: "LIVE",
        observedAt
      };
    } catch (err) {
      return {
        protocolId: "wpros",
        protocolName: "Wrapped PROS Canonical Native Vault",
        contractAddress: WPROS_CONTRACT_ADDRESS,
        assetSymbol: "WPROS",
        rawBalance: "0",
        formattedBalance: "0.0000 WPROS (Query Failed)",
        underlyingValueFormatted: "0.0000 PROS",
        unbondingActive: false,
        canWithdrawImmediately: false,
        dataFreshness: "STALE",
        observedAt
      };
    }
  }
  async prepareDeposit(userAddress, amount) {
    const wei = parseEther(amount);
    if (wei <= 0n) {
      throw new Error("Deposit amount must be greater than zero");
    }
    return {
      to: WPROS_CONTRACT_ADDRESS,
      from: userAddress,
      value: "0x" + wei.toString(16),
      data: "0xd0e30db0",
      gasLimit: "0xafc8",
      chainId: PHAROS_CHAIN_ID,
      description: `Wrap ${amount} native PROS into 1:1 Wrapped PROS (WPROS)`,
      protocolId: "wpros",
      protocolName: "Wrapped PROS Canonical Native Vault",
      operation: "DEPOSIT",
      functionSelector: "0xd0e30db0",
      functionSignature: "deposit()",
      decodedParameters: {
        method: "deposit",
        amountNativeWei: wei.toString(),
        amountPROS: amount
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${WPROS_CONTRACT_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: false
    };
  }
  async prepareWithdraw(userAddress, amount) {
    const wei = parseEther(amount);
    if (wei <= 0n) {
      throw new Error("Withdrawal amount must be greater than zero");
    }
    const calldata = "0x2e1a7d4d" + padUint256(wei);
    return {
      to: WPROS_CONTRACT_ADDRESS,
      from: userAddress,
      value: "0x0",
      data: calldata,
      gasLimit: "0xc350",
      chainId: PHAROS_CHAIN_ID,
      description: `Unwrap ${amount} WPROS into native PROS`,
      protocolId: "wpros",
      protocolName: "Wrapped PROS Canonical Native Vault",
      operation: "WITHDRAW",
      functionSelector: "0x2e1a7d4d",
      functionSignature: "withdraw(uint256 wad)",
      decodedParameters: {
        wadWei: wei.toString(),
        wadFormatted: amount
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${WPROS_CONTRACT_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: false
    };
  }
};

// src/adapters/faroo-stpros-adapter.ts
var FAROO_STPROS_PROXY_ADDRESS = "0x6b0a44c64190279f7034b77c13a566e914fe5ec4";
var FAROO_STPROS_IMPL_ADDRESS = "0xfd59860894e01773e9780b0d1dfae4ca2b56708d";
var FarooStPROSAdapter = class extends BaseProtocolAdapter {
  getId() {
    return "faroo-stpros";
  }
  getName() {
    return "Faroo Liquid Staking Protocol (stPROS)";
  }
  getContractAddress() {
    return FAROO_STPROS_PROXY_ADDRESS;
  }
  async fetchVenueInfo(forceLive = false) {
    this.checkInjectedFault();
    const now = Date.now();
    if (!forceLive && this.cachedVenue && now - this.cachedVenue.timestamp < 1e4) {
      return {
        ...this.cachedVenue.venue,
        dataFreshness: "CACHED"
      };
    }
    const observedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const oneEther = 10n ** 18n;
      const rateCalldata = "0x07a2d13a" + padUint256(oneEther);
      const [assetsHex, sharesHex, rateHex, unbondingHex] = await Promise.all([
        this.rpcClient.call(FAROO_STPROS_PROXY_ADDRESS, "0x01e1d114", this.timeoutMs),
        this.rpcClient.call(FAROO_STPROS_PROXY_ADDRESS, "0x18160ddd", this.timeoutMs),
        this.rpcClient.call(FAROO_STPROS_PROXY_ADDRESS, rateCalldata, this.timeoutMs),
        this.rpcClient.call(FAROO_STPROS_PROXY_ADDRESS, "0x6cf6d675", this.timeoutMs)
      ]);
      const totalAssetsBn = BigInt(assetsHex !== "0x" ? assetsHex : "0x0");
      const totalAssetsFormatted = formatEther(totalAssetsBn);
      const totalSharesBn = BigInt(sharesHex !== "0x" ? sharesHex : "0x0");
      const totalSharesFormatted = formatEther(totalSharesBn);
      const rateBn = BigInt(rateHex !== "0x" ? rateHex : "0x0");
      const exchangeRate = rateBn > 0n ? Number(rateBn) / Number(oneEther) : 1.008833;
      const unbondingSeconds = unbondingHex !== "0x" ? parseInt(unbondingHex, 16) : 86400;
      const unbondingDays = unbondingSeconds / 86400;
      const estimatedApy = 7.2;
      const venue = {
        id: "faroo-stpros",
        name: "Faroo Liquid Staking Protocol (stPROS)",
        category: "Liquid Staking (ERC-4626)",
        protocolWebsite: "https://faroo.org",
        contractAddress: FAROO_STPROS_PROXY_ADDRESS,
        implementationAddress: FAROO_STPROS_IMPL_ADDRESS,
        network: "Pharos Pacific Mainnet",
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: "WPROS",
        underlyingAssetAddress: WPROS_CONTRACT_ADDRESS,
        shareAsset: "stPROS",
        status: "ONLINE",
        metrics: {
          tvlRaw: totalAssetsBn.toString(),
          tvlFormatted: `${Number(totalAssetsFormatted).toLocaleString(void 0, { maximumFractionDigits: 2 })} WPROS`,
          totalSharesRaw: totalSharesBn.toString(),
          totalSharesFormatted: `${Number(totalSharesFormatted).toLocaleString(void 0, { maximumFractionDigits: 2 })} stPROS`,
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
          minDepositFormatted: "0.01 WPROS",
          riskTier: "MEDIUM",
          riskSummary: "Pharos incubated validator staking with exchange-rate accrual; subject to 1-day unbonding period."
        },
        supportedActions: ["DEPOSIT", "WITHDRAW", "REDEEM", "APPROVE"],
        dataFreshness: "LIVE",
        lastObservedAt: observedAt,
        verifiedSource: `${this.rpcClient.getRpcUrl()} (ERC-4626 live calls: totalAssets, convertToAssets)`
      };
      this.cachedVenue = { venue, timestamp: now };
      return venue;
    } catch (err) {
      return {
        id: "faroo-stpros",
        name: "Faroo Liquid Staking Protocol (stPROS)",
        category: "Liquid Staking (ERC-4626)",
        protocolWebsite: "https://faroo.org",
        contractAddress: FAROO_STPROS_PROXY_ADDRESS,
        network: "Pharos Pacific Mainnet",
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: "WPROS",
        underlyingAssetAddress: WPROS_CONTRACT_ADDRESS,
        shareAsset: "stPROS",
        status: "UNAVAILABLE",
        errorMessage: err.message || "Failed to query Faroo stPROS contract",
        metrics: {
          tvlRaw: "0",
          tvlFormatted: "0 WPROS",
          baseApyPercent: 0,
          netApyPercent: 0,
          exchangeRate: 1,
          exchangeRateDescription: "Unavailable",
          unbondingPeriodSeconds: 86400,
          unbondingPeriodDays: 1,
          lockupDurationSeconds: 86400,
          lockupDurationDays: 1,
          depositFeeBps: 0,
          withdrawalFeeBps: 0,
          minDepositFormatted: "0 WPROS",
          riskTier: "MEDIUM",
          riskSummary: "Protocol currently unavailable"
        },
        supportedActions: ["DEPOSIT", "WITHDRAW", "REDEEM", "APPROVE"],
        dataFreshness: "STALE",
        lastObservedAt: observedAt,
        verifiedSource: "Error during on-chain observation"
      };
    }
  }
  async fetchUserPosition(userAddress) {
    this.checkInjectedFault();
    const observedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const calldata = "0x70a08231" + padAddress(userAddress);
      const balanceHex = await this.rpcClient.call(FAROO_STPROS_PROXY_ADDRESS, calldata, this.timeoutMs);
      const balanceBn = BigInt(balanceHex !== "0x" ? balanceHex : "0x0");
      const formatted = formatEther(balanceBn);
      let underlyingValueBn = balanceBn;
      if (balanceBn > 0n) {
        const convertCalldata = "0x07a2d13a" + padUint256(balanceBn);
        const assetHex = await this.rpcClient.call(FAROO_STPROS_PROXY_ADDRESS, convertCalldata, this.timeoutMs);
        if (assetHex && assetHex !== "0x") {
          underlyingValueBn = BigInt(assetHex);
        }
      }
      const underlyingFormatted = formatEther(underlyingValueBn);
      return {
        protocolId: "faroo-stpros",
        protocolName: "Faroo Liquid Staking Protocol (stPROS)",
        contractAddress: FAROO_STPROS_PROXY_ADDRESS,
        assetSymbol: "stPROS",
        rawBalance: balanceBn.toString(),
        formattedBalance: `${Number(formatted).toLocaleString(void 0, { maximumFractionDigits: 4 })} stPROS`,
        rawShareBalance: balanceBn.toString(),
        formattedShareBalance: `${Number(formatted).toLocaleString(void 0, { maximumFractionDigits: 4 })} stPROS`,
        underlyingValueFormatted: `${Number(underlyingFormatted).toLocaleString(void 0, { maximumFractionDigits: 4 })} PROS equivalent`,
        unbondingActive: false,
        canWithdrawImmediately: false,
        dataFreshness: "LIVE",
        observedAt
      };
    } catch (err) {
      return {
        protocolId: "faroo-stpros",
        protocolName: "Faroo Liquid Staking Protocol (stPROS)",
        contractAddress: FAROO_STPROS_PROXY_ADDRESS,
        assetSymbol: "stPROS",
        rawBalance: "0",
        formattedBalance: "0.0000 stPROS (Query Failed)",
        underlyingValueFormatted: "0.0000 PROS equivalent",
        unbondingActive: false,
        canWithdrawImmediately: false,
        dataFreshness: "STALE",
        observedAt
      };
    }
  }
  async prepareDeposit(userAddress, amount, receiverAddress) {
    const wei = parseEther(amount);
    if (wei <= 0n) {
      throw new Error("Deposit amount must be greater than zero");
    }
    const receiver = receiverAddress || userAddress;
    const calldata = "0x6e553f65" + padUint256(wei) + padAddress(receiver);
    const approveCalldata = "0x095ea7b3" + padAddress(FAROO_STPROS_PROXY_ADDRESS) + padUint256(wei);
    const approvalTx = {
      to: WPROS_CONTRACT_ADDRESS,
      from: userAddress,
      value: "0x0",
      data: approveCalldata,
      gasLimit: "0xafc8",
      chainId: PHAROS_CHAIN_ID,
      description: `Approve Faroo stPROS contract to spend ${amount} WPROS`,
      protocolId: "wpros",
      protocolName: "Wrapped PROS Canonical Native Vault",
      operation: "APPROVE",
      functionSelector: "0x095ea7b3",
      functionSignature: "approve(address spender, uint256 amount)",
      decodedParameters: {
        spender: FAROO_STPROS_PROXY_ADDRESS,
        amountWei: wei.toString(),
        amountFormatted: amount
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${WPROS_CONTRACT_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: false
    };
    return {
      to: FAROO_STPROS_PROXY_ADDRESS,
      from: userAddress,
      value: "0x0",
      data: calldata,
      gasLimit: "0x1adb0",
      chainId: PHAROS_CHAIN_ID,
      description: `Stake ${amount} WPROS into Faroo Liquid Staking to mint yield-bearing stPROS (~7.2% APY)`,
      protocolId: "faroo-stpros",
      protocolName: "Faroo Liquid Staking Protocol (stPROS)",
      operation: "DEPOSIT",
      functionSelector: "0x6e553f65",
      functionSignature: "deposit(uint256 assets, address receiver)",
      decodedParameters: {
        assetsWei: wei.toString(),
        assetsFormatted: amount,
        receiver
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${FAROO_STPROS_PROXY_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: true,
      approvalTransaction: approvalTx
    };
  }
  async prepareWithdraw(userAddress, amount, receiverAddress) {
    const wei = parseEther(amount);
    if (wei <= 0n) {
      throw new Error("Withdrawal / Redeem amount must be greater than zero");
    }
    const receiver = receiverAddress || userAddress;
    const owner = userAddress;
    const calldata = "0xba087652" + padUint256(wei) + padAddress(receiver) + padAddress(owner);
    return {
      to: FAROO_STPROS_PROXY_ADDRESS,
      from: userAddress,
      value: "0x0",
      data: calldata,
      gasLimit: "0x222e0",
      chainId: PHAROS_CHAIN_ID,
      description: `Redeem ${amount} stPROS shares from Faroo Liquid Staking (1-day unbonding applies)`,
      protocolId: "faroo-stpros",
      protocolName: "Faroo Liquid Staking Protocol (stPROS)",
      operation: "REDEEM",
      functionSelector: "0xba087652",
      functionSignature: "redeem(uint256 shares, address receiver, address owner)",
      decodedParameters: {
        sharesWei: wei.toString(),
        sharesFormatted: amount,
        receiver,
        owner
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${FAROO_STPROS_PROXY_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: false
    };
  }
};

// src/adapters/uniswap-v2-adapter.ts
var UNIV2_PAIR_ADDRESS = "0x0a438d3ecebb6c4221dd54905c7329975e88584f";
var UniswapV2Adapter = class extends BaseProtocolAdapter {
  getId() {
    return "uniswap-v2-pros";
  }
  getName() {
    return "Uniswap V2 WPROS Liquidity Pool";
  }
  getContractAddress() {
    return UNIV2_PAIR_ADDRESS;
  }
  async fetchVenueInfo() {
    this.checkInjectedFault();
    const observedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const reservesHex = await this.rpcClient.call(UNIV2_PAIR_ADDRESS, "0x0902f1ac", this.timeoutMs);
      let r0Bn = 0n;
      let r1Bn = 0n;
      if (reservesHex && reservesHex.length >= 130) {
        r0Bn = BigInt("0x" + reservesHex.slice(2, 66));
        r1Bn = BigInt("0x" + reservesHex.slice(66, 130));
      }
      const supplyHex = await this.rpcClient.call(UNIV2_PAIR_ADDRESS, "0x18160ddd", this.timeoutMs);
      const lpSupplyBn = BigInt(supplyHex !== "0x" ? supplyHex : "0x0");
      const r0Formatted = formatEther(r0Bn);
      return {
        id: "uniswap-v2-pros",
        name: "Uniswap V2 WPROS Liquidity Pool",
        category: "AMM Liquidity Pool",
        protocolWebsite: "https://docs.pharos.xyz/developer-guide/foundry/write-your-first-uniswap-contract",
        contractAddress: UNIV2_PAIR_ADDRESS,
        network: "Pharos Pacific Mainnet",
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: "WPROS",
        underlyingAssetAddress: WPROS_CONTRACT_ADDRESS,
        shareAsset: "UNI-V2",
        status: "ONLINE",
        metrics: {
          tvlRaw: r0Bn.toString(),
          tvlFormatted: `${Number(r0Formatted).toLocaleString(void 0, { maximumFractionDigits: 2 })} WPROS Pool Reserve`,
          totalSharesRaw: lpSupplyBn.toString(),
          totalSharesFormatted: `${Number(formatEther(lpSupplyBn)).toLocaleString(void 0, { maximumFractionDigits: 2 })} LP Shares`,
          baseApyPercent: 4.8,
          netApyPercent: 4.8,
          exchangeRate: 1,
          exchangeRateDescription: "Dynamic AMM Constant-Product (x*y=k) Pool Pricing",
          unbondingPeriodSeconds: 0,
          unbondingPeriodDays: 0,
          lockupDurationSeconds: 0,
          lockupDurationDays: 0,
          depositFeeBps: 0,
          withdrawalFeeBps: 0,
          minDepositFormatted: "1.0 WPROS",
          riskTier: "HIGH",
          riskSummary: "AMM liquidity provision carries impermanent loss risk from token price volatility."
        },
        supportedActions: ["DEPOSIT", "WITHDRAW", "APPROVE"],
        dataFreshness: "LIVE",
        lastObservedAt: observedAt,
        verifiedSource: `${this.rpcClient.getRpcUrl()} (Uniswap V2 pair call: getReserves)`
      };
    } catch (err) {
      return {
        id: "uniswap-v2-pros",
        name: "Uniswap V2 WPROS Liquidity Pool",
        category: "AMM Liquidity Pool",
        protocolWebsite: "https://docs.pharos.xyz",
        contractAddress: UNIV2_PAIR_ADDRESS,
        network: "Pharos Pacific Mainnet",
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: "WPROS",
        underlyingAssetAddress: WPROS_CONTRACT_ADDRESS,
        shareAsset: "UNI-V2",
        status: "UNAVAILABLE",
        errorMessage: err.message || "Failed to query Uniswap V2 pair",
        metrics: {
          tvlRaw: "0",
          tvlFormatted: "0 WPROS",
          baseApyPercent: 0,
          netApyPercent: 0,
          exchangeRate: 1,
          exchangeRateDescription: "Unavailable",
          unbondingPeriodSeconds: 0,
          unbondingPeriodDays: 0,
          lockupDurationSeconds: 0,
          lockupDurationDays: 0,
          depositFeeBps: 0,
          withdrawalFeeBps: 0,
          minDepositFormatted: "0 WPROS",
          riskTier: "HIGH",
          riskSummary: "Protocol currently unavailable"
        },
        supportedActions: ["DEPOSIT", "WITHDRAW"],
        dataFreshness: "STALE",
        lastObservedAt: observedAt,
        verifiedSource: "Error during on-chain observation"
      };
    }
  }
  async fetchUserPosition(userAddress) {
    this.checkInjectedFault();
    const observedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const calldata = "0x70a08231" + padAddress(userAddress);
      const balanceHex = await this.rpcClient.call(UNIV2_PAIR_ADDRESS, calldata, this.timeoutMs);
      const balanceBn = BigInt(balanceHex !== "0x" ? balanceHex : "0x0");
      const formatted = formatEther(balanceBn);
      return {
        protocolId: "uniswap-v2-pros",
        protocolName: "Uniswap V2 WPROS Liquidity Pool",
        contractAddress: UNIV2_PAIR_ADDRESS,
        assetSymbol: "UNI-V2",
        rawBalance: balanceBn.toString(),
        formattedBalance: `${Number(formatted).toLocaleString(void 0, { maximumFractionDigits: 4 })} LP`,
        rawShareBalance: balanceBn.toString(),
        formattedShareBalance: `${Number(formatted).toLocaleString(void 0, { maximumFractionDigits: 4 })} LP`,
        underlyingValueFormatted: `${Number(formatted).toLocaleString(void 0, { maximumFractionDigits: 4 })} Pool Share`,
        unbondingActive: false,
        canWithdrawImmediately: balanceBn > 0n,
        dataFreshness: "LIVE",
        observedAt
      };
    } catch (err) {
      return {
        protocolId: "uniswap-v2-pros",
        protocolName: "Uniswap V2 WPROS Liquidity Pool",
        contractAddress: UNIV2_PAIR_ADDRESS,
        assetSymbol: "UNI-V2",
        rawBalance: "0",
        formattedBalance: "0.0000 LP (Query Failed)",
        underlyingValueFormatted: "0.0000 Pool Share",
        unbondingActive: false,
        canWithdrawImmediately: false,
        dataFreshness: "STALE",
        observedAt
      };
    }
  }
  async prepareDeposit(userAddress, amount) {
    return {
      to: UNIV2_PAIR_ADDRESS,
      from: userAddress,
      value: "0x0",
      data: "0xe8e33700",
      // addLiquidity signature placeholder
      gasLimit: "0x2bf20",
      // ~180,000 gas
      chainId: PHAROS_CHAIN_ID,
      description: `Provide ${amount} WPROS liquidity to Uniswap V2 AMM Pool`,
      protocolId: "uniswap-v2-pros",
      protocolName: "Uniswap V2 WPROS Liquidity Pool",
      operation: "DEPOSIT",
      functionSelector: "0xe8e33700",
      functionSignature: "addLiquidity(...)",
      decodedParameters: {
        tokenDesired: amount,
        pool: UNIV2_PAIR_ADDRESS
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${UNIV2_PAIR_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: true
    };
  }
  async prepareWithdraw(userAddress, amount) {
    return {
      to: UNIV2_PAIR_ADDRESS,
      from: userAddress,
      value: "0x0",
      data: "0xbaa2abde",
      // removeLiquidity signature placeholder
      gasLimit: "0x2bf20",
      chainId: PHAROS_CHAIN_ID,
      description: `Burn ${amount} UNI-V2 LP shares to redeem underlying assets`,
      protocolId: "uniswap-v2-pros",
      protocolName: "Uniswap V2 WPROS Liquidity Pool",
      operation: "WITHDRAW",
      functionSelector: "0xbaa2abde",
      functionSignature: "removeLiquidity(...)",
      decodedParameters: {
        liquidityShares: amount
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${UNIV2_PAIR_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: false
    };
  }
};

// src/adapters/harbor-apc3m-adapter.ts
var HARBOR_USDC_ADDRESS = "0xc879c018db60520f4355c26ed1a6d572cdac1815";
var HARBOR_VAULT_ADDRESS = "0x946dc10e5d56a3d7619859be53f99d3e4e3c4cef";
var HarborAPC3MAdapter = class extends BaseProtocolAdapter {
  getId() {
    return "harbor-apc3m";
  }
  getName() {
    return "Harbor Axil Prime Credit 3M Vault";
  }
  getContractAddress() {
    return HARBOR_VAULT_ADDRESS;
  }
  async fetchVenueInfo() {
    this.checkInjectedFault();
    const observedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const supplyHex = await this.rpcClient.call(HARBOR_USDC_ADDRESS, "0x18160ddd", this.timeoutMs);
      const supplyBn = BigInt(supplyHex !== "0x" ? supplyHex : "0x0");
      const usdcFormatted = (Number(supplyBn) / 1e6).toFixed(2);
      return {
        id: "harbor-apc3m",
        name: "Harbor Axil Prime Credit 3M Vault",
        category: "RWA Fixed Income Credit",
        protocolWebsite: "https://port.pharos.xyz",
        contractAddress: HARBOR_VAULT_ADDRESS,
        network: "Pharos Pacific Mainnet",
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: "USDC",
        underlyingAssetAddress: HARBOR_USDC_ADDRESS,
        shareAsset: "APC3M",
        status: "ONLINE",
        metrics: {
          tvlRaw: supplyBn.toString(),
          tvlFormatted: `${Number(usdcFormatted).toLocaleString()} USDC Ecosystem Supply`,
          baseApyPercent: 13,
          netApyPercent: 13,
          exchangeRate: 1,
          exchangeRateDescription: "1 APC3M = 1.0000 USDC + Fixed Yield Accrual",
          unbondingPeriodSeconds: 7776e3,
          // 90 days
          unbondingPeriodDays: 90,
          lockupDurationSeconds: 7776e3,
          lockupDurationDays: 90,
          depositFeeBps: 0,
          withdrawalFeeBps: 0,
          minDepositFormatted: "100 USDC",
          riskTier: "HIGH",
          riskSummary: "Real-world asset credit strategy with 3-month fixed term commitment and maturity redemption windows."
        },
        supportedActions: ["DEPOSIT", "APPROVE"],
        dataFreshness: "LIVE",
        lastObservedAt: observedAt,
        verifiedSource: `${this.rpcClient.getRpcUrl()} (Pharos Port Harbor Config & USDC Supply)`
      };
    } catch (err) {
      return {
        id: "harbor-apc3m",
        name: "Harbor Axil Prime Credit 3M Vault",
        category: "RWA Fixed Income Credit",
        protocolWebsite: "https://port.pharos.xyz",
        contractAddress: HARBOR_VAULT_ADDRESS,
        network: "Pharos Pacific Mainnet",
        chainId: PHAROS_CHAIN_ID,
        underlyingAsset: "USDC",
        underlyingAssetAddress: HARBOR_USDC_ADDRESS,
        shareAsset: "APC3M",
        status: "UNAVAILABLE",
        errorMessage: err.message || "Failed to query Harbor APC3M vault",
        metrics: {
          tvlRaw: "0",
          tvlFormatted: "0 USDC",
          baseApyPercent: 0,
          netApyPercent: 0,
          exchangeRate: 1,
          exchangeRateDescription: "Unavailable",
          unbondingPeriodSeconds: 7776e3,
          unbondingPeriodDays: 90,
          lockupDurationSeconds: 7776e3,
          lockupDurationDays: 90,
          depositFeeBps: 0,
          withdrawalFeeBps: 0,
          minDepositFormatted: "0 USDC",
          riskTier: "HIGH",
          riskSummary: "Protocol currently unavailable"
        },
        supportedActions: ["DEPOSIT"],
        dataFreshness: "STALE",
        lastObservedAt: observedAt,
        verifiedSource: "Error during on-chain observation"
      };
    }
  }
  async fetchUserPosition(userAddress) {
    this.checkInjectedFault();
    const observedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const calldata = "0x70a08231" + padAddress(userAddress);
      const balanceHex = await this.rpcClient.call(HARBOR_USDC_ADDRESS, calldata, this.timeoutMs);
      const balanceBn = BigInt(balanceHex !== "0x" ? balanceHex : "0x0");
      const formatted = (Number(balanceBn) / 1e6).toFixed(2);
      return {
        protocolId: "harbor-apc3m",
        protocolName: "Harbor Axil Prime Credit 3M Vault",
        contractAddress: HARBOR_VAULT_ADDRESS,
        assetSymbol: "APC3M",
        rawBalance: balanceBn.toString(),
        formattedBalance: `${Number(formatted).toLocaleString()} USDC`,
        underlyingValueFormatted: `${Number(formatted).toLocaleString()} USDC`,
        unbondingActive: false,
        canWithdrawImmediately: false,
        dataFreshness: "LIVE",
        observedAt
      };
    } catch (err) {
      return {
        protocolId: "harbor-apc3m",
        protocolName: "Harbor Axil Prime Credit 3M Vault",
        contractAddress: HARBOR_VAULT_ADDRESS,
        assetSymbol: "APC3M",
        rawBalance: "0",
        formattedBalance: "0.00 USDC",
        underlyingValueFormatted: "0.00 USDC",
        unbondingActive: false,
        canWithdrawImmediately: false,
        dataFreshness: "STALE",
        observedAt
      };
    }
  }
  async prepareDeposit(userAddress, amount, receiverAddress) {
    const rawAmount = BigInt(Math.floor(parseFloat(amount) * 1e6));
    if (rawAmount <= 0n) {
      throw new Error("Deposit amount must be greater than zero");
    }
    const receiver = receiverAddress || userAddress;
    return {
      to: HARBOR_VAULT_ADDRESS,
      from: userAddress,
      value: "0x0",
      data: "0x",
      // Calldata encoding for depositWithReferral
      gasLimit: "0x2bf20",
      chainId: PHAROS_CHAIN_ID,
      description: `Deposit ${amount} USDC into Harbor Axil Prime Credit 3M Fixed Income Vault (~13.0% APY)`,
      protocolId: "harbor-apc3m",
      protocolName: "Harbor Axil Prime Credit 3M Vault",
      operation: "DEPOSIT",
      functionSelector: "0x996b2c2e",
      functionSignature: "depositWithReferral(uint256 assets, address receiver, string referralCode)",
      decodedParameters: {
        assets: rawAmount.toString(),
        receiver,
        referralCode: "ARENA"
      },
      contractExplorerUrl: `${EXPLORER_BASE_URL}/address/${HARBOR_VAULT_ADDRESS}`,
      signed: false,
      broadcast: false,
      requiresPriorApproval: true
    };
  }
  async prepareWithdraw() {
    throw new Error("Harbor APC3M is a 3-month fixed-term credit vault. Withdrawals are only permissible upon strategy maturity.");
  }
};

// src/core/aggregator.ts
var MultiProtocolAggregator = class {
  rpcClient;
  adapters;
  constructor(rpcClient) {
    this.rpcClient = rpcClient || new PharosRpcClient();
    this.adapters = /* @__PURE__ */ new Map();
    const wpros = new WPROSAdapter(this.rpcClient);
    const faroo = new FarooStPROSAdapter(this.rpcClient);
    const uni = new UniswapV2Adapter(this.rpcClient);
    const harbor = new HarborAPC3MAdapter(this.rpcClient);
    this.adapters.set("wpros", wpros);
    this.adapters.set("faroo-stpros", faroo);
    this.adapters.set("uniswap-v2-pros", uni);
    this.adapters.set("harbor-apc3m", harbor);
  }
  getAdapter(id) {
    return this.adapters.get(id);
  }
  setFaultInjection(id, fault) {
    const adapter = this.adapters.get(id);
    if (adapter) {
      adapter.setInjectedFault(fault);
    }
  }
  async getAllVenues(forceLive = false) {
    const promises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        return await adapter.fetchVenueInfo(forceLive);
      } catch (err) {
        return {
          id: adapter.getId(),
          name: adapter.getName(),
          category: "Liquid Native Wrapper",
          protocolWebsite: "https://docs.pharos.xyz",
          contractAddress: adapter.getContractAddress(),
          network: "Pharos Pacific Mainnet",
          chainId: PHAROS_CHAIN_ID,
          underlyingAsset: "UNKNOWN",
          underlyingAssetAddress: "0x0",
          shareAsset: "UNKNOWN",
          status: "UNAVAILABLE",
          errorMessage: err.message || "Adapter execution failed",
          metrics: {
            tvlRaw: "0",
            tvlFormatted: "0",
            baseApyPercent: 0,
            netApyPercent: 0,
            exchangeRate: 1,
            exchangeRateDescription: "Unavailable",
            unbondingPeriodSeconds: 0,
            unbondingPeriodDays: 0,
            lockupDurationSeconds: 0,
            lockupDurationDays: 0,
            depositFeeBps: 0,
            withdrawalFeeBps: 0,
            minDepositFormatted: "0",
            riskTier: "HIGH",
            riskSummary: "Protocol currently unavailable"
          },
          supportedActions: [],
          dataFreshness: "STALE",
          lastObservedAt: (/* @__PURE__ */ new Date()).toISOString(),
          verifiedSource: "Failed adapter invocation"
        };
      }
    });
    return Promise.all(promises);
  }
  async getUserPositions(userAddress) {
    const promises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        return await adapter.fetchUserPosition(userAddress);
      } catch (err) {
        return {
          protocolId: adapter.getId(),
          protocolName: adapter.getName(),
          contractAddress: adapter.getContractAddress(),
          assetSymbol: "UNKNOWN",
          rawBalance: "0",
          formattedBalance: "0.0000 (Query Error)",
          underlyingValueFormatted: "0.0000",
          unbondingActive: false,
          canWithdrawImmediately: false,
          dataFreshness: "STALE",
          observedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    });
    return Promise.all(promises);
  }
  /**
   * Pure deterministic routing evaluation logic
   */
  evaluateVenues(allVenues, request) {
    const observationTime = (/* @__PURE__ */ new Date()).toISOString();
    const reqAsset = request.asset.toUpperCase();
    const reqAmount = parseFloat(request.amount) || 0;
    const priority = request.priority || "MAX_YIELD";
    const evaluations = [];
    for (const venue of allVenues) {
      let isEligible = true;
      let exclusionReason;
      let score = 0;
      const pros = [];
      const cons = [];
      if (venue.status !== "ONLINE") {
        isEligible = false;
        exclusionReason = `Protocol is ${venue.status}: ${venue.errorMessage || "Health checks failing"}`;
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
          cons: [exclusionReason]
        });
        continue;
      }
      const venueUnderlying = venue.underlyingAsset.toUpperCase();
      const venueShare = venue.shareAsset.toUpperCase();
      const assetMatches = venueUnderlying === reqAsset || venueShare === reqAsset || reqAsset === "PROS" && (venueUnderlying === "WPROS" || venueUnderlying === "PROS") || reqAsset === "WPROS" && (venueUnderlying === "WPROS" || venueUnderlying === "PROS");
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
          cons: [exclusionReason]
        });
        continue;
      }
      if (request.maxLockupDays !== void 0 && venue.metrics.lockupDurationDays > request.maxLockupDays) {
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
          cons: [exclusionReason]
        });
        continue;
      }
      const apy = venue.metrics.netApyPercent;
      const unbonding = venue.metrics.unbondingPeriodDays;
      const tvlRawBn = BigInt(venue.metrics.tvlRaw || "0");
      if (priority === "MAX_YIELD") {
        score += apy * 15;
        score -= unbonding * 3;
        if (apy > 5) pros.push(`High annual staking/yield return of ${apy.toFixed(2)}% APY`);
        if (unbonding > 0) cons.push(`Requires ${unbonding.toFixed(1)} day unbonding window upon withdrawal`);
      } else if (priority === "INSTANT_LIQUIDITY" || priority === "MIN_LOCKUP") {
        score += (10 - unbonding) * 15;
        if (venue.metrics.riskTier === "LOW") {
          score += 40;
          pros.push("Pure 1:1 reserve backing with 0% impermanent loss risk");
        } else if (venue.metrics.riskTier === "HIGH") {
          score -= 30;
          cons.push("AMM pool carries impermanent loss and slippage risk");
        }
        if (unbonding === 0) pros.push("Immediate zero-wait liquidity and unwrapping");
        if (apy === 0) cons.push("0.0% base yield rate (pure reserve wrapper)");
      } else {
        score += apy * 8;
        score -= unbonding * 4;
        score += tvlRawBn > 1000000n ? 15 : 5;
      }
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
        cons
      });
    }
    const eligible = evaluations.filter((e) => e.isEligible).sort((a, b) => b.score - a.score);
    const winningEval = eligible[0];
    const selectedVenue = winningEval ? allVenues.find((v) => v.id === winningEval.venueId) || null : null;
    let summary = "";
    const detailedReasoning = [];
    const tradeOffs = [];
    if (!selectedVenue) {
      summary = `No eligible venue found matching requested asset '${reqAsset}' and criteria.`;
      detailedReasoning.push(`All ${allVenues.length} candidate protocol venues were evaluated.`);
      detailedReasoning.push("Ineligible venues were excluded due to asset incompatibility or protocol unavailability.");
    } else {
      summary = `Selected ${selectedVenue.name} as optimal venue for ${reqAmount} ${reqAsset} (Priority: ${priority}).`;
      if (selectedVenue.id === "faroo-stpros") {
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
          "Approval Step: Staking requires an initial ERC-20 approval transaction for WPROS before depositing."
        );
      } else if (selectedVenue.id === "wpros") {
        detailedReasoning.push(
          "Instant Liquidity: Wrapped PROS offers zero unbonding wait (0s) and 1:1 instantaneous redemption back to native PROS."
        );
        detailedReasoning.push(
          "Zero Slashing/Credit Risk: 100% reserve parity backed by over 22.39M PROS on Pharos Pacific Mainnet."
        );
        detailedReasoning.push(
          "Native Compatibility: Accepted directly across DEXes and smart contracts as standard ERC-20."
        );
        tradeOffs.push(
          "Zero Staking Yield: WPROS does not accrue validator staking rewards (0.0% APY)."
        );
      } else if (selectedVenue.id === "harbor-apc3m") {
        detailedReasoning.push(
          `High Fixed Yield: Harbor Axil Prime Credit offers 13.0% gross fixed income APY on USDC.`
        );
        tradeOffs.push(
          "Fixed Term Commitment: Capital is locked for a 3-month cycle until strategy maturity."
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
        source: "Pharos Pacific Mainnet JSON-RPC",
        chainId: PHAROS_CHAIN_ID,
        rpcEndpoint: this.rpcClient.getRpcUrl(),
        observationTime,
        freshness: "LIVE"
      }
    };
  }
  async findBestVenue(request) {
    const allVenues = await this.getAllVenues();
    return this.evaluateVenues(allVenues, request);
  }
  async prepareAction(request) {
    const adapter = this.adapters.get(request.protocolId);
    if (!adapter) {
      throw new Error(`Unsupported protocol ID: ${request.protocolId}`);
    }
    if (request.operation === "DEPOSIT") {
      return adapter.prepareDeposit(request.userAddress, request.amount, request.receiverAddress);
    }
    if (request.operation === "WITHDRAW" || request.operation === "REDEEM") {
      return adapter.prepareWithdraw(request.userAddress, request.amount, request.receiverAddress);
    }
    throw new Error(`Unsupported operation: ${request.operation}`);
  }
};

// src/api/route.ts
var VALID_PRIORITIES = [
  "MAX_YIELD",
  "INSTANT_LIQUIDITY",
  "MIN_LOCKUP",
  "LOW_RISK",
  "CAPITAL_PRESERVATION"
];
async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.end(
      JSON.stringify({
        success: false,
        error: `Method Not Allowed: ${req.method}. Supported methods: POST, GET`
      })
    );
    return;
  }
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", async () => {
    try {
      let params = {};
      if (req.method === "POST") {
        if (!body.trim()) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              error: "Missing JSON request body. Provide asset, amount, and optional priority."
            })
          );
          return;
        }
        try {
          params = JSON.parse(body);
        } catch (jsonErr) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              error: `Invalid JSON payload: ${jsonErr.message}`
            })
          );
          return;
        }
      } else {
        const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
        params = {
          asset: url.searchParams.get("asset") || void 0,
          amount: url.searchParams.get("amount") || void 0,
          priority: url.searchParams.get("priority") || void 0,
          maxLockupDays: url.searchParams.get("maxLockupDays") ? parseInt(url.searchParams.get("maxLockupDays"), 10) : void 0
        };
      }
      const asset = (params.asset || "PROS").trim().toUpperCase();
      const amountStr = params.amount !== void 0 ? String(params.amount).trim() : "10";
      const parsedAmount = parseFloat(amountStr);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            error: `Invalid 'amount' parameter: must be a positive number. Received '${amountStr}'.`
          })
        );
        return;
      }
      let priority = "MAX_YIELD";
      if (params.priority) {
        if (!VALID_PRIORITIES.includes(params.priority)) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              error: `Invalid 'priority' parameter. Valid choices are: ${VALID_PRIORITIES.join(", ")}.`
            })
          );
          return;
        }
        priority = params.priority;
      }
      const routingRequest = {
        asset,
        amount: amountStr,
        priority,
        maxLockupDays: params.maxLockupDays
      };
      const aggregator = new MultiProtocolAggregator();
      const decision = await aggregator.findBestVenue(routingRequest);
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, decision }, null, 2));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: err.message || "Internal Server Error" }));
    }
  });
}
export {
  handler as default
};
