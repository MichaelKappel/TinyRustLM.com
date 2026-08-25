# Qwen3 Real Composition Execution Controller And Registration /1 Result

Date: 2026-08-25

## Decision

Execution registration `tinyrustlm.qwen3-real-composition-execution/1` is
closed as a terminal pre-launch failure. Its registered offline release build
completed successfully, but the private evidence root acquired copies of the
two build logs before `execution.binding.json` was created. No binding, start
record, converter stream, terminal record, managed verification, output root,
converter process, or composition artifact exists.

The bounded public result is
`contracts/vnext/qwen3-real-composition-execution-result.v1.json`. It records
only public-safe logical names, hashes, sizes, timestamps, statuses, and claim
boundaries. Absolute private paths and raw build output remain outside Git.

The exact root cause of the interrupted binding operation was not established.
The result therefore records the observed failure boundary instead of
inventing a diagnosis. Registration `/1` will not be resumed, retried,
repaired, deleted, overwritten, or relabeled. Its private directory remains
immutable historical evidence.

## Build Observation

The sole `/1` build ran from remote-exact commit
`823b03641984c395cab8e37f0fd28af6d6dcb6a5`, tree
`eb3ad026baf1aa439300dc04af28902c66be2378`, with the registered locked,
offline Windows x64 command. It exited zero. The resulting PE x86-64
`tinyrustlm-convert.exe` is 836,096 bytes at SHA-256
`5bb266e1b2a722b34845e09cb86fbcb353c8c9f6325f6738df7745b3c31a96e5`.
This is historical build evidence only; it is not conversion evidence.

The build stdout is empty at SHA-256
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
Build stderr is 1,874 bytes at SHA-256
`1213b18ef1c3159943ddbb64ecebf00d009697cce8ce1b81db3fa59d0adcfdcb`.
The raw bytes remain private.

## Controller Boundary

`tinyrustlm/tools/qwen3-composition-execution-controller.js` now owns the
private evidence envelope around one registered converter process. It does not
convert tensors, parse SLM2, judge quality, activate a model, publish bytes, or
communicate with MemoryEndpoints. The Rust `qwen3-composition` command remains
the sole complete-composition writer, and the managed conversion library
remains the independent durable inspector.

Before any evidence root is created, the controller requires:

1. canonical, bounded, path-bearing private request bytes;
2. exact profile, controller file, and Node executable identities, including
   Node version, platform, and process architecture;
3. clean local, tracking, and `FETCH_HEAD` commit equality;
4. exact build logs, executable size/hash, and PE machine;
5. streamed validation of every model and tokenizer source member against its
   source lock;
6. matching model ID, revision, and shared source records;
7. exact corrected composition-profile identity;
8. direct non-reparse source and parent directories;
9. pairwise non-overlap of source, evidence, and output trees; and
10. absent evidence and output roots.

Only after all checks pass does it create the private evidence root. The first
member is a create-only, fsynced canonical binding. A create-only start record
then authorizes launch ordinal one. The controller rehashes the executable
immediately before launch, starts exactly one owned child, captures stdout and
stderr separately into bounded binary files, terminates its own child on
timeout or stream overflow, rehashes the executable after exit, streams the
bounded output inventory, and writes one create-only terminal record.

An existing evidence root or output root is terminal. The controller has no
resume, retry, overwrite, cleanup, repair, best-of-N, compatibility, migration,
alias, or fallback path. `preflight` is read-only and cannot create evidence or
launch a process. `execute` is the only launch command.

## Independent Verification

A controller candidate pass is deliberately not a structural pass. It only
means the process started, exited zero without signal, stayed within duration
and stream bounds, wrote no stderr, preserved its executable identity, emitted
a summary with status `pass`, and left ten direct output files.

Final structural acceptance still requires the managed
`TinyRustLmConversionTool.InspectCompositionTerminal` owner to independently
rehash and parse the complete output and write separate create-only private
verification evidence. Source-framework parity, native inference,
browser-WASM inference, untouched quality, browser chat, P2P, catalog, and
publication remain later gates.

`dotnet/tools/TinyRustLM.CompositionInspector` is the sole command surface for
that read-only managed inspection. It accepts exactly `inspect` plus one
canonical absolute path to a bounded, direct, non-reparse intent file. The
intent uses the existing immutable managed composition-intent schema. Unknown,
duplicate, reordered, compacted, noncanonical, oversized, relative, changed,
or unreadable input fails closed.

The inspector calls only `ValidateCompositionIntent` and
`InspectCompositionTerminal`; it contains no process-launch API and cannot
invoke the Rust converter. Exit zero means a durable pass was independently
rehashed and parsed. Exit two means a durable native rejection and attempt
lineage were verified. Exit three means no mutually exclusive terminal result
exists. Exit one is a bounded typed inspection failure. Stdout and stderr are
mutually exclusive canonical UTF-8 LF JSON. Error output contains only a safe
code and never a source, output, or credential path.

The command implementation is internal to the conversion assembly and shared
with the thin executable through an explicit friend-assembly boundary. This
keeps serialization and verdict semantics under the same 43-test conversion
corpus without adding a second public SDK API. The complete managed solution
passes 207/207 tests and a warnings-as-errors Release build.

## Claim Boundary

This checkpoint proves a preserved `/1` pre-launch failure and a tested
controller implementation. It does not prove a real conversion, valid
composition, runtime output, browser output, useful model, peer availability,
catalog announcement, deployment, MemoryEndpoints continuity, or campaign
credit. Counters remain 0/20, 0/50, 0/25, 0/40, and 0/20.
