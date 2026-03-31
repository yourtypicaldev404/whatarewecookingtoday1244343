import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function getRedis() {
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  } catch {
    return null;
  }
}

let memoryStore: any[] = [];

async function loadTokens() {
  const redis = await getRedis();
  if (redis) {
    try {
      return (await redis.get<any[]>('tokens')) ?? [];
    } catch {}
  }
  return memoryStore;
}

export async function GET() {
  const tokens = await loadTokens();
  const now = Math.floor(Date.now() / 1000);
  const h24 = now - 86400;
  const h1 = now - 3600;

  const totalTokens = tokens.length;
  const graduated = tokens.filter((t: any) => t.graduated).length;
  const active = tokens.filter((t: any) => (t.lastActivityAt ?? 0) > h24).length;

  let totalVolume = 0n;
  let totalTxns = 0;
  let totalHolders = 0;
  let totalLiquidity = 0n;

  const volumeByToken: { address: string; name: string; ticker: string; volume: bigint; txCount: number; adaReserve: bigint; graduated: boolean }[] = [];

  for (const t of tokens) {
    const vol = BigInt(t.totalVolume ?? '0');
    const reserve = BigInt(t.adaReserve ?? '0');
    totalVolume += vol;
    totalTxns += t.txCount ?? 0;
    totalHolders += t.holderCount ?? 1;
    totalLiquidity += reserve;

    volumeByToken.push({
      address: t.address,
      name: t.name,
      ticker: t.ticker,
      volume: vol,
      txCount: t.txCount ?? 0,
      adaReserve: reserve,
      graduated: t.graduated ?? false,
    });
  }

  // Sort for top tokens
  const topByVolume = [...volumeByToken]
    .sort((a, b) => (b.volume > a.volume ? 1 : -1))
    .slice(0, 10)
    .map(t => ({ ...t, volume: t.volume.toString(), adaReserve: t.adaReserve.toString() }));

  const topByTxns = [...volumeByToken]
    .sort((a, b) => b.txCount - a.txCount)
    .slice(0, 10)
    .map(t => ({ ...t, volume: t.volume.toString(), adaReserve: t.adaReserve.toString() }));

  const topByLiquidity = [...volumeByToken]
    .sort((a, b) => (b.adaReserve > a.adaReserve ? 1 : -1))
    .slice(0, 10)
    .map(t => ({ ...t, volume: t.volume.toString(), adaReserve: t.adaReserve.toString() }));

  // Tokens launched per day (last 30 days)
  const launchHistory: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dayStart = now - (i + 1) * 86400;
    const dayEnd = now - i * 86400;
    const count = tokens.filter((t: any) => (t.deployedAt ?? 0) >= dayStart && (t.deployedAt ?? 0) < dayEnd).length;
    const d = new Date(dayEnd * 1000);
    launchHistory.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      count,
    });
  }

  return NextResponse.json({
    overview: {
      totalTokens,
      graduated,
      active24h: active,
      totalVolume: totalVolume.toString(),
      totalTxns,
      totalHolders,
      totalLiquidity: totalLiquidity.toString(),
    },
    topByVolume,
    topByTxns,
    topByLiquidity,
    launchHistory,
  });
}
