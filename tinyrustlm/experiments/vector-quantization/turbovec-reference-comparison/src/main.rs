#![forbid(unsafe_code)]

use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fmt::Write as FmtWrite;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write as IoWrite};
use std::path::{Path, PathBuf};
use std::process;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

use tinyrustlm_vector_oracle::{
    sha256, CalibrationIdentity, DeterministicRng, ExactFlatIndex, ExactFlatIndexBuilder,
    FlatIndexConfig, FlatIndexConfigSpec, RetrievalMetric, RetrievalTransform, SearchHit,
    VectorNormalization,
};
use turbovec::IdMapIndex;

const EXPERIMENT_ID: &str = "turbovec-090-4bit-tqplus-reference-comparison-20260725";
const METHOD_ID: &str = "turbovec-crate-090-4bit-tqplus-native-reference";
const QUALITY_SCHEMA: &str = "tinyrustlm.turbovec_reference_quality_process.v1";
const PERFORMANCE_SCHEMA: &str = "tinyrustlm.turbovec_reference_performance_process.v1";
const RECOVERY_SCHEMA: &str = "tinyrustlm.turbovec_reference_deletion_recovery.v1";
const CORRUPTION_SCHEMA: &str = "tinyrustlm.turbovec_reference_corruption_process.v1";
const CONTRACT_SCHEMA: &str = "tinyrustlm.turbovec_reference_benchmark_contract.v1";
const COMMIT_SCHEMA: &str = "tinyrustlm.turbovec_reference_deletion_commit.v1";
const OWNED_ROOT_MARKER: &str = ".tinyrustlm-turbovec-reference-owned";
const OWNED_ROOT_MARKER_BYTES: &[u8] = b"tinyrustlm-turbovec-reference-owned-v1\n";
const TEMPORARY_SUFFIX: &str = ".tmp";
const PROCESS_CRASH_EXIT_CODE: i32 = 74;
const BIT_WIDTH: usize = 4;
const TVIM_FIXED_BYTES: usize = 18;
const EXACT_FIXED_BYTES: usize = 280;
const TURBOVEC_CRATE_SHA256: &str =
    "0715a5a1365e86d0ae6396fa0c011f319b8e8024b3896cd16e6468e29ed3a325";
const PARENT_SELECTION_SHA256: &str =
    "8be904326c844c31b6e973f88bc6ce2e0a7462d51aa0d5ae497dda4b02472fbd";
const PREREGISTRATION_SHA256: &str =
    "96a3fad0078850e2fe9fb4d619979ca9e5b753f23a3fab6df53aebe9b9afe6ed";
const IMPLEMENTATION_SECTION_SHA256: &str =
    "360a3325fcf0acac67442f4bc092a45e75fbf782fe45c5f8ca0fa1329b69ebae";
const DATASET_REVISION: &str = "b2617bb6d3ffa2e429640350f613e3291e10b141";
const SELECTION_SEED_HEX: &str = "6a09e667f3bcc908bb67ae8584caa73b3c6ef372fe94f82ba54ff53a5f1d36f1";
const NATURAL_RECORDS_PER_CLASS: usize = 200;
const NATURAL_QUERIES_PER_CLASS: usize = 20;
const NATURAL_CLASS_COUNT: usize = 10;
const NATURAL_DIMENSION: usize = 28 * 28;
const TOP_K_VALUES: [usize; 3] = [1, 10, 100];
const SYNTHETIC_RECORD_COUNTS: [usize; 6] = [300, 240, 240, 180, 120, 120];
const SYNTHETIC_QUERY_COUNTS: [usize; 6] = [30, 24, 24, 18, 12, 12];
const CONTROLLED_TOPIC_COUNT: usize = 10;
const CONTROLLED_RECORDS_PER_TOPIC: usize = 12;
const CONTROLLED_QUERIES_PER_TOPIC: usize = 3;
const CONTROLLED_DIMENSION: usize = 64;
const DURABLE_DIMENSION: usize = 64;
const DURABLE_INITIAL_RECORD_COUNT: usize = 128;
const DURABLE_DELETE_TARGET_COUNT: usize = 12;
const DURABLE_LANE_ID: &str = "durable-deletion-cosine-64";
const DURABLE_TARGET_SEED: u64 = 0x4528_21e6_38d0_1377;
const MAX_DATASET_BYTES: usize = 64 * 1024 * 1024;
const MAX_MANAGED_FILE_BYTES: usize = 16 * 1024 * 1024;
const PERFORMANCE_WARMUP_PASSES: usize = 5;
const PERFORMANCE_MEASURED_PASSES: usize = 5;
const PERFORMANCE_MONITOR_REQUEST: &str = "memory-monitor-request";
const PERFORMANCE_MONITOR_READY: &str = "memory-monitor-ready";
const PERFORMANCE_POST_PREPARE: &str = "memory-post-prepare";
const PERFORMANCE_POST_PREPARE_ACK: &str = "memory-post-prepare-ack";
const PERFORMANCE_MONITOR_WAIT_MILLISECONDS: u128 = 10_000;

static UPSTREAM_LOAD_ATTEMPTS: AtomicUsize = AtomicUsize::new(0);

type BenchResult<T> = Result<T, String>;

#[derive(Clone)]
struct Record {
    external_id: u64,
    label: Option<u8>,
    vector: Vec<f32>,
    active: bool,
}

#[derive(Clone)]
struct Query {
    ordinal: usize,
    class_or_topic: usize,
    vector: Vec<f32>,
    allowed_external_ids: Option<BTreeSet<u64>>,
    expected_first_id: Option<u64>,
    forbidden_external_ids: BTreeSet<u64>,
    deleted_external_ids: BTreeSet<u64>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum LaneKind {
    Natural,
    Synthetic,
    ControlledMemory,
}

impl LaneKind {
    fn label(self) -> &'static str {
        match self {
            Self::Natural => "natural",
            Self::Synthetic => "synthetic",
            Self::ControlledMemory => "controlled-memory",
        }
    }
}

struct Lane {
    lane_id: &'static str,
    kind: LaneKind,
    metric: RetrievalMetric,
    normalization: VectorNormalization,
    dimension: usize,
    declared_record_count: usize,
    records: Vec<Record>,
    queries: Vec<Query>,
}

#[derive(Clone, Debug, PartialEq)]
struct CandidateHit {
    external_id: u64,
    raw_score: f32,
    declared_score: f64,
}

#[derive(Clone)]
struct RankingMetrics {
    recall_at_1: f64,
    recall_at_10: f64,
    recall_at_100: f64,
    mrr_at_100: f64,
    ndcg_at_100: f64,
    rank_inversions_at_100: usize,
    rank_inversion_rate_at_100: f64,
    maximum_absolute_normalized_score_error: f64,
    mean_absolute_normalized_score_error: f64,
    p99_absolute_normalized_score_error: f64,
    non_finite_score_count: usize,
    duplicate_result_count: usize,
    missing_result_count: usize,
}

struct QueryMetrics {
    lane_id: &'static str,
    query_ordinal: usize,
    class_or_topic: usize,
    candidate: RankingMetrics,
    capacity_matched_exact: RankingMetrics,
    candidate_result_count: usize,
    candidate_result_digest: String,
    raw_candidate_scores: Vec<f32>,
    declared_scores: Vec<f64>,
    candidate_normalized_errors: Vec<f64>,
    capacity_matched_exact_normalized_errors: Vec<f64>,
    label_precision_at_10: Option<f64>,
    label_mrr_at_10: Option<f64>,
    label_ndcg_at_10: Option<f64>,
    expected_first_hit: Option<bool>,
    forbidden_hit_count_at_10: Option<usize>,
    deleted_hit_count: Option<usize>,
    filter_violation_count: Option<usize>,
}

struct RankingAggregate {
    minimum_recall_at_1: f64,
    minimum_recall_at_10: f64,
    minimum_recall_at_100: f64,
    minimum_mrr_at_100: f64,
    minimum_ndcg_at_100: f64,
    maximum_rank_inversion_rate_at_100: f64,
    total_rank_inversions_at_100: usize,
    maximum_absolute_normalized_score_error: f64,
    mean_absolute_normalized_score_error: f64,
    p99_absolute_normalized_score_error: f64,
    non_finite_score_count: usize,
    duplicate_result_count: usize,
    missing_result_count: usize,
}

#[derive(Clone, Copy)]
enum ComparisonArm {
    Candidate,
    CapacityMatchedExact,
}

struct NaturalUtility {
    macro_label_precision_at_10: f64,
    macro_label_mrr_at_10: f64,
    macro_label_ndcg_at_10: f64,
    per_class_query_coverage: Vec<usize>,
}

struct ControlledUtility {
    expected_first_hit_rate: f64,
    forbidden_hit_rate_at_10: f64,
    deleted_hit_count: usize,
    filter_violation_count: usize,
}

struct LaneResult {
    lane_id: &'static str,
    lane_kind: LaneKind,
    metric: RetrievalMetric,
    normalization: VectorNormalization,
    original_dimension: usize,
    encoded_dimension: usize,
    declared_record_count: usize,
    source_active_record_count: usize,
    candidate_record_count: usize,
    query_count: usize,
    candidate_dynamic_index_bytes: usize,
    candidate_formula_bytes: usize,
    exact_full_index_bytes: usize,
    capacity_matched_exact_record_count: usize,
    capacity_matched_exact_index_bytes: usize,
    effective_bits_per_original_coordinate: f64,
    persistent_ratio_to_full_exact: f64,
    first_build_sha256: String,
    second_build_sha256: String,
    deterministic_build_bytes_match: bool,
    deterministic_search_outputs_match: bool,
    reload_search_outputs_match: bool,
    same_corpus: RankingAggregate,
    capacity_matched_exact: RankingAggregate,
    natural_utility: Option<NaturalUtility>,
    controlled_utility: Option<ControlledUtility>,
}

struct CandidateBuild {
    index: IdMapIndex,
    encoded_dimension: usize,
    record_count: usize,
    snapshot_path: PathBuf,
    snapshot_bytes: Vec<u8>,
    snapshot_sha256: String,
}

struct PerformanceResult {
    lane_id: &'static str,
    method: &'static str,
    original_dimension: usize,
    encoded_dimension: usize,
    record_count: usize,
    query_count: usize,
    build_nanoseconds: u128,
    serialization_nanoseconds: u128,
    load_nanoseconds: u128,
    prepare_nanoseconds: u128,
    cold_first_query_nanoseconds: u128,
    measured_query_nanoseconds: Vec<u128>,
    persistent_bytes: usize,
    query_result_digest: String,
    memory_monitor_handshake: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum CorruptionCase {
    HeaderBitFlip,
    PackedCodeBitFlip,
    ScaleBitFlip,
    IdBitFlip,
    TruncateOneByte,
    AppendOneByte,
    CommitHashMismatch,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum StopBoundary {
    SnapshotTempSynced,
    SnapshotFinalized,
    CommitTempSynced,
    CommitFinalized,
}

impl StopBoundary {
    fn from_scenario_id(value: &str) -> BenchResult<Self> {
        match value {
            "after-snapshot-temp-sync-before-finalize" => Ok(Self::SnapshotTempSynced),
            "after-snapshot-finalize-before-commit-temp" => Ok(Self::SnapshotFinalized),
            "after-commit-temp-sync-before-finalize" => Ok(Self::CommitTempSynced),
            "after-commit-finalize-before-obsolete-cleanup" => Ok(Self::CommitFinalized),
            _ => Err("unsupported-crash-scenario".to_owned()),
        }
    }

    fn scenario_id(self) -> &'static str {
        match self {
            Self::SnapshotTempSynced => "after-snapshot-temp-sync-before-finalize",
            Self::SnapshotFinalized => "after-snapshot-finalize-before-commit-temp",
            Self::CommitTempSynced => "after-commit-temp-sync-before-finalize",
            Self::CommitFinalized => "after-commit-finalize-before-obsolete-cleanup",
        }
    }

    fn expected_active_generation(self) -> u64 {
        if self == Self::CommitFinalized {
            2
        } else {
            1
        }
    }
}

impl CorruptionCase {
    fn from_case_id(value: &str) -> BenchResult<Self> {
        match value {
            "header-bit-flip" => Ok(Self::HeaderBitFlip),
            "packed-code-bit-flip" => Ok(Self::PackedCodeBitFlip),
            "scale-bit-flip" => Ok(Self::ScaleBitFlip),
            "id-bit-flip" => Ok(Self::IdBitFlip),
            "truncate-one-byte" => Ok(Self::TruncateOneByte),
            "append-one-byte" => Ok(Self::AppendOneByte),
            "commit-hash-mismatch" => Ok(Self::CommitHashMismatch),
            _ => Err("unsupported-corruption-case".to_owned()),
        }
    }

    fn case_id(self) -> &'static str {
        match self {
            Self::HeaderBitFlip => "header-bit-flip",
            Self::PackedCodeBitFlip => "packed-code-bit-flip",
            Self::ScaleBitFlip => "scale-bit-flip",
            Self::IdBitFlip => "id-bit-flip",
            Self::TruncateOneByte => "truncate-one-byte",
            Self::AppendOneByte => "append-one-byte",
            Self::CommitHashMismatch => "commit-hash-mismatch",
        }
    }
}

struct WriteGenerationResult {
    boundary_reached: bool,
    directory_flush_attempts: usize,
    directory_flush_successes: usize,
}

struct ActiveGeneration {
    generation: u64,
    index: IdMapIndex,
    snapshot_name: String,
    snapshot_sha256: String,
    snapshot_bytes: usize,
    commit_name: String,
    commit_sha256: String,
}

struct RecoveryResult {
    scenario: StopBoundary,
    observed_generation_before_retry: u64,
    deletion_committed_before_retry: bool,
    final_generation: u64,
    retry_wrote_generation_two: bool,
    retry_idempotent: bool,
    final_target_identifier_matches: usize,
    final_target_vector_fingerprint_matches: usize,
    active_index_contains_deleted_target: bool,
    deleted_target_search_matches: usize,
    removed_managed_file_count: usize,
    directory_flush_attempted: bool,
    directory_flush_succeeded: bool,
    final_snapshot_sha256: String,
    final_commit_sha256: String,
}

struct CorruptionResult {
    case: CorruptionCase,
    rejected: bool,
    rejected_before_upstream_load: bool,
    upstream_load_attempt_count: usize,
    bounded_error_code: String,
}

fn main() {
    match run(env::args().skip(1).collect()) {
        Ok(Some(output)) => {
            println!("{output}");
        }
        Ok(None) => {}
        Err(code) => {
            eprintln!("{code}");
            process::exit(1);
        }
    }
}

fn run(arguments: Vec<String>) -> BenchResult<Option<String>> {
    match arguments.as_slice() {
        [mode] if mode == "--contract" => Ok(Some(contract_output())),
        [mode] if mode == "--quality" => Ok(Some(run_quality()?)),
        [mode, lane_id, method] if mode == "--performance" => {
            Ok(Some(run_performance(lane_id, method)?))
        }
        [mode, case] if mode == "--corruption" => {
            let result = run_corruption(CorruptionCase::from_case_id(case)?)?;
            Ok(Some(corruption_json(&result)))
        }
        [mode, scenario] if mode == "--crash" => {
            run_crash(StopBoundary::from_scenario_id(scenario)?)
        }
        [mode, scenario] if mode == "--recover" => {
            let result = run_recovery(StopBoundary::from_scenario_id(scenario)?)?;
            Ok(Some(recovery_json(&result)))
        }
        _ => Err("usage-invalid".to_owned()),
    }
}

fn contract_output() -> String {
    format!(
        "{{\"schema\":\"{CONTRACT_SCHEMA}\",\"experimentId\":\"{EXPERIMENT_ID}\",\
         \"methodId\":\"{METHOD_ID}\",\"bitWidth\":{BIT_WIDTH},\
         \"qualityProcessCount\":1,\"performanceLaneCount\":6,\
         \"performanceMethodCount\":2,\"performanceRepetitionCount\":5,\
         \"corruptionCaseCount\":7,\"crashScenarioCount\":4,\
         \"processCrashExitCode\":{PROCESS_CRASH_EXIT_CODE},\
         \"preregistrationSha256\":\"{PREREGISTRATION_SHA256}\",\
         \"turbovecCrateSha256\":\"{TURBOVEC_CRATE_SHA256}\",\
         \"networkRequired\":false,\"wasmClaim\":false,\"productImport\":false}}"
    )
}

fn run_quality() -> BenchResult<String> {
    let process_root = validate_process_root()?;
    require_root_contains_only_marker(&process_root)?;
    let (selection_sha256, lanes) = load_registered_lanes()?;
    require(
        selection_sha256 == PARENT_SELECTION_SHA256,
        "parent-selection-digest-mismatch",
    )?;

    let mut lane_results = Vec::new();
    let mut per_query = Vec::new();
    for lane in &lanes {
        let (result, mut queries) = evaluate_candidate_lane(lane, &process_root)?;
        lane_results.push(result);
        per_query.append(&mut queries);
    }
    Ok(quality_json(&selection_sha256, &lane_results, &per_query))
}

fn load_natural_material() -> BenchResult<(String, Vec<Record>, Vec<Query>)> {
    let (train_images, train_rows, train_columns) =
        read_idx_images(Path::new("train-images.idx"), 60_000)?;
    let train_labels = read_idx_labels(Path::new("train-labels.idx"), 60_000)?;
    let (test_images, test_rows, test_columns) =
        read_idx_images(Path::new("test-images.idx"), 10_000)?;
    let test_labels = read_idx_labels(Path::new("test-labels.idx"), 10_000)?;
    require(
        train_rows == 28 && train_columns == 28 && test_rows == 28 && test_columns == 28,
        "dataset-image-shape-invalid",
    )?;

    let record_indices = select_indices(&train_labels, NATURAL_RECORDS_PER_CLASS, b"train")?;
    let query_indices = select_indices(&test_labels, NATURAL_QUERIES_PER_CLASS, b"test")?;
    let selection_sha256 = selection_digest(&record_indices, &query_indices);
    let (natural_records, natural_queries) = natural_records_and_queries(
        &train_images,
        &train_labels,
        &record_indices,
        &test_images,
        &test_labels,
        &query_indices,
    )?;
    Ok((selection_sha256, natural_records, natural_queries))
}

fn load_registered_lanes() -> BenchResult<(String, Vec<Lane>)> {
    let (selection_sha256, natural_records, natural_queries) = load_natural_material()?;
    let lanes = vec![
        standard_lane(
            "fashion-mnist-euclidean-784",
            LaneKind::Natural,
            RetrievalMetric::SquaredEuclidean,
            VectorNormalization::None,
            NATURAL_DIMENSION,
            natural_records.clone(),
            natural_queries.clone(),
        )?,
        standard_lane(
            "fashion-mnist-cosine-784",
            LaneKind::Natural,
            RetrievalMetric::Cosine,
            VectorNormalization::L2Unit,
            NATURAL_DIMENSION,
            natural_records,
            natural_queries,
        )?,
        synthetic_lane(
            "synthetic-dot-128",
            RetrievalMetric::DotProduct,
            VectorNormalization::None,
            128,
            0x243f_6a88_85a3_08d3,
        )?,
        synthetic_lane(
            "synthetic-cosine-384",
            RetrievalMetric::Cosine,
            VectorNormalization::L2Unit,
            384,
            0x1319_8a2e_0370_7344,
        )?,
        synthetic_lane(
            "synthetic-euclidean-768",
            RetrievalMetric::SquaredEuclidean,
            VectorNormalization::None,
            768,
            0xa409_3822_299f_31d0,
        )?,
        controlled_memory_lane()?,
    ];
    Ok((selection_sha256, lanes))
}

fn load_registered_lane(lane_id: &str) -> BenchResult<Lane> {
    match lane_id {
        "fashion-mnist-euclidean-784" | "fashion-mnist-cosine-784" => {
            let (selection_sha256, records, queries) = load_natural_material()?;
            require(
                selection_sha256 == PARENT_SELECTION_SHA256,
                "parent-selection-digest-mismatch",
            )?;
            if lane_id == "fashion-mnist-euclidean-784" {
                standard_lane(
                    "fashion-mnist-euclidean-784",
                    LaneKind::Natural,
                    RetrievalMetric::SquaredEuclidean,
                    VectorNormalization::None,
                    NATURAL_DIMENSION,
                    records,
                    queries,
                )
            } else {
                standard_lane(
                    "fashion-mnist-cosine-784",
                    LaneKind::Natural,
                    RetrievalMetric::Cosine,
                    VectorNormalization::L2Unit,
                    NATURAL_DIMENSION,
                    records,
                    queries,
                )
            }
        }
        "synthetic-dot-128" => synthetic_lane(
            "synthetic-dot-128",
            RetrievalMetric::DotProduct,
            VectorNormalization::None,
            128,
            0x243f_6a88_85a3_08d3,
        ),
        "synthetic-cosine-384" => synthetic_lane(
            "synthetic-cosine-384",
            RetrievalMetric::Cosine,
            VectorNormalization::L2Unit,
            384,
            0x1319_8a2e_0370_7344,
        ),
        "synthetic-euclidean-768" => synthetic_lane(
            "synthetic-euclidean-768",
            RetrievalMetric::SquaredEuclidean,
            VectorNormalization::None,
            768,
            0xa409_3822_299f_31d0,
        ),
        "controlled-memory-cosine-64" => controlled_memory_lane(),
        _ => Err("performance-lane-invalid".to_owned()),
    }
}

fn read_bounded(path: &Path, maximum: usize, code: &'static str) -> BenchResult<Vec<u8>> {
    let metadata = fs::symlink_metadata(path).map_err(|_| code.to_owned())?;
    require(
        metadata.file_type().is_file()
            && !metadata.file_type().is_symlink()
            && metadata.len() > 0
            && metadata.len() <= maximum as u64,
        code,
    )?;
    let mut input = File::open(path).map_err(|_| code.to_owned())?;
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    input.read_to_end(&mut bytes).map_err(|_| code.to_owned())?;
    require(bytes.len() == metadata.len() as usize, code)?;
    Ok(bytes)
}

fn read_idx_images(path: &Path, expected_count: usize) -> BenchResult<(Vec<u8>, usize, usize)> {
    let bytes = read_bounded(path, MAX_DATASET_BYTES, "dataset-images-read-failed")?;
    require(bytes.len() >= 16, "dataset-images-header-invalid")?;
    require(
        read_be_u32(&bytes, 0)? == 2051,
        "dataset-images-magic-invalid",
    )?;
    let count = read_be_u32(&bytes, 4)? as usize;
    let rows = read_be_u32(&bytes, 8)? as usize;
    let columns = read_be_u32(&bytes, 12)? as usize;
    require(
        count == expected_count && rows == 28 && columns == 28,
        "dataset-images-header-invalid",
    )?;
    let payload_length = count
        .checked_mul(rows)
        .and_then(|value| value.checked_mul(columns))
        .ok_or_else(|| "dataset-images-length-overflow".to_owned())?;
    require(
        bytes.len() == 16 + payload_length,
        "dataset-images-length-invalid",
    )?;
    Ok((bytes[16..].to_vec(), rows, columns))
}

fn read_idx_labels(path: &Path, expected_count: usize) -> BenchResult<Vec<u8>> {
    let bytes = read_bounded(path, MAX_DATASET_BYTES, "dataset-labels-read-failed")?;
    require(bytes.len() >= 8, "dataset-labels-header-invalid")?;
    require(
        read_be_u32(&bytes, 0)? == 2049,
        "dataset-labels-magic-invalid",
    )?;
    let count = read_be_u32(&bytes, 4)? as usize;
    require(
        count == expected_count && bytes.len() == 8 + count,
        "dataset-labels-length-invalid",
    )?;
    require(
        bytes[8..]
            .iter()
            .all(|label| usize::from(*label) < NATURAL_CLASS_COUNT),
        "dataset-label-out-of-range",
    )?;
    Ok(bytes[8..].to_vec())
}

fn read_be_u32(bytes: &[u8], offset: usize) -> BenchResult<u32> {
    let word = bytes
        .get(offset..offset + 4)
        .ok_or_else(|| "dataset-header-truncated".to_owned())?;
    Ok(u32::from_be_bytes(
        word.try_into()
            .map_err(|_| "dataset-header-truncated".to_owned())?,
    ))
}

fn select_indices(labels: &[u8], per_class: usize, split: &[u8]) -> BenchResult<Vec<Vec<usize>>> {
    let seed = decode_hash(SELECTION_SEED_HEX)?;
    let mut candidates = vec![Vec::<([u8; 32], usize)>::new(); NATURAL_CLASS_COUNT];
    for (index, label) in labels.iter().enumerate() {
        let mut identity = Vec::with_capacity(32 + split.len() + 7);
        identity.extend_from_slice(&seed);
        identity.extend_from_slice(split);
        identity.push(0);
        identity.push(*label);
        identity.extend_from_slice(
            &u32::try_from(index)
                .map_err(|_| "selection-index-overflow".to_owned())?
                .to_be_bytes(),
        );
        candidates[usize::from(*label)].push((sha256(&identity), index));
    }
    let mut selected = Vec::with_capacity(NATURAL_CLASS_COUNT);
    for mut values in candidates {
        values.sort_by(|left, right| left.0.cmp(&right.0).then(left.1.cmp(&right.1)));
        require(values.len() >= per_class, "selection-class-underflow")?;
        selected.push(
            values
                .into_iter()
                .take(per_class)
                .map(|(_, index)| index)
                .collect(),
        );
    }
    Ok(selected)
}

fn selection_digest(record_indices: &[Vec<usize>], query_indices: &[Vec<usize>]) -> String {
    let mut bytes = Vec::new();
    for (kind, groups) in [
        (b"train".as_slice(), record_indices),
        (b"test", query_indices),
    ] {
        bytes.extend_from_slice(kind);
        bytes.push(0);
        for (class, indices) in groups.iter().enumerate() {
            bytes.push(class as u8);
            for index in indices {
                bytes.extend_from_slice(&(*index as u64).to_be_bytes());
            }
        }
    }
    hex(&sha256(&bytes))
}

fn natural_records_and_queries(
    train_images: &[u8],
    train_labels: &[u8],
    record_indices: &[Vec<usize>],
    test_images: &[u8],
    test_labels: &[u8],
    query_indices: &[Vec<usize>],
) -> BenchResult<(Vec<Record>, Vec<Query>)> {
    let mut records = Vec::with_capacity(NATURAL_CLASS_COUNT * NATURAL_RECORDS_PER_CLASS);
    let mut queries = Vec::with_capacity(NATURAL_CLASS_COUNT * NATURAL_QUERIES_PER_CLASS);
    for class in 0..NATURAL_CLASS_COUNT {
        require(
            record_indices[class].len() == NATURAL_RECORDS_PER_CLASS
                && query_indices[class].len() == NATURAL_QUERIES_PER_CLASS,
            "selection-count-invalid",
        )?;
        for (ordinal, index) in record_indices[class].iter().enumerate() {
            require(
                usize::from(train_labels[*index]) == class,
                "selection-label-drift",
            )?;
            records.push(Record {
                external_id: (class * NATURAL_RECORDS_PER_CLASS + ordinal + 1) as u64,
                label: Some(class as u8),
                vector: image_vector(train_images, *index)?,
                active: true,
            });
        }
        for (ordinal, index) in query_indices[class].iter().enumerate() {
            require(
                usize::from(test_labels[*index]) == class,
                "selection-label-drift",
            )?;
            queries.push(Query {
                ordinal: class * NATURAL_QUERIES_PER_CLASS + ordinal,
                class_or_topic: class,
                vector: image_vector(test_images, *index)?,
                allowed_external_ids: None,
                expected_first_id: None,
                forbidden_external_ids: BTreeSet::new(),
                deleted_external_ids: BTreeSet::new(),
            });
        }
    }
    Ok((records, queries))
}

fn image_vector(images: &[u8], index: usize) -> BenchResult<Vec<f32>> {
    let start = index
        .checked_mul(NATURAL_DIMENSION)
        .ok_or_else(|| "image-index-overflow".to_owned())?;
    let end = start
        .checked_add(NATURAL_DIMENSION)
        .ok_or_else(|| "image-index-overflow".to_owned())?;
    let image = images
        .get(start..end)
        .ok_or_else(|| "image-index-out-of-range".to_owned())?;
    Ok(image
        .iter()
        .map(|value| f32::from(*value) / 255.0)
        .collect())
}

fn standard_lane(
    lane_id: &'static str,
    kind: LaneKind,
    metric: RetrievalMetric,
    normalization: VectorNormalization,
    dimension: usize,
    records: Vec<Record>,
    queries: Vec<Query>,
) -> BenchResult<Lane> {
    require(
        records
            .iter()
            .all(|record| record.vector.len() == dimension),
        "lane-record-dimension-invalid",
    )?;
    require(
        queries.iter().all(|query| query.vector.len() == dimension),
        "lane-query-dimension-invalid",
    )?;
    Ok(Lane {
        lane_id,
        kind,
        metric,
        normalization,
        dimension,
        declared_record_count: records.len(),
        records,
        queries,
    })
}

fn synthetic_lane(
    lane_id: &'static str,
    metric: RetrievalMetric,
    normalization: VectorNormalization,
    dimension: usize,
    seed: u64,
) -> BenchResult<Lane> {
    let mut rng = DeterministicRng::new(seed);
    let mut records = Vec::with_capacity(SYNTHETIC_RECORD_COUNTS.iter().sum());
    let mut next_id = 1_u64;
    for (family, count) in SYNTHETIC_RECORD_COUNTS.iter().enumerate() {
        let mut previous = None;
        for ordinal in 0..*count {
            let vector = synthetic_vector(&mut rng, family, ordinal, dimension, &mut previous);
            records.push(Record {
                external_id: next_id,
                label: None,
                vector,
                active: true,
            });
            next_id += 1;
        }
    }
    let mut queries = Vec::with_capacity(SYNTHETIC_QUERY_COUNTS.iter().sum());
    let mut query_ordinal = 0;
    for (family, count) in SYNTHETIC_QUERY_COUNTS.iter().enumerate() {
        let mut previous = None;
        for ordinal in 0..*count {
            queries.push(Query {
                ordinal: query_ordinal,
                class_or_topic: family,
                vector: synthetic_vector(&mut rng, family, ordinal, dimension, &mut previous),
                allowed_external_ids: None,
                expected_first_id: None,
                forbidden_external_ids: BTreeSet::new(),
                deleted_external_ids: BTreeSet::new(),
            });
            query_ordinal += 1;
        }
    }
    require(
        records.len() == 1_200 && queries.len() == 120,
        "synthetic-count-invalid",
    )?;
    standard_lane(
        lane_id,
        LaneKind::Synthetic,
        metric,
        normalization,
        dimension,
        records,
        queries,
    )
}

fn synthetic_vector(
    rng: &mut DeterministicRng,
    family: usize,
    ordinal: usize,
    dimension: usize,
    previous: &mut Option<Vec<f32>>,
) -> Vec<f32> {
    if family == 3 {
        if ordinal % 3 == 1 {
            return previous
                .as_ref()
                .expect("duplicate family has a predecessor")
                .clone();
        }
        if ordinal % 3 == 2 {
            let mut near = previous
                .as_ref()
                .expect("near-tie family has a predecessor")
                .clone();
            near[ordinal % dimension] += 1.0_f32 / 4096.0_f32;
            return near;
        }
    }
    let mut vector = vec![0.0_f32; dimension];
    match family {
        0 | 3 => {
            for value in &mut vector {
                *value = random_signed(rng);
            }
        }
        1 => {
            let nonzero = (dimension / 16).max(1);
            for _ in 0..nonzero {
                let index = (rng.next_u64() % dimension as u64) as usize;
                vector[index] += random_signed(rng);
            }
        }
        2 => {
            for (index, value) in vector.iter_mut().enumerate() {
                let scale = if index < 8 { 16.0 } else { 1.0 };
                *value = random_signed(rng) * scale;
            }
        }
        4 => {
            for value in &mut vector {
                *value = random_signed(rng);
            }
            let index = (rng.next_u64() % dimension as u64) as usize;
            vector[index] *= 1024.0;
        }
        5 => {
            for value in &mut vector {
                *value = random_signed(rng) + 3.0;
            }
        }
        _ => unreachable!("registered synthetic family"),
    }
    if vector.iter().all(|value| *value == 0.0) {
        vector[ordinal % dimension] = 1.0;
    }
    *previous = Some(vector.clone());
    vector
}

fn random_signed(rng: &mut DeterministicRng) -> f32 {
    (rng.next_unit_f64() * 2.0 - 1.0) as f32
}

fn controlled_memory_lane() -> BenchResult<Lane> {
    let lane_id = "controlled-memory-cosine-64";
    let mut rng = DeterministicRng::new(0x082e_fa98_ec4e_6c89);
    let mut records = Vec::with_capacity(CONTROLLED_TOPIC_COUNT * CONTROLLED_RECORDS_PER_TOPIC);
    let mut queries = Vec::with_capacity(CONTROLLED_TOPIC_COUNT * CONTROLLED_QUERIES_PER_TOPIC);
    let mut all_deleted = BTreeSet::new();
    for topic in 0..CONTROLLED_TOPIC_COUNT {
        let mut base = (0..CONTROLLED_DIMENSION)
            .map(|_| random_signed(&mut rng) * 0.25)
            .collect::<Vec<_>>();
        base[topic] += 4.0;
        let topic_base_id = (topic * CONTROLLED_RECORDS_PER_TOPIC + 1) as u64;
        for slot in 0..CONTROLLED_RECORDS_PER_TOPIC {
            let external_id = topic_base_id + slot as u64;
            let mut vector = base.clone();
            match slot {
                0 | 2 | 3 | 4 | 5 => {}
                6 => {
                    vector[topic] = -4.0;
                    vector[(topic + 17) % CONTROLLED_DIMENSION] += 4.0;
                }
                _ => {
                    for value in &mut vector {
                        *value += random_signed(&mut rng) * 0.02;
                    }
                }
            }
            let active = slot != 3;
            if !active {
                all_deleted.insert(external_id);
            }
            records.push(Record {
                external_id,
                label: None,
                vector,
                active,
            });
        }
        let allowed = [0_usize, 1, 6, 7, 8, 9, 10, 11]
            .into_iter()
            .map(|slot| topic_base_id + slot as u64)
            .collect::<BTreeSet<_>>();
        let forbidden = [2_usize, 4, 5]
            .into_iter()
            .map(|slot| topic_base_id + slot as u64)
            .collect::<BTreeSet<_>>();
        for query_in_topic in 0..CONTROLLED_QUERIES_PER_TOPIC {
            let mut vector = base.clone();
            let coordinate = (topic + 23 + query_in_topic) % CONTROLLED_DIMENSION;
            vector[coordinate] += (query_in_topic as f32 + 1.0) * 0.000_01;
            queries.push(Query {
                ordinal: topic * CONTROLLED_QUERIES_PER_TOPIC + query_in_topic,
                class_or_topic: topic,
                vector,
                allowed_external_ids: Some(allowed.clone()),
                expected_first_id: Some(topic_base_id),
                forbidden_external_ids: forbidden.clone(),
                deleted_external_ids: all_deleted.clone(),
            });
        }
    }
    for query in &mut queries {
        query.deleted_external_ids = all_deleted.clone();
    }
    let metric = RetrievalMetric::Cosine;
    let normalization = VectorNormalization::L2Unit;
    require(
        records.len() == 120
            && queries.len() == 30
            && records.iter().filter(|record| record.active).count() == 110,
        "controlled-count-invalid",
    )?;
    Ok(Lane {
        lane_id,
        kind: LaneKind::ControlledMemory,
        metric,
        normalization,
        dimension: CONTROLLED_DIMENSION,
        declared_record_count: records.len(),
        records,
        queries,
    })
}

fn build_index(
    lane_id: &str,
    metric: RetrievalMetric,
    normalization: VectorNormalization,
    dimension: usize,
    records: &[Record],
) -> BenchResult<ExactFlatIndex> {
    let config = config(lane_id, metric, normalization, dimension)?;
    let mut builder =
        ExactFlatIndexBuilder::new(config, record_revision(lane_id, records, b"records"))
            .map_err(|_| "index-builder-failed".to_owned())?;
    for record in records {
        if record.active {
            builder
                .insert(record.external_id, &record.vector)
                .map_err(|_| "index-insert-failed".to_owned())?;
        }
    }
    Ok(builder.finish())
}

fn config(
    lane_id: &str,
    metric: RetrievalMetric,
    normalization: VectorNormalization,
    dimension: usize,
) -> BenchResult<FlatIndexConfig> {
    FlatIndexConfig::from_spec(FlatIndexConfigSpec {
        dimension,
        metric,
        normalization,
        transform: RetrievalTransform::None,
        transform_seed: 0,
        embedding_model_sha256: sha256(format!("{lane_id}:embedding-input").as_bytes()),
        tokenizer_sha256: sha256(format!("{lane_id}:tokenizer-identity").as_bytes()),
        codebook_sha256: None,
        calibration: CalibrationIdentity::None,
        implementation_sha256: decode_hash(IMPLEMENTATION_SECTION_SHA256)?,
    })
    .map_err(|_| "index-config-invalid".to_owned())
}

fn record_revision(lane_id: &str, records: &[Record], suffix: &[u8]) -> [u8; 32] {
    let mut bytes = Vec::new();
    bytes.extend_from_slice(lane_id.as_bytes());
    bytes.push(0);
    bytes.extend_from_slice(suffix);
    for record in records {
        bytes.extend_from_slice(&record.external_id.to_le_bytes());
        bytes.push(u8::from(record.active));
        for value in &record.vector {
            bytes.extend_from_slice(&canonical_f32(*value).to_bits().to_le_bytes());
        }
    }
    sha256(&bytes)
}

fn evaluate_candidate_lane(
    lane: &Lane,
    process_root: &Path,
) -> BenchResult<(LaneResult, Vec<QueryMetrics>)> {
    let (
        expected_encoded_dimension,
        expected_candidate_bytes,
        expected_capacity_count,
        expected_capacity_bytes,
        expected_full_exact_bytes,
    ) = registered_accounting(lane.lane_id)?;
    let first = build_candidate(lane, process_root, "build-1")?;
    let second = build_candidate(lane, process_root, "build-2")?;
    require(
        first.encoded_dimension == expected_encoded_dimension
            && second.encoded_dimension == expected_encoded_dimension
            && first.snapshot_bytes.len() == expected_candidate_bytes
            && second.snapshot_bytes.len() == expected_candidate_bytes,
        "candidate-registered-accounting-mismatch",
    )?;
    require(
        first.snapshot_bytes == second.snapshot_bytes
            && first.snapshot_sha256 == second.snapshot_sha256,
        "candidate-independent-build-bytes-differ",
    )?;

    let reloaded = verified_load_tvim(
        &first.snapshot_path,
        first.snapshot_bytes.len(),
        &first.snapshot_sha256,
    )?;
    require(
        reloaded.len() == first.record_count
            && reloaded.dim() == first.encoded_dimension
            && reloaded.bit_width() == BIT_WIDTH,
        "candidate-reload-metadata-mismatch",
    )?;

    let first_outputs = candidate_outputs(&first.index, lane)?;
    let second_outputs = candidate_outputs(&second.index, lane)?;
    let reload_outputs = candidate_outputs(&reloaded, lane)?;
    require(
        first_outputs == second_outputs,
        "candidate-independent-build-search-differs",
    )?;
    require(
        first_outputs == reload_outputs,
        "candidate-reload-search-differs",
    )?;

    let capacity_count = capacity_matched_record_count(first.snapshot_bytes.len(), lane.dimension)?;
    require(
        capacity_count == expected_capacity_count,
        "capacity-matched-record-count-drift",
    )?;
    let subset_records = capacity_matched_records(lane, capacity_count)?;
    let capacity_index = build_index(
        lane.lane_id,
        lane.metric,
        lane.normalization,
        lane.dimension,
        &subset_records,
    )?;
    let capacity_bytes = capacity_index
        .to_bytes()
        .map_err(|_| "capacity-exact-serialize-failed".to_owned())?
        .len();
    require(
        capacity_bytes == expected_capacity_bytes
            && capacity_bytes <= first.snapshot_bytes.len()
            && exact_flat_bytes(capacity_count + 1, lane.dimension)? > first.snapshot_bytes.len(),
        "capacity-matched-budget-not-maximal",
    )?;
    require(
        exact_flat_bytes(lane.declared_record_count, lane.dimension)? == expected_full_exact_bytes,
        "full-exact-byte-accounting-drift",
    )?;

    let mut query_metrics = Vec::with_capacity(lane.queries.len());
    for (query, candidate_hits) in lane.queries.iter().zip(&first_outputs) {
        let expected = independent_rank(
            &lane.records,
            &query.vector,
            lane.metric,
            lane.normalization,
            query.allowed_external_ids.as_ref(),
        )?;
        let capacity_observed = capacity_index
            .search(
                &query.vector,
                TOP_K_VALUES[2],
                query.allowed_external_ids.as_ref(),
            )
            .map_err(|_| "capacity-exact-search-failed".to_owned())?;
        query_metrics.push(compare_query(
            lane,
            query,
            &expected,
            candidate_hits,
            &capacity_observed,
        )?);
    }

    let same_corpus = aggregate_ranking(&query_metrics, ComparisonArm::Candidate)?;
    let capacity_matched_exact =
        aggregate_ranking(&query_metrics, ComparisonArm::CapacityMatchedExact)?;
    let natural_utility = if lane.kind == LaneKind::Natural {
        Some(aggregate_natural_utility(&query_metrics)?)
    } else {
        None
    };
    let controlled_utility = if lane.kind == LaneKind::ControlledMemory {
        Some(aggregate_controlled_utility(&query_metrics)?)
    } else {
        None
    };
    let candidate_formula_bytes =
        candidate_tvim_bytes(first.record_count, first.encoded_dimension)?;
    require(
        candidate_formula_bytes == first.snapshot_bytes.len(),
        "candidate-file-length-formula-mismatch",
    )?;
    let effective_bits_per_original_coordinate =
        8.0 * first.snapshot_bytes.len() as f64 / (first.record_count * lane.dimension) as f64;
    let persistent_ratio_to_full_exact =
        first.snapshot_bytes.len() as f64 / expected_full_exact_bytes as f64;
    let result = LaneResult {
        lane_id: lane.lane_id,
        lane_kind: lane.kind,
        metric: lane.metric,
        normalization: lane.normalization,
        original_dimension: lane.dimension,
        encoded_dimension: first.encoded_dimension,
        declared_record_count: lane.declared_record_count,
        source_active_record_count: lane.records.iter().filter(|record| record.active).count(),
        candidate_record_count: first.record_count,
        query_count: lane.queries.len(),
        candidate_dynamic_index_bytes: first.snapshot_bytes.len(),
        candidate_formula_bytes,
        exact_full_index_bytes: expected_full_exact_bytes,
        capacity_matched_exact_record_count: capacity_count,
        capacity_matched_exact_index_bytes: capacity_bytes,
        effective_bits_per_original_coordinate,
        persistent_ratio_to_full_exact,
        first_build_sha256: first.snapshot_sha256,
        second_build_sha256: second.snapshot_sha256,
        deterministic_build_bytes_match: true,
        deterministic_search_outputs_match: true,
        reload_search_outputs_match: true,
        same_corpus,
        capacity_matched_exact,
        natural_utility,
        controlled_utility,
    };
    Ok((result, query_metrics))
}

fn registered_accounting(lane_id: &str) -> BenchResult<(usize, usize, usize, usize, usize)> {
    match lane_id {
        "fashion-mnist-euclidean-784" => Ok((792, 822_354, 260, 819_800, 6_304_280)),
        "fashion-mnist-cosine-784" => Ok((784, 814_290, 258, 813_496, 6_304_280)),
        "synthetic-dot-128" => Ok((128, 92_242, 174, 92_152, 633_880)),
        "synthetic-cosine-384" => Ok((384, 247_890, 159, 247_048, 1_862_680)),
        "synthetic-euclidean-768" => Ok((776, 486_226, 157, 485_096, 3_705_880)),
        "controlled-memory-cosine-64" => Ok((64, 5_810, 20, 5_720, 32_920)),
        _ => Err("registered-lane-accounting-missing".to_owned()),
    }
}

fn encoded_dimension(metric: RetrievalMetric, original_dimension: usize) -> BenchResult<usize> {
    let required = if metric == RetrievalMetric::SquaredEuclidean {
        original_dimension
            .checked_add(1)
            .ok_or_else(|| "candidate-encoded-dimension-overflow".to_owned())?
    } else {
        original_dimension
    };
    let rounded = required
        .checked_add(7)
        .ok_or_else(|| "candidate-encoded-dimension-overflow".to_owned())?
        / 8
        * 8;
    require(
        rounded > 0 && rounded <= 65_536,
        "candidate-encoded-dimension-invalid",
    )?;
    Ok(rounded)
}

fn candidate_record_vector(lane: &Lane, input: &[f32]) -> BenchResult<Vec<f32>> {
    let prepared = independent_prepare(input, lane.normalization)?;
    let encoded = encoded_dimension(lane.metric, lane.dimension)?;
    let mut output = Vec::with_capacity(encoded);
    output.extend_from_slice(&prepared);
    if lane.metric == RetrievalMetric::SquaredEuclidean {
        let squared_norm = prepared
            .iter()
            .map(|value| f64::from(*value) * f64::from(*value))
            .sum::<f64>();
        require(squared_norm.is_finite(), "candidate-record-norm-nonfinite")?;
        output.push(canonical_f32(-(squared_norm as f32)));
    }
    output.resize(encoded, 0.0);
    validate_candidate_coordinates(&output)?;
    Ok(output)
}

fn candidate_query_vector(lane: &Lane, input: &[f32]) -> BenchResult<(Vec<f32>, f64)> {
    let prepared = independent_prepare(input, lane.normalization)?;
    let encoded = encoded_dimension(lane.metric, lane.dimension)?;
    let query_squared_norm = prepared
        .iter()
        .map(|value| f64::from(*value) * f64::from(*value))
        .sum::<f64>();
    require(
        query_squared_norm.is_finite(),
        "candidate-query-norm-nonfinite",
    )?;
    let mut output = Vec::with_capacity(encoded);
    if lane.metric == RetrievalMetric::SquaredEuclidean {
        output.extend(prepared.iter().map(|value| canonical_f32(*value * 2.0)));
        output.push(1.0);
    } else {
        output.extend_from_slice(&prepared);
    }
    output.resize(encoded, 0.0);
    validate_candidate_coordinates(&output)?;
    Ok((output, query_squared_norm))
}

fn validate_candidate_coordinates(values: &[f32]) -> BenchResult<()> {
    require(
        values
            .iter()
            .all(|value| value.is_finite() && value.abs() < 1.0e16),
        "candidate-coordinate-invalid",
    )
}

fn build_candidate(lane: &Lane, root: &Path, build_label: &str) -> BenchResult<CandidateBuild> {
    let (index, encoded, record_count) = construct_candidate_index(lane)?;
    let expected_bytes = candidate_tvim_bytes(record_count, encoded)?;
    let (snapshot_path, snapshot_bytes, snapshot_sha256) =
        persist_candidate_snapshot(&index, root, lane.lane_id, build_label, expected_bytes)?;
    Ok(CandidateBuild {
        index,
        encoded_dimension: encoded,
        record_count,
        snapshot_path,
        snapshot_bytes,
        snapshot_sha256,
    })
}

fn construct_candidate_index(lane: &Lane) -> BenchResult<(IdMapIndex, usize, usize)> {
    let encoded = encoded_dimension(lane.metric, lane.dimension)?;
    let mut records = lane.records.iter().collect::<Vec<_>>();
    records.sort_by_key(|record| record.external_id);
    require(
        records.len() == lane.declared_record_count,
        "candidate-record-count-invalid",
    )?;
    if lane.kind == LaneKind::ControlledMemory {
        require(
            records
                .iter()
                .filter(|record| !record.active)
                .all(|record| {
                    lane.queries.iter().all(|query| {
                        query
                            .allowed_external_ids
                            .as_ref()
                            .is_some_and(|allowed| !allowed.contains(&record.external_id))
                    })
                }),
            "controlled-inactive-record-not-excluded-by-allowlist",
        )?;
    } else {
        require(
            records.iter().all(|record| record.active),
            "candidate-unexpected-inactive-record",
        )?;
    }
    let mut vectors = Vec::with_capacity(records.len() * encoded);
    let mut ids = Vec::with_capacity(records.len());
    for record in records {
        ids.push(record.external_id);
        vectors.extend_from_slice(&candidate_record_vector(lane, &record.vector)?);
    }
    let mut index =
        IdMapIndex::new(encoded, BIT_WIDTH).map_err(|_| "candidate-construct-failed".to_owned())?;
    index
        .add_with_ids(&vectors, &ids)
        .map_err(|_| "candidate-add-failed".to_owned())?;
    require(
        index.len() == ids.len() && index.dim() == encoded && index.bit_width() == BIT_WIDTH,
        "candidate-build-metadata-invalid",
    )?;
    Ok((index, encoded, ids.len()))
}

fn persist_candidate_snapshot(
    index: &IdMapIndex,
    root: &Path,
    lane_id: &str,
    build_label: &str,
    expected_bytes: usize,
) -> BenchResult<(PathBuf, Vec<u8>, String)> {
    let temporary_name = format!("snapshot-quality-{lane_id}-{build_label}.tvim.tmp");
    let temporary_path = root.join(&temporary_name);
    require(
        !temporary_path.exists(),
        "candidate-temporary-snapshot-exists",
    )?;
    index
        .write(&temporary_path)
        .map_err(|_| "candidate-snapshot-write-failed".to_owned())?;
    OpenOptions::new()
        .read(true)
        .write(true)
        .open(&temporary_path)
        .and_then(|file| file.sync_all())
        .map_err(|_| "candidate-snapshot-sync-failed".to_owned())?;
    let bytes = read_bounded(
        &temporary_path,
        MAX_MANAGED_FILE_BYTES,
        "candidate-snapshot-read-failed",
    )?;
    require(
        bytes.len() == expected_bytes,
        "candidate-snapshot-length-invalid",
    )?;
    let digest = hex(&sha256(&bytes));
    let final_name = format!("snapshot-quality-{lane_id}-{build_label}-{digest}.tvim");
    let final_path = root.join(final_name);
    require(!final_path.exists(), "candidate-final-snapshot-exists")?;
    fs::rename(&temporary_path, &final_path)
        .map_err(|_| "candidate-snapshot-finalize-failed".to_owned())?;
    let _ = sync_directory(root);
    validate_reopened_bytes(
        &final_path,
        &bytes,
        "candidate-final-snapshot-validation-failed",
    )?;
    Ok((final_path, bytes, digest))
}

fn verified_load_tvim(
    path: &Path,
    expected_bytes: usize,
    expected_sha256: &str,
) -> BenchResult<IdMapIndex> {
    let metadata =
        fs::symlink_metadata(path).map_err(|_| "verified-load-metadata-failed".to_owned())?;
    require(
        metadata.file_type().is_file()
            && !metadata.file_type().is_symlink()
            && metadata.len() == expected_bytes as u64,
        "verified-load-length-mismatch",
    )?;
    let bytes = read_bounded(
        path,
        MAX_MANAGED_FILE_BYTES,
        "verified-load-snapshot-read-failed",
    )?;
    require(
        bytes.len() == expected_bytes && hex(&sha256(&bytes)) == expected_sha256,
        "verified-load-digest-mismatch",
    )?;
    UPSTREAM_LOAD_ATTEMPTS.fetch_add(1, Ordering::SeqCst);
    IdMapIndex::load(path).map_err(|_| "upstream-tvim-load-failed".to_owned())
}

fn candidate_outputs(index: &IdMapIndex, lane: &Lane) -> BenchResult<Vec<Vec<CandidateHit>>> {
    lane.queries
        .iter()
        .map(|query| candidate_search(index, lane, query))
        .collect()
}

fn candidate_search(
    index: &IdMapIndex,
    lane: &Lane,
    query: &Query,
) -> BenchResult<Vec<CandidateHit>> {
    let (encoded_query, query_squared_norm) = candidate_query_vector(lane, &query.vector)?;
    let allowlist = query
        .allowed_external_ids
        .as_ref()
        .map(|values| values.iter().copied().collect::<Vec<_>>());
    let result_count = allowlist
        .as_ref()
        .map_or(index.len(), Vec::len)
        .min(TOP_K_VALUES[2]);
    require(result_count > 0, "candidate-result-count-zero")?;
    let (scores, ids) = if let Some(allowed) = allowlist.as_deref() {
        index.search_with_allowlist(&encoded_query, result_count, Some(allowed))
    } else {
        index.search(&encoded_query, result_count)
    };
    require(
        scores.len() == result_count && ids.len() == result_count,
        "candidate-result-count-invalid",
    )?;
    require(
        scores.iter().all(|score| score.is_finite()),
        "candidate-nonfinite-score",
    )?;
    require(
        scores.windows(2).all(|pair| pair[0] >= pair[1]),
        "candidate-upstream-order-invalid",
    )?;
    let mut hits = scores
        .into_iter()
        .zip(ids)
        .map(|(raw_score, external_id)| {
            let raw_score = canonical_f32(raw_score);
            let declared_score = if lane.metric == RetrievalMetric::SquaredEuclidean {
                query_squared_norm - f64::from(raw_score)
            } else {
                f64::from(raw_score)
            };
            require(
                declared_score.is_finite(),
                "candidate-declared-score-nonfinite",
            )?;
            Ok(CandidateHit {
                external_id,
                raw_score,
                declared_score: if declared_score == 0.0 {
                    0.0
                } else {
                    declared_score
                },
            })
        })
        .collect::<BenchResult<Vec<_>>>()?;
    let mut start = 0;
    while start < hits.len() {
        let mut end = start + 1;
        while end < hits.len() && hits[end].raw_score == hits[start].raw_score {
            end += 1;
        }
        hits[start..end].sort_by_key(|hit| hit.external_id);
        start = end;
    }
    Ok(hits)
}

fn candidate_tvim_bytes(record_count: usize, encoded_dimension: usize) -> BenchResult<usize> {
    let packed = record_count
        .checked_mul(encoded_dimension)
        .and_then(|value| value.checked_mul(BIT_WIDTH))
        .ok_or_else(|| "candidate-byte-formula-overflow".to_owned())?
        / 8;
    TVIM_FIXED_BYTES
        .checked_add(packed)
        .and_then(|value| value.checked_add(record_count.checked_mul(12)?))
        .and_then(|value| value.checked_add(encoded_dimension.checked_mul(8)?))
        .ok_or_else(|| "candidate-byte-formula-overflow".to_owned())
}

fn exact_flat_bytes(record_count: usize, dimension: usize) -> BenchResult<usize> {
    EXACT_FIXED_BYTES
        .checked_add(
            record_count
                .checked_mul(
                    16_usize
                        .checked_add(
                            dimension
                                .checked_mul(4)
                                .ok_or_else(|| "exact-byte-formula-overflow".to_owned())?,
                        )
                        .ok_or_else(|| "exact-byte-formula-overflow".to_owned())?,
                )
                .ok_or_else(|| "exact-byte-formula-overflow".to_owned())?,
        )
        .ok_or_else(|| "exact-byte-formula-overflow".to_owned())
}

fn capacity_matched_record_count(budget: usize, dimension: usize) -> BenchResult<usize> {
    require(budget >= EXACT_FIXED_BYTES, "capacity-budget-too-small")?;
    let per_record = 16_usize
        .checked_add(
            dimension
                .checked_mul(4)
                .ok_or_else(|| "capacity-record-byte-overflow".to_owned())?,
        )
        .ok_or_else(|| "capacity-record-byte-overflow".to_owned())?;
    Ok((budget - EXACT_FIXED_BYTES) / per_record)
}

fn capacity_matched_records(lane: &Lane, count: usize) -> BenchResult<Vec<Record>> {
    let seed = decode_hash(SELECTION_SEED_HEX)?;
    let mut ranked = lane
        .records
        .iter()
        .filter(|record| record.active)
        .map(|record| {
            let mut material = Vec::new();
            material.extend_from_slice(&seed);
            material.extend_from_slice(lane.lane_id.as_bytes());
            material.push(0);
            material.extend_from_slice(&record.external_id.to_be_bytes());
            (sha256(&material), record.external_id, record.clone())
        })
        .collect::<Vec<_>>();
    ranked.sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)));
    require(
        count > 0 && count <= ranked.len(),
        "capacity-subset-count-invalid",
    )?;
    let mut selected = ranked
        .into_iter()
        .take(count)
        .map(|(_, _, record)| record)
        .collect::<Vec<_>>();
    selected.sort_by_key(|record| record.external_id);
    Ok(selected)
}

fn independent_rank(
    records: &[Record],
    query: &[f32],
    metric: RetrievalMetric,
    normalization: VectorNormalization,
    allowed: Option<&BTreeSet<u64>>,
) -> BenchResult<Vec<SearchHit>> {
    let prepared_query = independent_prepare(query, normalization)?;
    let mut hits = Vec::new();
    for record in records {
        if !record.active || allowed.is_some_and(|set| !set.contains(&record.external_id)) {
            continue;
        }
        let prepared_record = independent_prepare(&record.vector, normalization)?;
        hits.push(SearchHit {
            external_id: record.external_id,
            score: independent_score(metric, &prepared_query, &prepared_record)?,
        });
    }
    hits.sort_by(|left, right| {
        let score_order = match metric {
            RetrievalMetric::DotProduct | RetrievalMetric::Cosine => {
                right.score.total_cmp(&left.score)
            }
            RetrievalMetric::SquaredEuclidean => left.score.total_cmp(&right.score),
        };
        score_order.then_with(|| left.external_id.cmp(&right.external_id))
    });
    hits.truncate(100);
    Ok(hits)
}

fn independent_prepare(input: &[f32], normalization: VectorNormalization) -> BenchResult<Vec<f32>> {
    require(!input.is_empty(), "ground-truth-empty-vector")?;
    let mut values = Vec::with_capacity(input.len());
    for value in input {
        require(value.is_finite(), "ground-truth-nonfinite-vector")?;
        values.push(if *value == 0.0 {
            0.0
        } else {
            f64::from(*value)
        });
    }
    if normalization == VectorNormalization::L2Unit {
        let squared_norm = values.iter().map(|value| value * value).sum::<f64>();
        require(
            squared_norm.is_finite() && squared_norm > 0.0,
            "ground-truth-zero-or-nonfinite-norm",
        )?;
        let inverse_norm = squared_norm.sqrt().recip();
        for value in &mut values {
            *value *= inverse_norm;
        }
    }
    values
        .into_iter()
        .map(|value| {
            let stored = value as f32;
            require(stored.is_finite(), "ground-truth-nonfinite-storage")?;
            Ok(canonical_f32(stored))
        })
        .collect()
}

fn independent_score(metric: RetrievalMetric, query: &[f32], record: &[f32]) -> BenchResult<f64> {
    require(
        query.len() == record.len(),
        "ground-truth-dimension-mismatch",
    )?;
    let mut result = 0.0_f64;
    match metric {
        RetrievalMetric::DotProduct | RetrievalMetric::Cosine => {
            for (left, right) in query.iter().zip(record) {
                result += f64::from(*left) * f64::from(*right);
            }
        }
        RetrievalMetric::SquaredEuclidean => {
            for (left, right) in query.iter().zip(record) {
                let difference = f64::from(*left) - f64::from(*right);
                result += difference * difference;
            }
        }
    }
    require(result.is_finite(), "ground-truth-nonfinite-score")?;
    Ok(if result == 0.0 { 0.0 } else { result })
}

fn compare_query(
    lane: &Lane,
    query: &Query,
    expected: &[SearchHit],
    candidate_hits: &[CandidateHit],
    capacity_observed: &[SearchHit],
) -> BenchResult<QueryMetrics> {
    require(!expected.is_empty(), "ground-truth-empty-ranking")?;
    let candidate_observed = candidate_hits
        .iter()
        .map(|hit| SearchHit {
            external_id: hit.external_id,
            score: hit.declared_score,
        })
        .collect::<Vec<_>>();
    let candidate_normalized_errors = normalized_score_errors(lane, query, &candidate_observed)?;
    let capacity_matched_exact_normalized_errors =
        normalized_score_errors(lane, query, capacity_observed)?;
    let candidate = ranking_metrics(expected, &candidate_observed, &candidate_normalized_errors)?;
    let capacity_matched_exact = ranking_metrics(
        expected,
        capacity_observed,
        &capacity_matched_exact_normalized_errors,
    )?;

    let label_metrics = if lane.kind == LaneKind::Natural {
        let query_label = query.class_or_topic as u8;
        let labels = lane
            .records
            .iter()
            .map(|record| (record.external_id, record.label))
            .collect::<BTreeMap<_, _>>();
        let relevance = candidate_observed
            .iter()
            .take(10)
            .map(|hit| {
                labels
                    .get(&hit.external_id)
                    .copied()
                    .flatten()
                    .is_some_and(|label| label == query_label)
            })
            .collect::<Vec<_>>();
        let precision = relevance.iter().filter(|value| **value).count() as f64 / 10.0;
        let mrr = relevance
            .iter()
            .position(|value| *value)
            .map_or(0.0, |position| 1.0 / (position + 1) as f64);
        let relevant_total = lane
            .records
            .iter()
            .filter(|record| record.active && record.label == Some(query_label))
            .count()
            .min(10);
        let ideal = (0..relevant_total)
            .map(|position| 1.0 / ((position + 2) as f64).log2())
            .sum::<f64>();
        let dcg = relevance
            .iter()
            .enumerate()
            .filter(|(_, relevant)| **relevant)
            .map(|(position, _)| 1.0 / ((position + 2) as f64).log2())
            .sum::<f64>();
        Some((precision, mrr, if ideal == 0.0 { 0.0 } else { dcg / ideal }))
    } else {
        None
    };

    let controlled = if lane.kind == LaneKind::ControlledMemory {
        let expected_first_hit = query.expected_first_id.is_some_and(|expected_id| {
            candidate_observed
                .first()
                .is_some_and(|hit| hit.external_id == expected_id)
        });
        let forbidden_hit_count = candidate_observed
            .iter()
            .take(10)
            .filter(|hit| query.forbidden_external_ids.contains(&hit.external_id))
            .count();
        let deleted_hit_count = candidate_observed
            .iter()
            .filter(|hit| query.deleted_external_ids.contains(&hit.external_id))
            .count();
        let filter_violation_count = candidate_observed
            .iter()
            .filter(|hit| {
                query
                    .allowed_external_ids
                    .as_ref()
                    .is_some_and(|allowed| !allowed.contains(&hit.external_id))
            })
            .count();
        Some((
            expected_first_hit,
            forbidden_hit_count,
            deleted_hit_count,
            filter_violation_count,
        ))
    } else {
        None
    };
    Ok(QueryMetrics {
        lane_id: lane.lane_id,
        query_ordinal: query.ordinal,
        class_or_topic: query.class_or_topic,
        candidate,
        capacity_matched_exact,
        candidate_result_count: candidate_hits.len(),
        candidate_result_digest: candidate_result_digest(candidate_hits),
        raw_candidate_scores: candidate_hits.iter().map(|hit| hit.raw_score).collect(),
        declared_scores: candidate_hits
            .iter()
            .map(|hit| hit.declared_score)
            .collect(),
        candidate_normalized_errors,
        capacity_matched_exact_normalized_errors,
        label_precision_at_10: label_metrics.map(|value| value.0),
        label_mrr_at_10: label_metrics.map(|value| value.1),
        label_ndcg_at_10: label_metrics.map(|value| value.2),
        expected_first_hit: controlled.map(|value| value.0),
        forbidden_hit_count_at_10: controlled.map(|value| value.1),
        deleted_hit_count: controlled.map(|value| value.2),
        filter_violation_count: controlled.map(|value| value.3),
    })
}

fn normalized_score_errors(
    lane: &Lane,
    query: &Query,
    observed: &[SearchHit],
) -> BenchResult<Vec<f64>> {
    let prepared_query = independent_prepare(&query.vector, lane.normalization)?;
    observed
        .iter()
        .map(|hit| {
            let record = lane
                .records
                .iter()
                .find(|record| record.external_id == hit.external_id)
                .ok_or_else(|| "observed-external-id-unknown".to_owned())?;
            let prepared_record = independent_prepare(&record.vector, lane.normalization)?;
            let oracle = independent_score(lane.metric, &prepared_query, &prepared_record)?;
            let error = (hit.score - oracle).abs() / oracle.abs().max(1.0);
            require(error.is_finite(), "normalized-score-error-nonfinite")?;
            Ok(if error == 0.0 { 0.0 } else { error })
        })
        .collect()
}

fn ranking_metrics(
    expected: &[SearchHit],
    observed: &[SearchHit],
    normalized_errors: &[f64],
) -> BenchResult<RankingMetrics> {
    require(
        observed.len() == normalized_errors.len(),
        "normalized-score-error-count-invalid",
    )?;
    let recall_at_1 = recall_at(expected, observed, TOP_K_VALUES[0]);
    let recall_at_10 = recall_at(expected, observed, TOP_K_VALUES[1]);
    let recall_at_100 = recall_at(expected, observed, TOP_K_VALUES[2]);
    let mrr_at_100 = observed
        .iter()
        .take(100)
        .position(|hit| hit.external_id == expected[0].external_id)
        .map_or(0.0, |position| 1.0 / (position + 1) as f64);
    let ndcg_at_100 = rank_ndcg(expected, observed, 100);
    let rank_inversions_at_100 = rank_inversions(expected, observed, 100);
    let expected_ids = expected
        .iter()
        .take(100)
        .map(|hit| hit.external_id)
        .collect::<BTreeSet<_>>();
    let intersected_count = observed
        .iter()
        .take(100)
        .filter(|hit| expected_ids.contains(&hit.external_id))
        .count();
    let inversion_denominator =
        intersected_count.saturating_mul(intersected_count.saturating_sub(1)) / 2;
    let rank_inversion_rate_at_100 = if inversion_denominator == 0 {
        0.0
    } else {
        rank_inversions_at_100 as f64 / inversion_denominator as f64
    };
    let mut seen = BTreeSet::new();
    let duplicate_result_count = observed
        .iter()
        .filter(|hit| !seen.insert(hit.external_id))
        .count();
    let missing_result_count = expected.len().min(100).saturating_sub(observed.len());
    let maximum_absolute_normalized_score_error =
        normalized_errors.iter().copied().fold(0.0_f64, f64::max);
    let mean_absolute_normalized_score_error = if normalized_errors.is_empty() {
        0.0
    } else {
        normalized_errors.iter().sum::<f64>() / normalized_errors.len() as f64
    };
    let p99_absolute_normalized_score_error = if normalized_errors.is_empty() {
        0.0
    } else {
        percentile_99(normalized_errors)?
    };
    Ok(RankingMetrics {
        recall_at_1,
        recall_at_10,
        recall_at_100,
        mrr_at_100,
        ndcg_at_100,
        rank_inversions_at_100,
        rank_inversion_rate_at_100,
        maximum_absolute_normalized_score_error,
        mean_absolute_normalized_score_error,
        p99_absolute_normalized_score_error,
        non_finite_score_count: 0,
        duplicate_result_count,
        missing_result_count,
    })
}

fn percentile_99(values: &[f64]) -> BenchResult<f64> {
    require(!values.is_empty(), "percentile-input-empty")?;
    let mut ordered = values.to_vec();
    require(
        ordered.iter().all(|value| value.is_finite()),
        "percentile-input-nonfinite",
    )?;
    ordered.sort_by(f64::total_cmp);
    let rank = (99_usize
        .checked_mul(ordered.len())
        .ok_or_else(|| "percentile-rank-overflow".to_owned())?
        .saturating_add(99))
        / 100;
    Ok(ordered[rank.saturating_sub(1).min(ordered.len() - 1)])
}

fn recall_at(expected: &[SearchHit], observed: &[SearchHit], limit: usize) -> f64 {
    let expected_count = expected.len().min(limit);
    let expected_ids = expected
        .iter()
        .take(expected_count)
        .map(|hit| hit.external_id)
        .collect::<BTreeSet<_>>();
    let found = observed
        .iter()
        .take(limit)
        .filter(|hit| expected_ids.contains(&hit.external_id))
        .count();
    found as f64 / expected_count as f64
}

fn rank_ndcg(expected: &[SearchHit], observed: &[SearchHit], limit: usize) -> f64 {
    let ranks = expected
        .iter()
        .take(limit)
        .enumerate()
        .map(|(rank, hit)| (hit.external_id, rank))
        .collect::<BTreeMap<_, _>>();
    let gain = |rank: usize| 1.0 / (rank + 1) as f64;
    let ideal = (0..ranks.len())
        .map(|position| gain(position) / ((position + 2) as f64).log2())
        .sum::<f64>();
    let dcg = observed
        .iter()
        .take(limit)
        .enumerate()
        .filter_map(|(position, hit)| {
            ranks
                .get(&hit.external_id)
                .map(|rank| gain(*rank) / ((position + 2) as f64).log2())
        })
        .sum::<f64>();
    if ideal == 0.0 {
        0.0
    } else {
        dcg / ideal
    }
}

fn rank_inversions(expected: &[SearchHit], observed: &[SearchHit], limit: usize) -> usize {
    let expected_ranks = expected
        .iter()
        .take(limit)
        .enumerate()
        .map(|(rank, hit)| (hit.external_id, rank))
        .collect::<BTreeMap<_, _>>();
    let observed_ranks = observed
        .iter()
        .take(limit)
        .filter_map(|hit| expected_ranks.get(&hit.external_id).copied())
        .collect::<Vec<_>>();
    let mut inversions = 0;
    for left in 0..observed_ranks.len() {
        for right in left + 1..observed_ranks.len() {
            if observed_ranks[left] > observed_ranks[right] {
                inversions += 1;
            }
        }
    }
    inversions
}

fn aggregate_ranking(
    metrics: &[QueryMetrics],
    arm: ComparisonArm,
) -> BenchResult<RankingAggregate> {
    require(!metrics.is_empty(), "ranking-aggregate-empty")?;
    let mut errors = Vec::new();
    for value in metrics {
        errors.extend_from_slice(match arm {
            ComparisonArm::Candidate => &value.candidate_normalized_errors,
            ComparisonArm::CapacityMatchedExact => &value.capacity_matched_exact_normalized_errors,
        });
    }
    let mean_error = if errors.is_empty() {
        0.0
    } else {
        errors.iter().sum::<f64>() / errors.len() as f64
    };
    let p99_error = if errors.is_empty() {
        0.0
    } else {
        percentile_99(&errors)?
    };
    Ok(RankingAggregate {
        minimum_recall_at_1: metrics
            .iter()
            .map(|value| ranking_for_arm(value, arm).recall_at_1)
            .fold(1.0_f64, f64::min),
        minimum_recall_at_10: metrics
            .iter()
            .map(|value| ranking_for_arm(value, arm).recall_at_10)
            .fold(1.0_f64, f64::min),
        minimum_recall_at_100: metrics
            .iter()
            .map(|value| ranking_for_arm(value, arm).recall_at_100)
            .fold(1.0_f64, f64::min),
        minimum_mrr_at_100: metrics
            .iter()
            .map(|value| ranking_for_arm(value, arm).mrr_at_100)
            .fold(1.0_f64, f64::min),
        minimum_ndcg_at_100: metrics
            .iter()
            .map(|value| ranking_for_arm(value, arm).ndcg_at_100)
            .fold(1.0_f64, f64::min),
        maximum_rank_inversion_rate_at_100: metrics
            .iter()
            .map(|value| ranking_for_arm(value, arm).rank_inversion_rate_at_100)
            .fold(0.0_f64, f64::max),
        total_rank_inversions_at_100: metrics
            .iter()
            .map(|value| ranking_for_arm(value, arm).rank_inversions_at_100)
            .sum(),
        maximum_absolute_normalized_score_error: errors.iter().copied().fold(0.0_f64, f64::max),
        mean_absolute_normalized_score_error: mean_error,
        p99_absolute_normalized_score_error: p99_error,
        non_finite_score_count: metrics
            .iter()
            .map(|value| ranking_for_arm(value, arm).non_finite_score_count)
            .sum(),
        duplicate_result_count: metrics
            .iter()
            .map(|value| ranking_for_arm(value, arm).duplicate_result_count)
            .sum(),
        missing_result_count: metrics
            .iter()
            .map(|value| ranking_for_arm(value, arm).missing_result_count)
            .sum(),
    })
}

fn ranking_for_arm(value: &QueryMetrics, arm: ComparisonArm) -> &RankingMetrics {
    match arm {
        ComparisonArm::Candidate => &value.candidate,
        ComparisonArm::CapacityMatchedExact => &value.capacity_matched_exact,
    }
}

fn aggregate_natural_utility(metrics: &[QueryMetrics]) -> BenchResult<NaturalUtility> {
    let mut coverage = [0_usize; NATURAL_CLASS_COUNT];
    let mut precision = [0.0_f64; NATURAL_CLASS_COUNT];
    let mut mrr = [0.0_f64; NATURAL_CLASS_COUNT];
    let mut ndcg = [0.0_f64; NATURAL_CLASS_COUNT];
    for value in metrics {
        let class = value.class_or_topic;
        require(class < NATURAL_CLASS_COUNT, "natural-class-out-of-range")?;
        coverage[class] += 1;
        precision[class] += value
            .label_precision_at_10
            .ok_or_else(|| "natural-precision-missing".to_owned())?;
        mrr[class] += value
            .label_mrr_at_10
            .ok_or_else(|| "natural-mrr-missing".to_owned())?;
        ndcg[class] += value
            .label_ndcg_at_10
            .ok_or_else(|| "natural-ndcg-missing".to_owned())?;
    }
    require(
        coverage
            .iter()
            .all(|count| *count == NATURAL_QUERIES_PER_CLASS),
        "natural-class-coverage-invalid",
    )?;
    for class in 0..NATURAL_CLASS_COUNT {
        precision[class] /= coverage[class] as f64;
        mrr[class] /= coverage[class] as f64;
        ndcg[class] /= coverage[class] as f64;
    }
    Ok(NaturalUtility {
        macro_label_precision_at_10: precision.iter().sum::<f64>() / NATURAL_CLASS_COUNT as f64,
        macro_label_mrr_at_10: mrr.iter().sum::<f64>() / NATURAL_CLASS_COUNT as f64,
        macro_label_ndcg_at_10: ndcg.iter().sum::<f64>() / NATURAL_CLASS_COUNT as f64,
        per_class_query_coverage: coverage.to_vec(),
    })
}

fn aggregate_controlled_utility(metrics: &[QueryMetrics]) -> BenchResult<ControlledUtility> {
    let expected_hits = metrics
        .iter()
        .map(|value| {
            value
                .expected_first_hit
                .ok_or_else(|| "controlled-expected-hit-missing".to_owned())
        })
        .collect::<BenchResult<Vec<_>>>()?
        .into_iter()
        .filter(|value| *value)
        .count();
    let forbidden = metrics
        .iter()
        .map(|value| {
            value
                .forbidden_hit_count_at_10
                .ok_or_else(|| "controlled-forbidden-count-missing".to_owned())
        })
        .collect::<BenchResult<Vec<_>>>()?
        .into_iter()
        .sum::<usize>();
    let deleted = metrics
        .iter()
        .map(|value| {
            value
                .deleted_hit_count
                .ok_or_else(|| "controlled-deleted-count-missing".to_owned())
        })
        .collect::<BenchResult<Vec<_>>>()?
        .into_iter()
        .sum::<usize>();
    let filter = metrics
        .iter()
        .map(|value| {
            value
                .filter_violation_count
                .ok_or_else(|| "controlled-filter-count-missing".to_owned())
        })
        .collect::<BenchResult<Vec<_>>>()?
        .into_iter()
        .sum::<usize>();
    Ok(ControlledUtility {
        expected_first_hit_rate: expected_hits as f64 / metrics.len() as f64,
        forbidden_hit_rate_at_10: forbidden as f64 / (metrics.len() * 10) as f64,
        deleted_hit_count: deleted,
        filter_violation_count: filter,
    })
}

fn quality_json(
    selection_sha256: &str,
    lane_results: &[LaneResult],
    per_query: &[QueryMetrics],
) -> String {
    let mut output = format!(
        "{{\"schema\":\"{QUALITY_SCHEMA}\",\"experimentId\":\"{EXPERIMENT_ID}\",\
         \"methodId\":\"{METHOD_ID}\",\"bitWidth\":{BIT_WIDTH},\
         \"qualityProcessOrdinal\":1,\"datasetName\":\"Fashion-MNIST\",\
         \"datasetRevision\":\"{DATASET_REVISION}\",\
         \"selectionAlgorithm\":\"sha256-seed-split-label-index-smallest-v1\",\
         \"selectionSha256\":\"{selection_sha256}\",\"topKValues\":[1,10,100],\
         \"laneResults\":["
    );
    for (index, result) in lane_results.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }
        output.push_str(&lane_result_json(result));
    }
    output.push_str("],\"perQueryMetrics\":[");
    for (index, result) in per_query.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }
        output.push_str(&query_metrics_json(result));
    }
    output.push_str("]}");
    output
}

fn lane_result_json(value: &LaneResult) -> String {
    let natural = value
        .natural_utility
        .as_ref()
        .map_or_else(|| "null".to_owned(), natural_utility_json);
    let controlled = value
        .controlled_utility
        .as_ref()
        .map_or_else(|| "null".to_owned(), controlled_utility_json);
    let same_corpus = ranking_aggregate_json(&value.same_corpus);
    let capacity = ranking_aggregate_json(&value.capacity_matched_exact);
    format!(
        "{{\"laneId\":\"{}\",\"laneKind\":\"{}\",\"metric\":\"{}\",\
         \"normalization\":\"{}\",\"originalDimension\":{},\"encodedDimension\":{},\
         \"declaredRecordCount\":{},\"sourceActiveRecordCount\":{},\
         \"candidateRecordCount\":{},\"queryCount\":{},\"topKValues\":[1,10,100],\
         \"candidateDynamicIndexBytes\":{},\"candidateFormulaBytes\":{},\
         \"exactFullIndexBytes\":{},\"capacityMatchedExactRecordCount\":{},\
         \"capacityMatchedExactIndexBytes\":{},\
         \"effectiveBitsPerOriginalCoordinate\":{},\
         \"persistentRatioToFullExact\":{},\"firstBuildSha256\":\"{}\",\
         \"secondBuildSha256\":\"{}\",\"deterministicBuildBytesMatch\":{},\
         \"deterministicSearchOutputsMatch\":{},\"reloadSearchOutputsMatch\":{},\
         \"sameCorpus\":{},\"capacityMatchedExact\":{},\"naturalUtility\":{},\
         \"controlledUtility\":{}}}",
        value.lane_id,
        value.lane_kind.label(),
        metric_label(value.metric),
        normalization_label(value.normalization),
        value.original_dimension,
        value.encoded_dimension,
        value.declared_record_count,
        value.source_active_record_count,
        value.candidate_record_count,
        value.query_count,
        value.candidate_dynamic_index_bytes,
        value.candidate_formula_bytes,
        value.exact_full_index_bytes,
        value.capacity_matched_exact_record_count,
        value.capacity_matched_exact_index_bytes,
        json_f64(value.effective_bits_per_original_coordinate),
        json_f64(value.persistent_ratio_to_full_exact),
        value.first_build_sha256,
        value.second_build_sha256,
        value.deterministic_build_bytes_match,
        value.deterministic_search_outputs_match,
        value.reload_search_outputs_match,
        same_corpus,
        capacity,
        natural,
        controlled
    )
}

fn ranking_aggregate_json(value: &RankingAggregate) -> String {
    format!(
        "{{\"minimumRecallAt1\":{},\"minimumRecallAt10\":{},\
         \"minimumRecallAt100\":{},\"minimumMrrAt100\":{},\
         \"minimumNdcgAt100\":{},\"maximumRankInversionRateAt100\":{},\
         \"totalRankInversionsAt100\":{},\
         \"maximumAbsoluteNormalizedScoreError\":{},\
         \"meanAbsoluteNormalizedScoreError\":{},\
         \"p99AbsoluteNormalizedScoreError\":{},\"nonFiniteScoreCount\":{},\
         \"duplicateResultCount\":{},\"missingResultCount\":{}}}",
        json_f64(value.minimum_recall_at_1),
        json_f64(value.minimum_recall_at_10),
        json_f64(value.minimum_recall_at_100),
        json_f64(value.minimum_mrr_at_100),
        json_f64(value.minimum_ndcg_at_100),
        json_f64(value.maximum_rank_inversion_rate_at_100),
        value.total_rank_inversions_at_100,
        json_f64(value.maximum_absolute_normalized_score_error),
        json_f64(value.mean_absolute_normalized_score_error),
        json_f64(value.p99_absolute_normalized_score_error),
        value.non_finite_score_count,
        value.duplicate_result_count,
        value.missing_result_count
    )
}

fn natural_utility_json(value: &NaturalUtility) -> String {
    format!(
        "{{\"macroLabelPrecisionAt10\":{},\"macroLabelMrrAt10\":{},\
         \"macroLabelNdcgAt10\":{},\"perClassQueryCoverage\":[{}]}}",
        json_f64(value.macro_label_precision_at_10),
        json_f64(value.macro_label_mrr_at_10),
        json_f64(value.macro_label_ndcg_at_10),
        value
            .per_class_query_coverage
            .iter()
            .map(usize::to_string)
            .collect::<Vec<_>>()
            .join(",")
    )
}

fn controlled_utility_json(value: &ControlledUtility) -> String {
    format!(
        "{{\"expectedFirstHitRate\":{},\"forbiddenHitRateAt10\":{},\
         \"deletedHitCount\":{},\"filterViolationCount\":{}}}",
        json_f64(value.expected_first_hit_rate),
        json_f64(value.forbidden_hit_rate_at_10),
        value.deleted_hit_count,
        value.filter_violation_count
    )
}

fn query_metrics_json(value: &QueryMetrics) -> String {
    format!(
        "{{\"laneId\":\"{}\",\"queryOrdinal\":{},\"classOrTopic\":{},\
         \"candidate\":{},\"capacityMatchedExact\":{},\
         \"candidateResultCount\":{},\"candidateResultDigest\":\"{}\",\
         \"rawCandidateScores\":[{}],\"declaredScores\":[{}],\
         \"candidateAbsoluteNormalizedScoreErrors\":[{}],\
         \"capacityMatchedExactAbsoluteNormalizedScoreErrors\":[{}],\
         \"labelPrecisionAt10\":{},\"labelMrrAt10\":{},\"labelNdcgAt10\":{},\
         \"expectedFirstHit\":{},\"forbiddenHitCountAt10\":{},\
         \"deletedHitCount\":{},\"filterViolationCount\":{}}}",
        value.lane_id,
        value.query_ordinal,
        value.class_or_topic,
        ranking_metrics_json(&value.candidate),
        ranking_metrics_json(&value.capacity_matched_exact),
        value.candidate_result_count,
        value.candidate_result_digest,
        value
            .raw_candidate_scores
            .iter()
            .map(|score| json_f64(f64::from(*score)))
            .collect::<Vec<_>>()
            .join(","),
        value
            .declared_scores
            .iter()
            .map(|score| json_f64(*score))
            .collect::<Vec<_>>()
            .join(","),
        value
            .candidate_normalized_errors
            .iter()
            .map(|error| json_f64(*error))
            .collect::<Vec<_>>()
            .join(","),
        value
            .capacity_matched_exact_normalized_errors
            .iter()
            .map(|error| json_f64(*error))
            .collect::<Vec<_>>()
            .join(","),
        optional_f64_json(value.label_precision_at_10),
        optional_f64_json(value.label_mrr_at_10),
        optional_f64_json(value.label_ndcg_at_10),
        optional_bool_json(value.expected_first_hit),
        optional_usize_json(value.forbidden_hit_count_at_10),
        optional_usize_json(value.deleted_hit_count),
        optional_usize_json(value.filter_violation_count)
    )
}

fn ranking_metrics_json(value: &RankingMetrics) -> String {
    format!(
        "{{\"recallAt1\":{},\"recallAt10\":{},\"recallAt100\":{},\
         \"mrrAt100\":{},\"ndcgAt100\":{},\"rankInversionsAt100\":{},\
         \"rankInversionRateAt100\":{},\
         \"maximumAbsoluteNormalizedScoreError\":{},\
         \"meanAbsoluteNormalizedScoreError\":{},\
         \"p99AbsoluteNormalizedScoreError\":{},\"nonFiniteScoreCount\":{},\
         \"duplicateResultCount\":{},\"missingResultCount\":{}}}",
        json_f64(value.recall_at_1),
        json_f64(value.recall_at_10),
        json_f64(value.recall_at_100),
        json_f64(value.mrr_at_100),
        json_f64(value.ndcg_at_100),
        value.rank_inversions_at_100,
        json_f64(value.rank_inversion_rate_at_100),
        json_f64(value.maximum_absolute_normalized_score_error),
        json_f64(value.mean_absolute_normalized_score_error),
        json_f64(value.p99_absolute_normalized_score_error),
        value.non_finite_score_count,
        value.duplicate_result_count,
        value.missing_result_count
    )
}

fn run_performance(lane_id: &str, method: &str) -> BenchResult<String> {
    let process_root = validate_process_root()?;
    require_root_contains_only_marker(&process_root)?;
    let memory_monitor_handshake = wait_for_performance_monitor(&process_root)?;
    let lane = load_registered_lane(lane_id)?;
    let result = match method {
        "candidate" => performance_candidate(&lane, &process_root, memory_monitor_handshake)?,
        "exact-full" => performance_exact(&lane, &process_root, memory_monitor_handshake)?,
        _ => return Err("performance-method-invalid".to_owned()),
    };
    Ok(performance_json(&result))
}

fn performance_candidate(
    lane: &Lane,
    root: &Path,
    memory_monitor_handshake: bool,
) -> BenchResult<PerformanceResult> {
    let build_start = Instant::now();
    let (index, encoded_dimension, record_count) = construct_candidate_index(lane)?;
    let build_nanoseconds = build_start.elapsed().as_nanos();

    let serialization_start = Instant::now();
    let expected_bytes = candidate_tvim_bytes(record_count, encoded_dimension)?;
    let (snapshot_path, snapshot_bytes, snapshot_sha256) =
        persist_candidate_snapshot(&index, root, lane.lane_id, "performance", expected_bytes)?;
    let serialization_nanoseconds = serialization_start.elapsed().as_nanos();
    drop(index);

    let load_start = Instant::now();
    let loaded = verified_load_tvim(&snapshot_path, snapshot_bytes.len(), &snapshot_sha256)?;
    let load_nanoseconds = load_start.elapsed().as_nanos();
    let mut digest_material = Vec::new();

    let cold_start = Instant::now();
    let cold = candidate_search(&loaded, lane, &lane.queries[0])?;
    let cold_first_query_nanoseconds = cold_start.elapsed().as_nanos();
    append_candidate_hits(&mut digest_material, &cold);
    post_prepare_monitor_barrier(root, memory_monitor_handshake)?;

    for _ in 0..PERFORMANCE_WARMUP_PASSES {
        for query in &lane.queries {
            append_candidate_hits(
                &mut digest_material,
                &candidate_search(&loaded, lane, query)?,
            );
        }
    }
    let mut measured_query_nanoseconds =
        Vec::with_capacity(PERFORMANCE_MEASURED_PASSES * lane.queries.len());
    for _ in 0..PERFORMANCE_MEASURED_PASSES {
        for query in &lane.queries {
            let start = Instant::now();
            let hits = candidate_search(&loaded, lane, query)?;
            measured_query_nanoseconds.push(start.elapsed().as_nanos());
            append_candidate_hits(&mut digest_material, &hits);
        }
    }
    Ok(PerformanceResult {
        lane_id: lane.lane_id,
        method: "candidate",
        original_dimension: lane.dimension,
        encoded_dimension,
        record_count,
        query_count: lane.queries.len(),
        build_nanoseconds,
        serialization_nanoseconds,
        load_nanoseconds,
        prepare_nanoseconds: 0,
        cold_first_query_nanoseconds,
        measured_query_nanoseconds,
        persistent_bytes: snapshot_bytes.len(),
        query_result_digest: hex(&sha256(&digest_material)),
        memory_monitor_handshake,
    })
}

fn performance_exact(
    lane: &Lane,
    root: &Path,
    memory_monitor_handshake: bool,
) -> BenchResult<PerformanceResult> {
    let build_start = Instant::now();
    let index = build_index(
        lane.lane_id,
        lane.metric,
        lane.normalization,
        lane.dimension,
        &lane.records,
    )?;
    let build_nanoseconds = build_start.elapsed().as_nanos();

    let serialization_start = Instant::now();
    let snapshot = index
        .to_bytes()
        .map_err(|_| "performance-exact-serialize-failed".to_owned())?;
    let snapshot_sha256 = hex(&sha256(&snapshot));
    let temporary_path = root.join(format!(
        "snapshot-performance-{}-exact.trflat.tmp",
        lane.lane_id
    ));
    let final_path = root.join(format!(
        "snapshot-performance-{}-exact-{snapshot_sha256}.trflat",
        lane.lane_id
    ));
    write_synced_new_file(&temporary_path, &snapshot)?;
    fs::rename(&temporary_path, &final_path)
        .map_err(|_| "performance-exact-finalize-failed".to_owned())?;
    let _ = sync_directory(root);
    validate_reopened_bytes(&final_path, &snapshot, "performance-exact-reopen-failed")?;
    let serialization_nanoseconds = serialization_start.elapsed().as_nanos();
    drop(index);

    let load_start = Instant::now();
    let loaded_bytes = read_bounded(
        &final_path,
        MAX_MANAGED_FILE_BYTES,
        "performance-exact-read-failed",
    )?;
    require(
        loaded_bytes.len() == snapshot.len() && hex(&sha256(&loaded_bytes)) == snapshot_sha256,
        "performance-exact-digest-mismatch",
    )?;
    let loaded = ExactFlatIndex::from_bytes(&loaded_bytes)
        .map_err(|_| "performance-exact-load-failed".to_owned())?;
    let load_nanoseconds = load_start.elapsed().as_nanos();
    let mut digest_material = Vec::new();

    let cold_start = Instant::now();
    let cold = loaded
        .search(
            &lane.queries[0].vector,
            TOP_K_VALUES[2],
            lane.queries[0].allowed_external_ids.as_ref(),
        )
        .map_err(|_| "performance-exact-search-failed".to_owned())?;
    let cold_first_query_nanoseconds = cold_start.elapsed().as_nanos();
    append_search_hits(&mut digest_material, &cold);
    post_prepare_monitor_barrier(root, memory_monitor_handshake)?;

    for _ in 0..PERFORMANCE_WARMUP_PASSES {
        for query in &lane.queries {
            let hits = loaded
                .search(
                    &query.vector,
                    TOP_K_VALUES[2],
                    query.allowed_external_ids.as_ref(),
                )
                .map_err(|_| "performance-exact-search-failed".to_owned())?;
            append_search_hits(&mut digest_material, &hits);
        }
    }
    let mut measured_query_nanoseconds =
        Vec::with_capacity(PERFORMANCE_MEASURED_PASSES * lane.queries.len());
    for _ in 0..PERFORMANCE_MEASURED_PASSES {
        for query in &lane.queries {
            let start = Instant::now();
            let hits = loaded
                .search(
                    &query.vector,
                    TOP_K_VALUES[2],
                    query.allowed_external_ids.as_ref(),
                )
                .map_err(|_| "performance-exact-search-failed".to_owned())?;
            measured_query_nanoseconds.push(start.elapsed().as_nanos());
            append_search_hits(&mut digest_material, &hits);
        }
    }
    Ok(PerformanceResult {
        lane_id: lane.lane_id,
        method: "exact-full",
        original_dimension: lane.dimension,
        encoded_dimension: lane.dimension,
        record_count: loaded.active_record_count(),
        query_count: lane.queries.len(),
        build_nanoseconds,
        serialization_nanoseconds,
        load_nanoseconds,
        prepare_nanoseconds: 0,
        cold_first_query_nanoseconds,
        measured_query_nanoseconds,
        persistent_bytes: snapshot.len(),
        query_result_digest: hex(&sha256(&digest_material)),
        memory_monitor_handshake,
    })
}

fn wait_for_performance_monitor(root: &Path) -> BenchResult<bool> {
    let required = env::var("TINYRUSTLM_PERFORMANCE_MONITOR_REQUIRED")
        .map(|value| value == "1")
        .unwrap_or(false);
    if !required {
        return Ok(false);
    }
    write_synced_new_file(&root.join(PERFORMANCE_MONITOR_REQUEST), b"ready\n")
        .map_err(|_| "performance-monitor-request-write-failed".to_owned())?;
    wait_for_file(
        &root.join(PERFORMANCE_MONITOR_READY),
        "performance-monitor-ready-timeout",
    )?;
    Ok(true)
}

fn post_prepare_monitor_barrier(root: &Path, required: bool) -> BenchResult<()> {
    if !required {
        return Ok(());
    }
    write_synced_new_file(&root.join(PERFORMANCE_POST_PREPARE), b"ready\n")
        .map_err(|_| "performance-post-prepare-write-failed".to_owned())?;
    wait_for_file(
        &root.join(PERFORMANCE_POST_PREPARE_ACK),
        "performance-post-prepare-ack-timeout",
    )
}

fn wait_for_file(path: &Path, timeout_code: &'static str) -> BenchResult<()> {
    let start = Instant::now();
    loop {
        if path
            .try_exists()
            .map_err(|_| "performance-monitor-marker-check-failed".to_owned())?
        {
            let metadata = fs::symlink_metadata(path)
                .map_err(|_| "performance-monitor-marker-metadata-failed".to_owned())?;
            require(
                metadata.file_type().is_file() && !metadata.file_type().is_symlink(),
                "performance-monitor-marker-invalid",
            )?;
            return Ok(());
        }
        if start.elapsed().as_millis() >= PERFORMANCE_MONITOR_WAIT_MILLISECONDS {
            return Err(timeout_code.to_owned());
        }
        std::thread::sleep(std::time::Duration::from_millis(5));
    }
}

fn append_candidate_hits(output: &mut Vec<u8>, hits: &[CandidateHit]) {
    for hit in hits {
        output.extend_from_slice(&hit.external_id.to_le_bytes());
        output.extend_from_slice(&hit.raw_score.to_bits().to_le_bytes());
        output.extend_from_slice(&hit.declared_score.to_bits().to_le_bytes());
    }
}

fn candidate_result_digest(hits: &[CandidateHit]) -> String {
    let mut material = b"tinyrustlm.turbovec-reference.candidate-ranking.v1\0".to_vec();
    material.extend_from_slice(&(hits.len() as u64).to_le_bytes());
    append_candidate_hits(&mut material, hits);
    hex(&sha256(&material))
}

fn append_search_hits(output: &mut Vec<u8>, hits: &[SearchHit]) {
    for hit in hits {
        output.extend_from_slice(&hit.external_id.to_le_bytes());
        output.extend_from_slice(&hit.score.to_bits().to_le_bytes());
    }
}

fn performance_json(value: &PerformanceResult) -> String {
    format!(
        "{{\"schema\":\"{PERFORMANCE_SCHEMA}\",\"experimentId\":\"{EXPERIMENT_ID}\",\
         \"methodId\":\"{METHOD_ID}\",\"laneId\":\"{}\",\"method\":\"{}\",\
         \"originalDimension\":{},\"encodedDimension\":{},\"recordCount\":{},\
         \"queryCount\":{},\"warmupFullQueryPasses\":{},\
         \"measuredFullQueryPasses\":{},\"buildNanoseconds\":{},\
         \"serializationNanoseconds\":{},\"loadNanoseconds\":{},\
         \"explicitPrepareNanoseconds\":{},\
         \"prepareCalledBeforeColdFirstQuery\":false,\
         \"candidatePrepareIncludedInColdFirstQuery\":{},\
         \"coldFirstQueryNanoseconds\":{},\
         \"measuredQueryNanoseconds\":[{}],\"persistentBytes\":{},\
         \"queryResultDigest\":\"{}\",\"memoryMonitorHandshake\":{}}}",
        value.lane_id,
        value.method,
        value.original_dimension,
        value.encoded_dimension,
        value.record_count,
        value.query_count,
        PERFORMANCE_WARMUP_PASSES,
        PERFORMANCE_MEASURED_PASSES,
        value.build_nanoseconds,
        value.serialization_nanoseconds,
        value.load_nanoseconds,
        value.prepare_nanoseconds,
        value.method == "candidate",
        value.cold_first_query_nanoseconds,
        value
            .measured_query_nanoseconds
            .iter()
            .map(u128::to_string)
            .collect::<Vec<_>>()
            .join(","),
        value.persistent_bytes,
        value.query_result_digest,
        value.memory_monitor_handshake
    )
}

fn run_corruption(case: CorruptionCase) -> BenchResult<CorruptionResult> {
    let root = validate_owned_root()?;
    run_corruption_at_root(&root, case)
}

fn run_corruption_at_root(root: &Path, case: CorruptionCase) -> BenchResult<CorruptionResult> {
    require_root_contains_only_marker(root)?;
    let initial = durable_initial_index()?;
    let write = write_generation(root, 1, &initial, None)?;
    require(
        !write.boundary_reached,
        "corruption-fixture-write-incomplete",
    )?;
    let active = recover_active_generation(root)?;
    let snapshot_path = root.join(&active.snapshot_name);
    let commit_path = root.join(&active.commit_name);
    UPSTREAM_LOAD_ATTEMPTS.store(0, Ordering::SeqCst);

    if case == CorruptionCase::CommitHashMismatch {
        let mut bytes = read_bounded(
            &commit_path,
            MAX_MANAGED_FILE_BYTES,
            "corruption-commit-read-failed",
        )?;
        let position = bytes
            .iter()
            .rposition(|byte| byte.is_ascii_hexdigit())
            .ok_or_else(|| "corruption-commit-hash-missing".to_owned())?;
        bytes[position] = if bytes[position] == b'0' { b'1' } else { b'0' };
        rewrite_existing_synced(&commit_path, &bytes)?;
    } else {
        let mut bytes = read_bounded(
            &snapshot_path,
            MAX_MANAGED_FILE_BYTES,
            "corruption-snapshot-read-failed",
        )?;
        let code_start = 14;
        let code_bytes = active
            .index
            .len()
            .checked_mul(active.index.dim())
            .and_then(|value| value.checked_mul(BIT_WIDTH))
            .ok_or_else(|| "corruption-offset-overflow".to_owned())?
            / 8;
        let scale_start = code_start + code_bytes;
        let id_start =
            TVIM_FIXED_BYTES + code_bytes + active.index.len() * 4 + active.index.dim() * 8;
        match case {
            CorruptionCase::HeaderBitFlip => bytes[0] ^= 0x01,
            CorruptionCase::PackedCodeBitFlip => bytes[code_start] ^= 0x01,
            CorruptionCase::ScaleBitFlip => bytes[scale_start] ^= 0x01,
            CorruptionCase::IdBitFlip => bytes[id_start] ^= 0x01,
            CorruptionCase::TruncateOneByte => {
                bytes.pop();
            }
            CorruptionCase::AppendOneByte => bytes.push(0xa5),
            CorruptionCase::CommitHashMismatch => unreachable!("handled above"),
        }
        rewrite_existing_synced(&snapshot_path, &bytes)?;
    }

    let rejection = recover_active_generation(root);
    let upstream_load_attempt_count = UPSTREAM_LOAD_ATTEMPTS.load(Ordering::SeqCst);
    let (rejected, bounded_error_code) = match rejection {
        Ok(_) => (false, "corruption-unexpectedly-accepted".to_owned()),
        Err(code) => (true, code),
    };
    Ok(CorruptionResult {
        case,
        rejected,
        rejected_before_upstream_load: rejected && upstream_load_attempt_count == 0,
        upstream_load_attempt_count,
        bounded_error_code,
    })
}

fn rewrite_existing_synced(path: &Path, bytes: &[u8]) -> BenchResult<()> {
    let metadata =
        fs::symlink_metadata(path).map_err(|_| "corruption-target-metadata-failed".to_owned())?;
    require(
        metadata.file_type().is_file() && !metadata.file_type().is_symlink(),
        "corruption-target-invalid",
    )?;
    let mut file = OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(path)
        .map_err(|_| "corruption-target-open-failed".to_owned())?;
    file.write_all(bytes)
        .map_err(|_| "corruption-target-write-failed".to_owned())?;
    file.flush()
        .map_err(|_| "corruption-target-flush-failed".to_owned())?;
    file.sync_all()
        .map_err(|_| "corruption-target-sync-failed".to_owned())
}

fn corruption_json(value: &CorruptionResult) -> String {
    format!(
        "{{\"schema\":\"{CORRUPTION_SCHEMA}\",\"experimentId\":\"{EXPERIMENT_ID}\",\
         \"caseId\":\"{}\",\"rejected\":{},\"rejectedBeforeUpstreamLoad\":{},\
         \"upstreamLoadAttemptCount\":{},\"boundedErrorCode\":\"{}\",\
         \"panicObserved\":false}}",
        value.case.case_id(),
        value.rejected,
        value.rejected_before_upstream_load,
        value.upstream_load_attempt_count,
        value.bounded_error_code
    )
}

fn run_crash(scenario: StopBoundary) -> BenchResult<Option<String>> {
    let root = validate_owned_root()?;
    require_root_contains_only_marker(&root)?;
    let initial = durable_initial_index()?;
    let initial_write = write_generation(&root, 1, &initial, None)?;
    require(
        !initial_write.boundary_reached,
        "initial-generation-write-incomplete",
    )?;
    let compacted = durable_compacted_index()?;
    let generation_two = write_generation(&root, 2, &compacted, Some(scenario))?;
    require(
        generation_two.boundary_reached,
        "registered-crash-boundary-not-reached",
    )?;
    process::exit(PROCESS_CRASH_EXIT_CODE);
}

fn run_recovery(scenario: StopBoundary) -> BenchResult<RecoveryResult> {
    let root = validate_owned_root()?;
    run_recovery_at_root(&root, scenario)
}

fn run_recovery_at_root(root: &Path, scenario: StopBoundary) -> BenchResult<RecoveryResult> {
    let observed = recover_active_generation(root)?;
    require(
        observed.generation == scenario.expected_active_generation(),
        "recovered-generation-before-retry-invalid",
    )?;
    let deletion_committed_before_retry = observed.generation == 2;
    if observed.generation == 1 {
        require(
            durable_target_ids()
                .iter()
                .all(|external_id| observed.index.contains(*external_id)),
            "uncommitted-deletion-changed-active-index",
        )?;
    } else {
        require(
            durable_target_ids()
                .iter()
                .all(|external_id| !observed.index.contains(*external_id)),
            "committed-deletion-retained-target",
        )?;
    }

    let (first_retry, write_flush_attempts, write_flush_successes) =
        ensure_generation_two(root, &observed)?;
    let after_first_retry = recover_active_generation(root)?;
    require(
        after_first_retry.generation == 2,
        "generation-two-recovery-failed",
    )?;
    let (second_retry, second_flush_attempts, second_flush_successes) =
        ensure_generation_two(root, &after_first_retry)?;
    let after_second_retry = recover_active_generation(root)?;
    require(
        after_second_retry.generation == 2
            && after_second_retry.snapshot_sha256 == after_first_retry.snapshot_sha256
            && after_second_retry.snapshot_bytes == after_first_retry.snapshot_bytes
            && after_second_retry.commit_sha256 == after_first_retry.commit_sha256
            && !second_retry,
        "deletion-retry-not-idempotent",
    )?;

    let removed_managed_file_count = cleanup_to_active(root, &after_second_retry)?;
    let final_active = recover_active_generation(root)?;
    let targets = durable_target_material()?;
    let (identifier_matches, fingerprint_matches) = scan_managed_files(root, &targets)?;
    let active_contains_deleted = targets
        .iter()
        .any(|target| final_active.index.contains(target.external_id));
    let deleted_target_search_matches =
        search_matches_for_deleted_targets(&final_active.index, &targets)?;
    require(
        identifier_matches == 0
            && fingerprint_matches == 0
            && !active_contains_deleted
            && deleted_target_search_matches == 0,
        "final-deletion-scan-failed",
    )?;
    let directory_probe = sync_directory(root);
    Ok(RecoveryResult {
        scenario,
        observed_generation_before_retry: observed.generation,
        deletion_committed_before_retry,
        final_generation: final_active.generation,
        retry_wrote_generation_two: first_retry,
        retry_idempotent: true,
        final_target_identifier_matches: identifier_matches,
        final_target_vector_fingerprint_matches: fingerprint_matches,
        active_index_contains_deleted_target: active_contains_deleted,
        deleted_target_search_matches,
        removed_managed_file_count,
        directory_flush_attempted: true,
        directory_flush_succeeded: directory_probe
            && write_flush_attempts + second_flush_attempts
                == write_flush_successes + second_flush_successes,
        final_snapshot_sha256: final_active.snapshot_sha256,
        final_commit_sha256: final_active.commit_sha256,
    })
}

fn recovery_json(value: &RecoveryResult) -> String {
    format!(
        "{{\"schema\":\"{RECOVERY_SCHEMA}\",\"experimentId\":\"{EXPERIMENT_ID}\",\
         \"scenarioId\":\"{}\",\"processCrashExitCode\":{},\
         \"expectedActiveGenerationBeforeRetry\":{},\
         \"observedActiveGenerationBeforeRetry\":{},\
         \"deletionCommittedBeforeRetry\":{},\"finalActiveGeneration\":{},\
         \"retryWroteGenerationTwo\":{},\"retryIdempotent\":{},\
         \"finalTargetIdentifierMatches\":{},\
         \"finalTargetVectorFingerprintMatches\":{},\
         \"activeIndexContainsDeletedTarget\":{},\
         \"deletedTargetSearchMatches\":{},\
         \"allCrashScenariosMustRecover\":true,\"powerLossSimulated\":false,\
         \"filesystemForensicErasureTested\":false,\
         \"removedManagedFileCount\":{},\"directoryFlushAttempted\":{},\
         \"directoryFlushSucceeded\":{},\"finalSnapshotSha256\":\"{}\",\
         \"finalCommitSha256\":\"{}\"}}",
        value.scenario.scenario_id(),
        PROCESS_CRASH_EXIT_CODE,
        value.scenario.expected_active_generation(),
        value.observed_generation_before_retry,
        value.deletion_committed_before_retry,
        value.final_generation,
        value.retry_wrote_generation_two,
        value.retry_idempotent,
        value.final_target_identifier_matches,
        value.final_target_vector_fingerprint_matches,
        value.active_index_contains_deleted_target,
        value.deleted_target_search_matches,
        value.removed_managed_file_count,
        value.directory_flush_attempted,
        value.directory_flush_succeeded,
        value.final_snapshot_sha256,
        value.final_commit_sha256
    )
}

fn validate_owned_root() -> BenchResult<PathBuf> {
    let current = env::current_dir().map_err(|_| "owned-root-current-dir-failed".to_owned())?;
    validate_owned_root_path(&current)
}

fn validate_process_root() -> BenchResult<PathBuf> {
    let configured = env::var_os("TINYRUSTLM_TURBOVEC_PROCESS_ROOT")
        .ok_or_else(|| "process-root-environment-missing".to_owned())?;
    validate_owned_root_path(Path::new(&configured))
}

fn validate_owned_root_path(path: &Path) -> BenchResult<PathBuf> {
    let root = fs::canonicalize(path).map_err(|_| "owned-root-canonicalize-failed".to_owned())?;
    let marker = root.join(OWNED_ROOT_MARKER);
    let metadata =
        fs::symlink_metadata(&marker).map_err(|_| "owned-root-marker-missing".to_owned())?;
    require(
        metadata.file_type().is_file() && !metadata.file_type().is_symlink(),
        "owned-root-marker-invalid",
    )?;
    let bytes = read_bounded(&marker, 1024, "owned-root-marker-read-failed")?;
    require(
        bytes == OWNED_ROOT_MARKER_BYTES,
        "owned-root-marker-invalid",
    )?;
    Ok(root)
}

fn require_root_contains_only_marker(root: &Path) -> BenchResult<()> {
    let names = managed_entries(root)?;
    require(
        names == vec![OWNED_ROOT_MARKER.to_owned()],
        "owned-root-not-empty",
    )
}

fn managed_entries(root: &Path) -> BenchResult<Vec<String>> {
    let mut names = Vec::new();
    for entry in fs::read_dir(root).map_err(|_| "managed-root-read-failed".to_owned())? {
        let entry = entry.map_err(|_| "managed-root-entry-failed".to_owned())?;
        let metadata = entry
            .file_type()
            .map_err(|_| "managed-root-entry-metadata-failed".to_owned())?;
        require(
            metadata.is_file() && !metadata.is_symlink(),
            "managed-root-nonregular-entry",
        )?;
        let name = entry
            .file_name()
            .into_string()
            .map_err(|_| "managed-root-nonutf8-name".to_owned())?;
        require(is_managed_name(&name), "managed-root-unknown-entry")?;
        names.push(name);
    }
    names.sort();
    Ok(names)
}

fn is_managed_name(name: &str) -> bool {
    name == OWNED_ROOT_MARKER
        || name.starts_with("snapshot-") && (name.ends_with(".tvim") || name.ends_with(".tvim.tmp"))
        || name.starts_with("commit-") && (name.ends_with(".json") || name.ends_with(".json.tmp"))
}

fn durable_initial_index() -> BenchResult<IdMapIndex> {
    let records = durable_records()?;
    let mut records = records.iter().collect::<Vec<_>>();
    records.sort_by_key(|record| record.external_id);
    let mut vectors = Vec::with_capacity(records.len() * DURABLE_DIMENSION);
    let mut ids = Vec::with_capacity(records.len());
    for record in &records {
        ids.push(record.external_id);
        vectors.extend_from_slice(&independent_prepare(
            &record.vector,
            VectorNormalization::L2Unit,
        )?);
    }
    let mut index = IdMapIndex::new(DURABLE_DIMENSION, BIT_WIDTH)
        .map_err(|_| "durable-index-construct-failed".to_owned())?;
    index
        .add_with_ids(&vectors, &ids)
        .map_err(|_| "durable-index-add-failed".to_owned())?;
    require(
        index.len() == DURABLE_INITIAL_RECORD_COUNT,
        "durable-index-count-invalid",
    )?;
    Ok(index)
}

fn durable_records() -> BenchResult<Vec<Record>> {
    let mut records = Vec::with_capacity(DURABLE_INITIAL_RECORD_COUNT);
    let mut rng = DeterministicRng::new(DURABLE_TARGET_SEED);
    for external_id in 1..=DURABLE_INITIAL_RECORD_COUNT as u64 {
        let mut vector = (0..DURABLE_DIMENSION)
            .map(|_| random_signed(&mut rng))
            .collect::<Vec<_>>();
        vector[(external_id as usize * 7) % DURABLE_DIMENSION] +=
            2.0 + external_id as f32 / DURABLE_INITIAL_RECORD_COUNT as f32;
        records.push(Record {
            external_id,
            label: None,
            vector,
            active: true,
        });
    }
    require(
        records.len() == DURABLE_INITIAL_RECORD_COUNT,
        "durable-record-count-invalid",
    )?;
    Ok(records)
}

struct DurableTarget {
    external_id: u64,
    raw_vector: Vec<f32>,
    stored_fingerprint: Vec<u8>,
}

fn durable_target_material() -> BenchResult<Vec<DurableTarget>> {
    let target_ids = durable_target_ids().into_iter().collect::<BTreeSet<_>>();
    let mut targets = Vec::with_capacity(DURABLE_DELETE_TARGET_COUNT);
    for record in durable_records()? {
        if !target_ids.contains(&record.external_id) {
            continue;
        }
        let prepared = independent_prepare(&record.vector, VectorNormalization::L2Unit)?;
        let mut stored_fingerprint = Vec::with_capacity(DURABLE_DIMENSION * 4);
        for value in prepared {
            stored_fingerprint.extend_from_slice(&value.to_bits().to_le_bytes());
        }
        targets.push(DurableTarget {
            external_id: record.external_id,
            raw_vector: record.vector,
            stored_fingerprint,
        });
    }
    require(
        targets.len() == DURABLE_DELETE_TARGET_COUNT,
        "durable-target-material-count-invalid",
    )?;
    Ok(targets)
}

fn durable_target_ids() -> Vec<u64> {
    let mut ranked = (1..=DURABLE_INITIAL_RECORD_COUNT as u64)
        .map(|external_id| {
            let mut material = Vec::new();
            material.extend_from_slice(DURABLE_LANE_ID.as_bytes());
            material.push(0);
            material.extend_from_slice(&external_id.to_be_bytes());
            (sha256(&material), external_id)
        })
        .collect::<Vec<_>>();
    ranked.sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)));
    ranked
        .into_iter()
        .take(DURABLE_DELETE_TARGET_COUNT)
        .map(|(_, external_id)| external_id)
        .collect()
}

fn durable_compacted_index() -> BenchResult<IdMapIndex> {
    let mut next = durable_initial_index()?;
    for external_id in durable_target_ids() {
        require(next.remove(external_id), "durable-delete-failed")?;
    }
    require(
        next.len() == DURABLE_INITIAL_RECORD_COUNT - DURABLE_DELETE_TARGET_COUNT,
        "durable-compacted-count-invalid",
    )?;
    Ok(next)
}

fn write_generation(
    root: &Path,
    generation: u64,
    index: &IdMapIndex,
    stop: Option<StopBoundary>,
) -> BenchResult<WriteGenerationResult> {
    let snapshot_temp = root.join(format!("snapshot-{generation}-pending.tvim.tmp"));
    index
        .write(&snapshot_temp)
        .map_err(|_| "snapshot-serialization-failed".to_owned())?;
    OpenOptions::new()
        .read(true)
        .write(true)
        .open(&snapshot_temp)
        .and_then(|file| file.sync_all())
        .map_err(|_| "snapshot-sync-failed".to_owned())?;
    let snapshot_bytes = read_bounded(
        &snapshot_temp,
        MAX_MANAGED_FILE_BYTES,
        "snapshot-temp-read-failed",
    )?;
    require(
        snapshot_bytes.len() == candidate_tvim_bytes(index.len(), index.dim())?,
        "snapshot-byte-formula-mismatch",
    )?;
    let snapshot_sha256 = hex(&sha256(&snapshot_bytes));
    let snapshot_name = format!("snapshot-{generation}-{snapshot_sha256}.tvim");
    let snapshot_final = root.join(&snapshot_name);
    let mut attempts = 0;
    let mut successes = 0;
    attempts += 1;
    successes += usize::from(sync_directory(root));
    if stop == Some(StopBoundary::SnapshotTempSynced) {
        return Ok(WriteGenerationResult {
            boundary_reached: true,
            directory_flush_attempts: attempts,
            directory_flush_successes: successes,
        });
    }
    fs::rename(&snapshot_temp, &snapshot_final)
        .map_err(|_| "snapshot-finalize-failed".to_owned())?;
    attempts += 1;
    successes += usize::from(sync_directory(root));
    validate_reopened_snapshot(&snapshot_final, &snapshot_bytes, &snapshot_sha256)?;
    if stop == Some(StopBoundary::SnapshotFinalized) {
        return Ok(WriteGenerationResult {
            boundary_reached: true,
            directory_flush_attempts: attempts,
            directory_flush_successes: successes,
        });
    }

    let commit_bytes = commit_bytes(
        generation,
        &snapshot_name,
        snapshot_bytes.len(),
        &snapshot_sha256,
    );
    let commit_sha256 = hex(&sha256(&commit_bytes));
    let commit_name = format!("commit-{generation}-{commit_sha256}.json");
    let commit_final = root.join(&commit_name);
    let commit_temp = root.join(format!("{commit_name}{TEMPORARY_SUFFIX}"));
    write_synced_new_file(&commit_temp, &commit_bytes)?;
    attempts += 1;
    successes += usize::from(sync_directory(root));
    if stop == Some(StopBoundary::CommitTempSynced) {
        return Ok(WriteGenerationResult {
            boundary_reached: true,
            directory_flush_attempts: attempts,
            directory_flush_successes: successes,
        });
    }
    fs::rename(&commit_temp, &commit_final).map_err(|_| "commit-finalize-failed".to_owned())?;
    attempts += 1;
    successes += usize::from(sync_directory(root));
    validate_reopened_bytes(&commit_final, &commit_bytes, "commit-reopen-failed")?;
    Ok(WriteGenerationResult {
        boundary_reached: stop == Some(StopBoundary::CommitFinalized),
        directory_flush_attempts: attempts,
        directory_flush_successes: successes,
    })
}

fn write_synced_new_file(path: &Path, bytes: &[u8]) -> BenchResult<()> {
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)
        .map_err(|_| "same-directory-temp-create-failed".to_owned())?;
    file.write_all(bytes)
        .map_err(|_| "same-directory-temp-write-failed".to_owned())?;
    file.flush()
        .map_err(|_| "same-directory-temp-flush-failed".to_owned())?;
    file.sync_all()
        .map_err(|_| "same-directory-temp-sync-failed".to_owned())
}

fn sync_directory(root: &Path) -> bool {
    File::open(root)
        .and_then(|directory| directory.sync_all())
        .is_ok()
}

fn validate_reopened_snapshot(
    path: &Path,
    expected: &[u8],
    expected_sha256: &str,
) -> BenchResult<()> {
    validate_reopened_bytes(path, expected, "snapshot-reopen-failed")?;
    let loaded = verified_load_tvim(path, expected.len(), expected_sha256)?;
    require(
        !loaded.is_empty() && loaded.bit_width() == BIT_WIDTH,
        "snapshot-reopen-parse-failed",
    )?;
    Ok(())
}

fn validate_reopened_bytes(path: &Path, expected: &[u8], code: &'static str) -> BenchResult<()> {
    let observed = read_bounded(path, MAX_MANAGED_FILE_BYTES, code)?;
    require(observed == expected, code)
}

fn commit_bytes(
    generation: u64,
    snapshot_name: &str,
    snapshot_bytes: usize,
    snapshot_sha256: &str,
) -> Vec<u8> {
    format!(
        "{{\n  \"schema\": \"{COMMIT_SCHEMA}\",\n  \"generation\": {generation},\n  \
         \"snapshot\": \"{snapshot_name}\",\n  \"snapshotBytes\": {snapshot_bytes},\n  \
         \"snapshotSha256\": \
         \"{snapshot_sha256}\"\n}}\n"
    )
    .into_bytes()
}

fn recover_active_generation(root: &Path) -> BenchResult<ActiveGeneration> {
    let names = managed_entries(root)?;
    let snapshots = names
        .iter()
        .filter_map(|name| parse_final_name(name, "snapshot-", ".tvim"))
        .collect::<Vec<_>>();
    let commits = names
        .iter()
        .filter_map(|name| parse_final_name(name, "commit-", ".json"))
        .collect::<Vec<_>>();
    let mut valid = Vec::new();
    for (generation, commit_hash, commit_name) in commits {
        let commit_path = root.join(&commit_name);
        let commit_content =
            read_bounded(&commit_path, MAX_MANAGED_FILE_BYTES, "commit-read-failed")?;
        if hex(&sha256(&commit_content)) != commit_hash {
            continue;
        }
        for (snapshot_generation, snapshot_hash, snapshot_name) in &snapshots {
            if *snapshot_generation != generation {
                continue;
            }
            let snapshot_path = root.join(snapshot_name);
            let snapshot_metadata = match fs::symlink_metadata(&snapshot_path) {
                Ok(value)
                    if value.file_type().is_file()
                        && !value.file_type().is_symlink()
                        && value.len() > 0
                        && value.len() <= MAX_MANAGED_FILE_BYTES as u64 =>
                {
                    value
                }
                _ => continue,
            };
            let snapshot_bytes = snapshot_metadata.len() as usize;
            let expected_commit =
                commit_bytes(generation, snapshot_name, snapshot_bytes, snapshot_hash);
            if commit_content != expected_commit {
                continue;
            }
            let index = match verified_load_tvim(&snapshot_path, snapshot_bytes, snapshot_hash) {
                Ok(value) => value,
                Err(_) => continue,
            };
            valid.push(ActiveGeneration {
                generation,
                index,
                snapshot_name: snapshot_name.clone(),
                snapshot_sha256: snapshot_hash.clone(),
                snapshot_bytes,
                commit_name: commit_name.clone(),
                commit_sha256: commit_hash.clone(),
            });
        }
    }
    valid.sort_by_key(|candidate| candidate.generation);
    valid
        .pop()
        .ok_or_else(|| "no-valid-active-generation".to_owned())
}

fn parse_final_name(name: &str, prefix: &str, suffix: &str) -> Option<(u64, String, String)> {
    let body = name.strip_prefix(prefix)?.strip_suffix(suffix)?;
    let (generation, hash) = body.split_once('-')?;
    if hash.len() != 64
        || !hash
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        return None;
    }
    Some((generation.parse().ok()?, hash.to_owned(), name.to_owned()))
}

fn ensure_generation_two(
    root: &Path,
    active: &ActiveGeneration,
) -> BenchResult<(bool, usize, usize)> {
    if active.generation == 2 {
        require(
            durable_target_ids()
                .iter()
                .all(|external_id| !active.index.contains(*external_id)),
            "generation-two-retains-target",
        )?;
        return Ok((false, 0, 0));
    }
    require(active.generation == 1, "unexpected-active-generation")?;
    remove_uncommitted_generation_two(root)?;
    let compacted = durable_compacted_index()?;
    let result = write_generation(root, 2, &compacted, None)?;
    require(
        !result.boundary_reached,
        "retry-generation-write-incomplete",
    )?;
    Ok((
        true,
        result.directory_flush_attempts,
        result.directory_flush_successes,
    ))
}

fn remove_uncommitted_generation_two(root: &Path) -> BenchResult<()> {
    for name in managed_entries(root)? {
        if name == OWNED_ROOT_MARKER {
            continue;
        }
        let generation_two = name.starts_with("snapshot-2-") || name.starts_with("commit-2-");
        if generation_two {
            fs::remove_file(root.join(name))
                .map_err(|_| "uncommitted-generation-cleanup-failed".to_owned())?;
        }
    }
    Ok(())
}

fn cleanup_to_active(root: &Path, active: &ActiveGeneration) -> BenchResult<usize> {
    let keep = [
        OWNED_ROOT_MARKER.to_owned(),
        active.snapshot_name.clone(),
        active.commit_name.clone(),
    ]
    .into_iter()
    .collect::<BTreeSet<_>>();
    let mut removed = 0;
    for name in managed_entries(root)? {
        if !keep.contains(&name) {
            fs::remove_file(root.join(&name))
                .map_err(|_| "obsolete-managed-file-cleanup-failed".to_owned())?;
            removed += 1;
        }
    }
    let remaining = managed_entries(root)?;
    require(
        remaining.into_iter().collect::<BTreeSet<_>>() == keep,
        "active-managed-file-set-invalid",
    )?;
    Ok(removed)
}

fn scan_managed_files(root: &Path, targets: &[DurableTarget]) -> BenchResult<(usize, usize)> {
    let mut identifier_matches = 0;
    let mut fingerprint_matches = 0;
    for name in managed_entries(root)? {
        let bytes = read_bounded(
            &root.join(name),
            MAX_MANAGED_FILE_BYTES,
            "managed-file-scan-read-failed",
        )?;
        for target in targets {
            identifier_matches += count_subslice(&bytes, &target.external_id.to_le_bytes());
            fingerprint_matches += count_subslice(&bytes, &target.stored_fingerprint);
        }
    }
    Ok((identifier_matches, fingerprint_matches))
}

fn search_matches_for_deleted_targets(
    index: &IdMapIndex,
    targets: &[DurableTarget],
) -> BenchResult<usize> {
    let deleted = targets
        .iter()
        .map(|target| target.external_id)
        .collect::<BTreeSet<_>>();
    let mut matches = 0;
    for target in targets {
        let query = independent_prepare(&target.raw_vector, VectorNormalization::L2Unit)?;
        let (_, ids) = index.search(&query, index.len().min(100));
        matches += ids
            .iter()
            .filter(|external_id| deleted.contains(external_id))
            .count();
    }
    Ok(matches)
}

fn count_subslice(haystack: &[u8], needle: &[u8]) -> usize {
    if needle.is_empty() || haystack.len() < needle.len() {
        return 0;
    }
    haystack
        .windows(needle.len())
        .filter(|window| *window == needle)
        .count()
}

fn metric_label(metric: RetrievalMetric) -> &'static str {
    match metric {
        RetrievalMetric::DotProduct => "dot-product",
        RetrievalMetric::SquaredEuclidean => "squared-euclidean",
        RetrievalMetric::Cosine => "cosine",
    }
}

fn normalization_label(normalization: VectorNormalization) -> &'static str {
    match normalization {
        VectorNormalization::None => "none",
        VectorNormalization::L2Unit => "l2-unit",
    }
}

fn canonical_f32(value: f32) -> f32 {
    if value == 0.0 {
        0.0
    } else {
        value
    }
}

fn json_f64(value: f64) -> String {
    assert!(
        value.is_finite() && (0.0..=1.0).contains(&value),
        "JSON metrics must be finite unit-interval values"
    );
    if value == 0.0 {
        return "0".to_owned();
    }
    let rendered = value.to_string();
    if value >= 1e-6 || rendered.contains('e') {
        return rendered;
    }
    let fraction = rendered
        .strip_prefix("0.")
        .expect("sub-micro unit values must use decimal notation");
    let first_significant = fraction
        .bytes()
        .position(|byte| byte != b'0')
        .expect("nonzero value must contain a significant digit");
    let significant = &fraction[first_significant..];
    let exponent = -((first_significant + 1) as i32);
    if significant.len() == 1 {
        format!("{significant}e{exponent}")
    } else {
        format!("{}.{}e{exponent}", &significant[..1], &significant[1..])
    }
}

fn optional_f64_json(value: Option<f64>) -> String {
    value.map_or_else(|| "null".to_owned(), json_f64)
}

fn optional_bool_json(value: Option<bool>) -> String {
    value.map_or_else(|| "null".to_owned(), |item| item.to_string())
}

fn optional_usize_json(value: Option<usize>) -> String {
    value.map_or_else(|| "null".to_owned(), |item| item.to_string())
}

fn decode_hash(value: &str) -> BenchResult<[u8; 32]> {
    require(value.len() == 64, "sha256-text-length-invalid")?;
    let mut output = [0_u8; 32];
    for (index, chunk) in value.as_bytes().chunks_exact(2).enumerate() {
        let text = std::str::from_utf8(chunk).map_err(|_| "sha256-text-invalid".to_owned())?;
        output[index] =
            u8::from_str_radix(text, 16).map_err(|_| "sha256-text-invalid".to_owned())?;
    }
    Ok(output)
}

fn hex(value: &[u8]) -> String {
    let mut output = String::with_capacity(value.len() * 2);
    for byte in value {
        write!(&mut output, "{byte:02x}").expect("writing to String cannot fail");
    }
    output
}

fn require(condition: bool, code: &'static str) -> BenchResult<()> {
    if condition {
        Ok(())
    } else {
        Err(code.to_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_candidate, candidate_outputs, candidate_query_vector, candidate_record_vector,
        candidate_search, candidate_tvim_bytes, cleanup_to_active, construct_candidate_index,
        durable_compacted_index, durable_initial_index, durable_target_ids, exact_flat_bytes,
        json_f64, managed_entries, recover_active_generation, recovery_json,
        require_root_contains_only_marker, run_corruption_at_root, run_recovery_at_root,
        scan_managed_files, verified_load_tvim, write_generation, CorruptionCase, Lane, LaneKind,
        Query, Record, StopBoundary, BIT_WIDTH, OWNED_ROOT_MARKER, OWNED_ROOT_MARKER_BYTES,
    };
    use std::collections::BTreeSet;
    use std::env;
    use std::fs::{self, OpenOptions};
    use std::io::Write;
    use std::path::{Path, PathBuf};
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};
    use tinyrustlm_vector_oracle::{RetrievalMetric, SearchHit, VectorNormalization};

    static LOAD_LOCK: Mutex<()> = Mutex::new(());

    fn owned_root(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = env::temp_dir().join(format!(
            "tinyrustlm-turbovec-reference-test-{label}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir(&root).expect("create root");
        let mut marker = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(root.join(OWNED_ROOT_MARKER))
            .expect("marker");
        marker
            .write_all(OWNED_ROOT_MARKER_BYTES)
            .expect("marker bytes");
        marker.sync_all().expect("marker sync");
        root
    }

    fn remove_owned_root(root: &Path) {
        assert!(root
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with("tinyrustlm-turbovec-reference-test-")));
        assert_eq!(
            fs::read(root.join(OWNED_ROOT_MARKER)).expect("marker"),
            OWNED_ROOT_MARKER_BYTES
        );
        fs::remove_dir_all(root).expect("remove test root");
        assert!(!root.exists());
    }

    fn tiny_lane(metric: RetrievalMetric) -> Lane {
        let dimension = 64;
        let mut records = Vec::new();
        for external_id in (1_u64..=32).rev() {
            let mut vector = vec![0.0_f32; dimension];
            vector[(external_id as usize * 7) % dimension] = 1.0;
            vector[(external_id as usize * 13 + 3) % dimension] = external_id as f32 / 64.0;
            records.push(Record {
                external_id,
                label: None,
                vector,
                active: true,
            });
        }
        let mut queries = Vec::new();
        for (ordinal, record) in records.iter().take(4).enumerate() {
            queries.push(Query {
                ordinal,
                class_or_topic: 0,
                vector: record.vector.clone(),
                allowed_external_ids: None,
                expected_first_id: None,
                forbidden_external_ids: BTreeSet::new(),
                deleted_external_ids: BTreeSet::new(),
            });
        }
        Lane {
            lane_id: "tiny-test-lane",
            kind: LaneKind::Synthetic,
            metric,
            normalization: if metric == RetrievalMetric::Cosine {
                VectorNormalization::L2Unit
            } else {
                VectorNormalization::None
            },
            dimension,
            declared_record_count: records.len(),
            records,
            queries,
        }
    }

    #[test]
    fn euclidean_adapter_preserves_declared_distance_algebra() {
        let lane = tiny_lane(RetrievalMetric::SquaredEuclidean);
        let record = &lane.records[7].vector;
        let query = &lane.queries[2].vector;
        let encoded_record = candidate_record_vector(&lane, record).expect("record adapter");
        let (encoded_query, query_norm) =
            candidate_query_vector(&lane, query).expect("query adapter");
        assert_eq!(encoded_record.len(), 72);
        assert_eq!(encoded_query.len(), 72);
        let inner = encoded_record
            .iter()
            .zip(&encoded_query)
            .map(|(left, right)| f64::from(*left) * f64::from(*right))
            .sum::<f64>();
        let declared = query_norm - inner;
        let exact = query
            .iter()
            .zip(record)
            .map(|(left, right)| {
                let difference = f64::from(*left) - f64::from(*right);
                difference * difference
            })
            .sum::<f64>();
        assert!((declared - exact).abs() < 1.0e-6);
    }

    #[test]
    fn tiny_candidate_builds_and_reload_are_byte_and_search_identical() {
        let _guard = LOAD_LOCK.lock().expect("load lock");
        let lane = tiny_lane(RetrievalMetric::Cosine);
        let root = owned_root("determinism");
        let first = build_candidate(&lane, &root, "first").expect("first build");
        let second = build_candidate(&lane, &root, "second").expect("second build");
        assert_eq!(first.snapshot_bytes, second.snapshot_bytes);
        assert_eq!(first.snapshot_sha256, second.snapshot_sha256);
        assert_eq!(
            first.snapshot_bytes.len(),
            candidate_tvim_bytes(32, 64).expect("candidate bytes")
        );
        let loaded = verified_load_tvim(
            &first.snapshot_path,
            first.snapshot_bytes.len(),
            &first.snapshot_sha256,
        )
        .expect("verified reload");
        assert_eq!(loaded.bit_width(), BIT_WIDTH);
        assert_eq!(
            candidate_outputs(&first.index, &lane).expect("first search"),
            candidate_outputs(&loaded, &lane).expect("reload search")
        );
        remove_owned_root(&root);
    }

    #[test]
    fn exact_returned_score_ties_are_canonicalized_without_membership_repair() {
        let mut lane = tiny_lane(RetrievalMetric::DotProduct);
        for record in &mut lane.records {
            record.vector.fill(0.0);
            record.vector[0] = 1.0;
        }
        lane.queries[0].vector = lane.records[0].vector.clone();
        let (index, _, _) = construct_candidate_index(&lane).expect("candidate");
        let hits = candidate_search(&index, &lane, &lane.queries[0]).expect("search");
        assert!(hits.windows(2).all(|pair| {
            pair[0].raw_score > pair[1].raw_score
                || pair[0].raw_score == pair[1].raw_score
                    && pair[0].external_id < pair[1].external_id
        }));
        assert_eq!(
            hits.iter()
                .map(|hit| hit.external_id)
                .collect::<BTreeSet<_>>(),
            (1_u64..=32).collect()
        );
    }

    #[test]
    fn byte_budget_formula_is_maximal_and_counts_all_overhead() {
        let budget = candidate_tvim_bytes(1_200, 128).expect("candidate formula");
        assert_eq!(budget, 92_242);
        let count = super::capacity_matched_record_count(budget, 128).expect("capacity");
        assert_eq!(count, 174);
        assert_eq!(exact_flat_bytes(count, 128).expect("exact"), 92_152);
        assert!(exact_flat_bytes(count + 1, 128).expect("next") > budget);
    }

    #[test]
    fn empty_capacity_result_is_missing_not_an_infrastructure_error() {
        let expected = vec![SearchHit {
            external_id: 7,
            score: 1.0,
        }];
        let metrics = super::ranking_metrics(&expected, &[], &[]).expect("ranking metrics");
        assert_eq!(metrics.recall_at_1, 0.0);
        assert_eq!(metrics.missing_result_count, 1);
        assert_eq!(metrics.mean_absolute_normalized_score_error, 0.0);
        assert_eq!(metrics.p99_absolute_normalized_score_error, 0.0);
    }

    #[test]
    fn metric_numbers_use_ecmascript_canonical_thresholds() {
        assert_eq!(json_f64(0.0), "0");
        assert_eq!(json_f64(1.0), "1");
        assert_eq!(json_f64(0.5), "0.5");
        assert_eq!(json_f64(0.000001), "0.000001");
        assert_eq!(json_f64(0.0000001), "1e-7");
        assert_eq!(json_f64(0.0000000000001), "1e-13");
    }

    #[test]
    fn every_registered_boundary_recovers_then_deletes_idempotently() {
        let _guard = LOAD_LOCK.lock().expect("load lock");
        for scenario in [
            StopBoundary::SnapshotTempSynced,
            StopBoundary::SnapshotFinalized,
            StopBoundary::CommitTempSynced,
            StopBoundary::CommitFinalized,
        ] {
            let root = owned_root(scenario.scenario_id());
            require_root_contains_only_marker(&root).expect("empty root");
            let initial = durable_initial_index().expect("initial");
            write_generation(&root, 1, &initial, None).expect("generation one");
            let compacted = durable_compacted_index().expect("compacted");
            let stopped =
                write_generation(&root, 2, &compacted, Some(scenario)).expect("stopped write");
            assert!(stopped.boundary_reached);
            let active = recover_active_generation(&root).expect("recover before retry");
            assert_eq!(active.generation, scenario.expected_active_generation());

            let result = run_recovery_at_root(&root, scenario).expect("recovery");
            assert_eq!(
                result.observed_generation_before_retry,
                scenario.expected_active_generation()
            );
            assert_eq!(result.final_generation, 2);
            assert!(result.retry_idempotent);
            assert_eq!(result.final_target_identifier_matches, 0);
            assert_eq!(result.final_target_vector_fingerprint_matches, 0);
            assert!(!result.active_index_contains_deleted_target);
            assert_eq!(result.deleted_target_search_matches, 0);
            assert!(durable_target_ids().iter().all(|external_id| {
                !recover_active_generation(&root)
                    .expect("final active")
                    .index
                    .contains(*external_id)
            }));
            let json = recovery_json(&result);
            assert!(!json.contains("\\\\"));
            assert!(!json.contains("C:"));
            assert_eq!(managed_entries(&root).expect("entries").len(), 3);
            let active = recover_active_generation(&root).expect("active");
            assert_eq!(cleanup_to_active(&root, &active).expect("cleanup"), 0);
            let targets = super::durable_target_material().expect("targets");
            assert_eq!(scan_managed_files(&root, &targets).expect("scan"), (0, 0));
            remove_owned_root(&root);
        }
    }

    #[test]
    fn every_registered_corruption_rejects_before_upstream_load() {
        let _guard = LOAD_LOCK.lock().expect("load lock");
        for case in [
            CorruptionCase::HeaderBitFlip,
            CorruptionCase::PackedCodeBitFlip,
            CorruptionCase::ScaleBitFlip,
            CorruptionCase::IdBitFlip,
            CorruptionCase::TruncateOneByte,
            CorruptionCase::AppendOneByte,
            CorruptionCase::CommitHashMismatch,
        ] {
            let root = owned_root(case.case_id());
            let result = run_corruption_at_root(&root, case).expect("corruption result");
            assert!(result.rejected);
            assert!(result.rejected_before_upstream_load);
            assert_eq!(result.upstream_load_attempt_count, 0);
            remove_owned_root(&root);
        }
    }
}
