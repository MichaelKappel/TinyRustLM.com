namespace TinyRustLM.ConsoleSample;

/// <summary>Consumes immediate or stepped terminal output within the sample's admitted context bound.</summary>
internal static class SampleConversation
{
    /// <summary>Uses BeginRequest's state; returns null only when the admitted step bound is exhausted.</summary>
    internal static TinyRustLmRuntimeOutput? FinishGeneration(ITinyRustLmRuntime runtime,
        TinyRustLmRuntimeState initialState, uint maximumSteps)
    {
        ArgumentNullException.ThrowIfNull(runtime);
        ArgumentNullException.ThrowIfNull(initialState);
        ArgumentOutOfRangeException.ThrowIfZero(maximumSteps);
        if (initialState.State == "terminal-output-ready")
        {
            return runtime.Finish();
        }

        for (uint stepCount = 0; stepCount < maximumSteps; stepCount++)
        {
            if (runtime.Step().Status.Kind != "active")
            {
                return runtime.Finish();
            }
        }

        return null;
    }
}
