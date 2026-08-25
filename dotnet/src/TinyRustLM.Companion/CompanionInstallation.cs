using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;

namespace TinyRustLM.Companion;

internal interface ICompanionCryptographicRandom
{
    void Fill(Span<byte> destination);
}

public sealed record CompanionInstallationIdentity(
    string RootPath,
    string InstallationId,
    string ProcessInstanceId);

public static class CompanionInstallation
{
    public const string RecordFileName = "installation.json";

    private const UnixFileMode LinuxRootMode =
        UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute;
    private const UnixFileMode LinuxFileMode =
        UnixFileMode.UserRead | UnixFileMode.UserWrite;

    public static CompanionInstallationIdentity OpenOrCreate(
        string rootPath) =>
        OpenOrCreate(rootPath, SystemCryptographicRandom.Instance);

    internal static CompanionInstallationIdentity OpenOrCreate(
        string rootPath,
        ICompanionCryptographicRandom random)
    {
        ArgumentNullException.ThrowIfNull(random);
        var root = RequireAbsoluteRoot(rootPath);
        if (File.Exists(root))
        {
            throw new CompanionProtocolException("installation-root-invalid");
        }

        if (!Directory.Exists(root))
        {
            CreateRoot(root);
        }
        else
        {
            RejectReparsePoint(root, "installation-root-invalid");
            ValidateRootSecurity(root);
        }

        var recordPath = Path.Combine(root, RecordFileName);
        CompanionInstallationRecord record;
        if (!File.Exists(recordPath))
        {
            if (Directory.EnumerateFileSystemEntries(root).Any())
            {
                throw new CompanionProtocolException(
                    "installation-record-missing-nonempty-root");
            }
            record = new CompanionInstallationRecord(
                CompanionLoopbackWire.InstallationSchema,
                CreateIdentifier(random, 16));
            WriteRecordCreateOnly(recordPath, record);
        }
        else
        {
            RejectReparsePoint(recordPath, "installation-record-file");
            record = CompanionLoopbackWire.DecodeInstallationRecordFile(
                ReadBoundedRecord(recordPath));
        }

        ValidateRecordSecurity(recordPath);
        return new CompanionInstallationIdentity(
            root,
            record.InstallationId,
            CreateIdentifier(random, 16));
    }

    private static string RequireAbsoluteRoot(string rootPath)
    {
        if (string.IsNullOrWhiteSpace(rootPath) || !Path.IsPathFullyQualified(rootPath))
        {
            throw new CompanionProtocolException("installation-root-invalid");
        }
        string root;
        try
        {
            root = Path.GetFullPath(rootPath);
        }
        catch (Exception exception) when (
            exception is ArgumentException or NotSupportedException or PathTooLongException)
        {
            throw new CompanionProtocolException("installation-root-invalid");
        }
        if (Path.GetPathRoot(root) == root)
        {
            throw new CompanionProtocolException("installation-root-invalid");
        }
        var parent = Path.GetDirectoryName(root);
        if (string.IsNullOrWhiteSpace(parent) || !Directory.Exists(parent))
        {
            throw new CompanionProtocolException("installation-root-parent");
        }
        RejectReparsePoint(parent, "installation-root-parent");
        return root;
    }

    private static void CreateRoot(string root)
    {
        try
        {
            if (OperatingSystem.IsWindows())
            {
                CreateWindowsRoot(root);
            }
            else if (OperatingSystem.IsLinux())
            {
                Directory.CreateDirectory(root, LinuxRootMode);
                File.SetUnixFileMode(root, LinuxRootMode);
            }
            else
            {
                throw new CompanionProtocolException("installation-platform-unsupported");
            }
            ValidateRootSecurity(root);
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

    [SupportedOSPlatform("windows")]
    private static void CreateWindowsRoot(string root)
    {
        var security = CreateWindowsRootSecurity();
        new DirectoryInfo(root).Create(security);
    }

    [SupportedOSPlatform("windows")]
    private static DirectorySecurity CreateWindowsRootSecurity()
    {
        var current = CurrentWindowsUser();
        var system = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
        var security = new DirectorySecurity();
        security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
        security.SetOwner(current);
        const InheritanceFlags inheritance =
            InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit;
        security.AddAccessRule(new FileSystemAccessRule(
            current,
            FileSystemRights.FullControl,
            inheritance,
            PropagationFlags.None,
            AccessControlType.Allow));
        security.AddAccessRule(new FileSystemAccessRule(
            system,
            FileSystemRights.FullControl,
            inheritance,
            PropagationFlags.None,
            AccessControlType.Allow));
        return security;
    }

    private static void WriteRecordCreateOnly(
        string recordPath,
        CompanionInstallationRecord record)
    {
        var bytes = CompanionLoopbackWire.EncodeInstallationRecordFile(record);
        var options = new FileStreamOptions
        {
            Mode = FileMode.CreateNew,
            Access = FileAccess.Write,
            Share = FileShare.None,
            Options = FileOptions.WriteThrough,
            BufferSize = 4096
        };
        if (OperatingSystem.IsLinux())
        {
            options.UnixCreateMode = LinuxFileMode;
        }
        try
        {
            using var stream = new FileStream(recordPath, options);
            stream.Write(bytes);
            stream.Flush(flushToDisk: true);
            if (OperatingSystem.IsLinux())
            {
                File.SetUnixFileMode(recordPath, LinuxFileMode);
            }
        }
        catch (IOException)
        {
            throw new CompanionProtocolException("installation-record-create");
        }
    }

    private static byte[] ReadBoundedRecord(string recordPath)
    {
        try
        {
            using var stream = new FileStream(
                recordPath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                4096,
                FileOptions.SequentialScan);
            if (stream.Length is < 1 or > CompanionLoopbackWire.MaximumInstallationRecordBytes)
            {
                throw new CompanionProtocolException("installation-record-wire");
            }
            var bytes = GC.AllocateUninitializedArray<byte>(checked((int)stream.Length));
            stream.ReadExactly(bytes);
            if (stream.ReadByte() != -1)
            {
                throw new CompanionProtocolException("installation-record-wire");
            }
            return bytes;
        }
        catch (CompanionProtocolException)
        {
            throw;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            throw new CompanionProtocolException("installation-record-file");
        }
    }

    private static void ValidateRootSecurity(string root)
    {
        if (OperatingSystem.IsWindows())
        {
            ValidateWindowsSecurity(new DirectoryInfo(root), requireProtected: true);
        }
        else if (OperatingSystem.IsLinux())
        {
            ValidateLinuxSecurity(root, LinuxRootMode);
        }
        else
        {
            throw new CompanionProtocolException("installation-platform-unsupported");
        }
    }

    private static void ValidateRecordSecurity(string recordPath)
    {
        if (OperatingSystem.IsWindows())
        {
            ValidateWindowsSecurity(new FileInfo(recordPath), requireProtected: false);
        }
        else if (OperatingSystem.IsLinux())
        {
            ValidateLinuxSecurity(recordPath, LinuxFileMode);
        }
        else
        {
            throw new CompanionProtocolException("installation-platform-unsupported");
        }
    }

    [SupportedOSPlatform("windows")]
    private static void ValidateWindowsSecurity(
        FileSystemInfo fileSystemInfo,
        bool requireProtected)
    {
        FileSystemSecurity security = fileSystemInfo switch
        {
            DirectoryInfo directory => directory.GetAccessControl(),
            FileInfo file => file.GetAccessControl(),
            _ => throw new CompanionProtocolException("installation-permissions")
        };
        var current = CurrentWindowsUser();
        var system = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
        if (!Equals(security.GetOwner(typeof(SecurityIdentifier)), current) ||
            (requireProtected && !security.AreAccessRulesProtected))
        {
            throw new CompanionProtocolException("installation-permissions");
        }

        var currentFullControl = false;
        var systemFullControl = false;
        foreach (FileSystemAccessRule rule in security.GetAccessRules(
                     includeExplicit: true,
                     includeInherited: true,
                     targetType: typeof(SecurityIdentifier)))
        {
            if (rule.IdentityReference is not SecurityIdentifier identity ||
                rule.AccessControlType != AccessControlType.Allow ||
                (rule.FileSystemRights & FileSystemRights.FullControl) !=
                FileSystemRights.FullControl)
            {
                throw new CompanionProtocolException("installation-permissions");
            }
            if (identity.Equals(current))
            {
                currentFullControl = true;
            }
            else if (identity.Equals(system))
            {
                systemFullControl = true;
            }
            else
            {
                throw new CompanionProtocolException("installation-permissions");
            }
        }
        if (!currentFullControl || !systemFullControl)
        {
            throw new CompanionProtocolException("installation-permissions");
        }
    }

    [SupportedOSPlatform("windows")]
    private static SecurityIdentifier CurrentWindowsUser() =>
        WindowsIdentity.GetCurrent().User ??
        throw new CompanionProtocolException("installation-owner");

    [SupportedOSPlatform("linux")]
    private static void ValidateLinuxSecurity(string path, UnixFileMode expectedMode)
    {
        if (File.GetUnixFileMode(path) != expectedMode || LinuxOwner(path) != GetEffectiveUserId())
        {
            throw new CompanionProtocolException("installation-permissions");
        }
    }

    [SupportedOSPlatform("linux")]
    private static uint LinuxOwner(string path)
    {
        var buffer = Marshal.AllocHGlobal(256);
        try
        {
            if (Statx(-100, path, 0x100, 0x7ff, buffer) != 0)
            {
                throw new CompanionProtocolException("installation-owner");
            }
            return unchecked((uint)Marshal.ReadInt32(buffer, 20));
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    private static string CreateIdentifier(ICompanionCryptographicRandom random, int bytes)
    {
        Span<byte> value = stackalloc byte[bytes];
        try
        {
            random.Fill(value);
            return Convert.ToHexString(value).ToLowerInvariant();
        }
        finally
        {
            CryptographicOperations.ZeroMemory(value);
        }
    }

    private static void RejectReparsePoint(string path, string code)
    {
        try
        {
            if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
            {
                throw new CompanionProtocolException(code);
            }
        }
        catch (CompanionProtocolException)
        {
            throw;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            throw new CompanionProtocolException(code);
        }
    }

    [DllImport("libc", EntryPoint = "geteuid")]
    [SupportedOSPlatform("linux")]
    private static extern uint GetEffectiveUserId();

    [DllImport("libc", EntryPoint = "statx", SetLastError = true)]
    [SupportedOSPlatform("linux")]
    private static extern int Statx(
        int directoryFileDescriptor,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string path,
        int flags,
        uint mask,
        IntPtr buffer);

    private sealed class SystemCryptographicRandom : ICompanionCryptographicRandom
    {
        internal static readonly SystemCryptographicRandom Instance = new();

        public void Fill(Span<byte> destination) => RandomNumberGenerator.Fill(destination);
    }
}
