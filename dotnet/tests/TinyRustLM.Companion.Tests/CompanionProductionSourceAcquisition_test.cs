using System.Net;
using System.Net.Sockets;
using TinyRustLM.Companion;
using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CompanionProductionSourceAcquisition_test
{
    /// <summary>Cancellation after allocation must close the owned socket and preserve cancellation.</summary>
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task CancelledConnectDisposesOwnedSocket(bool ipv6)
    {
        var address = ipv6 ? IPAddress.IPv6Loopback : IPAddress.Loopback;
        using var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp);
        using var cancelled = new CancellationTokenSource();
        cancelled.Cancel();

        var error = await Assert.ThrowsAnyAsync<OperationCanceledException>(async () =>
            await CompanionHuggingFaceSourceTransport.ConnectOwnedSocketAsync(
                socket, address, 1, cancelled.Token));

        Assert.Equal(cancelled.Token, error.CancellationToken);
        Assert.True(socket.SafeHandle.IsClosed);
    }

    /// <summary>Argument failure before an asynchronous connection also releases the supplied socket.</summary>
    [Theory]
    [InlineData(-1)]
    [InlineData(65536)]
    public async Task InvalidPortDisposesOwnedSocket(int port)
    {
        using var socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(async () =>
            await CompanionHuggingFaceSourceTransport.ConnectOwnedSocketAsync(
                socket, IPAddress.Loopback, port, CancellationToken.None));
        Assert.True(socket.SafeHandle.IsClosed);
    }

    /// <summary>A local connection refusal preserves its socket error and releases the handle.</summary>
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RefusedConnectDisposesOwnedSocket(bool ipv6)
    {
        var address = ipv6 ? IPAddress.IPv6Loopback : IPAddress.Loopback;
        // Reserve a non-listening local endpoint so another process cannot claim this port.
        using var reserved = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp);
        reserved.Bind(new IPEndPoint(address, 0));
        var port = ((IPEndPoint)reserved.LocalEndPoint!).Port;
        using var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        var error = await Assert.ThrowsAsync<SocketException>(async () =>
            await CompanionHuggingFaceSourceTransport.ConnectOwnedSocketAsync(
                socket, address, port, timeout.Token));

        Assert.Equal(SocketError.ConnectionRefused, error.SocketErrorCode);
        Assert.True(socket.SafeHandle.IsClosed);
    }

    /// <summary>A successful connection transfers socket ownership to a functioning returned stream.</summary>
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ConnectedStreamOwnsSocketUntilDisposed(bool ipv6)
    {
        var address = ipv6 ? IPAddress.IPv6Loopback : IPAddress.Loopback;
        using var listener = new TcpListener(address, 0);
        listener.Start();
        using var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var accepting = listener.AcceptSocketAsync(timeout.Token);
        await using var stream = await CompanionHuggingFaceSourceTransport.ConnectOwnedSocketAsync(
            socket, address, ((IPEndPoint)listener.LocalEndpoint).Port, timeout.Token);
        using var accepted = await accepting;

        Assert.False(socket.SafeHandle.IsClosed);
        await stream.WriteAsync(new byte[] { 0x5a }, timeout.Token);
        var received = new byte[1];
        Assert.Equal(1, await accepted.ReceiveAsync(received, SocketFlags.None, timeout.Token));
        Assert.Equal(0x5a, received[0]);
        await stream.DisposeAsync();
        Assert.True(socket.SafeHandle.IsClosed);
    }
}
