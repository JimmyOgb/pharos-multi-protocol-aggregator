# OFFICIAL RESOURCES & NETWORK AUDIT

**Project:** Pharos Multi-Protocol Aggregator  
**Audit Target:** Official Pharos Ecosystem Infrastructure  
**Verification Date:** 2026-11-11  

---

## 1. Official Documentation & Network Endpoints

### 1.1 Canonical Networks
* **Pharos Pacific Mainnet:**
  * **Chain ID:** `1672` (`0x688`)
  * **Native Currency:** `PROS` (18 Decimals)
  * **Public RPC Endpoint:** `https://rpc.pharos.xyz` (Verified live, block height > 22,739,000)
  * **Block Explorer:** `https://www.pharosscan.xyz` (Hemera SocialScan)
  * **Explorer API:** `https://api.socialscan.io/pharos-mainnet/v1/explorer/`
* **Pharos Atlantic Testnet:**
  * **Chain ID:** `688688` / `688689`
  * **Native Currency:** `PROS`
  * **Explorer:** `https://testnet.pharosscan.xyz`

### 1.2 Official Protocol & AI Endpoints
* **Pharos AI:** [https://ai.pharos.xyz](https://ai.pharos.xyz)
* **Pharos Documentation:** [https://docs.pharos.xyz](https://docs.pharos.xyz)
* **Pharos DevHub:** [https://www.pharos.xyz/devhub](https://www.pharos.xyz/devhub)
* **Pharos Port Ecosystem Hub:** [https://port.pharos.xyz](https://port.pharos.xyz)
* **Pharos Chain MCP Endpoint:** `https://mcp.pharos.xyz/mcp`
* **Pharos Docs MCP Endpoint:** `https://docs.pharos.xyz/~gitbook/mcp`
* **x402 Protocol Specs:** [https://docs.pharos.xyz/developer-guide/x402](https://docs.pharos.xyz/developer-guide/x402)

---

## 2. Canonical Contracts Audit (Pacific Mainnet `1672`)

Authoritative contract addresses verified on-chain via `eth_getCode`:

| Asset / Contract | Contract Address | Verified Code Size | Standards & Methods |
| :--- | :--- | :--- | :--- |
| **MultiCall3** | `0xcA11bde05977b3631167028862bE2a173976CA11` | 7,618 bytes | Aggregated on-chain contract batch reads |
| **Create2Deployer** | `0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2` | Verified | Deterministic deployment proxy |
| **Wrapped PROS (WPROS)** | `0x52c48d4213107b20bc583832b0d951fb9ca8f0b0` | 6,500 bytes | Canonical wrapped native token vault (`deposit()`, `withdraw()`, ERC-20) |
| **USD Coin (USDC)** | `0xc879c018db60520f4355c26ed1a6d572cdac1815` | 3,598 bytes | Circle native USDC deployment (Fiat-backed stablecoin) |
| **Faroo Staked PROS (stPROS)** | `0x6b0a44c64190279f7034b77c13a566e914fe5ec4` | 5,480 bytes (Proxy) / 32,892 bytes (Impl `0xfd59...708d`) | ERC-4626 Tokenized Vault / Liquid Staking |
| **Uniswap V2 WPROS Pool** | `0x0a438d3ecebb6c4221dd54905c7329975e88584f` | Verified | Automated Market Maker liquidity pool |

---

## 3. Transaction Safety & RPC Constraints

1. **RPC Reliability:** Public RPC `https://rpc.pharos.xyz` responds within 200-800ms for read-only `eth_call`, `eth_getBalance`, and `eth_blockNumber`.
2. **Batching:** `MultiCall3` supports multi-position queries in a single atomic RPC round-trip.
3. **No Key Extraction:** Application operates strictly client-side for signing; zero server-side keystores.
