# vNext Offline Verification Bundle

## Status

This document describes the bounded Node implementation checkpoint for
offline vNext evidence verification. It is not a production release gate,
cross-language parity result, outside-network observation, model-quality
receipt, or campaign completion claim.

The current implementation is:

- `contracts/vnext/offline-verification-bundle-profile.v1.json`;
- `contracts/vnext/public-safe-redaction-profile.v1.json`;
- `tinyrustlm/tools/vnext-offline-bundle.js`; and
- `tinyrustlm/tests/vnext-offline-bundle.test.js`.

The current offline profile is 3,514 bytes with SHA-256
`488cad440d213da587a1258dc37de00789e566ae3024d89d3a43781c49b50369`.
Its newly bound public-safe redaction profile is 3,132 bytes with SHA-256
`83cab2664951247ccf24462f409d1838a77cb3be88353e27d028211343627884`.

## Acyclic Construction

The bundle has three distinct layers:

1. finalized receipt and non-receipt subject bytes;
2. one canonical manifest that catalogs every verification input; and
3. one `offline-verification-bundle` receipt created after the manifest.

The verification receipt is not a manifest member. Including that receipt in
the manifest would create a cycle: the receipt binds the manifest SHA-256,
while the manifest would need to bind the receipt ID and byte hash. The
separate receipt instead lists every manifest receipt as an input parent and
binds the already-final manifest hash through both its typed `offlineBundle`
payload and its sole named input hash.

The manifest itself has no content ID and is not a new top-level vNext product
contract. Its externally supplied raw-byte SHA-256 is the transport identity.
The nine top-level vNext contract family members remain unchanged.

## Trust Inputs

`verifyVnextOfflineBundle` accepts exactly these data-only inputs:

- canonical manifest bytes;
- the externally expected manifest SHA-256;
- the expected campaign and environment;
- the out-of-band trusted root registry receipt ID;
- the out-of-band expected terminal registry receipt ID;
- the trusted verification time;
- the separate verification-receipt bytes;
- all receipt-member bytes; and
- all non-receipt signed-subject bytes.

The manifest repeats campaign, environment, root, and terminal values so its
hash binds them, but those repeated values never establish trust. The caller
must supply and match the trust pins. The verifier performs no DNS, HTTP,
catalog, filesystem discovery, or key generation.

## Manifest Bindings

The canonical manifest binds:

- bundle state, profile ID, canonical JSON profile, creation time, campaign,
  environment, and registry pins;
- the raw byte length and SHA-256 of the contract registry, public-safe
  redaction profile, receipt-signature profile, receipt-store profile, and
  offline-bundle profile;
- the SHA-256 of the canonical descriptor for each of the nine vNext schemas;
- sorted target signature-receipt IDs;
- every receipt ID, receipt type, schema, byte length, and raw-byte SHA-256;
- every non-receipt subject ID, contract class, schema, byte length, and
  raw-byte SHA-256; and
- exact member counts and total byte counts.

Manifest bytes must be strict JSON and exact vNext JCS. Pretty printing,
trailing data, unknown fields, reordered arrays where sorting is required,
duplicate IDs, unsafe numbers, profile drift, schema drift, and member drift
fail closed.

The typed verification receipt uses `receiptIds` as the complete receipt set.
Its signature-envelope, authority-registry, and revocation lists are exact
subsets. The receipt's `inputReceiptIds` must equal the complete receipt set,
and its only input hash must be named `offline-bundle-manifest` and equal the
manifest SHA-256.

## Closure Algorithm

Verification proceeds in this order:

1. Validate the exact input object without executing accessors.
2. Enforce manifest, member-count, and aggregate-byte limits.
3. Strict-parse and canonical-wire-check the manifest.
4. Match the external manifest hash and every out-of-band trust value.
5. Canonically validate every receipt and identity-bearing subject.
6. Match supplied members one-for-one with manifest metadata, rejecting every
   missing, extra, duplicate, or hash-mismatched member.
7. Validate the separate offline verification receipt and its exact category,
   parent, schema, creation-time, and manifest-hash echoes.
8. Run `verifyVnextAuthorityGraph` using only supplied member bytes plus the
   caller's trust pins and verification time.
9. Require every authority registry to form the one pinned root-to-terminal
   chain, every revoked transition to have its signed revocation, and every
   successor/revocation to have exactly one predecessor-authorized governance
   signature.
10. Start from the declared target signatures, governance receipts,
    registries, and revocations; traverse every receipt parent; and require the
    resulting set to equal the complete manifest receipt set.
11. Require every non-receipt target subject and reject every unlinked subject.
12. Require a current terminal registry and `currentEvidenceEligible=true` for
    every target signature.

Governance signatures may remain historically valid after their envelope
expires because they authenticate immutable registry history. A target
signature cannot pass current offline admission when expired, unauthorized,
retired, revoked, compromised, or otherwise stale.

## Limits

The frozen profile caps:

- manifest bytes at 4 MiB;
- receipts at 2,048 and aggregate receipt bytes at 64 MiB;
- non-receipt subjects at 2,048 and aggregate subject bytes at 64 MiB;
- target signatures at 128;
- profile bindings at exactly five;
- schema bindings at exactly nine; and
- parser depth, entries, members, arrays, strings, and number characters.

Truncation, an interrupted member, a sparse or accessor-bearing input array,
and count or byte excess produce bounded typed errors. The implementation
copies caller-supplied byte views before verification and returns deeply frozen
result data.

## Result Semantics

`offlineBundleVerified=true` means only that this exact supplied bundle was
canonical, complete, closed, authority-valid, and current for its declared
target signatures at the caller's verification time. The result retains the
full authority result, including separate cryptographic, issue-time authority,
temporal, and current-evidence fields.

It does not prove:

- model usefulness, license clearance, or contamination controls;
- browser-profile deletion or MemoryEndpoints continuity;
- an outside observer's operational independence beyond the signed role and
  pinned registry evidence;
- public reachability, catalog announcement, package publication, site
  deployment, or HTTPS readback;
- production key custody or trusted clock operation; or
- Rust, browser, WASM, C ABI, C#, or package-consumer parity.

No 20/50/25/40/20 campaign counter changes from this checkpoint.

## Remaining Work

- Reproduce the profile, manifest, schema hashes, Ed25519 decisions, authority
  graph, and hostile corpus in independently implemented Rust and browser
  verifiers.
- Integrate the verifier with the create-only receipt store and interruption-
  safe on-disk bundle staging without adding a second parser or format.
- Require every applicable redaction-scan receipt to replay through the
  dedicated verifier with its protected known-secret list before release
  admission. The manifest profile binding prevents policy substitution but
  does not disclose or reconstruct private equality inputs.
- Bind exact phase invalidation and truthful dashboard projection.
- Prove the Rust/Win32 directory-flush boundary before claiming production
  directory durability.
- Run authorized production operations only after key custody, trusted time,
  observer, MemoryEndpoints, catalog, publication, and cleanup contracts exist.
