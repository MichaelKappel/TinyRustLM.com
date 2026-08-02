# TinyRustLM Clean Source History And Public Deployment Memory

Date: 2026-08-02

Status: current source-boundary and public-web evidence; enterprise vNext and
the dogfood campaign remain incomplete

## Authority Route

Read this report with:

- `wiki/runtime-mirust/reports/tinyrustlm-enterprise-vnext-development-goal-memory-2026-08-01.md`;
- `docs/report-intake/2026-08-01/enterprise-vnext-development-research/MANIFEST.md`; and
- `agent-file-handoff/Improvement/2026-08-01-authoritative-enterprise-vnext-development-goal-and-plan.md`.

This report supersedes the prior source-history blocker that required human
authorization. The human has explicitly authorized clean-slate history and
implementation replacement because TinyRustLM is pre-publication dogfood.
That authority does not permit deletion of failure evidence, false release
claims, or compatibility code.

## Public Web Deployment

The current public TinyRustLM web closure was deployed from source commit
`aa71b381a08296de03334e22e367cd2a9991b5c2`.

The successful immutable deployment receipt is:

- schema: `tinyrustlm.atomic_ftps_deployment.v6`;
- receipt SHA-256:
  `6fa595eacec74d9b5df7661f46d5fb526abcf6955cbe1c55a34819854e44edd2`;
- deployment manifest SHA-256:
  `6e63f96280d4cfa1fdfa42c8bb2b7b4e4128fe84a99b5765b016c3fa35e4a1bd`;
- secret-scan report SHA-256:
  `3ff17f9c0ca2627fe418ab0fbec91ed5acfa355eca3f377f8cc2ee42498cab99`;
- expected and verified files: 17/17;
- secret findings: 0;
- published release model bytes: false;
- retired model routes verified absent: 5/5;
- fresh artifact readback: true;
- publication temporary cleanup: true;
- per-artifact atomic promotion: true; and
- whole-site atomic promotion: false.

The deployment is therefore a verified coherent 17-file readback for this
specific attempt, but not a transactional whole-site generation swap. The
whole-site atomicity limitation remains an enterprise vNext release blocker;
do not normalize it as accepted architecture.

The immediately preceding failed attempt remains immutable:

- source commit:
  `0b0b819343b0c4da245a0e2af5768b3e13edcadd`;
- receipt SHA-256:
  `2cc81a489a886276eb114545fb665678f215aae0437a6915457ea528efd6b767`;
- status: fail;
- completed artifact readbacks: 14/17;
- failure step: `stage-write`; and
- bounded failure identity:
  `System.Net.WebException/ServerProtocolViolation/227`.

That failure led to bounded authoritative FTPS-read retries without erasing or
relabeling the failed attempt.

## Current Browser Observation

An unrestricted public-browser retry on 2026-08-02 passed six observations:
two routes (`/` and `/app/`) at desktop, narrow-desktop, and 390-pixel mobile
viewports.

- schema: `tinyrustlm.web_release_browser_smoke.v1`;
- source revision:
  `aa71b381a08296de03334e22e367cd2a9991b5c2`;
- report SHA-256:
  `5aa2ae64de2832c27da809b4bf0da95c79120c3a642940169ee81452bb60959d`;
- Chromium: `149.0.7827.55`;
- Playwright: `1.61.1`;
- browser closed: true;
- service workers blocked for the observation: true;
- runtime state: SIMD128 WASM loaded;
- visible model state: `No model imported`;
- unexpected origins: 0;
- blocked or failed requests: 0;
- console and page errors: 0;
- unnamed buttons: 0; and
- horizontal or composer overflow findings: 0.

Desktop and mobile screenshots were visually inspected. They showed the
truthful local-model-empty state without overlapping controls or clipped
primary interaction surfaces.

A preceding restricted-environment attempt is preserved separately with
receipt SHA-256
`cb8dc40657260995cf3c14bd1cda80df9c14bcadf75dc0eed1fea1354651ef33`.
It failed before the first observation with bounded code
`browser_smoke_observe_root_desktop_failed`; browser closure still succeeded.
It is infrastructure evidence, not a product regression and not a pass.

## Source-Control Cleanup

The integration branch first removed generated packages, downloaded model
review material, release outputs, native build products, and selected raw
performance outputs in commit
`e452266` (`repo: externalize generated and third-party artifacts`).

- removed tracked files: 1,465;
- removed tracked bytes: 1,342,428,995;
- staged paths outside the ten reviewed roots: 0; and
- unrelated canonical-worktree files changed by this operation: 0.

Commit `b59f0ba` then removed all tracked `artifacts/performance`, downloaded
ARM64 verification sysroots/packages, and compiled native-smoke executables.

- removed tracked files: 611;
- removed tracked bytes: 45,077,914;
- staged paths outside the three reviewed roots plus `.gitignore`: 0; and
- unrelated canonical-worktree files changed by this operation: 0.

The enterprise report package was integrated between those cleanup commits as
`a1eef28`, preserving all 25 report bodies, the authoritative goal, the
manifest, and UAI provenance records.

At commit `b59f0ba411aa0d4f6320e1ddda9b49e068d42c4d`, the integration tree has:

- 1,709 tracked files;
- 76,892,857 tracked bytes (73.33 MiB);
- exactly six model-like files, all deterministic `.slm` test fixtures from
  6,592 through 20,544 bytes; and
- no other tracked `.slm`, safetensors, GGUF, ONNX, checkpoint, raw-logit, or
  model-bin payload.

The 26,425,240-byte content-addressed vector experiment attempt remains
tracked because project verification code and immutable defect evidence bind
its exact SHA-256 identity. It is project-generated experiment evidence, not a
downloaded model or third-party dependency. Replacing it with a bounded
receipt plus external content-addressed payload requires a separate verified
evidence-schema migration, not an unreviewed deletion.

The six tiny fixtures remain allowed only for deterministic format/runtime
tests. They never count as useful models, campaign qualifications, browser
round models, public catalog models, or P2P fleet models.

## External Preservation

Material removed from the source snapshot was archived under the policy root
`E:\Source\External\TinyRustLM-source-history-externalized\2026-08-02` before
removal.

- archive `generated-and-third-party-aa71b38.tar.gz`:
  974,834,420 bytes, 1,543 archive entries, SHA-256
  `49fd75d45cf79fd6102bb2525543a0d3d360b948bd32a4510fadee992e9b4f7f`;
- archive `verification-performance-and-native-smoke-a1eef28.tar.gz`:
  10,979,973 bytes, 826 archive entries, SHA-256
  `63634b1b89f2ccf21c7fa8faa93c9e85049aa3cf90d38f75b2cc60bb8f64550e`;
- external manifest SHA-256:
  `957c5a2ee4dd24ff9d32fcdeaf806cac41a76a1da7d7a4a9cc54e7c7a741e6b5`.

These archives are untrusted review material. They are not release artifacts,
campaign evidence, product dependencies, or candidates for source control.

## History Boundary

The integration branch still descends from contaminated historical commits.
It must not be pushed as the clean source branch. Build a parentless clean root
snapshot from the final reviewed tree, then audit every reachable object,
tracked path, blob size, model-like path, secret finding, and test result before
publishing that branch.

The earlier attempt to push the contaminated release-history branch was
terminated before remote-ref creation. A subsequent `ls-remote` check found no
remote branch with that name. Do not retry that push.

## Current Campaign Truth

Dashboard v9 was recomputed from the canonical receipt store on 2026-08-02.

- dashboard file SHA-256:
  `456d619bedb291ca3d21a3e0830f93def4971e080ac1a63da0fdfbf39b55dabf`;
- dashboard content SHA-256:
  `ad6c437bd2070d870de26775355fe69d0a614a5ff302f108a7dcf8f0677207f6`;
- retained/current/quarantined receipts: 565/197/0;
- receipt-set SHA-256:
  `377a0d042ac830ee667c4136b632af7fcfa2b221f0ffa261404c2d43d41df218`;
- current-set SHA-256:
  `18a28f5f1ab0c63eb91aae84f6e9c70e1d6fca21377bfdb02897ae4010e6a494`;
- evidence health: healthy and resumable;
- rejected models: 64;
- active blockers: 15;
- qualified models: 0/20;
- clean browser rounds: 0/50;
- live MemoryEndpoints rounds: 0/25;
- outside-proven P2P lanes: 0/40;
- catalog announcements: 0/20;
- verified native RIDs: 2/3; and
- satisfied fault cases: 0/24.

Seventeen fault attempts are retained, but the current gate counts none as
satisfied because the plan parent and report claims are invalid. Do not report
17/24 as a passing or completed fault gate.

The campaign public-artifact aggregate is currently unavailable, so its
public HTTPS and secret-scan gates remain incomplete even though the separate
17-file web deployment receipt and browser smoke pass. Site deployment cannot
satisfy the campaign aggregate by implication.

## Required Next Actions

1. Create and audit the parentless clean-history branch.
2. Preserve this report in UAI short- and long-term routing.
3. Re-run source policy, secret, UAI, build, unit, integration, package, and
   browser tests against the clean root.
4. Push only the audited clean-history branch.
5. Keep the whole-site atomic release limitation and all 15 campaign blockers
   visible.
6. Continue the enterprise vNext plan with the ten required ADRs and receipt
   foundation before incompatible runtime or format implementation.
