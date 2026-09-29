using TinyRustLM.ConversationProbe;
using System.Text.Json;
using Xunit;
using Probe = TinyRustLM.ConversationProbe.ConversationProbe;

namespace TinyRustLM.Core.Tests;

public sealed class ConversationProbeTests
{
    private static readonly TinyRustLmOperationId Operation = TinyRustLmOperationId.Parse(new string('a', 64));

    /// <summary>Use a bounded case without encoding or executing a real model.</summary>
    private static ProbeCase Case(string id = "one", bool reset = false, uint? cancel = null, uint deadline = 1000) =>
        new(id, 0, reset, cancel, deadline);

    /// <summary>The actual line protocol preserves all raw fields and rejects undeclared metadata.</summary>
    [Fact]
    public void SerializedProtocolRoundTripsWithoutDroppingRawEvidence()
    {
        var request = new ProbeRequest("request", Operation.ToString(), "native", new string('a', 64), "composition",
            [new("model.slm2", 123, new string('b', 64))], new(1024, 4, 1024, 1024, 2048, 1024, 512), [Case()]);
        var json = JsonSerializer.Serialize(request, Probe.Json);
        var decoded = JsonSerializer.Deserialize<ProbeRequest>(json, Probe.Json)!;
        Assert.Equal(request.OperationId, decoded.OperationId);
        Assert.Equal(123, decoded.Members[0].Bytes);
        Assert.Equal(request.Policy, decoded.Policy);
        Assert.Equal(request.Cases[0], decoded.Cases[0]);
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ProbeRequest>(json[..^1] + ",\"extra\":1}", Probe.Json));
        var runtime = new Runtime();
        var capture = Probe.Capture([Case()], _ => [0], Operation, 4, () => runtime, value => value.GetState());
        var encoded = JsonSerializer.Serialize(capture, Probe.Json);
        var restored = JsonSerializer.Deserialize<CaptureResult>(encoded, Probe.Json)!;
        Assert.False(restored.ModelQualified);
        Assert.Equal("raw\nNóra 🦀", restored.Cases[0].Output!.Text);
        Assert.Equal(2, restored.Cases[0].Steps.Count);
        Assert.Equal(7U, restored.Cases[0].Steps[0].Step.EmittedTokenId);
        Assert.Equal("active-idle", restored.Activations[0].State.State);
        Assert.Equal(new ProbeWire("one", "AA=="), JsonSerializer.Deserialize<ProbeWire>(
            JsonSerializer.Serialize(new ProbeWire("one", "AA=="), Probe.Json), Probe.Json));
    }

    /// <summary>Validation rejects missing/duplicate identities, impossible budgets and noncanonical base64.</summary>
    [Fact]
    public void BoundsTheFrozenProtocolBeforeExecution()
    {
        Probe.ValidateCases([Case()], 512);
        Assert.Equal(new byte[] { 1, 2 }, Probe.DecodeWire(new("one", "AQI="), "one", 512));
        Assert.Throws<InvalidDataException>(() => Probe.ValidateCases([], 512));
        Assert.Throws<InvalidDataException>(() => Probe.ValidateCases([Case()], 0));
        Assert.Throws<InvalidDataException>(() => Probe.ValidateCases([Case(), Case()], 512));
        Assert.Throws<InvalidDataException>(() => Probe.ValidateCases([Case("../x")], 512));
        Assert.Throws<InvalidDataException>(() => Probe.ValidateCases([Case(cancel: 4097)], 512));
        Assert.Throws<InvalidDataException>(() => Probe.ValidateCases([Case(deadline: 0)], 512));
        foreach (var value in new[] { "", "AA", "!", "AQI= ", "AQID" })
            Assert.Throws<InvalidDataException>(() => Probe.DecodeWire(new("one", value), "one", 2));
        Assert.Throws<InvalidDataException>(() => Probe.DecodeWire(new("wrong", "AA=="), "one", 512));
        Assert.Throws<InvalidDataException>(() => Probe.DecodeWire(null!, "one", 512));
    }

    /// <summary>Capture exact raw text/tokens once, then permit the owner to encode a dependent real turn.</summary>
    [Fact]
    public void CapturesActualHistoryInOneSessionAndNeverGradesIt()
    {
        var runtime = new Runtime();
        var observed = new List<CaseObservation>();
        double clock = 0;
        var result = Probe.Capture([Case(), Case("two")], index =>
        {
            if (index == 1) Assert.Equal("raw\nNóra 🦀", observed[0].Output!.Text);
            return [(byte)index];
        }, Operation, 4, () => runtime, value => value.GetState(), () => clock++, observed.Add);
        Assert.Equal("captured", result.Status);
        Assert.False(result.ModelQualified);
        Assert.Equal(2, runtime.Begins);
        Assert.Equal(2, runtime.Finishes);
        Assert.Equal(1, runtime.Disposals);
        Assert.Single(result.Activations);
        Assert.Equal(new uint[] { 7, 8 }, result.Cases[0].Output!.TokenIds);
        Assert.NotNull(result.Cases[0].FirstEmittedTokenMilliseconds);
        Assert.Equal("raw\nNóra 🦀", result.Cases[1].Output!.Text);
    }

    /// <summary>Cancellation is an actual Step input and a subsequent turn reuses the same live runtime.</summary>
    [Fact]
    public void CancelsAndContinuesWithoutRepeatingGeneration()
    {
        var runtime = new Runtime();
        var result = Probe.Capture([Case(cancel: 1), Case("after")], _ => [0], Operation, 4,
            () => runtime, value => value.GetState());
        Assert.Equal("captured", result.Status);
        Assert.True(result.Cases[0].CancellationRequested);
        Assert.NotNull(result.Cases[0].CancellationLatencyMilliseconds);
        Assert.Equal("cancelled", result.Cases[0].Output!.Status.Kind);
        Assert.Equal("stop-token", result.Cases[1].Output!.Status.Kind);
        Assert.Equal(2, runtime.Begins);
    }

    /// <summary>Explicit reset disposes the old runtime and activates a fresh one.</summary>
    [Fact]
    public void ResetCreatesASeparateRuntime()
    {
        var runtimes = new List<Runtime>();
        var result = Probe.Capture([Case(), Case("reset", true)], _ => [0], Operation, 4,
            () => { var runtime = new Runtime(); runtimes.Add(runtime); return runtime; }, value => value.GetState());
        Assert.Equal(2, result.Activations.Count);
        Assert.Equal(2, runtimes.Count);
        Assert.All(runtimes, runtime => Assert.Equal(1, runtime.Disposals));
    }

    /// <summary>A terminal BeginRequest result consumes empty output without taking a fabricated step.</summary>
    [Fact]
    public void ImmediateTerminalDoesNotStep()
    {
        var runtime = new Runtime { Immediate = true };
        var result = Probe.Capture([Case()], _ => [0], Operation, 4, () => runtime, value => value.GetState());
        Assert.Equal("captured", result.Status);
        Assert.Empty(result.Cases[0].Steps);
        Assert.Null(result.Cases[0].FirstEmittedTokenMilliseconds);
        Assert.Equal("", result.Cases[0].Output!.Text);
    }

    /// <summary>Runtime errors and bounds stop the plan; unstarted cases never become fabricated failures or passes.</summary>
    [Theory]
    [InlineData("error")]
    [InlineData("bound")]
    [InlineData("cancel")]
    [InlineData("begin")]
    [InlineData("timeout")]
    public void FailureIsCapturedAndNeverRetried(string failure)
    {
        var runtime = new Runtime { Failure = failure };
        double clock = 0;
        var result = Probe.Capture([Case(cancel: failure == "cancel" ? 0U : null, deadline: 5), Case("unstarted")],
            _ => [0], Operation, 4, () => runtime, value => value.GetState(),
            () => failure == "timeout" ? clock += 3 : 0);
        Assert.Equal("failed", result.Status);
        Assert.Single(result.Cases);
        Assert.Equal(1, runtime.Begins);
        Assert.Null(result.Cases[0].Output);
        Assert.False(result.ModelQualified);
        if (failure == "error") Assert.Equal("fixture-error", result.Cases[0].ErrorCode);
    }

    /// <summary>Invalid callback contracts fail without creating a runtime.</summary>
    [Fact]
    public void RejectsInvalidCaptureArguments()
    {
        Assert.Throws<ArgumentNullException>(() => Probe.Capture([Case()], _ => [0], Operation, 4, null!, x => x.GetState()));
        Assert.Throws<ArgumentNullException>(() => Probe.Capture([Case()], _ => [0], Operation, 4, () => new Runtime(), null!));
        Assert.Throws<ArgumentNullException>(() => Probe.Capture([Case()], null!, Operation, 4, () => new Runtime(), x => x.GetState()));
        Assert.Throws<InvalidDataException>(() => Probe.Capture([], _ => [0], Operation, 4, () => new Runtime(), x => x.GetState()));
    }

    /// <summary>Deterministic SDK protocol double; it provides no model or quality evidence.</summary>
    private sealed class Runtime : ITinyRustLmRuntime
    {
        internal int Begins, Finishes, Disposals;
        internal bool Immediate;
        internal string Failure = "";
        private int _steps;
        private string _terminal = "stop-token";
        /// <summary>Preserve a unique raw answer and token sequence.</summary>
        public TinyRustLmRuntimeOutput Finish() { Finishes++; return new("fixture", Immediate ? "" : "raw\nNóra 🦀",
            Immediate ? [] : new uint[] { 7, 8 }, new(_terminal, null), new(1, "fixture", "fixture", "fixture"), Operation.ToString(), 16); }
        /// <summary>Reset only the current generation's step counter.</summary>
        public TinyRustLmRuntimeState BeginRequest(ReadOnlyMemory<byte> request, TinyRustLmOperationId operation)
        { Begins++; _steps = 0; return State(Failure == "begin" ? "unexpected" : Immediate ? "terminal-output-ready" : "generating"); }
        /// <summary>Honor the requested cancellation or exercise a specified terminal failure.</summary>
        public TinyRustLmRuntimeStep Step(bool cancelled = false)
        {
            if (Failure == "error") throw new TinyRustLmException("fixture-error");
            _steps++;
            _terminal = cancelled ? "cancelled" : "stop-token";
            var kind = Failure is "bound" or "cancel" || (!cancelled && _steps < 2) ? "active" : _terminal;
            return new("fixture", 7, cancelled ? null : 7, new(kind, null), 16);
        }
        /// <summary>Return a bounded state-only fixture.</summary>
        private static TinyRustLmRuntimeState State(string state) => new("fixture", state, Operation.ToString(), 0, null, 0, null);
        /// <summary>Expose fixture state for the activation callback.</summary>
        public TinyRustLmRuntimeState GetState() => State("active-idle");
        /// <summary>Count exact ownership closure.</summary>
        public void Dispose() => Disposals++;
        /// <summary>Accept transcript updates without generating tokens.</summary>
        public TinyRustLmRuntimeState SetTranscriptRevision(ulong revision) => State("active-idle");
        /// <summary>Activation is supplied by the capture callback in this fixture.</summary>
        public TinyRustLmRuntimeState ActivateComposition(TinyRustLmActivationRequest request, TinyRustLmOperationId operation) => throw new NotSupportedException();
        /// <summary>The capture never changes its operation identity.</summary>
        public TinyRustLmRuntimeState AdvanceOperation(TinyRustLmOperationId current, TinyRustLmOperationId next) => throw new NotSupportedException();
    }
}
