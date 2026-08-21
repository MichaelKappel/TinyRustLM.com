# TinyRustLM Qwen3 Holdout Custody Memory

Date: 2026-08-20  
Recorded UTC: 2026-08-21T02:19:58Z  
Status: control path implemented; private authoring incomplete  
Branch: `codex/model-acquisition-v2`  
Implementation commit: `6928023fb2931b790cea78d2755cc522bdf83d64`

## Claim Boundary

This checkpoint closes the missing mechanical path between the preregistered
Qwen3 holdout policy and a future private factor pack. It does not establish
that any private holdout case has been authored, independently audited,
assembled, sealed, or used. It grants no curriculum acceptance, semantic-audit
pass, training authorization, adapter, merged model, untouched quality pass,
SLM2 model conversion, runtime result, browser result, release, deployment,
publication, MemoryEndpoints operation, or campaign progress.

The campaign counters remain:

- qualified models: 0/20;
- clean browser rounds: 0/50;
- live MemoryEndpoints continuity rounds: 0/25;
- externally proven lanes: 0/40;
- announced models: 0/20.

## Source-Control Identity

Implementation commit
`6928023fb2931b790cea78d2755cc522bdf83d64` was pushed to
`origin/codex/model-acquisition-v2`. A fresh `git ls-remote` returned the same
full commit identity. The worktree was clean after the push.

The implementation commit contains these exact changed files:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `tinyrustlm/tools/qwen3-working-model-controls.py` | 127,079 | `37ae9c4068e6a1d55fa5ccf742eded44ad745e25b1026a16ccfaad420126f8de` |
| `tinyrustlm/tools/tests/test_qwen3_working_model_controls.py` | 43,172 | `4ceb1b23cde1aa8b8556df1ffa3d6233268cfea4510ba8d599296d957479f46e` |
| `tinyrustlm/training/qwen3-0.6b-working-model-v1/README.md` | 10,666 | `a1e6abf8e18918568d2b3e9854b3bfa4f959fdc67d12959a96d73d9190596672` |

The checked-in profile remains 11,426 bytes at SHA-256
`f5c3d7bfae351bb5ee84631c6fc8e7f00c02f2b705bdaef7de9472854df8ac5f`.
The unchanged `Qwen/Qwen3-0.6B` base remains terminally rejected as a product
model and is permitted only as ancestor bytes for a new derivative.

## Clean Custody Path

The control program now has six explicit commands:

1. `verify-profile`;
2. `initialize-holdout-custody`;
3. `assemble-holdout-contributions`;
4. `seal-holdouts`;
5. `audit-curriculum`;
6. `freeze-training-lock`.

There is no legacy direct-seal path. `seal-holdouts` now requires the assembled
factor pack, the private selection seed, and the public-safe custody receipt.
It rejects a correct-length but different seed and any factor-pack byte change
after assembly.

Initialization creates, outside Git on an allowed `C:` or `E:` root:

- one public-safe slot plan;
- one incomplete development contribution template;
- one incomplete independent-audit contribution template;
- one private 32-byte HMAC selection seed.

The templates contain empty authoring fields and carry
`status: authoring-required`. Assembly requires new complete contribution
files. It rejects the initialized templates themselves, so blank slots cannot
be converted into evidence.

Assembly requires:

- the exact current profile and control-program identities;
- exact slot coverage and order;
- 140 development and 140 independent-audit cases;
- all 20 cases per category;
- globally unique case and template-family identities;
- normalized-distinct prompt variants inside each case and across all cases;
- normalized-distinct answer-anchor variants inside each case;
- exact scenario-factor keys and the preregistered diversity floor;
- distinct development and independent author-identity hashes;
- distinct development and independent custody-domain hashes;
- create-only outputs outside the worktree;
- strict bounded UTF-8 JSON with duplicate-key and reparse-chain rejection.

Distinct hashes are necessary structural evidence. They do not by themselves
prove that two people, organizations, or custody environments are independent.
Authorized custody review remains required before an independent-audit claim.

## Authoritative External Plan

The current operator-local initialization is plan
`qwen3-working-model-holdout-custody-v5`. Its public-safe plan is 51,462 bytes
at SHA-256
`c1cca1f282b8a8221c66fec9ef6639fb6066469d484cd30348bd182b53476fdc`.

The plan binds:

- profile SHA-256
  `f5c3d7bfae351bb5ee84631c6fc8e7f00c02f2b705bdaef7de9472854df8ac5f`;
- control-program SHA-256
  `37ae9c4068e6a1d55fa5ccf742eded44ad745e25b1026a16ccfaad420126f8de`;
- slot-set SHA-256
  `88598e47e0dc1eead6714c0eb43d094071bc442854e71e34ae2fc80c0597eb82`;
- development template SHA-256
  `b942320b5f0984097fcb1a43b3965b168214dfb9f981f9163cafaf614707da62`;
- independent-audit template SHA-256
  `3044627f377ab26552285a895bb8249df5b6f5cbd4f0f20616b4c412a5306f0e`;
- seed commitment SHA-256
  `dfa20644a48b1ca594110934dc55e16529bef460205ccfda9074608ad6cfa212`;
- 280 total slots, 140 per split, and 10 per category per split.

The public plan has no `prompt_variants` field and reports
`contains_raw_prompts: false`, `contains_answer_anchors: false`, and
`contains_seed: false`. The private seed is exactly 32 bytes. Its raw bytes and
unprefixed file hash are intentionally not recorded here.

Both contribution templates remain incomplete. Consequently:

- no factor pack exists;
- no custody assembly receipt exists;
- no materialized private holdout exists;
- no 332-case exclusion index exists;
- no holdout seal exists.

Local initialization attempts `v1` through `v4` are preserved as invalidated
history. Their older or absent control-program identity makes them unusable by
the current validator. They are not aliases or compatibility inputs.

## Failure Preservation

The first custody implementation revealed two defects before check-in:

1. the sealer did not initially prove that the factor pack and seed came from
   the custody receipt;
2. initialization initially printed all 280 public slots to the terminal.

The final implementation removed the direct path, bound the custody receipt,
seed, factor pack, profile, and control-program bytes, and reduced CLI output
to bounded counts and commitments. The invalidated initialization directories
were preserved rather than overwritten or relabeled.

The real incomplete templates were also exercised through the assembly CLI.
They were rejected with `development holdout contribution status must be
complete`, and no output directory was created. This is expected fail-closed
evidence, not a failed product test.

## Verification

The final implementation passed:

- 28/28 focused Qwen3 working-model control tests;
- 153 maintained non-Torch Python tool tests, with nine declared skips;
- 68/68 `TinyRustLM.Package.Tests`, with zero skips;
- Python compilation for the changed tool and tests;
- Ruff 0.12.10 formatting and lint;
- `git diff --check`;
- exact external plan byte/hash readback;
- public-plan field scan proving zero raw prompt-variant fields.

Focused hostile coverage includes:

- existing output-root rejection;
- duplicate JSON-key rejection;
- unfinished contribution rejection;
- same-author rejection;
- same-custody-domain rejection;
- cross-custody prompt reuse rejection;
- foreign control-program rejection;
- tampered template-identity rejection;
- wrong seed-length rejection;
- correct-length but uncommitted seed rejection;
- post-assembly factor-pack mutation rejection;
- deterministic seal reproduction;
- public-receipt raw-text exclusion.

The previously retained optional-Torch discovery blocker remains an environment
fact: the active Python runtime lacks `torch`, so
`test_reference_raw_quality.py` cannot import its optional finite-top-k test.
This was not converted to a skip or pass. The changed custody scope does not
depend on Torch.

## Remaining Curriculum Integrity Gap

The curriculum record schema currently checks `reviewer_count >= 2`, review
decision hashes, factual disposition, and scan statuses. It does not yet reopen
and prove two underlying record-bound reviewer decision artifacts. Therefore a
caller could still self-assert the count in a syntactically valid curriculum
row.

Do not create a pilot training lock from that assertion. The next control-plane
change must require a complete, hash-bound review receipt with exact record
coverage, two distinct reviewer identities and decision artifacts per accepted
record, adjudication evidence for disagreements, exact candidate hashes, and
immutable rejected-record tombstones. No bulk approval or inferred review is
permitted.

## Exact Resume

Resume in this order:

1. Preserve implementation commit
   `6928023fb2931b790cea78d2755cc522bdf83d64` and external custody plan `v5`.
2. Obtain the development contribution and independent-audit contribution from
   genuinely separate authorized custody paths. Do not fill both as one actor
   and merely choose different hashes.
3. Assemble into a new external root and inspect only the public-safe receipt.
4. Seal the custody-bound factor pack with the committed private seed into a
   new external evidence root.
5. Add record-bound two-reviewer receipt enforcement before accepting any
   1,024-record pilot curriculum.
6. Materialize teacher drafts, complete explicit review, preserve all
   rejections, and issue immutable tombstones.
7. Run lexical, entity, template, answer, and complete blinded semantic audits
   against all 332 exclusions.
8. Freeze the exact source, environment, trainer, curriculum, audit, receipt,
   and stop-rule closure before training.

Only after those gates may the CPU LoRA pilot begin. Untouched source screening,
SLM2 conversion, scalar/native/WASM conformance, P2P-or-convert acquisition,
and genuine browser-local multi-turn chat remain later phases of the active
enterprise goal.
