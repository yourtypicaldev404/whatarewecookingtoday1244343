'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import TokenCard from '@/components/TokenCard';
import type { TokenRecord } from '@/app/api/tokens/route';
import {
  fmtDust, fmtMcap, bondingProgress, spotPrice, kothScore,
} from '@/lib/midnight/bondingCurve';

type SortMode = 'bump' | 'new' | 'mcap' | 'graduated';

export default function HomePage() {
  const [tokens, setTokens]     = useState<TokenRecord[]>([]);
  const [koth, setKoth]         = useState<TokenRecord | null>(null);
  const [loading, setLoading]   = useState(true);
  const [sort, setSort]         = useState<SortMode>('bump');
  const [search, setSearch]     = useState('');

  // Fetch token registry
  useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch(`/api/tokens?sort=${sort}&limit=50`);
        const data = await res.json() as { tokens: TokenRecord[]; kothAddress: string };
        setTokens(data.tokens);
        const k = data.tokens.find(t => t.address === data.kothAddress);
        setKoth(k ?? null);
      } finally {
        setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 15_000);   // refresh every 15s
    return () => clearInterval(id);
  }, [sort]);

  const filtered = useMemo(() => {
    if (!search.trim()) return tokens;
    const q = search.toLowerCase();
    return tokens.filter(t =>
      t.name.toLowerCase().includes(q)    ||
      t.ticker.toLowerCase().includes(q)  ||
      t.address.toLowerCase().includes(q)
    );
  }, [tokens, search]);

  return (
    <div style={{ minHeight: '100vh', paddingTop: 56 }}>
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', padding: '56px 0 40px', textAlign: 'center', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 600, height: 280,
          background: 'radial-gradient(ellipse,rgba(139,92,246,.14) 0%,transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="container" style={{ position: 'relative' }}>
          <div style={{ marginBottom: 14 }}>
            <span className="badge badge-violet">
              <span className="live-dot" />
              Preprod Live
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(32px,5.5vw,68px)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 14, lineHeight: 1 }}>
            <span className="gradient-text">Night</span>
            <span>. Trade in the dark.</span>
          </h1>

          <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto 28px', lineHeight: 1.6 }}>
            First memecoin launchpad on Midnight.
            Privacy-first bonding curves. ZK-verified trades.{' '}
            <span className="serif">Your wallet, your secret.</span>
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
            <Link href="/launch">
              <button className="btn btn-primary" style={{ fontSize: 15, padding: '12px 26px' }}>🚀 Launch a token</button>
            </Link>
            <a href="https://faucet.preprod.midnight.network" target="_blank" rel="noopener noreferrer">
              <button className="btn btn-secondary" style={{ fontSize: 15, padding: '12px 26px' }}>🚰 Get testnet DUST</button>
            </a>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 28, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Tokens', value: tokens.length.toString() },
              { label: 'Volume', value: `₾${fmtDust(tokens.reduce((a,t) => a + BigInt(t.totalVolume), 0n), 0)}` },
              { label: 'Graduated', value: tokens.filter(t=>t.graduated).length.toString() },
              { label: 'Traders', value: '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, color: 'var(--neon-violet-bright)' }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 80 }}>

        {/* ── King of the Hill ──────────────────────────────────────────── */}
        {koth && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 20, animation: 'crown 2s ease-in-out infinite' }}>👑</span>
              <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--neon-amber)' }}>King of the Hill</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>— highest momentum right now</span>
            </div>

            <Link href={`/token/${koth.address}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'linear-gradient(135deg,rgba(251,191,36,.05),rgba(139,92,246,.05))',
                border: '1px solid rgba(251,191,36,.22)',
                borderRadius: 18, padding: 22,
                display: 'flex', gap: 20, alignItems: 'center',
                cursor: 'pointer', transition: 'all .2s',
                boxShadow: '0 0 36px rgba(251,191,36,.05)',
              }}>
                <div style={{
                  width: 68, height: 68, borderRadius: 16, flexShrink: 0,
                  background: 'linear-gradient(135deg,#f59e0b,#8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, border: '2px solid rgba(251,191,36,.35)',
                }}>🌙</div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 21 }}>{koth.name}</span>
                    <span className="badge badge-amber">${koth.ticker}</span>
                    <span className="badge badge-violet">{koth.holderCount} holders</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 10 }}>{koth.description}</p>
                  <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Volume',   value: `₾${fmtDust(BigInt(koth.totalVolume), 0)}` },
                      { label: 'Txns',     value: koth.txCount.toString() },
                      { label: 'Progress', value: `${bondingProgress(BigInt(koth.adaReserve))}%` },
                      { label: 'Mcap',     value: fmtMcap(BigInt(koth.adaReserve)) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em' }}>{label} </span>
                        <span style={{ color: 'var(--neon-amber)', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button className="btn btn-primary" style={{ flexShrink: 0, fontSize: 13 }}>Trade now →</button>
              </div>
            </Link>
          </div>
        )}

        {/* ── Filter bar ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--night-raised)', border: '1px solid var(--night-border)', borderRadius: 10, padding: 3, gap: 2 }}>
            {([
              { key: 'bump',      label: 'Last Bump'  },
              { key: 'new',       label: 'New'        },
              { key: 'mcap',      label: 'Mcap'       },
              { key: 'graduated', label: '✅ Complete' },
            ] as { key: SortMode; label: string }[]).map(({ key, label }) => (
              <button key={key} onClick={() => setSort(key)} style={{
                background:  sort === key ? 'rgba(139,92,246,.18)' : 'transparent',
                border:      sort === key ? '1px solid rgba(139,92,246,.4)' : '1px solid transparent',
                color:       sort === key ? 'var(--neon-violet-bright)' : 'var(--text-secondary)',
                borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 12,
                transition: 'all .12s',
              }}>{label}</button>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, pointerEvents: 'none', color: 'var(--text-muted)' }}>🔍</span>
            <input
              type="text"
              placeholder="Search name, ticker, or address…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32, fontSize: 13 }}
            />
          </div>
        </div>

        {/* ── Token grid ───────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            Loading tokens from Preprod…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🌙</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>No tokens found. The night is quiet.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
            {filtered.map(token => <TokenCard key={token.address} token={token} />)}
          </div>
        )}
      </div>
    </div>
  );
}
