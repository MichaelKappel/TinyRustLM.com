# Qwen3 Model-Load Environment Closure Correction

Date: 2026-08-26
Status: corrected offline environment sealed; real model-load diagnostic
passed; complete source gate, commit/push proof, and new registration remain

## Decision

The sole current Qwen3 numerical-oracle environment must contain the complete
dependency closure required by the pinned Transformers CPU model-load path.
That closure now explicitly requires `accelerate` 1.14.0 and `psutil` 7.2.2
in addition to the already pinned Python, PyTorch, Transformers, Safetensors,
Tokenizers, NumPy, and transitive packages.

The corrected environment identity is
`tinyrustlm.qwen3-numerical-oracle-python-win-x64/2`. The v1 closure remains
immutable historical evidence for the closed numerical execution and its
diagnostic reproduction. It is not mutated, repaired, or accepted by a
runtime compatibility branch. The active source path has no runtime
compatibility branch and will bind only the newly generated v2 closure.

This numeric suffix identifies a hermetic technical environment. It is not a
TinyRustLM product generation, legacy-support promise, or migration surface.

## Preserved Evidence

The closed operation `qwen3-numerical-c1899de-aece952-20260826-v1` remains
immutable `terminal-failure`. It launched the publisher-source arm once and
stopped at `source-trace-model-load`; later numerical arms were not launched.
The operation may not be retried, repaired, resumed, deleted, adopted, or
promoted.

Separate disposable diagnostics outside Git established two independent
pre-model causes in order:

1. a blanket `socket.bind` audit denial blocked the pinned urllib3 IPv6
   loopback capability probe; and
2. after that policy was narrowed, Transformers reached
   `PreTrainedModel.get_init_context` and raised `NameError` because
   `init_empty_weights` was not imported.

The second diagnostic recorded one accepted capability probe, so it did not
invalidate the isolation correction. Its module/function-only stack ended in
`transformers.modeling_utils.get_init_context`. No raw exception message,
private path, source byte, or model byte entered source control.

## Root Cause

The exact installed `transformers` 4.51.0 distribution declares
`accelerate>=0.26.0` in its `torch` extra. The former offline closure installed
bare Transformers and PyTorch but omitted Accelerate. In the pinned code,
`transformers.modeling_utils` imports `init_empty_weights` only when
Accelerate is available, while `PreTrainedModel.get_init_context` uses that
symbol during `from_pretrained` model construction.

The failure is therefore an incomplete hermetic dependency closure. It is not
evidence that the pinned Qwen3 source is corrupt, and it must not be hidden by
monkey-patching `init_empty_weights`, injecting a substitute context manager,
falling back to a separate loader, or loosening the model-load gate.

Accelerate 1.14.0 and psutil 7.2.2 are exact current pins, not floating minimum
constraints. Their wheel bytes, installed files, dependency metadata, and
runtime versions must be included in the same content-addressed environment
lock as every other package.

## Replacement Result

The v1 environment remains untouched. The correction created a wholly new
external v2 tool root and completed these steps:

1. copy the already locked v1 wheel inputs into a new staging wheelhouse;
2. acquire exact binary wheels for Accelerate 1.14.0 and psutil 7.2.2;
3. verify wheel type, metadata name/version, size, digest, and complete
   wheelhouse inventory;
4. create a new Python 3.12.10 virtual environment from the offline wheelhouse;
5. install with network disabled and dependency resolution disabled;
6. require `pip check` success and the exact 28-distribution runtime set;
7. import Accelerate and require `init_empty_weights` to be present;
8. generate the canonical v2 public environment lock from observed bytes;
9. update the numerical profile and source owner to bind exact v2 identities;
   and
10. rerun the real model-load diagnostic under another fresh scratch identity.

The installation must not mutate the v1 wheelhouse, bootstrap environment, or
runtime environment. No v1 executable is a fallback after v2 activation.

The canonical public lock is
`contracts/vnext/qwen3-numerical-oracle-environment-lock.v1.json`, 30,920
bytes at SHA-256
`4102fddd538a5a14d52c543a28a856dc61e95e978d2085b58f449f3be5250ae2`.
It records:

- 31 wheels totaling 258,926,452 bytes at closure SHA-256
  `b13ee2929e033b4126584fdaf788efd892ab5e48812748793708fa9914f88b2b`;
- four bootstrap distributions and 170 bootstrap files totaling 7,865,313
  bytes;
- 28 runtime distributions and 17,650 runtime files totaling 1,381,216,858
  bytes; and
- runtime closure SHA-256
  `fd6b647255c2d4c1294100946fce3c71abfd306ba5b173534ca5fe3b9c2933d4`.

Offline `pip check` passed, the observed distribution inventory was exact, and
`accelerate.init_empty_weights` was callable. Those checks establish closure
health, not model execution by themselves.

## Model-Load Result

One fresh nonmaterial diagnostic then revalidated the complete installed
closure, rehashed all nine pinned source files, constructed the local
Qwen3-0.6B model with `trust_remote_code=False`, and validated the public model
configuration. It exited 0, observed exactly one admitted IPv6 loopback
capability bind, created no trace output, used no retry, and consumed no
registered one-shot execution authority.

The active bounded result for the sole current source-owner contract is
`contracts/vnext/qwen3-model-load-diagnostic-result.v2.json`, 2,919 bytes at
SHA-256
`815dc5e38a431c9ccb578dacc2452ae54e193e41747b4507752d99b4a86c036a`.
The preceding v1 result remains immutable historical evidence at 2,919 bytes
and SHA-256
`0bb72f882befe2b2fe521c749872eb628729a6ab21559cb1e5d5fb64bbc7b2d4`;
it is not an executable compatibility route.
The real model-load diagnostic passed. This proves only pinned local model
construction under the corrected environment and isolation contract.

## Test-First Contract

`tinyrustlm/tests/qwen3-model-load-environment-closure.test.js` was run red
before the implementation. It requires:

- exact source-owner pins for Accelerate and psutil;
- exact authority and lock profile identity `/2`;
- 28 exact runtime distributions and 31 exact wheels;
- profile binding of both package versions and all v2 closure identities;
- no fallback runtime; and
- explicit documentation that v1 is evidence, not compatibility support.

The general numerical environment tests must continue to verify every wheel,
installed file, RECORD entry, distribution, interpreter binary, bootstrap
file, closure digest, and profile cross-reference. Merely importing Accelerate
is not an environment pass.

## Claim Boundary

The root cause is corrected, the v2 environment is sealed, and the real
model-load diagnostic passed. No source trace or numerical proof arrow has
passed. Browser-WASM, browser chat, behavioral quality, P2P, publication, and
MemoryEndpoints continuity remain unproven.

Campaign counters remain exactly `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
