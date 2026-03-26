'use client';

import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

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
  /** Best-effort id for UI; confirm in Lace activity. */
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
  await wallet.submitTransaction(balanced.tx);

  return {
    txId: `submitted-${Date.now()}`,
    contractAddress: params.contractAddress,
    action: params.action,
  };
}
