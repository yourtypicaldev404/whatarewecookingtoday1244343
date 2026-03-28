'use client';
import { useState, useRef } from 'react';
import Navbar from '@/components/Navbar';
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
  const [form, setForm] = useState({ name:'', ticker:'', description:'', website:'', twitter:'', telegram:'', discord:'', initialBuy:'0' });
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleLaunch = async () => {
    if (deployBusy) return;
    if (!connected || !api) { setDeployError('Connect your wallet first.'); return; }
    setDeployError(null); setDeployPhase('proving'); setDeployBusy(true);
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

  const L = ({ children }: { children: React.ReactNode }) => (
    <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>{children}</label>
  );

  return (
    <div style={{ minHeight: '100vh' }}>
      <ZkWorkOverlay
        open={deployBusy} error={deployError}
        variant={deployPhase === 'saving' || deployPhase === 'submitting' ? 'saving' : 'proving'}
        title={deployPhase === 'saving' ? 'Finishing up' : deployPhase === 'submitting' ? 'Almost done' : deployPhase === 'signing' ? 'Preparing deploy' : 'Deploying your token'}
        subtitle={deployPhase === 'saving' ? 'Registering your token.' : deployPhase === 'submitting' ? 'Contract is live. Saving.' : deployPhase === 'signing' ? 'Reading wallet identity.' : 'Deploying bonding curve to Midnight. 30–90 seconds.'}
        onDismiss={deployError ? () => { setDeployBusy(false); setDeployError(null); } : undefined}
      />
      <Navbar />

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>Token factory</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 5, fontFamily: 'var(--font)' }}>Launch a new token</h1>
          <p style={{ color: 'var(--t3)', fontSize: 12 }}>
            Deploy to {PUBLIC_NETWORK_LABEL} · 1B supply · 69k DUST graduation
          </p>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, flexShrink: 0,
                  background: i < step ? 'var(--green)' : i === step ? 'var(--t1)' : 'var(--bg-3)',
                  color: i <= step ? '#000' : 'var(--t3)',
                  border: `1px solid ${i < step ? 'var(--green)' : i === step ? 'var(--t1)' : 'var(--b2)'}`,
                  transition: 'all 0.15s',
                }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, fontWeight: i === step ? 600 : 400, color: i === step ? 'var(--t1)' : 'var(--t3)', transition: 'color 0.15s' }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, margin: '0 8px', background: i < step ? 'var(--green)' : 'var(--b1)', transition: 'background 0.15s' }} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--b1)', borderRadius: 8, padding: 24 }}>

          {/* Step 0 — Token info */}
          {step === 0 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <L>Token icon</L>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `1px dashed ${iconPreview ? 'var(--b3)' : 'var(--b1)'}`,
                    borderRadius: 8, padding: 20, cursor: 'pointer',
                    background: 'var(--bg-0)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    transition: 'border-color 0.12s',
                  }}
                >
                  {iconPreview ? (
                    <img src={iconPreview} alt="" style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover' }} />
                  ) : (
                    <>
                      <div style={{ width: 36, height: 36, background: 'var(--bg-3)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--t3)' }}>
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                        </svg>
                      </div>
                      <span style={{ color: 'var(--t3)', fontSize: 11 }}>Upload image</span>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setIconPreview(typeof ev.target?.result === 'string' ? ev.target.result : null); r.readAsDataURL(f); }}} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><L>Name *</L><input placeholder="Midnight Cat" value={form.name} onChange={e => set('name', e.target.value)} /></div>
                <div><L>Ticker *</L><input placeholder="MCAT" value={form.ticker} onChange={e => set('ticker', e.target.value.toUpperCase())} style={{ fontFamily: 'var(--mono)' }} /></div>
              </div>
              <div><L>Description *</L><textarea placeholder="Tell the world about your token…" value={form.description} onChange={e => set('description', e.target.value)} style={{ minHeight: 80 }} /></div>
            </div>
          )}

          {/* Step 1 — Socials */}
          {step === 1 && (
            <div>
              <p style={{ color: 'var(--t3)', fontSize: 11, marginBottom: 18 }}>All optional. Helps traders verify your project.</p>
              {[['website','Website','https://yourtoken.xyz'],['twitter','X / Twitter','https://x.com/yourtoken'],['telegram','Telegram','https://t.me/yourtoken'],['discord','Discord','https://discord.gg/yourtoken']].map(([k, label, ph]) => (
                <div key={k} style={{ marginBottom: 12 }}>
                  <L>{label}</L>
                  <input type="url" placeholder={ph} value={form[k as keyof typeof form]} onChange={e => set(k, e.target.value)} />
                </div>
              ))}
            </div>
          )}

          {/* Step 2 — Initial buy */}
          {step === 2 && (
            <div>
              <p style={{ color: 'var(--t3)', fontSize: 11, marginBottom: 16 }}>Optionally buy your own token at launch to set a starting price.</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
                {['0','50','100','500','1000'].map(v => (
                  <button key={v} onClick={() => set('initialBuy', v)} style={{
                    padding: '6px 13px',
                    background: form.initialBuy === v ? 'var(--bg-4)' : 'var(--bg-2)',
                    border: `1px solid ${form.initialBuy === v ? 'var(--b3)' : 'var(--b1)'}`,
                    borderRadius: 5, cursor: 'pointer',
                    color: form.initialBuy === v ? 'var(--t1)' : 'var(--t3)',
                    fontFamily: 'var(--mono)', fontSize: 11, transition: 'all 0.1s',
                  }}>
                    {v === '0' ? 'None' : `${v} DUST`}
                  </button>
                ))}
              </div>
              <div style={{ background: 'var(--bg-0)', border: '1px solid var(--b0)', borderRadius: 6, padding: '12px 14px' }}>
                {[['Protocol fee','FREE','var(--green)'],['Network fee','~6 DUST','var(--t2)'],['Initial buy',`${form.initialBuy || '0'} DUST`,'var(--t2)']].map(([l,v,c])=>(
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
                    <span style={{ fontSize:11, color:'var(--t3)' }}>{l}</span>
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:c }}>{v}</span>
                  </div>
                ))}
                <div className="divider" style={{ margin:'8px 0' }} />
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontWeight:600, fontSize:12 }}>Total</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:700 }}>{(6+Number(form.initialBuy||0)).toLocaleString()} DUST</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Review */}
          {step === 3 && (
            <div>
              <div style={{ display:'flex', gap:12, marginBottom:20, alignItems:'flex-start' }}>
                {iconPreview && <img src={iconPreview} alt="" style={{ width:56, height:56, borderRadius:8, objectFit:'cover', border:'1px solid var(--b2)', flexShrink:0 }} />}
                <div>
                  <div style={{ display:'flex', gap:7, alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontWeight:700, fontSize:18 }}>{form.name||'—'}</span>
                    <span className="badge badge-white">${form.ticker||'—'}</span>
                  </div>
                  <p style={{ color:'var(--t3)', fontSize:11, lineHeight:1.5 }}>{form.description||'—'}</p>
                </div>
              </div>
              <div style={{ background:'var(--bg-0)', border:'1px solid var(--b0)', borderRadius:6, padding:'11px 13px', marginBottom:18 }}>
                {[['Total supply','1,000,000,000'],['Graduation','69,000 DUST'],['Trade fee','1%'],['Network',`Midnight ${PUBLIC_NETWORK_LABEL}`]].map(([k,v])=>(
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:11, color:'var(--t3)' }}>{k}</span>
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--t2)' }}>{v}</span>
                  </div>
                ))}
              </div>
              {deployError && (
                <div style={{ background:'var(--red-bg)', border:'1px solid rgba(255,77,106,0.2)', borderRadius:5, padding:'8px 12px', marginBottom:14, color:'var(--red)', fontSize:11, fontFamily:'var(--mono)' }}>
                  {deployError}
                </div>
              )}
              <button type="button" className="btn btn-primary" style={{ width:'100%', height:40, fontSize:13 }} onClick={handleLaunch} disabled={deployBusy}>
                {deployBusy ? 'Working…' : `Launch ${form.ticker || 'token'} on ${PUBLIC_NETWORK_LABEL}`}
              </button>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:20, paddingTop:16, borderTop:'1px solid var(--b0)' }}>
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
