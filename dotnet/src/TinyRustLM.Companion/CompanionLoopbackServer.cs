using System.Globalization;
using System.Net;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Primitives;

namespace TinyRustLM.Companion;

public sealed class CompanionLoopbackServer : IAsyncDisposable
{
    public const int MaximumRequestLineBytes = 2_048;
    public const int MaximumRequestHeaderCount = 32;
    public const int MaximumRequestHeaderBytes = 16_384;
    public const int MaximumRequestBodyBytes = 65_536;
    public const int MaximumConcurrentConnections = 8;

    private const string JsonContentType = "application/json";
    private const string BinaryContentType = "application/octet-stream";
    private const string PairingBeginPath = "/tinyrustlm-companion/1/pairings/begin";
    private const string PairingCompletePath = "/tinyrustlm-companion/1/pairings/complete";
    private const string SessionPath = "/tinyrustlm-companion/1/session";
    private const string RotationBeginPath =
        "/tinyrustlm-companion/1/session/rotation/begin";
    private const string RotationCommitPath =
        "/tinyrustlm-companion/1/session/rotation/commit";
    private const string RevokePath = "/tinyrustlm-companion/1/session/revoke";
    private const string OperationsPath = "/tinyrustlm-companion/1/operations";
    private const string CorsExposeHeaders =
        "content-length, content-type, x-tinyrustlm-session, x-tinyrustlm-epoch, " +
        "x-tinyrustlm-sequence, x-tinyrustlm-content-sha256, " +
        "x-tinyrustlm-response-metadata-sha256, x-tinyrustlm-response-proof, " +
        "x-tinyrustlm-artifact-role, x-tinyrustlm-artifact-id, " +
        "x-tinyrustlm-artifact-sha256, x-tinyrustlm-artifact-bytes, " +
        "x-tinyrustlm-chunk-index, x-tinyrustlm-chunk-count, " +
        "x-tinyrustlm-chunk-offset, x-tinyrustlm-chunk-bytes";
    private const string PreflightVary =
        "Origin, Access-Control-Request-Method, Access-Control-Request-Headers";

    private static readonly TimeSpan RequestBodyTimeout = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan ControlResponseTimeout = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan ChunkResponseTimeout = TimeSpan.FromSeconds(60);

    private static readonly HashSet<string> AllowedRequestHeaders = new(StringComparer.Ordinal)
    {
        "accept",
        "accept-encoding",
        "accept-language",
        "access-control-request-headers",
        "access-control-request-method",
        "cache-control",
        "connection",
        "content-length",
        "content-type",
        "dnt",
        "host",
        "origin",
        "pragma",
        "priority",
        "sec-ch-ua",
        "sec-ch-ua-mobile",
        "sec-ch-ua-platform",
        "sec-fetch-dest",
        "sec-fetch-mode",
        "sec-fetch-site",
        "sec-gpc",
        "user-agent",
        "x-tinyrustlm-content-sha256",
        "x-tinyrustlm-epoch",
        "x-tinyrustlm-request-proof",
        "x-tinyrustlm-sequence",
        "x-tinyrustlm-session"
    };

    private static readonly HashSet<string> DuplicateSensitiveHeaders = new(
        StringComparer.Ordinal)
    {
        "access-control-request-headers",
        "access-control-request-method",
        "authorization",
        "connection",
        "content-length",
        "content-type",
        "cookie",
        "expect",
        "forwarded",
        "host",
        "origin",
        "proxy-authorization",
        "referer",
        "sec-fetch-dest",
        "sec-fetch-mode",
        "sec-fetch-site",
        "trailer",
        "transfer-encoding",
        "upgrade",
        "x-tinyrustlm-content-sha256",
        "x-tinyrustlm-epoch",
        "x-tinyrustlm-request-proof",
        "x-tinyrustlm-sequence",
        "x-tinyrustlm-session"
    };

    private static readonly HashSet<string> AllowedScriptHeaders = new(StringComparer.Ordinal)
    {
        "content-type",
        "x-tinyrustlm-content-sha256",
        "x-tinyrustlm-epoch",
        "x-tinyrustlm-request-proof",
        "x-tinyrustlm-sequence",
        "x-tinyrustlm-session"
    };

    private readonly WebApplication _application;
    private readonly string _installationId;
    private readonly string _processInstanceId;
    private CompanionCapabilityState? _capabilityState;
    private int _disposeState;

    private CompanionLoopbackServer(
        WebApplication application,
        string installationId,
        string processInstanceId)
    {
        _application = application;
        _installationId = installationId;
        _processInstanceId = processInstanceId;
    }

    public ushort Port { get; private set; }

    public string Host => Port == 0
        ? throw new InvalidOperationException("The loopback listener is not bound.")
        : $"127.0.0.1:{Port.ToString(CultureInfo.InvariantCulture)}";

    internal int PendingPairingCount =>
        Volatile.Read(ref _capabilityState)?.PendingPairingCount ?? 0;

    internal int ActiveSessionCount =>
        Volatile.Read(ref _capabilityState)?.ActiveSessionCount ?? 0;

    public static async Task<CompanionLoopbackServer> StartAsync(
        CompanionInstallationIdentity identity,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(identity);
        CompanionLoopbackProtocol.RequireHexIdentifier(
            identity.InstallationId,
            16,
            "installation-record-id");
        CompanionLoopbackProtocol.RequireHexIdentifier(
            identity.ProcessInstanceId,
            16,
            "process-instance-id");

        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions
        {
            Args = [],
            ApplicationName = typeof(CompanionLoopbackServer).Assembly.FullName,
            EnvironmentName = Environments.Production
        });
        builder.Logging.ClearProviders();
        builder.WebHost.UseSetting(WebHostDefaults.PreventHostingStartupKey, "true");
        builder.Services.Configure<HostOptions>(options =>
            options.ShutdownTimeout = ControlResponseTimeout);
        builder.WebHost.ConfigureKestrel(options =>
        {
            options.AddServerHeader = false;
            options.AllowSynchronousIO = false;
            options.Limits.MaxRequestLineSize = MaximumRequestLineBytes;
            options.Limits.MaxRequestHeaderCount = MaximumRequestHeaderCount;
            options.Limits.MaxRequestHeadersTotalSize = MaximumRequestHeaderBytes;
            options.Limits.MaxRequestBodySize = MaximumRequestBodyBytes;
            options.Limits.MaxConcurrentConnections = MaximumConcurrentConnections;
            options.Limits.MaxConcurrentUpgradedConnections = 0;
            options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(5);
            options.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(5);
            options.Limits.MinRequestBodyDataRate = new MinDataRate(
                bytesPerSecond: 240,
                gracePeriod: TimeSpan.FromSeconds(5));
            options.Limits.MinResponseDataRate = new MinDataRate(
                bytesPerSecond: 1_024,
                gracePeriod: TimeSpan.FromSeconds(10));
            options.Listen(IPAddress.Loopback, 0, listen =>
                listen.Protocols = HttpProtocols.Http1);
        });

        var application = builder.Build();
        CompanionLoopbackServer? owner = null;
        application.Run(context => owner!.HandleAsync(context));
        owner = new CompanionLoopbackServer(
            application,
            identity.InstallationId,
            identity.ProcessInstanceId);
        try
        {
            await application.StartAsync(cancellationToken).ConfigureAwait(false);
            var port = ResolveBoundPort(application);
            owner.Port = port;
            owner._capabilityState = new CompanionCapabilityState(
                identity.InstallationId,
                identity.ProcessInstanceId,
                port);
            return owner;
        }
        catch
        {
            await application.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    public CompanionIssuedPairingCode IssuePairingCode()
    {
        if (Volatile.Read(ref _disposeState) != 0)
        {
            throw new ObjectDisposedException(nameof(CompanionLoopbackServer));
        }
        return Volatile.Read(ref _capabilityState)?.IssuePairingCode() ??
            throw new CompanionProtocolException("companion-unavailable");
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposeState, 1) != 0)
        {
            return;
        }

        try
        {
            using var timeout = new CancellationTokenSource(ControlResponseTimeout);
            await _application.StopAsync(timeout.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            // Dispose below still tears down the listener and active requests.
        }
        finally
        {
            Interlocked.Exchange(ref _capabilityState, null)?.Dispose();
            await _application.DisposeAsync().ConfigureAwait(false);
        }
    }

    private async Task HandleAsync(HttpContext context)
    {
        var corsAllowed = false;
        CompanionSessionLease? lease = null;
        try
        {
            ValidateConnection(context);
            var path = ValidateTarget(context);
            ValidateHeaderBoundsAndDuplicates(context.Request.Headers);
            ValidateHost(context.Request.Headers);
            ValidateOrigin(context.Request.Headers);
            corsAllowed = true;

            var route = MatchRoute(path);
            if (HttpMethods.IsOptions(context.Request.Method))
            {
                ValidateAllowedHeaders(context.Request.Headers, preflight: true);
                ValidateFetchMetadata(context.Request.Headers);
                await HandlePreflightAsync(context, route).ConfigureAwait(false);
                return;
            }
            if (!string.Equals(context.Request.Method, route.Method, StringComparison.Ordinal))
            {
                throw Reject("method-not-allowed");
            }

            ValidateAllowedHeaders(context.Request.Headers, preflight: false);
            ValidateFetchMetadata(context.Request.Headers);
            ValidateRouteHeaders(context.Request.Headers, route);
            var body = await ReadBodyAsync(context, route).ConfigureAwait(false);

            var state = Volatile.Read(ref _capabilityState) ??
                throw Reject("companion-unavailable");
            if (!route.Authenticated)
            {
                var responseBody = DispatchPairing(state, route.Kind, body);
                await WriteResponseAsync(
                    context,
                    StatusCodes.Status200OK,
                    JsonContentType,
                    responseBody,
                    cors: true,
                    proven: null,
                    isChunk: false).ConfigureAwait(false);
                return;
            }

            lease = Authenticate(state, context.Request, path, body);
            CompanionProvenResponse proven;
            try
            {
                proven = DispatchAuthenticated(lease, route, body);
            }
            catch (CompanionProtocolException exception)
            {
                proven = MaterializeError(lease, NormalizeProtocolCode(exception.Code));
            }
            catch
            {
                proven = MaterializeError(lease, "internal-failure");
            }

            await WriteResponseAsync(
                context,
                proven.Context.Status,
                proven.Context.ContentType,
                proven.CopyBody(),
                cors: true,
                proven,
                route.IsChunk).ConfigureAwait(false);
        }
        catch (LoopbackRequestException exception)
        {
            await TryWriteUnprovedErrorAsync(context, exception.Code, corsAllowed)
                .ConfigureAwait(false);
        }
        catch (CompanionProtocolException exception)
        {
            await TryWriteUnprovedErrorAsync(
                context,
                NormalizeProtocolCode(exception.Code),
                corsAllowed).ConfigureAwait(false);
        }
        catch (Microsoft.AspNetCore.Http.BadHttpRequestException)
        {
            throw;
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            context.Abort();
        }
        catch
        {
            await TryWriteUnprovedErrorAsync(context, "internal-failure", corsAllowed)
                .ConfigureAwait(false);
        }
        finally
        {
            lease?.Dispose();
        }
    }

    private static void ValidateConnection(HttpContext context)
    {
        if (!string.Equals(context.Request.Protocol, "HTTP/1.1", StringComparison.Ordinal) ||
            !IPAddress.Loopback.Equals(context.Connection.LocalIpAddress) ||
            !IPAddress.Loopback.Equals(context.Connection.RemoteIpAddress))
        {
            throw Reject("request-malformed");
        }
    }

    private static string ValidateTarget(HttpContext context)
    {
        var rawTarget = context.Features.Get<IHttpRequestFeature>()?.RawTarget;
        if (string.IsNullOrEmpty(rawTarget))
        {
            throw Reject("request-malformed");
        }
        if (Encoding.UTF8.GetByteCount(rawTarget) > MaximumRequestLineBytes)
        {
            throw Reject("request-line-too-large");
        }
        if (rawTarget[0] != '/' ||
            rawTarget.Contains('?', StringComparison.Ordinal) ||
            rawTarget.Contains('#', StringComparison.Ordinal) ||
            rawTarget.Contains('%', StringComparison.Ordinal))
        {
            throw Reject("request-malformed");
        }
        return rawTarget;
    }

    private static void ValidateHeaderBoundsAndDuplicates(IHeaderDictionary headers)
    {
        if (headers.Count > MaximumRequestHeaderCount)
        {
            throw Reject("request-headers-too-large");
        }

        var bytes = 0;
        try
        {
            foreach (var header in headers)
            {
                var name = header.Key.ToLowerInvariant();
                if (DuplicateSensitiveHeaders.Contains(name) && header.Value.Count != 1)
                {
                    throw Reject(name is "content-length" or "transfer-encoding"
                        ? "request-framing-invalid"
                        : "request-header-not-allowed");
                }
                foreach (var value in header.Value)
                {
                    bytes = checked(bytes + Encoding.UTF8.GetByteCount(header.Key) +
                        Encoding.UTF8.GetByteCount(value ?? string.Empty) + 4);
                }
            }
        }
        catch (OverflowException)
        {
            throw Reject("request-headers-too-large");
        }
        if (bytes > MaximumRequestHeaderBytes)
        {
            throw Reject("request-headers-too-large");
        }
    }

    private void ValidateHost(IHeaderDictionary headers)
    {
        if (!TryGetSingle(headers, "Host", out var host) ||
            !string.Equals(host, Host, StringComparison.Ordinal))
        {
            throw Reject("host-invalid");
        }
    }

    private static void ValidateOrigin(IHeaderDictionary headers)
    {
        if (!TryGetSingle(headers, "Origin", out var origin) ||
            !string.Equals(
                origin,
                CompanionLoopbackProtocol.ProductionOrigin,
                StringComparison.Ordinal))
        {
            throw Reject("origin-invalid");
        }
    }

    private static void ValidateAllowedHeaders(
        IHeaderDictionary headers,
        bool preflight)
    {
        foreach (var header in headers)
        {
            var name = header.Key.ToLowerInvariant();
            if (name is "transfer-encoding" or "expect" or "trailer" or "upgrade")
            {
                throw Reject("request-framing-invalid");
            }
            if (!AllowedRequestHeaders.Contains(name))
            {
                throw Reject("request-header-not-allowed");
            }
        }

        if (headers.TryGetValue("Connection", out var connection) &&
            connection.Any(value => ContainsToken(value, "upgrade")))
        {
            throw Reject("request-framing-invalid");
        }

        if (preflight)
        {
            if (headers.Keys.Any(name =>
                    name.StartsWith("X-TinyRustLM-", StringComparison.OrdinalIgnoreCase)))
            {
                throw Reject("cors-preflight-invalid");
            }
        }
        else if (headers.ContainsKey("Access-Control-Request-Method") ||
                 headers.ContainsKey("Access-Control-Request-Headers"))
        {
            throw Reject("request-header-not-allowed");
        }
    }

    private static void ValidateFetchMetadata(IHeaderDictionary headers)
    {
        RequireOptionalExact(headers, "Sec-Fetch-Mode", "cors");
        RequireOptionalExact(headers, "Sec-Fetch-Site", "cross-site");
        RequireOptionalExact(headers, "Sec-Fetch-Dest", "empty");
    }

    private static void ValidateRouteHeaders(
        IHeaderDictionary headers,
        RouteDefinition route)
    {
        var sessionHeaderNames = new[]
        {
            "X-TinyRustLM-Session",
            "X-TinyRustLM-Epoch",
            "X-TinyRustLM-Sequence",
            "X-TinyRustLM-Content-SHA256",
            "X-TinyRustLM-Request-Proof"
        };
        if (!route.Authenticated)
        {
            if (sessionHeaderNames.Any(headers.ContainsKey))
            {
                throw Reject("request-header-not-allowed");
            }
            return;
        }
        if (sessionHeaderNames.Any(name => !TryGetSingle(headers, name, out _)))
        {
            throw Reject("capability-invalid");
        }
    }

    private static async Task<byte[]> ReadBodyAsync(
        HttpContext context,
        RouteDefinition route)
    {
        var request = context.Request;
        if (request.Headers.ContainsKey("Transfer-Encoding"))
        {
            throw Reject("request-framing-invalid");
        }

        if (route.Method == HttpMethods.Get)
        {
            if (request.Headers.ContainsKey("Content-Type"))
            {
                throw Reject("media-type-invalid");
            }
            if (request.Headers.ContainsKey("Content-Length"))
            {
                throw Reject("request-framing-invalid");
            }
            return [];
        }

        if (!TryGetSingle(request.Headers, "Content-Length", out var rawLength) ||
            !ulong.TryParse(
                rawLength,
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out var contentLength) ||
            contentLength > int.MaxValue ||
            request.ContentLength != checked((long)contentLength))
        {
            throw Reject("request-framing-invalid");
        }
        if (contentLength > MaximumRequestBodyBytes)
        {
            var probe = new byte[1];
            _ = await request.Body.ReadAsync(probe, context.RequestAborted)
                .ConfigureAwait(false);
            throw Reject("request-body-too-large");
        }
        if (contentLength > checked((ulong)route.MaximumRequestBytes))
        {
            throw Reject("request-body-too-large");
        }
        if (!TryGetSingle(request.Headers, "Content-Type", out var contentType) ||
            !string.Equals(contentType, JsonContentType, StringComparison.Ordinal))
        {
            throw Reject("media-type-invalid");
        }

        var body = GC.AllocateUninitializedArray<byte>(checked((int)contentLength));
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(
            context.RequestAborted);
        timeout.CancelAfter(RequestBodyTimeout);
        try
        {
            await request.Body.ReadExactlyAsync(body, timeout.Token).ConfigureAwait(false);
            var sentinel = new byte[1];
            if (await request.Body.ReadAsync(sentinel, timeout.Token).ConfigureAwait(false) != 0)
            {
                throw Reject("request-framing-invalid");
            }
            return body;
        }
        catch (OperationCanceledException) when (!context.RequestAborted.IsCancellationRequested)
        {
            throw Reject("request-body-timeout");
        }
        catch (EndOfStreamException)
        {
            throw Reject("request-framing-invalid");
        }
    }

    private static byte[] DispatchPairing(
        CompanionCapabilityState state,
        RouteKind kind,
        ReadOnlySpan<byte> body)
    {
        try
        {
            return kind switch
            {
                RouteKind.PairingBegin => CompanionLoopbackWire.EncodePairingBeginResponse(
                    state.BeginPairing(CompanionLoopbackWire.DecodePairingBeginRequest(body))),
                RouteKind.PairingComplete => CompanionLoopbackWire.EncodePairingCompleteResponse(
                    state.CompletePairing(CompanionLoopbackWire.DecodePairingCompleteRequest(body))),
                _ => throw new InvalidOperationException("An authenticated route reached pairing dispatch.")
            };
        }
        catch (CompanionProtocolException exception)
        {
            throw Reject(NormalizeProtocolCode(exception.Code));
        }
    }

    private CompanionSessionLease Authenticate(
        CompanionCapabilityState state,
        HttpRequest request,
        string path,
        ReadOnlySpan<byte> body)
    {
        if (!TryGetSingle(request.Headers, "X-TinyRustLM-Session", out var sessionId) ||
            !TryGetSingle(request.Headers, "X-TinyRustLM-Epoch", out var rawEpoch) ||
            !TryGetSingle(request.Headers, "X-TinyRustLM-Sequence", out var rawSequence) ||
            !TryGetSingle(
                request.Headers,
                "X-TinyRustLM-Content-SHA256",
                out var contentSha256) ||
            !TryGetSingle(request.Headers, "X-TinyRustLM-Request-Proof", out var proof) ||
            !TryParseCanonicalUInt32(rawEpoch, out var epoch) ||
            !TryParseCanonicalUInt64(rawSequence, out var sequence))
        {
            throw Reject("capability-invalid");
        }

        var computedHash = CompanionLoopbackProtocol.Sha256Hex(body);
        if (!string.Equals(contentSha256, computedHash, StringComparison.Ordinal))
        {
            throw Reject("capability-invalid");
        }

        var context = new CompanionRequestProofContext(
            _installationId,
            _processInstanceId,
            sessionId,
            epoch,
            sequence,
            request.Method,
            Host,
            CompanionLoopbackProtocol.ProductionOrigin,
            path,
            request.Method == HttpMethods.Post ? JsonContentType : string.Empty,
            checked((ulong)body.Length),
            contentSha256);
        try
        {
            return state.Authenticate(new CompanionSessionAuthenticationRequest(context, proof));
        }
        catch (CompanionProtocolException exception)
        {
            throw Reject(NormalizeProtocolCode(exception.Code));
        }
    }

    private static CompanionProvenResponse DispatchAuthenticated(
        CompanionSessionLease lease,
        RouteDefinition route,
        ReadOnlySpan<byte> body)
    {
        return route.Kind switch
        {
            RouteKind.Session => lease.MaterializeSessionStatus(),
            RouteKind.RotationBegin => lease.BeginRotationAndMaterializeResponse(
                CompanionLoopbackWire.DecodeRotationBegin(body)),
            RouteKind.RotationCommit => DispatchRotationCommit(lease, body),
            RouteKind.Revoke => lease.RevokeAndMaterializeResponse(
                CompanionLoopbackWire.DecodeRevokeRequest(body)),
            RouteKind.OperationCreate or
            RouteKind.OperationStatus or
            RouteKind.OperationCancel or
            RouteKind.ArtifactChunk => MaterializeOperationUnavailable(lease, route),
            _ => throw new CompanionProtocolException("contract-invalid")
        };
    }

    private static CompanionProvenResponse DispatchRotationCommit(
        CompanionSessionLease lease,
        ReadOnlySpan<byte> body)
    {
        var request = CompanionLoopbackWire.DecodeRotationCommit(body);
        return lease.IsRotationCommitReplay
            ? lease.ReplayRotationCommit(request)
            : lease.CommitRotationAndMaterializeResponse(request);
    }

    private static CompanionProvenResponse MaterializeOperationUnavailable(
        CompanionSessionLease lease,
        RouteDefinition route)
    {
        if (route.InvalidOperationId)
        {
            return MaterializeError(lease, "operation-not-found");
        }
        if (route.InvalidArtifactRole)
        {
            return MaterializeError(lease, "artifact-role-invalid");
        }
        if (route.InvalidChunkIndex)
        {
            return MaterializeError(lease, "artifact-chunk-invalid");
        }
        return MaterializeError(lease, "operation-not-available");
    }

    private static CompanionProvenResponse MaterializeError(
        CompanionSessionLease lease,
        string code)
    {
        var body = CompanionLoopbackWire.EncodeError(
            new CompanionLoopbackError(CompanionLoopbackWire.ErrorSchema, code));
        return lease.MaterializeResponse(
            StatusFor(code),
            JsonContentType,
            body,
            CompanionLoopbackProtocol.EmptySha256);
    }

    private static async Task HandlePreflightAsync(
        HttpContext context,
        RouteDefinition route)
    {
        var headers = context.Request.Headers;
        if (!TryGetSingle(
                headers,
                "Access-Control-Request-Method",
                out var requestedMethod) ||
            !string.Equals(requestedMethod, route.Method, StringComparison.Ordinal) ||
            !TryGetSingle(
                headers,
                "Access-Control-Request-Headers",
                out var requestedHeaders) ||
            headers.ContainsKey("Content-Type") ||
            (headers.TryGetValue("Content-Length", out var length) &&
             (length.Count != 1 || !string.Equals(length[0], "0", StringComparison.Ordinal))))
        {
            throw Reject("cors-preflight-invalid");
        }

        var normalized = ParseRequestedHeaders(requestedHeaders);
        var response = context.Response;
        response.StatusCode = StatusCodes.Status204NoContent;
        response.ContentLength = null;
        response.ContentType = null;
        ApplyBaseResponseHeaders(response, cors: false);
        response.Headers.AccessControlAllowOrigin =
            CompanionLoopbackProtocol.ProductionOrigin;
        response.Headers["Access-Control-Allow-Methods"] = route.Method;
        response.Headers["Access-Control-Allow-Headers"] = string.Join(", ", normalized);
        response.Headers["Access-Control-Max-Age"] = "300";
        response.Headers.Vary = PreflightVary;
        await response.CompleteAsync().ConfigureAwait(false);
    }

    private static string[] ParseRequestedHeaders(string value)
    {
        var values = value.Split(',', StringSplitOptions.None);
        if (values.Length == 0)
        {
            throw Reject("cors-preflight-invalid");
        }
        var normalized = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in values)
        {
            var name = item.Trim().ToLowerInvariant();
            if (name.Length == 0 || !AllowedScriptHeaders.Contains(name) ||
                !normalized.Add(name))
            {
                throw Reject("cors-preflight-invalid");
            }
        }
        return normalized.Order(StringComparer.Ordinal).ToArray();
    }

    private static async Task WriteResponseAsync(
        HttpContext context,
        int status,
        string contentType,
        byte[] body,
        bool cors,
        CompanionProvenResponse? proven,
        bool isChunk)
    {
        if (body.Length > (isChunk ? 4_194_304 : 16_384))
        {
            throw Reject("internal-failure");
        }

        var response = context.Response;
        response.StatusCode = status;
        response.ContentType = contentType;
        response.ContentLength = body.Length;
        ApplyBaseResponseHeaders(response, cors);
        if (proven is not null)
        {
            var proofContext = proven.Context;
            response.Headers["X-TinyRustLM-Session"] = proofContext.SessionId;
            response.Headers["X-TinyRustLM-Epoch"] =
                proofContext.KeyEpoch.ToString(CultureInfo.InvariantCulture);
            response.Headers["X-TinyRustLM-Sequence"] =
                proofContext.Sequence.ToString(CultureInfo.InvariantCulture);
            response.Headers["X-TinyRustLM-Content-SHA256"] = proofContext.ContentSha256;
            response.Headers["X-TinyRustLM-Response-Metadata-SHA256"] =
                proofContext.ResponseMetadataSha256;
            response.Headers["X-TinyRustLM-Response-Proof"] = proven.Proof;
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(
            context.RequestAborted);
        timeout.CancelAfter(isChunk ? ChunkResponseTimeout : ControlResponseTimeout);
        await response.Body.WriteAsync(body, timeout.Token).ConfigureAwait(false);
        await response.CompleteAsync().ConfigureAwait(false);
    }

    private static async Task TryWriteUnprovedErrorAsync(
        HttpContext context,
        string code,
        bool cors)
    {
        if (context.Response.HasStarted || context.RequestAborted.IsCancellationRequested)
        {
            context.Abort();
            return;
        }
        try
        {
            var normalized = StatusIsRegistered(code) ? code : "internal-failure";
            var body = CompanionLoopbackWire.EncodeError(
                new CompanionLoopbackError(CompanionLoopbackWire.ErrorSchema, normalized));
            await WriteResponseAsync(
                context,
                StatusFor(normalized),
                JsonContentType,
                body,
                cors && normalized is not ("host-invalid" or "origin-invalid"),
                proven: null,
                isChunk: false).ConfigureAwait(false);
        }
        catch
        {
            context.Abort();
        }
    }

    private static void ApplyBaseResponseHeaders(HttpResponse response, bool cors)
    {
        response.Headers.CacheControl = "no-store";
        response.Headers.Pragma = "no-cache";
        response.Headers["X-Content-Type-Options"] = "nosniff";
        response.Headers.Connection = "close";
        if (cors)
        {
            response.Headers.AccessControlAllowOrigin =
                CompanionLoopbackProtocol.ProductionOrigin;
            response.Headers.AccessControlExposeHeaders = CorsExposeHeaders;
            response.Headers.Vary = "Origin";
        }
    }

    private static RouteDefinition MatchRoute(string path)
    {
        var exact = path switch
        {
            PairingBeginPath => new RouteDefinition(
                RouteKind.PairingBegin,
                HttpMethods.Post,
                CompanionLoopbackWire.MaximumPairingBeginRequestBytes,
                Authenticated: false),
            PairingCompletePath => new RouteDefinition(
                RouteKind.PairingComplete,
                HttpMethods.Post,
                CompanionLoopbackWire.MaximumPairingCompleteRequestBytes,
                Authenticated: false),
            SessionPath => new RouteDefinition(
                RouteKind.Session,
                HttpMethods.Get,
                0,
                Authenticated: true),
            RotationBeginPath => new RouteDefinition(
                RouteKind.RotationBegin,
                HttpMethods.Post,
                CompanionLoopbackWire.MaximumRotationBeginBytes,
                Authenticated: true),
            RotationCommitPath => new RouteDefinition(
                RouteKind.RotationCommit,
                HttpMethods.Post,
                CompanionLoopbackWire.MaximumRotationCommitBytes,
                Authenticated: true),
            RevokePath => new RouteDefinition(
                RouteKind.Revoke,
                HttpMethods.Post,
                CompanionLoopbackWire.MaximumRevokeRequestBytes,
                Authenticated: true),
            OperationsPath => new RouteDefinition(
                RouteKind.OperationCreate,
                HttpMethods.Post,
                MaximumRequestBodyBytes,
                Authenticated: true),
            _ => null
        };
        if (exact is not null)
        {
            return exact;
        }

        var segments = path.Split('/', StringSplitOptions.None);
        if (segments.Length < 5 || segments[0].Length != 0 ||
            segments[1] != "tinyrustlm-companion" ||
            segments[2] != "1" ||
            segments[3] != "operations")
        {
            throw Reject("route-not-found");
        }

        var invalidOperationId = !IsLowerHex(segments[4], 64);
        if (segments.Length == 5)
        {
            return new RouteDefinition(
                RouteKind.OperationStatus,
                HttpMethods.Get,
                0,
                Authenticated: true,
                InvalidOperationId: invalidOperationId);
        }
        if (segments.Length == 6 && segments[5] == "cancel")
        {
            return new RouteDefinition(
                RouteKind.OperationCancel,
                HttpMethods.Post,
                1_024,
                Authenticated: true,
                InvalidOperationId: invalidOperationId);
        }
        if (segments.Length == 9 &&
            segments[5] == "artifacts" &&
            segments[7] == "chunks")
        {
            var validRole = segments[6] is
                "composition" or "model" or "tokenizer" or
                "template" or "sampling" or "prompt";
            var validIndex = TryParseCanonicalUInt64(segments[8], out var chunkIndex) &&
                chunkIndex < 16_384;
            return new RouteDefinition(
                RouteKind.ArtifactChunk,
                HttpMethods.Get,
                0,
                Authenticated: true,
                IsChunk: true,
                InvalidOperationId: invalidOperationId,
                InvalidArtifactRole: !validRole,
                InvalidChunkIndex: !validIndex);
        }
        throw Reject("route-not-found");
    }

    private static ushort ResolveBoundPort(WebApplication application)
    {
        var server = application.Services.GetRequiredService<IServer>();
        var addresses = server.Features.Get<IServerAddressesFeature>()?.Addresses;
        if (addresses is null || addresses.Count != 1)
        {
            throw new CompanionProtocolException("companion-unavailable");
        }
        var address = addresses.Single();
        if (!Uri.TryCreate(address, UriKind.Absolute, out var uri) ||
            uri.Scheme != Uri.UriSchemeHttp ||
            uri.Host != "127.0.0.1" ||
            uri.Port is < 1_024 or > 65_535)
        {
            throw new CompanionProtocolException("companion-unavailable");
        }
        return checked((ushort)uri.Port);
    }

    private static bool TryGetSingle(
        IHeaderDictionary headers,
        string name,
        out string value)
    {
        if (headers.TryGetValue(name, out var values) &&
            values.Count == 1 &&
            values[0] is { } single)
        {
            value = single;
            return true;
        }
        value = string.Empty;
        return false;
    }

    private static void RequireOptionalExact(
        IHeaderDictionary headers,
        string name,
        string expected)
    {
        if (headers.ContainsKey(name) &&
            (!TryGetSingle(headers, name, out var actual) ||
             !string.Equals(actual, expected, StringComparison.Ordinal)))
        {
            throw Reject("request-header-not-allowed");
        }
    }

    private static bool ContainsToken(string? value, string expected) =>
        value is not null && value.Split(',').Any(token =>
            string.Equals(token.Trim(), expected, StringComparison.OrdinalIgnoreCase));

    private static bool TryParseCanonicalUInt32(string value, out uint result) =>
        uint.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out result) &&
        string.Equals(result.ToString(CultureInfo.InvariantCulture), value, StringComparison.Ordinal);

    private static bool TryParseCanonicalUInt64(string value, out ulong result) =>
        ulong.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out result) &&
        string.Equals(result.ToString(CultureInfo.InvariantCulture), value, StringComparison.Ordinal);

    private static bool IsLowerHex(string value, int length)
    {
        if (value.Length != length)
        {
            return false;
        }
        foreach (var character in value)
        {
            if (character is not (>= '0' and <= '9') and not (>= 'a' and <= 'f'))
            {
                return false;
            }
        }
        return true;
    }

    private static string NormalizeProtocolCode(string code)
    {
        if (StatusIsRegistered(code))
        {
            return code;
        }
        if (code is "json-size" || code.StartsWith("json-", StringComparison.Ordinal))
        {
            return "json-invalid";
        }
        if (code.EndsWith("-schema", StringComparison.Ordinal) ||
            code.EndsWith("-contract", StringComparison.Ordinal) ||
            code.StartsWith("pairing-", StringComparison.Ordinal) ||
            code.StartsWith("rotation-", StringComparison.Ordinal) ||
            code.StartsWith("revoke-", StringComparison.Ordinal) ||
            code.StartsWith("session-", StringComparison.Ordinal))
        {
            return "contract-invalid";
        }
        return "internal-failure";
    }

    private static int StatusFor(string code) => code switch
    {
        "request-malformed" or
        "request-line-too-large" or
        "request-headers-too-large" or
        "request-header-not-allowed" or
        "request-framing-invalid" or
        "request-body-timeout" or
        "cors-preflight-invalid" or
        "json-invalid" => StatusCodes.Status400BadRequest,
        "origin-invalid" or
        "pairing-proof-invalid" or
        "capability-invalid" or
        "capability-replay" or
        "capability-sequence" or
        "rotation-proof-invalid" => StatusCodes.Status403Forbidden,
        "route-not-found" or
        "operation-not-found" => StatusCodes.Status404NotFound,
        "method-not-allowed" => StatusCodes.Status405MethodNotAllowed,
        "pairing-claim-conflict" or
        "session-request-in-flight" or
        "rotation-conflict" or
        "operation-terminal" or
        "operation-not-available" or
        "artifact-identity-drift" => StatusCodes.Status409Conflict,
        "pairing-code-expired" or
        "pairing-consumed" or
        "capability-expired" or
        "capability-idle-expired" or
        "capability-revoked" or
        "rotation-expired" => StatusCodes.Status410Gone,
        "request-body-too-large" => StatusCodes.Status413PayloadTooLarge,
        "media-type-invalid" => StatusCodes.Status415UnsupportedMediaType,
        "contract-invalid" or
        "artifact-role-invalid" or
        "artifact-chunk-invalid" => StatusCodes.Status422UnprocessableEntity,
        "pairing-capacity" or
        "resource-limit" => StatusCodes.Status429TooManyRequests,
        "host-invalid" => StatusCodes.Status421MisdirectedRequest,
        "internal-failure" => StatusCodes.Status500InternalServerError,
        "companion-unavailable" => StatusCodes.Status503ServiceUnavailable,
        _ => throw new InvalidOperationException("The loopback error code is not registered.")
    };

    private static bool StatusIsRegistered(string code)
    {
        try
        {
            _ = StatusFor(code);
            return true;
        }
        catch (InvalidOperationException)
        {
            return false;
        }
    }

    private static LoopbackRequestException Reject(string code) => new(code);

    private enum RouteKind
    {
        PairingBegin,
        PairingComplete,
        Session,
        RotationBegin,
        RotationCommit,
        Revoke,
        OperationCreate,
        OperationStatus,
        OperationCancel,
        ArtifactChunk
    }

    private sealed record RouteDefinition(
        RouteKind Kind,
        string Method,
        int MaximumRequestBytes,
        bool Authenticated,
        bool IsChunk = false,
        bool InvalidOperationId = false,
        bool InvalidArtifactRole = false,
        bool InvalidChunkIndex = false);

    private sealed class LoopbackRequestException : Exception
    {
        internal LoopbackRequestException(string code)
            : base(code)
        {
            Code = code;
        }

        internal string Code { get; }
    }
}
