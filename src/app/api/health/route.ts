import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const deployServerUrl = (process.env.DEPLOY_SERVER_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  try {
    const res = await fetch(`${deployServerUrl}/health`, { signal: AbortSignal.timeout(10_000) });
    const body = await res.json();
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ status: 'unreachable' }, { status: 503 });
  }
}
