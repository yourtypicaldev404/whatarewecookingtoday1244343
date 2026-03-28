'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { getBuyQuote, getSellQuote, bondingProgress, fmtDust, fmtTokens, fmtMcap, GRADUATION_TARGET, spotPrice, timeAgo } from '@/lib/midnight/bondingCurve';

export default function TokenPage() {
  const { address } = useParams<{ address: string }>();
  const [token, setToken] = useState<any>(null);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [activeTab, setActiveTab] = useState('trades');
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    fetch('/api/tokens?limit=100')
      .then(r => r.json())
      .then(({ tokens }) => {
        const found = tokens?.find((t: any) => t.address === address);
        setToken(found ?? {
          address, name: address?.slice(0, 8) + '…', ticker: 'UNK',
          description: '', adaReserve: '0', tokenReserve: '999000000000000',
          totalVolume: '0', txCount: 0, holderCount: 1, graduated: false, lockedPercent: 0,
        });
      });
  }, [address]);

  useEffect(() => {
    if (!chartRef.current) return;
    let chart: any;
    import('lightweight-charts').then(({ createChart, ColorType, LineStyle }) => {
      chart = createChart(chartRef.current!, {
        width: chartRef.current!.clientWidth,
        height: chartRef.current!.clientHeight || 280,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'rgba(255,255,255,0.3)',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.03)', style: LineStyle.Dotted },
          horzLines: { color: 'rgba(255,255,255,0.03)', style: LineStyle.Dotted },
        },
        crosshair: { vertLine: { color: '#00E5A0' }, horzLine: { color: '#00E5A0' } },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true },
      });
      const series = chart.addAreaSeries({
        lineColor: '#00E5A0',
        topColor: 'rgba(0,229,160,0.18)',
        bottomColor: 'rgba(0,229,160,0.0)',
        lineWidth: 2,
      });
      const now = Math.floor(Date.now() / 1000);
      const data = Array.from({ length: 60 }, (_, i) => ({
        time: (now - (60 - i) * 300) as any,
        value: 0.000001 * (1 + Math.random() * 0.4 + i * 0.025),
      }));
      series.setData(data);
      chart.timeScale().fitContent();
      chartInstance.current = chart;
    });
    return () => { chart?.remove(); };
  }, [token]);

  const ada = token ? BigInt(token.adaReserve ?? '0') : 0n;
  const tok = token ? BigInt(token.tokenReserve ?? '999000000000000') : 999000000000000n;
  const adaIn = amount ? BigInt(Math.floor(parseFloat(amount) * 1_000_000)) : 0n;
  const tokensIn = amount ? BigInt(Math.floor(parseFloat(amount) * 1_000_000_000_000)) : 0n;
  const quote = tradeMode === 'buy' && adaIn > 0n ? getBuyQuote(adaIn, ada, tok)
    : tradeMode === 'sell' && tokensIn > 0n ? getSellQuote(tokensIn, ada, tok)
    : null;
  const progress = bondingProgress(ada);
  const addr = (token?.address ?? address ?? '') as string;

  const mockTrades = Array.from({ length: 8 }, (_, i) => ({
    type: i % 3 === 0 ? 'sell' : 'buy',
    wallet: '0x' + Math.random().toString(16).slice(2, 10) + '…',
    dust: (Math.random() * 500 + 10).toFixed(1),
    tokens: (Math.random() * 50000 + 1000).toFixed(0),
    age: `${Math.floor(Math.random() * 59) + 1}m`,
  }));

  if (!token) return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 80px)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        Loading…
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* Ticker strip */}
      <div className="ticker-strip">
        <div className="ticker-scroll">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="ticker-item">
              <span style={{ color: 'var(--text-dim)', fontSize: 8 }}>●</span>
              <span style={{ fontWeight: 600 }}>{token.ticker ?? 'TKN'}</span>
              <span className={i % 3 === 0 ? 'down' : 'up'}>{i % 3 === 0 ? '-' : '+'}{(Math.random() * 20 + 1).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main 2-col layout */}
      <div className="token-page">

        {/* ── LEFT / CENTER ── */}
        <div className="token-main">

          {/* Token header bar */}
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <div className="token-avatar" style={{ width: 36, height: 36, fontSize: 16 }}>
              {token.imageUri && token.imageUri !== 'ipfs://'
                ? <img src={token.imageUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} alt={token.name} onError={e => { (e.target as any).parentElement.innerHTML = '🌙'; }} />
                : '🌙'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800 }}>{token.name}</span>
                <span className="badge badge-violet">${token.ticker}</span>
                {token.graduated && <span className="badge badge-green">GRADUATED</span>}
                {token.lockedPercent > 0 && <span className="badge badge-amber">🔒 {token.lockedPercent}% locked</span>}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                <span className="addr">{addr.slice(0, 8)}…{addr.slice(-6)}</span>
                {token.website  && <a href={token.website}  target="_blank" rel="noopener" className="badge" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>🌐</a>}
                {token.twitter  && <a href={token.twitter}  target="_blank" rel="noopener" className="badge" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>𝕏</a>}
                {token.telegram && <a href={token.telegram} target="_blank" rel="noopener" className="badge" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>✈️</a>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginLeft: 'auto', flexWrap: 'wrap' }}>
              {[
                ['MCAP',    fmtMcap(ada),                            'var(--teal)'],
                ['PRICE',   '₾' + fmtDust(spotPrice(ada, tok), 6), null],
                ['VOL',     '₾' + fmtDust(BigInt(token.totalVolume ?? '0'), 0), null],
                ['HOLDERS', token.holderCount,                       null],
                ['TXNS',    token.txCount,                           null],
              ].map(([l, v, c]: any) => (
                <div key={l}>
                  <div className="stat-label">{l}</div>
                  <div className="stat-value" style={{ fontSize: 13, color: c ?? 'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart area */}
          <div style={{
            background: 'var(--bg-base)',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '8px 0 0',
            flex: '0 0 300px',
            position: 'relative',
          }}>
            {/* Timeframe buttons */}
            <div style={{ display: 'flex', gap: 2, padding: '0 10px 6px', alignItems: 'center' }}>
              {['1m','5m','15m','1h','4h','1d'].map(t => (
                <button key={t} style={{
                  padding: '2px 8px', border: 'none',
                  background: t === '5m' ? 'var(--bg-elevated)' : 'transparent',
                  color: t === '5m' ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderRadius: 4, fontSize: 11, cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                }}>{t}</button>
              ))}
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                {token.name}/{token.ticker} · night.fun
              </span>
            </div>
            <div ref={chartRef} style={{ height: 260, padding: '0 0 0 0' }} />
          </div>

          {/* Bonding curve */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600 }}>Bonding Curve</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', marginLeft: 10 }}>
                  ₾{fmtDust(ada)} / ₾{fmtDust(GRADUATION_TARGET)} to graduate
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: progress > 80 ? 'var(--green)' : 'var(--teal)' }}>
                {progress}%
              </span>
            </div>
            <div className="progress-track" style={{ height: 6 }}>
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            {progress >= 100 && (
              <div style={{ marginTop: 8 }} className="badge badge-green">🎓 Graduated — listing on NorthStar DEX</div>
            )}
          </div>

          {/* Bottom data tables */}
          <div style={{ flex: 1 }}>
            {/* Tabs */}
            <div style={{
              display: 'flex', borderBottom: '1px solid var(--border-subtle)',
              padding: '0 4px',
            }}>
              {[
                { id: 'trades', label: `Trades (${token.txCount ?? 0})` },
                { id: 'holders', label: `Holders (${token.holderCount ?? 1})` },
                { id: 'info', label: 'Token Info' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  padding: '8px 12px',
                  border: 'none', background: 'transparent',
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  borderBottom: activeTab === tab.id ? '2px solid var(--teal)' : '2px solid transparent',
                  transition: 'all 0.12s',
                  fontFamily: 'var(--font-body)',
                }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Trades table */}
            {activeTab === 'trades' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Wallet</th>
                      <th>DUST</th>
                      <th>Tokens</th>
                      <th>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockTrades.map((tx, i) => (
                      <tr key={i}>
                        <td>
                          <span style={{ color: tx.type === 'buy' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                            {tx.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="addr">{tx.wallet}</td>
                        <td>₾{tx.dust}</td>
                        <td>{Number(tx.tokens).toLocaleString()}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{tx.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ textAlign: 'center', padding: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  Real trade history coming soon — indexer integration in progress
                </div>
              </div>
            )}

            {/* Holders */}
            {activeTab === 'holders' && (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                Holder tracking — indexer integration in progress
              </div>
            )}

            {/* Token info */}
            {activeTab === 'info' && (
              <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Contract', addr.slice(0, 12) + '…'],
                  ['Network', 'Midnight Preprod'],
                  ['Curve Target', '₾69,000 DUST'],
                  ['Token Supply', '999T'],
                  ['Creator', token.creatorAddr ? token.creatorAddr.slice(0, 12) + '…' : '—'],
                  ['Deployed', token.deployedAt ? new Date(token.deployedAt * 1000).toLocaleDateString() : '—'],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 10px' }}>
                    <div className="stat-label" style={{ marginBottom: 3 }}>{l}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="token-sidebar">

          {/* Buy / Sell panel */}
          <div style={{ padding: 12, borderBottom: '1px solid var(--border-subtle)' }}>

            {/* Mode tabs */}
            <div className="tab-row" style={{ marginBottom: 10 }}>
              <button
                className={`btn-tab ${tradeMode === 'buy' ? 'tab-buy' : ''}`}
                onClick={() => { setTradeMode('buy'); setAmount(''); }}
              >Buy</button>
              <button
                className={`btn-tab ${tradeMode === 'sell' ? 'tab-sell' : ''}`}
                onClick={() => { setTradeMode('sell'); setAmount(''); }}
              >Sell</button>
            </div>

            {/* Amount input */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                className="amount-input"
                type="number"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
              />
              <span style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
              }}>
                {tradeMode === 'buy' ? 'DUST' : token.ticker}
              </span>
            </div>

            {/* Preset amounts */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
              {(tradeMode === 'buy' ? ['25', '100', '250', '500'] : ['25%', '50%', '75%', '100%']).map(p => (
                <button key={p} className="preset-btn" onClick={() => setAmount(tradeMode === 'buy' ? p : p.replace('%', ''))}>
                  {tradeMode === 'buy' ? `₾${p}` : p}
                </button>
              ))}
            </div>

            {/* Quote preview */}
            {quote && (
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 7,
                padding: '10px 11px',
                marginBottom: 10,
              }}>
                <div className="stat-label" style={{ marginBottom: 5 }}>You receive</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600 }}>
                    {tradeMode === 'buy' ? fmtTokens(quote.amountOut) : fmtDust(quote.amountOut)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    {tradeMode === 'buy' ? token.ticker : 'DUST'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span className="stat-label">Price impact</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: quote.priceImpact > 5 ? 'var(--red)' : 'var(--green)',
                  }}>
                    {quote.priceImpact.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* Action button */}
            <button
              className={tradeMode === 'buy' ? 'btn-buy' : 'btn-sell'}
              onClick={async () => {
                if (!amount || parseFloat(amount) <= 0) { alert('Enter an amount first'); return; }
                try {
                  const adaInAmt = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
                  const tokensInAmt = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000_000));
                  if (tradeMode === 'buy') {
                    const q = getBuyQuote(adaInAmt, ada, tok);
                    const minTokens = q.amountOut * 95n / 100n;
                    const { submitBuyTx } = await import('@/lib/trading');
                    const result = await submitBuyTx({ contractAddress: address as string, adaIn: adaInAmt, tokensOut: minTokens });
                    alert('Buy submitted! Tx: ' + result.txId);
                  } else {
                    const q = getSellQuote(tokensInAmt, ada, tok);
                    const minAda = q.amountOut * 95n / 100n;
                    const { submitSellTx } = await import('@/lib/trading');
                    const result = await submitSellTx({ contractAddress: address as string, tokensIn: tokensInAmt, adaOut: minAda });
                    alert('Sell submitted! Tx: ' + result.txId);
                  }
                } catch (err: any) {
                  alert('Trade failed: ' + err.message);
                }
              }}
            >
              {tradeMode === 'buy' ? `🟢 Buy ${token.ticker}` : `🔴 Sell ${token.ticker}`}
            </button>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <span className="badge badge-teal">ZK</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>
                Non-custodial · Midnight {process.env.NEXT_PUBLIC_NETWORK_ID ?? 'preprod'}
              </span>
            </div>
          </div>

          {/* Position summary */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="section-title" style={{ marginBottom: 8 }}>Your Position</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['Bought', '₾0'],
                ['Sold', '₾0'],
                ['Holding', '0 ' + token.ticker],
                ['PnL', '+0%'],
              ].map(([l, v]) => (
                <div key={l} style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: '7px 9px' }}>
                  <div className="stat-label" style={{ marginBottom: 2 }}>{l}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Token info panel */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Token Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Top 10 H.', '—', 'var(--text-secondary)'],
                ['Dev Holdings', '0%', 'var(--green)'],
                ['LP Burned', '—', 'var(--text-secondary)'],
                ['Holders', String(token.holderCount ?? 1), 'var(--text-secondary)'],
              ].map(([l, v, c]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="stat-label">{l}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contract address */}
          <div style={{ padding: '10px 12px' }}>
            <div className="section-title" style={{ marginBottom: 8 }}>Contract</div>
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '8px 10px',
            }}>
              <div className="stat-label" style={{ marginBottom: 3 }}>CA</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                {addr}
              </div>
              <button
                onClick={() => navigator.clipboard?.writeText(addr)}
                style={{
                  marginTop: 6,
                  padding: '3px 8px',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Copy
              </button>
            </div>

            {token.description && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                <div className="stat-label" style={{ marginBottom: 4 }}>Description</div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{token.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}