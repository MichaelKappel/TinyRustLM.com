# Qwen3 Real Composition Execution /5 Source-Anchor Invalidation

Date: 2026-08-25

Status: terminal prelaunch failure before private materialization

## Decision

Qwen3 real composition execution `/5` is closed without a build or converter
invocation. Its registration required both custodied builds and the composition
controller to bind the exact pushed registration commit and tree. Before the
first private request was created, the remote branch advanced by one
documentation-only commit. The registration commit remained an ancestor but
was no longer the current remote tip.

That difference is intentionally terminal. The exact source anchor is an
evidence boundary, not a comparison of whether an intervening change appears
harmless. Rewinding the public branch, disguising the current tree, using a
different remote, or weakening the registration would manufacture compliance.
None is allowed.

## Exact Observation

The `/5` registration is the remote-exact commit
`307b94009342e76974ccdc19e56a9e1f7f9788d1`, tree
`76a73ebf4ea34adf72617f95033e56f611b5a8da`. It is a single-parent child of
the registered parent and changes only the four permitted registration paths.

At pre-materialization revalidation, the current local, tracking,
`FETCH_HEAD`, and direct remote branch identity was
`81631d0b5bd2f23c5defc17e7027884bdce0be86`, tree
`e82a38ba1ff708eef30058da69619b7e5b5f43f4`. The only intervening path was:

`docs/research-prompts/2026-08-25-twelve-disconnected-post-composition-first-model-clean-cut-research-prompts.md`

No executable sentinel changed. That fact does not satisfy the stronger exact
commit-and-tree registration rule.

## No Private Operation Occurred

All nine registered `/5` private logical names were absent when the source
anchor mismatch was observed. No private Rust custody request, Rust custody
control root, Rust target root, managed custody request, managed custody
control root, managed target root, composition request, controller evidence
root, or composition output root exists.

Consequently:

- Rust custody preflight and execution counts are zero;
- Rust build attempts are zero;
- managed custody preflight and execution counts are zero;
- managed build attempts are zero;
- controller and converter invocation counts are zero;
- managed inspection count is zero; and
- no private binding, model member, composition, pass, or rejection exists.

No cleanup is required or authorized. The unused `/5` logical names remain
bound to this closed registration and cannot be reassigned.

## Public Result

`contracts/vnext/qwen3-real-composition-execution-result.v5.json` is the
bounded public-safe terminal record. It identifies the registration, current
source observation, one intervening public path, absence of all material
operations, terminal decision, false claim boundary, and unchanged campaign
counters. It contains no absolute local path, credential, prompt, or model
content.

The result status is `terminal-prelaunch-failure` with reason
`registration-commit-no-longer-remote-tip-before-private-materialization`.
Registration itself remains a true historical fact; it does not imply that a
real conversion was attempted.

## Next Attempt

A later attempt requires:

1. a wholly new source-controlled preregistration based on the then-current
   clean remote-exact branch;
2. a new technical execution identity;
3. six new private root names and three new request filenames;
4. a registration-only commit pushed and freshly remote-verified before any
   private materialization; and
5. no intervening commit between that registration and both builds plus the
   composition controller.

The source-controlled build custody owner remains the required implementation.
The current product is still one unversioned prelaunch product. Attempt `/5`
and a later attempt number are evidence identities, not product generations.
No legacy support, compatibility path, migration, fallback, retry, repair,
best-of-N, or debt is created by this closure.

## Claim Boundary

This record proves only that `/5` was registered and then honestly closed
before private materialization because its exact remote source anchor was no
longer current. It does not prove conversion, structure, source-framework
parity, native inference, browser-WASM inference, browser chat, model quality,
P2P availability, catalog announcement, package publication, deployment,
MemoryEndpoints continuity, or campaign credit.

MemoryEndpoints remains unauthorized. Campaign counters remain `0/20`,
`0/50`, `0/25`, `0/40`, and `0/20`.
