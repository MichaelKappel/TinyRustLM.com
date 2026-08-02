using System.Security.Cryptography;
using System.Text;

namespace TinyRustLM;

/// <summary>Operation represented by one immutable revision mutation.</summary>
public enum MemoryEndpointsRevisionOperation
{
    /// <summary>Create or update active memory.</summary>
    Upsert,
    /// <summary>Create an authoritative deletion tombstone.</summary>
    Tombstone
}

/// <summary>Requested erasure behavior.</summary>
public enum MemoryEndpointsEraseMode
{
    /// <summary>The mutation is not a deletion.</summary>
    NotApplicable,
    /// <summary>Retain a tombstone for conflict prevention and audit.</summary>
    SoftDelete,
    /// <summary>Request irreversible erasure only when explicitly supported.</summary>
    HardForgetRequested
}

/// <summary>Authoritative revision-head state.</summary>
public enum MemoryEndpointsRevisionState
{
    /// <summary>Active retrievable memory.</summary>
    Active,
    /// <summary>Deletion tombstone that cannot be implicitly resurrected.</summary>
    Tombstone
}

/// <summary>Immutable candidate revision from one device epoch.</summary>
public sealed record MemoryEndpointsRevisionMutation(
    string Kind,
    uint Version,
    string MemoryId,
    string RevisionId,
    string? ParentRevisionId,
    string BodySha256,
    string NormalizedBodySha256,
    string DeviceId,
    ulong DeviceEpoch,
    ulong DeviceSequence,
    ulong LamportTime,
    MemoryEndpointsRevisionOperation Operation,
    MemoryEndpointsEraseMode EraseMode,
    long? RetentionUntilUnixMs);

/// <summary>Current authoritative head of one logical memory.</summary>
public sealed record MemoryEndpointsRevisionHead(
    string Kind,
    uint Version,
    string MemoryId,
    string RevisionId,
    string? ParentRevisionId,
    string BodySha256,
    string NormalizedBodySha256,
    MemoryEndpointsRevisionState State,
    ulong ServerSequence,
    string AcceptedDeviceId,
    ulong AcceptedDeviceEpoch,
    long? TombstoneRetentionUntilUnixMs);

/// <summary>Current authority state for a registered device.</summary>
public sealed record MemoryEndpointsDeviceAuthority(
    string DeviceId,
    ulong CurrentEpoch,
    bool Revoked);

/// <summary>Deterministic externally visible revision decision.</summary>
public enum MemoryEndpointsRevisionDecisionKind
{
    /// <summary>Candidate became authoritative.</summary>
    Accepted,
    /// <summary>Candidate was semantically identical to the current head.</summary>
    Deduplicated,
    /// <summary>Candidate diverged and requires explicit resolution.</summary>
    Conflict,
    /// <summary>Candidate attempted implicit tombstone resurrection.</summary>
    BlockedByTombstone,
    /// <summary>Candidate used revoked or stale device authority.</summary>
    BlockedByRevocation,
    /// <summary>Hard forget lacks an explicit supported contract.</summary>
    UnsupportedHardForget
}

/// <summary>Revision decision and optional replacement head.</summary>
public sealed record MemoryEndpointsRevisionDecision(
    MemoryEndpointsRevisionDecisionKind Kind,
    string MemoryId,
    string CandidateRevisionId,
    string? CurrentRevisionId,
    string? ConflictId,
    string ReasonCode,
    MemoryEndpointsRevisionHead? NextHead);

/// <summary>Monotonic checkpoint for a hosted-memory pull.</summary>
public sealed record MemoryEndpointsSyncCheckpoint(
    string Kind,
    uint Version,
    string WorkspaceId,
    long PulledAtUnixMs,
    ulong? MaxServerSequence,
    long MaxCreatedAtUnixMs,
    string MaxEventId,
    ulong RecordCount,
    bool CompleteSnapshot);

/// <summary>Search-index freshness relative to accepted hosted state.</summary>
public enum MemoryEndpointsSearchFreshness
{
    /// <summary>The latest accepted sequence is indexed.</summary>
    Current,
    /// <summary>The search projection trails accepted state.</summary>
    Stale,
    /// <summary>Sequence information is unavailable.</summary>
    Unknown
}

/// <summary>Public-safe search-index freshness report.</summary>
public sealed record MemoryEndpointsStaleIndexReport(
    MemoryEndpointsSearchFreshness Freshness,
    ulong? AcceptedServerSequence,
    ulong? IndexedServerSequence,
    ulong? SequenceLag);

/// <summary>Record category considered by conservative compaction.</summary>
public enum MemoryEndpointsRetentionKind
{
    /// <summary>Current live head.</summary>
    LiveHead,
    /// <summary>Historical revision.</summary>
    Revision,
    /// <summary>Explicit conflict.</summary>
    Conflict,
    /// <summary>Deletion tombstone.</summary>
    Tombstone,
    /// <summary>Authoritative hosted receipt.</summary>
    AuthoritativeReceipt,
    /// <summary>Rebuildable search projection.</summary>
    SearchProjection
}

/// <summary>Public-safe compaction input.</summary>
public sealed record MemoryEndpointsRetentionRecord(
    string RecordId,
    string MemoryId,
    MemoryEndpointsRetentionKind Kind,
    bool IsCurrentHead,
    bool Unresolved,
    long? RetentionUntilUnixMs);

/// <summary>Deterministic conservative compaction plan.</summary>
public sealed record MemoryEndpointsCompactionPlan(
    IReadOnlyList<string> RetainedIds,
    IReadOnlyList<string> CompactedIds);

/// <summary>Deterministic distributed-memory contracts mirrored from the Rust authority.</summary>
public static class MemoryEndpointsDistributedContract
{
    /// <summary>Stable revision mutation kind.</summary>
    public const string RevisionMutationKind = "tinyrustlm.memory_endpoints.revision_mutation.v1";
    /// <summary>Stable revision head kind.</summary>
    public const string RevisionHeadKind = "tinyrustlm.memory_endpoints.revision_head.v1";
    /// <summary>Stable synchronization checkpoint kind.</summary>
    public const string SyncCheckpointKind = "tinyrustlm.memory_endpoints.sync_checkpoint.v1";

    /// <summary>Decides one mutation without last-write-wins behavior.</summary>
    public static MemoryEndpointsRevisionDecision DecideRevisionMutation(
        MemoryEndpointsRevisionHead? current,
        MemoryEndpointsRevisionMutation mutation,
        MemoryEndpointsDeviceAuthority authority,
        ulong nextServerSequence,
        bool hardForgetSupported)
    {
        ArgumentNullException.ThrowIfNull(mutation);
        ArgumentNullException.ThrowIfNull(authority);
        ValidateMutation(mutation);
        ValidateAuthority(authority);
        if (current is not null)
        {
            ValidateHead(current);
            if (current.MemoryId != mutation.MemoryId)
            {
                throw new InvalidOperationException("Revision head and mutation memory IDs differ.");
            }
            if (nextServerSequence <= current.ServerSequence)
            {
                throw new InvalidOperationException("Next server sequence must advance the current head.");
            }
        }
        else if (nextServerSequence == 0)
        {
            throw new InvalidOperationException("Next server sequence must be positive.");
        }

        if (authority.DeviceId != mutation.DeviceId || authority.Revoked ||
            authority.CurrentEpoch != mutation.DeviceEpoch)
        {
            return Decision(current, mutation, MemoryEndpointsRevisionDecisionKind.BlockedByRevocation,
                "device_revoked_or_epoch_mismatch");
        }
        if (mutation.EraseMode == MemoryEndpointsEraseMode.HardForgetRequested && !hardForgetSupported)
        {
            return Decision(current, mutation, MemoryEndpointsRevisionDecisionKind.UnsupportedHardForget,
                "hard_forget_capability_unavailable");
        }
        if (current is null)
        {
            return mutation.ParentRevisionId is null
                ? Accepted(current, mutation, nextServerSequence)
                : Conflict(current, mutation, "parent_revision_missing");
        }
        if (mutation.RevisionId == current.RevisionId)
        {
            if (mutation.BodySha256 == current.BodySha256 &&
                mutation.NormalizedBodySha256 == current.NormalizedBodySha256 &&
                StateFor(mutation.Operation) == current.State)
            {
                return Decision(current, mutation, MemoryEndpointsRevisionDecisionKind.Deduplicated,
                    "revision_already_accepted");
            }
            return Conflict(current, mutation, "revision_id_reused_with_changed_body");
        }
        if (current.State == MemoryEndpointsRevisionState.Tombstone)
        {
            if (mutation.Operation == MemoryEndpointsRevisionOperation.Tombstone &&
                mutation.NormalizedBodySha256 == current.NormalizedBodySha256)
            {
                return Decision(current, mutation, MemoryEndpointsRevisionDecisionKind.Deduplicated,
                    "tombstone_already_current");
            }
            return Decision(current, mutation, MemoryEndpointsRevisionDecisionKind.BlockedByTombstone,
                "stale_edit_cannot_resurrect_tombstone");
        }
        if (mutation.NormalizedBodySha256 == current.NormalizedBodySha256)
        {
            return Decision(current, mutation, MemoryEndpointsRevisionDecisionKind.Deduplicated,
                "normalized_body_already_current");
        }
        if (mutation.ParentRevisionId != current.RevisionId)
        {
            return Conflict(current, mutation, "stale_parent_diverged");
        }
        return Accepted(current, mutation, nextServerSequence);
    }

    /// <summary>Rejects backward checkpoint movement.</summary>
    public static void ValidateCheckpointAdvance(
        MemoryEndpointsSyncCheckpoint? previous,
        MemoryEndpointsSyncCheckpoint candidate)
    {
        ArgumentNullException.ThrowIfNull(candidate);
        ValidateCheckpoint(candidate);
        if (previous is null)
        {
            return;
        }
        ValidateCheckpoint(previous);
        if (previous.WorkspaceId != candidate.WorkspaceId)
        {
            throw new InvalidOperationException("Checkpoint workspace changed.");
        }
        if (candidate.PulledAtUnixMs < previous.PulledAtUnixMs)
        {
            throw new InvalidOperationException("Checkpoint pull time moved backwards.");
        }
        if (previous.MaxServerSequence.HasValue && !candidate.MaxServerSequence.HasValue ||
            previous.MaxServerSequence.HasValue && candidate.MaxServerSequence < previous.MaxServerSequence)
        {
            throw new InvalidOperationException("Checkpoint server sequence moved backwards.");
        }
        if (!previous.MaxServerSequence.HasValue && !candidate.MaxServerSequence.HasValue &&
            (candidate.MaxCreatedAtUnixMs < previous.MaxCreatedAtUnixMs ||
             candidate.MaxCreatedAtUnixMs == previous.MaxCreatedAtUnixMs &&
             string.CompareOrdinal(candidate.MaxEventId, previous.MaxEventId) < 0))
        {
            throw new InvalidOperationException("Checkpoint event watermark moved backwards.");
        }
    }

    /// <summary>Reports whether search trails accepted hosted state.</summary>
    public static MemoryEndpointsStaleIndexReport ReportSearchFreshness(
        ulong? acceptedServerSequence,
        ulong? indexedServerSequence)
    {
        if (!acceptedServerSequence.HasValue || !indexedServerSequence.HasValue)
        {
            return new(MemoryEndpointsSearchFreshness.Unknown,
                acceptedServerSequence, indexedServerSequence, null);
        }
        if (acceptedServerSequence == 0 || indexedServerSequence == 0 ||
            indexedServerSequence > acceptedServerSequence)
        {
            throw new InvalidOperationException("Search freshness sequences are invalid.");
        }
        var lag = acceptedServerSequence.Value - indexedServerSequence.Value;
        return new(
            lag == 0 ? MemoryEndpointsSearchFreshness.Current : MemoryEndpointsSearchFreshness.Stale,
            acceptedServerSequence,
            indexedServerSequence,
            lag);
    }

    /// <summary>Plans conservative compaction without dropping authority evidence.</summary>
    public static MemoryEndpointsCompactionPlan PlanCompaction(
        IReadOnlyList<MemoryEndpointsRetentionRecord> records,
        long nowUnixMs)
    {
        ArgumentNullException.ThrowIfNull(records);
        if (nowUnixMs <= 0)
        {
            throw new InvalidOperationException("Compaction time must be positive.");
        }
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var retained = new List<string>();
        var compacted = new List<string>();
        foreach (var record in records)
        {
            MemoryEndpointsSyncContract.ValidateIdentifier("record ID", record.RecordId, 128);
            MemoryEndpointsSyncContract.ValidateIdentifier("memory ID", record.MemoryId, 128);
            if (!seen.Add(record.RecordId))
            {
                throw new InvalidOperationException("Compaction input contains duplicate record IDs.");
            }
            var retain = record.IsCurrentHead ||
                record.Kind is MemoryEndpointsRetentionKind.LiveHead or
                    MemoryEndpointsRetentionKind.AuthoritativeReceipt ||
                record.Kind == MemoryEndpointsRetentionKind.Conflict && record.Unresolved ||
                record.Kind == MemoryEndpointsRetentionKind.Tombstone &&
                    (!record.RetentionUntilUnixMs.HasValue || record.RetentionUntilUnixMs >= nowUnixMs);
            (retain ? retained : compacted).Add(record.RecordId);
        }
        retained.Sort(StringComparer.Ordinal);
        compacted.Sort(StringComparer.Ordinal);
        return new(retained, compacted);
    }

    private static MemoryEndpointsRevisionDecision Accepted(
        MemoryEndpointsRevisionHead? current,
        MemoryEndpointsRevisionMutation mutation,
        ulong serverSequence)
    {
        var head = new MemoryEndpointsRevisionHead(
            RevisionHeadKind,
            1,
            mutation.MemoryId,
            mutation.RevisionId,
            mutation.ParentRevisionId,
            mutation.BodySha256,
            mutation.NormalizedBodySha256,
            StateFor(mutation.Operation),
            serverSequence,
            mutation.DeviceId,
            mutation.DeviceEpoch,
            mutation.RetentionUntilUnixMs);
        return Decision(current, mutation, MemoryEndpointsRevisionDecisionKind.Accepted,
            "accepted_exact_parent", nextHead: head);
    }

    private static MemoryEndpointsRevisionDecision Conflict(
        MemoryEndpointsRevisionHead? current,
        MemoryEndpointsRevisionMutation mutation,
        string reason)
    {
        var material = $"{mutation.MemoryId}\n{current?.RevisionId ?? "missing"}\n{mutation.RevisionId}\n{mutation.NormalizedBodySha256}";
        var digest = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(material))).ToLowerInvariant();
        return Decision(current, mutation, MemoryEndpointsRevisionDecisionKind.Conflict,
            reason, $"conflict-{digest[..24]}");
    }

    private static MemoryEndpointsRevisionDecision Decision(
        MemoryEndpointsRevisionHead? current,
        MemoryEndpointsRevisionMutation mutation,
        MemoryEndpointsRevisionDecisionKind kind,
        string reason,
        string? conflictId = null,
        MemoryEndpointsRevisionHead? nextHead = null) =>
        new(kind, mutation.MemoryId, mutation.RevisionId, current?.RevisionId,
            conflictId, reason, nextHead);

    private static MemoryEndpointsRevisionState StateFor(MemoryEndpointsRevisionOperation operation) =>
        operation == MemoryEndpointsRevisionOperation.Tombstone
            ? MemoryEndpointsRevisionState.Tombstone
            : MemoryEndpointsRevisionState.Active;

    private static void ValidateMutation(MemoryEndpointsRevisionMutation mutation)
    {
        if (mutation.Kind != RevisionMutationKind || mutation.Version != 1)
        {
            throw new InvalidOperationException("Unsupported revision mutation kind or version.");
        }
        MemoryEndpointsSyncContract.ValidateIdentifier("memory ID", mutation.MemoryId, 128);
        MemoryEndpointsSyncContract.ValidateIdentifier("revision ID", mutation.RevisionId, 128);
        ValidateOptionalIdentifier("parent revision ID", mutation.ParentRevisionId);
        ValidateSha256(mutation.BodySha256);
        ValidateSha256(mutation.NormalizedBodySha256);
        MemoryEndpointsSyncContract.ValidateIdentifier("device ID", mutation.DeviceId, 128);
        if (mutation.DeviceEpoch == 0 || mutation.DeviceSequence == 0 || mutation.LamportTime == 0)
        {
            throw new InvalidOperationException("Device epoch, sequence, and Lamport time must be positive.");
        }
        if (mutation.Operation == MemoryEndpointsRevisionOperation.Upsert &&
            (mutation.EraseMode != MemoryEndpointsEraseMode.NotApplicable || mutation.RetentionUntilUnixMs.HasValue))
        {
            throw new InvalidOperationException("Upsert cannot contain deletion metadata.");
        }
        if (mutation.Operation == MemoryEndpointsRevisionOperation.Tombstone &&
            (mutation.EraseMode == MemoryEndpointsEraseMode.NotApplicable || mutation.RetentionUntilUnixMs is null or <= 0))
        {
            throw new InvalidOperationException("Tombstone requires erase mode and retention.");
        }
    }

    private static void ValidateHead(MemoryEndpointsRevisionHead head)
    {
        if (head.Kind != RevisionHeadKind || head.Version != 1 || head.ServerSequence == 0 ||
            head.AcceptedDeviceEpoch == 0)
        {
            throw new InvalidOperationException("Revision head kind, version, or sequence is invalid.");
        }
        MemoryEndpointsSyncContract.ValidateIdentifier("memory ID", head.MemoryId, 128);
        MemoryEndpointsSyncContract.ValidateIdentifier("revision ID", head.RevisionId, 128);
        ValidateOptionalIdentifier("parent revision ID", head.ParentRevisionId);
        ValidateSha256(head.BodySha256);
        ValidateSha256(head.NormalizedBodySha256);
        MemoryEndpointsSyncContract.ValidateIdentifier("accepted device ID", head.AcceptedDeviceId, 128);
        if ((head.State == MemoryEndpointsRevisionState.Tombstone) != head.TombstoneRetentionUntilUnixMs.HasValue)
        {
            throw new InvalidOperationException("Revision-head tombstone retention is inconsistent.");
        }
    }

    private static void ValidateAuthority(MemoryEndpointsDeviceAuthority authority)
    {
        MemoryEndpointsSyncContract.ValidateIdentifier("authority device ID", authority.DeviceId, 128);
        if (authority.CurrentEpoch == 0)
        {
            throw new InvalidOperationException("Device authority epoch must be positive.");
        }
    }

    private static void ValidateCheckpoint(MemoryEndpointsSyncCheckpoint checkpoint)
    {
        if (checkpoint.Kind != SyncCheckpointKind || checkpoint.Version != 1 ||
            checkpoint.PulledAtUnixMs <= 0 || !checkpoint.CompleteSnapshot ||
            checkpoint.MaxServerSequence == 0 ||
            (checkpoint.MaxCreatedAtUnixMs == 0) != string.IsNullOrEmpty(checkpoint.MaxEventId))
        {
            throw new InvalidOperationException("MemoryEndpoints checkpoint is invalid.");
        }
        MemoryEndpointsSyncContract.ValidateIdentifier("checkpoint workspace ID", checkpoint.WorkspaceId, 128);
        if (checkpoint.MaxEventId.Length > 0)
        {
            MemoryEndpointsSyncContract.ValidateIdentifier("checkpoint event ID", checkpoint.MaxEventId, 128);
        }
    }

    private static void ValidateOptionalIdentifier(string label, string? value)
    {
        if (value is not null)
        {
            MemoryEndpointsSyncContract.ValidateIdentifier(label, value, 128);
        }
    }

    private static void ValidateSha256(string value)
    {
        if (value.Length != 64 || value.Any(ch => ch is not (>= '0' and <= '9') and not (>= 'a' and <= 'f')))
        {
            throw new InvalidOperationException("SHA-256 must be 64 lowercase hex characters.");
        }
    }
}
