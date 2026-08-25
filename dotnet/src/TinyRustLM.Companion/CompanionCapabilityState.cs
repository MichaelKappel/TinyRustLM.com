using System.Globalization;
using System.Security.Cryptography;

namespace TinyRustLM.Companion;

public sealed class CompanionCapabilityState : IDisposable
{
    public const int MaximumPendingPairings = 4;
    public const int MaximumActiveSessions = 4;
    public const uint InitialKeyEpoch = 1;
    public const uint IdleTimeoutSeconds = 900;

    private static readonly TimeSpan PairingCodeLifetime = TimeSpan.FromSeconds(300);
    private static readonly TimeSpan PendingPairingLifetime = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan PairingReplayLifetime = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan SessionAbsoluteLifetime = TimeSpan.FromSeconds(28_800);
    private static readonly TimeSpan SessionIdleLifetime = TimeSpan.FromSeconds(900);
    private static readonly TimeSpan KeyEpochLifetime = TimeSpan.FromSeconds(900);
    private static readonly TimeSpan RateWindow = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan TerminalSessionRetention = TimeSpan.FromMinutes(1);

    private readonly object _gate = new();
    private readonly string _installationId;
    private readonly string _processInstanceId;
    private readonly string _host;
    private readonly TimeProvider _timeProvider;
    private readonly ICompanionCryptographicRandom _random;
    private readonly Dictionary<string, PendingPairing> _pending = new(StringComparer.Ordinal);
    private readonly Dictionary<string, PairingClaimTombstone> _claimTombstones =
        new(StringComparer.Ordinal);
    private readonly Dictionary<string, PairingCompletionReplay> _completionReplays =
        new(StringComparer.Ordinal);
    private readonly Dictionary<string, SessionState> _sessions = new(StringComparer.Ordinal);
    private readonly SlidingWindowCounter _beginRate = new(8);
    private readonly SlidingWindowCounter _completeRate = new(8);
    private PairingCodeState? _pairingCode;
    private bool _disposed;

    public CompanionCapabilityState(
        string installationId,
        string processInstanceId,
        ushort port)
        : this(
            installationId,
            processInstanceId,
            port,
            TimeProvider.System,
            SystemCryptographicRandom.Instance)
    {
    }

    internal CompanionCapabilityState(
        string installationId,
        string processInstanceId,
        ushort port,
        TimeProvider timeProvider,
        ICompanionCryptographicRandom random)
    {
        CompanionLoopbackProtocol.RequireHexIdentifier(
            installationId,
            16,
            "installation-record-id");
        CompanionLoopbackProtocol.RequireHexIdentifier(
            processInstanceId,
            16,
            "process-instance-id");
        if (port < 1024)
        {
            throw new CompanionProtocolException("host-invalid");
        }
        _installationId = installationId;
        _processInstanceId = processInstanceId;
        _host = $"127.0.0.1:{port.ToString(CultureInfo.InvariantCulture)}";
        _timeProvider = timeProvider ?? throw new ArgumentNullException(nameof(timeProvider));
        _random = random ?? throw new ArgumentNullException(nameof(random));
    }

    public int PendingPairingCount
    {
        get
        {
            lock (_gate)
            {
                RequireNotDisposed();
                var now = _timeProvider.GetTimestamp();
                PrunePairing(now);
                return _pending.Count;
            }
        }
    }

    public int ActiveSessionCount
    {
        get
        {
            lock (_gate)
            {
                RequireNotDisposed();
                var now = _timeProvider.GetTimestamp();
                PruneSessions(now);
                return _sessions.Values.Count(session => session.TerminalCode is null);
            }
        }
    }

    public CompanionIssuedPairingCode IssuePairingCode()
    {
        lock (_gate)
        {
            RequireNotDisposed();
            var now = _timeProvider.GetTimestamp();
            PrunePairing(now);
            InvalidateCurrentPairing(now, "pairing-consumed");

            var secret = RandomBytes(32);
            var expiresAtUtc = FormatTimestamp(_timeProvider.GetUtcNow() + PairingCodeLifetime);
            _pairingCode = new PairingCodeState(secret, now);
            return new CompanionIssuedPairingCode(
                $"TRLC1:{_host.AsSpan("127.0.0.1:".Length)}:{CompanionLoopbackProtocol.EncodeBase64Url(secret)}",
                expiresAtUtc);
        }
    }

    public CompanionPairingBeginResponse BeginPairing(
        CompanionPairingBeginRequest request)
    {
        var requestBytes = CompanionLoopbackWire.EncodePairingBeginRequest(request);
        var requestSha256 = CompanionLoopbackProtocol.Sha256Hex(requestBytes);
        lock (_gate)
        {
            RequireNotDisposed();
            var now = _timeProvider.GetTimestamp();
            PrunePairing(now);
            _beginRate.Take(_timeProvider, now, "resource-limit");

            if (_claimTombstones.TryGetValue(request.ClaimId, out var tombstone))
            {
                throw new CompanionProtocolException(tombstone.Code);
            }
            var pairingCode = RequireUsablePairingCode(now);
            if (_pending.TryGetValue(request.ClaimId, out var existing))
            {
                if (!string.Equals(existing.RequestSha256, requestSha256, StringComparison.Ordinal))
                {
                    throw new CompanionProtocolException("pairing-claim-conflict");
                }
                return existing.Response;
            }
            if (_pending.Count >= MaximumPendingPairings)
            {
                throw new CompanionProtocolException("pairing-capacity");
            }

            var serverNonce = CompanionLoopbackProtocol.EncodeBase64Url(RandomBytes(32));
            var sessionId = RandomIdentifier(16);
            var sessionExpiresAtUtc = FormatTimestamp(
                _timeProvider.GetUtcNow() + SessionAbsoluteLifetime);
            var context = new CompanionPairingProofContext(
                _installationId,
                _processInstanceId,
                request.ClaimId,
                request.BrowserNonce,
                serverNonce,
                sessionId,
                InitialKeyEpoch,
                _host,
                CompanionLoopbackProtocol.ProductionOrigin,
                sessionExpiresAtUtc,
                IdleTimeoutSeconds);
            var response = new CompanionPairingBeginResponse(
                CompanionLoopbackWire.PairingBeginResponseSchema,
                CompanionLoopbackProtocol.ProtocolId,
                _installationId,
                _processInstanceId,
                request.ClaimId,
                request.BrowserNonce,
                serverNonce,
                sessionId,
                InitialKeyEpoch,
                sessionExpiresAtUtc,
                IdleTimeoutSeconds,
                CompanionLoopbackProtocol.ComputePairingServerProof(
                    pairingCode.Secret,
                    context));
            _ = CompanionLoopbackWire.EncodePairingBeginResponse(response);
            _pending.Add(
                request.ClaimId,
                new PendingPairing(requestSha256, context, response, now));
            return response;
        }
    }

    public CompanionPairingCompleteResponse CompletePairing(
        CompanionPairingCompleteRequest request)
    {
        var requestBytes = CompanionLoopbackWire.EncodePairingCompleteRequest(request);
        var requestSha256 = CompanionLoopbackProtocol.Sha256Hex(requestBytes);
        lock (_gate)
        {
            RequireNotDisposed();
            var now = _timeProvider.GetTimestamp();
            PrunePairing(now);
            _completeRate.Take(_timeProvider, now, "resource-limit");

            if (_completionReplays.TryGetValue(requestSha256, out var replay))
            {
                return replay.Response;
            }
            if (_claimTombstones.TryGetValue(request.ClaimId, out var tombstone))
            {
                throw new CompanionProtocolException(tombstone.Code);
            }
            var pairingCode = RequireUsablePairingCode(now);
            if (!_pending.TryGetValue(request.ClaimId, out var pending) ||
                !string.Equals(request.BrowserNonce, pending.Context.BrowserNonce, StringComparison.Ordinal) ||
                !string.Equals(request.ServerNonce, pending.Context.ServerNonce, StringComparison.Ordinal) ||
                !string.Equals(request.SessionId, pending.Context.SessionId, StringComparison.Ordinal))
            {
                throw new CompanionProtocolException("pairing-proof-invalid");
            }

            var sessionKey = CompanionLoopbackProtocol.DeriveSessionKey(
                pairingCode.Secret,
                pending.Context);
            var keyTransferred = false;
            try
            {
                if (!CompanionLoopbackProtocol.VerifyPairingBrowserProof(
                        sessionKey,
                        pending.Context,
                        request.BrowserProof))
                {
                    throw new CompanionProtocolException("pairing-proof-invalid");
                }

                PruneSessions(now);
                if (_sessions.Values.Count(session => session.TerminalCode is null) >=
                    MaximumActiveSessions)
                {
                    throw new CompanionProtocolException("pairing-capacity");
                }
                if (_sessions.ContainsKey(pending.Context.SessionId))
                {
                    throw new CompanionProtocolException("pairing-claim-conflict");
                }

                var completionProof = CompanionLoopbackProtocol.ComputePairingCompletionProof(
                    sessionKey,
                    pending.Context,
                    requestSha256);
                var response = new CompanionPairingCompleteResponse(
                    CompanionLoopbackWire.PairingCompleteResponseSchema,
                    CompanionLoopbackProtocol.ProtocolId,
                    _installationId,
                    _processInstanceId,
                    pending.Context.SessionId,
                    InitialKeyEpoch,
                    pending.Context.SessionExpiresAtUtc,
                    IdleTimeoutSeconds,
                    completionProof);
                _ = CompanionLoopbackWire.EncodePairingCompleteResponse(response);

                _sessions.Add(
                    pending.Context.SessionId,
                    new SessionState(
                        pending.Context.SessionId,
                        sessionKey,
                        now,
                        _timeProvider.GetUtcNow()));
                keyTransferred = true;
                foreach (var claimId in _pending.Keys)
                {
                    _claimTombstones[claimId] = new PairingClaimTombstone(
                        "pairing-consumed",
                        now);
                }
                _pending.Clear();
                pairingCode.Terminate("pairing-consumed");
                _completionReplays.Add(
                    requestSha256,
                    new PairingCompletionReplay(response, now));
                return response;
            }
            finally
            {
                if (!keyTransferred)
                {
                    CryptographicOperations.ZeroMemory(sessionKey);
                }
            }
        }
    }

    public CompanionSessionLease Authenticate(
        CompanionSessionAuthenticationRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(request.Context);
        lock (_gate)
        {
            RequireNotDisposed();
            var context = request.Context;
            if (!string.Equals(context.InstallationId, _installationId, StringComparison.Ordinal) ||
                !string.Equals(context.ProcessInstanceId, _processInstanceId, StringComparison.Ordinal) ||
                !string.Equals(context.Host, _host, StringComparison.Ordinal) ||
                !string.Equals(
                    context.Origin,
                    CompanionLoopbackProtocol.ProductionOrigin,
                    StringComparison.Ordinal))
            {
                throw new CompanionProtocolException("capability-invalid");
            }

            var now = _timeProvider.GetTimestamp();
            PruneSessions(now);
            if (!_sessions.TryGetValue(context.SessionId, out var session))
            {
                throw new CompanionProtocolException("capability-invalid");
            }
            if (session.TerminalCode is not null)
            {
                throw new CompanionProtocolException(session.TerminalCode);
            }
            if (context.KeyEpoch != session.KeyEpoch)
            {
                throw new CompanionProtocolException("capability-invalid");
            }

            bool proofValid;
            try
            {
                proofValid = CompanionLoopbackProtocol.VerifyRequestProof(
                    session.Key,
                    context,
                    request.Proof);
            }
            catch (CompanionProtocolException)
            {
                throw new CompanionProtocolException("capability-invalid");
            }
            if (!proofValid)
            {
                throw new CompanionProtocolException("capability-invalid");
            }
            if (context.Sequence != session.AcceptedSequence + 1)
            {
                throw new CompanionProtocolException("capability-sequence");
            }
            if (session.InFlight)
            {
                throw new CompanionProtocolException("session-request-in-flight");
            }
            session.RequestRate.Take(_timeProvider, now, "resource-limit");

            session.InFlight = true;
            session.AcceptedSequence = context.Sequence;
            session.LastActivityTimestamp = now;
            var key = session.Key.ToArray();
            return new CompanionSessionLease(
                this,
                session,
                context,
                key,
                session.AcceptedSequence,
                session.AcceptedSequence + 1);
        }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            if (_disposed)
            {
                return;
            }
            _disposed = true;
            _pairingCode?.Terminate("pairing-consumed");
            _pending.Clear();
            _claimTombstones.Clear();
            _completionReplays.Clear();
            foreach (var session in _sessions.Values)
            {
                session.EraseKey();
            }
            _sessions.Clear();
        }
    }

    internal void Release(SessionState session)
    {
        lock (_gate)
        {
            session.InFlight = false;
        }
    }

    private PairingCodeState RequireUsablePairingCode(long now)
    {
        if (_pairingCode is null)
        {
            throw new CompanionProtocolException("pairing-code-expired");
        }
        if (_pairingCode.TerminalCode is not null)
        {
            throw new CompanionProtocolException(_pairingCode.TerminalCode);
        }
        if (Elapsed(_pairingCode.IssuedTimestamp, now) >= PairingCodeLifetime)
        {
            ExpireCurrentPairing(now);
            throw new CompanionProtocolException("pairing-code-expired");
        }
        return _pairingCode;
    }

    private void PrunePairing(long now)
    {
        foreach (var pair in _completionReplays
                     .Where(pair => Elapsed(pair.Value.CreatedTimestamp, now) >= PairingReplayLifetime)
                     .ToArray())
        {
            _completionReplays.Remove(pair.Key);
        }
        foreach (var pair in _claimTombstones
                     .Where(pair => Elapsed(pair.Value.CreatedTimestamp, now) >= PairingReplayLifetime)
                     .ToArray())
        {
            _claimTombstones.Remove(pair.Key);
        }
        foreach (var pair in _pending
                     .Where(pair => Elapsed(pair.Value.CreatedTimestamp, now) >= PendingPairingLifetime)
                     .ToArray())
        {
            _pending.Remove(pair.Key);
            _claimTombstones[pair.Key] = new PairingClaimTombstone(
                "pairing-code-expired",
                now);
        }
        if (_pairingCode is { TerminalCode: null } pairingCode &&
            Elapsed(pairingCode.IssuedTimestamp, now) >= PairingCodeLifetime)
        {
            ExpireCurrentPairing(now);
        }
    }

    private void PruneSessions(long now)
    {
        foreach (var session in _sessions.Values)
        {
            if (session.TerminalCode is not null)
            {
                continue;
            }
            if (Elapsed(session.CreatedTimestamp, now) >= SessionAbsoluteLifetime)
            {
                session.Terminate("capability-expired", now);
            }
            else if (Elapsed(session.LastActivityTimestamp, now) >= SessionIdleLifetime)
            {
                session.Terminate("capability-idle-expired", now);
            }
            else if (Elapsed(session.KeyEpochTimestamp, now) >= KeyEpochLifetime)
            {
                session.Terminate("capability-expired", now);
            }
        }
        foreach (var pair in _sessions
                     .Where(pair => pair.Value.TerminalTimestamp is long terminal &&
                         Elapsed(terminal, now) >= TerminalSessionRetention)
                     .ToArray())
        {
            pair.Value.EraseKey();
            _sessions.Remove(pair.Key);
        }
    }

    private void InvalidateCurrentPairing(long now, string code)
    {
        if (_pairingCode is null)
        {
            return;
        }
        foreach (var claimId in _pending.Keys)
        {
            _claimTombstones[claimId] = new PairingClaimTombstone(code, now);
        }
        _pending.Clear();
        _pairingCode.Terminate(code);
    }

    private void ExpireCurrentPairing(long now)
    {
        InvalidateCurrentPairing(now, "pairing-code-expired");
    }

    private byte[] RandomBytes(int count)
    {
        var value = GC.AllocateUninitializedArray<byte>(count);
        try
        {
            _random.Fill(value);
            return value;
        }
        catch
        {
            CryptographicOperations.ZeroMemory(value);
            throw;
        }
    }

    private string RandomIdentifier(int bytes)
    {
        var value = RandomBytes(bytes);
        try
        {
            return Convert.ToHexString(value).ToLowerInvariant();
        }
        finally
        {
            CryptographicOperations.ZeroMemory(value);
        }
    }

    private TimeSpan Elapsed(long start, long end)
    {
        var elapsed = _timeProvider.GetElapsedTime(start, end);
        if (elapsed < TimeSpan.Zero)
        {
            throw new CompanionProtocolException("monotonic-clock-invalid");
        }
        return elapsed;
    }

    private static string FormatTimestamp(DateTimeOffset value) =>
        value.ToUniversalTime().ToString(
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            CultureInfo.InvariantCulture);

    private void RequireNotDisposed()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
    }

    private sealed class PairingCodeState(byte[] secret, long issuedTimestamp)
    {
        internal byte[] Secret { get; } = secret;
        internal long IssuedTimestamp { get; } = issuedTimestamp;
        internal string? TerminalCode { get; private set; }

        internal void Terminate(string code)
        {
            if (TerminalCode is not null)
            {
                return;
            }
            CryptographicOperations.ZeroMemory(Secret);
            TerminalCode = code;
        }
    }

    private sealed record PendingPairing(
        string RequestSha256,
        CompanionPairingProofContext Context,
        CompanionPairingBeginResponse Response,
        long CreatedTimestamp);

    private sealed record PairingClaimTombstone(string Code, long CreatedTimestamp);

    private sealed record PairingCompletionReplay(
        CompanionPairingCompleteResponse Response,
        long CreatedTimestamp);

    internal sealed class SessionState(
        string sessionId,
        byte[] key,
        long createdTimestamp,
        DateTimeOffset createdAtUtc)
    {
        internal string SessionId { get; } = sessionId;
        internal byte[] Key { get; } = key;
        internal long CreatedTimestamp { get; } = createdTimestamp;
        internal DateTimeOffset CreatedAtUtc { get; } = createdAtUtc;
        internal long LastActivityTimestamp { get; set; } = createdTimestamp;
        internal long KeyEpochTimestamp { get; set; } = createdTimestamp;
        internal uint KeyEpoch { get; set; } = InitialKeyEpoch;
        internal ulong AcceptedSequence { get; set; }
        internal bool InFlight { get; set; }
        internal SlidingWindowCounter RequestRate { get; } = new(600);
        internal string? TerminalCode { get; private set; }
        internal long? TerminalTimestamp { get; private set; }

        internal void Terminate(string code, long timestamp)
        {
            if (TerminalCode is not null)
            {
                return;
            }
            TerminalCode = code;
            TerminalTimestamp = timestamp;
            EraseKey();
        }

        internal void EraseKey() => CryptographicOperations.ZeroMemory(Key);
    }

    internal sealed class SlidingWindowCounter(int limit)
    {
        private readonly Queue<long> _accepted = new();

        internal void Take(TimeProvider timeProvider, long now, string code)
        {
            while (_accepted.TryPeek(out var oldest) &&
                   timeProvider.GetElapsedTime(oldest, now) >= RateWindow)
            {
                _accepted.Dequeue();
            }
            if (_accepted.Count >= limit)
            {
                throw new CompanionProtocolException(code);
            }
            _accepted.Enqueue(now);
        }
    }

    private sealed class SystemCryptographicRandom : ICompanionCryptographicRandom
    {
        internal static readonly SystemCryptographicRandom Instance = new();

        public void Fill(Span<byte> destination) => RandomNumberGenerator.Fill(destination);
    }
}

public sealed record CompanionIssuedPairingCode(string Code, string ExpiresAtUtc);

public sealed record CompanionSessionAuthenticationRequest(
    CompanionRequestProofContext Context,
    string Proof);

public sealed class CompanionSessionLease : IDisposable
{
    private readonly CompanionCapabilityState _owner;
    private readonly CompanionCapabilityState.SessionState _session;
    private readonly CompanionRequestProofContext _requestContext;
    private readonly byte[] _key;
    private int _finished;

    internal CompanionSessionLease(
        CompanionCapabilityState owner,
        CompanionCapabilityState.SessionState session,
        CompanionRequestProofContext requestContext,
        byte[] key,
        ulong acceptedSequence,
        ulong nextSequence)
    {
        _owner = owner;
        _session = session;
        _requestContext = requestContext;
        _key = key;
        AcceptedSequence = acceptedSequence;
        NextSequence = nextSequence;
    }

    public ulong AcceptedSequence { get; }

    public ulong NextSequence { get; }

    public CompanionProvenResponse MaterializeResponse(
        int status,
        string contentType,
        ReadOnlySpan<byte> body,
        string responseMetadataSha256)
    {
        if (Interlocked.Exchange(ref _finished, 1) != 0)
        {
            throw new CompanionProtocolException("session-response-already-materialized");
        }
        try
        {
            var bodyBytes = body.ToArray();
            var context = new CompanionResponseProofContext(
                _requestContext.InstallationId,
                _requestContext.ProcessInstanceId,
                _requestContext.SessionId,
                _requestContext.KeyEpoch,
                _requestContext.Sequence,
                _requestContext.Method,
                _requestContext.Path,
                status,
                contentType,
                checked((ulong)bodyBytes.Length),
                responseMetadataSha256,
                CompanionLoopbackProtocol.Sha256Hex(bodyBytes));
            var proof = CompanionLoopbackProtocol.ComputeResponseProof(_key, context);
            return new CompanionProvenResponse(bodyBytes, context, proof);
        }
        finally
        {
            Finish();
        }
    }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _finished, 1) == 0)
        {
            Finish();
        }
    }

    private void Finish()
    {
        CryptographicOperations.ZeroMemory(_key);
        _owner.Release(_session);
    }
}

public sealed class CompanionProvenResponse
{
    private readonly byte[] _body;

    internal CompanionProvenResponse(
        byte[] body,
        CompanionResponseProofContext context,
        string proof)
    {
        _body = body;
        Context = context;
        Proof = proof;
    }

    public CompanionResponseProofContext Context { get; }

    public string Proof { get; }

    public byte[] CopyBody() => _body.ToArray();
}
