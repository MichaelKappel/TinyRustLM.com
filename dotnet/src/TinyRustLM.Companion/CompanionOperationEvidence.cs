using System.Text.Json;
using System.Text.Json.Serialization;

namespace TinyRustLM.Companion;

/// <summary>Private create-only custody binding for one operation worker.</summary>
public sealed record CompanionExecutionIntent(
    string Schema,
    string OperationId,
    string RequestSha256,
    string AttemptId,
    string InstalledWorkerSha256,
    string InstalledConverterSha256,
    string SourceDescriptorId,
    string SourceCacheLogicalId,
    string SourceAcquisitionRoot,
    string MaterializedLockRoot,
    string ConversionOutputRoot,
    string NetworkProfileId,
    string ResourcePolicyId);

/// <summary>Private create-only intent for the exact built-in source acquisition.</summary>
public sealed record CompanionSourceAcquisitionIntent(
    string Schema,
    string OperationId,
    string RequestSha256,
    string ExecutionIntentSha256,
    string SourceDescriptorId,
    string SourceRepository,
    string SourceRevision,
    string ModelSourceLockSha256,
    string TokenizerSourceLockSha256,
    ulong MaximumSourceBytes,
    string PayloadInventorySchema,
    string ExpectedPayloadInventorySha256,
    string SourceCacheRoot,
    string ModelSourceRoot,
    string TokenizerSourceRoot,
    string SourceStagingRoot,
    string MaterializedLockRoot,
    string InitialOrigin,
    uint MaximumRedirects,
    uint BufferBytes);

/// <summary>Private create-only proof of an independently reverified source closure.</summary>
public sealed record CompanionSourceAcquisitionReceipt(
    string Schema,
    string OperationId,
    string RequestSha256,
    string ExecutionIntentSha256,
    string SourceAcquisitionIntentSha256,
    string SourceDescriptorId,
    string ModelSourceLockSha256,
    string TokenizerSourceLockSha256,
    string PayloadInventorySchema,
    string PayloadInventorySha256,
    uint PayloadFileCount,
    ulong PayloadBytes,
    string ActivatedModelSourceRoot,
    string ActivatedTokenizerSourceRoot);

public sealed record CompanionPersistedExecutionIntent(
    CompanionExecutionIntent Intent,
    string Sha256);

public sealed record CompanionPersistedSourceAcquisitionIntent(
    CompanionSourceAcquisitionIntent Intent,
    string Sha256);

public sealed record CompanionPersistedSourceAcquisitionReceipt(
    CompanionSourceAcquisitionReceipt Receipt,
    string Sha256);

internal static class CompanionOperationEvidenceCodec
{
    internal const int MaximumBytes = 65_536;

    internal static byte[] Serialize(CompanionExecutionIntent value)
    {
        Validate(value);
        return WriteCanonical(writer =>
        {
            writer.WriteString("schema", value.Schema);
            writer.WriteString("operationId", value.OperationId);
            writer.WriteString("requestSha256", value.RequestSha256);
            writer.WriteString("attemptId", value.AttemptId);
            writer.WriteString("installedWorkerSha256", value.InstalledWorkerSha256);
            writer.WriteString("installedConverterSha256", value.InstalledConverterSha256);
            writer.WriteString("sourceDescriptorId", value.SourceDescriptorId);
            writer.WriteString("sourceCacheLogicalId", value.SourceCacheLogicalId);
            writer.WriteString("sourceAcquisitionRoot", value.SourceAcquisitionRoot);
            writer.WriteString("materializedLockRoot", value.MaterializedLockRoot);
            writer.WriteString("conversionOutputRoot", value.ConversionOutputRoot);
            writer.WriteString("networkProfileId", value.NetworkProfileId);
            writer.WriteString("resourcePolicyId", value.ResourcePolicyId);
        });
    }

    internal static byte[] Serialize(CompanionSourceAcquisitionIntent value)
    {
        Validate(value);
        return WriteCanonical(writer =>
        {
            writer.WriteString("schema", value.Schema);
            writer.WriteString("operationId", value.OperationId);
            writer.WriteString("requestSha256", value.RequestSha256);
            writer.WriteString("executionIntentSha256", value.ExecutionIntentSha256);
            writer.WriteString("sourceDescriptorId", value.SourceDescriptorId);
            writer.WriteString("sourceRepository", value.SourceRepository);
            writer.WriteString("sourceRevision", value.SourceRevision);
            writer.WriteString("modelSourceLockSha256", value.ModelSourceLockSha256);
            writer.WriteString("tokenizerSourceLockSha256", value.TokenizerSourceLockSha256);
            writer.WriteNumber("maximumSourceBytes", value.MaximumSourceBytes);
            writer.WriteString("payloadInventorySchema", value.PayloadInventorySchema);
            writer.WriteString(
                "expectedPayloadInventorySha256",
                value.ExpectedPayloadInventorySha256);
            writer.WriteString("sourceCacheRoot", value.SourceCacheRoot);
            writer.WriteString("modelSourceRoot", value.ModelSourceRoot);
            writer.WriteString("tokenizerSourceRoot", value.TokenizerSourceRoot);
            writer.WriteString("sourceStagingRoot", value.SourceStagingRoot);
            writer.WriteString("materializedLockRoot", value.MaterializedLockRoot);
            writer.WriteString("initialOrigin", value.InitialOrigin);
            writer.WriteNumber("maximumRedirects", value.MaximumRedirects);
            writer.WriteNumber("bufferBytes", value.BufferBytes);
        });
    }

    internal static byte[] Serialize(CompanionSourceAcquisitionReceipt value)
    {
        Validate(value);
        return WriteCanonical(writer =>
        {
            writer.WriteString("schema", value.Schema);
            writer.WriteString("operationId", value.OperationId);
            writer.WriteString("requestSha256", value.RequestSha256);
            writer.WriteString("executionIntentSha256", value.ExecutionIntentSha256);
            writer.WriteString(
                "sourceAcquisitionIntentSha256",
                value.SourceAcquisitionIntentSha256);
            writer.WriteString("sourceDescriptorId", value.SourceDescriptorId);
            writer.WriteString("modelSourceLockSha256", value.ModelSourceLockSha256);
            writer.WriteString("tokenizerSourceLockSha256", value.TokenizerSourceLockSha256);
            writer.WriteString("payloadInventorySchema", value.PayloadInventorySchema);
            writer.WriteString("payloadInventorySha256", value.PayloadInventorySha256);
            writer.WriteNumber("payloadFileCount", value.PayloadFileCount);
            writer.WriteNumber("payloadBytes", value.PayloadBytes);
            writer.WriteString("activatedModelSourceRoot", value.ActivatedModelSourceRoot);
            writer.WriteString(
                "activatedTokenizerSourceRoot",
                value.ActivatedTokenizerSourceRoot);
        });
    }

    internal static CompanionExecutionIntent DeserializeExecutionIntent(byte[] bytes) =>
        DeserializeCanonical<CompanionExecutionIntent>(
            bytes,
            "journal-execution-intent",
            static value => Serialize(value),
            static value => Validate(value));

    internal static CompanionSourceAcquisitionIntent DeserializeSourceAcquisitionIntent(
        byte[] bytes) =>
        DeserializeCanonical<CompanionSourceAcquisitionIntent>(
            bytes,
            "journal-source-acquisition-intent",
            static value => Serialize(value),
            static value => Validate(value));

    internal static CompanionSourceAcquisitionReceipt DeserializeSourceAcquisitionReceipt(
        byte[] bytes) =>
        DeserializeCanonical<CompanionSourceAcquisitionReceipt>(
            bytes,
            "journal-source-acquisition-receipt",
            static value => Serialize(value),
            static value => Validate(value));

    internal static void Validate(CompanionExecutionIntent value)
    {
        ArgumentNullException.ThrowIfNull(value);
        RequireSchema(value.Schema, CompanionContract.ExecutionIntentSchema, "execution-intent");
        RequireCommonIdentity(value.OperationId, value.RequestSha256, "execution-intent");
        CompanionContract.RequireAttemptId(value.AttemptId, "journal-execution-intent-attempt");
        CompanionContract.RequireDigest(
            value.InstalledWorkerSha256,
            "journal-execution-intent-worker");
        CompanionContract.RequireDigest(
            value.InstalledConverterSha256,
            "journal-execution-intent-converter");
        RequireExact(
            value.SourceDescriptorId,
            CompanionSourceDescriptor.DescriptorId,
            "journal-execution-intent-source-descriptor");
        RequireExact(
            value.SourceCacheLogicalId,
            CompanionSourceDescriptor.CacheLogicalId,
            "journal-execution-intent-source-cache");
        var roots = new[]
        {
            RequireAbsolutePath(value.SourceAcquisitionRoot, "journal-execution-intent-source-root"),
            RequireAbsolutePath(value.MaterializedLockRoot, "journal-execution-intent-lock-root"),
            RequireAbsolutePath(value.ConversionOutputRoot, "journal-execution-intent-output-root")
        };
        RequireDistinctPaths(roots, "journal-execution-intent-root-collision");
        RequireExact(
            value.NetworkProfileId,
            CompanionSourceDescriptor.NetworkProfileId,
            "journal-execution-intent-network-profile");
        RequireExact(
            value.ResourcePolicyId,
            CompanionSourceDescriptor.ResourcePolicyId,
            "journal-execution-intent-resource-policy");
    }

    internal static void Validate(CompanionSourceAcquisitionIntent value)
    {
        ArgumentNullException.ThrowIfNull(value);
        RequireSchema(
            value.Schema,
            CompanionContract.SourceAcquisitionIntentSchema,
            "source-acquisition-intent");
        RequireCommonIdentity(
            value.OperationId,
            value.RequestSha256,
            "source-acquisition-intent");
        CompanionContract.RequireDigest(
            value.ExecutionIntentSha256,
            "journal-source-acquisition-intent-execution");
        RequireExactSourceIdentity(
            value.SourceDescriptorId,
            value.SourceRepository,
            value.SourceRevision,
            value.ModelSourceLockSha256,
            value.TokenizerSourceLockSha256,
            value.MaximumSourceBytes,
            "journal-source-acquisition-intent");
        RequireExact(
            value.PayloadInventorySchema,
            CompanionSourceDescriptor.PayloadInventorySchema,
            "journal-source-acquisition-intent-inventory-schema");
        RequireExact(
            value.ExpectedPayloadInventorySha256,
            CompanionSourceDescriptor.PayloadInventorySha256,
            "journal-source-acquisition-intent-inventory-digest");
        var roots = new[]
        {
            RequireAbsolutePath(value.SourceCacheRoot, "journal-source-acquisition-intent-cache-root"),
            RequireAbsolutePath(value.ModelSourceRoot, "journal-source-acquisition-intent-model-root"),
            RequireAbsolutePath(value.TokenizerSourceRoot, "journal-source-acquisition-intent-tokenizer-root"),
            RequireAbsolutePath(value.SourceStagingRoot, "journal-source-acquisition-intent-staging-root"),
            RequireAbsolutePath(value.MaterializedLockRoot, "journal-source-acquisition-intent-lock-root")
        };
        RequireDistinctPaths(roots, "journal-source-acquisition-intent-root-collision");
        RequireExact(
            value.InitialOrigin,
            CompanionSourceDescriptor.InitialOrigin,
            "journal-source-acquisition-intent-origin");
        if (value.MaximumRedirects != CompanionSourceDescriptor.MaximumRedirects)
        {
            throw new CompanionContractException(
                "journal-source-acquisition-intent-redirect-limit");
        }
        if (value.BufferBytes != CompanionSourceDescriptor.BufferBytes)
        {
            throw new CompanionContractException("journal-source-acquisition-intent-buffer");
        }
    }

    internal static void Validate(CompanionSourceAcquisitionReceipt value)
    {
        ArgumentNullException.ThrowIfNull(value);
        RequireSchema(
            value.Schema,
            CompanionContract.SourceAcquisitionReceiptSchema,
            "source-acquisition-receipt");
        RequireCommonIdentity(
            value.OperationId,
            value.RequestSha256,
            "source-acquisition-receipt");
        CompanionContract.RequireDigest(
            value.ExecutionIntentSha256,
            "journal-source-acquisition-receipt-execution");
        CompanionContract.RequireDigest(
            value.SourceAcquisitionIntentSha256,
            "journal-source-acquisition-receipt-intent");
        RequireExact(
            value.SourceDescriptorId,
            CompanionSourceDescriptor.DescriptorId,
            "journal-source-acquisition-receipt-source-descriptor");
        RequireExact(
            value.ModelSourceLockSha256,
            CompanionSourceDescriptor.ModelSourceLockSha256,
            "journal-source-acquisition-receipt-model-lock");
        RequireExact(
            value.TokenizerSourceLockSha256,
            CompanionSourceDescriptor.TokenizerSourceLockSha256,
            "journal-source-acquisition-receipt-tokenizer-lock");
        RequireExact(
            value.PayloadInventorySchema,
            CompanionSourceDescriptor.PayloadInventorySchema,
            "journal-source-acquisition-receipt-inventory-schema");
        RequireExact(
            value.PayloadInventorySha256,
            CompanionSourceDescriptor.PayloadInventorySha256,
            "journal-source-acquisition-receipt-inventory-digest");
        if (value.PayloadFileCount != CompanionSourceDescriptor.FileCount)
        {
            throw new CompanionContractException("journal-source-acquisition-receipt-file-count");
        }
        if (value.PayloadBytes != CompanionSourceDescriptor.PayloadBytes)
        {
            throw new CompanionContractException("journal-source-acquisition-receipt-payload-size");
        }
        var roots = new[]
        {
            RequireAbsolutePath(
                value.ActivatedModelSourceRoot,
                "journal-source-acquisition-receipt-model-root"),
            RequireAbsolutePath(
                value.ActivatedTokenizerSourceRoot,
                "journal-source-acquisition-receipt-tokenizer-root")
        };
        RequireDistinctPaths(roots, "journal-source-acquisition-receipt-root-collision");
    }

    private static byte[] WriteCanonical(Action<Utf8JsonWriter> writeProperties)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions
        {
            Indented = false,
            SkipValidation = false
        }))
        {
            writer.WriteStartObject();
            writeProperties(writer);
            writer.WriteEndObject();
        }
        stream.WriteByte((byte)'\n');
        if (stream.Length is 0 or > MaximumBytes)
        {
            throw new CompanionContractException("journal-operation-evidence-size");
        }
        return stream.ToArray();
    }

    private static T DeserializeCanonical<T>(
        byte[] bytes,
        string code,
        Func<T, byte[]> serialize,
        Action<T> validate)
    {
        if (bytes.Length is 0 or > MaximumBytes)
        {
            throw new CompanionContractException($"{code}-size");
        }
        T value;
        try
        {
            CompanionStrictJson.RejectDuplicateProperties(bytes, $"{code}-json");
            value = JsonSerializer.Deserialize<T>(bytes, JsonOptions)
                ?? throw new CompanionContractException($"{code}-json");
        }
        catch (JsonException)
        {
            throw new CompanionContractException($"{code}-json");
        }
        validate(value);
        if (!bytes.AsSpan().SequenceEqual(serialize(value)))
        {
            throw new CompanionContractException($"{code}-canonical");
        }
        return value;
    }

    private static void RequireSchema(string actual, string expected, string subject)
    {
        if (actual != expected)
        {
            throw new CompanionContractException($"journal-{subject}-schema");
        }
    }

    private static void RequireCommonIdentity(string operationId, string requestSha256, string subject)
    {
        CompanionContract.RequireDigest(operationId, $"journal-{subject}-operation");
        CompanionContract.RequireDigest(requestSha256, $"journal-{subject}-request");
    }

    private static void RequireExactSourceIdentity(
        string descriptorId,
        string repository,
        string revision,
        string modelSourceLockSha256,
        string tokenizerSourceLockSha256,
        ulong maximumSourceBytes,
        string code)
    {
        if (descriptorId != CompanionSourceDescriptor.DescriptorId ||
            repository != CompanionSourceDescriptor.Repository ||
            revision != CompanionSourceDescriptor.Revision ||
            modelSourceLockSha256 != CompanionSourceDescriptor.ModelSourceLockSha256 ||
            tokenizerSourceLockSha256 != CompanionSourceDescriptor.TokenizerSourceLockSha256 ||
            maximumSourceBytes != CompanionSourceDescriptor.PayloadBytes)
        {
            throw new CompanionContractException($"{code}-source-identity");
        }
    }

    private static string RequireAbsolutePath(string value, string code)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 1_024 ||
            value.IndexOf('\0', StringComparison.Ordinal) >= 0)
        {
            throw new CompanionContractException(code);
        }
        try
        {
            if (!Path.IsPathFullyQualified(value) || Path.GetFullPath(value) != value ||
                value != Path.TrimEndingDirectorySeparator(value))
            {
                throw new CompanionContractException(code);
            }
        }
        catch (Exception error) when (error is ArgumentException or NotSupportedException or
            PathTooLongException)
        {
            throw new CompanionContractException(code);
        }
        return value;
    }

    private static void RequireDistinctPaths(IEnumerable<string> values, string code)
    {
        var paths = values.ToArray();
        var comparison = OperatingSystem.IsWindows()
            ? StringComparison.OrdinalIgnoreCase
            : StringComparison.Ordinal;
        for (var left = 0; left < paths.Length; left++)
        {
            for (var right = left + 1; right < paths.Length; right++)
            {
                if (IsSameOrDescendant(paths[left], paths[right], comparison) ||
                    IsSameOrDescendant(paths[right], paths[left], comparison))
                {
                    throw new CompanionContractException(code);
                }
            }
        }
    }

    private static bool IsSameOrDescendant(
        string parent,
        string candidate,
        StringComparison comparison)
    {
        if (candidate.Equals(parent, comparison))
        {
            return true;
        }
        var prefix = parent.EndsWith(Path.DirectorySeparatorChar)
            ? parent
            : string.Concat(parent, Path.DirectorySeparatorChar);
        return candidate.StartsWith(prefix, comparison);
    }

    private static void RequireExact(string actual, string expected, string code)
    {
        if (actual != expected)
        {
            throw new CompanionContractException(code);
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
