# 🌙 night.fun

**pump.fun for Midnight Network.**
Users launch memecoins with real Zero Knowledge smart contracts. Each token has a bonding curve — price goes up as people buy. When the curve fills, the token graduates to NorthStar DEX.

Privacy-first: trades are ZK-verified, nobody sees your wallet balance or transaction history.

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

## Architecture

```
User → nightdotfun.vercel.app (Next.js)
↓
/api/deploy → Railway deploy server
↓
Midnight SDK → ZK Proof → Midnight Preprod
↓
Contract address saved to Upstash KV
↓
Token page live at /token/[address]
```

---

## Working ✅

- [x] Homepage with King of the Hill, token grid, search/sort
- [x] 4-step token launch wizard
- [x] Token page with bonding curve progress, buy/sell UI, price chart
- [x] Real ZK contract deploy — every token launch deploys a real Midnight contract
- [x] Wallet connect via Lace (Preprod)
- [x] Token registry persists to Upstash Redis
- [x] Token images upload to IPFS via Pinata
- [x] Social links (Twitter, Telegram, website, Discord)
- [x] Deploy server running 24/7 on Railway
- [x] Live at nightdotfun.vercel.app

---

## TODO ⬜

### High Priority

- [ ] **Real buy/sell** — Buy/Sell buttons currently show placeholder. Need to call bonding curve `buy()` / `sell()` circuits via Lace DApp Connector. The contract is deployed, just needs the transaction wiring.
- [ ] **Real price chart** — currently mock data. Subscribe to Midnight indexer WebSocket for real trade history per contract address.
- [ ] **Token images on homepage cards** — uploaded images go to IPFS but homepage cards show moon emoji. Need to load from `imageUri` field.

### Medium Priority

- [ ] **Portfolio page** — show user's token holdings, P&L, transaction history
- [ ] **Graduation flow** — when bonding curve hits 69,000 DUST target, auto-list on NorthStar DEX
- [ ] **Real token balances** — track holder counts and balances from indexer

### Mainnet Switch (end of day)

```bash
vercel env add NEXT_PUBLIC_NETWORK_ID    # mainnet
vercel env add NEXT_PUBLIC_INDEXER_URL   # https://indexer.midnight.network/api/v3/graphql
vercel env add NEXT_PUBLIC_INDEXER_WS    # wss://indexer.midnight.network/api/v3/graphql/ws
vercel --prod
```

---

## Install & Run

```bash
npm install
```

Run frontend:
```bash
npm run dev
```

Run deploy server (separate terminal):
```bash
node deploy-server.mjs
```

Run proof server (Docker):
```bash
docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v
```

Compile contracts:
```bash
npm run compile-contracts
```

---

## Environment Variables

```bash
# Upstash Redis
KV_REST_API_URL=
KV_REST_API_TOKEN=

# Pinata IPFS
PINATA_JWT=

# Deploy Server
DEPLOY_SERVER_URL=https://whatarewecookingtoday1244343-production.up.railway.app/
NEXT_PUBLIC_DEPLOY_SERVER_URL=https://whatarewecookingtoday1244343-production.up.railway.app/

# Network
NEXT_PUBLIC_NETWORK_ID=preprod
```

---

## Contract Info

**Bonding Curve Contract**
- Language: Compact 0.30.0 (pragma 0.22)
- Runtime: compact-runtime 0.15.0
- Circuits: `buy`, `sell`, `getProgress`, `pause`, `unpause`
- Graduation target: 69,000 DUST
- Witnesses: `treasurySecretKey`

**Working deploy seed (Preprod)**
- Address: `mn_addr_preprod1zecl9jk3e2k7dghga8wqja6y5nanx6f4cew26naanwveulawwnpsv67ffc`
- Stored in `deployment.json`

---

## Working Versions

```json
{
  "@midnight-ntwrk/compact-runtime": "0.15.0",
  "@midnight-ntwrk/compact-js": "2.5.0",
  "@midnight-ntwrk/midnight-js-contracts": "4.0.1",
  "@midnight-ntwrk/midnight-js-http-client-proof-provider": "4.0.1",
  "@midnight-ntwrk/midnight-js-level-private-state-provider": "4.0.1",
  "@midnight-ntwrk/wallet-sdk-facade": "3.0.0",
  "@midnight-ntwrk/wallet-sdk-shielded": "2.1.0",
  "@midnight-ntwrk/wallet-sdk-hd": "3.0.1",
  "@midnight-ntwrk/wallet-sdk-dust-wallet": "3.0.0",
  "@midnight-ntwrk/wallet-sdk-unshielded-wallet": "2.1.0",
  "@midnight-ntwrk/ledger-v8": "8.0.3"
}
```
