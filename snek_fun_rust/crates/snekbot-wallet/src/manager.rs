//! Wallet management: loading seeds, deriving keys, atomic slot acquisition.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use rand::seq::SliceRandom;
use tracing::{debug, info, warn};

use crate::address;
use crate::bip39;

/// Errors from wallet operations.
#[derive(Debug, thiserror::Error)]
pub enum WalletError {
    #[error("no wallets configured")]
    NoWallets,
    #[error("wallet index {0} out of range (have {1} wallets)")]
    IndexOutOfRange(usize, usize),
    #[error("all wallets are currently in use")]
    AllWalletsInUse,
    #[error("key derivation failed: {0}")]
    KeyDerivation(#[from] bip39::Bip39Error),
    #[error("address error: {0}")]
    Address(#[from] address::AddressError),
}

/// A single wallet slot with its derived keys and lock state.
pub struct WalletSlot {
    /// The Ed25519 signing key (payment key, 32 bytes).
    pub payment_private_key: [u8; 32],
    /// The Ed25519 public key (payment key, 32 bytes).
    pub payment_public_key: [u8; 32],
    /// The stake signing key (32 bytes).
    pub stake_private_key: [u8; 32],
    /// The stake public key (32 bytes).
    pub stake_public_key: [u8; 32],
    /// The bech32-encoded Shelley base address.
    pub address: String,
    /// Blake2b-224 hash of the payment public key (hex).
    pub payment_cred_hash: String,
    /// Blake2b-224 hash of the stake public key (hex).
    pub stake_cred_hash: String,
    /// Whether this wallet is currently in use by a swap operation.
    pub in_use: AtomicBool,
}

impl std::fmt::Debug for WalletSlot {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WalletSlot")
            .field("address", &self.address)
            .field("payment_cred_hash", &self.payment_cred_hash)
            .field("in_use", &self.in_use.load(Ordering::Relaxed))
            .finish()
    }
}

/// Manages a pool of wallet slots derived from mnemonic seeds.
pub struct WalletManager {
    slots: Vec<Arc<WalletSlot>>,
}

impl WalletManager {
    /// Create a new WalletManager by deriving keys from the given mnemonic seeds.
    ///
    /// Each seed phrase produces one wallet slot with payment and stake keys.
    pub fn from_seeds(seeds: &[String]) -> Result<Self, WalletError> {
        if seeds.is_empty() {
            return Err(WalletError::NoWallets);
        }

        let mut slots = Vec::with_capacity(seeds.len());

        for (i, seed) in seeds.iter().enumerate() {
            let (pay_priv, pay_pub, stake_priv, stake_pub) =
                bip39::derive_keys_from_mnemonic(seed)?;

            let pay_hash = bip39::hash_public_key(&pay_pub);
            let stake_hash = bip39::hash_public_key(&stake_pub);

            let addr = address::build_base_address(&pay_hash, &stake_hash)?;

            let payment_cred_hash = hex::encode(pay_hash);
            let stake_cred_hash = hex::encode(stake_hash);

            info!(
                "wallet[{i}] derived address: {}...{}",
                &addr[..20],
                &addr[addr.len().saturating_sub(8)..]
            );

            slots.push(Arc::new(WalletSlot {
                payment_private_key: pay_priv,
                payment_public_key: pay_pub,
                stake_private_key: stake_priv,
                stake_public_key: stake_pub,
                address: addr,
                payment_cred_hash,
                stake_cred_hash,
                in_use: AtomicBool::new(false),
            }));
        }

        Ok(Self { slots })
    }

    /// Number of configured wallet slots.
    pub fn count(&self) -> usize {
        self.slots.len()
    }

    /// Try to acquire an available wallet slot, excluding the given indices.
    ///
    /// Selects randomly among available slots for fairness.
    /// Returns `None` if all eligible wallets are in use.
    pub fn try_acquire(&self, exclude_indices: &[usize]) -> Option<WalletGuard> {
        let mut candidates: Vec<usize> = (0..self.slots.len())
            .filter(|i| !exclude_indices.contains(i))
            .collect();

        // Shuffle for random selection.
        let mut rng = rand::thread_rng();
        candidates.shuffle(&mut rng);

        for idx in candidates {
            let slot = &self.slots[idx];
            // Attempt atomic compare-and-swap: false -> true.
            if slot
                .in_use
                .compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed)
                .is_ok()
            {
                debug!("acquired wallet slot {idx}");
                return Some(WalletGuard {
                    slot: Arc::clone(slot),
                    index: idx,
                });
            }
        }

        warn!("all eligible wallets are in use");
        None
    }

    /// Try to acquire a specific wallet by index.
    pub fn try_acquire_index(&self, index: usize) -> Result<Option<WalletGuard>, WalletError> {
        if index >= self.slots.len() {
            return Err(WalletError::IndexOutOfRange(index, self.slots.len()));
        }

        let slot = &self.slots[index];
        if slot
            .in_use
            .compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed)
            .is_ok()
        {
            Ok(Some(WalletGuard {
                slot: Arc::clone(slot),
                index,
            }))
        } else {
            Ok(None)
        }
    }

    /// Get the bech32 address for a wallet by index.
    pub fn get_address(&self, index: usize) -> Result<&str, WalletError> {
        self.slots
            .get(index)
            .map(|s| s.address.as_str())
            .ok_or(WalletError::IndexOutOfRange(index, self.slots.len()))
    }

    /// Get the credential hashes for a wallet by index.
    ///
    /// Returns `(payment_cred_hash, stake_cred_hash)` as hex strings.
    pub fn get_credentials(&self, index: usize) -> Result<(&str, &str), WalletError> {
        self.slots
            .get(index)
            .map(|s| (s.payment_cred_hash.as_str(), s.stake_cred_hash.as_str()))
            .ok_or(WalletError::IndexOutOfRange(index, self.slots.len()))
    }

    /// Get all wallet addresses.
    pub fn addresses(&self) -> Vec<&str> {
        self.slots.iter().map(|s| s.address.as_str()).collect()
    }
}

/// RAII guard that releases a wallet slot when dropped.
///
/// Provides access to the wallet's keys and address while held.
pub struct WalletGuard {
    slot: Arc<WalletSlot>,
    index: usize,
}

impl WalletGuard {
    /// The index of the acquired wallet slot.
    pub fn index(&self) -> usize {
        self.index
    }

    /// The bech32 address of this wallet.
    pub fn address(&self) -> &str {
        &self.slot.address
    }

    /// The payment credential hash (hex).
    pub fn payment_cred_hash(&self) -> &str {
        &self.slot.payment_cred_hash
    }

    /// The stake credential hash (hex).
    pub fn stake_cred_hash(&self) -> &str {
        &self.slot.stake_cred_hash
    }

    /// The 32-byte Ed25519 payment signing key.
    pub fn payment_private_key(&self) -> &[u8; 32] {
        &self.slot.payment_private_key
    }

    /// The 32-byte Ed25519 payment public key.
    pub fn payment_public_key(&self) -> &[u8; 32] {
        &self.slot.payment_public_key
    }

    /// The 32-byte Ed25519 stake signing key.
    pub fn stake_private_key(&self) -> &[u8; 32] {
        &self.slot.stake_private_key
    }

    /// The 32-byte Ed25519 stake public key.
    pub fn stake_public_key(&self) -> &[u8; 32] {
        &self.slot.stake_public_key
    }
}

impl Drop for WalletGuard {
    fn drop(&mut self) {
        self.slot.in_use.store(false, Ordering::Release);
        debug!("released wallet slot {}", self.index);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_seeds() -> Vec<String> {
        vec![
            "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about".to_string(),
        ]
    }

    #[test]
    fn test_wallet_manager_creation() {
        let mgr = WalletManager::from_seeds(&test_seeds()).unwrap();
        assert_eq!(mgr.count(), 1);
        let addr = mgr.get_address(0).unwrap();
        assert!(addr.starts_with("addr"));
    }

    #[test]
    fn test_acquire_and_release() {
        let mgr = WalletManager::from_seeds(&test_seeds()).unwrap();

        // Acquire the only wallet.
        let guard = mgr.try_acquire(&[]).unwrap();
        assert_eq!(guard.index(), 0);

        // Should fail to acquire again (all in use).
        assert!(mgr.try_acquire(&[]).is_none());

        // Drop the guard to release.
        drop(guard);

        // Should succeed now.
        let guard2 = mgr.try_acquire(&[]).unwrap();
        assert_eq!(guard2.index(), 0);
    }

    #[test]
    fn test_exclude_indices() {
        let mgr = WalletManager::from_seeds(&test_seeds()).unwrap();
        // Exclude index 0 -> no wallets available.
        assert!(mgr.try_acquire(&[0]).is_none());
    }

    #[test]
    fn test_get_credentials() {
        let mgr = WalletManager::from_seeds(&test_seeds()).unwrap();
        let (pay, stake) = mgr.get_credentials(0).unwrap();
        assert_eq!(pay.len(), 56);
        assert_eq!(stake.len(), 56);
    }
}
