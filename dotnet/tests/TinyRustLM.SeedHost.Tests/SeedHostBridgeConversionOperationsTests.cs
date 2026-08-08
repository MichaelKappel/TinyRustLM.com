using TinyRustLM.SeedHost;
using Xunit;

namespace TinyRustLM.SeedHost.Tests;

public sealed class SeedHostBridgeConversionOperationsTests
{
    [Theory]
    [InlineData("https://huggingface.co/Qwen/Qwen3-0.6B/resolve/0123456789abcdef0123456789abcdef01234567/model.safetensors")]
    [InlineData("https://cdn-lfs.huggingface.co/object")]
    [InlineData("https://cas-bridge.xethub.hf.co/object")]
    public void TrustedSourceUriAcceptsOnlyOfficialHttpsAuthorities(string value)
    {
        Assert.True(SeedHostBridgeConversionOperations.IsTrustedSourceUri(new Uri(value)));
    }

    [Theory]
    [InlineData("http://huggingface.co/model")]
    [InlineData("https://huggingface.co.example.invalid/model")]
    [InlineData("https://hf.co.example.invalid/model")]
    [InlineData("https://huggingface.co:444/model")]
    [InlineData("https://user@huggingface.co/model")]
    [InlineData("https://example.invalid/model")]
    public void TrustedSourceUriRejectsDowngradesLookalikesAndUnexpectedPorts(string value)
    {
        Assert.False(SeedHostBridgeConversionOperations.IsTrustedSourceUri(new Uri(value)));
    }

    [Fact]
    public void OwnedPathComparisonMatchesHostFileSystemCaseRules()
    {
        var root = OperatingSystem.IsWindows()
            ? @"C:\TinyRustLM\Owned\"
            : "/tmp/TinyRustLM/Owned/";
        var sameCaseChild = OperatingSystem.IsWindows()
            ? @"C:\TinyRustLM\Owned\output\model.slm"
            : "/tmp/TinyRustLM/Owned/output/model.slm";
        var differentCaseSibling = OperatingSystem.IsWindows()
            ? @"C:\tinyrustlm\owned\output\model.slm"
            : "/tmp/tinyrustlm/owned/output/model.slm";

        Assert.True(SeedHostBridgeConversionOperations.IsOwnedFullPath(root, sameCaseChild));
        Assert.Equal(
            OperatingSystem.IsWindows(),
            SeedHostBridgeConversionOperations.IsOwnedFullPath(root, differentCaseSibling));
    }
}
