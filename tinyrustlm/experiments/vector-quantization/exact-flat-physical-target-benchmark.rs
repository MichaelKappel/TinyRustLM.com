#![forbid(unsafe_code)]

use std::fmt::Write as _;
use std::hint::black_box;
use std::process::{self, Command};
use std::time::{Duration, Instant};

use tinyrustlm_vector_oracle::{
    sha256, CalibrationIdentity, DeterministicRng, ExactFlatIndex, ExactFlatIndexBuilder,
    FlatIndexConfig, FlatIndexConfigSpec, RetrievalMetric, RetrievalTransform, VectorNormalization,
};

const SAMPLE_SCHEMA: &str = "tinyrustlm.exact_flat_physical_target_sample.v1";
const IMPLEMENTATION_RECEIPT_SHA256: &str =
    "893e96f461f701f46a3aaaeecddd67bc2b700625ccdb9f0d83ce4b0b67d8c18c";
const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;

#[derive(Clone, Copy)]
struct Workload {
    id: &'static str,
    metric_label: &'static str,
    metric: RetrievalMetric,
    normalization_label: &'static str,
    normalization: VectorNormalization,
    dimension: usize,
    record_count: usize,
    top_k: usize,
    warmup_queries: usize,
    measured_queries: usize,
    seed: u64,
}

const WORKLOADS: [Workload; 3] = [
    Workload {
        id: "dot-128x1000",
        metric_label: "dot-product",
        metric: RetrievalMetric::DotProduct,
        normalization_label: "none",
        normalization: VectorNormalization::None,
        dimension: 128,
        record_count: 1_000,
        top_k: 10,
        warmup_queries: 8,
        measured_queries: 64,
        seed: 0x243f_6a88_85a3_08d3,
    },
    Workload {
        id: "cosine-384x10000",
        metric_label: "cosine",
        metric: RetrievalMetric::Cosine,
        normalization_label: "l2-unit",
        normalization: VectorNormalization::L2Unit,
        dimension: 384,
        record_count: 10_000,
        top_k: 10,
        warmup_queries: 5,
        measured_queries: 32,
        seed: 0x1319_8a2e_0370_7344,
    },
    Workload {
        id: "squared-euclidean-768x25000",
        metric_label: "squared-euclidean",
        metric: RetrievalMetric::SquaredEuclidean,
        normalization_label: "none",
        normalization: VectorNormalization::None,
        dimension: 768,
        record_count: 25_000,
        top_k: 10,
        warmup_queries: 3,
        measured_queries: 12,
        seed: 0xa409_3822_299f_31d0,
    },
];

#[derive(Clone, Copy)]
struct MemorySample {
    working_set_bytes: u64,
    peak_working_set_bytes: u64,
}

struct Sample {
    workload: Workload,
    process_run: usize,
    build_duration_ns: u64,
    warmup_duration_ns: u64,
    query_duration_ns: Vec<u64>,
    validation_checksum: u64,
    serialized_index_bytes: usize,
    after_build: MemorySample,
    after_search: MemorySample,
    peak_after_serialization_bytes: u64,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("benchmark_error:{error}");
        process::exit(1);
    }
}

fn run() -> Result<(), &'static str> {
    let arguments: Vec<String> = std::env::args().collect();
    if arguments.len() != 5 || arguments[1] != "--workload" || arguments[3] != "--run" {
        return Err("arguments");
    }
    let workload = WORKLOADS
        .iter()
        .copied()
        .find(|candidate| candidate.id == arguments[2])
        .ok_or("workload")?;
    let process_run = arguments[4].parse::<usize>().map_err(|_| "run")?;
    if !(1..=3).contains(&process_run) {
        return Err("run");
    }
    let sample = execute(workload, process_run)?;
    println!("{}", sample_json(&sample)?);
    Ok(())
}

fn execute(workload: Workload, process_run: usize) -> Result<Sample, &'static str> {
    let config = FlatIndexConfig::from_spec(FlatIndexConfigSpec {
        dimension: workload.dimension,
        metric: workload.metric,
        normalization: workload.normalization,
        transform: RetrievalTransform::None,
        transform_seed: 0,
        embedding_model_sha256: sha256(b"tinyrustlm-synthetic-target-embedding-v1"),
        tokenizer_sha256: sha256(b"tinyrustlm-synthetic-target-tokenizer-v1"),
        codebook_sha256: None,
        calibration: CalibrationIdentity::None,
        implementation_sha256: parse_hash(IMPLEMENTATION_RECEIPT_SHA256)?,
    })
    .map_err(|_| "config")?;

    let mut revision_material = Vec::from(workload.id.as_bytes());
    revision_material.extend_from_slice(&workload.seed.to_le_bytes());
    let build_start = Instant::now();
    let mut builder =
        ExactFlatIndexBuilder::new(config, sha256(&revision_material)).map_err(|_| "builder")?;
    let mut record_rng = DeterministicRng::new(workload.seed);
    for external_id in 1..=workload.record_count {
        let vector = generate_vector(&mut record_rng, workload.dimension);
        builder
            .insert(
                u64::try_from(external_id).map_err(|_| "external_id")?,
                &vector,
            )
            .map_err(|_| "insert")?;
    }
    let index = builder.finish();
    let build_duration_ns = duration_ns(build_start.elapsed())?;
    if index.active_record_count() != workload.record_count {
        return Err("record_count");
    }
    let after_build = memory_sample()?;

    let query_count = workload
        .warmup_queries
        .checked_add(workload.measured_queries)
        .ok_or("query_count")?;
    let mut query_rng = DeterministicRng::new(workload.seed ^ 0xd131_0ba6_98df_b5ac);
    let queries: Vec<Vec<f32>> = (0..query_count)
        .map(|_| generate_vector(&mut query_rng, workload.dimension))
        .collect();

    let mut validation_checksum = FNV_OFFSET;
    let warmup_start = Instant::now();
    for query in &queries[..workload.warmup_queries] {
        let hits = index
            .search(query, workload.top_k, None)
            .map_err(|_| "warmup_search")?;
        validate_hits(&hits, workload.top_k)?;
        update_checksum(&mut validation_checksum, &hits);
        black_box(&hits);
    }
    let warmup_duration_ns = duration_ns(warmup_start.elapsed())?;

    let mut query_duration_ns = Vec::with_capacity(workload.measured_queries);
    for query in &queries[workload.warmup_queries..] {
        let started = Instant::now();
        let hits = index
            .search(query, workload.top_k, None)
            .map_err(|_| "measured_search")?;
        let elapsed = duration_ns(started.elapsed())?;
        validate_hits(&hits, workload.top_k)?;
        update_checksum(&mut validation_checksum, &hits);
        black_box(&hits);
        if elapsed == 0 {
            return Err("zero_duration");
        }
        query_duration_ns.push(elapsed);
    }
    let after_search = memory_sample()?;

    let serialized = index.to_bytes().map_err(|_| "serialize")?;
    let serialized_index_bytes = serialized.len();
    let restarted = ExactFlatIndex::from_bytes(&serialized).map_err(|_| "restart")?;
    if restarted.record_count() != workload.record_count
        || restarted.active_record_count() != workload.record_count
    {
        return Err("restart_count");
    }
    black_box(&restarted);
    let after_serialization = memory_sample()?;

    if after_build.working_set_bytes == 0
        || after_build.peak_working_set_bytes < after_build.working_set_bytes
        || after_search.working_set_bytes == 0
        || after_search.peak_working_set_bytes < after_search.working_set_bytes
        || after_search.peak_working_set_bytes < after_build.peak_working_set_bytes
        || after_serialization.peak_working_set_bytes < after_search.peak_working_set_bytes
    {
        return Err("memory_monotonicity");
    }

    Ok(Sample {
        workload,
        process_run,
        build_duration_ns,
        warmup_duration_ns,
        query_duration_ns,
        validation_checksum,
        serialized_index_bytes,
        after_build,
        after_search,
        peak_after_serialization_bytes: after_serialization.peak_working_set_bytes,
    })
}

fn generate_vector(rng: &mut DeterministicRng, dimension: usize) -> Vec<f32> {
    (0..dimension)
        .map(|_| {
            let value = (rng.next_unit_f64() * 2.0 - 1.0) as f32;
            if value == 0.0 {
                f32::EPSILON
            } else {
                value
            }
        })
        .collect()
}

fn validate_hits(
    hits: &[tinyrustlm_vector_oracle::SearchHit],
    expected: usize,
) -> Result<(), &'static str> {
    if hits.len() != expected || hits.iter().any(|hit| !hit.score.is_finite()) {
        return Err("hits");
    }
    Ok(())
}

fn update_checksum(checksum: &mut u64, hits: &[tinyrustlm_vector_oracle::SearchHit]) {
    for hit in hits {
        for byte in hit.external_id.to_le_bytes() {
            *checksum = (*checksum ^ u64::from(byte)).wrapping_mul(FNV_PRIME);
        }
        for byte in hit.score.to_bits().to_le_bytes() {
            *checksum = (*checksum ^ u64::from(byte)).wrapping_mul(FNV_PRIME);
        }
    }
}

fn memory_sample() -> Result<MemorySample, &'static str> {
    if !cfg!(windows) {
        return Err("memory_probe_platform");
    }
    let script = format!(
        "$p=Get-Process -Id {} -ErrorAction Stop; Write-Output ($p.WorkingSet64.ToString() + ',' + $p.PeakWorkingSet64.ToString())",
        process::id()
    );
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|_| "memory_probe_spawn")?;
    if !output.status.success() || !output.stderr.is_empty() {
        return Err("memory_probe_status");
    }
    let text = std::str::from_utf8(&output.stdout)
        .map_err(|_| "memory_probe_utf8")?
        .trim();
    let (working, peak) = text.split_once(',').ok_or("memory_probe_shape")?;
    let working_set_bytes = working.parse::<u64>().map_err(|_| "memory_probe_working")?;
    let peak_working_set_bytes = peak.parse::<u64>().map_err(|_| "memory_probe_peak")?;
    Ok(MemorySample {
        working_set_bytes,
        peak_working_set_bytes,
    })
}

fn duration_ns(duration: Duration) -> Result<u64, &'static str> {
    u64::try_from(duration.as_nanos()).map_err(|_| "duration_overflow")
}

fn parse_hash(hex: &str) -> Result<[u8; 32], &'static str> {
    if hex.len() != 64 {
        return Err("hash_length");
    }
    let mut result = [0_u8; 32];
    for (index, output) in result.iter_mut().enumerate() {
        let start = index.checked_mul(2).ok_or("hash_offset")?;
        *output = u8::from_str_radix(&hex[start..start + 2], 16).map_err(|_| "hash_hex")?;
    }
    Ok(result)
}

fn sample_json(sample: &Sample) -> Result<String, &'static str> {
    let workload = sample.workload;
    let mut output = String::with_capacity(4096);
    write!(
        output,
        "{{\"schema\":\"{SAMPLE_SCHEMA}\",\"workloadId\":\"{}\",\"processRun\":{},\"metric\":\"{}\",\"normalization\":\"{}\",\"dimension\":{},\"recordCount\":{},\"topK\":{},\"warmupQueries\":{},\"measuredQueries\":{},\"seed\":\"{:016x}\",\"implementationReceiptSha256\":\"{IMPLEMENTATION_RECEIPT_SHA256}\",\"buildDurationNs\":{},\"warmupDurationNs\":{},\"queryDurationNs\":[",
        workload.id,
        sample.process_run,
        workload.metric_label,
        workload.normalization_label,
        workload.dimension,
        workload.record_count,
        workload.top_k,
        workload.warmup_queries,
        workload.measured_queries,
        workload.seed,
        sample.build_duration_ns,
        sample.warmup_duration_ns
    )
    .map_err(|_| "json_write")?;
    for (index, duration) in sample.query_duration_ns.iter().enumerate() {
        if index != 0 {
            output.push(',');
        }
        write!(output, "{duration}").map_err(|_| "json_write")?;
    }
    write!(
        output,
        "],\"validationChecksum\":\"{:016x}\",\"serializedIndexBytes\":{},\"workingSetAfterBuildBytes\":{},\"peakWorkingSetAfterBuildBytes\":{},\"workingSetAfterSearchBytes\":{},\"peakWorkingSetAfterSearchBytes\":{},\"peakWorkingSetAfterSerializationBytes\":{}}}",
        sample.validation_checksum,
        sample.serialized_index_bytes,
        sample.after_build.working_set_bytes,
        sample.after_build.peak_working_set_bytes,
        sample.after_search.working_set_bytes,
        sample.after_search.peak_working_set_bytes,
        sample.peak_after_serialization_bytes
    )
    .map_err(|_| "json_write")?;
    Ok(output)
}
