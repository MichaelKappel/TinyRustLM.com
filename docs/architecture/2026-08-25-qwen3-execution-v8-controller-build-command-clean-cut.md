# Qwen3 Execution V8 Controller Build Command Clean Cut

Date: 2026-08-25
Status: implemented, remote-exact, and clean-gated prerequisite; output-free execution registration still absent

## Decision

The sole maintained Qwen3 composition execution controller now accepts exactly
one Rust build command:

```text
cargo build --locked --release -p tinyrustlm-build-custody -p tinyrustlm-convert --target x86_64-pc-windows-msvc
```

The command builds both executables required by build-custody profile `/3` in
one owned Cargo child:

- `tinyrustlm-build-scratch-inspect.exe`, the generated x64 helper that
  classifies the owned environment scratch without following reparse entries;
- `tinyrustlm-convert.exe`, the Qwen3 conversion executable used only after
  the complete custody terminal passes.

The controller exports the frozen command vector and validates exact ordered
array identity at the closed private-request shape boundary. A converter-only
command, a reordered package selection, an added target, or any other command
variant rejects with `execution-build-command` before source, evidence, or
output material is inspected.

## Root Cause

The previous maintained controller required the historical converter-only Cargo
command. That command cannot produce the scratch inspector required by current
build-custody profile `/3`. Registering execution `/8` while retaining that
controller would create a contradictory contract:

1. custody would require a generated scratch-inspection executable;
2. the registered Rust child would build only the converter;
3. changing the private composition request to the correct two-package command
   would make the controller reject it;
4. retaining both commands would introduce an alias and compatibility path.

The contradiction is removed before registration. There is one command, one
controller decision, and no old-command selector or fallback.

## Ownership

`tinyrustlm/tools/qwen3-composition-execution-controller.js` owns:

- the exact command vector accepted in the private composition request;
- closed shape validation before durable execution evidence;
- binding the command to the exact registration source;
- rejecting any command drift without repair or substitution.

`tinyrustlm/tools/build-custody-owner.js` separately owns:

- the direct Cargo executable identity;
- exact child arguments and working directory;
- the validated MSVC authority plus bounded supplemental environment;
- target, environment, and control root custody;
- required executable identity and post-build scratch inspection.

The controller does not launch a second build, discover an executable, rewrite
the custody request, or infer success from file presence. Custody does not
choose the composition request command. These responsibilities remain
nonoverlapping.

## Clean-Cut Rule

The converter-only command is absent from maintained controller behavior.
Historical registrations and receipts retain their exact old controller bytes
through immutable Git objects. They do not create an executable compatibility
path in current source.

The implementation adds no:

- product version;
- legacy reader;
- command alias;
- migration;
- fallback;
- retry;
- response or output repair;
- best-of-N selection;
- stale-output adoption;
- cleanup of failed evidence.

## Verification

The controller unit gate passes 7/7. It proves:

- one exact frozen command vector;
- the exported vector is immutable;
- the complete command passes closed request validation;
- the converter-only predecessor command rejects;
- reordered and extended request objects reject;
- create-only durable evidence refuses overwrite;
- streamed hashes preserve empty and binary evidence;
- stdout and stderr remain separately bounded;
- overflow terminates the owned child;
- the current executable machine is x64 on the Windows host.

The complete clean-source standard partition ran from remote-exact commit
`e48bb15445b62e951e56aa17c9c045df2e748bd4`, tree
`9099c150a9ef21bc9cf1124125b149caecef3ad4`. It completed 1,386 tests:
1,384 passed, zero failed, and exactly two declared skips. The skips remain the
external generated-package-input lane and the opt-in observation of an
installed Visual Studio instance. Duration was 419,382.1737 ms.

The same clean wrapper completed all ten serial release-surface shards with
23/23 tests passing. Run identity
`5980011fa62049fc9fbdbc19b74040833946caa9195f168bbdf2bccddb76a073`
has a 3,995-byte aggregate receipt at SHA256
`4f2cdcdff90f6da8c948e25889198e79915f07057163396809313789f5986997`.
The maintained verifier reopened the complete receipt set and reproduced the
same run, byte count, hash, test count, and pass verdict. An independent
filesystem hash reproduced the aggregate hash. All raw logs and receipts
remain outside source control in private evidence storage.

The exact command was also executed once as a test-only build in a fresh
external target root outside Git and outside every registered execution name.
It completed successfully and produced:

- `tinyrustlm-build-scratch-inspect.exe`: 240,128 bytes, SHA256
  `da6e6b4052a59d9e0f20e4c261660cc579a3beca9962388934073a923ab42a3d`;
- `tinyrustlm-convert.exe`: 852,992 bytes, SHA256
  `f3adee24aa32a1dc9836f218b980b3f7f90142d57ce2fe1f00557c8f08245005`.

Those bytes are command-validation output only. They are not registered,
custodied, adoptable, convertible into campaign evidence, or inputs to
execution `/8`. They must never be copied into an `/8` root.

## Source Identities

At remote-exact implementation checkpoint
`e48bb15445b62e951e56aa17c9c045df2e748bd4`, tree
`9099c150a9ef21bc9cf1124125b149caecef3ad4`:

- controller: 33,811 bytes, SHA256
  `c26633570f00155454842f56d23c27944b57091cd7f492c4f0bdde6386b3fdf6`;
- controller test: 7,780 bytes, SHA256
  `9e9324ae3aa95d929bcdeab8d9ff7a88675b77b28a3f54bd9cd63368e237bc54`.

The implementation checkpoint is exact across local HEAD, tracking,
`FETCH_HEAD`, and the direct remote branch. The bounded clean-gate
documentation and UAI update must receive its own remote-exact checkpoint
before registration uses the implementation identities.

## Next Gate

After this bounded clean-gate documentation and UAI update is remote exact,
execution `/8` may be preregistered output-free. The preregistration must bind:

- the exact new source commit and tree;
- current build-custody profile `/3` and owner;
- current scratch-inspector profile, crate source closure, and generated
  executable relative path;
- this exact controller and command vector;
- one Rust custody operation requiring both x64 outputs;
- one managed custody operation;
- the immutable MSVC environment authority;
- all terminal execution `/1` through `/7` evidence;
- wholly new private names observed absent before registration;
- zero retries, repair, cleanup, adoption, or selection.

No `/8` private request, root, build, or output may exist before the
separate registration commit is itself remote exact.

## Claim Boundary

This change proves only that the controller and Cargo command agree on the two
required Rust outputs. It is not a registered or qualified build, converter
adoption, SLM2 composition, source parity, native inference, browser WASM,
conversation, quality, P2P, package, publication, deployment, catalog, or
MemoryEndpoints result. Campaign counters remain `0/20`, `0/50`,
`0/25`, `0/40`, and `0/20`.
