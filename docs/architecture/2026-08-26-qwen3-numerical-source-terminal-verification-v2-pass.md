# Qwen3 Numerical Source-Terminal Verification V2 Pass

Date: 2026-08-26

Status: sole corrected verifier invocation passed and is closed; bounded public
result and tests are green; result checkpoint commit, push, fresh remote
equality, complete source gate, and durable-memory update remain pending

## Decision

Verification operation
`qwen3-numerical-c1899de-4891e8a-20260826-v2-terminal-verification-v2`
is terminal `pass`, reason `registered-expected-finding-established`.

The operation consumed exactly one corrected verifier invocation. It may not
be rerun, repaired, overwritten, adopted, or relabeled. Its private root and
three members are immutable.

The bounded public result is
`contracts/vnext/qwen3-numerical-source-terminal-verification-result.v2.json`,
7,739 bytes at SHA-256
`0261525e59aefe4c19e4a3d5ec2afc5e59b26c0ef718c9ddaf2761757c8cc4fe`.

## Registration Authority

The output-free V2 registration is 12,217 canonical bytes at SHA-256
`fc4a7500c427e56f3b178eeb4c48ebd0bd6754f5e513b1aef403da4a21d46ca4`.
It is remote-exact at commit
`747fc88662a379bdb7203269f13dcecdc99f5267`, tree
`402990bb00f5a0adcc7424b3d0cd307ac4e236e7`.

Before execution, local `HEAD`, tracking, freshly fetched `FETCH_HEAD`, and the
direct remote branch matched. The worktree was clean. The wholly new V2 root
was observed absent both before registration and at execution preflight.

The registration bound exact Node, termination tool, corrected verifier,
verifier tests, correction decision, immutable source-owner request and
nine-file evidence closure, expected finding, resource bounds, one invocation,
no network, no retry, create-only streams and terminal, and all-zero broader
claims.

## Preserved V1 History

V1 remains immutable `terminal-ambiguous`, reason
`verifier-rejected-and-process-terminal-writer-failed`. It was not replayed or
modified. Its 6,268-byte public result remains at SHA-256
`e27bbbf2e321bf79b6c7f9009427de191b492a9ab74537ba7751866e811076fa`.

The V2 pass does not retroactively turn V1 into a pass. It establishes a new
independent observation under corrected source, a new registration, a new
operation ID, and a new absent-at-registration root.

## Sole Invocation

The registered Node executable was unchanged before and after launch:

```text
byteLength = 91,380,224
sha256     = 63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088
```

The verifier process:

| Fact | Value |
|---|---|
| observed invocation count | 1 |
| process started | true |
| process closed | true |
| exit code | 0 |
| duration | 90 ms |
| timed out | false |
| stream overflow | false |
| termination requested | false |
| retry allowed | false |
| second invocation allowed | false |

The argument identity is SHA-256
`05823a5fae24465ff47a0ad242ef7a0a28116e3a11522ceddfb08b9aa4a99d15`.
No private argument or path is published.

## Exact Private Closure

The private V2 root contains exactly three direct regular files totaling 5,321
bytes:

| Logical member | Bytes | SHA-256 |
|---|---:|---|
| `verifier.stdout.bin` | 1,766 | `6cb27c8ab284acf053e3d0872c66a39b1902549f36a9b587d4e846000b62a90d` |
| `verifier.stderr.bin` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `verifier.process-terminal.json` | 3,555 | `eed9f38b0787ab67bb1b266d176af4cb56b0e3a4c365a66f88e3e3a08cedb3f9` |

The stdout is canonical JSON and exactly equals the registered finding plus
verification ID
`ac4a8b4495c0df1416dd7d7e367644e472d193521c68de63f422cda530d69a29`.
The process terminal is canonical compact JSON, was written create-only after
process close, and records terminal `pass`.

Raw stdout, stderr, metadata manifests, and private paths remain private and
outside Git.

## Read-Only Proof

Before and after the sole process, custody recomputed the exact source-owner
request and every member of the nine-file/13,143-byte source evidence closure.
It retained bounded metadata-manifest digests in the create-only terminal:

```text
source evidence before = 4936c9faa5f3f6bd22a8dab26f02bcea96ecf3a52f193876f30db1b17a77fdee
source evidence after  = 4936c9faa5f3f6bd22a8dab26f02bcea96ecf3a52f193876f30db1b17a77fdee
owner request before   = 3046553209988745f987561caa78268960d5555d74b83613bd710b867f61b412
owner request after    = 3046553209988745f987561caa78268960d5555d74b83613bd710b867f61b412
```

The source scratch root remained empty. Source, reconstructed, and scalar
material roots remained absent. Registration, verifier, Node, and worktree
identity remained unchanged. No write to source evidence was observed.

## Independent Closure Audit

After terminal creation, a separate read-only audit:

1. required the exact three direct regular members and recomputed every length
   and digest;
2. independently canonicalized stdout and compared it to the registered
   finding;
3. independently canonicalized the compact terminal and checked its operation,
   status, invocation, verification ID, read-only proof, and claims;
4. recomputed current source and owner-request metadata manifests and matched
   both terminal after-state digests;
5. rechecked empty scratch and absent material roots; and
6. confirmed the canonical source worktree remained clean.

The audit made no writes and did not invoke the verifier again.

## Corrected Contract Result

The exact process-terminal executable shape is `byteLength` plus `sha256`.
The registered Python artifact may additionally carry `basename`; the verifier
projects only the normative process identity before comparison.

The V2 finding proves the corrected verifier accepted the sole two-field shape
and independently reproduced the preserved source-owner terminal failure,
request/registration binding, process outcome, streams, owner decision,
evidence inventory, scratch emptiness, material-root absence, and immutable
closure.

It does not accept the former added-basename process-terminal shape. There is
no dual reader, compatibility route, translation, inference, repair, or
fallback.

## Allowed Claim

Allowed statement:

> The preserved Qwen3 source-stage terminal failure was independently verified
> once under the corrected, preregistered read-only contract.

This pass does not prove source-to-reconstructed numerical parity, scalar SLM2
correctness, optimized-native parity, browser-WASM parity, browser chat, model
quality, P2P availability, catalog announcement, package publication, site
deployment, or campaign completion.

MemoryEndpoints remains unauthorized. Counters remain exactly `0/20`, `0/50`,
`0/25`, `0/40`, and `0/20`.

## Next Gate

1. Validate the public result, terminal architecture, V1 preservation, V2
   registration, and exact private closure bindings.
2. Commit and push this bounded result closure.
3. Freshly fetch and prove four-way commit and tree equality.
4. Run the complete standard and protected release-surface gates from that
   clean checkpoint into a new external gate root.
5. Record exact gate evidence in durable UAI memory and push it.
6. Before source-to-reconstructed numerical work, author a separate output-free
   registration binding exact inputs, tolerances, capture points, resource
   limits, and wholly new private outputs.

Never invoke either source-terminal verification operation or the underlying
source owner again.
