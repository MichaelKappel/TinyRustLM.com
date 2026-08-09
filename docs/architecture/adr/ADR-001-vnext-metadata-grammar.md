# ADR-001: vNext Metadata Grammar

## Status

Accepted. SLM2 implementation is pending and must not be advertised as
available.

## Decision Date

2026-08-08

## Scope

This ADR defines the canonical metadata grammar and version behavior for the
incompatible SLM2 artifact envelope. It does not define receipt JSON,
MiniModel HTTP JSON, tensor byte layout, or cryptographic algorithms.

## Decision

SLM2 uses distinct magic bytes, an exact major/minor version of 2.0, fixed
little-endian envelope records, and one closed deterministic CBOR subset named
SLM-DCBOR-1 for bounded metadata.

SLM-DCBOR-1 permits only:

- unsigned and negative integers in their shortest representation;
- byte strings and valid UTF-8 text strings with definite lengths;
- arrays and maps with definite lengths;
- true, false, and null.

It rejects:

- floating-point values;
- tags, undefined, and unassigned simple values;
- indefinite-length items and break markers;
- non-shortest integer or length encodings;
- duplicate map keys;
- non-text map keys;
- invalid UTF-8;
- nesting, item counts, or byte lengths above the artifact-class limits;
- unknown top-level or core keys;
- trailing metadata bytes.

Core keys are printable ASCII identifiers. Map order is the RFC 8949 core
deterministic order: shorter encoded keys first, then bytewise lexical order.
The validator compares the supplied bytes with the canonical representation;
it does not silently decode and normalize a noncanonical input.

SLM2 metadata is data only. It cannot contain executable code, scripts,
template engines, arbitrary expressions, filesystem paths, credentials, or
URLs that instruct the runtime where to obtain model bytes. Identity-bearing
references use typed content IDs. Human display text is non-authoritative.

The first reader accepts exactly SLM2 2.0. Unknown major or minor versions are
fatal. A later compatible minor profile may be introduced only by a new ADR
and explicit parser support; permissive version ranges are prohibited.

Receipt and HTTP contracts use their own restricted canonical JSON profiles.
They are not embedded as an alternative SLM2 metadata encoding.

## Alternatives

- **General JSON** was rejected because duplicate-key handling, number
  coercion, Unicode escaping, and canonical byte identity vary across parsers.
- **Unrestricted CBOR** was rejected because tags, floats, indefinite lengths,
  and multiple legal encodings create unnecessary attack and identity
  surfaces.
- **Protocol Buffers or FlatBuffers** were rejected for the first envelope
  because generated-schema evolution can encourage retained unknown fields
  and compatibility behavior that conflicts with the clean-slate boundary.
- **A custom text grammar** was rejected because it adds escaping and parsing
  complexity without improving bounded binary ingestion.
- **Retaining SLM1 metadata** was rejected because the goal requires one
  incompatible vNext contract and deletion of the unpublished old path.

## Authoritative Evidence

- **Observed local fact**: rust/runtime/src/model_format.rs currently parses
  SLM1 version 1 with a fixed header and therefore is not SLM2 evidence.
- **Observed local fact**: current receipt tooling already relies on exact
  field validation and deterministic serialization at several trust
  boundaries.
- **Sourced public fact**: RFC 8949 defines CBOR deterministic encoding and
  duplicate-map-key considerations.
- **Sourced public fact**: RFC 8949 is
  https://www.rfc-editor.org/rfc/rfc8949.html.
- **Engineering decision**: TinyRustLM intentionally selects a smaller closed
  subset than general deterministic CBOR.
- **Local verification required**: independent Rust and test-oracle parsers
  must agree on all accepted and rejected corpus entries.

## Threat Analysis

The primary threats are parser differential, duplicate-key substitution,
allocation bombs, integer overflow, deep recursion, noncanonical identity,
hidden executable semantics, and version smuggling.

The implementation must preflight every declared length with checked
arithmetic before allocation, impose artifact-class byte/item/depth limits,
reject recursion beyond the fixed depth, preserve no unknown fields, and
produce one bounded error code without echoing hostile content. Canonical
validation occurs before metadata influences tensor allocation or runtime
selection.

## Performance Evidence

No SLM2 parser benchmark exists yet. The decision minimizes work by using
definite lengths, one pass over bounded metadata, no float conversion, and no
general extension machinery.

Promotion requires measurements for parse throughput, peak allocation, and
rejection latency over minimum, typical, maximum, and adversarial metadata.
The parser must remain a negligible fraction of multi-gigabyte artifact
ingestion and must allocate only from a preflighted bounded plan.

## Compatibility Impact

SLM2 is intentionally incompatible with SLM1. There is no production fallback,
dual reader, dual writer, migration parser, compatibility alias, or automatic
conversion of old bytes.

Converters regenerate SLM2 from reviewed immutable source inputs. Existing
SLM1 artifacts remain historical evidence only and cannot be promoted through
the vNext selector.

## Clean Deletion Impact

After the SLM2 writer, parser, converter, inspector, native forward pass, and
browser load gates pass:

1. delete the SLM1 production parser and writer;
2. delete SLM1 selector and route metadata;
3. delete SLM1-only tests except quarantined historical evidence fixtures;
4. remove public and internal wording that implies SLM1 is current;
5. reject SLM1 magic at the sole production admission boundary.

No hidden compatibility crate or command remains.

## Unknowns

- Exact per-artifact-class metadata byte, depth, array, map, and string limits
  require measured converter output.
- The final closed key registry depends on the SLM2 section and quantization
  specifications.
- Unicode policy for non-authoritative display values needs conformance
  vectors; identity-bearing keys remain ASCII.

## Acceptance Tests

1. Golden encodings round-trip byte-identically through two independent
   implementations.
2. Every structural byte boundary has a truncation case.
3. Duplicate keys, invalid UTF-8, non-shortest integers, indefinite lengths,
   floats, tags, excessive depth, excessive counts, and trailing bytes fail.
4. Unknown core keys and versions fail without fallback.
5. Fuzzing demonstrates bounded time and memory and no panic.
6. Writer output is identical across repeated runs and supported hosts.
7. Hostile metadata cannot cause tensor allocation before full preflight.
8. Repository checks prove no production SLM1 compatibility path remains at
   cutover.

## Rollback

Before promotion, rollback means removing the incomplete SLM2 implementation
and retaining the last verified development state without claiming vNext.
After promotion, rollback means reverting the entire release to the previous
content-addressed release. It never means enabling the SLM1 reader inside the
SLM2 release.
