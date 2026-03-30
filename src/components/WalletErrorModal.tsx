'use client';

import { useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/wallet/WalletProvider';
import { getWalletErrorPresentation } from '@/lib/wallet/walletErrorPresentation';
import { getLaceExtensionStoreUrl } from '@/lib/wallet/laceStoreUrl';

export default function WalletErrorModal() {
  const { error, clearWalletError } = useWallet();

  const onClose = useCallback(() => {
    clearWalletError();
  }, [clearWalletError]);

  useEffect(() => {
    if (!error) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [error, onClose]);

  if (!error) return null;

  const { title, body, variant } = getWalletErrorPresentation(error);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-error-title"
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
          maxWidth: 460,
          borderRadius: 'var(--radius-lg)',
          padding: '28px 28px 24px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
          <h2
            id="wallet-error-title"
            style={{
              fontFamily: 'var(--font)',
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.25,
            }}
          >
            {variant === 'network' && '⚠️ '}
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <p
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
            margin: '0 0 24px',
          }}
        >
          {body}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
          {variant === 'install' ? (
            <a
              href={getLaceExtensionStoreUrl()}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '10px 20px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font)',
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                border: '1px solid var(--border-color)',
              }}
            >
              Get 1AM Wallet
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius-md)',
              height: 'auto',
              fontSize: 14,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
