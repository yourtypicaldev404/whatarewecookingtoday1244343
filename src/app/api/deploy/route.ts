import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, ticker, description, imageUri } = body;

    // For now return a mock address so the UI flow works
    // Real deploy happens via the CLI: npm run deploy
    const mockAddress = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // TODO: wire real deployContract() here once we confirm
    // the SDK works server-side with the compiled contract

    return NextResponse.json({
      contractAddress: mockAddress,
      txId: '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join(''),
      status: 'deployed',
      note: 'Real deploy via: npm run deploy in terminal',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
