using TinyRustLM.ConsoleSample;
using Xunit;

namespace TinyRustLM.Core.Tests;

public sealed class SampleConversationTests
{
    /// <summary>A prompt filling context is already terminal; Step would fail in the real runtime.</summary>
    [Fact]
    public void FinishesImmediateContextLimitWithoutStepping()
    {
        using var runtime = new ObservedRuntime(Array.Empty<string>(), "");

        var output = SampleConversation.FinishGeneration(runtime, State("terminal-output-ready"), 1);

        Assert.Same(runtime.Output, output);
        Assert.Equal(0, runtime.Steps);
        Assert.Equal(1, runtime.Finishes);
        Assert.Equal("", output!.Text);
    }

    /// <summary>Returns the runtime's exact output once after an ordinary active-to-terminal transition.</summary>
    [Fact]
    public void FinishesTheFirstTerminalStepWithoutRepairingOutput()
    {
        using var runtime = new ObservedRuntime(new[] { "active", "context-limit" }, "raw\noutput");

        var output = SampleConversation.FinishGeneration(runtime, State("generating"), 2);

        Assert.Same(runtime.Output, output);
        Assert.Equal(2, runtime.Steps);
        Assert.Equal(1, runtime.Finishes);
        Assert.Equal("raw\noutput", output!.Text);
    }

    /// <summary>The sample cannot spin beyond its selected context or consume nonterminal output.</summary>
    [Fact]
    public void ExhaustingTheBoundDoesNotCallFinish()
    {
        using var runtime = new ObservedRuntime(new[] { "active", "active" }, "unused");

        Assert.Null(SampleConversation.FinishGeneration(runtime, State("generating"), 2));
        Assert.Equal(2, runtime.Steps);
        Assert.Equal(0, runtime.Finishes);
    }

    /// <summary>Invalid helper inputs fail before invoking the runtime.</summary>
    [Fact]
    public void RejectsMissingInputsAndZeroStepBound()
    {
        using var runtime = new ObservedRuntime(Array.Empty<string>(), "unused");
        Assert.Throws<ArgumentNullException>(() => SampleConversation.FinishGeneration(null!, State("generating"), 1));
        Assert.Throws<ArgumentNullException>(() => SampleConversation.FinishGeneration(runtime, null!, 1));
        Assert.Throws<ArgumentOutOfRangeException>(() => SampleConversation.FinishGeneration(runtime, State("generating"), 0));
        Assert.Equal(0, runtime.Steps);
        Assert.Equal(0, runtime.Finishes);
    }

    /// <summary>Creates a state-only test value, not an admitted native composition.</summary>
    private static TinyRustLmRuntimeState State(string state) => new("fixture", state,
        "fixture-operation", 0, null, 0, null);

    /// <summary>Fails if the sample steps beyond the declared transitions or invokes unrelated operations.</summary>
    private sealed class ObservedRuntime : ITinyRustLmRuntime
    {
        private readonly Queue<string> _transitions;
        internal int Steps { get; private set; }
        internal int Finishes { get; private set; }
        internal TinyRustLmRuntimeOutput Output { get; }

        /// <summary>Binds exact transition order and raw output for a single synthetic control-flow check.</summary>
        internal ObservedRuntime(IEnumerable<string> transitions, string text)
        {
            _transitions = new Queue<string>(transitions);
            Output = new TinyRustLmRuntimeOutput("fixture", text, Array.Empty<uint>(),
                new TinyRustLmGenerationStatus("context-limit", null),
                new TinyRustLmCompositionIdentity(1, "fixture", "fixture", "fixture"), "fixture", 0);
        }

        /// <summary>Consumes one declared transition and rejects accidental cancellation.</summary>
        public TinyRustLmRuntimeStep Step(bool cancelled = false)
        {
            Assert.False(cancelled);
            Steps++;
            return new TinyRustLmRuntimeStep("fixture", null, null,
                new TinyRustLmGenerationStatus(_transitions.Dequeue(), null), 0);
        }

        /// <summary>Counts output consumption while preserving its exact object.</summary>
        public TinyRustLmRuntimeOutput Finish() { Finishes++; return Output; }
        /// <summary>No resources are created by this test double.</summary>
        public void Dispose() { }
        /// <summary>State inspection is outside this helper's role.</summary>
        public TinyRustLmRuntimeState GetState() => throw new NotSupportedException();
        /// <summary>Activation must have completed before this helper runs.</summary>
        public TinyRustLmRuntimeState ActivateComposition(TinyRustLmActivationRequest request, TinyRustLmOperationId expectedOperation) => throw new NotSupportedException();
        /// <summary>Operation changes are outside this helper's role.</summary>
        public TinyRustLmRuntimeState AdvanceOperation(TinyRustLmOperationId expectedCurrent, TinyRustLmOperationId next) => throw new NotSupportedException();
        /// <summary>Transcript revision is established by the caller.</summary>
        public TinyRustLmRuntimeState SetTranscriptRevision(ulong transcriptRevision) => throw new NotSupportedException();
        /// <summary>The caller supplies BeginRequest's actual result.</summary>
        public TinyRustLmRuntimeState BeginRequest(ReadOnlyMemory<byte> prompt2Request, TinyRustLmOperationId expectedOperation) => throw new NotSupportedException();
    }
}
