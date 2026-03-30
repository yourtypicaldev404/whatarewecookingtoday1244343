'use client';

import { useWallet, shortAddr } from '@/lib/wallet/WalletProvider';

export default function TopWalletBar() {
  const { connected, connecting, connect, disconnect, unshieldedAddr } = useWallet();

  return (
    <div className="top-wallet-bar">
      {connected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="pulse-dot" />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
            {shortAddr(unshieldedAddr)}
          </span>
          <button
            type="button"
            onClick={disconnect}
            className="top-wallet-btn connected"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void connect()}
          disabled={connecting}
          className="top-wallet-btn"
        >
          {connecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
    </div>
  );
}
