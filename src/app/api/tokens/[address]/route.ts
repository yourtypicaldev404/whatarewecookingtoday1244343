import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DB_FILE = path.resolve(process.cwd(), 'token-registry.json');

function loadTokensFromFile() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch {}
  return [];
}

// Redis helpers (same pattern as /api/tokens/route.ts)
let memoryStore: any[] | null = null;

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
  // Fallback to file, then memory
  const fromFile = loadTokensFromFile();
  if (fromFile.length > 0) return fromFile;
  return memoryStore ?? [];
}

async function saveTokens(tokens: any[]) {
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set('tokens', tokens);
      return;
    } catch {}
  }
  // Fallback: save to file and memory
  memoryStore = tokens;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(tokens, null, 2));
  } catch {}
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const { address } = await context.params;
  const tokens = await loadTokens();
  const token = tokens.find((t: any) => t.address === address) ?? null;
  return NextResponse.json({ token });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await context.params;
    const update = await req.json();

    const tokens = await loadTokens();
    const idx = tokens.findIndex((t: any) => t.address === address);
    if (idx === -1) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    // Whitelist of allowed update fields
    const allowed = ['adaReserve', 'tokenReserve', 'totalVolume', 'txCount', 'graduated', 'lastActivityAt', 'holderCount'];

    for (const key of allowed) {
      if (update[key] !== undefined) {
        tokens[idx][key] = update[key];
      }
    }

    await saveTokens(tokens);

    return NextResponse.json({ ok: true, token: tokens[idx] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
