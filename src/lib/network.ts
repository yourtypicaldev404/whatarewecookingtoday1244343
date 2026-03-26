/**
 * Public Midnight network for wallet connect() and UI.
 * Defaults to Preview until mainnet; override with NEXT_PUBLIC_NETWORK_ID.
 */
export const PUBLIC_NETWORK_ID =
  process.env.NEXT_PUBLIC_NETWORK_ID ?? 'preview';

/** Faucet for test tokens — override with NEXT_PUBLIC_FAUCET_URL if needed. */
export const PUBLIC_FAUCET_URL =
  process.env.NEXT_PUBLIC_FAUCET_URL ??
  (PUBLIC_NETWORK_ID === 'preprod'
    ? 'https://faucet.preprod.midnight.network'
    : 'https://faucet.preview.midnight.network');

/** Short label for badges (Preview / Preprod / custom). */
export const PUBLIC_NETWORK_LABEL =
  process.env.NEXT_PUBLIC_NETWORK_LABEL ??
  (PUBLIC_NETWORK_ID.charAt(0).toUpperCase() +
    PUBLIC_NETWORK_ID.slice(1).toLowerCase());
