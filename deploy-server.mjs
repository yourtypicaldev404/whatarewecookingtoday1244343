import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  deployContract,
  findDeployedContract,
  createUnprovenCallTx,
  getPublicStates,
} from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { createKeystore, InMemoryTransactionHistoryStorage, PublicKey, UnshieldedWallet } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { CompiledContract } from '@midnight-ntwrk/compact-js';

globalThis.WebSocket = WebSocket;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Load `.env` then `.env.local` (local overrides). Never replaces vars already set by the shell (e.g. Railway). */
function loadProjectEnvFiles() {
  function parseEnvFile(filePath) {
    const out = {};
    if (!fs.existsSync(filePath)) return out;
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
    return out;
  }
  const merged = {
    ...parseEnvFile(path.join(__dirname, '.env')),
    ...parseEnvFile(path.join(__dirname, '.env.local')),
  };
  for (const [k, v] of Object.entries(merged)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadProjectEnvFiles();

const ZK_PATH   = path.resolve(__dirname, './contracts/managed/bonding_curve');

/** Align with Lace / NEXT_PUBLIC_* — default Preview so chain state matches a Preview-configured wallet. */
const NETWORK_DEFAULTS = {
  preview: {
    INDEXER: 'https://indexer.preview.midnight.network/api/v4/graphql',
    INDEXERWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    NODE: 'https://rpc.preview.midnight.network',
  },
  preprod: {
    INDEXER: 'https://indexer.preprod.midnight.network/api/v3/graphql',
    INDEXERWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
    NODE: 'https://rpc.preprod.midnight.network',
  },
};

/**
 * Deploy server network — **NETWORK_ID only** (default `preview`).
 * Do not read NEXT_PUBLIC_NETWORK_ID here: Railway often copies Vercel-style env and a wrong
 * NEXT_PUBLIC_NETWORK_ID (e.g. preprod) would break indexer/trades vs Vercel preview.
 */
const NETWORK_ID = (process.env.NETWORK_ID ?? 'preview').toLowerCase();
const defaults = NETWORK_DEFAULTS[NETWORK_ID] ?? null;

/**
 * Indexer / RPC resolution (deploy server only):
 * 1) INDEXER_HTTP / INDEXER_WS / NODE_RPC — explicit override
 * 2) URLs derived from NETWORK_ID (preview vs preprod)
 * 3) NEXT_PUBLIC_* — last (Railway often mixes Preprod indexer with NETWORK_ID=preview; that breaks trades)
 */
const INDEXER =
  process.env.INDEXER_HTTP ??
  defaults?.INDEXER ??
  process.env.NEXT_PUBLIC_INDEXER_HTTP;
const INDEXERWS =
  process.env.INDEXER_WS ??
  defaults?.INDEXERWS ??
  process.env.NEXT_PUBLIC_INDEXER_WS;
const NODE =
  process.env.NODE_RPC ??
  defaults?.NODE ??
  process.env.NEXT_PUBLIC_MIDNIGHT_NODE_URL;

if (!INDEXER || !INDEXERWS || !NODE) {
  console.error(
    `[deploy-server] Missing indexer/node URLs for NETWORK_ID=${NETWORK_ID}. ` +
      'Set INDEXER_HTTP, INDEXER_WS, NODE_RPC (or use network preview|preprod).',
  );
  process.exit(1);
}

setNetworkId(NETWORK_ID);

/** Default hosted provers — Railway/cloud has no localhost prover; local dev overrides via .env.local or docker compose. */
const PROOF_DEFAULT_BY_NETWORK = {
  preview: 'https://lace-proof-pub.preview.midnight.network',
  preprod: 'https://lace-proof-pub.preprod.midnight.network',
};

const PROOF =
  process.env.PROOF_SERVER_URL ??
  PROOF_DEFAULT_BY_NETWORK[NETWORK_ID] ??
  process.env.NEXT_PUBLIC_PROOF_SERVER ??
  'http://127.0.0.1:6300';
const SEED      = process.env.DEPLOYER_SEED ?? '971da3750a45a3812c732f8b70ccb9d8c7e7b55e65700b87f5346fc1c7d1a952';
const TREASURY  = process.env.TREASURY_SEED ?? SEED;
const PORT      = process.env.PORT ?? process.env.DEPLOY_SERVER_PORT ?? 3001;

// Import contract
const { Contract } = await import('./contracts/managed/bonding_curve/contract/index.js');

/** Map SDK errors to actionable copy for swaps. */
function formatTradeBuildError(err) {
  const m = err?.message ?? String(err);
  if (m.includes('No public state found at contract address')) {
    return (
      `No indexer state for this contract on network "${NETWORK_ID}". ` +
      `The bonding curve was never deployed here, or Lace / the app / Railway use a different network than the deployment. ` +
      `Set deploy-server NETWORK_ID (Railway) to match where the token was deployed, and Vercel NEXT_PUBLIC_NETWORK_ID to the same network. ` +
      `Original: ${m}`
    );
  }
  return m;
}

// Derive shielded keys once at startup (no wallet sync needed).
// Used as walletProvider stub for createUnprovenCallTx — buy/sell circuits have no
// shielded outputs so the actual key values don't affect the trade result.
function deriveShieldedKeysFromSeed(seed) {
  const keys = (() => {
    const hd = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
    if (hd.type !== 'seedOk') throw new Error('Bad seed for shielded key derivation');
    const r = hd.hdWallet.selectAccount(0)
      .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
      .deriveKeysAt(0);
    if (r.type !== 'keysDerived') throw new Error('Key derivation failed');
    hd.hdWallet.clear();
    return r.keys;
  })();
  const shieldedSK = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  return {
    getCoinPublicKey: () => shieldedSK.coinPublicKey().toHexString(),
    getEncryptionPublicKey: () => shieldedSK.encryptionPublicKey().toHexString(),
  };
}
const TRADE_WALLET_PROVIDER = deriveShieldedKeysFromSeed(SEED);

function deriveKeys(seed) {
  const hd = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hd.type !== 'seedOk') throw new Error('Bad seed');
  const r = hd.hdWallet.selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (r.type !== 'keysDerived') throw new Error('Key derivation failed');
  hd.hdWallet.clear();
  return r.keys;
}

async function buildWallet(seed) {
  const keys       = deriveKeys(seed);
  const shieldedSK = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSK     = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const keystore   = createKeystore(keys[Roles.NightExternal], NETWORK_ID);
  const dustParams = ledger.LedgerParameters.initialParameters().dust;

  const config = {
    networkId: NETWORK_ID,
    indexerClientConnection: { indexerHttpUrl: INDEXER, indexerWsUrl: INDEXERWS },
    provingServerUrl: new URL(PROOF),
    relayURL: new URL(NODE.replace(/^http/, 'ws')),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
    costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  };

  const wallet = await WalletFacade.init({
    configuration: config,
    shielded:   (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSK),
    unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(keystore)),
    dust:       (cfg) => DustWallet(cfg).startWithSecretKey(dustSK, dustParams),
  });

  await wallet.start(shieldedSK, dustSK);

  await Rx.firstValueFrom(
    wallet.state().pipe(Rx.throttleTime(5000), Rx.filter(s => s.isSynced))
  );

  return { wallet, shieldedSK, dustSK, keystore };
}

async function deployBondingCurve() {
  const { wallet, shieldedSK, dustSK } = await buildWallet(SEED);
  const treasuryKeys = deriveKeys(TREASURY);
  const creatorSk  = new Uint8Array(Buffer.from(SEED, 'hex').slice(0, 32));
  const treasurySk = new Uint8Array(Buffer.from(TREASURY, 'hex').slice(0, 32));

  const state = await Rx.firstValueFrom(
    wallet.state().pipe(Rx.throttleTime(5000), Rx.filter(s => s.isSynced))
  );
  const walletProvider = {
    getCoinPublicKey:       () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx, ttl) {
      const recipe = await wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: shieldedSK, dustSecretKey: dustSK },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) }
      );
      return wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx) => wallet.submitTransaction(tx),
  };

  const zkConfig = new NodeZkConfigProvider(ZK_PATH);
  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'night-fun-state-' + Date.now(),
      privateStoragePasswordProvider: () => 'night-fun-secret-2026',
      accountId: 'deployer-' + Date.now(),
    }),
    publicDataProvider:  indexerPublicDataProvider(INDEXER, INDEXERWS),
    zkConfigProvider:    zkConfig,
    proofProvider:       httpClientProofProvider(PROOF, zkConfig),
    walletProvider,
    midnightProvider:    walletProvider,
  };

  const witnesses = { treasurySecretKey: () => treasurySk };
  const compiledContract = CompiledContract.make('bonding_curve', Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(ZK_PATH),
  );

  const deployed = await deployContract(providers, {
    compiledContract,
    privateStateId:      'bondingCurve',
    initialPrivateState: {},
    args: [creatorSk, treasurySk],
  });

  await wallet.stop();
  return {
    contractAddress: deployed.deployTxData.public.contractAddress,
    txId: deployed.deployTxData.public.txId,
  };
}

// Express server
const app = express();

// CORS for cross-origin requests from Vercel frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

app.get('/health', (_, res) =>
  res.json({
    status: 'ok',
    networkId: NETWORK_ID,
    proofServer: PROOF,
  }),
);

app.post('/deploy', async (req, res) => {
  console.log('Deploying contract for:', req.body.name, req.body.ticker);
  try {
    const result = await deployBondingCurve();
    console.log('Deployed:', result.contractAddress);
    res.json(result);
  } catch (err) {
    console.error('Deploy failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Build an unproven buy/sell call tx. The browser's Lace wallet proves + balances + submits.
 */
app.post('/trade/build', async (req, res) => {
  let {
    contractAddress,
    action,
    adaIn,
    tokensOut,
    tokensIn,
    adaOut,
  } = req.body;

  contractAddress = contractAddress?.replace(/^0x/, '');
  console.log(`Trade build: ${action} on ${contractAddress}`);

  if (!contractAddress || !action || !['buy', 'sell'].includes(action)) {
    return res.status(400).json({ error: 'Missing contractAddress or invalid action (buy|sell)' });
  }
  if (action === 'buy' && (adaIn === undefined || tokensOut === undefined)) {
    return res.status(400).json({ error: 'buy requires adaIn and tokensOut' });
  }
  if (action === 'sell' && (tokensIn === undefined || adaOut === undefined)) {
    return res.status(400).json({ error: 'sell requires tokensIn and adaOut' });
  }

  try {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = () => Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);

    const zkConfig = new NodeZkConfigProvider(ZK_PATH);
    const publicDataProvider = indexerPublicDataProvider(INDEXER, INDEXERWS);
    const providers = {
      zkConfigProvider: zkConfig,
      publicDataProvider,
      walletProvider: TRADE_WALLET_PROVIDER,
    };

    const treasurySk = new Uint8Array(Buffer.from(TREASURY, 'hex').slice(0, 32));
    const witnesses = { treasurySecretKey: () => treasurySk };
    const compiledContract = CompiledContract.make('bonding_curve', Contract).pipe(
      CompiledContract.withWitnesses(witnesses),
      CompiledContract.withCompiledFileAssets(ZK_PATH),
    );

    const args =
      action === 'buy'
        ? [BigInt(adaIn), BigInt(tokensOut)]
        : [BigInt(tokensIn), BigInt(adaOut)];

    const tBeforeUnproven = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const unsubmitted = await createUnprovenCallTx(providers, {
      compiledContract,
      contractAddress,
      circuitId: action === 'buy' ? 'buy' : 'sell',
      args,
    });
    const createUnprovenMs = Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - tBeforeUnproven,
    );

    const unprovenTxHex = Buffer.from(unsubmitted.private.unprovenTx.serialize()).toString('hex');

    const profile = {
      createUnprovenMs,
      serverTotalMs: elapsed(),
    };

    console.log(
      JSON.stringify({
        tradeProfile: {
          action,
          contractAddress,
          ...profile,
          note: 'Lace wallet proves + balances; server only builds unproven tx',
        },
      }),
    );

    res.json({ unprovenTxHex, contractAddress, action, profile });
  } catch (err) {
    console.error('Trade build failed:', err.message);
    res.status(500).json({ error: formatTradeBuildError(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Night.fun deploy server running on port ${PORT}`);
  console.log(`Network: ${NETWORK_ID} · indexer ${INDEXER}`);
  console.log(`Proof server: ${PROOF} (co-locate deploy + proof in the same region to cut latency)`);
});
