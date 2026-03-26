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

export interface TradeResult {
  /** Transaction identifier from deserialized balanced tx (Lace does not return an id from submit). */
  txId: string;
  contractAddress: string;
  action: string;
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

  const res = await fetch('/api/trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      coinPublicKeyHex: shielded.shieldedCoinPublicKey,
      shieldedEncryptionPublicKeyHex: shielded.shieldedEncryptionPublicKey,
    }),
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

  const { provenTxHex } = (await res.json()) as { provenTxHex: string };

  const balanced = await wallet.balanceUnsealedTransaction(provenTxHex);
  let txId: string;
  try {
    txId = txIdFromBalancedHex(balanced.tx);
  } catch {
    txId = `pending-${Date.now()}`;
  }
  await wallet.submitTransaction(balanced.tx);

  return {
    txId,
    contractAddress: params.contractAddress,
    action: params.action,
  };
}
