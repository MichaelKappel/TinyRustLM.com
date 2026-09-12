# Server-seeded startup

The owner requested automatic small-model startup through MiniModel.org on
2026-09-12. This explicitly supersedes older rules forbidding all project
model hosting. TinyRustLM.com still runs inference locally and does not serve
model bytes. MiniModel.org may serve verified model files as the initial seed.

Source changes implemented:

- Permit only the exact bootstrap origin `https://minimodel.org` in the shared
  direct-transfer authority and the MiniModel catalog validator. Keep signed
  announcements, qualification receipts, member hashes and activation checks.
- Prefer the bootstrap seed when multiple signed peers advertise a composition.
- Restore the current cached model first. Otherwise automatically acquire the
  smallest eligible server-seeded composition of at most 768 MiB. Expose progress
  and cancellation; do not automatically invoke local conversion or arbitrary peers.
- Keep manual IP/peer settings, files and Hugging Face in Advanced. Chat lists
  installed and downloadable models only. Preserve the existing visual design.
- Remove retired `.slm` Hugging Face discovery, ranking and import suggestions.
  The active old catalog, announcement, contact-book and receipt/status-file
  readers have been removed from the app. Two obsolete announcement files still
  await owner-run deletion after automatic approval review blocked removal.
  Historical tooling review and complete legacy-support cleanup remain open.

Not deployed or working-model proof:

- The local catalog has zero entries and zero seed announcements. Its September
  8 issuance expired September 9; extending an empty catalog would not supply a model.
- Only one real `.slm2` was found under `D:\LLMs\TinyRustLM`: the 598,308,416-byte
  Qwen3 structural v12 experiment. Existing evidence does not qualify it as a
  working browser chat model. Raw checkpoints and the larger `X:\LLMS` collection
  do not satisfy the six-member browser composition contract.
- This machine has IIS, but no MiniModel.org or TinyRustLM.com site binding.
  MiniModel.org currently resolves to 66.29.148.128; its repository describes
  external FTPS publication. The owner has been asked whether to move the site
  here or connect the existing site to a seed service here. No DNS or hosting
  changes have been made.
- The public TinyRustLM page observed in this session was the older 0.4.1 setup
  UI, while the dirty source tree already contained the 0.5.0 compact chooser.

Completion requires a real licensed small composition with passing numerical,
quality and browser evidence; deployed HTTPS seed routes reading files only
from `D:\LLMs\TinyRustLM`; current catalog/announcements; and an outside-network
fresh-browser download and useful chat verification. Keep only the validated
replacement model when a new version supersedes it. Never copy the source tree
or model payloads into another project or temporary drive location.

The owner's later clarification rejects old model versions and compatibility
support during pre-release. A header-verified inventory found 44 SLM1 files
under `D:\LLMs\TinyRustLM`, totaling 35,279,860,160 logical bytes. The agent's
initial deletion attempt was rejected by automatic approval review. The owner
subsequently ran the reviewed PowerShell script: its receipt records all 44
deleted, zero remaining and no failure at 2026-09-12T15:48:26.0923254Z.
An independent filesystem check after the owner reported completion confirmed
all 44 inventoried paths absent and the current SLM2 experiment still present.
Exact paths and the deletion receipt are recorded in
`artifacts/cleanup-20260912/retired-slm1-models.json` and
`artifacts/cleanup-20260912/retired-slm1-deletion-receipt.json`.
Logical file sizes do not establish physical space reclaimed because some
files were hardlinked. Legacy code removal and a working default remain separate work.

Validation: targeted catalog and URL unit tests, bootstrap selection tests,
and real Edge UI tests with synthetic catalog metadata. Synthetic metadata
tests validate behavior, not real model quality or public seed availability.

Final checks: 77 TinyRustLM acquisition/selection/catalog/URL unit tests and
32 MiniModel catalog/contract tests passed. All 25 desktop chooser cases passed
across the full run and focused reruns after updating Advanced expectations;
three focused mobile startup/Advanced cases passed. Browser catalog module
line coverage was 82.10%. The large app's changed bootstrap selector has
extracted-function boundary tests plus real-browser dispatch/cancellation
tests; no whole-app coverage percentage is claimed. The installed Edge channel
was used without downloading another browser copy.

Implementation has advanced through the committed checkpoints and verification
recorded in `docs/ecosystem-cleanup-2026-09-12.md`. The current chooser integration
is prepared for its own source checkpoint. Source changes remain unpublished;
real-model qualification, initial server hosting and full release gates remain
open. Existing unfinished deployment work is preserved for separate review.
