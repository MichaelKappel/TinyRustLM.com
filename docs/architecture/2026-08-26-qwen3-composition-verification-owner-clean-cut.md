# Qwen3 Composition Verification Owner Clean Cut

Date: 2026-08-26

Status: implemented mechanism; no material execution authorized

## Decision

TinyRustLM now has one maintained source-controlled owner for a Qwen3
complete-composition operation:

`tinyrustlm/tools/qwen3-composition-verification-owner.js`

Its sole public mechanism contract is
`contracts/vnext/qwen3-composition-verification-owner-profile.v1.json`, with
profile identity `tinyrustlm.qwen3-composition-verification-owner/1`.

The prior `qwen3-composition-execution-controller.js` and its dedicated test
have been deleted from the maintained tree. Registrations `/1` through `/9`
retain their exact historical controller identities through immutable Git
objects and receipts. Those records are evidence, not an executable alternate
route.

This is a clean replacement inside one unreleased, unversioned product. It is
not a product generation, compatibility layer, migration, alias, fallback, or
second operating mode.

## Why The Replacement Was Required

Execution `/9` produced a real ten-file composition candidate, but its final
decision was terminal ambiguous for two independent evidence defects:

1. The caller did not create the two registered outer controller stream files.
2. The separately invoked managed inspector received a fully qualified path
   whose separators were not canonical for the Windows child contract.

Neither defect changes the candidate bytes into qualified bytes. Neither
permits reconstruction, retry, repair, adoption, cleanup, or reinterpretation.
The general correction is ownership: the component that authorizes execution
must also create every child stream, write every process terminal, construct
the inspector intent, invoke the inspector, and create the final verification.

## Contract Identity

The owner profile freezes these incompatible schema identities:

- request: `tinyrustlm.qwen3-composition-verification-request.v1`
- binding: `tinyrustlm.qwen3-composition-verification-binding.v1`
- start: `tinyrustlm.qwen3-composition-verification-start.v1`
- process terminal:
  `tinyrustlm.qwen3-composition-verification-process-terminal.v1`
- final verification:
  `tinyrustlm.qwen3-composition-execution-verification.v6`

The only commands are `preflight`, `execute`, and `verify`. `preflight` is
read-only. `execute` owns one irreversible operation. `verify` is read-only and
recomputes the terminal decision from durable evidence.

The next output-free execution registration must bind the exact profile and
owner bytes. The private request must then bind the exact registration, Git
commit and tree, Node runtime, process-tree termination tool, passing Rust and
managed custody summaries, converter, managed runtime, complete managed build
inventory, source locks, source inventories, composition profile, arguments,
limits, and wholly new absent private roots.

## Closed Request

The request is canonical UTF-8 JSON with final LF and a closed ordered shape.
Unknown, missing, reordered, or extended fields reject before evidence-root
creation. The request has five authority groups:

1. Registration binds repository, execution registration, owner profile,
   owner source, Node runtime, Git commit/tree/branch, and exact `taskkill.exe`.
2. Custody binds one passing Rust custody summary and converter identity plus
   one passing managed custody summary, runtime identity, inspector assembly,
   and the complete exact managed output directory.
3. Inputs bind model and tokenizer source locks, exact source directories, and
   the composition profile.
4. Invocation binds the private evidence and output roots, working directory,
   exact converter and inspector argument prefixes, all resource ceilings, and
   both terminal rules.
5. Execution identity binds the request to one future output-free registration.

No retry count, repair switch, resume marker, alternate command, best-of-N
selection, output-adoption flag, compatibility selector, or fallback field is
accepted.

## Preflight

Before creating either private root, the owner verifies:

- Windows x64 host and exact Node executable, version, platform, and
  architecture;
- exact current owner profile and owner bytes;
- exact registration profile and execution identity;
- local HEAD, tree, branch, tracking branch, and `FETCH_HEAD` equality plus an
  empty worktree;
- exact process-tree termination tool and PE x64 machine identity;
- canonical passing custody summaries with real child execution, passing
  scratch inspection, complete environment validation, no test-only mode, no
  retry, and no campaign authorization;
- exact converter, managed runtime, inspector assembly, and complete managed
  output-directory inventory;
- exact model and tokenizer lock bytes, complete direct non-reparse source
  inventories, and their shared publisher identity;
- exact composition profile;
- existing direct non-reparse private parent on `C:` or `E:` and never `D:`;
- repository, source, build, evidence, and output tree separation;
- one shared direct parent for the evidence and output roots;
- absence of both future roots; and
- exact converter and managed argument contracts and bounded resource limits.

An existing evidence root or output root is terminal. It is never resumed,
deleted, repaired, overwritten, or adopted by this owner.

## One-Shot State Machine

The `execute` command performs these transitions exactly once:

1. Run the complete preflight while both future roots are absent.
2. Create the evidence root without recursion.
3. Write and fsync `operation.binding.json` create-only.
4. Write and fsync `operation.start.json` create-only.
5. Rehash the converter executable.
6. Open `converter.stdout.bin` and `converter.stderr.bin` with create-only
   handles before spawning the converter.
7. Launch exactly one converter child with the registered six arguments.
8. Bound both streams and duration; terminate the owned process tree through
   the exact registered Windows tool on timeout or overflow.
9. Fsync and close both streams, rehash them and the converter, independently
   stream-hash the exact ten-file output, parse canonical raw stdout, and write
   `converter.process-terminal.json` create-only.
10. Continue only when process, streams, executable identity, canonical
    summary, exact output inventory, and summary-to-output identities all pass.
11. Construct `managed-inspection.intent.json` from owner-observed request
    facts. The caller cannot supply serialized intent bytes.
12. Convert every child path to exact native Windows spelling. UNC and relative
    paths reject.
13. Rehash the managed runtime and inspector assembly.
14. Open `managed-inspection.stdout.bin` and
    `managed-inspection.stderr.bin` create-only before launch.
15. Launch exactly one inspector with the exact runtime, assembly, `inspect`,
    and canonical intent path.
16. Bound duration and streams, rehash runtime and assembly, and write
    `managed-inspection.process-terminal.json` create-only.
17. Parse the canonical managed result and cross-check every verified
    composition member, receipt, graph identity, source lock, converter
    identity, output path, and required next gate against independently hashed
    bytes.
18. Write `execution.verification.json` create-only on the terminal path.

If a normal operation failure occurs after evidence-root creation, the owner
still writes a truthful final record when sufficient evidence remains to do
so. A crash, power loss, disk-full condition, or partial evidence root remains
terminal ambiguous and cannot authorize another launch under the same
registration.

## Two Terminal Rules

The composition library and outer operation intentionally have different
terminal scopes:

- Managed composition intent:
  `existing-output-root-is-never-resumed`
- End-to-end owner:
  `existing-evidence-or-output-root-is-terminal-and-never-resumed`

Conflating these strings would make the managed intent invalid. The closed
request therefore carries both fields and the owner constructs the managed
intent with only the composition rule.

## Evidence Inventory

One complete operation may contain exactly these ten names:

1. `operation.binding.json`
2. `operation.start.json`
3. `converter.stdout.bin`
4. `converter.stderr.bin`
5. `converter.process-terminal.json`
6. `managed-inspection.intent.json`
7. `managed-inspection.stdout.bin`
8. `managed-inspection.stderr.bin`
9. `managed-inspection.process-terminal.json`
10. `execution.verification.json`

The owner does not register or depend on its own console streams. Its CLI
summary is informational. Authoritative process streams are opened and owned
inside the operation before each child launch.

All JSON evidence is bounded and canonical. Large source and output artifacts
are hashed incrementally. Every write is create-only and fsynced. Unknown
evidence names, directories, links, missing files, changed lengths, changed
hashes, noncanonical JSON, or trailing bytes fail closed.

## Read-Only Verification

The `verify` command launches neither converter nor inspector and writes no
file. It:

- repeats registration, source, custody, executable, and inventory identity
  validation;
- parses the create-only final record;
- requires the exact evidence-root inventory;
- rehashes every referenced evidence edge;
- independently re-evaluates converter process and stream status;
- independently rehashes the ten output files;
- revalidates raw converter summary identities;
- revalidates the exact managed intent;
- re-evaluates managed process and stream status;
- revalidates the managed composition graph against output bytes; and
- requires its derived status, reason, and output inventory to equal the final
  record.

This is verification of durable evidence, not a second attempt. No material
process API is available on the verification route.

## Terminal Decisions

`pass` means only that one exact complete composition is structurally verified
from both native output and independent managed inspection. It may advance to
source-framework numerical parity.

`terminal-rejected` means the read-only managed inspector reached a typed
structural rejection. `terminal-failure` means a captured process or candidate
contract failed. `terminal-ambiguous` means required evidence is incomplete or
cannot be trusted. None authorizes retry, overwrite, repair, cleanup, or output
adoption under the same registration.

Even structural `pass` does not prove source-framework parity, native runtime
correctness, browser WASM correctness, browser chat, model quality, P2P
availability, catalog announcement, package publication, site deployment, or
MemoryEndpoints behavior.

## Tests

The dedicated owner tests cover:

- exact schema exports and closed ordered request validation;
- required Rust and managed custody shape;
- complete managed inventory requirements;
- native Windows path canonicalization and UNC/relative rejection;
- owner-built managed intent and distinct terminal rules;
- create-only durable writes and overwrite refusal;
- separate bounded byte-exact raw stream capture;
- overflow termination of only the owned child;
- canonical JSON rejection for compact, array, trailing, or changed bytes;
- complete evidence rehash and missing/drifted evidence rejection;
- streamed multi-megabyte hashing;
- synthetic end-to-end converter plus managed-inspector ownership;
- exact ten-file output and nine pre-final evidence edges;
- final structural pass derivation; and
- refusal to reuse a completed evidence root.

The owner-profile tests bind exact profile and owner bytes, schemas, commands,
evidence names, limits, terminal rules, nonclaims, and absence of the old
maintained controller. Release-cutover coverage also requires the old owner and
test to remain absent while allowing immutable historical records to retain
their exact names.

## Next Authorized Work

This implementation checkpoint authorizes no private operation. After complete
source and release gates pass, commit and push the mechanism, fresh-fetch the
branch, and prove local HEAD, tracking, `FETCH_HEAD`, and direct remote equality.

Only then create a separate output-free execution `/10` registration that:

- binds this exact owner profile and implementation commit;
- binds immutable `/1` through `/9` terminal history;
- binds current source, custody, tool, runtime, and format identities;
- reserves wholly new private request, build, evidence, and output names;
- observes every future name absent before registration;
- contains no output-derived identity; and
- is pushed and freshly verified before any private request or root exists.

Execution `/9` must never be retried or reused. MemoryEndpoints remains
unauthorized and disconnected. Campaign counters remain exactly `0/20`,
`0/50`, `0/25`, `0/40`, and `0/20`.
