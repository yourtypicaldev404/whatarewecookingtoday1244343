'use client';

import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import * as ledger from '@midnight-ntwrk/ledger-v8';

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
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
 * Deploy a bonding curve token with user signing via Lace.
 *
 * 1. Get user's ZK public keys from Lace
 * 2. Server builds + ZK-proves the deploy tx (~30–60s)
 * 3. Lace pops up → user approves → wallet adds fee inputs → returns balanced tx
 * 4. Fire-and-forget submit (submitTransaction can be slow to ACK)
 */
export async function deployBondingCurveViaWallet(
  params: { name: string; ticker: string; description: string; imageUri: string },
  wallet: ConnectedAPI,
  onPhase?: (phase: 'proving' | 'signing' | 'submitting') => void,
): Promise<{ contractAddress: string; txId: string }> {
  // Get user's ZK public keys so the server builds tx outputs to their address.
  // Lace needs to recognise the outputs as its own in order to balance the tx.
  console.log('[deploy] fetching user shielded addresses...');
  const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } = await wallet.getShieldedAddresses();
  console.log('[deploy] userCpk:', shieldedCoinPublicKey.slice(0, 20) + '...');

  onPhase?.('proving');
  console.log('[deploy] POST /api/deploy — server proving (~30–60s)...');
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

  onPhase?.('signing');
  console.log('[deploy] calling balanceUnsealedTransaction — Lace popup should appear...');
  const balanced = await withTimeout(
    wallet.balanceUnsealedTransaction(provedTxHex),
    120_000,
    'Lace wallet timed out waiting for approval (120s). ' +
    'The Midnight Preview network may be temporarily unavailable — try again in a few minutes.',
  );
  console.log('[deploy] Lace signed, deriving txId...');

  let txId: string;
  try { txId = txIdFromBalancedHex(balanced.tx); } catch { txId = `pending-${Date.now()}`; }

  onPhase?.('submitting');
  console.log('[deploy] submitting (fire-and-forget), txId:', txId);
  wallet.submitTransaction(balanced.tx).catch(e => console.error('[deploy] submit error:', e));

  return { contractAddress, txId };
}

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
      'If you host deploy-server: set PROOF_SERVER_URL to Midnight’s hosted proof URL for your network ' +
      '(e.g. https://proof-server.preview.midnight.network for Preview), or run a local proof server. ' +
      'Check Railway/Vercel logs and DEPLOY_SERVER_URL.'
    );
  }
  if (generic) {
    return `Trade build failed (${status}). ${t.slice(0, 200)}`;
  }
  if (!generic && /no public state found at contract address/i.test(t)) {
    return (
      'Contract not found on the indexer. On testnets this usually means the network was reset after your token was deployed — redeploy your token. ' +
      'If this is a freshly deployed token, wait 30–60 s for the indexer to catch up and try again. ' +
      'On mainnet, verify Lace, Vercel, and Railway all use the same network. ' +
      t
    );
  }
  return t || `Trade build failed (${status})`;
}

/**
 * POST /api/trade → deploy server: builds unproven tx. Does not touch the wallet yet.
 */
export async function buildTradeProvenTx(params: TradeParams): Promise<{
  unprovenTxHex: string;
  profile: TradeBuildProfile;
}> {
  const res = await fetch('/api/trade', {
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

  const body = (await res.json()) as {
    unprovenTxHex: string;
    profile?: TradeBuildProfile;
  };
  if (!body.unprovenTxHex) throw new Error('Trade build returned no unprovenTxHex');
  return {
    unprovenTxHex: body.unprovenTxHex,
    profile: body.profile ?? {
      createUnprovenMs: 0,
      serverTotalMs: 0,
    },
  };
}

/**
 * Prove, balance fees in Lace, and submit the unproven transaction hex from {@link buildTradeProvenTx}.
 */
export async function finalizeTradeInWallet(
  wallet: ConnectedAPI,
  unprovenTxHex: string,
  meta: Pick<TradeParams, 'contractAddress' | 'action'>,
): Promise<Pick<TradeResult, 'txId' | 'walletMs'>> {
  const w0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const balanced = await wallet.balanceUnsealedTransaction(unprovenTxHex);
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
 * 1) POST /api/trade → deploy server builds unproven circuit call tx.
 * 2) Lace proves (ZK) + balances fees / unshielded inputs and submits — you approve in the wallet.
 */
export async function executeTradeWithWallet(
  params: TradeParams,
  wallet: ConnectedAPI,
): Promise<TradeResult> {
  const { unprovenTxHex, profile } = await buildTradeProvenTx(params);

  const { txId, walletMs } = await finalizeTradeInWallet(wallet, unprovenTxHex, params);

  return {
    txId,
    contractAddress: params.contractAddress,
    action: params.action,
    profile: { ...profile, walletMs },
    walletMs,
  };
}
