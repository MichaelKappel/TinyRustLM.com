using System.Security.Cryptography;
using System.Security.AccessControl;
using System.Security.Principal;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionCapabilityStateTests : IDisposable
{
    private readonly string _root = Path.Combine(
        Path.GetTempPath(),
        $"tinyrustlm-companion-capability-{Guid.NewGuid():N}");

    [Fact]
    public void InstallationIdentityIsCreateOnlyCanonicalAndProcessScoped()
    {
        var firstRandom = new RepeatingCryptographicRandom(0x11, 0x22);
        var first = CompanionInstallation.OpenOrCreate(_root, firstRandom);
        var recordPath = Path.Combine(_root, CompanionInstallation.RecordFileName);

        Assert.Equal(new string('1', 32), first.InstallationId);
        Assert.Equal(new string('2', 32), first.ProcessInstanceId);
        Assert.Equal(
            $"{{\"schema\":\"{CompanionLoopbackWire.InstallationSchema}\",\"installationId\":\"{new string('1', 32)}\"}}\n",
            File.ReadAllText(recordPath));
        Assert.DoesNotContain(first.ProcessInstanceId, File.ReadAllText(recordPath), StringComparison.Ordinal);

        var second = CompanionInstallation.OpenOrCreate(
            _root,
            new RepeatingCryptographicRandom(0x33));
        Assert.Equal(first.InstallationId, second.InstallationId);
        Assert.Equal(new string('3', 32), second.ProcessInstanceId);
        Assert.NotEqual(first.ProcessInstanceId, second.ProcessInstanceId);
    }

    [Fact]
    public void InstallationRejectsMissingMalformedAndPermissionDrift()
    {
        CompanionInstallation.OpenOrCreate(
            _root,
            new RepeatingCryptographicRandom(0x01, 0x02));
        File.Delete(Path.Combine(_root, CompanionInstallation.RecordFileName));
        File.WriteAllText(Path.Combine(_root, "foreign.txt"), "foreign");
        AssertCode(
            "installation-record-missing-nonempty-root",
            () => CompanionInstallation.OpenOrCreate(
                _root,
                new RepeatingCryptographicRandom(0x11)));

        Directory.Delete(_root, recursive: true);
        var identity = CompanionInstallation.OpenOrCreate(
            _root,
            new RepeatingCryptographicRandom(0x11, 0x22));
        var recordPath = Path.Combine(_root, CompanionInstallation.RecordFileName);
        File.AppendAllText(recordPath, " ");
        AssertCode(
            "installation-record-wire",
            () => CompanionInstallation.OpenOrCreate(
                _root,
                new RepeatingCryptographicRandom(0x33)));

        Assert.Equal(new string('1', 32), identity.InstallationId);

        Directory.Delete(_root, recursive: true);
        CompanionInstallation.OpenOrCreate(
            _root,
            new RepeatingCryptographicRandom(0x41, 0x42));
        IntroducePermissionDrift(_root);
        AssertCode(
            "installation-permissions",
            () => CompanionInstallation.OpenOrCreate(
                _root,
                new RepeatingCryptographicRandom(0x43)));
    }

    [Fact]
    public void PairingNetworkBodiesHaveOneCanonicalRepresentation()
    {
        var request = BeginRequest(0x40);
        var canonical = CompanionLoopbackWire.EncodePairingBeginRequest(request);
        Assert.Equal(request, CompanionLoopbackWire.DecodePairingBeginRequest(canonical));

        var text = System.Text.Encoding.UTF8.GetString(canonical);
        foreach (var invalid in new[]
        {
            $" {text}",
            $"{text}\n",
            text.Replace("{\"schema\"", "{\"claimId\":\"00000000000000000000000000000000\",\"schema\"", StringComparison.Ordinal),
            text.Replace("\"claimId\"", "\"unknown\":true,\"claimId\"", StringComparison.Ordinal),
            text.Replace("\"claimId\":", $"\"claimId\":\"{request.ClaimId}\",\"claimId\":", StringComparison.Ordinal),
            text.Replace("tinyrustlm", "tin\\u0079rustlm", StringComparison.Ordinal)
        })
        {
            AssertCode(
                "json-invalid",
                () => CompanionLoopbackWire.DecodePairingBeginRequest(
                    System.Text.Encoding.UTF8.GetBytes(invalid)));
        }

        var clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 24, 12, 0, 0, TimeSpan.Zero));
        using var state = NewState(clock, new RepeatingCryptographicRandom(0x10, 0x20, 0x30));
        var issued = state.IssuePairingCode();
        var secret = PairingSecret(issued);
        var begin = state.BeginPairing(request);
        var beginBytes = CompanionLoopbackWire.EncodePairingBeginResponse(begin);
        Assert.Equal(begin, CompanionLoopbackWire.DecodePairingBeginResponse(beginBytes));
        var context = PairingContext(begin);
        var key = CompanionLoopbackProtocol.DeriveSessionKey(secret, context);
        try
        {
            var completeRequest = CompleteRequest(
                begin,
                CompanionLoopbackProtocol.ComputePairingBrowserProof(key, context));
            var completeRequestBytes = CompanionLoopbackWire.EncodePairingCompleteRequest(
                completeRequest);
            Assert.Equal(
                completeRequest,
                CompanionLoopbackWire.DecodePairingCompleteRequest(completeRequestBytes));
            var complete = state.CompletePairing(completeRequest);
            var completeBytes = CompanionLoopbackWire.EncodePairingCompleteResponse(complete);
            Assert.Equal(
                complete,
                CompanionLoopbackWire.DecodePairingCompleteResponse(completeBytes));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(secret);
            CryptographicOperations.ZeroMemory(key);
        }
    }

    [Fact]
    public void PairingIsProofBoundIdempotentAndSingleUse()
    {
        var clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 24, 12, 0, 0, TimeSpan.Zero));
        using var state = NewState(clock, new RepeatingCryptographicRandom(0x10, 0x20, 0x30));
        var issued = state.IssuePairingCode();
        var pairingSecret = PairingSecret(issued);
        var beginRequest = BeginRequest(0x40);

        var begin = state.BeginPairing(beginRequest);
        var replay = state.BeginPairing(beginRequest);
        Assert.Equal(begin, replay);
        Assert.Equal(1, state.PendingPairingCount);

        var context = PairingContext(begin);
        Assert.True(CompanionLoopbackProtocol.VerifyPairingServerProof(
            pairingSecret,
            context,
            begin.PairingProof));
        var sessionKey = CompanionLoopbackProtocol.DeriveSessionKey(pairingSecret, context);
        var completeRequest = CompleteRequest(
            begin,
            CompanionLoopbackProtocol.ComputePairingBrowserProof(sessionKey, context));

        var complete = state.CompletePairing(completeRequest);
        var completeReplay = state.CompletePairing(completeRequest);
        Assert.Equal(complete, completeReplay);
        Assert.Equal(1, state.ActiveSessionCount);
        Assert.Equal(0, state.PendingPairingCount);
        Assert.True(CompanionLoopbackProtocol.VerifyPairingCompletionProof(
            sessionKey,
            context,
            CompanionLoopbackProtocol.Sha256Hex(
                CompanionLoopbackWire.EncodePairingCompleteRequest(completeRequest)),
            complete.CompletionProof));

        AssertCode(
            "pairing-consumed",
            () => state.CompletePairing(completeRequest with
            {
                BrowserProof = MutateProof(completeRequest.BrowserProof)
            }));
        AssertCode("pairing-consumed", () => state.BeginPairing(BeginRequest(0x41)));
    }

    [Fact]
    public void InvalidProofDoesNotConsumeSecretOrCreateSession()
    {
        var clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 24, 12, 0, 0, TimeSpan.Zero));
        using var state = NewState(clock, new RepeatingCryptographicRandom(0x10, 0x20, 0x30));
        var issued = state.IssuePairingCode();
        var pairingSecret = PairingSecret(issued);
        var begin = state.BeginPairing(BeginRequest(0x40));
        var context = PairingContext(begin);
        var sessionKey = CompanionLoopbackProtocol.DeriveSessionKey(pairingSecret, context);
        var valid = CompleteRequest(
            begin,
            CompanionLoopbackProtocol.ComputePairingBrowserProof(sessionKey, context));

        AssertCode(
            "pairing-proof-invalid",
            () => state.CompletePairing(valid with { BrowserProof = MutateProof(valid.BrowserProof) }));
        Assert.Equal(0, state.ActiveSessionCount);
        Assert.Equal(1, state.PendingPairingCount);

        state.CompletePairing(valid);
        Assert.Equal(1, state.ActiveSessionCount);
    }

    [Fact]
    public void PairingEnforcesExpiryCapacityAndRollingRateLimits()
    {
        var clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 24, 12, 0, 0, TimeSpan.Zero));
        using var expiring = NewState(
            clock,
            new RepeatingCryptographicRandom(0x10, 0x20, 0x30));
        expiring.IssuePairingCode();
        var begin = expiring.BeginPairing(BeginRequest(0x40));
        clock.Advance(TimeSpan.FromSeconds(31));
        AssertCode(
            "pairing-code-expired",
            () => expiring.CompletePairing(CompleteRequest(begin, Proof(0x55))));

        clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 24, 12, 30, 0, TimeSpan.Zero));
        using var codeExpiry = NewState(clock, new RepeatingCryptographicRandom(0x10));
        codeExpiry.IssuePairingCode();
        clock.Advance(TimeSpan.FromSeconds(301));
        AssertCode("pairing-code-expired", () => codeExpiry.BeginPairing(BeginRequest(0x40)));

        clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 24, 13, 0, 0, TimeSpan.Zero));
        using var capacity = NewState(
            clock,
            new RepeatingCryptographicRandom(
                0x10,
                0x20, 0x30,
                0x21, 0x31,
                0x22, 0x32,
                0x23, 0x33));
        capacity.IssuePairingCode();
        for (var index = 0; index < 4; index++)
        {
            capacity.BeginPairing(BeginRequest(checked((byte)(0x40 + index))));
        }
        AssertCode("pairing-capacity", () => capacity.BeginPairing(BeginRequest(0x50)));

        clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 24, 14, 0, 0, TimeSpan.Zero));
        using var rate = NewState(
            clock,
            new RepeatingCryptographicRandom(
                0x10,
                0x20, 0x30,
                0x21, 0x31,
                0x22, 0x32,
                0x23, 0x33));
        rate.IssuePairingCode();
        var repeated = BeginRequest(0x40);
        for (var index = 0; index < 8; index++)
        {
            rate.BeginPairing(repeated);
        }
        AssertCode("resource-limit", () => rate.BeginPairing(repeated));
        clock.Advance(TimeSpan.FromSeconds(60));
        var fresh = BeginRequest(0x41);
        Assert.Equal(rate.BeginPairing(fresh), rate.BeginPairing(fresh));
    }

    [Fact]
    public async Task ConcurrentClaimsCreateExactlyOneSession()
    {
        var clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 24, 12, 0, 0, TimeSpan.Zero));
        using var state = NewState(
            clock,
            new RepeatingCryptographicRandom(0x10, 0x20, 0x30, 0x21, 0x31));
        var issued = state.IssuePairingCode();
        var secret = PairingSecret(issued);
        var firstBegin = state.BeginPairing(BeginRequest(0x40));
        var secondBegin = state.BeginPairing(BeginRequest(0x41));
        var firstKey = CompanionLoopbackProtocol.DeriveSessionKey(secret, PairingContext(firstBegin));
        var secondKey = CompanionLoopbackProtocol.DeriveSessionKey(secret, PairingContext(secondBegin));
        var firstRequest = CompleteRequest(
            firstBegin,
            CompanionLoopbackProtocol.ComputePairingBrowserProof(firstKey, PairingContext(firstBegin)));
        var secondRequest = CompleteRequest(
            secondBegin,
            CompanionLoopbackProtocol.ComputePairingBrowserProof(secondKey, PairingContext(secondBegin)));
        using var start = new ManualResetEventSlim(false);
        try
        {
            var tasks = new[]
            {
                Task.Run(() => CompleteAfterSignal(state, firstRequest, start)),
                Task.Run(() => CompleteAfterSignal(state, secondRequest, start))
            };
            start.Set();
            var results = await Task.WhenAll(tasks);
            Assert.Single(results, result => result == "success");
            Assert.Single(results, result => result == "pairing-consumed");
            Assert.Equal(1, state.ActiveSessionCount);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(secret);
            CryptographicOperations.ZeroMemory(firstKey);
            CryptographicOperations.ZeroMemory(secondKey);
        }
    }

    [Fact]
    public void PairingEnforcesFourActiveSessionCeiling()
    {
        var clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 24, 12, 0, 0, TimeSpan.Zero));
        using var state = NewState(clock, new CounterCryptographicRandom());
        for (byte index = 0; index < 4; index++)
        {
            PairOne(state, index);
        }
        Assert.Equal(4, state.ActiveSessionCount);

        var issued = state.IssuePairingCode();
        var secret = PairingSecret(issued);
        var begin = state.BeginPairing(BeginRequest(0x70));
        var context = PairingContext(begin);
        var key = CompanionLoopbackProtocol.DeriveSessionKey(secret, context);
        try
        {
            var request = CompleteRequest(
                begin,
                CompanionLoopbackProtocol.ComputePairingBrowserProof(key, context));
            AssertCode("pairing-capacity", () => state.CompletePairing(request));
            Assert.Equal(4, state.ActiveSessionCount);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(secret);
            CryptographicOperations.ZeroMemory(key);
        }
    }

    [Fact]
    public void SessionCommitsOnlyValidExactNextProofAndAllowsOneInFlight()
    {
        var fixture = PairedState();
        using var state = fixture.State;
        using var sessionKey = fixture.SessionKey;

        var firstRequest = SessionRequest(fixture, 1);
        using var first = state.Authenticate(firstRequest);
        Assert.Equal<ulong>(1, first.AcceptedSequence);
        Assert.Equal<ulong?>(2, first.NextSequence);

        var secondRequest = SessionRequest(fixture, 2);
        AssertCode("session-request-in-flight", () => state.Authenticate(secondRequest));
        var firstResponse = first.MaterializeResponse(
            422,
            "application/json",
            "{\"schema\":\"tinyrustlm.companion.loopback.error.v1\",\"code\":\"contract-invalid\"}"u8,
            CompanionLoopbackProtocol.EmptySha256);
        Assert.True(CompanionLoopbackProtocol.VerifyResponseProof(
            sessionKey.Bytes,
            firstResponse.Context,
            firstResponse.Proof));

        AssertCode(
            "capability-sequence",
            () => state.Authenticate(SessionRequest(fixture, 3)));
        AssertCode(
            "capability-invalid",
            () => state.Authenticate(secondRequest with
            {
                Proof = MutateProof(secondRequest.Proof)
            }));

        using var second = state.Authenticate(secondRequest);
        Assert.Equal<ulong>(2, second.AcceptedSequence);
        second.MaterializeResponse(
            200,
            "application/json",
            "{}"u8,
            CompanionLoopbackProtocol.EmptySha256);
    }

    [Fact]
    public void SessionEnforcesIdleAndKeyEpochExpiryWithoutConsumingSequence()
    {
        var idleFixture = PairedState();
        using (idleFixture.State)
        using (idleFixture.SessionKey)
        {
            idleFixture.Clock.Advance(TimeSpan.FromSeconds(901));
            AssertCode(
                "capability-idle-expired",
                () => idleFixture.State.Authenticate(SessionRequest(idleFixture, 1)));
        }

        var keyFixture = PairedState();
        using (keyFixture.State)
        using (keyFixture.SessionKey)
        {
            keyFixture.Clock.Advance(TimeSpan.FromSeconds(899));
            using (var first = keyFixture.State.Authenticate(SessionRequest(keyFixture, 1)))
            {
                first.MaterializeResponse(
                    200,
                    "application/json",
                    "{}"u8,
                    CompanionLoopbackProtocol.EmptySha256);
            }
            keyFixture.Clock.Advance(TimeSpan.FromSeconds(2));
            AssertCode(
                "capability-expired",
                () => keyFixture.State.Authenticate(SessionRequest(keyFixture, 2)));
        }
    }

    [Fact]
    public void SessionRateLimitDoesNotConsumeRejectedSequence()
    {
        var fixture = PairedState();
        using var state = fixture.State;
        using var sessionKey = fixture.SessionKey;
        for (ulong sequence = 1; sequence <= 600; sequence++)
        {
            using var lease = state.Authenticate(SessionRequest(fixture, sequence));
            lease.MaterializeResponse(
                200,
                "application/json",
                "{}"u8,
                CompanionLoopbackProtocol.EmptySha256);
        }
        AssertCode("resource-limit", () => state.Authenticate(SessionRequest(fixture, 601)));
        fixture.Clock.Advance(TimeSpan.FromSeconds(60));
        using var accepted = state.Authenticate(SessionRequest(fixture, 601));
        Assert.Equal<ulong>(601, accepted.AcceptedSequence);
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
        {
            Directory.Delete(_root, recursive: true);
        }
    }

    private static CompanionCapabilityState NewState(
        TimeProvider clock,
        ICompanionCryptographicRandom random) =>
        new(
            new string('a', 32),
            new string('b', 32),
            54321,
            clock,
            random);

    private static PairedFixture PairedState()
    {
        var clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 24, 12, 0, 0, TimeSpan.Zero));
        var state = NewState(clock, new RepeatingCryptographicRandom(0x10, 0x20, 0x30));
        var issued = state.IssuePairingCode();
        var secret = PairingSecret(issued);
        var begin = state.BeginPairing(BeginRequest(0x40));
        var context = PairingContext(begin);
        var key = CompanionLoopbackProtocol.DeriveSessionKey(secret, context);
        var complete = CompleteRequest(
            begin,
            CompanionLoopbackProtocol.ComputePairingBrowserProof(key, context));
        state.CompletePairing(complete);
        CryptographicOperations.ZeroMemory(secret);
        return new PairedFixture(state, clock, begin, new SecretKey(key));
    }

    private static void PairOne(CompanionCapabilityState state, byte index)
    {
        var issued = state.IssuePairingCode();
        var secret = PairingSecret(issued);
        var begin = state.BeginPairing(BeginRequest(checked((byte)(0x50 + index))));
        var context = PairingContext(begin);
        var key = CompanionLoopbackProtocol.DeriveSessionKey(secret, context);
        try
        {
            state.CompletePairing(CompleteRequest(
                begin,
                CompanionLoopbackProtocol.ComputePairingBrowserProof(key, context)));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(secret);
            CryptographicOperations.ZeroMemory(key);
        }
    }

    private static string CompleteAfterSignal(
        CompanionCapabilityState state,
        CompanionPairingCompleteRequest request,
        ManualResetEventSlim start)
    {
        start.Wait();
        try
        {
            state.CompletePairing(request);
            return "success";
        }
        catch (CompanionProtocolException exception)
        {
            return exception.Code;
        }
    }

    private static void IntroducePermissionDrift(string root)
    {
        if (OperatingSystem.IsWindows())
        {
            var security = new DirectoryInfo(root).GetAccessControl();
            security.AddAccessRule(new FileSystemAccessRule(
                new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid, null),
                FileSystemRights.Read,
                InheritanceFlags.None,
                PropagationFlags.None,
                AccessControlType.Allow));
            new DirectoryInfo(root).SetAccessControl(security);
            return;
        }
        if (OperatingSystem.IsLinux())
        {
            File.SetUnixFileMode(
                root,
                UnixFileMode.UserRead |
                UnixFileMode.UserWrite |
                UnixFileMode.UserExecute |
                UnixFileMode.GroupRead);
            return;
        }
        throw new PlatformNotSupportedException();
    }

    private static CompanionPairingBeginRequest BeginRequest(byte nonce) =>
        new(
            CompanionLoopbackWire.PairingBeginRequestSchema,
            Convert.ToHexString(Enumerable.Repeat(nonce, 16).ToArray()).ToLowerInvariant(),
            CompanionLoopbackProtocol.EncodeBase64Url(Enumerable.Repeat(nonce, 32).ToArray()));

    private static CompanionPairingCompleteRequest CompleteRequest(
        CompanionPairingBeginResponse begin,
        string proof) =>
        new(
            CompanionLoopbackWire.PairingCompleteRequestSchema,
            begin.ClaimId,
            begin.BrowserNonce,
            begin.ServerNonce,
            begin.SessionId,
            proof);

    private static CompanionPairingProofContext PairingContext(
        CompanionPairingBeginResponse response) =>
        new(
            response.InstallationId,
            response.ProcessInstanceId,
            response.ClaimId,
            response.BrowserNonce,
            response.ServerNonce,
            response.SessionId,
            response.KeyEpoch,
            "127.0.0.1:54321",
            CompanionLoopbackProtocol.ProductionOrigin,
            response.SessionExpiresAtUtc,
            response.IdleTimeoutSeconds);

    private static CompanionSessionAuthenticationRequest SessionRequest(
        PairedFixture fixture,
        ulong sequence)
    {
        var context = new CompanionRequestProofContext(
            fixture.Begin.InstallationId,
            fixture.Begin.ProcessInstanceId,
            fixture.Begin.SessionId,
            1,
            sequence,
            "GET",
            "127.0.0.1:54321",
            CompanionLoopbackProtocol.ProductionOrigin,
            "/tinyrustlm-companion/1/session",
            "",
            0,
            CompanionLoopbackProtocol.EmptySha256);
        return new CompanionSessionAuthenticationRequest(
            context,
            CompanionLoopbackProtocol.ComputeRequestProof(fixture.SessionKey.Bytes, context));
    }

    private static byte[] PairingSecret(CompanionIssuedPairingCode issued)
    {
        var fields = issued.Code.Split(':');
        Assert.Equal(3, fields.Length);
        Assert.Equal("TRLC1", fields[0]);
        Assert.Equal("54321", fields[1]);
        return CompanionLoopbackProtocol.DecodeBase64Url32(fields[2], "test-pairing-secret");
    }

    private static string Proof(byte value) =>
        CompanionLoopbackProtocol.EncodeBase64Url(Enumerable.Repeat(value, 32).ToArray());

    private static string MutateProof(string proof) =>
        string.Concat(proof[0] == 'A' ? 'B' : 'A', proof[1..]);

    private static void AssertCode(string code, Action action)
    {
        var exception = Assert.Throws<CompanionProtocolException>(action);
        Assert.Equal(code, exception.Code);
    }

    private sealed class RepeatingCryptographicRandom(params byte[] values)
        : ICompanionCryptographicRandom
    {
        private readonly Queue<byte> _values = new(values);

        public void Fill(Span<byte> destination)
        {
            if (_values.Count == 0)
            {
                throw new InvalidOperationException("No deterministic random value remains.");
            }
            destination.Fill(_values.Dequeue());
        }
    }

    private sealed class CounterCryptographicRandom : ICompanionCryptographicRandom
    {
        private byte _next = 1;

        public void Fill(Span<byte> destination)
        {
            destination.Fill(_next);
            _next = checked((byte)(_next + 1));
        }
    }

    private sealed class ManualTimeProvider(DateTimeOffset initial) : TimeProvider
    {
        private DateTimeOffset _utcNow = initial;
        private long _timestamp;

        public override DateTimeOffset GetUtcNow() => _utcNow;

        public override long GetTimestamp() => _timestamp;

        public override long TimestampFrequency => TimeSpan.TicksPerSecond;

        public void Advance(TimeSpan duration)
        {
            _utcNow += duration;
            _timestamp = checked(_timestamp + duration.Ticks);
        }
    }

    private sealed class SecretKey(byte[] bytes) : IDisposable
    {
        public byte[] Bytes { get; } = bytes;

        public void Dispose() => CryptographicOperations.ZeroMemory(Bytes);
    }

    private sealed record PairedFixture(
        CompanionCapabilityState State,
        ManualTimeProvider Clock,
        CompanionPairingBeginResponse Begin,
        SecretKey SessionKey);
}
