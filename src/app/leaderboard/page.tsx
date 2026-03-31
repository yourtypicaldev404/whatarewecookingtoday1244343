'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

function fmtNight(raw: string | bigint, dec = 0): string {
  const n = BigInt(raw || '0');
  const whole = n / 1_000_000n;
  if (dec === 0) return whole.toLocaleString();
  const frac = (n % 1_000_000n).toString().padStart(6, '0').slice(0, dec);
  return `${whole.toLocaleString()}.${frac}`;
}

type Token = {
  address: string;
  name: string;
  ticker: string;
  volume: string;
  txCount: number;
  adaReserve: string;
  graduated: boolean;
  imageUri?: string;
};

function TokenAvatar({ token, size = 48 }: { token: any; size?: number }) {
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
      <div className="token-avatar-placeholder" style={{ fontSize: size * 0.32 }}>{initials}</div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [sort, setSort] = useState<'volume' | 'trades' | 'liquidity'>('volume');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => {
        // Merge all top lists to get full data
        const map = new Map<string, Token>();
        [...(data.topByVolume ?? []), ...(data.topByTxns ?? []), ...(data.topByLiquidity ?? [])].forEach((t: Token) => {
          if (!map.has(t.address)) map.set(t.address, t);
        });
        setTokens(Array.from(map.values()));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...tokens].sort((a, b) => {
    if (sort === 'volume') return BigInt(b.volume) > BigInt(a.volume) ? 1 : -1;
    if (sort === 'trades') return b.txCount - a.txCount;
    return BigInt(b.adaReserve) > BigInt(a.adaReserve) ? 1 : -1;
  });

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '42px 31px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Rankings</div>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}>Leaderboard</h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)' }}>Top tokens by all-time trading volume.</p>
        </div>

        {/* Sort tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {([['volume', 'Volume'], ['trades', 'Trades'], ['liquidity', 'Liquidity']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              className={`filter-btn${sort === id ? ' active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, fontFamily: 'var(--mono)', fontSize: 17, color: 'var(--text-tertiary)' }}>Loading...</div>
        ) : tokens.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, fontFamily: 'var(--mono)', fontSize: 17, color: 'var(--text-tertiary)' }}>No tokens yet</div>
        ) : (
          <>
            {/* Top 3 podium */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 14, marginBottom: 32 }}>
              {top3.map((t, i) => (
                <Link key={t.address} href={`/token/${t.address}`} style={{ textDecoration: 'none' }}>
                  <div className="glass" style={{
                    padding: '24px 22px',
                    borderRadius: 'var(--radius-md)',
                    borderColor: i === 0 ? 'rgba(0, 112, 243, 0.3)' : 'var(--border-color)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {/* Rank badge */}
                    <div style={{
                      position: 'absolute', top: 14, right: 14,
                      width: 32, height: 32, borderRadius: '50%',
                      background: i === 0 ? '#0070f3' : i === 1 ? 'var(--bg-4)' : 'var(--bg-4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700,
                      color: i === 0 ? '#fff' : 'var(--text-secondary)',
                    }}>
                      #{i + 1}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                      <TokenAvatar token={t} size={52} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>{t.name}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: '#0070f3', fontWeight: 600 }}>${t.ticker}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 20 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Volume</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700 }}>{fmtNight(t.volume)}</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Trades</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700 }}>{t.txCount.toLocaleString()}</div>
                      </div>
                    </div>

                    {t.graduated && (
                      <div style={{ marginTop: 12 }}>
                        <span className="badge badge-green">Graduated</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Rest of the table */}
            {rest.length > 0 && (
              <div className="glass" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>#</th>
                      <th>Token</th>
                      <th style={{ textAlign: 'right' }}>Volume</th>
                      <th style={{ textAlign: 'right' }}>Trades</th>
                      <th style={{ textAlign: 'right' }}>Liquidity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((t, i) => (
                      <tr key={t.address}>
                        <td style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{i + 4}</td>
                        <td>
                          <Link href={`/token/${t.address}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <TokenAvatar token={t} size={36} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#0070f3' }}>${t.ticker}</div>
                            </div>
                            {t.graduated && <span className="badge badge-green" style={{ marginLeft: 6 }}>Graduated</span>}
                          </Link>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                          <div style={{ fontWeight: 600 }}>{fmtNight(t.volume)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>NIGHT</div>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{t.txCount.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                          <div style={{ fontWeight: 600 }}>{fmtNight(t.adaReserve)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>NIGHT</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
