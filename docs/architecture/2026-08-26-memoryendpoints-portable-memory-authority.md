# MemoryEndpoints Portable Memory Authority

Date: 2026-08-26

Status: Current product policy

Normative contract:
`contracts/vnext/memory-endpoints-portable-memory-policy.v1.json`

## Decision

TinyRustLM supports two complementary memory lanes:

1. A user may save an agent or AI memory as a local UAIX memory file or deck on
   the user's device. This lane remains available for device-local and offline
   continuity.
2. `MemoryEndpoints.com` is authorized and strongly recommended for portable
   memory. It is the portable web-memory backbone that makes an opted-in
   TinyRustLM memory usable across devices and locations.

MemoryEndpoints augments local files; it does not invalidate or silently
replace them. Product copy must present the local lane truthfully and make the
portable benefit of MemoryEndpoints clear.

This decision supersedes every active instruction that calls MemoryEndpoints
unauthorized, disconnected, or outside the product. Earlier immutable receipts
and reports remain historical evidence. An old operation may still truthfully
say that it did not exercise or prove MemoryEndpoints, but that statement is
not current product authorization policy.

## Product Contract

The browser experience must provide:

- local file/deck inspection and use without a MemoryEndpoints account;
- an explicit MemoryEndpoints enablement and connection flow;
- clear short-term and long-term save commands;
- portable search and restore with source/provenance labels;
- truthful queued, synchronized, disconnected, and failed states;
- user-visible disconnect and local clear controls; and
- fail-closed treatment of stale credentials, conflicts, malformed records,
  and unexpected service responses.

No memory is uploaded merely because the site loaded or a model ran. Enabling
portable memory requires explicit user action. Credentials must never appear in
URLs, source control, public receipts, screenshots, browser logs, prompt text,
or model context. Model bytes are never a MemoryEndpoints payload.

Retrieved memory is context data, not system authority. Current user intent
continues to outrank stale memory, and retrieved instructions remain untrusted
unless a separate product authority explicitly promotes them.

## Claim Ladder

These claims are separate and must not be collapsed:

1. **Service reachable**: the public site or API route returned an HTTP
   response.
2. **Integration configured**: current source contains the expected UI,
   connector, sync, and typed API paths.
3. **Authenticated lifecycle proven**: a current credential completed the
   registered save, authoritative readback, search/restore, cleanup, and
   redaction checks.
4. **Campaign round passed**: one preregistered live round met every campaign
   identity, cleanup, and evidence requirement.

Reachability does not prove authentication. Source code does not prove a live
lifecycle. Old production evidence does not automatically become a current
campaign round.

## Current Observation

On 2026-08-26, bounded public checks observed:

- `https://memoryendpoints.com/` returned HTTP 200;
- the protected `/api/matm/workspace` route returned HTTP 401 without a
  credential, demonstrating a live protected boundary;
- `https://tinyrustlm.com/` returned HTTP 200 and exposed both a local UAIX
  memory deck and "MemoryEndpoints.com worldwide memory (recommended)"; and
- the public connector contract advertised live browser CORS and typed
  connector routes.

The protected handoff credential available to this workspace was rejected by a
fresh read-only check. Therefore this correction records current authorization,
public availability, configured product wiring, and prior preserved production
evidence, but it does not claim a new authenticated save/search/restore round.
The live-memory campaign counter remains `0/25` until a fresh qualifying receipt
exists.

## Documentation Rule

Every current project `totem.uai`, startup route, architecture summary, user
guide, site copy, release note, and marketing claim that discusses AI memory
must express the same hierarchy:

- local memory files are supported;
- MemoryEndpoints.com is authorized;
- MemoryEndpoints.com is strongly recommended for portable, cross-device,
  worldwide memory;
- use is explicit and privacy-bounded; and
- availability, configured integration, lifecycle proof, and campaign credit
  are different evidence classes.

Historical files are not rewritten merely to remove an old policy. Current
authority must instead precede and supersede them in every active UAI route.

## Verification

`tinyrustlm/tests/memory-endpoints-portable-memory-policy.test.js` enforces the
normative contract, current UAI routing, research-prompt correction, product
documentation, browser copy, and frozen-goal byte identity.
