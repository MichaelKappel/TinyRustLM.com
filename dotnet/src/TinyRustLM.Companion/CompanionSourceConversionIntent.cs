using System.Text.Json;
using System.Text.Json.Serialization;
using TinyRustLM;

namespace TinyRustLM.Companion;

/// <summary>Private create-only binding from one acquisition operation to one conversion intent.</summary>
public sealed record CompanionSourceConversionIntent(
    string Schema,
    string OperationId,
    string RequestSha256,
    TinyRustLmCompositionConversionIntent Conversion);

/// <summary>Canonical private intent bytes and the digest bound into operation history.</summary>
public sealed record CompanionPersistedSourceConversionIntent(
    CompanionSourceConversionIntent Intent,
    string Sha256);

internal static class CompanionSourceConversionIntentCodec
{
    internal const int MaximumBytes = 65_536;

    internal static byte[] Serialize(CompanionSourceConversionIntent value)
    {
        Validate(value);
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions
        {
            Indented = false,
            SkipValidation = false
        }))
        {
            writer.WriteStartObject();
            writer.WriteString("schema", value.Schema);
            writer.WriteString("operationId", value.OperationId);
            writer.WriteString("requestSha256", value.RequestSha256);
            writer.WriteStartObject("conversion");
            writer.WriteString("schema", value.Conversion.Schema);
            writer.WriteString("modelSourceLockPath", value.Conversion.ModelSourceLockPath);
            writer.WriteString("modelSourceLockSha256", value.Conversion.ModelSourceLockSha256);
            writer.WriteString("modelSourceDirectory", value.Conversion.ModelSourceDirectory);
            writer.WriteString("tokenizerSourceLockPath", value.Conversion.TokenizerSourceLockPath);
            writer.WriteString(
                "tokenizerSourceLockSha256",
                value.Conversion.TokenizerSourceLockSha256);
            writer.WriteString("tokenizerSourceDirectory", value.Conversion.TokenizerSourceDirectory);
            writer.WriteString(
                "compositionProfileSha256",
                value.Conversion.CompositionProfileSha256);
            writer.WriteString("outputRoot", value.Conversion.OutputRoot);
            writer.WriteString(
                "converterExecutablePath",
                value.Conversion.ConverterExecutablePath);
            writer.WriteString(
                "converterExecutableSha256",
                value.Conversion.ConverterExecutableSha256);
            writer.WriteNumber(
                "maximumDurationMilliseconds",
                value.Conversion.MaximumDurationMilliseconds);
            writer.WriteNumber("maximumSummaryBytes", value.Conversion.MaximumSummaryBytes);
            writer.WriteNumber("maximumErrorBytes", value.Conversion.MaximumErrorBytes);
            writer.WriteString("terminalRule", value.Conversion.TerminalRule);
            writer.WriteEndObject();
            writer.WriteEndObject();
        }
        stream.WriteByte((byte)'\n');
        if (stream.Length is 0 or > MaximumBytes)
        {
            throw new CompanionContractException("journal-source-conversion-intent-size");
        }
        return stream.ToArray();
    }

    internal static CompanionSourceConversionIntent DeserializeCanonical(byte[] bytes)
    {
        if (bytes.Length is 0 or > MaximumBytes)
        {
            throw new CompanionContractException("journal-source-conversion-intent-size");
        }
        CompanionSourceConversionIntent value;
        try
        {
            CompanionStrictJson.RejectDuplicateProperties(
                bytes,
                "journal-source-conversion-intent-json");
            value = JsonSerializer.Deserialize<CompanionSourceConversionIntent>(bytes, JsonOptions)
                ?? throw new CompanionContractException(
                    "journal-source-conversion-intent-json");
        }
        catch (JsonException)
        {
            throw new CompanionContractException("journal-source-conversion-intent-json");
        }
        Validate(value);
        if (!bytes.AsSpan().SequenceEqual(Serialize(value)))
        {
            throw new CompanionContractException("journal-source-conversion-intent-canonical");
        }
        return value;
    }

    internal static void Validate(CompanionSourceConversionIntent value)
    {
        ArgumentNullException.ThrowIfNull(value);
        if (value.Schema != CompanionContract.SourceConversionIntentSchema)
        {
            throw new CompanionContractException("journal-source-conversion-intent-schema");
        }
        CompanionContract.RequireDigest(
            value.OperationId,
            "journal-source-conversion-intent-operation");
        CompanionContract.RequireDigest(
            value.RequestSha256,
            "journal-source-conversion-intent-request");
        if (value.Conversion is null)
        {
            throw new CompanionContractException("journal-source-conversion-intent-contract");
        }
        try
        {
            TinyRustLmConversionTool.ValidateCompositionIntent(value.Conversion);
        }
        catch (TinyRustLmException)
        {
            throw new CompanionContractException("journal-source-conversion-intent-contract");
        }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        AllowTrailingCommas = false,
        PropertyNameCaseInsensitive = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        ReadCommentHandling = JsonCommentHandling.Disallow,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower, false) }
    };
}
