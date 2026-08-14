using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using TinyRustLM.PackageCanonicalizer;
using Xunit;

namespace TinyRustLM.Package.Tests;

public sealed class NuGetPackageCanonicalizerTests
{
    [Fact]
    public void TimestampDriftCanonicalizesToOneByteIdentity()
    {
        using var temporary = new TemporaryDirectory();
        var first = Path.Combine(temporary.Path, "first.nupkg");
        var second = Path.Combine(temporary.Path, "second.nupkg");
        WritePackage(first, new DateTimeOffset(2026, 1, 2, 3, 4, 6, TimeSpan.Zero));
        WritePackage(second, new DateTimeOffset(2026, 7, 8, 9, 10, 12, TimeSpan.Zero));
        Assert.NotEqual(Sha256(first), Sha256(second));

        var firstResult = NuGetPackageCanonicalizer.Canonicalize(first);
        var secondResult = NuGetPackageCanonicalizer.Canonicalize(second);

        Assert.Equal(firstResult.Sha256, secondResult.Sha256);
        Assert.Equal(Sha256(first), Sha256(second));
        Assert.Equal(NuGetPackageCanonicalizer.CanonicalEntryTimestampUtc, firstResult.EntryTimestampUtc);
        Assert.Equal(3, firstResult.EntryCount);
        AssertCanonicalTimestamps(first);
        AssertCanonicalTimestamps(second);
    }

    [Fact]
    public void CanonicalizationIsIdempotentAndPreservesContent()
    {
        using var temporary = new TemporaryDirectory();
        var package = Path.Combine(temporary.Path, "content.snupkg");
        WritePackage(package, new DateTimeOffset(2026, 2, 3, 4, 5, 6, TimeSpan.Zero));
        var contentBefore = ReadContentManifest(package);

        var first = NuGetPackageCanonicalizer.Canonicalize(package);
        var firstBytes = File.ReadAllBytes(package);
        var second = NuGetPackageCanonicalizer.Canonicalize(package);

        Assert.Equal(first, second);
        Assert.Equal(firstBytes, File.ReadAllBytes(package));
        Assert.Equal(contentBefore, ReadContentManifest(package));
        Assert.Empty(Directory.EnumerateFiles(temporary.Path, ".tinyrustlm-canonical-*.tmp"));
    }

    [Fact]
    public void AlreadyCanonicalPackageIsNotRewritten()
    {
        using var temporary = new TemporaryDirectory();
        var package = Path.Combine(temporary.Path, "canonical.nupkg");
        WritePackage(package, new DateTimeOffset(1980, 1, 1, 0, 0, 0, TimeSpan.Zero));
        var before = File.ReadAllBytes(package);

        var result = NuGetPackageCanonicalizer.Canonicalize(package);

        Assert.Equal(before, File.ReadAllBytes(package));
        Assert.Equal(Sha256(package), result.Sha256);
        Assert.Empty(Directory.EnumerateFiles(temporary.Path, ".tinyrustlm-canonical-*.tmp"));
    }

    [Fact]
    public void SignedPackageIsRejectedWithoutMutation()
    {
        using var temporary = new TemporaryDirectory();
        var package = Path.Combine(temporary.Path, "signed.nupkg");
        WritePackage(
            package,
            new DateTimeOffset(2026, 2, 3, 4, 5, 6, TimeSpan.Zero),
            (".signature.p7s", "not-a-real-signature"));
        var before = File.ReadAllBytes(package);

        var error = Assert.Throws<PackageCanonicalizationException>(
            () => NuGetPackageCanonicalizer.Canonicalize(package));

        Assert.Equal("package_signed_archive_forbidden", error.Code);
        Assert.Equal(before, File.ReadAllBytes(package));
    }

    [Fact]
    public void UnsafePortableDuplicateIsRejectedWithoutMutation()
    {
        using var temporary = new TemporaryDirectory();
        var package = Path.Combine(temporary.Path, "duplicate.nupkg");
        WritePackage(
            package,
            new DateTimeOffset(2026, 2, 3, 4, 5, 6, TimeSpan.Zero),
            ("docs/README.md", "duplicate"));
        var before = File.ReadAllBytes(package);

        var error = Assert.Throws<PackageCanonicalizationException>(
            () => NuGetPackageCanonicalizer.Canonicalize(package));

        Assert.Equal("package_entry_portable_duplicate", error.Code);
        Assert.Equal(before, File.ReadAllBytes(package));
    }

    [Theory]
    [InlineData("../escape.txt", "package_entry_path_unsafe")]
    [InlineData("docs\\escape.txt", "package_entry_name_invalid")]
    [InlineData("docs/CON.txt", "package_entry_path_unsafe")]
    public void UnsafeEntryPathIsRejectedWithoutMutation(string entryName, string expectedCode)
    {
        using var temporary = new TemporaryDirectory();
        var package = Path.Combine(temporary.Path, "unsafe.nupkg");
        WritePackage(
            package,
            new DateTimeOffset(2026, 2, 3, 4, 5, 6, TimeSpan.Zero),
            (entryName, "unsafe"));
        var before = File.ReadAllBytes(package);

        var error = Assert.Throws<PackageCanonicalizationException>(
            () => NuGetPackageCanonicalizer.Canonicalize(package));

        Assert.Equal(expectedCode, error.Code);
        Assert.Equal(before, File.ReadAllBytes(package));
        Assert.Empty(Directory.EnumerateFiles(temporary.Path, ".tinyrustlm-canonical-*.tmp"));
    }

    [Fact]
    public void RelativePackagePathIsRejected()
    {
        var error = Assert.Throws<PackageCanonicalizationException>(
            () => NuGetPackageCanonicalizer.Canonicalize("relative.nupkg"));

        Assert.Equal("package_path_not_absolute", error.Code);
    }

    [Fact]
    public void UnsupportedExtensionIsRejectedWithoutMutation()
    {
        using var temporary = new TemporaryDirectory();
        var package = Path.Combine(temporary.Path, "package.zip");
        WritePackage(package, new DateTimeOffset(2026, 2, 3, 4, 5, 6, TimeSpan.Zero));
        var before = File.ReadAllBytes(package);

        var error = Assert.Throws<PackageCanonicalizationException>(
            () => NuGetPackageCanonicalizer.Canonicalize(package));

        Assert.Equal("package_extension_unsupported", error.Code);
        Assert.Equal(before, File.ReadAllBytes(package));
    }

    [Fact]
    public void EntryCountAboveBoundIsRejectedWithoutMutation()
    {
        using var temporary = new TemporaryDirectory();
        var package = Path.Combine(temporary.Path, "too-many.nupkg");
        using (var stream = new FileStream(package, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None))
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: false))
        {
            for (var index = 0; index <= NuGetPackageCanonicalizer.MaxEntryCount; index++)
            {
                var entry = archive.CreateEntry($"entries/{index:D4}.txt", CompressionLevel.NoCompression);
                entry.LastWriteTime = new DateTimeOffset(2026, 2, 3, 4, 5, 6, TimeSpan.Zero);
            }
        }
        var before = File.ReadAllBytes(package);

        var error = Assert.Throws<PackageCanonicalizationException>(
            () => NuGetPackageCanonicalizer.Canonicalize(package));

        Assert.Equal("package_entry_count_limit_exceeded", error.Code);
        Assert.Equal(before, File.ReadAllBytes(package));
    }

    private static void WritePackage(
        string path,
        DateTimeOffset timestamp,
        params (string Name, string Content)[] additionalEntries)
    {
        using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None);
        using var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: false);
        var entries = new[]
        {
            ("package.nuspec", "<package />"),
            ("docs/readme.md", "documentation"),
            ("lib/net8.0/package.dll", "deterministic-fixture")
        }.Concat(additionalEntries);
        foreach (var (name, content) in entries)
        {
            var entry = archive.CreateEntry(name, CompressionLevel.Optimal);
            entry.LastWriteTime = timestamp;
            using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
            writer.Write(content);
        }
    }

    private static string[] ReadContentManifest(string path)
    {
        using var archive = ZipFile.OpenRead(path);
        return archive.Entries.Select(entry =>
        {
            using var stream = entry.Open();
            return $"{entry.FullName}:{entry.Length}:{Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant()}";
        }).ToArray();
    }

    private static void AssertCanonicalTimestamps(string path)
    {
        using var archive = ZipFile.OpenRead(path);
        Assert.All(archive.Entries, entry =>
        {
            Assert.Equal(1980, entry.LastWriteTime.Year);
            Assert.Equal(1, entry.LastWriteTime.Month);
            Assert.Equal(1, entry.LastWriteTime.Day);
            Assert.Equal(0, entry.LastWriteTime.Hour);
            Assert.Equal(0, entry.LastWriteTime.Minute);
            Assert.Equal(0, entry.LastWriteTime.Second);
        });
    }

    private static string Sha256(string path) =>
        Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path))).ToLowerInvariant();

    private sealed class TemporaryDirectory : IDisposable
    {
        public TemporaryDirectory()
        {
            Path = System.IO.Path.Combine(
                System.IO.Path.GetTempPath(),
                $"tinyrustlm-package-canonicalizer-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Path);
        }

        public string Path { get; }

        public void Dispose()
        {
            try
            {
                Directory.Delete(Path, recursive: true);
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
        }
    }
}
