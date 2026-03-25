import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const PINATA_JWT     = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs';

export async function POST(req: NextRequest) {
  try {
    const { data } = await req.json() as { data: string };
    if (!data?.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    const [header, base64] = data.split(',');
    const mime = header.match(/data:([^;]+);/)?.[1] ?? 'image/png';
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowed.includes(mime)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
    }

    const buf = Buffer.from(base64, 'base64');
    if (buf.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 5MB)' }, { status: 400 });
    }

    if (!PINATA_JWT) {
      // Dev mode: return a placeholder URI
      console.warn('[/api/upload] No PINATA_JWT — using placeholder');
      return NextResponse.json({
        ipfsUri:    'ipfs://QmPlaceholderHashForDevelopment',
        gatewayUrl: 'https://via.placeholder.com/200',
      });
    }

    const form = new FormData();
    form.append('file', new Blob([buf], { type: mime }), `night-fun-icon.${mime.split('/')[1]}`);
    form.append('pinataOptions',  JSON.stringify({ cidVersion: 1 }));
    form.append('pinataMetadata', JSON.stringify({ name: 'night.fun token icon' }));

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method:  'POST',
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body:    form,
    });

    if (!res.ok) {
      console.error('[Pinata]', await res.text());
      return NextResponse.json({ error: 'IPFS upload failed' }, { status: 502 });
    }

    const { IpfsHash } = await res.json() as { IpfsHash: string };
    return NextResponse.json({
      ipfsUri:    `ipfs://${IpfsHash}`,
      gatewayUrl: `${PINATA_GATEWAY}/${IpfsHash}`,
    });

  } catch (err) {
    console.error('[/api/upload]', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
