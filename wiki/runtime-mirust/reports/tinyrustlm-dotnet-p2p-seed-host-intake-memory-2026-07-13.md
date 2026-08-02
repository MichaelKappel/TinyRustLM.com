# TinyRustLM .NET P2P Seed Host Intake Memory

## Read This When

Read this memory before changing the downloadable companion, Rust native ABI,
NuGet/tool layout, self-contained archives, fleet topology, piece serving,
resumable import, external reachability, service lifecycle, model provenance,
MiniModel catalog claims, or browser-companion boundaries.

## Authority Routes

- Manifest: `docs/report-intake/2026-07-13/dotnet-p2p-seed-host/MANIFEST.md`
- Synthesis: `docs/report-intake/2026-07-13/dotnet-p2p-seed-host/tinyrustlm-dotnet-p2p-seed-host-intake-synthesis-2026-07-13.md`
- TDD plan: `docs/report-intake/2026-07-13/dotnet-p2p-seed-host/tinyrustlm-dotnet-p2p-seed-host-intake-tdd-plan-2026-07-13.md`

The twelve reports are research input. Current source, Rust contracts, exact
artifact hashes, and executed tests take precedence.

## Current Contract

- TinyRustLM.com is the chat UI; MiniModel.org is catalog/discovery; the companion imports, stores, validates, and serves pieces.
- Rust remains authoritative for `.slm`, manifest, piece, Merkle, assembly, receipt, external-proof, and announcement trust.
- The fleet has exactly two lane processes total, not forty processes. Each lane has one endpoint for every admitted model, up to 20 models.
- Both lanes share one read-only artifact/piece store and retain distinct process, endpoint, proof, and shutdown identities.
- Model bytes travel directly between known consenting peers. Project sites and MemoryEndpoints carry no model bytes.
- Public eligibility requires external reachability evidence; loopback and LAN are local health only.
- Imports verify every piece through Rust, assemble invisibly, verify the full `.slm`, atomically promote, and revalidate a receipt before runtime exposure.
- Resume/config/log/receipt state contains no persisted credentials.
- Runtime fixtures stay `runtime-smoke-only`; the current useful Qwen boundary is `conversation-proven`, not full assistant quality.

## Release Decisions

- Keep the current `net8.0` implementation unless measured requirements justify migration.
- Keep synchronous in-process ABI calls for bounded validation/inspection and Rust subprocess isolation for long imports/servers.
- Produce NuGet library/tool packages plus separate multi-file self-contained archives for `win-x64`, `linux-x64`, and `linux-arm64`.
- Require portable PDB, SourceLink, `.snupkg`, exact dependencies, content allowlists, checksums, SBOM/provenance records, clean consumers, and actual target execution.
- Preserve local feed history transactionally. Do not publish to NuGet.org without explicit human authorization.

## Rejected Shortcuts

- Forty lane processes, one process pretending to be two lanes, or per-lane model duplication.
- Loopback as public proof, reusable proof receipts, fake peer health, project-site byte proxying, or fixture announcements.
- C# reimplementation of Rust trust decisions.
- Marking a piece complete because it exists, mixing mismatched peers, or exposing partial assembly.
- Automatic router/firewall changes, broad remote control, embedded credentials, or model deletion on uninstall.
- Treating popularity, parameter count, structural validity, or one prompt as model-quality proof.
- Hiding duplicate output instead of making one response render exactly once.
- Claiming signatures, SLSA, service execution, ARM64 support, deployment, or publication without the corresponding evidence.

## Implementation Order

1. Complete package/tool/archive hardening and clean consumer evidence.
2. Re-prove the exactly-two-lane fleet and strict Rust serving surface.
3. Extend crash-safe resumable import around the existing Rust subprocess authority.
4. Harden service install/control, rolling updates, and bounded diagnostics.
5. Add signed external-proof and announcement lifecycle drills.
6. Keep secure browser bridge, MiniModel catalog UX, and active-conversation behavior as explicit subsequent slices that preserve the locked UI.

## Quality And Test Boundary

There is no test weakening. Target execution cannot be replaced by file-header
inspection, external proof cannot be replaced by local health, duplicate
responses cannot be hidden while two writers remain active, and package/feed
history cannot be deleted to make a release look clean.

## Truth Boundary

This node records corrected decisions from the July 13 report intake. It does
not claim production signing, public external-proof receipts, live catalog
publication, completed browser pairing, or NuGet.org publication.
