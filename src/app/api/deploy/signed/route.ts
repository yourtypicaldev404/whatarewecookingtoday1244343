import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Proxies to deploy server POST /deploy/signed: server-side deploy authorized
 * by the user's Lace signData signature. Bypasses balanceUnsealedTransaction.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, ticker, signature, verifyingKey } = body;

    if (!name || !ticker) {
      return NextResponse.json({ error: 'Missing name or ticker' }, { status: 400 });
    }
    if (!signature || !verifyingKey) {
      return NextResponse.json({ error: 'Missing wallet signature' }, { status: 400 });
    }

    const deployServerUrl = (process.env.DEPLOY_SERVER_URL ?? 'http://localhost:3001').replace(/\/$/, '');

    const deployRes = await fetch(`${deployServerUrl}/deploy/signed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ticker, signature, verifyingKey }),
      signal: AbortSignal.timeout(240_000),
    });

    if (!deployRes.ok) {
      const errText = await deployRes.text().catch(() => String(deployRes.status));
      let errMsg = errText;
      try { errMsg = (JSON.parse(errText) as { error?: string }).error ?? errText; } catch {}
      throw new Error(errMsg);
    }

    const result = await deployRes.json();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
