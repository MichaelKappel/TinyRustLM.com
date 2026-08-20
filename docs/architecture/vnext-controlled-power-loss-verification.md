# vNext Controlled Physical Power-Loss Verification

## Status And Exact Claim

`tinyrustlm.vnext.controlled-power-loss-verification.v1` is the sole current
source boundary for verifying one controlled physical power-loss attempt. Its
frozen profile is
`contracts/vnext/controlled-power-loss-verification-profile.v1.json`, 7,665
bytes with SHA-256
`00f4f787d62ca6f388ae06acb4c23134144ad25668d749aac9cd91dca9decfd1`.
The exact six-member verification source closure has SHA-256
`de8a707cd97f20806f84f76afd07ea974c3cbef1f701ed33dcae5935ec1434ac`.

The implementation verifies three canonical, externally signed records against
one exact directory-flush helper package, its independently replayed helper
verification receipt, one caller-protected witness trust record, and one
caller-protected verification time. It emits one content-addressed verification
receipt scoped to the exact helper package, machine, volume, filesystem, cache
class, interruption class, target, and attempt.

No physical power interruption has been executed. This source checkpoint does
not prove that a physical interruption occurred.
The maintained tests use a local test helper and ephemeral fixture witness, so
their maximum verdict is `fixture-only`. No production witness record, managed
power-controller record, physical reboot observation, or cross-RID physical
matrix has been supplied. Gate D remains incomplete and no campaign counter
advances.

## Boundary Role

The verifier is deliberately not a power controller, shutdown tool, evidence
collector, signer, witness-enrollment service, or receipt publisher. It never:

- initiates a shutdown, restart, virtual-machine reset, or power cut;
- asks a host or controller to claim that a power cut occurred;
- generates or imports a witness private key;
- enrolls, activates, retires, revokes, or repairs a witness record;
- chooses trusted time from an evidence file;
- changes the target, activation marker, armed marker, or helper package;
- writes a campaign receipt, release record, publication record, or counter.

The caller must supply exactly five verification inputs:

1. an absolute evidence root containing only the three frozen evidence files;
2. an absolute helper-evidence root containing the helper verification receipt;
3. an absolute helper-package root containing the exact helper package;
4. one protected trusted-witness record; and
5. one protected RFC 3339 UTC verification time with whole-second precision.

The three filesystem roots must be normalized absolute paths and pairwise
disjoint. The evidence root must be a real directory rather than a symbolic
link and must contain exactly the declared three files. Evidence documents are
regular, non-link files no larger than 65,536 bytes each and no larger than
196,608 bytes in total. Unknown files, unknown fields, duplicate JSON keys,
noncanonical JSON, relative paths, linked roots, and overlapping roots fail
closed.

## Three Signed Records

The evidence chronology is an append-only physical-test narrative. Every
record is strict RFC 8785/JCS JSON and has a closed field set.

| Record | Required observation | Required parent binding |
| --- | --- | --- |
| Preregistration | Test and target IDs, exact helper identity, machine and volume identities, preboot identity, filesystem and cache class, planned interruption class, bounded observation delay, independent witness challenge, and expected target/activation/armed state | No mutable parent; it is signed before arming and interruption |
| Pre-interruption | Exact expected state is visibly present, the armed marker is present, the graceful-disarm marker is absent, no graceful shutdown was requested, and interruption authorization is explicit | Exact SHA-256 of the canonical preregistration |
| Post-restart | The same target state and armed marker survived, graceful disarm/shutdown was not observed, the planned physical interruption class was observed, and the postboot identity differs from the preboot identity | Exact SHA-256 values of both canonical earlier records |

Each state contains exactly three members: target payload, activation marker,
and armed marker. Every member binds a positive bounded byte count and SHA-256.
The expected, pre-interruption, and post-restart state objects must be
byte-identical after canonicalization. The verifier does not repair a missing
marker, infer an omitted target, or substitute a later file.

Accepted runtime/filesystem/method tuples are deliberately closed:

| RID | OS | Architecture | Filesystem | Helper method |
| --- | --- | --- | --- | --- |
| `win-x64` | Windows | `x86_64` | NTFS | `win32-backup-semantics-flush-file-buffers` |
| `linux-x64` | Linux | `x86_64` | ext4 | `posix-directory-fsync` |
| `linux-arm64` | Linux | `aarch64` | ext4 | `posix-directory-fsync` |

The accepted interruption classes are `external-ac-power-removal` and
`managed-pdu-power-cut`. A process kill, browser close, ordinary restart,
graceful shutdown, hypervisor reset, suspended VM, simulated fault, or fixture
cannot be relabeled as either class.

## Witness Trust And Signature Domain

The protected caller supplies one closed witness record containing the witness
and key IDs, role, raw 32-byte Ed25519 public key in canonical base64, status,
validity interval, and optional revocation and compromise times. Evidence files
cannot supply or replace this trust root. The required role is
`physical-durability-observer`; accepted status values are `active`, `retired`,
and `revoked`.

Each evidence document carries one witness signature object. The signed bytes
are:

```text
UTF8("tinyrustlm.controlled-power-loss.physical-witness.v1")
|| 0x00
|| JCS(document-without-witness-field)
```

The signature object binds the witness ID, key ID, signature domain, payload
SHA-256, signature time, and canonical 64-byte Ed25519 signature. The signature
must occur at or after the observed event and no more than 300 seconds later.
It must also fall inside the key validity interval and before any revocation or
compromise time. Key substitution, signature substitution, payload mutation,
noncanonical base64, stale authority, and evidence-selected trust material fail
closed.

An active, unexpired, uncompromised key is current at the protected verification
time. A valid historical signature may remain auditable after retirement,
expiry, or later revocation, but it cannot produce a current `pass` verdict.

## Helper And Platform Binding

Every record embeds one identical closed helper identity. The verifier derives
the expected identity from the package and helper evidence rather than trusting
the embedded copy. It binds:

- RID, OS, architecture, helper method, build profile, and trust class;
- exact helper source revision and clean-worktree flag;
- executable byte count and SHA-256;
- directory-flush, client, verification, and source-closure SHA-256 values;
- helper manifest and provenance SHA-256 values; and
- exact helper verification receipt SHA-256.

The maintained directory-flush helper verifier must independently return
`pass`. The controlled verifier snapshots the helper package and evidence,
verifies the helper, reads all three physical records, then repeats the helper
verification and every relevant read. Any helper, package, receipt, executable,
or evidence drift between observations fails as
`controlled_power_loss_inputs_changed`.

A `local-test-build` helper can test parsing, signatures, state binding, and
replay, but it is never physical promotion evidence. Only a `release-package`
helper whose recorded source worktree was clean is eligible for a physical
verdict.

## Chronology And Restart Invariants

The following total order is mandatory:

```text
registered event <= preregistration signature
                 <= pre-interruption event
                 <= pre-interruption signature
                 <  post-restart observation
                 <= post-restart signature
                 <= protected verification time
```

The preboot and postboot identities must differ. Machine, volume, filesystem,
cache class, helper, test, target, and preboot identities must not drift across
the three records. The observed post-restart interruption class must equal the
preregistered class. Observation delay is measured from the signed armed state
to the post-restart observation and must be a positive whole number of seconds
within both the preregistered limit and the profile maximum of 86,400 seconds.

These checks prove consistency of the signed records. They do not independently
prove that the witness was physically independent, that a controller actually
removed power, or that machine/boot identifiers were generated by a protected
platform source. Those are production authorization and operational evidence
requirements.

## Verdicts And Non-Authority

Verdict derivation is closed:

| Helper and witness state | Verdict | Evidence tier |
| --- | --- | --- |
| Local test helper, regardless of current witness status | `fixture-only` | `fixture-only` |
| Clean release helper and currently trusted witness | `pass` | `physical-executed` |
| Clean release helper and valid historical but noncurrent witness | `historical-only` | `historical-physical-executed` |

Every emitted receipt sets all three of these fields to `false`:

- `broadDurabilityClaimAuthorized`;
- `releaseAuthorized`; and
- `campaignProgressAuthorized`.

That rule also applies to an exact scoped `pass`. One successful attempt says
nothing about another helper build, RID, machine, controller, volume,
filesystem, cache policy, target, or attempt. A release or campaign authority
must consume the required current matrix through the sole vNext evidence graph;
the custom verification receipt cannot authorize itself.

## Receipt Identity And Evidence-Backed Replay

The receipt is canonical JCS JSON. Its content identity is:

```text
SHA256(
  UTF8("tinyrustlm.controlled-power-loss.verification-receipt.v1")
  || 0x00
  || JCS(receipt-without-receiptId-and-canonicalContentSha256)
)
```

It binds the three evidence hashes, helper identity, witness/key/public-key
hashes, hash of the complete protected witness context, protected verification
time, machine/volume/boot identities, platform tuple, interruption and cache
classes, observation delay, exact verifier profile, and exact verification
source closure. It contains no raw path, raw public key, private key, controller
credential, or target bytes.

There is no public standalone receipt parser that can be mistaken for proof.
`verifyControlledPowerLossReceiptReplay` must regenerate the verification from
the exact helper package, helper evidence, signed records, protected witness
context, and protected verification time, then compare the supplied canonical
receipt bytes exactly. Recomputing a receipt ID after changing a verdict,
authorization field, trust state, source identity, or evidence hash cannot
produce a successful replay.

## Maintained Hostile Coverage

The focused suite currently passes 8/8 groups with zero failures or skips. It
covers:

1. frozen profile and export-surface identity;
2. three-record signature verification and fixture-only receipt replay;
3. signature mutation, signing-key substitution, and untrusted caller input;
4. unchanged boot identity, machine drift, marker lies, and state drift;
5. stale preregistration, impossible chronology, and excessive delay;
6. helper identity and platform/filesystem substitution;
7. noncanonical JSON, additional files, linked/relative/overlapping roots; and
8. identity-refreshed verdict, release, broad-claim, and trust-type inflation.

This is source and fixture evidence only. It does not count as one physical
attempt and does not satisfy any release or campaign acceptance item.

## Required Production Procedure

A real attempt must be conducted outside the fixture harness:

1. Pin one clean release helper package and independently passing helper receipt.
2. Select and record the exact machine, physical volume, filesystem, storage
   cache class, controller arrangement, target state, and interruption class.
3. Obtain an authorized protected witness key record and protected trusted time;
   never place the private key or controller credential in source or evidence.
4. Produce and externally sign the preregistration before arming the target.
5. Durably publish the target, activation marker, and armed marker through the
   exact helper; externally inspect and sign the pre-interruption record.
6. Perform the preregistered physical interruption without graceful disarm or
   shutdown and retain independent controller/operator evidence outside public
   receipts.
7. After boot, inspect the same machine and physical volume, record the changed
   boot identity and exact surviving state, and externally sign the post-restart
   observation within the registered delay.
8. Run generation and evidence-backed replay from a clean verifier source
   closure, retain all canonical source documents immutably, and publish only
   the bounded public-safe hashes and status allowed by the campaign contract.
9. Repeat for every RID/filesystem/device class required by the release matrix;
   never generalize one tuple to another.

## Open Evidence

The following remain objectively absent:

- authorized production witness enrollment and protected trust distribution;
- a protected source for machine, boot, volume, and controller identities;
- a production evidence collector that cannot self-attest its own interruption;
- one actual controlled power interruption on any supported tuple;
- complete required physical evidence for `win-x64`, `linux-x64`, and physical
  `linux-arm64`;
- an approved filesystem, storage-controller, cache-policy, and device matrix;
- campaign-DAG admission of current physical receipts; and
- release, deployment, publication, or campaign authorization derived from
  those receipts.

Until those records exist and independently replay, physical durability remains
an explicit Gate D blocker rather than a skip or simulated pass.
