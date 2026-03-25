/**
 * night.fun — Bonding Curve Math
 * Mirrors the exact Compact contract arithmetic (Uint<128> throughout).
 * All bigint values are in base units (6 decimal places).
 */

// ── Constants (must match bonding_curve.compact exactly) ──────────────────────

export const TOTAL_SUPPLY      = 1_000_000_000_000_000n;   // 1B tokens, 6 dec
export const BURN_AMOUNT       = 1_000_000_000n;            // 1M tokens
export const GRADUATION_TARGET = 69_000_000_000n;           // 69k DUST
export const VIRTUAL_ADA       = 2_550_000_000n;            // price floor
export const FEE_BPS           = 100n;
export const BPS_DENOM         = 10_000n;
export const PRICE_SCALE       = 1_000_000n;
export const SOCIAL_FEE        = 150_000_000n;              // 150 DUST

export const CIRCULATING_SUPPLY = TOTAL_SUPPLY - BURN_AMOUNT;

// ── Core AMM math ─────────────────────────────────────────────────────────────

export function calcTokensOut(
  adaIn:      bigint,
  curAda:     bigint,
  curTokens:  bigint,
): bigint {
  const realAda  = curAda + VIRTUAL_ADA;
  const k        = realAda * curTokens;
  const newAda   = realAda + adaIn;
  const newToks  = k / newAda;
  return curTokens - newToks;
}

export function calcAdaOut(
  tokensIn:  bigint,
  curAda:    bigint,
  curTokens: bigint,
): bigint {
  const realAda  = curAda + VIRTUAL_ADA;
  const k        = realAda * curTokens;
  const newToks  = curTokens + tokensIn;
  const newAda   = k / newToks;
  return realAda - newAda;
}

export function applyFee(gross: bigint): bigint {
  return (gross * FEE_BPS) / BPS_DENOM;
}

// ── Derived metrics ───────────────────────────────────────────────────────────

export function spotPrice(adaReserve: bigint, tokenReserve: bigint): bigint {
  const realAda = adaReserve + VIRTUAL_ADA;
  return (realAda * PRICE_SCALE) / tokenReserve;
}

export function marketCap(adaReserve: bigint, tokenReserve: bigint): bigint {
  const price = spotPrice(adaReserve, tokenReserve);
  return (price * TOTAL_SUPPLY) / PRICE_SCALE;
}

export function bondingProgress(adaReserve: bigint): number {
  if (adaReserve >= GRADUATION_TARGET) return 100;
  return Number((adaReserve * 100n) / GRADUATION_TARGET);
}

// ── Quote helpers ─────────────────────────────────────────────────────────────

export interface TradeQuote {
  amountIn:    bigint;
  amountOut:   bigint;
  fee:         bigint;
  priceImpact: number;   // percentage, e.g. 2.34
}

export function getBuyQuote(
  adaIn:     bigint,
  curAda:    bigint,
  curTokens: bigint,
): TradeQuote {
  const fee       = applyFee(adaIn);
  const netAda    = adaIn - fee;
  const tokensOut = calcTokensOut(netAda, curAda, curTokens);

  const priceBefore = spotPrice(curAda, curTokens);
  const priceAfter  = spotPrice(curAda + netAda, curTokens - tokensOut);
  const impact      = priceBefore > 0n
    ? Number((priceAfter - priceBefore) * 10_000n / priceBefore) / 100
    : 0;

  return { amountIn: adaIn, amountOut: tokensOut, fee, priceImpact: impact };
}

export function getSellQuote(
  tokensIn:  bigint,
  curAda:    bigint,
  curTokens: bigint,
): TradeQuote {
  const grossAda = calcAdaOut(tokensIn, curAda, curTokens);
  const fee      = applyFee(grossAda);
  const netAda   = grossAda - fee;

  const priceBefore = spotPrice(curAda, curTokens);
  const priceAfter  = spotPrice(curAda - grossAda, curTokens + tokensIn);
  const impact      = priceBefore > 0n
    ? Number((priceBefore - priceAfter) * 10_000n / priceBefore) / 100
    : 0;

  return { amountIn: tokensIn, amountOut: netAda, fee, priceImpact: impact };
}

// ── KotH score ────────────────────────────────────────────────────────────────

export function kothScore(params: {
  totalVolume:  bigint;
  txCount:      number;
  holderCount:  number;
  adaReserve:   bigint;
  graduated:    boolean;
}): number {
  if (params.graduated) return 0;   // graduated tokens leave the race
  const volScore    = Math.min(100, Number(params.totalVolume / 1_000_000_000n));
  const txScore     = Math.min(100, params.txCount);
  const holderScore = Math.min(100, params.holderCount * 2);
  const progScore   = bondingProgress(params.adaReserve);
  return Math.floor(
    volScore    * 0.40 +
    txScore     * 0.30 +
    holderScore * 0.20 +
    progScore   * 0.10
  );
}

// ── Formatting ────────────────────────────────────────────────────────────────

/** tDUST → "1,234.56 DUST" */
export function fmtDust(tDust: bigint, dec = 2): string {
  const whole = tDust / 1_000_000n;
  if (dec === 0) return whole.toLocaleString();
  const frac = (tDust % 1_000_000n).toString().padStart(6, '0').slice(0, dec);
  return `${whole.toLocaleString()}.${frac}`;
}

/** token base units → "34,200,000" */
export function fmtTokens(amount: bigint, dec = 0): string {
  const whole = amount / 1_000_000n;
  if (dec === 0) return whole.toLocaleString();
  const frac = (amount % 1_000_000n).toString().padStart(6, '0').slice(0, dec);
  return `${whole.toLocaleString()}.${frac}`;
}

/** Market cap with suffix */
export function fmtMcap(tDust: bigint): string {
  const dust = Number(tDust / 1_000n);            // milli-DUST
  if (dust >= 1_000_000_000) return `₾${(dust / 1_000_000_000).toFixed(2)}B`;
  if (dust >= 1_000_000)     return `₾${(dust / 1_000_000).toFixed(2)}M`;
  if (dust >= 1_000)         return `₾${(dust / 1_000).toFixed(1)}k`;
  return `₾${dust.toFixed(0)}`;
}

/** Unix seconds → "2m ago" */
export function timeAgo(ts: number): string {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── State type ────────────────────────────────────────────────────────────────

export interface BondingCurveState {
  adaReserve:    bigint;
  tokenReserve:  bigint;
  feeReserve:    bigint;
  totalVolume:   bigint;
  txCount:       number;
  state:         'ACTIVE' | 'GRADUATED' | 'PAUSED';
}
