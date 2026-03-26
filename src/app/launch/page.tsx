'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function LaunchPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ name:'', ticker:'', description:'', website:'', twitter:'', telegram:'', discord:'', initialBuy:'0' });
  const fileRef = useRef(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const steps = ['Token info','Socials','Initial buy','Launch'];


  const handleLaunch = async () => {
    if (typeof window === "undefined" || !window.midnight) {
      alert("Please install and connect Lace wallet");
      return;
    }
    try {
      const wallets = Object.values(window.midnight);
      if (!wallets.length) { alert("No Midnight wallet found"); return; }
      const api = await wallets[0].connect("preprod");
      const config = await api.getConfiguration();
      const { deployBondingCurveViaWallet } = await import("@/lib/contractWiring");
      const treasuryKey = process.env.NEXT_PUBLIC_TREASURY_PK ?? "0".repeat(64);
      const creatorKey = crypto.randomUUID().replace(/-/g,"").padEnd(64,"0");
      if (deploying) return;
      setDeploying(true);
      alert("Generating ZK proof and deploying... this takes ~30 seconds");
      const result = await deployBondingCurveViaWallet({
        name: form.name,
        ticker: form.ticker,
        description: form.description,
        imageUri: "ipfs://",
      });
      alert("Deployed! Contract: " + result.contractAddress);
      await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: result.contractAddress,
          name: form.name,
          ticker: form.ticker,
          description: form.description,
          imageUri: "ipfs://",
          creatorAddr: "unknown",
          txHash: result.txId,
        }),
      });
      window.location.href = "/token/" + result.contractAddress;
    } catch (err: any) {
      alert("Deploy failed: " + err.message);
    }
  };

  return (
    <div style={{ minHeight:'100vh', paddingTop:56 }}>
      <Navbar />
      <div className="container" style={{ maxWidth:680, paddingTop:40, paddingBottom:80 }}>
        <div style={{ marginBottom:28 }}>
          <span className="badge badge-violet">🚀 Token factory</span>
          <h1 style={{ fontSize:30, fontWeight:800, letterSpacing:'-0.03em', margin:'10px 0 6px' }}>
            Launch on <span className="gradient-text">night.fun</span>
          </h1>
          <p style={{ color:'var(--text-secondary)', fontSize:14 }}>Deploy your bonding curve to Preprod. 1B supply. ₾69k graduation.</p>
        </div>

        <div style={{ display:'flex', marginBottom:28 }}>
          {steps.map((label, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700, flexShrink:0, background: i < step ? 'rgba(74,222,128,.15)' : i===step ? 'var(--neon-violet)' : 'var(--night-raised)', border:`2px solid ${i < step ? 'rgba(74,222,128,.4)' : i===step ? 'var(--neon-violet)' : 'var(--night-border)'}`, color: i < step ? 'var(--neon-green)' : i===step ? '#fff' : 'var(--text-muted)' }}>
                  {i < step ? '✓' : i+1}
                </div>
                <span style={{ fontSize:12, fontWeight:500, color: i===step ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
              </div>
              {i < steps.length-1 && <div style={{ flex:1, height:1, margin:'0 8px', background: i < step ? 'rgba(74,222,128,.3)' : 'var(--night-border)' }} />}
            </div>
          ))}
        </div>

        <div className="glass" style={{ padding:28 }}>
          {step === 0 && (
            <div>
              <h2 style={{ fontSize:18, marginBottom:20 }}>Token information</h2>
              <div style={{ marginBottom:18 }}>
                <label style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>Token icon</label>
                <div onClick={() => fileRef.current?.click()} style={{ border:`2px dashed ${preview ? 'var(--neon-violet)' : 'var(--night-border)'}`, borderRadius:12, padding:28, textAlign:'center', cursor:'pointer', background:'var(--night-deep)', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                  {preview ? <img src={preview} style={{ width:88, height:88, borderRadius:14, objectFit:'cover' }} /> : <><div style={{ fontSize:36 }}>🌙</div><div style={{ color:'var(--text-secondary)', fontSize:13 }}>Click to upload</div></>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={e => { const f=e.target.files?.[0]; if(f){const r=new FileReader();r.onload=ev=>setPreview(ev.target?.result);r.readAsDataURL(f);}}} style={{ display:'none' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                <div>
                  <label style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>Name *</label>
                  <input placeholder="Midnight Cat" value={form.name} onChange={e=>set('name',e.target.value)} />
                </div>
                <div>
                  <label style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>Ticker *</label>
                  <input placeholder="MCAT" value={form.ticker} onChange={e=>set('ticker',e.target.value.toUpperCase())} style={{ fontFamily:'var(--font-mono)' }} />
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>Description *</label>
                <textarea placeholder="Tell the world…" value={form.description} onChange={e=>set('description',e.target.value)} style={{ minHeight:88, resize:'vertical' }} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 style={{ fontSize:18, marginBottom:16 }}>Social links</h2>
              {[['website','Website','🌐','https://yourtoken.xyz'],['twitter','X/Twitter','𝕏','https://x.com/yourtoken'],['telegram','Telegram','✈️','https://t.me/yourtoken'],['discord','Discord','💬','https://discord.gg/yourtoken']].map(([k,label,icon,ph]) => (
                <div key={k} style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>{icon} {label}</label>
                  <input type="url" placeholder={ph} value={form[k]} onChange={e=>set(k,e.target.value)} />
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontSize:18, marginBottom:8 }}>Initial buy</h2>
              <p style={{ color:'var(--text-secondary)', fontSize:13, marginBottom:18 }}>Buy your own token at launch. Sets starting price.</p>
              <div style={{ display:'flex', gap:7, marginBottom:14, flexWrap:'wrap' }}>
                {['0','50','100','500','1000'].map(v => (
                  <button key={v} onClick={()=>set('initialBuy',v)} style={{ padding:'7px 14px', background: form.initialBuy===v ? 'rgba(139,92,246,.18)' : 'var(--night-deep)', border:`1px solid ${form.initialBuy===v ? 'rgba(139,92,246,.4)' : 'var(--night-border)'}`, borderRadius:8, cursor:'pointer', color: form.initialBuy===v ? 'var(--neon-violet-bright)' : 'var(--text-secondary)', fontFamily:'var(--font-mono)', fontSize:13 }}>
                    {v==='0' ? 'None' : `₾${v}`}
                  </button>
                ))}
              </div>
              <div style={{ background:'var(--night-deep)', border:'1px solid var(--night-border)', borderRadius:11, padding:16 }}>
                {[['Protocol fee','FREE','var(--neon-green)'],['Network fee','~₾6 DUST','var(--text-secondary)'],['Initial buy',`₾${form.initialBuy||'0'} DUST`,'var(--text-secondary)']].map(([l,v,c])=>(
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
                    <span style={{ fontSize:13, color:'var(--text-muted)' }}>{l}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:600, color:c }}>{v}</span>
                  </div>
                ))}
                <div className="divider" />
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontWeight:600, fontSize:14 }}>Total</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:14, fontWeight:700, color:'var(--neon-violet-bright)' }}>₾{(6+Number(form.initialBuy||0)).toLocaleString()} DUST</span>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 style={{ fontSize:18, marginBottom:18 }}>Review & launch 🚀</h2>
              <div style={{ display:'flex', gap:16, marginBottom:20, alignItems:'flex-start' }}>
                {preview && <img src={preview} style={{ width:76, height:76, borderRadius:14, objectFit:'cover', border:'2px solid rgba(139,92,246,.3)', flexShrink:0 }} />}
                <div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontWeight:800, fontSize:20 }}>{form.name||'—'}</span>
                    <span className="badge badge-violet">${form.ticker||'—'}</span>
                  </div>
                  <p style={{ color:'var(--text-secondary)', fontSize:13 }}>{form.description||'—'}</p>
                </div>
              </div>
              <div style={{ background:'rgba(139,92,246,.05)', border:'1px solid rgba(139,92,246,.15)', borderRadius:11, padding:14, marginBottom:20 }}>
                {[['Total supply','1,000,000,000 tokens'],['Graduation','₾69,000 DUST'],['Trade fee','1% per trade'],['Network','Midnight Preprod']].map(([k,v])=>(
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:12, color:'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-secondary)' }}>{v}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ width:'100%', fontSize:15, padding:14 }} onClick={handleLaunch}>
                🚀 Launch {form.ticker||'token'} on Preprod
              </button>
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'space-between', marginTop:24, paddingTop:20, borderTop:'1px solid var(--night-border)' }}>
            <button className="btn btn-secondary" onClick={()=>setStep(s=>Math.max(0,s-1))} style={{ visibility: step===0 ? 'hidden' : 'visible' }}>← Back</button>
            {step < 3 && <button className="btn btn-primary" onClick={()=>setStep(s=>s+1)} disabled={step===0 && !(form.name && form.ticker && form.description)}>Continue →</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
