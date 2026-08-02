#![forbid(unsafe_code)]

use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fmt::Write as FmtWrite;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write as IoWrite};
use std::path::{Path, PathBuf};
use std::process;

use tinyrustlm_vector_oracle::{
    sha256, CalibrationIdentity, DeterministicRng, ExactFlatIndex, ExactFlatIndexBuilder,
    FlatIndexConfig, FlatIndexConfigSpec, RetrievalMetric, RetrievalTransform, SearchHit,
    VectorNormalization,
};

const EXPERIMENT_ID: &str = "exact-flat-sealed-corpus-and-durable-deletion-20260725";
const QUALITY_SCHEMA: &str = "tinyrustlm.exact_flat_baseline_quality_process.v1";
const RECOVERY_SCHEMA: &str = "tinyrustlm.exact_flat_durable_deletion_recovery.v1";
const CONTRACT_SCHEMA: &str = "tinyrustlm.exact_flat_baseline_benchmark_contract.v1";
const COMMIT_SCHEMA: &str = "tinyrustlm.exact_flat_deletion_commit.v1";
const OWNED_ROOT_MARKER: &str = ".tinyrustlm-exact-flat-deletion-owned";
const OWNED_ROOT_MARKER_BYTES: &[u8] = b"tinyrustlm-exact-flat-deletion-owned-v1\n";
const TEMPORARY_SUFFIX: &str = ".tmp";
const PROCESS_CRASH_EXIT_CODE: i32 = 73;
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
const DURABLE_DELETE_TARGET_COUNT: usize = 8;
const DURABLE_TARGET_ID_BASE: u64 = 9_000_000_000_000_000_000;
const DURABLE_TARGET_SEED: u64 = 0x4528_21e6_38d0_1377;
const MAX_DATASET_BYTES: usize = 64 * 1024 * 1024;
const MAX_MANAGED_FILE_BYTES: usize = 1024 * 1024;

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
    index: ExactFlatIndex,
}

struct QueryMetrics {
    lane_id: &'static str,
    query_ordinal: usize,
    class_or_topic: usize,
    recall_at_1: f64,
    recall_at_10: f64,
    recall_at_100: f64,
    mrr_at_100: f64,
    ndcg_at_100: f64,
    rank_inversions_at_100: usize,
    maximum_absolute_score_error: f64,
    mean_absolute_score_error: f64,
    label_precision_at_10: Option<f64>,
    label_mrr_at_10: Option<f64>,
    label_ndcg_at_10: Option<f64>,
    expected_first_hit: Option<bool>,
    forbidden_hit_count_at_10: Option<usize>,
    deleted_hit_count: Option<usize>,
    filter_violation_count: Option<usize>,
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
    dimension: usize,
    declared_record_count: usize,
    active_record_count: usize,
    query_count: usize,
    minimum_recall_at_1: f64,
    minimum_recall_at_10: f64,
    minimum_recall_at_100: f64,
    minimum_mrr_at_100: f64,
    minimum_ndcg_at_100: f64,
    rank_inversions_at_100: usize,
    maximum_absolute_score_error: f64,
    mean_absolute_score_error: f64,
    natural_utility: Option<NaturalUtility>,
    controlled_utility: Option<ControlledUtility>,
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

struct WriteGenerationResult {
    boundary_reached: bool,
    directory_flush_attempts: usize,
    directory_flush_successes: usize,
}

struct ActiveGeneration {
    generation: u64,
    index: ExactFlatIndex,
    snapshot_name: String,
    snapshot_sha256: String,
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
    active_index_contains_any_deleted_target: bool,
    active_index_contains_active_deleted_target: bool,
    removed_managed_file_count: usize,
    directory_flush_attempted: bool,
    directory_flush_succeeded: bool,
    final_snapshot_sha256: String,
    final_commit_sha256: String,
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
         \"qualityProcessCount\":1,\"crashScenarioCount\":4,\
         \"processCrashExitCode\":{PROCESS_CRASH_EXIT_CODE},\
         \"networkRequired\":false,\"productImport\":false}}"
    )
}

fn run_quality() -> BenchResult<String> {
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

    let mut lanes = Vec::new();
    lanes.push(standard_lane(
        "fashion-mnist-euclidean-784",
        LaneKind::Natural,
        RetrievalMetric::SquaredEuclidean,
        VectorNormalization::None,
        NATURAL_DIMENSION,
        natural_records.clone(),
        natural_queries.clone(),
    )?);
    lanes.push(standard_lane(
        "fashion-mnist-cosine-784",
        LaneKind::Natural,
        RetrievalMetric::Cosine,
        VectorNormalization::L2Unit,
        NATURAL_DIMENSION,
        natural_records,
        natural_queries,
    )?);
    lanes.push(synthetic_lane(
        "synthetic-dot-128",
        RetrievalMetric::DotProduct,
        VectorNormalization::None,
        128,
        0x243f_6a88_85a3_08d3,
    )?);
    lanes.push(synthetic_lane(
        "synthetic-cosine-384",
        RetrievalMetric::Cosine,
        VectorNormalization::L2Unit,
        384,
        0x1319_8a2e_0370_7344,
    )?);
    lanes.push(synthetic_lane(
        "synthetic-euclidean-768",
        RetrievalMetric::SquaredEuclidean,
        VectorNormalization::None,
        768,
        0xa409_3822_299f_31d0,
    )?);
    lanes.push(controlled_memory_lane()?);

    let mut lane_results = Vec::new();
    let mut per_query = Vec::new();
    for lane in &lanes {
        let (result, mut queries) = evaluate_lane(lane)?;
        lane_results.push(result);
        per_query.append(&mut queries);
    }
    Ok(quality_json(&selection_sha256, &lane_results, &per_query))
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
    let index = build_index(lane_id, metric, normalization, dimension, &records)?;
    Ok(Lane {
        lane_id,
        kind,
        metric,
        normalization,
        dimension,
        declared_record_count: records.len(),
        records,
        queries,
        index,
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
            near[ordinal % dimension] += 0.000_244_140_625;
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
    let config = config(lane_id, metric, normalization, CONTROLLED_DIMENSION)?;
    let mut builder =
        ExactFlatIndexBuilder::new(config, record_revision(lane_id, &records, b"initial"))
            .map_err(|_| "controlled-builder-failed".to_owned())?;
    for record in &records {
        builder
            .insert(record.external_id, &record.vector)
            .map_err(|_| "controlled-insert-failed".to_owned())?;
    }
    let mut index = builder.finish();
    for (ordinal, external_id) in all_deleted.iter().enumerate() {
        index = index
            .with_deleted(
                *external_id,
                sha256(format!("{lane_id}:deleted:{ordinal}").as_bytes()),
            )
            .map_err(|_| "controlled-delete-failed".to_owned())?;
    }
    index = index
        .compacted(sha256(format!("{lane_id}:compacted").as_bytes()))
        .map_err(|_| "controlled-compaction-failed".to_owned())?;
    require(
        records.len() == 120 && queries.len() == 30 && index.active_record_count() == 110,
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
        index,
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
        require(record.active, "standard-lane-inactive-record")?;
        builder
            .insert(record.external_id, &record.vector)
            .map_err(|_| "index-insert-failed".to_owned())?;
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

fn evaluate_lane(lane: &Lane) -> BenchResult<(LaneResult, Vec<QueryMetrics>)> {
    let mut query_metrics = Vec::with_capacity(lane.queries.len());
    for query in &lane.queries {
        let observed = lane
            .index
            .search(
                &query.vector,
                TOP_K_VALUES[2],
                query.allowed_external_ids.as_ref(),
            )
            .map_err(|_| "index-search-failed".to_owned())?;
        let expected = independent_rank(
            &lane.records,
            &query.vector,
            lane.metric,
            lane.normalization,
            query.allowed_external_ids.as_ref(),
        )?;
        query_metrics.push(compare_query(lane, query, &expected, &observed)?);
    }
    let minimum = |project: fn(&QueryMetrics) -> f64| {
        query_metrics.iter().map(project).fold(1.0_f64, f64::min)
    };
    let maximum_absolute_score_error = query_metrics
        .iter()
        .map(|value| value.maximum_absolute_score_error)
        .fold(0.0_f64, f64::max);
    let mean_absolute_score_error = query_metrics
        .iter()
        .map(|value| value.mean_absolute_score_error)
        .sum::<f64>()
        / query_metrics.len() as f64;
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
    let result = LaneResult {
        lane_id: lane.lane_id,
        lane_kind: lane.kind,
        metric: lane.metric,
        normalization: lane.normalization,
        dimension: lane.dimension,
        declared_record_count: lane.declared_record_count,
        active_record_count: lane.index.active_record_count(),
        query_count: lane.queries.len(),
        minimum_recall_at_1: minimum(|value| value.recall_at_1),
        minimum_recall_at_10: minimum(|value| value.recall_at_10),
        minimum_recall_at_100: minimum(|value| value.recall_at_100),
        minimum_mrr_at_100: minimum(|value| value.mrr_at_100),
        minimum_ndcg_at_100: minimum(|value| value.ndcg_at_100),
        rank_inversions_at_100: query_metrics
            .iter()
            .map(|value| value.rank_inversions_at_100)
            .sum(),
        maximum_absolute_score_error,
        mean_absolute_score_error,
        natural_utility,
        controlled_utility,
    };
    Ok((result, query_metrics))
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
    observed: &[SearchHit],
) -> BenchResult<QueryMetrics> {
    require(!expected.is_empty(), "ground-truth-empty-ranking")?;
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
    let expected_scores = expected
        .iter()
        .map(|hit| (hit.external_id, hit.score))
        .collect::<BTreeMap<_, _>>();
    let mut errors = Vec::new();
    for hit in observed {
        if let Some(expected_score) = expected_scores.get(&hit.external_id) {
            errors.push((hit.score - expected_score).abs());
        }
    }
    require(!errors.is_empty(), "score-error-coverage-empty")?;
    let maximum_absolute_score_error = errors.iter().copied().fold(0.0_f64, f64::max);
    let mean_absolute_score_error = errors.iter().sum::<f64>() / errors.len() as f64;

    let label_metrics = if lane.kind == LaneKind::Natural {
        let query_label = query.class_or_topic as u8;
        let labels = lane
            .records
            .iter()
            .map(|record| (record.external_id, record.label))
            .collect::<BTreeMap<_, _>>();
        let relevance = observed
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
            .filter(|record| record.label == Some(query_label))
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
            observed
                .first()
                .is_some_and(|hit| hit.external_id == expected_id)
        });
        let forbidden_hit_count = observed
            .iter()
            .take(10)
            .filter(|hit| query.forbidden_external_ids.contains(&hit.external_id))
            .count();
        let deleted_hit_count = observed
            .iter()
            .filter(|hit| query.deleted_external_ids.contains(&hit.external_id))
            .count();
        let filter_violation_count = observed
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
        recall_at_1,
        recall_at_10,
        recall_at_100,
        mrr_at_100,
        ndcg_at_100,
        rank_inversions_at_100,
        maximum_absolute_score_error,
        mean_absolute_score_error,
        label_precision_at_10: label_metrics.map(|value| value.0),
        label_mrr_at_10: label_metrics.map(|value| value.1),
        label_ndcg_at_10: label_metrics.map(|value| value.2),
        expected_first_hit: controlled.map(|value| value.0),
        forbidden_hit_count_at_10: controlled.map(|value| value.1),
        deleted_hit_count: controlled.map(|value| value.2),
        filter_violation_count: controlled.map(|value| value.3),
    })
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

fn aggregate_natural_utility(metrics: &[QueryMetrics]) -> BenchResult<NaturalUtility> {
    let mut coverage = vec![0_usize; NATURAL_CLASS_COUNT];
    let mut precision = vec![0.0_f64; NATURAL_CLASS_COUNT];
    let mut mrr = vec![0.0_f64; NATURAL_CLASS_COUNT];
    let mut ndcg = vec![0.0_f64; NATURAL_CLASS_COUNT];
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
        per_class_query_coverage: coverage,
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
    format!(
        "{{\"laneId\":\"{}\",\"laneKind\":\"{}\",\"metric\":\"{}\",\
         \"normalization\":\"{}\",\"dimension\":{},\"declaredRecordCount\":{},\
         \"activeRecordCount\":{},\"queryCount\":{},\"topKValues\":[1,10,100],\
         \"minimumRecallAt1\":{},\"minimumRecallAt10\":{},\"minimumRecallAt100\":{},\
         \"minimumMrrAt100\":{},\"minimumNdcgAt100\":{},\
         \"rankInversionsAt100\":{},\"maximumAbsoluteScoreError\":{},\
         \"meanAbsoluteScoreError\":{},\"naturalUtility\":{},\
         \"controlledUtility\":{}}}",
        value.lane_id,
        value.lane_kind.label(),
        metric_label(value.metric),
        normalization_label(value.normalization),
        value.dimension,
        value.declared_record_count,
        value.active_record_count,
        value.query_count,
        json_f64(value.minimum_recall_at_1),
        json_f64(value.minimum_recall_at_10),
        json_f64(value.minimum_recall_at_100),
        json_f64(value.minimum_mrr_at_100),
        json_f64(value.minimum_ndcg_at_100),
        value.rank_inversions_at_100,
        json_f64(value.maximum_absolute_score_error),
        json_f64(value.mean_absolute_score_error),
        natural,
        controlled
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
         \"recallAt1\":{},\"recallAt10\":{},\"recallAt100\":{},\
         \"mrrAt100\":{},\"ndcgAt100\":{},\"rankInversionsAt100\":{},\
         \"maximumAbsoluteScoreError\":{},\"meanAbsoluteScoreError\":{},\
         \"labelPrecisionAt10\":{},\"labelMrrAt10\":{},\"labelNdcgAt10\":{},\
         \"expectedFirstHit\":{},\"forbiddenHitCountAt10\":{},\
         \"deletedHitCount\":{},\"filterViolationCount\":{}}}",
        value.lane_id,
        value.query_ordinal,
        value.class_or_topic,
        json_f64(value.recall_at_1),
        json_f64(value.recall_at_10),
        json_f64(value.recall_at_100),
        json_f64(value.mrr_at_100),
        json_f64(value.ndcg_at_100),
        value.rank_inversions_at_100,
        json_f64(value.maximum_absolute_score_error),
        json_f64(value.mean_absolute_score_error),
        optional_f64_json(value.label_precision_at_10),
        optional_f64_json(value.label_mrr_at_10),
        optional_f64_json(value.label_ndcg_at_10),
        optional_bool_json(value.expected_first_hit),
        optional_usize_json(value.forbidden_hit_count_at_10),
        optional_usize_json(value.deleted_hit_count),
        optional_usize_json(value.filter_violation_count)
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
    let compacted = durable_compacted_index(&initial)?;
    let generation_two = write_generation(&root, 2, &compacted, Some(scenario))?;
    require(
        generation_two.boundary_reached,
        "registered-crash-boundary-not-reached",
    )?;
    process::exit(PROCESS_CRASH_EXIT_CODE);
}

fn run_recovery(scenario: StopBoundary) -> BenchResult<RecoveryResult> {
    let root = validate_owned_root()?;
    let observed = recover_active_generation(&root)?;
    require(
        observed.generation == scenario.expected_active_generation(),
        "recovered-generation-before-retry-invalid",
    )?;
    let deletion_committed_before_retry = observed.generation == 2;
    if observed.generation == 1 {
        require(
            durable_target_ids()
                .iter()
                .all(|external_id| observed.index.contains_active(*external_id)),
            "uncommitted-deletion-changed-active-index",
        )?;
    } else {
        require(
            durable_target_ids()
                .iter()
                .all(|external_id| !observed.index.contains_any(*external_id)),
            "committed-deletion-retained-target",
        )?;
    }

    let (first_retry, write_flush_attempts, write_flush_successes) =
        ensure_generation_two(&root, &observed)?;
    let after_first_retry = recover_active_generation(&root)?;
    require(
        after_first_retry.generation == 2,
        "generation-two-recovery-failed",
    )?;
    let (second_retry, second_flush_attempts, second_flush_successes) =
        ensure_generation_two(&root, &after_first_retry)?;
    let after_second_retry = recover_active_generation(&root)?;
    require(
        after_second_retry.generation == 2
            && after_second_retry.snapshot_sha256 == after_first_retry.snapshot_sha256
            && after_second_retry.commit_sha256 == after_first_retry.commit_sha256
            && !second_retry,
        "deletion-retry-not-idempotent",
    )?;

    let removed_managed_file_count = cleanup_to_active(&root, &after_second_retry)?;
    let final_active = recover_active_generation(&root)?;
    let targets = durable_target_material()?;
    let (identifier_matches, fingerprint_matches) = scan_managed_files(&root, &targets)?;
    let active_any = targets
        .iter()
        .any(|target| final_active.index.contains_any(target.external_id));
    let active_deleted = targets
        .iter()
        .any(|target| final_active.index.contains_active(target.external_id));
    require(
        identifier_matches == 0 && fingerprint_matches == 0 && !active_any && !active_deleted,
        "final-deletion-scan-failed",
    )?;
    let directory_probe = sync_directory(&root);
    Ok(RecoveryResult {
        scenario,
        observed_generation_before_retry: observed.generation,
        deletion_committed_before_retry,
        final_generation: final_active.generation,
        retry_wrote_generation_two: first_retry,
        retry_idempotent: true,
        final_target_identifier_matches: identifier_matches,
        final_target_vector_fingerprint_matches: fingerprint_matches,
        active_index_contains_any_deleted_target: active_any,
        active_index_contains_active_deleted_target: active_deleted,
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
         \"activeIndexContainsAnyDeletedTarget\":{},\
         \"activeIndexContainsActiveDeletedTarget\":{},\
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
        value.active_index_contains_any_deleted_target,
        value.active_index_contains_active_deleted_target,
        value.removed_managed_file_count,
        value.directory_flush_attempted,
        value.directory_flush_succeeded,
        value.final_snapshot_sha256,
        value.final_commit_sha256
    )
}

fn validate_owned_root() -> BenchResult<PathBuf> {
    let current = env::current_dir().map_err(|_| "owned-root-current-dir-failed".to_owned())?;
    let root =
        fs::canonicalize(current).map_err(|_| "owned-root-canonicalize-failed".to_owned())?;
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
        || name.starts_with("snapshot-")
            && (name.ends_with(".trflat") || name.ends_with(".trflat.tmp"))
        || name.starts_with("commit-") && (name.ends_with(".json") || name.ends_with(".json.tmp"))
}

fn durable_initial_index() -> BenchResult<ExactFlatIndex> {
    let records = durable_records()?;
    let config = config(
        "durable-deletion-cosine-64",
        RetrievalMetric::Cosine,
        VectorNormalization::L2Unit,
        DURABLE_DIMENSION,
    )?;
    let mut builder = ExactFlatIndexBuilder::new(
        config,
        record_revision("durable-deletion-cosine-64", &records, b"generation-1"),
    )
    .map_err(|_| "durable-builder-failed".to_owned())?;
    for record in &records {
        builder
            .insert(record.external_id, &record.vector)
            .map_err(|_| "durable-insert-failed".to_owned())?;
    }
    Ok(builder.finish())
}

fn durable_records() -> BenchResult<Vec<Record>> {
    let mut records = Vec::with_capacity(DURABLE_INITIAL_RECORD_COUNT);
    let targets = durable_target_material()?;
    for target in targets {
        records.push(Record {
            external_id: target.external_id,
            label: None,
            vector: target.raw_vector,
            active: true,
        });
    }
    let mut rng = DeterministicRng::new(DURABLE_TARGET_SEED ^ u64::MAX);
    for external_id in 1..=(DURABLE_INITIAL_RECORD_COUNT - DURABLE_DELETE_TARGET_COUNT) as u64 {
        let mut vector = (0..DURABLE_DIMENSION)
            .map(|_| random_signed(&mut rng))
            .collect::<Vec<_>>();
        vector[(external_id as usize * 7) % DURABLE_DIMENSION] += 2.0;
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
    let mut rng = DeterministicRng::new(DURABLE_TARGET_SEED);
    let mut targets = Vec::with_capacity(DURABLE_DELETE_TARGET_COUNT);
    for ordinal in 0..DURABLE_DELETE_TARGET_COUNT {
        let mut raw_vector = (0..DURABLE_DIMENSION)
            .map(|_| random_signed(&mut rng))
            .collect::<Vec<_>>();
        raw_vector[(ordinal * 11) % DURABLE_DIMENSION] += ordinal as f32 + 2.0;
        let prepared = independent_prepare(&raw_vector, VectorNormalization::L2Unit)?;
        let mut stored_fingerprint = Vec::with_capacity(DURABLE_DIMENSION * 4);
        for value in prepared {
            stored_fingerprint.extend_from_slice(&value.to_bits().to_le_bytes());
        }
        targets.push(DurableTarget {
            external_id: DURABLE_TARGET_ID_BASE + ordinal as u64,
            raw_vector,
            stored_fingerprint,
        });
    }
    Ok(targets)
}

fn durable_target_ids() -> Vec<u64> {
    (0..DURABLE_DELETE_TARGET_COUNT)
        .map(|ordinal| DURABLE_TARGET_ID_BASE + ordinal as u64)
        .collect()
}

fn durable_compacted_index(initial: &ExactFlatIndex) -> BenchResult<ExactFlatIndex> {
    let mut next = initial.clone();
    for (ordinal, external_id) in durable_target_ids().iter().enumerate() {
        next = next
            .with_deleted(
                *external_id,
                sha256(format!("durable-generation-two-delete-{ordinal}").as_bytes()),
            )
            .map_err(|_| "durable-delete-failed".to_owned())?;
    }
    next.compacted(sha256(b"durable-generation-two-compacted"))
        .map_err(|_| "durable-compaction-failed".to_owned())
}

fn write_generation(
    root: &Path,
    generation: u64,
    index: &ExactFlatIndex,
    stop: Option<StopBoundary>,
) -> BenchResult<WriteGenerationResult> {
    let snapshot_bytes = index
        .to_bytes()
        .map_err(|_| "snapshot-serialization-failed".to_owned())?;
    let snapshot_sha256 = hex(&sha256(&snapshot_bytes));
    let snapshot_name = format!("snapshot-{generation}-{snapshot_sha256}.trflat");
    let snapshot_final = root.join(&snapshot_name);
    let snapshot_temp = root.join(format!("{snapshot_name}{TEMPORARY_SUFFIX}"));
    let mut attempts = 0;
    let mut successes = 0;
    write_synced_new_file(&snapshot_temp, &snapshot_bytes)?;
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
    validate_reopened_snapshot(&snapshot_final, &snapshot_bytes)?;
    if stop == Some(StopBoundary::SnapshotFinalized) {
        return Ok(WriteGenerationResult {
            boundary_reached: true,
            directory_flush_attempts: attempts,
            directory_flush_successes: successes,
        });
    }

    let commit_bytes = commit_bytes(generation, &snapshot_name, &snapshot_sha256);
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

fn validate_reopened_snapshot(path: &Path, expected: &[u8]) -> BenchResult<()> {
    validate_reopened_bytes(path, expected, "snapshot-reopen-failed")?;
    ExactFlatIndex::from_bytes(expected).map_err(|_| "snapshot-reopen-parse-failed".to_owned())?;
    Ok(())
}

fn validate_reopened_bytes(path: &Path, expected: &[u8], code: &'static str) -> BenchResult<()> {
    let observed = read_bounded(path, MAX_MANAGED_FILE_BYTES, code)?;
    require(observed == expected, code)
}

fn commit_bytes(generation: u64, snapshot_name: &str, snapshot_sha256: &str) -> Vec<u8> {
    format!(
        "{{\n  \"schema\": \"{COMMIT_SCHEMA}\",\n  \"generation\": {generation},\n  \
         \"snapshot\": \"{snapshot_name}\",\n  \"snapshotSha256\": \
         \"{snapshot_sha256}\"\n}}\n"
    )
    .into_bytes()
}

fn recover_active_generation(root: &Path) -> BenchResult<ActiveGeneration> {
    let names = managed_entries(root)?;
    let snapshots = names
        .iter()
        .filter_map(|name| parse_final_name(name, "snapshot-", ".trflat"))
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
            let expected_commit = commit_bytes(generation, snapshot_name, snapshot_hash);
            if commit_content != expected_commit {
                continue;
            }
            let snapshot_path = root.join(snapshot_name);
            let snapshot_content = read_bounded(
                &snapshot_path,
                MAX_MANAGED_FILE_BYTES,
                "snapshot-read-failed",
            )?;
            if hex(&sha256(&snapshot_content)) != *snapshot_hash {
                continue;
            }
            let index = match ExactFlatIndex::from_bytes(&snapshot_content) {
                Ok(value) => value,
                Err(_) => continue,
            };
            valid.push(ActiveGeneration {
                generation,
                index,
                snapshot_name: snapshot_name.clone(),
                snapshot_sha256: snapshot_hash.clone(),
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
                .all(|external_id| !active.index.contains_any(*external_id)),
            "generation-two-retains-target",
        )?;
        return Ok((false, 0, 0));
    }
    require(active.generation == 1, "unexpected-active-generation")?;
    remove_uncommitted_generation_two(root)?;
    let compacted = durable_compacted_index(&active.index)?;
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
        build_index, cleanup_to_active, compare_query, controlled_memory_lane,
        durable_compacted_index, durable_initial_index, durable_target_ids, json_f64,
        managed_entries, recover_active_generation, recovery_json,
        require_root_contains_only_marker, run_recovery, scan_managed_files, write_generation,
        Lane, LaneKind, Query, Record, StopBoundary, OWNED_ROOT_MARKER, OWNED_ROOT_MARKER_BYTES,
    };
    use std::collections::BTreeSet;
    use std::env;
    use std::fs::{self, OpenOptions};
    use std::io::Write;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};
    use tinyrustlm_vector_oracle::{RetrievalMetric, VectorNormalization};

    fn owned_root(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = env::temp_dir().join(format!(
            "tinyrustlm-baseline-benchmark-test-{label}-{}-{nonce}",
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
            .is_some_and(|name| name.starts_with("tinyrustlm-baseline-benchmark-test-")));
        assert_eq!(
            fs::read(root.join(OWNED_ROOT_MARKER)).expect("marker"),
            OWNED_ROOT_MARKER_BYTES
        );
        fs::remove_dir_all(root).expect("remove test root");
        assert!(!root.exists());
    }

    #[test]
    fn independent_ranking_matches_public_search_without_private_state() {
        let records = vec![
            Record {
                external_id: 1,
                label: None,
                vector: vec![1.0, 0.0, 0.0],
                active: true,
            },
            Record {
                external_id: 2,
                label: None,
                vector: vec![0.0, 1.0, 0.0],
                active: true,
            },
            Record {
                external_id: 3,
                label: None,
                vector: vec![0.0, 0.0, 1.0],
                active: true,
            },
        ];
        let query = Query {
            ordinal: 0,
            class_or_topic: 0,
            vector: vec![0.9, 0.1, 0.0],
            allowed_external_ids: None,
            expected_first_id: None,
            forbidden_external_ids: BTreeSet::new(),
            deleted_external_ids: BTreeSet::new(),
        };
        let index = build_index(
            "unit-dot",
            RetrievalMetric::DotProduct,
            VectorNormalization::None,
            3,
            &records,
        )
        .expect("index");
        let lane = Lane {
            lane_id: "unit-dot",
            kind: LaneKind::Synthetic,
            metric: RetrievalMetric::DotProduct,
            normalization: VectorNormalization::None,
            dimension: 3,
            declared_record_count: 3,
            records,
            queries: vec![query],
            index,
        };
        let expected = super::independent_rank(
            &lane.records,
            &lane.queries[0].vector,
            lane.metric,
            lane.normalization,
            None,
        )
        .expect("ground truth");
        let observed = lane
            .index
            .search(&lane.queries[0].vector, 100, None)
            .expect("search");
        let metrics =
            compare_query(&lane, &lane.queries[0], &expected, &observed).expect("metrics");
        assert_eq!(metrics.recall_at_1, 1.0);
        assert_eq!(metrics.recall_at_100, 1.0);
        assert_eq!(metrics.rank_inversions_at_100, 0);
        assert_eq!(metrics.maximum_absolute_score_error, 0.0);
    }

    #[test]
    fn controlled_lane_enforces_allowed_deleted_and_expected_identity() {
        let lane = controlled_memory_lane().expect("controlled lane");
        let (result, metrics) = super::evaluate_lane(&lane).expect("evaluate");
        let utility = result.controlled_utility.expect("utility");
        assert_eq!(utility.expected_first_hit_rate, 1.0);
        assert_eq!(utility.forbidden_hit_rate_at_10, 0.0);
        assert_eq!(utility.deleted_hit_count, 0);
        assert_eq!(utility.filter_violation_count, 0);
        assert!(metrics.iter().all(|value| value.recall_at_100 == 1.0));
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
            let compacted = durable_compacted_index(&initial).expect("compacted");
            let stopped =
                write_generation(&root, 2, &compacted, Some(scenario)).expect("stopped write");
            assert!(stopped.boundary_reached);
            let active = recover_active_generation(&root).expect("recover before retry");
            assert_eq!(active.generation, scenario.expected_active_generation());

            let previous = env::current_dir().expect("current directory");
            env::set_current_dir(&root).expect("enter root");
            let result = run_recovery(scenario);
            env::set_current_dir(previous).expect("leave root");
            let result = result.expect("recovery");
            assert_eq!(
                result.observed_generation_before_retry,
                scenario.expected_active_generation()
            );
            assert_eq!(result.final_generation, 2);
            assert!(result.retry_idempotent);
            assert_eq!(result.final_target_identifier_matches, 0);
            assert_eq!(result.final_target_vector_fingerprint_matches, 0);
            assert!(!result.active_index_contains_any_deleted_target);
            assert!(!result.active_index_contains_active_deleted_target);
            assert!(durable_target_ids().iter().all(|external_id| {
                !recover_active_generation(&root)
                    .expect("final active")
                    .index
                    .contains_any(*external_id)
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
}
