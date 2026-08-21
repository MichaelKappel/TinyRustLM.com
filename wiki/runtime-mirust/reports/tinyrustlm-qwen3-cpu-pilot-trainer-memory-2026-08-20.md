# TinyRustLM Qwen3 CPU Pilot Trainer Memory

Date: 2026-08-20

Branch: `codex/model-acquisition-v2`

Implementation commit: `09c0e2bc96d728f220b322fbe9d33774f8664b1e`

Frozen enterprise goal SHA-256:
`92af9585346fb8b22df906ee5e5feef989b118692f8ba0bb92df9056da9663b0`

## Scope And Truth Boundary

This milestone implements the sole pinned CPU LoRA pilot trainer and captures
an exact offline Windows AMD64 training environment for the preregistered
Qwen3 0.6B working-model lane. It closes the previously actionable engineering
work that could proceed without private holdout authors or human curriculum
reviewers.

It does not create or accept a curriculum, complete either private holdout
contribution, seal a holdout, pass contamination review, issue training
authority, train an adapter, merge a model, pass an untouched source screen,
convert a qualified SLM2 artifact, run qualified native or WASM inference, or
prove browser-local conversation. Campaign counters remain `0/20`, `0/50`,
`0/25`, `0/40`, and `0/20`.

MemoryEndpoints remained unauthorized and disconnected. No credential,
hosted-memory mutation, deployment, publication, or live campaign action
occurred.

## Source Control And Checked-In Identities

Implementation commit `09c0e2bc96d728f220b322fbe9d33774f8664b1e` is
pushed and actual-remote exact on `origin/codex/model-acquisition-v2`.

- Trainer: 134,232 bytes, SHA-256
  `aded5f91db040008685a506e6a59e09593b68bdb69688095fa0aef8db8e0c50b`.
- Trainer tests: 39,482 bytes, SHA-256
  `88e2b3abb6366202711cd2fc4d8b7632748c694448be5987b3f765c19e46ea59`.
- CPU environment specification: 4,622 bytes, SHA-256
  `635d198495ba1e3c4c8954ba27bc2d25dea2159ff96210b67943623d4886aed2`.
- Lane README: 18,933 bytes, SHA-256
  `427b5e2a7363bd2af56445d031f15166398174ed4eec48212924ea7574c9c67c`.
- Preregistered profile: SHA-256
  `1c540f44cd0b6b1c69625ad108c2ff1b6165a9361734fb0045eb20b9968c9b79`.

The implementation exists only in the owned recovery clone at
`E:\Source\.tinyrustlm-model-acquisition-recovered-20260819`. The protected
checkout `E:\Source\Rust\TinyRustLM.com` was not modified.

## Sealed CPU Environment

The sole environment specification pins CPython 3.12.10 on Windows AMD64 and
the exact root wheels for Torch 2.13.0, Transformers 5.14.1, PEFT 0.20.0,
Accelerate 1.14.0, Safetensors 0.8.0, Tokenizers 0.22.2, Hugging Face Hub
1.28.0, NumPy 2.5.2, pip 26.2.1, and setuptools 84.0.0. Torch must report the
CPU runtime `2.13.0+cpu`. CUDA, system site packages, source distributions,
editable installs, unowned distributions, and the declared forbidden package
set are rejected.

The external wheelhouse contains exactly 39 transitive wheels totaling
170,527,657 bytes. Its current create-only manifest is:

- Path: `E:\TinyRustLM-vnext-tools\qwen3-cpu-pilot-v1\wheelhouse-manifest.v2.json`.
- Bytes: 10,151.
- File SHA-256:
  `c69cdc8bc3e1c8dc40ac7bbb85d27307ba24f526ac0ad25575eaa4000fcefd46`.
- Artifact-set SHA-256:
  `f5ffe27669384075d514d27fab2f6d06f00badc22c2c8ff113bb6618b56a7ece`.

The installed distribution file set has SHA-256
`ae837c77159fce892b1626d947dc390a86f5d530fd5fe45f7890b905bf8db707`.
The current create-only environment lock is:

- Path: `E:\TinyRustLM-vnext-tools\qwen3-cpu-pilot-v1\environment-lock.v3.json`.
- Bytes: 17,964.
- SHA-256:
  `68c36c8492c59c0006e3bfa018b0d84dbc1832379733512c4e979b9a17ac49eb`.
- Training authority: `false`.

The lock binds every installed distribution file, the virtual-environment
interpreter, `pyvenv.cfg`, CPU and platform identity, the wheelhouse manifest,
`pip check`, runtime import and build probes, the profile, environment
specification, and the exact trainer bytes. Wheelhouse manifest v1 and
environment locks v1 and v2 remain immutable invalidated history. The
separate bootstrap wheelhouse and bootstrap site are installation tools, not
captured training-environment members or training evidence.

## Sole Training Algorithm

The only implemented pilot algorithm is one deterministic CPU float32 epoch
of assistant-only supervised fine-tuning plus preservation KL. It uses
rank-16 LoRA over all seven Qwen3 projection types, an effective batch of
eight, AdamW, linear warmup and decay with a positive final applied learning
rate, no truncation, no sequence packing, eight Torch intra-operation threads,
one inter-operation thread, and deterministic algorithms.

The Qwen3 chat template renders with `enable_thinking=False`. Only assistant
tokens contribute to supervised loss. Preservation KL uses the same base with
the adapter disabled. Python and Torch seeds are installed before model and
LoRA initialization, and the curriculum order is one seeded permutation.

The trainer verifies its own program identity before importing ML packages.
It then installs a Python audit hook before import probing or model loading.
The hook rejects socket creation, binding, DNS resolution, connection,
sending, and child-process launch. Source and tokenizer loading require the
exact local nine-file checkpoint with `local_files_only=True` and
`trust_remote_code=False`.

## Authorization And Replay Boundary

The control program remains the issuer and verifier of the complete training
authorization graph. Before issuing a lock, it must reopen the two curriculum
review ledgers, any necessary third-party adjudication ledger, contamination
audit, private holdout receipt, exclusion index, semantic audit, tombstone
lineage, source, environment, trainer, recipe, output root, and stop rules.

The trainer independently verifies the resulting training lock and its exact
source, curriculum, environment, and program bindings. It does not treat an
environment lock, input verification, checkpoint, or adapter candidate as a
quality claim. A training lock cannot exist until every upstream control
passes.

Complete checkpoints bind safe adapter bytes, optimizer state, RNG state,
cumulative metrics, curriculum offsets, and their parent checkpoint receipt.
Resume accepts only the exact complete checkpoint schedule prefix. It rejects
partial or drifting evidence, recovers cumulative metrics and elapsed-time
budget, and never silently restarts a run.

Interrupted checkpoint or candidate staging is preserved under the owned
`interrupted/` history by an explicit quarantine operation. Existing output
is never deleted or overwritten. A committed candidate can recover a lost
top-level receipt idempotently. Terminal rejection is persisted before failed
adapter preservation and can never become resumable.

Only the final checkpoint can become an adapter candidate. The candidate
receipt states `quality_claim: none`. Non-finite loss, eight consecutive loss
increases, 72 hours elapsed, RSS above 64 GiB, unmet preregistered behavior or
preservation floors, or ordinary-helpfulness regression over 2% terminates the
run according to the frozen rules.

## Verification

The checked-in milestone passed:

- 47/47 focused trainer tests;
- 88/88 combined Qwen3 control and trainer tests;
- Ruff lint and format checks over the trainer and hostile contract tests;
- fresh exact environment-lock verification over all installed files;
- `pip check` with no broken requirements;
- an offline ML import and runtime-build probe under the network and
  child-process audit hook;
- an actual pinned Torch `weights_only=True` optimizer and RNG state
  save/load round trip;
- staged-versus-working Git object equality for the tested trainer;
- `git diff --cached --check`;
- clean source state and exact local/remote commit identity after push.

The fresh environment verifier returned `status: pass` and
`training_authority: false` for lock SHA-256
`68c36c8492c59c0006e3bfa018b0d84dbc1832379733512c4e979b9a17ac49eb`.

## Remaining Work And Exact Resume

1. Two genuinely separate authorized authors must complete the 140-slot
   development and 140-slot independent-audit templates in
   `holdout-custody-v6`. This agent must not impersonate either author.
2. The exact 1,024-record pilot curriculum and teacher lineage must be
   materialized outside Git.
3. Two genuinely separate reviewers must complete full record-bound ledgers;
   a third reviewer is permitted only for actual disagreement.
4. Holdouts must be assembled and sealed, and lexical, template, entity,
   answer, tombstone, and blinded semantic contamination audits must pass.
5. Only then may the control program issue the exact CPU training lock.
6. The authorized pilot may then run, preserve all checkpoints and terminal
   evidence, and merge only an eligible final adapter into distinct source
   bytes.
7. The merged derivative still requires untouched behavioral screening,
   deterministic SLM2 conversion, scalar and browser-WASM conformance,
   P2P-or-convert acquisition, and genuine browser-local multi-turn chat.

The next engineering step is not another trainer implementation. It is the
human-authored custody and curriculum evidence required to make training
authorization truthful. Until those artifacts exist, no training command may
be issued and no model or campaign claim may advance.
