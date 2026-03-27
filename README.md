# 🌙 night.fun

**pump.fun for Midnight Network.**
Users launch memecoins backed by real Zero Knowledge smart contracts. Each token has a bonding curve — price rises as people buy. When the curve fills (69,000 DUST), the token graduates to NorthStar DEX.

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
| Deploy (server-side) | Railway warm-wallet deploys the contract fully server-side (no Lace popup needed) |

### Partially Working / Blocked ⚠️

#### Token Creation
The deploy flow is architecturally complete:
1. User fills form → `POST /api/deploy` → Railway
2. Railway `WalletFacade` (warm wallet, synced at startup) calls `deployContract()` — proves + balances + submits using the server's own DUST wallet
3. Returns `{contractAddress, txId}` → saved to Redis → redirect to token page

**Blocked by**: Midnight Preview network instability. When Preview is down, `buildWallet` / `WalletFacade.init()` can't sync and the deploy times out. When Preview is up, this flow should complete end-to-end without requiring the user to sign (the server wallet signs).

> **Note on signing**: The current server-side deploy means *the server's wallet* signs the deploy transaction, not the user's Lace wallet. This was a deliberate workaround because `wallet.balanceUnsealedTransaction()` in Lace consistently hangs after the user approves — the promise never resolves. A user-signed deploy would be preferable UX, but requires Lace to fix the `balanceUnsealedTransaction` hang.

#### Buy / Sell
Server side (Railway `createUnprovenCallTx` + `proofProvider.proveTx`) works and returns a proved tx hex. The broken step is Lace:

```
buildTradeProvenTx()   ✅ server builds + proves tx in ~30s
balanceUnsealedTransaction(provedTxHex)  ❌ Lace popup appears, user signs → promise never resolves
submitTransaction()    ❌ never reached
```

The hang happens regardless of whether the tx was built with the user's or server's `coinPublicKey`. Root cause is likely in the Lace DApp Connector or a version mismatch with the Midnight SDK. When this resolves, trades will work end-to-end — no code changes needed on the server.

**Common errors seen in buy/sell:**
- `Unable to deserialize Transaction` — tx format mismatch (fixed: server now proves before returning)
- `No public state found at contract address` — indexer hasn't indexed the contract yet, or Preview was reset after deploy (redeploy the token)
- Hanging after Lace popup — `balanceUnsealedTransaction` promise never resolves
- 502/503/504 — Railway deploy server cold start or proof server unavailable

### Not Started ❌

| Feature | What's needed |
|---------|--------------|
| Real portfolio | Query Midnight indexer for the connected wallet's ZK token balances — no public API for this yet |
| Real price chart | Subscribe to indexer WebSocket for per-contract trade events, store OHLCV in Redis |
| Token images on homepage cards | Load `imageUri` from Redis and display instead of the moon emoji placeholder |
| Graduation flow | When `adaReserve >= 69,000 DUST`, call contract's `graduate()` circuit and list on NorthStar DEX |
| Real holder tracking | Parse ZK outputs from indexer to count unique holders per token |
| User-signed deploys | Need Lace to fix `balanceUnsealedTransaction` or switch to a different Lace API |
| Comment / bump system | Social layer — users bump tokens to the top by posting |
| Token gating | Launch with a whitelist, vesting schedule, or creator fee |

---

## Architecture

### Deploy Flow (current)

```
User fills launch form
  ↓ POST /api/deploy (Vercel Next.js proxy, timeout 300s)
  ↓ POST /deploy (Railway deploy server)
      → ensureWalletReady()  — WalletFacade synced at startup, reused
      → deployContract()     — prove + balance + submit (server wallet signs)
      → returns { contractAddress, txId }
  ↓ Vercel proxy returns { contractAddress, txId }
  ↓ PATCH /api/tokens/[address] — save to Upstash Redis
  ↓ redirect /token/[contractAddress]
```

### Trade Flow (current, partially working)

```
User clicks Buy / Sell
  ↓ POST /api/trade (Vercel proxy, timeout 240s)
  ↓ POST /trade/build (Railway)
      → createUnprovenCallTx(contractAddress, buy|sell, args)
      → proofProvider.proveTx(unprovenTx)    ← server-side ZK proof (~30s)
      → returns provedTxHex
  ↓ wallet.balanceUnsealedTransaction(provedTxHex)   ← HANGS in Lace
      Lace should: add DUST fee inputs + show popup + return balanced tx
  ↓ wallet.submitTransaction(balanced.tx)            ← never reached
  ↓ PATCH /api/tokens/[address] — update reserves    ← never reached
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
NEXT_PUBLIC_NETWORK_ID=preview          # preview | preprod | mainnet
NEXT_PUBLIC_NETWORK_LABEL=Preview       # display label
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
NETWORK_ID=preview
DEPLOYER_SEED=<64-char hex>             # server wallet seed (needs testnet DUST)
TREASURY_SEED=<64-char hex>             # treasury witness key
PROOF_SERVER_URL=https://lace-proof-pub.preview.midnight.network   # or self-hosted
INDEXER_HTTP=https://indexer.preview.midnight.network/api/v4/graphql
INDEXER_WS=wss://indexer.preview.midnight.network/api/v4/graphql/ws
NODE_RPC=https://rpc.preview.midnight.network
PORT=3001
```

---

## Contract Info

**Bonding Curve Contract** (`contracts/managed/bonding_curve/`)
- Language: Compact 0.30.0 (pragma 0.22)
- Circuits: `buy`, `sell`, `getProgress`, `pause`, `unpause`
- Graduation target: 69,000 DUST
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
| Deploy times out / fails | Midnight Preview chain down — WalletFacade can't sync | Wait for chain to come back up |
| Buy/sell hangs after Lace popup | `balanceUnsealedTransaction` in Lace DApp Connector never resolves | No workaround yet — Lace bug |
| `No public state found` on trade | Token deployed on a different chain epoch / Preview was reset | Redeploy the token |
| Portfolio shows mock data | No indexer API for user ZK balances yet | Real data needs Midnight indexer extension |
| Token images show moon emoji | `imageUri` stored but not rendered in cards | Load IPFS URL in `TokenCard` component |
