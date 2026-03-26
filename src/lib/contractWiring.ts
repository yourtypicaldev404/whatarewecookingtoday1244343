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

export async function deployBondingCurveViaWallet(params: {
  name: string;
  ticker: string;
  description: string;
  imageUri: string;
}) {
  const res = await fetch('/api/deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
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
  publicStatesMs: number;
  proveMs: number;
  serializeMs: number;
  serverTotalMs: number;
  proofServerHost: string;
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

/**
 * POST /api/trade → deploy server: unproven tx + ZK prove. Does not touch the wallet yet.
 */
export async function buildTradeProvenTx(params: TradeParams & { coinPublicKeyHex: string; shieldedEncryptionPublicKeyHex: string }): Promise<{
  provenTxHex: string;
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
    throw new Error(msg || `Trade build failed (${res.status})`);
  }

  const body = (await res.json()) as {
    provenTxHex: string;
    profile?: TradeBuildProfile;
  };
  if (!body.provenTxHex) throw new Error('Trade build returned no provenTxHex');
  return {
    provenTxHex: body.provenTxHex,
    profile: body.profile ?? {
      createUnprovenMs: 0,
      publicStatesMs: 0,
      proveMs: 0,
      serializeMs: 0,
      serverTotalMs: 0,
      proofServerHost: '',
    },
  };
}

/**
 * Balance fees in Lace and submit the proven transaction hex from {@link buildTradeProvenTx}.
 */
export async function finalizeTradeInWallet(
  wallet: ConnectedAPI,
  provenTxHex: string,
  meta: Pick<TradeParams, 'contractAddress' | 'action'>,
): Promise<Pick<TradeResult, 'txId' | 'walletMs'>> {
  const w0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const balanced = await wallet.balanceUnsealedTransaction(provenTxHex);
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
 * 1) POST /api/trade → deploy server builds circuit call + proves (ZK) using your shielded keys.
 * 2) Lace balances fees / unshielded inputs and submits — you approve in the wallet.
 */
export async function executeTradeWithWallet(
  params: TradeParams,
  wallet: ConnectedAPI,
): Promise<TradeResult> {
  const shielded = await wallet.getShieldedAddresses();

  const { provenTxHex, profile } = await buildTradeProvenTx({
    ...params,
    coinPublicKeyHex: shielded.shieldedCoinPublicKey,
    shieldedEncryptionPublicKeyHex: shielded.shieldedEncryptionPublicKey,
  });

  const { txId, walletMs } = await finalizeTradeInWallet(wallet, provenTxHex, params);

  return {
    txId,
    contractAddress: params.contractAddress,
    action: params.action,
    profile: { ...profile, walletMs },
    walletMs,
  };
}
