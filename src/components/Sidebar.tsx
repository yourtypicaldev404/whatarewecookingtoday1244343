'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PUBLIC_NETWORK_LABEL } from '@/lib/network';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Discover',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    href: '/launch',
    label: 'Launch',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v20M2 12h20" />
      </svg>
    ),
  },
  {
    href: '/portfolio',
    label: 'Portfolio',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a4 4 0 0 0-8 0v2" />
      </svg>
    ),
  },
  {
    href: '/leaderboard',
    label: 'Leaderboard',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 21V11M16 21V3M12 21V7" />
      </svg>
    ),
  },
  {
    href: '/stats',
    label: 'Stats',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-5" />
      </svg>
    ),
  },
  {
    href: '/how-it-works',
    label: 'How it works',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
      </svg>
    ),
  },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Brand — logo goes home when expanded, expands sidebar when collapsed */}
      <div className="sidebar-brand">
        {collapsed ? (
          <button type="button" onClick={onToggle} className="sidebar-brand-expand" aria-label="Expand sidebar">
            <img src="/logo.png" alt="night.fun" className="sidebar-brand-icon" />
          </button>
        ) : (
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-8)', textDecoration: 'none', flex: 1, minWidth: 0 }}>
            <img src="/logo.png" alt="night.fun" className="sidebar-brand-icon" />
            <span className="sidebar-brand-text">
              night<em>.fun</em><sup className="sidebar-beta-badge">BETA</sup>
            </span>
          </Link>
        )}
      </div>

      {/* Network indicator */}
      <div style={{ padding: 'var(--s-12) var(--s-8)' }}>
        <div className="sidebar-network">
          <span className="sidebar-network-dot" />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{PUBLIC_NETWORK_LABEL}</span>
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

      {/* Social links */}
      <div className="sidebar-social-links">
        <a href="https://x.com/nightdotfun" target="_blank" rel="noopener noreferrer" className="sidebar-social-link" aria-label="Twitter / X">
          <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
        <a href="https://discord.gg/" target="_blank" rel="noopener noreferrer" className="sidebar-social-link" aria-label="Discord">
          <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        </a>
      </div>

      {/* Collapse/expand toggle — bottom right */}
      <button type="button" className="sidebar-toggle" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={collapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'} />
        </svg>
      </button>
    </aside>
  );
}
