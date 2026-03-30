'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useWallet } from '@/lib/wallet/WalletProvider';
import { PUBLIC_NETWORK_LABEL } from '@/lib/network';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Discover',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    href: '/launch',
    label: 'Launch',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v20M2 12h20" />
      </svg>
    ),
  },
  {
    href: '/portfolio',
    label: 'Portfolio',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a4 4 0 0 0-8 0v2" />
      </svg>
    ),
  },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { connected, connecting, connect, disconnect } = useWallet();

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand" onClick={onToggle}>
        <div className="sidebar-brand-icon">N</div>
        <span className="sidebar-brand-text">
          night<em>.fun</em>
        </span>
      </div>

      {/* Network indicator */}
      <div style={{ padding: 'var(--s-12) var(--s-8)' }}>
        <div className="sidebar-network">
          <span className="sidebar-network-dot" />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{PUBLIC_NETWORK_LABEL}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigate</div>
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-link${pathname === href ? ' active' : ''}`}
          >
            {icon}
            <span className="sidebar-link-label">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer with wallet connect */}
      <div className="sidebar-footer">
        <button
          type="button"
          onClick={() => (connected ? disconnect() : void connect())}
          disabled={connecting}
          className={`sidebar-connect-btn${connected ? ' connected' : ''}`}
        >
          {connected ? (
            <>
              <span className="pulse-dot" />
              <span>Connected</span>
            </>
          ) : connecting ? (
            <span>Connecting...</span>
          ) : (
            <span>Connect Wallet</span>
          )}
        </button>
      </div>
    </aside>
  );
}
