# Site Release Record v1

## Decision

Every site publishes one consistent release-information surface:

- a visible semantic version;
- an ISO release date;
- a UTC last-published instant obtained from the deployment operation;
- a human-readable `/updates/` history;
- `/.well-known/site-release.json` for the current publication; and
- `/.well-known/site-release-history.json` for append-only machine history.

The source-controlled ledger uses `uaix.site_release_ledger.v1`. Public current
and history records use `uaix.site_release.v1` and
`uaix.site_release_history.v1`. Unknown fields, noncanonical JSON, ambiguous
pending releases, rewritten history, duplicate versions, malformed dates,
unbound source revisions, and missing changes fail closed.

## Identity Model

A release entry is immutable product intent: version, release date, summary,
and typed changes. A publicly observed publication identity is a separate
append-only fact: release ID, exact clean Git revision, source-ledger SHA-256,
and the deployment operation's UTC start instant. The publication ID is
SHA-256 over those identities and the release-entry hash. Deployment success
remains a property of the immutable deployment receipt, not an inference made
from the presence of a public metadata record.

The split avoids a circular commit identity. Source does not guess when it will
be published. The deployment materializer creates the two public records in an
external owned staging directory after binding the clean source revision. The
publisher scans those exact bytes, publishes them only with the declared web
closure, verifies HTTPS readback, and retains the publication in its immutable
deployment receipt. Only after all readbacks pass, the publisher writes an
exclusive, reopened, hash-verified finalized-ledger candidate beside the
deployment evidence. It does not mutate source during publication. The next
reviewed source check-in applies that exact candidate, appending the successful
publication fact before another release is prepared.

If a failed attempt nevertheless makes its current-release marker publicly
readable, that version and publication identity are already externally
observable and cannot be reused. The exact public current/history records are
archived and validated against their source ledger, the failed receipt remains
failed, the observed publication identity is retained in history, and recovery
advances under a strictly greater version.

## Publication Rules

1. Exactly one latest release may await publication; all earlier releases must
   have one immutable publication identity.
2. Every deployment that changes public bytes gets a strictly increasing
   version and a new release entry. A failed attempt normally remains only a
   receipt; if its commit marker became public, that observed identity is
   retained and the recovery uses a new version.
3. Public metadata is generated outside source control and never overwrites a
   prior staging artifact.
4. The current record and final history element must be identical.
5. New history must preserve every earlier record exactly and append only.
6. Release metadata is published with the site, scanned for secrets, and
   verified by fresh HTTPS readback. Package creation and local validation are
   not publication.
7. A publisher must not report success if visible HTML, the updates page,
   machine records, source revision, version, dates, or receipt identities
   disagree.
8. A successful deployment must emit one finalized-ledger candidate whose
   publication ID matches the public current record. The candidate is reviewed
   and committed exactly; an existing output cannot be overwritten.
9. Preserving an observed identity from a failed attempt never upgrades the
   failed receipt to success. It requires exact public-record validation and an
   explicit recovery entry in the next version.

## Change Types

The bounded vocabulary is `added`, `changed`, `documentation`, `fixed`,
`performance`, `removed`, and `security`. Entries describe externally relevant
changes and verified operational changes. They do not advertise incomplete
campaign gates, private evidence, credentials, model paths, prompts, or
unsupported quality claims.

## Cross-Site Contract

Static, WordPress, wiki, and application publishers implement the same schemas
and URL surface. Rendering can match each site's visual language, but the
meaning, validation, append-only rule, timestamp semantics, and fail-closed
deployment gate remain identical. No site receives a compatibility reader for
an obsolete prerelease schema; dogfood clients move to the current contract in
the same coordinated rollout.
