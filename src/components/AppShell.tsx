'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import TopWalletBar from './TopWalletBar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className={`app-main${collapsed ? ' collapsed' : ''}`}>
        <TopWalletBar />
        {children}
      </main>
    </div>
  );
}
