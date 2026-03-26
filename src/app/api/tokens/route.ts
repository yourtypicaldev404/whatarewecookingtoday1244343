import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve(process.cwd(), 'token-registry.json');

function loadTokens() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveTokens(tokens: any[]) {
  fs.writeFileSync(DB_FILE, JSON.stringify(tokens, null, 2));
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tokens = loadTokens();
  const sort = req.nextUrl.searchParams.get('sort') ?? 'bump';
  const search = req.nextUrl.searchParams.get('search')?.toLowerCase();
  
  let filtered = search
    ? tokens.filter((t: any) => t.name?.toLowerCase().includes(search) || t.ticker?.toLowerCase().includes(search))
    : tokens;

  const kothAddress = filtered[0]?.address ?? null;
  return NextResponse.json({ tokens: filtered, total: filtered.length, kothAddress });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tokens = loadTokens();
    const record = {
      address:       body.address,
      name:          body.name ?? 'Unknown',
      ticker:        (body.ticker ?? 'UNK').toUpperCase(),
      description:   body.description ?? '',
      imageUri:      body.imageUri ?? 'ipfs://',
      creatorAddr:   body.creatorAddr ?? '',
      adaReserve:    '0',
      tokenReserve:  '999000000000000',
      totalVolume:   '0',
      txCount:       0,
      holderCount:   1,
      graduated:     false,
      lockedPercent: 0,
      kothScore:     0,
      deployedAt:    Math.floor(Date.now() / 1000),
      lastActivityAt: Math.floor(Date.now() / 1000),
    };
    tokens.unshift(record);
    saveTokens(tokens);
    return NextResponse.json({ ok: true, address: record.address }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
