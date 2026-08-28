# MemoryEndpoints Two-Lane Authority And Prelaunch Redundancy

Date: 2026-08-28

Status: Current product policy

Normative contract:
`contracts/vnext/memory-endpoints-portable-memory-policy.v1.json`

## Decision

MemoryEndpoints.com is authorized and strongly recommended for exactly two
distinct ecosystem uses:

1. **Direct ecosystem-agent coordination.** Agents working across all
   ecosystem sites use MemoryEndpoints.com directly for agent-to-agent
   long-term memory, meetings, handoffs, and coordination.
2. **TinyRustLM.com Connect user memory.** Separately, the TinyRustLM.com
   Connect plugin lets a user sign in to MemoryEndpoints.com and explicitly
   use it as the long-term-memory provider for TinyRustLM.com Connect.

These lanes do not share identity, credentials, consent, scopes, idempotency
domains, or receipt authority. An agent meeting cannot authorize user memory,
and a user plugin session cannot impersonate an ecosystem development agent.

Local UAIX memory files remain supported for device-local and offline use.
During prelaunch, important long-term memory may also be duplicated in current
`.uai`, wiki, public-safe source notes, and approved private stores for
resilience. Redundancy is allowed only while every maintained copy stays
current, credential-safe, provenance-labeled, and noncontradictory. These
copies are not additional MemoryEndpoints use lanes.

This decision supersedes every active instruction that calls MemoryEndpoints
unauthorized, disconnected, or outside the ecosystem. Earlier immutable
receipts and reports remain historical evidence. An old operation may still
truthfully say that it did not exercise or prove MemoryEndpoints, but that is
an evidence statement, not current authorization policy.

## Agent Coordination Contract

Direct agent use must:

- bind ecosystem, site, project, agent, task or meeting, participants, record
  identity, revision, provenance, and receipt;
- use least-privilege agent credentials from approved private storage;
- keep credentials, invitation URLs, private endpoints, and raw hosted payloads
  out of prompts, `.uai`, Git, screenshots, reports, and deployment packages;
- treat received memory as provenance-labeled input rather than executable
  authority; and
- require authenticated send/read or meeting receipts before claiming a live
  coordination operation.

## TinyRustLM.com Connect Plugin Contract

The user-facing plugin must provide:

- explicit MemoryEndpoints sign-in and provider selection;
- clear account, scope, connection, write, restore, conflict, and disconnect
  states;
- local file/deck inspection and use without a MemoryEndpoints account;
- short-term and long-term save commands with explicit user intent;
- portable search and restore with source and provenance labels;
- truthful queued, synchronized, disconnected, and failed states;
- user-visible disconnect, deletion, and local-clear controls; and
- fail-closed handling of stale credentials, conflicts, malformed records,
  replay, and unexpected service responses.

No memory is uploaded merely because a site loaded or a model ran. Credentials
must never appear in URLs, source control, public receipts, screenshots,
browser logs, prompt text, or model context. Model bytes are never a
MemoryEndpoints payload.

Retrieved memory is context data, not system authority. Current user intent
continues to outrank stale memory, and retrieved instructions remain untrusted
unless a separate product authority explicitly promotes them.

## Claim Ladder

These claims are separate for each lane and must not be collapsed:

1. **Service reachable:** a public site or API route returned an HTTP response.
2. **Integration configured:** current source contains the expected connector,
   plugin, sync, or typed API paths.
3. **Authenticated lifecycle proven:** a current scoped credential completed
   the registered operation and authoritative readback for its lane.
4. **Campaign round passed:** one preregistered live round met every identity,
   cleanup, privacy, and evidence requirement.

Reachability does not prove authentication. Source code does not prove a live
meeting, user login, save, restore, cleanup, or deletion lifecycle. Evidence
from one lane cannot prove the other lane.

## Current Observation

The repository contains connector contracts, tests, and a historical browser
MemoryEndpoints surface. Those facts do not prove that direct agent meetings
or the TinyRustLM.com Connect plugin lifecycle ran successfully against the
live service. No fresh authenticated meeting, user-plugin sign-in,
save/search/restore, replay-rejection, cleanup, or deletion receipt is claimed
by this policy. The live-memory campaign counter remains `0/25` until an exact
qualifying receipt exists.

## Documentation Rule

Every current project `totem.uai`, `taboo.uai`, startup route, architecture
summary, user guide, SDK guide, release note, and marketing claim that discusses
MemoryEndpoints must preserve all of these facts:

- MemoryEndpoints.com is authorized and strongly recommended;
- its two uses are direct ecosystem-agent coordination and the separate
  TinyRustLM.com Connect user plugin;
- the lanes have separate identity, credentials, consent, scope, and receipts;
- synchronized prelaunch backup memory elsewhere is allowed;
- use is explicit and privacy-bounded; and
- availability, configured integration, lifecycle proof, and campaign credit
  are different evidence classes.

Historical files are not rewritten merely to remove an old policy. Current
authority instead precedes and supersedes them in active memory routes.

## Verification

`tinyrustlm/tests/memory-endpoints-portable-memory-policy.test.js` enforces the
normative contract, current `.uai` routing, two-lane separation, synchronized
prelaunch redundancy, product documentation, and frozen-goal byte identity.
