namespace TinyRustLM.SeedHost;

/// <summary>Closed seed-host actions that an optional local-control plugin may request.</summary>
public enum SeedHostLocalControlAction
{
    /// <summary>Read the validated fleet state without changing it.</summary>
    InspectFleet,
    /// <summary>Create or replace owned fleet configuration.</summary>
    ConfigureFleet,
    /// <summary>Prepare and admit one verified model.</summary>
    AdmitModel,
    /// <summary>Remove one model reference from the owned fleet.</summary>
    RemoveModel,
    /// <summary>Enable serving for one admitted model.</summary>
    EnableModel,
    /// <summary>Disable serving for one admitted model.</summary>
    DisableModel,
    /// <summary>Start one independently supervised seed lane.</summary>
    StartLane,
    /// <summary>Stop one independently supervised seed lane.</summary>
    StopLane,
    /// <summary>Restart one independently supervised seed lane.</summary>
    RestartLane,
    /// <summary>Install the two owned operating-system service definitions.</summary>
    InstallService,
    /// <summary>Remove only the two owned operating-system service definitions.</summary>
    UninstallService,
    /// <summary>Start the installed seed-host services.</summary>
    StartService,
    /// <summary>Stop the installed seed-host services.</summary>
    StopService,
    /// <summary>Restart the installed seed-host services.</summary>
    RestartService
}

/// <summary>Risk shown by the host approval system for one closed seed-host action.</summary>
public enum SeedHostLocalControlRiskCategory
{
    /// <summary>Read-only local state inspection.</summary>
    ReadOnlyInspection,
    /// <summary>Model storage or fleet configuration mutation.</summary>
    ModelAndFleetConfiguration,
    /// <summary>Foreground seed-lane process lifecycle control.</summary>
    SeedLaneProcessControl,
    /// <summary>Operating-system service definition installation or removal.</summary>
    LocalServiceInstallation,
    /// <summary>Lifecycle control of already installed local services.</summary>
    LocalServiceControl
}

/// <summary>Public-safe identity supplied by the local-control host for one request.</summary>
public sealed record SeedHostLocalControlContext(
    string RequestingApplicationId,
    string CorrelationId,
    bool IsRemoteRequest = false);

/// <summary>Exact approval intent sent to a LocalEndpoint-compatible host plugin.</summary>
public sealed record SeedHostLocalControlIntent(
    SeedHostLocalControlAction Action,
    SeedHostLocalControlRiskCategory RiskCategory,
    string ConfigurationPath,
    string RequestingApplicationId,
    string CorrelationId,
    bool IsRemoteRequest,
    DateTimeOffset RequestedUtc);

/// <summary>Short-lived, exact-action decision returned by the host approval system.</summary>
public sealed record SeedHostLocalControlDecision(
    bool Approved,
    string DecisionId,
    SeedHostLocalControlAction Action,
    string CorrelationId,
    DateTimeOffset ExpiresUtc);

/// <summary>Validated approval evidence retained in memory only by the calling operation.</summary>
public sealed record SeedHostLocalControlAuthorization(
    string DecisionId,
    DateTimeOffset ExpiresUtc,
    SeedHostLocalControlIntent Intent);

/// <summary>Fail-closed policy for an optional local-control approval adapter.</summary>
public sealed record SeedHostLocalControlPolicy(
    bool AllowRemoteRequests = false,
    TimeSpan? MaximumApprovalLifetime = null);

/// <summary>
/// Implemented by an optional LocalEndpoint Connect plugin. Implementations display and record the
/// host's normal risk-category approval; this package never accepts or persists a credential here.
/// </summary>
public interface ISeedHostLocalControlApprovalGate
{
    /// <summary>Request one exact, short-lived approval without broad command or shell authority.</summary>
    ValueTask<SeedHostLocalControlDecision> RequestApprovalAsync(
        SeedHostLocalControlIntent intent,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Validates requests and host decisions before callers invoke the existing typed seed-host APIs.
/// Thread-safe when the supplied approval gate is thread-safe; cancellation is checked before and
/// after the external approval interaction.
/// </summary>
public sealed class SeedHostLocalControlGuard
{
    private static readonly TimeSpan DefaultMaximumApprovalLifetime = TimeSpan.FromMinutes(15);
    private readonly ISeedHostLocalControlApprovalGate approvalGate;
    private readonly SeedHostLocalControlPolicy policy;
    private readonly TimeProvider timeProvider;

    /// <summary>Create an opt-in approval guard; remote-origin requests are denied by default.</summary>
    public SeedHostLocalControlGuard(
        ISeedHostLocalControlApprovalGate approvalGate,
        SeedHostLocalControlPolicy? policy = null,
        TimeProvider? timeProvider = null)
    {
        this.approvalGate = approvalGate ?? throw new ArgumentNullException(nameof(approvalGate));
        this.policy = policy ?? new SeedHostLocalControlPolicy();
        this.timeProvider = timeProvider ?? TimeProvider.System;
        ValidatePolicy(this.policy);
    }

    /// <summary>Request and validate approval for one closed action and fleet configuration.</summary>
    public async ValueTask<SeedHostLocalControlAuthorization> AuthorizeAsync(
        SeedHostLocalControlAction action,
        string configurationPath,
        SeedHostLocalControlContext context,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);
        cancellationToken.ThrowIfCancellationRequested();
        if (!Enum.IsDefined(action))
        {
            throw new SeedHostValidationException(
                "unknown_local_control_action",
                "Local control requested an unsupported seed-host action.");
        }
        var absoluteConfigurationPath = RequiredPath(configurationPath);
        var applicationId = RequiredIdentity(
            context.RequestingApplicationId,
            nameof(context.RequestingApplicationId),
            256);
        var correlationId = RequiredIdentity(
            context.CorrelationId,
            nameof(context.CorrelationId),
            128);
        if (context.IsRemoteRequest && !policy.AllowRemoteRequests)
        {
            throw new SeedHostValidationException(
                "remote_control_disabled",
                "Remote seed-host control is disabled; use a locally approved request.");
        }

        var requestedUtc = timeProvider.GetUtcNow();
        var intent = new SeedHostLocalControlIntent(
            action,
            RiskCategory(action),
            absoluteConfigurationPath,
            applicationId,
            correlationId,
            context.IsRemoteRequest,
            requestedUtc);
        var decision = await approvalGate.RequestApprovalAsync(intent, cancellationToken)
            .ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();
        if (decision is null)
        {
            throw new SeedHostValidationException(
                "approval_contract_mismatch",
                "The local-control approval plugin returned no decision.");
        }
        if (!decision.Approved)
        {
            throw new SeedHostValidationException(
                "local_control_not_approved",
                "The local-control host did not approve this seed-host action.");
        }
        var maximumExpiry = requestedUtc + EffectiveMaximumApprovalLifetime;
        if (decision.Action != action
            || !string.Equals(decision.CorrelationId, correlationId, StringComparison.Ordinal)
            || decision.ExpiresUtc <= requestedUtc
            || decision.ExpiresUtc > maximumExpiry)
        {
            throw new SeedHostValidationException(
                "approval_contract_mismatch",
                "The local-control decision did not match the exact current request.");
        }
        var decisionId = RequiredIdentity(decision.DecisionId, nameof(decision.DecisionId), 256);
        return new SeedHostLocalControlAuthorization(decisionId, decision.ExpiresUtc, intent);
    }

    private TimeSpan EffectiveMaximumApprovalLifetime =>
        policy.MaximumApprovalLifetime ?? DefaultMaximumApprovalLifetime;

    /// <summary>Map every action to one stable host-visible risk category.</summary>
    public static SeedHostLocalControlRiskCategory RiskCategory(
        SeedHostLocalControlAction action) => action switch
        {
            SeedHostLocalControlAction.InspectFleet =>
                SeedHostLocalControlRiskCategory.ReadOnlyInspection,
            SeedHostLocalControlAction.ConfigureFleet
                or SeedHostLocalControlAction.AdmitModel
                or SeedHostLocalControlAction.RemoveModel
                or SeedHostLocalControlAction.EnableModel
                or SeedHostLocalControlAction.DisableModel =>
                SeedHostLocalControlRiskCategory.ModelAndFleetConfiguration,
            SeedHostLocalControlAction.StartLane
                or SeedHostLocalControlAction.StopLane
                or SeedHostLocalControlAction.RestartLane =>
                SeedHostLocalControlRiskCategory.SeedLaneProcessControl,
            SeedHostLocalControlAction.InstallService
                or SeedHostLocalControlAction.UninstallService =>
                SeedHostLocalControlRiskCategory.LocalServiceInstallation,
            SeedHostLocalControlAction.StartService
                or SeedHostLocalControlAction.StopService
                or SeedHostLocalControlAction.RestartService =>
                SeedHostLocalControlRiskCategory.LocalServiceControl,
            _ => throw new SeedHostValidationException(
                "unknown_local_control_action",
                "Local control requested an unsupported seed-host action.")
        };

    private static string RequiredPath(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        if (value.Contains('\0'))
        {
            throw new SeedHostValidationException(
                "invalid_local_control_path",
                "Local-control configuration paths cannot contain an embedded NUL.");
        }
        return Path.GetFullPath(value);
    }

    private static string RequiredIdentity(string value, string argumentName, int maximumLength)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, argumentName);
        if (value.Length > maximumLength || value.Any(char.IsControl))
        {
            throw new SeedHostValidationException(
                "invalid_local_control_identity",
                "Local-control identifiers must be bounded text without control characters.");
        }
        return value;
    }

    private static void ValidatePolicy(SeedHostLocalControlPolicy value)
    {
        var lifetime = value.MaximumApprovalLifetime ?? DefaultMaximumApprovalLifetime;
        if (lifetime < TimeSpan.FromSeconds(1) || lifetime > TimeSpan.FromHours(1))
        {
            throw new SeedHostValidationException(
                "invalid_local_control_policy",
                "Local-control approval lifetime must be between one second and one hour.");
        }
    }
}
