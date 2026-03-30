'use client';

import type { TradeBuildProfile } from '@/lib/contractWiring';

export default function ZkWorkOverlay({
  open,
  title = 'Creating ZK proof...',
  subtitle = 'This can take 30-90 seconds. Keep this tab open.',
  error,
  onDismiss,
  variant = 'proving',
  tradePhase = 'server',
  tradeProfile,
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  error?: string | null;
  onDismiss?: () => void;
  variant?: 'proving' | 'saving' | 'trade';
  tradePhase?: 'server' | 'wallet';
  tradeProfile?: TradeBuildProfile | null;
}) {
  if (!open) return null;

  const isError = Boolean(error);

  const tradeTitle =
    variant === 'trade'
      ? tradePhase === 'wallet'
        ? 'Approve in Lace'
        : 'Generating ZK proof...'
      : title;

  const tradeSubtitle =
    variant === 'trade'
      ? tradePhase === 'wallet'
        ? 'Balance fees, sign, and submit. This step is quick once you approve in the wallet.'
        : 'Building the transaction on the server and running the ZK prover. This is usually the slow part (often 30-90s). Keep this tab open.'
      : subtitle;

  const profileLine =
    variant === 'trade' && tradePhase === 'wallet' && tradeProfile
      ? `Built in ${(tradeProfile.createUnprovenMs / 1000).toFixed(1)}s · server ${(tradeProfile.serverTotalMs / 1000).toFixed(1)}s`
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 450,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '36px 32px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.5)',
          textAlign: 'center',
        }}
      >
        {!isError ? (
          <>
            <div className="zk-spinner" aria-hidden style={{ margin: '0 auto 22px' }} />
            <h2
              style={{
                fontFamily: 'var(--font)',
                fontWeight: 700,
                fontSize: 20,
                color: 'var(--text-primary)',
                marginBottom: 10,
                lineHeight: 1.3,
              }}
            >
              {variant === 'trade' ? tradeTitle : title}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: profileLine ? 8 : 24 }}>
              {variant === 'trade' ? tradeSubtitle : subtitle}
            </p>
            {profileLine ? (
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--mono)',
                  marginBottom: 24,
                  lineHeight: 1.4,
                }}
              >
                {profileLine}
              </p>
            ) : null}
            <div className="zk-progress-track">
              <div className="zk-progress-indeterminate" />
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 44, marginBottom: 14 }} aria-hidden>⚠️</div>
            <h2
              style={{
                fontFamily: 'var(--font)',
                fontWeight: 700,
                fontSize: 18,
                color: 'var(--danger)',
                marginBottom: 12,
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: 22,
                wordBreak: 'break-word',
              }}
            >
              {error}
            </p>
            {onDismiss ? (
              <button type="button" className="btn btn-primary" style={{ width: '100%', height: 'var(--btn-h-md)', borderRadius: 'var(--radius-lg)' }} onClick={onDismiss}>
                Close
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
