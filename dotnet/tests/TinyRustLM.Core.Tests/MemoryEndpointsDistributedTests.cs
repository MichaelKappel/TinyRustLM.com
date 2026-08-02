using Xunit;

namespace TinyRustLM.Tests;

public sealed class MemoryEndpointsDistributedTests
{
    [Fact]
    public void ConcurrentEditsConflictAndTombstoneBlocksResurrection()
    {
        var root = Head();
        var first = Mutation("revision-device-a", "revision-root", 'b', "device-a");
        var accepted = MemoryEndpointsDistributedContract.DecideRevisionMutation(
            root, first, Authority("device-a"), 2, hardForgetSupported: false);
        Assert.Equal(MemoryEndpointsRevisionDecisionKind.Accepted, accepted.Kind);
        Assert.Equal("revision-root", accepted.CurrentRevisionId);
        var acceptedHead = Assert.IsType<MemoryEndpointsRevisionHead>(accepted.NextHead);

        var second = Mutation("revision-device-b", "revision-root", 'c', "device-b");
        var conflict = MemoryEndpointsDistributedContract.DecideRevisionMutation(
            acceptedHead, second, Authority("device-b"), 3, hardForgetSupported: false);
        Assert.Equal(MemoryEndpointsRevisionDecisionKind.Conflict, conflict.Kind);
        Assert.Equal("revision-device-a", conflict.CurrentRevisionId);
        Assert.Equal("conflict-8d88fc6fe4351701352a6668", conflict.ConflictId);
        Assert.Null(conflict.NextHead);

        var tombstone = Mutation("revision-tombstone", "revision-device-a", 'd', "device-a") with
        {
            Operation = MemoryEndpointsRevisionOperation.Tombstone,
            EraseMode = MemoryEndpointsEraseMode.SoftDelete,
            RetentionUntilUnixMs = 1_900_000_000_000
        };
        var deleted = MemoryEndpointsDistributedContract.DecideRevisionMutation(
            acceptedHead, tombstone, Authority("device-a"), 3, hardForgetSupported: false);
        var tombstoneHead = Assert.IsType<MemoryEndpointsRevisionHead>(deleted.NextHead);
        Assert.Equal(MemoryEndpointsRevisionState.Tombstone, tombstoneHead.State);

        var stale = Mutation("revision-stale", "revision-device-a", 'e', "device-b");
        var blocked = MemoryEndpointsDistributedContract.DecideRevisionMutation(
            tombstoneHead, stale, Authority("device-b"), 4, hardForgetSupported: false);
        Assert.Equal(MemoryEndpointsRevisionDecisionKind.BlockedByTombstone, blocked.Kind);
        Assert.Null(blocked.NextHead);
    }

    [Fact]
    public void RevocationCheckpointFreshnessAndCompactionFailClosed()
    {
        var candidate = Mutation("revision-old-device", "revision-root", 'b', "device-a");
        var revoked = Authority("device-a") with { Revoked = true };
        Assert.Equal(
            MemoryEndpointsRevisionDecisionKind.BlockedByRevocation,
            MemoryEndpointsDistributedContract.DecideRevisionMutation(
                Head(), candidate, revoked, 2, hardForgetSupported: false).Kind);

        var checkpoint = new MemoryEndpointsSyncCheckpoint(
            MemoryEndpointsDistributedContract.SyncCheckpointKind,
            1,
            "workspace-demo",
            1_720_000_000_000,
            100,
            1_719_999_999_000,
            "mem-100",
            10_000,
            true);
        var next = checkpoint with
        {
            PulledAtUnixMs = checkpoint.PulledAtUnixMs + 1,
            MaxServerSequence = 101,
            MaxEventId = "mem-101"
        };
        MemoryEndpointsDistributedContract.ValidateCheckpointAdvance(checkpoint, next);
        Assert.Throws<InvalidOperationException>(() =>
            MemoryEndpointsDistributedContract.ValidateCheckpointAdvance(
                next, next with { MaxServerSequence = 99 }));

        var freshness = MemoryEndpointsDistributedContract.ReportSearchFreshness(105, 101);
        Assert.Equal(MemoryEndpointsSearchFreshness.Stale, freshness.Freshness);
        Assert.Equal((ulong)4, freshness.SequenceLag);

        var records = new[]
        {
            Retention("head", MemoryEndpointsRetentionKind.LiveHead, current: true),
            Retention("old", MemoryEndpointsRetentionKind.Revision),
            Retention("conflict", MemoryEndpointsRetentionKind.Conflict, unresolved: true),
            Retention("receipt", MemoryEndpointsRetentionKind.AuthoritativeReceipt),
            Retention("search", MemoryEndpointsRetentionKind.SearchProjection)
        };
        var plan = MemoryEndpointsDistributedContract.PlanCompaction(records, 1_700_000_000_000);
        Assert.Contains("head", plan.RetainedIds);
        Assert.Contains("conflict", plan.RetainedIds);
        Assert.Contains("receipt", plan.RetainedIds);
        Assert.Contains("old", plan.CompactedIds);
        Assert.Contains("search", plan.CompactedIds);
    }

    private static MemoryEndpointsRevisionHead Head() => new(
        MemoryEndpointsDistributedContract.RevisionHeadKind,
        1,
        "memory-demo",
        "revision-root",
        null,
        new string('a', 64),
        new string('a', 64),
        MemoryEndpointsRevisionState.Active,
        1,
        "device-a",
        1,
        null);

    private static MemoryEndpointsRevisionMutation Mutation(
        string revisionId,
        string? parentRevisionId,
        char body,
        string deviceId) => new(
            MemoryEndpointsDistributedContract.RevisionMutationKind,
            1,
            "memory-demo",
            revisionId,
            parentRevisionId,
            new string(body, 64),
            new string(body, 64),
            deviceId,
            1,
            1,
            2,
            MemoryEndpointsRevisionOperation.Upsert,
            MemoryEndpointsEraseMode.NotApplicable,
            null);

    private static MemoryEndpointsDeviceAuthority Authority(string deviceId) =>
        new(deviceId, 1, false);

    private static MemoryEndpointsRetentionRecord Retention(
        string id,
        MemoryEndpointsRetentionKind kind,
        bool current = false,
        bool unresolved = false) =>
        new(id, "memory-demo", kind, current, unresolved, null);
}
