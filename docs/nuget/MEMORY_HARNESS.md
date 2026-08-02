# UAIX Memory Harness

`TinyRustLM.Memory` exposes the public UAIX `.uai` memory and advanced persona package validation harness used by the Browser package line.

The harness follows the public UAIX AI Memory Package Wizard at `https://uaix.org/en-us/tools/ai-memory-package-wizard/`, the Advanced Persona Profile package rules at `https://uaix.org/en-us/ai-memory/uai-files/persona-uai/personality-packs/`, and the Talisman System boundary at `https://uaix.org/en-us/ai-memory/talisman-system/`.

## Public Scope

- Build a deterministic required-file plan for Base, Agent File Handoff, LLM Wiki, combined File Handoff plus LLM Wiki, Multi-Agent Communication, Talisman System, and Advanced Persona Profile packages.
- Return a native-backed setup catalog so consumers discover supported setup strings, labels, public authority URLs, point-agent setup URLs, package features, and excluded private capabilities from the harness instead of hard-coding their own Wizard mode list.
- Expose Wizard adoption features in that catalog, including the `script[data-ai-digest]` machine-readable digest convention, local browser draft restore, Safe Structured Output Mode, browser-generated ZIP packages, canonical starter ZIP downloads, package model JSON, knowledge graph JSON, and `llms.uai` / `llms-full.uai` exports.
- Inspect `.uai` package directories, `.zip` files, and `.uaix` archives without extracting archive entries.
- Inspect UAIX memory manifest JSON.
- Report required, missing, present, and hashed package files.
- Report a machine-checkable `FileDeck` summary with universal, profile, configuration-specific, content-triggered, persona, evidence, export, and triggered style-axis counts.
- Require the Wizard's local-first export deck in the baseline plan: `.uai/agent-pickup.uai`, `.uai/archives/session-log.uai`, `.uai/exports/manifest.json`, `.uai/exports/manifest-overlay.json`, `.uai/exports/package-model.json`, `.uai/exports/knowledge-graph.json`, `.uai/exports/llms.uai`, and `.uai/exports/llms-full.uai`.
- Bind package validity to the manifest overlay: when `.uai/manifest.uaix.json` is present, it must declare the effective required-file set, not merely coexist beside the files.
- For `advanced_persona_profile`, expose the UAIX `.uaix`, ZIP, and TXT deck expectation in the setup catalog, then inspect every required UAIX persona dimension file and report whether it declares `depth_level_0_to_10`, a disclosure boundary, source confidence, triggered style-axis separation, and explicit non-inference rules. Package validation fails when required dimension evidence is missing, which keeps advanced persona handoff packages reviewable before the TinyRustLM runtime consumes them.
- Preserve persona source records without silently rewriting identity, style, worldview, political leaning, appearance, relationship posture, examples, or continuity cues.
- Keep Talisman, Totem, and Taboo anchor-governance package planning as review/audit records; runtime enforcement remains a local implementation responsibility.

## Recommended API Flow

1. Call `TinyRustLmMemoryClient.GetSupportedSetups()` and let users pick one of the returned setup IDs. Use each descriptor's `SetupUrl`, `AuthorityUrls`, and `PackageFeatures` to route users or agents to the correct Wizard fragment instead of maintaining a parallel setup registry.
2. Call `GetRequiredFiles()` with the selected setup and any content-triggered options, then inspect `FileDeck` to confirm the selected deck includes the expected local-first exports and persona evidence counts. `IncludesManifestJson` and `IncludesManifestOverlay` intentionally distinguish the Wizard's manifest JSON from the manifest overlay. The package clean-consumer gate uses the content-triggered Advanced Persona Profile deck (`code_like_artifacts`, `deployment`, `communication_style`, and `source_notes`) and expects `62` required files: `7` universal, `11` profile, `10` configuration-specific, `10` content-triggered, `24` advanced-persona, `22` persona dimension, `4` triggered style-axis, `5` evidence, and `6` export files.
3. Generate or collect the `.uai` package files using the UAIX Wizard and persona guidance.
4. Call `InspectPackage()` or `ValidatePackage()` before handing the package to the TinyRustLM runtime harness.

The package inspection result includes `FileDeck`, `PersonaDimensions`, `PersonaDimensionsValid`, and `PersonaDimensionWarningCount` for advanced persona setups. These are validation evidence fields only; they do not generate persona content, rank personalities, mutate source persona files, or certify fidelity.

The included console sample wires this flow into runtime usage: run `TinyRustLM.ConsoleSample --memory-setups` to inspect the catalog, or run the normal model sample to see an advanced-persona plan preview and file-deck count summary generated through `UAIX.Browser.Memory`.

## Boundary

The package does not perform hosted import validation, automatic repository writes, automatic LLM Wiki synchronization, Talisman runtime enforcement, persona-fidelity certification, or destination-platform policy bypass. It is a validation and runtime-harness adoption surface.
