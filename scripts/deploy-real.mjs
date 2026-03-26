import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { WebSocket } from "ws";
import * as Rx from "rxjs";

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { setNetworkId as setNetworkId2 } from "/tmp/set-network.mjs";
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
import { Contract, contractReferenceLocations, pureCircuits } from "../contracts/managed/bonding_curve/contract/index.js";
import { CompiledContract } from "@midnight-ntwrk/compact-js";

globalThis.WebSocket = WebSocket;
setNetworkId("preprod");
try { setNetworkId2("preprod"); } catch(e) {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZK_PATH   = path.resolve(__dirname, "../contracts/managed/bonding_curve");

const INDEXER   = "https://indexer.preprod.midnight.network/api/v3/graphql";
const INDEXERWS = "wss://indexer.preprod.midnight.network/api/v3/graphql/ws";
const NODE      = "https://rpc.preprod.midnight.network";
const PROOF     = "http://localhost:6300";

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
  const dep  = JSON.parse(fs.readFileSync("deployment.json", "utf-8"));
  const seed = dep.walletSeed ?? dep.seed;
  if (!seed) throw new Error("No seed in deployment.json");

  console.log("Deriving keys...");
  const keys       = deriveKeys(seed);
  const shieldedSK = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSK     = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const keystore   = createKeystore(keys[Roles.NightExternal], "preprod");
  const dustParams = ledger.LedgerParameters.initialParameters().dust;

  console.log("Address:", keystore.getBech32Address());

  const config = {
    networkId: "preprod",
    indexerClientConnection: { indexerHttpUrl: INDEXER, indexerWsUrl: INDEXERWS },
    provingServerUrl: new URL(PROOF),
    relayURL: new URL(NODE.replace(/^http/, "ws")),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
    costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  };

  console.log("Initializing wallet via WalletFacade.init...");
  const wallet = await WalletFacade.init({
    configuration: config,
    shielded:   (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSK),
    unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(keystore)),
    dust:       (cfg) => DustWallet(cfg).startWithSecretKey(dustSK, dustParams),
  });

  await wallet.start(shieldedSK, dustSK);

  console.log("Syncing with Preprod...");
  const state = await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5000),
      Rx.filter(s => s.isSynced),
    )
  );
  const dustBal = (() => { try { return state.dust.walletBalance(new Date()); } catch(e) { try { return state.dust.state?.walletBalance?.(new Date()) ?? 1n; } catch { return 1n; } } })();
  console.log("Synced! dust coins:", state.dust.availableCoins?.length ?? 0, "bal:", dustBal.toString());

  if (false) {
    console.error("No tDUST — cannot deploy. Wait for tank to fill.");
    process.exit(1);
  }

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

  const zkConfig  = new NodeZkConfigProvider(ZK_PATH);
  const providers = {
    privateStateProvider: levelPrivateStateProvider({ privateStateStoreName: "night-fun-state", walletProvider, privateStoragePasswordProvider: () => "night-fun-secret-password-2026", accountId: "night-fun-deployer" }),
    publicDataProvider:   indexerPublicDataProvider(INDEXER, INDEXERWS),
    zkConfigProvider:     zkConfig,
    proofProvider:        httpClientProofProvider(PROOF, zkConfig),
    walletProvider,
    midnightProvider:     walletProvider,
  };

  const creatorSk  = new Uint8Array(Buffer.from(seed, "hex").slice(0, 32));
  const treasurySk = new Uint8Array(Buffer.from(dep.treasuryKey ?? seed, "hex").slice(0, 32));
  const witnesses  = {
    creatorSecretKey:  () => creatorSk,
    treasurySecretKey: () => treasurySk,
  };

  // Register for dust if needed
  const freshState = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter(s => s.isSynced)));
  const nightCoins = freshState.unshielded?.availableCoins ?? [];
  if (nightCoins.length > 0 && (freshState.dust?.availableCoins?.length ?? 0) === 0) {
    console.log("Registering for DUST generation...");
    try {
      const recipe = await wallet.registerNightUtxosForDustGeneration(
        nightCoins,
        keystore.getPublicKey(),
        (payload) => keystore.signData(payload)
      );
      const finalized = await wallet.finalizeRecipe(recipe);
      await wallet.submitTransaction(finalized);
      console.log("Registered! Waiting 30s for dust...");
      await new Promise(r => setTimeout(r, 30000));
    } catch(e) { console.log("Registration note:", e.message); }
  }
  console.log("Deploying contract (generating ZK proof ~30s)...");
  const compiledContract = CompiledContract.make("bonding_curve", Contract).pipe(
    CompiledContract.withCompiledFileAssets(ZK_PATH),
  );
  const deployed = await deployContract(providers, {
    compiledContract: CompiledContract.withWitnesses(compiledContract, witnesses),
    privateStateId:      "bondingCurve",
    initialPrivateState: {},
    args: [creatorSk, treasurySk],
  });

  const addr = deployed.deployTxData.public.contractAddress;
  console.log("✅ Deployed at:", addr);
  console.log("Tx:", deployed.deployTxData.public.txId);

  dep.contractAddress = addr;
  dep.txId = deployed.deployTxData.public.txId;
  fs.writeFileSync("deployment.json", JSON.stringify(dep, null, 2));
  console.log("Saved to deployment.json");

  await wallet.stop();
  process.exit(0);
}

main().catch(err => {
  console.error("Failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
