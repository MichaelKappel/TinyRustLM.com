//! MiniModel peer-offer manifests for verified local `.slm` artifacts.

use std::fs;
use std::io;
use std::path::Path;

use crate::blend::{invalid, parse_manifest, push_line, require_equal, require_key};
use crate::slm_validate;

const OFFER_VERSION: &str = "0";
const OFFER_KIND: &str = "minimodel.peer_offer.v0";
const DEFAULT_CHUNK_SIZE: usize = 1_048_576;

struct ChunkProof {
    index: usize,
    offset: usize,
    byte_count: usize,
    sha256: String,
}

pub(crate) fn write_offer_path(
    input_slm: &Path,
    output_offer: &Path,
    artifact_file_name: Option<&str>,
    chunk_size: Option<&str>,
) -> io::Result<()> {
    let bytes = fs::read(input_slm)?;
    let report = slm_validate::validate_bytes(&bytes, &input_slm.display().to_string())?;
    let artifact_name = artifact_file_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| safe_file_name(input_slm));
    let text = build_offer_text(
        &bytes,
        &report,
        &artifact_name,
        parse_chunk_size(chunk_size)?,
    )?;
    if let Some(parent) = output_offer.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_offer, text)?;
    println!("MiniModel peer offer written: {}", output_offer.display());
    Ok(())
}

pub(crate) fn validate_offer_path(input_slm: &Path, input_offer: &Path) -> io::Result<()> {
    let bytes = fs::read(input_slm)?;
    let report = slm_validate::validate_bytes(&bytes, &input_slm.display().to_string())?;
    let offer_text = fs::read_to_string(input_offer)?;
    let fields = parse_manifest(&offer_text, "MiniModel peer offer")?;
    require_equal(&fields, "minimodel_peer_offer_version", OFFER_VERSION)?;
    require_equal(&fields, "offer_kind", OFFER_KIND)?;
    require_equal(&fields, "artifact_kind", "slm")?;
    require_equal(&fields, "project_server_serves_model_bytes", "false")?;
    require_equal(&fields, "project_server_runs_model_bytes", "false")?;
    require_equal(&fields, "transfer_network_available", "false")?;
    let artifact_name = require_key(&fields, "artifact_file_name")?;
    let chunk_size = parse_chunk_size(Some(require_key(&fields, "chunk_size")?))?;
    let expected = build_offer_text(&bytes, &report, artifact_name, chunk_size)?;
    if offer_text != expected {
        return Err(invalid(
            "MiniModel peer offer fields do not match recomputed .slm chunk proof",
        ));
    }
    println!("MiniModel peer offer validation: PASS");
    println!("artifact: {}", input_slm.display());
    println!("offer: {}", input_offer.display());
    Ok(())
}

fn build_offer_text(
    bytes: &[u8],
    report: &slm_validate::ValidationReport,
    artifact_file_name: &str,
    chunk_size: usize,
) -> io::Result<String> {
    if artifact_file_name.is_empty()
        || artifact_file_name.contains('/')
        || artifact_file_name.contains('\\')
        || artifact_file_name.contains('\n')
        || artifact_file_name.contains('\r')
    {
        return Err(invalid(
            "peer offer artifact file name must be a single safe file name",
        ));
    }
    let chunks = chunk_proofs(bytes, chunk_size)?;
    let chunk_list = chunk_list_text(&chunks);
    let mut text = String::new();
    push_line(&mut text, "minimodel_peer_offer_version", OFFER_VERSION);
    push_line(&mut text, "offer_kind", OFFER_KIND);
    push_line(&mut text, "artifact_kind", "slm");
    push_line(&mut text, "artifact_file_name", artifact_file_name);
    push_line(&mut text, "artifact_byte_count", &bytes.len().to_string());
    push_line(&mut text, "artifact_sha256", &sha256_prefixed(bytes));
    push_line(&mut text, "slm_version", &report.slm_version().to_string());
    push_line(
        &mut text,
        "slm_checksum",
        &format!("0x{:016x}", report.checksum()),
    );
    push_line(&mut text, "slm_model_shape", &report.shape_summary());
    push_line(&mut text, "slm_quantization", report.quantization_label());
    push_line(
        &mut text,
        "slm_tokenizer_checksum",
        &format!("0x{:016x}", report.tokenizer_checksum()),
    );
    push_line(
        &mut text,
        "slm_tensor_layout_checksum",
        &format!("0x{:016x}", report.tensor_layout_checksum()),
    );
    push_line(&mut text, "chunk_algorithm", "sha256-merkle-v0");
    push_line(&mut text, "chunk_size", &chunk_size.to_string());
    push_line(&mut text, "chunk_count", &chunks.len().to_string());
    push_line(
        &mut text,
        "chunk_list_sha256",
        &sha256_prefixed(chunk_list.as_bytes()),
    );
    push_line(
        &mut text,
        "merkle_root_sha256",
        &merkle_root_sha256(&chunks)?,
    );
    push_line(&mut text, "transfer_network_available", "false");
    push_line(&mut text, "project_server_serves_model_bytes", "false");
    push_line(&mut text, "project_server_runs_model_bytes", "false");
    push_line(
        &mut text,
        "required_next_gate",
        "consent-based-peer-transfer-and-rust-reverify-before-import",
    );
    for chunk in chunks {
        let prefix = format!("chunk.{}", chunk.index);
        push_line(
            &mut text,
            &format!("{prefix}.offset"),
            &chunk.offset.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.byte_count"),
            &chunk.byte_count.to_string(),
        );
        push_line(&mut text, &format!("{prefix}.sha256"), &chunk.sha256);
    }
    Ok(text)
}

fn chunk_proofs(bytes: &[u8], chunk_size: usize) -> io::Result<Vec<ChunkProof>> {
    if chunk_size == 0 {
        return Err(invalid("peer offer chunk size must be greater than zero"));
    }
    let mut chunks = Vec::new();
    for (index, chunk) in bytes.chunks(chunk_size).enumerate() {
        chunks.push(ChunkProof {
            index,
            offset: index
                .checked_mul(chunk_size)
                .ok_or_else(|| invalid("peer offer chunk offset overflow"))?,
            byte_count: chunk.len(),
            sha256: sha256_prefixed(chunk),
        });
    }
    if chunks.is_empty() {
        return Err(invalid("peer offer requires a nonempty artifact"));
    }
    Ok(chunks)
}

fn chunk_list_text(chunks: &[ChunkProof]) -> String {
    let mut text = String::new();
    for chunk in chunks {
        text.push_str(&format!(
            "{}={}={}={}\n",
            chunk.index, chunk.offset, chunk.byte_count, chunk.sha256
        ));
    }
    text
}

fn merkle_root_sha256(chunks: &[ChunkProof]) -> io::Result<String> {
    if chunks.is_empty() {
        return Err(invalid("peer offer requires at least one chunk"));
    }
    let mut level = chunks
        .iter()
        .map(|chunk| parse_sha256_hex(&chunk.sha256))
        .collect::<io::Result<Vec<_>>>()?;
    while level.len() > 1 {
        let mut next = Vec::new();
        for pair in level.chunks(2) {
            let left = &pair[0];
            let right = pair.get(1).unwrap_or(left);
            let mut bytes = Vec::with_capacity(64);
            bytes.extend_from_slice(left);
            bytes.extend_from_slice(right);
            next.push(sha256(&bytes));
        }
        level = next;
    }
    Ok(format!("sha256:{}", bytes_to_hex(&level[0])))
}

fn parse_chunk_size(value: Option<&str>) -> io::Result<usize> {
    let Some(value) = value else {
        return Ok(DEFAULT_CHUNK_SIZE);
    };
    let parsed = value
        .parse::<usize>()
        .map_err(|_| invalid("peer offer chunk size must be an integer"))?;
    if parsed == 0 {
        return Err(invalid("peer offer chunk size must be greater than zero"));
    }
    Ok(parsed)
}

fn safe_file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("model.slm")
        .to_string()
}

pub(crate) fn sha256_prefixed(bytes: &[u8]) -> String {
    format!("sha256:{}", bytes_to_hex(&sha256(bytes)))
}

fn parse_sha256_hex(value: &str) -> io::Result<[u8; 32]> {
    let hex = value.strip_prefix("sha256:").unwrap_or(value);
    if hex.len() != 64 || !hex.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(invalid(
            "SHA-256 value must be sha256: plus 64 hex characters",
        ));
    }
    let mut out = [0u8; 32];
    for index in 0..32 {
        out[index] = u8::from_str_radix(&hex[index * 2..index * 2 + 2], 16)
            .map_err(|_| invalid("SHA-256 value contained invalid hex"))?;
    }
    Ok(out)
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0x0f) as usize] as char);
    }
    out
}

fn sha256(input: &[u8]) -> [u8; 32] {
    const H0: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
    ];
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let mut state = H0;
    let bit_len = (input.len() as u64).wrapping_mul(8);
    let mut data = input.to_vec();
    data.push(0x80);
    while data.len() % 64 != 56 {
        data.push(0);
    }
    data.extend_from_slice(&bit_len.to_be_bytes());
    for chunk in data.chunks_exact(64) {
        let mut w = [0u32; 64];
        for (index, word) in w.iter_mut().take(16).enumerate() {
            let offset = index * 4;
            *word = u32::from_be_bytes([
                chunk[offset],
                chunk[offset + 1],
                chunk[offset + 2],
                chunk[offset + 3],
            ]);
        }
        for index in 16..64 {
            let s0 = w[index - 15].rotate_right(7)
                ^ w[index - 15].rotate_right(18)
                ^ (w[index - 15] >> 3);
            let s1 = w[index - 2].rotate_right(17)
                ^ w[index - 2].rotate_right(19)
                ^ (w[index - 2] >> 10);
            w[index] = w[index - 16]
                .wrapping_add(s0)
                .wrapping_add(w[index - 7])
                .wrapping_add(s1);
        }
        let mut a = state[0];
        let mut b = state[1];
        let mut c = state[2];
        let mut d = state[3];
        let mut e = state[4];
        let mut f = state[5];
        let mut g = state[6];
        let mut h = state[7];
        for index in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = h
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[index])
                .wrapping_add(w[index]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);
            h = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }
        state[0] = state[0].wrapping_add(a);
        state[1] = state[1].wrapping_add(b);
        state[2] = state[2].wrapping_add(c);
        state[3] = state[3].wrapping_add(d);
        state[4] = state[4].wrapping_add(e);
        state[5] = state[5].wrapping_add(f);
        state[6] = state[6].wrapping_add(g);
        state[7] = state[7].wrapping_add(h);
    }
    let mut out = [0u8; 32];
    for (index, word) in state.iter().enumerate() {
        out[index * 4..index * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn computes_known_sha256_vector() {
        assert_eq!(
            bytes_to_hex(&sha256(b"abc")),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn writes_and_validates_peer_offer() {
        let dir = unique_dir("peer-offer");
        let slm = dir.join("tiny-test-model-q8.slm");
        let offer = dir.join("tiny-test-model-q8.minimodel-peer-offer");
        fs::create_dir_all(&dir).unwrap();
        fs::write(&slm, fixture_slm()).unwrap();
        write_offer_path(&slm, &offer, None, Some("1024")).unwrap();
        let text = fs::read_to_string(&offer).unwrap();
        assert!(text.contains("offer_kind=minimodel.peer_offer.v0"));
        assert!(text.contains("artifact_kind=slm"));
        assert!(text.contains("chunk_algorithm=sha256-merkle-v0"));
        assert!(text.contains("transfer_network_available=false"));
        assert!(text.contains("project_server_serves_model_bytes=false"));
        assert!(text.contains("project_server_runs_model_bytes=false"));
        assert!(text.contains("chunk_count=9"));
        assert!(text.contains("chunk.0.sha256=sha256:"));
        validate_offer_path(&slm, &offer).unwrap();
    }

    #[test]
    fn rejects_peer_offer_drift() {
        let dir = unique_dir("peer-offer-drift");
        let slm = dir.join("tiny-test-model-q8.slm");
        let offer = dir.join("tiny-test-model-q8.minimodel-peer-offer");
        fs::create_dir_all(&dir).unwrap();
        fs::write(&slm, fixture_slm()).unwrap();
        write_offer_path(&slm, &offer, None, Some("2048")).unwrap();
        let text = fs::read_to_string(&offer).unwrap().replace(
            "transfer_network_available=false",
            "transfer_network_available=true",
        );
        fs::write(&offer, text).unwrap();
        let error = validate_offer_path(&slm, &offer).unwrap_err();
        assert!(error.to_string().contains("transfer_network_available"));
    }

    fn fixture_slm() -> &'static [u8] {
        include_bytes!("../../../models/tiny-test-model-q8.slm")
    }

    fn unique_dir(label: &str) -> PathBuf {
        let thread_label = std::thread::current()
            .name()
            .unwrap_or("thread")
            .replace(|ch: char| !ch.is_ascii_alphanumeric(), "-");
        std::env::temp_dir().join(format!(
            "tinyrustlm-peer-offer-{label}-{}-{}",
            std::process::id(),
            thread_label
        ))
    }
}
