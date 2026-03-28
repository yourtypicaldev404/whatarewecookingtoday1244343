'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { bondingProgress, fmtDust, fmtMcap, spotPrice } from '@/lib/midnight/bondingCurve';

type Token = any;

const TICKER_ITEMS = [
  { t: 'NITE', p: '+42.1', up: true }, { t: 'MOON', p: '+128.0', up: true },
  { t: 'PRIV', p: '+19.4', up: true }, { t: 'VOID', p: '+87.3', up: true },
  { t: 'DARK', p: '+5.7',  up: true }, { t: 'DUST', p: '-8.3',  up: false },
  { t: 'ZK',   p: '-2.1',  up: false }, { t: 'SHLD', p: '-12.5', up: false },
  { t: 'BYTE', p: '+33.0', up: true }, { t: 'MASK', p: '+7.8',  up: true },
];

function timeAgo(ts: number) {
  const d = Math.floor(Date.now() / 1000) - ts;
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

function TokenAvatar({ token, size = 28 }: { token: Token; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = (token.ticker || token.name || '?').slice(0, 2).toUpperCase();
  if (!err && token.imageUri && token.imageUri !== 'ipfs://') {
    return (
      <div className="token-avatar" style={{ width: size, height: size }}>
        <img src={token.imageUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} alt={token.name} onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div className="token-avatar" style={{ width: size, height: size }}>
      <div className="token-avatar-placeholder" style={{ fontSize: size * 0.3, letterSpacing: '-0.5px' }}>{initials}</div>
    </div>
  );
}

function TokenRow({ token, i }: { token: Token; i: number }) {
  const ada = BigInt(token.adaReserve ?? '0');
  const tok = BigInt(token.tokenReserve ?? '999000000000000');
  const prog = bondingProgress(ada);
  return (
    <tr style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/token/${token.address}`}>
      <td style={{ color: 'var(--t3)', fontFamily: 'var(--mono)', fontSize: 10, paddingLeft: 10, width: 28 }}>{i + 1}</td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <TokenAvatar token={token} size={32} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--t1)' }}>{token.name}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)' }}>${token.ticker}</div>
          </div>
        </div>
      </td>
      <td><span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t1)' }}>{fmtMcap(ada)}</span></td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 44, height: 2, background: 'var(--bg-4)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${prog}%`, background: prog > 80 ? 'var(--green)' : prog > 40 ? 'var(--amber)' : 'var(--t4)', borderRadius: 1 }} />
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: prog > 80 ? 'var(--green)' : 'var(--t3)' }}>{prog}%</span>
        </div>
      </td>
      <td><span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)' }}>{timeAgo(token.lastActivityAt ?? token.deployedAt ?? 0)}</span></td>
      <td onClick={e => e.stopPropagation()}>
        <Link href={`/token/${token.address}`}>
          <button style={{ padding: '3px 10px', height: 22, background: 'var(--green-bg)', border: '1px solid rgba(0,209,167,0.2)', borderRadius: 3, color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>
            Buy
          </button>
        </Link>
      </td>
    </tr>
  );
}

function ColHeader({ title, count }: { title: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderBottom: '1px solid var(--b1)', background: 'var(--bg-1)', flexShrink: 0 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)' }}>{count}</span>
    </div>
  );
}

function TokenColumn({ title, tokens, emptyMsg }: { title: string; tokens: Token[]; emptyMsg: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid var(--b1)', overflow: 'hidden' }}>
      <ColHeader title={title} count={tokens.length} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tokens.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t4)' }}>
            {emptyMsg}
          </div>
        ) : (
          <table className="token-table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: 28, paddingLeft: 10 }}>#</th>
                <th>Token</th>
                <th>Mcap</th>
                <th>Curve</th>
                <th>Age</th>
                <th style={{ width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t, i) => <TokenRow key={t.address} token={t} i={i} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function HomePageInner() {
  const searchParams = useSearchParams();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [koth, setKoth] = useState<Token | null>(null);
  const [search, setSearch] = useState(searchParams?.get('search') || '');
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

  const now = Math.floor(Date.now() / 1000);
  const newPairs    = [...tokens].sort((a, b) => (b.deployedAt ?? 0) - (a.deployedAt ?? 0)).slice(0, 30);
  const lastBump    = [...tokens].filter(t => !t.graduated).sort((a, b) => (b.lastActivityAt ?? b.deployedAt ?? 0) - (a.lastActivityAt ?? a.deployedAt ?? 0)).slice(0, 30);
  const bonded      = [...tokens].filter(t => bondingProgress(BigInt(t.adaReserve ?? '0')) >= 100 || t.graduated).slice(0, 30);

  const DOUBLED = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* Ticker */}
      <div className="ticker-strip">
        <div className="ticker-scroll">
          {DOUBLED.map((item, i) => (
            <div key={i} className="ticker-item">
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: item.up ? 'var(--green)' : 'var(--red)', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: 'var(--t2)', fontWeight: 600 }}>{item.t}</span>
              <span className={item.up ? 'up' : 'dn'}>{item.p}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="discover-toolbar">
        {koth && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.07em' }}>KotH</span>
            <TokenAvatar token={koth} size={18} />
            <span style={{ fontWeight: 600, fontSize: 11 }}>{koth.name}</span>
            <span className="badge badge-green">${koth.ticker}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)' }}>{bondingProgress(BigInt(koth.adaReserve ?? '0'))}% bonded</span>
            <Link href={`/token/${koth.address}`}>
              <button style={{ padding: '3px 10px', height: 22, background: 'var(--green-bg)', border: '1px solid rgba(0,209,167,0.2)', borderRadius: 3, color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>Trade</button>
            </Link>
            <div style={{ width: 1, height: 16, background: 'var(--b1)', margin: '0 4px' }} />
          </div>
        )}
        <div style={{ flex: 1 }} />
        <input
          style={{ height: 26, width: 200, background: 'var(--bg-2)', border: '1px solid var(--b1)', borderRadius: 4, padding: '0 9px', fontSize: 11, color: 'var(--t1)', outline: 'none', fontFamily: 'var(--font)' }}
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Link href="/launch">
          <button className="btn btn-primary" style={{ height: 26, fontSize: 11, padding: '0 12px' }}>New token</button>
        </Link>
      </div>

      {/* 3-column layout */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--t3)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', flex: 1, overflow: 'hidden' }}>
          <TokenColumn title="New pairs" tokens={newPairs} emptyMsg="No tokens yet" />
          <TokenColumn title="Last bump" tokens={lastBump} emptyMsg="No recent activity" />
          <TokenColumn title="Bonded" tokens={bonded} emptyMsg="No graduated tokens yet" />
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
