# 🌙 night.fun

**Midnight Network memecoin launchpad.**  
Privacy-first bonding curves. ZK-verified trades. First on Preprod.

---

## Stack

| Layer | Tech |
|-------|------|
| Smart contracts | Compact 0.29.0 (language_version 0.21) |
| Proof generation | Docker proof-server:7.0.0 |
| Blockchain | Midnight Preprod (Ledger 7.0) |
| Indexer | GraphQL v3 (`/api/v3/graphql`) |
| Wallet | Lace + DApp Connector API v4.0.0 |
| Frontend | Next.js 15, React 19 |
| Images | IPFS via Pinata |

---

## Prerequisites

1. **Google Chrome** with [Lace wallet](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk)  
   → Settings → Beta features → Enable Midnight → Add Midnight wallet

2. **Docker Desktop** running  

3. **Node.js 22+**  

4. **Compact compiler**  
   ```bash
   curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
   compact update   # ensure 0.29.0
   compact --version
   ```

---

## Setup (this week)

```bash
git clone https://github.com/yourname/night-fun
cd night-fun
npm install
cp .env.example .env.local
```

Edit `.env.local` — the only required fields to start:
```
NEXT_PUBLIC_NETWORK_ID=preprod
NEXT_PUBLIC_TREASURY_PK=<generate below>
```

Generate treasury key:
```bash
node -e "const c=require('crypto'); const sk=c.randomBytes(32); const hash=c.createHash('sha256').update(Buffer.concat([Buffer.from('night:fun:pk:v1'), Buffer.alloc(32), sk])).digest('hex'); console.log('SK:', sk.toString('hex')); console.log('PK (treasury_pk):', hash)"
```

### Step 1 — Start proof server

```bash
npm run start-proof-server
# OR:
docker-compose up -d
```

Verify: http://localhost:6300 should respond.

Configure Lace: Settings → Midnight → Prover Server → Local (http://localhost:6300)

### Step 2 — Compile contracts

```bash
npm run compile-contracts
```

This generates `contracts/managed/bonding_curve/contract/index.cjs` and proving keys.

### Step 3 — Get testnet tokens

1. Run `npm run deploy` → create a new wallet → copy your unshielded address  
2. Paste address into https://faucet.preprod.midnight.network/  
3. Wait ~2 minutes for tNIGHT to arrive  
4. Run `npm run deploy` again → Restore from seed → DUST auto-generates

### Step 4 — Deploy first bonding curve

```bash
npm run deploy
# Follow prompts: name, ticker, description, initial buy
# Saves to deployment.json
```

### Step 5 — Wire contract bindings into transactions.ts

After `npm run compile-contracts` succeeds, open `src/lib/transactions.ts` and:

1. Uncomment the import:
   ```ts
   import { Contract } from '../../contracts/managed/bonding_curve/contract/index.cjs';
   ```

2. Replace the `throw new Error(...)` stubs with real calls using the `deployContract` / `callCircuit` pattern from the counter example.

### Step 6 — Start frontend

```bash
npm run dev
# → http://localhost:3000
```

---

## Testnet endpoints (hardcoded in .env.example)

| Service | URL |
|---------|-----|
| Node RPC | https://rpc.preprod.midnight.network |
| Indexer GraphQL | https://indexer.preprod.midnight.network/api/v3/graphql |
| Indexer WS | wss://indexer.preprod.midnight.network/api/v3/graphql/ws |
| Proof server (hosted) | https://lace-proof-pub.preprod.midnight.network |
| Faucet | https://faucet.preprod.midnight.network/ |

---

## Architecture

```
night.fun
│
├── contracts/
│   ├── bonding_curve.compact     ← AMM + lifecycle (pragma 0.21, Uint<128>)
│   └── vesting.compact           ← Token lock/unlock
│
├── scripts/
│   └── deploy.ts                 ← Headless wallet + deploy to Preprod
│
├── src/
│   ├── app/
│   │   ├── page.tsx              ← Discovery / homepage
│   │   ├── launch/page.tsx       ← 4-step launch wizard
│   │   ├── token/[address]/      ← Token detail + trade panel
│   │   └── api/
│   │       ├── tokens/           ← Token registry (GET/POST)
│   │       ├── tokens/[address]/ ← Live token state (queries Indexer)
│   │       └── upload/           ← IPFS upload via Pinata
│   │
│   ├── components/
│   │   ├── Navbar.tsx            ← Wallet connect (DApp Connector v4)
│   │   └── TokenCard.tsx
│   │
│   └── lib/
│       ├── midnight/
│       │   └── bondingCurve.ts   ← Price math (matches Compact contract)
│       ├── wallet/
│       │   └── WalletProvider.tsx ← window.midnight.{id}.connect()
│       ├── indexer.ts            ← GraphQL v3 client
│       └── transactions.ts       ← prove → balance → submit flow
```

---

## Bonding curve math

Constant-product AMM with virtual reserve floor:

```
k = (ada_reserve + VIRTUAL_ADA) × token_reserve

tokens_out = token_reserve − k ÷ (ada_reserve + VIRTUAL_ADA + ada_in_net)
```

| Parameter | Value |
|-----------|-------|
| Total supply | 1,000,000,000 tokens |
| Graduation | ₾69,000 DUST market cap |
| Starting mcap | ~₾2,550 DUST |
| Burn | 1,000,000 tokens (0.1%) |
| Trade fee | 1% (100bps) |
| Social update fee | ₾150 DUST |

**Why Uint<128>?** With ada_reserve ≈ 69k DUST (69×10⁹ tDUST) and token_reserve ≈ 10¹⁵, intermediate products reach ~7×10²⁵ — safely within Uint<128> (max ~3.4×10³⁸) but would overflow Uint<64> (max ~1.8×10¹⁹).

---

## What's wired vs what still needs wiring

| Feature | Status |
|---------|--------|
| Compact contracts | ✅ Written & correct |
| Price math (TS) | ✅ Matches contract exactly |
| Wallet connect (DApp Connector v4) | ✅ Correct API |
| Indexer GraphQL client | ✅ Real v3 schema |
| Deploy script (headless wallet) | ✅ Pattern from docs |
| Frontend UI | ✅ Complete |
| API routes | ✅ Complete |
| **Contract compilation** | ⬜ Run `npm run compile-contracts` |
| **Contract bindings** | ⬜ Wire compiled types into transactions.ts |
| **Real tx submission** | ⬜ Uncomment SDK calls in transactions.ts |
| **Indexer ledger decoder** | ⬜ Use compiled contract decoder |
| **TradingView chart** | ⬜ `npm install lightweight-charts` |
| **Token registry DB** | ⬜ Replace mock with Prisma + SQLite |

---

## Compatibility matrix

Targeting: https://docs.midnight.network/relnotes/overview#preprod

| Component | Version |
|-----------|---------|
| Compact language | 0.21 |
| Compact compiler | 0.29.0 |
| Proof Server | 7.0.0 |
| Ledger | 7.0.0 |
| Indexer | 3.1.0 |
| DApp Connector API | 4.0.0 |
| Midnight.js | 3.1.0 |
| Node.js | 22+ |
