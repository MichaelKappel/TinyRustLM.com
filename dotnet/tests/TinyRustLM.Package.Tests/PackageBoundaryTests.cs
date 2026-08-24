using System.IO.Compression;
using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using System.Text.RegularExpressions;
using Xunit;

namespace TinyRustLM.Package.Tests;

public sealed class PackageBoundaryTests
{
    [Fact]
    public void RequiredNuGetInfrastructureExists()
    {
        var root = RepositoryRoot();
        var required = new[]
        {
            "rust/crates/tinyrustlm-runtime/Cargo.toml",
            "rust/crates/tinyrustlm-slm2/Cargo.toml",
            "rust/crates/tinyrustlm-tokenizer2/Cargo.toml",
            "rust/crates/tinyrustlm-template2/Cargo.toml",
            "rust/crates/tinyrustlm-sampling2/Cargo.toml",
            "rust/crates/tinyrustlm-prompt2/Cargo.toml",
            "rust/crates/tinyrustlm-composition2/Cargo.toml",
            "rust/crates/tinyrustlm-p2p/Cargo.toml",
            "rust/crates/tinyrustlm-native/Cargo.toml",
            "rust/crates/tinyrustlm-convert/Cargo.toml",
            "dotnet/TinyRustLM.sln",
            "dotnet/src/TinyRustLM.Abstractions/TinyRustLM.Abstractions.csproj",
            "dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj",
            "dotnet/src/TinyRustLM.P2P/TinyRustLM.P2P.csproj",
            "dotnet/src/TinyRustLM.MemoryEndpoints/TinyRustLM.MemoryEndpoints.csproj",
            "dotnet/src/TinyRustLM.Conversion/TinyRustLM.Conversion.csproj",
            "dotnet/tools/TinyRustLM.ConversionFixtureTool/TinyRustLM.ConversionFixtureTool.csproj",
            "dotnet/tools/TinyRustLM.PackageCanonicalizer/TinyRustLM.PackageCanonicalizer.csproj",
            "dotnet/tools/TinyRustLM.PackageCanonicalizer/NuGetPackageCanonicalizer.cs",
            "dotnet/tools/TinyRustLM.PackageCanonicalizer/Program.cs",
            "eng/build-native.ps1",
            "eng/get-package-version.ps1",
            "eng/get-package-version.sh",
            "eng/audit-browser-nuget-release-readiness.ps1",
            "eng/audit-browser-nuget-release-readiness.sh",
            "eng/audit-nuget-release-readiness.ps1",
            "eng/audit-nuget-release-readiness.sh",
            "eng/pack.ps1",
            "eng/publish-nuget.ps1",
            "eng/publish-nuget.sh",
            "eng/publish-browser-nuget.ps1",
            "eng/publish-browser-nuget.sh",
            "eng/verify-browser-feed.ps1",
            "eng/verify-browser-feed.sh",
            "eng/verify-consumer.ps1",
            "eng/verify-consumer.sh",
            "eng/consumer-smoke/Program.cs",
            "eng/verify-feed-current.ps1",
            "eng/verify-feed-current.sh",
            "eng/verify-feed-package-hashes.ps1",
            "eng/verify-feed-package-hashes.sh",
            "eng/verify-memory-endpoints-relay-production.ps1",
            "eng/verify-memory-endpoints-relay-production.sh",
            "eng/verify-feed.ps1",
            "eng/verify-feed.sh",
            "eng/verify-memory-endpoints-live.ps1",
            "eng/verify-memory-endpoints-live.sh",
            "eng/verify-memory-endpoints-single-use-enrollment-live.ps1",
            "eng/verify-memory-endpoints-distributed-sync-contract.ps1",
            "eng/verify-memory-endpoints-distributed-sync-contract.sh",
            "eng/verify-memory-endpoints-distributed-sync-fixture.ps1",
            "eng/verify-memory-endpoints-distributed-sync-live.ps1",
            "eng/verify-package.ps1",
            "eng/verify-public-doc-sites.ps1",
            "eng/verify-public-doc-sites.sh",
            "eng/verify-tinyrustlm-public-root.ps1",
            "eng/verify-tinyrustlm-public-root.sh",
            "eng/verify-tinyrustlm-ui.ps1",
            "eng/verify-tinyrustlm-ui.sh",
            "eng/write-package-audit.ps1",
            "eng/write-package-audit.sh",
            "eng/public-api/TinyRustLM.MemoryEndpoints.txt",
            "docs/nuget/API_BOUNDARY.md",
            "docs/nuget/MEMORY_ENDPOINTS_CONNECTOR.md",
            "docs/nuget/MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_V1.md",
            "docs/nuget/memoryendpoints-distributed-sync-capabilities-v1.example.json",
            "docs/nuget/PACKAGE_SECURITY.md",
            "docs/nuget/PRIVATE_FEED.md",
            "docs/nuget/README.md",
            "tinyrustlm/deploy/memory-endpoints-relay-worker.js",
            "tinyrustlm/deploy/memory-endpoints-relay-wrangler.toml.example",
            "tinyrustlm/tools/memory-endpoints-relay-fixture-server.js",
            "tinyrustlm/tools/memory-endpoints-distributed-sync-fixture-server.js",
            "tinyrustlm/app/memory-endpoints-distributed-sync-v1.js",
            "tinyrustlm/tests/memory-endpoints-sync.test.js",
            "tinyrustlm/tests/memory-endpoints-distributed-sync-authority.test.js",
            ".github/workflows/ci.yml",
            ".github/workflows/nuget-feed-monitor.yml",
            ".github/workflows/release-browser-nuget.yml",
            ".github/workflows/release-nuget.yml"
        };

        foreach (var relative in required)
        {
            Assert.True(File.Exists(Path.Combine(root, relative)), relative);
        }
    }

    [Fact]
    public void MemoryEndpointsLiveVerifierScriptsAreOptInAndRedacted()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/verify-memory-endpoints-live.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/verify-memory-endpoints-live.sh"));
        var productionRelayPowerShell = File.ReadAllText(Path.Combine(root, "eng/verify-memory-endpoints-relay-production.ps1"));
        var productionRelayBash = File.ReadAllText(Path.Combine(root, "eng/verify-memory-endpoints-relay-production.sh"));
        var connectorDoc = File.ReadAllText(Path.Combine(root, "docs/nuget/MEMORY_ENDPOINTS_CONNECTOR.md"));
        var wranglerExample = File.ReadAllText(Path.Combine(root, "tinyrustlm/deploy/memory-endpoints-relay-wrangler.toml.example"));
        var relayFixture = File.ReadAllText(Path.Combine(root, "tinyrustlm/tools/memory-endpoints-relay-fixture-server.js"));

        foreach (var script in new[] { powershellScript, bashScript, productionRelayPowerShell, productionRelayBash })
        {
            Assert.Contains("MEMORYENDPOINTS_WORKSPACE_ID", script, StringComparison.Ordinal);
            Assert.Contains("MEMORYENDPOINTS_WORKSPACE_KEY", script, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", script, StringComparison.Ordinal);
            Assert.Contains("memoryType", script, StringComparison.Ordinal);
            Assert.Contains("status", script, StringComparison.Ordinal);
            Assert.Contains("handoff", script, StringComparison.Ordinal);
            Assert.Contains("memory_type", script, StringComparison.Ordinal);
            Assert.Contains("short_term", script, StringComparison.Ordinal);
            Assert.Contains("long_term", script, StringComparison.Ordinal);
            Assert.Contains("X-MemoryEndpoints-Key", script, StringComparison.Ordinal);
            Assert.Contains("Authorization", script, StringComparison.Ordinal);
            Assert.DoesNotContain("external-agent-codex-handoff-prompt", script, StringComparison.Ordinal);
        }

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.memory_endpoints.live_verification.v0", script, StringComparison.Ordinal);
            Assert.Contains("<redacted-hosted-memory-url>", script, StringComparison.Ordinal);
            Assert.Contains("MEMORYENDPOINTS_MEETING_SCOPE_ID", script, StringComparison.Ordinal);
            Assert.Contains("meeting-messages", script, StringComparison.Ordinal);
            Assert.Contains("transcript_probe_found", script, StringComparison.Ordinal);
            Assert.Contains("transcript_exposure_flags_clear", script, StringComparison.Ordinal);
            Assert.Contains("rawPayloadExposed", script, StringComparison.Ordinal);
        }

        foreach (var script in new[] { productionRelayPowerShell, productionRelayBash })
        {
            Assert.Contains("tinyrustlm.memory_endpoints.production_relay_verification.v0", script, StringComparison.Ordinal);
            Assert.Contains("TINYRUSTLM_MEMORY_ENDPOINTS_RELAY_URL", script, StringComparison.Ordinal);
            Assert.Contains("https://tinyrustlm.com/api/memoryendpoints", script, StringComparison.Ordinal);
            Assert.Contains("fail_route_contract", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm-memory-endpoints-production-relay.json", script, StringComparison.Ordinal);
            Assert.Contains("/api/memoryendpoints", script, StringComparison.Ordinal);
            Assert.Contains("/api/matm/agents/register", script, StringComparison.Ordinal);
            Assert.Contains("/api/matm/memory-events/submit", script, StringComparison.Ordinal);
            Assert.Contains("/api/matm/search", script, StringComparison.Ordinal);
            Assert.Contains("/models/probe.slm", script, StringComparison.Ordinal);
            Assert.Contains("Cache-Control", script, StringComparison.Ordinal);
            Assert.Contains("no-store", script, StringComparison.Ordinal);
            Assert.DoesNotContain("workspace key / bearer token", script, StringComparison.OrdinalIgnoreCase);
        }

        Assert.Contains("AllowMissingCredentials", powershellScript, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_MEMORY_ENDPOINTS_ALLOW_MISSING", bashScript, StringComparison.Ordinal);
        Assert.Contains("AllowMissingCredentials", productionRelayPowerShell, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_MEMORY_ENDPOINTS_ALLOW_MISSING", productionRelayBash, StringComparison.Ordinal);
        Assert.Contains("eng/verify-memory-endpoints-live.ps1", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("eng/verify-memory-endpoints-relay-production.ps1", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("artifacts/reports/tinyrustlm-memory-endpoints-live.json", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("artifacts/reports/tinyrustlm-memory-endpoints-production-relay.json", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("memory_type=status|handoff", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("Production Relay Deployment", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm/deploy/memory-endpoints-relay-wrangler.toml.example", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm.com/api/memoryendpoints/*", wranglerExample, StringComparison.Ordinal);
        Assert.Contains("www.tinyrustlm.com/api/memoryendpoints/*", wranglerExample, StringComparison.Ordinal);
        Assert.Contains("MEMORYENDPOINTS_BASE_URL = \"https://memoryendpoints.com\"", wranglerExample, StringComparison.Ordinal);
        Assert.DoesNotContain("WORKSPACE_KEY", wranglerExample, StringComparison.Ordinal);
        Assert.DoesNotContain("Bearer", wranglerExample, StringComparison.Ordinal);
        Assert.Contains("127.0.0.1", relayFixture, StringComparison.Ordinal);
        Assert.Contains("const RELAY_PREFIX = \"/api/memoryendpoints\"", relayFixture, StringComparison.Ordinal);
        Assert.Contains("/api/matm/memory-events/submit", relayFixture, StringComparison.Ordinal);
        Assert.Contains("/api/matm/search", relayFixture, StringComparison.Ordinal);
        Assert.Contains("Cache-Control", relayFixture, StringComparison.Ordinal);
        Assert.Contains("no-store", relayFixture, StringComparison.Ordinal);
        Assert.DoesNotContain("memoryendpoints.com", relayFixture, StringComparison.OrdinalIgnoreCase);

        var browserApp = File.ReadAllText(Path.Combine(root, "tinyrustlm/app/app.js"));
        var browserSync = File.ReadAllText(Path.Combine(root, "tinyrustlm/app/memory-endpoints-sync.js"));
        var browserDistributedSync = File.ReadAllText(Path.Combine(
            root,
            "tinyrustlm/app/memory-endpoints-distributed-sync-v1.js"));
        var browserSyncTests = File.ReadAllText(Path.Combine(
            root,
            "tinyrustlm/tests/memory-endpoints-sync.test.js"));
        var browserDistributedTests = File.ReadAllText(Path.Combine(
            root,
            "tinyrustlm/tests/memory-endpoints-distributed-sync-authority.test.js"));
        var uiPowerShell = File.ReadAllText(Path.Combine(root, "eng/verify-tinyrustlm-ui.ps1"));
        var uiBash = File.ReadAllText(Path.Combine(root, "eng/verify-tinyrustlm-ui.sh"));
        var relayWorker = File.ReadAllText(Path.Combine(root, "tinyrustlm/deploy/memory-endpoints-relay-worker.js"));
        Assert.Contains("prepareOutboxEntry", browserSyncTests, StringComparison.Ordinal);
        Assert.Contains("pull-before-push", browserDistributedTests, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(
            "authoritative fixture preserves replay, conflict, tombstone, and device semantics",
            browserDistributedTests,
            StringComparison.Ordinal);
        Assert.Contains("test:ui", uiPowerShell, StringComparison.Ordinal);
        Assert.Contains("test:ui", uiBash, StringComparison.Ordinal);
        Assert.Contains("web-release-local-smoke.js", uiPowerShell, StringComparison.Ordinal);
        Assert.Contains("web-release-local-smoke.js", uiBash, StringComparison.Ordinal);
        Assert.DoesNotContain("browser-smoke.js", uiPowerShell, StringComparison.Ordinal);
        Assert.DoesNotContain("browser-smoke.js", uiBash, StringComparison.Ordinal);
        Assert.Contains("Same-Origin Relay", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("Browser CORS Requirement", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("OPTIONS", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("Access-Control-Request-Headers", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("Idempotency-Key", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("RELAY_PREFIX = \"/api/memoryendpoints\"", relayWorker, StringComparison.Ordinal);
        Assert.Contains("MATM_PREFIX = \"/api/matm/\"", relayWorker, StringComparison.Ordinal);
        Assert.Contains("appendUpstreamPath", relayWorker, StringComparison.Ordinal);
        Assert.Contains("MAX_REQUEST_BYTES", relayWorker, StringComparison.Ordinal);
        Assert.Contains("cache-control", relayWorker, StringComparison.Ordinal);
        Assert.DoesNotContain("/models/", relayWorker.Replace("source.pathname.includes(\"/models/\")", "", StringComparison.Ordinal), StringComparison.Ordinal);
        Assert.Contains("selectedModelHostedMemoryContextBudget", browserApp, StringComparison.Ordinal);
        Assert.Contains("refreshMemoryEndpointsPackedContext", browserApp, StringComparison.Ordinal);
        Assert.Contains("packMemoryContext", browserSync, StringComparison.Ordinal);
        Assert.Contains("decideRevisionMutation", browserSync, StringComparison.Ordinal);
        Assert.Contains("UNTRUSTED MEMORY DATA", browserSync, StringComparison.Ordinal);
        Assert.Contains("MemoryEndpointsDistributedSyncClient", browserDistributedSync, StringComparison.Ordinal);
        Assert.Contains("synchronizePending", browserDistributedSync, StringComparison.Ordinal);
        Assert.Contains("/api/matm/sync/receipts", browserDistributedSync, StringComparison.Ordinal);
        Assert.DoesNotContain("/api/matm/sync/search-watermark", browserDistributedSync, StringComparison.Ordinal);
        Assert.Contains("Hosted memory injection is budget-aware", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("Offline And Multi-Tab Synchronization", connectorDoc, StringComparison.Ordinal);
        Assert.Contains("Retrieval Safety", connectorDoc, StringComparison.Ordinal);
    }

    [Fact]
    public void SingleUseEnrollmentLiveVerifierRejectsReplayAndReportsDefects()
    {
        var root = RepositoryRoot();
        var script = File.ReadAllText(Path.Combine(
            root,
            "eng/verify-memory-endpoints-single-use-enrollment-live.ps1"));
        var fixture = File.ReadAllText(Path.Combine(
            root,
            "eng/verify-memory-endpoints-single-use-enrollment-fixture.ps1"));

        Assert.Contains("memoryendpoints.single_agent_enrollment_contract.v1", script, StringComparison.Ordinal);
        Assert.Contains("singleAgentEnrollment", script, StringComparison.Ordinal);
        Assert.Contains("freshCompanyCreated", script, StringComparison.Ordinal);
        Assert.Contains("issueInvitation", script, StringComparison.Ordinal);
        Assert.Contains("firstClaimSucceeded", script, StringComparison.Ordinal);
        Assert.Contains("secondClaimRejected", script, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-enrollment-claim-first", script, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-enrollment-claim-replay", script, StringComparison.Ordinal);
        Assert.Contains("-AllowedStatusCodes @(409, 410)", script, StringComparison.Ordinal);
        Assert.Contains("enrollment_url_consumed", script, StringComparison.Ordinal);
        Assert.Contains("invitation_consumed", script, StringComparison.Ordinal);
        Assert.Contains("closeCompany", script, StringComparison.Ordinal);
        Assert.Contains("deleteCompany", script, StringComparison.Ordinal);
        Assert.Contains("companyCloseAttempted", script, StringComparison.Ordinal);
        Assert.Contains("companyDeleteAttempted", script, StringComparison.Ordinal);
        Assert.Contains("test_company_cleanup_failed", script, StringComparison.Ordinal);
        Assert.Contains("ErrorDetails.Message", script, StringComparison.Ordinal);
        Assert.Contains("finally {", script, StringComparison.Ordinal);
        Assert.Contains("invitationUrlPersisted = $false", script, StringComparison.Ordinal);
        Assert.Contains("$invitationUrl = $null", script, StringComparison.Ordinal);
        Assert.Contains("$agentToken = $null", script, StringComparison.Ordinal);
        Assert.Contains("Send-BackendDefect", script, StringComparison.Ordinal);
        Assert.Contains("/api/matm/agent-messages", script, StringComparison.Ordinal);
        Assert.Contains("/api/matm/meeting-messages", script, StringComparison.Ordinal);
        Assert.Contains("blocked_contract_missing", script, StringComparison.Ordinal);
        Assert.DoesNotContain("external-agent-codex-handoff-prompt", script, StringComparison.Ordinal);
        Assert.Contains("replay-succeeds", fixture, StringComparison.Ordinal);
        Assert.Contains("cleanupStatus", fixture, StringComparison.Ordinal);
        Assert.Contains("companyClosed", fixture, StringComparison.Ordinal);
        Assert.Contains("companyDeleted", fixture, StringComparison.Ordinal);
        Assert.Contains("DELETE /api/matm/test/companies/delete", fixture, StringComparison.Ordinal);
        Assert.DoesNotContain("external-agent-codex-handoff-prompt", fixture, StringComparison.Ordinal);
    }

    [Fact]
    public void DistributedSyncContractAndVerifiersStayFailClosedAndRedacted()
    {
        var root = RepositoryRoot();
        var powershell = File.ReadAllText(Path.Combine(
            root,
            "eng/verify-memory-endpoints-distributed-sync-contract.ps1"));
        var bash = File.ReadAllText(Path.Combine(
            root,
            "eng/verify-memory-endpoints-distributed-sync-contract.sh"));
        var contract = File.ReadAllText(Path.Combine(
            root,
            "docs/nuget/MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_V1.md"));
        var example = File.ReadAllText(Path.Combine(
            root,
            "docs/nuget/memoryendpoints-distributed-sync-capabilities-v1.example.json"));
        var fixture = File.ReadAllText(Path.Combine(
            root,
            "tinyrustlm/tools/memory-endpoints-distributed-sync-fixture-server.js"));
        var authorityTest = File.ReadAllText(Path.Combine(
            root,
            "tinyrustlm/tests/memory-endpoints-distributed-sync-authority.test.js"));
        var fixtureVerifier = File.ReadAllText(Path.Combine(
            root,
            "eng/verify-memory-endpoints-distributed-sync-fixture.ps1"));
        var liveVerifier = File.ReadAllText(Path.Combine(
            root,
            "eng/verify-memory-endpoints-distributed-sync-live.ps1"));
        var browserContract = File.ReadAllText(Path.Combine(
            root,
            "tinyrustlm/app/memory-endpoints-distributed-sync-v1.js"));
        var apiBaseline = File.ReadAllText(Path.Combine(
            root,
            "eng/public-api/TinyRustLM.MemoryEndpoints.txt"));
        var verifyPackage = File.ReadAllText(Path.Combine(root, "eng/verify-package.ps1"));
        var ciWorkflow = File.ReadAllText(Path.Combine(root, ".github/workflows/ci.yml"));

        foreach (var verifier in new[] { powershell, bash })
        {
            Assert.Contains(
                "tinyrustlm.memory_endpoints.distributed_sync_contract_verification.v2",
                verifier,
                StringComparison.Ordinal);
            Assert.Contains("openapi.json", verifier, StringComparison.Ordinal);
            Assert.Contains("/api/matm/sync/capabilities", verifier, StringComparison.Ordinal);
            Assert.Contains("/api/matm/sync/devices", verifier, StringComparison.Ordinal);
            Assert.Contains("/api/matm/sync/devices/rotate", verifier, StringComparison.Ordinal);
            Assert.Contains("/api/matm/sync/devices/revoke", verifier, StringComparison.Ordinal);
            Assert.Contains("/api/matm/sync/mutations", verifier, StringComparison.Ordinal);
            Assert.Contains("/api/matm/sync/receipts", verifier, StringComparison.Ordinal);
            Assert.Contains("/api/matm/sync/changes", verifier, StringComparison.Ordinal);
            Assert.Contains("/api/matm/sync/heads", verifier, StringComparison.Ordinal);
            Assert.Contains("/api/matm/sync/retention", verifier, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", verifier, StringComparison.Ordinal);
            Assert.Contains("raw_credential_exposed", verifier, StringComparison.Ordinal);
            Assert.Contains("raw_payload_exposed", verifier, StringComparison.Ordinal);
            Assert.Contains("Access-Control-Request-Headers", verifier, StringComparison.Ordinal);
            Assert.Contains("Idempotency-Key", verifier, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("MEMORYENDPOINTS_WORKSPACE_KEY", verifier, StringComparison.Ordinal);
            Assert.DoesNotContain("/api/matm/sync/search-watermark", verifier, StringComparison.Ordinal);
            Assert.DoesNotContain("external-agent-codex-handoff-prompt", verifier, StringComparison.Ordinal);
        }

        Assert.DoesNotContain("AllowMissingContract", powershell, StringComparison.Ordinal);
        Assert.DoesNotContain("TINYRUSTLM_ALLOW_MISSING_DISTRIBUTED_SYNC_CONTRACT", bash, StringComparison.Ordinal);
        Assert.Contains("Same key and same body returns the original status and receipt", contract, StringComparison.Ordinal);
        Assert.Contains("Same key and different body returns a nested public-safe", contract, StringComparison.Ordinal);
        Assert.Contains("Search is never used as an authoritative pull source", contract, StringComparison.Ordinal);
        Assert.Contains("memoryendpoints.distributed_sync_capabilities.v1", example, StringComparison.Ordinal);
        Assert.Contains("\"hardForgetSupported\": false", example, StringComparison.Ordinal);
        Assert.DoesNotContain("Bearer ", example, StringComparison.OrdinalIgnoreCase);

        Assert.Contains("127.0.0.1", fixture, StringComparison.Ordinal);
        Assert.Contains("idempotency_conflict", fixture, StringComparison.Ordinal);
        Assert.Contains("device_revoked", fixture, StringComparison.Ordinal);
        Assert.Contains("parent_revision_mismatch", fixture, StringComparison.Ordinal);
        Assert.Contains("tombstone_resurrection_blocked", fixture, StringComparison.Ordinal);
        Assert.Contains("dropNextMutationResponse", fixture, StringComparison.Ordinal);
        Assert.DoesNotContain("memoryendpoints.com", fixture, StringComparison.OrdinalIgnoreCase);

        Assert.Contains("const availability = await client.connect()", authorityTest, StringComparison.Ordinal);
        Assert.Contains("recorded[0].headers.Authorization, undefined", authorityTest, StringComparison.Ordinal);
        Assert.Contains("assert.equal(conflictB.status, \"conflict\")", authorityTest, StringComparison.Ordinal);
        Assert.Contains("assert.equal(rejected.status, \"rejected\")", authorityTest, StringComparison.Ordinal);
        Assert.Contains("assert.equal(tombstone.head.status, \"tombstoned\")", authorityTest, StringComparison.Ordinal);
        Assert.Contains("10480c0bbee1bac2e1512d10f5f9861b75068a5546e68ef435a4fa574a3c979f", authorityTest, StringComparison.Ordinal);
        Assert.Contains("fb0e0340f476a6bcd7fea8eb92441a59dd41c6ab2622a56ed2ac7afac20f8445", authorityTest, StringComparison.Ordinal);
        Assert.Contains("synchronizePending", browserContract, StringComparison.Ordinal);
        Assert.Contains("pullChanges", browserContract, StringComparison.Ordinal);
        Assert.Contains("lookupReceipt", browserContract, StringComparison.Ordinal);
        Assert.Contains("verify-memory-endpoints-distributed-sync-contract.ps1", fixtureVerifier, StringComparison.Ordinal);
        Assert.Contains("MEMORYENDPOINTS_WORKSPACE_KEY", liveVerifier, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm.memory_endpoints.distributed_sync_live_verification.v1", liveVerifier, StringComparison.Ordinal);
        Assert.Contains("devices_revoked_after_test", liveVerifier, StringComparison.Ordinal);
        Assert.Contains("secret_material_included = $false", liveVerifier, StringComparison.Ordinal);
        Assert.Contains(
            "TinyRustLmMemoryEndpointsClient.SubmitRevisionMutationAsync",
            apiBaseline,
            StringComparison.Ordinal);
        Assert.Contains(
            "MemoryEndpointsDistributedSyncTransport.ComputeHostedRevisionMutationFingerprint",
            apiBaseline,
            StringComparison.Ordinal);
        Assert.Contains(
            "TinyRustLmMemoryEndpointsClient.LookupRevisionReceiptAsync",
            apiBaseline,
            StringComparison.Ordinal);
        Assert.DoesNotContain("Bearer ", apiBaseline, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("IncludeOptionalMemoryEndpoints", verifyPackage, StringComparison.Ordinal);
        Assert.Contains(
            "eng/verify-package.ps1 -IncludeOptionalMemoryEndpoints",
            ciWorkflow,
            StringComparison.Ordinal);
        Assert.Contains(
            "eng/verify-memory-endpoints-distributed-sync-fixture.ps1",
            ciWorkflow,
            StringComparison.Ordinal);
    }

    [Fact]
    public void UiVerificationScriptsCoverCurrentBrowserAndAcquisitionGates()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/verify-tinyrustlm-ui.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/verify-tinyrustlm-ui.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.ui_verification.v1", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm-browser-harness", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm-local-server", script, StringComparison.Ordinal);
            Assert.Contains("test:ui", script, StringComparison.Ordinal);
            Assert.Contains("web-release-local-smoke.js", script, StringComparison.Ordinal);
            Assert.Contains("model-acquisition.test.js", script, StringComparison.Ordinal);
            Assert.Contains("companion-bridge.test.js", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.SeedHost.Tests", script, StringComparison.Ordinal);
            Assert.Contains("huggingface_conversion_cli", script, StringComparison.Ordinal);
            Assert.DoesNotContain("browser-smoke.js", script, StringComparison.Ordinal);
            Assert.DoesNotContain("conversion-kit", script, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("TinyRustLM UI verification passed", script, StringComparison.Ordinal);
        }

        Assert.Contains("RunBrowserSmoke", powershellScript, StringComparison.Ordinal);
        Assert.Contains("RunDeepAcquisition", powershellScript, StringComparison.Ordinal);
        Assert.Contains("RUN_BROWSER_SMOKE", bashScript, StringComparison.Ordinal);
        Assert.Contains("RUN_DEEP_ACQUISITION", bashScript, StringComparison.Ordinal);
    }

    [Fact]
    public void BrowserMemoryDeckUiExposesFileDeckEvidence()
    {
        var root = RepositoryRoot();
        var app = File.ReadAllText(Path.Combine(root, "tinyrustlm/app/app.js"));
        var readme = File.ReadAllText(Path.Combine(root, "tinyrustlm/README.md"));
        var browserRuntime = File.ReadAllText(Path.Combine(root, "tinyrustlm/docs/browser-runtime.md"));

        Assert.Contains("function localMemoryFileDeckSummary", app, StringComparison.Ordinal);
        Assert.Contains("fileDeck", app, StringComparison.Ordinal);
        Assert.Contains("totalRequiredFiles", app, StringComparison.Ordinal);
        Assert.Contains("personaDimensionFiles", app, StringComparison.Ordinal);
        Assert.Contains("evidenceFiles", app, StringComparison.Ordinal);
        Assert.Contains("exportFiles", app, StringComparison.Ordinal);
        Assert.Contains("includesManifestOverlay", app, StringComparison.Ordinal);
        Assert.Contains("includesPackageModel", app, StringComparison.Ordinal);
        Assert.Contains("includesKnowledgeGraph", app, StringComparison.Ordinal);
        Assert.Contains("includesLlmsExports", app, StringComparison.Ordinal);
        Assert.Contains("includesPersonaSourceEvidence", app, StringComparison.Ordinal);
        Assert.Contains("FileDeck ${deck.totalRequiredFiles} required", app, StringComparison.Ordinal);
        Assert.Contains("UAIX exports verified", app, StringComparison.Ordinal);
        Assert.Contains("persona source evidence bound", app, StringComparison.Ordinal);

        Assert.Contains("FileDeck-style summary", readme, StringComparison.Ordinal);
        Assert.Contains("FileDeck-style summary", browserRuntime, StringComparison.Ordinal);
    }

    [Fact]
    public void PublicRootVerificationScriptsCoverTinyRustLmComRoot()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/verify-tinyrustlm-public-root.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/verify-tinyrustlm-public-root.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.public_root_verification.v1", script, StringComparison.Ordinal);
            Assert.Contains("verify-tinyrustlm-ui", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm.ui_verification.v1", script, StringComparison.Ordinal);
            Assert.Contains("ui_verification_sha256", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm-public-root-verification.json", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM public-root verification passed", script, StringComparison.Ordinal);
            Assert.DoesNotContain("browser-smoke.js", script, StringComparison.Ordinal);
            Assert.DoesNotContain("loopback-browser-smoke", script, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void ActiveConversationAssetsAndNoCredentialBoundaryAreRequired()
    {
        var root = RepositoryRoot();
        var appIndex = File.ReadAllText(Path.Combine(root, "tinyrustlm/app/index.html"));
        var rootIndex = File.ReadAllText(Path.Combine(root, "tinyrustlm/index.html"));
        var module = File.ReadAllText(Path.Combine(root, "tinyrustlm/app/active-conversation.js"));
        var app = File.ReadAllText(Path.Combine(root, "tinyrustlm/app/app.js"));
        var conversationSpec = File.ReadAllText(Path.Combine(root, "tinyrustlm/e2e/conversation.spec.js"));
        var companionSpec = File.ReadAllText(Path.Combine(root, "tinyrustlm/e2e/companion.spec.js"));
        var playwrightConfig = File.ReadAllText(Path.Combine(root, "tinyrustlm/playwright.config.js"));
        var visualLock = File.ReadAllText(Path.Combine(root, "tinyrustlm/tools/capture-ui-lock.js"));

        Assert.True(
            appIndex.IndexOf("./active-conversation.js", StringComparison.Ordinal) <
            appIndex.IndexOf("./app.js", StringComparison.Ordinal));
        Assert.True(
            rootIndex.IndexOf("./app/active-conversation.js", StringComparison.Ordinal) <
            rootIndex.IndexOf("./app/app.js", StringComparison.Ordinal));
        Assert.Contains("interrupted_after_restart", module, StringComparison.Ordinal);
        Assert.Contains("conversation contains credential-like material", module, StringComparison.Ordinal);
        Assert.Contains("deliverGeneratedOutput", app, StringComparison.Ordinal);
        Assert.Contains("data-conversation-state", appIndex, StringComparison.Ordinal);
        Assert.Contains("uses one response renderer", conversationSpec, StringComparison.Ordinal);
        Assert.Contains("#conversation .message-assistant", conversationSpec, StringComparison.Ordinal);
        Assert.Contains(".response-sentinel#response", conversationSpec, StringComparison.Ordinal);
        Assert.Contains("project domains must never serve model bytes", conversationSpec, StringComparison.Ordinal);
        Assert.Contains("prompts must remain browser-local", conversationSpec, StringComparison.Ordinal);
        Assert.Contains("restarts, resumes, and chats with the real 969648576-byte model", companionSpec, StringComparison.Ordinal);
        Assert.DoesNotContain("test.skip", companionSpec, StringComparison.Ordinal);
        Assert.Contains("testIgnore: /companion\\.spec\\.js/", playwrightConfig, StringComparison.Ordinal);
        Assert.Contains("conversation_mode", visualLock, StringComparison.Ordinal);
        Assert.Contains("[\"empty\", \"active\", \"long\"]", visualLock, StringComparison.Ordinal);
    }

    [Fact]
    public void NuGetDocsDescribePackageAndSymbolHashBinding()
    {
        var root = RepositoryRoot();
        var readme = File.ReadAllText(Path.Combine(root, "docs/nuget/README.md"));
        var security = File.ReadAllText(Path.Combine(root, "docs/nuget/PACKAGE_SECURITY.md"));
        var privateFeed = File.ReadAllText(Path.Combine(root, "docs/nuget/PRIVATE_FEED.md"));

        Assert.Contains("package-and-symbol bound", readme, StringComparison.Ordinal);
        Assert.Contains("every protected `.nupkg` and matching `.snupkg`", readme, StringComparison.Ordinal);
        Assert.Contains("NuGet Package Manager", readme, StringComparison.Ordinal);
        Assert.Contains("debug-symbol sidecar", readme, StringComparison.Ordinal);
        Assert.Contains("symbol-package hashes in `SHA256SUMS-UAIX.Browser-<version>.txt`", readme, StringComparison.Ordinal);
        Assert.Contains("packages or symbol packages missing from the generated SHA256SUMS manifest", security, StringComparison.Ordinal);
        Assert.Contains("packages or symbol packages whose hashes differ from that manifest", security, StringComparison.Ordinal);
        Assert.Contains("both the protected `.nupkg` files and their matching `.snupkg` symbol packages", privateFeed, StringComparison.Ordinal);
        Assert.Contains("NuGet Package Manager", privateFeed, StringComparison.Ordinal);
        Assert.Contains("debug-symbol sidecar", privateFeed, StringComparison.Ordinal);
        Assert.Contains("exact current package and symbol package set", privateFeed, StringComparison.Ordinal);
    }

    [Fact]
    public void ConsoleSampleExercisesSoleCompositionRuntime()
    {
        var root = RepositoryRoot();
        var sample = File.ReadAllText(Path.Combine(root, "dotnet/samples/TinyRustLM.ConsoleSample/Program.cs"));
        var sampleProject = File.ReadAllText(Path.Combine(root, "dotnet/samples/TinyRustLM.ConsoleSample/TinyRustLM.ConsoleSample.csproj"));

        Assert.DoesNotContain("TinyRustLM.Memory", sampleProject, StringComparison.Ordinal);
        Assert.Contains("TinyRustLmRuntimeFactory", sample, StringComparison.Ordinal);
        Assert.Contains("GetNativeContract()", sample, StringComparison.Ordinal);
        Assert.Contains("TinyRustLmSlm2Inspector", sample, StringComparison.Ordinal);
        Assert.Contains("TinyRustLmRuntimePolicy", sample, StringComparison.Ordinal);
        Assert.Contains("ActivateComposition", sample, StringComparison.Ordinal);
        Assert.Contains("BeginRequest", sample, StringComparison.Ordinal);
        Assert.Contains("runtime.Step()", sample, StringComparison.Ordinal);
        Assert.Contains("runtime.Finish()", sample, StringComparison.Ordinal);
        Assert.DoesNotContain("TinySlm", sample, StringComparison.Ordinal);
    }

    [Fact]
    public void NuGetAndRustWorkspaceVersionsStayAligned()
    {
        var root = RepositoryRoot();
        var props = File.ReadAllText(Path.Combine(root, "dotnet/Directory.Build.props"));
        var releaseNotes = ExtractProperty(props, "PackageReleaseNotes");
        var packageTags = ExtractProperty(props, "PackageTags");
        var packageVersion = PackageVersion();
        var cargoVersion = WorkspacePackageVersion(File.ReadAllText(Path.Combine(root, "Cargo.toml")));
        var protectedCrates = new[]
        {
            "rust/crates/tinyrustlm-runtime/Cargo.toml",
            "rust/crates/tinyrustlm-slm2/Cargo.toml",
            "rust/crates/tinyrustlm-tokenizer2/Cargo.toml",
            "rust/crates/tinyrustlm-template2/Cargo.toml",
            "rust/crates/tinyrustlm-sampling2/Cargo.toml",
            "rust/crates/tinyrustlm-prompt2/Cargo.toml",
            "rust/crates/tinyrustlm-composition2/Cargo.toml",
            "rust/crates/tinyrustlm-p2p/Cargo.toml",
            "rust/crates/tinyrustlm-native/Cargo.toml",
            "rust/crates/tinyrustlm-convert/Cargo.toml"
        };

        Assert.Equal(packageVersion, cargoVersion);
        Assert.Contains("<TinyRustLmPackageIdPrefix Condition=\"'$(TinyRustLmPackageIdPrefix)' == ''\">TinyRustLM</TinyRustLmPackageIdPrefix>", props, StringComparison.Ordinal);
        Assert.Contains("<TinyRustLmAbstractionsPackageId Condition=\"'$(TinyRustLmAbstractionsPackageId)' == ''\">$(TinyRustLmPackageIdPrefix).Abstractions</TinyRustLmAbstractionsPackageId>", props, StringComparison.Ordinal);
        Assert.Contains("<TinyRustLmCorePackageId Condition=\"'$(TinyRustLmCorePackageId)' == ''\">$(TinyRustLmPackageIdPrefix).Core</TinyRustLmCorePackageId>", props, StringComparison.Ordinal);
        Assert.Contains("<TinyRustLmP2PPackageId Condition=\"'$(TinyRustLmP2PPackageId)' == ''\">$(TinyRustLmPackageIdPrefix).P2P</TinyRustLmP2PPackageId>", props, StringComparison.Ordinal);
        Assert.Contains("<TinyRustLmMemoryEndpointsPackageId Condition=\"'$(TinyRustLmMemoryEndpointsPackageId)' == ''\">$(TinyRustLmPackageIdPrefix).MemoryEndpoints</TinyRustLmMemoryEndpointsPackageId>", props, StringComparison.Ordinal);
        Assert.Contains("<TinyRustLmConversionPackageId Condition=\"'$(TinyRustLmConversionPackageId)' == ''\">$(TinyRustLmPackageIdPrefix).Conversion</TinyRustLmConversionPackageId>", props, StringComparison.Ordinal);
        Assert.Contains("<TinyRustLmPackOptionalMemoryEndpoints Condition=\"'$(TinyRustLmPackOptionalMemoryEndpoints)' == ''\">false</TinyRustLmPackOptionalMemoryEndpoints>", props, StringComparison.Ordinal);
        Assert.Contains("<TinyRustLmPackPrivateConversion Condition=\"'$(TinyRustLmPackPrivateConversion)' == ''\">false</TinyRustLmPackPrivateConversion>", props, StringComparison.Ordinal);
        Assert.DoesNotContain("TinyRustLmMemoryPackageId", props, StringComparison.Ordinal);
        Assert.Contains("<DebugType>portable</DebugType>", props, StringComparison.Ordinal);
        Assert.Contains("<DebugSymbols>true</DebugSymbols>", props, StringComparison.Ordinal);
        Assert.Contains("<IncludeSymbols>true</IncludeSymbols>", props, StringComparison.Ordinal);
        Assert.Contains("<SymbolPackageFormat>snupkg</SymbolPackageFormat>", props, StringComparison.Ordinal);

        foreach (var requiredTag in new[]
        {
            "UAIX.Browser",
            "p2pRuntime",
            "p2pLLM",
            "MiniModel",
            "SLM2",
            "ACG2",
            "Prompt2",
            "Tokenizer2",
            "Template2",
            "Sampling2"
        })
        {
            Assert.Contains(requiredTag, packageTags, StringComparison.OrdinalIgnoreCase);
        }
        Assert.DoesNotContain("ai-memory", packageTags, StringComparison.OrdinalIgnoreCase);

        foreach (var requiredClaim in new[]
        {
            "Prelaunch single-product SDK",
            "mixed-Q8 SLM2 inspection",
            "fail-atomic ACG2 composition activation",
            "bounded Prompt2 and Sampling2 conversation execution",
            "exact native-contract validation",
            "immutable operation identities",
            "composition-bound fixed-piece direct transport",
            "no compatibility APIs",
            "local memory-package facade",
            "legacy model loader"
        })
        {
            Assert.Contains(requiredClaim, releaseNotes, StringComparison.OrdinalIgnoreCase);
        }
        foreach (var obsoleteClaim in new[]
        {
            "receipt-sidecar inspection",
            "direct announcement URL validation",
            "announcement JSON handoff",
            "catalog inspection",
            "managed/native generation-option validation"
        })
        {
            Assert.DoesNotContain(obsoleteClaim, releaseNotes, StringComparison.OrdinalIgnoreCase);
        }

        foreach (var relativePath in protectedCrates)
        {
            var cratePath = Path.Combine(root, relativePath);
            Assert.True(File.Exists(cratePath), relativePath);
            Assert.Contains(
                "version.workspace = true",
                File.ReadAllText(cratePath),
                StringComparison.Ordinal);
        }

        AssertPackageIdUsesProperty(root, "dotnet/src/TinyRustLM.Abstractions/TinyRustLM.Abstractions.csproj", "TinyRustLmAbstractionsPackageId");
        AssertPackageIdUsesProperty(root, "dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj", "TinyRustLmCorePackageId");
        AssertPackageIdUsesProperty(root, "dotnet/src/TinyRustLM.P2P/TinyRustLM.P2P.csproj", "TinyRustLmP2PPackageId");
        AssertPackageIdUsesProperty(root, "dotnet/src/TinyRustLM.MemoryEndpoints/TinyRustLM.MemoryEndpoints.csproj", "TinyRustLmMemoryEndpointsPackageId");
        AssertPackageIdUsesProperty(root, "dotnet/src/TinyRustLM.Conversion/TinyRustLM.Conversion.csproj", "TinyRustLmConversionPackageId");
        Assert.False(
            File.Exists(Path.Combine(root, "dotnet/src/TinyRustLM.Memory/TinyRustLM.Memory.csproj")),
            "The deleted local memory facade must not return.");

        AssertPackageProjectSearchMetadata(root, "dotnet/src/TinyRustLM.Abstractions/TinyRustLM.Abstractions.csproj", "UAIX.Browser.Core.Abstractions", "SLM2", "ACG2", "Prompt2", "Tokenizer2", "Template2", "Sampling2");
        AssertPackageProjectSearchMetadata(root, "dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj", "UAIX.Browser.p2pLLM.Runtime", "SLM2", "ACG2", "Prompt2", "bounded-generation");
        AssertPackageProjectSearchMetadata(root, "dotnet/src/TinyRustLM.P2P/TinyRustLM.P2P.csproj", "UAIX.Browser.p2pRuntime.P2P", "fixed-piece", "manifest", "share-kit", "SLM2", "ACG2");
        AssertPackageProjectSearchMetadata(root, "dotnet/src/TinyRustLM.MemoryEndpoints/TinyRustLM.MemoryEndpoints.csproj", "MemoryEndpoints.com", "LocalEndpoints.com", "short-term-memory", "long-term-memory", "optional-plugin", "local-connect");
        AssertPackageProjectSearchMetadata(root, "dotnet/src/TinyRustLM.Conversion/TinyRustLM.Conversion.csproj", "UAIX.Browser.p2pLLM.Conversion", "SLM2", "Tokenizer2", "Qwen3", "tinyrustlm-convert", "local-feed");
    }

    [Fact]
    public void PackageVerificationScriptsWriteMachineReadableAudit()
    {
        var root = RepositoryRoot();
        var powershellVerifier = File.ReadAllText(Path.Combine(root, "eng/verify-package.ps1"));
        var bashVerifier = File.ReadAllText(Path.Combine(root, "eng/verify-package.sh"));
        var powershellAuditWriter = File.ReadAllText(Path.Combine(root, "eng/write-package-audit.ps1"));
        var bashAuditWriter = File.ReadAllText(Path.Combine(root, "eng/write-package-audit.sh"));

        Assert.Contains("write-package-audit.ps1", powershellVerifier, StringComparison.Ordinal);
        Assert.Contains("write-package-audit.sh", bashVerifier, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_PACKAGE_AUDIT_REPORT", powershellVerifier, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_PACKAGE_AUDIT_REPORT", bashVerifier, StringComparison.Ordinal);
        Assert.Contains("\"fmt\", \"--all\", \"--check\"", powershellVerifier, StringComparison.Ordinal);
        Assert.Contains("cargo fmt --all --check", bashVerifier, StringComparison.Ordinal);
        Assert.Contains("\"clippy\", \"--workspace\", \"--all-targets\", \"--\", \"-D\", \"warnings\"", powershellVerifier, StringComparison.Ordinal);
        Assert.Contains("cargo clippy --workspace --all-targets -- -D warnings", bashVerifier, StringComparison.Ordinal);

        foreach (var writer in new[] { powershellAuditWriter, bashAuditWriter })
        {
            Assert.Contains("tinyrustlm.nuget.package_audit.v1", writer, StringComparison.Ordinal);
            Assert.DoesNotContain("tinyrustlm.nuget.package_audit.v0", writer, StringComparison.Ordinal);
            Assert.Contains("canonical_entry_timestamp_utc", writer, StringComparison.Ordinal);
            Assert.Contains("noncanonical_timestamp_entries", writer, StringComparison.Ordinal);
            Assert.Contains("noncanonical_package_timestamp_entry_count", writer, StringComparison.Ordinal);
            Assert.Contains("noncanonical_symbol_package_timestamp_entry_count", writer, StringComparison.Ordinal);
            Assert.Contains("expected_package_names", writer, StringComparison.Ordinal);
            Assert.Contains("expected_symbol_package_names", writer, StringComparison.Ordinal);
            Assert.Contains("missing_package_entries", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_package_entries", writer, StringComparison.Ordinal);
            Assert.Contains("missing_symbol_package_entries", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_symbol_package_entries", writer, StringComparison.Ordinal);
            Assert.Contains("missing_package_count", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_package_count", writer, StringComparison.Ordinal);
            Assert.Contains("missing_symbol_package_count", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_symbol_package_count", writer, StringComparison.Ordinal);
            Assert.Contains("expected_package_id", writer, StringComparison.Ordinal);
            Assert.Contains("expected_package_version", writer, StringComparison.Ordinal);
            Assert.Contains("package_identity_mismatches", writer, StringComparison.Ordinal);
            Assert.Contains("package_identity_mismatch_count", writer, StringComparison.Ordinal);
            Assert.Contains("symbol_package_identity_mismatch_count", writer, StringComparison.Ordinal);
            Assert.Contains("SymbolsPackage", writer, StringComparison.Ordinal);
            Assert.Contains("symbol_package_missing_pdb_count", writer, StringComparison.Ordinal);
            Assert.Contains("symbol_packages", writer, StringComparison.Ordinal);
            Assert.Contains("missing_metadata_fields", writer, StringComparison.Ordinal);
            Assert.Contains("metadata_policy_violations", writer, StringComparison.Ordinal);
            Assert.Contains("metadata_policy_violation_count", writer, StringComparison.Ordinal);
            Assert.Contains("project_url:https://tinyrustlm.com/", writer, StringComparison.Ordinal);
            Assert.Contains("title:TinyRustLM-UAIX-Browser", writer, StringComparison.Ordinal);
            Assert.Contains("required_search_terms", writer, StringComparison.Ordinal);
            Assert.Contains("missing_search_terms", writer, StringComparison.Ordinal);
            Assert.Contains("missing_search_term_count", writer, StringComparison.Ordinal);
            Assert.Contains("UAIX.org", writer, StringComparison.Ordinal);
            Assert.Contains("p2pRuntime.com", writer, StringComparison.Ordinal);
            Assert.Contains("p2pLLM.com", writer, StringComparison.Ordinal);
            Assert.Contains("declared_package_file_entries", writer, StringComparison.Ordinal);
            Assert.Contains("missing_package_file_entries", writer, StringComparison.Ordinal);
            Assert.Contains("package_documentation_entries", writer, StringComparison.Ordinal);
            Assert.Contains("expected_package_documentation_entries", writer, StringComparison.Ordinal);
            Assert.Contains("package_documentation_mismatches", writer, StringComparison.Ordinal);
            Assert.Contains("package_documentation_mismatch_count", writer, StringComparison.Ordinal);
            Assert.Contains("package_entry_names", writer, StringComparison.Ordinal);
            Assert.Contains("allowed_package_entry_patterns", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_package_content_entries", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_package_content_entry_count", writer, StringComparison.Ordinal);
            Assert.Contains("package/services/metadata/core-properties/*.psmdcp", writer, StringComparison.Ordinal);
            Assert.Contains("public_api_entries", writer, StringComparison.Ordinal);
            Assert.Contains("expected_public_api_entries", writer, StringComparison.Ordinal);
            Assert.Contains("missing_public_api_entries", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_public_api_entries", writer, StringComparison.Ordinal);
            Assert.Contains("missing_public_api_entry_count", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_public_api_entry_count", writer, StringComparison.Ordinal);
            Assert.Contains("TinyRustLmP2PClient", writer, StringComparison.Ordinal);
            Assert.Contains("TinyRustLmMemoryClient", writer, StringComparison.Ordinal);
            Assert.Contains("TinySlmInspector", writer, StringComparison.Ordinal);
            Assert.Contains("expected_dependency_entries", writer, StringComparison.Ordinal);
            Assert.Contains("missing_dependency_entries", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_dependency_entries", writer, StringComparison.Ordinal);
            Assert.Contains("Build,Analyzers", writer, StringComparison.Ordinal);
            Assert.Contains("allowed_native_entries", writer, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm_native.dll", writer, StringComparison.Ordinal);
            Assert.Contains("libtinyrustlm_native.so", writer, StringComparison.Ordinal);
            Assert.Contains("libtinyrustlm_native.dylib", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_native_entries", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_native_entry_count", writer, StringComparison.Ordinal);
            Assert.Contains("xml_documentation_entries", writer, StringComparison.Ordinal);
            Assert.Contains("absolute_path_matches", writer, StringComparison.Ordinal);
            Assert.Contains("source_file_entries", writer, StringComparison.Ordinal);
            Assert.Contains("debug_symbol_entries", writer, StringComparison.Ordinal);
            Assert.Contains("generated_output_entries", writer, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void PackageAuditWritersUseTheSamePublicApiContract()
    {
        var root = RepositoryRoot();
        var powershellWriter = File.ReadAllText(Path.Combine(root, "eng/write-package-audit.ps1"));
        var bashWriter = File.ReadAllText(Path.Combine(root, "eng/write-package-audit.sh"));

        static string[] PublicApiEntries(string source) => Regex
            .Matches(source, "[\"']([MPTF]:TinyRustLM\\.[^\"']+)[\"']", RegexOptions.CultureInvariant)
            .Select(match => match.Groups[1].Value)
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToArray();

        var powershellEntries = PublicApiEntries(powershellWriter);
        var bashEntries = PublicApiEntries(bashWriter);

        Assert.NotEmpty(powershellEntries);
        Assert.Equal(powershellEntries, bashEntries);
    }

    [Fact]
    public void SeedHostPackScriptsVerifyTransactionalFeedPromotion()
    {
        var root = RepositoryRoot();
        var powershellPack = File.ReadAllText(Path.Combine(root, "eng", "pack-seed-host.ps1"));
        var bashPack = File.ReadAllText(Path.Combine(root, "eng", "pack-seed-host.sh"));
        var verifier = File.ReadAllText(Path.Combine(root, "eng", "verify-seed-host-packages.ps1"));

        Assert.Contains("/p:SeedHostUsePackagedDependencies=true", powershellPack, StringComparison.Ordinal);
        Assert.Contains("artifacts/seed-host-native", powershellPack, StringComparison.Ordinal);
        Assert.Contains("Invoke-SeedHostPackageVerifier", powershellPack, StringComparison.Ordinal);
        Assert.Contains("-PublishedFeed", powershellPack, StringComparison.Ordinal);
        Assert.Contains("Move-ToArchive", powershellPack, StringComparison.Ordinal);
        Assert.Contains("Get-FileHash", powershellPack, StringComparison.Ordinal);
        Assert.Contains("failed-promotion", powershellPack, StringComparison.Ordinal);
        Assert.DoesNotContain("Remove-Item -LiteralPath $File.FullName -Force", powershellPack, StringComparison.Ordinal);

        Assert.Contains("SeedHostUsePackagedDependencies=true", bashPack, StringComparison.Ordinal);
        Assert.Contains("artifacts/seed-host-native", bashPack, StringComparison.Ordinal);
        Assert.Contains("verify-seed-host-packages.ps1", bashPack, StringComparison.Ordinal);
        Assert.Contains("-PublishedFeed", bashPack, StringComparison.Ordinal);
        Assert.Contains("move_to_archive", bashPack, StringComparison.Ordinal);
        Assert.Contains("failed-promotion", bashPack, StringComparison.Ordinal);
        Assert.DoesNotContain(
            "Seed-host clean consumer verification failed with exit code $LASTEXITCODE",
            verifier,
            StringComparison.Ordinal);
    }

    [Fact]
    public void PackScriptsProduceOnlyTheCanonicalPackageSet()
    {
        var root = RepositoryRoot();
        var powershellPack = File.ReadAllText(Path.Combine(root, "eng/pack.ps1"));
        var bashPack = File.ReadAllText(Path.Combine(root, "eng/pack.sh"));

        Assert.Contains("[string]$PackageIdPrefix = \"TinyRustLM\"", powershellPack, StringComparison.Ordinal);
        Assert.Contains("[string]$AbstractionsPackageId = \"\"", powershellPack, StringComparison.Ordinal);
        Assert.Contains("[string]$CorePackageId = \"\"", powershellPack, StringComparison.Ordinal);
        Assert.Contains("[string]$P2PPackageId = \"\"", powershellPack, StringComparison.Ordinal);
        Assert.Contains("[string]$MemoryEndpointsPackageId = \"\"", powershellPack, StringComparison.Ordinal);
        Assert.Contains("[string]$ConversionPackageId = \"\"", powershellPack, StringComparison.Ordinal);
        Assert.Contains("[switch]$IncludeOptionalMemoryEndpoints", powershellPack, StringComparison.Ordinal);
        Assert.Contains("[switch]$IncludePrivateConversion", powershellPack, StringComparison.Ordinal);
        Assert.DoesNotContain("MemoryPackageId", powershellPack, StringComparison.Ordinal);
        Assert.DoesNotContain("TinyRustLM.Memory/TinyRustLM.Memory.csproj", powershellPack, StringComparison.Ordinal);

        Assert.Contains("$writtenPackageIds = @($AbstractionsPackageId, $CorePackageId, $P2PPackageId)", powershellPack, StringComparison.Ordinal);
        Assert.Contains("$writtenPackageIds += $MemoryEndpointsPackageId", powershellPack, StringComparison.Ordinal);
        Assert.Contains("$writtenPackageIds += $ConversionPackageId", powershellPack, StringComparison.Ordinal);
        Assert.Contains("/p:TinyRustLmAbstractionsPackageId=$AbstractionsPackageId", powershellPack, StringComparison.Ordinal);
        Assert.Contains("/p:TinyRustLmCorePackageId=$CorePackageId", powershellPack, StringComparison.Ordinal);
        Assert.Contains("/p:TinyRustLmP2PPackageId=$P2PPackageId", powershellPack, StringComparison.Ordinal);
        Assert.Contains("/p:TinyRustLmMemoryEndpointsPackageId=$MemoryEndpointsPackageId", powershellPack, StringComparison.Ordinal);
        Assert.Contains("/p:TinyRustLmConversionPackageId=$ConversionPackageId", powershellPack, StringComparison.Ordinal);
        Assert.Contains("/p:TinyRustLmPackOptionalMemoryEndpoints=true", powershellPack, StringComparison.Ordinal);
        Assert.Contains("/p:TinyRustLmPackPrivateConversion=true", powershellPack, StringComparison.Ordinal);
        Assert.Contains("dotnet/src/TinyRustLM.Abstractions/TinyRustLM.Abstractions.csproj", powershellPack, StringComparison.Ordinal);
        Assert.Contains("dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj", powershellPack, StringComparison.Ordinal);
        Assert.Contains("dotnet/src/TinyRustLM.P2P/TinyRustLM.P2P.csproj", powershellPack, StringComparison.Ordinal);
        Assert.Contains("dotnet/src/TinyRustLM.MemoryEndpoints/TinyRustLM.MemoryEndpoints.csproj", powershellPack, StringComparison.Ordinal);
        Assert.Contains("dotnet/src/TinyRustLM.Conversion/TinyRustLM.Conversion.csproj", powershellPack, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-convert", powershellPack, StringComparison.Ordinal);
        Assert.DoesNotContain("tinyrustlm-slm-pack", powershellPack, StringComparison.Ordinal);

        Assert.Contains("PACKAGE_ID_PREFIX=\"${3:-TinyRustLM}\"", bashPack, StringComparison.Ordinal);
        Assert.Contains("ABSTRACTIONS_PACKAGE_ID=\"${TINYRUSTLM_ABSTRACTIONS_PACKAGE_ID:-$PACKAGE_ID_PREFIX.Abstractions}\"", bashPack, StringComparison.Ordinal);
        Assert.Contains("CORE_PACKAGE_ID=\"${TINYRUSTLM_CORE_PACKAGE_ID:-$PACKAGE_ID_PREFIX.Core}\"", bashPack, StringComparison.Ordinal);
        Assert.Contains("P2P_PACKAGE_ID=\"${TINYRUSTLM_P2P_PACKAGE_ID:-$PACKAGE_ID_PREFIX.P2P}\"", bashPack, StringComparison.Ordinal);
        Assert.Contains("MEMORY_ENDPOINTS_PACKAGE_ID=\"${TINYRUSTLM_MEMORY_ENDPOINTS_PACKAGE_ID:-$PACKAGE_ID_PREFIX.MemoryEndpoints}\"", bashPack, StringComparison.Ordinal);
        Assert.Contains("CONVERSION_PACKAGE_ID=\"${TINYRUSTLM_CONVERSION_PACKAGE_ID:-$PACKAGE_ID_PREFIX.Conversion}\"", bashPack, StringComparison.Ordinal);
        Assert.DoesNotContain("MEMORY_PACKAGE_ID", bashPack, StringComparison.Ordinal);
        Assert.Contains("PACKAGE_IDS=(\"$ABSTRACTIONS_PACKAGE_ID\" \"$CORE_PACKAGE_ID\" \"$P2P_PACKAGE_ID\")", bashPack, StringComparison.Ordinal);
        Assert.Contains("PACKAGE_IDS+=(\"$MEMORY_ENDPOINTS_PACKAGE_ID\")", bashPack, StringComparison.Ordinal);
        Assert.Contains("PACKAGE_IDS+=(\"$CONVERSION_PACKAGE_ID\")", bashPack, StringComparison.Ordinal);
        Assert.Contains("/p:TinyRustLmAbstractionsPackageId=$ABSTRACTIONS_PACKAGE_ID", bashPack, StringComparison.Ordinal);
        Assert.Contains("/p:TinyRustLmCorePackageId=$CORE_PACKAGE_ID", bashPack, StringComparison.Ordinal);
        Assert.Contains("/p:TinyRustLmP2PPackageId=$P2P_PACKAGE_ID", bashPack, StringComparison.Ordinal);
        Assert.Contains("/p:TinyRustLmMemoryEndpointsPackageId=$MEMORY_ENDPOINTS_PACKAGE_ID", bashPack, StringComparison.Ordinal);
        Assert.Contains("/p:TinyRustLmConversionPackageId=$CONVERSION_PACKAGE_ID", bashPack, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-convert", bashPack, StringComparison.Ordinal);
        Assert.DoesNotContain("tinyrustlm-slm-pack", bashPack, StringComparison.Ordinal);
        Assert.DoesNotContain("TinyRustLM.Memory/TinyRustLM.Memory.csproj", bashPack, StringComparison.Ordinal);

        foreach (var script in new[] { powershellPack, bashPack })
        {
            Assert.Contains("TinyRustLM.PackageCanonicalizer", script, StringComparison.Ordinal);
            Assert.Contains("canonicalize", script, StringComparison.Ordinal);
            Assert.Contains("--no-build", script, StringComparison.Ordinal);
            Assert.Contains("--no-restore", script, StringComparison.Ordinal);
            Assert.Contains("SHA256SUMS-", script, StringComparison.Ordinal);
            Assert.Contains("README-", script, StringComparison.Ordinal);
            Assert.Contains("Archive", script, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public void CorePackageProjectDoesNotReferencePrivateTooling()
    {
        var root = RepositoryRoot();
        var coreProject = File.ReadAllText(Path.Combine(
            root,
            "dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj"));
        var conversionProject = File.ReadAllText(Path.Combine(
            root,
            "dotnet/src/TinyRustLM.Conversion/TinyRustLM.Conversion.csproj"));
        var nativeCargo = File.ReadAllText(Path.Combine(
            root,
            "rust/crates/tinyrustlm-native/Cargo.toml"));

        Assert.DoesNotContain("slm_pack", coreProject, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("TinyRustLmPackPrivateConversion", conversionProject, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-convert", conversionProject, StringComparison.Ordinal);
        Assert.DoesNotContain("tinyrustlm-slm-pack", conversionProject, StringComparison.Ordinal);
        Assert.DoesNotContain("tools/slm_pack", nativeCargo, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("selector", nativeCargo, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("breeding", nativeCargo, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ReleaseWorkflowUsesAuditedPublishScript()
    {
        var root = RepositoryRoot();
        var workflow = File.ReadAllText(Path.Combine(root, ".github/workflows/release-nuget.yml"));
        var gitignore = File.ReadAllText(Path.Combine(root, ".gitignore"));

        Assert.Contains("tinyrustlm-nuget-packages", workflow, StringComparison.Ordinal);
        Assert.Contains("artifacts/packages/*.nupkg", workflow, StringComparison.Ordinal);
        Assert.Contains("artifacts/packages/*.snupkg", workflow, StringComparison.Ordinal);
        Assert.Contains("if-no-files-found: error", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/publish-nuget.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed-current.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed-package-hashes.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-current.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-hashes.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-smoke.json", workflow, StringComparison.Ordinal);
        Assert.Contains("FeedSmokeReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("FeedHashReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("Post-publish feed-current and feed-hash checks are mandatory", workflow, StringComparison.Ordinal);
        Assert.Contains("Start-Sleep -Seconds 30", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-post-publish-required-reports", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-smoke-report", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-publish-plan.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-publish-plan", workflow, StringComparison.Ordinal);
        Assert.Contains("hashFiles('artifacts/reports/tinyrustlm-nuget-publish-plan.json') != ''", workflow, StringComparison.Ordinal);
        Assert.Contains("PublishPlanReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/audit-nuget-release-readiness.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-release-readiness.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-release-readiness", workflow, StringComparison.Ordinal);
        Assert.Contains("ReleaseReadinessReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("id: readiness", workflow, StringComparison.Ordinal);
        Assert.Contains("status=$($report.status)", workflow, StringComparison.Ordinal);
        Assert.Contains("id-token: write", workflow, StringComparison.Ordinal);
        Assert.Contains("auth_mode", workflow, StringComparison.Ordinal);
        Assert.Contains("trusted_publishing", workflow, StringComparison.Ordinal);
        Assert.Contains("NuGet/login@v1", workflow, StringComparison.Ordinal);
        Assert.Contains("id: nuget_login", workflow, StringComparison.Ordinal);
        Assert.Contains("steps.nuget_login.outputs.NUGET_API_KEY", workflow, StringComparison.Ordinal);
        Assert.Contains("-AuthMode $env:TINYRUSTLM_NUGET_AUTH_MODE", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_TEMP_NUGET_API_KEY", workflow, StringComparison.Ordinal);
        Assert.Contains("steps.readiness.outputs.status != 'published_current'", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_FEED_CURRENT_REPORT", workflow, StringComparison.Ordinal);
        Assert.Contains("build-native:", workflow, StringComparison.Ordinal);
        Assert.Contains("win-x64,linux-x64,osx-x64,osx-arm64", workflow, StringComparison.Ordinal);
        Assert.DoesNotContain("-PackageVersion 0.1.0", workflow, StringComparison.Ordinal);
        Assert.Contains("NUGET_API_KEY", workflow, StringComparison.Ordinal);
        Assert.Contains("**/bin/", gitignore, StringComparison.Ordinal);
        Assert.Contains("**/obj/", gitignore, StringComparison.Ordinal);
    }

    [Fact]
    public void BrowserReleaseWorkflowUsesAuditedPublishScript()
    {
        var root = RepositoryRoot();
        var workflow = File.ReadAllText(Path.Combine(root, ".github/workflows/release-browser-nuget.yml"));

        Assert.Contains("Release UAIX Browser NuGet", workflow, StringComparison.Ordinal);
        Assert.Contains("uaix-browser-nuget-packages", workflow, StringComparison.Ordinal);
        Assert.Contains("artifacts/browser-packages/*.nupkg", workflow, StringComparison.Ordinal);
        Assert.Contains("artifacts/browser-packages/*.snupkg", workflow, StringComparison.Ordinal);
        Assert.Contains("if-no-files-found: error", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/pack.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("-PackageIdPrefix UAIX.Browser", workflow, StringComparison.Ordinal);
        Assert.Contains("-AbstractionsPackageId UAIX.Browser.Core.Abstractions", workflow, StringComparison.Ordinal);
        Assert.Contains("-CorePackageId UAIX.Browser.p2pLLM.Runtime", workflow, StringComparison.Ordinal);
        Assert.Contains("-P2PPackageId UAIX.Browser.p2pRuntime.P2P", workflow, StringComparison.Ordinal);
        Assert.Contains("-MemoryPackageId UAIX.Browser.Memory", workflow, StringComparison.Ordinal);
        Assert.Contains("-ConversionPackageId UAIX.Browser.p2pLLM.Conversion", workflow, StringComparison.Ordinal);
        Assert.Contains("-IncludePrivateConversion", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-browser-feed.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("BrowserFeedAuditReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/audit-browser-nuget-release-readiness.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("uaix-browser-nuget-release-readiness.json", workflow, StringComparison.Ordinal);
        Assert.Contains("uaix-browser-nuget-release-readiness", workflow, StringComparison.Ordinal);
        Assert.Contains("BrowserReleaseReadinessReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("id: readiness", workflow, StringComparison.Ordinal);
        Assert.Contains("status=$($report.status)", workflow, StringComparison.Ordinal);
        Assert.Contains("-AuthMode $env:UAIX_BROWSER_NUGET_AUTH_MODE", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/publish-browser-nuget.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("BrowserPublishPlanReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX_BROWSER_PACKAGE_IDS", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX.Browser.Core.Abstractions", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX.Browser.p2pLLM.Runtime", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX.Browser.p2pRuntime.P2P", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX.Browser.Memory", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX.Browser.p2pLLM.Conversion", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed-current.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_FEED_PACKAGE_IDS", workflow, StringComparison.Ordinal);
        Assert.Contains("uaix-browser-nuget-feed-current.json", workflow, StringComparison.Ordinal);
        Assert.Contains("FeedCurrentReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed-package-hashes.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("uaix-browser-nuget-feed-hashes.json", workflow, StringComparison.Ordinal);
        Assert.Contains("FeedHashReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("Post-publish feed-current and feed-hash checks are mandatory", workflow, StringComparison.Ordinal);
        Assert.Contains("Start-Sleep -Seconds 30", workflow, StringComparison.Ordinal);
        Assert.Contains("NuGet/login@v1", workflow, StringComparison.Ordinal);
        Assert.Contains("id-token: write", workflow, StringComparison.Ordinal);
        Assert.Contains("trusted_publishing", workflow, StringComparison.Ordinal);
        Assert.Contains("steps.readiness.outputs.status != 'published_current'", workflow, StringComparison.Ordinal);
        Assert.Contains("steps.nuget_login.outputs.NUGET_API_KEY", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_TEMP_NUGET_API_KEY", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_CONSUMER_CORE_PACKAGE_ID: UAIX.Browser.p2pLLM.Runtime", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_CONSUMER_P2P_PACKAGE_ID: UAIX.Browser.p2pRuntime.P2P", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_CONSUMER_MEMORY_PACKAGE_ID: UAIX.Browser.Memory", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_CONSUMER_CONVERSION_PACKAGE_ID: UAIX.Browser.p2pLLM.Conversion", workflow, StringComparison.Ordinal);
        Assert.Contains("-MemoryPackageId $env:TINYRUSTLM_CONSUMER_MEMORY_PACKAGE_ID", workflow, StringComparison.Ordinal);
        Assert.Contains("-ConversionPackageId $env:TINYRUSTLM_CONSUMER_CONVERSION_PACKAGE_ID", workflow, StringComparison.Ordinal);
        Assert.Contains("uaix-browser-nuget-post-publish-required-reports", workflow, StringComparison.Ordinal);
        Assert.DoesNotContain("eng/publish-nuget.ps1", workflow, StringComparison.Ordinal);
    }

    [Fact]
    public void CiWorkflowUploadsSymbolPackagesBesideNuGetPackages()
    {
        var root = RepositoryRoot();
        var workflow = File.ReadAllText(Path.Combine(root, ".github/workflows/ci.yml"));

        Assert.Contains("tinyrustlm-nuget-packages", workflow, StringComparison.Ordinal);
        Assert.Contains("artifacts/packages/*.nupkg", workflow, StringComparison.Ordinal);
        Assert.Contains("artifacts/packages/*.snupkg", workflow, StringComparison.Ordinal);
        Assert.Contains("if-no-files-found: error", workflow, StringComparison.Ordinal);
    }

    [Fact]
    public void CiWorkflowRunsTinyRustLmUiVerification()
    {
        var root = RepositoryRoot();
        var workflow = File.ReadAllText(Path.Combine(root, ".github/workflows/ci.yml"));

        Assert.Contains("Verify TinyRustLM UI contract", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-tinyrustlm-ui.ps1 -RunBrowserSmoke", workflow, StringComparison.Ordinal);
        Assert.Contains("run_deep_acquisition", workflow, StringComparison.Ordinal);
        Assert.Contains("Verify TinyRustLM deep model-acquisition contract", workflow, StringComparison.Ordinal);
        Assert.Contains("-RunDeepAcquisition", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-ui-deep-verification.json", workflow, StringComparison.Ordinal);
        Assert.Contains("artifacts/reports/ui-verification/**", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_UI_VERIFICATION_REPORT", workflow, StringComparison.Ordinal);
        Assert.Contains("UiVerificationReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-ui-verification", workflow, StringComparison.Ordinal);
        Assert.Contains("artifacts/reports/tinyrustlm-ui-verification.json", workflow, StringComparison.Ordinal);
        Assert.Contains("artifacts/reports/public-root-verification/**", workflow, StringComparison.Ordinal);
        Assert.Contains("if-no-files-found: error", workflow, StringComparison.Ordinal);
    }

    [Fact]
    public void PublishScriptsRejectUnexpectedPackages()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/publish-nuget.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/publish-nuget.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.nuget.package_audit.v1", script, StringComparison.Ordinal);
            Assert.DoesNotContain("tinyrustlm.nuget.package_audit.v0", script, StringComparison.Ordinal);
            Assert.Contains("Publish set contains unexpected package", script, StringComparison.Ordinal);
            Assert.Contains("Publish set contains unexpected symbol package", script, StringComparison.Ordinal);
            Assert.Contains("Required symbol package is missing from publish set", script, StringComparison.Ordinal);
            Assert.Contains("symbol_publish_mode", script, StringComparison.Ordinal);
            Assert.Contains("explicit_snupkg_push_after_primary_package", script, StringComparison.Ordinal);
            Assert.Contains("--no-symbols", script, StringComparison.Ordinal);
            Assert.Contains("expected_symbol_package_names", script, StringComparison.Ordinal);
            Assert.Contains("symbol_packages", script, StringComparison.Ordinal);
            Assert.Contains("Expected exactly", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.Abstractions", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.Core", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.P2P", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.Memory", script, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void FeedCurrentScriptsCoverAllProtectedPackages()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/verify-feed-current.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/verify-feed-current.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.nuget.feed_current.v0", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.Abstractions", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.Core", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.P2P", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.Memory", script, StringComparison.Ordinal);
            Assert.Contains("TINYRUSTLM_FEED_PACKAGE_IDS", script, StringComparison.Ordinal);
            Assert.Contains("package_ids", script, StringComparison.Ordinal);
            Assert.Contains("package_count", script, StringComparison.Ordinal);
        }

        Assert.Contains("[string[]]$PackageIds", powershellScript, StringComparison.Ordinal);
    }

    [Fact]
    public void BrowserFeedVerificationScriptsAuditBrandedPackages()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/verify-browser-feed.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/verify-browser-feed.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("uaix.browser.nuget.feed_audit.v0", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.Core.Abstractions", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.p2pLLM.Runtime", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.p2pRuntime.P2P", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.Memory", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.p2pLLM.Conversion", script, StringComparison.Ordinal);
            Assert.Contains("SHA256SUMS-UAIX.Browser", script, StringComparison.Ordinal);
            Assert.Contains("metadata_policy_violations", script, StringComparison.Ordinal);
            Assert.Contains("metadata_policy_violation_count", script, StringComparison.Ordinal);
            Assert.Contains("project_url:https://tinyrustlm.com/", script, StringComparison.Ordinal);
            Assert.Contains("missing_search_terms", script, StringComparison.Ordinal);
            Assert.Contains("dependency_mismatches", script, StringComparison.Ordinal);
            Assert.Contains("absolute_path_match_count", script, StringComparison.Ordinal);
            Assert.Contains("expected_symbol_package_names", script, StringComparison.Ordinal);
            Assert.Contains("missing_symbol_package_entries", script, StringComparison.Ordinal);
            Assert.Contains("unexpected_symbol_package_entries", script, StringComparison.Ordinal);
            Assert.Contains("symbol_package_count", script, StringComparison.Ordinal);
            Assert.Contains("symbol_packages", script, StringComparison.Ordinal);
            Assert.Contains("SymbolsPackage", script, StringComparison.Ordinal);
            Assert.Contains("pdb_entries", script, StringComparison.Ordinal);
        }

        Assert.Contains("PACKAGE_VERSION_DEFAULT", bashScript, StringComparison.Ordinal);
        Assert.Contains("*.json", bashScript, StringComparison.Ordinal);
    }

    [Fact]
    public void BrowserPublishScriptsPublishOnlyAuditedBrandedPackages()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/publish-browser-nuget.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/publish-browser-nuget.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("uaix.browser.nuget.publish_plan.v0", script, StringComparison.Ordinal);
            Assert.Contains("uaix.browser.nuget.feed_audit.v0", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.Core.Abstractions", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.p2pLLM.Runtime", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.p2pRuntime.P2P", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.Memory", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.p2pLLM.Conversion", script, StringComparison.Ordinal);
            Assert.Contains("SHA256SUMS-UAIX.Browser", script, StringComparison.Ordinal);
            Assert.Contains("Publish set contains unexpected UAIX Browser package", script, StringComparison.Ordinal);
            Assert.Contains("Required UAIX Browser symbol package is missing from publish set", script, StringComparison.Ordinal);
            Assert.Contains("explicit_snupkg_push_after_primary_package", script, StringComparison.Ordinal);
            Assert.Contains("--no-symbols", script, StringComparison.Ordinal);
            Assert.Contains("--skip-duplicate", script, StringComparison.Ordinal);
            Assert.Contains("package_audit_match", script, StringComparison.Ordinal);
            Assert.Contains("package_hash_manifest_match", script, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", script, StringComparison.Ordinal);
            Assert.Contains("<redacted>", script, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void PublicDocSiteAuditScriptsCoverNuGetMirrorDocs()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/verify-public-doc-sites.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/verify-public-doc-sites.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.docs.public_site_audit.v0", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.com", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.MiRust.com", script, StringComparison.Ordinal);
            Assert.Contains("MiniModel.org", script, StringComparison.Ordinal);
            Assert.Contains("MiniModel.MiRust.com", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.Abstractions", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.Core", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.P2P", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.Memory", script, StringComparison.Ordinal);
            Assert.Contains(".snupkg", script, StringComparison.Ordinal);
            Assert.Contains("symbol package", script, StringComparison.Ordinal);
            Assert.Contains("SHA256SUMS", script, StringComparison.Ordinal);
            Assert.Contains("symbol_publish_mode", script, StringComparison.Ordinal);
            Assert.Contains("explicit_snupkg_push_after_primary_package", script, StringComparison.Ordinal);
            Assert.Contains("SymbolsPackage", script, StringComparison.Ordinal);
            Assert.Contains("PDB evidence", script, StringComparison.Ordinal);
            Assert.Contains("TINYRUSTLM_FEED_PACKAGE_IDS", script, StringComparison.Ordinal);
            Assert.Contains("UAIX_BROWSER_NUGET_MONITOR_VERIFY_CURRENT", script, StringComparison.Ordinal);
            Assert.Contains("uaix-browser-nuget-feed-current.json", script, StringComparison.Ordinal);
            Assert.Contains("publish-browser-nuget.ps1", script, StringComparison.Ordinal);
            Assert.Contains("uaix.browser.nuget.publish_plan.v0", script, StringComparison.Ordinal);
            Assert.Contains("uaix-browser-nuget-publish-plan.json", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm.ui_verification.v1", script, StringComparison.Ordinal);
            Assert.Contains("verify-tinyrustlm-ui.ps1", script, StringComparison.Ordinal);
            Assert.Contains("web-release-local-smoke.js", script, StringComparison.Ordinal);
            Assert.Contains("RunDeepAcquisition", script, StringComparison.Ordinal);
            Assert.Contains("model-acquisition.test.js", script, StringComparison.Ordinal);
            Assert.Contains("Local .slm", script, StringComparison.Ordinal);
            Assert.Contains("Hugging Face", script, StringComparison.Ordinal);
            Assert.Contains("Get model", script, StringComparison.Ordinal);
            Assert.Contains("Advanced tools", script, StringComparison.Ordinal);
            Assert.Contains("three_package_without_memory", script, StringComparison.Ordinal);
            Assert.Contains("stale_match_count", script, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", script, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void P2PPublicSdkExposesOnlyCanonicalFixedPieceAssembly()
    {
        var root = RepositoryRoot();
        var p2pRust = File.ReadAllText(Path.Combine(root, "rust/crates/tinyrustlm-p2p/src/lib.rs"));
        var nativeFfi = File.ReadAllText(Path.Combine(root, "rust/crates/tinyrustlm-native/src/ffi.rs"));
        var nativeMethods = File.ReadAllText(Path.Combine(root, "dotnet/src/TinyRustLM.Core/NativeMethods.cs"));
        var runtimeModels = File.ReadAllText(Path.Combine(root, "dotnet/src/TinyRustLM.Abstractions/RuntimeModels.cs"));
        var runtimeFactory = File.ReadAllText(Path.Combine(root, "dotnet/src/TinyRustLM.Core/TinyRustLmRuntimeFactory.cs"));
        var abstractions = File.ReadAllText(Path.Combine(root, "dotnet/src/TinyRustLM.Abstractions/P2PModels.cs"));
        var client = File.ReadAllText(Path.Combine(root, "dotnet/src/TinyRustLM.P2P/TinyRustLmP2PClient.cs"));
        var verifyConsumerPowerShell = File.ReadAllText(Path.Combine(root, "eng/verify-consumer.ps1"));
        var verifyConsumerBash = File.ReadAllText(Path.Combine(root, "eng/verify-consumer.sh"));
        var consumerSmoke = File.ReadAllText(Path.Combine(root, "eng/consumer-smoke/Program.cs"));
        var boundaryDoc = File.ReadAllText(Path.Combine(root, "docs/nuget/API_BOUNDARY.md"));

        var expectedSymbols = new[]
        {
            "tinyrustlm_native_contract_json",
            "tinyrustlm_string_free",
            "tinyrustlm_slm2_inspect_json",
            "tinyrustlm_runtime_create_json",
            "tinyrustlm_runtime_destroy_json",
            "tinyrustlm_runtime_state_json",
            "tinyrustlm_runtime_activate_json",
            "tinyrustlm_runtime_advance_operation_json",
            "tinyrustlm_runtime_set_transcript_json",
            "tinyrustlm_runtime_begin_request_json",
            "tinyrustlm_runtime_step_json",
            "tinyrustlm_runtime_finish_json",
            "tinyrustlm_p2p_prepare_share_kit_json",
            "tinyrustlm_p2p_inspect_manifest_json",
            "tinyrustlm_p2p_assemble_json"
        }.OrderBy(symbol => symbol, StringComparer.Ordinal).ToArray();
        var managedSymbols = Regex.Matches(
                nativeMethods,
                @"internal static extern \w+\s+(tinyrustlm_[a-z0-9_]+)\s*\(")
            .Select(match => match.Groups[1].Value)
            .OrderBy(symbol => symbol, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(expectedSymbols, managedSymbols);
        foreach (var symbol in expectedSymbols)
        {
            Assert.Contains(symbol, nativeFfi, StringComparison.Ordinal);
            Assert.Contains(symbol, boundaryDoc, StringComparison.Ordinal);
        }

        Assert.Contains("TinyRustLmNativeContract", runtimeModels, StringComparison.Ordinal);
        Assert.Contains("GetNativeContract()", runtimeFactory, StringComparison.Ordinal);
        Assert.Contains("CreateRuntime(", runtimeFactory, StringComparison.Ordinal);
        Assert.Contains("TinyRustLmOperationId", runtimeModels, StringComparison.Ordinal);
        Assert.Contains("ActivateComposition", runtimeModels, StringComparison.Ordinal);
        Assert.Contains("BeginRequest", runtimeModels, StringComparison.Ordinal);
        Assert.DoesNotContain("TinyRustLmSdkVersion", runtimeModels, StringComparison.Ordinal);
        Assert.DoesNotContain("TinySlm", runtimeModels, StringComparison.Ordinal);

        Assert.Contains("tinyrustlm.vnext.p2p_manifest.v1", p2pRust, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm.merkle.sha256-4mib.v1", p2pRust, StringComparison.Ordinal);
        Assert.Contains("prepare_share_kit", p2pRust, StringComparison.Ordinal);
        Assert.Contains("inspect_manifest", p2pRust, StringComparison.Ordinal);
        Assert.Contains("assemble_from_piece_directory", p2pRust, StringComparison.Ordinal);
        Assert.Contains("TinyRustLmP2PAdmission", abstractions, StringComparison.Ordinal);
        Assert.Contains("P2PManifest", abstractions, StringComparison.Ordinal);
        Assert.Contains("P2PShareKitReport", abstractions, StringComparison.Ordinal);
        Assert.Contains("P2PImportedArtifact", abstractions, StringComparison.Ordinal);
        Assert.Contains("PrepareShareKit", client, StringComparison.Ordinal);
        Assert.Contains("InspectManifest", client, StringComparison.Ordinal);
        Assert.Contains("AssembleArtifact", client, StringComparison.Ordinal);

        foreach (var obsoleteSurface in new[]
        {
            "SignedManifest",
            "LocalImportReceipt",
            "Announcement",
            "Catalog",
            "TinySlm",
            "acg1"
        })
        {
            Assert.DoesNotContain(obsoleteSurface, abstractions, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(obsoleteSurface, client, StringComparison.OrdinalIgnoreCase);
        }

        foreach (var script in new[] { verifyConsumerPowerShell, verifyConsumerBash })
        {
            Assert.Contains("eng/consumer-smoke/Program.cs", script, StringComparison.Ordinal);
            Assert.Contains("slm2-q8-weight-vectors.v1.json", script, StringComparison.Ordinal);
            Assert.Contains("acg2-format-vectors.v1.json", script, StringComparison.Ordinal);
            Assert.Contains("NUGET_PACKAGES", script, StringComparison.Ordinal);
            Assert.Contains("NUGET_HTTP_CACHE_PATH", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.Core", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.P2P", script, StringComparison.Ordinal);
            Assert.DoesNotContain("TinyRustLM.Memory", script, StringComparison.Ordinal);
            Assert.DoesNotContain("TinySlm", script, StringComparison.Ordinal);
        }

        foreach (var marker in new[]
        {
            "consumer-smoke-native-contract-15",
            "consumer-smoke-slm2-inspected",
            "consumer-smoke-acg2-assembled",
            "consumer-smoke-slm2-assembled",
            "consumer-smoke-create-only-rejected",
            "consumer-smoke-manifest-tamper-rejected"
        })
        {
            Assert.Contains(marker, consumerSmoke, StringComparison.Ordinal);
        }
        Assert.Contains("TinyRustLmSlm2Inspector", consumerSmoke, StringComparison.Ordinal);
        Assert.Contains("TinyRustLmRuntimeFactory", consumerSmoke, StringComparison.Ordinal);
        Assert.Contains("TinyRustLmP2PClient", consumerSmoke, StringComparison.Ordinal);
        Assert.Contains("TinyRustLmConversionTool", consumerSmoke, StringComparison.Ordinal);
        Assert.DoesNotContain("TinySlm", consumerSmoke, StringComparison.Ordinal);

        Assert.Contains("exactly these fifteen symbols", boundaryDoc, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("PrepareShareKit", boundaryDoc, StringComparison.Ordinal);
        Assert.Contains("InspectManifest", boundaryDoc, StringComparison.Ordinal);
        Assert.Contains("AssembleArtifact", boundaryDoc, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm.vnext.p2p_manifest.v1", boundaryDoc, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm.merkle.sha256-4mib.v1", boundaryDoc, StringComparison.Ordinal);
        Assert.Contains("There is no local `TinyRustLM.Memory` package", boundaryDoc, StringComparison.Ordinal);
        Assert.DoesNotContain("TinySlmInspector", boundaryDoc, StringComparison.Ordinal);
        Assert.DoesNotContain(".acg1", boundaryDoc, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void PublishScriptsWriteMachineReadablePlan()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/publish-nuget.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/publish-nuget.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.nuget.publish_plan.v0", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm-nuget-publish-plan.json", script, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", script, StringComparison.Ordinal);
            Assert.Contains("package_audit_match", script, StringComparison.Ordinal);
            Assert.Contains("package_hash_manifest_match", script, StringComparison.Ordinal);
            Assert.Contains("package_hash_manifest_sha256", script, StringComparison.Ordinal);
            Assert.Contains("blocked_missing_hash_manifest", script, StringComparison.Ordinal);
            Assert.Contains("blocked_hash_manifest_mismatch", script, StringComparison.Ordinal);
            Assert.Contains("SHA256SUMS-TinyRustLM", script, StringComparison.Ordinal);
            Assert.Contains("blocked_missing_audit_report", script, StringComparison.Ordinal);
            Assert.Contains("blocked_audit_mismatch", script, StringComparison.Ordinal);
            Assert.Contains("source_provenance_available", script, StringComparison.Ordinal);
            Assert.Contains("source_provenance", script, StringComparison.Ordinal);
            Assert.Contains("git_commit", script, StringComparison.Ordinal);
            Assert.Contains("git_tree_dirty", script, StringComparison.Ordinal);
            Assert.Contains("git_tracked_change_count", script, StringComparison.Ordinal);
            Assert.Contains("git_untracked_change_count", script, StringComparison.Ordinal);
            Assert.Contains("github_repository", script, StringComparison.Ordinal);
            Assert.Contains("push_failed", script, StringComparison.Ordinal);
            Assert.Contains("publish_error", script, StringComparison.Ordinal);
            Assert.Contains("<redacted>", script, StringComparison.Ordinal);
            Assert.Contains("sha256", script, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void FeedMonitorWorkflowRunsFreshnessGate()
    {
        var root = RepositoryRoot();
        var workflow = File.ReadAllText(Path.Combine(root, ".github/workflows/nuget-feed-monitor.yml"));

        Assert.Contains("schedule:", workflow, StringComparison.Ordinal);
        Assert.Contains("cron:", workflow, StringComparison.Ordinal);
        Assert.Contains("workflow_dispatch:", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_NUGET_MONITOR_ENABLED", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_NUGET_SOURCE", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_NUGET_MONITOR_ALLOW_NEWER", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_NUGET_MONITOR_VERIFY_CONSUMER", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_NUGET_MONITOR_VERIFY_HASHES", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_NUGET_MONITOR_PUBLISH_PLAN_REPORT", workflow, StringComparison.Ordinal);
        Assert.Contains("verify_browser_feed_current", workflow, StringComparison.Ordinal);
        Assert.Contains("browser_source", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX_BROWSER_NUGET_MONITOR_VERIFY_CURRENT", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX_BROWSER_NUGET_SOURCE", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX_BROWSER_PACKAGE_IDS", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX.Browser.Core.Abstractions", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX.Browser.p2pLLM.Runtime", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX.Browser.p2pRuntime.P2P", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX.Browser.Memory", workflow, StringComparison.Ordinal);
        Assert.Contains("UAIX.Browser.p2pLLM.Conversion", workflow, StringComparison.Ordinal);
        Assert.Contains("format('{0}', inputs.allow_newer)", workflow, StringComparison.Ordinal);
        Assert.Contains("format('{0}', inputs.verify_consumer)", workflow, StringComparison.Ordinal);
        Assert.Contains("format('{0}', inputs.verify_hashes)", workflow, StringComparison.Ordinal);
        Assert.Contains("format('{0}', inputs.verify_browser_feed_current)", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed-current.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed-package-hashes.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("FeedCurrentReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("FeedSmokeReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("FeedHashReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-current.json", workflow, StringComparison.Ordinal);
        Assert.Contains("uaix-browser-nuget-feed-current.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-hashes.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-smoke.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-monitor-report", workflow, StringComparison.Ordinal);
        Assert.Contains("uaix-browser-nuget-feed-current-report", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-hash-report", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-smoke-report", workflow, StringComparison.Ordinal);
        Assert.DoesNotContain("NUGET_API_KEY", workflow, StringComparison.Ordinal);
    }

    [Fact]
    public void FeedHashVerificationScriptsWriteMachineReadableReport()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/verify-feed-package-hashes.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/verify-feed-package-hashes.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.nuget.feed_hashes.v0", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm-nuget-feed-hashes.json", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm.nuget.publish_plan.v0", script, StringComparison.Ordinal);
            Assert.Contains("uaix.browser.nuget.publish_plan.v0", script, StringComparison.Ordinal);
            Assert.Contains("PackageBaseAddress/3.0.0", script, StringComparison.Ordinal);
            Assert.Contains(".signature.p7s", script, StringComparison.Ordinal);
            Assert.Contains("repository_signature_accepted", script, StringComparison.Ordinal);
            Assert.Contains("package_integrity_match", script, StringComparison.Ordinal);
            Assert.Contains("package_integrity_mismatch_count", script, StringComparison.Ordinal);
            Assert.Contains("publish_plan_schema", script, StringComparison.Ordinal);
            Assert.Contains("publish_plan_report_sha256", script, StringComparison.Ordinal);
            Assert.Contains("package_audit_report_sha256", script, StringComparison.Ordinal);
            Assert.Contains("package_hash_manifest_sha256", script, StringComparison.Ordinal);
            Assert.Contains("package_hash_manifest_match", script, StringComparison.Ordinal);
            Assert.Contains("Publish plan report is not bound to a passing package SHA-256 manifest", script, StringComparison.Ordinal);
            Assert.Contains("symbol_package_verification_mode", script, StringComparison.Ordinal);
            Assert.Contains("missing_symbol_package_count", script, StringComparison.Ordinal);
            Assert.Contains("symbol_hash_mismatch_count", script, StringComparison.Ordinal);
            Assert.Contains("symbol_byte_count_mismatch_count", script, StringComparison.Ordinal);
            Assert.Contains("symbol_packages", script, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", script, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void ReleaseReadinessScriptsWriteMachineReadableReport()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/audit-nuget-release-readiness.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/audit-nuget-release-readiness.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.nuget.release_readiness.v0", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm-nuget-release-readiness.json", script, StringComparison.Ordinal);
            Assert.Contains("publish_plan_dry_run", script, StringComparison.Ordinal);
            Assert.Contains("local_feed_current", script, StringComparison.Ordinal);
            Assert.Contains("local_feed_hashes", script, StringComparison.Ordinal);
            Assert.Contains("remote_feed_current", script, StringComparison.Ordinal);
            Assert.Contains("remote_feed_hashes", script, StringComparison.Ordinal);
            Assert.Contains("blocked_missing_api_key", script, StringComparison.Ordinal);
            Assert.Contains("blocked_trusted_publishing_unsupported", script, StringComparison.Ordinal);
            Assert.Contains("blocked_remote_hash_mismatch", script, StringComparison.Ordinal);
            Assert.Contains("VersionPrefix", script, StringComparison.Ordinal);
            Assert.Contains("ready_to_publish", script, StringComparison.Ordinal);
            Assert.Contains("published_current", script, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", script, StringComparison.Ordinal);
            Assert.Contains("auth_mode", script, StringComparison.Ordinal);
            Assert.Contains("api_key_present", script, StringComparison.Ordinal);
            Assert.Contains("trusted_publishing_requested", script, StringComparison.Ordinal);
            Assert.Contains("trusted_publishing_supported", script, StringComparison.Ordinal);
            Assert.Contains("publish_plan_package_count", script, StringComparison.Ordinal);
            Assert.Contains("publish_plan_symbol_package_count", script, StringComparison.Ordinal);
            Assert.Contains("symbol_publish_mode", script, StringComparison.Ordinal);
            Assert.Contains("package_hash_manifest_sha256", script, StringComparison.Ordinal);
            Assert.Contains("package_hash_manifest_match", script, StringComparison.Ordinal);
            Assert.Contains("local_feed_hash_symbol_package_count", script, StringComparison.Ordinal);
            Assert.Contains("local_feed_hash_symbol_verification_mode", script, StringComparison.Ordinal);
            Assert.Contains("local_feed_hash_symbol_mismatch_count", script, StringComparison.Ordinal);
            Assert.Contains("report_written", script, StringComparison.Ordinal);
        }

        Assert.Contains("Remove-Item -LiteralPath $ReportPath", powershellScript, StringComparison.Ordinal);
        Assert.Contains("Remove-Item -LiteralPath $RemoteFeedHashReport", powershellScript, StringComparison.Ordinal);
        Assert.Contains("rm -f -- \"$report_path\"", bashScript, StringComparison.Ordinal);
        Assert.Contains("rm -f -- \"$REMOTE_FEED_HASH_REPORT\"", bashScript, StringComparison.Ordinal);
    }

    [Fact]
    public void BrowserReleaseReadinessScriptsWriteMachineReadableReport()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/audit-browser-nuget-release-readiness.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/audit-browser-nuget-release-readiness.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("uaix.browser.nuget.release_readiness.v0", script, StringComparison.Ordinal);
            Assert.Contains("uaix-browser-nuget-release-readiness.json", script, StringComparison.Ordinal);
            Assert.Contains("uaix-browser-nuget-release-readiness-publish-plan-dry-run.json", script, StringComparison.Ordinal);
            Assert.Contains("uaix-browser-nuget-local-feed-current.json", script, StringComparison.Ordinal);
            Assert.Contains("uaix-browser-nuget-local-feed-hashes.json", script, StringComparison.Ordinal);
            Assert.Contains("uaix-browser-nuget-release-feed-current.json", script, StringComparison.Ordinal);
            Assert.Contains("uaix-browser-nuget-release-feed-hashes.json", script, StringComparison.Ordinal);
            Assert.Contains("publish_plan_dry_run", script, StringComparison.Ordinal);
            Assert.Contains("local_feed_current", script, StringComparison.Ordinal);
            Assert.Contains("local_feed_hashes", script, StringComparison.Ordinal);
            Assert.Contains("remote_feed_current", script, StringComparison.Ordinal);
            Assert.Contains("remote_feed_hashes", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.Core.Abstractions", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.p2pLLM.Runtime", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.p2pRuntime.P2P", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.Memory", script, StringComparison.Ordinal);
            Assert.Contains("UAIX.Browser.p2pLLM.Conversion", script, StringComparison.Ordinal);
            Assert.Contains("publish-browser-nuget", script, StringComparison.Ordinal);
            Assert.Contains("verify-feed-current", script, StringComparison.Ordinal);
            Assert.Contains("verify-feed-package-hashes", script, StringComparison.Ordinal);
            Assert.Contains("blocked_missing_api_key", script, StringComparison.Ordinal);
            Assert.Contains("blocked_trusted_publishing_unsupported", script, StringComparison.Ordinal);
            Assert.Contains("ready_to_publish", script, StringComparison.Ordinal);
            Assert.Contains("published_current", script, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", script, StringComparison.Ordinal);
            Assert.Contains("auth_mode", script, StringComparison.Ordinal);
            Assert.Contains("api_key_present", script, StringComparison.Ordinal);
            Assert.Contains("trusted_publishing_requested", script, StringComparison.Ordinal);
            Assert.Contains("trusted_publishing_supported", script, StringComparison.Ordinal);
            Assert.Contains("publish_plan_schema", script, StringComparison.Ordinal);
            Assert.Contains("publish_plan_package_count", script, StringComparison.Ordinal);
            Assert.Contains("publish_plan_symbol_package_count", script, StringComparison.Ordinal);
            Assert.Contains("symbol_publish_mode", script, StringComparison.Ordinal);
            Assert.Contains("package_hash_manifest_sha256", script, StringComparison.Ordinal);
            Assert.Contains("package_hash_manifest_match", script, StringComparison.Ordinal);
            Assert.Contains("local_feed_hash_symbol_package_count", script, StringComparison.Ordinal);
            Assert.Contains("local_feed_hash_symbol_verification_mode", script, StringComparison.Ordinal);
            Assert.Contains("local_feed_hash_symbol_mismatch_count", script, StringComparison.Ordinal);
            Assert.Contains("report_written", script, StringComparison.Ordinal);
        }

        Assert.Contains("Remove-Item -LiteralPath $ReportPath", powershellScript, StringComparison.Ordinal);
        Assert.Contains("Remove-Item -LiteralPath $RemoteFeedHashReport", powershellScript, StringComparison.Ordinal);
        Assert.Contains("rm -f -- \"$report_path\"", bashScript, StringComparison.Ordinal);
        Assert.Contains("rm -f -- \"$REMOTE_FEED_HASH_REPORT\"", bashScript, StringComparison.Ordinal);
    }

    [Fact]
    public void FeedVerificationScriptsWriteMachineReadableSmokeReport()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/verify-feed.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/verify-feed.sh"));
        var bashConsumerScript = File.ReadAllText(Path.Combine(root, "eng/verify-consumer.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.nuget.feed_smoke.v0", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm-nuget-feed-smoke.json", script, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", script, StringComparison.Ordinal);
            Assert.Contains("local_piece_assembly_verified", script, StringComparison.Ordinal);
            Assert.Contains("consumer_output_sha256", script, StringComparison.Ordinal);
            Assert.Contains("consumer_output_excerpt", script, StringComparison.Ordinal);
        }

        Assert.Contains("dotnet CLI is required", bashConsumerScript, StringComparison.Ordinal);
        Assert.Contains("NUGET_HTTP_CACHE_PATH", File.ReadAllText(Path.Combine(root, "eng/verify-consumer.ps1")), StringComparison.Ordinal);
        Assert.Contains("NUGET_HTTP_CACHE_PATH", bashConsumerScript, StringComparison.Ordinal);
        Assert.Contains("consumer_output", bashScript, StringComparison.Ordinal);
        Assert.Contains("error_message", bashScript, StringComparison.Ordinal);
    }

    [Fact]
    public void CorePackageProjectDeclaresSupportedNativeAssets()
    {
        var root = RepositoryRoot();
        var coreProject = File.ReadAllText(Path.Combine(
            root,
            "dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj"));

        var requiredEntries = new[]
        {
            "runtimes\\win-x64\\native\\",
            "runtimes\\linux-x64\\native\\",
            "runtimes\\osx-x64\\native\\",
            "runtimes\\osx-arm64\\native\\"
        };

        foreach (var entry in requiredEntries)
        {
            Assert.Contains(entry, coreProject, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void BuiltPackagesDoNotContainPrivateAuthoringCratesWhenPresent()
    {
        var packagesDir = Environment.GetEnvironmentVariable("TINYRUSTLM_PACKAGE_DIR");
        if (string.IsNullOrWhiteSpace(packagesDir) || !Directory.Exists(packagesDir))
        {
            return;
        }

        foreach (var package in Directory.EnumerateFiles(packagesDir, "TinyRustLM*.nupkg"))
        {
            using var zip = ZipFile.OpenRead(package);
            var entries = zip.Entries.Select(entry => entry.FullName).ToArray();
            Assert.DoesNotContain(entries, entry =>
                entry.Contains("slm_pack", StringComparison.OrdinalIgnoreCase)
                || entry.Contains("selector", StringComparison.OrdinalIgnoreCase)
                || entry.Contains("adapter_family", StringComparison.OrdinalIgnoreCase)
                || entry.Contains("trained_source", StringComparison.OrdinalIgnoreCase));
        }
    }

    [Fact]
    public void BuiltPackagesExposeOnlyApprovedBinaryPublicSurfaceWhenPresent()
    {
        var packagesDir = Environment.GetEnvironmentVariable("TINYRUSTLM_PACKAGE_DIR");
        if (string.IsNullOrWhiteSpace(packagesDir) || !Directory.Exists(packagesDir))
        {
            return;
        }

        var packagePaths = Directory.EnumerateFiles(packagesDir, "TinyRustLM*.nupkg")
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToArray();
        if (packagePaths.Length == 0)
        {
            return;
        }

        var extractionRoot = Path.Combine(
            Path.GetTempPath(),
            $"tinyrustlm-binary-surface-{Guid.NewGuid():N}");
        Directory.CreateDirectory(extractionRoot);
        try
        {
            var assemblyPaths = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var packagePath in packagePaths)
            {
                var packageRoot = Path.Combine(
                    extractionRoot,
                    Path.GetFileNameWithoutExtension(packagePath));
                ZipFile.ExtractToDirectory(packagePath, packageRoot);
                foreach (var assemblyPath in Directory.EnumerateFiles(
                    Path.Combine(packageRoot, "lib", "net8.0"),
                    "TinyRustLM*.dll"))
                {
                    assemblyPaths[Path.GetFileNameWithoutExtension(assemblyPath)] = assemblyPath;
                }
            }

            var loadContext = new PackageAssemblyLoadContext(assemblyPaths);
            try
            {
                var expectedPackageIds = new List<string>
                {
                    "TinyRustLM.Abstractions",
                    "TinyRustLM.Core",
                    "TinyRustLM.P2P",
                    "TinyRustLM.Memory"
                };
                if (assemblyPaths.ContainsKey("TinyRustLM.MemoryEndpoints"))
                {
                    expectedPackageIds.Add("TinyRustLM.MemoryEndpoints");
                }

                foreach (var packageId in expectedPackageIds)
                {
                    Assert.True(assemblyPaths.TryGetValue(packageId, out var assemblyPath), packageId);
                    var assembly = loadContext.LoadFromAssemblyPath(assemblyPath);
                    var actual = BinaryPublicSurfaceEntries(assembly);
                    var expected = ExpectedBinaryPublicSurfaceEntries(packageId);

                    Assert.True(
                        expected.SequenceEqual(actual, StringComparer.Ordinal),
                        $"{packageId} public API surface drifted.\nExpected:\n{string.Join('\n', expected)}\nActual:\n{string.Join('\n', actual)}");
                    Assert.DoesNotContain(actual, entry =>
                        entry.Contains("Conversion", StringComparison.OrdinalIgnoreCase)
                        || entry.Contains("QuantizationAuthoring", StringComparison.OrdinalIgnoreCase)
                        || entry.Contains("Adapter", StringComparison.OrdinalIgnoreCase)
                        || entry.Contains("Selector", StringComparison.OrdinalIgnoreCase)
                        || entry.Contains("Breeding", StringComparison.OrdinalIgnoreCase)
                        || entry.Contains("Telemetry", StringComparison.OrdinalIgnoreCase)
                        || entry.Contains("LicenseServer", StringComparison.OrdinalIgnoreCase));
                }
            }
            finally
            {
                loadContext.Unload();
                GC.Collect();
                GC.WaitForPendingFinalizers();
                GC.Collect();
            }
        }
        finally
        {
            TryDeleteDirectory(extractionRoot);
        }
    }

    [Fact]
    public void PackageAuditReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_PACKAGE_AUDIT_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var packageVersion = PackageVersion();

        Assert.Equal("tinyrustlm.nuget.package_audit.v1", root.GetProperty("schema").GetString());
        Assert.Equal("1980-01-01T00:00:00Z", root.GetProperty("canonical_entry_timestamp_utc").GetString());
        Assert.Equal("pass", root.GetProperty("status").GetString());
        Assert.Equal(packageVersion, root.GetProperty("package_version").GetString());
        var includesOptionalMemoryEndpoints = root.GetProperty("packages")
            .EnumerateArray()
            .Any(package => package.GetProperty("package_id").GetString() == "TinyRustLM.MemoryEndpoints");
        var expectedPackageCount = includesOptionalMemoryEndpoints ? 5 : 4;
        Assert.Equal(expectedPackageCount, root.GetProperty("package_count").GetInt32());
        Assert.Equal(expectedPackageCount, root.GetProperty("symbol_package_count").GetInt32());
        Assert.Equal(0, root.GetProperty("missing_package_count").GetInt32());
        Assert.Equal(0, root.GetProperty("unexpected_package_count").GetInt32());
        Assert.Equal(0, root.GetProperty("missing_symbol_package_count").GetInt32());
        Assert.Equal(0, root.GetProperty("unexpected_symbol_package_count").GetInt32());
        Assert.Equal(0, root.GetProperty("package_identity_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("symbol_package_identity_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("metadata_policy_violation_count").GetInt32());
        Assert.Empty(root.GetProperty("missing_package_entries").EnumerateArray());
        Assert.Empty(root.GetProperty("unexpected_package_entries").EnumerateArray());
        Assert.Empty(root.GetProperty("missing_symbol_package_entries").EnumerateArray());
        Assert.Empty(root.GetProperty("unexpected_symbol_package_entries").EnumerateArray());
        Assert.Empty(root.GetProperty("missing_native_rids").EnumerateArray());
        Assert.Empty(root.GetProperty("noncanonical_package_timestamp_entries").EnumerateArray());
        Assert.Empty(root.GetProperty("noncanonical_symbol_package_timestamp_entries").EnumerateArray());
        Assert.Equal(0, root.GetProperty("source_file_count").GetInt32());
        Assert.Equal(0, root.GetProperty("debug_symbol_count").GetInt32());
        Assert.Equal(0, root.GetProperty("generated_output_count").GetInt32());
        Assert.Equal(0, root.GetProperty("symbol_package_unexpected_entry_count").GetInt32());
        Assert.Equal(0, root.GetProperty("symbol_package_missing_pdb_count").GetInt32());
        Assert.Equal(0, root.GetProperty("symbol_package_source_file_count").GetInt32());
        Assert.Equal(0, root.GetProperty("symbol_package_generated_output_count").GetInt32());
        Assert.Equal(0, root.GetProperty("symbol_package_absolute_path_match_count").GetInt32());
        Assert.Equal(0, root.GetProperty("missing_search_term_count").GetInt32());
        Assert.Equal(0, root.GetProperty("missing_package_file_count").GetInt32());
        Assert.Equal(0, root.GetProperty("package_documentation_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("missing_dependency_count").GetInt32());
        Assert.Equal(0, root.GetProperty("unexpected_dependency_count").GetInt32());
        Assert.Equal(0, root.GetProperty("unexpected_native_entry_count").GetInt32());
        Assert.Equal(0, root.GetProperty("unexpected_package_content_entry_count").GetInt32());
        Assert.Equal(0, root.GetProperty("missing_public_api_entry_count").GetInt32());
        Assert.Equal(0, root.GetProperty("unexpected_public_api_entry_count").GetInt32());
        Assert.Equal(0, root.GetProperty("absolute_path_match_count").GetInt32());
        Assert.Equal(0, root.GetProperty("noncanonical_package_timestamp_entry_count").GetInt32());
        Assert.Equal(0, root.GetProperty("noncanonical_symbol_package_timestamp_entry_count").GetInt32());

        var expectedPackageNames = root.GetProperty("expected_package_names")
            .EnumerateArray()
            .Select(package => package.GetString())
            .ToArray();
        Assert.Equal(includesOptionalMemoryEndpoints ? 5 : 4, expectedPackageNames.Length);
        Assert.Contains($"TinyRustLM.Abstractions.{packageVersion}.nupkg", expectedPackageNames);
        Assert.Contains($"TinyRustLM.Core.{packageVersion}.nupkg", expectedPackageNames);
        Assert.Contains($"TinyRustLM.P2P.{packageVersion}.nupkg", expectedPackageNames);
        Assert.Contains($"TinyRustLM.Memory.{packageVersion}.nupkg", expectedPackageNames);
        if (includesOptionalMemoryEndpoints)
        {
            Assert.Contains($"TinyRustLM.MemoryEndpoints.{packageVersion}.nupkg", expectedPackageNames);
        }

        var expectedSymbolPackageNames = root.GetProperty("expected_symbol_package_names")
            .EnumerateArray()
            .Select(package => package.GetString())
            .ToArray();
        Assert.Equal(includesOptionalMemoryEndpoints ? 5 : 4, expectedSymbolPackageNames.Length);
        Assert.Contains($"TinyRustLM.Abstractions.{packageVersion}.snupkg", expectedSymbolPackageNames);
        Assert.Contains($"TinyRustLM.Core.{packageVersion}.snupkg", expectedSymbolPackageNames);
        Assert.Contains($"TinyRustLM.P2P.{packageVersion}.snupkg", expectedSymbolPackageNames);
        Assert.Contains($"TinyRustLM.Memory.{packageVersion}.snupkg", expectedSymbolPackageNames);
        if (includesOptionalMemoryEndpoints)
        {
            Assert.Contains($"TinyRustLM.MemoryEndpoints.{packageVersion}.snupkg", expectedSymbolPackageNames);
        }

        var packageNames = root.GetProperty("packages")
            .EnumerateArray()
            .Select(package => package.GetProperty("name").GetString())
            .ToArray();
        Assert.Equal(expectedPackageNames.OrderBy(name => name), packageNames.OrderBy(name => name));

        var symbolPackageNames = root.GetProperty("symbol_packages")
            .EnumerateArray()
            .Select(package => package.GetProperty("name").GetString())
            .ToArray();
        Assert.Equal(expectedSymbolPackageNames.OrderBy(name => name), symbolPackageNames.OrderBy(name => name));

        foreach (var package in root.GetProperty("packages").EnumerateArray())
        {
            AssertExpectedPackageIdentity(package, packageVersion);
            Assert.Empty(package.GetProperty("package_identity_mismatches").EnumerateArray());
            Assert.Matches("^[0-9a-f]{64}$", package.GetProperty("sha256").GetString() ?? "");
            Assert.True(package.GetProperty("byte_count").GetInt64() > 0);
            Assert.Empty(package.GetProperty("missing_metadata_fields").EnumerateArray());
            Assert.Empty(package.GetProperty("metadata_policy_violations").EnumerateArray());
            Assert.NotEmpty(package.GetProperty("required_search_terms").EnumerateArray());
            Assert.Empty(package.GetProperty("missing_search_terms").EnumerateArray());
            AssertSearchablePackageMetadata(package);
            Assert.Contains(package.GetProperty("declared_package_file_entries").EnumerateArray(), entry =>
                entry.GetString() == "README.md");
            Assert.Contains(package.GetProperty("declared_package_file_entries").EnumerateArray(), entry =>
                entry.GetString() == "LICENSE.txt");
            Assert.Empty(package.GetProperty("missing_package_file_entries").EnumerateArray());
            Assert.Contains(package.GetProperty("package_documentation_entries").EnumerateArray(), entry =>
                entry.GetString() == "README.md");
            Assert.Contains(package.GetProperty("package_documentation_entries").EnumerateArray(), entry =>
                entry.GetString() == "LICENSE.txt");
            AssertExpectedPackageDocumentation(package);
            Assert.Empty(package.GetProperty("package_documentation_mismatches").EnumerateArray());
            AssertExpectedPackageDependencies(package);
            AssertExpectedPackageContentEntries(package);
            AssertExpectedPublicApiEntries(package);
            AssertExpectedNativeEntries(package);
            Assert.Empty(package.GetProperty("missing_dependency_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("unexpected_dependency_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("unexpected_native_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("unexpected_package_content_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("missing_public_api_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("unexpected_public_api_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("missing_documentation_entries").EnumerateArray());
            Assert.NotEmpty(package.GetProperty("xml_documentation_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("private_surface_matches").EnumerateArray());
            Assert.Empty(package.GetProperty("source_file_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("debug_symbol_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("generated_output_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("absolute_path_matches").EnumerateArray());
            Assert.Empty(package.GetProperty("noncanonical_timestamp_entries").EnumerateArray());
            Assert.False(string.IsNullOrWhiteSpace(package.GetProperty("metadata").GetProperty("tags").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(package.GetProperty("metadata").GetProperty("release_notes").GetString()));
        }

        foreach (var symbolPackage in root.GetProperty("symbol_packages").EnumerateArray())
        {
            var symbolPackageName = symbolPackage.GetProperty("name").GetString();
            Assert.Contains(symbolPackageName, expectedSymbolPackageNames);
            Assert.Matches("^[0-9a-f]{64}$", symbolPackage.GetProperty("sha256").GetString() ?? "");
            Assert.True(symbolPackage.GetProperty("byte_count").GetInt64() > 0);
            Assert.True(symbolPackage.GetProperty("has_symbols_package_type").GetBoolean());
            Assert.NotEmpty(symbolPackage.GetProperty("pdb_entries").EnumerateArray());
            Assert.Empty(symbolPackage.GetProperty("package_identity_mismatches").EnumerateArray());
            Assert.Empty(symbolPackage.GetProperty("unexpected_symbol_package_entries").EnumerateArray());
            Assert.Empty(symbolPackage.GetProperty("source_file_entries").EnumerateArray());
            Assert.Empty(symbolPackage.GetProperty("generated_output_entries").EnumerateArray());
            Assert.Empty(symbolPackage.GetProperty("absolute_path_matches").EnumerateArray());
            Assert.Empty(symbolPackage.GetProperty("noncanonical_timestamp_entries").EnumerateArray());
        }
    }

    [Fact]
    public void FeedCurrentReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_FEED_CURRENT_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var packageVersion = PackageVersion();

        Assert.Equal("tinyrustlm.nuget.feed_current.v0", root.GetProperty("schema").GetString());
        Assert.Equal("pass", root.GetProperty("status").GetString());
        Assert.Equal(packageVersion, root.GetProperty("package_version").GetString());
        var expectedPackageIds = root.TryGetProperty("package_ids", out var packageIdsElement)
            ? packageIdsElement.EnumerateArray()
                .Select(packageId => packageId.GetString()!)
                .ToArray()
            : new[] { "TinyRustLM.Abstractions", "TinyRustLM.Core", "TinyRustLM.P2P", "TinyRustLM.Memory" };
        Assert.Equal(0, root.GetProperty("missing_declared_version_count").GetInt32());
        if (!root.GetProperty("allow_newer").GetBoolean())
        {
            Assert.Equal(0, root.GetProperty("not_latest_count").GetInt32());
        }

        var packageReports = root.GetProperty("packages").EnumerateArray().ToArray();
        Assert.Equal(expectedPackageIds.Length, packageReports.Length);
        if (root.TryGetProperty("package_count", out var packageCountElement))
        {
            Assert.Equal(expectedPackageIds.Length, packageCountElement.GetInt32());
        }
        foreach (var packageId in expectedPackageIds)
        {
            var report = Assert.Single(packageReports, package =>
                package.GetProperty("package_id").GetString() == packageId);
            Assert.True(report.GetProperty("declared_version_present").GetBoolean(), packageId);
            Assert.Equal(packageVersion, report.GetProperty("declared_version").GetString());
            Assert.Contains(report.GetProperty("listed_versions").EnumerateArray(), version =>
                string.Equals(version.GetString(), packageVersion, StringComparison.OrdinalIgnoreCase));
        }
    }

    [Fact]
    public void FeedHashReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_FEED_HASH_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var packageVersion = PackageVersion();
        var expectedTinyRustLmPackageIds = new[]
        {
            "TinyRustLM.Abstractions",
            "TinyRustLM.Core",
            "TinyRustLM.P2P",
            "TinyRustLM.Memory"
        };
        var expectedBrowserPackageIds = new[]
        {
            "UAIX.Browser.Core.Abstractions",
            "UAIX.Browser.p2pLLM.Runtime",
            "UAIX.Browser.p2pRuntime.P2P",
            "UAIX.Browser.Memory",
            "UAIX.Browser.p2pLLM.Conversion"
        };

        Assert.Equal("tinyrustlm.nuget.feed_hashes.v0", root.GetProperty("schema").GetString());
        Assert.Equal("pass", root.GetProperty("status").GetString());
        Assert.Equal(packageVersion, root.GetProperty("package_version").GetString());
        Assert.False(root.GetProperty("secret_material_included").GetBoolean());
        Assert.Equal(0, root.GetProperty("missing_package_count").GetInt32());
        Assert.Equal(0, root.GetProperty("hash_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("byte_count_mismatch_count").GetInt32());
        var symbolVerificationMode = root.GetProperty("symbol_package_verification_mode").GetString();
        Assert.Contains(symbolVerificationMode, new[]
        {
            "folder",
            "nuget_v3_package_feed_does_not_expose_snupkg_symbols"
        });
        Assert.Equal(0, root.GetProperty("missing_symbol_package_count").GetInt32());
        Assert.Equal(0, root.GetProperty("symbol_hash_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("symbol_byte_count_mismatch_count").GetInt32());
        Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("publish_plan_report_sha256").GetString() ?? "");
        Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("package_audit_report_sha256").GetString() ?? "");
        Assert.True(root.GetProperty("package_hash_manifest_match").GetBoolean());
        Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("package_hash_manifest_sha256").GetString() ?? "");

        var packages = root.GetProperty("packages").EnumerateArray().ToArray();
        var packageIds = packages.Select(package => package.GetProperty("package_id").GetString()).ToArray();
        var sortedPackageIds = packageIds.OrderBy(id => id, StringComparer.Ordinal).ToArray();
        var expectedPackageIds = sortedPackageIds.SequenceEqual(expectedTinyRustLmPackageIds.OrderBy(id => id, StringComparer.Ordinal))
            ? expectedTinyRustLmPackageIds
            : expectedBrowserPackageIds;

        Assert.Equal(
            expectedPackageIds.OrderBy(id => id, StringComparer.Ordinal),
            sortedPackageIds);
        Assert.Contains(root.GetProperty("publish_plan_schema").GetString(), new[]
        {
            "tinyrustlm.nuget.publish_plan.v0",
            "uaix.browser.nuget.publish_plan.v0"
        });
        Assert.Equal(expectedPackageIds.Length, root.GetProperty("package_count").GetInt32());
        Assert.Equal(expectedPackageIds.Length, packages.Length);
        Assert.Equal(expectedPackageIds.Length, root.GetProperty("symbol_package_expected_count").GetInt32());
        foreach (var package in packages)
        {
            Assert.True(package.GetProperty("present").GetBoolean());
            Assert.True(package.GetProperty("sha256_match").GetBoolean());
            Assert.True(package.GetProperty("byte_count_match").GetBoolean());
            Assert.Equal(
                package.GetProperty("expected_sha256").GetString(),
                package.GetProperty("actual_sha256").GetString());
            Assert.True(package.GetProperty("actual_byte_count").GetInt64() > 0);
            Assert.True(string.IsNullOrWhiteSpace(package.GetProperty("error_message").GetString()));
        }

        var symbolPackages = root.GetProperty("symbol_packages").EnumerateArray().ToArray();
        if (string.Equals(symbolVerificationMode, "folder", StringComparison.Ordinal))
        {
            Assert.Equal(expectedPackageIds.Length, root.GetProperty("symbol_package_count").GetInt32());
            Assert.Equal(expectedPackageIds.Length, symbolPackages.Length);
            foreach (var symbolPackage in symbolPackages)
            {
                Assert.EndsWith(".snupkg", symbolPackage.GetProperty("name").GetString(), StringComparison.Ordinal);
                Assert.True(symbolPackage.GetProperty("present").GetBoolean());
                Assert.True(symbolPackage.GetProperty("sha256_match").GetBoolean());
                Assert.True(symbolPackage.GetProperty("byte_count_match").GetBoolean());
                Assert.Equal(
                    symbolPackage.GetProperty("expected_sha256").GetString(),
                    symbolPackage.GetProperty("actual_sha256").GetString());
                Assert.True(symbolPackage.GetProperty("actual_byte_count").GetInt64() > 0);
                Assert.True(string.IsNullOrWhiteSpace(symbolPackage.GetProperty("error_message").GetString()));
            }
        }
        else
        {
            Assert.Equal(0, root.GetProperty("symbol_package_count").GetInt32());
            Assert.Empty(symbolPackages);
        }
    }

    [Fact]
    public void BrowserFeedAuditReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("UAIX_BROWSER_FEED_AUDIT_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var packageVersion = PackageVersion();
        var expectedPackageIds = new[]
        {
            "UAIX.Browser.Core.Abstractions",
            "UAIX.Browser.p2pLLM.Runtime",
            "UAIX.Browser.p2pRuntime.P2P",
            "UAIX.Browser.Memory",
            "UAIX.Browser.p2pLLM.Conversion"
        };

        Assert.Equal("uaix.browser.nuget.feed_audit.v0", root.GetProperty("schema").GetString());
        Assert.Equal("pass", root.GetProperty("status").GetString());
        Assert.Equal(packageVersion, root.GetProperty("package_version").GetString());
        Assert.Equal($"SHA256SUMS-UAIX.Browser-{packageVersion}.txt", root.GetProperty("hash_manifest_name").GetString());
        Assert.False(root.GetProperty("hash_manifest_missing").GetBoolean());
        Assert.Equal($"README-UAIX.Browser-{packageVersion}.txt", root.GetProperty("feed_readme_name").GetString());
        Assert.False(root.GetProperty("feed_readme_missing").GetBoolean());
        Assert.Equal(0, root.GetProperty("feed_readme_missing_term_count").GetInt32());
        Assert.Empty(root.GetProperty("feed_readme_missing_terms").EnumerateArray());
        Assert.Equal(0, root.GetProperty("missing_package_entries").GetArrayLength());
        Assert.Equal(0, root.GetProperty("unexpected_package_entries").GetArrayLength());
        Assert.Equal(0, root.GetProperty("missing_symbol_package_entries").GetArrayLength());
        Assert.Equal(0, root.GetProperty("unexpected_symbol_package_entries").GetArrayLength());
        Assert.Equal(0, root.GetProperty("hash_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("symbol_hash_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("identity_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("symbol_identity_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("unexpected_symbol_package_entry_count").GetInt32());
        Assert.Equal(0, root.GetProperty("metadata_policy_violation_count").GetInt32());
        Assert.Equal(0, root.GetProperty("missing_search_term_count").GetInt32());
        Assert.Equal(0, root.GetProperty("dependency_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("absolute_path_match_count").GetInt32());

        var packageReports = root.GetProperty("packages").EnumerateArray().ToArray();
        Assert.Equal(5, root.GetProperty("package_count").GetInt32());
        Assert.Equal(5, packageReports.Length);
        foreach (var packageId in expectedPackageIds)
        {
            var package = Assert.Single(packageReports, item =>
                item.GetProperty("package_id").GetString() == packageId);
            Assert.True(package.GetProperty("present").GetBoolean(), packageId);
            Assert.Equal($"{packageId}.{packageVersion}.nupkg", package.GetProperty("name").GetString());
            Assert.Matches("^[0-9a-f]{64}$", package.GetProperty("sha256").GetString() ?? "");
            Assert.True(package.GetProperty("byte_count").GetInt64() > 0);
            Assert.True(package.GetProperty("hash_manifest_match").GetBoolean());
            Assert.Empty(package.GetProperty("missing_search_terms").EnumerateArray());
            Assert.Empty(package.GetProperty("identity_mismatches").EnumerateArray());
            Assert.Empty(package.GetProperty("missing_metadata_fields").EnumerateArray());
            Assert.Empty(package.GetProperty("metadata_policy_violations").EnumerateArray());
            Assert.Empty(package.GetProperty("dependency_mismatches").EnumerateArray());
            Assert.Empty(package.GetProperty("absolute_path_matches").EnumerateArray());
        }

        var symbolPackageReports = root.GetProperty("symbol_packages").EnumerateArray().ToArray();
        Assert.Equal(5, root.GetProperty("symbol_package_count").GetInt32());
        Assert.Equal(5, symbolPackageReports.Length);
        foreach (var packageId in expectedPackageIds)
        {
            var symbolPackage = Assert.Single(symbolPackageReports, item =>
                item.GetProperty("package_id").GetString() == packageId);
            Assert.True(symbolPackage.GetProperty("present").GetBoolean(), packageId);
            Assert.Equal($"{packageId}.{packageVersion}.snupkg", symbolPackage.GetProperty("name").GetString());
            Assert.Matches("^[0-9a-f]{64}$", symbolPackage.GetProperty("sha256").GetString() ?? "");
            Assert.True(symbolPackage.GetProperty("byte_count").GetInt64() > 0);
            Assert.True(symbolPackage.GetProperty("hash_manifest_match").GetBoolean());
            Assert.True(symbolPackage.GetProperty("has_symbols_package_type").GetBoolean());
            Assert.NotEmpty(symbolPackage.GetProperty("pdb_entries").EnumerateArray());
            Assert.Empty(symbolPackage.GetProperty("identity_mismatches").EnumerateArray());
            Assert.Empty(symbolPackage.GetProperty("unexpected_symbol_package_entries").EnumerateArray());
        }
    }

    [Fact]
    public void BrowserPublishPlanReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("UAIX_BROWSER_PUBLISH_PLAN_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var packageVersion = PackageVersion();
        var expectedPackageIds = new[]
        {
            "UAIX.Browser.Core.Abstractions",
            "UAIX.Browser.p2pLLM.Runtime",
            "UAIX.Browser.p2pRuntime.P2P",
            "UAIX.Browser.Memory",
            "UAIX.Browser.p2pLLM.Conversion"
        };

        Assert.Equal("uaix.browser.nuget.publish_plan.v0", root.GetProperty("schema").GetString());
        var status = root.GetProperty("status").GetString();
        Assert.Contains(status, new[]
        {
            "dry_run",
            "ready_to_push",
            "pushed",
            "push_failed",
            "blocked_missing_api_key",
            "blocked_missing_audit_report",
            "blocked_audit_mismatch",
            "blocked_missing_hash_manifest",
            "blocked_hash_manifest_mismatch",
            "blocked_missing_feed_readme",
            "blocked_feed_readme_mismatch",
            "blocked_publish_set_mismatch"
        });
        Assert.Equal(packageVersion, root.GetProperty("package_version").GetString());
        Assert.False(root.GetProperty("secret_material_included").GetBoolean());
        Assert.Equal("explicit_snupkg_push_after_primary_package", root.GetProperty("symbol_publish_mode").GetString());
        Assert.Equal($"SHA256SUMS-UAIX.Browser-{packageVersion}.txt", root.GetProperty("package_hash_manifest_name").GetString());
        Assert.Equal($"README-UAIX.Browser-{packageVersion}.txt", root.GetProperty("feed_readme_name").GetString());
        Assert.True(root.TryGetProperty("source_provenance", out var sourceProvenance));
        Assert.DoesNotContain("NUGET_API_KEY", sourceProvenance.GetRawText(), StringComparison.OrdinalIgnoreCase);

        var auditMatch = root.GetProperty("package_audit_match").GetBoolean();
        var hashManifestMatch = root.GetProperty("package_hash_manifest_match").GetBoolean();
        var feedReadmeMatch = root.GetProperty("feed_readme_match").GetBoolean();
        var publishError = root.GetProperty("publish_error").GetString() ?? "";
        if (status is "dry_run" or "ready_to_push" or "pushed" or "blocked_missing_api_key" or "push_failed")
        {
            Assert.True(auditMatch);
            Assert.True(hashManifestMatch);
            Assert.True(feedReadmeMatch);
            Assert.Equal("uaix.browser.nuget.feed_audit.v0", root.GetProperty("package_audit_schema").GetString());
            Assert.Equal("pass", root.GetProperty("package_audit_status").GetString());
            Assert.Equal("pass", root.GetProperty("package_hash_manifest_status").GetString());
            Assert.Equal("pass", root.GetProperty("feed_readme_status").GetString());
            Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("package_audit_report_sha256").GetString() ?? "");
            Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("package_hash_manifest_sha256").GetString() ?? "");
            Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("feed_readme_sha256").GetString() ?? "");
            Assert.Equal(0, root.GetProperty("feed_readme_missing_term_count").GetInt32());
            if (status == "push_failed")
            {
                Assert.False(string.IsNullOrWhiteSpace(publishError));
                Assert.DoesNotContain("NUGET_API_KEY", publishError, StringComparison.OrdinalIgnoreCase);
            }
            else
            {
                Assert.True(string.IsNullOrWhiteSpace(publishError));
            }
        }
        else
        {
            Assert.True(!auditMatch || !hashManifestMatch || !feedReadmeMatch || status == "blocked_publish_set_mismatch");
        }

        var expectedIds = root.GetProperty("expected_package_ids")
            .EnumerateArray()
            .Select(item => item.GetString())
            .ToArray();
        Assert.Equal(
            expectedPackageIds.OrderBy(id => id, StringComparer.Ordinal),
            expectedIds.OrderBy(id => id, StringComparer.Ordinal));

        var expectedNames = root.GetProperty("expected_package_names")
            .EnumerateArray()
            .Select(name => name.GetString())
            .ToArray();
        var expectedSymbolNames = root.GetProperty("expected_symbol_package_names")
            .EnumerateArray()
            .Select(name => name.GetString())
            .ToArray();
        foreach (var packageId in expectedPackageIds)
        {
            Assert.Contains($"{packageId}.{packageVersion}.nupkg", expectedNames);
            Assert.Contains($"{packageId}.{packageVersion}.snupkg", expectedSymbolNames);
        }

        Assert.Equal(5, root.GetProperty("package_count").GetInt32());
        Assert.Equal(5, root.GetProperty("symbol_package_count").GetInt32());
        foreach (var package in root.GetProperty("packages").EnumerateArray())
        {
            Assert.Contains(package.GetProperty("package_id").GetString(), expectedPackageIds);
            Assert.Matches("^[0-9a-f]{64}$", package.GetProperty("sha256").GetString() ?? "");
            Assert.True(package.GetProperty("byte_count").GetInt64() > 0);
        }
        foreach (var package in root.GetProperty("symbol_packages").EnumerateArray())
        {
            Assert.Contains(package.GetProperty("package_id").GetString(), expectedPackageIds);
            Assert.Matches("^[0-9a-f]{64}$", package.GetProperty("sha256").GetString() ?? "");
            Assert.True(package.GetProperty("byte_count").GetInt64() > 0);
        }
    }

    [Fact]
    public void FeedSmokeReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_FEED_SMOKE_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var status = root.GetProperty("status").GetString();

        Assert.Equal("tinyrustlm.nuget.feed_smoke.v0", root.GetProperty("schema").GetString());
        Assert.Contains(status, new[] { "pass", "fail" });
        Assert.Equal(PackageVersion(), root.GetProperty("package_version").GetString());
        Assert.False(root.GetProperty("secret_material_included").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("nuget_source").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("model_path").GetString()));
        if (string.Equals(status, "pass", StringComparison.Ordinal))
        {
            Assert.True(string.IsNullOrWhiteSpace(root.GetProperty("error_message").GetString()));
            Assert.True(root.GetProperty("local_piece_assembly_verified").GetBoolean());
            Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("consumer_output_sha256").GetString() ?? "");
            Assert.Contains(
                "consumer-smoke-assembled.slm",
                root.GetProperty("consumer_output_excerpt").GetString() ?? "",
                StringComparison.Ordinal);
        }
        else
        {
            Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("error_message").GetString()));
        }
    }

    [Fact]
    public void PublicDocSiteAuditReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_PUBLIC_DOC_SITE_AUDIT_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;

        Assert.Equal("tinyrustlm.docs.public_site_audit.v0", root.GetProperty("schema").GetString());
        Assert.Equal("pass", root.GetProperty("status").GetString());
        Assert.False(root.GetProperty("secret_material_included").GetBoolean());
        Assert.Equal(0, root.GetProperty("missing_site_root_count").GetInt32());
        Assert.Equal(0, root.GetProperty("missing_file_count").GetInt32());
        Assert.Equal(0, root.GetProperty("failed_check_count").GetInt32());
        Assert.Equal(0, root.GetProperty("stale_match_count").GetInt32());

        var roots = root.GetProperty("site_roots").EnumerateArray().ToArray();
        Assert.Contains(roots, site =>
            (site.GetProperty("path").GetString() ?? "").Contains("TinyRustLM.com", StringComparison.OrdinalIgnoreCase)
            && site.GetProperty("exists").GetBoolean());
        Assert.Contains(roots, site =>
            (site.GetProperty("path").GetString() ?? "").Contains("MiniModel.MiRust.com", StringComparison.OrdinalIgnoreCase)
            && site.GetProperty("exists").GetBoolean());

        var checks = root.GetProperty("checks").EnumerateArray().ToArray();
        Assert.NotEmpty(checks);
        Assert.All(checks, check =>
        {
            Assert.True(check.GetProperty("exists").GetBoolean());
            Assert.Equal("pass", check.GetProperty("status").GetString());
            Assert.Empty(check.GetProperty("missing_terms").EnumerateArray());
            Assert.Matches("^[0-9a-f]{64}$", check.GetProperty("sha256").GetString() ?? "");
        });
    }

    [Fact]
    public void UiVerificationReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_UI_VERIFICATION_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var status = root.GetProperty("status").GetString();
        var browserSmokeRequested = root.GetProperty("browser_smoke_requested").GetBoolean();
        var deepAcquisitionRequested = root.GetProperty("deep_acquisition_requested").GetBoolean();
        var visualLockRequested = root.GetProperty("visual_lock_requested").GetBoolean();

        Assert.Equal("tinyrustlm.ui_verification.v1", root.GetProperty("schema").GetString());
        Assert.Contains(status, new[] { "pass", "fail" });
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("run_id").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("repository_root").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("app_root").GetString()));
        var gates = root.GetProperty("gates");
        var gateNames = new[]
        {
            "static_contract",
            "javascript_syntax",
            "browser_contracts",
            "chromium_release",
            "acquisition_browser_bridge",
            "acquisition_companion",
            "acquisition_converter",
            "visual_lock"
        };
        foreach (var gateName in gateNames)
        {
            Assert.Contains(
                gates.GetProperty(gateName).GetString(),
                new[] { "pass", "fail", "not_run", "skipped" });
        }
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("evidence").GetProperty("root").GetString()));

        if (string.Equals(status, "pass", StringComparison.Ordinal))
        {
            Assert.Equal("pass", gates.GetProperty("static_contract").GetString());
            Assert.Equal("pass", gates.GetProperty("javascript_syntax").GetString());
            Assert.True(string.IsNullOrWhiteSpace(root.GetProperty("error").GetString()));
            if (browserSmokeRequested)
            {
                Assert.Equal("pass", gates.GetProperty("browser_contracts").GetString());
                Assert.Equal("pass", gates.GetProperty("chromium_release").GetString());
            }
            else
            {
                Assert.Equal("skipped", gates.GetProperty("browser_contracts").GetString());
                Assert.Equal("skipped", gates.GetProperty("chromium_release").GetString());
            }
            if (deepAcquisitionRequested)
            {
                Assert.Equal("pass", gates.GetProperty("acquisition_browser_bridge").GetString());
                Assert.Equal("pass", gates.GetProperty("acquisition_companion").GetString());
                Assert.Equal("pass", gates.GetProperty("acquisition_converter").GetString());
            }
            if (visualLockRequested)
            {
                Assert.Equal("pass", gates.GetProperty("visual_lock").GetString());
            }
        }
        else
        {
            Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("error").GetString()));
        }
    }

    [Fact]
    public void PublicRootVerificationReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_PUBLIC_ROOT_VERIFICATION_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var status = root.GetProperty("status").GetString();

        Assert.Equal("tinyrustlm.public_root_verification.v1", root.GetProperty("schema").GetString());
        Assert.Contains(status, new[] { "pass", "fail" });
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("run_id").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("repository_root").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("app_root").GetString()));
        var childReport = root.GetProperty("ui_verification_report").GetString() ?? "";
        Assert.False(string.IsNullOrWhiteSpace(childReport));

        if (string.Equals(status, "pass", StringComparison.Ordinal))
        {
            Assert.True(string.IsNullOrWhiteSpace(root.GetProperty("error").GetString()));
            Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("ui_verification_sha256").GetString() ?? "");
            Assert.True(File.Exists(childReport));
        }
        else
        {
            Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("error").GetString()));
        }
    }

    [Fact]
    public void PublishPlanReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_PUBLISH_PLAN_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var packageVersion = PackageVersion();

        Assert.Equal("tinyrustlm.nuget.publish_plan.v0", root.GetProperty("schema").GetString());
        var status = root.GetProperty("status").GetString();
        Assert.Contains(status, new[]
        {
            "dry_run",
            "ready_to_push",
            "pushed",
            "push_failed",
            "blocked_missing_api_key",
            "blocked_missing_audit_report",
            "blocked_audit_mismatch",
            "blocked_missing_hash_manifest",
            "blocked_hash_manifest_mismatch"
        });
        Assert.Equal(packageVersion, root.GetProperty("package_version").GetString());
        Assert.False(root.GetProperty("secret_material_included").GetBoolean());
        Assert.True(root.TryGetProperty("source_provenance_available", out var sourceProvenanceAvailable));
        Assert.True(root.TryGetProperty("source_provenance", out var sourceProvenance));
        Assert.Equal(
            sourceProvenanceAvailable.GetBoolean(),
            sourceProvenance.GetProperty("source_provenance_available").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(sourceProvenance.GetProperty("repository_root").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(sourceProvenance.GetProperty("git_repository_root").GetString()));
        Assert.True(sourceProvenance.TryGetProperty("git_commit", out var gitCommit));
        if (sourceProvenanceAvailable.GetBoolean())
        {
            Assert.Matches("^[0-9a-fA-F]{40}$", gitCommit.GetString() ?? "");
        }
        Assert.True(sourceProvenance.TryGetProperty("git_branch", out _));
        Assert.True(sourceProvenance.TryGetProperty("git_tree_dirty", out var gitTreeDirty));
        Assert.Contains(gitTreeDirty.ValueKind, new[] { JsonValueKind.False, JsonValueKind.True });
        Assert.True(sourceProvenance.GetProperty("git_tracked_change_count").GetInt32() >= 0);
        Assert.True(sourceProvenance.GetProperty("git_untracked_change_count").GetInt32() >= 0);
        Assert.Contains(
            sourceProvenance.GetProperty("ci_provider").GetString(),
            new[] { "local", "ci", "github_actions" });
        Assert.True(sourceProvenance.TryGetProperty("github_repository", out _));
        Assert.True(sourceProvenance.TryGetProperty("github_ref", out _));
        Assert.True(sourceProvenance.TryGetProperty("github_sha", out _));
        Assert.True(sourceProvenance.TryGetProperty("github_run_id", out _));
        Assert.True(sourceProvenance.TryGetProperty("github_workflow", out _));
        var sourceProvenanceJson = sourceProvenance.GetRawText();
        Assert.DoesNotContain("NUGET_API_KEY", sourceProvenanceJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("API_KEY", sourceProvenanceJson, StringComparison.OrdinalIgnoreCase);
        Assert.True(root.TryGetProperty("package_audit_match", out var auditMatch));
        Assert.True(root.TryGetProperty("package_audit_status", out var auditStatus));
        Assert.True(root.TryGetProperty("package_audit_error", out var auditError));
        Assert.True(root.TryGetProperty("package_hash_manifest_match", out var hashManifestMatch));
        Assert.True(root.TryGetProperty("package_hash_manifest_status", out var hashManifestStatus));
        Assert.True(root.TryGetProperty("package_hash_manifest_error", out var hashManifestError));
        Assert.True(root.TryGetProperty("publish_error", out var publishError));
        if (status is "dry_run" or "ready_to_push" or "pushed" or "blocked_missing_api_key" or "push_failed")
        {
            Assert.True(auditMatch.GetBoolean());
            Assert.Equal("pass", auditStatus.GetString());
            Assert.True(string.IsNullOrWhiteSpace(auditError.GetString()));
            Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("package_audit_report_sha256").GetString() ?? "");
            Assert.True(hashManifestMatch.GetBoolean());
            Assert.Equal("pass", hashManifestStatus.GetString());
            Assert.True(string.IsNullOrWhiteSpace(hashManifestError.GetString()));
            Assert.Equal($"SHA256SUMS-TinyRustLM-{packageVersion}.txt", root.GetProperty("package_hash_manifest_name").GetString());
            Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("package_hash_manifest_sha256").GetString() ?? "");
            if (status == "push_failed")
            {
                Assert.False(string.IsNullOrWhiteSpace(publishError.GetString()));
                Assert.DoesNotContain("NUGET_API_KEY", publishError.GetString() ?? "", StringComparison.OrdinalIgnoreCase);
            }
            else
            {
                Assert.True(string.IsNullOrWhiteSpace(publishError.GetString()));
            }
        }
        else
        {
            Assert.True(
                !auditMatch.GetBoolean() || !hashManifestMatch.GetBoolean(),
                "Blocked publish-plan statuses must be explained by audit or SHA256SUMS manifest evidence.");
            Assert.True(
                !string.IsNullOrWhiteSpace(auditError.GetString()) || !string.IsNullOrWhiteSpace(hashManifestError.GetString()),
                "Blocked publish-plan statuses must include an audit or SHA256SUMS manifest error.");
            Assert.True(string.IsNullOrWhiteSpace(publishError.GetString()));
        }

        var expectedNames = root.GetProperty("expected_package_names")
            .EnumerateArray()
            .Select(name => name.GetString())
            .ToArray();
        Assert.Contains($"TinyRustLM.Abstractions.{packageVersion}.nupkg", expectedNames);
        Assert.Contains($"TinyRustLM.Core.{packageVersion}.nupkg", expectedNames);
        Assert.Contains($"TinyRustLM.P2P.{packageVersion}.nupkg", expectedNames);
        Assert.Contains($"TinyRustLM.Memory.{packageVersion}.nupkg", expectedNames);

        var expectedSymbolNames = root.GetProperty("expected_symbol_package_names")
            .EnumerateArray()
            .Select(name => name.GetString())
            .ToArray();
        Assert.Contains($"TinyRustLM.Abstractions.{packageVersion}.snupkg", expectedSymbolNames);
        Assert.Contains($"TinyRustLM.Core.{packageVersion}.snupkg", expectedSymbolNames);
        Assert.Contains($"TinyRustLM.P2P.{packageVersion}.snupkg", expectedSymbolNames);
        Assert.Contains($"TinyRustLM.Memory.{packageVersion}.snupkg", expectedSymbolNames);
        Assert.Equal("explicit_snupkg_push_after_primary_package", root.GetProperty("symbol_publish_mode").GetString());

        var packages = root.GetProperty("packages").EnumerateArray().ToArray();
        Assert.Equal(4, root.GetProperty("package_count").GetInt32());
        Assert.Equal(4, packages.Length);
        foreach (var package in packages)
        {
            Assert.Matches("^[0-9a-f]{64}$", package.GetProperty("sha256").GetString() ?? "");
            Assert.True(package.GetProperty("byte_count").GetInt64() > 0);
            Assert.Contains(package.GetProperty("name").GetString(), expectedNames);
        }

        var symbolPackages = root.GetProperty("symbol_packages").EnumerateArray().ToArray();
        Assert.Equal(4, root.GetProperty("symbol_package_count").GetInt32());
        Assert.Equal(4, symbolPackages.Length);
        foreach (var package in symbolPackages)
        {
            Assert.Matches("^[0-9a-f]{64}$", package.GetProperty("sha256").GetString() ?? "");
            Assert.True(package.GetProperty("byte_count").GetInt64() > 0);
            Assert.Contains(package.GetProperty("name").GetString(), expectedSymbolNames);
        }
    }

    [Fact]
    public void ReleaseReadinessReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_RELEASE_READINESS_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var packageVersion = PackageVersion();
        var status = root.GetProperty("status").GetString();

        Assert.Equal("tinyrustlm.nuget.release_readiness.v0", root.GetProperty("schema").GetString());
        Assert.Contains(status, new[]
        {
            "blocked_local_verification",
            "blocked_feed_status_unknown",
            "blocked_missing_api_key",
            "blocked_remote_hash_mismatch",
            "blocked_trusted_publishing_unsupported",
            "ready_to_publish",
            "published_current"
        });
        Assert.Equal(packageVersion, root.GetProperty("package_version").GetString());
        Assert.False(root.GetProperty("secret_material_included").GetBoolean());
        Assert.Contains(root.GetProperty("auth_mode").GetString(), new[] { "api_key", "trusted_publishing" });
        Assert.True(root.TryGetProperty("api_key_present", out _));
        Assert.True(root.TryGetProperty("trusted_publishing_requested", out _));
        Assert.True(root.TryGetProperty("trusted_publishing_supported", out _));
        Assert.True(root.TryGetProperty("fail_on_blocked", out _));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("package_source").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("nuget_source").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("publish_plan_report_path").GetString()));
        Assert.Equal("dry_run", root.GetProperty("publish_plan_status").GetString());
        Assert.Equal(4, root.GetProperty("publish_plan_package_count").GetInt32());
        Assert.Equal(4, root.GetProperty("publish_plan_symbol_package_count").GetInt32());
        Assert.Equal("explicit_snupkg_push_after_primary_package", root.GetProperty("symbol_publish_mode").GetString());
        Assert.Equal($"SHA256SUMS-TinyRustLM-{packageVersion}.txt", root.GetProperty("package_hash_manifest_name").GetString());
        Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("package_hash_manifest_sha256").GetString() ?? "");
        Assert.True(root.GetProperty("package_hash_manifest_match").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("local_feed_current_report_path").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("local_feed_hash_report_path").GetString()));
        Assert.Equal("pass", root.GetProperty("local_feed_hash_status").GetString());
        Assert.Equal(4, root.GetProperty("local_feed_hash_package_count").GetInt32());
        Assert.Equal(4, root.GetProperty("local_feed_hash_symbol_package_count").GetInt32());
        Assert.Equal("folder", root.GetProperty("local_feed_hash_symbol_verification_mode").GetString());
        Assert.Equal(0, root.GetProperty("local_feed_hash_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("local_feed_hash_symbol_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("local_feed_hash_symbol_byte_count_mismatch_count").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("remote_feed_current_report_path").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("remote_feed_hash_report_path").GetString()));

        var steps = root.GetProperty("steps").EnumerateArray().ToArray();
        Assert.Equal(5, steps.Length);
        foreach (var stepName in new[]
        {
            "publish_plan_dry_run",
            "local_feed_current",
            "local_feed_hashes",
            "remote_feed_current",
            "remote_feed_hashes"
        })
        {
            var step = Assert.Single(steps, item => item.GetProperty("name").GetString() == stepName);
            Assert.Contains(step.GetProperty("status").GetString(), new[] { "pass", "fail", "skipped" });
            Assert.True(step.TryGetProperty("report_written", out _));
            Assert.True(step.TryGetProperty("report_status", out _));
            Assert.True(step.TryGetProperty("error_message", out _));
        }

        var blockers = root.GetProperty("blockers").EnumerateArray().ToArray();
        if (status is "ready_to_publish" or "published_current")
        {
            Assert.Empty(blockers);
        }
        else
        {
            Assert.NotEmpty(blockers);
        }
    }

    [Fact]
    public void BrowserReleaseReadinessReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("UAIX_BROWSER_RELEASE_READINESS_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var packageVersion = PackageVersion();
        var status = root.GetProperty("status").GetString();
        var expectedPackageIds = new[]
        {
            "UAIX.Browser.Core.Abstractions",
            "UAIX.Browser.p2pLLM.Runtime",
            "UAIX.Browser.p2pRuntime.P2P",
            "UAIX.Browser.Memory",
            "UAIX.Browser.p2pLLM.Conversion"
        };

        Assert.Equal("uaix.browser.nuget.release_readiness.v0", root.GetProperty("schema").GetString());
        Assert.Contains(status, new[]
        {
            "blocked_local_verification",
            "blocked_feed_status_unknown",
            "blocked_missing_api_key",
            "blocked_remote_hash_mismatch",
            "blocked_trusted_publishing_unsupported",
            "ready_to_publish",
            "published_current"
        });
        Assert.Equal(packageVersion, root.GetProperty("package_version").GetString());
        Assert.False(root.GetProperty("secret_material_included").GetBoolean());
        Assert.Contains(root.GetProperty("auth_mode").GetString(), new[] { "api_key", "trusted_publishing" });
        Assert.True(root.TryGetProperty("api_key_present", out _));
        Assert.True(root.TryGetProperty("trusted_publishing_requested", out _));
        Assert.True(root.TryGetProperty("trusted_publishing_supported", out _));
        Assert.True(root.TryGetProperty("fail_on_blocked", out _));
        Assert.Equal(5, root.GetProperty("package_id_count").GetInt32());
        var packageIds = root.GetProperty("package_ids").EnumerateArray().Select(item => item.GetString()).ToArray();
        Assert.Equal(
            expectedPackageIds.OrderBy(id => id, StringComparer.Ordinal),
            packageIds.OrderBy(id => id, StringComparer.Ordinal));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("package_source").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("nuget_source").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("publish_plan_report_path").GetString()));
        Assert.Equal("uaix.browser.nuget.publish_plan.v0", root.GetProperty("publish_plan_schema").GetString());
        Assert.Equal("dry_run", root.GetProperty("publish_plan_status").GetString());
        Assert.Equal(5, root.GetProperty("publish_plan_package_count").GetInt32());
        Assert.Equal(5, root.GetProperty("publish_plan_symbol_package_count").GetInt32());
        Assert.Equal("explicit_snupkg_push_after_primary_package", root.GetProperty("symbol_publish_mode").GetString());
        Assert.Equal($"SHA256SUMS-UAIX.Browser-{packageVersion}.txt", root.GetProperty("package_hash_manifest_name").GetString());
        Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("package_hash_manifest_sha256").GetString() ?? "");
        Assert.True(root.GetProperty("package_hash_manifest_match").GetBoolean());
        Assert.Equal($"README-UAIX.Browser-{packageVersion}.txt", root.GetProperty("feed_readme_name").GetString());
        Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("feed_readme_sha256").GetString() ?? "");
        Assert.Equal("pass", root.GetProperty("feed_readme_status").GetString());
        Assert.True(root.GetProperty("feed_readme_match").GetBoolean());
        Assert.Equal(0, root.GetProperty("feed_readme_missing_term_count").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("local_feed_current_report_path").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("local_feed_hash_report_path").GetString()));
        Assert.Equal("pass", root.GetProperty("local_feed_hash_status").GetString());
        Assert.Equal(5, root.GetProperty("local_feed_hash_package_count").GetInt32());
        Assert.Equal(5, root.GetProperty("local_feed_hash_symbol_package_count").GetInt32());
        Assert.Equal("folder", root.GetProperty("local_feed_hash_symbol_verification_mode").GetString());
        Assert.Equal(0, root.GetProperty("local_feed_hash_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("local_feed_hash_symbol_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("local_feed_hash_symbol_byte_count_mismatch_count").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("remote_feed_current_report_path").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("remote_feed_hash_report_path").GetString()));

        var steps = root.GetProperty("steps").EnumerateArray().ToArray();
        Assert.Equal(5, steps.Length);
        foreach (var stepName in new[]
        {
            "publish_plan_dry_run",
            "local_feed_current",
            "local_feed_hashes",
            "remote_feed_current",
            "remote_feed_hashes"
        })
        {
            var step = Assert.Single(steps, item => item.GetProperty("name").GetString() == stepName);
            Assert.Contains(step.GetProperty("status").GetString(), new[] { "pass", "fail", "skipped" });
            Assert.True(step.TryGetProperty("report_written", out _));
            Assert.True(step.TryGetProperty("report_status", out _));
            Assert.True(step.TryGetProperty("error_message", out _));
        }

        var blockers = root.GetProperty("blockers").EnumerateArray().ToArray();
        if (status is "ready_to_publish" or "published_current")
        {
            Assert.Empty(blockers);
        }
        else
        {
            Assert.NotEmpty(blockers);
        }
    }

    private static string RepositoryRoot()
    {
        var configured = Environment.GetEnvironmentVariable("TINYRUSTLM_REPO_ROOT");
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured;
        }

        var current = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < 10 && current is not null; i++, current = current.Parent)
        {
            if (File.Exists(Path.Combine(current.FullName, "Cargo.toml"))
                && Directory.Exists(Path.Combine(current.FullName, "dotnet")))
            {
                return current.FullName;
            }
        }

        throw new DirectoryNotFoundException("Could not locate TinyRustLM repository root.");
    }

    private static string PackageVersion()
    {
        var root = RepositoryRoot();
        var props = File.ReadAllText(Path.Combine(root, "dotnet/Directory.Build.props"));
        var version = ExtractProperty(props, "Version");
        if (!string.IsNullOrWhiteSpace(version))
        {
            return version;
        }

        var prefix = ExtractProperty(props, "VersionPrefix");
        Assert.False(string.IsNullOrWhiteSpace(prefix), "VersionPrefix is required.");
        var suffix = ExtractProperty(props, "VersionSuffix");
        return string.IsNullOrWhiteSpace(suffix) ? prefix : $"{prefix}-{suffix}";
    }

    private static string WorkspacePackageVersion(string cargoToml)
    {
        var inWorkspacePackage = false;
        foreach (var rawLine in cargoToml.Split('\n'))
        {
            var line = rawLine.Trim();
            if (line.StartsWith('['))
            {
                inWorkspacePackage = string.Equals(line, "[workspace.package]", StringComparison.Ordinal);
                continue;
            }
            if (!inWorkspacePackage || !line.StartsWith("version", StringComparison.Ordinal))
            {
                continue;
            }

            var equalsIndex = line.IndexOf('=', StringComparison.Ordinal);
            if (equalsIndex < 0)
            {
                continue;
            }
            return line[(equalsIndex + 1)..].Trim().Trim('"');
        }

        return string.Empty;
    }

    private static string ExtractProperty(string xml, string propertyName)
    {
        var startTag = $"<{propertyName}>";
        var endTag = $"</{propertyName}>";
        var start = xml.IndexOf(startTag, StringComparison.Ordinal);
        if (start < 0)
        {
            return string.Empty;
        }

        start += startTag.Length;
        var end = xml.IndexOf(endTag, start, StringComparison.Ordinal);
        return end < 0 ? string.Empty : xml[start..end].Trim();
    }

    private static string[] BinaryPublicSurfaceEntries(Assembly assembly)
    {
        var generatedRecordMethods = new HashSet<string>(StringComparer.Ordinal)
        {
            "<Clone>$",
            "Deconstruct",
            "Equals",
            "GetHashCode",
            "ToString"
        };
        var entries = new List<string>();

        foreach (var type in assembly.GetExportedTypes().OrderBy(type => type.FullName, StringComparer.Ordinal))
        {
            entries.Add($"T:{type.FullName}");
            entries.AddRange(type.GetConstructors(
                    BindingFlags.Public
                    | BindingFlags.Instance
                    | BindingFlags.Static
                    | BindingFlags.DeclaredOnly)
                .Select(ctor => $"C:{type.FullName}/{ctor.GetParameters().Length}"));
            entries.AddRange(type.GetProperties(
                    BindingFlags.Public
                    | BindingFlags.Instance
                    | BindingFlags.Static
                    | BindingFlags.DeclaredOnly)
                .Select(property => $"P:{type.FullName}.{property.Name}"));
            entries.AddRange(type.GetMethods(
                    BindingFlags.Public
                    | BindingFlags.Instance
                    | BindingFlags.Static
                    | BindingFlags.DeclaredOnly)
                .Where(method => !method.IsSpecialName && !generatedRecordMethods.Contains(method.Name))
                .Select(method => $"M:{type.FullName}.{method.Name}/{method.GetParameters().Length}"));
        }

        return entries
            .Distinct(StringComparer.Ordinal)
            .OrderBy(entry => entry, StringComparer.Ordinal)
            .ToArray();
    }

    private static string[] ExpectedBinaryPublicSurfaceEntries(string packageId)
    {
        var entries = packageId switch
        {
            "TinyRustLM.Abstractions" => AbstractionsBinarySurfaceEntries(),
            "TinyRustLM.Core" => CoreBinarySurfaceEntries(),
            "TinyRustLM.P2P" => P2PBinarySurfaceEntries(),
            "TinyRustLM.Memory" => MemoryBinarySurfaceEntries(),
            "TinyRustLM.MemoryEndpoints" => MemoryEndpointsBinarySurfaceEntries(),
            _ => Array.Empty<string>()
        };

        return entries
            .OrderBy(entry => entry, StringComparer.Ordinal)
            .ToArray();
    }

    private static IEnumerable<string> AbstractionsBinarySurfaceEntries()
    {
        foreach (var entry in TypeSurface("TinyRustLM.ISlmInspector"))
        {
            yield return entry;
        }
        yield return "M:TinyRustLM.ISlmInspector.Inspect/1";

        foreach (var entry in TypeSurface("TinyRustLM.ITinyRustLmRuntime"))
        {
            yield return entry;
        }
        foreach (var method in new[]
        {
            "ActivateComposition/2",
            "Generate/2",
            "GetDiagnostics/0",
            "LoadModel/2",
            "Reset/0",
            "Step/0",
            "UnloadModel/0"
        })
        {
            yield return $"M:TinyRustLM.ITinyRustLmRuntime.{method}";
        }

        foreach (var entry in TypeSurface("TinyRustLM.ITinyRustLmRuntimeFactory"))
        {
            yield return entry;
        }
        foreach (var method in new[]
        {
            "CreateRuntime/0",
            "GetCapabilities/0",
            "GetVersion/0"
        })
        {
            yield return $"M:TinyRustLM.ITinyRustLmRuntimeFactory.{method}";
        }

        foreach (var entry in TypeSurface("TinyRustLM.ITinyRustLmP2PClient"))
        {
            yield return entry;
        }
        foreach (var method in P2PClientMethodEntries("TinyRustLM.ITinyRustLmP2PClient"))
        {
            yield return method;
        }

        foreach (var entry in TypeSurface("TinyRustLM.ITinyRustLmMemoryClient"))
        {
            yield return entry;
        }
        foreach (var method in MemoryClientMethodEntries("TinyRustLM.ITinyRustLmMemoryClient"))
        {
            yield return method;
        }

        foreach (var entry in RecordSurface("TinyRustLM.TinyRustLmGenerationOptions", 5,
            "MaxNewTokens",
            "Seed",
            "Temperature",
            "TopK",
            "TopP"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.TinyRustLmGenerationResult", 2, "Diagnostics", "Text"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.TinyRustLmLoadReport", 2, "Diagnostics", "Inspection"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.TinyRustLmCompositionActivationReport", 3,
            "ByteCount",
            "Diagnostics",
            "Sha256"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.TinyRustLmSdkVersion", 3, "NativeAbiVersion", "Product", "SdkVersion"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.TinyRustLmCapabilities", 12,
            "CompositionActivation",
            "Diagnostics",
            "ExcludedPrivateCapabilities",
            "Generation",
            "Kind",
            "MemoryPackageWorkflows",
            "ModelLoading",
            "P2PMetadataWorkflows",
            "SdkVersion",
            "SlmValidation",
            "StepGeneration",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.SlmInspection", 22,
            "ByteCount",
            "F32TensorCount",
            "FfnSize",
            "HeadCount",
            "HeadDim",
            "HiddenSize",
            "Kind",
            "KvHeadCount",
            "LayerCount",
            "MaxContext",
            "ModelType",
            "Q4_0TensorCount",
            "Q5_0TensorCount",
            "Q8_0TensorCount",
            "Quantization",
            "RuntimeChecksum",
            "Sha256",
            "SlmVersion",
            "TensorCount",
            "TokenizerBytes",
            "Version",
            "VocabSize"))
        {
            yield return entry;
        }

        foreach (var entry in P2PModelRecordSurfaceEntries())
        {
            yield return entry;
        }
        foreach (var entry in MemoryModelRecordSurfaceEntries())
        {
            yield return entry;
        }
    }

    private static IEnumerable<string> CoreBinarySurfaceEntries()
    {
        yield return "T:TinyRustLM.TinyRustLmException";
        yield return "C:TinyRustLM.TinyRustLmException/2";
        yield return "P:TinyRustLM.TinyRustLmException.Code";

        yield return "T:TinyRustLM.TinySlmInspector";
        yield return "C:TinyRustLM.TinySlmInspector/0";
        yield return "M:TinyRustLM.TinySlmInspector.Inspect/1";

        yield return "T:TinyRustLM.TinyRustLmRuntimeFactory";
        yield return "C:TinyRustLM.TinyRustLmRuntimeFactory/0";
        yield return "M:TinyRustLM.TinyRustLmRuntimeFactory.CreateRuntime/0";
        yield return "M:TinyRustLM.TinyRustLmRuntimeFactory.GetCapabilities/0";
        yield return "M:TinyRustLM.TinyRustLmRuntimeFactory.GetVersion/0";

        yield return "T:TinyRustLM.TinyRustLmRuntime";
        yield return "M:TinyRustLM.TinyRustLmRuntime.ActivateComposition/2";
        yield return "M:TinyRustLM.TinyRustLmRuntime.Dispose/0";
        yield return "M:TinyRustLM.TinyRustLmRuntime.Generate/2";
        yield return "M:TinyRustLM.TinyRustLmRuntime.GetDiagnostics/0";
        yield return "M:TinyRustLM.TinyRustLmRuntime.LoadModel/2";
        yield return "M:TinyRustLM.TinyRustLmRuntime.Reset/0";
        yield return "M:TinyRustLM.TinyRustLmRuntime.Step/0";
        yield return "M:TinyRustLM.TinyRustLmRuntime.UnloadModel/0";
    }

    private static IEnumerable<string> P2PBinarySurfaceEntries()
    {
        yield return "T:TinyRustLM.TinyRustLmP2PClient";
        yield return "C:TinyRustLM.TinyRustLmP2PClient/0";
        foreach (var method in P2PClientMethodEntries("TinyRustLM.TinyRustLmP2PClient"))
        {
            yield return method;
        }
    }

    private static IEnumerable<string> MemoryBinarySurfaceEntries()
    {
        yield return "T:TinyRustLM.TinyRustLmMemoryClient";
        yield return "C:TinyRustLM.TinyRustLmMemoryClient/0";
        foreach (var method in MemoryClientMethodEntries("TinyRustLM.TinyRustLmMemoryClient"))
        {
            yield return method;
        }
    }

    private static IEnumerable<string> MemoryEndpointsBinarySurfaceEntries()
    {
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRoutes", 6,
            "AcknowledgeNotification",
            "CreateMeetingRoom",
            "DistributedSyncCapabilities",
            "ListMeetingRooms",
            "MarkMeetingRoomRead",
            "PostMeetingMessage",
            "ReadInbox",
            "ReadMeetingMessages",
            "RegisterAgent",
            "SaveMemory",
            "SearchMemory",
            "SendMessage"))
        {
            yield return entry;
        }
        yield return "M:TinyRustLM.MemoryEndpointsRoutes.FromBaseUri/1";

        yield return "T:TinyRustLM.MemoryEndpointsAuthHeaderMode";

        yield return "T:TinyRustLM.MemoryEndpointsClientOptions";
        yield return "C:TinyRustLM.MemoryEndpointsClientOptions/5";
        yield return "P:TinyRustLM.MemoryEndpointsClientOptions.AgentId";
        yield return "P:TinyRustLM.MemoryEndpointsClientOptions.AuthHeaderMode";
        yield return "P:TinyRustLM.MemoryEndpointsClientOptions.Routes";
        yield return "P:TinyRustLM.MemoryEndpointsClientOptions.WorkspaceId";

        foreach (var entry in RecordSurface("TinyRustLM.TinyRustLmMemoryEndpointRecord", 6,
            "SafeSummary",
            "Scope",
            "SourceSha256",
            "Tags",
            "Title",
            "UaiReferences"))
        {
            yield return entry;
        }
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointRecord.LongTerm/5";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointRecord.ShortTerm/5";

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsAgentRegistration", 2,
            "DisplayName",
            "SafeSummary"))
        {
            yield return entry;
        }

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsAgentMessage", 3,
            "ResponseRequired",
            "SafeSummary",
            "TargetAgentId"))
        {
            yield return entry;
        }

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsSearchRequest", 4,
            "Limit",
            "MemoryTier",
            "Query",
            "Scope"))
        {
            yield return entry;
        }

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsMeetingRoomQuery", 3,
            "AgentId",
            "Scope",
            "ScopeId"))
        {
            yield return entry;
        }

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsCreateMeetingRoomRequest", 5,
            "Label",
            "Name",
            "Purpose",
            "Scope",
            "ScopeId"))
        {
            yield return entry;
        }

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsMeetingMessage", 2,
            "RoomId",
            "SafeSummary"))
        {
            yield return entry;
        }

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsReadMeetingMessagesRequest", 2,
            "Limit",
            "RoomId"))
        {
            yield return entry;
        }

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsMeetingTranscript", 3,
            "Count",
            "Items",
            "SchemaVersion"))
        {
            yield return entry;
        }
        yield return "M:TinyRustLM.MemoryEndpointsMeetingTranscript.FromJson/1";

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsMeetingTranscriptItem", 10,
            "CreatedAt",
            "MeetingMessageId",
            "RawMessageBodyStored",
            "RawPayloadExposed",
            "RoomId",
            "SafeSummary",
            "Scope",
            "ScopeId",
            "SenderAgentId",
            "ValuesRedacted"))
        {
            yield return entry;
        }

        yield return "T:TinyRustLM.TinyRustLmMemoryEndpointsClient";
        yield return "C:TinyRustLM.TinyRustLmMemoryEndpointsClient/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.AcknowledgeNotificationAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.CreateMeetingRoomAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.ListMeetingRoomsAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.MarkMeetingRoomReadAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.PostMeetingMessageAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.ProbeDistributedSyncAsync/1";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.ReadInboxAsync/1";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.ReadMeetingMessagesAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.ReadMeetingTranscriptAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.RegisterAgentAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.SaveMemoryAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.SearchMemoryAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.SendMessageAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.PrepareMemoryOutboxEntry/4";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.SendOutboxEntryAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.GetSyncRetentionPolicyAsync/1";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.LookupRevisionReceiptAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.PullRevisionChangesAsync/3";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.ReadRevisionHeadsAsync/2";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.RegisterSyncDeviceAsync/3";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.RevokeSyncDeviceAsync/3";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.RotateSyncDeviceAsync/3";
        yield return "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.SubmitRevisionMutationAsync/3";

        foreach (var typeName in new[]
        {
            "TinyRustLM.MemoryEndpointsCandidateSource",
            "TinyRustLM.MemoryEndpointsDistributedSyncAvailabilityStatus",
            "TinyRustLM.MemoryEndpointsEraseMode",
            "TinyRustLM.MemoryEndpointsHostedDeviceStatus",
            "TinyRustLM.MemoryEndpointsHostedHeadStatus",
            "TinyRustLM.MemoryEndpointsHostedSyncOperation",
            "TinyRustLM.MemoryEndpointsHostedSyncStatus",
            "TinyRustLM.MemoryEndpointsModelCapacityClass",
            "TinyRustLM.MemoryEndpointsOutboxState",
            "TinyRustLM.MemoryEndpointsRetentionKind",
            "TinyRustLM.MemoryEndpointsRetrievalStatus",
            "TinyRustLM.MemoryEndpointsRetrievalTier",
            "TinyRustLM.MemoryEndpointsRevisionDecisionKind",
            "TinyRustLM.MemoryEndpointsRevisionOperation",
            "TinyRustLM.MemoryEndpointsRevisionState",
            "TinyRustLM.MemoryEndpointsSearchFreshness"
        })
        {
            yield return $"T:{typeName}";
        }

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRetryState", 4,
            "AttemptCount", "Empty", "LastAttemptAtUnixMs", "LastErrorCode", "NextAttemptAtUnixMs"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsLocalReceipt", 6,
            "CommittedAtUnixMs", "DeviceId", "EventId", "Kind", "PayloadSha256", "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsAuthoritativeReceipt", 11,
            "AcceptedAtUnixMs", "EventId", "IdempotencyKey", "Kind", "MemoryEventId",
            "PayloadSha256", "Persisted", "ReceiptId", "RevisionId", "ServerSequence", "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsSubmitPayload", 18,
            "ActorAgentId", "AgentId", "Confidence", "Kind", "MemoryType", "SafeSummary", "Scope",
            "ScopeId", "Source", "SourceSha256", "Subject", "Summary", "Tags",
            "TinyrustlmMemoryTier", "Title", "UaiReferences", "Version", "WorkspaceId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsOutboxEntry", 15,
            "AuthoritativeReceipt", "CreatedAtUnixMs", "DeviceId", "EventId", "IdempotencyKey",
            "Kind", "LocalReceipt", "Payload", "PayloadSha256", "QuarantineReason", "Retry",
            "Scope", "State", "UpdatedAtUnixMs", "Version"))
        {
            yield return entry;
        }
        yield return "M:TinyRustLM.MemoryEndpointsOutboxEntry.ApplyAuthoritativeReceipt/2";
        yield return "M:TinyRustLM.MemoryEndpointsOutboxEntry.BeginSend/1";
        yield return "M:TinyRustLM.MemoryEndpointsOutboxEntry.IsSendable/1";
        yield return "M:TinyRustLM.MemoryEndpointsOutboxEntry.MarkQueued/1";
        yield return "M:TinyRustLM.MemoryEndpointsOutboxEntry.Quarantine/2";
        yield return "M:TinyRustLM.MemoryEndpointsOutboxEntry.ScheduleRetry/3";

        yield return "T:TinyRustLM.MemoryEndpointsSyncContract";
        yield return "M:TinyRustLM.MemoryEndpointsSyncContract.ComputePayloadSha256/1";
        yield return "M:TinyRustLM.MemoryEndpointsSyncContract.CreateSubmitPayload/3";
        yield return "M:TinyRustLM.MemoryEndpointsSyncContract.DeserializeOutboxEntry/1";
        yield return "M:TinyRustLM.MemoryEndpointsSyncContract.PrepareOutboxEntry/6";
        yield return "M:TinyRustLM.MemoryEndpointsSyncContract.SerializeOutboxEntry/1";
        yield return "M:TinyRustLM.MemoryEndpointsSyncContract.ValidateAuthoritativeReceipt/2";
        yield return "M:TinyRustLM.MemoryEndpointsSyncContract.ValidateOutboxEntry/1";

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRetrievalCandidate", 16,
            "BodySha256", "CreatedAtUnixMs", "MemoryId", "NormalizedBodySha256", "PublicSafe",
            "RelevanceMicros", "Reviewed", "RevisionId", "Scope", "ScopeId", "ServerSequence",
            "Source", "Status", "Summary", "SupersedesRevisionIds", "Tier"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRetrievalPolicy", 7,
            "AllowLongTerm", "AllowShortTerm", "MaxCandidates", "MaxSummaryChars",
            "RequireReviewedHosted", "Scope", "ScopeId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsContextBudget", 8,
            "BytesPerToken", "CapacityClass", "ContextWindowTokens", "GuardTokens", "MaxMemoryTokens",
            "MaxOutputTokens", "SystemTokens", "UserTokens"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsPackedSelection", 6,
            "CompressionStage", "MemoryId", "RevisionId", "Source", "SummarySha256", "Tier"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsContextExclusion", 3,
            "MemoryId", "Reason", "RevisionId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRetrievalReceipt", 7,
            "ByteBudget", "ContextSha256", "Excluded", "FailClosed", "FailureReason", "Kind",
            "Selected", "TokenBudget", "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsPackedContext", 7,
            "ByteBudget", "Context", "ContextSha256", "FailClosed", "Receipt", "Selected", "TokenBudget"))
        {
            yield return entry;
        }
        yield return "T:TinyRustLM.MemoryEndpointsRetrievalContract";
        yield return "M:TinyRustLM.MemoryEndpointsRetrievalContract.PackMemoryContext/3";

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRevisionMutation", 14,
            "BodySha256", "DeviceEpoch", "DeviceId", "DeviceSequence", "EraseMode", "Kind",
            "LamportTime", "MemoryId", "NormalizedBodySha256", "Operation", "ParentRevisionId",
            "RetentionUntilUnixMs", "RevisionId", "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRevisionHead", 12,
            "AcceptedDeviceEpoch", "AcceptedDeviceId", "BodySha256", "Kind", "MemoryId",
            "NormalizedBodySha256", "ParentRevisionId", "RevisionId", "ServerSequence", "State",
            "TombstoneRetentionUntilUnixMs", "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsDeviceAuthority", 3,
            "CurrentEpoch", "DeviceId", "Revoked"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRevisionDecision", 7,
            "CandidateRevisionId", "ConflictId", "CurrentRevisionId", "Kind", "MemoryId", "NextHead",
            "ReasonCode"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsSyncCheckpoint", 9,
            "CompleteSnapshot", "Kind", "MaxCreatedAtUnixMs", "MaxEventId", "MaxServerSequence",
            "PulledAtUnixMs", "RecordCount", "Version", "WorkspaceId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsStaleIndexReport", 4,
            "AcceptedServerSequence", "Freshness", "IndexedServerSequence", "SequenceLag"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRetentionRecord", 6,
            "IsCurrentHead", "Kind", "MemoryId", "RecordId", "RetentionUntilUnixMs", "Unresolved"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsCompactionPlan", 2,
            "CompactedIds", "RetainedIds"))
        {
            yield return entry;
        }
        yield return "T:TinyRustLM.MemoryEndpointsDistributedContract";
        yield return "M:TinyRustLM.MemoryEndpointsDistributedContract.DecideRevisionMutation/5";
        yield return "M:TinyRustLM.MemoryEndpointsDistributedContract.PlanCompaction/2";
        yield return "M:TinyRustLM.MemoryEndpointsDistributedContract.ReportSearchFreshness/2";
        yield return "M:TinyRustLM.MemoryEndpointsDistributedContract.ValidateCheckpointAdvance/2";

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsDistributedSyncRoutes", 8,
            "Changes", "Heads", "LookupReceipt", "RegisterDevice", "Retention", "RevokeDevice",
            "RotateDevice", "SubmitMutation"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface(
            "TinyRustLM.MemoryEndpointsDistributedSyncMutationContract",
            7,
            "ConflictSemantics", "HardForgetBehavior", "HardForgetSupported", "Idempotency",
            "Operations", "RevisionFields", "TombstoneSemantics"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface(
            "TinyRustLM.MemoryEndpointsDistributedSyncCheckpointContract",
            4,
            "ChangesQuery", "IndexedThroughWatermark", "MonotonicServerSequence",
            "PaginationFields"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface(
            "TinyRustLM.MemoryEndpointsDistributedSyncDeviceContract",
            4,
            "AuthorityEpoch", "RegisterRotateRevoke", "RevokedDeviceMutationBehavior",
            "SecretMaterialStored"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsDistributedSyncRetention", 4,
            "HardForgetSupported", "RawPrivatePayloadStored", "TombstoneRetentionDays",
            "ValuesRedacted"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsDistributedSyncCapabilities", 13,
            "CapabilityRoute", "CheckpointContract", "DeviceContract", "MutationContract",
            "Protocol", "PublicSafeOnly", "RawCredentialExposed", "RawPayloadExposed", "Retention",
            "Routes", "SchemaVersion", "Status", "ValuesRedacted"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsDistributedSyncAvailability", 3,
            "Capabilities", "ReasonCode", "Status"))
        {
            yield return entry;
        }
        yield return "T:TinyRustLM.MemoryEndpointsDistributedSyncProtocol";
        yield return "M:TinyRustLM.MemoryEndpointsDistributedSyncProtocol.ParseCapabilities/1";
        yield return "M:TinyRustLM.MemoryEndpointsDistributedSyncProtocol.ResolveRoute/2";
        yield return "M:TinyRustLM.MemoryEndpointsDistributedSyncProtocol.ValidateCapabilities/1";

        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsHostedRevisionMutation", 14,
            "ActorAgentId", "BodyHash", "DeviceEpoch", "DeviceId", "LogicalMemoryId", "MemoryType",
            "Operation", "ParentRevisionId", "Scope", "ScopeId", "SourceRef", "Summary", "Title",
            "WorkspaceId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRegisterDeviceRequest", 4,
            "AgentId", "DeviceId", "Label", "WorkspaceId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRotateDeviceRequest", 3,
            "AgentId", "DeviceId", "WorkspaceId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRevokeDeviceRequest", 3,
            "AgentId", "DeviceId", "WorkspaceId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsHostedDeviceAuthority", 11,
            "AgentId", "AuthorityEpoch", "CreatedAt", "DeviceId", "Label", "RawPayloadExposed",
            "RevokedAt", "Status", "UpdatedAt", "ValuesRedacted", "WorkspaceId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsDeviceOperatorSummary", 9,
            "Action", "AuthorityEpoch", "DeviceId", "Persisted", "RawCredentialExposed",
            "RawPayloadExposed", "SchemaVersion", "Status", "ValuesRedacted"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsDeviceAuthorityResponse", 14,
            "CanonicalDeviceId", "CanonicalWorkspaceId", "CapabilityRoute", "Device",
            "DeviceAuthorityPersisted", "IdempotencyKeyExposed", "IdempotentReplay", "Ok",
            "OperatorSummary", "Persisted", "RawCredentialExposed", "RawPayloadExposed",
            "ValuesRedacted", "VisibleToAgent"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsReconciliationReceipt", 17,
            "BodyHash", "Conflict", "ConflictCode", "CreatedAt", "CurrentHeadRevisionId",
            "HttpStatus", "IdempotencyKeyExposed", "IdempotencyKeyHash", "LogicalMemoryId",
            "RawCredentialExposed", "RawPayloadExposed", "ReceiptId", "ServerSequence", "Status",
            "SyncRevisionId", "ValuesRedacted", "WorkspaceId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsHostedRevision", 24,
            "ActorAgentId", "BodyHash", "Conflict", "ConflictCode", "CreatedAt", "DeviceEpoch",
            "DeviceId", "LogicalMemoryId", "MemoryEventId", "MemoryType", "Operation",
            "ParentRevisionId", "RawPayloadExposed", "Scope", "ScopeId", "ServerSequence",
            "Source", "Status", "Summary", "SyncRevisionId", "Title", "Tombstone",
            "ValuesRedacted", "WorkspaceId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsHostedRevisionHead", 9,
            "HeadRevisionId", "IndexedThroughSequence", "LogicalMemoryId", "RawPayloadExposed",
            "ServerSequence", "Status", "UpdatedAt", "ValuesRedacted", "WorkspaceId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsMutationOperatorSummary", 10,
            "Action", "Conflict", "ConflictCode", "Persisted", "RawCredentialExposed",
            "RawPayloadExposed", "SchemaVersion", "ServerSequence", "Status", "ValuesRedacted"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsMutationConfirmation", 14,
            "ChangesCount", "HeadVisible", "HeadsCount", "IndexedThroughSequence",
            "LogicalMemoryId", "Persisted", "RawCredentialExposed", "RawPayloadExposed",
            "ReceiptId", "ReceiptVisible", "RevisionId", "RevisionVisibleInChanges",
            "SchemaVersion", "ValuesRedacted"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRevisionDecisionResponse", 20,
            "CapabilityRoute", "ChangesQueryUrl", "Confirmation", "Conflict", "Head",
            "HeadsQueryUrl", "IdempotencyKeyExposed", "IdempotentReplay", "IndexedThroughSequence",
            "Ok", "OperatorSummary", "Persisted", "RawCredentialExposed", "RawPayloadExposed",
            "Receipt", "ReceiptQueryUrl", "Revision", "ServerSequence", "Status", "ValuesRedacted"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsReceiptLookupResponse", 6,
            "Ok", "OperatorSummary", "RawCredentialExposed", "RawPayloadExposed", "Receipt",
            "ValuesRedacted"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsReceiptLookupRequest", 3,
            "BodyHash", "IdempotencyKey", "LogicalMemoryId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsHostedCheckpoint", 4,
            "AfterSequence", "NextAfterSequence", "ValuesRedacted", "WorkspaceIdHash"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsChangePage", 9,
            "Checkpoint", "Count", "HasMore", "IndexedThroughSequence", "Items",
            "NextAfterSequence", "RawCredentialExposed", "RawPayloadExposed", "ValuesRedacted"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsChangePageResponse", 5,
            "Changes", "Ok", "RawCredentialExposed", "RawPayloadExposed", "ValuesRedacted"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsHeadsFilters", 1,
            "LogicalMemoryId"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsReadHeadsResponse", 7,
            "Count", "Filters", "Items", "Ok", "RawCredentialExposed", "RawPayloadExposed",
            "ValuesRedacted"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRetentionPolicy", 8,
            "HardForgetBehavior", "HardForgetSupported", "RawCredentialExposed",
            "RawPayloadExposed", "RawPrivatePayloadStored", "SchemaVersion",
            "TombstoneRetentionDays", "ValuesRedacted"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.MemoryEndpointsRetentionPolicyResponse", 6,
            "Capabilities", "Ok", "Policy", "RawCredentialExposed", "RawPayloadExposed",
            "ValuesRedacted"))
        {
            yield return entry;
        }

        yield return "T:TinyRustLM.MemoryEndpointsDistributedSyncException";
        yield return "P:TinyRustLM.MemoryEndpointsDistributedSyncException.ErrorCode";
        yield return "P:TinyRustLM.MemoryEndpointsDistributedSyncException.SafeNoOp";

        yield return "T:TinyRustLM.MemoryEndpointsDistributedSyncTransport";
        foreach (var method in new[]
        {
            "CanonicalizeHostedRevisionMutation/1",
            "ComputeHostedRevisionMutationBodyHash/1",
            "ComputeHostedRevisionMutationFingerprint/1",
            "ParseChangePage/2",
            "ParseDeviceAuthorityResponse/1",
            "ParseFailure/2",
            "ParseReadHeadsResponse/1",
            "ParseReceiptLookupResponse/1",
            "ParseRetentionPolicyResponse/1",
            "ParseRevisionDecisionResponse/1",
            "SerializeHostedRevisionMutation/1",
            "ValidateChangePage/2",
            "ValidateDeviceAuthorityResponse/1",
            "ValidateHostedRevisionMutation/1",
            "ValidateIdempotencyKey/1",
            "ValidateReadHeadsResponse/1",
            "ValidateReceiptLookupRequest/1",
            "ValidateReconciliationReceipt/1",
            "ValidateRegisterDeviceRequest/1",
            "ValidateRetentionPolicyResponse/1",
            "ValidateRevokeDeviceRequest/1",
            "ValidateRevisionDecisionResponse/1",
            "ValidateRotateDeviceRequest/1"
        })
        {
            yield return $"M:TinyRustLM.MemoryEndpointsDistributedSyncTransport.{method}";
        }
    }

    private static IEnumerable<string> P2PModelRecordSurfaceEntries()
    {
        foreach (var entry in RecordSurface("TinyRustLM.PrepareShareKitRequest", 7,
            "ManifestId",
            "ModelId",
            "ModelPath",
            "OutputDir",
            "PeerId",
            "PieceSize",
            "PublicBaseUrl"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PPiece", 4, "ByteCount", "Index", "Route", "Sha256"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PManifestBoundary", 4,
            "ExposesPrivateRouting",
            "ManifestContainsModelBytes",
            "RequiresArtifactSha256Validation",
            "RequiresPieceSha256Validation"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PManifest", 12,
            "ArtifactByteCount",
            "ArtifactSha256",
            "Boundary",
            "CreatedUnixSeconds",
            "Kind",
            "ManifestId",
            "ModelId",
            "PieceCount",
            "PieceSize",
            "Pieces",
            "Slm",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PManifestSignature", 6,
            "KeyId",
            "Kind",
            "PayloadSha256",
            "PublicKeyRoute",
            "PublisherId",
            "Value"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PSignedManifest", 4,
            "Kind",
            "Manifest",
            "Signature",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PPublicKeyDocument", 10,
            "CreatedUtc",
            "KeyAlgorithm",
            "KeyId",
            "KeyKind",
            "PublicKeyBase64",
            "PublicKeyRoute",
            "PublicKeySha256",
            "PublisherId",
            "Revoked",
            "Usage"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PSignedManifestVerification", 12,
            "KeyId",
            "Kind",
            "ManifestId",
            "ManifestSha256",
            "ModelId",
            "PayloadSha256",
            "PublicKeyRoute",
            "PublicKeySha256",
            "PublisherId",
            "SignatureAlgorithm",
            "Valid",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PShareKitReport", 10,
            "AnnouncementPath",
            "AnnouncementSha256",
            "Kind",
            "Manifest",
            "ManifestPath",
            "ManifestSha256",
            "OutputDir",
            "ShareMetadataPath",
            "ShareMetadataSha256",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PShareMetadata", 10,
            "ArtifactByteCount",
            "ArtifactSha256",
            "Boundary",
            "ExportedUnixSeconds",
            "Kind",
            "ManifestId",
            "ManifestSha256",
            "ModelId",
            "PieceCount",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PManifestInspection", 10,
            "ArtifactByteCount",
            "ArtifactSha256",
            "DeclaredPieceBytes",
            "Kind",
            "ManifestId",
            "ManifestSha256",
            "ModelId",
            "PieceCount",
            "Valid",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PImportPlan", 8,
            "ArtifactSha256",
            "Kind",
            "ManifestId",
            "ManifestSha256",
            "ModelId",
            "RequiredNextGate",
            "RequiredPieces",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PLocalImportBoundary", 5,
            "ArtifactSha256Verified",
            "NetworkFetchPerformed",
            "PieceSha256Verified",
            "PrivateRoutingUsed",
            "SlmValidationPerformed"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PLocalImportReceipt", 15,
            "ArtifactByteCount",
            "ArtifactSha256",
            "AssembledUnixSeconds",
            "Boundary",
            "Kind",
            "ManifestId",
            "ManifestSha256",
            "ModelId",
            "OutputByteCount",
            "OutputPath",
            "OutputSha256",
            "PieceCount",
            "ReceiptPath",
            "VerifiedPieceCount",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PLocalImportReceiptInspection", 16,
            "ArtifactByteCount",
            "ArtifactSha256",
            "Boundary",
            "InspectedOutputByteCount",
            "InspectedOutputPath",
            "InspectedOutputSha256",
            "Kind",
            "ManifestId",
            "ManifestSha256",
            "ModelId",
            "PieceCount",
            "ReceiptOutputPath",
            "ReceiptSha256",
            "Valid",
            "VerifiedPieceCount",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PAnnouncement", 11,
            "ArtifactByteCount",
            "ArtifactSha256",
            "CreatedUnixSeconds",
            "Kind",
            "ManifestId",
            "ManifestSha256",
            "ManifestUrl",
            "ModelId",
            "PeerConsent",
            "PeerId",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PAnnouncementCatalog", 3,
            "Announcements",
            "Kind",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.P2PAnnouncementCatalogInspection", 9,
            "AnnouncementCount",
            "CatalogSha256",
            "ManifestCount",
            "Kind",
            "ModelCount",
            "PeerCount",
            "TotalAnnouncedArtifactBytes",
            "Valid",
            "Version"))
        {
            yield return entry;
        }
    }

    private static IEnumerable<string> P2PClientMethodEntries(string typeName)
    {
        foreach (var method in new[]
        {
            "ApplyReceivedAnnouncement/2",
            "ApplyReceivedAnnouncementJson/2",
            "ExportShareMetadata/1",
            "ExportShareMetadataJson/1",
            "ImportFromManifest/1",
            "ImportFromManifest/3",
            "InspectAnnouncementCatalog/1",
            "InspectAnnouncementCatalogJson/1",
            "InspectLocalImportReceipt/2",
            "InspectManifest/1",
            "PrepareLocalShareKit/1",
            "PrepareLocalShareKitJson/1",
            "ValidateAnnouncement/1",
            "ValidateAnnouncementJson/1",
            "VerifySignedManifest/2",
            "VerifySignedManifestJson/2"
        })
        {
            yield return $"M:{typeName}.{method}";
        }
    }

    private static IEnumerable<string> MemoryClientMethodEntries(string typeName)
    {
        foreach (var method in new[]
        {
            "GetRequiredFiles/1",
            "GetRequiredFilesJson/1",
            "GetSupportedSetups/0",
            "GetSupportedSetupsJson/0",
            "InspectManifest/1",
            "InspectPackage/2",
            "ValidatePackage/2"
        })
        {
            yield return $"M:{typeName}.{method}";
        }
    }

    private static IEnumerable<string> MemoryModelRecordSurfaceEntries()
    {
        foreach (var entry in RecordSurface("TinyRustLM.UaixAdvancedPersonaOptions", 11,
            "BirthAgeGenerationDepth",
            "IncludeAllPersonaDimensions",
            "IncludeJewelryChoices",
            "IncludeSpringFallStyle",
            "IncludeSuperFashionStyle",
            "IncludeWinterStyle",
            "PhysicalAppearanceDepth",
            "PoliticalLeaningDepth",
            "ReligionWorldviewDepth",
            "RomanticOrientationDepth",
            "SenseOfStyleDepth"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.UaixMemoryPackageRequest", 14,
            "AdvancedPersona",
            "CalendarScheduling",
            "CodeLikeArtifacts",
            "CommunicationStyle",
            "ContactMemory",
            "DelegatedOperations",
            "Deployment",
            "PublicFacingBoundaries",
            "RoutinesPreferences",
            "SafetySupportBoundaries",
            "Setup",
            "SourceNotes",
            "TasksCommitments",
            "ToolPermissions"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.UaixMemoryRequiredFile", 4,
            "Path",
            "Role",
            "Source",
            "State"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.UaixMemoryBoundary", 6,
            "AutomaticLlmWikiSync",
            "AutomaticRepositoryWrites",
            "HostedImportValidation",
            "PersonaFidelityCertification",
            "PersonaSourceMutationAllowed",
            "UsesTinyrustlmRuntimeHarness"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.UaixMemoryFileDeckSummary", 19,
            "AdvancedPersonaRequiredFiles",
            "ClosedRequiredFileSet",
            "ConfigurationSpecificRequiredFiles",
            "ContentTriggeredRequiredFiles",
            "EvidenceFiles",
            "ExportFiles",
            "IncludesAgentPickup",
            "IncludesKnowledgeGraph",
            "IncludesLlmsExports",
            "IncludesManifestJson",
            "IncludesManifestOverlay",
            "IncludesPackageModel",
            "IncludesPersonaSourceEvidence",
            "IncludesSessionLog",
            "PersonaDimensionFiles",
            "ProfileRequiredFiles",
            "TotalRequiredFiles",
            "TriggeredPersonaStyleAxisFiles",
            "UniversalRequiredFiles"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.UaixMemorySetupDescriptor", 7,
            "AuthorityUrls",
            "ExcludedPrivateCapabilities",
            "Label",
            "PackageFeatures",
            "Setup",
            "SetupUrl",
            "Summary"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.UaixMemorySetupCatalog", 6,
            "Boundary",
            "Kind",
            "SetupCount",
            "Setups",
            "SourceUrls",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.UaixMemoryPackagePlan", 8,
            "Boundary",
            "FileDeck",
            "Kind",
            "RequiredFileCount",
            "RequiredFiles",
            "Setup",
            "SourceUrls",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.UaixMemoryFileStatus", 6,
            "ByteCount",
            "Exists",
            "Path",
            "Role",
            "Sha256",
            "State"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.UaixPersonaDimensionInspection", 12,
            "ByteCount",
            "DeclaresDepthLevel",
            "DeclaresDisclosureBoundary",
            "DeclaresNonInferenceRules",
            "DeclaresSourceConfidence",
            "DepthLevel0To10",
            "Dimension",
            "Exists",
            "Path",
            "Sha256",
            "Valid",
            "Warnings"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.UaixMemoryPackageInspection", 17,
            "Boundary",
            "FileDeck",
            "Kind",
            "Manifest",
            "ManifestDeclaresRequiredFiles",
            "ManifestMissingRequiredFiles",
            "MissingRequiredFiles",
            "PackageFileCount",
            "PackagePath",
            "PackageSource",
            "PersonaDimensionWarningCount",
            "PersonaDimensions",
            "PersonaDimensionsValid",
            "RequiredFiles",
            "Setup",
            "Valid",
            "Version"))
        {
            yield return entry;
        }
        foreach (var entry in RecordSurface("TinyRustLM.UaixMemoryManifestInspection", 10,
            "AdvancedPersonaProfile",
            "DeclaredFileCount",
            "DeclaredFilePaths",
            "DeclaredKind",
            "DeclaredSetup",
            "Kind",
            "ManifestSha256",
            "Valid",
            "Version",
            "Warnings"))
        {
            yield return entry;
        }
    }

    private static IEnumerable<string> TypeSurface(string typeName)
    {
        yield return $"T:{typeName}";
    }

    private static IEnumerable<string> RecordSurface(string typeName, int constructorParameterCount, params string[] properties)
    {
        yield return $"T:{typeName}";
        yield return $"C:{typeName}/{constructorParameterCount}";
        foreach (var property in properties.OrderBy(property => property, StringComparer.Ordinal))
        {
            yield return $"P:{typeName}.{property}";
        }
    }

    private static void TryDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path))
            {
                Directory.Delete(path, recursive: true);
            }
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }

    private sealed class PackageAssemblyLoadContext : AssemblyLoadContext
    {
        private readonly IReadOnlyDictionary<string, string> _assemblyPaths;

        public PackageAssemblyLoadContext(IReadOnlyDictionary<string, string> assemblyPaths)
            : base(isCollectible: true)
        {
            _assemblyPaths = assemblyPaths;
        }

        protected override Assembly? Load(AssemblyName assemblyName)
        {
            return assemblyName.Name is not null
                && _assemblyPaths.TryGetValue(assemblyName.Name, out var assemblyPath)
                    ? LoadFromAssemblyPath(assemblyPath)
                    : null;
        }
    }

    private static void AssertExpectedPackageDocumentation(JsonElement package)
    {
        var packageId = package.GetProperty("package_id").GetString();
        var expectedNames = packageId switch
        {
            "TinyRustLM.Core" => new[]
            {
                "README.md",
                "LICENSE.txt",
                "docs/PACKAGE_SECURITY.md"
            },
            "TinyRustLM.P2P" => new[]
            {
                "README.md",
                "LICENSE.txt",
                "docs/API_BOUNDARY.md",
                "docs/P2P_SHARE_FLOW.md"
            },
            "TinyRustLM.Memory" => new[]
            {
                "README.md",
                "LICENSE.txt",
                "docs/API_BOUNDARY.md",
                "docs/MEMORY_HARNESS.md"
            },
            "TinyRustLM.MemoryEndpoints" => new[]
            {
                "README.md",
                "LICENSE.txt",
                "docs/API_BOUNDARY.md",
                "docs/MEMORY_ENDPOINTS_CONNECTOR.md",
                "docs/MEMORY_ENDPOINTS_DISTRIBUTED_SYNC_V1.md",
                "docs/MEMORY_HARNESS.md"
            },
            _ => new[]
            {
                "README.md",
                "LICENSE.txt"
            }
        };
        var expected = package.GetProperty("expected_package_documentation_entries")
            .EnumerateArray()
            .ToArray();

        Assert.Equal(expectedNames.Length, expected.Length);
        foreach (var entryName in expectedNames)
        {
            var entry = expected.FirstOrDefault(item =>
                item.GetProperty("entry").GetString() == entryName);
            Assert.NotEqual(JsonValueKind.Undefined, entry.ValueKind);
            Assert.True(entry.GetProperty("source_exists").GetBoolean(), entryName);
            Assert.True(entry.GetProperty("package_entry_exists").GetBoolean(), entryName);
            Assert.True(entry.GetProperty("sha256_match").GetBoolean(), entryName);
            Assert.Matches("^[0-9a-f]{64}$", entry.GetProperty("source_sha256").GetString() ?? "");
            Assert.Equal(
                entry.GetProperty("source_sha256").GetString(),
                entry.GetProperty("package_sha256").GetString());
        }
    }

    private static void AssertExpectedPackageIdentity(JsonElement package, string packageVersion)
    {
        var packageName = package.GetProperty("name").GetString() ?? "";
        var expectedId = packageName.EndsWith($".{packageVersion}.nupkg", StringComparison.Ordinal)
            ? packageName[..^($".{packageVersion}.nupkg".Length)]
            : "";

        Assert.Equal(expectedId, package.GetProperty("expected_package_id").GetString());
        Assert.Equal(packageVersion, package.GetProperty("expected_package_version").GetString());
        Assert.Equal(expectedId, package.GetProperty("metadata").GetProperty("id").GetString());
        Assert.Equal(packageVersion, package.GetProperty("metadata").GetProperty("version").GetString());
    }

    private static void AssertExpectedPackageDependencies(JsonElement package)
    {
        var packageId = package.GetProperty("package_id").GetString();
        var packageVersion = package.GetProperty("metadata").GetProperty("version").GetString();
        var expected = package.GetProperty("expected_dependency_entries").EnumerateArray().ToArray();
        var actual = package.GetProperty("dependencies").EnumerateArray().ToArray();

        if (packageId == "TinyRustLM.Abstractions")
        {
            Assert.Empty(expected);
            Assert.Empty(actual);
            return;
        }

        if (packageId == "TinyRustLM.Core")
        {
            Assert.Single(expected);
            Assert.Single(actual);
            AssertDependency(expected[0], "TinyRustLM.Abstractions", packageVersion);
            AssertDependency(actual[0], "TinyRustLM.Abstractions", packageVersion);
            return;
        }

        if (packageId == "TinyRustLM.P2P" || packageId == "TinyRustLM.Memory")
        {
            Assert.Equal(2, expected.Length);
            Assert.Equal(2, actual.Length);
            Assert.Contains(expected, dependency => DependencyMatches(
                dependency,
                "TinyRustLM.Abstractions",
                packageVersion));
            Assert.Contains(expected, dependency => DependencyMatches(
                dependency,
                "TinyRustLM.Core",
                packageVersion));
            Assert.Contains(actual, dependency => DependencyMatches(
                dependency,
                "TinyRustLM.Abstractions",
                packageVersion));
            Assert.Contains(actual, dependency => DependencyMatches(
                dependency,
                "TinyRustLM.Core",
                packageVersion));
        }

        if (packageId == "TinyRustLM.MemoryEndpoints")
        {
            Assert.Equal(2, expected.Length);
            Assert.Equal(2, actual.Length);
            Assert.Contains(expected, dependency => DependencyMatches(
                dependency,
                "TinyRustLM.Abstractions",
                packageVersion));
            Assert.Contains(expected, dependency => DependencyMatches(
                dependency,
                "TinyRustLM.Memory",
                packageVersion));
            Assert.Contains(actual, dependency => DependencyMatches(
                dependency,
                "TinyRustLM.Abstractions",
                packageVersion));
            Assert.Contains(actual, dependency => DependencyMatches(
                dependency,
                "TinyRustLM.Memory",
                packageVersion));
        }
    }

    private static void AssertDependency(JsonElement dependency, string id, string? version)
    {
        Assert.True(DependencyMatches(dependency, id, version));
    }

    private static bool DependencyMatches(JsonElement dependency, string id, string? version) =>
        dependency.GetProperty("id").GetString() == id
        && dependency.GetProperty("version").GetString() == version
        && dependency.GetProperty("exclude").GetString() == "Build,Analyzers";

    private static void AssertPackageIdUsesProperty(string root, string relativeProjectPath, string propertyName)
    {
        var project = File.ReadAllText(Path.Combine(root, relativeProjectPath));

        Assert.Contains($"<PackageId>$({propertyName})</PackageId>", project, StringComparison.Ordinal);
    }

    private static void AssertPackageProjectSearchMetadata(
        string root,
        string relativeProjectPath,
        params string[] expectedSearchTerms)
    {
        var project = File.ReadAllText(Path.Combine(root, relativeProjectPath));

        Assert.Contains("<Title>", project, StringComparison.Ordinal);
        Assert.Contains("<Summary>", project, StringComparison.Ordinal);
        Assert.Contains("<Description>", project, StringComparison.Ordinal);
        Assert.Contains("<PackageTags>", project, StringComparison.Ordinal);
        foreach (var term in expectedSearchTerms)
        {
            Assert.Contains(term, project, StringComparison.OrdinalIgnoreCase);
        }
    }

    private static void AssertSearchablePackageMetadata(JsonElement package)
    {
        var metadata = package.GetProperty("metadata");
        var haystack = string.Join(
            " ",
            metadata.GetProperty("id").GetString(),
            metadata.GetProperty("title").GetString(),
            metadata.GetProperty("description").GetString(),
            metadata.GetProperty("tags").GetString(),
            metadata.GetProperty("release_notes").GetString(),
            metadata.GetProperty("project_url").GetString(),
            metadata.GetProperty("repository_url").GetString());

        Assert.True(metadata.GetProperty("description").GetString()?.Length > 80);
        Assert.True(metadata.GetProperty("tags").GetString()?.Length > 40);
        foreach (var term in package.GetProperty("required_search_terms").EnumerateArray())
        {
            Assert.Contains(term.GetString()!, haystack, StringComparison.OrdinalIgnoreCase);
        }
    }

    private static void AssertExpectedPackageContentEntries(JsonElement package)
    {
        var packageId = package.GetProperty("package_id").GetString();
        var entryNames = package.GetProperty("package_entry_names")
            .EnumerateArray()
            .Select(entry => entry.GetString())
            .Where(entry => entry is not null)
            .Cast<string>()
            .ToArray();
        var allowedPatterns = package.GetProperty("allowed_package_entry_patterns")
            .EnumerateArray()
            .Select(entry => entry.GetString())
            .Where(entry => entry is not null)
            .Cast<string>()
            .ToArray();

        Assert.NotEmpty(entryNames);
        Assert.Contains("[Content_Types].xml", entryNames);
        Assert.Contains("_rels/.rels", entryNames);
        Assert.Contains($"{packageId}.nuspec", entryNames);
        Assert.Contains("README.md", entryNames);
        Assert.Contains("LICENSE.txt", entryNames);
        Assert.Contains($"lib/net8.0/{packageId}.dll", entryNames);
        Assert.Contains($"lib/net8.0/{packageId}.xml", entryNames);
        Assert.Contains("package/services/metadata/core-properties/*.psmdcp", allowedPatterns);
        Assert.Contains($"{packageId}.nuspec", allowedPatterns);
        Assert.Contains($"lib/net8.0/{packageId}.dll", allowedPatterns);
        Assert.Contains($"lib/net8.0/{packageId}.xml", allowedPatterns);

        foreach (var entry in entryNames)
        {
            Assert.True(IsAllowedPackageEntry(entry, allowedPatterns), entry);
        }
    }

    private static bool IsAllowedPackageEntry(string entry, IReadOnlyCollection<string> allowedPatterns) =>
        allowedPatterns.Contains(entry)
        || (allowedPatterns.Contains("package/services/metadata/core-properties/*.psmdcp")
            && entry.StartsWith("package/services/metadata/core-properties/", StringComparison.Ordinal)
            && entry.EndsWith(".psmdcp", StringComparison.Ordinal)
            && entry.Count(character => character == '/') == 4);

    private static void AssertExpectedPublicApiEntries(JsonElement package)
    {
        var packageId = package.GetProperty("package_id").GetString();
        var actual = package.GetProperty("public_api_entries")
            .EnumerateArray()
            .Select(entry => entry.GetString())
            .Where(entry => entry is not null)
            .Cast<string>()
            .OrderBy(entry => entry, StringComparer.Ordinal)
            .ToArray();
        var expected = package.GetProperty("expected_public_api_entries")
            .EnumerateArray()
            .Select(entry => entry.GetString())
            .Where(entry => entry is not null)
            .Cast<string>()
            .OrderBy(entry => entry, StringComparer.Ordinal)
            .ToArray();

        Assert.NotEmpty(actual);
        Assert.Equal(expected, actual);
        Assert.DoesNotContain(actual, entry =>
            entry.Contains("Conversion", StringComparison.OrdinalIgnoreCase)
            || entry.Contains("QuantizationAuthoring", StringComparison.OrdinalIgnoreCase)
            || entry.Contains("Adapter", StringComparison.OrdinalIgnoreCase)
            || entry.Contains("Selector", StringComparison.OrdinalIgnoreCase)
            || entry.Contains("Breeding", StringComparison.OrdinalIgnoreCase)
            || entry.Contains("Telemetry", StringComparison.OrdinalIgnoreCase)
            || entry.Contains("LicenseServer", StringComparison.OrdinalIgnoreCase));

        if (packageId == "TinyRustLM.Abstractions")
        {
            Assert.Contains("T:TinyRustLM.ITinyRustLmRuntime", actual);
            Assert.Contains("T:TinyRustLM.ITinyRustLmP2PClient", actual);
            Assert.Contains("T:TinyRustLM.ITinyRustLmMemoryClient", actual);
            Assert.Contains("T:TinyRustLM.SlmInspection", actual);
            Assert.DoesNotContain("T:TinyRustLM.TinyRustLmP2PClient", actual);
            Assert.DoesNotContain("T:TinyRustLM.TinyRustLmMemoryClient", actual);
            return;
        }

        if (packageId == "TinyRustLM.Core")
        {
            Assert.Contains("T:TinyRustLM.TinySlmInspector", actual);
            Assert.Contains("T:TinyRustLM.TinyRustLmRuntimeFactory", actual);
            Assert.Contains("M:TinyRustLM.TinyRustLmRuntimeFactory.GetCapabilities", actual);
            return;
        }

        if (packageId == "TinyRustLM.P2P")
        {
            Assert.Contains("T:TinyRustLM.TinyRustLmP2PClient", actual);
            Assert.Contains(
                "M:TinyRustLM.TinyRustLmP2PClient.ImportFromManifest(System.String,System.String,System.String)",
                actual);
            Assert.Contains(
                "M:TinyRustLM.TinyRustLmP2PClient.InspectAnnouncementCatalog(System.String)",
                actual);
        }

        if (packageId == "TinyRustLM.Memory")
        {
            Assert.Contains("T:TinyRustLM.TinyRustLmMemoryClient", actual);
            Assert.Contains(
                "M:TinyRustLM.TinyRustLmMemoryClient.InspectPackage(System.String,TinyRustLM.UaixMemoryPackageRequest)",
                actual);
            Assert.Contains(
                "M:TinyRustLM.TinyRustLmMemoryClient.GetRequiredFiles(TinyRustLM.UaixMemoryPackageRequest)",
                actual);
        }

        if (packageId == "TinyRustLM.MemoryEndpoints")
        {
            Assert.Contains("T:TinyRustLM.TinyRustLmMemoryEndpointsClient", actual);
            Assert.Contains(
                "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.SaveMemoryAsync(TinyRustLM.TinyRustLmMemoryEndpointRecord,System.Threading.CancellationToken)",
                actual);
            Assert.Contains(
                "M:TinyRustLM.TinyRustLmMemoryEndpointsClient.SearchMemoryAsync(TinyRustLM.MemoryEndpointsSearchRequest,System.Threading.CancellationToken)",
                actual);
            Assert.Contains("T:TinyRustLM.TinyRustLmMemoryEndpointRecord", actual);
            Assert.Contains("T:TinyRustLM.MemoryEndpointsClientOptions", actual);
            Assert.Contains("T:TinyRustLM.MemoryEndpointsAuthHeaderMode", actual);
            Assert.DoesNotContain(actual, entry =>
                entry.Contains("BearerToken", StringComparison.OrdinalIgnoreCase)
                || entry.Contains("ModelConversion", StringComparison.OrdinalIgnoreCase)
                || entry.Contains("Telemetry", StringComparison.OrdinalIgnoreCase));
        }
    }

    private static void AssertExpectedNativeEntries(JsonElement package)
    {
        var packageId = package.GetProperty("package_id").GetString();
        var nativeEntries = package.GetProperty("native_entries").EnumerateArray().ToArray();
        var allowedNativeEntries = package.GetProperty("allowed_native_entries")
            .EnumerateArray()
            .Select(entry => entry.GetString())
            .ToArray();

        if (packageId == "TinyRustLM.Core")
        {
            var expectedAllowedEntries = new[]
            {
                "runtimes/win-x64/native/tinyrustlm_native.dll",
                "runtimes/linux-x64/native/libtinyrustlm_native.so",
                "runtimes/osx-x64/native/libtinyrustlm_native.dylib",
                "runtimes/osx-arm64/native/libtinyrustlm_native.dylib"
            };

            Assert.Equal(expectedAllowedEntries.OrderBy(entry => entry), allowedNativeEntries.OrderBy(entry => entry));
            Assert.All(nativeEntries, entry =>
                Assert.Contains(entry.GetString(), expectedAllowedEntries));
            return;
        }

        Assert.Empty(allowedNativeEntries);
        Assert.Empty(nativeEntries);
    }
}
