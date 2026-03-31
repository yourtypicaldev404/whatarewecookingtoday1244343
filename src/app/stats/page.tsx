'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

function fmtNight(raw: string | bigint, dec = 2): string {
  const n = BigInt(raw || '0');
  const whole = n / 1_000_000n;
  if (dec === 0) return whole.toLocaleString();
  const frac = (n % 1_000_000n).toString().padStart(6, '0').slice(0, dec);
  return `${whole.toLocaleString()}.${frac}`;
}

type Stats = {
  overview: {
    totalTokens: number;
    graduated: number;
    active24h: number;
    totalVolume: string;
    totalTxns: number;
    totalHolders: number;
    totalLiquidity: string;
  };
  topByVolume: any[];
  topByTxns: any[];
  topByLiquidity: any[];
  launchHistory: { date: string; count: number }[];
};

const OVERVIEW_CARDS = (o: Stats['overview']) => [
  {
    label: 'Total Value Locked',
    value: `${fmtNight(o.totalLiquidity)} NIGHT`,
    sub: `Avg per token: ${o.totalTokens > 0 ? fmtNight((BigInt(o.totalLiquidity) / BigInt(Math.max(o.totalTokens, 1))).toString()) : '0'} NIGHT`,
    color: '#0070f3',
  },
  {
    label: 'Volume (All Time)',
    value: `${fmtNight(o.totalVolume)} NIGHT`,
    sub: `Total trades: ${o.totalTxns.toLocaleString()}`,
    color: 'var(--text-primary)',
  },
  {
    label: 'Total Trades',
    value: o.totalTxns.toLocaleString(),
    sub: `Avg trade size: ${o.totalTxns > 0 ? fmtNight((BigInt(o.totalVolume) / BigInt(Math.max(o.totalTxns, 1))).toString()) : '0'} NIGHT`,
    color: 'var(--text-primary)',
  },
  {
    label: 'Tokens Listed',
    value: o.totalTokens.toLocaleString(),
    sub: `Graduated: ${o.graduated} | Active: ${o.totalTokens - o.graduated}`,
    color: '#0070f3',
  },
  {
    label: 'Total Holders',
    value: o.totalHolders.toLocaleString(),
    sub: 'Across all tokens',
    color: 'var(--text-primary)',
  },
  {
    label: 'Active (24h)',
    value: o.active24h.toLocaleString(),
    sub: 'Tokens with activity today',
    color: 'var(--text-primary)',
  },
  {
    label: 'Avg. Bonded %',
    value: o.totalTokens > 0
      ? `${(Number(BigInt(o.totalLiquidity) * 100n / (BigInt(Math.max(o.totalTokens, 1)) * 69_000_000_000n))).toFixed(2)}%`
      : '0%',
    sub: 'Avg reserve / graduation target',
    color: '#0070f3',
  },
  {
    label: 'Graduated Tokens',
    value: o.graduated.toLocaleString(),
    sub: `${o.totalTokens > 0 ? ((o.graduated / o.totalTokens) * 100).toFixed(1) : 0}% graduation rate`,
    color: 'var(--text-primary)',
  },
];

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<'volume' | 'txns' | 'liquidity'>('volume');

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  if (!stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontFamily: 'var(--mono)', fontSize: 17, color: 'var(--text-tertiary)' }}>
        Loading stats...
      </div>
    );
  }

  const topList = tab === 'volume' ? stats.topByVolume : tab === 'txns' ? stats.topByTxns : stats.topByLiquidity;
  const maxBar = Math.max(1, ...stats.launchHistory.map(d => d.count));

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '42px 31px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Platform</div>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em' }}>
            Stats
          </h1>
        </div>

        {/* Overview grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 14, marginBottom: 48 }}>
          {OVERVIEW_CARDS(stats.overview).map(card => (
            <div key={card.label} className="glass" style={{ padding: '20px 22px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>{card.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--mono)', color: card.color, marginBottom: 5 }}>{card.value}</div>
              <div style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)' }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Launch history chart */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 18 }}>Tokens Launched (30d)</h2>
          <div className="glass" style={{ padding: '20px 22px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
              {stats.launchHistory.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%',
                    height: `${Math.max(2, (d.count / maxBar) * 100)}px`,
                    background: d.count > 0 ? '#0070f3' : 'var(--bg-4)',
                    borderRadius: 2,
                    transition: 'height 0.3s ease',
                  }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>{stats.launchHistory[0]?.date}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>{stats.launchHistory[stats.launchHistory.length - 1]?.date}</span>
            </div>
          </div>
        </div>

        {/* Top tokens */}
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 18 }}>Top Tokens</h2>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {([['volume', 'By Volume'], ['txns', 'By Trades'], ['liquidity', 'By Liquidity']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`filter-btn${tab === id ? ' active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="glass" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Token</th>
                  <th style={{ textAlign: 'right' }}>Volume</th>
                  <th style={{ textAlign: 'right' }}>Trades</th>
                  <th style={{ textAlign: 'right' }}>Liquidity</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {topList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>No tokens yet</td>
                  </tr>
                ) : topList.map((t: any, i: number) => (
                  <tr key={t.address}>
                    <td style={{ color: 'var(--text-tertiary)' }}>{i + 1}</td>
                    <td>
                      <Link href={`/token/${t.address}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>{t.name}</span>
                        <span style={{ color: '#0070f3', fontSize: 12 }}>${t.ticker}</span>
                      </Link>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtNight(t.volume, 0)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{t.txCount.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtNight(t.adaReserve, 0)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {t.graduated
                        ? <span className="badge badge-green">Graduated</span>
                        : <span className="badge badge-white">Active</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
