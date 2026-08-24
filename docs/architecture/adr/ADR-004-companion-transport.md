# ADR-004: Companion Transport

## Status

Proposed. The private operation-contract and durable-journal foundation exists,
but no loopback server, browser capability protocol, peer fetcher, source
downloader, complete-composition converter coordinator, installer, or release
artifact is implemented or published.

The former SeedHost implementation and its public-package/tool lane were
deleted before launch. It is not a compatibility authority and must not be
restored.

## Decision Date

2026-08-24

## Scope

This ADR defines the required boundary between TinyRustLM.com and the future
user-owned private companion. It covers operation identity, trust, transport,
progress, cancellation, and artifact transfer. It does not authorize public
P2P announcements, MemoryEndpoints, arbitrary local automation, model
conversion shortcuts, or model-quality claims.

## Foundation Already Established

The nonpackable `TinyRustLM.Companion` solution component owns two closed
technical schemas:

- `tinyrustlm.companion.acquire.v1`; and
- `tinyrustlm.companion.operation.v1`.

The acquisition request binds one public `owner/name` repository, one immutable
40-hex revision, exact model and tokenizer source-lock SHA-256 values, one
composition-profile SHA-256, explicit source-acquisition approval, a positive
maximum-source-byte budget, and no more than two ordered HTTPS peer candidates.
Credentials, query strings, fragments, IP literals, duplicate peers, mutable
revisions, unknown fields, and ambiguous values fail closed.

The durable operation states are `Queued`, `CheckingPeers`, `FetchingPeer`,
`VerifyingPeer`, `AcquiringSource`, `Converting`, `VerifyingComposition`,
`Available`, `Cancelled`, and `Rejected`. Availability requires exact positive
records for ACG2, SLM2, Tokenizer2, Template2, Sampling2, and Prompt2.

The current journal requires an explicitly created owned root, immutable
numbered history, a bounded strict current record, same-process and
cross-process exclusion, typed transitions, create-only operation identity,
and terminal-state immutability. This is a persistence foundation, not proof of
the remaining network or conversion path.

## Required Transport Decision

The released browser and companion will use one closed loopback capability
protocol chosen only after current Chromium, Firefox, WebKit, CORS, Private
Network Access, DNS-rebinding, CSRF, Host/Origin, proxy, and installer behavior
is physically verified. No current route table or port is release authority.

The selected design must provide:

- deterministic discovery without broad port scanning;
- mutual browser-origin and installed-companion authentication;
- explicit user pairing and short-lived, origin-bound capabilities;
- no cookies, URL credentials, ambient authentication, or durable browser
  secret storage by default;
- bounded strict requests and typed public-safe failures;
- resumable immutable progress from the durable journal;
- race-safe cancellation;
- content-addressed streaming of complete verified compositions;
- no arbitrary file, command, process, proxy, or credential surface; and
- exact listener, connection, body, timeout, and resource limits.

Downloading TXT, JSON, PowerShell, shell, README, conversion-request, or share
kit instructions is prohibited. One user action must perform verified direct
P2P acquisition or, after explicit approval, reviewed source acquisition and
canonical local conversion.

## Trust Boundary

TinyRustLM.com remains a public static application. Prompts and model bytes do
not pass through TinyRustLM.com, MiniModel.org, analytics services, or another
project-hosted website. MiniModel.org may provide public catalog and discovery
metadata only. The private companion transports bytes between consenting peers
or acquires an immutable reviewed public source.

Rust remains authoritative for source inspection, conversion, SLM2,
Tokenizer2, Template2, Sampling2, Prompt2, ACG2, hashing, semantic validation,
and runtime behavior. Managed code may orchestrate exact typed operations but
may not repair output, infer defaults, or implement a second converter.

## Threats To Close Before Acceptance

The implementation must test malicious public origins, DNS rebinding, forged
and duplicate Host/Origin headers, CSRF, port squatting, companion
impersonation, capability theft and replay, stale tabs, service workers,
extensions, oversized or slow requests, parser ambiguity, response smuggling,
arbitrary-path attempts, symlink/reparse substitution, resource exhaustion,
operation guessing, duplicate progress events, cancellation races, and public
listener exposure.

Same-user malware is not solved by a loopback protocol, but the companion must
still use least privilege, narrow capabilities, bounded owned roots, and no
administrative credentials.

## Acceptance Evidence

1. The protocol is preregistered with exact schemas, limits, threat model, and
   browser/OS matrix before comparative output.
2. Wrong origin, host, method, route, schema, field, capability, operation,
   size, sequence, and artifact identity fail closed.
3. Pairing and mutations are race tested; capabilities rotate and revoke.
4. Peer acquisition and source conversion survive restart through immutable
   operation evidence or terminate with a typed state.
5. Every transferred member matches its declared length and SHA-256 before one
   atomic browser activation.
6. Real clean-browser tests cover acquire, cancel, resume, activate, chat,
   process closure, profile deletion, and secret/network scanning.
7. Signed private companion archives execute on every RID claimed as executed
   and are independently read back before install controls appear.

Unit tests, a local loopback fixture, package construction, or a successful
HTTP response do not satisfy these gates.

## Current Claim Boundary

No companion is installable. No transport is released. No real model has
qualified. No outside peer lane or catalog announcement is proven.
MemoryEndpoints is unauthorized and disconnected. Campaign counters remain
0/20, 0/50, 0/25, 0/40, and 0/20.
