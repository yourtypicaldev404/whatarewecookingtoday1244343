import { PUBLIC_NETWORK_ID } from '@/lib/network';

export type WalletErrorPresentation = {
  title: string;
  body: string;
  variant: 'default' | 'network' | 'install';
};

/**
 * Map raw wallet errors to friendly copy for the modal.
 */
export function getWalletErrorPresentation(raw: string): WalletErrorPresentation {
  const lower = raw.toLowerCase();
  const expected = PUBLIC_NETWORK_ID;

  if (
    lower.includes('mismatch') ||
    (lower.includes('network') &&
      (lower.includes('does not match') ||
        lower.includes('do not match') ||
        lower.includes('wrong network') ||
        lower.includes('expected')))
  ) {
    return {
      title: 'Network does not match',
      body:
        `This site is set to "${expected}". In Lace open Settings → Midnight → Configure Midnight Nodes and choose the same network (Preview matches this app until mainnet). ` +
        `If you deploy the app yourself, set NEXT_PUBLIC_NETWORK_ID to match your wallet.`,
      variant: 'network',
    };
  }

  if (
    lower.includes('reject') ||
    lower.includes('denied') ||
    lower.includes('user cancelled') ||
    lower.includes('user canceled')
  ) {
    return {
      title: 'Request cancelled',
      body: 'Lace closed the request. Try Connect again when you are ready to approve in the wallet.',
      variant: 'default',
    };
  }

  if (
    lower.includes('no midnight') ||
    lower.includes('wallet not found') ||
    lower.includes('extension') && lower.includes('install')
  ) {
    return {
      title: 'Lace not found',
      body:
        'Install the Lace browser extension, enable Midnight in Lace settings, then refresh this page and connect again.',
      variant: 'install',
    };
  }

  return {
    title: 'Wallet',
    body: raw,
    variant: 'default',
  };
}
