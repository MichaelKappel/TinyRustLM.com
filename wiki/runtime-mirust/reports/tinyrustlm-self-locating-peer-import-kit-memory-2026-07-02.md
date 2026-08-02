# TinyRustLM Self-Locating Peer Import Kit Memory - 2026-07-02

## Status

Implemented in local source for TinyRustLM/SLMComposer.com.

## What Changed

`P2P Import` generated scripts no longer require the user to edit an `EDIT_ME\MiniModel.org` workspace placeholder before the receiver-side Rust verifier can run.

The generated `.minimodel-peer-import.ps1` script now:

- resolves the MiniModel Rust workspace from `MINIMODEL_WORKSPACE`, `E:/Source/Rust/MiniModel.org`, or nearby workspace paths relative to the downloaded script;
- keeps the peer-import request JSON beside the script with `Join-Path $PSScriptRoot`;
- keeps the downloaded or user-provided MiniModel metadata manifest beside the script;
- writes the verified peer-import output directory beside the script;
- fails early when the peer-import request JSON is missing;
- prints the resolved MiniModel workspace, request, manifest, and output paths before running Cargo.

## Boundary

The script still does not download model bytes from TinyRustLM.com, MiniModel.org, Hugging Face, or any project server. The only optional project-server fetch is the small MiniModel metadata manifest declared by catalog metadata. Model chunks must come from the consenting direct peer URL captured in the local `minimodel.peer_import_request.v0`.

The receiving verifier path remains:

```powershell
cargo run -p minimodel -- import-peer-request <request-json> <manifest> <output-dir>
```

Rust then validates the request against the manifest, fetches peer pieces from the consenting peer, assembles the `.slm`, verifies artifact checksum and manifest expectations, and writes the local import receipt before TinyRustLM can load the user-selected local `.slm`.

## Regression Evidence

`tinyrustlm/tools/browser-smoke.js` now asserts that the generated peer-import script contains:

- `Resolve-ExistingPath`;
- `MINIMODEL_WORKSPACE`;
- `$CandidateMiniModelWorkspaces`;
- `$PeerImportRequest = Join-Path $PSScriptRoot`;
- `$ImportDir = Join-Path $PSScriptRoot`;
- resolved path status output for workspace, request, manifest, and output directory;
- the consenting direct peer URL;
- the `import-peer-request` command.

The same smoke rejects the old `EDIT_ME\\MiniModel.org` placeholder path.

## Related Files

- `tinyrustlm/app/app.js`
- `tinyrustlm/tools/browser-smoke.js`
- `tinyrustlm/README.md`
- `tinyrustlm/docs/browser-runtime.md`
