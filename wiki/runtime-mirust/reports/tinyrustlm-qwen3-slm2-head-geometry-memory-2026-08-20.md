# TinyRustLM Qwen3 SLM2 Head Geometry Memory

Date: 2026-08-20 Pacific / 2026-08-21 UTC

## Authority And Scope

This report is the durable handoff for the clean-slate SLM2 head-geometry
checkpoint on branch `codex/model-acquisition-v2`. Implementation commit
`e025469d7fa5dbf49f03008b3e4eaf7add71419c` is pushed and independently
remote-exact.

The checkpoint removes the unpromoted profile's artificial requirement that
query projection width equal residual embedding width. It does not add a
second profile, compatibility reader, migration, alias, repair, fallback, or
SLM1 support. It preserves one development-only `org.minimodel.slm2/2.0`
contract and rewrites that contract and every dependent artifact together.

This is format, parser, cross-implementation, and bounded sanitizer evidence.
It is not a trained model, source-model quality pass, native inference result,
WASM result, browser chat result, P2P result, release, deployment, publication,
or campaign completion claim.

## Engineering Decision

The residual embedding width, query projection width, and grouped-key/value
projection width are independent architectural quantities:

- `query_width = head_count * head_dimension`;
- `kv_width = kv_head_count * head_dimension`;
- query projection shape is `[query_width, embedding_size]`;
- attention output projection shape is `[embedding_size, query_width]`.

Both products must fit `u32`; query width no longer has to equal residual
embedding width. This is required for the planned pinned Qwen3-0.6B derivative,
whose target geometry has residual width 1,024, 16 query heads, head dimension
128, and query width 2,048.

The canonical tiny vector deliberately makes the distinction observable:
residual width 8, two query heads, head dimension 8, query width 16, query
projection `[16, 8]`, and output projection `[8, 16]`. Rust and an independent
Node implementation both derive and enforce these shapes.

## Exact Contract Identities

| Artifact | Exact identity |
| --- | --- |
| SLM2 format profile | 19,303 bytes; SHA-256 `387c0ff4dd251da88192427b209efe941ddf9d0ff0a639352f0e5d3724b48625` |
| Vector document | 26,210 bytes; SHA-256 `18991615212a1e230f49032cc487664098667694c4817b954d69edd40af4e17e` |
| Canonical 11-tensor vector | 8,448 bytes; SHA-256 `c010e2818c64713310699e9ad928d3b22cfeb004756ae8e03acaaee5897e613a` |
| Canonical embedded manifest | SHA-256 `1aacc7e30dadf88c9e7d9c75d6bc21000ba86d174fbb0c441b6dad160d154f05` |
| Canonical tensor layout | SHA-256 `46f727ad637170f4dbe6247c40e0ede6bc48b13d82c31cbace05b42394d6d487` |
| Canonical one-piece Merkle root | `fb1d8382afdd5fcc325add765576eea5a802b2ef01a78dc3309c2c21e3afa474` |
| Fuzz profile | 3,187 bytes; SHA-256 `dc16fd2abf142e6a9c8a72bbfc3d998b980af486e094406d73933cae6732a487` |
| Fuzz corpus manifest | 10,040 bytes; SHA-256 `9b97aa1c7203c3dd573aeb570d4f8d75cc347df39cf405265518b386b51467ea` |
| Frozen initial corpus | 27 files; 211,428 aggregate bytes; one admission and 26 exact rejections |

The old format, vector, fuzz-profile, corpus, and sanitizer identities remain
historical evidence only. They cannot authorize the rewritten profile.

## Deterministic Verification

The following gates pass against the committed source:

- vector generator check: one exact vector;
- corpus generator check: 27 exact entries;
- independent Node profile/vector/parser suite: 6/6;
- independent Node fuzz-contract suite: 1/1;
- Rust SLM2 production crate: 15 unit and 3 integration tests;
- Rust fuzz workspace: 2 library and 5 replay tests;
- explicit replay: 27 entries, one admitted, 26 rejected;
- architecture decisions: 15/15;
- production and fuzz `rustfmt` checks;
- production and fuzz denied-warning Clippy;
- staged diff and whitespace hygiene.

A bare invocation of `vnext-campaign-release-surface.test.js` was also
preserved as a nonqualifying harness invocation: it rejected before test
discovery because the protected custody fixture profile was absent. The
architecture suite in the same command passed 15/15. No release-surface result
is claimed from that invocation, and the protected test was not weakened.

## Seeded Windows AddressSanitizer

The passing run is retained outside Git in an E:-owned evidence root. Public
handoff material records hashes and bounded metrics, not private machine paths.

### Preserved Nonqualifying Attempts

1. The first preparation stopped before fuzzing because PowerShell attempted
   to aggregate ordered dictionaries as object properties. Its separate
   failure marker has SHA-256
   `73974f931d5910c6980161788e9f2bb76fb5fce659c1cfd641aebf458d7bcb3a`.
2. Attempt 1 stopped before fuzzing because the launch omitted the target's
   required `fuzzing` feature. The create-only launch-failure record SHA-256 is
   `954ceb61db1a5ba1db5c1ba20e8f8f8d1fe11121504c317dcfc046ed5df36f51`.
3. Attempt 2 built the release target successfully, then Windows returned
   `STATUS_DLL_NOT_FOUND` before parser execution because the ASan runtime was
   absent from the process search path. Its execution record SHA-256 is
   `a8f9050730794e772b96cb02371ddb9e10c27f98882307beda9419eac1ed7afd`;
   stderr SHA-256 is
   `6433e837c3adc8035e852a0b7b54f6ac1fba18bbe28b5d42e5de895ccb55ab1c`.

No failed attempt is converted into a pass or counted as sanitizer execution.
Before attempt 3, all 27 working seeds were independently rehashed and the
artifact directory was proven empty.

### Passing Attempt 3

The final run bound:

- source commit `e025469d7fa5dbf49f03008b3e4eaf7add71419c`;
- corpus manifest SHA-256
  `9b97aa1c7203c3dd573aeb570d4f8d75cc347df39cf405265518b386b51467ea`;
- preparation record SHA-256
  `e306c45c3ead53ec3d156877c8c02c86d73b807e4eb5e77f8c4a1e588dee5600`;
- `cargo-fuzz 0.13.2` executable SHA-256
  `e3306c23bdd4c717ed02e7d5da4fb6a51478aeac74fe19501b7dbc23a7c8a407`;
- nightly Rust commit `f7d782a3be46d6bb4b9792fe69a61db389ba1769` and
  `rustc.exe` SHA-256
  `28027e18ecbf2192fd2344d98afb24b7128ceb14b70c927ae3d5f268da46fac2`;
- LLVM 23.1.0;
- ASan runtime SHA-256
  `3aa742521e8cbd23252f0545aa51d5a15624a3e4430fbe2f81567afaeb3fc59b`;
- built fuzz target SHA-256
  `83eba5458ddc00482d24459ead4cee99cde6db1e5dd1a086c295f6aadb6cf161`;
- fixed seed 20260820, 300-second total limit, 10-second input timeout,
  1,048,576-byte input ceiling, and 4,096-MiB RSS ceiling.

The raw transcript confirms exactly 27 initial files, 211,428 initial bytes,
1,200,296 executions in 302 terminal seconds, 3,987 average executions per
second, and 406 MiB peak RSS. The process exited zero and produced zero crash
artifacts. The 195,624-byte stderr transcript SHA-256 is
`99c6efa8334e881494f045ab4210ce66126050f92452746ac35f6fd6cfd79c53`.

Independent verification rehashed the frozen corpus, transcript, tools,
runtime, target, source head, and actual remote branch; parsed the initial and
terminal libFuzzer summaries; rejected sanitizer-error markers; and rescanned
the artifact directory. Verification SHA-256 is
`36f396b18bd26832df110ad71cdebca221c5d0f6f0481d4f5af1341ebe84bac7`.
The narrow local receipt SHA-256 is
`00438c4f94b16bd0c996aff0e7f12d0dca0b1fe97acc6d547ff2d8838c8e8904`.

This closes only bounded seeded raw-SLM2 AddressSanitizer evidence for the new
profile. It does not authorize model conversion, inference, promotion, or
publication.

## Claim Boundary And Resume

MemoryEndpoints remains unauthorized and disconnected. No site, package,
version, release date, deployment, publication, public HTTPS readback, model
qualification, P2P proof, or catalog announcement changed. Campaign counters
remain 0/20 qualified models, 0/50 clean browser rounds, 0/25 live memory
rounds, 0/40 externally proven lanes, and 0/20 announced models.

The exact next work is to freeze the Qwen3-0.6B derivative's curriculum,
contamination exclusions, sealed holdout generator, teacher and review
provenance, deterministic training lock, checkpoint/stop rules, and removal
lineage. Only then may a fully pinned training attempt begin. Untouched source
screening must precede admitted conversion, and conversion must precede
scalar/native/WASM/browser promotion. No rejected source or historical Qwen2
structural artifact may be relabeled as the required working model.
