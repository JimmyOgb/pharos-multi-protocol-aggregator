# ROUTING AND SELECTION ENGINE SPECIFICATION

**Project:** Pharos Multi-Protocol Aggregator  
**Task Requirement:** REQ-03 (Routes each request to the best venue and explains why it chose it)  

---

## 1. Routing Engine Overview

The aggregator does not blindly route funds to the venue advertising the highest nominal APY. A venue that is unavailable, stale, incompatible, or imposes unbonding restrictions conflicting with user constraints is disqualified.

### Evaluation Lifecycle:
```
1. Ingest User Request (Asset, Amount, Priority, MaxLockupDays)
   ↓
2. Filter Ineligible Venues (Offline, Asset Mismatch, Exceeded Lockup)
   ↓
3. Multi-Factor Scoring (Yield Weighting, Liquidity Scoring, Risk Penalties, TVL Depth)
   ↓
4. Sort Candidates & Select Winner
   ↓
5. Compile Explainability Output (Selection Summary, Grounded Rationale, Trade-Offs, Matrix)
```

---

## 2. Scoring Formulations

### 2.1 Priority: `MAX_YIELD`
Designed for yield-seeking capital:
$$\text{Score} = (\text{Net APY} \times 15) - (\text{Unbonding Days} \times 3) + \text{TVL Bonus}$$
- Rewards compounding validator staking rewards and yield accrual.
- Minor penalty for unbonding delays.
- Winning Venue: **Faroo Liquid Staking (stPROS)** with ~7.20% APY.

### 2.2 Priority: `INSTANT_LIQUIDITY` / `MIN_LOCKUP`
Designed for active traders, arbitrageurs, and liquidity managers requiring immediate unwrapping:
$$\text{Score} = (10 - \text{Unbonding Days}) \times 15 + (\text{Low-Risk Pure Wrapper Bonus: } +40) - (\text{AMM Risk Penalty: } -30)$$
- Heavily penalizes any unbonding queue or lockup period.
- Strongly prioritizes pure 1:1 reserve wrappers with zero impermanent loss risk.
- Winning Venue: **Wrapped PROS (WPROS)** with 0s unbonding and 1:1 instantaneous unwrap.

### 2.3 Priority: `BALANCED`
$$Score = (\text{Net APY} \times 8) - (\text{Unbonding Days} \times 4) + (\text{TVL Depth Bonus: } +15)$$
- Optimizes across yield yield, safe TVL, and reasonable unbonding delays.

---

## 3. Explainability Output Structure

Every routing decision provides:
1. **`selectionSummary`**: Executive verdict outlining selected venue, asset, amount, and priority.
2. **`detailedReasoning`**: Bulleted list of quantitative and qualitative facts justifying the win (e.g. validator compounding, exchange rate growth, TVL security).
3. **`tradeOffs`**: Explicit disclosures of compromises the user must accept (e.g., 1-day unbonding window, ERC-20 approval requirement, fixed lockup).
4. **`evaluations`**: Complete matrix of all candidate venues with their score, eligibility status, pros, and exclusion reasons.
5. **`dataProvenance`**: Source RPC endpoint, chain ID, observation timestamp, and freshness flag.
