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

export async function deployBondingCurveViaWallet(
  params: { name: string; ticker: string; description: string; imageUri: string },
  wallet: ConnectedAPI,
): Promise<{ contractAddress: string; txId: string }> {
  // Step 1: warm-start the deploy server (Railway sleeps on free tier)
  fetch('/api/health').catch(() => {});

  // Step 2: server builds the unproven deploy tx (no proving, fast)
  const res = await fetch('/api/deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
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

  // Step 2: Lace proves + balances (pops up for user to approve)
  const balanced = await wallet.balanceUnsealedTransaction(unprovenTxHex);

  // Step 3: derive tx id and submit
  let txId: string;
  try {
    txId = txIdFromBalancedHex(balanced.tx);
  } catch {
    txId = `pending-${Date.now()}`;
  }
  await wallet.submitTransaction(balanced.tx);

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
  await wallet.submitTransaction(balanced.tx);
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
