namespace TinyRustLM;

internal static class NativeContractAuthority
{
    internal const string AbiSchema = "tinyrustlm.native_abi/1";
    internal const uint AbiRevision = 1;
    internal const string PackageVersion = "0.1.8";
    internal const string ModelInspectionSchema = "tinyrustlm.native.slm2_inspection/1";
    internal const string RuntimeCreateSchema = "tinyrustlm.native.runtime_create/1";
    internal const string RuntimeActivationSchema = "tinyrustlm.native.runtime_activation/1";
    internal const string P2PPrepareSchema = "tinyrustlm.native.p2p_prepare/1";
    internal const string P2PAssembleSchema = "tinyrustlm.native.p2p_assemble/1";

    private static readonly string[] ExpectedCapabilities =
    [
        "slm2-inspection",
        "acg2-activation",
        "prompt2-sampling2-generation",
        "bounded-scalar-runtime",
        "composition-bound-direct-transport"
    ];

    private static readonly string[] ExpectedSymbols =
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

    private static readonly Lazy<TinyRustLmNativeContract> Current = new(
        LoadAndValidate,
        LazyThreadSafetyMode.ExecutionAndPublication);

    internal static TinyRustLmNativeContract Get() => Current.Value;

    private static TinyRustLmNativeContract LoadAndValidate()
    {
        var contract = NativeJson.Call<TinyRustLmNativeContract>(
            NativeMethods.tinyrustlm_native_contract_json,
            65_536);
        if (contract.Schema != AbiSchema ||
            contract.AbiRevision != AbiRevision ||
            contract.PackageVersion != PackageVersion ||
            contract.Product != "TinyRustLM" ||
            !contract.PrelaunchSingleProduct ||
            contract.Contracts is null ||
            contract.Capabilities is null ||
            contract.Symbols is null ||
            contract.Limits is null ||
            contract.Contracts.ModelInspection != ModelInspectionSchema ||
            contract.Contracts.RuntimeCreate != RuntimeCreateSchema ||
            contract.Contracts.RuntimeActivation != RuntimeActivationSchema ||
            contract.Contracts.P2PPrepare != P2PPrepareSchema ||
            contract.Contracts.P2PAssemble != P2PAssembleSchema ||
            !contract.Capabilities.SequenceEqual(ExpectedCapabilities, StringComparer.Ordinal) ||
            !contract.Symbols.SequenceEqual(ExpectedSymbols, StringComparer.Ordinal) ||
            contract.Limits != ExpectedLimits())
        {
            throw new TinyRustLmException("native-contract-mismatch");
        }

        return contract;
    }

    private static TinyRustLmNativeLimits ExpectedLimits() => new(
        MaximumModelRequestJsonBytes: 16_384,
        MaximumRuntimeJsonBytes: 65_536,
        MaximumPrompt2RequestBytes: 16_777_216,
        MaximumP2PRequestJsonBytes: 131_072,
        MaximumP2PManifestBytes: 2_097_152,
        MaximumRuntimeHandles: 64,
        MaximumModelBytes: 17_179_869_184,
        MaximumSequenceTokens: 131_072,
        MaximumKvBytes: 17_179_869_184,
        MaximumScratchBytes: 8_589_934_592,
        MaximumResolvedMemberBytes: 19_327_352_832,
        MaximumResidentDependencyBytes: 2_147_483_648);
}
