# PHASE 1 — OFFICIAL TASK AUDIT & SPECIFICATION

**Project:** Pharos Multi-Protocol Aggregator  
**Task Board:** Pharos Agent Arena (Season of AI)  
**Canonical Task URL:** [https://pharos-agent-arena.vercel.app/tasks/multi-protocol-aggregator](https://pharos-agent-arena.vercel.app/tasks/multi-protocol-aggregator)  
**Task Category:** Hard / Cross-tool / Advanced  
**Audit Timestamp:** 2026-11-11  
**Target Network:** Pharos Pacific Mainnet (Chain ID `1672`, EVM Compatible)  

---

## 1. Official Task Requirements

The official Pharos Agent Arena specification mandates:

| Requirement ID | Specification Requirement | Reviewer Verification Standard |
| :--- | :--- | :--- |
| **REQ-01** | **Multi-Protocol Integration** | Integrates at least two (2) genuinely different protocols or vaults behind one unified interface. No mocks, no duplicates under different names. |
| **REQ-02** | **Query & Action Support** | Supports both read queries (user positions, balances, yield rates/APY, TVL) and action preparation (deposit or withdrawal prepared as unsigned transactions for wallet signature). |
| **REQ-03** | **Explainable Venue Routing** | Routes each user request to the best suitable venue and explicitly explains the quantitative and qualitative reasons for the selection. |
| **REQ-04** | **Fault Isolation & Graceful Degradation** | Handles one protocol being unavailable, degraded, or reverting without breaking the aggregator or other protocol adapters. |
| **REQ-05** | **Architecture Documentation & Walkthrough** | Comprehensive architecture documentation, test evidence, deployment report, and user guide. |

---

## 2. Reviewer Expectations & Scoring Criteria

1. **Production Authenticity:** All protocol queries, contract calls, and parameters must be authentic and executed against live on-chain endpoints. No hardcoded or fabricated balances, rates, or simulation receipts.
2. **Non-Custodial Security Boundary:** AI agents and backend services must never solicit, store, or handle private keys, seed phrases, or signing credentials. All transactions must be generated strictly as unsigned payloads for client-side wallet review.
3. **Data Provenance Distinction:** The user interface must clearly differentiate between live observed data, cached data (with timestamps), stale data, unavailable endpoints, and prepared unsigned transactions.
4. **Resilient Routing Engine:** The routing system must evaluate liquidity, APY, lockup constraints, and protocol availability, providing transparent rationale rather than opaque recommendations.
5. **Clean Reproducibility:** The repository must be public, version-controlled, clearly documented, and deployed to a publicly accessible production URL.

---

## 3. Strict Non-Negotiable Rules Adherence

- **Rule 1-5 (No Fabrication):** Every data point (exchange rates, total assets, decimals, contract bytecodes) is fetched via genuine JSON-RPC calls to `https://rpc.pharos.xyz`.
- **Rule 6-10 (No Masquerading):** Outages or unavailable protocols are accurately reported with genuine error states rather than synthetic fallback values.
- **Rule 11-13 (Non-Custodial):** No key custody or autonomous transaction broadcasting.
- **Rule 14-15 (Safe Testing):** 100% read-only operations during development; $0.00 gas spent without authorization. No paid API dependencies.
