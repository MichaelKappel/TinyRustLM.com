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
550: it was unavailable, which alone did not prove absence. A later successful
listing of the exact `.well-known` directory confirmed absence. On September27
at21:25 UTC the exact prepared marker was installed after another account/root,
homepage-equality and absence check; both FTPS and HTTPS returned the exact126
bytes and bound hash. Read `ftps-target-marker-installation.json` in the private
cleanup records. Do not overwrite a differing marker. Installing this target
identity did not publish the application or prove the remaining release gates.

The owner-run 26-directory experiment cleanup is independently verified complete,
along with the numerical installer and earlier 241-file cleanup. Their completed
helpers are retired to Git history. Do not rerun them. C107 corrects a false
ecosystem-source classification of one exact hash-bound setuptools fixture,
preserving the locked reference environment. The registered-root source scan
now passes. Clean committed source, remote equality and all other release gates
remain required; this scan alone does not establish publication readiness.

After the source and release prerequisites are satisfied, use the prepared
configuration explicitly from the canonical root:

```powershell
$deploymentMemory = 'E:\Source\Rust\.local-secrets\tinyrustlm-deployment.uai'
& '.\tinyrustlm\tools\deploy-tinyrustlm-web.ps1' -WorkspaceMemory $deploymentMemory -ValidateCredentialProfileOnly
& '.\tinyrustlm\tools\deploy-tinyrustlm-web.ps1' -WorkspaceMemory $deploymentMemory -ValidateOnly
```

Both modes retain source admission. C108 executed both complete commands:
credential validation passed and ValidateOnly passed for32 publication files.
Temporary validation and publication working files now use the existing ignored
`artifacts/verification/web-deployments` area; final attempt and terminal receipts
remain visible in `artifacts/web-deployments` for review and source control.
Publication then uses the
same script and memory argument without a validation switch, after all gates
pass. Require exact remote marker identity, predecessor checks, the publication
lease, committed source custody and final HTTPS byte readback. Preserve actual
failure/recovery receipts; do not claim release-wide atomic rollback.

Preparation and earlier transport evidence live in the existing private cleanup
records under `artifacts/ecosystem-cleanup-20260912/`. These records and the
external configuration are not website payloads. No site, model or NuGet package
publication follows from this setup.
