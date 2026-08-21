# TinyRustLM Qwen2 SLM2 Converter Foundation Memory

Date: 2026-08-20

## Authority

This report records the source-selection and full-scale conversion foundation
at source commit
`5c2c513b63f2ae13a61c3fff5c8e29adaac915c0`. That commit is pushed and was
freshly verified equal to `origin/codex/model-acquisition-v2`.

The enterprise goal remains active and incomplete. Its authority is
`docs/architecture/2026-08-10-authoritative-enterprise-vnext-continuation-goal.md`,
SHA-256
`92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0`.

## Source Ledger

`source-family-selection.v1.json` is 40,664 bytes with SHA-256
`5aafe8528e269726f3aeeb6becc49a44f43c847953f084c5736a8a5a4bb0f0af`.
It binds all 37 tracked decisions: nine preflight rejections and 28 untouched
source-screen rejections. Every candidate remains rejected and artifact
admission remains `none`.

Historical assessments that did not record a tokenizer hash, SPDX identifier,
or acquired model hash retain `null` plus an explicit typed identity status.
They are not silently treated as complete. New candidates must provide all
identities.

The Qwen2.5 reference source lock is 1,901 bytes with SHA-256
`a445ab6131ff7f9b9623a443c262bdc5485bac41a8c1734358d9ee0492ba529b`.
It binds immutable upstream revision
`7ae557604adf67be50417f59c2c2f167def9a775`, source model SHA-256
`fdf756fa7fcbe7404d5c60e26bff1a0c8b8aa1f72ced49e7dd0210fe288fb7fe`,
and tokenizer SHA-256
`c0382117ea329cdf097041132f6d735924b697924d6f6fc3945713e96ce87539`.
It is an Apache-2.0 structural converter reference only. Its untouched source
screen remains rejected at two passing cases out of eight.

## Converter

The checked-in conversion profile has SHA-256
`aeafbc2baa25b5e6b8d3a11a40a2d96f23fab9c4dbb4809747664a97238c33eb`.
The converter:

- requires the exact nine-file source lock and rehashes every source file;
- parses a bounded single-file Safetensors header with duplicate-key rejection;
- accepts one exact Qwen2 BF16 or F32 tensor inventory;
- rejects missing, additional, overlapping, gapped, reshaped, mixed-dtype, and
  nonfinite tensors;
- streams each tensor into deterministic SLM2 F32 without loading all weights;
- independently validates the staged SLM2 model before promotion;
- preserves exact tokenizer JSON and extracted chat-template bytes;
- creates destination names atomically through same-directory create-only hard
  links, then removes staging names, so Unix replacement semantics cannot
  overwrite existing evidence;
- binds source lock, profile, executable, model, tokenizer, template, and
  durability observations in a create-only receipt; and
- claims only structural and byte conversion. Quality and runtime remain
  explicitly unassessed.

## Preserved Failures

The first full source run failed closed with
`qwen2-config-semantics-unsupported`. The converter had incorrectly required
the inert `max_window_layers` value to equal the layer count while
`use_sliding_window` was false. The official source records 21 and 24. The
general rule now requires a positive value no greater than the layer count, and
the deterministic fixture uses unequal values to preserve the regression.

Code review then found that check-then-rename could overwrite an existing file
on Unix after a race. Promotion was rewritten to atomic create-only hard-link
creation followed by staging unlink. No compatibility path was retained.

## Full-Scale Structural Evidence

The final release converter executable has SHA-256
`458a3df67d43743b16c41e962f30357385ef4ae18801158e9f0136be8eca297d`.
It processed 290 BF16 tensors containing 494,032,768 parameters and produced:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| SLM2 model | 1,976,203,392 | `50e7edfc9c6a7ab318038e2d03694f0ec80e09225aa5414b5a8c86a4a08187e2` |
| Tokenizer sidecar | 7,031,645 | `c0382117ea329cdf097041132f6d735924b697924d6f6fc3945713e96ce87539` |
| Chat-template sidecar | 2,507 | `cd8e9439f0570856fd70470bf8889ebd8b5d1107207f67a5efb46e342330527f` |
| Conversion receipt | 3,081 | `b46d6610dfe1d0ad839f5c6f14a5763d4a359784f2b9b180f8bf875da6cfd0e0` |

The full-scale output identity matched two earlier full-source executions.
Those earlier receipts bind the preceding transaction-profile executable and
remain superseded evidence. The final executable identity is established by
the final receipt; deterministic same-executable repetition is covered by the
focused two-output converter test.

## Verification

- `cargo test --workspace` passed.
- `cargo clippy --workspace --all-targets -- -D warnings` passed.
- `cargo fmt --all -- --check` passed.
- Six focused converter tests passed, including exact repeat conversion,
  source drift, unsupported architecture, surplus tensor, nonfinite staging,
  and create-only output cases.
- The source-ledger generator write, verify, and Node test passed.
- The release executable completed a real 988,097,824-byte source conversion,
  and its receipt independently bound the converter profile and executable.

## Claim Boundary And Resume

This milestone is not a useful-model pass, runtime inference result, WASM
result, browser result, release, deployment, publication, or campaign count.
MemoryEndpoints remains unauthorized and disconnected. Campaign counters remain
0/20 models, 0/50 browser rounds, 0/25 memory rounds, 0/40 proven lanes, and
0/20 announcements.

The working-model plan is a new fully pinned Qwen3-0.6B derivative. Before
training or conversion, replace the sole unpromoted SLM2 head-geometry
invariant cleanly so query projection width may differ from embedding width,
then regenerate and revalidate every dependent profile, vector, independent
oracle, hostile corpus, sanitizer seed, converter, scalar-runtime, and WASM
contract. Do not add a second format, compatibility reader, alias, migration,
or fallback. Only a newly merged artifact that passes the preregistered
untouched screen may advance to working-model conversion and inference.
