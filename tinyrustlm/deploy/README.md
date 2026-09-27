# TinyRustLM website publication

Use local validation and explicit FTPS. Git pushes store source; they do not
publish the website. Do not enable GitHub Actions or charged GitHub features.

The prepared local configuration is
`E:\Source\Rust\.local-secrets\tinyrustlm-deployment.uai`, outside Git. It refers
to the existing `E:\Source\Rust\ftp.txt` through
`deployment_ftp_credentials_file`; it contains no password. The full FTP account
name, host and port are independently bound by the remaining deployment fields.
Do not replace those fields by whichever account happens to authenticate.

`deployment-root-sentinel.v1.json` contains the exact prepared identity bytes for
the remote path `.well-known/tinyrustlm-deployment-target.v1.json`. Keep its UTF-8
encoding without BOM and its single LF-terminated JSON line. Its SHA-256 is
`78afeb99c33a966d784c578eef84b87437e74c1cefa96bcf3f370dc5299d9c67`.
The external configuration binds that same hash. This marker is separate from
the site release manifest; the publisher verifies it but does not install it.

September 27 observations establish certificate-verified FTPS authentication
and exact root `index.html` equality with public HTTPS. The marker read returned
550: it was unavailable, which does not prove absence. No remote marker has been
installed by this work. Confirm exact target ownership and distinguish absence
from denied access before any separately reviewed marker installation. Do not
overwrite an existing differing marker or treat the prepared local file as proof
of remote authority.

The source scan currently fails on 37 unreadable paths. The owner-run numerical
installer cleanup remains pending; its exact script is
`tinyrustlm/tools/remove-reviewed-numerical-installer-output.ps1`. The earlier
241-file cleanup is complete and its retired helper must not be rerun. Other
source-read failures still require resolution even after installer retirement.
Do not change ACLs or use another deletion API to evade an automatic refusal.

After the source and release prerequisites are satisfied, use the prepared
configuration explicitly from the canonical root:

```powershell
$deploymentMemory = 'E:\Source\Rust\.local-secrets\tinyrustlm-deployment.uai'
& '.\tinyrustlm\tools\deploy-tinyrustlm-web.ps1' -WorkspaceMemory $deploymentMemory -ValidateCredentialProfileOnly
& '.\tinyrustlm\tools\deploy-tinyrustlm-web.ps1' -WorkspaceMemory $deploymentMemory -ValidateOnly
```

Both modes retain source admission. The preparation check performed separately
on named functions validates configuration and local marker bytes only; it is
not a successful execution of either command above. Publication then uses the
same script and memory argument without a validation switch, after all gates
pass. Require exact remote marker identity, predecessor checks, the publication
lease, committed source custody and final HTTPS byte readback. Preserve actual
failure/recovery receipts; do not claim release-wide atomic rollback.

Preparation and earlier transport evidence live in the existing private cleanup
records under `artifacts/ecosystem-cleanup-20260912/`. These records and the
external configuration are not website payloads. No site, model or NuGet package
publication follows from this setup.
