using System.Buffers;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Security.Cryptography;

namespace TinyRustLM.Companion;

/// <summary>Fixed operation-owned roots used by source acquisition and conversion.</summary>
internal sealed record CompanionProductionOperationPaths(
    string OperationRoot,
    string SourceCacheRoot,
    string ModelSourceRoot,
    string TokenizerSourceRoot,
    string SourceStagingRoot,
    string MaterializedLockRoot,
    string ConversionOutputRoot);

/// <summary>One compiled source member with exact length, digest, and tokenizer membership.</summary>
internal sealed record CompanionBuiltInSourceFile(
    string Path,
    ulong ByteLength,
    string Sha256,
    bool TokenizerMember);

/// <summary>Downloads exact compiled source members into operation-owned partial files.</summary>
internal interface ICompanionSourceTransport : IDisposable
{
    /// <summary>Resumes one member at the existing partial length and writes no other path.</summary>
    Task DownloadAsync(
        CompanionBuiltInSourceFile file,
        string partialPath,
        CancellationToken cancellationToken);
}

/// <summary>
/// Acquires and independently verifies only the compiled Qwen3 source closure.
/// </summary>
internal sealed class CompanionSourceAcquisition : IDisposable
{
    /// <summary>Gets the sole ordered source closure accepted by production acquisition.</summary>
    internal static readonly IReadOnlyList<CompanionBuiltInSourceFile> Files =
    [
        new("LICENSE", 11_343,
            "832dd9e00a68dd83b3c3fb9f5588dad7dcf337a0db50f7d9483f310cd292e92e",
            TokenizerMember: false),
        new("README.md", 13_965,
            "1ab64a26fcb3b461423b89a433a8c858f1bf8d4086f979cbb3ff878d47cf20e9",
            TokenizerMember: false),
        new("config.json", 726,
            "660db3b73d788119c04535e48cf9be5f55bc3100841a718637ae695b442f27dd",
            TokenizerMember: true),
        new("generation_config.json", 239,
            "2325da0f15bb848e018c5ae071b7943332e9f871d6b60e2ed22ca97d4cb993d2",
            TokenizerMember: false),
        new("merges.txt", 1_671_853,
            "8831e4f1a044471340f7c0a83d7bd71306a5b867e95fd870f74d0c5308a904d5",
            TokenizerMember: true),
        new("model.safetensors", 1_503_300_328,
            "f47f71177f32bcd101b7573ec9171e6a57f4f4d31148d38e382306f42996874b",
            TokenizerMember: false),
        new("tokenizer.json", 11_422_654,
            "aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4",
            TokenizerMember: true),
        new("tokenizer_config.json", 9_732,
            "d5d09f07b48c3086c508b30d1c9114bd1189145b74e982a265350c923acd8101",
            TokenizerMember: true),
        new("vocab.json", 2_776_833,
            "ca10d7e9fb3ed18575dd1e277a2579c16d108e32f27439684afa0e10b1440910",
            TokenizerMember: true)
    ];

    private readonly CompanionOperationJournal _journal;
    private readonly ICompanionSourceTransport _transport;

    /// <summary>Creates acquisition around one journal and one bounded source transport.</summary>
    internal CompanionSourceAcquisition(
        CompanionOperationJournal journal,
        ICompanionSourceTransport transport)
    {
        _journal = journal ?? throw new ArgumentNullException(nameof(journal));
        _transport = transport ?? throw new ArgumentNullException(nameof(transport));
        ValidateCompiledInventory();
    }

    /// <summary>Creates acquisition with the fail-closed production Hugging Face transport.</summary>
    internal static CompanionSourceAcquisition CreateProduction(
        CompanionOperationJournal journal) =>
        new(journal, new CompanionHuggingFaceSourceTransport());

    /// <summary>Acquires, verifies, activates, and receipts the exact bound source closure.</summary>
    internal async Task<CompanionPersistedSourceAcquisitionReceipt> AcquireAsync(
        string operationId,
        CompanionProductionOperationPaths paths,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(paths);
        var current = _journal.Read(operationId);
        var execution = _journal.ReadExecutionIntent(operationId);
        var intent = _journal.ReadSourceAcquisitionIntent(operationId);
        RequireBoundIntent(current, execution, intent, paths);

        var payloadRoot = Path.Combine(paths.SourceCacheRoot, "payload");
        EnsureDirectory(paths.SourceStagingRoot, paths.OperationRoot);
        EnsureDirectory(paths.SourceCacheRoot, paths.OperationRoot);
        EnsureDirectory(payloadRoot, paths.SourceCacheRoot);
        EnsureDirectory(paths.MaterializedLockRoot, paths.OperationRoot);
        MaterializeLocks(paths.MaterializedLockRoot);

        foreach (var file in Files)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await EnsureCachedAsync(
                file,
                payloadRoot,
                paths.SourceStagingRoot,
                cancellationToken).ConfigureAwait(false);
        }

        VerifyExactDirectory(payloadRoot, Files);
        var inventorySha256 = CompanionSourcePayloadInventory.ComputeSha256(
            Files.Select(static file => new CompanionSourcePayloadMember(
                file.Path,
                file.ByteLength,
                file.Sha256)));
        if (inventorySha256 != CompanionSourceDescriptor.PayloadInventorySha256)
        {
            throw new CompanionContractException("source-payload-inventory-identity");
        }

        await ActivateAsync(
            payloadRoot,
            paths.ModelSourceRoot,
            Files,
            paths.OperationRoot,
            cancellationToken).ConfigureAwait(false);
        await ActivateAsync(
            payloadRoot,
            paths.TokenizerSourceRoot,
            Files.Where(static file => file.TokenizerMember).ToArray(),
            paths.OperationRoot,
            cancellationToken).ConfigureAwait(false);

        return _journal.PersistSourceAcquisitionReceipt(
            new CompanionSourceAcquisitionReceipt(
                CompanionContract.SourceAcquisitionReceiptSchema,
                operationId,
                current.RequestSha256,
                execution.Sha256,
                intent.Sha256,
                CompanionSourceDescriptor.DescriptorId,
                CompanionSourceDescriptor.ModelSourceLockSha256,
                CompanionSourceDescriptor.TokenizerSourceLockSha256,
                CompanionSourceDescriptor.PayloadInventorySchema,
                inventorySha256,
                CompanionSourceDescriptor.FileCount,
                CompanionSourceDescriptor.PayloadBytes,
                paths.ModelSourceRoot,
                paths.TokenizerSourceRoot));
    }

    /// <summary>Disposes the owned source transport.</summary>
    public void Dispose() => _transport.Dispose();

    /// <summary>Resumes and promotes one exact source member into the verified payload cache.</summary>
    private async Task EnsureCachedAsync(
        CompanionBuiltInSourceFile file,
        string payloadRoot,
        string stagingRoot,
        CancellationToken cancellationToken)
    {
        var finalPath = Path.Combine(payloadRoot, file.Path);
        if (File.Exists(finalPath))
        {
            VerifyFile(finalPath, file);
            return;
        }
        if (Directory.Exists(finalPath))
        {
            throw new CompanionContractException("source-payload-entry-invalid");
        }

        var partialPath = Path.Combine(stagingRoot, $"{file.Path}.partial");
        if (Directory.Exists(partialPath))
        {
            throw new CompanionContractException("source-partial-invalid");
        }
        if (File.Exists(partialPath))
        {
            RejectReparsePoint(partialPath, "source-partial-invalid");
            var length = checked((ulong)new FileInfo(partialPath).Length);
            if (length > file.ByteLength)
            {
                throw new CompanionContractException("source-partial-invalid");
            }
        }

        await _transport.DownloadAsync(file, partialPath, cancellationToken)
            .ConfigureAwait(false);
        VerifyFile(partialPath, file);
        try
        {
            File.Move(partialPath, finalPath);
        }
        catch (IOException) when (File.Exists(finalPath))
        {
            VerifyFile(finalPath, file);
        }
    }

    /// <summary>Create-only copies one verified member set into an exact activation directory.</summary>
    private static async Task ActivateAsync(
        string payloadRoot,
        string destinationRoot,
        IReadOnlyCollection<CompanionBuiltInSourceFile> members,
        string operationRoot,
        CancellationToken cancellationToken)
    {
        EnsureDirectory(destinationRoot, operationRoot);
        RejectUnexpectedEntries(
            destinationRoot,
            members.Select(static file => file.Path),
            requireComplete: false);
        foreach (var member in members)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var source = Path.Combine(payloadRoot, member.Path);
            var destination = Path.Combine(destinationRoot, member.Path);
            if (File.Exists(destination))
            {
                VerifyFile(destination, member);
                continue;
            }
            await CopyCreateOnlyAsync(source, destination, cancellationToken)
                .ConfigureAwait(false);
            VerifyFile(destination, member);
        }
        VerifyExactDirectory(destinationRoot, members);
    }

    /// <summary>Streams one regular source file into a new durable destination file.</summary>
    private static async Task CopyCreateOnlyAsync(
        string source,
        string destination,
        CancellationToken cancellationToken)
    {
        RejectReparsePoint(source, "source-payload-entry-invalid");
        await using var input = new FileStream(
            source,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            checked((int)CompanionSourceDescriptor.BufferBytes),
            FileOptions.Asynchronous | FileOptions.SequentialScan);
        await using var output = new FileStream(
            destination,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            checked((int)CompanionSourceDescriptor.BufferBytes),
            FileOptions.Asynchronous | FileOptions.SequentialScan | FileOptions.WriteThrough);
        await input.CopyToAsync(
            output,
            checked((int)CompanionSourceDescriptor.BufferBytes),
            cancellationToken).ConfigureAwait(false);
        output.Flush(flushToDisk: true);
    }

    /// <summary>Materializes exactly the two compiled source locks beneath the owned lock root.</summary>
    private static void MaterializeLocks(string root)
    {
        MaterializeLock(
            Path.Combine(root, CompanionBuiltInSourceAssets.ModelLockFileName),
            CompanionBuiltInSourceAssets.ModelLockBytes,
            CompanionSourceDescriptor.ModelSourceLockSha256);
        MaterializeLock(
            Path.Combine(root, CompanionBuiltInSourceAssets.TokenizerLockFileName),
            CompanionBuiltInSourceAssets.TokenizerLockBytes,
            CompanionSourceDescriptor.TokenizerSourceLockSha256);
        RejectUnexpectedEntries(
            root,
            [
                CompanionBuiltInSourceAssets.ModelLockFileName,
                CompanionBuiltInSourceAssets.TokenizerLockFileName
            ]);
    }

    /// <summary>Create-only writes one lock and requires its exact compiled digest.</summary>
    private static void MaterializeLock(string path, byte[] bytes, string expectedSha256)
    {
        if (!File.Exists(path))
        {
            try
            {
                CompanionProductionFileSystem.WriteCreateOnly(path, bytes);
            }
            catch (IOException) when (File.Exists(path))
            {
            }
        }
        if (CompanionProductionFileSystem.Sha256RegularFile(
                path,
                "source-lock-assets-invalid") != expectedSha256)
        {
            throw new CompanionContractException("source-lock-assets-invalid");
        }
    }

    /// <summary>Requires journal state and every persisted acquisition root to match this operation.</summary>
    private static void RequireBoundIntent(
        CompanionOperationRecord current,
        CompanionPersistedExecutionIntent execution,
        CompanionPersistedSourceAcquisitionIntent acquisition,
        CompanionProductionOperationPaths paths)
    {
        if (current.State != CompanionOperationState.AcquiringSource ||
            current.Route != CompanionAcquisitionRoute.Source ||
            current.ExecutionIntentSha256 != execution.Sha256 ||
            current.SourceAcquisitionIntentSha256 != acquisition.Sha256 ||
            execution.Intent.SourceDescriptorId != CompanionSourceDescriptor.DescriptorId ||
            execution.Intent.SourceAcquisitionRoot != paths.SourceStagingRoot ||
            execution.Intent.MaterializedLockRoot != paths.MaterializedLockRoot ||
            execution.Intent.ConversionOutputRoot != paths.ConversionOutputRoot ||
            acquisition.Intent.SourceCacheRoot != paths.SourceCacheRoot ||
            acquisition.Intent.ModelSourceRoot != paths.ModelSourceRoot ||
            acquisition.Intent.TokenizerSourceRoot != paths.TokenizerSourceRoot ||
            acquisition.Intent.SourceStagingRoot != paths.SourceStagingRoot ||
            acquisition.Intent.MaterializedLockRoot != paths.MaterializedLockRoot)
        {
            throw new CompanionContractException("source-acquisition-intent-binding");
        }
    }

    /// <summary>Requires a directory to contain exactly the expected verified member set.</summary>
    private static void VerifyExactDirectory(
        string root,
        IReadOnlyCollection<CompanionBuiltInSourceFile> members)
    {
        RejectUnexpectedEntries(root, members.Select(static file => file.Path));
        foreach (var member in members)
        {
            VerifyFile(Path.Combine(root, member.Path), member);
        }
    }

    /// <summary>Rejects missing, extra, non-file, or reparse entries in a governed directory.</summary>
    private static void RejectUnexpectedEntries(
        string root,
        IEnumerable<string> allowedNames,
        bool requireComplete = true)
    {
        var allowed = new HashSet<string>(allowedNames, StringComparer.Ordinal);
        string[] entries;
        try
        {
            entries = Directory.GetFileSystemEntries(root);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            throw new CompanionContractException("source-directory-invalid");
        }
        foreach (var entry in entries)
        {
            if (!allowed.Contains(Path.GetFileName(entry)) || !File.Exists(entry) ||
                Directory.Exists(entry))
            {
                throw new CompanionContractException("source-directory-invalid");
            }
            RejectReparsePoint(entry, "source-directory-invalid");
        }
        if (requireComplete && entries.Length != allowed.Count)
        {
            throw new CompanionContractException("source-directory-invalid");
        }
    }

    /// <summary>Recomputes one regular source member's exact length and SHA-256 identity.</summary>
    private static void VerifyFile(string path, CompanionBuiltInSourceFile expected)
    {
        try
        {
            if (!File.Exists(path) || Directory.Exists(path))
            {
                throw new CompanionContractException("source-payload-entry-invalid");
            }
            RejectReparsePoint(path, "source-payload-entry-invalid");
            if (checked((ulong)new FileInfo(path).Length) != expected.ByteLength)
            {
                throw new CompanionContractException("source-payload-entry-invalid");
            }
            using var stream = new FileStream(
                path,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                checked((int)CompanionSourceDescriptor.BufferBytes),
                FileOptions.SequentialScan);
            var digest = Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
            if (digest != expected.Sha256)
            {
                throw new CompanionContractException("source-payload-entry-invalid");
            }
        }
        catch (CompanionContractException)
        {
            throw;
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            throw new CompanionContractException("source-payload-entry-invalid");
        }
    }

    /// <summary>Creates or opens one direct non-reparse child of the expected parent.</summary>
    private static void EnsureDirectory(string path, string expectedParent)
    {
        var full = Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
        var parent = Path.TrimEndingDirectorySeparator(
            Path.GetFullPath(Path.GetDirectoryName(full) ?? string.Empty));
        var expected = Path.TrimEndingDirectorySeparator(Path.GetFullPath(expectedParent));
        if (!PathEquals(parent, expected) || File.Exists(full))
        {
            throw new CompanionContractException("source-root-invalid");
        }
        try
        {
            Directory.CreateDirectory(full);
            if (!Directory.Exists(full))
            {
                throw new CompanionContractException("source-root-invalid");
            }
            RejectReparsePoint(full, "source-root-invalid");
        }
        catch (CompanionContractException)
        {
            throw;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            throw new CompanionContractException("source-root-invalid");
        }
    }

    /// <summary>Rejects a filesystem entry that redirects source path resolution.</summary>
    private static void RejectReparsePoint(string path, string code)
    {
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
        {
            throw new CompanionContractException(code);
        }
    }

    /// <summary>Compares canonical paths using the host filesystem's case semantics.</summary>
    private static bool PathEquals(string left, string right) => string.Equals(
        left,
        right,
        OperatingSystem.IsWindows()
            ? StringComparison.OrdinalIgnoreCase
            : StringComparison.Ordinal);

    /// <summary>Checks compiled member count, aggregate bytes, and inventory identity together.</summary>
    private static void ValidateCompiledInventory()
    {
        var inventory = CompanionSourcePayloadInventory.ComputeSha256(
            Files.Select(static file => new CompanionSourcePayloadMember(
                file.Path,
                file.ByteLength,
                file.Sha256)));
        if (inventory != CompanionSourceDescriptor.PayloadInventorySha256 ||
            Files.Count != CompanionSourceDescriptor.FileCount ||
            Files.Aggregate(
                0UL,
                static (total, file) => checked(total + file.ByteLength)) !=
                CompanionSourceDescriptor.PayloadBytes)
        {
            throw new CompanionProtocolException("source-descriptor-invalid");
        }
    }
}

/// <summary>
/// Fetches exact public source members over direct HTTPS with bounded redirects and public DNS.
/// </summary>
internal sealed class CompanionHuggingFaceSourceTransport : ICompanionSourceTransport
{
    private readonly HttpClient _client;

    /// <summary>Creates one no-proxy, no-cookie, no-decompression, manual-redirect transport.</summary>
    internal CompanionHuggingFaceSourceTransport()
    {
        var handler = new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.None,
            ConnectCallback = ConnectPublicAsync,
            ConnectTimeout = TimeSpan.FromSeconds(30),
            MaxConnectionsPerServer = 1,
            MaxResponseHeadersLength = 32,
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
            UseCookies = false,
            UseProxy = false
        };
        _client = new HttpClient(handler, disposeHandler: true)
        {
            Timeout = Timeout.InfiniteTimeSpan
        };
    }

    /// <summary>Downloads or resumes one exact member with strict range and response bounds.</summary>
    public async Task DownloadAsync(
        CompanionBuiltInSourceFile file,
        string partialPath,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(file);
        var offset = File.Exists(partialPath)
            ? checked((ulong)new FileInfo(partialPath).Length)
            : 0;
        if (offset > file.ByteLength)
        {
            throw new CompanionContractException("source-partial-invalid");
        }
        if (offset == file.ByteLength)
        {
            return;
        }

        var uri = InitialUri(file);
        for (var redirect = 0U; ; redirect++)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, uri)
            {
                Version = HttpVersion.Version11,
                VersionPolicy = HttpVersionPolicy.RequestVersionExact
            };
            request.Headers.AcceptEncoding.Add(new StringWithQualityHeaderValue("identity"));
            if (offset != 0)
            {
                request.Headers.Range = new RangeHeaderValue(checked((long)offset), null);
            }

            using var response = await _client.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken).ConfigureAwait(false);
            if (IsRedirect(response.StatusCode))
            {
                if (redirect >= CompanionSourceDescriptor.MaximumRedirects ||
                    response.Headers.Location is null)
                {
                    throw new CompanionContractException("source-redirect-invalid");
                }
                uri = ValidateRedirect(uri, response.Headers.Location);
                continue;
            }

            ValidateSuccess(response, file, offset);
            await AppendResponseAsync(
                response,
                partialPath,
                offset,
                file.ByteLength - offset,
                cancellationToken).ConfigureAwait(false);
            return;
        }
    }

    /// <summary>Disposes the transport and its owned connection pool.</summary>
    public void Dispose() => _client.Dispose();

    /// <summary>Builds the sole pinned repository URL for a compiled source member.</summary>
    internal static Uri InitialUri(CompanionBuiltInSourceFile file)
    {
        if (!CompanionSourceAcquisition.Files.Contains(file) ||
            file.Path != Path.GetFileName(file.Path))
        {
            throw new CompanionContractException("source-file-unsupported");
        }
        return new Uri(
            $"{CompanionSourceDescriptor.InitialOrigin}/" +
            $"{CompanionSourceDescriptor.Repository}/resolve/" +
            $"{CompanionSourceDescriptor.Revision}/{Uri.EscapeDataString(file.Path)}" +
            "?download=true",
            UriKind.Absolute);
    }

    /// <summary>Allows only globally routable addresses and rejects special-use ranges.</summary>
    internal static bool IsPublicAddress(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }
        if (IPAddress.IsLoopback(address))
        {
            return false;
        }
        var bytes = address.GetAddressBytes();
        if (bytes.Length == 4)
        {
            var first = bytes[0];
            var second = bytes[1];
            return first is not (0 or 10 or 127) &&
                first < 224 &&
                !(first == 100 && second is >= 64 and <= 127) &&
                !(first == 169 && second == 254) &&
                !(first == 172 && second is >= 16 and <= 31) &&
                !(first == 192 && second is 0 or 168) &&
                !(first == 198 && (second is 18 or 19 ||
                    second == 51 && bytes[2] == 100)) &&
                !(first == 203 && second == 0 && bytes[2] == 113);
        }
        if (bytes.Length != 16 ||
            address.IsIPv6LinkLocal ||
            address.IsIPv6Multicast ||
            address.IsIPv6SiteLocal ||
            (bytes[0] & 0xfe) == 0xfc ||
            (bytes[0] & 0xe0) != 0x20)
        {
            return false;
        }
        return !(bytes[0] == 0x20 && bytes[1] == 0x01 &&
            bytes[2] == 0x0d && bytes[3] == 0xb8);
    }

    /// <summary>Resolves DNS, rejects any non-public answer, and connects to an admitted address.</summary>
    private static async ValueTask<Stream> ConnectPublicAsync(
        SocketsHttpConnectionContext context,
        CancellationToken cancellationToken)
    {
        var endpoint = context.DnsEndPoint;
        if (Uri.CheckHostName(endpoint.Host) != UriHostNameType.Dns)
        {
            throw new HttpRequestException("source-destination-invalid");
        }
        var addresses = await Dns.GetHostAddressesAsync(endpoint.Host, cancellationToken)
            .ConfigureAwait(false);
        if (addresses.Length == 0 || addresses.Any(static address => !IsPublicAddress(address)))
        {
            throw new HttpRequestException("source-destination-invalid");
        }

        Exception? lastError = null;
        foreach (var address in addresses)
        {
            var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp)
            {
                NoDelay = true
            };
            try
            {
                return await ConnectOwnedSocketAsync(socket, address, endpoint.Port, cancellationToken)
                    .ConfigureAwait(false);
            }
            catch (Exception error) when (error is SocketException or IOException)
            {
                lastError = error;
            }
        }
        throw new HttpRequestException("source-connect-failed", lastError);
    }

    /// <summary>Transfers a supplied socket to its connected stream or disposes it on connection failure.</summary>
    internal static async ValueTask<Stream> ConnectOwnedSocketAsync(
        Socket socket,
        IPAddress address,
        int port,
        CancellationToken cancellationToken)
    {
        try
        {
            await socket.ConnectAsync(address, port, cancellationToken).ConfigureAwait(false);
            return new NetworkStream(socket, ownsSocket: true);
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }

    /// <summary>Appends exactly the expected bytes at the verified partial offset and flushes them.</summary>
    private static async Task AppendResponseAsync(
        HttpResponseMessage response,
        string path,
        ulong expectedOffset,
        ulong expectedBytes,
        CancellationToken cancellationToken)
    {
        await using var input = await response.Content.ReadAsStreamAsync(cancellationToken)
            .ConfigureAwait(false);
        await using var output = new FileStream(
            path,
            FileMode.OpenOrCreate,
            FileAccess.Write,
            FileShare.None,
            checked((int)CompanionSourceDescriptor.BufferBytes),
            FileOptions.Asynchronous | FileOptions.SequentialScan | FileOptions.WriteThrough);
        if (checked((ulong)output.Length) != expectedOffset)
        {
            throw new CompanionContractException("source-partial-invalid");
        }
        output.Position = output.Length;
        var buffer = ArrayPool<byte>.Shared.Rent(
            checked((int)CompanionSourceDescriptor.BufferBytes));
        try
        {
            var remaining = expectedBytes;
            while (remaining != 0)
            {
                var requested = checked((int)Math.Min(
                    remaining,
                    CompanionSourceDescriptor.BufferBytes));
                var read = await input.ReadAsync(
                    buffer.AsMemory(0, requested),
                    cancellationToken).ConfigureAwait(false);
                if (read == 0)
                {
                    throw new CompanionContractException("source-response-short");
                }
                await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken)
                    .ConfigureAwait(false);
                remaining -= checked((ulong)read);
            }
            if (await input.ReadAsync(buffer.AsMemory(0, 1), cancellationToken)
                    .ConfigureAwait(false) != 0)
            {
                throw new CompanionContractException("source-response-long");
            }
        }
        finally
        {
            try
            {
                output.Flush(flushToDisk: true);
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer, clearArray: true);
            }
        }
    }

    /// <summary>Requires exact status, encoding, length, and content-range response metadata.</summary>
    private static void ValidateSuccess(
        HttpResponseMessage response,
        CompanionBuiltInSourceFile file,
        ulong offset)
    {
        var expectedRemaining = file.ByteLength - offset;
        if (response.Content.Headers.ContentEncoding.Count != 0 ||
            response.Content.Headers.ContentLength is long length &&
                checked((ulong)length) != expectedRemaining)
        {
            throw new CompanionContractException("source-response-invalid");
        }
        if (offset == 0)
        {
            if (response.StatusCode != HttpStatusCode.OK ||
                response.Content.Headers.ContentRange is not null)
            {
                throw new CompanionContractException("source-response-invalid");
            }
            return;
        }

        var range = response.Content.Headers.ContentRange;
        if (response.StatusCode != HttpStatusCode.PartialContent ||
            range?.Unit != "bytes" ||
            range.From != checked((long)offset) ||
            range.To != checked((long)file.ByteLength - 1) ||
            range.Length != checked((long)file.ByteLength))
        {
            throw new CompanionContractException("source-range-invalid");
        }
    }

    /// <summary>Resolves one redirect and admits only credential-free HTTPS DNS origins.</summary>
    internal static Uri ValidateRedirect(Uri current, Uri location)
    {
        var target = location.IsAbsoluteUri ? location : new Uri(current, location);
        if (target.Scheme != Uri.UriSchemeHttps ||
            !target.IsDefaultPort ||
            !string.IsNullOrEmpty(target.UserInfo) ||
            !string.IsNullOrEmpty(target.Fragment) ||
            Uri.CheckHostName(target.Host) != UriHostNameType.Dns)
        {
            throw new CompanionContractException("source-redirect-invalid");
        }
        return target;
    }

    /// <summary>Returns whether a status is one of the explicitly handled redirects.</summary>
    private static bool IsRedirect(HttpStatusCode status) => status is
        HttpStatusCode.MovedPermanently or
        HttpStatusCode.Redirect or
        HttpStatusCode.RedirectMethod or
        HttpStatusCode.TemporaryRedirect or
        HttpStatusCode.PermanentRedirect;
}
