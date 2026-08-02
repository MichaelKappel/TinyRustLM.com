using System.Globalization;

namespace TinyRustLM.SeedHost;

/// <summary>Explicit paths required to prepare one proof-gated peer announcement.</summary>
public sealed record SeedAnnouncementPreparationOptions(
    string CatalogEntryPath,
    string OutputPath,
    string ReceiptPath,
    string TrustPath,
    string ConfigurationPath);

/// <summary>Orchestrates Rust verification and one-use announcement preparation.</summary>
public sealed class SeedAnnouncementService
{
    private const string UtcTimestampFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'";
    private readonly IMiniModelAuthority authority;
    private readonly TimeProvider timeProvider;

    /// <summary>Create a proof-gated announcement service.</summary>
    public SeedAnnouncementService(
        IMiniModelAuthority authority,
        TimeProvider? timeProvider = null)
    {
        this.authority = authority ?? throw new ArgumentNullException(nameof(authority));
        this.timeProvider = timeProvider ?? TimeProvider.System;
    }

    /// <summary>
    /// Validate current external evidence through Rust, then consume it exactly once while
    /// preparing metadata. This method does not publish the resulting announcement.
    /// </summary>
    public SeedPeerSourceAnnouncementPreparation Prepare(
        SeedAnnouncementPreparationOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var inspection = authority.InspectExternalProbeReceipt(
            options.ReceiptPath,
            options.TrustPath,
            options.ConfigurationPath);
        ValidateCurrentInspection(inspection);
        var prepared = authority.PrepareSeedAnnouncement(
            options.CatalogEntryPath,
            options.OutputPath,
            options.ReceiptPath,
            options.TrustPath,
            options.ConfigurationPath);
        ValidateNativeResult(inspection, prepared);
        return prepared;
    }

    private void ValidateCurrentInspection(ExternalProbeReceiptInspection inspection)
    {
        if (!inspection.ExternallyReachable || !inspection.AnnouncementEligible)
        {
            throw new SeedHostValidationException(
                "external_probe_ineligible",
                "External reachability evidence is not announcement eligible.");
        }
        if (inspection.ProjectServerServesModelBytes
            || inspection.ProjectServerRunsModelBytes
            || inspection.ProjectServerProxiesModelBytes)
        {
            throw new SeedHostValidationException(
                "external_probe_boundary_violation",
                "External reachability evidence violates the project model-byte boundary.");
        }
        if (!DateTimeOffset.TryParseExact(
                inspection.ExpiresUtc,
                UtcTimestampFormat,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out var expiresUtc))
        {
            throw new SeedHostValidationException(
                "external_probe_timestamp_invalid",
                "External reachability evidence has an invalid expiry timestamp.");
        }
        if (expiresUtc <= timeProvider.GetUtcNow())
        {
            throw new SeedHostValidationException(
                "external_probe_expired",
                "External reachability evidence has expired; request a new outside-network probe.");
        }
    }

    private static void ValidateNativeResult(
        ExternalProbeReceiptInspection inspection,
        SeedPeerSourceAnnouncementPreparation prepared)
    {
        var identityMatches = prepared.ExternalProbeReceiptId == inspection.ReceiptId
            && prepared.ExternalProbeReceiptSha256 == inspection.ReceiptSha256
            && prepared.FleetId == inspection.FleetId
            && prepared.LaneId == inspection.LaneId
            && prepared.ModelId == inspection.ModelId
            && prepared.PeerBaseUrl == inspection.PublicBaseUrl
            && prepared.ArtifactSha256 == inspection.ArtifactSha256
            && prepared.PieceSetSha256 == inspection.PieceSetSha256;
        if (!identityMatches
            || !prepared.ExternallyReachable
            || !prepared.AnnouncementEligible
            || prepared.Advertised
            || prepared.ProjectServerServesModelBytes
            || prepared.ProjectServerRunsModelBytes
            || prepared.ProjectServerProxiesModelBytes)
        {
            throw new SeedHostException(
                "native_contract_mismatch",
                "MiniModel returned announcement metadata that did not match verified external evidence.");
        }
    }
}
