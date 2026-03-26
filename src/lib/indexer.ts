// Indexer stub - real indexer integration pending Midnight SDK wiring
export class MidnightIndexerClient {
  constructor(private url: string) {}
  async getContractAction(_address: string) { return null; }
  decodeLedgerState(_data: any) { return null; }
}

export function useLiveContractState(_address: string) {
  return { state: null, loading: false };
}
