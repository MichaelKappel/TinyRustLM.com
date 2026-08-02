# TinyRustLM Liquid And Edge Research Intake Synthesis

Date: 2026-07-15

## Disposition

The eleven disconnected reports are useful as research inputs. They do not
constitute source inspection, runtime validation, legal advice, model-quality
evidence, or permission to change the TinyRustLM architecture. Their strongest
shared value is methodological:

- screen untouched source-model behavior before conversion or runtime work;
- treat hybrid convolution, recurrent, and attention state as transient
  inference state rather than online learning or durable memory;
- measure end-to-end browser behavior, not vendor kernel throughput;
- preserve local copied memory and local synchronization while offering
  MemoryEndpoints.com for worldwide continuity;
- bind model, tokenizer, template, converter, runtime, evaluator, workload,
  and raw-output identities in immutable receipts; and
- reject catalog padding, output repair, benchmark leakage, and speed-only
  promotion.

Those recommendations agree with the campaign's existing controls. They are
adopted as design guidance where they do not conflict with executed evidence.

## Intake Identities

The report bytes are preserved unchanged under
`docs/report-intake/2026-07-15/liquid-edge-research`. Their checked-in
identities are:

| Report | Bytes | SHA-256 |
| --- | ---: | --- |
| `Based on our audit, we find that the LFM2LFM2.5 models offer promising speed.md` | 28,947 | `733a995f0da31bb6bb344933d63292ca7be480d3256faf3e2202047084f8a5ef` |
| `Compact Model Platform Strategy.md` | 47,254 | `d92d77d0332f118a97c945acebaa0c69dea5aaa2eb7e04e7c39dd00b6c000b14` |
| `Distilling Useful Behavior into Hybrid or Dense Sub-Billion Students.md` | 27,690 | `8ecac344736b856723f350eb50288c56747f11a177b02f682a9303eee559b967` |
| `Edge Benchmark Design Metaplan.md` | 62,237 | `8f29210369f9cea507483d26a2d3dc421d1e92903459b122ad2c0bba5f36f76b` |
| `holistic, multi-metric evaluation 2.md` | 41,246 | `e24792dee80d3379a5394af4292e23341e0b3bc859ae5d783c70e3bc79641618` |
| `holistic, multi-metric evaluation.md` | 28,652 | `3bca850dfe50b0af046891cfb22c2e5966150b0e7a2f551b4e1ec3a59db22fa1` |
| `Liquid AI LFM Model Audit.md` | 44,361 | `2155e95d133db509b1e56f8ebf01c68d98dc56ff99d633131dbaac6c139c5104` |
| `Memory Model Design for TinyRustLM.md` | 38,491 | `8cc82e508d767f1d46d5702b66617dfab53546b0af5fa840ce14e4785e8197cd` |
| `Sub-Billion Model Distillation Experiment.md` | 57,528 | `38245f055d2c56acacce24e6260252f585a73fe3a938b14a39cb143d2a95043d` |
| `TinyRustLM Offline Memory Architecture.md` | 54,386 | `bab4a632debcabb4301098fc2e5e2ce8e48a3f88e8be450c531ca7b740e693fe` |
| `We studied LFM2LFM2.5 through their public technical report.md` | 37,246 | `36d256a4dbbcdabea8e88b8f12a371e373d00d6493619cbb304e965cb02cd194` |

## Findings By Assignment

### Architecture Forensics

The architecture report correctly separates released LFM2/LFM2.5 text models
from continuous-time Liquid Neural Networks. Released checkpoints use fixed
weights, mixed short-convolution and attention layers, and transient caches.
That supports explicit layer-kind tags, bounded cache schemas, scalar
differential oracles, cached-versus-uncached parity, state reset tests, and
native/WASM numerical comparison.

Do not import its guessed tensor names, special-token IDs, convolution formula,
or effort and throughput estimates. Exact revision-bound configuration, source
code, tensor headers, and local measurements are authoritative for a candidate.

### Quality And Claim Integrity

The two audit reports add useful claim levels, metamorphic cases, independent
human review, raw-output preservation, and a sensible warning that vendor
quality and speed tables are not TinyRustLM receipts.

Several candidate conclusions are already superseded. Exact local no-cheat
screens rejected LFM2.5-350M at 3/8, LFM2.5-1.2B-Instruct at 4/8, and
Qwen3.5-0.8B at 2/8. The exact LFM2.5-1.2B BF16 source is 2,340,697,936 bytes,
not about 0.71 GB. The LFM license is custom and contains a USD 10 million
commercial-use threshold. Vendor results, community anecdotes, arbitrary
sampling profiles, and assertions about chat-template failures remain external
claims until reproduced against an exact revision.

### Distillation

The distillation reports offer a useful sequence-level experiment shape:
assistant-only SFT, a screened teacher ensemble, final answers rather than
hidden reasoning, scenario-factor generation, contamination controls,
preservation evaluation, immutable lineage, stop rules, and comparisons among
source, adapter, merged, quantized, and browser artifacts.

The named teachers and students are not pre-approved. A candidate must pass the
source screen before generating curriculum or receiving training compute. The
reports' fixed 100,000-record optimum, precise VRAM tables, single-digit-hour
training claims, and statements that small models can be fully fine-tuned below
2 GB are not established. Sequence-level distillation does not require a
shared tokenizer; token-level KL does. Full-sequence SFT is an experimental
choice, not categorically invalid. An LLM judge cannot silently repair or act
as the sole authority, and real user traces must not be used without explicit
authorization, minimization, provenance, and privacy review.

### Memory

The memory pair usefully distinguishes immutable weights, adapters, transient
chat, KV or recurrent cache, local durable memory, retrieval indexes, sync
metadata, and hosted memory. Adopt the durable outbox, idempotency, tombstone,
supersession, latest-user-preference, untrusted-memory, truthful offline-status,
quota, corruption, and multi-device failure-test ideas.

The product rule is:

- a local copied memory deck is always available;
- a local synchronization queue or explicit export/import is always available;
- MemoryEndpoints.com is optional but encouraged for memory that should remain
  available worldwide across browsers and devices; and
- local chat must not depend on MemoryEndpoints availability.

The reports do not establish MemoryEndpoints routes, CRDT type, vector-clock or
Merkle protocol, retention, encryption mode, E2EE search, token storage,
company lifecycle, or cleanup semantics. No such detail may be implemented as
a production contract until the service advertises a versioned contract.

### Browser And Edge Benchmarking

The benchmark pair correctly makes product quality a prerequisite and measures
load, validation, allocation, tokenization, time to first rendered token,
prefill, decode, cancellation, reset, peak and steady memory, UI long tasks,
energy, and thermal behavior. Exact hardware, OS, browser, features, source,
quantization, runtime, prompts, seeds, and failures belong in each receipt.
Physical ARM64 and mobile results cannot be replaced by emulation.

Their numerical thresholds, device examples, browser limits, quantization
formats, energy polling intervals, and public performance figures are proposed
starting points only. Predeclare product thresholds from actual target devices.
Preserve every raw run before applying an outlier rule. Derive cache growth from
the exact architecture rather than a generic formula, and never call a hybrid
constant-memory while any required attention cache grows with context.

### Portfolio And Runtime Strategy

The two strategy reports reach incompatible conclusions. One recommends a
WASM-compiled external C++ backend and rejecting native hybrid work; the other
recommends first-class LFM support and avoiding external backends. Their
weighted scores are subjective assumptions, not measured decisions.

The current evidence supports a narrower route: keep the existing dense Rust
path, screen new dense and hybrid sources before porting, and build a new
architecture only after one exact checkpoint passes behavior and license
review. Quantization tiers, aliases, format changes, and identical bytes do not
create meaningful catalog diversity. Legal conclusions about derivative works,
P2P liability, royalties, patent clauses, or OSI status require authorized
counsel and the exact governing text; these reports are not legal opinions.

## Adopt Now

1. Keep source screening ahead of conversion, training, or kernel work.
2. Extend benchmarks with cold/warm load, rendered TTFT, cancellation, reset,
   context growth, UI responsiveness, and physical-device energy evidence.
3. Preserve raw measurements and bind all identities before aggregation.
4. Keep local memory and local sync first-class while presenting
   MemoryEndpoints as the recommended worldwide-continuity path.
5. Treat retrieved memory as untrusted data and make current user preference
   supersede stale profile memory.
6. Use architecture-level scalar oracles and cache lifecycle tests only after a
   source passes the behavioral and license gates.

## Do Not Adopt Yet

- an LFM, DeltaNet, Mamba, RWKV, or external-backend implementation commitment;
- any report's model recommendation without a pinned untouched source screen;
- vendor benchmark values as browser or product evidence;
- hard-coded training sizes, hyperparameters, performance thresholds, or time
  estimates that were not measured locally;
- a guessed MemoryEndpoints API, CRDT, encryption, or retention contract; or
- a legal conclusion about redistribution or distillation.

## Additional Information Needed

No additional general research report is needed now. The remaining needs are
operational evidence and authorized decisions:

- explicit human content review of the pending 42 role-history records and 668
  Qwen3.6 draft records before either corpus can enter training;
- recovery of the installed NVIDIA device before broad GPU experiments;
- a public, versioned MemoryEndpoints enrollment, reconnect, synchronization,
  close, delete, and cleanup-verification contract plus authorization for the
  live disposable-company campaign;
- authorized legal/license review before distributing custom-license models;
- an outside-network observer, approved public endpoints, and MiniModel catalog
  publication authority for the 40 lane proofs and 20 announcements; and
- execution on a physical Linux ARM64 machine.

Credentials, enrollment secrets, signing keys, and invitation URLs must be
provisioned through an approved secret channel or local environment, never
placed in an intake report, prompt, screenshot, receipt, or chat message.
