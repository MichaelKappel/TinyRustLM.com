# TinyRustLM Browser Prefix-Cache Performance Memory

Date: 2026-07-12

## Decision

The checked Rust/WASM runtime now reduces repeated conversational prefill
without changing the locked UI, model, sampling contract, or visible output.
The real SmolLM2-360M q4 two-turn smoke fell from 61,890 ms to 10,678 ms on
the second turn, an 82.75% improvement. The first and second responses are
unchanged.

This is a production candidate, not a deployment claim. TinyRustLM.com still
serves the prior runtime until the normal atomic release and HTTPS readback
gate completes.

## Implemented Path

Four portable changes compose the result:

1. The `tinyrustlm-runtime` release package uses `opt-level=3`; the rest of
   the release workspace keeps the size-oriented profile.
2. q4 matrix-vector execution iterates explicit quantization blocks, forms an
   unscaled block dot product, and applies the block scale once. This removes
   per-byte division and repeated scale multiplication.
3. Prompt prefill skips final norm and full vocabulary projection for every
   non-final token. A reference test proves final logits are bit-identical to
   the old all-projections path.
4. A later generation may reuse the previous KV cache only when the entire
   retained token sequence is a nonempty exact prefix of the new prompt and
   cache length matches exactly. Any mismatch resets and performs full
   prefill.

The runtime exposes `prefill_reused_token_count` and
`prefill_computed_token_count`. The browser smoke requires these counters to
balance the full prompt and requires positive second-turn reuse, preventing a
silent fallback from passing as an optimization.

## Measured Evidence

The original checked WASM was 350,363 bytes. The selected portable artifact is
377,166 bytes, an increase of 26,803 bytes or 7.65%. It requires no SIMD.

The uncontended final browser run reports:

- first prompt: 53 tokens, 0 reused, 53 computed
- second prompt: 82 tokens, 63 reused, 19 computed
- second generated response: 8 tokens
- second-turn wall time: 10,678 ms
- baseline second-turn wall time: 61,890 ms
- improvement: 82.75%

WASM SHA-256 is
`11d4fb78c455e2349ed775d19fc9806e293cd1a82dbc4479162a0bf76373b659`.
Manifest SHA-256 is
`d4c08dec48d5deb02fa639fdae4c5ab30adedbaa91f32a2cbb6dc06bc70e2292`.

A SIMD128 trial reached 33,384 ms before prefix reuse, but it was rejected as
a hard browser capability requirement. The selected artifact remains portable
and achieved the much larger gain through exact semantic cache reuse.

## Quality Boundary

The unchanged strict seven-case fixture remains SHA-256
`161d50b3ac8821f9262350196b081dfe19ceb0c92a3d212b500aa1678e6d8066`.
Regenerated native evaluation is still 3/7 with no-cheat pass and zero
no-cheat failures. All seven raw and normalized outputs match the previous
runtime. The only sidecar status change applies the previously documented
case-0 rubric correction to the unchanged response; the old artifact recorded
2/7 while the current authoritative interpretation is 3/7.

Performance work grants no model, adapter, corpus, selector, or assistant
quality promotion.

## Verification

- runtime tests: 218 passed
- Rust workspace tests: pass, including 517 packer tests
- workspace clippy with warnings denied: pass
- Cargo formatting: pass
- Node browser contracts: 33 passed
- WASM ABI smoke: pass
- .NET package tests: 52 passed
- report-intake memory verifier: 120 hashed rows, 0 failures
- static and HTTP browser harnesses: pass
- real multi-turn browser smoke: pass

Strict eval SHA-256 is
`555436c1604be24bd35ee7ab4c73b1dce4c2216aebc8b9c145ed0d12cfb5175b`.
Browser smoke SHA-256 is
`4dfa965e0eca9cf7348d3606ca9fd99257bd4c99e3fc99204dfaedd657b24cd0`.
UI verification SHA-256 is
`060ebb23b14a44b142b154b296f47693bb92347f0055080b30670c255fe36d6f`.

Redacted aggregate evidence:
`artifacts/reports/tinyrustlm-browser-prefix-cache-performance-2026-07-12.json`.

## Required Next Gate

Commit the checked source, WASM, manifest, and evidence, then deploy through the
existing atomic release path. Production completion requires HTTPS hash
readback and the live two-turn browser smoke. Human review of the 42-record
role-history corpus remains a separate prerequisite for any future quality
adapter training.
