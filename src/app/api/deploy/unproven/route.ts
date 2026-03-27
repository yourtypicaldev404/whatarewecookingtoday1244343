import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userCoinPublicKey, userEncryptionPublicKey } = body;

    const deployServerUrl = (process.env.DEPLOY_SERVER_URL ?? 'http://localhost:3001').replace(/\/$/, '');

    const deployRes = await fetch(`${deployServerUrl}/deploy/unproven`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userCoinPublicKey, userEncryptionPublicKey }),
      signal: AbortSignal.timeout(60_000),
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
