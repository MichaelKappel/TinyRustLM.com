using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TinyRustLM.Companion;

public sealed class CompanionOperationJournal
{
    private const string MarkerFileName = ".tinyrustlm-companion-root";
    private const string OperationsDirectoryName = "operations";
    private const string SourceConversionIntentFileName = "source-conversion.intent.json";
    private const int MaximumRecordBytes = 65_536;
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> InProcessLocks =
        new(StringComparer.OrdinalIgnoreCase);
    private readonly string _operationsRoot;
    private readonly TimeProvider _timeProvider;

    public CompanionOperationJournal(string rootPath, TimeProvider? timeProvider = null)
    {
        var root = RequireOwnedRoot(rootPath);
        _operationsRoot = Path.Combine(root, OperationsDirectoryName);
        Directory.CreateDirectory(_operationsRoot);
        RejectReparsePoint(_operationsRoot, "journal-operations-root");
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public static string CreateOwnedRoot(string rootPath)
    {
        var root = FullPath(rootPath, nameof(rootPath));
        if (Directory.Exists(root) || File.Exists(root))
        {
            throw new CompanionContractException("journal-root-exists");
        }
        var parent = Path.GetDirectoryName(root);
        if (string.IsNullOrWhiteSpace(parent) || !Directory.Exists(parent))
        {
            throw new CompanionContractException("journal-root-parent");
        }
        RejectReparsePoint(parent, "journal-root-parent");

        Directory.CreateDirectory(root);
        try
        {
            WriteCreateOnly(
                Path.Combine(root, MarkerFileName),
                Encoding.ASCII.GetBytes(CompanionContract.OwnedRootMarker));
            Directory.CreateDirectory(Path.Combine(root, OperationsDirectoryName));
            return root;
        }
        catch
        {
            if (Directory.Exists(root) && !Directory.EnumerateFileSystemEntries(root).Any())
            {
                Directory.Delete(root);
            }
            throw;
        }
    }

    public CompanionOperationRecord CreateOrRead(CompanionAcquireRequest request)
    {
        var normalized = CompanionContract.ValidateAndNormalize(request);
        var requestBytes = CompanionLoopbackWire.EncodeAcquireRequest(normalized);
        var operationId = Sha256(requestBytes);
        var finalDirectory = OperationDirectory(operationId);
        if (File.Exists(finalDirectory))
        {
            throw new CompanionContractException("journal-operation-conflict");
        }
        if (Directory.Exists(finalDirectory))
        {
            return ReadExistingOperation(operationId, requestBytes);
        }

        var stagingDirectory = Path.Combine(
            _operationsRoot,
            $".staging-{operationId}-{Guid.NewGuid():N}");
        Directory.CreateDirectory(stagingDirectory);
        try
        {
            var now = Timestamp();
            var record = new CompanionOperationRecord(
                CompanionContract.OperationRecordSchema,
                operationId,
                Sha256(requestBytes),
                0,
                CompanionOperationState.Queued,
                CompanionAcquisitionBranch.Undecided,
                now,
                now,
                0,
                null,
                null,
                null,
                null);
            Directory.CreateDirectory(Path.Combine(stagingDirectory, "history"));
            WriteCreateOnly(Path.Combine(stagingDirectory, "request.json"), requestBytes);
            var recordBytes = Serialize(record);
            WriteCreateOnly(Path.Combine(stagingDirectory, "history", SequenceFile(0)), recordBytes);
            WriteCreateOnly(Path.Combine(stagingDirectory, "current.json"), recordBytes);
            try
            {
                Directory.Move(stagingDirectory, finalDirectory);
                return record;
            }
            catch (IOException) when (Directory.Exists(finalDirectory))
            {
                DeleteOwnedStagingDirectory(stagingDirectory);
                return ReadExistingOperation(operationId, requestBytes);
            }
        }
        catch
        {
            if (Directory.Exists(stagingDirectory))
            {
                DeleteOwnedStagingDirectory(stagingDirectory);
            }
            throw;
        }
    }

    public CompanionOperationRecord Read(string operationId)
    {
        RequireOperationId(operationId);
        var directory = RequireOperationDirectory(operationId);
        return ReadRecord(Path.Combine(directory, "current.json"), operationId);
    }

    public CompanionAcquireRequest ReadRequest(string operationId)
    {
        RequireOperationId(operationId);
        var path = Path.Combine(RequireOperationDirectory(operationId), "request.json");
        var bytes = ReadBoundedRegularFile(
            path,
            "journal-request-file",
            "journal-request-file");
        CompanionAcquireRequest normalized;
        try
        {
            normalized = CompanionLoopbackWire.DecodeAcquireRequest(bytes);
        }
        catch (CompanionProtocolException)
        {
            throw new CompanionContractException("journal-request-json");
        }
        var current = Read(operationId);
        if (Sha256(bytes) != operationId ||
            Sha256(bytes) != current.RequestSha256)
        {
            throw new CompanionContractException("journal-request-identity");
        }
        return normalized;
    }

    public CompanionPersistedSourceConversionIntent PersistSourceConversionIntent(
        CompanionSourceConversionIntent intent)
    {
        CompanionSourceConversionIntentCodec.Validate(intent);
        RequireOperationId(intent.OperationId);
        var gate = InProcessLocks.GetOrAdd(
            intent.OperationId,
            static _ => new SemaphoreSlim(1, 1));
        if (!gate.Wait(0))
        {
            throw new CompanionContractException("journal-operation-busy");
        }

        try
        {
            var directory = OperationDirectory(intent.OperationId);
            using var processLock = AcquireProcessLock(Path.Combine(directory, "operation.lock"));
            var current = ReadRecord(Path.Combine(directory, "current.json"), intent.OperationId);
            if (current.State != CompanionOperationState.AcquiringSource ||
                current.Branch != CompanionAcquisitionBranch.Source ||
                current.SourceConversionIntentSha256 is not null ||
                current.Artifacts is not null ||
                current.ErrorCode is not null ||
                intent.RequestSha256 != current.RequestSha256)
            {
                throw new CompanionContractException("journal-source-conversion-intent-state");
            }

            var canonical = CompanionSourceConversionIntentCodec.Serialize(intent);
            var path = Path.Combine(directory, SourceConversionIntentFileName);
            if (!File.Exists(path))
            {
                try
                {
                    WriteCreateOnly(path, canonical);
                }
                catch (IOException) when (File.Exists(path))
                {
                }
            }
            var observed = ReadBoundedRegularFile(
                path,
                "journal-source-conversion-intent-file",
                "journal-source-conversion-intent-read");
            if (!observed.AsSpan().SequenceEqual(canonical))
            {
                throw new CompanionContractException("journal-source-conversion-intent-conflict");
            }
            var parsed = CompanionSourceConversionIntentCodec.DeserializeCanonical(observed);
            return new CompanionPersistedSourceConversionIntent(parsed, Sha256(observed));
        }
        finally
        {
            gate.Release();
        }
    }

    public CompanionPersistedSourceConversionIntent ReadSourceConversionIntent(string operationId)
    {
        RequireOperationId(operationId);
        var current = Read(operationId);
        var bytes = ReadBoundedRegularFile(
            Path.Combine(OperationDirectory(operationId), SourceConversionIntentFileName),
            "journal-source-conversion-intent-file",
            "journal-source-conversion-intent-read");
        var intent = CompanionSourceConversionIntentCodec.DeserializeCanonical(bytes);
        var digest = Sha256(bytes);
        if (intent.OperationId != operationId ||
            intent.RequestSha256 != current.RequestSha256 ||
            current.SourceConversionIntentSha256 is not null &&
                current.SourceConversionIntentSha256 != digest)
        {
            throw new CompanionContractException("journal-source-conversion-intent-identity");
        }
        return new CompanionPersistedSourceConversionIntent(intent, digest);
    }

    public CompanionOperationRecord Advance(
        string operationId,
        CompanionOperationState nextState,
        CompanionAcquisitionBranch branch,
        ulong completedBytes = 0,
        ulong? totalBytes = null,
        CompanionArtifactSet? artifacts = null,
        string? errorCode = null,
        string? sourceConversionIntentSha256 = null)
    {
        RequireOperationId(operationId);
        var gate = InProcessLocks.GetOrAdd(operationId, static _ => new SemaphoreSlim(1, 1));
        if (!gate.Wait(0))
        {
            throw new CompanionContractException("journal-operation-busy");
        }

        try
        {
            var directory = OperationDirectory(operationId);
            using var processLock = AcquireProcessLock(Path.Combine(directory, "operation.lock"));
            var current = ReadRecord(Path.Combine(directory, "current.json"), operationId);
            ValidateTransition(current.State, nextState);
            var intentSha256 = ResolveSourceConversionIntentSha256(
                current,
                nextState,
                branch,
                sourceConversionIntentSha256);
            ValidateRecordFields(
                nextState,
                branch,
                completedBytes,
                totalBytes,
                artifacts,
                errorCode,
                intentSha256);
            var next = current with
            {
                Sequence = checked(current.Sequence + 1),
                State = nextState,
                Branch = branch,
                UpdatedAtUtc = Timestamp(),
                CompletedBytes = completedBytes,
                TotalBytes = totalBytes,
                Artifacts = artifacts,
                ErrorCode = errorCode,
                SourceConversionIntentSha256 = intentSha256
            };
            var bytes = Serialize(next);
            var historyPath = Path.Combine(directory, "history", SequenceFile(next.Sequence));
            WriteCreateOnly(historyPath, bytes);
            ReplaceCurrent(Path.Combine(directory, "current.json"), bytes);
            return next;
        }
        finally
        {
            gate.Release();
        }
    }

    private static void ValidateTransition(CompanionOperationState current, CompanionOperationState next)
    {
        var allowed = current switch
        {
            CompanionOperationState.Queued => next is CompanionOperationState.CheckingPeers
                or CompanionOperationState.Cancelled or CompanionOperationState.Rejected,
            CompanionOperationState.CheckingPeers => next is CompanionOperationState.FetchingPeer
                or CompanionOperationState.AcquiringSource or CompanionOperationState.Cancelled
                or CompanionOperationState.Rejected,
            CompanionOperationState.FetchingPeer => next is CompanionOperationState.VerifyingPeer
                or CompanionOperationState.CheckingPeers or CompanionOperationState.Cancelled
                or CompanionOperationState.Rejected,
            CompanionOperationState.VerifyingPeer => next is CompanionOperationState.Available
                or CompanionOperationState.CheckingPeers or CompanionOperationState.AcquiringSource
                or CompanionOperationState.Cancelled or CompanionOperationState.Rejected,
            CompanionOperationState.AcquiringSource => next is CompanionOperationState.Converting
                or CompanionOperationState.Cancelled or CompanionOperationState.Rejected,
            CompanionOperationState.Converting => next is CompanionOperationState.VerifyingComposition
                or CompanionOperationState.Cancelled or CompanionOperationState.Rejected,
            CompanionOperationState.VerifyingComposition => next is CompanionOperationState.Available
                or CompanionOperationState.Rejected,
            _ => false
        };
        if (!allowed)
        {
            throw new CompanionContractException("journal-transition");
        }
    }

    private string? ResolveSourceConversionIntentSha256(
        CompanionOperationRecord current,
        CompanionOperationState nextState,
        CompanionAcquisitionBranch branch,
        string? supplied)
    {
        if (current.SourceConversionIntentSha256 is not null)
        {
            if (supplied is not null && supplied != current.SourceConversionIntentSha256)
            {
                throw new CompanionContractException("journal-source-conversion-intent-immutable");
            }
            return current.SourceConversionIntentSha256;
        }
        if (supplied is null)
        {
            return null;
        }
        CompanionContract.RequireDigest(supplied, "journal-source-conversion-intent-digest");
        if (current.State != CompanionOperationState.AcquiringSource ||
            nextState != CompanionOperationState.Converting ||
            branch != CompanionAcquisitionBranch.Source)
        {
            throw new CompanionContractException("journal-source-conversion-intent-transition");
        }
        var persisted = ReadSourceConversionIntent(current.OperationId);
        if (persisted.Sha256 != supplied)
        {
            throw new CompanionContractException("journal-source-conversion-intent-identity");
        }
        return supplied;
    }

    private static void ValidateRecordFields(
        CompanionOperationState state,
        CompanionAcquisitionBranch branch,
        ulong completedBytes,
        ulong? totalBytes,
        CompanionArtifactSet? artifacts,
        string? errorCode,
        string? sourceConversionIntentSha256)
    {
        if (completedBytes > CompanionContract.MaximumProgressBytes ||
            totalBytes > CompanionContract.MaximumProgressBytes ||
            totalBytes is ulong total && (total == 0 || completedBytes > total))
        {
            throw new CompanionContractException("journal-progress");
        }
        if (state == CompanionOperationState.Available)
        {
            CompanionContract.ValidateArtifactSet(
                artifacts ?? throw new CompanionContractException("journal-artifacts-required"));
            if (branch is not (CompanionAcquisitionBranch.Peer or CompanionAcquisitionBranch.Source) ||
                errorCode is not null)
            {
                throw new CompanionContractException("journal-available-fields");
            }
        }
        else if (artifacts is not null)
        {
            throw new CompanionContractException("journal-artifacts-premature");
        }
        if (state == CompanionOperationState.Rejected)
        {
            if (!IsErrorCode(errorCode))
            {
                throw new CompanionContractException("journal-rejection-code");
            }
        }
        else if (errorCode is not null)
        {
            throw new CompanionContractException("journal-unexpected-error");
        }

        if (sourceConversionIntentSha256 is not null)
        {
            CompanionContract.RequireDigest(
                sourceConversionIntentSha256,
                "journal-source-conversion-intent-digest");
            if (branch != CompanionAcquisitionBranch.Source ||
                state is not (CompanionOperationState.Converting or
                    CompanionOperationState.VerifyingComposition or
                    CompanionOperationState.Available or
                    CompanionOperationState.Cancelled or
                    CompanionOperationState.Rejected))
            {
                throw new CompanionContractException("journal-source-conversion-intent-fields");
            }
        }
        else if (branch == CompanionAcquisitionBranch.Source &&
            state is CompanionOperationState.Converting or
                CompanionOperationState.VerifyingComposition or
                CompanionOperationState.Available)
        {
            throw new CompanionContractException("journal-source-conversion-intent-required");
        }
    }

    private CompanionOperationRecord ReadRecord(string path, string operationId)
    {
        var bytes = ReadBoundedRegularFile(
            path,
            "journal-record-file",
            "journal-record-read");

        CompanionOperationRecord record;
        try
        {
            CompanionStrictJson.RejectDuplicateProperties(bytes, "journal-record-json");
            record = JsonSerializer.Deserialize<CompanionOperationRecord>(bytes, JsonOptions)
                ?? throw new CompanionContractException("journal-record-json");
        }
        catch (JsonException)
        {
            throw new CompanionContractException("journal-record-json");
        }
        if (record.Schema != CompanionContract.OperationRecordSchema ||
            record.OperationId != operationId)
        {
            throw new CompanionContractException("journal-record-contract");
        }
        try
        {
            CompanionContract.RequireDigest(record.RequestSha256, "journal-record-contract");
            ValidateRecordFields(
                record.State,
                record.Branch,
                record.CompletedBytes,
                record.TotalBytes,
                record.Artifacts,
                record.ErrorCode,
                record.SourceConversionIntentSha256);
        }
        catch (CompanionContractException)
        {
            throw new CompanionContractException("journal-record-contract");
        }
        if (!bytes.AsSpan().SequenceEqual(Serialize(record)))
        {
            throw new CompanionContractException("journal-record-canonical");
        }
        return record;
    }

    private CompanionOperationRecord ReadExistingOperation(
        string operationId,
        ReadOnlySpan<byte> expectedRequest)
    {
        var directory = RequireOperationDirectory(operationId);
        var request = ReadBoundedRegularFile(
            Path.Combine(directory, "request.json"),
            "journal-request-file",
            "journal-request-file");
        if (!request.AsSpan().SequenceEqual(expectedRequest) || Sha256(request) != operationId)
        {
            throw new CompanionContractException("journal-operation-conflict");
        }
        try
        {
            _ = CompanionLoopbackWire.DecodeAcquireRequest(request);
        }
        catch (CompanionProtocolException)
        {
            throw new CompanionContractException("journal-operation-conflict");
        }
        var record = ReadRecord(Path.Combine(directory, "current.json"), operationId);
        if (record.RequestSha256 != operationId)
        {
            throw new CompanionContractException("journal-operation-conflict");
        }
        return record;
    }

    private static byte[] ReadBoundedRegularFile(
        string path,
        string validationCode,
        string ioCode)
    {
        try
        {
            var info = new FileInfo(path);
            if (!info.Exists || info.Length is <= 0 or > MaximumRecordBytes ||
                (info.Attributes & FileAttributes.ReparsePoint) != 0)
            {
                throw new CompanionContractException(validationCode);
            }
            using var stream = new FileStream(
                path,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                MaximumRecordBytes,
                FileOptions.SequentialScan);
            var length = stream.Length;
            if (length is <= 0 or > MaximumRecordBytes)
            {
                throw new CompanionContractException(validationCode);
            }
            var bytes = new byte[checked((int)length)];
            stream.ReadExactly(bytes);
            if (stream.Position != length || stream.Length != length)
            {
                throw new CompanionContractException(validationCode);
            }
            return bytes;
        }
        catch (IOException)
        {
            throw new CompanionContractException(ioCode);
        }
    }

    private string OperationDirectory(string operationId) => Path.Combine(_operationsRoot, operationId);

    private string RequireOperationDirectory(string operationId)
    {
        var directory = OperationDirectory(operationId);
        if (!Directory.Exists(directory) || File.Exists(directory) ||
            (File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0)
        {
            throw new CompanionContractException("journal-operation-missing");
        }
        return directory;
    }

    private void DeleteOwnedStagingDirectory(string path)
    {
        var full = Path.GetFullPath(path);
        if (!string.Equals(Path.GetDirectoryName(full), _operationsRoot, StringComparison.Ordinal) ||
            !Path.GetFileName(full).StartsWith(".staging-", StringComparison.Ordinal) ||
            (File.GetAttributes(full) & FileAttributes.ReparsePoint) != 0)
        {
            throw new CompanionContractException("journal-staging-ownership");
        }
        Directory.Delete(full, recursive: true);
    }

    private string Timestamp() => _timeProvider.GetUtcNow().ToString("O");

    private static FileStream AcquireProcessLock(string path)
    {
        try
        {
            return new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None, 1,
                FileOptions.WriteThrough);
        }
        catch (IOException)
        {
            throw new CompanionContractException("journal-operation-busy");
        }
    }

    private static void ReplaceCurrent(string path, byte[] bytes)
    {
        var temporary = Path.Combine(
            Path.GetDirectoryName(path)!,
            $".current-{Guid.NewGuid():N}.tmp");
        WriteCreateOnly(temporary, bytes);
        try
        {
            File.Move(temporary, path, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporary))
            {
                File.Delete(temporary);
            }
        }
    }

    private static void WriteCreateOnly(string path, byte[] bytes)
    {
        using var stream = new FileStream(
            path,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            65_536,
            FileOptions.WriteThrough);
        stream.Write(bytes);
        stream.Flush(flushToDisk: true);
    }

    private static byte[] Serialize<T>(T value)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value, JsonOptions);
        if (bytes.Length is 0 or > MaximumRecordBytes)
        {
            throw new CompanionContractException("journal-record-size");
        }
        return bytes;
    }

    private static string RequireOwnedRoot(string value)
    {
        var root = FullPath(value, nameof(value));
        if (!Directory.Exists(root))
        {
            throw new CompanionContractException("journal-root-missing");
        }
        RejectReparsePoint(root, "journal-root-reparse");
        var marker = Path.Combine(root, MarkerFileName);
        if (!File.Exists(marker) || File.ReadAllText(marker, Encoding.ASCII) != CompanionContract.OwnedRootMarker)
        {
            throw new CompanionContractException("journal-root-marker");
        }
        return root;
    }

    private static string FullPath(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        if (value.IndexOf('\0', StringComparison.Ordinal) >= 0)
        {
            throw new ArgumentException("The path contains an embedded NUL.", parameterName);
        }
        return Path.GetFullPath(value);
    }

    private static void RejectReparsePoint(string path, string code)
    {
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
        {
            throw new CompanionContractException(code);
        }
    }

    private static void RequireOperationId(string value)
    {
        CompanionContract.RequireDigest(value, "journal-operation-id");
    }

    private static bool IsErrorCode(string? value) =>
        value is { Length: >= 3 and <= 64 } &&
        value[0] is >= 'a' and <= 'z' &&
        value.All(character => character is (>= 'a' and <= 'z') or
            (>= '0' and <= '9') or '-');

    private static string SequenceFile(ulong sequence) => $"{sequence:D20}.json";

    private static string Sha256(byte[] bytes) =>
        Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes)).ToLowerInvariant();

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        AllowTrailingCommas = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        ReadCommentHandling = JsonCommentHandling.Disallow,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        WriteIndented = false,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower, allowIntegerValues: false) }
    };
}
