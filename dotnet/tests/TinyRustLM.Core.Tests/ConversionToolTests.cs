using System.Runtime.InteropServices;
using Xunit;

namespace TinyRustLM.Tests;

public sealed class ConversionToolTests
{
    [Theory]
    [InlineData(TinyRustLmConversionKind.Qwen3Safetensors, "fixture.slm2", "fixture-slm2")]
    [InlineData(TinyRustLmConversionKind.QwenTokenizer2, "fixture.tok2", "fixture-tokenizer2")]
    public async Task ConversionVerifiesStructuredSummaryAndPromotedBytes(
        TinyRustLmConversionKind kind,
        string outputName,
        string expectedText)
    {
        using var fixture = new ConversionFixture("pass", outputName);
        var result = await fixture.Tool().ConvertAsync(fixture.Request(kind));

        Assert.Equal(kind, result.Kind);
        Assert.Equal(fixture.OutputPath, result.ArtifactPath);
        Assert.Equal(expectedText, File.ReadAllText(result.ArtifactPath));
        Assert.True(File.Exists(result.ReceiptPath));
        Assert.Equal(64, result.ArtifactSha256.Length);
        Assert.Equal(64, result.SummarySha256.Length);
        Assert.True(result.ArtifactBytes > 0);
    }

    [Fact]
    public async Task ConverterPreservesOnlyExactBoundedFailureCode()
    {
        using var fixture = new ConversionFixture("error");
        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            fixture.Tool().ConvertAsync(fixture.Request()));
        Assert.Equal("qwen3-source-hash-mismatch", error.Code);

        fixture.SetScenario("malformed-error");
        error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            fixture.Tool().ConvertAsync(fixture.Request()));
        Assert.Equal("converter-process-failed", error.Code);
        Assert.DoesNotContain("secret", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("hash-mismatch", "converter-artifact-identity")]
    [InlineData("malformed-json", "converter-summary-json")]
    [InlineData("unexpected-stderr", "converter-unexpected-stderr")]
    public async Task ConverterRejectsDishonestOrMalformedSuccess(
        string scenario,
        string expectedCode)
    {
        using var fixture = new ConversionFixture(scenario);
        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            fixture.Tool().ConvertAsync(fixture.Request()));
        Assert.Equal(expectedCode, error.Code);
    }

    [Fact]
    public async Task ConverterKillsOutputFloodAndTimeout()
    {
        using var fixture = new ConversionFixture("oversized");
        var policy = new TinyRustLmConversionPolicy(TimeSpan.FromSeconds(10), 1024, 1024);
        var error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            fixture.Tool(policy).ConvertAsync(fixture.Request()));
        Assert.Equal("converter-output-limit", error.Code);

        fixture.SetScenario("hang");
        policy = new TinyRustLmConversionPolicy(TimeSpan.FromMilliseconds(100), 1024, 1024);
        error = await Assert.ThrowsAsync<TinyRustLmException>(() =>
            fixture.Tool(policy).ConvertAsync(fixture.Request()));
        Assert.Equal("converter-timeout", error.Code);
    }

    [Fact]
    public async Task ConverterHonorsCallerCancellationAndCreateOnlyOutput()
    {
        using var fixture = new ConversionFixture("hang");
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            fixture.Tool().ConvertAsync(fixture.Request(), cancellation.Token));

        fixture.SetScenario("pass");
        File.WriteAllText(fixture.OutputPath, "occupied");
        await Assert.ThrowsAsync<IOException>(() =>
            fixture.Tool().ConvertAsync(fixture.Request()));
    }

    private sealed class ConversionFixture : IDisposable
    {
        private readonly string _root;

        internal ConversionFixture(string scenario, string outputName = "fixture.slm2")
        {
            _root = Path.Combine(Path.GetTempPath(), $"tinyrustlm-conversion-{Guid.NewGuid():N}");
            Directory.CreateDirectory(_root);
            SourceDirectory = Path.Combine(_root, "source");
            Directory.CreateDirectory(SourceDirectory);
            SourceLockPath = Path.Combine(_root, "source-lock.json");
            OutputPath = Path.Combine(_root, outputName);
            SetScenario(scenario);
        }

        internal string SourceDirectory { get; }
        internal string SourceLockPath { get; }
        internal string OutputPath { get; }

        internal void SetScenario(string scenario)
        {
            File.WriteAllText(SourceLockPath, scenario);
            foreach (var path in new[] { OutputPath, $"{OutputPath}.conversion-receipt.json" })
            {
                if (File.Exists(path))
                {
                    File.Delete(path);
                }
            }
        }

        internal TinyRustLmConversionRequest Request(
            TinyRustLmConversionKind kind = TinyRustLmConversionKind.Qwen3Safetensors) =>
            new(kind, SourceLockPath, SourceDirectory, OutputPath);

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
}
