# ADR-003: Alignment and Tensor Layout

## Status

Accepted. The SLM2 writer, reader, and backend layout implementations are
pending and unpromoted.

## Decision Date

2026-08-08

## Scope

This ADR defines canonical SLM2 section placement, tensor storage layout,
padding, endian behavior, and the boundary between artifact alignment and
runtime/backend alignment.

## Decision

SLM2 uses little-endian fixed-width envelope and descriptor records. Canonical
sections begin at the smallest valid aligned offset after the preceding
section.

Rules:

1. Envelope sections are aligned to 64 bytes.
2. A tensor may declare a power-of-two storage alignment from 64 through 4096
   bytes when its format requires more than the envelope baseline.
3. Non-tensor binary blobs may declare a power-of-two alignment from 1 through
   4096 bytes.
4. All padding bytes are zero.
5. Unaccounted gaps, overlapping ranges, aliases, out-of-order canonical
   ranges, and trailing bytes are invalid.
6. Offset, length, element-count, block-count, and allocation calculations use
   checked arithmetic before any slice or allocation.
7. Tensor dimensions are explicit positive integers in logical outer-to-inner
   order. Payloads are canonical contiguous row-major bytes unless a named
   closed tensor encoding says otherwise.
8. Strided views, pointer-like references, executable transforms, and implicit
   broadcasting are not artifact semantics.
9. Quantized tensors bind a named profile, block shape, scale encoding, code
   mapping, tail rule, logical shape, and exact stored byte count.
10. Tensor transforms such as transpose, split, fuse, or permutation occur in
    the converter and are recorded in provenance; the runtime does not guess
    them from dimensions.

Artifact alignment is not a promise of direct backend binding. Native SIMD
loads, operating-system mapping, WASM linear memory, and WebGPU binding or copy
requirements are separate resource plans. A backend that requires stronger
alignment copies or stages into owned memory without changing artifact
identity.

Version 2.0 uses no baseline payload compression. A future compressed section
profile requires a separate ADR, bounded decompressor, expansion limits, and
measured transfer value.

## Alternatives

- **One universal 256-byte alignment** was rejected because it inflates small
  records and confuses file layout with WebGPU buffer constraints.
- **Packed, unaligned sections** were rejected because they complicate safe
  vectorized and mapped access.
- **Backend-native tensor layouts in the canonical file** were rejected
  because driver-specific layout would fragment artifact identity.
- **Arbitrary strides and aliases** were rejected because they expand parser
  and overlap-analysis complexity.
- **Implicit zero padding or ignored trailing bytes** was rejected because it
  permits noncanonical identities and hidden data.

## Authoritative Evidence

- **Observed local fact**: the current SLM1 runtime has explicit dtype and
  tensor shape checks but is not the SLM2 layout.
- **Observed local fact**: current WASM ingestion uses owned memory and bounded
  chunks rather than assuming file offsets are executable pointers.
- **Sourced public fact**: WebGPU buffer offsets and binding limits are
  adapter/profile concerns, not a portable file-format alignment promise.
- **Sourced public fact**: the current WebGPU specification is
  https://www.w3.org/TR/2026/CRD-webgpu-20260109/.
- **Engineering decision**: 64-byte canonical section alignment balances
  deterministic storage and common CPU cache-line behavior while allowing a
  bounded stronger per-section declaration.
- **Local verification required**: converter output size and native/WASM copy
  behavior must be measured on real artifacts.

## Threat Analysis

Threats include overlap, integer wrap, out-of-bounds slices, allocation bombs,
alias mutation, nonzero covert padding, parser differential, decompression
bombs, backend offset confusion, and shape/byte-count disagreement.

The parser validates the complete descriptor graph and resource plan before
exposing any payload. It rejects zero or excessive dimensions, excessive rank,
inconsistent quantization tails, noncanonical offsets, unknown profiles, and
any arithmetic that does not fit the bounded host plan.

## Performance Evidence

The 64-byte rule is an engineering decision, not a measured performance claim.
Promotion requires comparison of:

- artifact size overhead by model and tensor count;
- cold and warm sequential read throughput;
- mapped/native and copied/WASM ingestion;
- scalar and SIMD kernel access;
- WebGPU staging bytes and upload time;
- peak resident memory.

Measurements must separate file-format overhead from backend staging. A
backend-specific win cannot justify changing the canonical artifact without
portfolio-wide evidence.

## Compatibility Impact

SLM2 accepts only this canonical layout. SLM1 offsets and tensor tables are not
parsed or translated at runtime. A reviewed source converter emits fresh SLM2
bytes and provenance.

Quantization profile IDs are closed. Unknown profile, layout, endian, or tail
semantics are fatal.

## Clean Deletion Impact

After SLM2 promotion:

- remove SLM1 layout readers and writers;
- remove inferred transform and permissive trailing-byte paths;
- remove duplicated backend-specific artifact variants that differ only by
  staging alignment;
- remove tests that normalize malformed padding or offsets into acceptance.

Historical fixtures may remain only in a clearly quarantined evidence corpus.

## Unknowns

- Maximum rank, dimensions, tensor count, descriptor bytes, and alignment
  exceptions depend on measured target families.
- Direct mapping policy differs by native host and requires platform evidence.
- WebGPU upload chunk sizes and staging pools require physical adapter tests.

## Acceptance Tests

1. Independent writers emit byte-identical artifacts.
2. Truncation at every envelope, descriptor, padding, and payload boundary
   fails.
3. Overlap, gap, alias, out-of-order range, nonzero padding, trailing bytes,
   invalid alignment, overflow, zero dimension, and byte-count mismatch fail.
4. Golden tensors cover every rank, dtype, quantization tail, and maximum
   supported alignment.
5. Native scalar, native SIMD, WASM scalar, and WASM SIMD read the same logical
   values.
6. WebGPU staging conformance proves that stronger runtime alignment does not
   alter artifact identity.
7. Multi-gigabyte ingestion remains bounded and does not duplicate the whole
   file.

## Rollback

Before promotion, regenerate experimental artifacts after revising this ADR.
After promotion, roll back the complete release and selector metadata. Do not
retain a permissive alternate layout parser as a fallback.
