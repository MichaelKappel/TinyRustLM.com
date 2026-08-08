using System.Security.Cryptography;

namespace TinyRustLM.SeedHost;

/// <summary>Closed capabilities that the browser bridge can grant to one origin-bound session.</summary>
public enum SeedHostBridgeScope
{
    /// <summary>Read public-safe bridge and native compatibility status.</summary>
    Status,
    /// <summary>List Rust-validated imported or admitted model identities.</summary>
    ModelsRead,
    /// <summary>Create a bounded Rust-authoritative peer import.</summary>
    ImportsCreate,
    /// <summary>Read progress and terminal state for an owned import.</summary>
    ImportsRead,
    /// <summary>Cancel an owned in-flight import while retaining safe resumable pieces.</summary>
    ImportsCancel,
    /// <summary>Create a reviewed immutable-source conversion when no verified peer is available.</summary>
    ConversionsCreate,
    /// <summary>Read progress and terminal state for an owned local conversion.</summary>
    ConversionsRead,
    /// <summary>Cancel an owned conversion while retaining verified resumable source bytes.</summary>
    ConversionsCancel,
    /// <summary>Stream one revalidated imported artifact to the local browser.</summary>
    ModelsStream,
    /// <summary>Perform explicitly enabled sharing mutations; never granted implicitly.</summary>
    SharingManage
}

/// <summary>Security limits for one loopback bridge instance.</summary>
public sealed record SeedHostBridgeSecurityPolicy(
    IReadOnlyCollection<string> AllowedOrigins,
    TimeSpan? PairingLifetime = null,
    TimeSpan? CapabilityLifetime = null,
    int MaximumReplayEntriesPerSession = 256,
    int MaximumActiveChallenges = 8,
    int MaximumSessions = 64);

/// <summary>
/// One host-displayed pairing secret. The bridge retains only its SHA-256 digest and accepts it
/// once before <see cref="ExpiresUtc"/>.
/// </summary>
public sealed record SeedHostBridgePairingChallenge(
    string Code,
    DateTimeOffset ExpiresUtc,
    IReadOnlyList<SeedHostBridgeScope> Scopes);

/// <summary>
/// Short-lived capability returned only from successful pairing. Callers must keep the capability
/// in volatile browser session state and must not persist or log it.
/// </summary>
public sealed record SeedHostBridgeSession(
    string SessionId,
    string Capability,
    string Origin,
    DateTimeOffset ExpiresUtc,
    IReadOnlyList<SeedHostBridgeScope> Scopes);

/// <summary>Validated in-memory authorization evidence for one exact bridge request.</summary>
internal sealed record SeedHostBridgeAuthorization(
    string SessionId,
    string Origin,
    SeedHostBridgeScope Scope,
    DateTimeOffset ExpiresUtc);

/// <summary>
/// Thread-safe one-time pairing and origin-bound capability authority. Only digests of secret
/// material are retained; restart revokes every browser capability by construction.
/// </summary>
internal sealed class SeedHostBridgeSessionManager
{
    private static readonly TimeSpan DefaultPairingLifetime = TimeSpan.FromMinutes(3);
    private static readonly TimeSpan DefaultCapabilityLifetime = TimeSpan.FromMinutes(15);
    private readonly object sync = new();
    private readonly SeedHostBridgeSecurityPolicy policy;
    private readonly TimeProvider timeProvider;
    private readonly HashSet<string> allowedOrigins;
    private readonly List<PairingState> challenges = [];
    private readonly List<SessionState> sessions = [];

    internal SeedHostBridgeSessionManager(
        SeedHostBridgeSecurityPolicy policy,
        TimeProvider? timeProvider = null)
    {
        this.policy = policy ?? throw new ArgumentNullException(nameof(policy));
        this.timeProvider = timeProvider ?? TimeProvider.System;
        ValidatePolicy(policy);
        allowedOrigins = policy.AllowedOrigins
            .Select(NormalizeOrigin)
            .ToHashSet(StringComparer.Ordinal);
    }

    internal bool HasActiveSessions
    {
        get
        {
            lock (sync)
            {
                var now = timeProvider.GetUtcNow();
                return sessions.Any(session => !session.Revoked && session.ExpiresUtc > now);
            }
        }
    }

    internal SeedHostBridgePairingChallenge CreatePairingChallenge(
        IReadOnlyCollection<SeedHostBridgeScope> scopes)
    {
        ArgumentNullException.ThrowIfNull(scopes);
        var normalizedScopes = NormalizeScopes(scopes, requireNonempty: true);
        var now = timeProvider.GetUtcNow();
        var codeBytes = RandomNumberGenerator.GetBytes(24);
        var code = Base64Url(codeBytes);
        var digest = SHA256.HashData(codeBytes);
        CryptographicOperations.ZeroMemory(codeBytes);
        var state = new PairingState(
            digest,
            now + EffectivePairingLifetime,
            normalizedScopes);
        lock (sync)
        {
            TrimChallenges(now);
            if (challenges.Count >= policy.MaximumActiveChallenges)
            {
                throw new SeedHostValidationException(
                    "bridge_pairing_capacity_reached",
                    "The bridge already has the maximum number of active pairing challenges.");
            }
            challenges.Add(state);
        }
        return new SeedHostBridgePairingChallenge(code, state.ExpiresUtc, normalizedScopes);
    }

    internal SeedHostBridgeSession Pair(
        string origin,
        string code,
        IReadOnlyCollection<SeedHostBridgeScope> requestedScopes)
    {
        var normalizedOrigin = RequireAllowedOrigin(origin);
        var normalizedScopes = NormalizeScopes(requestedScopes, requireNonempty: true);
        var codeDigest = SecretDigest(code, "bridge_pairing_code_invalid", maximumLength: 128);
        lock (sync)
        {
            var now = timeProvider.GetUtcNow();
            var challenge = FindChallenge(codeDigest);
            CryptographicOperations.ZeroMemory(codeDigest);
            if (challenge is null)
            {
                throw new SeedHostValidationException(
                    "bridge_pairing_code_invalid",
                    "The bridge pairing code is invalid.");
            }
            if (challenge.Consumed)
            {
                throw new SeedHostValidationException(
                    "bridge_pairing_code_consumed",
                    "The bridge pairing code has already been consumed.");
            }
            if (challenge.ExpiresUtc <= now)
            {
                throw new SeedHostValidationException(
                    "bridge_pairing_code_expired",
                    "The bridge pairing code has expired.");
            }
            if (normalizedScopes.Any(scope => !challenge.Scopes.Contains(scope)))
            {
                throw new SeedHostValidationException(
                    "bridge_scope_not_granted",
                    "Pairing requested a capability scope that the host did not grant.");
            }
            TrimSessions(now);
            if (sessions.Count >= policy.MaximumSessions)
            {
                throw new SeedHostValidationException(
                    "bridge_session_capacity_reached",
                    "The bridge already has the maximum number of retained sessions.");
            }

            challenge.Consumed = true;
            var capabilityBytes = RandomNumberGenerator.GetBytes(32);
            var capability = Base64Url(capabilityBytes);
            var capabilityDigest = SHA256.HashData(capabilityBytes);
            CryptographicOperations.ZeroMemory(capabilityBytes);
            var sessionId = Base64Url(RandomNumberGenerator.GetBytes(16));
            var expiresUtc = now + EffectiveCapabilityLifetime;
            sessions.Add(new SessionState(
                sessionId,
                capabilityDigest,
                normalizedOrigin,
                expiresUtc,
                normalizedScopes,
                policy.MaximumReplayEntriesPerSession));
            return new SeedHostBridgeSession(
                sessionId,
                capability,
                normalizedOrigin,
                expiresUtc,
                normalizedScopes);
        }
    }

    internal SeedHostBridgeAuthorization Authorize(
        string origin,
        string capability,
        SeedHostBridgeScope requiredScope,
        string? requestId = null,
        bool isMutation = false)
    {
        if (!Enum.IsDefined(requiredScope))
        {
            throw new SeedHostValidationException(
                "bridge_scope_invalid",
                "The bridge request named an unsupported capability scope.");
        }
        var normalizedOrigin = RequireAllowedOrigin(origin);
        var capabilityDigest = SecretDigest(
            capability,
            "bridge_capability_invalid",
            maximumLength: 256);
        lock (sync)
        {
            var now = timeProvider.GetUtcNow();
            var session = FindSession(capabilityDigest);
            CryptographicOperations.ZeroMemory(capabilityDigest);
            if (session is null)
            {
                throw new SeedHostValidationException(
                    "bridge_capability_invalid",
                    "The bridge capability is invalid.");
            }
            if (!string.Equals(session.Origin, normalizedOrigin, StringComparison.Ordinal))
            {
                throw new SeedHostValidationException(
                    "bridge_origin_mismatch",
                    "The bridge capability is bound to a different browser origin.");
            }
            if (session.Revoked)
            {
                throw new SeedHostValidationException(
                    "bridge_capability_revoked",
                    "The bridge capability has been revoked.");
            }
            if (session.ExpiresUtc <= now)
            {
                throw new SeedHostValidationException(
                    "bridge_capability_expired",
                    "The bridge capability has expired.");
            }
            if (!session.Scopes.Contains(requiredScope))
            {
                throw new SeedHostValidationException(
                    "bridge_scope_denied",
                    "The bridge capability does not grant the required operation scope.");
            }
            if (isMutation)
            {
                var normalizedRequestId = RequireRequestId(requestId);
                if (!session.TryRecordRequest(normalizedRequestId))
                {
                    throw new SeedHostValidationException(
                        "bridge_request_replay",
                        "The bridge mutation request ID has already been used in this session.");
                }
            }
            return new SeedHostBridgeAuthorization(
                session.SessionId,
                session.Origin,
                requiredScope,
                session.ExpiresUtc);
        }
    }

    internal SeedHostBridgeSession Rotate(string origin, string capability)
    {
        var normalizedOrigin = RequireAllowedOrigin(origin);
        var capabilityDigest = SecretDigest(
            capability,
            "bridge_capability_invalid",
            maximumLength: 256);
        lock (sync)
        {
            var now = timeProvider.GetUtcNow();
            var current = FindSession(capabilityDigest);
            CryptographicOperations.ZeroMemory(capabilityDigest);
            if (current is null)
            {
                throw new SeedHostValidationException(
                    "bridge_capability_invalid",
                    "The bridge capability is invalid.");
            }
            if (!string.Equals(current.Origin, normalizedOrigin, StringComparison.Ordinal))
            {
                throw new SeedHostValidationException(
                    "bridge_origin_mismatch",
                    "The bridge capability is bound to a different browser origin.");
            }
            if (current.Revoked)
            {
                throw new SeedHostValidationException(
                    "bridge_capability_revoked",
                    "The bridge capability has been revoked.");
            }
            if (current.ExpiresUtc <= now)
            {
                throw new SeedHostValidationException(
                    "bridge_capability_expired",
                    "The bridge capability has expired.");
            }
            if (!current.Scopes.Contains(SeedHostBridgeScope.Status))
            {
                throw new SeedHostValidationException(
                    "bridge_scope_denied",
                    "The bridge capability does not grant session rotation.");
            }

            TrimSessions(now);
            if (sessions.Count >= policy.MaximumSessions)
            {
                var staleRevoked = sessions.FirstOrDefault(session => session.Revoked);
                if (staleRevoked is null)
                {
                    throw new SeedHostValidationException(
                        "bridge_session_capacity_reached",
                        "The bridge already has the maximum number of retained sessions.");
                }
                sessions.Remove(staleRevoked);
            }

            current.Revoked = true;
            var capabilityBytes = RandomNumberGenerator.GetBytes(32);
            var nextCapability = Base64Url(capabilityBytes);
            var nextDigest = SHA256.HashData(capabilityBytes);
            CryptographicOperations.ZeroMemory(capabilityBytes);
            var nextSessionId = Base64Url(RandomNumberGenerator.GetBytes(16));
            var nextExpiry = now + EffectiveCapabilityLifetime;
            sessions.Add(new SessionState(
                nextSessionId,
                nextDigest,
                current.Origin,
                nextExpiry,
                current.Scopes,
                policy.MaximumReplayEntriesPerSession));
            return new SeedHostBridgeSession(
                nextSessionId,
                nextCapability,
                current.Origin,
                nextExpiry,
                current.Scopes);
        }
    }

    internal void Revoke(string origin, string capability)
    {
        var normalizedOrigin = RequireAllowedOrigin(origin);
        var capabilityDigest = SecretDigest(
            capability,
            "bridge_capability_invalid",
            maximumLength: 256);
        lock (sync)
        {
            var session = FindSession(capabilityDigest);
            CryptographicOperations.ZeroMemory(capabilityDigest);
            if (session is null)
            {
                throw new SeedHostValidationException(
                    "bridge_capability_invalid",
                    "The bridge capability is invalid.");
            }
            if (!string.Equals(session.Origin, normalizedOrigin, StringComparison.Ordinal))
            {
                throw new SeedHostValidationException(
                    "bridge_origin_mismatch",
                    "The bridge capability is bound to a different browser origin.");
            }
            session.Revoked = true;
        }
    }

    internal static string NormalizeOrigin(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        if (value.Length > 2048
            || !Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)
            || !string.IsNullOrEmpty(uri.UserInfo)
            || uri.AbsolutePath != "/"
            || !string.IsNullOrEmpty(uri.Query)
            || !string.IsNullOrEmpty(uri.Fragment))
        {
            throw new SeedHostValidationException(
                "bridge_origin_invalid",
                "Bridge origins must be absolute HTTP(S) origins without credentials, paths, queries, or fragments.");
        }
        if (uri.Scheme == Uri.UriSchemeHttp && !IsLoopbackHost(uri.Host))
        {
            throw new SeedHostValidationException(
                "bridge_origin_insecure",
                "Non-loopback bridge origins must use HTTPS.");
        }
        var builder = new UriBuilder(uri.Scheme, uri.Host, uri.IsDefaultPort ? -1 : uri.Port);
        return builder.Uri.GetLeftPart(UriPartial.Authority).ToLowerInvariant();
    }

    private string RequireAllowedOrigin(string value)
    {
        var normalized = NormalizeOrigin(value);
        if (!allowedOrigins.Contains(normalized))
        {
            throw new SeedHostValidationException(
                "bridge_origin_denied",
                "The browser origin is not approved for this bridge instance.");
        }
        return normalized;
    }

    private PairingState? FindChallenge(ReadOnlySpan<byte> digest)
    {
        foreach (var challenge in challenges)
        {
            if (CryptographicOperations.FixedTimeEquals(challenge.CodeDigest, digest))
            {
                return challenge;
            }
        }
        return null;
    }

    private SessionState? FindSession(ReadOnlySpan<byte> digest)
    {
        foreach (var session in sessions)
        {
            if (CryptographicOperations.FixedTimeEquals(session.CapabilityDigest, digest))
            {
                return session;
            }
        }
        return null;
    }

    private void TrimChallenges(DateTimeOffset now)
    {
        challenges.RemoveAll(challenge =>
            challenge.ExpiresUtc < now - TimeSpan.FromHours(1));
    }

    private void TrimSessions(DateTimeOffset now)
    {
        sessions.RemoveAll(session =>
            session.ExpiresUtc < now - TimeSpan.FromHours(1));
    }

    private TimeSpan EffectivePairingLifetime => policy.PairingLifetime ?? DefaultPairingLifetime;

    private TimeSpan EffectiveCapabilityLifetime =>
        policy.CapabilityLifetime ?? DefaultCapabilityLifetime;

    private static IReadOnlyList<SeedHostBridgeScope> NormalizeScopes(
        IReadOnlyCollection<SeedHostBridgeScope> scopes,
        bool requireNonempty)
    {
        ArgumentNullException.ThrowIfNull(scopes);
        if (scopes.Any(scope => !Enum.IsDefined(scope)))
        {
            throw new SeedHostValidationException(
                "bridge_scope_invalid",
                "Bridge scopes must use only defined capability values.");
        }
        var normalized = scopes.Distinct().Order().ToArray();
        if (requireNonempty && normalized.Length == 0)
        {
            throw new SeedHostValidationException(
                "bridge_scope_required",
                "At least one bridge capability scope is required.");
        }
        return normalized;
    }

    private static byte[] SecretDigest(string value, string errorCode, int maximumLength)
    {
        if (string.IsNullOrWhiteSpace(value)
            || value.Length > maximumLength
            || value.Any(char.IsControl))
        {
            throw new SeedHostValidationException(errorCode, "Bridge secret material is invalid.");
        }
        byte[] bytes;
        try
        {
            bytes = Base64UrlBytes(value);
        }
        catch (FormatException)
        {
            throw new SeedHostValidationException(errorCode, "Bridge secret material is invalid.");
        }
        try
        {
            return SHA256.HashData(bytes);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(bytes);
        }
    }

    private static string RequireRequestId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)
            || value.Length > 128
            || value.Any(character => char.IsControl(character) || char.IsWhiteSpace(character)))
        {
            throw new SeedHostValidationException(
                "bridge_request_id_invalid",
                "Mutating bridge requests require a bounded non-whitespace request ID.");
        }
        return value;
    }

    private static void ValidatePolicy(SeedHostBridgeSecurityPolicy value)
    {
        ArgumentNullException.ThrowIfNull(value.AllowedOrigins);
        if (value.AllowedOrigins.Count is < 1 or > 16)
        {
            throw new SeedHostValidationException(
                "bridge_origin_policy_invalid",
                "The bridge must allow between one and sixteen exact origins.");
        }
        var normalized = value.AllowedOrigins.Select(NormalizeOrigin).ToArray();
        if (normalized.Distinct(StringComparer.Ordinal).Count() != normalized.Length)
        {
            throw new SeedHostValidationException(
                "bridge_origin_policy_invalid",
                "The bridge origin allowlist contains duplicate normalized origins.");
        }
        var pairingLifetime = value.PairingLifetime ?? DefaultPairingLifetime;
        var capabilityLifetime = value.CapabilityLifetime ?? DefaultCapabilityLifetime;
        if (pairingLifetime < TimeSpan.FromSeconds(30) || pairingLifetime > TimeSpan.FromMinutes(15)
            || capabilityLifetime < TimeSpan.FromMinutes(1)
            || capabilityLifetime > TimeSpan.FromHours(1)
            || value.MaximumReplayEntriesPerSession is < 8 or > 4096
            || value.MaximumActiveChallenges is < 1 or > 64
            || value.MaximumSessions is < 1 or > 1024)
        {
            throw new SeedHostValidationException(
                "bridge_security_policy_invalid",
                "Bridge security lifetimes and capacities are outside supported bounds.");
        }
    }

    private static bool IsLoopbackHost(string host) =>
        string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
        || string.Equals(host, "127.0.0.1", StringComparison.Ordinal)
        || string.Equals(host, "::1", StringComparison.Ordinal);

    private static string Base64Url(ReadOnlySpan<byte> value) =>
        Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlBytes(string value)
    {
        var normalized = value.Replace('-', '+').Replace('_', '/');
        normalized = (normalized.Length % 4) switch
        {
            0 => normalized,
            2 => normalized + "==",
            3 => normalized + "=",
            _ => throw new FormatException("Invalid base64url length.")
        };
        return Convert.FromBase64String(normalized);
    }

    private sealed class PairingState(
        byte[] codeDigest,
        DateTimeOffset expiresUtc,
        IReadOnlyList<SeedHostBridgeScope> scopes)
    {
        internal byte[] CodeDigest { get; } = codeDigest;
        internal DateTimeOffset ExpiresUtc { get; } = expiresUtc;
        internal IReadOnlyList<SeedHostBridgeScope> Scopes { get; } = scopes;
        internal bool Consumed { get; set; }
    }

    private sealed class SessionState(
        string sessionId,
        byte[] capabilityDigest,
        string origin,
        DateTimeOffset expiresUtc,
        IReadOnlyList<SeedHostBridgeScope> scopes,
        int maximumReplayEntries)
    {
        private readonly Queue<string> replayOrder = [];
        private readonly HashSet<string> replaySet = new(StringComparer.Ordinal);

        internal string SessionId { get; } = sessionId;
        internal byte[] CapabilityDigest { get; } = capabilityDigest;
        internal string Origin { get; } = origin;
        internal DateTimeOffset ExpiresUtc { get; } = expiresUtc;
        internal IReadOnlyList<SeedHostBridgeScope> Scopes { get; } = scopes;
        internal bool Revoked { get; set; }

        internal bool TryRecordRequest(string requestId)
        {
            if (!replaySet.Add(requestId))
            {
                return false;
            }
            replayOrder.Enqueue(requestId);
            while (replayOrder.Count > maximumReplayEntries)
            {
                replaySet.Remove(replayOrder.Dequeue());
            }
            return true;
        }
    }
}
