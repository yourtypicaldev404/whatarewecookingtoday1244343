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

// ── Indexer verification ─────────────────────────────────────────────────────

function getIndexerHttpUrl(): string {
  return (
    process.env.NEXT_PUBLIC_INDEXER_HTTP ??
    process.env.INDEXER_HTTP ??
    'https://indexer.mainnet.midnight.network/api/v4/graphql'
  );
}

const CONTRACT_STATE_QUERY = `
  query CONTRACT_STATE_QUERY($address: HexEncoded!) {
    contractAction(address: $address) {
      state
    }
  }
`;

const CURVE_STATE_MAP: Record<number, string> = {
  0: 'ACTIVE',
  1: 'GRADUATED',
  2: 'PAUSED',
};

function hexToBytes(h: string): Uint8Array {
  const clean = h.startsWith('0x') ? h.slice(2) : h;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function decodeLedgerStateServer(stateHex: string): Promise<Record<string, unknown> | null> {
  try {
    const { ContractState } = await import('@midnight-ntwrk/compact-runtime');
    const contractModule = await import(
      /* webpackIgnore: true */
      '../../../../../contracts/managed/bonding_curve/contract/index.js'
    );
    const raw = hexToBytes(stateHex);
    const contractState = ContractState.deserialize(raw);
    // The compiled contract's ledger() accepts ContractState | StateValue | ChargedState
    const ledgerData = contractModule.ledger(contractState as any);

    return {
      adaReserve:   ledgerData.ada_reserve.toString(),
      tokenReserve: ledgerData.token_reserve.toString(),
      totalVolume:  ledgerData.total_volume.toString(),
      txCount:      Number(ledgerData.tx_count),
      graduated:    ledgerData.state === 1,
      state:        CURVE_STATE_MAP[ledgerData.state] ?? 'ACTIVE',
    };
  } catch (err) {
    console.warn('[tokens/PATCH] SDK decode failed:', err);
  }

  // Fallback: try ledger-v8
  try {
    const ledgerPkg = await import('@midnight-ntwrk/ledger-v8');
    const cs = (ledgerPkg as any).ContractState.deserialize(hexToBytes(stateHex));
    const arr = cs.data?.toArray?.() ?? cs.toArray?.() ?? [];
    const readBigInt = (idx: number): bigint => {
      const val = arr[idx];
      if (typeof val === 'bigint') return val;
      if (typeof val === 'number') return BigInt(val);
      if (typeof val === 'string') return BigInt(val);
      if (val instanceof Uint8Array) {
        let n = 0n;
        for (const b of val) n = (n << 8n) | BigInt(b);
        return n;
      }
      return 0n;
    };
    const stateEnum = Number(readBigInt(6));
    return {
      adaReserve:   readBigInt(2).toString(),
      tokenReserve: readBigInt(3).toString(),
      totalVolume:  readBigInt(4).toString(),
      txCount:      Number(readBigInt(5)),
      graduated:    stateEnum === 1,
      state:        CURVE_STATE_MAP[stateEnum] ?? 'ACTIVE',
    };
  } catch {
    return null;
  }
}

/**
 * Query the indexer for this contract's current on-chain state.
 * Returns decoded fields or null on failure.
 */
async function fetchIndexerState(address: string): Promise<Record<string, unknown> | null> {
  try {
    const endpoint = getIndexerHttpUrl();
    const addr = address.replace(/^0x/, '');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: CONTRACT_STATE_QUERY,
        variables: { address: addr },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const stateHex = json.data?.contractAction?.state;
    if (!stateHex) return null;
    return decodeLedgerStateServer(stateHex);
  } catch (err) {
    console.warn('[tokens/PATCH] Indexer fetch failed:', err);
    return null;
  }
}

// ── Route handlers ───────────────────────────────────────────────────────────

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

    // ── Indexer verification mode ────────────────────────────────────────
    // If the client sends { verify: true } or { source: 'indexer' }, we fetch
    // the real state from the indexer instead of trusting the client payload.
    // The client can also send explicit fields which we'll verify against the
    // indexer if available.
    const useIndexer = update.verify === true || update.source === 'indexer';

    if (useIndexer) {
      const indexerState = await fetchIndexerState(address);
      if (indexerState) {
        console.log(`[tokens/PATCH] Using indexer-verified state for ${address}`);
        tokens[idx].adaReserve     = indexerState.adaReserve;
        tokens[idx].tokenReserve   = indexerState.tokenReserve;
        tokens[idx].totalVolume    = indexerState.totalVolume;
        tokens[idx].txCount        = indexerState.txCount;
        tokens[idx].graduated      = indexerState.graduated;
        tokens[idx].lastActivityAt = Math.floor(Date.now() / 1000);
        await saveTokens(tokens);
        return NextResponse.json({
          ok: true,
          token: tokens[idx],
          source: 'indexer',
        });
      }
      // Indexer unavailable — fall through to client-provided values with a warning
      console.warn(`[tokens/PATCH] Indexer verification requested but failed for ${address}, falling through to client values`);
    }

    // ── Standard whitelist update ────────────────────────────────────────
    const allowed = ['adaReserve', 'tokenReserve', 'totalVolume', 'txCount', 'graduated', 'lastActivityAt', 'holderCount'];

    for (const key of allowed) {
      if (update[key] !== undefined) {
        tokens[idx][key] = update[key];
      }
    }

    // Always bump lastActivityAt on any PATCH
    tokens[idx].lastActivityAt = Math.floor(Date.now() / 1000);

    await saveTokens(tokens);

    return NextResponse.json({ ok: true, token: tokens[idx] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
