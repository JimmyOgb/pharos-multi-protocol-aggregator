# Pharos Multi-Protocol Aggregator

A production-grade, Harbor-style multi-protocol aggregator and intelligent routing agent built for the **Pharos Network** (Pharos Pacific Mainnet, Chain ID `1672`).

The aggregator unifies heterogeneous DeFi protocols, tokenized vaults, liquid staking opportunities, and AMM pools behind a single interface. Users can inspect live on-chain positions and yields, compare candidate venues across multiple dimensions (APY, liquidity depth, unbonding periods, risk tiers), and prepare strictly non-custodial deposit or withdrawal transactions.

---

## 1. Product Overview

### The Problem
DeFi applications and vaults on new Layer 1 ecosystems like Pharos are typically fragmented across disparate portals, interfaces, and contract standards. Users face friction evaluating trade-offs between:
- Instant liquidity wrappers (e.g., Wrapped PROS with 0s unbonding but 0% APY).
- Compounding validator liquid staking vaults (e.g., Faroo stPROS with ~7.2% APY but 1-day unbonding).
- Automated market maker liquidity pools (e.g., Uniswap V2 with trading fee yield but impermanent loss risk).
- Fixed-income real-world asset credit vaults (e.g., Harbor Axil Prime Credit with 13% APY but 3-month lockups).

Furthermore, conventional aggregators frequently suffer from fragile, monolithic integrations where an RPC error or contract upgrade in one protocol crashes the entire application.

### The Solution
The **Pharos Multi-Protocol Aggregator** introduces:
1. **Unified Cross-Protocol Interface:** A single dashboard to monitor, compare, and interact with multiple verified protocols on Pharos Pacific Mainnet.
2. **Explainable Routing Engine:** Evaluates candidate venues against user intent (`MAX_YIELD`, `INSTANT_LIQUIDITY`, `BALANCED`) and outputs grounded, quantitative reasons for the selection along with explicit trade-offs.
3. **Resilient Adapter Architecture:** Complete fault isolation per adapter (Requirement 04). If one protocol reverts or times out, the aggregator gracefully degrades, marks the affected venue as unavailable, and continues serving live data from healthy venues.
4. **Strictly Non-Custodial Security:** Generates validated, unsigned transaction calldata payloads (`signed: false`, `broadcast: false`) for client-side wallet review in MetaMask, OKX Wallet, or Binance Web3 Wallet.

---

## 2. Architecture & Design

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

## 3. Integrated Protocols & On-Chain Deployments

All protocols integrated in this application exist and operate on **Pharos Pacific Mainnet (Chain ID 1672)**:

| Protocol Name | Category | Contract Address | Underlying Asset | Live TVL / Reserve | APY | Unbonding Window |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Wrapped PROS (WPROS)** | Liquid Native Wrapper | `0x52c48d4213107b20bc583832b0d951fb9ca8f0b0` | Native `PROS` | >22.39M PROS | 0.0% | 0s (Instant) |
| **Faroo Liquid Staking (stPROS)** | Tokenized Vault (ERC-4626) | `0x6b0a44c64190279f7034b77c13a566e914fe5ec4` | `WPROS` | >5.12M WPROS | ~7.2% | 1.0 Day (86,400s) |
| **Uniswap V2 WPROS Pool** | AMM Liquidity Pool | `0x0a438d3ecebb6c4221dd54905c7329975e88584f` | `WPROS` | 17.3K WPROS | ~4.8% | 0s (Instant) |
| **Harbor Axil Prime Credit (APC3M)** | RWA Fixed Credit | `0x946dc10e5d56a3d7619859be53f99d3e4e3c4cef` | `USDC` | 18.0M USDC | 13.0% | 90 Days (3 Months) |

---

## 4. Venue-Selection & Routing Logic

When a user submits a deposit or routing query, the aggregator processes the request through a multi-factor evaluation pipeline:
1. **Availability Gate:** Disqualifies any venue currently tagged `UNAVAILABLE` or `DEGRADED`.
2. **Asset Compatibility Gate:** Ensures the venue accepts the target asset (e.g. `PROS`, `WPROS`, `USDC`).
3. **Lockup Boundary Gate:** Excludes venues with lockup durations exceeding user constraints.
4. **Weighted Scoring:**
   - **`MAX_YIELD`:** Rewards net APY while applying a calibrated unbonding penalty.
   - **`INSTANT_LIQUIDITY`:** Prioritizes 0-day unbonding and pure 1:1 reserve backing (`LOW` risk tier) while penalizing AMM impermanent loss risk.
   - **`BALANCED`:** Balances yield return, TVL safety depth, and lockup duration.
5. **Grounded Explainability:** The response provides a concise summary, bulleted reasoning derived from verified metrics, explicit trade-off warnings, and a transparent evaluation matrix.

---

## 5. Multi-Protocol Failure Handling (Requirement 04)

The aggregator is engineered to prevent single points of failure:
- **Independent Request Timeouts:** Each adapter query is bounded by an `AbortController` timeout (12,000ms).
- **Graceful Error Containment:** If Faroo stPROS times out or reverts, the error is isolated to `FarooStPROSAdapter`. WPROS and Uniswap adapters continue serving live data unimpeded.
- **Failover Routing:** The routing engine automatically excludes the degraded venue, notes the outage in the explanation, and failovers to the highest viable alternative.
- **Interactive Fault Sandbox:** The application features a dedicated **Fault Isolation Sandbox** tab in the UI (and via `/api/fault-test`) allowing reviewers to simulate timeouts or reverts and observe live degraded-mode operation.

---

## 6. Non-Custodial Safety Boundaries

- **Zero Key Custody:** The application never requests, stores, or handles private keys, seed phrases, or credentials.
- **Zero Autonomous Broadcasting:** State-changing operations are compiled strictly as unsigned transaction payloads.
- **Full Parameter Transparency:** The UI displays destination address, native value in hex, compiled calldata, gas estimate, and direct links to PharosScan.
- **Client Execution:** Transactions must be signed by the user through their connected Web3 wallet (MetaMask, OKX Wallet, Binance Web3 Wallet).

---

## 7. Installation & Local Development

### Prerequisites
- Node.js v20+ or v24+
- npm v10+

### Setup Commands
```bash
# Clone the repository
git clone https://github.com/JimmyOgb/pharos-multi-protocol-aggregator.git
cd pharos-multi-protocol-aggregator

# Install dependencies (fast, zero bloat)
npm install

# Run unit tests (deterministic, ~300ms)
npm test

# Run live RPC integration tests against Pharos Pacific Mainnet
npm run test:integration

# Run all unit and integration tests
npm run test:all

# Build serverless API endpoints
npm run build

# Start local server (http://localhost:3000)
npm start
```

---

## 8. API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check and per-protocol connectivity status. |
| `/api/protocols` | `GET` | Lists all integrated protocols, live TVL, APYs, addresses, and data provenance. |
| `/api/positions?address=0x...` | `GET` | Queries user balances and share values across all integrated venues. |
| `/api/route` | `POST / GET` | Evaluates options and returns optimal venue with explainable rationale. |
| `/api/prepare` | `POST` | Prepares an unsigned transaction calldata payload for deposit, withdrawal, or approval. |
| `/api/fault-test?target=faroo-stpros&fault=TIMEOUT` | `GET` | Verifiable fault-injection harness demonstrating Requirement 04. |

---

## 9. Verification & Audit Documentation

Comprehensive technical documentation is maintained in the `docs/` directory:
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System architecture, data flow, and components.
- [`docs/PROTOCOL_INTEGRATIONS.md`](docs/PROTOCOL_INTEGRATIONS.md) — On-chain protocol specifications and verified contract bytecodes.
- [`docs/ROUTING_AND_SELECTION.md`](docs/ROUTING_AND_SELECTION.md) — Mathematical scoring models and explainability structure.
- [`docs/DATA_PROVENANCE.md`](docs/DATA_PROVENANCE.md) — Real RPC data provenance and freshness categorization.
- [`docs/FAILURE_HANDLING.md`](docs/FAILURE_HANDLING.md) — Fault isolation mechanics and degraded operation proof.
- [`docs/TRANSACTION_SAFETY.md`](docs/TRANSACTION_SAFETY.md) — Non-custodial security policies and calldata specifications.
- [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md) — Automated test results and execution records.
- [`docs/DEPLOYMENT_REPORT.md`](docs/DEPLOYMENT_REPORT.md) — Production deployment audit and live URL verification.
- [`docs/FINAL_REQUIREMENTS_MATRIX.md`](docs/FINAL_REQUIREMENTS_MATRIX.md) — Comprehensive compliance verification against all 5 task requirements.

---

## 10. License

MIT License. Authored by [JimmyOgb](https://github.com/JimmyOgb).
