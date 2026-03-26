import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Proxies buy/sell to the Railway deploy server (same pattern as /api/deploy).
 * Browser calls same-origin /api/trade — avoids "Failed to fetch" to localhost:3001 on Vercel.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  const deployServerUrl = (process.env.DEPLOY_SERVER_URL ?? 'http://localhost:3001').replace(
    /\/$/,
    '',
  );

  try {
    const res = await fetch(`${deployServerUrl}/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(240_000),
    });

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

    return NextResponse.json(JSON.parse(text));
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
