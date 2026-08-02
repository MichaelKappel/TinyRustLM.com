using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Primitives;

namespace TinyRustLM.SeedHost;

/// <summary>Owned storage, exact origins, and resource limits for one browser bridge.</summary>
public sealed record SeedHostBridgeOptions(
    string RootDirectory,
    IReadOnlyCollection<string> AllowedOrigins,
    int Port = 43127,
    int MaximumRequestBytes = 8 * 1024 * 1024,
    int MaximumConcurrentConnections = 32,
    TimeSpan? PairingLifetime = null,
    TimeSpan? CapabilityLifetime = null,
    bool AllowSharing = false);

/// <summary>Public-safe operational status returned to an authorized browser session.</summary>
public sealed record SeedHostBridgeRuntimeStatus(
    string State,
    uint NativeAbiVersion,
    int ModelCount,
    int ActiveImportCount,
    bool SharingEnabled);

/// <summary>Internal operations adapter; every trust decision remains in existing Rust-backed APIs.</summary>
internal interface ISeedHostBridgeOperations : IAsyncDisposable
{
    uint NativeAbiVersion { get; }

    ValueTask<SeedHostBridgeRuntimeStatus> GetStatusAsync(
        CancellationToken cancellationToken = default);

    ValueTask<SeedHostBridgeImportStatus> StartImportAsync(
        SeedHostBridgeImportSubmission submission,
        CancellationToken cancellationToken = default);

    ValueTask<SeedHostBridgeImportStatus> GetImportAsync(
        string operationId,
        CancellationToken cancellationToken = default);

    ValueTask<SeedHostBridgeImportStatus> CancelImportAsync(
        string operationId,
        CancellationToken cancellationToken = default);

    ValueTask<IReadOnlyList<SeedHostBridgeModelInfo>> ListModelsAsync(
        CancellationToken cancellationToken = default);

    ValueTask<SeedHostBridgeModelContent> OpenModelAsync(
        string operationId,
        CancellationToken cancellationToken = default);
}

/// <summary>Optional, host-enabled closed sharing actions exposed by the loopback bridge.</summary>
internal interface ISeedHostBridgeSharingOperations
{
    ValueTask<SeedHostBridgeSharingStatus> GetSharingAsync(
        CancellationToken cancellationToken = default);

    ValueTask<SeedHostBridgeSharingStatus> InitializeSharingAsync(
        string fleetId,
        CancellationToken cancellationToken = default);

    ValueTask<SeedHostBridgeSharingStatus> AdmitImportForSharingAsync(
        string operationId,
        IReadOnlyList<SeedLaneAdmissionEndpoint> laneEndpoints,
        CancellationToken cancellationToken = default);

    ValueTask<SeedHostBridgeSharingStatus> SetImportSharingEnabledAsync(
        string operationId,
        bool enabled,
        CancellationToken cancellationToken = default);

    ValueTask<SeedHostBridgeSharingStatus> RemoveImportFromSharingAsync(
        string operationId,
        CancellationToken cancellationToken = default);
}

/// <summary>Public-safe sharing state for one receipt-verified browser import.</summary>
public sealed record SeedHostBridgeSharingModelInfo(
    string? OperationId,
    string ModelId,
    bool Enabled,
    string AnnouncementState);

/// <summary>Path-free fleet status returned only under an explicit sharing capability.</summary>
public sealed record SeedHostBridgeSharingStatus(
    bool SharingEnabled,
    bool Initialized,
    string? FleetId,
    int TargetModelCount,
    int AdmittedModelCount,
    int RemainingModelCapacity,
    int ReplicaLaneCount,
    string AdvertisementStatus,
    IReadOnlyList<SeedHostBridgeSharingModelInfo> Models);

/// <summary>
/// Loopback-only HTTP/1.1 bridge with exact-origin CORS, one-time pairing, and short-lived scoped
/// capabilities. This server has no arbitrary filesystem, command, cookie, or remote-control route.
/// </summary>
public sealed class SeedHostBridgeServer : IAsyncDisposable
{
    /// <summary>Current bridge wire protocol version.</summary>
    public const int ProtocolVersion = 1;

    /// <summary>Header carrying the exact bridge protocol version.</summary>
    public const string ProtocolVersionHeader = "X-TinyRustLM-Bridge-Version";

    /// <summary>Header carrying a volatile origin-bound browser capability.</summary>
    public const string CapabilityHeader = "X-TinyRustLM-Bridge-Capability";

    /// <summary>Header carrying a unique ID for replay-protected mutations.</summary>
    public const string RequestIdHeader = "X-TinyRustLM-Bridge-Request-Id";

    private static readonly JsonSerializerOptions JsonOptions = CreateJsonOptions();
    private static readonly string[] CorsAllowedHeaders =
    [
        "content-type",
        ProtocolVersionHeader.ToLowerInvariant(),
        CapabilityHeader.ToLowerInvariant(),
        RequestIdHeader.ToLowerInvariant()
    ];

    private readonly SeedHostBridgeOptions options;
    private readonly ISeedHostBridgeOperations operations;
    private readonly SeedHostBridgeSessionManager sessions;
    private readonly HashSet<string> allowedOrigins;
    private WebApplication? application;
    private Uri? endpoint;
    private bool disposed;

    /// <summary>Create a production bridge backed by the packaged MiniModel Rust authority.</summary>
    public SeedHostBridgeServer(
        SeedHostBridgeOptions options,
        string? miniModelExecutablePath = null)
        : this(options, new MiniModelAuthority(), miniModelExecutablePath)
    {
    }

    /// <summary>Create a production bridge with an explicitly supplied Rust authority.</summary>
    public SeedHostBridgeServer(
        SeedHostBridgeOptions options,
        IMiniModelAuthority authority,
        string? miniModelExecutablePath = null)
        : this(
            options,
            new SeedHostBridgeOperations(
                new SeedHostBridgeOperationOptions(
                    Path.Combine(
                        Path.GetFullPath(options?.RootDirectory
                            ?? throw new ArgumentNullException(nameof(options))),
                        "operations"),
                    miniModelExecutablePath,
                    SharingRootDirectory: Path.GetFullPath(options.RootDirectory),
                    AllowSharing: options.AllowSharing),
                authority ?? throw new ArgumentNullException(nameof(authority))))
    {
    }

    internal SeedHostBridgeServer(
        SeedHostBridgeOptions options,
        ISeedHostBridgeOperations operations,
        TimeProvider? timeProvider = null)
    {
        this.options = ValidateOptions(options);
        this.operations = operations ?? throw new ArgumentNullException(nameof(operations));
        var securityPolicy = new SeedHostBridgeSecurityPolicy(
            this.options.AllowedOrigins,
            this.options.PairingLifetime,
            this.options.CapabilityLifetime);
        sessions = new SeedHostBridgeSessionManager(securityPolicy, timeProvider);
        allowedOrigins = this.options.AllowedOrigins
            .Select(SeedHostBridgeSessionManager.NormalizeOrigin)
            .ToHashSet(StringComparer.Ordinal);
    }

    /// <summary>Actual IPv4 loopback endpoint after <see cref="StartAsync"/> succeeds.</summary>
    public Uri Endpoint => endpoint
        ?? throw new InvalidOperationException("The bridge has not started.");

    /// <summary>
    /// Create one host-visible pairing code. The code is returned only here, is not logged by the
    /// bridge, and is retained internally only as a digest.
    /// </summary>
    public SeedHostBridgePairingChallenge CreatePairingChallenge()
    {
        ThrowIfDisposed();
        var scopes = new List<SeedHostBridgeScope>
        {
            SeedHostBridgeScope.Status,
            SeedHostBridgeScope.ModelsRead,
            SeedHostBridgeScope.ImportsCreate,
            SeedHostBridgeScope.ImportsRead,
            SeedHostBridgeScope.ImportsCancel,
            SeedHostBridgeScope.ModelsStream
        };
        if (options.AllowSharing)
        {
            scopes.Add(SeedHostBridgeScope.SharingManage);
        }
        return sessions.CreatePairingChallenge(scopes);
    }

    /// <summary>Start Kestrel on IPv4 loopback only; port zero selects an ephemeral test port.</summary>
    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        if (application is not null)
        {
            throw new InvalidOperationException("The bridge is already started.");
        }
        EnsureOwnedRoot(options.RootDirectory);
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions
        {
            ApplicationName = typeof(SeedHostBridgeServer).Assembly.GetName().Name,
            Args = []
        });
        builder.Logging.ClearProviders();
        builder.WebHost.ConfigureKestrel(server =>
        {
            server.AddServerHeader = false;
            server.Limits.MaxRequestBodySize = options.MaximumRequestBytes + 1024L;
            server.Limits.MaxRequestHeadersTotalSize = 16 * 1024;
            server.Limits.MaxRequestHeaderCount = 32;
            server.Limits.MaxConcurrentConnections = options.MaximumConcurrentConnections;
            server.Limits.MaxConcurrentUpgradedConnections = 0;
            server.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(5);
            server.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(10);
            server.Listen(IPAddress.Loopback, options.Port, listen =>
            {
                listen.Protocols = HttpProtocols.Http1;
            });
        });
        var app = builder.Build();
        app.Use(ValidateTransportAsync);
        MapRoutes(app);
        try
        {
            await app.StartAsync(cancellationToken).ConfigureAwait(false);
            var addresses = app.Services
                .GetRequiredService<IServer>()
                .Features
                .Get<IServerAddressesFeature>()
                ?.Addresses;
            var address = addresses?.SingleOrDefault(value =>
                value.StartsWith("http://127.0.0.1:", StringComparison.Ordinal));
            if (address is null || !Uri.TryCreate(address, UriKind.Absolute, out endpoint))
            {
                throw new SeedHostException(
                    "bridge_bind_identity_missing",
                    "The bridge started without one verifiable IPv4 loopback endpoint.");
            }
            application = app;
        }
        catch
        {
            await app.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    private async Task ValidateTransportAsync(HttpContext context, RequestDelegate next)
    {
        AddSecurityHeaders(context.Response);
        try
        {
            ValidateHost(context.Request);
            var origin = RequireAllowedOrigin(context.Request);
            AddCorsHeaders(context.Response, origin);
            if (HttpMethods.IsOptions(context.Request.Method))
            {
                await HandlePreflightAsync(context, origin).ConfigureAwait(false);
                return;
            }
            RequireProtocolVersion(context.Request);
            await next(context).ConfigureAwait(false);
        }
        catch (SeedHostValidationException error)
        {
            await WriteErrorAsync(context, StatusCode(error.Code), error.Code, error.Message)
                .ConfigureAwait(false);
        }
        catch (SeedHostException error)
        {
            await WriteErrorAsync(context, StatusCode(error.Code), error.Code, error.Message)
                .ConfigureAwait(false);
        }
        catch (Microsoft.AspNetCore.Http.BadHttpRequestException)
        {
            await WriteErrorAsync(
                    context,
                    StatusCodes.Status400BadRequest,
                    "bridge_request_invalid",
                    "The bridge request was malformed.")
                .ConfigureAwait(false);
        }
    }

    private void MapRoutes(WebApplication app)
    {
        app.MapGet("/v1/health", async context =>
        {
            await WriteJsonAsync(context, StatusCodes.Status200OK, new
            {
                service = "tinyrustlm-seed-host-bridge",
                protocol_version = ProtocolVersion,
                pairing_state = sessions.HasActiveSessions ? "paired" : "unpaired",
                transport = "ipv4-loopback-http1",
                credentials_persisted = false,
                project_server_serves_model_bytes = false
            }).ConfigureAwait(false);
        });

        app.MapPost("/v1/pair", async context =>
        {
            var request = await ReadJsonAsync<PairRequest>(context).ConfigureAwait(false);
            var session = sessions.Pair(
                RequireOriginHeader(context.Request),
                request.Code,
                request.RequestedScopes);
            await WriteJsonAsync(context, StatusCodes.Status200OK, session).ConfigureAwait(false);
        });

        app.MapGet("/v1/status", async context =>
        {
            Authorize(context, SeedHostBridgeScope.Status);
            var status = await operations.GetStatusAsync(context.RequestAborted).ConfigureAwait(false);
            await WriteJsonAsync(context, StatusCodes.Status200OK, status).ConfigureAwait(false);
        });

        app.MapPost("/v1/session/revoke", async context =>
        {
            _ = await ReadJsonAsync<EmptyRequest>(context).ConfigureAwait(false);
            Authorize(context, SeedHostBridgeScope.Status, isMutation: true);
            sessions.Revoke(
                RequireOriginHeader(context.Request),
                RequireSingleHeader(context.Request, CapabilityHeader, "bridge_capability_required"));
            context.Response.StatusCode = StatusCodes.Status204NoContent;
        });

        app.MapPost("/v1/session/rotate", async context =>
        {
            _ = await ReadJsonAsync<EmptyRequest>(context).ConfigureAwait(false);
            Authorize(context, SeedHostBridgeScope.Status, isMutation: true);
            var session = sessions.Rotate(
                RequireOriginHeader(context.Request),
                RequireSingleHeader(context.Request, CapabilityHeader, "bridge_capability_required"));
            await WriteJsonAsync(context, StatusCodes.Status200OK, session).ConfigureAwait(false);
        });

        app.MapPost("/v1/imports", async context =>
        {
            Authorize(context, SeedHostBridgeScope.ImportsCreate, isMutation: true);
            var request = await ReadJsonAsync<ImportRequest>(context).ConfigureAwait(false);
            var status = await operations.StartImportAsync(
                    new SeedHostBridgeImportSubmission(
                        request.ManifestText,
                        request.PeerImportRequests),
                    context.RequestAborted)
                .ConfigureAwait(false);
            await WriteJsonAsync(context, StatusCodes.Status202Accepted, status).ConfigureAwait(false);
        });

        app.MapGet("/v1/imports/{operationId}", async context =>
        {
            Authorize(context, SeedHostBridgeScope.ImportsRead);
            var status = await operations.GetImportAsync(
                    RequireRouteValue(context, "operationId"),
                    context.RequestAborted)
                .ConfigureAwait(false);
            await WriteJsonAsync(context, StatusCodes.Status200OK, status).ConfigureAwait(false);
        });

        app.MapPost("/v1/imports/{operationId}/cancel", async context =>
        {
            Authorize(context, SeedHostBridgeScope.ImportsCancel, isMutation: true);
            _ = await ReadJsonAsync<EmptyRequest>(context).ConfigureAwait(false);
            var status = await operations.CancelImportAsync(
                    RequireRouteValue(context, "operationId"),
                    context.RequestAborted)
                .ConfigureAwait(false);
            await WriteJsonAsync(context, StatusCodes.Status200OK, status).ConfigureAwait(false);
        });

        app.MapGet("/v1/models", async context =>
        {
            Authorize(context, SeedHostBridgeScope.ModelsRead);
            var models = await operations.ListModelsAsync(context.RequestAborted).ConfigureAwait(false);
            await WriteJsonAsync(
                    context,
                    StatusCodes.Status200OK,
                    new ModelListResponse(models))
                .ConfigureAwait(false);
        });

        app.MapGet("/v1/models/{operationId}/content", async context =>
        {
            Authorize(context, SeedHostBridgeScope.ModelsStream);
            if (context.Request.Headers.ContainsKey("Range"))
            {
                throw new SeedHostValidationException(
                    "bridge_ranges_unsupported",
                    "Version 1 model streams require one complete receipt-verified artifact.");
            }
            await using var model = await operations.OpenModelAsync(
                    RequireRouteValue(context, "operationId"),
                    context.RequestAborted)
                .ConfigureAwait(false);
            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentType = "application/octet-stream";
            context.Response.ContentLength = model.ByteCount;
            context.Response.Headers["X-TinyRustLM-Model-Id"] = model.ModelId;
            context.Response.Headers["X-TinyRustLM-Artifact-Sha256"] = model.ArtifactSha256;
            await model.Content.CopyToAsync(context.Response.Body, context.RequestAborted)
                .ConfigureAwait(false);
        });

        app.MapGet("/v1/sharing", async context =>
        {
            Authorize(context, SeedHostBridgeScope.SharingManage);
            var status = await RequireSharingOperations()
                .GetSharingAsync(context.RequestAborted)
                .ConfigureAwait(false);
            await WriteJsonAsync(context, StatusCodes.Status200OK, status).ConfigureAwait(false);
        });

        app.MapPost("/v1/sharing/initialize", async context =>
        {
            Authorize(context, SeedHostBridgeScope.SharingManage, isMutation: true);
            var request = await ReadJsonAsync<SharingInitializeRequest>(context).ConfigureAwait(false);
            var status = await RequireSharingOperations()
                .InitializeSharingAsync(request.FleetId, context.RequestAborted)
                .ConfigureAwait(false);
            await WriteJsonAsync(context, StatusCodes.Status200OK, status).ConfigureAwait(false);
        });

        app.MapPost("/v1/sharing/imports/{operationId}/admit", async context =>
        {
            Authorize(context, SeedHostBridgeScope.SharingManage, isMutation: true);
            var request = await ReadJsonAsync<SharingAdmissionRequest>(context).ConfigureAwait(false);
            var status = await RequireSharingOperations()
                .AdmitImportForSharingAsync(
                    RequireRouteValue(context, "operationId"),
                    request.LaneEndpoints,
                    context.RequestAborted)
                .ConfigureAwait(false);
            await WriteJsonAsync(context, StatusCodes.Status200OK, status).ConfigureAwait(false);
        });

        app.MapPost("/v1/sharing/imports/{operationId}/enable", context =>
            SetSharingEnabledAsync(context, enabled: true));
        app.MapPost("/v1/sharing/imports/{operationId}/disable", context =>
            SetSharingEnabledAsync(context, enabled: false));
        app.MapPost("/v1/sharing/imports/{operationId}/remove", async context =>
        {
            Authorize(context, SeedHostBridgeScope.SharingManage, isMutation: true);
            _ = await ReadJsonAsync<EmptyRequest>(context).ConfigureAwait(false);
            var status = await RequireSharingOperations()
                .RemoveImportFromSharingAsync(
                    RequireRouteValue(context, "operationId"),
                    context.RequestAborted)
                .ConfigureAwait(false);
            await WriteJsonAsync(context, StatusCodes.Status200OK, status).ConfigureAwait(false);
        });

        app.MapFallback(async context =>
        {
            await WriteErrorAsync(
                    context,
                    StatusCodes.Status404NotFound,
                    "bridge_route_not_found",
                    "The bridge route does not exist.")
                .ConfigureAwait(false);
        });
    }

    private async Task SetSharingEnabledAsync(HttpContext context, bool enabled)
    {
        Authorize(context, SeedHostBridgeScope.SharingManage, isMutation: true);
        _ = await ReadJsonAsync<EmptyRequest>(context).ConfigureAwait(false);
        var status = await RequireSharingOperations()
            .SetImportSharingEnabledAsync(
                RequireRouteValue(context, "operationId"),
                enabled,
                context.RequestAborted)
            .ConfigureAwait(false);
        await WriteJsonAsync(context, StatusCodes.Status200OK, status).ConfigureAwait(false);
    }

    private ISeedHostBridgeSharingOperations RequireSharingOperations()
    {
        if (!options.AllowSharing || operations is not ISeedHostBridgeSharingOperations sharing)
        {
            throw new SeedHostValidationException(
                "bridge_sharing_disabled",
                "Sharing control was not enabled by the local companion operator.");
        }
        return sharing;
    }

    private SeedHostBridgeAuthorization Authorize(
        HttpContext context,
        SeedHostBridgeScope scope,
        bool isMutation = false)
    {
        var capability = RequireSingleHeader(
            context.Request,
            CapabilityHeader,
            "bridge_capability_required");
        var requestId = isMutation
            ? RequireSingleHeader(context.Request, RequestIdHeader, "bridge_request_id_invalid")
            : null;
        return sessions.Authorize(
            RequireOriginHeader(context.Request),
            capability,
            scope,
            requestId,
            isMutation);
    }

    private async Task<T> ReadJsonAsync<T>(HttpContext context)
    {
        var request = context.Request;
        if (request.Headers.ContainsKey("Transfer-Encoding") || request.ContentLength is null)
        {
            throw new SeedHostValidationException(
                "bridge_content_length_required",
                "Bridge JSON requests require one explicit Content-Length and cannot be chunked.");
        }
        if (request.ContentLength is <= 0)
        {
            throw new SeedHostValidationException(
                "bridge_json_invalid",
                "The bridge JSON request body is empty.");
        }
        if (request.ContentLength > options.MaximumRequestBytes)
        {
            throw new SeedHostValidationException(
                "bridge_request_too_large",
                "The bridge request exceeds its configured byte limit.");
        }
        if (!request.ContentType?.StartsWith("application/json", StringComparison.OrdinalIgnoreCase)
            ?? true)
        {
            throw new SeedHostValidationException(
                "bridge_content_type_invalid",
                "Bridge request bodies must use application/json.");
        }
        try
        {
            var value = await JsonSerializer.DeserializeAsync<T>(
                    request.Body,
                    JsonOptions,
                    context.RequestAborted)
                .ConfigureAwait(false);
            return value ?? throw new JsonException("JSON body was null.");
        }
        catch (JsonException)
        {
            throw new SeedHostValidationException(
                "bridge_json_invalid",
                "The bridge JSON request did not match the strict protocol schema.");
        }
    }

    private async Task HandlePreflightAsync(HttpContext context, string origin)
    {
        var method = RequireSingleHeader(
            context.Request,
            "Access-Control-Request-Method",
            "bridge_preflight_invalid");
        if (method is not ("GET" or "POST"))
        {
            throw new SeedHostValidationException(
                "bridge_preflight_denied",
                "The requested bridge method is not allowed.");
        }
        var requestedHeaders = context.Request.Headers.TryGetValue(
                "Access-Control-Request-Headers",
                out var headerValues)
            ? headerValues.ToString().Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(value => value.Trim().ToLowerInvariant()).ToArray()
            : [];
        if (requestedHeaders.Any(header => !CorsAllowedHeaders.Contains(header, StringComparer.Ordinal)))
        {
            throw new SeedHostValidationException(
                "bridge_preflight_denied",
                "The requested bridge header is not allowed.");
        }
        context.Response.Headers.AccessControlAllowOrigin = origin;
        context.Response.Headers.AccessControlAllowMethods = "GET, POST, OPTIONS";
        context.Response.Headers.AccessControlAllowHeaders = string.Join(", ", CorsAllowedHeaders);
        context.Response.Headers.AccessControlMaxAge = "300";
        if (string.Equals(
            context.Request.Headers["Access-Control-Request-Private-Network"],
            "true",
            StringComparison.OrdinalIgnoreCase))
        {
            context.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
        }
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        await context.Response.CompleteAsync().ConfigureAwait(false);
    }

    private void ValidateHost(HttpRequest request)
    {
        var expectedPort = endpoint?.Port ?? options.Port;
        if (!string.Equals(request.Host.Host, "127.0.0.1", StringComparison.Ordinal)
            || request.Host.Port != expectedPort)
        {
            throw new SeedHostValidationException(
                "bridge_host_denied",
                "The bridge Host header must name its exact IPv4 loopback endpoint.");
        }
    }

    private string RequireAllowedOrigin(HttpRequest request)
    {
        var origin = RequireOriginHeader(request);
        string normalized;
        try
        {
            normalized = SeedHostBridgeSessionManager.NormalizeOrigin(origin);
        }
        catch (SeedHostValidationException)
        {
            throw new SeedHostValidationException(
                "bridge_origin_denied",
                "The browser Origin header is not approved for this bridge instance.");
        }
        if (!allowedOrigins.Contains(normalized))
        {
            throw new SeedHostValidationException(
                "bridge_origin_denied",
                "The browser Origin header is not approved for this bridge instance.");
        }
        return normalized;
    }

    private static string RequireOriginHeader(HttpRequest request) =>
        RequireSingleHeader(request, "Origin", "bridge_origin_denied");

    private static void RequireProtocolVersion(HttpRequest request)
    {
        var value = RequireSingleHeader(
            request,
            ProtocolVersionHeader,
            "bridge_protocol_version_required");
        if (!string.Equals(value, ProtocolVersion.ToString(), StringComparison.Ordinal))
        {
            throw new SeedHostValidationException(
                "bridge_protocol_version_unsupported",
                "The browser and bridge protocol versions do not match.");
        }
    }

    private static string RequireSingleHeader(
        HttpRequest request,
        string name,
        string errorCode)
    {
        if (!request.Headers.TryGetValue(name, out StringValues values)
            || values.Count != 1
            || string.IsNullOrWhiteSpace(values[0])
            || values[0]!.Length > 2048
            || values[0]!.Any(char.IsControl))
        {
            throw new SeedHostValidationException(errorCode, $"The bridge requires one valid {name} header.");
        }
        return values[0]!;
    }

    private static string RequireRouteValue(HttpContext context, string name)
    {
        var value = context.Request.RouteValues[name]?.ToString();
        if (string.IsNullOrWhiteSpace(value)
            || value.Length > 128
            || value.Any(char.IsControl))
        {
            throw new SeedHostValidationException(
                "bridge_route_value_invalid",
                "The bridge route identity is invalid.");
        }
        return value;
    }

    private static void AddSecurityHeaders(HttpResponse response)
    {
        response.Headers.CacheControl = "no-store";
        response.Headers.Pragma = "no-cache";
        response.Headers["X-Content-Type-Options"] = "nosniff";
        response.Headers["Referrer-Policy"] = "no-referrer";
        response.Headers["Cross-Origin-Resource-Policy"] = "cross-origin";
    }

    private static void AddCorsHeaders(HttpResponse response, string origin)
    {
        response.Headers.AccessControlAllowOrigin = origin;
        response.Headers.AccessControlExposeHeaders =
            "Content-Length, X-TinyRustLM-Model-Id, X-TinyRustLM-Artifact-Sha256";
        response.Headers.Vary = "Origin";
    }

    private static async Task WriteJsonAsync(HttpContext context, int statusCode, object value)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json; charset=utf-8";
        await JsonSerializer.SerializeAsync(
                context.Response.Body,
                value,
                value.GetType(),
                JsonOptions,
                context.RequestAborted)
            .ConfigureAwait(false);
    }

    private static Task WriteErrorAsync(
        HttpContext context,
        int statusCode,
        string code,
        string message)
    {
        if (context.Response.HasStarted)
        {
            return Task.CompletedTask;
        }
        return WriteJsonAsync(context, statusCode, new
        {
            error = new { code, message }
        });
    }

    private static int StatusCode(string code) => code switch
    {
        "bridge_host_denied" or "bridge_json_invalid" or "bridge_content_type_invalid"
            or "bridge_request_id_invalid" => StatusCodes.Status400BadRequest,
        "bridge_origin_denied" or "bridge_origin_mismatch" or "bridge_scope_denied"
            or "bridge_scope_not_granted" or "bridge_sharing_disabled" =>
            StatusCodes.Status403Forbidden,
        "bridge_protocol_version_required" or "bridge_protocol_version_unsupported" =>
            StatusCodes.Status426UpgradeRequired,
        "bridge_content_length_required" => StatusCodes.Status411LengthRequired,
        "bridge_request_too_large" => StatusCodes.Status413PayloadTooLarge,
        "bridge_pairing_code_consumed" or "bridge_request_replay" =>
            StatusCodes.Status409Conflict,
        "bridge_import_not_found" => StatusCodes.Status404NotFound,
        "bridge_ranges_unsupported" => StatusCodes.Status416RangeNotSatisfiable,
        "bridge_model_not_available" or "bridge_model_revalidation_failed"
            or "bridge_import_state_conflict" or "bridge_sharing_state_conflict"
            or "bridge_sharing_admission_conflict"
            or "bridge_sharing_model_not_owned" => StatusCodes.Status409Conflict,
        "bridge_capability_required" or "bridge_capability_invalid"
            or "bridge_capability_expired" or "bridge_capability_revoked"
            or "bridge_pairing_code_invalid" or "bridge_pairing_code_expired" =>
            StatusCodes.Status401Unauthorized,
        "bridge_preflight_denied" or "bridge_preflight_invalid" =>
            StatusCodes.Status403Forbidden,
        _ => StatusCodes.Status400BadRequest
    };

    private static SeedHostBridgeOptions ValidateOptions(SeedHostBridgeOptions value)
    {
        ArgumentNullException.ThrowIfNull(value);
        ArgumentException.ThrowIfNullOrWhiteSpace(value.RootDirectory);
        if (value.RootDirectory.Contains('\0'))
        {
            throw new SeedHostValidationException(
                "bridge_root_invalid",
                "The bridge root contains an embedded NUL.");
        }
        if (value.Port is < 0 or > 65535
            || value.MaximumRequestBytes is < 512 or > 8 * 1024 * 1024
            || value.MaximumConcurrentConnections is < 4 or > 256)
        {
            throw new SeedHostValidationException(
                "bridge_limits_invalid",
                "The bridge port or resource limits are outside supported bounds.");
        }
        return value with { RootDirectory = Path.GetFullPath(value.RootDirectory) };
    }

    private static void EnsureOwnedRoot(string root)
    {
        Directory.CreateDirectory(root);
        var information = new DirectoryInfo(root);
        if ((information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                "bridge_root_unsafe",
                "The bridge root must be a regular non-link directory.");
        }
    }

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var value = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            PropertyNameCaseInsensitive = false,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
        value.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower));
        return value;
    }

    private void ThrowIfDisposed() => ObjectDisposedException.ThrowIf(disposed, this);

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        if (disposed)
        {
            return;
        }
        disposed = true;
        if (application is not null)
        {
            using var stopTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            await application.StopAsync(stopTimeout.Token).ConfigureAwait(false);
            await application.DisposeAsync().ConfigureAwait(false);
            application = null;
            endpoint = null;
        }
        await operations.DisposeAsync().ConfigureAwait(false);
    }

    private sealed record PairRequest(
        string Code,
        IReadOnlyList<SeedHostBridgeScope> RequestedScopes);

    private sealed record ImportRequest(
        string ManifestText,
        IReadOnlyList<string> PeerImportRequests);

    private sealed record SharingInitializeRequest(string FleetId);

    private sealed record SharingAdmissionRequest(
        IReadOnlyList<SeedLaneAdmissionEndpoint> LaneEndpoints);

    private sealed record ModelListResponse(
        IReadOnlyList<SeedHostBridgeModelInfo> Models);

    private sealed record EmptyRequest;
}
