// Contract API stub - wired via contractWiring.ts for browser
// Server-side SDK wiring pending

export interface BondingCurveLedgerState {
  adaReserve:   bigint;
  tokenReserve: bigint;
  feeReserve:   bigint;
  totalVolume:  bigint;
  txCount:      number;
  state:        'ACTIVE' | 'GRADUATED' | 'PAUSED';
}

export interface DeployResult {
  contractAddress: string;
  txId:            string;
  blockHeight:     number;
}
