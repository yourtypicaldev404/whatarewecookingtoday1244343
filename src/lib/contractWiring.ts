'use client';

export async function deployBondingCurveViaWallet(params: {
  name: string;
  ticker: string;
  description: string;
  imageUri: string;
}) {
  const res = await fetch('/api/deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
