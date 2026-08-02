using System.Text;

namespace TinyRustLM.SeedHost;

/// <summary>Owned location and file name for an atomic seed-fleet store.</summary>
public sealed record SeedFleetStoreOptions(
    string RootDirectory,
    string ConfigurationFileName = "seed-fleet.v0.json");

/// <summary>Associates one endpoint with the lane that owns its process.</summary>
public sealed record SeedLaneEndpointAssignment(
    string LaneId,
    SeedFleetEndpoint Endpoint);

/// <summary>Atomic, serialized fleet mutation backed by Rust validation before commit.</summary>
public sealed class SeedFleetStore : IAsyncDisposable
{
    private const long MaxConfigurationBytes = 4 * 1024 * 1024;
    private readonly IMiniModelAuthority authority;
    private readonly SemaphoreSlim mutationLock = new(1, 1);
    private bool disposed;

    /// <summary>Create a store rooted in an explicitly owned directory.</summary>
    public SeedFleetStore(SeedFleetStoreOptions options, IMiniModelAuthority authority)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(authority);
        ArgumentException.ThrowIfNullOrWhiteSpace(options.RootDirectory);
        if (string.IsNullOrWhiteSpace(options.ConfigurationFileName)
            || !string.Equals(
                Path.GetFileName(options.ConfigurationFileName),
                options.ConfigurationFileName,
                StringComparison.Ordinal)
            || !options.ConfigurationFileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
        {
            throw new SeedHostValidationException(
                "invalid_configuration_file_name",
                "ConfigurationFileName must be a JSON base file name without directories.");
        }
        RootDirectory = Path.GetFullPath(options.RootDirectory);
        ConfigurationPath = Path.Combine(RootDirectory, options.ConfigurationFileName);
        this.authority = authority;
    }

    /// <summary>Absolute directory exclusively owned by this fleet store.</summary>
    public string RootDirectory { get; }

    /// <summary>Absolute canonical fleet JSON path.</summary>
    public string ConfigurationPath { get; }

    /// <summary>Create an empty two-lane fleet, or inspect the matching existing fleet.</summary>
    public async ValueTask<SeedFleetInspection> InitializeAsync(
        string fleetId,
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        await mutationLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            EnsureOwnedRoot();
            if (File.Exists(ConfigurationPath))
            {
                var existing = await ReadConfigurationCoreAsync(cancellationToken).ConfigureAwait(false);
                if (!string.Equals(existing.FleetId, fleetId, StringComparison.Ordinal))
                {
                    throw new SeedHostValidationException(
                        "fleet_id_mismatch",
                        "Existing fleet ID differs from the requested initialization ID.");
                }
                cancellationToken.ThrowIfCancellationRequested();
                return authority.InspectSeedFleet(ConfigurationPath);
            }
            var configuration = SeedFleetConfiguration.Create(
                fleetId,
                [],
                [new SeedFleetLane("seed-a", []), new SeedFleetLane("seed-b", [])]);
            return await WriteValidatedCoreAsync(configuration, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            mutationLock.Release();
        }
    }

    /// <summary>Read and strictly validate the current managed fleet document.</summary>
    public async ValueTask<SeedFleetConfiguration> ReadConfigurationAsync(
        CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        await mutationLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            return await ReadConfigurationCoreAsync(cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            mutationLock.Release();
        }
    }

    /// <summary>Add one model and exactly one endpoint to each existing lane.</summary>
    public async ValueTask<SeedFleetInspection> AddModelAsync(
        SeedFleetModel model,
        IEnumerable<SeedLaneEndpointAssignment> endpoints,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(model);
        ArgumentNullException.ThrowIfNull(endpoints);
        return await MutateAsync(configuration =>
        {
            if (configuration.Models.Any(candidate =>
                string.Equals(candidate.ModelId, model.ModelId, StringComparison.Ordinal)))
            {
                throw new SeedHostValidationException(
                    "duplicate_model_id",
                    $"Fleet already contains model ID '{model.ModelId}'.");
            }
            if (configuration.Models.Count >= SeedFleetConfiguration.RequiredTargetModelCount)
            {
                throw new SeedHostValidationException(
                    "fleet_capacity_reached",
                    "Fleet already contains twenty admitted models.");
            }
            var assignmentMap = new Dictionary<string, SeedFleetEndpoint>(StringComparer.Ordinal);
            foreach (var assignment in endpoints)
            {
                if (assignment is null
                    || string.IsNullOrWhiteSpace(assignment.LaneId)
                    || assignment.Endpoint is null
                    || !assignmentMap.TryAdd(assignment.LaneId, assignment.Endpoint))
                {
                    throw new SeedHostValidationException(
                        "lane_assignment_mismatch",
                        "Model admission requires unique nonempty lane assignments.");
                }
            }
            if (assignmentMap.Count != SeedFleetConfiguration.RequiredReplicaLaneCount
                || !configuration.Lanes.All(lane => assignmentMap.ContainsKey(lane.LaneId)))
            {
                throw new SeedHostValidationException(
                    "lane_assignment_mismatch",
                    "Model admission requires exactly one endpoint assignment for each lane.");
            }
            foreach (var endpoint in assignmentMap.Values)
            {
                if (!string.Equals(endpoint.ModelId, model.ModelId, StringComparison.Ordinal))
                {
                    throw new SeedHostValidationException(
                        "endpoint_model_mismatch",
                        "Every admitted endpoint must name the admitted model ID.");
                }
            }
            var updatedModels = configuration.Models.Append(model);
            var updatedLanes = configuration.Lanes.Select(lane => lane with
            {
                Endpoints = lane.Endpoints.Append(assignmentMap[lane.LaneId]).ToArray()
            });
            return SeedFleetConfiguration.Create(
                configuration.FleetId,
                updatedModels,
                updatedLanes);
        }, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Remove a model from fleet configuration without deleting any model or piece files.</summary>
    public ValueTask<SeedFleetInspection> RemoveModelAsync(
        string modelId,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(modelId);
        return MutateAsync(configuration =>
        {
            if (!configuration.Models.Any(model =>
                string.Equals(model.ModelId, modelId, StringComparison.Ordinal)))
            {
                throw new SeedHostValidationException(
                    "model_not_found",
                    $"Fleet does not contain model ID '{modelId}'.");
            }
            return SeedFleetConfiguration.Create(
                configuration.FleetId,
                configuration.Models.Where(model =>
                    !string.Equals(model.ModelId, modelId, StringComparison.Ordinal)),
                configuration.Lanes.Select(lane => lane with
                {
                    Endpoints = lane.Endpoints.Where(endpoint =>
                        !string.Equals(endpoint.ModelId, modelId, StringComparison.Ordinal)).ToArray()
                }));
        }, cancellationToken);
    }

    /// <summary>Enable or disable model serving while preserving admission and piece paths.</summary>
    public ValueTask<SeedFleetInspection> SetModelEnabledAsync(
        string modelId,
        bool enabled,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(modelId);
        return MutateAsync(configuration =>
        {
            var found = false;
            var models = configuration.Models.Select(model =>
            {
                if (!string.Equals(model.ModelId, modelId, StringComparison.Ordinal))
                {
                    return model;
                }
                found = true;
                return model with { Enabled = enabled };
            }).ToArray();
            if (!found)
            {
                throw new SeedHostValidationException(
                    "model_not_found",
                    $"Fleet does not contain model ID '{modelId}'.");
            }
            return SeedFleetConfiguration.Create(configuration.FleetId, models, configuration.Lanes);
        }, cancellationToken);
    }

    /// <summary>Run one serialized mutation and commit only after Rust validation passes.</summary>
    private async ValueTask<SeedFleetInspection> MutateAsync(
        Func<SeedFleetConfiguration, SeedFleetConfiguration> mutation,
        CancellationToken cancellationToken)
    {
        ThrowIfDisposed();
        await mutationLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var current = await ReadConfigurationCoreAsync(cancellationToken).ConfigureAwait(false);
            var updated = mutation(current);
            return await WriteValidatedCoreAsync(updated, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            mutationLock.Release();
        }
    }

    /// <summary>Read a bounded configuration while the caller holds the mutation lock.</summary>
    private async ValueTask<SeedFleetConfiguration> ReadConfigurationCoreAsync(
        CancellationToken cancellationToken)
    {
        EnsureOwnedRoot();
        var information = new FileInfo(ConfigurationPath);
        if (!information.Exists)
        {
            throw new SeedHostValidationException(
                "fleet_not_initialized",
                "Seed fleet has not been initialized.");
        }
        if (information.Length is <= 0 or > MaxConfigurationBytes)
        {
            throw new SeedHostValidationException(
                "invalid_configuration_size",
                $"Fleet configuration must contain 1 to {MaxConfigurationBytes} bytes.");
        }
        var json = await File.ReadAllTextAsync(ConfigurationPath, cancellationToken)
            .ConfigureAwait(false);
        return SeedFleetConfiguration.Parse(json);
    }

    /// <summary>Durably write, Rust-validate, and atomically replace the owned fleet file.</summary>
    private async ValueTask<SeedFleetInspection> WriteValidatedCoreAsync(
        SeedFleetConfiguration configuration,
        CancellationToken cancellationToken)
    {
        EnsureOwnedRoot();
        var temporaryPath = ConfigurationPath + $".tmp-{Guid.NewGuid():N}";
        try
        {
            var bytes = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false)
                .GetBytes(configuration.ToCanonicalJson());
            await using (var stream = new FileStream(
                temporaryPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 16 * 1024,
                FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await stream.WriteAsync(bytes, cancellationToken).ConfigureAwait(false);
                await stream.FlushAsync(cancellationToken).ConfigureAwait(false);
                stream.Flush(flushToDisk: true);
            }
            cancellationToken.ThrowIfCancellationRequested();
            var inspection = authority.InspectSeedFleet(temporaryPath);
            cancellationToken.ThrowIfCancellationRequested();
            if (File.Exists(ConfigurationPath))
            {
                File.Replace(temporaryPath, ConfigurationPath, destinationBackupFileName: null);
            }
            else
            {
                File.Move(temporaryPath, ConfigurationPath);
            }
            return inspection with { ConfigPath = ConfigurationPath };
        }
        finally
        {
            if (File.Exists(temporaryPath))
            {
                File.Delete(temporaryPath);
            }
        }
    }

    /// <summary>Create and reject reparse-point roots before any owned write.</summary>
    private void EnsureOwnedRoot()
    {
        Directory.CreateDirectory(RootDirectory);
        var information = new DirectoryInfo(RootDirectory);
        if ((information.Attributes & FileAttributes.ReparsePoint) != 0)
        {
            throw new SeedHostValidationException(
                "unsafe_fleet_root",
                "Fleet root must not be a symbolic link or reparse point.");
        }
    }

    /// <summary>Reject operations after deterministic disposal.</summary>
    private void ThrowIfDisposed()
    {
        ObjectDisposedException.ThrowIf(disposed, this);
    }

    /// <inheritdoc />
    public ValueTask DisposeAsync()
    {
        if (!disposed)
        {
            disposed = true;
            mutationLock.Dispose();
        }
        return ValueTask.CompletedTask;
    }
}
