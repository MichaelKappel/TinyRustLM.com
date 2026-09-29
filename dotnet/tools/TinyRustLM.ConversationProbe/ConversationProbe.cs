using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TinyRustLM.ConversationProbe;

/// <summary>One externally frozen request; the probe captures execution and never grades an answer.</summary>
internal sealed record ProbeRequest(string Schema, string OperationId, string NativePath,
    string NativeSha256, string CompositionRoot, MemberInput[] Members,
    TinyRustLmRuntimePolicy Policy, ProbeCase[] Cases);
internal sealed record MemberInput(string Name, long Bytes, string Sha256);
internal sealed record ProbeCase(string Id, ulong TranscriptRevision,
    bool ResetBefore, uint? CancelAfterSteps, uint DeadlineMilliseconds);
internal sealed record ProbeWire(string Id, string RequestBase64);
internal sealed record StepObservation(double ElapsedMilliseconds, TinyRustLmRuntimeStep Step);
internal sealed record ActivationObservation(double ElapsedMilliseconds, TinyRustLmRuntimeState State);
internal sealed record CaseObservation(string Id, string Status, string? ErrorCode,
    double ElapsedMilliseconds, double BeginMilliseconds, double? FirstEmittedTokenMilliseconds,
    bool CancellationRequested, double? CancellationLatencyMilliseconds,
    IReadOnlyList<StepObservation> Steps, TinyRustLmRuntimeOutput? Output);
internal sealed record CaptureResult(string Schema, string Status, bool ModelQualified,
    IReadOnlyList<ActivationObservation> Activations, IReadOnlyList<CaseObservation> Cases);

/// <summary>Captures raw SDK transitions once per case, keeping failures separate from quality judgments.</summary>
internal static class ConversationProbe
{
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        PropertyNameCaseInsensitive = false,
        MaxDepth = 32
    };

    /// <summary>Rejects malformed or unbounded cases before an SDK runtime is created.</summary>
    internal static void ValidateCases(ProbeCase[] cases, ulong maximumRequestBytes)
    {
        if (cases is null || cases.Length is < 1 or > 32 || maximumRequestBytes is < 1 or > 1_054_848)
            throw new InvalidDataException("conversation-probe-cases");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        for (var index = 0; index < cases.Length; index++)
        {
            var item = cases[index];
            if (item is null || string.IsNullOrEmpty(item.Id) || item.Id.Length > 80 ||
                item.Id.Any(character => !char.IsAsciiLetterOrDigit(character) && character is not '-' and not '_') ||
                !ids.Add(item.Id) || item.DeadlineMilliseconds is < 1 or > 3_600_000 ||
                item.CancelAfterSteps > 4096)
                throw new InvalidDataException("conversation-probe-case");
        }
    }

    /// <summary>Receives one exact wire from the shared JS encoder after any real preceding answer.</summary>
    internal static byte[] DecodeWire(ProbeWire wire, string expectedId, ulong maximumRequestBytes)
    {
        if (wire is null || wire.Id != expectedId || wire.RequestBase64 is null ||
            wire.RequestBase64.Length > 4 * (((long)maximumRequestBytes + 2) / 3))
            throw new InvalidDataException("conversation-probe-wire");
        byte[] bytes;
        try { bytes = Convert.FromBase64String(wire.RequestBase64); }
        catch (FormatException) { throw new InvalidDataException("conversation-probe-wire"); }
        if (bytes.Length == 0 || (ulong)bytes.Length > maximumRequestBytes ||
            Convert.ToBase64String(bytes) != wire.RequestBase64)
            throw new InvalidDataException("conversation-probe-wire");
        return bytes;
    }

    /// <summary>Executes each frozen case at most once; any runtime failure stops the remaining sequence.</summary>
    internal static CaptureResult Capture(ProbeCase[] cases, Func<int, byte[]> request,
        TinyRustLmOperationId operation, uint maximumSequenceTokens,
        Func<ITinyRustLmRuntime> createRuntime, Func<ITinyRustLmRuntime, TinyRustLmRuntimeState> activate,
        Func<double>? milliseconds = null, Action<CaseObservation>? captured = null,
        Action<string>? generationStarted = null)
    {
        ArgumentNullException.ThrowIfNull(createRuntime);
        ArgumentNullException.ThrowIfNull(activate);
        ArgumentNullException.ThrowIfNull(request);
        if (cases.Length == 0 || maximumSequenceTokens is < 1 or > 131072)
            throw new InvalidDataException("conversation-probe-capture");
        milliseconds ??= () => Stopwatch.GetTimestamp() * 1000.0 / Stopwatch.Frequency;
        var observations = new List<CaseObservation>();
        var activations = new List<ActivationObservation>();
        ITinyRustLmRuntime? runtime = null;
        var failed = false;
        try
        {
            for (var index = 0; index < cases.Length; index++)
            {
                var item = cases[index];
                var started = milliseconds();
                var steps = new List<StepObservation>();
                var beginMilliseconds = 0.0;
                double? firstToken = null;
                var cancellationRequested = false;
                double? cancellationStarted = null;
                TinyRustLmRuntimeOutput? rawOutput = null;
                try
                {
                    if (runtime is null || item.ResetBefore)
                    {
                        var activationStarted = milliseconds();
                        runtime?.Dispose();
                        runtime = null;
                        runtime = createRuntime();
                        var activated = activate(runtime);
                        activations.Add(new ActivationObservation(milliseconds() - activationStarted, activated));
                    }
                    runtime.SetTranscriptRevision(item.TranscriptRevision);
                    var wire = request(index);
                    started = milliseconds();
                    generationStarted?.Invoke(item.Id);
                    var state = runtime.BeginRequest(wire, operation);
                    beginMilliseconds = milliseconds() - started;
                    if (state.State != "generating" && state.State != "terminal-output-ready")
                        throw new InvalidDataException("conversation-probe-begin-state");
                    var terminal = state.State == "terminal-output-ready";
                    for (uint step = 0; !terminal && step < maximumSequenceTokens; step++)
                    {
                        if (milliseconds() - started > item.DeadlineMilliseconds)
                            throw new TimeoutException();
                        var cancel = item.CancelAfterSteps is not null && steps.Count >= item.CancelAfterSteps;
                        cancellationRequested |= cancel;
                        if (cancel) cancellationStarted ??= milliseconds();
                        var value = runtime.Step(cancel);
                        var elapsed = milliseconds() - started;
                        steps.Add(new StepObservation(elapsed, value));
                        if (value.EmittedTokenId is not null) firstToken ??= elapsed;
                        if (cancel && value.Status.Kind != "cancelled")
                            throw new InvalidDataException("conversation-probe-cancellation-state");
                        terminal = value.Status.Kind != "active";
                    }
                    if (!terminal) throw new InvalidDataException("conversation-probe-step-bound");
                    var output = runtime.Finish();
                    rawOutput = output;
                    if (milliseconds() - started > item.DeadlineMilliseconds) throw new TimeoutException();
                    var observation = new CaseObservation(item.Id, "captured", null, milliseconds() - started,
                        beginMilliseconds, firstToken, cancellationRequested,
                        cancellationStarted is null ? null : milliseconds() - cancellationStarted, steps, output);
                    observations.Add(observation);
                    captured?.Invoke(observation);
                }
                catch (Exception error) when (error is not OutOfMemoryException)
                {
                    // Error messages may contain paths or input text; retain a closed category instead.
                    var code = error is TinyRustLmException native ? native.Code :
                        error is TimeoutException ? "conversation-probe-deadline" :
                        error is InvalidDataException ? "conversation-probe-state" : "conversation-probe-runtime";
                    var observation = new CaseObservation(item.Id, "failed", code, milliseconds() - started,
                        beginMilliseconds, firstToken, cancellationRequested,
                        cancellationStarted is null ? null : milliseconds() - cancellationStarted, steps, rawOutput);
                    observations.Add(observation);
                    captured?.Invoke(observation);
                    failed = true;
                    break;
                }
            }
        }
        finally { runtime?.Dispose(); }
        return new CaptureResult("tinyrustlm.native-conversation-capture/1", failed ? "failed" : "captured",
            false, activations, observations);
    }
}
