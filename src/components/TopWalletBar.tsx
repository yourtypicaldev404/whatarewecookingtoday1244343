'use client';

import { useState, useRef, useEffect } from 'react';
import { useWallet, shortAddr } from '@/lib/wallet/WalletProvider';
import type { DetectedWallet } from '@/lib/wallet/WalletProvider';

export default function TopWalletBar() {
  const { connected, connecting, connect, disconnect, unshieldedAddr, walletId, getAvailableWallets } = useWallet();
  const [showPicker, setShowPicker] = useState(false);
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
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

    if (detected.length === 0) {
      // No wallets — trigger connect to show error
      void connect();
      return;
    }
    if (detected.length === 1) {
      // Only one wallet — connect directly
      void connect(detected[0].id);
      return;
    }
    // Multiple wallets — show picker
    setShowPicker(true);
  };

  const handlePickWallet = (id: string) => {
    setShowPicker(false);
    void connect(id);
  };

  return (
    <div className="top-wallet-bar">
      {connected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="pulse-dot" />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
            {walletId ? `${walletId === 'mnLace' ? 'Lace' : walletId === '1am' ? '1AM' : walletId} · ` : ''}
            {shortAddr(unshieldedAddr)}
          </span>
          <button
            type="button"
            onClick={disconnect}
            className="top-wallet-btn connected"
          >
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
                <button
                  key={w.id}
                  type="button"
                  className="wallet-picker-item"
                  onClick={() => handlePickWallet(w.id)}
                >
                  <span style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    {w.name.charAt(0)}
                  </span>
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
