using System.Xml.Linq;
using Xunit;

namespace TinyRustLM.Package.Tests;

public sealed class PackageBoundaryTests
{
    private static readonly string[] DefaultPackageIds =
    {
        "TinyRustLM.Abstractions",
        "TinyRustLM.Core",
        "TinyRustLM.P2P"
    };

    private static readonly string[] OptionalPackageIds =
    {
        "TinyRustLM.MemoryEndpoints",
        "TinyRustLM.Conversion"
    };

    private static readonly string[] SupportedNativeRids =
    {
        "win-x64",
        "linux-x64",
        "linux-arm64"
    };

    [Fact]
    public void CanonicalPackageInfrastructureExists()
    {
        var root = RepositoryRoot();
        var required = new[]
        {
            "rust/crates/tinyrustlm-slm2/Cargo.toml",
            "rust/crates/tinyrustlm-composition2/Cargo.toml",
            "rust/crates/tinyrustlm-runtime/Cargo.toml",
            "rust/crates/tinyrustlm-native/Cargo.toml",
            "rust/crates/tinyrustlm-p2p/Cargo.toml",
            "rust/crates/tinyrustlm-convert/Cargo.toml",
            "dotnet/Directory.Build.props",
            "dotnet/TinyRustLM.sln",
            "dotnet/src/TinyRustLM.Abstractions/TinyRustLM.Abstractions.csproj",
            "dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj",
            "dotnet/src/TinyRustLM.P2P/TinyRustLM.P2P.csproj",
            "dotnet/src/TinyRustLM.MemoryEndpoints/TinyRustLM.MemoryEndpoints.csproj",
            "dotnet/src/TinyRustLM.Conversion/TinyRustLM.Conversion.csproj",
            "dotnet/src/TinyRustLM.Companion/TinyRustLM.Companion.csproj",
            "dotnet/tests/TinyRustLM.Companion.Tests/TinyRustLM.Companion.Tests.csproj",
            "dotnet/samples/TinyRustLM.ConsoleSample/TinyRustLM.ConsoleSample.csproj",
            "dotnet/samples/TinyRustLM.P2PShareSample/TinyRustLM.P2PShareSample.csproj",
            "eng/build-native.ps1",
            "eng/build-native.sh",
            "eng/build-converter.ps1",
            "eng/build-converter.sh",
            "eng/pack.ps1",
            "eng/pack.sh",
            "eng/verify-package.ps1",
            "eng/verify-package.sh",
            "eng/write-package-audit.ps1",
            "eng/write-package-audit.sh",
            "eng/verify-consumer.ps1",
            "eng/verify-consumer.sh",
            "eng/publish-nuget.ps1",
            "eng/publish-nuget.sh",
            "eng/verify-feed-current.ps1",
            "eng/verify-feed-current.sh",
            "eng/verify-feed-package-hashes.ps1",
            "eng/verify-feed-package-hashes.sh",
            "eng/audit-nuget-release-readiness.ps1",
            "eng/audit-nuget-release-readiness.sh",
            "docs/nuget/README.md",
            "docs/nuget/API_BOUNDARY.md",
            "docs/nuget/PACKAGE_SECURITY.md",
            "docs/nuget/PRIVATE_FEED.md",
            ".github/workflows/ci.yml",
            ".github/workflows/release-nuget.yml",
            ".github/workflows/nuget-feed-monitor.yml"
        };

        foreach (var path in required)
        {
            Assert.True(File.Exists(Path.Combine(root, path)), path);
        }

        var removedMemoryPackage = Path.Combine(root, "dotnet/src/TinyRustLM.Memory");
        Assert.False(File.Exists(Path.Combine(removedMemoryPackage, "TinyRustLM.Memory.csproj")));
        if (Directory.Exists(removedMemoryPackage))
        {
            var unexpectedEntries = Directory.EnumerateFileSystemEntries(removedMemoryPackage)
                .Where(path => !new[] { "bin", "obj" }.Contains(Path.GetFileName(path), StringComparer.OrdinalIgnoreCase));
            Assert.Empty(unexpectedEntries);
        }
        Assert.False(File.Exists(Path.Combine(root, ".github/workflows/release-browser-nuget.yml")));
        Assert.False(File.Exists(Path.Combine(root, "eng/publish-browser-nuget.ps1")));
        Assert.False(File.Exists(Path.Combine(root, "eng/publish-browser-nuget.sh")));
        Assert.False(File.Exists(Path.Combine(root, "eng/verify-browser-feed.ps1")));
        Assert.False(File.Exists(Path.Combine(root, "eng/verify-browser-feed.sh")));
        Assert.False(File.Exists(Path.Combine(root, "eng/audit-browser-nuget-release-readiness.ps1")));
        Assert.False(File.Exists(Path.Combine(root, "eng/audit-browser-nuget-release-readiness.sh")));
    }

    [Fact]
    public void ObsoleteSeedHostIsDeletedAndCompanionReleaseRemainsClosed()
    {
        var root = RepositoryRoot();
        foreach (var removedDirectory in new[]
        {
            "dotnet/src/TinyRustLM.SeedHost",
            "dotnet/tools/TinyRustLM.SeedHost.Tool",
            "dotnet/tests/TinyRustLM.SeedHost.Tests"
        })
        {
            var path = Path.Combine(root, removedDirectory);
            if (!Directory.Exists(path))
            {
                continue;
            }

            var unexpectedEntries = Directory.EnumerateFileSystemEntries(path)
                .Where(entry => !new[] { "bin", "obj" }.Contains(
                    Path.GetFileName(entry),
                    StringComparer.OrdinalIgnoreCase));
            Assert.Empty(unexpectedEntries);
        }

        var solution = File.ReadAllText(Path.Combine(root, "dotnet/TinyRustLM.sln"));
        Assert.DoesNotContain("SeedHost", solution, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("TinyRustLM.Companion", solution, StringComparison.Ordinal);
        var companionProject = XDocument.Load(Path.Combine(
            root,
            "dotnet/src/TinyRustLM.Companion/TinyRustLM.Companion.csproj"));
        Assert.Equal("false", Assert.Single(companionProject.Descendants("IsPackable")).Value.Trim());
        Assert.Empty(companionProject.Descendants("PackageId"));
        Assert.Empty(companionProject.Descendants("PackageReference"));
        var companionReferences = companionProject.Descendants("ProjectReference")
            .Select(reference => Path.GetFileNameWithoutExtension(reference.Attribute("Include")?.Value))
            .Order(StringComparer.Ordinal)
            .ToArray();
        Assert.Equal(
            new[] { "TinyRustLM.Abstractions", "TinyRustLM.Conversion" },
            companionReferences);
        var companionDocument = File.ReadAllText(Path.Combine(root, "docs/companion/README.md"));
        Assert.Contains("unavailable for installation", companionDocument, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("canonical `tinyrustlm-convert` executable", companionDocument, StringComparison.Ordinal);
        Assert.DoesNotContain("tinyrustlm-slm-pack", companionDocument, StringComparison.OrdinalIgnoreCase);

        foreach (var removedPath in new[]
        {
            "docs/nuget/SEED_HOST.md",
            "eng/build-seed-host-native.ps1",
            "eng/build-seed-host-native.sh",
            "eng/build-seed-host-releases.ps1",
            "eng/pack-seed-host.ps1",
            "eng/pack-seed-host.sh",
            "eng/test-seed-host-package-consumers.ps1",
            "eng/verify-seed-host-packages.ps1",
            "eng/verify-seed-host-release.sh",
            "eng/verify-seed-host-releases.ps1"
        })
        {
            Assert.False(File.Exists(Path.Combine(root, removedPath)), removedPath);
        }
    }

    [Fact]
    public void PackageProjectsDeclareTheSoleCurrentDependencyGraph()
    {
        var root = RepositoryRoot();
        AssertProjectReferences(root, "TinyRustLM.Abstractions");
        AssertProjectReferences(root, "TinyRustLM.Core", "TinyRustLM.Abstractions");
        AssertProjectReferences(root, "TinyRustLM.P2P", "TinyRustLM.Abstractions", "TinyRustLM.Core");
        AssertProjectReferences(root, "TinyRustLM.MemoryEndpoints", "TinyRustLM.Abstractions");
        AssertProjectReferences(root, "TinyRustLM.Conversion", "TinyRustLM.Core");

        foreach (var packageId in DefaultPackageIds.Concat(OptionalPackageIds))
        {
            AssertProjectProperty(root, packageId, "PackageId", packageId);
        }

        var sharedProperties = File.ReadAllText(Path.Combine(root, "dotnet/Directory.Build.props"));
        Assert.DoesNotContain("TinyRustLmPackageIdPrefix", sharedProperties, StringComparison.Ordinal);
        Assert.DoesNotContain("TinyRustLmAbstractionsPackageId", sharedProperties, StringComparison.Ordinal);
        Assert.DoesNotContain("TinyRustLmCorePackageId", sharedProperties, StringComparison.Ordinal);
        Assert.DoesNotContain("TinyRustLmP2PPackageId", sharedProperties, StringComparison.Ordinal);
        Assert.DoesNotContain("TinyRustLmMemoryEndpointsPackageId", sharedProperties, StringComparison.Ordinal);
        Assert.DoesNotContain("TinyRustLmConversionPackageId", sharedProperties, StringComparison.Ordinal);

        AssertProjectProperty(root, "TinyRustLM.Abstractions", "IsPackable", "true");
        AssertProjectProperty(root, "TinyRustLM.Core", "IsPackable", "true");
        AssertProjectProperty(root, "TinyRustLM.P2P", "IsPackable", "true");
        AssertProjectProperty(root, "TinyRustLM.MemoryEndpoints", "IsPackable", "$(TinyRustLmPackOptionalMemoryEndpoints)");
        AssertProjectProperty(root, "TinyRustLM.Conversion", "IsPackable", "$(TinyRustLmPackPrivateConversion)");
    }

    [Fact]
    public void PackageMetadataDescribesOnlyCurrentProductBehavior()
    {
        var root = RepositoryRoot();
        var expectedTitles = new Dictionary<string, string>
        {
            ["TinyRustLM.Abstractions"] = "TinyRustLM SDK Abstractions",
            ["TinyRustLM.Core"] = "TinyRustLM p2pLLM Runtime SDK",
            ["TinyRustLM.P2P"] = "TinyRustLM p2pRuntime P2P SDK",
            ["TinyRustLM.MemoryEndpoints"] = "TinyRustLM MemoryEndpoints Two-Lane Connector",
            ["TinyRustLM.Conversion"] = "TinyRustLM SLM2 Conversion Process Owner"
        };
        var expectedTerms = new Dictionary<string, string[]>
        {
            ["TinyRustLM.Abstractions"] = new[] { "SLM2", "ACG2", "Prompt2", "Tokenizer2", "Template2", "Sampling2" },
            ["TinyRustLM.Core"] = new[] { "15-symbol", "mixed-Q8", "SLM2", "ACG2", "raw terminal output" },
            ["TinyRustLM.P2P"] = new[] { "four-MiB", "fixed-piece", "create-only", "SLM2", "ACG2" },
            ["TinyRustLM.MemoryEndpoints"] = new[]
            {
                "MemoryEndpoints",
                "ecosystem-agent coordination",
                "TinyRustLM.com Connect user-memory plugin",
                "untrusted",
                "credential"
            },
            ["TinyRustLM.Conversion"] = new[] { "tinyrustlm-convert", "Qwen3", "mixed-Q8", "Tokenizer2", "create-only" }
        };

        foreach (var pair in expectedTerms)
        {
            var project = ProjectText(root, pair.Key);
            var document = ProjectDocument(root, pair.Key);
            Assert.Equal(expectedTitles[pair.Key], Assert.Single(document.Descendants("Title")).Value.Trim());
            foreach (var term in pair.Value)
            {
                Assert.Contains(term, project, StringComparison.OrdinalIgnoreCase);
            }

            Assert.Contains("<Title>", project, StringComparison.Ordinal);
            Assert.Contains("<Summary>", project, StringComparison.Ordinal);
            Assert.Contains("<Description>", project, StringComparison.Ordinal);
            Assert.Contains("<PackageTags>", project, StringComparison.Ordinal);
            Assert.Contains("<GenerateDocumentationFile>true</GenerateDocumentationFile>", project, StringComparison.Ordinal);
            Assert.DoesNotContain("UAIX.Browser", project, StringComparison.Ordinal);
        }

        foreach (var writerPath in new[] { "eng/write-package-audit.ps1", "eng/write-package-audit.sh" })
        {
            var writer = File.ReadAllText(Path.Combine(root, writerPath));
            foreach (var pair in expectedTitles)
            {
                Assert.Contains(pair.Key, writer, StringComparison.Ordinal);
                Assert.Contains(pair.Value, writer, StringComparison.Ordinal);
            }
            Assert.DoesNotContain("UAIX Browser", writer, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("title:exact-package-contract", writer, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void NuGetAndRustWorkspaceVersionsStayAligned()
    {
        var root = RepositoryRoot();
        var dotnetProps = XDocument.Load(Path.Combine(root, "dotnet/Directory.Build.props"));
        var dotnetVersion = dotnetProps.Descendants("Version").Select(node => node.Value.Trim()).FirstOrDefault();
        if (string.IsNullOrWhiteSpace(dotnetVersion))
        {
            var prefix = Assert.Single(dotnetProps.Descendants("VersionPrefix")).Value.Trim();
            var suffix = dotnetProps.Descendants("VersionSuffix").Select(node => node.Value.Trim()).FirstOrDefault();
            dotnetVersion = string.IsNullOrWhiteSpace(suffix) ? prefix : $"{prefix}-{suffix}";
        }

        var cargoVersion = WorkspacePackageVersion(File.ReadAllText(Path.Combine(root, "Cargo.toml")));
        Assert.Equal(cargoVersion, dotnetVersion);
        Assert.Matches("^0\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?$", dotnetVersion);
    }

    [Fact]
    public void CheckedInPublicApiBaselinesAreCompleteSortedAndShared()
    {
        var root = RepositoryRoot();
        var packageIds = DefaultPackageIds.Concat(OptionalPackageIds).ToArray();
        foreach (var packageId in packageIds)
        {
            var baselinePath = Path.Combine(root, "eng", "public-api", $"{packageId}.txt");
            Assert.True(File.Exists(baselinePath), baselinePath);
            var entries = File.ReadAllLines(baselinePath)
                .Where(line => !string.IsNullOrWhiteSpace(line) && !line.StartsWith('#'))
                .ToArray();

            Assert.NotEmpty(entries);
            Assert.Equal(entries.Order(StringComparer.Ordinal).Distinct(StringComparer.Ordinal), entries);
            Assert.Contains(entries, entry => entry.StartsWith("T:TinyRustLM.", StringComparison.Ordinal));
        }

        foreach (var writerPath in new[] { "eng/write-package-audit.ps1", "eng/write-package-audit.sh" })
        {
            var writer = File.ReadAllText(Path.Combine(root, writerPath));
            foreach (var packageId in packageIds)
            {
                Assert.Contains(packageId, writer, StringComparison.Ordinal);
                Assert.Contains("public-api", writer, StringComparison.Ordinal);
            }
        }
    }

    [Fact]
    public void PackageAuditWritersImplementTheSameCurrentFailClosedContract()
    {
        var root = RepositoryRoot();
        var writers = new[]
        {
            File.ReadAllText(Path.Combine(root, "eng/write-package-audit.ps1")),
            File.ReadAllText(Path.Combine(root, "eng/write-package-audit.sh"))
        };
        var requiredTerms = new[]
        {
            "tinyrustlm.nuget.package_audit.v1",
            "TinyRustLM.Abstractions",
            "TinyRustLM.Core",
            "TinyRustLM.P2P",
            "TinyRustLM.MemoryEndpoints",
            "TinyRustLM.Conversion",
            "tinyrustlm-convert",
            "SLM2",
            "ACG2",
            "Prompt2",
            "Tokenizer2",
            "Template2",
            "Sampling2",
            "missing_public_api_entries",
            "unexpected_public_api_entries",
            "unexpected_package_content_entries",
            "package_documentation_mismatches",
            "missing_dependency_entries",
            "unexpected_dependency_entries",
            "noncanonical_timestamp_entries",
            "absolute_path_matches",
            "required_native_rids",
            "status"
        };

        foreach (var writer in writers)
        {
            foreach (var term in requiredTerms)
            {
                Assert.Contains(term, writer, StringComparison.Ordinal);
            }

            Assert.DoesNotContain("tinyrustlm.nuget.package_audit.v0", writer, StringComparison.Ordinal);
            Assert.DoesNotMatch("TinyRustLM\\.Memory(?!Endpoints)", writer);
            Assert.DoesNotContain("TinySlm", writer, StringComparison.Ordinal);
            Assert.DoesNotContain("tinyrustlm-slm-pack", writer, StringComparison.Ordinal);
            Assert.DoesNotContain("MEMORY_HARNESS", writer, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void PackAndVerificationScriptsExecuteTheCanonicalAuditAndConsumerGate()
    {
        var root = RepositoryRoot();
        var powerShellPack = File.ReadAllText(Path.Combine(root, "eng/pack.ps1"));
        var bashPack = File.ReadAllText(Path.Combine(root, "eng/pack.sh"));
        Assert.Contains("IncludeOptionalMemoryEndpoints", powerShellPack, StringComparison.Ordinal);
        Assert.Contains("IncludePrivateConversion", powerShellPack, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_INCLUDE_OPTIONAL_MEMORY_ENDPOINTS", bashPack, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_INCLUDE_PRIVATE_CONVERSION", bashPack, StringComparison.Ordinal);

        var packScripts = new[] { powerShellPack, bashPack };
        foreach (var script in packScripts)
        {
            foreach (var packageId in DefaultPackageIds)
            {
                Assert.Contains(packageId, script, StringComparison.Ordinal);
            }

            Assert.Contains("TinyRustLM.PackageCanonicalizer", script, StringComparison.Ordinal);
            Assert.Contains("write-package-audit", script, StringComparison.Ordinal);
            Assert.Contains("verify-consumer", script, StringComparison.Ordinal);
            Assert.DoesNotContain("dotnet/TinyRustLM.sln", script, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotMatch("TinyRustLM\\.Memory(?!Endpoints)", script);
            Assert.DoesNotContain("tinyrustlm-slm-pack", script, StringComparison.Ordinal);
        }

        foreach (var verifierPath in new[] { "eng/verify-package.ps1", "eng/verify-package.sh" })
        {
            var verifier = File.ReadAllText(Path.Combine(root, verifierPath));
            Assert.Contains("pack.", verifier, StringComparison.Ordinal);
            Assert.Contains("required", verifier, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("native", verifier, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotMatch("TinyRustLM\\.Memory(?!Endpoints)", verifier);
            Assert.DoesNotContain("tinyrustlm-slm-pack", verifier, StringComparison.Ordinal);
        }

        var consumerProject = File.ReadAllText(Path.Combine(root, "eng/consumer-smoke/TinyRustLM.ConsumerSmoke.csproj"));
        foreach (var packageId in DefaultPackageIds.Concat(OptionalPackageIds))
        {
            Assert.Contains($"Include=\"{packageId}\"", consumerProject, StringComparison.Ordinal);
        }
        Assert.DoesNotContain("ProjectReference", consumerProject, StringComparison.Ordinal);
        Assert.Contains("[$(TinyRustLmConsumerPackageVersion)]", consumerProject, StringComparison.Ordinal);
        var consumerOwner = File.ReadAllText(Path.Combine(root, "eng/verify-consumer.js"));
        Assert.Contains("consumer-smoke/TinyRustLM.ConsumerSmoke.csproj", consumerOwner, StringComparison.Ordinal);
        Assert.Contains("canonical-operation-scratch.js", consumerOwner, StringComparison.Ordinal);
        Assert.Contains("BaseIntermediateOutputPath", consumerOwner, StringComparison.Ordinal);
        Assert.Contains("NUGET_PACKAGES", consumerOwner, StringComparison.Ordinal);
        var ci = File.ReadAllText(Path.Combine(root, ".github/workflows/ci.yml"));
        Assert.Contains("run: eng/verify-package.ps1\n", ci.Replace("\r\n", "\n", StringComparison.Ordinal), StringComparison.Ordinal);
        Assert.DoesNotContain("run: eng/verify-package.ps1 -IncludeOptionalMemoryEndpoints", ci, StringComparison.Ordinal);
        foreach (var consumerPath in new[] { "eng/verify-consumer.ps1", "eng/verify-consumer.sh" })
        {
            var consumer = File.ReadAllText(Path.Combine(root, consumerPath));
            Assert.Contains("verify-consumer.js", consumer, StringComparison.Ordinal);
            Assert.DoesNotContain("Copy-Item", consumer, StringComparison.Ordinal);
            Assert.DoesNotContain("mktemp", consumer, StringComparison.Ordinal);
            Assert.DoesNotContain("dotnet new", consumer, StringComparison.Ordinal);
            Assert.DoesNotContain("CONSUMER_CORE_PACKAGE_ID", consumer, StringComparison.Ordinal);
            Assert.DoesNotContain("CONSUMER_P2P_PACKAGE_ID", consumer, StringComparison.Ordinal);
            Assert.DoesNotContain("CONSUMER_CONVERSION_PACKAGE_ID", consumer, StringComparison.Ordinal);
        }

        var consumerProgram = File.ReadAllText(Path.Combine(root, "eng/consumer-smoke/Program.cs"));
        Assert.Contains("consumer-smoke-memory-endpoints-package-untrusted-offline", consumerProgram, StringComparison.Ordinal);
        Assert.Contains("consumer-smoke-conversion-package", consumerProgram, StringComparison.Ordinal);
    }

    [Fact]
    public void PublishAndFeedScriptsUseOnlyTheCurrentPublicPackageSet()
    {
        var root = RepositoryRoot();
        var paths = new[]
        {
            "eng/publish-nuget.ps1",
            "eng/publish-nuget.sh",
            "eng/verify-feed-current.ps1",
            "eng/verify-feed-current.sh",
            "eng/verify-feed-package-hashes.ps1",
            "eng/verify-feed-package-hashes.sh",
            "eng/audit-nuget-release-readiness.ps1",
            "eng/audit-nuget-release-readiness.sh"
        };

        foreach (var path in paths)
        {
            var script = File.ReadAllText(Path.Combine(root, path));
            foreach (var packageId in DefaultPackageIds)
            {
                Assert.Contains(packageId, script, StringComparison.Ordinal);
            }

            Assert.DoesNotMatch("TinyRustLM\\.Memory(?!Endpoints)", script);
            Assert.DoesNotContain("UAIX.Browser.Memory", script, StringComparison.Ordinal);
            Assert.DoesNotContain("TinySlm", script, StringComparison.Ordinal);
            Assert.DoesNotContain("tinyrustlm-slm-pack", script, StringComparison.Ordinal);
        }

        foreach (var publishPath in new[] { "eng/publish-nuget.ps1", "eng/publish-nuget.sh" })
        {
            var publish = File.ReadAllText(Path.Combine(root, publishPath));
            Assert.Contains("tinyrustlm.nuget.package_audit.v1", publish, StringComparison.Ordinal);
            Assert.Contains("package_audit_match", publish, StringComparison.Ordinal);
            Assert.Contains("SHA256SUMS", publish, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", publish, StringComparison.Ordinal);
            Assert.DoesNotContain("TinyRustLM.Conversion", publish, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void ReleaseWorkflowsUseTheCurrentRidAndPackageGraph()
    {
        var root = RepositoryRoot();
        var release = File.ReadAllText(Path.Combine(root, ".github/workflows/release-nuget.yml"));
        var ci = File.ReadAllText(Path.Combine(root, ".github/workflows/ci.yml"));
        var monitor = File.ReadAllText(Path.Combine(root, ".github/workflows/nuget-feed-monitor.yml"));

        foreach (var workflow in new[] { release, ci })
        {
            foreach (var rid in SupportedNativeRids)
            {
                Assert.Contains(rid, workflow, StringComparison.Ordinal);
            }
            foreach (var packageId in DefaultPackageIds)
            {
                Assert.Contains(packageId, workflow, StringComparison.Ordinal);
            }

            Assert.DoesNotContain("osx-x64", workflow, StringComparison.Ordinal);
            Assert.DoesNotContain("osx-arm64", workflow, StringComparison.Ordinal);
            Assert.DoesNotMatch("TinyRustLM\\.Memory(?!Endpoints)", workflow);
            Assert.DoesNotContain("tinyrustlm-slm-pack", workflow, StringComparison.Ordinal);
        }

        Assert.Contains("verify-package", release, StringComparison.Ordinal);
        Assert.Contains("publish-nuget", release, StringComparison.Ordinal);
        Assert.Contains("audit-nuget-release-readiness", release, StringComparison.Ordinal);
        Assert.Contains("verify-feed-current", monitor, StringComparison.Ordinal);
        Assert.Contains("verify-feed-package-hashes", monitor, StringComparison.Ordinal);
        Assert.DoesNotMatch("TinyRustLM\\.Memory(?!Endpoints)", monitor);
    }

    [Fact]
    public void CorePackageDeclaresExactlyTheSupportedNativeAssets()
    {
        var project = ProjectText(RepositoryRoot(), "TinyRustLM.Core");
        foreach (var entry in new[]
        {
            "runtimes\\win-x64\\native\\",
            "runtimes\\linux-x64\\native\\",
            "runtimes\\linux-arm64\\native\\"
        })
        {
            Assert.Contains(entry, project, StringComparison.Ordinal);
        }

        Assert.DoesNotContain("osx-x64", project, StringComparison.Ordinal);
        Assert.DoesNotContain("osx-arm64", project, StringComparison.Ordinal);
    }

    [Fact]
    public void ConversionPackageContainsOnlyCurrentConverterAssets()
    {
        var project = ProjectText(RepositoryRoot(), "TinyRustLM.Conversion");
        Assert.Contains("tinyrustlm-convert", project, StringComparison.Ordinal);
        foreach (var rid in SupportedNativeRids)
        {
            Assert.Contains(rid, project, StringComparison.Ordinal);
        }

        Assert.DoesNotContain("tinyrustlm-slm-pack", project, StringComparison.Ordinal);
        Assert.DoesNotContain("TinySlm", project, StringComparison.Ordinal);
        Assert.DoesNotContain("GGUF", project, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SamplesExerciseOnlyTheCanonicalCompositionRuntimeAndTransport()
    {
        var root = RepositoryRoot();
        var console = File.ReadAllText(Path.Combine(root, "dotnet/samples/TinyRustLM.ConsoleSample/Program.cs"));
        var p2p = File.ReadAllText(Path.Combine(root, "dotnet/samples/TinyRustLM.P2PShareSample/Program.cs"));

        foreach (var term in new[]
        {
            "TinyRustLmRuntimeFactory",
            "TinyRustLmActivationRequest",
            "SetTranscriptRevision",
            "BeginRequest",
            "Finish"
        })
        {
            Assert.Contains(term, console, StringComparison.Ordinal);
        }
        foreach (var term in new[] { "PrepareShareKit", "InspectManifest", "AssembleArtifact", "ForSlm2Model" })
        {
            Assert.Contains(term, p2p, StringComparison.Ordinal);
        }

        foreach (var sample in new[] { console, p2p })
        {
            Assert.DoesNotContain("TinySlm", sample, StringComparison.Ordinal);
            Assert.DoesNotContain("tinyrustlm-slm-pack", sample, StringComparison.Ordinal);
            Assert.DoesNotMatch("TinyRustLM\\.Memory(?!Endpoints)", sample);
        }
    }

    [Fact]
    public void OptionalMemoryEndpointsPackageIsAuthorizedPortableAndUntrusted()
    {
        var root = RepositoryRoot();
        var project = ProjectText(root, "TinyRustLM.MemoryEndpoints");
        var boundary = File.ReadAllText(Path.Combine(root, "docs/nuget/API_BOUNDARY.md"));
        var connector = File.ReadAllText(Path.Combine(root, "docs/nuget/MEMORY_ENDPOINTS_CONNECTOR.md"));

        Assert.Contains("optional", project, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("untrusted", project, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("authorized", boundary, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("strongly recommended", boundary, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("portable", boundary, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("untrusted", connector, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("unauthorized", boundary, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("disconnected", boundary, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("production ready", project, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void PackageDocumentationDescribesTheCurrentNoDebtReleaseBoundary()
    {
        var root = RepositoryRoot();
        var readme = File.ReadAllText(Path.Combine(root, "docs/nuget/README.md"));
        var security = File.ReadAllText(Path.Combine(root, "docs/nuget/PACKAGE_SECURITY.md"));
        var privateFeed = File.ReadAllText(Path.Combine(root, "docs/nuget/PRIVATE_FEED.md"));
        var boundary = File.ReadAllText(Path.Combine(root, "docs/nuget/API_BOUNDARY.md"));

        foreach (var document in new[] { readme, security, privateFeed, boundary })
        {
            foreach (var packageId in DefaultPackageIds)
            {
                Assert.Contains(packageId, document, StringComparison.Ordinal);
            }

            Assert.Contains("SLM2", document, StringComparison.Ordinal);
            Assert.DoesNotContain("TinySlmInspector", document, StringComparison.Ordinal);
            Assert.DoesNotContain("tinyrustlm-slm-pack", document, StringComparison.Ordinal);
            Assert.DoesNotContain("UAIX.Browser.Memory", document, StringComparison.Ordinal);
            Assert.DoesNotContain("product V2", document, StringComparison.OrdinalIgnoreCase);
        }

        Assert.Contains("There is no local `TinyRustLM.Memory` package", boundary, StringComparison.Ordinal);
        Assert.Contains("one prelaunch product", boundary, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("public readback", security, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("public readback", privateFeed, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void CurrentTransportAndValidationDocumentationMatchesTheSoleManagedSurface()
    {
        var root = RepositoryRoot();
        var p2p = File.ReadAllText(Path.Combine(root, "docs/nuget/P2P_SHARE_FLOW.md"));
        var validation = File.ReadAllText(Path.Combine(root, "docs/nuget/SLM_VALIDATION.md"));
        var companion = File.ReadAllText(Path.Combine(root, "docs/companion/README.md"));
        var transportAdr = File.ReadAllText(Path.Combine(
            root,
            "docs/architecture/adr/ADR-004-companion-transport.md"));

        foreach (var method in new[] { "PrepareShareKit", "InspectManifest", "AssembleArtifact" })
        {
            Assert.Contains(method, p2p, StringComparison.Ordinal);
        }
        foreach (var obsolete in new[]
        {
            "VerifySignedManifest",
            "ImportFromManifest",
            "ApplyReceivedAnnouncement",
            "InspectAnnouncementCatalog",
            "SLM1",
            "q4_0",
            "q5_0",
            "TinyRustLM.SeedHost"
        })
        {
            Assert.DoesNotContain(obsolete, p2p + validation + transportAdr, StringComparison.OrdinalIgnoreCase);
        }

        Assert.Contains("mixed-Q8 SLM2", validation, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm.companion.acquire.v2", companion, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm.companion.operation.v3", companion, StringComparison.Ordinal);
        Assert.Contains(
            "tinyrustlm.companion.execution-intent.v1",
            companion,
            StringComparison.Ordinal);
        Assert.Contains(
            "tinyrustlm.companion.source-acquisition-intent.v1",
            companion,
            StringComparison.Ordinal);
        Assert.Contains(
            "tinyrustlm.companion.source-acquisition-receipt.v1",
            companion,
            StringComparison.Ordinal);
        Assert.Contains(
            "tinyrustlm.companion.source-conversion-intent.v1",
            companion,
            StringComparison.Ordinal);
        Assert.Contains("ReconcileTerminal", companion, StringComparison.Ordinal);
        foreach (var obsolete in new[]
        {
            "tinyrustlm.companion.acquire.v1",
            "tinyrustlm.companion.operation.v1",
            "tinyrustlm.companion.operation.v2",
            "tinyrustlm.companion.loopback.operation-projection.v1"
        })
        {
            Assert.DoesNotContain(obsolete, companion, StringComparison.Ordinal);
        }
        Assert.Contains("Accepted", transportAdr, StringComparison.Ordinal);
        Assert.Contains("No current route table or port is release authority", transportAdr, StringComparison.Ordinal);
    }

    [Fact]
    public void ActivePackageAndReleaseSurfaceContainsNoObsoleteExecutableIdentity()
    {
        var root = RepositoryRoot();
        var paths = new[]
        {
            "dotnet/Directory.Build.props",
            "dotnet/src/TinyRustLM.Abstractions/TinyRustLM.Abstractions.csproj",
            "dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj",
            "dotnet/src/TinyRustLM.P2P/TinyRustLM.P2P.csproj",
            "dotnet/src/TinyRustLM.MemoryEndpoints/TinyRustLM.MemoryEndpoints.csproj",
            "dotnet/src/TinyRustLM.Conversion/TinyRustLM.Conversion.csproj",
            "eng/pack.ps1",
            "eng/pack.sh",
            "eng/verify-package.ps1",
            "eng/verify-package.sh",
            "eng/write-package-audit.ps1",
            "eng/write-package-audit.sh",
            "eng/publish-nuget.ps1",
            "eng/publish-nuget.sh",
            "eng/verify-feed-current.ps1",
            "eng/verify-feed-current.sh",
            "eng/verify-feed-package-hashes.ps1",
            "eng/verify-feed-package-hashes.sh",
            "eng/audit-nuget-release-readiness.ps1",
            "eng/audit-nuget-release-readiness.sh",
            "eng/verify-public-doc-sites.ps1",
            "eng/verify-public-doc-sites.sh",
            "README.md",
            ".github/workflows/ci.yml",
            ".github/workflows/release-nuget.yml",
            ".github/workflows/nuget-feed-monitor.yml"
        };
        var forbidden = new[]
        {
            "TinySlm",
            "tinyrustlm-slm-pack",
            "tinyrustlm-runtime-sdk",
            "generate_two_sentence_text",
            "generate_status_reason_json",
            "ACG1",
            ".acg1",
            "UAIX.Browser"
        };

        foreach (var path in paths)
        {
            var text = File.ReadAllText(Path.Combine(root, path));
            foreach (var token in forbidden)
            {
                Assert.DoesNotContain(token, text, StringComparison.OrdinalIgnoreCase);
            }
            Assert.DoesNotMatch("TinyRustLM\\.Memory(?!Endpoints)", text);
        }
    }

    private static string RepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, "Cargo.toml"))
                && File.Exists(Path.Combine(current.FullName, "dotnet", "TinyRustLM.sln")))
            {
                return current.FullName;
            }
            current = current.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate TinyRustLM repository root.");
    }

    private static string ProjectText(string root, string packageId) =>
        File.ReadAllText(Path.Combine(root, "dotnet", "src", packageId, $"{packageId}.csproj"));

    private static XDocument ProjectDocument(string root, string packageId) =>
        XDocument.Load(Path.Combine(root, "dotnet", "src", packageId, $"{packageId}.csproj"));

    private static void AssertProjectProperty(string root, string packageId, string propertyName, string expected)
    {
        var actual = ProjectDocument(root, packageId)
            .Descendants(propertyName)
            .Select(node => node.Value.Trim())
            .Single();
        Assert.Equal(expected, actual);
    }

    private static void AssertProjectReferences(string root, string packageId, params string[] expectedPackageIds)
    {
        var references = ProjectDocument(root, packageId)
            .Descendants("ProjectReference")
            .Select(node => Path.GetFileNameWithoutExtension(node.Attribute("Include")?.Value))
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Cast<string>()
            .Order(StringComparer.Ordinal)
            .ToArray();
        Assert.Equal(expectedPackageIds.Order(StringComparer.Ordinal), references);
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
            if (equalsIndex >= 0)
            {
                return line[(equalsIndex + 1)..].Trim().Trim('"');
            }
        }

        return string.Empty;
    }
}
