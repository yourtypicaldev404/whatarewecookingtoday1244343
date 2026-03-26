# Deployment checklist (Vercel + Railway)

What cannot be scripted in-repo (no access to your Vercel/Railway accounts) is listed as **you set in dashboard**. Everything else is in `package.json`, `docker-compose.yml`, and env examples.

## Preview everywhere (recommended)

Use **one** network end-to-end. Mismatch (e.g. Lace on Preprod, indexer on Preview) causes **“No public state found at contract address”** on buy/sell.

| Layer | Set |
|-------|-----|
| **Lace** | Settings → Midnight → **Preview** node + prover URL for Preview |
| **Vercel** | `NEXT_PUBLIC_NETWORK_ID=preview` and Preview indexer/RPC/proof from `.env.example` |
| **Railway (deploy server)** | **`NETWORK_ID=preview` only** — do **not** set `NEXT_PUBLIC_NETWORK_ID` here. Indexer/RPC: deploy-server uses URLs from **`NETWORK_ID`** first; stray **`NEXT_PUBLIC_INDEXER_*` / `NEXT_PUBLIC_MIDNIGHT_NODE_URL`** pointing at Preprod while `NETWORK_ID=preview` used to break trades — fixed in code, but clean up Railway vars to Preview URLs or remove duplicates. |

Copy values from `.env.example` (top section — already Preview). Do not mix Preprod URLs with `NEXT_PUBLIC_NETWORK_ID=preview`.

## Local stack (one command)

From the repo root, with Docker installed:

```bash
test -f .env.local || cp .env.local.example .env.local
npm run dev:local
```

This runs `docker compose up -d` (proof on **6300**), then **deploy-server** + **Next dev** together. Open **http://localhost:3000**.

**Lace (browser):** you must set **Settings → Midnight → Prover server → `http://localhost:6300`** on the machine where the extension runs. This cannot be set from the repo.

---

## Vercel (Next.js app)

In **Project → Settings → Environment Variables** (Production / Preview as needed):

| Variable | Purpose |
|----------|---------|
| `DEPLOY_SERVER_URL` | Public **Railway** URL of `deploy-server.mjs` (e.g. `https://your-service.up.railway.app`). **Never** `http://localhost` — the serverless API cannot reach your laptop. |
| `NEXT_PUBLIC_NETWORK_ID` | `preview`, `preprod`, or `mainnet` — must match Lace node config. |
| `NEXT_PUBLIC_MIDNIGHT_NODE_URL` | RPC for that network (see `.env.example`). |
| `NEXT_PUBLIC_INDEXER_HTTP` / `NEXT_PUBLIC_INDEXER_WS` | Indexer URLs for that network. |
| `NEXT_PUBLIC_PROOF_SERVER` | Usually `https://proof-server.preview.midnight.network` (or your hosted prover URL). Browsers cannot use `localhost` unless you only test on the same PC. |
| `NEXT_PUBLIC_APP_URL` | Canonical site URL. |
| Plus | Redis/KV, Pinata, etc. per `.env.example`. |

Redeploy after changing env vars.

---

## If trades return 502 / 503

1. **Check Railway deploy logs** for the deploy service — crash loops, OOM, or missing `contracts/` show up there.
2. **Open** `https://<your-deploy-service>.up.railway.app/health` — you should see JSON with `status: ok`, `networkId`, and `proofServer` (Midnight hosted URL).
3. **Redeploy** after changing `railway.json` (this repo uses `npm install` without `--ignore-scripts`, and `healthcheckPath: /health`).

`PROOF_SERVER_URL=https://proof-server.preview.midnight.network` is correct for Preview; **503** usually means the **Railway Node process** isn’t healthy (not the proof URL being wrong).

---

## Railway (deploy server — `node deploy-server.mjs`)

In the **deploy** service → **Variables**:

| Variable | Purpose |
|----------|---------|
| `PROOF_SERVER_URL` | **Optional on Preview/Preprod:** deploy-server defaults to Midnight’s hosted proof if unset (`proof-server.preview.midnight.network` / Preprod lace-proof-pub). **Self-hosted:** internal URL of your proof service (e.g. `http://proof-server.railway.internal:6300`). **Do not** rely on `http://127.0.0.1:6300` on Railway — there is no local prover unless you add one. |
| `NETWORK_ID` | `preview` / `preprod` / … — must match wallet + indexer. |
| `INDEXER_HTTP`, `INDEXER_WS`, `NODE_RPC` | Optional overrides; defaults come from `NETWORK_ID` in `deploy-server.mjs`. |
| `DEPLOYER_SEED` / `TREASURY_SEED` | Deploy wallet / treasury (hex). **Secrets — set only in Railway, never commit.** |
| `PORT` | Railway sets this automatically; optional override. |

`railway.json` in this repo already sets `startCommand` and `buildCommand`.

---

## Railway (optional second service — proof server)

To run **your own** prover next to the deploy service:

1. **New service** → **Deploy** → **Docker Image** → `midnightntwrk/proof-server:8.0.3`.
2. **Settings → Networking:** expose port **6300** (HTTP health on `/health` is used by the image).
3. **Enable private networking** between this service and the deploy service (same project).
4. On the **deploy** service, set `PROOF_SERVER_URL` to the proof service’s **internal** base URL (Railway UI shows private URLs), e.g. `http://<proof-service-name>:6300` — follow Railway’s docs for the exact hostname format in your project.

If you skip this, keep `PROOF_SERVER_URL` pointing at Midnight’s **hosted** proof endpoint instead.

---

## Secrets (never in git)

- `TREASURY_SK`, wallet seeds, Pinata JWT, Redis tokens: set only in **Railway / Vercel** dashboards or your password manager.

See `.env.example` for names; use **Generated** values in production.
