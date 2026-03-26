import type { Metadata } from 'next';
import { WalletProvider } from '@/lib/wallet/WalletProvider';
import WalletErrorModal from '@/components/WalletErrorModal';
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
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="scanlines" aria-hidden="true" />
        <div className="grid-overlay" aria-hidden="true" />
        <WalletProvider>
          {children}
          <WalletErrorModal />
        </WalletProvider>
      </body>
    </html>
  );
}
