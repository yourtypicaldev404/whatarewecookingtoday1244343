# 🌙 night.fun

**pump.fun for Midnight Network.**
Users launch memecoins backed by real Zero Knowledge smart contracts. Each token has a bonding curve — price rises as people buy. When the curve fills (69,000 NIGHT), the token graduates to NorthStar DEX.

Privacy-first: trades are ZK-verified. Nobody sees your wallet balance or transaction history.

**Live: https://nightdotfun.vercel.app/**

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React 19 |
| Wallet | Lace (Midnight DApp Connector v4) |
| Contracts | Compact 0.30.0, compact-runtime 0.15.0 |
| SDK | midnight-js 4.0.x, wallet-sdk 3.0.0, ledger-v8 |
| Proof Server | midnightntwrk/proof-server:8.0.3 |
| DB | Upstash Redis (KV) |
| Images | Pinata IPFS |
| Deploy Server | Railway (Node.js + Express) |
| Hosting | Vercel |

---

## Status

### Done ✅

| Feature | Notes |
|---------|-------|
| Homepage | Token grid, King of the Hill, search, sort (bump / new / mcap / graduated) |
| Token page | Bonding curve progress bar, buy/sell UI, price chart (mock data) |
| 4-step launch wizard | Name → ticker → description → image → deploy |
| ZK contract compilation | Compact → WASM/zkir, circuits: `buy`, `sell`, `getProgress`, `pause`, `unpause` |
| Token registry | Upstash Redis — persists address, reserves, volume, holder counts |
| IPFS image upload | Upload via Pinata on launch, stored as `imageUri` in Redis |
| Social links | Twitter, Telegram, website, Discord on token page |
| Wallet connect | Lace DApp Connector, connect/disconnect in Navbar |
| Lace install redirect | Browser-aware link to Chrome Web Store / Firefox / Edge |
| Deploy server | Railway, Express, v13 — always on |
| Portfolio page | `/portfolio` — positions, P&L, created tokens, tx history **(mock data)** |
| ZK work overlay | Phase-aware progress UI during deploy and trades |
| Client-side Lace proving | Deploy + trades prove via Lace's `getProvingProvider`, then `balanceUnsealedTransaction` + `submitTransaction` — user signs everything |

### Partially Working / Blocked ⚠️

#### Token Creation & Buy / Sell
The flow uses **client-side proving via Lace's `getProvingProvider`**:
1. Server builds an UNPROVEN tx (fast — circuit construction only, no ZK proving)
2. Browser deserializes the unproven tx using `ledger-v8`
3. Browser proves it via Lace's `getProvingProvider` (~30–60s) — ensures proof format matches Lace's internal balancer
4. Browser calls `balanceUnsealedTransaction` → Lace popup → user approves → wallet adds NIGHT fee inputs
5. Browser calls `submitTransaction` → broadcast to chain

This approach fixes the previous `balanceUnsealedTransaction` hang by ensuring the proof is generated through Lace's own proving infrastructure, avoiding the serialization format mismatch between the server's proof provider (ledger-v8) and Lace's internal deserializer.

**Common errors:**
- `No public state found at contract address` — indexer hasn't indexed the contract yet, or Preview was reset after deploy (redeploy the token)
- 502/503/504 — Railway deploy server cold start or proof server unavailable
- Proving timeout — Lace's proof server may be slow or unreachable; check `proverServerUri` in Lace config

### Not Started ❌

| Feature | What's needed |
|---------|--------------|
| Real portfolio | Query Midnight indexer for the connected wallet's ZK token balances — no public API for this yet |
| Real price chart | Subscribe to indexer WebSocket for per-contract trade events, store OHLCV in Redis |
| Token images on homepage cards | Load `imageUri` from Redis and display instead of the moon emoji placeholder |
| Graduation flow | When `adaReserve >= 69,000 NIGHT`, call contract's `graduate()` circuit and list on NorthStar DEX |
| Real holder tracking | Parse ZK outputs from indexer to count unique holders per token |
| End-to-end testing | Verify client-side Lace proving flow works with Preview network and Lace wallet |
| Comment / bump system | Social layer — users bump tokens to the top by posting |
| Token gating | Launch with a whitelist, vesting schedule, or creator fee |

---

## Architecture

### Deploy Flow (current — client-side proving via Lace)

```
User fills launch form
  ↓ POST /api/deploy/unproven (Vercel → Railway)
      → createUnprovenDeployTx(walletProvider, compiledContract, args)
      → returns { unprovenTxHex, contractAddress }
  ↓ Browser: deserialize unproven tx (ledger-v8)
  ↓ Browser: wallet.getProvingProvider(keyMaterial)
  ↓ Browser: unprovenTx.prove(laceProvider, costModel)   ← ZK proof via Lace (~30–60s)
  ↓ Browser: wallet.balanceUnsealedTransaction(provedHex) ← Lace popup, user signs
  ↓ Browser: wallet.submitTransaction(balanced.tx)        ← broadcast
  ↓ POST /api/tokens — save to Redis
  ↓ redirect /token/[contractAddress]
```

### Trade Flow (current — client-side proving via Lace)

```
User clicks Buy / Sell
  ↓ POST /api/trade/unproven (Vercel → Railway)
      → createUnprovenCallTx(contractAddress, buy|sell, args)
      → returns { unprovenTxHex }
  ↓ Browser: deserialize + prove via Lace's getProvingProvider (~30s)
  ↓ Browser: wallet.balanceUnsealedTransaction(provedHex) ← Lace popup, user signs
  ↓ Browser: wallet.submitTransaction(balanced.tx)
  ↓ PATCH /api/tokens/[address] — update reserves
```

---

## Local Development

```bash
npm install
cp .env.local.example .env.local   # fill in your keys
```

**All-in-one (recommended):**
```bash
npm run dev:local
# Starts: docker compose (proof server :6300) + deploy server (:3001) + Next (:3000)
```

**Manual (3 terminals):**
```bash
docker compose up -d        # proof server on :6300
npm run deploy-server       # Railway server on :3001
npm run dev                 # Next.js on :3000
```

Configure Lace → Midnight → Prover server → `http://localhost:6300`

**Compile contracts:**
```bash
npm run compile-contracts
```

---

## Environment Variables

### Vercel (frontend)

```bash
NEXT_PUBLIC_NETWORK_ID=mainnet          # mainnet | preview | preprod
NEXT_PUBLIC_NETWORK_LABEL=Mainnet       # display label
NEXT_PUBLIC_FAUCET_URL=https://...      # optional faucet link
NEXT_PUBLIC_INDEXER_HTTP=https://...
NEXT_PUBLIC_INDEXER_WS=wss://...
NEXT_PUBLIC_MIDNIGHT_NODE_URL=https://...
DEPLOY_SERVER_URL=https://....railway.app
KV_REST_API_URL=                        # Upstash Redis
KV_REST_API_TOKEN=
PINATA_JWT=                             # IPFS image uploads
```

### Railway (deploy server)

```bash
NETWORK_ID=mainnet
DEPLOYER_SEED=<64-char hex>             # server wallet seed (needs NIGHT)
TREASURY_SEED=<64-char hex>             # treasury witness key
PROOF_SERVER_URL=http://127.0.0.1:6300                              # self-hosted (no public mainnet prover yet)
INDEXER_HTTP=https://indexer.mainnet.midnight.network/api/v4/graphql
INDEXER_WS=wss://indexer.mainnet.midnight.network/api/v4/graphql/ws
NODE_RPC=https://rpc.mainnet.midnight.network
PORT=3001
```

---

## Contract Info

**Bonding Curve Contract** (`contracts/managed/bonding_curve/`)
- Language: Compact 0.30.0 (pragma 0.22)
- Circuits: `buy`, `sell`, `getProgress`, `pause`, `unpause`
- Graduation target: 69,000 NIGHT
- Total supply: 1,000,000,000 tokens (6 decimals)
- Fee: 1% per trade
- Witnesses: `treasurySecretKey`

---

## SDK Versions (working)

```json
{
  "@midnight-ntwrk/compact-runtime": "0.15.0",
  "@midnight-ntwrk/compact-js": "2.5.0",
  "@midnight-ntwrk/midnight-js-contracts": "4.0.1",
  "@midnight-ntwrk/midnight-js-http-client-proof-provider": "4.0.1",
  "@midnight-ntwrk/midnight-js-level-private-state-provider": "4.0.1",
  "@midnight-ntwrk/midnight-js-indexer-public-data-provider": "4.0.1",
  "@midnight-ntwrk/wallet-sdk-facade": "3.0.0",
  "@midnight-ntwrk/wallet-sdk-shielded": "2.1.0",
  "@midnight-ntwrk/wallet-sdk-hd": "3.0.1",
  "@midnight-ntwrk/wallet-sdk-dust-wallet": "3.0.0",
  "@midnight-ntwrk/wallet-sdk-unshielded-wallet": "2.1.0",
  "@midnight-ntwrk/ledger-v8": "8.0.3"
}
```

---

## Known Issues

| Issue | Cause | Workaround |
|-------|-------|------------|
| Deploy times out / fails | Midnight Preview chain down or Lace proof server unreachable | Wait for chain to come back up; check Lace prover config |
| Buy/sell hangs after Lace popup | `balanceUnsealedTransaction` format mismatch (mitigated by client-side Lace proving) | Ensure Lace is updated and `getProvingProvider` is used |
| `No public state found` on trade | Token deployed on a different chain epoch / Preview was reset | Redeploy the token |
| Portfolio shows mock data | No indexer API for user ZK balances yet | Real data needs Midnight indexer extension |
| Token images show moon emoji | `imageUri` stored but not rendered in cards | Load IPFS URL in `TokenCard` component |
