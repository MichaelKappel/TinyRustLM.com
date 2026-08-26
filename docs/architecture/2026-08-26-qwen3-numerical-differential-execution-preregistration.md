# Qwen3 Numerical Differential Execution Preregistration

## Decision

`contracts/vnext/qwen3-numerical-differential-execution-preregistration.v1.json`
defines one output-free numerical operation for the structurally accepted
Qwen3-0.6B composition produced by composition execution `/12`. It is the sole
source of child-request data for the publisher source-framework arm, the
independent reconstructed-weight arm, the Rust scalar arm, and the read-only
first-divergence verifier. The canonical registration is 24,467 bytes at
SHA-256
`469e003e6f50cb3e4bb0574e2bd72c5836edb938eea0345ca1a23b4bfc9906a1`.

This is a technical preregistration for one prelaunch product. It does not
introduce another product version, an old reader, a compatibility route, a
migration, a fallback, or an alternate numerical authority. The registration
does not run a model and does not create a trace, request, evidence root, or
verdict.

## Source And Candidate Closure

The registration parent is commit
`aece952422313fce4f55e04bf5f6a4d628d9c8a1` with tree
`ecf22c16582e42336120809b95f4101a228bdddb`. At registration time, local HEAD,
tracking, `FETCH_HEAD`, and the direct remote branch agreed on that commit and
the worktree was clean.

The parent contains the report-derived numerical profile, exact offline
environment lock, three material executors, sole execution owner, read-only
verifier, source lock, scalar profile, and `/12` structural result. The
registration rebinds all eleven source-controlled inputs by relative path,
byte length, and SHA-256. The registration commit is permitted to change only:

1. the preregistration JSON;
2. its contract test;
3. this architecture account; and
4. the contract-family README route.

The pinned nine-file `Qwen/Qwen3-0.6B` source closure at revision
`c1899de289a04d12100db370d81485cdf75e47ca` was streamed and rehashed before
registration. The closed `/12` `model.slm2` was independently read back as
598,308,416 bytes with SHA-256
`a0e351cdba8a4567d703e0f77c73c77ed08f783bb5420a19dfeef733c97cb2e7`.
Those observations establish input identity only. The structural candidate may
be read for this diagnostic, but it may not be modified or promoted from this
registration.

## Exact Executable Closure

The owner contract binds executable basenames, lengths, and SHA-256 values for
Git, the pinned Python interpreter, Node, the Rust scalar probe, and Windows
process-tree termination. The scalar executable was built outside Git from the
registration parent with:

```text
cargo build --locked --offline --release -p tinyrustlm-numerical-probe
```

The build used `rustc 1.96.0` and `cargo 1.96.0` for
`x86_64-pc-windows-msvc`. Its executable is 319,488 bytes at SHA-256
`a15a09aed375f764ae981c33e5710667990f84b29134e966e22aef9b036a4827`.
No local executable path appears in the public registration. The private owner
request must supply absolute direct paths, and the owner must rehash each
executable immediately before use and again after every material child.

## Sealed Token Cases

The operation uses token IDs rather than raw text. It has three cases and seven
total token steps:

| Case | Token count | Purpose |
| --- | ---: | --- |
| `low-vocabulary-boundary` | 1 | Exercise embedding row zero and one empty-cache step. |
| `repeated-kv-position` | 2 | Exercise repeated input with position and KV growth. |
| `high-vocabulary-mixed-cache` | 4 | Exercise the highest valid row, mixed IDs, and longer cache reuse. |

Each little-endian U32 token stream has a preregistered SHA-256. There is no
prompt text, expected answer, generated continuation, seed search, sampling,
or behavioral score. Every case starts with empty KV state and advances in the
same registered order in all three arms.

For Qwen3-0.6B, one token emits 526,720 float32 elements across 255 ordered
stages, or 2,106,880 bytes. Seven steps therefore require exactly 14,748,160
trace bytes per arm and 44,244,480 bytes across the three material arms. The
scalar four-token sequence has exact reserved KV budget 917,504 bytes and
scratch budget 673,296 bytes from the registered model geometry.

## Threshold Policy

Thresholds were fixed before any real trace output. They are engineering
acceptance margins, not observed outcomes and not claims that a particular
case will pass.

The first arrow compares publisher FP32 weights with the converted mixed-Q8
reconstruction. Quantization is expected, so this arrow uses bounded
coordinate margins together with tighter normalized error, cosine, sign, and
top-20 overlap requirements. It does not require greedy-token identity. Direct
embedding, normalized, activated, and logits stages have explicit overrides
where their scales and sensitivity differ from the default.

The second arrow compares two interpretations of the same converted bytes.
It is correspondingly tighter, requires exact top-20 membership and greedy
token identity, and requires exact token-embedding equality. Its residual,
activated, and logits stages have explicit bounded overrides for different
reduction orders and host `exp` implementations.

Both arrows use a relative floor of `1e-6`, a sign floor of `1e-5`, fixed
65,536-element chunks, and stable top-20 ordering. Every threshold contains:

- maximum absolute error;
- maximum relative error;
- maximum normalized RMSE;
- minimum cosine similarity;
- maximum sign-disagreement rate; and
- maximum float32 ULP distance.

The verifier reports the first failure in registered arrow, case, step, stage,
layer, element, and chunk order. A failed bound closes the operation. Output
cannot be used to search or loosen a threshold, and a failed trace cannot be
repaired, rerun, deleted, overwritten, or adopted.

## Sole-Owner State Machine

The operation ID is
`qwen3-numerical-c1899de-aece952-20260826-v1`. Six future private basenames
are derived from it: one owner request, one owner evidence root, one source
scratch root, and one output root for each material arm. Before this
registration was written, the existing private parent was observed as a
direct non-reparse directory and all six names were absent. The public file
contains only those basenames, never the parent path.

After the registration is committed, pushed, freshly fetched, and direct
remote exact, a separate step may materialize one canonical owner request. The
owner then:

1. validates the registration and its commit-only path closure;
2. validates parent-commit bytes for all eleven implementation artifacts;
3. rehashes all five executables;
4. proves every registered private name remains absent;
5. derives every child request from the registration;
6. creates bounded start and binding evidence;
7. launches source, reconstructed, scalar, and verifier in that exact order;
8. launches each stage at most once;
9. prevents later launches after any failed or ambiguous stage; and
10. writes one immutable owner terminal.

Each material stage has a four-hour process ceiling; the verifier has one
hour. Stdout and stderr are each bounded to one MiB. Any stderr byte, timeout,
overflow, spawn fault, stream fault, nonzero exit, signal, executable drift,
or malformed verifier receipt prevents pass. Windows termination is bound to
the exact registered `taskkill.exe` plus direct child kill.

## Evidence And Claim Boundary

The registration commit itself can establish only that a bounded operation was
defined before private output. It cannot establish that the operation was
executed. A future terminal pass would establish only the two registered
numerical arrows for these seven diagnostic token steps under these exact
executables and limits.

It would still prove no optimized native kernel, browser-WASM execution,
browser chat, conversational usefulness, P2P availability, catalog entry,
package or site release, or campaign completion. MemoryEndpoints remains
unauthorized. Campaign counters remain `0/20`, `0/50`, `0/25`, `0/40`, and
`0/20`.

## Next Gate

Run the preregistration tests and the existing owner-focused suite, then commit
exactly the four allowed paths. Push and freshly verify local HEAD, tracking,
`FETCH_HEAD`, and the direct remote branch. Only after that equality proof may
the private owner request be created. The owner may be invoked once. Whatever
terminal result it produces is immutable.
