'use client';

export async function submitBuyTx(params: {
  contractAddress: string;
  adaIn: bigint;
  tokensOut: bigint;
}) {
  const midnight = (window as any).midnight;
  if (!midnight) throw new Error('Install a Midnight wallet (1AM recommended)');
  const wallets = Object.values(midnight) as any[];
  if (!wallets.length) throw new Error('No Midnight wallet found');
  const api = await wallets[0].connect(process.env.NEXT_PUBLIC_NETWORK_ID ?? 'preprod');
  const intent = await api.makeIntent?.({
    type: 'contract-call',
    contractAddress: params.contractAddress,
    circuit: 'buy',
    args: [params.adaIn.toString(), params.tokensOut.toString()],
  });
  if (!intent) throw new Error('Wallet does not support makeIntent');
  const balanced = await api.balanceSealedTransaction(intent);
  const txId = await api.submitTransaction(balanced.tx);
  return { txId, contractAddress: params.contractAddress };
}

export async function submitSellTx(params: {
  contractAddress: string;
  tokensIn: bigint;
  adaOut: bigint;
}) {
  const midnight = (window as any).midnight;
  if (!midnight) throw new Error('Install a Midnight wallet (1AM recommended)');
  const wallets = Object.values(midnight) as any[];
  if (!wallets.length) throw new Error('No Midnight wallet found');
  const api = await wallets[0].connect(process.env.NEXT_PUBLIC_NETWORK_ID ?? 'preprod');
  const intent = await api.makeIntent?.({
    type: 'contract-call',
    contractAddress: params.contractAddress,
    circuit: 'sell',
    args: [params.tokensIn.toString(), params.adaOut.toString()],
  });
  if (!intent) throw new Error('Wallet does not support makeIntent');
  const balanced = await api.balanceSealedTransaction(intent);
  const txId = await api.submitTransaction(balanced.tx);
  return { txId };
}
