using System.Text.Json;
using Xunit;

namespace TinyRustLM.Tests;

public sealed class MemoryEndpointsSyncTests
{
    [Fact]
    public void EqualLogicalPayloadsShareTheRustFingerprintVector()
    {
        var first = MemoryEndpointsSyncContract.PrepareOutboxEntry(
            Record(),
            "workspace-demo",
            "tinyrustlm-agent",
            "event-0123456789abcdef",
            "device-browser-a",
            1_720_000_000_000);
        var reordered = Record() with
        {
            UaiReferences = Record().UaiReferences!.Reverse().ToArray(),
            Tags = Record().Tags!.Reverse().ToArray()
        };
        var second = MemoryEndpointsSyncContract.PrepareOutboxEntry(
            reordered,
            "workspace-demo",
            "tinyrustlm-agent",
            "event-0123456789abcdef",
            "device-browser-a",
            1_720_000_000_000);

        Assert.Equal(first.PayloadSha256, second.PayloadSha256);
        Assert.Equal(
            "ffa9fb1d3b729902d8a62621ce08d627b7042aaad89f5d8ca51a6257f3e305aa",
            first.PayloadSha256);
        Assert.Equal(first.IdempotencyKey, second.IdempotencyKey);
        Assert.StartsWith("tinyrustlm-memory-v2-", first.IdempotencyKey, StringComparison.Ordinal);
        Assert.Equal(2U, first.Version);
        Assert.Equal(2U, first.LocalReceipt.Version);
        Assert.Equal(MemoryEndpointsOutboxState.SavedLocally, first.State);
        Assert.Equal(first.EventId, first.LocalReceipt.EventId);
        Assert.Equal(first.PayloadSha256, first.LocalReceipt.PayloadSha256);
    }

    [Fact]
    public void RetryPreservesIdentityAndSynchronizationRequiresMatchingReceipt()
    {
        var entry = MemoryEndpointsSyncContract.PrepareOutboxEntry(
            Record(),
            "workspace-demo",
            "tinyrustlm-agent",
            "event-0123456789abcdef",
            "device-browser-a",
            1_720_000_000_000);
        var originalKey = entry.IdempotencyKey;

        entry = entry.MarkQueued(1_720_000_000_010)
            .BeginSend(1_720_000_000_020)
            .ScheduleRetry("network_timeout", 1_720_000_001_000, 1_720_000_000_030);

        Assert.Equal(MemoryEndpointsOutboxState.RetryPending, entry.State);
        Assert.Equal(originalKey, entry.IdempotencyKey);
        Assert.False(entry.IsSendable(1_720_000_000_999));
        Assert.True(entry.IsSendable(1_720_000_001_000));

        var mismatched = Receipt(entry) with { PayloadSha256 = new string('0', 64) };
        Assert.Throws<InvalidOperationException>(() =>
            entry.ApplyAuthoritativeReceipt(mismatched, 1_720_000_001_100));

        entry = entry.ApplyAuthoritativeReceipt(Receipt(entry), 1_720_000_001_100);

        Assert.Equal(MemoryEndpointsOutboxState.Synchronized, entry.State);
        Assert.Equal(originalKey, entry.IdempotencyKey);
        Assert.NotNull(entry.AuthoritativeReceipt);
        Assert.False(entry.IsSendable(long.MaxValue));
    }

    [Fact]
    public void PersistedRowsRejectCredentialsAndPayloadMutation()
    {
        var entry = MemoryEndpointsSyncContract.PrepareOutboxEntry(
            Record(),
            "workspace-demo",
            "tinyrustlm-agent",
            "event-0123456789abcdef",
            "device-browser-a",
            1_720_000_000_000);
        var json = MemoryEndpointsSyncContract.SerializeOutboxEntry(entry);

        Assert.DoesNotContain("bearerToken", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("authorization", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("workspaceKey", json, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"actorAgentId\"", json, StringComparison.Ordinal);
        Assert.Contains("\"summary\"", json, StringComparison.Ordinal);
        Assert.DoesNotContain("\"agentId\"", json, StringComparison.Ordinal);
        Assert.DoesNotContain("\"safeSummary\"", json, StringComparison.Ordinal);
        Assert.Equal(entry, MemoryEndpointsSyncContract.DeserializeOutboxEntry(json));

        using var document = JsonDocument.Parse(json);
        var properties = document.RootElement.EnumerateObject()
            .Select(property => $"\"{property.Name}\":{property.Value.GetRawText()}")
            .Append("\"workspaceKey\":\"must-not-persist\"");
        var withCredential = $"{{{string.Join(',', properties)}}}";
        Assert.Throws<JsonException>(() => MemoryEndpointsSyncContract.DeserializeOutboxEntry(withCredential));

        var withRetiredAgentAlias = json.Replace(
            "\"actorAgentId\":\"tinyrustlm-agent\",",
            "\"actorAgentId\":\"tinyrustlm-agent\",\"agentId\":\"tinyrustlm-agent\",",
            StringComparison.Ordinal);
        Assert.Throws<JsonException>(() =>
            MemoryEndpointsSyncContract.DeserializeOutboxEntry(withRetiredAgentAlias));

        var withRetiredSummaryAlias = json.Replace(
            "\"summary\":\"Public-safe durable memory for the offline synchronization contract.\",",
            "\"summary\":\"Public-safe durable memory for the offline synchronization contract.\",\"safeSummary\":\"Public-safe durable memory for the offline synchronization contract.\",",
            StringComparison.Ordinal);
        Assert.Throws<JsonException>(() =>
            MemoryEndpointsSyncContract.DeserializeOutboxEntry(withRetiredSummaryAlias));

        var mutated = entry with
        {
            Payload = entry.Payload with { Summary = $"{entry.Payload.Summary} changed" }
        };
        Assert.Throws<InvalidOperationException>(() =>
            MemoryEndpointsSyncContract.ValidateOutboxEntry(mutated));
    }

    private static TinyRustLmMemoryEndpointRecord Record() =>
        TinyRustLmMemoryEndpointRecord.LongTerm(
            "Durable sync design",
            "Public-safe durable memory for the offline synchronization contract.",
            new[]
            {
                "wiki/runtime-mirust/reports/sync.md",
                ".uai/long-term-memory.uai"
            },
            new[] { "offline", "tinyrustlm" });

    private static MemoryEndpointsAuthoritativeReceipt Receipt(MemoryEndpointsOutboxEntry entry) =>
        new(
            MemoryEndpointsSyncContract.AuthoritativeReceiptKind,
            1,
            entry.EventId,
            entry.IdempotencyKey,
            entry.PayloadSha256,
            "mem-demo",
            "receipt-demo",
            true,
            1_720_000_001_100,
            null,
            null);
}
