use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::io::Write;

use sha2::{Digest, Sha256};

pub(crate) const FILE_BYTES: usize = 896;
pub(crate) const HEADER_BYTES: usize = 256;
pub(crate) const MEMBER_COUNT: usize = 5;
pub(crate) const MEMBER_RECORD_BYTES: usize = 128;
pub(crate) const MEMBER_TABLE_OFFSET: usize = 256;
pub(crate) const MEMBER_TABLE_BYTES: usize = 640;
pub(crate) const STREAM_HASH_BUFFER_BYTES: usize = 1_048_576;
pub(crate) const MAXIMUM_RESOLVED_MEMBER_BYTES: u64 = 68_787_700_488;

const MAGIC: &[u8; 8] = b"ACG2\r\n\x1a\n";
const FORMAT_ID: &[u8; 16] = b"minimodel.acg2\0\0";
const GRAPH_DOMAIN: &[u8] = b"tinyrustlm.acg2.champion-graph.v1\0";
const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/acg2-format-profile.v1.json");

/// Exact ACG2 2.0 profile identifier.
pub const ACG2_FORMAT_PROFILE_ID: &str = "org.minimodel.acg2/2.0";

/// SHA-256 of the exact machine-readable ACG2 profile bytes.
pub const ACG2_FORMAT_PROFILE_SHA256: &str =
    "944ed9b5b0ee2605ebb9ac13f2e5388c181bc857fdbfc082e62e9ae7b07c79be";

/// Stable public-safe ACG2 failure.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Acg2Error {
    code: &'static str,
}

impl Acg2Error {
    pub(crate) const fn new(code: &'static str) -> Self {
        Self { code }
    }

    /// Returns the stable public-safe failure code.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl Display for Acg2Error {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for Acg2Error {}

/// Closed semantic role and format of one ACG2 member.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u16)]
pub enum MemberRole {
    /// Sole mixed-Q8 SLM2 model.
    Model = 1,
    /// Sole Tokenizer2 artifact.
    Tokenizer = 2,
    /// Sole Template2 artifact.
    Template = 3,
    /// Sole Sampling2 artifact.
    Sampling = 4,
    /// Sole Prompt2 artifact.
    Prompt = 5,
}

impl MemberRole {
    pub(crate) const ORDERED: [Self; MEMBER_COUNT] = [
        Self::Model,
        Self::Tokenizer,
        Self::Template,
        Self::Sampling,
        Self::Prompt,
    ];

    /// Parses one exact lowercase role name.
    pub fn from_name(name: &str) -> Result<Self, Acg2Error> {
        match name {
            "model" => Ok(Self::Model),
            "tokenizer" => Ok(Self::Tokenizer),
            "template" => Ok(Self::Template),
            "sampling" => Ok(Self::Sampling),
            "prompt" => Ok(Self::Prompt),
            _ => Err(Acg2Error::new("acg2-member-order")),
        }
    }

    /// Returns the exact lowercase role name.
    pub const fn name(self) -> &'static str {
        match self {
            Self::Model => "model",
            Self::Tokenizer => "tokenizer",
            Self::Template => "template",
            Self::Sampling => "sampling",
            Self::Prompt => "prompt",
        }
    }

    /// Returns the redundant closed format name.
    pub const fn format_name(self) -> &'static str {
        match self {
            Self::Model => "slm2",
            Self::Tokenizer => "tokenizer2",
            Self::Template => "template2",
            Self::Sampling => "sampling2",
            Self::Prompt => "prompt2",
        }
    }

    /// Returns the zero-based required record ordinal.
    pub const fn ordinal(self) -> u32 {
        (self.code() - 1) as u32
    }

    pub(crate) const fn code(self) -> u16 {
        self as u16
    }

    pub(crate) const fn format_code(self) -> u16 {
        self as u16
    }

    pub(crate) const fn maximum_artifact_bytes(self) -> u64 {
        match self {
            Self::Model => 68_719_476_736,
            Self::Tokenizer => 67_108_864,
            Self::Template => 1_048_576,
            Self::Sampling => 65_800,
            Self::Prompt => 512,
        }
    }

    pub(crate) const fn profile_sha256_hex(self) -> &'static str {
        match self {
            Self::Model => "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8",
            Self::Tokenizer => "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de",
            Self::Template => "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa",
            Self::Sampling => "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d",
            Self::Prompt => "f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c",
        }
    }

    pub(crate) fn profile_sha256(self) -> Result<[u8; 32], Acg2Error> {
        digest_from_hex(self.profile_sha256_hex(), "acg2-member-profile")
    }
}

/// Exact identity record for one graph member.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Acg2Member {
    role: MemberRole,
    artifact_bytes: u64,
    artifact_sha256: [u8; 32],
    format_profile_sha256: [u8; 32],
}

impl Acg2Member {
    /// Creates one closed role-derived member identity.
    pub fn new(
        role: MemberRole,
        artifact_bytes: u64,
        artifact_sha256: [u8; 32],
    ) -> Result<Self, Acg2Error> {
        if artifact_bytes == 0 || artifact_bytes > role.maximum_artifact_bytes() {
            return Err(Acg2Error::new("acg2-member-length"));
        }
        if all_zero(&artifact_sha256) {
            return Err(Acg2Error::new("acg2-member-identity"));
        }
        Ok(Self {
            role,
            artifact_bytes,
            artifact_sha256,
            format_profile_sha256: role.profile_sha256()?,
        })
    }

    /// Returns the closed semantic role.
    pub const fn role(self) -> MemberRole {
        self.role
    }

    /// Returns the exact member artifact byte length.
    pub const fn artifact_bytes(self) -> u64 {
        self.artifact_bytes
    }

    /// Returns plain SHA-256 over all exact member artifact bytes.
    pub const fn artifact_sha256(self) -> [u8; 32] {
        self.artifact_sha256
    }

    /// Returns the exact role-specific format-profile SHA-256.
    pub const fn format_profile_sha256(self) -> [u8; 32] {
        self.format_profile_sha256
    }
}

/// Caller-selected ACG2 artifact ceiling.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Acg2Policy {
    maximum_artifact_bytes: u64,
}

impl Acg2Policy {
    /// Creates a nonzero ceiling no larger than the exact profile limit.
    pub fn new(maximum_artifact_bytes: u64) -> Result<Self, Acg2Error> {
        if maximum_artifact_bytes == 0 || maximum_artifact_bytes > FILE_BYTES as u64 {
            return Err(Acg2Error::new("acg2-policy"));
        }
        Ok(Self {
            maximum_artifact_bytes,
        })
    }

    /// Returns the exact profile ceiling.
    pub const fn exact_profile_limits() -> Self {
        Self {
            maximum_artifact_bytes: FILE_BYTES as u64,
        }
    }

    /// Returns the admitted artifact byte ceiling.
    pub const fn maximum_artifact_bytes(self) -> u64 {
        self.maximum_artifact_bytes
    }
}

/// Complete graph, member-table, and whole-artifact identities.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Acg2Identity {
    /// Exact graph artifact byte length.
    pub artifact_bytes: u64,
    /// Plain SHA-256 over the complete 896-byte artifact.
    pub artifact_sha256: [u8; 32],
    /// Domain-separated identity over version, class, member sum, and table.
    pub graph_identity_sha256: [u8; 32],
    /// Plain SHA-256 over all five member records.
    pub member_table_sha256: [u8; 32],
}

/// Fully validated immutable ACG2 graph.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Acg2Graph {
    identity: Acg2Identity,
    resolved_member_bytes: u64,
    members: [Acg2Member; MEMBER_COUNT],
}

impl Acg2Graph {
    /// Parses and fully validates one exact ACG2 artifact.
    pub fn from_bytes(bytes: &[u8], policy: Acg2Policy) -> Result<Self, Acg2Error> {
        validate_profile_identity()?;
        if bytes.len() as u64 > policy.maximum_artifact_bytes || bytes.len() > FILE_BYTES {
            return Err(Acg2Error::new("acg2-artifact-limit"));
        }
        if bytes.len() != FILE_BYTES {
            return Err(Acg2Error::new("acg2-header"));
        }
        validate_header(bytes)?;
        let (members, resolved_member_bytes) = parse_members(bytes)?;
        if get_u64(bytes, 72)? != resolved_member_bytes {
            return Err(Acg2Error::new("acg2-arithmetic"));
        }
        let member_table = bytes
            .get(MEMBER_TABLE_OFFSET..FILE_BYTES)
            .ok_or_else(|| Acg2Error::new("acg2-layout"))?;
        let member_table_sha256: [u8; 32] = Sha256::digest(member_table).into();
        if bytes.get(112..144) != Some(member_table_sha256.as_slice()) {
            return Err(Acg2Error::new("acg2-member-table-hash"));
        }
        let graph_identity_sha256 = derive_graph_identity(member_table, resolved_member_bytes);
        if bytes.get(80..112) != Some(graph_identity_sha256.as_slice()) {
            return Err(Acg2Error::new("acg2-graph-identity"));
        }
        Ok(Self {
            identity: Acg2Identity {
                artifact_bytes: FILE_BYTES as u64,
                artifact_sha256: Sha256::digest(bytes).into(),
                graph_identity_sha256,
                member_table_sha256,
            },
            resolved_member_bytes,
            members,
        })
    }

    /// Returns all exact graph identities.
    pub const fn identity(self) -> Acg2Identity {
        self.identity
    }

    /// Returns the checked sum of all five member lengths.
    pub const fn resolved_member_bytes(self) -> u64 {
        self.resolved_member_bytes
    }

    /// Returns members in the sole closed role order.
    pub const fn members(self) -> [Acg2Member; MEMBER_COUNT] {
        self.members
    }

    /// Returns one exact role record.
    pub fn member(self, role: MemberRole) -> Acg2Member {
        self.members[role.ordinal() as usize]
    }
}

/// Writes one deterministic ACG2 graph from five exact role identities.
///
/// Durable callers must use a newly owned same-directory staging stream,
/// independently reparse and synchronize it, then promote it atomically.
pub fn write_acg2<W: Write>(
    output: &mut W,
    members: &[Acg2Member; MEMBER_COUNT],
) -> Result<Acg2Identity, Acg2Error> {
    validate_profile_identity()?;
    let mut resolved_member_bytes = 0_u64;
    for (index, member) in members.iter().enumerate() {
        if member.role != MemberRole::ORDERED[index] {
            return Err(Acg2Error::new("acg2-member-order"));
        }
        if member.artifact_bytes == 0
            || member.artifact_bytes > member.role.maximum_artifact_bytes()
        {
            return Err(Acg2Error::new("acg2-member-length"));
        }
        if all_zero(&member.artifact_sha256) {
            return Err(Acg2Error::new("acg2-member-identity"));
        }
        if member.format_profile_sha256 != member.role.profile_sha256()? {
            return Err(Acg2Error::new("acg2-member-profile"));
        }
        resolved_member_bytes = resolved_member_bytes
            .checked_add(member.artifact_bytes)
            .ok_or_else(|| Acg2Error::new("acg2-arithmetic"))?;
    }
    if resolved_member_bytes > MAXIMUM_RESOLVED_MEMBER_BYTES {
        return Err(Acg2Error::new("acg2-arithmetic"));
    }

    let mut artifact = [0_u8; FILE_BYTES];
    artifact[0..8].copy_from_slice(MAGIC);
    artifact[8..24].copy_from_slice(FORMAT_ID);
    put_u16(&mut artifact, 24, 2)?;
    put_u16(&mut artifact, 26, 0)?;
    artifact[28] = 1;
    artifact[29] = 1;
    put_u16(&mut artifact, 30, 0)?;
    put_u32(&mut artifact, 32, HEADER_BYTES as u32)?;
    put_u32(&mut artifact, 36, MEMBER_COUNT as u32)?;
    put_u32(&mut artifact, 40, MEMBER_RECORD_BYTES as u32)?;
    put_u64(&mut artifact, 48, FILE_BYTES as u64)?;
    put_u64(&mut artifact, 56, MEMBER_TABLE_OFFSET as u64)?;
    put_u64(&mut artifact, 64, MEMBER_TABLE_BYTES as u64)?;
    put_u64(&mut artifact, 72, resolved_member_bytes)?;

    for (index, member) in members.iter().enumerate() {
        let offset = MEMBER_TABLE_OFFSET + index * MEMBER_RECORD_BYTES;
        put_u16(&mut artifact, offset, 1)?;
        put_u16(&mut artifact, offset + 2, member.role.code())?;
        put_u16(&mut artifact, offset + 4, member.role.format_code())?;
        put_u16(&mut artifact, offset + 6, 0)?;
        put_u32(&mut artifact, offset + 8, index as u32)?;
        put_u64(&mut artifact, offset + 16, member.artifact_bytes)?;
        put_bytes(&mut artifact, offset + 24, &member.artifact_sha256)?;
        put_bytes(&mut artifact, offset + 56, &member.format_profile_sha256)?;
    }

    let member_table_sha256: [u8; 32] =
        Sha256::digest(&artifact[MEMBER_TABLE_OFFSET..FILE_BYTES]).into();
    let graph_identity_sha256 = derive_graph_identity(
        &artifact[MEMBER_TABLE_OFFSET..FILE_BYTES],
        resolved_member_bytes,
    );
    put_bytes(&mut artifact, 80, &graph_identity_sha256)?;
    put_bytes(&mut artifact, 112, &member_table_sha256)?;
    let parsed = Acg2Graph::from_bytes(&artifact, Acg2Policy::exact_profile_limits())?;
    output
        .write_all(&artifact)
        .map_err(|_| Acg2Error::new("acg2-write-failed"))?;
    Ok(parsed.identity)
}

fn validate_profile_identity() -> Result<(), Acg2Error> {
    let digest: [u8; 32] = Sha256::digest(PROFILE_BYTES).into();
    if hex_lower(&digest) != ACG2_FORMAT_PROFILE_SHA256 {
        return Err(Acg2Error::new("acg2-profile-drift"));
    }
    Ok(())
}

fn validate_header(bytes: &[u8]) -> Result<(), Acg2Error> {
    if bytes.get(0..8) != Some(MAGIC)
        || bytes.get(8..24) != Some(FORMAT_ID)
        || get_u16(bytes, 24)? != 2
        || get_u16(bytes, 26)? != 0
        || bytes.get(28) != Some(&1)
        || bytes.get(29) != Some(&1)
        || get_u16(bytes, 30)? != 0
    {
        return Err(Acg2Error::new("acg2-header"));
    }
    if !all_zero(
        bytes
            .get(44..48)
            .ok_or_else(|| Acg2Error::new("acg2-header"))?,
    ) || !all_zero(
        bytes
            .get(144..256)
            .ok_or_else(|| Acg2Error::new("acg2-header"))?,
    ) {
        return Err(Acg2Error::new("acg2-reserved"));
    }
    if get_u32(bytes, 32)? != HEADER_BYTES as u32
        || get_u32(bytes, 36)? != MEMBER_COUNT as u32
        || get_u32(bytes, 40)? != MEMBER_RECORD_BYTES as u32
        || get_u64(bytes, 48)? != FILE_BYTES as u64
        || get_u64(bytes, 56)? != MEMBER_TABLE_OFFSET as u64
        || get_u64(bytes, 64)? != MEMBER_TABLE_BYTES as u64
    {
        return Err(Acg2Error::new("acg2-layout"));
    }
    Ok(())
}

fn parse_members(bytes: &[u8]) -> Result<([Acg2Member; MEMBER_COUNT], u64), Acg2Error> {
    let mut members = [Acg2Member {
        role: MemberRole::Model,
        artifact_bytes: 1,
        artifact_sha256: [1; 32],
        format_profile_sha256: [1; 32],
    }; MEMBER_COUNT];
    let mut resolved_member_bytes = 0_u64;
    for (index, expected) in MemberRole::ORDERED.into_iter().enumerate() {
        let offset = MEMBER_TABLE_OFFSET + index * MEMBER_RECORD_BYTES;
        if get_u16(bytes, offset)? != 1 || get_u16(bytes, offset + 6)? != 0 {
            return Err(Acg2Error::new("acg2-member-record"));
        }
        if get_u16(bytes, offset + 2)? != expected.code()
            || get_u16(bytes, offset + 4)? != expected.format_code()
            || get_u32(bytes, offset + 8)? != index as u32
        {
            return Err(Acg2Error::new("acg2-member-order"));
        }
        if !all_zero(
            bytes
                .get(offset + 12..offset + 16)
                .ok_or_else(|| Acg2Error::new("acg2-member-record"))?,
        ) || !all_zero(
            bytes
                .get(offset + 88..offset + 128)
                .ok_or_else(|| Acg2Error::new("acg2-member-record"))?,
        ) {
            return Err(Acg2Error::new("acg2-member-record"));
        }
        let artifact_bytes = get_u64(bytes, offset + 16)?;
        if artifact_bytes == 0 || artifact_bytes > expected.maximum_artifact_bytes() {
            return Err(Acg2Error::new("acg2-member-length"));
        }
        let artifact_sha256 = array_32(bytes, offset + 24, "acg2-member-record")?;
        if all_zero(&artifact_sha256) {
            return Err(Acg2Error::new("acg2-member-identity"));
        }
        let format_profile_sha256 = array_32(bytes, offset + 56, "acg2-member-record")?;
        if format_profile_sha256 != expected.profile_sha256()? {
            return Err(Acg2Error::new("acg2-member-profile"));
        }
        resolved_member_bytes = resolved_member_bytes
            .checked_add(artifact_bytes)
            .ok_or_else(|| Acg2Error::new("acg2-arithmetic"))?;
        if resolved_member_bytes > MAXIMUM_RESOLVED_MEMBER_BYTES {
            return Err(Acg2Error::new("acg2-arithmetic"));
        }
        members[index] = Acg2Member {
            role: expected,
            artifact_bytes,
            artifact_sha256,
            format_profile_sha256,
        };
    }
    Ok((members, resolved_member_bytes))
}

fn derive_graph_identity(member_table: &[u8], resolved_member_bytes: u64) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(GRAPH_DOMAIN);
    hasher.update(2_u16.to_le_bytes());
    hasher.update(0_u16.to_le_bytes());
    hasher.update([1_u8]);
    hasher.update((MEMBER_COUNT as u32).to_le_bytes());
    hasher.update(resolved_member_bytes.to_le_bytes());
    hasher.update(member_table);
    hasher.finalize().into()
}

fn get_u16(bytes: &[u8], offset: usize) -> Result<u16, Acg2Error> {
    Ok(u16::from_le_bytes(
        bytes
            .get(offset..offset + 2)
            .ok_or_else(|| Acg2Error::new("acg2-header"))?
            .try_into()
            .map_err(|_| Acg2Error::new("acg2-header"))?,
    ))
}

fn get_u32(bytes: &[u8], offset: usize) -> Result<u32, Acg2Error> {
    Ok(u32::from_le_bytes(
        bytes
            .get(offset..offset + 4)
            .ok_or_else(|| Acg2Error::new("acg2-header"))?
            .try_into()
            .map_err(|_| Acg2Error::new("acg2-header"))?,
    ))
}

fn get_u64(bytes: &[u8], offset: usize) -> Result<u64, Acg2Error> {
    Ok(u64::from_le_bytes(
        bytes
            .get(offset..offset + 8)
            .ok_or_else(|| Acg2Error::new("acg2-header"))?
            .try_into()
            .map_err(|_| Acg2Error::new("acg2-header"))?,
    ))
}

fn put_u16(bytes: &mut [u8], offset: usize, value: u16) -> Result<(), Acg2Error> {
    put_bytes(bytes, offset, &value.to_le_bytes())
}

fn put_u32(bytes: &mut [u8], offset: usize, value: u32) -> Result<(), Acg2Error> {
    put_bytes(bytes, offset, &value.to_le_bytes())
}

fn put_u64(bytes: &mut [u8], offset: usize, value: u64) -> Result<(), Acg2Error> {
    put_bytes(bytes, offset, &value.to_le_bytes())
}

fn put_bytes(bytes: &mut [u8], offset: usize, value: &[u8]) -> Result<(), Acg2Error> {
    bytes
        .get_mut(offset..offset + value.len())
        .ok_or_else(|| Acg2Error::new("acg2-arithmetic"))?
        .copy_from_slice(value);
    Ok(())
}

fn array_32(bytes: &[u8], offset: usize, code: &'static str) -> Result<[u8; 32], Acg2Error> {
    bytes
        .get(offset..offset + 32)
        .ok_or_else(|| Acg2Error::new(code))?
        .try_into()
        .map_err(|_| Acg2Error::new(code))
}

fn digest_from_hex(value: &str, code: &'static str) -> Result<[u8; 32], Acg2Error> {
    if value.len() != 64 {
        return Err(Acg2Error::new(code));
    }
    let mut output = [0_u8; 32];
    for (index, pair) in value.as_bytes().chunks_exact(2).enumerate() {
        output[index] = (hex_nibble(pair[0], code)? << 4) | hex_nibble(pair[1], code)?;
    }
    if all_zero(&output) {
        return Err(Acg2Error::new(code));
    }
    Ok(output)
}

fn hex_nibble(value: u8, code: &'static str) -> Result<u8, Acg2Error> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        _ => Err(Acg2Error::new(code)),
    }
}

fn all_zero(bytes: &[u8]) -> bool {
    bytes.iter().all(|byte| *byte == 0)
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}
