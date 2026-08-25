# Qwen3 Real Composition Execution Preregistration /4

Date: 2026-08-25

Status: output-free one-shot registration; no `/4` build, private root,
converter process, composition output, structural result, runtime output, or
product claim exists

## Decision

TinyRustLM will perform one wholly new attempt to convert the exact locked
`Qwen/Qwen3-0.6B` revision into the sole current SLM2 complete-composition
family after preserving three terminal predecessors. Public registration
`contracts/vnext/qwen3-real-composition-execution-preregistration.v4.json` is
31,580 canonical bytes with SHA256
`f3f549a108c4a3acb767b241f2d1ef6d2db737c67442f059e8e943dabb992275`.

The `/4` suffix identifies the fourth immutable execution attempt. It is not a
product generation. TinyRustLM remains one unreleased product with no legacy
lane, compatibility reader, migration, alias, fallback, output repair, retry
selection, or accepted debt.

Registration creates no private directory, build output, evidence record, or
model output. It freezes the attempt before either build so an observed result
cannot be repaired, retried, selected, or relabeled afterward.

## Closed History

All three predecessors are immutable inputs:

- `/1` registration is 16,006 bytes at SHA256
  `46a9da74eb6b811257d2cc3a433055d4859fb7bbdfeef22e1c6ee8c2bd978a6a`.
  Result SHA256
  `dd1d9c85b5bb8bf098641a156de06e59243d88530434d70c574dcdceedb7a1ce`
  records one successful Rust build followed by a pre-binding interruption,
  zero converter launches, and no output.
- `/2` registration is 27,596 bytes at SHA256
  `cfc924334083d5623852511950d48486b2bbb80d3aa9d7e403c7d957b2f89a5f`.
  Result SHA256
  `4b2c957943d91fe7023d5ab78d2582735d21196e93403c212a9b104204bc970c`
  records one Rust build, one managed-inspector build, one converter launch,
  and typed native rejection `qwen3-tensor-inventory-mismatch`. Managed
  inspection did not run.
- `/3` registration is 29,275 bytes at SHA256
  `b07ccd2688d6352fd7614fc2302d7aac59c63e3e4fe2a5943da7c8aa6bd1ec19`.
  Result SHA256
  `2ae10fc8a76cced2e88d9b9c310af4eeb3ef436829f3f6a5ee8c551dfde6b2e4`
  records one Rust build, one managed-inspector build, and one converter
  launch. Model conversion produced a preserved 598,308,416-byte,
  310-tensor partial SLM2 at SHA256
  `a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7`
  before typed native rejection `qwen-tokenizer2-output-path-invalid`.
  Managed inspection did not run.

No predecessor may be resumed, retried, cleaned, overwritten, repaired, or
relabeled. Their private roots cannot be reused. `/2` established the tied
output profile defect and `/3` established the Tokenizer2 output-path defect;
neither established a source-checkpoint defect.

## Source And Commit Boundary

The registration parent is pushed and remote-exact commit
`d5b9044107d77dc6ce56462c1fc40cd658954851`, tree
`f12282815c5f6c3aa2d5eca899d4b2fcbb68f485`, on
`codex/model-acquisition-v2`. Before registration, local `HEAD`, tracking,
fresh `FETCH_HEAD`, and the actual remote branch were identical and the
worktree was clean.

The registration commit may change only:

1. `contracts/vnext/README.md`;
2. the `/4` preregistration profile;
3. this architecture record; and
4. the `/4` preregistration test.

It must be a single-parent descendant of the registered parent and must be
pushed, freshly fetched, and actual-remote exact before any `/4` root is
created. The future private request will bind that registration commit and
tree as the actual Rust and managed build source. The registration's 16 source
sentinels prove the executable owners are unchanged across the four allowed
registration-only paths.

## Corrected Conversion Inputs

The attempt binds all of these exact public inputs:

- model source lock: 1,901 bytes, SHA256
  `e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d`;
- tokenizer source lock: 1,108 bytes, SHA256
  `1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70`;
- Tokenizer2 conversion profile `/2`: 8,394 bytes, SHA256
  `97b381c73e7191f245ba132421a81bf015092b8550599413a6c81c6dae0afae4`;
- model conversion profile `/2`: 18,177 bytes, SHA256
  `fa2ce18f38129a6b106000d7802d1ea3995921e2b945ae5e52457908f548e7cf`;
- complete-composition profile `/4`: 11,421 bytes, SHA256
  `19e43c7ae532e7bc1822cbdcf179ee9bf1ed111298d3c6e5b13d37d990ee47e8`;
- execution controller: 33,731 bytes, SHA256
  `c78b6f8d59f61299aab511365fe8a699f6cd0a7989f222b954229d1d7e0e3508`;
- Node runtime: 91,380,224 bytes, SHA256
  `63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088`,
  version `v24.14.0`, Windows x64;
- .NET host: 167,208 bytes, SHA256
  `ab1b71fd3dd71062e074c9fab8312081a81b7f2b3e0327c48c4d249c8d1a3135`;
  and
- 16 exact executable source sentinels reopened from the registered parent.

The model profile requires `tie_word_embeddings=true`, exactly 311 physical
source tensors, exactly 310 logical SLM2 tensors, and exact dtype, shape,
length, and streamed source-byte equality between `lm_head.weight` and
`model.embed_tokens.weight` before output creation. It emits the logical
embedding once and records receipt schema
`tinyrustlm.qwen3_conversion_receipt.v2`.

The Tokenizer2 and composition profiles require only exact lowercase
`.tokenizer2`, fixed member `tokenizer.tokenizer2`, producer
`tinyrustlm.qwen-bytelevel-to-tokenizer2/2`, and receipt schema
`tinyrustlm.qwen_tokenizer2_conversion_receipt.v2`. Internal binary identifier
`minimodel.tok2` remains format metadata and is explicitly not a filename
suffix. Superseded model profile `/1`, composition profile `/3`, Tokenizer2
producer `/1`, and both v1 component receipt identities retain no executable
reader, writer, alias, migration, or fallback.

## Fresh Root Set

The following public-safe basenames were directly checked and absent beneath
the approved direct non-reparse private parent before registration:

- `qwen3-composition-control-c1899de-20260825-v4`;
- `qwen3-composition-build-d5b9044-20260825-v4`;
- `qwen3-composition-execution-c1899de-20260825-v4`;
- `qwen3-composition-managed-inspector-d5b9044-20260825-v4`; and
- `qwen3-composition-c1899de-20260825-v4`.

Their absolute paths are private and do not appear in Git. If any root exists
after registration before its authorized creation point, `/4` closes rather
than deleting, renaming, adopting, or reusing it.

## One-Shot Build And Execution

The Rust owner receives exactly one offline release build:

```text
cargo build --locked --release -p tinyrustlm-convert --target x86_64-pc-windows-msvc
```

`CARGO_INCREMENTAL=0`, `CARGO_NET_OFFLINE=true`, and the new private target
root are exact. Build stdout and stderr are separate bounded create-only
evidence. Success requires exit zero and the expected x86-64 PE executable.

The managed inspector receives exactly one nonincremental offline build:

```text
dotnet build dotnet/tools/TinyRustLM.CompositionInspector/TinyRustLM.CompositionInspector.csproj --configuration Release --no-restore --no-incremental --output <new-private-root>
```

It may not restore or use the network. Every direct output is inventoried and
hashed. A failed Rust or managed build closes the corresponding registered
sequence without substituting an earlier binary.

After both builds pass, one canonical private request binds every absolute
path, source commit and tree, profile, source lock, build command, raw build
stream, executable, runtime, source directory, output root, and invocation
limit. The controller validates all expensive inputs before evidence-root
creation, writes binding first, writes one start authorization, and launches
one owned converter child. It captures separate bounded raw streams and writes
one immutable terminal record. It has no resume, retry, repair, cleanup,
best-of-N, process-adoption, or unknown-process-kill path.

## Managed Inspection Boundary

Controller candidate status is not structural acceptance. Only a native
candidate pass may authorize creation of one private managed intent and one
inspect-only invocation. The managed command exposes no converter process API.
Invoking the managed conversion wrapper after direct Rust execution would be
a prohibited second conversion.

Managed exit zero must report exact `pass`. Exit two is a durable rejection;
exit three is pending; exit one is error. Pending, error, malformed,
overflowing, contradictory, or identity-drifted evidence fails closed and does
not authorize another attempt. A native controller rejection closes `/4` and
requires managed inspection to remain absent.

## Verification And Claims

One create-only private verification record will rehash every referenced
member and select only from the registered closed decision vocabulary. A
structural pass requires both successful builds, one controller invocation,
one converter launch, exact six-artifact composition output, no native
rejection, one inspect-only managed pass, and unchanged executable/runtime
identities.

Registration proves none of those future observations. Even structural pass
will not establish source-framework parity, native generation, browser-WASM
generation, browser chat, conversational quality, P2P availability, catalog
announcement, package publication, site deployment, or MemoryEndpoints
continuity. MemoryEndpoints remains unauthorized and disconnected. Campaign
counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

## Authorized Sequence

1. Run the `/4` registration tests, canonical JSON checks, source-identity
   checks, stale-profile scan, private-path scan, and diff hygiene.
2. Commit only the four allowed public paths.
3. Push, fresh-fetch, and compare local, tracking, `FETCH_HEAD`, and actual
   remote identities.
4. Reconfirm all five private roots remain absent.
5. Build Rust once and preserve both raw streams.
6. Build the managed inspector once and preserve both raw streams.
7. Capture all executable and managed-output identities.
8. Create the private control root and request once.
9. Invoke the controller once.
10. Invoke managed inspection once only after a native candidate pass.
11. Write one private verification decision and preserve every outcome.

No step may be repeated under this registration.
