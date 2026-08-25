using System.ComponentModel;
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

/// <summary>Immutable, normalized inputs for one exact native composition attempt.</summary>
public sealed record TinyRustLmCompositionConversionIntent(
    string Schema,
    string ModelSourceLockPath,
    string ModelSourceLockSha256,
    string ModelSourceDirectory,
    string TokenizerSourceLockPath,
    string TokenizerSourceLockSha256,
    string TokenizerSourceDirectory,
    string CompositionProfileSha256,
    string OutputRoot,
    string ConverterExecutablePath,
    string ConverterExecutableSha256,
    long MaximumDurationMilliseconds,
    int MaximumSummaryBytes,
    int MaximumErrorBytes,
    string TerminalRule);

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

/// <summary>Facts independently verified from one durable complete-composition output.</summary>
public sealed record TinyRustLmVerifiedComposition(
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
    string RequiredNextGate);

/// <summary>Observations available only to the process that owned native execution.</summary>
public sealed record TinyRustLmCompositionConversionObservation(
    string Schema,
    string SummarySha256,
    TimeSpan Duration);

/// <summary>Durable composition proof plus live execution observations.</summary>
public sealed record TinyRustLmCompositionConversionResult(
    TinyRustLmVerifiedComposition Composition,
    TinyRustLmCompositionConversionObservation Observation);

/// <summary>Valid terminal states discoverable without launching a converter.</summary>
public enum TinyRustLmCompositionTerminalStatus
{
    /// <summary>No mutually exclusive terminal file exists yet.</summary>
    Pending,

    /// <summary>A complete pass was independently verified from durable bytes.</summary>
    Pass,

    /// <summary>A native terminal rejection and its attempt lineage were verified.</summary>
    Rejected
}

/// <summary>One read-only inspection of an exact composition attempt.</summary>
public sealed record TinyRustLmCompositionTerminalInspection(
    TinyRustLmCompositionTerminalStatus Status,
    TinyRustLmVerifiedComposition? Composition,
    string? ErrorCode);

/// <summary>Fail-closed process owner for the sole complete TinyRustLM conversion transaction.</summary>
public sealed partial class TinyRustLmConversionTool
{
    /// <summary>The exact managed intent schema.</summary>
    public const string CompositionIntentSchema =
        "tinyrustlm.qwen3-composition-conversion-intent.v1";

    /// <summary>The exact schema for durable managed composition facts.</summary>
    public const string VerifiedCompositionSchema = "tinyrustlm.verified-composition.v1";

    /// <summary>The exact schema for live-only process observations.</summary>
    public const string LiveObservationSchema =
        "tinyrustlm.composition-conversion-live-observation.v1";

    /// <summary>The registered complete-composition profile identifier.</summary>
    public const string CompositionProfileId = "tinyrustlm.qwen3-complete-composition-conversion/2";

    /// <summary>The SHA-256 of the exact registered complete-composition profile.</summary>
    public const string CompositionProfileSha256 =
        "d6124b6acd174dc6188ca5d7b5a2d334fb33d00f7ef0364b56d9921051121718";

    private const string SummarySchema = "tinyrustlm.qwen3_composition_conversion_cli_summary.v1";
    private const string ReceiptSchema = "tinyrustlm.qwen3_composition_conversion_receipt.v1";
    private const string AttemptSchema = "tinyrustlm.qwen3_composition_attempt.v1";
    private const string RejectionSchema = "tinyrustlm.qwen3_composition_rejection.v1";
    private const string RequiredNextGate =
        "source-native-browser-numerical-parity-untouched-quality-and-product-chat";
    private const string ReceiptFileName = "composition.conversion-receipt.json";
    private const string AttemptFileName = "composition.attempt.json";
    private const string RejectionFileName = "composition.rejection.json";
    private const string TerminalRule = "existing-output-root-is-never-resumed";
    private const int HashBufferBytes = 1_048_576;
    private const int MaximumReceiptBytes = 1_048_576;
    private const int MaximumOutputFiles = 12;
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
            _policy.MaximumDuration.Ticks % TimeSpan.TicksPerMillisecond != 0 ||
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

    /// <summary>Validates, normalizes, and hashes every input before an attempt can start.</summary>
    public TinyRustLmCompositionConversionIntent CreateCompositionIntent(
        TinyRustLmCompositionConversionRequest request)
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
        ValidateTreeRelationships(modelDirectory, tokenizerDirectory, outputRoot);

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

        var intent = new TinyRustLmCompositionConversionIntent(
            CompositionIntentSchema,
            modelLock,
            modelLockSha256,
            modelDirectory,
            tokenizerLock,
            tokenizerLockSha256,
            tokenizerDirectory,
            request.CompositionProfileSha256,
            outputRoot,
            _toolPath,
            Sha256File(_toolPath),
            checked((long)_policy.MaximumDuration.TotalMilliseconds),
            _policy.MaximumSummaryBytes,
            _policy.MaximumErrorBytes,
            TerminalRule);
        ValidateCompositionIntent(intent);
        return intent;
    }

    /// <summary>Validates the immutable intent without requiring its external files to exist.</summary>
    public static void ValidateCompositionIntent(TinyRustLmCompositionConversionIntent intent)
    {
        ArgumentNullException.ThrowIfNull(intent);
        if (intent.Schema != CompositionIntentSchema)
        {
            throw new TinyRustLmException("converter-intent-schema");
        }
        RequireCanonicalPath(intent.ModelSourceLockPath, trimEndingSeparator: false);
        RequireCanonicalPath(intent.ModelSourceDirectory, trimEndingSeparator: true);
        RequireCanonicalPath(intent.TokenizerSourceLockPath, trimEndingSeparator: false);
        RequireCanonicalPath(intent.TokenizerSourceDirectory, trimEndingSeparator: true);
        RequireCanonicalPath(intent.OutputRoot, trimEndingSeparator: true);
        RequireCanonicalPath(intent.ConverterExecutablePath, trimEndingSeparator: false);
        if (!IsDigest(intent.ModelSourceLockSha256) ||
            !IsDigest(intent.TokenizerSourceLockSha256) ||
            !IsDigest(intent.ConverterExecutableSha256))
        {
            throw new TinyRustLmException("converter-intent-identity");
        }
        if (intent.CompositionProfileSha256 != CompositionProfileSha256)
        {
            throw new TinyRustLmException("converter-intent-profile");
        }
        if (intent.MaximumDurationMilliseconds is < 1 or > 604_800_000 ||
            intent.MaximumSummaryBytes is < 1 or > 1_048_576 ||
            intent.MaximumErrorBytes is < 1 or > 65_536)
        {
            throw new TinyRustLmException("converter-intent-policy");
        }
        if (intent.TerminalRule != TerminalRule)
        {
            throw new TinyRustLmException("converter-intent-terminal-rule");
        }
        ValidateTreeRelationships(
            intent.ModelSourceDirectory,
            intent.TokenizerSourceDirectory,
            intent.OutputRoot);
    }

    /// <summary>Runs and independently verifies one exact create-only composition intent.</summary>
    public async Task<TinyRustLmCompositionConversionResult> ConvertCompositionAsync(
        TinyRustLmCompositionConversionIntent intent,
        CancellationToken cancellationToken = default)
    {
        ValidateIntentForLaunch(intent);

        var startInfo = new ProcessStartInfo
        {
            FileName = intent.ConverterExecutablePath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = new UTF8Encoding(false, true),
            StandardErrorEncoding = new UTF8Encoding(false, true),
            UseShellExecute = false,
            CreateNoWindow = true
        };
        startInfo.ArgumentList.Add("qwen3-composition");
        startInfo.ArgumentList.Add(intent.ModelSourceLockPath);
        startInfo.ArgumentList.Add(intent.ModelSourceDirectory);
        startInfo.ArgumentList.Add(intent.TokenizerSourceLockPath);
        startInfo.ArgumentList.Add(intent.TokenizerSourceDirectory);
        startInfo.ArgumentList.Add(intent.OutputRoot);

        cancellationToken.ThrowIfCancellationRequested();
        var stopwatch = Stopwatch.StartNew();
        using var process = StartProcess(startInfo);
        var stdoutTask = ReadBoundedAsync(
            process.StandardOutput.BaseStream,
            intent.MaximumSummaryBytes,
            process);
        var stderrTask = ReadBoundedAsync(
            process.StandardError.BaseStream,
            intent.MaximumErrorBytes,
            process);

        using var timeout = new CancellationTokenSource(
            TimeSpan.FromMilliseconds(intent.MaximumDurationMilliseconds));
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
            intent,
            stdout,
            stopwatch.Elapsed);
        if (!FileHashEquals(intent.ConverterExecutablePath, intent.ConverterExecutableSha256))
        {
            throw new TinyRustLmException("converter-executable-drift");
        }
        return result;
    }

    /// <summary>Inspects one exact output root without launching, adopting, or killing a process.</summary>
    public static TinyRustLmCompositionTerminalInspection InspectCompositionTerminal(
        TinyRustLmCompositionConversionIntent intent)
    {
        ValidateCompositionIntent(intent);
        var inventory = ReadBoundedOutputInventory(intent.OutputRoot);
        if (inventory is null)
        {
            return new TinyRustLmCompositionTerminalInspection(
                TinyRustLmCompositionTerminalStatus.Pending,
                null,
                null);
        }

        var hasPass = inventory.Contains(ReceiptFileName);
        var hasRejection = inventory.Contains(RejectionFileName);
        if (hasPass && hasRejection)
        {
            throw new TinyRustLmException("converter-terminal-collision");
        }
        if (hasPass)
        {
            return new TinyRustLmCompositionTerminalInspection(
                TinyRustLmCompositionTerminalStatus.Pass,
                VerifyDurablePass(intent),
                null);
        }
        if (hasRejection)
        {
            return new TinyRustLmCompositionTerminalInspection(
                TinyRustLmCompositionTerminalStatus.Rejected,
                null,
                VerifyDurableRejection(intent));
        }
        return new TinyRustLmCompositionTerminalInspection(
            TinyRustLmCompositionTerminalStatus.Pending,
            null,
            null);
    }

    private static TinyRustLmCompositionConversionResult VerifySummary(
        TinyRustLmCompositionConversionIntent intent,
        byte[] summaryBytes,
        TimeSpan duration)
    {
        var summary = Deserialize<NativeConversionSummary>(summaryBytes, "converter-summary-json");
        var outputName = Path.GetFileName(intent.OutputRoot);
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

        var composition = VerifyDurablePass(intent);
        if (summary.OperationId != composition.OperationId ||
            summary.GraphIdentitySha256 != composition.GraphIdentitySha256)
        {
            throw new TinyRustLmException("converter-summary-contract");
        }
        var artifacts = composition.Artifacts.InCanonicalOrder();
        for (var index = 0; index < ArtifactExpectations.Length; index++)
        {
            var expected = ArtifactExpectations[index];
            var observed = summary.Artifacts[index];
            var artifact = artifacts[index];
            if (observed.Kind != expected.Kind ||
                observed.File != expected.FileName ||
                observed.ByteLength != artifact.ByteLength ||
                observed.Sha256 != artifact.Sha256)
            {
                throw new TinyRustLmException("converter-artifact-identity");
            }
        }

        return new TinyRustLmCompositionConversionResult(
            composition,
            new TinyRustLmCompositionConversionObservation(
                LiveObservationSchema,
                Sha256Bytes(summaryBytes),
                duration));
    }

    private static TinyRustLmVerifiedComposition VerifyDurablePass(
        TinyRustLmCompositionConversionIntent intent)
    {
        ValidatePassInventory(intent.OutputRoot);
        var receiptPath = Path.Combine(intent.OutputRoot, ReceiptFileName);
        var receiptBytes = ReadBoundedRegularFile(
            receiptPath,
            MaximumReceiptBytes,
            "converter-receipt-file");
        var receipt = Deserialize<NativeCompleteReceipt>(receiptBytes, "converter-receipt-json");
        if (receipt.Artifacts is null || receipt.Artifacts.Count != ArtifactExpectations.Length)
        {
            throw new TinyRustLmException("converter-receipt-contract");
        }

        var verifiedArtifacts = new TinyRustLmCompositionArtifact[ArtifactExpectations.Length];
        for (var index = 0; index < ArtifactExpectations.Length; index++)
        {
            var expected = ArtifactExpectations[index];
            var observed = receipt.Artifacts[index];
            if (observed.Ordinal != expected.Ordinal ||
                observed.Kind != expected.Kind ||
                observed.File != expected.FileName ||
                observed.FormatProfileId != expected.FormatProfileId ||
                observed.FormatProfileSha256 != expected.FormatProfileSha256 ||
                observed.ByteLength == 0 ||
                !IsDigest(observed.Sha256))
            {
                throw new TinyRustLmException("converter-receipt-artifacts");
            }
            var artifactPath = Path.Combine(intent.OutputRoot, expected.FileName);
            var identity = ReadIdentity(artifactPath, "converter-artifact-file");
            if (identity.ByteLength != observed.ByteLength || identity.Sha256 != observed.Sha256)
            {
                throw new TinyRustLmException("converter-receipt-artifacts");
            }
            verifiedArtifacts[index] = new TinyRustLmCompositionArtifact(
                expected.Kind,
                expected.FileName,
                artifactPath,
                identity.ByteLength,
                identity.Sha256);
        }

        ValidateReceipt(receipt, intent, verifiedArtifacts);
        var attempt = ReadAndValidateAttempt(intent);
        if (attempt.OperationId != receipt.OperationId ||
            attempt.ConverterVersion != receipt.Converter.ImplementationVersion)
        {
            throw new TinyRustLmException("converter-attempt-contract");
        }

        return new TinyRustLmVerifiedComposition(
            VerifiedCompositionSchema,
            receipt.OperationId,
            intent.OutputRoot,
            receiptPath,
            Sha256Bytes(receiptBytes),
            new TinyRustLmCompositionArtifactSet(
                verifiedArtifacts[0],
                verifiedArtifacts[1],
                verifiedArtifacts[2],
                verifiedArtifacts[3],
                verifiedArtifacts[4],
                verifiedArtifacts[5]),
            receipt.Graph.GraphIdentitySha256,
            intent.ModelSourceLockSha256,
            intent.TokenizerSourceLockSha256,
            receipt.Converter.ImplementationVersion,
            intent.ConverterExecutableSha256,
            RequiredNextGate);
    }

    private static void ValidateReceipt(
        NativeCompleteReceipt receipt,
        TinyRustLmCompositionConversionIntent intent,
        IReadOnlyList<TinyRustLmCompositionArtifact> artifacts)
    {
        if (receipt.Schema != ReceiptSchema ||
            receipt.Status != "pass" ||
            receipt.ProfileId != CompositionProfileId ||
            receipt.ProfileSha256 != CompositionProfileSha256 ||
            !IsOperationId(receipt.OperationId) ||
            receipt.Converter is null ||
            !IsSafeIdentifier(receipt.Converter.ImplementationVersion) ||
            receipt.Converter.ExecutableSha256 != intent.ConverterExecutableSha256 ||
            receipt.Source is null ||
            receipt.Source.ModelLockSha256 != intent.ModelSourceLockSha256 ||
            receipt.Source.TokenizerLockSha256 != intent.TokenizerSourceLockSha256 ||
            receipt.Source.RelationshipStatus != "exact" ||
            receipt.Artifacts is null ||
            receipt.Artifacts.Count != ArtifactExpectations.Length ||
            receipt.Graph is null ||
            !IsDigest(receipt.Graph.GraphIdentitySha256) ||
            !IsDigest(receipt.Graph.MemberTableSha256) ||
            receipt.Graph.ResolvedMemberBytes == 0 ||
            receipt.ComponentReceipts is null ||
            receipt.ResourcePlan is null ||
            receipt.ResourcePlan.ModelArtifactBytes != artifacts[0].ByteLength ||
            receipt.ResourcePlan.ResidentDependencyArtifactBytes == 0 ||
            receipt.ResourcePlan.ModelTensorCount is 0 or > 2_048 ||
            receipt.ResourcePlan.StreamHashBufferBytes != HashBufferBytes ||
            receipt.Durability is null ||
            receipt.Durability.OperationId != receipt.OperationId ||
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
            intent.ModelSourceLockSha256,
            intent.TokenizerSourceLockSha256,
            receipt.Converter.ImplementationVersion,
            intent.ConverterExecutableSha256);
        if (receipt.OperationId != expectedOperationId)
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
            intent.OutputRoot,
            receipt.ComponentReceipts.Model,
            "model.slm2.conversion-receipt.json");
        ValidateComponentReceipt(
            intent.OutputRoot,
            receipt.ComponentReceipts.Tokenizer,
            "tokenizer.tokenizer2.conversion-receipt.json");
    }

    private static NativeAttemptReceipt ReadAndValidateAttempt(
        TinyRustLmCompositionConversionIntent intent)
    {
        var bytes = ReadBoundedRegularFile(
            Path.Combine(intent.OutputRoot, AttemptFileName),
            MaximumReceiptBytes,
            "converter-attempt-file");
        var attempt = Deserialize<NativeAttemptReceipt>(bytes, "converter-attempt-json");
        if (attempt.Schema != AttemptSchema ||
            attempt.Status != "started" ||
            attempt.ProfileId != CompositionProfileId ||
            attempt.ProfileSha256 != CompositionProfileSha256 ||
            !IsOperationId(attempt.OperationId) ||
            attempt.ModelLockSha256 != intent.ModelSourceLockSha256 ||
            attempt.TokenizerLockSha256 != intent.TokenizerSourceLockSha256 ||
            !IsSafeIdentifier(attempt.ConverterVersion) ||
            attempt.ConverterExecutableSha256 != intent.ConverterExecutableSha256 ||
            attempt.TerminalRule != TerminalRule ||
            attempt.OperationId != ComputeOperationId(
                intent.ModelSourceLockSha256,
                intent.TokenizerSourceLockSha256,
                attempt.ConverterVersion,
                intent.ConverterExecutableSha256))
        {
            throw new TinyRustLmException("converter-attempt-contract");
        }
        return attempt;
    }

    private static string VerifyDurableRejection(TinyRustLmCompositionConversionIntent intent)
    {
        var attempt = ReadAndValidateAttempt(intent);
        var bytes = ReadBoundedRegularFile(
            Path.Combine(intent.OutputRoot, RejectionFileName),
            MaximumReceiptBytes,
            "converter-rejection-file");
        var rejection = Deserialize<NativeRejectionReceipt>(bytes, "converter-rejection-json");
        if (rejection.Schema != RejectionSchema ||
            rejection.Status != "rejected" ||
            rejection.ProfileId != CompositionProfileId ||
            rejection.ProfileSha256 != CompositionProfileSha256 ||
            rejection.OperationId != attempt.OperationId ||
            !IsErrorCode(rejection.ErrorCode) ||
            rejection.SafeNoOp ||
            rejection.Retryable)
        {
            throw new TinyRustLmException("converter-rejection-contract");
        }
        return rejection.ErrorCode;
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

    private static void ValidatePassInventory(string outputRoot)
    {
        var observed = ReadBoundedOutputInventory(outputRoot);
        if (observed is null || observed.Contains(RejectionFileName))
        {
            throw new TinyRustLmException("converter-output-inventory");
        }
        var expected = ArtifactExpectations.Select(value => value.FileName)
            .Concat(EvidenceFileNames)
            .ToHashSet(StringComparer.Ordinal);
        if (!observed.SetEquals(expected))
        {
            throw new TinyRustLmException("converter-output-inventory");
        }
    }

    private static HashSet<string>? ReadBoundedOutputInventory(string outputRoot)
    {
        try
        {
            if (File.Exists(outputRoot))
            {
                throw new TinyRustLmException("converter-output-inventory");
            }
            if (!Directory.Exists(outputRoot))
            {
                return null;
            }
            RejectReparsePoint(outputRoot, "converter-output-inventory");
            var observed = new HashSet<string>(StringComparer.Ordinal);
            foreach (var entry in Directory.EnumerateFileSystemEntries(outputRoot))
            {
                if (observed.Count >= MaximumOutputFiles)
                {
                    throw new TinyRustLmException("converter-output-inventory");
                }
                var attributes = File.GetAttributes(entry);
                var name = Path.GetFileName(entry);
                if (IsInvalidOutputEntry(attributes) ||
                    string.IsNullOrEmpty(name) ||
                    !observed.Add(name))
                {
                    throw new TinyRustLmException("converter-output-inventory");
                }
            }
            return observed;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            throw new TinyRustLmException("converter-output-inventory");
        }
    }

    internal static bool IsInvalidOutputEntry(FileAttributes attributes) =>
        (attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0;

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

    private static Process StartProcess(ProcessStartInfo startInfo)
    {
        try
        {
            return Process.Start(startInfo)
                ?? throw new TinyRustLmException("converter-process-start");
        }
        catch (TinyRustLmException)
        {
            throw;
        }
        catch (Exception error) when (error is Win32Exception or InvalidOperationException)
        {
            throw new TinyRustLmException("converter-process-start");
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

    private void ValidateIntentForLaunch(TinyRustLmCompositionConversionIntent intent)
    {
        ValidateCompositionIntent(intent);
        if (!PathEquals(intent.ConverterExecutablePath, _toolPath) ||
            intent.MaximumDurationMilliseconds !=
                checked((long)_policy.MaximumDuration.TotalMilliseconds) ||
            intent.MaximumSummaryBytes != _policy.MaximumSummaryBytes ||
            intent.MaximumErrorBytes != _policy.MaximumErrorBytes)
        {
            throw new TinyRustLmException("converter-intent-owner");
        }

        var modelLock = RequireExistingRegularFile(
            intent.ModelSourceLockPath,
            nameof(intent.ModelSourceLockPath));
        var modelDirectory = RequireExistingDirectory(
            intent.ModelSourceDirectory,
            nameof(intent.ModelSourceDirectory));
        var tokenizerLock = RequireExistingRegularFile(
            intent.TokenizerSourceLockPath,
            nameof(intent.TokenizerSourceLockPath));
        var tokenizerDirectory = RequireExistingDirectory(
            intent.TokenizerSourceDirectory,
            nameof(intent.TokenizerSourceDirectory));
        var converter = RequireExistingRegularFile(
            intent.ConverterExecutablePath,
            nameof(intent.ConverterExecutablePath));
        var outputRoot = RequireCreateOnlyOutputRoot(intent.OutputRoot, nameof(intent.OutputRoot));
        if (!PathEquals(modelLock, intent.ModelSourceLockPath) ||
            !PathEquals(modelDirectory, intent.ModelSourceDirectory) ||
            !PathEquals(tokenizerLock, intent.TokenizerSourceLockPath) ||
            !PathEquals(tokenizerDirectory, intent.TokenizerSourceDirectory) ||
            !PathEquals(converter, intent.ConverterExecutablePath) ||
            !PathEquals(outputRoot, intent.OutputRoot))
        {
            throw new TinyRustLmException("converter-intent-path-drift");
        }
        ValidateTreeRelationships(modelDirectory, tokenizerDirectory, outputRoot);
        if (!FileHashEquals(modelLock, intent.ModelSourceLockSha256) ||
            !FileHashEquals(tokenizerLock, intent.TokenizerSourceLockSha256) ||
            !FileHashEquals(converter, intent.ConverterExecutableSha256))
        {
            throw new TinyRustLmException("converter-intent-file-drift");
        }
    }

    private static string RequireCanonicalPath(string value, bool trimEndingSeparator)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 32_767 ||
            value.IndexOf('\0', StringComparison.Ordinal) >= 0)
        {
            throw new TinyRustLmException("converter-intent-path");
        }
        try
        {
            var normalized = Path.GetFullPath(value);
            if (trimEndingSeparator)
            {
                normalized = Path.TrimEndingDirectorySeparator(normalized);
            }
            if (!string.Equals(value, normalized, StringComparison.Ordinal))
            {
                throw new TinyRustLmException("converter-intent-path");
            }
            return normalized;
        }
        catch (Exception error) when (error is ArgumentException or NotSupportedException)
        {
            throw new TinyRustLmException("converter-intent-path");
        }
    }

    private static void ValidateTreeRelationships(
        string modelDirectory,
        string tokenizerDirectory,
        string outputRoot)
    {
        if (PathsOverlap(modelDirectory, tokenizerDirectory) ||
            PathsOverlap(modelDirectory, outputRoot) ||
            PathsOverlap(tokenizerDirectory, outputRoot))
        {
            throw new TinyRustLmException("converter-intent-tree-overlap");
        }
    }

    private static bool PathsOverlap(string left, string right) =>
        IsSameOrDescendant(left, right) || IsSameOrDescendant(right, left);

    private static bool IsSameOrDescendant(string candidate, string root)
    {
        if (PathEquals(candidate, root))
        {
            return true;
        }
        var rooted = Path.EndsInDirectorySeparator(root)
            ? root
            : root + Path.DirectorySeparatorChar;
        return candidate.StartsWith(rooted, PathComparison());
    }

    private static bool PathEquals(string left, string right) =>
        string.Equals(left, right, PathComparison());

    private static StringComparison PathComparison() => OperatingSystem.IsWindows()
        ? StringComparison.OrdinalIgnoreCase
        : StringComparison.Ordinal;

    private static bool FileHashEquals(string path, string expected)
    {
        try
        {
            return Sha256File(path) == expected;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            return false;
        }
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

    private static bool IsErrorCode(string? value) =>
        value is { Length: >= 1 and <= 128 } && value.All(character =>
            character is (>= 'a' and <= 'z') or (>= '0' and <= '9') or '-');

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

    private sealed record NativeRejectionReceipt(
        string Schema,
        string Status,
        string ProfileId,
        string ProfileSha256,
        string OperationId,
        string ErrorCode,
        bool SafeNoOp,
        bool Retryable);

    private sealed record ArtifactExpectation(
        uint Ordinal,
        string Kind,
        string FileName,
        string FormatProfileId,
        string FormatProfileSha256);

    private sealed record ArtifactIdentity(ulong ByteLength, string Sha256);

    private sealed class ConversionOutputLimitException : Exception;
}
