//! Black-box conformance tests for the preregistered exact-flat f32 baseline.

use std::collections::BTreeSet;

use tinyrustlm_vector_oracle::{
    sha256, CalibrationIdentity, ExactFlatIndex, ExactFlatIndexBuilder, FlatIndexConfig,
    FlatIndexConfigSpec, FlatIndexError, RetrievalMetric, RetrievalTransform, VectorNormalization,
};

fn hash(byte: u8) -> [u8; 32] {
    [byte; 32]
}

fn config(
    dimension: usize,
    metric: RetrievalMetric,
    normalization: VectorNormalization,
    transform: RetrievalTransform,
) -> FlatIndexConfig {
    FlatIndexConfig::from_spec(FlatIndexConfigSpec {
        dimension,
        metric,
        normalization,
        transform,
        transform_seed: if transform == RetrievalTransform::None {
            0
        } else {
            20260722
        },
        embedding_model_sha256: hash(1),
        tokenizer_sha256: hash(2),
        codebook_sha256: None,
        calibration: CalibrationIdentity::None,
        implementation_sha256: hash(3),
    })
    .expect("valid exact-flat configuration")
}

fn build_in_order(order: &[u64]) -> ExactFlatIndex {
    let vectors = [
        (10, [0.0, 1.0, 0.0]),
        (20, [1.0, 0.0, 0.0]),
        (30, [1.0, 1.0, 0.0]),
    ];
    let mut builder = ExactFlatIndexBuilder::new(
        config(
            3,
            RetrievalMetric::DotProduct,
            VectorNormalization::None,
            RetrievalTransform::None,
        ),
        hash(9),
    )
    .expect("builder");
    for id in order {
        let vector = vectors
            .iter()
            .find(|(candidate, _)| candidate == id)
            .expect("known id")
            .1;
        builder.insert(*id, &vector).expect("unique record");
    }
    builder.finish()
}

#[test]
fn sha256_matches_normative_vectors_and_multiblock_boundary() {
    fn hex(bytes: [u8; 32]) -> String {
        bytes.iter().map(|byte| format!("{byte:02x}")).collect()
    }

    assert_eq!(
        hex(sha256(b"")),
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    assert_eq!(
        hex(sha256(b"abc")),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    assert_eq!(
        hex(sha256(
            b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
        )),
        "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    );
}

#[test]
fn build_order_is_byte_invariant_and_restart_is_exact() {
    let ascending = build_in_order(&[10, 20, 30]);
    let shuffled = build_in_order(&[30, 10, 20]);
    let bytes = ascending.to_bytes().expect("serialize");

    assert_eq!(bytes, shuffled.to_bytes().expect("serialize shuffled"));
    let restarted = ExactFlatIndex::from_bytes(&bytes).expect("restart");
    assert_eq!(bytes, restarted.to_bytes().expect("reserialize"));
    assert_eq!(restarted.record_count(), 3);
    assert_eq!(restarted.active_record_count(), 3);
    assert_eq!(restarted.record_set_revision(), &hash(9));
}

#[test]
fn exact_dot_search_is_stable_filtered_and_tie_broken_by_id() {
    let index = build_in_order(&[30, 20, 10]);
    let all = index.search(&[1.0, 0.0, 0.0], 3, None).expect("search");
    assert_eq!(
        all.iter().map(|hit| hit.external_id).collect::<Vec<_>>(),
        vec![20, 30, 10]
    );
    assert_eq!(
        all.iter().map(|hit| hit.score).collect::<Vec<_>>(),
        vec![1.0, 1.0, 0.0]
    );

    let allowed = BTreeSet::from([10, 30]);
    let filtered = index
        .search(&[1.0, 0.0, 0.0], 3, Some(&allowed))
        .expect("filtered search");
    assert_eq!(
        filtered
            .iter()
            .map(|hit| hit.external_id)
            .collect::<Vec<_>>(),
        vec![30, 10]
    );
}

#[test]
fn euclidean_and_cosine_match_independent_scalar_rankings() {
    let mut euclidean = ExactFlatIndexBuilder::new(
        config(
            3,
            RetrievalMetric::SquaredEuclidean,
            VectorNormalization::None,
            RetrievalTransform::SignedPermutation,
        ),
        hash(10),
    )
    .expect("euclidean builder");
    euclidean.insert(2, &[2.0, 0.0, 0.0]).expect("record");
    euclidean.insert(1, &[1.0, 0.0, 0.0]).expect("record");
    let euclidean = euclidean.finish();
    let hits = euclidean
        .search(&[1.25, 0.0, 0.0], 2, None)
        .expect("search");
    assert_eq!(hits[0].external_id, 1);
    assert_eq!(hits[0].score, 0.0625);
    assert_eq!(hits[1].external_id, 2);
    assert_eq!(hits[1].score, 0.5625);

    let mut cosine = ExactFlatIndexBuilder::new(
        config(
            4,
            RetrievalMetric::Cosine,
            VectorNormalization::L2Unit,
            RetrievalTransform::SignedHadamard,
        ),
        hash(11),
    )
    .expect("cosine builder");
    cosine.insert(1, &[10.0, 0.0, 0.0, 0.0]).expect("record");
    cosine.insert(2, &[0.0, 3.0, 0.0, 0.0]).expect("record");
    let cosine = cosine.finish();
    let hits = cosine
        .search(&[5.0, 0.0, 0.0, 0.0], 2, None)
        .expect("search");
    assert_eq!(hits[0].external_id, 1);
    assert!((hits[0].score - 1.0).abs() <= f64::EPSILON);
    assert!(hits[1].score.abs() <= f64::EPSILON);
}

#[test]
fn tombstone_zeroes_vector_compaction_removes_record_and_revision_changes() {
    let index = build_in_order(&[10, 20, 30]);
    let deleted = index.with_deleted(20, hash(12)).expect("delete snapshot");
    assert_eq!(deleted.record_count(), 3);
    assert_eq!(deleted.active_record_count(), 2);
    assert_eq!(deleted.record_set_revision(), &hash(12));
    assert!(!deleted.contains_active(20));
    assert!(deleted
        .search(&[1.0, 0.0, 0.0], 3, None)
        .expect("search")
        .iter()
        .all(|hit| hit.external_id != 20));

    let restarted = ExactFlatIndex::from_bytes(&deleted.to_bytes().expect("serialize deletion"))
        .expect("restart deletion");
    assert!(!restarted.contains_active(20));

    let compacted = restarted.compacted(hash(13)).expect("compact");
    assert_eq!(compacted.record_count(), 2);
    assert_eq!(compacted.active_record_count(), 2);
    assert_eq!(compacted.record_set_revision(), &hash(13));
    assert!(!compacted.contains_any(20));
    assert!(
        compacted.to_bytes().expect("compacted bytes").len()
            < deleted.to_bytes().expect("deleted bytes").len()
    );
}

#[test]
fn duplicate_invalid_vector_revision_and_configuration_fail_closed() {
    let mut builder = ExactFlatIndexBuilder::new(
        config(
            3,
            RetrievalMetric::DotProduct,
            VectorNormalization::None,
            RetrievalTransform::None,
        ),
        hash(14),
    )
    .expect("builder");
    builder.insert(1, &[1.0, 2.0, 3.0]).expect("record");
    assert_eq!(
        builder.insert(1, &[3.0, 2.0, 1.0]),
        Err(FlatIndexError::DuplicateExternalId)
    );
    assert_eq!(
        builder.insert(2, &[1.0, f32::NAN, 3.0]),
        Err(FlatIndexError::NonFiniteVector { index: 1 })
    );
    assert_eq!(
        builder.insert(2, &[1.0, 2.0]),
        Err(FlatIndexError::VectorLengthMismatch {
            expected: 3,
            actual: 2,
        })
    );
    let index = builder.finish();
    assert_eq!(
        index.with_deleted(1, hash(14)),
        Err(FlatIndexError::RevisionNotAdvanced)
    );
    assert_eq!(
        index.search(&[1.0, 2.0], 1, None),
        Err(FlatIndexError::VectorLengthMismatch {
            expected: 3,
            actual: 2,
        })
    );

    let invalid_cosine = FlatIndexConfig::from_spec(FlatIndexConfigSpec {
        dimension: 3,
        metric: RetrievalMetric::Cosine,
        normalization: VectorNormalization::None,
        transform: RetrievalTransform::None,
        transform_seed: 0,
        embedding_model_sha256: hash(1),
        tokenizer_sha256: hash(2),
        codebook_sha256: None,
        calibration: CalibrationIdentity::None,
        implementation_sha256: hash(3),
    });
    assert_eq!(
        invalid_cosine,
        Err(FlatIndexError::CosineRequiresL2Normalization)
    );
}

#[test]
fn corrupted_truncated_extended_and_oversized_bytes_are_rejected() {
    let bytes = build_in_order(&[10, 20, 30]).to_bytes().expect("bytes");

    let mut corrupted = bytes.clone();
    corrupted[260] ^= 0x01;
    assert_eq!(
        ExactFlatIndex::from_bytes(&corrupted),
        Err(FlatIndexError::DigestMismatch)
    );

    assert_eq!(
        ExactFlatIndex::from_bytes(&bytes[..bytes.len() - 1]),
        Err(FlatIndexError::SerializedLengthMismatch)
    );

    let mut extended = bytes.clone();
    extended.push(0);
    assert_eq!(
        ExactFlatIndex::from_bytes(&extended),
        Err(FlatIndexError::SerializedLengthMismatch)
    );

    let oversized = vec![0_u8; tinyrustlm_vector_oracle::MAX_FLAT_INDEX_BYTES + 1];
    assert_eq!(
        ExactFlatIndex::from_bytes(&oversized),
        Err(FlatIndexError::SerializedBytesOutOfRange)
    );
}

#[test]
fn empty_index_round_trips_and_zero_norm_cosine_query_is_rejected() {
    let index = ExactFlatIndexBuilder::new(
        config(
            4,
            RetrievalMetric::Cosine,
            VectorNormalization::L2Unit,
            RetrievalTransform::None,
        ),
        hash(15),
    )
    .expect("builder")
    .finish();
    let bytes = index.to_bytes().expect("serialize empty");
    let restarted = ExactFlatIndex::from_bytes(&bytes).expect("restart empty");
    assert!(restarted
        .search(&[1.0, 0.0, 0.0, 0.0], 1, None)
        .expect("empty search")
        .is_empty());
    assert_eq!(
        restarted.search(&[0.0, 0.0, 0.0, 0.0], 1, None),
        Err(FlatIndexError::ZeroNormVector)
    );
}
