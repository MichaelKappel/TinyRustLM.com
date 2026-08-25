using System.Globalization;
using System.Security.Cryptography;

namespace TinyRustLM.Companion;

public sealed class CompanionCapabilityState : IDisposable
{
    public const int MaximumPendingPairings = 4;
    public const int MaximumActiveSessions = 4;
    public const uint InitialKeyEpoch = 1;
    public const uint IdleTimeoutSeconds = 900;
    internal const int MaximumSessionRecordsPerProcess = 4_096;

    private static readonly TimeSpan PairingCodeLifetime = TimeSpan.FromSeconds(300);
    private static readonly TimeSpan PendingPairingLifetime = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan PairingReplayLifetime = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan SessionAbsoluteLifetime = TimeSpan.FromSeconds(28_800);
    private static readonly TimeSpan SessionIdleLifetime = TimeSpan.FromSeconds(900);
    private static readonly TimeSpan KeyEpochLifetime = TimeSpan.FromSeconds(900);
    private static readonly TimeSpan PendingRotationLifetime = TimeSpan.FromSeconds(120);
    private static readonly TimeSpan RotationReplayLifetime = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan RateWindow = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan TerminalSessionRetention = TimeSpan.FromMinutes(1);

    private readonly object _gate = new();
    private readonly string _installationId;
    private readonly string _processInstanceId;
    private readonly string _host;
    private readonly TimeProvider _timeProvider;
    private readonly ICompanionCryptographicRandom _random;
    private readonly int _maximumSessionRecords;
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
        : this(
            installationId,
            processInstanceId,
            port,
            timeProvider,
            random,
            MaximumSessionRecordsPerProcess)
    {
    }

    internal CompanionCapabilityState(
        string installationId,
        string processInstanceId,
        ushort port,
        TimeProvider timeProvider,
        ICompanionCryptographicRandom random,
        int maximumSessionRecords)
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
        if (maximumSessionRecords < MaximumActiveSessions)
        {
            throw new ArgumentOutOfRangeException(nameof(maximumSessionRecords));
        }
        _installationId = installationId;
        _processInstanceId = processInstanceId;
        _host = $"127.0.0.1:{port.ToString(CultureInfo.InvariantCulture)}";
        _timeProvider = timeProvider ?? throw new ArgumentNullException(nameof(timeProvider));
        _random = random ?? throw new ArgumentNullException(nameof(random));
        _maximumSessionRecords = maximumSessionRecords;
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
                if (_sessions.Count >= _maximumSessionRecords)
                {
                    throw new CompanionProtocolException("resource-limit");
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
                        pending.Context.SessionExpiresAtUtc,
                        FormatTimestamp(_timeProvider.GetUtcNow() + KeyEpochLifetime)));
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
            PruneRotation(session, now);
            if (context.KeyEpoch != session.KeyEpoch)
            {
                if (context.KeyEpoch < session.KeyEpoch)
                {
                    var replay = session.RotationReplay;
                    if (replay is not null && replay.Matches(request))
                    {
                        session.RequestRate.Take(_timeProvider, now, "resource-limit");
                        return CompanionSessionLease.CreateRotationReplay(
                            this,
                            session,
                            request,
                            replay);
                    }
                    throw new CompanionProtocolException("capability-revoked");
                }
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
                request,
                key,
                session.AcceptedSequence,
                session.AcceptedSequence < 1_000_000
                    ? session.AcceptedSequence + 1
                    : null,
                rotationReplay: null,
                ownsReservation: true);
        }
    }

    internal CompanionRotationChallenge BeginRotation(
        SessionState session,
        CompanionRequestProofContext authenticationContext,
        CompanionRotationBegin request)
    {
        var requestBytes = CompanionLoopbackWire.EncodeRotationBegin(request);
        RequireAuthenticatedBody(
            authenticationContext,
            requestBytes,
            "/tinyrustlm-companion/1/session/rotation/begin");
        var requestSha256 = CompanionLoopbackProtocol.Sha256Hex(requestBytes);
        lock (_gate)
        {
            RequireCurrentLease(session, authenticationContext);
            var now = _timeProvider.GetTimestamp();
            PruneRotation(session, now);
            if (session.ExpiredRotation is { } expired &&
                string.Equals(expired.RotationId, request.RotationId, StringComparison.Ordinal))
            {
                throw new CompanionProtocolException("rotation-expired");
            }
            if (session.PendingRotation is { } pending)
            {
                if (string.Equals(pending.RequestSha256, requestSha256, StringComparison.Ordinal))
                {
                    return pending.Challenge;
                }
                throw new CompanionProtocolException("rotation-conflict");
            }
            if (session.KeyEpoch >= 64)
            {
                throw new CompanionProtocolException("capability-expired");
            }

            var serverNonce = CompanionLoopbackProtocol.EncodeBase64Url(RandomBytes(32));
            var challenge = new CompanionRotationChallenge(
                CompanionLoopbackWire.RotationChallengeSchema,
                request.RotationId,
                request.BrowserNonce,
                serverNonce,
                session.KeyEpoch,
                session.KeyEpoch + 1,
                FormatTimestamp(_timeProvider.GetUtcNow() + PendingRotationLifetime));
            _ = CompanionLoopbackWire.EncodeRotationChallenge(challenge);
            var proofContext = RotationContext(session.SessionId, challenge);
            session.PendingRotation = new PendingRotation(
                requestSha256,
                proofContext,
                challenge,
                now);
            return challenge;
        }
    }

    internal CompanionSessionStatus SessionStatus(
        SessionState session,
        CompanionRequestProofContext authenticationContext)
    {
        if (authenticationContext.Method != "GET" ||
            authenticationContext.Path != "/tinyrustlm-companion/1/session" ||
            authenticationContext.ContentLength != 0 ||
            authenticationContext.ContentType.Length != 0 ||
            authenticationContext.ContentSha256 != CompanionLoopbackProtocol.EmptySha256)
        {
            throw new CompanionProtocolException("contract-invalid");
        }
        lock (_gate)
        {
            RequireCurrentLease(session, authenticationContext);
            var status = new CompanionSessionStatus(
                CompanionLoopbackWire.SessionStatusSchema,
                CompanionLoopbackProtocol.ProtocolId,
                _installationId,
                _processInstanceId,
                session.SessionId,
                session.KeyEpoch,
                session.AcceptedSequence,
                session.AcceptedSequence < 1_000_000
                    ? session.AcceptedSequence + 1
                    : null,
                session.SessionExpiresAtUtc,
                session.KeyExpiresAtUtc,
                IdleTimeoutSeconds);
            _ = CompanionLoopbackWire.EncodeSessionStatus(status);
            return status;
        }
    }

    internal CompanionProvenResponse CommitRotation(
        SessionState session,
        CompanionSessionAuthenticationRequest authentication,
        CompanionRotationCommit request)
    {
        var requestBytes = CompanionLoopbackWire.EncodeRotationCommit(request);
        RequireAuthenticatedBody(
            authentication.Context,
            requestBytes,
            "/tinyrustlm-companion/1/session/rotation/commit");
        var requestSha256 = CompanionLoopbackProtocol.Sha256Hex(requestBytes);
        lock (_gate)
        {
            RequireCurrentLease(session, authentication.Context);
            var now = _timeProvider.GetTimestamp();
            PruneRotation(session, now);
            if (session.ExpiredRotation is { } expired &&
                string.Equals(expired.RotationId, request.RotationId, StringComparison.Ordinal))
            {
                throw new CompanionProtocolException("rotation-expired");
            }
            var pending = session.PendingRotation ??
                throw new CompanionProtocolException("rotation-conflict");
            if (!string.Equals(request.RotationId, pending.Context.RotationId, StringComparison.Ordinal) ||
                !string.Equals(request.BrowserNonce, pending.Context.BrowserNonce, StringComparison.Ordinal) ||
                !string.Equals(request.ServerNonce, pending.Context.ServerNonce, StringComparison.Ordinal) ||
                request.CurrentEpoch != pending.Context.CurrentEpoch ||
                request.NextEpoch != pending.Context.NextEpoch)
            {
                throw new CompanionProtocolException("rotation-conflict");
            }

            var newKey = CompanionLoopbackProtocol.DeriveRotatedSessionKey(
                session.Key,
                pending.Context);
            var keyTransferred = false;
            try
            {
                if (!CompanionLoopbackProtocol.VerifyRotationNewKeyProof(
                        newKey,
                        pending.Context,
                        request.NewKeyProof))
                {
                    throw new CompanionProtocolException("rotation-proof-invalid");
                }
                var keyExpiresAtUtc = FormatTimestamp(
                    _timeProvider.GetUtcNow() + KeyEpochLifetime);
                var committed = new CompanionRotationCommitted(
                    CompanionLoopbackWire.RotationCommittedSchema,
                    request.RotationId,
                    request.NextEpoch,
                    keyExpiresAtUtc,
                    CompanionLoopbackProtocol.ComputeRotationCompletionProof(
                        newKey,
                        pending.Context,
                        requestSha256));
                var responseBytes = CompanionLoopbackWire.EncodeRotationCommitted(committed);
                var proven = ProveResponse(
                    newKey,
                    authentication.Context,
                    200,
                    "application/json",
                    responseBytes,
                    CompanionLoopbackProtocol.EmptySha256);
                var replay = new RotationCommitReplay(
                    authentication,
                    requestSha256,
                    proven.Copy(),
                    now);

                session.CommitRotation(
                    newKey,
                    request.NextEpoch,
                    now,
                    keyExpiresAtUtc,
                    replay);
                keyTransferred = true;
                return proven;
            }
            finally
            {
                if (!keyTransferred)
                {
                    CryptographicOperations.ZeroMemory(newKey);
                }
            }
        }
    }

    internal CompanionProvenResponse ReplayRotationCommit(
        SessionState session,
        CompanionRequestProofContext authenticationContext,
        RotationCommitReplay replay,
        CompanionRotationCommit request)
    {
        var requestBytes = CompanionLoopbackWire.EncodeRotationCommit(request);
        RequireAuthenticatedBody(
            authenticationContext,
            requestBytes,
            "/tinyrustlm-companion/1/session/rotation/commit");
        var requestSha256 = CompanionLoopbackProtocol.Sha256Hex(requestBytes);
        lock (_gate)
        {
            var now = _timeProvider.GetTimestamp();
            PruneRotation(session, now);
            if (!ReferenceEquals(session.RotationReplay, replay) ||
                !string.Equals(replay.RequestSha256, requestSha256, StringComparison.Ordinal))
            {
                throw new CompanionProtocolException("capability-revoked");
            }
            return replay.Response.Copy();
        }
    }

    internal CompanionProvenResponse Revoke(
        SessionState session,
        CompanionRequestProofContext authenticationContext,
        ReadOnlySpan<byte> responseKey,
        CompanionRevokeRequest request)
    {
        var requestBytes = CompanionLoopbackWire.EncodeRevokeRequest(request);
        RequireAuthenticatedBody(
            authenticationContext,
            requestBytes,
            "/tinyrustlm-companion/1/session/revoke");
        lock (_gate)
        {
            RequireCurrentLease(session, authenticationContext);
            var revoked = new CompanionRevokedResponse(
                CompanionLoopbackWire.RevokedResponseSchema,
                request.RevocationId,
                true);
            var responseBytes = CompanionLoopbackWire.EncodeRevokedResponse(revoked);
            var proven = ProveResponse(
                responseKey,
                authenticationContext,
                200,
                "application/json",
                responseBytes,
                CompanionLoopbackProtocol.EmptySha256);
            session.Terminate("capability-revoked", _timeProvider.GetTimestamp());
            return proven;
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
            PruneRotation(session, now);
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
                     .Where(pair => pair.Value.TerminalCode != "capability-revoked" &&
                         pair.Value.TerminalTimestamp is long terminal &&
                         Elapsed(terminal, now) >= TerminalSessionRetention)
                     .ToArray())
        {
            pair.Value.EraseKey();
            _sessions.Remove(pair.Key);
        }
    }

    private void PruneRotation(SessionState session, long now)
    {
        if (session.PendingRotation is { } pending &&
            Elapsed(pending.CreatedTimestamp, now) >= PendingRotationLifetime)
        {
            session.ExpiredRotation = new ExpiredRotation(
                pending.Context.RotationId,
                now);
            session.PendingRotation = null;
        }
        if (session.ExpiredRotation is { } expired &&
            Elapsed(expired.CreatedTimestamp, now) >= PairingReplayLifetime)
        {
            session.ExpiredRotation = null;
        }
        if (session.RotationReplay is { } replay &&
            Elapsed(replay.CreatedTimestamp, now) >= RotationReplayLifetime)
        {
            session.RotationReplay = null;
        }
    }

    private void RequireCurrentLease(
        SessionState session,
        CompanionRequestProofContext authenticationContext)
    {
        RequireNotDisposed();
        if (!_sessions.TryGetValue(session.SessionId, out var current) ||
            !ReferenceEquals(current, session) ||
            session.TerminalCode is not null ||
            !session.InFlight ||
            authenticationContext.SessionId != session.SessionId ||
            authenticationContext.KeyEpoch != session.KeyEpoch)
        {
            throw new CompanionProtocolException("capability-invalid");
        }
    }

    private static void RequireAuthenticatedBody(
        CompanionRequestProofContext authenticationContext,
        ReadOnlySpan<byte> body,
        string path)
    {
        if (authenticationContext.Method != "POST" ||
            authenticationContext.Path != path ||
            authenticationContext.ContentType != "application/json" ||
            authenticationContext.ContentLength != checked((ulong)body.Length) ||
            authenticationContext.ContentSha256 != CompanionLoopbackProtocol.Sha256Hex(body))
        {
            throw new CompanionProtocolException("contract-invalid");
        }
    }

    private CompanionRotationProofContext RotationContext(
        string sessionId,
        CompanionRotationChallenge challenge) =>
        new(
            _installationId,
            _processInstanceId,
            sessionId,
            challenge.RotationId,
            challenge.BrowserNonce,
            challenge.ServerNonce,
            challenge.CurrentEpoch,
            challenge.NextEpoch,
            _host,
            CompanionLoopbackProtocol.ProductionOrigin);

    private static CompanionProvenResponse ProveResponse(
        ReadOnlySpan<byte> key,
        CompanionRequestProofContext request,
        int status,
        string contentType,
        ReadOnlySpan<byte> body,
        string responseMetadataSha256)
    {
        var bodyBytes = body.ToArray();
        var context = new CompanionResponseProofContext(
            request.InstallationId,
            request.ProcessInstanceId,
            request.SessionId,
            request.KeyEpoch,
            request.Sequence,
            request.Method,
            request.Path,
            status,
            contentType,
            checked((ulong)bodyBytes.Length),
            responseMetadataSha256,
            CompanionLoopbackProtocol.Sha256Hex(bodyBytes));
        return new CompanionProvenResponse(
            bodyBytes,
            context,
            CompanionLoopbackProtocol.ComputeResponseProof(key, context));
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
        string sessionExpiresAtUtc,
        string keyExpiresAtUtc)
    {
        internal string SessionId { get; } = sessionId;
        internal byte[] Key { get; private set; } = key;
        internal long CreatedTimestamp { get; } = createdTimestamp;
        internal string SessionExpiresAtUtc { get; } = sessionExpiresAtUtc;
        internal string KeyExpiresAtUtc { get; private set; } = keyExpiresAtUtc;
        internal long LastActivityTimestamp { get; set; } = createdTimestamp;
        internal long KeyEpochTimestamp { get; set; } = createdTimestamp;
        internal uint KeyEpoch { get; set; } = InitialKeyEpoch;
        internal ulong AcceptedSequence { get; set; }
        internal bool InFlight { get; set; }
        internal SlidingWindowCounter RequestRate { get; } = new(600);
        internal string? TerminalCode { get; private set; }
        internal long? TerminalTimestamp { get; private set; }
        internal PendingRotation? PendingRotation { get; set; }
        internal ExpiredRotation? ExpiredRotation { get; set; }
        internal RotationCommitReplay? RotationReplay { get; set; }

        internal void CommitRotation(
            byte[] newKey,
            uint nextEpoch,
            long timestamp,
            string keyExpiresAtUtc,
            RotationCommitReplay replay)
        {
            CryptographicOperations.ZeroMemory(Key);
            Key = newKey;
            KeyEpoch = nextEpoch;
            KeyEpochTimestamp = timestamp;
            LastActivityTimestamp = timestamp;
            KeyExpiresAtUtc = keyExpiresAtUtc;
            AcceptedSequence = 0;
            PendingRotation = null;
            ExpiredRotation = null;
            RotationReplay = replay;
        }

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

    internal sealed record PendingRotation(
        string RequestSha256,
        CompanionRotationProofContext Context,
        CompanionRotationChallenge Challenge,
        long CreatedTimestamp);

    internal sealed record ExpiredRotation(string RotationId, long CreatedTimestamp);

    internal sealed record RotationCommitReplay(
        CompanionSessionAuthenticationRequest Authentication,
        string RequestSha256,
        CompanionProvenResponse Response,
        long CreatedTimestamp)
    {
        internal bool Matches(CompanionSessionAuthenticationRequest candidate) =>
            Equals(Authentication.Context, candidate.Context) &&
            FixedTimeProofEquals(Authentication.Proof, candidate.Proof);

        private static bool FixedTimeProofEquals(string expected, string actual)
        {
            byte[] expectedBytes = [];
            byte[] actualBytes = [];
            try
            {
                expectedBytes = CompanionLoopbackProtocol.DecodeBase64Url32(
                    expected,
                    "rotation-replay-proof");
                actualBytes = CompanionLoopbackProtocol.DecodeBase64Url32(
                    actual,
                    "rotation-replay-proof");
                return CryptographicOperations.FixedTimeEquals(expectedBytes, actualBytes);
            }
            catch (CompanionProtocolException)
            {
                return false;
            }
            finally
            {
                CryptographicOperations.ZeroMemory(expectedBytes);
                CryptographicOperations.ZeroMemory(actualBytes);
            }
        }
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
    private readonly CompanionSessionAuthenticationRequest _authentication;
    private readonly byte[] _key;
    private readonly CompanionCapabilityState.RotationCommitReplay? _rotationReplay;
    private readonly bool _ownsReservation;
    private readonly object _leaseGate = new();
    private int _state;
    private bool _disposeRequested;

    internal CompanionSessionLease(
        CompanionCapabilityState owner,
        CompanionCapabilityState.SessionState session,
        CompanionSessionAuthenticationRequest authentication,
        byte[] key,
        ulong acceptedSequence,
        ulong? nextSequence,
        CompanionCapabilityState.RotationCommitReplay? rotationReplay,
        bool ownsReservation)
    {
        _owner = owner;
        _session = session;
        _authentication = authentication;
        _key = key;
        _rotationReplay = rotationReplay;
        _ownsReservation = ownsReservation;
        AcceptedSequence = acceptedSequence;
        NextSequence = nextSequence;
    }

    internal static CompanionSessionLease CreateRotationReplay(
        CompanionCapabilityState owner,
        CompanionCapabilityState.SessionState session,
        CompanionSessionAuthenticationRequest authentication,
        CompanionCapabilityState.RotationCommitReplay replay) =>
        new(
            owner,
            session,
            authentication,
            [],
            authentication.Context.Sequence,
            null,
            replay,
            ownsReservation: false);

    public ulong AcceptedSequence { get; }

    public ulong? NextSequence { get; }

    internal bool IsRotationCommitReplay => _rotationReplay is not null;

    public CompanionProvenResponse MaterializeSessionStatus() =>
        ExecuteAuthenticated(
            () => CompanionLoopbackWire.EncodeSessionStatus(
                _owner.SessionStatus(_session, _authentication.Context)),
            responseKey: _key);

    public CompanionProvenResponse BeginRotationAndMaterializeResponse(
        CompanionRotationBegin request) =>
        ExecuteAuthenticated(
            () => CompanionLoopbackWire.EncodeRotationChallenge(
                _owner.BeginRotation(_session, _authentication.Context, request)),
            responseKey: _key);

    public CompanionProvenResponse CommitRotationAndMaterializeResponse(
        CompanionRotationCommit request) =>
        ExecuteSpecial(
            () => _owner.CommitRotation(_session, _authentication, request));

    public CompanionProvenResponse ReplayRotationCommit(
        CompanionRotationCommit request)
    {
        if (_rotationReplay is null)
        {
            throw new CompanionProtocolException("capability-invalid");
        }
        Enter();
        try
        {
            var response = _owner.ReplayRotationCommit(
                _session,
                _authentication.Context,
                _rotationReplay,
                request);
            CompleteOperation();
            return response;
        }
        catch
        {
            CompleteOperation();
            throw;
        }
    }

    public CompanionProvenResponse RevokeAndMaterializeResponse(
        CompanionRevokeRequest request) =>
        ExecuteSpecial(
            () => _owner.Revoke(
                _session,
                _authentication.Context,
                _key,
                request));

    public CompanionProvenResponse MaterializeResponse(
        int status,
        string contentType,
        ReadOnlySpan<byte> body,
        string responseMetadataSha256)
    {
        EnsureNormalLease();
        Enter();
        try
        {
            var response = Prove(
                _key,
                status,
                contentType,
                body,
                responseMetadataSha256);
            CompleteOperation();
            return response;
        }
        catch
        {
            Reopen();
            throw;
        }
    }

    public void Dispose()
    {
        var finish = false;
        lock (_leaseGate)
        {
            if (_state == 0)
            {
                _state = 2;
                finish = true;
            }
            else if (_state == 1)
            {
                _disposeRequested = true;
            }
        }
        if (finish)
        {
            Finish();
        }
    }

    private CompanionProvenResponse ExecuteAuthenticated(
        Func<byte[]> createBody,
        ReadOnlySpan<byte> responseKey)
    {
        EnsureNormalLease();
        Enter();
        try
        {
            var body = createBody();
            var response = Prove(
                responseKey,
                200,
                "application/json",
                body,
                CompanionLoopbackProtocol.EmptySha256);
            CompleteOperation();
            return response;
        }
        catch
        {
            Reopen();
            throw;
        }
    }

    private CompanionProvenResponse ExecuteSpecial(Func<CompanionProvenResponse> operation)
    {
        EnsureNormalLease();
        Enter();
        try
        {
            var response = operation();
            CompleteOperation();
            return response;
        }
        catch
        {
            Reopen();
            throw;
        }
    }

    private CompanionProvenResponse Prove(
        ReadOnlySpan<byte> responseKey,
        int status,
        string contentType,
        ReadOnlySpan<byte> body,
        string responseMetadataSha256)
    {
        var bodyBytes = body.ToArray();
        var requestContext = _authentication.Context;
        var context = new CompanionResponseProofContext(
            requestContext.InstallationId,
            requestContext.ProcessInstanceId,
            requestContext.SessionId,
            requestContext.KeyEpoch,
            requestContext.Sequence,
            requestContext.Method,
            requestContext.Path,
            status,
            contentType,
            checked((ulong)bodyBytes.Length),
            responseMetadataSha256,
            CompanionLoopbackProtocol.Sha256Hex(bodyBytes));
        var proof = CompanionLoopbackProtocol.ComputeResponseProof(responseKey, context);
        return new CompanionProvenResponse(bodyBytes, context, proof);
    }

    private void EnsureNormalLease()
    {
        if (_rotationReplay is not null)
        {
            throw new CompanionProtocolException("capability-revoked");
        }
    }

    private void Enter()
    {
        lock (_leaseGate)
        {
            if (_state != 0 || _disposeRequested)
            {
                throw new CompanionProtocolException("session-response-already-materialized");
            }
            _state = 1;
        }
    }

    private void Reopen()
    {
        var finish = false;
        lock (_leaseGate)
        {
            if (_state != 1)
            {
                throw new InvalidOperationException("The session lease state is inconsistent.");
            }
            if (_disposeRequested)
            {
                _state = 2;
                finish = true;
            }
            else
            {
                _state = 0;
            }
        }
        if (finish)
        {
            Finish();
        }
    }

    private void CompleteOperation()
    {
        lock (_leaseGate)
        {
            if (_state != 1)
            {
                throw new InvalidOperationException("The session lease state is inconsistent.");
            }
            _state = 2;
        }
        Finish();
    }

    private void Finish()
    {
        CryptographicOperations.ZeroMemory(_key);
        if (_ownsReservation)
        {
            _owner.Release(_session);
        }
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

    internal CompanionProvenResponse Copy() =>
        new(_body.ToArray(), Context, Proof);
}
