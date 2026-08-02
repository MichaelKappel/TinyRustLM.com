# TinyRustLM Web Companion Production Memory

Date: 2026-07-13
Completed UTC: 2026-07-14
Status: implemented, locally packaged, deployed, and verified

## Current product truth

TinyRustLM.com remains the browser AI interface. The downloadable
`UAIX.Browser.p2pRuntime.SeedHost` companion handles local `.slm` storage,
validation, resumable P2P import, model streaming, and two-lane seed-host
operations. MiniModel.org remains the metadata catalog and proof-gated peer
discovery authority. It does not proxy or host model bytes.

The browser-to-companion boundary is implemented through an exact IPv4
loopback endpoint with strict Host and Origin validation, narrow CORS,
one-time pairing codes, digest-only pairing retention, short-lived
origin-bound operation capabilities, mutation replay protection, rotation,
expiry, and revocation. Credentials are not persisted in browser storage,
fleet state, import journals, logs, receipts, package evidence, or deployment
reports.

Rust remains authoritative for MiniModel manifests, piece identities, Merkle
identity, companion state, import preflight, assembly, `.slm` validation,
receipts, external reachability proof, and announcement eligibility. C# owns
typed orchestration and the loopback service but does not reimplement those
trust decisions.

## Browser and catalog behavior

TinyRustLM detects, pairs with, reconnects to, and revokes a local companion.
It can start or resume a two-peer import only after peer identities agree,
stream the receipt-bound model from the companion into the WASM runtime, and
keep project domains out of the model-byte path. The bridge exposes no
arbitrary filesystem, shell, general proxy, prompt, or broad service-control
route.

The approved TinyRustLM visual language is preserved. Before a conversation,
the compact starter and setup experience remains visible. After the first
send, the center column becomes conversation-first: introductory cards and the
model setup popover close, the timeline occupies the available space, the
composer remains anchored, and one authoritative assistant renderer produces
each answer exactly once. Desktop, narrow desktop, mobile, keyboard, reduced
motion, long-name, active conversation, and long-history behavior are covered.

MiniModel.org now puts its model catalog in the primary home-page flow. The
catalog exposes description, immutable source revision, license,
quantization, artifact size, quality boundary, limitation, proof state, and
metadata inspection links. The live catalog currently has two metadata rows:

- Qwen2.5-1.5B-Instruct q4 is conversation-proven and full-assistant-pending.
  It is awaiting current outside-network proof.
- The 8.6 KiB q8 fixture is labeled runtime-only and non-conversational.

The live catalog has zero active models and zero peers. No public peer
announcement was fabricated from loopback, LAN, metadata-only, or stale
evidence.

## Public deployment evidence

The TinyRustLM transaction completed at `2026-07-14T07:25:45.7984741Z`.
Nineteen files passed staged/final byte verification. The former
`app/models/qwen2.5-1.5b-instruct-q4.slm` object was 969,648,576 bytes and is
now proven absent through authenticated FTPS plus public HTTP 404.

The MiniModel transaction completed at `2026-07-14T07:33:31.5707280Z`.
Twenty-five metadata/site files passed staged/final verification. The retired
`catalog/default-demo.v0.json` and
`artifacts/demo/tiny-test-model-q8.slm` routes are proven absent through FTPS
plus HTTP 404.

| Evidence | SHA-256 |
| --- | --- |
| `artifacts/reports/tinyrustlm-web-companion-production-deployment-2026-07-13.json` | `6335e5db881567727af4ff8a019b5a302bc9f10af0f342817f01965c0d1b36ad` |
| `artifacts/reports/minimodel-proof-catalog-production-deployment-2026-07-13.json` | `7eb430ea639833bba200a22a6d5ea119f69f436fc6415ffa01bf7031d3a03a85` |

Both reports have `status=pass`, `secret_material_included=false`, and
`project_server_model_bytes_present=false`. Their source commit fields identify
the repository base revisions, not an assertion that the worktree was clean.
The per-file byte counts and SHA-256 values in each report are the authority
for the exact deployed worktree content.

An independent cache-busted HTTPS pass matched all 44 report rows, including
FTPS evidence for the two non-public `.htaccess` controls. Five independent
absence checks passed: TinyRustLM's retired Qwen route, a TinyRustLM `.slm`
probe, MiniModel's retired demo JSON, MiniModel's retired fixture `.slm`, and a
MiniModel `.slm` probe all returned 404.

## Local NuGet and downloadable releases

Version `0.1.10` is immutably published to the local feed at
`E:/Source/WP/UAIX-Publish/DOTNET-NUGET`. It was not published to NuGet.org.

| Local-feed package | SHA-256 |
| --- | --- |
| `UAIX.Browser.p2pRuntime.SeedHost.0.1.10.nupkg` | `a253fac9a3b1ee5b3cf937cbec9d2e7d64ac8dc302c0a630ba60f4c25eeea451` |
| `UAIX.Browser.p2pRuntime.SeedHost.0.1.10.snupkg` | `84d575446624048a37a1e0422a53a8b0894770498182e67414e742bc74c39525` |
| `UAIX.Browser.p2pRuntime.SeedHost.Tool.0.1.10.nupkg` | `473dc9030454bda03a85e11cabbb47cf246115c0da840ae5228bc674a56446ee` |
| `UAIX.Browser.p2pRuntime.SeedHost.Tool.0.1.10.snupkg` | `de2140641c0dc92b53b67c6a86a8087d3496b9fba2a3b55101976f089408f123` |

The final package audit is
`artifacts/reports/seed-host-package-audit-0.1.10-web-companion-final.json`,
SHA-256
`c1e03de737660aaba6f3f3ad41d4d8fcd0b497a98101bf2cc0d7d8c4f3432c5c`.
It passed exact dependency bounds, SourceLink and portable symbols, `.snupkg`,
clean C# and F# consumers, installed-tool fixture round trip, RID-native asset
selection, and missing/wrong-architecture diagnostics. It records no model
weights, private authoring surface, or secret material.

| Self-contained release | SHA-256 |
| --- | --- |
| `UAIX.Browser.p2pRuntime.SeedHost.Tool.0.1.10-win-x64.zip` | `fda55f27d67a90563a543ff0c81fa96baf1bd759753cd6006a68fe7747f64bc8` |
| `UAIX.Browser.p2pRuntime.SeedHost.Tool.0.1.10-linux-x64.tar.gz` | `9650261484b1a386c19c8cc29b3da5c59e61363e6167c0e7f08eaf0e86085587` |
| `UAIX.Browser.p2pRuntime.SeedHost.Tool.0.1.10-linux-arm64.tar.gz` | `e5fcb330af6531a8d0070d646d6a0f821bb0e656c2663f9870af4567e9476248` |
| `SHA256SUMS-UAIX.Browser.p2pRuntime.SeedHost.Tool-0.1.10.txt` | `d46b426a47cc1967d02e828f38824f75aca529127386070c9ca6ecdc3e0d9d2c` |

The release verifier passed archive traversal and duplicate checks, Unix mode
checks, checksum receipts, SPDX SBOMs, ABI v2 loading, `doctor`, `init`, Rust
fleet inspection, and managed `inspect`. Windows x64 and Linux x64 executed
natively. Linux ARM64 executed with `qemu-aarch64-static` and an Ubuntu Noble
ARM64 sysroot extended by repository-verified `libssl3t64` package SHA-256
`0cb6e139be61990a5fd8a8c17a428a8035c5870b11e359c93a088c22fc637a49`.
The temporary verification sysroot and apt cache were removed after success.

## Verification summary

- TinyRustLM browser unit tests: 56 passed, 0 failed, 0 skipped.
- MiniModel catalog unit tests: 12 passed, 0 failed, 0 skipped.
- Playwright: 28 expected, 0 unexpected, 0 flaky, 0 skipped, 197,749 ms.
  The JSON evidence is
  `tinyrustlm/artifacts/playwright/results.json`, SHA-256
  `fb946664150eb16d073b3ff05b93ab32f717c59bfb670a8967c7fb956a9b88f7`.
- Playwright includes peer disagreement rejection, one-time pairing,
  reconnect/revoke, worker-tree restart/resume, and chat after import of the
  real 969,648,576-byte Qwen artifact.
- TinyRustLM .NET Release tests: 166 passed, 0 failed, 0 skipped: 54 package,
  72 core, and 40 SeedHost tests.
- TinyRustLM and MiniModel Rust workspaces passed `cargo fmt --all --check`,
  every workspace/all-target test, and Clippy with warnings denied.
- MiniModel live desktop/mobile smoke passed with two catalog models, zero
  active models, zero peers, one awaiting proof, one fixture, no overflow, and
  no raw peer URL in model cards.
- TinyRustLM live public-local-only smoke reported runtime ready, WASM loaded,
  no selected model, disabled generation, no error, no project model request,
  and screenshot SHA-256
  `76aaef6121ecc02534e65be76758072cd45d81b104435d8bed90d80c948b76af`.
- Empty, active, and long live visual captures passed on desktop and mobile
  against `ui-lock-compact-density-baseline-2026-07-13`. The live report
  SHA-256 values are `a13d6829b471651a3c29928c30c296bf65435952047dc61df1b3306a90c97c2c`,
  `d0daf83525e8eb7a73db0e7398b03d27f18b5d07490a43b15dd4d20c2d4d6e02`,
  and `3c348bd2dd8faef3a328fda6bcc781f8788bb2285e683b9337e42d260419368b`.

## Anti-cheat and claim boundary

No test was skipped, weakened, changed to accept the implementation, or
replaced by a mock success response. The real large-model browser test transfers
and validates all bytes. Duplicate assistant output was removed at its second
rendering path, not hidden with CSS. Browser visual invariants fail if setup
surfaces remain active, message counts drift, a second response renderer
appears, or timeline/composer geometry overlaps.

No loopback or same-machine check is called public reachability. No catalog
peer is active without a current signed outside-network receipt. No project
website hosts, runs, or proxies model bytes. No NuGet.org publication,
production signing, public announcement, automatic router/firewall change, or
target-machine service installation was performed. Those remain separate
authorized operations requiring their own evidence.
