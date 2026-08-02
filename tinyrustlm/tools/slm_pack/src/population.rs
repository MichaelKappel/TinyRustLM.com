//! Offline population reviews for admitted model-breeding candidates.

use std::cmp::Ordering;
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::blend::{hex64, invalid, parse_manifest, push_line, require_equal, require_key};
use crate::ledger;
use crate::provenance;

const REVIEW_VERSION: &str = "1";
const REVIEW_ID: &str = "browser-local-population-review";
const REVIEW_SCOPE: &str = "offline-model-breeding-population-review";
const REVIEW_STATUS: &str = "ledger-reviewed";
const REVIEW_BASIS: &str = "promotion-ledger-plus-admission-records";
const RANKING_FORMULA: &str = "quality700-frugality200-quantization100";
const RANKING_TIE_BREAK: &str = "fitness-desc-cases-passed-desc-model-bytes-asc-candidate-id-asc";
const FITNESS_OBJECTIVE_VECTOR_VERSION: &str = "1";
const FITNESS_OBJECTIVE_VECTOR_KIND: &str = "weighted-quality-frugality-quantization-v1";
const FITNESS_OBJECTIVE_WEIGHT_UNIT: &str = "ppm";
const FRONTIER_DECISION: &str = "frontier-candidate";
const POOL_DECISION: &str = "candidate-kept-for-population";
const FRONTIER_ROUTE: &str = "selector-registry";
const POOL_ROUTE: &str = "population-parent-pool";
const REQUIRED_NEXT_GATE: &str = "selector-registry-or-parent-selection";
const PPM_DENOMINATOR: u64 = 1_000_000;
const QUALITY_WEIGHT: u64 = 700;
const FRUGALITY_WEIGHT: u64 = 200;
const QUANTIZATION_WEIGHT: u64 = 100;
const WEIGHT_DENOMINATOR: u64 = 1_000;
const QUALITY_WEIGHT_PPM: u64 = (QUALITY_WEIGHT * PPM_DENOMINATOR) / WEIGHT_DENOMINATOR;
const FRUGALITY_WEIGHT_PPM: u64 = (FRUGALITY_WEIGHT * PPM_DENOMINATOR) / WEIGHT_DENOMINATOR;
const QUANTIZATION_WEIGHT_PPM: u64 = (QUANTIZATION_WEIGHT * PPM_DENOMINATOR) / WEIGHT_DENOMINATOR;

struct FitnessObjective {
    name: &'static str,
    source: &'static str,
    weight_ppm: u64,
}

const FITNESS_OBJECTIVES: [FitnessObjective; 3] = [
    FitnessObjective {
        name: "quality",
        source: "cases-passed-over-case-count",
        weight_ppm: QUALITY_WEIGHT_PPM,
    },
    FitnessObjective {
        name: "frugality",
        source: "minimum-artifact-bytes-over-candidate-artifact-bytes",
        weight_ppm: FRUGALITY_WEIGHT_PPM,
    },
    FitnessObjective {
        name: "quantization_fit",
        source: "quantization-label-fit",
        weight_ppm: QUANTIZATION_WEIGHT_PPM,
    },
];

struct LedgerEntry {
    ledger_index: usize,
    candidate_id: String,
    selector_id: String,
    operator_id: String,
    operator_lane: String,
    resource_budget: String,
    candidate_artifact_path: String,
    candidate_artifact_bytes: u64,
    candidate_slm_checksum: String,
    candidate_model_shape: String,
    candidate_quantization: String,
    quality_scope: String,
    eval_dataset: String,
    case_count: u64,
    cases_passed: u64,
}

struct RankedEntry {
    entry: LedgerEntry,
    quality_ppm: u64,
    frugality_ppm: u64,
    quantization_fit_ppm: u64,
    population_fitness_ppm: u64,
}

/// Writes a deterministic population review from a promotion ledger and admissions.
pub(crate) fn write_review_path(
    ledger: &Path,
    output: &Path,
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_admissions(admission_paths, "population-review")?;
    let ledger_text = fs::read_to_string(ledger)?;
    let review = build_review_text(&ledger_text, &admission_texts)?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, review)?;
    println!("SLM population review written: {}", output.display());
    Ok(())
}

/// Validates a population review against its ledger and admission records.
pub(crate) fn validate_review_path(
    ledger: &Path,
    review: &Path,
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_admissions(admission_paths, "validate-population-review")?;
    let ledger_text = fs::read_to_string(ledger)?;
    let review_text = fs::read_to_string(review)?;
    validate_review_text(&ledger_text, &review_text, &admission_texts)?;
    println!("SLM population review validation: PASS");
    println!("ledger: {}", ledger.display());
    println!("review: {}", review.display());
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

pub(crate) fn build_review_text(
    ledger_text: &str,
    admission_texts: &[String],
) -> io::Result<String> {
    ledger::validate_ledger_text(ledger_text, admission_texts)?;
    let ledger_fields = parse_manifest(ledger_text, "promotion ledger")?;
    let entry_count = parse_usize(require_key(&ledger_fields, "entry_count")?, "entry_count")?;
    let entries = ledger_entries(&ledger_fields, entry_count)?;
    let min_bytes = entries
        .iter()
        .map(|entry| entry.candidate_artifact_bytes)
        .min()
        .ok_or_else(|| invalid("population review requires at least one ledger entry"))?;
    let mut ranked = entries
        .into_iter()
        .map(|entry| rank_entry(entry, min_bytes))
        .collect::<io::Result<Vec<_>>>()?;
    ranked.sort_by(compare_ranked_entries);
    let frontier = ranked
        .first()
        .ok_or_else(|| invalid("population review requires at least one ranked entry"))?;

    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_population_review_version",
        REVIEW_VERSION,
    );
    push_line(&mut text, "review_id", REVIEW_ID);
    push_line(&mut text, "review_scope", REVIEW_SCOPE);
    push_line(&mut text, "review_status", REVIEW_STATUS);
    push_line(&mut text, "review_basis", REVIEW_BASIS);
    push_line(
        &mut text,
        "promotion_ledger_checksum",
        &hex64(provenance::text_checksum(ledger_text.as_bytes())),
    );
    push_line(
        &mut text,
        "ledger_scope",
        require_key(&ledger_fields, "ledger_scope")?,
    );
    push_line(
        &mut text,
        "ledger_status",
        require_key(&ledger_fields, "ledger_status")?,
    );
    push_line(&mut text, "ledger_entry_count", &entry_count.to_string());
    push_line(
        &mut text,
        "admission_set_checksum",
        require_key(&ledger_fields, "admission_set_checksum")?,
    );
    push_line(
        &mut text,
        "ledger_chain_checksum",
        require_key(&ledger_fields, "ledger_chain_checksum")?,
    );
    push_line(&mut text, "ranking_formula", RANKING_FORMULA);
    push_line(&mut text, "ranking_tie_break", RANKING_TIE_BREAK);
    text.push_str(&fitness_objective_vector_contract_text());
    push_line(
        &mut text,
        "fitness_objective_vector_checksum",
        &fitness_objective_vector_checksum(),
    );
    push_line(
        &mut text,
        "reviewed_candidate_count",
        &ranked.len().to_string(),
    );
    push_line(
        &mut text,
        "frontier_candidate_id",
        &frontier.entry.candidate_id,
    );
    push_line(
        &mut text,
        "frontier_candidate_slm_checksum",
        &frontier.entry.candidate_slm_checksum,
    );
    push_line(
        &mut text,
        "frontier_population_fitness_ppm",
        &frontier.population_fitness_ppm.to_string(),
    );
    for (rank_index, ranked_entry) in ranked.iter().enumerate() {
        push_ranked_entry(&mut text, rank_index, ranked_entry);
    }
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

pub(crate) fn validate_review_text(
    ledger_text: &str,
    review_text: &str,
    admission_texts: &[String],
) -> io::Result<()> {
    let expected_text = build_review_text(ledger_text, admission_texts)?;
    let expected = parse_manifest(&expected_text, "expected population review")?;
    let actual = parse_manifest(review_text, "population review")?;
    require_equal(
        &actual,
        "tinyrustlm_population_review_version",
        REVIEW_VERSION,
    )?;
    require_equal(&actual, "review_id", REVIEW_ID)?;
    require_equal(&actual, "review_scope", REVIEW_SCOPE)?;
    require_equal(&actual, "review_status", REVIEW_STATUS)?;
    require_equal(&actual, "review_basis", REVIEW_BASIS)?;
    require_equal(&actual, "required_next_gate", REQUIRED_NEXT_GATE)?;
    for (key, expected_value) in &expected {
        require_equal(&actual, key, expected_value)?;
    }
    for key in actual.keys() {
        if !expected.contains_key(key) {
            return Err(invalid(&format!("unexpected population review key {key}")));
        }
    }
    Ok(())
}

fn ledger_entries(
    ledger_fields: &HashMap<String, String>,
    entry_count: usize,
) -> io::Result<Vec<LedgerEntry>> {
    if entry_count == 0 {
        return Err(invalid(
            "population review requires at least one ledger entry",
        ));
    }
    let mut entries = Vec::with_capacity(entry_count);
    for ledger_index in 0..entry_count {
        let sequence = parse_usize(
            require_entry_key(ledger_fields, ledger_index, "sequence")?,
            "ledger entry sequence",
        )?;
        if sequence != ledger_index {
            return Err(invalid(&format!(
                "population review ledger entry {ledger_index} sequence was {sequence}"
            )));
        }
        let candidate_artifact_bytes = parse_positive_u64(
            require_entry_key(ledger_fields, ledger_index, "candidate_artifact_bytes")?,
            "candidate_artifact_bytes",
        )?;
        let case_count = parse_positive_u64(
            require_entry_key(ledger_fields, ledger_index, "case_count")?,
            "case_count",
        )?;
        let cases_passed = parse_u64(
            require_entry_key(ledger_fields, ledger_index, "cases_passed")?,
            "cases_passed",
        )?;
        if cases_passed > case_count {
            return Err(invalid(
                "population review cases_passed cannot exceed case_count",
            ));
        }
        entries.push(LedgerEntry {
            ledger_index,
            candidate_id: entry_value(ledger_fields, ledger_index, "candidate_id")?,
            selector_id: entry_value(ledger_fields, ledger_index, "selector_id")?,
            operator_id: entry_value(ledger_fields, ledger_index, "operator_id")?,
            operator_lane: entry_value(ledger_fields, ledger_index, "operator_lane")?,
            resource_budget: entry_value(ledger_fields, ledger_index, "resource_budget")?,
            candidate_artifact_path: entry_value(
                ledger_fields,
                ledger_index,
                "candidate_artifact_path",
            )?,
            candidate_artifact_bytes,
            candidate_slm_checksum: entry_value(
                ledger_fields,
                ledger_index,
                "candidate_slm_checksum",
            )?,
            candidate_model_shape: entry_value(
                ledger_fields,
                ledger_index,
                "candidate_model_shape",
            )?,
            candidate_quantization: entry_value(
                ledger_fields,
                ledger_index,
                "candidate_quantization",
            )?,
            quality_scope: entry_value(ledger_fields, ledger_index, "quality_scope")?,
            eval_dataset: entry_value(ledger_fields, ledger_index, "eval_dataset")?,
            case_count,
            cases_passed,
        });
    }
    Ok(entries)
}

fn rank_entry(entry: LedgerEntry, min_bytes: u64) -> io::Result<RankedEntry> {
    let quality_ppm = ppm_ratio(entry.cases_passed, entry.case_count, "quality")?;
    let frugality_ppm = ppm_ratio(min_bytes, entry.candidate_artifact_bytes, "frugality")?;
    let quantization_fit_ppm = quantization_fit_ppm(&entry.candidate_quantization);
    let weighted_sum = u128::from(quality_ppm) * u128::from(QUALITY_WEIGHT)
        + u128::from(frugality_ppm) * u128::from(FRUGALITY_WEIGHT)
        + u128::from(quantization_fit_ppm) * u128::from(QUANTIZATION_WEIGHT);
    let population_fitness_ppm = (weighted_sum / u128::from(WEIGHT_DENOMINATOR))
        .try_into()
        .map_err(|_| invalid("population review fitness score exceeded supported ppm range"))?;
    Ok(RankedEntry {
        entry,
        quality_ppm,
        frugality_ppm,
        quantization_fit_ppm,
        population_fitness_ppm,
    })
}

fn compare_ranked_entries(left: &RankedEntry, right: &RankedEntry) -> Ordering {
    right
        .population_fitness_ppm
        .cmp(&left.population_fitness_ppm)
        .then_with(|| right.entry.cases_passed.cmp(&left.entry.cases_passed))
        .then_with(|| {
            left.entry
                .candidate_artifact_bytes
                .cmp(&right.entry.candidate_artifact_bytes)
        })
        .then_with(|| left.entry.candidate_id.cmp(&right.entry.candidate_id))
}

fn push_ranked_entry(text: &mut String, rank_index: usize, ranked_entry: &RankedEntry) {
    let prefix = format!("entry.{rank_index}");
    let rank = (rank_index + 1).to_string();
    let source_entry = format!("entry.{}", ranked_entry.entry.ledger_index);
    let candidate_artifact_bytes = ranked_entry.entry.candidate_artifact_bytes.to_string();
    let case_count = ranked_entry.entry.case_count.to_string();
    let cases_passed = ranked_entry.entry.cases_passed.to_string();
    let quality_ppm = ranked_entry.quality_ppm.to_string();
    let frugality_ppm = ranked_entry.frugality_ppm.to_string();
    let quantization_fit_ppm = ranked_entry.quantization_fit_ppm.to_string();
    let population_fitness_ppm = ranked_entry.population_fitness_ppm.to_string();
    let fitness_objective_vector_checksum =
        ranked_entry_fitness_objective_vector_checksum(rank_index, ranked_entry);
    let decision = if rank_index == 0 {
        FRONTIER_DECISION
    } else {
        POOL_DECISION
    };
    let next_route = if rank_index == 0 {
        FRONTIER_ROUTE
    } else {
        POOL_ROUTE
    };

    push_line(text, &format!("{prefix}.rank"), &rank);
    push_line(
        text,
        &format!("{prefix}.source_ledger_entry"),
        &source_entry,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_id"),
        &ranked_entry.entry.candidate_id,
    );
    push_line(
        text,
        &format!("{prefix}.selector_id"),
        &ranked_entry.entry.selector_id,
    );
    push_line(
        text,
        &format!("{prefix}.operator_id"),
        &ranked_entry.entry.operator_id,
    );
    push_line(
        text,
        &format!("{prefix}.operator_lane"),
        &ranked_entry.entry.operator_lane,
    );
    push_line(
        text,
        &format!("{prefix}.resource_budget"),
        &ranked_entry.entry.resource_budget,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_artifact_path"),
        &ranked_entry.entry.candidate_artifact_path,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_artifact_bytes"),
        &candidate_artifact_bytes,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_slm_checksum"),
        &ranked_entry.entry.candidate_slm_checksum,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_model_shape"),
        &ranked_entry.entry.candidate_model_shape,
    );
    push_line(
        text,
        &format!("{prefix}.candidate_quantization"),
        &ranked_entry.entry.candidate_quantization,
    );
    push_line(
        text,
        &format!("{prefix}.quality_scope"),
        &ranked_entry.entry.quality_scope,
    );
    push_line(
        text,
        &format!("{prefix}.eval_dataset"),
        &ranked_entry.entry.eval_dataset,
    );
    push_line(text, &format!("{prefix}.case_count"), &case_count);
    push_line(text, &format!("{prefix}.cases_passed"), &cases_passed);
    push_line(text, &format!("{prefix}.quality_ppm"), &quality_ppm);
    push_line(text, &format!("{prefix}.frugality_ppm"), &frugality_ppm);
    push_line(
        text,
        &format!("{prefix}.quantization_fit_ppm"),
        &quantization_fit_ppm,
    );
    push_line(
        text,
        &format!("{prefix}.population_fitness_ppm"),
        &population_fitness_ppm,
    );
    push_line(
        text,
        &format!("{prefix}.fitness_objective_vector_checksum"),
        &fitness_objective_vector_checksum,
    );
    push_line(text, &format!("{prefix}.review_decision"), decision);
    push_line(text, &format!("{prefix}.next_route"), next_route);
}

fn fitness_objective_vector_contract_text() -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "fitness_objective_vector_version",
        FITNESS_OBJECTIVE_VECTOR_VERSION,
    );
    push_line(
        &mut text,
        "fitness_objective_vector_kind",
        FITNESS_OBJECTIVE_VECTOR_KIND,
    );
    push_line(
        &mut text,
        "fitness_objective_weight_unit",
        FITNESS_OBJECTIVE_WEIGHT_UNIT,
    );
    push_line(
        &mut text,
        "fitness_objective_weight_sum_ppm",
        &fitness_objective_weight_sum_ppm().to_string(),
    );
    push_line(
        &mut text,
        "fitness_objective_count",
        &FITNESS_OBJECTIVES.len().to_string(),
    );
    for (index, objective) in FITNESS_OBJECTIVES.iter().enumerate() {
        let prefix = format!("fitness_objective.{index}");
        push_line(&mut text, &format!("{prefix}.name"), objective.name);
        push_line(&mut text, &format!("{prefix}.source"), objective.source);
        push_line(
            &mut text,
            &format!("{prefix}.weight_ppm"),
            &objective.weight_ppm.to_string(),
        );
    }
    text
}

fn fitness_objective_vector_checksum() -> String {
    let contract = fitness_objective_vector_contract_text();
    hex64(provenance::text_checksum(contract.as_bytes()))
}

fn ranked_entry_fitness_objective_vector_checksum(
    rank_index: usize,
    ranked_entry: &RankedEntry,
) -> String {
    let mut text = fitness_objective_vector_contract_text();
    push_line(
        &mut text,
        "fitness_objective_vector_checksum",
        &fitness_objective_vector_checksum(),
    );
    push_line(&mut text, "entry.rank", &(rank_index + 1).to_string());
    push_line(
        &mut text,
        "entry.source_ledger_entry",
        &format!("entry.{}", ranked_entry.entry.ledger_index),
    );
    push_line(
        &mut text,
        "entry.candidate_id",
        &ranked_entry.entry.candidate_id,
    );
    push_line(
        &mut text,
        "entry.candidate_slm_checksum",
        &ranked_entry.entry.candidate_slm_checksum,
    );
    push_line(
        &mut text,
        "entry.quality_ppm",
        &ranked_entry.quality_ppm.to_string(),
    );
    push_line(
        &mut text,
        "entry.frugality_ppm",
        &ranked_entry.frugality_ppm.to_string(),
    );
    push_line(
        &mut text,
        "entry.quantization_fit_ppm",
        &ranked_entry.quantization_fit_ppm.to_string(),
    );
    push_line(
        &mut text,
        "entry.population_fitness_ppm",
        &ranked_entry.population_fitness_ppm.to_string(),
    );
    hex64(provenance::text_checksum(text.as_bytes()))
}

fn fitness_objective_weight_sum_ppm() -> u64 {
    FITNESS_OBJECTIVES
        .iter()
        .map(|objective| objective.weight_ppm)
        .sum()
}

fn require_entry_key<'a>(
    fields: &'a HashMap<String, String>,
    entry_index: usize,
    key: &str,
) -> io::Result<&'a str> {
    require_key(fields, &format!("entry.{entry_index}.{key}"))
}

fn entry_value(
    fields: &HashMap<String, String>,
    entry_index: usize,
    key: &str,
) -> io::Result<String> {
    Ok(require_entry_key(fields, entry_index, key)?.to_string())
}

fn quantization_fit_ppm(quantization: &str) -> u64 {
    match quantization {
        "q4_0" => PPM_DENOMINATOR,
        "q8_0" => 850_000,
        "f32" => 700_000,
        _ => 500_000,
    }
}

fn ppm_ratio(numerator: u64, denominator: u64, label: &str) -> io::Result<u64> {
    if denominator == 0 {
        return Err(invalid(&format!(
            "population review {label} denominator must be positive"
        )));
    }
    ((u128::from(numerator) * u128::from(PPM_DENOMINATOR)) / u128::from(denominator))
        .try_into()
        .map_err(|_| invalid("population review ppm value exceeded supported range"))
}

fn parse_positive_u64(value: &str, label: &str) -> io::Result<u64> {
    let parsed = parse_u64(value, label)?;
    if parsed == 0 {
        return Err(invalid(&format!(
            "population review {label} must be positive"
        )));
    }
    Ok(parsed)
}

fn parse_u64(value: &str, label: &str) -> io::Result<u64> {
    value.parse::<u64>().map_err(|_| {
        invalid(&format!(
            "population review {label} must be an unsigned integer"
        ))
    })
}

fn parse_usize(value: &str, label: &str) -> io::Result<usize> {
    value.parse::<usize>().map_err(|_| {
        invalid(&format!(
            "population review {label} must be an unsigned integer"
        ))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::admission;
    use crate::build_model_file;
    use crate::candidate;
    use crate::compatibility;
    use crate::lineage;
    use crate::promotion;
    use crate::slm_validate;
    use crate::tensor_writer::{
        tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_F32, DTYPE_Q8_0,
    };
    use crate::tokenizer_writer::ByteTokenizerSection;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn ranks_quantized_candidate_as_frontier() {
        let q8 = fixture_admission(
            "tiny-q8-candidate",
            "target/population-review/tiny-q8.slm",
            DTYPE_Q8_0,
        );
        let f32 = fixture_admission(
            "tiny-f32-candidate",
            "target/population-review/tiny-f32.slm",
            DTYPE_F32,
        );
        let ledger = ledger::build_ledger_text(&[f32.clone(), q8.clone()]).unwrap();

        let review = build_review_text(&ledger, &[f32, q8]).unwrap();

        assert!(review.contains("frontier_candidate_id=tiny-q8-candidate"));
        assert!(review
            .contains("fitness_objective_vector_kind=weighted-quality-frugality-quantization-v1"));
        assert!(review.contains("fitness_objective_weight_sum_ppm=1000000"));
        assert!(review.contains("fitness_objective.0.weight_ppm=700000"));
        assert!(review.contains("entry.0.candidate_id=tiny-q8-candidate"));
        assert!(review.contains("entry.0.fitness_objective_vector_checksum=0x"));
        assert!(review.contains("entry.0.review_decision=frontier-candidate"));
        assert!(review.contains("entry.0.next_route=selector-registry"));
        assert!(review.contains("entry.1.review_decision=candidate-kept-for-population"));
        assert!(review.contains("entry.1.next_route=population-parent-pool"));
    }

    #[test]
    fn validates_population_review_text() {
        let q8 = fixture_admission(
            "tiny-q8-candidate",
            "target/population-review/validate-q8.slm",
            DTYPE_Q8_0,
        );
        let f32 = fixture_admission(
            "tiny-f32-candidate",
            "target/population-review/validate-f32.slm",
            DTYPE_F32,
        );
        let ledger = ledger::build_ledger_text(&[q8.clone(), f32.clone()]).unwrap();
        let review = build_review_text(&ledger, &[q8.clone(), f32.clone()]).unwrap();

        validate_review_text(&ledger, &review, &[q8, f32]).unwrap();
    }

    #[test]
    fn rejects_population_review_drift() {
        let q8 = fixture_admission(
            "tiny-q8-candidate",
            "target/population-review/drift-q8.slm",
            DTYPE_Q8_0,
        );
        let f32 = fixture_admission(
            "tiny-f32-candidate",
            "target/population-review/drift-f32.slm",
            DTYPE_F32,
        );
        let ledger = ledger::build_ledger_text(&[q8.clone(), f32.clone()]).unwrap();
        let review = build_review_text(&ledger, &[q8.clone(), f32.clone()])
            .unwrap()
            .replace(
                "frontier_candidate_id=tiny-q8-candidate",
                "frontier_candidate_id=tiny-f32-candidate",
            );

        let error = validate_review_text(&ledger, &review, &[q8, f32]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("frontier_candidate_id"));
    }

    #[test]
    fn rejects_objective_vector_checksum_drift() {
        let q8 = fixture_admission(
            "tiny-q8-candidate",
            "target/population-review/objective-drift-q8.slm",
            DTYPE_Q8_0,
        );
        let f32 = fixture_admission(
            "tiny-f32-candidate",
            "target/population-review/objective-drift-f32.slm",
            DTYPE_F32,
        );
        let ledger = ledger::build_ledger_text(&[q8.clone(), f32.clone()]).unwrap();
        let review = build_review_text(&ledger, &[q8.clone(), f32.clone()])
            .unwrap()
            .replace(
                "fitness_objective.0.weight_ppm=700000",
                "fitness_objective.0.weight_ppm=1",
            );

        let error = validate_review_text(&ledger, &review, &[q8, f32]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("fitness_objective.0.weight_ppm"));
    }

    #[test]
    fn rejects_population_review_when_ledger_drifted() {
        let q8 = fixture_admission(
            "tiny-q8-candidate",
            "target/population-review/ledger-drift-q8.slm",
            DTYPE_Q8_0,
        );
        let f32 = fixture_admission(
            "tiny-f32-candidate",
            "target/population-review/ledger-drift-f32.slm",
            DTYPE_F32,
        );
        let ledger = ledger::build_ledger_text(&[q8.clone(), f32.clone()])
            .unwrap()
            .replace("entry.0.sequence=0", "entry.0.sequence=9");

        let error = build_review_text(&ledger, &[q8, f32]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("sequence"));
    }

    #[test]
    fn writes_and_validates_population_review_paths() {
        let dir = unique_dir("paths");
        std::fs::create_dir_all(&dir).unwrap();
        let q8 = fixture_admission(
            "tiny-q8-candidate",
            "target/population-review/path-q8.slm",
            DTYPE_Q8_0,
        );
        let f32 = fixture_admission(
            "tiny-f32-candidate",
            "target/population-review/path-f32.slm",
            DTYPE_F32,
        );
        let q8_path = dir.join("q8.admission");
        let f32_path = dir.join("f32.admission");
        let ledger_path = dir.join("population.ledger");
        let review_path = dir.join("population.review");
        std::fs::write(&q8_path, q8).unwrap();
        std::fs::write(&f32_path, f32).unwrap();
        let admissions = vec![
            q8_path.to_string_lossy().to_string(),
            f32_path.to_string_lossy().to_string(),
        ];

        ledger::write_ledger_path(&ledger_path, &admissions).unwrap();
        write_review_path(&ledger_path, &review_path, &admissions).unwrap();
        validate_review_path(&ledger_path, &review_path, &admissions).unwrap();

        let review = std::fs::read_to_string(review_path).unwrap();
        assert!(review.contains("review_status=ledger-reviewed"));
        assert!(review.contains("frontier_candidate_id=tiny-q8-candidate"));
    }

    #[test]
    fn rejects_empty_review_inputs() {
        let error = build_review_text("", &[]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("promotion ledger requires at least one admission record"));
    }

    fn fixture_admission(candidate_id: &str, candidate_path: &str, dtype: u32) -> String {
        let candidate = tiny_fixture_bytes(dtype);
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

    fn tiny_fixture_bytes(dtype: u32) -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(dtype),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }

    fn unique_dir(label: &str) -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::path::Path::new("target")
            .join("population-review-tests")
            .join(format!("{label}-{}-{nanos}", std::process::id()))
    }
}
