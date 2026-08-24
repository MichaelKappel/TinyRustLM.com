using System.Reflection;
using System.Runtime.InteropServices;
using Xunit;

namespace TinyRustLM.Tests;

public sealed class SdkCoreTests
{
    private static readonly string[] ExactNativeSymbols =
    [
        "tinyrustlm_native_contract_json",
        "tinyrustlm_p2p_assemble_json",
        "tinyrustlm_p2p_inspect_manifest_json",
        "tinyrustlm_p2p_prepare_share_kit_json",
        "tinyrustlm_runtime_activate_json",
        "tinyrustlm_runtime_advance_operation_json",
        "tinyrustlm_runtime_begin_request_json",
        "tinyrustlm_runtime_create_json",
        "tinyrustlm_runtime_destroy_json",
        "tinyrustlm_runtime_finish_json",
        "tinyrustlm_runtime_set_transcript_json",
        "tinyrustlm_runtime_state_json",
        "tinyrustlm_runtime_step_json",
        "tinyrustlm_slm2_inspect_json",
        "tinyrustlm_string_free"
    ];

    [Fact]
    public void OperationIdentityIsExactNonzeroAndDefensivelyCopied()
    {
        var input = Enumerable.Repeat((byte)0x2a, TinyRustLmOperationId.ByteLength).ToArray();
        var identity = new TinyRustLmOperationId(input);
        input[0] = 0;

        Assert.Equal(string.Concat(Enumerable.Repeat("2a", 32)), identity.ToString());
        Assert.Equal(identity, TinyRustLmOperationId.Parse(identity.ToString()));
        var copy = identity.ToArray();
        copy[1] = 0;
        Assert.Equal(0x2a, identity.ToArray()[1]);
        Assert.Throws<ArgumentException>(() => new TinyRustLmOperationId(new byte[32]));
        Assert.Throws<ArgumentException>(() => new TinyRustLmOperationId(new byte[31]));
        Assert.Throws<FormatException>(() => TinyRustLmOperationId.Parse("AA".PadRight(64, 'A')));
    }

    [Fact]
    public void ManagedNativeDeclarationsAreExactlyTheAuditedSurface()
    {
        var declarations = typeof(NativeMethods)
            .GetMethods(BindingFlags.NonPublic | BindingFlags.Static)
            .Where(method => method.GetCustomAttribute<DllImportAttribute>() is not null)
            .Select(method => method.Name)
            .Order(StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(ExactNativeSymbols, declarations);
        Assert.DoesNotContain(declarations, name =>
            name.Contains("load_model", StringComparison.Ordinal) ||
            name.Contains("unload", StringComparison.Ordinal) ||
            name.Contains("reset", StringComparison.Ordinal) ||
            name.Contains("diagnostics", StringComparison.Ordinal) ||
            name.Contains("announcement", StringComparison.Ordinal) ||
            name.Contains("catalog", StringComparison.Ordinal) ||
            name.Contains("signed", StringComparison.Ordinal));
    }

    [Fact]
    public void NativeContractIsExactAndDescribesOnePrelaunchProduct()
    {
        var contract = new TinyRustLmRuntimeFactory().GetNativeContract();

        Assert.Equal("tinyrustlm.native_abi/1", contract.Schema);
        Assert.Equal((uint)1, contract.AbiRevision);
        Assert.Equal("0.1.8", contract.PackageVersion);
        Assert.Equal("TinyRustLM", contract.Product);
        Assert.True(contract.PrelaunchSingleProduct);
        Assert.Equal(ExactNativeSymbols, contract.Symbols);
        Assert.Equal((ulong)64, contract.Limits.MaximumRuntimeHandles);
        Assert.Equal((ulong)16_777_216, contract.Limits.MaximumPrompt2RequestBytes);
    }

    [Fact]
    public void RuntimeStateOperationCasTranscriptAndDisposeAreExact()
    {
        var first = Identity(0x11);
        var second = Identity(0x22);
        var runtime = new TinyRustLmRuntimeFactory().CreateRuntime(Policy(), first, 7);

        var initial = runtime.GetState();
        Assert.Equal("empty", initial.State);
        Assert.Equal(first.ToString(), initial.OperationId);
        Assert.Equal((ulong)7, initial.TranscriptRevision);
        Assert.Null(initial.ActiveComposition);
        Assert.Null(initial.MemoryPlan);

        var advanced = runtime.AdvanceOperation(first, second);
        Assert.Equal(second.ToString(), advanced.OperationId);
        var stale = Assert.Throws<TinyRustLmException>(() => runtime.AdvanceOperation(first, second));
        Assert.Equal("acg2-stale-operation", stale.Code);

        var transcript = runtime.SetTranscriptRevision(9);
        Assert.Equal((ulong)9, transcript.TranscriptRevision);
        var step = Assert.Throws<TinyRustLmException>(() => runtime.Step());
        Assert.Equal("runtime-not-generating", step.Code);

        runtime.Dispose();
        runtime.Dispose();
        Assert.Throws<ObjectDisposedException>(() => runtime.GetState());
    }

    [Fact]
    public void RuntimePolicyAndPromptWireFailBeforeStateMutation()
    {
        var factory = new TinyRustLmRuntimeFactory();
        Assert.Throws<ArgumentOutOfRangeException>(() => factory.CreateRuntime(
            Policy() with { MaximumRequestBytes = 0 },
            Identity(0x33)));

        using var runtime = factory.CreateRuntime(Policy(), Identity(0x44));
        Assert.Throws<ArgumentException>(() => runtime.BeginRequest(
            ReadOnlyMemory<byte>.Empty,
            Identity(0x44)));
        Assert.Equal("empty", runtime.GetState().State);
    }

    [Fact]
    public void Slm2InspectorUsesBoundedStructuredRequestAndPreservesNativeFailureCode()
    {
        var path = Path.Combine(Path.GetTempPath(), $"missing-{Guid.NewGuid():N}.slm2");
        var error = Assert.Throws<TinyRustLmException>(() =>
            new TinyRustLmSlm2Inspector().Inspect(
                path,
                new Slm2InspectionPolicy(1_000_000, 1024)));

        Assert.Equal("native-io", error.Code);
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new TinyRustLmSlm2Inspector().Inspect(path, new Slm2InspectionPolicy(0, 1024)));
    }

    [Fact]
    public void P2PAdmissionFactoriesAreClosed()
    {
        var model = TinyRustLmP2PAdmission.ForSlm2Model("model.acg2");
        var composition = TinyRustLmP2PAdmission.ForAcg2Composition();

        Assert.Equal(TinyRustLmP2PArtifactKind.Slm2Model, model.Kind);
        Assert.Equal("model.acg2", model.CompositionPath);
        Assert.Equal(TinyRustLmP2PArtifactKind.Acg2Composition, composition.Kind);
        Assert.Null(composition.CompositionPath);
        Assert.Throws<ArgumentException>(() => TinyRustLmP2PAdmission.ForSlm2Model(" "));
    }

    [Fact]
    public void P2PAcg2RequestSerializesWithoutAnUnknownNullField()
    {
        var missingArtifact = Path.Combine(Path.GetTempPath(), $"missing-{Guid.NewGuid():N}.acg2");
        var output = Path.Combine(Path.GetTempPath(), $"share-{Guid.NewGuid():N}");
        var request = new PrepareShareKitRequest(
            missingArtifact,
            output,
            ContentId('a'),
            ContentId('b'),
            ContentId('c'),
            "Apache-2.0",
            "2026-08-24T00:00:00Z",
            TinyRustLmP2PAdmission.ForAcg2Composition());

        var error = Assert.Throws<TinyRustLmException>(() =>
            new TinyRustLmP2PClient().PrepareShareKit(request));
        Assert.Equal("p2p-io", error.Code);
        Assert.False(Directory.Exists(output));
    }

    [Fact]
    public void P2PRejectsBadIdentityAndEmptyManifestBeforeNativeMutation()
    {
        var client = new TinyRustLmP2PClient();
        var request = new PrepareShareKitRequest(
            "artifact.acg2",
            "share",
            "not-an-id",
            ContentId('b'),
            ContentId('c'),
            "Apache-2.0",
            "2026-08-24T00:00:00Z",
            TinyRustLmP2PAdmission.ForAcg2Composition());

        Assert.Throws<ArgumentException>(() => client.PrepareShareKit(request));
        Assert.Throws<ArgumentException>(() => client.InspectManifest(ReadOnlyMemory<byte>.Empty));
    }

    private static TinyRustLmOperationId Identity(byte value) =>
        new(Enumerable.Repeat(value, TinyRustLmOperationId.ByteLength).ToArray());

    private static TinyRustLmRuntimePolicy Policy() => new(
        MaximumModelBytes: 1_000_000,
        MaximumSequenceTokens: 128,
        MaximumKvBytes: 1_000_000,
        MaximumScratchBytes: 1_000_000,
        MaximumResolvedMemberBytes: 2_000_000,
        MaximumResidentDependencyBytes: 1_000_000,
        MaximumRequestBytes: 4096);

    private static string ContentId(char value) => $"sha256:{new string(value, 64)}";
}
