type TokenRecord = any;
'use client';

import Link from 'next/link';

import { fmtDust, fmtMcap, bondingProgress, spotPrice, timeAgo } from '@/lib/midnight/bondingCurve';

export default function TokenCard({ token }: { token: TokenRecord }) {
  const progress = bondingProgress(BigInt(token.adaReserve));
  const mcap     = fmtMcap(BigInt(token.adaReserve));

  return (
    <Link href={`/token/${token.address}`} style={{ textDecoration: 'none' }}>
      <div className="glass token-card" style={{
        padding: 16,
        borderColor: token.graduated
          ? 'rgba(var(--primary-rgb),.18)'
          : 'var(--border-color)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--radius-md)', flexShrink: 0,
            background: `linear-gradient(135deg,#${token.address.slice(2,8)},#${token.address.slice(8,14)})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, border: '1px solid var(--border-color)',
          }}>🌙</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{token.name}</span>
              {token.graduated && <span className="badge badge-green">Graduated</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>
              <span style={{ color: 'var(--primary-color)' }}>${token.ticker}</span>
              <span>·</span>
              <span>{token.address.slice(0,8)}...{token.address.slice(-4)}</span>
              <span>·</span>
              <span>{timeAgo(token.lastActivityAt)}</span>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: token.graduated ? 'var(--primary-color)' : 'var(--primary-color)' }}>{mcap}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>mcap</div>
          </div>
        </div>

        {/* Description */}
        <p style={{
          fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5,
        }}>{token.description}</p>

        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Bonding curve</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--primary-color)' }}>{progress}%</span>
        </div>
        <div className="progress-track" style={{ marginBottom: 12 }}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, paddingTop: 10, borderTop: '1px solid var(--border-color)', alignItems: 'center' }}>
          {[
            { label: 'Vol',     value: `₾${fmtDust(BigInt(token.totalVolume), 0)}` },
            { label: 'Txns',    value: token.txCount.toString()   },
            { label: 'Holders', value: token.holderCount.toString() },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>{value}</span>
            </div>
          ))}
          <button className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 14px', borderRadius: 'var(--radius-pill)' }}
            onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
            Buy
          </button>
        </div>
      </div>
    </Link>
  );
}
