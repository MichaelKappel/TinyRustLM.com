using System.Reflection;

namespace TinyRustLM.Companion.Tests;

/// <summary>Owns bounded non-product fixtures beneath the single canonical repository.</summary>
internal sealed class CanonicalTestScratch : IDisposable
{
    private const string CanonicalRoot = @"E:\Source\Rust\TinyRustLM.com";
    private readonly string _container;
    private readonly string _owner = Guid.NewGuid().ToString("N");
    private bool _disposed;

    /// <summary>Creates an owned container while leaving its test-data path initially absent.</summary>
    internal CanonicalTestScratch(string label)
    {
        if (string.IsNullOrEmpty(label) || label.Length > 40 || label.Any(character =>
            character is not (>= 'a' and <= 'z') and not (>= '0' and <= '9') and not '-'))
        {
            throw new ArgumentException("Scratch label must be a bounded lowercase name.", nameof(label));
        }
        if (!OperatingSystem.IsWindows() ||
            !AppContext.BaseDirectory.StartsWith(CanonicalRoot + "\\", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Native fixtures require the canonical Windows repository.");
        }
        AssertDirectAncestry(CanonicalRoot);
        var parent = System.IO.Path.Combine(CanonicalRoot, "artifacts", "companion-tests");
        AssertCreatableAncestry(parent);
        Directory.CreateDirectory(parent);
        AssertDirectAncestry(parent);
        _container = System.IO.Path.Combine(parent, $"{label}-{_owner}");
        if (Directory.Exists(_container) || File.Exists(_container))
        {
            throw new IOException("Scratch container is already occupied.");
        }
        Directory.CreateDirectory(_container);
        File.WriteAllText(System.IO.Path.Combine(_container, ".fixture-owner"), _owner);
        Path = System.IO.Path.Combine(_container, "data");
    }

    internal string Path { get; }

    /// <summary>Resolves a declared fixture from this build's generated binding, never a guessed old output.</summary>
    internal static string FixtureExecutable(string project)
    {
        var assembly = typeof(CanonicalTestScratch).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>()
            .Single(attribute => attribute.Key == $"TinyRustLM.Fixture.{project}").Value
            ?? throw new InvalidOperationException("Fixture assembly binding is missing.");
        if (!System.IO.Path.IsPathFullyQualified(assembly) ||
            !assembly.StartsWith(CanonicalRoot + "\\", StringComparison.OrdinalIgnoreCase) ||
            System.IO.Path.GetFileName(assembly) != project + ".dll")
        {
            throw new InvalidOperationException("Fixture assembly binding is outside canonical output.");
        }
        var directory = System.IO.Path.GetDirectoryName(assembly)!;
        AssertDirectAncestry(directory);
        var executable = System.IO.Path.Combine(directory, project + ".exe");
        var file = new FileInfo(executable);
        if (!file.Exists || file.Length == 0 || (file.Attributes & FileAttributes.ReparsePoint) != 0)
        {
            throw new IOException("Bound fixture executable is missing or linked.");
        }
        return executable;
    }

    /// <summary>Rejects linked or non-directory ancestors, including the drive and source roots.</summary>
    private static void AssertDirectAncestry(string directory)
    {
        for (var cursor = new DirectoryInfo(directory); cursor is not null; cursor = cursor.Parent)
        {
            cursor.Refresh();
            if (!cursor.Exists || (cursor.Attributes & FileAttributes.ReparsePoint) != 0)
            {
                throw new IOException("Scratch directory ancestry is unsafe.");
            }
        }
    }

    /// <summary>Checks existing parents before creating a missing canonical artifact directory.</summary>
    private static void AssertCreatableAncestry(string directory)
    {
        var cursor = directory;
        while (!Directory.Exists(cursor))
        {
            if (File.Exists(cursor)) throw new IOException("Scratch parent is not a directory.");
            cursor = System.IO.Path.GetDirectoryName(cursor)
                ?? throw new IOException("Scratch parent is unavailable.");
        }
        AssertDirectAncestry(cursor);
    }

    /// <summary>Checks ownership and a complete bounded inventory before removing only this container.</summary>
    public void Dispose()
    {
        if (_disposed) return;
        AssertDirectAncestry(_container);
        var marker = new FileInfo(System.IO.Path.Combine(_container, ".fixture-owner"));
        if (!marker.Exists || (marker.Attributes & FileAttributes.ReparsePoint) != 0 ||
            marker.Length != _owner.Length || File.ReadAllText(marker.FullName) != _owner)
        {
            throw new IOException("Scratch ownership marker changed.");
        }
        var entries = new List<FileSystemInfo>();
        var pending = new Stack<(DirectoryInfo Directory, int Depth)>();
        pending.Push((new DirectoryInfo(_container), 0));
        while (pending.TryPop(out var current))
        {
            if (current.Depth > 64) throw new IOException("Scratch depth exceeds its bound.");
            foreach (var entry in current.Directory.EnumerateFileSystemInfos())
            {
                if (!entry.FullName.StartsWith(_container + "\\", StringComparison.OrdinalIgnoreCase) ||
                    entries.Count >= 16384)
                {
                    throw new IOException("Scratch inventory exceeds its boundary.");
                }
                entries.Add(entry);
                if (entry is DirectoryInfo child && (entry.Attributes & FileAttributes.ReparsePoint) == 0)
                {
                    pending.Push((child, current.Depth + 1));
                }
            }
        }
        // Reverse traversal removes children first; directory links are unlinked without recursion.
        for (var index = entries.Count - 1; index >= 0; index--)
        {
            var entry = entries[index];
            if (entry is DirectoryInfo) Directory.Delete(entry.FullName, recursive: false);
            else File.Delete(entry.FullName);
        }
        Directory.Delete(_container, recursive: false);
        if (Directory.Exists(_container)) throw new IOException("Scratch cleanup is incomplete.");
        _disposed = true;
    }
}
