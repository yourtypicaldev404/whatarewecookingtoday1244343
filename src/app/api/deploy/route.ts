import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, ticker, userCoinPublicKey, userEncryptionPublicKey } = body;

    if (!name || !ticker) {
      return NextResponse.json({ error: 'Missing name or ticker' }, { status: 400 });
    }

    const deployServerUrl = (process.env.DEPLOY_SERVER_URL ?? 'http://localhost:3001').replace(/\/$/, '');

    const deployRes = await fetch(`${deployServerUrl}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ticker, userCoinPublicKey, userEncryptionPublicKey }),
      signal: AbortSignal.timeout(240_000),
    });

    if (!deployRes.ok) {
      const errText = await deployRes.text().catch(() => String(deployRes.status));
      let errMsg = errText;
      try { errMsg = (JSON.parse(errText) as { error?: string }).error ?? errText; } catch {}
      throw new Error(errMsg);
    }

    const { unprovenTxHex, contractAddress } = await deployRes.json();
    return NextResponse.json({ unprovenTxHex, contractAddress });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
