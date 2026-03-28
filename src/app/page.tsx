'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { bondingProgress, fmtDust, fmtMcap, spotPrice, kothScore, timeAgo } from '@/lib/midnight/bondingCurve';

type Token = any;

const TICKER_TOKENS = [
  { ticker: 'NITE', pct: '+42.1' }, { ticker: 'DUST', pct: '-8.3' },
  { ticker: 'MOON', pct: '+128.0' }, { ticker: 'DARK', pct: '+5.7' },
  { ticker: 'ZK',   pct: '-2.1' },  { ticker: 'PRIV', pct: '+19.4' },
  { ticker: 'VOID', pct: '+87.3' }, { ticker: 'SHLD', pct: '-12.5' },
];

export default function HomePage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [sort, setSort] = useState<'bump' | 'new' | 'mcap' | 'graduated'>('bump');
  const [search, setSearch] = useState('');
  const [koth, setKoth] = useState<Token | null>(null);

  useEffect(() => {
    fetch(`/api/tokens?sort=${sort}&limit=50${search ? `&search=${search}` : ''}`)
      .then(r => r.json())
      .then(({ tokens, kothAddress }) => {
        setTokens(tokens ?? []);
        if (kothAddress) setKoth((tokens ?? []).find((t: Token) => t.address === kothAddress) ?? null);
      })
      .catch(console.error);
  }, [sort, search]);

  const TICKER_DOUBLED = [...TICKER_TOKENS, ...TICKER_TOKENS];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* Ticker strip */}
      <div className="ticker-strip">
        <div className="ticker-scroll">
          {TICKER_DOUBLED.map((t, i) => (
            <div key={i} className="ticker-item">
              <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>●</span>
              <span style={{ fontWeight: 600 }}>{t.ticker}</span>
              <span className={parseFloat(t.pct) >= 0 ? 'up' : 'down'}>{t.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="discover-page" style={{ flex: 1 }}>

        {/* Hero */}
        <div style={{ marginBottom: 24, textAlign: 'center', padding: '20px 0 8px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div className="badge badge-teal">
              <div className="pulse" />
              PREPROD LIVE
            </div>
            <div className="badge badge-violet">ZK-PROTECTED</div>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 5vw, 52px)',
            fontWeight: 800,
            letterSpacing: '-1px',
            lineHeight: 1.1,
            color: 'var(--text-primary)',
            marginBottom: 10,
          }}>
            <span style={{ color: 'var(--teal)' }}>Night.</span> Trade in the dark.
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 480, margin: '0 auto 20px' }}>
            First memecoin launchpad on Midnight. Privacy-first bonding curves. ZK-verified trades. Your wallet, your secret.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/launch" style={{ textDecoration: 'none' }}>
              <button style={{
                padding: '10px 22px',
                background: 'var(--teal)',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.2px',
              }}>
                🚀 Launch a token
              </button>
            </Link>
            <a href="https://faucet.preprod.midnight.network/" target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>
              <button style={{
                padding: '10px 22px',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}>
                🪣 Get testnet DUST
              </button>
            </a>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'TOKENS', value: tokens.length.toString() },
            { label: 'VOLUME', value: '₾' + fmtDust(tokens.reduce((a, t) => a + BigInt(t.totalVolume ?? '0'), 0n), 0) },
            { label: 'GRADUATED', value: tokens.filter(t => t.graduated).length.toString() },
            { label: 'TRADERS', value: '—' },
          ].map(s => (
            <div key={s.label} style={{
              textAlign: 'center',
              padding: '8px 20px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
            }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* KotH */}
        {koth && (
          <div className="koth-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>👑</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>KING OF THE HILL</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>— highest momentum</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="token-avatar" style={{ width: 44, height: 44 }}>
                {koth.imageUri && koth.imageUri !== 'ipfs://'
                  ? <img src={koth.imageUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} alt={koth.name} onError={e => { (e.target as any).parentElement.innerHTML = '🌙'; }} />
                  : '🌙'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>{koth.name}</span>
                  <span className="badge badge-violet">${koth.ticker}</span>
                  <span className="badge" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{koth.holderCount} holders</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 8, maxWidth: 400 }}>{koth.description || '—'}</p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {[
                    ['VOL', '₾' + fmtDust(BigInt(koth.totalVolume ?? '0'), 0)],
                    ['TXNS', koth.txCount],
                    ['PROGRESS', bondingProgress(BigInt(koth.adaReserve ?? '0')) + '%'],
                    ['MCAP', fmtMcap(BigInt(koth.adaReserve ?? '0'))],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div className="stat-label">{l}</div>
                      <div className="stat-value" style={{ fontSize: 12 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <Link href={`/token/${koth.address}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <button style={{
                  padding: '8px 16px',
                  background: 'var(--violet-dim)',
                  border: '1px solid rgba(139,111,232,0.3)',
                  borderRadius: 7,
                  color: 'var(--violet)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                  Trade now →
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Filter row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div className="tab-row">
            {(['bump', 'new', 'mcap', 'graduated'] as const).map(s => (
              <button key={s} className={`tab-btn ${sort === s ? 'active' : ''}`} onClick={() => setSort(s)}>
                {s === 'bump' ? 'Last Bump' : s === 'new' ? 'New' : s === 'mcap' ? 'Mcap' : '✅ Complete'}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, ticker, address…"
              style={{
                width: '100%',
                height: 30,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '0 10px',
                fontSize: 12,
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'var(--font-body)',
              }}
            />
          </div>
        </div>

        {/* Token grid */}
        {tokens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🌙</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>No tokens yet — be the first to launch</div>
          </div>
        ) : (
          <div className="token-grid">
            {tokens.map((token: Token) => {
              const ada = BigInt(token.adaReserve ?? '0');
              const tok = BigInt(token.tokenReserve ?? '999000000000000');
              const prog = bondingProgress(ada);
              return (
                <Link key={token.address} href={`/token/${token.address}`} style={{ textDecoration: 'none' }}>
                  <div className="token-card">
                    {/* Card header */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                      <div className="token-avatar" style={{ width: 38, height: 38, fontSize: 16 }}>
                        {token.imageUri && token.imageUri !== 'ipfs://'
                          ? <img src={token.imageUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} alt={token.name} onError={e => { (e.target as any).parentElement.innerHTML = '🌙'; }} />
                          : '🌙'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {token.name}
                          </span>
                          {token.graduated && <span className="badge badge-green" style={{ fontSize: 9 }}>GRAD</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span className="badge badge-violet" style={{ fontSize: 9 }}>${token.ticker}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
                            {token.address.slice(0, 6)}…{token.address.slice(-4)}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="stat-value" style={{ fontSize: 12 }}>{fmtMcap(ada)}</div>
                        <div className="stat-label">mcap</div>
                      </div>
                    </div>

                    {/* Description */}
                    {token.description && (
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {token.description}
                      </p>
                    )}

                    {/* Progress */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span className="stat-label">bonding curve</span>
                        <span className="stat-label" style={{ color: prog > 80 ? 'var(--green)' : 'var(--text-muted)' }}>{prog}%</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${prog}%` }} />
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div>
                          <div className="stat-label">vol</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>₾{fmtDust(BigInt(token.totalVolume ?? '0'), 0)}</div>
                        </div>
                        <div>
                          <div className="stat-label">txns</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{token.txCount ?? 0}</div>
                        </div>
                        <div>
                          <div className="stat-label">holders</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{token.holderCount ?? 1}</div>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                        style={{
                          padding: '4px 10px',
                          background: 'var(--teal-dim)',
                          border: '1px solid rgba(0,229,160,0.2)',
                          borderRadius: 5,
                          color: 'var(--teal)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ₾50 Buy
                      </button>
                    </div>

                    {/* Age */}
                    <div style={{ marginTop: 8, borderTop: '1px solid var(--border-dim)', paddingTop: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                        {timeAgo ? timeAgo(token.deployedAt) : `${Math.floor((Date.now()/1000 - token.deployedAt)/60)}m ago`}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}