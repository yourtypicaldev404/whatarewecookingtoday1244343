'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet, shortAddr, formatDustBalance } from '@/lib/wallet/WalletProvider';

export default function Navbar() {
  const pathname = usePathname();
  const { connected, connecting, unshieldedAddr, dustBalance, connect, disconnect, error } = useWallet();

  const links = [
    { href: '/',         label: 'Discover'   },
    { href: '/launch',   label: 'Launch'     },
    { href: '/portfolio',label: 'Portfolio'  },
  ];

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 56,
      background: 'rgba(5,5,8,0.88)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 14,
    }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'linear-gradient(135deg,#8b5cf6,#22d3ee)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, boxShadow: '0 0 12px rgba(139,92,246,0.4)',
        }}>🌙</div>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em', color: '#fff' }}>
          night<span style={{ color: 'var(--neon-violet-bright)' }}>.fun</span>
        </span>
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} style={{
              fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 13,
              color: active ? '#fff' : 'var(--text-secondary)',
              textDecoration: 'none',
              padding: '5px 12px', borderRadius: 7,
              background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
              transition: 'all .15s',
            }}>
              {label}
            </Link>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Network badge */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--neon-amber)',
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.2)',
        borderRadius: 6, padding: '3px 7px',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        flexShrink: 0,
      }}>
        {process.env.NEXT_PUBLIC_NETWORK_ID ?? 'preprod'}
      </div>

      {/* DUST balance (when connected) */}
      {connected && (
        <div style={{
          background: 'var(--night-raised)', border: '1px solid var(--night-border)',
          borderRadius: 9, padding: '5px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 5,
          flexShrink: 0,
        }}>
          <span style={{ color: 'var(--neon-cyan)', fontSize: 13 }}>₾</span>
          <span style={{ color: 'var(--text-primary)' }}>{formatDustBalance(dustBalance ?? BigInt(0))}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--neon-rose)', maxWidth: 180, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={error}>
          ⚠ {error}
        </div>
      )}

      {/* Connect / Address button */}
      <button
        onClick={connected ? disconnect : () => connect()}
        disabled={connecting}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: connected
            ? 'var(--night-raised)'
            : 'linear-gradient(135deg,var(--neon-violet),#6d28d9)',
          color: '#fff',
          border: connected ? '1px solid var(--night-border-active)' : 'none',
          borderRadius: 9, padding: '6px 14px',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12,
          cursor: connecting ? 'wait' : 'pointer',
          boxShadow: connected ? 'none' : '0 0 14px rgba(139,92,246,0.4)',
          flexShrink: 0, whiteSpace: 'nowrap',
          opacity: connecting ? 0.7 : 1,
          transition: 'all .2s',
        }}
      >
        {connected ? (
          <>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neon-green)', boxShadow: '0 0 5px var(--neon-green)' }} />
            {unshieldedAddr ? shortAddr(unshieldedAddr) : "Connected"}
          </>
        ) : connecting ? (
          '⏳ Connecting…'
        ) : (
          <>🌙 Connect Lace</>
        )}
      </button>
    </nav>
  );
}
