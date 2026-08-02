using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TinyRustLM.SeedHost;

/// <summary>Timeout and response budget for local seed endpoint checks.</summary>
public sealed record SeedFleetLocalProbeOptions(
    TimeSpan? EndpointTimeout = null,
    int MaximumResponseBytes = 32 * 1024);

/// <summary>One bounded local check; it is never evidence of external reachability.</summary>
public sealed record SeedLocalEndpointProbe(
    string LaneId,
    string ModelId,
    string PublicBaseUrl,
    string LocalStatusUrl,
    DateTimeOffset CheckedUtc,
    bool LocallyReachable,
    bool ExternallyReachable,
    bool AnnouncementEligible,
    string? ErrorCode);

/// <summary>Local health for all enabled endpoints in a Rust-validated fleet.</summary>
public sealed record SeedFleetLocalProbeReport(
    string FleetId,
    DateTimeOffset CheckedUtc,
    int EnabledEndpointCount,
    int ReachableEndpointCount,
    bool AllEnabledEndpointsReachable,
    bool ExternallyReachable,
    bool AnnouncementEligible,
    IReadOnlyList<SeedLocalEndpointProbe> Endpoints);

/// <summary>Performs credential-free local HTTP checks against Rust-verified expected identities.</summary>
public sealed class SeedFleetLocalProbeService : IDisposable
{
    private const long MaxConfigurationBytes = 4 * 1024 * 1024;
    private const int MaximumTransientAttempts = 3;
    private const string StatusRoute = "minimodel.peer_status.v0.json";
    private readonly IMiniModelAuthority authority;
    private readonly SeedFleetLocalProbeOptions options;
    private readonly TimeProvider timeProvider;
    private readonly HttpClient httpClient;
    private bool disposed;

    private static readonly JsonSerializerOptions StatusJsonOptions = new()
    {
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    /// <summary>Create a local probe service with no proxy, cookies, redirects, or credentials.</summary>
    public SeedFleetLocalProbeService(
        IMiniModelAuthority authority,
        SeedFleetLocalProbeOptions? options = null,
        TimeProvider? timeProvider = null)
    {
        ArgumentNullException.ThrowIfNull(authority);
        this.authority = authority;
        this.options = options ?? new SeedFleetLocalProbeOptions();
        this.timeProvider = timeProvider ?? TimeProvider.System;
        ValidateOptions(this.options);
        httpClient = new HttpClient(new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.None,
            ConnectTimeout = EffectiveTimeout,
            UseCookies = false,
            UseProxy = false
        })
        {
            Timeout = Timeout.InfiniteTimeSpan
        };
    }

    /// <summary>
    /// Probe each enabled local bind address. The report deliberately cannot assert public reachability.
    /// </summary>
    public async Task<SeedFleetLocalProbeReport> ProbeAsync(
        string configurationPath,
        CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(disposed, this);
        ArgumentException.ThrowIfNullOrWhiteSpace(configurationPath);
        var absolutePath = Path.GetFullPath(configurationPath);
        var information = new FileInfo(absolutePath);
        if (!information.Exists
            || information.Length is <= 0 or > MaxConfigurationBytes
            || (information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                "invalid_configuration_path",
                "Local probe requires a bounded regular non-link fleet configuration.");
        }
        cancellationToken.ThrowIfCancellationRequested();
        var inspection = authority.InspectSeedFleet(absolutePath);
        var configuration = SeedFleetConfiguration.Parse(
            await File.ReadAllTextAsync(absolutePath, cancellationToken).ConfigureAwait(false));
        var root = Path.GetDirectoryName(absolutePath)
            ?? throw new SeedHostValidationException(
                "invalid_configuration_path",
                "Fleet configuration must have a parent directory.");
        var enabled = configuration.Models
            .Where(model => model.Enabled)
            .ToDictionary(model => model.ModelId, StringComparer.Ordinal);
        var expected = new Dictionary<string, PeerCompanionInspection>(StringComparer.Ordinal);
        foreach (var model in enabled.Values)
        {
            var endpoint = configuration.Lanes[0].Endpoints.Single(value =>
                string.Equals(value.ModelId, model.ModelId, StringComparison.Ordinal));
            expected.Add(model.ModelId, authority.InspectPeerCompanionState(
                Path.Combine(root, endpoint.StatePath),
                Path.Combine(root, model.ManifestPath),
                Path.Combine(root, model.PieceDirectory)));
        }

        var endpointResults = new List<SeedLocalEndpointProbe>();
        foreach (var lane in configuration.Lanes)
        {
            foreach (var endpoint in lane.Endpoints.Where(value => enabled.ContainsKey(value.ModelId)))
            {
                cancellationToken.ThrowIfCancellationRequested();
                endpointResults.Add(await ProbeEndpointAsync(
                    lane.LaneId,
                    endpoint,
                    expected[endpoint.ModelId],
                    cancellationToken).ConfigureAwait(false));
            }
        }
        var checkedUtc = timeProvider.GetUtcNow();
        var reachable = endpointResults.Count(value => value.LocallyReachable);
        if (inspection.PeerEndpointCount != endpointResults.Count)
        {
            throw new SeedHostException(
                "local_probe_endpoint_count_mismatch",
                "Managed local probe endpoint count differs from Rust fleet inspection.");
        }
        return new SeedFleetLocalProbeReport(
            inspection.FleetId,
            checkedUtc,
            endpointResults.Count,
            reachable,
            endpointResults.Count > 0 && reachable == endpointResults.Count,
            ExternallyReachable: false,
            AnnouncementEligible: false,
            endpointResults);
    }

    private async Task<SeedLocalEndpointProbe> ProbeEndpointAsync(
        string laneId,
        SeedFleetEndpoint endpoint,
        PeerCompanionInspection expected,
        CancellationToken cancellationToken)
    {
        var localStatusUri = BuildLocalStatusUri(endpoint);
        var checkedUtc = timeProvider.GetUtcNow();
        for (var attempt = 1; attempt <= MaximumTransientAttempts; attempt++)
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(EffectiveTimeout);
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, localStatusUri);
                using var response = await httpClient.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    timeout.Token).ConfigureAwait(false);
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return Failed("http_status_not_ok");
                }
                var declaredLength = response.Content.Headers.ContentLength;
                if (declaredLength is not long boundedLength
                    || boundedLength <= 0
                    || boundedLength > options.MaximumResponseBytes)
                {
                    return Failed("invalid_status_size");
                }
                await using var stream = await response.Content.ReadAsStreamAsync(timeout.Token)
                    .ConfigureAwait(false);
                using var memory = new MemoryStream(checked((int)boundedLength));
                var buffer = new byte[4096];
                var total = 0;
                while (true)
                {
                    var read = await stream.ReadAsync(buffer, timeout.Token).ConfigureAwait(false);
                    if (read == 0)
                    {
                        break;
                    }
                    total = checked(total + read);
                    if (total > options.MaximumResponseBytes)
                    {
                        return Failed("status_body_too_large");
                    }
                    await memory.WriteAsync(buffer.AsMemory(0, read), timeout.Token)
                        .ConfigureAwait(false);
                }
                var status = JsonSerializer.Deserialize<PeerStatusDocument>(
                    memory.ToArray(),
                    StatusJsonOptions);
                if (status is null || !Matches(status, endpoint, expected))
                {
                    return Failed("status_identity_mismatch");
                }
                return new SeedLocalEndpointProbe(
                    laneId,
                    endpoint.ModelId,
                    endpoint.PublicBaseUrl,
                    localStatusUri.AbsoluteUri,
                    checkedUtc,
                    LocallyReachable: true,
                    ExternallyReachable: false,
                    AnnouncementEligible: false,
                    ErrorCode: null);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                if (attempt == MaximumTransientAttempts)
                {
                    return Failed("local_probe_timeout");
                }
                await Task.Delay(TimeSpan.FromMilliseconds(25), cancellationToken)
                    .ConfigureAwait(false);
            }
            catch (JsonException)
            {
                return Failed("local_probe_failed");
            }
            catch (Exception error) when (error is HttpRequestException or IOException)
            {
                if (attempt == MaximumTransientAttempts)
                {
                    return Failed("local_probe_failed");
                }
                await Task.Delay(TimeSpan.FromMilliseconds(25), cancellationToken)
                    .ConfigureAwait(false);
            }
        }
        return Failed("local_probe_failed");

        SeedLocalEndpointProbe Failed(string errorCode) => new(
            laneId,
            endpoint.ModelId,
            endpoint.PublicBaseUrl,
            localStatusUri.AbsoluteUri,
            checkedUtc,
            LocallyReachable: false,
            ExternallyReachable: false,
            AnnouncementEligible: false,
            errorCode);
    }

    private static bool Matches(
        PeerStatusDocument status,
        SeedFleetEndpoint endpoint,
        PeerCompanionInspection expected) =>
        status.StatusKind == "minimodel.peer_status"
        && status.StatusVersion == 0
        && status.ShareStatus == "ready-to-serve"
        && status.TransferProtocol == "direct-http-piece-server-v0"
        && status.PeerBaseUrl == NormalizePeerBaseUrl(endpoint.PublicBaseUrl)
        && status.ModelId == endpoint.ModelId
        && status.Routes is not null
        && status.Routes.PeerStatus == StatusRoute
        && status.Routes.PeerPieceSet == "minimodel.peer_piece_set.v0"
        && status.Routes.PeerCompanionState == "minimodel.peer_companion_state.v0.json"
        && status.Manifest is not null
        && status.Manifest.Sha256 == expected.ManifestSha256
        && status.Artifact is not null
        && status.Artifact.Kind == "slm"
        && status.Artifact.ByteCount == expected.ArtifactByteCount
        && status.Artifact.Sha256 == expected.ArtifactSha256
        && status.Pieces is not null
        && status.Pieces.PieceSetPathHint == "minimodel.peer_piece_set.v0"
        && status.Pieces.PieceSetSha256 == expected.PieceSetSha256
        && status.Pieces.PieceCount == expected.PieceCount
        && status.Pieces.MerkleRootSha256 == expected.MerkleRootSha256
        && status.Boundary is not null
        && status.Boundary.MetadataOnly
        && !status.Boundary.PeerStatusEmbedsModelBytes
        && !status.Boundary.PeerStatusEmbedsPieceBytes
        && !status.Boundary.ProjectServerServesModelBytes
        && !status.Boundary.ProjectServerRunsModelBytes
        && !status.Boundary.ProjectServerProxiesModelBytes
        && status.Boundary.RequiresRustReverifyBeforeBrowserImport
        && DateTimeOffset.TryParse(
            status.CreatedUtc,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out _);

    private static string NormalizePeerBaseUrl(string value)
    {
        var normalized = new Uri(value, UriKind.Absolute).AbsoluteUri;
        return normalized.EndsWith("/", StringComparison.Ordinal)
            ? normalized
            : normalized + "/";
    }

    private static Uri BuildLocalStatusUri(SeedFleetEndpoint endpoint)
    {
        var bind = IPEndPoint.Parse(endpoint.BindAddress);
        var address = bind.Address.Equals(IPAddress.Any)
            ? IPAddress.Loopback
            : bind.Address.Equals(IPAddress.IPv6Any)
                ? IPAddress.IPv6Loopback
                : bind.Address;
        var builder = new UriBuilder(endpoint.PublicBaseUrl)
        {
            Host = address.ToString(),
            Port = bind.Port
        };
        var baseText = builder.Uri.AbsoluteUri;
        if (!baseText.EndsWith("/", StringComparison.Ordinal))
        {
            baseText += "/";
        }
        return new Uri(new Uri(baseText, UriKind.Absolute), StatusRoute);
    }

    private static void ValidateOptions(SeedFleetLocalProbeOptions options)
    {
        var timeout = options.EndpointTimeout ?? TimeSpan.FromSeconds(2);
        if (timeout < TimeSpan.FromMilliseconds(50) || timeout > TimeSpan.FromSeconds(30))
        {
            throw new SeedHostValidationException(
                "invalid_local_probe_timeout",
                "Local endpoint timeout must be between 50 milliseconds and 30 seconds.");
        }
        if (options.MaximumResponseBytes is < 1024 or > 1024 * 1024)
        {
            throw new SeedHostValidationException(
                "invalid_local_probe_budget",
                "Local status response budget must be between 1 KiB and 1 MiB.");
        }
    }

    private TimeSpan EffectiveTimeout => options.EndpointTimeout ?? TimeSpan.FromSeconds(2);

    /// <inheritdoc />
    public void Dispose()
    {
        if (!disposed)
        {
            disposed = true;
            httpClient.Dispose();
        }
    }

    private sealed record PeerStatusDocument(
        [property: JsonPropertyName("status_kind")] string StatusKind,
        [property: JsonPropertyName("status_version")] int StatusVersion,
        [property: JsonPropertyName("created_utc")] string CreatedUtc,
        [property: JsonPropertyName("share_status")] string ShareStatus,
        [property: JsonPropertyName("transfer_protocol")] string TransferProtocol,
        [property: JsonPropertyName("peer_base_url")] string PeerBaseUrl,
        [property: JsonPropertyName("model_id")] string ModelId,
        [property: JsonPropertyName("routes")] PeerStatusRoutes Routes,
        [property: JsonPropertyName("manifest")] PeerStatusManifest Manifest,
        [property: JsonPropertyName("artifact")] PeerStatusArtifact Artifact,
        [property: JsonPropertyName("pieces")] PeerStatusPieces Pieces,
        [property: JsonPropertyName("boundary")] PeerStatusBoundary Boundary);

    private sealed record PeerStatusRoutes(
        [property: JsonPropertyName("peer_status")] string PeerStatus,
        [property: JsonPropertyName("peer_piece_set")] string PeerPieceSet,
        [property: JsonPropertyName("peer_companion_state")] string PeerCompanionState);

    private sealed record PeerStatusManifest(
        [property: JsonPropertyName("sha256")] string Sha256);

    private sealed record PeerStatusArtifact(
        [property: JsonPropertyName("kind")] string Kind,
        [property: JsonPropertyName("byte_count")] long ByteCount,
        [property: JsonPropertyName("sha256")] string Sha256);

    private sealed record PeerStatusPieces(
        [property: JsonPropertyName("piece_set_path_hint")] string PieceSetPathHint,
        [property: JsonPropertyName("piece_set_sha256")] string PieceSetSha256,
        [property: JsonPropertyName("piece_count")] int PieceCount,
        [property: JsonPropertyName("merkle_root_sha256")] string MerkleRootSha256);

    private sealed record PeerStatusBoundary(
        [property: JsonPropertyName("metadata_only")] bool MetadataOnly,
        [property: JsonPropertyName("peer_status_embeds_model_bytes")] bool PeerStatusEmbedsModelBytes,
        [property: JsonPropertyName("peer_status_embeds_piece_bytes")] bool PeerStatusEmbedsPieceBytes,
        [property: JsonPropertyName("project_server_serves_model_bytes")] bool ProjectServerServesModelBytes,
        [property: JsonPropertyName("project_server_runs_model_bytes")] bool ProjectServerRunsModelBytes,
        [property: JsonPropertyName("project_server_proxies_model_bytes")] bool ProjectServerProxiesModelBytes,
        [property: JsonPropertyName("requires_rust_reverify_before_browser_import")] bool RequiresRustReverifyBeforeBrowserImport);
}
