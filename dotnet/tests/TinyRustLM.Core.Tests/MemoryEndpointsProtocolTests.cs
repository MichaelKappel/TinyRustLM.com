using System.Net;
using System.Text;
using Xunit;

namespace TinyRustLM.Tests;

public sealed class MemoryEndpointsProtocolTests
{
    [Fact]
    public void DeployedCapabilityEnvelopeIsLiveAndComplete()
    {
        var capabilities = MemoryEndpointsDistributedSyncProtocol.ParseCapabilities(ExampleCapabilities());

        Assert.Equal(MemoryEndpointsDistributedSyncProtocol.CapabilitiesKind, capabilities.SchemaVersion);
        Assert.Equal(MemoryEndpointsDistributedSyncProtocol.Protocol, capabilities.Protocol);
        Assert.Equal("live", capabilities.Status);
        Assert.False(capabilities.MutationContract.HardForgetSupported);
        Assert.Equal("/api/matm/sync/receipts", capabilities.Routes.LookupReceipt);
        Assert.Equal(200, MemoryEndpointsDistributedSyncProtocol.MaxPullPageSize);
    }

    [Fact]
    public void MissingCheckpointOrDeviceAuthorityFailsClosed()
    {
        var noMonotonic = ExampleCapabilities().Replace(
            "\"monotonicServerSequence\": true",
            "\"monotonicServerSequence\": false",
            StringComparison.Ordinal);
        Assert.Throws<ArgumentException>(() =>
            MemoryEndpointsDistributedSyncProtocol.ParseCapabilities(noMonotonic));

        var secretDevice = ExampleCapabilities().Replace(
            "\"secretMaterialStored\": false",
            "\"secretMaterialStored\": true",
            StringComparison.Ordinal);
        Assert.Throws<ArgumentException>(() =>
            MemoryEndpointsDistributedSyncProtocol.ParseCapabilities(secretDevice));
    }

    [Fact]
    public void RouteOperationAndRetentionDriftFailClosed()
    {
        var routeDrift = ExampleCapabilities().Replace(
            "\"/api/matm/sync/heads\"",
            "\"/api/matm/sync/heads/read\"",
            StringComparison.Ordinal);
        Assert.Throws<ArgumentException>(() =>
            MemoryEndpointsDistributedSyncProtocol.ParseCapabilities(routeDrift));

        var operationDrift = ExampleCapabilities().Replace(
            "\"hard_forget\"",
            "\"last_write_wins\"",
            StringComparison.Ordinal);
        Assert.Throws<ArgumentException>(() =>
            MemoryEndpointsDistributedSyncProtocol.ParseCapabilities(operationDrift));

        var rawPrivate = ExampleCapabilities().Replace(
            "\"rawPrivatePayloadStored\": false",
            "\"rawPrivatePayloadStored\": true",
            StringComparison.Ordinal);
        Assert.Throws<ArgumentException>(() =>
            MemoryEndpointsDistributedSyncProtocol.ParseCapabilities(rawPrivate));
    }

    [Fact]
    public void UnknownPreviewAndOversizedEnvelopesFailClosed()
    {
        var preview = ExampleCapabilities().Replace(
            "\"status\": \"live\"",
            "\"status\": \"preview\"",
            StringComparison.Ordinal);
        Assert.Throws<ArgumentException>(() =>
            MemoryEndpointsDistributedSyncProtocol.ParseCapabilities(preview));

        var unknown = ExampleCapabilities().Replace(
            "\"ok\": true,",
            "\"ok\": true, \"silentLastWriteWins\": true,",
            StringComparison.Ordinal);
        Assert.ThrowsAny<Exception>(() =>
            MemoryEndpointsDistributedSyncProtocol.ParseCapabilities(unknown));

        var oversized = ExampleCapabilities() + new string(' ', 64 * 1024);
        Assert.Throws<ArgumentException>(() =>
            MemoryEndpointsDistributedSyncProtocol.ParseCapabilities(oversized));
    }

    [Fact]
    public async Task CapabilityProbeIsCredentialFreeAndCachesOnlyAValidLiveContract()
    {
        var handler = new ProbeHandler(HttpStatusCode.OK, ExampleCapabilities());
        var client = CreateClient(handler);

        var availability = await client.ProbeDistributedSyncAsync();

        Assert.Equal(MemoryEndpointsDistributedSyncAvailabilityStatus.Live, availability.Status);
        Assert.Null(handler.Authorization);
        Assert.Equal("/api/matm/sync/capabilities", handler.RequestUri?.AbsolutePath);
    }

    [Fact]
    public async Task MissingAndUnsafeCapabilityResponsesDoNotActivateTransport()
    {
        var missing = CreateClient(new ProbeHandler(HttpStatusCode.NotFound, "{}"));
        Assert.Equal(
            MemoryEndpointsDistributedSyncAvailabilityStatus.NotAdvertised,
            (await missing.ProbeDistributedSyncAsync()).Status);

        var unsafeJson = ExampleCapabilities().Replace(
            "\"rawCredentialExposed\": false",
            "\"rawCredentialExposed\": true",
            StringComparison.Ordinal);
        var unsafeClient = CreateClient(new ProbeHandler(HttpStatusCode.OK, unsafeJson));
        Assert.Equal(
            MemoryEndpointsDistributedSyncAvailabilityStatus.Incompatible,
            (await unsafeClient.ProbeDistributedSyncAsync()).Status);
    }

    private static TinyRustLmMemoryEndpointsClient CreateClient(HttpMessageHandler handler) =>
        new(
            new MemoryEndpointsClientOptions(
                "workspace-fixture",
                "session-only-test-value",
                MemoryEndpointsRoutes.FromBaseUri(new Uri("https://memoryendpoints.example"))),
            new HttpClient(handler));

    private static string ExampleCapabilities()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var path = Path.Combine(
                directory.FullName,
                "docs",
                "nuget",
                "memoryendpoints-distributed-sync-capabilities-v1.example.json");
            if (File.Exists(path))
            {
                return File.ReadAllText(path);
            }
            directory = directory.Parent;
        }
        throw new InvalidOperationException("Unable to locate distributed-sync capabilities.");
    }

    private sealed class ProbeHandler(HttpStatusCode statusCode, string responseBody) : HttpMessageHandler
    {
        public Uri? RequestUri { get; private set; }
        public string? Authorization { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestUri = request.RequestUri;
            Authorization = request.Headers.Authorization?.ToString();
            var response = new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
            };
            response.Headers.CacheControl = new System.Net.Http.Headers.CacheControlHeaderValue
            {
                NoStore = true
            };
            return Task.FromResult(response);
        }
    }
}
