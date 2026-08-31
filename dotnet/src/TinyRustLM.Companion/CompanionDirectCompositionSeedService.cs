namespace TinyRustLM.Companion;

/// <summary>Closed public states for one runtime-owned local direct seed.</summary>
public enum CompanionDirectCompositionSeedState
{
    /// <summary>The verified child is bound and serving its exact composition.</summary>
    Ready,

    /// <summary>The child reached an authorized terminal stop.</summary>
    Stopped,

    /// <summary>The child failed before readiness or terminated unexpectedly.</summary>
    Failed
}

/// <summary>
/// Owns a bounded set of local seed lifecycles without accepting executable, URL, or member paths.
/// </summary>
public sealed class CompanionDirectCompositionSeedService : IAsyncDisposable
{
    /// <summary>The conservative immutable-lifecycle capacity of one companion process.</summary>
    public const int MaximumLifecyclesPerRuntime = 4;

    internal const string ProductionBindAddress = "127.0.0.1:0";

    private readonly CompanionDirectCompositionSeedDescriptorMaterializer _materializer;
    private readonly Func<CompanionDirectCompositionSeedLauncher> _launcherFactory;
    private readonly CompanionDirectCompositionSeedLaunchConfiguration _configuration;
    private readonly object _stateGate = new();
    private readonly SemaphoreSlim _startGate = new(1, 1);
    private readonly CancellationTokenSource _lifetime = new();
    private readonly Dictionary<string, SeedLifecycle> _lifecycles =
        new(StringComparer.Ordinal);
    private CompanionDirectCompositionSeedLauncher? _preflightLauncher;
    private int _disposeState;

    /// <summary>Creates one bounded owner around fixed, already-validated authorities.</summary>
    internal CompanionDirectCompositionSeedService(
        CompanionDirectCompositionSeedDescriptorMaterializer materializer,
        Func<CompanionDirectCompositionSeedLauncher> launcherFactory)
    {
        _materializer = materializer ?? throw new ArgumentNullException(nameof(materializer));
        _launcherFactory = launcherFactory ??
            throw new ArgumentNullException(nameof(launcherFactory));
        _preflightLauncher = RequireLauncher(_launcherFactory());
        _configuration = CompanionDirectCompositionSeedLaunchConfiguration.Create(
            ProductionBindAddress,
            CompanionLoopbackProtocol.ProductionOrigin);
    }

    /// <summary>Starts once or returns the current projection for the same operation.</summary>
    public async Task<CompanionDirectCompositionSeedProjection> StartOrReadAsync(
        CompanionDirectCompositionSeedStartRequest request,
        CancellationToken cancellationToken = default)
    {
        _ = CompanionLoopbackWire.EncodeDirectCompositionSeedStartRequest(request);
        ThrowIfDisposed();
        if (TryGetLifecycle(request.OperationId, out var existing))
        {
            return await existing.ReadAsync(cancellationToken).ConfigureAwait(false);
        }

        using var requestScope = CancellationTokenSource.CreateLinkedTokenSource(
            _lifetime.Token,
            cancellationToken);
        await _startGate.WaitAsync(requestScope.Token).ConfigureAwait(false);
        SeedLifecycle? candidate = null;
        try
        {
            ThrowIfDisposed();
            if (TryGetLifecycle(request.OperationId, out existing))
            {
                return await existing.ReadAsync(cancellationToken).ConfigureAwait(false);
            }

            lock (_stateGate)
            {
                ThrowIfDisposed();
                if (_lifecycles.Count >= MaximumLifecyclesPerRuntime)
                {
                    throw new CompanionProtocolException(
                        "direct-composition-seed-resource-limit");
                }
            }

            candidate = new SeedLifecycle(
                request.OperationId,
                _materializer,
                TakeLauncher,
                _configuration,
                _lifetime.Token);
            var projection = await candidate.StartAsync(cancellationToken)
                .ConfigureAwait(false);

            lock (_stateGate)
            {
                ThrowIfDisposed();
                if (!_lifecycles.TryAdd(request.OperationId, candidate))
                {
                    throw new CompanionProtocolException(
                        "direct-composition-seed-conflict");
                }
            }
            candidate = null;
            return projection;
        }
        finally
        {
            if (candidate is not null)
            {
                await candidate.DisposeAsync().ConfigureAwait(false);
            }
            _startGate.Release();
        }
    }

    /// <summary>Reads and reconciles one exact lifecycle without starting new work.</summary>
    public Task<CompanionDirectCompositionSeedProjection> ReadAsync(
        string operationId,
        CancellationToken cancellationToken = default)
    {
        RequireOperationId(operationId);
        ThrowIfDisposed();
        return RequireLifecycle(operationId).ReadAsync(cancellationToken);
    }

    /// <summary>Stops one exact child and returns only after its terminal reconciliation.</summary>
    public Task<CompanionDirectCompositionSeedProjection> StopAndWaitAsync(
        string operationId,
        CompanionDirectCompositionSeedStopRequest request,
        CancellationToken cancellationToken = default)
    {
        _ = CompanionLoopbackWire.EncodeDirectCompositionSeedStopRequest(request);
        RequireOperationId(operationId);
        ThrowIfDisposed();
        return RequireLifecycle(operationId).StopAndWaitAsync(cancellationToken);
    }

    /// <summary>Cancels startup and closes every child before releasing runtime custody.</summary>
    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposeState, 1) != 0)
        {
            return;
        }

        _lifetime.Cancel();
        await _startGate.WaitAsync(CancellationToken.None).ConfigureAwait(false);
        SeedLifecycle[] lifecycles;
        try
        {
            lock (_stateGate)
            {
                lifecycles = _lifecycles.Values.ToArray();
                _lifecycles.Clear();
            }
        }
        finally
        {
            _startGate.Release();
        }

        await Task.WhenAll(lifecycles.Select(static lifecycle =>
            lifecycle.DisposeAsync().AsTask())).ConfigureAwait(false);
        _lifetime.Dispose();
    }

    /// <summary>Gets one immutable lifecycle by exact operation identity.</summary>
    private SeedLifecycle RequireLifecycle(string operationId)
    {
        if (TryGetLifecycle(operationId, out var lifecycle))
        {
            return lifecycle;
        }
        throw new CompanionProtocolException("direct-composition-seed-not-found");
    }

    /// <summary>Looks up one lifecycle without exposing mutable map state.</summary>
    private bool TryGetLifecycle(string operationId, out SeedLifecycle lifecycle)
    {
        lock (_stateGate)
        {
            return _lifecycles.TryGetValue(operationId, out lifecycle!);
        }
    }

    /// <summary>Consumes the preflight launcher, then creates one exclusive launcher per operation.</summary>
    private CompanionDirectCompositionSeedLauncher TakeLauncher()
    {
        if (_preflightLauncher is { } preflight)
        {
            _preflightLauncher = null;
            return preflight;
        }
        return RequireLauncher(_launcherFactory());
    }

    /// <summary>Rejects an invalid internal launcher factory result.</summary>
    private static CompanionDirectCompositionSeedLauncher RequireLauncher(
        CompanionDirectCompositionSeedLauncher? launcher) =>
        launcher ?? throw new CompanionProtocolException("internal-failure");

    /// <summary>Maps private materialization failures onto the closed loopback vocabulary.</summary>
    private static CompanionProtocolException MapMaterializationFailure(
        CompanionDirectCompositionSeedException exception) =>
        new(exception.Code switch
        {
            "direct-composition-seed-operation-not-found" =>
                "direct-composition-seed-not-found",
            "direct-composition-seed-operation-not-available" =>
                "direct-composition-seed-operation-not-available",
            _ => "direct-composition-seed-identity-drift"
        });

    /// <summary>Validates an exact journal operation identity without accepting path syntax.</summary>
    private static void RequireOperationId(string operationId)
    {
        try
        {
            CompanionContract.RequireDigest(operationId, "direct-composition-seed-operation-id");
        }
        catch (CompanionContractException)
        {
            throw new CompanionProtocolException("direct-composition-seed-not-found");
        }
    }

    /// <summary>Rejects every request after runtime shutdown begins.</summary>
    private void ThrowIfDisposed()
    {
        if (Volatile.Read(ref _disposeState) != 0)
        {
            throw new CompanionProtocolException("companion-unavailable");
        }
    }

    /// <summary>Owns one immutable operation identity and at most one exclusive child.</summary>
    private sealed class SeedLifecycle : IAsyncDisposable
    {
        private readonly string _operationId;
        private readonly CompanionDirectCompositionSeedDescriptorMaterializer _materializer;
        private readonly Func<CompanionDirectCompositionSeedLauncher> _launcherFactory;
        private readonly CompanionDirectCompositionSeedLaunchConfiguration _configuration;
        private readonly CancellationToken _serviceLifetime;
        private readonly SemaphoreSlim _gate = new(1, 1);
        private CompanionDirectCompositionSeedSession? _session;
        private CancellationTokenSource? _sessionCancellation;
        private CompanionDirectCompositionSeedProjection? _projection;
        private int _disposeState;

        internal SeedLifecycle(
            string operationId,
            CompanionDirectCompositionSeedDescriptorMaterializer materializer,
            Func<CompanionDirectCompositionSeedLauncher> launcherFactory,
            CompanionDirectCompositionSeedLaunchConfiguration configuration,
            CancellationToken serviceLifetime)
        {
            _operationId = operationId;
            _materializer = materializer;
            _launcherFactory = launcherFactory;
            _configuration = configuration;
            _serviceLifetime = serviceLifetime;
        }

        /// <summary>Performs the sole pre-publication startup transaction.</summary>
        internal async Task<CompanionDirectCompositionSeedProjection> StartAsync(
            CancellationToken cancellationToken)
        {
            using var requestScope = CancellationTokenSource.CreateLinkedTokenSource(
                _serviceLifetime,
                cancellationToken);
            CompanionDirectCompositionSeedMaterialization materialization;
            try
            {
                materialization = await _materializer.MaterializeOrReadAsync(
                    _operationId,
                    requestScope.Token).ConfigureAwait(false);
            }
            catch (CompanionDirectCompositionSeedException exception)
            {
                throw MapMaterializationFailure(exception);
            }

            CancellationTokenSource? sessionCancellation = null;
            CancellationTokenRegistration startupCancellation = default;
            try
            {
                var launcher = _launcherFactory();
                var plan = await launcher.CreateLaunchPlanAsync(
                    materialization,
                    _configuration,
                    requestScope.Token).ConfigureAwait(false);
                sessionCancellation = CancellationTokenSource.CreateLinkedTokenSource(
                    _serviceLifetime);
                startupCancellation = cancellationToken.Register(
                    static state => ((CancellationTokenSource)state!).Cancel(),
                    sessionCancellation);
                var session = await launcher.LaunchAsync(plan, sessionCancellation.Token)
                    .ConfigureAwait(false);

                // Readiness is the ownership boundary: caller cancellation is detached here.
                startupCancellation.Dispose();
                startupCancellation = default;
                if (sessionCancellation.IsCancellationRequested)
                {
                    await session.DisposeAsync().ConfigureAwait(false);
                    throw new OperationCanceledException(sessionCancellation.Token);
                }

                _session = session;
                _sessionCancellation = sessionCancellation;
                sessionCancellation = null;
                _projection = ValidateProjection(new CompanionDirectCompositionSeedProjection(
                    CompanionLoopbackWire.DirectCompositionSeedProjectionSchema,
                    materialization.OperationId,
                    1,
                    CompanionDirectCompositionSeedState.Ready,
                    materialization.CompositionId,
                    session.Readiness.Protocol,
                    session.Readiness.BoundOrigin,
                    session.Readiness.AllowedBrowserOrigin,
                    null));
                ReconcileTerminalLocked();
                return RequireProjectionLocked();
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (CompanionDirectCompositionSeedLaunchException exception)
            {
                _projection = ValidateProjection(new CompanionDirectCompositionSeedProjection(
                    CompanionLoopbackWire.DirectCompositionSeedProjectionSchema,
                    materialization.OperationId,
                    1,
                    CompanionDirectCompositionSeedState.Failed,
                    materialization.CompositionId,
                    null,
                    null,
                    null,
                    exception.Code));
                return _projection;
            }
            finally
            {
                startupCancellation.Dispose();
                sessionCancellation?.Dispose();
            }
        }

        /// <summary>Reads and reconciles this lifecycle.</summary>
        internal async Task<CompanionDirectCompositionSeedProjection> ReadAsync(
            CancellationToken cancellationToken)
        {
            ThrowIfDisposed();
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(
                _serviceLifetime,
                cancellationToken);
            await _gate.WaitAsync(linked.Token).ConfigureAwait(false);
            try
            {
                ReconcileTerminalLocked();
                return RequireProjectionLocked();
            }
            finally
            {
                _gate.Release();
            }
        }

        /// <summary>Stops this lifecycle and waits for its immutable terminal evidence.</summary>
        internal async Task<CompanionDirectCompositionSeedProjection> StopAndWaitAsync(
            CancellationToken cancellationToken)
        {
            ThrowIfDisposed();
            await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                ReconcileTerminalLocked();
                if (_session is not null)
                {
                    await _session.DisposeAsync().ConfigureAwait(false);
                    ReconcileTerminalLocked();
                }
                return RequireProjectionLocked();
            }
            finally
            {
                _gate.Release();
            }
        }

        /// <summary>Stops this exact child and releases its private custody.</summary>
        public async ValueTask DisposeAsync()
        {
            if (Interlocked.Exchange(ref _disposeState, 1) != 0)
            {
                return;
            }

            await _gate.WaitAsync(CancellationToken.None).ConfigureAwait(false);
            try
            {
                ReconcileTerminalLocked();
                if (_session is not null)
                {
                    await _session.DisposeAsync().ConfigureAwait(false);
                    ReconcileTerminalLocked();
                }
            }
            finally
            {
                _gate.Release();
            }
        }

        /// <summary>Applies one completed child result exactly once.</summary>
        private void ReconcileTerminalLocked()
        {
            if (_session is null || !_session.TerminalStatus.IsCompletedSuccessfully)
            {
                return;
            }

            var terminal = _session.TerminalStatus.GetAwaiter().GetResult();
            var current = RequireProjectionLocked();
            var state = terminal.State is
                CompanionDirectCompositionSeedTerminalState.OwnerStopped or
                CompanionDirectCompositionSeedTerminalState.ParentCancelled
                    ? CompanionDirectCompositionSeedState.Stopped
                    : CompanionDirectCompositionSeedState.Failed;
            _projection = ValidateProjection(current with
            {
                Sequence = checked(current.Sequence + 1),
                State = state,
                Protocol = null,
                BoundOrigin = null,
                AllowedBrowserOrigin = null,
                TerminalCode = terminal.Code
            });
            _session = null;
            _sessionCancellation?.Dispose();
            _sessionCancellation = null;
        }

        /// <summary>Gets the initialized projection or fails closed on impossible state.</summary>
        private CompanionDirectCompositionSeedProjection RequireProjectionLocked() =>
            _projection ?? throw new CompanionProtocolException("internal-failure");

        /// <summary>Validates every lifecycle-created projection through the public wire contract.</summary>
        private static CompanionDirectCompositionSeedProjection ValidateProjection(
            CompanionDirectCompositionSeedProjection projection)
        {
            _ = CompanionLoopbackWire.EncodeDirectCompositionSeedProjection(projection);
            return projection;
        }

        /// <summary>Rejects access after this lifecycle begins disposal.</summary>
        private void ThrowIfDisposed()
        {
            if (Volatile.Read(ref _disposeState) != 0)
            {
                throw new CompanionProtocolException("companion-unavailable");
            }
        }
    }
}
