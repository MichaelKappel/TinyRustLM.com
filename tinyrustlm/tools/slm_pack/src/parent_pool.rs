//! Offline parent-pool recipes built from population reviews.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::blend::{hex64, invalid, parse_manifest, push_line, require_equal, require_key};
use crate::population;
use crate::provenance;

const RECIPE_VERSION: &str = "1";
const RECIPE_ID: &str = "browser-local-parent-pool-recipe";
const RECIPE_SCOPE: &str = "offline-model-breeding-parent-pool-recipe";
const RECIPE_STATUS: &str = "population-reviewed";
const RECIPE_BASIS: &str = "population-review-plus-promotion-ledger";
const RECIPE_KIND: &str = "sign-aware-parent-pool-v1";
const PARENT_SELECTION: &str = "all-reviewed-candidates";
const SEED_WEIGHT_FORMULA: &str = "population-fitness-normalized-ppm";
const PARENT_CONTRACT_STATUS: &str = "shared-direct-parameter-contract";
const RELATEDNESS_METRIC: &str = "shared-direct-parameter-contract-v1";
const RELATEDNESS_SCOPE: &str = "selected-parent-pool";
const RELATEDNESS_ALL_PAIRS_STATUS: &str = "shared-direct-parameter-contract";
const RELATEDNESS_GROUP: &str = "direct-parameter-family.0";
const EVOLUTION_RECIPE_VERSION: &str = "1";
const EVOLUTION_RECIPE_STRATEGY: &str = "population-based-parent-pool-replay-v1";
const EVOLUTION_RECIPE_STATUS: &str = "operator-family-planned";
const EVOLUTION_SELECTION_SOURCE: &str = "population-fitness-normalized-seed-weights";
const EVOLUTION_SCHEDULE_CHECKSUM_ALGORITHM: &str = "tinyrustlm-text-checksum-v1";
const FRONTIER_ROLE: &str = "frontier";
const POOL_ROLE: &str = "parent-pool";
const SELECTED_STATUS: &str = "selected-for-parent-pool-recipe";
const REQUIRED_NEXT_GATE: &str = "sign-or-soup-candidate-then-standard-quality-pipeline";
const PPM_DENOMINATOR: u64 = 1_000_000;

struct EvolutionOperatorFamily {
    operator_kind: &'static str,
    command: &'static str,
    selection_rule: &'static str,
    output_gate: &'static str,
}

const EVOLUTION_OPERATOR_FAMILIES: [EvolutionOperatorFamily; 2] = [
    EvolutionOperatorFamily {
        operator_kind: "sign-aware-parent-pool-merge",
        command: "sign-merge-candidate",
        selection_rule: "seed-weighted-delta-sign-consensus",
        output_gate: "candidate-manifest-plus-runtime-smoke-plus-eval",
    },
    EvolutionOperatorFamily {
        operator_kind: "seed-weighted-parent-pool-soup",
        command: "soup-candidate",
        selection_rule: "seed-weighted-direct-parameter-average",
        output_gate: "candidate-manifest-plus-runtime-smoke-plus-eval",
    },
];

struct ParentEntry {
    rank: usize,
    review_index: usize,
    ledger_index: usize,
    role: &'static str,
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
    population_fitness_ppm: u64,
    next_route: String,
    seed_weight_ppm: u64,
}

struct ParentContract {
    model_shape: String,
    quantization: String,
    output_contract: String,
    tokenizer_checksum: String,
    tensor_layout_checksum: String,
}

/// Writes a deterministic parent-pool recipe from a population review.
pub(crate) fn write_recipe_path(
    ledger: &Path,
    review: &Path,
    output: &Path,
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_admissions(admission_paths, "parent-pool-recipe")?;
    let ledger_text = fs::read_to_string(ledger)?;
    let review_text = fs::read_to_string(review)?;
    let recipe = build_recipe_text(&ledger_text, &review_text, &admission_texts)?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, recipe)?;
    println!("SLM parent-pool recipe written: {}", output.display());
    Ok(())
}

/// Validates a parent-pool recipe against its review, ledger, and admission records.
pub(crate) fn validate_recipe_path(
    ledger: &Path,
    review: &Path,
    recipe: &Path,
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_admissions(admission_paths, "validate-parent-pool-recipe")?;
    let ledger_text = fs::read_to_string(ledger)?;
    let review_text = fs::read_to_string(review)?;
    let recipe_text = fs::read_to_string(recipe)?;
    validate_recipe_text(&ledger_text, &review_text, &recipe_text, &admission_texts)?;
    println!("SLM parent-pool recipe validation: PASS");
    println!("ledger: {}", ledger.display());
    println!("review: {}", review.display());
    println!("recipe: {}", recipe.display());
    println!("admissions: {}", admission_paths.len());
    Ok(())
}

fn read_admissions(admission_paths: &[String], command: &str) -> io::Result<Vec<String>> {
    if admission_paths.is_empty() {
        return Err(invalid(&format!(
            "{command} requires at least one admission record"
        )));
    }
    admission_paths
        .iter()
        .map(|path| fs::read_to_string(Path::new(path)))
        .collect()
}

/// Builds the replayable parent-pool recipe that downstream multi-parent operators consume.
pub(crate) fn build_recipe_text(
    ledger_text: &str,
    review_text: &str,
    admission_texts: &[String],
) -> io::Result<String> {
    population::validate_review_text(ledger_text, review_text, admission_texts)?;
    let ledger_fields = parse_manifest(ledger_text, "promotion ledger")?;
    let review_fields = parse_manifest(review_text, "population review")?;
    let parent_count = parse_usize(
        require_key(&review_fields, "reviewed_candidate_count")?,
        "reviewed_candidate_count",
    )?;
    let mut parents = parent_entries(&review_fields, &ledger_fields, parent_count)?;
    let contract = require_shared_contract(&parents)?;
    assign_seed_weights(&mut parents)?;
    let relatedness_pair_count = relatedness_pair_count(parents.len())?;
    let relatedness_contract_checksum = relatedness_contract_checksum(&contract, &parents);

    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_parent_pool_recipe_version",
        RECIPE_VERSION,
    );
    push_line(&mut text, "recipe_id", RECIPE_ID);
    push_line(&mut text, "recipe_scope", RECIPE_SCOPE);
    push_line(&mut text, "recipe_status", RECIPE_STATUS);
    push_line(&mut text, "recipe_basis", RECIPE_BASIS);
    push_line(&mut text, "recipe_kind", RECIPE_KIND);
    push_line(&mut text, "parent_selection", PARENT_SELECTION);
    push_line(&mut text, "seed_weight_formula", SEED_WEIGHT_FORMULA);
    push_line(&mut text, "parent_contract_status", PARENT_CONTRACT_STATUS);
    push_line(
        &mut text,
        "population_review_checksum",
        &hex64(provenance::text_checksum(review_text.as_bytes())),
    );
    push_line(
        &mut text,
        "promotion_ledger_checksum",
        require_key(&review_fields, "promotion_ledger_checksum")?,
    );
    push_line(
        &mut text,
        "admission_set_checksum",
        require_key(&review_fields, "admission_set_checksum")?,
    );
    push_line(
        &mut text,
        "frontier_candidate_id",
        require_key(&review_fields, "frontier_candidate_id")?,
    );
    push_line(
        &mut text,
        "frontier_candidate_slm_checksum",
        require_key(&review_fields, "frontier_candidate_slm_checksum")?,
    );
    push_line(&mut text, "parent_count", &parents.len().to_string());
    push_line(&mut text, "contract_model_shape", &contract.model_shape);
    push_line(&mut text, "contract_quantization", &contract.quantization);
    push_line(
        &mut text,
        "contract_output_contract",
        &contract.output_contract,
    );
    push_line(
        &mut text,
        "contract_tokenizer_checksum",
        &contract.tokenizer_checksum,
    );
    push_line(
        &mut text,
        "contract_tensor_layout_checksum",
        &contract.tensor_layout_checksum,
    );
    push_line(&mut text, "relatedness_metric", RELATEDNESS_METRIC);
    push_line(&mut text, "relatedness_scope", RELATEDNESS_SCOPE);
    push_line(
        &mut text,
        "relatedness_pair_count",
        &relatedness_pair_count.to_string(),
    );
    push_line(
        &mut text,
        "relatedness_all_pairs_status",
        RELATEDNESS_ALL_PAIRS_STATUS,
    );
    push_line(
        &mut text,
        "relatedness_contract_checksum",
        &relatedness_contract_checksum,
    );
    for (index, parent) in parents.iter().enumerate() {
        push_parent_lines(&mut text, index, parent, &relatedness_contract_checksum);
    }
    let evolution_schedule_text =
        build_evolution_schedule_text(&parents, &relatedness_contract_checksum);
    text.push_str(&evolution_schedule_text);
    push_line(
        &mut text,
        "evolution_schedule_checksum_algorithm",
        EVOLUTION_SCHEDULE_CHECKSUM_ALGORITHM,
    );
    push_line(
        &mut text,
        "evolution_schedule_checksum",
        &hex64(provenance::text_checksum(
            evolution_schedule_text.as_bytes(),
        )),
    );
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

pub(crate) fn validate_recipe_text(
    ledger_text: &str,
    review_text: &str,
    recipe_text: &str,
    admission_texts: &[String],
) -> io::Result<()> {
    let expected_text = build_recipe_text(ledger_text, review_text, admission_texts)?;
    let expected = parse_manifest(&expected_text, "expected parent-pool recipe")?;
    let actual = parse_manifest(recipe_text, "parent-pool recipe")?;
    require_equal(
        &actual,
        "tinyrustlm_parent_pool_recipe_version",
        RECIPE_VERSION,
    )?;
    require_equal(&actual, "recipe_id", RECIPE_ID)?;
    require_equal(&actual, "recipe_scope", RECIPE_SCOPE)?;
    require_equal(&actual, "recipe_status", RECIPE_STATUS)?;
    require_equal(&actual, "recipe_basis", RECIPE_BASIS)?;
    require_equal(&actual, "recipe_kind", RECIPE_KIND)?;
    require_equal(&actual, "required_next_gate", REQUIRED_NEXT_GATE)?;
    for (key, expected_value) in &expected {
        require_equal(&actual, key, expected_value)?;
    }
    for key in actual.keys() {
        if !expected.contains_key(key) {
            return Err(invalid(&format!("unexpected parent-pool recipe key {key}")));
        }
    }
    Ok(())
}

fn parent_entries(
    review_fields: &HashMap<String, String>,
    ledger_fields: &HashMap<String, String>,
    parent_count: usize,
) -> io::Result<Vec<ParentEntry>> {
    if parent_count == 0 {
        return Err(invalid("parent-pool recipe requires at least one parent"));
    }
    let mut parents = Vec::with_capacity(parent_count);
    for review_index in 0..parent_count {
        let rank = parse_usize(
            require_review_entry_key(review_fields, review_index, "rank")?,
            "parent rank",
        )?;
        if rank != review_index + 1 {
            return Err(invalid(&format!(
                "parent-pool recipe rank {} was {rank}",
                review_index + 1
            )));
        }
        let ledger_index = parse_source_ledger_entry(require_review_entry_key(
            review_fields,
            review_index,
            "source_ledger_entry",
        )?)?;
        let role = if review_index == 0 {
            FRONTIER_ROLE
        } else {
            POOL_ROLE
        };
        let candidate_id = review_entry_value(review_fields, review_index, "candidate_id")?;
        require_matching_ledger_value(ledger_fields, ledger_index, "candidate_id", &candidate_id)?;
        let candidate_slm_checksum =
            review_entry_value(review_fields, review_index, "candidate_slm_checksum")?;
        require_matching_ledger_value(
            ledger_fields,
            ledger_index,
            "candidate_slm_checksum",
            &candidate_slm_checksum,
        )?;
        let candidate_model_shape =
            review_entry_value(review_fields, review_index, "candidate_model_shape")?;
        require_matching_ledger_value(
            ledger_fields,
            ledger_index,
            "candidate_model_shape",
            &candidate_model_shape,
        )?;
        let candidate_quantization =
            review_entry_value(review_fields, review_index, "candidate_quantization")?;
        require_matching_ledger_value(
            ledger_fields,
            ledger_index,
            "candidate_quantization",
            &candidate_quantization,
        )?;
        let population_fitness_ppm = parse_u64(
            require_review_entry_key(review_fields, review_index, "population_fitness_ppm")?,
            "population_fitness_ppm",
        )?;
        parents.push(ParentEntry {
            rank,
            review_index,
            ledger_index,
            role,
            candidate_id,
            selector_id: review_entry_value(review_fields, review_index, "selector_id")?,
            operator_id: review_entry_value(review_fields, review_index, "operator_id")?,
            resource_budget: review_entry_value(review_fields, review_index, "resource_budget")?,
            candidate_artifact_path: review_entry_value(
                review_fields,
                review_index,
                "candidate_artifact_path",
            )?,
            candidate_artifact_bytes: review_entry_value(
                review_fields,
                review_index,
                "candidate_artifact_bytes",
            )?,
            candidate_slm_checksum,
            candidate_model_shape,
            candidate_quantization,
            candidate_output_contract: ledger_entry_value(
                ledger_fields,
                ledger_index,
                "candidate_output_contract",
            )?,
            candidate_tokenizer_checksum: ledger_entry_value(
                ledger_fields,
                ledger_index,
                "candidate_tokenizer_checksum",
            )?,
            candidate_tensor_layout_checksum: ledger_entry_value(
                ledger_fields,
                ledger_index,
                "candidate_tensor_layout_checksum",
            )?,
            population_fitness_ppm,
            next_route: review_entry_value(review_fields, review_index, "next_route")?,
            seed_weight_ppm: 0,
        });
    }
    Ok(parents)
}

fn require_shared_contract(parents: &[ParentEntry]) -> io::Result<ParentContract> {
    let first = parents
        .first()
        .ok_or_else(|| invalid("parent-pool recipe requires at least one parent"))?;
    for parent in parents.iter().skip(1) {
        if parent.candidate_model_shape != first.candidate_model_shape
            || parent.candidate_quantization != first.candidate_quantization
            || parent.candidate_output_contract != first.candidate_output_contract
            || parent.candidate_tokenizer_checksum != first.candidate_tokenizer_checksum
            || parent.candidate_tensor_layout_checksum != first.candidate_tensor_layout_checksum
        {
            return Err(invalid(
                "parent-pool recipe parents must share one direct-parameter contract",
            ));
        }
    }
    Ok(ParentContract {
        model_shape: first.candidate_model_shape.clone(),
        quantization: first.candidate_quantization.clone(),
        output_contract: first.candidate_output_contract.clone(),
        tokenizer_checksum: first.candidate_tokenizer_checksum.clone(),
        tensor_layout_checksum: first.candidate_tensor_layout_checksum.clone(),
    })
}

fn assign_seed_weights(parents: &mut [ParentEntry]) -> io::Result<()> {
    let total_fitness: u128 = parents
        .iter()
        .map(|parent| u128::from(parent.population_fitness_ppm))
        .sum();
    if total_fitness == 0 {
        return Err(invalid(
            "parent-pool recipe requires positive population fitness",
        ));
    }
    let mut assigned = 0u64;
    let last_index = parents.len() - 1;
    for (index, parent) in parents.iter_mut().enumerate() {
        if index == last_index {
            parent.seed_weight_ppm = PPM_DENOMINATOR
                .checked_sub(assigned)
                .ok_or_else(|| invalid("parent-pool seed weights exceeded 1000000 ppm"))?;
        } else {
            let weight = ((u128::from(parent.population_fitness_ppm)
                * u128::from(PPM_DENOMINATOR))
                / total_fitness)
                .try_into()
                .map_err(|_| invalid("parent-pool seed weight exceeded supported ppm range"))?;
            parent.seed_weight_ppm = weight;
            assigned = assigned
                .checked_add(weight)
                .ok_or_else(|| invalid("parent-pool seed weight overflow"))?;
        }
    }
    Ok(())
}

fn relatedness_pair_count(parent_count: usize) -> io::Result<u64> {
    let count = parent_count as u128;
    let pair_count = count
        .checked_mul(count.saturating_sub(1))
        .ok_or_else(|| invalid("parent-pool relatedness pair count overflow"))?
        / 2;
    pair_count
        .try_into()
        .map_err(|_| invalid("parent-pool relatedness pair count exceeded supported range"))
}

fn relatedness_contract_checksum(contract: &ParentContract, parents: &[ParentEntry]) -> String {
    let mut text = String::new();
    push_line(&mut text, "relatedness_metric", RELATEDNESS_METRIC);
    push_line(&mut text, "relatedness_scope", RELATEDNESS_SCOPE);
    push_line(&mut text, "parent_count", &parents.len().to_string());
    push_line(&mut text, "contract_model_shape", &contract.model_shape);
    push_line(&mut text, "contract_quantization", &contract.quantization);
    push_line(
        &mut text,
        "contract_output_contract",
        &contract.output_contract,
    );
    push_line(
        &mut text,
        "contract_tokenizer_checksum",
        &contract.tokenizer_checksum,
    );
    push_line(
        &mut text,
        "contract_tensor_layout_checksum",
        &contract.tensor_layout_checksum,
    );
    for (index, parent) in parents.iter().enumerate() {
        let prefix = format!("parent.{index}");
        push_line(
            &mut text,
            &format!("{prefix}.rank"),
            &parent.rank.to_string(),
        );
        push_line(&mut text, &format!("{prefix}.role"), parent.role);
        push_line(
            &mut text,
            &format!("{prefix}.candidate_id"),
            &parent.candidate_id,
        );
        push_line(
            &mut text,
            &format!("{prefix}.selector_id"),
            &parent.selector_id,
        );
        push_line(
            &mut text,
            &format!("{prefix}.operator_id"),
            &parent.operator_id,
        );
        push_line(
            &mut text,
            &format!("{prefix}.candidate_slm_checksum"),
            &parent.candidate_slm_checksum,
        );
    }
    hex64(provenance::text_checksum(text.as_bytes()))
}

fn push_parent_lines(
    text: &mut String,
    index: usize,
    parent: &ParentEntry,
    relatedness_contract_checksum: &str,
) {
    let prefix = format!("parent.{index}");
    push_line(text, &format!("{prefix}.rank"), &parent.rank.to_string());
    push_line(text, &format!("{prefix}.role"), parent.role);
    push_line(text, &format!("{prefix}.selection_status"), SELECTED_STATUS);
    push_line(
        text,
        &format!("{prefix}.source_review_entry"),
        &format!("entry.{}", parent.review_index),
    );
    push_line(
        text,
        &format!("{prefix}.source_ledger_entry"),
        &format!("entry.{}", parent.ledger_index),
    );
    push_line(
        text,
        &format!("{prefix}.candidate_id"),
        &parent.candidate_id,
    );
    push_line(text, &format!("{prefix}.selector_id"), &parent.selector_id);
    push_line(text, &format!("{prefix}.operator_id"), &parent.operator_id);
    push_line(
        text,
        &format!("{prefix}.resource_budget"),
        &parent.resource_budget,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_artifact_path"),
        &parent.candidate_artifact_path,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_artifact_bytes"),
        &parent.candidate_artifact_bytes,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_slm_checksum"),
        &parent.candidate_slm_checksum,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_model_shape"),
        &parent.candidate_model_shape,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_quantization"),
        &parent.candidate_quantization,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_output_contract"),
        &parent.candidate_output_contract,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_tokenizer_checksum"),
        &parent.candidate_tokenizer_checksum,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_tensor_layout_checksum"),
        &parent.candidate_tensor_layout_checksum,
    );
    push_line(
        text,
        &format!("{prefix}.relatedness_group"),
        RELATEDNESS_GROUP,
    );
    push_line(
        text,
        &format!("{prefix}.relatedness_contract_checksum"),
        relatedness_contract_checksum,
    );
    push_line(
        text,
        &format!("{prefix}.population_fitness_ppm"),
        &parent.population_fitness_ppm.to_string(),
    );
    push_line(
        text,
        &format!("{prefix}.seed_weight_ppm"),
        &parent.seed_weight_ppm.to_string(),
    );
    push_line(text, &format!("{prefix}.next_route"), &parent.next_route);
}

// Captures the planned multi-parent operator families and the seed weights they will replay.
fn build_evolution_schedule_text(
    parents: &[ParentEntry],
    relatedness_contract_checksum: &str,
) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "evolution_recipe_version",
        EVOLUTION_RECIPE_VERSION,
    );
    push_line(
        &mut text,
        "evolution_recipe_strategy",
        EVOLUTION_RECIPE_STRATEGY,
    );
    push_line(
        &mut text,
        "evolution_recipe_status",
        EVOLUTION_RECIPE_STATUS,
    );
    push_line(
        &mut text,
        "evolution_selection_source",
        EVOLUTION_SELECTION_SOURCE,
    );
    push_line(
        &mut text,
        "evolution_parent_count",
        &parents.len().to_string(),
    );
    push_line(
        &mut text,
        "evolution_relatedness_contract_checksum",
        relatedness_contract_checksum,
    );
    push_line(
        &mut text,
        "evolution_operator_family_count",
        &EVOLUTION_OPERATOR_FAMILIES.len().to_string(),
    );
    for (index, family) in EVOLUTION_OPERATOR_FAMILIES.iter().enumerate() {
        let prefix = format!("evolution_operator_family.{index}");
        push_line(
            &mut text,
            &format!("{prefix}.operator_kind"),
            family.operator_kind,
        );
        push_line(&mut text, &format!("{prefix}.command"), family.command);
        push_line(
            &mut text,
            &format!("{prefix}.selection_rule"),
            family.selection_rule,
        );
        push_line(
            &mut text,
            &format!("{prefix}.output_gate"),
            family.output_gate,
        );
    }
    for (index, parent) in parents.iter().enumerate() {
        let prefix = format!("evolution_parent.{index}");
        push_line(
            &mut text,
            &format!("{prefix}.candidate_id"),
            &parent.candidate_id,
        );
        push_line(
            &mut text,
            &format!("{prefix}.seed_weight_ppm"),
            &parent.seed_weight_ppm.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.population_fitness_ppm"),
            &parent.population_fitness_ppm.to_string(),
        );
    }
    text
}

fn require_matching_ledger_value(
    fields: &HashMap<String, String>,
    ledger_index: usize,
    key: &str,
    expected: &str,
) -> io::Result<()> {
    let actual = ledger_entry_value(fields, ledger_index, key)?;
    if actual != expected {
        return Err(invalid(&format!(
            "parent-pool recipe ledger entry {ledger_index} key {key} was {actual}, expected {expected}"
        )));
    }
    Ok(())
}

fn require_review_entry_key<'a>(
    fields: &'a HashMap<String, String>,
    entry_index: usize,
    key: &str,
) -> io::Result<&'a str> {
    require_key(fields, &format!("entry.{entry_index}.{key}"))
}

fn review_entry_value(
    fields: &HashMap<String, String>,
    entry_index: usize,
    key: &str,
) -> io::Result<String> {
    Ok(require_review_entry_key(fields, entry_index, key)?.to_string())
}

fn ledger_entry_value(
    fields: &HashMap<String, String>,
    entry_index: usize,
    key: &str,
) -> io::Result<String> {
    Ok(require_key(fields, &format!("entry.{entry_index}.{key}"))?.to_string())
}

fn parse_source_ledger_entry(value: &str) -> io::Result<usize> {
    let Some(index) = value.strip_prefix("entry.") else {
        return Err(invalid(
            "parent-pool source_ledger_entry must start with entry.",
        ));
    };
    parse_usize(index, "source_ledger_entry")
}

fn parse_usize(value: &str, label: &str) -> io::Result<usize> {
    value.parse::<usize>().map_err(|_| {
        invalid(&format!(
            "parent-pool recipe {label} must be an unsigned integer"
        ))
    })
}

fn parse_u64(value: &str, label: &str) -> io::Result<u64> {
    value.parse::<u64>().map_err(|_| {
        invalid(&format!(
            "parent-pool recipe {label} must be an unsigned integer"
        ))
    })
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
    use crate::promotion;
    use crate::slm_validate;
    use crate::tensor_writer::{
        tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_F32, DTYPE_Q8_0,
    };
    use crate::tokenizer_writer::ByteTokenizerSection;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn writes_ranked_parent_pool_recipe_from_population_review() {
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/parent-pool/tiny-alpha.slm",
            tiny_fixture_f32_bytes_with_offset(0.0),
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/parent-pool/tiny-beta.slm",
            tiny_fixture_f32_bytes_with_offset(0.002),
        );
        let ledger = ledger::build_ledger_text(&[beta.clone(), alpha.clone()]).unwrap();
        let review =
            population::build_review_text(&ledger, &[beta.clone(), alpha.clone()]).unwrap();

        let recipe = build_recipe_text(&ledger, &review, &[beta, alpha]).unwrap();

        assert!(recipe.contains("recipe_kind=sign-aware-parent-pool-v1"));
        assert!(recipe.contains("frontier_candidate_id=tiny-alpha-candidate"));
        assert!(recipe.contains("parent_count=2"));
        assert!(recipe.contains("relatedness_metric=shared-direct-parameter-contract-v1"));
        assert!(recipe.contains("relatedness_scope=selected-parent-pool"));
        assert!(recipe.contains("relatedness_pair_count=1"));
        assert!(recipe.contains("relatedness_all_pairs_status=shared-direct-parameter-contract"));
        assert!(recipe.contains("relatedness_contract_checksum=0x"));
        assert!(recipe.contains("parent.0.role=frontier"));
        assert!(recipe.contains("parent.1.role=parent-pool"));
        assert!(recipe.contains("parent.0.relatedness_group=direct-parameter-family.0"));
        assert!(recipe.contains("parent.1.relatedness_contract_checksum=0x"));
        assert!(recipe.contains("parent.0.seed_weight_ppm=500000"));
        assert!(recipe.contains("parent.1.seed_weight_ppm=500000"));
        assert!(recipe.contains("evolution_recipe_strategy=population-based-parent-pool-replay-v1"));
        assert!(recipe.contains("evolution_operator_family_count=2"));
        assert!(recipe
            .contains("evolution_operator_family.0.operator_kind=sign-aware-parent-pool-merge"));
        assert!(recipe.contains("evolution_operator_family.0.command=sign-merge-candidate"));
        assert!(recipe
            .contains("evolution_operator_family.1.operator_kind=seed-weighted-parent-pool-soup"));
        assert!(recipe.contains("evolution_operator_family.1.command=soup-candidate"));
        assert!(recipe.contains("evolution_parent.0.seed_weight_ppm=500000"));
        assert!(recipe.contains("evolution_parent.1.seed_weight_ppm=500000"));
        assert!(
            recipe.contains("evolution_schedule_checksum_algorithm=tinyrustlm-text-checksum-v1")
        );
        assert!(recipe.contains("evolution_schedule_checksum=0x"));
    }

    #[test]
    fn validates_parent_pool_recipe_text() {
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/parent-pool/validate-alpha.slm",
            tiny_fixture_f32_bytes_with_offset(0.0),
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/parent-pool/validate-beta.slm",
            tiny_fixture_f32_bytes_with_offset(0.003),
        );
        let ledger = ledger::build_ledger_text(&[alpha.clone(), beta.clone()]).unwrap();
        let review =
            population::build_review_text(&ledger, &[alpha.clone(), beta.clone()]).unwrap();
        let recipe = build_recipe_text(&ledger, &review, &[alpha.clone(), beta.clone()]).unwrap();

        validate_recipe_text(&ledger, &review, &recipe, &[alpha, beta]).unwrap();
    }

    #[test]
    fn rejects_parent_pool_recipe_drift() {
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/parent-pool/drift-alpha.slm",
            tiny_fixture_f32_bytes_with_offset(0.0),
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/parent-pool/drift-beta.slm",
            tiny_fixture_f32_bytes_with_offset(0.004),
        );
        let ledger = ledger::build_ledger_text(&[alpha.clone(), beta.clone()]).unwrap();
        let review =
            population::build_review_text(&ledger, &[alpha.clone(), beta.clone()]).unwrap();
        let recipe = build_recipe_text(&ledger, &review, &[alpha.clone(), beta.clone()])
            .unwrap()
            .replace(
                "frontier_candidate_id=tiny-alpha-candidate",
                "frontier_candidate_id=tiny-beta-candidate",
            );

        let error = validate_recipe_text(&ledger, &review, &recipe, &[alpha, beta]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("frontier_candidate_id"));
    }

    #[test]
    fn rejects_relatedness_checksum_drift() {
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/parent-pool/relatedness-alpha.slm",
            tiny_fixture_f32_bytes_with_offset(0.0),
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/parent-pool/relatedness-beta.slm",
            tiny_fixture_f32_bytes_with_offset(0.0045),
        );
        let ledger = ledger::build_ledger_text(&[alpha.clone(), beta.clone()]).unwrap();
        let review =
            population::build_review_text(&ledger, &[alpha.clone(), beta.clone()]).unwrap();
        let recipe = build_recipe_text(&ledger, &review, &[alpha.clone(), beta.clone()]).unwrap();
        let fields = parse_manifest(&recipe, "parent-pool recipe").unwrap();
        let checksum = require_key(&fields, "relatedness_contract_checksum").unwrap();
        let tampered_recipe = recipe.replace(
            &format!("relatedness_contract_checksum={checksum}"),
            "relatedness_contract_checksum=0x0000000000000000",
        );

        let error =
            validate_recipe_text(&ledger, &review, &tampered_recipe, &[alpha, beta]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("relatedness_contract_checksum"));
    }

    #[test]
    fn rejects_evolution_schedule_checksum_drift() {
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/parent-pool/evolution-alpha.slm",
            tiny_fixture_f32_bytes_with_offset(0.0),
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/parent-pool/evolution-beta.slm",
            tiny_fixture_f32_bytes_with_offset(0.0048),
        );
        let ledger = ledger::build_ledger_text(&[alpha.clone(), beta.clone()]).unwrap();
        let review =
            population::build_review_text(&ledger, &[alpha.clone(), beta.clone()]).unwrap();
        let recipe = build_recipe_text(&ledger, &review, &[alpha.clone(), beta.clone()]).unwrap();
        let fields = parse_manifest(&recipe, "parent-pool recipe").unwrap();
        let checksum = require_key(&fields, "evolution_schedule_checksum").unwrap();
        let tampered_recipe = recipe.replace(
            &format!("evolution_schedule_checksum={checksum}"),
            "evolution_schedule_checksum=0x0000000000000000",
        );

        let error =
            validate_recipe_text(&ledger, &review, &tampered_recipe, &[alpha, beta]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("evolution_schedule_checksum"));
    }

    #[test]
    fn rejects_population_review_drift_before_recipe() {
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/parent-pool/review-drift-alpha.slm",
            tiny_fixture_f32_bytes_with_offset(0.0),
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/parent-pool/review-drift-beta.slm",
            tiny_fixture_f32_bytes_with_offset(0.005),
        );
        let ledger = ledger::build_ledger_text(&[alpha.clone(), beta.clone()]).unwrap();
        let review = population::build_review_text(&ledger, &[alpha.clone(), beta.clone()])
            .unwrap()
            .replace(
                "entry.0.population_fitness_ppm=970000",
                "entry.0.population_fitness_ppm=1",
            );

        let error = build_recipe_text(&ledger, &review, &[alpha, beta]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn rejects_mixed_direct_parameter_contracts() {
        let f32 = fixture_admission(
            "tiny-f32-candidate",
            "target/parent-pool/mixed-f32.slm",
            tiny_fixture_f32_bytes_with_offset(0.0),
        );
        let q8 = fixture_admission(
            "tiny-q8-candidate",
            "target/parent-pool/mixed-q8.slm",
            tiny_fixture_q8_bytes(),
        );
        let ledger = ledger::build_ledger_text(&[f32.clone(), q8.clone()]).unwrap();
        let review = population::build_review_text(&ledger, &[f32.clone(), q8.clone()]).unwrap();

        let error = build_recipe_text(&ledger, &review, &[f32, q8]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("direct-parameter contract"));
    }

    #[test]
    fn writes_and_validates_parent_pool_recipe_paths() {
        let dir = unique_dir("paths");
        std::fs::create_dir_all(&dir).unwrap();
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/parent-pool/path-alpha.slm",
            tiny_fixture_f32_bytes_with_offset(0.0),
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/parent-pool/path-beta.slm",
            tiny_fixture_f32_bytes_with_offset(0.006),
        );
        let alpha_path = dir.join("alpha.admission");
        let beta_path = dir.join("beta.admission");
        let ledger_path = dir.join("pool.ledger");
        let review_path = dir.join("pool.review");
        let recipe_path = dir.join("pool.recipe");
        std::fs::write(&alpha_path, alpha).unwrap();
        std::fs::write(&beta_path, beta).unwrap();
        let admissions = vec![
            alpha_path.to_string_lossy().to_string(),
            beta_path.to_string_lossy().to_string(),
        ];

        ledger::write_ledger_path(&ledger_path, &admissions).unwrap();
        population::write_review_path(&ledger_path, &review_path, &admissions).unwrap();
        write_recipe_path(&ledger_path, &review_path, &recipe_path, &admissions).unwrap();
        validate_recipe_path(&ledger_path, &review_path, &recipe_path, &admissions).unwrap();

        let recipe = std::fs::read_to_string(recipe_path).unwrap();
        assert!(recipe.contains("recipe_status=population-reviewed"));
        assert!(recipe.contains("parent_contract_status=shared-direct-parameter-contract"));
    }

    fn fixture_admission(candidate_id: &str, candidate_path: &str, candidate: Vec<u8>) -> String {
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
        let eval = passing_eval_text(&report, &provenance_manifest);
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

    fn tiny_fixture_q8_bytes() -> Vec<u8> {
        let tensors = tiny_fixture_tensors_with_dtype(DTYPE_Q8_0);
        let values: Vec<Vec<f32>> = tensors
            .iter()
            .map(|tensor| {
                (0..tensor.element_count())
                    .map(|elem| fixture_value(tensor, elem))
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
        std::path::Path::new("target")
            .join("parent-pool-tests")
            .join(format!("{label}-{}-{nanos}", std::process::id()))
    }
}
