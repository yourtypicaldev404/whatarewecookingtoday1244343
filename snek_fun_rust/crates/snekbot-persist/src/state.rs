use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use snekbot_core::TokenInfo;
use tokio::sync::Notify;
use tracing::{debug, error, info, warn};

/// Maximum number of recent transaction IDs to keep in memory.
const MAX_PROCESSED_TXS: usize = 100;

/// Default flush interval in seconds.
const FLUSH_INTERVAL_SECS: u64 = 5;

// ── Helpers ──

fn data_dir() -> PathBuf {
    PathBuf::from("data")
}

fn ensure_data_dir() {
    let dir = data_dir();
    if !dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&dir) {
            error!("failed to create data directory: {e}");
        }
    }
}

fn load_json_file<T: serde::de::DeserializeOwned>(path: &Path) -> Option<T> {
    match std::fs::read_to_string(path) {
        Ok(contents) => match serde_json::from_str(&contents) {
            Ok(val) => Some(val),
            Err(e) => {
                warn!("failed to parse {}: {e}", path.display());
                None
            }
        },
        Err(_) => None,
    }
}

fn write_json_file<T: Serialize>(path: &Path, value: &T) {
    match serde_json::to_string_pretty(value) {
        Ok(json) => {
            if let Err(e) = std::fs::write(path, json) {
                error!("failed to write {}: {e}", path.display());
            }
        }
        Err(e) => {
            error!("failed to serialize data for {}: {e}", path.display());
        }
    }
}

// ── ProcessedTxStore ──

/// Tracks recently-processed transaction IDs to avoid double-processing.
/// Keeps at most `MAX_PROCESSED_TXS` entries using a ring-buffer approach.
#[derive(Debug)]
pub struct ProcessedTxStore {
    set: DashMap<String, ()>,
    /// Ordered queue so we can evict oldest entries.
    order: tokio::sync::Mutex<VecDeque<String>>,
    path: PathBuf,
}

/// Serialization wrapper for the processed-tx store.
#[derive(Serialize, Deserialize, Default)]
struct ProcessedTxData {
    tx_ids: Vec<String>,
}

impl ProcessedTxStore {
    pub fn new() -> Self {
        Self {
            set: DashMap::new(),
            order: tokio::sync::Mutex::new(VecDeque::with_capacity(MAX_PROCESSED_TXS + 1)),
            path: data_dir().join("processedTransactions.json"),
        }
    }

    /// Load from disk.
    pub async fn load(&self) {
        if let Some(data) = load_json_file::<ProcessedTxData>(&self.path) {
            let mut order = self.order.lock().await;
            for tx_id in data.tx_ids {
                self.set.insert(tx_id.clone(), ());
                order.push_back(tx_id);
            }
            // Keep only the most recent entries.
            while order.len() > MAX_PROCESSED_TXS {
                if let Some(old) = order.pop_front() {
                    self.set.remove(&old);
                }
            }
            info!("loaded {} processed tx IDs", order.len());
        }
    }

    /// Mark a transaction as processed. Returns `true` if this is a new (unseen) tx.
    pub async fn mark_processed(&self, tx_id: &str) -> bool {
        if self.set.contains_key(tx_id) {
            return false;
        }
        self.set.insert(tx_id.to_string(), ());
        let mut order = self.order.lock().await;
        order.push_back(tx_id.to_string());
        // Evict the oldest if we exceed capacity.
        while order.len() > MAX_PROCESSED_TXS {
            if let Some(old) = order.pop_front() {
                self.set.remove(&old);
            }
        }
        true
    }

    /// Check if a transaction has already been processed.
    pub fn is_processed(&self, tx_id: &str) -> bool {
        self.set.contains_key(tx_id)
    }

    /// Flush current state to disk.
    pub async fn flush(&self) {
        let order = self.order.lock().await;
        let data = ProcessedTxData {
            tx_ids: order.iter().cloned().collect(),
        };
        write_json_file(&self.path, &data);
    }
}

// ── ProcessedTokenStore ──

/// Tracks tokens that have been processed (bought / evaluated).
#[derive(Debug)]
pub struct ProcessedTokenStore {
    map: DashMap<String, TokenInfo>,
    path: PathBuf,
}

impl ProcessedTokenStore {
    pub fn new() -> Self {
        Self {
            map: DashMap::new(),
            path: data_dir().join("processedTokens.json"),
        }
    }

    pub fn load(&self) {
        if let Some(entries) = load_json_file::<Vec<TokenInfo>>(&self.path) {
            let count = entries.len();
            for info in entries {
                self.map.insert(info.asset_id.clone(), info);
            }
            info!("loaded {count} processed tokens");
        }
    }

    pub fn insert(&self, info: TokenInfo) {
        self.map.insert(info.asset_id.clone(), info);
    }

    pub fn contains(&self, asset_id: &str) -> bool {
        self.map.contains_key(asset_id)
    }

    pub fn get(&self, asset_id: &str) -> Option<TokenInfo> {
        self.map.get(asset_id).map(|r| r.value().clone())
    }

    pub fn remove(&self, asset_id: &str) -> Option<TokenInfo> {
        self.map.remove(asset_id).map(|(_, v)| v)
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }

    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }

    pub fn flush(&self) {
        let entries: Vec<TokenInfo> = self.map.iter().map(|r| r.value().clone()).collect();
        write_json_file(&self.path, &entries);
    }
}

// ── DevAddressTracker ──

/// Maps dev addresses to the list of tokens they are associated with.
#[derive(Debug)]
pub struct DevAddressTracker {
    map: DashMap<String, Vec<TokenInfo>>,
    path: PathBuf,
}

impl DevAddressTracker {
    pub fn new() -> Self {
        Self {
            map: DashMap::new(),
            path: data_dir().join("devAddresses.json"),
        }
    }

    pub fn load(&self) {
        if let Some(entries) =
            load_json_file::<std::collections::HashMap<String, Vec<TokenInfo>>>(&self.path)
        {
            let count = entries.len();
            for (addr, tokens) in entries {
                self.map.insert(addr, tokens);
            }
            info!("loaded {count} dev address entries");
        }
    }

    /// Add a token to the given dev address's list.
    pub fn track(&self, dev_address: &str, token: TokenInfo) {
        self.map
            .entry(dev_address.to_string())
            .or_default()
            .push(token);
    }

    /// Get all tokens for a given dev address.
    pub fn get_tokens(&self, dev_address: &str) -> Option<Vec<TokenInfo>> {
        self.map.get(dev_address).map(|r| r.value().clone())
    }

    /// Check if an address is a known dev address.
    pub fn is_known_dev(&self, dev_address: &str) -> bool {
        self.map.contains_key(dev_address)
    }

    pub fn flush(&self) {
        let entries: std::collections::HashMap<String, Vec<TokenInfo>> = self
            .map
            .iter()
            .map(|r| (r.key().clone(), r.value().clone()))
            .collect();
        write_json_file(&self.path, &entries);
    }
}

// ── DevAllocationTracker ──

/// Tracks dev allocation percentages by policy ID.
#[derive(Debug)]
pub struct DevAllocationTracker {
    map: DashMap<String, u64>,
    path: PathBuf,
}

impl DevAllocationTracker {
    pub fn new() -> Self {
        Self {
            map: DashMap::new(),
            path: data_dir().join("devAllocations.json"),
        }
    }

    pub fn load(&self) {
        if let Some(entries) =
            load_json_file::<std::collections::HashMap<String, u64>>(&self.path)
        {
            let count = entries.len();
            for (pid, alloc) in entries {
                self.map.insert(pid, alloc);
            }
            info!("loaded {count} dev allocation entries");
        }
    }

    pub fn set(&self, policy_id: &str, allocation: u64) {
        self.map.insert(policy_id.to_string(), allocation);
    }

    pub fn get(&self, policy_id: &str) -> Option<u64> {
        self.map.get(policy_id).map(|r| *r.value())
    }

    pub fn flush(&self) {
        let entries: std::collections::HashMap<String, u64> = self
            .map
            .iter()
            .map(|r| (r.key().clone(), *r.value()))
            .collect();
        write_json_file(&self.path, &entries);
    }
}

// ── ReceivedTokenStore ──

/// Tracks tokens that have been received (bought) along with their buy price.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceivedTokenEntry {
    pub token: TokenInfo,
    /// Buy price in lovelace per token unit.
    pub buy_price_lovelace: u64,
    /// Amount of tokens received.
    pub amount: u64,
    /// Which wallet bought this token.
    pub wallet_index: usize,
    /// Unix timestamp of the buy.
    pub bought_at: i64,
}

#[derive(Debug)]
pub struct ReceivedTokenStore {
    map: DashMap<String, ReceivedTokenEntry>,
    path: PathBuf,
}

impl ReceivedTokenStore {
    pub fn new() -> Self {
        Self {
            map: DashMap::new(),
            path: data_dir().join("receivedTokens.json"),
        }
    }

    pub fn load(&self) {
        if let Some(entries) = load_json_file::<Vec<ReceivedTokenEntry>>(&self.path) {
            let count = entries.len();
            for entry in entries {
                self.map.insert(entry.token.asset_id.clone(), entry);
            }
            info!("loaded {count} received token entries");
        }
    }

    pub fn insert(&self, entry: ReceivedTokenEntry) {
        self.map.insert(entry.token.asset_id.clone(), entry);
    }

    pub fn get(&self, asset_id: &str) -> Option<ReceivedTokenEntry> {
        self.map.get(asset_id).map(|r| r.value().clone())
    }

    pub fn remove(&self, asset_id: &str) -> Option<ReceivedTokenEntry> {
        self.map.remove(asset_id).map(|(_, v)| v)
    }

    pub fn all(&self) -> Vec<ReceivedTokenEntry> {
        self.map.iter().map(|r| r.value().clone()).collect()
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }

    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }

    pub fn flush(&self) {
        let entries: Vec<ReceivedTokenEntry> =
            self.map.iter().map(|r| r.value().clone()).collect();
        write_json_file(&self.path, &entries);
    }
}

// ── StateManager ──

/// Holds all in-memory stores and manages periodic flushing to disk.
#[derive(Clone)]
pub struct StateManager {
    inner: Arc<StateManagerInner>,
}

struct StateManagerInner {
    pub processed_txs: ProcessedTxStore,
    pub processed_tokens: ProcessedTokenStore,
    pub dev_addresses: DevAddressTracker,
    pub dev_allocations: DevAllocationTracker,
    pub received_tokens: ReceivedTokenStore,
    shutdown: Notify,
}

impl StateManager {
    /// Create a new StateManager and load all persisted data from disk.
    pub async fn new() -> anyhow::Result<Self> {
        ensure_data_dir();

        let inner = Arc::new(StateManagerInner {
            processed_txs: ProcessedTxStore::new(),
            processed_tokens: ProcessedTokenStore::new(),
            dev_addresses: DevAddressTracker::new(),
            dev_allocations: DevAllocationTracker::new(),
            received_tokens: ReceivedTokenStore::new(),
            shutdown: Notify::new(),
        });

        // Load all stores.
        inner.processed_txs.load().await;
        inner.processed_tokens.load();
        inner.dev_addresses.load();
        inner.dev_allocations.load();
        inner.received_tokens.load();

        Ok(Self { inner })
    }

    // ── Accessors ──

    pub fn processed_txs(&self) -> &ProcessedTxStore {
        &self.inner.processed_txs
    }

    pub fn processed_tokens(&self) -> &ProcessedTokenStore {
        &self.inner.processed_tokens
    }

    pub fn dev_addresses(&self) -> &DevAddressTracker {
        &self.inner.dev_addresses
    }

    pub fn dev_allocations(&self) -> &DevAllocationTracker {
        &self.inner.dev_allocations
    }

    pub fn received_tokens(&self) -> &ReceivedTokenStore {
        &self.inner.received_tokens
    }

    /// Spawn a background task that flushes all stores to disk periodically.
    /// Returns a `JoinHandle` for the flush task.
    pub fn spawn_flush_task(&self) -> tokio::task::JoinHandle<()> {
        let inner = Arc::clone(&self.inner);
        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(std::time::Duration::from_secs(FLUSH_INTERVAL_SECS));
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        debug!("flushing state to disk");
                        inner.processed_txs.flush().await;
                        inner.processed_tokens.flush();
                        inner.dev_addresses.flush();
                        inner.dev_allocations.flush();
                        inner.received_tokens.flush();
                    }
                    _ = inner.shutdown.notified() => {
                        info!("flush task received shutdown signal, performing final flush");
                        inner.processed_txs.flush().await;
                        inner.processed_tokens.flush();
                        inner.dev_addresses.flush();
                        inner.dev_allocations.flush();
                        inner.received_tokens.flush();
                        break;
                    }
                }
            }
        })
    }

    /// Signal the background flush task to stop and perform a final flush.
    pub fn shutdown(&self) {
        self.inner.shutdown.notify_one();
    }
}
