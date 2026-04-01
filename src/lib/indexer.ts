/**
 * Midnight Indexer Client
 *
 * Queries the Midnight indexer GraphQL API for on-chain contract state.
 * Uses raw fetch (no Apollo dependency) so it works in both server and client contexts.
 *
 * The indexer returns the contract's public state as a hex-encoded blob.
 * We deserialize it using the Midnight SDK's ContractState, then decode
 * the ledger fields via the compiled bonding_curve contract's `ledger()` helper.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface IndexerContractState {
  adaReserve:   string;   // stringified bigint (base units, 6 dec)
  tokenReserve: string;
  totalVolume:  string;
  txCount:      number;
  state:        'ACTIVE' | 'GRADUATED' | 'PAUSED';
}

// ── GraphQL Queries ──────────────────────────────────────────────────────────

/**
 * CONTRACT_STATE_QUERY — matches the Midnight SDK's own query definition.
 * Returns the latest public state hex for a contract address.
 */
const CONTRACT_STATE_QUERY = `
  query CONTRACT_STATE_QUERY($address: HexEncoded!) {
    contractAction(address: $address) {
      state
    }
  }
`;

// ── Env helpers ──────────────────────────────────────────────────────────────

function getIndexerHttpUrl(): string {
  // Server-side: process.env; client-side: NEXT_PUBLIC_ prefix
  return (
    process.env.NEXT_PUBLIC_INDEXER_HTTP ??
    process.env.INDEXER_HTTP ??
    'https://indexer.mainnet.midnight.network/api/v4/graphql'
  );
}

// ── Raw GraphQL fetch ────────────────────────────────────────────────────────

async function graphqlQuery<T = any>(
  query: string,
  variables: Record<string, unknown>,
  url?: string,
): Promise<T> {
  const endpoint = url ?? getIndexerHttpUrl();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Indexer HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(
      `Indexer GraphQL error: ${json.errors.map((e: any) => e.message).join('; ')}`,
    );
  }
  return json.data as T;
}

// ── State hex → Ledger deserialization ───────────────────────────────────────

const CURVE_STATE_MAP: Record<number, 'ACTIVE' | 'GRADUATED' | 'PAUSED'> = {
  0: 'ACTIVE',
  1: 'GRADUATED',
  2: 'PAUSED',
};

/**
 * Parse the raw state hex returned by the indexer into typed ledger fields.
 *
 * Uses the Midnight SDK ContractState.deserialize() and the compiled
 * bonding_curve contract's `ledger()` decoder. Falls back to a manual
 * state-array parse if the contract module is unavailable (e.g. browser
 * without WASM).
 */
async function decodeLedgerState(stateHex: string): Promise<IndexerContractState> {
  const hexToBytes = (h: string): Uint8Array => {
    const clean = h.startsWith('0x') ? h.slice(2) : h;
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  };

  try {
    // Path A: Full SDK deserialization (works server-side and in browsers with WASM)
    const { ContractState } = await import('@midnight-ntwrk/compact-runtime');
    const contractModule = await import(
      /* webpackIgnore: true */
      // @ts-ignore -- path resolved at runtime relative to project root
      '../../../contracts/managed/bonding_curve/contract/index.js'
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
  } catch (sdkErr) {
    console.warn('[indexer] SDK deserialization failed, trying manual parse:', sdkErr);
  }

  // Path B: Manual state-array parse.
  // The Compact runtime serializes public state fields in declaration order:
  //   creator_pk (Bytes<32>), treasury_pk (Bytes<32>),
  //   ada_reserve (Uint<128>), token_reserve (Uint<128>),
  //   total_volume (Uint<128>), tx_count (Uint<64>),
  //   state (enum = Uint<8>), round (Counter = Field)
  //
  // ContractState is an OAST-encoded structure. Rather than manually parsing
  // OAST we use the SDK's ContractState type which gives us a StateValue.
  // Since SDK was unavailable above, try a lightweight approach: the state hex
  // is a CBOR-like encoding. For robustness we attempt to load just the
  // ContractState class from the ledger package.
  try {
    const ledgerPkg = await import('@midnight-ntwrk/ledger-v8');
    const cs = (ledgerPkg as any).ContractState.deserialize(hexToBytes(stateHex));
    // StateValue exposes toArray() for indexed access
    const arr = cs.data?.toArray?.() ?? cs.toArray?.() ?? [];

    // Fields in declaration order (skip creator_pk [0] and treasury_pk [1])
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
  } catch (fallbackErr) {
    console.error('[indexer] Manual state parse also failed:', fallbackErr);
    throw new Error(
      'Could not deserialize contract state. Ensure @midnight-ntwrk/compact-runtime or @midnight-ntwrk/ledger-v8 is available.',
    );
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch and decode the on-chain contract state for a bonding curve.
 *
 * @param contractAddress  Hex-encoded contract address (with or without 0x prefix)
 * @returns Parsed ledger fields, or null if the contract is not found on the indexer
 */
export async function fetchContractState(
  contractAddress: string,
): Promise<IndexerContractState | null> {
  const addr = contractAddress.replace(/^0x/, '');

  const data = await graphqlQuery<{
    contractAction: { state: string } | null;
  }>(CONTRACT_STATE_QUERY, { address: addr });

  if (!data.contractAction?.state) {
    console.warn(`[indexer] No public state found for contract ${addr}`);
    return null;
  }

  return decodeLedgerState(data.contractAction.state);
}

/**
 * Fetch contract state and return it in the shape the Redis token record expects
 * (ready to PATCH into /api/tokens/:address).
 */
export async function fetchContractStateForPatch(
  contractAddress: string,
): Promise<Record<string, unknown> | null> {
  const state = await fetchContractState(contractAddress);
  if (!state) return null;

  return {
    adaReserve:     state.adaReserve,
    tokenReserve:   state.tokenReserve,
    totalVolume:    state.totalVolume,
    txCount:        state.txCount,
    graduated:      state.state === 'GRADUATED',
    lastActivityAt: Math.floor(Date.now() / 1000),
  };
}

// ── Server-side helper (for API routes) ──────────────────────────────────────

/**
 * Server-side only: query the indexer and return the raw state hex.
 * Useful for the PATCH route to verify client claims.
 */
export async function fetchRawContractStateHex(
  contractAddress: string,
): Promise<string | null> {
  const addr = contractAddress.replace(/^0x/, '');
  const data = await graphqlQuery<{
    contractAction: { state: string } | null;
  }>(CONTRACT_STATE_QUERY, { address: addr });
  return data.contractAction?.state ?? null;
}

// ── Legacy exports (keep backwards compat) ───────────────────────────────────

export class MidnightIndexerClient {
  constructor(private url: string) {}
  async getContractAction(address: string) {
    return fetchContractState(address);
  }
  decodeLedgerState(data: any) {
    return data;
  }
}

export function useLiveContractState(_address: string) {
  return { state: null, loading: false };
}
