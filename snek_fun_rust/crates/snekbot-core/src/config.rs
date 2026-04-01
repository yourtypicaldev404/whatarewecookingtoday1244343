use serde::Deserialize;
use std::path::Path;
use tracing::info;

use crate::constants;

// ── Nested sub-structs ──

/// Configuration for the local Cardano node (Ogmios/Kupo) connection.
#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct LocalNodeConfig {
    pub web_socket_urls: Vec<String>,
}

impl Default for LocalNodeConfig {
    fn default() -> Self {
        Self {
            web_socket_urls: vec!["ws://localhost:8787".to_string()],
        }
    }
}

/// A single Kupmios endpoint pair (Kupo HTTP + Ogmios WebSocket).
#[derive(Debug, Clone, Deserialize)]
pub struct KupmiosEndpoint {
    pub http_url: String,
    pub ws_url: String,
}

impl Default for KupmiosEndpoint {
    fn default() -> Self {
        Self {
            http_url: "http://localhost:1442".to_string(),
            ws_url: "ws://localhost:8787".to_string(),
        }
    }
}

/// Telegram bot and chat configuration.
#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct TelegramConfig {
    pub token: String,
    pub chat_id: String,
    pub listings_token: String,
    pub listings_chat_id: String,
}

impl Default for TelegramConfig {
    fn default() -> Self {
        Self {
            token: "6021519022:AAEs6UeuVq4wr6b8Y3e_9BfVej6bsDc3QxY".to_string(),
            chat_id: "693088548".to_string(),
            listings_token: "7655902454:AAE1TCs1pMtLnOYHONy76I2t-Icl0EZrDHo".to_string(),
            listings_chat_id: "@SnekFunListings".to_string(),
        }
    }
}

/// Core trading parameters.
#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct TradingConfig {
    /// Base buy amount in ADA.
    pub base_amount: u64,
    /// Multiplier applied per handle.
    pub handle_modifier: u64,
    /// Buy slippage in basis points.
    pub buy_slippage: u64,
    /// Sell slippage in basis points.
    pub sell_slippage: u64,
    /// Maximum number of wallets that may buy the same token.
    pub max_wallet_buy: usize,
    /// Maximum market cap (ADA) to consider buying.
    pub max_buy_mcap: u64,
    /// Percentage threshold for dev token holdings (rug check).
    pub dev_token_percentage_threshold: u64,
    /// Minimum number of dev transactions before buying.
    pub dev_min_transactions: u64,
    /// Whether rug-check is enabled.
    pub rug_check_enabled: bool,
    /// Whether anti-rug check is enabled.
    pub antirug_check_enabled: bool,
}

impl Default for TradingConfig {
    fn default() -> Self {
        Self {
            base_amount: constants::DEFAULT_BASE_AMOUNT,
            handle_modifier: constants::DEFAULT_HANDLE_MODIFIER,
            buy_slippage: constants::DEFAULT_BUY_SLIPPAGE,
            sell_slippage: constants::DEFAULT_SELL_SLIPPAGE,
            max_wallet_buy: constants::DEFAULT_MAX_WALLET_BUY,
            max_buy_mcap: constants::DEFAULT_MAX_BUY_MCAP,
            dev_token_percentage_threshold: constants::DEFAULT_DEV_TOKEN_PERCENTAGE_THRESHOLD,
            dev_min_transactions: constants::DEFAULT_DEV_MIN_TRANSACTIONS,
            rug_check_enabled: true,
            antirug_check_enabled: false,
        }
    }
}

/// Farming mode configuration.
#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct FarmingConfig {
    pub enabled: bool,
    pub wallet_index: usize,
    /// Buy amount in ADA.
    pub buy_amount_ada: u64,
    /// Delay between buy and sell in milliseconds.
    pub sell_delay_ms: u64,
}

impl Default for FarmingConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            wallet_index: 0,
            buy_amount_ada: 50,
            sell_delay_ms: 15_000,
        }
    }
}

/// Fee amounts in lovelace.
#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct FeesConfig {
    pub other_fee: u64,
    pub other_fee_sell: u64,
    pub batcher_fee: u64,
    pub deposit_fee: u64,
}

impl Default for FeesConfig {
    fn default() -> Self {
        Self {
            other_fee: constants::OTHER_FEE,
            other_fee_sell: constants::OTHER_FEE_SELL,
            batcher_fee: constants::BATCHER_FEE,
            deposit_fee: constants::DEPOSIT_FEE,
        }
    }
}

/// Auto-sell configuration.
#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct AutoSellConfig {
    pub enabled: bool,
    /// Check interval in milliseconds.
    pub interval_ms: u64,
    /// Market cap below which a token is considered dead (ADA).
    pub dead_token_threshold: u64,
    /// Market cap at which to take profit (ADA).
    pub profit_taking_threshold: u64,
    /// Fraction of holdings to sell when taking profit (0.0 – 1.0).
    pub profit_taking_percentage: f64,
    /// How often to run cleanup on stale token data (ms).
    pub token_cleanup_interval_ms: u64,
}

impl Default for AutoSellConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            interval_ms: constants::DEFAULT_AUTO_SELL_INTERVAL_MS,
            dead_token_threshold: constants::DEFAULT_DEAD_TOKEN_THRESHOLD,
            profit_taking_threshold: constants::DEFAULT_PROFIT_TAKING_THRESHOLD,
            profit_taking_percentage: constants::DEFAULT_PROFIT_TAKING_PERCENTAGE,
            token_cleanup_interval_ms: constants::DEFAULT_TOKEN_CLEANUP_INTERVAL_MS,
        }
    }
}

/// Per-event Telegram notification toggles.
#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct NotificationToggles {
    pub new_token: bool,
    pub dev_selling: bool,
    pub buy_skipped: bool,
    pub buy_success: bool,
    pub buy_failed: bool,
    pub rug_sell_attempting: bool,
    pub rug_sell_executed: bool,
    pub rug_sell_failed: bool,
    pub auto_sell_executed: bool,
}

impl Default for NotificationToggles {
    fn default() -> Self {
        Self {
            new_token: true,
            dev_selling: false,
            buy_skipped: false,
            buy_success: true,
            buy_failed: true,
            rug_sell_attempting: false,
            rug_sell_executed: true,
            rug_sell_failed: true,
            auto_sell_executed: true,
        }
    }
}

/// Wallet entry in the TOML config.
#[derive(Debug, Clone, Deserialize)]
pub struct WalletEntry {
    pub seed: String,
}

/// Top-level application configuration.
#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct Config {
    // ── Addresses ──
    pub snekfun_sc_address: String,
    pub snekfun_fee_address: String,
    pub snekfun_buy_address: String,
    pub snekfun_mint_ca: String,
    pub snekfun_buy_address_generic: String,
    pub vault_address: String,
    pub snekfun_batcher_address: String,
    pub snekfun_contract_address: String,

    // ── External API keys ──
    pub blockfrost_key: String,
    pub cardanoscan_api_key: String,

    // ── Batcher ──
    pub allowed_batcher: String,
    pub lovelace_to_send: u64,

    // ── Auth ──
    pub auth_url: String,

    // ── Pricing ──
    pub snekfun_starting_price: f64,

    // ── Nested sections ──
    pub local_node: LocalNodeConfig,
    pub kupmios_endpoints: Vec<KupmiosEndpoint>,
    pub telegram: TelegramConfig,
    pub trading: TradingConfig,
    pub farming: FarmingConfig,
    pub fees: FeesConfig,
    pub auto_sell: AutoSellConfig,
    pub notifications: NotificationToggles,

    // ── Wallets ──
    pub wallets: Vec<WalletEntry>,

    // ── Addresses list (loaded at runtime) ──
    #[serde(default)]
    pub addresses: Vec<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            snekfun_sc_address: constants::SNEKFUN_SC_ADDRESS.to_string(),
            snekfun_fee_address: constants::SNEKFUN_FEE_ADDRESS.to_string(),
            snekfun_buy_address: constants::SNEKFUN_BUY_ADDRESS.to_string(),
            snekfun_mint_ca: constants::SNEKFUN_MINT_CA.to_string(),
            snekfun_buy_address_generic: constants::SNEKFUN_BUY_ADDRESS_GENERIC.to_string(),
            vault_address: constants::VAULT_ADDRESS.to_string(),
            snekfun_batcher_address: constants::SNEKFUN_BATCHER_ADDRESS.to_string(),
            snekfun_contract_address: constants::SNEKFUN_CONTRACT_ADDRESS.to_string(),

            blockfrost_key: "mainnetUxZ1oGgRnSRbrsR0DUuyNY2hCL5tGqBy".to_string(),
            cardanoscan_api_key: "0d675fba-6946-43fe-acfe-b115641a2dd0".to_string(),

            allowed_batcher: constants::ALLOWED_BATCHER.to_string(),
            lovelace_to_send: constants::LOVELACE_TO_SEND,

            auth_url: constants::AUTH_URL.to_string(),

            snekfun_starting_price: constants::SNEKFUN_STARTING_PRICE,

            local_node: LocalNodeConfig::default(),
            kupmios_endpoints: vec![
                KupmiosEndpoint {
                    http_url: "http://localhost:1442".to_string(),
                    ws_url: "ws://localhost:8787".to_string(),
                },
                KupmiosEndpoint {
                    http_url: "https://kupo1m4ss6m3t0umuvdafuae.cardano-mainnet-v2.kupo-m1.dmtr.host"
                        .to_string(),
                    ws_url:
                        "wss://ogmios150ryvxs3662m6g3sms5.cardano-mainnet-v6.ogmios-m1.dmtr.host"
                            .to_string(),
                },
            ],
            telegram: TelegramConfig::default(),
            trading: TradingConfig::default(),
            farming: FarmingConfig::default(),
            fees: FeesConfig::default(),
            auto_sell: AutoSellConfig::default(),
            notifications: NotificationToggles::default(),

            wallets: Vec::new(),
            addresses: Vec::new(),
        }
    }
}

/// Errors that can occur when loading configuration.
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("failed to read config file: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to parse TOML: {0}")]
    Parse(#[from] toml::de::Error),
}

impl Config {
    /// Load configuration from `config.toml` in the current working directory.
    ///
    /// If the file does not exist, returns the default configuration.
    /// Environment variable overrides are applied after file loading:
    ///   - `TELEGRAM_TOKEN`   -> telegram.token
    ///   - `TELEGRAM_CHAT_ID` -> telegram.chat_id
    ///   - `BLOCKFROST_KEY`   -> blockfrost_key
    ///   - `CARDANOSCAN_KEY`  -> cardanoscan_api_key
    ///   - `WALLET_SEEDS`     -> comma-separated list of mnemonic seeds
    pub fn load() -> Result<Self, ConfigError> {
        Self::load_from("config.toml")
    }

    /// Load from a specific path.
    pub fn load_from<P: AsRef<Path>>(path: P) -> Result<Self, ConfigError> {
        let path = path.as_ref();
        let mut config: Config = if path.exists() {
            let contents = std::fs::read_to_string(path)?;
            info!("loaded config from {}", path.display());
            toml::from_str(&contents)?
        } else {
            info!(
                "config file {} not found, using defaults",
                path.display()
            );
            Config::default()
        };

        // Apply environment variable overrides for sensitive values.
        Self::apply_env_overrides(&mut config);

        Ok(config)
    }

    fn apply_env_overrides(config: &mut Config) {
        if let Ok(val) = std::env::var("TELEGRAM_TOKEN") {
            config.telegram.token = val;
        }
        if let Ok(val) = std::env::var("TELEGRAM_CHAT_ID") {
            config.telegram.chat_id = val;
        }
        if let Ok(val) = std::env::var("LISTINGS_TELEGRAM_TOKEN") {
            config.telegram.listings_token = val;
        }
        if let Ok(val) = std::env::var("LISTINGS_TELEGRAM_CHAT_ID") {
            config.telegram.listings_chat_id = val;
        }
        if let Ok(val) = std::env::var("BLOCKFROST_KEY") {
            config.blockfrost_key = val;
        }
        if let Ok(val) = std::env::var("CARDANOSCAN_KEY") {
            config.cardanoscan_api_key = val;
        }
        if let Ok(val) = std::env::var("WALLET_SEEDS") {
            config.wallets = val
                .split(',')
                .map(|s| WalletEntry {
                    seed: s.trim().to_string(),
                })
                .collect();
        }
    }
}
