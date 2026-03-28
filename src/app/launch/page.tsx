'use client';
import { useState, useRef } from 'react';
import Navbar from '@/components/Navbar';
import ZkWorkOverlay from '@/components/ZkWorkOverlay';
import { PUBLIC_NETWORK_LABEL } from '@/lib/network';
import { useWallet } from '@/lib/wallet/WalletProvider';

export default function LaunchPage() {
  const { api, connected } = useWallet();
  const [step, setStep] = useState(0);
  const [deployBusy, setDeployBusy] = useState(false);
  const [deployPhase, setDeployPhase] = useState<'proving'|'signing'|'submitting'|'saving'>('proving');
  const [deployError, setDeployError] = useState<string | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ name:'', ticker:'', description:'', website:'', twitter:'', telegram:'', discord:'', initialBuy:'0' });
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const steps = ['Token info', 'Socials', 'Initial buy', 'Review'];

  const handleLaunch = async () => {
    if (deployBusy) return;
    if (!connected || !api) {
      setDeployError('Connect your wallet first.');
      return;
    }
    setDeployError(null);
    setDeployPhase('proving');
    setDeployBusy(true);
    try {
      const { deployBondingCurveViaWallet } = await import('@/lib/contractWiring');
      const result = await deployBondingCurveViaWallet({ name: form.name, ticker: form.ticker, description: form.description, imageUri: 'ipfs://' }, api, setDeployPhase);
      setDeployPhase('saving');
      await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: result.contractAddress, name: form.name, ticker: form.ticker, description: form.description, imageUri: 'ipfs://', creatorAddr: 'unknown', txHash: result.txId }),
      });
      window.location.href = '/token/' + result.contractAddress;
    } catch (err: unknown) {
      setDeployError(err instanceof Error ? err.message : 'Deploy failed');
    }
  };

  const Step = ({ n, label }: { n: number; label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
          flexShrink: 0,
          background: n < step ? 'var(--green)' : n === step ? 'var(--white)' : 'var(--bg-3)',
          color: n <= step ? '#000' : 'var(--t3)',
          border: `1px solid ${n < step ? 'var(--green)' : n === step ? 'var(--white)' : 'var(--b2)'}`,
        }}>
          {n < step ? '✓' : n + 1}
        </div>
        <span style={{ fontSize: 12, fontWeight: 500, color: n === step ? 'var(--t1)' : 'var(--t3)' }}>{label}</span>
      </div>
      {n < steps.length - 1 && (
        <div style={{ flex: 1, height: 1, margin: '0 10px', background: n < step ? 'var(--green)' : 'var(--b1)' }} />
      )}
    </div>
  );

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>
      {children}
    </label>
  );

  return (
    <div style={{ minHeight: '100vh' }}>
      <ZkWorkOverlay
        open={deployBusy}
        error={deployError}
        variant={deployPhase === 'saving' || deployPhase === 'submitting' ? 'saving' : 'proving'}
        title={deployPhase === 'saving' ? 'Finishing up' : deployPhase === 'submitting' ? 'Almost done' : deployPhase === 'signing' ? 'Preparing deploy' : 'Deploying your token'}
        subtitle={
          deployPhase === 'saving' ? 'Registering your token in the night.fun directory.' :
          deployPhase === 'submitting' ? 'Contract is live on Midnight. Saving token info.' :
          deployPhase === 'signing' ? 'Reading wallet identity.' :
          'Deploying bonding curve to Midnight. This takes 30–90 seconds.'
        }
        onDismiss={deployError ? () => { setDeployBusy(false); setDeployError(null); } : undefined}
      />
      <Navbar />

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 16px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div className="badge badge-white" style={{ marginBottom: 12 }}>Token factory</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6 }}>
            Launch on night.fun
          </h1>
          <p style={{ color: 'var(--t2)', fontSize: 13 }}>
            Deploy your bonding curve to {PUBLIC_NETWORK_LABEL}. 1B supply. 69k DUST graduation.
          </p>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', marginBottom: 28 }}>
          {steps.map((label, i) => <Step key={i} n={i} label={label} />)}
        </div>

        {/* Form card */}
        <div className="glass" style={{ padding: 24 }}>

          {step === 0 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Token information</h2>

              {/* Icon upload */}
              <div style={{ marginBottom: 18 }}>
                <Label>Token icon</Label>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `1px dashed ${iconPreview ? 'var(--b3)' : 'var(--b1)'}`,
                    borderRadius: 10, padding: 24, textAlign: 'center',
                    cursor: 'pointer', background: 'var(--bg-0)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    transition: 'border-color 0.12s',
                  }}
                >
                  {iconPreview ? (
                    <img src={iconPreview} alt="" style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover' }} />
                  ) : (
                    <>
                      <div style={{ width: 40, height: 40, background: 'var(--bg-3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--t3)' }}>
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                        </svg>
                      </div>
                      <span style={{ color: 'var(--t3)', fontSize: 12 }}>Click to upload image</span>
                      <span style={{ color: 'var(--t4)', fontSize: 11 }}>PNG, JPG, GIF up to 10MB</span>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { const r = new FileReader(); r.onload = ev => setIconPreview(typeof ev.target?.result === 'string' ? ev.target.result : null); r.readAsDataURL(f); }
                }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <Label>Name *</Label>
                  <input placeholder="Midnight Cat" value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div>
                  <Label>Ticker *</Label>
                  <input placeholder="MCAT" value={form.ticker} onChange={e => set('ticker', e.target.value.toUpperCase())} style={{ fontFamily: 'var(--font-mono)' }} />
                </div>
              </div>
              <div>
                <Label>Description *</Label>
                <textarea placeholder="Tell the world about your token…" value={form.description} onChange={e => set('description', e.target.value)} style={{ minHeight: 80 }} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 18 }}>Social links</h2>
              <p style={{ color: 'var(--t2)', fontSize: 12, marginBottom: 18 }}>All optional. Helps traders find and verify your project.</p>
              {[
                ['website',  'Website',  'https://yourtoken.xyz'],
                ['twitter',  'X / Twitter', 'https://x.com/yourtoken'],
                ['telegram', 'Telegram', 'https://t.me/yourtoken'],
                ['discord',  'Discord',  'https://discord.gg/yourtoken'],
              ].map(([k, label, ph]) => (
                <div key={k} style={{ marginBottom: 14 }}>
                  <Label>{label}</Label>
                  <input type="url" placeholder={ph} value={form[k as keyof typeof form]} onChange={e => set(k, e.target.value)} />
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Initial buy</h2>
              <p style={{ color: 'var(--t2)', fontSize: 12, marginBottom: 18 }}>Optionally buy your own token at launch to set a starting price.</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
                {['0', '50', '100', '500', '1000'].map(v => (
                  <button key={v} onClick={() => set('initialBuy', v)} style={{
                    padding: '7px 14px',
                    background: form.initialBuy === v ? 'var(--bg-3)' : 'var(--bg-2)',
                    border: `1px solid ${form.initialBuy === v ? 'var(--b3)' : 'var(--b1)'}`,
                    borderRadius: 7, cursor: 'pointer',
                    color: form.initialBuy === v ? 'var(--white)' : 'var(--t2)',
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    transition: 'all 0.1s',
                  }}>
                    {v === '0' ? 'None' : `${v} DUST`}
                  </button>
                ))}
              </div>
              <div style={{ background: 'var(--bg-0)', border: '1px solid var(--b1)', borderRadius: 8, padding: '14px 16px' }}>
                {[
                  ['Protocol fee', 'FREE', 'var(--green)'],
                  ['Network fee', '~6 DUST', 'var(--t2)'],
                  ['Initial buy', `${form.initialBuy || '0'} DUST`, 'var(--t2)'],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>{l}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: c }}>{v}</span>
                  </div>
                ))}
                <div className="divider" style={{ margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Total</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
                    {(6 + Number(form.initialBuy || 0)).toLocaleString()} DUST
                  </span>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Review & launch</h2>
              <div style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'flex-start' }}>
                {iconPreview && (
                  <img src={iconPreview} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--b2)', flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>{form.name || '—'}</span>
                    <span className="badge badge-white">${form.ticker || '—'}</span>
                  </div>
                  <p style={{ color: 'var(--t2)', fontSize: 12, lineHeight: 1.5 }}>{form.description || '—'}</p>
                </div>
              </div>

              <div style={{ background: 'var(--bg-0)', border: '1px solid var(--b1)', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
                {[
                  ['Total supply', '1,000,000,000'],
                  ['Graduation', '69,000 DUST'],
                  ['Trade fee', '1%'],
                  ['Network', `Midnight ${PUBLIC_NETWORK_LABEL}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>{k}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t2)' }}>{v}</span>
                  </div>
                ))}
              </div>

              {deployError && (
                <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '10px 12px', marginBottom: 14, color: 'var(--red)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  {deployError}
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', height: 44, fontSize: 14 }}
                onClick={handleLaunch}
                disabled={deployBusy}
              >
                {deployBusy ? 'Working…' : `Launch ${form.ticker || 'token'} on ${PUBLIC_NETWORK_LABEL}`}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--b0)' }}>
            <button className="btn btn-secondary" onClick={() => setStep(s => Math.max(0, s - 1))} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>
              Back
            </button>
            {step < 3 && (
              <button
                className="btn btn-primary"
                onClick={() => setStep(s => s + 1)}
                disabled={step === 0 && !(form.name && form.ticker && form.description)}
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
