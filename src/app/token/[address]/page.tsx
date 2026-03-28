'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { getBuyQuote, getSellQuote, bondingProgress, fmtDust, fmtTokens, fmtMcap, GRADUATION_TARGET, spotPrice } from '@/lib/midnight/bondingCurve';

function timeAgo(ts: number) {
  const d = Math.floor(Date.now() / 1000) - ts;
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

const TF = ['1m','5m','15m','1h','4h','1d'];
const TICKER_ITEMS = ['BUY','SELL','BUY','BUY','SELL','BUY','BUY','SELL','BUY','BUY'];

function TokenAvatar({ token, size = 32 }: { token: any; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = (token.ticker || token.name || '?').slice(0, 2).toUpperCase();
  if (!err && token.imageUri && token.imageUri !== 'ipfs://') {
    return (
      <div className="token-avatar" style={{ width: size, height: size }}>
        <img src={token.imageUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} alt={token.name} onError={() => setErr(true)} />
      </div>
    );
  }
  return (
    <div className="token-avatar" style={{ width: size, height: size }}>
      <div className="token-avatar-placeholder" style={{ fontSize: size * 0.28, letterSpacing: '-0.5px' }}>{initials}</div>
    </div>
  );
}

export default function TokenPage() {
  const { address } = useParams<{ address: string }>();
  const [token, setToken] = useState<any>(null);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [activeTab, setActiveTab] = useState('trades');
  const [activeTf, setActiveTf] = useState('5m');
  const [preset, setPreset] = useState('');
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/tokens?limit=100')
      .then(r => r.json())
      .then(({ tokens }) => {
        const found = tokens?.find((t: any) => t.address === address);
        setToken(found ?? { address, name: address?.slice(0,8)+'…', ticker: 'UNK', description: '', adaReserve: '0', tokenReserve: '999000000000000', totalVolume: '0', txCount: 0, holderCount: 1, graduated: false });
      });
  }, [address]);

  useEffect(() => {
    if (!chartRef.current || !token) return;
    let chart: any;
    import('lightweight-charts').then(({ createChart, ColorType, LineStyle }) => {
      if (!chartRef.current) return;
      chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: chartRef.current.clientHeight || 260,
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: 'rgba(255,255,255,0.25)' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.03)', style: LineStyle.Dotted }, horzLines: { color: 'rgba(255,255,255,0.03)', style: LineStyle.Dotted } },
        crosshair: { vertLine: { color: '#00D1A7', width: 1 }, horzLine: { color: '#00D1A7', width: 1 } },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.05)', timeVisible: true },
        handleScroll: true, handleScale: true,
      });
      const area = chart.addAreaSeries({ lineColor: '#00D1A7', topColor: 'rgba(0,209,167,0.12)', bottomColor: 'rgba(0,209,167,0)', lineWidth: 1 });
      const now = Math.floor(Date.now() / 1000);
      let v = 0.000001;
      const data = Array.from({ length: 120 }, (_, i) => {
        v *= (1 + (Math.random() - 0.46) * 0.04);
        return { time: (now - (120 - i) * 300) as any, value: Math.max(v, 0.0000001) };
      });
      area.setData(data);
      chart.timeScale().fitContent();
    });
    return () => { chart?.remove(); };
  }, [token]);

  if (!token) return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 44px)', color: 'var(--t3)', fontFamily: 'var(--mono)', fontSize: 11 }}>Loading…</div>
    </div>
  );

  const ada  = BigInt(token.adaReserve   ?? '0');
  const tok  = BigInt(token.tokenReserve ?? '999000000000000');
  const prog = bondingProgress(ada);
  const addr = (token.address ?? address ?? '') as string;
  const adaIn   = amount && tradeMode === 'buy'  ? BigInt(Math.floor(parseFloat(amount) * 1_000_000)) : 0n;
  const tokensIn = amount && tradeMode === 'sell' ? BigInt(Math.floor(parseFloat(amount) * 1_000_000_000_000)) : 0n;
  const quote = tradeMode === 'buy' && adaIn > 0n ? getBuyQuote(adaIn, ada, tok)
    : tradeMode === 'sell' && tokensIn > 0n ? getSellQuote(tokensIn, ada, tok)
    : null;

  const mockTrades = Array.from({ length: 12 }, (_, i) => ({
    type: TICKER_ITEMS[i % TICKER_ITEMS.length] === 'BUY' ? 'buy' : 'sell',
    wallet: addr.slice(0,4) + '…' + Math.random().toString(16).slice(2,6),
    dust: (Math.random() * 800 + 20).toFixed(1),
    tokens: Math.floor(Math.random() * 500000 + 5000),
    age: `${Math.floor(Math.random() * 59) + 1}m`,
  }));

  const BUY_PRESETS = ['25', '100', '250', '500'];
  const SELL_PRESETS = ['25%', '50%', '75%', '100%'];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* Ticker strip */}
      <div className="ticker-strip">
        <div className="ticker-scroll">
          {[...Array(24)].map((_, i) => {
            const isBuy = TICKER_ITEMS[i % TICKER_ITEMS.length] === 'BUY';
            return (
              <div key={i} className="ticker-item">
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: isBuy ? 'var(--green)' : 'var(--red)', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ color: 'var(--t2)', fontWeight: 600 }}>{token.ticker}</span>
                <span className={isBuy ? 'up' : 'dn'}>{isBuy ? '+' : '-'}{(Math.random() * 15 + 1).toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="token-page">

        {/* ── LEFT / CENTER ── */}
        <div className="token-main">

          {/* Token header */}
          <div className="token-header">
            <TokenAvatar token={token} size={30} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{token.name}</span>
                <span className="badge badge-white">${token.ticker}</span>
                {token.graduated && <span className="badge badge-green">GRADUATED</span>}
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--t3)' }}>{addr.slice(0,8)}…{addr.slice(-6)}</span>
                <button onClick={() => navigator.clipboard?.writeText(addr)} style={{ background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',alignItems:'center' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--t3)' }}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
                {token.website  && <a href={token.website}  target="_blank" rel="noopener" style={{ color:'var(--t3)',fontSize:9,border:'1px solid var(--b1)',borderRadius:3,padding:'1px 5px',fontFamily:'var(--mono)' }}>web</a>}
                {token.twitter  && <a href={token.twitter}  target="_blank" rel="noopener" style={{ color:'var(--t3)',fontSize:9,border:'1px solid var(--b1)',borderRadius:3,padding:'1px 5px',fontFamily:'var(--mono)' }}>x</a>}
                {token.telegram && <a href={token.telegram} target="_blank" rel="noopener" style={{ color:'var(--t3)',fontSize:9,border:'1px solid var(--b1)',borderRadius:3,padding:'1px 5px',fontFamily:'var(--mono)' }}>tg</a>}
              </div>
            </div>

            <div style={{ display:'flex', alignItems:'center', marginLeft:'auto', flexWrap:'wrap', gap: '0 1px' }}>
              {([
                ['MCAP',    fmtMcap(ada),                             ada > 0n ? 'var(--green)' : 'var(--t2)'],
                ['PRICE',   fmtDust(spotPrice(ada, tok), 6) + ' D',  'var(--t1)'],
                ['VOL',     fmtDust(BigInt(token.totalVolume??'0'),0),'var(--t2)'],
                ['TXNS',    String(token.txCount ?? 0),               'var(--t2)'],
                ['HOLDERS', String(token.holderCount ?? 1),           'var(--t2)'],
              ] as [string, string, string][]).map(([l, v, c]) => (
                <div key={l} style={{ padding: '0 14px', borderRight: '1px solid var(--b0)' }}>
                  <div className="stat-label">{l}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:600, color:c, marginTop:1 }}>{v}</div>
                </div>
              ))}
              {/* Progress inline */}
              <div style={{ padding: '0 14px' }}>
                <div className="stat-label">CURVE</div>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
                  <div style={{ width:60, height:3, background:'var(--bg-4)', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${prog}%`, background:prog>80?'var(--green)':prog>50?'var(--amber)':'var(--t4)', borderRadius:2 }} />
                  </div>
                  <span style={{ fontFamily:'var(--mono)', fontSize:10, color:prog>80?'var(--green)':'var(--t3)' }}>{prog}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart toolbar */}
          <div className="chart-toolbar">
            {TF.map(t => (
              <button key={t} className={`tf-btn ${activeTf === t ? 'active' : ''}`} onClick={() => setActiveTf(t)}>{t}</button>
            ))}
            <div style={{ flex:1 }} />
            <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--t3)' }}>
              {token.name}/{token.ticker} · night.fun
            </span>
          </div>

          {/* Chart */}
          <div style={{ background:'var(--bg)', flex:'0 0 260px', position:'relative' }}>
            <div ref={chartRef} style={{ height:'100%' }} />
          </div>

          {/* Bonding curve bar */}
          <div style={{ padding:'8px 12px', borderTop:'1px solid var(--b0)', borderBottom:'1px solid var(--b0)', display:'flex', alignItems:'center', gap:12, background:'var(--bg-1)', flexShrink:0 }}>
            <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--t3)', whiteSpace:'nowrap' }}>Bonding curve</span>
            <div style={{ flex:1, height:3, background:'var(--bg-4)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${prog}%`, background:prog>80?'var(--green)':prog>50?'var(--amber)':'var(--t4)', borderRadius:2, transition:'width .5s ease' }} />
            </div>
            <span style={{ fontFamily:'var(--mono)', fontSize:10, color:prog>80?'var(--green)':'var(--t2)', whiteSpace:'nowrap' }}>
              {fmtDust(ada)} / {fmtDust(GRADUATION_TARGET)} DUST ({prog}%)
            </span>
            {prog >= 100 && <span className="badge badge-green">GRADUATED</span>}
          </div>

          {/* Bottom tabs */}
          <div style={{ borderBottom:'1px solid var(--b0)', display:'flex', background:'var(--bg-1)', flexShrink:0 }}>
            {[['trades',`Trades (${token.txCount??0})`],['holders',`Holders (${token.holderCount??1})`],['info','Token info']].map(([id,label]) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                padding:'7px 12px', border:'none', background:'transparent',
                color: activeTab===id ? 'var(--t1)' : 'var(--t3)',
                fontSize:11, fontWeight:500, cursor:'pointer',
                borderBottom: `2px solid ${activeTab===id ? 'var(--green)' : 'transparent'}`,
                transition:'all 0.1s', fontFamily:'var(--font)',
              }}>{label}</button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {activeTab === 'trades' && (
              <>
                <table className="data-table">
                  <thead><tr>
                    <th>Type</th><th>Wallet</th><th>DUST</th><th>Tokens</th><th>Age</th><th>Tx</th>
                  </tr></thead>
                  <tbody>
                    {mockTrades.map((tx, i) => (
                      <tr key={i}>
                        <td><span style={{ color: tx.type==='buy'?'var(--green)':'var(--red)', fontWeight:600 }}>{tx.type.toUpperCase()}</span></td>
                        <td style={{ fontFamily:'var(--mono)', fontSize:10 }}>{tx.wallet}</td>
                        <td>{tx.dust}</td>
                        <td>{tx.tokens.toLocaleString()}</td>
                        <td style={{ color:'var(--t3)' }}>{tx.age}</td>
                        <td><span style={{ fontFamily:'var(--mono)',fontSize:9,color:'var(--t3)' }}>—</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ textAlign:'center', padding:14, fontFamily:'var(--mono)', fontSize:10, color:'var(--t4)' }}>
                  Live trade history — indexer integration in progress
                </div>
              </>
            )}
            {activeTab === 'holders' && (
              <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:120,fontFamily:'var(--mono)',fontSize:10,color:'var(--t4)' }}>
                Holder tracking — indexer integration in progress
              </div>
            )}
            {activeTab === 'info' && (
              <div style={{ padding:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  ['Contract', addr.slice(0,14)+'…'],
                  ['Network', 'Midnight ' + (process.env.NEXT_PUBLIC_NETWORK_ID ?? 'preprod')],
                  ['Supply', '1,000,000,000'],
                  ['Target', '69,000 DUST'],
                  ['Deployed', token.deployedAt ? new Date(token.deployedAt*1000).toLocaleDateString() : '—'],
                  ['Creator', token.creatorAddr ? token.creatorAddr.slice(0,12)+'…' : '—'],
                ].map(([l,v]) => (
                  <div key={l} style={{ background:'var(--bg-2)', border:'1px solid var(--b0)', borderRadius:5, padding:'7px 9px' }}>
                    <div className="stat-label" style={{ marginBottom:2 }}>{l}</div>
                    <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--t1)' }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="token-sidebar">

          {/* Trade tabs */}
          <div className="trade-tabs">
            <button className={`trade-tab ${tradeMode==='buy'?'buy-active':''}`} onClick={() => { setTradeMode('buy'); setAmount(''); setPreset(''); }}>Buy</button>
            <button className={`trade-tab ${tradeMode==='sell'?'sell-active':''}`} onClick={() => { setTradeMode('sell'); setAmount(''); setPreset(''); }}>Sell</button>
          </div>

          <div style={{ padding: 12, display:'flex', flexDirection:'column', gap:10 }}>

            {/* Amount input */}
            <div>
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>Amount</div>
              <div className="amount-wrap">
                <input
                  className="amount-input"
                  type="number" min="0"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setPreset(''); }}
                  placeholder="0"
                />
                <div className="amount-unit">{tradeMode==='buy' ? 'DUST' : token.ticker}</div>
              </div>
            </div>

            {/* Presets */}
            <div className="preset-grid">
              {(tradeMode==='buy' ? BUY_PRESETS : SELL_PRESETS).map(p => (
                <button
                  key={p}
                  className={`preset-btn ${preset===p?'active':''}`}
                  onClick={() => { setPreset(p); setAmount(tradeMode==='buy' ? p : p.replace('%','')); }}
                >
                  {tradeMode==='buy' ? p : p}
                </button>
              ))}
            </div>

            {/* Quote */}
            {quote && (
              <div style={{ background:'var(--bg-2)', border:'1px solid var(--b0)', borderRadius:5, padding:'9px 10px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--t3)', textTransform:'uppercase' }}>You receive</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:600, color:'var(--t1)' }}>
                    {tradeMode==='buy' ? fmtTokens(quote.amountOut) : fmtDust(quote.amountOut)} {tradeMode==='buy' ? token.ticker : 'DUST'}
                  </span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--t3)', textTransform:'uppercase' }}>Price impact</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color: quote.priceImpact>5?'var(--red)':'var(--green)' }}>
                    {quote.priceImpact.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* Action button */}
            {tradeMode === 'buy' ? (
              <button className="btn-buy" onClick={async () => {
                if (!amount || parseFloat(amount) <= 0) { alert('Enter an amount'); return; }
                try {
                  const { submitBuyTx } = await import('@/lib/trading');
                  const adaAmt = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
                  const q = getBuyQuote(adaAmt, ada, tok);
                  const result = await submitBuyTx({ contractAddress: address as string, adaIn: adaAmt, tokensOut: q.amountOut * 95n / 100n });
                  alert('Buy submitted! Tx: ' + result.txId);
                } catch (err: any) { alert('Trade failed: ' + err.message); }
              }}>
                Buy {token.ticker}
              </button>
            ) : (
              <button className="btn-sell" onClick={async () => {
                if (!amount || parseFloat(amount) <= 0) { alert('Enter an amount'); return; }
                try {
                  const { submitSellTx } = await import('@/lib/trading');
                  const tokAmt = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000_000));
                  const q = getSellQuote(tokAmt, ada, tok);
                  const result = await submitSellTx({ contractAddress: address as string, tokensIn: tokAmt, adaOut: q.amountOut * 95n / 100n });
                  alert('Sell submitted! Tx: ' + result.txId);
                } catch (err: any) { alert('Trade failed: ' + err.message); }
              }}>
                Sell {token.ticker}
              </button>
            )}

            {/* ZK note */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <span className="badge badge-green">ZK</span>
              <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--t3)' }}>
                Non-custodial · {process.env.NEXT_PUBLIC_NETWORK_ID ?? 'preprod'}
              </span>
            </div>
          </div>

          <div className="divider" />

          {/* Position */}
          <div style={{ padding:'10px 12px' }}>
            <div className="section-title" style={{ marginBottom:8 }}>Your Position</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {[['Bought','0 DUST'],['Sold','0 DUST'],['Holding','0 '+token.ticker],['PnL','+0%']].map(([l,v]) => (
                <div key={l} style={{ background:'var(--bg-2)', borderRadius:5, padding:'6px 8px' }}>
                  <div className="stat-label" style={{ marginBottom:2 }}>{l}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--t2)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="divider" />

          {/* Token info */}
          <div style={{ padding:'10px 12px' }}>
            <div className="section-title" style={{ marginBottom:8 }}>Token Info</div>
            {[
              ['Dev holdings', '0%', 'var(--green)'],
              ['Holders', String(token.holderCount??1), 'var(--t2)'],
              ['Total txns', String(token.txCount??0), 'var(--t2)'],
              ['Curve target', '69,000 DUST', 'var(--t2)'],
            ].map(([l,v,c]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderBottom:'1px solid var(--b0)' }}>
                <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.06em' }}>{l}</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:11, fontWeight:600, color:c }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="divider" />

          {/* Contract */}
          <div style={{ padding:'10px 12px' }}>
            <div className="section-title" style={{ marginBottom:8 }}>Contract</div>
            <div style={{ fontFamily:'var(--mono)', fontSize:9.5, color:'var(--t3)', wordBreak:'break-all', lineHeight:1.6 }}>{addr}</div>
            <button
              onClick={() => navigator.clipboard?.writeText(addr)}
              style={{ marginTop:6, padding:'3px 9px', background:'var(--bg-3)', border:'1px solid var(--b1)', borderRadius:4, fontSize:10, color:'var(--t3)', cursor:'pointer', fontFamily:'var(--mono)', transition:'all 0.1s' }}
            >
              Copy address
            </button>
            {token.description && (
              <div style={{ marginTop:10 }}>
                <div className="section-title" style={{ marginBottom:5 }}>Description</div>
                <p style={{ fontSize:11, color:'var(--t2)', lineHeight:1.5 }}>{token.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
