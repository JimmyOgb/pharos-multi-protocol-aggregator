# PROTOCOL INTEGRATIONS REFERENCE

**Project:** Pharos Multi-Protocol Aggregator  
**Network:** Pharos Pacific Mainnet (`Chain ID 1672`)  

---

## 1. Integrated Protocols Specification

### 1.1 Protocol 1: Wrapped PROS (WPROS) Canonical Native Vault
- **Contract Address:** `0x52c48d4213107b20bc583832b0d951fb9ca8f0b0`
- **Category:** Liquid Native Asset Wrapper
- **Underlying Asset:** Native `PROS` (18 decimals)
- **Share Asset:** `WPROS` (18 decimals)
- **Verified Code Size:** 6,500 bytes
- **Total Supply (Live Observed):** >22,396,000 PROS
- **Net APY:** 0.0% (Base liquidity wrapper, 1:1 parity)
- **Lockup / Unbonding:** 0 seconds (Instant unwrapping)
- **Smart Contract Methods:**
  - `deposit()` (`0xd0e30db0`): Payable function minting WPROS 1:1 for native PROS.
  - `withdraw(uint256 wad)` (`0x2e1a7d4d`): Burns WPROS and transfers native PROS back to sender.
  - `balanceOf(address)` (`0x70a08231`): Standard ERC-20 balance.
  - `totalSupply()` (`0x18160ddd`): Total circulating supply.

### 1.2 Protocol 2: Faroo Liquid Staking Protocol (stPROS)
- **Contract Address (Proxy):** `0x6b0a44c64190279f7034b77c13a566e914fe5ec4` (EIP-1967)
- **Implementation Address:** `0xfd59860894e01773e9780b0d1dfae4ca2b56708d`
- **Category:** Liquid Staking Tokenized Vault (ERC-4626)
- **Underlying Asset:** `WPROS` (`0x52c48d4213107b20bc583832b0d951fb9ca8f0b0`)
- **Share Asset:** `stPROS` (18 decimals)
- **Verified Code Size:** 32,892 bytes (Implementation)
- **Total Assets (Live Observed):** >5,122,346 WPROS
- **Total Shares (Live Observed):** >5,077,495 stPROS
- **Exchange Rate:** 1.008833 PROS per stPROS (Accruing validator rewards)
- **Net APY:** ~7.20% APY
- **Lockup / Unbonding:** 86,400 seconds (1.0 day unbonding)
- **Smart Contract Methods:**
  - `deposit(uint256 assets, address receiver)` (`0x6e553f65`): ERC-4626 vault deposit.
  - `redeem(uint256 shares, address receiver, address owner)` (`0xba087652`): ERC-4626 redemption.
  - `totalAssets()` (`0x01e1d114`): Total pooled assets.
  - `convertToAssets(uint256 shares)` (`0x07a2d13a`): Exchange rate preview.
  - `unbondingPeriod()` (`0x6cf6d675`): Withdrawal delay duration.

### 1.3 Protocol 3: Uniswap V2 AMM Liquidity Pool
- **Contract Address:** `0x0a438d3ecebb6c4221dd54905c7329975e88584f`
- **Category:** AMM Liquidity Pool
- **Pool Assets:** WPROS & Secondary Token
- **Share Asset:** `UNI-V2` (LP token)
- **Net APY:** ~4.80% (Trading fee yield)
- **Lockup / Unbonding:** 0 seconds (Immediate LP burning)
- **Methods:** `getReserves()` (`0x0902f1ac`), `balanceOf(address)` (`0x70a08231`).

### 1.4 Protocol 4: Harbor Axil Prime Credit 3M Vault
- **Contract Address:** `0x946dc10e5d56a3d7619859be53f99d3e4e3c4cef`
- **Category:** Real-World Asset (RWA) Fixed Income Credit
- **Underlying Asset:** `USDC` (`0xc879c018db60520f4355c26ed1a6d572cdac1815`)
- **Net APY:** 13.0% Gross APY
- **Lockup / Unbonding:** 90 days (3-month cycle)
- **Methods:** `depositWithReferral(uint256,address,string)`.
