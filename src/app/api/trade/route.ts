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

  const tradePayload = JSON.stringify(body);

  try {
    const t0 = performance.now();
    let res: Response | null = null;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      res = await fetch(`${deployServerUrl}/trade/build`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'night.fun-trade-proxy/1.0',
        },
        body: tradePayload,
        signal: AbortSignal.timeout(240_000),
      });
      if (res.ok) break;
      if (attempt < maxAttempts && [502, 503, 504].includes(res.status)) {
        await new Promise((r) => setTimeout(r, 2500 * attempt));
        continue;
      }
      break;
    }
    if (!res) {
      return NextResponse.json({ error: 'Trade proxy: no response from deploy server' }, { status: 502 });
    }
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
      if (!msg?.trim() || /^service unavailable$/i.test(msg.trim())) {
        msg =
          res.status >= 502
            ? `Deploy server at ${deployServerUrl} returned ${res.status}. Check it is running, PROOF_SERVER_URL points to a reachable proof server, and Railway/Vercel networking is OK.`
            : msg;
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
