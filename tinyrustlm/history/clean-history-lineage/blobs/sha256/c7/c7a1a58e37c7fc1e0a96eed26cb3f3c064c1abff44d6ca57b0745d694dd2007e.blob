//! Black-box conformance checks for the public scalar-oracle API.

use tinyrustlm_vector_oracle::{
    pack_unsigned_codes, DeterministicRng, DistortionMetrics, PackedVector, ScalarCodebook,
    StorageAccounting, TransformFamily, TransformPlan, WeightedSample,
};

/// Verifies the public oracle API against independently pinned local vectors.
#[test]
fn public_api_matches_clean_room_conformance_vector_v1() {
    let mut generator = DeterministicRng::new(0x1234);
    let generated: Vec<u64> = (0..4).map(|_| generator.next_u64()).collect();
    assert_eq!(
        generated,
        vec![
            0x0000_0484_3c62_1f10,
            0x448d_7cf0_5123_1f2e,
            0x4ab6_657f_3f83_5290,
            0xe401_277f_ab10_f035,
        ]
    );

    let transform = TransformPlan::new(TransformFamily::SignedHadamard, 4, 0x1234)
        .expect("conformance transform");
    let transformed = transform
        .forward(&[1.0, 2.0, 3.0, 4.0])
        .expect("conformance forward");
    assert_eq!(transformed, vec![1.0, 3.0, 2.0, -4.0]);
    assert_eq!(
        transform
            .inverse(&transformed)
            .expect("conformance inverse"),
        vec![1.0, 2.0, 3.0, 4.0]
    );

    let codebook = ScalarCodebook::fit_discrete(
        &[
            WeightedSample {
                value: -3.0,
                weight: 1.0,
            },
            WeightedSample {
                value: -2.0,
                weight: 1.0,
            },
            WeightedSample {
                value: 2.0,
                weight: 1.0,
            },
            WeightedSample {
                value: 3.0,
                weight: 1.0,
            },
        ],
        2,
        8,
    )
    .expect("conformance codebook");
    assert_eq!(codebook.centroids(), &[-2.5, 2.5]);
    assert_eq!(codebook.boundaries(), &[0.0]);

    let codes = vec![0, 1, 1, 0, 1];
    assert_eq!(pack_unsigned_codes(&codes, 1), Ok(vec![0b0001_0110]));
    let packed = PackedVector::from_codes(&codes, 1).expect("conformance packed vector");
    assert_eq!(packed.dot_dense(&[1.0; 5], &codebook), Ok(2.5));

    let metrics =
        DistortionMetrics::from_vectors(&[1.0, 0.0], &[0.0, 1.0]).expect("conformance metrics");
    assert_eq!(metrics.mean_squared_error, 1.0);
    assert_eq!(metrics.normalized_mean_squared_error, Some(2.0));
    assert_eq!(
        metrics.angular_error_radians,
        Some(std::f64::consts::FRAC_PI_2)
    );

    let accounting = StorageAccounting {
        persistent_codes: 1,
        metadata: 2,
        transforms: 4,
        codebooks: 8,
        pages: 16,
        padding: 32,
        scratch: 64,
        allocator_overhead: 128,
    };
    assert_eq!(accounting.total_bytes(), Ok(255));
}
