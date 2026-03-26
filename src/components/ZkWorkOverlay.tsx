'use client';

import type { TradeBuildProfile } from '@/lib/contractWiring';

/**
 * In-page blocking UI for long ZK / server work (no browser alert() / Notification).
 */
export default function ZkWorkOverlay({
  open,
  title = 'Creating ZK proof…',
  subtitle = 'This can take 30–90 seconds. Keep this tab open.',
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
  /** proving = spinner + indeterminate bar; saving = same with different copy */
  variant?: 'proving' | 'saving' | 'trade';
  /** For variant trade: server = remote prove; wallet = Lace balance + submit */
  tradePhase?: 'server' | 'wallet';
  /** Shown during wallet phase — proof step already finished on server */
  tradeProfile?: TradeBuildProfile | null;
}) {
  if (!open) return null;

  const isError = Boolean(error);

  const tradeTitle =
    variant === 'trade'
      ? tradePhase === 'wallet'
        ? 'Approve in Lace'
        : 'Generating ZK proof…'
      : title;

  const tradeSubtitle =
    variant === 'trade'
      ? tradePhase === 'wallet'
        ? 'Balance fees, sign, and submit. This step is quick once you approve in the wallet.'
        : 'Building the transaction on the server and running the ZK prover. This is usually the slow part (often 30–90s). Keep this tab open.'
      : variant === 'saving'
        ? subtitle
        : subtitle;

  const profileLine =
    variant === 'trade' && tradePhase === 'wallet' && tradeProfile
      ? `Proof: ${(tradeProfile.proveMs / 1000).toFixed(1)}s · Setup: ${(
          (tradeProfile.createUnprovenMs + tradeProfile.publicStatesMs) /
          1000
        ).toFixed(1)}s`
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
        background: 'rgba(3, 4, 8, 0.85)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          padding: '32px 28px',
          borderRadius: 16,
          background: 'linear-gradient(165deg, rgba(22,22,32,0.98) 0%, rgba(10,10,16,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          textAlign: 'center',
        }}
      >
        {!isError ? (
          <>
            <div className="zk-spinner" aria-hidden style={{ margin: '0 auto 20px' }} />
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 19,
                color: '#fff',
                marginBottom: 10,
                lineHeight: 1.3,
              }}
            >
              {variant === 'trade' ? tradeTitle : title}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: profileLine ? 8 : 22 }}>
              {variant === 'trade' ? tradeSubtitle : subtitle}
            </p>
            {profileLine ? (
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 22,
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
            <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden>⚠️</div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 18,
                color: '#fca5a5',
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
                marginBottom: 20,
                wordBreak: 'break-word',
              }}
            >
              {error}
            </p>
            {onDismiss ? (
              <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={onDismiss}>
                Close
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
