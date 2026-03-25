'use client';

import Link from 'next/link';
import type { TokenRecord } from '@/app/api/tokens/route';
import { fmtDust, fmtMcap, bondingProgress, spotPrice, timeAgo } from '@/lib/midnight/bondingCurve';

export default function TokenCard({ token }: { token: TokenRecord }) {
  const progress = bondingProgress(BigInt(token.adaReserve));
  const mcap     = fmtMcap(BigInt(token.adaReserve));

  return (
    <Link href={`/token/${token.address}`} style={{ textDecoration: 'none' }}>
      <div className="glass token-card" style={{
        padding: 14,
        borderColor: token.graduated
          ? 'rgba(74,222,128,.18)'
          : 'rgba(255,255,255,.07)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 11, flexShrink: 0,
            background: `linear-gradient(135deg,#${token.address.slice(2,8)},#${token.address.slice(8,14)})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, border: '1px solid rgba(255,255,255,.1)',
          }}>🌙</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{token.name}</span>
              {token.graduated && <span className="badge badge-green">Graduated</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--neon-violet-bright)' }}>${token.ticker}</span>
              <span>·</span>
              <span>{token.address.slice(0,8)}…{token.address.slice(-4)}</span>
              <span>·</span>
              <span>{timeAgo(token.lastActivityAt)}</span>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: token.graduated ? 'var(--neon-green)' : 'var(--neon-violet-bright)' }}>{mcap}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>mcap</div>
          </div>
        </div>

        {/* Description */}
        <p style={{
          fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5,
        }}>{token.description}</p>

        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Bonding curve</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: token.graduated ? 'var(--neon-green)' : 'var(--neon-violet-bright)' }}>{progress}%</span>
        </div>
        <div className="progress-bar" style={{ marginBottom: 10 }}>
          <div className={`progress-fill${token.graduated ? ' graduated' : ''}`} style={{ width: `${progress}%` }} />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, paddingTop: 8, borderTop: '1px solid var(--night-border)', alignItems: 'center' }}>
          {[
            { label: 'Vol',     value: `₾${fmtDust(BigInt(token.totalVolume), 0)}` },
            { label: 'Txns',    value: token.txCount.toString()   },
            { label: 'Holders', value: token.holderCount.toString() },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{value}</span>
            </div>
          ))}
          <button className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 11, padding: '5px 10px' }}
            onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
            ₾50 Buy
          </button>
        </div>
      </div>
    </Link>
  );
}
