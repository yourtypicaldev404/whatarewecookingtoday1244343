'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useWallet } from '@/lib/wallet/WalletProvider';
import { PUBLIC_NETWORK_LABEL } from '@/lib/network';
import WalletPickerModal from '@/components/WalletPickerModal';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { connected, connecting, disconnect } = useWallet();
  const [q, setQ] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <nav>
      <Link href="/" className="nav-logo">
        night<em>.fun</em>
      </Link>

      <div className="nav-links">
        {([['/', 'Discover'], ['/launch', 'Launch'], ['/portfolio', 'Portfolio']] as const).map(([href, label]) => (
          <Link key={href} href={href} className={`nav-link ${pathname === href ? 'active' : ''}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="nav-spacer" />

      <input
        className="nav-search"
        placeholder="Search token or address…"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && q.trim()) router.push(`/?search=${encodeURIComponent(q.trim())}`); }}
      />

      <span className="nav-network">{PUBLIC_NETWORK_LABEL}</span>

      <button
        type="button"
        onClick={() => (connected ? disconnect() : setPickerOpen(true))}
        disabled={connecting}
        className={connected ? 'btn-wallet-connected' : 'btn-wallet'}
      >
        {connected ? (
          <><div className="pulse" /><span>Connected</span></>
        ) : connecting ? (
          <span>Connecting…</span>
        ) : (
          <span>Connect wallet</span>
        )}
      </button>

      <WalletPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </nav>
  );
}


