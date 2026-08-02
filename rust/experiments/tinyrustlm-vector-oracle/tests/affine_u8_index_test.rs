//! Black-box conformance tests for the preregistered portable affine-u8 index.

use std::collections::BTreeSet;

use tinyrustlm_vector_oracle::{
    sha256, AffineU8Config, AffineU8ConfigSpec, AffineU8Error, AffineU8Index, AffineU8IndexBuilder,
    RetrievalMetric, VectorNormalization, AFFINE_U8_FOOTER_BYTES, AFFINE_U8_HEADER_BYTES,
    MAX_AFFINE_U8_DIMENSION,
};

fn config(
    dimension: usize,
    metric: RetrievalMetric,
    normalization: VectorNormalization,
) -> AffineU8Config {
    AffineU8Config::from_spec(AffineU8ConfigSpec {
        dimension,
        metric,
        normalization,
    })
    .expect("valid affine-u8 configuration")
}

fn build_dot(order: &[u64]) -> AffineU8Index {
    let vectors = [
        (10, [0.0, 1.0, 0.0]),
        (20, [1.0, 0.0, 0.0]),
        (30, [1.0, 1.0, -0.0]),
    ];
    let mut builder = AffineU8IndexBuilder::new(config(
        3,
        RetrievalMetric::DotProduct,
        VectorNormalization::None,
    ));
    for id in order {
        let vector = vectors
            .iter()
            .find(|(candidate, _)| candidate == id)
            .expect("known identifier")
            .1;
        builder.insert(*id, &vector).expect("unique record");
    }
    builder.finish().expect("affine-u8 index")
}

fn rehash(bytes: &mut [u8]) {
    let body_end = bytes.len() - AFFINE_U8_FOOTER_BYTES;
    let digest = sha256(&bytes[..body_end]);
    bytes[body_end..].copy_from_slice(&digest);
}

#[test]
fn build_order_bytes_reload_and_size_formula_are_exact() {
    let ascending = build_dot(&[10, 20, 30]);
    let shuffled = build_dot(&[30, 10, 20]);
    let bytes = ascending.to_bytes().expect("serialize");

    assert_eq!(bytes, shuffled.to_bytes().expect("serialize shuffled"));
    assert_eq!(bytes.len(), 96 + 3 * (8 + 3));
    assert_eq!(&bytes[..8], b"TRU8F001");
    assert_eq!(
        u32::from_le_bytes(bytes[28..32].try_into().expect("record bytes")),
        11
    );
    assert_eq!(
        f32::from_bits(u32::from_le_bytes(
            bytes[32..36].try_into().expect("minimum")
        )),
        0.0
    );
    assert_eq!(
        f32::from_bits(u32::from_le_bytes(
            bytes[36..40].try_into().expect("maximum")
        )),
        1.0
    );

    let restarted = AffineU8Index::from_bytes(&bytes).expect("restart");
    assert_eq!(restarted, ascending);
    assert_eq!(restarted.to_bytes().expect("reserialize"), bytes);
    assert_eq!(restarted.record_count(), 3);
    assert_eq!(restarted.calibration_minimum().to_bits(), 0);
}

#[test]
fn dot_search_is_stable_filtered_and_tie_broken_by_identifier() {
    let index = build_dot(&[30, 20, 10]);
    let hits = index.search(&[1.0, 0.0, 0.0], 3, None).expect("search");
    assert_eq!(
        hits.iter().map(|hit| hit.external_id).collect::<Vec<_>>(),
        vec![20, 30, 10]
    );
    assert_eq!(
        hits.iter().map(|hit| hit.score).collect::<Vec<_>>(),
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
fn euclidean_and_cosine_reconstruct_then_rank_without_source_vectors() {
    let mut euclidean = AffineU8IndexBuilder::new(config(
        3,
        RetrievalMetric::SquaredEuclidean,
        VectorNormalization::None,
    ));
    euclidean.insert(2, &[2.0, 0.0, 0.0]).expect("record");
    euclidean.insert(1, &[1.0, 0.0, 0.0]).expect("record");
    let euclidean = euclidean.finish().expect("index");
    let hits = euclidean
        .search(&[1.25, 0.0, 0.0], 2, None)
        .expect("search");
    let reconstructed_one = 128.0 * 2.0 / 255.0;
    assert_eq!(hits[0].external_id, 1);
    assert_eq!(hits[0].score, (1.25_f64 - reconstructed_one).powi(2));
    assert_eq!(hits[1].external_id, 2);
    assert_eq!(hits[1].score, 0.5625);

    let mut cosine = AffineU8IndexBuilder::new(config(
        4,
        RetrievalMetric::Cosine,
        VectorNormalization::L2Unit,
    ));
    cosine.insert(1, &[10.0, 0.0, 0.0, 0.0]).expect("record");
    cosine.insert(2, &[0.0, 3.0, 0.0, 0.0]).expect("record");
    let cosine = cosine.finish().expect("index");
    let bytes = cosine.to_bytes().expect("bytes");
    let restarted = AffineU8Index::from_bytes(&bytes).expect("restart");
    let hits = restarted
        .search(&[5.0, 0.0, 0.0, 0.0], 2, None)
        .expect("search");
    assert_eq!(hits[0].external_id, 1);
    assert!((hits[0].score - 1.0).abs() <= f64::EPSILON);
    assert_eq!(hits[1].score, 0.0);
}

#[test]
fn compact_rebuild_removes_identifier_and_active_record_fingerprint() {
    let vectors = [
        (10_u64, [0.0_f32, 0.0, 0.0, 0.0]),
        (20_u64, [0.25_f32, 0.5, 0.75, 1.0]),
        (30_u64, [1.0_f32, 0.75, 0.5, 0.25]),
    ];
    let config = config(
        4,
        RetrievalMetric::SquaredEuclidean,
        VectorNormalization::None,
    );
    let mut first = AffineU8IndexBuilder::new(config);
    for (id, vector) in vectors {
        first.insert(id, &vector).expect("initial record");
    }
    let first = first.finish().expect("initial generation");
    let first_bytes = first.to_bytes().expect("initial bytes");
    let deleted_record_offset = AFFINE_U8_HEADER_BYTES + (8 + 4);
    let deleted_fingerprint = &first_bytes[deleted_record_offset..deleted_record_offset + 12];

    let mut compacted = AffineU8IndexBuilder::new(config);
    for (id, vector) in vectors {
        if id != 20 {
            compacted.insert(id, &vector).expect("surviving record");
        }
    }
    let compacted = compacted.finish().expect("compacted generation");
    let compacted_bytes = compacted.to_bytes().expect("compacted bytes");
    let restarted = AffineU8Index::from_bytes(&compacted_bytes).expect("restart compacted");

    assert!(!restarted.contains(20));
    assert_eq!(restarted.record_count(), 2);
    assert_eq!(compacted_bytes.len(), 96 + 2 * (8 + 4));
    assert!(!compacted_bytes
        .windows(deleted_fingerprint.len())
        .any(|window| window == deleted_fingerprint));
    assert!(restarted
        .search(&vectors[1].1, 2, None)
        .expect("search after deletion")
        .iter()
        .all(|hit| hit.external_id != 20));
}

#[test]
fn stale_digest_fails_before_hostile_counts_can_control_allocation() {
    let bytes = build_dot(&[10, 20, 30]).to_bytes().expect("bytes");
    let mut hostile = bytes;
    hostile[16..20].copy_from_slice(&u32::MAX.to_le_bytes());
    hostile[20..24].copy_from_slice(&u32::MAX.to_le_bytes());

    assert_eq!(
        AffineU8Index::from_bytes(&hostile),
        Err(AffineU8Error::DigestMismatch)
    );
}

#[test]
fn every_preregistered_corruption_shape_rejects_before_search() {
    let bytes = build_dot(&[10, 20, 30]).to_bytes().expect("bytes");
    let mutation_offsets = [
        24,
        AFFINE_U8_HEADER_BYTES,
        AFFINE_U8_HEADER_BYTES + 8,
        bytes.len() - 1,
    ];
    for offset in mutation_offsets {
        let mut corrupted = bytes.clone();
        corrupted[offset] ^= 0x01;
        assert!(AffineU8Index::from_bytes(&corrupted).is_err());
    }

    assert!(AffineU8Index::from_bytes(&bytes[..bytes.len() - 1]).is_err());
    let mut appended = bytes;
    appended.push(0);
    assert!(AffineU8Index::from_bytes(&appended).is_err());
}

#[test]
fn recomputed_digest_cannot_authorize_unknown_or_noncanonical_fields() {
    let bytes = build_dot(&[10, 20, 30]).to_bytes().expect("bytes");

    let cases = [
        (12_usize, 1_u8, AffineU8Error::UnknownFlags),
        (24, 99, AffineU8Error::InvalidHeader),
        (25, 99, AffineU8Error::InvalidHeader),
        (26, 99, AffineU8Error::InvalidHeader),
        (27, 7, AffineU8Error::InvalidHeader),
        (40, 1, AffineU8Error::InvalidHeader),
    ];
    for (offset, value, expected) in cases {
        let mut changed = bytes.clone();
        changed[offset] = value;
        rehash(&mut changed);
        assert_eq!(AffineU8Index::from_bytes(&changed), Err(expected));
    }

    let mut duplicate_id = bytes.clone();
    let first_id = duplicate_id[AFFINE_U8_HEADER_BYTES..AFFINE_U8_HEADER_BYTES + 8].to_vec();
    let second_id_offset = AFFINE_U8_HEADER_BYTES + 11;
    duplicate_id[second_id_offset..second_id_offset + 8].copy_from_slice(&first_id);
    rehash(&mut duplicate_id);
    assert_eq!(
        AffineU8Index::from_bytes(&duplicate_id),
        Err(AffineU8Error::InvalidRecordOrder)
    );

    let mut negative_zero = bytes;
    negative_zero[32..36].copy_from_slice(&(-0.0_f32).to_bits().to_le_bytes());
    rehash(&mut negative_zero);
    assert_eq!(
        AffineU8Index::from_bytes(&negative_zero),
        Err(AffineU8Error::InvalidCalibration)
    );
}

#[test]
fn invalid_inputs_and_stable_error_codes_fail_closed() {
    assert_eq!(
        AffineU8Config::from_spec(AffineU8ConfigSpec {
            dimension: MAX_AFFINE_U8_DIMENSION + 1,
            metric: RetrievalMetric::DotProduct,
            normalization: VectorNormalization::None,
        }),
        Err(AffineU8Error::DimensionOutOfRange)
    );
    assert_eq!(
        AffineU8Config::from_spec(AffineU8ConfigSpec {
            dimension: 3,
            metric: RetrievalMetric::Cosine,
            normalization: VectorNormalization::None,
        }),
        Err(AffineU8Error::CosineRequiresL2Normalization)
    );

    let config = config(3, RetrievalMetric::DotProduct, VectorNormalization::None);
    assert_eq!(
        AffineU8IndexBuilder::new(config).finish(),
        Err(AffineU8Error::EmptyRecordSet)
    );

    let mut builder = AffineU8IndexBuilder::new(config);
    builder.insert(1, &[1.0, 2.0, 3.0]).expect("record");
    assert_eq!(
        builder.insert(1, &[3.0, 2.0, 1.0]),
        Err(AffineU8Error::DuplicateExternalId)
    );
    assert_eq!(
        builder.insert(2, &[1.0, f32::NAN, 3.0]),
        Err(AffineU8Error::NonFiniteVector { index: 1 })
    );
    assert_eq!(
        builder.insert(2, &[1.0, 2.0]),
        Err(AffineU8Error::VectorLengthMismatch {
            expected: 3,
            actual: 2,
        })
    );
    let index = builder.finish().expect("index");
    assert_eq!(
        index.search(&[1.0, 2.0], 1, None),
        Err(AffineU8Error::VectorLengthMismatch {
            expected: 3,
            actual: 2,
        })
    );
    assert_eq!(
        index.search(&[1.0, 2.0, 3.0], 0, None),
        Err(AffineU8Error::SearchLimitOutOfRange)
    );
    assert_eq!(AffineU8Error::DigestMismatch.code(), "digest-mismatch");
    assert_eq!(
        AffineU8Error::VectorLengthMismatch {
            expected: 3,
            actual: 2,
        }
        .code(),
        "vector-length-mismatch"
    );
}

#[test]
fn zero_norm_inputs_and_zero_norm_cosine_reconstruction_are_rejected() {
    let cosine = config(2, RetrievalMetric::Cosine, VectorNormalization::L2Unit);
    let mut zero_input = AffineU8IndexBuilder::new(cosine);
    assert_eq!(
        zero_input.insert(1, &[0.0, 0.0]),
        Err(AffineU8Error::ZeroNormVector)
    );

    let mut constant_zero = AffineU8IndexBuilder::new(config(
        2,
        RetrievalMetric::DotProduct,
        VectorNormalization::None,
    ));
    constant_zero.insert(1, &[0.0, 0.0]).expect("record");
    let mut bytes = constant_zero
        .finish()
        .expect("constant-zero index")
        .to_bytes()
        .expect("bytes");
    bytes[24] = 3;
    bytes[25] = 1;
    rehash(&mut bytes);
    assert_eq!(
        AffineU8Index::from_bytes(&bytes),
        Err(AffineU8Error::ZeroNormReconstructedRecord)
    );
}

#[test]
fn finite_f32_extremes_calibrate_without_overflow() {
    let mut builder = AffineU8IndexBuilder::new(config(
        2,
        RetrievalMetric::DotProduct,
        VectorNormalization::None,
    ));
    builder
        .insert(1, &[f32::MIN, f32::MAX])
        .expect("finite extremes");
    let index = builder.finish().expect("index");
    assert_eq!(index.calibration_minimum(), f32::MIN);
    assert_eq!(index.calibration_maximum(), f32::MAX);
    assert!(index.to_bytes().expect("bytes").len() == 96 + 8 + 2);
}

#[test]
fn native_and_wasm_conformance_vector_has_pinned_bytes_scores_ids_and_error_code() {
    let mut builder = AffineU8IndexBuilder::new(config(
        3,
        RetrievalMetric::DotProduct,
        VectorNormalization::None,
    ));
    builder.insert(2, &[1.0, -1.0, 0.0]).expect("record");
    builder.insert(1, &[-1.0, 0.0, 1.0]).expect("record");
    let index = builder.finish().expect("index");
    let bytes = index.to_bytes().expect("bytes");

    assert_eq!(bytes.len(), 118);
    assert_eq!(
        sha256(&bytes),
        [
            0xe9, 0x2e, 0xf4, 0x94, 0x6a, 0x89, 0xef, 0x47, 0x7f, 0x6a, 0xb6, 0xef, 0x62, 0x05,
            0xa4, 0xab, 0xbd, 0x6d, 0xe1, 0xfa, 0xe7, 0xfc, 0x4a, 0x99, 0xdd, 0x50, 0x0b, 0x64,
            0x5e, 0x1f, 0x12, 0xf8,
        ]
    );
    assert_eq!(
        &bytes[bytes.len() - AFFINE_U8_FOOTER_BYTES..],
        &[
            0x86, 0x4f, 0x32, 0x91, 0xad, 0x4d, 0xea, 0x0e, 0x77, 0x10, 0xd1, 0xb5, 0xbd, 0xd4,
            0x82, 0x07, 0x88, 0x18, 0xa2, 0xab, 0x42, 0x84, 0x40, 0xb5, 0xcf, 0x25, 0x7c, 0xaa,
            0x15, 0xb7, 0x2f, 0x72,
        ]
    );
    let hits = index.search(&[1.0, 0.0, -1.0], 2, None).expect("search");
    assert_eq!(
        hits.iter().map(|hit| hit.external_id).collect::<Vec<_>>(),
        vec![2, 1]
    );
    assert_eq!(hits[0].score.to_bits(), 0x3fef_dfdf_dfdf_dfe0);
    assert_eq!(hits[1].score.to_bits(), (-2.0_f64).to_bits());
    assert_eq!(
        AffineU8Config::from_spec(AffineU8ConfigSpec {
            dimension: 4097,
            metric: RetrievalMetric::DotProduct,
            normalization: VectorNormalization::None,
        })
        .expect_err("dimension must reject")
        .code(),
        "dimension-out-of-range"
    );
}
