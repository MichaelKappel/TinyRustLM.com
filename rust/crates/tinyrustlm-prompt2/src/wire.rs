use std::collections::HashSet;

use tinyrustlm_sampling2::{Sampling2Config, Sampling2State};
use tinyrustlm_template2::{ControlKind, Role};

use crate::format::{
    align_up, all_zero, get_u16, get_u32, get_u64, put_u16, put_u32, put_u64, Prompt2Error,
    ARTIFACT_BYTES, MAXIMUM_CONTEXT_TOKENS, MAXIMUM_CONTROL_INSERTIONS, MAXIMUM_LOAD_BUNDLE_BYTES,
    MAXIMUM_MESSAGES, MAXIMUM_MESSAGE_CONTENT_BYTES, MAXIMUM_PROMPT_TOKENS, MAXIMUM_RENDERED_BYTES,
    MAXIMUM_REQUEST_BYTES, MAXIMUM_RESULT_BYTES, MAXIMUM_TOTAL_CONTENT_BYTES,
    MODEL_VOCABULARY_SIZE, NONE_U32, SAMPLING_ARTIFACT_BYTES, STOP_TOKEN_IDS,
    TEMPLATE_ARTIFACT_BYTES, TOKENIZER_ARTIFACT_BYTES, TOKENIZER_TOKEN_COUNT, WIRE_HEADER_BYTES,
};

const LOAD_MAGIC: &[u8; 8] = b"P2LD\r\n\x1a\n";
const LOAD_FORMAT_ID: &[u8; 16] = b"minimodel.p2ld\0\0";
const REQUEST_MAGIC: &[u8; 8] = b"P2RQ\r\n\x1a\n";
const REQUEST_FORMAT_ID: &[u8; 16] = b"minimodel.p2rq\0\0";
const RESULT_MAGIC: &[u8; 8] = b"P2RS\r\n\x1a\n";
const RESULT_FORMAT_ID: &[u8; 16] = b"minimodel.p2rs\0\0";
const MESSAGE_RECORD_BYTES: usize = 24;
const INSERTION_RECORD_BYTES: usize = 32;

/// One owned flat string-content message in a Prompt2 request.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Prompt2Message {
    role: Role,
    content: String,
}

impl Prompt2Message {
    /// Creates one exact message without trimming or normalization.
    pub fn new(role: Role, content: String) -> Self {
        Self { role, content }
    }

    /// Returns the exact closed-enum role.
    pub const fn role(&self) -> Role {
        self.role
    }

    /// Returns the exact UTF-8 content.
    pub fn content(&self) -> &str {
        &self.content
    }
}

/// One complete Prompt2 request with no implicit sampling defaults.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Prompt2Request {
    messages: Vec<Prompt2Message>,
    sampling: Sampling2Config,
    seed: u64,
}

impl Prompt2Request {
    /// Validates and creates one complete request.
    ///
    /// Template2 remains authoritative for role ordering and forbidden control
    /// strings when the request is compiled.
    pub fn new(
        messages: Vec<Prompt2Message>,
        sampling: Sampling2Config,
        seed: u64,
    ) -> Result<Self, Prompt2Error> {
        validate_messages(&messages)?;
        Ok(Self {
            messages,
            sampling,
            seed,
        })
    }

    /// Returns all exact messages in order.
    pub fn messages(&self) -> &[Prompt2Message] {
        &self.messages
    }

    /// Returns the complete explicit Sampling2 configuration.
    pub const fn sampling(&self) -> Sampling2Config {
        self.sampling
    }

    /// Returns the caller-supplied u64 seed.
    pub const fn seed(&self) -> u64 {
        self.seed
    }
}

/// One exact Template2 control insertion mapped into rendered bytes and tokens.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MappedControlInsertion {
    /// Semantic insertion kind.
    pub kind: ControlKind,
    /// Source message index, or absence for generation-prefix insertions.
    pub message_index: Option<u32>,
    /// Exact Tokenizer2 token ID represented by the insertion.
    pub token_id: u32,
    /// Zero-based byte offset in the rendered UTF-8 prompt.
    pub byte_offset: u64,
    /// Zero-based token index in the complete prompt token sequence.
    pub token_index: u64,
}

/// Initial state of a Prompt2 generation controller.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Prompt2InitialStatus {
    /// The prompt leaves context capacity and generation may start.
    Active,
    /// The prompt exactly fills the context and no sampling may occur.
    ContextLimit,
}

/// Canonical Prompt2 composition result prior to model execution.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Prompt2Result {
    rendered_utf8: String,
    token_ids: Vec<u32>,
    insertions: Vec<MappedControlInsertion>,
    stop_token_ids: [u32; 2],
    initial_sampling_state: Sampling2State,
    initial_status: Prompt2InitialStatus,
}

impl Prompt2Result {
    pub(crate) fn new(
        rendered_utf8: String,
        token_ids: Vec<u32>,
        insertions: Vec<MappedControlInsertion>,
        stop_token_ids: [u32; 2],
        initial_sampling_state: Sampling2State,
        initial_status: Prompt2InitialStatus,
    ) -> Result<Self, Prompt2Error> {
        let result = Self {
            rendered_utf8,
            token_ids,
            insertions,
            stop_token_ids,
            initial_sampling_state,
            initial_status,
        };
        validate_result(&result)?;
        Ok(result)
    }

    /// Returns the exact rendered UTF-8 prompt.
    pub fn rendered_utf8(&self) -> &str {
        &self.rendered_utf8
    }

    /// Returns the exact complete prompt token sequence.
    pub fn token_ids(&self) -> &[u32] {
        &self.token_ids
    }

    /// Returns all exact mapped control insertions.
    pub fn insertions(&self) -> &[MappedControlInsertion] {
        &self.insertions
    }

    /// Returns the exact ordered Template2 stop-token set.
    pub const fn stop_token_ids(&self) -> [u32; 2] {
        self.stop_token_ids
    }

    /// Returns the initial exact Sampling2 state.
    pub const fn initial_sampling_state(&self) -> Sampling2State {
        self.initial_sampling_state
    }

    /// Returns whether generation is initially active or context-limited.
    pub const fn initial_status(&self) -> Prompt2InitialStatus {
        self.initial_status
    }
}

/// Borrowed exact sections of one Prompt2 load bundle.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Prompt2LoadBundle<'a> {
    prompt2: &'a [u8],
    tokenizer2: &'a [u8],
    template2: &'a [u8],
    sampling2: &'a [u8],
}

impl<'a> Prompt2LoadBundle<'a> {
    /// Creates one length-valid load bundle view.
    pub fn new(
        prompt2: &'a [u8],
        tokenizer2: &'a [u8],
        template2: &'a [u8],
        sampling2: &'a [u8],
    ) -> Result<Self, Prompt2Error> {
        if prompt2.len() != ARTIFACT_BYTES
            || tokenizer2.len() != TOKENIZER_ARTIFACT_BYTES
            || template2.len() != TEMPLATE_ARTIFACT_BYTES
            || sampling2.len() != SAMPLING_ARTIFACT_BYTES
        {
            return Err(Prompt2Error::new("prompt2-load-bundle"));
        }
        Ok(Self {
            prompt2,
            tokenizer2,
            template2,
            sampling2,
        })
    }

    /// Returns the exact Prompt2 artifact bytes.
    pub const fn prompt2(self) -> &'a [u8] {
        self.prompt2
    }

    /// Returns the exact Tokenizer2 artifact bytes.
    pub const fn tokenizer2(self) -> &'a [u8] {
        self.tokenizer2
    }

    /// Returns the exact Template2 artifact bytes.
    pub const fn template2(self) -> &'a [u8] {
        self.template2
    }

    /// Returns the exact Sampling2 artifact bytes.
    pub const fn sampling2(self) -> &'a [u8] {
        self.sampling2
    }
}

/// Serializes one exact contiguous Prompt2 load bundle.
pub fn write_load_bundle(bundle: Prompt2LoadBundle<'_>) -> Result<Vec<u8>, Prompt2Error> {
    let prompt_offset = WIRE_HEADER_BYTES;
    let tokenizer_offset = checked_add(prompt_offset, ARTIFACT_BYTES)?;
    let template_offset = checked_add(tokenizer_offset, TOKENIZER_ARTIFACT_BYTES)?;
    let sampling_offset = checked_add(template_offset, TEMPLATE_ARTIFACT_BYTES)?;
    let file_bytes = checked_add(sampling_offset, SAMPLING_ARTIFACT_BYTES)?;
    if file_bytes > MAXIMUM_LOAD_BUNDLE_BYTES {
        return Err(Prompt2Error::new("prompt2-load-bundle"));
    }
    let mut output = vec![0_u8; file_bytes];
    write_wire_header(&mut output, LOAD_MAGIC, LOAD_FORMAT_ID, file_bytes)?;
    put_u64(&mut output, 48, prompt_offset as u64)?;
    put_u64(&mut output, 56, ARTIFACT_BYTES as u64)?;
    put_u64(&mut output, 64, tokenizer_offset as u64)?;
    put_u64(&mut output, 72, TOKENIZER_ARTIFACT_BYTES as u64)?;
    put_u64(&mut output, 80, template_offset as u64)?;
    put_u64(&mut output, 88, TEMPLATE_ARTIFACT_BYTES as u64)?;
    put_u64(&mut output, 96, sampling_offset as u64)?;
    put_u64(&mut output, 104, SAMPLING_ARTIFACT_BYTES as u64)?;
    output[prompt_offset..tokenizer_offset].copy_from_slice(bundle.prompt2);
    output[tokenizer_offset..template_offset].copy_from_slice(bundle.tokenizer2);
    output[template_offset..sampling_offset].copy_from_slice(bundle.template2);
    output[sampling_offset..file_bytes].copy_from_slice(bundle.sampling2);
    Ok(output)
}

/// Parses exact contiguous Prompt2 load-bundle geometry without validating dependencies.
///
/// `Prompt2Runtime::from_load_bundle` is the fail-closed operation that also
/// validates all four bound artifact identities.
pub fn parse_load_bundle(
    bytes: &[u8],
    maximum_bytes: usize,
) -> Result<Prompt2LoadBundle<'_>, Prompt2Error> {
    if maximum_bytes == 0 || maximum_bytes > MAXIMUM_LOAD_BUNDLE_BYTES {
        return Err(Prompt2Error::new("prompt2-policy"));
    }
    validate_wire_header(
        bytes,
        maximum_bytes,
        LOAD_MAGIC,
        LOAD_FORMAT_ID,
        "prompt2-load-bundle",
    )?;
    if !all_zero(
        bytes
            .get(112..WIRE_HEADER_BYTES)
            .ok_or_else(|| Prompt2Error::new("prompt2-load-bundle"))?,
    ) {
        return Err(Prompt2Error::new("prompt2-load-bundle"));
    }
    let entries = [
        (get_u64(bytes, 48)?, get_u64(bytes, 56)?, ARTIFACT_BYTES),
        (
            get_u64(bytes, 64)?,
            get_u64(bytes, 72)?,
            TOKENIZER_ARTIFACT_BYTES,
        ),
        (
            get_u64(bytes, 80)?,
            get_u64(bytes, 88)?,
            TEMPLATE_ARTIFACT_BYTES,
        ),
        (
            get_u64(bytes, 96)?,
            get_u64(bytes, 104)?,
            SAMPLING_ARTIFACT_BYTES,
        ),
    ];
    let mut cursor = WIRE_HEADER_BYTES;
    let mut ranges = [(0_usize, 0_usize); 4];
    for (index, (offset, length, expected_length)) in entries.into_iter().enumerate() {
        let offset = usize_from_u64(offset, "prompt2-load-bundle")?;
        let length = usize_from_u64(length, "prompt2-load-bundle")?;
        let end = checked_add(offset, length)?;
        if offset != cursor || length != expected_length || end > bytes.len() {
            return Err(Prompt2Error::new("prompt2-load-bundle"));
        }
        ranges[index] = (offset, end);
        cursor = end;
    }
    if cursor != bytes.len() {
        return Err(Prompt2Error::new("prompt2-load-bundle"));
    }
    Prompt2LoadBundle::new(
        &bytes[ranges[0].0..ranges[0].1],
        &bytes[ranges[1].0..ranges[1].1],
        &bytes[ranges[2].0..ranges[2].1],
        &bytes[ranges[3].0..ranges[3].1],
    )
}

/// Serializes one canonical Prompt2 request.
pub fn write_request(request: &Prompt2Request) -> Result<Vec<u8>, Prompt2Error> {
    let total_content_bytes = validate_messages(&request.messages)?;
    let message_table_offset = WIRE_HEADER_BYTES;
    let table_bytes = request
        .messages
        .len()
        .checked_mul(MESSAGE_RECORD_BYTES)
        .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?;
    let table_end = checked_add(message_table_offset, table_bytes)?;
    let content_offset = align_up(table_end)?;
    let file_bytes = checked_add(content_offset, total_content_bytes)?;
    if file_bytes > MAXIMUM_REQUEST_BYTES {
        return Err(Prompt2Error::new("prompt2-request-limit"));
    }
    let mut output = vec![0_u8; file_bytes];
    write_wire_header(&mut output, REQUEST_MAGIC, REQUEST_FORMAT_ID, file_bytes)?;
    put_u64(&mut output, 48, message_table_offset as u64)?;
    put_u32(&mut output, 56, request.messages.len() as u32)?;
    put_u32(&mut output, 60, MESSAGE_RECORD_BYTES as u32)?;
    put_u64(&mut output, 64, content_offset as u64)?;
    put_u64(&mut output, 72, total_content_bytes as u64)?;
    put_u32(&mut output, 80, request.sampling.temperature_millionths())?;
    put_u32(&mut output, 84, request.sampling.top_k())?;
    put_u32(&mut output, 88, request.sampling.top_p_millionths())?;
    put_u32(
        &mut output,
        92,
        request.sampling.repetition_penalty_millionths(),
    )?;
    put_u32(&mut output, 96, request.sampling.repetition_window())?;
    put_u32(&mut output, 100, request.sampling.maximum_new_tokens())?;
    put_u64(&mut output, 104, request.seed)?;
    let mut relative_offset = 0_usize;
    for (index, message) in request.messages.iter().enumerate() {
        let record_offset = message_table_offset + index * MESSAGE_RECORD_BYTES;
        put_u16(&mut output, record_offset, role_id(message.role))?;
        put_u16(&mut output, record_offset + 2, 0)?;
        put_u32(&mut output, record_offset + 4, index as u32)?;
        put_u64(&mut output, record_offset + 8, relative_offset as u64)?;
        put_u64(
            &mut output,
            record_offset + 16,
            message.content.len() as u64,
        )?;
        let content_end = checked_add(relative_offset, message.content.len())?;
        output[content_offset + relative_offset..content_offset + content_end]
            .copy_from_slice(message.content.as_bytes());
        relative_offset = content_end;
    }
    Ok(output)
}

/// Parses and validates one canonical Prompt2 request.
pub fn parse_request(bytes: &[u8], maximum_bytes: usize) -> Result<Prompt2Request, Prompt2Error> {
    if maximum_bytes == 0 || maximum_bytes > MAXIMUM_REQUEST_BYTES {
        return Err(Prompt2Error::new("prompt2-policy"));
    }
    if bytes.len() < WIRE_HEADER_BYTES || bytes.len() > maximum_bytes {
        return Err(Prompt2Error::new("prompt2-request-limit"));
    }
    validate_wire_header(
        bytes,
        maximum_bytes,
        REQUEST_MAGIC,
        REQUEST_FORMAT_ID,
        "prompt2-request-header",
    )?;
    if !all_zero(
        bytes
            .get(112..WIRE_HEADER_BYTES)
            .ok_or_else(|| Prompt2Error::new("prompt2-request-header"))?,
    ) {
        return Err(Prompt2Error::new("prompt2-request-header"));
    }
    let table_offset = usize_from_u64(get_u64(bytes, 48)?, "prompt2-request-layout")?;
    let message_count = get_u32(bytes, 56)?;
    let record_bytes = get_u32(bytes, 60)?;
    let content_offset = usize_from_u64(get_u64(bytes, 64)?, "prompt2-request-layout")?;
    let content_bytes = usize_from_u64(get_u64(bytes, 72)?, "prompt2-request-layout")?;
    if table_offset != WIRE_HEADER_BYTES
        || message_count == 0
        || message_count > MAXIMUM_MESSAGES
        || record_bytes as usize != MESSAGE_RECORD_BYTES
    {
        return Err(Prompt2Error::new("prompt2-request-layout"));
    }
    let table_bytes = (message_count as usize)
        .checked_mul(MESSAGE_RECORD_BYTES)
        .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?;
    let table_end = checked_add(table_offset, table_bytes)?;
    let expected_content_offset = align_up(table_end)?;
    let content_end = checked_add(content_offset, content_bytes)?;
    if content_offset != expected_content_offset
        || content_bytes > MAXIMUM_TOTAL_CONTENT_BYTES as usize
        || content_end != bytes.len()
        || !all_zero(
            bytes
                .get(table_end..content_offset)
                .ok_or_else(|| Prompt2Error::new("prompt2-request-layout"))?,
        )
    {
        return Err(Prompt2Error::new("prompt2-request-layout"));
    }
    let mut messages = Vec::with_capacity(message_count as usize);
    let mut expected_relative_offset = 0_usize;
    for index in 0..message_count as usize {
        let record_offset = table_offset + index * MESSAGE_RECORD_BYTES;
        let role = role_from_id(get_u16(bytes, record_offset)?)?;
        let flags = get_u16(bytes, record_offset + 2)?;
        let record_index = get_u32(bytes, record_offset + 4)?;
        let relative_offset =
            usize_from_u64(get_u64(bytes, record_offset + 8)?, "prompt2-request-layout")?;
        let length = usize_from_u64(
            get_u64(bytes, record_offset + 16)?,
            "prompt2-request-layout",
        )?;
        let relative_end = checked_add(relative_offset, length)?;
        if flags != 0
            || record_index as usize != index
            || relative_offset != expected_relative_offset
            || length > MAXIMUM_MESSAGE_CONTENT_BYTES as usize
            || relative_end > content_bytes
        {
            return Err(Prompt2Error::new("prompt2-request-layout"));
        }
        let absolute_start = checked_add(content_offset, relative_offset)?;
        let absolute_end = checked_add(content_offset, relative_end)?;
        let content = std::str::from_utf8(
            bytes
                .get(absolute_start..absolute_end)
                .ok_or_else(|| Prompt2Error::new("prompt2-request-layout"))?,
        )
        .map_err(|_| Prompt2Error::new("prompt2-request-utf8"))?;
        messages.push(Prompt2Message::new(role, content.to_owned()));
        expected_relative_offset = relative_end;
    }
    if expected_relative_offset != content_bytes {
        return Err(Prompt2Error::new("prompt2-request-layout"));
    }
    let sampling = Sampling2Config::new(
        get_u32(bytes, 80)?,
        get_u32(bytes, 84)?,
        get_u32(bytes, 88)?,
        get_u32(bytes, 92)?,
        get_u32(bytes, 96)?,
        get_u32(bytes, 100)?,
    )
    .map_err(|_| Prompt2Error::new("prompt2-sampling"))?;
    Prompt2Request::new(messages, sampling, get_u64(bytes, 104)?)
}

/// Serializes one canonical Prompt2 composition result.
pub fn write_result(result: &Prompt2Result) -> Result<Vec<u8>, Prompt2Error> {
    validate_result(result)?;
    let rendered_offset = WIRE_HEADER_BYTES;
    let rendered_end = checked_add(rendered_offset, result.rendered_utf8.len())?;
    let token_offset = align_up(rendered_end)?;
    let token_bytes = result
        .token_ids
        .len()
        .checked_mul(4)
        .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?;
    let token_end = checked_add(token_offset, token_bytes)?;
    let insertion_offset = align_up(token_end)?;
    let insertion_bytes = result
        .insertions
        .len()
        .checked_mul(INSERTION_RECORD_BYTES)
        .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?;
    let insertion_end = checked_add(insertion_offset, insertion_bytes)?;
    let stop_offset = align_up(insertion_end)?;
    let stop_end = checked_add(stop_offset, STOP_TOKEN_IDS.len() * 4)?;
    let state_offset = align_up(stop_end)?;
    let file_bytes = checked_add(state_offset, 40)?;
    if file_bytes > MAXIMUM_RESULT_BYTES {
        return Err(Prompt2Error::new("prompt2-result-limit"));
    }
    let mut output = vec![0_u8; file_bytes];
    write_wire_header(&mut output, RESULT_MAGIC, RESULT_FORMAT_ID, file_bytes)?;
    put_u64(&mut output, 48, rendered_offset as u64)?;
    put_u64(&mut output, 56, result.rendered_utf8.len() as u64)?;
    put_u64(&mut output, 64, token_offset as u64)?;
    put_u32(&mut output, 72, result.token_ids.len() as u32)?;
    put_u32(&mut output, 76, 4)?;
    put_u64(&mut output, 80, insertion_offset as u64)?;
    put_u32(&mut output, 88, result.insertions.len() as u32)?;
    put_u32(&mut output, 92, INSERTION_RECORD_BYTES as u32)?;
    put_u64(&mut output, 96, stop_offset as u64)?;
    put_u32(&mut output, 104, STOP_TOKEN_IDS.len() as u32)?;
    put_u32(&mut output, 108, 4)?;
    put_u64(&mut output, 112, state_offset as u64)?;
    put_u32(&mut output, 120, 40)?;
    put_u16(
        &mut output,
        124,
        match result.initial_status {
            Prompt2InitialStatus::Active => 1,
            Prompt2InitialStatus::ContextLimit => 2,
        },
    )?;
    output[rendered_offset..rendered_end].copy_from_slice(result.rendered_utf8.as_bytes());
    for (index, token_id) in result.token_ids.iter().copied().enumerate() {
        put_u32(&mut output, token_offset + index * 4, token_id)?;
    }
    for (index, insertion) in result.insertions.iter().copied().enumerate() {
        let offset = insertion_offset + index * INSERTION_RECORD_BYTES;
        put_u16(&mut output, offset, control_kind_id(insertion.kind))?;
        put_u16(&mut output, offset + 2, 0)?;
        put_u32(
            &mut output,
            offset + 4,
            insertion.message_index.unwrap_or(NONE_U32),
        )?;
        put_u32(&mut output, offset + 8, insertion.token_id)?;
        put_u32(&mut output, offset + 12, 0)?;
        put_u64(&mut output, offset + 16, insertion.byte_offset)?;
        put_u64(&mut output, offset + 24, insertion.token_index)?;
    }
    for (index, token_id) in result.stop_token_ids.iter().copied().enumerate() {
        put_u32(&mut output, stop_offset + index * 4, token_id)?;
    }
    output[state_offset..state_offset + 40]
        .copy_from_slice(&result.initial_sampling_state.to_bytes());
    Ok(output)
}

/// Parses and semantically validates one canonical Prompt2 composition result.
pub fn parse_result(bytes: &[u8], maximum_bytes: usize) -> Result<Prompt2Result, Prompt2Error> {
    if maximum_bytes == 0 || maximum_bytes > MAXIMUM_RESULT_BYTES {
        return Err(Prompt2Error::new("prompt2-policy"));
    }
    if bytes.len() < WIRE_HEADER_BYTES || bytes.len() > maximum_bytes {
        return Err(Prompt2Error::new("prompt2-result-limit"));
    }
    validate_wire_header(
        bytes,
        maximum_bytes,
        RESULT_MAGIC,
        RESULT_FORMAT_ID,
        "prompt2-result-header",
    )?;
    if get_u16(bytes, 126)? != 0 {
        return Err(Prompt2Error::new("prompt2-result-header"));
    }
    let rendered_offset = usize_from_u64(get_u64(bytes, 48)?, "prompt2-result-layout")?;
    let rendered_bytes = usize_from_u64(get_u64(bytes, 56)?, "prompt2-result-layout")?;
    let token_offset = usize_from_u64(get_u64(bytes, 64)?, "prompt2-result-layout")?;
    let token_count = get_u32(bytes, 72)? as usize;
    let token_record_bytes = get_u32(bytes, 76)? as usize;
    let insertion_offset = usize_from_u64(get_u64(bytes, 80)?, "prompt2-result-layout")?;
    let insertion_count = get_u32(bytes, 88)? as usize;
    let insertion_record_bytes = get_u32(bytes, 92)? as usize;
    let stop_offset = usize_from_u64(get_u64(bytes, 96)?, "prompt2-result-layout")?;
    let stop_count = get_u32(bytes, 104)? as usize;
    let stop_record_bytes = get_u32(bytes, 108)? as usize;
    let state_offset = usize_from_u64(get_u64(bytes, 112)?, "prompt2-result-layout")?;
    let state_bytes = get_u32(bytes, 120)? as usize;
    let initial_status = match get_u16(bytes, 124)? {
        1 => Prompt2InitialStatus::Active,
        2 => Prompt2InitialStatus::ContextLimit,
        _ => return Err(Prompt2Error::new("prompt2-result-layout")),
    };
    let rendered_end = checked_add(rendered_offset, rendered_bytes)?;
    let token_end = checked_add(
        token_offset,
        token_count
            .checked_mul(4)
            .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?,
    )?;
    let insertion_end = checked_add(
        insertion_offset,
        insertion_count
            .checked_mul(INSERTION_RECORD_BYTES)
            .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?,
    )?;
    let stop_end = checked_add(
        stop_offset,
        stop_count
            .checked_mul(4)
            .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))?,
    )?;
    let state_end = checked_add(state_offset, state_bytes)?;
    let geometry_valid = rendered_offset == WIRE_HEADER_BYTES
        && rendered_bytes <= MAXIMUM_RENDERED_BYTES as usize
        && token_offset == align_up(rendered_end)?
        && token_count <= MAXIMUM_PROMPT_TOKENS as usize
        && token_record_bytes == 4
        && insertion_offset == align_up(token_end)?
        && insertion_count <= MAXIMUM_CONTROL_INSERTIONS as usize
        && insertion_record_bytes == INSERTION_RECORD_BYTES
        && stop_offset == align_up(insertion_end)?
        && stop_count == STOP_TOKEN_IDS.len()
        && stop_record_bytes == 4
        && state_offset == align_up(stop_end)?
        && state_bytes == 40
        && state_end == bytes.len();
    if !geometry_valid
        || !zero_range(bytes, rendered_end, token_offset)?
        || !zero_range(bytes, token_end, insertion_offset)?
        || !zero_range(bytes, insertion_end, stop_offset)?
        || !zero_range(bytes, stop_end, state_offset)?
    {
        return Err(Prompt2Error::new("prompt2-result-layout"));
    }
    let rendered_utf8 = std::str::from_utf8(
        bytes
            .get(rendered_offset..rendered_end)
            .ok_or_else(|| Prompt2Error::new("prompt2-result-layout"))?,
    )
    .map_err(|_| Prompt2Error::new("prompt2-result-layout"))?
    .to_owned();
    let mut token_ids = Vec::with_capacity(token_count);
    for index in 0..token_count {
        let token_id = get_u32(bytes, token_offset + index * 4)?;
        if token_id >= TOKENIZER_TOKEN_COUNT {
            return Err(Prompt2Error::new("prompt2-result-layout"));
        }
        token_ids.push(token_id);
    }
    let mut insertions = Vec::with_capacity(insertion_count);
    for index in 0..insertion_count {
        let offset = insertion_offset + index * INSERTION_RECORD_BYTES;
        let kind = control_kind_from_id(get_u16(bytes, offset)?)?;
        let flags = get_u16(bytes, offset + 2)?;
        let message_index = get_u32(bytes, offset + 4)?;
        let token_id = get_u32(bytes, offset + 8)?;
        let reserved = get_u32(bytes, offset + 12)?;
        let byte_offset = get_u64(bytes, offset + 16)?;
        let token_index = get_u64(bytes, offset + 24)?;
        if flags != 0
            || reserved != 0
            || (message_index != NONE_U32 && message_index >= MAXIMUM_MESSAGES)
            || token_id >= MODEL_VOCABULARY_SIZE
        {
            return Err(Prompt2Error::new("prompt2-result-layout"));
        }
        insertions.push(MappedControlInsertion {
            kind,
            message_index: (message_index != NONE_U32).then_some(message_index),
            token_id,
            byte_offset,
            token_index,
        });
    }
    let mut stop_token_ids = [0_u32; 2];
    for (index, output) in stop_token_ids.iter_mut().enumerate() {
        *output = get_u32(bytes, stop_offset + index * 4)?;
    }
    let state_array: [u8; 40] = bytes
        .get(state_offset..state_end)
        .ok_or_else(|| Prompt2Error::new("prompt2-result-layout"))?
        .try_into()
        .map_err(|_| Prompt2Error::new("prompt2-result-layout"))?;
    let state = Sampling2State::from_bytes(state_array)
        .map_err(|_| Prompt2Error::new("prompt2-result-layout"))?;
    Prompt2Result::new(
        rendered_utf8,
        token_ids,
        insertions,
        stop_token_ids,
        state,
        initial_status,
    )
}

fn validate_messages(messages: &[Prompt2Message]) -> Result<usize, Prompt2Error> {
    if messages.is_empty() || messages.len() > MAXIMUM_MESSAGES as usize {
        return Err(Prompt2Error::new("prompt2-request-layout"));
    }
    let mut total = 0_usize;
    for message in messages {
        if message.content.len() > MAXIMUM_MESSAGE_CONTENT_BYTES as usize {
            return Err(Prompt2Error::new("prompt2-request-utf8"));
        }
        total = checked_add(total, message.content.len())?;
        if total > MAXIMUM_TOTAL_CONTENT_BYTES as usize {
            return Err(Prompt2Error::new("prompt2-request-limit"));
        }
    }
    Ok(total)
}

fn validate_result(result: &Prompt2Result) -> Result<(), Prompt2Error> {
    if result.rendered_utf8.len() > MAXIMUM_RENDERED_BYTES as usize
        || result.token_ids.is_empty()
        || result.token_ids.len() > MAXIMUM_PROMPT_TOKENS as usize
        || result
            .token_ids
            .iter()
            .any(|token_id| *token_id >= TOKENIZER_TOKEN_COUNT)
        || result.insertions.len() > MAXIMUM_CONTROL_INSERTIONS as usize
        || result.stop_token_ids != STOP_TOKEN_IDS
    {
        return Err(Prompt2Error::new("prompt2-result-layout"));
    }
    match result.initial_status {
        Prompt2InitialStatus::Active
            if result.token_ids.len() < MAXIMUM_CONTEXT_TOKENS as usize => {}
        Prompt2InitialStatus::ContextLimit
            if result.token_ids.len() == MAXIMUM_CONTEXT_TOKENS as usize => {}
        _ => return Err(Prompt2Error::new("prompt2-result-layout")),
    }
    validate_insertion_sequence(
        result.rendered_utf8.as_bytes(),
        &result.token_ids,
        &result.insertions,
    )
}

fn validate_insertion_sequence(
    rendered: &[u8],
    token_ids: &[u32],
    insertions: &[MappedControlInsertion],
) -> Result<(), Prompt2Error> {
    if insertions.len() < 5 || !(insertions.len() - 3).is_multiple_of(2) {
        return Err(Prompt2Error::new("prompt2-result-layout"));
    }
    let message_count = (insertions.len() - 3) / 2;
    if message_count == 0 || message_count > MAXIMUM_MESSAGES as usize {
        return Err(Prompt2Error::new("prompt2-result-layout"));
    }
    let mut prior_byte_offset = None;
    let mut prior_token_index = None;
    let mut insertion_indexes = HashSet::with_capacity(insertions.len());
    for (index, insertion) in insertions.iter().copied().enumerate() {
        let (kind, message_index, token_id) = expected_insertion(index, message_count)?;
        let byte_offset = usize_from_u64(insertion.byte_offset, "prompt2-result-layout")?;
        let token_index = usize_from_u64(insertion.token_index, "prompt2-result-layout")?;
        let literal = control_literal(token_id)?;
        let byte_end = checked_add(byte_offset, literal.len())?;
        if insertion.kind != kind
            || insertion.message_index != message_index
            || insertion.token_id != token_id
            || prior_byte_offset.is_some_and(|prior| byte_offset <= prior)
            || prior_token_index.is_some_and(|prior| token_index <= prior)
            || rendered.get(byte_offset..byte_end) != Some(literal)
            || token_ids.get(token_index) != Some(&token_id)
            || !insertion_indexes.insert(token_index)
        {
            return Err(Prompt2Error::new("prompt2-result-layout"));
        }
        prior_byte_offset = Some(byte_offset);
        prior_token_index = Some(token_index);
    }
    if insertions[0].byte_offset != 0 || insertions[0].token_index != 0 {
        return Err(Prompt2Error::new("prompt2-result-layout"));
    }
    for (index, token_id) in token_ids.iter().copied().enumerate() {
        if is_control_token(token_id) && !insertion_indexes.contains(&index) {
            return Err(Prompt2Error::new("prompt2-result-layout"));
        }
    }
    Ok(())
}

fn expected_insertion(
    index: usize,
    message_count: usize,
) -> Result<(ControlKind, Option<u32>, u32), Prompt2Error> {
    if index < message_count * 2 {
        let message_index = (index / 2) as u32;
        return if index.is_multiple_of(2) {
            Ok((ControlKind::MessageStart, Some(message_index), 151_644))
        } else {
            Ok((ControlKind::MessageEnd, Some(message_index), 151_645))
        };
    }
    match index - message_count * 2 {
        0 => Ok((ControlKind::GenerationStart, None, 151_644)),
        1 => Ok((ControlKind::ThinkingStart, None, 151_667)),
        2 => Ok((ControlKind::ThinkingEnd, None, 151_668)),
        _ => Err(Prompt2Error::new("prompt2-result-layout")),
    }
}

fn control_literal(token_id: u32) -> Result<&'static [u8], Prompt2Error> {
    match token_id {
        151_644 => Ok(b"<|im_start|>"),
        151_645 => Ok(b"<|im_end|>"),
        151_667 => Ok(b"<think>"),
        151_668 => Ok(b"</think>"),
        _ => Err(Prompt2Error::new("prompt2-result-layout")),
    }
}

fn is_control_token(token_id: u32) -> bool {
    matches!(token_id, 151_644 | 151_645 | 151_667 | 151_668)
}

fn role_id(role: Role) -> u16 {
    match role {
        Role::System => 1,
        Role::User => 2,
        Role::Assistant => 3,
    }
}

fn role_from_id(value: u16) -> Result<Role, Prompt2Error> {
    match value {
        1 => Ok(Role::System),
        2 => Ok(Role::User),
        3 => Ok(Role::Assistant),
        _ => Err(Prompt2Error::new("prompt2-request-layout")),
    }
}

fn control_kind_id(kind: ControlKind) -> u16 {
    match kind {
        ControlKind::MessageStart => 1,
        ControlKind::MessageEnd => 2,
        ControlKind::GenerationStart => 3,
        ControlKind::ThinkingStart => 4,
        ControlKind::ThinkingEnd => 5,
    }
}

fn control_kind_from_id(value: u16) -> Result<ControlKind, Prompt2Error> {
    match value {
        1 => Ok(ControlKind::MessageStart),
        2 => Ok(ControlKind::MessageEnd),
        3 => Ok(ControlKind::GenerationStart),
        4 => Ok(ControlKind::ThinkingStart),
        5 => Ok(ControlKind::ThinkingEnd),
        _ => Err(Prompt2Error::new("prompt2-result-layout")),
    }
}

fn write_wire_header(
    output: &mut [u8],
    magic: &[u8; 8],
    format_id: &[u8; 16],
    file_bytes: usize,
) -> Result<(), Prompt2Error> {
    if output.len() != file_bytes || output.len() < WIRE_HEADER_BYTES {
        return Err(Prompt2Error::new("prompt2-arithmetic"));
    }
    output[0..8].copy_from_slice(magic);
    output[8..24].copy_from_slice(format_id);
    put_u32(output, 24, WIRE_HEADER_BYTES as u32)?;
    put_u16(output, 28, 1)?;
    put_u16(output, 30, 0)?;
    put_u32(output, 32, 0x0102_0304)?;
    put_u32(output, 36, 0)?;
    put_u64(output, 40, file_bytes as u64)
}

fn validate_wire_header(
    bytes: &[u8],
    maximum_bytes: usize,
    magic: &[u8; 8],
    format_id: &[u8; 16],
    error_code: &'static str,
) -> Result<(), Prompt2Error> {
    if bytes.len() < WIRE_HEADER_BYTES
        || bytes.len() > maximum_bytes
        || bytes.get(0..8) != Some(magic)
        || bytes.get(8..24) != Some(format_id)
        || get_u32(bytes, 24)? != WIRE_HEADER_BYTES as u32
        || get_u16(bytes, 28)? != 1
        || get_u16(bytes, 30)? != 0
        || get_u32(bytes, 32)? != 0x0102_0304
        || get_u32(bytes, 36)? != 0
        || get_u64(bytes, 40)? != bytes.len() as u64
    {
        return Err(Prompt2Error::new(error_code));
    }
    Ok(())
}

fn checked_add(left: usize, right: usize) -> Result<usize, Prompt2Error> {
    left.checked_add(right)
        .ok_or_else(|| Prompt2Error::new("prompt2-arithmetic"))
}

fn usize_from_u64(value: u64, code: &'static str) -> Result<usize, Prompt2Error> {
    usize::try_from(value).map_err(|_| Prompt2Error::new(code))
}

fn zero_range(bytes: &[u8], start: usize, end: usize) -> Result<bool, Prompt2Error> {
    Ok(all_zero(bytes.get(start..end).ok_or_else(|| {
        Prompt2Error::new("prompt2-result-layout")
    })?))
}
