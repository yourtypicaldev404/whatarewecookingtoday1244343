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

/** Check whether the connected wallet exposes getProvingProvider (dapp-connector-api >=4.0). */
function hasProvingProvider(wallet: ConnectedAPI): boolean {
  return typeof (wallet as any).getProvingProvider === 'function';
}

/**
 * Build a KeyMaterialProvider adapter from FetchZkConfigProvider for Lace's getProvingProvider.
 */
function buildKeyMaterialProvider(zkConfigUrl: string): KeyMaterialProvider {
  const zkConfig = new FetchZkConfigProvider(zkConfigUrl);
  return {
    async getZKIR(circuitKeyLocation: string): Promise<Uint8Array> {
      const zkir = await zkConfig.getZKIR(circuitKeyLocation);
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
 */
async function proveViaLace(
  wallet: ConnectedAPI,
  unprovenTxHex: string,
  zkConfigUrl: string,
): Promise<string> {
  const raw = hexToBytes(unprovenTxHex);
  const unprovenTx = ledger.Transaction.deserialize('signature', 'pre-proof', 'pre-binding', raw);

  const keyMaterial = buildKeyMaterialProvider(zkConfigUrl);
  const provingProvider: ProvingProvider = await (wallet as any).getProvingProvider(keyMaterial);

  const costModel = ledger.CostModel.initialCostModel();
  console.log('[prove] Proving tx via Lace getProvingProvider...');
  const provedTx = await unprovenTx.prove(provingProvider, costModel);

  return bytesToHex(provedTx.serialize());
}

/**
 * Get a proved tx hex — tries Lace's getProvingProvider first (format-compatible),
 * falls back to server-side proving via /api/deploy if Lace doesn't support it.
 */
async function getProvedDeployTx(
  wallet: ConnectedAPI,
  params: { name: string; ticker: string; description: string; imageUri: string },
  shieldedCoinPublicKey: string,
  shieldedEncryptionPublicKey: string,
): Promise<{ provedTxHex: string; contractAddress: string }> {
  const deployServerUrl = (process.env.NEXT_PUBLIC_DEPLOY_SERVER_URL ?? 'http://localhost:3001').replace(/\/$/, '');

  if (hasProvingProvider(wallet)) {
    // Path A: Client-side proving via Lace — format-compatible with balanceUnsealedTransaction.
    console.log('[deploy] Lace has getProvingProvider — using client-side proving');
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

    const provedTxHex = await proveViaLace(wallet, unprovenTxHex, `${deployServerUrl}/zk-config`);
    console.log('[deploy] proved via Lace ✓');
    return { provedTxHex, contractAddress };
  }

  // Path B: Server-side proving — fallback when Lace doesn't have getProvingProvider.
  console.log('[deploy] Lace lacks getProvingProvider — falling back to server-side proving');
  const res = await fetch('/api/deploy', {
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
  const { provedTxHex, contractAddress } = await res.json() as {
    provedTxHex: string;
    contractAddress: string;
  };
  console.log('[deploy] server proved tx, contractAddress:', contractAddress);
  return { provedTxHex, contractAddress };
}

/**
 * Get a proved trade tx hex — tries Lace proving first, falls back to server-side.
 */
async function getProvedTradeTx(
  wallet: ConnectedAPI,
  params: TradeParams,
): Promise<string> {
  const deployServerUrl = (process.env.NEXT_PUBLIC_DEPLOY_SERVER_URL ?? 'http://localhost:3001').replace(/\/$/, '');

  if (hasProvingProvider(wallet)) {
    console.log('[trade] Lace has getProvingProvider — using client-side proving');
    const res = await fetch('/api/trade/unproven', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const text = await res.text();
      let msg: string;
      try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch { msg = text; }
      throw new Error(tradeBuildErrorMessage(res.status, msg));
    }
    const { unprovenTxHex } = await res.json() as { unprovenTxHex: string };
    if (!unprovenTxHex) throw new Error('Trade build returned no unprovenTxHex');

    return proveViaLace(wallet, unprovenTxHex, `${deployServerUrl}/zk-config`);
  }

  // Fallback: server-side proving
  console.log('[trade] Lace lacks getProvingProvider — falling back to server-side proving');
  const res = await fetch('/api/trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg: string;
    try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch { msg = text; }
    throw new Error(tradeBuildErrorMessage(res.status, msg));
  }
  const body = (await res.json()) as { unprovenTxHex: string };
  if (!body.unprovenTxHex) throw new Error('Trade build returned no unprovenTxHex');
  return body.unprovenTxHex;
}

// ── Deploy ──────────────────────────────────────────────────────────────────

/**
 * Deploy a bonding curve token.
 *
 * Server builds + proves the tx (fast, no wallet sync needed).
 * User's wallet balances (pays fees) and submits to chain.
 */
export async function deployBondingCurveViaWallet(
  params: { name: string; ticker: string; description: string; imageUri: string },
  wallet: ConnectedAPI,
  onPhase?: (phase: 'proving' | 'signing' | 'submitting') => void,
): Promise<{ contractAddress: string; txId: string }> {
  // Get user's shielded keys so the tx is built for their wallet
  let coinPubKey = '';
  let encPubKey = '';
  try {
    const shielded = await withTimeout(wallet.getShieldedAddresses(), 10_000, 'getShieldedAddresses timeout');
    const addr = Array.isArray(shielded) ? shielded[0] : shielded;
    coinPubKey = (addr as any)?.shieldedCoinPublicKey ?? '';
    encPubKey = (addr as any)?.shieldedEncryptionPublicKey ?? '';
    console.log('[deploy] got user shielded keys — cpk:', coinPubKey.slice(0, 20) + '...', 'epk:', encPubKey.slice(0, 20) + '...');
  } catch (e) {
    console.warn('[deploy] Could not get shielded keys, using server fallback:', e);
  }

  // Server builds + proves tx using httpClientProofProvider (official SDK pattern)
  onPhase?.('proving');
  console.log('[deploy] POST /api/deploy/proved — server building + proving...');
  const proveRes = await fetch('/api/deploy/proved', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      userCoinPublicKey: coinPubKey,
      userEncryptionPublicKey: encPubKey,
    }),
  });
  if (!proveRes.ok) {
    const text = await proveRes.text();
    let msg = text;
    try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch {}
    throw new Error(msg);
  }
  const { provedTxHex, contractAddress } = await proveRes.json() as {
    provedTxHex: string;
    contractAddress: string;
  };
  console.log('[deploy] proved on server, contractAddress:', contractAddress);

  // User's wallet balances (pays fees) and submits
  onPhase?.('signing');
  console.log('[deploy] balanceUnsealedTransaction via user wallet...');
  const balanced = await withTimeout(
    wallet.balanceUnsealedTransaction(provedTxHex),
    120_000,
    'Wallet did not respond. If using Lace, try 1AM wallet instead.',
  );
  const balancedHex = typeof balanced === 'string' ? balanced : (balanced as any).tx ?? '';
  console.log('[deploy] balanced tx length:', balancedHex.length);

  onPhase?.('submitting');

  // Try direct submit first, then try with re-serialization
  let txId = '';
  try {
    console.log('[deploy] submitTransaction (direct)...');
    await wallet.submitTransaction(balancedHex);
    txId = txIdFromBalancedHex(balancedHex);
  } catch (e1: any) {
    console.warn('[deploy] direct submit failed:', e1?.message, '— trying re-serialized...');
    try {
      const balancedTx = ledger.Transaction.deserialize('signature', 'proof', 'binding', hexToBytes(balancedHex));
      const reserializedHex = bytesToHex(balancedTx.serialize());
      await wallet.submitTransaction(reserializedHex);
      const txIds = balancedTx.identifiers();
      txId = txIds[0] ?? balancedTx.transactionHash();
    } catch (e2: any) {
      // Both failed — try balanceSealedTransaction as last resort
      console.warn('[deploy] re-serialized submit failed:', e2?.message, '— trying balanceSealedTransaction...');
      try {
        const sealedBalanced = await (wallet as any).balanceSealedTransaction(provedTxHex);
        const sealedHex = typeof sealedBalanced === 'string' ? sealedBalanced : (sealedBalanced as any).tx ?? '';
        await wallet.submitTransaction(sealedHex);
        txId = txIdFromBalancedHex(sealedHex);
      } catch (e3: any) {
        const msg = e3?.message ?? String(e3);
        console.error('[deploy] all submit attempts failed:', msg);
        throw new Error(`Transaction rejected: ${msg}`);
      }
    }
  }
  console.log('[deploy] deployed! contractAddress:', contractAddress, '| txId:', txId);
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

export interface TradeBuildProfile {
  createUnprovenMs: number;
  serverTotalMs: number;
  proxyRoundTripMs?: number;
  walletMs?: number;
}

export interface TradeResult {
  txId: string;
  contractAddress: string;
  action: string;
  profile?: TradeBuildProfile;
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
      'If you host deploy-server: set PROOF_SERVER_URL to your proof server ' +
      '(e.g. http://127.0.0.1:6300 for local Docker, or a hosted instance). ' +
      'Check Railway/Vercel logs and DEPLOY_SERVER_URL.'
    );
  }
  if (generic) {
    return `Trade build failed (${status}). ${t.slice(0, 200)}`;
  }
  if (!generic && /no public state found at contract address/i.test(t)) {
    return (
      'Contract not found on the indexer. Verify your wallet, Vercel, and Railway all use the same network. ' +
      'If this is a freshly deployed token, wait 30\u201360 s for the indexer to catch up and try again. ' +
      'On testnets this can also mean the network was reset after deployment. ' +
      t
    );
  }
  return t || `Trade build failed (${status})`;
}

/**
 * Build + prove a trade tx (auto-detects Lace vs server proving).
 * Returns the proved hex ready for finalizeTradeInWallet.
 */
export async function buildProvedTradeTx(
  params: TradeParams,
  wallet: ConnectedAPI,
): Promise<{ provedTxHex: string }> {
  const provedTxHex = await getProvedTradeTx(wallet, params);
  return { provedTxHex };
}

/**
 * Balance fees in Lace and submit an already-proved tx.
 */
export async function finalizeTradeInWallet(
  wallet: ConnectedAPI,
  provedTxHex: string,
  _meta: Pick<TradeParams, 'contractAddress' | 'action'>,
): Promise<Pick<TradeResult, 'txId' | 'walletMs'>> {
  const w0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const balanceResult = await wallet.balanceUnsealedTransaction(provedTxHex);
  // Handle different wallet response shapes (Lace returns {tx}, 1AM may return string)
  const signedTx = typeof balanceResult === 'string'
    ? balanceResult
    : (balanceResult as any)?.tx ?? (balanceResult as any)?.transaction ?? balanceResult;
  let txId: string;
  try {
    txId = txIdFromBalancedHex(typeof signedTx === 'string' ? signedTx : '');
  } catch {
    txId = `pending-${Date.now()}`;
  }
  wallet.submitTransaction(signedTx).catch(e => console.error('submitTransaction error:', e));
  const walletMs = Math.round(
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - w0,
  );
  return { txId, walletMs };
}

/**
 * Build + prove a trade tx, then balance + submit via Lace.
 * Auto-detects whether to prove client-side (Lace) or server-side.
 */
export async function executeTradeWithWallet(
  params: TradeParams,
  wallet: ConnectedAPI,
): Promise<TradeResult> {
  const provedTxHex = await getProvedTradeTx(wallet, params);
  const { txId, walletMs } = await finalizeTradeInWallet(wallet, provedTxHex, params);

  return {
    txId,
    contractAddress: params.contractAddress,
    action: params.action,
    profile: { createUnprovenMs: 0, serverTotalMs: 0, walletMs },
    walletMs,
  };
}
