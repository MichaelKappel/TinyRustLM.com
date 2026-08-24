using System.Text;
using System.Text.Json;

namespace TinyRustLM.Companion;

public static class CompanionLoopbackWire
{
    public const string InstallationSchema = "tinyrustlm.companion.installation.v1";
    public const int MaximumInstallationRecordBytes = 4_096;

    private static readonly UTF8Encoding StrictUtf8 = new(
        encoderShouldEmitUTF8Identifier: false,
        throwOnInvalidBytes: true);

    public static byte[] EncodeInstallationRecordFile(CompanionInstallationRecord record)
    {
        ValidateInstallationRecord(record);
        using var stream = new MemoryStream(capacity: 128);
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions
        {
            Indented = false,
            SkipValidation = false
        }))
        {
            writer.WriteStartObject();
            writer.WriteString("schema", record.Schema);
            writer.WriteString("installationId", record.InstallationId);
            writer.WriteEndObject();
        }
        stream.WriteByte((byte)'\n');
        var bytes = stream.ToArray();
        if (bytes.Length > MaximumInstallationRecordBytes)
        {
            throw new CompanionProtocolException("installation-record-size");
        }
        return bytes;
    }

    public static CompanionInstallationRecord DecodeInstallationRecordFile(
        ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length is < 2 or > MaximumInstallationRecordBytes || bytes[^1] != (byte)'\n')
        {
            throw new CompanionProtocolException("installation-record-wire");
        }

        string text;
        try
        {
            text = StrictUtf8.GetString(bytes[..^1]);
        }
        catch (DecoderFallbackException)
        {
            throw new CompanionProtocolException("installation-record-wire");
        }

        CompanionInstallationRecord record;
        try
        {
            using var document = JsonDocument.Parse(text, new JsonDocumentOptions
            {
                AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow,
                MaxDepth = 16
            });
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                throw new CompanionProtocolException("installation-record-wire");
            }
            var properties = document.RootElement.EnumerateObject().ToArray();
            if (properties.Length != 2 ||
                properties[0].Name != "schema" ||
                properties[1].Name != "installationId" ||
                properties[0].Value.ValueKind != JsonValueKind.String ||
                properties[1].Value.ValueKind != JsonValueKind.String)
            {
                throw new CompanionProtocolException("installation-record-wire");
            }
            record = new CompanionInstallationRecord(
                properties[0].Value.GetString()!,
                properties[1].Value.GetString()!);
        }
        catch (JsonException)
        {
            throw new CompanionProtocolException("installation-record-wire");
        }

        ValidateInstallationRecord(record);
        var canonical = EncodeInstallationRecordFile(record);
        if (!bytes.SequenceEqual(canonical))
        {
            throw new CompanionProtocolException("installation-record-canonical");
        }
        return record;
    }

    private static void ValidateInstallationRecord(CompanionInstallationRecord record)
    {
        ArgumentNullException.ThrowIfNull(record);
        if (record.Schema != InstallationSchema)
        {
            throw new CompanionProtocolException("installation-record-schema");
        }
        CompanionLoopbackProtocol.RequireHexIdentifier(
            record.InstallationId,
            16,
            "installation-record-id");
    }
}

public sealed record CompanionInstallationRecord(string Schema, string InstallationId);
