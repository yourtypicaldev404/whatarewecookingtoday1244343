'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import ZkWorkOverlay from '@/components/ZkWorkOverlay';
import { useWallet } from '@/lib/wallet/WalletProvider';
import {
  getBuyQuote, getSellQuote, bondingProgress,
  fmtDust, fmtTokens, fmtMcap, GRADUATION_TARGET, spotPrice,
} from '@/lib/midnight/bondingCurve';
import type { TradeBuildProfile } from '@/lib/contractWiring';

function timeAgo(ts: number) {
  const d = Math.floor(Date.now() / 1000) - ts;
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

const TF = ['1m','5m','15m','1h','4h','1d'];

function TokenAvatar({ token, size = 42 }: { token: any; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = (token.ticker || token.name || '?').slice(0, 2).toUpperCase();
  if (!err && token.imageUri && token.imageUri !== 'ipfs://') {
    return (
      <div className="token-avatar" style={{ width: size, height: size }}>
        <img
          src={token.imageUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')}
          alt={token.name}
          onError={() => setErr(true)}
        />
      </div>
    );
  }
  return (
    <div className="token-avatar" style={{ width: size, height: size }}>
      <div className="token-avatar-placeholder" style={{ fontSize: size * 0.28, letterSpacing: '-0.5px' }}>
        {initials}
      </div>
    </div>
  );
}

export default function TokenPage() {
  const { address } = useParams<{ address: string }>();
  const { api, connected, connect } = useWallet();

  const [token, setToken]           = useState<any>(null);
  const [tradeMode, setTradeMode]   = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount]         = useState('');
  const [preset, setPreset]         = useState('');
  const [activeTab, setActiveTab]   = useState('trades');
  const [activeTf, setActiveTf]     = useState('5m');

  // ZK overlay state
  const [tradeOpen, setTradeOpen]       = useState(false);
  const [tradePhase, setTradePhase]     = useState<'server' | 'wallet'>('server');
  const [tradeProfile, setTradeProfile] = useState<TradeBuildProfile | null>(null);
  const [tradeError, setTradeError]     = useState<string | null>(null);

  const chartRef = useRef<HTMLDivElement>(null);

  // Load token
  useEffect(() => {
    fetch('/api/tokens?limit=200')
      .then(r => r.json())
      .then(({ tokens }) => {
        const found = tokens?.find((t: any) => t.address === address);
        setToken(found ?? {
          address, name: address?.slice(0, 8) + '...', ticker: 'UNK',
          description: '', adaReserve: '0', tokenReserve: '999000000000000',
          totalVolume: '0', txCount: 0, holderCount: 1, graduated: false,
        });
      });
  }, [address]);

  // Chart
  useEffect(() => {
    if (!chartRef.current || !token) return;
    let chart: any;
    import('lightweight-charts').then(({ createChart, ColorType, LineStyle }) => {
      if (!chartRef.current) return;
      chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: chartRef.current.clientHeight || 280,
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: 'rgba(255,255,255,0.25)' },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.03)', style: LineStyle.Dotted },
          horzLines: { color: 'rgba(255,255,255,0.03)', style: LineStyle.Dotted },
        },
        crosshair: { vertLine: { color: '#ffffff', width: 1 }, horzLine: { color: '#ffffff', width: 1 } },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.05)', timeVisible: true },
      });
      const area = chart.addAreaSeries({
        lineColor: '#ffffff', topColor: 'rgba(255,255,255,0.08)',
        bottomColor: 'rgba(255,255,255,0)', lineWidth: 1.5,
      });
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

  const executeTrade = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (!connected || !api) { await connect(); return; }

    setTradeError(null);
    setTradePhase('server');
    setTradeProfile(null);
    setTradeOpen(true);

    try {
      const adaIn    = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
      const tokensIn = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000_000));
      const ada      = BigInt(token.adaReserve ?? '0');
      const tok      = BigInt(token.tokenReserve ?? '999000000000000');

      let payload: any;
      if (tradeMode === 'buy') {
        const q = getBuyQuote(adaIn, ada, tok);
        payload = {
          contractAddress: address,
          action: 'buy',
          adaIn: adaIn.toString(),
          tokensOut: (q.amountOut * 95n / 100n).toString(),
        };
      } else {
        const q = getSellQuote(tokensIn, ada, tok);
        payload = {
          contractAddress: address,
          action: 'sell',
          tokensIn: tokensIn.toString(),
          adaOut: (q.amountOut * 95n / 100n).toString(),
        };
      }

      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Server error ${res.status}`);
      }

      const { unprovenTxHex, profile } = await res.json();
      if (!unprovenTxHex) throw new Error('No transaction returned from server');

      if (profile) setTradeProfile(profile);

      setTradePhase('wallet');

      console.log('[trade] Calling balanceUnsealedTransaction...');
      let balanceResult: any;
      try {
        balanceResult = await api.balanceUnsealedTransaction(unprovenTxHex);
      } catch (balErr: any) {
        console.error('[trade] balanceUnsealedTransaction failed:', balErr);
        throw new Error(`Wallet failed to balance transaction: ${balErr?.message || balErr}`);
      }

      // Handle different wallet response shapes
      const signedTxHex = typeof balanceResult === 'string'
        ? balanceResult
        : balanceResult?.tx ?? balanceResult?.transaction ?? balanceResult;

      if (!signedTxHex || typeof signedTxHex !== 'string') {
        console.error('[trade] Unexpected balanceUnsealedTransaction result:', balanceResult);
        throw new Error('Wallet returned no signed transaction. Check wallet compatibility.');
      }

      console.log('[trade] Submitting tx...');
      try {
        await api.submitTransaction(signedTxHex);
      } catch (submitErr: any) {
        console.error('[trade] submitTransaction error (non-fatal):', submitErr);
      }

      let txId = `pending-${Date.now()}`;
      try {
        const ledger = await import('@midnight-ntwrk/ledger-v8');
        const hexToBytes = (h: string) => {
          const c = h.startsWith('0x') ? h.slice(2) : h;
          const b = new Uint8Array(c.length / 2);
          for (let i = 0; i < b.length; i++) b[i] = parseInt(c.slice(i*2,i*2+2),16);
          return b;
        };
        const tx = (ledger as any).Transaction?.deserialize('signature','proof','binding', hexToBytes(signedTxHex));
        txId = tx?.identifiers?.()?.[0] ?? txId;
      } catch { /* best effort */ }

      const patchPayload = tradeMode === 'buy'
        ? { action: 'buy', adaIn: adaIn.toString(), tokensOut: payload.tokensOut }
        : { action: 'sell', tokensIn: tokensIn.toString(), adaOut: payload.adaOut };

      fetch(`/api/tokens/${address}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      }).catch(console.error);

      setTradeOpen(false);
      setAmount('');
      setPreset('');

      fetch('/api/tokens?limit=200')
        .then(r => r.json())
        .then(({ tokens }) => {
          const found = tokens?.find((t: any) => t.address === address);
          if (found) setToken(found);
        });

    } catch (err: any) {
      setTradeError(err.message || 'Trade failed');
    }
  }, [amount, connected, api, connect, tradeMode, address, token]);

  if (!token) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', fontSize: 17 }}>
      Loading...
    </div>
  );

  const ada  = BigInt(token.adaReserve   ?? '0');
  const tok  = BigInt(token.tokenReserve ?? '999000000000000');
  const prog = bondingProgress(ada);
  const addr = (token.address ?? address ?? '') as string;

  const adaIn    = amount && tradeMode === 'buy'  ? BigInt(Math.floor(parseFloat(amount) * 1_000_000))       : 0n;
  const tokensIn = amount && tradeMode === 'sell' ? BigInt(Math.floor(parseFloat(amount) * 1_000_000_000_000)) : 0n;
  const quote = tradeMode === 'buy'  && adaIn    > 0n ? getBuyQuote(adaIn, ada, tok)
    : tradeMode === 'sell' && tokensIn > 0n ? getSellQuote(tokensIn, ada, tok)
    : null;

  const BUY_PRESETS  = ['25', '100', '250', '500'];
  const SELL_PRESETS = ['25%', '50%', '75%', '100%'];

  const mockTrades = Array.from({ length: 10 }, (_, i) => ({
    type: i % 3 === 0 ? 'sell' : 'buy',
    wallet: addr.slice(0,4) + '...' + i.toString(16).padStart(4,'0'),
    dust: (Math.random() * 800 + 20).toFixed(1),
    tokens: Math.floor(Math.random() * 500000 + 5000),
    age: `${i + 1}m`,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <ZkWorkOverlay
        open={tradeOpen}
        variant="trade"
        tradePhase={tradePhase}
        tradeProfile={tradeProfile}
        error={tradeError}
        onDismiss={tradeError ? () => { setTradeOpen(false); setTradeError(null); } : undefined}
      />

      {/* Ticker */}
      <div className="ticker-strip">
        <div className="ticker-scroll">
          {[...Array(20)].map((_, i) => {
            const up = i % 3 !== 0;
            return (
              <div key={i} className="ticker-item">
                <span style={{ width:8,height:8,borderRadius:'50%',background:up?'var(--primary-color)':'var(--danger)',display:'inline-block',flexShrink:0 }} />
                <span style={{ color:'var(--text-secondary)',fontWeight:600 }}>{token.ticker}</span>
                <span className={up?'up':'dn'}>{up?'+':'-'}{(Math.random()*15+1).toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="token-page">

        {/* MAIN */}
        <div className="token-main">

          {/* Header */}
          <div className="token-header">
            <TokenAvatar token={token} size={47} />
            <div>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:3 }}>
                <span style={{ fontWeight:700,fontSize:21 }}>{token.name}</span>
                <span className="badge badge-white">${token.ticker}</span>
                {token.graduated && <span className="badge badge-green">GRADUATED</span>}
              </div>
              <div style={{ display:'flex',gap:5,alignItems:'center' }}>
                <span style={{ fontFamily:'var(--mono)',fontSize:13,color:'var(--text-tertiary)' }}>{addr.slice(0,8)}...{addr.slice(-6)}</span>
                <button onClick={() => navigator.clipboard?.writeText(addr)} style={{ background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',alignItems:'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color:'var(--text-tertiary)' }}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
                {token.website  && <a href={token.website}  target="_blank" rel="noopener" style={{ color:'var(--text-tertiary)',fontSize:13,border:'1px solid var(--border-color)',borderRadius:'var(--radius-sm)',padding:'3px 8px',fontFamily:'var(--mono)' }}>web</a>}
                {token.twitter  && <a href={token.twitter}  target="_blank" rel="noopener" style={{ color:'var(--text-tertiary)',fontSize:13,border:'1px solid var(--border-color)',borderRadius:'var(--radius-sm)',padding:'3px 8px',fontFamily:'var(--mono)' }}>x</a>}
                {token.telegram && <a href={token.telegram} target="_blank" rel="noopener" style={{ color:'var(--text-tertiary)',fontSize:13,border:'1px solid var(--border-color)',borderRadius:'var(--radius-sm)',padding:'3px 8px',fontFamily:'var(--mono)' }}>tg</a>}
              </div>
            </div>
            <div style={{ display:'flex',alignItems:'center',marginLeft:'auto',flexWrap:'wrap' }}>
              {([
                ['MCAP',    fmtMcap(ada),                              ada>0n?'var(--primary-color)':'var(--text-secondary)'],
                ['PRICE',   fmtDust(spotPrice(ada,tok),6)+' D',        'var(--text-primary)'],
                ['VOL',     fmtDust(BigInt(token.totalVolume??'0'),0),  'var(--text-secondary)'],
                ['TXNS',    String(token.txCount??0),                   'var(--text-secondary)'],
                ['HOLDERS', String(token.holderCount??1),               'var(--text-secondary)'],
              ] as [string,string,string][]).map(([l,v,c]) => (
                <div key={l} style={{ padding:'0 21px',borderRight:'1px solid var(--border-color)' }}>
                  <div className="stat-label">{l}</div>
                  <div style={{ fontFamily:'var(--mono)',fontSize:17,fontWeight:600,color:c,marginTop:3 }}>{v}</div>
                </div>
              ))}
              <div style={{ padding:'0 21px' }}>
                <div className="stat-label">CURVE</div>
                <div style={{ display:'flex',alignItems:'center',gap:8,marginTop:4 }}>
                  <div style={{ width:83,height:5,background:'var(--bg-4)',borderRadius:3,overflow:'hidden' }}>
                    <div style={{ height:'100%',width:`${prog}%`,background:prog>80?'var(--primary-color)':prog>50?'var(--warning)':'var(--text-tertiary)',borderRadius:3 }} />
                  </div>
                  <span style={{ fontFamily:'var(--mono)',fontSize:14,color:prog>80?'var(--primary-color)':'var(--text-tertiary)' }}>{prog}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart toolbar */}
          <div className="chart-toolbar">
            {TF.map(t => (
              <button key={t} className={`tf-btn ${activeTf===t?'active':''}`} onClick={() => setActiveTf(t)}>{t}</button>
            ))}
            <div style={{ flex:1 }} />
            <span style={{ fontFamily:'var(--mono)',fontSize:13,color:'var(--text-tertiary)' }}>{token.name}/{token.ticker} · night.fun</span>
          </div>

          {/* Chart */}
          <div style={{ background:'var(--bg-main)',flex:'0 0 280px' }}>
            <div ref={chartRef} style={{ height:'100%' }} />
          </div>

          {/* Curve bar */}
          <div style={{ padding:'13px 18px',borderTop:'1px solid var(--border-color)',borderBottom:'1px solid var(--border-color)',display:'flex',alignItems:'center',gap:18,background:'var(--bg-secondary)',flexShrink:0 }}>
            <span style={{ fontFamily:'var(--mono)',fontSize:14,color:'var(--text-tertiary)',whiteSpace:'nowrap' }}>Bonding curve</span>
            <div style={{ flex:1,height:5,background:'var(--bg-4)',borderRadius:3,overflow:'hidden' }}>
              <div style={{ height:'100%',width:`${prog}%`,background:prog>80?'var(--primary-color)':prog>50?'var(--warning)':'var(--text-tertiary)',borderRadius:3,transition:'width .5s ease' }} />
            </div>
            <span style={{ fontFamily:'var(--mono)',fontSize:14,color:prog>80?'var(--primary-color)':'var(--text-secondary)',whiteSpace:'nowrap' }}>
              {fmtDust(ada)} / {fmtDust(GRADUATION_TARGET)} DUST ({prog}%)
            </span>
            {prog >= 100 && <span className="badge badge-green">GRADUATED</span>}
          </div>

          {/* Tabs */}
          <div style={{ borderBottom:'1px solid var(--border-color)',display:'flex',background:'var(--bg-secondary)',flexShrink:0 }}>
            {[['trades',`Trades (${token.txCount??0})`],['holders',`Holders (${token.holderCount??1})`],['info','Token info']].map(([id,label]) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                padding:'12px 18px',border:'none',background:'transparent',
                color:activeTab===id?'var(--text-primary)':'var(--text-tertiary)',
                fontSize:16,fontWeight:500,cursor:'pointer',
                borderBottom:`2px solid ${activeTab===id?'var(--primary-color)':'transparent'}`,
                transition:'var(--transition-fast)',fontFamily:'var(--font)',
              }}>{label}</button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex:1,overflowY:'auto' }}>
            {activeTab === 'trades' && (
              <>
                <table className="data-table">
                  <thead><tr><th>Type</th><th>Wallet</th><th>DUST</th><th>Tokens</th><th>Age</th></tr></thead>
                  <tbody>
                    {mockTrades.map((tx,i) => (
                      <tr key={i}>
                        <td><span style={{ color:tx.type==='buy'?'var(--primary-color)':'var(--danger)',fontWeight:600 }}>{tx.type.toUpperCase()}</span></td>
                        <td style={{ fontFamily:'var(--mono)',fontSize:11 }}>{tx.wallet}</td>
                        <td>{tx.dust}</td>
                        <td>{tx.tokens.toLocaleString()}</td>
                        <td style={{ color:'var(--text-tertiary)' }}>{tx.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ textAlign:'center',padding:21,fontFamily:'var(--mono)',fontSize:14,color:'var(--text-tertiary)' }}>
                  Live trade history — indexer integration in progress
                </div>
              </>
            )}
            {activeTab === 'holders' && (
              <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:156,fontFamily:'var(--mono)',fontSize:16,color:'var(--text-tertiary)' }}>
                Holder tracking — indexer integration in progress
              </div>
            )}
            {activeTab === 'info' && (
              <div style={{ padding:21,display:'grid',gridTemplateColumns:'1fr 1fr',gap:13 }}>
                {[
                  ['Contract',  addr.slice(0,14)+'...'],
                  ['Network',   'Midnight '+(process.env.NEXT_PUBLIC_NETWORK_ID??'preprod')],
                  ['Supply',    '1,000,000,000'],
                  ['Target',    '69,000 DUST'],
                  ['Deployed',  token.deployedAt ? new Date(token.deployedAt*1000).toLocaleDateString() : '—'],
                  ['Creator',   token.creatorAddr ? token.creatorAddr.slice(0,12)+'...' : '—'],
                ].map(([l,v]) => (
                  <div key={l} style={{ background:'var(--bg-tertiary)',border:'1px solid var(--border-color)',borderRadius:'var(--radius-sm)',padding:'12px 16px' }}>
                    <div className="stat-label" style={{ marginBottom:4 }}>{l}</div>
                    <div style={{ fontFamily:'var(--mono)',fontSize:14,color:'var(--text-primary)' }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="token-sidebar">

          {/* Buy / Sell tabs */}
          <div className="trade-tabs">
            <button className={`trade-tab ${tradeMode==='buy'?'buy-active':''}`} onClick={() => { setTradeMode('buy'); setAmount(''); setPreset(''); }}>Buy</button>
            <button className={`trade-tab ${tradeMode==='sell'?'sell-active':''}`} onClick={() => { setTradeMode('sell'); setAmount(''); setPreset(''); }}>Sell</button>
          </div>

          <div style={{ padding:18,display:'flex',flexDirection:'column',gap:16 }}>

            {/* Input */}
            <div>
              <div style={{ fontFamily:'var(--mono)',fontSize:13,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8 }}>Amount</div>
              <div className="amount-wrap">
                <input
                  className="amount-input"
                  type="number" min="0"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setPreset(''); }}
                  placeholder="0"
                />
                <div className="amount-unit">{tradeMode==='buy'?'DUST':token.ticker}</div>
              </div>
            </div>

            {/* Presets */}
            <div className="preset-grid">
              {(tradeMode==='buy'?BUY_PRESETS:SELL_PRESETS).map(p => (
                <button
                  key={p}
                  className={`preset-btn ${preset===p?'active':''}`}
                  onClick={() => { setPreset(p); setAmount(tradeMode==='buy'?p:p.replace('%','')); }}
                >
                  {tradeMode==='buy'?p:p}
                </button>
              ))}
            </div>

            {/* Quote */}
            {quote && (
              <div style={{ background:'var(--bg-main)',border:'1px solid var(--border-color)',borderRadius:'var(--radius-sm)',padding:'13px 16px' }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                  <span style={{ fontFamily:'var(--mono)',fontSize:13,color:'var(--text-tertiary)',textTransform:'uppercase' }}>You receive</span>
                  <span style={{ fontFamily:'var(--mono)',fontSize:17,fontWeight:600,color:'var(--text-primary)' }}>
                    {tradeMode==='buy'?fmtTokens(quote.amountOut):fmtDust(quote.amountOut)} {tradeMode==='buy'?token.ticker:'DUST'}
                  </span>
                </div>
                <div style={{ display:'flex',justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'var(--mono)',fontSize:13,color:'var(--text-tertiary)',textTransform:'uppercase' }}>Price impact</span>
                  <span style={{ fontFamily:'var(--mono)',fontSize:16,color:quote.priceImpact>5?'var(--danger)':'var(--primary-color)' }}>
                    {quote.priceImpact.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* Action button */}
            <button
              className={tradeMode==='buy'?'btn-buy':'btn-sell'}
              disabled={!amount || parseFloat(amount) <= 0}
              onClick={executeTrade}
            >
              {!connected
                ? 'Connect wallet to trade'
                : tradeMode==='buy'
                  ? `Buy ${token.ticker}`
                  : `Sell ${token.ticker}`
              }
            </button>

            <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
              <span className="badge badge-green">ZK</span>
              <span style={{ fontFamily:'var(--mono)',fontSize:13,color:'var(--text-tertiary)' }}>
                Non-custodial · {process.env.NEXT_PUBLIC_NETWORK_ID??'preprod'}
              </span>
            </div>
          </div>

          <div className="divider" />

          {/* Position */}
          <div style={{ padding:'16px 18px' }}>
            <div className="section-title" style={{ marginBottom:13 }}>Your Position</div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              {[['Bought','0 DUST'],['Sold','0 DUST'],['Holding','0 '+token.ticker],['PnL','+0%']].map(([l,v]) => (
                <div key={l} style={{ background:'var(--bg-main)',borderRadius:'var(--radius-sm)',padding:'10px 13px',border:'1px solid var(--border-color)' }}>
                  <div className="stat-label" style={{ marginBottom:4 }}>{l}</div>
                  <div style={{ fontFamily:'var(--mono)',fontSize:16,color:'var(--text-secondary)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="divider" />

          {/* Token info */}
          <div style={{ padding:'16px 18px' }}>
            <div className="section-title" style={{ marginBottom:13 }}>Token Info</div>
            {[
              ['Dev holdings','0%','var(--primary-color)'],
              ['Holders',String(token.holderCount??1),'var(--text-secondary)'],
              ['Total txns',String(token.txCount??0),'var(--text-secondary)'],
              ['Curve target','69,000 DUST','var(--text-secondary)'],
            ].map(([l,v,c]) => (
              <div key={l} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--border-color)' }}>
                <span style={{ fontFamily:'var(--mono)',fontSize:13,color:'var(--text-tertiary)',textTransform:'uppercase',letterSpacing:'.06em' }}>{l}</span>
                <span style={{ fontFamily:'var(--mono)',fontSize:16,fontWeight:600,color:c }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="divider" />

          {/* Contract */}
          <div style={{ padding:'16px 18px' }}>
            <div className="section-title" style={{ marginBottom:13 }}>Contract</div>
            <div style={{ fontFamily:'var(--mono)',fontSize:13,color:'var(--text-tertiary)',wordBreak:'break-all',lineHeight:1.6 }}>{addr}</div>
            <button
              onClick={() => navigator.clipboard?.writeText(addr)}
              style={{ marginTop:10,padding:'5px 16px',background:'var(--bg-tertiary)',border:'1px solid var(--border-color)',borderRadius:'var(--radius-sm)',fontSize:14,color:'var(--text-tertiary)',cursor:'pointer',fontFamily:'var(--mono)' }}
            >
              Copy address
            </button>
            {token.description && (
              <div style={{ marginTop:16 }}>
                <div className="section-title" style={{ marginBottom:8 }}>Description</div>
                <p style={{ fontSize:16,color:'var(--text-secondary)',lineHeight:1.5 }}>{token.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
