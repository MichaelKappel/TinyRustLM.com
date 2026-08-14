# TinyRustLM Archive Fuzzing

This independent workspace exercises the sole production ZIP and tar-gzip
admission API. It does not contain another archive parser and never extracts
members to the filesystem.

The checked-in `TAF1` corpus is replayed on the stable toolchain:

```text
cargo run --locked --manifest-path rust/crates/tinyrustlm-archive/fuzz/Cargo.toml --bin replay_archive_corpus
```

Corpus curation can emit a read-only observation for human review. This command
does not create or change the manifest:

```text
cargo run --locked --manifest-path rust/crates/tinyrustlm-archive/fuzz/Cargo.toml \
  --bin replay_archive_corpus -- --observe-corpus \
  rust/crates/tinyrustlm-archive/fuzz/corpus/structured_archive
```

The same structured grammar is fuzzed with the pinned nightly runner on a
supported Unix-like host:

```text
cargo +nightly-2026-08-01 fuzz run structured_archive \
  --fuzz-dir rust/crates/tinyrustlm-archive/fuzz \
  rust/crates/tinyrustlm-archive/fuzz/corpus/structured_archive \
  -- -dict=rust/crates/tinyrustlm-archive/fuzz/dictionaries/structured_archive.dict \
  -max_len=4096 -max_total_time=60
```

New findings must be retained append-only after minimization. Existing seeds
and manifest verdicts are not overwritten. A bounded CI fuzz interval and a
passing seed replay are useful hostile-input evidence, not proof that the
parser has no defects and not production, durability, or publication evidence.
