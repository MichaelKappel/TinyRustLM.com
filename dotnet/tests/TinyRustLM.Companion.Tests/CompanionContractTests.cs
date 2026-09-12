using System.Security.Cryptography;
using System.Text.Json;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionContractTests
{
    [Fact]
    public void SourcePayloadInventoryIdentityMatchesPinnedSourceLock()
    {
        var bytes = File.ReadAllBytes(Path.Combine(
            AppContext.BaseDirectory,
            "qwen3-0.6b-base-source-lock.v2.json"));
        Assert.Equal(
            CompanionSourceDescriptor.ModelSourceLockSha256,
            Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());

        using var document = JsonDocument.Parse(bytes);
        var root = document.RootElement;
        Assert.Equal(CompanionSourceDescriptor.Repository, root.GetProperty("modelId").GetString());
        Assert.Equal(CompanionSourceDescriptor.Revision, root.GetProperty("revision").GetString());
        var members = root.GetProperty("files")
            .EnumerateObject()
            .Select(static property => new CompanionSourcePayloadMember(
                property.Value.GetProperty("path").GetString()!,
                property.Value.GetProperty("byteLength").GetUInt64(),
                property.Value.GetProperty("sha256").GetString()!))
            .ToArray();

        Assert.Equal(CompanionSourceDescriptor.FileCount, (uint)members.Length);
        Assert.Equal(
            CompanionSourceDescriptor.PayloadBytes,
            members.Aggregate(0UL, static (total, member) => checked(total + member.ByteLength)));
        Assert.Equal(
            CompanionSourceDescriptor.PayloadInventorySha256,
            CompanionSourcePayloadInventory.ComputeSha256(members));
        Assert.Equal(
            CompanionSourceDescriptor.PayloadInventorySha256,
            CompanionSourcePayloadInventory.ComputeSha256(members.AsEnumerable().Reverse()));
    }

    [Fact]
    public void OperationIdentityIsDeterministicAndBindsExplicitAttempt()
    {
        var request = Request();
        var first = CompanionContract.OperationId(request);
        var second = CompanionContract.OperationId(request);
        var nextAttempt = CompanionContract.OperationId(request with
        {
            AttemptId = new string('b', 32)
        });

        Assert.Matches("^[0-9a-f]{64}$", first);
        Assert.Equal(first, second);
        Assert.NotEqual(first, nextAttempt);
    }

    /// <summary>The corrected descriptor must reject the obsolete acquisition identity.</summary>
    [Fact]
    public void RequestRejectsHistoricalSourceClosureAfterLicenseCorrection()
    {
        var historical = Request() with
        {
            ModelSourceLockSha256 = "e24bf9d95a5631e0b7c44c192e4ec6b7ec4b8793e1597f9dad99f1257ecf582d",
            MaximumSourceBytes = 1_519_207_688
        };
        var error = Assert.Throws<CompanionContractException>(() =>
            CompanionContract.ValidateAndNormalize(historical));
        Assert.Equal("acquire-source-unsupported", error.Code);
    }

    /// <summary>Compiled transport members must match the exact embedded source lock.</summary>
    [Fact]
    public void CompiledAcquisitionMembersMatchEmbeddedSourceLock()
    {
        CompanionBuiltInSourceAssets.Validate();
        using var document = JsonDocument.Parse(CompanionBuiltInSourceAssets.ModelLockBytes);
        var files = document.RootElement.GetProperty("files").EnumerateObject()
            .Select(static value => value.Value)
            .ToDictionary(static value => value.GetProperty("path").GetString()!, StringComparer.Ordinal);
        Assert.Equal(CompanionSourceDescriptor.FileCount, (uint)files.Count);
        foreach (var member in CompanionSourceAcquisition.Files)
        {
            Assert.Equal(member.ByteLength, files[member.Path].GetProperty("byteLength").GetUInt64());
            Assert.Equal(member.Sha256, files[member.Path].GetProperty("sha256").GetString());
        }
    }

    [Fact]
    public void RequestRejectsMalformedAttemptIdentity()
    {
        var request = Request() with { AttemptId = new string('A', 32) };
        var error = Assert.Throws<CompanionContractException>(() =>
            CompanionContract.ValidateAndNormalize(request));
        Assert.Equal("acquire-attempt-id", error.Code);
    }

    [Fact]
    public void RequestRequiresExplicitSourceAcquisitionApproval()
    {
        var request = Request() with { SourceAcquisitionApproved = false };
        var error = Assert.Throws<CompanionContractException>(() =>
            CompanionContract.ValidateAndNormalize(request));
        Assert.Equal("acquire-source-approval", error.Code);
    }

    [Theory]
    [InlineData("model")]
    [InlineData("repository")]
    [InlineData("revision")]
    [InlineData("model-lock")]
    [InlineData("tokenizer-lock")]
    [InlineData("composition-profile")]
    [InlineData("source-bytes")]
    public void RequestRejectsEverySourceDescriptorDrift(string field)
    {
        var request = field switch
        {
            "model" => Request() with { ModelId = "qwen3-1.7b" },
            "repository" => Request() with { SourceRepository = "Qwen/Qwen3-1.7B" },
            "revision" => Request() with { SourceRevision = new string('1', 40) },
            "model-lock" => Request() with { ModelSourceLockSha256 = Digest('1') },
            "tokenizer-lock" => Request() with { TokenizerSourceLockSha256 = Digest('2') },
            "composition-profile" => Request() with { CompositionProfileSha256 = Digest('3') },
            "source-bytes" => Request() with
            {
                MaximumSourceBytes = CompanionSourceDescriptor.PayloadBytes + 1
            },
            _ => throw new ArgumentOutOfRangeException(nameof(field))
        };
        var error = Assert.Throws<CompanionContractException>(() =>
            CompanionContract.ValidateAndNormalize(request));
        Assert.Equal("acquire-source-unsupported", error.Code);
    }

    [Fact]
    public void RequestRejectsUnknownAcquisitionRoute()
    {
        var request = Request() with { Route = (CompanionAcquisitionRoute)99 };
        var error = Assert.Throws<CompanionContractException>(() =>
            CompanionContract.ValidateAndNormalize(request));
        Assert.Equal("acquire-route", error.Code);
    }

    [Fact]
    public void AvailableArtifactSetRequiresAllExactCompositionMembers()
    {
        var invalid = Artifacts() with
        {
            Prompt = new CompanionArtifact("prompt1", ContentId('f'), Digest('f'), 32)
        };
        var error = Assert.Throws<CompanionContractException>(() =>
            CompanionContract.ValidateArtifactSet(invalid));
        Assert.Equal("artifact-prompt", error.Code);
    }

    [Fact]
    public void ArtifactIdentityMustBeThePrefixedContentDigest()
    {
        var baseline = Artifacts();
        var invalid = baseline with
        {
            Model = baseline.Model with { ArtifactId = $"sha256:{Digest('f')}" }
        };

        var error = Assert.Throws<CompanionContractException>(() =>
            CompanionContract.ValidateArtifactSet(invalid));

        Assert.Equal("artifact-model", error.Code);
    }

    [Fact]
    public void ArtifactSetRejectsPerMemberAndAggregateResourceOverflow()
    {
        var memberOverflow = Artifacts() with
        {
            Model = Artifacts().Model with
            {
                ByteCount = CompanionContract.MaximumArtifactBytes + 1
            }
        };
        var memberError = Assert.Throws<CompanionContractException>(() =>
            CompanionContract.ValidateArtifactSet(memberOverflow));
        Assert.Equal("artifact-model", memberError.Code);

        var large = CompanionContract.MaximumCompositionBytes / 6 + 1;
        var baseline = Artifacts();
        var aggregateOverflow = baseline with
        {
            Composition = baseline.Composition with { ByteCount = large },
            Model = baseline.Model with { ByteCount = large },
            Tokenizer = baseline.Tokenizer with { ByteCount = large },
            Template = baseline.Template with { ByteCount = large },
            Sampling = baseline.Sampling with { ByteCount = large },
            Prompt = baseline.Prompt with { ByteCount = large }
        };
        var aggregateError = Assert.Throws<CompanionContractException>(() =>
            CompanionContract.ValidateArtifactSet(aggregateOverflow));
        Assert.Equal("artifact-total", aggregateError.Code);
    }

    internal static CompanionAcquireRequest Request() => new(
        CompanionContract.AcquisitionRequestSchema,
        new string('a', 32),
        CompanionAcquisitionRoute.Source,
        CompanionSourceDescriptor.ModelId,
        CompanionSourceDescriptor.Repository,
        CompanionSourceDescriptor.Revision,
        CompanionSourceDescriptor.ModelSourceLockSha256,
        CompanionSourceDescriptor.TokenizerSourceLockSha256,
        CompanionSourceDescriptor.CompositionProfileSha256,
        SourceAcquisitionApproved: true,
        MaximumSourceBytes: CompanionSourceDescriptor.PayloadBytes);

    internal static CompanionArtifactSet Artifacts() => new(
        new CompanionArtifact("acg2", ContentId('a'), Digest('a'), 896),
        new CompanionArtifact("slm2", ContentId('b'), Digest('b'), 1_000_000),
        new CompanionArtifact("tokenizer2", ContentId('c'), Digest('c'), 7_000_000),
        new CompanionArtifact("template2", ContentId('d'), Digest('d'), 1_024),
        new CompanionArtifact("sampling2", ContentId('e'), Digest('e'), 512),
        new CompanionArtifact("prompt2", ContentId('f'), Digest('f'), 512));

    internal static string Digest(char value) => new(value, 64);

    internal static string ContentId(char value) => $"sha256:{new string(value, 64)}";
}
