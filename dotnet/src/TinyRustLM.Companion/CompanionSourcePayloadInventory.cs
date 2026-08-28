using System.Security.Cryptography;
using System.Text.Json;

namespace TinyRustLM.Companion;

internal sealed record CompanionSourcePayloadMember(
    string Path,
    ulong ByteLength,
    string Sha256);

internal static class CompanionSourcePayloadInventory
{
    internal static string ComputeSha256(IEnumerable<CompanionSourcePayloadMember> members)
    {
        ArgumentNullException.ThrowIfNull(members);
        var ordered = members
            .OrderBy(static member => member.Path, StringComparer.Ordinal)
            .ToArray();
        if ((uint)ordered.Length != CompanionSourceDescriptor.FileCount)
        {
            throw new CompanionContractException("source-payload-inventory-count");
        }

        var paths = new HashSet<string>(StringComparer.Ordinal);
        ulong payloadBytes = 0;
        foreach (var member in ordered)
        {
            if (string.IsNullOrEmpty(member.Path) ||
                member.Path.Length > 255 ||
                member.Path != System.IO.Path.GetFileName(member.Path) ||
                member.Path.Contains('\0') ||
                !paths.Add(member.Path))
            {
                throw new CompanionContractException("source-payload-inventory-path");
            }
            if (member.ByteLength == 0)
            {
                throw new CompanionContractException("source-payload-inventory-size");
            }
            CompanionContract.RequireDigest(member.Sha256, "source-payload-inventory-member");
            try
            {
                payloadBytes = checked(payloadBytes + member.ByteLength);
            }
            catch (OverflowException)
            {
                throw new CompanionContractException("source-payload-inventory-size");
            }
        }
        if (payloadBytes != CompanionSourceDescriptor.PayloadBytes)
        {
            throw new CompanionContractException("source-payload-inventory-size");
        }

        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions
        {
            Indented = false,
            SkipValidation = false
        }))
        {
            writer.WriteStartObject();
            writer.WriteString("schema", CompanionSourceDescriptor.PayloadInventorySchema);
            writer.WritePropertyName("files");
            writer.WriteStartArray();
            foreach (var member in ordered)
            {
                writer.WriteStartObject();
                writer.WriteString("path", member.Path);
                writer.WriteNumber("byteLength", member.ByteLength);
                writer.WriteString("sha256", member.Sha256);
                writer.WriteEndObject();
            }
            writer.WriteEndArray();
            writer.WriteEndObject();
        }
        stream.WriteByte((byte)'\n');
        return Convert.ToHexString(SHA256.HashData(stream.ToArray()))
            .ToLowerInvariant();
    }
}
