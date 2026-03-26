import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let memoryStore: any[] = [];

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

async function loadTokens() {
  const redis = await getRedis();
  if (redis) {
    try {
      return (await redis.get<any[]>('tokens')) ?? [];
    } catch {}
  }
  return memoryStore;
}

async function saveTokens(tokens: any[]) {
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set('tokens', tokens);
      return;
    } catch {}
  }
  memoryStore = tokens;
}

export async function GET(req: NextRequest) {
  const tokens = await loadTokens();
  const sort = req.nextUrl.searchParams.get('sort') ?? 'bump';
  const search = req.nextUrl.searchParams.get('search')?.toLowerCase();
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get('limit') ?? 50));

  let filtered = search
    ? tokens.filter((t: any) =>
        t.name?.toLowerCase().includes(search) ||
        t.ticker?.toLowerCase().includes(search) ||
        t.address?.toLowerCase().includes(search))
    : [...tokens];

  if (sort === 'new') filtered.sort((a: any, b: any) => b.deployedAt - a.deployedAt);
  else if (sort === 'graduated') filtered = filtered.filter((t: any) => t.graduated);

  const kothAddress = filtered.filter((t: any) => !t.graduated)[0]?.address ?? null;

  return NextResponse.json({
    tokens: filtered.slice(0, limit),
    total: filtered.length,
    kothAddress,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.address || !body.name) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const tokens = await loadTokens();
    if (tokens.find((t: any) => t.address === body.address)) {
      return NextResponse.json({ ok: true, address: body.address });
    }

    const record = {
      address:        body.address,
      name:           body.name,
      ticker:         (body.ticker ?? 'UNK').toUpperCase(),
      description:    body.description ?? '',
      imageUri:       body.imageUri ?? 'ipfs://',
      creatorAddr:    body.creatorAddr ?? '',
      adaReserve:     '0',
      tokenReserve:   '999000000000000',
      totalVolume:    '0',
      txCount:        0,
      holderCount:    1,
      graduated:      false,
      website:        body.website ?? '',
      twitter:        body.twitter ?? '',
      telegram:       body.telegram ?? '',
      discord:        body.discord ?? '',
      lockedPercent:  0,
      kothScore:      0,
      deployedAt:     Math.floor(Date.now() / 1000),
      lastActivityAt: Math.floor(Date.now() / 1000),
    };

    tokens.unshift(record);
    await saveTokens(tokens);

    return NextResponse.json({ ok: true, address: record.address }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
