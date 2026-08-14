# TinyRustLM vNext Campaign Control Plane

## Status

This document is the maintained operator and architecture entry point for the
clean-slate TinyRustLM campaign control plane as of 2026-08-11. The sole local
release and publication path is vNext. The repository retains no second
mutable release path, compatibility wrapper, migration reader, deprecated
command, or fallback authority.

The local cutover is implementation evidence only. It does not prove a model
qualified, a browser profile was deleted, MemoryEndpoints continuity ran, an
outside observer transferred model bytes, a catalog announcement became
public, a package executed on physical target hardware, or production HTTPS
served an authorized release. Current campaign counts remain exactly `0/20`,
`0/50`, `0/25`, `0/40`, and `0/20`.

## Canonical Boundaries

The maintained path consists of these incompatible vNext boundaries:

- `tinyrustlm/tools/vnext-campaign-runner.js` owns exact two-pass observation
  of the campaign receipt and public-subject stores and invokes the generated
  Rust/WASM evidence boundary.
- `tinyrustlm/tools/vnext-campaign-release-surface.js` is the only release
  consumer. It owns fresh projection, attestation, operator status, release
  preparation, authority verification, deployment admission, readback,
  publication planning, and final publication admission.
- `tinyrustlm/tools/vnext-site-publication.js` is the pure deterministic
  pointer, history, and published-claim materializer used only behind the
  release surface.
- `tinyrustlm/tools/vnext-public-https-readback.js` is the only production
  network verifier. It owns DNS and HTTPS and accepts no caller transport or
  success verdict.
- `tinyrustlm/tools/vnext-receipt-store.js` and
  `tinyrustlm/tools/vnext-subject-store.js` provide bounded create-only stores
  whose targets activate only through exact content-addressed durability
  markers and verified helper-backed directory flushes.
- `tinyrustlm/tools/vnext-public-safe-redaction.js` validates every selected
  public document before its receipt or subject can be persisted.

The frozen profiles are:

- `contracts/vnext/campaign-runner-profile.v1.json`, SHA-256
  `b0ba96ea2aa25112adea781138a4351511c56372bd1fdc04575e529a2b4720a9`;
- `contracts/vnext/campaign-release-surface-profile.v1.json`, SHA-256
  `100d72ee201b395820aa11aa5b4f8f23befdbf0fffb515dda385fb826cc6fcff`;
- `contracts/vnext/site-publication-profile.v1.json`, SHA-256
  `d959ce557e8b18a71514e2388a8eda7162182e38f5febf2e1a39b063fa5ba4bc`;
- `contracts/vnext/public-https-readback-profile.v1.json`, SHA-256
  `a5d5fd2bcc08e1444f82c474e1c829ba8e108c53a0e52b0651cab1843d8edb73`.

Detailed authority is in:

- `docs/architecture/vnext-campaign-runner.md`;
- `docs/architecture/vnext-campaign-release-surface.md`;
- `docs/architecture/vnext-site-publication.md`;
- `docs/architecture/vnext-public-https-readback.md`;
- `docs/architecture/vnext-contract-inventory.md`; and
- `docs/architecture/vnext-contract-threat-review.md`.

## One Truth Graph

The current graph is forward-only:

```text
campaign plan + complete current stores
  -> fresh runner start record
  -> Rust-backed projection artifact
  -> runner terminal record
  -> campaign attestation receipt
  -> public-safe scan receipt
  -> derived operator status bytes
  -> release manifest candidate
  -> current release-authorizer signature receipt
  -> static deployment-attempt receipt
  -> exact static production-readback receipt
  -> site-publication plan receipt
  -> current site-publisher signature receipt
  -> deterministic pointer/history/claim candidates
  -> generated-deployment attempt receipt
  -> exact static-plus-generated readback receipt
  -> create-only published-claim prefix
  -> final site-publication commit receipt
```

Every persisted receipt and public subject is content-addressed and
create-only. The release manifest cannot point to its later authorization,
deployment, readback, or publication descendants. Generated documents cannot
point backward in a way that makes their own identity cyclic.

## Fresh Projection And Operator Truth

The release surface constructs the runner internally. A caller cannot provide
projection bytes, select a receipt subset, reuse an operation, inject counters,
or submit a completion verdict. The runner observes every active receipt and
subject twice and rejects membership, byte, identity, profile, aggregate-size,
or plan drift. Rust owns plan validation, currentness, authority eligibility,
objective counting, and projection validation.

Operator status is a bounded derived return value. It is not a mutable file,
current pointer, release authority, or deployment claim. An honest empty
campaign produces zero counts and an incomplete status. Tests cannot convert a
fixture, synthetic capacity case, local loopback run, or package build into a
live campaign result.

## Release And Publication Admission

Release preparation is allowed only from a complete fresh projection and
exact current release parents. It binds qualified artifacts, packages,
approved claims, SBOM, provenance, changelog, public origin, web build,
security headers, publication generator, static assets, generated publication
descriptors, retired routes, and remaining risk codes.

Release authorization reconstructs those parents from disk and requires one
current eligible Ed25519 `release-authorizer` signature. Deployment admission
records an attempt only. Production success remains unproven until the sole
network verifier reads every expected static byte and header from the public
origin.

Site publication then requires one current eligible Ed25519 `site-publisher`
signature over a deterministic plan. Generated pointer, history, and claim
bytes remain candidates until an external deployment attempt is admitted and
the complete static-plus-generated inventory is read back exactly. Finalization
reconstructs the graph again, persists an exact claim prefix, and writes the
final publication receipt last. An interrupted prefix is inert and may resume
only from byte-identical stored state.

## Persistence And Recovery

The current stores use bounded canonical JSON, no-follow path checks,
same-directory temporaries, file synchronization, create-only publication,
exact readback, and quarantine for invalid entries. Operation history is
append-only. A process interruption can leave a valid incomplete prefix, but
cannot create a mutable pass or authorize a later phase.

The Win32 directory-flush helper, bounded ZIP/tar-gzip admission authority,
and module-issued protected equality-custody contract are integrated into the
current local vNext paths. Those contracts prove bounded local conformance,
not production operation. Gate D still requires controlled physical
power-loss/filesystem evidence, current native helper provenance and clean
consumers for every supported RID, an authorized production custody issuer and
private loader, and the declared OS process/network isolation. One maintained
structured archive target and frozen 29-seed hostile corpus now replay locally;
hosted sanitizer execution, longer campaigns, and retention/minimization of
future crash findings remain open. Deterministic cross-format, path,
every-prefix, and single-bit mutation properties now pass locally, but no
production durability or release claim may exceed that evidence.

## Completion Predicate

Final completion requires all of the following current evidence at once:

- 20 distinct quality-qualified model artifact hashes;
- 50 deletion-backed multi-turn browser round receipts;
- 25 authorized live MemoryEndpoints continuity and cleanup receipts;
- 40 unexpired outside-network complete-transfer lane proofs;
- 20 current live catalog announcements;
- package-consumer and physical `win-x64`, `linux-x64`, and `linux-arm64`
  execution evidence, with physical ARM64 distinguished from emulation;
- complete supply-chain, secret-scan, SBOM, provenance, signing, deployment,
  and public HTTPS readback evidence;
- synchronized public documentation and claims; and
- one final attestation whose complete ancestry reconstructs successfully.

Missing external authority or infrastructure remains a typed blocker. It is
never a skip, mock, warning-level pass, or reason to lower a threshold.

## Historical Evidence

Pre-vNext hash-addressed receipts remain under
`artifacts/reports/dogfood-campaign-evidence-2026-07-15/receipts/sha256/` as
inert audit history. They are not read by a maintained vNext tool and cannot
satisfy a current gate. Rebuildable aliases, snapshot trees, old schemas,
dedicated old tests, and the superseded production modules were deleted during
the incompatible cutover.

## Verification Commands

The maintained local gate includes:

```powershell
npm --prefix tinyrustlm run test:vnext-release-cutover
npm --prefix tinyrustlm run test:vnext-campaign-release-surface
node --test tinyrustlm/tests/vnext-site-publication.test.js
npm --prefix tinyrustlm run test:unit
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
git diff --check
```

All deterministic vNext generators must reproduce checked-in bytes. A local
green gate authorizes a source-control checkpoint only. Production publication
still requires the independent deployment and exact readback gate.
