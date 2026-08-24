# Private Companion Foundation Clean Cut

## Decision

TinyRustLM has one private operational companion. The former public SeedHost
library, public tool, tests, package lane, sibling MiniModel executable
discovery, and browser fixture are deleted before launch. They provide no
compatibility authority and are not retained behind aliases or adapters.

The replacement begins with a nonpackable `TinyRustLM.Companion` component that
depends only on the current managed abstractions, P2P boundary, and canonical
conversion wrapper. It does not publish a package or claim an installable
application.

## Package Closure

The public managed package graph is exactly:

1. `TinyRustLM.Abstractions`;
2. `TinyRustLM.Core`; and
3. `TinyRustLM.P2P`.

`TinyRustLM.MemoryEndpoints` remains optional, unauthorized, and disconnected.
`TinyRustLM.Conversion` remains private optional tooling. The private companion
is not packable and has no public package ID or external package dependency.

Package audit metadata uses an exact title per package rather than requiring a
stale shared brand fragment. Public API authority comes from checked-in exact
baselines. Release and feed scripts, workflows, documentation, and isolated
consumer tests use the same package graph.

## Operation Contract

The exact request schema is `tinyrustlm.companion.acquire.v1`. It binds:

- a bounded model ID;
- public repository `owner/name`;
- immutable 40-character lowercase hexadecimal revision;
- model and tokenizer source-lock SHA-256 values;
- composition-profile SHA-256;
- explicit source-acquisition approval;
- a positive maximum source-byte budget; and
- zero, one, or two ordered HTTPS peer candidates.

Peer priority is operation-identity-bearing. Credentials, query strings,
fragments, IP literals, root-only paths, trailing-slash paths, duplicate peers,
mutable revisions, malformed digests, and unknown JSON members fail closed.

The deterministic operation ID is the SHA-256 of one canonical UTF-8 request
projection. There is no alias, alternate ID, or repair reader.

## Durable Journal

The exact operation schema is `tinyrustlm.companion.operation.v2`. It replaces
the prelaunch v1 record outright; no v1 reader, migration, alias, or fallback is
retained. The closed
state set is:

- `Queued`;
- `CheckingPeers`;
- `FetchingPeer`;
- `VerifyingPeer`;
- `AcquiringSource`;
- `Converting`;
- `VerifyingComposition`;
- `Available`;
- `Cancelled`; and
- `Rejected`.

The branch set is `Undecided`, `Peer`, `Source`, and `None`. Legal transitions
are explicit. Terminal states cannot advance. Rejection requires a bounded
typed error. Availability requires one verified artifact set containing exact
positive ACG2, SLM2, Tokenizer2, Template2, Sampling2, and Prompt2 identities,
hashes, and lengths.

Journal roots are explicitly created and marked. Operations are create-only.
Requests and numbered history are immutable. The bounded current record is
replaced only after its history entry is durable. Same-process and cross-
process exclusion prevent concurrent transitions. Reparse-point roots and
records fail closed.

Source conversion additionally owns one private create-only
`tinyrustlm.companion.source-conversion-intent.v1` envelope. Its canonical
UTF-8 bytes bind the operation and request identities to the normalized managed
conversion intent. Its SHA-256 is introduced only on the source transition from
`AcquiringSource` to `Converting`, remains unchanged through every later source
record, and is forbidden on the peer branch. Identical bytes can be observed
idempotently; changed, malformed, duplicate-key, unknown-field, noncanonical,
or identity-mismatched bytes fail without overwrite.

## Complete Source Conversion Integration

The private managed conversion owner now invokes only
`tinyrustlm-convert qwen3-composition`. Before process creation it freezes and
persists both source-lock paths and hashes, both source directories, the
registered composition-profile hash, one absent output root, exact converter
path and executable hash, resource limits, and terminal rule. Launch revalidates
every external path, hash, policy, and tree relationship. The owner runs one
bounded process tree, parses strict live summary and error output, recomputes
the operation identity, rejects inventory drift, and freshly hashes all six
artifacts and both component receipts. The former component-level managed
success API is deleted.

Durable composition facts are distinct from live stdout hash and elapsed time.
The output-only inspector launches no process and does not require the original
source locks, source directories, or converter file still to exist. An absent
or bounded nonterminal root remains pending without a journal write. A valid
native rejection is verified against the attempt lineage. A valid pass requires
the exact ten-file inventory and independently closes the attempt, receipt,
component, source, tool, profile, operation, graph, durability, resource,
nonclaim, and six-artifact hash graph. A pass/rejection collision, malformed
terminal file, unexpected entry, directory, reparse point, over-limit inventory,
or identity drift is invalid evidence.

The Companion source coordinator reloads and verifies the immutable acquisition
request and exact bound intent, transitions through `Converting` and
`VerifyingComposition`, and attaches exact ACG2, SLM2, Tokenizer2, Template2,
Sampling2, and Prompt2 identities only when entering `Available`. Explicit
terminal reconciliation is admitted only from `Converting` or
`VerifyingComposition`; terminal journal states cannot be overwritten. After
owned-process cancellation, a valid pass wins, a valid native rejection wins,
and no terminal evidence becomes `Cancelled`. A known live timeout, output
overflow, unexpected stderr, executable drift, or process failure remains
`Rejected` and cannot be laundered by recovery. No path deletes evidence,
repairs output, adopts an unknown process, relaunches automatically, or retries.

The deterministic converter executable used by managed tests is a process and
contract fixture, not a valid model or composition. No real source conversion,
runtime inference, browser transfer, or quality result is claimed.

## Deleted Authority

The cut removes:

- `TinyRustLM.SeedHost` source and tests;
- `TinyRustLM.SeedHost.Tool`;
- SeedHost build, package, consumer, verification, and release scripts;
- the separate browser NuGet publication lane;
- CI checkout and execution of a sibling MiniModel repository;
- the old browser companion fixture and its simulated E2E path; and
- current installation guidance for an unpublished public host package.

Immutable historical records may still describe those paths as failed or
superseded evidence. No current executable, test authority, package, release
input, or install instruction may use them.

## Verification

The current source checkpoint passes:

- `TinyRustLM.Companion.Tests`: 45/45;
- `TinyRustLM.Package.Tests`: 38/38 after documentation regression coverage;
- `TinyRustLM.Core.Tests`: 80/80;
- complete managed solution: 163/163 after documentation regression coverage;
- browser model-acquisition contract: 5/5; and
- diff hygiene plus the frozen authoritative-goal SHA-256 check.

A create-only local package transaction separately demonstrated five package
and five symbol-package outputs, exact package audit, and isolated execution of
the three public packages plus the optional disconnected MemoryEndpoints and
private Conversion packages on `win-x64`. Those generated bytes are dirty-
source development evidence outside Git. They do not prove Linux assets,
publication, public readback, companion release, or product deployment.

## Remaining Work

The private companion is not yet a released process host. It does not yet
provide:

1. a selected and adversarially verified loopback capability protocol;
2. direct peer discovery and resumable piece transfer;
3. immutable reviewed source acquisition;
4. authenticated process ownership and explicit user-authorized new-attempt
   handling for an absent or nonterminal conversion root;
5. composition transfer and atomic browser storage;
6. real model activation and multi-turn chat;
7. signed three-RID companion archives; or
8. authorized publication and independent readback.

The deep acquisition gate therefore fails explicitly as unavailable. It must
not fall back to the deleted host, an external sibling executable, a text or
script handoff, a fixture, or simulated assistant output.

## Claim Boundary

No real model has been acquired, converted, qualified, or chatted with through
this foundation. No companion is released. No package or site publication is
claimed. No public peer lane is proven. MemoryEndpoints remains unauthorized
and disconnected. Campaign counters remain 0/20 models, 0/50 browser rounds,
0/25 memory rounds, 0/40 external lanes, and 0/20 catalog announcements.
