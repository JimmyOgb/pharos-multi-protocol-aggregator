# PROTOCOL CAPABILITY MATRIX

**Project:** Pharos Multi-Protocol Aggregator  
**Network:** Pharos Pacific Mainnet (Chain ID `1672`)  
**Legend:**
- **VERIFIED:** On-chain confirmed with real RPC calls and verified contract bytecode.
- **PARTIALLY VERIFIED:** Documented and verified off-chain/on-chain but subject to external constraints.
- **NOT VERIFIED:** Unconfirmed or unverified on current network.
- **UNSUPPORTED:** Operation intentionally blocked or out of protocol scope.
- **BLOCKED:** Prohibited by security rules (e.g. key custody, autonomous signing).

---

## 1. Protocol Capability Matrix

| Feature / Capability | WPROS Canonical Vault | Faroo Liquid Staking (stPROS) | Uniswap V2 AMM Pool | Harbor Fixed Credit (APC3M) |
| :--- | :--- | :--- | :--- | :--- |
| **Contract Deployed & Verified** | **VERIFIED** (`0x52c4...f0b0`) | **VERIFIED** (`0x6b0a...5ec4`) | **VERIFIED** (`0x0a43...584f`) | **PARTIALLY VERIFIED** |
| **Target Asset** | Native `PROS` | `WPROS` (Wrapped PROS) | `WPROS` / Pair Token | `USDC` (`0xc879...1815`) |
| **TVL / Reserve Query** | **VERIFIED** (22.39M PROS) | **VERIFIED** (5.12M WPROS) | **VERIFIED** (1,731 WPROS) | **PARTIALLY VERIFIED** (API) |
| **Exchange Rate Query** | **VERIFIED** (1.0000 PROS/WPROS)| **VERIFIED** (1.008833 PROS/stPROS)| **VERIFIED** (Spot Price) | **VERIFIED** (13.0% Gross) |
| **User Position Query** | **VERIFIED** (`balanceOf`) | **VERIFIED** (`balanceOf`) | **VERIFIED** (`balanceOf`) | **VERIFIED** (`balanceOf`) |
| **Deposit Preparation** | **VERIFIED** (`deposit() payable`) | **VERIFIED** (`deposit(uint256,address)`) | **VERIFIED** (`addLiquidity`) | **VERIFIED** (`depositWithReferral`) |
| **Withdrawal Preparation** | **VERIFIED** (`withdraw(uint256)`) | **VERIFIED** (`redeem(uint256,...)`) | **VERIFIED** (`removeLiquidity`) | **PARTIALLY VERIFIED** (Maturity Gated)|
| **Approval Calldata Gen** | **UNSUPPORTED** (Native PROS)| **VERIFIED** (`approve(address,uint256)`)| **VERIFIED** (`approve(address,uint256)`)| **VERIFIED** (`approve(address,uint256)`)|
| **Lockup Duration** | **VERIFIED** (0 Days / Instant)| **VERIFIED** (1.0 Day / 86,400s) | **VERIFIED** (0 Days / Instant)| **VERIFIED** (90 Days / 3 Months) |
| **Slashing Risk** | **VERIFIED** (None / Pure Reserve)| **VERIFIED** (Validator Slashed Risk)| **VERIFIED** (Impermanent Loss)| **VERIFIED** (Borrower Default Risk)|
| **Autonomous Tx Signing** | **BLOCKED** (Rule 13) | **BLOCKED** (Rule 13) | **BLOCKED** (Rule 13) | **BLOCKED** (Rule 13) |
| **Private Key Custody** | **BLOCKED** (Rule 11) | **BLOCKED** (Rule 11) | **BLOCKED** (Rule 11) | **BLOCKED** (Rule 11) |

---

## 2. Evidence Summary

1. **WPROS (`0x52c48d4213107b20bc583832b0d951fb9ca8f0b0`):**
   - Verified via Pharos RPC `eth_getCode` (6,500 bytes).
   - `totalSupply` verified at 22,399,104 PROS.
2. **Faroo stPROS (`0x6b0a44c64190279f7034b77c13a566e914fe5ec4`):**
   - EIP-1967 proxy points to implementation `0xfd59860894e01773e9780b0d1dfae4ca2b56708d`.
   - ERC-4626 methods `totalAssets()`, `convertToAssets()`, `unbondingPeriod()` confirmed live.
   - Exchange rate confirmed at `1.008833 PROS per stPROS`.
