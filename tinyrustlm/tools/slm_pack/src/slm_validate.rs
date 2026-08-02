//! Native `.slm` admission validator for generated or converted model files.

use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::Path;

const HEADER_LEN: usize = 108;
const TENSOR_ENTRY_LEN: usize = 64;
const SLM_VERSION: u32 = 1;
const DTYPE_F32: u32 = 1;
const DTYPE_Q8_0: u32 = 2;
const DTYPE_Q4_0: u32 = 3;
const DTYPE_Q5_0: u32 = 4;

#[derive(Clone, Copy, Debug)]
struct SlmHeader {
    version: u32,
    header_length: u32,
    model_type: u32,
    flags: u32,
    vocab_size: u32,
    special_token_count: u32,
    hidden_size: u32,
    layer_count: u32,
    head_count: u32,
    kv_head_count: u32,
    head_dim: u32,
    ffn_size: u32,
    max_context: u32,
    rope_theta: f32,
    rms_norm_epsilon: f32,
    tokenizer_offset: u64,
    tokenizer_length: u64,
    tensor_directory_offset: u64,
    tensor_count: u32,
    tensor_data_offset: u64,
    checksum: u64,
}

#[derive(Clone, Copy, Debug)]
struct TensorEntry {
    name_hash: u64,
    dtype: u32,
    rank: u32,
    dims: [u32; 4],
    byte_offset: u64,
    byte_length: u64,
    scale_offset: u64,
    block_size: u32,
}

/// Compact report returned by the native `.slm` admission validator.
#[derive(Debug)]
pub(crate) struct ValidationReport {
    path: String,
    file_bytes: usize,
    header: SlmHeader,
    tensors: Vec<TensorEntry>,
    parameter_count: u64,
    quantization_label: &'static str,
    tokenizer_label: &'static str,
    tokenizer_checksum: u64,
    tensor_layout_checksum: u64,
}

impl ValidationReport {
    /// Returns the path label supplied to the validator.
    pub(crate) fn path(&self) -> &str {
        &self.path
    }

    /// Returns the model file length in bytes.
    pub(crate) fn file_bytes(&self) -> usize {
        self.file_bytes
    }

    /// Returns the maximum context token count declared by the validated header.
    pub(crate) fn context_token_limit(&self) -> u32 {
        self.header.max_context
    }

    /// Returns the declared token vocabulary size.
    pub(crate) fn vocab_size(&self) -> u32 {
        self.header.vocab_size
    }

    /// Returns the declared special-token count.
    pub(crate) fn special_token_count(&self) -> u32 {
        self.header.special_token_count
    }

    /// Returns the declared transformer hidden size.
    pub(crate) fn hidden_size(&self) -> u32 {
        self.header.hidden_size
    }

    /// Returns the declared decoder layer count.
    pub(crate) fn layer_count(&self) -> u32 {
        self.header.layer_count
    }

    /// Returns the declared attention query-head count.
    pub(crate) fn head_count(&self) -> u32 {
        self.header.head_count
    }

    /// Returns the declared key/value-head count.
    pub(crate) fn kv_head_count(&self) -> u32 {
        self.header.kv_head_count
    }

    /// Returns the declared per-head dimension.
    pub(crate) fn head_dim(&self) -> u32 {
        self.header.head_dim
    }

    /// Returns the declared feed-forward intermediate size.
    pub(crate) fn ffn_size(&self) -> u32 {
        self.header.ffn_size
    }

    /// Returns the parsed `.slm` version.
    pub(crate) fn slm_version(&self) -> u32 {
        self.header.version
    }

    /// Returns the v1 format flags field.
    pub(crate) fn flags(&self) -> u32 {
        self.header.flags
    }

    /// Returns a compact deterministic model shape string for manifests.
    pub(crate) fn shape_summary(&self) -> String {
        format!(
            "vocab={},hidden={},layers={},heads={},kv_heads={},head_dim={},ffn={},context={}",
            self.header.vocab_size,
            self.header.hidden_size,
            self.header.layer_count,
            self.header.head_count,
            self.header.kv_head_count,
            self.header.head_dim,
            self.header.ffn_size,
            self.header.max_context
        )
    }

    /// Returns the number of tensor directory entries.
    pub(crate) fn tensor_count(&self) -> usize {
        self.tensors.len()
    }

    /// Returns the total logical parameter count.
    pub(crate) fn parameter_count(&self) -> u64 {
        self.parameter_count
    }

    /// Returns the detected quantization label.
    pub(crate) fn quantization_label(&self) -> &'static str {
        self.quantization_label
    }

    /// Returns the tokenizer kind declared by the validated tokenizer section.
    pub(crate) fn tokenizer_label(&self) -> &'static str {
        self.tokenizer_label
    }

    /// Returns the output-head contract label implied by the v1 flags.
    pub(crate) fn output_contract_label(&self) -> &'static str {
        if self.header.flags & 1 != 0 {
            "tied-output"
        } else {
            "explicit-output"
        }
    }

    /// Returns a stable checksum over the tokenizer section bytes.
    pub(crate) fn tokenizer_checksum(&self) -> u64 {
        self.tokenizer_checksum
    }

    /// Returns a stable checksum over logical tensor names, dtypes, ranks, shapes, and blocks.
    pub(crate) fn tensor_layout_checksum(&self) -> u64 {
        self.tensor_layout_checksum
    }

    /// Returns the `.slm` header checksum.
    pub(crate) fn checksum(&self) -> u64 {
        self.header.checksum
    }
}

/// Validates an `.slm` file from disk and prints a compact admission report.
pub fn validate_path(path: &Path) -> io::Result<()> {
    let bytes = fs::read(path)?;
    let report = validate_bytes(&bytes, &path.display().to_string())?;
    print_report(&report);
    Ok(())
}

/// Validates an `.slm` byte slice and returns a compact report.
pub(crate) fn validate_bytes(bytes: &[u8], path: &str) -> io::Result<ValidationReport> {
    let header = parse_header(bytes)?;
    validate_header(bytes, &header)?;
    validate_checksum(bytes, &header)?;
    validate_tokenizer(bytes, &header)?;
    let tensors = parse_tensors(bytes, &header)?;
    validate_unique_tensors(&tensors)?;
    validate_required_tensors(&header, &tensors)?;
    validate_tensor_payloads(bytes, &tensors)?;
    let tokenizer_checksum = tokenizer_checksum(bytes, &header)?;
    let tokenizer_label = tokenizer_label(bytes, &header)?;
    let tensor_layout_checksum = tensor_layout_checksum(&tensors);
    let parameter_count = tensors.iter().try_fold(0u64, |acc, tensor| {
        acc.checked_add(element_count(tensor))
            .ok_or_else(|| invalid("parameter count overflow"))
    })?;
    Ok(ValidationReport {
        path: path.to_string(),
        file_bytes: bytes.len(),
        header,
        quantization_label: quantization_label(&tensors),
        tokenizer_label,
        tensors,
        parameter_count,
        tokenizer_checksum,
        tensor_layout_checksum,
    })
}

fn print_report(report: &ValidationReport) {
    println!("SLM validation: PASS");
    println!("path: {}", report.path);
    println!("bytes: {}", report.file_bytes);
    println!("version: {}", report.header.version);
    println!(
        "shape: vocab={} hidden={} layers={} heads={} kv_heads={} head_dim={} ffn={} context={}",
        report.header.vocab_size,
        report.header.hidden_size,
        report.header.layer_count,
        report.header.head_count,
        report.header.kv_head_count,
        report.header.head_dim,
        report.header.ffn_size,
        report.header.max_context
    );
    println!("tensor_count: {}", report.tensors.len());
    println!("parameter_count: {}", report.parameter_count);
    println!("quantization: {}", report.quantization_label);
    println!("tokenizer: {}", report.tokenizer_label);
    println!("checksum: 0x{:016x}", report.header.checksum);
}

fn parse_header(bytes: &[u8]) -> io::Result<SlmHeader> {
    if bytes.len() < HEADER_LEN {
        return Err(invalid("file is shorter than the v1 header"));
    }
    if bytes.get(0..4) != Some(b"SLM1") {
        return Err(invalid("invalid SLM magic"));
    }
    Ok(SlmHeader {
        version: read_u32(bytes, 4)?,
        header_length: read_u32(bytes, 8)?,
        model_type: read_u32(bytes, 12)?,
        flags: read_u32(bytes, 16)?,
        vocab_size: read_u32(bytes, 20)?,
        special_token_count: read_u32(bytes, 24)?,
        hidden_size: read_u32(bytes, 28)?,
        layer_count: read_u32(bytes, 32)?,
        head_count: read_u32(bytes, 36)?,
        kv_head_count: read_u32(bytes, 40)?,
        head_dim: read_u32(bytes, 44)?,
        ffn_size: read_u32(bytes, 48)?,
        max_context: read_u32(bytes, 52)?,
        rope_theta: f32::from_bits(read_u32(bytes, 56)?),
        rms_norm_epsilon: f32::from_bits(read_u32(bytes, 60)?),
        tokenizer_offset: read_u64(bytes, 64)?,
        tokenizer_length: read_u64(bytes, 72)?,
        tensor_directory_offset: read_u64(bytes, 80)?,
        tensor_count: read_u32(bytes, 88)?,
        tensor_data_offset: read_u64(bytes, 92)?,
        checksum: read_u64(bytes, 100)?,
    })
}

fn validate_header(bytes: &[u8], header: &SlmHeader) -> io::Result<()> {
    if header.version != SLM_VERSION {
        return Err(invalid("unsupported SLM version"));
    }
    if header.header_length < HEADER_LEN as u32 || header.header_length as usize > bytes.len() {
        return Err(invalid("invalid header length"));
    }
    if header.model_type != 1 {
        return Err(invalid("unsupported model type"));
    }
    if header.vocab_size < 260 || header.special_token_count < 4 {
        return Err(invalid(
            "byte tokenizer requires vocab >= 260 and four specials",
        ));
    }
    if header.hidden_size == 0
        || header.layer_count == 0
        || header.head_count == 0
        || header.kv_head_count == 0
        || header.head_dim == 0
        || header.ffn_size == 0
        || header.max_context == 0
    {
        return Err(invalid("model dimensions must be nonzero"));
    }
    header
        .head_count
        .checked_mul(header.head_dim)
        .ok_or_else(|| invalid("query projection width overflow"))?;
    if header.kv_head_count > header.head_count
        || !header.head_count.is_multiple_of(header.kv_head_count)
    {
        return Err(invalid("kv_head_count must divide head_count"));
    }
    if !header.rope_theta.is_finite() || header.rope_theta <= 0.0 {
        return Err(invalid("rope_theta must be finite and positive"));
    }
    if !header.rms_norm_epsilon.is_finite() || header.rms_norm_epsilon <= 0.0 {
        return Err(invalid("rms_norm_epsilon must be finite and positive"));
    }
    if header.checksum == 0 {
        return Err(invalid("checksum must be nonzero"));
    }
    if header.tokenizer_offset < u64::from(header.header_length) {
        return Err(invalid("tokenizer overlaps the header"));
    }
    if !range_within(
        bytes.len(),
        header.tokenizer_offset,
        header.tokenizer_length,
    ) {
        return Err(invalid("tokenizer range escapes the file"));
    }
    if !header.tensor_directory_offset.is_multiple_of(64)
        || !header.tensor_data_offset.is_multiple_of(64)
    {
        return Err(invalid(
            "tensor directory and data offsets must be 64-byte aligned",
        ));
    }
    let directory_len = u64::from(header.tensor_count)
        .checked_mul(TENSOR_ENTRY_LEN as u64)
        .ok_or_else(|| invalid("tensor directory length overflow"))?;
    if !range_within(bytes.len(), header.tensor_directory_offset, directory_len) {
        return Err(invalid("tensor directory range escapes the file"));
    }
    if header.tensor_data_offset < header.tensor_directory_offset + directory_len {
        return Err(invalid(
            "tensor data begins before the tensor directory ends",
        ));
    }
    Ok(())
}

fn validate_checksum(bytes: &[u8], header: &SlmHeader) -> io::Result<()> {
    let actual = simple_checksum(bytes);
    if header.checksum != actual {
        return Err(invalid("checksum mismatch"));
    }
    Ok(())
}

fn validate_tokenizer(bytes: &[u8], header: &SlmHeader) -> io::Result<()> {
    let start = as_usize(header.tokenizer_offset)?;
    let len = as_usize(header.tokenizer_length)?;
    let end = start
        .checked_add(len)
        .ok_or_else(|| invalid("tokenizer section length overflow"))?;
    let section = bytes
        .get(start..end)
        .ok_or_else(|| invalid("tokenizer section escapes the file"))?;
    match section.get(0..4) {
        Some(b"BTOK") => validate_byte_tokenizer(section),
        Some(b"BPE1") => validate_bpe_tokenizer(section, header.vocab_size),
        Some(b"LBPE") => validate_llama_bpe_tokenizer(section, header.vocab_size),
        Some(b"GBPE") => validate_gpt2_bpe_tokenizer(section, header.vocab_size),
        _ => Err(invalid("unsupported tokenizer section magic")),
    }
}

fn tokenizer_label(bytes: &[u8], header: &SlmHeader) -> io::Result<&'static str> {
    let start = as_usize(header.tokenizer_offset)?;
    let len = as_usize(header.tokenizer_length)?;
    let end = start
        .checked_add(len)
        .ok_or_else(|| invalid("tokenizer section length overflow"))?;
    let section = bytes
        .get(start..end)
        .ok_or_else(|| invalid("tokenizer section escapes the file"))?;
    match section.get(0..4) {
        Some(b"BTOK") => Ok("byte-v1"),
        Some(b"BPE1") => Ok("bpe-v1"),
        Some(b"LBPE") => Ok("llama-bpe-v1"),
        Some(b"GBPE") => Ok("gpt2-bpe-v1"),
        _ => Err(invalid("unsupported tokenizer section magic")),
    }
}

fn validate_byte_tokenizer(section: &[u8]) -> io::Result<()> {
    if section.len() < 28 {
        return Err(invalid("byte tokenizer section is too short"));
    }
    if read_u32(section, 4)? != 1 {
        return Err(invalid("unsupported byte tokenizer section version"));
    }
    if read_u32(section, 8)? != 260 {
        return Err(invalid("phase-one byte tokenizer must declare 260 tokens"));
    }
    if read_u32(section, 12)? != 256
        || read_u32(section, 16)? != 257
        || read_u32(section, 20)? != 258
        || read_u32(section, 24)? != 259
    {
        return Err(invalid("phase-one byte tokenizer special ids are invalid"));
    }
    Ok(())
}

fn validate_bpe_tokenizer(section: &[u8], header_vocab_size: u32) -> io::Result<()> {
    if section.len() < 36 {
        return Err(invalid("BPE tokenizer section is too short"));
    }
    if read_u32(section, 4)? != 1 {
        return Err(invalid("unsupported BPE tokenizer section version"));
    }
    let vocab_size = read_u32(section, 8)?;
    if vocab_size != header_vocab_size || vocab_size < 260 {
        return Err(invalid("BPE tokenizer vocab must match the model header"));
    }
    for offset in [12usize, 16, 20, 24] {
        if read_u32(section, offset)? >= vocab_size {
            return Err(invalid("BPE tokenizer special id escapes vocabulary"));
        }
    }
    let token_count = read_u32(section, 28)? as usize;
    let merge_count = read_u32(section, 32)? as usize;
    let mut offset = 36usize;
    let mut token_ids = HashSet::new();
    for _ in 0..token_count {
        let id = read_u32(section, offset)?;
        let len = read_u32(section, offset + 4)? as usize;
        offset = offset
            .checked_add(8)
            .ok_or_else(|| invalid("BPE token table offset overflow"))?;
        let end = offset
            .checked_add(len)
            .ok_or_else(|| invalid("BPE token byte length overflow"))?;
        let token_bytes = section
            .get(offset..end)
            .ok_or_else(|| invalid("BPE token bytes escape tokenizer section"))?;
        if id < 260 || id >= vocab_size || token_bytes.is_empty() {
            return Err(invalid("BPE token table entry is invalid"));
        }
        if !token_ids.insert(id) {
            return Err(invalid("BPE token ids must be unique"));
        }
        offset = end;
    }
    for _ in 0..merge_count {
        let end = offset
            .checked_add(16)
            .ok_or_else(|| invalid("BPE merge table offset overflow"))?;
        if end > section.len() {
            return Err(invalid("BPE merge table escapes tokenizer section"));
        }
        let left = read_u32(section, offset)?;
        let right = read_u32(section, offset + 4)?;
        let output = read_u32(section, offset + 8)?;
        if left >= vocab_size || right >= vocab_size || output >= vocab_size || output < 260 {
            return Err(invalid("BPE merge ids must stay inside vocabulary"));
        }
        if !token_ids.contains(&output) {
            return Err(invalid("BPE merge output must exist in token table"));
        }
        offset = end;
    }
    if offset != section.len() {
        return Err(invalid("BPE tokenizer section has trailing bytes"));
    }
    Ok(())
}

fn validate_gpt2_bpe_tokenizer(section: &[u8], header_vocab_size: u32) -> io::Result<()> {
    if section.len() < 40 {
        return Err(invalid("GPT2 BPE tokenizer section is too short"));
    }
    if read_u32(section, 4)? != 1 {
        return Err(invalid("unsupported GPT2 BPE tokenizer section version"));
    }
    let vocab_size = read_u32(section, 8)?;
    if vocab_size != header_vocab_size || vocab_size < 260 {
        return Err(invalid(
            "GPT2 BPE tokenizer vocab must match the model header",
        ));
    }
    let bos = read_u32(section, 12)?;
    let eos = read_u32(section, 16)?;
    let pad = read_u32(section, 20)?;
    let unk = read_u32(section, 24)?;
    for id in [bos, eos, pad, unk] {
        if id >= vocab_size {
            return Err(invalid("GPT2 BPE tokenizer special id escapes vocabulary"));
        }
    }

    let token_count = read_u32(section, 28)? as usize;
    let merge_count = read_u32(section, 32)? as usize;
    let special_count = read_u32(section, 36)? as usize;
    let mut offset = 40usize;
    let mut token_ids = HashSet::new();
    let mut token_bytes = HashSet::new();
    for _ in 0..token_count {
        let id = read_u32(section, offset)?;
        let len = read_u32(section, offset + 4)? as usize;
        offset = offset
            .checked_add(8)
            .ok_or_else(|| invalid("GPT2 BPE token table offset overflow"))?;
        let end = offset
            .checked_add(len)
            .ok_or_else(|| invalid("GPT2 BPE token byte length overflow"))?;
        let bytes = section
            .get(offset..end)
            .ok_or_else(|| invalid("GPT2 BPE token bytes escape tokenizer section"))?;
        if id >= vocab_size || [bos, eos, pad, unk].contains(&id) || bytes.is_empty() {
            return Err(invalid("GPT2 BPE token table entry is invalid"));
        }
        if !token_ids.insert(id) {
            return Err(invalid("GPT2 BPE token ids must be unique"));
        }
        if !token_bytes.insert(bytes.to_vec()) {
            return Err(invalid("GPT2 BPE token bytes must be unique"));
        }
        offset = end;
    }
    let mut special_ids = HashSet::new();
    let mut special_bytes = HashSet::new();
    for _ in 0..special_count {
        let id = read_u32(section, offset)?;
        let len = read_u32(section, offset + 4)? as usize;
        offset = offset
            .checked_add(8)
            .ok_or_else(|| invalid("GPT2 BPE special table offset overflow"))?;
        let end = offset
            .checked_add(len)
            .ok_or_else(|| invalid("GPT2 BPE special byte length overflow"))?;
        let bytes = section
            .get(offset..end)
            .ok_or_else(|| invalid("GPT2 BPE special bytes escape tokenizer section"))?;
        if id >= vocab_size || bytes.is_empty() {
            return Err(invalid("GPT2 BPE special table entry is invalid"));
        }
        if !special_ids.insert(id) || !special_bytes.insert(bytes.to_vec()) {
            return Err(invalid("GPT2 BPE specials must be unique"));
        }
        if token_ids.contains(&id) || token_bytes.contains(bytes) {
            return Err(invalid("GPT2 BPE specials must not duplicate token rows"));
        }
        offset = end;
    }
    for byte in 0u8..=255 {
        if gpt2_bpe_required_prompt_byte(byte) && !token_bytes.contains(&vec![byte]) {
            return Err(invalid(
                "GPT2 BPE tokenizer is missing required prompt byte tokens",
            ));
        }
    }

    for _ in 0..merge_count {
        let end = offset
            .checked_add(16)
            .ok_or_else(|| invalid("GPT2 BPE merge table offset overflow"))?;
        if end > section.len() {
            return Err(invalid("GPT2 BPE merge table escapes tokenizer section"));
        }
        let left = read_u32(section, offset)?;
        let right = read_u32(section, offset + 4)?;
        let output = read_u32(section, offset + 8)?;
        if left >= vocab_size
            || right >= vocab_size
            || output >= vocab_size
            || [bos, eos, pad, unk].contains(&output)
            || special_ids.contains(&left)
            || special_ids.contains(&right)
            || special_ids.contains(&output)
            || !token_ids.contains(&left)
            || !token_ids.contains(&right)
            || !token_ids.contains(&output)
        {
            return Err(invalid("GPT2 BPE merge ids must stay inside vocabulary"));
        }
        offset = end;
    }
    if offset != section.len() {
        return Err(invalid("GPT2 BPE tokenizer section has trailing bytes"));
    }
    Ok(())
}

fn gpt2_bpe_required_prompt_byte(byte: u8) -> bool {
    matches!(byte, b'\t' | b'\n' | b'\r' | 0x20..=0x7e)
}

fn validate_llama_bpe_tokenizer(section: &[u8], header_vocab_size: u32) -> io::Result<()> {
    if section.len() < 40 {
        return Err(invalid("Llama BPE tokenizer section is too short"));
    }
    if read_u32(section, 4)? != 1 {
        return Err(invalid("unsupported Llama BPE tokenizer section version"));
    }
    let vocab_size = read_u32(section, 8)?;
    if vocab_size != header_vocab_size {
        return Err(invalid(
            "Llama BPE tokenizer vocab must match the model header",
        ));
    }
    let bos = read_u32(section, 12)?;
    let eos = read_u32(section, 16)?;
    let pad = read_u32(section, 20)?;
    let unk = read_u32(section, 24)?;
    let token_count = read_u32(section, 28)? as usize;
    let merge_count = read_u32(section, 32)? as usize;
    let byte_token_base = read_u32(section, 36)?;
    validate_llama_bpe_header(vocab_size, bos, eos, pad, unk, byte_token_base)?;

    let mut offset = 40usize;
    let mut token_ids = HashSet::new();
    for _ in 0..token_count {
        let id = read_u32(section, offset)?;
        let len = read_u32(section, offset + 4)? as usize;
        offset = offset
            .checked_add(8)
            .ok_or_else(|| invalid("Llama BPE token table offset overflow"))?;
        let end = offset
            .checked_add(len)
            .ok_or_else(|| invalid("Llama BPE token byte length overflow"))?;
        let token_bytes = section
            .get(offset..end)
            .ok_or_else(|| invalid("Llama BPE token bytes escape tokenizer section"))?;
        if token_bytes.is_empty()
            || id >= vocab_size
            || id == bos
            || id == eos
            || id == pad
            || id == unk
            || is_llama_byte_token(id, byte_token_base)
        {
            return Err(invalid("Llama BPE token table entry is invalid"));
        }
        if !token_ids.insert(id) {
            return Err(invalid("Llama BPE token ids must be unique"));
        }
        offset = end;
    }

    let mut ranks = HashSet::new();
    for _ in 0..merge_count {
        let end = offset
            .checked_add(16)
            .ok_or_else(|| invalid("Llama BPE merge table offset overflow"))?;
        if end > section.len() {
            return Err(invalid("Llama BPE merge table escapes tokenizer section"));
        }
        let left = read_u32(section, offset)?;
        let right = read_u32(section, offset + 4)?;
        let output = read_u32(section, offset + 8)?;
        let rank = read_u32(section, offset + 12)?;
        if left >= vocab_size
            || right >= vocab_size
            || output >= vocab_size
            || output == bos
            || output == eos
            || output == pad
            || output == unk
            || is_llama_byte_token(output, byte_token_base)
        {
            return Err(invalid("Llama BPE merge ids must stay inside vocabulary"));
        }
        if !token_ids.contains(&output) {
            return Err(invalid("Llama BPE merge output must exist in token table"));
        }
        if !ranks.insert(rank) {
            return Err(invalid("Llama BPE merge ranks must be unique"));
        }
        offset = end;
    }
    if offset != section.len() {
        return Err(invalid("Llama BPE tokenizer section has trailing bytes"));
    }
    Ok(())
}

fn validate_llama_bpe_header(
    vocab_size: u32,
    bos: u32,
    eos: u32,
    pad: u32,
    unk: u32,
    byte_token_base: u32,
) -> io::Result<()> {
    let byte_token_end = byte_token_base
        .checked_add(255)
        .ok_or_else(|| invalid("Llama BPE byte fallback range overflows"))?;
    if vocab_size <= byte_token_end
        || bos >= vocab_size
        || eos >= vocab_size
        || pad >= vocab_size
        || unk >= vocab_size
        || is_llama_byte_token(bos, byte_token_base)
        || is_llama_byte_token(eos, byte_token_base)
        || is_llama_byte_token(pad, byte_token_base)
        || is_llama_byte_token(unk, byte_token_base)
    {
        return Err(invalid("Llama BPE special ids are invalid"));
    }
    Ok(())
}

fn is_llama_byte_token(token: u32, byte_token_base: u32) -> bool {
    token >= byte_token_base && token < byte_token_base.saturating_add(256)
}

fn parse_tensors(bytes: &[u8], header: &SlmHeader) -> io::Result<Vec<TensorEntry>> {
    let start = as_usize(header.tensor_directory_offset)?;
    let mut tensors = Vec::with_capacity(header.tensor_count as usize);
    for index in 0..header.tensor_count as usize {
        let base = start + index * TENSOR_ENTRY_LEN;
        let entry = TensorEntry {
            name_hash: read_u64(bytes, base)?,
            dtype: read_u32(bytes, base + 8)?,
            rank: read_u32(bytes, base + 12)?,
            dims: [
                read_u32(bytes, base + 16)?,
                read_u32(bytes, base + 20)?,
                read_u32(bytes, base + 24)?,
                read_u32(bytes, base + 28)?,
            ],
            byte_offset: read_u64(bytes, base + 32)?,
            byte_length: read_u64(bytes, base + 40)?,
            scale_offset: read_u64(bytes, base + 48)?,
            block_size: read_u32(bytes, base + 56)?,
        };
        validate_tensor_directory_entry(bytes.len(), &entry)?;
        tensors.push(entry);
    }
    Ok(tensors)
}

fn validate_tensor_directory_entry(file_len: usize, tensor: &TensorEntry) -> io::Result<()> {
    if tensor.rank == 0 || tensor.rank > 4 {
        return Err(invalid("tensor rank must be between one and four"));
    }
    if !matches!(
        tensor.dtype,
        DTYPE_F32 | DTYPE_Q8_0 | DTYPE_Q4_0 | DTYPE_Q5_0
    ) {
        return Err(invalid("unsupported tensor dtype"));
    }
    for dim in tensor.dims.iter().take(tensor.rank as usize) {
        if *dim == 0 {
            return Err(invalid("tensor dimensions must be nonzero"));
        }
    }
    if !tensor.byte_offset.is_multiple_of(64) {
        return Err(invalid("tensor payload offset must be 64-byte aligned"));
    }
    if !range_within(file_len, tensor.byte_offset, tensor.byte_length) {
        return Err(invalid("tensor payload escapes the file"));
    }
    let expected = expected_payload_len(tensor)?;
    if tensor.byte_length != expected {
        return Err(invalid("tensor byte length does not match dtype and shape"));
    }
    match tensor.dtype {
        DTYPE_F32 => {
            if tensor.scale_offset != 0 || tensor.block_size != 0 {
                return Err(invalid(
                    "f32 tensors must not declare quantization metadata",
                ));
            }
        }
        DTYPE_Q8_0 => {
            if tensor.scale_offset == 0 {
                return Err(invalid("q8_0 tensors require scale metadata"));
            }
            if tensor.block_size != cols_per_row(tensor)? as u32 {
                return Err(invalid("q8_0 block_size must equal columns per row"));
            }
            let scale_len = rows(tensor)?
                .checked_mul(4)
                .ok_or_else(|| invalid("q8_0 scale length overflow"))?;
            if !range_within(file_len, tensor.scale_offset, scale_len as u64) {
                return Err(invalid("q8_0 scale range escapes the file"));
            }
        }
        DTYPE_Q4_0 => {
            if tensor.scale_offset == 0 || tensor.block_size == 0 {
                return Err(invalid(
                    "q4_0 tensors require scale metadata and block size",
                ));
            }
            let cols = cols_per_row(tensor)?;
            let block = tensor.block_size as usize;
            if !block.is_multiple_of(2) || cols % block != 0 {
                return Err(invalid(
                    "q4_0 block size must be even and divide columns per row",
                ));
            }
            let scale_count = rows(tensor)?
                .checked_mul(cols / block)
                .ok_or_else(|| invalid("q4_0 scale count overflow"))?;
            let scale_len = scale_count
                .checked_mul(4)
                .ok_or_else(|| invalid("q4_0 scale length overflow"))?;
            if !range_within(file_len, tensor.scale_offset, scale_len as u64) {
                return Err(invalid("q4_0 scale range escapes the file"));
            }
        }
        DTYPE_Q5_0 => {
            if tensor.scale_offset == 0 || tensor.block_size == 0 {
                return Err(invalid(
                    "q5_0 tensors require scale metadata and block size",
                ));
            }
            let cols = cols_per_row(tensor)?;
            let block = tensor.block_size as usize;
            if !block.is_multiple_of(8) || cols % block != 0 {
                return Err(invalid(
                    "q5_0 block size must be byte-aligned and divide columns per row",
                ));
            }
            let scale_count = rows(tensor)?
                .checked_mul(cols / block)
                .ok_or_else(|| invalid("q5_0 scale count overflow"))?;
            let scale_len = scale_count
                .checked_mul(4)
                .ok_or_else(|| invalid("q5_0 scale length overflow"))?;
            if !range_within(file_len, tensor.scale_offset, scale_len as u64) {
                return Err(invalid("q5_0 scale range escapes the file"));
            }
        }
        _ => {}
    }
    Ok(())
}

fn validate_unique_tensors(tensors: &[TensorEntry]) -> io::Result<()> {
    let mut seen = HashSet::new();
    for tensor in tensors {
        if !seen.insert(tensor.name_hash) {
            return Err(invalid("duplicate tensor name hash"));
        }
    }
    Ok(())
}

fn validate_required_tensors(header: &SlmHeader, tensors: &[TensorEntry]) -> io::Result<()> {
    require_tensor(
        tensors,
        "tok_embeddings.weight",
        &[header.vocab_size, header.hidden_size],
    )?;
    require_tensor(tensors, "norm.weight", &[header.hidden_size])?;
    if header.flags & 1 == 0 {
        require_tensor(
            tensors,
            "output.weight",
            &[header.vocab_size, header.hidden_size],
        )?;
    }
    let query_projection_rows = header
        .head_count
        .checked_mul(header.head_dim)
        .ok_or_else(|| invalid("query projection width overflow"))?;
    let mut qk_norm_contract = None;
    let mut qkv_bias_contract = None;
    for layer in 0..header.layer_count {
        let prefix = format!("layers.{layer}");
        let kv_projection_rows = header
            .kv_head_count
            .checked_mul(header.head_dim)
            .ok_or_else(|| invalid("key/value projection width overflow"))?;
        require_tensor(
            tensors,
            &format!("{prefix}.attention_norm.weight"),
            &[header.hidden_size],
        )?;
        require_tensor(
            tensors,
            &format!("{prefix}.ffn_norm.weight"),
            &[header.hidden_size],
        )?;
        require_tensor(
            tensors,
            &format!("{prefix}.wq.weight"),
            &[query_projection_rows, header.hidden_size],
        )?;
        let q_bias = tensor_exists(tensors, &format!("{prefix}.wq.bias"));
        let k_bias = tensor_exists(tensors, &format!("{prefix}.wk.bias"));
        let v_bias = tensor_exists(tensors, &format!("{prefix}.wv.bias"));
        if q_bias != k_bias || q_bias != v_bias {
            return Err(invalid(
                "query, key, and value projection biases must be declared as a set",
            ));
        }
        if qkv_bias_contract
            .replace(q_bias)
            .is_some_and(|seen| seen != q_bias)
        {
            return Err(invalid(
                "all transformer layers must use the same projection-bias contract",
            ));
        }
        if q_bias {
            require_f32_tensor(
                tensors,
                &format!("{prefix}.wq.bias"),
                &[query_projection_rows],
            )?;
            require_f32_tensor(tensors, &format!("{prefix}.wk.bias"), &[kv_projection_rows])?;
            require_f32_tensor(tensors, &format!("{prefix}.wv.bias"), &[kv_projection_rows])?;
        }
        let q_norm = tensor_exists(tensors, &format!("{prefix}.q_norm.weight"));
        let k_norm = tensor_exists(tensors, &format!("{prefix}.k_norm.weight"));
        if q_norm != k_norm {
            return Err(invalid(
                "query and key RMSNorm tensors must be declared as a pair",
            ));
        }
        if qk_norm_contract
            .replace(q_norm)
            .is_some_and(|seen| seen != q_norm)
        {
            return Err(invalid(
                "all transformer layers must use the same query/key RMSNorm contract",
            ));
        }
        if q_norm {
            require_tensor(
                tensors,
                &format!("{prefix}.q_norm.weight"),
                &[header.head_dim],
            )?;
            require_tensor(
                tensors,
                &format!("{prefix}.k_norm.weight"),
                &[header.head_dim],
            )?;
        }
        require_tensor(
            tensors,
            &format!("{prefix}.wk.weight"),
            &[kv_projection_rows, header.hidden_size],
        )?;
        require_tensor(
            tensors,
            &format!("{prefix}.wv.weight"),
            &[kv_projection_rows, header.hidden_size],
        )?;
        require_tensor(
            tensors,
            &format!("{prefix}.wo.weight"),
            &[header.hidden_size, query_projection_rows],
        )?;
        require_tensor(
            tensors,
            &format!("{prefix}.w1.weight"),
            &[header.ffn_size, header.hidden_size],
        )?;
        require_tensor(
            tensors,
            &format!("{prefix}.w2.weight"),
            &[header.hidden_size, header.ffn_size],
        )?;
        require_tensor(
            tensors,
            &format!("{prefix}.w3.weight"),
            &[header.ffn_size, header.hidden_size],
        )?;
    }
    Ok(())
}

fn tensor_exists(tensors: &[TensorEntry], name: &str) -> bool {
    let hash = name_hash(name);
    tensors.iter().any(|entry| entry.name_hash == hash)
}

fn require_tensor(tensors: &[TensorEntry], name: &str, expected_dims: &[u32]) -> io::Result<()> {
    let hash = name_hash(name);
    let tensor = tensors
        .iter()
        .find(|entry| entry.name_hash == hash)
        .ok_or_else(|| invalid(&format!("missing required tensor {name}")))?;
    if dims(tensor) != expected_dims {
        return Err(invalid(&format!("shape mismatch for tensor {name}")));
    }
    Ok(())
}

fn require_f32_tensor(
    tensors: &[TensorEntry],
    name: &str,
    expected_dims: &[u32],
) -> io::Result<()> {
    let hash = name_hash(name);
    let tensor = tensors
        .iter()
        .find(|entry| entry.name_hash == hash)
        .ok_or_else(|| invalid(&format!("missing required tensor {name}")))?;
    if tensor.dtype != DTYPE_F32 {
        return Err(invalid(&format!("tensor {name} must use f32 dtype")));
    }
    if dims(tensor) != expected_dims {
        return Err(invalid(&format!("shape mismatch for tensor {name}")));
    }
    Ok(())
}

fn validate_tensor_payloads(bytes: &[u8], tensors: &[TensorEntry]) -> io::Result<()> {
    for tensor in tensors {
        match tensor.dtype {
            DTYPE_F32 => validate_f32_payload(bytes, tensor)?,
            DTYPE_Q8_0 => validate_scales(bytes, tensor.scale_offset, rows(tensor)?)?,
            DTYPE_Q4_0 => {
                let block = tensor.block_size as usize;
                let scale_count = rows(tensor)?
                    .checked_mul(cols_per_row(tensor)? / block)
                    .ok_or_else(|| invalid("q4_0 scale count overflow"))?;
                validate_scales(bytes, tensor.scale_offset, scale_count)?;
            }
            DTYPE_Q5_0 => {
                let block = tensor.block_size as usize;
                let scale_count = rows(tensor)?
                    .checked_mul(cols_per_row(tensor)? / block)
                    .ok_or_else(|| invalid("q5_0 scale count overflow"))?;
                validate_scales(bytes, tensor.scale_offset, scale_count)?;
            }
            _ => return Err(invalid("unsupported tensor dtype")),
        }
    }
    Ok(())
}

fn validate_f32_payload(bytes: &[u8], tensor: &TensorEntry) -> io::Result<()> {
    let start = as_usize(tensor.byte_offset)?;
    let len = as_usize(tensor.byte_length)?;
    let payload = bytes
        .get(start..start + len)
        .ok_or_else(|| invalid("f32 tensor payload escapes the file"))?;
    for chunk in payload.chunks_exact(4) {
        let value = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        if !value.is_finite() {
            return Err(invalid("f32 tensor payload contains non-finite values"));
        }
    }
    Ok(())
}

fn validate_scales(bytes: &[u8], scale_offset: u64, count: usize) -> io::Result<()> {
    let start = as_usize(scale_offset)?;
    let len = count
        .checked_mul(4)
        .ok_or_else(|| invalid("scale payload length overflow"))?;
    let payload = bytes
        .get(start..start + len)
        .ok_or_else(|| invalid("scale payload escapes the file"))?;
    for chunk in payload.chunks_exact(4) {
        let value = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        if !value.is_finite() || value <= 0.0 {
            return Err(invalid(
                "quantization scale payload contains non-positive values",
            ));
        }
    }
    Ok(())
}

fn expected_payload_len(tensor: &TensorEntry) -> io::Result<u64> {
    let elements = element_count(tensor);
    match tensor.dtype {
        DTYPE_F32 => elements
            .checked_mul(4)
            .ok_or_else(|| invalid("f32 payload length overflow")),
        DTYPE_Q8_0 => Ok(elements),
        DTYPE_Q4_0 => {
            if !elements.is_multiple_of(2) {
                return Err(invalid("q4_0 tensor element count must be even"));
            }
            Ok(elements / 2)
        }
        DTYPE_Q5_0 => {
            if !elements.is_multiple_of(8) {
                return Err(invalid(
                    "q5_0 tensor element count must divide into eight-code groups",
                ));
            }
            elements
                .checked_mul(5)
                .ok_or_else(|| invalid("q5_0 payload length overflow"))
                .map(|bits| bits / 8)
        }
        _ => Err(invalid("unsupported tensor dtype")),
    }
}

fn element_count(tensor: &TensorEntry) -> u64 {
    let mut total = 1u64;
    for dim in tensor.dims.iter().take(tensor.rank as usize) {
        total = total.saturating_mul(u64::from(*dim));
    }
    total
}

fn rows(tensor: &TensorEntry) -> io::Result<usize> {
    if tensor.rank <= 1 {
        Ok(1)
    } else {
        as_usize(u64::from(tensor.dims[0]))
    }
}

fn cols_per_row(tensor: &TensorEntry) -> io::Result<usize> {
    if tensor.rank <= 1 {
        return as_usize(element_count(tensor));
    }
    let mut cols = 1u64;
    for dim in tensor.dims.iter().skip(1).take(tensor.rank as usize - 1) {
        cols = cols
            .checked_mul(u64::from(*dim))
            .ok_or_else(|| invalid("columns per row overflow"))?;
    }
    as_usize(cols)
}

fn dims(tensor: &TensorEntry) -> Vec<u32> {
    tensor
        .dims
        .iter()
        .take(tensor.rank as usize)
        .copied()
        .collect()
}

fn quantization_label(tensors: &[TensorEntry]) -> &'static str {
    let mut has_f32 = false;
    let mut has_q8 = false;
    let mut has_q4 = false;
    let mut has_q5 = false;
    for tensor in tensors {
        match tensor.dtype {
            DTYPE_F32 => has_f32 = true,
            DTYPE_Q8_0 => has_q8 = true,
            DTYPE_Q4_0 => has_q4 = true,
            DTYPE_Q5_0 => has_q5 = true,
            _ => {}
        }
    }
    match (has_f32, has_q8, has_q5, has_q4) {
        (true, false, false, false) => "f32",
        (false, true, false, false) => "q8_0",
        (false, false, true, false) => "q5_0",
        (false, false, false, true) => "q4_0",
        _ => "mixed",
    }
}

fn tokenizer_checksum(bytes: &[u8], header: &SlmHeader) -> io::Result<u64> {
    let start = as_usize(header.tokenizer_offset)?;
    let len = as_usize(header.tokenizer_length)?;
    let end = start
        .checked_add(len)
        .ok_or_else(|| invalid("tokenizer checksum range overflow"))?;
    let section = bytes
        .get(start..end)
        .ok_or_else(|| invalid("tokenizer checksum range escapes the file"))?;
    Ok(section_checksum(section, 0x746f6b656e697a65))
}

fn tensor_layout_checksum(tensors: &[TensorEntry]) -> u64 {
    let mut sorted = tensors.iter().collect::<Vec<_>>();
    sorted.sort_by_key(|tensor| tensor.name_hash);
    let mut acc = 0x74656e736f722d6cu64;
    for tensor in sorted {
        mix_u64(&mut acc, tensor.name_hash);
        mix_u64(&mut acc, u64::from(tensor.dtype));
        mix_u64(&mut acc, u64::from(tensor.rank));
        for dim in tensor.dims {
            mix_u64(&mut acc, u64::from(dim));
        }
        mix_u64(&mut acc, u64::from(tensor.block_size));
        mix_u64(&mut acc, tensor.byte_length);
    }
    acc
}

fn section_checksum(bytes: &[u8], seed: u64) -> u64 {
    let mut acc = seed;
    for (index, byte) in bytes.iter().enumerate() {
        acc ^= u64::from(*byte).wrapping_add((index as u64) << 2);
        acc = acc.rotate_left(9).wrapping_mul(0x100000001b3);
    }
    acc
}

fn mix_u64(acc: &mut u64, value: u64) {
    for byte in value.to_le_bytes() {
        *acc ^= u64::from(byte);
        *acc = acc.rotate_left(11).wrapping_mul(0x100000001b3);
    }
}

fn read_u32(bytes: &[u8], offset: usize) -> io::Result<u32> {
    let end = offset
        .checked_add(4)
        .ok_or_else(|| invalid("u32 offset overflow"))?;
    let slice = bytes
        .get(offset..end)
        .ok_or_else(|| invalid("unexpected end while reading u32"))?;
    Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn read_u64(bytes: &[u8], offset: usize) -> io::Result<u64> {
    let end = offset
        .checked_add(8)
        .ok_or_else(|| invalid("u64 offset overflow"))?;
    let slice = bytes
        .get(offset..end)
        .ok_or_else(|| invalid("unexpected end while reading u64"))?;
    Ok(u64::from_le_bytes([
        slice[0], slice[1], slice[2], slice[3], slice[4], slice[5], slice[6], slice[7],
    ]))
}

fn range_within(file_len: usize, offset: u64, len: u64) -> bool {
    let Some(end) = offset.checked_add(len) else {
        return false;
    };
    end <= file_len as u64
}

fn simple_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x9e3779b97f4a7c15u64;
    for (index, byte) in bytes.iter().enumerate() {
        let value = if (100..108).contains(&index) {
            0
        } else {
            *byte
        };
        acc ^= u64::from(value).wrapping_add((index as u64) << 1);
        acc = acc.rotate_left(7).wrapping_mul(0x100000001b3);
    }
    acc
}

fn name_hash(name: &str) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in name.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn as_usize(value: u64) -> io::Result<usize> {
    usize::try_from(value).map_err(|_| invalid("value does not fit in usize"))
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tensor_writer::{
        tensors_for_shape, tensors_for_shape_with_qk_norm_and_tied_output,
        tensors_for_shape_with_qkv_bias_and_tied_output, tiny_fixture_tensors,
        tiny_fixture_tied_tensors, ModelShape, DTYPE_F32, DTYPE_Q5_0,
    };
    use crate::tokenizer_writer::{
        BpeMergeSpec, BpeTokenSpec, ByteTokenizerSection, TokenizerSection,
    };
    use crate::{build_model_file, build_model_file_with_flags};

    const FLAG_TIED_OUTPUT: u32 = 1;

    #[test]
    fn validates_generated_tiny_fixture() {
        let bytes = build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors(),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap();
        let report = validate_bytes(&bytes, "memory.slm").unwrap();
        assert_eq!(report.header.hidden_size, 8);
        assert_eq!(report.tensors.len(), 12);
        assert_eq!(report.quantization_label, "f32");
        assert_eq!(report.tokenizer_label(), "byte-v1");
        assert_ne!(report.tokenizer_checksum(), 0);
        assert_ne!(report.tensor_layout_checksum(), 0);
        assert_eq!(report.context_token_limit(), 16);
    }

    #[test]
    fn validates_generated_q5_fixture_without_decoded_shadow_payloads() {
        let shape = ModelShape::tiny_fixture();
        let bytes = build_model_file(
            &shape,
            &tensors_for_shape(&shape, DTYPE_Q5_0),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap();

        let report = validate_bytes(&bytes, "q5.slm").unwrap();

        assert_eq!(report.quantization_label, "q5_0");
        assert!(report
            .tensors
            .iter()
            .all(|tensor| tensor.dtype == DTYPE_Q5_0));
        assert!(report.tensors.iter().all(|tensor| tensor.block_size >= 8));
    }

    #[test]
    fn validates_tied_output_fixture_without_output_weight() {
        let bytes = build_model_file_with_flags(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tied_tensors(),
            &ByteTokenizerSection::phase_one(),
            FLAG_TIED_OUTPUT,
        )
        .unwrap();
        let report = validate_bytes(&bytes, "tied.slm").unwrap();
        assert_eq!(report.header.flags & FLAG_TIED_OUTPUT, FLAG_TIED_OUTPUT);
        assert_eq!(report.tensors.len(), 11);
        assert!(!report
            .tensors
            .iter()
            .any(|tensor| tensor.name_hash == name_hash("output.weight")));
    }

    #[test]
    fn validates_wide_query_attention_with_paired_qk_norms() {
        let shape = ModelShape {
            head_count: 2,
            kv_head_count: 1,
            head_dim: 8,
            ..ModelShape::tiny_fixture()
        };
        let tensors = tensors_for_shape_with_qk_norm_and_tied_output(&shape, DTYPE_F32);
        let bytes = build_model_file_with_flags(
            &shape,
            &tensors,
            &ByteTokenizerSection::phase_one(),
            FLAG_TIED_OUTPUT,
        )
        .unwrap();

        let report = validate_bytes(&bytes, "wide-query-qk-norm.slm").unwrap();

        assert_eq!(report.tensors.len(), 13);
        assert!(report
            .tensors
            .iter()
            .any(|tensor| tensor.name_hash == name_hash("layers.0.q_norm.weight")));
        assert!(report
            .tensors
            .iter()
            .any(|tensor| tensor.name_hash == name_hash("layers.0.k_norm.weight")));
    }

    #[test]
    fn validates_f32_projection_bias_contract() {
        let shape = ModelShape {
            head_count: 2,
            kv_head_count: 1,
            head_dim: 4,
            ..ModelShape::tiny_fixture()
        };
        let tensors = tensors_for_shape_with_qkv_bias_and_tied_output(&shape, DTYPE_Q4_0);
        let bytes = build_model_file_with_flags(
            &shape,
            &tensors,
            &ByteTokenizerSection::phase_one(),
            FLAG_TIED_OUTPUT,
        )
        .unwrap();

        let report = validate_bytes(&bytes, "projection-bias.slm").unwrap();

        assert_eq!(report.tensors.len(), 14);
        for name in ["layers.0.wq.bias", "layers.0.wk.bias", "layers.0.wv.bias"] {
            let bias = report
                .tensors
                .iter()
                .find(|tensor| tensor.name_hash == name_hash(name))
                .unwrap();
            assert_eq!(bias.dtype, DTYPE_F32);
        }
    }

    #[test]
    fn rejects_partial_projection_bias_contract() {
        let shape = ModelShape::tiny_fixture();
        let mut tensors = tensors_for_shape_with_qkv_bias_and_tied_output(&shape, DTYPE_Q4_0);
        tensors.retain(|tensor| tensor.name_hash != name_hash("layers.0.wv.bias"));
        let bytes = build_model_file_with_flags(
            &shape,
            &tensors,
            &ByteTokenizerSection::phase_one(),
            FLAG_TIED_OUTPUT,
        )
        .unwrap();

        let error = validate_bytes(&bytes, "partial-projection-bias.slm").unwrap_err();

        assert!(error
            .to_string()
            .contains("projection biases must be declared as a set"));
    }

    #[test]
    fn rejects_missing_output_without_tied_flag() {
        let bytes = build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tied_tensors(),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap();
        let error = validate_bytes(&bytes, "missing-output.slm").unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(
            error
                .to_string()
                .contains("missing required tensor output.weight"),
            "{error}"
        );
    }

    #[test]
    fn rejects_non_finite_f32_payload() {
        let mut bytes = build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors(),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap();
        let header = parse_header(&bytes).unwrap();
        let tensors = parse_tensors(&bytes, &header).unwrap();
        let start = tensors[0].byte_offset as usize;
        bytes[start..start + 4].copy_from_slice(&f32::NAN.to_le_bytes());
        bytes[100..108].copy_from_slice(&0u64.to_le_bytes());
        let checksum = simple_checksum(&bytes);
        bytes[100..108].copy_from_slice(&checksum.to_le_bytes());
        let error = validate_bytes(&bytes, "nan.slm").unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn validates_bpe_tokenizer_section_when_vocab_matches_header() {
        let shape = ModelShape {
            vocab_size: 262,
            ..ModelShape::tiny_fixture()
        };
        let bytes = build_model_file(
            &shape,
            &tensors_for_shape(&shape, DTYPE_F32),
            &TokenizerSection::tiny_bpe_demo(),
        )
        .unwrap();
        let report = validate_bytes(&bytes, "bpe.slm").unwrap();
        assert_eq!(report.header.vocab_size, 262);
        assert_eq!(report.tokenizer_label(), "bpe-v1");
        assert_eq!(report.tensors.len(), 12);
    }

    #[test]
    fn validates_llama_bpe_tokenizer_section_when_vocab_matches_header() {
        let shape = ModelShape {
            vocab_size: 264,
            ..ModelShape::tiny_fixture()
        };
        let tokenizer = TokenizerSection::llama_bpe_from_parts(
            shape.vocab_size,
            1,
            2,
            2,
            0,
            3,
            &[
                BpeTokenSpec {
                    id: 259,
                    bytes: "▁".as_bytes().to_vec(),
                },
                BpeTokenSpec {
                    id: 260,
                    bytes: b"h".to_vec(),
                },
                BpeTokenSpec {
                    id: 261,
                    bytes: b"i".to_vec(),
                },
                BpeTokenSpec {
                    id: 262,
                    bytes: "▁h".as_bytes().to_vec(),
                },
                BpeTokenSpec {
                    id: 263,
                    bytes: "▁hi".as_bytes().to_vec(),
                },
            ],
            &[
                BpeMergeSpec {
                    left: 259,
                    right: 260,
                    output: 262,
                    rank: 0,
                },
                BpeMergeSpec {
                    left: 262,
                    right: 261,
                    output: 263,
                    rank: 1,
                },
            ],
        );
        let bytes =
            build_model_file(&shape, &tensors_for_shape(&shape, DTYPE_F32), &tokenizer).unwrap();
        let report = validate_bytes(&bytes, "llama-bpe.slm").unwrap();
        assert_eq!(report.header.vocab_size, 264);
        assert_eq!(report.tokenizer_label(), "llama-bpe-v1");
    }

    #[test]
    fn rejects_bpe_tokenizer_vocab_drift() {
        let bytes = build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors(),
            &TokenizerSection::tiny_bpe_demo(),
        )
        .unwrap();
        let error = validate_bytes(&bytes, "bpe-drift.slm").unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }
}
