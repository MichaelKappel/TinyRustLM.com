# Qwen3 Template2 Source-Parity Preregistration

## Status

This is the no-comparative-output registration checkpoint for exact
`Qwen/Qwen3-0.6B` publisher-template to Rust Template2 parity.

The execution and independent verification contracts were created before any
publisher-oracle render or candidate comparative render. A validation-only
preflight passed all identities and 1,024 cases without compiling or rendering
the publisher template. The registered observation output directory has not
been created.

This document records intent and immutable inputs. It is not a parity pass,
rejection, receipt, browser result, model result, or release claim.

## Registration Boundary

| Field | Registered value |
| --- | --- |
| Registration parent commit | `81a6d53844761d10c0eb1563b5420788c1772f8f` |
| Registration time | `2026-08-22T10:30:00Z` |
| Execution profile | 6,631 bytes; SHA-256 `c42f7dfb14b6861bd8db47dd1fbca590961ed573c69835556815cbe5cdef1051` |
| Verification profile | 5,030 bytes; SHA-256 `c61b9556b30fa3a82085d53a96b1e468fa1fa1a5cd81e7b92f961da1ad473095` |
| Attempt ID | `qwen3-template2-parity-20260822-v1` |
| Output directory name | `qwen3-template2-parity-20260822-v1` |
| Required source runs | 2 |
| Required candidate runs | 2 |
| Required verifier runs | 1 |
| Retry count | 0 |
| Prior output reuse | forbidden |
| Output creation | create-only |
| Comparative output at registration | none |

The registration becomes executable only after the exact checkpoint is
committed, pushed, fetched from a fresh remote view, and proven equal across
local HEAD, tracking ref, `FETCH_HEAD`, and actual remote branch.

## Frozen Source

The source is `Qwen/Qwen3-0.6B` revision
`c1899de289a04d12100db370d81485cdf75e47ca`.

The exact source lock is
`contracts/vnext/qwen3-0.6b-template2-source-lock.v1.json`, 1,580 bytes,
SHA-256
`22070f5f605a71580a928291e19fe06d7eb961531732c15f10735c2d677df660`.

The source template is the exact 4,168-byte UTF-8 `chat_template` value in the
9,732-byte pinned `tokenizer_config.json`. Its SHA-256 is
`a55ee1b1660128b7098723e0abcd92caa0788061051c62d51cbe87d9cf1974d8`.

The 726-byte model configuration has SHA-256
`660db3b73d788119c04535e48cf9be5f55bc3100841a718637ae695b442f27dd`.
Both source files are rehashed before and after source observation.

The accepted source call sets tools absent, adds a generation prompt, disables
thinking, and supplies only exact role/content string objects satisfying the
Template2 profile. Every broader publisher branch is outside this run.

## Frozen Template2 Candidate

The machine profile is 15,111 bytes with SHA-256
`14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa`.
The canonical 1,403-byte Template2 artifact has SHA-256
`5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8`.

The Rust candidate source closure contains exactly eight ordered files and has
SHA-256
`9bd0dd9209a57d0d9f72698689f15ebc3b3bc76dd833afc818b372920ad31f47`.

The runner source is 44,815 bytes with SHA-256
`2137995af18657a98351b95a77fee4552669f8fe2bebcf12f5a472aef1076ba4`.
The exact release executable is 387,584 bytes with SHA-256
`948d16894ffff63f39c4b5c31e61b7b6f8f004b8161f0bb4e29d40e6681ce51d`.

The candidate validates the complete preregistration, source lock,
environment lock, source closure, corpus, artifact, message grammar, limits,
and its own executable identity before rendering. It writes one create-only
bounded result and rehashes its dependencies after observation.

## Frozen Publisher Oracle

The publisher oracle is
`tinyrustlm/tools/qwen-template2-source-oracle.py`, 44,624 bytes, SHA-256
`e4dc5da1da8380ca47254b928ef5d252c903f88d3e96760cae134de5b431177d`.

The environment lock is 9,213 bytes with SHA-256
`f803927a2e1747a7130233c5a5847514b71603e71fc8c63cfff5eeaf1ef5d6f9`.
It binds Python 3.12.10, Jinja2 3.1.6, MarkupSafe 3.0.3, the launcher,
base interpreter, and a 44-file source closure with SHA-256
`0138606aefe81a2a6d1b19917ef0456f5dfc23b0bd4361d87b80638ed6801155`.

Execution uses isolated mode, disabled bytecode writes, a dedicated empty
pycache prefix, no network, no child process, no ctypes, and an immutable Jinja
sandbox. The oracle stores neither source template nor environment bytes in
the result.

## Frozen Corpus

`contracts/vnext/qwen-template2-parity-cases.v1.json` is 667,912 bytes with
SHA-256
`59febbdbec44cfcf92e233626fd7fb3fb140fd43dddee64e684837a7e76df99b`.

It has exactly 1,024 unique cases generated deterministically from seed
`6115e5fc9bd68e4045529cb12f3088398fa91005572b6c92c9fe17c6627e4e99`.
The 12,814-byte generator has SHA-256
`25f50232373fcf91a73bb91db464bb53624cf8ad8b5600263cc71e10a44bd791`.

The corpus includes messages only. It includes no rendered text, rendered
hex, rendered hashes, expected output, answer anchor, or candidate output.
Developers cannot choose a different seed or subset after observation.

Each case permits at most 16 messages, 32,768 UTF-8 content bytes per message,
and 65,536 total content bytes. Cases remain within the supported role branch
and exercise ordinary, Unicode, empty, whitespace, multiline,
template-looking, long, system, and multi-turn content.

## Observation Runner

The runner is
`tinyrustlm/tools/qwen-template2-parity-observation.js`, 14,268 bytes,
SHA-256
`c1721bed07baadeee65b3f1e918b40d07ba4d28f22c07663662680fdf2cfc4e9`.

It requires an existing private parent but requires the exact attempt output
directory to be absent. It creates the directory itself, creates two empty
oracle pycache directories, and runs exactly five child processes:

1. `source-oracle-1`;
2. `source-oracle-2`;
3. `candidate-1`;
4. `candidate-2`;
5. `verifier-1`.

The process count is five and the retry count is zero. Output paths are unique
and create-only. Empty pycache directories are removed before verification.
No pass receipt and terminal-failure receipt may coexist.

If any operation fails, the runner preserves all created raw files, writes a
bounded terminal-failure record when no pass receipt exists, and exits. The
attempt is terminal and must not be retried, repaired, overwritten, or
reinterpreted.

## Independent Verification

The verifier is
`tinyrustlm/tools/qwen-template2-parity-verifier.js`, 47,408 bytes, SHA-256
`a278d2a1d787d9adba4af2bc4d3eb8a622723f5f0feda4c449763d10c2820954`.

Its dependency closure has SHA-256
`be1906c577e1468f215e3809e90065d45782e8609586785ae356512d76eabb47`.
It runs under Node v24.14.0, whose 91,380,224-byte executable has SHA-256
`63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088`.

The verifier independently regenerates the corpus and Template2 artifact,
rehashes source, environment, candidate, profiles, raw files, and executable,
and requires exact input basenames.

It requires each pair of repeated producer files to be byte-identical. It
then compares exact case order, case IDs, rendered byte lengths, rendered
SHA-256 values, and exact rendered UTF-8 hex for all 1,024 cases.

JSON object member order is nonsemantic. JSON array order and every primitive
type and value are semantic. There is no normalization, output repair,
best-of-N, mismatch tolerance, or hidden retry.

On complete pass it creates one bounded receipt. The receipt includes no
message content, rendered text, rendered hex, private absolute path, or
mismatch record.

## Pre-Observation Verification

The preregistration tests pass all six focused cases. The deterministic vector
and corpus checks pass. Rust contract and vector tests pass. Rust format,
check, and warnings-denied Clippy pass.

The first validation-only preflight exposed a locale-aware Node versus ordinal
Python source-closure ordering defect. No source rendering occurred. The
environment generator was corrected to explicit UTF-8 bytewise ordering, the
lock and all transitive profile identities were regenerated, and a regression
requires malformed closures to fail with the registered typed error.

The final validation-only preflight passes all 1,024 cases and all registered
identities. Its dedicated pycache directory remains empty. No comparative
output file exists.

## Execution Preconditions

Before observation, all of the following must be objective facts:

- the worktree contains this exact registration;
- tests and repository audits pass;
- the registration commit is pushed;
- fresh remote branch identity equals local HEAD, tracking ref, and
  `FETCH_HEAD`;
- every registered file and executable rehashes exactly;
- the pinned source files rehash exactly;
- the external parent is owned and outside Git;
- the exact attempt output directory does not exist;
- the two dedicated pycache paths do not exist;
- no prior attempt output is reused.

Only then may the observation runner be invoked once.

## Claim Boundary

This checkpoint proves that one exact parity experiment is registered and
ready for source-control freezing. It does not prove that the source and Rust
renderers agree.

No model, quality, browser, acquisition, release, deployment, publication,
MemoryEndpoints, or campaign claim follows. Campaign counters remain 0/20,
0/50, 0/25, 0/40, and 0/20.
