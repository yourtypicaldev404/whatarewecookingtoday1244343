'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useWallet } from '@/lib/wallet/WalletProvider';
import { useLiveContractState } from '@/lib/indexer';
import {
  getBuyQuote, getSellQuote, bondingProgress, fmtDust,
  fmtTokens, fmtMcap, spotPrice, GRADUATION_TARGET,
  type BondingCurveState,
} from '@/lib/midnight/bondingCurve';
import type { TokenRecord } from '@/app/api/tokens/route';

const SLIPPAGE_OPTIONS = [15n, 30n, 50n, 75n];

export default function TokenPage() {
  const { address } = useParams<{ address: string }>();

  const [token, setToken]         = useState<TokenRecord | null>(null);
  const [tradeMode, setTradeMode] = useState<'buy'|'sell'>('buy');
  const [amount, setAmount]       = useState('');
  const [slippage, setSlippage]   = useState(30n);
  const [activeTab, setActiveTab] = useState<'trades'|'holders'>('trades');
  const [submitting, setSubmitting] = useState(false);
  const [txResult, setTxResult]   = useState<{ hash: string } | null>(null);
  const [txError, setTxError]     = useState<string | null>(null);

  const { connected, api, connect } = useWallet();
  const { state: liveState, loading: stateLoading } = useLiveContractState(address);

  // Fetch token metadata
  useEffect(() => {
    fetch(`/api/tokens/${address}`)
      .then(r => r.json())
      .then(({ token }) => setToken(token));
  }, [address]);

  // Build the bonding curve state from either live indexer data or token record
  const curveState: BondingCurveState | null = liveState ?? (token ? {
    adaReserve:   BigInt(token.adaReserve),
    tokenReserve: BigInt(token.tokenReserve),
    feeReserve:   0n,
    totalVolume:  BigInt(token.totalVolume),
    txCount:      token.txCount,
    state:        token.graduated ? 'GRADUATED' : 'ACTIVE',
  } : null);

  // Trade quote
  const adaIn    = amount ? BigInt(Math.floor(parseFloat(amount) * 1_000_000)) : 0n;
  const tokensIn = amount ? BigInt(Math.floor(parseFloat(amount) * 1_000_000_000_000)) : 0n;

  const buyQuote  = curveState && adaIn    > 0n ? getBuyQuote(adaIn, curveState.adaReserve, curveState.tokenReserve)    : null;
  const sellQuote = curveState && tokensIn > 0n ? getSellQuote(tokensIn, curveState.adaReserve, curveState.tokenReserve) : null;
  const quote = tradeMode === 'buy' ? buyQuote : sellQuote;

  const progress = curveState ? bondingProgress(curveState.adaReserve) : 0;

  const handleTrade = useCallback(async () => {
    if (!connected) { connect(); return; }
    if (!api || !curveState || !quote) return;

    setSubmitting(true);
    setTxError(null);
    setTxResult(null);

    try {
      // Import lazily to avoid SSR issues
      const { executeBuy, executeSell } = await import('@/lib/transactions');

      const result = tradeMode === 'buy'
        ? await executeBuy({ contractAddress: address, adaIn, slippageBps: slippage, currentState: curveState, walletAPI: api })
        : await executeSell({ contractAddress: address, tokensIn, slippageBps: slippage, currentState: curveState, walletAPI: api });

      setTxResult({ hash: result.txHash });
      setAmount('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Trade failed';
      setTxError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [connected, api, curveState, quote, tradeMode, adaIn, tokensIn, slippage, address]);

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', paddingTop: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        <Navbar />Loading…
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingTop: 56 }}>
      <Navbar />

      <div className="container" style={{ paddingTop: 28, paddingBottom: 80 }}>
        {/* Token header */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={{ width: 60, height: 60, borderRadius: 14, background: 'linear-gradient(135deg,#8b5cf6,#22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, border: '2px solid rgba(139,92,246,.3)', flexShrink: 0 }}>🌙</div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{token.name}</h1>
              <span className="badge badge-violet">${token.ticker}</span>
              {token.graduated && <span className="badge badge-green">✅ Graduated</span>}
              {token.lockedPercent > 0 && <span className="badge badge-amber">🔒 {token.lockedPercent}% locked</span>}
              {stateLoading && <span className="badge badge-cyan">syncing…</span>}
            </div>
            {curveState && (
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {[
                  { label: 'Mcap',    value: fmtMcap(curveState.adaReserve),                              color: 'var(--neon-violet-bright)' },
                  { label: 'Reserve', value: `₾${fmtDust(curveState.adaReserve)}`,                        color: undefined },
                  { label: 'Volume',  value: `₾${fmtDust(curveState.totalVolume, 0)}`,                    color: undefined },
                  { label: 'Holders', value: token.holderCount.toString(),                                 color: undefined },
                  { label: 'Txns',    value: curveState.txCount.toString(),                                color: undefined },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: color ?? 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Socials */}
          <div style={{ display: 'flex', gap: 7 }}>
            {token.website  && <a href={token.website}  target="_blank" rel="noopener" style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--night-raised)', border: '1px solid var(--night-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, textDecoration: 'none' }}>🌐</a>}
            {token.twitter  && <a href={token.twitter}  target="_blank" rel="noopener" style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--night-raised)', border: '1px solid var(--night-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', textDecoration: 'none' }}>𝕏</a>}
            {token.telegram && <a href={token.telegram} target="_blank" rel="noopener" style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--night-raised)', border: '1px solid var(--night-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, textDecoration: 'none' }}>✈️</a>}
          </div>
        </div>

        {/* Main two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Chart placeholder */}
            <div className="glass" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--night-border)' }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {['Price','Mcap'].map(m => (
                    <button key={m} style={{ background: m==='Price' ? 'rgba(139,92,246,.12)' : 'transparent', border: `1px solid ${m==='Price' ? 'rgba(139,92,246,.3)' : 'transparent'}`, color: m==='Price' ? 'var(--neon-violet-bright)' : 'var(--text-muted)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 500 }}>{m}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {['1m','5m','15m','1h','4h','1d'].map(tf => (
                    <button key={tf} style={{ background: tf==='5m' ? 'rgba(139,92,246,.12)' : 'transparent', border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', color: tf==='5m' ? 'var(--neon-violet-bright)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{tf}</button>
                  ))}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--neon-violet-bright)' }}>{token.ticker}/DUST</span>
              </div>
              <div style={{ height: 280, background: 'var(--night-void)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 28 }}>📈</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>lightweight-charts mounts here</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>install: npm install lightweight-charts</div>
              </div>
            </div>

            {/* Bonding curve progress */}
            <div className="glass" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Bonding Curve Progress</div>
                  {curveState && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>₾{fmtDust(curveState.adaReserve)} / ₾{fmtDust(GRADUATION_TARGET)} to graduate</div>}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: progress >= 100 ? 'var(--neon-green)' : 'var(--neon-violet-bright)' }}>{progress}%</div>
              </div>
              <div className="progress-bar" style={{ height: 9 }}>
                <div className={`progress-fill${token.graduated ? ' graduated' : ''}`} style={{ width: `${progress}%` }} />
              </div>
              {!token.graduated && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 7 }}>
                  When filled → liquidity migrates to Midnight DEX permanently 🎓
                </div>
              )}
            </div>

            {/* Trades / Holders tabs */}
            <div className="glass" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--night-border)' }}>
                {(['trades','holders'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    flex: 1, padding: '11px', background: activeTab===tab ? 'rgba(139,92,246,.07)' : 'transparent',
                    border: 'none', borderBottom: `2px solid ${activeTab===tab ? 'var(--neon-violet)' : 'transparent'}`,
                    color: activeTab===tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
                    transition: 'all .15s',
                  }}>
                    {tab.charAt(0).toUpperCase()+tab.slice(1)}
                    {tab==='holders' && <span style={{ marginLeft: 5, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>({token.holderCount})</span>}
                  </button>
                ))}
              </div>
              <div style={{ padding: '0 4px' }}>
                {activeTab === 'trades' ? (
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '24px 16px', textAlign: 'center' }}>
                    Live trades stream here via contractActions subscription<br/>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: .7 }}>wss://indexer.preprod.midnight.network/api/v3/graphql/ws</span>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '24px 16px', textAlign: 'center' }}>
                    Holder list populates from indexer unshieldedBalances
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: trade panel */}
          <div style={{ position: 'sticky', top: 72 }}>
            <div className="glass" style={{ padding: 18 }}>

              {/* Buy/Sell toggle */}
              <div style={{ display: 'flex', background: 'var(--night-deep)', border: '1px solid var(--night-border)', borderRadius: 10, padding: 3, gap: 2, marginBottom: 16 }}>
                {(['buy','sell'] as const).map(mode => (
                  <button key={mode} onClick={() => { setTradeMode(mode); setAmount(''); }} style={{
                    flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer',
                    background: tradeMode===mode ? mode==='buy' ? 'rgba(16,185,129,.13)' : 'rgba(251,113,133,.13)' : 'transparent',
                    border: tradeMode===mode ? mode==='buy' ? '1px solid rgba(16,185,129,.4)' : '1px solid rgba(251,113,133,.4)' : '1px solid transparent',
                    color: tradeMode===mode ? mode==='buy' ? 'var(--neon-green)' : 'var(--neon-rose)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                    transition: 'all .15s',
                  }}>{mode.charAt(0).toUpperCase()+mode.slice(1)}</button>
                ))}
              </div>

              {/* Slippage */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginRight: 3 }}>Slip</span>
                {[...SLIPPAGE_OPTIONS, 100n].map(s => (
                  <button key={s.toString()} onClick={() => setSlippage(s)} style={{
                    padding: '2px 7px', borderRadius: 5, fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                    background: slippage===s ? 'rgba(139,92,246,.18)' : 'transparent',
                    border: `1px solid ${slippage===s ? 'rgba(139,92,246,.4)' : 'rgba(255,255,255,.08)'}`,
                    color: slippage===s ? 'var(--neon-violet-bright)' : 'var(--text-muted)',
                    transition: 'all .1s',
                  }}>{s===100n ? '∞' : `${s}%`}</button>
                ))}
              </div>

              {/* Amount input */}
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  {tradeMode==='buy' ? 'DUST to spend' : `${token.ticker} to sell`}
                </span>
              </div>
              <input
                type="number" min="0" placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, marginBottom: 10 }}
              />

              {/* Quick amounts */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {(tradeMode==='buy'
                  ? ['25','100','250','500']
                  : ['25','50','75','100']
                ).map(q => (
                  <button key={q} onClick={() => setAmount(q)} style={{
                    flex: 1, padding: '5px 0',
                    background: 'var(--night-deep)', border: '1px solid var(--night-border)',
                    borderRadius: 7, cursor: 'pointer',
                    color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11,
                    transition: 'all .1s',
                  }}>
                    {tradeMode==='buy' ? `₾${q}` : `${q}%`}
                  </button>
                ))}
              </div>

              {/* Quote */}
              {quote && (
                <div style={{ background: 'var(--night-deep)', border: '1px solid var(--night-border)', borderRadius: 9, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>You receive</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                    {tradeMode==='buy' ? fmtTokens(quote.amountOut) : fmtDust(quote.amountOut)}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 5 }}>
                      {tradeMode==='buy' ? token.ticker : 'DUST'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Price impact</span>
                    <span style={{ color: quote.priceImpact > 5 ? 'var(--neon-rose)' : 'var(--neon-green)' }}>{quote.priceImpact.toFixed(2)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 3 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Fee (1%)</span>
                    <span style={{ color: 'var(--text-secondary)' }}>₾{fmtDust(quote.fee)}</span>
                  </div>
                </div>
              )}

              {/* Tx status */}
              {txResult && (
                <div style={{ background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--neon-green)' }}>
                  ✅ Tx: {txResult.hash.slice(0,14)}…
                </div>
              )}
              {txError && (
                <div style={{ background: 'rgba(251,113,133,.08)', border: '1px solid rgba(251,113,133,.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--neon-rose)' }}>
                  ⚠ {txError}
                </div>
              )}

              {/* Execute button */}
              <button
                className={tradeMode==='buy' ? 'btn btn-buy' : 'btn btn-sell'}
                onClick={handleTrade}
                disabled={submitting || (!amount)}
                style={{ opacity: submitting || !amount ? 0.6 : 1 }}
              >
                {submitting ? '⏳ Submitting…' :
                 !connected ? '🌙 Connect Lace to trade' :
                 tradeMode==='buy' ? `🟢 Buy ${token.ticker}` : `🔴 Sell ${token.ticker}`}
              </button>

              <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
                Non-custodial · ZK-protected · Midnight Preprod
              </div>
            </div>

            {/* Token info */}
            <div className="glass-raised" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Token info</div>
              {[
                { label: 'Contract', value: `${address.slice(0,10)}…${address.slice(-6)}`, mono: true },
                { label: 'Creator',  value: `${token.creatorAddr.slice(0,12)}…`,            mono: true },
                { label: 'Supply',   value: '1,000,000,000',                                mono: true },
                { label: 'Burn',     value: '1,000,000 (0.1%)',                             mono: true },
                { label: 'Fee',      value: '1% per trade',                                 mono: false },
                { label: 'Locked',   value: `${token.lockedPercent}%`,                      mono: false },
              ].map(({ label, value, mono }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: 12, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)', color: 'var(--text-secondary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
