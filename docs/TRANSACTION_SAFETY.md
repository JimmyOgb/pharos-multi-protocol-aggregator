# TRANSACTION SAFETY & NON-CUSTODIAL POLICY

**Project:** Pharos Multi-Protocol Aggregator  
**Security Model:** Strictly Non-Custodial Client-Side Signing  
**Target Chain ID:** `1672` (Pharos Pacific Mainnet)  

---

## 1. Security Boundaries & Invariants

1. **Zero Key Custody:** The application, backend APIs, and agent engines possess zero private keys, seed phrases, or credentials.
2. **Zero Autonomous Broadcasting:** The backend never sends signed transactions to `eth_sendRawTransaction`.
3. **Transparent Calldata Preview:** Every prepared transaction exposes:
   - Destination address (`to`)
   - Native value in hex (`value`)
   - Complete unmasked calldata (`data`)
   - Standard gas limit
   - Network verification (`chainId: 1672`)
   - Function signature and decoded human-readable parameters.
4. **Client Wallet Approval:** All state-changing operations require the user to connect an EIP-1193 compliant wallet (e.g. MetaMask, OKX Wallet, Binance Web3 Wallet) and explicitly sign via `window.ethereum.request({ method: 'eth_sendTransaction' })`.

---

## 2. Prepared Calldata Reference

### WPROS Wrap (Deposit)
- **Destination:** `0x52c48d4213107b20bc583832b0d951fb9ca8f0b0`
- **Value:** Amount in native wei
- **Data:** `0xd0e30db0` (`deposit()`)

### WPROS Unwrap (Withdraw)
- **Destination:** `0x52c48d4213107b20bc583832b0d951fb9ca8f0b0`
- **Value:** `0x0`
- **Data:** `0x2e1a7d4d` + `padUint256(amountWei)` (`withdraw(uint256)`)

### Faroo stPROS Staking (Deposit)
- **Prior Approval:** `0x095ea7b3` + `padAddress(farooProxy)` + `padUint256(amountWei)` on WPROS
- **Destination:** `0x6b0a44c64190279f7034b77c13a566e914fe5ec4`
- **Data:** `0x6e553f65` + `padUint256(amountWei)` + `padAddress(receiver)` (`deposit(uint256,address)`)

### Faroo stPROS Unstaking (Redeem)
- **Destination:** `0x6b0a44c64190279f7034b77c13a566e914fe5ec4`
- **Data:** `0xba087652` + `padUint256(sharesWei)` + `padAddress(receiver)` + `padAddress(owner)`
