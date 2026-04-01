# stfu.fun

**pump.fun for Midnight Network.**
Users launch memecoins backed by real Zero Knowledge smart contracts. Each token has a bonding curve — price rises as people buy. When the curve fills (320,000 NIGHT, ~$15K), the token graduates to NorthStar DEX.

Privacy-first: trades are ZK-verified. Nobody sees your wallet balance or transaction history.

**Live: https://stfudotfun.vercel.app/**

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React 19 |
| Wallet | 1AM / Lace (Midnight DApp Connector v4) |
| Contracts | Compact 0.30.0, compact-runtime 0.15.0 |
| SDK | midnight-js 4.0.2, wallet-sdk 3.0.0, ledger-v8 8.0.3 |
| Proof Server | midnightntwrk/proof-server:8.0.3 (self-hosted Docker) |
| DB | Upstash Redis (KV) |
| Images | Pinata IPFS |
| Deploy Server | PM2 on VPS (Node.js + Express 5, port 3002 → 80) |
| Hosting | Vercel (auto-deploys from GitHub) |

---

## Status (updated 2026-04-01)

### Done ✅

| Feature | Notes |
|---------|-------|
| Homepage | Token grid, King of the Hill, search, sort (bump / new / mcap / graduated) |
| Token page | Bonding curve progress bar, buy/sell UI, real-time chart (empty state until trades exist) |
| Token images | IPFS via Pinata — loads on homepage, token page, and leaderboard; falls back to initials |
| 4-step launch wizard | Name → ticker → description → image → deploy |
| ZK contract compilation | Compact → WASM/zkir, circuits: `buy`, `sell`, `getProgress`, `pause`, `unpause` |
| Token registry | Upstash Redis — persists address, reserves, volume, holder counts |
| IPFS image upload | Upload via Pinata on launch, stored as `imageUri` in Redis |
| Social links | Twitter/X (@stfudotfun), Discord on sidebar |
| Wallet connect | 1AM + Lace via DApp Connector v4, wallet picker modal, connect/disconnect |
| Deploy server | PM2 on VPS, Express 5, port 3002 (iptables 80→3002), proof server co-located |
| Portfolio page | `/portfolio` — empty state ready for real data when indexer supports ZK balances |
| Leaderboard | `/leaderboard` — top tokens by volume, trades, liquidity |
| Stats dashboard | `/stats` — platform-wide metrics, 30-day launch history |
| How it works | `/how-it-works` — 4-step educational flow + feature highlights |
| ZK work overlay | Phase-aware progress UI during deploy and trades |
| Client-side proving | Deploy + trades prove via wallet's `getProvingProvider` (produces correct `pedersen-schnorr` binding for mainnet) |
| Sidebar UI | Collapsible sidebar with nav, green network dot, social links, BETA badge, toggle at bottom |
| Indexer integration | Real on-chain contract state fetched via Midnight GraphQL indexer after trades + on page load |
| Bonding curve math | Constant product AMM with virtual ADA, 1% fee, 320K NIGHT graduation target |

### Blocked — Waiting for Mainnet ⚠️

#### Token Creation & Buy / Sell
The full flow is implemented and tested through the wallet signing step, but **Midnight mainnet is in the Kūkolu phase** with dApp deployment guardrails still active. Only DUST transfers work; contract deployment is not yet enabled at the protocol level.

**The flow (ready to go once guardrails are lifted):**
1. Server builds an UNPROVEN deploy tx (fast — circuit construction only)
2. Browser proves via wallet's `getProvingProvider` (~30–60s, produces `pedersen-schnorr` binding)
3. Browser calls `balanceUnsealedTransaction` → wallet popup → user approves and pays DUST fees
4. Browser calls `submitTransaction` → broadcast to chain
5. Indexer fetches real contract state → updates Redis
6. Redirect to `/token/[contractAddress]`

**Trade flow (same pattern):**
1. Server builds unproven call tx for `buy` or `sell` circuit
2. Browser proves via wallet → balance → submit
3. Post-trade: indexer queried for real on-chain state (retries at 5s, 15s)
4. Redis updated with verified blockchain state

**Key findings from testing:**
- Server-side `httpClientProofProvider` produces `embedded-fr` binding — rejected by mainnet
- Wallet's `getProvingProvider` produces `pedersen-schnorr` binding — correct for mainnet
- Lace wallet: `balanceUnsealedTransaction` hangs (known DApp Connector bug)
- 1AM wallet: full flow works through to `submitTransaction`, chain rejects due to Kūkolu guardrails

### Not Started ❌

| Feature | What's needed |
|---------|--------------|
| Real portfolio | Query Midnight indexer for the connected wallet's ZK token balances — no public API for this yet |
| Real price chart | Subscribe to indexer WebSocket for per-contract trade events, store OHLCV in Redis |
| Graduation flow | When `adaReserve >= 320,000 NIGHT`, call contract's `graduate()` circuit and list on NorthStar DEX |
| Real holder tracking | Parse ZK outputs from indexer to count unique holders per token |
| Fee collection | 1% fee is calculated but not collected — needs treasury contract or fee recipient |
| End-to-end testing | Verify full flow on mainnet once dApp deployment is enabled |
| Comment / bump system | Social layer — users bump tokens to the top by posting |
| Token gating | Launch with a whitelist, vesting schedule, or creator fee |

---

## Architecture

### Deploy Flow

```
User fills launch form
  ↓ POST /api/deploy/unproven (Vercel → VPS:3002)
      → createUnprovenDeployTx(walletProvider, compiledContract, args)
      → returns { unprovenTxHex, contractAddress }
  ↓ Browser: deserialize unproven tx (ledger-v8)
  ↓ Browser: wallet.getProvingProvider(keyMaterial)
  ↓ Browser: unprovenTx.prove(provingProvider, costModel)   ← ZK proof (~30–60s)
  ↓ Browser: wallet.balanceUnsealedTransaction(provedHex)    ← wallet popup, user pays DUST
  ↓ Browser: wallet.submitTransaction(balanced.tx)           ← broadcast
  ↓ POST /api/tokens — save to Redis
  ↓ GET /api/indexer/[address] — fetch real on-chain state
  ↓ redirect /token/[contractAddress]
```

### Trade Flow

```
User clicks Buy / Sell
  ↓ POST /api/trade/unproven (Vercel → VPS:3002)
      → createUnprovenCallTx(contractAddress, buy|sell, args)
      → returns { unprovenTxHex }
  ↓ Browser: prove via wallet's getProvingProvider (~30s)
  ↓ Browser: wallet.balanceUnsealedTransaction(provedHex)    ← wallet popup, user pays DUST
  ↓ Browser: wallet.submitTransaction(balanced.tx)
  ↓ GET /api/indexer/[address] — verify on-chain state (retries 5s, 15s)
  ↓ PATCH /api/tokens/[address] { verify: true } — sync Redis from indexer
```

### Indexer Integration

```
GET /api/indexer/[address]
  → Query Midnight GraphQL indexer for contract public state
  → Deserialize hex state blob server-side via compact-runtime
  → Return { adaReserve, tokenReserve, totalVolume, txCount, state }

PATCH /api/tokens/[address] { verify: true }
  → Server queries indexer directly
  → Writes verified on-chain state to Redis
  → Fallback to client-provided values if indexer unavailable
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
npm run deploy-server       # deploy server on :3001
npm run dev                 # Next.js on :3000
```

**Production (VPS):**
```bash
pm2 start ecosystem.deploy.config.cjs   # deploy server on :3002
# Port 80 → 3002 via iptables (persistent via netfilter-persistent)
# Vercel DEPLOY_SERVER_URL=http://<VPS_IP>
```

**Compile contracts:**
```bash
npm run compile-contracts
```

---

## Environment Variables

### Vercel (frontend)

```bash
NEXT_PUBLIC_NETWORK_ID=mainnet
NEXT_PUBLIC_NETWORK_LABEL=Mainnet
NEXT_PUBLIC_DEPLOY_SERVER_URL=http://<VPS_IP>
NEXT_PUBLIC_INDEXER_HTTP=https://indexer.mainnet.midnight.network/api/v4/graphql
NEXT_PUBLIC_INDEXER_WS=wss://indexer.mainnet.midnight.network/api/v4/graphql/ws
DEPLOY_SERVER_URL=http://<VPS_IP>
KV_REST_API_URL=                        # Upstash Redis
KV_REST_API_TOKEN=
PINATA_JWT=                             # IPFS image uploads
```

### VPS (deploy server via PM2)

```bash
PORT=3002
NETWORK_ID=mainnet
DEPLOYER_SEED=<64-char hex>             # server wallet seed
TREASURY_SEED=<64-char hex>             # treasury witness key
PROOF_SERVER_URL=http://127.0.0.1:6300  # co-located Docker proof server
INDEXER_HTTP=https://indexer.mainnet.midnight.network/api/v4/graphql
INDEXER_WS=wss://indexer.mainnet.midnight.network/api/v4/graphql/ws
NODE_RPC=https://rpc.mainnet.midnight.network
```

---

## Contract Info

**Bonding Curve Contract** (`contracts/managed/bonding_curve/`)
- Language: Compact 0.30.0 (pragma 0.22)
- Circuits: `buy`, `sell`, `getProgress`, `pause`, `unpause`
- Graduation target: 320,000 NIGHT (~$15K USD)
- Total supply: 1,000,000,000 tokens (6 decimals)
- Initial token reserve: 999,000,000,000 (1B tokens minus 1M burn)
- Fee: 1% per trade (client-side, not yet collected on-chain)
- Witnesses: `treasurySecretKey`
- Bonding curve: Constant product AMM with 2,550 NIGHT virtual ADA

---

## SDK Versions (working)

```json
{
  "@midnight-ntwrk/compact-runtime": "0.15.0",
  "@midnight-ntwrk/compact-js": "2.5.0",
  "@midnight-ntwrk/midnight-js-contracts": "4.0.2",
  "@midnight-ntwrk/midnight-js-http-client-proof-provider": "4.0.2",
  "@midnight-ntwrk/midnight-js-level-private-state-provider": "4.0.2",
  "@midnight-ntwrk/midnight-js-indexer-public-data-provider": "4.0.2",
  "@midnight-ntwrk/midnight-js-fetch-zk-config-provider": "4.0.2",
  "@midnight-ntwrk/wallet-sdk-facade": "3.0.0",
  "@midnight-ntwrk/wallet-sdk-shielded": "2.1.0",
  "@midnight-ntwrk/wallet-sdk-hd": "3.0.1",
  "@midnight-ntwrk/wallet-sdk-dust-wallet": "3.0.0",
  "@midnight-ntwrk/wallet-sdk-unshielded-wallet": "2.1.0",
  "@midnight-ntwrk/ledger-v8": "8.0.3",
  "@midnight-ntwrk/dapp-connector-api": "4.0.1"
}
```

---

## Known Issues

| Issue | Cause | Status |
|-------|-------|--------|
| Contract deployment blocked on mainnet | Kūkolu phase — dApp guardrails not yet lifted | Waiting for Midnight |
| Lace `balanceUnsealedTransaction` hangs | Known DApp Connector bug in Lace | Use 1AM wallet instead |
| Server proof produces wrong binding | `httpClientProofProvider` → `embedded-fr`, mainnet needs `pedersen-schnorr` | Fixed: use wallet's `getProvingProvider` |
| Fee not collected on-chain | 1% fee calculated client-side but not sent to treasury | Needs treasury contract |
| Portfolio shows empty | No indexer API for user ZK balances | Waiting for Midnight indexer extension |
| Discord link placeholder | `https://discord.gg/` not filled in | Update with real invite link |

---

## Mainnet Readiness Checklist

- [x] Wallet connect (1AM + Lace)
- [x] Contract compiled (Compact 0.30.0)
- [x] Deploy flow (unproven → wallet proves → balance → submit)
- [x] Trade flow (buy/sell via same pattern)
- [x] Proof format correct (`pedersen-schnorr` via wallet proving)
- [x] User pays DUST fees (not server wallet)
- [x] Indexer integration (real on-chain state after trades)
- [x] Image upload (IPFS via Pinata)
- [x] Token registry (Redis)
- [x] Empty states (no mock data)
- [ ] Mainnet dApp deployment enabled (waiting for Midnight)
- [ ] Recompile contract with latest Compact (if needed post-guardrail)
- [ ] Graduation to DEX
- [ ] Fee collection
- [ ] Real price chart from trade events
- [ ] Real holder tracking
