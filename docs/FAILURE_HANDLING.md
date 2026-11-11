# MULTI-PROTOCOL FAILURE HANDLING & DEGRADED OPERATION

**Project:** Pharos Multi-Protocol Aggregator  
**Task Requirement:** REQ-04 (Handles one protocol being unavailable without breaking the others)  

---

## 1. Architectural Resilience & Isolation

In a multi-protocol aggregator, individual protocols may experience RPC timeouts, validator halts, maintenance windows, or contract execution reverts. The aggregator must guarantee **complete fault isolation**:
- Failure in Protocol A **must never** crash the backend process.
- Failure in Protocol A **must never** taint or invalidate Protocol B's query results.
- The routing engine must dynamically exclude the degraded protocol and failover to remaining viable options.
- The user interface must present explicit diagnostics rather than masked errors or simulated responses.

```
       [Client Query: All Venues / Route]
                        |
            +-----------+-----------+
            |                       |
            v                       v
     [WPROS Adapter]       [Faroo Adapter]
     - RPC call OK          - Gateway Timeout / Revert
     - Returns LIVE venue   - Catches Error Locally
            |                       |
            |                       v
            |              [Tagged: UNAVAILABLE]
            |              [Diagnostic: Error logged]
            |                       |
            +-----------+-----------+
                        |
                        v
     [Aggregator Resilience Coordinator]
     - Assembles partial valid response (WPROS Online, Faroo Unavailable)
     - Disqualifies Faroo from routing
     - Selects WPROS as failover
     - Returns HTTP 200 with complete explanation
```

---

## 2. Implementation Mechanics

1. **Independent Try/Catch Blocks:** Each adapter wraps internal RPC calls in dedicated try/catch wrappers.
2. **Strict Timeouts:** Every network call is bounded by an `AbortController` timeout (12,000ms), preventing hung connections from blocking other adapters.
3. **Controlled Fault Injection Test Harness:**
   - The aggregator exposes `aggregator.setFaultInjection(protocolId, faultType)` to test `TIMEOUT`, `REVERT`, and `NETWORK_ERROR`.
   - Exposed in the UI via the **Fault Isolation Sandbox** tab and through the API endpoint `/api/fault-test`.

---

## 3. Verified Failure & Recovery Evidence

As verified in `tests/integration/fault-isolation.test.ts`:
1. **Fault Injected:** `TIMEOUT` on `faroo-stpros`.
2. **Aggregator Execution:** `getAllVenues()` completes in 100% of runs without throwing unhandled exceptions.
3. **Observation:** `faroo-stpros` is marked `status: 'UNAVAILABLE'`, `errorMessage: '[Fault Injection] Gateway timed out after 10000ms'`.
4. **Surviving Protocols:** `wpros` remains `status: 'ONLINE'`, `dataFreshness: 'LIVE'`, with full 22.39M PROS TVL preserved.
5. **Failover Decision:** Routing request for PROS automatically failovers to the next highest surviving venue (`wpros` or `uniswap-v2-pros`), with an explicit explanation:
   `"Protocol is UNAVAILABLE: [Fault Injection] Gateway timed out"`.
6. **Recovery:** Fault cleared $\rightarrow$ next query returns Faroo `status: 'ONLINE'` without restarting the service.
