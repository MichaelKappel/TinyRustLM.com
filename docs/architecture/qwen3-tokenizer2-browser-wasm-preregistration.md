# Qwen3 Tokenizer2 Full-Artifact Browser-WASM Preregistration

## Status

On 2026-08-21, the production-shaped Tokenizer2 WASM boundary and one exact
full-artifact real-Chromium experiment were frozen before producing any
full-artifact browser-comparative output. The same Rust Tokenizer2 core passes
native tests, Node WASM replay, and a miniature real-Chromium replay with zero
network requests and proven owned-profile deletion.

This is a preregistration checkpoint only. It is not full-artifact browser-WASM
parity, production resource evidence, Template2 evidence, model-runtime
evidence, model quality, release authority, deployment evidence, or campaign
credit. The registered output root
`qwen3-tokenizer2-browser-wasm-20260821-v1` does not exist at this checkpoint.
It must remain absent until this implementation is committed, pushed, and
verified against a fresh remote readback.

## Exact Authorities

| Authority | Exact identity |
| --- | --- |
| Registration parent | `21a6b733959ad48c9c04cbcb08f47cf4e55fa99f` |
| Tokenizer2 artifact | 7,038,773 bytes; SHA-256 `cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b` |
| Artifact shape | 151,669 tokens; 151,643 base tokens; 26 added tokens |
| Frozen corpus | 2,048 cases; 464,043 bytes; SHA-256 `9503fd6df325f1a46dec56674d2aa72ce225d6bf1c9477abd56bb4542ef99caa` |
| Native candidate result | 1,697,228 bytes; SHA-256 `ac571be6710b9064ee420e680deaf21a6a2d2e0d1099512c19767160f4aac290` |
| Native parity receipt | 3,974 bytes; SHA-256 `4ebbfa2bc59d43bdbcd5b3b2528bed66035ff2a3165f554ac6867e7cc7fe0ea6` |
| WASM interface | 4,030 bytes; SHA-256 `375c270b6836968eddd53bca6523dd1461dd5d77dc537be11f1fd78be9ad4d99` |
| Release WASM module | 320,996 bytes; SHA-256 `058c6ffb494e90b101409951ba78b4fc7d8098a868c861a276ef3f415ede27cc`; zero imports |
| Browser adapter | 11,829 bytes; SHA-256 `bf0f5f68925322fdbc166178add363288f9a45b3231153a4974238d040b1e049` |
| Browser runner | 40,602 bytes; SHA-256 `690d43695562485707e3a971ffe21d2b000c817c52129f09ecf6fc6d79000316` |
| Independent verifier | 26,486 bytes; SHA-256 `3b1a42c003338c62a9e0a488bd4146a0d4dfc02c6d9e6038460fc3736abe0a52` |
| Registered source closure | 24 files; SHA-256 `f56d4ec7ea31bcd03999785ebf631121ae9288c7ef2816a59af97f8fb99cc031` |
| Execution preregistration | 9,343 bytes; SHA-256 `8734360e7fc2e0d4cb4f6ace87e2b5ec2922f983eededa7f5b246fad928050f3` |
| Verification preregistration | 2,453 bytes; SHA-256 `560347bb1db2f1299bc3f54d5e2a8a5d6adbb26e1a55b908c4bb754d72f540a2` |
| Playwright manifest | version 1.61.1; 754 bytes; SHA-256 `9d8556509e073169efec663b7f71c13f17d7002b307d00d48bf88ee91c387f3e` |
| Chromium executable | version 149.0.7827.55; 4,059,648 bytes; SHA-256 `b798f9e53a98d29eb7f36f8c409f905d3184780a04d2bcb56989067194784bd1` |

The artifact counts above are read from the exact Tokenizer2 header, not from
the Qwen model configuration. The execution profile binds all three counts.
The runner and verifier consume that registered shape rather than carrying a
second vocabulary-size constant.

## WASM Boundary

`rust/crates/tinyrustlm-tokenizer2-wasm` exposes one raw, typed, import-free
WebAssembly boundary around `tinyrustlm-tokenizer2`. JavaScript transports
bytes only. Rust owns UTF-8 validation, artifact parsing, encoding, decoding,
special-token handling, bounded output, stable errors, and transactional
artifact activation.

The interface requires caller-owned allocations with exact pointer and length
pairs. It limits each transfer and artifact to 16 MiB, input to 32 KiB,
encoded output to 65,536 token IDs, and decoded output to 128 KiB. A failed
artifact load cannot replace the active tokenizer. `clear` removes active
tokenizer state and output state. No JavaScript tokenizer, JSON tokenizer,
network loader, SLM1 path, compatibility reader, or fallback exists.

The browser adapter validates the exact import and export surface before it
accepts an instance. It copies inputs into Rust-owned allocations, copies
results out before releasing them, and reports the active artifact length,
SHA-256, total token count, and base-token count from Rust.

## Registered Execution

Exactly two independent Chromium runs are required, in order. Each run owns a
fresh persistent profile under a separately owned profile root. The runner
must close every browser process, delete the profile, remove the profile root,
and record deletion before that run can be accepted.

Each run loads the exact registered WASM module and full Tokenizer2 artifact,
then processes all 2,048 corpus cases in frozen order. For every case it
preserves the case ID, exact token-ID array, exact include-all decoded Unicode,
and exact skip-special decoded Unicode. The raw run documents remain private
outside Git. There is no retry, output repair, best-of-N selection, case
reordering, or reuse of prior output.

The browser page is `about:blank`; service workers are blocked; every page
request is aborted and counted. Acceptance requires zero network requests,
zero console errors, and zero page errors. The runner rehashes the
preregistration, artifact, WASM module, native receipt, native result, and
Chromium executable after observation.

## Cancellation And Recovery

Run 1 performs the registered cancellation branch. A dedicated worker loads
the real WASM module and full artifact, acknowledges that real tokenizer work
has started, and enters 100,000 registered encode/decode iterations over the
longest frozen case. The page terminates that worker rather than asking it to
cooperate. A 500 ms quiet period must show no completion message.

A new worker then loads the same module and artifact from scratch and executes
the first frozen recovery case. Its token IDs and both decode modes must match
the registered native result exactly. Run 2 does not repeat cancellation; it
provides an independent complete-corpus replay in a separate profile.

## Resource Evidence

Each run records WASM instantiation time, artifact-load time, corpus encode
time, both corpus decode times, and total operation time. It records WASM
linear memory before load, after load, after the corpus, at the observed high
water mark, and after clear. JavaScript heap values are recorded when Chromium
exposes them and explicitly marked unavailable otherwise.

The registered operation ceiling is 15 minutes, worker-load ceiling is three
minutes, and WASM linear-memory ceiling is 512 MiB. Timing is observational;
exact token and Unicode identity remains the semantic authority. A resource
ceiling failure is terminal for this registration and cannot be converted into
a skip.

## Independent Verification

The verifier has a separate preregistration and exactly one authorized
invocation. It validates both browser run schemas, all registered identities,
fresh-profile evidence, process closure, deletion, network isolation,
cancellation, recovery, and resource bounds. It then compares every browser
case to the immutable native candidate and compares both browser runs to each
other.

JSON object member order is nonsemantic. Arrays, primitive types, primitive
values, case order, token order, and Unicode strings are semantic. Any mismatch
is fatal. The create-only verification result excludes prompts, decoded text,
token IDs, and private absolute paths. A terminal failure is written to the
same registered create-only result path and does not authorize a receipt or a
retry.

## Next Action

Precommit verification passes the focused browser preregistration tests 6/6,
the WASM-boundary tests 5/5, the preserved native preregistration tests 14/14,
both affected Rust scopes, and the canonical standard Node partition
1,011/1,011 with zero failures or skips. The aggregate launcher then refused
to issue release evidence with `release_gate_source_not_clean`, as required,
because this implementation was not yet committed. Release-surface evidence
must be created from the ensuing clean implementation commit.

Clean implementation commit
`4461ee0c3c09f42ae44bf1eb9dd0d76ffe0bc8dc` then passed the complete
repository gate. The canonical standard Node partition passed 1,011/1,011.
Release run
`c857474c1737af06714b5e56da8b15b46d4683504e8370258bd9479f89cbd017`
passed 23/23 tests in 10 exhaustive shards. Its 3,995-byte aggregate has
SHA-256
`b6416f47539093f3ea5a31dbfa60379a7288a8cca5fcc60be90646613bbd8b21`,
and the independent verifier returned the same identity and pass verdict.
The external evidence retains 12 append-only attempts: two outer-wrapper
interruptions and one passing-but-unreceipted shard-8 child output remain
incomplete history; only the 10 verified shard receipts authorize the
aggregate.

1. Commit this bounded result/UAI checkpoint and push both local commits.
2. Fetch the remote afresh and prove local HEAD, tracking state, `FETCH_HEAD`,
   and the actual remote branch are identical.
3. Reprove that the registered output root is absent.
4. Execute the registered runner exactly once, followed by the registered
   verifier exactly once if and only if both raw runs complete.
5. Preserve any terminal failure. On success, record the bounded result and
   advance to Template2 without claiming model-runtime or campaign evidence.

Campaign counters remain 0/20 models, 0/50 browser rounds, 0/25 live memory
rounds, 0/40 outside-proven lanes, and 0/20 announcements.
