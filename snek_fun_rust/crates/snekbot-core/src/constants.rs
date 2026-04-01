/// The snek.fun smart-contract (batcher) address.
pub const SNEKFUN_SC_ADDRESS: &str =
    "addr1xxg94wrfjcdsjncmsxtj0r87zk69e0jfl28n934sznu95tdj764lvrxdayh2ux30fl0ktuh27csgmpevdu89jlxppvrs2993lw";

/// Fee-collection address used by snek.fun.
pub const SNEKFUN_FEE_ADDRESS: &str =
    "addr1qy32agk6zhjffcqhvu296j9a594k6smlr3zfsgaqgsvnmtefn2pw7433r2ss4hcycqrj6jrsaw056hlnz5fjgdyyrd6qsw8ngt";

/// Primary buy address for snek.fun swaps.
pub const SNEKFUN_BUY_ADDRESS: &str =
    "addr1z8v3gwkxx3emz73pt5dhfpxlk6kxkjsqqkltpcn2djsze9sstwukp5yemtdst0xtdnp7q6m0c5gr80k4gyzqkjz2qj5qxufmzz";

/// Mint contract address.
pub const SNEKFUN_MINT_CA: &str =
    "addr1q8lsjfvtpnu9kv5zhwgsdcw03tlkuwcvjqmzm35arx9xl6k6s0uhca7762y56q2j9en5ttn69p7a048cw3mz62fuj3mqauv0x3";

/// Generic buy address (alternative).
pub const SNEKFUN_BUY_ADDRESS_GENERIC: &str =
    "addr1z9ryamhgnuz6lau86sqytte2gz5rlktv2yce05e0h3207q4my4983c3qlt894kkm4mx99llwh8vgayylg36h050h35dqpa8y7e";

/// Vault address for snek.fun.
pub const VAULT_ADDRESS: &str =
    "addr1q94qd7j9r7l5kn40gw2h65c600yll8ztvlpgnmzalmx550qkleu07w9r6dc9a8vwacj33kk69uys53mrmjxzfz85mmpq5jw2wg";

/// snek.fun batcher address (same as SC address).
pub const SNEKFUN_BATCHER_ADDRESS: &str = SNEKFUN_SC_ADDRESS;

/// snek.fun contract address (same as mint CA).
pub const SNEKFUN_CONTRACT_ADDRESS: &str = SNEKFUN_MINT_CA;

/// The allowed batcher payment credential hash.
pub const ALLOWED_BATCHER: &str = "edbf33f5d6e083970648e39175c49ec1c093df76b6e6a0f1473e4776";

/// Default pool hash for snek.fun liquidity pools.
pub const DEFAULT_POOL_HASH: &str = "e865941988edcca559268b57b7ee939974fd42fd26c7e1acd7a50678";

/// snek.fun starting price in ADA per token.
pub const SNEKFUN_STARTING_PRICE: f64 = 0.00000254518;

/// Total token supply (1 billion, 6 decimals = 10^15 lovelace-units).
pub const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000;

/// Total supply as f64 for price calculations.
pub const TOTAL_SUPPLY_F64: f64 = 1_000_000_000_000_000.0;

// ── Fee constants (in lovelace) ──

/// Fee charged on buy swaps (non-batcher fee).
pub const OTHER_FEE: u64 = 500_000;

/// Fee charged on sell swaps.
pub const OTHER_FEE_SELL: u64 = 500_000;

/// Batcher fee per swap.
pub const BATCHER_FEE: u64 = 600_000;

/// Deposit fee (min UTXO).
pub const DEPOSIT_FEE: u64 = 2_100_000;

/// Lovelace to send with token UTxOs.
pub const LOVELACE_TO_SEND: u64 = 1_500_000;

// ── Default trading parameters ──

/// Base ADA amount for buys (in ADA, not lovelace).
pub const DEFAULT_BASE_AMOUNT: u64 = 80;

/// Default buy slippage in basis points (50 = 0.5%).
pub const DEFAULT_BUY_SLIPPAGE: u64 = 50;

/// Default sell slippage in basis points.
pub const DEFAULT_SELL_SLIPPAGE: u64 = 75;

/// Maximum number of wallets allowed to buy the same token.
pub const DEFAULT_MAX_WALLET_BUY: usize = 20;

/// Maximum market cap (in ADA) to consider buying.
pub const DEFAULT_MAX_BUY_MCAP: u64 = 10_000;

/// Handle modifier for buy amount scaling.
pub const DEFAULT_HANDLE_MODIFIER: u64 = 3;

/// Dev token percentage threshold for rug detection.
pub const DEFAULT_DEV_TOKEN_PERCENTAGE_THRESHOLD: u64 = 20;

/// Minimum dev transactions before considering a token safe.
pub const DEFAULT_DEV_MIN_TRANSACTIONS: u64 = 0;

// ── Auto-sell defaults ──

/// Default auto-sell check interval in milliseconds.
pub const DEFAULT_AUTO_SELL_INTERVAL_MS: u64 = 300_000;

/// Dead token threshold in ADA market cap.
pub const DEFAULT_DEAD_TOKEN_THRESHOLD: u64 = 10_000;

/// Profit-taking threshold in ADA market cap.
pub const DEFAULT_PROFIT_TAKING_THRESHOLD: u64 = 34_034;

/// Profit-taking sell percentage (0.0 – 1.0).
pub const DEFAULT_PROFIT_TAKING_PERCENTAGE: f64 = 0.1;

/// Token cleanup interval in milliseconds.
pub const DEFAULT_TOKEN_CLEANUP_INTERVAL_MS: u64 = 300_000;

// ── Auth ──

/// Splash trade auth URL.
pub const AUTH_URL: &str = "https://validate.splash.trade/auth/";
