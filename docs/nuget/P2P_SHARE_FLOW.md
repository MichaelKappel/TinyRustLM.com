# P2P Share Flow

The public P2P SDK is metadata-bound. It helps developers share already-created `.slm` artifacts without exposing TinyRustLM private authoring logic, peer discovery, premium routing, or conversion tools.

## Prepare Share Kit

`TinyRustLmP2PClient.PrepareLocalShareKit` validates the `.slm`, splits it into SHA-256-addressed piece files, writes `tinyrustlm.p2p-manifest.v0.json`, exports share metadata, and optionally writes a consenting peer announcement. The .NET method returns a typed `P2PShareKitReport` with manifest paths, hashes, typed manifest metadata, and public boundary flags. Use `PrepareLocalShareKitJson` only when the exact native JSON document is needed for handoff or audit storage. When `PublicBaseUrl` is supplied, it is validated directly before any announcement is written.

`ExportShareMetadata(manifestJson)` returns typed `P2PShareMetadata` for catalog or UI integration. Use `ExportShareMetadataJson` when writing the metadata document directly.

The manifest declares piece routes and checksums but does not embed model bytes.

## Signed Manifest Verification

`VerifySignedManifest(signedManifestJson, publicKeyJson)` validates a metadata-only `tinyrustlm.p2p_signed_manifest.v0` envelope before a catalog or receiver trusts the wrapped manifest. The verifier first validates the wrapped `tinyrustlm.p2p_manifest.v0` document, then checks that `signature.kind=external-signature-v0`, `signature.payload_sha256` matches the SDK canonical manifest payload, `signature.value` uses `ed25519-base64:`, and the signature verifies against the supplied local `minimodel.public_key.v0` public-key JSON.

The public key document must declare `key_algorithm=ed25519`, `usage=minimodel-manifest-signing-v0`, matching publisher id, signing key id, public-key route, public-key SHA-256, and `revoked=false`. The API performs no signing, private-key handling, remote key discovery, transparency-log lookup, peer discovery, conversion, or catalog publication. Use `VerifySignedManifestJson` only when writing the exact native verification report for audit or interop storage.

## Import From Manifest

`ImportFromManifest(manifestJson)` validates the manifest and returns an import plan. Importers that fetch pieces themselves must verify each piece SHA-256, assemble the `.slm`, and verify the final artifact SHA-256 before loading.

`ImportFromManifest(manifestJson, shareKitRoot, outputPath)` performs the local import gate when the caller already has a share kit on disk. It resolves only safe relative manifest piece routes under `shareKitRoot`, verifies every piece SHA-256 and byte count, assembles a temporary output file, verifies the final artifact SHA-256, runs the public `.slm` validator, refuses to overwrite an existing output path or receipt path, writes `<output.slm>.p2p-import-receipt.json`, and returns the same `tinyrustlm.p2p_local_import_receipt.v0` receipt. This method performs no network fetches, peer discovery, private routing, conversion, or model-ranking logic.

## Inspect Local Import Receipt

`InspectLocalImportReceipt(receiptJson, outputPath)` validates a `tinyrustlm.p2p_local_import_receipt.v0` sidecar against a caller-supplied local `.slm` output. The receipt's stored output path is treated as provenance only, so developers can move verified artifacts between workspaces while still proving the local bytes match the receipt's artifact SHA-256, byte count, boundary flags, verified piece count, and public `.slm` validator. The inspector performs no network fetches, peer discovery, private routing, conversion, or model-ranking logic.

## Announcements

Announcements require `peer_consent=true`, a metadata-only manifest URL, manifest SHA-256, artifact SHA-256, and artifact byte count. The SDK accepts public `https://` manifest URLs and explicit-port loopback `http://127.0.0.1:<port>`, `http://localhost:<port>`, or `http://[::1]:<port>` URLs for local development. Announcement and `PublicBaseUrl` validation rejects credentials, whitespace, query strings, fragments, backslashes, dot-segment traversal, and encoded dot/slash/backslash path traversal before metadata is trusted.

`ValidateAnnouncement(announcementJson)` returns a typed `P2PAnnouncement`. Use `ValidateAnnouncementJson(announcementJson)` only when writing the exact validated native announcement document for audit, handoff, or interop storage.

## Catalog Application

`ApplyReceivedAnnouncement` validates an announcement and stores it once in a typed local `P2PAnnouncementCatalog` keyed by peer, manifest, and manifest SHA-256. The same peer plus manifest identity may be replayed only when the model id, manifest URL, manifest SHA-256, artifact SHA-256, and artifact byte count stay stable; conflicting re-announcements fail closed before catalog mutation. Existing catalog JSON is capped at 4 MiB before parsing. Use `ApplyReceivedAnnouncementJson` when exchanging or storing the exact native catalog JSON.

`InspectAnnouncementCatalog(catalogJson)` validates an existing catalog without applying a new announcement and returns `P2PAnnouncementCatalogInspection` with the catalog SHA-256, announcement count, peer count, manifest count, model count, total announced artifact bytes, and validity flag. Use `InspectAnnouncementCatalogJson` when writing the exact inspection document for audit or interop storage.
