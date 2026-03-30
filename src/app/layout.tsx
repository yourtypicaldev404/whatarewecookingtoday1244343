import type { Metadata } from 'next';
import { WalletProvider } from '@/lib/wallet/WalletProvider';
import WalletErrorModal from '@/components/WalletErrorModal';
import AppShell from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'night.fun — Midnight Memecoin Launchpad',
  description: 'Launch and trade memecoins on Midnight Network.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <WalletProvider>
          <AppShell>
            {children}
          </AppShell>
          <WalletErrorModal />
        </WalletProvider>
      </body>
    </html>
  );
}
