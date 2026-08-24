# Complete Qwen3 Composition Conversion Preregistration

Date: 2026-08-24

## Decision

TinyRustLM's one prelaunch product needs one source-to-composition transaction,
not a collection of individually successful component commands. The canonical
transaction will be `tinyrustlm-convert qwen3-composition`. It will consume one
exact Qwen3 model closure and one related exact Qwen Tokenizer2 closure, then
create and independently verify the complete six-artifact composition needed
by the runtime.

The normative output-free registration is
`contracts/vnext/qwen3-composition-conversion-profile.v1.json`. It is 7,978
bytes with SHA-256
`2f95f79783ec6cd12160d51f9697c5c77aab2e6cd46afeb5140fdb513e5d8158`.
Its registration parent is commit
`f0df2170245673005bb04944a4549da165c3e824`, tree
`fb86ea62eab1f4c5110d6db75cdafefa7fe9771f`.

This registration precedes the complete-composition implementation and every
complete-composition output. It creates no model, graph, pass receipt,
rejection receipt, runtime output, browser output, quality evidence, or
campaign credit.

## Product Boundary

There is one prelaunch product. SLM2, Tokenizer2, Template2, Sampling2,
Prompt2, ACG2, profile identifiers, schemas, and command names are exact
technical identities, not product generations.

The transaction admits no legacy reader or writer, compatibility negotiation,
migration, alias, fallback, response repair, automatic retry, best-of-N
selection, or fixture-as-product path. Existing output is terminal evidence;
it is never overwritten, resumed, repaired, or silently deleted.

The existing `qwen3-safetensors` and `qwen-tokenizer2` operations remain exact
component compiler primitives owned by the same private executable. They are
not the browser-facing success boundary. The product can claim a converted
composition only after the complete transaction's final receipt exists and
its terminal rejection does not.

## Related Source Closures

The command receives exactly five operands after its command name:

1. model source-lock path;
2. model source-directory path;
3. tokenizer source-lock path;
4. tokenizer source-directory path; and
5. absent output-root path.

Both source roots must be existing direct non-reparse directories. They must
be distinct because each component converter owns a different closed directory
inventory. Neither may overlap the output tree. The output root must be absent
under an existing direct non-reparse parent.

The source locks must agree on model identity, immutable source revision, and
architecture profile. Their records for `config.json`, `merges.txt`,
`tokenizer.json`, `tokenizer_config.json`, and `vocab.json` must be byte-for-byte
identical in path, length, and SHA-256. This prevents composition of a model
with a tokenizer merely bearing a similar label.

The model source remains governed by
`tinyrustlm.qwen3-safetensors-to-slm2-mixed-q8/1`. The tokenizer source remains
governed by `tinyrustlm.qwen-tokenizer-to-tokenizer2/1`. The complete
transaction does not duplicate their parsers or weaken their exact source
inventories.

## Exact Architecture

The first complete transaction accepts only the current dense
`Qwen3ForCausalLM` shape:

- vocabulary size 151,936;
- context length 40,960;
- residual width 1,024;
- feed-forward width 3,072;
- 28 transformer layers;
- sixteen query heads and eight KV heads;
- independent head dimension 128;
- RoPE theta represented by F32 bits `0x49742400`;
- RMS normalization epsilon represented by F32 bits `0x358637bd`;
- tied input/output embeddings;
- no QKV projection bias; and
- paired Q/K normalization.

The SLM2 maximum is 2 GiB and 2,048 tensors for this transaction. These are
admission ceilings, not expected measurements and not permission to accept a
different shape.

## Complete Output

The output root contains exactly six runtime artifacts in this order:

1. `model.slm2`;
2. `tokenizer.tokenizer2`;
3. `template.template2`;
4. `sampling.sampling2`;
5. `prompt.prompt2`; and
6. `composition.acg2`.

The model is produced from the exact locked source. Tokenizer2 is produced
from its related exact source closure and must equal the already qualified
7,038,773-byte artifact at SHA-256
`cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b`.
Template2, Sampling2, and Prompt2 are reconstructed by their canonical Rust
owners and must reproduce their registered artifact identities. ACG2 is then
written over those five exact member records by `tinyrustlm-composition2`.

The transaction independently reparses every artifact through its canonical
owner. It requires the SLM2 vocabulary and context to equal Prompt2's bound
model vocabulary and context. It resolves ACG2 members one at a time, which
honors the composition resource planner without loading every dependency into
resident memory simultaneously.

## Transaction And Durability

The output root is created once. The first durable file is
`composition.attempt.json`, binding the operation, profile, source locks,
converter version, and executable identity before component work begins.

Each artifact is staged, synchronized, reparsed, and promoted create-only in
the final directory. The transaction rehashes all six artifacts, validates the
model shape and fixed dependency identities, accepts only a complete ACG2
resource plan, and rehashes both component conversion receipts. Directory
state is flushed before final verification.

Success requires all three conditions:

- process exit code zero;
- `composition.conversion-receipt.json` exists; and
- `composition.rejection.json` is absent.

The final pass receipt is written last. Any failure after root creation
preserves all existing bytes and writes one create-only terminal rejection.
Pass and rejection files are mutually exclusive. A pre-existing root is a
terminal prior attempt, never resumable work.

The transaction limits hash buffers to 1 MiB, resident dependency bytes to 80
MiB, source locks and receipts to 1 MiB each, and output inventory to twelve
files. These limits are enforced before claims are emitted.

## Claim Boundary

A successful receipt can prove only exact source binding, complete artifact
creation, structural parsing, cross-contract composition, byte identities, and
the transaction's durability observations.

It does not prove:

- source-framework numerical parity;
- native inference;
- browser WebAssembly inference;
- browser-local chat;
- model usefulness or safety;
- P2P availability;
- publication or deployment; or
- any campaign counter.

Those remain independent gates. MemoryEndpoints remains unauthorized and
disconnected. Counters remain 0/20 qualified models, 0/50 deletion-backed
browser rounds, 0/25 authorized live memory rounds, 0/40 current outside-lane
proofs, and 0/20 live catalog announcements.

## Implementation Sequence

1. Commit and push this profile, test, and decision while the complete output
   boundary is still empty.
2. Fresh-fetch and prove local, tracking, `FETCH_HEAD`, and direct remote-ref
   equality.
3. Implement the one create-only Rust transaction against the frozen profile
   hash without changing component ownership.
4. Add unit, relationship, cross-member, resource, create-only, interruption,
   rejection, and receipt tests.
5. Run formatting, warnings-denied Clippy, affected Rust suites, Node contract
   tests, source scans, and secret/private-path scans.
6. Commit, push, fetch, and prove remote equality before invoking the command
   on external large source bytes.
7. Integrate the private managed companion so browser acquisition uses only
   this complete success boundary.
8. Execute the transaction on one pinned external source for numerical parity,
   then independently qualify a useful derivative before product promotion.

## Registration Status

The profile is registered and immutable for implementation. No complete
composition command output exists at this checkpoint. Any implementation
disagreement requires stopping before output and deliberately replacing the
unpromoted contract, not adding compatibility or translating old bytes.
