namespace TinyRustLM.ConsoleSample;

/// <summary>Bounds this sample's context and F32 KV allocation using inspected model dimensions.</summary>
internal static class SampleRuntimePolicy
{
    private const uint MaximumSampleSequenceTokens = 1_024;
    private const ulong MaximumSampleKvBytes = 256UL * 1_024 * 1_024;

    /// <summary>Uses the inspected model and native ceilings; rejects a budget that cannot hold one token.</summary>
    internal static TinyRustLmRuntimePolicy Create(Slm2ModelSpec model, TinyRustLmNativeLimits limits)
    {
        ArgumentNullException.ThrowIfNull(model);
        ArgumentNullException.ThrowIfNull(limits);
        if (model.ContextLength == 0 || model.LayerCount == 0 ||
            model.KvHeadCount == 0 || model.HeadDimension == 0)
        {
            throw new ArgumentOutOfRangeException(nameof(model), "Model context and KV dimensions must be positive.");
        }

        // The scalar runtime stores both K and V as F32 for every layer, KV head and token.
        var kvBytesPerToken = checked(2UL * model.LayerCount * model.KvHeadCount *
            model.HeadDimension * sizeof(float));
        var kvBudget = Math.Min(MaximumSampleKvBytes, limits.MaximumKvBytes);
        var maximumSequenceTokens = Math.Min(
            Math.Min((ulong)MaximumSampleSequenceTokens, model.ContextLength),
            Math.Min((ulong)limits.MaximumSequenceTokens, kvBudget / kvBytesPerToken));
        if (maximumSequenceTokens == 0)
        {
            throw new ArgumentOutOfRangeException(nameof(limits), "The sample requires context and KV capacity for at least one model token.");
        }

        return new TinyRustLmRuntimePolicy(
            limits.MaximumModelBytes,
            checked((uint)maximumSequenceTokens),
            checked(maximumSequenceTokens * kvBytesPerToken),
            limits.MaximumScratchBytes,
            limits.MaximumResolvedMemberBytes,
            limits.MaximumResidentDependencyBytes,
            limits.MaximumPrompt2RequestBytes);
    }
}
