using System.Buffers;
using System.Net;
using System.Net.Http.Headers;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace TinyRustLM.SeedHost;

/// <summary>Owned storage, source-transfer, and Rust execution limits for local model conversion.</summary>
public sealed record SeedHostBridgeConversionOptions(
    string RootDirectory,
    string? ConversionExecutablePath = null,
    TimeSpan? OperationTimeout = null,
    long MaximumSourceBytes = 16L * 1024 * 1024 * 1024,
    long MaximumArtifactBytes = 1024L * 1024 * 1024,
    int MaximumSourceFileCount = 16,
    int MaximumMetadataFileBytes = 16 * 1024 * 1024);

/// <summary>A reviewed, immutable Hugging Face conversion request from the paired browser.</summary>
public sealed record SeedHostBridgeConversionSubmission(
    string ConversionRequestText,
    bool ReviewAccepted);

/// <summary>Public-safe lifecycle state for one durable local conversion.</summary>
public enum SeedHostBridgeConversionState
{
    /// <summary>The request is durable and waiting for the local worker.</summary>
    Queued,
    /// <summary>Immutable source files are downloading directly to the companion.</summary>
    Downloading,
    /// <summary>Rust is reviewing source shape, tokenizer, configuration, and license evidence.</summary>
    Reviewing,
    /// <summary>Rust is converting the reviewed source into a local .slm.</summary>
    Converting,
    /// <summary>Rust receipts and final artifact identity are being revalidated.</summary>
    Validating,
    /// <summary>The verified artifact is ready for browser streaming.</summary>
    Available,
    /// <summary>Transfer or execution stopped safely and can resume.</summary>
    Resumable,
    /// <summary>An identity, license, architecture, or conversion gate rejected the operation.</summary>
    Failed
}

/// <summary>Path-free, credential-free status for one local conversion operation.</summary>
public sealed record SeedHostBridgeConversionStatus(
    string OperationId,
    SeedHostBridgeConversionState State,
    string ModelId,
    string SourceRevision,
    string SourceLicenseId,
    string ModelShape,
    string Quantization,
    long SourceByteCount,
    long DownloadedSourceByteCount,
    int SourceFileCount,
    int DownloadedSourceFileCount,
    long ArtifactByteCount,
    string? ArtifactSha256,
    string? Tokenizer,
    int ContextLength,
    string? PromptFormat,
    bool CanResume,
    string? ErrorCode,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);

internal interface ISeedHostBridgeConversionOperations
{
    ValueTask<SeedHostBridgeConversionStatus> StartConversionAsync(
        SeedHostBridgeConversionSubmission submission,
        CancellationToken cancellationToken = default);

    ValueTask<SeedHostBridgeConversionStatus> GetConversionAsync(
        string operationId,
        CancellationToken cancellationToken = default);

    ValueTask<SeedHostBridgeConversionStatus> CancelConversionAsync(
        string operationId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Durable P2P-fallback conversion coordinator. Source bytes travel from Hugging Face directly to
/// this user-run companion. Rust owns source review, conversion, validation, and receipt authority.
/// </summary>
internal sealed class SeedHostBridgeConversionOperations : IAsyncDisposable
{
    private const int StateSchemaVersion = 3;
    private const string StateFileName = "bridge-conversion-state.v3.json";
    private const int MaximumRequestBytes = 1024 * 1024;
    private const int MaximumStateBytes = 256 * 1024;
    private const int MaximumDiagnosticBytes = 256 * 1024;
    private const int ProgressWriteIntervalBytes = 8 * 1024 * 1024;
    private static readonly TimeSpan DefaultOperationTimeout = TimeSpan.FromHours(6);
    private static readonly Regex ModelIdPattern = new(
        "^[A-Za-z0-9][A-Za-z0-9._-]{0,95}/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);
    private static readonly Regex LicenseIdPattern = new(
        "^[A-Za-z0-9][A-Za-z0-9.+_-]{0,95}$",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);
    private static readonly Regex OperationIdPattern = new(
        "^conversion-[0-9a-f]{64}$",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);
    private static readonly Regex ContentIdPattern = new(
        "^[a-z][a-z0-9-]{0,31}-sha256-[0-9a-f]{64}$",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);
    private static readonly HashSet<string> SupportedShapes = new(StringComparer.Ordinal)
    {
        "stories15m-bpe",
        "smollm2-135m-instruct-bpe",
        "smollm2-360m-instruct-bpe",
        "qwen3-0.6b-bpe",
        "qwen2.5-1.5b-bpe"
    };
    private static readonly HashSet<string> SupportedQuantizations = new(StringComparer.Ordinal)
    {
        "q8_0",
        "q4_0",
        "f32"
    };
    private static readonly JsonSerializerOptions StateJsonOptions = CreateJsonOptions();

    private readonly SeedHostBridgeConversionOptions options;
    private readonly string? converterPath;
    private readonly HttpClient httpClient;
    private readonly bool ownsHttpClient;
    private readonly Dictionary<string, OperationContext> operations = new(StringComparer.Ordinal);
    private readonly object operationsSync = new();
    private readonly SemaphoreSlim executionGate = new(1, 1);
    private bool disposed;

    internal SeedHostBridgeConversionOperations(
        SeedHostBridgeConversionOptions options,
        HttpClient? httpClient = null)
    {
        this.options = ValidateOptions(options);
        converterPath = TinyRustLMConversionExecutableLocator.TryResolve(
            this.options.ConversionExecutablePath);
        this.httpClient = httpClient ?? CreateHttpClient();
        ownsHttpClient = httpClient is null;
        EnsureRegularDirectory(this.options.RootDirectory, create: true);
        LoadPersistedOperations();
    }

    internal int AvailableModelCount
    {
        get
        {
            lock (operationsSync)
            {
                return operations.Values.Count(value =>
                    value.ReadState().State == SeedHostBridgeConversionState.Available);
            }
        }
    }

    internal int ActiveOperationCount
    {
        get
        {
            lock (operationsSync)
            {
                return operations.Values.Count(value => IsActive(value.ReadState().State));
            }
        }
    }

    internal bool IsConverterAvailable => converterPath is not null;

    public ValueTask<SeedHostBridgeConversionStatus> StartConversionAsync(
        SeedHostBridgeConversionSubmission submission,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        var validated = ValidateSubmission(submission);
        cancellationToken.ThrowIfCancellationRequested();
        var operationId = CreateOperationId(validated.RequestBytes);
        OperationContext context;
        lock (operationsSync)
        {
            if (!operations.TryGetValue(operationId, out context!))
            {
                context = CreateOperation(operationId, validated);
                operations.Add(operationId, context);
            }
            else
            {
                VerifyPersistedRequest(context, validated.RequestBytes);
            }

            var state = context.ReadState();
            if ((state.State is SeedHostBridgeConversionState.Queued
                    or SeedHostBridgeConversionState.Resumable)
                && context.Runner is null)
            {
                StartRunner(context);
            }
            return ValueTask.FromResult(ToStatus(context.ReadState()));
        }
    }

    public ValueTask<SeedHostBridgeConversionStatus> GetConversionAsync(
        string operationId,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        cancellationToken.ThrowIfCancellationRequested();
        return ValueTask.FromResult(ToStatus(GetContext(operationId).ReadState()));
    }

    public async ValueTask<SeedHostBridgeConversionStatus> CancelConversionAsync(
        string operationId,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        var context = GetContext(operationId);
        Task? runner;
        lock (context.Sync)
        {
            context.Cancellation?.Cancel();
            runner = context.Runner;
        }
        if (runner is not null)
        {
            await runner.WaitAsync(cancellationToken).ConfigureAwait(false);
        }
        var state = context.ReadState();
        if (IsActive(state.State))
        {
            state = UpdateState(context, value => value with
            {
                State = SeedHostBridgeConversionState.Resumable,
                ErrorCode = "bridge_conversion_cancelled",
                UpdatedUtc = DateTimeOffset.UtcNow
            });
        }
        return ToStatus(state);
    }

    internal ValueTask<IReadOnlyList<SeedHostBridgeModelInfo>> ListModelsAsync(
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        cancellationToken.ThrowIfCancellationRequested();
        List<SeedHostBridgeModelInfo> values;
        lock (operationsSync)
        {
            values = operations.Values
                .Select(value => value.ReadState())
                .Where(value => value.State == SeedHostBridgeConversionState.Available)
                .OrderBy(value => value.ModelId, StringComparer.Ordinal)
                .Select(ToModelInfo)
                .ToList();
        }
        return ValueTask.FromResult<IReadOnlyList<SeedHostBridgeModelInfo>>(values);
    }

    internal async ValueTask<SeedHostBridgeModelContent> OpenModelAsync(
        string operationId,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        var context = GetContext(operationId);
        var state = context.ReadState();
        if (state.State != SeedHostBridgeConversionState.Available)
        {
            throw new SeedHostValidationException(
                "bridge_model_not_available",
                "The converted model has not completed Rust receipt validation.");
        }

        var requestPath = RequireOwnedFile(context, state.RequestFile);
        var preflightPath = RequireOwnedFile(context, Required(state.PreflightFile));
        var receiptPath = RequireOwnedFile(context, Required(state.ReceiptFile));
        var artifactPath = RequireOwnedFile(context, Required(state.ArtifactFile));
        var manifestPath = RequireOwnedFile(context, Required(state.ManifestFile));
        await RunToolAsync(
            context,
            [
                "inspect-huggingface-conversion-receipt",
                receiptPath,
                requestPath,
                preflightPath,
                artifactPath,
                manifestPath
            ],
            cancellationToken).ConfigureAwait(false);
        await RunToolAsync(context, ["validate", artifactPath], cancellationToken)
            .ConfigureAwait(false);

        var information = RequireRegularFile(artifactPath);
        if (information.Length != state.ArtifactByteCount)
        {
            throw new SeedHostValidationException(
                "bridge_model_revalidation_failed",
                "The converted model byte count changed after receipt validation.");
        }
        var sha256 = await Sha256FileAsync(artifactPath, cancellationToken).ConfigureAwait(false);
        if (!string.Equals(sha256, state.ArtifactSha256, StringComparison.Ordinal))
        {
            throw new SeedHostValidationException(
                "bridge_model_revalidation_failed",
                "The converted model identity changed after receipt validation.");
        }
        var stream = new FileStream(
            artifactPath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            128 * 1024,
            FileOptions.Asynchronous | FileOptions.SequentialScan);
        return new SeedHostBridgeModelContent(
            stream,
            state.ModelId,
            state.ArtifactByteCount,
            Required(state.ArtifactSha256));
    }

    internal async ValueTask<SeedHostBridgeCompositionContent> OpenCompositionAsync(
        string operationId,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        var context = GetContext(operationId);
        var state = context.ReadState();
        if (state.State != SeedHostBridgeConversionState.Available)
        {
            throw new SeedHostValidationException(
                "bridge_composition_not_available",
                "The converted model composition has not completed Rust validation.");
        }
        var artifactPath = RequireOwnedFile(context, Required(state.ArtifactFile));
        var graphPath = RequireOwnedFile(context, Required(state.CompositionGraphFile));
        var outcome = ParseCompositionOutcome(await RunToolAsync(
                context,
                ["inspect-composition-graph", artifactPath, graphPath],
                cancellationToken)
            .ConfigureAwait(false));
        RequireCompositionState(state, outcome);
        var information = RequireRegularFile(graphPath);
        if (information.Length != state.CompositionGraphByteCount)
        {
            throw new SeedHostValidationException(
                "bridge_composition_revalidation_failed",
                "The local composition byte count changed after Rust validation.");
        }
        var sha256 = await Sha256FileAsync(graphPath, cancellationToken).ConfigureAwait(false);
        if (!string.Equals(sha256, state.CompositionGraphSha256, StringComparison.Ordinal))
        {
            throw new SeedHostValidationException(
                "bridge_composition_revalidation_failed",
                "The local composition identity changed after Rust validation.");
        }
        var stream = new FileStream(
            graphPath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            16 * 1024,
            FileOptions.Asynchronous | FileOptions.SequentialScan);
        return new SeedHostBridgeCompositionContent(stream, information.Length, sha256);
    }

    private OperationContext CreateOperation(string operationId, ValidatedSubmission submission)
    {
        var conversionsRoot = Path.Combine(options.RootDirectory, "conversions");
        EnsureRegularDirectory(conversionsRoot, create: true);
        var operationRoot = Path.Combine(conversionsRoot, operationId);
        if (Directory.Exists(operationRoot))
        {
            throw new SeedHostValidationException(
                "bridge_conversion_state_conflict",
                "A conversion directory exists without a valid durable operation state.");
        }
        Directory.CreateDirectory(operationRoot);
        EnsureRegularDirectory(operationRoot, create: false);
        var requestFile = "conversion-request.v1.json";
        WriteBytesDurable(Path.Combine(operationRoot, requestFile), submission.RequestBytes);
        var now = DateTimeOffset.UtcNow;
        var state = new PersistedConversionState(
            StateSchemaVersion,
            operationId,
            SeedHostBridgeConversionState.Queued,
            requestFile,
            Sha256Bytes(submission.RequestBytes),
            submission.Request.ModelId,
            submission.Request.Revision,
            submission.Request.LicenseId,
            submission.Request.ModelShape,
            submission.Request.Quantization,
            submission.Request.SourceFiles
                .Concat(submission.Request.MetadataFiles)
                .Sum(value => value.ByteCount),
            0,
            submission.Request.SourceFiles.Count + submission.Request.MetadataFiles.Count,
            0,
            0,
            null,
            Tokenizer(submission.Request.ModelShape),
            ContextLength(submission.Request.ModelShape),
            PromptFormat(submission.Request.ModelShape),
            null,
            null,
            null,
            null,
            null,
            0,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            0,
            null,
            now,
            now);
        PersistState(operationRoot, state);
        return new OperationContext(operationRoot, submission.Request, state);
    }

    private void StartRunner(OperationContext context)
    {
        lock (context.Sync)
        {
            if (context.Runner is not null)
            {
                return;
            }
            context.Cancellation?.Dispose();
            context.Cancellation = new CancellationTokenSource();
            var token = context.Cancellation.Token;
            context.Runner = Task.Run(() => RunOperationAsync(context, token), CancellationToken.None);
        }
    }

    private async Task RunOperationAsync(OperationContext context, CancellationToken cancellationToken)
    {
        try
        {
            await executionGate.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                await RunOperationCoreAsync(context, cancellationToken).ConfigureAwait(false);
            }
            finally
            {
                executionGate.Release();
            }
        }
        catch (OperationCanceledException)
        {
            UpdateState(context, value => value with
            {
                State = SeedHostBridgeConversionState.Resumable,
                ErrorCode = "bridge_conversion_cancelled",
                UpdatedUtc = DateTimeOffset.UtcNow
            });
        }
        catch (Exception error)
        {
            var resumable = error is HttpRequestException or IOException
                || (error is SeedHostException host
                    && host.Code is "process_timeout" or "process_start_failed");
            UpdateState(context, value => value with
            {
                State = resumable
                    ? SeedHostBridgeConversionState.Resumable
                    : SeedHostBridgeConversionState.Failed,
                ErrorCode = ErrorCode(error),
                UpdatedUtc = DateTimeOffset.UtcNow
            });
        }
        finally
        {
            lock (context.Sync)
            {
                context.Runner = null;
            }
        }
    }

    private async Task RunOperationCoreAsync(
        OperationContext context,
        CancellationToken cancellationToken)
    {
        var request = context.Request;
        var inputRoot = Path.Combine(context.RootDirectory, "input");
        var outputRoot = Path.Combine(context.RootDirectory, "output");
        EnsureRegularDirectory(inputRoot, create: true);
        EnsureRegularDirectory(outputRoot, create: true);
        UpdateState(context, value => value with
        {
            State = SeedHostBridgeConversionState.Downloading,
            ErrorCode = null,
            UpdatedUtc = DateTimeOffset.UtcNow
        });

        var downloadedFiles = 0;
        var downloadedBytes = 0L;
        foreach (var sourceFile in request.SourceFiles.Concat(request.MetadataFiles))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var destination = Path.Combine(inputRoot, sourceFile.FileName);
            var byteCount = await DownloadFileAsync(
                    context,
                    sourceFile,
                    destination,
                    downloadedBytes,
                    downloadedFiles,
                    cancellationToken)
                .ConfigureAwait(false);
            downloadedBytes = checked(downloadedBytes + byteCount);
            downloadedFiles++;
            UpdateState(context, value => value with
            {
                DownloadedSourceByteCount = Math.Min(downloadedBytes, value.SourceByteCount),
                DownloadedSourceFileCount = Math.Min(
                    downloadedFiles,
                    value.SourceFileCount),
                UpdatedUtc = DateTimeOffset.UtcNow
            });
        }

        var requestPath = Path.Combine(context.RootDirectory, context.ReadState().RequestFile);
        var configPath = Path.Combine(inputRoot, "config.json");
        var tokenizerPath = Path.Combine(inputRoot, "tokenizer.json");
        var licensePath = Path.Combine(inputRoot, request.LicenseFileName);
        var inputPath = request.SourceFiles.Count == 1
            ? Path.Combine(inputRoot, request.SourceFiles[0].FileName)
            : inputRoot;
        var candidateReviewPath = Path.Combine(context.RootDirectory, "candidate.review");
        var requestInspectionPath = Path.Combine(context.RootDirectory, "conversion-request.inspect");

        UpdateState(context, value => value with
        {
            State = SeedHostBridgeConversionState.Reviewing,
            UpdatedUtc = DateTimeOffset.UtcNow
        });
        await RunToolAsync(
            context,
            ["inspect-huggingface-conversion-request", requestPath, requestInspectionPath],
            cancellationToken).ConfigureAwait(false);
        await RunToolAsync(
            context,
            [
                "review-safetensors-candidate",
                inputPath,
                request.ModelShape,
                request.Quantization,
                request.ModelId,
                request.Revision,
                LocalChecksumFile(configPath),
                LocalChecksumFile(tokenizerPath),
                licensePath,
                candidateReviewPath,
                "-",
                "-",
                "-",
                configPath,
                tokenizerPath
            ],
            cancellationToken).ConfigureAwait(false);
        _ = RequireRegularFile(candidateReviewPath);

        UpdateState(context, value => value with
        {
            State = SeedHostBridgeConversionState.Converting,
            UpdatedUtc = DateTimeOffset.UtcNow
        });
        await RunToolAsync(
            context,
            [
                "convert-huggingface-request",
                requestPath,
                inputPath,
                outputRoot,
                request.ModelShape,
                request.Quantization,
                candidateReviewPath
            ],
            cancellationToken).ConfigureAwait(false);

        UpdateState(context, value => value with
        {
            State = SeedHostBridgeConversionState.Validating,
            UpdatedUtc = DateTimeOffset.UtcNow
        });
        var artifacts = Directory.EnumerateFiles(outputRoot, "*.slm", SearchOption.TopDirectoryOnly)
            .Where(IsRegularFile)
            .ToArray();
        if (artifacts.Length != 1)
        {
            throw new SeedHostValidationException(
                "bridge_conversion_output_invalid",
                "Rust conversion did not produce exactly one regular .slm artifact.");
        }
        var artifactPath = artifacts[0];
        var artifactInfo = RequireRegularFile(artifactPath);
        if (artifactInfo.Length <= 0 || artifactInfo.Length > options.MaximumArtifactBytes)
        {
            throw new SeedHostValidationException(
                "bridge_conversion_output_too_large",
                "The converted .slm is outside the browser artifact byte boundary.");
        }
        var manifestPath = artifactPath + ".manifest";
        var preflightPath = Path.Combine(outputRoot, "tinyrustlm-conversion.preflight");
        var receiptPath = Path.Combine(outputRoot, "tinyrustlm-conversion.receipt");
        _ = RequireRegularFile(manifestPath);
        _ = RequireRegularFile(preflightPath);
        _ = RequireRegularFile(receiptPath);
        await RunToolAsync(context, ["validate", artifactPath], cancellationToken)
            .ConfigureAwait(false);
        await RunToolAsync(
            context,
            [
                "inspect-huggingface-conversion-receipt",
                receiptPath,
                requestPath,
                preflightPath,
                artifactPath,
                manifestPath
            ],
            cancellationToken).ConfigureAwait(false);
        var artifactSha256 = await Sha256FileAsync(artifactPath, cancellationToken)
            .ConfigureAwait(false);
        var graphAuthorityPath = Path.Combine(outputRoot, "base-composition.authority.json");
        var graphPath = artifactPath + ".acg1";
        var tokenizerSha256 = await Sha256FileAsync(tokenizerPath, cancellationToken)
            .ConfigureAwait(false);
        WriteCompositionAuthority(
            graphAuthorityPath,
            request,
            artifactInfo.Length,
            artifactSha256,
            tokenizerSha256);
        var composition = ParseCompositionOutcome(await RunToolAsync(
                context,
                ["composition-graph", artifactPath, graphAuthorityPath, graphPath],
                cancellationToken)
            .ConfigureAwait(false));
        var graphInformation = RequireRegularFile(graphPath);
        if (graphInformation.Length is < 512 or > 16 * 1024 * 1024)
        {
            throw new SeedHostValidationException(
                "bridge_composition_output_invalid",
                "The Rust composition graph is outside its browser byte boundary.");
        }
        var graphSha256 = await Sha256FileAsync(graphPath, cancellationToken).ConfigureAwait(false);
        if (!string.Equals(graphSha256, composition.BundleSha256, StringComparison.Ordinal))
        {
            throw new SeedHostValidationException(
                "bridge_composition_output_invalid",
                "The Rust composition graph identity did not match its authored output.");
        }
        UpdateState(context, value => value with
        {
            State = SeedHostBridgeConversionState.Available,
            ArtifactByteCount = artifactInfo.Length,
            ArtifactSha256 = artifactSha256,
            ArtifactFile = RelativePath(context, artifactPath),
            ManifestFile = RelativePath(context, manifestPath),
            PreflightFile = RelativePath(context, preflightPath),
            ReceiptFile = RelativePath(context, receiptPath),
            CompositionGraphFile = RelativePath(context, graphPath),
            CompositionGraphByteCount = graphInformation.Length,
            CompositionGraphSha256 = graphSha256,
            BaseModelId = composition.BaseModelId,
            CompositionId = composition.CompositionId,
            ActiveGraphSha256 = composition.ActiveGraphSha256,
            RoutePolicyId = composition.RoutePolicyId,
            KvFormatId = composition.KvFormatId,
            PositionPolicySha256 = composition.PositionPolicySha256,
            CompositionMemberCount = composition.MemberCount,
            ErrorCode = null,
            UpdatedUtc = DateTimeOffset.UtcNow
        });
    }

    private async Task<long> DownloadFileAsync(
        OperationContext context,
        SourceFile source,
        string destination,
        long completedBeforeFile,
        int completedFiles,
        CancellationToken cancellationToken)
    {
        if (File.Exists(destination))
        {
            var existing = RequireRegularFile(destination);
            if (existing.Length == source.ByteCount
                && (source.Sha256 is null
                    || string.Equals(
                        await Sha256FileAsync(destination, cancellationToken).ConfigureAwait(false),
                        source.Sha256,
                        StringComparison.Ordinal)))
            {
                return existing.Length;
            }
            File.Delete(destination);
        }

        var partPath = destination + ".part";
        var existingBytes = File.Exists(partPath) ? RequireRegularFile(partPath).Length : 0L;
        if (existingBytes > source.ByteCount)
        {
            File.Delete(partPath);
            existingBytes = 0;
        }
        if (existingBytes == 0 && File.Exists(partPath))
        {
            File.Delete(partPath);
        }
        var requestUri = BuildSourceUri(context.Request.ModelId, context.Request.Revision, source.FileName);
        using var response = await SendSourceRequestAsync(
                requestUri,
                existingBytes,
                cancellationToken)
            .ConfigureAwait(false);
        if (existingBytes > 0 && response.StatusCode == HttpStatusCode.OK)
        {
            File.Delete(partPath);
            existingBytes = 0;
        }
        else if (existingBytes > 0 && response.StatusCode != HttpStatusCode.PartialContent)
        {
            throw new HttpRequestException(
                "The immutable source did not honor a resumable range request.",
                null,
                response.StatusCode);
        }
        response.EnsureSuccessStatusCode();
        if (existingBytes > 0
            && response.Content.Headers.ContentRange?.From != existingBytes)
        {
            throw new HttpRequestException("The immutable source returned a mismatched resume range.");
        }
        var remaining = source.ByteCount - existingBytes;
        var declared = response.Content.Headers.ContentLength;
        if (declared is not null && declared.Value != remaining)
        {
            throw new SeedHostValidationException(
                "bridge_conversion_source_size_mismatch",
                "A source response length disagreed with immutable model metadata.");
        }
        await using var sourceStream = await response.Content.ReadAsStreamAsync(cancellationToken)
            .ConfigureAwait(false);
        await using var destinationStream = new FileStream(
            partPath,
            existingBytes == 0 ? FileMode.CreateNew : FileMode.Append,
            FileAccess.Write,
            FileShare.None,
            128 * 1024,
            FileOptions.Asynchronous | FileOptions.SequentialScan | FileOptions.WriteThrough);
        var buffer = ArrayPool<byte>.Shared.Rent(128 * 1024);
        var total = existingBytes;
        var nextProgress = total + ProgressWriteIntervalBytes;
        try
        {
            while (true)
            {
                var read = await sourceStream.ReadAsync(buffer, cancellationToken).ConfigureAwait(false);
                if (read == 0)
                {
                    break;
                }
                total = checked(total + read);
                if (total > source.ByteCount)
                {
                    throw new SeedHostValidationException(
                        "bridge_conversion_source_size_mismatch",
                        "A source response exceeded its immutable byte count.");
                }
                await destinationStream.WriteAsync(buffer.AsMemory(0, read), cancellationToken)
                    .ConfigureAwait(false);
                if (total >= nextProgress)
                {
                    UpdateState(context, value => value with
                    {
                        DownloadedSourceByteCount = Math.Min(
                            completedBeforeFile + total,
                            value.SourceByteCount),
                        DownloadedSourceFileCount = completedFiles,
                        UpdatedUtc = DateTimeOffset.UtcNow
                    });
                    nextProgress = total + ProgressWriteIntervalBytes;
                }
            }
            await destinationStream.FlushAsync(cancellationToken).ConfigureAwait(false);
            destinationStream.Flush(flushToDisk: true);
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
        if (total != source.ByteCount)
        {
            throw new SeedHostValidationException(
                "bridge_conversion_source_size_mismatch",
                "A source response ended before its immutable byte count.");
        }
        if (source.Sha256 is not null)
        {
            var actualSha256 = await Sha256FileAsync(partPath, cancellationToken).ConfigureAwait(false);
            if (!string.Equals(actualSha256, source.Sha256, StringComparison.Ordinal))
            {
                throw new SeedHostValidationException(
                    "bridge_conversion_source_identity_mismatch",
                    "A downloaded source file failed SHA-256 verification.");
            }
        }
        File.Move(partPath, destination, overwrite: true);
        return total;
    }

    private async Task<HttpResponseMessage> SendSourceRequestAsync(
        Uri initialUri,
        long existingBytes,
        CancellationToken cancellationToken)
    {
        const int maximumRedirects = 5;
        var currentUri = initialUri;
        for (var redirectCount = 0; redirectCount <= maximumRedirects; redirectCount++)
        {
            RequireTrustedSourceUri(currentUri);
            using var request = new HttpRequestMessage(HttpMethod.Get, currentUri);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/octet-stream"));
            request.Headers.UserAgent.ParseAdd("TinyRustLM-Companion/2");
            if (existingBytes > 0)
            {
                request.Headers.Range = new RangeHeaderValue(existingBytes, null);
            }
            var response = await httpClient.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    cancellationToken)
                .ConfigureAwait(false);
            try
            {
                RequireTrustedSourceResponse(response);
                if (!IsRedirect(response.StatusCode))
                {
                    return response;
                }
                if (redirectCount == maximumRedirects || response.Headers.Location is null)
                {
                    throw new HttpRequestException(
                        "The immutable source exceeded its bounded redirect contract.",
                        null,
                        response.StatusCode);
                }
                currentUri = response.Headers.Location.IsAbsoluteUri
                    ? response.Headers.Location
                    : new Uri(currentUri, response.Headers.Location);
                RequireTrustedSourceUri(currentUri);
            }
            catch
            {
                response.Dispose();
                throw;
            }
            response.Dispose();
        }
        throw new HttpRequestException("The immutable source redirect contract was invalid.");
    }

    private static bool IsRedirect(HttpStatusCode statusCode) => statusCode is
        HttpStatusCode.MovedPermanently
        or HttpStatusCode.Redirect
        or HttpStatusCode.RedirectMethod
        or HttpStatusCode.TemporaryRedirect
        or HttpStatusCode.PermanentRedirect;

    private static void WriteCompositionAuthority(
        string path,
        ConversionRequest request,
        long artifactByteCount,
        string artifactSha256,
        string tokenizerSha256)
    {
        var chatTemplateSha256 = Sha256Text(PromptFormat(request.ModelShape));
        var tensorLayoutSha256 = Sha256Text(request.ModelShape);
        var quantizationProfileSha256 = Sha256Text(request.Quantization);
        var executionProfileSha256 = Sha256Text(
            $"{request.ModelShape}\n{request.Quantization}\n{ContextLength(request.ModelShape)}\n{PromptFormat(request.ModelShape)}");
        var routePolicySha256 = Sha256Text(
            $"tinyrustlm.route-policy.single-model.v1\n{request.ModelId}\n{request.Revision}");
        var bytes = JsonSerializer.SerializeToUtf8Bytes(new
        {
            schema = "tinyrustlm.active_composition_authority.v1",
            compositionSemantics = "base-only",
            model = new { bytes = artifactByteCount, sha256 = artifactSha256 },
            executionBindings = new
            {
                tokenizerSha256,
                chatTemplateSha256,
                tensorLayoutSha256,
                quantizationProfileSha256,
                executionProfileSha256
            },
            routePolicyId = $"route-sha256-{routePolicySha256}",
            members = Array.Empty<object>()
        });
        WriteBytesDurable(path, bytes);
    }

    private static CompositionGraphOutcome ParseCompositionOutcome(ProcessRunResult result)
    {
        var lines = result.StandardOutput
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (lines.Length != 9
            || !string.Equals(lines[0], "TinyRustLM composition graph: PASS", StringComparison.Ordinal))
        {
            throw new SeedHostValidationException(
                "bridge_composition_output_invalid",
                "Rust returned an invalid composition identity report.");
        }
        var fields = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var line in lines.Skip(1))
        {
            var separator = line.IndexOf(": ", StringComparison.Ordinal);
            if (separator <= 0
                || !fields.TryAdd(line[..separator], line[(separator + 2)..]))
            {
                throw new SeedHostValidationException(
                    "bridge_composition_output_invalid",
                    "Rust returned duplicate or malformed composition evidence.");
            }
        }
        string Field(string name) => fields.TryGetValue(name, out var value)
            ? value
            : throw new SeedHostValidationException(
                "bridge_composition_output_invalid",
                "Rust omitted required composition evidence.");
        var bundle = RequireDigest(Field("bundle_sha256"));
        var active = RequireDigest(Field("active_graph_digest"));
        var position = RequireDigest(Field("position_policy_sha256"));
        var baseModelId = RequireContentId(Field("base_model_id"));
        var compositionId = RequireContentId(Field("composition_id"));
        var routePolicyId = RequireContentId(Field("route_policy_id"));
        var kvFormatId = RequireContentId(Field("kv_format_id"));
        if (!int.TryParse(Field("member_count"), out var memberCount) || memberCount != 0)
        {
            throw new SeedHostValidationException(
                "bridge_composition_output_invalid",
                "A newly converted base model requires a base-only composition graph.");
        }
        return new CompositionGraphOutcome(
            bundle,
            baseModelId,
            compositionId,
            active,
            routePolicyId,
            kvFormatId,
            position,
            memberCount);
    }

    private static void RequireCompositionState(
        PersistedConversionState state,
        CompositionGraphOutcome outcome)
    {
        if (!string.Equals(state.CompositionGraphSha256, outcome.BundleSha256, StringComparison.Ordinal)
            || !string.Equals(state.BaseModelId, outcome.BaseModelId, StringComparison.Ordinal)
            || !string.Equals(state.CompositionId, outcome.CompositionId, StringComparison.Ordinal)
            || !string.Equals(state.ActiveGraphSha256, outcome.ActiveGraphSha256, StringComparison.Ordinal)
            || !string.Equals(state.RoutePolicyId, outcome.RoutePolicyId, StringComparison.Ordinal)
            || !string.Equals(state.KvFormatId, outcome.KvFormatId, StringComparison.Ordinal)
            || !string.Equals(state.PositionPolicySha256, outcome.PositionPolicySha256, StringComparison.Ordinal)
            || state.CompositionMemberCount != outcome.MemberCount)
        {
            throw new SeedHostValidationException(
                "bridge_composition_revalidation_failed",
                "The local composition identities changed after Rust validation.");
        }
    }

    private static string RequireDigest(string value)
    {
        if (value.Length != 64 || value.Any(character => character is not (>= '0' and <= '9') and not (>= 'a' and <= 'f')))
        {
            throw new SeedHostValidationException(
                "bridge_composition_output_invalid",
                "Rust returned an invalid composition digest.");
        }
        return value;
    }

    private static string RequireContentId(string value)
    {
        if (!ContentIdPattern.IsMatch(value))
        {
            throw new SeedHostValidationException(
                "bridge_composition_output_invalid",
                "Rust returned an invalid typed composition identity.");
        }
        return value;
    }

    private async Task<ProcessRunResult> RunToolAsync(
        OperationContext context,
        IReadOnlyList<string> arguments,
        CancellationToken cancellationToken)
    {
        var executable = converterPath
            ?? throw new SeedHostValidationException(
                "bridge_converter_unavailable",
                "Install a TinyRustLM companion build that contains the reviewed Rust converter.");
        var result = await BoundedProcessRunner.RunAsync(
                new ProcessCommand(executable, arguments, context.RootDirectory),
                new ProcessRunOptions(
                    options.OperationTimeout ?? DefaultOperationTimeout,
                    MaximumDiagnosticBytes),
                cancellationToken)
            .ConfigureAwait(false);
        if (result.ExitCode != 0 || result.OutputTruncated)
        {
            throw new SeedHostValidationException(
                "bridge_conversion_rejected",
                "Rust rejected the source review, conversion, or receipt chain.");
        }
        return result;
    }

    private ValidatedSubmission ValidateSubmission(SeedHostBridgeConversionSubmission submission)
    {
        ArgumentNullException.ThrowIfNull(submission);
        if (!submission.ReviewAccepted)
        {
            throw new SeedHostValidationException(
                "bridge_conversion_review_required",
                "Review the pinned source revision, license, and download size before conversion.");
        }
        if (string.IsNullOrWhiteSpace(submission.ConversionRequestText)
            || submission.ConversionRequestText.Contains('\0'))
        {
            throw new SeedHostValidationException(
                "bridge_conversion_request_invalid",
                "The conversion request must be nonempty NUL-free UTF-8 JSON.");
        }
        var requestBytes = Encoding.UTF8.GetBytes(submission.ConversionRequestText);
        if (requestBytes.Length > MaximumRequestBytes)
        {
            throw new SeedHostValidationException(
                "bridge_conversion_request_too_large",
                "The conversion request exceeded its byte boundary.");
        }
        ConversionRequest request;
        try
        {
            using var document = JsonDocument.Parse(requestBytes, new JsonDocumentOptions
            {
                AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow,
                MaxDepth = 16
            });
            request = ParseRequest(document.RootElement);
        }
        catch (JsonException)
        {
            throw new SeedHostValidationException(
                "bridge_conversion_request_invalid",
                "The conversion request did not match the strict protocol schema.");
        }
        return new ValidatedSubmission(requestBytes, request);
    }

    private ConversionRequest ParseRequest(JsonElement root)
    {
        RequireObjectKeys(root, "request_kind", "source", "requested_artifact", "local_conversion");
        RequireText(root, "request_kind", 96, exact: "minimodel.huggingface_conversion_request.v1");
        var source = RequireObject(root, "source");
        RequireObjectKeys(
            source,
            "kind",
            "model_id",
            "revision",
            "license_id",
            "metadata_files");
        RequireText(source, "kind", 32, exact: "huggingface_model");
        var modelId = RequireText(source, "model_id", 193);
        if (!ModelIdPattern.IsMatch(modelId))
        {
            throw InvalidRequest("source.model_id must be one safe owner/model identity");
        }
        var revision = RequireText(source, "revision", 40).ToLowerInvariant();
        if (revision.Length != 40 || revision.Any(value => !Uri.IsHexDigit(value)))
        {
            throw InvalidRequest("source.revision must be one immutable 40-hex commit");
        }
        var licenseId = RequireText(source, "license_id", 96).ToLowerInvariant();
        if (!LicenseIdPattern.IsMatch(licenseId))
        {
            throw InvalidRequest("source.license_id must be one bounded SPDX-style identifier");
        }

        var artifact = RequireObject(root, "requested_artifact");
        RequireObjectKeys(
            artifact,
            "kind",
            "supported_source_shapes",
            "default_source_shape",
            "default_quantization",
            "runtime_target",
            "browser_import_rule");
        RequireText(artifact, "kind", 16, exact: "slm");
        var shapes = RequireStringArray(artifact, "supported_source_shapes", 1, 8, 64);
        if (shapes.Any(value => !SupportedShapes.Contains(value)))
        {
            throw InvalidRequest("requested_artifact contains an unsupported source shape");
        }
        var modelShape = RequireText(artifact, "default_source_shape", 64);
        if (!SupportedShapes.Contains(modelShape) || !shapes.Contains(modelShape, StringComparer.Ordinal))
        {
            throw InvalidRequest("requested_artifact.default_source_shape is unsupported");
        }
        var quantization = RequireText(artifact, "default_quantization", 16);
        if (!SupportedQuantizations.Contains(quantization))
        {
            throw InvalidRequest("requested_artifact.default_quantization is unsupported");
        }
        RequireText(artifact, "runtime_target", 128, exact: "TinyRustLM Rust/WASM browser-local runtime");
        RequireText(
            artifact,
            "browser_import_rule",
            160,
            exact: "The paired companion streams the receipt-verified local .slm into browser memory.");

        var local = RequireObject(root, "local_conversion");
        RequireObjectKeys(
            local,
            "source_format",
            "source_input_mode",
            "suggested_source_safetensors_file",
            "suggested_source_safetensors_files");
        RequireText(local, "source_format", 32, exact: "safetensors");
        var inputMode = RequireText(local, "source_input_mode", 64);
        if (inputMode is not ("single-safetensors-file" or "safetensors-shard-directory"))
        {
            throw InvalidRequest("local_conversion.source_input_mode is unsupported");
        }
        var sourceFiles = ParseFiles(
            local,
            "suggested_source_safetensors_files",
            requireIdentity: true,
            options.MaximumSourceFileCount,
            options.MaximumSourceBytes);
        var suggested = RequireText(local, "suggested_source_safetensors_file", 180);
        if (!sourceFiles.Any(value => string.Equals(value.FileName, suggested, StringComparison.Ordinal)))
        {
            throw InvalidRequest("The suggested source file is absent from the immutable source set");
        }
        if ((inputMode == "single-safetensors-file") != (sourceFiles.Count == 1))
        {
            throw InvalidRequest("The source input mode disagreed with the immutable source file count");
        }

        var metadataFiles = ParseFiles(
            source,
            "metadata_files",
            requireIdentity: false,
            maximumCount: 8,
            maximumTotalBytes: 8L * options.MaximumMetadataFileBytes);
        RequireMetadata(metadataFiles, "config.json");
        RequireMetadata(metadataFiles, "tokenizer.json");
        var licenseFile = metadataFiles
            .Select(value => value.FileName)
            .FirstOrDefault(value =>
                value.Equals("LICENSE", StringComparison.OrdinalIgnoreCase)
                || value.Equals("LICENSE.txt", StringComparison.OrdinalIgnoreCase)
                || value.Equals("LICENSE.md", StringComparison.OrdinalIgnoreCase)
                || value.Equals("README.md", StringComparison.OrdinalIgnoreCase));
        if (licenseFile is null)
        {
            throw InvalidRequest("Immutable license or model-card evidence is required");
        }
        return new ConversionRequest(
            modelId,
            revision,
            licenseId,
            modelShape,
            quantization,
            sourceFiles,
            metadataFiles,
            licenseFile);
    }

    private IReadOnlyList<SourceFile> ParseFiles(
        JsonElement parent,
        string propertyName,
        bool requireIdentity,
        int maximumCount,
        long maximumTotalBytes)
    {
        if (!parent.TryGetProperty(propertyName, out var array)
            || array.ValueKind != JsonValueKind.Array
            || array.GetArrayLength() is < 1)
        {
            throw InvalidRequest($"{propertyName} must be a nonempty array");
        }
        if (array.GetArrayLength() > maximumCount)
        {
            throw InvalidRequest($"{propertyName} exceeded its file-count boundary");
        }
        var result = new List<SourceFile>();
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var totalBytes = 0L;
        foreach (var element in array.EnumerateArray())
        {
            RequireObjectKeys(element, "file_name", "sha256", "byte_count");
            var fileName = RequireText(element, "file_name", 180);
            ValidateFileName(fileName, requireIdentity ? ".safetensors" : null);
            if (!names.Add(fileName))
            {
                throw InvalidRequest($"{propertyName} contained a duplicate file name");
            }
            var byteCount = RequirePositiveInt64(element, "byte_count");
            if (!requireIdentity && byteCount > options.MaximumMetadataFileBytes)
            {
                throw InvalidRequest("A metadata file exceeded its byte boundary");
            }
            totalBytes = checked(totalBytes + byteCount);
            if (totalBytes > maximumTotalBytes)
            {
                throw InvalidRequest($"{propertyName} exceeded its aggregate byte boundary");
            }
            string? sha256 = null;
            if (element.TryGetProperty("sha256", out var shaElement)
                && shaElement.ValueKind != JsonValueKind.Null)
            {
                sha256 = RequireText(element, "sha256", 71).ToLowerInvariant();
                if (sha256.StartsWith("sha256:", StringComparison.Ordinal))
                {
                    sha256 = sha256[7..];
                }
                if (sha256.Length != 64 || sha256.Any(value => !Uri.IsHexDigit(value)))
                {
                    throw InvalidRequest("A source SHA-256 identity was invalid");
                }
            }
            if (requireIdentity && sha256 is null)
            {
                throw InvalidRequest("Every model source file requires a SHA-256 identity");
            }
            result.Add(new SourceFile(fileName, byteCount, sha256));
        }
        return result;
    }

    private static void RequireMetadata(IReadOnlyList<SourceFile> values, string fileName)
    {
        if (!values.Any(value => value.FileName.Equals(fileName, StringComparison.OrdinalIgnoreCase)))
        {
            throw InvalidRequest($"Immutable {fileName} metadata is required");
        }
    }

    private static void RequireObjectKeys(JsonElement value, params string[] expected)
    {
        if (value.ValueKind != JsonValueKind.Object)
        {
            throw InvalidRequest("A conversion request object was invalid");
        }
        var allowed = expected.ToHashSet(StringComparer.Ordinal);
        var actual = value.EnumerateObject().Select(property => property.Name).ToArray();
        if (actual.Any(name => !allowed.Contains(name))
            || expected.Any(name => !actual.Contains(name, StringComparer.Ordinal)))
        {
            throw InvalidRequest("The conversion request contained missing or unknown fields");
        }
    }

    private static JsonElement RequireObject(JsonElement parent, string name)
    {
        if (!parent.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.Object)
        {
            throw InvalidRequest($"{name} must be an object");
        }
        return value;
    }

    private static string RequireText(
        JsonElement parent,
        string name,
        int maximumCharacters,
        string? exact = null)
    {
        if (!parent.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
        {
            throw InvalidRequest($"{name} must be a string");
        }
        var text = value.GetString() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(text)
            || text.Length > maximumCharacters
            || text.Any(char.IsControl)
            || (exact is not null && !string.Equals(text, exact, StringComparison.Ordinal)))
        {
            throw InvalidRequest($"{name} was invalid");
        }
        return text;
    }

    private static IReadOnlyList<string> RequireStringArray(
        JsonElement parent,
        string name,
        int minimumCount,
        int maximumCount,
        int maximumCharacters)
    {
        if (!parent.TryGetProperty(name, out var value)
            || value.ValueKind != JsonValueKind.Array
            || value.GetArrayLength() < minimumCount
            || value.GetArrayLength() > maximumCount)
        {
            throw InvalidRequest($"{name} must be a bounded string array");
        }
        var result = value.EnumerateArray()
            .Select(element => element.ValueKind == JsonValueKind.String
                ? element.GetString() ?? string.Empty
                : string.Empty)
            .ToArray();
        if (result.Any(text =>
                string.IsNullOrWhiteSpace(text)
                || text.Length > maximumCharacters
                || text.Any(char.IsControl))
            || result.Distinct(StringComparer.Ordinal).Count() != result.Length)
        {
            throw InvalidRequest($"{name} contained an invalid or duplicate value");
        }
        return result;
    }

    private static long RequirePositiveInt64(JsonElement parent, string name)
    {
        if (!parent.TryGetProperty(name, out var value)
            || value.ValueKind != JsonValueKind.Number
            || !value.TryGetInt64(out var result)
            || result <= 0)
        {
            throw InvalidRequest($"{name} must be a positive integer");
        }
        return result;
    }

    private static void ValidateFileName(string value, string? requiredExtension)
    {
        if (Path.GetFileName(value) != value
            || value is "." or ".."
            || value.Contains('/')
            || value.Contains('\\')
            || value.Contains(':')
            || value.Any(char.IsControl)
            || (requiredExtension is not null
                && !value.EndsWith(requiredExtension, StringComparison.OrdinalIgnoreCase)))
        {
            throw InvalidRequest("A source file name was unsafe or had the wrong extension");
        }
    }

    private void LoadPersistedOperations()
    {
        var conversionsRoot = Path.Combine(options.RootDirectory, "conversions");
        if (!Directory.Exists(conversionsRoot))
        {
            return;
        }
        EnsureRegularDirectory(conversionsRoot, create: false);
        foreach (var directory in Directory.EnumerateDirectories(conversionsRoot))
        {
            EnsureRegularDirectory(directory, create: false);
            var operationId = Path.GetFileName(directory);
            if (!OperationIdPattern.IsMatch(operationId))
            {
                continue;
            }
            var statePath = Path.Combine(directory, StateFileName);
            if (!File.Exists(statePath))
            {
                continue;
            }
            var stateInfo = RequireRegularFile(statePath);
            if (stateInfo.Length is <= 0 or > MaximumStateBytes)
            {
                throw new SeedHostValidationException(
                    "bridge_conversion_state_invalid",
                    "Persisted conversion state exceeded its byte boundary.");
            }
            var state = JsonSerializer.Deserialize<PersistedConversionState>(
                    File.ReadAllBytes(statePath),
                    StateJsonOptions)
                ?? throw new SeedHostValidationException(
                    "bridge_conversion_state_invalid",
                    "Persisted conversion state was empty.");
            ValidatePersistedState(directory, state);
            var requestPath = RequireOwnedFile(directory, state.RequestFile);
            var requestBytes = File.ReadAllBytes(requestPath);
            if (!string.Equals(Sha256Bytes(requestBytes), state.RequestContentSha256, StringComparison.Ordinal))
            {
                throw new SeedHostValidationException(
                    "bridge_conversion_state_invalid",
                    "Persisted conversion request identity changed.");
            }
            var request = ValidateSubmission(new SeedHostBridgeConversionSubmission(
                Encoding.UTF8.GetString(requestBytes),
                ReviewAccepted: true)).Request;
            if (IsActive(state.State))
            {
                state = state with
                {
                    State = SeedHostBridgeConversionState.Resumable,
                    ErrorCode = "bridge_conversion_interrupted",
                    UpdatedUtc = DateTimeOffset.UtcNow
                };
                PersistState(directory, state);
            }
            operations.Add(operationId, new OperationContext(directory, request, state));
        }
    }

    private static void ValidatePersistedState(string root, PersistedConversionState state)
    {
        if (state.SchemaVersion != StateSchemaVersion
            || !OperationIdPattern.IsMatch(state.OperationId)
            || !string.Equals(Path.GetFileName(root), state.OperationId, StringComparison.Ordinal)
            || !ModelIdPattern.IsMatch(state.ModelId)
            || state.SourceRevision.Length != 40
            || state.SourceRevision.Any(value => !Uri.IsHexDigit(value))
            || !LicenseIdPattern.IsMatch(state.SourceLicenseId)
            || !SupportedShapes.Contains(state.ModelShape)
            || !SupportedQuantizations.Contains(state.Quantization)
            || state.SourceByteCount <= 0
            || state.DownloadedSourceByteCount < 0
            || state.DownloadedSourceByteCount > state.SourceByteCount
            || state.SourceFileCount <= 0
            || state.DownloadedSourceFileCount < 0
            || state.ArtifactByteCount < 0)
        {
            throw new SeedHostValidationException(
                "bridge_conversion_state_invalid",
                "Persisted conversion state failed its structural contract.");
        }
        _ = RequireOwnedFile(root, state.RequestFile);
        if (state.State == SeedHostBridgeConversionState.Available)
        {
            if (state.ArtifactByteCount <= 0
                || state.CompositionGraphByteCount is < 512 or > 16 * 1024 * 1024
                || state.CompositionMemberCount != 0
                || !IsDigest(state.ArtifactSha256)
                || !IsDigest(state.CompositionGraphSha256)
                || !IsDigest(state.ActiveGraphSha256)
                || !IsDigest(state.PositionPolicySha256)
                || !IsContentId(state.BaseModelId, "model-sha256-")
                || !IsContentId(state.CompositionId, "composition-sha256-")
                || !IsContentId(state.RoutePolicyId, "route-sha256-")
                || !IsContentId(state.KvFormatId, "kv-format-sha256-"))
            {
                throw new SeedHostValidationException(
                    "bridge_conversion_state_invalid",
                    "Persisted available conversion identities were incomplete.");
            }
            _ = RequireOwnedFile(root, Required(state.ArtifactFile));
            _ = RequireOwnedFile(root, Required(state.ManifestFile));
            _ = RequireOwnedFile(root, Required(state.PreflightFile));
            _ = RequireOwnedFile(root, Required(state.ReceiptFile));
            _ = RequireOwnedFile(root, Required(state.CompositionGraphFile));
        }
    }

    private static bool IsDigest(string? value) =>
        value is not null
        && value.Length == 64
        && value.All(character => character is >= '0' and <= '9' or >= 'a' and <= 'f');

    private static bool IsContentId(string? value, string prefix) =>
        value is not null
        && value.StartsWith(prefix, StringComparison.Ordinal)
        && IsDigest(value[prefix.Length..]);

    private OperationContext GetContext(string operationId)
    {
        if (!OperationIdPattern.IsMatch(operationId ?? string.Empty))
        {
            throw new SeedHostValidationException(
                "bridge_conversion_id_invalid",
                "The conversion operation ID was invalid.");
        }
        lock (operationsSync)
        {
            if (!operations.TryGetValue(operationId!, out var context))
            {
                throw new SeedHostValidationException(
                    "bridge_conversion_not_found",
                    "The conversion operation does not exist.");
            }
            return context;
        }
    }

    private static string CreateOperationId(byte[] requestBytes)
    {
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        hash.AppendData("TinyRustLM bridge conversion v2\0"u8);
        hash.AppendData(requestBytes);
        return $"conversion-{Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant()}";
    }

    private static void VerifyPersistedRequest(OperationContext context, byte[] requestBytes)
    {
        var state = context.ReadState();
        if (!string.Equals(Sha256Bytes(requestBytes), state.RequestContentSha256, StringComparison.Ordinal))
        {
            throw new SeedHostValidationException(
                "bridge_conversion_id_collision",
                "A conversion operation identity collided with different request bytes.");
        }
    }

    private static PersistedConversionState UpdateState(
        OperationContext context,
        Func<PersistedConversionState, PersistedConversionState> update)
    {
        lock (context.Sync)
        {
            var next = update(context.State);
            PersistState(context.RootDirectory, next);
            context.State = next;
            return next;
        }
    }

    private static void PersistState(string rootDirectory, PersistedConversionState state)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(state, StateJsonOptions);
        if (bytes.Length > MaximumStateBytes)
        {
            throw new SeedHostValidationException(
                "bridge_conversion_state_too_large",
                "Conversion state exceeded its durable byte boundary.");
        }
        WriteBytesDurable(Path.Combine(rootDirectory, StateFileName), bytes);
    }

    private static void WriteBytesDurable(string path, ReadOnlySpan<byte> bytes)
    {
        var parent = Path.GetDirectoryName(path)
            ?? throw new SeedHostValidationException(
                "bridge_conversion_path_invalid",
                "A durable conversion path had no parent directory.");
        EnsureRegularDirectory(parent, create: true);
        var temporary = Path.Combine(parent, $".{Path.GetFileName(path)}.{Guid.NewGuid():N}.tmp");
        try
        {
            using (var stream = new FileStream(
                temporary,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                64 * 1024,
                FileOptions.WriteThrough))
            {
                stream.Write(bytes);
                stream.Flush(flushToDisk: true);
            }
            File.Move(temporary, path, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporary))
            {
                File.Delete(temporary);
            }
        }
    }

    private static string RelativePath(OperationContext context, string path)
    {
        var relative = Path.GetRelativePath(context.RootDirectory, path);
        _ = RequireOwnedPath(context.RootDirectory, relative);
        return relative.Replace(Path.DirectorySeparatorChar, '/');
    }

    private static string RequireOwnedFile(OperationContext context, string relativePath) =>
        RequireOwnedFile(context.RootDirectory, relativePath);

    private static string RequireOwnedFile(string root, string relativePath)
    {
        var path = RequireOwnedPath(root, relativePath);
        _ = RequireRegularFile(path);
        return path;
    }

    private static string RequireOwnedPath(string root, string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)
            || Path.IsPathRooted(relativePath)
            || relativePath.Contains('\0'))
        {
            throw new SeedHostValidationException(
                "bridge_conversion_path_invalid",
                "A conversion path must be a nonempty relative path.");
        }
        var fullRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        var fullPath = Path.GetFullPath(Path.Combine(root, relativePath));
        if (!IsOwnedFullPath(fullRoot, fullPath))
        {
            throw new SeedHostValidationException(
                "bridge_conversion_path_escape",
                "A conversion path escaped its owned operation directory.");
        }
        return fullPath;
    }

    internal static bool IsOwnedFullPath(string fullRoot, string fullPath) =>
        fullPath.StartsWith(
            fullRoot,
            OperatingSystem.IsWindows()
                ? StringComparison.OrdinalIgnoreCase
                : StringComparison.Ordinal);

    private static FileInfo RequireRegularFile(string path)
    {
        var information = new FileInfo(path);
        if (!information.Exists
            || (information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                "bridge_conversion_file_invalid",
                "A conversion artifact was missing, linked, or not a regular file.");
        }
        return information;
    }

    private static bool IsRegularFile(string path)
    {
        try
        {
            _ = RequireRegularFile(path);
            return true;
        }
        catch (SeedHostValidationException)
        {
            return false;
        }
    }

    private static void EnsureRegularDirectory(string path, bool create)
    {
        if (create)
        {
            Directory.CreateDirectory(path);
        }
        var information = new DirectoryInfo(path);
        if (!information.Exists
            || (information.Attributes & FileAttributes.ReparsePoint) != 0
            || information.LinkTarget is not null)
        {
            throw new SeedHostValidationException(
                "bridge_conversion_root_unsafe",
                "Conversion storage must use regular non-link directories.");
        }
    }

    private static Uri BuildSourceUri(string modelId, string revision, string fileName)
    {
        var modelPath = string.Join('/', modelId.Split('/').Select(Uri.EscapeDataString));
        return new Uri(
            $"https://huggingface.co/{modelPath}/resolve/{revision}/{Uri.EscapeDataString(fileName)}",
            UriKind.Absolute);
    }

    private static void RequireTrustedSourceResponse(HttpResponseMessage response)
    {
        var resolved = response.RequestMessage?.RequestUri;
        if (resolved is null)
        {
            throw UntrustedSourceRedirect();
        }
        RequireTrustedSourceUri(resolved);
    }

    private static void RequireTrustedSourceUri(Uri value)
    {
        if (!IsTrustedSourceUri(value))
        {
            throw UntrustedSourceRedirect();
        }
    }

    internal static bool IsTrustedSourceUri(Uri value)
    {
        if (!value.IsAbsoluteUri
            || !string.Equals(value.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
            || !value.IsDefaultPort
            || !string.IsNullOrEmpty(value.UserInfo))
        {
            return false;
        }
        var host = value.IdnHost;
        return host.Equals("huggingface.co", StringComparison.OrdinalIgnoreCase)
            || host.EndsWith(".huggingface.co", StringComparison.OrdinalIgnoreCase)
            || host.Equals("hf.co", StringComparison.OrdinalIgnoreCase)
            || host.EndsWith(".hf.co", StringComparison.OrdinalIgnoreCase);
    }

    private static SeedHostValidationException UntrustedSourceRedirect() => new(
        "bridge_conversion_source_redirect_untrusted",
        "The model source redirected outside the trusted Hugging Face HTTPS boundary.");

    private static async Task<string> Sha256FileAsync(
        string path,
        CancellationToken cancellationToken)
    {
        await using var stream = new FileStream(
            path,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            128 * 1024,
            FileOptions.Asynchronous | FileOptions.SequentialScan);
        var digest = await SHA256.HashDataAsync(stream, cancellationToken).ConfigureAwait(false);
        return Convert.ToHexString(digest).ToLowerInvariant();
    }

    private static string Sha256Bytes(ReadOnlySpan<byte> bytes) =>
        Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    private static string Sha256Text(string value) =>
        Sha256Bytes(Encoding.UTF8.GetBytes(value));

    private static string LocalChecksumFile(string path)
    {
        var bytes = File.ReadAllBytes(path);
        ulong accumulator = 0x6eed0e9da4d94a4f;
        for (var index = 0; index < bytes.Length; index++)
        {
            accumulator ^= unchecked((ulong)bytes[index] + ((ulong)index << 3));
            accumulator = unchecked(BitOperations.RotateLeft(accumulator, 11) * 0x100000001b3);
        }
        return $"0x{accumulator:x16}";
    }

    private static int ContextLength(string modelShape) => modelShape switch
    {
        "stories15m-bpe" => 256,
        "smollm2-135m-instruct-bpe" or "smollm2-360m-instruct-bpe" => 8192,
        "qwen3-0.6b-bpe" or "qwen2.5-1.5b-bpe" => 1024,
        _ => throw InvalidRequest("The source shape has no browser context contract")
    };

    private static string PromptFormat(string modelShape) => modelShape switch
    {
        "smollm2-135m-instruct-bpe" or "smollm2-360m-instruct-bpe"
            or "qwen2.5-1.5b-bpe" => "chatml-v1",
        "qwen3-0.6b-bpe" => "qwen3-chatml-no-think-v1",
        _ => "raw-completion-v1"
    };

    private static string Tokenizer(string modelShape) => modelShape switch
    {
        "stories15m-bpe" => "llama-bpe-v1",
        "smollm2-135m-instruct-bpe" or "smollm2-360m-instruct-bpe"
            or "qwen3-0.6b-bpe" or "qwen2.5-1.5b-bpe" => "gpt2-bpe-v1",
        _ => throw InvalidRequest("The source shape has no tokenizer contract")
    };

    private static SeedHostBridgeModelInfo ToModelInfo(PersistedConversionState value) => new(
        value.OperationId,
        value.ModelId,
        value.ArtifactByteCount,
        Required(value.ArtifactSha256),
        0,
        "conversion",
        value.SourceRevision,
        value.ModelShape,
        value.Quantization,
        value.Tokenizer,
        value.ContextLength,
        value.PromptFormat,
        value.CompositionGraphByteCount,
        value.CompositionGraphSha256,
        value.BaseModelId,
        value.CompositionId,
        value.ActiveGraphSha256,
        value.RoutePolicyId,
        value.KvFormatId,
        value.PositionPolicySha256,
        value.CompositionMemberCount);

    private static SeedHostBridgeConversionStatus ToStatus(PersistedConversionState value) => new(
        value.OperationId,
        value.State,
        value.ModelId,
        value.SourceRevision,
        value.SourceLicenseId,
        value.ModelShape,
        value.Quantization,
        value.SourceByteCount,
        value.DownloadedSourceByteCount,
        value.SourceFileCount,
        value.DownloadedSourceFileCount,
        value.ArtifactByteCount,
        value.ArtifactSha256,
        value.Tokenizer,
        value.ContextLength,
        value.PromptFormat,
        value.State == SeedHostBridgeConversionState.Resumable,
        value.ErrorCode,
        value.CreatedUtc,
        value.UpdatedUtc);

    private static bool IsActive(SeedHostBridgeConversionState value) => value is
        SeedHostBridgeConversionState.Queued
        or SeedHostBridgeConversionState.Downloading
        or SeedHostBridgeConversionState.Reviewing
        or SeedHostBridgeConversionState.Converting
        or SeedHostBridgeConversionState.Validating;

    private static string ErrorCode(Exception error) => error switch
    {
        SeedHostException host => host.Code,
        HttpRequestException => "bridge_conversion_source_unavailable",
        IOException => "bridge_conversion_io_failed",
        _ => "bridge_conversion_failed"
    };

    private static SeedHostValidationException InvalidRequest(string message) => new(
        "bridge_conversion_request_invalid",
        message);

    private static string Required(string? value) =>
        !string.IsNullOrWhiteSpace(value)
            ? value
            : throw new SeedHostValidationException(
                "bridge_conversion_state_invalid",
                "A completed conversion state omitted required evidence.");

    private static SeedHostBridgeConversionOptions ValidateOptions(
        SeedHostBridgeConversionOptions value)
    {
        ArgumentNullException.ThrowIfNull(value);
        ArgumentException.ThrowIfNullOrWhiteSpace(value.RootDirectory);
        if (value.RootDirectory.Contains('\0')
            || value.MaximumSourceBytes is < 1024 or > 64L * 1024 * 1024 * 1024
            || value.MaximumArtifactBytes is < 1024 or > 2L * 1024 * 1024 * 1024
            || value.MaximumSourceFileCount is < 1 or > 64
            || value.MaximumMetadataFileBytes is < 1024 or > 64 * 1024 * 1024
            || (value.OperationTimeout is not null
                && (value.OperationTimeout <= TimeSpan.Zero
                    || value.OperationTimeout > TimeSpan.FromDays(1))))
        {
            throw new SeedHostValidationException(
                "bridge_conversion_options_invalid",
                "Conversion storage or resource limits were invalid.");
        }
        var converter = string.IsNullOrWhiteSpace(value.ConversionExecutablePath)
            ? null
            : Path.GetFullPath(value.ConversionExecutablePath);
        return value with
        {
            RootDirectory = Path.GetFullPath(value.RootDirectory),
            ConversionExecutablePath = converter
        };
    }

    private static HttpClient CreateHttpClient()
    {
        var handler = new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.None,
            UseCookies = false,
            UseProxy = true,
            ConnectTimeout = TimeSpan.FromSeconds(30),
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
            MaxConnectionsPerServer = 2
        };
        return new HttpClient(handler, disposeHandler: true)
        {
            Timeout = Timeout.InfiniteTimeSpan
        };
    }

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var value = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            PropertyNameCaseInsensitive = false,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
        value.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower));
        return value;
    }

    private void ThrowIfDisposed() => ObjectDisposedException.ThrowIf(disposed, this);

    public async ValueTask DisposeAsync()
    {
        Task[] runners;
        lock (operationsSync)
        {
            if (disposed)
            {
                return;
            }
            disposed = true;
            foreach (var context in operations.Values)
            {
                lock (context.Sync)
                {
                    context.Cancellation?.Cancel();
                }
            }
            runners = operations.Values
                .Select(value => value.Runner)
                .Where(value => value is not null)
                .Cast<Task>()
                .ToArray();
        }
        await Task.WhenAll(runners).ConfigureAwait(false);
        foreach (var context in operations.Values)
        {
            context.Cancellation?.Dispose();
        }
        executionGate.Dispose();
        if (ownsHttpClient)
        {
            httpClient.Dispose();
        }
    }

    private sealed record ValidatedSubmission(byte[] RequestBytes, ConversionRequest Request);

    private sealed record ConversionRequest(
        string ModelId,
        string Revision,
        string LicenseId,
        string ModelShape,
        string Quantization,
        IReadOnlyList<SourceFile> SourceFiles,
        IReadOnlyList<SourceFile> MetadataFiles,
        string LicenseFileName);

    private sealed record SourceFile(string FileName, long ByteCount, string? Sha256);

    private sealed record CompositionGraphOutcome(
        string BundleSha256,
        string BaseModelId,
        string CompositionId,
        string ActiveGraphSha256,
        string RoutePolicyId,
        string KvFormatId,
        string PositionPolicySha256,
        int MemberCount);

    private sealed class OperationContext(
        string rootDirectory,
        ConversionRequest request,
        PersistedConversionState state)
    {
        internal object Sync { get; } = new();
        internal string RootDirectory { get; } = rootDirectory;
        internal ConversionRequest Request { get; } = request;
        internal PersistedConversionState State { get; set; } = state;
        internal CancellationTokenSource? Cancellation { get; set; }
        internal Task? Runner { get; set; }

        internal PersistedConversionState ReadState()
        {
            lock (Sync)
            {
                return State;
            }
        }
    }

    private sealed record PersistedConversionState(
        int SchemaVersion,
        string OperationId,
        SeedHostBridgeConversionState State,
        string RequestFile,
        string RequestContentSha256,
        string ModelId,
        string SourceRevision,
        string SourceLicenseId,
        string ModelShape,
        string Quantization,
        long SourceByteCount,
        long DownloadedSourceByteCount,
        int SourceFileCount,
        int DownloadedSourceFileCount,
        long ArtifactByteCount,
        string? ArtifactSha256,
        string? Tokenizer,
        int ContextLength,
        string? PromptFormat,
        string? ArtifactFile,
        string? ManifestFile,
        string? PreflightFile,
        string? ReceiptFile,
        string? CompositionGraphFile,
        long CompositionGraphByteCount,
        string? CompositionGraphSha256,
        string? BaseModelId,
        string? CompositionId,
        string? ActiveGraphSha256,
        string? RoutePolicyId,
        string? KvFormatId,
        string? PositionPolicySha256,
        int CompositionMemberCount,
        string? ErrorCode,
        DateTimeOffset CreatedUtc,
        DateTimeOffset UpdatedUtc);
}
