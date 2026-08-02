using System.Reflection;
using System.Runtime.InteropServices;

namespace TinyRustLM.SeedHost;

internal static class MiniModelNativeMethods
{
    internal const string LibraryName = "minimodel_native";

    static MiniModelNativeMethods()
    {
        NativeLibrary.SetDllImportResolver(
            typeof(MiniModelNativeMethods).Assembly,
            ResolveNativeLibrary);
    }

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern uint minimodel_native_abi_version();

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr minimodel_native_invoke_json(IntPtr requestJson);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern void minimodel_native_string_free(IntPtr ptr);

    /// <summary>Resolve only reviewed RID-native MiniModel libraries.</summary>
    private static IntPtr ResolveNativeLibrary(
        string libraryName,
        Assembly assembly,
        DllImportSearchPath? searchPath)
    {
        if (!string.Equals(libraryName, LibraryName, StringComparison.Ordinal))
        {
            return IntPtr.Zero;
        }
        foreach (var candidate in NativeLibraryCandidates(assembly))
        {
            if (File.Exists(candidate))
            {
                // Preserve loader diagnostics when an expected file exists but has the wrong
                // architecture or an unavailable native dependency.
                return NativeLibrary.Load(candidate);
            }
        }
        return IntPtr.Zero;
    }

    /// <summary>Enumerate explicit package, output, and opt-in development locations.</summary>
    private static IEnumerable<string> NativeLibraryCandidates(Assembly assembly)
    {
        var fileName = NativeLibraryFileName();
        var configured = Environment.GetEnvironmentVariable("MINIMODEL_NATIVE_PATH");
        if (!string.IsNullOrWhiteSpace(configured))
        {
            yield return Directory.Exists(configured)
                ? Path.Combine(configured, fileName)
                : configured;
        }
        var rid = RuntimeIdentifier();
        var baseDirectory = AppContext.BaseDirectory;
        yield return Path.Combine(baseDirectory, fileName);
        yield return Path.Combine(baseDirectory, "runtimes", rid, "native", fileName);
        var assemblyDirectory = Path.GetDirectoryName(assembly.Location);
        if (!string.IsNullOrWhiteSpace(assemblyDirectory))
        {
            yield return Path.Combine(assemblyDirectory, fileName);
            yield return Path.Combine(assemblyDirectory, "runtimes", rid, "native", fileName);
        }
        var current = new DirectoryInfo(baseDirectory);
        for (var depth = 0; depth < 8 && current is not null; depth++, current = current.Parent)
        {
            yield return Path.Combine(
                current.FullName,
                "artifacts",
                "seed-host-native",
                rid,
                fileName);
        }
    }

    /// <summary>Return the runtime identifier used by package-native assets.</summary>
    internal static string RuntimeIdentifier()
    {
        var architecture = RuntimeInformation.ProcessArchitecture switch
        {
            Architecture.Arm64 => "arm64",
            Architecture.X64 => "x64",
            _ => throw new PlatformNotSupportedException(
                $"MiniModel does not support {RuntimeInformation.ProcessArchitecture}.")
        };
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return $"win-{architecture}";
        }
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
        {
            return $"linux-{architecture}";
        }
        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
        {
            return $"osx-{architecture}";
        }
        throw new PlatformNotSupportedException("MiniModel does not support this operating system.");
    }

    /// <summary>Return the platform-native MiniModel library file name.</summary>
    private static string NativeLibraryFileName()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return "minimodel_native.dll";
        }
        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
        {
            return "libminimodel_native.dylib";
        }
        return "libminimodel_native.so";
    }
}
