/**
 * Single source of truth for Midnight network across the app.
 *
 * Production default: **preview** — set `NEXT_PUBLIC_NETWORK_ID=preview` on Vercel, `NETWORK_ID=preview`
 * on Railway (deploy server), and the same network in Lace → Configure Midnight Nodes. Mixing
 * Preview indexer with a Preprod wallet (or the reverse) causes “no public state” on trades.
 *
 * Switch networks (Preview / Preprod / Mainnet) in one place:
 *   NEXT_PUBLIC_NETWORK_ID=preview | preprod | mainnet
 *
 * Optional overrides:
 *   NEXT_PUBLIC_NETWORK_LABEL   — display name (default: derived from id, e.g. mainnet → Mainnet)
 *   NEXT_PUBLIC_FAUCET_URL      — set to empty to hide testnet faucet; unset = default per network
 */

export const PUBLIC_NETWORK_ID =
  process.env.NEXT_PUBLIC_NETWORK_ID ?? 'preview';

function defaultLabelForId(id: string): string {
  const lower = id.toLowerCase();
  if (lower === 'mainnet') return 'Mainnet';
  return id.charAt(0).toUpperCase() + id.slice(1).toLowerCase();
}

/** Badge / buttons / copy: Preview, Preprod, Mainnet, or custom from env */
export const PUBLIC_NETWORK_LABEL =
  process.env.NEXT_PUBLIC_NETWORK_LABEL ?? defaultLabelForId(PUBLIC_NETWORK_ID);

/**
 * Default testnet faucet URLs; mainnet has no public faucet here.
 * Explicit NEXT_PUBLIC_FAUCET_URL (including empty string) wins.
 */
export const PUBLIC_FAUCET_URL: string | null = (() => {
  const explicit = process.env.NEXT_PUBLIC_FAUCET_URL;
  if (explicit !== undefined) return explicit.trim() || null;
  const id = PUBLIC_NETWORK_ID.toLowerCase();
  if (id === 'mainnet') return null;
  if (id === 'preprod') return 'https://faucet.preprod.midnight.network';
  return 'https://faucet.preview.midnight.network';
})();

/** Footers and descriptions: "Midnight Preview", "Midnight Mainnet", etc. */
export const MIDNIGHT_NETWORK_CAPTION = `Midnight ${PUBLIC_NETWORK_LABEL}`;
