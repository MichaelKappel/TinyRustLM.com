using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionDirectCompositionSeedDescriptorMaterializerTests : IDisposable
{
    private const string RustAcceptedDescriptor =
        "{\"schema\":\"tinyrustlm.direct-composition-seed/1\"," +
        "\"protocol\":\"tinyrustlm.direct-composition-http.v1\"," +
        "\"compositionProfile\":\"org.minimodel.acg2/2.0\"," +
        "\"compositionProfileSha256\":" +
        "\"944ed9b5b0ee2605ebb9ac13f2e5388c181bc857fdbfc082e62e9ae7b07c79be\"," +
        "\"compositionId\":" +
        "\"sha256:be13acdcbdd3727d7bcebf92b9776f7fa71f18ca04c49772cf84136e76b6bef4\"," +
        "\"members\":[" +
        "{\"name\":\"model.slm2\",\"bytes\":25," +
        "\"sha256\":\"79c0557d594cfbfa350b9229f2ee3f2a7de36fc3e872b4469fffdab52ebe0541\"}," +
        "{\"name\":\"tokenizer.tokenizer2\",\"bytes\":29," +
        "\"sha256\":\"ccb331f843c06782ef116c10571ce940825bfb77e5073a1d01740129aced6558\"}," +
        "{\"name\":\"template.template2\",\"bytes\":28," +
        "\"sha256\":\"4b0971c1dc6c279edef4c7e6de30186a1a44621c8bbffa19893389eee1744779\"}," +
        "{\"name\":\"sampling.sampling2\",\"bytes\":28," +
        "\"sha256\":\"ba0f4afc1f84468dd4dd6360ff8bd3ce185971bf20e280625f29c11e8ae0c7df\"}," +
        "{\"name\":\"prompt.prompt2\",\"bytes\":26," +
        "\"sha256\":\"e4953b0531b7247be851ade7b63d2eccbcc439a13f93f5535a807916591369d2\"}," +
        "{\"name\":\"composition.acg2\",\"bytes\":896," +
        "\"sha256\":\"ea016b755ed89dcd4b72a826b68ea42b1da5bbca1dec050441b2f1b199be4a97\"}]" +
        "}\n";

    private readonly CanonicalTestScratch _scratch = new("seed");
    private string _parent => _scratch.Path;

    [Fact]
    public async Task AvailableGraphClosedOperationWritesTheRustAcceptedDescriptorByteExactly()
    {
        using var fixture = Fixture("rust-seed-pass");
        var available = await fixture.CreateAvailableAsync();
        var materializer = Materializer(fixture);

        var result = await materializer.MaterializeAsync(available.OperationId);

        var expected = Encoding.UTF8.GetBytes(RustAcceptedDescriptor);
        var observed = File.ReadAllBytes(result.DescriptorPath);
        Assert.Equal(expected, observed);
        Assert.Equal(available.OperationId, result.OperationId);
        Assert.Equal(
            "sha256:be13acdcbdd3727d7bcebf92b9776f7fa71f18ca04c49772cf84136e76b6bef4",
            result.CompositionId);
        Assert.Equal(checked((ulong)expected.LongLength), result.DescriptorBytes);
        Assert.Equal(Sha256(expected), result.DescriptorSha256);
        Assert.Equal(ExpectedPath(fixture, available.OperationId), result.DescriptorPath);
        Assert.DoesNotContain(fixture.Parent, RustAcceptedDescriptor, StringComparison.Ordinal);
    }

    [Fact]
    public async Task TrueMemberDigestMutationIsTypedAndWritesNoDescriptor()
    {
        using var fixture = Fixture("rust-seed-pass");
        var available = await fixture.CreateAvailableAsync();
        var path = Path.Combine(fixture.OutputRoot, "model.slm2");
        var bytes = File.ReadAllBytes(path);
        bytes[0] ^= 0x7f;
        File.WriteAllBytes(path, bytes);
        var materializer = Materializer(fixture);

        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedException>(() =>
            materializer.MaterializeAsync(available.OperationId));

        Assert.Equal("direct-composition-seed-identity-drift", error.Code);
        Assert.False(File.Exists(ExpectedPath(fixture, available.OperationId)));
    }

    [Theory]
    [InlineData(CompanionOperationState.Queued)]
    [InlineData(CompanionOperationState.Cancelled)]
    [InlineData(CompanionOperationState.Rejected)]
    public async Task PendingCancelledAndRejectedOperationsCannotMaterialize(
        CompanionOperationState state)
    {
        using var fixture = Fixture("rust-seed-pass");
        var operation = fixture.CreateQueued();
        if (state != CompanionOperationState.Queued)
        {
            operation = fixture.Journal.Advance(
                operation.OperationId,
                state,
                CompanionAcquisitionRoute.Source,
                errorCode: state == CompanionOperationState.Rejected ? "test-rejected" : null);
        }
        var materializer = Materializer(fixture);

        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedException>(() =>
            materializer.MaterializeAsync(operation.OperationId));

        Assert.Equal("direct-composition-seed-operation-not-available", error.Code);
        Assert.False(File.Exists(ExpectedPath(fixture, operation.OperationId)));
    }

    [Theory]
    [InlineData("extra")]
    [InlineData("missing")]
    [InlineData("unknown")]
    public async Task ExtraMissingAndUnknownOutputMembersFailClosed(string mutation)
    {
        using var fixture = Fixture("rust-seed-pass");
        var available = await fixture.CreateAvailableAsync();
        switch (mutation)
        {
            case "extra":
                File.WriteAllText(Path.Combine(fixture.OutputRoot, "unknown.member"), "x");
                break;
            case "missing":
                File.Delete(Path.Combine(fixture.OutputRoot, "prompt.prompt2"));
                break;
            case "unknown":
                File.Move(
                    Path.Combine(fixture.OutputRoot, "sampling.sampling2"),
                    Path.Combine(fixture.OutputRoot, "unknown.sampling2"));
                break;
            default:
                throw new InvalidOperationException(mutation);
        }
        var materializer = Materializer(fixture);

        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedException>(() =>
            materializer.MaterializeAsync(available.OperationId));

        Assert.Equal("direct-composition-seed-identity-drift", error.Code);
        Assert.False(File.Exists(ExpectedPath(fixture, available.OperationId)));
    }

    [Fact]
    public async Task ManagedPassWithNonAcg2CompositionBytesCannotMaterialize()
    {
        using var fixture = Fixture("pass");
        var available = await fixture.CreateAvailableAsync();
        var materializer = Materializer(fixture);

        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedException>(() =>
            materializer.MaterializeAsync(available.OperationId));

        Assert.Equal("direct-composition-seed-identity-drift", error.Code);
        Assert.False(File.Exists(ExpectedPath(fixture, available.OperationId)));
    }

    [Fact]
    public async Task ReparseMemberPathCannotMaterialize()
    {
        using var fixture = Fixture("rust-seed-pass");
        var available = await fixture.CreateAvailableAsync();
        var memberPath = Path.Combine(fixture.OutputRoot, "model.slm2");
        var targetPath = Path.Combine(fixture.Parent, "model-link-target.slm2");
        File.Copy(memberPath, targetPath);
        File.Delete(memberPath);
        _ = File.CreateSymbolicLink(memberPath, targetPath);
        var materializer = Materializer(fixture);

        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedException>(() =>
            materializer.MaterializeAsync(available.OperationId));

        Assert.Equal("direct-composition-seed-identity-drift", error.Code);
        Assert.False(File.Exists(ExpectedPath(fixture, available.OperationId)));
    }

    [Fact]
    public async Task ExistingDescriptorIsNeverOverwritten()
    {
        using var fixture = Fixture("rust-seed-pass");
        var available = await fixture.CreateAvailableAsync();
        var materializer = Materializer(fixture);
        var first = await materializer.MaterializeAsync(available.OperationId);
        var expected = File.ReadAllBytes(first.DescriptorPath);

        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedException>(() =>
            materializer.MaterializeAsync(available.OperationId));

        Assert.Equal("direct-composition-seed-exists", error.Code);
        Assert.Equal(expected, File.ReadAllBytes(first.DescriptorPath));
    }

    [Fact]
    public async Task InternalReconciliationAcceptsOnlyTheExactExistingDescriptor()
    {
        using var fixture = Fixture("rust-seed-pass");
        var available = await fixture.CreateAvailableAsync();
        var materializer = Materializer(fixture);
        var first = await materializer.MaterializeAsync(available.OperationId);

        var reconciled = await materializer.MaterializeOrReadAsync(available.OperationId);

        Assert.Equal(first, reconciled);
        var bytes = File.ReadAllBytes(first.DescriptorPath);
        bytes[^2] ^= 0x01;
        File.WriteAllBytes(first.DescriptorPath, bytes);
        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedException>(() =>
            materializer.MaterializeOrReadAsync(available.OperationId));
        Assert.Equal("direct-composition-seed-identity-drift", error.Code);
    }

    [Fact]
    public async Task ParentCancellationCreatesNoDescriptor()
    {
        using var fixture = Fixture("rust-seed-pass");
        var available = fixture.CreateQueued();
        var materializer = Materializer(fixture);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            materializer.MaterializeAsync(available.OperationId, cancellation.Token));

        Assert.False(File.Exists(ExpectedPath(fixture, available.OperationId)));
    }

    [Fact]
    public async Task PublicFactoryUsesOnlyFixedChildrenOfTheApplicationStateRoot()
    {
        var stateRoot = Path.Combine(_parent, $"state-{Guid.NewGuid():N}");
        Directory.CreateDirectory(stateRoot);
        var journalRoot = CompanionOperationJournal.CreateOwnedRoot(Path.Combine(
            stateRoot,
            CompanionDirectCompositionSeedDescriptorMaterializer.JournalDirectoryName));
        var journal = new CompanionOperationJournal(journalRoot);
        var queued = journal.CreateOrRead(CompanionContractTests.Request());
        var materializer = CompanionDirectCompositionSeedDescriptorMaterializer
            .OpenFromApplicationStateRoot(stateRoot);

        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedException>(() =>
            materializer.MaterializeAsync(queued.OperationId));

        Assert.Equal("direct-composition-seed-operation-not-available", error.Code);
        Assert.True(Directory.Exists(Path.Combine(
            stateRoot,
            CompanionDirectCompositionSeedDescriptorMaterializer.DescriptorDirectoryName)));
    }

    [Fact]
    public void MissingOrReparseApplicationStateRootIsRejected()
    {
        var missing = Path.Combine(_parent, "missing");
        var missingError = Assert.Throws<CompanionDirectCompositionSeedException>(() =>
            CompanionDirectCompositionSeedDescriptorMaterializer
                .OpenFromApplicationStateRoot(missing));
        Assert.Equal("direct-composition-seed-state-root", missingError.Code);

        var target = Path.Combine(_parent, "real-state");
        var link = Path.Combine(_parent, "linked-state");
        Directory.CreateDirectory(target);
        _ = Directory.CreateSymbolicLink(link, target);
        var reparseError = Assert.Throws<CompanionDirectCompositionSeedException>(() =>
            CompanionDirectCompositionSeedDescriptorMaterializer
                .OpenFromApplicationStateRoot(link));
        Assert.Equal("direct-composition-seed-state-root", reparseError.Code);
    }

    [Fact]
    public void PreexistingUnownedDescriptorDirectoryIsNeverAdopted()
    {
        using var fixture = Fixture("rust-seed-pass");
        var descriptorRoot = Path.Combine(
            fixture.Parent,
            CompanionDirectCompositionSeedDescriptorMaterializer.DescriptorDirectoryName);
        Directory.CreateDirectory(descriptorRoot);
        File.WriteAllText(Path.Combine(descriptorRoot, "unowned.txt"), "unowned");

        var error = Assert.Throws<CompanionDirectCompositionSeedException>(() =>
            Materializer(fixture));

        Assert.Equal("direct-composition-seed-root", error.Code);
        Assert.False(File.Exists(Path.Combine(descriptorRoot, ".owner")));
    }

    [Fact]
    public void MaterializationSurfaceAcceptsNoCallerSuppliedPaths()
    {
        var constructors = typeof(CompanionDirectCompositionSeedDescriptorMaterializer)
            .GetConstructors(BindingFlags.Public | BindingFlags.Instance);
        var method = typeof(CompanionDirectCompositionSeedDescriptorMaterializer)
            .GetMethod(nameof(
                CompanionDirectCompositionSeedDescriptorMaterializer.MaterializeAsync));

        Assert.Empty(constructors);
        Assert.NotNull(method);
        Assert.Collection(
            method!.GetParameters(),
            parameter =>
            {
                Assert.Equal("operationId", parameter.Name);
                Assert.Equal(typeof(string), parameter.ParameterType);
            },
            parameter =>
            {
                Assert.Equal("cancellationToken", parameter.Name);
                Assert.Equal(typeof(CancellationToken), parameter.ParameterType);
            });
    }

    [Fact]
    public async Task UnknownOperationIdentityUsesOnlyTheTypedPublicFailure()
    {
        using var fixture = Fixture("rust-seed-pass");
        var materializer = Materializer(fixture);

        var error = await Assert.ThrowsAsync<CompanionDirectCompositionSeedException>(() =>
            materializer.MaterializeAsync("not-an-operation"));

        Assert.Equal("direct-composition-seed-operation-not-found", error.Code);
        Assert.DoesNotContain(fixture.Parent, error.Message, StringComparison.Ordinal);
    }

    /// <summary>Creates one isolated companion conversion fixture.</summary>
    private CompanionArtifactTransferTests.TransferFixture Fixture(string scenario) =>
        new(_parent, scenario);

    /// <summary>Creates one materializer without exposing source or destination member paths.</summary>
    private static CompanionDirectCompositionSeedDescriptorMaterializer Materializer(
        CompanionArtifactTransferTests.TransferFixture fixture) =>
        CompanionDirectCompositionSeedDescriptorMaterializer.OpenForJournal(
            fixture.Journal,
            fixture.Parent);

    /// <summary>Returns the sole fixed descriptor path for an operation.</summary>
    private static string ExpectedPath(
        CompanionArtifactTransferTests.TransferFixture fixture,
        string operationId) =>
        Path.Combine(
            fixture.Parent,
            CompanionDirectCompositionSeedDescriptorMaterializer.DescriptorDirectoryName,
            $"{operationId}.json");

    /// <summary>Returns lowercase SHA-256 over exact fixture bytes.</summary>
    private static string Sha256(ReadOnlySpan<byte> bytes) =>
        Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    /// <summary>Removes only this test class's uniquely owned temporary root.</summary>
    public void Dispose()
    {
        _scratch.Dispose();
    }
}
