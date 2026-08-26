# TinyRustLM Ecosystem Deployment Follow-Through Memory

Date: 2026-08-26

## Purpose And Prior Authority

This record preserves the result of the renewed urgent request to deploy the
complete TinyRustLM.com ecosystem. It extends, but does not overwrite,
`tinyrustlm-ecosystem-deployment-reconciliation-memory-2026-08-26.md`.
That earlier record remains the authority for the finalized TinyRustLM.com,
TinyRustLM.MiRust.com, MiniModel.MiRust.com, and MiniModel.org releases and for
the original Runtime, MiRust, and LMComposer blocker classification.

Urgency authorized work; it did not authorize replaying terminal operations,
inventing versions, publishing an incomplete WordPress checkout, using a
misbound profile, or changing model and campaign claims. MemoryEndpoints
remained unauthorized.

## Starting Source State

The canonical TinyRustLM source began clean and upstream-exact at
`8070e9ef5d9a51587e42d7b253537a9179717223`, tree
`06f2ca7b60034f7866448894c74d7422b4d17945`. The six clean external recovery
repositories were freshly fetched and proved local/tracking/FETCH_HEAD/direct
remote equality. Their starting heads were:

- LMComposer.com `36d6389fe82b0f53c4d8951aa6af5cb896fd8bf6` on `main`;
- MiniModel.MiRust.com `4f2401fb8166b54c73a1b9d4ad36985bbcf6fb5d`;
- MiniModel.org `8439e224146c790ce6a9da36a32c4c49890cac52`;
- MiRust.com `4e3d8f52b0b20d9ccb51751e4182e8ab87fb3e43`;
- Runtime.MiRust.com `220562c5c04415856ce355a0137d4f5c49a6314f`; and
- TinyRustLM.MiRust.com `518549d756f0d6aaf13e42b03764a646561446dd`.

The protected older TinyRustLM recovery checkout had pre-existing deletions and
was not touched. The prohibited `E:\Source\Rust\TinyRustLM.com` checkout was not
modified.

## LMComposer Release Closure

LMComposer was the one external blocker that had become actionable. Its source
was complete and clean, and the external profile named `LMComposer.com` was
present. A read-only authenticated FTPS probe bound that profile to the stale
live root without exposing credentials:

- old `.htaccess`: 85 bytes,
  `510271d9eb1e25012400af3f528c9fb5cb5232d343f40dcde747cf88f031b064`;
- old `index.html`: 427 bytes,
  `a5e8e80161b24543d15d517fe4701a1209358c188267a2346d26c5f5dd57db5c`;
- old `robots.txt`: 23 bytes,
  `16ceb5ee3e0dc13aa9adf31a3ebbe45a1d965b8c2b9f72eaf84e5911e140ed95`;
- old talisman: 101 bytes,
  `ce33814ba26a1f9849ee4cc16d52f54ec0280ba92a1e2f513a3ac7315d05fdfc`;
- `version.json`, `updates.json`, and both site-release records absent.

The release implementation added an exact eight-member public closure,
machine-readable release history, hardened headers, deterministic manifest
generation, authenticated before-state checks, clean/fresh-remote source
checks, FTPS staging, exact HTTP readback, protected-path checks, append-only
terminal receipts, and tests. Private UAI, tools, tests, deployment internals,
workspace memory, and model bytes were excluded.

Content/tooling commit
`f855a2b52f46e354b073f687da6890dcbcf06159`, tree
`9895ec8cc020a1e5865ebd88774d66664510872a`, and v1 registration commit
`c80de052cbda03d632ba6fece74985c0a1878ce5` were pushed before the first
production invocation. The v1 manifest was 3,557 bytes at SHA-256
`574929e4d2bbed58db0090849adeba13a3339572f712003abaf65614ced6d739`.

## Preserved V1 Terminal Failure

Create-only operation `lmcomposer-site-1.0.0-20260826-v1` was invoked exactly
once. It materialized all eight intended target identities and passed all six
exact readable-file checks, but its first redirect smoke failed. The terminal
receipt is 3,172 bytes at SHA-256
`d5ee65d583a705ff4c5aac1d2149e6e87234da658f0fac0de5388df93e4afd5a`.

Read-only diagnosis proved a source defect, not a reason to weaken the
verifier. Apache preserved the verifier query string, returning
`https://tinyrustlm.com/?release_smoke=...` instead of exact
`https://tinyrustlm.com/`. Root requests without a query already returned 301
to the correct origin and the required headers, but exact query-free redirect
semantics were part of the registered contract. V1 therefore remains immutable
`terminal-failure`. It was not rerun, repaired, overwritten, or relabeled.

Failure-preservation commit
`b338958` froze the receipt, its digest, the failure classification, and UAI
memory before source correction.

## Corrected V2 Publication

A regression first required the sole product redirect to include Apache's
`QSD` flag and failed against the v1 source. The narrow source correction then
added `QSD`, replaced the current executable generator and publisher with v2
identity, removed v1 executable acceptance, and retained v1 only as immutable
historical data.

Corrected source commit
`f8336953370e0f4a9ee86902773f0c42cee0b84b`, tree
`f67c618e8ad4580d0d94c34f6edf1982fe7a0f20`, was pushed before v2
registration. V2 registration commit
`70aa46f67fe1ec8e118bb2b1143bd204a26d1c68` was then pushed and proved
four-way exact. Its 3,994-byte manifest has SHA-256
`c84b0c0e1a6280bf03b6b3610b474ad1572d7f4e3311a9df37b85fc5778db273`.
It bound the exact eight-file state left by v1, one new operation identity, one
new receipt, and one changed member only.

Create-only operation `lmcomposer-site-1.0.0-20260826-v2` was invoked exactly
once. It skipped seven exact members, published only `.htaccess`, and passed:

- six exact public member readbacks;
- three query-bearing 301 redirects to exact `https://tinyrustlm.com/`;
- required `Referrer-Policy`, `X-Content-Type-Options`, and `X-Frame-Options`;
- protected-path non-readability; and
- the final eight-member inventory and identity checks.

The v2 terminal receipt is 3,176 bytes at SHA-256
`acb4b813b7367dcc46c2e7d2225811c3433d7fff8cf5c971f472660b900f7bc0`
with status `published-and-readback-verified`, one published member, and seven
already-current members. A separately executed read-only HTTPS check reproduced
all six file identities and all three redirects. Its bounded 2,081-byte receipt
has SHA-256
`9e8428a095c03065819d8c97664e8d624f6d8879f07b261142c590fa0f3b6b56`.

Final LMComposer evidence commit
`1652a1dff036cf88a1d95d06676edee576e2dc97`, tree
`1e49f87642fc501ccde539324013eef0131e9e27`, is clean, pushed, freshly fetched,
and local/tracking/FETCH_HEAD/direct-remote exact. Its complete suite passes
20/20.

## Fresh Ecosystem Readback

After LMComposer publication, one fresh read-only ecosystem sweep observed:

| Surface | Fresh bounded result |
| --- | --- |
| TinyRustLM.com | Finalized 23-artifact local release validation passed; 22 public files totaling 1,931,901 bytes were exact; all five retired model paths returned exact 404. Release remains 0.3.0; no new TinyRustLM.com write occurred. |
| TinyRustLM.MiRust.com | 22 exact public files totaling 555,030 bytes and six route smokes passed. Existing 1.7.0 terminal publication was not replayed. |
| MiniModel.MiRust.com | 31 exact public files totaling 297,292 bytes and four route smokes passed. Existing 1.0.0 terminal publication was not replayed. |
| MiniModel.org | 32 exact public files totaling 545,679 bytes and five route smokes passed. Existing 1.0.0 terminal publication was not replayed. |
| Runtime.MiRust.com | Seven exact redirects and six unique destination HTTP 200 checks passed. No Runtime write occurred; its known-misbound profile remains forbidden. |
| LMComposer.com | V2 published and independently reproduced six exact public files, three query-free 301 redirects, required headers, and protected-path behavior. |
| MiRust.com | Public root remains reachable, but reachability is not publication evidence. Authenticated production inventory confirms the source blocker below. |

## MiRust Production Boundary

The MiRust source repository remains only a 32-file bounded discovery,
policy, and public-metadata checkout. A read-only authenticated listing of the
actual production root found 41 root entries, including a mutable WordPress
installation with `wp-admin`, `wp-includes`, `wp-content`, `wp-config.php`,
logs, caches, backups, uploads, plugins, themes, and upgrade state.

That live host cannot be treated as source or mirrored into Git. It contains
secrets, mutable user/content state, runtime caches, and host-owned files. The
partial repository cannot be uploaded over it without risking data loss and
cannot support an immutable full-publication claim. Completing MiRust requires
a separately authorized sanitized production-source closure, database/content
migration and backup contract, secret/config separation, exact manifest,
rollback plan, clean source checkpoint, and WordPress-aware readback. None was
available in this operation, so no MiRust write was attempted.

## Final Decision And Remaining Blockers

The accurate result is:

`six-published-surfaces-exact-runtime-redirect-exact-mirust-deployment-blocked`

This is more complete than the prior reconciliation because LMComposer now has
a real successful publication and independent readback. It is not honest to
call the entire ecosystem newly deployed:

1. MiRust.com still lacks a complete safe production release closure.
2. Runtime.MiRust.com is exact-current, but its profile remains misbound and
   cannot authorize any future changed write.
3. The already-finalized sites had no changed bytes or pending release and
   were correctly verified rather than replayed.

## Exact Resume And Claim Boundary

After this report and its nine UAI routes are committed, pushed, freshly
fetched, and proved four-way exact, deployment work should resume only when one
of the two remaining external prerequisites changes: a safe complete MiRust
closure or a corrected Runtime-only profile plus a real changed Runtime
release.

Otherwise resume the already planned output-free preregistration for one
maintained read-only Qwen3 numerical source-terminal verification. Do not rerun
the accepted Tokenizer2 browser operation, the closed numerical owner, its
failed ad hoc verifier, or either LMComposer operation.

This deployment work proves static release bytes, redirects, headers, and the
stated publication receipts only. It proves no model qualification, numerical
parity, real browser model execution, P2P availability, MemoryEndpoints
behavior, package publication, or campaign completion. Counters remain exactly
0/20 qualified models, 0/50 clean browser rounds, 0/25 live memory rounds,
0/40 externally proven P2P lanes, and 0/20 catalog announcements.
