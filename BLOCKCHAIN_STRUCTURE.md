# stfu.fun Blockchain Interaction Architecture

## Overview

stfu.fun is a bonding curve token launchpad built on [Midnight Network](https://midnight.network/), a blockchain with native zero-knowledge (ZK) privacy. The UX mirrors pump.fun on Solana -- users can launch tokens, buy and sell on bonding curves, and tokens graduate when they hit a reserve threshold -- but all state transitions are proven via ZK circuits under the hood.

**Core loop:**

```
User launches token → Bonding curve contract deployed
Users buy/sell on curve → ZK-proven transactions settled on-chain
Reserve hits 320,000 NIGHT → Token "graduates" (eligible for DEX listing)
```

**Native token:** NIGHT (Midnight's native token for trading and fees)

---

## Wallet Connection Flow

### Supported Wallets

| Wallet | Window Object | Notes |
|--------|--------------|-------|
| 1AM | `window.midnight['1am']` | Uses ProofStation for fee sponsorship (dust-free UX) |
| Lace | `window.midnight.mnLace` | Midnight-enabled Lace; can hang on `balanceUnsealedTransaction` |

### Connection Sequence

```
┌──────────┐     ┌──────────────┐     ┌────────────────┐
│  Browser  │────>│ Detect       │────>│ Wallet Popup   │
│           │     │ Wallets      │     │ (user approves) │
└──────────┘     └──────────────┘     └────────────────┘
                        │                      │
                  window.midnight.*       wallet.connect()
                                               │
                                          hintUsage()
                                               │
                                       fetch balances &
                                        addresses
```

1. **Detection** -- On page load, the frontend checks `window.midnight` for injected wallet providers (`'1am'`, `mnLace`).
2. **Wallet selection** -- If multiple wallets are detected, the user picks one from a modal before proceeding.
3. **Connect** -- Call `wallet.connect(networkId)` where `networkId` matches the deployment environment (`mainnet`, `preview`, or `preprod`).
4. **Permissions** -- Call `hintUsage()` to declare what the DApp needs (balance reads, transaction signing).
5. **State hydration** -- Fetch the user's NIGHT balance and shielded/unshielded addresses.
6. **Auto-reconnect** -- The selected wallet ID is persisted to `localStorage`. On subsequent page loads the frontend silently reconnects without re-prompting.

**API version:** Midnight DApp Connector API v4.0.0

---

## Token Launch Flow

Analogous to pump.fun's "create a coin" page.

### Sequence

```
┌──────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────────┐
│  Browser  │───>│  Pinata  │───>│ Deploy Srv  │───>│ Midnight RPC │
│ (form)    │    │  (IPFS)  │    │ (Railway)   │    │  (on-chain)  │
└──────────┘    └──────────┘    └─────────────┘    └──────────────┘
     │                │                │                    │
     │  1. Fill form  │                │                    │
     │  2. Upload img │───────────────>│                    │
     │                │  IPFS CID      │                    │
     │  3. POST /api/tokens ──────────>│                    │
     │                │                │ 4. Deploy contract │
     │                │                │───────────────────>│
     │                │                │   contract address │
     │  5. DB record created           │<───────────────────│
     │<────────────────────────────────│                    │
     │  6. Redirect to /token/[addr]   │                    │
```

**Step-by-step:**

1. **User fills the launch form** -- name, ticker symbol, description, and an image.
2. **Image upload** -- The image is uploaded to Pinata, which pins it on IPFS and returns a CID.
3. **API call** -- Frontend sends `POST /api/tokens` with token metadata and the IPFS CID.
4. **Contract deployment** -- The deploy server (`deploy-server.mjs` on Railway) uses its own pre-funded "warm wallet" to:
   - Compile and deploy the bonding curve contract (written in Compact, Midnight's ZK language)
   - Prove the deployment transaction via the proof server
   - Balance the transaction (attach fees)
   - Submit to the Midnight network
   - The connected user's address is recorded as the token creator
5. **Registration** -- The contract address is stored in the SQLite database alongside token metadata.
6. **Redirect** -- The user is sent to the new token's page at `/token/[contractAddress]`.

### POST /api/tokens Payload

```json
{
  "name": "Example Token",
  "ticker": "EXT",
  "description": "A sample stfu.fun token",
  "imageUrl": "https://gateway.pinata.cloud/ipfs/Qm...",
  "creatorAddress": "midnight1abc...",
  "contractAddress": "midnight1xyz..."
}
```

> **Why server-side deploy?** Midnight ZK proving is compute-heavy and requires the full SDK (~4 GB heap). Running it in-browser is impractical, and Lace wallet's transaction handling can hang. The warm wallet pattern lets the server handle all proving and submission, keeping the user-facing latency manageable.

---

## Trading Flow (Buy / Sell)

Analogous to pump.fun's trade panel on each token page.

### Sequence

```
┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│  Browser  │───>│ Vercel API   │───>│ Deploy Srv  │───>│ Proof Srv│
│ (trade UI)│    │ (Next.js)    │    │ (Railway)   │    │ (:6300)  │
└──────────┘    └──────────────┘    └─────────────┘    └──────────┘
     │                │                    │                  │
     │ 1. Quote       │                    │                  │
     │ (client-side)  │                    │                  │
     │                │                    │                  │
     │ 2. POST /api/trade ───────────────>│                  │
     │                │                    │ 3. Build unproven│
     │                │                    │    call tx       │
     │                │                    │                  │
     │                │                    │ 4. Prove ───────>│
     │                │                    │    <── proof ────│
     │                │                    │                  │
     │  5. provedTxHex <──────────────────│                  │
     │                │                    │                  │
     │ 6. wallet.balanceUnsealedTransaction(provedTxHex)     │
     │    → wallet popup (user approves)                     │
     │                │                    │                  │
     │ 7. wallet.submitTransaction(balanced.tx)              │
     │    → broadcast to Midnight RPC                        │
     │                │                    │                  │
     │ 8. PATCH /api/tokens/[addr] ──────>│ (update state)   │
```

**Step-by-step:**

1. **Quote calculation** -- The frontend runs `getBuyQuote(amount)` or `getSellQuote(amount)` using the bonding curve math to show the user expected output before they confirm.
2. **Trade request** -- `POST /api/trade` forwards to the deploy server with the trade direction, amount, and user address.
3. **Build unproven tx** -- The deploy server calls `createUnprovenCallTx` against the bonding curve contract, invoking the `buy` or `sell` circuit.
4. **ZK proving** -- The unproven transaction is sent to the proof server (`httpClientProofProvider` on port 6300), which generates the ZK proof. This is the most time-consuming step.
5. **Return proved tx** -- The proved transaction hex (`provedTxHex`) is returned to the browser.
6. **Wallet balance & approval** -- The browser calls `wallet.balanceUnsealedTransaction(provedTxHex)`. This opens the wallet popup so the user can review and approve the transaction (attaching fees / DUST).
7. **Submit** -- The browser calls `wallet.submitTransaction(balanced.tx)` to broadcast the signed, balanced transaction to the Midnight network.
8. **State update** -- The frontend sends `PATCH /api/tokens/[contractAddress]` to update the token's cached state (new price, reserve, supply).

### POST /api/trade Payload

```json
{
  "contractAddress": "midnight1xyz...",
  "action": "buy",
  "amount": "1000",
  "userAddress": "midnight1abc..."
}
```

### Trade Response

```json
{
  "provedTxHex": "0x...",
  "quote": {
    "tokensOut": "4200",
    "priceImpact": "0.02",
    "newPrice": "0.015"
  }
}
```

---

## Architecture Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                  │
│                                                                     │
│  Vercel (Next.js)                                                   │
│  ├── Pages: /, /token/[addr], /profile                              │
│  ├── API Routes: /api/tokens, /api/trade, /api/upload               │
│  ├── Wallet connector (DApp Connector API v4.0.0)                   │
│  └── Bonding curve math (client-side quotes)                        │
│                                                                     │
└──────────────┬──────────────────────────────────────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DEPLOY SERVER                                │
│                                                                     │
│  Railway (deploy-server.mjs, Express)                               │
│  ├── Warm wallet (pre-funded, server-controlled)                    │
│  ├── Contract deployment (Compact → ZK circuits)                    │
│  ├── Transaction building (createUnprovenCallTx)                    │
│  ├── Proof orchestration (httpClientProofProvider)                   │
│  └── Node flags: --max-old-space-size=4096                          │
│                                                                     │
└──────────┬──────────────────────────┬───────────────────────────────┘
           │                          │
           ▼                          ▼
┌─────────────────────┐  ┌─────────────────────────────┐
│    PROOF SERVER      │  │      MIDNIGHT NETWORK        │
│    (port 6300)       │  │                               │
│                      │  │  RPC: wss://rpc.mainnet.      │
│  ZK proof generation │  │       midnight.network        │
│  for Compact circuits│  │                               │
│                      │  │  Indexer: GraphQL API          │
│                      │  │  (on-chain state queries)      │
└──────────────────────┘  └───────────────────────────────┘

┌─────────────────────┐  ┌─────────────────────────────┐
│      PINATA          │  │        SQLITE                 │
│                      │  │                               │
│  IPFS image hosting  │  │  Token registry               │
│  for token logos     │  │  User data                    │
│                      │  │  Trade history                 │
└──────────────────────┘  └───────────────────────────────┘
```

| Component | Role | Location |
|-----------|------|----------|
| **Vercel (Next.js)** | Frontend, API route proxy | Vercel cloud |
| **deploy-server.mjs** | ZK proving, wallet ops, contract deployment | Railway |
| **Proof Server** | ZK proof generation for Compact circuits | Port 6300 (co-located or networked) |
| **Midnight RPC** | Chain RPC endpoint (WebSocket) | `wss://rpc.mainnet.midnight.network` |
| **Midnight Indexer** | GraphQL API for reading on-chain state | Midnight infrastructure |
| **Pinata** | IPFS pinning for token images | Pinata cloud |
| **SQLite** | Token metadata, user records, trade log | Co-located with API |

---

## Key Contracts

### Bonding Curve Contract

Written in **Compact**, Midnight's domain-specific language that compiles to ZK circuits.

**Circuits exposed:**

| Circuit | Purpose |
|---------|---------|
| `buy` | User sends NIGHT, receives tokens minted along the curve |
| `sell` | User sends tokens, receives NIGHT from the reserve |

**Graduation:** When the bonding curve reserve reaches **320,000 NIGHT** (~$15K), the token "graduates" and becomes eligible for DEX listing (analogous to pump.fun's Raydium migration).

**Transaction lifecycle for a circuit call:**

```
createUnprovenCallTx(circuit, args)
        │
        ▼
  httpClientProofProvider.prove(unprovenTx)
        │
        ▼
  wallet.balanceUnsealedTransaction(provedTxHex)
        │
        ▼
  wallet.submitTransaction(balanced.tx)
        │
        ▼
  Transaction finalized on Midnight
```

---

## Network Configuration

All components must agree on the same network. The single source of truth is `lib/network.ts`.

| Variable | Values | Where it matters |
|----------|--------|-----------------|
| `NETWORK_ID` | `mainnet` \| `preview` \| `preprod` | Vercel env, Railway env, wallet network selection |

**Mismatch consequences:** If the wallet is on `mainnet` but the deploy server targets `preview`, transactions will fail silently or be rejected by the RPC node.

```
lib/network.ts
├── Imported by: frontend wallet connector
├── Imported by: API routes (forwarded to deploy server)
└── Must match: NETWORK_ID env var on Railway
```

**RPC endpoints by network:**

```
mainnet:  wss://rpc.mainnet.midnight.network
preview:  wss://rpc.preview.midnight.network
preprod:  wss://rpc.preprod.midnight.network
```

---

## Known Issues & Workarounds

### Lace wallet hangs on `balanceUnsealedTransaction`

**Problem:** Lace's implementation of `balanceUnsealedTransaction` can hang indefinitely, leaving the user stuck.

**Workaround:** For critical paths (token deployment), the server-side warm wallet handles the full transaction lifecycle (prove, balance, submit) without involving the user's wallet at all. For trades, a timeout with retry logic is used.

### 1AM wallet and ProofStation fee sponsorship

**Problem:** Users with empty wallets cannot pay transaction fees.

**Workaround:** 1AM wallet integrates ProofStation, which sponsors gas fees. This means users interacting via 1AM can trade without holding NIGHT for fees -- making the UX "dust-free."

### RPC WebSocket disconnects

**Problem:** Long-running WebSocket connections to `wss://rpc.*.midnight.network` drop silently, causing the deploy server to lose its chain connection.

**Workaround:** Process-level error handlers in `deploy-server.mjs` catch `ECONNRESET` and reconnect automatically:

```js
process.on('uncaughtException', (err) => {
  if (err.message.includes('WebSocket')) {
    reconnectRPC();
  }
});
```

### Midnight SDK memory usage

**Problem:** The Midnight SDK (especially the proving components) consumes significant memory, often exceeding Node.js's default heap limit.

**Workaround:** The deploy server must be started with an increased heap:

```bash
node --max-old-space-size=4096 deploy-server.mjs
```

Railway's `railway.json` or `Dockerfile` should include this flag.

---

## Comparison with pump.fun (Solana)

| Aspect | pump.fun (Solana) | stfu.fun (Midnight) |
|--------|-------------------|----------------------|
| **Chain** | Solana (public, transparent) | Midnight (ZK privacy) |
| **Token standard** | SPL tokens | Compact contracts (ZK circuits) |
| **Bonding curve** | On-chain program | On-chain Compact contract |
| **Graduation target** | ~$69k market cap → Raydium | 320,000 NIGHT reserve (~$15K) |
| **Transaction signing** | Phantom/Solflare sign directly | ZK proving → wallet balance → submit |
| **Gas/fees** | User pays SOL | Server warm wallet or ProofStation sponsors |
| **Proving** | N/A (no ZK) | Server-side proof generation (~seconds) |
| **Privacy** | Fully transparent | Shielded state via ZK proofs |
| **Deploy model** | Client signs deploy tx | Server deploys via warm wallet |
