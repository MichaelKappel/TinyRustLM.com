# SLM2 parser fuzzing

This nested Cargo workspace is the bounded raw-byte fuzz boundary for the
unpromoted SLM2 parser. It never activates a model, accesses a network, writes
an artifact, or treats fuzz success as model qualification.

The exact profile is `contracts/vnext/slm2-fuzz-profile.v1.json`. The corpus is
generated from the checked-in SLM2 vector and contains one admitted artifact
plus single-fault hostile variants with exact parser error codes.

Stable replay does not require libFuzzer:

```text
node tinyrustlm/tools/generate-slm2-fuzz-corpus.js --check
cargo run --manifest-path rust/crates/tinyrustlm-slm2/fuzz/Cargo.toml --bin replay_slm2_corpus
```

The optional fuzz target requires `cargo-fuzz` and the `fuzzing` feature:

```text
cargo fuzz run raw_slm2 rust/crates/tinyrustlm-slm2/fuzz/corpus/raw_slm2
```

Use an operator-owned target directory on a volume with adequate free space.
Do not use the critically constrained `D:` volume for build products.
