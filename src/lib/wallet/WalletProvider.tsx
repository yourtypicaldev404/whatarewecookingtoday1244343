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
  createContext, useContext, useState, useCallback, useEffect, useRef,
  type ReactNode,
} from 'react';
import type {
  WalletConnectedAPI,
  InitialAPI,
  ConnectedAPI,
  Configuration,
} from '@midnight-ntwrk/dapp-connector-api';
import { PUBLIC_NETWORK_ID } from '@/lib/network';

/** Methods we call right after connect — required by v4 so the wallet can prompt for permissions. */
const CONNECT_HINT: Array<keyof WalletConnectedAPI> = [
  'getConfiguration',
  'getDustBalance',
  'getUnshieldedAddress',
  'getDustAddress',
  'getUnshieldedBalances',
];

function isInitialAPI(x: unknown): x is InitialAPI {
  return (
    typeof x === 'object' &&
    x !== null &&
    'connect' in x &&
    typeof (x as InitialAPI).connect === 'function'
  );
}

function parseDustBalance(r: unknown): bigint {
  if (typeof r === 'bigint') return r;
  if (r && typeof r === 'object' && 'balance' in r) {
    const b = (r as { balance?: unknown }).balance;
    if (typeof b === 'bigint') return b;
    try {
      return BigInt(String(b ?? 0));
    } catch {
      return 0n;
    }
  }
  try {
    return BigInt(String((r as { value?: unknown })?.value ?? (r as { amount?: unknown })?.amount ?? 0));
  } catch {
    return 0n;
  }
}

function parseUnshieldedAddress(r: unknown): string {
  if (typeof r === 'string') return r;
  if (r && typeof r === 'object') {
    const o = r as { unshieldedAddress?: string; address?: string; bech32?: string };
    if (typeof o.unshieldedAddress === 'string') return o.unshieldedAddress;
    if (typeof o.address === 'string') return o.address;
    if (typeof o.bech32 === 'string') return o.bech32;
  }
  try {
    return JSON.stringify(r);
  } catch {
    return '';
  }
}

function parseDustAddress(r: unknown): string {
  if (typeof r === 'string') return r;
  if (r && typeof r === 'object') {
    const o = r as { dustAddress?: string; address?: string; bech32?: string };
    if (typeof o.dustAddress === 'string') return o.dustAddress;
    if (typeof o.address === 'string') return o.address;
    if (typeof o.bech32 === 'string') return o.bech32;
  }
  return '';
}

// ── Wallet state ──────────────────────────────────────────────────────────────

export interface WalletState {
  connected:        boolean;
  walletId:         string | null;
  unshieldedAddr:   string | null;
  dustAddr:         string | null;
  dustBalance:      bigint;
  tokenBalances:    Record<string, bigint>;
  serviceConfig:    Configuration | null;
  connecting:       boolean;
  error:            string | null;
}

interface WalletActions {
  connect(walletId?: string): Promise<void>;
  disconnect():               void;
  refreshBalances():          Promise<void>;
  clearWalletError():         void;
  api: ConnectedAPI | null;
}

type WalletCtx = WalletState & WalletActions;

const WalletContext = createContext<WalletCtx | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const connectSeqRef = useRef(0);
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

  const connect = useCallback(async (preferredId?: string) => {
    const seq = ++connectSeqRef.current;
    setState(s => ({ ...s, connecting: true, error: null }));

    try {
      if (typeof window === 'undefined' || !window.midnight) {
        throw new Error('No Midnight wallets detected. Please install the Lace wallet extension.');
      }

      const wallets = Object.entries(window.midnight).filter(
        ([, w]) => isInitialAPI(w),
      );
      if (wallets.length === 0) {
        throw new Error('No Midnight wallets detected.');
      }

      // Pick preferred wallet or first compatible one
      const [walletId, walletAPI] = preferredId && window.midnight[preferredId] && isInitialAPI(window.midnight[preferredId])
        ? [preferredId, window.midnight[preferredId]]
        : wallets[0];

      const connected = await walletAPI.connect(PUBLIC_NETWORK_ID);

      // v4: ask the wallet which RPC methods we need (permissions / unlock prompts)
      if (typeof connected.hintUsage === 'function') {
        await connected.hintUsage(CONNECT_HINT);
      }

      // Pull wallet info (v4 shapes: getDustBalance → { balance, cap }, addresses → { unshieldedAddress }, etc.)
      console.log('[Wallet] Connected wallet:', walletId, 'API:', Object.keys(connected));
      const [config, dustBalRaw, unshieldedAddr, dustAddr, unshieldedBals] =
        await Promise.all([
          connected.getConfiguration(),
          connected.getDustBalance(),
          connected.getUnshieldedAddress(),
          connected.getDustAddress(),
          connected.getUnshieldedBalances(),
        ]);

      const dustBalance = parseDustBalance(dustBalRaw);

      if (
        config.networkId &&
        config.networkId !== PUBLIC_NETWORK_ID
      ) {
        throw new Error(
          `Network ID mismatch: wallet reports "${config.networkId}" but this app is set to "${PUBLIC_NETWORK_ID}".`,
        );
      }

      if (seq !== connectSeqRef.current) return;

      setConnectedAPI(connected);
      setState({
        connected:      true,
        walletId,
        unshieldedAddr: parseUnshieldedAddress(unshieldedAddr),
        dustAddr:       parseDustAddress(dustAddr),
        dustBalance,
        tokenBalances:  unshieldedBals,
        serviceConfig:  config,
        connecting:     false,
        error:          null,
      });

      console.log('[Wallet] State:', { config, dustBalance, unshieldedAddr, dustAddr });
      localStorage.setItem('nightfun-walletId', walletId);

    } catch (err) {
      if (seq !== connectSeqRef.current) return;
      const msg = err instanceof Error ? err.message : 'Wallet connection failed';
      setState(s => ({ ...s, connecting: false, error: msg }));
      localStorage.removeItem('nightfun-walletId');
    }
  }, []);

  // Auto-reconnect on mount
  useEffect(() => {
    const savedWalletId = typeof localStorage !== 'undefined'
      ? localStorage.getItem('nightfun-walletId')
      : null;
    if (savedWalletId) void connect(savedWalletId);
  }, [connect]);

  const clearWalletError = useCallback(() => {
    setState(s => (s.error ? { ...s, error: null } : s));
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
    const [dustRaw, tokenBalances] = await Promise.all([
      connectedAPI.getDustBalance(),
      connectedAPI.getUnshieldedBalances(),
    ]);
    const dustBalance = parseDustBalance(dustRaw);
    setState(s => ({ ...s, dustBalance, tokenBalances }));
  }, [connectedAPI]);

  return (
    <WalletContext.Provider value={{
      ...state,
      connect,
      disconnect,
      refreshBalances,
      clearWalletError,
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
