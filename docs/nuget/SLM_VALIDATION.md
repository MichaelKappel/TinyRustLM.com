# SLM2 Validation

The managed SDK validates only the current mixed-Q8 SLM2 technical contract
through the canonical Rust runtime parser. There is no earlier model-format
reader, generic format reader, quantization fallback, or compatibility mode.

Validation checks include:

- exact SLM2 magic, format profile, schema, manifest, and layout identities;
- bounded header, tensor directory, tensor count, and artifact length;
- checked transformer geometry and tensor spans;
- role-owned row-wise signed-Q8 matrix and embedding records;
- F32 normalization and declared optional-bias records;
- exact quantization scale layout and finite values;
- embedded artifact identity and optional expected SHA-256; and
- the configured safe-inspection byte ceiling.

Inspection reports architecture, tensor and parameter counts, model geometry,
context and vocabulary bounds, byte count, artifact SHA-256, and exact
technical identities. Structural validation does not prove source provenance,
license suitability, numerical parity, assistant quality, browser activation,
P2P reachability, or publication.

A usable chat model additionally requires an exact ACG2 composition binding
SLM2, Tokenizer2, Template2, Sampling2, and Prompt2, followed by the registered
native, real-browser, and untouched-quality gates.
