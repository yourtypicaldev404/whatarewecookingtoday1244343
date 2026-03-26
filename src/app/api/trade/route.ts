import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Proxies to deploy server POST /trade/build: create unproven call + ZK prove using caller's
 * shielded keys. Browser then uses Lace balanceUnsealedTransaction + submitTransaction.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  const deployServerUrl = (process.env.DEPLOY_SERVER_URL ?? 'http://localhost:3001').replace(
    /\/$/,
    '',
  );

  try {
    const t0 = performance.now();
    const res = await fetch(`${deployServerUrl}/trade/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(240_000),
    });
    const proxyRoundTripMs = Math.round(performance.now() - t0);

    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try {
        const j = JSON.parse(text) as { error?: string };
        msg = j.error ?? text;
      } catch {
        /* keep text */
      }
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    const payload = JSON.parse(text) as Record<string, unknown>;
    const profile = payload.profile as Record<string, unknown> | undefined;
    if (profile && typeof profile === 'object') {
      payload.profile = { ...profile, proxyRoundTripMs };
    } else {
      payload.profile = { proxyRoundTripMs };
    }
    return NextResponse.json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Trade proxy failed';
    return NextResponse.json(
      {
        error:
          message.includes('fetch') || message.includes('ECONNREFUSED')
            ? `Could not reach deploy server at ${deployServerUrl}. Set DEPLOY_SERVER_URL in Vercel to your Railway URL.`
            : message,
      },
      { status: 502 },
    );
  }
}
