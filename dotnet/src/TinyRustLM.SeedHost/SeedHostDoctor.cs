using System.Security.Cryptography;

namespace TinyRustLM.SeedHost;

/// <summary>Reviewed local dependency and boundary diagnostics.</summary>
public sealed record SeedHostDoctorReport(
    string RuntimeIdentifier,
    uint NativeAbiVersion,
    uint SupportedNativeAbiVersion,
    string MiniModelExecutablePath,
    string MiniModelExecutableSha256,
    bool ProjectServerServesModelBytes,
    bool ProjectServerRunsModelBytes,
    bool ProjectServerProxiesModelBytes,
    bool Ready);

/// <summary>Checks packaged native components without opening listeners or changing fleet state.</summary>
public sealed class SeedHostDoctor
{
    private readonly IMiniModelAuthority authority;

    /// <summary>Create a diagnostic runner over the loaded MiniModel authority.</summary>
    public SeedHostDoctor(IMiniModelAuthority authority)
    {
        ArgumentNullException.ThrowIfNull(authority);
        this.authority = authority;
    }

    /// <summary>Resolve and hash the reviewed CLI, then verify the exact native ABI version.</summary>
    public SeedHostDoctorReport Run(string? miniModelExecutablePath = null)
    {
        var abiVersion = authority.NativeAbiVersion;
        if (abiVersion != MiniModelAuthority.SupportedNativeAbiVersion)
        {
            throw new SeedHostException(
                "native_abi_mismatch",
                $"MiniModel native ABI {abiVersion} is incompatible with required ABI {MiniModelAuthority.SupportedNativeAbiVersion}.");
        }
        var executable = MiniModelExecutableLocator.Resolve(miniModelExecutablePath);
        using var stream = new FileStream(
            executable,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            128 * 1024,
            FileOptions.SequentialScan);
        var digest = Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
        return new SeedHostDoctorReport(
            MiniModelNativeMethods.RuntimeIdentifier(),
            abiVersion,
            MiniModelAuthority.SupportedNativeAbiVersion,
            executable,
            $"sha256:{digest}",
            ProjectServerServesModelBytes: false,
            ProjectServerRunsModelBytes: false,
            ProjectServerProxiesModelBytes: false,
            Ready: true);
    }
}
