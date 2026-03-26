import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { createKeystore, InMemoryTransactionHistoryStorage, PublicKey, UnshieldedWallet } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { CompiledContract } from '@midnight-ntwrk/compact-js';

globalThis.WebSocket = WebSocket;
setNetworkId('preprod');
// Also set for midnight-js-contracts nested copy
import('/tmp/set-network.mjs').then(m => m.setNetworkId('preprod')).catch(() => {});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZK_PATH   = path.resolve(__dirname, './contracts/managed/bonding_curve');

const INDEXER   = 'https://indexer.preprod.midnight.network/api/v3/graphql';
const INDEXERWS = 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';
const NODE      = 'https://rpc.preprod.midnight.network';
const PROOF     = process.env.PROOF_SERVER_URL ?? 'http://localhost:6300';
const SEED      = process.env.DEPLOYER_SEED ?? '971da3750a45a3812c732f8b70ccb9d8c7e7b55e65700b87f5346fc1c7d1a952';
const TREASURY  = process.env.TREASURY_SEED ?? SEED;
const PORT      = process.env.PORT ?? process.env.DEPLOY_SERVER_PORT ?? 3001;

// Import contract
const { Contract } = await import('./contracts/managed/bonding_curve/contract/index.js');

function deriveKeys(seed) {
  const hd = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hd.type !== 'seedOk') throw new Error('Bad seed');
  const r = hd.hdWallet.selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (r.type !== 'keysDerived') throw new Error('Key derivation failed');
  hd.hdWallet.clear();
  return r.keys;
}

async function buildWallet(seed) {
  const keys       = deriveKeys(seed);
  const shieldedSK = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSK     = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const keystore   = createKeystore(keys[Roles.NightExternal], 'preprod');
  const dustParams = ledger.LedgerParameters.initialParameters().dust;

  const config = {
    networkId: 'preprod',
    indexerClientConnection: { indexerHttpUrl: INDEXER, indexerWsUrl: INDEXERWS },
    provingServerUrl: new URL(PROOF),
    relayURL: new URL(NODE.replace(/^http/, 'ws')),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
    costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  };

  const wallet = await WalletFacade.init({
    configuration: config,
    shielded:   (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSK),
    unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(keystore)),
    dust:       (cfg) => DustWallet(cfg).startWithSecretKey(dustSK, dustParams),
  });

  await wallet.start(shieldedSK, dustSK);

  await Rx.firstValueFrom(
    wallet.state().pipe(Rx.throttleTime(5000), Rx.filter(s => s.isSynced))
  );

  return { wallet, shieldedSK, dustSK, keystore };
}

async function deployBondingCurve() {
  const { wallet, shieldedSK, dustSK } = await buildWallet(SEED);
  const treasuryKeys = deriveKeys(TREASURY);
  const creatorSk  = new Uint8Array(Buffer.from(SEED, 'hex').slice(0, 32));
  const treasurySk = new Uint8Array(Buffer.from(TREASURY, 'hex').slice(0, 32));

  const state = await Rx.firstValueFrom(
    wallet.state().pipe(Rx.throttleTime(5000), Rx.filter(s => s.isSynced))
  );
  const walletProvider = {
    getCoinPublicKey:       () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx, ttl) {
      const recipe = await wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: shieldedSK, dustSecretKey: dustSK },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) }
      );
      return wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx) => wallet.submitTransaction(tx),
  };

  const zkConfig = new NodeZkConfigProvider(ZK_PATH);
  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'night-fun-state-' + Date.now(),
      privateStoragePasswordProvider: () => 'night-fun-secret-2026',
      accountId: 'deployer-' + Date.now(),
    }),
    publicDataProvider:  indexerPublicDataProvider(INDEXER, INDEXERWS),
    zkConfigProvider:    zkConfig,
    proofProvider:       httpClientProofProvider(PROOF, zkConfig),
    walletProvider,
    midnightProvider:    walletProvider,
  };

  const witnesses = { treasurySecretKey: () => treasurySk };
  const compiledContract = CompiledContract.make('bonding_curve', Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(ZK_PATH),
  );

  const deployed = await deployContract(providers, {
    compiledContract,
    privateStateId:      'bondingCurve',
    initialPrivateState: {},
    args: [creatorSk, treasurySk],
  });

  await wallet.stop();
  return {
    contractAddress: deployed.deployTxData.public.contractAddress,
    txId: deployed.deployTxData.public.txId,
  };
}

// Express server
const app = express();

// CORS for cross-origin requests from Vercel frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.post('/deploy', async (req, res) => {
  console.log('Deploying contract for:', req.body.name, req.body.ticker);
  try {
    const result = await deployBondingCurve();
    console.log('Deployed:', result.contractAddress);
    res.json(result);
  } catch (err) {
    console.error('Deploy failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/trade', async (req, res) => {
  const { contractAddress, action, adaIn, tokensOut, tokensIn, adaOut } = req.body;
  console.log(`Trade request: ${action} on ${contractAddress}`);

  if (!contractAddress || !action || !['buy', 'sell'].includes(action)) {
    return res.status(400).json({ error: 'Missing contractAddress or invalid action (buy|sell)' });
  }
  if (action === 'buy' && (!adaIn || !tokensOut)) {
    return res.status(400).json({ error: 'buy requires adaIn and tokensOut' });
  }
  if (action === 'sell' && (!tokensIn || !adaOut)) {
    return res.status(400).json({ error: 'sell requires tokensIn and adaOut' });
  }

  try {
    const { wallet, shieldedSK, dustSK } = await buildWallet(SEED);

    const state = await Rx.firstValueFrom(
      wallet.state().pipe(Rx.throttleTime(5000), Rx.filter(s => s.isSynced))
    );
    const walletProvider = {
      getCoinPublicKey:       () => state.shielded.coinPublicKey.toHexString(),
      getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
      async balanceTx(tx, ttl) {
        const recipe = await wallet.balanceUnboundTransaction(
          tx,
          { shieldedSecretKeys: shieldedSK, dustSecretKey: dustSK },
          { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) }
        );
        return wallet.finalizeRecipe(recipe);
      },
      submitTx: (tx) => wallet.submitTransaction(tx),
    };

    const zkConfig = new NodeZkConfigProvider(ZK_PATH);
    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: 'night-fun-trade-' + Date.now(),
        privateStoragePasswordProvider: () => 'night-fun-secret-2026',
        accountId: 'trader-' + Date.now(),
      }),
      publicDataProvider:  indexerPublicDataProvider(INDEXER, INDEXERWS),
      zkConfigProvider:    zkConfig,
      proofProvider:       httpClientProofProvider(PROOF, zkConfig),
      walletProvider,
      midnightProvider:    walletProvider,
    };

    const treasurySk = new Uint8Array(Buffer.from(TREASURY, 'hex').slice(0, 32));
    const witnesses = { treasurySecretKey: () => treasurySk };
    const compiledContract = CompiledContract.make('bonding_curve', Contract).pipe(
      CompiledContract.withWitnesses(witnesses),
      CompiledContract.withCompiledFileAssets(ZK_PATH),
    );

    const deployed = await findDeployedContract(providers, {
      contractAddress,
      contract: compiledContract,
      privateStateId: 'bondingCurve-' + contractAddress,
      initialPrivateState: {},
    });

    let txData;
    if (action === 'buy') {
      txData = await deployed.callTx.buy(BigInt(adaIn), BigInt(tokensOut));
    } else {
      txData = await deployed.callTx.sell(BigInt(tokensIn), BigInt(adaOut));
    }

    await wallet.stop();

    const result = { txId: txData.public.txId, contractAddress, action };
    console.log('Trade result:', result);
    res.json(result);
  } catch (err) {
    console.error('Trade failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Night.fun deploy server running on port ${PORT}`);
  console.log(`Proof server: ${PROOF}`);
});
