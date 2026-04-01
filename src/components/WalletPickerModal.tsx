'use client';

import { useEffect, useCallback, useState } from 'react';
import { useWallet, type DetectedWallet } from '@/lib/wallet/WalletProvider';

export default function WalletPickerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { connect, getAvailableWallets } = useWallet();
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);

  useEffect(() => {
    if (open) setWallets(getAvailableWallets());
  }, [open, getAvailableWallets]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSelect = (id: string) => {
    onClose();
    void connect(id);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-picker-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          borderRadius: 'var(--radius-lg)',
          padding: '28px 28px 24px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2
            id="wallet-picker-title"
            style={{
              fontFamily: 'var(--font)',
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Connect Wallet
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {wallets.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            No Midnight wallets detected. Install a compatible wallet extension to continue.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {wallets.map(w => (
              <button
                key={w.id}
                type="button"
                onClick={() => handleSelect(w.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  fontSize: 15,
                  fontWeight: 600,
                  transition: 'var(--transition-fast)',
                  width: '100%',
                  textAlign: 'left',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                  e.currentTarget.style.background = 'var(--bg-main)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                }}
              >
                {w.icon && (
                  <img
                    src={w.icon}
                    alt=""
                    width={28}
                    height={28}
                    style={{ borderRadius: 6, objectFit: 'contain' }}
                  />
                )}
                <span>{w.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
