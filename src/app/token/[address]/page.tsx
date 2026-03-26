'use client';
import PriceChart from '@/components/PriceChart';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ZkWorkOverlay from '@/components/ZkWorkOverlay';
import { getBuyQuote, getSellQuote, bondingProgress, fmtDust, fmtTokens, fmtMcap, GRADUATION_TARGET, calcTokensOut, calcAdaOut } from '@/lib/midnight/bondingCurve';
import { executeTradeWithWallet, type TradeParams } from '@/lib/contractWiring';
import { MIDNIGHT_NETWORK_CAPTION } from '@/lib/network';
import { useWallet } from '@/lib/wallet/WalletProvider';

export default function TokenPage() {
  const { address: addressParam } = useParams<{ address: string }>();
  const address = typeof addressParam === 'string' ? addressParam : addressParam?.[0] ?? '';
  const { api, connected } = useWallet();
  const [token, setToken] = useState<any>(null);
  const [tradeMode, setTradeMode] = useState('buy');
  const [amount, setAmount] = useState('');
  const [trading, setTrading] = useState(false);
  const [txResult, setTxResult] = useState<{ txId: string } | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tokens?limit=100')
      .then(r => r.json())
      .then(({ tokens }) => {
        const found = tokens?.find((t: any) => t.address === address);
        if (found) setToken(found);
        else setToken({ address, name: address?.slice(0,8)+'...', ticker: 'UNK', description: `Token on ${MIDNIGHT_NETWORK_CAPTION}`, adaReserve:'0', tokenReserve:'999000000000000', totalVolume:'0', txCount:0, holderCount:1, graduated:false, lockedPercent:0 });
      });
  }, [address]);

  const adaIn = amount ? BigInt(Math.floor(parseFloat(amount)*1_000_000)) : 0n;
  const tokensIn = amount ? BigInt(Math.floor(parseFloat(amount)*1_000_000_000_000)) : 0n;
  const ada = token ? BigInt(token.adaReserve) : 0n;
  const tok = token ? BigInt(token.tokenReserve) : 999000000000000n;
  const quote = tradeMode==='buy' && adaIn>0n ? getBuyQuote(adaIn, ada, tok) : tradeMode==='sell' && tokensIn>0n ? getSellQuote(tokensIn, ada, tok) : null;
  const progress = bondingProgress(ada);

  async function handleTrade() {
    if (!amount || !token) return;
    if (!connected || !api) {
      setTradeError('Connect your Lace wallet first (Connect Lace in the header).');
      return;
    }
    setTrading(true);
    setTxResult(null);
    setTradeError(null);

    try {
      const ada = BigInt(token.adaReserve);
      const tok = BigInt(token.tokenReserve);

      let params: TradeParams;

      if (tradeMode === 'buy') {
        const adaInRaw = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
        const fee = (adaInRaw * 100n) / 10_000n;
        const netAda = adaInRaw - fee;
        const tokensOut = calcTokensOut(netAda, ada, tok);
        params = {
          contractAddress: address,
          action: 'buy',
          adaIn: adaInRaw.toString(),
          tokensOut: tokensOut.toString(),
        };
      } else {
        const tokensInRaw = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000_000));
        const grossAda = calcAdaOut(tokensInRaw, ada, tok);
        const fee = (grossAda * 100n) / 10_000n;
        const netAda = grossAda - fee;
        params = {
          contractAddress: address,
          action: 'sell',
          tokensIn: tokensInRaw.toString(),
          adaOut: netAda.toString(),
        };
      }

      const result = await executeTradeWithWallet(params, api);
      setTxResult({ txId: result.txId });

      // Update reserves in Redis after confirmed trade
      const adaCurrent = BigInt(token.adaReserve);
      const tokCurrent = BigInt(token.tokenReserve);
      let newAda: bigint, newTok: bigint, newVol: bigint;

      if (tradeMode === 'buy') {
        const adaInRaw = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
        const fee = (adaInRaw * 100n) / 10_000n;
        const netAda = adaInRaw - fee;
        const tokensOut = calcTokensOut(netAda, adaCurrent, tokCurrent);
        newAda = adaCurrent + netAda;
        newTok = tokCurrent - tokensOut;
        newVol = BigInt(token.totalVolume) + adaInRaw;
      } else {
        const tokensInRaw = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000_000));
        const grossAda = calcAdaOut(tokensInRaw, adaCurrent, tokCurrent);
        const fee = (grossAda * 100n) / 10_000n;
        const netAda = grossAda - fee;
        newAda = adaCurrent - grossAda;
        newTok = tokCurrent + tokensInRaw;
        newVol = BigInt(token.totalVolume) + netAda;
      }

      const graduated = newAda >= GRADUATION_TARGET;

      await fetch(`/api/tokens/${address}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adaReserve: newAda.toString(),
          tokenReserve: newTok.toString(),
          totalVolume: newVol.toString(),
          txCount: (token.txCount ?? 0) + 1,
          graduated,
          lastActivityAt: Math.floor(Date.now() / 1000),
        }),
      });

      // Refresh token state
      setToken((prev: any) => ({
        ...prev,
        adaReserve: newAda.toString(),
        tokenReserve: newTok.toString(),
        totalVolume: newVol.toString(),
        txCount: (prev.txCount ?? 0) + 1,
        graduated,
      }));

      setAmount('');
    } catch (err: any) {
      setTradeError(err.message ?? 'Trade failed');
    } finally {
      setTrading(false);
    }
  }

  if (!token) return <div style={{ minHeight:'100vh', paddingTop:56, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}><Navbar />Loading...</div>;

  return (
    <div style={{ minHeight:'100vh', paddingTop:56 }}>
      <ZkWorkOverlay
        open={trading || !!tradeError}
        error={tradeError}
        variant="trade"
        title="Creating ZK proof…"
        subtitle="Hold on — proving and submitting your trade can take up to a minute."
        onDismiss={tradeError ? () => setTradeError(null) : undefined}
      />
      <Navbar />
      <div className="container" style={{ paddingTop:28, paddingBottom:80 }}>
        <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:28, flexWrap:'wrap' }}>
          <div style={{ width:60, height:60, borderRadius:14, background:'linear-gradient(135deg,#8b5cf6,#22d3ee)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, border:'2px solid rgba(139,92,246,.3)', flexShrink:0, overflow:'hidden' }}>
            {token?.imageUri && token.imageUri !== 'ipfs://' 
              ? <img src={token.imageUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} alt={token.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { (e.target as any).style.display='none'; }} />
              : '🌙'}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
              <h1 style={{ fontSize:26, fontWeight:800, margin:0 }}>{token.name}</h1>
              <span className="badge badge-violet">${token.ticker}</span>
              {token.graduated && <span className="badge badge-green">✅ Graduated</span>}
              {token.lockedPercent > 0 && <span className="badge badge-amber">🔒 {token.lockedPercent}% locked</span>}
            </div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              {[['Mcap',fmtMcap(ada),'var(--neon-violet-bright)'],['Volume','₾'+fmtDust(BigInt(token.totalVolume),0),null],['Holders',token.holderCount,null],['Txns',token.txCount,null]].map(([l,v,c]: any)=>(
                <div key={l} style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.07em' }}>{l}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:14, fontWeight:600, color:c||'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Socials */}
          <div style={{ display:'flex', gap:7, marginTop:8 }}>
            {token?.website  && <a href={token.website}  target="_blank" rel="noopener" style={{ width:28, height:28, borderRadius:6, background:'var(--night-raised)', border:'1px solid var(--night-border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, textDecoration:'none' }}>🌐</a>}
            {token?.twitter  && <a href={token.twitter}  target="_blank" rel="noopener" style={{ width:28, height:28, borderRadius:6, background:'var(--night-raised)', border:'1px solid var(--night-border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', textDecoration:'none' }}>𝕏</a>}
            {token?.telegram && <a href={token.telegram} target="_blank" rel="noopener" style={{ width:28, height:28, borderRadius:6, background:'var(--night-raised)', border:'1px solid var(--night-border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, textDecoration:'none' }}>✈️</a>}
            {token?.discord  && <a href={token.discord}  target="_blank" rel="noopener" style={{ width:28, height:28, borderRadius:6, background:'var(--night-raised)', border:'1px solid var(--night-border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, textDecoration:'none' }}>💬</a>}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20, alignItems:'start' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="glass" style={{ overflow:'hidden' }}>
              <PriceChart ticker={token?.ticker ?? 'TOKEN'} />
            </div>
            <div className="glass" style={{ padding:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div><div style={{ fontSize:14, fontWeight:600 }}>Bonding Curve Progress</div><div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)', marginTop:2 }}>₾{fmtDust(ada)} / ₾{fmtDust(GRADUATION_TARGET)} to graduate</div></div>
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
                    <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:400, marginLeft:5 }}>{tradeMode==='buy' ? token.ticker : 'DUST'}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--font-mono)', fontSize:11 }}>
                    <span style={{ color:'var(--text-muted)' }}>Price impact</span>
                    <span style={{ color: quote.priceImpact>5?'var(--neon-rose)':'var(--neon-green)' }}>{quote.priceImpact.toFixed(2)}%</span>
                  </div>
                </div>
              )}

              {txResult && (
                <div style={{ background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.3)', borderRadius:8, padding:'8px 12px', marginBottom:10, fontFamily:'var(--font-mono)', fontSize:11, color:'var(--neon-green)' }}>
                  Submitted through Lace.<br/>
                  <span style={{ color:'var(--text-muted)' }}>Check your wallet activity for the on-chain tx.</span>
                </div>
              )}

              {!connected && (
                <p style={{ fontSize:12, color:'var(--neon-amber)', marginBottom:10 }}>Connect Lace to buy or sell — your keys stay in the wallet.</p>
              )}

              <button
                className={`btn btn-${tradeMode}`}
                onClick={handleTrade}
                disabled={trading || !amount || !quote}
                style={{ opacity: (trading || !amount || !quote) ? 0.6 : 1, cursor: (trading || !amount || !quote) ? 'not-allowed' : 'pointer' }}
              >
                {trading
                  ? 'Working…'
                  : tradeMode === 'buy'
                    ? `Buy ${token.ticker}`
                    : `Sell ${token.ticker}`}
              </button>
              <div style={{ textAlign:'center', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', marginTop:8 }}>Non-custodial · ZK-protected · {MIDNIGHT_NETWORK_CAPTION}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
