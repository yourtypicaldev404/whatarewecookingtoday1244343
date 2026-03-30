import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { filename, mimeType, base64 } = await req.json();
    const jwt = process.env.PINATA_JWT;
    if (!jwt) return NextResponse.json({ error: 'No Pinata JWT' }, { status: 500 });

    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mimeType });
    const form = new FormData();
    form.append('file', blob, filename);
    form.append('pinataMetadata', JSON.stringify({ name: filename }));

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });

    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: t }, { status: 500 });
    }

    const { IpfsHash } = await res.json();
    return NextResponse.json({
      cid: IpfsHash,
      ipfsUrl: `ipfs://${IpfsHash}`,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${IpfsHash}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
