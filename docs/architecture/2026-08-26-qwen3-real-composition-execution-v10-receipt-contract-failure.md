# Qwen3 Real Composition Execution `/10` Receipt-Contract Failure

Date: 2026-08-26

Status: terminal failure; registration closed; candidate bytes preserved but
not structurally qualified

## Decision

Technical execution `/10` is complete and cannot be resumed or retried. Its
canonical public-safe result is
`contracts/vnext/qwen3-real-composition-execution-result.v10.json`, 18,447
canonical ASCII/LF bytes at SHA-256
`6978a4f9f886c9a85e3d42aeab6b7a2b99ed5e3928e188de7536a122245b6d03`.
The dedicated contract test is
`tinyrustlm/tests/qwen3-real-composition-execution-result-v10.test.js`,
15,860 bytes at SHA-256
`fea846cfb96c7d1733566abfeb33e620abe47661015ff6c2dd7d2e3fd0b5dc16`
and passes 12/12.

The private final verification uses schema
`tinyrustlm.qwen3-composition-execution-verification.v6`, is 7,775 bytes at
SHA-256
`798d986531769156455f2e40398803b92777d45695d2b66b0bb1bd2205c423a5`,
and records `terminal-failure` with reason
`managed-inspection-process-not-pass`. The owner's read-only `verify` command
was invoked once after execution and reproduced the same decision, evidence
inventory, and output inventory without launching a material process or
writing evidence.

This is not a structural composition pass. It does not qualify, release,
adopt, publish, or grant campaign credit to the candidate output. The failure
is preserved rather than retried or repaired.

## Registered Source And Custody

The exact registration commit was
`eb14e731b889dfdd979cc56106840783c29f2a48`, tree
`85f48182af8918c0aab6bc3092d6d0d35d08a37a`. The registration was freshly
remote exact before environment materialization, both custody builds, owner
request materialization, owner preflight, owner execution, and read-only
verification. Source did not change during the operation.

The one Windows x64 MSVC environment materialization passed and selected:

- Visual Studio 2022 installation `17.14.37531.7`;
- MSVC toolset `14.44.35207`; and
- Windows SDK `10.0.26100.0`.

Both sole build-custody profile `/4` operations passed:

- Rust custody launched once, exited zero, and qualified the 240,128-byte x64
  scratch inspector at SHA-256
  `c27d42943b288d841c3457cee15549744eb73a2b049f657a425beed0579720a6`
  plus the 852,992-byte x64 converter at SHA-256
  `0072dc9fa4e3c7361ee86a77fae16401fe298d274262f24a05e829c14f58c45b`.
- Managed custody launched once, exited zero, and qualified an exact 19-file
  output directory. Its required 7,168-byte inspector assembly is SHA-256
  `1af34f574619141c20c7e811bc18c1039ef41a1c6d46e7a88702ffd639872fe8`;
  its 109,056-byte conversion assembly is SHA-256
  `8cdfd9b0cd757e1e028080c817bc275b6c17b9dfcce224b5bf0894fa6b6f41ae`.
- Both custody scratch inspections passed, retained stable helper identities,
  and bound owned `APPDATA`, `LOCALAPPDATA`, `TEMP`, and `TMP` state.
- Canonical custody summaries were materialized outside the custody roots and
  matched one read-only custody observation each byte-for-byte.

Passing build custody proves exact build observations only. It does not
qualify the generated composition.

## One-Shot Owner Outcome

The sole owner request is 11,608 bytes at SHA-256
`39b999970481e526c39e410a904e7c65cfb5f6a8a8cf22decfb904a00a0b50ec`.
Its read-only preflight was invoked once while the registered evidence and
output roots were absent. The owner's `execute` command was then invoked once.
It owned exactly one converter launch and one managed-inspector launch, with
create-only bounded raw streams and durable process terminals.

The converter exited zero and emitted no stderr. It created the exact ten-file
candidate inventory totaling 605,429,565 bytes:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `composition.acg2` | 896 | `af154f02efdcaf24b8512bf9a8a21d37d5304dda98cbc347f07fbaf4425cbf94` |
| `composition.attempt.json` | 711 | `a74c5ef3f75a2c6fdd6568090d139cc8a629ee8d18d864febaaf7cd19028a1b9` |
| `composition.conversion-receipt.json` | 4,617 | `b5efcc1767bbfe57c3444b4bd9112bee9cb2843e036fbb978bf77df2fe92b933` |
| `model.slm2` | 598,308,416 | `a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7` |
| `model.slm2.conversion-receipt.json` | 5,554 | `9c67056542daab3790d1bd9c9b649c8024650960231bdf32a26cf52361fdf1fe` |
| `prompt.prompt2` | 512 | `27aaed18b62930213a2395e398e68d18a90d4280e24c23d794e3e94352d7e1f3` |
| `sampling.sampling2` | 65,800 | `9e02fcfbba169330a2ee1bf40cea015dc4067925e051f6ae5f197a5f880bfe89` |
| `template.template2` | 1,403 | `5300b0b43188a8c73ed62e7e4fbab6eff358ae0395166791852b072a8009c9c8` |
| `tokenizer.tokenizer2` | 7,038,773 | `cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b` |
| `tokenizer.tokenizer2.conversion-receipt.json` | 2,883 | `c17235416ca903466aba09eb48fe6f7dfd5c1f8911d6227bb03f532a0f971728` |

Those bytes remain private and immutable. Exact identity does not make them
structurally qualified because independent managed inspection did not pass.

## Terminal Managed Rejection

The owner created one canonical 1,387-byte managed intent at SHA-256
`ecbd303fcc94ddf138c0609043a0887b212a174100f891ab48b7c57b84ee38ff`.
The registered .NET 10.0.11 runtime and inspector assembly remained unchanged.
The sole managed process:

- started once;
- exited `1` without timeout or output overflow;
- emitted zero stdout bytes;
- emitted a 136-byte private typed error at SHA-256
  `206d2a437e3b5de059ed15e64086699c86decfa054281ce3007b16eb2a7ca429`;
  and
- recorded error code `converter-receipt-contract`.

The final owner reason is intentionally the process-level
`managed-inspection-process-not-pass`. The public result separately records
the bounded managed typed error and the established source-level cause.

## Established Root Cause

The registered Rust producer had one internally consistent durability
contract:

1. `qwen3_composition.rs` called the durability owner with child operation ID
   `parent-operation-id + "-members"`.
2. The durability owner returned status `performed` only after the platform
   directory flush call succeeded.
3. The composition receipt copied that child operation ID and status without
   translation.
4. The immutable candidate receipt contains the exact parent, exact
   `-members` child ID, status `performed`, and structural producer status
   `verified`.

The registered managed verifier independently required a different shape:

- durability operation ID equal to the parent operation ID; and
- durability status equal to `flushed`.

No producer emitted those values. The verifier therefore rejected a receipt
that matched the registered Rust producer's actual contract. This is
cross-language verifier drift, not evidence that the candidate passed managed
inspection. The exact registration-time producer and verifier source
identities are bound in the public result.

## General TDD Correction

The correction was made only after `/10` had reached its immutable terminal
decision. It does not modify, reinterpret, repair, or qualify `/10`.

The sole managed verifier now requires:

- exact durability child operation ID
  `receipt.OperationId + "-members"`; and
- exact durability status `performed`.

The normal managed fixture now emits that producer-defined shape. Two negative
fixture scenarios preserve the former incorrect assumptions:

- `durability-operation` emits the parent ID and must fail with
  `converter-receipt-contract`; and
- `durability-status` emits `flushed` and must fail with the same typed code.

The focused `ConversionToolTests` class passes 45/45 after the correction. The
complete managed core suite passes 86/86. The affected owner, owner-profile,
`/10` registration, immutable `/9` result, and `/10` result Node union passes
50/50. The Rust converter package passes 34/34 across unit, model-conversion,
and Tokenizer2-conversion targets.

The serialized repository standard partition passes 1,469, fails zero, and
retains exactly two declared skips across 1,471 tests. The enclosing
release-surface runner then correctly stopped with
`release_gate_source_not_clean` because this correction and result closure had
not yet been committed. That run is incomplete release evidence, not a release
pass. A complete release-surface run is required from the exact clean,
remote-verified correction commit before a successor may be registered.

No dual acceptance, migration reader, alias, fallback, or compatibility rule
was added. The Rust producer did not change.

## Evidence And Claim Boundary

All 15 registered private logical names are burned. Every created request,
environment record, custody root, build output, owner evidence record, raw
stream, process terminal, candidate byte, and final verification remains
immutable outside Git. Nothing may be:

- rerun or resumed;
- deleted, overwritten, cleaned, repaired, or completed after the fact;
- copied or adopted into a later registration;
- relabeled as a structural pass;
- used as source/native parity, native runtime, browser-WASM, browser-chat,
  quality, P2P, catalog, package, deployment, or MemoryEndpoints evidence; or
- counted toward any campaign target.

The public result exposes no absolute private path, raw process stream, prompt,
credential, or model content.

## Required Next Operation

A future composition operation requires a wholly new output-free registration
that binds the commit and tree containing this correction. Because the managed
assembly changes, both source-derived custody builds and every private request,
root, execution ID, process terminal, and verification identity must be new.

The new registration must be committed, pushed, freshly fetched, and exact
across local `HEAD`, tracking, `FETCH_HEAD`, and direct remote before any new
private material exists. The new operation may run once. A structural pass
would permit only the next numerical-parity phase; it would still not prove
native inference, browser inference, conversation quality, P2P availability,
publication, or campaign completion.

MemoryEndpoints remains unauthorized and disconnected. Campaign counters
remain exactly `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
