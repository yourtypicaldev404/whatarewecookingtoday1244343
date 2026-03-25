/**
 * night.fun — Midnight Indexer GraphQL Client
 *
 * Uses the real Indexer API v3 (GraphQL) at:
 *   HTTP: https://indexer.preprod.midnight.network/api/v3/graphql
 *   WS:   wss://indexer.preprod.midnight.network/api/v3/graphql/ws
 *
 * Key operations we need:
 *   - contractAction(address) → get current ledger state (reserves, state)
 *   - contractActions subscription → stream state changes (= our trade feed)
 *   - transactions(hash) → get tx details for trade history
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContractLedgerState {
  adaReserve:   bigint;
  tokenReserve: bigint;
  feeReserve:   bigint;
  totalVolume:  bigint;
  txCount:      number;
  state:        'ACTIVE' | 'GRADUATED' | 'PAUSED';
}

export interface ContractAction {
  __typename:         'ContractDeploy' | 'ContractCall' | 'ContractUpdate';
  address:            string;
  state:              string;    // hex-encoded serialized ledger state
  zswapState:         string;
  entryPoint?:        string;    // for ContractCall
  unshieldedBalances: { tokenType: string; amount: string }[];
}

export interface IndexerBlock {
  hash:      string;
  height:    number;
  timestamp: number;
}

export interface IndexerTransaction {
  id:   number;
  hash: string;
  contractActions: ContractAction[];
  fees: { paidFees: string; estimatedFees: string };
}

// ── GraphQL Queries ───────────────────────────────────────────────────────────

const QUERY_CONTRACT_ACTION = `
  query ContractAction($address: HexEncoded!) {
    contractAction(address: $address) {
      __typename
      ... on ContractDeploy {
        address state zswapState
        unshieldedBalances { tokenType amount }
      }
      ... on ContractCall {
        address state zswapState entryPoint
        unshieldedBalances { tokenType amount }
      }
      ... on ContractUpdate {
        address state zswapState
        unshieldedBalances { tokenType amount }
      }
    }
  }
`;

const QUERY_LATEST_BLOCK = `
  query {
    block {
      hash height timestamp
    }
  }
`;

const SUBSCRIPTION_CONTRACT_ACTIONS = `
  subscription ContractActions($address: HexEncoded!, $height: Int) {
    contractActions(address: $address, offset: { height: $height }) {
      __typename
      ... on ContractDeploy {
        address state zswapState
        unshieldedBalances { tokenType amount }
      }
      ... on ContractCall {
        address state zswapState entryPoint
        unshieldedBalances { tokenType amount }
      }
      ... on ContractUpdate {
        address state zswapState
        unshieldedBalances { tokenType amount }
      }
    }
  }
`;

// ── Indexer Client ────────────────────────────────────────────────────────────

export class MidnightIndexerClient {
  private readonly httpUrl: string;
  private readonly wsUrl:   string;

  constructor(
    baseUrl = 'https://indexer.preprod.midnight.network'
  ) {
    this.httpUrl = `${baseUrl}/api/v3/graphql`;
    this.wsUrl   = baseUrl.replace('https', 'wss') + '/api/v3/graphql/ws';
  }

  // ── HTTP queries ────────────────────────────────────────────────────────────

  private async gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(this.httpUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      throw new Error(`Indexer HTTP ${res.status}: ${await res.text()}`);
    }

    const json = await res.json() as { data?: T; errors?: { message: string }[] };

    if (json.errors?.length) {
      throw new Error(`Indexer GQL error: ${json.errors.map(e => e.message).join(', ')}`);
    }

    return json.data as T;
  }

  /** Get current contract state (latest ContractAction for this address) */
  async getContractAction(address: string): Promise<ContractAction | null> {
    const data = await this.gql<{ contractAction: ContractAction | null }>(
      QUERY_CONTRACT_ACTION,
      { address }
    );
    return data.contractAction;
  }

  /**
   * Decode the hex-encoded ledger state from contractAction.state.
   *
   * The state field is the CBOR-serialized Compact ledger state.
   * Proper decoding requires the compiled contract's decoder (from compact compile output).
   * This is a placeholder that shows where to hook in the real decoder.
   *
   * Real pattern (after compiling the contract):
   *   import { BondingCurveContract } from '../contracts/managed/bonding_curve/contract/index.cjs';
   *   const decoded = BondingCurveContract.ledger.decode(Buffer.from(hexState, 'hex'));
   */
  decodeLedgerState(hexState: string): ContractLedgerState | null {
    // TODO: replace with real CBOR decode from compiled contract
    // For now returns null so callers fall back to querying the circuit directly
    console.warn('[Indexer] decodeLedgerState: contract decoder not yet wired');
    return null;
  }

  /** Get latest block info */
  async getLatestBlock(): Promise<IndexerBlock | null> {
    const data = await this.gql<{ block: IndexerBlock | null }>(QUERY_LATEST_BLOCK);
    return data.block;
  }

  // ── WebSocket subscriptions ─────────────────────────────────────────────────

  /**
   * Subscribe to contract state changes for a specific bonding curve address.
   * Each ContractCall (buy/sell) triggers a new event with the updated state.
   *
   * Uses the graphql-transport-ws protocol.
   * Install: npm install graphql-ws
   */
  subscribeToContractActions(
    address:   string,
    onAction:  (action: ContractAction) => void,
    onError:   (err: Error) => void,
    fromHeight = 0,
  ): () => void {
    // graphql-ws subscription (graphql-transport-ws protocol)
    // Real implementation:
    //
    // import { createClient } from 'graphql-ws';
    //
    // const client = createClient({
    //   url: this.wsUrl,
    //   connectionParams: {}, // auth if needed
    // });
    //
    // const unsubscribe = client.subscribe<{ contractActions: ContractAction }>(
    //   {
    //     query: SUBSCRIPTION_CONTRACT_ACTIONS,
    //     variables: { address, height: fromHeight },
    //   },
    //   {
    //     next: ({ data }) => {
    //       if (data?.contractActions) onAction(data.contractActions);
    //     },
    //     error: (err) => onError(err instanceof Error ? err : new Error(String(err))),
    //     complete: () => {},
    //   }
    // );
    //
    // return () => unsubscribe();

    // Stub: poll every 5s until real WS is wired
    const intervalId = setInterval(async () => {
      try {
        const action = await this.getContractAction(address);
        if (action) onAction(action);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }

  /**
   * Derive a trade record from two consecutive contract states.
   * When ada_reserve increased → BUY. When it decreased → SELL.
   *
   * In production, entryPoint on ContractCall tells us exactly which
   * circuit was called ('buy' or 'sell'), so no inference is needed.
   */
  static diffToTrade(
    prev: ContractLedgerState,
    next: ContractLedgerState,
    txHash: string,
    timestamp: number,
    traderAddress: string,
    tokenAddress: string,
  ) {
    const side = next.adaReserve > prev.adaReserve ? 'buy' : 'sell';
    const adaDelta = side === 'buy'
      ? next.adaReserve - prev.adaReserve
      : prev.adaReserve - next.adaReserve;
    const tokenDelta = side === 'buy'
      ? prev.tokenReserve - next.tokenReserve
      : next.tokenReserve - prev.tokenReserve;

    return { side, adaDelta, tokenDelta, txHash, timestamp, traderAddress, tokenAddress };
  }
}

// ── React hook: live contract state ──────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react';

export function useLiveContractState(address: string) {
  const [state, setState] = useState<ContractLedgerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const client = new MidnightIndexerClient(
    process.env.NEXT_PUBLIC_INDEXER_URL ?? 'https://indexer.preprod.midnight.network'
  );

  const fetch = useCallback(async () => {
    try {
      const action = await client.getContractAction(address);
      if (!action) { setError('Contract not found'); return; }

      const decoded = client.decodeLedgerState(action.state);
      if (decoded) setState(decoded);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetch();

    // Subscribe to real-time updates
    const unsub = client.subscribeToContractActions(
      address,
      (action) => {
        const decoded = client.decodeLedgerState(action.state);
        if (decoded) setState(decoded);
      },
      (err) => setError(err.message),
    );

    return unsub;
  }, [address]);

  return { state, loading, error, refetch: fetch };
}

// ── Night.fun token registry ──────────────────────────────────────────────────
//
// Since Midnight doesn't have a global token factory contract yet,
// night.fun maintains its own registry of deployed bonding curve addresses.
// This is stored in our backend DB, indexed by deploy tx hash.
//
// The registry API endpoint: GET /api/tokens?sort=bump&limit=50
// Returns the list of known bonding curve contract addresses.
