# TinyRustLM OMI Computational Architectures Intake Synthesis

Date: 2026-08-27

## Decision Status

This document is the reviewed TinyRustLM disposition for the 23 reports listed
in `MANIFEST.md`. It does not rewrite the reports, adopt their terminology as
project architecture, or turn advisory research into implementation evidence.
The raw files remain byte-exact intake artifacts. This synthesis is the local
engineering decision layer.

The reports improve the strategy primarily by strengthening invariants that
TinyRustLM already needs:

1. keep data, inference, authority, action, evidence, and promotion distinct;
2. model operations as bounded typed transitions over immutable identities;
3. declare exactly which state an operation may mutate and reject any other
   observed mutation;
4. preserve contradictions, uncertainty, negative results, and terminal
   failures instead of flattening them into one convenient status;
5. make replay, cancellation, resource ceilings, and privacy part of the
   contract rather than debugging afterthoughts;
6. admit advanced research only through a preregistered comparison against a
   simpler baseline under equal resource and quality accounting.

They do not justify replacing the first-model release path with an OMI kernel,
a generic cognitive compiler, an adaptive memory engine, an e-graph service,
probabilistic programs, a world model, a sheaf runtime, an energy-based
assistant, or a robotics control stack. TinyRustLM remains one prelaunch
browser-local product with one SLM2 composition path, one Rust semantic
runtime, a bounded dedicated browser worker, explicit local and portable
memory, and content-addressed evidence.

## Evidence Boundary

The report agents had no access to private source, model artifacts, runtime
logs, browser traces, tests, credentials, production services, or campaign
receipts. Consequently:

- public citations can motivate local investigation but do not prove the
  current product;
- code samples are illustrative and are not reviewed dependencies;
- projected benchmark gains, memory savings, determinism, security, privacy,
  production readiness, and generality are unverified claims;
- no report proves conversion, numerical parity, browser chat, model quality,
  MemoryEndpoints continuity, P2P reachability, publication, or deployment;
- report conclusions cannot override immutable local failure evidence or the
  sole current clean-slate contracts;
- the exact manifest and local tests, not confident prose, control adoption.

Campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.

## Product Architecture Decision

Use the research as a discipline layer around the current product, not as a
new product stack.

| Plane | Current authority | Accepted research contribution | Explicit exclusion |
| --- | --- | --- | --- |
| Composition | Exact SLM2 six-member graph and strict readers | Typed domains, closed member sets, proof provenance | Generic cognitive IR and format alternatives |
| Inference | Pinned source, scalar reference, optimized native, WASM differential chain | Bounded state, deterministic replay, first-divergence evidence | Energy-based replacement, neuralized calculators, hidden fallbacks |
| Browser | Dedicated worker with one authoritative event path | Declared mutations, monotonic operations, cancellation and replay | Multiple runtime providers, fallback inference, latent control messages |
| Memory | Local UAIX plus authorized MemoryEndpoints portable continuity | Provenance, explicit conflicts, current-turn precedence, bounded retrieval | Test-time weight updates, silent consolidation, CRDT replacement without contract |
| Actions | Typed capability and user-consent boundary | Preconditions, effects, compensation, concrete denied states | Model prose or retrieved text as authorization |
| Evidence | Content-addressed receipts and immutable terminal history | Causal operation graph, private-by-default observations, negative evidence | Central raw telemetry, self-certification, repaired failures |
| Research | Separate preregistered shadow experiments | Equal-compute baselines, negative controls, explicit stop rules | Shipping speculative systems before first-model closure |

Natural-language text is payload data. It is never a schema, capability,
credential, operation identity, release decision, or executable instruction.

## Report-By-Report Disposition

### Active Perception AI Systems

Useful engineering content:

- separates epistemic actions that reduce uncertainty from pragmatic actions
  that advance an objective;
- treats expected information gain, action cost, risk, and stopping as
  explicit quantities;
- recommends deterministic replay of belief updates and adversarial tests for
  curiosity loops, sensor failure, and resource exhaustion;
- requires a capability and consent boundary before collecting more data.

TinyRustLM application: an ambiguity-sensitive dialogue may ask one bounded
clarifying question or request an explicitly authorized source when the value
of that information exceeds delay and user burden. The model cannot activate a
camera, microphone, network source, account, or tool merely because more data
would be useful. The browser worker remains network-incapable.

Research-only: physical sensors, robotics, belief-space planners, and claims
of benchmark superiority. None are needed for the first browser release.

### Active Perception Monograph Plan

This broader plan reinforces optimal stopping, resource-aware observation, and
separate epistemic and task outcomes. Its best contribution is a test shape:
the system should stop asking once the decision is sufficiently determined,
should not repeatedly seek unavailable evidence, and should expose why it
cannot proceed.

Do not adopt its broad research program as a release dependency. For current
product work, encode ambiguity and evidence-seeking as semantic evaluation
families with explicit maximum turns, allowed sources, cancellation, and
privacy rules.

### Cognitive Compiler IR Portability

Accepted ideas:

- operations should have explicit input/output domains, effect sets,
  capabilities, bounds, and provenance;
- a rewrite needs an independently checkable equivalence claim rather than a
  compiler's assertion;
- deterministic conformance vectors and differential implementations are more
  useful than prose portability claims;
- resource ceilings belong in validation before execution.

Important correction: WebAssembly does not by itself guarantee bitwise
determinism. Operation order, scalar types, rounding, math functions, SIMD
profile, PRNG, host APIs, and implementation versions must still be fixed and
tested.

Rejected now: a broad OMI IR with many dialects, a new compiler toolchain, and
parallel language backends. TinyRustLM's closed contract registry, exact
schemas, and independent vectors are the smaller sufficient mechanism. Add a
new abstraction only when it removes demonstrated duplication.

### Differentiable Digital Twins Monograph

The physical-twin architecture is out of product scope, but four controls are
portable:

1. immutable parameter and model identities;
2. independent drift detection;
3. holdout validation before promotion;
4. separate forward-result quality from gradient or adaptation quality.

TinyRustLM already needs analogous separation among source model, converted
composition, numerical runtime, behavioral quality, and deployed browser
surface. Hardware-in-the-loop, differentiable simulators, and physical-control
claims remain research-only.

### Distributed Ontological State Research

Accepted principles:

- concurrent or contradictory assertions must remain explicit, attributed,
  and queryable instead of being overwritten by arrival order;
- append-only events need causal and schema identities;
- resolution is a new decision with provenance, not deletion of disagreement;
- partition, replay, duplicate, reordering, and conflict tests are mandatory
  before claiming distributed continuity.

TinyRustLM application: local and MemoryEndpoints records preserve source,
time, revision, trust class, supersession, and tombstone state. The current
user turn outranks stale profile or retrieved memory. Retrieved natural
language remains untrusted data.

Rejected: replacing the advertised MemoryEndpoints contract with a speculative
CRDT/DOMF/WebRTC system, adding hybrid-consensus fallbacks, or treating eventual
merge as exact continuity. Tombstone growth, Byzantine inputs, retention, and
schema changes remain concrete unresolved costs.

### Energy-Based Machine Intelligence Monograph

Potential future value lies in factorized constraint scoring and global
candidate refinement. A research arm might compare an energy-based specialist
or reranker against a simpler deterministic or discriminative baseline for a
single bounded task.

It is not a first-model runtime plan. Any future experiment needs exact model
and energy identities, an equal-compute baseline, adversarial low-energy
invalid cases, out-of-distribution calibration, latency/memory accounting, and
raw noninferiority evidence. Iterative refinement cannot become hidden retries
or output repair.

### Energy-Based Machine Intelligence Report

This shorter implementation-oriented report is useful mainly as a warning:
"low energy" is not equivalent to valid, safe, factual, or authorized. Every
energy function needs negative controls and a separate semantic oracle.

Reject the report's broad production-readiness implications and any direct
runtime adoption. The current browser path must first establish exact SLM2
numerics and one useful assistant without adding an iterative search system.

### Equality Saturation E-Graph Implementation

Possible future use: an offline build-time optimizer or proof-carrying helper
for a small, typed, side-effect-free expression language. Required boundaries
would include rule identity, exact versus approximate rewrite classes,
saturation node/iteration/time ceilings, deterministic extraction cost, and an
independent semantic oracle.

The supplied code is demonstrative, not production. For example, unordered set
conversion can create nondeterministic output, and broad equivalence claims are
not established by the examples. Do not copy it into source or introduce a
service around it.

### Equality Saturation Research Monograph

Accepted principles are typed rewrite rules, provenance, resource bounds,
mutation/property/differential tests, and a strict split between exact symbolic
equivalence and approximate floating-point transformations.

Rejected: a runtime OMI e-graph, gRPC or REST service, new repository, and the
unqualified claim that equality saturation guarantees escape from every local
minimum. Any useful implementation should begin with one demonstrated
build-time duplication and no network process.

### Generative Control Trajectory Planning Part 2

Physical control is out of scope. Useful transferable tests are whole-plan
feasibility, constraints at every step, terminal-goal satisfaction, bounded
repair locality, and explicit failure when no feasible plan exists.

For TinyRustLM practical-advice evaluation, vary unavailable resources,
changed user state, deadlines, units, and constraints. The answer should not
recommend unavailable equipment and should offer a feasible alternative when
one exists. A plausible sentence is not proof that the whole plan is feasible.

### Generative Control Trajectory Planning

Accepted abstract lesson: generated plans must be checked against current
state and declared constraints, and a state change invalidates dependent plan
steps. Rejection must remain visible.

Rejected: physical projectors, MPC fallback, hidden repair loops, and a
robotics stack. Product generation remains one declared run; a failed or
infeasible output is preserved and scored, not silently repaired.

### Hierarchical Skill Intelligence Research

A future typed tool contract can reuse these fields: stable skill identity,
input schema, preconditions, effects, required capabilities, maximum duration,
cancellation, compensation, uncertainty, and exact success evidence.

Do not implement the report's microservice, gRPC, ZeroMQ, YAML plugin, or broad
skill-library architecture now. Imported skill prose and model-selected labels
never authorize action. Tool work should wait until the first local model and
browser worker path are complete, then begin from one concrete tool under one
closed contract.

### Local-First Machine Intelligence Architecture

Accepted:

- user ownership, explicit export/deletion, encrypted portable secrets, and
  no ambient credentials;
- local operation where possible and explicit network behavior where needed;
- capability-separated action boundaries;
- exact versions and immutable artifact identity;
- privacy tests that inspect storage, logs, traces, and network traffic.

Rejected for the current product: GGUF, llama.cpp, WebGPU provider fallback,
federated LoRA, UCAN, zero-knowledge proof stacks, GossipSub/DHT discovery,
relay fallback, and migration tooling. TinyRustLM has one SLM2 Rust/WASM path,
MiniModel direct-peer discovery, and authorized MemoryEndpoints continuity.
Static model weights, KV state, retrieval indexes, and UAIX memory are distinct
domains and must not be conflated.

### Machine Intelligence Observability Research

This report has strong immediate design value when narrowed to existing
evidence tooling:

- distinguish process provenance from source or evidence support provenance;
- assign typed operation, parent, input, output, error, and terminal identities;
- make replay bind exact software, artifacts, seeds, ordering, and environment
  profile;
- record root and causal failures as analysis fields, never model narration;
- keep observations private by default and selectively disclose bounded facts;
- preserve negative results and cancellation as first-class terminals.

Do not store raw prompts, raw portable memory, credentials, or guessable hashes
of low-entropy secrets. Do not add centralized telemetry, Neo4j, or a large
OpenTelemetry dependency merely to visualize a graph. The current
content-addressed receipt system is the production baseline; exact environment
captures stay private and minimized.

### Modular Causal World Models

The portable production insight is declared mutation scope. Every operation
should state the exact fields or objects it may change, execute against an
isolated candidate, compare the resulting diff, and reject or quarantine any
undeclared mutation.

Apply this principle to worker state, conversation turns, memory writes,
receipt state, and release activation. Do not add a neural world-model runtime,
Python/C# service, or mechanism router to obtain it.

### Neural Algorithmic Reasoning Research Part 2

Accepted evaluation methods:

- train or tune on smaller structures and test on larger or differently
  shaped structures;
- inspect intermediate invariants, not just a final answer;
- use graph-isomorphism, renaming, permutation, and size metamorphics;
- separate algorithmic generalization from benchmark phrase familiarity.

Deterministic arithmetic, parsing, search, and verification remain declared
tools. They should not be neuralized merely to make the model appear more
capable.

### Neural Algorithmic Reasoning Research

This report supports future specialist-model research under sealed data and
out-of-distribution tests. It does not justify an inference fallback. A
deterministic algorithm can be an explicit product tool; it must never run as a
hidden rescue when a neural answer fails.

Reject any "exact fallback kernel" that conceals model failure. Product
behavior either invokes a declared tool under user-visible policy or fails
closed and preserves the raw answer.

### OMI Kernel Architecture Research

Accepted concepts:

- probabilistic inference and deterministic authority/state transitions are
  different planes;
- epistemic status should be typed rather than implied by prose;
- capability denial is a concrete state with reason and scope;
- event envelopes require identity, parentage, bounds, and terminality;
- circular self-attestation is invalid;
- cross-runtime vectors need independent implementations.

Rejected: a monolithic OMI kernel and five language clones. TinyRustLM's
existing Rust authority plus strict browser/.NET boundaries is narrower and
more auditable. Metamorphic tests also cannot assume every synonym maps to an
identical state; semantic equivalence must be defined per case.

### Probabilistic Programming OMI Report

The report materially misroutes the acronym OMI among unrelated public
entities rather than the project's Ontological Machine Intelligence context.
That source-quality defect prevents architectural adoption.

Generic useful content remains: named random choices, explicit PRNG state,
log-sum-exp, separation of aleatoric and epistemic uncertainty, and
simulation-based calibration. Reject executable probabilistic programs inside
model artifacts or browser runtime, a new interpreter, and any product claim
derived from the acronym match.

### Sequence Intelligence Memory Engine

Accepted separation:

- immutable slow weights;
- ephemeral inference and KV state;
- an exact bounded recent-turn buffer;
- durable attributed memory records;
- explicit contradiction, supersession, and tombstone state;
- content-addressed checkpoints and reset boundaries.

Rejected: test-time weight updates, fast-weight exchange, silent consolidation,
silent forgetting, and runtime self-training. Those mechanisms destroy exact
replay, contaminate evaluation, blur user memory with model weights, and make
untrusted memory capable of persistent model mutation. Current KV state stays
ephemeral; local UAIX and MemoryEndpoints changes remain explicit typed writes.

### Sequence Intelligence Research Strategy

Potential research value is a preregistered ablation over delayed recall,
contradiction handling, dormant-skill recovery, and procedural extrapolation.
It belongs after the first model release and must use sealed cases, a frozen
base, isolated candidate states, explicit reset, and paired baseline evidence.

Reject "infinite context" and universal bitwise IEEE-754 cross-language replay
claims. Context, storage, retrieval, and floating-point behavior are bounded
and require actual platform proof.

### Topological Machine Intelligence Research

Topology can offer a future vocabulary for local consistency, translation
between heterogeneous state spaces, and localization of contradictions. That
is research-only. The first implementation candidate for memory conflict is a
simple explicit provenance/conflict set, not a topology library.

Any experiment must compare against the simple baseline on quality, memory,
latency, implementation complexity, and failure explainability. No adoption is
authorized from conceptual elegance.

### Topological Machine Intelligence Sheaves

The local-to-global consistency framing may eventually help validate multiple
source projections. The report also exposes its own risks: identity maps may
perform as well, edge state has real memory cost, and numerical behavior needs
local measurement.

Reject a new sheaf numerical library, C ABI, WASM subsystem, and privacy claims
based solely on linear projections. Privacy needs an explicit attacker model
and leakage tests. Keep this as a separate research arm only.

## Cross-Report Enterprise Rules

The following rules are accepted into durable project strategy:

1. **One current path.** Every shipping concern has one authoritative contract
   and implementation. Historical receipts remain readable as evidence but do
   not require executable compatibility.
2. **Closed typed transitions.** Operations have exact identities, allowed
   inputs, declared mutation sets, limits, cancellation, and terminal outcomes.
3. **Authority is not prose.** User text, model output, memory, report content,
   and telemetry cannot grant capabilities or certify success.
4. **Conflict is data.** Preserve contradictory observations with provenance;
   resolution is a new attributed decision.
5. **Replay is designed.** Bind software, artifacts, ordering, seeds, scalar
   semantics, and resource profile. Never infer determinism from Wasm or one
   attractive replay.
6. **Resources are contractual.** Bound input, output, memory, graph growth,
   iterations, work queues, telemetry, and time before execution.
7. **Evidence is minimized.** Raw prompts, hosted-memory payloads, credentials,
   local paths, and high-cardinality secrets remain private. Public evidence is
   bounded and content-addressed.
8. **Research competes with simplicity.** A speculative architecture needs a
   preregistered baseline, negative controls, equal resource accounting,
   measured improvement, and explicit stop rules.
9. **No hidden rescue.** No retry selection, output repair, fallback runtime,
   fallback route, silent tool invocation, or self-modification.
10. **Documentation ships with behavior.** Current architecture, limitations,
    release history, and marketing claims change in the same green release.

## Prohibited And Deferred Architecture

Do not add any of the following to the first-model critical path:

- a monolithic OMI kernel or five-language semantic clone;
- a broad cognitive IR/compiler or runtime dialect family;
- new gRPC, REST, ZeroMQ, Neo4j, or graph-database services;
- executable probabilistic programs or artifact-supplied scripts;
- runtime self-modification, test-time learning, fast-weight exchange, or
  silent memory consolidation;
- GGUF, llama.cpp, alternate inference providers, remote inference, or relay
  fallback;
- federated learning, LoRA gossip, DHT training, or peer model mutation;
- physical-control, robotics, sensor, or digital-twin product paths;
- e-graphs, energy models, sheaves, topological state, or world models without
  a separately registered baseline experiment;
- compatibility readers, schema aliases, migration code, feature-flag dual
  paths, or deferred cleanup.

## Current Local Application

The immediate release path does not need another architecture. It needs the
existing clean cut completed:

1. add the new dedicated browser worker to the exact web deployment inventory;
2. update the stale scalar profile identity only after confirming the current
   `Cargo.toml` source change is intended and covered by tests;
3. integrate the browser UI exclusively through the worker protocol;
4. prove real ACG2 activation, raw exactly-once multi-turn rendering,
   cancellation, worker replacement, restart reverification, and native/WASM
   parity;
5. delete every superseded SLM1/ACG1 product consumer, test, asset, and current
   document in the same coherent replacement;
6. run the complete source, package, browser, privacy, documentation, and
   deployment gates before publishing.

The clean release-surface run at commit `5828fbdec19726ae9ba583a8d6be57d775c57ac7`
finished 1,676 tests with 1,664 passing, nine failing, and three skipped. One
root failure is the stale scalar `Cargo.toml` identity (registered 1,781 bytes,
current 1,832); the other is the absent `model-runtime-worker.js` web manifest
entry. Eight web failures cascade from the missing manifest asset. This is
local failure evidence, not a report assertion, and deployment remains blocked.

## Prioritized Strategy

### P0: First browser model clean cut

Complete the worker/UI/acquisition replacement and delete old executable
surfaces. Fix exact release inventories and identities with tests. Run the full
gate and deploy only after all affected checks pass.

### P1: Strengthen existing state and evidence boundaries

Where an existing state machine benefits, add an exact declared-mutation set,
typed contradiction/provenance state, replay identity, and private evidence
limits. Do this in current modules, without introducing an OMI framework.

### P1: Keep memory explicit and non-adaptive

Preserve immutable model weights, ephemeral KV, local transcript, durable UAIX,
and MemoryEndpoints records as separate identities. Test stale/current
precedence, contradictory records, malicious instructions, supersession,
tombstones, reset, and reconnect. Do not update weights from runtime memory.

### P2: Create a bounded research registry after first release

Possible arms are equality-saturation build optimization, an energy-based
bounded reranker, topological conflict localization, or sequence-memory
ablation. Each requires a preregistered question, simple baseline, immutable
inputs, equal resource accounting, negative evidence, and a terminal decision.
Most should be rejected before implementation if they do not solve a measured
product bottleneck.

## Unknowns Requiring Local Proof

- whether declared mutation-set validation removes meaningful complexity in
  current worker, memory, and evidence code;
- whether any advanced architecture beats the simpler current baseline at
  equal quality, memory, latency, and engineering cost;
- real browser memory and cancellation behavior for the first full model;
- scalar/native/WASM numerical parity and useful conversational quality;
- exact MemoryEndpoints live enrollment, reconnect, conflict, and cleanup;
- outside-network P2P reachability and current signed proof;
- cross-platform execution and release/deployment closure.

No unknown may be converted into a pass, fallback, compatibility path, or
marketing claim.
