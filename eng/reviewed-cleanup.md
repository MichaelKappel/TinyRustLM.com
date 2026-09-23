# Owner-executed reviewed cleanup

The owner requested this local PowerShell handoff on September 23 after the
agent execution tool rejected an exact-file deletion before PowerShell started.
The agent must not invoke the real `-Apply` operation through a different tool.

Pause builds and other writers in these three repositories. Open PowerShell
as Administrator so the read-only access diagnostics have the best chance of
reading the old directories, then run:

```powershell
& 'E:\Source\Rust\TinyRustLM.com\eng\Invoke-ReviewedCleanup.ps1' -Apply
```

Omit `-Apply` for a nonmutating preview. `-Apply -WhatIf` also previews. The exact
list is in `eng/reviewed-cleanup-manifest.json`, pinned by SHA-256 in the script.

The current list contains 241 reviewed plain files (2,470,446 logical bytes):
obsolete TinyRust readers/tests/training producers and fixtures, Runtime's
174 copied documentation files, eight old LMComposer staging files, and the
three untracked TinyRust cleanup leftovers. Eleven listed directories are
removed only when empty. Existing Git history and compact lessons remain.

Every file is preflighted before any target mutation. Hash, size, containment,
and non-link checks are repeated immediately before each removal. A changed
file fails preflight; an individual deletion failure is recorded and independent
reviewed files can still finish. There is no recursive deletion, ACL mutation,
ownership takeover, Git index manipulation, model-root deletion, or publication.
No file under `D:\LLMs` or `X:\LLMS` is a target. Physical storage recovery is
not measured. Directory removal refuses unknown contents.

The 35 currently unreadable directories and two link paths are diagnostic-only.
The script records bounded direct-child metadata when readable, or the exact
access/link refusal. It does not delete uninspected trees or follow links.

Apply writes an append-only JSON-lines report beneath
`artifacts/ecosystem-cleanup-20260912/operator-cleanup-*.jsonl` and prints its
exact path. A partial run retains completed records. Keep that report for the
agent to inspect, validate the actual deletions, finish access-dependent cleanup,
check in the changes, and resume FTP/FTPS publication. Running this script does
not itself claim that the entire ecosystem is clean or deployed.

Validation before handoff: 12 PowerShell fixture checks passed; the real preview
verified all 241 files, removed zero, and reported all 37 unresolved access paths.
PowerShell coverage percentage and the real operator apply are unmeasured.
Tests used only new owned fixture scratch and removed it afterward.
