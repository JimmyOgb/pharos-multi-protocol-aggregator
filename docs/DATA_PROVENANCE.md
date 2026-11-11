# DATA PROVENANCE & FRESHNESS SPECIFICATION

**Project:** Pharos Multi-Protocol Aggregator  
**Network:** Pharos Pacific Mainnet (`Chain ID 1672`)  

---

## 1. Data Provenance Architecture

To comply with the non-negotiable rules against data fabrication, every metric displayed in the UI or returned via API is strictly tied to verified on-chain sources.

### Data Sources Matrix

| Metric | Source Mechanism | Endpoint / Target | Verification Method |
| :--- | :--- | :--- | :--- |
| **WPROS Supply / TVL** | `eth_call` | `0x52c48d4213107b20bc583832b0d951fb9ca8f0b0` (Selector `0x18160ddd`) | `totalSupply()` on Pharos RPC |
| **Faroo Total Assets** | `eth_call` | `0x6b0a44c64190279f7034b77c13a566e914fe5ec4` (Selector `0x01e1d114`) | ERC-4626 `totalAssets()` |
| **Faroo Exchange Rate** | `eth_call` | `0x6b0a44c64190279f7034b77c13a566e914fe5ec4` (Selector `0x07a2d13a`) | ERC-4626 `convertToAssets(1 ether)` |
| **Faroo Unbonding Days** | `eth_call` | `0x6b0a44c64190279f7034b77c13a566e914fe5ec4` (Selector `0x6cf6d675`) | `unbondingPeriod()` (86,400s) |
| **Uniswap V2 Reserves** | `eth_call` | `0x0a438d3ecebb6c4221dd54905c7329975e88584f` (Selector `0x0902f1ac`) | `getReserves()` |
| **USDC Supply** | `eth_call` | `0xc879c018db60520f4355c26ed1a6d572cdac1815` (Selector `0x18160ddd`) | Circle native USDC contract |
| **User Balances** | `eth_call` | Respective venue contracts (Selector `0x70a08231` + `padAddress`) | Standard `balanceOf(user)` |

---

## 2. Freshness State Categorization

The interface strictly differentiates between:
1. **`LIVE`**: Data queried directly from the node within the current request cycle.
2. **`CACHED`**: Data queried from the node within a 10-second TTL window to conserve RPC bandwidth and avoid rate-limiting. Includes exact ISO 8601 observation timestamp.
3. **`STALE`**: Data older than TTL or captured immediately preceding an endpoint interruption.
4. **`UNAVAILABLE`**: Protocol offline, timed out, or returning a contract execution error. Accompanied by diagnostic error text.
5. **`UNSUPPORTED`**: Operations or assets not supported by the protocol.
6. **`PREPARED`**: Unsigned transaction compiled and awaiting user signature in their external wallet.
