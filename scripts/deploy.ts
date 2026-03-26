import readline from "readline/promises";
import fs from "fs/promises";
import crypto from "crypto";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log("\n╔══════════════════════════════════════╗");
console.log("║   night.fun — Deploy (Preprod)       ║");
console.log("╚══════════════════════════════════════╝\n");

const seed = crypto.randomBytes(32).toString("hex");
console.log("Wallet seed (SAVE THIS):");
console.log(seed + "\n");
console.log("Next steps:");
console.log("1. Open Lace → add Midnight wallet → copy mn_addr_preprod1... address");
console.log("2. Paste that address at https://faucet.preprod.midnight.network/");
console.log("3. Wait 2 min for tNIGHT to arrive");
console.log("4. The buy/sell flow deploys contracts via browser wallet\n");

await fs.writeFile("deployment.json", JSON.stringify({ seed, network: "preprod", createdAt: Date.now() }, null, 2));
console.log("Saved to deployment.json");
rl.close();
