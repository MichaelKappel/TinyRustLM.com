//! Browser selector registries built from admitted model-breeding records.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::Path;

use crate::admission;
use crate::provenance;

const REGISTRY_VERSION: &str = "2";
const REGISTRY_SCOPE: &str = "browser-local-model-selector";
const REGISTRY_STATUS: &str = "admitted-records-only";
const ENTRY_STATUS: &str = "admitted";
const PUBLIC_CLAIM_STATUS: &str = "bound-to-eval-scope";
const REQUIRED_NEXT_GATE: &str =
    "browser-loads-model-and-activates-selector-composition-before-generation";
const SELECTOR_DEFAULT_STRATEGY: &str = "browser-frugal-quantized";
const SELECTOR_MODEL_BYTE_BUDGET: u64 = 32 * 1024 * 1024;
const SELECTOR_COMPOSITION_GRAPH_BYTE_BUDGET: u64 = 16 * 1024 * 1024;
const SELECTOR_REGISTRY_TEXT_BYTE_BUDGET: u64 = 256 * 1024;
const MANIFEST_TEXT_BYTE_BUDGET: u64 = 64 * 1024;
const RECEIPT_TEXT_BYTE_BUDGET: u64 = 128 * 1024;
const EVIDENCE_TEXT_BYTE_BUDGET: u64 = 128 * 1024;
const GENOME_STRATEGY: &str = "selector-admission-genome-v1";
const GENOME_LINEAGE_STATUS: &str = "admission-bound";
const SPECIES_STRATEGY: &str = "selector-speciation-fit-v1";
const SPECIES_FIT_STATUS: &str = "browser-fit-bound";
const NOVELTY_STRATEGY: &str = "selector-novelty-sketch-v1";
const NOVELTY_STATUS: &str = "behavior-sketch-bound";
const POPULATION_STRATEGY: &str = "selector-population-review-route-v1";
const POPULATION_STATUS: &str = "population-review-bound";
const MATE_SELECTION_STRATEGY: &str = "selector-mate-selection-route-v1";
const MATE_SELECTION_PARENT_POOL_STATUS: &str = "parent-pool-bound";
const MATE_SELECTION_ADMISSION_STATUS: &str = "admission-only";
const EVOLUTION_RECIPE_VERSION: &str = "1";
const EVOLUTION_RECIPE_STRATEGY: &str = "population-based-parent-pool-replay-v1";
const EVOLUTION_RECIPE_STATUS: &str = "operator-family-planned";
const EVOLUTION_SELECTION_SOURCE: &str = "population-fitness-normalized-seed-weights";
const EVOLUTION_SCHEDULE_CHECKSUM_ALGORITHM: &str = "tinyrustlm-text-checksum-v1";
const PHENOTYPE_EVIDENCE_STRATEGY: &str = "selector-phenotype-evidence-v1";
const PHENOTYPE_EVIDENCE_STATUS: &str = "runtime-eval-bound";
const HERITABLE_ARTIFACT_STRATEGY: &str = "selector-heritable-artifact-v1";
const HERITABLE_ARTIFACT_STATUS: &str = "served-artifact-bound";
const FITNESS_VECTOR_STATUS: &str = "eval-bound";
const SOURCE_MANIFEST_KIND: &str = "trained-source-manifest";
const SOURCE_MANIFEST_STATUS: &str = "reviewed-source-snapshot";
const SOURCE_REVIEW_KIND: &str = "safetensors-candidate-review";
const SOURCE_REVIEW_STATUS: &str = "validated-before-extraction";
const SOURCE_REVIEW_REQUIRED_NEXT_GATE: &str = "extract-raw-f32-tensors";
const EVOLUTION_SCHEDULE_KEYS: &[&str] = &[
    "evolution_recipe_version",
    "evolution_recipe_strategy",
    "evolution_recipe_status",
    "evolution_selection_source",
    "evolution_relatedness_contract_checksum",
    "evolution_schedule_checksum_algorithm",
    "evolution_schedule_checksum",
    "scheduled_operator_family_index",
    "scheduled_operator_family_kind",
    "scheduled_operator_family_command",
    "scheduled_operator_family_selection_rule",
    "scheduled_operator_family_output_gate",
];
struct RegistryEntry {
    candidate_id: String,
    display_name: String,
    artifact_path: String,
    model_path: String,
    manifest_path: String,
    composition: RegistryCompositionRoute,
    source_manifest: Option<RegistrySourceManifestRoute>,
    source_validation: Option<RegistrySourceValidationRoute>,
    max_tokens: String,
    model_bytes: String,
    slm_checksum: String,
    tokenizer_checksum: String,
    model_shape: String,
    quantization: String,
    output_contract: String,
    admission_path: Option<String>,
    admission_checksum: String,
    promotion_manifest_checksum: String,
    provenance_manifest_checksum: String,
    runtime_smoke_path: Option<String>,
    runtime_smoke_manifest_checksum: String,
    eval_path: Option<String>,
    eval_manifest_checksum: String,
    eval_case_evidence_checksum: String,
    quality_scope: String,
    quality_boundary: String,
    eval_dataset: String,
    cases_passed: String,
    admission_kind: String,
    operator_receipt: Option<RegistryOperatorReceipt>,
    operator_receipt_checksum: Option<String>,
    parent_pool_recipe_checksum: Option<String>,
    population_review_checksum: Option<String>,
    promotion_ledger_checksum: Option<String>,
    admission_set_checksum: Option<String>,
    parent_count: usize,
    evolution_schedule: Option<RegistryEvolutionSchedule>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RegistryCompositionRoute {
    path: String,
    bytes: u64,
    sha256: String,
    base_model_id: String,
    composition_id: String,
    active_graph_sha256: String,
    route_policy_id: String,
    kv_format_id: String,
    position_policy_sha256: String,
    member_count: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RegistrySourceManifestRoute {
    path: String,
    checksum: String,
    kind: String,
    status: String,
    source_kind: String,
    source_id: String,
    model_shape: String,
    source_review: Option<RegistrySourceReviewRoute>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RegistrySourceReviewRoute {
    kind: String,
    path: String,
    status: String,
    checksum: String,
    required_next_gate: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RegistrySourceValidationRoute {
    path: String,
    checksum: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RegistryOperatorReceipt {
    status: String,
    path: String,
    checksum: String,
    operator_id: String,
    operator_kind: String,
    candidate_slm_checksum: String,
    candidate_artifact_bytes: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RegistryEvolutionSchedule {
    recipe_version: String,
    recipe_strategy: String,
    recipe_status: String,
    selection_source: String,
    relatedness_contract_checksum: String,
    schedule_checksum_algorithm: String,
    schedule_checksum: String,
    family_index: String,
    family_kind: String,
    family_command: String,
    family_selection_rule: String,
    family_output_gate: String,
}

/// Writes a browser selector registry from one or more selector admission records.
pub(crate) fn write_registry_path(output: &Path, admission_paths: &[String]) -> io::Result<()> {
    let admission_texts = read_admissions(admission_paths)?;
    let registry = build_registry_text(&admission_texts)?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, registry)?;
    println!("SLM selector registry written: {}", output.display());
    Ok(())
}

/// Validates a browser selector registry against its selector admission records.
pub(crate) fn validate_registry_path(
    registry: &Path,
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_admissions(admission_paths)?;
    let registry_text = fs::read_to_string(registry)?;
    validate_registry_text(&registry_text, &admission_texts)?;
    println!("SLM selector registry validation: PASS");
    println!("registry: {}", registry.display());
    println!("admissions: {}", admission_paths.len());
    Ok(())
}

fn read_admissions(admission_paths: &[String]) -> io::Result<Vec<String>> {
    if admission_paths.is_empty() {
        return Err(invalid(
            "selector-registry requires at least one admission record",
        ));
    }
    admission_paths
        .iter()
        .map(|path| fs::read_to_string(Path::new(path)))
        .collect()
}

pub(crate) fn build_registry_text(admission_texts: &[String]) -> io::Result<String> {
    let entries = entries_from_admissions(admission_texts)?;
    let selector_id = selector_id(admission_texts)?;
    let default_entry = default_selector_entry(&entries)?;
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_selector_registry_version",
        REGISTRY_VERSION,
    );
    push_line(&mut text, "selector_id", &selector_id);
    push_line(&mut text, "registry_scope", REGISTRY_SCOPE);
    push_line(&mut text, "registry_status", REGISTRY_STATUS);
    push_line(
        &mut text,
        "selector_model_byte_budget",
        &SELECTOR_MODEL_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "selector_composition_graph_byte_budget",
        &SELECTOR_COMPOSITION_GRAPH_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "selector_registry_text_byte_budget",
        &SELECTOR_REGISTRY_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "manifest_text_byte_budget",
        &MANIFEST_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "receipt_text_byte_budget",
        &RECEIPT_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "evidence_text_byte_budget",
        &EVIDENCE_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(&mut text, "entry_count", &entries.len().to_string());
    push_line(
        &mut text,
        "selector_default_strategy",
        SELECTOR_DEFAULT_STRATEGY,
    );
    push_line(
        &mut text,
        "selector_default_candidate_id",
        &default_entry.candidate_id,
    );
    push_line(
        &mut text,
        "selector_default_quantization",
        &default_entry.quantization,
    );
    push_line(
        &mut text,
        "admission_set_checksum",
        &admission_set_checksum(admission_texts),
    );
    for (index, entry) in entries.iter().enumerate() {
        let prefix = format!("entry.{index}");
        push_line(
            &mut text,
            &format!("{prefix}.candidate_id"),
            &entry.candidate_id,
        );
        push_line(
            &mut text,
            &format!("{prefix}.display_name"),
            &entry.display_name,
        );
        push_line(
            &mut text,
            &format!("{prefix}.model_path"),
            &entry.model_path,
        );
        push_line(
            &mut text,
            &format!("{prefix}.manifest_path"),
            &entry.manifest_path,
        );
        push_line(
            &mut text,
            &format!("{prefix}.composition_graph_path"),
            &entry.composition.path,
        );
        push_line(
            &mut text,
            &format!("{prefix}.composition_graph_bytes"),
            &entry.composition.bytes.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.composition_graph_sha256"),
            &entry.composition.sha256,
        );
        push_line(
            &mut text,
            &format!("{prefix}.composition_base_model_id"),
            &entry.composition.base_model_id,
        );
        push_line(
            &mut text,
            &format!("{prefix}.composition_id"),
            &entry.composition.composition_id,
        );
        push_line(
            &mut text,
            &format!("{prefix}.composition_active_graph_sha256"),
            &entry.composition.active_graph_sha256,
        );
        push_line(
            &mut text,
            &format!("{prefix}.composition_route_policy_id"),
            &entry.composition.route_policy_id,
        );
        push_line(
            &mut text,
            &format!("{prefix}.composition_kv_format_id"),
            &entry.composition.kv_format_id,
        );
        push_line(
            &mut text,
            &format!("{prefix}.composition_position_policy_sha256"),
            &entry.composition.position_policy_sha256,
        );
        push_line(
            &mut text,
            &format!("{prefix}.composition_member_count"),
            &entry.composition.member_count.to_string(),
        );
        if let Some(source_manifest) = &entry.source_manifest {
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_path"),
                &source_manifest.path,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_checksum"),
                &source_manifest.checksum,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_kind"),
                &source_manifest.kind,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_status"),
                &source_manifest.status,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_source_kind"),
                &source_manifest.source_kind,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_source_id"),
                &source_manifest.source_id,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_model_shape"),
                &source_manifest.model_shape,
            );
            if let Some(source_review) = &source_manifest.source_review {
                push_line(
                    &mut text,
                    &format!("{prefix}.source_review_kind"),
                    &source_review.kind,
                );
                push_line(
                    &mut text,
                    &format!("{prefix}.source_review_path"),
                    &source_review.path,
                );
                push_line(
                    &mut text,
                    &format!("{prefix}.source_review_status"),
                    &source_review.status,
                );
                push_line(
                    &mut text,
                    &format!("{prefix}.source_review_checksum"),
                    &source_review.checksum,
                );
                push_line(
                    &mut text,
                    &format!("{prefix}.source_review_required_next_gate"),
                    &source_review.required_next_gate,
                );
            }
        }
        if let Some(source_validation) = &entry.source_validation {
            push_line(
                &mut text,
                &format!("{prefix}.source_validation_path"),
                &source_validation.path,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_validation_checksum"),
                &source_validation.checksum,
            );
        }
        push_line(
            &mut text,
            &format!("{prefix}.artifact_path"),
            &entry.artifact_path,
        );
        push_line(
            &mut text,
            &format!("{prefix}.max_tokens"),
            &entry.max_tokens,
        );
        push_line(
            &mut text,
            &format!("{prefix}.model_bytes"),
            &entry.model_bytes,
        );
        push_line(
            &mut text,
            &format!("{prefix}.slm_checksum"),
            &entry.slm_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.tokenizer_checksum"),
            &entry.tokenizer_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.model_shape"),
            &entry.model_shape,
        );
        push_line(
            &mut text,
            &format!("{prefix}.quantization"),
            &entry.quantization,
        );
        push_line(
            &mut text,
            &format!("{prefix}.output_contract"),
            &entry.output_contract,
        );
        push_line(
            &mut text,
            &format!("{prefix}.genome_id"),
            &registry_entry_genome_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.genome_strategy"),
            GENOME_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.genome_lineage_status"),
            GENOME_LINEAGE_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.genome_lineage_checksum"),
            &registry_entry_genome_lineage_checksum(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.species_id"),
            &registry_entry_species_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.species_strategy"),
            SPECIES_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.species_fit_status"),
            SPECIES_FIT_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.species_fit_checksum"),
            &registry_entry_species_fit_checksum(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.novelty_id"),
            &registry_entry_novelty_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.novelty_strategy"),
            NOVELTY_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.novelty_status"),
            NOVELTY_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.novelty_checksum"),
            &registry_entry_novelty_checksum(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.population_id"),
            &registry_entry_population_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.population_strategy"),
            POPULATION_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.population_status"),
            POPULATION_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.population_checksum"),
            &registry_entry_population_checksum(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.mate_selection_id"),
            &registry_entry_mate_selection_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.mate_selection_strategy"),
            MATE_SELECTION_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.mate_selection_status"),
            registry_entry_mate_selection_status(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.mate_selection_parent_count"),
            &entry.parent_count.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.mate_selection_checksum"),
            &registry_entry_mate_selection_checksum(entry),
        );
        push_registry_operator_receipt_lines(&mut text, &prefix, entry);
        push_registry_evolution_schedule_lines(&mut text, &prefix, entry);
        push_line(
            &mut text,
            &format!("{prefix}.phenotype_evidence_id"),
            &registry_entry_phenotype_evidence_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.phenotype_evidence_strategy"),
            PHENOTYPE_EVIDENCE_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.phenotype_evidence_status"),
            PHENOTYPE_EVIDENCE_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.phenotype_evidence_checksum"),
            &registry_entry_phenotype_evidence_checksum(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.heritable_artifact_id"),
            &registry_entry_heritable_artifact_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.heritable_artifact_strategy"),
            HERITABLE_ARTIFACT_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.heritable_artifact_status"),
            HERITABLE_ARTIFACT_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.heritable_artifact_checksum"),
            &registry_entry_heritable_artifact_checksum(entry),
        );
        if let Some(admission_path) = &entry.admission_path {
            push_line(
                &mut text,
                &format!("{prefix}.admission_path"),
                admission_path,
            );
        }
        push_line(
            &mut text,
            &format!("{prefix}.admission_checksum"),
            &entry.admission_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.promotion_manifest_checksum"),
            &entry.promotion_manifest_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.provenance_manifest_checksum"),
            &entry.provenance_manifest_checksum,
        );
        if let Some(runtime_smoke_path) = &entry.runtime_smoke_path {
            push_line(
                &mut text,
                &format!("{prefix}.runtime_smoke_path"),
                runtime_smoke_path,
            );
        }
        push_line(
            &mut text,
            &format!("{prefix}.runtime_smoke_manifest_checksum"),
            &entry.runtime_smoke_manifest_checksum,
        );
        if let Some(eval_path) = &entry.eval_path {
            push_line(&mut text, &format!("{prefix}.eval_path"), eval_path);
        }
        push_line(
            &mut text,
            &format!("{prefix}.eval_manifest_checksum"),
            &entry.eval_manifest_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.eval_case_evidence_checksum"),
            &entry.eval_case_evidence_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.quality_scope"),
            &entry.quality_scope,
        );
        push_line(
            &mut text,
            &format!("{prefix}.quality_boundary"),
            &entry.quality_boundary,
        );
        push_line(
            &mut text,
            &format!("{prefix}.eval_dataset"),
            &entry.eval_dataset,
        );
        push_line(
            &mut text,
            &format!("{prefix}.cases_passed"),
            &entry.cases_passed,
        );
        push_line(
            &mut text,
            &format!("{prefix}.fitness_vector_status"),
            FITNESS_VECTOR_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.fitness_vector_checksum"),
            &registry_entry_fitness_vector_checksum(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.selector_status"),
            ENTRY_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.public_claim_status"),
            PUBLIC_CLAIM_STATUS,
        );
    }
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

fn validate_registry_text(registry_text: &str, admission_texts: &[String]) -> io::Result<()> {
    let actual = parse_manifest(registry_text, "selector registry")?;
    let expected_text = build_registry_text(admission_texts)?;
    let expected = parse_manifest(&expected_text, "expected selector registry")?;
    require_equal(
        &actual,
        "tinyrustlm_selector_registry_version",
        REGISTRY_VERSION,
    )?;
    require_equal(&actual, "registry_scope", REGISTRY_SCOPE)?;
    require_equal(&actual, "registry_status", REGISTRY_STATUS)?;
    require_equal(
        &actual,
        "selector_model_byte_budget",
        &SELECTOR_MODEL_BYTE_BUDGET.to_string(),
    )?;
    require_equal(
        &actual,
        "selector_composition_graph_byte_budget",
        &SELECTOR_COMPOSITION_GRAPH_BYTE_BUDGET.to_string(),
    )?;
    require_equal(
        &actual,
        "selector_registry_text_byte_budget",
        &SELECTOR_REGISTRY_TEXT_BYTE_BUDGET.to_string(),
    )?;
    require_equal(
        &actual,
        "manifest_text_byte_budget",
        &MANIFEST_TEXT_BYTE_BUDGET.to_string(),
    )?;
    require_equal(
        &actual,
        "receipt_text_byte_budget",
        &RECEIPT_TEXT_BYTE_BUDGET.to_string(),
    )?;
    require_equal(
        &actual,
        "evidence_text_byte_budget",
        &EVIDENCE_TEXT_BYTE_BUDGET.to_string(),
    )?;
    require_equal(&actual, "required_next_gate", REQUIRED_NEXT_GATE)?;
    for (key, expected_value) in &expected {
        require_equal(&actual, key, expected_value)?;
    }
    for key in actual.keys() {
        if !expected.contains_key(key) {
            return Err(invalid(&format!("unexpected selector registry key {key}")));
        }
    }
    Ok(())
}

fn default_selector_entry(entries: &[RegistryEntry]) -> io::Result<&RegistryEntry> {
    entries
        .iter()
        .min_by_key(|entry| {
            (
                quantization_default_rank(&entry.quantization),
                &entry.candidate_id,
            )
        })
        .ok_or_else(|| invalid("selector registry requires at least one admission record"))
}

fn quantization_default_rank(quantization: &str) -> u8 {
    match quantization {
        "q4_0" => 0,
        "q8_0" => 1,
        "f32" => 2,
        _ => 3,
    }
}

// Pulls each reviewed admission into the browser selector entry shape.
fn entries_from_admissions(admission_texts: &[String]) -> io::Result<Vec<RegistryEntry>> {
    if admission_texts.is_empty() {
        return Err(invalid(
            "selector registry requires at least one admission record",
        ));
    }
    let selector_id = selector_id(admission_texts)?;
    let mut candidate_ids = HashSet::new();
    let mut slm_checksums = HashSet::new();
    let mut entries = Vec::with_capacity(admission_texts.len());
    for admission_text in admission_texts {
        let fields = validate_admission_summary_text(admission_text)?;
        let actual_selector = require_key(&fields, "selector_id")?;
        if actual_selector != selector_id {
            return Err(invalid(
                "selector registry admissions must share one selector_id",
            ));
        }
        let candidate_id = require_key(&fields, "candidate_id")?.to_string();
        if !candidate_ids.insert(candidate_id.clone()) {
            return Err(invalid(&format!(
                "duplicate selector registry candidate_id {candidate_id}"
            )));
        }
        let slm_checksum = require_key(&fields, "candidate_slm_checksum")?.to_string();
        if !slm_checksums.insert(slm_checksum.clone()) {
            return Err(invalid(&format!(
                "duplicate selector registry candidate checksum {slm_checksum}"
            )));
        }
        let artifact_path = require_key(&fields, "candidate_artifact_path")?.to_string();
        let model_path = browser_model_path(&artifact_path)?;
        let manifest_path = format!("{model_path}.manifest");
        let composition = registry_composition_from_fields(&fields, &model_path)?;
        let model_shape = require_key(&fields, "candidate_model_shape")?.to_string();
        let model_bytes = selector_model_bytes(require_key(&fields, "candidate_artifact_bytes")?)?;
        let tokenizer_checksum = require_key(&fields, "candidate_tokenizer_checksum")?.to_string();
        let source_manifest = registry_source_manifest_from_fields(&fields, &candidate_id)?;
        let source_validation = registry_source_validation_from_fields(&fields, &candidate_id)?;
        let runtime_smoke_path = registry_runtime_smoke_path_from_fields(&fields, &candidate_id)?;
        let eval_path = registry_eval_path_from_fields(&fields, &candidate_id)?;
        let operator_receipt = registry_operator_receipt_from_fields(&fields)?;
        let evolution_schedule =
            registry_evolution_schedule_from_fields(&fields, operator_receipt.as_ref())?;
        entries.push(RegistryEntry {
            candidate_id: candidate_id.clone(),
            display_name: display_name(
                &candidate_id,
                require_key(&fields, "candidate_quantization")?,
            ),
            artifact_path,
            model_path,
            manifest_path,
            composition,
            source_manifest,
            source_validation,
            max_tokens: default_max_tokens(&model_shape).to_string(),
            model_bytes: model_bytes.to_string(),
            slm_checksum,
            tokenizer_checksum,
            model_shape,
            quantization: require_key(&fields, "candidate_quantization")?.to_string(),
            output_contract: require_key(&fields, "candidate_output_contract")?.to_string(),
            admission_path: registry_admission_path_from_fields(&fields, &candidate_id)?,
            admission_checksum: hex64(provenance::text_checksum(admission_text.as_bytes())),
            promotion_manifest_checksum: require_key(&fields, "promotion_manifest_checksum")?
                .to_string(),
            provenance_manifest_checksum: require_key(&fields, "provenance_manifest_checksum")?
                .to_string(),
            runtime_smoke_path,
            runtime_smoke_manifest_checksum: require_key(
                &fields,
                "runtime_smoke_manifest_checksum",
            )?
            .to_string(),
            eval_path,
            eval_manifest_checksum: require_key(&fields, "eval_manifest_checksum")?.to_string(),
            eval_case_evidence_checksum: require_key(&fields, "eval_case_evidence_checksum")?
                .to_string(),
            quality_scope: require_key(&fields, "quality_scope")?.to_string(),
            quality_boundary: require_key(&fields, "quality_boundary")?.to_string(),
            eval_dataset: require_key(&fields, "eval_dataset")?.to_string(),
            cases_passed: require_key(&fields, "cases_passed")?.to_string(),
            admission_kind: fields
                .get("admission_kind")
                .cloned()
                .unwrap_or_else(|| "selector-admission".to_string()),
            operator_receipt,
            operator_receipt_checksum: fields.get("operator_receipt_checksum").cloned(),
            parent_pool_recipe_checksum: fields.get("parent_pool_recipe_checksum").cloned(),
            population_review_checksum: fields.get("population_review_checksum").cloned(),
            promotion_ledger_checksum: fields.get("promotion_ledger_checksum").cloned(),
            admission_set_checksum: fields.get("admission_set_checksum").cloned(),
            parent_count: match fields.get("parent_count") {
                Some(value) => {
                    let count = value.parse::<usize>().map_err(|_| {
                        invalid("selector registry admission parent_count is invalid")
                    })?;
                    if count == 0 {
                        return Err(invalid(
                            "selector registry admission parent_count is invalid",
                        ));
                    }
                    count
                }
                None => 1,
            },
            evolution_schedule,
        });
    }
    Ok(entries)
}

fn registry_composition_from_fields(
    fields: &HashMap<String, String>,
    model_path: &str,
) -> io::Result<RegistryCompositionRoute> {
    let model_file = model_path
        .rsplit('/')
        .next()
        .ok_or_else(|| invalid("selector registry model route is invalid"))?;
    let expected_file = format!("{model_file}.acg1");
    if require_key(fields, "composition_graph_file")? != expected_file {
        return Err(invalid(
            "selector registry composition graph file must be the exact model sidecar",
        ));
    }
    let bytes_text = require_key(fields, "composition_graph_bytes")?;
    let bytes = bytes_text
        .parse::<u64>()
        .map_err(|_| invalid("selector registry composition graph bytes are invalid"))?;
    if bytes == 0
        || bytes > SELECTOR_COMPOSITION_GRAPH_BYTE_BUDGET
        || bytes.to_string() != bytes_text
    {
        return Err(invalid(
            "selector registry composition graph bytes exceed the browser selector budget",
        ));
    }
    let member_count_text = require_key(fields, "composition_member_count")?;
    let member_count = member_count_text
        .parse::<usize>()
        .map_err(|_| invalid("selector registry composition member count is invalid"))?;
    if member_count.to_string() != member_count_text {
        return Err(invalid(
            "selector registry composition member count is invalid",
        ));
    }
    Ok(RegistryCompositionRoute {
        path: format!("{model_path}.acg1"),
        bytes,
        sha256: require_key(fields, "composition_graph_sha256")?.to_string(),
        base_model_id: require_key(fields, "composition_base_model_id")?.to_string(),
        composition_id: require_key(fields, "composition_id")?.to_string(),
        active_graph_sha256: require_key(fields, "composition_active_graph_sha256")?.to_string(),
        route_policy_id: require_key(fields, "composition_route_policy_id")?.to_string(),
        kv_format_id: require_key(fields, "composition_kv_format_id")?.to_string(),
        position_policy_sha256: require_key(fields, "composition_position_policy_sha256")?
            .to_string(),
        member_count,
    })
}

// Copies optional reviewed source-manifest evidence into selector-owned route metadata.
fn registry_source_manifest_from_fields(
    fields: &HashMap<String, String>,
    candidate_id: &str,
) -> io::Result<Option<RegistrySourceManifestRoute>> {
    let keys = [
        "source_manifest_path",
        "source_manifest_checksum",
        "source_manifest_kind",
        "source_manifest_status",
        "source_manifest_source_kind",
        "source_manifest_source_id",
        "source_manifest_model_shape",
        "source_review_kind",
        "source_review_path",
        "source_review_status",
        "source_review_checksum",
        "source_review_required_next_gate",
    ];
    let has_source_manifest = keys.iter().any(|key| fields.contains_key(*key));
    if !has_source_manifest {
        return Ok(None);
    }
    let path = require_key(fields, "source_manifest_path")?.to_string();
    let checksum = require_key(fields, "source_manifest_checksum")?.to_string();
    let kind = require_key(fields, "source_manifest_kind")?.to_string();
    let status = require_key(fields, "source_manifest_status")?.to_string();
    let source_kind = require_key(fields, "source_manifest_source_kind")?.to_string();
    let source_id = require_key(fields, "source_manifest_source_id")?.to_string();
    let model_shape = require_key(fields, "source_manifest_model_shape")?.to_string();
    let expected_path = format!("../evidence/{candidate_id}/converted-trained.source.manifest");
    if path != expected_path {
        return Err(invalid("selector registry source manifest path is invalid"));
    }
    validate_hex64(&checksum, "source_manifest_checksum")?;
    if kind != SOURCE_MANIFEST_KIND {
        return Err(invalid("selector registry source manifest kind is invalid"));
    }
    if status != SOURCE_MANIFEST_STATUS {
        return Err(invalid(
            "selector registry source manifest status is invalid",
        ));
    }
    match source_kind.as_str() {
        "trained-source-fixture" | "trained-export" => {}
        _ => {
            return Err(invalid(
                "selector registry source manifest source_kind is invalid",
            ))
        }
    }
    validate_registry_slug(&source_id, "source_manifest_source_id")?;
    validate_registry_slug(&model_shape, "source_manifest_model_shape")?;
    let source_review = registry_source_review_from_fields(fields, candidate_id)?;
    Ok(Some(RegistrySourceManifestRoute {
        path,
        checksum,
        kind,
        status,
        source_kind,
        source_id,
        model_shape,
        source_review,
    }))
}

fn registry_source_review_from_fields(
    fields: &HashMap<String, String>,
    candidate_id: &str,
) -> io::Result<Option<RegistrySourceReviewRoute>> {
    // Copies the pre-extraction safetensors review identity into the browser registry when present.
    let keys = [
        "source_review_kind",
        "source_review_path",
        "source_review_status",
        "source_review_checksum",
        "source_review_required_next_gate",
    ];
    if !keys.iter().any(|key| fields.contains_key(*key)) {
        return Ok(None);
    }
    let kind = require_key(fields, "source_review_kind")?.to_string();
    let path = require_key(fields, "source_review_path")?.to_string();
    let status = require_key(fields, "source_review_status")?.to_string();
    let checksum = require_key(fields, "source_review_checksum")?.to_string();
    let required_next_gate = require_key(fields, "source_review_required_next_gate")?.to_string();
    if kind != SOURCE_REVIEW_KIND {
        return Err(invalid("selector registry source_review_kind is invalid"));
    }
    let expected_path = format!("../evidence/{candidate_id}/converted-trained.source.review");
    if path != expected_path {
        return Err(invalid("selector registry source_review_path is invalid"));
    }
    validate_registry_evidence_path(&path, "source_review_path")?;
    if status != SOURCE_REVIEW_STATUS {
        return Err(invalid("selector registry source_review_status is invalid"));
    }
    validate_hex64(&checksum, "source_review_checksum")?;
    if required_next_gate != SOURCE_REVIEW_REQUIRED_NEXT_GATE {
        return Err(invalid(
            "selector registry source_review_required_next_gate is invalid",
        ));
    }
    Ok(Some(RegistrySourceReviewRoute {
        kind,
        path,
        status,
        checksum,
        required_next_gate,
    }))
}

fn registry_source_validation_from_fields(
    fields: &HashMap<String, String>,
    candidate_id: &str,
) -> io::Result<Option<RegistrySourceValidationRoute>> {
    // Preserves the validate-source sidecar only when it is scoped to the candidate evidence folder.
    let keys = ["source_validation_path", "source_validation_checksum"];
    if !keys.iter().any(|key| fields.contains_key(*key)) {
        return Ok(None);
    }
    let path = require_key(fields, "source_validation_path")?.to_string();
    let checksum = require_key(fields, "source_validation_checksum")?.to_string();
    validate_registry_slug(candidate_id, "candidate_id")?;
    let expected_path = format!("../evidence/{candidate_id}/converted-trained.source.validation");
    if path != expected_path {
        return Err(invalid(
            "selector registry source_validation_path must stay inside candidate evidence",
        ));
    }
    validate_registry_evidence_path(&path, "source_validation_path")?;
    validate_hex64(&checksum, "source_validation_checksum")?;
    Ok(Some(RegistrySourceValidationRoute { path, checksum }))
}

fn registry_admission_path_from_fields(
    fields: &HashMap<String, String>,
    candidate_id: &str,
) -> io::Result<Option<String>> {
    // Preserves the selector admission sidecar only when it is scoped to this candidate.
    let Some(path) = fields.get("admission_path") else {
        return Ok(None);
    };
    validate_registry_slug(candidate_id, "candidate_id")?;
    let expected_path = format!("../evidence/{candidate_id}/converted-trained.admission");
    if path != &expected_path {
        return Err(invalid(
            "selector registry admission_path must stay inside candidate evidence",
        ));
    }
    validate_registry_evidence_path(path, "admission_path")?;
    Ok(Some(path.clone()))
}

fn registry_eval_path_from_fields(
    fields: &HashMap<String, String>,
    candidate_id: &str,
) -> io::Result<Option<String>> {
    // Preserves a converted-trained eval sidecar route only when it is scoped to the candidate.
    let Some(path) = fields.get("eval_path") else {
        return Ok(None);
    };
    validate_registry_slug(candidate_id, "candidate_id")?;
    let expected_path = format!("../evidence/{candidate_id}/converted-trained.eval");
    if path != &expected_path {
        return Err(invalid(
            "selector registry eval path must stay inside candidate evidence",
        ));
    }
    validate_registry_evidence_path(path, "eval_path")?;
    Ok(Some(path.clone()))
}

fn registry_runtime_smoke_path_from_fields(
    fields: &HashMap<String, String>,
    candidate_id: &str,
) -> io::Result<Option<String>> {
    // Preserves a converted-trained runtime-smoke sidecar route only inside candidate evidence.
    let Some(path) = fields.get("runtime_smoke_path") else {
        return Ok(None);
    };
    validate_registry_slug(candidate_id, "candidate_id")?;
    let expected_path = format!("../evidence/{candidate_id}/converted-trained.runtime");
    if path != &expected_path {
        return Err(invalid(
            "selector registry runtime_smoke_path must stay inside candidate evidence",
        ));
    }
    validate_registry_evidence_path(path, "runtime_smoke_path")?;
    Ok(Some(path.clone()))
}

// Copies the full two-parent operator receipt family when an admission exposes it.
fn registry_operator_receipt_from_fields(
    fields: &HashMap<String, String>,
) -> io::Result<Option<RegistryOperatorReceipt>> {
    if !fields.contains_key("operator_receipt_status") {
        return Ok(None);
    }
    require_equal(fields, "operator_receipt_status", "receipt-bound")?;
    let checksum = require_key(fields, "operator_receipt_checksum")?.to_string();
    let candidate_slm_checksum =
        require_key(fields, "operator_receipt_candidate_slm_checksum")?.to_string();
    validate_hex64(&checksum, "operator_receipt_checksum")?;
    validate_hex64(
        &candidate_slm_checksum,
        "operator_receipt_candidate_slm_checksum",
    )?;
    require_equal(
        fields,
        "operator_receipt_candidate_slm_checksum",
        require_key(fields, "candidate_slm_checksum")?,
    )?;
    require_equal(
        fields,
        "operator_receipt_candidate_artifact_bytes",
        require_key(fields, "candidate_artifact_bytes")?,
    )?;
    let candidate_artifact_bytes =
        require_key(fields, "operator_receipt_candidate_artifact_bytes")?.to_string();
    if candidate_artifact_bytes.parse::<usize>().is_err() || candidate_artifact_bytes == "0" {
        return Err(invalid(
            "selector registry operator_receipt_candidate_artifact_bytes is invalid",
        ));
    }
    Ok(Some(RegistryOperatorReceipt {
        status: "receipt-bound".to_string(),
        path: require_key(fields, "operator_receipt_path")?.to_string(),
        checksum,
        operator_id: require_key(fields, "operator_receipt_operator_id")?.to_string(),
        operator_kind: require_key(fields, "operator_receipt_operator_kind")?.to_string(),
        candidate_slm_checksum,
        candidate_artifact_bytes,
    }))
}

// Copies parent-pool evolution schedule fields once an admission binds an operator receipt.
fn registry_evolution_schedule_from_fields(
    fields: &HashMap<String, String>,
    operator_receipt: Option<&RegistryOperatorReceipt>,
) -> io::Result<Option<RegistryEvolutionSchedule>> {
    if !EVOLUTION_SCHEDULE_KEYS
        .iter()
        .any(|key| fields.contains_key(*key))
    {
        return Ok(None);
    }
    let Some(receipt) = operator_receipt else {
        return Err(invalid(
            "selector registry evolution schedule requires an operator receipt",
        ));
    };
    require_equal(fields, "evolution_recipe_version", EVOLUTION_RECIPE_VERSION)?;
    require_equal(
        fields,
        "evolution_recipe_strategy",
        EVOLUTION_RECIPE_STRATEGY,
    )?;
    require_equal(fields, "evolution_recipe_status", EVOLUTION_RECIPE_STATUS)?;
    require_equal(
        fields,
        "evolution_selection_source",
        EVOLUTION_SELECTION_SOURCE,
    )?;
    require_equal(
        fields,
        "evolution_schedule_checksum_algorithm",
        EVOLUTION_SCHEDULE_CHECKSUM_ALGORITHM,
    )?;
    let relatedness_contract_checksum =
        require_key(fields, "evolution_relatedness_contract_checksum")?.to_string();
    let schedule_checksum = require_key(fields, "evolution_schedule_checksum")?.to_string();
    validate_hex64(
        &relatedness_contract_checksum,
        "evolution_relatedness_contract_checksum",
    )?;
    validate_hex64(&schedule_checksum, "evolution_schedule_checksum")?;
    let family_index = require_key(fields, "scheduled_operator_family_index")?.to_string();
    if family_index.parse::<usize>().is_err() {
        return Err(invalid(
            "selector registry scheduled_operator_family_index is invalid",
        ));
    }
    for key in [
        "scheduled_operator_family_kind",
        "scheduled_operator_family_command",
        "scheduled_operator_family_selection_rule",
        "scheduled_operator_family_output_gate",
    ] {
        validate_registry_slug(require_key(fields, key)?, key)?;
    }
    require_equal(
        fields,
        "scheduled_operator_family_kind",
        &receipt.operator_kind,
    )?;
    Ok(Some(RegistryEvolutionSchedule {
        recipe_version: EVOLUTION_RECIPE_VERSION.to_string(),
        recipe_strategy: EVOLUTION_RECIPE_STRATEGY.to_string(),
        recipe_status: EVOLUTION_RECIPE_STATUS.to_string(),
        selection_source: EVOLUTION_SELECTION_SOURCE.to_string(),
        relatedness_contract_checksum,
        schedule_checksum_algorithm: EVOLUTION_SCHEDULE_CHECKSUM_ALGORITHM.to_string(),
        schedule_checksum,
        family_index,
        family_kind: require_key(fields, "scheduled_operator_family_kind")?.to_string(),
        family_command: require_key(fields, "scheduled_operator_family_command")?.to_string(),
        family_selection_rule: require_key(fields, "scheduled_operator_family_selection_rule")?
            .to_string(),
        family_output_gate: require_key(fields, "scheduled_operator_family_output_gate")?
            .to_string(),
    }))
}

fn selector_id(admission_texts: &[String]) -> io::Result<String> {
    let Some(first) = admission_texts.first() else {
        return Err(invalid(
            "selector registry requires at least one admission record",
        ));
    };
    let fields = validate_admission_summary_text(first)?;
    Ok(require_key(&fields, "selector_id")?.to_string())
}

fn validate_admission_summary_text(admission_text: &str) -> io::Result<HashMap<String, String>> {
    let fields = parse_manifest(admission_text, "selector registry admission")?;
    if fields.contains_key("tinyrustlm_selector_admission_version") {
        return admission::validate_record_summary_text(admission_text);
    }
    Err(invalid(
        "selector registry admission record must use graph-authoritative admission version 2",
    ))
}

fn browser_model_path(artifact_path: &str) -> io::Result<String> {
    let normalized = artifact_path.replace('\\', "/");
    if let Some(rest) = normalized.strip_prefix("../models/") {
        validate_model_route_rest(rest)?;
        return Ok(format!("../models/{rest}"));
    }
    if let Some(index) = normalized.find("tinyrustlm/models/") {
        let rest = &normalized[index + "tinyrustlm/models/".len()..];
        validate_model_route_rest(rest)?;
        return Ok(format!("../models/{rest}"));
    }
    Err(invalid(
        "selector registry entries must point at served tinyrustlm/models .slm artifacts",
    ))
}

fn validate_model_route_rest(rest: &str) -> io::Result<()> {
    if rest.is_empty()
        || !rest.ends_with(".slm")
        || rest.contains(':')
        || rest.contains('\\')
        || rest.contains("//")
    {
        return Err(invalid("selector registry model route is invalid"));
    }
    for part in rest.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return Err(invalid("selector registry model route is invalid"));
        }
    }
    Ok(())
}

fn selector_model_bytes(value: &str) -> io::Result<u64> {
    let bytes = value
        .parse::<u64>()
        .map_err(|_| invalid("selector registry model bytes are invalid"))?;
    if bytes == 0 || bytes > SELECTOR_MODEL_BYTE_BUDGET || bytes.to_string() != value {
        return Err(invalid(
            "selector registry model bytes exceed the browser selector budget",
        ));
    }
    Ok(bytes)
}

fn validate_hex64(value: &str, label: &str) -> io::Result<()> {
    let Some(rest) = value.strip_prefix("0x") else {
        return Err(invalid(&format!("selector registry {label} is invalid")));
    };
    if rest.len() != 16 || !rest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(invalid(&format!("selector registry {label} is invalid")));
    }
    Ok(())
}

fn validate_registry_slug(value: &str, label: &str) -> io::Result<()> {
    // Keeps copied schedule commands and family names browser-safe without path semantics.
    if value.is_empty()
        || value.len() > 96
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err(invalid(&format!("selector registry {label} is invalid")));
    }
    Ok(())
}

fn validate_registry_evidence_path(value: &str, label: &str) -> io::Result<()> {
    // Keeps selector-carried evidence routes relative to the served local evidence tree.
    if !value.starts_with("../evidence/")
        || value.contains('\\')
        || value.contains("://")
        || value.contains("//")
    {
        return Err(invalid(&format!("selector registry {label} is invalid")));
    }
    for part in value["../evidence/".len()..].split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return Err(invalid(&format!("selector registry {label} is invalid")));
        }
    }
    Ok(())
}

fn default_max_tokens(model_shape: &str) -> usize {
    if model_shape.contains("hidden=16") {
        16
    } else {
        8
    }
}

fn display_name(candidate_id: &str, quantization: &str) -> String {
    // Gives converted source artifacts a stable browser label while leaving operator ids literal.
    if candidate_id.starts_with("converted-trained-") {
        return format!("Converted trained-source {quantization}");
    }
    format!("{candidate_id} {quantization}")
}

// Builds a stable browser-local genome id from the candidate's runtime-visible shape.
fn registry_entry_genome_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "candidate_id", &entry.candidate_id);
    push_line(&mut text, "model_shape", &entry.model_shape);
    push_line(&mut text, "quantization", &entry.quantization);
    push_line(&mut text, "output_contract", &entry.output_contract);
    push_line(&mut text, "tokenizer_checksum", &entry.tokenizer_checksum);
    push_line(&mut text, "slm_checksum", &entry.slm_checksum);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Summarizes the admission/eval chain used as the selector entry's lineage route.
fn registry_entry_genome_lineage_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "admission_checksum", &entry.admission_checksum);
    push_line(
        &mut text,
        "promotion_manifest_checksum",
        &entry.promotion_manifest_checksum,
    );
    push_line(
        &mut text,
        "runtime_smoke_manifest_checksum",
        &entry.runtime_smoke_manifest_checksum,
    );
    push_line(
        &mut text,
        "eval_manifest_checksum",
        &entry.eval_manifest_checksum,
    );
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Groups candidates by the model family traits that matter to browser-local selection.
fn registry_entry_species_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "model_shape", &entry.model_shape);
    push_line(&mut text, "quantization", &entry.quantization);
    push_line(&mut text, "output_contract", &entry.output_contract);
    push_line(&mut text, "tokenizer_checksum", &entry.tokenizer_checksum);
    push_line(&mut text, "max_tokens", &entry.max_tokens);
    hex64(provenance::text_checksum(text.as_bytes()))
}

fn push_registry_composition_checksum_inputs(text: &mut String, entry: &RegistryEntry) {
    push_line(text, "composition_graph_path", &entry.composition.path);
    push_line(
        text,
        "composition_graph_bytes",
        &entry.composition.bytes.to_string(),
    );
    push_line(text, "composition_graph_sha256", &entry.composition.sha256);
    push_line(
        text,
        "composition_base_model_id",
        &entry.composition.base_model_id,
    );
    push_line(text, "composition_id", &entry.composition.composition_id);
    push_line(
        text,
        "composition_active_graph_sha256",
        &entry.composition.active_graph_sha256,
    );
    push_line(
        text,
        "composition_route_policy_id",
        &entry.composition.route_policy_id,
    );
    push_line(
        text,
        "composition_kv_format_id",
        &entry.composition.kv_format_id,
    );
    push_line(
        text,
        "composition_position_policy_sha256",
        &entry.composition.position_policy_sha256,
    );
    push_line(
        text,
        "composition_member_count",
        &entry.composition.member_count.to_string(),
    );
}

// Binds a candidate species to the browser resource envelope it is expected to fit.
fn registry_entry_species_fit_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "selector_model_byte_budget",
        &SELECTOR_MODEL_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "selector_registry_text_byte_budget",
        &SELECTOR_REGISTRY_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "manifest_text_byte_budget",
        &MANIFEST_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "receipt_text_byte_budget",
        &RECEIPT_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "evidence_text_byte_budget",
        &EVIDENCE_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(&mut text, "model_bytes", &entry.model_bytes);
    push_line(&mut text, "max_tokens", &entry.max_tokens);
    push_line(&mut text, "model_shape", &entry.model_shape);
    push_line(&mut text, "quantization", &entry.quantization);
    push_line(&mut text, "tokenizer_checksum", &entry.tokenizer_checksum);
    push_registry_composition_checksum_inputs(&mut text, entry);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Sketches behavior-relevant traits so selector populations can keep useful variety.
fn registry_entry_novelty_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "species_id", &registry_entry_species_id(entry));
    push_line(&mut text, "quality_scope", &entry.quality_scope);
    push_line(&mut text, "eval_dataset", &entry.eval_dataset);
    push_line(&mut text, "output_contract", &entry.output_contract);
    push_line(&mut text, "quantization", &entry.quantization);
    push_line(&mut text, "max_tokens", &entry.max_tokens);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Binds the novelty sketch to concrete eval and active composition evidence.
fn registry_entry_novelty_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "genome_id", &registry_entry_genome_id(entry));
    push_line(&mut text, "species_id", &registry_entry_species_id(entry));
    push_line(
        &mut text,
        "fitness_vector_checksum",
        &registry_entry_fitness_vector_checksum(entry),
    );
    push_line(
        &mut text,
        "eval_case_evidence_checksum",
        &entry.eval_case_evidence_checksum,
    );
    push_registry_composition_checksum_inputs(&mut text, entry);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Names the selector population lane from species, novelty, and scoped fitness traits.
fn registry_entry_population_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "species_id", &registry_entry_species_id(entry));
    push_line(&mut text, "novelty_id", &registry_entry_novelty_id(entry));
    push_line(
        &mut text,
        "fitness_vector_checksum",
        &registry_entry_fitness_vector_checksum(entry),
    );
    push_line(&mut text, "quality_scope", &entry.quality_scope);
    push_line(&mut text, "eval_dataset", &entry.eval_dataset);
    push_line(&mut text, "quantization", &entry.quantization);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Binds population provenance to admission and active composition evidence.
fn registry_entry_population_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "population_id",
        &registry_entry_population_id(entry),
    );
    push_line(&mut text, "genome_id", &registry_entry_genome_id(entry));
    push_line(
        &mut text,
        "genome_lineage_checksum",
        &registry_entry_genome_lineage_checksum(entry),
    );
    push_line(
        &mut text,
        "species_fit_checksum",
        &registry_entry_species_fit_checksum(entry),
    );
    push_line(
        &mut text,
        "novelty_checksum",
        &registry_entry_novelty_checksum(entry),
    );
    push_line(
        &mut text,
        "fitness_vector_checksum",
        &registry_entry_fitness_vector_checksum(entry),
    );
    push_line(
        &mut text,
        "population_review_route",
        "admission-composition-bound",
    );
    push_line(&mut text, "admission_checksum", &entry.admission_checksum);
    push_registry_composition_checksum_inputs(&mut text, entry);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Names the mate-selection lane from the parent-pool route when the admission has one.
fn registry_entry_mate_selection_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "candidate_id", &entry.candidate_id);
    push_line(&mut text, "admission_kind", &entry.admission_kind);
    push_line(
        &mut text,
        "population_id",
        &registry_entry_population_id(entry),
    );
    push_line(
        &mut text,
        "parent_pool_recipe_checksum",
        option_or_marker(&entry.parent_pool_recipe_checksum, "admission-only"),
    );
    push_line(&mut text, "parent_count", &entry.parent_count.to_string());
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Marks whether a selector entry is backed by reviewed parent-pool mate selection.
fn registry_entry_mate_selection_status(entry: &RegistryEntry) -> &'static str {
    if entry.parent_pool_recipe_checksum.is_some() {
        MATE_SELECTION_PARENT_POOL_STATUS
    } else {
        MATE_SELECTION_ADMISSION_STATUS
    }
}

// Binds the parent-pool recipe and sign-merge route into browser-visible provenance.
fn registry_entry_mate_selection_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "mate_selection_id",
        &registry_entry_mate_selection_id(entry),
    );
    push_line(
        &mut text,
        "mate_selection_status",
        registry_entry_mate_selection_status(entry),
    );
    push_line(
        &mut text,
        "population_checksum",
        &registry_entry_population_checksum(entry),
    );
    push_line(&mut text, "parent_count", &entry.parent_count.to_string());
    push_line(
        &mut text,
        "parent_pool_recipe_checksum",
        option_or_marker(&entry.parent_pool_recipe_checksum, "admission-only"),
    );
    push_line(
        &mut text,
        "operator_receipt_checksum",
        option_or_marker(&entry.operator_receipt_checksum, "admission-only"),
    );
    push_operator_receipt_checksum_inputs(&mut text, entry);
    push_line(
        &mut text,
        "population_review_checksum",
        option_or_marker(&entry.population_review_checksum, "admission-only"),
    );
    push_line(
        &mut text,
        "promotion_ledger_checksum",
        option_or_marker(&entry.promotion_ledger_checksum, "admission-only"),
    );
    push_line(
        &mut text,
        "admission_set_checksum",
        option_or_marker(&entry.admission_set_checksum, "admission-only"),
    );
    push_line(&mut text, "admission_checksum", &entry.admission_checksum);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Emits selector entry fields for the optional two-parent operator receipt route.
fn push_registry_operator_receipt_lines(text: &mut String, prefix: &str, entry: &RegistryEntry) {
    if let Some(receipt) = &entry.operator_receipt {
        push_line(
            text,
            &format!("{prefix}.operator_receipt_status"),
            &receipt.status,
        );
        push_line(
            text,
            &format!("{prefix}.operator_receipt_path"),
            &receipt.path,
        );
        push_line(
            text,
            &format!("{prefix}.operator_receipt_checksum"),
            &receipt.checksum,
        );
        push_line(
            text,
            &format!("{prefix}.operator_receipt_operator_id"),
            &receipt.operator_id,
        );
        push_line(
            text,
            &format!("{prefix}.operator_receipt_operator_kind"),
            &receipt.operator_kind,
        );
        push_line(
            text,
            &format!("{prefix}.operator_receipt_candidate_slm_checksum"),
            &receipt.candidate_slm_checksum,
        );
        push_line(
            text,
            &format!("{prefix}.operator_receipt_candidate_artifact_bytes"),
            &receipt.candidate_artifact_bytes,
        );
    }
}

// Emits parent-pool evolution schedule fields for browser provenance and validation.
fn push_registry_evolution_schedule_lines(text: &mut String, prefix: &str, entry: &RegistryEntry) {
    if let Some(schedule) = &entry.evolution_schedule {
        push_line(
            text,
            &format!("{prefix}.evolution_recipe_version"),
            &schedule.recipe_version,
        );
        push_line(
            text,
            &format!("{prefix}.evolution_recipe_strategy"),
            &schedule.recipe_strategy,
        );
        push_line(
            text,
            &format!("{prefix}.evolution_recipe_status"),
            &schedule.recipe_status,
        );
        push_line(
            text,
            &format!("{prefix}.evolution_selection_source"),
            &schedule.selection_source,
        );
        push_line(
            text,
            &format!("{prefix}.evolution_relatedness_contract_checksum"),
            &schedule.relatedness_contract_checksum,
        );
        push_line(
            text,
            &format!("{prefix}.evolution_schedule_checksum_algorithm"),
            &schedule.schedule_checksum_algorithm,
        );
        push_line(
            text,
            &format!("{prefix}.evolution_schedule_checksum"),
            &schedule.schedule_checksum,
        );
        push_line(
            text,
            &format!("{prefix}.scheduled_operator_family_index"),
            &schedule.family_index,
        );
        push_line(
            text,
            &format!("{prefix}.scheduled_operator_family_kind"),
            &schedule.family_kind,
        );
        push_line(
            text,
            &format!("{prefix}.scheduled_operator_family_command"),
            &schedule.family_command,
        );
        push_line(
            text,
            &format!("{prefix}.scheduled_operator_family_selection_rule"),
            &schedule.family_selection_rule,
        );
        push_line(
            text,
            &format!("{prefix}.scheduled_operator_family_output_gate"),
            &schedule.family_output_gate,
        );
    }
}

// Includes copied operator and schedule fields in the mate-selection proof digest.
fn push_operator_receipt_checksum_inputs(text: &mut String, entry: &RegistryEntry) {
    if let Some(receipt) = &entry.operator_receipt {
        push_line(text, "operator_receipt_status", &receipt.status);
        push_line(text, "operator_receipt_path", &receipt.path);
        push_line(text, "operator_receipt_operator_id", &receipt.operator_id);
        push_line(
            text,
            "operator_receipt_operator_kind",
            &receipt.operator_kind,
        );
        push_line(
            text,
            "operator_receipt_candidate_slm_checksum",
            &receipt.candidate_slm_checksum,
        );
        push_line(
            text,
            "operator_receipt_candidate_artifact_bytes",
            &receipt.candidate_artifact_bytes,
        );
    } else {
        push_line(text, "operator_receipt_status", "admission-only");
        push_line(text, "operator_receipt_path", "admission-only");
        push_line(text, "operator_receipt_operator_id", "admission-only");
        push_line(text, "operator_receipt_operator_kind", "admission-only");
        push_line(
            text,
            "operator_receipt_candidate_slm_checksum",
            "admission-only",
        );
        push_line(
            text,
            "operator_receipt_candidate_artifact_bytes",
            "admission-only",
        );
    }
    push_evolution_schedule_checksum_inputs(text, entry);
}

// Includes copied schedule metadata in the selector proof digest when a parent pool is scheduled.
fn push_evolution_schedule_checksum_inputs(text: &mut String, entry: &RegistryEntry) {
    if let Some(schedule) = &entry.evolution_schedule {
        push_line(text, "evolution_recipe_version", &schedule.recipe_version);
        push_line(text, "evolution_recipe_strategy", &schedule.recipe_strategy);
        push_line(text, "evolution_recipe_status", &schedule.recipe_status);
        push_line(
            text,
            "evolution_selection_source",
            &schedule.selection_source,
        );
        push_line(
            text,
            "evolution_relatedness_contract_checksum",
            &schedule.relatedness_contract_checksum,
        );
        push_line(
            text,
            "evolution_schedule_checksum_algorithm",
            &schedule.schedule_checksum_algorithm,
        );
        push_line(
            text,
            "evolution_schedule_checksum",
            &schedule.schedule_checksum,
        );
        push_line(
            text,
            "scheduled_operator_family_index",
            &schedule.family_index,
        );
        push_line(
            text,
            "scheduled_operator_family_kind",
            &schedule.family_kind,
        );
        push_line(
            text,
            "scheduled_operator_family_command",
            &schedule.family_command,
        );
        push_line(
            text,
            "scheduled_operator_family_selection_rule",
            &schedule.family_selection_rule,
        );
        push_line(
            text,
            "scheduled_operator_family_output_gate",
            &schedule.family_output_gate,
        );
    } else {
        for key in EVOLUTION_SCHEDULE_KEYS {
            push_line(text, key, "admission-only");
        }
    }
}

// Names the observed behavior lane from runtime, eval, and selected-parent context.
fn registry_entry_phenotype_evidence_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "candidate_id", &entry.candidate_id);
    push_line(
        &mut text,
        "mate_selection_id",
        &registry_entry_mate_selection_id(entry),
    );
    push_line(&mut text, "quality_scope", &entry.quality_scope);
    push_line(&mut text, "eval_dataset", &entry.eval_dataset);
    push_line(&mut text, "cases_passed", &entry.cases_passed);
    push_line(
        &mut text,
        "eval_case_evidence_checksum",
        &entry.eval_case_evidence_checksum,
    );
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Binds phenotype evidence to the manifests and active composition that produced it.
fn registry_entry_phenotype_evidence_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "phenotype_evidence_id",
        &registry_entry_phenotype_evidence_id(entry),
    );
    push_line(
        &mut text,
        "phenotype_evidence_status",
        PHENOTYPE_EVIDENCE_STATUS,
    );
    push_line(
        &mut text,
        "provenance_manifest_checksum",
        &entry.provenance_manifest_checksum,
    );
    push_line(
        &mut text,
        "runtime_smoke_manifest_checksum",
        &entry.runtime_smoke_manifest_checksum,
    );
    push_line(
        &mut text,
        "eval_manifest_checksum",
        &entry.eval_manifest_checksum,
    );
    push_line(
        &mut text,
        "eval_case_evidence_checksum",
        &entry.eval_case_evidence_checksum,
    );
    push_line(&mut text, "quality_boundary", &entry.quality_boundary);
    push_line(
        &mut text,
        "fitness_vector_checksum",
        &registry_entry_fitness_vector_checksum(entry),
    );
    push_line(
        &mut text,
        "mate_selection_checksum",
        &registry_entry_mate_selection_checksum(entry),
    );
    push_registry_composition_checksum_inputs(&mut text, entry);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Names the served artifact identity that later selector work can inherit or compare.
fn registry_entry_heritable_artifact_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "candidate_id", &entry.candidate_id);
    push_line(&mut text, "artifact_path", &entry.artifact_path);
    push_line(&mut text, "model_path", &entry.model_path);
    push_line(&mut text, "manifest_path", &entry.manifest_path);
    match &entry.source_manifest {
        Some(source_manifest) => {
            push_line(&mut text, "source_manifest_path", &source_manifest.path);
            push_line(
                &mut text,
                "source_manifest_checksum",
                &source_manifest.checksum,
            );
            push_line(
                &mut text,
                "source_manifest_source_kind",
                &source_manifest.source_kind,
            );
            push_line(
                &mut text,
                "source_manifest_source_id",
                &source_manifest.source_id,
            );
            push_line(
                &mut text,
                "source_manifest_model_shape",
                &source_manifest.model_shape,
            );
            if let Some(source_review) = &source_manifest.source_review {
                push_line(&mut text, "source_review_kind", &source_review.kind);
                push_line(&mut text, "source_review_path", &source_review.path);
                push_line(&mut text, "source_review_status", &source_review.status);
                push_line(&mut text, "source_review_checksum", &source_review.checksum);
                push_line(
                    &mut text,
                    "source_review_required_next_gate",
                    &source_review.required_next_gate,
                );
            } else {
                push_line(&mut text, "source_review_status", "absent");
            }
        }
        None => push_line(&mut text, "source_manifest_status", "absent"),
    }
    push_line(&mut text, "model_bytes", &entry.model_bytes);
    push_line(&mut text, "slm_checksum", &entry.slm_checksum);
    push_line(&mut text, "model_shape", &entry.model_shape);
    push_line(&mut text, "quantization", &entry.quantization);
    push_line(&mut text, "output_contract", &entry.output_contract);
    push_line(&mut text, "genome_id", &registry_entry_genome_id(entry));
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Binds the heritable artifact id to lineage, eval evidence, and active composition.
fn registry_entry_heritable_artifact_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "heritable_artifact_id",
        &registry_entry_heritable_artifact_id(entry),
    );
    push_line(
        &mut text,
        "heritable_artifact_status",
        HERITABLE_ARTIFACT_STATUS,
    );
    push_line(&mut text, "genome_id", &registry_entry_genome_id(entry));
    push_line(
        &mut text,
        "genome_lineage_checksum",
        &registry_entry_genome_lineage_checksum(entry),
    );
    push_line(
        &mut text,
        "phenotype_evidence_checksum",
        &registry_entry_phenotype_evidence_checksum(entry),
    );
    push_line(
        &mut text,
        "fitness_vector_checksum",
        &registry_entry_fitness_vector_checksum(entry),
    );
    push_line(
        &mut text,
        "provenance_manifest_checksum",
        &entry.provenance_manifest_checksum,
    );
    push_line(
        &mut text,
        "runtime_smoke_manifest_checksum",
        &entry.runtime_smoke_manifest_checksum,
    );
    push_registry_composition_checksum_inputs(&mut text, entry);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Keeps checksum text deterministic for admission-only entries without parent-pool fields.
fn option_or_marker<'a>(value: &'a Option<String>, marker: &'a str) -> &'a str {
    value.as_deref().unwrap_or(marker)
}

// Condenses the scoped eval facts into a selector fitness vector checksum.
fn registry_entry_fitness_vector_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "quality_scope", &entry.quality_scope);
    push_line(&mut text, "quality_boundary", &entry.quality_boundary);
    push_line(&mut text, "eval_dataset", &entry.eval_dataset);
    push_line(&mut text, "cases_passed", &entry.cases_passed);
    push_line(
        &mut text,
        "eval_case_evidence_checksum",
        &entry.eval_case_evidence_checksum,
    );
    hex64(provenance::text_checksum(text.as_bytes()))
}

fn admission_set_checksum(admission_texts: &[String]) -> String {
    let mut source = String::new();
    for admission_text in admission_texts {
        push_line(
            &mut source,
            "admission_checksum",
            &hex64(provenance::text_checksum(admission_text.as_bytes())),
        );
    }
    hex64(provenance::text_checksum(source.as_bytes()))
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
        validate_key(key, label, line_index + 1)?;
        if value.is_empty() || value.contains('\r') || value.contains('\n') {
            return Err(invalid(&format!("{label} key {key} has an invalid value")));
        }
        if fields.insert(key.to_string(), value.to_string()).is_some() {
            return Err(invalid(&format!("duplicate {label} key {key}")));
        }
    }
    Ok(fields)
}

fn validate_key(key: &str, label: &str, line_number: usize) -> io::Result<()> {
    if key.is_empty()
        || !key
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_'))
    {
        return Err(invalid(&format!(
            "{label} line {line_number} has an invalid key"
        )));
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
            "selector registry key {key} was {actual}, expected {expected}"
        )));
    }
    Ok(())
}

fn push_line(text: &mut String, key: &str, value: &str) {
    text.push_str(key);
    text.push('=');
    text.push_str(value);
    text.push('\n');
}

fn hex64(value: u64) -> String {
    format!("0x{value:016x}")
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::build_model_file;
    use crate::candidate;
    use crate::compatibility;
    use crate::lineage;
    use crate::promotion;
    use crate::slm_validate;
    use crate::tensor_writer::{
        tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_F32, DTYPE_Q4_0, DTYPE_Q8_0,
    };
    use crate::tokenizer_writer::ByteTokenizerSection;

    #[test]
    fn writes_and_validates_selector_registry_from_admission_record() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission)).unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert!(registry.contains("tinyrustlm_selector_registry_version=2"));
        assert!(registry.contains("registry_status=admitted-records-only"));
        assert!(registry.contains("selector_model_byte_budget=33554432"));
        assert!(registry.contains("selector_composition_graph_byte_budget=16777216"));
        assert!(registry.contains("selector_registry_text_byte_budget=262144"));
        assert!(registry.contains("manifest_text_byte_budget=65536"));
        assert!(registry.contains("receipt_text_byte_budget=131072"));
        assert!(registry.contains("evidence_text_byte_budget=131072"));
        assert!(registry.contains("selector_default_strategy=browser-frugal-quantized"));
        assert!(registry.contains("selector_default_candidate_id=tiny-q8-candidate"));
        assert!(registry.contains("selector_default_quantization=q8_0"));
        assert!(registry.contains("entry.0.model_path=../models/tiny-q8.slm"));
        assert!(registry.contains("entry.0.composition_graph_path=../models/tiny-q8.slm.acg1"));
        assert!(registry.contains("entry.0.composition_graph_bytes=512"));
        assert!(registry.contains("entry.0.composition_graph_sha256=sha256:"));
        assert!(registry.contains("entry.0.composition_id=composition-sha256-"));
        assert!(registry.contains("entry.0.composition_route_policy_id=route-sha256-"));
        assert!(registry.contains("entry.0.composition_kv_format_id=kv-format-sha256-"));
        assert!(registry.contains("entry.0.composition_member_count=0"));
        assert!(registry.contains("entry.0.selector_status=admitted"));
    }

    #[test]
    fn rejects_selector_registry_composition_graph_identity_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.composition_id=composition-sha256-",
                "entry.0.composition_id=route-sha256-",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert!(error.to_string().contains("composition_id"));
    }

    #[test]
    fn rejects_admission_composition_graph_route_mismatch() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm")
            .replace(
                "composition_graph_file=tiny-q8.slm.acg1",
                "composition_graph_file=other.slm.acg1",
            );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert!(error.to_string().contains("exact model sidecar"));
    }

    #[test]
    fn writes_and_validates_selector_registry_source_manifest_route() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission)).unwrap();

        assert!(registry.contains(
            "entry.0.source_manifest_path=../evidence/converted-trained-q8/converted-trained.source.manifest"
        ));
        assert!(registry.contains("entry.0.source_manifest_checksum=0x00000000000000f1"));
        assert!(registry.contains("entry.0.source_manifest_kind=trained-source-manifest"));
        assert!(registry.contains("entry.0.source_manifest_status=reviewed-source-snapshot"));
        assert!(registry.contains("entry.0.source_manifest_source_kind=trained-source-fixture"));
        assert!(
            registry.contains("entry.0.source_manifest_source_id=tinyrustlm-local-source-fixture")
        );
        assert!(registry.contains("entry.0.source_manifest_model_shape=tiny-fixture"));
        assert!(registry.contains(
            "entry.0.source_validation_path=../evidence/converted-trained-q8/converted-trained.source.validation"
        ));
        assert!(registry.contains("entry.0.source_validation_checksum=0x00000000000000f5"));
        assert!(registry.contains(
            "entry.0.runtime_smoke_path=../evidence/converted-trained-q8/converted-trained.runtime"
        ));
        assert!(registry
            .contains("entry.0.eval_path=../evidence/converted-trained-q8/converted-trained.eval"));
        assert!(registry.contains(
            "entry.0.admission_path=../evidence/converted-trained-q8/converted-trained.admission"
        ));
        validate_registry_text(&registry, &[admission]).unwrap();
    }

    #[test]
    fn rejects_selector_registry_source_manifest_checksum_drift() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.source_manifest_checksum=0x00000000000000f1",
                "entry.0.source_manifest_checksum=0x00000000000000f2",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert!(error.to_string().contains("source_manifest_checksum"));
    }

    #[test]
    fn rejects_selector_registry_source_validation_checksum_drift() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.source_validation_checksum=0x00000000000000f5",
                "entry.0.source_validation_checksum=0x00000000000000f6",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert!(error.to_string().contains("source_validation_checksum"));
    }

    #[test]
    fn writes_and_validates_selector_registry_source_review_route() {
        let admission = fixture_admission_with_source_review_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission)).unwrap();

        assert!(registry.contains("entry.0.source_review_kind=safetensors-candidate-review"));
        assert!(registry.contains(
            "entry.0.source_review_path=../evidence/converted-trained-q8/converted-trained.source.review"
        ));
        assert!(registry.contains("entry.0.source_review_status=validated-before-extraction"));
        assert!(registry.contains("entry.0.source_review_checksum=0x00000000000000f3"));
        assert!(
            registry.contains("entry.0.source_review_required_next_gate=extract-raw-f32-tensors")
        );
        validate_registry_text(&registry, &[admission]).unwrap();
    }

    #[test]
    fn rejects_selector_registry_source_review_checksum_drift() {
        let admission = fixture_admission_with_source_review_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.source_review_checksum=0x00000000000000f3",
                "entry.0.source_review_checksum=0x00000000000000f4",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert!(error.to_string().contains("source_review_checksum"));
    }

    #[test]
    fn rejects_selector_registry_source_review_path_outside_candidate_evidence() {
        let admission = fixture_admission_with_source_review_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        )
        .replace(
            "source_review_path=../evidence/converted-trained-q8/converted-trained.source.review",
            "source_review_path=../evidence/converted-trained-f32/converted-trained.source.review",
        );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert!(error.to_string().contains("source_review_path"));
    }

    #[test]
    fn rejects_selector_registry_source_validation_route_outside_candidate_evidence() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        )
        .replace(
            "source_validation_path=../evidence/converted-trained-q8/converted-trained.source.validation",
            "source_validation_path=../evidence/converted-trained-f32/converted-trained.source.validation",
        );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert!(error.to_string().contains("source_validation_path"));
    }

    #[test]
    fn rejects_selector_registry_admission_route_outside_candidate_evidence() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        )
        .replace(
            "admission_path=../evidence/converted-trained-q8/converted-trained.admission",
            "admission_path=../evidence/converted-trained-f32/converted-trained.admission",
        );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert!(error.to_string().contains("admission_path"));
    }

    #[test]
    fn rejects_selector_registry_admission_path_drift() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission)).unwrap().replace(
            "entry.0.admission_path=../evidence/converted-trained-q8/converted-trained.admission",
            "entry.0.admission_path=../evidence/converted-trained-f32/converted-trained.admission",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert!(error.to_string().contains("admission_path"));
    }

    #[test]
    fn rejects_selector_registry_source_manifest_route_outside_candidate_evidence() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        )
        .replace(
            "source_manifest_path=../evidence/converted-trained-q8/converted-trained.source.manifest",
            "source_manifest_path=../evidence/converted-trained-f32/converted-trained.source.manifest",
        );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert!(error.to_string().contains("source manifest path"));
    }

    #[test]
    fn rejects_selector_registry_source_manifest_identity_drift() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.source_manifest_source_id=tinyrustlm-local-source-fixture",
                "entry.0.source_manifest_source_id=tinyrustlm-local-source-drift",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert!(error.to_string().contains("source_manifest_source_id"));
    }

    #[test]
    fn rejects_selector_registry_eval_route_outside_candidate_evidence() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        )
        .replace(
            "eval_path=../evidence/converted-trained-q8/converted-trained.eval",
            "eval_path=../evidence/converted-trained-f32/converted-trained.eval",
        );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert!(error.to_string().contains("eval path"));
    }

    #[test]
    fn rejects_selector_registry_runtime_smoke_route_outside_candidate_evidence() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        )
        .replace(
            "runtime_smoke_path=../evidence/converted-trained-q8/converted-trained.runtime",
            "runtime_smoke_path=../evidence/converted-trained-f32/converted-trained.runtime",
        );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert!(error.to_string().contains("runtime_smoke_path"));
    }

    #[test]
    fn display_name_labels_converted_trained_source_entries() {
        assert_eq!(
            display_name("converted-trained-q8", "q8_0"),
            "Converted trained-source q8_0"
        );
        assert_eq!(
            display_name("tiny-q8-candidate", "q8_0"),
            "tiny-q8-candidate q8_0"
        );
    }

    #[test]
    fn writes_and_validates_selector_registry_from_operator_receipt_bound_admission() {
        let admission = fixture_operator_receipt_bound_admission(
            "tiny-q8-candidate",
            "tinyrustlm/models/tiny-q8.slm",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission)).unwrap();
        let admission_fields = parse_manifest(&admission, "admission").unwrap();
        let registry_fields = parse_manifest(&registry, "selector registry").unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert_eq!(
            registry_fields["entry.0.operator_receipt_status"],
            "receipt-bound"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_checksum"],
            admission_fields["operator_receipt_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_operator_kind"],
            "deterministic-bounded-parameter-mutation"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_slm_checksum"],
            registry_fields["entry.0.slm_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_artifact_bytes"],
            registry_fields["entry.0.model_bytes"]
        );
    }

    #[test]
    fn writes_and_validates_selector_registry_from_federated_receipt_bound_admission() {
        let admission = fixture_operator_receipt_bound_admission_with_kind(
            "tiny-q8-federated",
            "tinyrustlm/models/tiny-q8-federated.slm",
            "federated-local-update-average",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission)).unwrap();
        let admission_fields = parse_manifest(&admission, "admission").unwrap();
        let registry_fields = parse_manifest(&registry, "selector registry").unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert_eq!(
            registry_fields["entry.0.operator_receipt_status"],
            "receipt-bound"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_operator_kind"],
            "federated-local-update-average"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_checksum"],
            admission_fields["operator_receipt_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_slm_checksum"],
            registry_fields["entry.0.slm_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_artifact_bytes"],
            registry_fields["entry.0.model_bytes"]
        );
    }

    #[test]
    fn writes_and_validates_selector_registry_from_prune_receipt_bound_admission() {
        let admission = fixture_operator_receipt_bound_admission_with_kind(
            "tiny-q8-prune",
            "tinyrustlm/models/tiny-q8-prune.slm",
            "deterministic-magnitude-parameter-pruning",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission)).unwrap();
        let admission_fields = parse_manifest(&admission, "admission").unwrap();
        let registry_fields = parse_manifest(&registry, "selector registry").unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert_eq!(
            registry_fields["entry.0.operator_receipt_status"],
            "receipt-bound"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_operator_kind"],
            "deterministic-magnitude-parameter-pruning"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_checksum"],
            admission_fields["operator_receipt_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_slm_checksum"],
            registry_fields["entry.0.slm_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_artifact_bytes"],
            registry_fields["entry.0.model_bytes"]
        );
    }

    #[test]
    fn writes_and_validates_selector_registry_from_dare_receipt_bound_admission() {
        // Confirms DARE operator receipts keep their kind and byte echo through selector routing.
        let admission = fixture_operator_receipt_bound_admission_with_kind(
            "tiny-q8-dare",
            "tinyrustlm/models/tiny-q8-dare.slm",
            "dropout-rescaled-task-delta",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission)).unwrap();
        let admission_fields = parse_manifest(&admission, "admission").unwrap();
        let registry_fields = parse_manifest(&registry, "selector registry").unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert_eq!(
            registry_fields["entry.0.operator_receipt_status"],
            "receipt-bound"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_operator_kind"],
            "dropout-rescaled-task-delta"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_checksum"],
            admission_fields["operator_receipt_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_slm_checksum"],
            registry_fields["entry.0.slm_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_artifact_bytes"],
            registry_fields["entry.0.model_bytes"]
        );
    }

    #[test]
    fn rejects_selector_registry_federated_operator_receipt_kind_drift() {
        let admission = fixture_operator_receipt_bound_admission_with_kind(
            "tiny-q8-federated",
            "tinyrustlm/models/tiny-q8-federated.slm",
            "federated-local-update-average",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.operator_receipt_operator_kind=federated-local-update-average",
                "entry.0.operator_receipt_operator_kind=deterministic-bounded-parameter-mutation",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator_receipt_operator_kind"));
    }

    #[test]
    fn rejects_selector_registry_prune_operator_receipt_kind_drift() {
        let admission = fixture_operator_receipt_bound_admission_with_kind(
            "tiny-q8-prune",
            "tinyrustlm/models/tiny-q8-prune.slm",
            "deterministic-magnitude-parameter-pruning",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.operator_receipt_operator_kind=deterministic-magnitude-parameter-pruning",
                "entry.0.operator_receipt_operator_kind=deterministic-bounded-parameter-mutation",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator_receipt_operator_kind"));
    }

    #[test]
    fn rejects_selector_registry_dare_operator_receipt_kind_drift() {
        let admission = fixture_operator_receipt_bound_admission_with_kind(
            "tiny-q8-dare",
            "tinyrustlm/models/tiny-q8-dare.slm",
            "dropout-rescaled-task-delta",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.operator_receipt_operator_kind=dropout-rescaled-task-delta",
                "entry.0.operator_receipt_operator_kind=direct-parameter-task-delta",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator_receipt_operator_kind"));
    }

    #[test]
    fn rejects_removed_multi_parent_admission_contract() {
        let admission = "tinyrustlm_multi_parent_selector_admission_version=1\n".to_string();

        let error = build_registry_text(&[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("graph-authoritative admission version 2"));
    }

    #[test]
    fn writes_frugal_selector_default_for_mixed_quantizations() {
        let f32_admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let q8_admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let q4_admission =
            fixture_q4_admission("tiny-q4-candidate", "tinyrustlm/models/tiny-q4.slm");

        let registry = build_registry_text(&[
            f32_admission.clone(),
            q8_admission.clone(),
            q4_admission.clone(),
        ])
        .unwrap();

        validate_registry_text(&registry, &[f32_admission, q8_admission, q4_admission]).unwrap();
        assert!(registry.contains("entry_count=3"));
        assert!(registry.contains("selector_model_byte_budget=33554432"));
        assert!(registry.contains("selector_default_candidate_id=tiny-q4-candidate"));
        assert!(registry.contains("selector_default_quantization=q4_0"));
    }

    #[test]
    fn writes_selector_registry_genome_species_novelty_population_phenotype_and_fitness_metadata() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission)).unwrap();
        let fields = parse_manifest(&registry, "selector registry").unwrap();
        let entries = entries_from_admissions(std::slice::from_ref(&admission)).unwrap();
        let entry = &entries[0];

        validate_registry_text(&registry, &[admission]).unwrap();
        assert_eq!(fields["entry.0.genome_id"], registry_entry_genome_id(entry));
        assert_eq!(fields["entry.0.genome_strategy"], GENOME_STRATEGY);
        assert_eq!(
            fields["entry.0.genome_lineage_status"],
            GENOME_LINEAGE_STATUS
        );
        assert_eq!(
            fields["entry.0.genome_lineage_checksum"],
            registry_entry_genome_lineage_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.species_id"],
            registry_entry_species_id(entry)
        );
        assert_eq!(fields["entry.0.species_strategy"], SPECIES_STRATEGY);
        assert_eq!(fields["entry.0.species_fit_status"], SPECIES_FIT_STATUS);
        assert_eq!(
            fields["entry.0.species_fit_checksum"],
            registry_entry_species_fit_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.novelty_id"],
            registry_entry_novelty_id(entry)
        );
        assert_eq!(fields["entry.0.novelty_strategy"], NOVELTY_STRATEGY);
        assert_eq!(fields["entry.0.novelty_status"], NOVELTY_STATUS);
        assert_eq!(
            fields["entry.0.novelty_checksum"],
            registry_entry_novelty_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.population_id"],
            registry_entry_population_id(entry)
        );
        assert_eq!(fields["entry.0.population_strategy"], POPULATION_STRATEGY);
        assert_eq!(fields["entry.0.population_status"], POPULATION_STATUS);
        assert_eq!(
            fields["entry.0.population_checksum"],
            registry_entry_population_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.mate_selection_id"],
            registry_entry_mate_selection_id(entry)
        );
        assert_eq!(
            fields["entry.0.mate_selection_strategy"],
            MATE_SELECTION_STRATEGY
        );
        assert_eq!(
            fields["entry.0.mate_selection_status"],
            MATE_SELECTION_ADMISSION_STATUS
        );
        assert_eq!(fields["entry.0.mate_selection_parent_count"], "1");
        assert_eq!(
            fields["entry.0.mate_selection_checksum"],
            registry_entry_mate_selection_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.phenotype_evidence_id"],
            registry_entry_phenotype_evidence_id(entry)
        );
        assert_eq!(
            fields["entry.0.phenotype_evidence_strategy"],
            PHENOTYPE_EVIDENCE_STRATEGY
        );
        assert_eq!(
            fields["entry.0.phenotype_evidence_status"],
            PHENOTYPE_EVIDENCE_STATUS
        );
        assert_eq!(
            fields["entry.0.phenotype_evidence_checksum"],
            registry_entry_phenotype_evidence_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.heritable_artifact_id"],
            registry_entry_heritable_artifact_id(entry)
        );
        assert_eq!(
            fields["entry.0.heritable_artifact_strategy"],
            HERITABLE_ARTIFACT_STRATEGY
        );
        assert_eq!(
            fields["entry.0.heritable_artifact_status"],
            HERITABLE_ARTIFACT_STATUS
        );
        assert_eq!(
            fields["entry.0.heritable_artifact_checksum"],
            registry_entry_heritable_artifact_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.provenance_manifest_checksum"],
            entry.provenance_manifest_checksum
        );
        assert_eq!(
            fields["entry.0.fitness_vector_status"],
            FITNESS_VECTOR_STATUS
        );
        assert_eq!(
            fields["entry.0.fitness_vector_checksum"],
            registry_entry_fitness_vector_checksum(entry)
        );
    }

    #[test]
    fn rejects_selector_registry_genome_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.genome_strategy=selector-admission-genome-v1",
                "entry.0.genome_strategy=selector-admission-genome-v2",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("genome_strategy"));
    }

    #[test]
    fn rejects_selector_registry_species_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.species_fit_status=browser-fit-bound",
                "entry.0.species_fit_status=desktop-fit-bound",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("species_fit_status"));
    }

    #[test]
    fn rejects_selector_registry_novelty_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.novelty_status=behavior-sketch-bound",
                "entry.0.novelty_status=unreviewed",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("novelty_status"));
    }

    #[test]
    fn rejects_selector_registry_population_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.population_status=population-review-bound",
                "entry.0.population_status=unreviewed",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("population_status"));
    }

    #[test]
    fn rejects_selector_registry_mate_selection_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.mate_selection_status=admission-only",
                "entry.0.mate_selection_status=unbound",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("mate_selection_status"));
    }

    #[test]
    fn rejects_selector_registry_mate_selection_parent_count_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.mate_selection_parent_count=1",
                "entry.0.mate_selection_parent_count=2",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("mate_selection_parent_count"));
    }

    #[test]
    fn rejects_selector_registry_operator_receipt_field_drift() {
        let admission = fixture_operator_receipt_bound_admission(
            "tiny-q8-candidate",
            "tinyrustlm/models/tiny-q8.slm",
        );
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.operator_receipt_operator_kind=deterministic-bounded-parameter-mutation",
                "entry.0.operator_receipt_operator_kind=unbound",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator_receipt_operator_kind"));
    }

    #[test]
    fn rejects_selector_registry_phenotype_evidence_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.phenotype_evidence_status=runtime-eval-bound",
                "entry.0.phenotype_evidence_status=unbound",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("phenotype_evidence_status"));
    }

    #[test]
    fn rejects_selector_registry_heritable_artifact_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.heritable_artifact_status=served-artifact-bound",
                "entry.0.heritable_artifact_status=detached",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("heritable_artifact_status"));
    }

    #[test]
    fn rejects_selector_registry_fitness_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.fitness_vector_status=eval-bound",
                "entry.0.fitness_vector_status=unreviewed",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("fitness_vector_status"));
    }

    #[test]
    fn rejects_empty_registry_input() {
        let error = build_registry_text(&[]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("at least one admission"));
    }

    #[test]
    fn rejects_selector_id_mismatch() {
        let left = fixture_admission("candidate-a", "tinyrustlm/models/a.slm");
        let right = fixture_admission("candidate-b", "tinyrustlm/models/b.slm").replace(
            "selector_id=browser-local-selector",
            "selector_id=other-selector",
        );

        let error = build_registry_text(&[left, right]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("selector_id"));
    }

    #[test]
    fn rejects_duplicate_candidate_id() {
        let left = fixture_admission("candidate-a", "tinyrustlm/models/a.slm");
        let right = fixture_admission("candidate-a", "tinyrustlm/models/b.slm");

        let error = build_registry_text(&[left, right]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("duplicate selector registry candidate_id"));
    }

    #[test]
    fn rejects_unserved_candidate_path() {
        let admission = fixture_admission("candidate-a", "target/admission-smoke/a.slm");

        let error = build_registry_text(&[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("served tinyrustlm/models"));
    }

    #[test]
    fn rejects_selector_registry_model_bytes_over_budget() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm")
            .replace(
                "candidate_artifact_bytes=8832",
                "candidate_artifact_bytes=33554433",
            );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("browser selector budget"));
    }

    #[test]
    fn rejects_registry_entry_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "entry.0.selector_status=admitted",
                "entry.0.selector_status=pending",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("selector_status"));
    }

    #[test]
    fn rejects_selector_registry_budget_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "selector_model_byte_budget=33554432",
                "selector_model_byte_budget=33554431",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("selector_model_byte_budget"));
    }

    #[test]
    fn rejects_selector_registry_text_budget_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(std::slice::from_ref(&admission))
            .unwrap()
            .replace(
                "manifest_text_byte_budget=65536",
                "manifest_text_byte_budget=65537",
            );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("manifest_text_byte_budget"));
    }

    #[test]
    fn rejects_unsupported_admission_version() {
        let admission = "selector_id=browser-local-selector\ncandidate_id=oops\n".to_string();

        let error = build_registry_text(&[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("graph-authoritative admission version 2"));
    }

    fn fixture_admission(candidate_id: &str, candidate_path: &str) -> String {
        fixture_admission_for_bytes(candidate_id, candidate_path, tiny_fixture_q8_bytes())
    }

    fn fixture_admission_with_source_manifest_route(
        candidate_id: &str,
        candidate_path: &str,
    ) -> String {
        // Adds the converted-trained source evidence route extension consumed by selector entries.
        let mut admission = fixture_admission(candidate_id, candidate_path);
        push_line(
            &mut admission,
            "admission_path",
            &format!("../evidence/{candidate_id}/converted-trained.admission"),
        );
        push_line(
            &mut admission,
            "source_manifest_path",
            &format!("../evidence/{candidate_id}/converted-trained.source.manifest"),
        );
        push_line(
            &mut admission,
            "source_manifest_checksum",
            "0x00000000000000f1",
        );
        push_line(&mut admission, "source_manifest_kind", SOURCE_MANIFEST_KIND);
        push_line(
            &mut admission,
            "source_manifest_status",
            SOURCE_MANIFEST_STATUS,
        );
        push_line(
            &mut admission,
            "source_manifest_source_kind",
            "trained-source-fixture",
        );
        push_line(
            &mut admission,
            "source_manifest_source_id",
            "tinyrustlm-local-source-fixture",
        );
        push_line(
            &mut admission,
            "source_manifest_model_shape",
            "tiny-fixture",
        );
        push_line(
            &mut admission,
            "source_validation_path",
            &format!("../evidence/{candidate_id}/converted-trained.source.validation"),
        );
        push_line(
            &mut admission,
            "source_validation_checksum",
            "0x00000000000000f5",
        );
        push_line(
            &mut admission,
            "runtime_smoke_path",
            &format!("../evidence/{candidate_id}/converted-trained.runtime"),
        );
        push_line(
            &mut admission,
            "eval_path",
            &format!("../evidence/{candidate_id}/converted-trained.eval"),
        );
        admission
    }

    fn fixture_admission_with_source_review_route(
        candidate_id: &str,
        candidate_path: &str,
    ) -> String {
        // Adds pre-extraction safetensors review evidence to the converted-trained source route.
        let mut admission =
            fixture_admission_with_source_manifest_route(candidate_id, candidate_path);
        push_line(&mut admission, "source_review_kind", SOURCE_REVIEW_KIND);
        push_line(
            &mut admission,
            "source_review_path",
            &format!("../evidence/{candidate_id}/converted-trained.source.review"),
        );
        push_line(&mut admission, "source_review_status", SOURCE_REVIEW_STATUS);
        push_line(
            &mut admission,
            "source_review_checksum",
            "0x00000000000000f3",
        );
        push_line(
            &mut admission,
            "source_review_required_next_gate",
            SOURCE_REVIEW_REQUIRED_NEXT_GATE,
        );
        admission
    }

    fn fixture_f32_admission(candidate_id: &str, candidate_path: &str) -> String {
        fixture_admission_for_bytes(candidate_id, candidate_path, tiny_fixture_f32_bytes())
    }

    fn fixture_q4_admission(candidate_id: &str, candidate_path: &str) -> String {
        fixture_admission_for_bytes(candidate_id, candidate_path, tiny_fixture_q4_bytes())
    }

    fn fixture_operator_receipt_bound_admission(
        candidate_id: &str,
        candidate_path: &str,
    ) -> String {
        fixture_operator_receipt_bound_admission_for_bytes(
            candidate_id,
            candidate_path,
            tiny_fixture_q8_bytes(),
        )
    }

    fn fixture_operator_receipt_bound_admission_for_bytes(
        candidate_id: &str,
        candidate_path: &str,
        candidate: Vec<u8>,
    ) -> String {
        fixture_operator_receipt_bound_admission_for_bytes_with_kind(
            candidate_id,
            candidate_path,
            candidate,
            "deterministic-bounded-parameter-mutation",
        )
    }

    fn fixture_operator_receipt_bound_admission_with_kind(
        candidate_id: &str,
        candidate_path: &str,
        operator_kind: &str,
    ) -> String {
        fixture_operator_receipt_bound_admission_for_bytes_with_kind(
            candidate_id,
            candidate_path,
            tiny_fixture_q8_bytes(),
            operator_kind,
        )
    }

    // Builds a full two-parent admission chain with the requested operator kind in the bound receipt.
    fn fixture_operator_receipt_bound_admission_for_bytes_with_kind(
        candidate_id: &str,
        candidate_path: &str,
        candidate: Vec<u8>,
        operator_kind: &str,
    ) -> String {
        let compatibility = compatibility::compatibility_text_for_bytes(
            &candidate,
            "left.slm",
            &candidate,
            "right.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, candidate_id, "operator-a", "fit")
                .unwrap();
        let receipt =
            operator_receipt_text_with_kind(&lineage, &candidate, candidate_path, operator_kind);
        let candidate_manifest = candidate::build_manifest_text_with_operator_receipt_text(
            &compatibility,
            &lineage,
            &candidate,
            candidate_path,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();
        let promotion = promotion::build_template_text_with_operator_receipt_text(
            &compatibility,
            &lineage,
            &candidate,
            candidate_path,
            &candidate_manifest,
            "local-smoke-runner",
            promotion::DEFAULT_PROMOTION_SCOPE,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();
        let report = slm_validate::validate_bytes(&candidate, candidate_path).unwrap();
        let provenance_manifest =
            provenance::build_manifest_text(&report, "converted-trained").unwrap();
        let manifest_fields = provenance::parse_manifest(&provenance_manifest).unwrap();
        let runtime_smoke =
            provenance::build_runtime_smoke_text(&report, &provenance_manifest, &manifest_fields)
                .unwrap();
        let eval = passing_eval_text(&report, &provenance_manifest, candidate_path);
        admission::build_record_text_with_operator_receipt_text(
            &compatibility,
            &lineage,
            &candidate,
            candidate_path,
            &candidate_manifest,
            &promotion,
            &provenance_manifest,
            &runtime_smoke,
            &eval,
            admission::DEFAULT_ADMISSION_SELECTOR_ID,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap()
    }

    fn fixture_admission_for_bytes(
        candidate_id: &str,
        candidate_path: &str,
        candidate: Vec<u8>,
    ) -> String {
        let compatibility = compatibility::compatibility_text_for_bytes(
            &candidate,
            "left.slm",
            &candidate,
            "right.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, candidate_id, "operator-a", "fit")
                .unwrap();
        let candidate_manifest =
            candidate::build_manifest_text(&compatibility, &lineage, &candidate, candidate_path)
                .unwrap();
        let promotion = promotion::build_template_text(
            &compatibility,
            &lineage,
            &candidate,
            candidate_path,
            &candidate_manifest,
            "local-smoke-runner",
            promotion::DEFAULT_PROMOTION_SCOPE,
        )
        .unwrap();
        let report = slm_validate::validate_bytes(&candidate, candidate_path).unwrap();
        let provenance_manifest =
            provenance::build_manifest_text(&report, "converted-trained").unwrap();
        let manifest_fields = provenance::parse_manifest(&provenance_manifest).unwrap();
        let runtime_smoke =
            provenance::build_runtime_smoke_text(&report, &provenance_manifest, &manifest_fields)
                .unwrap();
        let eval = passing_eval_text(&report, &provenance_manifest, candidate_path);
        admission::build_record_text(
            &compatibility,
            &lineage,
            &candidate,
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

    // Keeps the synthetic receipt minimal while letting tests prove non-mutation operator routing.
    fn operator_receipt_text_with_kind(
        lineage_text: &str,
        candidate: &[u8],
        candidate_path: &str,
        operator_kind: &str,
    ) -> String {
        let lineage_fields = parse_manifest(lineage_text, "lineage").unwrap();
        let report = slm_validate::validate_bytes(candidate, candidate_path).unwrap();
        let mut text = String::new();
        push_line(&mut text, "operator_kind", operator_kind);
        push_line(
            &mut text,
            "candidate_id",
            require_key(&lineage_fields, "candidate_id").unwrap(),
        );
        push_line(
            &mut text,
            "operator_id",
            require_key(&lineage_fields, "operator_id").unwrap(),
        );
        push_line(&mut text, "candidate_artifact_path", report.path());
        push_line(
            &mut text,
            "candidate_artifact_bytes",
            &report.file_bytes().to_string(),
        );
        push_line(
            &mut text,
            "candidate_slm_checksum",
            &hex64(report.checksum()),
        );
        push_line(
            &mut text,
            "required_next_gate",
            "candidate-manifest-plus-runtime-smoke-plus-eval",
        );
        text
    }

    fn passing_eval_text(
        report: &slm_validate::ValidationReport,
        manifest: &str,
        candidate_path: &str,
    ) -> String {
        let candidate_file = Path::new(candidate_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap();
        provenance::build_reviewed_honest_quality_eval_text(report, manifest, "converted-trained")
            .replace(
                "composition_graph_file=test-fixture.slm.acg1",
                &format!("composition_graph_file={candidate_file}.acg1"),
            )
    }

    fn tiny_fixture_q8_bytes() -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_Q8_0),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }

    fn tiny_fixture_f32_bytes() -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_F32),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }

    fn tiny_fixture_q4_bytes() -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_Q4_0),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }
}
