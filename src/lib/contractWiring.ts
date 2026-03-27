'use client';

import type { ConnectedAPI, KeyMaterialProvider, ProvingProvider } from '@midnight-ntwrk/dapp-connector-api';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lace `submitTransaction` returns void — derive an on-chain id from the serialized balanced tx. */
function txIdFromBalancedHex(balancedTxHex: string): string {
  const raw = hexToBytes(balancedTxHex);
  const tx = ledger.Transaction.deserialize('signature', 'proof', 'binding', raw);
  const ids = tx.identifiers();
  return ids[0] ?? tx.transactionHash();
}

/** Rejects after `ms` ms with a user-friendly message — wraps any promise. */
function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

/**
 * Build a KeyMaterialProvider adapter from FetchZkConfigProvider for Lace's getProvingProvider.
 * Lace expects { getZKIR, getProverKey, getVerifierKey } that return Uint8Array.
 * FetchZkConfigProvider wraps them in opaque types — we access the underlying bytes.
 */
function buildKeyMaterialProvider(zkConfigUrl: string): KeyMaterialProvider {
  const zkConfig = new FetchZkConfigProvider(zkConfigUrl);
  return {
    async getZKIR(circuitKeyLocation: string): Promise<Uint8Array> {
      const zkir = await zkConfig.getZKIR(circuitKeyLocation);
      // FetchZkConfigProvider wraps bytes in createZKIR — extract the raw Uint8Array
      return zkir instanceof Uint8Array ? zkir : new Uint8Array(zkir as ArrayBuffer);
    },
    async getProverKey(circuitKeyLocation: string): Promise<Uint8Array> {
      const key = await zkConfig.getProverKey(circuitKeyLocation);
      return key instanceof Uint8Array ? key : new Uint8Array(key as ArrayBuffer);
    },
    async getVerifierKey(circuitKeyLocation: string): Promise<Uint8Array> {
      const key = await zkConfig.getVerifierKey(circuitKeyLocation);
      return key instanceof Uint8Array ? key : new Uint8Array(key as ArrayBuffer);
    },
  };
}

/**
 * Prove an unproven transaction hex using Lace's getProvingProvider.
 * Returns the proved tx as hex, ready for balanceUnsealedTransaction.
 *
 * The key advantage: proving via Lace ensures the proof format is 100% compatible
 * with Lace's internal balancer, avoiding the hang caused by server-side proof format mismatch.
 */
async function proveViaLace(
  wallet: ConnectedAPI,
  unprovenTxHex: string,
  zkConfigUrl: string,
): Promise<string> {
  // Deserialize the unproven tx (Transaction<SignatureEnabled, PreProof, PreBinding>)
  const raw = hexToBytes(unprovenTxHex);
  const unprovenTx = ledger.Transaction.deserialize('signature', 'pre-proof', 'pre-binding', raw);

  // Get Lace's proving provider
  const keyMaterial = buildKeyMaterialProvider(zkConfigUrl);
  const provingProvider: ProvingProvider = await wallet.getProvingProvider(keyMaterial);

  // Prove using Lace — this calls provingProvider.prove() for each circuit
  const costModel = ledger.CostModel.initialCostModel();
  console.log('[prove] Proving tx via Lace getProvingProvider...');
  const provedTx = await unprovenTx.prove(provingProvider, costModel);

  return bytesToHex(provedTx.serialize());
}

// ── Deploy ──────────────────────────────────────────────────────────────────

/**
 * Deploy a bonding curve token with user signing via Lace.
 *
 * Flow:
 * 1. Get user's ZK public keys from Lace
 * 2. Server builds the UNPROVEN deploy tx (fast — no proving)
 * 3. Browser proves the tx via Lace's getProvingProvider (~30–60s)
 * 4. Browser calls balanceUnsealedTransaction → Lace popup → user signs
 * 5. Browser submits via Lace
 *
 * The key difference from the old flow: proving happens through Lace's own infrastructure,
 * ensuring the proved transaction is in the exact format Lace's balancer expects.
 */
export async function deployBondingCurveViaWallet(
  params: { name: string; ticker: string; description: string; imageUri: string },
  wallet: ConnectedAPI,
  onPhase?: (phase: 'proving' | 'signing' | 'submitting') => void,
): Promise<{ contractAddress: string; txId: string }> {
  // Step 1: Check Lace's configured indexer is reachable.
  let walletConfig: Awaited<ReturnType<typeof wallet.getConfiguration>>;
  try {
    walletConfig = await withTimeout(wallet.getConfiguration(), 5_000, 'getConfiguration timeout');
    console.log('[deploy] Lace config — network:', walletConfig.networkId, '| indexer:', walletConfig.indexerUri);
  } catch (e) {
    console.warn('[deploy] Could not read Lace configuration:', e);
    walletConfig = null as any;
  }
  if (walletConfig) {
    try {
      await withTimeout(
        fetch(walletConfig.indexerUri, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ __typename }' }),
        }),
        6_000,
        'indexer probe timeout',
      );
      console.log('[deploy] indexer reachable ✓');
    } catch {
      throw new Error(
        `The Midnight ${walletConfig.networkId} indexer is unreachable right now ` +
        `(${walletConfig.indexerUri}). ` +
        `The Preview network may be temporarily down. Please try again in a few minutes.`,
      );
    }
  }

  // Step 2: Get user's ZK public keys so the server builds tx outputs to their address.
  console.log('[deploy] fetching user shielded addresses...');
  const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } = await wallet.getShieldedAddresses();
  console.log('[deploy] userCpk:', shieldedCoinPublicKey.slice(0, 20) + '...');

  // Step 3: Server builds the UNPROVEN deploy tx (fast — just circuit construction, no ZK proving).
  onPhase?.('proving');
  console.log('[deploy] POST /api/deploy/unproven — server building unproven tx...');
  const res = await fetch('/api/deploy/unproven', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      userCoinPublicKey: shieldedCoinPublicKey,
      userEncryptionPublicKey: shieldedEncryptionPublicKey,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch {}
    throw new Error(msg);
  }
  const { unprovenTxHex, contractAddress } = await res.json() as {
    unprovenTxHex: string;
    contractAddress: string;
  };
  console.log('[deploy] got unproven tx, contractAddress:', contractAddress);

  // Step 4: Prove via Lace's own proving provider (~30–60s).
  // This ensures the proof is in a format Lace's balancer can process.
  const deployServerUrl = (process.env.NEXT_PUBLIC_DEPLOY_SERVER_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  console.log('[deploy] proving via Lace getProvingProvider...');
  const provedTxHex = await proveViaLace(wallet, unprovenTxHex, `${deployServerUrl}/zk-config`);
  console.log('[deploy] proved ✓ — calling balanceUnsealedTransaction...');

  // Step 5: Lace adds DUST fee inputs, shows popup, user signs.
  onPhase?.('signing');
  console.log('[deploy] calling balanceUnsealedTransaction — Lace popup should appear...');
  const balanced = await withTimeout(
    wallet.balanceUnsealedTransaction(provedTxHex),
    120_000,
    'Lace wallet did not respond after 120 seconds. ' +
    'This usually means the Midnight network is unreachable or Lace lost its connection to the indexer. ' +
    'Check that Lace is connected to Preview and try again.',
  );
  console.log('[deploy] Lace signed ✓');

  let txId: string;
  try { txId = txIdFromBalancedHex(balanced.tx); } catch { txId = `pending-${Date.now()}`; }

  // Step 6: Fire-and-forget submit — submitTransaction can block waiting for node ACK.
  onPhase?.('submitting');
  wallet.submitTransaction(balanced.tx).catch(e => console.error('[deploy] submit error:', e));

  return { contractAddress, txId };
}

// ── Trade ───────────────────────────────────────────────────────────────────

export interface TradeParams {
  contractAddress: string;
  action: 'buy' | 'sell';
  adaIn?: string;
  tokensOut?: string;
  tokensIn?: string;
  adaOut?: string;
}

/** Timing from deploy server + Next proxy (see deploy-server /trade/build). */
export interface TradeBuildProfile {
  createUnprovenMs: number;
  serverTotalMs: number;
  /** Time for browser → Vercel → deploy server → back (includes all server work). */
  proxyRoundTripMs?: number;
  /** Set on the client after Lace balance + submit. */
  walletMs?: number;
}

export interface TradeResult {
  /** Transaction identifier from deserialized balanced tx (Lace does not return an id from submit). */
  txId: string;
  contractAddress: string;
  action: string;
  /** Present after a successful trade when profiling data was returned. */
  profile?: TradeBuildProfile;
  /** Lace balance + submit only. */
  walletMs?: number;
}

function tradeBuildErrorMessage(status: number, body: string): string {
  const t = body.trim();
  const generic =
    !t ||
    /^service unavailable$/i.test(t) ||
    t.startsWith('<!') ||
    t.startsWith('<html');
  if (generic && (status === 502 || status === 503 || status === 504)) {
    return (
      'Trade backend unavailable (deploy server or proof service). ' +
      'If you host deploy-server: set PROOF_SERVER_URL to Midnight\u2019s hosted proof URL for your network ' +
      '(e.g. https://proof-server.preview.midnight.network for Preview), or run a local proof server. ' +
      'Check Railway/Vercel logs and DEPLOY_SERVER_URL.'
    );
  }
  if (generic) {
    return `Trade build failed (${status}). ${t.slice(0, 200)}`;
  }
  if (!generic && /no public state found at contract address/i.test(t)) {
    return (
      'Contract not found on the indexer. On testnets this usually means the network was reset after your token was deployed \u2014 redeploy your token. ' +
      'If this is a freshly deployed token, wait 30\u201360 s for the indexer to catch up and try again. ' +
      'On mainnet, verify Lace, Vercel, and Railway all use the same network. ' +
      t
    );
  }
  return t || `Trade build failed (${status})`;
}

/**
 * POST /api/trade/unproven → deploy server builds unproven tx (no server-side proving).
 */
export async function buildTradeUnprovenTx(params: TradeParams): Promise<{
  unprovenTxHex: string;
}> {
  const res = await fetch('/api/trade/unproven', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg: string;
    try {
      msg = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {
      msg = text;
    }
    throw new Error(tradeBuildErrorMessage(res.status, msg));
  }

  const body = (await res.json()) as { unprovenTxHex: string };
  if (!body.unprovenTxHex) throw new Error('Trade build returned no unprovenTxHex');
  return { unprovenTxHex: body.unprovenTxHex };
}

/**
 * Prove via Lace, balance fees in Lace, and submit.
 */
export async function finalizeTradeInWallet(
  wallet: ConnectedAPI,
  unprovenTxHex: string,
  _meta: Pick<TradeParams, 'contractAddress' | 'action'>,
): Promise<Pick<TradeResult, 'txId' | 'walletMs'>> {
  const w0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // Prove via Lace's proving provider
  const deployServerUrl = (process.env.NEXT_PUBLIC_DEPLOY_SERVER_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  const provedTxHex = await proveViaLace(wallet, unprovenTxHex, `${deployServerUrl}/zk-config`);

  // Balance + sign via Lace
  const balanced = await wallet.balanceUnsealedTransaction(provedTxHex);
  let txId: string;
  try {
    txId = txIdFromBalancedHex(balanced.tx);
  } catch {
    txId = `pending-${Date.now()}`;
  }
  wallet.submitTransaction(balanced.tx).catch(e => console.error('submitTransaction error:', e));
  const walletMs = Math.round(
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - w0,
  );
  return { txId, walletMs };
}

/**
 * 1) POST /api/trade/unproven → deploy server builds unproven circuit call tx.
 * 2) Browser proves via Lace's getProvingProvider (ZK proof ~30s).
 * 3) Lace balances fees / unshielded inputs and submits — you approve in the wallet.
 */
export async function executeTradeWithWallet(
  params: TradeParams,
  wallet: ConnectedAPI,
): Promise<TradeResult> {
  const { unprovenTxHex } = await buildTradeUnprovenTx(params);
  const { txId, walletMs } = await finalizeTradeInWallet(wallet, unprovenTxHex, params);

  return {
    txId,
    contractAddress: params.contractAddress,
    action: params.action,
    profile: { createUnprovenMs: 0, serverTotalMs: 0, walletMs },
    walletMs,
  };
}
