'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useWallet } from '@/lib/wallet/WalletProvider';

type Step = 0 | 1 | 2 | 3;

const STEPS = ['Token info', 'Socials', 'Initial buy', 'Launch'];

export default function LaunchPage() {
  const router = useRouter();
  const { connected, api, connect } = useWallet();
  const [step, setStep]       = useState<Step>(0);
  const [deploying, setDeploying] = useState(false);
  const [deployErr, setDeployErr] = useState<string|null>(null);
  const [txHash, setTxHash]   = useState<string|null>(null);
  const [preview, setPreview] = useState<string|null>(null);
  const [imageUri, setImageUri] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    tokenType:   'meme' as 'meme'|'ai',
    name:        '',
    ticker:      '',
    description: '',
    website:     '',
    twitter:     '',
    telegram:    '',
    discord:     '',
    initialBuy:  '0',
  });

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const canNext: boolean[] = [
    !!(form.name.trim() && form.ticker.trim() && form.description.trim() && preview),
    true,
    true,
    true,
  ];

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const dataUri = ev.target?.result as string;
      setPreview(dataUri);
      // Upload to IPFS immediately
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: dataUri }),
        });
        const { ipfsUri } = await res.json() as { ipfsUri: string };
        setImageUri(ipfsUri);
      } catch {
        setImageUri('ipfs://QmLocal');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeploy = async () => {
    if (!connected) { connect(); return; }
    setDeploying(true);
    setDeployErr(null);

    try {
      const { launchToken } = await import('@/lib/transactions');

      // Hash metadata
      const enc = new TextEncoder();
      const digest = async (s: string) => {
        const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
        return new Uint8Array(buf);
      };

      const result = await launchToken({
        nameHash:        await digest(form.name),
        tickerHash:      await digest(form.ticker),
        descriptionHash: await digest(form.description),
        imageHash:       await digest(imageUri),
        treasuryKeyHex:  process.env.NEXT_PUBLIC_TREASURY_PK ?? '00'.repeat(32),
        initialBuy:      BigInt(Math.floor(parseFloat(form.initialBuy || '0') * 1_000_000)),
        walletAPI:       api!,
      });

      // Register token with our backend
      await fetch('/api/tokens', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address:      result.contractAddress,
          name:         form.name,
          ticker:       form.ticker.toUpperCase(),
          description:  form.description,
          imageUri,
          website:      form.website,
          twitter:      form.twitter,
          telegram:     form.telegram,
          discord:      form.discord,
          creatorAddr:  'pending',
          txHash:       result.txHash,
        }),
      });

      setTxHash(result.txHash);
      setTimeout(() => router.push(`/token/${result.contractAddress}`), 2000);

    } catch (err) {
      setDeployErr(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  const inputStyle = {
    width: '100%', background: 'var(--night-deep)',
    border: '1px solid var(--night-border)', borderRadius: 9,
    padding: '9px 13px', color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)', fontSize: 14, outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10,
    color: 'var(--text-secondary)', textTransform: 'uppercase',
    letterSpacing: '.07em', marginBottom: 5,
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: 56 }}>
      <Navbar />

      <div className="container" style={{ maxWidth: 680, paddingTop: 40, paddingBottom: 80 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ marginBottom: 10 }}><span className="badge badge-violet">🚀 Token factory</span></div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
            Launch on <span className="gradient-text">night.fun</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Deploy your bonding curve to Preprod in one transaction. 1B supply. ₾69k graduation.
          </p>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', marginBottom: 28 }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                  flexShrink: 0, transition: 'all .2s',
                  background: i < step ? 'rgba(74,222,128,.15)' : i === step ? 'var(--neon-violet)' : 'var(--night-raised)',
                  border: `2px solid ${i < step ? 'rgba(74,222,128,.4)' : i === step ? 'var(--neon-violet)' : 'var(--night-border)'}`,
                  color: i < step ? 'var(--neon-green)' : i === step ? '#fff' : 'var(--text-muted)',
                }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: i === step ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 1, margin: '0 8px', background: i < step ? 'rgba(74,222,128,.3)' : 'var(--night-border)', transition: 'background .3s' }} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="glass" style={{ padding: 28 }}>

          {/* Step 0: Token info */}
          {step === 0 && (
            <>
              <h2 style={{ fontSize: 18, marginBottom: 20 }}>Token information</h2>

              <div style={{ marginBottom: 18 }}>
                <span style={labelStyle}>Token type</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['meme','ai'] as const).map(t => (
                    <button key={t} onClick={() => set('tokenType', t)} style={{
                      flex: 1, padding: '11px',
                      background: form.tokenType===t ? 'rgba(139,92,246,.12)' : 'var(--night-deep)',
                      border: `1px solid ${form.tokenType===t ? 'rgba(139,92,246,.4)' : 'var(--night-border)'}`,
                      borderRadius: 9, cursor: 'pointer',
                      color: form.tokenType===t ? 'var(--neon-violet-bright)' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, transition: 'all .15s',
                    }}>
                      {t==='meme' ? '🐸 Meme Token' : '🤖 AI Token'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <span style={labelStyle}>Token icon <span style={{ color: 'var(--neon-rose)' }}>*</span></span>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${preview ? 'var(--neon-violet)' : 'var(--night-border)'}`,
                    borderRadius: 12, padding: 28, textAlign: 'center',
                    cursor: 'pointer', background: 'var(--night-deep)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    transition: 'border-color .2s',
                  }}
                >
                  {preview
                    ? <img src={preview} alt="preview" style={{ width: 88, height: 88, borderRadius: 14, objectFit: 'cover', border: '2px solid rgba(139,92,246,.4)' }} />
                    : <>
                        <div style={{ fontSize: 36 }}>🌙</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Click to upload</div>
                        <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>PNG, GIF, WEBP · max 5MB</div>
                      </>
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Name <span style={{ color: 'var(--neon-rose)' }}>*</span></label>
                  <input style={inputStyle} placeholder="Midnight Cat" value={form.name} onChange={e => set('name', e.target.value)} maxLength={50} />
                </div>
                <div>
                  <label style={labelStyle}>Ticker <span style={{ color: 'var(--neon-rose)' }}>*</span></label>
                  <input style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="MCAT" value={form.ticker} onChange={e => set('ticker', e.target.value.toUpperCase())} maxLength={10} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Description <span style={{ color: 'var(--neon-rose)' }}>*</span></label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 88 } as React.CSSProperties}
                  placeholder="Tell the world…"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  maxLength={500}
                />
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{form.description.length}/500</div>
              </div>
            </>
          )}

          {/* Step 1: Socials */}
          {step === 1 && (
            <>
              <h2 style={{ fontSize: 18, marginBottom: 6 }}>Social links</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 18 }}>
                Optional. Updating later costs <span style={{ color: 'var(--neon-amber)', fontFamily: 'var(--font-mono)' }}>₾150 DUST</span>.
              </p>
              {[
                { key: 'website',  label: 'Website',   icon: '🌐', ph: 'https://yourtoken.xyz' },
                { key: 'twitter',  label: 'X/Twitter', icon: '𝕏',  ph: 'https://x.com/yourtoken' },
                { key: 'telegram', label: 'Telegram',  icon: '✈️',  ph: 'https://t.me/yourtoken' },
                { key: 'discord',  label: 'Discord',   icon: '💬',  ph: 'https://discord.gg/yourtoken' },
              ].map(({ key, label, icon, ph }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>{icon} {label}</label>
                  <input style={inputStyle} type="url" placeholder={ph} value={form[key as keyof typeof form]} onChange={e => set(key as keyof typeof form, e.target.value)} />
                </div>
              ))}
            </>
          )}

          {/* Step 2: Initial buy */}
          {step === 2 && (
            <>
              <h2 style={{ fontSize: 18, marginBottom: 6 }}>Initial buy</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 18 }}>
                Buy your own token at launch. Sets starting price. Fully visible to all traders.
              </p>
              <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
                {['0','50','100','500','1000'].map(v => (
                  <button key={v} onClick={() => set('initialBuy', v)} style={{
                    padding: '7px 14px',
                    background: form.initialBuy===v ? 'rgba(139,92,246,.18)' : 'var(--night-deep)',
                    border: `1px solid ${form.initialBuy===v ? 'rgba(139,92,246,.4)' : 'var(--night-border)'}`,
                    borderRadius: 8, cursor: 'pointer',
                    color: form.initialBuy===v ? 'var(--neon-violet-bright)' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, transition: 'all .15s',
                  }}>
                    {v==='0' ? 'None' : `₾${v}`}
                  </button>
                ))}
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Custom DUST amount</label>
                <input style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} type="number" min="0" value={form.initialBuy} onChange={e => set('initialBuy', e.target.value)} />
              </div>
              <div style={{ background: 'var(--night-deep)', border: '1px solid var(--night-border)', borderRadius: 11, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Cost breakdown</div>
                {[
                  { label: 'Protocol fee', value: 'FREE', color: 'var(--neon-green)' },
                  { label: 'Network fee (est.)', value: '~₾6 DUST', color: 'var(--text-secondary)' },
                  { label: 'Initial buy', value: `₾${form.initialBuy || '0'} DUST`, color: 'var(--text-secondary)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color }}>{value}</span>
                  </div>
                ))}
                <div className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Total</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--neon-violet-bright)' }}>
                    ₾{(6 + Number(form.initialBuy || 0)).toLocaleString()} DUST
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Review & Launch */}
          {step === 3 && (
            <>
              <h2 style={{ fontSize: 18, marginBottom: 18 }}>Review & launch 🚀</h2>
              <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
                {preview && <img src={preview} alt="icon" style={{ width: 76, height: 76, borderRadius: 14, objectFit: 'cover', border: '2px solid rgba(139,92,246,.3)', flexShrink: 0 }} />}
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 20 }}>{form.name}</span>
                    <span className="badge badge-violet">${form.ticker}</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{form.description}</p>
                </div>
              </div>

              <div style={{ background: 'rgba(139,92,246,.05)', border: '1px solid rgba(139,92,246,.15)', borderRadius: 11, padding: 14, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neon-violet-bright)', marginBottom: 9 }}>Fixed protocol parameters</div>
                {[
                  ['Total supply',     '1,000,000,000 tokens'],
                  ['Graduation',       '₾69,000 DUST market cap'],
                  ['Burn',             '1,000,000 tokens (0.1%)'],
                  ['Trade fee',        '1% per buy/sell'],
                  ['Network',          'Midnight Preprod'],
                  ['Initial buy',      form.initialBuy && form.initialBuy !== '0' ? `₾${form.initialBuy} DUST` : 'None'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>
                  </div>
                ))}
              </div>

              {txHash && (
                <div style={{ background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.25)', borderRadius: 8, padding: '9px 14px', marginBottom: 14, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--neon-green)' }}>
                  ✅ Deployed! Tx: {txHash.slice(0,16)}… Redirecting…
                </div>
              )}
              {deployErr && (
                <div style={{ background: 'rgba(251,113,133,.08)', border: '1px solid rgba(251,113,133,.25)', borderRadius: 8, padding: '9px 14px', marginBottom: 14, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--neon-rose)' }}>
                  ⚠ {deployErr}
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={handleDeploy}
                disabled={deploying}
                style={{ width: '100%', fontSize: 15, padding: '14px', opacity: deploying ? 0.7 : 1 }}
              >
                {deploying ? '⏳ Deploying to Midnight…' :
                 !connected ? '🌙 Connect Lace to launch' :
                 `🚀 Launch ${form.ticker || 'token'} on Preprod`}
              </button>
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                Non-custodial · ZK-protected · Midnight Preprod
              </p>
            </>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--night-border)' }}>
            <button className="btn btn-secondary"
              onClick={() => setStep(s => Math.max(0, s - 1) as Step)}
              style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>
              ← Back
            </button>
            {step < 3 && (
              <button
                className="btn btn-primary"
                onClick={() => setStep(s => (s + 1) as Step)}
                disabled={!canNext[step]}
                style={{ opacity: canNext[step] ? 1 : 0.4 }}
              >
                Continue →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
