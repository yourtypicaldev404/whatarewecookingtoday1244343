import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DB_FILE = path.resolve(process.cwd(), 'token-registry.json');

function loadTokens() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch {}
  return [];
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const { address } = await context.params;
  const token = loadTokens().find((t: any) => t.address === address) ?? null;
  return NextResponse.json({ token });
}
