# MemoryEndpoints Submit Contract Clean Cut

Date: 2026-08-27

Status: accepted clean-slate decision; implementation under full gate

## Context

TinyRustLM is prelaunch. There is no released client population, persisted
contract that must remain readable, or compatibility requirement.

The MemoryEndpoints memory-event submit payload carried two duplicated
concepts:

- `actorAgentId` and a compatibility `agentId`;
- `summary` and a compatibility `safeSummary`.

The Rust type comments explicitly described the latter names as compatibility
members. .NET and browser code mirrored the same payload. This created two
authorities for one concept, allowed inconsistent values, widened the wire
surface, and contradicted the project's no-legacy policy.

`agentId` and `safeSummary` are not globally forbidden words. They remain valid
where a separate current contract assigns them a distinct meaning, such as an
internal TinyRustLM memory record, agent registration, or a meeting-message
summary. They are forbidden only as aliases in the memory-event submit shape.

## Decision

Replace the sole prelaunch memory-event submit contract. Do not migrate or read
the previous local rows.

The closed payload has exactly these members:

| Member | Required | Meaning |
| --- | --- | --- |
| `workspaceId` | yes | Hosted workspace identity selected by the connector |
| `actorAgentId` | yes | Agent authoring the event |
| `kind` | yes | Exact TinyRustLM memory-record schema identity |
| `version` | yes | Memory-record schema version |
| `scope` | yes | Fixed `project` scope |
| `scopeId` | yes | Fixed `tinyrustlm.com` scope identity |
| `memoryType` | yes | `status` for short-term or `handoff` for long-term |
| `subject` | yes | Public-safe logical subject |
| `title` | yes | Public-safe title, equal to subject in this contract |
| `summary` | yes | Public-safe memory summary |
| `source` | yes | Exact connector source label |
| `confidence` | yes | Finite value from 0 through 1 |
| `uaiReferences` | yes | Normalized bounded durable references |
| `tags` | yes | Normalized bounded public-safe tags |
| `tinyrustlmMemoryTier` | yes | `short_term` or `long_term` |
| `sourceSha256` | no | SHA-256 identity of a separately governed source |

Unknown members are rejected. Missing required members are rejected. Duplicate
JSON keys are rejected at bounded parser boundaries where the runtime can
observe them. Producers emit no alias and consumers accept no alias.

## Technical Identities

The payload correction changes every local identity whose digest or persisted
shape depends on the old members:

| Boundary | Current identity |
| --- | --- |
| Memory record | `tinyrustlm.memory_endpoints.memory_record.v1` |
| Outbox entry | `tinyrustlm.memory_endpoints.outbox_entry.v2`, version `2` |
| Local receipt | `tinyrustlm.memory_endpoints.local_receipt.v2`, version `2` |
| Payload digest domain | `tinyrustlm.memory_endpoints.submit_payload.digest.v2` |
| Idempotency prefix | `tinyrustlm-memory-v2-` |
| Browser database | `tinyrustlm-memory-endpoints`, database version `1` |

The authoritative hosted receipt remains
`tinyrustlm.memory_endpoints.authoritative_receipt.v1`. Its wire shape did not
change in this decision. A future externally authorized service-contract
change must receive its own exact identity and tests.

The shared deterministic fixture payload digest is:

`ffa9fb1d3b729902d8a62621ce08d627b7042aaad89f5d8ca51a6257f3e305aa`

Rust, .NET, and browser tests pin this value independently.

## Persistence Decision

The browser opens a new database named `tinyrustlm-memory-endpoints` at
database version `1`.

There is deliberately:

- no old database open;
- no migration transaction;
- no alias reader;
- no row translation;
- no read-old/write-new mode;
- no fallback serializer;
- no relabeling of old local receipts as current evidence.

Prelaunch rows from the abandoned shape are outside the current evidence graph.
Source-control history and historical documentation preserve the decision; the
shipping product does not preserve executable compatibility.

## Cross-Language Ownership

### Rust

- owns the canonical domain validation and deterministic digest algorithm;
- uses `deny_unknown_fields` for the submit payload;
- derives the internal record from `actorAgentId` and `summary`;
- rejects old outbox/local-receipt identities.

### .NET

- exposes the current public record constructor only;
- disallows unmapped persisted JSON members;
- computes the same digest transcript and idempotency key;
- serializes the exact client request without retired aliases.

### Browser

- validates an exact key set before hashing or persistence;
- opens only the new database;
- stores outbox/local receipts under the new identities;
- rejects stale, mutated, surplus, or credential-bearing rows.

### Scripts And Fixture

- live and relay verification scripts emit the same current payload;
- the local relay fixture checks the exact allowed member set and fixed values;
- fixture agreement is integration evidence only, never live service proof.

## TDD Sequence

The change began with tests that failed because both aliases were still
present. The green contract must retain all of these assertions:

1. current producers emit `actorAgentId` and `summary`;
2. current producers do not emit `agentId` or `safeSummary`;
3. persisted input containing either alias is rejected;
4. unknown fields and credentials are rejected;
5. payload mutation breaks the fingerprint;
6. all three runtimes produce the pinned shared digest;
7. old technical versions are not accepted as current rows;
8. local retries preserve one current idempotency identity;
9. authoritative receipt application still requires exact event, payload,
   logical-memory, revision, and body-hash bindings.

## External Contract Boundary

This decision defines TinyRustLM's current client payload. It does not prove
that the production MemoryEndpoints service advertises or accepts it.

The service still needs public or authorized versioned capability evidence for
submit, search, pull, revision, receipts, enrollment, reconnect, rotation,
close, delete, and post-delete verification. Client source must not guess route
or response aliases to manufacture interoperability.

Meeting transcript and registration contracts are separate. They must be
changed only under their own service authority, tests, and schema identities.

## Consequences

Positive:

- one name per wire concept;
- fewer inconsistent states;
- strict cross-language persistence;
- deterministic current identity;
- no prelaunch migration debt;
- clearer external-contract blocker.

Costs:

- abandoned local prelaunch rows are not loaded;
- every producer, fixture, script, test, public API baseline, and document must
  move together;
- live service acceptance remains a separate required proof.

## Rejected Alternatives

- emit both fields but require equality;
- accept both while writing one;
- migrate old IndexedDB rows;
- preserve the old database as a fallback;
- silently retry a rejected request with aliases;
- infer the external service contract from permissive client code;
- keep compatibility constructors in the public .NET API;
- describe a successful loopback fixture as live MemoryEndpoints continuity.

## Acceptance

This source change is complete only when formatting, Rust warnings-denied
checks, Rust tests, .NET formatting and tests, browser tests, script syntax,
fixture integration, public API, package boundary, secret scan, documentation,
Git commit/push equality, and applicable release gates pass.

It does not advance the `0/25` live MemoryEndpoints campaign count without an
authorized unique-company continuity and cleanup receipt.
