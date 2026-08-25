using System.Text.Json;
using System.Text.Json.Serialization;

namespace TinyRustLM;

internal sealed record TinyRustLmCompositionInspectionCommandResult(
    int ExitCode,
    byte[] Stdout,
    byte[] Stderr);

internal static class TinyRustLmCompositionInspectionCommand
{
    internal const string ResultSchema =
        "tinyrustlm.qwen3-composition-managed-inspection.v1";
    internal const string ErrorSchema =
        "tinyrustlm.qwen3-composition-managed-inspection-error.v1";
    internal const int MaximumIntentBytes = 65_536;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        AllowTrailingCommas = false,
        MaxDepth = 64,
        PropertyNameCaseInsensitive = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        ReadCommentHandling = JsonCommentHandling.Disallow,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        WriteIndented = true
    };

    internal static TinyRustLmCompositionInspectionCommandResult Execute(
        ReadOnlySpan<byte> intentBytes)
    {
        if (intentBytes.IsEmpty || intentBytes.Length > MaximumIntentBytes)
        {
            return Failure("managed-inspection-intent-size");
        }

        TinyRustLmCompositionConversionIntent intent;
        try
        {
            intent = JsonSerializer.Deserialize<TinyRustLmCompositionConversionIntent>(
                intentBytes,
                JsonOptions) ?? throw new JsonException();
        }
        catch (JsonException)
        {
            return Failure("managed-inspection-intent-json");
        }

        var canonicalIntent = Serialize(intent);
        if (!intentBytes.SequenceEqual(canonicalIntent))
        {
            return Failure("managed-inspection-intent-canonical");
        }

        try
        {
            TinyRustLmConversionTool.ValidateCompositionIntent(intent);
            var inspection = TinyRustLmConversionTool.InspectCompositionTerminal(intent);
            return inspection.Status switch
            {
                TinyRustLmCompositionTerminalStatus.Pass => Success(
                    0,
                    "pass",
                    inspection.Composition,
                    null),
                TinyRustLmCompositionTerminalStatus.Rejected => Success(
                    2,
                    "rejected",
                    null,
                    inspection.ErrorCode),
                TinyRustLmCompositionTerminalStatus.Pending => Success(
                    3,
                    "pending",
                    null,
                    null),
                _ => Failure("managed-inspection-status")
            };
        }
        catch (TinyRustLmException error)
        {
            return Failure(error.Code);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            return Failure("managed-inspection-io");
        }
    }

    internal static TinyRustLmCompositionInspectionCommandResult Failure(string code) =>
        new(1, [], Serialize(new InspectionError(ErrorSchema, "error", code)));

    internal static byte[] SerializeIntent(TinyRustLmCompositionConversionIntent intent) =>
        Serialize(intent);

    private static TinyRustLmCompositionInspectionCommandResult Success(
        int exitCode,
        string status,
        TinyRustLmVerifiedComposition? composition,
        string? errorCode) =>
        new(
            exitCode,
            Serialize(new InspectionResult(
                ResultSchema,
                status,
                composition,
                errorCode,
                "read-only-no-converter-launch")),
            []);

    private static byte[] Serialize<T>(T value)
    {
        var platformJson = JsonSerializer.Serialize(value, JsonOptions);
        var canonicalJson = platformJson.Replace("\r\n", "\n", StringComparison.Ordinal);
        return System.Text.Encoding.UTF8.GetBytes($"{canonicalJson}\n");
    }

    private sealed record InspectionResult(
        string Schema,
        string Status,
        TinyRustLmVerifiedComposition? Composition,
        string? ErrorCode,
        string Operation);

    private sealed record InspectionError(
        string Schema,
        string Status,
        string Code);
}
