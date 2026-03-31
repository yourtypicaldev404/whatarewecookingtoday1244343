'use client';
import { useState, useRef } from 'react';
import ZkWorkOverlay from '@/components/ZkWorkOverlay';
import { PUBLIC_NETWORK_LABEL } from '@/lib/network';
import { useWallet } from '@/lib/wallet/WalletProvider';

const STEPS = ['Token info', 'Socials', 'Initial buy', 'Review'];

export default function LaunchPage() {
  const { api, connected } = useWallet();
  const [step, setStep] = useState(0);
  const [deployBusy, setDeployBusy] = useState(false);
  const [deployPhase, setDeployPhase] = useState<'proving'|'signing'|'submitting'|'saving'>('proving');
  const [deployError, setDeployError] = useState<string | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name:'', ticker:'', description:'', website:'', twitter:'', telegram:'', discord:'', initialBuy:'0' });
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const uploadImage = async (file: File): Promise<string> => {
    const buf = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, mimeType: file.type, base64 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Image upload failed');
    }
    const { ipfsUrl } = await res.json();
    return ipfsUrl; // e.g. "ipfs://QmXXX"
  };

  const handleLaunch = async () => {
    if (deployBusy) return;
    if (!connected || !api) { setDeployError('Connect your wallet first.'); return; }
    setDeployError(null); setDeployPhase('proving'); setDeployBusy(true);
    try {
      // Upload image first if one was selected
      let imageUri = 'ipfs://';
      if (iconFile) {
        try {
          imageUri = await uploadImage(iconFile);
        } catch (e: any) {
          console.warn('Image upload failed, continuing without image:', e.message);
        }
      }

      const { deployBondingCurveViaWallet } = await import('@/lib/contractWiring');
      const result = await deployBondingCurveViaWallet({ name: form.name, ticker: form.ticker, description: form.description, imageUri }, api, setDeployPhase);
      setDeployPhase('saving');
      await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: result.contractAddress, name: form.name, ticker: form.ticker, description: form.description, imageUri, creatorAddr: 'unknown', txHash: result.txId }),
      });
      window.location.href = '/token/' + result.contractAddress;
    } catch (err: unknown) {
      setDeployError(err instanceof Error ? err.message : 'Deploy failed');
    }
  };

  const L = ({ children }: { children: React.ReactNode }) => (
    <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>{children}</label>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <ZkWorkOverlay
        open={deployBusy} error={deployError}
        variant={deployPhase === 'saving' || deployPhase === 'submitting' ? 'saving' : 'proving'}
        title={deployPhase === 'saving' ? 'Finishing up' : deployPhase === 'submitting' ? 'Almost done' : deployPhase === 'signing' ? 'Preparing deploy' : 'Deploying your token'}
        subtitle={deployPhase === 'saving' ? 'Registering your token.' : deployPhase === 'submitting' ? 'Contract is live. Saving.' : deployPhase === 'signing' ? 'Reading wallet identity.' : 'Deploying bonding curve to Midnight. 30-90 seconds.'}
        onDismiss={deployError ? () => { setDeployBusy(false); setDeployError(null); } : undefined}
      />

      <div style={{ maxWidth: 728, margin: '0 auto', padding: '62px 31px 104px' }}>

        {/* Header */}
        <div style={{ marginBottom: 42 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16 }}>Token factory</div>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8, fontFamily: 'var(--font)', color: 'var(--text-primary)' }}>Launch a new token</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 17 }}>
            Deploy to {PUBLIC_NETWORK_LABEL} · 1B supply · 69k NIGHT graduation
          </p>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 36 }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, flexShrink: 0,
                  background: i < step ? 'var(--primary-color)' : i === step ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                  color: i <= step ? 'var(--bg-main)' : 'var(--text-tertiary)',
                  border: `1px solid ${i < step ? 'var(--primary-color)' : i === step ? 'var(--text-primary)' : 'var(--border-color)'}`,
                  transition: 'all 0.2s',
                }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 16, fontWeight: i === step ? 600 : 400, color: i === step ? 'var(--text-primary)' : 'var(--text-tertiary)', transition: 'color 0.15s' }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, margin: '0 13px', background: i < step ? 'var(--primary-color)' : 'var(--border-color)', transition: 'background 0.2s' }} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 36 }}>

          {/* Step 0 — Token info */}
          {step === 0 && (
            <div>
              <div style={{ marginBottom: 29 }}>
                <L>Token icon</L>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `1px dashed ${iconPreview ? 'var(--border-color-hover)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)', padding: 31, cursor: 'pointer',
                    background: 'var(--bg-main)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    transition: 'border-color 0.15s',
                  }}
                >
                  {iconPreview ? (
                    <img src={iconPreview} alt="" style={{ width: 104, height: 104, borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
                  ) : (
                    <>
                      <div style={{ width: 52, height: 52, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-tertiary)' }}>
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                        </svg>
                      </div>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>Upload image</span>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setIconFile(f); const r = new FileReader(); r.onload = ev => setIconPreview(typeof ev.target?.result === 'string' ? ev.target.result : null); r.readAsDataURL(f); }}} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
                <div><L>Name *</L><input placeholder="Midnight Cat" value={form.name} onChange={e => set('name', e.target.value)} /></div>
                <div><L>Ticker *</L><input placeholder="MCAT" value={form.ticker} onChange={e => set('ticker', e.target.value.toUpperCase())} style={{ fontFamily: 'var(--mono)' }} /></div>
              </div>
              <div><L>Description *</L><textarea placeholder="Tell the world about your token..." value={form.description} onChange={e => set('description', e.target.value)} style={{ minHeight: 117 }} /></div>
            </div>
          )}

          {/* Step 1 — Socials */}
          {step === 1 && (
            <div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 16, marginBottom: 26 }}>All optional. Helps traders verify your project.</p>
              {[['website','Website','https://yourtoken.xyz'],['twitter','X / Twitter','https://x.com/yourtoken'],['telegram','Telegram','https://t.me/yourtoken'],['discord','Discord','https://discord.gg/yourtoken']].map(([k, label, ph]) => (
                <div key={k} style={{ marginBottom: 18 }}>
                  <L>{label}</L>
                  <input type="url" placeholder={ph} value={form[k as keyof typeof form]} onChange={e => set(k, e.target.value)} />
                </div>
              ))}
            </div>
          )}

          {/* Step 2 — Initial buy */}
          {step === 2 && (
            <div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 16, marginBottom: 23 }}>Optionally buy your own token at launch to set a starting price.</p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 29, flexWrap: 'wrap' }}>
                {['0','50','100','500','1000'].map(v => (
                  <button key={v} onClick={() => set('initialBuy', v)} style={{
                    padding: '10px 21px',
                    background: form.initialBuy === v ? 'var(--bg-4)' : 'var(--bg-main)',
                    border: `1px solid ${form.initialBuy === v ? 'var(--border-color-hover)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    color: form.initialBuy === v ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontFamily: 'var(--mono)', fontSize: 16, transition: 'var(--transition-fast)',
                  }}>
                    {v === '0' ? 'None' : `${v} NIGHT`}
                  </button>
                ))}
              </div>
              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '18px 21px' }}>
                {[['Protocol fee','FREE','var(--primary-color)'],['Network fee','~6 NIGHT','var(--text-secondary)'],['Initial buy',`${form.initialBuy || '0'} NIGHT`,'var(--text-secondary)']].map(([l,v,c])=>(
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 16, color:'var(--text-tertiary)' }}>{l}</span>
                    <span style={{ fontFamily:'var(--mono)', fontSize: 16, color:c }}>{v}</span>
                  </div>
                ))}
                <div className="divider" style={{ margin:'13px 0' }} />
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: 17 }}>Total</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize: 17, fontWeight: 700 }}>{(6+Number(form.initialBuy||0)).toLocaleString()} NIGHT</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Review */}
          {step === 3 && (
            <div>
              <div style={{ display:'flex', gap: 18, marginBottom: 29, alignItems:'flex-start' }}>
                {iconPreview && <img src={iconPreview} alt="" style={{ width: 83, height: 83, borderRadius: 'var(--radius-md)', objectFit:'cover', border:'1px solid var(--border-color)', flexShrink: 0 }} />}
                <div>
                  <div style={{ display:'flex', gap: 10, alignItems:'center', marginBottom: 7 }}>
                    <span style={{ fontWeight: 700, fontSize: 26 }}>{form.name||'—'}</span>
                    <span className="badge badge-white">${form.ticker||'—'}</span>
                  </div>
                  <p style={{ color:'var(--text-tertiary)', fontSize: 16, lineHeight: 1.5 }}>{form.description||'—'}</p>
                </div>
              </div>
              <div style={{ background:'var(--bg-main)', border:'1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding:'17px 21px', marginBottom: 26 }}>
                {[['Total supply','1,000,000,000'],['Graduation','69,000 NIGHT'],['Trade fee','1%'],['Network',`Midnight ${PUBLIC_NETWORK_LABEL}`]].map(([k,v])=>(
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom: 9 }}>
                    <span style={{ fontSize: 16, color:'var(--text-tertiary)' }}>{k}</span>
                    <span style={{ fontFamily:'var(--mono)', fontSize: 16, color:'var(--text-secondary)' }}>{v}</span>
                  </div>
                ))}
              </div>
              {deployError && (
                <div style={{ background: 'rgba(var(--danger-rgb),0.06)', border:'1px solid rgba(var(--danger-rgb),0.2)', borderRadius: 'var(--radius-sm)', padding:'13px 18px', marginBottom: 21, color:'var(--danger)', fontSize: 16, fontFamily:'var(--mono)' }}>
                  {deployError}
                </div>
              )}
              <button type="button" className="btn btn-primary" style={{ width:'100%', height: 62, fontSize: 18, borderRadius: 'var(--radius-lg)' }} onClick={handleLaunch} disabled={deployBusy}>
                {deployBusy ? 'Working...' : `Launch ${form.ticker || 'token'} on ${PUBLIC_NETWORK_LABEL}`}
              </button>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop: 31, paddingTop: 23, borderTop:'1px solid var(--border-color)' }}>
            <button className="btn btn-secondary" onClick={()=>setStep(s=>Math.max(0,s-1))} style={{ visibility: step===0?'hidden':'visible' }}>Back</button>
            {step < 3 && (
              <button className="btn btn-primary" onClick={()=>setStep(s=>s+1)} disabled={step===0&&!(form.name&&form.ticker&&form.description)}>
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
