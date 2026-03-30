import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { WebSocket } from "ws";

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { HDWallet, Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import { createKeystore, InMemoryTransactionHistoryStorage, PublicKey, UnshieldedWallet } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import * as ledger from "@midnight-ntwrk/ledger-v8";

import { Contract } from "../contracts/managed/bonding_curve/contract/index.js";

globalThis.WebSocket = WebSocket;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZK_PATH = path.resolve(__dirname, "../contracts/managed/bonding_curve");

/** Align with deploy-server.mjs + Vercel — default Mainnet. Override: NETWORK_ID=preview node scripts/deploy-real.mjs */
const NETWORK_ID = (process.env.NETWORK_ID ?? "mainnet").toLowerCase();
const ENDPOINTS = {
  mainnet: {
    INDEXER: "https://indexer.mainnet.midnight.network/api/v4/graphql",
    INDEXERWS: "wss://indexer.mainnet.midnight.network/api/v4/graphql/ws",
    NODE: "https://rpc.mainnet.midnight.network",
    PROOF: process.env.PROOF_SERVER_URL ?? "http://127.0.0.1:6300",
  },
  preview: {
    INDEXER: "https://indexer.preview.midnight.network/api/v4/graphql",
    INDEXERWS: "wss://indexer.preview.midnight.network/api/v4/graphql/ws",
    NODE: "https://rpc.preview.midnight.network",
    PROOF: process.env.PROOF_SERVER_URL ?? "https://proof-server.preview.midnight.network",
  },
  preprod: {
    INDEXER: "https://indexer.preprod.midnight.network/api/v3/graphql",
    INDEXERWS: "wss://indexer.preprod.midnight.network/api/v3/graphql/ws",
    NODE: "https://rpc.preprod.midnight.network",
    PROOF: process.env.PROOF_SERVER_URL ?? "https://lace-proof-pub.preprod.midnight.network",
  },
};
const ep = ENDPOINTS[NETWORK_ID] ?? ENDPOINTS.mainnet;
const INDEXER = ep.INDEXER;
const INDEXERWS = ep.INDEXERWS;
const NODE = ep.NODE;
const PROOF = ep.PROOF;

setNetworkId(NETWORK_ID);

function deriveKeys(seed) {
  const hd = HDWallet.fromSeed(Buffer.from(seed, "hex"));
  if (hd.type !== "seedOk") throw new Error("Bad seed");
  const r = hd.hdWallet.selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (r.type !== "keysDerived") throw new Error("Key derivation failed");
  hd.hdWallet.clear();
  return r.keys;
}

async function main() {
  console.log(`Network: ${NETWORK_ID} (set NETWORK_ID=preview to override)\n`);
  const dep  = JSON.parse(fs.readFileSync("deployment.json", "utf-8"));
  const seed = dep.walletSeed ?? dep.seed;
  if (!seed) throw new Error("No seed in deployment.json");

  console.log("Deriving keys...");
  const keys       = deriveKeys(seed);
  const shieldedSK = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSK     = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const keystore   = createKeystore(keys[Roles.NightExternal], NETWORK_ID);
  const dustParams = ledger.LedgerParameters.initialParameters().dust;

  console.log("Address:", keystore.getBech32Address().toString());

  const sharedCfg = {
    networkId: NETWORK_ID,
    indexerClientConnection: { indexerHttpUrl: INDEXER, indexerWsUrl: INDEXERWS },
  };

  console.log("Building wallet...");
  const config = {
    ...sharedCfg,
    provingServerUrl: new URL(PROOF),
    relayURL: new URL(NODE.replace(/^http/, "ws")),
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

  console.log("Syncing...");
  const state = await wallet.waitForSyncedState();
  console.log("Synced!");

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
      privateStateStoreName: "night-fun-state",
      privateStoragePasswordProvider: () => "night-fun-secret-2026",
      accountId: "deployer",
    }),
    publicDataProvider:  indexerPublicDataProvider(INDEXER, INDEXERWS),
    zkConfigProvider:    zkConfig,
    proofProvider:       httpClientProofProvider(PROOF, zkConfig),
    walletProvider,
    midnightProvider:    walletProvider,
  };

  const creatorSk  = new Uint8Array(Buffer.from(seed, "hex").slice(0, 32));
  const treasurySk = new Uint8Array(Buffer.from(dep.treasuryKey ?? seed, "hex").slice(0, 32));
  const witnesses  = { treasurySecretKey: () => treasurySk };

  const { CompiledContract } = await import("@midnight-ntwrk/compact-js");
  const compiledContract = CompiledContract.make("bonding_curve", Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(ZK_PATH),
  );

  console.log("Deploying (ZK proof ~60s)...");
  const deployed = await deployContract(providers, {
    compiledContract,
    privateStateId:      "bondingCurve",
    initialPrivateState: {},
    args: [creatorSk, treasurySk],
  });

  const addr = deployed.deployTxData.public.contractAddress;
  console.log("✅ DEPLOYED:", addr);
  console.log("Tx:", deployed.deployTxData.public.txId);

  dep.contractAddress = addr;
  dep.txId = deployed.deployTxData.public.txId;
  fs.writeFileSync("deployment.json", JSON.stringify(dep, null, 2));

  await wallet.stop();
  process.exit(0);
}

main().catch(err => {
  console.error("Failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
