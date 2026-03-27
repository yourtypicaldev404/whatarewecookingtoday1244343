import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Proxies to deploy server POST /trade/unproven: create unproven call tx (no server-side proving).
 * Browser then proves via Lace's getProvingProvider, balances, and submits.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  const deployServerUrl = (process.env.DEPLOY_SERVER_URL ?? 'http://localhost:3001').replace(/\/$/, '');

  try {
    let res: Response | null = null;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      res = await fetch(`${deployServerUrl}/trade/unproven`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
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

    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch {}
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    return NextResponse.json(JSON.parse(text));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Trade proxy failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
