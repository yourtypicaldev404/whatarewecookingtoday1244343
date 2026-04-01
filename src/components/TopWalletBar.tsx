'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useWallet, shortAddr } from '@/lib/wallet/WalletProvider';
import type { DetectedWallet } from '@/lib/wallet/WalletProvider';

/** DiceBear fun-emoji avatar from wallet address */
function memeAvatar(addr: string | null): string {
  const seed = addr?.slice(0, 16) ?? 'anon';
  return `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(seed)}&size=40`;
}

export default function TopWalletBar() {
  const { connected, connecting, connect, disconnect, unshieldedAddr, walletName, walletIcon, getAvailableWallets } = useWallet();
  const [showPicker, setShowPicker] = useState(false);
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  const handleConnectClick = () => {
    const detected = getAvailableWallets();
    setWallets(detected);
    if (detected.length === 0) { void connect(); return; }
    setShowPicker(true);
  };

  const handlePickWallet = (id: string) => {
    setShowPicker(false);
    void connect(id);
  };

  return (
    <div className="top-wallet-bar">
      {/* New token button — always visible */}
      <Link href="/launch">
        <button className="top-bar-launch-btn">
          + New Token
        </button>
      </Link>

      {connected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={memeAvatar(unshieldedAddr)}
            alt=""
            style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
          />
          {walletIcon && (
            <img src={walletIcon} alt="" style={{ width: 18, height: 18, borderRadius: 3 }} />
          )}
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
            {shortAddr(unshieldedAddr)}
          </span>
          <button type="button" onClick={disconnect} className="top-wallet-btn connected">
            Disconnect
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }} ref={pickerRef}>
          <button
            type="button"
            onClick={handleConnectClick}
            disabled={connecting}
            className="top-wallet-btn"
          >
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </button>

          {showPicker && (
            <div className="wallet-picker">
              <div style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--border-color)' }}>
                Select wallet
              </div>
              {wallets.map(w => (
                <button key={w.id} type="button" className="wallet-picker-item" onClick={() => handlePickWallet(w.id)}>
                  {w.icon ? (
                    <img src={w.icon} alt="" style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
                  ) : (
                    <span style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, color: 'var(--text-secondary)' }}>
                      {w.name.charAt(0)}
                    </span>
                  )}
                  <span>{w.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
