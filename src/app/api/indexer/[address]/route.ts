import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/indexer/:address
 *
 * Server-side proxy that queries the Midnight indexer for on-chain contract state,
 * deserializes it, and returns the parsed ledger fields.
 *
 * This avoids exposing heavy WASM deserialization to the browser — the client
 * can call this lightweight JSON endpoint instead.
 */

// ── Indexer config ───────────────────────────────────────────────────────────

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

// ── State deserialization ────────────────────────────────────────────────────

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

async function decodeLedgerState(stateHex: string) {
  // Try the full SDK path (contract module + ContractState)
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
      state:        CURVE_STATE_MAP[ledgerData.state] ?? 'ACTIVE',
    };
  } catch (err) {
    console.warn('[indexer-api] SDK decode failed:', err);
  }

  // Fallback: try ledger-v8 ContractState
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

    return {
      adaReserve:   readBigInt(2).toString(),
      tokenReserve: readBigInt(3).toString(),
      totalVolume:  readBigInt(4).toString(),
      txCount:      Number(readBigInt(5)),
      state:        CURVE_STATE_MAP[Number(readBigInt(6))] ?? 'ACTIVE',
    };
  } catch (err2) {
    console.error('[indexer-api] Fallback decode also failed:', err2);
    throw new Error('Failed to deserialize contract state');
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ address: string }> },
) {
  const { address } = await context.params;
  const addr = address.replace(/^0x/, '');

  try {
    const endpoint = getIndexerHttpUrl();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: CONTRACT_STATE_QUERY,
        variables: { address: addr },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Indexer returned ${res.status}`, detail: text.slice(0, 300) },
        { status: 502 },
      );
    }

    const json = await res.json();
    if (json.errors?.length) {
      return NextResponse.json(
        { error: 'Indexer query error', details: json.errors },
        { status: 502 },
      );
    }

    const stateHex = json.data?.contractAction?.state;
    if (!stateHex) {
      return NextResponse.json(
        { error: 'Contract not found on indexer', address: addr },
        { status: 404 },
      );
    }

    const decoded = await decodeLedgerState(stateHex);
    return NextResponse.json({ ok: true, contractState: decoded, address: addr });
  } catch (err: any) {
    console.error('[indexer-api] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Indexer query failed' },
      { status: 500 },
    );
  }
}
