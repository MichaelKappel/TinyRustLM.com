using TinyRustLM;

namespace TinyRustLM.CompositionInspector;

internal static class Program
{
    private const int BufferBytes = 65_536;

    public static int Main(string[] args)
    {
        var result = Execute(args);
        Console.OpenStandardOutput().Write(result.Stdout);
        Console.OpenStandardError().Write(result.Stderr);
        return result.ExitCode;
    }

    private static TinyRustLmCompositionInspectionCommandResult Execute(string[] args)
    {
        if (args is not ["inspect", var suppliedPath])
        {
            return TinyRustLmCompositionInspectionCommand.Failure(
                "managed-inspection-arguments");
        }

        try
        {
            if (!Path.IsPathFullyQualified(suppliedPath))
            {
                return TinyRustLmCompositionInspectionCommand.Failure(
                    "managed-inspection-intent-path");
            }

            var intentPath = Path.GetFullPath(suppliedPath);
            if (!string.Equals(intentPath, suppliedPath, StringComparison.Ordinal))
            {
                return TinyRustLmCompositionInspectionCommand.Failure(
                    "managed-inspection-intent-path");
            }

            var info = new FileInfo(intentPath);
            if (!info.Exists ||
                info.Length is <= 0 or > TinyRustLmCompositionInspectionCommand.MaximumIntentBytes ||
                (info.Attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)
            {
                return TinyRustLmCompositionInspectionCommand.Failure(
                    "managed-inspection-intent-file");
            }

            var bytes = new byte[checked((int)info.Length)];
            using var stream = new FileStream(
                intentPath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                BufferBytes,
                FileOptions.SequentialScan);
            stream.ReadExactly(bytes);
            if (stream.Position != info.Length || stream.Length != info.Length)
            {
                return TinyRustLmCompositionInspectionCommand.Failure(
                    "managed-inspection-intent-drift");
            }

            return TinyRustLmCompositionInspectionCommand.Execute(bytes);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            return TinyRustLmCompositionInspectionCommand.Failure("managed-inspection-io");
        }
    }
}
