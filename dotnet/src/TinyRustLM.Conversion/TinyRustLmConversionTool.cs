using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace TinyRustLM;

/// <summary>Inputs for one create-only complete Qwen3 composition conversion.</summary>
public sealed record TinyRustLmCompositionConversionRequest(
    string ModelSourceLockPath,
    string ModelSourceLockSha256,
    string ModelSourceDirectory,
    string TokenizerSourceLockPath,
    string TokenizerSourceLockSha256,
    string TokenizerSourceDirectory,
    string CompositionProfileSha256,
    string OutputRoot);

/// <summary>Explicit process and output ceilings for a composition conversion.</summary>
public sealed record TinyRustLmConversionPolicy(
    TimeSpan MaximumDuration,
    int MaximumSummaryBytes,
    int MaximumErrorBytes)
{
    /// <summary>Conservative defaults for one local composition conversion process.</summary>
    public static TinyRustLmConversionPolicy Default { get; } = new(
        TimeSpan.FromHours(12),
        65_536,
        4_096);
}

/// <summary>Verified identity of one member in a complete composition.</summary>
public sealed record TinyRustLmCompositionArtifact(
    string Kind,
    string FileName,
    string Path,
    ulong ByteLength,
    string Sha256);

/// <summary>The exact six members emitted by the sole complete conversion transaction.</summary>
public sealed record TinyRustLmCompositionArtifactSet(
    TinyRustLmCompositionArtifact Model,
    TinyRustLmCompositionArtifact Tokenizer,
    TinyRustLmCompositionArtifact Template,
    TinyRustLmCompositionArtifact Sampling,
    TinyRustLmCompositionArtifact Prompt,
    TinyRustLmCompositionArtifact Composition)
{
    /// <summary>Returns the members in their canonical graph order.</summary>
    public IReadOnlyList<TinyRustLmCompositionArtifact> InCanonicalOrder() =>
        [Model, Tokenizer, Template, Sampling, Prompt, Composition];
}

/// <summary>Verified identities and evidence from one complete composition conversion.</summary>
public sealed record TinyRustLmCompositionConversionResult(
    string Schema,
    string OperationId,
    string OutputRoot,
    string ReceiptPath,
    string ReceiptSha256,
    TinyRustLmCompositionArtifactSet Artifacts,
    string GraphIdentitySha256,
    string ModelSourceLockSha256,
    string TokenizerSourceLockSha256,
    string ConverterVersion,
    string ConverterExecutableSha256,
    string RequiredNextGate,
    string SummarySha256,
    TimeSpan Duration);

/// <summary>Fail-closed process owner for the sole complete TinyRustLM conversion transaction.</summary>
public sealed partial class TinyRustLmConversionTool
{
    /// <summary>The registered complete-composition profile identifier.</summary>
    public const string CompositionProfileId = "tinyrustlm.qwen3-complete-composition-conversion/1";

    /// <summary>The SHA-256 of the exact registered complete-composition profile.</summary>
    public const string CompositionProfileSha256 =
        "2f95f79783ec6cd12160d51f9697c5c77aab2e6cd46afeb5140fdb513e5d8158";

    private const string SummarySchema = "tinyrustlm.qwen3_composition_conversion_cli_summary.v1";
    private const string ReceiptSchema = "tinyrustlm.qwen3_composition_conversion_receipt.v1";
    private const string AttemptSchema = "tinyrustlm.qwen3_composition_attempt.v1";
    private const string RequiredNextGate =
        "source-native-browser-numerical-parity-untouched-quality-and-product-chat";
    private const string ReceiptFileName = "composition.conversion-receipt.json";
    private const string AttemptFileName = "composition.attempt.json";
    private const string RejectionFileName = "composition.rejection.json";
    private const int HashBufferBytes = 1_048_576;
    private const int MaximumReceiptBytes = 1_048_576;
    private readonly TinyRustLmConversionPolicy _policy;
    private readonly string _toolPath;

    private static readonly ArtifactExpectation[] ArtifactExpectations =
    [
        new(0, "slm2", "model.slm2", "org.minimodel.slm2/2.0",
            "5ac819cb31a17a64bec0d5492962a4baf0bd2778f6213b87c85c0a04f3a738d8"),
        new(1, "tokenizer2", "tokenizer.tokenizer2", "org.minimodel.tokenizer2/2.0",
            "628427bf6e7f8d34ed14b331a5c636606aee9d5ef45a36a3cadc13338669b8de"),
        new(2, "template2", "template.template2", "org.minimodel.template2/2.0",
            "14ff1df8dd6760119ac36e719ab396fff8e71d0719c2e1c83118f58693ea7bfa"),
        new(3, "sampling2", "sampling.sampling2", "org.minimodel.sampling2/2.0",
            "ec65e8f1a54c1e4ca95ebda88bde091dad11337250e541bbda60e8cac311428d"),
        new(4, "prompt2", "prompt.prompt2", "org.minimodel.prompt2/2.0",
            "f9eb4cbecfb52f5e2857216c999754da94021a5427a86732d33fe15efc0d062c"),
        new(5, "acg2", "composition.acg2", "org.minimodel.acg2/2.0",
            "944ed9b5b0ee2605ebb9ac13f2e5388c181bc857fdbfc082e62e9ae7b07c79be")
    ];

    private static readonly string[] EvidenceFileNames =
    [
        AttemptFileName,
        "model.slm2.conversion-receipt.json",
        "tokenizer.tokenizer2.conversion-receipt.json",
        ReceiptFileName
    ];

    /// <summary>Creates a converter owner for one explicit regular executable file.</summary>
    public TinyRustLmConversionTool(
        string toolPath,
        TinyRustLmConversionPolicy? policy = null)
    {
        _toolPath = RequireExistingRegularFile(toolPath, nameof(toolPath));
        _policy = policy ?? TinyRustLmConversionPolicy.Default;
        if (_policy.MaximumDuration <= TimeSpan.Zero ||
            _policy.MaximumDuration > TimeSpan.FromDays(7) ||
            _policy.MaximumSummaryBytes is < 1 or > 1_048_576 ||
            _policy.MaximumErrorBytes is < 1 or > 65_536)
        {
            throw new ArgumentOutOfRangeException(nameof(policy));
        }
    }

    /// <summary>Creates a converter owner for the exact tool copied from the package.</summary>
    public static TinyRustLmConversionTool FromPackageLayout(
        TinyRustLmConversionPolicy? policy = null)
    {
        var rid = RuntimeIdentifier();
        var fileName = OperatingSystem.IsWindows()
            ? "tinyrustlm-convert.exe"
            : "tinyrustlm-convert";
        var path = Path.Combine(
            AppContext.BaseDirectory,
            "tinyrustlm",
            "tools",
            rid,
            fileName);
        return new TinyRustLmConversionTool(path, policy);
    }

    /// <summary>Runs and independently verifies one complete create-only composition conversion.</summary>
    public async Task<TinyRustLmCompositionConversionResult> ConvertCompositionAsync(
        TinyRustLmCompositionConversionRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        var modelLock = RequireExistingRegularFile(
            request.ModelSourceLockPath,
            nameof(request.ModelSourceLockPath));
        var modelDirectory = RequireExistingDirectory(
            request.ModelSourceDirectory,
            nameof(request.ModelSourceDirectory));
        var tokenizerLock = RequireExistingRegularFile(
            request.TokenizerSourceLockPath,
            nameof(request.TokenizerSourceLockPath));
        var tokenizerDirectory = RequireExistingDirectory(
            request.TokenizerSourceDirectory,
            nameof(request.TokenizerSourceDirectory));
        var outputRoot = RequireCreateOnlyOutputRoot(request.OutputRoot, nameof(request.OutputRoot));
        var modelLockSha256 = Sha256File(modelLock);
        var tokenizerLockSha256 = Sha256File(tokenizerLock);
        if (!IsDigest(request.ModelSourceLockSha256) ||
            modelLockSha256 != request.ModelSourceLockSha256)
        {
            throw new TinyRustLmException("converter-model-source-lock-identity");
        }
        if (!IsDigest(request.TokenizerSourceLockSha256) ||
            tokenizerLockSha256 != request.TokenizerSourceLockSha256)
        {
            throw new TinyRustLmException("converter-tokenizer-source-lock-identity");
        }
        if (request.CompositionProfileSha256 != CompositionProfileSha256)
        {
            throw new TinyRustLmException("converter-composition-profile-identity");
        }
        var toolSha256Before = Sha256File(_toolPath);

        var startInfo = new ProcessStartInfo
        {
            FileName = _toolPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = new UTF8Encoding(false, true),
            StandardErrorEncoding = new UTF8Encoding(false, true),
            UseShellExecute = false,
            CreateNoWindow = true
        };
        startInfo.ArgumentList.Add("qwen3-composition");
        startInfo.ArgumentList.Add(modelLock);
        startInfo.ArgumentList.Add(modelDirectory);
        startInfo.ArgumentList.Add(tokenizerLock);
        startInfo.ArgumentList.Add(tokenizerDirectory);
        startInfo.ArgumentList.Add(outputRoot);

        var stopwatch = Stopwatch.StartNew();
        using var process = Process.Start(startInfo)
            ?? throw new TinyRustLmException("converter-process-start");
        var stdoutTask = ReadBoundedAsync(
            process.StandardOutput.BaseStream,
            _policy.MaximumSummaryBytes,
            process);
        var stderrTask = ReadBoundedAsync(
            process.StandardError.BaseStream,
            _policy.MaximumErrorBytes,
            process);

        using var timeout = new CancellationTokenSource(_policy.MaximumDuration);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeout.Token);
        try
        {
            await process.WaitForExitAsync(linked.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            TryKill(process);
            await process.WaitForExitAsync(CancellationToken.None).ConfigureAwait(false);
            await DrainAfterTermination(stdoutTask, stderrTask).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
            throw new TinyRustLmException("converter-timeout");
        }

        byte[] stdout;
        byte[] stderr;
        try
        {
            await Task.WhenAll(stdoutTask, stderrTask).ConfigureAwait(false);
            stdout = stdoutTask.Result;
            stderr = stderrTask.Result;
        }
        catch (ConversionOutputLimitException)
        {
            throw new TinyRustLmException("converter-output-limit");
        }

        stopwatch.Stop();
        if (process.ExitCode != 0)
        {
            throw new TinyRustLmException(ParseFailureCode(stderr));
        }
        if (stderr.Length != 0)
        {
            throw new TinyRustLmException("converter-unexpected-stderr");
        }

        var result = VerifySummary(
            outputRoot,
            modelLockSha256,
            tokenizerLockSha256,
            toolSha256Before,
            stdout,
            stopwatch.Elapsed);
        if (Sha256File(_toolPath) != toolSha256Before)
        {
            throw new TinyRustLmException("converter-executable-drift");
        }
        return result;
    }

    private static TinyRustLmCompositionConversionResult VerifySummary(
        string outputRoot,
        string modelLockSha256,
        string tokenizerLockSha256,
        string toolSha256,
        byte[] summaryBytes,
        TimeSpan duration)
    {
        var summary = Deserialize<NativeConversionSummary>(summaryBytes, "converter-summary-json");
        var outputName = Path.GetFileName(outputRoot);
        if (summary.Schema != SummarySchema ||
            summary.Status != "pass" ||
            !IsOperationId(summary.OperationId) ||
            summary.OutputDirectory != outputName ||
            summary.ReceiptFile != ReceiptFileName ||
            summary.RequiredNextGate != RequiredNextGate ||
            !IsDigest(summary.GraphIdentitySha256) ||
            summary.Artifacts is null ||
            summary.Artifacts.Count != ArtifactExpectations.Length)
        {
            throw new TinyRustLmException("converter-summary-contract");
        }

        RejectReparsePoint(outputRoot, "converter-output-root");
        ValidateInventory(outputRoot);
        var summaryArtifacts = new TinyRustLmCompositionArtifact[ArtifactExpectations.Length];
        for (var index = 0; index < ArtifactExpectations.Length; index++)
        {
            var expected = ArtifactExpectations[index];
            var observed = summary.Artifacts[index];
            if (observed.Kind != expected.Kind ||
                observed.File != expected.FileName ||
                observed.ByteLength == 0 ||
                !IsDigest(observed.Sha256))
            {
                throw new TinyRustLmException("converter-summary-artifacts");
            }

            var path = Path.Combine(outputRoot, expected.FileName);
            var identity = ReadIdentity(path, "converter-artifact-file");
            if (identity.ByteLength != observed.ByteLength || identity.Sha256 != observed.Sha256)
            {
                throw new TinyRustLmException("converter-artifact-identity");
            }
            summaryArtifacts[index] = new TinyRustLmCompositionArtifact(
                expected.Kind,
                expected.FileName,
                path,
                identity.ByteLength,
                identity.Sha256);
        }

        var receiptPath = Path.Combine(outputRoot, ReceiptFileName);
        var receiptBytes = ReadBoundedRegularFile(
            receiptPath,
            MaximumReceiptBytes,
            "converter-receipt-file");
        var receipt = Deserialize<NativeCompleteReceipt>(receiptBytes, "converter-receipt-json");
        ValidateReceipt(
            receipt,
            outputRoot,
            summary,
            summaryArtifacts,
            modelLockSha256,
            tokenizerLockSha256,
            toolSha256);
        ValidateAttempt(
            outputRoot,
            summary.OperationId,
            modelLockSha256,
            tokenizerLockSha256,
            receipt.Converter.ImplementationVersion,
            toolSha256);

        var artifacts = new TinyRustLmCompositionArtifactSet(
            summaryArtifacts[0],
            summaryArtifacts[1],
            summaryArtifacts[2],
            summaryArtifacts[3],
            summaryArtifacts[4],
            summaryArtifacts[5]);
        return new TinyRustLmCompositionConversionResult(
            SummarySchema,
            summary.OperationId,
            outputRoot,
            receiptPath,
            Sha256Bytes(receiptBytes),
            artifacts,
            summary.GraphIdentitySha256,
            modelLockSha256,
            tokenizerLockSha256,
            receipt.Converter.ImplementationVersion,
            toolSha256,
            RequiredNextGate,
            Sha256Bytes(summaryBytes),
            duration);
    }

    private static void ValidateReceipt(
        NativeCompleteReceipt receipt,
        string outputRoot,
        NativeConversionSummary summary,
        IReadOnlyList<TinyRustLmCompositionArtifact> artifacts,
        string modelLockSha256,
        string tokenizerLockSha256,
        string toolSha256)
    {
        if (receipt.Schema != ReceiptSchema ||
            receipt.Status != "pass" ||
            receipt.ProfileId != CompositionProfileId ||
            receipt.ProfileSha256 != CompositionProfileSha256 ||
            receipt.OperationId != summary.OperationId ||
            receipt.Converter is null ||
            !IsSafeIdentifier(receipt.Converter.ImplementationVersion) ||
            receipt.Converter.ExecutableSha256 != toolSha256 ||
            receipt.Source is null ||
            receipt.Source.ModelLockSha256 != modelLockSha256 ||
            receipt.Source.TokenizerLockSha256 != tokenizerLockSha256 ||
            receipt.Source.RelationshipStatus != "exact" ||
            receipt.Artifacts is null ||
            receipt.Artifacts.Count != ArtifactExpectations.Length ||
            receipt.Graph is null ||
            receipt.Graph.GraphIdentitySha256 != summary.GraphIdentitySha256 ||
            !IsDigest(receipt.Graph.MemberTableSha256) ||
            receipt.Graph.ResolvedMemberBytes == 0 ||
            receipt.ComponentReceipts is null ||
            receipt.ResourcePlan is null ||
            receipt.ResourcePlan.ModelArtifactBytes != artifacts[0].ByteLength ||
            receipt.ResourcePlan.ResidentDependencyArtifactBytes == 0 ||
            receipt.ResourcePlan.ModelTensorCount is 0 or > 2_048 ||
            receipt.ResourcePlan.StreamHashBufferBytes != HashBufferBytes ||
            receipt.Durability is null ||
            receipt.Durability.OperationId != summary.OperationId ||
            !IsDigest(receipt.Durability.DirectoryIdentitySha256) ||
            !IsSafeIdentifier(receipt.Durability.Method) ||
            !IsSafeIdentifier(receipt.Durability.OperatingSystem) ||
            !IsSafeIdentifier(receipt.Durability.Architecture) ||
            receipt.Durability.Status != "flushed" ||
            receipt.StructuralCompositionStatus != "verified" ||
            receipt.ModelQualityStatus != "not-assessed-by-converter" ||
            receipt.SourceFrameworkParityStatus != "not-assessed-by-converter" ||
            receipt.NativeRuntimeStatus != "not-assessed-by-converter" ||
            receipt.BrowserWasmStatus != "not-assessed-by-converter" ||
            receipt.BrowserChatStatus != "not-assessed-by-converter" ||
            receipt.P2PAvailabilityStatus != "not-assessed-by-converter" ||
            receipt.PublicationStatus != "not-assessed-by-converter" ||
            receipt.RequiredNextGate != RequiredNextGate)
        {
            throw new TinyRustLmException("converter-receipt-contract");
        }

        var expectedOperationId = ComputeOperationId(
            modelLockSha256,
            tokenizerLockSha256,
            receipt.Converter.ImplementationVersion,
            toolSha256);
        if (summary.OperationId != expectedOperationId)
        {
            throw new TinyRustLmException("converter-operation-identity");
        }

        for (var index = 0; index < ArtifactExpectations.Length; index++)
        {
            var expected = ArtifactExpectations[index];
            var observed = receipt.Artifacts[index];
            var artifact = artifacts[index];
            if (observed.Ordinal != expected.Ordinal ||
                observed.Kind != expected.Kind ||
                observed.File != expected.FileName ||
                observed.FormatProfileId != expected.FormatProfileId ||
                observed.FormatProfileSha256 != expected.FormatProfileSha256 ||
                observed.ByteLength != artifact.ByteLength ||
                observed.Sha256 != artifact.Sha256)
            {
                throw new TinyRustLmException("converter-receipt-artifacts");
            }
        }

        ValidateComponentReceipt(
            outputRoot,
            receipt.ComponentReceipts.Model,
            "model.slm2.conversion-receipt.json");
        ValidateComponentReceipt(
            outputRoot,
            receipt.ComponentReceipts.Tokenizer,
            "tokenizer.tokenizer2.conversion-receipt.json");
    }

    private static void ValidateAttempt(
        string outputRoot,
        string operationId,
        string modelLockSha256,
        string tokenizerLockSha256,
        string converterVersion,
        string toolSha256)
    {
        var bytes = ReadBoundedRegularFile(
            Path.Combine(outputRoot, AttemptFileName),
            MaximumReceiptBytes,
            "converter-attempt-file");
        var attempt = Deserialize<NativeAttemptReceipt>(bytes, "converter-attempt-json");
        if (attempt.Schema != AttemptSchema ||
            attempt.Status != "started" ||
            attempt.ProfileId != CompositionProfileId ||
            attempt.ProfileSha256 != CompositionProfileSha256 ||
            attempt.OperationId != operationId ||
            attempt.ModelLockSha256 != modelLockSha256 ||
            attempt.TokenizerLockSha256 != tokenizerLockSha256 ||
            attempt.ConverterVersion != converterVersion ||
            attempt.ConverterExecutableSha256 != toolSha256 ||
            attempt.TerminalRule != "existing-output-root-is-never-resumed")
        {
            throw new TinyRustLmException("converter-attempt-contract");
        }
    }

    private static void ValidateComponentReceipt(
        string outputRoot,
        NativeComponentReceipt? receipt,
        string expectedFile)
    {
        if (receipt is null ||
            receipt.File != expectedFile ||
            receipt.ByteLength == 0 ||
            !IsDigest(receipt.Sha256))
        {
            throw new TinyRustLmException("converter-component-receipt-contract");
        }
        var identity = ReadIdentity(
            Path.Combine(outputRoot, expectedFile),
            "converter-component-receipt-file");
        if (identity.ByteLength != receipt.ByteLength || identity.Sha256 != receipt.Sha256)
        {
            throw new TinyRustLmException("converter-component-receipt-identity");
        }
    }

    private static void ValidateInventory(string outputRoot)
    {
        if (!Directory.Exists(outputRoot) || File.Exists(Path.Combine(outputRoot, RejectionFileName)))
        {
            throw new TinyRustLmException("converter-output-inventory");
        }
        var expected = ArtifactExpectations.Select(value => value.FileName)
            .Concat(EvidenceFileNames)
            .ToHashSet(StringComparer.Ordinal);
        var observed = new HashSet<string>(StringComparer.Ordinal);
        foreach (var path in Directory.EnumerateFileSystemEntries(outputRoot))
        {
            var attributes = File.GetAttributes(path);
            if ((attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0 ||
                !observed.Add(Path.GetFileName(path)))
            {
                throw new TinyRustLmException("converter-output-inventory");
            }
        }
        if (!observed.SetEquals(expected))
        {
            throw new TinyRustLmException("converter-output-inventory");
        }
    }

    private static string ComputeOperationId(
        string modelLockSha256,
        string tokenizerLockSha256,
        string converterVersion,
        string toolSha256)
    {
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        AppendAscii(hash, "tinyrustlm.qwen3-complete-composition-operation.v1\0");
        AppendAscii(hash, CompositionProfileSha256);
        hash.AppendData([0]);
        AppendAscii(hash, modelLockSha256);
        hash.AppendData([0]);
        AppendAscii(hash, tokenizerLockSha256);
        hash.AppendData([0]);
        AppendAscii(hash, converterVersion);
        hash.AppendData([0]);
        AppendAscii(hash, toolSha256);
        return $"qwen3-composition-{Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant()}";
    }

    private static void AppendAscii(IncrementalHash hash, string value) =>
        hash.AppendData(Encoding.ASCII.GetBytes(value));

    private static T Deserialize<T>(byte[] bytes, string code)
    {
        try
        {
            RejectDuplicateJsonProperties(bytes, code);
            return JsonSerializer.Deserialize<T>(bytes, JsonOptions)
                ?? throw new TinyRustLmException(code);
        }
        catch (JsonException)
        {
            throw new TinyRustLmException(code);
        }
    }

    private static void RejectDuplicateJsonProperties(byte[] bytes, string code)
    {
        try
        {
            var reader = new Utf8JsonReader(bytes, new JsonReaderOptions
            {
                AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow,
                MaxDepth = 64
            });
            var objects = new Stack<HashSet<string>>();
            while (reader.Read())
            {
                if (reader.TokenType == JsonTokenType.StartObject)
                {
                    objects.Push(new HashSet<string>(StringComparer.Ordinal));
                }
                else if (reader.TokenType == JsonTokenType.PropertyName)
                {
                    var property = reader.GetString();
                    if (objects.Count == 0 || property is null || !objects.Peek().Add(property))
                    {
                        throw new TinyRustLmException(code);
                    }
                }
                else if (reader.TokenType == JsonTokenType.EndObject)
                {
                    if (objects.Count == 0)
                    {
                        throw new TinyRustLmException(code);
                    }
                    objects.Pop();
                }
            }
            if (objects.Count != 0)
            {
                throw new TinyRustLmException(code);
            }
        }
        catch (JsonException)
        {
            throw new TinyRustLmException(code);
        }
    }

    private static async Task<byte[]> ReadBoundedAsync(
        Stream stream,
        int maximumBytes,
        Process process)
    {
        using var output = new MemoryStream(Math.Min(maximumBytes, 16_384));
        var buffer = new byte[4_096];
        while (true)
        {
            var count = await stream.ReadAsync(buffer).ConfigureAwait(false);
            if (count == 0)
            {
                return output.ToArray();
            }
            if (output.Length + count > maximumBytes)
            {
                TryKill(process);
                throw new ConversionOutputLimitException();
            }
            output.Write(buffer, 0, count);
        }
    }

    private static async Task DrainAfterTermination(params Task<byte[]>[] tasks)
    {
        try
        {
            await Task.WhenAll(tasks).ConfigureAwait(false);
        }
        catch (ConversionOutputLimitException)
        {
        }
    }

    private static string ParseFailureCode(byte[] stderr)
    {
        string text;
        try
        {
            text = new UTF8Encoding(false, true).GetString(stderr).TrimEnd('\r', '\n');
        }
        catch (DecoderFallbackException)
        {
            return "converter-process-failed";
        }
        var match = FailureLine().Match(text);
        return match.Success ? match.Groups[1].Value : "converter-process-failed";
    }

    private static string RequireExistingRegularFile(string value, string argumentName)
    {
        var path = RequirePath(value, argumentName);
        if (!File.Exists(path) ||
            (File.GetAttributes(path) & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)
        {
            throw new FileNotFoundException("A regular file is required.", path);
        }
        return path;
    }

    private static string RequireExistingDirectory(string value, string argumentName)
    {
        var path = RequirePath(value, argumentName);
        if (!Directory.Exists(path) ||
            (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
        {
            throw new DirectoryNotFoundException("A non-reparse directory is required.");
        }
        return path;
    }

    private static string RequireCreateOnlyOutputRoot(string value, string argumentName)
    {
        var path = Path.TrimEndingDirectorySeparator(RequirePath(value, argumentName));
        var parent = Path.GetDirectoryName(path);
        if (string.IsNullOrWhiteSpace(parent))
        {
            throw new ArgumentException("The output root requires an existing parent directory.", argumentName);
        }
        _ = RequireExistingDirectory(parent, argumentName);
        if (File.Exists(path) || Directory.Exists(path))
        {
            throw new IOException("The composition output root already exists and is terminal.");
        }
        return path;
    }

    private static string RequirePath(string value, string argumentName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, argumentName);
        if (value.Length > 32_767 || value.IndexOf('\0', StringComparison.Ordinal) >= 0)
        {
            throw new ArgumentException("The path is too large or contains an embedded NUL.", argumentName);
        }
        return Path.GetFullPath(value);
    }

    private static void RejectReparsePoint(string path, string code)
    {
        if (!Directory.Exists(path) ||
            (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
        {
            throw new TinyRustLmException(code);
        }
    }

    private static ArtifactIdentity ReadIdentity(string path, string code)
    {
        try
        {
            var info = new FileInfo(path);
            if (!info.Exists || info.Length <= 0 ||
                (info.Attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)
            {
                throw new TinyRustLmException(code);
            }
            using var stream = new FileStream(
                path,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                HashBufferBytes,
                FileOptions.SequentialScan);
            var length = stream.Length;
            if (length <= 0)
            {
                throw new TinyRustLmException(code);
            }
            var digest = Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
            if (stream.Position != length || stream.Length != length)
            {
                throw new TinyRustLmException(code);
            }
            return new ArtifactIdentity(checked((ulong)length), digest);
        }
        catch (IOException)
        {
            throw new TinyRustLmException(code);
        }
    }

    private static byte[] ReadBoundedRegularFile(string path, int maximumBytes, string code)
    {
        try
        {
            var info = new FileInfo(path);
            if (!info.Exists || info.Length is <= 0 || info.Length > maximumBytes ||
                (info.Attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)
            {
                throw new TinyRustLmException(code);
            }
            using var stream = new FileStream(
                path,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                65_536,
                FileOptions.SequentialScan);
            var length = stream.Length;
            if (length is <= 0 || length > maximumBytes)
            {
                throw new TinyRustLmException(code);
            }
            var bytes = new byte[checked((int)length)];
            stream.ReadExactly(bytes);
            if (stream.Position != length || stream.Length != length)
            {
                throw new TinyRustLmException(code);
            }
            return bytes;
        }
        catch (IOException)
        {
            throw new TinyRustLmException(code);
        }
    }

    private static string Sha256File(string path)
    {
        using var stream = new FileStream(
            path,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            HashBufferBytes,
            FileOptions.SequentialScan);
        return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
    }

    private static string Sha256Bytes(byte[] bytes) =>
        Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    private static bool IsDigest(string? value) =>
        value is { Length: 64 } && value.All(character =>
            character is (>= '0' and <= '9') or (>= 'a' and <= 'f'));

    private static bool IsOperationId(string? value) =>
        value is { Length: 82 } &&
        value.StartsWith("qwen3-composition-", StringComparison.Ordinal) &&
        IsDigest(value[18..]);

    private static bool IsSafeIdentifier(string? value) =>
        value is { Length: >= 1 and <= 128 } && value.All(character =>
            char.IsAsciiLetterOrDigit(character) || character is '.' or '_' or '-' or '/' or ':');

    private static string RuntimeIdentifier()
    {
        if (!Environment.Is64BitProcess)
        {
            throw new PlatformNotSupportedException("TinyRustLM conversion requires a 64-bit process.");
        }
        var architecture = RuntimeInformation.ProcessArchitecture switch
        {
            Architecture.X64 => "x64",
            Architecture.Arm64 => "arm64",
            _ => throw new PlatformNotSupportedException("TinyRustLM conversion supports x64 and arm64.")
        };
        if (OperatingSystem.IsWindows())
        {
            return $"win-{architecture}";
        }
        if (OperatingSystem.IsLinux())
        {
            return $"linux-{architecture}";
        }
        throw new PlatformNotSupportedException("Packaged TinyRustLM conversion supports Windows and Linux.");
    }

    private static void TryKill(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch (InvalidOperationException)
        {
        }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        AllowTrailingCommas = false,
        PropertyNameCaseInsensitive = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        ReadCommentHandling = JsonCommentHandling.Disallow,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    [GeneratedRegex("^TinyRustLM conversion failed: ([a-z0-9-]{1,128})$", RegexOptions.CultureInvariant)]
    private static partial Regex FailureLine();

    private sealed record NativeConversionSummary(
        string Schema,
        string Status,
        string OperationId,
        string OutputDirectory,
        string ReceiptFile,
        List<NativeArtifactSummary> Artifacts,
        string GraphIdentitySha256,
        string RequiredNextGate);

    private sealed record NativeArtifactSummary(
        string Kind,
        string File,
        ulong ByteLength,
        string Sha256);

    private sealed record NativeCompleteReceipt(
        string Schema,
        string Status,
        string ProfileId,
        string ProfileSha256,
        string OperationId,
        NativeConverterReceipt Converter,
        NativeSourceReceipt Source,
        List<NativeArtifactReceipt> Artifacts,
        NativeGraphReceipt Graph,
        NativeComponentReceipts ComponentReceipts,
        NativeResourceReceipt ResourcePlan,
        NativeDurabilityReceipt Durability,
        string StructuralCompositionStatus,
        string ModelQualityStatus,
        string SourceFrameworkParityStatus,
        string NativeRuntimeStatus,
        string BrowserWasmStatus,
        string BrowserChatStatus,
        [property: JsonPropertyName("p2pAvailabilityStatus")] string P2PAvailabilityStatus,
        string PublicationStatus,
        string RequiredNextGate);

    private sealed record NativeConverterReceipt(string ImplementationVersion, string ExecutableSha256);

    private sealed record NativeSourceReceipt(
        string ModelLockSha256,
        string TokenizerLockSha256,
        string RelationshipStatus);

    private sealed record NativeArtifactReceipt(
        uint Ordinal,
        string Kind,
        string File,
        string FormatProfileId,
        string FormatProfileSha256,
        ulong ByteLength,
        string Sha256);

    private sealed record NativeGraphReceipt(
        string GraphIdentitySha256,
        string MemberTableSha256,
        ulong ResolvedMemberBytes);

    private sealed record NativeComponentReceipt(string File, ulong ByteLength, string Sha256);

    private sealed record NativeComponentReceipts(
        NativeComponentReceipt Model,
        NativeComponentReceipt Tokenizer);

    private sealed record NativeResourceReceipt(
        ulong ModelArtifactBytes,
        ulong ResidentDependencyArtifactBytes,
        uint ModelTensorCount,
        ulong StreamHashBufferBytes);

    private sealed record NativeDurabilityReceipt(
        string OperationId,
        string DirectoryIdentitySha256,
        string Method,
        string OperatingSystem,
        string Architecture,
        string Status);

    private sealed record NativeAttemptReceipt(
        string Schema,
        string Status,
        string ProfileId,
        string ProfileSha256,
        string OperationId,
        string ModelLockSha256,
        string TokenizerLockSha256,
        string ConverterVersion,
        string ConverterExecutableSha256,
        string TerminalRule);

    private sealed record ArtifactExpectation(
        uint Ordinal,
        string Kind,
        string FileName,
        string FormatProfileId,
        string FormatProfileSha256);

    private sealed record ArtifactIdentity(ulong ByteLength, string Sha256);

    private sealed class ConversionOutputLimitException : Exception;
}
