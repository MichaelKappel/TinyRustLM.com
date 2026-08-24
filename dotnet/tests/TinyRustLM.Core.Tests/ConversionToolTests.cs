using System.Runtime.InteropServices;
using System.Security.Cryptography;
using Xunit;

namespace TinyRustLM.Tests;

public sealed class ConversionToolTests
{
    [Fact]
    public async Task CompleteCompositionVerifiesSummaryReceiptLineageAndAllSixArtifacts()
    {
        using var fixture = new ConversionFixture("pass");
        var result = await fixture.Tool().ConvertCompositionAsync(fixture.Request());

        Assert.Equal("tinyrustlm.qwen3_composition_conversion_cli_summary.v1", result.Schema);
        Assert.StartsWith("qwen3-composition-", result.OperationId, StringComparison.Ordinal);
        Assert.Equal(fixture.OutputRoot, result.OutputRoot);
        Assert.Equal(
            Path.Combine(fixture.OutputRoot, "composition.conversion-receipt.json"),
            result.ReceiptPath);
        Assert.Equal(64, result.ReceiptSha256.Length);
        Assert.Equal(64, result.SummarySha256.Length);
        Assert.Equal(64, result.GraphIdentitySha256.Length);
        Assert.Equal(Sha256File(fixture.ModelSourceLockPath), result.ModelSourceLockSha256);
        Assert.Equal(Sha256File(fixture.TokenizerSourceLockPath), result.TokenizerSourceLockSha256);
        Assert.Equal("fixture-1", result.ConverterVersion);
        Assert.Equal(64, result.ConverterExecutableSha256.Length);
        Assert.Equal(
            "source-native-browser-numerical-parity-untouched-quality-and-product-chat",
            result.RequiredNextGate);

        var artifacts = result.Artifacts.InCanonicalOrder();
        Assert.Equal(6, artifacts.Count);
        Assert.Equal(
            ["slm2", "tokenizer2", "template2", "sampling2", "prompt2", "acg2"],
            artifacts.Select(value => value.Kind));
        Assert.Equal(
            [
                "model.slm2",
                "tokenizer.tokenizer2",
                "template.template2",
                "sampling.sampling2",
                "prompt.prompt2",
                "composition.acg2"
            ],
            artifacts.Select(value => value.FileName));
        Assert.All(artifacts, artifact =>
        {
            Assert.True(artifact.ByteLength > 0);
            Assert.Equal(64, artifact.Sha256.Length);
            Assert.True(File.Exists(artifact.Path));
        });
    }

    [Fact]
    public async Task ConverterPreservesOnlyExactBoundedFailureCode()
    {
        using var fixture = new ConversionFixture("error");
        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            fixture.Tool().ConvertCompositionAsync(fixture.Request()));
        Assert.Equal("qwen3-source-hash-mismatch", error.Code);

        fixture.SetScenario("malformed-error");
        error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            fixture.Tool().ConvertCompositionAsync(fixture.Request()));
        Assert.Equal("converter-process-failed", error.Code);
        Assert.DoesNotContain("secret", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("hash-mismatch", "converter-artifact-identity")]
    [InlineData("receipt-hash-mismatch", "converter-receipt-artifacts")]
    [InlineData("source-hash-mismatch", "converter-receipt-contract")]
    [InlineData("malformed-json", "converter-summary-json")]
    [InlineData("duplicate-summary", "converter-summary-json")]
    [InlineData("unknown-summary", "converter-summary-json")]
    [InlineData("duplicate-receipt", "converter-receipt-json")]
    [InlineData("unknown-receipt", "converter-receipt-json")]
    [InlineData("unexpected-stderr", "converter-unexpected-stderr")]
    [InlineData("extra-file", "converter-output-inventory")]
    [InlineData("missing-receipt", "converter-output-inventory")]
    public async Task ConverterRejectsDishonestMalformedOrIncompleteSuccess(
        string scenario,
        string expectedCode)
    {
        using var fixture = new ConversionFixture(scenario);
        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            fixture.Tool().ConvertCompositionAsync(fixture.Request()));
        Assert.Equal(expectedCode, error.Code);
    }

    [Fact]
    public async Task ConverterKillsOutputFloodAndTimeoutWithoutDeletingEvidence()
    {
        using var fixture = new ConversionFixture("oversized");
        var policy = new TinyRustLmConversionPolicy(TimeSpan.FromSeconds(10), 1024, 1024);
        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            fixture.Tool(policy).ConvertCompositionAsync(fixture.Request()));
        Assert.Equal("converter-output-limit", error.Code);

        fixture.SetScenario("hang");
        policy = new TinyRustLmConversionPolicy(TimeSpan.FromMilliseconds(100), 1024, 1024);
        error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            fixture.Tool(policy).ConvertCompositionAsync(fixture.Request()));
        Assert.Equal("converter-timeout", error.Code);
        Assert.Equal(
            "preserved\n",
            File.ReadAllText(Path.Combine(fixture.OutputRoot, "composition.attempt.json")));
    }

    [Fact]
    public async Task ConverterHonorsCancellationPreservesEvidenceAndNeverResumesTerminalRoot()
    {
        using var fixture = new ConversionFixture("hang");
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            fixture.Tool().ConvertCompositionAsync(fixture.Request(), cancellation.Token));
        Assert.True(Directory.Exists(fixture.OutputRoot));
        Assert.True(File.Exists(Path.Combine(fixture.OutputRoot, "composition.attempt.json")));

        await Assert.ThrowsAsync<IOException>(() =>
            fixture.Tool().ConvertCompositionAsync(fixture.Request()));
    }

    [Fact]
    public void ManagedSurfaceHasNoComponentConversionSuccessApi()
    {
        var assembly = typeof(TinyRustLmConversionTool).Assembly;
        Assert.Null(assembly.GetType("TinyRustLM.TinyRustLmConversionKind", throwOnError: false));
        Assert.DoesNotContain(
            typeof(TinyRustLmConversionTool).GetMethods(),
            method => method.Name == "ConvertAsync");
        Assert.Contains(
            typeof(TinyRustLmConversionTool).GetMethods(),
            method => method.Name == nameof(TinyRustLmConversionTool.ConvertCompositionAsync));
    }

    [Theory]
    [InlineData("model")]
    [InlineData("tokenizer")]
    [InlineData("profile")]
    public async Task ConverterRejectsRequestIdentityDriftBeforeStartingProcess(string identity)
    {
        using var fixture = new ConversionFixture("pass");
        var request = fixture.Request();
        request = identity switch
        {
            "model" => request with { ModelSourceLockSha256 = new string('0', 64) },
            "tokenizer" => request with { TokenizerSourceLockSha256 = new string('0', 64) },
            "profile" => request with { CompositionProfileSha256 = new string('0', 64) },
            _ => throw new InvalidOperationException()
        };
        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            fixture.Tool().ConvertCompositionAsync(request));
        Assert.Equal($"converter-{identity}-source-lock-identity".Replace(
            "profile-source-lock",
            "composition-profile",
            StringComparison.Ordinal), error.Code);
        Assert.False(Directory.Exists(fixture.OutputRoot));
    }

    private sealed class ConversionFixture : IDisposable
    {
        private readonly string _root;

        internal ConversionFixture(string scenario)
        {
            _root = Path.Combine(Path.GetTempPath(), $"tinyrustlm-conversion-{Guid.NewGuid():N}");
            Directory.CreateDirectory(_root);
            ModelSourceDirectory = Path.Combine(_root, "model-source");
            Directory.CreateDirectory(ModelSourceDirectory);
            TokenizerSourceDirectory = Path.Combine(_root, "tokenizer-source");
            Directory.CreateDirectory(TokenizerSourceDirectory);
            ModelSourceLockPath = Path.Combine(_root, "model-source-lock.json");
            TokenizerSourceLockPath = Path.Combine(_root, "tokenizer-source-lock.json");
            OutputRoot = Path.Combine(_root, "composition-output");
            SetScenario(scenario);
        }

        internal string ModelSourceDirectory { get; }
        internal string ModelSourceLockPath { get; }
        internal string TokenizerSourceDirectory { get; }
        internal string TokenizerSourceLockPath { get; }
        internal string OutputRoot { get; }

        internal void SetScenario(string scenario)
        {
            if (Directory.Exists(OutputRoot))
            {
                Directory.Delete(OutputRoot, recursive: true);
            }
            File.WriteAllText(ModelSourceLockPath, scenario);
            File.WriteAllText(TokenizerSourceLockPath, "fixture-tokenizer-lock");
        }

        internal TinyRustLmCompositionConversionRequest Request() =>
            new(
                ModelSourceLockPath,
                Sha256File(ModelSourceLockPath),
                ModelSourceDirectory,
                TokenizerSourceLockPath,
                Sha256File(TokenizerSourceLockPath),
                TokenizerSourceDirectory,
                TinyRustLmConversionTool.CompositionProfileSha256,
                OutputRoot);

        internal TinyRustLmConversionTool Tool(TinyRustLmConversionPolicy? policy = null) =>
            new(FixtureToolPath(), policy);

        public void Dispose()
        {
            if (Directory.Exists(_root))
            {
                Directory.Delete(_root, recursive: true);
            }
        }

        private static string FixtureToolPath()
        {
            var configuration = new DirectoryInfo(AppContext.BaseDirectory).Parent?.Name
                ?? throw new InvalidOperationException("Cannot determine test configuration.");
            var fileName = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
                ? "TinyRustLM.ConversionFixtureTool.exe"
                : "TinyRustLM.ConversionFixtureTool";
            return Path.Combine(
                RepositoryRoot(),
                "dotnet",
                "tools",
                "TinyRustLM.ConversionFixtureTool",
                "bin",
                configuration,
                "net8.0",
                fileName);
        }

        private static string RepositoryRoot()
        {
            var current = new DirectoryInfo(AppContext.BaseDirectory);
            while (current is not null)
            {
                if (File.Exists(Path.Combine(current.FullName, "Cargo.toml")) &&
                    File.Exists(Path.Combine(current.FullName, "dotnet", "TinyRustLM.sln")))
                {
                    return current.FullName;
                }
                current = current.Parent;
            }
            throw new DirectoryNotFoundException("Cannot locate repository root.");
        }
    }

    private static string Sha256File(string path)
    {
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
    }
}
