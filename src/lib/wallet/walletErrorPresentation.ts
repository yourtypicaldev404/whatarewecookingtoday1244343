import { PUBLIC_NETWORK_ID, PUBLIC_NETWORK_LABEL } from '@/lib/network';

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
        `This site is set to "${expected}" (${PUBLIC_NETWORK_LABEL}). In your wallet settings, switch to the same network. ` +
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
      body: 'The wallet closed the request. Try Connect again when you are ready to approve.',
      variant: 'default',
    };
  }

  if (
    lower.includes('no midnight') ||
    lower.includes('wallet not found') ||
    lower.includes('extension') && lower.includes('install')
  ) {
    return {
      title: 'Wallet not found',
      body:
        'Install the 1AM wallet browser extension, then refresh this page and connect again.',
      variant: 'install',
    };
  }

  return {
    title: 'Wallet',
    body: raw,
    variant: 'default',
  };
}
