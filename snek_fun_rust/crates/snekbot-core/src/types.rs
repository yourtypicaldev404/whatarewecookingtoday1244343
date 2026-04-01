use serde::{Deserialize, Serialize};

/// Information about a tracked token.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub policy_id: String,
    pub asset_name_hex: String,
    pub asset_id: String,
    /// Unix timestamp (seconds) when the token was added.
    pub added_at: i64,
}

/// Represents a loaded wallet with its seed phrase and derived address.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletState {
    pub index: usize,
    pub address: String,
    /// The mnemonic seed phrase (sensitive).
    pub seed: String,
}

/// Direction of a swap operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SwapDirection {
    Buy,
    Sell,
}

impl std::fmt::Display for SwapDirection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SwapDirection::Buy => write!(f, "buy"),
            SwapDirection::Sell => write!(f, "sell"),
        }
    }
}

/// Timing metrics captured during a single swap lifecycle.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TimingMetrics {
    /// When the token was first detected (unix ms).
    pub detected_at_ms: u64,
    /// Time spent fetching UTxOs.
    pub utxo_fetch_ms: u64,
    /// Time spent building the CBOR transaction.
    pub cbor_build_ms: u64,
    /// Time spent signing the transaction.
    pub sign_ms: u64,
    /// Time spent submitting the transaction.
    pub submit_ms: u64,
    /// Total end-to-end latency from detection to submission.
    pub total_ms: u64,
    /// Time spent on dev-wallet checks.
    pub dev_check_ms: u64,
    /// Time spent querying the token price / market cap.
    pub price_check_ms: u64,
    /// Time waiting for wallet lock acquisition.
    pub wallet_acquire_ms: u64,
    /// Time spent on rug-check analysis.
    pub rug_check_ms: u64,
    /// Time spent fetching auth token.
    pub auth_ms: u64,
}

/// Timing captured during a processing pipeline stage.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProcessingTiming {
    /// Overall processing duration in ms.
    pub processing_ms: u64,
    /// Time spent parsing the incoming message.
    pub parse_ms: u64,
    /// Time spent filtering / validating the token.
    pub filter_ms: u64,
    /// Time spent executing the swap (includes CBOR build + submit).
    pub swap_ms: u64,
    /// Time spent sending notifications.
    pub notify_ms: u64,
}

/// All the contextual information needed to execute a swap.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapContext {
    pub direction: SwapDirection,
    pub policy_id: String,
    pub asset_name_hex: String,
    /// Amount in lovelace (buy) or token units (sell).
    pub amount: u64,
    /// Slippage in basis points (e.g. 50 = 0.5%).
    pub slippage_bps: u64,
    /// Which wallet index to use for this swap.
    pub wallet_index: usize,
    /// The wallet's bech32 address.
    pub wallet_address: String,
    /// Payment credential hash (hex).
    pub payment_cred_hash: String,
    /// Stake credential hash (hex).
    pub stake_cred_hash: String,
    /// Optional market cap at time of swap (ADA).
    pub market_cap_ada: Option<f64>,
    /// Optional current price.
    pub current_price: Option<f64>,
}

/// Result returned after attempting a swap.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapResult {
    pub success: bool,
    pub wallet_index: usize,
    pub tx_hash: Option<String>,
    pub error: Option<String>,
}

/// Result of building a CBOR transaction via an external service.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CborResult {
    /// The hex-encoded CBOR transaction body.
    pub cbor: String,
    /// How long the CBOR build took in milliseconds.
    pub elapsed_ms: u64,
    /// Which service produced this CBOR (e.g. "local", "api", "fallback").
    pub service: String,
}
