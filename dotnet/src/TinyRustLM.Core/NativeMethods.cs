using System.Reflection;
using System.Runtime.InteropServices;

namespace TinyRustLM;

internal static class NativeMethods
{
    internal const string LibraryName = "tinyrustlm_native";

    static NativeMethods()
    {
        NativeLibrary.SetDllImportResolver(typeof(NativeMethods).Assembly, ResolveNativeLibrary);
    }

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_native_contract_json();

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern void tinyrustlm_string_free(IntPtr pointer);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_slm2_inspect_json(
        [In] byte[] request,
        nuint requestLength);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_runtime_create_json(
        [In] byte[] request,
        nuint requestLength,
        [In] byte[] operation,
        nuint operationLength,
        ulong transcriptRevision);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_runtime_destroy_json(ulong handle);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_runtime_state_json(ulong handle);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_runtime_activate_json(
        ulong handle,
        [In] byte[] request,
        nuint requestLength,
        [In] byte[] expectedOperation,
        nuint expectedOperationLength);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_runtime_advance_operation_json(
        ulong handle,
        [In] byte[] expectedCurrent,
        nuint expectedCurrentLength,
        [In] byte[] next,
        nuint nextLength);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_runtime_set_transcript_json(
        ulong handle,
        ulong transcriptRevision);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_runtime_begin_request_json(
        ulong handle,
        [In] byte[] request,
        nuint requestLength,
        [In] byte[] expectedOperation,
        nuint expectedOperationLength);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_runtime_step_json(ulong handle, byte cancelled);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_runtime_finish_json(ulong handle);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_p2p_prepare_share_kit_json(
        [In] byte[] request,
        nuint requestLength);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_p2p_inspect_manifest_json(
        [In] byte[] manifest,
        nuint manifestLength);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories | DllImportSearchPath.AssemblyDirectory)]
    internal static extern IntPtr tinyrustlm_p2p_assemble_json(
        [In] byte[] request,
        nuint requestLength,
        [In] byte[] manifest,
        nuint manifestLength);

    private static IntPtr ResolveNativeLibrary(
        string libraryName,
        Assembly assembly,
        DllImportSearchPath? searchPath)
    {
        _ = searchPath;
        if (!string.Equals(libraryName, LibraryName, StringComparison.Ordinal))
        {
            return IntPtr.Zero;
        }

        var configuredPath = Environment.GetEnvironmentVariable("TINYRUSTLM_NATIVE_PATH");
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            var exactPath = Directory.Exists(configuredPath)
                ? Path.Combine(configuredPath, NativeLibraryFileName())
                : configuredPath;
            if (!File.Exists(exactPath) || !NativeLibrary.TryLoad(exactPath, out var configuredHandle))
            {
                throw new DllNotFoundException("TINYRUSTLM_NATIVE_PATH does not identify a loadable current native library.");
            }

            return configuredHandle;
        }

        foreach (var candidate in NativeLibraryCandidates(assembly))
        {
            if (File.Exists(candidate) && NativeLibrary.TryLoad(candidate, out var handle))
            {
                return handle;
            }
        }

        return IntPtr.Zero;
    }

    private static IEnumerable<string> NativeLibraryCandidates(Assembly assembly)
    {
        var fileName = NativeLibraryFileName();
        var runtimeIdentifier = RuntimeIdentifier();
        var baseDirectory = AppContext.BaseDirectory;
        yield return Path.Combine(baseDirectory, fileName);
        yield return Path.Combine(baseDirectory, "runtimes", runtimeIdentifier, "native", fileName);

        var assemblyDirectory = Path.GetDirectoryName(assembly.Location);
        if (!string.IsNullOrWhiteSpace(assemblyDirectory) &&
            !string.Equals(assemblyDirectory, baseDirectory, StringComparison.OrdinalIgnoreCase))
        {
            yield return Path.Combine(assemblyDirectory, fileName);
            yield return Path.Combine(assemblyDirectory, "runtimes", runtimeIdentifier, "native", fileName);
        }
    }

    internal static string RuntimeIdentifier()
    {
        if (!Environment.Is64BitProcess)
        {
            throw new PlatformNotSupportedException("TinyRustLM requires a 64-bit process.");
        }

        var architecture = RuntimeInformation.ProcessArchitecture switch
        {
            Architecture.X64 => "x64",
            Architecture.Arm64 => "arm64",
            _ => throw new PlatformNotSupportedException("TinyRustLM supports only x64 and arm64 processes.")
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

        throw new PlatformNotSupportedException("TinyRustLM supports Windows, Linux, and macOS.");
    }

    private static string NativeLibraryFileName()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return "tinyrustlm_native.dll";
        }

        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
        {
            return "libtinyrustlm_native.dylib";
        }

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
        {
            return "libtinyrustlm_native.so";
        }

        throw new PlatformNotSupportedException("TinyRustLM supports Windows, Linux, and macOS.");
    }
}
