# vNext Campaign-Plan Browser WASM Boundary

## Status And Authority

The campaign-plan verifier now has one generated raw WebAssembly boundary for
Node and real-browser callers. The browser transports exact bytes through the
generated adapter; it does not parse, normalize, repair, finalize, or validate
campaign-plan semantics in JavaScript. All semantic authority remains in
`rust/crates/tinyrustlm-evidence`.

This checkpoint proves exact plan finalization and final-wire validation in a
real Chromium WASM runtime. It does not implement Rust currentness, signature
authority, projection, production campaign-runner integration, release
authorization, or any objective campaign operation. The counters remain 0/20
models, 0/50 browser rounds, 0/25 live memory rounds, 0/40 outside-proven
lanes, and 0/20 announcements.

## Generated Contract

`contracts/vnext/campaign-plan-wasm-interface.v1.json` is the frozen interface
profile. Its SHA-256 is
`ea7c4de88bb40247b8c65594005a4964b4fd03937d00c6a865563b4f1a46f7ad`.
It binds:

- profile `tinyrustlm.vnext.campaign-plan-wasm.v1` and ABI version 1;
- `wasm32-unknown-unknown` and crate `tinyrustlm-evidence-wasm`;
- the 1 MiB campaign-plan input limit and 4 MiB module limit;
- all numeric statuses and raw export names;
- the exact zero-import and thirteen-export module surface;
- input, result, and error ownership rules; and
- the no-network, no-filesystem, no-clock, no-environment, no-repair policy.

`tinyrustlm/tools/vnext-campaign-plan-wasm-codegen.js` strictly reads that
profile and generates both sides of the transport contract:

- `rust/crates/tinyrustlm-evidence-wasm/src/generated_exports.rs`; and
- `tinyrustlm/tools/generated/vnext-campaign-plan-wasm.js`.

Tests regenerate both outputs in memory and require byte equality with the
checked-in files. Profile objects must contain only ordinary data properties,
are recursively frozen, and reject accessors, symbols, cycles, unknown fields,
wrong constants, repeated exports, or an expanded import/export surface.

## Typed Raw ABI

The generated module exports one memory and ten typed functions:

| Operation | Inputs | Result |
| --- | --- | --- |
| ABI version | none | exact `u32` version |
| Maximum input | none | exact `u32` byte limit |
| Allocate | `u32 length` | owned transfer pointer or zero |
| Release | pointer and exact `u32 length` | bounded status |
| Finalize plan | owned pointer and exact length | bounded status |
| Validate plan | owned pointer and exact length | bounded status |
| Result length | none | `u32` length |
| Copy result | owned pointer and exact length | bounded status |
| Error length | none | `u32` length |
| Copy error | owned pointer and exact length | bounded status |

Status 0 means success, 1 means an ownership or copy-boundary failure, 2 means
strict campaign-plan verification failed, and 3 means bounded internal-state
failure. JavaScript receives only stable snake-case error codes. Raw Rust,
parser, linker, browser, or host diagnostics do not cross the interface.

## Ownership And Memory Safety

The boundary tracks every live transfer as a boxed allocation keyed by its
exact pointer. An operation first verifies that the pointer is owned and that
its length matches before it copies input bytes. It never dereferences an
arbitrary caller pointer. Results and error codes remain instance-local Rust
state and are copied into a second exact caller-owned allocation; no borrowed
result pointer leaves Rust.

The browser adapter copies all input before invocation, copies all output
before release, and releases every allocation in a `finally` path. It validates
the exact module imports and exports before instantiation and checks the module
reported ABI version and input limit. Each WebAssembly instance has independent
state. The module has no imported host capability.

Rust flags `no_mangle` as an unsafe-code surface because duplicate linker
symbols would be undefined. The generated export module alone allows that
attribute. The crate otherwise warns on unsafe code, the storage and verifier
logic contain no unsafe block, and denied-warning Clippy is a required gate.

## Exact Browser Conformance

`tinyrustlm/tests/vnext-campaign-plan-wasm.test.js` builds the release module
offline with the locked workspace, then proves:

- exact generator output and frozen profile SHA-256;
- zero imports and the exact export descriptor sequence;
- arbitrary and mismatched pointers reject without a WASM trap;
- Node/WASM finalization equals the 23,012-byte frozen plan exactly;
- Node/WASM validation returns the exact same final bytes;
- returned bytes are defensive copies;
- trailing bytes, duplicate fields, malformed UTF-8, oversize input, and an
  unrelated WASM module reject with the declared boundary or verifier code;
- two independent real Chromium persistent profiles produce the same exact
  plan and error code;
- both browser processes close, both owned profiles are physically deleted,
  and deletion identities are distinct; and
- those browser runs make zero network requests and emit no console or page
  errors.

The current local release build was 532,039 bytes with SHA-256
`4366b9b5d6da0ef648fc53ce97f3c65c32c2cd46bb085f14a7401a9912c825dd`
under Rust 1.96.0. That is a bounded local build observation, not a published
web asset, reproducible-build receipt, site release, or campaign receipt.

## Build And Verification

```text
node tinyrustlm/tools/vnext-campaign-plan-wasm-codegen.js --write
cargo fmt --all -- --check
cargo test -p tinyrustlm-evidence-wasm --locked --offline
cargo clippy -p tinyrustlm-evidence-wasm --all-targets --locked --offline -- -D warnings
cargo build -p tinyrustlm-evidence-wasm --release --target wasm32-unknown-unknown --locked --offline
cd tinyrustlm
node --test tests/vnext-campaign-plan-wasm.test.js tests/vnext-campaign-plan-parity.test.js
```

The checked-in generated files must never be edited directly. A profile change
requires one intentional clean replacement, regenerated Rust and browser
outputs, a new hostile corpus, and complete affected gates. No alternate
handwritten browser parser or compatibility adapter is permitted.

## Next Boundary

Implement semantic currentness, signature authority, and truthful projection
independently in Rust. Then connect actual bounded receipt/subject-store inputs
to one campaign runner and bind its reprojected result into attestation,
release authorization, operator status, maintained documentation, and public
readback. Browser plan parity alone grants none of those authorities.
