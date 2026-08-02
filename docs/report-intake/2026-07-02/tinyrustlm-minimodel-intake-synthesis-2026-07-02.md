# TinyRustLM / MiniModel Intake Synthesis - 2026-07-02

This synthesis routes six authorized reports from `TinyRustLM.com/agent-file-handoff/Improvement` into the active TinyRustLM Rust workspace.

## Durable Requirements

- TinyRustLM.com must stay browser-local. Users run models only after importing a local `.slm` through the browser file picker or after Rust has fetched, assembled, verified, and receipted a peer transfer into a local `.slm`.
- Project servers must not run, proxy, host, relay, or serve user model bytes. This applies to TinyRustLM.com, MiniModel.org, MiniModel.MiRust.com, MiRust.com, and retired redirect domains.
- First-run UX must not show fake chat messages or imply the app is ready without a model. The beginner path should focus on `Import Local Model`, then reveal chat after Rust/WASM validation succeeds.
- Hugging Face rows are external metadata and model-card/source discovery only. The truthful fallback is `Start Conversion`, backed by a local `minimodel.huggingface_conversion_request.v0` plus `.tinyrustlm-convert.ps1`.
- The local conversion script should use one Rust packer command, `convert-huggingface-request`, against a user-owned `.safetensors` path. It must not download Hugging Face `/resolve/` bytes, use project-owned tokens, or call project proxy endpoints.
- A successful conversion should produce a checksum-bound `.slm`, sidecar manifest validation, and `tinyrustlm-conversion.receipt`, then run MiniModel `prepare-peer-share` and `write-catalog-snapshot`.
- `P2P Import` is valid only when MiniModel metadata names an admitted `.slm` with peer-offer proof and either a catalog-listed consenting peer source or a user-supplied known peer URL.
- Proof-ready metadata without a peer URL must remain honest. The new MiniModel `add-peer-source` command is the accepted late-publication step for turning a proof-ready entry into a P2P-ready catalog entry without rerunning conversion or hosting bytes.
- MiniModel.MiRust.com must document `.slm`, manifests, verifier commands, peer-source metadata, source lanes, legal boundaries, and P2P roadmap details deeply enough for humans and agents.
- Advanced controls and raw diagnostics belong behind progressive disclosure. Beginner UI should avoid cryptographic fields, JSON manifests, CLI command chains, and dense side panels until they are needed.

## Accepted Near-Term Implementation Direction

- Keep the current direct known-peer HTTP piece path as the early bridge: `prepare-peer-share`, `serve-peer-pieces`, `fetch-peer-pieces`, `assemble-peer-pieces`, `import-peer-request`, `write-catalog-entry`, `add-peer-source`, and `write-catalog-snapshot`.
- Keep peer networking as a phased roadmap. Iroh and `iroh-blobs` are the strongest later research candidate because they are Rust-first, content-addressed, QUIC-oriented, and more focused than full libp2p. Rust-libp2p remains a mature but heavier option. Pear/Bare/Hypercore remain reference ecosystems, not core dependencies.
- Add docs and tests that prove metadata-only publication does not imply project-hosted model bytes.
- Prefer state labels that describe the physical operation: reading local file, analyzing model structure, verifying checksums, preparing peer metadata, ready, or unverified artifact. Do not call metadata-only matches "compatible" until Rust verification has actually passed.

## Claims To Treat As Aspirational

- Browser-side range reads of Hugging Face `.safetensors` headers are not accepted for the current app because the present boundary avoids Hugging Face model-byte `/resolve/` access from the browser. Source-file hints may come from metadata only.
- Automatic local companion daemons, DHT lookup, Iroh relays, browser seeding, Ed25519 publisher identity, and DMCA automation are roadmap topics, not implemented features.
- Any report language that says MiniModel.org "downloads", "seeds", "broadcasts", or "hosts" model artifacts must be translated into metadata-only language before it reaches docs or UI.
- The phrase "verified P2P artifact" should be used carefully. A catalog row can be proof-ready or P2P-ready, but the artifact is not accepted until local Rust fetch/assembly/checksum/`.slm` validation and receipt writing pass.

## Immediate Work Routed From These Reports

1. Preserve the six reports under `docs/report-intake/2026-07-02/` with SHA-256 checksums.
2. Add MiniModel `add-peer-source` so a converter can attach a consenting peer URL to an existing proof-ready catalog entry after conversion.
3. Update TinyRustLM generated conversion handoffs to mention the late `add-peer-source` path.
4. Update MiniModel.org and MiniModel.MiRust.com docs to describe the current direct known-peer path, not future broad discovery as if already shipped.
5. Route this synthesis into pointer-based memory with checksum-bearing references.
6. Keep active handoff buckets empty or README/placeholder-only before completion.
