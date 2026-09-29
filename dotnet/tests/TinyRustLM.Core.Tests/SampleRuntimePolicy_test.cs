using TinyRustLM.ConsoleSample;
using Xunit;

namespace TinyRustLM.Core.Tests;

public sealed class SampleRuntimePolicyTests
{
    /// <summary>Reproduces the model-context mismatch without loading or qualifying model weights.</summary>
    [Fact]
    public void QwenSizedModelUsesBoundedContextInsteadOfTheNativeCeiling()
    {
        var model = Model();
        var limits = Limits();
        Assert.True(limits.MaximumSequenceTokens > model.ContextLength);

        var policy = SampleRuntimePolicy.Create(model, limits);

        Assert.Equal(1_024U, policy.MaximumSequenceTokens);
        Assert.Equal(234_881_024UL, policy.MaximumKvBytes);
        Assert.Equal(limits.MaximumModelBytes, policy.MaximumModelBytes);
        Assert.Equal(limits.MaximumScratchBytes, policy.MaximumScratchBytes);
        Assert.Equal(limits.MaximumResolvedMemberBytes, policy.MaximumResolvedMemberBytes);
        Assert.Equal(limits.MaximumResidentDependencyBytes, policy.MaximumResidentDependencyBytes);
        Assert.Equal(limits.MaximumPrompt2RequestBytes, policy.MaximumRequestBytes);
    }

    /// <summary>Checks each independent sequence ceiling, including its exact one-token boundary.</summary>
    [Theory]
    [InlineData(77U, 131_072U, 77U)]
    [InlineData(40_960U, 17U, 17U)]
    [InlineData(1U, 131_072U, 1U)]
    [InlineData(40_960U, 1U, 1U)]
    public void HonorsModelAndNativeContext(uint modelContext, uint nativeContext, uint expected)
    {
        var policy = SampleRuntimePolicy.Create(Model() with { ContextLength = modelContext },
            Limits() with { MaximumSequenceTokens = nativeContext });

        Assert.Equal(expected, policy.MaximumSequenceTokens);
        Assert.Equal(expected * 229_376UL, policy.MaximumKvBytes);
    }

    /// <summary>Rejects an extra token even when all but its final KV byte fits.</summary>
    [Theory]
    [InlineData(229_376UL, 1U)]
    [InlineData(458_751UL, 1U)]
    [InlineData(458_752UL, 2U)]
    public void FloorsTheNativeKvBudgetToCompleteTokens(ulong budget, uint expected)
    {
        var policy = SampleRuntimePolicy.Create(Model(), Limits() with { MaximumKvBytes = budget });

        Assert.Equal(expected, policy.MaximumSequenceTokens);
        Assert.Equal(expected * 229_376UL, policy.MaximumKvBytes);
    }

    /// <summary>A larger valid KV shape reaches the sample memory cap before its token cap.</summary>
    [Fact]
    public void SampleKvBudgetLimitsAHighMemoryModel()
    {
        var model = Model() with { LayerCount = 16, HeadCount = 32, KvHeadCount = 32,
            HeadDimension = 256, EmbeddingSize = 8_192 };

        var policy = SampleRuntimePolicy.Create(model, Limits());

        Assert.Equal(256U, policy.MaximumSequenceTokens);
        Assert.Equal(268_435_456UL, policy.MaximumKvBytes);
    }

    /// <summary>Distinguishes no admitted token capacity from a runtime that can be allocated.</summary>
    [Theory]
    [InlineData(0UL, 131_072U)]
    [InlineData(229_375UL, 131_072U)]
    [InlineData(17_179_869_184UL, 0U)]
    public void RejectsLimitsThatCannotHoldOneToken(ulong kvBytes, uint sequenceTokens)
    {
        var error = Assert.Throws<ArgumentOutOfRangeException>(() => SampleRuntimePolicy.Create(Model(),
            Limits() with { MaximumKvBytes = kvBytes, MaximumSequenceTokens = sequenceTokens }));

        Assert.Equal("limits", error.ParamName);
        Assert.Contains("at least one model token", error.Message, StringComparison.Ordinal);
    }

    /// <summary>Zero dimensions are refused before division or runtime allocation.</summary>
    [Theory]
    [InlineData(0U, 28U, 8U, 128U)]
    [InlineData(40_960U, 0U, 8U, 128U)]
    [InlineData(40_960U, 28U, 0U, 128U)]
    [InlineData(40_960U, 28U, 8U, 0U)]
    public void RejectsZeroModelDimensions(uint context, uint layers, uint kvHeads, uint headDimension)
    {
        var model = Model() with { ContextLength = context, LayerCount = layers,
            KvHeadCount = kvHeads, HeadDimension = headDimension };

        var error = Assert.Throws<ArgumentOutOfRangeException>(() => SampleRuntimePolicy.Create(model, Limits()));

        Assert.Equal("model", error.ParamName);
    }

    /// <summary>Extreme metadata cannot wrap the KV arithmetic into an apparently small allocation.</summary>
    [Fact]
    public void RejectsKvArithmeticOverflow()
    {
        var model = Model() with { LayerCount = uint.MaxValue, KvHeadCount = uint.MaxValue,
            HeadDimension = uint.MaxValue };

        Assert.Throws<OverflowException>(() => SampleRuntimePolicy.Create(model, Limits()));
    }

    /// <summary>Both required inputs fail before any policy calculation when absent.</summary>
    [Fact]
    public void RejectsMissingInputs()
    {
        Assert.Throws<ArgumentNullException>(() => SampleRuntimePolicy.Create(null!, Limits()));
        Assert.Throws<ArgumentNullException>(() => SampleRuntimePolicy.Create(Model(), null!));
    }

    /// <summary>Provides architecture metadata only; no fixture weights or inference results.</summary>
    private static Slm2ModelSpec Model() => new("model", 151_936, 40_960, 1_024, 3_072,
        28, 16, 8, 128, 1_000_000, 0.000001F, true, false, true);

    /// <summary>Provides current native resource ceilings without loading the native library.</summary>
    private static TinyRustLmNativeLimits Limits() => new(1_048_576, 1_048_576, 4_194_304,
        1_048_576, 4_194_304, 8, 8_589_934_592, 131_072, 17_179_869_184,
        2_147_483_648, 134_217_728, 536_870_912);
}
