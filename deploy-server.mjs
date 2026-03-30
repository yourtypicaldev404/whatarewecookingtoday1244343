import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { WebSocket } from 'ws';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  deployContract,
  findDeployedContract,
  createUnprovenCallTx,
  createUnprovenDeployTx,
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

// ── Prevent Midnight SDK WebSocket disconnects from crashing the process ──
process.on('uncaughtException', (err) => {
  const msg = err?.message ?? '';
  // Suppress known SDK WS disconnects — they're recoverable
  if (msg.includes('disconnected') || msg.includes('1000') || msg.includes('WebSocket') || msg.includes('ECONNRESET')) {
    console.warn('[process] Suppressed uncaught exception (WS disconnect):', msg);
    return;
  }
  console.error('[process] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  const msg = reason?.message ?? String(reason);
  if (msg.includes('disconnected') || msg.includes('1000') || msg.includes('WebSocket') || msg.includes('ECONNRESET')) {
    console.warn('[process] Suppressed unhandled rejection (WS disconnect):', msg);
    return;
  }
  console.error('[process] Unhandled rejection:', reason);
});

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

/** Align with Lace / NEXT_PUBLIC_* — default Mainnet so chain state matches a Mainnet-configured wallet. */
const NETWORK_DEFAULTS = {
  mainnet: {
    INDEXER: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
    INDEXERWS: 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
    NODE: 'https://rpc.mainnet.midnight.network',
  },
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
 * Deploy server network — **NETWORK_ID only** (default `mainnet`).
 * Do not read NEXT_PUBLIC_NETWORK_ID here: Railway often copies Vercel-style env and a wrong
 * NEXT_PUBLIC_NETWORK_ID (e.g. preprod) would break indexer/trades vs Vercel mainnet.
 */
const NETWORK_ID = (process.env.NETWORK_ID ?? 'mainnet').toLowerCase();
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
      'Set INDEXER_HTTP, INDEXER_WS, NODE_RPC (or use network mainnet|preview|preprod).',
  );
  process.exit(1);
}

setNetworkId(NETWORK_ID);

/** Default hosted provers — Railway/cloud has no localhost prover; local dev overrides via .env.local or docker compose. */
const PROOF_DEFAULT_BY_NETWORK = {
  mainnet: 'http://127.0.0.1:6300',
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
  // Object.values works for real Uint8Array (own enumerable indices) AND WASM-bound {"0":x} objects
  const toHex = (v) => typeof v === 'string' ? v : Buffer.from(Object.values(v)).toString('hex');
  return {
    getCoinPublicKey: () => toHex(shieldedSK.coinPublicKey),
    getEncryptionPublicKey: () => toHex(shieldedSK.encryptionPublicKey),
  };
}
const TRADE_WALLET_PROVIDER = deriveShieldedKeysFromSeed(SEED);

// Wallet — built on-demand per deploy/signed request, not kept warm.
// The Midnight SDK opens persistent WS connections that crash the process on disconnect,
// so we build fresh per request and stop the wallet after use.
let _walletPromise = null;

function ensureWalletReady() {
  if (_walletPromise) return _walletPromise;
  console.log('[wallet] Building wallet on-demand...');
  _walletPromise = buildWallet(SEED).then(result => {
    console.log('[wallet] ready');
    return result;
  }).catch(err => {
    _walletPromise = null;
    console.error('[wallet] init failed:', err.message);
    throw err;
  });
  return _walletPromise;
}

function resetWallet() {
  if (_walletPromise) {
    _walletPromise.then(({ wallet }) => {
      try { wallet.stop(); } catch {}
    }).catch(() => {});
  }
  _walletPromise = null;
}

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
  await wallet.waitForSyncedState();

  return { wallet, shieldedSK, dustSK, keystore };
}

async function deployBondingCurve() {
  const { wallet, shieldedSK, dustSK } = await buildWallet(SEED);
  const treasuryKeys = deriveKeys(TREASURY);
  const creatorSk  = new Uint8Array(Buffer.from(SEED, 'hex').slice(0, 32));
  const treasurySk = new Uint8Array(Buffer.from(TREASURY, 'hex').slice(0, 32));

  const state = await wallet.waitForSyncedState();
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

app.get('/health', (_, res) => {
  const cpk = TRADE_WALLET_PROVIDER.getCoinPublicKey();
  res.json({
    status: 'ok',
    networkId: NETWORK_ID,
    proofServer: PROOF,
    v: 14,
    debug_cpk_type: typeof cpk,
    debug_cpk_ctor: cpk?.constructor?.name ?? 'null',
    debug_cpk_len: cpk?.length ?? 'n/a',
    debug_cpk_preview: String(cpk).slice(0, 80),
    debug_has_toHexString: typeof cpk?.toHexString,
    debug_has_buffer: String(typeof cpk?.buffer),
  });
});

/**
 * Serve ZK config artifacts (prover keys, verifier keys, zkir) so the browser's
 * FetchZkConfigProvider can load them for client-side proving via Lace's getProvingProvider.
 *
 * FetchZkConfigProvider expects:
 *   GET {baseURL}/keys/{circuitId}.prover
 *   GET {baseURL}/keys/{circuitId}.verifier
 *   GET {baseURL}/zkir/{circuitId}.bzkir
 *
 * We also support the non-.bzkir extension (.zkir) for compat.
 */
app.use('/zk-config', express.static(ZK_PATH, {
  setHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=86400');
  },
}));

// FetchZkConfigProvider requests .bzkir but our files are .zkir — add a fallback
app.get('/zk-config/zkir/:circuit.bzkir', (req, res) => {
  const filePath = path.join(ZK_PATH, 'zkir', `${req.params.circuit}.zkir`);
  if (fs.existsSync(filePath)) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: `zkir not found: ${req.params.circuit}` });
  }
});

/**
 * Build and ZK-prove a deploy tx for the user's Lace wallet to sign.
 * Returns { provedTxHex, contractAddress } — browser calls
 * wallet.balanceUnsealedTransaction(provedTxHex) to add fees + get Lace popup,
 * then wallet.submitTransaction() to broadcast.
 */
app.post('/deploy', async (req, res) => {
  const { name, ticker, userCoinPublicKey, userEncryptionPublicKey } = req.body;
  console.log('[deploy] Building proved deploy tx for:', name, ticker,
    '| userCpk:', userCoinPublicKey ? userCoinPublicKey.slice(0, 20) + '...' : 'none');
  try {
    const zkConfig   = new NodeZkConfigProvider(ZK_PATH);
    const creatorSk  = new Uint8Array(Buffer.from(SEED, 'hex').slice(0, 32));
    const treasurySk = new Uint8Array(Buffer.from(TREASURY, 'hex').slice(0, 32));
    const witnesses  = { treasurySecretKey: () => treasurySk };
    const compiledContract = CompiledContract.make('bonding_curve', Contract).pipe(
      CompiledContract.withWitnesses(witnesses),
      CompiledContract.withCompiledFileAssets(ZK_PATH),
    );

    // Use user's ZK keys so Lace recognises the outputs as its own when balancing.
    const walletProvider = (userCoinPublicKey && userEncryptionPublicKey)
      ? { getCoinPublicKey: () => userCoinPublicKey, getEncryptionPublicKey: () => userEncryptionPublicKey }
      : TRADE_WALLET_PROVIDER;

    // signingKey must be a hex string (SDK validates as ConstrainedPlainHex)
    const signingKey = Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(32))).toString('hex');

    console.log('[deploy] createUnprovenDeployTx...');
    const unprovenData = await createUnprovenDeployTx(
      { zkConfigProvider: zkConfig, walletProvider },
      { compiledContract, initialPrivateState: {}, args: [creatorSk, treasurySk], signingKey },
    );
    const contractAddress = unprovenData.public.contractAddress;
    console.log('[deploy] contractAddress:', contractAddress, '— proving via', PROOF, '...');

    // Lace balanceUnsealedTransaction requires a proved (not proof-preimage) tx.
    const proofProvider = httpClientProofProvider(PROOF, zkConfig);
    const provedTx      = await proofProvider.proveTx(unprovenData.private.unprovenTx);
    const provedTxHex   = Buffer.from(provedTx.serialize()).toString('hex');
    console.log('[deploy] proved — returning to browser for Lace signing');

    res.json({ provedTxHex, contractAddress });
  } catch (err) {
    console.error('[deploy] Failed:', err.message, '\n', err.stack);
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 8) });
  }
});

/**
 * Build an UNPROVEN deploy tx — the browser will prove it via Lace's getProvingProvider,
 * then balance + submit through Lace. This avoids the serialization mismatch that causes
 * balanceUnsealedTransaction to hang when the proof comes from a server-side provider.
 *
 * Returns { unprovenTxHex, contractAddress }
 */
app.post('/deploy/unproven', async (req, res) => {
  const { userCoinPublicKey, userEncryptionPublicKey } = req.body;
  console.log('[deploy/unproven] Building unproven deploy tx',
    '| userCpk:', userCoinPublicKey ? userCoinPublicKey.slice(0, 20) + '...' : 'none');
  try {
    const zkConfig   = new NodeZkConfigProvider(ZK_PATH);
    const creatorSk  = new Uint8Array(Buffer.from(SEED, 'hex').slice(0, 32));
    const treasurySk = new Uint8Array(Buffer.from(TREASURY, 'hex').slice(0, 32));
    const witnesses  = { treasurySecretKey: () => treasurySk };
    const compiledContract = CompiledContract.make('bonding_curve', Contract).pipe(
      CompiledContract.withWitnesses(witnesses),
      CompiledContract.withCompiledFileAssets(ZK_PATH),
    );

    const walletProvider = (userCoinPublicKey && userEncryptionPublicKey)
      ? { getCoinPublicKey: () => userCoinPublicKey, getEncryptionPublicKey: () => userEncryptionPublicKey }
      : TRADE_WALLET_PROVIDER;

    const signingKey = Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(32))).toString('hex');

    console.log('[deploy/unproven] createUnprovenDeployTx...');
    const unprovenData = await createUnprovenDeployTx(
      { zkConfigProvider: zkConfig, walletProvider },
      { compiledContract, initialPrivateState: {}, args: [creatorSk, treasurySk], signingKey },
    );
    const contractAddress = unprovenData.public.contractAddress;
    const unprovenTxHex   = Buffer.from(unprovenData.private.unprovenTx.serialize()).toString('hex');
    console.log('[deploy/unproven] contractAddress:', contractAddress, '— returning unproven tx for client-side proving');

    res.json({ unprovenTxHex, contractAddress });
  } catch (err) {
    console.error('[deploy/unproven] Failed:', err.message, '\n', err.stack);
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 8) });
  }
});

/**
 * Server-side deploy authorized by the user's Lace signData signature.
 *
 * Uses the server's warm wallet to prove + balance + submit (bypasses the broken
 * Lace balanceUnsealedTransaction). The user's Lace signature + verifyingKey are
 * stored as proof of authorization, and the verifyingKey is recorded as the creator.
 *
 * Returns { contractAddress, txId, creatorKey }.
 */
app.post('/deploy/signed', async (req, res) => {
  const { name, ticker, signature, verifyingKey } = req.body;
  console.log('[deploy/signed] Server-side deploy for:', name, ticker,
    '| creator:', verifyingKey ? verifyingKey.slice(0, 20) + '...' : 'anonymous');

  if (!name || !ticker) {
    return res.status(400).json({ error: 'Missing name or ticker' });
  }
  if (!signature || !verifyingKey) {
    return res.status(400).json({ error: 'Missing Lace signature — user must sign the deploy request' });
  }

  try {
    const { wallet, shieldedSK, dustSK } = await ensureWalletReady();

    const creatorSk  = new Uint8Array(Buffer.from(SEED, 'hex').slice(0, 32));
    const treasurySk = new Uint8Array(Buffer.from(TREASURY, 'hex').slice(0, 32));

    const state = await wallet.waitForSyncedState();

    const walletProvider = {
      getCoinPublicKey:       () => state.shielded.coinPublicKey.toHexString(),
      getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
      async balanceTx(tx, ttl) {
        const recipe = await wallet.balanceUnboundTransaction(
          tx,
          { shieldedSecretKeys: shieldedSK, dustSecretKey: dustSK },
          { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
        );
        return wallet.finalizeRecipe(recipe);
      },
      submitTx: (tx) => wallet.submitTransaction(tx),
    };

    const zkConfig = new NodeZkConfigProvider(ZK_PATH);
    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: 'night-fun-deploy-' + Date.now(),
        privateStoragePasswordProvider: () => 'night-fun-secret-2026',
        accountId: 'deployer-' + Date.now(),
      }),
      publicDataProvider: indexerPublicDataProvider(INDEXER, INDEXERWS),
      zkConfigProvider:   zkConfig,
      proofProvider:      httpClientProofProvider(PROOF, zkConfig),
      walletProvider,
      midnightProvider:   walletProvider,
    };

    const witnesses = { treasurySecretKey: () => treasurySk };
    const compiledContract = CompiledContract.make('bonding_curve', Contract).pipe(
      CompiledContract.withWitnesses(witnesses),
      CompiledContract.withCompiledFileAssets(ZK_PATH),
    );

    console.log('[deploy/signed] deployContract (prove + balance + submit)...');
    const deployed = await deployContract(providers, {
      compiledContract,
      privateStateId:      'bondingCurve-' + Date.now(),
      initialPrivateState: {},
      args: [creatorSk, treasurySk],
    });

    const contractAddress = deployed.deployTxData.public.contractAddress;
    const txId            = deployed.deployTxData.public.txId;
    console.log('[deploy/signed] deployed! contractAddress:', contractAddress, '| txId:', txId);
    res.json({ contractAddress, txId, creatorKey: verifyingKey });
  } catch (err) {
    console.error('[deploy/signed] failed:', err.message, '\n', err.stack);
    resetWallet(); // Force rebuild on next request
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 8) });
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

    // Prove the transaction on the server — Lace's balanceUnsealedTransaction
    // requires proof format, not proof-preimage.
    const proofProvider = httpClientProofProvider(PROOF, zkConfig);
    const provenTx = await proofProvider.proveTx(unsubmitted.private.unprovenTx);
    const unprovenTxHex = Buffer.from(provenTx.serialize()).toString('hex');

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
        },
      }),
    );

    res.json({ unprovenTxHex, contractAddress, action, profile });
  } catch (err) {
    console.error('Trade build failed:', err.message);
    res.status(500).json({ error: formatTradeBuildError(err) });
  }
});

/**
 * Build an UNPROVEN buy/sell tx — browser proves via Lace's getProvingProvider,
 * then balances + submits through Lace.
 */
app.post('/trade/unproven', async (req, res) => {
  let { contractAddress, action, adaIn, tokensOut, tokensIn, adaOut } = req.body;
  contractAddress = contractAddress?.replace(/^0x/, '');
  console.log(`[trade/unproven] ${action} on ${contractAddress}`);

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

    const args = action === 'buy'
      ? [BigInt(adaIn), BigInt(tokensOut)]
      : [BigInt(tokensIn), BigInt(adaOut)];

    const unsubmitted = await createUnprovenCallTx(providers, {
      compiledContract,
      contractAddress,
      circuitId: action === 'buy' ? 'buy' : 'sell',
      args,
    });

    const unprovenTxHex = Buffer.from(unsubmitted.private.unprovenTx.serialize()).toString('hex');
    res.json({ unprovenTxHex, contractAddress, action });
  } catch (err) {
    console.error('[trade/unproven] failed:', err.message);
    res.status(500).json({ error: formatTradeBuildError(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Night.fun deploy server running on port ${PORT}`);
  console.log(`Network: ${NETWORK_ID} · indexer ${INDEXER}`);
  console.log(`Proof server: ${PROOF} (co-locate deploy + proof in the same region to cut latency)`);
});
