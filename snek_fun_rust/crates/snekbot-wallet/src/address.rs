//! Cardano address encoding/decoding utilities.
//!
//! Supports Shelley-era base addresses (type 0x00/0x01) with payment and stake
//! credential extraction, bech32 encoding/decoding, and validation.

use bech32::{Bech32, Hrp};

/// Errors from address operations.
#[derive(Debug, thiserror::Error)]
pub enum AddressError {
    #[error("bech32 decode error: {0}")]
    Bech32Decode(String),
    #[error("bech32 encode error: {0}")]
    Bech32Encode(String),
    #[error("invalid hex: {0}")]
    InvalidHex(String),
    #[error("invalid address: {0}")]
    InvalidAddress(String),
    #[error("unsupported address type: 0x{0:02x}")]
    UnsupportedType(u8),
}

/// Decode a bech32-encoded Cardano address to its raw hex representation.
pub fn bech32_to_hex(bech32_addr: &str) -> Result<String, AddressError> {
    let (_, data) = bech32::decode(bech32_addr)
        .map_err(|e| AddressError::Bech32Decode(e.to_string()))?;
    Ok(hex::encode(data))
}

/// Encode raw hex bytes as a bech32 address with the given human-readable part.
///
/// Common HRPs:
/// - `"addr"` for mainnet addresses
/// - `"addr_test"` for testnet addresses
/// - `"stake"` for mainnet stake addresses
pub fn hex_to_bech32(hex_str: &str, hrp: &str) -> Result<String, AddressError> {
    let data = hex::decode(hex_str)
        .map_err(|e| AddressError::InvalidHex(e.to_string()))?;
    let hrp = Hrp::parse(hrp)
        .map_err(|e| AddressError::Bech32Encode(e.to_string()))?;
    let encoded = bech32::encode::<Bech32>(hrp, &data)
        .map_err(|e| AddressError::Bech32Encode(e.to_string()))?;
    Ok(encoded)
}

/// Credential hashes extracted from a Shelley base address.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AddressCredentials {
    /// 28-byte payment credential hash (hex-encoded).
    pub payment_hash: String,
    /// 28-byte stake credential hash (hex-encoded).
    pub stake_hash: String,
}

/// Parse a Shelley base address and extract payment and stake credential hashes.
///
/// Shelley base address layout (type byte 0x00 or 0x01 for mainnet):
/// ```text
/// [header: 1 byte] [payment_cred: 28 bytes] [stake_cred: 28 bytes]
/// ```
///
/// The header byte encodes:
/// - bits 7..4: address type (0 = base address with key/key)
/// - bits 3..0: network id (1 = mainnet, 0 = testnet)
pub fn extract_credentials(bech32_addr: &str) -> Result<AddressCredentials, AddressError> {
    let hex_str = bech32_to_hex(bech32_addr)?;
    extract_credentials_from_hex(&hex_str)
}

/// Extract credentials from a hex-encoded address.
pub fn extract_credentials_from_hex(hex_str: &str) -> Result<AddressCredentials, AddressError> {
    let bytes = hex::decode(hex_str)
        .map_err(|e| AddressError::InvalidHex(e.to_string()))?;

    if bytes.is_empty() {
        return Err(AddressError::InvalidAddress("empty address".to_string()));
    }

    let header = bytes[0];
    let addr_type = header >> 4;

    // Types 0-3 are base addresses (payment + stake credentials).
    // Type 0: key hash / key hash
    // Type 1: script hash / key hash
    // Type 2: key hash / script hash
    // Type 3: script hash / script hash
    match addr_type {
        0 | 1 | 2 | 3 => {
            // Base address: 1 (header) + 28 (payment) + 28 (stake) = 57 bytes
            if bytes.len() < 57 {
                return Err(AddressError::InvalidAddress(format!(
                    "base address too short: {} bytes (need 57)",
                    bytes.len()
                )));
            }
            let payment_hash = hex::encode(&bytes[1..29]);
            let stake_hash = hex::encode(&bytes[29..57]);
            Ok(AddressCredentials {
                payment_hash,
                stake_hash,
            })
        }
        4 | 5 => {
            // Pointer address: payment cred + pointer, no explicit stake hash.
            if bytes.len() < 29 {
                return Err(AddressError::InvalidAddress(
                    "pointer address too short".to_string(),
                ));
            }
            let payment_hash = hex::encode(&bytes[1..29]);
            Ok(AddressCredentials {
                payment_hash,
                stake_hash: String::new(),
            })
        }
        6 | 7 => {
            // Enterprise address: payment cred only, no stake cred.
            if bytes.len() < 29 {
                return Err(AddressError::InvalidAddress(
                    "enterprise address too short".to_string(),
                ));
            }
            let payment_hash = hex::encode(&bytes[1..29]);
            Ok(AddressCredentials {
                payment_hash,
                stake_hash: String::new(),
            })
        }
        _ => Err(AddressError::UnsupportedType(header)),
    }
}

/// Validate that a string is a well-formed Cardano bech32 address.
pub fn is_valid_address(addr: &str) -> bool {
    bech32::decode(addr).is_ok()
}

/// Validate that an address is a mainnet address (network id = 1).
pub fn is_mainnet_address(addr: &str) -> bool {
    match bech32::decode(addr) {
        Ok((_, data)) => {
            if data.is_empty() {
                return false;
            }
            // Network id is in the lower 4 bits of the header byte.
            let network_id = data[0] & 0x0F;
            network_id == 1
        }
        Err(_) => false,
    }
}

/// Build a Shelley base address (type 0x00) from payment and stake key hashes.
///
/// Returns the bech32-encoded address for mainnet.
pub fn build_base_address(
    payment_hash: &[u8; 28],
    stake_hash: &[u8; 28],
) -> Result<String, AddressError> {
    build_base_address_with_network(payment_hash, stake_hash, 1, "addr")
}

/// Build a Shelley base address with explicit network id and HRP.
pub fn build_base_address_with_network(
    payment_hash: &[u8; 28],
    stake_hash: &[u8; 28],
    network_id: u8,
    hrp: &str,
) -> Result<String, AddressError> {
    // Header: type 0 (base address, key/key) | network_id
    let header: u8 = 0x00 | (network_id & 0x0F);

    let mut raw = Vec::with_capacity(57);
    raw.push(header);
    raw.extend_from_slice(payment_hash);
    raw.extend_from_slice(stake_hash);

    let hex_str = hex::encode(&raw);
    hex_to_bech32(&hex_str, hrp)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bech32_roundtrip() {
        // Use the vault address from constants as a test vector.
        let addr = "addr1q94qd7j9r7l5kn40gw2h65c600yll8ztvlpgnmzalmx550qkleu07w9r6dc9a8vwacj33kk69uys53mrmjxzfz85mmpq5jw2wg";
        let hex_str = bech32_to_hex(addr).unwrap();
        let recovered = hex_to_bech32(&hex_str, "addr").unwrap();
        assert_eq!(addr, recovered);
    }

    #[test]
    fn test_extract_credentials() {
        let addr = "addr1q94qd7j9r7l5kn40gw2h65c600yll8ztvlpgnmzalmx550qkleu07w9r6dc9a8vwacj33kk69uys53mrmjxzfz85mmpq5jw2wg";
        let creds = extract_credentials(addr).unwrap();
        assert_eq!(creds.payment_hash.len(), 56); // 28 bytes = 56 hex chars
        assert_eq!(creds.stake_hash.len(), 56);
    }

    #[test]
    fn test_is_valid_address() {
        assert!(is_valid_address(
            "addr1q94qd7j9r7l5kn40gw2h65c600yll8ztvlpgnmzalmx550qkleu07w9r6dc9a8vwacj33kk69uys53mrmjxzfz85mmpq5jw2wg"
        ));
        assert!(!is_valid_address("not_a_valid_address"));
    }

    #[test]
    fn test_is_mainnet() {
        assert!(is_mainnet_address(
            "addr1q94qd7j9r7l5kn40gw2h65c600yll8ztvlpgnmzalmx550qkleu07w9r6dc9a8vwacj33kk69uys53mrmjxzfz85mmpq5jw2wg"
        ));
    }
}
