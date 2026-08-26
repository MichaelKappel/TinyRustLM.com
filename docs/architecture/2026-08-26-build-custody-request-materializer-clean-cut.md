# Build-Custody Request Materializer Clean Cut

Date: 2026-08-26

## Decision

`tinyrustlm/tools/build-custody-request-materializer.js` is the sole current
prelaunch path for converting a canonical private materialization intent into
one canonical `tinyrustlm.build-custody-request.v4` file. It replaces the ad
hoc object transformation that closed technical execution `/11`. The old
transformation is not retained as a compatibility route, fallback, migration,
repair utility, or alternate implementation.

TinyRustLM remains one unversioned prelaunch product. The `/1` materializer
profile and `/4` custody request labels are technical contract identities, not
product generations. There is no launched predecessor to support and no
authorization for debt.

The normative materializer profile is
`contracts/vnext/build-custody-request-materializer-profile.v1.json`. Its
source-controlled tool, profile, tests, and this decision record must be bound
by exact byte identities in every future one-shot registration that uses the
materializer.

## Preserved Failure Authority

Technical execution `/11` remains immutable terminal history. Its create-only
managed request contained the correct `ownerByteLength` and `ownerSha256`
fields plus unexpected sibling `byteLength` and `sha256` fields under
`source`. The real custody owner correctly rejected the request with
`build-custody-source-fields` before creating a root or launching a process.

The canonical result and detailed postmortem are:

- `contracts/vnext/qwen3-real-composition-execution-result.v11.json`; and
- `docs/architecture/2026-08-26-qwen3-real-composition-execution-v11-managed-preflight-rejection.md`.

The materializer does not alter, translate, repair, reissue, or adopt any
`/11` byte. The malformed `/11` shape is preserved as a generic negative
regression. A successor operation must have a new registration and wholly new
private identities.

## Input Contract

The input schema is
`tinyrustlm.build-custody-request-materialization-intent.v1`. The input must be
one canonical UTF-8/LF JSON object with the exact top-level order:

1. `schema`;
2. `operationId`;
3. `profile`;
4. `source`;
5. `runtime`;
6. `environmentAuthority`;
7. `scratchInspection`;
8. `command`;
9. `roots`;
10. `capture`;
11. `termination`; and
12. `outputs`.

Every nested object and array has an exact closed shape. Unknown, missing,
reordered, duplicate, noncanonical, oversized, malformed, or trailing input
is rejected. The intent contains private absolute paths and therefore remains
outside Git. Its path is a CLI input, never data taken from a model or public
website.

Artifact identities are nested in the intent so their semantic role is
unambiguous. For example, `source.git` and `source.owner` are distinct
`path`/`byteLength`/`sha256` objects. The materializer does not infer a target
field from a sibling name or recursively rewrite object keys.

## Explicit Mapping

The materializer constructs a new request object through named field maps. It
does not use input or output object spread, `Object.assign`, recursive string
replacement, key suffix substitution, or a permissive generic flattening
function.

The source map is exactly:

| Intent field | Request field |
| --- | --- |
| `source.git.path` | `source.gitPath` |
| `source.git.byteLength` | `source.gitByteLength` |
| `source.git.sha256` | `source.gitSha256` |
| `source.owner.path` | `source.ownerPath` |
| `source.owner.byteLength` | `source.ownerByteLength` |
| `source.owner.sha256` | `source.ownerSha256` |

Runtime, command-executable, and termination-executable artifact identities
use equally explicit maps. Closed nested objects such as environment evidence,
roots, capture bounds, and required outputs are copied field by field after
exact-key validation.

Before any output write, the resulting object is passed to the real
source-controlled `build-custody-owner.js` request-shape validator. The
materializer does not maintain a second looser request definition and does not
turn rejection into coercion.

## Output And Failure Semantics

The output path is a dedicated CLI argument. Its immediate parent must already
exist as a direct directory and the output itself must be absent. The request
is serialized once as canonical UTF-8/LF JSON and written create-only with a
file flush. Existing output is never overwritten, merged, resumed, repaired,
or selected as an alternate success.

Successful stdout is a bounded public-safe summary. It contains the operation
ID, profile identity, intent and request byte identities, and only the output
basename. It never emits the private output path or request bytes. Failure
stderr is a bounded typed code with no private path. Neither stream authorizes
retry or campaign credit.

Materialization proves only that one exact request file was created from one
exact intent through the current profile and passed the producer's syntactic
request validator. It does not prove that custody preflight opened and
recomputed referenced artifacts, that a child process ran, or that a build
passed. The materializer summary therefore fixes all of these claims to
`false`:

- `custodyPreflightPassed`;
- `custodyExecuted`;
- `campaignCreditAuthorized`.

The file flush records the observed file barrier. This stage does not inflate
that observation into a portable directory-durability or machine-crash claim.

## Verification

The focused test suite freezes the materializer profile and tool identities,
checks every explicit artifact map, preserves the `/11` malformed shape as a
negative case, rejects unknown and reordered fields, rejects stale profile
identity, proves create-only canonical output, and exercises the actual CLI's
path-free success and failure streams.

The existing custody-owner suite adds an independent integration boundary. It
materializes a known valid synthetic intent, proves the bytes equal the known
valid request, then passes those bytes through the real custody owner's full
read-only preflight against ephemeral authority files. The three registered
future roots remain absent. This is test-fixture evidence only and cannot be
counted as a real build.

All future use requires affected tests, the complete standard partition, a
clean worktree commit, push, and four-way remote equality. A successor
registration must bind the exact materializer profile, tool, tests, custody
profile, custody owner, source commit/tree, and all private logical names
before any private successor material is created.

## Research And Durable Memory

This correction applies the executable-contract, exact-field, fail-closed,
immutable-history, and one-shot-custody recommendations from:

- `docs/report-intake/2026-08-26/post-v10-native-browser-release/MANIFEST.md`;
- `docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-synthesis-2026-08-26.md`;
- `docs/report-intake/2026-08-26/post-v10-native-browser-release/tinyrustlm-post-v10-native-browser-release-intake-tdd-delta-2026-08-26.md`; and
- `wiki/runtime-mirust/reports/tinyrustlm-post-v10-native-browser-release-intake-memory-2026-08-26.md`.

Those external reports are advisory inputs, not evidence that this private
implementation was built or tested. The exact local gates and committed
identities are the implementation evidence.

## Claim Boundary

This clean cut proves no real model conversion, composition acceptance,
source/native parity, native inference, browser WASM, browser conversation,
quality qualification, P2P availability, catalog announcement, package or
site publication, deployment, or MemoryEndpoints behavior. Campaign counters
remain exactly `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
