'use client';

import { useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/wallet/WalletProvider';
import { getWalletErrorPresentation } from '@/lib/wallet/walletErrorPresentation';
import { getLaceExtensionStoreUrl } from '@/lib/wallet/laceStoreUrl';

/**
 * Soft overlay for all wallet errors (network mismatch, install, rejection, etc.).
 * Rendered once inside WalletProvider.
 */
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
        background: 'rgba(3, 4, 8, 0.72)',
        backdropFilter: 'blur(12px)',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 16,
          padding: '28px 26px 22px',
          background: 'linear-gradient(165deg, rgba(22,22,32,0.98) 0%, rgba(10,10,16,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(139,92,246,0.12)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
          <h2
            id="wallet-error-title"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: '-0.03em',
              color: '#fff',
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
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
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
            fontSize: 15,
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
            margin: '0 0 22px',
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
                padding: '10px 18px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                color: '#e8e6f0',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              Get Lace
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 22px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, var(--neon-violet), #6d28d9)',
              color: '#fff',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
