using System.Text;
using System.Text.Json;

namespace TinyRustLM;

/// <summary>Native-backed UAIX memory and persona package harness.</summary>
public sealed class TinyRustLmMemoryClient : ITinyRustLmMemoryClient
{
    private const int MaxRequestJsonBytes = 64 * 1024;
    private const int MaxManifestJsonBytes = 512 * 1024;

    /// <inheritdoc />
    public UaixMemorySetupCatalog GetSupportedSetups() =>
        NativeJson.Call<UaixMemorySetupCatalog>(
            NativeMethods.tinyrustlm_memory_supported_setups_json);

    /// <inheritdoc />
    public string GetSupportedSetupsJson()
    {
        var catalog = NativeJson.Call<JsonElement>(
            NativeMethods.tinyrustlm_memory_supported_setups_json);
        return JsonSerializer.Serialize(catalog, NativeJson.SerializerOptions);
    }

    /// <inheritdoc />
    public UaixMemoryPackagePlan GetRequiredFiles(UaixMemoryPackageRequest? request = null)
    {
        using var requestUtf8 = RequestJson(request);
        return NativeJson.Call<UaixMemoryPackagePlan>(() =>
            NativeMethods.tinyrustlm_memory_required_files_json(requestUtf8.Pointer));
    }

    /// <inheritdoc />
    public string GetRequiredFilesJson(UaixMemoryPackageRequest? request = null)
    {
        using var requestUtf8 = RequestJson(request);
        var plan = NativeJson.Call<JsonElement>(() =>
            NativeMethods.tinyrustlm_memory_required_files_json(requestUtf8.Pointer));
        return JsonSerializer.Serialize(plan, NativeJson.SerializerOptions);
    }

    /// <inheritdoc />
    public UaixMemoryPackageInspection InspectPackage(
        string packagePath,
        UaixMemoryPackageRequest? request = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(packagePath);
        NativeJson.ThrowIfContainsEmbeddedNul(packagePath, nameof(packagePath));
        using var pathUtf8 = NativeJson.Utf8(packagePath, nameof(packagePath));
        using var requestUtf8 = RequestJson(request);
        return NativeJson.Call<UaixMemoryPackageInspection>(() =>
            NativeMethods.tinyrustlm_memory_inspect_package_path_json(
                pathUtf8.Pointer,
                requestUtf8.Pointer));
    }

    /// <inheritdoc />
    public bool ValidatePackage(string packagePath, UaixMemoryPackageRequest? request = null) =>
        InspectPackage(packagePath, request).Valid;

    /// <inheritdoc />
    public UaixMemoryManifestInspection InspectManifest(string manifestJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(manifestJson);
        ValidateJsonHandoff(
            manifestJson,
            MaxManifestJsonBytes,
            nameof(manifestJson),
            "UAIX memory manifest JSON");
        using var manifestUtf8 = NativeJson.Utf8(manifestJson, nameof(manifestJson));
        return NativeJson.Call<UaixMemoryManifestInspection>(() =>
            NativeMethods.tinyrustlm_memory_inspect_manifest_json(manifestUtf8.Pointer));
    }

    private static Utf8NativeString RequestJson(UaixMemoryPackageRequest? request)
    {
        if (request is null)
        {
            return NativeJson.Utf8(null);
        }

        ValidateRequest(request);
        var nativeRequest = request with
        {
            AdvancedPersona = request.AdvancedPersona ?? new UaixAdvancedPersonaOptions()
        };
        var json = JsonSerializer.Serialize(nativeRequest, NativeJson.SerializerOptions);
        ValidateJsonHandoff(json, MaxRequestJsonBytes, nameof(request), "UAIX memory package request JSON");
        return NativeJson.Utf8(json, nameof(request));
    }

    private static void ValidateRequest(UaixMemoryPackageRequest request)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Setup);
        NativeJson.ThrowIfContainsEmbeddedNul(request.Setup, nameof(request.Setup));
        var setup = request.Setup.Trim();
        if (setup is not ("base"
            or "agent_file_handoff"
            or "llm_wiki"
            or "file_handoff_llm_wiki"
            or "multi_agent_communication"
            or "talisman_system"
            or "advanced_persona_profile"))
        {
            throw new ArgumentException(
                "Setup must be one of base, agent_file_handoff, llm_wiki, file_handoff_llm_wiki, multi_agent_communication, talisman_system, or advanced_persona_profile.",
                nameof(request.Setup));
        }

        var persona = request.AdvancedPersona;
        if (persona is null)
        {
            return;
        }

        foreach (var (name, value) in new[]
        {
            (nameof(persona.ReligionWorldviewDepth), persona.ReligionWorldviewDepth),
            (nameof(persona.PoliticalLeaningDepth), persona.PoliticalLeaningDepth),
            (nameof(persona.SenseOfStyleDepth), persona.SenseOfStyleDepth),
            (nameof(persona.PhysicalAppearanceDepth), persona.PhysicalAppearanceDepth),
            (nameof(persona.BirthAgeGenerationDepth), persona.BirthAgeGenerationDepth),
            (nameof(persona.RomanticOrientationDepth), persona.RomanticOrientationDepth)
        })
        {
            if (value > 10)
            {
                throw new ArgumentOutOfRangeException(name, value, "Persona depth values must be between 0 and 10.");
            }
        }
    }

    private static void ValidateJsonHandoff(
        string json,
        int maxUtf8Bytes,
        string argumentName,
        string label)
    {
        NativeJson.ThrowIfContainsEmbeddedNul(json, argumentName);
        var byteCount = Encoding.UTF8.GetByteCount(json);
        if (byteCount > maxUtf8Bytes)
        {
            throw new ArgumentException(
                $"{label} exceeds the {maxUtf8Bytes} byte handoff limit.",
                argumentName);
        }
    }
}
