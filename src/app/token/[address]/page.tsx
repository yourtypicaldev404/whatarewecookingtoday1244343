'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { getBuyQuote, getSellQuote, bondingProgress, fmtDust, fmtTokens, fmtMcap, GRADUATION_TARGET } from '@/lib/midnight/bondingCurve';

const MOCK = { name:'Midnight Cat', ticker:'MCAT', description:'The first cat on Midnight. Privacy meows.', adaReserve:14500000000n, tokenReserve:750000000000000n, totalVolume:28000000000n, txCount:347, holderCount:89, graduated:false, lockedPercent:20 };

export default function TokenPage() {
  const { address } = useParams();
  const [tradeMode, setTradeMode] = useState('buy');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(30n);

  const adaIn = amount ? BigInt(Math.floor(parseFloat(amount)*1_000_000)) : 0n;
  const tokensIn = amount ? BigInt(Math.floor(parseFloat(amount)*1_000_000_000_000)) : 0n;
  const quote = tradeMode==='buy' && adaIn>0n ? getBuyQuote(adaIn, MOCK.adaReserve, MOCK.tokenReserve) : tradeMode==='sell' && tokensIn>0n ? getSellQuote(tokensIn, MOCK.adaReserve, MOCK.tokenReserve) : null;
  const progress = bondingProgress(MOCK.adaReserve);

  return (
    <div style={{ minHeight:'100vh', paddingTop:56 }}>
      <Navbar />
      <div className="container" style={{ paddingTop:28, paddingBottom:80 }}>
        <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:28, flexWrap:'wrap' }}>
          <div style={{ width:60, height:60, borderRadius:14, background:'linear-gradient(135deg,#8b5cf6,#22d3ee)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, border:'2px solid rgba(139,92,246,.3)', flexShrink:0 }}>🌙</div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
              <h1 style={{ fontSize:26, fontWeight:800, margin:0 }}>{MOCK.name}</h1>
              <span className="badge badge-violet">${MOCK.ticker}</span>
              {MOCK.lockedPercent > 0 && <span className="badge badge-amber">🔒 {MOCK.lockedPercent}% locked</span>}
            </div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              {[['Mcap',fmtMcap(MOCK.adaReserve),'var(--neon-violet-bright)'],['Volume',`₾${fmtDust(MOCK.totalVolume,0)}`,null],['Holders',MOCK.holderCount.toString(),null],['Txns',MOCK.txCount.toString(),null]].map(([l,v,c])=>(
                <div key={l} style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.07em' }}>{l}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:14, fontWeight:600, color:c||'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20, alignItems:'start' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="glass" style={{ height:280, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'var(--text-muted)' }}>
              <div style={{ fontSize:28 }}>📈</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>Chart loads here — install lightweight-charts</div>
            </div>
            <div className="glass" style={{ padding:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div><div style={{ fontSize:14, fontWeight:600 }}>Bonding Curve Progress</div><div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)', marginTop:2 }}>₾{fmtDust(MOCK.adaReserve)} / ₾{fmtDust(GRADUATION_TARGET)} to graduate</div></div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:24, fontWeight:700, color:'var(--neon-violet-bright)' }}>{progress}%</div>
              </div>
              <div className="progress-bar" style={{ height:9 }}><div className="progress-fill" style={{ width:`${progress}%` }} /></div>
            </div>
          </div>

          <div style={{ position:'sticky', top:72 }}>
            <div className="glass" style={{ padding:18 }}>
              <div style={{ display:'flex', background:'var(--night-deep)', border:'1px solid var(--night-border)', borderRadius:10, padding:3, gap:2, marginBottom:16 }}>
                {['buy','sell'].map(mode => (
                  <button key={mode} onClick={()=>{setTradeMode(mode);setAmount('');}} style={{ flex:1, padding:9, borderRadius:8, cursor:'pointer', background: tradeMode===mode ? mode==='buy' ? 'rgba(16,185,129,.13)' : 'rgba(251,113,133,.13)' : 'transparent', border: tradeMode===mode ? mode==='buy' ? '1px solid rgba(16,185,129,.4)' : '1px solid rgba(251,113,133,.4)' : '1px solid transparent', color: tradeMode===mode ? mode==='buy' ? 'var(--neon-green)' : 'var(--neon-rose)' : 'var(--text-muted)', fontFamily:'var(--font-display)', fontWeight:700, fontSize:14 }}>
                    {mode.charAt(0).toUpperCase()+mode.slice(1)}
                  </button>
                ))}
              </div>
              <input type="number" min="0" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)} style={{ fontFamily:'var(--font-mono)', fontSize:20, fontWeight:600, marginBottom:10 }} />
              <div style={{ display:'flex', gap:6, marginBottom:14 }}>
                {(tradeMode==='buy'?['25','100','250','500']:['25','50','75','100']).map(q=>(
                  <button key={q} onClick={()=>setAmount(q)} style={{ flex:1, padding:'5px 0', background:'var(--night-deep)', border:'1px solid var(--night-border)', borderRadius:7, cursor:'pointer', color:'var(--text-secondary)', fontFamily:'var(--font-mono)', fontSize:11 }}>
                    {tradeMode==='buy'?`₾${q}`:`${q}%`}
                  </button>
                ))}
              </div>
              {quote && (
                <div style={{ background:'var(--night-deep)', border:'1px solid var(--night-border)', borderRadius:9, padding:12, marginBottom:12 }}>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>You receive</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:20, fontWeight:700, marginBottom:6 }}>
                    {tradeMode==='buy' ? fmtTokens(quote.amountOut) : fmtDust(quote.amountOut)}
                    <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:400, marginLeft:5 }}>{tradeMode==='buy' ? MOCK.ticker : 'DUST'}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--font-mono)', fontSize:11 }}>
                    <span style={{ color:'var(--text-muted)' }}>Price impact</span>
                    <span style={{ color: quote.priceImpact>5?'var(--neon-rose)':'var(--neon-green)' }}>{quote.priceImpact.toFixed(2)}%</span>
                  </div>
                </div>
              )}
              <button className={`btn btn-${tradeMode}`} onClick={()=>alert('Connect Lace wallet to trade — Midnight Preprod')}>
                {tradeMode==='buy'?`🟢 Buy ${MOCK.ticker}`:`🔴 Sell ${MOCK.ticker}`}
              </button>
              <div style={{ textAlign:'center', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', marginTop:8 }}>Non-custodial · ZK-protected · Midnight Preprod</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
