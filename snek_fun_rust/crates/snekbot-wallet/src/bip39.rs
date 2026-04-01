//! BIP-39 mnemonic-to-seed and CIP-1852 key derivation for Cardano.
//!
//! Implements:
//! - Mnemonic phrase -> 512-bit seed (PBKDF2-HMAC-SHA512, 2048 iterations)
//! - CIP-1852 HD key derivation (m/1852'/1815'/0'/role/index)
//! - Ed25519 keypair derivation using HMAC-SHA512 chain-code scheme

use hmac::{Hmac, Mac};
use sha2::Sha512;
use blake2::digest::consts::U28;
use blake2::Blake2b;
use blake2::digest::Digest;

type HmacSha512 = Hmac<Sha512>;

/// Errors from BIP-39 / key derivation operations.
#[derive(Debug, thiserror::Error)]
pub enum Bip39Error {
    #[error("invalid mnemonic: {0}")]
    InvalidMnemonic(String),
    #[error("key derivation error: {0}")]
    DerivationError(String),
    #[error("invalid key material")]
    InvalidKeyMaterial,
}

/// Derive a 512-bit seed from a BIP-39 mnemonic phrase.
///
/// Uses PBKDF2-HMAC-SHA512 with 2048 iterations and passphrase "mnemonic".
pub fn mnemonic_to_seed(mnemonic: &str) -> Result<[u8; 64], Bip39Error> {
    let mnemonic = mnemonic.trim();
    let words: Vec<&str> = mnemonic.split_whitespace().collect();
    if words.len() != 12 && words.len() != 15 && words.len() != 24 {
        return Err(Bip39Error::InvalidMnemonic(format!(
            "expected 12, 15, or 24 words, got {}",
            words.len()
        )));
    }

    let password = mnemonic.as_bytes();
    let salt = b"mnemonic";
    let mut seed = [0u8; 64];
    pbkdf2::pbkdf2_hmac::<Sha512>(password, salt, 2048, &mut seed);
    Ok(seed)
}

/// A derived extended key (private key + chain code).
#[derive(Clone)]
pub struct ExtendedKey {
    /// 32-byte private key (left half of HMAC output).
    pub private_key: [u8; 32],
    /// 32-byte chain code (right half of HMAC output).
    pub chain_code: [u8; 32],
}

/// Derive the master key from a BIP-39 seed using HMAC-SHA512.
///
/// Uses the key "ed25519 cardano seed" as specified by CIP-1852 / Icarus style.
pub fn master_key_from_seed(seed: &[u8; 64]) -> Result<ExtendedKey, Bip39Error> {
    // Cardano Icarus-style: repeated HMAC rounds until the third-highest bit of
    // the first byte is clear (to ensure the key is a valid Ed25519 extended key).
    let mut data = seed.to_vec();
    loop {
        let mut mac = HmacSha512::new_from_slice(b"ed25519 cardano seed")
            .map_err(|_| Bip39Error::InvalidKeyMaterial)?;
        mac.update(&data);
        let result = mac.finalize().into_bytes();

        let mut private_key = [0u8; 32];
        let mut chain_code = [0u8; 32];
        private_key.copy_from_slice(&result[..32]);
        chain_code.copy_from_slice(&result[32..]);

        // Clamp the private key for Ed25519.
        private_key[0] &= 0b1111_1000;
        private_key[31] &= 0b0111_1111;
        private_key[31] |= 0b0100_0000;

        // Check the third bit of the first byte is clear (Icarus requirement).
        if private_key[0] & 0b0010_0000 == 0 {
            return Ok(ExtendedKey {
                private_key,
                chain_code,
            });
        }

        // Use the result as the next input.
        data = result.to_vec();
    }
}

/// Derive a hardened child key at the given index.
///
/// For hardened derivation (index >= 0x80000000), the input data is
/// `0x00 || private_key || index_be`.
fn derive_hardened_child(
    parent: &ExtendedKey,
    index: u32,
) -> Result<ExtendedKey, Bip39Error> {
    let hardened_index = 0x8000_0000 | index;

    let mut mac = HmacSha512::new_from_slice(&parent.chain_code)
        .map_err(|_| Bip39Error::InvalidKeyMaterial)?;

    // For hardened: 0x00 || key || index
    mac.update(&[0x00]);
    mac.update(&parent.private_key);
    mac.update(&hardened_index.to_be_bytes());

    let result = mac.finalize().into_bytes();
    let mut private_key = [0u8; 32];
    let mut chain_code = [0u8; 32];
    private_key.copy_from_slice(&result[..32]);
    chain_code.copy_from_slice(&result[32..]);

    // Clamp.
    private_key[0] &= 0b1111_1000;
    private_key[31] &= 0b0111_1111;
    private_key[31] |= 0b0100_0000;

    Ok(ExtendedKey {
        private_key,
        chain_code,
    })
}

/// Derive a normal (non-hardened) child key at the given index.
fn derive_normal_child(
    parent: &ExtendedKey,
    parent_public: &[u8; 32],
    index: u32,
) -> Result<ExtendedKey, Bip39Error> {
    let mut mac = HmacSha512::new_from_slice(&parent.chain_code)
        .map_err(|_| Bip39Error::InvalidKeyMaterial)?;

    // For normal: public_key || index
    mac.update(parent_public);
    mac.update(&index.to_be_bytes());

    let result = mac.finalize().into_bytes();
    let mut derived = [0u8; 32];
    let mut chain_code = [0u8; 32];
    derived.copy_from_slice(&result[..32]);
    chain_code.copy_from_slice(&result[32..]);

    // Add to parent key (mod curve order, but for Ed25519 we just XOR for
    // the simplified derivation used by Cardano light wallets).
    let mut private_key = [0u8; 32];
    let mut carry: u16 = 0;
    for i in 0..32 {
        let sum = parent.private_key[i] as u16 + derived[i] as u16 + carry;
        private_key[i] = sum as u8;
        carry = sum >> 8;
    }

    Ok(ExtendedKey {
        private_key,
        chain_code,
    })
}

/// Get the Ed25519 public key for a private key.
///
/// Uses ed25519-dalek to derive the public key from the 32-byte secret.
pub fn public_key_from_private(private_key: &[u8; 32]) -> [u8; 32] {
    use ed25519_dalek::SigningKey;
    let signing_key = SigningKey::from_bytes(private_key);
    let verifying_key = signing_key.verifying_key();
    verifying_key.to_bytes()
}

/// CIP-1852 derivation path components.
///
/// Full path: `m / 1852' / 1815' / account' / role / index`
#[derive(Debug, Clone, Copy)]
pub struct CardanoDerivationPath {
    /// Account index (hardened). Usually 0.
    pub account: u32,
    /// Role: 0 = external (payment), 2 = staking.
    pub role: u32,
    /// Address index (non-hardened). Usually 0.
    pub index: u32,
}

impl CardanoDerivationPath {
    /// Payment key path: m/1852'/1815'/0'/0/0
    pub fn payment() -> Self {
        Self {
            account: 0,
            role: 0,
            index: 0,
        }
    }

    /// Stake key path: m/1852'/1815'/0'/2/0
    pub fn stake() -> Self {
        Self {
            account: 0,
            role: 2,
            index: 0,
        }
    }
}

/// Derive a Cardano key following CIP-1852.
///
/// Path: m / 1852' / 1815' / account' / role / index
pub fn derive_cardano_key(
    seed: &[u8; 64],
    path: &CardanoDerivationPath,
) -> Result<ExtendedKey, Bip39Error> {
    let master = master_key_from_seed(seed)?;

    // m / 1852' (purpose)
    let purpose = derive_hardened_child(&master, 1852)?;
    // m / 1852' / 1815' (coin type for Cardano)
    let coin_type = derive_hardened_child(&purpose, 1815)?;
    // m / 1852' / 1815' / account'
    let account = derive_hardened_child(&coin_type, path.account)?;
    // m / 1852' / 1815' / account' / role (non-hardened)
    let account_pub = public_key_from_private(&account.private_key);
    let role = derive_normal_child(&account, &account_pub, path.role)?;
    // m / 1852' / 1815' / account' / role / index (non-hardened)
    let role_pub = public_key_from_private(&role.private_key);
    let key = derive_normal_child(&role, &role_pub, path.index)?;

    Ok(key)
}

/// Derive payment and stake key pairs from a mnemonic.
///
/// Returns `(payment_private, payment_public, stake_private, stake_public)`.
pub fn derive_keys_from_mnemonic(
    mnemonic: &str,
) -> Result<([u8; 32], [u8; 32], [u8; 32], [u8; 32]), Bip39Error> {
    let seed = mnemonic_to_seed(mnemonic)?;

    let payment_key = derive_cardano_key(&seed, &CardanoDerivationPath::payment())?;
    let payment_pub = public_key_from_private(&payment_key.private_key);

    let stake_key = derive_cardano_key(&seed, &CardanoDerivationPath::stake())?;
    let stake_pub = public_key_from_private(&stake_key.private_key);

    Ok((
        payment_key.private_key,
        payment_pub,
        stake_key.private_key,
        stake_pub,
    ))
}

/// Hash a public key with Blake2b-224 to produce a credential hash.
pub fn hash_public_key(public_key: &[u8; 32]) -> [u8; 28] {
    let mut hasher = Blake2b::<U28>::new();
    hasher.update(public_key);
    let result = hasher.finalize();
    let mut hash = [0u8; 28];
    hash.copy_from_slice(&result);
    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mnemonic_to_seed_length() {
        // Use a well-known test vector mnemonic (12 words).
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let seed = mnemonic_to_seed(mnemonic).unwrap();
        assert_eq!(seed.len(), 64);
        // Seed should not be all zeros.
        assert!(seed.iter().any(|&b| b != 0));
    }

    #[test]
    fn test_invalid_mnemonic_word_count() {
        let result = mnemonic_to_seed("hello world");
        assert!(result.is_err());
    }

    #[test]
    fn test_key_derivation() {
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let result = derive_keys_from_mnemonic(mnemonic);
        assert!(result.is_ok());
        let (pay_priv, pay_pub, stake_priv, stake_pub) = result.unwrap();
        // Keys should not be all zeros.
        assert!(pay_priv.iter().any(|&b| b != 0));
        assert!(pay_pub.iter().any(|&b| b != 0));
        assert!(stake_priv.iter().any(|&b| b != 0));
        assert!(stake_pub.iter().any(|&b| b != 0));
        // Payment and stake keys should be different.
        assert_ne!(pay_pub, stake_pub);
    }

    #[test]
    fn test_hash_public_key() {
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let (_, pay_pub, _, _) = derive_keys_from_mnemonic(mnemonic).unwrap();
        let hash = hash_public_key(&pay_pub);
        assert_eq!(hash.len(), 28);
        assert!(hash.iter().any(|&b| b != 0));
    }
}
