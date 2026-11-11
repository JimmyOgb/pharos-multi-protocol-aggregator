# PRODUCTION API 404 INCIDENT REPORT

**Document ID:** PHAROS-INC-2026-001  
**Project:** Pharos Multi-Protocol Aggregator  
**Production URL:** https://pharos-multi-protocol-aggregator.vercel.app  
**Repository:** https://github.com/JimmyOgb/pharos-multi-protocol-aggregator  
**Baseline Release Commit:** `84cf193`  
**Network:** Pharos Pacific Mainnet (Chain ID `1672`)  
**Status:** RESOLVED & VERIFIED  

---

## 1. Incident Summary

Users interacting with the live production deployment of the Pharos Multi-Protocol Aggregator encountered an immediate application failure upon attempting to find an optimal venue route.

### Symptoms Observed
1. **HTTP 404 Error:** The browser console reported repeated failures to load `/api/route`:
   ```text
   Failed to load resource: the server responded with a status of 404 ()
   /api/route:1 Failed to load resource: the server responded with a status of 404 ()
   ```
2. **Client-Side SyntaxError:** The frontend threw an unhandled JSON parsing error:
   ```text
   Error: Unexpected token 'T', "The page c"... is not valid JSON
   ```
3. **Dashboard Impact:** The static dashboard UI loaded, but the Optimal Venue Routing Engine, Position Inspector, and Transaction Preparation interfaces were unable to complete requests because all `/api/*` endpoints returned 404 text responses from Vercel edge.

---

## 2. Release & Configuration Baseline

Inspection of release commit `84cf193` revealed the project architecture and deployment configuration:

- **Framework:** Node.js native (`type: module`), with experimental strip-types and `esbuild` for production bundling.
- **Vercel Configuration (`vercel.json`):**
  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "version": 2,
    "framework": null,
    "buildCommand": "npm run build",
    "outputDirectory": "public",
    "cleanUrls": true
  }
  ```
- **Build Script (`package.json`):**
  ```json
  "build": "node --experimental-strip-types src/build.ts"
  ```
- **Build Pipeline (`src/build.ts`):** Executed `esbuild src/api/*.ts --outdir=api` to produce standalone ESM bundles in `api/*.js`.
- **Git Ignore (`.gitignore`):**
  ```gitignore
  node_modules
  .env
  .env.*
  .DS_Store
  .vercel
  dist
  api/*.js
  *.log
  ```

---

## 3. Root Cause Analysis

A systematic trace of Vercel deployment logs and git commit history isolated the two-part root cause:

### Root Cause 1: Git-Ignored Serverless Output (`.gitignore` exclusion of `api/*.js`)
In `.gitignore`, line 7 specified `api/*.js`. Consequently:
1. When changes were committed to GitHub repository `JimmyOgb/pharos-multi-protocol-aggregator`, the `api/` directory was completely omitted from source control.
2. In Vercel's serverless discovery lifecycle for unbundled/custom framework configurations (`framework: null`), Vercel inspects the source repository structure for function routes.
3. Because the `api/` directory was excluded from git, Vercel cloud deployments triggered via GitHub webhook or clean checkout discovered zero serverless functions.
4. Deployment `dpl_CV4pQ3sotM1dpNAZ97fg1ztmfgZn` completed in 4s with `Builds: . [0ms]`, treating the project solely as a static site in `public/`.
5. Any HTTP request to `/api/route` (or `/api/health`, `/api/protocols`, etc.) failed to match any serverless function, causing Vercel's edge routing layer to return the default static 404 text response:
   ```text
   The page could not be found
   NOT_FOUND
   ```

### Root Cause 2: Unsafe Frontend Response Handling in `public/app.js`
In `public/app.js`, network requests invoked `fetch(...)` followed immediately by `res.json()` without verifying `res.ok` or inspecting the `Content-Type` header:
```javascript
const res = await fetch('/api/route', { ... });
const json = await res.json(); // Throws SyntaxError on non-JSON 404 responses
```
When Vercel returned the plain text `The page could not be found` (starting with the letter `'T'`), `JSON.parse` threw:
`Unexpected token 'T', "The page c"... is not valid JSON`. This caused an unhandled UI crash instead of a descriptive error state with recovery options.

---

## 4. Remediation Strategy

1. **Remove `api/*.js` from `.gitignore`:** Track compiled serverless ESM bundles (`api/*.js`) directly in git, ensuring Vercel's function discovery pipeline detects all 6 endpoints immediately upon deployment.
2. **Implement Resilient Client Network Layer:** Add `safeFetchJson()` in `public/app.js` with timeout protection, `Content-Type` sniffing, status code validation, and graceful non-JSON error formatting.
3. **Enforce Strict HTTP Methods and Schema Validation:** Update all 6 API handlers in `src/api/` (`health`, `protocols`, `positions`, `route`, `prepare`, `fault-test`) to reject invalid HTTP methods with HTTP 405 Method Not Allowed and reject invalid payloads with HTTP 400 Bad Request.
4. **Prevent SPA Fallback Interception:** Update local `src/server.ts` to return HTTP 404 JSON for unknown `/api/*` routes rather than falling through to `public/index.html`.
5. **Comprehensive Automated Verification:** Expand unit and integration test suite to cover all 6 API routes, method enforcement, and live RPC integration on Pharos Pacific Mainnet (Chain ID 1672).
