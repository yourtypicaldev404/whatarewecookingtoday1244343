'use client';

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
  // buy: provide adaIn + tokensOut
  adaIn?: string;
  tokensOut?: string;
  // sell: provide tokensIn + adaOut
  tokensIn?: string;
  adaOut?: string;
}

export interface TradeResult {
  txId: string;
  contractAddress: string;
  action: string;
}

export async function executeTrade(params: TradeParams): Promise<TradeResult> {
  /** Same-origin API proxies to DEPLOY_SERVER_URL (see /api/trade). */
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
    throw new Error(msg || `Trade failed (${res.status})`);
  }
  return res.json() as Promise<TradeResult>;
}
