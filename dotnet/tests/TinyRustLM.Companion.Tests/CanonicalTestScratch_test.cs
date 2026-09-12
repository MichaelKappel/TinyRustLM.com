using Xunit;

namespace TinyRustLM.Companion.Tests;

public sealed class CanonicalTestScratch_test
{
    /// <summary>Fixture data stays canonical and disappears after an idempotent owned cleanup.</summary>
    [Fact]
    public void OwnsCanonicalDataAndRemovesNestedOutput()
    {
        var scratch = new CanonicalTestScratch("ownership");
        var container = Directory.GetParent(scratch.Path)!.FullName;
        Assert.StartsWith(@"E:\Source\Rust\TinyRustLM.com\artifacts\companion-tests\", scratch.Path);
        Assert.False(Directory.Exists(scratch.Path));
        Directory.CreateDirectory(System.IO.Path.Combine(scratch.Path, "nested"));
        File.WriteAllText(System.IO.Path.Combine(scratch.Path, "nested", "output.txt"), "synthetic");
        scratch.Dispose();
        scratch.Dispose();
        Assert.False(Directory.Exists(container));
    }

    /// <summary>A changed owner cannot authorize cleanup; restore the test's marker before disposal.</summary>
    [Fact]
    public void RefusesChangedOwnershipWithoutDeletingData()
    {
        using var scratch = new CanonicalTestScratch("owner-drift");
        var marker = System.IO.Path.Combine(Directory.GetParent(scratch.Path)!.FullName, ".fixture-owner");
        var owner = File.ReadAllText(marker);
        try
        {
            File.WriteAllText(marker, new string('0', owner.Length));
            Assert.Throws<IOException>(scratch.Dispose);
            Assert.True(File.Exists(marker));
        }
        finally { File.WriteAllText(marker, owner); }
    }

    /// <summary>Removing a fixture link must preserve its separately owned target.</summary>
    [Fact]
    public void UnlinksNestedDirectoryWithoutFollowingItsTarget()
    {
        using var target = new CanonicalTestScratch("link-target");
        Directory.CreateDirectory(target.Path);
        var sentinel = System.IO.Path.Combine(target.Path, "keep.txt");
        File.WriteAllText(sentinel, "synthetic target");
        var linked = new CanonicalTestScratch("link-owner");
        Directory.CreateDirectory(linked.Path);
        Directory.CreateSymbolicLink(System.IO.Path.Combine(linked.Path, "link"), target.Path);
        linked.Dispose();
        Assert.Equal("synthetic target", File.ReadAllText(sentinel));
    }

    /// <summary>A label cannot escape or repurpose the fixed canonical fixture directory.</summary>
    [Theory]
    [InlineData("")]
    [InlineData("../outside")]
    [InlineData("UPPER")]
    [InlineData("a/b")]
    public void RejectsInvalidLabels(string label) =>
        Assert.Throws<ArgumentException>(() => new CanonicalTestScratch(label));
}
