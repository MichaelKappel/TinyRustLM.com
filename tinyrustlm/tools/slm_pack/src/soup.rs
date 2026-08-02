//! Seed-weighted multi-parent soup candidates built from parent-pool recipes.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::blend::{
    hex64, invalid, output_specs, parse_manifest, parse_model_values, push_line, require_equal,
    require_key, require_report_equal, require_same_tensor_spec, same_shape, ParsedModel,
};
use crate::build_model_file_from_values_with_flags;
use crate::parent_pool;
use crate::provenance;
use crate::slm_validate::{self, ValidationReport};

const OPERATOR_VERSION: &str = "1";
const OPERATOR_KIND: &str = "seed-weighted-parent-pool-soup";
const OPERATOR_STATUS: &str = "candidate-written";
const STANDARD_OPERATOR_ID: &str = "parent-pool-soup-v1";
const STANDARD_CANDIDATE_ID_PREFIX: &str = "soup";
const SOUP_MERGE_RULE: &str = "seed-weighted-direct-parameter-average";
const SOUP_WEIGHT_SOURCE: &str = "parent-pool-seed-weight-ppm";
const SOUP_WEIGHT_UNIT: &str = "parts-per-million";
const PARENT_CONTRACT: &str = "matches-parent-pool-direct-parameter-contract";
const OPERATOR_OUTPUT_STATUS: &str = "slm-validated";
const REQUIRED_NEXT_GATE: &str = "candidate-manifest-plus-runtime-smoke-plus-eval";
const PPM_DENOMINATOR: u64 = 1_000_000;
const RELATEDNESS_KEYS: [&str; 5] = [
    "relatedness_metric",
    "relatedness_scope",
    "relatedness_pair_count",
    "relatedness_all_pairs_status",
    "relatedness_contract_checksum",
];
const EVOLUTION_RECIPE_KEYS: [&str; 7] = [
    "evolution_recipe_version",
    "evolution_recipe_strategy",
    "evolution_recipe_status",
    "evolution_selection_source",
    "evolution_relatedness_contract_checksum",
    "evolution_schedule_checksum_algorithm",
    "evolution_schedule_checksum",
];

#[derive(Clone)]
struct RecipeParent {
    rank: String,
    role: String,
    selection_status: String,
    source_review_entry: String,
    source_ledger_entry: String,
    candidate_id: String,
    selector_id: String,
    operator_id: String,
    resource_budget: String,
    candidate_artifact_path: String,
    candidate_artifact_bytes: String,
    candidate_slm_checksum: String,
    candidate_model_shape: String,
    candidate_quantization: String,
    candidate_output_contract: String,
    candidate_tokenizer_checksum: String,
    candidate_tensor_layout_checksum: String,
    relatedness_group: String,
    relatedness_contract_checksum: String,
    population_fitness_ppm: String,
    seed_weight_ppm: u64,
    next_route: String,
}

struct ParentArtifact {
    path: String,
    seed_weight_ppm: u64,
    report: ValidationReport,
    model: ParsedModel,
}

#[derive(Default)]
struct SoupStats {
    total_parameter_count: u64,
    parent_weight_checksum: u64,
    weighted_value_checksum: u64,
    changed_from_frontier_count: u64,
    changed_from_frontier_density_ppm: u64,
}

/// Writes a seed-weighted parent-pool soup `.slm` candidate plus a receipt.
pub(crate) fn write_candidate_path(
    ledger: &Path,
    review: &Path,
    recipe: &Path,
    output_slm: &Path,
    output_receipt: &Path,
    parent_paths: &[String],
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_texts(admission_paths, "soup-candidate admissions")?;
    let parent_bytes = read_bytes(parent_paths, "soup-candidate parents")?;
    let ledger_text = fs::read_to_string(ledger)?;
    let review_text = fs::read_to_string(review)?;
    let recipe_text = fs::read_to_string(recipe)?;
    let (candidate, receipt) = build_candidate_bytes_and_receipt(
        &ledger_text,
        &review_text,
        &recipe_text,
        &parent_bytes,
        output_slm.display().to_string().as_str(),
        &admission_texts,
    )?;
    if let Some(parent) = output_slm.parent() {
        fs::create_dir_all(parent)?;
    }
    if let Some(parent) = output_receipt.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_slm, candidate)?;
    fs::write(output_receipt, receipt)?;
    println!(
        "SLM parent-pool soup candidate written: {}",
        output_slm.display()
    );
    println!(
        "SLM parent-pool soup receipt written: {}",
        output_receipt.display()
    );
    Ok(())
}

/// Validates a seed-weighted parent-pool soup candidate by exact recomputation.
pub(crate) fn validate_candidate_path(
    ledger: &Path,
    review: &Path,
    recipe: &Path,
    candidate_slm: &Path,
    receipt: &Path,
    parent_paths: &[String],
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_texts(admission_paths, "validate-soup-candidate admissions")?;
    let parent_bytes = read_bytes(parent_paths, "validate-soup-candidate parents")?;
    let ledger_text = fs::read_to_string(ledger)?;
    let review_text = fs::read_to_string(review)?;
    let recipe_text = fs::read_to_string(recipe)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let receipt_text = fs::read_to_string(receipt)?;
    validate_candidate_text(
        &ledger_text,
        &review_text,
        &recipe_text,
        &parent_bytes,
        &candidate_bytes,
        candidate_slm.display().to_string().as_str(),
        &receipt_text,
        &admission_texts,
    )?;
    println!("SLM parent-pool soup candidate validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("receipt: {}", receipt.display());
    Ok(())
}

// Reads the admission sidecar texts that bind the recipe inputs.
fn read_texts(paths: &[String], label: &str) -> io::Result<Vec<String>> {
    if paths.is_empty() {
        return Err(invalid(&format!("{label} require at least one input")));
    }
    paths
        .iter()
        .map(|path| fs::read_to_string(Path::new(path)))
        .collect()
}

// Reads parent model bytes while requiring the multi-parent lane shape.
fn read_bytes(paths: &[String], label: &str) -> io::Result<Vec<(String, Vec<u8>)>> {
    if paths.len() < 2 {
        return Err(invalid(&format!(
            "{label} require at least two parent models"
        )));
    }
    paths
        .iter()
        .map(|path| Ok((path.clone(), fs::read(Path::new(path))?)))
        .collect()
}

/// Validates candidate bytes and receipt text by rebuilding both artifacts.
pub(crate) fn validate_candidate_text(
    ledger_text: &str,
    review_text: &str,
    recipe_text: &str,
    parent_bytes: &[(String, Vec<u8>)],
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
    admission_texts: &[String],
) -> io::Result<()> {
    let receipt_fields = parse_manifest(receipt_text, "soup operator receipt")?;
    require_equal(
        &receipt_fields,
        "tinyrustlm_soup_operator_version",
        OPERATOR_VERSION,
    )?;
    require_equal(&receipt_fields, "operator_kind", OPERATOR_KIND)?;
    require_equal(&receipt_fields, "soup_merge_rule", SOUP_MERGE_RULE)?;
    require_equal(&receipt_fields, "soup_weight_source", SOUP_WEIGHT_SOURCE)?;
    require_equal(&receipt_fields, "soup_weight_unit", SOUP_WEIGHT_UNIT)?;
    let (expected_candidate, expected_receipt) = build_candidate_bytes_and_receipt(
        ledger_text,
        review_text,
        recipe_text,
        parent_bytes,
        candidate_path,
        admission_texts,
    )?;
    if candidate_bytes != expected_candidate {
        return Err(invalid(
            "parent-pool soup candidate bytes do not match recomputed output",
        ));
    }
    if receipt_text != expected_receipt {
        return Err(invalid(
            "parent-pool soup receipt fields do not match recomputed output",
        ));
    }
    Ok(())
}

/// Builds a soup `.slm` candidate and the exact operator receipt for it.
pub(crate) fn build_candidate_bytes_and_receipt(
    ledger_text: &str,
    review_text: &str,
    recipe_text: &str,
    parent_bytes: &[(String, Vec<u8>)],
    candidate_path: &str,
    admission_texts: &[String],
) -> io::Result<(Vec<u8>, String)> {
    parent_pool::validate_recipe_text(ledger_text, review_text, recipe_text, admission_texts)?;
    let recipe_fields = parse_manifest(recipe_text, "parent-pool recipe")?;
    let recipe_parents = parse_recipe_parents(&recipe_fields)?;
    if recipe_parents.len() < 2 {
        return Err(invalid("parent-pool soup requires at least two parents"));
    }
    if recipe_parents.len() != parent_bytes.len() {
        return Err(invalid(
            "parent-pool soup parent count does not match recipe",
        ));
    }

    let artifacts = parent_artifacts(parent_bytes, &recipe_parents)?;
    let (output_values, stats) = soup_values(&artifacts)?;
    let output_tensors = output_specs(&artifacts[0].model);
    let candidate = build_model_file_from_values_with_flags(
        &artifacts[0].model.shape,
        &output_tensors,
        &artifacts[0].model.tokenizer,
        &output_values,
        artifacts[0].model.flags,
    )?;
    let candidate_report = slm_validate::validate_bytes(&candidate, candidate_path)?;
    validate_candidate_contract(&recipe_fields, &candidate_report)?;
    let receipt = build_receipt_text(
        &recipe_fields,
        &recipe_parents,
        recipe_text,
        &artifacts,
        &candidate_report,
        stats,
    )?;
    Ok((candidate, receipt))
}

// Extracts ordered parent records and validates their seed weights.
fn parse_recipe_parents(fields: &HashMap<String, String>) -> io::Result<Vec<RecipeParent>> {
    require_equal(fields, "tinyrustlm_parent_pool_recipe_version", "1")?;
    require_equal(fields, "recipe_kind", "sign-aware-parent-pool-v1")?;
    require_equal(
        fields,
        "parent_contract_status",
        "shared-direct-parameter-contract",
    )?;
    let count = parse_usize(require_key(fields, "parent_count")?, "parent_count")?;
    if count == 0 {
        return Err(invalid("parent-pool recipe has no parents"));
    }
    let mut parents = Vec::with_capacity(count);
    let mut seed_total = 0u64;
    for index in 0..count {
        let prefix = format!("parent.{index}");
        let rank = required_prefixed(fields, &prefix, "rank")?;
        let expected_rank = (index + 1).to_string();
        if rank != expected_rank {
            return Err(invalid(&format!(
                "parent-pool recipe parent {index} rank was {rank}, expected {expected_rank}"
            )));
        }
        let role = required_prefixed(fields, &prefix, "role")?;
        if index == 0 && role != "frontier" {
            return Err(invalid("parent-pool recipe parent 0 must be frontier"));
        }
        if index > 0 && role != "parent-pool" {
            return Err(invalid(
                "parent-pool recipe non-frontier parents must use parent-pool role",
            ));
        }
        let seed_weight_ppm =
            parse_seed_weight(&required_prefixed(fields, &prefix, "seed_weight_ppm")?)?;
        seed_total = seed_total
            .checked_add(seed_weight_ppm)
            .ok_or_else(|| invalid("parent-pool recipe seed weight total overflow"))?;
        parents.push(RecipeParent {
            rank,
            role,
            selection_status: required_prefixed(fields, &prefix, "selection_status")?,
            source_review_entry: required_prefixed(fields, &prefix, "source_review_entry")?,
            source_ledger_entry: required_prefixed(fields, &prefix, "source_ledger_entry")?,
            candidate_id: required_prefixed(fields, &prefix, "candidate_id")?,
            selector_id: required_prefixed(fields, &prefix, "selector_id")?,
            operator_id: required_prefixed(fields, &prefix, "operator_id")?,
            resource_budget: required_prefixed(fields, &prefix, "resource_budget")?,
            candidate_artifact_path: required_prefixed(fields, &prefix, "candidate_artifact_path")?,
            candidate_artifact_bytes: required_prefixed(
                fields,
                &prefix,
                "candidate_artifact_bytes",
            )?,
            candidate_slm_checksum: required_prefixed(fields, &prefix, "candidate_slm_checksum")?,
            candidate_model_shape: required_prefixed(fields, &prefix, "candidate_model_shape")?,
            candidate_quantization: required_prefixed(fields, &prefix, "candidate_quantization")?,
            candidate_output_contract: required_prefixed(
                fields,
                &prefix,
                "candidate_output_contract",
            )?,
            candidate_tokenizer_checksum: required_prefixed(
                fields,
                &prefix,
                "candidate_tokenizer_checksum",
            )?,
            candidate_tensor_layout_checksum: required_prefixed(
                fields,
                &prefix,
                "candidate_tensor_layout_checksum",
            )?,
            relatedness_group: required_prefixed(fields, &prefix, "relatedness_group")?,
            relatedness_contract_checksum: required_prefixed(
                fields,
                &prefix,
                "relatedness_contract_checksum",
            )?,
            population_fitness_ppm: required_prefixed(fields, &prefix, "population_fitness_ppm")?,
            seed_weight_ppm,
            next_route: required_prefixed(fields, &prefix, "next_route")?,
        });
    }
    if seed_total != PPM_DENOMINATOR {
        return Err(invalid(
            "parent-pool recipe seed weights must sum to 1000000",
        ));
    }
    Ok(parents)
}

// Validates each supplied parent against the recipe before tensor access.
fn parent_artifacts(
    parent_bytes: &[(String, Vec<u8>)],
    recipe_parents: &[RecipeParent],
) -> io::Result<Vec<ParentArtifact>> {
    let mut artifacts = Vec::with_capacity(parent_bytes.len());
    for ((path, bytes), recipe_parent) in parent_bytes.iter().zip(recipe_parents.iter()) {
        let report = slm_validate::validate_bytes(bytes, path)?;
        require_recipe_parent_report(recipe_parent, &report)?;
        let model = parse_model_values(bytes)?;
        artifacts.push(ParentArtifact {
            path: path.clone(),
            seed_weight_ppm: recipe_parent.seed_weight_ppm,
            report,
            model,
        });
    }
    Ok(artifacts)
}

// Confirms that one recipe parent line still matches its current `.slm` report.
fn require_recipe_parent_report(
    recipe_parent: &RecipeParent,
    report: &ValidationReport,
) -> io::Result<()> {
    require_text_equal(
        "candidate_artifact_bytes",
        &recipe_parent.candidate_artifact_bytes,
        &report.file_bytes().to_string(),
    )?;
    require_text_equal(
        "candidate_slm_checksum",
        &recipe_parent.candidate_slm_checksum,
        &hex64(report.checksum()),
    )?;
    require_text_equal(
        "candidate_model_shape",
        &recipe_parent.candidate_model_shape,
        &report.shape_summary(),
    )?;
    require_text_equal(
        "candidate_quantization",
        &recipe_parent.candidate_quantization,
        report.quantization_label(),
    )?;
    require_text_equal(
        "candidate_output_contract",
        &recipe_parent.candidate_output_contract,
        report.output_contract_label(),
    )?;
    require_text_equal(
        "candidate_tokenizer_checksum",
        &recipe_parent.candidate_tokenizer_checksum,
        &hex64(report.tokenizer_checksum()),
    )?;
    require_text_equal(
        "candidate_tensor_layout_checksum",
        &recipe_parent.candidate_tensor_layout_checksum,
        &hex64(report.tensor_layout_checksum()),
    )?;
    Ok(())
}

// Confirms that the emitted candidate preserves the recipe shared contract.
fn validate_candidate_contract(
    recipe_fields: &HashMap<String, String>,
    report: &ValidationReport,
) -> io::Result<()> {
    require_report_equal(
        recipe_fields,
        "contract_model_shape",
        &report.shape_summary(),
    )?;
    require_report_equal(
        recipe_fields,
        "contract_quantization",
        report.quantization_label(),
    )?;
    require_report_equal(
        recipe_fields,
        "contract_output_contract",
        report.output_contract_label(),
    )?;
    require_report_equal(
        recipe_fields,
        "contract_tokenizer_checksum",
        &hex64(report.tokenizer_checksum()),
    )?;
    require_report_equal(
        recipe_fields,
        "contract_tensor_layout_checksum",
        &hex64(report.tensor_layout_checksum()),
    )?;
    Ok(())
}

// Applies the seed-weighted direct average for every tensor value.
fn soup_values(artifacts: &[ParentArtifact]) -> io::Result<(Vec<Vec<f32>>, SoupStats)> {
    let base = &artifacts
        .first()
        .ok_or_else(|| invalid("parent-pool soup requires a frontier parent"))?
        .model;
    for artifact in artifacts.iter().skip(1) {
        require_compatible_parent(base, &artifact.model)?;
    }
    let parent_tensor_maps = artifacts
        .iter()
        .map(|artifact| {
            artifact
                .model
                .tensors
                .iter()
                .enumerate()
                .map(|(index, tensor)| (tensor.spec.name_hash, index))
                .collect::<HashMap<_, _>>()
        })
        .collect::<Vec<_>>();

    let mut output = Vec::with_capacity(base.tensors.len());
    let mut stats = SoupStats {
        parent_weight_checksum: checksum_seed(0x736f_7570_5f77_7631),
        weighted_value_checksum: checksum_seed(0x736f_7570_5f76_7631),
        ..SoupStats::default()
    };
    for (parent_index, artifact) in artifacts.iter().enumerate() {
        mix_checksum(&mut stats.parent_weight_checksum, parent_index as u64);
        mix_checksum(&mut stats.parent_weight_checksum, artifact.seed_weight_ppm);
        mix_checksum(
            &mut stats.parent_weight_checksum,
            artifact.report.checksum(),
        );
    }
    for (tensor_index, base_tensor) in base.tensors.iter().enumerate() {
        let mut tensor_values = Vec::with_capacity(base_tensor.values.len());
        for (value_index, base_value) in base_tensor.values.iter().enumerate() {
            let mut weighted = 0.0f64;
            for (parent_index, artifact) in artifacts.iter().enumerate() {
                let tensor_map = &parent_tensor_maps[parent_index];
                let Some(parent_tensor_index) = tensor_map.get(&base_tensor.spec.name_hash) else {
                    return Err(invalid(
                        "parent-pool soup parent is missing a tensor from the frontier",
                    ));
                };
                let parent_tensor = &artifact.model.tensors[*parent_tensor_index];
                require_same_tensor_spec(&base_tensor.spec, &parent_tensor.spec)?;
                weighted += parent_tensor.values[value_index] as f64
                    * artifact.seed_weight_ppm as f64
                    / PPM_DENOMINATOR as f64;
            }
            let value = weighted as f32;
            if !value.is_finite() {
                return Err(invalid("parent-pool soup produced a non-finite value"));
            }
            stats.total_parameter_count += 1;
            if value != *base_value {
                stats.changed_from_frontier_count += 1;
            }
            mix_checksum(&mut stats.weighted_value_checksum, tensor_index as u64);
            mix_checksum(&mut stats.weighted_value_checksum, value_index as u64);
            mix_checksum(
                &mut stats.weighted_value_checksum,
                u64::from(value.to_bits()),
            );
            tensor_values.push(value);
        }
        output.push(tensor_values);
    }
    stats.changed_from_frontier_density_ppm = ratio_ppm(
        stats.changed_from_frontier_count,
        stats.total_parameter_count,
    )?;
    Ok((output, stats))
}

// Keeps mixing inside identical shape, flag, and tokenizer lanes.
fn require_compatible_parent(base: &ParsedModel, parent: &ParsedModel) -> io::Result<()> {
    if !same_shape(&base.shape, &parent.shape) {
        return Err(invalid(
            "parent-pool soup parents have different model shapes",
        ));
    }
    if base.flags != parent.flags {
        return Err(invalid(
            "parent-pool soup parents have different output flags",
        ));
    }
    if base.tokenizer.bytes != parent.tokenizer.bytes {
        return Err(invalid(
            "parent-pool soup parents have different tokenizer bytes",
        ));
    }
    Ok(())
}

// Records recipe, parent, merge, statistic, and candidate fields for replay.
fn build_receipt_text(
    recipe_fields: &HashMap<String, String>,
    recipe_parents: &[RecipeParent],
    recipe_text: &str,
    artifacts: &[ParentArtifact],
    candidate_report: &ValidationReport,
    stats: SoupStats,
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_soup_operator_version",
        OPERATOR_VERSION,
    );
    push_line(&mut text, "operator_kind", OPERATOR_KIND);
    push_line(&mut text, "operator_status", OPERATOR_STATUS);
    push_line(
        &mut text,
        "candidate_id",
        &format!(
            "{STANDARD_CANDIDATE_ID_PREFIX}-{:016x}",
            candidate_report.checksum()
        ),
    );
    push_line(&mut text, "operator_id", STANDARD_OPERATOR_ID);
    push_line(
        &mut text,
        "recipe_kind",
        require_key(recipe_fields, "recipe_kind")?,
    );
    push_line(
        &mut text,
        "parent_pool_recipe_checksum",
        &hex64(provenance::text_checksum(recipe_text.as_bytes())),
    );
    push_evolution_schedule_lines(
        &mut text,
        recipe_fields,
        OPERATOR_KIND,
        "soup-candidate",
        SOUP_MERGE_RULE,
    )?;
    push_line(
        &mut text,
        "population_review_checksum",
        require_key(recipe_fields, "population_review_checksum")?,
    );
    push_line(
        &mut text,
        "promotion_ledger_checksum",
        require_key(recipe_fields, "promotion_ledger_checksum")?,
    );
    push_line(
        &mut text,
        "admission_set_checksum",
        require_key(recipe_fields, "admission_set_checksum")?,
    );
    push_line(
        &mut text,
        "frontier_candidate_id",
        require_key(recipe_fields, "frontier_candidate_id")?,
    );
    push_line(
        &mut text,
        "frontier_candidate_slm_checksum",
        require_key(recipe_fields, "frontier_candidate_slm_checksum")?,
    );
    push_line(
        &mut text,
        "parent_contract_status",
        require_key(recipe_fields, "parent_contract_status")?,
    );
    push_line(
        &mut text,
        "contract_model_shape",
        require_key(recipe_fields, "contract_model_shape")?,
    );
    push_line(
        &mut text,
        "contract_quantization",
        require_key(recipe_fields, "contract_quantization")?,
    );
    push_line(
        &mut text,
        "contract_output_contract",
        require_key(recipe_fields, "contract_output_contract")?,
    );
    push_line(
        &mut text,
        "contract_tokenizer_checksum",
        require_key(recipe_fields, "contract_tokenizer_checksum")?,
    );
    push_line(
        &mut text,
        "contract_tensor_layout_checksum",
        require_key(recipe_fields, "contract_tensor_layout_checksum")?,
    );
    for key in RELATEDNESS_KEYS {
        push_line(&mut text, key, require_key(recipe_fields, key)?);
    }
    push_line(&mut text, "parent_count", &recipe_parents.len().to_string());
    for (index, (recipe_parent, artifact)) in recipe_parents.iter().zip(artifacts).enumerate() {
        push_parent_receipt_lines(&mut text, index, recipe_parent, artifact);
    }
    push_line(&mut text, "base_parent_index", "0");
    push_line(&mut text, "soup_merge_rule", SOUP_MERGE_RULE);
    push_line(&mut text, "soup_weight_source", SOUP_WEIGHT_SOURCE);
    push_line(&mut text, "soup_weight_unit", SOUP_WEIGHT_UNIT);
    push_line(
        &mut text,
        "soup_total_parameter_count",
        &stats.total_parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "soup_parent_weight_checksum",
        &hex64(stats.parent_weight_checksum),
    );
    push_line(
        &mut text,
        "soup_weighted_value_checksum",
        &hex64(stats.weighted_value_checksum),
    );
    push_line(
        &mut text,
        "soup_changed_from_frontier_count",
        &stats.changed_from_frontier_count.to_string(),
    );
    push_line(
        &mut text,
        "soup_changed_from_frontier_density_ppm",
        &stats.changed_from_frontier_density_ppm.to_string(),
    );
    push_candidate_lines(&mut text, candidate_report);
    push_line(&mut text, "candidate_parent_contract", PARENT_CONTRACT);
    push_line(&mut text, "operator_output_status", OPERATOR_OUTPUT_STATUS);
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

// Copies the matching recipe schedule family into the soup receipt.
fn push_evolution_schedule_lines(
    text: &mut String,
    recipe_fields: &HashMap<String, String>,
    operator_kind: &str,
    command: &str,
    selection_rule: &str,
) -> io::Result<()> {
    for key in EVOLUTION_RECIPE_KEYS {
        push_line(text, key, require_key(recipe_fields, key)?);
    }
    let family_count = parse_usize(
        require_key(recipe_fields, "evolution_operator_family_count")?,
        "evolution_operator_family_count",
    )?;
    for index in 0..family_count {
        let prefix = format!("evolution_operator_family.{index}");
        if required_prefixed(recipe_fields, &prefix, "operator_kind")? != operator_kind {
            continue;
        }
        require_equal(recipe_fields, &format!("{prefix}.command"), command)?;
        require_equal(
            recipe_fields,
            &format!("{prefix}.selection_rule"),
            selection_rule,
        )?;
        require_equal(
            recipe_fields,
            &format!("{prefix}.output_gate"),
            REQUIRED_NEXT_GATE,
        )?;
        push_line(text, "scheduled_operator_family_index", &index.to_string());
        push_line(text, "scheduled_operator_family_kind", operator_kind);
        push_line(text, "scheduled_operator_family_command", command);
        push_line(
            text,
            "scheduled_operator_family_selection_rule",
            selection_rule,
        );
        push_line(
            text,
            "scheduled_operator_family_output_gate",
            REQUIRED_NEXT_GATE,
        );
        return Ok(());
    }
    Err(invalid(
        "parent-pool evolution schedule does not include soup operator family",
    ))
}

// Copies one parent's recipe and validation details into the receipt.
fn push_parent_receipt_lines(
    text: &mut String,
    index: usize,
    recipe_parent: &RecipeParent,
    artifact: &ParentArtifact,
) {
    let prefix = format!("parent.{index}");
    push_line(text, &format!("{prefix}.rank"), &recipe_parent.rank);
    push_line(text, &format!("{prefix}.role"), &recipe_parent.role);
    push_line(
        text,
        &format!("{prefix}.selection_status"),
        &recipe_parent.selection_status,
    );
    push_line(
        text,
        &format!("{prefix}.source_review_entry"),
        &recipe_parent.source_review_entry,
    );
    push_line(
        text,
        &format!("{prefix}.source_ledger_entry"),
        &recipe_parent.source_ledger_entry,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_id"),
        &recipe_parent.candidate_id,
    );
    push_line(
        text,
        &format!("{prefix}.selector_id"),
        &recipe_parent.selector_id,
    );
    push_line(
        text,
        &format!("{prefix}.operator_id"),
        &recipe_parent.operator_id,
    );
    push_line(
        text,
        &format!("{prefix}.resource_budget"),
        &recipe_parent.resource_budget,
    );
    push_line(
        text,
        &format!("{prefix}.recipe_candidate_artifact_path"),
        &recipe_parent.candidate_artifact_path,
    );
    push_line(text, &format!("{prefix}.actual_path"), &artifact.path);
    push_line(
        text,
        &format!("{prefix}.model_bytes"),
        &artifact.report.file_bytes().to_string(),
    );
    push_line(
        text,
        &format!("{prefix}.slm_version"),
        &artifact.report.slm_version().to_string(),
    );
    push_line(
        text,
        &format!("{prefix}.slm_checksum"),
        &hex64(artifact.report.checksum()),
    );
    push_line(
        text,
        &format!("{prefix}.model_shape"),
        &artifact.report.shape_summary(),
    );
    push_line(
        text,
        &format!("{prefix}.tensor_count"),
        &artifact.report.tensor_count().to_string(),
    );
    push_line(
        text,
        &format!("{prefix}.parameter_count"),
        &artifact.report.parameter_count().to_string(),
    );
    push_line(
        text,
        &format!("{prefix}.quantization"),
        artifact.report.quantization_label(),
    );
    push_line(
        text,
        &format!("{prefix}.output_contract"),
        artifact.report.output_contract_label(),
    );
    push_line(
        text,
        &format!("{prefix}.tokenizer_checksum"),
        &hex64(artifact.report.tokenizer_checksum()),
    );
    push_line(
        text,
        &format!("{prefix}.tensor_layout_checksum"),
        &hex64(artifact.report.tensor_layout_checksum()),
    );
    push_line(
        text,
        &format!("{prefix}.relatedness_group"),
        &recipe_parent.relatedness_group,
    );
    push_line(
        text,
        &format!("{prefix}.relatedness_contract_checksum"),
        &recipe_parent.relatedness_contract_checksum,
    );
    push_line(
        text,
        &format!("{prefix}.population_fitness_ppm"),
        &recipe_parent.population_fitness_ppm,
    );
    push_line(
        text,
        &format!("{prefix}.seed_weight_ppm"),
        &recipe_parent.seed_weight_ppm.to_string(),
    );
    push_line(
        text,
        &format!("{prefix}.next_route"),
        &recipe_parent.next_route,
    );
}

// Copies the emitted candidate validation report into the receipt.
fn push_candidate_lines(text: &mut String, report: &ValidationReport) {
    push_line(text, "candidate_artifact_path", report.path());
    push_line(
        text,
        "candidate_artifact_bytes",
        &report.file_bytes().to_string(),
    );
    push_line(
        text,
        "candidate_slm_version",
        &report.slm_version().to_string(),
    );
    push_line(text, "candidate_slm_checksum", &hex64(report.checksum()));
    push_line(text, "candidate_model_shape", &report.shape_summary());
    push_line(
        text,
        "candidate_tensor_count",
        &report.tensor_count().to_string(),
    );
    push_line(
        text,
        "candidate_parameter_count",
        &report.parameter_count().to_string(),
    );
    push_line(text, "candidate_quantization", report.quantization_label());
    push_line(
        text,
        "candidate_output_contract",
        report.output_contract_label(),
    );
    push_line(
        text,
        "candidate_tokenizer_checksum",
        &hex64(report.tokenizer_checksum()),
    );
    push_line(
        text,
        "candidate_tensor_layout_checksum",
        &hex64(report.tensor_layout_checksum()),
    );
}

// Fetches a required `parent.N.key` field from the recipe manifest.
fn required_prefixed(
    fields: &HashMap<String, String>,
    prefix: &str,
    key: &str,
) -> io::Result<String> {
    Ok(require_key(fields, &format!("{prefix}.{key}"))?.to_string())
}

// Parses a count field used by recipe cardinality checks.
fn parse_usize(value: &str, label: &str) -> io::Result<usize> {
    value
        .parse::<usize>()
        .map_err(|_| invalid(&format!("{label} must be an integer")))
}

// Parses one parent's parts-per-million recipe weight.
fn parse_seed_weight(value: &str) -> io::Result<u64> {
    let parsed = value
        .parse::<u64>()
        .map_err(|_| invalid("parent-pool seed weight must be an integer"))?;
    if parsed > PPM_DENOMINATOR {
        return Err(invalid("parent-pool seed weight exceeded 1000000"));
    }
    Ok(parsed)
}

// Reports recipe-to-artifact drift with the manifest key that changed.
fn require_text_equal(key: &str, actual: &str, expected: &str) -> io::Result<()> {
    if actual != expected {
        return Err(invalid(&format!(
            "parent-pool recipe key {key} was {actual}, current artifact has {expected}"
        )));
    }
    Ok(())
}

// Starts receipt checksums from a stable operator-local seed.
fn checksum_seed(seed: u64) -> u64 {
    let mut acc = seed;
    mix_checksum(&mut acc, PPM_DENOMINATOR);
    acc
}

// Mixes a small integer into the receipt checksum accumulator.
fn mix_checksum(acc: &mut u64, value: u64) {
    *acc ^= value.wrapping_add(0x9e37_79b9_7f4a_7c15);
    *acc = acc.rotate_left(9).wrapping_mul(0x1000_0000_01b3);
}

// Converts a count ratio into parts-per-million for stable receipts.
fn ratio_ppm(numerator: u64, denominator: u64) -> io::Result<u64> {
    if denominator == 0 {
        return Ok(0);
    }
    numerator
        .checked_mul(PPM_DENOMINATOR)
        .map(|value| value / denominator)
        .ok_or_else(|| invalid("soup density overflow"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::admission;
    use crate::build_model_file_from_values_with_flags;
    use crate::candidate;
    use crate::compatibility;
    use crate::fixture_value;
    use crate::ledger;
    use crate::lineage;
    use crate::population;
    use crate::promotion;
    use crate::tensor_writer::{tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_F32};
    use crate::tokenizer_writer::ByteTokenizerSection;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn writes_and_validates_weighted_soup_candidate_text() {
        let alpha_bytes = tiny_fixture_f32_bytes_with_offset(0.0);
        let beta_bytes = tiny_fixture_f32_bytes_with_offset(0.003);
        let gamma_bytes = tiny_fixture_f32_bytes_with_offset(0.006);
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/soup/alpha.slm",
            &alpha_bytes,
        );
        let beta = fixture_admission("tiny-beta-candidate", "target/soup/beta.slm", &beta_bytes);
        let gamma = fixture_admission(
            "tiny-gamma-candidate",
            "target/soup/gamma.slm",
            &gamma_bytes,
        );
        let admissions = vec![alpha.clone(), beta.clone(), gamma.clone()];
        let ledger = ledger::build_ledger_text(&admissions).unwrap();
        let review = population::build_review_text(&ledger, &admissions).unwrap();
        let recipe = parent_pool::build_recipe_text(&ledger, &review, &admissions).unwrap();
        let parents = vec![
            ("alpha.slm".to_string(), alpha_bytes.clone()),
            ("beta.slm".to_string(), beta_bytes),
            ("gamma.slm".to_string(), gamma_bytes.clone()),
        ];

        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &ledger,
            &review,
            &recipe,
            &parents,
            "candidate.slm",
            &admissions,
        )
        .unwrap();

        validate_candidate_text(
            &ledger,
            &review,
            &recipe,
            &parents,
            &candidate,
            "candidate.slm",
            &receipt,
            &admissions,
        )
        .unwrap();
        let base = parse_model_values(&alpha_bytes).unwrap();
        let gamma = parse_model_values(&gamma_bytes).unwrap();
        let merged = parse_model_values(&candidate).unwrap();
        assert!(merged.tensors[0].values[0] > base.tensors[0].values[0]);
        assert!(merged.tensors[0].values[0] < gamma.tensors[0].values[0]);
        assert!(receipt.contains("operator_kind=seed-weighted-parent-pool-soup"));
        assert!(receipt.contains("evolution_schedule_checksum=0x"));
        assert!(receipt.contains("scheduled_operator_family_index=1"));
        assert!(receipt.contains("scheduled_operator_family_command=soup-candidate"));
        assert!(receipt.contains("soup_merge_rule=seed-weighted-direct-parameter-average"));
        assert!(receipt.contains("soup_parent_weight_checksum="));
        assert!(receipt.contains("soup_weighted_value_checksum="));

        let report = slm_validate::validate_bytes(&candidate, "candidate.slm").unwrap();
        let candidate_id = format!("{STANDARD_CANDIDATE_ID_PREFIX}-{:016x}", report.checksum());
        let compatibility = compatibility::compatibility_text_for_bytes(
            &parents[0].1,
            &parents[0].0,
            &parents[1].1,
            &parents[1].0,
        )
        .unwrap();
        let lineage = lineage::build_template_text(
            &compatibility,
            &candidate_id,
            STANDARD_OPERATOR_ID,
            "parent-pool-test-budget",
        )
        .unwrap();
        let manifest = candidate::build_manifest_text_with_operator_receipt_text(
            &compatibility,
            &lineage,
            &candidate,
            "candidate.slm",
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();
        candidate::validate_manifest_text_with_operator_receipt_text(
            &compatibility,
            &lineage,
            &candidate,
            "candidate.slm",
            &manifest,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();
        assert!(manifest.contains("operator_receipt_status=receipt-bound"));
    }

    #[test]
    fn rejects_parent_order_checksum_drift() {
        let alpha_bytes = tiny_fixture_f32_bytes_with_offset(0.0);
        let beta_bytes = tiny_fixture_f32_bytes_with_offset(0.004);
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/soup/order-alpha.slm",
            &alpha_bytes,
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/soup/order-beta.slm",
            &beta_bytes,
        );
        let admissions = vec![alpha.clone(), beta.clone()];
        let ledger = ledger::build_ledger_text(&admissions).unwrap();
        let review = population::build_review_text(&ledger, &admissions).unwrap();
        let recipe = parent_pool::build_recipe_text(&ledger, &review, &admissions).unwrap();
        let parents = vec![
            ("beta.slm".to_string(), beta_bytes),
            ("alpha.slm".to_string(), alpha_bytes),
        ];

        let error = build_candidate_bytes_and_receipt(
            &ledger,
            &review,
            &recipe,
            &parents,
            "candidate.slm",
            &admissions,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate_slm_checksum"));
    }

    #[test]
    fn rejects_single_parent_recipe() {
        let alpha_bytes = tiny_fixture_f32_bytes_with_offset(0.0);
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/soup/single-alpha.slm",
            &alpha_bytes,
        );
        let admissions = vec![alpha.clone()];
        let ledger = ledger::build_ledger_text(&admissions).unwrap();
        let review = population::build_review_text(&ledger, &admissions).unwrap();
        let recipe = parent_pool::build_recipe_text(&ledger, &review, &admissions).unwrap();
        let parents = vec![("alpha.slm".to_string(), alpha_bytes)];

        let error = build_candidate_bytes_and_receipt(
            &ledger,
            &review,
            &recipe,
            &parents,
            "candidate.slm",
            &admissions,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("at least two parents"));
    }

    #[test]
    fn validation_rejects_candidate_drift() {
        let alpha_bytes = tiny_fixture_f32_bytes_with_offset(0.0);
        let beta_bytes = tiny_fixture_f32_bytes_with_offset(0.004);
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/soup/drift-alpha.slm",
            &alpha_bytes,
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/soup/drift-beta.slm",
            &beta_bytes,
        );
        let admissions = vec![alpha.clone(), beta.clone()];
        let ledger = ledger::build_ledger_text(&admissions).unwrap();
        let review = population::build_review_text(&ledger, &admissions).unwrap();
        let recipe = parent_pool::build_recipe_text(&ledger, &review, &admissions).unwrap();
        let parents = vec![
            ("alpha.slm".to_string(), alpha_bytes),
            ("beta.slm".to_string(), beta_bytes),
        ];
        let (mut candidate, receipt) = build_candidate_bytes_and_receipt(
            &ledger,
            &review,
            &recipe,
            &parents,
            "candidate.slm",
            &admissions,
        )
        .unwrap();
        let last = candidate.len() - 1;
        candidate[last] ^= 0x01;

        let error = validate_candidate_text(
            &ledger,
            &review,
            &recipe,
            &parents,
            &candidate,
            "candidate.slm",
            &receipt,
            &admissions,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate bytes"));
    }

    #[test]
    fn validation_rejects_receipt_operator_kind_drift() {
        let alpha_bytes = tiny_fixture_f32_bytes_with_offset(0.0);
        let beta_bytes = tiny_fixture_f32_bytes_with_offset(0.004);
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/soup/receipt-alpha.slm",
            &alpha_bytes,
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/soup/receipt-beta.slm",
            &beta_bytes,
        );
        let admissions = vec![alpha.clone(), beta.clone()];
        let ledger = ledger::build_ledger_text(&admissions).unwrap();
        let review = population::build_review_text(&ledger, &admissions).unwrap();
        let recipe = parent_pool::build_recipe_text(&ledger, &review, &admissions).unwrap();
        let parents = vec![
            ("alpha.slm".to_string(), alpha_bytes),
            ("beta.slm".to_string(), beta_bytes),
        ];
        let (candidate, receipt) = build_candidate_bytes_and_receipt(
            &ledger,
            &review,
            &recipe,
            &parents,
            "candidate.slm",
            &admissions,
        )
        .unwrap();
        let drifted = receipt.replace(
            "operator_kind=seed-weighted-parent-pool-soup",
            "operator_kind=other-parent-pool-soup",
        );

        let error = validate_candidate_text(
            &ledger,
            &review,
            &recipe,
            &parents,
            &candidate,
            "candidate.slm",
            &drifted,
            &admissions,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator_kind"));
    }

    #[test]
    fn writes_and_validates_soup_candidate_paths() {
        let dir = unique_dir("paths");
        std::fs::create_dir_all(&dir).unwrap();
        let alpha_bytes = tiny_fixture_f32_bytes_with_offset(0.0);
        let beta_bytes = tiny_fixture_f32_bytes_with_offset(0.005);
        let gamma_bytes = tiny_fixture_f32_bytes_with_offset(0.002);
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/soup/path-alpha.slm",
            &alpha_bytes,
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/soup/path-beta.slm",
            &beta_bytes,
        );
        let gamma = fixture_admission(
            "tiny-gamma-candidate",
            "target/soup/path-gamma.slm",
            &gamma_bytes,
        );
        let alpha_slm = dir.join("alpha.slm");
        let beta_slm = dir.join("beta.slm");
        let gamma_slm = dir.join("gamma.slm");
        let alpha_admission = dir.join("alpha.admission");
        let beta_admission = dir.join("beta.admission");
        let gamma_admission = dir.join("gamma.admission");
        let ledger_path = dir.join("pool.ledger");
        let review_path = dir.join("pool.review");
        let recipe_path = dir.join("pool.recipe");
        let candidate_path = dir.join("candidate.slm");
        let receipt_path = dir.join("candidate.operator");
        std::fs::write(&alpha_slm, alpha_bytes).unwrap();
        std::fs::write(&beta_slm, beta_bytes).unwrap();
        std::fs::write(&gamma_slm, gamma_bytes).unwrap();
        std::fs::write(&alpha_admission, alpha).unwrap();
        std::fs::write(&beta_admission, beta).unwrap();
        std::fs::write(&gamma_admission, gamma).unwrap();
        let admissions = vec![
            alpha_admission.to_string_lossy().to_string(),
            beta_admission.to_string_lossy().to_string(),
            gamma_admission.to_string_lossy().to_string(),
        ];
        let parents = vec![
            alpha_slm.to_string_lossy().to_string(),
            beta_slm.to_string_lossy().to_string(),
            gamma_slm.to_string_lossy().to_string(),
        ];

        ledger::write_ledger_path(&ledger_path, &admissions).unwrap();
        population::write_review_path(&ledger_path, &review_path, &admissions).unwrap();
        parent_pool::write_recipe_path(&ledger_path, &review_path, &recipe_path, &admissions)
            .unwrap();
        write_candidate_path(
            &ledger_path,
            &review_path,
            &recipe_path,
            &candidate_path,
            &receipt_path,
            &parents,
            &admissions,
        )
        .unwrap();
        validate_candidate_path(
            &ledger_path,
            &review_path,
            &recipe_path,
            &candidate_path,
            &receipt_path,
            &parents,
            &admissions,
        )
        .unwrap();

        let receipt = std::fs::read_to_string(receipt_path).unwrap();
        assert!(receipt.contains("operator_output_status=slm-validated"));
        assert!(receipt.contains("scheduled_operator_family_command=soup-candidate"));
        slm_validate::validate_path(&candidate_path).unwrap();
    }

    fn fixture_admission(candidate_id: &str, candidate_path: &str, candidate: &[u8]) -> String {
        let compatibility = compatibility::compatibility_text_for_bytes(
            candidate,
            "left.slm",
            candidate,
            "right.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, candidate_id, "operator-a", "fit")
                .unwrap();
        let candidate_manifest =
            candidate::build_manifest_text(&compatibility, &lineage, candidate, candidate_path)
                .unwrap();
        let promotion = promotion::build_template_text(
            &compatibility,
            &lineage,
            candidate,
            candidate_path,
            &candidate_manifest,
            "local-smoke-runner",
            promotion::DEFAULT_PROMOTION_SCOPE,
        )
        .unwrap();
        let report = slm_validate::validate_bytes(candidate, candidate_path).unwrap();
        let provenance_manifest =
            provenance::build_manifest_text(&report, "converted-trained").unwrap();
        let manifest_fields = provenance::parse_manifest(&provenance_manifest).unwrap();
        let runtime_smoke =
            provenance::build_runtime_smoke_text(&report, &provenance_manifest, &manifest_fields)
                .unwrap();
        let eval = passing_eval_text(&report, &provenance_manifest);
        admission::build_record_text(
            &compatibility,
            &lineage,
            candidate,
            candidate_path,
            &candidate_manifest,
            &promotion,
            &provenance_manifest,
            &runtime_smoke,
            &eval,
            admission::DEFAULT_ADMISSION_SELECTOR_ID,
        )
        .unwrap()
    }

    fn passing_eval_text(report: &slm_validate::ValidationReport, manifest: &str) -> String {
        provenance::build_reviewed_honest_quality_eval_text(report, manifest, "converted-trained")
    }

    fn tiny_fixture_f32_bytes_with_offset(offset: f32) -> Vec<u8> {
        let tensors = tiny_fixture_tensors_with_dtype(DTYPE_F32);
        let values: Vec<Vec<f32>> = tensors
            .iter()
            .map(|tensor| {
                (0..tensor.element_count())
                    .map(|elem| fixture_value(tensor, elem) + offset)
                    .collect()
            })
            .collect();
        build_model_file_from_values_with_flags(
            &ModelShape::tiny_fixture(),
            &tensors,
            &ByteTokenizerSection::phase_one(),
            &values,
            0,
        )
        .unwrap()
    }

    fn unique_dir(label: &str) -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-soup-{label}-{nanos}"))
    }
}
