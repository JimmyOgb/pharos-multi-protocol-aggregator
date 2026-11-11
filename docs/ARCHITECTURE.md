# ARCHITECTURE SPECIFICATION — PHAROS MULTI-PROTOCOL AGGREGATOR

**Project:** Pharos Multi-Protocol Aggregator  
**Architectural Model:** Harbor-Style Agent Extended Across Multi-Protocol & Vault Venues  
**Network Target:** Pharos Pacific Mainnet (Chain ID `1672`)  

---

## 1. System Overview & Design Philosophy

The **Pharos Multi-Protocol Aggregator** is designed to provide institutional-grade aggregation across heterogeneous DeFi protocols and structured vaults on the Pharos L1 blockchain. Rather than siloed dApp interfaces or hardcoded yield rankings, the aggregator acts as an intelligent Harbor-style routing agent that:

1. **Continuously tracks on-chain venue metrics** (liquidity, reserves, exchange rates, APY, lockup durations, and health).
2. **Maintains complete protocol adapter isolation** so that an outage in one venue cannot cascade or degrade operations across the broader aggregator (Requirement 04).
3. **Formulates explainable routing decisions** grounded in quantitative and qualitative criteria (APY, liquidity depth, unbonding queues, impermanent loss risk).
4. **Executes strictly non-custodial transaction preparation** (`signed: false`, `broadcast: false`) for client wallet review.

```
+---------------------------------------------------------------------------------------------------+
|                                  UNIFIED USER INTERFACE                                           |
|       [Protocol Registry]   [Portfolio Inspector]   [Routing Studio]   [Transaction Workspace]    |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                 BACKEND AGGREGATION & API LAYER                                   |
|   /api/health       /api/protocols       /api/positions       /api/route       /api/prepare       |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                              MULTI-PROTOCOL AGGREGATOR ENGINE                                     |
|           - Concurrent Query Coordinator (Independent Timeout Handlers)                           |
|           - Multi-Factor Venue Evaluation & Scoring Algorithm                                     |
|           - Explainability Generator (Grounding, Pros/Cons, Trade-Offs)                            |
|           - Non-Custodial EVM Calldata Encoder                                                    |
+---------------------------------------------------------------------------------------------------+
                   |                         |                         |                        |
                   v                         v                         v                        v
          +-----------------+       +-----------------+       +-----------------+      +-----------------+
          |  WPROS Adapter  |       |   Faroo stPROS  |       | Uniswap V2 Pool |      |   Harbor APC    |
          |  (Native Wrap)  |       | (Liquid Staking)|       |   (AMM Pool)    |      |  (RWA Credit)   |
          +-----------------+       +-----------------+       +-----------------+      +-----------------+
                   |                         |                         |                        |
                   +-------------------------+-------------------------+------------------------+
                                                  |
                                                  v  JSON-RPC (eth_call / eth_getBalance)
                               +-------------------------------------+
                               |     PHAROS PACIFIC MAINNET (1672)   |
                               |        https://rpc.pharos.xyz       |
                               +-------------------------------------+
```

---

## 2. Core Architectural Components

### 2.1 Independent Protocol Adapters (`src/adapters/`)
Each protocol integration is encapsulated within its own isolated adapter extending `BaseProtocolAdapter`:
- **`WPROSAdapter`**: Interacts with the canonical Wrapped PROS contract (`0x52c48d4213107b20bc583832b0d951fb9ca8f0b0`). Provides 1:1 instantaneous wrapping and unwrapping between native `PROS` and `WPROS`.
- **`FarooStPROSAdapter`**: Interacts with the Faroo Liquid Staking ERC-4626 Tokenized Vault (`0x6b0a44c64190279f7034b77c13a566e914fe5ec4`). Queries live assets, shares, exchange rate appreciation (`convertToAssets`), unbonding duration (`unbondingPeriod`), and prepares staking/redemption calldata.
- **`UniswapV2Adapter`**: Inspects automated market maker reserves and liquidity for WPROS on Pharos (`0x0a438d3ecebb6c4221dd54905c7329975e88584f`).
- **`HarborAPC3MAdapter`**: Fixed income real-world asset credit vault (`0x946dc10e5d56a3d7619859be53f99d3e4e3c4cef`) for USDC with 3-month fixed maturity cycles.

### 2.2 Fault Isolation Engine (Requirement REQ-04)
Every adapter operates with:
- **Per-protocol request timeouts** (12,000ms ceiling).
- **Try/catch boundary containment**: An unhandled exception or revert in Adapter B leaves Adapter A untouched.
- **Circuit breaker & fault tagging**: Failed protocols are returned with `status: 'UNAVAILABLE'` and specific diagnostic messages, cleanly excluded from routing recommendations while preserving remaining venues.

### 2.3 Venue Routing & Explainability Engine (`src/core/aggregator.ts`)
The routing engine applies a 4-tier filtering and scoring pipeline:
1. **Health Verification**: Excludes offline or reverting venues.
2. **Asset Compatibility**: Matches requested deposit token (`PROS`, `WPROS`, `USDC`) against venue underlying assets.
3. **Lockup Constraints**: Verifies that venue unbonding days do not exceed user-specified limits.
4. **Weighted Scoring**: Evaluates candidate venues against user intent:
   - `MAX_YIELD`: Prioritizes net APY while penalizing unbonding days.
   - `INSTANT_LIQUIDITY`: Prioritizes zero unbonding and pure 1:1 reserve backing (`LOW` risk tier) while penalizing AMM impermanent loss risk.
   - `BALANCED`: Optimizes across yield, TVL safety, and unbonding duration.

### 2.4 Non-Custodial Execution Layer (`src/core/rpc-client.ts`)
- Calldata is compiled deterministically using standard EVM ABI rules.
- The server never has access to private keys or signing capabilities.
- Prepared transactions are presented with exact calldata, gas estimate, destination address, and network verification for user signature in their connected Web3 wallet.
