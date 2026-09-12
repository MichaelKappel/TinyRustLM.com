# TinyRustLM storage consolidation — 2026-09-12

TinyRustLM source has one home: `E:\Source\Rust\TinyRustLM.com`.
Model payloads have one home: `D:\LLMs\TinyRustLM`. Keep the verified current
replacement and remove superseded copies. Commit source regularly; use Git
history instead of extra checkouts, backup directories, or scattered tooling.

The cleanup physically removed all 51 roots listed in
`contracts/storage/retired-storage-roots-2026-09-12.json`, including the three
`E:\TinyRustLM-vnext-*` roots and the hidden TinyRustLM scratch/evidence roots.
The source-authority verifier now rejects recreation of every listed root.
The retired external release-evidence container is no longer required.

The drive inventory inspected approximately seven million files without
following reparse points. `E:\System Volume Information` was inaccessible.
The separate `TinyRustLM.MiRust.com` developer-portal repository and references
to TinyRustLM in other projects' published documentation are not application
source copies and remain with their owning projects. Unrelated drive-root
maintenance scripts and the unrelated SQLite database were not TinyRustLM
source and were left alone.

Existing tracked and untracked application work was preserved. The unique old
`ecosystem-public-readback-v1.mjs` was tied to obsolete August receipts; it is
preserved in Git history on `archive/cleanup-20260912-readback`, rather than
installed as another active tool. The cleanup operation scripts are preserved
on that history branch too, with no extra checkout.

Twenty-four canonical artifact junctions were replaced with physical local
directories. Real model payloads and associated configuration then moved to
the designated D: store, including the physical C: store previously hidden
behind E: junctions. Source and destination lengths and SHA-256 values were
checked before source removal. The six tiny deterministic source-controlled
test fixtures remain test data, not installed or trained model storage.

Eighteen identical model payload copies (25,546,602,912 bytes) were replaced
with same-volume hard links. Complete checkpoint filenames remain usable with
one physical copy of each shared payload. Superseded conversion/training
checkpoints, raw tensor extractions, third-party environments, build caches,
old generated packages, and loose browser artifacts were deleted. No model
was promoted or newly qualified by this storage operation.

Bounded historical receipts remain under ignored `artifacts/retained-evidence`;
783 byte-identical receipts were removed after checking their retained copies.
The operation audit is under ignored `artifacts/cleanup-20260912`, including
file dispositions, source baselines, transfer hashes, deletion receipts, model
deduplication receipts, whole-drive inventories, and final verification.
The active model-location manifest is
`D:\LLMs\TinyRustLM\storage-manifest-20260912.json`. Historical receipts retain
their original paths as provenance; they are not instructions to recreate
retired storage or replay closed operations.

All 4,167 surviving `taboo.uai` files found in the drive inventory received the
current source, model, temporary-output, regular-commit, and replacement rules.
Keep temporary non-model output beneath the canonical repository and remove
it when its operation ends. Do not create another source copy for validation.

Validation is recorded in the local audit: canonical file preservation,
physical absence of all retired roots, all taboo notes present, SHA-256 model
preservation, physical hard-link identity, source-authority policy tests with
coverage, and the real source-authority gate. This is a local storage cleanup,
not an application release or deployment.

Final checks passed: 47 source-authority tests, 83.97% line coverage, and the
actual source-authority gate. Approximately 42 GB was reclaimed on E:; the
additional 25.5 GB model deduplication occurred within the designated D: store.
