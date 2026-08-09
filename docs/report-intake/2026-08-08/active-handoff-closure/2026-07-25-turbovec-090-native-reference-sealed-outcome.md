# TurboVec 0.9.0 Native Reference Sealed Outcome

Date: 2026-07-25

Status: terminally unqualified under the frozen comparison; no observation
receipt and no product authority

This report records the outcome of the preregistered TurboVec 0.9.0 native
reference comparison. It preserves one infrastructure failure and the sole
allowed infrastructure retry. The retry reached the registered quality process
and ended in a terminal comparison outcome. No performance, corruption,
crash-recovery, browser, WASM, semantic-memory, product-integration, training,
or release claim follows from these attempts.

## Executive Decision

The frozen TurboVec reference arm did not qualify.

Attempt 1 stopped before any registered comparison mode because the Windows
rustup multicall launcher was resolved under the wrong executable basename.
That failure was classified as retryable infrastructure, committed unchanged,
and followed by a generic launcher regression and scoped implementation fix.

Attempt 2 was the sole allowed infrastructure retry. It reached the registered
quality process, whose executable returned a nonzero exit code. The attempt was
therefore recorded as `comparison-outcome` with `retryAllowed: false`.

The experiment is terminal. It must not be rerun, have its thresholds changed,
or be replaced by a selected favorable result. TurboVec 0.9.0 is not adopted
into TinyRustLM from this work.

This outcome does not prove that the upstream TurboVec algorithm is generally
inaccurate. It proves only that this exact source-pinned arm, wrapper, corpus,
configuration, and frozen gate failed to produce qualifying evidence.

## Frozen Identity

Preregistration:

- Experiment ID:
  `turbovec-090-4bit-tqplus-reference-comparison-20260725`
- Manifest:
  `tinyrustlm/experiments/vector-quantization/turbovec-reference-comparison-preregistration.v1.json`
- Manifest SHA-256:
  `96a3fad0078850e2fe9fb4d619979ca9e5b753f23a3fab6df53aebe9b9afe6ed`
- Preregistration commit:
  `54768399222e6956d77f58c154b109d041a43937`
- Method ID:
  `turbovec-crate-090-4bit-tqplus-native-reference`
- Public crate artifact SHA-256:
  `0715a5a1365e86d0ae6396fa0c011f319b8e8024b3896cd16e6468e29ed3a325`
- Public crate VCS revision:
  `1e7200cfd8f26c92ce2855652db64bc7f85bc039`
- Frozen Fashion-MNIST revision:
  `b2617bb6d3ffa2e429640350f613e3291e10b141`
- Frozen selection SHA-256:
  `8be904326c844c31b6e973f88bc6ce2e0a7462d51aa0d5ae497dda4b02472fbd`

The complete implementation and no-cheat test harness were committed before
the first attempt at:
`81863b711d999378ffb78c3a5d1b6db2628f0eb6`.

## Attempt 1: Infrastructure Failure

- Attempt ID:
  `turbovec-reference-attempt-b8ffb20cebbeccf0`
- Attempt content hash:
  `b8ffb20cebbeccf0f11b297c19f771dc700f7227a03375c21f3ee52f757e25de`
- Attempt file SHA-256:
  `1453fcd6067b20a80c900f71497733e5b3c20b7fe92d3fed98a760050ff325aa`
- Attempt file bytes: `1035`
- Source revision:
  `81863b711d999378ffb78c3a5d1b6db2628f0eb6`
- Classification: `infrastructure`
- Retry allowed: `true`
- Failure code:
  `TURBOVEC_REFERENCE_INFRASTRUCTURE_FAILURE`
- Evidence commit:
  `156cd0a63f73001b994939fdb6705021ad6af152`

The failure occurred while collecting Cargo tool identity. On this Windows
machine, `cargo.exe` and `rustc.exe` are rustup multicall launchers. Resolving
the launcher with `realpath` changed its invocation basename to `rustup.exe`;
`--version` consequently returned rustup identity and informational stderr.
No quality, performance, corruption, crash, or recovery comparison mode ran.

The scoped fix retained the original launcher basename while validating and
hashing its resolved regular-file target. A real sanitized version-probe
regression now covers both Cargo and rustc. The fix was committed at:
`070f307a26a8b374af1ad356bbd50fcb17f873c0`.

## Attempt 2: Terminal Quality Outcome

- Attempt ID:
  `turbovec-reference-attempt-db1a760c3d25893e`
- Previous attempt ID:
  `turbovec-reference-attempt-b8ffb20cebbeccf0`
- Attempt content hash:
  `db1a760c3d25893ed9f5ec6025a19e0a121b96bb1fb81092670155eff24e5baa`
- Attempt file SHA-256:
  `00bf8c3b0754b5576c94b41974882badc0457ba03f5474815f1c51aea01d429f`
- Attempt file bytes: `1096`
- Source revision:
  `070f307a26a8b374af1ad356bbd50fcb17f873c0`
- Classification: `comparison-outcome`
- Retry allowed: `false`
- Failure code:
  `TURBOVEC_REFERENCE_QUALITY_OUTCOME_REJECTED`
- Evidence commit:
  `871492e0292256614b9fff9b444640b47d735d04`

The preserved cause-message hash is:
`014f2e1a1c433776f7a87a5464cc7eb5878dd429c09c3e03f7b6b68c480e2d33`.
That hash maps exactly to the wrapper invariant
`quality process exit code is invalid`. The quality executable therefore
returned a nonzero exit code.

No successful quality object exists. The runner did not start the 60 registered
performance processes, seven corruption cases, or four crash-recovery cases.

## Evidence Limitation

The v1 failure receipt retained the wrapper failure code and message hashes but
did not retain the child process stdout hash, stderr hash, or bounded stderr
code when `spawnSync` returned a nonzero status. The specific Rust error code
that caused the nonzero quality exit is therefore not recoverable from the
surviving evidence.

This is an evidence-system defect, not permission to rerun the terminal arm.
No precise underlying TurboVec, wrapper, dataset, or filesystem cause is
claimed.

A future experiment schema must create append-only partial process evidence
before rejecting an exit status. At minimum it must retain:

1. Process mode and frozen lane identity.
2. Exit code and signal.
3. Exact stdout and stderr byte counts and SHA-256 hashes.
4. A bounded allowlisted error code when stderr is canonical and public-safe.
5. Timeout, output-bound, spawn, and monitor attribution.
6. Whether the registered mode began and which later phases did not run.
7. Cleanup evidence independent of comparison classification.

That change requires a new schema, tests, implementation commit, and
preregistration. Existing attempt files remain immutable.

## Verification And Claims

There is no successful comparison observation and therefore no independent
verification receipt. The verifier was not used to manufacture a result from a
failed process.

Verified facts:

- The preregistration preceded implementation and execution.
- Attempt 1 is a preserved retryable infrastructure failure.
- Attempt 2 is linked to attempt 1 and is a terminal comparison outcome.
- Attempt 2's quality child returned nonzero.
- No successful quality or later-phase evidence exists.
- No best-of-N selection or result repair occurred.

Not verified:

- TurboVec rank or score parity.
- Equal-byte retrieval utility.
- Natural-image neighbor utility.
- Controlled-memory utility.
- Native latency or memory improvement.
- Corruption rejection or process-crash recovery.
- Upstream persistence safety.
- TurboQuant paper conformance.
- WASM or browser compatibility.
- Representative semantic-memory usefulness.
- Product integration, training, model qualification, or release readiness.

## Campaign Impact

This terminal research outcome does not increment release campaign counters:

- Qualified models: `0 / 20`
- Fresh-browser rounds: `0 / 50`
- Authorized live MemoryEndpoints rounds: `0 / 25`
- Externally proven P2P lanes: `0 / 40`
- Catalog announcements: `0 / 20`

No MemoryEndpoints account, public catalog write, outside observer, package
publication, signing credential, or physical Linux ARM64 authority was used or
claimed.

## Next Gate

Do not execute this preregistration again.

Before another compressed-vector arm is allowed:

1. Introduce a new append-only process-failure evidence schema and mutation
   tests.
2. Find a general comparator defect through static analysis or synthetic unit
   tests without rerunning this quality corpus.
3. Select whether the next arm is a corrected, newly preregistered reference
   experiment or a different independently pinned implementation.
4. Freeze all identities, equal-byte formulas, thresholds, and retry semantics
   in a new preregistration before implementing or observing that arm.
5. Keep numerical retrieval research separate from TinyRustLM model quality,
   semantic memory, browser performance, training, and release claims.
