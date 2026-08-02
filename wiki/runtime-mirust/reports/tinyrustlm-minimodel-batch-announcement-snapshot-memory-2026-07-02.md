# TinyRustLM MiniModel Batch Announcement Snapshot Memory - 2026-07-02

## Routing

Read this when changing MiniModel catalog publication, peer-source announcements, generated TinyRustLM conversion scripts, local `models.v0.json` reuse, or docs that claim converted-once models can become P2P-ready for later users.

## Implementation

MiniModel now exposes `write-catalog-snapshot-with-announcements <output-json> <catalog-entry-json>... --announcements <announcement-json>...`.

The command validates each catalog-entry JSON, validates each peer-source announcement JSON, rejects duplicate catalog model ids, rejects announcement model ids that do not match any supplied entry, applies only matching announcements to the matching entry, deduplicates peer URLs, revalidates peer-source counts, and writes a metadata-only `models.v0.json` snapshot directly.

The existing single-entry `apply-peer-source-announcements` command now shares the same in-memory validation helper, so single-entry and batch maintainer publication enforce the same model, artifact, peer-offer, Merkle, and peer-source checks.

## TinyRustLM Handoff

`Start Conversion` conversion-request JSON now includes:

- `peer_source_batch_snapshot_shape`
- `write-catalog-snapshot-with-announcements` in the conversion gates

The generated `.tinyrustlm-convert.ps1` script still writes proof-ready metadata first. If a peer URL is known, it writes a direct with-peer catalog entry and portable peer-source announcement. If no peer URL is known, it prints both the direct `add-peer-source` follow-up and the maintainer batch snapshot command so many announcements can be published into shared metadata in one checked step.

## Boundary

This is still metadata-only. Project servers do not run user model bytes, serve `.slm` artifacts, proxy Hugging Face bytes, or become peer-piece hosts. The batch command publishes availability metadata only; receivers still fetch pieces from consenting peers and run MiniModel/TinyRustLM verification before browser import.

## Verification

- `cargo fmt --all -- --check`
- `cargo test -p minimodel-core --quiet`
- `cargo test -p minimodel --quiet`

The MiniModel core test suite covers batch snapshot publication with two peer-source announcements and rejection of an unmatched announcement model id before output is written.
