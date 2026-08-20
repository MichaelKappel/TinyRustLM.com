use std::io::{Read, Seek, SeekFrom};

use sha2::{Digest, Sha256};

use crate::{hex_lower, validate_profile_identity, Slm2Error};

/// The exact SLM2 direct-transfer piece size.
pub const PIECE_BYTES: u64 = 4_194_304;
const MAXIMUM_ARTIFACT_BYTES: u64 = 68_719_476_736;
const LEAF_DOMAIN: &[u8] = b"TinyRustLM-Merkle-Leaf-v1\0";
const NODE_DOMAIN: &[u8] = b"TinyRustLM-Merkle-Node-v1\0";
const CARRY_DOMAIN: &[u8] = b"TinyRustLM-Merkle-Carry-v1\0";
const ROOT_DOMAIN: &[u8] = b"TinyRustLM-Merkle-Root-v1\0";

/// Plain byte identity for one ordered 4 MiB transfer piece.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PieceIdentity {
    index: u64,
    byte_length: u64,
    sha256: [u8; 32],
}

impl PieceIdentity {
    /// Returns the zero-based piece index.
    pub const fn index(&self) -> u64 {
        self.index
    }

    /// Returns the exact piece length.
    pub const fn byte_length(&self) -> u64 {
        self.byte_length
    }

    /// Returns the plain SHA-256 of exact piece bytes.
    pub const fn sha256(&self) -> &[u8; 32] {
        &self.sha256
    }

    /// Returns the lowercase hexadecimal plain piece SHA-256.
    pub fn sha256_hex(&self) -> String {
        hex_lower(&self.sha256)
    }
}

/// Complete fixed-piece and Merkle identity for one immutable artifact.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PieceManifest {
    artifact_byte_length: u64,
    artifact_sha256: [u8; 32],
    pieces: Vec<PieceIdentity>,
    merkle_root: [u8; 32],
}

impl PieceManifest {
    /// Returns the exact complete artifact length.
    pub const fn artifact_byte_length(&self) -> u64 {
        self.artifact_byte_length
    }

    /// Returns the plain complete-artifact SHA-256.
    pub const fn artifact_sha256(&self) -> &[u8; 32] {
        &self.artifact_sha256
    }

    /// Returns ordered piece identities.
    pub fn pieces(&self) -> &[PieceIdentity] {
        &self.pieces
    }

    /// Returns the domain-separated published Merkle root.
    pub const fn merkle_root(&self) -> &[u8; 32] {
        &self.merkle_root
    }

    /// Returns the lowercase hexadecimal complete-artifact SHA-256.
    pub fn artifact_sha256_hex(&self) -> String {
        hex_lower(&self.artifact_sha256)
    }

    /// Returns the lowercase hexadecimal published Merkle root.
    pub fn merkle_root_hex(&self) -> String {
        hex_lower(&self.merkle_root)
    }
}

/// Streams one immutable artifact into exact 4 MiB piece and Merkle identities.
pub fn build_piece_manifest<R: Read + Seek>(source: &mut R) -> Result<PieceManifest, Slm2Error> {
    validate_profile_identity()?;
    let artifact_byte_length = source
        .seek(SeekFrom::End(0))
        .map_err(|_| Slm2Error::new("slm2-io"))?;
    if artifact_byte_length == 0 || artifact_byte_length > MAXIMUM_ARTIFACT_BYTES {
        return Err(Slm2Error::new("slm2-piece-size-limit"));
    }
    source
        .seek(SeekFrom::Start(0))
        .map_err(|_| Slm2Error::new("slm2-io"))?;

    let piece_count = artifact_byte_length
        .checked_add(PIECE_BYTES - 1)
        .map(|value| value / PIECE_BYTES)
        .ok_or_else(|| Slm2Error::new("slm2-piece-count-overflow"))?;
    let capacity =
        usize::try_from(piece_count).map_err(|_| Slm2Error::new("slm2-piece-count-overflow"))?;
    let mut pieces = Vec::with_capacity(capacity);
    let mut leaves = Vec::with_capacity(capacity);
    let mut artifact_hasher = Sha256::new();
    let mut buffer = vec![0_u8; PIECE_BYTES as usize];
    let mut remaining = artifact_byte_length;
    let mut index = 0_u64;
    while remaining > 0 {
        let length = remaining.min(PIECE_BYTES);
        let length_usize =
            usize::try_from(length).map_err(|_| Slm2Error::new("slm2-piece-count-overflow"))?;
        source
            .read_exact(&mut buffer[..length_usize])
            .map_err(|_| Slm2Error::new("slm2-io"))?;
        let plain_digest: [u8; 32] = Sha256::digest(&buffer[..length_usize]).into();
        artifact_hasher.update(&buffer[..length_usize]);
        leaves.push(hash_leaf(index, length, &plain_digest));
        pieces.push(PieceIdentity {
            index,
            byte_length: length,
            sha256: plain_digest,
        });
        index = index
            .checked_add(1)
            .ok_or_else(|| Slm2Error::new("slm2-piece-count-overflow"))?;
        remaining -= length;
    }
    if index != piece_count
        || pieces
            .iter()
            .take(pieces.len().saturating_sub(1))
            .any(|piece| piece.byte_length != PIECE_BYTES)
        || pieces
            .last()
            .is_none_or(|piece| !(1..=PIECE_BYTES).contains(&piece.byte_length))
    {
        return Err(Slm2Error::new("slm2-invalid-piece-layout"));
    }

    let final_tree_digest = reduce_tree(leaves)?;
    let mut root_hasher = Sha256::new();
    root_hasher.update(ROOT_DOMAIN);
    root_hasher.update(artifact_byte_length.to_le_bytes());
    root_hasher.update(piece_count.to_le_bytes());
    root_hasher.update(final_tree_digest);
    Ok(PieceManifest {
        artifact_byte_length,
        artifact_sha256: artifact_hasher.finalize().into(),
        pieces,
        merkle_root: root_hasher.finalize().into(),
    })
}

fn hash_leaf(index: u64, length: u64, plain_digest: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(LEAF_DOMAIN);
    hasher.update(index.to_le_bytes());
    hasher.update(length.to_le_bytes());
    hasher.update(plain_digest);
    hasher.finalize().into()
}

fn reduce_tree(mut nodes: Vec<[u8; 32]>) -> Result<[u8; 32], Slm2Error> {
    if nodes.is_empty() {
        return Err(Slm2Error::new("slm2-invalid-piece-layout"));
    }
    let mut level = 1_u32;
    while nodes.len() > 1 {
        let output_count = nodes
            .len()
            .checked_add(1)
            .map(|value| value / 2)
            .ok_or_else(|| Slm2Error::new("slm2-piece-count-overflow"))?;
        let mut next = Vec::with_capacity(output_count);
        for (parent_index, pair) in nodes.chunks(2).enumerate() {
            let parent_index = u64::try_from(parent_index)
                .map_err(|_| Slm2Error::new("slm2-piece-count-overflow"))?;
            let digest = if pair.len() == 2 {
                let mut hasher = Sha256::new();
                hasher.update(NODE_DOMAIN);
                hasher.update(level.to_le_bytes());
                hasher.update(parent_index.to_le_bytes());
                hasher.update(pair[0]);
                hasher.update(pair[1]);
                hasher.finalize().into()
            } else {
                let mut hasher = Sha256::new();
                hasher.update(CARRY_DOMAIN);
                hasher.update(level.to_le_bytes());
                hasher.update(parent_index.to_le_bytes());
                hasher.update(pair[0]);
                hasher.finalize().into()
            };
            next.push(digest);
        }
        nodes = next;
        level = level
            .checked_add(1)
            .ok_or_else(|| Slm2Error::new("slm2-piece-count-overflow"))?;
    }
    Ok(nodes[0])
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use super::*;

    #[test]
    fn one_piece_binds_plain_artifact_and_domain_root() {
        let manifest = build_piece_manifest(&mut Cursor::new(b"abc")).unwrap();
        assert_eq!(manifest.artifact_byte_length(), 3);
        assert_eq!(manifest.pieces().len(), 1);
        assert_eq!(manifest.pieces()[0].index(), 0);
        assert_eq!(manifest.pieces()[0].byte_length(), 3);
        assert_eq!(
            manifest.artifact_sha256_hex(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_ne!(manifest.merkle_root(), manifest.artifact_sha256());
    }

    #[test]
    fn exact_boundary_and_boundary_plus_one_have_canonical_lengths() {
        let exact =
            build_piece_manifest(&mut Cursor::new(vec![7_u8; PIECE_BYTES as usize])).unwrap();
        assert_eq!(exact.pieces().len(), 1);
        assert_eq!(exact.pieces()[0].byte_length(), PIECE_BYTES);

        let plus_one =
            build_piece_manifest(&mut Cursor::new(vec![9_u8; PIECE_BYTES as usize + 1])).unwrap();
        assert_eq!(plus_one.pieces().len(), 2);
        assert_eq!(plus_one.pieces()[0].byte_length(), PIECE_BYTES);
        assert_eq!(plus_one.pieces()[1].byte_length(), 1);
    }

    #[test]
    fn odd_piece_count_uses_domain_separated_carry() {
        let length = PIECE_BYTES as usize * 2 + 1;
        let first = build_piece_manifest(&mut Cursor::new(vec![3_u8; length])).unwrap();
        let second = build_piece_manifest(&mut Cursor::new(vec![3_u8; length])).unwrap();
        assert_eq!(first, second);
        assert_eq!(first.pieces().len(), 3);
        assert_ne!(first.merkle_root(), &[0_u8; 32]);
    }

    #[test]
    fn empty_artifact_is_invalid() {
        assert_eq!(
            build_piece_manifest(&mut Cursor::new(Vec::<u8>::new()))
                .unwrap_err()
                .code(),
            "slm2-piece-size-limit"
        );
    }
}
