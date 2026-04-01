'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '@/lib/wallet/WalletProvider';
import { fmtDust } from '@/lib/midnight/bondingCurve';

// ── Data (will be populated from wallet/indexer) ──────────────────────────
type Position = {
  address: string; name: string; ticker: string; emoji: string;
  tokensHeld: bigint; avgBuyPrice: number; currentPrice: number;
  adaReserve: bigint; graduated: boolean;
};
type CreatedToken = {
  address: string; name: string; ticker: string; emoji: string;
  adaReserve: bigint; txCount: number; holderCount: number; graduated: boolean;
};
type Transaction = {
  type: string; name: string; ticker: string;
  dustAmt: bigint; tokenAmt: bigint; ago: string;
};

const positions: Position[] = [];
const createdTokens: CreatedToken[] = [];
const transactions: Transaction[] = [];

function fmtTokens(n: bigint) {
  const m = Number(n) / 1_000_000_000_000;
  if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(2)}M`;
  if (m >= 1_000)     return `${(m / 1_000).toFixed(1)}K`;
  return m.toFixed(2);
}

function pnl(pos: Position) {
  const cost    = Number(pos.tokensHeld) / 1e12 * pos.avgBuyPrice;
  const current = Number(pos.tokensHeld) / 1e12 * pos.currentPrice;
  if (cost === 0) return { pct: 0, dust: 0n };
  return { pct: ((current - cost) / cost) * 100, dust: BigInt(Math.round((current - cost) * 1e6)) };
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { connected, connect, connecting } = useWallet();

  const totals = useMemo(() => {
    const totalValue = positions.reduce((acc, p) => {
      return acc + BigInt(Math.round(Number(p.tokensHeld) / 1e12 * p.currentPrice * 1e6));
    }, 0n);
    const totalCost = positions.reduce((acc, p) => {
      return acc + BigInt(Math.round(Number(p.tokensHeld) / 1e12 * p.avgBuyPrice * 1e6));
    }, 0n);
    const unrealizedPnl = totalValue - totalCost;
    const pctGain = Number(totalCost) > 0 ? (Number(unrealizedPnl) / Number(totalCost)) * 100 : 0;
    return { totalValue, totalCost, unrealizedPnl, pctGain };
  }, []);

  if (!connected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', padding: '0 24px' }}>
        <img src="/logo.png" alt="stfu.fun" style={{ width: 120, height: 120, marginBottom: 26 }} />
        <h2 style={{ fontWeight: 700, fontSize: 31, letterSpacing: '-0.02em', marginBottom: 13, color: 'var(--text-primary)' }}>Connect to see your portfolio</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 18, maxWidth: 494, marginBottom: 36, lineHeight: 1.6 }}>
          Connect your wallet to view your positions, P&L, and transaction history.
        </p>
        <button
          className="btn btn-primary"
          style={{ fontSize: 18, padding: '16px 42px', height: 'var(--btn-h-lg)', borderRadius: 'var(--radius-lg)' }}
          disabled={connecting}
          onClick={() => void connect()}
        >
          {connecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div className="container" style={{ paddingTop: 52, paddingBottom: 104 }}>

        {/* Header */}
        <div style={{ marginBottom: 42 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Portfolio</span>
          </div>
          <h1 style={{ fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 0 }}>Your Holdings</h1>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(286px,1fr))', gap: 18, marginBottom: 47 }}>
          {[
            {
              label: 'Portfolio Value',
              value: `₾${fmtDust(totals.totalValue, 2)}`,
              sub: 'current',
              color: 'var(--primary-color)',
            },
            {
              label: 'Unrealized P&L',
              value: `${totals.pctGain >= 0 ? '+' : ''}${totals.pctGain.toFixed(1)}%`,
              sub: `${totals.unrealizedPnl >= 0n ? '+' : ''}₾${fmtDust(totals.unrealizedPnl < 0n ? -totals.unrealizedPnl : totals.unrealizedPnl, 2)}`,
              color: totals.pctGain >= 0 ? 'var(--primary-color)' : 'var(--danger)',
            },
            {
              label: 'Tokens Held',
              value: positions.length.toString(),
              sub: `${positions.filter(p => p.graduated).length} graduated`,
              color: 'var(--warning)',
            },
            {
              label: 'Tokens Created',
              value: createdTokens.length.toString(),
              sub: 'by you',
              color: '#22d3ee',
            },
          ].map(card => (
            <div key={card.label} className="glass" style={{ padding: '23px 26px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>{card.label}</div>
              <div style={{ fontSize: 31, fontWeight: 700, fontFamily: 'var(--mono)', color: card.color, marginBottom: 5 }}>{card.value}</div>
              <div style={{ fontSize: 16, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)' }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Positions */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontWeight: 700, fontSize: 21, marginBottom: 18, letterSpacing: '-0.02em' }}>Positions</h2>
          {positions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {positions.map(pos => {
                const { pct, dust } = pnl(pos);
                const positive = pct >= 0;
                return (
                  <Link key={pos.address} href={`/token/${pos.address}`} style={{ textDecoration: 'none' }}>
                    <div className="glass token-card" style={{ padding: '21px 23px', display: 'flex', alignItems: 'center', gap: 21, flexWrap: 'wrap', borderColor: pos.graduated ? 'rgba(var(--primary-rgb),.18)' : 'var(--border-color)' }}>
                      <div style={{ width: 57, height: 57, borderRadius: 'var(--radius-md)', background: `linear-gradient(135deg,#${pos.address.slice(2,8)},#${pos.address.slice(8,14)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 29, flexShrink: 0 }}>{pos.emoji}</div>

                      <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 20 }}>{pos.name}</span>
                          {pos.graduated && <span className="badge badge-green">Graduated</span>}
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--primary-color)' }}>${pos.ticker}</div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600 }}>{fmtTokens(pos.tokensHeld)}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text-tertiary)' }}>tokens</div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 104 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600, color: 'var(--primary-color)' }}>
                          {fmtDust(BigInt(Math.round(Number(pos.tokensHeld) / 1e12 * pos.currentPrice * 1e6)), 2)}
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text-tertiary)' }}>value</div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 104 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600, color: positive ? 'var(--primary-color)' : 'var(--danger)' }}>
                          {positive ? '+' : ''}{pct.toFixed(1)}%
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: positive ? 'var(--primary-color)' : 'var(--danger)', opacity: 0.75 }}>
                          {positive ? '+' : '-'}{fmtDust(dust < 0n ? -dust : dust, 2)}
                        </div>
                      </div>

                      <button
                        className="btn btn-primary"
                        style={{ flexShrink: 0, fontSize: 16, padding: '8px 21px', borderRadius: 'var(--radius-pill)' }}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                      >
                        Trade
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="glass" style={{ padding: '42px 23px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--text-tertiary)', marginBottom: 8 }}>No positions yet</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-tertiary)' }}>
                Buy tokens on stfu.fun to see your positions here
              </div>
            </div>
          )}
        </div>

        {/* Created tokens */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontWeight: 700, fontSize: 21, marginBottom: 18, letterSpacing: '-0.02em' }}>Tokens You Created</h2>
          {createdTokens.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {createdTokens.map(tok => (
                <Link key={tok.address} href={`/token/${tok.address}`} style={{ textDecoration: 'none' }}>
                  <div className="glass token-card" style={{ padding: '21px 23px', display: 'flex', alignItems: 'center', gap: 21, flexWrap: 'wrap' }}>
                    <div style={{ width: 57, height: 57, borderRadius: 'var(--radius-md)', background: `linear-gradient(135deg,#${tok.address.slice(2,8)},#${tok.address.slice(8,14)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 29, flexShrink: 0 }}>{tok.emoji}</div>
                    <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 20 }}>{tok.name}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--primary-color)' }}>${tok.ticker}</div>
                    </div>
                    {[
                      { label: 'Holders', value: tok.holderCount.toString() },
                      { label: 'Txns',    value: tok.txCount.toString() },
                      { label: 'Volume',  value: `${fmtDust(tok.adaReserve / 10n, 0)}` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ textAlign: 'right', flexShrink: 0, minWidth: 78 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600 }}>{value}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text-tertiary)' }}>{label}</div>
                      </div>
                    ))}
                    <span style={{ flexShrink: 0, fontSize: 16, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)', padding: '7px 16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>Creator</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="glass" style={{ padding: '42px 23px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--text-tertiary)', marginBottom: 8 }}>No tokens created yet</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-tertiary)' }}>
                Launch a token on stfu.fun and it will appear here
              </div>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 21, marginBottom: 18, letterSpacing: '-0.02em' }}>Recent Transactions</h2>
          {transactions.length > 0 ? (
            <div className="glass" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {transactions.map((tx, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 21, padding: '18px 23px', borderBottom: i < transactions.length - 1 ? '1px solid var(--border-color)' : 'none', flexWrap: 'wrap' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-sm)', background: tx.type === 'buy' ? 'rgba(var(--primary-rgb),.12)' : 'rgba(var(--danger-rgb),.12)', border: `1px solid ${tx.type === 'buy' ? 'rgba(var(--primary-rgb),.25)' : 'rgba(var(--danger-rgb),.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {tx.type === 'buy' ? '+' : '-'}
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <span style={{ fontWeight: 600, fontSize: 18 }}>{tx.type === 'buy' ? 'Bought' : 'Sold'} </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 18, color: 'var(--primary-color)' }}>${tx.ticker}</span>
                    <span style={{ fontWeight: 400, fontSize: 18 }}> · {tx.name}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 17, color: tx.type === 'buy' ? 'var(--primary-color)' : 'var(--danger)', flexShrink: 0 }}>
                    {tx.type === 'buy' ? '+' : '-'}{fmtTokens(tx.tokenAmt)} tokens
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 17, color: 'var(--text-tertiary)', flexShrink: 0, minWidth: 104, textAlign: 'right' }}>
                    {fmtDust(tx.dustAmt, 2)}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--text-tertiary)', flexShrink: 0, minWidth: 73, textAlign: 'right' }}>{tx.ago}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass" style={{ padding: '42px 23px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--text-tertiary)', marginBottom: 8 }}>No transactions yet</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-tertiary)' }}>
                Your trade history will appear here
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
