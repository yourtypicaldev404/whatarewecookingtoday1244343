'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { bondingProgress, fmtDust, fmtMcap, spotPrice } from '@/lib/midnight/bondingCurve';

type Token = any;

const TICKER_ITEMS = [
  { t: 'NITE', p: '+42.1', up: true }, { t: 'MOON', p: '+128.0', up: true },
  { t: 'PRIV', p: '+19.4', up: true }, { t: 'VOID', p: '+87.3', up: true },
  { t: 'DARK', p: '+5.7',  up: true }, { t: 'NGHT', p: '-8.3',  up: false },
  { t: 'ZK',   p: '-2.1',  up: false }, { t: 'SHLD', p: '-12.5', up: false },
  { t: 'BYTE', p: '+33.0', up: true }, { t: 'MASK', p: '+7.8',  up: true },
];

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'trending', label: 'Trending' },
  { id: 'bonded', label: 'Graduated' },
];

function timeAgo(ts: number) {
  const d = Math.floor(Date.now() / 1000) - ts;
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

function TokenAvatar({ token, size = 57 }: { token: Token; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = (token.ticker || token.name || '?').slice(0, 2).toUpperCase();
  if (!err && token.imageUri && token.imageUri !== 'ipfs://') {
    return (
      <div className="token-avatar" style={{ width: size, height: size, borderRadius: 'var(--radius-md)' }}>
        <img src={token.imageUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} alt={token.name} onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div className="token-avatar" style={{ width: size, height: size, borderRadius: 'var(--radius-md)' }}>
      <div className="token-avatar-placeholder" style={{ fontSize: size * 0.32, letterSpacing: '-0.5px' }}>{initials}</div>
    </div>
  );
}

function TokenCard({ token }: { token: Token }) {
  const ada = BigInt(token.adaReserve ?? '0');
  const tok = BigInt(token.tokenReserve ?? '999000000000000');
  const prog = bondingProgress(ada);
  const addr = (token.address ?? '') as string;

  return (
    <Link href={`/token/${token.address}`} style={{ textDecoration: 'none' }}>
      <div className="mosaic-card">
        {/* Avatar + mcap */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
          <TokenAvatar token={token} size={68} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{token.name}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--primary-color)', fontWeight: 600 }}>${token.ticker}</div>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--primary-color)', flexShrink: 0 }}>{fmtMcap(ada)}</div>
        </div>

        {/* Description */}
        {token.description && (
          <p style={{
            fontSize: 16, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{token.description}</p>
        )}

        {/* Progress bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Curve</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: prog > 80 ? 'var(--primary-color)' : 'var(--text-tertiary)' }}>{prog}%</span>
          </div>
          <div style={{ height: 5, background: 'var(--bg-4)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${prog}%`, background: prog > 80 ? 'var(--primary-color)' : prog > 40 ? 'var(--warning)' : 'var(--text-tertiary)', borderRadius: 3, transition: 'width .5s ease' }} />
          </div>
        </div>

        {/* Stats + age */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 13, borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: 18 }}>
            {[
              { l: 'Vol', v: fmtDust(BigInt(token.totalVolume ?? '0'), 0) },
              { l: 'Txns', v: String(token.txCount ?? 0) },
              { l: 'Hldr', v: String(token.holderCount ?? 1) },
            ].map(s => (
              <div key={s.l}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.l}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{s.v}</div>
              </div>
            ))}
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text-tertiary)' }}>{timeAgo(token.lastActivityAt ?? token.deployedAt ?? 0)}</span>
        </div>

        {token.graduated && (
          <div style={{ position: 'absolute', top: 10, right: 10 }}>
            <span className="badge badge-green">Graduated</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function HomePageInner() {
  const searchParams = useSearchParams();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [koth, setKoth] = useState<Token | null>(null);
  const [search, setSearch] = useState(searchParams?.get('search') || '');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/tokens?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`);
      const d = await r.json();
      const all: Token[] = d.tokens ?? [];
      setTokens(all);
      if (d.kothAddress) setKoth(all.find(t => t.address === d.kothAddress) ?? null);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const filtered = (() => {
    let list = [...tokens];
    if (filter === 'new') {
      list = list.sort((a, b) => (b.deployedAt ?? 0) - (a.deployedAt ?? 0));
    } else if (filter === 'trending') {
      list = list.filter(t => !t.graduated).sort((a, b) => (b.lastActivityAt ?? b.deployedAt ?? 0) - (a.lastActivityAt ?? a.deployedAt ?? 0));
    } else if (filter === 'bonded') {
      list = list.filter(t => bondingProgress(BigInt(t.adaReserve ?? '0')) >= 100 || t.graduated);
    }
    return list.slice(0, 50);
  })();

  const DOUBLED = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Ticker */}
      <div className="ticker-strip">
        <div className="ticker-scroll">
          {DOUBLED.map((item, i) => (
            <div key={i} className="ticker-item">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.up ? 'var(--primary-color)' : 'var(--danger)', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{item.t}</span>
              <span className={item.up ? 'up' : 'dn'}>{item.p}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="discover-toolbar">
        {koth && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '.07em' }}>KotH</span>
            <TokenAvatar token={koth} size={31} />
            <span style={{ fontWeight: 600, fontSize: 17 }}>{koth.name}</span>
            <span className="badge badge-green">${koth.ticker}</span>
            <Link href={`/token/${koth.address}`}>
              <button className="btn btn-primary" style={{ height: 36, fontSize: 14, padding: '0 18px', borderRadius: 'var(--radius-pill)' }}>Trade</button>
            </Link>
            <div style={{ width: 1, height: 26, background: 'var(--border-color)', margin: '0 5px' }} />
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`filter-btn${filter === f.id ? ' active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="spacer" />

        <input
          className="nav-search"
          style={{ height: 42, width: '100%', maxWidth: 260, minWidth: 140, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0 16px', fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', transition: 'var(--transition-fast)', flex: '1 1 140px' }}
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Trending carousel */}
      {!loading && filtered.length > 0 && (
        <div className="trending-section">
          <div className="trending-header">
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Trending</span>
            <div style={{ height: 1, flex: 1, background: 'var(--border-color)' }} />
          </div>
          <div className="trending-scroll">
            {[...tokens]
              .sort((a, b) => (b.totalVolume ?? 0) - (a.totalVolume ?? 0))
              .slice(0, 12)
              .map(t => {
                const prog = bondingProgress(BigInt(t.adaReserve ?? '0'));
                return (
                  <Link key={`tr-${t.address}`} href={`/token/${t.address}`} className="trending-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <TokenAvatar token={t} size={42} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--primary-color)', fontWeight: 600 }}>${t.ticker}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--primary-color)' }}>{fmtMcap(BigInt(t.adaReserve ?? '0'))}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>mcap</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-4)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${prog}%`, background: prog > 80 ? 'var(--primary-color)' : prog > 40 ? 'var(--warning)' : 'var(--text-tertiary)', borderRadius: 2 }} />
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      )}

      {/* Mosaic grid */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontFamily: 'var(--mono)', fontSize: 17, color: 'var(--text-tertiary)' }}>Loading...</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-16)' }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, fontFamily: 'var(--mono)', fontSize: 17, color: 'var(--text-tertiary)' }}>
              {filter === 'bonded' ? 'No graduated tokens yet' : 'No tokens found'}
            </div>
          ) : (
            <div className="mosaic-grid">
              {filtered.map(t => <TokenCard key={t.address} token={t} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomePageInner />
    </Suspense>
  );
}
