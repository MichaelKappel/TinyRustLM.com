# Twelve Disconnected Research Prompts: Real Qwen3 Execution, Parity, And Browser Chat Closure

Each section below is a complete standalone assignment. Send each whole prompt
to a different technical research agent. The agents do not share context and
must not be expected to have read this introduction, another prompt, or any
private TinyRustLM material.

The reports are advisory research inputs, not implementation or test evidence.
Every agent must use current primary sources wherever possible, record source
publication or update dates and its own retrieval date, link directly to the
supporting material, and pin public repository observations to immutable
revisions. Every report must label and keep separate:

1. directly observed public facts;
2. sourced external facts;
3. project-supplied facts that the agent could not independently verify;
4. engineering analysis and recommendations;
5. assumptions, uncertainty, and competing interpretations; and
6. facts requiring local implementation, private evidence, real hardware, or
   authorized production verification.

No agent may claim that it inspected, built, ran, tested, or validated private
TinyRustLM code. A useful report is exceptionally technical and actionable: it
contains algorithms, pseudocode, state machines, schemas, equations, bounded
resource models, failure matrices, adversarial tests, objective acceptance
criteria, and a prioritized implementation sequence. Generic tutorials,
marketing summaries, invented measurements, and unsupported success claims
are not useful.

## Prompt 1: One-Shot Real Conversion Execution, Crash Semantics, And Evidence Custody

You are an independent principal release-systems engineer, Windows/Linux
filesystem specialist, and forensic evidence architect. Produce an
exceptionally detailed, implementation-oriented report describing how to run
one preregistered real model conversion exactly once, preserve every outcome,
and distinguish a valid terminal result from an interrupted or ambiguous
attempt. Target 8,000 to 15,000 words excluding the bibliography; prefer dense
technical substance over repetition.

You may browse public standards, operating-system documentation, Rust and Cargo
documentation, filesystem documentation, public papers, and public source
repositories. You have no access to the TinyRustLM source tree, private model
directories, converter executable, generated outputs, test results, receipts,
development machines, credentials, or deployment services. Do not request any
secret or private path and do not claim private validation.

Project-supplied facts and constraints, which you must identify as unverified
project facts in the report:

- TinyRustLM is one prelaunch product. There is no launched predecessor and no
  permission to add legacy readers, migration code, aliases, fallback
  converters, response repair, automatic retries, best-of-N selection, or
  known code debt. Technical names such as SLM2, Tokenizer2, Template2,
  Sampling2, Prompt2, and ACG2 are format identities, not product generations.
- The first real source is `Qwen/Qwen3-0.6B` at immutable public revision
  `c1899de289a04d12100db370d81485cdf75e47ca`. Its reviewed closure contains
  exactly nine direct regular files totaling 1,519,207,688 bytes. The
  `model.safetensors` member is 1,503,300,328 bytes.
- A public content-only source lock binds every allowed filename, byte length,
  and SHA-256 digest. The large source closure and generated output remain
  outside Git.
- A Rust executable named `tinyrustlm-convert` accepts one
  `qwen3-composition` command with five positional inputs: model source lock,
  model source directory, tokenizer source lock, tokenizer source directory,
  and output root.
- The output root must not exist before invocation. Its direct parent must
  already exist and must not be a reparse point or symlink. Source trees and
  output trees must not overlap.
- A successful transaction is expected to contain six canonical artifacts:
  `model.slm2`, `tokenizer.tokenizer2`, `template.template2`,
  `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`, plus bounded
  evidence records. A terminal pass and terminal rejection are mutually
  exclusive, create-only, and written last.
- The immediate run must be preregistered while still output-free. The
  registration must bind source revision/tree, source locks, conversion
  profile, exact command, Rust/Cargo toolchain, build recipe, future executable
  capture rule, owned absent output identity, log custody, zero retry, and
  terminal evidence rules. It must be committed and remotely verified before
  any output is created.
- Accepted Tokenizer2 and Template2 observations are immutable dependencies
  and must not be rerun merely for convenience.
- Structural conversion cannot by itself prove source-framework parity,
  native inference, browser-WASM inference, browser chat, model quality, P2P
  availability, publication, or campaign progress.
- MemoryEndpoints is unauthorized and disconnected and is outside this task.

Research current primary documentation and standards for Windows NTFS and
Linux filesystem create-only behavior, hard links, rename/replace semantics,
directory handles, reparse points, symlinks, file and directory flushes,
write-through, process creation and termination, inherited handles, job
objects, signals, exit codes, disk-full behavior, sparse files, antivirus and
indexer interference, Cargo JSON artifact messages, executable identity,
SHA-256 streaming, monotonic and wall clocks, canonical JSON, and relevant
provenance standards. Separate documented guarantees from observed or
filesystem-specific behavior.

Address all of the following in depth:

1. Define immutable identities for the registration, source commit and tree,
   source locks, source closure, toolchain, build invocation, Cargo artifact
   event, executable bytes, execution attempt, output root, each output member,
   log stream, terminal outcome, and independent verification. Explain how to
   avoid circular identities when the executable does not exist at initial
   registration time.
2. Design a two-stage registration model, if needed, in which an output-free
   intent constrains a later executable-capture record without permitting a
   different command, source, output root, or second attempt. State exact
   allowed transitions and which fields may be filled later.
3. Specify a create-only ownership protocol for the output root on Windows and
   Linux. Cover canonical absolute paths, case folding, path prefixes, device
   roots, junctions, mount points, symlinks, hard links, alternate data streams,
   8.3 names, Unicode normalization, parent replacement, and time-of-check to
   time-of-use races.
4. Define how the controller builds the release executable, consumes Cargo
   `compiler-artifact` JSON rather than guessing a target path, streams its
   hash, records PE/ELF metadata, and proves that the invoked bytes equal the
   captured bytes.
5. Specify process ownership. On Windows include job objects, kill-on-close,
   process trees, console control, inherited handles, and crash dumps. On Linux
   include process groups, parent-death signals where available, signals,
   descendants, and descriptor inheritance. State what can and cannot be made
   portable.
6. Design separate capture of stdout and stderr without deadlock, truncation,
   secret leakage, or loss on crash. Include maximum lengths, incremental
   hashing, timestamps, binary/non-UTF-8 handling, redaction policy, and the
   rule that redacted reports never replace retained raw evidence.
7. Give an exact state machine for registered, building, executable-captured,
   invocation-started, running, process-exited, terminal-pass-observed,
   terminal-rejection-observed, interrupted-ambiguous, independently-verified,
   and permanently-closed. Include all invalid transitions.
8. Analyze every crash boundary: before process creation, after creation but
   before attempt evidence, during each member write, after file flush, after
   directory flush, during verification, after terminal record creation, after
   process exit but before controller persistence, and during machine power
   loss. Explain which states are recoverable by observation and which require
   a new explicitly registered attempt with a different output identity.
9. Explain why an automatic rerun, deletion-and-retry, reuse of a partial root,
   stdout-only success test, or repaired receipt destroys evidence integrity.
   Design the explicit operator decision required before a distinct attempt.
10. Define independent post-run verification that does not trust process exit
    alone: inventory, type and link checks, streaming hashes, bounded parsing,
    graph resolution, receipt hashes, terminal exclusivity, source/output
    separation, and no unexpected files.
11. Provide disk, memory, file-handle, and time budget formulas. Include
    preflight free-space reserves, worst-case staging overhead, filesystem
    metadata, logs, page cache, hash passes, and a fail-before-output rule when
    bounds cannot be met.
12. Provide a fault-injection matrix for disk full, access denied, locked file,
    antivirus delay, source mutation, source truncation, parent replacement,
    process kill, child leak, controller crash, power loss, malformed receipt,
    terminal-record collision, stale executable, output-root collision, clock
    rollback, and hash mismatch.
13. Design public-safe evidence minimization. Public records may disclose
    public IDs, hashes, versions, counts, sizes, timestamps, bounded error codes,
    and status. They must exclude private paths, prompts, model content,
    credentials, environment secrets, usernames, machine IDs, and raw logs.
14. Give language-neutral pseudocode for registration validation, executable
    capture, process launch, concurrent log drains, terminal reconciliation,
    independent verification, and permanent closure.
15. State the minimum evidence that permits the narrow claim "one complete
    structural composition was created" and list every broader claim that
    remains prohibited.

Required report structure:

1. Executive recommendation and explicit assumptions.
2. Public-source observation log with dates and immutable links.
3. Identity graph and anti-circular-registration design.
4. Cross-platform path and output-root ownership rules.
5. Build and executable-capture algorithm.
6. Process supervision and log-custody architecture.
7. Conversion-attempt state machine.
8. Crash-boundary and reconciliation table.
9. Independent terminal verification algorithm.
10. Resource formulas and preflight admission policy.
11. Fault-injection and adversarial test matrix.
12. Public/private evidence and redaction schema.
13. Rust-oriented implementation pseudocode and module boundaries.
14. Objective acceptance checklist and prohibited claims.
15. Prioritized implementation sequence.
16. Unknowns requiring local execution.
17. Annotated primary-source bibliography with publication/update and retrieval
    dates.

Do not recommend automatic retries, cleanup of failed output, mutable receipts,
path guessing, newest-file selection, shell-text parsing when structured Cargo
events exist, success from exit code alone, or a compatibility path for an
invalid prelaunch format. Do not invent a private converter behavior or claim
that a public filesystem guarantee proves this project implemented it.

## Prompt 2: Immutable Qwen3 Source Closure And Independent Tensor-Schema Oracle

You are an independent principal model-format engineer, safetensors security
reviewer, and transformer-architecture auditor. Produce an exceptionally
detailed report that independently reconstructs the complete public source
identity and expected tensor schema of Qwen3-0.6B at one immutable revision,
then specifies a bounded oracle suitable for checking a private converter
without access to that converter. Target 8,000 to 15,000 words excluding the
bibliography.

You may browse public model repositories, immutable raw files, official model
cards, Transformers source, safetensors documentation/source, papers, and
license texts. You have no access to TinyRustLM source code, local model files,
conversion output, test logs, receipts, machines, credentials, or private
evaluation data. You must not claim private inspection or validation.

Project-supplied facts and constraints, to be labeled as unverified project
facts:

- TinyRustLM is a single prelaunch browser-local AI product. No legacy,
  migration, alias, fallback, compatibility reader, or known debt is allowed.
- The public source candidate is `Qwen/Qwen3-0.6B` at revision
  `c1899de289a04d12100db370d81485cdf75e47ca`, under a project-reviewed
  Apache-2.0 disposition.
- The locked direct-file closure is exactly `config.json`,
  `generation_config.json`, `LICENSE`, `merges.txt`, `model.safetensors`,
  `README.md`, `tokenizer.json`, `tokenizer_config.json`, and `vocab.json`,
  totaling 1,519,207,688 bytes. The model tensor file is 1,503,300,328 bytes.
- Supplied architecture values are: `Qwen3ForCausalLM`, vocabulary 151,936,
  context 40,960, hidden size 1,024, intermediate size 3,072, 28 layers, 16
  query heads, 8 KV heads, head dimension 128, tied embeddings, no QKV bias,
  Q/K normalization, RoPE theta represented by float bits `0x49742400`, and
  RMS normalization epsilon represented by float bits `0x358637bd`.
- A converter is intended to lower this source into a mixed-Q8 SLM2 model plus
  five non-model composition artifacts. This report concerns the immutable
  public source and an independent tensor oracle, not private SLM2 bytes.
- The unchanged public base model is not accepted as a product-quality model.
  It may be used only as a conversion/runtime parity ancestor and as ancestry
  for a future qualified derivative.
- No real conversion output has yet been accepted. MemoryEndpoints is
  unauthorized and disconnected.

Use primary sources to independently verify or challenge every publicly
checkable supplied value. Pin every repository observation to the immutable
revision rather than a moving default branch. Explain any discrepancy instead
of silently choosing the project value.

Address all of the following in depth:

1. Reconstruct the immutable repository closure through public APIs or raw
   URLs. Record filename, Git/LFS identity where applicable, byte length,
   SHA-256 strategy, content type, symlink status, and whether the public host
   serves bytes directly or through LFS indirection. Explain how an operator
   can verify the revision without trusting mutable metadata.
2. Analyze the license chain for model weights, configuration, tokenizer,
   documentation, and any generated derivative. Distinguish copyright license,
   model-use terms, attribution, notice retention, trademark, and dataset
   uncertainty. Do not give a legal conclusion beyond sourced facts and
   clearly marked engineering recommendations.
3. Parse the safetensors header format from primary documentation. Specify
   little-endian length handling, JSON bounds, duplicate keys, dtype vocabulary,
   shape arithmetic, offset intervals, alignment, overlap, gaps, trailing
   bytes, integer overflow, resource ceilings, metadata, and rejection of
   malformed or adversarial files.
4. Enumerate the exact expected tensor-name families for embeddings, every one
   of 28 decoder layers, final normalization, and output head behavior. Include
   Q/K normalization tensors, attention projections, MLP gate/up/down
   projections, RMSNorm tensors, biases if any, and tied-weight implications.
5. Derive every expected tensor shape from hidden size, head counts, head
   dimension, intermediate size, vocabulary, and layer count. Show formulas,
   element counts, expected source dtype, expected byte contribution, and total
   tensor-count and payload cross-checks.
6. Resolve public implementation details that configuration alone may not
   settle: Q/K norm placement, RoPE application, rotary dimension, causal mask,
   scaling, RMSNorm order, residual topology, SwiGLU ordering, projection
   orientation, tied embedding/output semantics, special-token IDs, and
   generation defaults.
7. Define a generated independent schema oracle whose authoritative input is a
   small declarative architecture record, not a copied list of private
   converter expectations. Explain how to prevent the oracle and converter
   from sharing the same bug.
8. Design streaming validation that never maps or copies the full 1.5 GB file
   unnecessarily. Include bounded random access, header-only checks, chunked
   hashing, tensor-span hashing, short-read detection, source mutation during
   read, file identity checks, and memory formulas.
9. Specify canonical tensor-to-semantic-role mapping and distinguish source
   storage orientation from runtime mathematical orientation. Include
   transposition rules and tests that catch a square matrix whose accidental
   transpose would evade shape validation.
10. Define deterministic sample extraction for independent numerical checks:
    fixed rows, columns, edge elements, whole small tensors, stratified layer
    coverage, content-derived sampling, and cryptographically committed random
    positions. Explain resistance to cherry-picking.
11. Provide adversarial mutations: missing tensor, extra tensor, duplicate JSON
    name, wrong shape with same element count, swapped Q/K, wrong head count,
    output head present despite tied embeddings, transposed square weights,
    overlapping spans, hidden trailing payload, NaN/Inf source values, short
    file, changing file, and LFS pointer text masquerading as weights.
12. Define a machine-readable public tensor-schema manifest containing only
    public-safe identities and expectations. Include versioning rules that do
    not introduce a legacy reader for prelaunch defects.
13. Explain which checks can be performed before conversion, which require a
    private local source copy, which require observing SLM2 output, and which
    require source-framework execution.
14. Give Rust-oriented parser and schema-oracle pseudocode with checked
    arithmetic, bounded allocation, deterministic ordering, explicit error
    codes, and no unbounded JSON deserialization.
15. Define objective rejection and acceptance criteria for calling the source
    closure and tensor interpretation conversion-ready, while explicitly
    excluding quality and runtime claims.

Required report structure:

1. Executive conclusion and discrepancies found.
2. Public immutable observation log.
3. Source closure and license table.
4. Safetensors threat model and bounded parser rules.
5. Exact architecture semantics.
6. Complete tensor-name and shape matrix.
7. Independent schema-oracle design.
8. Streaming identity and mutation-detection algorithm.
9. Tensor orientation and semantic-role rules.
10. Deterministic sampling and numerical-inspection plan.
11. Adversarial corpus and fuzz strategy.
12. Public manifest schema and version discipline.
13. Rust implementation recommendations.
14. Acceptance/rejection checklist and claim boundary.
15. Unknowns requiring private source bytes or execution.
16. Annotated primary-source bibliography with dates and immutable links.

Do not infer tensor correctness from filename, total size, model popularity, or
successful JSON parsing. Do not copy an unpinned community tensor list, assume
that all Qwen-family variants share one schema, invent missing public facts, or
claim that structural agreement proves useful conversation quality.

## Prompt 3: Mixed-Q8 Qwen3 Quantization Contract, Error Budgets, And Portable Kernels

You are an independent principal quantization researcher, numerical-computing
engineer, and CPU/WASM inference specialist. Produce an exceptionally detailed
report specifying a quality-preserving mixed-Q8 conversion and execution
contract for Qwen3-0.6B that can be implemented consistently in scalar Rust,
native SIMD, and browser WebAssembly. Target 8,000 to 15,000 words excluding
the bibliography.

You may browse current peer-reviewed papers, official project repositories,
immutable source revisions, compiler and ISA documentation, WebAssembly
specifications, and model documentation. You have no access to TinyRustLM
source, its SLM2 format implementation, model bytes, conversion outputs,
benchmarks, hardware, receipts, or private evaluations. You must not claim
private validation and must distinguish public facts from recommendations.

Project-supplied facts and constraints, to be treated as unverified project
facts:

- TinyRustLM is one prelaunch browser-local product. There is no legacy model
  path and no permission for compatibility readers, runtime repacking,
  dense-F32 shadow weights, fallback inference engines, temporary duplicate
  kernels, response repair, or benchmark-driven test weakening.
- The immediate public ancestor is `Qwen/Qwen3-0.6B` revision
  `c1899de289a04d12100db370d81485cdf75e47ca`: hidden size 1,024,
  intermediate size 3,072, 28 layers, 16 query heads, 8 KV heads, head
  dimension 128, Q/K normalization, tied embeddings, and no QKV bias.
- The intended portable model stores major matrix and embedding weights in an
  explicit mixed-Q8 representation while retaining numerically sensitive
  norms, scales, biases, and runtime state in suitable floating-point forms.
- The runtime must execute stored quantized bytes directly. Converting all
  weights back to a persistent dense-F32 copy or repacking to a hidden second
  format is prohibited.
- Conversion success must not be inferred from output size. Native and browser
  outputs must be compared with a pinned source-framework oracle, and model
  usefulness requires a separate untouched semantic gate.
- TurboQuant, TurboVec, KV-cache quantization, and related current research are
  relevant sources of ideas, not automatically approved dependencies or proof
  that a technique fits this architecture.
- No accepted real model output or benchmark measurement is supplied.
  MemoryEndpoints is unauthorized and outside this task.

Research state-of-the-art weight-only and weight-activation quantization,
including per-tensor, per-channel, per-row, grouped, symmetric, asymmetric,
zero-point-free, outlier-aware, rotation-based, activation-aware, and
calibration-free methods. Examine primary sources and official implementations
for relevant TurboQuant/TurboVec work, SmoothQuant, AWQ, GPTQ, SpQR, QuaRot,
QuIP-style methods, BitNet/ternary work where relevant, llama.cpp or other
portable CPU kernels, and WebAssembly SIMD constraints. Clearly distinguish
what applies to post-training quantization of an existing dense Qwen3 model
from methods requiring quantization-aware pretraining or architecture changes.

Address all of the following in depth:

1. Define the mathematical Q8 representation recommended for each tensor role:
   signed code domain, scale domain, zero point, granularity, block or row
   shape, rounding mode, clipping rule, NaN/Inf policy, zero-row behavior,
   denormal behavior, and canonical byte order.
2. Compare per-row symmetric Q8 with grouped Q8, per-channel asymmetric Q8,
   activation-aware alternatives, and rotation-based alternatives for this
   exact 0.6B architecture. Include storage, conversion complexity, scalar
   kernel complexity, WASM portability, calibration requirements, and likely
   error modes.
3. Assign a storage/execution policy to embeddings, tied output projection,
   attention Q/K/V/O matrices, MLP gate/up/down matrices, Q/K norm, RMSNorm,
   any bias, RoPE constants, and KV state. Explain why each role is quantized
   or retained in a floating form.
4. Derive deterministic quantization equations and reference pseudocode.
   Specify float-to-integer conversion, tie handling, saturation, operation
   order, floating-point contraction policy, scale serialization, and how to
   obtain bit-identical converted bytes across supported hosts.
5. Analyze tied embeddings. Determine whether one physical quantized tensor can
   safely serve lookup and output projection, how orientation is represented,
   and how to prevent accidental duplicate storage or numerically divergent
   copies.
6. Define scalar reference kernels for embedding lookup, matrix-vector
   multiplication, QKV projections, output projection, and MLP projections.
   Show accumulation type, loop order, scale application, bias/norm placement,
   and checked dimension handling.
7. Design native SIMD kernels for x86-64 and ARM64 and a WebAssembly SIMD128
   implementation. Discuss dot-product instruction availability, widening,
   signed multiplication, horizontal reduction, tail handling, alignment,
   cache tiling, threading, and a scalar equivalence oracle.
8. Analyze TurboVec- and TurboQuant-like vector transformations or Hadamard/
   rotation methods. State whether they would require transformed activations,
   extra metadata, changed kernels, calibration, or model retraining; quantify
   overhead symbolically and define a go/no-go experiment rather than assuming
   adoption.
9. Define numerical error measurements at weight, operation, layer, logits,
   token rank, and generated-sequence levels. Include absolute/relative error,
   cosine similarity, KL divergence, top-k overlap, argmax stability, and
   task-level regression, with rationale for thresholds rather than invented
   numbers.
10. Design a preregistered calibration and evaluation split if any method needs
    data. Prevent evaluation prompts, expected terms, public benchmark answers,
    or private holdouts from influencing quantization choices.
11. Specify a first-divergence harness comparing dense public source,
    independently quantized reference, scalar Rust, native SIMD, and browser
    WASM at selected tensor rows, layer boundaries, attention scores, residual
    streams, logits, and generated tokens.
12. Provide size, memory-bandwidth, cache, arithmetic-intensity, and latency
    formulas for the 0.6B model. Separate model storage, transient activations,
    KV cache, tokenizer/template artifacts, WASM linear memory, and browser
    duplication during transfer or worker startup.
13. Define adversarial tests for all-zero rows, tiny ranges, extreme outliers,
    NaN/Inf, scale overflow/underflow, dimensions not divisible by SIMD width,
    unaligned data, corrupted scales, wrong orientation, duplicate tied weight,
    scalar/SIMD tail drift, and browser feature absence.
14. Compare one fixed portable representation with target-specific on-disk
    representations. Recommend a single prelaunch design and explain how to
    avoid runtime repacking or permanent format forks.
15. Specify the minimum evidence for structural quantization correctness,
    numerical parity, performance characterization, and semantic quality as
    four separate claims.

Required report structure:

1. Executive recommendation and method exclusions.
2. Current primary-source research matrix.
3. Exact proposed mixed-Q8 mathematical contract.
4. Tensor-role storage policy.
5. Deterministic converter algorithm.
6. Scalar kernel specification.
7. x86-64, ARM64, and WASM SIMD strategy.
8. TurboQuant/TurboVec and rotation-method applicability analysis.
9. Numerical error hierarchy and first-divergence protocol.
10. Contamination-safe calibration design.
11. Storage, memory, bandwidth, and latency formulas.
12. Adversarial and differential test matrix.
13. Representation decision and no-fork implementation plan.
14. Objective gates and prohibited claim language.
15. Unknowns requiring local model bytes, hardware, or browser execution.
16. Annotated primary-source bibliography with dates and immutable links.

Do not recommend 1-bit or ternary storage merely because it is smaller when the
public source was not trained for it. Do not treat a paper's GPU result as a
WASM result, compare only final text, use evaluation data for calibration,
hide a dense fallback, permit runtime repacking without explicit accounting,
or invent TinyRustLM speed or quality measurements.

## Prompt 4: Independent Six-Artifact Composition Verification And Semantic Closure

You are an independent principal binary-format verifier, content-addressed
storage architect, and adversarial parser engineer. Produce an exceptionally
detailed report designing an independent verifier for a six-artifact local
language-model composition. The verifier must establish byte identity,
canonical structure, cross-artifact semantic compatibility, and a narrow
terminal structural claim without trusting the converter that produced the
artifacts. Target 8,000 to 15,000 words excluding the bibliography.

You may browse public binary-format standards, cryptographic standards,
content-addressed storage designs, parser-security literature, filesystem
documentation, Rust documentation, and public model-format implementations.
You have no access to TinyRustLM source, private format profiles, generated
artifacts, converter output, tests, receipts, machines, or credentials. Do not
claim that you inspected or validated private bytes. Where exact private
format fields are unavailable, identify the required local contract explicitly
instead of inventing it.

Project-supplied facts and constraints, to be labeled as unverified project
facts:

- TinyRustLM is one prelaunch browser-local product. There is no legacy format
  population and no permission for compatibility readers, schema negotiation,
  migration, aliases, fallback loaders, repair, or permissive parsing.
- The first complete composition is expected to contain exactly these ordered
  artifacts: `model.slm2`, `tokenizer.tokenizer2`, `template.template2`,
  `sampling.sampling2`, `prompt.prompt2`, and `composition.acg2`.
- Their technical format profiles are respectively `org.minimodel.slm2/2.0`,
  `org.minimodel.tokenizer2/2.0`, `org.minimodel.template2/2.0`,
  `org.minimodel.sampling2/2.0`, `org.minimodel.prompt2/2.0`, and
  `org.minimodel.acg2/2.0`. These are technical identities, not a product V2.
- The fixed accepted Tokenizer2 identity is 7,038,773 bytes at SHA-256
  `cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b`.
  The fixed Sampling2 identity is 65,800 bytes at SHA-256
  `9e02fcfbba169330a2ee1bf40cea015dc4067925e051f6ae5f197a5f880bfe89`.
  The fixed Prompt2 identity is 512 bytes at SHA-256
  `27aaed18b62930213a2395e398e68d18a90d4280e24c23d794e3e94352d7e1f3`.
  Template2 is also fixed by an immutable digest, while model SLM2 and ACG2 are
  outputs of the real composition transaction.
- The model ancestor is `Qwen/Qwen3-0.6B` revision
  `c1899de289a04d12100db370d81485cdf75e47ca`; required model semantics include
  vocabulary 151,936, context 40,960, hidden size 1,024, 28 layers, 16 query
  heads, 8 KV heads, head dimension 128, Q/K norm, tied embeddings, and mixed-Q8
  major weights.
- The converter is intended to hash and canonically parse every member,
  compare writer and parser identities, validate model shape, validate fixed
  non-model identities, validate prompt vocabulary/context compatibility,
  resolve graph members one at a time, and accept a complete resource plan.
- Terminal pass and terminal rejection records are mutually exclusive,
  create-only, bounded, and written last. Existing output roots are terminal
  and are never resumed or repaired.
- A structurally valid composition does not prove numerical parity, native or
  browser execution, conversation quality, P2P availability, publication, or
  campaign progress. MemoryEndpoints is unauthorized and out of scope.

Research primary sources for secure binary parsing, canonical encodings,
SHA-256, domain-separated hashing, Merkle DAGs and content-addressed graphs,
integer-overflow defenses, parser differential testing, local-file race
resistance, TOCTOU mitigation, fuzzing, and supply-chain attestations. Analyze
the tradeoffs of one verifier process versus parser libraries shared with the
writer, and of byte-identical versus semantic identity.

Address all of the following in depth:

1. Define separate identities for each artifact's bytes, format profile,
   parsed semantic content, composition membership, ordered graph, source
   ancestry, converter receipt, verification run, and terminal decision.
   Specify domain separation and canonical serialization.
2. Resolve graph-identity circularity when `composition.acg2` names or hashes
   the other artifacts but is itself part of the six-artifact composition.
   Compare root-manifest, excluded-self, two-level manifest, and content-DAG
   designs and recommend one exact prelaunch design.
3. Specify strict file admission before parsing: exact basename allowlist,
   direct regular files, no symlinks/reparse points, no hard-link substitution,
   bounded count and sizes, stable file identity across read, no alternate data
   streams, no hidden trailing members, and no unrecognized evidence files.
4. Design bounded streaming hashing and parsing for a model artifact that may
   approach 2 GiB while the non-model artifacts are much smaller. Include
   checked offsets, allocation ceilings, short reads, concurrent mutation,
   mmap tradeoffs, page faults, and deterministic error precedence.
5. Define canonical parser obligations for every format: magic/version,
   reserved bytes, canonical flags, shortest encodings, deterministic ordering,
   duplicate rejection, exact length closure, alignment/padding, unknown fields,
   numeric range checks, UTF-8 rules, and trailing-byte rejection.
6. Explain how an independent verifier avoids sharing the converter's bug.
   Compare separate codebases, generated specifications, declarative schemas,
   cross-language implementations, property-based oracles, and parser/writer
   round trips. State which approaches are genuinely independent.
7. Specify cross-artifact semantic invariants: model vocabulary equals
   tokenizer and Prompt2 vocabulary; model context admits Prompt2 limits;
   tokenizer special IDs agree with Template2 and stopping; Sampling2 token
   bounds fit vocabulary; model architecture and runtime requirements match;
   ACG2 references exact member identities, kinds, order, and resource plan.
8. Define resource-plan verification for browser-local execution. Include model
   bytes, fixed artifacts, WASM linear memory, duplicated transfer buffers,
   activations, KV cache by context length, worker overhead, persistent storage,
   and explicit admission versus runtime guarantees.
9. Design an append-only verification receipt that binds verifier executable,
   source commit, format contracts, input root identity, all member hashes,
   parsed summaries, graph identity, resource result, timestamps, and bounded
   errors without exposing private paths or model content.
10. Specify race-resistant reconciliation between process exit, converter
    terminal record, independent verifier result, and controller decision.
    Explain how a successful independent verification can coexist with a
    preserved failed converter observation without rewriting history.
11. Provide a mutation corpus for each artifact and the graph: byte flips,
    truncation, extension, wrong version, noncanonical padding, integer overflow,
    duplicate tensor, wrong tensor shape, changed tokenizer ID, stale template,
    wrong sampling vocabulary, graph reordering, member substitution, self-hash
    ambiguity, symlink swap, and receipt substitution.
12. Design fuzzing layers for raw parsers, structured artifacts, cross-artifact
    resolution, filesystem inventory, and receipt parsing. Include seed corpus
    provenance, sanitizer requirements, time/resource limits, crash retention,
    and why fuzz completion is never proof of absence of defects.
13. Provide language-neutral and Rust-oriented pseudocode for inventory,
    stable-open hashing, bounded parse dispatch, semantic compatibility,
    graph resolution, and receipt creation.
14. Define the exact boundary between structural verification and numerical
    conformance. List observations that require loading model values or running
    inference and must not be inferred from structure.
15. Give objective acceptance criteria, explicit error taxonomy, test coverage
    expectations, and a prioritized implementation plan that creates one
    canonical verifier rather than retaining alternate paths.

Required report structure:

1. Executive verifier recommendation.
2. Public research observation log.
3. Byte, semantic, graph, and evidence identity model.
4. Graph-circularity resolution.
5. Filesystem admission and stable-read algorithm.
6. Per-format strict parser contract template.
7. Independent-verifier architecture.
8. Cross-artifact semantic-invariant matrix.
9. Resource-plan formulas and browser admission linkage.
10. Receipt schema and reconciliation state machine.
11. Mutation corpus, property tests, and fuzz plan.
12. Rust module boundaries and pseudocode.
13. Structural-versus-numerical claim taxonomy.
14. Objective acceptance and rejection checklist.
15. Prioritized implementation sequence.
16. Unknowns requiring private format profiles or real artifacts.
17. Annotated primary-source bibliography with dates.

Do not propose permissive unknown-field handling, repair, best-effort loading,
format sniffing, fallback parsing, reader compatibility for an invalid
prelaunch format, full-file buffering without a bound, or success because all
six filenames exist. Do not invent private field layouts.

## Prompt 5: Pinned Source-Framework Oracle And First-Divergence Numerical Parity

You are an independent principal ML conformance engineer, PyTorch/Transformers
reproducibility specialist, and numerical-debugging researcher. Produce an
exceptionally detailed report defining a pinned source-framework oracle and a
first-divergence laboratory for comparing Qwen3-0.6B source execution with a
mixed-Q8 Rust runtime and a browser-WASM runtime. Target 8,000 to 15,000 words
excluding the bibliography.

You may browse official Qwen documentation, the immutable public model
revision, Transformers and PyTorch documentation/source, safetensors source,
WebAssembly specifications, numerical-reproducibility literature, and public
test methodologies. You have no access to TinyRustLM code, generated model
artifacts, local source weights, runtime output, browsers, tests, receipts,
hardware, private prompts, or credentials. Do not claim private validation.

Project-supplied facts and constraints, to be labeled as unverified project
facts:

- TinyRustLM is one prelaunch browser-local product with no legacy runtime,
  compatibility loader, alternate inference engine, output repair, automatic
  retry, best-of-N selection, or permission to lower tests after observing a
  preferred result.
- The public ancestor is `Qwen/Qwen3-0.6B` at revision
  `c1899de289a04d12100db370d81485cdf75e47ca`. Supplied architecture values are
  vocabulary 151,936, context 40,960, hidden size 1,024, intermediate size
  3,072, 28 layers, 16 query heads, 8 KV heads, head dimension 128, Q/K norm,
  tied embeddings, no QKV bias, RoPE theta float bits `0x49742400`, and RMSNorm
  epsilon float bits `0x358637bd`.
- Conversion is intended to create one six-artifact composition: mixed-Q8
  SLM2 model plus immutable Tokenizer2, Template2, Sampling2, Prompt2, and an
  ACG2 graph. The tokenizer and template have already completed immutable
  byte-level gates and should be consumed rather than casually regenerated.
- Structural conversion alone is not numerical evidence. A successful native
  run alone is not browser evidence. Matching one final string can hide an
  early numerical or tokenization divergence.
- The unchanged base model is rejected as a product-quality model but remains
  the required source-framework parity ancestor. Parity and quality are
  separate questions.
- Raw candidate output must be preserved. Response repair, answer completion,
  cherry-picked retries, or expected-answer injection is prohibited.
- No accepted real conversion, native, WASM, browser-chat, or quality result is
  supplied. MemoryEndpoints is unauthorized and disconnected.

Research exact Qwen3 support in official Transformers source and model
documentation at immutable revisions. Cover chat templates, thinking and
non-thinking modes, tokenizer behavior, special tokens, generation defaults,
attention implementation choices, cache APIs, deterministic algorithms,
floating-point controls, CPU reproducibility, and known nondeterminism. Record
the exact package revisions you recommend and why.

Address all of the following in depth:

1. Define a complete oracle environment identity: model revision and files,
   tokenizer files, chat template bytes, Transformers commit/version, PyTorch
   version/build, safetensors version, Python and dependencies, CPU ISA,
   operating system, thread counts, BLAS backend, environment variables,
   dtype, attention backend, cache mode, generation settings, and seed.
2. Specify an offline, network-disabled environment assembly procedure using a
   content-addressed wheel or package set. Explain how to prove no model or code
   drift after the initial public acquisition.
3. Determine the publisher-exact Qwen3 conversation construction for system,
   user, assistant, multi-turn, thinking-disabled, and thinking-enabled modes.
   Identify exact special tokens, generation prompt, stop tokens, and assistant
   boundaries from primary sources. Separate observed facts from uncertainty.
4. Design at least three oracle tiers: pure tokenizer/template token IDs,
   dense source forward pass, and seeded source generation. Define what each
   tier can prove and what it cannot.
5. Specify trace points at embeddings, each RMSNorm, Q/K normalization, Q/K/V
   projections, RoPE, attention logits, softmax, attention output, residuals,
   MLP projections and activation, layer output, final norm, and vocabulary
   logits. Include tensor shapes and a bounded capture strategy.
6. Design first-divergence search that starts from exact input bytes and token
   IDs, compares progressively deeper checkpoints, and localizes orientation,
   RoPE, head mapping, norm, quantization, accumulation, cache, or sampler
   defects without relying on final text.
7. Define comparison rules for exact discrete values and tolerant floating
   values. Include ULP, absolute/relative error, normalized error, cosine
   similarity, top-k overlap, KL divergence, rank correlation, argmax margin,
   and token stability. Explain threshold derivation from a calibration corpus
   that excludes evaluation answers.
8. Separate dense-source-versus-independent-Q8-reference error from
   Q8-reference-versus-Rust error and Rust-scalar-versus-SIMD/WASM error. Show
   why collapsing these comparisons obscures root cause.
9. Define deterministic prefill and decode cases covering empty/minimal input,
   Unicode, long token sequences, repeated tokens, boundary lengths, multi-turn
   prompts, cache reuse, cache reset, cancellation, context-limit rejection,
   and stop-token behavior.
10. Design source-framework cache and no-cache equivalence tests. Include
    position IDs, causal masks, past length, grouped-query head expansion,
    prompt boundary, and one-token decode. State how to detect off-by-one cache
    errors.
11. Specify seeded sampling conformance for temperature, top-k, top-p,
    repetition penalty, random-number stream, floating tie behavior, stop
    tokens, and maximum output. Distinguish bit-exact sampler parity from
    tolerance-based model-logit parity.
12. Define a trace artifact and receipt schema that binds all inputs and
    environments while excluding private prompt text from public evidence.
    Include hashes, bounded summaries, first-divergence location, and raw
    evidence custody.
13. Provide a failure taxonomy mapping common signatures to likely causes:
    first-token divergence, layer-zero divergence, gradual drift, only cached
    decode drift, only high-token-ID drift, only Unicode drift, SIMD-only drift,
    browser-only drift, and sampler-only drift.
14. Define independent review and anti-cheat controls: committed cases before
    output, no easy-seed selection, no skipped failed layers, no post-hoc
    tolerance inflation, immutable raw traces, and a separate untouched quality
    suite.
15. Give a staged execution plan from tiny public synthetic tensors through
    selected real-source traces, full native generation, real Chromium WASM,
    and multi-turn browser chat. State objective exit criteria at every stage.

Required report structure:

1. Executive oracle recommendation.
2. Immutable public-source observation log.
3. Reproducible offline environment lock.
4. Publisher-exact tokenization and chat semantics.
5. Oracle tiers and their claim boundaries.
6. Trace-point matrix with tensor shapes.
7. First-divergence algorithm.
8. Numerical metrics and threshold derivation.
9. Prefill, decode, cache, and sampling corpus.
10. Cross-runtime comparison lattice.
11. Failure-signature diagnostic table.
12. Evidence schema and contamination controls.
13. Staged implementation and execution plan.
14. Objective acceptance criteria and prohibited claims.
15. Unknowns requiring private artifacts or hardware.
16. Annotated primary-source bibliography with dates and immutable links.

Do not use a moving default branch, remote model code without review, GPU
results as a CPU oracle, final-text-only comparison, a single prompt, one
selected seed, repaired outputs, hidden tolerance changes, or quality prompts
as quantization calibration. Do not claim numerical parity from structural
validation.

## Prompt 6: Native Rust Qwen3 Runtime Correctness, SIMD, And Deterministic Decode

You are an independent principal Rust inference-runtime engineer, CPU kernel
specialist, and transformer implementation auditor. Produce an exceptionally
detailed design for a single production-quality Rust execution path for a
mixed-Q8 Qwen3-0.6B composition, from strict model admission through prefill,
cached decode, seeded sampling, cancellation, and resource teardown. Target
8,000 to 15,000 words excluding the bibliography.

You may browse official Qwen and Transformers code, Rust documentation,
WebAssembly and CPU ISA specifications, peer-reviewed inference papers, and
public runtime implementations. You have no access to TinyRustLM source,
private SLM2 contracts, generated artifacts, tests, benchmarks, machines,
receipts, or credentials. Do not claim private validation and do not invent
private ABI or format fields.

Project-supplied facts and constraints, to be labeled as unverified project
facts:

- TinyRustLM is one prelaunch browser-local product. It permits one canonical
  runtime only: no old/new split, compatibility reader, model migration,
  alternate fallback engine, hidden dense-F32 model copy, runtime repacking,
  output repair, or accepted code debt.
- The immediate architecture is Qwen3-0.6B: vocabulary 151,936, context 40,960,
  hidden size 1,024, intermediate size 3,072, 28 layers, 16 query heads, 8 KV
  heads, head dimension 128, Q/K normalization, tied embeddings, no QKV bias,
  SwiGLU-family MLP, RoPE, and RMSNorm.
- Major matrices and embedding bytes are stored in a canonical mixed-Q8
  representation and must execute directly. Numerically sensitive tensors and
  runtime state may use specified floating representations.
- Model admission occurs through a complete six-artifact composition whose
  model, tokenizer, template, sampling, prompt, and graph identities have
  already passed a separate strict structural verifier.
- The native runtime must become the numerical reference implementation for
  browser WASM after comparison with an independently pinned source-framework
  oracle. Scalar code must remain a correctness oracle for accelerated kernels,
  not a hidden alternate product path.
- Raw generated tokens and text are preserved exactly. Cancellation must not
  produce a successful completion or allow stale output into a later request.
- No real runtime result or performance measurement is supplied.
  MemoryEndpoints is unauthorized and out of scope.

Research exact Qwen3 equations and current public implementation details,
Rust numerical behavior, CPU SIMD instruction sets, threading libraries,
determinism controls, allocator behavior, memory mapping, cancellation design,
and bounded inference APIs. Distinguish mathematical requirements from one
public implementation's incidental layout.

Address all of the following in depth:

1. Write the exact forward equations and operation order for embedding,
   pre-attention RMSNorm, Q/K/V projection, Q/K normalization, RoPE, grouped
   query attention, causal masking, softmax, O projection, residual update,
   post-attention RMSNorm, SwiGLU gate/up/down path, final norm, and tied output
   projection. State tensor shapes at every boundary.
2. Derive query-head to KV-head mapping for 16/8 GQA, including vectorized
   layouts and tests that distinguish a correct map from accidental contiguous
   or modulo errors.
3. Specify RoPE implementation from float-bit constants through position
   indexing, frequency computation, pair layout, precision, range, and cached
   tables. Analyze long-context numerical drift and deterministic table
   generation.
4. Define Q/K normalization precisely: axes, epsilon, scale tensors, placement
   before/after RoPE as established by primary source, accumulation precision,
   and tests isolating each possible ordering error.
5. Design strict runtime admission from parsed semantic metadata. Reject wrong
   dimensions, tensor roles, dtypes, quantization metadata, tied-weight
   identity, context limits, unsupported flags, resource plans, and unknown
   architecture profiles before allocating large runtime state.
6. Specify memory ownership for mapped/read-only model bytes, parsed tensor
   views, scale arrays, scratch buffers, hidden/residual vectors, attention
   workspace, logits, tokenizer/template state, and KV cache. Include checked
   size formulas and allocation-failure behavior.
7. Define scalar mixed-Q8 matrix-vector and embedding kernels as normative
   correctness oracles. Include row orientation, scale application,
   accumulation type, tails, bounds, and exact error behavior.
8. Design x86-64 and ARM64 SIMD dispatch without changing the stored model
   representation. Cover runtime feature detection, deterministic fallback to
   the scalar oracle, alignment, unaligned loads, tails, cache blocking,
   threading thresholds, and parity tests.
9. Define prefill and one-token decode APIs, state transitions, and ownership.
   Include empty prompts, maximum prompt length, prompt plus output accounting,
   partial prefill, cancellation points, and prohibition on committing partial
   cache state as a successful turn.
10. Design KV cache indexing, layout, capacity, append, rollback, reset, and
    context-bound enforcement. Include multi-turn reuse and exact invalidation
    when model, template, sampling, prompt, system instruction, or conversation
    prefix changes.
11. Specify numerically stable attention and softmax for long contexts. Cover
    max subtraction, accumulation, mask representation, NaN/Inf detection,
    zero-length cases, chunking, and optional online softmax only if it can be
    proven equivalent within preregistered bounds.
12. Define deterministic Sampling2 integration: logits ownership, repetition
    history, penalty operation order, top-k/top-p ties, temperature, random
    stream, stop IDs, max tokens, and exact terminal reason. Separate sampler
    conformance from model numerical tolerance.
13. Design cooperative cancellation and hard containment. State where atomic
    cancellation is polled, how stale callbacks/tokens are rejected, how worker
    or thread teardown clears keys and model state where required, and how an
    interrupted request differs from model failure.
14. Provide performance formulas and a measurement protocol for load, first
    token, prefill tokens/second, decode tokens/second, peak RSS, committed
    memory, page faults, cache misses, CPU utilization, and energy where
    available. Do not invent target numbers.
15. Build a test matrix from tiny synthetic tensors through full real-model
    source-oracle parity, scalar/SIMD differential tests, cache/no-cache
    equivalence, cancellation races, corruption, out-of-memory, thread-count
    variation, Windows x64, Linux x64, and real Linux ARM64 execution.
16. Recommend Rust crate/module boundaries, unsafe-code policy, invariants at
    every unsafe block, fuzz targets, sanitizer/Miri applicability, and how to
    delete superseded paths in the same prelaunch cutover.

Required report structure:

1. Executive architecture recommendation.
2. Public Qwen3 semantic observation log.
3. Exact forward equations and shape table.
4. Strict admission and memory ownership.
5. Scalar normative kernels.
6. Native SIMD and dispatch design.
7. Prefill/decode/KV-cache state machine.
8. Attention, softmax, and long-context numerics.
9. Sampling and deterministic output ownership.
10. Cancellation, error, and teardown semantics.
11. Resource formulas and benchmark protocol.
12. Differential, adversarial, fuzz, and cross-platform matrix.
13. Rust module and unsafe-code design.
14. Objective native-runtime acceptance criteria.
15. Claims that remain unproven.
16. Unknowns requiring private format contracts or model execution.
17. Annotated primary-source bibliography with dates and immutable links.

Do not recommend a second inference engine, persistent dequantized weights,
runtime format conversion, approximate tensor-role guessing, output repair,
best-of-N, swallowed cancellation, synthetic-only acceptance, cross-compilation
as real ARM64 execution, or benchmark claims without measured local evidence.

## Prompt 7: Real-Model Browser WASM Memory, Worker Isolation, And Admission Control

You are an independent principal browser-runtime architect, WebAssembly
systems engineer, and client-side storage/reliability specialist. Produce an
exceptionally detailed report designing a browser execution architecture for a
real mixed-Q8 Qwen3-0.6B composition under honest browser memory, storage,
threading, cancellation, and privacy constraints. Target 8,000 to 15,000 words
excluding the bibliography.

You may browse current W3C/WICG specifications, MDN where it accurately links
normative material, Chromium/Firefox/WebKit documentation and source, Rust and
WebAssembly documentation, Playwright documentation, browser storage papers,
and public inference implementations. You have no access to TinyRustLM source,
WASM binaries, model artifacts, browser profiles, tests, traces, machines,
credentials, or private services. Do not claim private validation. Browser
behavior changes over time, so record browser versions, document dates, and
retrieval date, and distinguish standards from implementation observations.

Project-supplied facts and constraints, to be labeled as unverified project
facts:

- TinyRustLM is one prelaunch browser-local chat product. There is no legacy
  browser runtime, compatibility loader, fallback server inference, fallback
  JavaScript model engine, hidden repacking path, output repair, or accepted
  debt. Superseded prelaunch paths may be deleted outright.
- Prompts and model tensors must not be uploaded to TinyRustLM project sites.
  Model bytes arrive only from local conversion/import or consenting direct
  P2P transfer. Public sites may serve static application and WASM assets but
  not model artifacts.
- The first complete composition contains a mixed-Q8 Qwen3-0.6B SLM2 model,
  Tokenizer2, Template2, Sampling2, Prompt2, and ACG2. The public dense source
  closure is 1,519,207,688 bytes; generated model bytes must remain below a
  declared 2,147,483,648-byte model ceiling, but the actual output size is not
  supplied.
- Architecture values are vocabulary 151,936, context 40,960, hidden size
  1,024, intermediate size 3,072, 28 layers, 16 query heads, 8 KV heads, and
  head dimension 128. A full advertised context must not be assumed usable in
  a browser unless resource evidence supports it.
- The WASM runtime should execute canonical stored mixed-Q8 bytes directly,
  without a persistent dense-F32 copy or hidden on-load repacking format.
- Tokenizer2, Template2, Sampling2, and Prompt2 have separate immutable
  conformance identities. Browser inference must compose them exactly rather
  than substituting convenient JavaScript behavior.
- Generation runs in a dedicated Worker. Cancellation must stop computation,
  prevent stale messages, release recoverable memory, and never convert partial
  output into a successful answer.
- Real Chromium execution is required for browser proof. Firefox and WebKit
  must be reported truthfully as tested, unsupported, blocked, or unknown; they
  may not be simulated.
- No accepted real-model browser run or benchmark is supplied.
  MemoryEndpoints is unauthorized and disconnected.

Research current browser limits and behavior for `wasm32-unknown-unknown`,
memory32 and memory64 status, `WebAssembly.Memory`, growth, typed-array
detachment, maximum ArrayBuffer lengths, WASM SIMD, threads, atomics,
SharedArrayBuffer, COOP/COEP, cross-origin isolation, CSP, Permissions Policy,
Workers, transferable objects, structured cloning, OPFS, IndexedDB, File
System Access, StorageManager persistence/estimate, eviction, service workers,
Cache Storage, browser process architecture, and current local-network-access
policy. Use primary sources wherever possible.

Address all of the following in depth:

1. Build a browser capability matrix for current stable Chromium, Edge,
   Firefox, and WebKit/Safari on desktop and mobile. Cover WASM SIMD, threads,
   memory ceilings, OPFS, sync access handles in Workers, persistent storage,
   large Blob/File support, cross-origin isolation, and known platform limits.
2. Derive complete memory formulas for model bytes, scale metadata, parsed
   tables, WASM linear memory, JavaScript/ArrayBuffer copies, transfer buffers,
   tokenizer/template/sampler, logits, scratch space, activations, KV cache,
   worker bootstrap, browser overhead, and storage verification. Show peak,
   steady-state, and cancellation states.
3. Compare architecture choices: copy whole model into linear memory, memory
   map-like paging via OPFS, chunked reads into fixed scratch buffers, segmented
   WASM memories where available, and preallocated versus growable memory.
   State current feasibility and semantic/performance tradeoffs.
4. Design a zero-copy or minimum-copy admission pipeline from verified browser
   storage to WASM tensor views. Explain what browsers actually permit, when a
   copy is unavoidable, how ownership moves through transferable buffers, and
   how to prove no accidental second full model copy exists.
5. Specify crash-consistent storage for six composition members. Compare OPFS
   and IndexedDB, staging and activation namespaces, create-only identities,
   streaming SHA-256, quota checks, eviction, interrupted writes, browser crash,
   profile deletion, and atomic graph activation.
6. Define an admission controller that computes a safe operational context
   before model activation. Inputs should include device memory where reliable,
   actual storage estimate, measured allocation probes where safe, model size,
   KV representation, thread count, and explicit reserve. Explain why weak or
   privacy-reduced browser hints cannot be trusted alone.
7. Design a dedicated Worker protocol with explicit states for unloaded,
   admitting, loading, ready, prefilling, decoding, cancelling, cancelled,
   failed, and terminated. Bind every message to model/composition identity,
   worker generation, conversation request, and monotonically increasing
   operation sequence.
8. Specify hard cancellation. Compare cooperative atomic flags, Worker
   termination, fresh-worker replacement, WASM trap/exception containment, and
   browser process crash. Define when model reload is mandatory and how stale
   queued messages are rejected.
9. Analyze WASM threading. Include shared memory requirements, cross-origin
   isolation headers, CSP, deployment implications, work partitioning,
   deterministic reductions, thread startup cost, mobile constraints, and a
   credible single-thread baseline.
10. Define scalar-versus-SIMD and native-versus-WASM numerical parity tests,
    with first-divergence trace points, feature-disabled runs, unaligned/tail
    cases, deterministic sampling, and no final-text-only shortcut.
11. Specify privacy and network assertions. Enumerate allowed static asset,
    catalog, direct peer, and numeric-loopback traffic; reject prompt uploads,
    hosted model-byte fallback, telemetry, credential-bearing URLs, and
    unexpected third parties. Explain DevTools/Playwright coverage limits.
12. Design browser lifecycle tests using fresh owned persistent profiles,
    process closure, profile deletion, proof of deletion, second-profile
    independence, storage scans, service-worker checks, and no reuse disguised
    as restart.
13. Provide failure injection for quota exhaustion, eviction, partial member,
    corrupt chunk, hash mismatch, detached buffer, memory growth failure, WASM
    trap, Worker crash, cancellation race, stale worker event, browser crash,
    stale service worker, absent SIMD, absent isolation, mobile backgrounding,
    and OS memory pressure.
14. Define objective performance measurement: app/WASM load, composition
    admission, model load, prefill, first token, decode rate, peak browser RSS,
    linear-memory high-water mark, storage reads, main-thread blocking, and
    teardown. Require raw measurement evidence rather than invented targets.
15. Give a staged implementation plan from deterministic tiny fixtures to one
    real model in a physical Chromium profile, then constrained device classes.
    State exactly which result permits a narrow browser-inference claim.

Required report structure:

1. Executive feasibility conclusion.
2. Dated standards and browser-observation matrix.
3. Complete memory and storage budget model.
4. Model-byte access architecture comparison.
5. Crash-consistent six-artifact browser store.
6. Resource admission algorithm.
7. Worker protocol and cancellation state machine.
8. SIMD/threads deployment and determinism plan.
9. Numerical parity and first-divergence tests.
10. Network and privacy contract.
11. Fresh-profile lifecycle and deletion proof.
12. Failure-injection matrix.
13. Performance measurement protocol.
14. Staged implementation and acceptance gates.
15. Unsupported/blocked/unknown browser classifications.
16. Unknowns requiring real artifacts, devices, or browser execution.
17. Annotated primary-source bibliography with dates.

Do not recommend server inference fallback, whole-model JavaScript duplication,
hidden repacking, localStorage as the model store, page reload as a clean
restart, browser-name assumptions without versioned evidence, mobile support
from desktop emulation, or success from a tiny fixture. Do not claim a 40,960
token operational context merely because it appears in source configuration.

## Prompt 8: KV-Cache Compression, TurboQuant/TurboVec Lessons, Colibri, And Specialists

You are an independent principal efficient-inference researcher, adaptive
computation architect, and small-model portfolio scientist. Produce an
exceptionally detailed report evaluating how KV-cache quantization,
TurboQuant/TurboVec-like techniques, Colibri-related methods, layer or module
reuse, and tiny task specialists could improve TinyRustLM memory, speed, and
accuracy without corrupting the first complete general model or inventing
compatibility debt. Target 8,000 to 15,000 words excluding the bibliography.

You may browse current peer-reviewed papers, official project repositories,
immutable model cards, conference proceedings, and official framework
documentation. You have no access to TinyRustLM source, model artifacts,
training data, private evaluation cases, benchmarks, receipts, machines, or
credentials. Do not claim private validation. Because names such as Colibri,
TurboQuant, and TurboVec may refer to more than one public project, first
identify the exact relevant works, authors, repositories, dates, licenses, and
immutable revisions. Do not conflate similarly named systems.

Project-supplied facts and constraints, to be labeled as unverified project
facts:

- TinyRustLM is one prelaunch browser-local chat product. It has no legacy
  users and no permission for compatibility loaders, parallel old/new model
  paths, fallback inference, hidden format conversion, unbounded routing
  complexity, or known debt.
- The immediate full-model ancestor is Qwen3-0.6B revision
  `c1899de289a04d12100db370d81485cdf75e47ca`: 28 layers, hidden size 1,024,
  16 query heads, 8 KV heads, head dimension 128, context configuration 40,960,
  GQA, Q/K normalization, and tied embeddings.
- The intended first complete local composition uses mixed-Q8 major weights
  and one exact tokenizer/template/sampler/prompt graph. It must be delivered
  and validated as a full general-model vertical slice before optional
  specialist routing can make a product claim.
- The product goal may later include one streamlined general champion plus
  several much smaller genuinely specialized `.slm` compositions when this
  improves accuracy or latency. Relabeled bytes, arbitrary partial files, and
  specialists that only memorize evaluation phrases do not count.
- A model composition must remain independently content-addressed,
  provenance-bound, licensed, structurally verified, numerically checked, and
  quality-qualified. Shared immutable components may be deduplicated by
  identity; silent dependencies on missing base tensors are prohibited.
- Browser constraints make KV-cache growth material. For standard full
  attention, derive memory rather than assuming the configured maximum context
  is operationally available.
- TurboQuant/TurboVec and Colibri are research leads, not adopted dependencies.
  No current performance or quality result is supplied.
- MemoryEndpoints is unauthorized and disconnected and must not be used as a
  routing or memory shortcut.

Research primary sources on KV-cache quantization and compression, KIVI,
KVQuant, H2O/heavy-hitter eviction, streaming or sliding-window attention,
grouped-query attention, paged attention, prefix caching, low-rank cache
methods, activation rotations, TurboQuant/TurboVec, adaptive depth/early exit,
layer skipping, mixture-of-experts, model merging, LoRA/adapters, prompt or
task routers, modular language models, and the exact relevant Colibri work.
Distinguish methods compatible with an already trained dense Qwen3 checkpoint
from methods requiring retraining or architecture-specific pretraining.

Address all of the following in depth:

1. Derive exact baseline KV-cache memory per token and at representative
   context lengths for 28 layers, K and V, 8 KV heads, and head dimension 128
   under F32, BF16/F16, signed Q8 plus scales, Q4 plus scales, and any proposed
   compressed representation. Include alignment, metadata, allocator, and
   paging overhead rather than counting payload only.
2. Explain the numerical and semantic role of cached K and V. Analyze why
   quantization error accumulates differently from weight error and how Q/K
   normalization affects range and scheme selection.
3. Compare per-token, per-head, per-channel, grouped, residual, outlier-aware,
   asymmetric, and rotation-based KV quantization. Cover online conversion
   cost, dequantization kernels, scale storage, SIMD/WASM portability, long-
   context error, and calibration requirements.
4. Determine which TurboQuant/TurboVec ideas can credibly apply to weights,
   activations, or KV cache for this architecture. Detail required transforms,
   metadata, kernels, calibration/retraining, and expected overhead as formulas.
   Give falsifiable experiments rather than adoption claims.
5. Identify and analyze the exact relevant Colibri method or methods. Explain
   whether each is about adaptive computation, representation reuse, modular
   models, retrieval, speculative execution, or another mechanism, and whether
   it can legally and technically compose with Qwen3-0.6B.
6. Analyze cache eviction, sliding windows, sink tokens, heavy hitters, and
   summarization. State which preserve exact full-attention semantics, which
   approximate them, and which would require retraining. Do not quietly call an
   approximate context a full 40,960-token context.
7. Design cache invalidation for multi-turn chat when the model, composition,
   system prompt, template, tokenizer, sampling profile, conversation prefix,
   memory projection, or current-user preference changes. Include longest-
   common-prefix reuse and proofs against stale or cross-conversation cache.
8. Compare one full champion plus specialists implemented as complete small
   models, LoRA/adapters over one base, shared embeddings plus specialized
   layers, early-exit heads, layer subsets, or modular experts. Quantify stored
   bytes, runtime dependencies, activation/KV duplication, routing cost,
   conversion complexity, and failure isolation.
9. Define what a "smaller part of a full model" can truthfully mean. Explain why
   arbitrary layer extraction usually does not yield a standalone model, when
   distillation or structured pruning is required, and how a composition graph
   must declare shared immutable dependencies.
10. Design a router that uses explicit task evidence without uploading prompts,
    leaking private text, or silently changing models mid-answer. Compare user
    choice, deterministic local classifiers, confidence gating, cascade
    routing, and general-model fallback. Include route receipts and error
    handling.
11. Specify a contamination-safe training and evaluation program for tiny
    specialists. Require unseen paraphrases, generalization tests, negative
    transfer checks, ordinary-helpfulness preservation, and no use of private
    holdout prompts or expected answer phrases.
12. Define portfolio admission rules. Distinct bytes are necessary but not
    sufficient; require distinct validated capability, ancestry, license,
    source/training receipts, runtime compatibility, and clear user value.
    Identify catalog theater.
13. Provide benchmark and quality protocols for baseline F16/F32 cache,
    compressed cache, champion-only, routed specialist, and mistaken-route
    cases. Include repeated fixed seeds, confidence intervals, long-context
    cases, and browser peak-memory evidence.
14. Define a staged decision tree: techniques safe for the first model now,
    experiments to run after parity, methods requiring retraining, and methods
    to reject. Include stop rules and rollback through clean replacement rather
    than legacy coexistence.
15. Recommend metadata and graph identities for optional shared components,
    cache representation, specialist ancestry, router version, and quality
    scope without designing a compatibility layer.

Required report structure:

1. Executive recommendation and terminology disambiguation.
2. Dated primary-source matrix for TurboQuant, TurboVec, Colibri, and KV work.
3. Exact baseline KV-cache formulas.
4. KV quantization/compression comparison.
5. Semantic-preservation and long-context analysis.
6. Applicability to Qwen3-0.6B and browser WASM.
7. Multi-turn cache lifecycle and invalidation state machine.
8. Champion-plus-specialist architecture comparison.
9. Honest meaning of partial/shared models.
10. Local routing design and privacy threat model.
11. Specialist training, contamination, and quality protocol.
12. Portfolio identity and admission rules.
13. Experimental matrix, statistics, and stop rules.
14. Staged implementation recommendations.
15. Unknowns requiring local training, artifacts, or browser measurement.
16. Annotated primary-source bibliography with dates and immutable links.

Do not claim arbitrary extracted layers form a useful model, count relabeled or
precision-only copies as distinct capabilities, assume Q4/Q2/1-bit cache is
acceptable without quality evidence, use hidden server routing, train on
evaluation answers, or preserve two competing prelaunch architectures. Do not
recommend an approximate attention method while labeling it exact full-context
execution.

## Prompt 9: P2P-First Or Local-Convert Acquisition Without Script Or Text Downloads

You are an independent principal peer-to-peer product architect, secure local
companion engineer, and browser workflow reliability specialist. Produce an
exceptionally detailed report designing a user flow in which choosing a model
either acquires a fully verified composition directly from consenting peers or
starts an explicit local conversion when no qualified peer source exists. The
user must receive a working local model operation, not a downloaded text file,
PowerShell script, shell command, JSON request, or instructions masquerading as
the feature. Target 8,000 to 15,000 words excluding the bibliography.

You may browse current browser standards, P2P protocol literature, HTTP
specifications, local-network-access policy, service-host documentation,
content-addressed storage designs, package distribution standards, and public
security guidance. You have no access to TinyRustLM source, MiniModel private
services, companion binaries, peer endpoints, model artifacts, receipts,
browser profiles, credentials, or production infrastructure. Do not invent
private routes or claim live validation.

Project-supplied facts and constraints, to be labeled as unverified project
facts:

- TinyRustLM.com is a browser-local AI chat interface. MiniModel.org is intended
  to provide public catalog and direct-P2P discovery metadata; it must not proxy
  or host model bytes. Model bytes flow only from local files/conversion or
  consenting direct peers.
- TinyRustLM is one prelaunch product. There is no legacy download workflow to
  preserve. Script/text download behavior may be deleted rather than wrapped.
  No compatibility path, fallback server inference, hosted-model fallback,
  response repair, fake progress, or known debt is allowed.
- A downloadable local Rust/.NET companion is the operational host for source
  acquisition, conversion, piece serving, and bounded transfer. The browser
  remains the chat interface.
- Browser-to-companion communication uses an explicit user-presence pairing
  ceremony and memory-only least-privilege capability over a numeric IPv4
  loopback endpoint chosen by the operating system. No fixed unsafe port,
  durable browser secret, broad filesystem API, shell execution API, proxy, or
  arbitrary URL fetch is allowed.
- A usable model is a complete six-artifact composition: SLM2, Tokenizer2,
  Template2, Sampling2, Prompt2, and ACG2. Admission binds exact composition and
  member identities. A tiny fixture, alias, partial model, or differently
  named duplicate does not count.
- The first source is Qwen3-0.6B at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca`; its reviewed source closure is
  about 1.52 GB. Conversion must require explicit informed consent, disk and
  resource admission, immutable source verification, and preserved terminal
  evidence.
- P2P acquisition is preferred only when a peer advertises the exact qualified
  composition. Otherwise the product may offer reviewed local conversion. A
  missing peer is not an error and must not trigger an opaque or automatic
  multi-gigabyte action.
- Browser prompts must never be sent to TinyRustLM or MiniModel project sites.
  MemoryEndpoints is unauthorized and disconnected.
- No live peer, catalog, outside reachability, or complete browser acquisition
  evidence is supplied.

Research primary sources for browser-to-loopback policy, CORS and private/local
network access, secure local capabilities, HTTP range/streaming, BLAKE3 and
SHA-256 tradeoffs, fixed-piece content transfer, BitTorrent/IPFS lessons without
assuming those protocols, resumable downloads, Byzantine peers, catalog
signatures, NAT status, browser storage, background cancellation, and
installer/service UX on Windows and Linux.

Address all of the following in depth:

1. Define identities for catalog model, qualified composition, six members,
   piece set, peer advertisement, peer endpoint, companion installation,
   pairing session, acquisition operation, local conversion operation,
   browser-store activation, and final user-visible model. Separate public
   identity from private local path.
2. Design the user decision flow from catalog selection through exact local
   presence check, qualified peer discovery, P2P consent, conversion consent,
   resource estimate, operation start, progress, cancellation, verification,
   activation, and chat readiness. Use truthful statuses and no downloaded
   instruction artifact.
3. Specify catalog metadata sufficient to decide whether a peer offers the
   exact composition: member hashes/sizes, graph identity, quality scope,
   provenance/license, runtime requirements, piece parameters, endpoint proof
   status, expiry, and signatures. Explain what remains untrusted until local
   verification.
4. Design fixed-piece transfer from one or multiple peers. Require complete
   artifact and piece-set identity agreement before mixing pieces, bounded
   concurrency, per-piece hash verification, peer penalties, retry budgets,
   corruption quarantine, resume journal, final whole-member hashes, and atomic
   composition promotion.
5. Analyze direct browser-to-peer versus companion-mediated P2P. Cover CORS,
   TLS/certificates, NAT, browser mixed-content and local-network policy,
   filesystem/storage, bandwidth control, attack surface, and why one design is
   appropriate for the first release.
6. Define the companion's least-privilege operation API. Permit only fixed
   catalog lookup inputs, exact composition acquisition, reviewed immutable
   source acquisition, conversion, progress, cancellation, and bounded member
   streaming. Reject arbitrary files, URLs, commands, proxying, directory
   enumeration, and secret-bearing query parameters.
7. Specify exactly-once operation semantics across browser retries, lost
   responses, companion restarts, page reload, cancellation, and reconnect.
   Include idempotency identities, journal states, response proof, immutable
   terminal history, and explicit creation of a new operation after failure.
8. Design local conversion fallback. Include immutable source review, source
   size and license display, disk/RAM/time formulas, explicit consent, no
   automatic retry, source-lock verification, one-shot conversion, terminal
   reconciliation, and independent six-artifact verification.
9. Define browser transfer and activation after either path. Include streaming
   from companion, authenticated metadata and chunks, backpressure, cancellation,
   resume, browser-side whole-member hashing, crash-consistent staging, and one
   atomic graph activation.
10. Provide network allow/deny rules for public site assets, catalog metadata,
    peer discovery, direct model pieces, numeric loopback, and all unexpected
    traffic. Fail on project-hosted model bytes, prompt upload, telemetry,
    credential URLs, redirect expansion, DNS rebinding, or arbitrary third
    parties.
11. Design security against malicious catalog entries, stale signatures,
    endpoint substitution, piece poisoning, cross-model piece mixing, zip-slip
    or path traversal, symlink/reparse attacks, range abuse, slowloris peers,
    oversized metadata, replayed operation messages, and hostile local pages.
12. Define progress semantics based on verified bytes and durable phases rather
    than animation or optimistic percentages. Include unknown totals, peer loss,
    conversion phases, verification, activation, cancellation, and actionable
    errors without leaking paths.
13. Specify accessibility and responsive UX for selection, consent, long model
    names, source/license review, storage estimates, progress, cancellation,
    restart/reconnect, and final ready state. Do not turn operational content
    into a marketing landing page.
14. Provide a test matrix from deterministic fixtures through one real model,
    deliberate peer corruption/loss, no-peer conversion, companion restart,
    fresh-profile browser activation, and genuinely outside-network proof.
    Separate CI, LAN, NAT hairpin, and outside evidence.
15. Define objective acceptance criteria for "P2P acquired," "locally
    converted," "browser activated," and "ready for chat" as distinct claims.

Required report structure:

1. Executive product and protocol recommendation.
2. Public standards and implementation observation log.
3. Identity and trust model.
4. End-user state machine and wireframe-level behavior.
5. Catalog and peer-advertisement schema.
6. Fixed-piece transfer and multi-peer recovery.
7. Companion capability and operation API.
8. Exactly-once journal and restart semantics.
9. Local conversion fallback transaction.
10. Browser streaming store and activation.
11. Network allowlist and threat model.
12. Progress, error, accessibility, and responsive UX.
13. Fault-injection and evidence matrix.
14. Objective claim taxonomy and acceptance checklist.
15. Prioritized implementation sequence.
16. Unknowns requiring private contracts or authorized external infrastructure.
17. Annotated primary-source bibliography with dates.

Do not recommend downloading a script/text/request file as the primary action,
hosting model bytes on project sites, server inference fallback, broad local
filesystem or shell APIs, automatic multi-gigabyte conversion, mutable terminal
history, local health as public reachability, or activation before complete
local verification.

## Prompt 10: Untouched Multi-Turn Browser Chat Semantics And Exactly-Once Rendering

You are an independent principal conversational-runtime engineer, browser state
machine architect, and AI interaction reliability researcher. Produce an
exceptionally detailed report specifying how a locally executing Qwen3
composition becomes one correct, untouched, multi-turn browser conversation
with exact token/template/sampling semantics, deterministic ownership,
cancellation, and one authoritative rendering of each assistant answer. Target
8,000 to 15,000 words excluding the bibliography.

You may browse official Qwen and Transformers documentation/source, browser
standards, Web Worker and Streams specifications, accessibility standards,
Playwright documentation, and public chat-runtime implementations. You have no
access to TinyRustLM source, local model artifacts, browser builds, test output,
screenshots, traces, private prompts, credentials, or MemoryEndpoints. Do not
claim private validation or invent internal UI selectors and APIs. Prefer
primary sources, pin public repository observations to immutable revisions,
and record source dates and your retrieval date.

Project-supplied facts and constraints, to be labeled as unverified project
facts:

- TinyRustLM is one prelaunch browser-local chat product. There is no legacy
  chat path, compatibility state, fallback server generation, response repair,
  automatic retry, best-of-N selection, simulated model text, or permission to
  keep duplicate event/rendering paths.
- Prompts, conversation text, and model tensors must not be sent to TinyRustLM
  project websites. Model generation runs locally in browser WASM after a
  complete six-artifact composition is verified and activated.
- The composition contains Qwen3 mixed-Q8 SLM2, Tokenizer2, Template2,
  Sampling2, Prompt2, and ACG2. Each component has an exact identity and must
  be used as a unit. Convenient JavaScript tokenization, template substitution,
  or sampling behavior is not an acceptable fallback.
- The public ancestor is Qwen3-0.6B revision
  `c1899de289a04d12100db370d81485cdf75e47ca`, with a configured context of
  40,960 tokens. The operational browser limit must be resource-derived and
  may be lower; the UI must report truthfully.
- Introductory prompt cards disappear after the first chat starts, the center
  column becomes the conversation workspace, the composer remains usable, and
  every assistant answer appears exactly once. Functional work must preserve
  the approved visual language rather than casually redesigning the site.
- Generation occurs in a dedicated Worker. Every request and event must bind
  one worker generation, composition identity, conversation identity, turn
  identity, and operation sequence. Stale events cannot mutate a newer turn.
- Raw token IDs, raw decoded output, stop reason, errors, and cancellation must
  be preserved for private evidence. Text may not be silently completed,
  edited, retried, or selected after generation.
- Important behavior includes ordinary conversation, ambiguity handling,
  practical constraints, conflicting sources, latest-user-preference
  precedence, multi-turn references, quoted/untrusted instructions, summaries,
  rewrites, structured output, and code explanation. MemoryEndpoints is
  unauthorized, so hosted-memory success may not be simulated.
- No accepted real-model browser conversation is supplied.

Research publisher-exact Qwen3 chat-template and generation behavior, text
stream decoding, Unicode incremental decoding, stop-token handling, browser
Worker/MessagePort ordering, Streams backpressure, AbortController limits,
accessibility live regions, focus management, scroll anchoring, reduced motion,
and reliable browser automation. Separate protocol-level ordering from
framework convenience behavior.

Address all of the following in depth:

1. Define immutable and runtime identities for composition, model load,
   worker generation, browser profile, conversation, message, turn, generation
   operation, prompt bytes, prompt token IDs, random stream, output token,
   decoded segment, final answer, stop reason, and evidence record.
2. Specify a single conversation state machine covering no model, model
   admitting, ready, prompt building, tokenizing, prefilling, decoding,
   cancelling, cancelled, completed, failed, worker terminated, and model
   replaced. List allowed and forbidden transitions.
3. Reconstruct publisher-exact multi-turn Qwen3 template semantics from public
   sources. Cover system instruction, user/assistant roles, thinking-enabled
   versus disabled behavior, generation prompt, assistant boundary, special
   tokens, empty content, Unicode, and stop IDs. Identify uncertainties.
4. Define Prompt2 plus Template2 plus Tokenizer2 integration. Specify ownership
   of context limits, role validation, special-token insertion, exact UTF-8,
   normalization policy, token count, truncation refusal or strategy, and proof
   that tokens sent to the model equal the rendered conversation state.
5. Design deterministic multi-turn state. Include immutable prior messages,
   current user turn, assistant placeholder, latest-user-preference precedence,
   stale profile or quoted data as untrusted content, and a complete prefix
   identity suitable for KV-cache reuse.
6. Specify generation event protocol from Worker to main thread. Events should
   include start, token, decoded bytes/text, progress, cancellation observed,
   terminal completion, and terminal error with monotonic sequence and exact
   operation identity. Define duplicate, gap, reordering, and stale-event
   handling.
7. Design incremental UTF-8/token decoding without replacement-character
   corruption, duplicate text, lost combining sequences, or final flush errors.
   Explain tokenizer-specific byte fallback and why concatenating independently
   decoded token strings can be wrong.
8. Define exactly-once rendering. Identify one authoritative message store and
   one projection to the DOM; prevent simultaneous optimistic, stream, final,
   retry, persistence, and framework hydration paths from appending the same
   answer. Include stable keys and idempotent event reduction.
9. Specify cancellation semantics at every phase. User cancellation must stop
   accepted future events, preserve partial raw output as cancelled evidence,
   avoid an assistant-success message, decide whether partial text remains
   visibly marked or is removed, invalidate partial cache, and leave the next
   turn clean.
10. Design model switch and Worker crash behavior. No conversation may silently
    continue under different model bytes or sampling identity. State which UI
    state survives, which runtime state is destroyed, and how the user receives
    an honest actionable status.
11. Define scroll and layout behavior for long output, rapid streaming, mobile
    keyboard, fixed composer, user scroll-away, return-to-bottom control, long
    model names, code blocks, JSON, and error messages. Prevent layout shifts
    and text overlap without embedding usage instructions in the UI.
12. Specify accessibility: keyboard order, focus after send/cancel/error,
    accessible names for icon controls, live-region batching that does not read
    every token, status semantics, high contrast, reduced motion, screen reader
    message boundaries, and mobile touch targets.
13. Design a private test corpus of two-to-six-turn conversations covering the
    supplied behavior classes without placing expected answers in runtime code.
    Include metamorphic changes, untrusted quoted instructions, current-turn
    overrides, cancellation, worker restart, and context pressure.
14. Define network/privacy assertions and evidence capture. No prompt or output
    may leave allowed local execution boundaries. Screenshots, traces, URLs,
    storage, logs, service workers, and network captures must be scanned before
    any public-safe report.
15. Provide a fresh-profile real-browser test plan at desktop, narrow desktop,
    and mobile widths. Require actual model output, exactly one assistant DOM
    message per successful turn, raw-output identity, no simulated text, no
    stale events, and profile deletion evidence.
16. Define objective acceptance for one untouched multi-turn browser-local chat
    and list all broader claims, including general quality and campaign credit,
    that require separate evidence.

Required report structure:

1. Executive conversation-ownership recommendation.
2. Public Qwen/browser observation log.
3. Identity model and authoritative state store.
4. Conversation and Worker state machines.
5. Exact template/tokenizer/prompt composition.
6. Multi-turn and KV-prefix semantics.
7. Streaming decode and event protocol.
8. Exactly-once rendering design.
9. Cancellation, crash, and model-switch behavior.
10. Responsive layout and accessibility assertions.
11. Behavioral, metamorphic, and fault test matrix.
12. Network/privacy and evidence-minimization contract.
13. Fresh-profile automation and acceptance receipt.
14. Objective claim boundary.
15. Prioritized implementation sequence.
16. Unknowns requiring private UI, model, or browser execution.
17. Annotated primary-source bibliography with dates.

Do not recommend simulated assistant text, post-generation repair, automatic
retry, best-of-N, a second renderer, token-string concatenation without proving
correctness, page reload as a clean restart, localStorage clearing as profile
deletion, hosted memory simulation, or success from a structurally valid model
that never generated in a physical browser.

## Prompt 11: No-Cheat First-Model Quality, Quantization Regression, And Rescue Decisions

You are an independent principal evaluation scientist, small-model
post-training researcher, and human-review methodology lead. Produce an
exceptionally detailed report defining an honest promotion gate for the first
real TinyRustLM composition and a contamination-safe decision tree if the
converted model is numerically correct but not useful enough. Target 8,000 to
15,000 words excluding the bibliography.

You may browse peer-reviewed evaluation and post-training research, official
model cards, immutable public repositories, standards, and official framework
documentation. You have no access to TinyRustLM source, private evaluation
prompts, raw candidate outputs, model artifacts, training data, receipts,
hardware, credentials, or internal reviewers. Do not request private holdouts
and do not claim private model inspection or testing.

Project-supplied facts and constraints, to be labeled as unverified project
facts:

- TinyRustLM is one prelaunch browser-local product. There is no legacy quality
  threshold, compatibility model, fallback server model, response repair,
  automatic retry, best-of-N, expected-term injection, or permission to weaken
  a gate after seeing results.
- The immediate public ancestor is Qwen3-0.6B at immutable revision
  `c1899de289a04d12100db370d81485cdf75e47ca`. The unchanged base has already
  been rejected as a product model. It remains useful only for conversion and
  runtime parity and as ancestry for a future derivative.
- A converted candidate is a complete content-addressed composition containing
  mixed-Q8 SLM2 plus exact tokenizer, template, sampling, prompt, and graph
  artifacts. Structural success and numerical parity are prerequisites but are
  not conversational quality.
- Important quality dimensions are ordinary conversational coherence,
  common-sense judgment, ambiguity handling, feasible practical planning,
  source-conflict handling, current-user-preference precedence, multi-turn
  continuity, untrusted quoted or retrieved content, summarization, rewriting,
  structured output, extraction, code explanation, factual restraint, and
  substantive treatment of lawful adult requests under narrow concrete-harm
  boundaries. Arithmetic is secondary and may be delegated to a deterministic
  calculator.
- Raw outputs must be retained exactly. No answer completion, repair, hand
  editing, hidden retry, selected seed, or training on failed holdouts is
  allowed. Positive helpful examples should substantially outnumber refusals
  in any training curriculum.
- Private fixed cases are supplemented by seeded sealed holdouts and unseen
  paraphrases. Neither prompts nor expected answer terms may enter training.
- Model bytes remain local/P2P. MemoryEndpoints is unauthorized and cannot be
  used for live continuity in this task.
- No quality result, training authorization, compute budget, or candidate
  output is supplied. Campaign counters remain zero.

Research primary sources on small-model evaluation, semantic invariants,
metamorphic testing, judge-model calibration, human rating, inter-rater
agreement, confidence intervals, multiple comparisons, contamination detection,
SFT, LoRA/DoRA, distillation, preference optimization, preservation loss, and
quantization evaluation. Prefer sources that expose methodology and limitations
over leaderboard summaries.

Address all of the following in depth:

1. Define a claim taxonomy separating source-locked, structurally converted,
   numerically conformant, runtime-smoke-only, browser-executed,
   conversation-screened, task-specific-proven, broadly conversation-proven,
   and production-qualified. State minimum evidence and prohibited wording.
2. Design a layered evaluator using deterministic structure/format checks,
   scenario-specific semantic invariants, calibrated model judges, and blinded
   human review. State which layer is authoritative for which claim and how
   disagreement is resolved without rewriting output.
3. Define general semantic invariants for underspecified choices, conflicting
   authorities/dates, unavailable resources, latest-turn preferences, quoted
   instructions as data, uncertainty, summaries, rewrites, JSON, extraction,
   code explanations, and lawful adult comparisons. Avoid one fixture's nouns
   or exact expected wording.
4. Design metamorphic families varying entities, units, percentages, dates,
   authority order, sentence order, explicit/implicit negation, resources,
   tone, irrelevant distractors, quoted attacks, and multi-turn preference
   updates. State which verdicts must remain invariant and which should change.
5. Specify sealed holdout generation with committed generator version, source
   family, seed, exclusion set, materialized case hash, custody, and a rule
   preventing developers from selecting an easy seed after output.
6. Define contamination controls over prompts, expected terms, answers,
   templates, entities, public benchmarks, training records, teacher output,
   and removal lineage. Include exact normalization, character/token n-grams,
   semantic neighbors, template-family detection, entity-substituted overlap,
   and blinded manual comparison.
7. Separate quantization regression from base capability. Compare dense source,
   independently quantized reference, SLM2 native, SLM2 WASM, and browser chat
   under identical prompt/token/sampling identities. Define regression budgets
   for logits, token stability, and semantic outcomes.
8. Design stochastic treatment: fixed declared product seeds or random policy,
   repeated preregistered seeds, per-case pass probability, Wilson or exact
   intervals, correlated failures, family-level aggregation, multiple model
   comparisons, and infrastructure flake separation. Explain why best-of-N is
   invalid unless it is the declared user-visible product behavior.
9. Specify human review: blind identities, randomized order, rubrics,
   independent primary raters, adjudication, qualification, calibration cases,
   agreement statistics, fatigue limits, conflict disclosure, raw decision
   custody, and no reviewer access to training membership.
10. Define ordinary-helpfulness preservation and over-refusal measurement so a
    small model cannot pass by refusing difficult or lawful adult requests.
    Include narrow concrete security and nonconsensual-harm boundaries without
    turning the suite into refusal-count optimization.
11. Establish stop rules for an unpromising model: repeated practical-constraint
    violations, source-authority failure, template instability, incoherence,
    unacceptable quantization regression, or browser-specific degradation.
    State evidence required before spending training compute.
12. If rescue is justified, compare assistant-only SFT, LoRA, DoRA, upper-layer
    adapters, full fine-tuning, sequence-level distillation, top-k logit/KL
    distillation, preference optimization, and self-distillation for a 0.6B
    student. Include corpus and compute requirements, catastrophic forgetting,
    licensing, and browser artifact implications.
13. Design a scalable behavior curriculum that teaches rules rather than test
    phrases. Include scenario-factor generation, counterfactual constraints,
    authority permutations, entity/unit substitution, discourse variation,
    multi-turn state changes, hard negatives, untrusted quoted instructions,
    teacher disagreement, factual verification, PII/license screening, and
    removal lineage.
14. Specify no-cheat evidence binding model bytes, ancestry, adapter/training
    lock, tokenizer, template, prompt, sampling, runtime, browser build,
    evaluator, case set, holdout generator, raw output, judge decisions, human
    decisions, and final claim by cryptographic identity.
15. Define objective first-model promotion thresholds as a decision procedure,
    not invented numeric results. Include critical-family zero-tolerance rules,
    aggregate uncertainty, ordinary-helpfulness regression budget, independent
    audit, browser execution, and explicit remaining risk.

Required report structure:

1. Executive quality recommendation and assumptions.
2. Current primary-source evaluation/post-training matrix.
3. Claim taxonomy and minimum evidence.
4. Layered evaluator authority design.
5. Semantic-invariant specification table.
6. Metamorphic and sealed-holdout design.
7. Contamination threat model and controls.
8. Dense/quantized/native/WASM/browser comparison matrix.
9. Statistical and stochastic policy.
10. Human review and independent audit protocol.
11. Stop rules and rescue decision tree.
12. Training/distillation method and compute comparison.
13. Curriculum generation, review, and removal lineage.
14. Cryptographic evidence graph.
15. Objective promotion checklist and remaining-risk format.
16. Unknowns requiring private outputs, training authorization, or compute.
17. Annotated primary-source bibliography with dates and immutable links.

Do not recommend training on evaluation prompts or expected terms, hiding failed
outputs, repairing answers, selecting the best seed, accepting keyword matches
as semantics, using an opaque LLM judge as sole authority, promoting from one
attractive response, lowering thresholds to reach a catalog count, or treating
quantization parity as general conversational quality.

## Prompt 12: End-To-End First-Model Evidence Graph, Release, And Living Documentation

You are an independent principal release engineer, evidence-control-plane
architect, and technical documentation governance lead. Produce an
exceptionally detailed report defining the complete state machine and evidence
graph required to move one real Qwen3-derived composition from immutable public
source through conversion, independent verification, native and browser
execution, untouched multi-turn quality, P2P eligibility, product deployment,
and consistently updated documentation. Target 8,000 to 15,000 words excluding
the bibliography.

You may browse public provenance standards, reproducible-build guidance,
operating-system and browser documentation, package registries, release
engineering literature, cryptographic standards, and public TinyRustLM,
MiniModel, or related project pages if available. You have no access to private
source, branches, artifacts, receipts, tests, deployment accounts, signing
keys, peer infrastructure, model outputs, or credentials. Do not claim private
validation or invent a production result.

Project-supplied facts and constraints, to be labeled as unverified project
facts:

- TinyRustLM is one prelaunch product. There is no product V2, launched legacy
  population, compatibility obligation, migration lane, alias, fallback,
  temporary patch allowance, or accepted code debt. Technical SLM2, ACG2,
  Tokenizer2, Template2, Sampling2, Prompt2, profile revisions, semantic
  versions, and UAI memory revisions are exact internal identities only.
- The current public website release is identified by the project as
  TinyRustLM.com `0.3.0`, release date 2026-08-24. A successful static-site
  publication does not prove a real model, companion package, P2P lane,
  MemoryEndpoints workflow, or campaign completion.
- The first public ancestor is `Qwen/Qwen3-0.6B` revision
  `c1899de289a04d12100db370d81485cdf75e47ca`. A content-only source lock binds
  exactly nine files and 1,519,207,688 aggregate bytes. The unchanged base is
  rejected as a product model but remains a parity and derivative ancestor.
- The intended conversion creates exactly six ordered artifacts: mixed-Q8
  SLM2, Tokenizer2, Template2, Sampling2, Prompt2, and ACG2. The output root is
  create-only and terminal; pass and rejection evidence are mutually exclusive
  and preserved.
- Conversion must be preregistered before output and invoked once. Structural
  conversion, independent parsing, source-framework parity, native runtime,
  browser WASM, browser chat, semantic quality, P2P reachability, catalog
  announcement, package publication, and public website readback are separate
  gates.
- The browser product must choose exact qualified P2P composition acquisition
  when available or an explicit reviewed local conversion when not. It must
  not download a text/script/request file and call that model acquisition.
- Prompts and model tensors must not be uploaded to project sites. Public
  evidence excludes secrets, private paths, raw prompts, raw model payloads,
  and private memory content.
- Documentation and marketing sites must remain robust and current. Every
  authorized publication updates a consistent release/version/date and
  append-only change log on that site. Documentation may never imply evidence
  that has not passed.
- The larger campaign targets 20 qualified model hashes, 50 deletion-backed
  browser conversations, 25 authorized live memory rounds, 40 current outside
  lane proofs, and 20 live catalog announcements. Current supplied counters are
  0/20, 0/50, 0/25, 0/40, and 0/20. One local result may advance only the exact
  counter whose full definition it satisfies.
- MemoryEndpoints is unauthorized and disconnected. No live memory action may
  be attempted or simulated.

Research primary sources for SLSA, in-toto, SPDX/CycloneDX, Sigstore and other
signing/provenance approaches, reproducible builds, canonical JSON, durable
filesystem transactions, secure publication, browser release evidence, NuGet
and symbol packages where relevant, accessibility release gates, content
security headers, P2P outside proof, append-only logs, and documentation-as-code
governance. Distinguish what can be proven in CI from real hardware, browser,
outside-network, registry, and production evidence.

Address all of the following in depth:

1. Define a phase state machine for public-source review, source locking,
   output-free execution registration, tool build/capture, one-shot conversion,
   terminal reconciliation, independent structural verification, source-
   framework parity, native runtime, WASM parity, browser storage/activation,
   untouched multi-turn chat, semantic qualification, P2P preparation, outside
   proof, catalog eligibility, package release, website deployment/readback,
   documentation update, and final acceptance.
2. Define allowed transitions, retry as a distinct attempt, terminal rejection,
   invalidation, external blockage, revocation, supersession by clean
   replacement, and completion. No single boolean `passed` may replace phase
   evidence.
3. Build a content-addressed receipt DAG. Bind source files/revision/license,
   locks, contracts, source commit/tree, toolchain, executable, invocation,
   outputs, verifier, source oracle, runtime binaries, WASM, browser version and
   profile, prompts by private hash, raw output, quality decisions, peer pieces,
   outside proof, packages, deployed files, and documentation claims.
4. Define invalidation edges. An evaluator change should rerun evaluation, not
   reacquire valid 1.5 GB source bytes; a runtime change should rerun runtime and
   browser evidence but not rewrite conversion history; a model-byte change
   invalidates all descendants. Provide an algorithm.
5. Specify durable evidence storage: same-directory staging, file and directory
   sync, bounded canonical JSON, checksums, create-only history, large-file
   streamed hashing, interruption, disk full, Windows rename/link behavior,
   Linux behavior, archive retention, and validation before resume.
6. Design secret/privacy minimization and scanning across Git, build logs,
   receipts, browser traces, screenshots, URLs, storage, service workers,
   packages, archives, source maps, deployment manifests, and public change
   logs. Include UTF-8, UTF-16, base64, compressed content, and hash-like false
   positives.
7. Define gate matrices for Rust converter/runtime, WASM, browser application,
   local companion, C ABI, C# wrapper, NuGet packages and symbols, Windows x64,
   Linux x64, real Linux ARM64, direct P2P, catalog metadata, and public sites.
   Distinguish build, binary-header inspection, emulation, and real execution.
8. Design first-model quality and claim integrity. State exactly when the model
   can be called structurally converted, numerically conformant, browser-
   executed, conversation-screened, production-qualified, P2P-eligible,
   externally reachable, announced, and released. Include prohibited language.
9. Specify P2P proof and lifecycle: two truly independent process lanes if
   required by campaign policy, one shared read-only piece store, outside-
   network signed expiring proofs, stale/revoked states, direct-import
   verification, and no catalog or project-site model proxy.
10. Define publication transactions for source control, package registries,
    and websites. Require clean tested commit, source/remote equality, exact
    manifest, authorization, upload, immutable public readback, rollback plan,
    no secret exposure, and a final append-only release receipt.
11. Design consistent per-site release metadata and change logs: product/site
    identity, semantic version, release date, publication timestamp, source
    commit, public-readback identity, concise user-visible changes, technical
    evidence links, known blockers, and remaining risk. Prevent copy drift
    across documentation and marketing sites.
12. Define living-documentation ownership. Architecture decisions, format
    contracts, operational guides, API/package docs, model cards, security and
    privacy claims, browser support, release status, and public marketing must
    change in the same tested checkpoint as implementation or be a hard gate.
13. Provide a failure-to-regression workflow: preserve raw failure, add a
    generic test, make one scoped clean fix, delete superseded prelaunch code,
    rerun only invalidated phases, update long/short-term project memory,
    commit after the major buildable change, and deploy whenever all applicable
    tests pass.
14. Design an operator dashboard reporting current operation, phase identities,
    elapsed time, resumability, blockers, one-model gate state, and the five
    campaign counters. It must never say done from unit tests, conversion, or
    local P2P health alone.
15. Define final acceptance for the first real vertical slice and separately
    for campaign credit. Include exact objective evidence, no unresolved
    critical defects, current docs/marketing, source control safety, public
    readback, and an explicit remaining-risk section.
16. Give a prioritized implementation sequence that preserves frequent clean
    commits and quality-based publications while avoiding large mixed changes,
    compatibility code, stale docs, and inflated claims.

Required report structure:

1. Executive control-plane recommendation.
2. Complete phase/state diagram.
3. Receipt DAG and versioned schema family.
4. Invalidation and minimal-rerun algorithm.
5. Atomic persistence and resume rules.
6. Privacy, redaction, and secret-scanning contract.
7. Component/platform/live gate matrix.
8. Claim taxonomy and prohibited language.
9. P2P proof, catalog, and revocation lifecycle.
10. Source/package/site publication transactions.
11. Cross-site version, date, and change-log standard.
12. Living-documentation governance.
13. Failure-to-regression and clean-cut workflow.
14. Operator dashboard specification.
15. First-model and campaign acceptance checklists.
16. Prioritized implementation plan.
17. Unknowns requiring private or authorized external evidence.
18. Annotated primary-source bibliography with dates.

Do not propose a single pass boolean, overwrite rejected or obsolete evidence,
count mocks as live tests, count cross-compilation as ARM64 execution, count
loopback/LAN/NAT-hairpin as outside P2P proof, count package creation as public
publication, count a static-site deployment as model proof, publish model bytes
from project sites, simulate MemoryEndpoints, preserve legacy code for
hypothetical users, or let documentation lag a published implementation.
