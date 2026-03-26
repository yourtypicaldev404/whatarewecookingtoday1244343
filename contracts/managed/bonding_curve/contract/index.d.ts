import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  treasurySecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  buy(context: __compactRuntime.CircuitContext<PS>,
      ada_in_0: bigint,
      tokens_out_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  sell(context: __compactRuntime.CircuitContext<PS>,
       tokens_in_0: bigint,
       ada_out_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  getProgress(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  buy(context: __compactRuntime.CircuitContext<PS>,
      ada_in_0: bigint,
      tokens_out_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  sell(context: __compactRuntime.CircuitContext<PS>,
       tokens_in_0: bigint,
       ada_out_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  getProgress(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  buy(context: __compactRuntime.CircuitContext<PS>,
      ada_in_0: bigint,
      tokens_out_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  sell(context: __compactRuntime.CircuitContext<PS>,
       tokens_in_0: bigint,
       ada_out_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  getProgress(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly creator_pk: Uint8Array;
  readonly treasury_pk: Uint8Array;
  readonly ada_reserve: bigint;
  readonly token_reserve: bigint;
  readonly total_volume: bigint;
  readonly tx_count: bigint;
  readonly state: number;
  readonly round: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               creator_sk_0: Uint8Array,
               treasury_key_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
