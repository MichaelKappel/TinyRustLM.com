use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt;
use std::io::Write;

use serde::de::{self, MapAccess, Visitor};
use serde::{Deserialize, Deserializer};
use tinyrustlm_tokenizer2::{
    write_tokenizer, MergeDefinition, TokenDefinition, TokenizerIdentity, TokenizerSpec,
};

const QWEN_SPLIT_EXPRESSION: &str = r"(?i:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct QwenTokenizerError {
    code: &'static str,
}

impl QwenTokenizerError {
    const fn new(code: &'static str) -> Self {
        Self { code }
    }

    pub(crate) const fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for QwenTokenizerError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code)
    }
}

impl Error for QwenTokenizerError {}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct QwenTokenizerModelContract {
    pub(crate) vocabulary_size: u32,
    pub(crate) bos_token_id: u32,
    pub(crate) eos_token_id: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct OwnedToken {
    bytes: Vec<u8>,
    added: bool,
    special: bool,
}

#[derive(Clone, Debug)]
pub(crate) struct ParsedQwenTokenizer {
    tokens: Vec<OwnedToken>,
    base_token_count: u32,
    merges: Vec<MergeDefinition>,
    bos_token_id: Option<u32>,
    eos_token_id: Option<u32>,
    pad_token_id: Option<u32>,
}

impl ParsedQwenTokenizer {
    pub(crate) fn write<W: Write>(
        &self,
        output: &mut W,
    ) -> Result<TokenizerIdentity, QwenTokenizerError> {
        let tokens = self
            .tokens
            .iter()
            .map(|token| TokenDefinition {
                bytes: &token.bytes,
                added: token.added,
                special: token.special,
            })
            .collect::<Vec<_>>();
        write_tokenizer(
            &TokenizerSpec {
                tokens: &tokens,
                base_token_count: self.base_token_count,
                merges: &self.merges,
                bos_token_id: self.bos_token_id,
                eos_token_id: self.eos_token_id,
                pad_token_id: self.pad_token_id,
                unk_token_id: None,
            },
            output,
        )
        .map_err(|_| QwenTokenizerError::new("qwen-tokenizer2-write-failed"))
    }

    pub(crate) fn token_count(&self) -> u32 {
        self.tokens.len() as u32
    }

    pub(crate) const fn base_token_count(&self) -> u32 {
        self.base_token_count
    }

    pub(crate) fn merge_count(&self) -> u32 {
        self.merges.len() as u32
    }

    pub(crate) fn added_token_count(&self) -> u32 {
        self.token_count() - self.base_token_count
    }

    pub(crate) fn special_token_count(&self) -> u32 {
        self.tokens.iter().filter(|token| token.special).count() as u32
    }

    pub(crate) const fn bos_token_id(&self) -> Option<u32> {
        self.bos_token_id
    }

    pub(crate) const fn eos_token_id(&self) -> Option<u32> {
        self.eos_token_id
    }

    pub(crate) const fn pad_token_id(&self) -> Option<u32> {
        self.pad_token_id
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawTokenizer {
    version: String,
    #[serde(rename = "truncation")]
    _truncation: (),
    #[serde(rename = "padding")]
    _padding: (),
    added_tokens: Vec<RawAddedToken>,
    normalizer: RawNormalizer,
    pre_tokenizer: RawPreTokenizer,
    post_processor: RawByteLevel,
    decoder: RawByteLevel,
    model: RawBpeModel,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(deny_unknown_fields)]
struct RawAddedToken {
    id: u32,
    content: String,
    single_word: bool,
    lstrip: bool,
    rstrip: bool,
    normalized: bool,
    special: bool,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawNormalizer {
    #[serde(rename = "type")]
    kind: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawPreTokenizer {
    #[serde(rename = "type")]
    kind: String,
    pretokenizers: Vec<RawPreTokenizerComponent>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", deny_unknown_fields)]
enum RawPreTokenizerComponent {
    Split {
        pattern: RawRegexPattern,
        behavior: String,
        invert: bool,
    },
    ByteLevel {
        add_prefix_space: bool,
        trim_offsets: bool,
        use_regex: bool,
    },
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawRegexPattern {
    #[serde(rename = "Regex")]
    regex: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawByteLevel {
    #[serde(rename = "type")]
    kind: String,
    add_prefix_space: bool,
    trim_offsets: bool,
    use_regex: bool,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawBpeModel {
    #[serde(rename = "type")]
    kind: String,
    #[serde(rename = "dropout")]
    _dropout: (),
    #[serde(rename = "unk_token")]
    _unk_token: (),
    continuing_subword_prefix: String,
    end_of_word_suffix: String,
    fuse_unk: bool,
    byte_fallback: bool,
    ignore_merges: bool,
    vocab: UniqueStringIdMap,
    merges: Vec<(String, String)>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawTokenizerConfig {
    add_bos_token: bool,
    add_prefix_space: bool,
    added_tokens_decoder: UniqueAddedTokenMap,
    additional_special_tokens: Vec<String>,
    bos_token: RequiredOptionalString,
    chat_template: String,
    clean_up_tokenization_spaces: bool,
    eos_token: String,
    errors: String,
    model_max_length: u64,
    pad_token: String,
    split_special_tokens: bool,
    tokenizer_class: String,
    unk_token: RequiredOptionalString,
}

#[derive(Debug, Deserialize)]
#[serde(transparent)]
struct RequiredOptionalString(Option<String>);

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(deny_unknown_fields)]
struct RawAddedTokenConfig {
    content: String,
    lstrip: bool,
    normalized: bool,
    rstrip: bool,
    single_word: bool,
    special: bool,
}

#[derive(Debug)]
struct UniqueStringIdMap(BTreeMap<String, u32>);

impl<'de> Deserialize<'de> for UniqueStringIdMap {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct MapVisitor;

        impl<'de> Visitor<'de> for MapVisitor {
            type Value = UniqueStringIdMap;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a token-to-id object with unique members")
            }

            fn visit_map<M>(self, mut map: M) -> Result<Self::Value, M::Error>
            where
                M: MapAccess<'de>,
            {
                let mut values = BTreeMap::new();
                while let Some((token, id)) = map.next_entry::<String, u32>()? {
                    if values.insert(token.clone(), id).is_some() {
                        return Err(de::Error::custom(format_args!(
                            "duplicate vocabulary token {token:?}"
                        )));
                    }
                }
                Ok(UniqueStringIdMap(values))
            }
        }

        deserializer.deserialize_map(MapVisitor)
    }
}

#[derive(Debug)]
struct UniqueAddedTokenMap(BTreeMap<u32, RawAddedTokenConfig>);

impl<'de> Deserialize<'de> for UniqueAddedTokenMap {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct MapVisitor;

        impl<'de> Visitor<'de> for MapVisitor {
            type Value = UniqueAddedTokenMap;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a canonical decimal-id added-token object")
            }

            fn visit_map<M>(self, mut map: M) -> Result<Self::Value, M::Error>
            where
                M: MapAccess<'de>,
            {
                let mut values = BTreeMap::new();
                while let Some((key, value)) = map.next_entry::<String, RawAddedTokenConfig>()? {
                    let id = key
                        .parse::<u32>()
                        .map_err(|_| de::Error::custom("added-token id is not u32"))?;
                    if key != id.to_string() {
                        return Err(de::Error::custom("added-token id is not canonical decimal"));
                    }
                    if values.insert(id, value).is_some() {
                        return Err(de::Error::custom("duplicate added-token id"));
                    }
                }
                Ok(UniqueAddedTokenMap(values))
            }
        }

        deserializer.deserialize_map(MapVisitor)
    }
}

pub(crate) fn parse_qwen_tokenizer(
    tokenizer_bytes: &[u8],
    tokenizer_config_bytes: &[u8],
    vocab_bytes: &[u8],
    merges_bytes: &[u8],
    model: QwenTokenizerModelContract,
) -> Result<ParsedQwenTokenizer, QwenTokenizerError> {
    let tokenizer: RawTokenizer =
        parse_complete_json(tokenizer_bytes, "qwen-tokenizer-json-invalid")?;
    let tokenizer_config: RawTokenizerConfig =
        parse_complete_json(tokenizer_config_bytes, "qwen-tokenizer-config-invalid")?;
    let standalone_vocab: UniqueStringIdMap =
        parse_complete_json(vocab_bytes, "qwen-tokenizer-vocab-invalid")?;
    validate_pipeline(&tokenizer, &tokenizer_config)?;
    if tokenizer.model.vocab.0 != standalone_vocab.0 {
        return Err(QwenTokenizerError::new("qwen-tokenizer-vocab-mismatch"));
    }
    let standalone_merges = parse_merges_text(merges_bytes)?;
    if tokenizer.model.merges != standalone_merges {
        return Err(QwenTokenizerError::new("qwen-tokenizer-merges-mismatch"));
    }
    build_tokenizer(tokenizer, tokenizer_config, model)
}

fn parse_complete_json<'a, T: Deserialize<'a>>(
    bytes: &'a [u8],
    code: &'static str,
) -> Result<T, QwenTokenizerError> {
    let mut deserializer = serde_json::Deserializer::from_slice(bytes);
    let result = T::deserialize(&mut deserializer).map_err(|_| QwenTokenizerError::new(code))?;
    deserializer
        .end()
        .map_err(|_| QwenTokenizerError::new(code))?;
    Ok(result)
}

fn validate_pipeline(
    tokenizer: &RawTokenizer,
    config: &RawTokenizerConfig,
) -> Result<(), QwenTokenizerError> {
    // Qwen3 intentionally reuses the upstream Qwen2Tokenizer class identity.
    let split_valid = matches!(
        tokenizer.pre_tokenizer.pretokenizers.as_slice(),
        [
            RawPreTokenizerComponent::Split {
                pattern,
                behavior,
                invert: false,
            },
            RawPreTokenizerComponent::ByteLevel {
                add_prefix_space: false,
                trim_offsets: false,
                use_regex: false,
            },
        ] if pattern.regex == QWEN_SPLIT_EXPRESSION && behavior == "Isolated"
    );
    if tokenizer.version != "1.0"
        || tokenizer.normalizer.kind != "NFC"
        || tokenizer.pre_tokenizer.kind != "Sequence"
        || !split_valid
        || !byte_level_is_exact(&tokenizer.post_processor)
        || !byte_level_is_exact(&tokenizer.decoder)
        || tokenizer.model.kind != "BPE"
        || !tokenizer.model.continuing_subword_prefix.is_empty()
        || !tokenizer.model.end_of_word_suffix.is_empty()
        || tokenizer.model.fuse_unk
        || tokenizer.model.byte_fallback
        || tokenizer.model.ignore_merges
        || config.add_bos_token
        || config.add_prefix_space
        || config.clean_up_tokenization_spaces
        || config.errors != "replace"
        || config.model_max_length == 0
        || config.model_max_length > 9_007_199_254_740_991
        || config.split_special_tokens
        || config.tokenizer_class != "Qwen2Tokenizer"
        || config.unk_token.0.is_some()
        || config.chat_template.is_empty()
        || config.chat_template.contains('\0')
    {
        return Err(QwenTokenizerError::new(
            "qwen-tokenizer-pipeline-unsupported",
        ));
    }
    Ok(())
}

fn byte_level_is_exact(value: &RawByteLevel) -> bool {
    value.kind == "ByteLevel" && !value.add_prefix_space && !value.trim_offsets && !value.use_regex
}

fn parse_merges_text(bytes: &[u8]) -> Result<Vec<(String, String)>, QwenTokenizerError> {
    if bytes.contains(&b'\r') || !bytes.ends_with(b"\n") {
        return Err(QwenTokenizerError::new("qwen-tokenizer-merges-invalid"));
    }
    let text = std::str::from_utf8(bytes)
        .map_err(|_| QwenTokenizerError::new("qwen-tokenizer-merges-invalid"))?;
    let mut lines = text.split_terminator('\n');
    if lines.next() != Some("#version: 0.2") {
        return Err(QwenTokenizerError::new("qwen-tokenizer-merges-invalid"));
    }
    let mut pairs = Vec::new();
    let mut unique = BTreeSet::new();
    for line in lines {
        let mut parts = line.split(' ');
        let left = parts.next().unwrap_or_default();
        let right = parts.next().unwrap_or_default();
        if left.is_empty() || right.is_empty() || parts.next().is_some() {
            return Err(QwenTokenizerError::new("qwen-tokenizer-merges-invalid"));
        }
        let pair = (left.to_owned(), right.to_owned());
        if !unique.insert(pair.clone()) {
            return Err(QwenTokenizerError::new("qwen-tokenizer-duplicate-merge"));
        }
        pairs.push(pair);
    }
    Ok(pairs)
}

fn build_tokenizer(
    tokenizer: RawTokenizer,
    config: RawTokenizerConfig,
    model: QwenTokenizerModelContract,
) -> Result<ParsedQwenTokenizer, QwenTokenizerError> {
    let RawBpeModel { vocab, merges, .. } = tokenizer.model;
    let base_count = u32::try_from(vocab.0.len())
        .map_err(|_| QwenTokenizerError::new("qwen-tokenizer-vocab-invalid"))?;
    let merge_count = u32::try_from(merges.len())
        .map_err(|_| QwenTokenizerError::new("qwen-tokenizer-merges-invalid"))?;
    if base_count
        != 256_u32
            .checked_add(merge_count)
            .ok_or_else(|| QwenTokenizerError::new("qwen-tokenizer-base-closure-invalid"))?
    {
        return Err(QwenTokenizerError::new(
            "qwen-tokenizer-base-closure-invalid",
        ));
    }
    let mut tokens = std::iter::repeat_with(|| None)
        .take(base_count as usize)
        .collect::<Vec<Option<OwnedToken>>>();
    let byte_map = byte_level_reverse_map();
    for (source_token, id) in &vocab.0 {
        let slot = tokens
            .get_mut(*id as usize)
            .ok_or_else(|| QwenTokenizerError::new("qwen-tokenizer-vocab-id-invalid"))?;
        if slot.is_some() {
            return Err(QwenTokenizerError::new("qwen-tokenizer-vocab-id-invalid"));
        }
        *slot = Some(OwnedToken {
            bytes: decode_byte_level_token(source_token, &byte_map)?,
            added: false,
            special: false,
        });
    }
    if tokens.iter().any(Option::is_none) {
        return Err(QwenTokenizerError::new("qwen-tokenizer-vocab-id-invalid"));
    }
    let mut tokens = tokens.into_iter().flatten().collect::<Vec<_>>();
    let mut merge_definitions = Vec::with_capacity(merges.len());
    let mut unique_pairs = BTreeSet::new();
    for (rank, (left, right)) in merges.iter().enumerate() {
        let left_id = *vocab
            .0
            .get(left)
            .ok_or_else(|| QwenTokenizerError::new("qwen-tokenizer-merge-token-missing"))?;
        let right_id = *vocab
            .0
            .get(right)
            .ok_or_else(|| QwenTokenizerError::new("qwen-tokenizer-merge-token-missing"))?;
        if !unique_pairs.insert((left_id, right_id)) {
            return Err(QwenTokenizerError::new("qwen-tokenizer-duplicate-merge"));
        }
        let output = 256_u32
            .checked_add(rank as u32)
            .ok_or_else(|| QwenTokenizerError::new("qwen-tokenizer-merge-output-invalid"))?;
        let mut output_source = String::with_capacity(left.len() + right.len());
        output_source.push_str(left);
        output_source.push_str(right);
        if vocab.0.get(&output_source) != Some(&output) {
            return Err(QwenTokenizerError::new(
                "qwen-tokenizer-merge-output-invalid",
            ));
        }
        merge_definitions.push(MergeDefinition {
            left: left_id,
            right: right_id,
            output,
        });
    }

    let mut expected_added_id = base_count;
    let mut added_contents = BTreeSet::new();
    let mut added_by_id = BTreeMap::new();
    for added in tokenizer.added_tokens {
        validate_added_token(&added)?;
        if added.id != expected_added_id
            || !added_contents.insert(added.content.clone())
            || added_by_id.insert(added.id, added.clone()).is_some()
        {
            return Err(QwenTokenizerError::new(
                "qwen-tokenizer-added-token-invalid",
            ));
        }
        tokens.push(OwnedToken {
            bytes: added.content.as_bytes().to_vec(),
            added: true,
            special: added.special,
        });
        expected_added_id = expected_added_id
            .checked_add(1)
            .ok_or_else(|| QwenTokenizerError::new("qwen-tokenizer-added-token-invalid"))?;
    }
    validate_added_token_config(&added_by_id, &config)?;

    let bos_token_id = resolve_optional_token(config.bos_token.0.as_deref(), &added_by_id)?;
    let eos_token_id = Some(resolve_required_token(&config.eos_token, &added_by_id)?);
    let pad_token_id = Some(resolve_required_token(&config.pad_token, &added_by_id)?);
    let token_count = tokens.len() as u32;
    if token_count > model.vocabulary_size
        || eos_token_id != Some(model.eos_token_id)
        || match bos_token_id {
            Some(id) => id != model.bos_token_id,
            None => pad_token_id != Some(model.bos_token_id),
        }
    {
        return Err(QwenTokenizerError::new(
            "qwen-tokenizer-model-contract-mismatch",
        ));
    }

    Ok(ParsedQwenTokenizer {
        tokens,
        base_token_count: base_count,
        merges: merge_definitions,
        bos_token_id,
        eos_token_id,
        pad_token_id,
    })
}

fn validate_added_token(added: &RawAddedToken) -> Result<(), QwenTokenizerError> {
    if added.content.is_empty()
        || added.content.contains('\0')
        || added.single_word
        || added.lstrip
        || added.rstrip
        || added.normalized
    {
        return Err(QwenTokenizerError::new(
            "qwen-tokenizer-added-token-invalid",
        ));
    }
    Ok(())
}

fn validate_added_token_config(
    added: &BTreeMap<u32, RawAddedToken>,
    config: &RawTokenizerConfig,
) -> Result<(), QwenTokenizerError> {
    if added.len() != config.added_tokens_decoder.0.len() {
        return Err(QwenTokenizerError::new(
            "qwen-tokenizer-added-token-config-mismatch",
        ));
    }
    for (id, token) in added {
        let expected = RawAddedTokenConfig {
            content: token.content.clone(),
            lstrip: token.lstrip,
            normalized: token.normalized,
            rstrip: token.rstrip,
            single_word: token.single_word,
            special: token.special,
        };
        if config.added_tokens_decoder.0.get(id) != Some(&expected) {
            return Err(QwenTokenizerError::new(
                "qwen-tokenizer-added-token-config-mismatch",
            ));
        }
    }
    let mut declared_specials = BTreeSet::new();
    for content in &config.additional_special_tokens {
        if !declared_specials.insert(content.as_str()) {
            return Err(QwenTokenizerError::new(
                "qwen-tokenizer-special-token-config-mismatch",
            ));
        }
    }
    for content in [
        config.bos_token.0.as_deref(),
        Some(config.eos_token.as_str()),
        Some(config.pad_token.as_str()),
        config.unk_token.0.as_deref(),
    ]
    .into_iter()
    .flatten()
    {
        declared_specials.insert(content);
    }
    let actual_specials = added
        .values()
        .filter(|token| token.special)
        .map(|token| token.content.as_str())
        .collect::<BTreeSet<_>>();
    if declared_specials != actual_specials {
        return Err(QwenTokenizerError::new(
            "qwen-tokenizer-special-token-config-mismatch",
        ));
    }
    Ok(())
}

fn resolve_optional_token(
    content: Option<&str>,
    added: &BTreeMap<u32, RawAddedToken>,
) -> Result<Option<u32>, QwenTokenizerError> {
    content
        .map(|content| resolve_required_token(content, added))
        .transpose()
}

fn resolve_required_token(
    content: &str,
    added: &BTreeMap<u32, RawAddedToken>,
) -> Result<u32, QwenTokenizerError> {
    let mut matches = added
        .iter()
        .filter(|(_, token)| token.content == content && token.special)
        .map(|(id, _)| *id);
    let id = matches
        .next()
        .ok_or_else(|| QwenTokenizerError::new("qwen-tokenizer-special-token-missing"))?;
    if matches.next().is_some() {
        return Err(QwenTokenizerError::new(
            "qwen-tokenizer-special-token-ambiguous",
        ));
    }
    Ok(id)
}

fn byte_level_reverse_map() -> BTreeMap<char, u8> {
    let mut bytes = (b'!'..=b'~')
        .chain(0xa1_u8..=0xac)
        .chain(0xae_u8..=0xff)
        .collect::<Vec<_>>();
    let mut code_points = bytes
        .iter()
        .map(|byte| u32::from(*byte))
        .collect::<Vec<_>>();
    let mut extension = 0_u32;
    for byte in 0_u8..=u8::MAX {
        if !bytes.contains(&byte) {
            bytes.push(byte);
            code_points.push(256 + extension);
            extension += 1;
        }
    }
    bytes
        .into_iter()
        .zip(code_points)
        .map(|(byte, code_point)| {
            (
                char::from_u32(code_point).expect("ByteLevel code point is valid"),
                byte,
            )
        })
        .collect()
}

fn decode_byte_level_token(
    token: &str,
    reverse: &BTreeMap<char, u8>,
) -> Result<Vec<u8>, QwenTokenizerError> {
    let mut bytes = Vec::with_capacity(token.len());
    for character in token.chars() {
        bytes.push(
            *reverse
                .get(&character)
                .ok_or_else(|| QwenTokenizerError::new("qwen-tokenizer-bytelevel-invalid"))?,
        );
    }
    if bytes.is_empty() {
        return Err(QwenTokenizerError::new("qwen-tokenizer-bytelevel-invalid"));
    }
    Ok(bytes)
}
