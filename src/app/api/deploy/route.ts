import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min for ZK proof

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function POST(req: NextRequest) {
  try {
    const { name, ticker, description, imageUri, website, twitter, telegram, creatorAddr } = await req.json();

    if (!name || !ticker) {
      return NextResponse.json({ error: 'Missing name or ticker' }, { status: 400 });
    }

    // Deploy real contract via deploy server
    const deployServerUrl = process.env.DEPLOY_SERVER_URL ?? 'http://localhost:3001';

    const deployRes = await fetch(`${deployServerUrl}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ticker }),
      signal: AbortSignal.timeout(240_000), // 4 min timeout
    });

    if (!deployRes.ok) {
      const errText = await deployRes.text().catch(() => String(deployRes.status));
      let errMsg = errText;
      try { errMsg = (JSON.parse(errText) as { error?: string }).error ?? errText; } catch {}
      throw new Error(`Deploy failed: ${errMsg}`);
    }
    const { contractAddress, txId } = await deployRes.json();

    // Save to registry
    const tokens: any[] = (await redis.get('tokens')) ?? [];
    
    if (!tokens.find((t: any) => t.address === contractAddress)) {
      tokens.unshift({
        address:        contractAddress,
        name,
        ticker:         ticker.toUpperCase(),
        description:    description ?? '',
        imageUri:       imageUri ?? 'ipfs://',
        website:        website ?? '',
        twitter:        twitter ?? '',
        telegram:       telegram ?? '',
        creatorAddr:    creatorAddr ?? '',
        adaReserve:     '0',
        tokenReserve:   '999000000000000',
        totalVolume:    '0',
        txCount:        0,
        holderCount:    1,
        graduated:      false,
        lockedPercent:  0,
        kothScore:      0,
        deployedAt:     Math.floor(Date.now() / 1000),
        lastActivityAt: Math.floor(Date.now() / 1000),
        txId,
      });
      await redis.set('tokens', tokens);
    }

    return NextResponse.json({ contractAddress, txId }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
