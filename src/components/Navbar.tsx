'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@/lib/wallet/WalletProvider';

export default function Navbar() {
  const pathname = usePathname();
  const { connected, connecting, connect, disconnect } = useWallet();

  return (
    <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, height:56, background:'rgba(5,5,8,0.88)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', padding:'0 20px', gap:14 }}>
      <Link href="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <div style={{ width:30, height:30, borderRadius:8, background:'linear-gradient(135deg,#8b5cf6,#22d3ee)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>🌙</div>
        <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:18, letterSpacing:'-0.03em', color:'#fff' }}>
          night<span style={{ color:'var(--neon-violet-bright)' }}>.fun</span>
        </span>
      </Link>

      <div style={{ display:'flex', gap:2, marginLeft:8 }}>
        {[['/', 'Discover'],['/launch','Launch'],['/portfolio','Portfolio']].map(([href, label]) => (
          <Link key={href} href={href} style={{ fontFamily:'var(--font-display)', fontWeight:500, fontSize:17, color: pathname===href ? '#fff' : 'var(--text-secondary)', textDecoration:'none', padding:'7px 16px', borderRadius:7, background: pathname===href ? 'rgba(255,255,255,0.07)' : 'transparent' }}>
            {label}
          </Link>
        ))}
      </div>

      <div style={{ flex:1 }} />

      <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--neon-amber)', background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:6, padding:'3px 7px', textTransform:'uppercase', letterSpacing:'0.08em' }}>preprod</div>

      <button
        onClick={() => {
          if (connected) {
            disconnect();
          } else {
            const hasMidnightWallet = typeof window !== 'undefined' &&
              window.midnight &&
              Object.keys(window.midnight).length > 0;
            if (hasMidnightWallet) {
              connect();
            } else {
              const ua = navigator.userAgent;
              let storeUrl: string;
              if (ua.includes('Firefox/')) {
                storeUrl = 'https://addons.mozilla.org/firefox/addon/lace-wallet/';
              } else if (ua.includes('Edg/')) {
                storeUrl = 'https://microsoftedge.microsoft.com/addons/detail/lace/efeiemlfnahiidnjglmehaihacglceia';
              } else {
                // Chrome, Brave, and all other Chromium browsers
                storeUrl = 'https://chrome.google.com/webstore/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk';
              }
              window.location.href = storeUrl;
            }
          }
        }}
        disabled={connecting}
        style={{ display:'flex', alignItems:'center', gap:6, background: connected ? 'var(--night-raised)' : 'linear-gradient(135deg,var(--neon-violet),#6d28d9)', color:'#fff', border: connected ? '1px solid var(--night-border-active)' : 'none', borderRadius:9, padding:'8px 18px', fontFamily:'var(--font-display)', fontWeight:600, fontSize:16, cursor:'pointer', flexShrink:0 }}>
        {connected ? (
          <><span style={{ width:6, height:6, borderRadius:'50%', background:'var(--neon-green)', boxShadow:'0 0 5px var(--neon-green)' }} />Connected</>
        ) : connecting ? '⏳ Connecting…' : <>🌙 Connect Lace</>}
      </button>
    </nav>
  );
}
