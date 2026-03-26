'use client';

/**
 * night.fun — Wallet Provider (DApp Connector API v4.0.0)
 *
 * Uses the real Midnight DApp Connector API:
 *   package: @midnight-ntwrk/dapp-connector-api
 *   window.midnight.{walletId}.connect(networkId)
 *
 * The Lace wallet injects itself as window.midnight.mnLace
 */

import {
  createContext, useContext, useState, useCallback, useEffect,
  type ReactNode,
} from 'react';

// ── DApp Connector API types (from @midnight-ntwrk/dapp-connector-api) ────────

interface ServiceUriConfig {
  indexerUri:      string;
  indexerWsUri:    string;
  proverServerUri: string;
  substrateNodeUri:string;
  networkId:       string;
}

interface ConnectedAPI {
  getConfiguration():            Promise<ServiceUriConfig>;
  getShieldedBalances():         Promise<Record<string, bigint>>;
  getUnshieldedBalances():       Promise<Record<string, bigint>>;
  getDustBalance():              Promise<bigint>;
  getShieldedAddresses():        Promise<{ shieldedAddress: string }>;
  getUnshieldedAddress():        Promise<string>;
  getDustAddress():              Promise<string>;
  balanceUnsealedTransaction(tx: unknown): Promise<{ tx: unknown }>;
  balanceSealedTransaction(tx: unknown):   Promise<{ tx: unknown }>;
  submitTransaction(tx: unknown):          Promise<string>;
  makeTransfer(outputs: TransferOutput[]): Promise<unknown>;
  getProvingProvider(keyProvider: unknown): ProvingProvider;
}

interface TransferOutput {
  kind:      'unshielded' | 'shielded';
  tokenType: string;
  value:     bigint;
  recipient: string;
}

interface ProvingProvider {
  prove(tx: unknown, costModel: unknown): Promise<unknown>;
}

interface InitialAPI {
  name:       string;
  icon:       string;
  apiVersion: string;
  connect(networkId: string): Promise<ConnectedAPI>;
}

declare global {
  interface Window {
    midnight?: Record<string, InitialAPI>;
  }
}

// ── Wallet state ──────────────────────────────────────────────────────────────

export interface WalletState {
  connected:        boolean;
  walletId:         string | null;
  unshieldedAddr:   string | null;
  dustAddr:         string | null;
  dustBalance:      bigint;
  tokenBalances:    Record<string, bigint>;
  serviceConfig:    ServiceUriConfig | null;
  connecting:       boolean;
  error:            string | null;
}

interface WalletActions {
  connect(walletId?: string): Promise<void>;
  disconnect():               void;
  refreshBalances():          Promise<void>;
  api: ConnectedAPI | null;
}

type WalletCtx = WalletState & WalletActions;

const WalletContext = createContext<WalletCtx | null>(null);

// ── Network ID ────────────────────────────────────────────────────────────────

const NETWORK_ID = process.env.NEXT_PUBLIC_NETWORK_ID ?? 'preprod';

// ── Provider ──────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connectedAPI, setConnectedAPI] = useState<ConnectedAPI | null>(null);
  const [state, setState] = useState<WalletState>({
    connected:      false,
    walletId:       null,
    unshieldedAddr: null,
    dustAddr:       null,
    dustBalance:    0n,
    tokenBalances:  {},
    serviceConfig:  null,
    connecting:     false,
    error:          null,
  });

  // Auto-reconnect on mount
  useEffect(() => {
    const savedWalletId = typeof localStorage !== 'undefined'
      ? localStorage.getItem('nightfun-walletId')
      : null;
    if (savedWalletId) connect(savedWalletId).catch(() => {});
  }, []);

  const connect = useCallback(async (preferredId?: string) => {
    setState(s => ({ ...s, connecting: true, error: null }));

    try {
      if (typeof window === 'undefined' || !window.midnight) {
        throw new Error('No Midnight wallets detected. Please install the Lace wallet extension.');
      }

      const wallets = Object.entries(window.midnight);
      if (wallets.length === 0) {
        throw new Error('No Midnight wallets detected.');
      }

      // Pick preferred wallet or first compatible one
      const [walletId, walletAPI] = preferredId && window.midnight[preferredId]
        ? [preferredId, window.midnight[preferredId]]
        : wallets[0];

      const connected = await walletAPI.connect(NETWORK_ID);

      // Pull wallet info
      console.log('[Wallet] Connected wallet:', walletId, 'API:', Object.keys(connected));
      const [config, dustBalance, unshieldedAddr, dustAddr, unshieldedBals] =
        await Promise.all([
          connected.getConfiguration(),
          connected.getDustBalance().then((r: any) => typeof r === "bigint" ? r : BigInt(r?.value ?? r?.amount ?? 0)),
          connected.getUnshieldedAddress().then((r: any) => typeof r === "string" ? r : r?.address ?? r?.bech32 ?? JSON.stringify(r)),
          connected.getDustAddress().then((r: any) => typeof r === "string" ? r : r?.address ?? r?.bech32 ?? ""),
          connected.getUnshieldedBalances(),
        ]);

      setConnectedAPI(connected);
      setState({
        connected:      true,
        walletId,
        unshieldedAddr,
        dustAddr,
        dustBalance,
        tokenBalances:  unshieldedBals,
        serviceConfig:  config,
        connecting:     false,
        error:          null,
      });

      console.log('[Wallet] State:', { config, dustBalance, unshieldedAddr, dustAddr });
      localStorage.setItem('nightfun-walletId', walletId);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Wallet connection failed';
      setState(s => ({ ...s, connecting: false, error: msg }));
      localStorage.removeItem('nightfun-walletId');
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnectedAPI(null);
    setState({
      connected: false, walletId: null, unshieldedAddr: null,
      dustAddr: null, dustBalance: BigInt(0), tokenBalances: {},
      serviceConfig: null, connecting: false, error: null,
    });
    localStorage.removeItem('nightfun-walletId');
  }, []);

  const refreshBalances = useCallback(async () => {
    if (!connectedAPI) return;
    const [dustBalance, tokenBalances] = await Promise.all([
      connectedAPI.getDustBalance(),
      connectedAPI.getUnshieldedBalances(),
    ]);
    setState(s => ({ ...s, dustBalance, tokenBalances }));
  }, [connectedAPI]);

  return (
    <WalletContext.Provider value={{
      ...state,
      connect,
      disconnect,
      refreshBalances,
      api: connectedAPI,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be inside <WalletProvider>');
  return ctx;
}

// Format a Midnight address for display: mn_addr1...abcd
export function shortAddr(addr: string | null | undefined): string {
  if (!addr || typeof addr !== "string") return "";
  if (addr.length < 12) return addr;
  return addr.slice(0, 10) + "..." + addr.slice(-4);
}

// Format DUST balance (6 decimals)
export function formatDustBalance(tDust: unknown): string {
  try {
    if (!tDust) return "0.00";
    const big = typeof tDust === "bigint" ? tDust : BigInt(String(tDust));
    const whole = big / BigInt(1000000);
    const frac = (big % BigInt(1000000)).toString().padStart(6, "0").slice(0, 2);
    return whole.toLocaleString() + "." + frac;
  } catch {
    return "0.00";
  }
}
