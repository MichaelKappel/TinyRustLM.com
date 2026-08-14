using System.Buffers;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;

namespace TinyRustLM.PackageCanonicalizer;

public sealed record CanonicalPackageResult(
    string Name,
    long ByteCount,
    string Sha256,
    int EntryCount,
    string EntryTimestampUtc);

public sealed class PackageCanonicalizationException : Exception
{
    public PackageCanonicalizationException(string code, string message, Exception? innerException = null)
        : base(message, innerException)
    {
        Code = code;
    }

    public string Code { get; }
}

public static class NuGetPackageCanonicalizer
{
    public const string CanonicalEntryTimestampUtc = "1980-01-01T00:00:00Z";
    public const int MaxEntryCount = 4_096;
    public const int MaxEntryNameUtf8Bytes = 1_024;
    public const long MaxEntryByteCount = 1L * 1_024 * 1_024 * 1_024;
    public const long MaxPackageByteCount = 2L * 1_024 * 1_024 * 1_024;
    public const long MaxTotalUncompressedByteCount = 4L * 1_024 * 1_024 * 1_024;

    private const int CopyBufferByteCount = 1 * 1_024 * 1_024;
    private static readonly DateTimeOffset CanonicalTimestamp =
        new(1980, 1, 1, 0, 0, 0, TimeSpan.Zero);
    private static readonly char[] ForbiddenPortableCharacters = ['<', '>', ':', '"', '|', '?', '*'];

    public static CanonicalPackageResult Canonicalize(string packagePath)
    {
        try
        {
            return CanonicalizeCore(packagePath);
        }
        catch (PackageCanonicalizationException)
        {
            throw;
        }
        catch (UnauthorizedAccessException exception)
        {
            throw Failure("package_access_denied", "Package access was denied.", exception);
        }
        catch (InvalidDataException exception)
        {
            throw Failure("package_zip_invalid", "The package is not a valid supported ZIP archive.", exception);
        }
        catch (IOException exception)
        {
            throw Failure("package_io_failure", "A package file operation failed.", exception);
        }
        catch (ArgumentException exception)
        {
            throw Failure("package_path_invalid", "The package path is invalid.", exception);
        }
        catch (NotSupportedException exception)
        {
            throw Failure("package_operation_unsupported", "The package operation is unsupported.", exception);
        }
        catch (OverflowException exception)
        {
            throw Failure("package_size_limit_exceeded", "Package size arithmetic exceeded its bound.", exception);
        }
    }

    private static CanonicalPackageResult CanonicalizeCore(string packagePath)
    {
        var fullPath = ValidatePackagePath(packagePath);
        var sourceInfo = new FileInfo(fullPath);
        ValidatePackageSize(sourceInfo.Length);

        var sourceManifest = ReadArchiveManifest(fullPath);
        var sourceSha256 = ComputeFileSha256(fullPath);
        if (sourceManifest.AllTimestampsCanonical)
        {
            return CreateResult(fullPath, sourceSha256, sourceManifest.Entries.Length);
        }

        var parentPath = sourceInfo.DirectoryName
            ?? throw Failure("package_parent_missing", "The package parent directory is unavailable.");
        var temporaryPath = Path.Combine(
            parentPath,
            $".tinyrustlm-canonical-{Guid.NewGuid():N}.tmp");
        var temporaryExists = false;

        try
        {
            using (var temporaryStream = new FileStream(
                       temporaryPath,
                       FileMode.CreateNew,
                       FileAccess.Write,
                       FileShare.None,
                       CopyBufferByteCount,
                       FileOptions.SequentialScan))
            {
                temporaryExists = true;
                CopyFileBounded(fullPath, temporaryStream, sourceInfo.Length);
            }

            var copiedSha256 = ComputeFileSha256(temporaryPath);
            if (!string.Equals(sourceSha256, copiedSha256, StringComparison.Ordinal))
            {
                throw Failure("package_source_changed", "The package changed while it was copied.");
            }

            RewriteEntryTimestamps(temporaryPath);
            var canonicalManifest = ReadArchiveManifest(temporaryPath);
            if (!canonicalManifest.AllTimestampsCanonical)
            {
                throw Failure(
                    "package_timestamp_canonicalization_failed",
                    "One or more package timestamps were not canonicalized.");
            }

            if (!ContentManifestsEqual(sourceManifest, canonicalManifest))
            {
                throw Failure(
                    "package_content_changed",
                    "Package content changed during timestamp canonicalization.");
            }

            var canonicalSha256 = ComputeFileSha256(temporaryPath);
            var currentSourceInfo = new FileInfo(fullPath);
            if (currentSourceInfo.Length != sourceInfo.Length ||
                !string.Equals(ComputeFileSha256(fullPath), sourceSha256, StringComparison.Ordinal))
            {
                throw Failure(
                    "package_source_changed",
                    "The package changed before canonical promotion.");
            }

            File.Move(temporaryPath, fullPath, overwrite: true);
            temporaryExists = false;

            var promotedManifest = ReadArchiveManifest(fullPath);
            var promotedSha256 = ComputeFileSha256(fullPath);
            if (!promotedManifest.AllTimestampsCanonical ||
                !ContentManifestsEqual(canonicalManifest, promotedManifest) ||
                !string.Equals(canonicalSha256, promotedSha256, StringComparison.Ordinal))
            {
                throw Failure(
                    "package_promotion_verification_failed",
                    "The promoted canonical package failed readback verification.");
            }

            return CreateResult(fullPath, promotedSha256, promotedManifest.Entries.Length);
        }
        finally
        {
            if (temporaryExists && File.Exists(temporaryPath))
            {
                File.Delete(temporaryPath);
            }
        }
    }

    private static string ValidatePackagePath(string packagePath)
    {
        if (string.IsNullOrWhiteSpace(packagePath) || !Path.IsPathFullyQualified(packagePath))
        {
            throw Failure(
                "package_path_not_absolute",
                "A fully qualified package path is required.");
        }

        var fullPath = Path.GetFullPath(packagePath);
        var extension = Path.GetExtension(fullPath);
        if (!string.Equals(extension, ".nupkg", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(extension, ".snupkg", StringComparison.OrdinalIgnoreCase))
        {
            throw Failure(
                "package_extension_unsupported",
                "Only .nupkg and .snupkg files are supported.");
        }

        if (!File.Exists(fullPath))
        {
            throw Failure("package_file_missing", "The package file does not exist.");
        }

        var fileAttributes = File.GetAttributes(fullPath);
        if ((fileAttributes & FileAttributes.ReparsePoint) != 0 ||
            (fileAttributes & FileAttributes.Directory) != 0)
        {
            throw Failure(
                "package_file_not_regular",
                "The package path must name a regular non-reparse file.");
        }

        var parent = Directory.GetParent(fullPath)
            ?? throw Failure("package_parent_missing", "The package parent directory is unavailable.");
        var parentAttributes = File.GetAttributes(parent.FullName);
        if ((parentAttributes & FileAttributes.ReparsePoint) != 0)
        {
            throw Failure(
                "package_parent_reparse_forbidden",
                "The package parent directory must not be a reparse point.");
        }

        return fullPath;
    }

    private static void ValidatePackageSize(long byteCount)
    {
        if (byteCount <= 0 || byteCount > MaxPackageByteCount)
        {
            throw Failure(
                "package_size_limit_exceeded",
                "The package byte count is outside the supported bound.");
        }
    }

    private static ArchiveManifest ReadArchiveManifest(string path)
    {
        using var stream = new FileStream(
            path,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            CopyBufferByteCount,
            FileOptions.SequentialScan);
        ValidatePackageSize(stream.Length);
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: false);

        if (archive.Entries.Count == 0 || archive.Entries.Count > MaxEntryCount)
        {
            throw Failure(
                "package_entry_count_limit_exceeded",
                "The package entry count is outside the supported bound.");
        }

        var exactNames = new HashSet<string>(StringComparer.Ordinal);
        var portableNames = new HashSet<string>(StringComparer.Ordinal);
        var entries = new ArchiveEntryManifest[archive.Entries.Count];
        var allTimestampsCanonical = true;
        long totalUncompressedByteCount = 0;

        for (var index = 0; index < archive.Entries.Count; index++)
        {
            var entry = archive.Entries[index];
            var portableName = ValidateEntryName(entry.FullName);
            if (!exactNames.Add(entry.FullName))
            {
                throw Failure(
                    "package_entry_duplicate",
                    "The package contains a duplicate entry name.");
            }

            if (!portableNames.Add(portableName))
            {
                throw Failure(
                    "package_entry_portable_duplicate",
                    "The package contains entry names that collide on a portable file system.");
            }

            if (entry.FullName.Split('/').Any(segment =>
                    string.Equals(segment, ".signature.p7s", StringComparison.OrdinalIgnoreCase)))
            {
                throw Failure(
                    "package_signed_archive_forbidden",
                    "Signed packages cannot be rewritten.");
            }

            if (entry.Length < 0 || entry.Length > MaxEntryByteCount ||
                entry.CompressedLength < 0 || entry.CompressedLength > MaxPackageByteCount)
            {
                throw Failure(
                    "package_entry_size_limit_exceeded",
                    "A package entry is outside the supported size bound.");
            }

            totalUncompressedByteCount = checked(totalUncompressedByteCount + entry.Length);
            if (totalUncompressedByteCount > MaxTotalUncompressedByteCount)
            {
                throw Failure(
                    "package_total_size_limit_exceeded",
                    "The package uncompressed byte count exceeds the supported bound.");
            }

            var contentSha256 = ComputeEntrySha256(entry);
            entries[index] = new ArchiveEntryManifest(
                entry.FullName,
                entry.Length,
                entry.CompressedLength,
                entry.ExternalAttributes,
                contentSha256);
            allTimestampsCanonical &= IsCanonicalTimestamp(entry.LastWriteTime);
        }

        return new ArchiveManifest(entries, totalUncompressedByteCount, allTimestampsCanonical);
    }

    private static string ValidateEntryName(string name)
    {
        if (string.IsNullOrEmpty(name) ||
            Encoding.UTF8.GetByteCount(name) > MaxEntryNameUtf8Bytes)
        {
            throw Failure(
                "package_entry_name_invalid",
                "A package entry name is empty or exceeds the supported UTF-8 bound.");
        }

        if (!name.IsNormalized(NormalizationForm.FormC) ||
            name[0] is '/' or '\\' ||
            name.Contains('\\') ||
            name.IndexOfAny(ForbiddenPortableCharacters) >= 0 ||
            name.Any(character => character == '\0' || char.IsControl(character) || char.IsSurrogate(character)))
        {
            throw Failure(
                "package_entry_name_invalid",
                "A package entry name is not in the supported portable profile.");
        }

        var segments = name.Split('/', StringSplitOptions.None);
        foreach (var segment in segments)
        {
            if (segment.Length == 0 || segment is "." or ".." ||
                segment.EndsWith(' ') || segment.EndsWith('.') || IsReservedWindowsName(segment))
            {
                throw Failure(
                    "package_entry_path_unsafe",
                    "A package entry path is unsafe or nonportable.");
            }
        }

        return name.ToUpperInvariant();
    }

    private static bool IsReservedWindowsName(string segment)
    {
        var stem = segment.Split('.', 2)[0];
        if (string.Equals(stem, "CON", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(stem, "PRN", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(stem, "AUX", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(stem, "NUL", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return stem.Length == 4 &&
            (stem.StartsWith("COM", StringComparison.OrdinalIgnoreCase) ||
             stem.StartsWith("LPT", StringComparison.OrdinalIgnoreCase)) &&
            stem[3] is >= '1' and <= '9';
    }

    private static string ComputeEntrySha256(ZipArchiveEntry entry)
    {
        using var stream = entry.Open();
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buffer = ArrayPool<byte>.Shared.Rent(64 * 1_024);
        long byteCount = 0;

        try
        {
            while (true)
            {
                var read = stream.Read(buffer, 0, buffer.Length);
                if (read == 0)
                {
                    break;
                }

                byteCount = checked(byteCount + read);
                if (byteCount > MaxEntryByteCount || byteCount > entry.Length)
                {
                    throw Failure(
                        "package_entry_size_mismatch",
                        "A package entry expanded beyond its declared size.");
                }

                hash.AppendData(buffer, 0, read);
            }
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer, clearArray: true);
        }

        if (byteCount != entry.Length)
        {
            throw Failure(
                "package_entry_size_mismatch",
                "A package entry byte count did not match its declaration.");
        }

        return Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
    }

    private static void CopyFileBounded(
        string sourcePath,
        FileStream destination,
        long expectedByteCount)
    {
        using var source = new FileStream(
            sourcePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            CopyBufferByteCount,
            FileOptions.SequentialScan);
        var buffer = ArrayPool<byte>.Shared.Rent(CopyBufferByteCount);
        long copiedByteCount = 0;

        try
        {
            while (true)
            {
                var read = source.Read(buffer, 0, buffer.Length);
                if (read == 0)
                {
                    break;
                }

                copiedByteCount = checked(copiedByteCount + read);
                if (copiedByteCount > MaxPackageByteCount || copiedByteCount > expectedByteCount)
                {
                    throw Failure(
                        "package_source_changed",
                        "The package grew while it was copied.");
                }

                destination.Write(buffer, 0, read);
            }
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer, clearArray: true);
        }

        if (copiedByteCount != expectedByteCount)
        {
            throw Failure(
                "package_source_changed",
                "The package byte count changed while it was copied.");
        }

        destination.Flush(flushToDisk: true);
    }

    private static void RewriteEntryTimestamps(string path)
    {
        using var stream = new FileStream(
            path,
            FileMode.Open,
            FileAccess.ReadWrite,
            FileShare.None,
            CopyBufferByteCount,
            FileOptions.RandomAccess);
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Update, leaveOpen: true))
        {
            if (archive.Entries.Count == 0 || archive.Entries.Count > MaxEntryCount)
            {
                throw Failure(
                    "package_entry_count_limit_exceeded",
                    "The package entry count is outside the supported bound.");
            }

            foreach (var entry in archive.Entries)
            {
                entry.LastWriteTime = CanonicalTimestamp;
            }
        }

        stream.Flush(flushToDisk: true);
    }

    private static bool ContentManifestsEqual(ArchiveManifest first, ArchiveManifest second) =>
        first.TotalUncompressedByteCount == second.TotalUncompressedByteCount &&
        first.Entries.AsSpan().SequenceEqual(second.Entries);

    private static bool IsCanonicalTimestamp(DateTimeOffset timestamp) =>
        timestamp.Year == 1980 &&
        timestamp.Month == 1 &&
        timestamp.Day == 1 &&
        timestamp.Hour == 0 &&
        timestamp.Minute == 0 &&
        timestamp.Second == 0;

    private static string ComputeFileSha256(string path)
    {
        using var stream = new FileStream(
            path,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            CopyBufferByteCount,
            FileOptions.SequentialScan);
        ValidatePackageSize(stream.Length);
        return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
    }

    private static CanonicalPackageResult CreateResult(string path, string sha256, int entryCount) =>
        new(
            Path.GetFileName(path),
            new FileInfo(path).Length,
            sha256,
            entryCount,
            CanonicalEntryTimestampUtc);

    private static PackageCanonicalizationException Failure(
        string code,
        string message,
        Exception? innerException = null) =>
        new(code, message, innerException);

    private sealed record ArchiveManifest(
        ArchiveEntryManifest[] Entries,
        long TotalUncompressedByteCount,
        bool AllTimestampsCanonical);

    private sealed record ArchiveEntryManifest(
        string Name,
        long ByteCount,
        long CompressedByteCount,
        int ExternalAttributes,
        string ContentSha256);

}
