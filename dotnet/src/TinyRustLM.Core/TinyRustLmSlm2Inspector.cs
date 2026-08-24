namespace TinyRustLM;

/// <summary>Native-backed exact SLM2 inspector.</summary>
public sealed class TinyRustLmSlm2Inspector : ISlm2Inspector
{
    /// <inheritdoc />
    public Slm2Inspection Inspect(string path, Slm2InspectionPolicy policy)
    {
        ManagedValidation.RequireText(path, nameof(path));
        ArgumentNullException.ThrowIfNull(policy);
        var contract = NativeContractAuthority.Get();
        if (policy.MaximumFileBytes is 0 || policy.MaximumFileBytes > contract.Limits.MaximumModelBytes ||
            policy.MaximumTensors == 0)
        {
            throw new ArgumentOutOfRangeException(nameof(policy));
        }

        var request = NativeJson.Serialize(
            new NativeSlm2InspectionRequest(
                NativeContractAuthority.ModelInspectionSchema,
                path,
                policy.MaximumFileBytes,
                policy.MaximumTensors),
            contract.Limits.MaximumModelRequestJsonBytes,
            nameof(policy));
        return NativeReportValidation.Slm2Inspection(NativeJson.Call<Slm2Inspection>(() =>
            NativeMethods.tinyrustlm_slm2_inspect_json(request, (nuint)request.Length)));
    }
}

internal sealed record NativeSlm2InspectionRequest(
    string Schema,
    string Path,
    ulong MaximumFileBytes,
    uint MaximumTensors);
