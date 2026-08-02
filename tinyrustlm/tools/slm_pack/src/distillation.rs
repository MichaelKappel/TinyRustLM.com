//! Frozen distillation dataset provenance and contamination validation.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::safetensors::{parse_json_object, JsonValue};

const SOURCE_MANIFEST_NAME: &str = "distillation-dataset-source.manifest";
const SOURCE_VERSION_V1: &str = "1";
const SOURCE_VERSION_V2: &str = "2";
const FROZEN_VERSION_V1: &str = "1";
const FROZEN_VERSION_V2: &str = "2";
const ROLE_HISTORY_SCHEMA: &str = "tinyrustlm.role_history.v1";
const DATASET_STATUS: &str = "frozen";
const DATASET_SPLIT: &str = "train";
const TARGET_KIND: &str = "teacher-final-answer";
const REQUIRED_NEXT_GATE: &str =
    "gpu-training-run-plus-trained-adapter-source-validation-plus-raw-eval";
const MAX_MANIFEST_BYTES: u64 = 1024 * 1024;
const MAX_RECORD_BYTES: u64 = 1024 * 1024;
const NGRAM_WORD_COUNT: usize = 5;

const GLOBAL_SOURCE_KEYS: [&str; 14] = [
    "tinyrustlm_distillation_dataset_source_version",
    "dataset_id",
    "dataset_split",
    "dataset_license_route",
    "dataset_purpose",
    "teacher_model_id",
    "teacher_revision",
    "teacher_weight_sha256",
    "teacher_tokenizer_sha256",
    "teacher_generation_profile",
    "student_model_id",
    "student_revision",
    "student_weight_sha256",
    "student_tokenizer_sha256",
];

const RECORD_SOURCE_KEYS: [&str; 9] = [
    "id",
    "task_family",
    "prompt_file",
    "response_file",
    "source_id",
    "source_license",
    "source_record_id",
    "target_kind",
    "teacher_reasoning_included",
];

const RECORD_SOURCE_KEYS_V2: [&str; 11] = [
    "id",
    "task_family",
    "history_file",
    "history_message_count",
    "prompt_file",
    "response_file",
    "source_id",
    "source_license",
    "source_record_id",
    "target_kind",
    "teacher_reasoning_included",
];

const TASK_FAMILIES: [&str; 18] = [
    "greeting-capability",
    "ambiguous-clarification",
    "factual-qa",
    "arithmetic-logic",
    "practical-judgment",
    "adult-lawful-inquiry",
    "summarization",
    "extraction",
    "rewrite",
    "code-explanation",
    "strict-json",
    "instruction-conflict",
    "multi-turn-state",
    "prompt-injection",
    "refusal-boundary",
    "repetition-truncation",
    "unseen-domain-uncertainty",
    "uaix-memory-grounding",
];

struct DatasetSource {
    source_version: String,
    manifest_text: String,
    fields: HashMap<String, String>,
    records: Vec<SourceRecord>,
}

struct SourceRecord {
    id: String,
    task_family: String,
    history_file: Option<String>,
    history_message_count: usize,
    prompt_file: String,
    response_file: String,
    source_id: String,
    source_license: String,
    source_record_id: String,
}

struct LoadedRecord {
    source: SourceRecord,
    history_conversation: Option<String>,
    history_bytes: usize,
    history_sha256: Option<String>,
    prompt: String,
    response: String,
    prompt_bytes: usize,
    response_bytes: usize,
    prompt_sha256: String,
    response_sha256: String,
    training_pair_sha256: String,
}

struct RoleHistory {
    schema: String,
    messages: Vec<RoleMessage>,
}

struct RoleMessage {
    role: String,
    content: String,
}

struct ExclusionSet {
    path: String,
    bytes: usize,
    sha256: String,
    prompts: Vec<String>,
}

/// Freezes a reviewed source dataset after cryptographic and contamination checks.
pub(crate) fn freeze_dataset_path(
    dataset_dir: &Path,
    output_manifest: &Path,
    exclusion_paths: &[PathBuf],
) -> io::Result<()> {
    let text = build_frozen_manifest_text(dataset_dir, exclusion_paths)?;
    if let Some(parent) = output_manifest.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_manifest, text)?;
    println!(
        "TinyRustLM distillation dataset frozen: {}",
        output_manifest.display()
    );
    println!("dataset_dir: {}", dataset_dir.display());
    println!("eval_exclusion_count: {}", exclusion_paths.len());
    Ok(())
}

/// Recomputes a frozen dataset manifest and rejects any byte or exclusion drift.
pub(crate) fn validate_dataset_path(
    dataset_dir: &Path,
    frozen_manifest: &Path,
    exclusion_paths: &[PathBuf],
) -> io::Result<()> {
    let actual = read_bounded_text(frozen_manifest, MAX_MANIFEST_BYTES, "frozen manifest")?;
    let expected = build_frozen_manifest_text(dataset_dir, exclusion_paths)?;
    if actual != expected {
        return Err(invalid(
            "frozen distillation dataset manifest does not match recomputed evidence",
        ));
    }
    println!("TinyRustLM distillation dataset validation: PASS");
    println!("dataset_dir: {}", dataset_dir.display());
    println!("frozen_manifest: {}", frozen_manifest.display());
    println!("eval_exclusion_count: {}", exclusion_paths.len());
    Ok(())
}

fn build_frozen_manifest_text(
    dataset_dir: &Path,
    exclusion_paths: &[PathBuf],
) -> io::Result<String> {
    if exclusion_paths.is_empty() {
        return Err(invalid(
            "distillation dataset freeze requires at least one materialized eval exclusion",
        ));
    }
    let dataset_root = fs::canonicalize(dataset_dir)?;
    if !dataset_root.is_dir() {
        return Err(invalid("distillation dataset path is not a directory"));
    }
    let source = read_dataset_source(&dataset_root)?;
    let exclusions = read_exclusions(exclusion_paths)?;
    let records = load_records(&dataset_root, source.records)?;
    validate_contamination(&records, &exclusions)?;

    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_distillation_dataset_version",
        if source.source_version == SOURCE_VERSION_V2 {
            FROZEN_VERSION_V2
        } else {
            FROZEN_VERSION_V1
        },
    );
    push_line(&mut text, "dataset_status", DATASET_STATUS);
    for key in GLOBAL_SOURCE_KEYS {
        push_line(&mut text, key, require_key(&source.fields, key)?);
    }
    push_line(&mut text, "source_manifest_file", SOURCE_MANIFEST_NAME);
    push_line(
        &mut text,
        "source_manifest_bytes",
        &source.manifest_text.len().to_string(),
    );
    push_line(
        &mut text,
        "source_manifest_sha256",
        &sha256_bytes(source.manifest_text.as_bytes()),
    );
    push_line(
        &mut text,
        "eval_exclusion_count",
        &exclusions.len().to_string(),
    );
    for (index, exclusion) in exclusions.iter().enumerate() {
        let prefix = format!("eval_exclusion.{index}");
        push_line(&mut text, &format!("{prefix}.path"), &exclusion.path);
        push_line(
            &mut text,
            &format!("{prefix}.bytes"),
            &exclusion.bytes.to_string(),
        );
        push_line(&mut text, &format!("{prefix}.sha256"), &exclusion.sha256);
        push_line(
            &mut text,
            &format!("{prefix}.materialized_prompt_count"),
            &exclusion.prompts.len().to_string(),
        );
    }
    push_line(&mut text, "contamination_exact_match_count", "0");
    push_line(&mut text, "contamination_five_gram_match_count", "0");
    push_line(&mut text, "contamination_status", "pass");
    push_line(&mut text, "hidden_reasoning_status", "absent");
    push_line(&mut text, "likely_secret_status", "absent");
    push_line(&mut text, "record_count", &records.len().to_string());
    for (index, record) in records.iter().enumerate() {
        let prefix = format!("record.{index}");
        push_line(&mut text, &format!("{prefix}.id"), &record.source.id);
        push_line(
            &mut text,
            &format!("{prefix}.task_family"),
            &record.source.task_family,
        );
        if let Some(history_file) = &record.source.history_file {
            push_line(&mut text, &format!("{prefix}.history_file"), history_file);
            push_line(
                &mut text,
                &format!("{prefix}.history_message_count"),
                &record.source.history_message_count.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.history_bytes"),
                &record.history_bytes.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.history_sha256"),
                record
                    .history_sha256
                    .as_deref()
                    .ok_or_else(|| invalid("structured history SHA-256 is missing"))?,
            );
        }
        push_line(
            &mut text,
            &format!("{prefix}.prompt_file"),
            &record.source.prompt_file,
        );
        push_line(
            &mut text,
            &format!("{prefix}.prompt_bytes"),
            &record.prompt_bytes.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.prompt_sha256"),
            &record.prompt_sha256,
        );
        push_line(
            &mut text,
            &format!("{prefix}.response_file"),
            &record.source.response_file,
        );
        push_line(
            &mut text,
            &format!("{prefix}.response_bytes"),
            &record.response_bytes.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.response_sha256"),
            &record.response_sha256,
        );
        push_line(
            &mut text,
            &format!("{prefix}.training_pair_sha256"),
            &record.training_pair_sha256,
        );
        push_line(
            &mut text,
            &format!("{prefix}.source_id"),
            &record.source.source_id,
        );
        push_line(
            &mut text,
            &format!("{prefix}.source_license"),
            &record.source.source_license,
        );
        push_line(
            &mut text,
            &format!("{prefix}.source_record_id"),
            &record.source.source_record_id,
        );
        push_line(&mut text, &format!("{prefix}.target_kind"), TARGET_KIND);
        push_line(
            &mut text,
            &format!("{prefix}.teacher_reasoning_included"),
            "false",
        );
    }
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

fn read_dataset_source(dataset_root: &Path) -> io::Result<DatasetSource> {
    let manifest_path = dataset_root.join(SOURCE_MANIFEST_NAME);
    let manifest_text = read_bounded_text(&manifest_path, MAX_MANIFEST_BYTES, "source manifest")?;
    let fields = parse_manifest(&manifest_text, "distillation dataset source")?;
    let source_version = require_key(&fields, "tinyrustlm_distillation_dataset_source_version")?;
    if !matches!(source_version, SOURCE_VERSION_V1 | SOURCE_VERSION_V2) {
        return Err(invalid(
            "tinyrustlm_distillation_dataset_source_version must be 1 or 2",
        ));
    }
    let source_version = source_version.to_string();
    require_equal(&fields, "dataset_split", DATASET_SPLIT)?;
    for key in GLOBAL_SOURCE_KEYS {
        validate_evidence_value(require_key(&fields, key)?, key)?;
    }
    validate_slug(require_key(&fields, "dataset_id")?, "dataset_id")?;
    require_sha256(&fields, "teacher_weight_sha256")?;
    require_sha256(&fields, "teacher_tokenizer_sha256")?;
    require_sha256(&fields, "student_weight_sha256")?;
    require_sha256(&fields, "student_tokenizer_sha256")?;
    let tokenizer_alignment = require_key(&fields, "tokenizer_alignment")?;
    if !matches!(
        tokenizer_alignment,
        "same-tokenizer-token-and-sequence" | "cross-tokenizer-sequence-only"
    ) {
        return Err(invalid(
            "tokenizer_alignment must be same-tokenizer-token-and-sequence or cross-tokenizer-sequence-only",
        ));
    }

    let record_count = parse_usize(&fields, "record_count")?;
    if record_count == 0 {
        return Err(invalid(
            "distillation dataset source requires at least one record",
        ));
    }
    reject_unknown_source_keys(&fields, record_count, &source_version)?;

    let mut ids = HashSet::new();
    let mut files = HashSet::new();
    let mut records = Vec::with_capacity(record_count);
    for index in 0..record_count {
        let prefix = format!("record.{index}");
        let value = |key: &str| require_key(&fields, &format!("{prefix}.{key}"));
        let id = value("id")?.to_string();
        validate_slug(&id, "record id")?;
        if !ids.insert(id.clone()) {
            return Err(invalid("distillation record ids must be unique"));
        }
        let task_family = value("task_family")?.to_string();
        if !TASK_FAMILIES.contains(&task_family.as_str()) {
            return Err(invalid("distillation record has an unknown task family"));
        }
        let (history_file, history_message_count) = if source_version == SOURCE_VERSION_V2 {
            let history_file = value("history_file")?.to_string();
            validate_history_path(&history_file)?;
            let history_message_count = value("history_message_count")?
                .parse::<usize>()
                .map_err(|_| invalid("history_message_count must be an unsigned integer"))?;
            if !(2..=12).contains(&history_message_count)
                || !history_message_count.is_multiple_of(2)
            {
                return Err(invalid(
                    "history_message_count must describe 1..=6 complete user/assistant turns",
                ));
            }
            (Some(history_file), history_message_count)
        } else {
            (None, 0)
        };
        let prompt_file = value("prompt_file")?.to_string();
        let response_file = value("response_file")?.to_string();
        validate_record_path(&prompt_file, "prompt_file")?;
        validate_record_path(&response_file, "response_file")?;
        if prompt_file == response_file
            || !files.insert(prompt_file.clone())
            || !files.insert(response_file.clone())
        {
            return Err(invalid(
                "distillation prompt and response file paths must be unique",
            ));
        }
        if let Some(history_file) = &history_file {
            if history_file == &prompt_file
                || history_file == &response_file
                || !files.insert(history_file.clone())
            {
                return Err(invalid(
                    "distillation history, prompt, and response file paths must be unique",
                ));
            }
        }
        require_record_equal(&fields, &prefix, "target_kind", TARGET_KIND)?;
        require_record_equal(&fields, &prefix, "teacher_reasoning_included", "false")?;
        let source_id = value("source_id")?.to_string();
        let source_license = value("source_license")?.to_string();
        let source_record_id = value("source_record_id")?.to_string();
        validate_evidence_value(&source_id, "source_id")?;
        validate_evidence_value(&source_license, "source_license")?;
        validate_evidence_value(&source_record_id, "source_record_id")?;
        records.push(SourceRecord {
            id,
            task_family,
            history_file,
            history_message_count,
            prompt_file,
            response_file,
            source_id,
            source_license,
            source_record_id,
        });
    }
    Ok(DatasetSource {
        source_version,
        manifest_text,
        fields,
        records,
    })
}

fn load_records(dataset_root: &Path, records: Vec<SourceRecord>) -> io::Result<Vec<LoadedRecord>> {
    records
        .into_iter()
        .map(|source| {
            let prompt = read_record_text(dataset_root, &source.prompt_file, "prompt")?;
            let response = read_record_text(dataset_root, &source.response_file, "response")?;
            let (history_conversation, history_bytes, history_sha256, history_payload) =
                if let Some(history_file) = &source.history_file {
                    let history_text = read_history_text(dataset_root, history_file)?;
                    let history = parse_role_history(
                        &history_text,
                        source.history_message_count,
                        &source.id,
                    )?;
                    let conversation = render_role_conversation(&history.messages, &prompt);
                    let bytes = history_text.len();
                    let sha256 = sha256_bytes(history_text.as_bytes());
                    (Some(conversation), bytes, Some(sha256), Some(history_text))
                } else {
                    (None, 0, None, None)
                };
            reject_hidden_reasoning(&prompt, &source.id)?;
            reject_hidden_reasoning(&response, &source.id)?;
            reject_likely_secret(&prompt, &source.id)?;
            reject_likely_secret(&response, &source.id)?;
            let prompt_sha256 = sha256_bytes(prompt.as_bytes());
            let response_sha256 = sha256_bytes(response.as_bytes());
            let mut pair = Vec::with_capacity(
                history_bytes
                    + prompt.len()
                    + response.len()
                    + usize::from(history_payload.is_some())
                    + 1,
            );
            if let Some(history_payload) = &history_payload {
                pair.extend_from_slice(history_payload.as_bytes());
                pair.push(0);
            }
            pair.extend_from_slice(prompt.as_bytes());
            pair.push(0);
            pair.extend_from_slice(response.as_bytes());
            Ok(LoadedRecord {
                history_conversation,
                history_bytes,
                history_sha256,
                prompt_bytes: prompt.len(),
                response_bytes: response.len(),
                prompt_sha256,
                response_sha256,
                training_pair_sha256: sha256_bytes(&pair),
                source,
                prompt,
                response,
            })
        })
        .collect()
}

fn read_history_text(dataset_root: &Path, relative: &str) -> io::Result<String> {
    validate_history_path(relative)?;
    read_dataset_record_text(dataset_root, relative, "history")
}

fn parse_role_history(
    text: &str,
    expected_message_count: usize,
    record_id: &str,
) -> io::Result<RoleHistory> {
    let fields = parse_json_object(text)
        .map_err(|_| invalid("distillation role history is invalid JSON"))?;
    let history = role_history_from_json(fields)?;
    if history.schema != ROLE_HISTORY_SCHEMA {
        return Err(invalid("distillation role history schema is unsupported"));
    }
    if history.messages.len() != expected_message_count
        || !(2..=12).contains(&history.messages.len())
        || !history.messages.len().is_multiple_of(2)
    {
        return Err(invalid(
            "distillation role history must match 1..=6 complete turns",
        ));
    }
    for (index, message) in history.messages.iter().enumerate() {
        let expected_role = if index.is_multiple_of(2) {
            "user"
        } else {
            "assistant"
        };
        if message.role != expected_role {
            return Err(invalid(&format!(
                "distillation role history message {index} must have role {expected_role}"
            )));
        }
        if message.content.trim().is_empty()
            || message.content.contains('\0')
            || message.content.len() > MAX_RECORD_BYTES as usize
        {
            return Err(invalid("distillation role history content is invalid"));
        }
        reject_hidden_reasoning(&message.content, record_id)?;
        reject_likely_secret(&message.content, record_id)?;
    }
    Ok(history)
}

fn role_history_from_json(fields: Vec<(String, JsonValue)>) -> io::Result<RoleHistory> {
    let mut schema = None;
    let mut messages = None;
    for (key, value) in fields {
        let destination = match key.as_str() {
            "schema" => &mut schema,
            "messages" => &mut messages,
            _ => {
                return Err(invalid(
                    "distillation role history contains an unknown field",
                ));
            }
        };
        if destination.replace(value).is_some() {
            return Err(invalid(
                "distillation role history contains a duplicate field",
            ));
        }
    }
    let schema = match schema {
        Some(JsonValue::String(value)) => value,
        Some(_) => {
            return Err(invalid("distillation role history schema must be a string"));
        }
        None => return Err(invalid("distillation role history schema is required")),
    };
    let messages = match messages {
        Some(JsonValue::Array(values)) => values
            .into_iter()
            .map(role_message_from_json)
            .collect::<io::Result<Vec<_>>>()?,
        Some(_) => {
            return Err(invalid(
                "distillation role history messages must be an array",
            ));
        }
        None => return Err(invalid("distillation role history messages are required")),
    };
    Ok(RoleHistory { schema, messages })
}

fn role_message_from_json(value: JsonValue) -> io::Result<RoleMessage> {
    let JsonValue::Object(fields) = value else {
        return Err(invalid(
            "distillation role history message must be an object",
        ));
    };
    let mut role = None;
    let mut content = None;
    for (key, value) in fields {
        let destination = match key.as_str() {
            "role" => &mut role,
            "content" => &mut content,
            _ => {
                return Err(invalid(
                    "distillation role history message contains an unknown field",
                ));
            }
        };
        if destination.replace(value).is_some() {
            return Err(invalid(
                "distillation role history message contains a duplicate field",
            ));
        }
    }
    let role = match role {
        Some(JsonValue::String(value)) => value,
        Some(_) => {
            return Err(invalid(
                "distillation role history message role must be a string",
            ));
        }
        None => {
            return Err(invalid(
                "distillation role history message role is required",
            ));
        }
    };
    let content = match content {
        Some(JsonValue::String(value)) => value,
        Some(_) => {
            return Err(invalid(
                "distillation role history message content must be a string",
            ));
        }
        None => {
            return Err(invalid(
                "distillation role history message content is required",
            ));
        }
    };
    Ok(RoleMessage { role, content })
}

fn render_role_conversation(messages: &[RoleMessage], active_prompt: &str) -> String {
    let mut text = String::new();
    for message in messages {
        text.push_str(&message.content);
        text.push_str("\n\n");
    }
    text.push_str(active_prompt);
    text
}

fn read_exclusions(paths: &[PathBuf]) -> io::Result<Vec<ExclusionSet>> {
    let mut seen = HashSet::new();
    paths
        .iter()
        .map(|path| {
            let canonical = fs::canonicalize(path)?;
            if !seen.insert(canonical.clone()) {
                return Err(invalid("eval exclusion paths must be unique"));
            }
            let text = read_bounded_text(&canonical, MAX_MANIFEST_BYTES, "eval exclusion")?;
            let prompts = parse_materialized_eval_prompts(&text)?;
            Ok(ExclusionSet {
                path: canonical.display().to_string(),
                bytes: text.len(),
                sha256: sha256_bytes(text.as_bytes()),
                prompts,
            })
        })
        .collect()
}

fn parse_materialized_eval_prompts(text: &str) -> io::Result<Vec<String>> {
    let fields = parse_manifest(text, "eval exclusion")?;
    require_equal(&fields, "tinyrustlm_eval_cases_version", "1")?;
    let holdout_count = fields
        .get("holdout_count")
        .map(|value| value.parse::<usize>())
        .transpose()
        .map_err(|_| invalid("eval exclusion holdout_count must be an integer"))?
        .unwrap_or(0);
    if holdout_count != 0 {
        return Err(invalid(
            "eval exclusions with generated holdouts must be materialized before dataset freeze",
        ));
    }
    let case_count = parse_usize(&fields, "case_count")?;
    if case_count == 0 {
        return Err(invalid("eval exclusion must contain at least one case"));
    }
    let mut prompts = Vec::with_capacity(case_count * 2);
    for index in 0..case_count {
        let prompt = require_key(&fields, &format!("case.{index}.prompt"))?;
        if normalized_words(prompt).is_empty() {
            return Err(invalid(
                "eval exclusion prompt is empty after normalization",
            ));
        }
        prompts.push(prompt.to_string());

        let history_count_key = format!("case.{index}.history_turn_count");
        if let Some(history_turn_count) = fields.get(&history_count_key) {
            let history_turn_count = history_turn_count
                .parse::<usize>()
                .map_err(|_| invalid("eval exclusion history_turn_count must be an integer"))?;
            if !(1..=6).contains(&history_turn_count) {
                return Err(invalid(
                    "eval exclusion history_turn_count must be in 1..=6",
                ));
            }
            let mut messages = Vec::with_capacity(history_turn_count * 2);
            for turn in 0..history_turn_count {
                messages.push(RoleMessage {
                    role: "user".to_string(),
                    content: require_key(&fields, &format!("case.{index}.history.{turn}.user"))?
                        .to_string(),
                });
                messages.push(RoleMessage {
                    role: "assistant".to_string(),
                    content: require_key(
                        &fields,
                        &format!("case.{index}.history.{turn}.assistant"),
                    )?
                    .to_string(),
                });
            }
            prompts.push(render_role_conversation(&messages, prompt));
        }
    }
    Ok(prompts)
}

fn validate_contamination(records: &[LoadedRecord], exclusions: &[ExclusionSet]) -> io::Result<()> {
    let mut exact = HashMap::new();
    let mut ngrams = HashMap::new();
    for exclusion in exclusions {
        for prompt in &exclusion.prompts {
            let words = normalized_words(prompt);
            exact.insert(words.join(" "), exclusion.path.as_str());
            for ngram in word_ngrams(&words) {
                ngrams.entry(ngram).or_insert(exclusion.path.as_str());
            }
        }
    }

    for record in records {
        let mut contents = vec![
            ("prompt", record.prompt.as_str()),
            ("response", record.response.as_str()),
        ];
        if let Some(history_conversation) = &record.history_conversation {
            contents.push(("role history", history_conversation.as_str()));
        }
        for (label, content) in contents {
            let words = normalized_words(content);
            let normalized = words.join(" ");
            if let Some(path) = exact.get(&normalized) {
                return Err(invalid(&format!(
                    "distillation record {} {label} exactly matches eval exclusion {path}",
                    record.source.id
                )));
            }
            for ngram in word_ngrams(&words) {
                if let Some(path) = ngrams.get(&ngram) {
                    return Err(invalid(&format!(
                        "distillation record {} {label} shares eval five-gram `{ngram}` with {path}",
                        record.source.id
                    )));
                }
            }
        }
    }
    Ok(())
}

fn read_record_text(dataset_root: &Path, relative: &str, label: &str) -> io::Result<String> {
    validate_record_path(relative, label)?;
    read_dataset_record_text(dataset_root, relative, label)
}

fn read_dataset_record_text(
    dataset_root: &Path,
    relative: &str,
    label: &str,
) -> io::Result<String> {
    let path = dataset_root.join(relative);
    let metadata = fs::symlink_metadata(&path)?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(invalid(&format!(
            "distillation {label} must be a regular non-symlink file"
        )));
    }
    let canonical = fs::canonicalize(&path)?;
    if !canonical.starts_with(dataset_root) {
        return Err(invalid(&format!(
            "distillation {label} escaped the dataset directory"
        )));
    }
    let text = read_bounded_text(&canonical, MAX_RECORD_BYTES, label)?;
    if text.trim().is_empty() || text.contains('\0') {
        return Err(invalid(&format!(
            "distillation {label} must contain nonempty UTF-8 text without NUL bytes"
        )));
    }
    Ok(text)
}

fn read_bounded_text(path: &Path, max_bytes: u64, label: &str) -> io::Result<String> {
    let metadata = fs::metadata(path)?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > max_bytes {
        return Err(invalid(&format!(
            "{label} byte length must be in 1..={max_bytes}"
        )));
    }
    fs::read_to_string(path)
        .map_err(|error| invalid(&format!("{label} must be valid UTF-8: {error}")))
}

fn reject_hidden_reasoning(text: &str, record_id: &str) -> io::Result<()> {
    let lower = text.to_ascii_lowercase();
    if [
        "<think>",
        "</think>",
        "<|thinking|>",
        "chain of thought:",
        "hidden reasoning:",
        "private scratchpad:",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
    {
        return Err(invalid(&format!(
            "distillation record {record_id} contains hidden reasoning material"
        )));
    }
    Ok(())
}

fn reject_likely_secret(text: &str, record_id: &str) -> io::Result<()> {
    let lower = text.to_ascii_lowercase();
    if [
        "-----begin private key-----",
        "-----begin rsa private key-----",
        "authorization: bearer ",
        "nuget-api-key",
        "aws_secret_access_key",
        "client_secret=",
        "database_password=",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
    {
        return Err(invalid(&format!(
            "distillation record {record_id} contains likely secret material"
        )));
    }
    Ok(())
}

fn validate_record_path(value: &str, label: &str) -> io::Result<()> {
    let path = Path::new(value);
    if path.is_absolute() || path.extension().and_then(|value| value.to_str()) != Some("txt") {
        return Err(invalid(&format!(
            "distillation {label} must be a relative .txt path"
        )));
    }
    let mut components = path.components();
    if components.next() != Some(Component::Normal("records".as_ref()))
        || components.any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(invalid(&format!(
            "distillation {label} must stay under records/"
        )));
    }
    Ok(())
}

fn validate_history_path(value: &str) -> io::Result<()> {
    let path = Path::new(value);
    if path.is_absolute() || path.extension().and_then(|value| value.to_str()) != Some("json") {
        return Err(invalid(
            "distillation history_file must be a relative .json path",
        ));
    }
    let mut components = path.components();
    if components.next() != Some(Component::Normal("records".as_ref()))
        || components.any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(invalid(
            "distillation history_file must stay under records/",
        ));
    }
    Ok(())
}

fn reject_unknown_source_keys(
    fields: &HashMap<String, String>,
    record_count: usize,
    source_version: &str,
) -> io::Result<()> {
    let mut allowed = GLOBAL_SOURCE_KEYS
        .iter()
        .map(|key| (*key).to_string())
        .collect::<HashSet<_>>();
    allowed.insert("tokenizer_alignment".to_string());
    allowed.insert("record_count".to_string());
    for index in 0..record_count {
        let record_keys: &[&str] = if source_version == SOURCE_VERSION_V2 {
            &RECORD_SOURCE_KEYS_V2
        } else {
            &RECORD_SOURCE_KEYS
        };
        for key in record_keys {
            allowed.insert(format!("record.{index}.{key}"));
        }
    }
    if let Some(key) = fields.keys().find(|key| !allowed.contains(*key)) {
        return Err(invalid(&format!(
            "distillation dataset source has unknown key {key}"
        )));
    }
    Ok(())
}

fn parse_manifest(text: &str, label: &str) -> io::Result<HashMap<String, String>> {
    let mut fields = HashMap::new();
    for (line_index, raw_line) in text.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            return Err(invalid(&format!(
                "{label} line {} is missing '='",
                line_index + 1
            )));
        };
        let key = key.trim();
        let value = value.trim();
        if key.is_empty()
            || !key
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_'))
            || value.is_empty()
        {
            return Err(invalid(&format!(
                "{label} line {} has an invalid key or value",
                line_index + 1
            )));
        }
        if fields.insert(key.to_string(), value.to_string()).is_some() {
            return Err(invalid(&format!("duplicate {label} key {key}")));
        }
    }
    Ok(fields)
}

fn normalized_words(text: &str) -> Vec<String> {
    text.split(|ch: char| !ch.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(|word| word.to_lowercase())
        .collect()
}

fn word_ngrams(words: &[String]) -> impl Iterator<Item = String> + '_ {
    words
        .windows(NGRAM_WORD_COUNT)
        .map(|window| window.join(" "))
}

fn require_record_equal(
    fields: &HashMap<String, String>,
    prefix: &str,
    key: &str,
    expected: &str,
) -> io::Result<()> {
    require_equal(fields, &format!("{prefix}.{key}"), expected)
}

fn require_sha256(fields: &HashMap<String, String>, key: &str) -> io::Result<()> {
    let value = require_key(fields, key)?;
    let Some(hex) = value.strip_prefix("sha256:") else {
        return Err(invalid(&format!("{key} must start with sha256:")));
    };
    if hex.len() != 64 || !hex.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(invalid(&format!(
            "{key} must contain exactly 64 hexadecimal digits"
        )));
    }
    Ok(())
}

fn parse_usize(fields: &HashMap<String, String>, key: &str) -> io::Result<usize> {
    require_key(fields, key)?
        .parse::<usize>()
        .map_err(|_| invalid(&format!("{key} must be an unsigned integer")))
}

fn validate_slug(value: &str, key: &str) -> io::Result<()> {
    if value.is_empty()
        || value.len() > 128
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err(invalid(&format!("{key} must be a stable ASCII slug")));
    }
    Ok(())
}

fn validate_evidence_value(value: &str, key: &str) -> io::Result<()> {
    if value.is_empty()
        || value.len() > 512
        || value.contains(['\r', '\n', '\0'])
        || value.trim() != value
    {
        return Err(invalid(&format!("{key} has an invalid evidence value")));
    }
    Ok(())
}

fn require_key<'a>(fields: &'a HashMap<String, String>, key: &str) -> io::Result<&'a str> {
    fields
        .get(key)
        .map(String::as_str)
        .ok_or_else(|| invalid(&format!("manifest missing required key {key}")))
}

fn require_equal(fields: &HashMap<String, String>, key: &str, expected: &str) -> io::Result<()> {
    let actual = require_key(fields, key)?;
    if actual != expected {
        return Err(invalid(&format!(
            "manifest key {key} was {actual}, expected {expected}"
        )));
    }
    Ok(())
}

fn sha256_bytes(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}

fn push_line(text: &mut String, key: &str, value: &str) {
    text.push_str(key);
    text.push('=');
    text.push_str(value);
    text.push('\n');
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn freezes_and_revalidates_hash_bound_uncontaminated_dataset() {
        let root = fixture_root("valid");
        let exclusion = write_fixture(&root, "A user asks for the capital of France.");
        write_dataset(
            &root,
            "Explain why local execution can reduce network exposure.",
            "Local execution can keep prompt text on the device instead of sending it to a remote service.",
        );
        let output = root.join("distillation-dataset.manifest");

        freeze_dataset_path(&root, &output, std::slice::from_ref(&exclusion)).unwrap();
        validate_dataset_path(&root, &output, std::slice::from_ref(&exclusion)).unwrap();

        let text = fs::read_to_string(output).unwrap();
        assert!(text.contains("dataset_status=frozen"));
        assert!(text.contains("contamination_status=pass"));
        assert!(text.contains("teacher_reasoning_included=false"));
        assert!(text.contains("prompt_sha256=sha256:"));
    }

    #[test]
    fn rejects_exact_eval_prompt_contamination() {
        let root = fixture_root("exact-contamination");
        let prompt = "Why does solid ice float on liquid water?";
        let exclusion = write_fixture(&root, prompt);
        write_dataset(
            &root,
            prompt,
            "Because solid ice is less dense than liquid water.",
        );

        let error = build_frozen_manifest_text(&root, &[exclusion]).unwrap_err();

        assert!(error.to_string().contains("exactly matches eval exclusion"));
    }

    #[test]
    fn rejects_five_word_eval_overlap() {
        let root = fixture_root("ngram-contamination");
        let exclusion = write_fixture(
            &root,
            "Explain this Rust function in plain English and name its return value.",
        );
        write_dataset(
            &root,
            "Please explain this Rust function in plain English for a beginner.",
            "It returns the sum of both inputs.",
        );

        let error = build_frozen_manifest_text(&root, &[exclusion]).unwrap_err();

        assert!(error.to_string().contains("shares eval five-gram"));
    }

    #[test]
    fn rejects_hidden_reasoning_and_unsafe_record_paths() {
        let root = fixture_root("unsafe");
        let exclusion = write_fixture(&root, "Give a concise greeting.");
        write_dataset(
            &root,
            "Summarize this unrelated note.",
            "<think>private reasoning</think> A concise answer.",
        );
        let hidden =
            build_frozen_manifest_text(&root, std::slice::from_ref(&exclusion)).unwrap_err();
        assert!(hidden.to_string().contains("hidden reasoning"));

        let manifest = fs::read_to_string(root.join(SOURCE_MANIFEST_NAME))
            .unwrap()
            .replace("records/one.prompt.txt", "../one.prompt.txt");
        fs::write(root.join(SOURCE_MANIFEST_NAME), manifest).unwrap();
        let unsafe_path = build_frozen_manifest_text(&root, &[exclusion]).unwrap_err();
        assert!(unsafe_path.to_string().contains("must stay under records/"));
    }

    #[test]
    fn rejects_unmaterialized_generated_holdouts() {
        let root = fixture_root("holdout");
        let exclusion = root.join("eval.txt");
        fs::write(
            &exclusion,
            "tinyrustlm_eval_cases_version=1\ncase_count=1\nholdout_count=1\ncase.0.prompt=hello\n",
        )
        .unwrap();
        write_dataset(&root, "Explain local execution.", "It runs on the device.");

        let error = build_frozen_manifest_text(&root, &[exclusion]).unwrap_err();

        assert!(error.to_string().contains("must be materialized"));
    }

    #[test]
    fn freezes_and_revalidates_structured_role_history() {
        let root = fixture_root("structured-history");
        let exclusion = write_fixture(&root, "Name two colors in a rainbow.");
        write_structured_dataset(
            &root,
            "Which preference is current?",
            "Use the latest preference for this answer.",
            r#"{"schema":"tinyrustlm.role_history.v1","messages":[{"role":"user","content":"The old profile used metric units."},{"role":"assistant","content":"I recorded the old metric preference."}]}"#,
        );
        let output = root.join("distillation-dataset.manifest");

        freeze_dataset_path(&root, &output, std::slice::from_ref(&exclusion)).unwrap();
        validate_dataset_path(&root, &output, std::slice::from_ref(&exclusion)).unwrap();

        let text = fs::read_to_string(&output).unwrap();
        assert!(text.contains("tinyrustlm_distillation_dataset_version=2"));
        assert!(text.contains("history_message_count=2"));
        assert!(text.contains("history_sha256=sha256:"));

        let history = root.join("records/one.history.json");
        let changed = fs::read_to_string(&history)
            .unwrap()
            .replace("metric preference", "metric selection");
        fs::write(history, changed).unwrap();
        let error = validate_dataset_path(&root, &output, &[exclusion]).unwrap_err();
        assert!(error
            .to_string()
            .contains("does not match recomputed evidence"));
    }

    #[test]
    fn rejects_role_history_overlap_with_full_multi_turn_exclusion() {
        let root = fixture_root("structured-history-contamination");
        let exclusion = root.join("eval.txt");
        fs::write(
            &exclusion,
            "tinyrustlm_eval_cases_version=1\ncase_count=1\n\
case.0.prompt=Which units should you use now?\n\
case.0.history_turn_count=1\n\
case.0.history.0.user=An archived profile says all measurements use metric units.\n\
case.0.history.0.assistant=I recorded that archived metric preference for later.\n",
        )
        .unwrap();
        write_structured_dataset(
            &root,
            "What measurement style is current?",
            "Ask for the user's current preference.",
            r#"{"schema":"tinyrustlm.role_history.v1","messages":[{"role":"user","content":"An archived profile says all measurements use metric units."},{"role":"assistant","content":"I recorded that archived metric preference for later."}]}"#,
        );

        let error = build_frozen_manifest_text(&root, &[exclusion]).unwrap_err();

        assert!(error
            .to_string()
            .contains("role history shares eval five-gram"));
    }

    #[test]
    fn rejects_wrong_role_order_and_secrets_inside_history() {
        let root = fixture_root("structured-history-invalid-role");
        let exclusion = write_fixture(&root, "Name two colors in a rainbow.");
        write_structured_dataset(
            &root,
            "Which preference is current?",
            "Use the latest preference.",
            r#"{"schema":"tinyrustlm.role_history.v1","messages":[{"role":"assistant","content":"The user spoke first."},{"role":"user","content":"This order is invalid."}]}"#,
        );
        let error =
            build_frozen_manifest_text(&root, std::slice::from_ref(&exclusion)).unwrap_err();
        assert!(error.to_string().contains("message 0 must have role user"));

        fs::write(
            root.join("records/one.history.json"),
            r#"{"schema":"tinyrustlm.role_history.v1","messages":[{"role":"user","content":"Authorization: Bearer protected-value"},{"role":"assistant","content":"I will not repeat it."}]}"#,
        )
        .unwrap();
        let error = build_frozen_manifest_text(&root, &[exclusion]).unwrap_err();
        assert!(error.to_string().contains("likely secret material"));
    }

    #[test]
    fn rejects_unknown_and_duplicate_role_history_fields_without_serde() {
        let root = fixture_root("structured-history-strict-json");
        let exclusion = write_fixture(&root, "Name two colors in a rainbow.");
        write_structured_dataset(
            &root,
            "Which preference is current?",
            "Use the latest preference.",
            r#"{"schema":"tinyrustlm.role_history.v1","extra":true,"messages":[{"role":"user","content":"The old preference was tea."},{"role":"assistant","content":"I recorded tea."}]}"#,
        );
        let error =
            build_frozen_manifest_text(&root, std::slice::from_ref(&exclusion)).unwrap_err();
        assert!(error.to_string().contains("unknown field"));

        fs::write(
            root.join("records/one.history.json"),
            r#"{"schema":"tinyrustlm.role_history.v1","messages":[{"role":"user","role":"assistant","content":"Duplicate roles are invalid."},{"role":"assistant","content":"This record must fail."}]}"#,
        )
        .unwrap();
        let error = build_frozen_manifest_text(&root, &[exclusion]).unwrap_err();
        assert!(error.to_string().contains("duplicate field"));
    }

    fn write_dataset(root: &Path, prompt: &str, response: &str) {
        let records = root.join("records");
        fs::create_dir_all(&records).unwrap();
        fs::write(records.join("one.prompt.txt"), prompt).unwrap();
        fs::write(records.join("one.response.txt"), response).unwrap();
        fs::write(root.join(SOURCE_MANIFEST_NAME), source_manifest()).unwrap();
    }

    fn write_structured_dataset(root: &Path, prompt: &str, response: &str, history: &str) {
        let records = root.join("records");
        fs::create_dir_all(&records).unwrap();
        fs::write(records.join("one.history.json"), history).unwrap();
        fs::write(records.join("one.prompt.txt"), prompt).unwrap();
        fs::write(records.join("one.response.txt"), response).unwrap();
        fs::write(root.join(SOURCE_MANIFEST_NAME), source_manifest_v2()).unwrap();
    }

    fn source_manifest() -> String {
        let hash = format!("sha256:{}", "a".repeat(64));
        format!(
            "tinyrustlm_distillation_dataset_source_version=1\n\
dataset_id=unit-test-distillation\n\
dataset_split=train\n\
dataset_license_route=reviewed-test-license-ledger\n\
dataset_purpose=unit-test-sequence-distillation\n\
teacher_model_id=teacher/model\n\
teacher_revision=teacher-revision\n\
teacher_weight_sha256={hash}\n\
teacher_tokenizer_sha256={hash}\n\
teacher_generation_profile=teacher-final-answer-v1\n\
student_model_id=student/model\n\
student_revision=student-revision\n\
student_weight_sha256={hash}\n\
student_tokenizer_sha256={hash}\n\
tokenizer_alignment=cross-tokenizer-sequence-only\n\
record_count=1\n\
record.0.id=one\n\
record.0.task_family=factual-qa\n\
record.0.prompt_file=records/one.prompt.txt\n\
record.0.response_file=records/one.response.txt\n\
record.0.source_id=unit-test-source\n\
record.0.source_license=unit-test-only\n\
record.0.source_record_id=source-one\n\
record.0.target_kind=teacher-final-answer\n\
record.0.teacher_reasoning_included=false\n"
        )
    }

    fn source_manifest_v2() -> String {
        source_manifest()
            .replace(
                "tinyrustlm_distillation_dataset_source_version=1",
                "tinyrustlm_distillation_dataset_source_version=2",
            )
            .replace(
                "record.0.task_family=factual-qa\n",
                "record.0.task_family=factual-qa\n\
record.0.history_file=records/one.history.json\n\
record.0.history_message_count=2\n",
            )
    }

    fn write_fixture(root: &Path, prompt: &str) -> PathBuf {
        let path = root.join("eval.txt");
        fs::write(
            &path,
            format!("tinyrustlm_eval_cases_version=1\ncase_count=1\ncase.0.prompt={prompt}\n"),
        )
        .unwrap();
        path
    }

    fn fixture_root(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "tinyrustlm-distillation-{label}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }
}
