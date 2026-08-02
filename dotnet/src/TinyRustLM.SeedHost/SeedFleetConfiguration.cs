using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace TinyRustLM.SeedHost;

/// <summary>The deterministic JSON fleet contract shared with MiniModel Rust.</summary>
public sealed record SeedFleetConfiguration(
    [property: JsonPropertyName("fleet_kind")] string FleetKind,
    [property: JsonPropertyName("fleet_id")] string FleetId,
    [property: JsonPropertyName("fleet_version")] int FleetVersion,
    [property: JsonPropertyName("target_model_count")] int TargetModelCount,
    [property: JsonPropertyName("replica_lane_count")] int ReplicaLaneCount,
    [property: JsonPropertyName("models")] IReadOnlyList<SeedFleetModel> Models,
    [property: JsonPropertyName("lanes")] IReadOnlyList<SeedFleetLane> Lanes,
    [property: JsonPropertyName("boundary")] SeedFleetBoundary Boundary)
{
    /// <summary>Current fleet kind accepted by Rust and managed clients.</summary>
    public const string RequiredFleetKind = "minimodel.seed_fleet";

    /// <summary>Current fleet schema version.</summary>
    public const int RequiredFleetVersion = 0;

    /// <summary>Maximum number of distinct admitted model artifacts.</summary>
    public const int RequiredTargetModelCount = 20;

    /// <summary>Number of independently restartable lane processes.</summary>
    public const int RequiredReplicaLaneCount = 2;

    private static readonly Regex StableIdPattern = new(
        "^[a-z0-9][a-z0-9_-]{0,63}$",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);

    private static readonly Regex ModelIdPattern = new(
        "^[a-z0-9][a-z0-9._/-]*$",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);

    private static readonly Regex Sha256Pattern = new(
        "^sha256:[0-9a-f]{64}$",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);

    private static readonly JsonSerializerOptions CanonicalJsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    /// <summary>Create and normalize a validated schema-v0 fleet configuration.</summary>
    public static SeedFleetConfiguration Create(
        string fleetId,
        IEnumerable<SeedFleetModel> models,
        IEnumerable<SeedFleetLane> lanes)
    {
        ArgumentNullException.ThrowIfNull(models);
        ArgumentNullException.ThrowIfNull(lanes);
        var normalized = new SeedFleetConfiguration(
            RequiredFleetKind,
            fleetId,
            RequiredFleetVersion,
            RequiredTargetModelCount,
            RequiredReplicaLaneCount,
            models.OrderBy(model => model.ModelId, StringComparer.Ordinal).ToArray(),
            lanes
                .OrderBy(lane => lane.LaneId, StringComparer.Ordinal)
                .Select(lane => lane with
                {
                    Endpoints = lane.Endpoints
                        .OrderBy(endpoint => endpoint.ModelId, StringComparer.Ordinal)
                        .ToArray()
                })
                .ToArray(),
            SeedFleetBoundary.Required);
        normalized.Validate();
        return normalized;
    }

    /// <summary>Parse strict schema-v0 JSON and return its canonical representation.</summary>
    public static SeedFleetConfiguration Parse(string json)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(json);
        var parsed = JsonSerializer.Deserialize<SeedFleetConfiguration>(json, CanonicalJsonOptions)
            ?? throw new SeedHostValidationException("empty_fleet_json", "Fleet JSON was empty.");
        if (!string.Equals(parsed.FleetKind, RequiredFleetKind, StringComparison.Ordinal)
            || parsed.FleetVersion != RequiredFleetVersion
            || parsed.TargetModelCount != RequiredTargetModelCount
            || parsed.ReplicaLaneCount != RequiredReplicaLaneCount
            || parsed.Boundary != SeedFleetBoundary.Required)
        {
            throw new SeedHostValidationException(
                "unsupported_fleet_contract",
                "Fleet JSON does not match the required MiniModel seed-fleet v0 boundary.");
        }
        return Create(parsed.FleetId, parsed.Models, parsed.Lanes);
    }

    /// <summary>Serialize stable, sorted schema-v0 JSON suitable for Rust validation.</summary>
    public string ToCanonicalJson()
    {
        Validate();
        return JsonSerializer.Serialize(this, CanonicalJsonOptions) + Environment.NewLine;
    }

    /// <summary>Validate managed shape and safety constraints before native verification.</summary>
    public void Validate()
    {
        if (!StableIdPattern.IsMatch(FleetId ?? string.Empty))
        {
            throw new SeedHostValidationException(
                "invalid_fleet_id",
                "FleetId must contain 1 to 64 lowercase route-safe ASCII characters.");
        }
        if (Models is null || Models.Count > RequiredTargetModelCount)
        {
            throw new SeedHostValidationException(
                "invalid_model_count",
                $"A fleet may contain zero through {RequiredTargetModelCount} admitted models.");
        }
        if (Lanes is null || Lanes.Count != RequiredReplicaLaneCount)
        {
            throw new SeedHostValidationException(
                "invalid_lane_count",
                $"A schema-v0 fleet requires exactly {RequiredReplicaLaneCount} lanes.");
        }

        var modelIds = new HashSet<string>(StringComparer.Ordinal);
        var artifactHashes = new HashSet<string>(StringComparer.Ordinal);
        foreach (var model in Models)
        {
            ValidateModel(model);
            if (!modelIds.Add(model.ModelId))
            {
                throw new SeedHostValidationException(
                    "duplicate_model_id",
                    $"Fleet contains duplicate model ID '{model.ModelId}'.");
            }
            if (model.ArtifactSha256 is not null && !artifactHashes.Add(model.ArtifactSha256))
            {
                throw new SeedHostValidationException(
                    "duplicate_artifact_identity",
                    "Distinct fleet model IDs cannot alias one artifact SHA-256.");
            }
        }

        var laneIds = new HashSet<string>(StringComparer.Ordinal);
        var bindAddresses = new HashSet<string>(StringComparer.Ordinal);
        var publicUrls = new HashSet<string>(StringComparer.Ordinal);
        foreach (var lane in Lanes)
        {
            var laneId = lane.LaneId ?? string.Empty;
            if (!StableIdPattern.IsMatch(laneId) || !laneIds.Add(laneId))
            {
                throw new SeedHostValidationException(
                    "invalid_or_duplicate_lane_id",
                    "Lane IDs must be unique lowercase route-safe ASCII values.");
            }
            if (lane.Endpoints is null || lane.Endpoints.Count != Models.Count)
            {
                throw new SeedHostValidationException(
                    "lane_model_set_mismatch",
                    $"Lane '{lane.LaneId}' must contain exactly one endpoint per admitted model.");
            }
            var endpointModels = new HashSet<string>(StringComparer.Ordinal);
            foreach (var endpoint in lane.Endpoints)
            {
                ValidateEndpoint(endpoint);
                if (!endpointModels.Add(endpoint.ModelId) || !modelIds.Contains(endpoint.ModelId))
                {
                    throw new SeedHostValidationException(
                        "lane_model_set_mismatch",
                        $"Lane '{lane.LaneId}' contains a duplicate or unknown model endpoint.");
                }
                if (!bindAddresses.Add(endpoint.BindAddress))
                {
                    throw new SeedHostValidationException(
                        "duplicate_bind_address",
                        $"Bind address '{endpoint.BindAddress}' is not unique.");
                }
                if (!publicUrls.Add(NormalizePeerUrl(endpoint.PublicBaseUrl)))
                {
                    throw new SeedHostValidationException(
                        "duplicate_public_url",
                        "Every fleet endpoint requires a unique public base URL.");
                }
            }
            if (!endpointModels.SetEquals(modelIds))
            {
                throw new SeedHostValidationException(
                    "lane_model_set_mismatch",
                    $"Lane '{lane.LaneId}' model set differs from the admitted model set.");
            }
        }
    }

    /// <summary>Validate one model's identifiers and owned relative paths.</summary>
    private static void ValidateModel(SeedFleetModel model)
    {
        ArgumentNullException.ThrowIfNull(model);
        if (!ModelIdPattern.IsMatch(model.ModelId ?? string.Empty))
        {
            throw new SeedHostValidationException(
                "invalid_model_id",
                "ModelId must be lowercase route-safe ASCII.");
        }
        ValidateOwnedRelativePath(model.ManifestPath, "manifest_path");
        ValidateOwnedRelativePath(model.PieceDirectory, "piece_dir");
        if (model.ArtifactSha256 is not null && !Sha256Pattern.IsMatch(model.ArtifactSha256))
        {
            throw new SeedHostValidationException(
                "invalid_artifact_sha256",
                "ArtifactSha256 must be a lowercase sha256-prefixed digest when supplied.");
        }
    }

    /// <summary>Validate one endpoint before the same values are reverified by Rust.</summary>
    private static void ValidateEndpoint(SeedFleetEndpoint endpoint)
    {
        ArgumentNullException.ThrowIfNull(endpoint);
        if (!ModelIdPattern.IsMatch(endpoint.ModelId ?? string.Empty))
        {
            throw new SeedHostValidationException("invalid_model_id", "Endpoint ModelId is invalid.");
        }
        ValidateOwnedRelativePath(endpoint.StatePath, "state_path");
        if (!IPEndPoint.TryParse(endpoint.BindAddress, out var bindAddress)
            || bindAddress.Port == 0)
        {
            throw new SeedHostValidationException(
                "invalid_bind_address",
                "BindAddress must be an IP socket address with a nonzero port.");
        }
        _ = NormalizePeerUrl(endpoint.PublicBaseUrl);
    }

    /// <summary>Reject absolute, empty, or parent-traversing fleet-owned path hints.</summary>
    private static void ValidateOwnedRelativePath(string path, string label)
    {
        if (string.IsNullOrWhiteSpace(path)
            || Path.IsPathRooted(path)
            || path.Split(['/', '\\'], StringSplitOptions.RemoveEmptyEntries)
                .Any(segment => segment is "." or ".."))
        {
            throw new SeedHostValidationException(
                "unsafe_owned_path",
                $"{label} must be a relative path inside the fleet root.");
        }
    }

    /// <summary>Normalize a credential-free direct HTTP peer URL for duplicate checks.</summary>
    private static string NormalizePeerUrl(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || !string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.Ordinal)
            || string.IsNullOrEmpty(uri.Host)
            || !string.IsNullOrEmpty(uri.UserInfo)
            || !string.IsNullOrEmpty(uri.Query)
            || !string.IsNullOrEmpty(uri.Fragment))
        {
            throw new SeedHostValidationException(
                "unsafe_peer_url",
                "PublicBaseUrl must be a credential-free direct HTTP URL without query or fragment.");
        }
        var host = uri.IdnHost.TrimEnd('.').ToLowerInvariant();
        var forbidden = new[]
        {
            "minimodel.org",
            "tinyrustlm.com",
            "slmcomposer.com",
            "lmcomposer.com",
            "mirust.com",
            "huggingface.co"
        };
        if (forbidden.Any(domain =>
            string.Equals(host, domain, StringComparison.Ordinal)
            || host.EndsWith($".{domain}", StringComparison.Ordinal)))
        {
            throw new SeedHostValidationException(
                "project_host_not_peer",
                "Project and Hugging Face hosts cannot be model-byte peer endpoints.");
        }
        var builder = new UriBuilder(uri) { Host = host, Query = string.Empty, Fragment = string.Empty };
        var normalized = builder.Uri.AbsoluteUri;
        return normalized.EndsWith("/", StringComparison.Ordinal) ? normalized : normalized + "/";
    }
}
