import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/tokens
 * Returns the list of deployed bonding curve contracts tracked by night.fun.
 *
 * Since Midnight doesn't have a global token factory contract (yet),
 * we maintain our own registry in a simple SQLite/Postgres DB.
 * When a user deploys via night.fun, we save their contract address here.
 *
 * Query params:
 *   sort    = bump | new | mcap | graduated  (default: bump)
 *   search  = string (name, ticker, or address)
 *   limit   = number (default: 50, max: 100)
 *   offset  = number (default: 0)
 */

export const dynamic = 'force-dynamic';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TokenRecord {
  address:       string;    // contract address (hex)
  name:          string;
  ticker:        string;
  description:   string;
  imageUri:      string;    // ipfs://...
  website?:      string;
  twitter?:      string;
  telegram?:     string;
  discord?:      string;
  creatorAddr:   string;    // deployer's unshielded address
  adaReserve:    string;    // bigint as string (tDUST)
  tokenReserve:  string;
  totalVolume:   string;
  txCount:       number;
  holderCount:   number;
  graduated:     boolean;
  lockedPercent: number;
  kothScore:     number;
  deployedAt:    number;    // unix seconds
  lastActivityAt:number;
}

// ── In-memory registry (replace with real DB) ────────────────────────────────
// In production: use Prisma + Postgres, or even a simple SQLite file.
// The DB gets populated by:
//   1. Our deploy script when a token is launched via night.fun
//   2. A background indexer that scans the Midnight Preprod indexer for
//      new deployments of contracts matching our bonding curve bytecode hash.

const MOCK_REGISTRY: TokenRecord[] = [
  {
    address:        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
    name:           'Midnight Cat',
    ticker:         'MCAT',
    description:    'The first cat on Midnight. Privacy meows. ZK vibes only.',
    imageUri:       'ipfs://QmMidnightCatExample',
    twitter:        'https://x.com/midnightcat',
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
  },
  {
    address:        '0xdeadbeef99887766aabbccddeeff99887766aabbccddeeff99887766aabbccdd',
    name:           'ZK Pepe',
    ticker:         'ZKPEPE',
    description:    'Zero knowledge. Zero rug. Pepe found privacy on Midnight.',
    imageUri:       'ipfs://QmZKPepeExample',
    twitter:        'https://x.com/zkpepe',
    telegram:       'https://t.me/zkpepe',
    creatorAddr:    'mn_addr_preprod1testcreator9c2e',
    adaReserve:     '69000000000',
    tokenReserve:   '1000000',
    totalVolume:    '183000000000',
    txCount:        2100,
    holderCount:    183,
    graduated:      true,
    lockedPercent:  0,
    kothScore:      0,
    deployedAt:     Math.floor(Date.now() / 1000) - 172800,
    lastActivityAt: Math.floor(Date.now() / 1000) - 3600,
  },
  {
    address:        '0x1122334455667788aabbccddeeff11223344556677889900aabbccddeeff1122',
    name:           'Proof of Degen',
    ticker:         'POD',
    description:    'Proving you degenned without revealing your wallet.',
    imageUri:       'ipfs://QmPODExample',
    creatorAddr:    'mn_addr_preprod1testcreatoraaaa',
    adaReserve:     '31000000000',
    tokenReserve:   '580000000000000',
    totalVolume:    '67000000000',
    txCount:        891,
    holderCount:    156,
    graduated:      false,
    lockedPercent:  10,
    kothScore:      62,
    deployedAt:     Math.floor(Date.now() / 1000) - 43200,
    lastActivityAt: Math.floor(Date.now() / 1000) - 60,
  },
];

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const sort   = (params.get('sort') ?? 'bump') as 'bump' | 'new' | 'mcap' | 'graduated';
  const search = params.get('search')?.toLowerCase();
  const limit  = Math.min(100, Math.max(1, Number(params.get('limit')  ?? 50)));
  const offset = Math.max(0, Number(params.get('offset') ?? 0));

  let tokens = [...MOCK_REGISTRY];

  // Filter
  if (search) {
    tokens = tokens.filter(t =>
      t.name.toLowerCase().includes(search)    ||
      t.ticker.toLowerCase().includes(search)  ||
      t.address.toLowerCase().includes(search)
    );
  }

  // Sort
  if (sort === 'bump') {
    tokens.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  } else if (sort === 'new') {
    tokens.sort((a, b) => b.deployedAt - a.deployedAt);
  } else if (sort === 'mcap') {
    tokens.sort((a, b) => Number(BigInt(b.adaReserve) - BigInt(a.adaReserve)));
  } else if (sort === 'graduated') {
    tokens = tokens.filter(t => t.graduated);
  }

  // King of the Hill = highest kothScore among non-graduated tokens
  const kothAddress = tokens
    .filter(t => !t.graduated)
    .sort((a, b) => b.kothScore - a.kothScore)[0]?.address ?? null;

  const page = tokens.slice(offset, offset + limit);

  return NextResponse.json({
    tokens:      page,
    total:       tokens.length,
    kothAddress,
    limit,
    offset,
  });
}

// ── POST /api/tokens — register a newly deployed contract ────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<TokenRecord> & {
      txHash: string;
    };

    // Validate required fields
    const required = ['address', 'name', 'ticker', 'description', 'creatorAddr', 'txHash'];
    for (const field of required) {
      if (!body[field as keyof typeof body]) {
        return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
      }
    }

    const record: TokenRecord = {
      address:        body.address!,
      name:           body.name!,
      ticker:         body.ticker!.toUpperCase(),
      description:    body.description!,
      imageUri:       body.imageUri ?? 'ipfs://',
      website:        body.website,
      twitter:        body.twitter,
      telegram:       body.telegram,
      discord:        body.discord,
      creatorAddr:    body.creatorAddr!,
      adaReserve:     body.adaReserve    ?? '0',
      tokenReserve:   body.tokenReserve  ?? '999000000000000',
      totalVolume:    body.totalVolume   ?? '0',
      txCount:        body.txCount       ?? 0,
      holderCount:    body.holderCount   ?? 1,
      graduated:      false,
      lockedPercent:  body.lockedPercent ?? 0,
      kothScore:      0,
      deployedAt:     Math.floor(Date.now() / 1000),
      lastActivityAt: Math.floor(Date.now() / 1000),
    };

    // TODO: save to DB
    // await db.token.create({ data: record });
    MOCK_REGISTRY.unshift(record);

    return NextResponse.json({ ok: true, address: record.address }, { status: 201 });

  } catch (err) {
    console.error('[POST /api/tokens]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
