import { NextRequest, NextResponse } from 'next/server';
import { MidnightIndexerClient } from '@/lib/indexer';
import type { TokenRecord } from '../route';

export const dynamic = 'force-dynamic';

const indexer = new MidnightIndexerClient(
  process.env.NEXT_PUBLIC_INDEXER_URL ?? 'https://indexer.preprod.midnight.network'
);

// Mock detail for development (remove once contract is deployed)
const MOCK_DETAIL: TokenRecord = {
  address:        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
  name:           'Midnight Cat',
  ticker:         'MCAT',
  description:    'The first cat on Midnight. Privacy meows. ZK vibes only. No one knows who petted the cat.',
  imageUri:       'ipfs://QmMidnightCatExample',
  twitter:        'https://x.com/midnightcat',
  website:        'https://midnightcat.xyz',
  creatorAddr:    'mn_addr_preprod1testcreator4f8a',
  adaReserve:     '14500000000',
  tokenReserve:   '750000000000000',
  totalVolume:    '28000000000',
  txCount:        347,
  holderCount:    89,
  graduated:      false,
  lockedPercent:  20,
  kothScore:      78,
  deployedAt:     Math.floor(Date.now() / 1000) - 86400,
  lastActivityAt: Math.floor(Date.now() / 1000) - 120,
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } },
) {
  const { address } = params;

  try {
    // 1. Fetch live contract state from Preprod Indexer
    const contractAction = await indexer.getContractAction(address).catch(() => null);

    // 2. Decode ledger state (requires compiled contract bindings)
    let liveState = null;
    if (contractAction) {
      liveState = indexer.decodeLedgerState(contractAction.state);
    }

    // 3. Merge live state into our registry record
    // In production: query DB for metadata, merge with live indexer data
    const token = { ...MOCK_DETAIL, address };

    if (liveState) {
      token.adaReserve   = liveState.adaReserve.toString();
      token.tokenReserve = liveState.tokenReserve.toString();
      token.totalVolume  = liveState.totalVolume.toString();
      token.txCount      = liveState.txCount;
      token.graduated    = liveState.state === 'GRADUATED';
    }

    return NextResponse.json({ token, hasLiveData: !!liveState });

  } catch (err) {
    console.error(`[GET /api/tokens/${address}]`, err);
    return NextResponse.json({ error: 'Failed to fetch token' }, { status: 500 });
  }
}

// PATCH /api/tokens/[address] — update state after a trade (called by our indexer sync job)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { address: string } },
) {
  try {
    const body = await req.json() as {
      adaReserve?:    string;
      tokenReserve?:  string;
      totalVolume?:   string;
      txCount?:       number;
      graduated?:     boolean;
      holderCount?:   number;
      lastActivityAt?:number;
    };

    // TODO: update DB record
    // await db.token.update({ where: { address: params.address }, data: body });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
