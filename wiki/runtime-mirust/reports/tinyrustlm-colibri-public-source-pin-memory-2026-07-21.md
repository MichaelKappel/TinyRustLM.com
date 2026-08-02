# TinyRustLM Colibri Public Source Pin Memory

Date: 2026-07-21 (Pacific)

## Disposition

The public Colibri repository was cloned solely for direct source review,
outside TinyRustLM and every project repository. No Colibri source, model byte,
build output, dependency, or generated artifact was copied into TinyRustLM or
its Git history.

This pin strengthens the existing Colibri research intake. It does not adopt
Colibri, prove compatibility with `.slm`, authorize a runtime dependency, or
turn author benchmarks into TinyRustLM measurements.

## Public Identity

- Repository: `https://github.com/JustVugg/colibri.git`
- Commit: `44e489b196c9b7876b3d37a0570ebf1c6f90f54c`
- Git tree: `faae3d9594319ab856a4c3dd3f69a3afdd71f348`
- Commit timestamp: `2026-07-21T19:04:16+02:00`
- Checked-out source files excluding `.git`: 185
- License: Apache License 2.0
- `LICENSE` SHA-256:
  `1eb85fc97224598dad1852b5d6483bbcf0aa8608790dcc657a5a2a761ae9c8c6`
- `README.md` SHA-256:
  `98b61d0cbda93842e115b645cb108891d26f276fe72bf38960dcfb87882fb3bc`

The checkout was clean when pinned. Future review must name a new immutable
commit and tree rather than silently following the default branch.

## Directly Observed Source Facts

At the pinned revision, `README.md` describes GLM-5.2-specific MoE placement:
the dense portion remains resident, while 19,456 routed experts remain as an
approximately 370 GB disk set and are streamed through LRU, pinned RAM, and
optional VRAM tiers. The same section states the intended default invariant:
placement changes speed, while router decisions and weight precision remain
the same whether an expert is resident or read from disk.

`c/resource_plan.py` independently accounts for hot VRAM, warm RAM, and cold
expert bytes on disk. This is a resident-memory and I/O placement design. It
does not remove the logical expert set or make the complete model artifact
smaller.

`docs/CACHE_ROUTE.md` and `docs/ENVIRONMENT.md` define `CACHE_ROUTE=0` as the
default. When explicitly enabled with `CACHE_ROUTE=1`, cache-aware max-rank
routing can substitute resident experts within a wider candidate window. The
document says this can change which experts run, exposes agreement and KL
telemetry, and says the mode must remain experimental until quality gates pass.

Therefore two distinct hypotheses must never share one quality claim:

1. default placement/cache residency, which is intended to preserve the chosen
   expert IDs while changing where their bytes are served from; and
2. cache-aware routing, which intentionally may change chosen experts and must
   receive a separate untouched-output quality and regression gate.

The pinned source also contains native C/CUDA/Metal, Python tooling, a desktop
surface, and a web UI. That implementation breadth is not evidence that its
GLM-5.2 tensor layout, loader, router, quantization, or memory hierarchy is
portable to TinyRustLM's compact dense browser models.

## TinyRustLM Boundary

Useful transferable ideas are limited to architecture-independent questions:

- immutable module identity;
- explicit disk, RAM, and VRAM byte accounting;
- bounded hot/warm/cold placement plans;
- measured cache hit and I/O behavior;
- prefetch that does not alter semantic routing;
- fail-closed admission of independently loadable trained modules; and
- separate quality gates for any optimization that changes selected compute.

Rejected inferences remain:

- arbitrary dense layers, heads, tensor rows, or byte slices become useful
  specialists merely because Colibri streams trained MoE experts;
- lower resident RAM means fewer complete model bytes;
- physical deduplication lowers logical execution bytes;
- `CACHE_ROUTE=1` is quality-neutral;
- a model-level specialist router is token-level MoE routing;
- KV cache can cross model or adapter composition identities; or
- public Colibri speed figures predict TinyRustLM browser or native results.

## Required Local Evidence Before Any Adoption

Any future TinyRustLM placement experiment must begin with an admitted
architecture whose modules were trained to be independently routable. It must
preregister:

- exact source, model, tokenizer, module, quantization, and router identities;
- complete logical, standalone, incremental, physical, resident, KV, scratch,
  and peak byte categories;
- unchanged-routing placement versus routing-changing optimization as separate
  arms;
- raw output preservation and broad-helpfulness noninferiority;
- target-native and real-browser latency, throughput, memory, and energy;
- cold, warm, and eviction/reload behavior; and
- explicit champion fallback without hidden best-of-N retry.

Until those receipts exist, Colibri remains pinned public research only. The
standing pre-release rule permits a clean TinyRustLM redesign if evidence later
supports one; it grants no reason to retain weak compatibility or import a
third-party runtime prematurely.
