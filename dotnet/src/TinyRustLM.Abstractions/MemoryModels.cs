using System.Text.Json.Serialization;

namespace TinyRustLM;

/// <summary>Advanced persona options for UAIX memory package planning.</summary>
public sealed record UaixAdvancedPersonaOptions(
    bool IncludeAllPersonaDimensions = true,
    bool IncludeWinterStyle = false,
    bool IncludeSpringFallStyle = false,
    bool IncludeSuperFashionStyle = false,
    bool IncludeJewelryChoices = false,
    byte ReligionWorldviewDepth = 0,
    byte PoliticalLeaningDepth = 0,
    byte SenseOfStyleDepth = 0,
    byte PhysicalAppearanceDepth = 0,
    byte BirthAgeGenerationDepth = 0,
    byte RomanticOrientationDepth = 0);

/// <summary>Request that selects the UAIX memory package setup and content-triggered file set.</summary>
public sealed record UaixMemoryPackageRequest(
    string Setup = "base",
    bool CodeLikeArtifacts = false,
    bool ToolPermissions = false,
    bool DelegatedOperations = false,
    bool Deployment = false,
    bool ContactMemory = false,
    bool CalendarScheduling = false,
    bool CommunicationStyle = false,
    bool TasksCommitments = false,
    bool RoutinesPreferences = false,
    bool SafetySupportBoundaries = false,
    bool SourceNotes = false,
    bool PublicFacingBoundaries = false,
    UaixAdvancedPersonaOptions? AdvancedPersona = null);

/// <summary>One package-relative UAIX memory file required by the selected setup.</summary>
public sealed record UaixMemoryRequiredFile(
    string Path,
    string State,
    string Role,
    string Source);

/// <summary>Public boundary statement for the UAIX memory harness.</summary>
public sealed record UaixMemoryBoundary(
    bool HostedImportValidation,
    bool AutomaticRepositoryWrites,
    bool AutomaticLlmWikiSync,
    bool PersonaFidelityCertification,
    bool PersonaSourceMutationAllowed,
    bool UsesTinyrustlmRuntimeHarness);

/// <summary>Machine-checkable summary of the selected UAIX memory file deck.</summary>
public sealed record UaixMemoryFileDeckSummary(
    int TotalRequiredFiles,
    int UniversalRequiredFiles,
    int ProfileRequiredFiles,
    int ConfigurationSpecificRequiredFiles,
    int ContentTriggeredRequiredFiles,
    int AdvancedPersonaRequiredFiles,
    int EvidenceFiles,
    int ExportFiles,
    int PersonaDimensionFiles,
    int TriggeredPersonaStyleAxisFiles,
    bool IncludesManifestJson,
    bool IncludesManifestOverlay,
    bool IncludesPackageModel,
    bool IncludesKnowledgeGraph,
    bool IncludesLlmsExports,
    bool IncludesAgentPickup,
    bool IncludesSessionLog,
    bool IncludesPersonaSourceEvidence,
    bool ClosedRequiredFileSet);

/// <summary>Public descriptor for one supported UAIX memory package setup.</summary>
public sealed record UaixMemorySetupDescriptor(
    string Setup,
    string Label,
    string Summary,
    string SetupUrl,
    IReadOnlyList<string> AuthorityUrls,
    IReadOnlyList<string> PackageFeatures,
    IReadOnlyList<string> ExcludedPrivateCapabilities);

/// <summary>Discoverable catalog of UAIX memory setups supported by the memory harness.</summary>
public sealed record UaixMemorySetupCatalog(
    string Kind,
    int Version,
    IReadOnlyList<UaixMemorySetupDescriptor> Setups,
    int SetupCount,
    IReadOnlyList<string> SourceUrls,
    UaixMemoryBoundary Boundary);

/// <summary>Deterministic required-file plan for a UAIX memory package setup.</summary>
public sealed record UaixMemoryPackagePlan(
    string Kind,
    int Version,
    string Setup,
    IReadOnlyList<UaixMemoryRequiredFile> RequiredFiles,
    UaixMemoryFileDeckSummary FileDeck,
    int RequiredFileCount,
    IReadOnlyList<string> SourceUrls,
    UaixMemoryBoundary Boundary);

/// <summary>Status of one required memory file in an inspected package.</summary>
public sealed record UaixMemoryFileStatus(
    string Path,
    string State,
    string Role,
    bool Exists,
    long ByteCount,
    string? Sha256);

/// <summary>Inspection status for one UAIX advanced persona dimension file.</summary>
public sealed record UaixPersonaDimensionInspection(
    string Dimension,
    string Path,
    bool Exists,
    long ByteCount,
    string? Sha256,
    bool DeclaresDepthLevel,
    [property: JsonPropertyName("depth_level_0_to_10")]
    byte? DepthLevel0To10,
    bool DeclaresDisclosureBoundary,
    bool DeclaresSourceConfidence,
    bool DeclaresNonInferenceRules,
    bool Valid,
    IReadOnlyList<string> Warnings);

/// <summary>Inspection report for a UAIX memory package directory, .zip, or .uaix archive.</summary>
public sealed record UaixMemoryPackageInspection(
    string Kind,
    int Version,
    string PackagePath,
    string PackageSource,
    string Setup,
    IReadOnlyList<UaixMemoryFileStatus> RequiredFiles,
    UaixMemoryFileDeckSummary FileDeck,
    IReadOnlyList<UaixPersonaDimensionInspection> PersonaDimensions,
    bool PersonaDimensionsValid,
    int PersonaDimensionWarningCount,
    IReadOnlyList<string> MissingRequiredFiles,
    IReadOnlyList<string> ManifestMissingRequiredFiles,
    bool ManifestDeclaresRequiredFiles,
    int PackageFileCount,
    bool Valid,
    UaixMemoryManifestInspection? Manifest,
    UaixMemoryBoundary Boundary);

/// <summary>Inspection report for a UAIX memory manifest JSON document.</summary>
public sealed record UaixMemoryManifestInspection(
    string Kind,
    int Version,
    string ManifestSha256,
    string? DeclaredKind,
    string? DeclaredSetup,
    bool AdvancedPersonaProfile,
    int DeclaredFileCount,
    IReadOnlyList<string> DeclaredFilePaths,
    bool Valid,
    IReadOnlyList<string> Warnings);

/// <summary>Public UAIX memory and persona package harness API.</summary>
public interface ITinyRustLmMemoryClient
{
    /// <summary>Returns the public UAIX memory setup catalog supported by this harness.</summary>
    UaixMemorySetupCatalog GetSupportedSetups();

    /// <summary>Returns the public UAIX memory setup catalog as native JSON for audit handoff.</summary>
    string GetSupportedSetupsJson();

    /// <summary>Returns the required-file plan for the selected UAIX memory package setup.</summary>
    UaixMemoryPackagePlan GetRequiredFiles(UaixMemoryPackageRequest? request = null);

    /// <summary>Returns the required-file plan as native JSON for audit handoff.</summary>
    string GetRequiredFilesJson(UaixMemoryPackageRequest? request = null);

    /// <summary>Inspects a memory package directory, .zip, or .uaix archive.</summary>
    UaixMemoryPackageInspection InspectPackage(string packagePath, UaixMemoryPackageRequest? request = null);

    /// <summary>Returns whether a memory package satisfies the selected required-file plan.</summary>
    bool ValidatePackage(string packagePath, UaixMemoryPackageRequest? request = null);

    /// <summary>Inspects a memory manifest JSON document.</summary>
    UaixMemoryManifestInspection InspectManifest(string manifestJson);
}
