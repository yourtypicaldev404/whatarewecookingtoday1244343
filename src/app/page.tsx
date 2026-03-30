'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { bondingProgress, fmtDust, fmtMcap, spotPrice } from '@/lib/midnight/bondingCurve';

type Token = any;

const TICKER_ITEMS = [
  { t: 'NITE', p: '+42.1', up: true }, { t: 'MOON', p: '+128.0', up: true },
  { t: 'PRIV', p: '+19.4', up: true }, { t: 'VOID', p: '+87.3', up: true },
  { t: 'DARK', p: '+5.7',  up: true }, { t: 'DUST', p: '-8.3',  up: false },
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

function TokenAvatar({ token, size = 44 }: { token: Token; size?: number }) {
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
  const price = spotPrice(ada, tok);
  const addr = (token.address ?? '') as string;

  return (
    <Link href={`/token/${token.address}`} style={{ textDecoration: 'none' }}>
      <div style={{
        position: 'relative',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        padding: '16px 18px',
        cursor: 'pointer',
        transition: 'transform .2s ease, border-color .2s ease, box-shadow .2s ease, background-color .2s ease',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.transform = 'translateY(-3px)';
        el.style.borderColor = 'var(--primary-color)';
        el.style.boxShadow = '0 4px 12px rgba(78,209,107,0.15)';
        el.style.backgroundColor = '#232325';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.transform = '';
        el.style.borderColor = 'var(--border-color)';
        el.style.boxShadow = '';
        el.style.backgroundColor = 'var(--bg-secondary)';
      }}
      >
        {/* Top row: avatar + name + mcap */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <TokenAvatar token={token} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{token.name}</span>
              {token.graduated && <span className="badge badge-green">Graduated</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 12 }}>
              <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>${token.ticker}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>·</span>
              <span style={{ color: 'var(--text-tertiary)' }}>{addr.slice(0, 8)}...{addr.slice(-4)}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>·</span>
              <span style={{ color: 'var(--text-tertiary)' }}>{timeAgo(token.lastActivityAt ?? token.deployedAt ?? 0)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--primary-color)' }}>{fmtMcap(ada)}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>mcap</div>
          </div>
        </div>

        {/* Description */}
        {token.description && (
          <p style={{
            fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5,
          }}>{token.description}</p>
        )}

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>Bonding curve</span>
          <div style={{ flex: 1, height: 4, background: 'var(--bg-4)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${prog}%`, background: prog > 80 ? 'var(--primary-color)' : prog > 40 ? 'var(--warning)' : 'var(--text-tertiary)', borderRadius: 2, transition: 'width .5s ease' }} />
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: prog > 80 ? 'var(--primary-color)' : 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{prog}%</span>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
          {[
            { label: 'Price', value: fmtDust(price, 6) + ' D' },
            { label: 'Volume', value: fmtDust(BigInt(token.totalVolume ?? '0'), 0) },
            { label: 'Txns', value: String(token.txCount ?? 0) },
            { label: 'Holders', value: String(token.holderCount ?? 1) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <button
              className="btn btn-primary"
              style={{ fontSize: 12, padding: '6px 18px', borderRadius: 'var(--radius-pill)' }}
              onClick={e => { e.preventDefault(); e.stopPropagation(); }}
            >
              Buy
            </button>
          </div>
        </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Ticker */}
      <div className="ticker-strip">
        <div className="ticker-scroll">
          {DOUBLED.map((item, i) => (
            <div key={i} className="ticker-item">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.up ? 'var(--primary-color)' : 'var(--danger)', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{item.t}</span>
              <span className={item.up ? 'up' : 'dn'}>{item.p}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="discover-toolbar">
        {koth && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '.07em' }}>KotH</span>
            <TokenAvatar token={koth} size={24} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>{koth.name}</span>
            <span className="badge badge-green">${koth.ticker}</span>
            <Link href={`/token/${koth.address}`}>
              <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 14px', borderRadius: 'var(--radius-pill)' }}>Trade</button>
            </Link>
            <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />
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

        <div style={{ flex: 1 }} />

        <input
          style={{ height: 32, width: 220, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0 12px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', transition: 'var(--transition-fast)' }}
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Link href="/launch">
          <button className="btn btn-primary" style={{ height: 32, fontSize: 12, padding: '0 16px', borderRadius: 'var(--radius-pill)' }}>New token</button>
        </Link>
      </div>

      {/* Card list */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-tertiary)' }}>Loading...</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-16)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 900, margin: '0 auto' }}>
            {filtered.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-tertiary)' }}>
                {filter === 'bonded' ? 'No graduated tokens yet' : 'No tokens found'}
              </div>
            ) : (
              filtered.map(t => <TokenCard key={t.address} token={t} />)
            )}
          </div>
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
