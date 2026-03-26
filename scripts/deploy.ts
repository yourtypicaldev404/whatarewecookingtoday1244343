import readline from "readline/promises";
import fs from "fs/promises";
import crypto from "crypto";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

/** Keep in sync with src/lib/network.ts defaults (or load .env.local before running). */
const NETWORK = process.env.NEXT_PUBLIC_NETWORK_ID ?? "preview";
const FAUCET =
  NETWORK === "preprod"
    ? "https://faucet.preprod.midnight.network/"
    : NETWORK === "mainnet"
      ? "(no public faucet — use real funds)"
      : "https://faucet.preview.midnight.network/";

console.log("\n╔══════════════════════════════════════╗");
console.log("║   night.fun — headless deploy        ║");
console.log("╚══════════════════════════════════════╝");
console.log(`Network (NEXT_PUBLIC_NETWORK_ID): ${NETWORK}\n`);

const seed = crypto.randomBytes(32).toString("hex");
console.log("Wallet seed (SAVE THIS):");
console.log(seed + "\n");
console.log("Next steps:");
console.log("1. Open Lace → add Midnight wallet → copy your unshielded address for this network");
console.log(`2. If on a testnet, use the faucet: ${FAUCET}`);
console.log("3. Wait for funds to arrive");
console.log("4. The buy/sell flow deploys contracts via browser wallet\n");

await fs.writeFile("deployment.json", JSON.stringify({ seed, network: NETWORK, createdAt: Date.now() }, null, 2));
console.log("Saved to deployment.json");
rl.close();
