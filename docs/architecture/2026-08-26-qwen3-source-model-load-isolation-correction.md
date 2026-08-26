# Qwen3 Source Model-Load Isolation Correction

Date: 2026-08-26
Status: clean-slate source correction and real pinned model-load diagnostic
pass; complete source gate and a new one-shot registration remain required

## Decision

The publisher-source numerical owner now permits exactly one non-egress local
IPv6 capability probe required by the pinned Python dependency closure. The
only admissible audit event is a `socket.bind` performed by
`urllib3.util.connection._has_ipv6` on an `AF_INET6`, `SOCK_STREAM`, protocol
zero socket with the exact address `("::1", 0)`. The allowance is consumed
after one event.

This is not general network permission. Connect, listen, DNS, send, a second
bind, a different caller, IPv4, a non-loopback address, a nonzero port, a
different socket type, or a process launch remains a terminal isolation
violation. The numerical profile continues to state `networkAllowed: false`
and now binds the exact local capability-probe shape with
`externalCommunication: false`.

The owner also passes `trust_remote_code=False` explicitly to the pinned local
`Qwen3ForCausalLM.from_pretrained` call. An isolation failure retains its
specific `SourceOwnerFailure` instead of being remapped to a generic model-load
failure.

## Preserved Failure

Operation `qwen3-numerical-c1899de-aece952-20260826-v1` remains immutable
`terminal-failure`. Its publisher-source process was launched exactly once and
ended at `source-trace-model-load`; the later reconstructed, scalar, and
verifier stages were never launched. Nothing in this correction changes,
retries, repairs, adopts, deletes, or promotes that operation or its evidence.

The bounded public terminal record remains
`contracts/vnext/qwen3-numerical-differential-execution-result.v1.json`. The
closed operation proves no numerical parity, browser execution, model quality,
P2P availability, publication, or campaign progress.

## Diagnostic Reproduction

Three disposable nonmaterial diagnostics were run outside every closed
execution identity and outside Git. They used the pinned local source copy and
the pinned numerical-oracle Python environment but created no registered trace
output.

The bounded diagnostic progression was:

1. the `from_pretrained` stage surfaced `NameError` after a denied event in the
   network audit class;
2. a narrower observation identified the denied event as `socket.bind`; and
3. a module/function-only stack identified
   `urllib3.util.connection._has_ipv6` as the caller.

Inspection of the exact installed `urllib3` 2.4.0 closure showed that this
function creates an IPv6 socket, binds it to loopback port zero to test local
IPv6 capability, then closes it. It does not connect, listen, resolve a remote
name, or transfer data. The former owner denied every bind and then converted
the resulting exception to the generic model-load code. The reproduced cause
is therefore an overbroad isolation rule plus exception masking, not evidence
of source-model corruption.

Private diagnostic paths and raw exception streams remain outside source
control. Only the bounded event, caller, dependency identity, and engineering
conclusion are recorded here.

## Clean-Slate Contract

`tinyrustlm/tools/qwen3-numerical-source-owner.py` owns one
`IsolationPolicy`. Its allow decision requires all of these facts at once:

- event `socket.bind`;
- immediate caller module `urllib3.util.connection`;
- immediate caller function `_has_ipv6`;
- socket family `AF_INET6`;
- socket type `SOCK_STREAM`;
- protocol `0`;
- exact two-member address `("::1", 0)`; and
- observed allowance count less than one.

After the pinned model is loaded, the owner requires the observed count to be
exactly one. A dependency change that removes, duplicates, or changes the
probe therefore fails closed and requires a reviewed clean-slate contract
change. There is no compatibility branch, alternate owner, permissive network
mode, retry, or translation of the former behavior.

The current profile
`contracts/vnext/qwen3-numerical-differential-profile.v1.json` is the sole
active contract. Historical bytes remain auditable through their source
commit and content identities; the shipping or diagnostic path does not keep
an old reader or old isolation policy executable.

## Test-First Evidence

The generic regression was written and observed red before implementation. It
requires:

- exact acceptance of one local IPv6 capability bind;
- rejection of the second identical bind;
- rejection of wrong family, type, protocol, host, port, module, and function;
- continued rejection of connect, DNS, listen, send, and subprocess events;
- explicit local-only model loading with remote code disabled;
- preservation of typed isolation failures; and
- an exact profile binding for the capability probe.

The focused test is
`tinyrustlm/tests/qwen3-model-load-isolation.test.js`. A passing synthetic
policy self-test proves only policy behavior. It does not prove that the real
model loads or that any numerical trace is correct.

## Model-Load Proof

A fresh nonmaterial diagnostic under the corrected v2 environment loaded the
exact pinned model successfully, observed one capability bind, created no
trace output, and consumed no registered one-shot authority. Its bounded
public result is
`contracts/vnext/qwen3-model-load-diagnostic-result.v2.json`, 2,919 bytes at
SHA-256
`815dc5e38a431c9ccb578dacc2452ae54e193e41747b4507752d99b4a86c036a`.
The earlier v1 result remains retained separately at SHA-256
`0bb72f882befe2b2fe521c749872eb628729a6ab21559cb1e5d5fb64bbc7b2d4`
as historical evidence only, with no runtime compatibility route.

Before a new numerical operation may be registered:

1. preserve the passing diagnostic and every earlier failed diagnostic outside
   the closed operation;
2. run the complete maintained and protected source-controlled gates;
3. commit, push, fetch, and prove local/tracking/`FETCH_HEAD`/direct-remote
   equality; and
4. preregister a wholly new one-shot operation with new request, evidence,
   scratch, trace-output, terminal, and result identities.

If the corrected diagnostic reveals a different failure, that failure must be
preserved and receive its own generic red test. The closed execution must never
be invoked again.

## Claim Boundary

The current change establishes a narrowly specified isolation correction, a
passing focused policy contract, and a passing pinned local model-load
diagnostic. Until a wholly new registered owner completes, source tracing and
both numerical proof arrows remain unproven. Browser-WASM, browser chat,
behavioral quality, direct P2P, publication, and MemoryEndpoints continuity
also remain unproven.

Campaign counters remain exactly `0/20`, `0/50`, `0/25`, `0/40`, and `0/20`.
