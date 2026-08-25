# Qwen3 Real Composition Execution /3 Result And Tokenizer Path Defect

Date: 2026-08-25

Status: terminal native rejection; immutable partial output preserved; no retry

## Decision

Real Qwen3 complete-composition execution `/3` is permanently closed. The
registered Rust and managed builds both passed, the controller launched the
converter exactly once, and the corrected model producer successfully emitted
a 598,308,416-byte, 310-tensor SLM2 artifact. The transaction then rejected
before Tokenizer2 creation because the standalone tokenizer writer required
the obsolete `.tok2` suffix while the sole composition contract supplied the
canonical `tokenizer.tokenizer2` member name.

The bounded public result is
`contracts/vnext/qwen3-real-composition-execution-result.v3.json`, 8,773 bytes
at SHA-256
`2ae10fc8a76cced2e88d9b9c310af4eeb3ef436829f3f6a5ee8c551dfde6b2e4`.
The private create-only verification is 9,865 bytes at SHA-256
`88df285e0f64caac6c468512936ba1e269521287d85a95fbea8e79335c80eb48`.

Technical `/3` identifies an immutable execution attempt. It is not a product
generation. TinyRustLM remains one unreleased product with no legacy reader,
compatibility suffix, migration, alias, fallback, output repair, retry, or
accepted debt.

## Registered Custody

The attempt used remote-exact registration commit
`43a29e8e1ba7a3296be18425a5fc077fb13617fe`, tree
`5a4370411f340782323cec2a3ac8afd61035982c`, and profile
`tinyrustlm.qwen3-real-composition-execution/3`. The 29,275-byte profile has
SHA-256
`b07ccd2688d6352fd7614fc2302d7aac59c63e3e4fe2a5943da7c8aa6bd1ec19`.
Local `HEAD`, tracking, fresh `FETCH_HEAD`, and the actual remote branch were
equal before either build and before execution. The worktree was clean.

The attempt used five new private logical roots. None existed before its
registered creation point. They remain private and immutable after the
terminal rejection. No predecessor root was reused or modified.

## Build Evidence

The Rust release build ran once, offline and nonincremental:

```text
cargo build --locked --release -p tinyrustlm-convert --target x86_64-pc-windows-msvc
```

It completed with exit zero. Its raw stdout was empty. Its 1,874-byte stderr
build log has SHA-256
`2171fdc140c22849b695aa1b9401d1b7980be7d371fbfae6dc290076f6e38b6c`.
The resulting x86-64 PE converter is 846,336 bytes at SHA-256
`0420e38d0a2832b7fdcc39064343a6d4529a7d2d49679c1e96e15b4ba7ee401c`.
Its identity was unchanged after execution.

The managed inspector build also ran once without restore, network, or
incremental output. It completed with zero warnings and zero errors. The
7,680-byte inspector assembly has SHA-256
`b44af7c3c18df1f905b2f2705c52b63cdccc04a41d109be3e5b0f0bdf5d8c887`.
Managed inspection did not run because the controller did not produce a
candidate pass.

## One-Shot Execution

The canonical private request is 5,026 bytes at SHA-256
`7ed907b16792a846d932a26b7631dcb930d36cdba4bf773516be667be3902247`.
It bound the exact source locks, source directories, profiles, commit, tree,
build logs, converter, Node runtime, working directory, output roots, limits,
and invocation.

The controller wrote binding first, wrote one start authorization, and
launched one owned converter child. The child ran for 114,005 milliseconds,
exited `1`, emitted no stdout, and emitted 66 stderr bytes at SHA-256
`1f1c610e2391de0d8febcd0e274b0c375f680e8600fd77e5c3397d66eef40267`.
It did not time out, overflow, receive a signal, or drift its executable.

The controller preserved:

- binding: 8,575 bytes, SHA-256
  `315bcce5e1d83c4c797d4dc399028fda85305ce97b1a12faabeda0956789115e`;
- start: 458 bytes, SHA-256
  `32a0adea60a8e63821be35a51a745ce0ca515e3ffd049d532ee3f134797e7a48`;
- terminal: 2,169 bytes, SHA-256
  `e7e9e23a78f03288f3497bd27a62a18e8bf719761f38a9d3c9d421fed1681e23`;
- controller summary: 331 bytes, SHA-256
  `e4348f381107335bb40b5362f4d751ca9cd26e4844968898ddde9a331558fc2d`;
  and
- empty controller stderr.

The terminal status is `terminal-process-failure`. Controller process exit
zero means the controller successfully preserved that terminal observation;
it does not mean the converter or composition passed.

## Partial Model Evidence

The corrected model conversion completed before the tokenizer path check:

| Member | Bytes | SHA-256 |
| --- | ---: | --- |
| `model.slm2` | 598,308,416 | `a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7` |
| `model.slm2.conversion-receipt.json` | 5,554 | `c777557de810497bde4b57f048670971ed1210e62ea5d1eff690eb26401fa2ea` |

The receipt is schema `tinyrustlm.qwen3_conversion_receipt.v2`. It records 311
physical source tensors, 310 logical output tensors, and exact streamed
equality of the redundant tied output. This proves structural and byte
conversion only. It does not prove complete composition, source-framework
parity, native generation, browser generation, conversational quality, or
product eligibility.

The same root also contains one create-only attempt receipt and one
create-only rejection. The rejection error is
`qwen-tokenizer2-output-path-invalid`, `safeNoOp=false`, and
`retryable=false`. All four output members remain preserved. They must not be
deleted, repaired, moved into a new result, or presented as a complete model
package.

## Root Cause

The mismatch is general and deterministic:

1. The complete-composition profile and all current managed consumers require
   `tokenizer.tokenizer2`.
2. The standalone Tokenizer2 writer accepted only a path whose extension was
   exactly `.tok2`.
3. Its profile described the transaction as `absolute-new-tok2-file`.
4. The writer therefore rejected the canonical composition member before
   opening any Tokenizer2 output.

The internal 16-byte Tokenizer2 binary format identifier remains
`minimodel.tok2` followed by two zero bytes. That binary identifier is not a
file suffix and is not the defect. The sole current file suffix will be
`.tokenizer2`.

The source bytes, corrected model producer, and composition member name were
not established to be defective. The defect is the standalone tokenizer
writer/profile path contract and the composition profile's binding to that
producer.

## Closed Outcome

Execution `/3` cannot be resumed or retried. Managed inspection cannot be used
to convert a controller failure into a pass. Existing evidence cannot be
overwritten, and partial output cannot be cleaned or repaired.

The next attempt requires:

1. a new Tokenizer2 conversion profile that accepts only `.tokenizer2`;
2. a new Tokenizer2 receipt schema bound to that exact profile and file name;
3. a corrected complete-composition profile bound to the new producer and
   receipt;
4. deletion of executable predecessor identities without compatibility;
5. positive composition-path and negative obsolete-suffix regressions;
6. a green implementation commit pushed and freshly verified; and
7. a new one-shot registration with entirely new roots.

No structural composition, runtime, browser, quality, P2P, publication,
MemoryEndpoints, or campaign claim exists. Campaign counters remain `0/20`,
`0/50`, `0/25`, `0/40`, and `0/20`.
