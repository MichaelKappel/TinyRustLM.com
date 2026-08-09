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
    internal static extern IntPtr tinyrustlm_sdk_version_json();

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_sdk_capabilities_json();

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern void tinyrustlm_string_free(IntPtr ptr);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_slm_inspect_path_json(IntPtr path);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_runtime_create_json();

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern int tinyrustlm_runtime_destroy(ulong handle);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_runtime_load_model_path_json(
        ulong handle,
        IntPtr path,
        IntPtr expectedSha256);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_runtime_activate_composition_path_json(
        ulong handle,
        IntPtr path,
        IntPtr expectedSha256);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_runtime_unload_model_json(ulong handle);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_runtime_generate_json(
        ulong handle,
        IntPtr prompt,
        uint maxNewTokens,
        double temperature,
        uint topK,
        double topP,
        uint seed);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_runtime_step_json(ulong handle);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_runtime_reset_json(ulong handle);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_runtime_diagnostics_json(ulong handle);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_p2p_prepare_share_kit_json(IntPtr requestJson);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_p2p_inspect_manifest_json(IntPtr manifestJson);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_p2p_verify_signed_manifest_json(
        IntPtr signedManifestJson,
        IntPtr publicKeyJson);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_p2p_import_from_manifest_json(IntPtr manifestJson);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_p2p_assemble_from_manifest_json(
        IntPtr manifestJson,
        IntPtr shareKitRoot,
        IntPtr outputPath);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_p2p_inspect_local_import_receipt_json(
        IntPtr receiptJson,
        IntPtr outputPath);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_p2p_export_share_metadata_json(IntPtr manifestJson);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_p2p_validate_announcement_json(IntPtr announcementJson);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_p2p_apply_received_announcement_json(
        IntPtr announcementJson,
        IntPtr existingCatalogJson);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_p2p_inspect_announcement_catalog_json(IntPtr catalogJson);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_memory_required_files_json(IntPtr requestJson);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_memory_supported_setups_json();

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_memory_inspect_package_path_json(
        IntPtr packagePath,
        IntPtr requestJson);

    [DllImport(LibraryName, CallingConvention = CallingConvention.Cdecl)]
    internal static extern IntPtr tinyrustlm_memory_inspect_manifest_json(IntPtr manifestJson);

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
        var env = Environment.GetEnvironmentVariable("TINYRUSTLM_NATIVE_PATH");
        if (!string.IsNullOrWhiteSpace(env))
        {
            yield return Directory.Exists(env) ? Path.Combine(env, fileName) : env;
        }

        var baseDir = AppContext.BaseDirectory;
        yield return Path.Combine(baseDir, fileName);
        yield return Path.Combine(baseDir, "runtimes", RuntimeIdentifier(), "native", fileName);

        var assemblyDir = Path.GetDirectoryName(assembly.Location);
        if (!string.IsNullOrWhiteSpace(assemblyDir))
        {
            yield return Path.Combine(assemblyDir, fileName);
            yield return Path.Combine(assemblyDir, "runtimes", RuntimeIdentifier(), "native", fileName);
        }

        var current = new DirectoryInfo(baseDir);
        for (var i = 0; i < 8 && current is not null; i++, current = current.Parent)
        {
            yield return Path.Combine(current.FullName, "artifacts", "native", RuntimeIdentifier(), fileName);
            yield return Path.Combine(current.FullName, "..", "..", "..", "artifacts", "native", RuntimeIdentifier(), fileName);
        }
    }

    private static string RuntimeIdentifier()
    {
        var arch = RuntimeInformation.ProcessArchitecture switch
        {
            Architecture.Arm64 => "arm64",
            Architecture.X64 => "x64",
            _ => "x64"
        };
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return $"win-{arch}";
        }
        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
        {
            return $"osx-{arch}";
        }
        return $"linux-{arch}";
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
        return "libtinyrustlm_native.so";
    }
}
