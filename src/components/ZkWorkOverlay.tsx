'use client';

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
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  error?: string | null;
  onDismiss?: () => void;
  /** proving = spinner + indeterminate bar; saving = same with different copy */
  variant?: 'proving' | 'saving' | 'trade';
}) {
  if (!open) return null;

  const isError = Boolean(error);

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
              {variant === 'trade' ? 'Signing & proving…' : title}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 22 }}>
              {variant === 'trade'
                ? 'Creating the ZK proof and submitting through the network. Do not close this tab.'
                : variant === 'saving'
                  ? 'Saving your token to the registry…'
                  : subtitle}
            </p>
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
