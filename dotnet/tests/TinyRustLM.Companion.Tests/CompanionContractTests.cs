using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionContractTests
{
    [Fact]
    public void OperationIdentityIsDeterministicAndBindsPeerPriority()
    {
        var request = Request(
            new CompanionPeerCandidate("https://peer-a.example/models/qwen/acg2.json", ContentId('a')),
            new CompanionPeerCandidate("https://peer-b.example/models/qwen/acg2.json", ContentId('b')));
        var first = CompanionContract.OperationId(request);
        var second = CompanionContract.OperationId(request);
        var reordered = CompanionContract.OperationId(request with
        {
            PeerCandidates = request.PeerCandidates.Reverse().ToArray()
        });

        Assert.Matches("^[0-9a-f]{64}$", first);
        Assert.Equal(first, second);
        Assert.NotEqual(first, reordered);
    }

    [Theory]
    [InlineData("http://peer.example/model.json", "acquire-peer-uri")]
    [InlineData("https://127.0.0.1/model.json", "acquire-peer-ip-literal")]
    [InlineData("https://peer.example/model.json?token=secret", "acquire-peer-uri")]
    [InlineData("https://user:secret@peer.example/model.json", "acquire-peer-uri")]
    public void PeerUrisFailClosed(string uri, string code)
    {
        var request = Request(new CompanionPeerCandidate(uri, ContentId('a')));
        var error = Assert.Throws<CompanionContractException>(() =>
            CompanionContract.ValidateAndNormalize(request));
        Assert.Equal(code, error.Code);
    }

    [Fact]
    public void RequestRequiresAnAuthorizedAcquisitionBranch()
    {
        var request = Request() with { SourceAcquisitionApproved = false };
        var error = Assert.Throws<CompanionContractException>(() =>
            CompanionContract.ValidateAndNormalize(request));
        Assert.Equal("acquire-no-authorized-branch", error.Code);
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

    internal static CompanionAcquireRequest Request(params CompanionPeerCandidate[] candidates) => new(
        CompanionContract.AcquisitionRequestSchema,
        "qwen3-0.6b",
        "Qwen/Qwen3-0.6B",
        new string('1', 40),
        Digest('2'),
        Digest('3'),
        Digest('4'),
        SourceAcquisitionApproved: true,
        MaximumSourceBytes: 4_000_000_000,
        candidates);

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
