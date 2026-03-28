'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
<<<<<<< HEAD
import ZkWorkOverlay from '@/components/ZkWorkOverlay';
import { getBuyQuote, getSellQuote, bondingProgress, fmtDust, fmtTokens, fmtMcap, GRADUATION_TARGET, calcTokensOut, calcAdaOut } from '@/lib/midnight/bondingCurve';
import {
  buildProvedTradeTx,
  finalizeTradeInWallet,
  type TradeParams,
  type TradeBuildProfile,
} from '@/lib/contractWiring';
import { MIDNIGHT_NETWORK_CAPTION } from '@/lib/network';
import { useWallet } from '@/lib/wallet/WalletProvider';
=======
import { getBuyQuote, getSellQuote, bondingProgress, fmtDust, fmtTokens, fmtMcap, GRADUATION_TARGET, spotPrice, timeAgo } from '@/lib/midnight/bondingCurve';
>>>>>>> 27ae2c7 (feat: Cryptographic Noir UI redesign)

export default function TokenPage() {
  const { address } = useParams<{ address: string }>();
  const [token, setToken] = useState<any>(null);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
<<<<<<< HEAD
  const [trading, setTrading] = useState(false);
  const [txResult, setTxResult] = useState<{ txId: string; profile?: TradeBuildProfile } | null>(null);
  const [tradePhase, setTradePhase] = useState<'server' | 'wallet' | null>(null);
  const [tradeProfile, setTradeProfile] = useState<TradeBuildProfile | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [contractMissing, setContractMissing] = useState(false);

  useEffect(() => {
    if (!address) return;
    fetch('/api/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractAddress: address, action: 'buy', adaIn: '1000000', tokensOut: '1' }),
    }).then(async r => {
      if (!r.ok) {
        const text = await r.text();
        let msg = text;
        try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch {}
        if (/no public state found at contract address/i.test(msg)) {
          setContractMissing(true);
        }
      }
    }).catch(() => {});
  }, [address]);
=======
  const [activeTab, setActiveTab] = useState('trades');
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);
>>>>>>> 27ae2c7 (feat: Cryptographic Noir UI redesign)

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

<<<<<<< HEAD
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
    setTradePhase('server');
    setTradeProfile(null);

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

      const { provedTxHex } = await buildProvedTradeTx(params, api);
      setTradePhase('wallet');

      const { txId, walletMs } = await finalizeTradeInWallet(api, provedTxHex, {
        contractAddress: params.contractAddress,
        action: params.action,
      });
      setTxResult({ txId, profile: { createUnprovenMs: 0, serverTotalMs: 0, walletMs } });

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
=======
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
>>>>>>> 27ae2c7 (feat: Cryptographic Noir UI redesign)
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

<<<<<<< HEAD
          <div style={{ position:'sticky', top:72 }}>
            {contractMissing && (
              <div style={{ background:'rgba(251,113,133,.1)', border:'1px solid rgba(251,113,133,.35)', borderRadius:10, padding:'12px 14px', marginBottom:12, fontFamily:'var(--font-mono)', fontSize:12 }}>
                <div style={{ fontWeight:700, color:'var(--neon-rose)', marginBottom:4 }}>Contract not found on-chain</div>
                <div style={{ color:'var(--text-secondary)', lineHeight:1.5 }}>
                  This token's contract no longer exists on the indexer. The testnet was likely reset after it was deployed.
                  <br />
                  <a href="/launch" style={{ color:'var(--neon-violet-bright)', textDecoration:'underline', marginTop:4, display:'inline-block' }}>Launch a new token →</a>
                </div>
              </div>
            )}
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
                  <span style={{ color:'var(--text-secondary)', wordBreak:'break-all' }} title="Transaction id">{txResult.txId}</span>
                  <br/>
                  {txResult.profile ? (
                    <span style={{ color:'var(--text-muted)', display:'block', marginTop:6 }}>
                      Server {Math.round(txResult.profile.serverTotalMs / 1000)}s · wallet {txResult.profile.walletMs != null ? `${(txResult.profile.walletMs / 1000).toFixed(1)}s` : '—'}
                      {txResult.profile.proxyRoundTripMs != null
                        ? ` · round-trip ${(txResult.profile.proxyRoundTripMs / 1000).toFixed(1)}s`
                        : ''}
                    </span>
                  ) : null}
                  <span style={{ color:'var(--text-muted)', display:'block', marginTop:6 }}>Confirm status in Lace activity if needed.</span>
                </div>
              )}

              {!connected && (
                <p style={{ fontSize:12, color:'var(--neon-amber)', marginBottom:10 }}>Connect Lace to buy or sell — your keys stay in the wallet.</p>
              )}

              <button
                className={`btn btn-${tradeMode}`}
                onClick={handleTrade}
                disabled={trading || !amount || !quote || contractMissing}
                style={{ opacity: (trading || !amount || !quote || contractMissing) ? 0.6 : 1, cursor: (trading || !amount || !quote || contractMissing) ? 'not-allowed' : 'pointer' }}
              >
                {trading
                  ? 'Working…'
                  : tradeMode === 'buy'
                    ? `Buy ${token.ticker}`
                    : `Sell ${token.ticker}`}
              </button>
              <div style={{ textAlign:'center', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', marginTop:8 }}>Non-custodial · ZK-protected · {MIDNIGHT_NETWORK_CAPTION}</div>
=======
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
>>>>>>> 27ae2c7 (feat: Cryptographic Noir UI redesign)
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