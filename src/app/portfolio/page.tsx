'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '@/lib/wallet/WalletProvider';
import { fmtDust } from '@/lib/midnight/bondingCurve';

// ── Mock data ──────────────────────────────────────────────────────────────
const MOCK_POSITIONS = [
  {
    address: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    name: 'MidnightPepe',
    ticker: 'MPEPE',
    emoji: '🐸',
    tokensHeld: 4_200_000_000_000n,
    avgBuyPrice: 0.00000042,
    currentPrice: 0.00000089,
    adaReserve: 18_400_000_000n,
    graduated: false,
  },
  {
    address: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
    name: 'ZK Doge',
    ticker: 'ZKDOGE',
    emoji: '🐕',
    tokensHeld: 12_000_000_000_000n,
    avgBuyPrice: 0.00000012,
    currentPrice: 0.00000031,
    adaReserve: 9_200_000_000n,
    graduated: false,
  },
  {
    address: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    name: 'Night Inu',
    ticker: 'NINU',
    emoji: '🌙',
    tokensHeld: 800_000_000_000n,
    avgBuyPrice: 0.00000150,
    currentPrice: 0.00000098,
    adaReserve: 3_100_000_000n,
    graduated: false,
  },
  {
    address: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
    name: 'Darkpool Cat',
    ticker: 'DPCAT',
    emoji: '🐱',
    tokensHeld: 22_000_000_000_000n,
    avgBuyPrice: 0.00000004,
    currentPrice: 0.00000067,
    adaReserve: 51_000_000_000n,
    graduated: true,
  },
];

const MOCK_CREATED = [
  {
    address: 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
    name: 'ShadowMoon',
    ticker: 'SHMN',
    emoji: '🌑',
    adaReserve: 7_800_000_000n,
    txCount: 34,
    holderCount: 12,
    graduated: false,
  },
];

const MOCK_TXS = [
  { type: 'buy',  name: 'MidnightPepe', ticker: 'MPEPE', dustAmt: 50_000_000n,   tokenAmt: 2_100_000_000_000n, ago: '2h ago' },
  { type: 'buy',  name: 'ZK Doge',      ticker: 'ZKDOGE', dustAmt: 100_000_000n, tokenAmt: 8_333_333_333_333n, ago: '5h ago' },
  { type: 'sell', name: 'Night Inu',    ticker: 'NINU',   dustAmt: 12_000_000n,  tokenAmt: 200_000_000_000n,   ago: '1d ago' },
  { type: 'buy',  name: 'Darkpool Cat', ticker: 'DPCAT',  dustAmt: 80_000_000n,  tokenAmt: 20_000_000_000_000n, ago: '3d ago' },
  { type: 'buy',  name: 'Night Inu',    ticker: 'NINU',   dustAmt: 150_000_000n, tokenAmt: 1_000_000_000_000n,  ago: '4d ago' },
];

function fmtTokens(n: bigint) {
  const m = Number(n) / 1_000_000_000_000;
  if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(2)}M`;
  if (m >= 1_000)     return `${(m / 1_000).toFixed(1)}K`;
  return m.toFixed(2);
}

function pnl(pos: typeof MOCK_POSITIONS[0]) {
  const cost    = Number(pos.tokensHeld) / 1e12 * pos.avgBuyPrice;
  const current = Number(pos.tokensHeld) / 1e12 * pos.currentPrice;
  return { pct: ((current - cost) / cost) * 100, dust: BigInt(Math.round((current - cost) * 1e6)) };
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { connected, connect, connecting } = useWallet();

  const totals = useMemo(() => {
    const totalValue = MOCK_POSITIONS.reduce((acc, p) => {
      return acc + BigInt(Math.round(Number(p.tokensHeld) / 1e12 * p.currentPrice * 1e6));
    }, 0n);
    const totalCost = MOCK_POSITIONS.reduce((acc, p) => {
      return acc + BigInt(Math.round(Number(p.tokensHeld) / 1e12 * p.avgBuyPrice * 1e6));
    }, 0n);
    const unrealizedPnl = totalValue - totalCost;
    const pctGain = Number(totalCost) > 0 ? (Number(unrealizedPnl) / Number(totalCost)) * 100 : 0;
    return { totalValue, totalCost, unrealizedPnl, pctGain };
  }, []);

  if (!connected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '0 24px' }}>
        <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 20 }}>🌙</div>
        <h2 style={{ fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em', marginBottom: 10, color: 'var(--text-primary)' }}>Connect to see your portfolio</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 380, marginBottom: 28, lineHeight: 1.6 }}>
          Link your Lace wallet to view your positions, P&L, and transaction history.
        </p>
        <button
          className="btn btn-primary"
          style={{ fontSize: 14, padding: '12px 32px', height: 'var(--btn-h-lg)', borderRadius: 'var(--radius-lg)' }}
          disabled={connecting}
          onClick={() => void connect()}
        >
          {connecting ? 'Connecting...' : 'Connect Lace'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Portfolio</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--primary-color)', background: 'rgba(var(--primary-rgb),.12)', border: '1px solid rgba(var(--primary-rgb),.25)', borderRadius: 'var(--radius-sm)', padding: '2px 8px' }}>mock data</span>
          </div>
          <h1 style={{ fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 0 }}>Your Holdings</h1>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14, marginBottom: 36 }}>
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
              value: MOCK_POSITIONS.length.toString(),
              sub: `${MOCK_POSITIONS.filter(p => p.graduated).length} graduated`,
              color: 'var(--warning)',
            },
            {
              label: 'Tokens Created',
              value: MOCK_CREATED.length.toString(),
              sub: 'by you',
              color: '#22d3ee',
            },
          ].map(card => (
            <div key={card.label} className="glass" style={{ padding: '18px 20px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>{card.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)', color: card.color, marginBottom: 4 }}>{card.value}</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)' }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Positions */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, letterSpacing: '-0.02em' }}>Positions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MOCK_POSITIONS.map(pos => {
              const { pct, dust } = pnl(pos);
              const positive = pct >= 0;
              return (
                <Link key={pos.address} href={`/token/${pos.address}`} style={{ textDecoration: 'none' }}>
                  <div className="glass token-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderColor: pos.graduated ? 'rgba(var(--primary-rgb),.18)' : 'var(--border-color)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `linear-gradient(135deg,#${pos.address.slice(2,8)},#${pos.address.slice(8,14)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{pos.emoji}</div>

                    <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{pos.name}</span>
                        {pos.graduated && <span className="badge badge-green">Graduated</span>}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--primary-color)' }}>${pos.ticker}</div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600 }}>{fmtTokens(pos.tokensHeld)}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>tokens</div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: 'var(--primary-color)' }}>
                        ₾{fmtDust(BigInt(Math.round(Number(pos.tokensHeld) / 1e12 * pos.currentPrice * 1e6)), 2)}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>value</div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: positive ? 'var(--primary-color)' : 'var(--danger)' }}>
                        {positive ? '+' : ''}{pct.toFixed(1)}%
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: positive ? 'var(--primary-color)' : 'var(--danger)', opacity: 0.75 }}>
                        {positive ? '+' : '-'}₾{fmtDust(dust < 0n ? -dust : dust, 2)}
                      </div>
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ flexShrink: 0, fontSize: 12, padding: '6px 16px', borderRadius: 'var(--radius-pill)' }}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                    >
                      Trade
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Created tokens */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, letterSpacing: '-0.02em' }}>Tokens You Created</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MOCK_CREATED.map(tok => (
              <Link key={tok.address} href={`/token/${tok.address}`} style={{ textDecoration: 'none' }}>
                <div className="glass token-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `linear-gradient(135deg,#${tok.address.slice(2,8)},#${tok.address.slice(8,14)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{tok.emoji}</div>
                  <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{tok.name}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--primary-color)' }}>${tok.ticker}</div>
                  </div>
                  {[
                    { label: 'Holders', value: tok.holderCount.toString() },
                    { label: 'Txns',    value: tok.txCount.toString() },
                    { label: 'Volume',  value: `₾${fmtDust(tok.adaReserve / 10n, 0)}` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ textAlign: 'right', flexShrink: 0, minWidth: 60 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600 }}>{value}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</div>
                    </div>
                  ))}
                  <span style={{ flexShrink: 0, fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)', padding: '5px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>Creator</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent transactions */}
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, letterSpacing: '-0.02em' }}>Recent Transactions</h2>
          <div className="glass" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {MOCK_TXS.map((tx, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', borderBottom: i < MOCK_TXS.length - 1 ? '1px solid var(--border-color)' : 'none', flexWrap: 'wrap' }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: tx.type === 'buy' ? 'rgba(var(--primary-rgb),.12)' : 'rgba(var(--danger-rgb),.12)', border: `1px solid ${tx.type === 'buy' ? 'rgba(var(--primary-rgb),.25)' : 'rgba(var(--danger-rgb),.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {tx.type === 'buy' ? '↑' : '↓'}
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{tx.type === 'buy' ? 'Bought' : 'Sold'} </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--primary-color)' }}>${tx.ticker}</span>
                  <span style={{ fontWeight: 400, fontSize: 14 }}> · {tx.name}</span>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: tx.type === 'buy' ? 'var(--primary-color)' : 'var(--danger)', flexShrink: 0 }}>
                  {tx.type === 'buy' ? '+' : '-'}{fmtTokens(tx.tokenAmt)} tokens
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-tertiary)', flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
                  ₾{fmtDust(tx.dustAmt, 2)}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0, minWidth: 56, textAlign: 'right' }}>{tx.ago}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
