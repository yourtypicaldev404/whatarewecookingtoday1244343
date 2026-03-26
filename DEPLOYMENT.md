# Deployment checklist (Vercel + Railway)

What cannot be scripted in-repo (no access to your Vercel/Railway accounts) is listed as **you set in dashboard**. Everything else is in `package.json`, `docker-compose.yml`, and env examples.

## Local stack (one command)

From the repo root, with Docker installed:

```bash
test -f .env.local || cp .env.local.example .env.local
npm run dev:local
```

This runs `docker compose up -d` (proof on **6300**), then **deploy-server** + **Next dev** together. The app and deploy server **listen on `0.0.0.0`** so they are reachable from other machines on the network (not only localhost).

- Same machine: open **http://localhost:3000** and set Lace prover to **http://localhost:6300**.

### Browser on laptop, app on a remote server (VPS)

1. On the server, open the firewall for **3000** (Next), **3001** (deploy API target — usually only needed server-side), **6300** (proof). Example: `sudo ufw allow 3000,3001,6300/tcp && sudo ufw reload`.
2. Find the server’s public IP or DNS name (`YOUR_PUBLIC_IP`).
3. On your laptop, open **http://YOUR_PUBLIC_IP:3000**.
4. In **Lace → Midnight → Prover server**, use **http://YOUR_PUBLIC_IP:6300** (not `localhost` — that would point at your laptop).

`DEPLOY_SERVER_URL` and `PROOF_SERVER_URL` in `.env.local` on the server stay **`http://localhost:3001`** and **`http://127.0.0.1:6300`** — traffic stays on the VPS. Only the **browser** talks to the public IP.

**Safer (no public proof port):** from your laptop, SSH tunnel instead of exposing 6300:

```bash
ssh -L 3000:127.0.0.1:3000 -L 6300:127.0.0.1:6300 user@YOUR_PUBLIC_IP
```

Then use **http://localhost:3000** and Lace **http://localhost:6300** as if everything were local.

**Lace (browser):** the prover URL is always set in the wallet UI — not in this repo.

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

## Railway (deploy server — `node deploy-server.mjs`)

In the **deploy** service → **Variables**:

| Variable | Purpose |
|----------|---------|
| `PROOF_SERVER_URL` | **Hosted:** `https://proof-server.preview.midnight.network` (or Preprod equivalent). **Self-hosted proof:** internal URL of the proof service below (e.g. `http://proof-server.railway.internal:6300` — use the hostname Railway shows for private networking). **Not** `http://127.0.0.1`. |
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
