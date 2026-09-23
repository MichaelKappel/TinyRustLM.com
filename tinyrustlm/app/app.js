(function () {
  "use strict";

  const conversationApi = window.TinyRustLMConversation;
  if (!conversationApi) {
    throw new Error("TinyRustLM active conversation module is unavailable");
  }
  const calculatorApi = window.TinyRustLMCalculator;
  if (!calculatorApi) {
    throw new Error("TinyRustLM calculator tool module is unavailable");
  }
  const companionCapabilityApi = window.TinyRustLMCompanionCapability || null;
  const companionClient = companionCapabilityApi
    ? new companionCapabilityApi.CompanionCapabilityClient({ timeoutMilliseconds: 10000 })
    : null;
  const miniModelCatalogV1Api = window.TinyRustLMMiniModelCatalogV1;
  if (!miniModelCatalogV1Api) {
    throw new Error("TinyRustLM MiniModel catalog v1 validator is unavailable");
  }
  const directPeerUrlAuthority = miniModelCatalogV1Api.directPeerUrlAuthority;
  if (!directPeerUrlAuthority ||
      typeof directPeerUrlAuthority.normalizeBaseUrl !== "function") {
    throw new Error("TinyRustLM direct peer URL authority is unavailable");
  }
  const incrementalSha256Api = window.TinyRustLMIncrementalSha256;
  if (!incrementalSha256Api || typeof incrementalSha256Api.createSha256 !== "function") {
    throw new Error("TinyRustLM incremental SHA-256 module is unavailable");
  }
  const modelCompositionStoreApi = window.TinyRustLMModelCompositionStore;
  if (!modelCompositionStoreApi ||
      typeof modelCompositionStoreApi.createOpfsAdapter !== "function" ||
      typeof modelCompositionStoreApi.createModelCompositionStore !== "function") {
    throw new Error("TinyRustLM browser composition store is unavailable");
  }
  const catalogAdmissionLoaderApi = window.TinyRustLMCatalogAdmissionLoader;
  if (!catalogAdmissionLoaderApi || typeof catalogAdmissionLoaderApi.load !== "function") {
    throw new Error("TinyRustLM catalog admission loader is unavailable");
  }
  const operationLifetimeApi = window.TinyRustLMOperationLifetime;
  if (!operationLifetimeApi || typeof operationLifetimeApi.create !== "function") {
    throw new Error("TinyRustLM operation lifetime module is unavailable");
  }
  const companionCompositionInstallApi = window.TinyRustLMCompanionCompositionInstall;
  if (!companionCompositionInstallApi ||
      typeof companionCompositionInstallApi.installCompanionComposition !== "function") {
    throw new Error("TinyRustLM companion composition installer is unavailable");
  }
  const p2pCompositionInstallApi = window.TinyRustLMP2PCompositionInstall;
  if (!p2pCompositionInstallApi ||
      typeof p2pCompositionInstallApi.installP2pComposition !== "function") {
    throw new Error("TinyRustLM direct P2P composition installer is unavailable");
  }
  const memoryEndpointsEnrollmentApi = window.TinyRustLMMemoryEndpointsEnrollment || null;
  const memoryEndpointsHttpClient = new window.TinyRustLMMemoryEndpointsHttp.MemoryEndpointsHttpClient();
  const browserModelAdmissionApi = window.TinyRustLMBrowserModelAdmission;
  if (!browserModelAdmissionApi) {
    throw new Error("TinyRustLM browser model admission module is unavailable");
  }
  const browserRuntimeLoaderApi = window.TinyRustLMBrowserRuntimeLoader;
  if (!browserRuntimeLoaderApi) {
    throw new Error("TinyRustLM browser runtime loader is unavailable");
  }
  const prompt2RequestApi = window.TinyRustLMPrompt2Request;
  if (!prompt2RequestApi) {
    throw new Error("TinyRustLM Prompt2 request writer is unavailable");
  }
  const modelRuntimeClientApi = window.TinyRustLMModelRuntimeClient;
  if (!modelRuntimeClientApi) {
    throw new Error("TinyRustLM model runtime client is unavailable");
  }

  const paths = {
    runtimeWasm: "../browser-runtime/tinyrustlm-browser-runtime.wasm",
    runtimeWasmManifest: "../browser-runtime/tinyrustlm-browser-runtime.wasm.manifest.json",
    runtimeWorker: "./model-runtime-worker.js",
    registry: "../models/selector.registry",
    models: Object.create(null)
  };
  const promptFormatRaw = "raw-completion-v1";

  const localModelKey = "__local_slm_file";
  const ownedModelMaxBytes = 1024 * 1024 * 1024;

  const maximumDirectCompositionSeedLifecycles = 4;
  const maximumDirectCompositionSeedPolls = 30;
  const directCompositionSeedPollIntervalMs = 2000;
  const directCompositionSeedCustodySchema =
    "tinyrustlm.browser.direct-composition-seed-custody.v1";
  const recoverableCompositionStoreCodes = new Set([
    "model-composition-store-active-pointer",
    "model-composition-store-installed-manifest",
    "model-composition-store-manifest",
    "model-composition-store-member-name",
    "model-composition-store-composition-size",
    "model-composition-store-stored-admission",
    "model-composition-store-stored-length",
    "model-composition-store-stored-sha256"
  ]);
  const modelTrustTiers = Object.freeze({
    demo: "demo-fixture",
    experimental: "experimental",
    conversation: "conversation-proven",
    quality: "quality"
  });
  const simpleModelRouteKinds = Object.freeze({
    INSTALLED: "installed",
    QUALIFIED_P2P: "qualified-p2p",
    SUPPORTED_LOCAL_CONVERSION: "supported-local-conversion",
    UNSUPPORTED_SOURCE: "unsupported-source"
  });
  const simpleModelRouteRanks = Object.freeze({
    [simpleModelRouteKinds.INSTALLED]: 0,
    [simpleModelRouteKinds.QUALIFIED_P2P]: 1,
    [simpleModelRouteKinds.SUPPORTED_LOCAL_CONVERSION]: 2,
    [simpleModelRouteKinds.UNSUPPORTED_SOURCE]: 3
  });
  const publicLocalOnlyHosts = new Set([
    "127.0.0.1",
    "::1",
    "localhost",
    "tinyrustlm.com",
    "www.tinyrustlm.com"
  ]);
  const httpScheme = "http" + "://";
  const httpsScheme = "https" + "://";
  const peerExampleUrl = `${httpScheme}127.0.0.1:8123/`;

  const docsTargets = {
    runtime: `${httpsScheme}TinyRustLM.MiRust.com/`,
    minimodel: `${httpsScheme}MiniModel.MiRust.com/`
  };

  const svgNamespace = "http" + "://www.w3.org/2000/svg";

  const hfDiscoveryScheme = "https";
  const hfDiscoveryHost = "huggingface.co";
  const hfSearchLimit = 8;
  const hfSearchApiLimit = 24;
  const hfBrowseLimit = 100;
  const hfBrowseApiLimit = 500;
  const hfBrowseSortModes = {
    popular: { sort: "downloads", direction: "-1", label: "popular" },
    new: { sort: "createdAt", direction: "-1", label: "new releases" }
  };
  const hfLargeSourceWarningBytes = 2 * 1024 * 1024 * 1024;
  const localMemoryUniversalPaths = [
    ".uai/memory-maintenance.uai",
    ".uai/identity.uai",
    ".uai/world-context.uai",
    ".uai/totem.uai",
    ".uai/taboo.uai",
    ".uai/talisman.uai",
    ".uai/short-term-memory.uai"
  ];
  const localMemoryBaselinePaths = [
    ".uai/manifest.uaix.json",
    ".uai/startup-packet.uai",
    ".uai/system-profile.uai",
    ".uai/receiver-brief.uai",
    ".uai/index.uai",
    ".uai/context.uai",
    ".uai/constraints.uai",
    ".uai/progress.uai",
    ".uai/operations.uai",
    ".uai/test-plan.uai",
    ".uai/decisions.uai",
    ".uai/memory.uai",
    ".uai/agent-pickup.uai",
    ".uai/archives/session-log.uai",
    ".uai/exports/manifest.json",
    ".uai/exports/manifest-overlay.json",
    ".uai/exports/package-model.json",
    ".uai/exports/knowledge-graph.json",
    ".uai/exports/llms.uai",
    ".uai/exports/llms-full.uai"
  ];
  const localMemoryFileHandoffPaths = [
    ".uai/file-handoff.uai",
    ".uai/intake-outcome-ledger.uai"
  ];
  const localMemoryCodeBearingPaths = [
    ".uai/coding-standards.uai",
    ".uai/architecture.uai",
    ".uai/next-recursive-prompt.uai"
  ];
  const localMemoryMultiAgentPaths = [
    ".uai/agent-instructions.uai",
    ".uai/owners.uai",
    ".uai/current-state.uai",
    ".uai/next-actions.uai",
    ".uai/open-questions.uai",
    ".uai/risk-register.uai"
  ];
  const localMemoryTalismanPaths = [
    ".uai/agent-instructions.uai",
    ".uai/owners.uai",
    ".uai/risk-register.uai",
    "reports/deployment-memory-and-test-report.uai"
  ];
  const localMemoryAdvancedPersonaPaths = [
    ".uai/readme.human",
    ".uai/persona.uai",
    ".uai/personality/identity.uai",
    ".uai/personality/religion-worldview.uai",
    ".uai/personality/political-leaning.uai",
    ".uai/personality/sense-of-style.uai",
    ".uai/personality/physical-appearance.uai",
    ".uai/personality/birth-age-generation.uai",
    ".uai/personality/romantic-orientation.uai",
    ".uai/personality/voice.uai",
    ".uai/personality/values.uai",
    ".uai/personality/temperament.uai",
    ".uai/personality/reasoning-style.uai",
    ".uai/personality/emotional-patterns.uai",
    ".uai/personality/relationship-style.uai",
    ".uai/personality/behavioral-patterns.uai",
    ".uai/personality/boundaries.uai",
    ".uai/personality/examples-dialogue.uai",
    ".uai/personality/adaptation-rules.uai",
    ".uai/personality/preservation-rules.uai",
    ".uai/evidence/source-excerpts.uai",
    ".uai/evidence/source-platform-profile.uai",
    ".uai/evidence/persona-fidelity-test-deck.uai",
    ".uai/evidence/variance-report-template.uai",
    ".uai/evidence/provenance.uai",
    ".uai/personality/sense-of-winter.uai",
    ".uai/personality/sense-of-spring-fall.uai",
    ".uai/personality/super-fashion-style.uai",
    ".uai/personality/jewelry-choices.uai"
  ];
  const localMemoryAdvancedPersonaDimensions = [
    ["Religion and worldview", ".uai/personality/religion-worldview.uai"],
    ["Political leaning", ".uai/personality/political-leaning.uai"],
    ["Sense of style", ".uai/personality/sense-of-style.uai"],
    ["Physical appearance", ".uai/personality/physical-appearance.uai"],
    ["Birth, age, and generation", ".uai/personality/birth-age-generation.uai"],
    ["Romantic orientation", ".uai/personality/romantic-orientation.uai"],
    ["Winter style", ".uai/personality/sense-of-winter.uai"],
    ["Spring/fall style", ".uai/personality/sense-of-spring-fall.uai"],
    ["Super fashion/style", ".uai/personality/super-fashion-style.uai"],
    ["Jewelry choices", ".uai/personality/jewelry-choices.uai"]
  ];
  const localMemoryOptionalContentPaths = [
    ["tool_permissions", ".uai/tool-permissions.uai"],
    ["delegated_operations", ".uai/credential-inventory.uai"],
    ["deployment", "reports/deployment-memory-and-test-report.uai"],
    ["contact_memory", ".uai/contact-memory.uai"],
    ["calendar_scheduling", ".uai/calendar-and-scheduling.uai"],
    ["communication_style", ".uai/communication-style.uai"],
    ["tasks_commitments", ".uai/tasks-and-commitments.uai"],
    ["routines_preferences", ".uai/routines-and-preferences.uai"],
    ["safety_support_boundaries", ".uai/safety-and-support-boundary.uai"],
    ["source_notes", ".uai/source-notes.uai"],
    ["public_facing_boundaries", ".uai/public-facing-boundary.uai"]
  ];
  const localMemoryContextPriority = [
    ".uai/persona.uai",
    ".uai/system-profile.uai",
    ".uai/receiver-brief.uai",
    ".uai/context.uai",
    ".uai/constraints.uai",
    ".uai/memory.uai",
    ".uai/short-term-memory.uai",
    ".uai/identity.uai",
    ".uai/world-context.uai",
    ".uai/totem.uai",
    ".uai/taboo.uai",
    ".uai/talisman.uai",
    ".uai/long-term-memory.uai",
    ".uai/tasks-and-commitments.uai",
    ".uai/communication-style.uai",
    ".uai/agent-instructions.uai",
    ".uai/current-state.uai",
    ".uai/next-actions.uai",
    ".uai/open-questions.uai",
    ".uai/risk-register.uai",
    ".uai/personality/identity.uai",
    ".uai/personality/values.uai",
    ".uai/personality/temperament.uai",
    ".uai/personality/reasoning-style.uai",
    ".uai/personality/relationship-style.uai",
    ".uai/personality/boundaries.uai",
    ".uai/personality/preservation-rules.uai"
  ];

  const runtimeSamplerCandidateCap = 1024;

  const localMemoryPackageMaxFiles = 512;
  const localMemoryPackageMaxFileBytes = 1024 * 1024;
  const localMemoryPackageMaxBytes = 16 * 1024 * 1024;
  const localMemoryContextByteLimit = 192;
  const memoryEndpointsDefaultBaseUrl = `${httpsScheme}memoryendpoints.com`;
  const memoryEndpointsSameOriginRelayBaseUrl = "/api/memoryendpoints";
  const memoryEndpointsSubmitPath = "/api/matm/memory-events/submit";
  const memoryEndpointsListPath = "/api/matm/memory-events";
  const memoryEndpointsSearchPath = "/api/matm/search";
  const memoryEndpointsRegisterPath = "/api/matm/agents/register";
  const memoryEndpointsContextByteLimit = 1024;
  const memoryEndpointsMaxSafeTextChars = 16 * 1024;
  const memoryEndpointsMaxSearchResults = 5;
  const memoryEndpointsMaxRetrievedCandidates = 100;
  const memoryEndpointsMaxPreviewResults = 10;
  const memoryEndpointsTinyRustLmScope = "project";
  const memoryEndpointsTinyRustLmScopeId = "tinyrustlm.com";
  const memoryEndpointsDefaultAuthHeader = "authorization";
  const memoryEndpointsConnectorSource = "TinyRustLM MemoryEndpoints connector";
  const uaixMemoryWizardUrl = `${httpsScheme}uaix.org/en-us/tools/ai-memory-package-wizard/`;
  const uaixPersonaPackUrl = `${httpsScheme}uaix.org/en-us/ai-memory/uai-files/persona-uai/personality-packs/`;

  const state = {
    runtimeAsset: null,
    runtimeClient: null,
    runtimeState: null,
    transcriptRevision: 0n,
    encoder: new TextEncoder(),
    decoder: new TextDecoder(),
    modelLoadMs: 0,
    lastGenerateMs: 0,
    lastMeasuredTokens: 0,
    lastInferenceHistoryTurns: 0,
    modelLoadSequence: 0,
    largeModelConsents: new Set(),
    runtimeVariant: "worker-owned-wasm",
    activeModelKey: "",
    activeComposition: null,
    modelLoaded: false,
    modelManifest: null,
    selectorRegistry: null,
    selectorDefaultModelKey: "",
    localModel: null,
    modelCatalogV1Entries: [],
    modelCatalogV1Document: null,
    modelCatalogV1Text: "",
    modelCatalogV1PeerDocument: null,
    modelCatalogV1Authority: null,
    selectedModelCatalogV1Entry: null,
    simpleModelConversionRecovery: null,
    modelCatalogV1Loading: false,
    modelCatalogV1Loaded: false,
    modelCatalogV1LoadState: "unchecked",
    modelCatalogV1PeerLoadState: "unchecked",
    modelCatalogV1FetchAbort: null,
    modelCatalogV1PeerExpiryTimer: null,
    compositionStore: null,
    compositionStoreError: null,
    compositionCleanupPromise: null,
    compositionCleanup: { status: "not-started", passes: 0, removed_installed: 0, removed_staging: 0, error: null },
    activeAcquisitionAbort: null,
    modelAcquisitionCommand: null,
    modelAcquisitionRoute: "",
    modelAcquisitionCompositionId: "",
    modelActivationAbort: null,
    modelActivationCommitPending: false,
    modelActivationTokenSequence: 0,
    selectedCatalogEntry: null,
    localMemoryPackage: null,
    hfSearchAbort: null,
    hasContext: false,
    turnAdmissionPending: false,
    messages: [],
    conversations: [],
    activeConversationId: "",
    selectedPreset: "balanced",
    followConversation: true,
    conversationPersistenceBlocked: false,
    controlsCanGenerate: false,
    controlsCanSelectModel: false,
    generation: {
      inFlight: false,
      stopRequested: false,
      assistantMessageId: "",
      pendingAction: "",
      sequence: 0,
      abortController: null,
      rawOutput: null
    },
    runHistory: [],
    latestDiagnostics: null,
    latestSampling: null,
    consoleAutoScroll: true,
    modelPopoverHoldUntil: 0,
    modelPopoverOpener: null,
    simpleModelPickerAnnouncementSequence: 0,
    simpleModelPickerFocusSequence: 0,
    initialModelBootComplete: false,
    initialModelRestored: false,
    initialModelChooserPresented: false,
    initialModelChooserAutoPresentSuppressed: false,
    peerBaseUrl: "",
    companion: {
      client: companionClient,
      connectionState: companionClient ? "disconnected" : "unsupported",
      statusText: companionClient
        ? "Enter the one-time code when you get a model"
        : "Desktop companion integration unavailable",
      statusIsError: false,
      runtime: null,
      activeOperationId: "",
      activeOperationKind: "",
      activeEntry: null,
      activeStatus: null,
      pendingAcquisition: null,
      pollSequence: 0,
      streamAbort: null,
      browserLoadBytes: 0,
      browserInstallState: "idle",
      browserInstallErrorCode: "none",
      operationRequest: null,
      cancelPromise: null,
      seedRecords: new Map(),
      seedNetworkTail: Promise.resolve(),
      seedMonitorTimer: null,
      seedMonitorSequence: 0,
      seedDisplayOperationId: "",
      seedStatus: "idle",
      seedStatusCode: "none",
      seedStatusText:
        "Local direct sharing has not started. No public reachability or announcement is claimed."
    },
    memoryEndpoints: {
      enabled: false,
      baseUrl: memoryEndpointsDefaultBaseUrl,
      workspaceId: "",
      agentId: "tinyrustlm-agent",
      authHeader: memoryEndpointsDefaultAuthHeader,
      connectionMode: "workspace",
      enrollmentFlow: null,
      enrollmentFlowBaseUrl: "",
      searchTier: "all",
      bearerToken: "",
      connected: false,
      searchResults: [],
      retrievalResults: [],
      retrievalCandidates: [],
      retrievalGeneration: 0,
      packedContext: null,
      packedModelKey: "",
      retrievalReceipt: null,
      deviceId: "",
      outboxStore: null,
      outboxReady: false,
      coordinator: null,
      pendingCount: 0,
      quarantineCount: 0,
      drainPromise: null,
      drainAuthority: null,
      requestController: new AbortController()
    },
    localConnectApprovalMode: "ask",
    localConnectFullControlAcknowledged: false,
    localConnectCategoryRules: null,
    localConnectApprovedApps: [],
    localConnectApprovedAppCategories: Object.create(null),
    localConnectEndpointUrl: `${"http:"}//127.0.0.1:8711`,
    localConnectEndpointApps: null,
    hfLastAccepted: [],
  };

  const el = {
    appShell: document.querySelector(".app-shell"),
    privacyBadge: document.getElementById("privacyBadge"),
    simpleExperience: document.getElementById("simpleExperience"),
    conversationPanel: document.querySelector(".conversation-panel"),
    conversationHeader: document.getElementById("conversationHeader"),
    conversationTitle: document.getElementById("conversationTitle"),
    recentChatsList: document.getElementById("recentChatsList"),
    jumpToLatestButton: document.getElementById("jumpToLatestButton"),
    composerHint: document.getElementById("composerHint"),
    systemStatusDot: document.getElementById("systemStatusDot"),
    statusDetail: document.getElementById("statusDetail"),
    simpleModeButton: document.getElementById("simpleModeButton"),
    advancedModeButton: document.getElementById("advancedModeButton"),
    largeModelDialog: document.getElementById("largeModelDialog"),
    largeModelDialogModel: document.getElementById("largeModelDialogModel"),
    largeModelDialogDownload: document.getElementById("largeModelDialogDownload"),
    largeModelDialogMemory: document.getElementById("largeModelDialogMemory"),
    largeModelCancelButton: document.getElementById("largeModelCancelButton"),
    largeModelConfirmButton: document.getElementById("largeModelConfirmButton"),
    simpleDiscoveryPanel: document.getElementById("simpleDiscoveryPanel"),
    simpleModelRefreshButton: document.getElementById("simpleModelRefreshButton"),
    simpleModelCloseButton: document.getElementById("simpleModelCloseButton"),
    simpleModelPickerStatus: document.getElementById("simpleModelPickerStatus"),
    simpleModelPickerAnnouncement: document.getElementById("simpleModelPickerAnnouncement"),
    simpleModelList: document.getElementById("simpleModelList"),
    simpleModelActionButton: document.getElementById("simpleModelActionButton"),
    simpleCompanionPairing: document.getElementById("simpleCompanionPairing"),
    simpleCompanionPairingCode: document.getElementById("simpleCompanionPairingCode"),
    simpleCompanionPairButton: document.getElementById("simpleCompanionPairButton"),
    simplePeerBaseUrlInput: document.getElementById("simplePeerBaseUrlInput"),
    simpleSavePeerUrlButton: document.getElementById("simpleSavePeerUrlButton"),
    simpleCheckPeerStatusButton: document.getElementById("simpleCheckPeerStatusButton"),
    simplePeerUrlStatus: document.getElementById("simplePeerUrlStatus"),
    companionStatus: document.getElementById("companionStatus"),
    companionSeedStatus: document.getElementById("companionSeedStatus"),
    companionDetectButton: document.getElementById("companionDetectButton"),
    companionForgetButton: document.getElementById("companionForgetButton"),
    companionPairingControls: document.getElementById("companionPairingControls"),
    companionPairingCode: document.getElementById("companionPairingCode"),
    companionPairButton: document.getElementById("companionPairButton"),
    companionImportProgress: document.getElementById("companionImportProgress"),
    companionImportProgressBar: document.getElementById("companionImportProgressBar"),
    companionImportStage: document.getElementById("companionImportStage"),
    companionCancelImportButton: document.getElementById("companionCancelImportButton"),
    simpleOpenAdvancedDiscoveryButton: document.getElementById("simpleOpenAdvancedDiscoveryButton"),
    simpleDiscoveryStatus: document.getElementById("simpleDiscoveryStatus"),
    simpleErrorPanel: document.getElementById("simpleErrorPanel"),
    simpleErrorMessage: document.getElementById("simpleErrorMessage"),
    modelToolbarName: document.getElementById("modelToolbarName"),
    modelLoadPill: document.getElementById("modelLoadPill"),
    modelContextPill: document.getElementById("modelContextPill"),
    keepRunHistoryToggle: document.getElementById("keepRunHistoryToggle"),
    clearRunHistoryButton: document.getElementById("clearRunHistoryButton"),
    runHistoryList: document.getElementById("runHistoryList"),
    runSummary: document.getElementById("runSummary"),
    diagnosticsRail: document.getElementById("diagnosticsRail"),
    diagnosticsRailToggle: document.getElementById("diagnosticsRailToggle"),
    mobileAdvancedButton: document.getElementById("mobileAdvancedButton"),
    clearConsoleButton: document.getElementById("clearConsoleButton"),
    copyConsoleButton: document.getElementById("copyConsoleButton"),
    pauseConsoleScroll: document.getElementById("pauseConsoleScroll"),
    runtimeStatus: document.getElementById("runtimeStatus"),
    wasmState: document.getElementById("wasmState"),
    modelState: document.getElementById("modelState"),
    errorState: document.getElementById("errorState"),
    diagnostics: document.getElementById("diagnostics"),
    console: document.getElementById("console"),
    developer: document.getElementById("developer"),
    response: document.getElementById("response"),
    form: document.getElementById("chatForm"),
    prompt: document.getElementById("prompt"),
    maxTokens: document.getElementById("maxTokens"),
    temperature: document.getElementById("temperature"),
    topK: document.getElementById("topK"),
    topP: document.getElementById("topP"),
    seed: document.getElementById("seed"),
    modelSelect: document.getElementById("modelSelect"),
    localModelFile: document.getElementById("localModelFile"),
    importLocalModelButton: document.getElementById("importLocalModelButton"),
    localModelState: document.getElementById("localModelState"),
    localMemoryPackageSetup: document.getElementById("localMemoryPackageSetup"),
    localMemoryPackageFiles: document.getElementById("localMemoryPackageFiles"),
    inspectLocalMemoryPackageButton: document.getElementById("inspectLocalMemoryPackageButton"),
    clearLocalMemoryPackageButton: document.getElementById("clearLocalMemoryPackageButton"),
    localMemoryPackageStatus: document.getElementById("localMemoryPackageStatus"),
    localMemoryPackageSummary: document.getElementById("localMemoryPackageSummary"),
    localMemoryPackageContextPreview: document.getElementById("localMemoryPackageContextPreview"),
    memoryEndpointsEnabled: document.getElementById("memoryEndpointsEnabled"),
    memoryEndpointsBaseUrl: document.getElementById("memoryEndpointsBaseUrl"),
    memoryEndpointsEnrollmentUrl: document.getElementById("memoryEndpointsEnrollmentUrl"),
    memoryEndpointsRequestedAgentName: document.getElementById("memoryEndpointsRequestedAgentName"),
    memoryEndpointsClaimButton: document.getElementById("memoryEndpointsClaimButton"),
    memoryEndpointsIssuedCredentials: document.getElementById("memoryEndpointsIssuedCredentials"),
    memoryEndpointsCanonicalAgentName: document.getElementById("memoryEndpointsCanonicalAgentName"),
    memoryEndpointsAgentToken: document.getElementById("memoryEndpointsAgentToken"),
    memoryEndpointsCopyCredentialsButton: document.getElementById("memoryEndpointsCopyCredentialsButton"),
    memoryEndpointsReconnectName: document.getElementById("memoryEndpointsReconnectName"),
    memoryEndpointsReconnectToken: document.getElementById("memoryEndpointsReconnectToken"),
    memoryEndpointsReconnectButton: document.getElementById("memoryEndpointsReconnectButton"),
    memoryEndpointsWorkspaceId: document.getElementById("memoryEndpointsWorkspaceId"),
    memoryEndpointsAgentId: document.getElementById("memoryEndpointsAgentId"),
    memoryEndpointsToken: document.getElementById("memoryEndpointsToken"),
    memoryEndpointsAuthHeader: document.getElementById("memoryEndpointsAuthHeader"),
    memoryEndpointsConnectButton: document.getElementById("memoryEndpointsConnectButton"),
    memoryEndpointsSaveShortTermButton: document.getElementById("memoryEndpointsSaveShortTermButton"),
    memoryEndpointsSaveLongTermButton: document.getElementById("memoryEndpointsSaveLongTermButton"),
    memoryEndpointsClearButton: document.getElementById("memoryEndpointsClearButton"),
    memoryEndpointsSearchQuery: document.getElementById("memoryEndpointsSearchQuery"),
    memoryEndpointsSearchTier: document.getElementById("memoryEndpointsSearchTier"),
    memoryEndpointsSearchButton: document.getElementById("memoryEndpointsSearchButton"),
    memoryEndpointsStatus: document.getElementById("memoryEndpointsStatus"),
    memoryEndpointsSearchResults: document.getElementById("memoryEndpointsSearchResults"),
    hfSearchInput: document.getElementById("hfSearchInput"),
    hfSortSelect: document.getElementById("hfSortSelect"),
    hfSearchButton: document.getElementById("hfSearchButton"),
    hfStatus: document.getElementById("hfStatus"),
    hfResults: document.getElementById("hfResults"),
    localConnectApprovalMode: document.getElementById("localConnectApprovalMode"),
    localConnectFullControlAck: document.getElementById("localConnectFullControlAck"),
    localConnectModeWarning: document.getElementById("localConnectModeWarning"),
    localConnectCategoryList: document.getElementById("localConnectCategoryList"),
    localConnectApprovedApps: document.getElementById("localConnectApprovedApps"),
    trustBrowserEmailLocalConnectButton: document.getElementById("trustBrowserEmailLocalConnectButton"),
    saveLocalConnectPolicyButton: document.getElementById("saveLocalConnectPolicyButton"),
    saveLocalConnectPolicyFileButton: document.getElementById("saveLocalConnectPolicyFileButton"),
    resetLocalConnectPolicyButton: document.getElementById("resetLocalConnectPolicyButton"),
    localConnectEndpointUrl: document.getElementById("localConnectEndpointUrl"),
    checkLocalConnectEndpointButton: document.getElementById("checkLocalConnectEndpointButton"),
    dryRunLocalConnectDecisionButton: document.getElementById("dryRunLocalConnectDecisionButton"),
    dryRunLocalConnectActionButton: document.getElementById("dryRunLocalConnectActionButton"),
    executeLocalConnectActionButton: document.getElementById("executeLocalConnectActionButton"),
    localConnectEndpointStatus: document.getElementById("localConnectEndpointStatus"),
    localConnectEndpointAppList: document.getElementById("localConnectEndpointAppList"),
    localConnectPolicyStatus: document.getElementById("localConnectPolicyStatus"),
    localConnectPolicyPreview: document.getElementById("localConnectPolicyPreview"),
    generateButton: document.getElementById("generateButton"),
    sendIcon: document.querySelector("#generateButton .send-icon"),
    stopIcon: document.querySelector("#generateButton .stop-icon"),
    resetButton: document.getElementById("resetButton"),
    clearChatButton: document.getElementById("clearChatButton"),
    conversation: document.getElementById("conversation"),
    benchLoadMs: document.getElementById("benchLoadMs"),
    benchPromptTokens: document.getElementById("benchPromptTokens"),
    benchGeneratedTokens: document.getElementById("benchGeneratedTokens"),
    benchTokensPerSecond: document.getElementById("benchTokensPerSecond"),
    benchScratch: document.getElementById("benchScratch"),
    provenanceState: document.getElementById("provenanceState"),
    provenanceSourceKind: document.getElementById("provenanceSourceKind"),
    provenanceSourceSnapshot: document.getElementById("provenanceSourceSnapshot"),
    provenanceSourceId: document.getElementById("provenanceSourceId"),
    provenanceSourceShape: document.getElementById("provenanceSourceShape"),
    provenanceSourceReview: document.getElementById("provenanceSourceReview"),
    provenanceSourceReviewRoutes: document.getElementById("provenanceSourceReviewRoutes"),
    provenanceSourceReviewArtifacts: document.getElementById("provenanceSourceReviewArtifacts"),
    provenanceSourceTokenizerImport: document.getElementById("provenanceSourceTokenizerImport"),
    provenanceSourceValidation: document.getElementById("provenanceSourceValidation"),
    provenanceAdmission: document.getElementById("provenanceAdmission"),
    provenanceQualityClaim: document.getElementById("provenanceQualityClaim"),
    provenanceTrainedClaim: document.getElementById("provenanceTrainedClaim"),
    provenanceGenome: document.getElementById("provenanceGenome"),
    provenanceSpecies: document.getElementById("provenanceSpecies"),
    provenanceNovelty: document.getElementById("provenanceNovelty"),
    provenancePopulation: document.getElementById("provenancePopulation"),
    provenanceMateSelection: document.getElementById("provenanceMateSelection"),
    provenanceOperator: document.getElementById("provenanceOperator"),
    provenanceSchedule: document.getElementById("provenanceSchedule"),
    provenancePhenotype: document.getElementById("provenancePhenotype"),
    provenanceArtifact: document.getElementById("provenanceArtifact"),
    provenanceFitness: document.getElementById("provenanceFitness"),
    provenanceEvalCases: document.getElementById("provenanceEvalCases"),
    provenanceEvalChecksum: document.getElementById("provenanceEvalChecksum"),
    provenanceChecksum: document.getElementById("provenanceChecksum"),
    provenanceNextGate: document.getElementById("provenanceNextGate")
  };

  const uiStorageKeys = {
    version: "slmcomposer.ui.version",
    mode: "slmcomposer.ui.mode",
    selectedStarter: "slmcomposer.ui.selectedStarter",
    peerBaseUrl: "slmcomposer.ui.peerBaseUrl",
    selectedModelCatalogV1Composition: "tinyrustlm.ui.selectedModelCatalogV1Composition",
    memoryEndpointsEnabled: "slmcomposer.ui.memoryEndpointsEnabled",
    memoryEndpointsBaseUrl: "slmcomposer.ui.memoryEndpointsBaseUrl",
    memoryEndpointsWorkspaceId: "slmcomposer.ui.memoryEndpointsWorkspaceId",
    memoryEndpointsAgentId: "slmcomposer.ui.memoryEndpointsAgentId",
    memoryEndpointsAuthHeader: "slmcomposer.ui.memoryEndpointsAuthHeader",
    memoryEndpointsSearchTier: "slmcomposer.ui.memoryEndpointsSearchTier",
    memoryEndpointsDeviceId: "tinyrustlm.memoryEndpointsDeviceId",
    localConnectApprovalMode: "slmcomposer.ui.localConnectApprovalMode",
    localConnectFullControlAcknowledged: "slmcomposer.ui.localConnectFullControlAcknowledged",
    localConnectCategoryRules: "slmcomposer.ui.localConnectCategoryRules",
    localConnectApprovedApps: "slmcomposer.ui.localConnectApprovedApps",
    localConnectApprovedAppCategories: "slmcomposer.ui.localConnectApprovedAppCategories",
    localConnectEndpointUrl: "slmcomposer.ui.localConnectEndpointUrl",
    creativity: "slmcomposer.ui.creativity",
    length: "slmcomposer.ui.length",
    sidebarCollapsed: "slmcomposer.ui.sidebarCollapsed",
    railCollapsed: "slmcomposer.ui.railCollapsed",
    activeTab: "slmcomposer.ui.activeTab",
    keepRunHistory: "slmcomposer.ui.keepRunHistory",
    runHistory: "slmcomposer.ui.runHistory",
    consolePaused: "slmcomposer.ui.consolePaused"
  };
  const uiSessionStorageKeys = Object.freeze({
    pendingModelAcquisitionComposition:
      "tinyrustlm.session.pendingModelAcquisitionComposition",
    directCompositionSeedCustody:
      "tinyrustlm.session.directCompositionSeedCustody"
  });

  const uiPreferenceIdentity = "local-ai-dashboard";

  const starterProfiles = {
    fast: {
      creativity: "balanced",
      length: "short",
      message: "Fast generation settings selected. Choose a qualified local or P2P model."
    },
    balanced: {
      creativity: "balanced",
      length: "normal",
      message: "Balanced generation settings selected. Choose a qualified local or P2P model."
    },
    precise: {
      creativity: "focused",
      length: "normal",
      message: "Precise generation settings selected. Choose a qualified local or P2P model."
    }
  };

  const semanticSettings = {
    creativity: {
      focused: { temperature: "0", topK: "1", topP: "1" },
      balanced: { temperature: "0.65", topK: "40", topP: "0.90" },
      creative: { temperature: "1", topK: "80", topP: "0.95" }
    },
    length: {
      short: "32",
      normal: "80",
      detailed: "160"
    }
  };

  const generationPresets = {
    balanced: { temperature: "0.70", topK: "40", topP: "0.90" },
    creative: { temperature: "0.95", topK: "80", topP: "0.95" },
    precise: { temperature: "0.25", topK: "20", topP: "0.70" },
    code: { temperature: "0.20", topK: "30", topP: "0.80" },
    json: { temperature: "0", topK: "1", topP: "1" }
  };
  const starterGenerationPresets = {
    summarize: "precise",
    code: "code",
    rewrite: "precise",
    json: "json"
  };

  const localConnectPolicyKind = "tinyrustlm.local_connect_approval_policy.v0";
  const localConnectPolicyVersion = 2;
  const localConnectAppInventoryPolicy = "bounded-name-discovery-no-paths-v1";
  const localConnectAppInventoryPathExposure = "never";
  const localConnectAppApprovalBindingPolicy = "app-and-category-v1";
  const localConnectActionExecutionPolicy = "typed-action-dry-run-default-execution-consent-v1";
  const localConnectApprovalModes = {
    ask: {
      label: "Ask every time",
      warning: "Local Connect asks before app control."
    },
    selected: {
      label: "Always approve selected",
      warning: "Only categories or apps marked Always approve can run without prompts."
    },
    full: {
      label: "Full local-control lab mode",
      warning: "High risk: requires a non-sensitive local machine acknowledgement before endpoint use."
    }
  };
  const localConnectApprovalLevels = {
    ask: "Ask every time",
    always: "Always approve",
    deny: "Block"
  };
  const localConnectAppCategories = Object.freeze([
    {
      id: "browser",
      label: "Browsers",
      risk: "medium",
      warning: "Can read pages, submit forms, download files, and act inside signed-in browser sessions."
    },
    {
      id: "email",
      label: "Email apps",
      risk: "high",
      warning: "Can read, send, delete, or forward messages and attachments."
    },
    {
      id: "documents",
      label: "Docs and office",
      risk: "medium",
      warning: "Can edit documents, spreadsheets, and local business records."
    },
    {
      id: "files",
      label: "Files and folders",
      risk: "high",
      warning: "Can move, overwrite, upload, or delete local files."
    },
    {
      id: "terminal",
      label: "Terminal and scripts",
      risk: "critical",
      warning: "Can execute commands, install software, and change system state."
    },
    {
      id: "secrets",
      label: "Passwords, payments, settings",
      risk: "critical",
      warning: "Can affect credentials, accounts, money movement, and security settings."
    }
  ]);
  const localConnectKnownAppCategories = Object.freeze(new Map([
    ["chrome.exe", "browser"],
    ["msedge.exe", "browser"],
    ["firefox.exe", "browser"],
    ["outlook.exe", "email"],
    ["thunderbird.exe", "email"],
    ["winword.exe", "documents"],
    ["excel.exe", "documents"],
    ["explorer.exe", "files"],
    ["powershell.exe", "terminal"],
    ["pwsh.exe", "terminal"],
    ["cmd.exe", "terminal"],
    ["bitwarden.exe", "secrets"],
    ["1password.exe", "secrets"]
  ]));

  function storageGet(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_error) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (_error) {
      // UI preferences are best-effort only.
      return false;
    }
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (_error) {
      // UI preferences are best-effort only.
    }
  }

  function sessionStorageGet(key, fallback) {
    try {
      const value = window.sessionStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_error) {
      return fallback;
    }
  }

  function sessionStorageSet(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function sessionStorageRemove(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch (_error) {
      // A pending chooser intent is best-effort and never authorizes acquisition by itself.
    }
  }

  function normalizeDirectCompositionSeedCustody(value) {
    const keys = value && typeof value === "object" && !Array.isArray(value)
      ? Object.keys(value)
      : [];
    if (keys.length !== 2 || keys[0] !== "schema" || keys[1] !== "records" ||
        value.schema !== directCompositionSeedCustodySchema ||
        !Array.isArray(value.records) ||
        value.records.length > maximumDirectCompositionSeedLifecycles) {
      throw new Error("Direct seed custody was invalid");
    }
    const operationIds = new Set();
    const records = value.records.map((record) => {
      const recordKeys = record && typeof record === "object" && !Array.isArray(record)
        ? Object.keys(record)
        : [];
      if (recordKeys.length !== 3 ||
          recordKeys[0] !== "operationId" ||
          recordKeys[1] !== "compositionId" ||
          recordKeys[2] !== "stopRequested" ||
          !/^[0-9a-f]{64}$/u.test(record.operationId || "") ||
          !/^sha256:[0-9a-f]{64}$/u.test(record.compositionId || "") ||
          typeof record.stopRequested !== "boolean" ||
          operationIds.has(record.operationId)) {
        throw new Error("Direct seed custody record was invalid");
      }
      operationIds.add(record.operationId);
      return Object.freeze({
        operationId: record.operationId,
        compositionId: record.compositionId,
        stopRequested: record.stopRequested
      });
    });
    return Object.freeze({
      schema: directCompositionSeedCustodySchema,
      records: Object.freeze(records)
    });
  }

  function encodeDirectCompositionSeedCustody(value) {
    const custody = normalizeDirectCompositionSeedCustody(value);
    const text = JSON.stringify({
      schema: custody.schema,
      records: custody.records.map((record) => ({
        operationId: record.operationId,
        compositionId: record.compositionId,
        stopRequested: record.stopRequested
      }))
    });
    if (text.length > 2048) {
      throw new Error("Direct seed custody exceeded its byte boundary");
    }
    return text;
  }

  function decodeDirectCompositionSeedCustody(text) {
    if (typeof text !== "string" || !text || text.length > 2048) {
      throw new Error("Direct seed custody wire was invalid");
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_error) {
      throw new Error("Direct seed custody wire was invalid");
    }
    const custody = normalizeDirectCompositionSeedCustody(parsed);
    if (encodeDirectCompositionSeedCustody(custody) !== text) {
      throw new Error("Direct seed custody was not canonical");
    }
    return custody;
  }

  function persistDirectCompositionSeedCustody() {
    const records = Array.from(state.companion.seedRecords.values()).map((record) => ({
      operationId: record.operationId,
      compositionId: record.compositionId,
      stopRequested: record.stopRequested === true
    }));
    sessionStorageSet(
      uiSessionStorageKeys.directCompositionSeedCustody,
      encodeDirectCompositionSeedCustody({
        schema: directCompositionSeedCustodySchema,
        records
      })
    );
  }

  function restoreDirectCompositionSeedCustody() {
    const text = sessionStorageGet(uiSessionStorageKeys.directCompositionSeedCustody, "");
    if (!text) {
      return 0;
    }
    let custody;
    try {
      custody = decodeDirectCompositionSeedCustody(text);
    } catch (_error) {
      sessionStorageRemove(uiSessionStorageKeys.directCompositionSeedCustody);
      return 0;
    }
    for (const item of custody.records) {
      state.companion.seedRecords.set(item.operationId, {
        operationId: item.operationId,
        compositionId: item.compositionId,
        state: "reconcile-required",
        code: "direct-composition-seed-browser-reload",
        projection: null,
        startRequest: null,
        readRequest: null,
        stopRequest: null,
        stopCustodyRequest: null,
        stopRequested: item.stopRequested,
        pollCount: 0
      });
      state.companion.seedDisplayOperationId = item.operationId;
    }
    if (custody.records.length) {
      state.companion.seedStatus = "reconciling";
      state.companion.seedStatusCode = "direct-composition-seed-browser-reload";
      state.companion.seedStatusText =
        "Reconnecting to verify local direct sharing. No public reachability or announcement is claimed.";
    }
    return custody.records.length;
  }

  function newConversationId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    const random = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);
    return `${prefix}-${Date.now().toString(36)}-${random}`;
  }

  function conversationTimestamp() {
    return new Date().toISOString();
  }

  function currentGenerationSettings() {
    const maxTokens = Math.max(1, Math.min(512, Number.parseInt(el.maxTokens && el.maxTokens.value, 10) || 1));
    const temperature = Math.max(0, Math.min(2, Number.parseFloat(el.temperature && el.temperature.value) || 0));
    const topK = Math.max(1, Math.min(512, Number.parseInt(el.topK && el.topK.value, 10) || 1));
    const topP = Math.max(0.01, Math.min(1, Number.parseFloat(el.topP && el.topP.value) || 1));
    const parsedSeed = Number.parseInt(el.seed && el.seed.value, 10);
    const seed = parsedSeed === -1
      ? -1
      : Math.max(0, Math.min(4294967295, Number.isFinite(parsedSeed) ? parsedSeed : 1));
    return {
      maxTokens: String(maxTokens),
      temperature: String(temperature),
      topK: String(topK),
      topP: String(topP),
      seed: String(seed)
    };
  }

  function currentConversationMemoryMode() {
    const local = Boolean(state.localMemoryPackage && state.localMemoryPackage.valid);
    const hosted = Boolean(state.memoryEndpoints.enabled && state.memoryEndpoints.workspaceId);
    if (local && hosted) {
      return "both";
    }
    if (local) {
      return "local";
    }
    return hosted ? "hosted" : "none";
  }

  function activeConversation() {
    return state.conversations.find((conversation) => conversation.id === state.activeConversationId) || null;
  }

  function replaceConversation(nextConversation, makeActive) {
    const index = state.conversations.findIndex((conversation) => conversation.id === nextConversation.id);
    if (index >= 0) {
      state.conversations.splice(index, 1, nextConversation);
    } else {
      state.conversations.push(nextConversation);
    }
    state.conversations.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id));
    state.conversations = state.conversations.slice(0, conversationApi.maxConversations);
    if (makeActive !== false) {
      state.activeConversationId = nextConversation.id;
      state.messages = nextConversation.messages;
    }
  }

  function protectedConversationValues() {
    return [
      state.memoryEndpoints.bearerToken,
      el.memoryEndpointsToken ? el.memoryEndpointsToken.value : ""
    ].filter(Boolean);
  }

  function persistConversations() {
    const current = activeConversation();
    if (current) {
      try {
        replaceConversation(conversationApi.updateConversationMetadata(current, {
          modelKey: state.activeModelKey || (el.modelSelect ? el.modelSelect.value : ""),
          preset: state.selectedPreset,
          generation: currentGenerationSettings(),
          memoryMode: currentConversationMemoryMode()
        }, conversationTimestamp()), true);
      } catch (_error) {
        state.conversationPersistenceBlocked = true;
      }
    }

    // Validate rows independently so one sensitive chat cannot evict unrelated safe history.
    const options = { protectedValues: protectedConversationValues() };
    const savable = [];
    let activeRejected = false;
    for (const conversation of state.conversations.slice(0, conversationApi.maxConversations)) {
      try {
        conversationApi.serializeConversationStore([conversation], options);
        savable.push(conversation);
      } catch (_error) {
        activeRejected = activeRejected || conversation.id === state.activeConversationId;
      }
    }

    let serialized = "";
    for (;;) {
      try {
        serialized = conversationApi.serializeConversationStore(savable, options);
        break;
      } catch (error) {
        if (!(error instanceof RangeError) || savable.length === 0) {
          serialized = conversationApi.serializeConversationStore([], options);
          break;
        }
        savable.pop();
      }
    }
    const stored = storageSet(conversationApi.storageKey, serialized);
    state.conversationPersistenceBlocked = activeRejected || !stored;
    if (el.composerHint) {
      el.composerHint.textContent = state.conversationPersistenceBlocked
        ? "Not saved: sensitive text or local storage limits"
        : state.modelLoaded
          ? "Ready for a message"
          : "Choose a model to begin";
    }
    renderRecentChats();
    return stored && !activeRejected;
  }

  function restoreConversationStore() {
    const restored = conversationApi.parseConversationStore(
      storageGet(conversationApi.storageKey, ""),
      { protectedValues: protectedConversationValues() }
    );
    state.conversations = restored.conversations;
    const latest = state.conversations[0] || null;
    state.activeConversationId = latest ? latest.id : "";
    state.messages = latest ? latest.messages : [];
    if (latest) {
      restoreConversationSettings(latest);
    }
    if (restored.rejectedCount > 0 || state.messages.some((message) => message.errorCode === "interrupted_after_restart")) {
      persistConversations();
    } else {
      renderRecentChats();
    }
  }

  function restoreConversationSettings(conversation) {
    if (!conversation) {
      return;
    }
    applyGenerationPreset(conversation.preset);
    const settings = conversation.generation;
    if (el.maxTokens) {
      el.maxTokens.value = settings.maxTokens;
    }
    if (el.temperature) {
      el.temperature.value = settings.temperature;
    }
    if (el.topK) {
      el.topK.value = settings.topK;
    }
    if (el.topP) {
      el.topP.value = settings.topP;
    }
    if (el.seed) {
      el.seed.value = settings.seed;
    }
    syncRangeControls();
  }

  function renderRecentChats() {
    if (!el.recentChatsList) {
      return;
    }
    el.recentChatsList.replaceChildren();
    if (state.conversations.length === 0) {
      const empty = document.createElement("li");
      empty.className = "recent-empty";
      empty.textContent = "No saved chats yet.";
      el.recentChatsList.append(empty);
      return;
    }
    for (const conversation of state.conversations.slice(0, conversationApi.maxConversations)) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const icon = document.createElementNS(svgNamespace, "svg");
      const use = document.createElementNS(svgNamespace, "use");
      const title = document.createElement("span");
      const time = document.createElement("time");
      button.type = "button";
      button.dataset.conversationId = conversation.id;
      button.setAttribute("aria-current", String(conversation.id === state.activeConversationId));
      button.setAttribute("aria-label", `Open conversation: ${conversation.title}`);
      use.setAttribute("href", "#icon-chat");
      icon.append(use);
      title.className = "recent-chat-title";
      title.textContent = conversation.title;
      time.className = "recent-chat-time";
      time.dateTime = conversation.updatedAt;
      time.textContent = new Date(conversation.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" });
      button.append(icon, title, time);
      item.append(button);
      el.recentChatsList.append(item);
    }
  }

  function loadConversation(conversationId) {
    const conversation = state.conversations.find((candidate) => candidate.id === conversationId);
    if (!conversation || state.generation.inFlight) {
      return;
    }
    state.activeConversationId = conversation.id;
    state.messages = conversation.messages;
    state.followConversation = true;
    restoreConversationSettings(conversation);
    renderConversation();
    renderRecentChats();
    if (el.prompt) {
      el.prompt.focus();
    }
  }

  function startNewConversation() {
    if (state.generation.inFlight) {
      state.generation.pendingAction = "new-chat";
      requestGenerationStop();
      return;
    }
    state.generation.pendingAction = "";
    state.activeConversationId = "";
    state.messages = [];
    state.followConversation = true;
    if (el.prompt) {
      el.prompt.value = "";
      resizeComposer();
      el.prompt.focus();
    }
    renderConversation();
    renderRecentChats();
  }

  function clearActiveConversation() {
    if (!state.activeConversationId || state.generation.inFlight) {
      return;
    }
    state.conversations = state.conversations.filter((conversation) => conversation.id !== state.activeConversationId);
    state.activeConversationId = "";
    state.messages = [];
    state.followConversation = true;
    persistConversations();
    renderConversation();
  }

  function resetUiPreferencesForIdentity() {
    if (storageGet(uiStorageKeys.version, "") === uiPreferenceIdentity) {
      return;
    }
    storageRemove(uiStorageKeys.mode);
    storageRemove(uiStorageKeys.selectedStarter);
    storageRemove(uiStorageKeys.sidebarCollapsed);
    storageRemove(uiStorageKeys.localConnectApprovalMode);
    storageRemove(uiStorageKeys.localConnectFullControlAcknowledged);
    storageRemove(uiStorageKeys.localConnectCategoryRules);
    storageRemove(uiStorageKeys.localConnectApprovedApps);
    storageRemove(uiStorageKeys.localConnectApprovedAppCategories);
    storageRemove(uiStorageKeys.localConnectEndpointUrl);
    storageSet(uiStorageKeys.version, uiPreferenceIdentity);
  }

  function initialAppMode() {
    const search = new URLSearchParams(window.location.search);
    if (search.get("mode") === "advanced") {
      return "advanced";
    }
    return "simple";
  }

  function selectedRadioValue(name, fallback) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : fallback;
  }

  function setRadioValue(name, value) {
    const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) {
      input.checked = true;
    }
  }

  function copyText(text) {
    const value = String(text || "");
    if (!value) {
      return;
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(value).catch(() => fallbackCopyText(value));
      return;
    }
    fallbackCopyText(value);
  }

  function fallbackCopyText(value) {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    try {
      document.execCommand("copy");
    } catch (_error) {
      // Clipboard access is best-effort when the browser blocks both supported paths.
    }
    input.remove();
  }

  function downloadTextFile(fileName, text, mimeType = "application/json") {
    const blob = new Blob([text], { type: `${mimeType}; charset=utf-8` });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = safeLocalModelName(fileName);
    link.addEventListener("click", (event) => event.stopPropagation());
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  function systemStateForText(text, isError) {
    const value = String(text || "").toLowerCase();
    if (isError || value.includes("failed") || value.includes("rejected") || value.includes("error")) {
      return ["error", "Error"];
    }
    if (value.includes("generating")) {
      return ["generating", "Generating"];
    }
    if (value.includes("catalog") || value.includes("metadata")) {
      return ["fetching", "Fetching catalog"];
    }
    if (value.includes("import")) {
      return ["importing", "Importing local model"];
    }
    if (value.includes("loading runtime")) {
      return ["loading", "Compiling WASM"];
    }
    if (value.includes("loading") || value.includes("assembling") || value.includes("applying")) {
      return ["loading", "Loading model"];
    }
    if (value === "context limit reached") {
      return ["ready", "Start a new chat"];
    }
    if (value === "ready") {
      return ["ready", "Ready"];
    }
    if (value.includes("runtime ready") || value.includes("choose a local")) {
      return ["waiting", "Waiting for model"];
    }
    return ["booting", "Booting"];
  }

  function updateSystemStatus(text, isError) {
    if (!el.appShell) {
      return;
    }
    const [stateName, detail] = systemStateForText(text, isError);
    el.appShell.dataset.systemState = stateName;
    if (el.statusDetail) {
      el.statusDetail.textContent = detail;
    }
  }

  function friendlyError(text) {
    const value = String(text || "").trim();
    if (!value || value === "none") {
      return "";
    }
    if (value === "catalog-admission-timeout") {
      return "Checking the model took too long. Check your connection and try again.";
    }
    if (value === "browser-runtime-timeout") {
      return "Preparing the local runtime took too long. Check your connection and try again.";
    }
    if (value === "model-cache-open-timeout") {
      return "Checking your saved model took too long. Reload to check again. Your saved model has not been removed.";
    }
    if (value.toLowerCase().includes("catalog")) {
      return "The model list could not be loaded. Check the URL or try a local JSON list.";
    }
    if (value.toLowerCase().includes("prompt byte limit")) {
      return "The prompt is too large for this browser-local model. Try a shorter prompt.";
    }
    if (value.toLowerCase().includes("model")) {
      return "The composition could not be loaded. Check that all six admitted files are selected and unchanged.";
    }
    return "The local runtime could not finish that action. Advanced Mode has the raw technical detail.";
  }

  function renderSimpleError(text, isError) {
    if (!el.simpleErrorPanel || !el.simpleErrorMessage) {
      return;
    }
    const message = isError ? friendlyError(text) : "";
    el.simpleErrorPanel.hidden = !message;
    if (message) {
      el.simpleErrorMessage.textContent = message;
    }
  }

  function appendPlainResponse(container, text) {
    if (text) {
      container.append(document.createTextNode(text));
    }
  }

  function renderResponse(container, text, isError) {
    const value = String(text === undefined || text === null ? "" : text);
    container.replaceChildren();
    container.classList.toggle("error", Boolean(isError));
    container.dataset.rawText = value;
    if (!value) {
      return;
    }
    const fencePattern = /```([A-Za-z0-9_-]+)?\n?([\s\S]*?)```/g;
    let cursor = 0;
    let match = fencePattern.exec(value);
    while (match) {
      appendPlainResponse(container, value.slice(cursor, match.index));
      const block = document.createElement("div");
      const copyButton = document.createElement("button");
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      block.className = "response-code-block";
      copyButton.className = "copy-code-button";
      copyButton.type = "button";
      copyButton.setAttribute("aria-label", "Copy code block");
      code.textContent = match[2] || "";
      pre.append(code);
      copyButton.addEventListener("click", () => copyText(code.textContent));
      block.append(copyButton, pre);
      container.append(block);
      cursor = match.index + match[0].length;
      match = fencePattern.exec(value);
    }
    appendPlainResponse(container, value.slice(cursor));
  }

  function ensureCopyButton(node) {
    if (!node || !node.classList || !node.classList.contains("copyable")) {
      return;
    }
    const raw = Array.from(node.childNodes)
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent)
      .join("")
      .trim();
    if (!raw || raw === "waiting" || node.querySelector(".copy-field-button")) {
      return;
    }
    const button = document.createElement("button");
    button.className = "copy-field-button";
    button.type = "button";
    button.setAttribute("aria-label", "Copy field value");
    button.addEventListener("click", () => copyText(raw));
    node.append(button);
  }

  function setText(node, text, isError) {
    if (!node) {
      return;
    }
    if (node === el.response) {
      renderResponse(node, text, isError);
    } else {
      node.textContent = text;
      node.classList.toggle("error", Boolean(isError));
      ensureCopyButton(node);
    }
    if (node === el.runtimeStatus) {
      updateSystemStatus(text, isError);
    }
    if (node === el.errorState) {
      renderSimpleError(text, isError);
    }
    if (node === el.modelState || node === el.localModelState) {
      updateModelSummary();
    }
  }

  function updateOfflineReadiness() {
    if (!el.privacyBadge) {
      return;
    }
    const modelReady = state.modelLoaded === true;
    const localMemoryReady = Boolean(state.localMemoryPackage && state.localMemoryPackage.valid);
    const hostedMemoryEnabled = Boolean(state.memoryEndpoints && state.memoryEndpoints.enabled);
    const hostedMemoryConnected = Boolean(hostedMemoryEnabled && state.memoryEndpoints.connected);
    const parts = [modelReady
      ? "This model is loaded in your browser. You can disconnect from the internet and keep chatting in this open tab while the model remains loaded."
      : "Load and verify a local or P2P model before disconnecting; no chat model is loaded yet."];

    if (localMemoryReady) {
      parts.push("Your local copied UAIX Memory Deck remains available as offline memory.");
    } else {
      parts.push("No local memory deck is active. Local copied memory remains optional; load a local UAIX Memory Deck before going offline if you need memory context without internet.");
    }

    if (hostedMemoryEnabled) {
      parts.push(hostedMemoryConnected
        ? "TinyRustLM.com Connect uses MemoryEndpoints.com for worldwide memory and requires internet for new reads and writes; the local sync queue uploads after you reconnect."
        : "TinyRustLM.com Connect requires explicit MemoryEndpoints.com sign-in and provider selection; local sync changes can remain queued until you reconnect.");
    } else {
      parts.push("Local copied memory and the local sync queue remain optional. The TinyRustLM.com Connect plugin recommends MemoryEndpoints.com for memory available worldwide and across devices when you are online.");
    }

    const message = parts.join(" ");
    el.privacyBadge.title = message;
    el.privacyBadge.setAttribute("aria-label", `Local inference and offline readiness. ${message}`);
    el.privacyBadge.dataset.offlineReady = modelReady ? "true" : "false";
    el.privacyBadge.dataset.memoryMode = localMemoryReady
      ? hostedMemoryEnabled ? "local-and-worldwide-sync" : "local"
      : hostedMemoryEnabled ? "worldwide-sync-only" : "none";
  }

  function updateModelSummary() {
    if (!el.modelSelect) {
      updateOfflineReadiness();
      return;
    }
    const selected = el.modelSelect.selectedOptions && el.modelSelect.selectedOptions[0]
      ? el.modelSelect.selectedOptions[0].textContent.trim()
      : "No model selected";
    const stateText = el.modelState ? el.modelState.textContent : "";
    const model = paths.models[state.activeModelKey] || paths.models[el.modelSelect.value] || null;
    const hasLoadedModel = state.modelLoaded === true;
    const hasLocalCandidate = Boolean(state.localModel);
    const friendlyModelName = hasLoadedModel
      ? selected
      : hasLocalCandidate
        ? state.localModel.label || "Selected local composition"
        : "Choose a model";
    if (el.modelToolbarName) {
      el.modelToolbarName.textContent = friendlyModelName;
    }
    if (el.modelLoadPill) {
      let pillText = "No model imported";
      let pillClass = "status-pill neutral";
      const lowerState = String(stateText || "").toLowerCase();
      if (hasLoadedModel) {
        pillText = "Loaded locally";
        pillClass = "status-pill success";
      } else if (lowerState.includes("loading") || lowerState.includes("reading") || lowerState.includes("import")) {
        pillText = "Importing";
        pillClass = "status-pill info";
      } else if (lowerState.includes("error") || lowerState.includes("rejected") || lowerState.includes("failed")) {
        pillText = "Needs attention";
        pillClass = "status-pill error";
      } else if (hasLocalCandidate) {
        pillText = "Ready to import";
        pillClass = "status-pill neutral";
      }
      let dot = el.modelLoadPill.querySelector(".mini-dot");
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "mini-dot";
      }
      el.modelLoadPill.className = pillClass;
      el.modelLoadPill.replaceChildren(dot, document.createTextNode(pillText));
    }
    if (el.modelContextPill) {
      const localMemoryActive = Boolean(state.localMemoryPackage && state.localMemoryPackage.valid);
      const hostedMemoryActive = memoryEndpointsHostedContextActive();
      el.modelContextPill.textContent = localMemoryActive && hostedMemoryActive
        ? "UAIX + Web memory"
        : localMemoryActive
          ? "UAIX memory active"
          : hostedMemoryActive
            ? "Web memory active"
            : hasLoadedModel && model && Number.isFinite(model.maxTokens)
              ? `${model.maxTokens} max tokens`
              : "Browser local";
      el.modelContextPill.className = localMemoryActive || hostedMemoryActive
        ? "status-pill info"
        : "status-pill neutral";
    }
    updateOfflineReadiness();
  }

  function setAppMode(mode) {
    const nextMode = mode === "advanced" ? "advanced" : "simple";
    if (el.appShell) {
      el.appShell.dataset.mode = nextMode;
    }
    if (el.simpleModeButton) {
      el.simpleModeButton.setAttribute("aria-pressed", String(nextMode === "simple"));
    }
    if (el.advancedModeButton) {
      el.advancedModeButton.setAttribute("aria-pressed", String(nextMode === "advanced"));
    }
    storageSet(uiStorageKeys.mode, nextMode);
    renderSimpleModelPicker();
  }

  // Updates visible status immediately while deduplicating optional assistive announcements.
  function setSimpleModelPickerStatus(text, isError, options = {}) {
    if (!el.simpleModelPickerStatus) {
      return;
    }
    const nextText = String(text || "");
    el.simpleModelPickerStatus.textContent = nextText;
    el.simpleModelPickerStatus.classList.toggle("error", Boolean(isError));
    if (!el.simpleModelPickerAnnouncement || options.announce === false) {
      return;
    }
    if (el.simpleModelPickerAnnouncement.textContent === nextText) {
      return;
    }
    const sequence = state.simpleModelPickerAnnouncementSequence + 1;
    state.simpleModelPickerAnnouncementSequence = sequence;
    el.simpleModelPickerAnnouncement.textContent = "";
    window.requestAnimationFrame(() => {
      if (sequence === state.simpleModelPickerAnnouncementSequence &&
          el.simpleModelPickerAnnouncement) {
        el.simpleModelPickerAnnouncement.textContent = nextText;
      }
    });
  }

  function reportSimpleModelPickerCommandError(error) {
    const code = catalogText(error && error.code) || "model-acquisition-failed";
    appendConsole(`model acquisition command failed (${code}): ${errorMessage(error)}`);
    if (el.simpleModelPickerStatus && el.simpleModelPickerStatus.classList.contains("error")) {
      return;
    }
    setSimpleModelPickerStatus(basicModelAcquisitionFailureMessage("rejected", code), true);
  }

  // Keeps typed companion detail in Advanced while Basic receives actionable plain language.
  function basicModelAcquisitionFailureMessage(terminalState, errorCode) {
    const stateName = catalogText(terminalState).toLowerCase();
    const code = catalogText(errorCode).toLowerCase();
    if (stateName === "cancelled" || code.includes("cancel")) {
      return "Model preparation was cancelled before browser installation completed.";
    }
    if (code.includes("license")) {
      return "This model needs a license review before it can be prepared on this device.";
    }
    if (code.includes("storage") || code.includes("quota") || code.includes("disk") ||
        code.includes("space")) {
      return "There is not enough available storage to prepare this model on this device.";
    }
    if (code.includes("unsupported") || code.includes("not-supported")) {
      return "This model cannot be prepared on this device.";
    }
    if (code.includes("digest") || code.includes("hash") || code.includes("identity") ||
        code.includes("verify")) {
      return "The model could not be verified, so it was not installed.";
    }
    if (code === "create-response-lost" || code === "poll-response-lost") {
      return "The companion reply was interrupted. Use Cancel to safely check and stop model preparation.";
    }
    return "The desktop companion could not prepare this model. Open Advanced for technical details.";
  }

  function simpleModelCompositionBytes(entry) {
    if (!entry || !entry.composition || !Array.isArray(entry.composition.members)) {
      return 0;
    }
    return entry.composition.members.reduce((total, member) => {
      const bytes = Number(member && member.bytes);
      return Number.isSafeInteger(bytes) && bytes > 0 ? total + bytes : total;
    }, 0);
  }

  function latchRecoverableCompositionStoreError(error) {
    const StoreError = modelCompositionStoreApi.ModelCompositionStoreError;
    if (typeof StoreError !== "function") {
      return false;
    }
    const seen = new Set();
    let candidate = error;
    for (let depth = 0; depth < 8 && candidate && typeof candidate === "object"; depth += 1) {
      if (candidate instanceof StoreError &&
          recoverableCompositionStoreCodes.has(candidate.code)) {
        state.compositionStoreError = candidate;
        return true;
      }
      if (seen.has(candidate)) {
        break;
      }
      seen.add(candidate);
      candidate = candidate.cause;
    }
    return false;
  }

  function ensureModelCompositionStore() {
    if (state.compositionStore) {
      return state.compositionStore;
    }
    try {
      const adapter = modelCompositionStoreApi.createOpfsAdapter({
        createSha256: incrementalSha256Api.createSha256
      });
      state.compositionStore = modelCompositionStoreApi.createModelCompositionStore({
        adapter,
        maximumCompositionBytes: ownedModelMaxBytes
      });
      state.compositionStoreError = null;
      return state.compositionStore;
    } catch (error) {
      state.compositionStoreError = error;
      throw error;
    }
  }

  async function compositionStoreForInstall(signal) {
    const store = ensureModelCompositionStore();
    if (state.compositionStoreError) {
      const discarded = await store.discardInvalidActive({ signal });
      state.compositionStoreError = null;
      if (discarded) {
        setSimpleModelPickerStatus(
          "The damaged browser cache was removed; downloading a verified copy.",
          false
        );
      }
    }
    return store;
  }

  // Keep acquisition cancellation and the loader's metadata deadline on one signal chain.
  async function loadCatalogAdmission(entry, signal) {
    if (!entry || !entry.browserAdmission) {
      throw new Error("The selected catalog model has no browser admission");
    }
    return catalogAdmissionLoaderApi.load({
      catalogView: entry,
      catalogBaseUrl: miniModelCatalogV1Api.CATALOG_URL,
      fetch: window.fetch.bind(window),
      signal,
      admissionParser: browserModelAdmissionApi,
      crypto: window.crypto
    });
  }

  function catalogQualificationError(code, message, cause) {
    const error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
  }

  // Revalidates time and identity at the moment an operation consumes catalog authority.
  function requireCurrentCatalogEntry(entry) {
    let catalog;
    try {
      catalog = miniModelCatalogV1Api.validateCatalog(state.modelCatalogV1Document);
    } catch (error) {
      throw catalogQualificationError(
        "model-catalog-not-current",
        "The verified model list is unavailable or expired; refresh before continuing",
        error
      );
    }
    const authority = state.modelCatalogV1Authority && state.modelCatalogV1Authority.catalog;
    const entryAuthority = entry && entry.catalogAuthority;
    const currentEntry = state.modelCatalogV1Entries.find((candidate) => candidate === entry);
    if (!authority || !entryAuthority || !currentEntry ||
        authority.id !== catalog.catalog_id || authority.revision !== catalog.revision ||
        authority.generatedAtUtc !== catalog.generated_at_utc ||
        authority.validUntilUtc !== catalog.valid_until_utc ||
        entryAuthority.catalogId !== authority.id ||
        entryAuthority.revision !== authority.revision ||
        entryAuthority.generatedAtUtc !== authority.generatedAtUtc ||
        entryAuthority.validUntilUtc !== authority.validUntilUtc) {
      throw catalogQualificationError(
        "model-catalog-entry-not-current",
        "The selected model no longer belongs to the current verified model list"
      );
    }
    return currentEntry;
  }

  function currentCatalogEntryForAdmission(admission) {
    const graphIdentity = admission && admission.composition &&
      catalogText(admission.composition.graphIdentitySha256).toLowerCase();
    const compositionId = /^[0-9a-f]{64}$/u.test(graphIdentity)
      ? `sha256:${graphIdentity}`
      : "";
    return compositionId
      ? state.modelCatalogV1Entries.find((entry) => (
        entry.composition && entry.composition.compositionId === compositionId
      )) || null
      : null;
  }

  function requireCurrentCatalogAdmission(entry, admission) {
    const currentEntry = requireCurrentCatalogEntry(entry);
    let disposition;
    try {
      disposition = miniModelCatalogV1Api.qualificationDisposition(
        state.modelCatalogV1Document,
        admission
      );
    } catch (error) {
      throw catalogQualificationError(
        "model-qualification-not-current",
        "The model qualification could not be confirmed against the current model list",
        error
      );
    }
    if (disposition.status !== "current" || !disposition.entry ||
        disposition.compositionId !== currentEntry.composition.compositionId ||
        disposition.receiptId !== currentEntry.qualification.receiptId) {
      throw catalogQualificationError(
        `model-${disposition.reason || "qualification-not-current"}`,
        "The model qualification was revoked, replaced, superseded, or removed"
      );
    }
    return Object.freeze({ entry: currentEntry, disposition });
  }

  function requireCurrentStoredComposition(storedComposition) {
    const authority = storedComposition && storedComposition.admissionAuthority;
    if (!authority || typeof authority.admissionText !== "string" ||
        typeof authority.qualificationReceiptText !== "string" ||
        typeof authority.catalogText !== "string" ||
        !authority.catalogDocument || !authority.catalogAuthority) {
      throw catalogQualificationError(
        "model-cache-custody-incomplete",
        "The cached model does not contain complete qualification custody"
      );
    }
    const admission = browserModelAdmissionApi.parseAdmissionText(
      authority.admissionText
    );
    assertAdmissionRuntime(admission);
    if (state.modelCatalogV1Authority && state.modelCatalogV1Authority.catalog &&
        (authority.catalogAuthority.id !== state.modelCatalogV1Authority.catalog.id ||
        authority.catalogAuthority.revision > state.modelCatalogV1Authority.catalog.revision ||
        (authority.catalogAuthority.revision === state.modelCatalogV1Authority.catalog.revision &&
          authority.catalogAuthority.sha256 !== state.modelCatalogV1Authority.catalog.sha256))) {
      throw catalogQualificationError(
        "model-catalog-authority-conflict",
        "The cached model catalog authority conflicts with the current verified model list"
      );
    }
    const entry = currentCatalogEntryForAdmission(admission);
    if (!entry) {
      throw catalogQualificationError(
        "model-catalog-delisted",
        "The cached model is not present in the current verified model list"
      );
    }
    const manifestMembers = storedComposition.manifest && storedComposition.manifest.members;
    const catalogMembers = entry.composition && entry.composition.members;
    const admissionBytes = state.encoder.encode(authority.admissionText);
    const receiptBytes = state.encoder.encode(authority.qualificationReceiptText);
    const identitiesMatch = entry.source && entry.source.repository === admission.modelId &&
      entry.browserAdmission &&
      entry.browserAdmission.bytes === admissionBytes.byteLength &&
      entry.browserAdmission.sha256 === authority.admissionSha256 &&
      entry.qualification &&
      entry.qualification.receiptId === admission.qualification.receiptId &&
      entry.qualification.receiptBytes === receiptBytes.byteLength &&
      entry.qualification.receiptSha256 === authority.qualificationReceiptSha256 &&
      Array.isArray(manifestMembers) && manifestMembers.length === admission.artifacts.length &&
      Array.isArray(catalogMembers) && catalogMembers.length === admission.artifacts.length &&
      admission.artifacts.every((artifact, index) => {
        const manifestMember = manifestMembers[index];
        const catalogMember = catalogMembers[index];
        return manifestMember && catalogMember &&
          artifact.fileName === manifestMember.fileName &&
          artifact.fileName === catalogMember.name &&
          artifact.byteCount === manifestMember.byteLength &&
          artifact.byteCount === catalogMember.bytes &&
          artifact.sha256 === manifestMember.sha256 &&
          `sha256:${artifact.sha256}` === catalogMember.sha256;
      });
    if (!identitiesMatch) {
      throw catalogQualificationError(
        "model-cache-current-catalog-binding",
        "The cached model evidence does not exactly match the current verified model list"
      );
    }
    requireCurrentCatalogAdmission(entry, admission);
    return admission;
  }

  function requireCurrentBrowserComposition(model) {
    const source = model && model.browserComposition;
    const admission = source && source.admission;
    if (!source || !admission) {
      throw catalogQualificationError(
        "model-composition-not-current",
        "The active browser composition is unavailable"
      );
    }
    if (source.storedComposition) {
      return requireCurrentStoredComposition(source.storedComposition);
    }
    const entry = currentCatalogEntryForAdmission(admission);
    if (!entry) {
      throw catalogQualificationError(
        "model-catalog-delisted",
        "The active model is not present in the current verified model list"
      );
    }
    requireCurrentCatalogAdmission(entry, admission);
    return admission;
  }

  // Restores only verified metadata authority before network refresh; it never activates bytes.
  function restoreStoredCatalogAuthority(storedComposition) {
    const authority = storedComposition && storedComposition.admissionAuthority;
    if (!authority || !authority.catalogDocument || !authority.catalogAuthority ||
        typeof authority.catalogText !== "string" ||
        typeof authority.admissionText !== "string") {
      return false;
    }
    state.modelCatalogV1Document = authority.catalogDocument;
    state.modelCatalogV1Text = authority.catalogText;
    state.modelCatalogV1PeerDocument = null;
    state.modelCatalogV1Authority = Object.freeze({
      catalog: authority.catalogAuthority,
      peerFeed: null
    });
    state.modelCatalogV1Entries = [];
    try {
      const admission = browserModelAdmissionApi.parseAdmissionText(authority.admissionText);
      const disposition = miniModelCatalogV1Api.qualificationDisposition(
        authority.catalogDocument,
        admission
      );
      if (disposition.status === "current" && disposition.entry) {
        state.modelCatalogV1Entries = [disposition.entry];
      }
    } catch (_error) {
      // The stale authority still prevents rollback, but it cannot authorize offline activation.
    }
    return true;
  }

  function acceptedCatalogIsCurrent() {
    if (!state.modelCatalogV1Document || !state.modelCatalogV1Authority) return false;
    try {
      const catalog = miniModelCatalogV1Api.validateCatalog(state.modelCatalogV1Document);
      const authority = state.modelCatalogV1Authority.catalog;
      return Boolean(authority && authority.id === catalog.catalog_id &&
        authority.revision === catalog.revision &&
        authority.generatedAtUtc === catalog.generated_at_utc &&
        authority.validUntilUtc === catalog.valid_until_utc);
    } catch (_error) {
      return false;
    }
  }

  function acceptedPeerFeedIsCurrent() {
    const authority = state.modelCatalogV1Authority && state.modelCatalogV1Authority.peerFeed;
    if (!authority || !state.modelCatalogV1PeerDocument || !acceptedCatalogIsCurrent()) {
      return false;
    }
    try {
      const peerFeed = miniModelCatalogV1Api.validatePeerFeed(
        state.modelCatalogV1PeerDocument,
        state.modelCatalogV1Document
      );
      return authority.id === peerFeed.feed_id && authority.revision === peerFeed.revision &&
        authority.generatedAtUtc === peerFeed.generated_at_utc &&
        authority.validUntilUtc === peerFeed.valid_until_utc;
    } catch (_error) {
      return false;
    }
  }

  function removeExpiredPeerRoutes(entries) {
    return entries.map((entry) => Object.freeze({
      ...entry,
      availability: "local-conversion",
      availabilityLabel: "Local conversion",
      peerCount: 0,
      peers: Object.freeze([])
    }));
  }

  function retainAcceptedCatalogAfterRefreshFailure(message) {
    if (!acceptedCatalogIsCurrent()) return false;
    if (!acceptedPeerFeedIsCurrent()) {
      state.modelCatalogV1Entries = removeExpiredPeerRoutes(state.modelCatalogV1Entries);
      state.modelCatalogV1PeerDocument = null;
      state.modelCatalogV1Authority = Object.freeze({
        catalog: state.modelCatalogV1Authority.catalog,
        peerFeed: null
      });
    }
    state.modelCatalogV1Loaded = true;
    state.modelCatalogV1LoadState = state.modelCatalogV1Entries.length ? "available" : "empty";
    state.modelCatalogV1PeerLoadState = acceptedPeerFeedIsCurrent()
      ? (state.modelCatalogV1Entries.some((entry) => entry.peers.length) ? "available" : "empty")
      : "unavailable";
    scheduleSimpleModelPeerExpiry(state.modelCatalogV1PeerDocument);
    reconcileSimpleModelSelection();
    setSimpleModelPickerStatus(
      `${message} Using the last verified model list until its stated expiry.`,
      true
    );
    return true;
  }

  function clearExpiredCatalogAuthority() {
    clearSimpleModelPeerExpiryTimer();
    state.modelCatalogV1Entries = [];
    state.modelCatalogV1Document = null;
    state.modelCatalogV1Text = "";
    state.modelCatalogV1PeerDocument = null;
    state.modelCatalogV1Authority = null;
    state.selectedModelCatalogV1Entry = null;
    clearPendingCompanionAcquisition();
    clearSimpleModelConversionRecovery();
    if (state.modelLoaded || state.localModel) discardRejectedStoredActivation();
  }

  function modelStoreAdmissionAuthority(admissionRecord, p2pPieceSetSha256 = null) {
    const catalogAuthority = state.modelCatalogV1Authority &&
      state.modelCatalogV1Authority.catalog;
    if (!admissionRecord || typeof admissionRecord.admissionText !== "string" ||
        typeof admissionRecord.qualificationReceiptText !== "string" ||
        !state.modelCatalogV1Text || !catalogAuthority) {
      throw catalogQualificationError(
        "model-cache-custody-incomplete",
        "Complete admission, qualification receipt, and catalog custody is required"
      );
    }
    return Object.freeze({
      admissionText: admissionRecord.admissionText,
      qualificationReceiptText: admissionRecord.qualificationReceiptText,
      catalogText: state.modelCatalogV1Text,
      catalogAuthority,
      p2pPieceSetSha256
    });
  }

  function modelStoreManifest(admissionRecord, p2pPieceSetSha256 = null) {
    const admission = admissionRecord.admission;
    const rawAdmissionSha256 = companionSha256(
      admissionRecord.admissionSha256,
      "Browser admission"
    );
    const rawReceiptSha256 = companionSha256(
      admissionRecord.qualificationReceiptSha256,
      "Qualification receipt"
    );
    const rawCatalogSha256 = companionSha256(
      state.modelCatalogV1Authority && state.modelCatalogV1Authority.catalog &&
        state.modelCatalogV1Authority.catalog.sha256,
      "Catalog"
    );
    const admissionBytes = state.encoder.encode(admissionRecord.admissionText);
    const receiptBytes = state.encoder.encode(admissionRecord.qualificationReceiptText);
    const catalogBytes = state.encoder.encode(state.modelCatalogV1Text);
    return Object.freeze({
      schema: modelCompositionStoreApi.manifestSchema,
      admissionAuthority: Object.freeze({
        admission: Object.freeze({
          byteLength: admissionBytes.byteLength,
          sha256: rawAdmissionSha256
        }),
        qualificationReceipt: Object.freeze({
          byteLength: receiptBytes.byteLength,
          sha256: rawReceiptSha256
        }),
        catalog: Object.freeze({
          byteLength: catalogBytes.byteLength,
          sha256: rawCatalogSha256
        }),
        p2pPieceSetSha256
      }),
      members: Object.freeze(admission.artifacts.map((artifact) => Object.freeze({
        fileName: artifact.fileName,
        byteLength: artifact.byteCount,
        sha256: artifact.sha256
      })))
    });
  }

  function browserModelFromStoredComposition(storedComposition) {
    const admissionAuthority = storedComposition && storedComposition.admissionAuthority;
    if (!storedComposition || !admissionAuthority ||
        typeof admissionAuthority.admissionText !== "string" ||
        typeof storedComposition.withRead !== "function") {
      throw new Error("The cached composition record is incomplete");
    }
    const admission = browserModelAdmissionApi.parseAdmissionText(
      admissionAuthority.admissionText
    );
    assertAdmissionRuntime(admission);
    const modelArtifact = admission.artifacts[0];
    return Object.freeze({
      label: `${admission.modelId} (browser cached)`,
      modelBytes: modelArtifact.byteCount,
      contextLength: admission.runtime.policy.maximumSequenceTokens,
      maxTokens: admission.runtime.defaultSampling.maximumNewTokens,
      requiredDownloadConsent: false,
      browserComposition: Object.freeze({
        admission,
        admissionSha256: admissionAuthority.admissionSha256,
        storedComposition
      })
    });
  }

  function registerStoredComposition(storedComposition) {
    const model = browserModelFromStoredComposition(storedComposition);
    state.localModel = model;
    paths.models = Object.create(null);
    paths.models[localModelKey] = model;
    renderModelOptions(paths.models, false, localModelKey);
    return model;
  }

  function acquisitionAbortError(message) {
    const error = new Error(message || "Model acquisition was cancelled");
    error.name = "AbortError";
    return error;
  }

  function throwIfAcquisitionAborted(signal, message) {
    if (signal && signal.aborted) {
      throw acquisitionAbortError(message);
    }
  }

  function createStoredCompositionActivationToken(storedComposition) {
    state.modelActivationTokenSequence += 1;
    return Object.seal({
      sequence: state.modelActivationTokenSequence,
      activationId: storedComposition.activationId,
      manifestSha256: storedComposition.manifestSha256,
      admissionAuthoritySha256: storedComposition.admissionAuthoritySha256,
      loadId: null
    });
  }

  function ownsStoredCompositionActivation(token) {
    return Boolean(token) && state.modelActivationCommitPending === token;
  }

  function requireStoredCompositionActivationOwner(storedComposition, token) {
    if (!ownsStoredCompositionActivation(token) ||
        token.activationId !== storedComposition.activationId ||
        token.manifestSha256 !== storedComposition.manifestSha256 ||
        token.admissionAuthoritySha256 !== storedComposition.admissionAuthoritySha256) {
      throw catalogQualificationError(
        "model-cache-activation-owner-mismatch",
        "A newer model activation superseded this browser cache operation"
      );
    }
    return token;
  }

  function clearStoredCompositionActivation(token) {
    if (!ownsStoredCompositionActivation(token)) return false;
    state.modelActivationCommitPending = false;
    return true;
  }

  // Reserve activation ownership before preparing runtime bytes or registering stored members.
  async function activateStoredComposition(
    storedComposition,
    readyText,
    signal,
    deferCommit,
    suppliedToken
  ) {
    throwIfAcquisitionAborted(signal);
    const activationToken = suppliedToken ||
      createStoredCompositionActivationToken(storedComposition);
    if (activationToken.activationId !== storedComposition.activationId ||
        activationToken.manifestSha256 !== storedComposition.manifestSha256 ||
        activationToken.admissionAuthoritySha256 !==
          storedComposition.admissionAuthoritySha256) {
      throw catalogQualificationError(
        "model-cache-activation-token-mismatch",
        "The browser cache activation token does not match its composition"
      );
    }
    state.modelActivationCommitPending = activationToken;
    try {
      await ensureBrowserRuntimeAsset(signal);
      throwIfAcquisitionAborted(signal);
      requireStoredCompositionActivationOwner(storedComposition, activationToken);
      requireCurrentStoredComposition(storedComposition);
      const model = registerStoredComposition(storedComposition);
      const admission = model.browserComposition.admission;
      setLocalModelStatus(
        `${admission.modelId} / saved in this browser / admission ` +
          `${storedComposition.admissionAuthority.admissionSha256}`,
        false
      );
      const loaded = await loadSelectedModelWithConsent(signal, activationToken);
      throwIfAcquisitionAborted(signal);
      requireStoredCompositionActivationOwner(storedComposition, activationToken);
      if (!loaded.loaded) {
        throw new Error(loaded.error || "The cached composition did not activate");
      }
      requireCurrentStoredComposition(storedComposition);
      if (deferCommit === true) return true;
      completeStoredCompositionActivation(storedComposition, readyText, activationToken);
      return true;
    } catch (error) {
      if (deferCommit !== true) clearStoredCompositionActivation(activationToken);
      throw error;
    }
  }

  function selectedCompositionMatchesStored(storedComposition) {
    const selectedModel = paths.models[state.activeModelKey] || null;
    const activeStoredComposition = selectedModel && selectedModel.browserComposition &&
      selectedModel.browserComposition.storedComposition;
    return Boolean(activeStoredComposition &&
      activeStoredComposition.activationId === storedComposition.activationId &&
      activeStoredComposition.manifestSha256 === storedComposition.manifestSha256 &&
      activeStoredComposition.admissionAuthoritySha256 ===
        storedComposition.admissionAuthoritySha256);
  }

  function authorizeStoredCompositionCommit(storedComposition, activationToken) {
    requireStoredCompositionActivationOwner(storedComposition, activationToken);
    requireCurrentStoredComposition(storedComposition);
    if (!selectedCompositionMatchesStored(storedComposition) ||
        !selectorCompositionRuntimeIdentityMatches()) {
      throw catalogQualificationError(
        "model-cache-activation-runtime-mismatch",
        "The candidate browser cache does not match the activated worker"
      );
    }
    return true;
  }

  function completeStoredCompositionActivation(storedComposition, readyText, activationToken) {
    const admission = requireCurrentStoredComposition(storedComposition);
    requireStoredCompositionActivationOwner(storedComposition, activationToken);
    if (!selectedCompositionMatchesStored(storedComposition)) {
      throw catalogQualificationError(
        "model-cache-activation-commit-mismatch",
        "The activated worker does not match the committed browser cache"
      );
    }
    if (!selectorCompositionRuntimeIdentityMatches()) {
      throw catalogQualificationError(
        "model-cache-activation-runtime-mismatch",
        "The committed browser cache does not match the activated worker"
      );
    }
    clearStoredCompositionActivation(activationToken);
    state.modelLoaded = true;
    setText(el.runtimeStatus, "Ready", false);
    setText(el.modelState, `worker active (${state.modelLoadMs} ms)`, false);
    setText(el.errorState, "none", false);
    renderProvenance("qualified six-member composition", state.modelManifest, false);
    setLocalModelStatus(`${admission.modelId} activated in the isolated worker`, false);
    setControls(true, true);
    reconcileSimpleModelSelection();
    renderSimpleModelPicker();
    setSimpleModelPickerStatus(readyText || `${admission.modelId} is ready.`, false);
  }

  function discardRejectedStoredActivation(expectedToken) {
    if (expectedToken && !ownsStoredCompositionActivation(expectedToken)) return false;
    const controller = state.modelActivationAbort;
    state.modelActivationAbort = null;
    state.modelLoadSequence += 1;
    if (controller) controller.abort();
    const client = state.runtimeClient;
    if (client && client.status !== "terminated") {
      client.terminate("model-runtime-client-uncommitted-composition");
    }
    state.runtimeClient = null;
    state.runtimeState = null;
    state.modelLoaded = false;
    if (expectedToken) {
      clearStoredCompositionActivation(expectedToken);
    } else {
      state.modelActivationCommitPending = false;
    }
    state.activeComposition = null;
    state.activeModelKey = "";
    state.modelManifest = null;
    state.hasContext = false;
    state.localModel = null;
    delete paths.models[localModelKey];
    document.documentElement.dataset.activeModel = "";
    clearBrowserAdmissionDiagnostics();
    renderModelOptions(paths.models, false);
    setControls(false, Object.keys(paths.models).length > 0);
    return true;
  }

  async function restoreStoredCompositionAfterFailure(previousComposition, failedToken) {
    if (failedToken && !ownsStoredCompositionActivation(failedToken)) return false;
    let restorationToken = null;
    try {
      if (previousComposition) {
        // Restoration reopens prior immutable bytes and never repeats acquisition.
        restorationToken = createStoredCompositionActivationToken(previousComposition);
        await activateStoredComposition(
          previousComposition,
          "Your saved model is verified and ready.",
          null,
          false,
          restorationToken
        );
      } else {
        discardRejectedStoredActivation(failedToken);
      }
      return true;
    } catch (restoreError) {
      appendConsole(`prior composition restore failed: ${errorMessage(restoreError)}`);
      discardRejectedStoredActivation(restorationToken || failedToken);
      return false;
    }
  }

  function workerActivationStoreAdapter(store, readyText, signal, admissionAuthority) {
    return Object.freeze({
      async install(value) {
        let activationStarted = false;
        let activationToken = null;
        let candidateManifestSha256 = "";
        let previousComposition = null;
        let installed;
        try {
          if (!value.admissionAuthority ||
              JSON.stringify(value.admissionAuthority) !== JSON.stringify(admissionAuthority)) {
            throw catalogQualificationError(
              "model-cache-custody-mismatch",
              "The installer authority does not match the verified catalog custody"
            );
          }
          installed = await store.install({
            manifest: value.manifest,
            admissionAuthority: value.admissionAuthority,
            sources: value.sources,
            signal: value.signal || signal,
            activate: async (candidate, context) => {
              activationStarted = true;
              candidateManifestSha256 = candidate && candidate.manifestSha256 || "";
              previousComposition = context.previousComposition;
              activationToken = createStoredCompositionActivationToken(candidate);
              return activateStoredComposition(
                candidate,
                readyText,
                context.signal || signal,
                true,
                activationToken
              );
            },
            authorizeCommit: async (candidate) => {
              if (!activationToken) {
                throw catalogQualificationError(
                  "model-cache-activation-token-missing",
                  "The cache commit has no matching worker activation"
                );
              }
              return authorizeStoredCompositionCommit(candidate, activationToken);
            }
          });
        } catch (error) {
          if (activationStarted && activationToken &&
              ownsStoredCompositionActivation(activationToken)) {
            const previousManifestSha256 = previousComposition &&
              previousComposition.manifestSha256 || "";
            if (error && error.commitDisposition === "indeterminate") {
              // Durable state cannot be inferred after a failed pointer readback.
              // Stay noninteractive until explicit cache reconciliation.
              discardRejectedStoredActivation(activationToken);
            } else if (candidateManifestSha256 &&
                candidateManifestSha256 === previousManifestSha256) {
              discardRejectedStoredActivation(activationToken);
            } else {
              await restoreStoredCompositionAfterFailure(
                previousComposition,
                activationToken
              );
            }
          }
          throw error;
        }
        if (activationStarted) {
          try {
            completeStoredCompositionActivation(installed, readyText, activationToken);
          } catch (error) {
            // The active pointer is already committed. Never pretend this is a
            // failed cache transaction or reopen a superseded composition.
            discardRejectedStoredActivation(activationToken);
            throw error;
          }
        }
        return installed;
      }
    });
  }

  // Marks a card active only when its graph identity matches the loaded composition.
  function simpleModelEntryIsActive(entry) {
    return Boolean(
      entry && entry.composition && state.modelLoaded && state.activeComposition &&
      entry.composition.compositionId ===
        `sha256:${state.activeComposition.graphIdentitySha256}`
    );
  }

  // Derives an offline chooser row only from the verified composition active in this worker.
  function verifiedInstalledSimpleModelEntry() {
    const model = state.localModel;
    const browserComposition = model && model.browserComposition;
    const admission = browserComposition && browserComposition.admission;
    const storedComposition = browserComposition && browserComposition.storedComposition;
    const active = state.activeComposition;
    if (!state.modelLoaded || !admission || !admission.composition ||
        !storedComposition || !active ||
        browserComposition.admissionSha256 !==
          storedComposition.admissionAuthority.admissionSha256 ||
        active.graphIdentitySha256 !== admission.composition.graphIdentitySha256 ||
        active.memberTableSha256 !== admission.composition.memberTableSha256 ||
        !Array.isArray(admission.artifacts) || admission.artifacts.length !== 6) {
      return null;
    }
    const compositionId = `sha256:${active.graphIdentitySha256}`;
    return Object.freeze({
      entryId: compositionId,
      displayName: admission.modelId,
      description: "",
      source: null,
      composition: Object.freeze({
        compositionId,
        memberCount: admission.artifacts.length,
        members: Object.freeze(admission.artifacts.map((artifact) => Object.freeze({
          name: artifact.fileName,
          bytes: artifact.byteCount,
          sha256: `sha256:${artifact.sha256}`,
          schema: artifact.format
        })))
      }),
      browserAdmission: null,
      availability: "installed",
      peers: Object.freeze([])
    });
  }

  // Prepends the verified installed identity and removes only its exact catalog duplicate.
  function simpleModelEntries() {
    const installed = verifiedInstalledSimpleModelEntry();
    if (!installed) {
      return state.modelCatalogV1Entries;
    }
    return [installed, ...state.modelCatalogV1Entries.filter((entry) => (
      entry.composition.compositionId !== installed.composition.compositionId
    ))];
  }

  function simpleModelEntrySupportsLocalConversion(entry) {
    const source = companionCapabilityApi && companionCapabilityApi.SOURCE_DESCRIPTOR;
    return Boolean(
      source && entry && entry.source &&
      entry.source.repository === source.sourceRepository &&
      entry.source.revision === source.sourceRevision
    );
  }

  function simpleModelEntryHasConversionRecovery(entry) {
    const recovery = state.simpleModelConversionRecovery;
    return Boolean(
      recovery && recovery.entry === entry &&
      recovery.compositionId === entry.composition.compositionId &&
      simpleModelEntrySupportsLocalConversion(entry)
    );
  }

  const p2pConversionRecoveryCodes = new Set([
    "p2p-composition-install-fetch",
    "p2p-composition-install-timeout",
    "p2p-composition-install-response-status",
    "p2p-composition-install-response-metadata",
    "p2p-composition-install-response-body",
    "p2p-composition-install-response-overflow",
    "p2p-composition-install-response-truncated",
    "model-composition-store-source-length",
    "model-composition-store-source-read",
    "model-composition-store-source-sha256"
  ]);

  function p2pFailureAllowsLocalConversion(error) {
    const seen = new Set();
    let candidate = error;
    for (let depth = 0; depth < 8 && candidate && typeof candidate === "object"; depth += 1) {
      if (p2pConversionRecoveryCodes.has(catalogText(candidate.code))) return true;
      if (seen.has(candidate)) break;
      seen.add(candidate);
      candidate = candidate.cause;
    }
    return false;
  }

  // Binds recovery only to the exact entry after an attributable peer transport/content failure.
  function rememberSimpleModelConversionRecovery(entry, error) {
    const code = catalogText(error && error.code);
    const currentEntry = state.modelCatalogV1Entries.find((candidate) => candidate === entry);
    if (!code || !p2pFailureAllowsLocalConversion(error) || !currentEntry ||
        !state.companion || !state.companion.client ||
        !simpleModelEntrySupportsLocalConversion(entry)) {
      state.simpleModelConversionRecovery = null;
      return false;
    }
    state.simpleModelConversionRecovery = Object.freeze({
      entry,
      compositionId: entry.composition.compositionId,
      errorCode: code
    });
    return true;
  }

  function clearSimpleModelConversionRecovery() {
    state.simpleModelConversionRecovery = null;
  }

  function clearSimpleModelPeerExpiryTimer() {
    if (state.modelCatalogV1PeerExpiryTimer !== null) {
      window.clearTimeout(state.modelCatalogV1PeerExpiryTimer);
      state.modelCatalogV1PeerExpiryTimer = null;
    }
  }

  function scheduleSimpleModelPeerExpiry(peerDocument) {
    clearSimpleModelPeerExpiryTimer();
    if (!peerDocument || !Array.isArray(peerDocument.announcements) ||
        peerDocument.announcements.length === 0) {
      return;
    }
    const validUntilUtc = peerDocument && peerDocument.valid_until_utc;
    const deadline = Date.parse(validUntilUtc);
    if (!Number.isFinite(deadline)) return;
    const expire = () => {
      state.modelCatalogV1PeerExpiryTimer = null;
      const remaining = deadline - Date.now();
      if (remaining > 0) {
        state.modelCatalogV1PeerExpiryTimer = window.setTimeout(
          expire,
          Math.min(remaining + 1, 2147483647)
        );
        return;
      }
      if (!state.modelCatalogV1PeerDocument ||
          state.modelCatalogV1PeerDocument.valid_until_utc !== validUntilUtc) {
        return;
      }
      state.modelCatalogV1PeerLoadState = "expired";
      clearSimpleModelConversionRecovery();
      reconcileSimpleModelSelection();
      setSimpleModelPickerStatus(
        "Signed P2P listings expired. Refresh the model list before trying a peer; supported on-device preparation remains available.",
        true
      );
      renderSimpleModelPicker();
    };
    const remaining = deadline - Date.now();
    state.modelCatalogV1PeerExpiryTimer = window.setTimeout(
      expire,
      Math.min(Math.max(remaining + 1, 0), 2147483647)
    );
  }

  // Projects generic catalog syntax onto the routes this exact app release can execute.
  function simpleModelRouteProjection(entry) {
    let kind = simpleModelRouteKinds.UNSUPPORTED_SOURCE;
    const conversionRecovery = simpleModelEntryHasConversionRecovery(entry);
    if (simpleModelEntryIsActive(entry)) {
      kind = simpleModelRouteKinds.INSTALLED;
    } else if (conversionRecovery) {
      kind = simpleModelRouteKinds.SUPPORTED_LOCAL_CONVERSION;
    } else if (canStartP2pImport(entry)) {
      kind = simpleModelRouteKinds.QUALIFIED_P2P;
    } else if (simpleModelEntrySupportsLocalConversion(entry)) {
      kind = simpleModelRouteKinds.SUPPORTED_LOCAL_CONVERSION;
    }
    return Object.freeze({
      kind,
      entry,
      conversionRecovery,
      actionable: kind !== simpleModelRouteKinds.UNSUPPORTED_SOURCE
    });
  }

  function simpleModelRouteViews() {
    return simpleModelEntries()
      .map((entry, index) => ({ ...simpleModelRouteProjection(entry), index }))
      .sort((left, right) => (
        simpleModelRouteRanks[left.kind] - simpleModelRouteRanks[right.kind] ||
        left.index - right.index
      ));
  }

  function chooseDefaultSimpleModelRoute(routes, storedCompositionId) {
    const stored = routes.find((route) => (
      route.entry.composition.compositionId === storedCompositionId
    ));
    return routes.find((route) => route.kind === simpleModelRouteKinds.INSTALLED) ||
      (stored && stored.kind === simpleModelRouteKinds.QUALIFIED_P2P ? stored : null) ||
      routes.find((route) => route.kind === simpleModelRouteKinds.QUALIFIED_P2P) ||
      (stored && stored.kind === simpleModelRouteKinds.SUPPORTED_LOCAL_CONVERSION
        ? stored
        : null) ||
      routes.find((route) => (
        route.kind === simpleModelRouteKinds.SUPPORTED_LOCAL_CONVERSION
      )) || null;
  }

  // Auto-download only a small verified composition served by our bootstrap seed.
  function chooseBootstrapModelRoute(routes) {
    return routes.filter((route) => {
      const entry = route.entry;
      const members = entry.composition && entry.composition.members;
      const bytes = Array.isArray(members)
        ? members.reduce((sum, member) => sum + member.bytes, 0) : NaN;
      return route.kind === simpleModelRouteKinds.QUALIFIED_P2P &&
        entry.peers?.[0]?.peerBaseUrl === "https://minimodel.org/" &&
        Number.isSafeInteger(bytes) && bytes > 0 && bytes <= 768 * 1024 * 1024;
    }).sort((left, right) => (
      left.entry.composition.members.reduce((sum, member) => sum + member.bytes, 0) -
      right.entry.composition.members.reduce((sum, member) => sum + member.bytes, 0)
    ))[0] || null;
  }

  // Resolves selection against current catalog rows plus the verified installed identity.
  function selectedSimpleModelEntry() {
    const selected = state.selectedModelCatalogV1Entry;
    return selected
      ? simpleModelEntries().find(
        (entry) => entry.composition.compositionId === selected.composition.compositionId
      ) || null
      : null;
  }

  // Persists only an actionable composition identity; routes are always re-derived.
  function selectSimpleModelEntry(entry) {
    if (!entry || !entry.composition || !entry.composition.compositionId ||
        !simpleModelRouteProjection(entry).actionable) {
      return false;
    }
    state.selectedModelCatalogV1Entry = entry;
    storageSet(
      uiStorageKeys.selectedModelCatalogV1Composition,
      entry.composition.compositionId
    );
    return true;
  }

  function reconcileSimpleModelSelection() {
    const route = chooseDefaultSimpleModelRoute(
      simpleModelRouteViews(),
      storageGet(uiStorageKeys.selectedModelCatalogV1Composition, "")
    );
    state.selectedModelCatalogV1Entry = route ? route.entry : null;
    if (route) {
      storageSet(
        uiStorageKeys.selectedModelCatalogV1Composition,
        route.entry.composition.compositionId
      );
    }
    return route ? route.entry : null;
  }

  function resolveCurrentSimpleModelRoute(requestedEntry) {
    const compositionId = requestedEntry && requestedEntry.composition &&
      requestedEntry.composition.compositionId;
    const currentEntry = compositionId
      ? simpleModelEntries().find((entry) => (
        entry.composition.compositionId === compositionId
      )) || null
      : null;
    return currentEntry ? simpleModelRouteProjection(currentEntry) : null;
  }

  function rememberPendingCompanionAcquisition(entry, kind) {
    const compositionId = entry && entry.composition && entry.composition.compositionId;
    if (!/^sha256:[0-9a-f]{64}$/u.test(compositionId || "")) {
      return false;
    }
    state.companion.pendingAcquisition = { compositionId, kind };
    sessionStorageSet(
      uiSessionStorageKeys.pendingModelAcquisitionComposition,
      compositionId
    );
    return true;
  }

  function clearPendingCompanionAcquisition() {
    state.companion.pendingAcquisition = null;
    sessionStorageRemove(uiSessionStorageKeys.pendingModelAcquisitionComposition);
  }

  // Restores selection and pairing UI only; an explicit Connect action is still required.
  function restorePendingCompanionAcquisition() {
    const compositionId = sessionStorageGet(
      uiSessionStorageKeys.pendingModelAcquisitionComposition,
      ""
    );
    if (!/^sha256:[0-9a-f]{64}$/u.test(compositionId)) {
      if (compositionId) {
        sessionStorageRemove(uiSessionStorageKeys.pendingModelAcquisitionComposition);
      }
      return null;
    }
    const currentEntry = state.modelCatalogV1Entries.find((entry) => (
      entry.composition.compositionId === compositionId
    ));
    const route = currentEntry ? simpleModelRouteProjection(currentEntry) : null;
    if (!route || route.kind !== simpleModelRouteKinds.SUPPORTED_LOCAL_CONVERSION) {
      clearPendingCompanionAcquisition();
      return null;
    }
    rememberPendingCompanionAcquisition(route.entry, "simple");
    selectSimpleModelEntry(route.entry);
    return route.entry;
  }

  // Collapses all browser and companion work markers into the chooser's single command gate.
  function simpleModelAcquisitionIsActive() {
    return Boolean(
      state.modelAcquisitionCommand ||
      state.activeAcquisitionAbort ||
      state.modelActivationAbort ||
      state.companion.streamAbort ||
      state.companion.operationRequest ||
      directSeedHasPendingRequest() ||
      state.companion.cancelPromise ||
      companionAcquisitionIsActive(state.companion.activeStatus)
    );
  }

  // Sequences post-render focus so an older render cannot override a newer destination.
  function scheduleSimpleModelPickerFocus({
    compositionId = "",
    cancel = false,
    refresh = false,
    pair = false
  } = {}) {
    const focusSequence = state.simpleModelPickerFocusSequence + 1;
    state.simpleModelPickerFocusSequence = focusSequence;
    window.requestAnimationFrame(() => {
      if (focusSequence !== state.simpleModelPickerFocusSequence ||
          !el.simpleDiscoveryPanel || el.simpleDiscoveryPanel.hidden) {
        return;
      }
      let target = null;
      if (pair && el.simpleCompanionPairButton && el.simpleCompanionPairing &&
          !el.simpleCompanionPairing.hidden) {
        target = el.simpleCompanionPairButton;
      }
      if (!target && cancel && el.simpleModelActionButton &&
          !el.simpleModelActionButton.hidden) {
        target = el.simpleModelActionButton;
      }
      if (!target && compositionId && el.simpleModelList) {
        target = Array.from(el.simpleModelList.querySelectorAll("[data-composition-id]"))
          .find((candidate) => candidate.dataset.compositionId === compositionId) || null;
      }
      if (!target && refresh && el.simpleModelRefreshButton &&
          !el.simpleModelRefreshButton.disabled) {
        target = el.simpleModelRefreshButton;
      }
      if (target && !target.disabled && !target.hidden && !target.closest("[hidden]") &&
          typeof target.focus === "function") {
        target.focus();
      }
    });
  }

  // Gives a newly exposed pairing field priority over any queued card focus request.
  function scheduleSimpleCompanionPairingFocus() {
    const focusSequence = state.simpleModelPickerFocusSequence + 1;
    state.simpleModelPickerFocusSequence = focusSequence;
    window.requestAnimationFrame(() => {
      if (focusSequence !== state.simpleModelPickerFocusSequence ||
          !el.simpleDiscoveryPanel || el.simpleDiscoveryPanel.hidden ||
          !el.simpleCompanionPairing || el.simpleCompanionPairing.hidden ||
          !el.simpleCompanionPairingCode) {
        return;
      }
      el.simpleCompanionPairingCode.focus();
    });
  }

  function moveSimpleModelActionFocusBeforeHide(selected) {
    if (!el.simpleDiscoveryPanel || el.simpleDiscoveryPanel.hidden ||
        !el.simpleModelActionButton ||
        document.activeElement !== el.simpleModelActionButton) {
      return false;
    }
    const compositionId = selected && selected.composition
      ? selected.composition.compositionId
      : "";
    const commands = el.simpleModelList
      ? Array.from(el.simpleModelList.querySelectorAll("[data-composition-id]"))
        .filter((candidate) => !candidate.disabled)
      : [];
    const target = commands.find((candidate) => (
      candidate.dataset.compositionId === compositionId
    )) || commands[0] ||
      (el.simpleModelRefreshButton && !el.simpleModelRefreshButton.disabled
        ? el.simpleModelRefreshButton
        : null) ||
      el.simpleModelCloseButton || el.simpleOpenAdvancedDiscoveryButton ||
      el.simpleDiscoveryPanel;
    if (target && typeof target.focus === "function") {
      target.focus();
      return true;
    }
    return false;
  }

  function simpleModelCancellationView() {
    const stopsOptionalSharing = state.modelAcquisitionRoute === "companion" &&
      state.companion && state.companion.browserInstallState === "installed";
    return stopsOptionalSharing
      ? Object.freeze({ text: "Stop sharing", ariaLabel: "Stop optional local model sharing" })
      : Object.freeze({ text: "Cancel", ariaLabel: "Cancel model acquisition" });
  }

  // Rebuilds one-click commands from admitted state and exposes Cancel only for active work.
  function renderSimpleModelPicker(options = {}) {
    if (!el.simpleModelList || !el.simpleModelActionButton) {
      return;
    }
    const activeElement = document.activeElement;
    const focusedModelCommand = activeElement && typeof activeElement.closest === "function"
      ? activeElement.closest("[data-composition-id]")
      : null;
    const focusedCompositionId = focusedModelCommand
      ? focusedModelCommand.dataset.compositionId
      : "";
    const routes = simpleModelRouteViews().filter((route) => (
      el.appShell?.dataset.mode === "advanced" ||
      route.kind === simpleModelRouteKinds.INSTALLED ||
      route.kind === simpleModelRouteKinds.QUALIFIED_P2P
    ));
    const entries = routes.map((route) => route.entry);
    let selected = selectedSimpleModelEntry();
    if ((!selected || !simpleModelRouteProjection(selected).actionable) && entries.length) {
      selected = reconcileSimpleModelSelection();
    }

    const acquisitionActive = simpleModelAcquisitionIsActive();
    const cancellationView = simpleModelCancellationView();
    el.simpleModelList.setAttribute(
      "aria-busy",
      String(Boolean(state.modelCatalogV1Loading || acquisitionActive))
    );
    if (el.simpleModelRefreshButton) {
      el.simpleModelRefreshButton.disabled = state.modelCatalogV1Loading || acquisitionActive;
    }
    el.simpleModelList.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "simple-model-empty";
      empty.textContent = state.modelCatalogV1Loading
        ? "Checking model list..."
        : state.modelCatalogV1LoadState === "unavailable"
          ? "The model list is unavailable right now. Check your connection and refresh."
          : state.modelCatalogV1LoadState === "invalid"
            ? "The model list could not be verified, so no models were loaded."
          : state.modelCatalogV1LoadState === "empty"
            ? "No models are listed yet."
            : "No models are listed yet.";
      el.simpleModelList.append(empty);
      if (!acquisitionActive) {
        moveSimpleModelActionFocusBeforeHide(selected);
      }
      el.simpleModelActionButton.disabled = !acquisitionActive;
      el.simpleModelActionButton.hidden = !acquisitionActive;
      el.simpleModelActionButton.textContent = cancellationView.text;
      el.simpleModelActionButton.setAttribute("aria-label", cancellationView.ariaLabel);
      if (acquisitionActive && options.focusCancel === true) {
        scheduleSimpleModelPickerFocus({ cancel: true });
      } else if (focusedCompositionId && el.simpleModelRefreshButton) {
        window.requestAnimationFrame(() => {
          if (el.simpleDiscoveryPanel && !el.simpleDiscoveryPanel.hidden) {
            el.simpleModelRefreshButton.focus();
          }
        });
      }
      return;
    }

    for (const route of routes) {
      const entry = route.entry;
      const isDefault = Boolean(selected &&
        selected.composition.compositionId === entry.composition.compositionId);
      const isActive = route.kind === simpleModelRouteKinds.INSTALLED;
      const isPeer = route.kind === simpleModelRouteKinds.QUALIFIED_P2P;
      const isLocalConversion =
        route.kind === simpleModelRouteKinds.SUPPORTED_LOCAL_CONVERSION;
      const option = document.createElement("button");
      option.type = "button";
      option.className = "simple-model-option";
      option.disabled = state.modelCatalogV1Loading || acquisitionActive || !route.actionable;
      option.dataset.compositionId = entry.composition.compositionId;
      option.dataset.default = String(isDefault);
      option.dataset.route = route.kind;
      option.dataset.recovery = String(route.conversionRecovery === true);

      const identity = document.createElement("span");
      identity.className = "simple-model-identity";
      const name = document.createElement("strong");
      name.textContent = entry.displayName;
      const details = document.createElement("small");
      const compositionBytes = simpleModelCompositionBytes(entry);
      details.textContent = compositionBytes > 0 ? formatByteCount(compositionBytes) : "";
      identity.append(name, details);

      const availability = document.createElement("span");
      availability.className = `simple-model-availability ${isActive || isPeer ? "peer" : route.kind}`;
      availability.textContent = isActive
        ? "Ready to use"
        : isPeer
          ? "P2P download"
          : route.conversionRecovery
            ? "P2P stopped - prepare on this device"
          : isLocalConversion
            ? "Prepare on this device"
            : "Not available yet";
      const commandDescription = document.createElement("span");
      commandDescription.className = "sr-only";
      const defaultDescription = isDefault ? " Default choice." : "";
      commandDescription.textContent = defaultDescription + (isActive
        ? " Select to open this installed model."
        : isPeer
          ? " Select to download from P2P and open this model."
          : route.conversionRecovery
            ? " The P2P attempt stopped. Select to explicitly prepare, verify, install, and activate this model on this device."
          : isLocalConversion
            ? " Select to convert, verify, install, and activate this model on this device."
            : " No signed P2P announcement for this qualified model or supported on-device conversion source is listed.");
      option.append(identity, availability, commandDescription);
      el.simpleModelList.append(option);
    }

    if (!acquisitionActive) {
      moveSimpleModelActionFocusBeforeHide(selected);
    }
    el.simpleModelActionButton.hidden = !acquisitionActive;
    el.simpleModelActionButton.disabled = !acquisitionActive;
    el.simpleModelActionButton.textContent = cancellationView.text;
    el.simpleModelActionButton.setAttribute("aria-label", cancellationView.ariaLabel);
    const focusCompositionId = options.focusCompositionId || focusedCompositionId;
    scheduleSimpleModelPickerFocus({
      compositionId: focusCompositionId,
      cancel: options.focusCancel === true
    });
  }

  // Loads the strict catalog pair while preserving empty, invalid, and unavailable outcomes.
  async function loadSimpleModelCatalog() {
    const refreshFocusStandIn = el.simpleDiscoveryPanel &&
      !el.simpleDiscoveryPanel.hidden &&
      el.simpleModelRefreshButton &&
      document.activeElement === el.simpleModelRefreshButton
      ? el.simpleModelCloseButton || el.simpleDiscoveryPanel
      : null;
    if (refreshFocusStandIn && typeof refreshFocusStandIn.focus === "function") {
      refreshFocusStandIn.focus();
    }
    if (state.modelCatalogV1FetchAbort) {
      state.modelCatalogV1FetchAbort.abort();
    }
    clearSimpleModelPeerExpiryTimer();
    const controller = new AbortController();
    state.modelCatalogV1FetchAbort = controller;
    state.modelCatalogV1Loading = true;
    clearSimpleModelConversionRecovery();
    state.modelCatalogV1LoadState = "loading";
    state.modelCatalogV1PeerLoadState = "loading";
    setSimpleModelPickerStatus("Checking model list...", false);
    renderSimpleModelPicker();
    try {
      const result = await miniModelCatalogV1Api.loadCurrentCatalog({
        signal: controller.signal,
        previousAuthority: state.modelCatalogV1Authority
      });
      if (state.modelCatalogV1FetchAbort !== controller) {
        return;
      }
      const validStatus = miniModelCatalogV1Api.SOURCE_STATUSES.VALID;
      const catalogValid = Boolean(result && result.catalog &&
        result.catalog.status === validStatus);
      if (!catalogValid) {
        const failureType = result && result.catalog && result.catalog.error
          ? result.catalog.error.type
          : "fetch";
        const unavailable = failureType === "fetch";
        if (retainAcceptedCatalogAfterRefreshFailure(
          unavailable
            ? "The model-list refresh is unavailable."
            : "A model-list refresh failed verification."
        )) {
          return;
        }
        clearExpiredCatalogAuthority();
        state.modelCatalogV1Loaded = true;
        state.modelCatalogV1LoadState = unavailable ? "unavailable" : "invalid";
        state.modelCatalogV1PeerLoadState = "unchecked";
        setSimpleModelPickerStatus(
          unavailable
            ? "Models are unavailable right now. A saved model will not open until its qualification can be reconciled."
            : "The model list could not be verified, so no model was opened.",
          true
        );
        return;
      }

      state.modelCatalogV1Document = result.catalog.document;
      state.modelCatalogV1Text = result.catalog.text;
      state.modelCatalogV1PeerDocument = result.peerFeed &&
        result.peerFeed.status === validStatus
        ? result.peerFeed.document
        : null;
      state.modelCatalogV1Authority = result.authority;
      state.modelCatalogV1Entries = [...result.views];
      state.modelCatalogV1Loaded = true;
      state.modelCatalogV1LoadState = result.views.length ? "available" : "empty";
      const peerFeedValid = Boolean(result.peerFeed && result.peerFeed.status === validStatus);
      const peerFailureType = result.peerFeed && result.peerFeed.error
        ? result.peerFeed.error.type
        : "fetch";
      state.modelCatalogV1PeerLoadState = peerFeedValid
        ? (result.peerFeed.document.announcements.length ? "available" : "empty")
        : (peerFailureType === "fetch" ? "unavailable" : "invalid");
      scheduleSimpleModelPeerExpiry(state.modelCatalogV1PeerDocument);
      let cachedQualificationError = null;
      if (state.localModel && state.localModel.browserComposition &&
          state.localModel.browserComposition.storedComposition) {
        try {
          requireCurrentStoredComposition(
            state.localModel.browserComposition.storedComposition
          );
        } catch (error) {
          cachedQualificationError = error;
          discardRejectedStoredActivation();
        }
      }
      const routes = simpleModelRouteViews();
      const peerCount = routes.filter((route) => (
        route.kind === simpleModelRouteKinds.QUALIFIED_P2P
      )).length;
      const localConversionCount = routes.filter((route) => (
        route.kind === simpleModelRouteKinds.SUPPORTED_LOCAL_CONVERSION
      )).length;
      const unsupportedCount = routes.filter((route) => (
        route.kind === simpleModelRouteKinds.UNSUPPORTED_SOURCE
      )).length;
      const restoredPendingEntry = restorePendingCompanionAcquisition();
      if (!restoredPendingEntry) {
        reconcileSimpleModelSelection();
      }
      const modelCountLabel = `${result.views.length} ${result.views.length === 1 ? "model" : "models"}`;
      const peerProblem = state.modelCatalogV1PeerLoadState === "invalid"
        ? "The signed P2P listing feed could not be verified."
        : "The signed P2P listing feed could not be checked.";
      setSimpleModelPickerStatus(
        cachedQualificationError
          ? "The saved model is no longer currently qualified and was not opened."
          : result.views.length
          ? peerFeedValid
            ? unsupportedCount === result.views.length
              ? result.views.length === 1
                ? "1 model found. It has no signed P2P listing and cannot be prepared on this device."
                : `${modelCountLabel} found. None have signed P2P listings or support preparation on this device.`
              : `${modelCountLabel} found. ${peerCount} listed for P2P download.`
            : `${modelCountLabel} found. ${peerProblem} ${localConversionCount
              ? `${localConversionCount} can be prepared on this device.`
              : "No model can be prepared on this device."}`
          : verifiedInstalledSimpleModelEntry()
            ? "Your saved model is ready."
            : "No models are listed yet.",
        Boolean(cachedQualificationError) || (!peerFeedValid && result.views.length > 0)
      );
      if (restoredPendingEntry && state.companion.client && !companionIsPaired()) {
        if (el.simpleCompanionPairing) {
          el.simpleCompanionPairing.hidden = false;
        }
        setSimpleModelPickerStatus(
          `Connect the desktop companion to continue with ${restoredPendingEntry.displayName}.`,
          false
        );
      }
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }
      if (state.modelCatalogV1FetchAbort !== controller) {
        return;
      }
      if (retainAcceptedCatalogAfterRefreshFailure(
        `The model-list refresh stopped: ${friendlyError(errorMessage(error))}.`
      )) {
        return;
      }
      clearExpiredCatalogAuthority();
      state.modelCatalogV1Loaded = true;
      state.modelCatalogV1LoadState = "unavailable";
      state.modelCatalogV1PeerLoadState = "unavailable";
      setSimpleModelPickerStatus(
        `The model list is unavailable right now: ${friendlyError(errorMessage(error))}. ` +
          "A saved model will not open until its qualification can be reconciled.",
        true
      );
    } finally {
      if (state.modelCatalogV1FetchAbort === controller) {
        const restoreRefreshFocus = Boolean(
          refreshFocusStandIn && el.simpleDiscoveryPanel &&
          !el.simpleDiscoveryPanel.hidden &&
          document.activeElement === refreshFocusStandIn
        );
        state.modelCatalogV1FetchAbort = null;
        state.modelCatalogV1Loading = false;
        renderSimpleModelPicker();
        if (state.hfLastAccepted && state.hfLastAccepted.length) {
          renderAcceptedHfResults(state.hfLastAccepted);
        }
        if (restoreRefreshFocus) {
          scheduleSimpleModelPickerFocus({ refresh: true });
        }
        maybePresentInitialModelChooser();
        if (state.companion.pendingAcquisition && state.companion.client &&
            !companionIsPaired()) {
          scheduleSimpleCompanionPairingFocus();
        }
      }
    }
  }

  // Owns one chooser command promise and keeps its fixed route and Cancel focus synchronized.
  async function beginModelAcquisition(entry, routeKind) {
    if (state.generation?.inFlight || state.turnAdmissionPending) {
      setSimpleModelPickerStatus("Stop the current answer before choosing another model.", false);
      return false;
    }
    const compositionId = catalogText(
      entry && entry.composition && entry.composition.compositionId
    );
    if (state.modelAcquisitionCommand) {
      if (compositionId && compositionId === state.modelAcquisitionCompositionId) {
        return state.modelAcquisitionCommand;
      }
      setSimpleModelPickerStatus(
        "Another model is already being prepared. Use Cancel before choosing a different model.",
        false
      );
      return false;
    }
    state.modelAcquisitionRoute = routeKind === simpleModelRouteKinds.QUALIFIED_P2P
      ? "p2p"
      : "companion";
    state.modelAcquisitionCompositionId = compositionId;
    const command = Promise.resolve(startCompanionAcquisition(entry, routeKind));
    state.modelAcquisitionCommand = command;
    renderSimpleModelPicker({ focusCancel: true });
    try {
      return await command;
    } finally {
      if (state.modelAcquisitionCommand === command) {
        state.modelAcquisitionCommand = null;
        state.modelAcquisitionRoute = "";
        state.modelAcquisitionCompositionId = "";
      }
      const acquisitionStillActive = simpleModelAcquisitionIsActive();
      renderSimpleModelPicker({
        focusCancel: acquisitionStillActive,
        focusCompositionId: entry && entry.composition
          ? entry.composition.compositionId
          : ""
      });
    }
  }

  // Dispatches exactly the selected route, pausing local conversion only for explicit pairing.
  async function requestSimpleModelAcquisition(requestedEntry) {
    if (state.generation?.inFlight || state.turnAdmissionPending) {
      setSimpleModelPickerStatus("Stop the current answer before choosing another model.", false);
      return false;
    }
    if (simpleModelAcquisitionIsActive()) {
      const requested = requestedEntry || selectedSimpleModelEntry();
      const requestedCompositionId = catalogText(
        requested && requested.composition && requested.composition.compositionId
      );
      if (state.modelAcquisitionCommand && requestedCompositionId &&
          requestedCompositionId === state.modelAcquisitionCompositionId) {
        return state.modelAcquisitionCommand;
      }
      setSimpleModelPickerStatus(
        "Another model is already being prepared. Use Cancel before choosing a different model.",
        false
      );
      return false;
    }
    if (state.modelCatalogV1Loading) {
      setSimpleModelPickerStatus("Wait for the model check to finish.", true);
      return false;
    }
    const requested = requestedEntry || selectedSimpleModelEntry();
    const route = resolveCurrentSimpleModelRoute(requested);
    if (!route) {
      setSimpleModelPickerStatus("No model is available to select.", true);
      return false;
    }
    const entry = route.entry;
    if (route.kind === simpleModelRouteKinds.INSTALLED) {
      clearPendingCompanionAcquisition();
      if (el.simpleCompanionPairing) {
        el.simpleCompanionPairing.hidden = true;
      }
      setSimpleModelPickerStatus(`${entry.displayName} is already ready.`, false);
      toggleModelPopover(false, null, true);
      return true;
    }
    try {
      requireCurrentCatalogEntry(entry);
    } catch (error) {
      setSimpleModelPickerStatus(errorMessage(error), true);
      return false;
    }
    if (route.kind === simpleModelRouteKinds.QUALIFIED_P2P) {
      clearSimpleModelConversionRecovery();
      clearPendingCompanionAcquisition();
      if (el.simpleCompanionPairing) {
        el.simpleCompanionPairing.hidden = true;
      }
      return beginModelAcquisition(entry, route.kind);
    }
    if (route.kind !== simpleModelRouteKinds.SUPPORTED_LOCAL_CONVERSION) {
      setSimpleModelPickerStatus(
        `${entry.displayName} is not available on P2P and cannot be prepared on this device.`,
        true
      );
      return false;
    }
    if (el.appShell?.dataset.mode !== "advanced") {
      setSimpleModelPickerStatus(
        "This download is unavailable. Refresh the model list, or open Advanced for other options.",
        true
      );
      return false;
    }
    if (!state.companion.client) {
      setSimpleModelPickerStatus(
        "This browser cannot connect to the TinyRustLM desktop companion.",
        true
      );
      return false;
    }
    if (!companionIsPaired()) {
      rememberPendingCompanionAcquisition(entry, "simple");
      if (el.simpleCompanionPairing) {
        el.simpleCompanionPairing.hidden = false;
      }
      setSimpleModelPickerStatus(
        `Connect the desktop companion once to get ${entry.displayName}.`,
        false
      );
      scheduleSimpleCompanionPairingFocus();
      return false;
    }
    clearPendingCompanionAcquisition();
    return beginModelAcquisition(entry, route.kind);
  }

  // Begins cancellation only from an explicit visible Cancel command.
  async function requestSimpleModelAcquisitionCancellation() {
    if (!simpleModelAcquisitionIsActive()) {
      return false;
    }
    const activeCommand = state.modelAcquisitionCommand;
    const cancelled = await cancelCompanionImport();
    const committed = activeCommand
      ? await Promise.resolve(activeCommand).catch(() => false)
      : false;
    const browserActivationCommitted = Boolean(
      state.companion && (
        state.companion.browserInstallState === "installed" ||
        catalogText(state.companion.activeStatus && state.companion.activeStatus.state) ===
          "installed"
      )
    );
    if (committed || browserActivationCommitted) {
      renderSimpleModelPicker();
      return true;
    }
    const cancellationState = catalogText(
      state.companion.activeStatus && state.companion.activeStatus.state
    );
    setSimpleModelPickerStatus(
      cancelled
        ? "Model acquisition cancelled."
        : cancellationState === "rejected"
          ? "The companion rejected the model acquisition before cancellation completed."
        : "Cancellation could not be confirmed; the companion operation may still be running.",
      !cancelled
    );
    renderSimpleModelPicker();
    return false;
  }

  // Resumes the sole pending acquisition only after the companion pairing succeeds.
  async function pairSimpleCompanionAndContinue() {
    const code = el.simpleCompanionPairingCode
      ? String(el.simpleCompanionPairingCode.value || "").trim()
      : "";
    if (!code) {
      setSimpleModelPickerStatus("Enter the one-time code shown by the desktop companion.", true);
      if (el.simpleCompanionPairingCode) {
        el.simpleCompanionPairingCode.focus();
      }
      return false;
    }
    if (!state.companion.client || companionIsPaired()) {
      return false;
    }
    const pairButtonHadFocus = Boolean(
      el.simpleCompanionPairButton &&
      document.activeElement === el.simpleCompanionPairButton
    );
    const pairingFocusStandIn = pairButtonHadFocus
      ? el.simpleCompanionPairingCode || el.simpleModelCloseButton || el.simpleDiscoveryPanel
      : null;
    if (pairingFocusStandIn && typeof pairingFocusStandIn.focus === "function") {
      pairingFocusStandIn.focus();
    }
    let pairingFailed = false;
    if (el.simpleCompanionPairButton) {
      el.simpleCompanionPairButton.disabled = true;
    }
    setSimpleModelPickerStatus("Connecting securely to the desktop companion...", false);
    try {
      await state.companion.client.pair(code);
      if (el.simpleCompanionPairingCode) {
        el.simpleCompanionPairingCode.value = "";
      }
      if (el.simpleCompanionPairing) {
        el.simpleCompanionPairing.hidden = true;
      }
      setCompanionStatus("paired", "Desktop companion connected", false);
      await refreshCompanionRuntime();
      refreshPeerAvailabilityViews();
      if (state.companion.pendingAcquisition) {
        return resumePendingCompanionAcquisition();
      }
      return true;
    } catch (error) {
      pairingFailed = true;
      markKnownDirectSeedsForReconnect(
        "direct-composition-seed-companion-reconnect-required"
      );
      const text = friendlyError(errorMessage(error));
      setSimpleModelPickerStatus(`Companion connection failed: ${text}`, true);
      setCompanionStatus("disconnected", `Companion connection failed: ${text}`, true);
      return false;
    } finally {
      if (el.simpleCompanionPairButton) {
        el.simpleCompanionPairButton.disabled = false;
      }
      if (pairingFailed && pairButtonHadFocus && pairingFocusStandIn &&
          el.simpleDiscoveryPanel && !el.simpleDiscoveryPanel.hidden &&
          document.activeElement === pairingFocusStandIn) {
        const selected = selectedSimpleModelEntry();
        scheduleSimpleModelPickerFocus({
          pair: true,
          compositionId: selected && selected.composition
            ? selected.composition.compositionId
            : ""
        });
      }
    }
  }

  function syncSemanticControls(refreshSeed) {
    const creativity = selectedRadioValue("simpleCreativity", "balanced");
    const length = selectedRadioValue("simpleLength", "normal");
    const sampling = semanticSettings.creativity[creativity] || semanticSettings.creativity.balanced;
    if (el.temperature) {
      el.temperature.value = sampling.temperature;
    }
    if (el.topK) {
      el.topK.value = sampling.topK;
    }
    if (el.topP) {
      el.topP.value = sampling.topP;
    }
    if (el.maxTokens) {
      el.maxTokens.value = semanticSettings.length[length] || semanticSettings.length.normal;
    }
    if (el.seed && refreshSeed) {
      el.seed.value = String(Math.floor(Math.random() * 4294967295));
    }
    syncRangeControls();
    storageSet(uiStorageKeys.creativity, creativity);
    storageSet(uiStorageKeys.length, length);
  }

  function restoreSemanticPreferences() {
    setRadioValue("simpleCreativity", storageGet(uiStorageKeys.creativity, "balanced"));
    setRadioValue("simpleLength", storageGet(uiStorageKeys.length, "normal"));
    syncSemanticControls(false);
  }

  function defaultLocalConnectCategoryRules() {
    const rules = Object.create(null);
    for (const category of localConnectAppCategories) {
      rules[category.id] = "ask";
    }
    return rules;
  }

  function sanitizeLocalConnectApprovalMode(value) {
    return Object.prototype.hasOwnProperty.call(localConnectApprovalModes, value) ? value : "ask";
  }

  function sanitizeLocalConnectApprovalLevel(value) {
    return Object.prototype.hasOwnProperty.call(localConnectApprovalLevels, value) ? value : "ask";
  }

  function safeLocalConnectCssToken(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 32) || "unknown";
  }

  function findLocalConnectCategory(categoryId) {
    return localConnectAppCategories.find((category) => category.id === categoryId) || null;
  }

  function localConnectKnownCategoryForApp(appName) {
    return localConnectKnownAppCategories.get(String(appName || "").trim().toLowerCase()) || "";
  }

  function localConnectAppLevelApprovalAllowed(category) {
    return Boolean(category && category.id !== "terminal" && category.id !== "secrets");
  }

  function localConnectApprovedAppBindings(approvedApps, approvedAppCategories) {
    return approvedApps
      .map((app) => {
        const appKey = String(app || "").trim().toLowerCase();
        const categoryId = localConnectKnownCategoryForApp(app)
          || (approvedAppCategories && approvedAppCategories[appKey])
          || "files";
        const category = findLocalConnectCategory(categoryId);
        if (!localConnectAppLevelApprovalAllowed(category)) {
          return null;
        }
        return {
          app,
          category: category.id,
          category_label: category.label,
          risk: category.risk,
          warning: category.warning,
          approval: "always"
        };
      })
      .filter(Boolean);
  }

  function localConnectApprovedAppBindingFor(snapshot, appName) {
    const normalizedName = String(appName || "").trim().toLowerCase();
    if (!normalizedName || !snapshot || !Array.isArray(snapshot.approved_app_bindings)) {
      return null;
    }
    return snapshot.approved_app_bindings.find(
      (binding) => String(binding.app || "").trim().toLowerCase() === normalizedName
    ) || null;
  }

  function localConnectAppApprovedForCategory(snapshot, appName, category) {
    if (!category) {
      return false;
    }
    const binding = localConnectApprovedAppBindingFor(snapshot, appName);
    return Boolean(binding && binding.category === category.id);
  }

  function parseLocalConnectCategoryRules(raw) {
    const rules = defaultLocalConnectCategoryRules();
    if (!raw) {
      return rules;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return rules;
      }
      for (const category of localConnectAppCategories) {
        rules[category.id] = sanitizeLocalConnectApprovalLevel(parsed[category.id]);
      }
    } catch (_error) {
      return rules;
    }
    return rules;
  }

  function normalizeLocalConnectApprovedApps(value) {
    const seen = new Set();
    const apps = [];
    const raw = Array.isArray(value) ? value.join("\n") : String(value || "");
    for (const part of raw.split(/[\n,;]+/)) {
      const app = part
        .replace(/[\u0000-\u001f\u007f]+/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 96);
      if (!app || seen.has(app.toLowerCase())) {
        continue;
      }
      const knownCategory = localConnectKnownCategoryForApp(app);
      if (knownCategory === "terminal" || knownCategory === "secrets") {
        continue;
      }
      seen.add(app.toLowerCase());
      apps.push(app);
      if (apps.length >= 40) {
        break;
      }
    }
    return apps;
  }

  function normalizeLocalConnectApprovedAppCategories(approvedApps, value) {
    const categories = Object.create(null);
    const raw = value && typeof value === "object" ? value : Object.create(null);
    for (const app of approvedApps || []) {
      const appKey = String(app || "").trim().toLowerCase();
      if (!appKey || localConnectKnownCategoryForApp(app)) {
        continue;
      }
      const rawCategory = sanitizeLocalConnectCategoryId(raw[appKey] || raw[app]);
      const category = findLocalConnectCategory(rawCategory);
      if (localConnectAppLevelApprovalAllowed(category)) {
        categories[appKey] = category.id;
      }
    }
    return categories;
  }

  function sanitizeLocalConnectCategoryId(value) {
    const category = findLocalConnectCategory(String(value || "").trim());
    return category ? category.id : "";
  }

  function sanitizeLocalConnectEndpointUrl(value) {
    const raw = String(value || "").trim() || `${"http:"}//127.0.0.1:8711`;
    let parsed;
    try {
      parsed = new URL(raw);
    } catch (_error) {
      throw new Error("Local Connect endpoint must be a loopback HTTP URL.");
    }
    const hostname = parsed.hostname.toLowerCase();
    const safeHost = hostname === "127.0.0.1" || hostname === "localhost";
    if (parsed.protocol !== "http:" || !safeHost) {
      throw new Error("Local Connect endpoint must use loopback HTTP at 127.0.0.1 or localhost.");
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("Local Connect endpoint must not include credentials, query, or fragment.");
    }
    if (parsed.pathname && parsed.pathname !== "/") {
      throw new Error("Local Connect endpoint URL must be the loopback origin only.");
    }
    if (!parsed.port) {
      parsed.port = "8711";
    }
    return parsed.origin;
  }

  function setLocalConnectEndpointStatus(message, isError) {
    if (el.localConnectEndpointStatus) {
      el.localConnectEndpointStatus.textContent = message;
      el.localConnectEndpointStatus.classList.toggle("error", Boolean(isError));
    }
  }

  async function localConnectPolicySha256(snapshot) {
    return sha256Text(`${JSON.stringify(snapshot, null, 2)}\n`);
  }

  function validateLocalConnectPolicySha256(value, expectedPolicySha256, label) {
    if (value !== expectedPolicySha256) {
      throw new Error(`Local Connect endpoint ${label} policy digest does not match the browser preview.`);
    }
  }

  function localConnectFullControlReady(snapshot) {
    return Boolean(snapshot && snapshot.full_local_control && snapshot.full_control_non_sensitive_machine_acknowledged);
  }

  function assertLocalConnectPolicyReadyForEndpoint(snapshot) {
    if (snapshot && snapshot.full_local_control && !snapshot.full_control_non_sensitive_machine_acknowledged) {
      throw new Error("Full local-control lab mode requires non-sensitive machine acknowledgement.");
    }
  }

  function validateLocalConnectHealth(health, snapshot, expectedPolicySha256) {
    if (!health || health.endpoint_kind !== "tinyrustlm.local_connect_endpoint.v0") {
      throw new Error("Local Connect endpoint health response was not recognized.");
    }
    if (health.status !== "ready" || health.bind_host !== "127.0.0.1") {
      throw new Error("Local Connect endpoint is not ready on loopback.");
    }
    if (health.policy_kind !== localConnectPolicyKind || health.policy_version !== localConnectPolicyVersion) {
      throw new Error("Local Connect endpoint policy kind/version does not match this UI.");
    }
    if (health.approval_mode !== snapshot.approval_mode) {
      throw new Error("Local Connect endpoint policy mode differs from the browser preview.");
    }
    if (health.full_local_control !== snapshot.full_local_control) {
      throw new Error("Local Connect endpoint full-control flag differs from the browser preview.");
    }
    if (health.full_control_non_sensitive_machine_acknowledged !== snapshot.full_control_non_sensitive_machine_acknowledged) {
      throw new Error("Local Connect endpoint full-control acknowledgement differs from the browser preview.");
    }
    validateLocalConnectPolicySha256(health.policy_sha256, expectedPolicySha256, "health");
    if (health.app_execution_endpoints !== true || health.action_endpoint_path !== "/v0/action") {
      throw new Error("Local Connect endpoint did not expose the gated action endpoint.");
    }
    if (
      health.app_inventory_policy !== localConnectAppInventoryPolicy ||
      health.app_inventory_path_exposure !== localConnectAppInventoryPathExposure
    ) {
      throw new Error("Local Connect endpoint did not advertise the path-free app inventory contract.");
    }
    if (health.app_approval_binding_policy !== localConnectAppApprovalBindingPolicy) {
      throw new Error("Local Connect endpoint did not advertise category-bound app approval.");
    }
    if (health.action_execution_policy !== localConnectActionExecutionPolicy) {
      throw new Error("Local Connect endpoint did not advertise the dry-run-first execution-consent action contract.");
    }
    if (!Array.isArray(health.supported_actions) || !health.supported_actions.includes("open-url")) {
      throw new Error("Local Connect endpoint did not advertise browser open-url action support.");
    }
  }

  function validateLocalConnectCategories(categories, snapshot, expectedPolicySha256) {
    if (!categories || categories.endpoint_kind !== "tinyrustlm.local_connect_endpoint.v0" || !Array.isArray(categories.categories)) {
      throw new Error("Local Connect endpoint category response was not recognized.");
    }
    validateLocalConnectPolicySha256(categories.policy_sha256, expectedPolicySha256, "category");
    if (categories.categories.length !== localConnectAppCategories.length) {
      throw new Error("Local Connect endpoint category count does not match this UI.");
    }
    for (const category of localConnectAppCategories) {
      const remote = categories.categories.find((entry) => entry.category === category.id);
      if (!remote || remote.risk !== category.risk || remote.approval !== snapshot.category_approval[category.id]) {
        throw new Error(`Local Connect endpoint category drift for ${category.label}.`);
      }
    }
  }

  function validateLocalConnectApps(apps, snapshot, expectedPolicySha256) {
    if (!apps || apps.endpoint_kind !== "tinyrustlm.local_connect_endpoint.v0" || !Array.isArray(apps.apps)) {
      throw new Error("Local Connect endpoint app response was not recognized.");
    }
    validateLocalConnectPolicySha256(apps.policy_sha256, expectedPolicySha256, "app-list");
    if (apps.inventory_paths_exposed !== false) {
      throw new Error("Local Connect endpoint app inventory must not expose local paths.");
    }
    if (
      apps.app_inventory_policy !== localConnectAppInventoryPolicy ||
      apps.app_inventory_path_exposure !== localConnectAppInventoryPathExposure
    ) {
      throw new Error("Local Connect endpoint app inventory contract was not recognized.");
    }
    if (apps.app_approval_binding_policy !== localConnectAppApprovalBindingPolicy) {
      throw new Error("Local Connect endpoint app approval binding contract was not recognized.");
    }
    if (apps.action_execution_policy !== localConnectActionExecutionPolicy) {
      throw new Error("Local Connect endpoint action execution contract was not recognized.");
    }
    if (typeof apps.inventory_source !== "string" || !apps.inventory_source.trim()) {
      throw new Error("Local Connect endpoint app inventory source was missing.");
    }
    if (apps.app_execution_endpoints !== true || apps.action_endpoint_path !== "/v0/action") {
      throw new Error("Local Connect endpoint app list did not advertise the gated action endpoint.");
    }
    const approvedAppNames = new Set(snapshot.approved_apps.map((app) => app.toLowerCase()));
    const approvedBindings = new Map(
      snapshot.approved_app_bindings.map((binding) => [
        String(binding.app || "").trim().toLowerCase(),
        binding
      ])
    );
    const listedApprovedApps = new Set();
    for (const app of apps.apps) {
      if (!app || typeof app !== "object") {
        throw new Error("Local Connect endpoint app row was not recognized.");
      }
      const category = findLocalConnectCategory(app.category);
      if (!category || app.risk !== category.risk || app.warning !== category.warning) {
        throw new Error("Local Connect endpoint app category drift.");
      }
      if (app.approval !== snapshot.category_approval[category.id]) {
        throw new Error(`Local Connect endpoint app approval drift for ${category.label}.`);
      }
      if (!["allow", "ask", "deny"].includes(app.decision) || !String(app.reason || "").trim()) {
        throw new Error("Local Connect endpoint app decision was not recognized.");
      }
      if (app.app_execution_performed !== false) {
        throw new Error("Local Connect endpoint app list executed an app.");
      }
      if (app.inventory_paths_exposed !== false) {
        throw new Error("Local Connect endpoint app row exposed a local path.");
      }
      if (app.app_approval_binding_policy !== localConnectAppApprovalBindingPolicy) {
        throw new Error("Local Connect endpoint app row approval binding contract was not recognized.");
      }
      if (app.action_execution_policy !== localConnectActionExecutionPolicy) {
        throw new Error("Local Connect endpoint app row action execution contract was not recognized.");
      }
      if (typeof app.source_label !== "string" || !app.source_label.trim()) {
        throw new Error("Local Connect endpoint app row was missing a source label.");
      }
      if (!Array.isArray(app.supported_actions)) {
        throw new Error("Local Connect endpoint app row did not include supported actions.");
      }
      const appName = String(app.app || "").trim();
      if (!appName) {
        throw new Error("Local Connect endpoint app row was missing a name.");
      }
      if (approvedAppNames.has(appName.toLowerCase())) {
        listedApprovedApps.add(appName.toLowerCase());
      }
      const approvedBinding = approvedBindings.get(appName.toLowerCase());
      if (approvedBinding && approvedBinding.category !== app.category) {
        throw new Error("Local Connect endpoint approved app category drift.");
      }
    }
    for (const approvedApp of approvedAppNames) {
      if (!listedApprovedApps.has(approvedApp)) {
        throw new Error("Local Connect endpoint app list omitted an approved app.");
      }
    }
  }

  function validateLocalConnectDecision(decision, expectedPolicySha256) {
    if (!decision || decision.endpoint_kind !== "tinyrustlm.local_connect_endpoint.v0") {
      throw new Error("Local Connect endpoint decision response was not recognized.");
    }
    validateLocalConnectPolicySha256(decision.policy_sha256, expectedPolicySha256, "decision");
    if (decision.app_approval_binding_policy !== localConnectAppApprovalBindingPolicy) {
      throw new Error("Local Connect endpoint decision did not bind approved apps to categories.");
    }
    if (!["allow", "ask", "deny"].includes(decision.decision)) {
      throw new Error("Local Connect endpoint returned an unknown decision.");
    }
    if (decision.app_execution_performed !== false) {
      throw new Error("Local Connect endpoint executed an app during a dry run.");
    }
  }

  function validateLocalConnectAction(action, expectedPolicySha256, snapshot, expectedDryRun = true) {
    if (!action || action.endpoint_kind !== "tinyrustlm.local_connect_endpoint.v0") {
      throw new Error("Local Connect endpoint action response was not recognized.");
    }
    validateLocalConnectPolicySha256(action.policy_sha256, expectedPolicySha256, "action");
    if (action.app_approval_binding_policy !== localConnectAppApprovalBindingPolicy) {
      throw new Error("Local Connect endpoint action did not bind approved apps to categories.");
    }
    if (action.action_execution_policy !== localConnectActionExecutionPolicy) {
      throw new Error("Local Connect endpoint action did not use the dry-run-first execution-consent contract.");
    }
    const allowedReasons = new Set(["category-always-approved", "app-approved"]);
    if (localConnectFullControlReady(snapshot)) {
      allowedReasons.add("full-local-control");
    }
    if (action.decision !== "allow" || !allowedReasons.has(action.reason)) {
      throw new Error("Local Connect endpoint action was not allowed by the browser approval policy.");
    }
    if (localConnectFullControlReady(snapshot) && action.full_control_warning !== true) {
      throw new Error("Local Connect endpoint did not echo the full-control warning.");
    }
    if (action.action !== "open-url" || action.target_kind !== "https-url") {
      throw new Error("Local Connect endpoint action response did not bind the requested open-url action.");
    }
    if (!isCatalogSha256(action.action_request_sha256)) {
      throw new Error("Local Connect endpoint action response did not include a valid request fingerprint.");
    }
    if (expectedDryRun && (action.dry_run !== true || action.app_execution_performed !== false || action.execution_status !== "dry-run")) {
      throw new Error("Local Connect endpoint action dry run performed app execution.");
    }
    if (!expectedDryRun && (action.dry_run !== false || action.app_execution_performed !== true || action.execution_status !== "started")) {
      throw new Error("Local Connect endpoint action did not report explicit execution.");
    }
  }

  function localConnectEndpointDisplayDecision(app, snapshot, category) {
    const appName = String(app && app.app || "").trim();
    const appApproved = localConnectAppApprovedForCategory(snapshot, appName, category);
    const categoryApproval = category ? snapshot.category_approval[category.id] : "ask";
    if (categoryApproval === "deny") {
      return { decision: "deny", reason: "category-denied" };
    }
    if (localConnectFullControlReady(snapshot)) {
      return { decision: "allow", reason: "full-local-control" };
    }
    if (categoryApproval === "always") {
      return { decision: "allow", reason: "category-always-approved" };
    }
    if (appApproved) {
      return { decision: "allow", reason: "app-approved" };
    }
    if (app && ["allow", "ask", "deny"].includes(app.decision)) {
      return { decision: app.decision, reason: String(app.reason || "endpoint") };
    }
    return { decision: "ask", reason: "not-selected" };
  }

  function approveLocalConnectEndpointApp(appName, categoryId) {
    const category = findLocalConnectCategory(categoryId);
    if (!localConnectAppLevelApprovalAllowed(category)) {
      setLocalConnectEndpointStatus("Critical categories cannot be app-level always approved. Use ask/block or full local-control lab mode on a non-sensitive machine.", true);
      return;
    }
    const knownCategoryId = localConnectKnownCategoryForApp(appName);
    if (knownCategoryId && knownCategoryId !== category.id) {
      setLocalConnectEndpointStatus("Known app category did not match the endpoint row. Re-check the local endpoint before approving this app.", true);
      return;
    }
    const normalized = normalizeLocalConnectApprovedApps([
      ...(state.localConnectApprovedApps || []),
      String(appName || "").trim()
    ]);
    state.localConnectApprovedApps = normalized;
    state.localConnectApprovedAppCategories = normalizeLocalConnectApprovedAppCategories(
      normalized,
      state.localConnectApprovedAppCategories
    );
    const approvedApp = normalized.find(
      (app) => app.toLowerCase() === String(appName || "").trim().toLowerCase()
    );
    if (approvedApp && !localConnectKnownCategoryForApp(approvedApp)) {
      state.localConnectApprovedAppCategories[approvedApp.toLowerCase()] = category.id;
    }
    if (el.localConnectApprovedApps) {
      el.localConnectApprovedApps.value = normalized.join("\n");
    }
    if (state.localConnectApprovalMode === "ask") {
      state.localConnectApprovalMode = "selected";
    }
    persistLocalConnectPolicy("Approved app saved. Re-check endpoint before relying on the updated policy.", {
      preserveEndpointApps: true
    });
    setLocalConnectEndpointStatus("Approved app saved locally. Save the endpoint policy JSON over the watched policy file to enforce it.", false);
  }

  function setLocalConnectEndpointCategoryApproval(categoryId, approvalLevel) {
    const category = findLocalConnectCategory(categoryId);
    if (!category) {
      return;
    }
    if (!state.localConnectCategoryRules) {
      state.localConnectCategoryRules = defaultLocalConnectCategoryRules();
    }
    state.localConnectCategoryRules[category.id] = sanitizeLocalConnectApprovalLevel(approvalLevel);
    if (state.localConnectApprovalMode === "ask" && state.localConnectCategoryRules[category.id] === "always") {
      state.localConnectApprovalMode = "selected";
    }
    const label = state.localConnectCategoryRules[category.id] === "deny" ? "blocked" : "always approved";
    persistLocalConnectPolicy(`${category.label} ${label}. Re-check endpoint before relying on the updated policy.`, {
      preserveEndpointApps: true
    });
    setLocalConnectEndpointStatus(`${category.label} ${label} locally. Save the endpoint policy JSON over the watched policy file to enforce it.`, false);
  }

  function renderLocalConnectEndpointApps(apps) {
    if (!el.localConnectEndpointAppList) {
      return;
    }
    state.localConnectEndpointApps = apps || null;
    el.localConnectEndpointAppList.replaceChildren();
    const rows = apps && Array.isArray(apps.apps) ? apps.apps.slice(0, 12) : [];
    const snapshot = localConnectPolicySnapshot();
    for (const app of rows) {
      const appName = String(app.app || "").trim();
      const categorySpec = findLocalConnectCategory(app.category);
      const displayDecision = localConnectEndpointDisplayDecision(app, snapshot, categorySpec);
      const categoryApproval = categorySpec ? snapshot.category_approval[categorySpec.id] : app.approval;
      const appApproved = localConnectAppApprovedForCategory(snapshot, appName, categorySpec);
      const appApprovalAllowed = localConnectAppLevelApprovalAllowed(categorySpec);
      const row = document.createElement("div");
      row.className = `local-connect-endpoint-app risk-${safeLocalConnectCssToken(app.risk)}`;
      row.setAttribute("role", "listitem");
      const copy = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = app.app;
      const meta = document.createElement("div");
      meta.className = "local-connect-app-meta";
      const category = document.createElement("span");
      category.textContent = app.category_label || app.category;
      const risk = document.createElement("span");
      risk.textContent = `${app.risk} risk`;
      const approval = document.createElement("span");
      approval.textContent = `${categoryApproval} category`;
      const source = document.createElement("span");
      source.textContent = app.inventory_observed ? "found locally" : (app.source_label || app.source || "candidate");
      meta.append(category, risk, approval, source);
      const warning = document.createElement("small");
      warning.className = "local-connect-app-warning";
      warning.textContent = app.warning || "";
      copy.append(name, meta, warning);
      const controls = document.createElement("div");
      controls.className = "local-connect-app-controls";
      const approveAppButton = document.createElement("button");
      approveAppButton.className = "secondary-action local-connect-app-action";
      approveAppButton.type = "button";
      approveAppButton.dataset.localConnectAppAction = "approve-app";
      approveAppButton.dataset.localConnectAppName = appName;
      approveAppButton.textContent = snapshot.full_local_control
        ? localConnectFullControlReady(snapshot) ? "Full mode active" : "Needs acknowledgement"
        : !appApprovalAllowed ? "Category risk only" : appApproved ? "App approved" : "Always approve app";
      approveAppButton.disabled = snapshot.full_local_control || appApproved || !appName || !appApprovalAllowed;
      approveAppButton.addEventListener("click", () => {
        approveLocalConnectEndpointApp(appName, app.category);
      });
      const approveCategoryButton = document.createElement("button");
      approveCategoryButton.className = "secondary-action local-connect-app-action";
      approveCategoryButton.type = "button";
      approveCategoryButton.dataset.localConnectAppAction = "approve-category";
      approveCategoryButton.dataset.localConnectCategory = app.category;
      approveCategoryButton.textContent = categoryApproval === "always" ? "Category approved" : "Always approve category";
      approveCategoryButton.disabled = snapshot.full_local_control || categoryApproval === "always" || !categorySpec;
      approveCategoryButton.addEventListener("click", () => {
        setLocalConnectEndpointCategoryApproval(app.category, "always");
      });
      const blockCategoryButton = document.createElement("button");
      blockCategoryButton.className = "secondary-action local-connect-app-action";
      blockCategoryButton.type = "button";
      blockCategoryButton.dataset.localConnectAppAction = "block-category";
      blockCategoryButton.dataset.localConnectCategory = app.category;
      blockCategoryButton.textContent = categoryApproval === "deny" ? "Category blocked" : "Block category";
      blockCategoryButton.disabled = categoryApproval === "deny" || !categorySpec;
      blockCategoryButton.addEventListener("click", () => {
        setLocalConnectEndpointCategoryApproval(app.category, "deny");
      });
      controls.append(approveAppButton, approveCategoryButton, blockCategoryButton);
      const decision = document.createElement("span");
      decision.className = `local-connect-app-decision ${safeLocalConnectCssToken(displayDecision.decision)}`;
      decision.textContent = displayDecision.decision;
      decision.title = displayDecision.reason;
      row.title = app.warning || "";
      row.append(copy, controls, decision);
      el.localConnectEndpointAppList.append(row);
    }
  }

  function clearLocalConnectEndpointApps() {
    state.localConnectEndpointApps = null;
    if (el.localConnectEndpointAppList) {
      el.localConnectEndpointAppList.replaceChildren();
    }
  }

  async function fetchLocalConnectJson(url, options) {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      ...options
    });
    let body = null;
    try {
      body = await response.json();
    } catch (_error) {
      // Response shape is validated by the caller.
    }
    if (!response.ok) {
      const detail = body && body.message ? ` ${body.message}` : "";
      throw new Error(`Local Connect endpoint returned ${response.status}.${detail}`);
    }
    return body;
  }

  async function checkLocalConnectEndpoint(dryRunDecision) {
    persistLocalConnectPolicy();
    const endpoint = sanitizeLocalConnectEndpointUrl(
      el.localConnectEndpointUrl ? el.localConnectEndpointUrl.value : state.localConnectEndpointUrl
    );
    state.localConnectEndpointUrl = endpoint;
    storageSet(uiStorageKeys.localConnectEndpointUrl, endpoint);
    if (el.localConnectEndpointUrl) {
      el.localConnectEndpointUrl.value = endpoint;
    }
    setLocalConnectEndpointStatus("Checking Local Connect endpoint...", false);
    const snapshot = localConnectPolicySnapshot();
    assertLocalConnectPolicyReadyForEndpoint(snapshot);
    const expectedPolicySha256 = await localConnectPolicySha256(snapshot);
    const health = await fetchLocalConnectJson(`${endpoint}/v0/health`);
    validateLocalConnectHealth(health, snapshot, expectedPolicySha256);
    const categories = await fetchLocalConnectJson(`${endpoint}/v0/categories`);
    validateLocalConnectCategories(categories, snapshot, expectedPolicySha256);
    const apps = await fetchLocalConnectJson(`${endpoint}/v0/apps`);
    validateLocalConnectApps(apps, snapshot, expectedPolicySha256);
    renderLocalConnectEndpointApps(apps);
    if (!dryRunDecision) {
      setLocalConnectEndpointStatus(
        `Endpoint ready at ${endpoint}. Policy digest matched. Gated action endpoint available.`,
        false
      );
      return;
    }
    const decision = await fetchLocalConnectJson(`${endpoint}/v0/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: "browser", app: "chrome.exe" })
    });
    validateLocalConnectDecision(decision, expectedPolicySha256);
    setLocalConnectEndpointStatus(
      `Endpoint decision: ${decision.decision} for browser/chrome.exe; policy digest matched and no app execution performed.`,
      decision.decision === "deny"
    );
  }

  async function requestLocalConnectOpenUrlAction(dryRun) {
    persistLocalConnectPolicy(undefined, { preserveEndpointApps: true });
    const endpoint = sanitizeLocalConnectEndpointUrl(
      el.localConnectEndpointUrl ? el.localConnectEndpointUrl.value : state.localConnectEndpointUrl
    );
    state.localConnectEndpointUrl = endpoint;
    storageSet(uiStorageKeys.localConnectEndpointUrl, endpoint);
    if (el.localConnectEndpointUrl) {
      el.localConnectEndpointUrl.value = endpoint;
    }
    setLocalConnectEndpointStatus(
      dryRun ? "Dry-running Local Connect open-url action..." : "Executing Local Connect open-url action...",
      false
    );
    const snapshot = localConnectPolicySnapshot();
    assertLocalConnectPolicyReadyForEndpoint(snapshot);
    const expectedPolicySha256 = await localConnectPolicySha256(snapshot);
    const headers = {
      "content-type": "application/json",
      "x-tinyrustlm-policy-sha256": expectedPolicySha256
    };
    if (!dryRun) {
      headers["x-tinyrustlm-execution-consent"] = "native-opener-v1";
    }
    const action = await fetchLocalConnectJson(`${endpoint}/v0/action`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        policy_sha256: expectedPolicySha256,
        category: "browser",
        app: "chrome.exe",
        action: "open-url",
        target: dryRun
          ? `${"https:"}//tinyrustlm.com/local-connect-dry-run`
          : `${"https:"}//tinyrustlm.com/local-connect-executed`,
        dry_run: dryRun
      })
    });
    validateLocalConnectAction(action, expectedPolicySha256, snapshot, dryRun);
    setLocalConnectEndpointStatus(
      dryRun
        ? `Endpoint action dry run: ${action.decision} ${action.action} for browser/chrome.exe; request fingerprint ${action.action_request_sha256}; no app execution performed.`
        : `Endpoint action executed: ${action.decision} ${action.action} for browser/chrome.exe; request fingerprint ${action.action_request_sha256}; endpoint reported native opener start.`,
      false
    );
  }

  async function dryRunLocalConnectAction() {
    await requestLocalConnectOpenUrlAction(true);
  }

  async function executeLocalConnectAction() {
    await requestLocalConnectOpenUrlAction(false);
  }

  function saveLocalConnectEndpointPolicyJson() {
    persistLocalConnectPolicy();
    const snapshot = localConnectPolicySnapshot();
    assertLocalConnectPolicyReadyForEndpoint(snapshot);
    downloadTextFile("tinyrustlm-local-connect-policy.v0.json", `${JSON.stringify(snapshot, null, 2)}\n`);
    updateLocalConnectPolicyUi("Endpoint policy JSON saved.");
    setLocalConnectEndpointStatus("Endpoint policy JSON saved. Replace the endpoint's watched policy file to apply it live.", false);
  }

  function localConnectPolicySnapshot() {
    const categoryRules = defaultLocalConnectCategoryRules();
    for (const category of localConnectAppCategories) {
      categoryRules[category.id] = sanitizeLocalConnectApprovalLevel(
        state.localConnectCategoryRules && state.localConnectCategoryRules[category.id]
      );
    }
    const approvedApps = normalizeLocalConnectApprovedApps(state.localConnectApprovedApps || []);
    const approvedAppCategories = normalizeLocalConnectApprovedAppCategories(
      approvedApps,
      state.localConnectApprovedAppCategories
    );
    const approvedAppBindings = localConnectApprovedAppBindings(approvedApps, approvedAppCategories);
    const mode = sanitizeLocalConnectApprovalMode(state.localConnectApprovalMode);
    const fullControlAcknowledged = mode === "full" && Boolean(state.localConnectFullControlAcknowledged);
    return {
      policy_kind: localConnectPolicyKind,
      policy_version: localConnectPolicyVersion,
      approval_mode: mode,
      approval_mode_label: localConnectApprovalModes[mode].label,
      full_local_control: mode === "full",
      full_control_non_sensitive_machine_acknowledged: fullControlAcknowledged,
      browser_local_storage_only: true,
      project_server_receives_policy: false,
      local_endpoint_must_enforce_policy: true,
      category_approval: categoryRules,
      approved_apps: approvedApps,
      approved_app_bindings: approvedAppBindings,
      risk_warnings: localConnectAppCategories.map((category) => ({
        category: category.id,
        label: category.label,
        risk: category.risk,
        warning: category.warning,
        approval: categoryRules[category.id]
      }))
    };
  }

  function localConnectPolicyStatusText(snapshot) {
    if (snapshot.full_local_control) {
      return snapshot.full_control_non_sensitive_machine_acknowledged
        ? "Full local-control lab mode active for this non-sensitive computer."
        : "Full local-control lab mode needs non-sensitive machine acknowledgement.";
    }
    const alwaysCategories = localConnectAppCategories
      .filter((category) => snapshot.category_approval[category.id] === "always")
      .map((category) => category.label);
    const approvedAppCount = snapshot.approved_apps.length;
    if (alwaysCategories.length || approvedAppCount) {
      const parts = [];
      if (alwaysCategories.length) {
        parts.push(alwaysCategories.length === 1 ? "1 category" : `${alwaysCategories.length} categories`);
      }
      if (approvedAppCount) {
        parts.push(`${approvedAppCount} app${approvedAppCount === 1 ? "" : "s"}`);
      }
      return `Always approve selected: ${parts.join(" and ")}.`;
    }
    return "Ask every time for all app categories.";
  }

  function renderLocalConnectCategoryRows() {
    if (!el.localConnectCategoryList) {
      return;
    }
    el.localConnectCategoryList.replaceChildren();
    for (const category of localConnectAppCategories) {
      const row = document.createElement("div");
      row.className = `local-connect-category risk-${category.risk}`;
      row.setAttribute("role", "listitem");
      const text = document.createElement("div");
      text.className = "local-connect-category-copy";
      const title = document.createElement("strong");
      title.textContent = category.label;
      const risk = document.createElement("span");
      risk.className = "local-connect-risk";
      risk.textContent = `${category.risk} risk`;
      const warning = document.createElement("small");
      warning.textContent = category.warning;
      text.append(title, risk, warning);
      const select = document.createElement("select");
      select.dataset.localConnectCategory = category.id;
      select.setAttribute("aria-label", `${category.label} approval`);
      for (const [value, label] of Object.entries(localConnectApprovalLevels)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.append(option);
      }
      select.value = sanitizeLocalConnectApprovalLevel(
        state.localConnectCategoryRules && state.localConnectCategoryRules[category.id]
      );
      select.addEventListener("change", () => {
        if (!state.localConnectCategoryRules) {
          state.localConnectCategoryRules = defaultLocalConnectCategoryRules();
        }
        state.localConnectCategoryRules[category.id] = sanitizeLocalConnectApprovalLevel(select.value);
        if (state.localConnectApprovalMode === "ask" && select.value === "always") {
          state.localConnectApprovalMode = "selected";
        }
        persistLocalConnectPolicy("Approval policy saved.");
      });
      row.append(text, select);
      el.localConnectCategoryList.append(row);
    }
  }

  function updateLocalConnectPolicyUi(statusOverride) {
    if (!state.localConnectCategoryRules) {
      state.localConnectCategoryRules = defaultLocalConnectCategoryRules();
    }
    const snapshot = localConnectPolicySnapshot();
    const modeWarning = localConnectApprovalModes[snapshot.approval_mode].warning;
    const policyStatus = localConnectPolicyStatusText(snapshot);
    const statusText = statusOverride ? `${statusOverride} ${policyStatus}` : policyStatus;
    const isFullControl = snapshot.full_local_control;
    const fullControlNeedsAck = isFullControl && !snapshot.full_control_non_sensitive_machine_acknowledged;
    if (el.localConnectApprovalMode) {
      el.localConnectApprovalMode.value = snapshot.approval_mode;
    }
    if (el.localConnectFullControlAck) {
      el.localConnectFullControlAck.checked = snapshot.full_control_non_sensitive_machine_acknowledged;
      el.localConnectFullControlAck.disabled = !isFullControl;
      const row = el.localConnectFullControlAck.closest(".local-connect-full-ack");
      if (row) {
        row.classList.toggle("active", isFullControl);
        row.classList.toggle("error", fullControlNeedsAck);
      }
    }
    if (el.localConnectModeWarning) {
      el.localConnectModeWarning.textContent = modeWarning;
      el.localConnectModeWarning.classList.toggle("error", isFullControl);
      el.localConnectModeWarning.classList.toggle("source-warning", isFullControl);
    }
    if (el.localConnectApprovedApps && document.activeElement !== el.localConnectApprovedApps) {
      el.localConnectApprovedApps.value = snapshot.approved_apps.join("\n");
    }
    if (el.localConnectEndpointUrl && document.activeElement !== el.localConnectEndpointUrl) {
      el.localConnectEndpointUrl.value = state.localConnectEndpointUrl || `${"http:"}//127.0.0.1:8711`;
    }
    if (el.localConnectPolicyStatus) {
      el.localConnectPolicyStatus.textContent = statusText;
      el.localConnectPolicyStatus.classList.toggle("error", isFullControl);
    }
    if (el.localConnectPolicyPreview) {
      el.localConnectPolicyPreview.textContent = `${JSON.stringify(snapshot, null, 2)}\n`;
    }
    renderLocalConnectCategoryRows();
  }

  function persistLocalConnectPolicy(statusOverride, options = {}) {
    state.localConnectApprovalMode = sanitizeLocalConnectApprovalMode(state.localConnectApprovalMode);
    if (el.localConnectFullControlAck) {
      state.localConnectFullControlAcknowledged = Boolean(el.localConnectFullControlAck.checked);
    }
    if (state.localConnectApprovalMode !== "full") {
      state.localConnectFullControlAcknowledged = false;
    }
    if (!state.localConnectCategoryRules) {
      state.localConnectCategoryRules = defaultLocalConnectCategoryRules();
    }
    state.localConnectApprovedApps = normalizeLocalConnectApprovedApps(
      el.localConnectApprovedApps ? el.localConnectApprovedApps.value : state.localConnectApprovedApps
    );
    state.localConnectApprovedAppCategories = normalizeLocalConnectApprovedAppCategories(
      state.localConnectApprovedApps,
      state.localConnectApprovedAppCategories
    );
    const hasAlwaysApproval = localConnectAppCategories.some(
      (category) => state.localConnectCategoryRules[category.id] === "always"
    ) || state.localConnectApprovedApps.length > 0;
    if (state.localConnectApprovalMode === "ask" && hasAlwaysApproval) {
      state.localConnectApprovalMode = "selected";
    }
    storageSet(uiStorageKeys.localConnectApprovalMode, state.localConnectApprovalMode);
    storageSet(uiStorageKeys.localConnectFullControlAcknowledged, String(Boolean(state.localConnectFullControlAcknowledged)));
    storageSet(uiStorageKeys.localConnectCategoryRules, JSON.stringify(state.localConnectCategoryRules));
    storageSet(uiStorageKeys.localConnectApprovedApps, JSON.stringify(state.localConnectApprovedApps));
    storageSet(uiStorageKeys.localConnectApprovedAppCategories, JSON.stringify(state.localConnectApprovedAppCategories));
    if (!options.preserveEndpointApps) {
      clearLocalConnectEndpointApps();
    }
    updateLocalConnectPolicyUi(statusOverride);
    if (options.preserveEndpointApps && state.localConnectEndpointApps) {
      const cachedEndpointApps = state.localConnectEndpointApps;
      renderLocalConnectEndpointApps(cachedEndpointApps);
    }
  }

  function restoreLocalConnectPolicy() {
    state.localConnectApprovalMode = sanitizeLocalConnectApprovalMode(
      storageGet(uiStorageKeys.localConnectApprovalMode, "ask")
    );
    state.localConnectFullControlAcknowledged = state.localConnectApprovalMode === "full"
      && storageGet(uiStorageKeys.localConnectFullControlAcknowledged, "false") === "true";
    state.localConnectCategoryRules = parseLocalConnectCategoryRules(
      storageGet(uiStorageKeys.localConnectCategoryRules, "")
    );
    try {
      state.localConnectApprovedApps = normalizeLocalConnectApprovedApps(
        JSON.parse(storageGet(uiStorageKeys.localConnectApprovedApps, "[]"))
      );
    } catch (_error) {
      state.localConnectApprovedApps = [];
    }
    try {
      state.localConnectApprovedAppCategories = normalizeLocalConnectApprovedAppCategories(
        state.localConnectApprovedApps,
        JSON.parse(storageGet(uiStorageKeys.localConnectApprovedAppCategories, "{}"))
      );
    } catch (_error) {
      state.localConnectApprovedAppCategories = Object.create(null);
    }
    try {
      state.localConnectEndpointUrl = sanitizeLocalConnectEndpointUrl(
        storageGet(uiStorageKeys.localConnectEndpointUrl, `${"http:"}//127.0.0.1:8711`)
      );
    } catch (_error) {
      state.localConnectEndpointUrl = `${"http:"}//127.0.0.1:8711`;
    }
    updateLocalConnectPolicyUi();
  }

  function resetLocalConnectPolicy() {
    state.localConnectApprovalMode = "ask";
    state.localConnectFullControlAcknowledged = false;
    state.localConnectCategoryRules = defaultLocalConnectCategoryRules();
    state.localConnectApprovedApps = [];
    state.localConnectApprovedAppCategories = Object.create(null);
    if (el.localConnectApprovedApps) {
      el.localConnectApprovedApps.value = "";
    }
    persistLocalConnectPolicy("Reset to ask every time.");
  }

  function trustBrowserEmailLocalConnectPolicy() {
    if (!state.localConnectCategoryRules) {
      state.localConnectCategoryRules = defaultLocalConnectCategoryRules();
    }
    state.localConnectApprovalMode = "selected";
    state.localConnectCategoryRules.browser = "always";
    state.localConnectCategoryRules.email = "always";
    persistLocalConnectPolicy(
      "Browsers and email apps always approved locally. Save the endpoint policy JSON over the watched policy file before relying on it.",
      { preserveEndpointApps: true }
    );
    setLocalConnectEndpointStatus("Browsers and email apps approved in the local preview. Save the endpoint policy JSON over the watched policy file to enforce it.", false);
  }

  function formatRangeValue(input) {
    if (!input) {
      return "";
    }
    if (input.id === "temperature" || input.id === "topP") {
      return Number.parseFloat(input.value || "0").toFixed(2);
    }
    return String(Number.parseInt(input.value, 10) || 0);
  }

  function syncRangeControl(input) {
    if (!input || input.type !== "range") {
      return;
    }
    const min = Number.parseFloat(input.min || "0");
    const max = Number.parseFloat(input.max || "100");
    const value = Number.parseFloat(input.value || input.min || "0");
    const span = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty("--fill", `${Math.max(0, Math.min(100, span))}%`);
    const output = document.querySelector(`[data-value-for="${input.id}"]`);
    if (output) {
      output.textContent = formatRangeValue(input);
    }
  }

  function syncRangeControls() {
    document.querySelectorAll('input[type="range"]').forEach(syncRangeControl);
  }

  function setPresetButtonState(preset) {
    document.querySelectorAll(".preset-button").forEach((button) => {
      const selected = button.dataset.preset === preset;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function applyGenerationPreset(preset) {
    const nextPreset = generationPresets[preset] ? preset : "balanced";
    const values = generationPresets[nextPreset];
    state.selectedPreset = nextPreset;
    setPresetButtonState(nextPreset);
    if (el.temperature) {
      el.temperature.value = values.temperature;
    }
    if (el.topK) {
      el.topK.value = values.topK;
    }
    if (el.topP) {
      el.topP.value = values.topP;
    }
    syncRangeControls();
  }

  // Chooses deterministic entry focus for active, populated, valid-empty, and failed states.
  function focusSelectedModelPickerControl() {
    if (!el.simpleDiscoveryPanel || el.simpleDiscoveryPanel.hidden) {
      return;
    }
    if (el.simpleCompanionPairing && !el.simpleCompanionPairing.hidden &&
        el.simpleCompanionPairingCode) {
      el.simpleCompanionPairingCode.focus();
      return;
    }
    const selected = selectedSimpleModelEntry();
    const availableCommands = el.simpleModelList
      ? Array.from(el.simpleModelList.querySelectorAll("[data-composition-id]"))
        .filter((candidate) => !candidate.disabled)
      : [];
    const target = selected
      ? availableCommands.find((candidate) => (
        candidate.dataset.compositionId === selected.composition.compositionId
      )) || availableCommands[0] || null
      : availableCommands[0] || null;
    const action = simpleModelAcquisitionIsActive() && el.simpleModelActionButton &&
      !el.simpleModelActionButton.hidden
      ? el.simpleModelActionButton
      : null;
    const emptyStateTarget = el.simpleModelRefreshButton || el.simpleOpenAdvancedDiscoveryButton;
    (action || target || emptyStateTarget || el.simpleDiscoveryPanel).focus();
  }

  // Keeps keyboard focus inside the visible nonmodal chooser until it is explicitly closed.
  function trapSimpleModelPickerTabFocus(event) {
    if (!event || event.key !== "Tab" || !el.simpleDiscoveryPanel ||
        el.simpleDiscoveryPanel.hidden) {
      return false;
    }
    const controls = Array.from(el.simpleDiscoveryPanel.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
      'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((control) => (
      !control.hidden && !control.closest("[hidden]") && control.getClientRects().length > 0
    ));
    if (!controls.length) {
      event.preventDefault();
      el.simpleDiscoveryPanel.focus();
      return true;
    }
    const activeIndex = controls.indexOf(document.activeElement);
    const target = event.shiftKey
      ? activeIndex <= 0 ? controls[controls.length - 1] : null
      : activeIndex < 0 || activeIndex === controls.length - 1 ? controls[0] : null;
    if (!target) {
      return false;
    }
    event.preventDefault();
    target.focus();
    return true;
  }

  // User activity outside a still-hidden chooser must win over a delayed automatic open.
  function suppressInitialModelChooserAutoPresent(event) {
    if (state.initialModelChooserPresented || !el.simpleDiscoveryPanel ||
        !el.simpleDiscoveryPanel.hidden || !event || event.isTrusted !== true) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target && target.closest("[data-open-model-popover], #modelEditButton")) {
      return;
    }
    state.initialModelChooserAutoPresentSuppressed = true;
  }

  // Controls the nonmodal chooser and restores focus only to its recorded explicit opener.
  function toggleModelPopover(forceOpen, opener = null, restoreFocus = false) {
    const panel = el.simpleDiscoveryPanel;
    const openers = document.querySelectorAll("[data-open-model-popover], #modelEditButton");
    if (!panel) {
      return;
    }
    const nextOpen = typeof forceOpen === "boolean" ? forceOpen : panel.hidden;
    const wasOpen = !panel.hidden;
    if (nextOpen) {
      renderSimpleModelPicker();
      setRailCollapsed(true);
    }
    if (nextOpen && opener instanceof HTMLElement) {
      state.modelPopoverOpener = opener;
      state.initialModelChooserPresented = true;
    }
    panel.hidden = !nextOpen;
    openers.forEach((button) => button.setAttribute("aria-expanded", String(nextOpen)));
    if (nextOpen && !wasOpen && opener) {
      window.requestAnimationFrame(focusSelectedModelPickerControl);
    } else if (!nextOpen && wasOpen && restoreFocus) {
      const target = state.modelPopoverOpener || document.getElementById("modelEditButton") ||
        document.getElementById("sidebarModelsButton");
      if (target instanceof HTMLElement && target.isConnected) {
        target.focus();
      }
    }
    if (!nextOpen) {
      state.modelPopoverOpener = null;
    }
  }

  // Auto-presents once after boot and catalog settle, unless a stored model was restored.
  function maybePresentInitialModelChooser() {
    if (!state.initialModelBootComplete || state.initialModelRestored || state.modelLoaded ||
        !state.modelCatalogV1Loaded || state.modelCatalogV1Loading ||
        state.initialModelChooserPresented || state.initialModelChooserAutoPresentSuppressed ||
        !el.simpleDiscoveryPanel) {
      return;
    }
    state.initialModelChooserPresented = true;
    const opener = document.getElementById("modelEditButton") ||
      document.getElementById("sidebarModelsButton");
    if (el.simpleDiscoveryPanel.hidden) {
      toggleModelPopover(true, opener);
    } else {
      window.requestAnimationFrame(focusSelectedModelPickerControl);
    }
  }

  function holdModelPopoverOpen(durationMs = 1500) {
    state.modelPopoverHoldUntil = Math.max(
      state.modelPopoverHoldUntil || 0,
      Date.now() + durationMs
    );
    toggleModelPopover(true);
  }

  // Admits only the catalog authority's root direct-peer origin.
  function normalizedPeerBaseUrl(value) {
    if (value === undefined || value === null || value === "") return "";
    return directPeerUrlAuthority.normalizeBaseUrl(value);
  }

  function updatePeerUrlStatus(message, isError = false) {
    if (el.simplePeerBaseUrlInput && el.simplePeerBaseUrlInput.value !== state.peerBaseUrl) {
      el.simplePeerBaseUrlInput.value = state.peerBaseUrl || "";
    }
    if (el.simplePeerUrlStatus) {
      const peerText = state.peerBaseUrl
        ? `Known peer saved: ${state.peerBaseUrl} Reachability is not proven until an explicit check or acquisition succeeds.`
        : "Enter a consenting public HTTPS peer IP, or exact loopback IP for local transfer. Saving it does not prove reachability.";
      el.simplePeerUrlStatus.textContent = message || peerText;
      el.simplePeerUrlStatus.classList.toggle("error", Boolean(isError));
    }
  }

  // Save one current peer origin; signing and reachability are separate checks.
  function setPeerBaseUrl(value) {
    const normalized = normalizedPeerBaseUrl(value);
    state.peerBaseUrl = normalized;
    storageSet(uiStorageKeys.peerBaseUrl, normalized);
    updatePeerUrlStatus(normalized ? `Known peer set: ${normalized}` : "", false);
    refreshPeerAvailabilityViews();
    return normalized;
  }

  // Inspect current signed listings for the selected peer without contacting it.
  async function checkCurrentPeerListing() {
    const peerBaseUrl = normalizedPeerBaseUrl(
      (el.simplePeerBaseUrlInput && el.simplePeerBaseUrlInput.value.trim()) || state.peerBaseUrl
    );
    if (!peerBaseUrl) throw new Error("Enter a known peer URL before checking its listing");
    if (state.modelCatalogV1Loading) throw new Error("The model list is still refreshing");
    setPeerBaseUrl(peerBaseUrl);
    await loadSimpleModelCatalog();
    if (state.peerBaseUrl !== peerBaseUrl) return null;
    if (!acceptedCatalogIsCurrent() || !acceptedPeerFeedIsCurrent()) {
      throw new Error("A current signed model and peer list could not be verified");
    }
    const count = state.modelCatalogV1Entries.filter((entry) => entry.peers.some((peer) =>
      peer.peerBaseUrl === peerBaseUrl && canStartP2pImport({ ...entry, peers: [peer] })
    )).length;
    updatePeerUrlStatus(
      `${count} current model ${count === 1 ? "listing" : "listings"} for this peer. ` +
      "This checks signed catalog metadata; reachability is verified during acquisition.",
      false
    );
    return count;
  }

  function refreshPeerAvailabilityViews() {
    if (state.hfLastAccepted && state.hfLastAccepted.length) {
      renderAcceptedHfResults(state.hfLastAccepted);
    }
}

  function companionIsPaired() {
    return Boolean(state.companion.client && state.companion.client.isPaired);
  }

  function companionAcquisitionIsActive(status) {
    const value = catalogText(status && status.state);
    return [
      "queued",
      "reconcile-required",
      "acquiring-source",
      "converting",
      "verifying-composition"
    ].includes(value);
  }

  function companionAcquisitionStageText(status) {
    const value = catalogText(status && status.state);
    const errorCode = catalogText(status && (status.errorCode || status.error_code));
    if (!value) {
      return "Waiting";
    }
    const labels = {
      queued: "Queued locally",
      "reconcile-required": "Companion reply lost; cancellation will reconcile the operation identity",
      "acquiring-source": "Downloading and verifying the immutable source revision",
      converting: "Converting the model locally",
      "verifying-composition": "Validating the assembled composition receipt",
      available: "Conversion complete; installing in this browser",
      installed: "Installed in this browser",
      cancelled: "Cancelled",
      rejected: errorCode ? `Acquisition rejected (${errorCode})` : "Acquisition rejected"
    };
    if (value === "acquiring-source") {
      const downloaded = Number(status.phaseCompletedBytes);
      const total = Number(status.phaseTotalBytes);
      if (Number.isSafeInteger(downloaded) && Number.isSafeInteger(total) && total > 0) {
        return `Downloading ${formatByteCount(downloaded)} of ${formatByteCount(total)}`;
      }
    }
    return labels[value] || value;
  }

  // Projects bounded companion state into UI controls without asserting unobserved readiness.
  function renderCompanionState() {
    const companion = state.companion;
    const paired = companionIsPaired();
    document.documentElement.dataset.companionState = paired
      ? "paired"
      : companion.connectionState;
    if (el.companionStatus) {
      el.companionStatus.textContent = companion.statusText;
      el.companionStatus.classList.toggle("error", Boolean(companion.statusIsError));
    }
    if (el.companionSeedStatus) {
      el.companionSeedStatus.textContent = companion.seedStatusText;
      el.companionSeedStatus.dataset.state = companion.seedStatus;
      el.companionSeedStatus.dataset.code = companion.seedStatusCode;
    }
    if (el.companionDetectButton) {
      el.companionDetectButton.disabled = companion.connectionState === "checking";
      el.companionDetectButton.textContent = paired
        ? "Check companion"
        : "Enter pairing code";
    }
    if (el.companionForgetButton) {
      el.companionForgetButton.hidden = !paired;
      el.companionForgetButton.disabled = companion.connectionState === "checking";
    }
    if (el.companionPairingControls) {
      el.companionPairingControls.hidden = paired ||
        companion.connectionState !== "pairing";
    }
    const activeStatus = companion.activeStatus;
    const browserInstallFailed = companion.browserInstallState === "failed";
    const showProgress = Boolean(activeStatus);
    if (el.companionImportProgress) {
      el.companionImportProgress.hidden = !showProgress;
    }
    if (el.companionImportProgressBar) {
      if (catalogText(activeStatus && activeStatus.state) === "available") {
        const installTotal = simpleModelCompositionBytes(companion.activeEntry);
        if (companion.streamAbort && installTotal > 0) {
          el.companionImportProgressBar.max = installTotal;
          el.companionImportProgressBar.value = Math.min(
            companion.browserLoadBytes,
            installTotal
          );
        } else {
          el.companionImportProgressBar.removeAttribute("value");
        }
      } else if (
        Number(activeStatus && activeStatus.phaseTotalBytes) > 0 &&
        Number(activeStatus && activeStatus.phaseCompletedBytes) >= 0
      ) {
        el.companionImportProgressBar.max = Number(activeStatus.phaseTotalBytes);
        el.companionImportProgressBar.value = Math.min(
          Number(activeStatus.phaseCompletedBytes),
          Number(activeStatus.phaseTotalBytes)
        );
      } else {
        el.companionImportProgressBar.removeAttribute("value");
      }
    }
    if (el.companionImportStage) {
      const installTotal = simpleModelCompositionBytes(companion.activeEntry) ||
        Number(companion.activeEntry && companion.activeEntry.artifactByteCount);
      const streamText = browserInstallFailed
        ? `Browser install stopped (${companion.browserInstallErrorCode})`
        : catalogText(activeStatus && activeStatus.state) === "available" &&
          companion.browserLoadBytes > 0 && companion.activeEntry
        ? `Saving ${formatByteCount(companion.browserLoadBytes)} of ${formatByteCount(installTotal)} in this browser`
        : companionAcquisitionStageText(activeStatus);
      el.companionImportStage.textContent = streamText;
      el.companionImportStage.classList.toggle(
        "error",
        browserInstallFailed || catalogText(activeStatus && activeStatus.state) === "rejected"
      );
    }
    if (el.companionCancelImportButton) {
      el.companionCancelImportButton.disabled = Boolean(companion.cancelPromise) || !(
        companionAcquisitionIsActive(activeStatus) ||
        companion.streamAbort ||
        directSeedCanStop()
      );
    }
  }

  function setCompanionSeedStatus(status, code, text, operationId = "") {
    if (!["idle", "starting", "ready", "reconciling", "stopping", "stopped", "failed"].includes(status) ||
        !/^(?:none|[a-z][a-z0-9-]{2,63})$/u.test(code)) {
      throw new Error("The local direct seed status was invalid");
    }
    if (operationId) {
      companionSha256(operationId, "Local direct seed display identity");
      state.companion.seedDisplayOperationId = operationId;
    }
    state.companion.seedStatus = status;
    state.companion.seedStatusCode = code;
    state.companion.seedStatusText = text;
    renderCompanionState();
  }

  function directSeedHasPendingRequest() {
    return Array.from(state.companion.seedRecords.values()).some((record) => (
      Boolean(record.startRequest || record.stopRequest || record.stopCustodyRequest)
    ));
  }

  function directSeedCanStop() {
    return Array.from(state.companion.seedRecords.values()).some((record) => (
      ["starting", "ready", "reconcile-required", "stopping"].includes(record.state)
    ));
  }

  function directSeedRecordText(record) {
    const code = record.code || "direct-composition-seed-state-unknown";
    if (record.state === "starting") {
      return "Starting local direct sharing. This is local only; no public reachability or announcement is claimed.";
    }
    if (record.state === "ready") {
      return `Local direct sharing is ready at ${record.projection.boundOrigin}. This is loopback-only; no public reachability or announcement is claimed.`;
    }
    if (record.state === "stopping") {
      return "Stopping the exact local direct seed. The browser model remains installed.";
    }
    if (record.state === "stopped") {
      return `Local direct sharing stopped (${code}). The browser model remains installed; no public reachability or announcement is claimed.`;
    }
    if (record.state === "failed") {
      return `Local direct sharing failed (${code}). The browser model remains installed; no public reachability or announcement is claimed.`;
    }
    return `Local direct sharing requires reconciliation (${code}). The browser model remains installed; no public reachability or announcement is claimed.`;
  }

  function publishDirectSeedRecord(record) {
    const status = record.state === "reconcile-required"
      ? "reconciling"
      : record.state;
    const code = ["starting", "ready"].includes(record.state)
      ? "none"
      : record.code;
    persistDirectCompositionSeedCustody();
    setCompanionSeedStatus(
      status,
      code,
      directSeedRecordText(record),
      record.operationId
    );
  }

  function setCompanionStatus(connectionState, text, isError) {
    state.companion.connectionState = connectionState;
    state.companion.statusText = text;
    state.companion.statusIsError = Boolean(isError);
    renderCompanionState();
  }

  async function runCompanionOperationRequest(companion, startRequest) {
    if (companion.operationRequest) {
      throw new Error("A companion operation request is already pending");
    }
    const pending = Promise.resolve().then(startRequest);
    companion.operationRequest = pending;
    try {
      return await pending;
    } finally {
      if (companion.operationRequest === pending) {
        companion.operationRequest = null;
      }
    }
  }

  function createDirectSeedRecord(operationId, compositionId) {
    return {
      operationId,
      compositionId,
      state: "starting",
      code: "none",
      projection: null,
      startRequest: null,
      readRequest: null,
      stopRequest: null,
      stopCustodyRequest: null,
      stopRequested: false,
      pollCount: 0
    };
  }

  function queueDirectSeedNetworkRequest(record, field, requestFactory) {
    const companion = state.companion;
    const predecessor = companion.seedNetworkTail;
    const request = Promise.resolve(predecessor)
      .catch(() => {})
      .then(requestFactory);
    record[field] = request;
    companion.seedNetworkTail = request.catch(() => {});
    renderCompanionState();
    renderSimpleModelPicker();
    return request.finally(() => {
      if (record[field] === request) {
        record[field] = null;
      }
      renderCompanionState();
      renderSimpleModelPicker();
    });
  }

  function validateDirectSeedProjection(record, projection) {
    if (!projection || projection.operationId !== record.operationId ||
        projection.compositionId !== record.compositionId) {
      throw new companionCapabilityApi.CompanionCapabilityError(
        "direct-composition-seed-identity-drift"
      );
    }
    if (record.projection && projection.sequence < record.projection.sequence) {
      throw new companionCapabilityApi.CompanionCapabilityError(
        "direct-composition-seed-sequence-regression"
      );
    }
    return projection;
  }

  function applyDirectSeedProjection(record, projection) {
    validateDirectSeedProjection(record, projection);
    record.projection = projection;
    record.state = projection.state;
    record.code = projection.terminalCode || "none";
    publishDirectSeedRecord(record);
    if (projection.state === "ready") {
      scheduleDirectSeedMonitor();
    }
    return projection;
  }

  function markDirectSeedReconciliationRequired(record, error) {
    record.state = "reconcile-required";
    record.code = localDirectSeedErrorCode(error);
    publishDirectSeedRecord(record);
    scheduleDirectSeedMonitor();
  }

  function directSeedErrorProvesNoLifecycle(error) {
    return new Set([
      "direct-composition-seed-not-found",
      "direct-composition-seed-not-available",
      "direct-composition-seed-operation-not-available",
      "direct-composition-seed-resource-limit"
    ]).has(localDirectSeedErrorCode(error));
  }

  function directSeedErrorIsNotFound(error) {
    return localDirectSeedErrorCode(error) === "direct-composition-seed-not-found";
  }

  async function stopDirectSeedAfterRead(record, projection) {
    if (!projection || projection.state !== "ready") {
      return projection;
    }
    record.state = "stopping";
    record.code = "direct-composition-seed-stop-requested";
    publishDirectSeedRecord(record);
    try {
      const stopped = await queueDirectSeedNetworkRequest(
        record,
        "stopRequest",
        () => state.companion.client.stopDirectCompositionSeed(record.operationId)
      );
      return applyDirectSeedProjection(record, stopped);
    } catch (error) {
      if (directSeedErrorIsNotFound(error)) {
        record.projection = null;
        record.state = "stopped";
        record.code = localDirectSeedErrorCode(error);
        publishDirectSeedRecord(record);
        return null;
      }
      markDirectSeedReconciliationRequired(record, error);
      return null;
    }
  }

  async function reconcileDirectSeedRecord(record, options = {}) {
    if (!companionIsPaired()) {
      markDirectSeedReconciliationRequired(
        record,
        { code: "direct-composition-seed-companion-reconnect-required" }
      );
      return null;
    }
    try {
      const projection = await queueDirectSeedNetworkRequest(
        record,
        "readRequest",
        () => state.companion.client.readDirectCompositionSeed(record.operationId)
      );
      validateDirectSeedProjection(record, projection);
      if (projection.state === "ready" &&
          (options.stopIfReady === true || record.stopRequested)) {
        record.projection = projection;
        return stopDirectSeedAfterRead(record, projection);
      }
      return applyDirectSeedProjection(record, projection);
    } catch (error) {
      if (directSeedErrorIsNotFound(error)) {
        record.projection = null;
        record.state = record.stopRequested ? "stopped" : "failed";
        record.code = localDirectSeedErrorCode(error);
        state.companion.seedRecords.delete(record.operationId);
        persistDirectCompositionSeedCustody();
        setCompanionSeedStatus(
          record.state,
          record.code,
          directSeedRecordText(record),
          record.operationId
        );
        return null;
      }
      markDirectSeedReconciliationRequired(record, error);
      return null;
    }
  }

  async function requestDirectSeedStop(operationId) {
    const record = state.companion.seedRecords.get(operationId);
    if (!record) {
      return Object.freeze({ confirmed: false, projection: null });
    }
    if (record.stopCustodyRequest) {
      return record.stopCustodyRequest;
    }
    const custody = (async () => {
      record.stopRequested = true;
      persistDirectCompositionSeedCustody();
      if (record.startRequest) {
        try {
          await record.startRequest;
        } catch (_error) {
          // The deterministic operation ID is reconciled below; start is never retried.
        }
      }
      const projection = await reconcileDirectSeedRecord(record, { stopIfReady: true });
      return Object.freeze({
        confirmed: record.state === "stopped" || record.state === "failed",
        projection: projection || record.projection
      });
    })();
    record.stopCustodyRequest = custody;
    renderCompanionState();
    renderSimpleModelPicker();
    try {
      return await custody;
    } finally {
      if (record.stopCustodyRequest === custody) {
        record.stopCustodyRequest = null;
      }
      renderCompanionState();
      renderSimpleModelPicker();
    }
  }

  async function reconcileKnownDirectSeeds() {
    if (!companionIsPaired()) {
      return false;
    }
    const records = Array.from(state.companion.seedRecords.values());
    for (const record of records) {
      record.pollCount = 0;
      await reconcileDirectSeedRecord(record, {
        stopIfReady: record.stopRequested
      });
    }
    scheduleDirectSeedMonitor();
    return true;
  }

  function markKnownDirectSeedsForReconnect(code) {
    const companion = state.companion;
    if (companion.seedMonitorTimer !== null) {
      window.clearTimeout(companion.seedMonitorTimer);
      companion.seedMonitorTimer = null;
    }
    companion.seedMonitorSequence += 1;
    let latest = null;
    for (const record of companion.seedRecords.values()) {
      if (["stopped", "failed"].includes(record.state)) {
        continue;
      }
      record.state = "reconcile-required";
      record.code = code;
      record.pollCount = 0;
      latest = record;
    }
    persistDirectCompositionSeedCustody();
    if (latest) {
      setCompanionSeedStatus(
        "reconciling",
        code,
        directSeedRecordText(latest),
        latest.operationId
      );
    }
  }

  function scheduleDirectSeedMonitor() {
    const companion = state.companion;
    if (companion.seedMonitorTimer !== null) {
      window.clearTimeout(companion.seedMonitorTimer);
      companion.seedMonitorTimer = null;
    }
    const hasPendingObservation = companionIsPaired() &&
      Array.from(companion.seedRecords.values()).some((record) => (
        ["ready", "reconcile-required"].includes(record.state) &&
        record.pollCount < maximumDirectCompositionSeedPolls
      ));
    if (!hasPendingObservation) {
      return;
    }
    const sequence = companion.seedMonitorSequence + 1;
    companion.seedMonitorSequence = sequence;
    companion.seedMonitorTimer = window.setTimeout(() => {
      companion.seedMonitorTimer = null;
      void pollDirectSeedRecords(sequence);
    }, directCompositionSeedPollIntervalMs);
  }

  async function pollDirectSeedRecords(sequence) {
    const companion = state.companion;
    if (sequence !== companion.seedMonitorSequence || !companionIsPaired()) {
      return;
    }
    if (companion.operationRequest || state.modelAcquisitionCommand) {
      scheduleDirectSeedMonitor();
      return;
    }
    for (const record of companion.seedRecords.values()) {
      if (!["ready", "reconcile-required"].includes(record.state)) {
        continue;
      }
      if (record.pollCount >= maximumDirectCompositionSeedPolls) {
        record.state = "reconcile-required";
        record.code = "direct-composition-seed-observation-bound";
        publishDirectSeedRecord(record);
        continue;
      }
      record.pollCount += 1;
      await reconcileDirectSeedRecord(record, {
        stopIfReady: record.stopRequested
      });
    }
    scheduleDirectSeedMonitor();
  }

  async function settleCompanionCancellation(companion, pendingRequest, paired) {
    let status = companion.activeStatus;
    let operationId = catalogText(companion.activeOperationId);
    let requestError = null;
    if (pendingRequest) {
      try {
        status = await pendingRequest;
      } catch (error) {
        requestError = error;
      } finally {
        if (companion.operationRequest === pendingRequest) {
          companion.operationRequest = null;
        }
      }
      if (!requestError) {
        const pendingOperationId = catalogText(status && status.operationId);
        if (operationId && pendingOperationId && operationId !== pendingOperationId) {
          return Object.freeze({
            confirmed: false,
            status,
            operationId,
            error: new Error("The companion operation identity changed during cancellation")
          });
        }
        operationId = pendingOperationId || operationId;
      }
    }
    if (!operationId) {
      return Object.freeze({ confirmed: false, status, operationId, error: requestError });
    }
    let remoteState = catalogText(status && status.state);
    if (requestError || remoteState === "reconcile-required") {
      if (!paired) {
        return Object.freeze({ confirmed: false, status, operationId, error: requestError });
      }
      try {
        const reconciled = await runCompanionOperationRequest(
          companion,
          () => companion.client.getOperation(operationId)
        );
        const reconciledOperationId = catalogText(reconciled && reconciled.operationId);
        if (reconciledOperationId !== operationId) {
          throw new Error("The companion operation identity changed during reconciliation");
        }
        status = reconciled;
        remoteState = catalogText(status && status.state);
      } catch (error) {
        return Object.freeze({ confirmed: false, status, operationId, error });
      }
    }
    if (["available", "cancelled"].includes(remoteState)) {
      return Object.freeze({ confirmed: true, status, operationId, error: null });
    }
    if (remoteState === "rejected") {
      return Object.freeze({
        confirmed: false,
        status,
        operationId,
        error: new Error("The companion rejected the operation before cancellation completed")
      });
    }
    if (!paired) {
      return Object.freeze({ confirmed: false, status, operationId, error: null });
    }
    try {
      const cancelled = await runCompanionOperationRequest(
        companion,
        () => companion.client.cancelOperation(operationId)
      );
      const cancelledOperationId = catalogText(cancelled && cancelled.operationId);
      const confirmed = catalogText(cancelled && cancelled.state) === "cancelled" &&
        (!cancelledOperationId || cancelledOperationId === operationId);
      return Object.freeze({
        confirmed,
        status: cancelled,
        operationId,
        error: null
      });
    } catch (error) {
      return Object.freeze({ confirmed: false, status, operationId, error });
    }
  }

  function setCompanionAcquisitionTerminal(terminalState) {
    if (terminalState !== "installed" && terminalState !== "cancelled") {
      throw new Error("The companion acquisition terminal state was invalid");
    }
    state.companion.activeStatus = Object.freeze({
      state: terminalState,
      errorCode: null
    });
    state.companion.browserLoadBytes = 0;
    renderCompanionState();
  }

  async function refreshCompanionActiveAcquisition() {
    const companion = state.companion;
    if (["installed", "cancelled"].includes(
      catalogText(companion.activeStatus && companion.activeStatus.state)
    )) {
      return companion.activeStatus;
    }
    const operationId = catalogText(companion.activeOperationId);
    if (!operationId) {
      return null;
    }
    if (companion.operationRequest) {
      return companion.activeStatus;
    }
    const sequence = companion.pollSequence;
    try {
      const status = await runCompanionOperationRequest(
        companion,
        () => companion.client.getOperation(operationId)
      );
      if (sequence !== companion.pollSequence ||
          operationId !== catalogText(companion.activeOperationId)) {
        return null;
      }
      companion.activeStatus = status;
      renderCompanionState();
      return status;
    } catch (error) {
      if (sequence !== companion.pollSequence ||
          operationId !== catalogText(companion.activeOperationId)) {
        return null;
      }
      if (
        error &&
        error.code === "operation-not-found"
      ) {
        companion.activeOperationId = "";
        companion.activeOperationKind = "";
        companion.activeStatus = null;
        renderCompanionState();
        return null;
      }
      throw error;
    }
  }

  async function refreshCompanionRuntime() {
    const companion = state.companion;
    const runtime = await companion.client.status();
    companion.runtime = runtime;
    await refreshCompanionActiveAcquisition();
    await reconcileKnownDirectSeeds();
    setCompanionStatus(
      "paired",
      "Desktop companion connected",
      false
    );
    return runtime;
  }

  async function detectCompanion() {
    const companion = state.companion;
    if (!companion.client) {
      setCompanionStatus("unsupported", "Desktop companion integration unavailable", true);
      return false;
    }
    if (companionIsPaired()) {
      setCompanionStatus("checking", "Checking the desktop companion", false);
      try {
        await refreshCompanionRuntime();
        return true;
      } catch (error) {
        markKnownDirectSeedsForReconnect(
          "direct-composition-seed-companion-reconnect-required"
        );
        setCompanionStatus("disconnected", friendlyError(errorMessage(error)), true);
        return false;
      }
    }
    setCompanionStatus("pairing", "Enter the one-time code shown by the desktop companion", false);
    if (el.companionPairingCode) {
      el.companionPairingCode.focus();
    }
    return false;
  }

  async function pairCompanion() {
    const companion = state.companion;
    const code = el.companionPairingCode
      ? String(el.companionPairingCode.value || "").trim()
      : "";
    if (!code) {
      setCompanionStatus("detected", "Enter the one-time pairing code", true);
      if (el.companionPairingCode) {
        el.companionPairingCode.focus();
      }
      return false;
    }
    try {
      companion.pollSequence += 1;
      await companion.client.pair(code);
      if (el.companionPairingCode) {
        el.companionPairingCode.value = "";
      }
      setCompanionStatus("paired", "Desktop companion connected", false);
      await refreshCompanionRuntime();
      refreshPeerAvailabilityViews();
      await resumePendingCompanionAcquisition();
      return true;
    } catch (error) {
      markKnownDirectSeedsForReconnect(
        "direct-composition-seed-companion-reconnect-required"
      );
      setCompanionStatus("pairing", friendlyError(errorMessage(error)), true);
      return false;
    }
  }

  function clearCompanionSessionView() {
    const companion = state.companion;
    companion.pollSequence += 1;
    if (companion.streamAbort) {
      companion.streamAbort.abort();
      companion.streamAbort = null;
    }
    companion.runtime = null;
    companion.activeOperationId = "";
    companion.activeOperationKind = "";
    companion.activeStatus = null;
    companion.activeEntry = null;
    companion.browserLoadBytes = 0;
    markKnownDirectSeedsForReconnect(
      "direct-composition-seed-companion-reconnect-required"
    );
  }

  async function forgetCompanionPairing() {
    const companion = state.companion;
    if (!companion.client || !companionIsPaired()) {
      clearCompanionSessionView();
      setCompanionStatus("disconnected", "Pair this browser to use the companion", false);
      refreshPeerAvailabilityViews();
      return false;
    }
    setCompanionStatus("checking", "Revoking this browser pairing", false);
    try {
      await companion.client.revoke();
      clearCompanionSessionView();
      setCompanionStatus("disconnected", "Pairing revoked; this browser no longer controls the companion", false);
      refreshPeerAvailabilityViews();
      return true;
    } catch (error) {
      clearCompanionSessionView();
      setCompanionStatus(
        "disconnected",
        `Pairing cleared in this browser; companion confirmation failed: ${friendlyError(errorMessage(error))}`,
        true
      );
      refreshPeerAvailabilityViews();
      return false;
    }
  }

  // Records one pending command and moves focus into pairing when companion trust is absent.
  function requireCompanionForAcquisition(entry, kind) {
    if (companionIsPaired()) {
      return true;
    }
    const compositionId = entry && entry.composition && entry.composition.compositionId;
    if (!compositionId) {
      setSimpleModelPickerStatus("The selected model no longer has a current catalog identity.", true);
      return false;
    }
    rememberPendingCompanionAcquisition(entry, kind);
    holdModelPopoverOpen(5000);
    if (el.simpleCompanionPairing) {
      el.simpleCompanionPairing.hidden = false;
    }
    setSimpleModelPickerStatus(
      "Open the installed desktop companion and enter its one-time code.",
      false
    );
    scheduleSimpleCompanionPairingFocus();
    return false;
  }

  async function resumePendingCompanionAcquisition() {
    const pending = state.companion.pendingAcquisition;
    if (!pending || !companionIsPaired()) {
      return false;
    }
    const currentEntry = state.modelCatalogV1Entries.find((entry) => (
      entry.composition.compositionId === pending.compositionId
    ));
    const route = currentEntry ? resolveCurrentSimpleModelRoute(currentEntry) : null;
    if (!route || route.kind !== simpleModelRouteKinds.SUPPORTED_LOCAL_CONVERSION) {
      clearPendingCompanionAcquisition();
      setSimpleModelPickerStatus(
        "The selected model changed while the companion was connecting. Select a current model.",
        true
      );
      return false;
    }
    clearPendingCompanionAcquisition();
    return requestSimpleModelAcquisition(route.entry);
  }

  // Imports only the preselected announced route and keeps progress out of repeated live speech.
  async function startCompanionImport(entry) {
    const displayName = entry.displayName || entry.modelId || "selected model";
    setSimpleModelPickerStatus(
      `Preparing ${displayName} from P2P...`,
      false
    );
    setText(el.modelState, "loading qualification record", false);
    if (state.activeAcquisitionAbort) {
      state.activeAcquisitionAbort.abort();
    }
    const controller = new AbortController();
    state.activeAcquisitionAbort = controller;
    renderSimpleModelPicker();
    try {
      const admissionRecord = await loadCatalogAdmission(entry, controller.signal);
      requireCurrentCatalogAdmission(entry, admissionRecord.admission);
      await ensureBrowserRuntimeAsset(controller.signal);
      throwIfAcquisitionAborted(controller.signal);
      requireCurrentCatalogAdmission(entry, admissionRecord.admission);
      assertAdmissionRuntime(admissionRecord.admission);
      setSimpleModelPickerStatus(
        `Downloading and verifying ${displayName} directly from the selected peer...`,
        false
      );
      setText(el.modelState, "direct P2P download", false);
      const p2pPieceSetSha256 = entry.peers[0].pieceSetSha256;
      const manifest = modelStoreManifest(admissionRecord, p2pPieceSetSha256);
      const admissionAuthority = modelStoreAdmissionAuthority(
        admissionRecord,
        p2pPieceSetSha256
      );
      const store = workerActivationStoreAdapter(
        await compositionStoreForInstall(controller.signal),
        `${displayName} is saved in this browser and ready.`,
        controller.signal,
        admissionAuthority
      );
      await p2pCompositionInstallApi.installP2pComposition({
        entry,
        admissionRecord,
        manifest,
        admissionAuthority,
        store,
        signal: controller.signal,
        fetch: window.fetch.bind(window),
        onProgress(progress) {
          const percent = Math.floor(
            (progress.completedBytes / progress.totalBytes) * 100
          );
          setSimpleModelPickerStatus(
            `Saving ${displayName} in this browser / ${percent}%`,
            false,
            { announce: false }
          );
          setText(el.modelState, `${progress.memberName} ${percent}%`, false);
        }
      });
      toggleModelPopover(false, null, true);
      return true;
    } catch (error) {
      latchRecoverableCompositionStoreError(error);
      if (controller.signal.aborted ||
          (error && error.code === "p2p-composition-install-aborted")) {
        setSimpleModelPickerStatus("Model acquisition cancelled.", false);
        setText(el.modelState, "P2P install cancelled", false);
        return false;
      }
      const detail = friendlyError(errorMessage(error));
      const recoveryAvailable = rememberSimpleModelConversionRecovery(entry, error);
      setSimpleModelPickerStatus(
        recoveryAvailable
          ? `P2P download stopped. Select ${displayName} again to prepare it on this device.`
          : `P2P install stopped: ${detail}`,
        true
      );
      setText(el.modelState, "P2P install stopped", true);
      setText(
        el.errorState,
        `${detail} (${catalogText(error && error.code) || "p2p-install-failed"})`,
        true
      );
      appendConsole(
        `P2P install stopped (${catalogText(error && error.code) || "p2p-install-failed"}): ${detail}`
      );
      return false;
    } finally {
      if (state.activeAcquisitionAbort === controller) {
        state.activeAcquisitionAbort = null;
      }
      renderSimpleModelPicker();
    }
  }

  function companionSha256(value, label) {
    const digest = catalogText(value).toLowerCase().replace(/^sha256:/, "");
    if (!/^[0-9a-f]{64}$/.test(digest)) {
      throw new Error(`${label} SHA-256 was invalid`);
    }
    return digest;
  }

  function randomAttemptId() {
    if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== "function") {
      throw new Error("Secure browser randomness is unavailable");
    }
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  function sourceAcquireRequest(entry) {
    if (!companionCapabilityApi) {
      throw new Error("Desktop companion capability is unavailable");
    }
    const source = companionCapabilityApi.SOURCE_DESCRIPTOR;
    const repository = catalogText(entry && entry.source && entry.source.repository);
    const revision = catalogText(entry && entry.source && entry.source.revision);
    if (repository !== source.sourceRepository) {
      throw new Error("The selected source is not supported by this companion release");
    }
    if (revision !== source.sourceRevision) {
      throw new Error("The selected source revision is not supported by this companion release");
    }
    return {
      schema: companionCapabilityApi.SCHEMAS.acquire,
      attemptId: randomAttemptId(),
      route: "source",
      modelId: source.modelId,
      sourceRepository: source.sourceRepository,
      sourceRevision: source.sourceRevision,
      modelSourceLockSha256: source.modelSourceLockSha256,
      tokenizerSourceLockSha256: source.tokenizerSourceLockSha256,
      compositionProfileSha256: source.compositionProfileSha256,
      sourceAcquisitionApproved: true,
      maximumSourceBytes: source.maximumSourceBytes
    };
  }

  function localDirectSeedErrorCode(error) {
    const code = error && typeof error.code === "string" ? error.code : "";
    return /^[a-z][a-z0-9-]{2,63}$/u.test(code)
      ? code
      : "direct-composition-seed-client-failure";
  }

  // Starts only the companion-owned loopback seed; it never claims announcement or reachability.
  async function requestLocalDirectSeed(entry, operationStatus, sequence, signal) {
    const companion = state.companion;
    let operationId = "";
    let record = null;
    let createdRecord = false;
    try {
      operationId = companionSha256(
        operationStatus && operationStatus.operationId,
        "Local direct seed operation identity"
      );
      const compositionId = catalogText(
        entry && entry.composition && entry.composition.compositionId
      );
      if (!/^sha256:[0-9a-f]{64}$/u.test(compositionId)) {
        throw new Error("Local direct seed composition identity was invalid");
      }
      record = companion.seedRecords.get(operationId) || null;
      if (record && record.compositionId !== compositionId) {
        throw new companionCapabilityApi.CompanionCapabilityError(
          "direct-composition-seed-identity-drift"
        );
      }

      if (record) {
        if (record.startRequest) {
          try {
            await record.startRequest;
          } catch (_error) {
            // Reconcile the deterministic identity below; never issue another start.
          }
        }
        const stale = sequence !== companion.pollSequence || signal.aborted ||
          companion.activeOperationId !== operationId;
        if (stale) {
          record.stopRequested = true;
          persistDirectCompositionSeedCustody();
          await requestDirectSeedStop(operationId);
          return false;
        }
        const existing = await reconcileDirectSeedRecord(record, {
          stopIfReady: record.stopRequested
        });
        return Boolean(existing && existing.state === "ready" && !record.stopRequested);
      }

      if (companion.seedRecords.size >= maximumDirectCompositionSeedLifecycles) {
        throw new companionCapabilityApi.CompanionCapabilityError(
          "direct-composition-seed-resource-limit"
        );
      }

      record = createDirectSeedRecord(operationId, compositionId);
      companion.seedRecords.set(operationId, record);
      createdRecord = true;
      publishDirectSeedRecord(record);
      let projection;
      try {
        projection = await queueDirectSeedNetworkRequest(
          record,
          "startRequest",
          () => companion.client.startDirectCompositionSeed(operationId, signal)
        );
      } catch (error) {
        const stale = sequence !== companion.pollSequence || signal.aborted ||
          companion.activeOperationId !== operationId;
        if (directSeedErrorProvesNoLifecycle(error)) {
          if (companion.seedRecords.get(operationId) === record) {
            companion.seedRecords.delete(operationId);
            persistDirectCompositionSeedCustody();
          }
          const code = localDirectSeedErrorCode(error);
          setCompanionSeedStatus(
            "failed",
            code,
            `Local direct sharing is unavailable (${code}). The model remains installed; no public reachability or announcement is claimed.`
          );
          appendConsole(`local direct seed unavailable: ${code}`);
          return false;
        }
        markDirectSeedReconciliationRequired(record, error);
        if (stale) {
          record.stopRequested = true;
          persistDirectCompositionSeedCustody();
          await requestDirectSeedStop(operationId);
          return false;
        }
        const reconciled = await reconcileDirectSeedRecord(record);
        return Boolean(reconciled && reconciled.state === "ready");
      }

      validateDirectSeedProjection(record, projection);
      const stale = sequence !== companion.pollSequence || signal.aborted ||
        companion.activeOperationId !== operationId;
      if (stale) {
        record.stopRequested = true;
        record.state = "reconcile-required";
        record.code = "direct-composition-seed-cancel-reconciliation";
        persistDirectCompositionSeedCustody();
        publishDirectSeedRecord(record);
        await requestDirectSeedStop(operationId);
        return false;
      }
      applyDirectSeedProjection(record, projection);
      return projection.state === "ready";
    } catch (error) {
      if (record && createdRecord &&
          directSeedErrorProvesNoLifecycle(error) &&
          companion.seedRecords.get(operationId) === record) {
        companion.seedRecords.delete(operationId);
        persistDirectCompositionSeedCustody();
      }
      if (record && (sequence !== companion.pollSequence || signal.aborted)) {
        record.stopRequested = true;
        persistDirectCompositionSeedCustody();
        await requestDirectSeedStop(operationId);
        return false;
      }
      if (record && createdRecord) {
        markDirectSeedReconciliationRequired(record, error);
        const reconciled = await reconcileDirectSeedRecord(record);
        return Boolean(reconciled && reconciled.state === "ready");
      }
      const code = localDirectSeedErrorCode(error);
      setCompanionSeedStatus(
        "failed",
        code,
        `Local direct sharing is unavailable (${code}). The model remains installed; no public reachability or announcement is claimed.`
      );
      appendConsole(`local direct seed unavailable: ${code}`);
      return false;
    }
  }

  async function startCompanionConversion(entry) {
    const companion = state.companion;
    try {
      requireCurrentCatalogEntry(entry);
    } catch (error) {
      setSimpleModelPickerStatus(errorMessage(error), true);
      return false;
    }
    if (!requireCompanionForAcquisition(entry, "conversion")) {
      return false;
    }
    const sequence = companion.pollSequence + 1;
    companion.pollSequence = sequence;
    companion.activeOperationId = "";
    companion.activeOperationKind = "source";
    companion.activeEntry = entry;
    companion.activeStatus = { state: "queued" };
    companion.browserLoadBytes = 0;
    companion.browserInstallState = "idle";
    companion.browserInstallErrorCode = "none";
    const displayName = entry.displayName || entry.modelId || "selected model";
    setHfStatus(`Preparing the immutable ${displayName} source`, false);
    setSimpleModelPickerStatus(`Preparing ${displayName}...`, false);
    renderCompanionState();
    renderSimpleModelPicker();
    let createSubmitted = false;
    let createResponseObserved = false;
    try {
      const request = sourceAcquireRequest(entry);
      const expectedOperationId = await companionCapabilityApi.computeOperationId(request);
      if (sequence !== companion.pollSequence) {
        return false;
      }
      companion.activeOperationId = companionSha256(
        expectedOperationId,
        "Companion operation identity"
      );
      companion.activeStatus = {
        operationId: companion.activeOperationId,
        state: "queued"
      };
      renderCompanionState();
      setHfStatus(
        `Getting ${displayName} from revision ${request.sourceRevision.slice(0, 12)}`,
        false
      );
      createSubmitted = true;
      let status = await runCompanionOperationRequest(
        companion,
        () => companion.client.createOperation(request)
      );
      createResponseObserved = true;
      if (sequence !== companion.pollSequence) {
        return false;
      }
      if (catalogText(status.operationId) !== companion.activeOperationId) {
        throw new Error("The companion returned a different operation identity");
      }
      companion.activeOperationKind = "source";
      companion.activeStatus = status;
      renderCompanionState();
      while (sequence === companion.pollSequence) {
        const conversionState = catalogText(status.state);
        if (conversionState === "available") {
          return await prepareCompanionConvertedModel(entry, status, sequence);
        }
        if (conversionState === "rejected" || conversionState === "cancelled") {
          const code = catalogText(status.errorCode) || conversionState;
          setHfStatus(`Local acquisition ${conversionState} (${code})`, true);
          setSimpleModelPickerStatus(
            basicModelAcquisitionFailureMessage(conversionState, code),
            true
          );
          setCompanionStatus("paired", `Model acquisition ${conversionState}: ${code}`, true);
          renderSimpleModelPicker();
          return false;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        if (sequence !== companion.pollSequence) {
          return false;
        }
        const polled = await runCompanionOperationRequest(
          companion,
          () => companion.client.getOperation(companion.activeOperationId)
        );
        if (sequence !== companion.pollSequence) {
          return false;
        }
        const polledOperationId = catalogText(polled && polled.operationId);
        if (polledOperationId && polledOperationId !== companion.activeOperationId) {
          throw new Error("The companion operation identity changed while polling");
        }
        status = polled;
        companion.activeStatus = status;
        renderCompanionState();
        renderSimpleModelPicker();
      }
      return false;
    } catch (error) {
      latchRecoverableCompositionStoreError(error);
      if (sequence === companion.pollSequence) {
        const detail = errorMessage(error);
        if (createSubmitted && companion.activeOperationId) {
          const responseCode = createResponseObserved ? "poll-response-lost" : "create-response-lost";
          const responseLabel = createResponseObserved ? "Status response" : "Create response";
          companion.activeStatus = {
            operationId: companion.activeOperationId,
            state: "reconcile-required",
            errorCode: responseCode
          };
          setHfStatus(
            `${responseLabel} lost (${responseCode}). Cancel will reconcile the known operation identity without retrying.`,
            true
          );
          setSimpleModelPickerStatus(
            basicModelAcquisitionFailureMessage("reconcile-required", responseCode),
            true
          );
          setCompanionStatus(
            "paired",
            `${responseLabel} lost (${responseCode}); operation identity retained for reconciliation`,
            true
          );
          appendConsole(`companion operation unresolved (${catalogText(error && error.code) || responseCode}): ${detail}`);
          renderCompanionState();
          renderSimpleModelPicker();
          return false;
        }
        const code = catalogText(error && error.code) || "companion-operation-failed";
        companion.activeStatus = {
          state: "rejected",
          errorCode: code
        };
        const friendlyDetail = friendlyError(detail);
        setHfStatus(`${friendlyDetail} (${code})`, true);
        setSimpleModelPickerStatus(basicModelAcquisitionFailureMessage("rejected", code), true);
        setText(el.errorState, detail, true);
        appendConsole(`companion conversion rejected (${code}): ${detail}`);
        setCompanionStatus("paired", `${friendlyDetail} (${code})`, true);
        renderCompanionState();
        renderSimpleModelPicker();
      }
      return false;
    }
  }

  // Verifies and installs one completed conversion while rejecting stale poll sequences.
  async function prepareCompanionConvertedModel(entry, status, sequence) {
    if (sequence !== state.companion.pollSequence) return false;
    const displayName = entry.displayName || entry.modelId || "selected model";
    state.companion.browserInstallState = "installing";
    state.companion.browserInstallErrorCode = "none";
    setHfStatus(`Loading the qualification record for ${displayName}`, false);
    setSimpleModelPickerStatus(`Verifying ${displayName} before browser install...`, false);
    if (state.activeAcquisitionAbort) {
      state.activeAcquisitionAbort.abort();
    }
    const controller = new AbortController();
    state.activeAcquisitionAbort = controller;
    renderSimpleModelPicker();
    try {
      const admissionRecord = await loadCatalogAdmission(entry, controller.signal);
      requireCurrentCatalogAdmission(entry, admissionRecord.admission);
      if (sequence !== state.companion.pollSequence) return false;
      await ensureBrowserRuntimeAsset(controller.signal);
      throwIfAcquisitionAborted(controller.signal);
      if (sequence !== state.companion.pollSequence) return false;
      requireCurrentCatalogAdmission(entry, admissionRecord.admission);
      assertAdmissionRuntime(admissionRecord.admission);
      state.companion.streamAbort = controller;
      renderSimpleModelPicker();
      const manifest = modelStoreManifest(admissionRecord);
      const admissionAuthority = modelStoreAdmissionAuthority(admissionRecord);
      const store = workerActivationStoreAdapter(
        await compositionStoreForInstall(controller.signal),
        `${displayName} is saved in this browser and ready.`,
        controller.signal,
        admissionAuthority
      );
      await companionCompositionInstallApi
        .installCompanionComposition({
          client: state.companion.client,
          store,
          projection: status,
          admission: admissionRecord.admission,
          manifest,
          admissionAuthority,
          signal: controller.signal,
          onProgress(progress) {
            if (sequence !== state.companion.pollSequence) {
              controller.abort();
              return;
            }
            state.companion.browserLoadBytes = progress.completedBytes;
            const percent = Math.floor(
              (progress.completedBytes / progress.totalBytes) * 100
            );
            setHfStatus(`Saving ${displayName} in this browser (${percent}%)`, false);
            setSimpleModelPickerStatus(
              `Saving ${displayName} in this browser / ${percent}%`,
              false,
              { announce: false }
            );
            renderCompanionState();
          }
        });
      const cancelledAfterCommit = sequence !== state.companion.pollSequence || controller.signal.aborted;
      if (cancelledAfterCommit && (state.activeAcquisitionAbort !== controller ||
          state.companion.activeOperationId !== status.operationId)) {
        return false;
      }
      // A successful store result is already committed, even when Cancel raced its pointer write.
      state.companion.browserInstallState = "installed";
      state.companion.browserInstallErrorCode = "none";
      setCompanionAcquisitionTerminal("installed");
      setHfStatus(`${displayName} is saved in this browser and ready`, false);
      setCompanionStatus("paired", `${displayName} installed successfully`, false);
      if (cancelledAfterCommit) {
        setSimpleModelPickerStatus(`${displayName} is saved in this browser and ready.`, false);
        return true;
      }
      const sharingStarted = await requestLocalDirectSeed(
        entry,
        status,
        sequence,
        controller.signal
      );
      if (sequence !== state.companion.pollSequence || controller.signal.aborted) {
        return false;
      }
      setSimpleModelPickerStatus(
        sharingStarted
          ? `${displayName} is ready. Local sharing on this device is on.`
          : `${displayName} is ready. Local sharing on this device did not start.`,
        false
      );
      toggleModelPopover(false, null, true);
      return true;
    } catch (error) {
      latchRecoverableCompositionStoreError(error);
      if (sequence !== state.companion.pollSequence) return false;
      const rawCode = catalogText(error && error.code);
      const code = /^[a-z][a-z0-9-]{2,63}$/u.test(rawCode)
        ? rawCode
        : "browser-install-failed";
      const detail = friendlyError(errorMessage(error));
      state.companion.browserInstallState = "failed";
      state.companion.browserInstallErrorCode = code;
      state.companion.browserLoadBytes = 0;
      setHfStatus(`Browser install stopped: ${detail}`, true);
      setSimpleModelPickerStatus(`Browser install stopped: ${detail}`, true);
      setText(el.modelState, "browser install stopped", true);
      setText(el.errorState, errorMessage(error), true);
      setCompanionStatus("paired", `Browser install stopped: ${detail}`, true);
      appendConsole(`browser install stopped: ${errorMessage(error)}`);
      return false;
    } finally {
      if (state.activeAcquisitionAbort === controller) {
        state.activeAcquisitionAbort = null;
      }
      if (state.companion.streamAbort === controller) {
        state.companion.streamAbort = null;
      }
      renderCompanionState();
      renderSimpleModelPicker();
    }
  }

  async function getHfModel(entry) {
    const view = hfResultView(entry);
    if (view.p2pMatch && canStartP2pImport(view.p2pMatch)) {
      return requestSimpleModelAcquisition(view.p2pMatch);
    }
    if (!hfCanStartConversion(view)) {
      setHfStatus("No signed P2P listing or supported immutable conversion source is available", true);
      return false;
    }
    return requestSimpleModelAcquisition(view.localConversionMatch);
  }

  async function startCompanionAcquisition(entry, routeKind) {
    if (routeKind === simpleModelRouteKinds.QUALIFIED_P2P) {
      return startCompanionImport(entry);
    }
    if (routeKind === simpleModelRouteKinds.SUPPORTED_LOCAL_CONVERSION) {
      return startCompanionConversion(entry);
    }
    setSimpleModelPickerStatus("The selected model route is no longer actionable.", true);
    return false;
  }

  async function cancelCompanionImportInternal() {
    const companion = state.companion;
    const pendingRequest = companion.operationRequest;
    const browserInstallCommand = companion.browserInstallState === "installing"
      ? state.modelAcquisitionCommand
      : null;
    const browserInstallComplete = catalogText(
      companion.activeStatus && companion.activeStatus.state
    ) === "installed";
    const p2pAcquisition = state.modelAcquisitionRoute === "p2p";
    const remoteAcquisition = !browserInstallComplete && (
      state.modelAcquisitionRoute === "companion" ||
      Boolean(pendingRequest) ||
      companionAcquisitionIsActive(companion.activeStatus) ||
      Boolean(companion.streamAbort && companion.activeOperationKind === "source")
    );
    const activeSeedOperationId = catalogText(companion.activeOperationId);
    const seedOperationId = p2pAcquisition
      ? ""
      : browserInstallComplete &&
        companion.seedRecords.has(activeSeedOperationId)
      ? activeSeedOperationId
      : !remoteAcquisition
        ? catalogText(companion.seedDisplayOperationId)
        : "";
    const seedRecord = seedOperationId
      ? companion.seedRecords.get(seedOperationId) || null
      : null;
    const seedCancellationRequested = Boolean(
      seedRecord && ["starting", "ready", "reconcile-required", "stopping"]
        .includes(seedRecord.state)
    );
    companion.pollSequence += 1;
    if (state.activeAcquisitionAbort) {
      state.activeAcquisitionAbort.abort();
    }
    if (companion.streamAbort) {
      companion.streamAbort.abort();
      companion.streamAbort = null;
    }
    cancelActiveModelActivation();

    const seedOutcome = seedCancellationRequested
      ? await requestDirectSeedStop(seedOperationId)
      : null;

    if (browserInstallComplete || (seedCancellationRequested && !remoteAcquisition)) {
      setHfStatus("The model remains installed; local direct sharing was cancelled", false);
      setSimpleModelPickerStatus(
        seedOutcome && seedOutcome.confirmed
          ? "The model is installed and ready. Local direct sharing stopped."
          : "The model is installed and ready. Local direct sharing will be reconciled after reconnect.",
        false
      );
      setCompanionStatus(
        companionIsPaired() ? "paired" : "disconnected",
        companionIsPaired()
          ? "The model remains installed in this browser"
          : "The model remains installed; the companion connection closed",
        false
      );
      companion.browserLoadBytes = 0;
      renderSimpleModelPicker();
      return Boolean(!seedOutcome || seedOutcome.confirmed);
    }

    let confirmed = true;
    if (remoteAcquisition) {
      // No request can be submitted before the deterministic operation ID has been recorded.
      const sourceNotSubmitted = !pendingRequest && !companion.activeOperationId &&
        companion.activeOperationKind === "source" &&
        catalogText(companion.activeStatus && companion.activeStatus.state) === "queued";
      const outcome = sourceNotSubmitted
        ? { confirmed: true }
        : await settleCompanionCancellation(
          companion,
          pendingRequest,
          companionIsPaired()
        );
      if (browserInstallCommand) {
        const committed = await Promise.resolve(browserInstallCommand).catch(() => false);
        if (committed && companion.browserInstallState === "installed") return true;
      }
      confirmed = outcome.confirmed;
      if (confirmed) {
        setCompanionAcquisitionTerminal("cancelled");
        setHfStatus("Model acquisition cancelled", false);
        setSimpleModelPickerStatus("Model acquisition cancelled.", false);
        setText(el.modelState, "model acquisition cancelled", false);
        setCompanionStatus("paired", "Model acquisition cancelled", false);
      } else {
        if (outcome.status) {
          companion.activeStatus = outcome.status;
        }
        const detail = outcome.error
          ? friendlyError(errorMessage(outcome.error))
          : "Cancellation could not be confirmed; the companion operation may still be running.";
        setSimpleModelPickerStatus(detail, true);
        setCompanionStatus("paired", detail, true);
      }
    }
    companion.browserLoadBytes = 0;
    renderCompanionState();
    renderSimpleModelPicker();
    return confirmed;
  }

  async function cancelCompanionImport() {
    const companion = state.companion;
    if (companion.cancelPromise) {
      return companion.cancelPromise;
    }
    const cancellation = cancelCompanionImportInternal();
    companion.cancelPromise = cancellation;
    try {
      return await cancellation;
    } finally {
      if (companion.cancelPromise === cancellation) {
        companion.cancelPromise = null;
      }
      renderCompanionState();
      renderSimpleModelPicker();
    }
  }

  function collapseSidebar(collapsed) {
    if (!el.appShell) {
      return;
    }
    el.appShell.dataset.sidebarCollapsed = String(Boolean(collapsed));
    const button = document.getElementById("sidebarCollapseButton");
    if (button) {
      button.setAttribute("aria-expanded", String(!collapsed));
      button.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
      button.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
    }
    storageSet(uiStorageKeys.sidebarCollapsed, String(Boolean(collapsed)));
  }

  // Reveals Advanced and focuses its top-level model-source disclosure after layout settles.
  function openSidebarAdvancedTools() {
    state.initialModelChooserAutoPresentSuppressed = true;
    setAppMode("advanced");
    setRailCollapsed(false);
    toggleModelPopover(false);
    const drawer = document.querySelector('[data-panel-key="dashboard-model-source"]')
      || document.getElementById("advancedOptionsTitle");
    if (drawer && "open" in drawer) {
      drawer.open = true;
    }
    if (drawer && typeof drawer.scrollIntoView === "function") {
      drawer.scrollIntoView({ block: "nearest" });
    }
    const focusTarget = drawer && typeof drawer.querySelector === "function"
      ? drawer.querySelector("summary") || el.diagnosticsRailToggle
      : el.diagnosticsRailToggle;
    window.requestAnimationFrame(() => {
      if (focusTarget && typeof focusTarget.focus === "function") {
        focusTarget.focus();
      }
    });
  }

  function useStarterPrompt(button) {
    const template = button ? button.dataset.promptTemplate : "";
    if (!template || !el.prompt) {
      return false;
    }
    const starter = button.dataset.starter || "";
    markStarterSelected(starter);
    if (starterGenerationPresets[starter]) {
      applyGenerationPreset(starterGenerationPresets[starter]);
    }
    el.prompt.value = template;
    el.prompt.focus();
    return true;
  }

  function markStarterSelected(starter) {
    document.querySelectorAll(".starter-action").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.starter === starter);
    });
    if (starter) {
      storageSet(uiStorageKeys.selectedStarter, starter);
    }
  }

  function applyStarter(starter) {
    markStarterSelected(starter);
    const profile = starterProfiles[starter];
    if (!profile) {
      return;
    }
    setRadioValue("simpleCreativity", profile.creativity);
    setRadioValue("simpleLength", profile.length);
    syncSemanticControls(true);
    setLocalModelStatus(profile.message, false);
  }

  function setActiveTab(tabName) {
    const targetTab = tabName || "runtime";
    document.querySelectorAll(".tab-button").forEach((button) => {
      const selected = button.dataset.tab === targetTab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      const button = document.querySelector(`.tab-button[aria-controls="${panel.id}"]`);
      panel.hidden = !(button && button.dataset.tab === targetTab);
    });
    storageSet(uiStorageKeys.activeTab, targetTab);
  }

  // Makes a compact off-canvas rail inert and evacuates focus before hiding it.
  function setRailCollapsed(collapsed) {
    if (!el.appShell) {
      return;
    }
    const nextCollapsed = Boolean(collapsed);
    const compact = window.matchMedia("(max-width: 1199px)").matches;
    const hideOffCanvasRail = compact && nextCollapsed;
    if (hideOffCanvasRail && el.diagnosticsRail &&
        el.diagnosticsRail.contains(document.activeElement) &&
        el.mobileAdvancedButton) {
      el.mobileAdvancedButton.focus();
    }
    el.appShell.dataset.railCollapsed = String(nextCollapsed);
    if (el.diagnosticsRail) {
      el.diagnosticsRail.inert = hideOffCanvasRail;
      el.diagnosticsRail.toggleAttribute("inert", hideOffCanvasRail);
      el.diagnosticsRail.setAttribute("aria-hidden", String(hideOffCanvasRail));
    }
    if (el.diagnosticsRailToggle) {
      el.diagnosticsRailToggle.setAttribute(
        "aria-label",
        nextCollapsed ? "Show Advanced Options" : "Collapse Advanced Options"
      );
      el.diagnosticsRailToggle.setAttribute("aria-expanded", String(!nextCollapsed));
    }
    if (el.mobileAdvancedButton) {
      el.mobileAdvancedButton.setAttribute("aria-expanded", String(!nextCollapsed));
    }
    storageSet(uiStorageKeys.railCollapsed, String(nextCollapsed));
  }

  function latestDiagnosticsSnapshot() {
    try {
      return el.diagnostics && el.diagnostics.textContent ? JSON.parse(el.diagnostics.textContent) : null;
    } catch (_error) {
      return null;
    }
  }

  function runSnapshot(promptText, generatedText, isError) {
    const diagnostics = latestDiagnosticsSnapshot();
    return {
      timestamp: new Date().toISOString(),
      selectedModel: el.modelSelect && el.modelSelect.selectedOptions && el.modelSelect.selectedOptions[0]
        ? el.modelSelect.selectedOptions[0].textContent.trim()
        : "",
      prompt: String(promptText || ""),
      maxTokens: el.maxTokens ? el.maxTokens.value : "",
      temperature: el.temperature ? el.temperature.value : "",
      topK: el.topK ? el.topK.value : "",
      topP: el.topP ? el.topP.value : "",
      seed: el.seed ? el.seed.value : "",
      generatedTokenCount: diagnostics ? diagnostics.generated_token_count : 0,
      speed: el.benchTokensPerSecond ? el.benchTokensPerSecond.textContent : "",
      scratchBytes: diagnostics ? diagnostics.peak_scratch_arena_usage : 0,
      errorStatus: isError ? String(generatedText || "") : (el.errorState ? el.errorState.textContent : ""),
      checksum: el.provenanceChecksum ? el.provenanceChecksum.textContent : ""
    };
  }

  function persistRunHistory() {
    if (el.keepRunHistoryToggle && el.keepRunHistoryToggle.checked) {
      storageSet(uiStorageKeys.runHistory, JSON.stringify(state.runHistory.slice(0, 25)));
      return;
    }
    storageRemove(uiStorageKeys.runHistory);
  }

  function runSummaryText(run) {
    return [
      `time=${run.timestamp}`,
      `model=${run.selectedModel}`,
      `max_tokens=${run.maxTokens}`,
      `temperature=${run.temperature}`,
      `top_k=${run.topK}`,
      `top_p=${run.topP}`,
      `seed=${run.seed}`,
      `generated_tokens=${run.generatedTokenCount}`,
      `speed=${run.speed}`,
      `scratch_bytes=${run.scratchBytes}`,
      `error=${run.errorStatus}`,
      `route_hash=${run.routeHash}`,
      `checksum=${run.checksum}`
    ].join("\n");
  }

  function renderRunHistory() {
    if (!el.runHistoryList) {
      return;
    }
    el.runHistoryList.replaceChildren();
    for (const [index, run] of state.runHistory.entries()) {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      const meta = document.createElement("p");
      const actions = document.createElement("div");
      item.className = "run-history-item";
      actions.className = "run-history-actions";
      title.textContent = `${new Date(run.timestamp).toLocaleString()} / ${run.selectedModel || "local model"}`;
      meta.textContent = `${run.generatedTokenCount || 0} tokens / ${run.speed || "0 tok/s"} / ${run.errorStatus || "none"}`;
      for (const [label, action] of [["Restore settings", "restore"], ["Duplicate run", "duplicate"], ["Copy run summary", "copy"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.runIndex = String(index);
        button.dataset.runAction = action;
        actions.append(button);
      }
      item.append(title, meta, actions);
      el.runHistoryList.append(item);
    }
    if (el.runSummary) {
      el.runSummary.textContent = state.runHistory[0]
        ? runSummaryText(state.runHistory[0]).replace(/\n/g, " / ")
        : "No generation run yet.";
    }
  }

  function captureRun(promptText, generatedText, isError) {
    state.runHistory.unshift(runSnapshot(promptText, generatedText, isError));
    state.runHistory = state.runHistory.slice(0, 25);
    persistRunHistory();
    renderRunHistory();
  }

  function restoreRun(run, duplicatePrompt) {
    if (!run) {
      return;
    }
    if (el.maxTokens) el.maxTokens.value = run.maxTokens || el.maxTokens.value;
    if (el.temperature) el.temperature.value = run.temperature || el.temperature.value;
    if (el.topK) el.topK.value = run.topK || el.topK.value;
    if (el.topP) el.topP.value = run.topP || el.topP.value;
    if (el.seed) el.seed.value = run.seed || el.seed.value;
    if (duplicatePrompt && el.prompt) {
      el.prompt.value = run.prompt || el.prompt.value;
      el.prompt.focus();
    }
  }

  function restoreRunHistoryPreference() {
    const keep = storageGet(uiStorageKeys.keepRunHistory, "false") === "true";
    if (el.keepRunHistoryToggle) {
      el.keepRunHistoryToggle.checked = keep;
    }
    if (keep) {
      try {
        const parsed = JSON.parse(storageGet(uiStorageKeys.runHistory, "[]"));
        state.runHistory = Array.isArray(parsed) ? parsed.slice(0, 25) : [];
      } catch (_error) {
        state.runHistory = [];
      }
    }
    renderRunHistory();
  }

  function initializeUiShell() {
    resetUiPreferencesForIdentity();
    restoreDirectCompositionSeedCustody();
    state.peerBaseUrl = storageGet(uiStorageKeys.peerBaseUrl, "");
    restoreMemoryEndpointsSettings();
    updatePeerUrlStatus();
    renderCompanionState();
    const startingMode = initialAppMode();
    setAppMode(startingMode);
    restoreSemanticPreferences();
    restoreLocalConnectPolicy();
    markStarterSelected(storageGet(uiStorageKeys.selectedStarter, ""));
    renderSimpleModelPicker();
    setActiveTab(storageGet(uiStorageKeys.activeTab, "runtime"));
    collapseSidebar(storageGet(uiStorageKeys.sidebarCollapsed, "false") === "true");
    const compactRail = window.matchMedia("(max-width: 1199px)");
    const shouldCollapseRail = compactRail.matches || startingMode !== "advanced";
    setRailCollapsed(shouldCollapseRail);
    compactRail.addEventListener("change", (event) => {
      if (event.matches) {
        setRailCollapsed(true);
      } else {
        setRailCollapsed(el.appShell && el.appShell.dataset.railCollapsed === "true");
      }
    });
    if (el.pauseConsoleScroll) {
      el.pauseConsoleScroll.checked = storageGet(uiStorageKeys.consolePaused, "false") === "true";
      state.consoleAutoScroll = !el.pauseConsoleScroll.checked;
    }
    document.querySelectorAll("details[data-panel-key]").forEach((panel) => {
      const summary = panel.querySelector("summary");
      const stored = storageGet(`slmcomposer.ui.panel.${panel.dataset.panelKey}`, null);
      if (stored !== null) {
        panel.open = stored === "true";
      }
      if (summary) {
        summary.setAttribute("aria-expanded", String(panel.open));
      }
      panel.addEventListener("toggle", () => {
        if (summary) {
          summary.setAttribute("aria-expanded", String(panel.open));
        }
        storageSet(`slmcomposer.ui.panel.${panel.dataset.panelKey}`, String(panel.open));
      });
    });
    restoreRunHistoryPreference();
    updateSystemStatus(el.runtimeStatus ? el.runtimeStatus.textContent : "Booting", false);
    updateModelSummary();
    syncRangeControls();
  }

  function installUiEventHandlers() {
    if (el.simpleModeButton) {
      el.simpleModeButton.addEventListener("click", () => setAppMode("simple"));
    }
    if (el.advancedModeButton) {
      el.advancedModeButton.addEventListener("click", () => openSidebarAdvancedTools());
    }
    document.querySelectorAll(".starter-action").forEach((button) => {
      button.addEventListener("click", () => {
        if (!useStarterPrompt(button)) {
          applyStarter(button.dataset.starter);
        }
      });
    });
    const sidebarButton = document.getElementById("sidebarCollapseButton");
    if (sidebarButton) {
      sidebarButton.addEventListener("click", () => {
        collapseSidebar(!(el.appShell && el.appShell.dataset.sidebarCollapsed === "true"));
      });
    }
    const newChatButton = document.getElementById("newChatButton");
    if (newChatButton) {
      newChatButton.addEventListener("click", startNewConversation);
    }
    if (el.recentChatsList) {
      el.recentChatsList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-conversation-id]");
        if (button) {
          loadConversation(button.dataset.conversationId);
        }
      });
    }
    if (el.conversation) {
      el.conversation.addEventListener("scroll", () => {
        state.followConversation = conversationApi.isNearBottom({
          scrollTop: el.conversation.scrollTop,
          clientHeight: el.conversation.clientHeight,
          scrollHeight: el.conversation.scrollHeight
        });
        updateJumpToLatest();
      }, { passive: true });
      el.conversation.addEventListener("click", (event) => {
        const button = event.target.closest("[data-message-action]");
        if (button) {
          handleMessageAction(button.dataset.messageAction, button.dataset.messageId);
        }
      });
    }
    if (el.jumpToLatestButton) {
      el.jumpToLatestButton.addEventListener("click", () => {
        state.followConversation = true;
        el.conversation.scrollTo({ top: el.conversation.scrollHeight, behavior: "smooth" });
        updateJumpToLatest();
      });
    }
    document.querySelectorAll("[data-open-model-popover], #modelEditButton").forEach((button) => {
      button.addEventListener("click", () => toggleModelPopover(undefined, button));
    });
    if (el.simpleDiscoveryPanel) {
      el.simpleDiscoveryPanel.addEventListener("pointerdown", (event) => event.stopPropagation());
      el.simpleDiscoveryPanel.addEventListener("click", (event) => event.stopPropagation());
      el.simpleDiscoveryPanel.addEventListener("keydown", (event) => {
        trapSimpleModelPickerTabFocus(event);
      });
    }
    if (el.simpleModelCloseButton) {
      el.simpleModelCloseButton.addEventListener("click", () => {
        toggleModelPopover(false, null, true);
      });
    }
    document.addEventListener("pointerdown", suppressInitialModelChooserAutoPresent, true);
    document.addEventListener("keydown", suppressInitialModelChooserAutoPresent, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && el.simpleDiscoveryPanel &&
          !el.simpleDiscoveryPanel.hidden) {
        event.preventDefault();
        toggleModelPopover(false, null, true);
      }
    });
    document.addEventListener("click", (event) => {
      const panel = el.simpleDiscoveryPanel;
      if (!panel || panel.hidden) {
        return;
      }
      if (Date.now() < (state.modelPopoverHoldUntil || 0)) {
        toggleModelPopover(true);
        return;
      }
      const clickedOpener = event.target.closest("[data-open-model-popover], #modelEditButton");
      if (!clickedOpener && !panel.contains(event.target)) {
        toggleModelPopover(false);
      }
    });
    document.querySelectorAll(".preset-button").forEach((button) => {
      button.addEventListener("click", () => applyGenerationPreset(button.dataset.preset));
    });
    document.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener("input", () => {
        input.dataset.userEdited = "true";
        syncRangeControl(input);
      });
      input.addEventListener("change", () => syncRangeControl(input));
    });
    const seedRandomButton = document.getElementById("seedRandomButton");
    if (seedRandomButton && el.seed) {
      seedRandomButton.addEventListener("click", () => {
        el.seed.value = String(Math.floor(Math.random() * 4294967295));
      });
    }
    document.querySelectorAll('[data-sidebar-action="advanced"]').forEach((button) => {
      button.addEventListener("click", () => openSidebarAdvancedTools());
    });
    if (el.simpleModelList) {
      el.simpleModelList.addEventListener("click", (event) => {
        const option = event.target.closest("[data-composition-id]");
        if (!option) {
          return;
        }
        const entry = simpleModelEntries().find(
          (candidate) => candidate.composition.compositionId === option.dataset.compositionId
        );
        if (entry) {
          if (state.simpleModelConversionRecovery &&
              state.simpleModelConversionRecovery.entry !== entry) {
            clearSimpleModelConversionRecovery();
          }
          const route = resolveCurrentSimpleModelRoute(entry);
          if (route && route.actionable && !state.modelCatalogV1Loading) {
            selectSimpleModelEntry(route.entry);
          }
          renderSimpleModelPicker({
            focusCompositionId: entry.composition.compositionId
          });
          requestSimpleModelAcquisition(entry).catch((error) => {
            reportSimpleModelPickerCommandError(error);
          });
        }
      });
    }
    if (el.simpleModelRefreshButton) {
      el.simpleModelRefreshButton.addEventListener("click", () => {
        void loadSimpleModelCatalog();
      });
    }
    if (el.simpleModelActionButton) {
      el.simpleModelActionButton.addEventListener("click", () => {
        requestSimpleModelAcquisitionCancellation().catch((error) => {
          reportSimpleModelPickerCommandError(error);
        });
      });
    }
    if (el.simpleCompanionPairButton) {
      el.simpleCompanionPairButton.addEventListener("click", () => {
        pairSimpleCompanionAndContinue().catch((error) => {
          reportSimpleModelPickerCommandError(error);
        });
      });
    }
    if (el.simpleCompanionPairingCode) {
      el.simpleCompanionPairingCode.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        if (el.simpleCompanionPairButton) {
          el.simpleCompanionPairButton.click();
        }
      });
    }
    document.querySelectorAll('input[name="simpleCreativity"], input[name="simpleLength"]').forEach((input) => {
      input.addEventListener("change", () => syncSemanticControls(true));
    });
    if (el.localConnectApprovalMode) {
      el.localConnectApprovalMode.addEventListener("change", () => {
        state.localConnectApprovalMode = sanitizeLocalConnectApprovalMode(el.localConnectApprovalMode.value);
        if (state.localConnectApprovalMode !== "full") {
          state.localConnectFullControlAcknowledged = false;
        }
        persistLocalConnectPolicy("Approval mode saved.", { preserveEndpointApps: true });
      });
    }
    if (el.localConnectFullControlAck) {
      el.localConnectFullControlAck.addEventListener("change", () => {
        state.localConnectFullControlAcknowledged = Boolean(el.localConnectFullControlAck.checked);
        persistLocalConnectPolicy("Full-control acknowledgement saved.", { preserveEndpointApps: true });
      });
    }
    if (el.localConnectApprovedApps) {
      el.localConnectApprovedApps.addEventListener("input", () => {
        state.localConnectApprovedApps = normalizeLocalConnectApprovedApps(el.localConnectApprovedApps.value);
        state.localConnectApprovedAppCategories = normalizeLocalConnectApprovedAppCategories(
          state.localConnectApprovedApps,
          state.localConnectApprovedAppCategories
        );
        updateLocalConnectPolicyUi();
      });
      el.localConnectApprovedApps.addEventListener("change", () => {
        persistLocalConnectPolicy("Approved app list saved.");
      });
    }
    if (el.trustBrowserEmailLocalConnectButton) {
      el.trustBrowserEmailLocalConnectButton.addEventListener("click", () => {
        trustBrowserEmailLocalConnectPolicy();
      });
    }
    if (el.saveLocalConnectPolicyButton) {
      el.saveLocalConnectPolicyButton.addEventListener("click", () => {
        persistLocalConnectPolicy("Approval policy saved.");
      });
    }
    if (el.saveLocalConnectPolicyFileButton) {
      el.saveLocalConnectPolicyFileButton.addEventListener("click", () => {
        try {
          saveLocalConnectEndpointPolicyJson();
        } catch (error) {
          setLocalConnectEndpointStatus(errorMessage(error), true);
          updateLocalConnectPolicyUi();
        }
      });
    }
    if (el.resetLocalConnectPolicyButton) {
      el.resetLocalConnectPolicyButton.addEventListener("click", () => {
        resetLocalConnectPolicy();
      });
    }
    if (el.localConnectEndpointUrl) {
      el.localConnectEndpointUrl.addEventListener("change", () => {
        try {
          state.localConnectEndpointUrl = sanitizeLocalConnectEndpointUrl(el.localConnectEndpointUrl.value);
          el.localConnectEndpointUrl.value = state.localConnectEndpointUrl;
          storageSet(uiStorageKeys.localConnectEndpointUrl, state.localConnectEndpointUrl);
          clearLocalConnectEndpointApps();
          setLocalConnectEndpointStatus("Endpoint saved. Run a check before relying on it.", false);
        } catch (error) {
          setLocalConnectEndpointStatus(errorMessage(error), true);
        }
      });
    }
    if (el.checkLocalConnectEndpointButton) {
      el.checkLocalConnectEndpointButton.addEventListener("click", () => {
        checkLocalConnectEndpoint(false).catch((error) => {
          setLocalConnectEndpointStatus(errorMessage(error), true);
        });
      });
    }
    if (el.dryRunLocalConnectDecisionButton) {
      el.dryRunLocalConnectDecisionButton.addEventListener("click", () => {
        checkLocalConnectEndpoint(true).catch((error) => {
          setLocalConnectEndpointStatus(errorMessage(error), true);
        });
      });
    }
    if (el.dryRunLocalConnectActionButton) {
      el.dryRunLocalConnectActionButton.addEventListener("click", () => {
        dryRunLocalConnectAction().catch((error) => {
          setLocalConnectEndpointStatus(errorMessage(error), true);
        });
      });
    }
    if (el.executeLocalConnectActionButton) {
      el.executeLocalConnectActionButton.addEventListener("click", () => {
        executeLocalConnectAction().catch((error) => {
          setLocalConnectEndpointStatus(errorMessage(error), true);
        });
      });
    }
    document.querySelectorAll("[data-doc-target]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = link.getAttribute("data-doc-target") || "";
        const url = docsTargets[target];
        if (url) {
          window.open(url, "_blank", "noopener");
        }
      });
    });
    if (el.simplePeerBaseUrlInput) {
      el.simplePeerBaseUrlInput.placeholder = peerExampleUrl;
    }
    if (el.companionDetectButton) {
      el.companionDetectButton.addEventListener("click", () => {
        void detectCompanion();
      });
    }
    if (el.companionForgetButton) {
      el.companionForgetButton.addEventListener("click", () => {
        void forgetCompanionPairing();
      });
    }
    if (el.companionPairButton) {
      el.companionPairButton.addEventListener("click", () => {
        void pairCompanion();
      });
    }
    if (el.companionPairingCode) {
      el.companionPairingCode.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        void pairCompanion();
      });
    }
    if (el.companionCancelImportButton) {
      el.companionCancelImportButton.addEventListener("click", () => {
        requestSimpleModelAcquisitionCancellation().catch((error) => {
          reportSimpleModelPickerCommandError(error);
        });
      });
    }
    if (el.simpleSavePeerUrlButton) {
      el.simpleSavePeerUrlButton.addEventListener("click", () => {
        try {
          setPeerBaseUrl(el.simplePeerBaseUrlInput ? el.simplePeerBaseUrlInput.value : "");
          holdModelPopoverOpen(2000);
        } catch (error) {
          updatePeerUrlStatus(errorMessage(error), true);
          holdModelPopoverOpen(2500);
        }
      });
    }
    if (el.simpleCheckPeerStatusButton) {
      el.simpleCheckPeerStatusButton.addEventListener("click", () => {
        checkCurrentPeerListing().catch((error) => {
          updatePeerUrlStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simplePeerBaseUrlInput) {
      el.simplePeerBaseUrlInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        if (el.simpleSavePeerUrlButton) {
          el.simpleSavePeerUrlButton.click();
        }
      });
      el.simplePeerBaseUrlInput.addEventListener("change", () => {
        try {
          setPeerBaseUrl(el.simplePeerBaseUrlInput.value);
        } catch (error) {
          updatePeerUrlStatus(errorMessage(error), true);
        }
      });
    }
    if (el.prompt) {
      el.prompt.addEventListener("input", resizeComposer);
      el.prompt.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) {
          return;
        }
        if (state.generation.inFlight || !el.generateButton || el.generateButton.disabled || !el.form) {
          return;
        }
        event.preventDefault();
        if (typeof el.form.requestSubmit === "function") {
          el.form.requestSubmit(el.generateButton);
        } else {
          el.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        }
      });
    }
    if (el.simpleOpenAdvancedDiscoveryButton) {
      el.simpleOpenAdvancedDiscoveryButton.addEventListener("click", () => {
        openSidebarAdvancedTools();
      });
    }
    document.querySelectorAll(".tab-button").forEach((button, index, buttons) => {
      button.addEventListener("click", () => setActiveTab(button.dataset.tab));
      button.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
          return;
        }
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const next = buttons[(index + direction + buttons.length) % buttons.length];
        next.focus();
        setActiveTab(next.dataset.tab);
      });
    });
    if (el.diagnosticsRailToggle) {
      el.diagnosticsRailToggle.addEventListener("click", () => {
        setRailCollapsed(!(el.appShell && el.appShell.dataset.railCollapsed === "true"));
      });
    }
    if (el.mobileAdvancedButton) {
      el.mobileAdvancedButton.addEventListener("click", () => {
        openSidebarAdvancedTools();
      });
    }
    if (el.clearConsoleButton) {
      el.clearConsoleButton.addEventListener("click", () => {
        if (el.console) {
          el.console.textContent = "";
        }
      });
    }
    if (el.copyConsoleButton) {
      el.copyConsoleButton.addEventListener("click", () => copyText(el.console ? el.console.textContent : ""));
    }
    if (el.pauseConsoleScroll) {
      el.pauseConsoleScroll.addEventListener("change", () => {
        state.consoleAutoScroll = !el.pauseConsoleScroll.checked;
        storageSet(uiStorageKeys.consolePaused, String(el.pauseConsoleScroll.checked));
      });
    }
    if (el.keepRunHistoryToggle) {
      el.keepRunHistoryToggle.addEventListener("change", () => {
        storageSet(uiStorageKeys.keepRunHistory, String(el.keepRunHistoryToggle.checked));
        persistRunHistory();
      });
    }
    if (el.clearRunHistoryButton) {
      el.clearRunHistoryButton.addEventListener("click", () => {
        state.runHistory = [];
        storageRemove(uiStorageKeys.runHistory);
        renderRunHistory();
      });
    }
    if (el.runHistoryList) {
      el.runHistoryList.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-run-action]");
        if (!button) {
          return;
        }
        const run = state.runHistory[Number.parseInt(button.dataset.runIndex, 10)];
        if (!run) {
          return;
        }
        if (button.dataset.runAction === "copy") {
          copyText(runSummaryText(run));
        } else if (button.dataset.runAction === "duplicate") {
          restoreRun(run, true);
        } else {
          restoreRun(run, false);
        }
      });
    }
  }

  function observeCopyableFields() {
    const observer = new MutationObserver(() => {
      document.querySelectorAll("dd.copyable").forEach(ensureCopyButton);
    });
    document.querySelectorAll("dd.copyable").forEach((node) => {
      observer.observe(node, { childList: true, characterData: true, subtree: true });
      ensureCopyButton(node);
    });
  }

  function renderDiagnostics() {
    const runtimeState = state.runtimeState;
    const rawOutput = state.generation.rawOutput;
    const diagnostics = {
      schema: "tinyrustlm.browser-worker-diagnostics/1",
      cache_cleanup: { ...state.compositionCleanup },
      runtime_variant: state.runtimeVariant,
      worker_status: state.runtimeClient ? state.runtimeClient.status : "not-created",
      operation_id: runtimeState ? runtimeState.operationId : null,
      transcript_revision: state.transcriptRevision.toString(10),
      composition_active: Boolean(runtimeState && runtimeState.activeComposition),
      active_composition_graph_sha256: runtimeState && runtimeState.activeComposition
        ? runtimeState.activeComposition.graphIdentitySha256
        : null,
      active_composition_member_table_sha256: runtimeState && runtimeState.activeComposition
        ? runtimeState.activeComposition.memberTableSha256
        : null,
      model_bytes: runtimeState && runtimeState.memoryPlan
        ? runtimeState.memoryPlan.modelBytes
        : 0,
      committed_kv_bytes: runtimeState ? runtimeState.committedKvBytes : 0,
      peak_scratch_arena_usage: runtimeState && runtimeState.memoryPlan
        ? runtimeState.memoryPlan.scratchBytes
        : 0,
      observed_linear_memory_bytes: runtimeState
        ? runtimeState.observedLinearMemoryBytes
        : 0,
      maximum_linear_memory_bytes: runtimeState
        ? runtimeState.maximumLinearMemoryBytes
        : 0,
      prompt_token_count: 0,
      generated_token_count: rawOutput ? rawOutput.tokenIds.length : 0,
      generation_status: rawOutput ? rawOutput.status.kind : null
    };
    const diagnosticsText = JSON.stringify(diagnostics, null, 2);
    el.diagnostics.textContent = diagnosticsText;
    el.developer.textContent = diagnosticsText;
    state.latestDiagnostics = Object.freeze(diagnostics);
    renderBenchmark(diagnosticsText);
  }

  function renderBenchmark(diagnosticsText) {
    let diagnostics = null;
    try {
      diagnostics = JSON.parse(diagnosticsText);
    } catch (_error) {
      diagnostics = null;
    }
    const promptTokens = diagnostics ? diagnostics.prompt_token_count : 0;
    const generatedTokens = diagnostics ? diagnostics.generated_token_count : 0;
    const scratchBytes = diagnostics ? diagnostics.peak_scratch_arena_usage : 0;
    const measuredTokens = state.lastMeasuredTokens > 0 ? state.lastMeasuredTokens : generatedTokens;
    const measuredSpeed = measuredTokens > 0 && state.lastGenerateMs > 0
      ? measuredTokens / (state.lastGenerateMs / 1000)
      : 0;
    const reportedSpeed = diagnostics ? diagnostics.tokens_per_second : 0;
    const speed = measuredSpeed || reportedSpeed || 0;
    el.benchLoadMs.textContent = state.modelLoadMs > 0 ? `${state.modelLoadMs} ms` : "waiting";
    el.benchPromptTokens.textContent = `${promptTokens} tokens`;
    el.benchGeneratedTokens.textContent = `${generatedTokens} tokens`;
    el.benchTokensPerSecond.textContent = `${speed.toFixed(3)} tok/s`;
    el.benchScratch.textContent = `${scratchBytes} bytes`;
    if (el.runSummary && state.runHistory.length === 0) {
      el.runSummary.textContent = generatedTokens > 0
        ? `${generatedTokens} tokens / ${speed.toFixed(3)} tok/s / ${scratchBytes} scratch bytes`
        : "No generation run yet.";
    }
  }

  function renderConversation() {
    const previousScrollTop = el.conversation.scrollTop;
    const wasScrollable = el.conversation.scrollHeight > el.conversation.clientHeight;
    const shouldFollow = !wasScrollable || conversationApi.isNearBottom({
      scrollTop: el.conversation.scrollTop,
      clientHeight: el.conversation.clientHeight,
      scrollHeight: el.conversation.scrollHeight
    });
    if (el.response) {
      el.response.hidden = true;
      el.response.setAttribute("aria-hidden", "true");
      el.response.removeAttribute("id");
      el.response.replaceChildren();
    }
    el.conversation.replaceChildren();
    const isActive = state.messages.length > 0;
    if (el.appShell) {
      el.appShell.dataset.conversationState = isActive ? "active" : "empty";
    }
    if (el.simpleExperience) {
      el.simpleExperience.hidden = isActive;
      el.simpleExperience.setAttribute("aria-hidden", String(isActive));
    }
    if (el.conversationHeader) {
      el.conversationHeader.hidden = !isActive;
    }
    const current = activeConversation();
    if (el.conversationTitle) {
      el.conversationTitle.textContent = current ? current.title : "New conversation";
    }
    if (state.messages.length === 0) {
      const item = document.createElement("li");
      item.className = "empty-message";
      item.textContent = "No conversation yet. Messages appear only after a verified six-member composition runs in the isolated Rust/WASM worker.";
      el.conversation.append(item);
      if (el.response) {
        el.response.id = "response";
      }
      el.clearChatButton.disabled = true;
      resizeComposer();
      return;
    }
    const latestAssistant = current
      ? conversationApi.latestAssistantMessage(current)
      : [...state.messages].reverse().find((message) => message.role === "assistant");
    for (const message of state.messages) {
      const item = document.createElement("li");
      const avatar = document.createElement("div");
      const content = document.createElement("div");
      const heading = document.createElement("div");
      const role = document.createElement("div");
      const text = document.createElement("div");
      const time = document.createElement("time");
      item.className = `message message-${message.role}`;
      item.dataset.messageId = message.id || "";
      item.dataset.status = message.status || (message.isError ? "failed" : "completed");
      item.classList.toggle("error", message.status === "failed" || message.status === "rejected" || Boolean(message.isError));
      avatar.className = message.role === "user" ? "message-avatar" : "assistant-avatar";
      avatar.textContent = message.role === "user" ? "You" : "";
      if (message.role !== "user") {
        const icon = document.createElementNS(svgNamespace, "svg");
        const use = document.createElementNS(svgNamespace, "use");
        use.setAttribute("href", "#icon-cube");
        icon.append(use);
        avatar.append(icon);
      }
      content.className = "message-content";
      heading.className = "message-heading";
      role.className = "message-role";
      text.className = "message-text";
      time.className = "message-time";
      role.textContent = message.role === "user" ? "You" : "TinyRustLM";
      heading.append(role);
      if (message.role === "assistant") {
        const status = document.createElement("span");
        status.className = "message-status";
        status.textContent = conversationStatusLabel(message.status);
        heading.append(status);
      }
      renderResponse(text, message.text, message.status === "failed" || message.status === "rejected");
      if (latestAssistant && latestAssistant.id === message.id) {
        text.id = "response";
        text.setAttribute("aria-live", "polite");
      }
      const actions = renderMessageActions(message);
      const createdAt = message.createdAt || conversationTimestamp();
      time.dateTime = createdAt;
      time.textContent = new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      content.append(heading, text);
      if (actions) {
        content.append(actions);
      }
      item.append(avatar, content, time);
      el.conversation.append(item);
    }
    if (!latestAssistant && el.response) {
      el.response.id = "response";
    }
    el.clearChatButton.disabled = state.messages.length === 0;
    window.requestAnimationFrame(() => {
      if (shouldFollow) {
        el.conversation.scrollTop = el.conversation.scrollHeight;
        state.followConversation = true;
      } else {
        el.conversation.scrollTop = Math.min(previousScrollTop, el.conversation.scrollHeight);
        state.followConversation = false;
      }
      updateJumpToLatest();
    });
    resizeComposer();
  }

  function conversationStatusLabel(status) {
    const labels = {
      waiting: "Waiting",
      generating: "Generating",
      streaming: "Responding",
      completed: "Completed",
      stopped: "Stopped",
      rejected: "Rejected",
      failed: "Failed"
    };
    return labels[status] || "Completed";
  }

  function createMessageAction(action, label, iconId, messageId) {
    const button = document.createElement("button");
    const icon = document.createElementNS(svgNamespace, "svg");
    const use = document.createElementNS(svgNamespace, "use");
    button.className = "message-action";
    button.type = "button";
    button.dataset.messageAction = action;
    button.dataset.messageId = messageId;
    button.setAttribute("aria-label", label);
    button.title = label;
    use.setAttribute("href", `#${iconId}`);
    icon.append(use);
    button.append(icon);
    return button;
  }

  function renderMessageActions(message) {
    const terminal = ["completed", "stopped", "rejected", "failed"].includes(message.status);
    const actions = document.createElement("div");
    actions.className = "message-actions";
    if (message.text) {
      actions.append(createMessageAction("copy", "Copy message", "icon-copy", message.id));
    }
    if (message.role === "assistant" && terminal) {
      actions.append(createMessageAction("retry", "Retry response", "icon-retry", message.id));
      if (message.status === "completed" && message.text) {
        actions.append(createMessageAction("continue", "Continue response", "icon-continue", message.id));
      }
      actions.append(createMessageAction("inspect", "Inspect generation", "icon-inspect", message.id));
    }
    return actions.childElementCount > 0 ? actions : null;
  }

  function updateJumpToLatest() {
    if (!el.jumpToLatestButton) {
      return;
    }
    const nearBottom = conversationApi.isNearBottom({
      scrollTop: el.conversation.scrollTop,
      clientHeight: el.conversation.clientHeight,
      scrollHeight: el.conversation.scrollHeight
    });
    el.jumpToLatestButton.hidden = state.messages.length === 0 || nearBottom;
  }

  function resizeComposer() {
    if (!el.prompt || !el.appShell) {
      return;
    }
    if (el.appShell.dataset.conversationState !== "active") {
      el.prompt.style.removeProperty("height");
      return;
    }
    el.prompt.style.height = "28px";
    const maxHeight = window.matchMedia("(max-width: 899px)").matches ? 116 : 144;
    el.prompt.style.height = `${Math.max(28, Math.min(maxHeight, el.prompt.scrollHeight))}px`;
  }

  function beginConversationTurn(promptText) {
    const now = conversationTimestamp();
    let conversation = activeConversation();
    if (conversation && conversation.messages.length + 2 > conversationApi.maxMessages) {
      state.activeConversationId = "";
      state.messages = [];
      conversation = null;
    }
    if (!conversation) {
      conversation = conversationApi.createConversation({
        id: newConversationId("chat"),
        now,
        modelKey: state.activeModelKey || (el.modelSelect ? el.modelSelect.value : ""),
        preset: state.selectedPreset,
        generation: currentGenerationSettings(),
        memoryMode: currentConversationMemoryMode()
      });
    }
    const turnId = newConversationId("turn");
    const userMessage = conversationApi.createMessage({
      id: newConversationId("message"),
      turnId,
      role: "user",
      status: "completed",
      text: promptText,
      createdAt: now
    });
    const assistantMessage = conversationApi.createMessage({
      id: newConversationId("message"),
      turnId,
      role: "assistant",
      status: "waiting",
      text: "",
      createdAt: now
    });
    conversation = conversationApi.appendTurn(conversation, userMessage, assistantMessage, now);
    replaceConversation(conversation, true);
    state.generation.assistantMessageId = assistantMessage.id;
    state.followConversation = true;
    if (el.prompt) {
      el.prompt.value = "";
    }
    renderConversation();
    persistConversations();
    return assistantMessage;
  }

  function updateAssistantMessage(messageId, patch, persist) {
    const conversation = activeConversation();
    if (!conversation || !messageId) {
      return null;
    }
    const next = conversationApi.updateMessage(conversation, messageId, patch, conversationTimestamp());
    replaceConversation(next, true);
    renderConversation();
    if (persist !== false) {
      persistConversations();
    }
    return next.messages.find((message) => message.id === messageId) || null;
  }

  function submitComposerText(text) {
    if (!el.prompt || !el.form || state.generation.inFlight) {
      return;
    }
    el.prompt.value = text;
    resizeComposer();
    if (typeof el.form.requestSubmit === "function") {
      el.form.requestSubmit(el.generateButton);
    } else {
      el.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
  }

  function handleMessageAction(action, messageId) {
    const conversation = activeConversation();
    const message = conversation && conversation.messages.find((candidate) => candidate.id === messageId);
    if (!message) {
      return;
    }
    if (action === "copy") {
      copyText(message.text);
      return;
    }
    if (action === "retry") {
      const previous = conversationApi.previousUserMessage(conversation, message);
      if (previous) {
        submitComposerText(previous.text);
      }
      return;
    }
    if (action === "continue") {
      submitComposerText(`Continue the previous response without repeating it:\n\n${message.text.slice(-2400)}`);
      return;
    }
    if (action === "inspect") {
      setAppMode("advanced");
      setRailCollapsed(false);
      const diagnosticsPanel = document.querySelector('[data-panel-key="dashboard-diagnostics"]');
      if (diagnosticsPanel) {
        diagnosticsPanel.open = true;
        diagnosticsPanel.scrollIntoView({ block: "nearest" });
      }
    }
  }

  function appendConsole(text) {
    el.console.textContent = el.console.textContent
      ? `${el.console.textContent}\n${text}`
      : text;
    if (state.consoleAutoScroll) {
      el.console.scrollTop = el.console.scrollHeight;
    }
  }

  function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
  }

  function clampNumber(value, min, max, fallback) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
  }

  function clampInteger(value, min, max, fallback) {
    return Math.trunc(clampNumber(value, min, max, fallback));
  }

  function readSamplingConfig() {
    const modelKey = state.activeModelKey || (el.modelSelect ? el.modelSelect.value : "");
    const model = paths.models[modelKey] || null;
    const config = {
      temperature: clampNumber(el.temperature.value, 0, 5, 0),
      topK: clampInteger(el.topK.value, 1, runtimeSamplerCandidateCap, 1),
      topP: clampNumber(el.topP.value, 0.01, 1, 1),
      seed: clampInteger(el.seed.value, 0, 4294967295, 1),
      repetitionPenalty: clampNumber(model && model.repetitionPenalty, 1, 128, 1)
    };
    el.temperature.value = String(config.temperature);
    el.topK.value = String(config.topK);
    el.topP.value = String(config.topP);
    el.seed.value = String(config.seed);
    syncRangeControls();
    return config;
  }

  // Returns a conversation-evidence field only after its declared checksum is verified.

  function isDemoOrRuntimeSmokeModel(model) {
    const text = [
      model && model.label,
      model && model.path,
      model && model.candidateId
    ].filter(Boolean).join(" ").toLowerCase();
    return text.includes("fixture") ||
      text.includes("tiny-test-model") ||
      text.includes("tinylm16") ||
      text.includes("deterministic-smoke");
  }

  function hasDeclaredQualityEvidence(model) {
    const evalEvidence = model && model.evalEvidence ? model.evalEvidence : null;
    const runtimeSmokeEvidence = model && model.runtimeSmokeEvidence ? model.runtimeSmokeEvidence : null;
    return Boolean(
      model &&
      evalEvidence &&
      runtimeSmokeEvidence &&
      Number.isSafeInteger(model.modelBytes) &&
      model.modelBytes > 0 &&
      model.slmChecksum &&
      model.modelShape &&
      model.quantization &&
      model.tokenizer &&
      model.tokenizerChecksum &&
      model.contextLength &&
      model.outputContract &&
      model.promptFormat &&
      evalEvidence.path &&
      evalEvidence.checksum &&
      evalEvidence.manifestChecksum &&
      evalEvidence.casesPassed >= 12 &&
      evalEvidence.qualityScope === "assistant-quality-no-cheat-runtime-gate" &&
      evalEvidence.qualityBoundary === "real-runtime-response-quality" &&
      runtimeSmokeEvidence.path &&
      runtimeSmokeEvidence.manifestChecksum
    );
  }

  // Reports whether a model declares enough immutable metadata to verify conversation evidence.
  function hasDeclaredConversationEvidence(model) {
    const evidence = model && model.conversationEvidence ? model.conversationEvidence : null;
    return Boolean(
      model &&
      evidence &&
      model.companionOnly === true &&
      model.requiredDownloadConsent === true &&
      Number.isSafeInteger(model.modelBytes) &&
      model.modelBytes > 0 &&
      Number.isSafeInteger(model.estimatedWasmMemoryBytes) &&
      model.estimatedWasmMemoryBytes >= model.modelBytes &&
      model.artifactSha256 &&
      model.slmChecksum &&
      model.slmManifestChecksum &&
      model.modelShape &&
      model.quantization &&
      model.tokenizer &&
      model.tokenizerChecksum &&
      model.contextLength &&
      model.outputContract &&
      model.promptFormat &&
      model.sourceIdentity &&
      model.sourceRevision &&
      model.sourceLicense === "Apache-2.0" &&
      model.sourceLicensePath &&
      model.sourceLicenseSha256 &&
      model.modificationNoticePath &&
      Array.isArray(model.knownLimitations) &&
      model.knownLimitations.includes("strict-json") &&
      evidence.path &&
      evidence.manifestChecksum &&
      evidence.turnsPassed >= 2 &&
      evidence.strictEvalCasesPassed === 10 &&
      evidence.strictEvalCasesFailed === 2 &&
      evidence.qualityScope === "normal-tinyrustlm-browser-ui-two-turn-conversation"
    );
  }

  function modelTrustTier(model) {
    if (!model) {
      return modelTrustTiers.experimental;
    }
    if (model.browserComposition && model.browserComposition.admission) {
      return modelTrustTiers.quality;
    }
    if (hasDeclaredQualityEvidence(model)) {
      return modelTrustTiers.quality;
    }
    if (hasDeclaredConversationEvidence(model)) {
      return modelTrustTiers.conversation;
    }
    if (isDemoOrRuntimeSmokeModel(model)) {
      return modelTrustTiers.demo;
    }
    return modelTrustTiers.experimental;
  }

  function modelTrustPolicy(model) {
    const tier = modelTrustTier(model);
    if (tier === modelTrustTiers.quality) {
      return [
        "verified-eval-sidecar",
        "assistant-quality-no-cheat-runtime-gate",
        "runtime-smoke-before-model-bytes"
      ].join(" / ");
    }
    if (tier === modelTrustTiers.conversation) {
      return "verified-browser-conversation / explicit-large-download / strict-json-limited / full-assistant-quality-pending";
    }
    if (tier === modelTrustTiers.demo) {
      return "runtime-smoke-only / not-assistant-quality / replace-before-product-claim";
    }
    return "quality-pending / verify-tokenizer-prompt-provenance-eval-before-assistant-quality";
  }

  function applyModelTrustMetadata(node, model) {
    if (!node) {
      return;
    }
    const tier = modelTrustTier(model);
    const policy = modelTrustPolicy(model);
    node.dataset.trustTier = tier;
    node.dataset.qualityCapable = String(tier === modelTrustTiers.quality);
    node.dataset.trustPolicy = policy;
    node.title = `Trust tier: ${tier}. ${policy}`;
  }

  // Renders selector entries while allowing registry boot to prefer its declared default.
  function renderModelOptions(models, preferDeclaredDefault, selectedOverride) {
    const selected = selectedOverride || (preferDeclaredDefault ? "" : el.modelSelect.value);
    el.modelSelect.replaceChildren();
    let firstKey = "";
    const requiresExplicitPublicSelection = isPublicLocalOnlyHost() && !state.localModel && !selectedOverride;
    if (requiresExplicitPublicSelection) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Choose a local or P2P composition";
      placeholder.disabled = true;
      placeholder.selected = true;
      el.modelSelect.append(placeholder);
    }
    for (const key of Object.keys(models)) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = models[key].label || key;
      applyModelTrustMetadata(option, models[key]);
      el.modelSelect.append(option);
      if (!firstKey) {
        firstKey = key;
      }
    }
    if (!firstKey) {
      if (!requiresExplicitPublicSelection) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Choose a local composition";
        option.disabled = true;
        option.selected = true;
        el.modelSelect.append(option);
      }
      return;
    }
    const defaultKey = state.selectorDefaultModelKey;
    el.modelSelect.value = requiresExplicitPublicSelection && !models[selected]
      ? ""
      : models[selected] ? selected : (models[defaultKey] ? defaultKey : firstKey);
    updateModelSummary();
  }

  function isPublicLocalOnlyHost() {
    return publicLocalOnlyHosts.has(window.location.hostname.toLowerCase());
  }

  // Restores only models imported during this page session when registry intake is unavailable.

  function formatByteCount(bytes) {
    if (!Number.isFinite(bytes)) {
      return "unknown bytes";
    }
    if (bytes >= 1024 * 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TiB`;
    }
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KiB`;
    }
    return `${bytes} bytes`;
  }

  // Requires fresh consent before the first large public-model download in this page session.
  function modelRequiresDownloadConsent(modelKey, model) {
    return Boolean(
      modelKey &&
      model &&
      !model.localFile &&
      model.requiredDownloadConsent === true &&
      !state.largeModelConsents.has(modelKey)
    );
  }

  // Presents the locked-UI disclosure dialog and resolves to the user's explicit decision.
  function showLargeModelConsent(model) {
    const download = formatByteCount(model.modelBytes);
    const memoryEstimate = formatByteCount(model.estimatedWasmMemoryBytes);
    if (
      !el.largeModelDialog ||
      typeof el.largeModelDialog.showModal !== "function" ||
      !el.largeModelDialogModel ||
      !el.largeModelDialogDownload ||
      !el.largeModelDialogMemory
    ) {
      return Promise.resolve(window.confirm(
        `Load ${model.label}? This downloads ${download} and uses about ${memoryEstimate} of browser memory. Consent stays only in this browser session.`
      ));
    }
    el.largeModelDialogModel.textContent = model.label;
    el.largeModelDialogDownload.textContent = download;
    el.largeModelDialogMemory.textContent = memoryEstimate;
    el.largeModelDialog.returnValue = "cancel";
    return new Promise((resolve) => {
      const onClose = () => {
        resolve(el.largeModelDialog.returnValue === "accept");
      };
      el.largeModelDialog.addEventListener("close", onClose, { once: true });
      el.largeModelDialog.showModal();
    });
  }

  // Loads the selected model after enforcing any applicable large-download disclosure.
  async function loadSelectedModelWithConsent(signal, activationToken) {
    throwIfAcquisitionAborted(signal);
    if (activationToken && !ownsStoredCompositionActivation(activationToken)) {
      throw catalogQualificationError(
        "model-cache-activation-owner-mismatch",
        "A newer model activation superseded this browser cache operation"
      );
    }
    const requestedModelKey = el.modelSelect.value;
    const model = paths.models[requestedModelKey] || null;
    const previousModelKey = state.modelLoaded && paths.models[state.activeModelKey]
      ? state.activeModelKey
      : "";
    if (modelRequiresDownloadConsent(requestedModelKey, model)) {
      const accepted = await showLargeModelConsent(model);
      throwIfAcquisitionAborted(signal);
      if (activationToken && !ownsStoredCompositionActivation(activationToken)) {
        throw catalogQualificationError(
          "model-cache-activation-owner-mismatch",
          "A newer model activation superseded this browser cache operation"
        );
      }
      if (!accepted) {
        el.modelSelect.value = previousModelKey;
        updateModelSummary();
        setControls(state.modelLoaded, true);
        return { loaded: false, outcome: "cancelled", error: "" };
      }
      state.largeModelConsents.add(requestedModelKey);
    }
    const loaded = await loadSelectedBrowserComposition(signal, activationToken);
    const detail = loaded || !el.errorState || el.errorState.textContent === "none"
      ? ""
      : String(el.errorState.textContent || "").trim();
    return {
      loaded,
      outcome: loaded ? "loaded" : "failed",
      error: detail
    };
  }

  function safeLocalModelName(name) {
    const cleaned = String(name || "local-model.slm2")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim();
    return (cleaned || "local-model.slm2").slice(0, 96);
  }

  function safeLocalPathLeaf(pathHint, fallback = "local-file") {
    const text = String(pathHint || "").replace(/\\/g, "/");
    const leaf = text.split("/").filter(Boolean).pop() || fallback;
    return safeLocalModelName(leaf);
  }

  function normalizeLocalMemoryPath(pathHint, fallback = "memory.uai") {
    const raw = String(pathHint || fallback)
      .replace(/\\/g, "/")
      .replace(/^[a-zA-Z]:\//, "")
      .replace(/^\/+/, "")
      .trim();
    let parts = raw.split("/").filter(Boolean);
    const uaiIndex = parts.findIndex((segment) => segment.toLowerCase() === ".uai");
    if (uaiIndex >= 0) {
      parts = parts.slice(uaiIndex);
    } else if (parts[0] && parts[0].toLowerCase() === "uai") {
      parts[0] = ".uai";
    } else {
      const leaf = safeLocalModelName(parts[parts.length - 1] || fallback);
      const requiredPaths = [
        ...localMemoryUniversalPaths,
        ...localMemoryBaselinePaths,
        ...localMemoryFileHandoffPaths,
        ...localMemoryCodeBearingPaths,
        ...localMemoryMultiAgentPaths,
        ...localMemoryTalismanPaths,
        ...localMemoryAdvancedPersonaPaths,
        ...localMemoryOptionalContentPaths.map((entry) => entry[1])
      ];
      const candidates = requiredPaths.filter((path) => safeLocalPathLeaf(path).toLowerCase() === leaf.toLowerCase());
      if (candidates.length === 1) {
        return candidates[0];
      }
      parts = [".uai", leaf];
    }
    if (!parts.length || parts[0].toLowerCase() !== ".uai") {
      throw new Error("UAIX memory deck files must be inside a .uai folder");
    }
    const normalized = parts.map((segment, index) => {
      const value = String(segment || "").trim();
      if (!value || value === "." || value === "..") {
        throw new Error("UAIX memory deck paths cannot contain empty or parent segments");
      }
      return index === 0 ? ".uai" : safeLocalModelName(value);
    }).join("/");
    return normalized.toLowerCase();
  }

  function normalizeLocalMemoryManifestPath(value) {
    try {
      return normalizeLocalMemoryPath(value, "");
    } catch (_error) {
      return "";
    }
  }

  function localMemoryPathHintFromText(text) {
    const match = String(text || "").match(/(?:^|\n)\s*(\.uai\/[A-Za-z0-9._/-]+)/);
    return match ? match[1] : "";
  }

  function localMemoryManifestEntry(entries) {
    return entries.get(".uai/manifest.uaix.json") || null;
  }

  function localMemorySelectedFiles(input) {
    return Array.from(input && input.files ? input.files : []);
  }

  function localMemorySetupLabel(setup) {
    const labels = {
      base: "Base active memory",
      agent_file_handoff: "Agent File Handoff",
      llm_wiki: "LLM Wiki",
      file_handoff_llm_wiki: "File Handoff + LLM Wiki",
      multi_agent_communication: "Multi-Agent Communication",
      talisman_system: "Talisman System",
      advanced_persona_profile: "Advanced Persona Profile"
    };
    return labels[setup] || labels.base;
  }

  function valueContainsLocalMemoryString(value, needle) {
    const target = String(needle || "").toLowerCase();
    if (!target) {
      return false;
    }
    if (typeof value === "string") {
      return value.toLowerCase().includes(target);
    }
    if (Array.isArray(value)) {
      return value.some((item) => valueContainsLocalMemoryString(item, target));
    }
    if (value && typeof value === "object") {
      return Object.entries(value).some(([key, item]) => {
        return String(key).toLowerCase().includes(target) || valueContainsLocalMemoryString(item, target);
      });
    }
    return false;
  }

  function localMemoryManifestBoolean(manifest, key) {
    if (!manifest || typeof manifest !== "object") {
      return false;
    }
    if (manifest[key] === true) {
      return true;
    }
    const dashed = key.replace(/_/g, "-");
    return valueContainsLocalMemoryString(manifest, key) || valueContainsLocalMemoryString(manifest, dashed);
  }

  function extractLocalMemoryManifestPaths(value, paths = new Set()) {
    if (typeof value === "string") {
      const pathValue = normalizeLocalMemoryManifestPath(value);
      if (pathValue) {
        paths.add(pathValue);
      }
      return paths;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => extractLocalMemoryManifestPaths(item, paths));
      return paths;
    }
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => {
        const keyText = String(key || "").toLowerCase();
        if (typeof item === "string" && (keyText.includes("path") || keyText.includes("file") || keyText.includes("entry"))) {
          const pathValue = normalizeLocalMemoryManifestPath(item);
          if (pathValue) {
            paths.add(pathValue);
          }
        }
        extractLocalMemoryManifestPaths(item, paths);
      });
    }
    return paths;
  }

  function inferLocalMemorySetup(manifest, selectedSetup) {
    if (selectedSetup && selectedSetup !== "auto") {
      return selectedSetup;
    }
    if (valueContainsLocalMemoryString(manifest, "advanced_persona_profile")) {
      return "advanced_persona_profile";
    }
    if (valueContainsLocalMemoryString(manifest, "talisman_system")) {
      return "talisman_system";
    }
    if (valueContainsLocalMemoryString(manifest, "multi_agent_communication")) {
      return "multi_agent_communication";
    }
    if (valueContainsLocalMemoryString(manifest, "file_handoff_llm_wiki")) {
      return "file_handoff_llm_wiki";
    }
    if (valueContainsLocalMemoryString(manifest, "agent_file_handoff")) {
      return "agent_file_handoff";
    }
    if (valueContainsLocalMemoryString(manifest, "llm_wiki")) {
      return "llm_wiki";
    }
    return "base";
  }

  function uniqueLocalMemoryPaths(paths) {
    return Array.from(new Set(paths.map((path) => normalizeLocalMemoryPath(path)))).sort();
  }

  function orderedUniqueLocalMemoryPaths(paths) {
    const seen = new Set();
    const result = [];
    for (const path of paths) {
      const normalized = normalizeLocalMemoryPath(path);
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(normalized);
    }
    return result;
  }

  function localMemoryRequiredPaths(setup, manifest, entries, declaredPaths) {
    const required = [
      ...localMemoryUniversalPaths,
      ...localMemoryBaselinePaths
    ];
    if (setup === "agent_file_handoff" || setup === "file_handoff_llm_wiki") {
      required.push(...localMemoryFileHandoffPaths);
    }
    if (setup === "llm_wiki" || setup === "file_handoff_llm_wiki") {
      required.push(".uai/long-term-memory.uai");
    }
    if (setup === "file_handoff_llm_wiki" || localMemoryManifestBoolean(manifest, "code_like_artifacts")) {
      required.push(...localMemoryCodeBearingPaths);
    }
    if (setup === "multi_agent_communication") {
      required.push(...localMemoryMultiAgentPaths);
    }
    if (setup === "talisman_system") {
      required.push(...localMemoryTalismanPaths);
    }
    for (const [key, path] of localMemoryOptionalContentPaths) {
      const normalized = normalizeLocalMemoryPath(path);
      if (localMemoryManifestBoolean(manifest, key) || entries.has(normalized) || declaredPaths.has(normalized)) {
        required.push(path);
      }
    }
    if (setup === "advanced_persona_profile") {
      required.push(...localMemoryAdvancedPersonaPaths);
    }
    return uniqueLocalMemoryPaths(required);
  }

  function localMemoryTextContainsMarker(text, markers) {
    const normalized = String(text || "").toLowerCase();
    return markers.some((marker) => normalized.includes(String(marker).toLowerCase()));
  }

  function localMemoryDepthLevel(text) {
    const normalized = String(text || "").toLowerCase();
    for (const marker of ["depth_level_0_to_10", "depth level 0 to 10"]) {
      const index = normalized.indexOf(marker);
      if (index < 0) {
        continue;
      }
      const tail = normalized.slice(index + marker.length);
      const match = tail.match(/\d+/);
      if (!match) {
        continue;
      }
      const value = Number.parseInt(match[0], 10);
      if (Number.isInteger(value) && value >= 0 && value <= 10) {
        return value;
      }
    }
    return null;
  }

  function inspectLocalMemoryPersonaDimensions(entries, setup) {
    if (setup !== "advanced_persona_profile") {
      return [];
    }
    return localMemoryAdvancedPersonaDimensions.map(([dimension, path]) => {
      const normalized = normalizeLocalMemoryPath(path);
      const entry = entries.get(normalized) || null;
      const text = entry && entry.text ? entry.text : "";
      const warnings = [];
      const exists = Boolean(entry && entry.byteCount > 0);
      if (!exists) {
        warnings.push("persona dimension file is missing or empty");
      }
      const declaresDepthLevel = localMemoryTextContainsMarker(text, ["depth_level_0_to_10", "depth level 0 to 10"]);
      const depthLevel0To10 = localMemoryDepthLevel(text);
      const declaresDisclosureBoundary = localMemoryTextContainsMarker(text, ["disclosure_boundary", "disclosure boundary"]);
      const declaresSourceConfidence = localMemoryTextContainsMarker(text, ["source_confidence", "source confidence"]);
      const declaresNonInferenceRules = localMemoryTextContainsMarker(text, [
        "non_inference",
        "non-inference",
        "non inference",
        "do not infer",
        "no inference"
      ]);
      if (exists && !declaresDepthLevel) {
        warnings.push("persona dimension did not declare depth_level_0_to_10");
      }
      if (exists && depthLevel0To10 === null) {
        warnings.push("persona dimension did not provide a parsed depth value from 0 to 10");
      }
      if (exists && !declaresDisclosureBoundary) {
        warnings.push("persona dimension did not declare a disclosure boundary");
      }
      if (exists && !declaresSourceConfidence) {
        warnings.push("persona dimension did not declare source confidence");
      }
      if (exists && !declaresNonInferenceRules) {
        warnings.push("persona dimension did not declare non-inference rules");
      }
      return {
        dimension,
        path: normalized,
        exists,
        byteCount: entry ? entry.byteCount : 0,
        sha256: entry ? entry.sha256 : "",
        declaresDepthLevel,
        depthLevel0To10,
        declaresDisclosureBoundary,
        declaresSourceConfidence,
        declaresNonInferenceRules,
        valid: exists && declaresDepthLevel && depthLevel0To10 !== null && declaresDisclosureBoundary && declaresSourceConfidence && declaresNonInferenceRules,
        warnings
      };
    });
  }

  function localMemoryFileDeckSummary(requiredPaths, setup) {
    const normalizedPaths = uniqueLocalMemoryPaths(requiredPaths);
    const pathSet = new Set(normalizedPaths);
    const countFrom = (paths) => Array.from(new Set(paths.map((path) => normalizeLocalMemoryPath(path))))
      .filter((path) => pathSet.has(path)).length;
    const contains = (path) => pathSet.has(normalizeLocalMemoryPath(path));
    const startsWith = (prefix) => normalizedPaths.filter((path) => path.startsWith(prefix)).length;
    const baselineConfigurationPaths = localMemoryBaselinePaths.filter((path) => {
      const normalized = normalizeLocalMemoryPath(path);
      return normalized === ".uai/manifest.uaix.json"
        || normalized === ".uai/agent-pickup.uai"
        || normalized === ".uai/archives/session-log.uai"
        || normalized.startsWith(".uai/exports/");
    });
    const baselineProfilePaths = localMemoryBaselinePaths.filter((path) => {
      const normalized = normalizeLocalMemoryPath(path);
      return !baselineConfigurationPaths.some((configurationPath) => normalizeLocalMemoryPath(configurationPath) === normalized);
    });
    const triggeredStyleAxisPaths = localMemoryAdvancedPersonaPaths
      .filter((path) => localMemoryOptionalContentPaths.every((entry) => normalizeLocalMemoryPath(entry[1]) !== normalizeLocalMemoryPath(path)))
      .slice(-4)
      .map((path) => normalizeLocalMemoryPath(path));
    const advancedPersonaRequiredPaths = localMemoryAdvancedPersonaPaths.filter((path) => {
      const normalized = normalizeLocalMemoryPath(path);
      return normalized !== ".uai/readme.human" && !triggeredStyleAxisPaths.includes(normalized);
    });
    const configurationSpecificPaths = [
      ...baselineConfigurationPaths,
      ...localMemoryFileHandoffPaths,
      ...localMemoryMultiAgentPaths,
      ...(setup === "talisman_system" ? localMemoryTalismanPaths : []),
      ".uai/long-term-memory.uai",
      ".uai/readme.human"
    ];
    const contentTriggeredPaths = [
      ...localMemoryCodeBearingPaths,
      ...localMemoryOptionalContentPaths
        .map((entry) => entry[1])
        .filter((path) => setup !== "talisman_system" || normalizeLocalMemoryPath(path) !== "reports/deployment-memory-and-test-report.uai"),
      ...triggeredStyleAxisPaths
    ];
    return {
      totalRequiredFiles: normalizedPaths.length,
      universalRequiredFiles: countFrom(localMemoryUniversalPaths),
      profileRequiredFiles: countFrom(baselineProfilePaths),
      configurationSpecificRequiredFiles: countFrom(configurationSpecificPaths),
      contentTriggeredRequiredFiles: countFrom(contentTriggeredPaths),
      advancedPersonaRequiredFiles: countFrom(advancedPersonaRequiredPaths),
      evidenceFiles: startsWith(".uai/evidence/"),
      exportFiles: startsWith(".uai/exports/"),
      personaDimensionFiles: startsWith(".uai/personality/"),
      triggeredPersonaStyleAxisFiles: triggeredStyleAxisPaths.filter((path) => pathSet.has(path)).length,
      includesManifestOverlay: contains(".uai/exports/manifest-overlay.json"),
      includesPackageModel: contains(".uai/exports/package-model.json"),
      includesKnowledgeGraph: contains(".uai/exports/knowledge-graph.json"),
      includesLlmsExports: contains(".uai/exports/llms.uai") && contains(".uai/exports/llms-full.uai"),
      includesAgentPickup: contains(".uai/agent-pickup.uai"),
      includesSessionLog: contains(".uai/archives/session-log.uai"),
      includesPersonaSourceEvidence: contains(".uai/persona.uai")
        && contains(".uai/personality/preservation-rules.uai")
        && contains(".uai/evidence/source-excerpts.uai")
        && contains(".uai/evidence/provenance.uai"),
      closedRequiredFileSet: true
    };
  }

  function trimTextToByteLimit(text, byteLimit) {
    const limit = Math.max(0, Number.parseInt(byteLimit, 10) || 0);
    const value = String(text || "");
    if (state.encoder.encode(value).length <= limit) {
      return value;
    }
    let low = 0;
    let high = value.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (state.encoder.encode(value.slice(0, mid)).length <= limit) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return `${value.slice(0, low).trimEnd()}\n[trimmed]`;
  }

  function buildLocalMemoryContextText(entries, requiredPaths) {
    const contextPaths = orderedUniqueLocalMemoryPaths([
      ...localMemoryContextPriority,
      ...localMemoryAdvancedPersonaDimensions.map((entry) => entry[1]),
      ...requiredPaths.filter((path) => path.endsWith(".uai"))
    ]);
    const sections = [];
    let usedBytes = 0;
    for (const path of contextPaths) {
      const entry = entries.get(path);
      if (!entry || !entry.text || !entry.text.trim()) {
        continue;
      }
      const body = entry.text.replace(/\u0000/g, "").trim();
      if (!body) {
        continue;
      }
      const sectionHeader = `## ${path}\n`;
      const remaining = localMemoryContextByteLimit - usedBytes - state.encoder.encode(sectionHeader).length - 2;
      if (remaining < 96) {
        break;
      }
      const trimmedBody = trimTextToByteLimit(body, Math.min(remaining, 512));
      const section = `${sectionHeader}${trimmedBody}`;
      usedBytes += state.encoder.encode(`${section}\n\n`).length;
      sections.push(section);
      if (usedBytes >= localMemoryContextByteLimit) {
        break;
      }
    }
    return sections.join("\n\n").trim();
  }

  async function loadLocalMemoryPackageEntries(files) {
    if (!files.length) {
      throw new Error("Choose an extracted `.uai` folder before inspecting memory");
    }
    if (files.length > localMemoryPackageMaxFiles) {
      throw new Error(`UAIX memory deck exceeds ${localMemoryPackageMaxFiles} browser file limit`);
    }
    const entries = new Map();
    let totalBytes = 0;
    for (const file of files) {
      totalBytes += file.size || 0;
      if (totalBytes > localMemoryPackageMaxBytes) {
        throw new Error(`UAIX memory deck exceeds ${formatByteCount(localMemoryPackageMaxBytes)} browser limit`);
      }
      if (file.size > localMemoryPackageMaxFileBytes) {
        throw new Error(`${safeLocalModelName(file.name)} exceeds ${formatByteCount(localMemoryPackageMaxFileBytes)} per-file limit`);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      let text = "";
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch (_error) {
        text = "";
      }
      const relativePath = normalizeLocalMemoryPath(file.webkitRelativePath || localMemoryPathHintFromText(text) || file.name, file.name);
      if (entries.has(relativePath)) {
        throw new Error(`Duplicate UAIX memory file path: ${relativePath}`);
      }
      entries.set(relativePath, {
        path: relativePath,
        name: safeLocalModelName(file.name),
        byteCount: bytes.length,
        sha256: await sha256Hex(bytes),
        text
      });
    }
    return entries;
  }

  async function inspectLocalMemoryPackage(input = el.localMemoryPackageFiles, options = {}) {
    const files = localMemorySelectedFiles(input);
    const entries = await loadLocalMemoryPackageEntries(files);
    const manifestEntry = localMemoryManifestEntry(entries);
    if (!manifestEntry || !manifestEntry.text) {
      throw new Error("UAIX memory deck is missing `.uai/manifest.uaix.json`");
    }
    let manifest = null;
    try {
      manifest = JSON.parse(manifestEntry.text);
    } catch (error) {
      throw new Error(`UAIX memory manifest JSON is invalid: ${errorMessage(error)}`);
    }
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
      throw new Error("UAIX memory manifest must be a JSON object");
    }
    const declaredPaths = extractLocalMemoryManifestPaths(manifest);
    const selectedSetup = Object.prototype.hasOwnProperty.call(options, "setup")
      ? options.setup
      : (el.localMemoryPackageSetup ? el.localMemoryPackageSetup.value : "auto");
    const setup = inferLocalMemorySetup(manifest, selectedSetup);
    const requiredPaths = localMemoryRequiredPaths(setup, manifest, entries, declaredPaths);
    const requiredFiles = requiredPaths.map((path) => {
      const entry = entries.get(path) || null;
      return {
        path,
        exists: Boolean(entry && entry.byteCount > 0),
        byteCount: entry ? entry.byteCount : 0,
        sha256: entry ? entry.sha256 : ""
      };
    });
    const missingRequiredFiles = requiredFiles.filter((file) => !file.exists).map((file) => file.path);
    const manifestMissingRequiredFiles = requiredPaths.filter((path) => !declaredPaths.has(path));
    const personaDimensions = inspectLocalMemoryPersonaDimensions(entries, setup);
    const personaDimensionWarnings = personaDimensions.reduce((count, dimension) => count + dimension.warnings.length, 0);
    const personaDimensionsValid = setup !== "advanced_persona_profile" || personaDimensions.every((dimension) => dimension.valid);
    const valid = missingRequiredFiles.length === 0 && manifestMissingRequiredFiles.length === 0 && personaDimensionsValid;
    const contextText = valid ? buildLocalMemoryContextText(entries, requiredPaths) : "";
    const fileDeck = localMemoryFileDeckSummary(requiredPaths, setup);
    return {
      kind: "uaix.memory.browser_deck_inspection.v0",
      setup,
      setupLabel: localMemorySetupLabel(setup),
      fileCount: entries.size,
      byteCount: Array.from(entries.values()).reduce((total, entry) => total + entry.byteCount, 0),
      manifestSha256: manifestEntry.sha256,
      requiredFiles,
      fileDeck,
      missingRequiredFiles,
      manifestMissingRequiredFiles,
      manifestDeclaresRequiredFiles: manifestMissingRequiredFiles.length === 0,
      personaDimensions,
      personaDimensionsValid,
      personaDimensionWarnings,
      contextText,
      valid,
      sourceUrls: [uaixMemoryWizardUrl, uaixPersonaPackUrl],
      boundary: {
        browser_local_only: true,
        project_server_receives_memory_files: false,
        persona_source_mutation_allowed: false,
        native_archive_validation_package: "TinyRustLM.MemoryEndpoints"
      }
    };
  }

  function setLocalMemoryPackageStatus(text, isError) {
    if (el.localMemoryPackageStatus) {
      setText(el.localMemoryPackageStatus, text, isError);
    }
    updateModelSummary();
  }

  function renderLocalMemoryPackageSummary(inspection) {
    if (!el.localMemoryPackageSummary || !el.localMemoryPackageContextPreview) {
      return;
    }
    el.localMemoryPackageSummary.replaceChildren();
    if (!inspection) {
      el.localMemoryPackageSummary.hidden = true;
      el.localMemoryPackageContextPreview.textContent = "";
      return;
    }
    el.localMemoryPackageSummary.hidden = false;
    const summary = elementWithText(
      "strong",
      "",
      `${inspection.setupLabel} / ${inspection.fileCount} files / ${formatByteCount(inspection.byteCount)} / manifest ${shortSha256(inspection.manifestSha256)}`
    );
    el.localMemoryPackageSummary.append(summary);
    const required = elementWithText(
      "span",
      "",
      `${inspection.requiredFiles.length} required files checked; project server receives memory files: no`
    );
    el.localMemoryPackageSummary.append(required);
    if (inspection.fileDeck) {
      const deck = inspection.fileDeck;
      el.localMemoryPackageSummary.append(elementWithText(
        "span",
        "",
        `FileDeck ${deck.totalRequiredFiles} required / ${deck.personaDimensionFiles} persona / ${deck.evidenceFiles} evidence / ${deck.exportFiles} exports`
      ));
      if (deck.includesManifestOverlay && deck.includesPackageModel && deck.includesKnowledgeGraph && deck.includesLlmsExports) {
        el.localMemoryPackageSummary.append(elementWithText("span", "", "UAIX exports verified"));
      }
      if (deck.includesPersonaSourceEvidence) {
        el.localMemoryPackageSummary.append(elementWithText("span", "", "persona source evidence bound"));
      }
    }
    if (inspection.missingRequiredFiles.length) {
      el.localMemoryPackageSummary.append(elementWithText(
        "span",
        "memory-deck-warning",
        `Missing: ${inspection.missingRequiredFiles.slice(0, 6).join(", ")}`
      ));
    }
    if (inspection.manifestMissingRequiredFiles.length) {
      el.localMemoryPackageSummary.append(elementWithText(
        "span",
        "memory-deck-warning",
        `Manifest does not declare: ${inspection.manifestMissingRequiredFiles.slice(0, 6).join(", ")}`
      ));
    }
    if (inspection.personaDimensionWarnings > 0) {
      const warnings = inspection.personaDimensions
        .filter((dimension) => dimension.warnings.length)
        .slice(0, 4)
        .map((dimension) => `${dimension.dimension}: ${dimension.warnings[0]}`)
        .join("; ");
      el.localMemoryPackageSummary.append(elementWithText("span", "memory-deck-warning", warnings));
    }
    el.localMemoryPackageContextPreview.textContent = inspection.contextText || "No runtime memory context is active until the deck passes validation.";
  }

  async function bindLocalMemoryPackage(input = el.localMemoryPackageFiles, options = {}) {
    setLocalMemoryPackageStatus("inspecting UAIX memory deck", false);
    const inspection = await inspectLocalMemoryPackage(input, options);
    state.localMemoryPackage = inspection.valid ? inspection : null;
    renderLocalMemoryPackageSummary(inspection);
    if (!inspection.valid) {
      setLocalMemoryPackageStatus("UAIX memory deck failed validation; context not bound", true);
      return inspection;
    }
    setLocalMemoryPackageStatus(
      `${inspection.setupLabel} bound locally; ${inspection.requiredFiles.length} required files verified`,
      false
    );
    return inspection;
  }

  function clearLocalMemoryPackage() {
    state.localMemoryPackage = null;
    if (el.localMemoryPackageFiles) {
      el.localMemoryPackageFiles.value = "";
    }
    renderLocalMemoryPackageSummary(null);
    setLocalMemoryPackageStatus("memory deck optional", false);
  }

  function setLocalMemorySelectionStatus(input) {
    const files = localMemorySelectedFiles(input);
    if (!files.length) {
      setLocalMemoryPackageStatus("memory deck optional", false);
      return;
    }
    const totalBytes = files.reduce((total, file) => total + (file.size || 0), 0);
    setLocalMemoryPackageStatus(`${files.length} UAIX memory files selected / ${formatByteCount(totalBytes)}`, false);
  }

  function setMemoryEndpointsStatus(text, isError = false) {
    const fallback = state.memoryEndpoints && state.memoryEndpoints.enabled
      ? state.memoryEndpoints.connected
        ? "web memory connected"
        : "web memory configured"
      : "web memory off";
    const message = text || fallback;
    if (el.memoryEndpointsStatus) {
      el.memoryEndpointsStatus.textContent = message;
      el.memoryEndpointsStatus.classList.toggle("error", Boolean(isError));
    }
    updateModelSummary();
  }

  function requireMemoryEndpointsSync() {
    const sync = globalThis.TinyRustLMMemorySync;
    if (!sync || typeof sync.MemoryEndpointsOutboxStore !== "function") {
      throw new Error("MemoryEndpoints local outbox is unavailable");
    }
    return sync;
  }

  function memoryEndpointsStableId(prefix) {
    const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${suffix}`;
  }

  function memoryEndpointsDeviceId() {
    if (state.memoryEndpoints.deviceId) {
      return state.memoryEndpoints.deviceId;
    }
    const stored = storageGet(uiStorageKeys.memoryEndpointsDeviceId, "");
    state.memoryEndpoints.deviceId = /^[A-Za-z0-9._-]{1,96}$/.test(stored)
      ? stored
      : memoryEndpointsStableId("device");
    storageSet(uiStorageKeys.memoryEndpointsDeviceId, state.memoryEndpoints.deviceId);
    return state.memoryEndpoints.deviceId;
  }

  async function memoryEndpointsOutboxStore() {
    if (!state.memoryEndpoints.outboxStore) {
      const sync = requireMemoryEndpointsSync();
      state.memoryEndpoints.outboxStore = new sync.MemoryEndpointsOutboxStore();
    }
    await state.memoryEndpoints.outboxStore.open();
    state.memoryEndpoints.outboxReady = true;
    return state.memoryEndpoints.outboxStore;
  }

  function memoryEndpointsCoordinator() {
    if (!state.memoryEndpoints.coordinator) {
      const sync = requireMemoryEndpointsSync();
      const coordinator = new sync.MemoryEndpointsSyncCoordinator();
      coordinator.subscribe((notice) => {
        if (notice.workspaceId !== state.memoryEndpoints.workspaceId) {
          return;
        }
        memoryEndpointsOutboxStore()
          .then((store) => store.readPending(Date.now()))
          .then((recovery) => {
            state.memoryEndpoints.pendingCount = recovery.pending.length;
            if (recovery.pending.length > 0) {
              setMemoryEndpointsStatus(memoryEndpointsPendingStatus(recovery.pending.length), false);
            } else if (notice.eventIds.length > 0) {
              setMemoryEndpointsStatus("web memory synchronized in another tab", false);
            }
          })
          .catch((error) => {
            setMemoryEndpointsStatus(`web memory refresh failed: ${errorMessage(error)}`, true);
          });
      });
      state.memoryEndpoints.coordinator = coordinator;
    }
    return state.memoryEndpoints.coordinator;
  }

  function memoryEndpointsPendingStatus(count) {
    if (!count) {
      return "";
    }
    const noun = count === 1 ? "write" : "writes";
    if (!state.memoryEndpoints.enabled) {
      return `${count} web memory ${noun} saved locally; web memory is off`;
    }
    if (!state.memoryEndpoints.bearerToken) {
      return `${count} web memory ${noun} queued; workspace key required to synchronize`;
    }
    return `${count} web memory ${noun} queued for synchronization`;
  }

  async function initializeMemoryEndpointsOutbox() {
    try {
      memoryEndpointsDeviceId();
      const store = await memoryEndpointsOutboxStore();
      const recovery = await store.readPending(Date.now());
      state.memoryEndpoints.pendingCount = recovery.pending.length;
      state.memoryEndpoints.quarantineCount = recovery.quarantined.length;
      if (recovery.quarantined.length > 0) {
        const noun = recovery.quarantined.length === 1 ? "item" : "items";
        setMemoryEndpointsStatus(
          `${recovery.quarantined.length} web memory ${noun} quarantined; hosted send blocked`,
          true
        );
      } else if (recovery.pending.length > 0) {
        setMemoryEndpointsStatus(memoryEndpointsPendingStatus(recovery.pending.length), false);
      }
    } catch (error) {
      state.memoryEndpoints.outboxReady = false;
      setMemoryEndpointsStatus(`local web memory unavailable: ${errorMessage(error)}`, true);
    }
  }

  function memoryEndpointsLooksLikeSecret(value) {
    const text = String(value || "");
    if (!text) {
      return false;
    }
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(text)) {
      return true;
    }
    if (/\b(?:bearer|basic)\s+[a-z0-9._~+/=-]{16,}/i.test(text)) {
      return true;
    }
    if (/(?:api[_-]?key|password|passwd|secret|token)\s*[:=]\s*\S{8,}/i.test(text)) {
      return true;
    }
    return text
      .split(/[^A-Za-z0-9_-]+/)
      .some((part) => {
        if (part.length < 64 || /^[0-9a-f]{64}$/i.test(part)) {
          return false;
        }
        return /[A-Za-z]/.test(part) && /[0-9_-]/.test(part);
      });
  }

  function memoryEndpointsPublicText(value, label, options = {}) {
    const allowEmpty = Boolean(options.allowEmpty);
    const maxChars = Number.isFinite(options.maxChars) ? options.maxChars : memoryEndpointsMaxSafeTextChars;
    const clean = String(value || "")
      .replace(/\u0000/g, "")
      .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim();
    if (!clean) {
      if (allowEmpty) {
        return "";
      }
      throw new Error(`${label} is required`);
    }
    const bounded = clean.length > maxChars ? `${clean.slice(0, Math.max(0, maxChars - 12)).trimEnd()}\n[trimmed]` : clean;
    if (memoryEndpointsLooksLikeSecret(bounded)) {
      throw new Error(`${label} appears to contain secret material; save a public-safe summary instead`);
    }
    return bounded;
  }

  function memoryEndpointsNormalizeIdentifier(value, label, maxChars, options = {}) {
    const required = Boolean(options.required);
    const text = String(value || "").trim();
    if (!text) {
      if (required) {
        throw new Error(`${label} is required`);
      }
      return "";
    }
    if (text.length > maxChars) {
      throw new Error(`${label} may not exceed ${maxChars} characters`);
    }
    if (!/^[A-Za-z0-9._-]+$/.test(text)) {
      throw new Error(`${label} may contain only letters, numbers, dash, underscore, and dot`);
    }
    return text;
  }

  function memoryEndpointsNormalizeBaseUrl(value, options = {}) {
    const required = Boolean(options.required);
    const raw = String(value || "").trim();
    if (!raw) {
      if (required) {
        throw new Error("MemoryEndpoints URL is required");
      }
      return memoryEndpointsDefaultBaseUrl;
    }
    if (memoryEndpointsLooksLikeSecret(raw)) {
      throw new Error("MemoryEndpoints URL must not contain bearer tokens, API keys, or passwords");
    }
    if (raw.startsWith("/")) {
      if (
        raw.startsWith("//") ||
        raw.includes("\\") ||
        raw.includes("?") ||
        raw.includes("#") ||
        raw.split("/").some((part) => part === "..") ||
        !raw.startsWith(memoryEndpointsSameOriginRelayBaseUrl)
      ) {
        throw new Error("MemoryEndpoints same-origin relay URL must be under /api/memoryendpoints");
      }
      return raw.replace(/\/+$/g, "") || memoryEndpointsSameOriginRelayBaseUrl;
    }
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed = null;
    try {
      parsed = new URL(withScheme);
    } catch (_error) {
      throw new Error("MemoryEndpoints URL must be a valid URL");
    }
    const host = parsed.hostname.toLowerCase();
    const loopbackHttp = parsed.protocol === "http:" && (host === "localhost" || host === "127.0.0.1" || host === "::1");
    if (parsed.protocol !== "https:" && !loopbackHttp) {
      throw new Error("MemoryEndpoints URL must use HTTPS, except loopback HTTP for local testing");
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("MemoryEndpoints URL must not include credentials, query strings, or fragments");
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/g, "");
    return parsed.toString().replace(/\/+$/g, "");
  }

  function memoryEndpointsNormalizeAuthHeader(value) {
    const text = String(value || "").trim().toLowerCase();
    return text === "x-memoryendpoints-key"
      ? "x-memoryendpoints-key"
      : memoryEndpointsDefaultAuthHeader;
  }

  function memoryEndpointsNormalizeSearchTier(value) {
    const text = String(value || "").trim().toLowerCase();
    return text === "short_term" || text === "long_term" ? text : "all";
  }

  function memoryEndpointsMemoryTypeForTier(tier) {
    if (tier === "short_term") {
      return "status";
    }
    if (tier === "long_term") {
      return "handoff";
    }
    return "";
  }

  function persistMemoryEndpointsSettings() {
    storageSet(uiStorageKeys.memoryEndpointsEnabled, state.memoryEndpoints.enabled ? "true" : "false");
    storageSet(uiStorageKeys.memoryEndpointsBaseUrl, state.memoryEndpoints.baseUrl || memoryEndpointsDefaultBaseUrl);
    if (state.memoryEndpoints.connectionMode === "agent") {
      storageRemove(uiStorageKeys.memoryEndpointsWorkspaceId);
    } else {
      storageSet(uiStorageKeys.memoryEndpointsWorkspaceId, state.memoryEndpoints.workspaceId || "");
    }
    storageSet(uiStorageKeys.memoryEndpointsAgentId, state.memoryEndpoints.agentId || "tinyrustlm-agent");
    storageSet(uiStorageKeys.memoryEndpointsAuthHeader, state.memoryEndpoints.authHeader || memoryEndpointsDefaultAuthHeader);
    storageSet(uiStorageKeys.memoryEndpointsSearchTier, state.memoryEndpoints.searchTier || "all");
  }

  function syncMemoryEndpointsControls() {
    if (el.memoryEndpointsEnabled) {
      el.memoryEndpointsEnabled.checked = Boolean(state.memoryEndpoints.enabled);
    }
    if (el.memoryEndpointsBaseUrl) {
      el.memoryEndpointsBaseUrl.value = state.memoryEndpoints.baseUrl || memoryEndpointsDefaultBaseUrl;
    }
    if (el.memoryEndpointsWorkspaceId) {
      el.memoryEndpointsWorkspaceId.value = state.memoryEndpoints.connectionMode === "agent"
        ? ""
        : state.memoryEndpoints.workspaceId || "";
    }
    if (el.memoryEndpointsAgentId) {
      el.memoryEndpointsAgentId.value = state.memoryEndpoints.agentId || "tinyrustlm-agent";
    }
    if (el.memoryEndpointsRequestedAgentName && !el.memoryEndpointsRequestedAgentName.value) {
      el.memoryEndpointsRequestedAgentName.value = state.memoryEndpoints.agentId || "tinyrustlm-agent";
    }
    if (el.memoryEndpointsReconnectName && !el.memoryEndpointsReconnectName.value) {
      el.memoryEndpointsReconnectName.value = state.memoryEndpoints.agentId || "";
    }
    if (el.memoryEndpointsAuthHeader) {
      el.memoryEndpointsAuthHeader.value = state.memoryEndpoints.authHeader || memoryEndpointsDefaultAuthHeader;
    }
    if (el.memoryEndpointsSearchTier) {
      el.memoryEndpointsSearchTier.value = state.memoryEndpoints.searchTier || "all";
    }
    renderMemoryEndpointsSearchResults();
    setMemoryEndpointsStatus("", false);
  }

  function restoreMemoryEndpointsSettings() {
    state.memoryEndpoints.enabled = storageGet(uiStorageKeys.memoryEndpointsEnabled, "false") === "true";
    try {
      state.memoryEndpoints.baseUrl = memoryEndpointsNormalizeBaseUrl(
        storageGet(uiStorageKeys.memoryEndpointsBaseUrl, memoryEndpointsDefaultBaseUrl)
      );
    } catch (_error) {
      state.memoryEndpoints.baseUrl = memoryEndpointsDefaultBaseUrl;
    }
    try {
      state.memoryEndpoints.workspaceId = memoryEndpointsNormalizeIdentifier(
        storageGet(uiStorageKeys.memoryEndpointsWorkspaceId, ""),
        "Workspace ID",
        128,
        { required: false }
      );
    } catch (_error) {
      state.memoryEndpoints.workspaceId = "";
    }
    try {
      state.memoryEndpoints.agentId = memoryEndpointsNormalizeIdentifier(
        storageGet(uiStorageKeys.memoryEndpointsAgentId, "tinyrustlm-agent"),
        "Agent ID",
        96,
        { required: false }
      ) || "tinyrustlm-agent";
    } catch (_error) {
      state.memoryEndpoints.agentId = "tinyrustlm-agent";
    }
    state.memoryEndpoints.authHeader = memoryEndpointsNormalizeAuthHeader(
      storageGet(uiStorageKeys.memoryEndpointsAuthHeader, memoryEndpointsDefaultAuthHeader)
    );
    state.memoryEndpoints.connectionMode = "workspace";
    cancelMemoryEndpointsEnrollment();
    state.memoryEndpoints.searchTier = memoryEndpointsNormalizeSearchTier(
      storageGet(uiStorageKeys.memoryEndpointsSearchTier, "all")
    );
    state.memoryEndpoints.bearerToken = "";
    state.memoryEndpoints.connected = false;
    state.memoryEndpoints.searchResults = [];
    state.memoryEndpoints.retrievalResults = [];
    state.memoryEndpoints.retrievalCandidates = [];
    state.memoryEndpoints.packedContext = null;
    state.memoryEndpoints.packedModelKey = "";
    state.memoryEndpoints.retrievalReceipt = null;
    syncMemoryEndpointsControls();
  }

  function invalidateMemoryEndpointsRetrieval(clearPreview) {
    state.memoryEndpoints.retrievalGeneration += 1;
    state.memoryEndpoints.retrievalCandidates = [];
    state.memoryEndpoints.packedContext = null;
    state.memoryEndpoints.packedModelKey = "";
    state.memoryEndpoints.retrievalReceipt = null;
    if (clearPreview) {
      state.memoryEndpoints.searchResults = [];
      state.memoryEndpoints.retrievalResults = [];
    } else {
      state.memoryEndpoints.searchResults = state.memoryEndpoints.searchResults.map((result) => ({
        ...result,
        contextEligible: false
      }));
    }
  }

  function readMemoryEndpointsSettings(options = {}) {
    const requireEnabled = Boolean(options.requireEnabled);
    const requireAuth = Boolean(options.requireAuth);
    const requireIdentity = Boolean(options.requireIdentity) || requireAuth;
    const enabled = el.memoryEndpointsEnabled ? Boolean(el.memoryEndpointsEnabled.checked) : Boolean(state.memoryEndpoints.enabled);
    const baseUrl = memoryEndpointsNormalizeBaseUrl(
      el.memoryEndpointsBaseUrl ? el.memoryEndpointsBaseUrl.value : state.memoryEndpoints.baseUrl,
      { required: requireIdentity }
    );
    const workspaceId = memoryEndpointsNormalizeIdentifier(
      state.memoryEndpoints.connectionMode === "agent"
        ? state.memoryEndpoints.workspaceId
        : el.memoryEndpointsWorkspaceId
          ? el.memoryEndpointsWorkspaceId.value
          : state.memoryEndpoints.workspaceId,
      "Workspace ID",
      128,
      { required: requireIdentity }
    );
    const agentId = memoryEndpointsNormalizeIdentifier(
      el.memoryEndpointsAgentId ? el.memoryEndpointsAgentId.value : state.memoryEndpoints.agentId,
      "Agent ID",
      96,
      { required: requireIdentity }
    ) || "tinyrustlm-agent";
    const token = el.memoryEndpointsToken && el.memoryEndpointsToken.value
      ? el.memoryEndpointsToken.value.trim()
      : state.memoryEndpoints.bearerToken;
    const authHeader = memoryEndpointsNormalizeAuthHeader(
      el.memoryEndpointsAuthHeader ? el.memoryEndpointsAuthHeader.value : state.memoryEndpoints.authHeader
    );
    const searchTier = memoryEndpointsNormalizeSearchTier(
      el.memoryEndpointsSearchTier ? el.memoryEndpointsSearchTier.value : state.memoryEndpoints.searchTier
    );
    if (requireEnabled && !enabled) {
      throw new Error("Turn on MemoryEndpoints.com hosted memory before using web memory");
    }
    if (requireAuth && !token) {
      throw new Error("Workspace key is required for hosted memory");
    }
    const authorityChanged = baseUrl !== state.memoryEndpoints.baseUrl ||
      workspaceId !== state.memoryEndpoints.workspaceId ||
      agentId !== state.memoryEndpoints.agentId;
    state.memoryEndpoints.enabled = enabled;
    state.memoryEndpoints.baseUrl = baseUrl;
    state.memoryEndpoints.workspaceId = workspaceId;
    state.memoryEndpoints.agentId = agentId;
    state.memoryEndpoints.authHeader = authHeader;
    state.memoryEndpoints.searchTier = searchTier;
    state.memoryEndpoints.bearerToken = token || "";
    if (authorityChanged) {
      invalidateMemoryEndpointsRetrieval(true);
    }
    persistMemoryEndpointsSettings();
    syncMemoryEndpointsControls();
    return state.memoryEndpoints;
  }

  function memoryEndpointsUrl(path) {
    return `${state.memoryEndpoints.baseUrl.replace(/\/+$/g, "")}${path}`;
  }

  function memoryEndpointsIdempotencyKey(prefix) {
    const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${suffix}`;
  }

  function memoryEndpointsAuthHeaders() {
    if (state.memoryEndpoints.authHeader === "x-memoryendpoints-key") {
      return { "X-MemoryEndpoints-Key": state.memoryEndpoints.bearerToken };
    }
    return { "Authorization": `Bearer ${state.memoryEndpoints.bearerToken}` };
  }


  /** Bind session-only enrollment recovery to the currently selected service. */
  function memoryEndpointsEnrollmentFlow() {
    if (!memoryEndpointsEnrollmentApi) {
      throw new Error("MemoryEndpoints agent enrollment support is unavailable");
    }
    const baseUrl = memoryEndpointsNormalizeBaseUrl(
      el.memoryEndpointsBaseUrl ? el.memoryEndpointsBaseUrl.value : state.memoryEndpoints.baseUrl,
      { required: true }
    );
    if (
      !state.memoryEndpoints.enrollmentFlow ||
      state.memoryEndpoints.enrollmentFlowBaseUrl !== baseUrl
    ) {
      cancelMemoryEndpointsEnrollment();
      state.memoryEndpoints.enrollmentFlow = new memoryEndpointsEnrollmentApi.MemoryEndpointsEnrollmentFlow({
        client: new memoryEndpointsEnrollmentApi.MemoryEndpointsEnrollmentClient({ baseUrl }),
        createIdempotencyKey: () => memoryEndpointsIdempotencyKey("tinyrustlm-agent-claim")
      });
      state.memoryEndpoints.enrollmentFlowBaseUrl = baseUrl;
    }
    state.memoryEndpoints.baseUrl = baseUrl;
    return state.memoryEndpoints.enrollmentFlow;
  }

  /** Clear recovery on explicit authority changes; late results retain an aborted signal. */
  function cancelMemoryEndpointsEnrollment() {
    if (state.memoryEndpoints.enrollmentFlow) state.memoryEndpoints.enrollmentFlow.cancel();
    state.memoryEndpoints.enrollmentFlow = null;
    state.memoryEndpoints.enrollmentFlowBaseUrl = "";
    syncMemoryEndpointsEnrollmentButtons();
  }

  /** Claim and reconnect are exclusive, including restore and activation. */
  function syncMemoryEndpointsEnrollmentButtons() {
    const busy = Boolean(state.memoryEndpoints.enrollmentFlow && state.memoryEndpoints.enrollmentFlow.busy);
    for (const button of [el.memoryEndpointsClaimButton, el.memoryEndpointsReconnectButton]) {
      if (button) button.disabled = busy;
    }
  }

  /** Apply a validated restore only while its initiating enrollment operation still owns the session. */
  async function activateMemoryEndpointsAgentSession(reconnect, signal) {
    signal.throwIfAborted();
    cancelMemoryEndpointsRequests();
    state.memoryEndpoints.enabled = true;
    state.memoryEndpoints.connectionMode = "agent";
    state.memoryEndpoints.workspaceId = reconnect.workspaceId;
    state.memoryEndpoints.agentId = reconnect.canonicalAgentName;
    state.memoryEndpoints.authHeader = memoryEndpointsDefaultAuthHeader;
    state.memoryEndpoints.bearerToken = reconnect.agentToken;
    state.memoryEndpoints.connected = true;
    invalidateMemoryEndpointsRetrieval(true);
    if (el.memoryEndpointsEnabled) {
      el.memoryEndpointsEnabled.checked = true;
    }
    persistMemoryEndpointsSettings();
    syncMemoryEndpointsControls();
    const drain = await drainMemoryEndpointsOutbox();
    signal.throwIfAborted();
    if (drain.lastError) {
      state.memoryEndpoints.connected = false;
      throw new Error(drain.lastError);
    }
    setMemoryEndpointsStatus(
      drain.pending > 0 ? memoryEndpointsPendingStatus(drain.pending) : "agent memory restored",
      false
    );
    return reconnect;
  }

  /** A second explicit click recovers the original claim without persisting its invitation or key. */
  async function claimMemoryEndpointsEnrollment() {
    const invitationUrl = el.memoryEndpointsEnrollmentUrl
      ? el.memoryEndpointsEnrollmentUrl.value.trim()
      : "";
    const agreedAgentName = memoryEndpointsNormalizeIdentifier(
      el.memoryEndpointsRequestedAgentName ? el.memoryEndpointsRequestedAgentName.value : "",
      "Agent name",
      96,
      { required: true }
    );
    if (el.memoryEndpointsEnrollmentUrl) {
      el.memoryEndpointsEnrollmentUrl.value = "";
    }
    const flow = memoryEndpointsEnrollmentFlow();
    setMemoryEndpointsStatus("claiming one-time agent URL", false);
    await flow.claim({
      invitationUrl,
      agreedAgentName,
      onCredentials(claim) {
        if (el.memoryEndpointsCanonicalAgentName) {
          el.memoryEndpointsCanonicalAgentName.value = claim.canonicalAgentName;
        }
        if (el.memoryEndpointsAgentToken) {
          el.memoryEndpointsAgentToken.value = claim.agentToken;
        }
        if (el.memoryEndpointsIssuedCredentials) {
          el.memoryEndpointsIssuedCredentials.hidden = false;
        }
        if (el.memoryEndpointsReconnectName) {
          el.memoryEndpointsReconnectName.value = claim.canonicalAgentName;
        }
      },
      async onReady(session, signal) {
        await activateMemoryEndpointsAgentSession(session, signal);
        signal.throwIfAborted();
        setMemoryEndpointsStatus("agent created; keep the displayed name and token", false);
      }
    });
  }

  /** Keep failed reconnect credentials in session memory for an explicit same-name retry. */
  async function reconnectMemoryEndpointsAgent() {
    const canonicalAgentName = memoryEndpointsNormalizeIdentifier(
      el.memoryEndpointsReconnectName ? el.memoryEndpointsReconnectName.value : "",
      "Agent name",
      96,
      { required: true }
    );
    const agentToken = el.memoryEndpointsReconnectToken
      ? el.memoryEndpointsReconnectToken.value.trim()
      : "";
    if (el.memoryEndpointsReconnectToken) {
      el.memoryEndpointsReconnectToken.value = "";
    }
    setMemoryEndpointsStatus("restoring agent memory", false);
    await memoryEndpointsEnrollmentFlow().reconnect({ canonicalAgentName, agentToken,
      onReady: activateMemoryEndpointsAgentSession });
  }

  async function copyMemoryEndpointsIssuedCredentials() {
    const canonicalAgentName = el.memoryEndpointsCanonicalAgentName
      ? el.memoryEndpointsCanonicalAgentName.value
      : "";
    const agentToken = el.memoryEndpointsAgentToken ? el.memoryEndpointsAgentToken.value : "";
    if (!canonicalAgentName || !agentToken) {
      throw new Error("No new agent access is available to copy");
    }
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      throw new Error("Clipboard access is unavailable");
    }
    await navigator.clipboard.writeText(`${canonicalAgentName}\n${agentToken}`);
    setMemoryEndpointsStatus("agent name and token copied", false);
  }

  function clearMemoryEndpointsSessionSecrets() {
    cancelMemoryEndpointsRequests();
    cancelMemoryEndpointsEnrollment();
    state.memoryEndpoints.bearerToken = "";
    for (const input of [
      el.memoryEndpointsEnrollmentUrl,
      el.memoryEndpointsAgentToken,
      el.memoryEndpointsReconnectToken,
      el.memoryEndpointsToken
    ]) {
      if (input) {
        input.value = "";
      }
    }
  }

  /** End this request generation even if the same service and credential are later selected again. */
  function cancelMemoryEndpointsRequests() {
    invalidateMemoryEndpointsRetrieval(true);
    state.memoryEndpoints.requestController.abort();
    state.memoryEndpoints.requestController = new AbortController();
    state.memoryEndpoints.drainPromise = null;
    state.memoryEndpoints.drainAuthority = null;
  }

  /** Editing authority drops credentials instead of carrying an old key into a new service or identity. */
  function invalidateMemoryEndpointsAuthorization() {
    clearMemoryEndpointsSessionSecrets();
    state.memoryEndpoints.connected = false;
    if (state.memoryEndpoints.connectionMode === "agent") state.memoryEndpoints.workspaceId = "";
    state.memoryEndpoints.connectionMode = "workspace";
    if (el.memoryEndpointsIssuedCredentials) el.memoryEndpointsIssuedCredentials.hidden = true;
    if (el.memoryEndpointsCanonicalAgentName) el.memoryEndpointsCanonicalAgentName.value = "";
    invalidateMemoryEndpointsRetrieval(true);
  }

  /** Capture runtime authority before asynchronous work; never persist its session credential. */
  function memoryEndpointsRequestAuthority() {
    const submitUrl = new URL(memoryEndpointsUrl(memoryEndpointsSubmitPath), window.location.href);
    return Object.freeze({
      baseUrl: state.memoryEndpoints.baseUrl,
      serviceOrigin: requireMemoryEndpointsSync().requireServiceOrigin(submitUrl.origin),
      submitUrl: submitUrl.href,
      signal: state.memoryEndpoints.requestController.signal,
      workspaceId: state.memoryEndpoints.workspaceId,
      actorAgentId: state.memoryEndpoints.agentId,
      authHeader: state.memoryEndpoints.authHeader,
      bearerToken: state.memoryEndpoints.bearerToken
    });
  }

  /** Refuse a queued request or completion after any part of its authorization changes. */
  function requireMemoryEndpointsAuthority(authority) {
    const current = state.memoryEndpoints;
    if (authority.signal.aborted || !current.enabled || current.baseUrl !== authority.baseUrl ||
        current.workspaceId !== authority.workspaceId || current.agentId !== authority.actorAgentId ||
        current.authHeader !== authority.authHeader || current.bearerToken !== authority.bearerToken) {
      const error = new Error("Web memory connection changed; connect before retrying");
      error.code = "memory_authority_changed";
      throw error;
    }
  }

  /** Send a JSON object under the captured session, rejecting malformed or late responses. */
  async function memoryEndpointsPost(path, payload, idempotencyPrefix, options = {}) {
    readMemoryEndpointsSettings({ requireEnabled: true, requireAuth: true });
    const authority = options.authority || memoryEndpointsRequestAuthority();
    requireMemoryEndpointsAuthority(authority);
    try {
      const response = await memoryEndpointsHttpClient.request(new URL(memoryEndpointsUrl(path), window.location.href).href, {
        method: "POST", payload, signal: authority.signal,
        headers: { ...memoryEndpointsAuthHeaders(),
          "Idempotency-Key": options.idempotencyKey || memoryEndpointsIdempotencyKey(idempotencyPrefix) }
      });
      requireMemoryEndpointsAuthority(authority);
      return response;
    } catch (error) {
      requireMemoryEndpointsAuthority(authority);
      throw error;
    }
  }

  /** Keep query encoding and credentials bound to one selected session through body completion. */
  async function memoryEndpointsGet(path, query, authority) {
    readMemoryEndpointsSettings({ requireEnabled: true, requireAuth: true });
    authority = authority || memoryEndpointsRequestAuthority();
    requireMemoryEndpointsAuthority(authority);
    const url = new URL(memoryEndpointsUrl(path), window.location.href);
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    try {
      const response = await memoryEndpointsHttpClient.request(url.href, {
        signal: authority.signal, headers: memoryEndpointsAuthHeaders()
      });
      requireMemoryEndpointsAuthority(authority);
      return response;
    } catch (error) {
      requireMemoryEndpointsAuthority(authority);
      throw error;
    }
  }

  async function pullMemoryEndpointsSnapshot(authority) {
    const sync = requireMemoryEndpointsSync();
    const response = await memoryEndpointsGet(memoryEndpointsListPath, {
      workspaceId: authority.workspaceId,
      agentId: authority.actorAgentId,
      actorAgentId: authority.actorAgentId,
      actor_agent_id: authority.actorAgentId,
      scope: memoryEndpointsTinyRustLmScope,
      scopeId: memoryEndpointsTinyRustLmScopeId,
      limit: 10000
    }, authority);
    const snapshot = sync.normalizeMemoryEventsPull(response, {
      serviceOrigin: authority.serviceOrigin,
      pullUrl: new URL(memoryEndpointsUrl(memoryEndpointsListPath), window.location.href).href,
      workspaceId: authority.workspaceId,
      actorAgentId: authority.actorAgentId,
      pulledAtUnixMs: Date.now()
    });
    const store = await memoryEndpointsOutboxStore();
    requireMemoryEndpointsAuthority(authority);
    await store.commitPullSnapshot(snapshot, { signal: authority.signal });
    requireMemoryEndpointsAuthority(authority);
    return snapshot;
  }

  async function connectMemoryEndpoints() {
    cancelMemoryEndpointsRequests();
    if (el.memoryEndpointsEnabled) {
      el.memoryEndpointsEnabled.checked = true;
    }
    state.memoryEndpoints.connectionMode = "workspace";
    readMemoryEndpointsSettings({ requireAuth: true });
    const authority = memoryEndpointsRequestAuthority();
    state.memoryEndpoints.enabled = true;
    state.memoryEndpoints.connectionMode = "workspace";
    persistMemoryEndpointsSettings();
    setMemoryEndpointsStatus("connecting hosted memory", false);
    await memoryEndpointsPost(
      memoryEndpointsRegisterPath,
      {
        workspaceId: state.memoryEndpoints.workspaceId,
        agentId: state.memoryEndpoints.agentId,
        displayName: "TinyRustLM Browser",
        safeSummary: "TinyRustLM.com Connect plugin configured opt-in MemoryEndpoints.com long-term memory."
      },
      "tinyrustlm-register-agent"
    );
    state.memoryEndpoints.connected = true;
    const drain = await drainMemoryEndpointsOutbox();
    requireMemoryEndpointsAuthority(authority);
    if (drain.lastError) {
      state.memoryEndpoints.connected = false;
      throw new Error(drain.lastError);
    }
    setMemoryEndpointsStatus(
      drain.pending > 0 ? memoryEndpointsPendingStatus(drain.pending) : "web memory connected",
      false
    );
  }

  function memoryEndpointsShortText(value, maxChars = 2400) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars)
      .trim();
  }

  function memoryEndpointsUaiReferences(scope) {
    const references = new Set([
      ".uai/short-term-memory.uai",
      "docs/nuget/MEMORY_ENDPOINTS_CONNECTOR.md"
    ]);
    if (scope === "long_term") {
      references.add(".uai/long-term-memory.uai");
    }
    const memory = state.localMemoryPackage;
    if (memory && memory.valid && Array.isArray(memory.requiredFiles)) {
      for (const entry of memory.requiredFiles) {
        if (references.size >= 16) {
          break;
        }
        const path = entry && entry.path ? String(entry.path).replace(/\\/g, "/") : "";
        if (path.startsWith(".uai/")) {
          references.add(path);
        }
      }
    }
    return Array.from(references);
  }

  async function buildMemoryEndpointsRecord(scope, authority) {
    const memoryTier = scope === "long_term" ? "long_term" : "short_term";
    const memoryType = memoryTier === "long_term" ? "handoff" : "status";
    const tierTag = memoryTier.replace("_", "-");
    const selectedModel = el.modelSelect && el.modelSelect.selectedOptions && el.modelSelect.selectedOptions[0]
      ? el.modelSelect.selectedOptions[0].textContent.trim()
      : "TinyRustLM local model";
    const conversation = activeConversation();
    const latestUser = conversation
      ? [...conversation.messages].reverse().find((message) => message.role === "user")
      : null;
    const latestAssistant = conversation ? conversationApi.latestAssistantMessage(conversation) : null;
    const promptSummary = memoryEndpointsShortText(latestUser ? latestUser.text : "", 3600);
    const responseSummary = memoryEndpointsShortText(latestAssistant ? latestAssistant.text : "", 3600);
    const localMemoryText = state.localMemoryPackage && state.localMemoryPackage.valid
      ? `${state.localMemoryPackage.setupLabel} local .uai deck is bound`
      : "No local .uai deck is bound";
    const title = memoryTier === "long_term"
      ? "TinyRustLM durable hosted memory"
      : "TinyRustLM active hosted memory";
    const safeSummary = memoryEndpointsPublicText([
      `TinyRustLM browser memory record (${memoryTier}).`,
      `model=${selectedModel || "unknown"}.`,
      localMemoryText,
      promptSummary ? `user_prompt_summary=${promptSummary}` : "",
      responseSummary ? `assistant_response_summary=${responseSummary}` : "assistant_response_summary=none yet"
    ].filter(Boolean).join("\n"), "MemoryEndpoints memory summary", { maxChars: 4000 });
    return {
      workspaceId: authority.workspaceId,
      actorAgentId: authority.actorAgentId,
      kind: "tinyrustlm.memory_endpoints.memory_record.v1",
      version: 1,
      scope: memoryEndpointsTinyRustLmScope,
      scopeId: memoryEndpointsTinyRustLmScopeId,
      memoryType,
      subject: title,
      title,
      summary: safeSummary,
      source: memoryEndpointsConnectorSource,
      confidence: 0.8,
      uaiReferences: memoryEndpointsUaiReferences(memoryTier),
      tags: ["tinyrustlm", "memoryendpoints", tierTag, `scope:${memoryEndpointsTinyRustLmScopeId}`],
      tinyrustlmMemoryTier: memoryTier,
      sourceSha256: (await sha256Hex(state.encoder.encode(safeSummary))).replace(/^sha256:/, "")
    };
  }

  function memoryEndpointsResponseValue(payload, names) {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    for (const name of names) {
      if (payload[name] !== null && payload[name] !== undefined && payload[name] !== "") {
        return payload[name];
      }
    }
    if (payload.data && typeof payload.data === "object") {
      return memoryEndpointsResponseValue(payload.data, names);
    }
    return null;
  }

  function memoryEndpointsAuthoritativeReceipt(entry, response, verifiedAtUnixMs) {
    if (!response || response.persisted !== true) {
      throw new Error("MemoryEndpoints response did not prove persistence");
    }
    const memoryEventId = memoryEndpointsResponseValue(response, [
      "canonicalMemoryEventId",
      "memoryEventId",
      "memory_event_id"
    ]);
    if (!memoryEventId) {
      throw new Error("MemoryEndpoints response did not include a canonical memory event ID");
    }
    const receiptId = memoryEndpointsResponseValue(response, ["receiptId", "receipt_id"]);
    const revisionId = memoryEndpointsResponseValue(response, ["revisionId", "revision_id"]);
    const serverSequenceValue = memoryEndpointsResponseValue(response, ["serverSequence", "server_sequence"]);
    const serverSequence = Number.isSafeInteger(Number(serverSequenceValue)) && Number(serverSequenceValue) > 0
      ? Number(serverSequenceValue)
      : null;
    return {
      kind: requireMemoryEndpointsSync().AUTHORITATIVE_RECEIPT_KIND,
      version: 1,
      eventId: entry.eventId,
      idempotencyKey: entry.idempotencyKey,
      payloadSha256: entry.payloadSha256,
      memoryEventId: String(memoryEventId),
      receiptId: receiptId ? String(receiptId) : null,
      persisted: true,
      acceptedAtUnixMs: verifiedAtUnixMs,
      revisionId: revisionId ? String(revisionId) : null,
      serverSequence
    };
  }

  function memoryEndpointsRetryCode(error) {
    const text = errorMessage(error).toLowerCase();
    if (text.includes("http 401") || text.includes("http 403")) {
      return "authorization_required";
    }
    if (text.includes("did not prove persistence") || text.includes("canonical memory event")) {
      return "receipt_unverified";
    }
    if (text.includes("cors") || text.includes("network") || text.includes("failed to fetch")) {
      return "network_unavailable";
    }
    return "hosted_sync_failed";
  }

  function memoryEndpointsRetryDelayMs(attemptCount) {
    const exponent = Math.max(0, Math.min(8, Number(attemptCount || 1) - 1));
    return Math.min(5 * 60 * 1000, 1000 * (2 ** exponent));
  }

  async function drainMemoryEndpointsOutbox() {
    const authority = memoryEndpointsRequestAuthority();
    if (state.memoryEndpoints.drainPromise) {
      requireMemoryEndpointsAuthority(state.memoryEndpoints.drainAuthority);
      return state.memoryEndpoints.drainPromise;
    }
    const leaderRun = async () => {
      const sync = requireMemoryEndpointsSync();
      const store = await memoryEndpointsOutboxStore();
      requireMemoryEndpointsAuthority(authority);
      let recovery = await store.recoverPending(Date.now(), authority);
      const synchronizedEventIds = [];
      let lastError = "";
      try {
        await pullMemoryEndpointsSnapshot(authority);
      } catch (error) {
        requireMemoryEndpointsAuthority(authority);
        lastError = `pull failed: ${errorMessage(error)}`;
        state.memoryEndpoints.pendingCount = recovery.pending.length;
        return { pending: recovery.pending.length, synchronizedEventIds, eventIds: synchronizedEventIds, lastError };
      }

      for (let entry of recovery.pending) {
        requireMemoryEndpointsAuthority(authority);
        try {
          if (entry.state === "saved_locally") {
            entry = await store.transition(entry.eventId, (current) => sync.markQueued(current, Date.now()));
          }
          if (!sync.isSendable(entry, Date.now())) {
            continue;
          }
          entry = await store.transition(entry.eventId, (current) => sync.beginSend(current, Date.now()));
          const response = await memoryEndpointsPost(
            memoryEndpointsSubmitPath,
            entry.payload,
            "tinyrustlm-save-memory",
            { idempotencyKey: entry.idempotencyKey, authority }
          );
          const verifiedAtUnixMs = Date.now();
          const receipt = memoryEndpointsAuthoritativeReceipt(entry, response, verifiedAtUnixMs);
          await store.transition(entry.eventId, (current) =>
            sync.applyAuthoritativeReceipt(current, receipt, verifiedAtUnixMs));
          synchronizedEventIds.push(entry.eventId);
        } catch (error) {
          lastError = errorMessage(error);
          const current = await store.get(entry.eventId).catch(() => null);
          if (current && current.state === "sending") {
            const now = Date.now();
            const nextAttempt = now + memoryEndpointsRetryDelayMs(current.retry.attemptCount);
            await store.transition(current.eventId, (latest) =>
              sync.scheduleRetry(latest, memoryEndpointsRetryCode(error), nextAttempt, now));
          }
        }
      }

      recovery = await store.readPending(Date.now(), authority);
      requireMemoryEndpointsAuthority(authority);
      state.memoryEndpoints.pendingCount = recovery.pending.length;
      state.memoryEndpoints.quarantineCount += recovery.quarantined.length;
      return {
        pending: recovery.pending.length,
        synchronizedEventIds,
        eventIds: synchronizedEventIds,
        lastError
      };
    };
    const run = async () => {
      const store = await memoryEndpointsOutboxStore();
      if (!state.memoryEndpoints.enabled || !state.memoryEndpoints.bearerToken) {
        const recovery = await store.readPending(Date.now());
        state.memoryEndpoints.pendingCount = recovery.pending.length;
        return {
          pending: recovery.pending.length,
          synchronizedEventIds: [],
          eventIds: [],
          lastError: "",
          leader: false
        };
      }
      const election = await memoryEndpointsCoordinator().runAsLeader(
        authority.workspaceId,
        leaderRun
      );
      if (election.acquired) {
        return { ...election.value, leader: true };
      }
      const recovery = await store.readPending(Date.now(), authority);
      requireMemoryEndpointsAuthority(authority);
      state.memoryEndpoints.pendingCount = recovery.pending.length;
      return {
        pending: recovery.pending.length,
        synchronizedEventIds: [],
        eventIds: [],
        lastError: "",
        leader: false
      };
    };
    state.memoryEndpoints.drainAuthority = authority;
    const promise = run().finally(() => {
      if (state.memoryEndpoints.drainPromise === promise) {
        state.memoryEndpoints.drainPromise = null;
        state.memoryEndpoints.drainAuthority = null;
      }
    });
    state.memoryEndpoints.drainPromise = promise;
    return state.memoryEndpoints.drainPromise;
  }

  async function saveMemoryEndpoints(scope) {
    readMemoryEndpointsSettings({ requireEnabled: true, requireIdentity: true });
    const authority = memoryEndpointsRequestAuthority();
    const sync = requireMemoryEndpointsSync();
    const store = await memoryEndpointsOutboxStore();
    const record = await buildMemoryEndpointsRecord(scope, authority);
    const memoryTier = record.tinyrustlmMemoryTier || "short_term";
    const now = Date.now();
    const prepared = await sync.prepareOutboxEntry(record, {
      serviceOrigin: authority.serviceOrigin,
      submitUrl: authority.submitUrl,
      eventId: memoryEndpointsStableId("event"),
      deviceId: memoryEndpointsDeviceId(),
      committedAtUnixMs: now
    });
    requireMemoryEndpointsAuthority(authority);
    await store.putPrepared(prepared);
    requireMemoryEndpointsAuthority(authority);
    setMemoryEndpointsStatus(`${memoryTier.replace("_", "-")} web memory saved locally`, false);
    const queued = await store.transition(prepared.eventId, (entry) => sync.markQueued(entry, Date.now()));
    requireMemoryEndpointsAuthority(authority);
    state.memoryEndpoints.pendingCount += 1;
    setMemoryEndpointsStatus(`${memoryTier.replace("_", "-")} web memory queued; saved locally`, false);
    if (!state.memoryEndpoints.bearerToken) {
      return queued.localReceipt;
    }
    const drain = await drainMemoryEndpointsOutbox();
    requireMemoryEndpointsAuthority(authority);
    if (drain.synchronizedEventIds.includes(queued.eventId)) {
      state.memoryEndpoints.connected = true;
      setMemoryEndpointsStatus(`${memoryTier.replace("_", "-")} web memory synchronized`, false);
    } else {
      setMemoryEndpointsStatus(`${memoryTier.replace("_", "-")} web memory queued; saved locally`, false);
    }
    return queued.localReceipt;
  }

  function memoryEndpointsResultArray(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }
    if (!payload || typeof payload !== "object") {
      return [];
    }
    for (const key of ["results", "items", "memories", "matches", "data"]) {
      if (Array.isArray(payload[key])) {
        return payload[key];
      }
    }
    if (payload.data && typeof payload.data === "object") {
      return memoryEndpointsResultArray(payload.data);
    }
    return [];
  }

  function memoryEndpointsResultStatus(item) {
    const status = String(item.status || item.lifecycleStatus || item.lifecycle_status || "").trim().toLowerCase();
    if (status === "active") return "active";
    if (status === "tombstone" || status === "deleted") return "tombstone";
    if (status === "superseded") return "superseded";
    return "conflict";
  }

  function memoryEndpointsResultReviewed(item) {
    const reviewStatus = String(item.reviewStatus || item.review_status || "").trim().toLowerCase();
    const promotionState = String(item.promotionState || item.promotion_state || "").trim().toLowerCase();
    return item.reviewed === true ||
      ["promoted", "approved", "reviewed"].includes(reviewStatus) ||
      promotionState === "promoted";
  }

  function memoryEndpointsResultPublicSafe(item, envelope) {
    const firewall = item.firewall && typeof item.firewall === "object" ? item.firewall : null;
    const threats = firewall && Array.isArray(firewall.detectedThreats) ? firewall.detectedThreats : [];
    const acceptedByFirewall = Boolean(
      firewall &&
      String(firewall.decision || "").trim().toLowerCase() === "accepted" &&
      firewall.valuesRedacted === true &&
      threats.length === 0
    );
    return envelope.valuesRedacted === true &&
      envelope.rawCredentialExposed !== true &&
      envelope.rawPayloadExposed !== true &&
      item.rawCredentialExposed !== true &&
      item.rawPayloadExposed !== true &&
      item.rawPrivatePayloadStored !== true &&
      item.valuesRedacted !== false &&
      (item.publicSafe === true || acceptedByFirewall);
  }

  function memoryEndpointsResultTier(item, memoryType) {
    return memoryEndpointsNormalizeSearchTier(
      item.tinyrustlmMemoryTier ||
      item.tinyrustlm_memory_tier ||
      item.memoryTier ||
      item.memory_tier ||
      (memoryType === "status" ? "short_term" : memoryType === "handoff" ? "long_term" : "")
    );
  }

  function memoryEndpointsResultTimestamp(item) {
    const numeric = Number(item.createdAtUnixMs || item.created_at_unix_ms || 0);
    if (Number.isSafeInteger(numeric) && numeric > 0) {
      return numeric;
    }
    const parsed = Date.parse(String(item.createdAt || item.created_at || ""));
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
  }

  async function normalizeMemoryEndpointsResult(item, index, envelope) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const sync = requireMemoryEndpointsSync();
    const title = memoryEndpointsPublicText(
      item.title || item.name || `Hosted memory ${index + 1}`,
      "Hosted memory title",
      { allowEmpty: true, maxChars: 160 }
    ) || `Hosted memory ${index + 1}`;
    const candidateSummary = memoryEndpointsPublicText(
      item.safeSummary || item.safe_summary || item.summary || item.text || item.content || "",
      "Hosted memory summary",
      { allowEmpty: true, maxChars: memoryEndpointsMaxSafeTextChars }
    );
    if (!candidateSummary) {
      return null;
    }
    const safeSummary = memoryEndpointsPublicText(
      candidateSummary,
      "Hosted memory preview",
      { maxChars: 2400 }
    );
    const references = Array.isArray(item.uaiReferences)
      ? item.uaiReferences
      : Array.isArray(item.uai_references)
        ? item.uai_references
        : Array.isArray(item.references)
          ? item.references
          : [];
    const memoryType = String(item.memoryType || item.memory_type || "").trim();
    const tier = memoryEndpointsResultTier(item, memoryType);
    if (tier === "all") {
      return null;
    }
    const memoryId = String(item.memoryId || item.memory_id || item.eventId || item.event_id || item.id || "").trim();
    const revisionId = String(item.revisionId || item.revision_id || item.eventId || item.event_id || "").trim();
    const scope = String(item.scope || item.memoryScope || item.memory_scope || "").trim();
    const scopeId = String(item.scopeId || item.scope_id || item.memoryScopeId || item.memory_scope_id || "").trim();
    const createdAtUnixMs = memoryEndpointsResultTimestamp(item);
    const rawScore = Number.isFinite(Number(item.score)) ? Number(item.score) : Number(item.confidence);
    const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(1, rawScore)) : 0;
    const rawSequence = Number(item.serverSequence || item.server_sequence || item.revision || 0);
    const serverSequence = Number.isSafeInteger(rawSequence) && rawSequence > 0 ? rawSequence : null;
    const supersedesRevisionIds = (
      Array.isArray(item.supersedesRevisionIds)
        ? item.supersedesRevisionIds
        : Array.isArray(item.supersedes_revision_ids)
          ? item.supersedes_revision_ids
          : []
    ).map((value) => String(value || "").trim()).filter(Boolean);
    const candidate = await sync.prepareRetrievalCandidate({
      memoryId,
      revisionId,
      summary: candidateSummary,
      scope,
      scopeId,
      tier,
      source: "hosted",
      relevanceMicros: Math.round(score * 1_000_000),
      createdAtUnixMs,
      serverSequence,
      bodySha256: String(item.bodyHash || item.bodySha256 || item.body_sha256 || "").trim().toLowerCase(),
      status: memoryEndpointsResultStatus(item),
      supersedesRevisionIds,
      reviewed: memoryEndpointsResultReviewed(item),
      publicSafe: memoryEndpointsResultPublicSafe(item, envelope)
    });
    return {
      title,
      safeSummary,
      scope,
      scopeId,
      memoryType,
      tier,
      uaiReferences: references.map((reference) => String(reference || "")).filter(Boolean).slice(0, 8),
      score,
      reviewStatus: String(item.reviewStatus || item.review_status || "").trim().toLowerCase(),
      contextEligible: false,
      candidate
    };
  }

  function renderMemoryEndpointsSearchResults() {
    if (!el.memoryEndpointsSearchResults) {
      return;
    }
    const results = Array.isArray(state.memoryEndpoints.searchResults)
      ? state.memoryEndpoints.searchResults
      : [];
    if (!results.length) {
      el.memoryEndpointsSearchResults.textContent = state.memoryEndpoints.enabled
        ? "No hosted memory results loaded."
        : "";
      return;
    }
    el.memoryEndpointsSearchResults.textContent = results.map((result, index) => {
      const scope = result.scope ? ` / ${result.scope}` : "";
      const tier = result.tier && result.tier !== "all" ? ` / ${result.tier.replace("_", "-")}` : "";
      const memoryType = result.memoryType ? ` / ${result.memoryType}` : "";
      const score = result.score === null ? "" : ` / score ${result.score.toFixed(3)}`;
      const contextState = result.contextEligible ? " / context-ready" : " / preview-only";
      const refs = result.uaiReferences.length ? `\nrefs=${result.uaiReferences.join(", ")}` : "";
      return `${index + 1}. ${result.title}${scope}${tier}${memoryType}${score}${contextState}\n${result.safeSummary}${refs}`;
    }).join("\n\n");
  }

  function selectedModelHostedMemoryContextBudget() {
    const model = paths.models[state.activeModelKey] || paths.models[el.modelSelect.value] || null;
    const contextLength = Number(model && model.contextLength ? model.contextLength : 0);
    const maxOutputTokens = Math.max(1, Math.min(512, Number(model && model.maxTokens) || 128));
    if (Number.isSafeInteger(contextLength) && contextLength >= 2048) {
      return {
        capacityClass: "context_capable",
        contextWindowTokens: contextLength,
        systemTokens: 256,
        userTokens: 512,
        maxOutputTokens,
        guardTokens: 128,
        maxMemoryTokens: Math.floor(memoryEndpointsContextByteLimit / 4),
        bytesPerToken: 4
      };
    }
    if (Number.isSafeInteger(contextLength) && contextLength >= 512) {
      return {
        capacityClass: "medium",
        contextWindowTokens: contextLength,
        systemTokens: 64,
        userTokens: 128,
        maxOutputTokens: Math.min(maxOutputTokens, 128),
        guardTokens: 64,
        maxMemoryTokens: Math.floor(memoryEndpointsContextByteLimit / 4),
        bytesPerToken: 4
      };
    }
    const knownTiny = Boolean(model && Number.isFinite(model.maxTokens) && model.maxTokens <= 16);
    return {
      capacityClass: knownTiny ? "tiny_local_only" : "unknown",
      contextWindowTokens: Number.isSafeInteger(contextLength) && contextLength > 0 ? contextLength : null,
      systemTokens: 0,
      userTokens: 0,
      maxOutputTokens: 0,
      guardTokens: 0,
      maxMemoryTokens: Math.floor(memoryEndpointsContextByteLimit / 4),
      bytesPerToken: 4
    };
  }

  /** Reject late results after another search, account, filter or model owns the UI. */
  function requireMemoryEndpointsSearch(owner) {
    requireMemoryEndpointsAuthority(owner.authority);
    if (state.memoryEndpoints.retrievalGeneration !== owner.generation ||
        state.memoryEndpoints.searchTier !== owner.tier || state.activeModelKey !== owner.activeModelKey ||
        el.modelSelect.value !== owner.selectedModelKey) {
      const error = new Error("Hosted memory search changed");
      error.code = "memory_authority_changed";
      throw error;
    }
  }

  /** Pack local candidates under captured policy; publish no state until ownership is rechecked. */
  async function packMemoryEndpointsSearch(results, owner) {
    if (!results.length) return null;
    return requireMemoryEndpointsSync().packMemoryContext(results.map(result => result.candidate), {
      scope: memoryEndpointsTinyRustLmScope, scopeId: memoryEndpointsTinyRustLmScopeId,
      allowShortTerm: owner.tier === "all" || owner.tier === "short_term",
      allowLongTerm: owner.tier === "all" || owner.tier === "long_term",
      requireReviewedHosted: true, maxCandidates: memoryEndpointsMaxSearchResults, maxSummaryChars: 2400
    }, owner.budget);
  }

  function memoryEndpointsHostedContextActive() {
    const packed = state.memoryEndpoints && state.memoryEndpoints.packedContext;
    return Boolean(
      state.memoryEndpoints &&
      state.memoryEndpoints.enabled &&
      state.memoryEndpoints.connected &&
      packed &&
      typeof packed.context === "string" &&
      packed.context.length > 0 &&
      Array.isArray(packed.selected) &&
      packed.selected.length > 0 &&
      state.memoryEndpoints.packedModelKey === (state.activeModelKey || el.modelSelect.value || "")
    );
  }

  /** Stage search and packing privately, then commit only the initiating session's latest result. */
  async function searchMemoryEndpoints() {
    readMemoryEndpointsSettings({ requireEnabled: true, requireAuth: true });
    const query = memoryEndpointsPublicText(
      el.memoryEndpointsSearchQuery && el.memoryEndpointsSearchQuery.value
        ? el.memoryEndpointsSearchQuery.value : "tinyrustlm hosted memory",
      "Hosted memory search query", { maxChars: 512 });
    const tier = memoryEndpointsNormalizeSearchTier(
      el.memoryEndpointsSearchTier ? el.memoryEndpointsSearchTier.value : state.memoryEndpoints.searchTier);
    state.memoryEndpoints.searchTier = tier;
    invalidateMemoryEndpointsRetrieval(true);
    renderMemoryEndpointsSearchResults();
    persistMemoryEndpointsSettings();
    const owner = { authority: memoryEndpointsRequestAuthority(),
      generation: state.memoryEndpoints.retrievalGeneration, tier,
      activeModelKey: state.activeModelKey, selectedModelKey: el.modelSelect.value,
      budget: selectedModelHostedMemoryContextBudget() };
    setMemoryEndpointsStatus("searching hosted memory", false);
    try {
      const response = await memoryEndpointsGet(memoryEndpointsSearchPath, {
        workspaceId: owner.authority.workspaceId, agentId: owner.authority.actorAgentId,
        actor_agent_id: owner.authority.actorAgentId, query, scope: memoryEndpointsTinyRustLmScope,
        scopeId: memoryEndpointsTinyRustLmScopeId, memory_type: memoryEndpointsMemoryTypeForTier(tier),
        limit: memoryEndpointsMaxSearchResults
      }, owner.authority);
      requireMemoryEndpointsSearch(owner);
      if (!response || typeof response !== "object" || response.rawCredentialExposed === true ||
          response.rawPayloadExposed === true || response.valuesRedacted !== true) {
        throw new Error("MemoryEndpoints search response did not prove a redacted public-safe boundary");
      }
      const results = (await Promise.all(memoryEndpointsResultArray(response)
        .slice(0, memoryEndpointsMaxRetrievedCandidates).map(async (item, index) => {
          try { return await normalizeMemoryEndpointsResult(item, index, response); }
          catch (_error) { return null; }
        }))).filter(Boolean).map((result, resultIndex) => ({ ...result, resultIndex }));
      requireMemoryEndpointsSearch(owner);
      const packed = await packMemoryEndpointsSearch(results, owner);
      requireMemoryEndpointsSearch(owner);
      const selected = new Set(packed ? packed.selected.map(item => item.revisionId) : []);
      state.memoryEndpoints.retrievalResults = results;
      state.memoryEndpoints.retrievalCandidates = results.map(result => result.candidate);
      state.memoryEndpoints.packedContext = packed;
      state.memoryEndpoints.packedModelKey = owner.activeModelKey || owner.selectedModelKey || "";
      state.memoryEndpoints.retrievalReceipt = packed ? packed.receipt : null;
      state.memoryEndpoints.searchResults = results.map(result => ({
        ...result, contextEligible: selected.has(result.candidate.revisionId)
      })).sort((left, right) => Number(right.contextEligible) - Number(left.contextEligible) ||
        left.resultIndex - right.resultIndex).slice(0, memoryEndpointsMaxPreviewResults);
      state.memoryEndpoints.connected = true;
      renderMemoryEndpointsSearchResults();
      setMemoryEndpointsStatus(state.memoryEndpoints.searchResults.length
        ? `${state.memoryEndpoints.searchResults.length} hosted memory results loaded`
        : "no hosted memory results found", false);
    } catch (error) {
      requireMemoryEndpointsSearch(owner);
      throw error;
    }
  }

  function clearMemoryEndpointsSettings() {
    state.memoryEndpoints.enabled = false;
    state.memoryEndpoints.connected = false;
    state.memoryEndpoints.connectionMode = "workspace";
    state.memoryEndpoints.workspaceId = "";
    clearMemoryEndpointsSessionSecrets();
    state.memoryEndpoints.searchTier = "all";
    state.memoryEndpoints.searchResults = [];
    state.memoryEndpoints.retrievalResults = [];
    state.memoryEndpoints.retrievalCandidates = [];
    state.memoryEndpoints.packedContext = null;
    state.memoryEndpoints.packedModelKey = "";
    state.memoryEndpoints.retrievalReceipt = null;
    if (el.memoryEndpointsEnabled) {
      el.memoryEndpointsEnabled.checked = false;
    }
    if (el.memoryEndpointsIssuedCredentials) {
      el.memoryEndpointsIssuedCredentials.hidden = true;
    }
    if (el.memoryEndpointsCanonicalAgentName) {
      el.memoryEndpointsCanonicalAgentName.value = "";
    }
    persistMemoryEndpointsSettings();
    syncMemoryEndpointsControls();
    setMemoryEndpointsStatus("web memory off", false);
  }

  function shortSha256(sha256) {
    const text = normalizeCatalogSha256(sha256) || "";
    return text ? `${text.slice(0, 19)}...${text.slice(-8)}` : "sha256 unavailable";
  }

  function elementWithText(tagName, className, text) {
    const node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    node.textContent = text;
    return node;
  }

  function actionButton(label, onClick, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (className) {
      button.className = className;
    }
    button.addEventListener("click", onClick);
    return button;
  }

  function externalActionLink(label, href) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
  }

  function modelResultItem(titleText) {
    const item = document.createElement("li");
    item.className = "model-result";
    item.append(elementWithText("strong", "", titleText));
    return item;
  }

  function simpleLocalStatusText(text, isError) {
    const value = String(text || "");
    const lower = value.toLowerCase();
    if (isError) {
      return friendlyError(value);
    }
    if (lower.includes("selected")) {
      return "Composition files selected. Click Import Selected Composition to validate them.";
    }
    if (lower.includes("reading")) {
      return "Reading local composition members.";
    }
    if (lower.includes("choose")) {
      return "Choose the six admitted composition members from this computer.";
    }
    if (lower.includes("0x")) {
      return "Local model imported and verified. You can generate now.";
    }
    if (lower.includes("sha256")) {
      return "Metadata selected. Choose the matching local composition, then import it.";
    }
    return value || "Waiting for a local composition.";
  }

  function setLocalModelStatus(text, isError) {
    if (el.localModelState) {
      setText(el.localModelState, text, isError);
    }
    if (el.simpleDiscoveryStatus && el.simpleDiscoveryPanel && !el.simpleDiscoveryPanel.hidden) {
      el.simpleDiscoveryStatus.textContent = simpleLocalStatusText(text, isError);
      el.simpleDiscoveryStatus.classList.toggle("error", Boolean(isError));
    }
    if (String(text || "").toLowerCase().includes("loading") || String(text || "").toLowerCase().includes("import")) {
      updateSystemStatus("Importing local model", isError);
    }
  }

  function catalogText(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function isCatalogSha256(value) {
    return /^sha256:[0-9a-f]{64}$/i.test(value || "");
  }

  function normalizeCatalogSha256(value) {
    const text = catalogText(value).toLowerCase();
    return isCatalogSha256(text) ? text : "";
  }

  function bytesToHex(bytes) {
    return Array.from(bytes)
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  }

  async function sha256Raw(bytes) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("Browser SHA-256 verification is unavailable");
    }
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return new Uint8Array(digest);
  }

  async function sha256Hex(bytes) {
    return `sha256:${bytesToHex(await sha256Raw(bytes))}`;
  }

  async function sha256Text(text) {
    return sha256Hex(state.encoder.encode(String(text || "")));
  }

  function selectedBrowserCompositionFiles(input = el.localModelFile) {
    const selected = input && input.files ? Array.from(input.files) : [];
    const artifactNames = new Set(
      browserModelAdmissionApi.artifactSpecs.map((artifact) => artifact.fileName)
    );
    const artifactsByName = new Map();
    let admissionFile = null;
    const unknown = [];
    for (const file of selected) {
      if (artifactNames.has(file.name)) {
        if (artifactsByName.has(file.name)) {
          throw new Error(`Duplicate composition member: ${file.name}`);
        }
        artifactsByName.set(file.name, file);
      } else if (file.name.endsWith(".browser-composition-admission.json")) {
        if (admissionFile !== null) {
          throw new Error("Select exactly one browser composition admission");
        }
        admissionFile = file;
      } else {
        unknown.push(file.name || "unnamed file");
      }
    }
    if (unknown.length > 0) {
      throw new Error(`Unsupported composition selection: ${unknown.join(", ")}`);
    }
    return Object.freeze({ selected, artifactsByName, admissionFile });
  }

  function browserCompositionSelectionError(selection) {
    if (selection.selected.length === 0) {
      return "";
    }
    if (selection.admissionFile === null) {
      return "Select the canonical browser composition admission";
    }
    const missing = browserModelAdmissionApi.artifactSpecs
      .map((artifact) => artifact.fileName)
      .filter((fileName) => !selection.artifactsByName.has(fileName));
    if (missing.length > 0 || selection.artifactsByName.size !== 6 ||
        selection.selected.length !== 7) {
      return missing.length > 0
        ? `Select the complete six-member composition; missing ${missing.join(", ")}`
        : "Select exactly six composition members and one admission";
    }
    return "";
  }

  function assertAdmissionRuntime(admission) {
    const manifest = state.runtimeAsset && state.runtimeAsset.manifest;
    if (!manifest) {
      throw new Error("The verified browser runtime manifest is unavailable");
    }
    if (admission.runtime.workerProtocol !== manifest.workerProtocol ||
        admission.runtime.wasmByteCount !== manifest.byteCount ||
        admission.runtime.wasmSha256 !== manifest.sha256 ||
        admission.runtime.policy.maximumLinearMemoryBytes !== manifest.maximumMemoryBytes) {
      throw new Error("The composition admission targets a different browser runtime");
    }
  }

  async function inspectBrowserCompositionSelection(selection) {
    const selectionError = browserCompositionSelectionError(selection);
    if (selectionError) {
      throw new Error(selectionError);
    }
    if (!Number.isSafeInteger(selection.admissionFile.size) ||
        selection.admissionFile.size < 2 ||
        selection.admissionFile.size > browserModelAdmissionApi.maximumTextBytes) {
      throw new Error("Browser composition admission size is invalid");
    }
    let admissionText;
    try {
      const bytes = new Uint8Array(await selection.admissionFile.arrayBuffer());
      admissionText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      bytes.fill(0);
    } catch (_) {
      throw new Error("Browser composition admission is not canonical UTF-8");
    }
    const admission = browserModelAdmissionApi.parseAdmissionText(admissionText);
    await ensureBrowserRuntimeAsset();
    assertAdmissionRuntime(admission);
    const filesByRole = new Map();
    for (const artifact of admission.artifacts) {
      const file = selection.artifactsByName.get(artifact.fileName);
      if (!file || file.name !== artifact.fileName || file.size !== artifact.byteCount) {
        throw new Error(`${artifact.fileName} does not match the admission inventory`);
      }
      filesByRole.set(artifact.role, file);
    }
    return Object.freeze({
      admission,
      admissionText,
      admissionSha256: (await sha256Text(admissionText)).replace(/^sha256:/u, ""),
      admissionFileName: selection.admissionFile.name,
      filesByRole
    });
  }

  async function importBrowserComposition(input = el.localModelFile) {
    const inspected = await inspectBrowserCompositionSelection(
      selectedBrowserCompositionFiles(input)
    );
    const admission = inspected.admission;
    const entry = currentCatalogEntryForAdmission(admission);
    if (!entry) {
      throw catalogQualificationError(
        "model-local-import-not-cataloged",
        "This local composition is not in the current verified model list"
      );
    }
    requireCurrentCatalogEntry(entry);
    const admissionRecord = await loadCatalogAdmission(entry);
    requireCurrentCatalogAdmission(entry, admissionRecord.admission);
    if (admissionRecord.admissionText !== inspected.admissionText ||
        companionSha256(admissionRecord.admissionSha256, "Catalog admission") !==
          inspected.admissionSha256) {
      throw catalogQualificationError(
        "model-local-import-admission-mismatch",
        "The selected admission does not exactly match the current independently fetched catalog admission"
      );
    }
    setLocalModelStatus(
      `${admission.modelId} / qualification confirmed / verifying and saving six members`,
      false
    );
    const sources = {};
    for (const artifact of admission.artifacts) {
      const file = inspected.filesByRole.get(artifact.role);
      if (!file) {
        throw new Error(`The ${artifact.role} member is unavailable`);
      }
      sources[artifact.fileName] = file;
    }
    const admissionAuthority = modelStoreAdmissionAuthority(admissionRecord);
    const store = workerActivationStoreAdapter(
      await compositionStoreForInstall(),
      `${admission.modelId} is saved in this browser and ready.`,
      null,
      admissionAuthority
    );
    await store.install({
      manifest: modelStoreManifest(admissionRecord),
      admissionAuthority,
      sources
    });
    return true;
  }

  function hfOrigin() {
    return `${hfDiscoveryScheme}://${hfDiscoveryHost}`;
  }

  function hfModelUrl(modelId) {
    return `${hfOrigin()}/${String(modelId).split("/").map(encodeURIComponent).join("/")}`;
  }

  function hfResolveUrl(modelId, fileName, revision = "main") {
    const modelPath = String(modelId || "").split("/").map(encodeURIComponent).join("/");
    const filePath = String(fileName || "").split("/").map(encodeURIComponent).join("/");
    const revisionPath = encodeURIComponent(String(revision || ""));
    return modelPath && filePath && revisionPath
      ? `${hfOrigin()}/${modelPath}/resolve/${revisionPath}/${filePath}`
      : "";
  }

  function hfSourceContract(modelId) {
    const normalized = normalizeModelIdentity(modelId);
    const contracts = {
      "xenova/llama2.c-stories15m": {
        modelShape: "stories15m-bpe",
        quantization: "q8_0"
      },
      "modelcloud/tinyllama-15m-stories": {
        modelShape: "stories15m-bpe",
        quantization: "q8_0"
      },
      "huggingfacetb/smollm2-135m-instruct": {
        modelShape: "smollm2-135m-instruct-bpe",
        quantization: "q8_0"
      },
      "huggingfacetb/smollm2-360m-instruct": {
        modelShape: "smollm2-360m-instruct-bpe",
        quantization: "q8_0"
      },
      "qwen/qwen3-0.6b": {
        modelShape: "qwen3-0.6b-bpe",
        quantization: "q8_0"
      },
      "qwen/qwen2.5-1.5b-instruct": {
        modelShape: "qwen2.5-1.5b-bpe",
        quantization: "q4_0"
      }
    };
    return Object.prototype.hasOwnProperty.call(contracts, normalized)
      ? Object.freeze({ ...contracts[normalized] })
      : null;
  }

  function setHfStatus(text, isError) {
    if (el.hfStatus) {
      setText(el.hfStatus, text, isError);
    }
  }

  function clearHfResults() {
    if (el.hfResults) {
      el.hfResults.replaceChildren();
    }
  }

  function hfModelId(result) {
    const id = result && (result.modelId || result.id || result.name);
    const text = String(id || "").trim();
    return /^[A-Za-z0-9][A-Za-z0-9._/-]{1,180}$/.test(text) ? text : "";
  }

  function hfSiblingFileName(sibling) {
    const text = String(sibling && (sibling.rfilename || sibling.path || sibling.name) || "").trim();
    if (!text || text.includes("\\") || text.includes("://") || /[\x00-\x1f\x7f]/.test(text)) {
      return "";
    }
    if (!text.split("/").every((part) => part && part !== "." && part !== "..")) {
      return "";
    }
    return text;
  }

  function hfSiblingByteCount(sibling) {
    const candidates = [
      sibling && sibling.size,
      sibling && sibling.blobSize,
      sibling && sibling.lfs && sibling.lfs.size
    ];
    for (const value of candidates) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric >= 0) {
        return numeric;
      }
    }
    return null;
  }

  function hfSiblingSha256(sibling) {
    const candidates = [
      sibling && sibling.sha256,
      sibling && sibling.oid,
      sibling && sibling.lfs && sibling.lfs.sha256,
      sibling && sibling.lfs && sibling.lfs.oid
    ];
    for (const value of candidates) {
      const text = String(value || "").trim().replace(/^sha256:/i, "");
      if (/^[0-9a-f]{64}$/i.test(text)) {
        return `sha256:${text.toLowerCase()}`;
      }
    }
    return null;
  }

  function hfSafetensorsSiblings(result) {
    const siblings = result && Array.isArray(result.siblings) ? result.siblings : [];
    const seen = new Set();
    const files = [];
    for (const sibling of siblings) {
      const fileName = hfSiblingFileName(sibling);
      if (!/\.safetensors$/i.test(fileName) || seen.has(fileName.toLowerCase())) {
        continue;
      }
      seen.add(fileName.toLowerCase());
      files.push({
        file_name: fileName,
        byte_count: hfSiblingByteCount(sibling),
        sha256: hfSiblingSha256(sibling),
        download_url: hfResolveUrl(result && result.modelId || result && result.id || result && result.name, fileName)
      });
      if (files.length >= 8) {
        break;
      }
    }
    return files;
  }

  function hfGgufSiblings(result) {
    const siblings = result && Array.isArray(result.siblings) ? result.siblings : [];
    const seen = new Set();
    const files = [];
    for (const sibling of siblings) {
      const fileName = hfSiblingFileName(sibling);
      if (!/\.gguf$/i.test(fileName) || seen.has(fileName.toLowerCase())) {
        continue;
      }
      seen.add(fileName.toLowerCase());
      files.push({
        file_name: fileName,
        byte_count: hfSiblingByteCount(sibling),
        sha256: hfSiblingSha256(sibling),
        download_url: hfResolveUrl(result && result.modelId || result && result.id || result && result.name, fileName)
      });
      if (files.length >= 8) {
        break;
      }
    }
    return files;
  }

  function normalizeModelIdentity(value) {
    return String(value || "")
      .trim()
      .replace(/^https:\/\/huggingface\.co\//i, "")
      .replace(/^http:\/\/huggingface\.co\//i, "")
      .replace(/^hf:\/\//i, "")
      .replace(/\/+$/g, "")
      .toLowerCase();
  }

  // Match external source metadata only against the current strict composition catalog.
  function hfP2pMatches(modelId) {
    return state.modelCatalogV1Entries.filter((entry) => catalogV1EntryMatchesHfModel(entry, modelId));
  }

  function canStartP2pImport(entry) {
    // The installer uses the first projected peer only; do not silently select another one.
    const peer = entry && Array.isArray(entry.peers) ? entry.peers[0] : null;
    const feedDeadline = Date.parse(peer && peer.feedValidUntilUtc);
    const peerDeadline = Date.parse(peer && peer.expiresUtc);
    const now = Date.now();
    return Boolean(
      entry &&
      entry.availability === "peer" &&
      Number.isFinite(feedDeadline) &&
      feedDeadline > now &&
      Number.isFinite(peerDeadline) &&
      peerDeadline > now &&
      entry.browserAdmission &&
      entry.composition &&
      Array.isArray(entry.peers) &&
      entry.peers.length > 0
    );
  }

  function catalogV1EntryMatchesHfModel(entry, modelId) {
    return Boolean(
      entry && entry.source &&
      normalizeModelIdentity(entry.source.repository) === normalizeModelIdentity(modelId)
    );
  }

  // Require one exact composition; multiple matches require an explicit Models choice.
  function hfQualifiedCatalogMatch(modelId) {
    const matches = hfP2pMatches(modelId);
    return matches.length === 1 ? matches[0] : null;
  }

  function hfP2pImportMatch(modelId) {
    const match = hfQualifiedCatalogMatch(modelId);
    return match &&
      simpleModelRouteProjection(match).kind === simpleModelRouteKinds.QUALIFIED_P2P
      ? match
      : null;
  }

  function hfCountText(value, unit) {
    return Number.isFinite(value) ? `${value} ${unit}` : `${unit} unavailable`;
  }

  function hfResultView(entry) {
    const matches = hfP2pMatches(entry.modelId);
    const qualifiedCatalogMatch = hfQualifiedCatalogMatch(entry.modelId);
    const safetensorsFiles = hfSafetensorsSiblings(entry.result);
    const ggufFiles = hfGgufSiblings(entry.result);
    return {
      entry,
      matches,
      safetensorsFiles,
      ggufFiles,
      qualifiedCatalogMatch,
      localConversionMatch: qualifiedCatalogMatch &&
        simpleModelRouteProjection(qualifiedCatalogMatch).kind ===
          simpleModelRouteKinds.SUPPORTED_LOCAL_CONVERSION
        ? qualifiedCatalogMatch
        : null,
      p2pMatch: hfP2pImportMatch(entry.modelId),
      downloads: hfCountText(entry.result.downloads, "downloads"),
      likes: hfCountText(entry.result.likes, "likes")
    };
  }

  function hfCanStartConversion(view) {
    return Boolean(
      view &&
      view.localConversionMatch &&
      hfSourceContract(view.entry && view.entry.modelId) &&
      view.safetensorsFiles &&
      view.safetensorsFiles.length
    );
  }

  function hfPreferredSourceFormat(view) {
    if (view && Array.isArray(view.safetensorsFiles) && view.safetensorsFiles.length) {
      return "safetensors";
    }
    if (view && Array.isArray(view.ggufFiles) && view.ggufFiles.length) {
      return "gguf";
    }
    return "none";
  }

  function hfPreferredSourceFiles(view) {
    if (hfPreferredSourceFormat(view) === "gguf") {
      return Array.isArray(view.ggufFiles) ? view.ggufFiles : [];
    }
    return view && Array.isArray(view.safetensorsFiles) ? view.safetensorsFiles : [];
  }

  function hfSourceByteSummary(view) {
    const files = hfPreferredSourceFiles(view);
    if (!files.length) {
      return { risk: "none", bytes: null, fileCount: 0 };
    }
    let total = 0;
    for (const file of files) {
      const bytes = Number(file.byte_count);
      if (!Number.isFinite(bytes) || bytes <= 0) {
        return { risk: "unknown", bytes: null, fileCount: files.length };
      }
      total += bytes;
    }
    return {
      risk: total >= hfLargeSourceWarningBytes ? "large" : "normal",
      bytes: total,
      fileCount: files.length
    };
  }

  function hfSourceByteRisk(view) {
    return hfSourceByteSummary(view).risk;
  }

  function hfSourceByteSummaryText(view) {
    const summary = hfSourceByteSummary(view);
    if (!Number.isFinite(summary.bytes)) {
      return summary.fileCount > 1 ? `${summary.fileCount} source files` : "source size unknown";
    }
    const size = formatByteCount(summary.bytes);
    return summary.fileCount > 1 ? `${size} across ${summary.fileCount} source files` : size;
  }

  function hfCompatibilityClass(view) {
    return view.matches.length
      ? "compatibility-pill candidate"
      : "compatibility-pill convert";
  }

  // Explain the currently available acquisition route without legacy offer metadata.
  function hfAdvancedStatusText(view) {
    if (view.p2pMatch) return "Qualified composition with a current signed P2P announcement";
    if (view.matches.length > 1) return "Choose the exact composition in Models";
    if (!hfCanStartConversion(view)) return "No supported source listed";
    if (hfSourceByteRisk(view) === "large") return "Large source; P2P preferred";
    if (hfSourceByteRisk(view) === "unknown") return "Source size unknown";
    return "Converts locally";
  }

  // Separate external source metadata from current acquisition and qualification.
  function hfAdvancedMetaText(view) {
    const sourceState = view.p2pMatch
      ? "A signed MiniModel listing is available; exact composition bytes are verified during acquisition"
      : view.matches.length > 1
        ? "Multiple current compositions match this source; choose one in Models"
        : hfCanStartConversion(view)
          ? "Source metadata only; conversion and qualification are required before use"
          : "No current signed peer listing or supported qualified conversion route is available";
    return `${view.downloads} / ${view.likes} / ${sourceState}`;
  }

  function appendHfSafetensorsFileNotes(actions, safetensorsFiles) {
    if (!safetensorsFiles.length) {
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        "No .safetensors source file was listed in metadata; review the model card before choosing a local source file."
      ));
      return;
    }
    for (const file of safetensorsFiles.slice(0, 2)) {
      const size = Number.isFinite(file.byte_count) && file.byte_count > 0
        ? ` / ${formatByteCount(file.byte_count)}`
        : "";
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        `Source file listed: ${safeLocalModelName(file.file_name)}${size}. Get model pins, downloads, reviews, and converts it through the local companion.`
      ));
    }
    if (safetensorsFiles.length > 2) {
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        `${safetensorsFiles.length - 2} more .safetensors files listed; Rust planner decides local compatibility.`
      ));
    }
  }

  function appendHfGgufFileNotes(actions, ggufFiles) {
    if (!ggufFiles.length) {
      return;
    }
    for (const file of ggufFiles.slice(0, 2)) {
      const size = Number.isFinite(file.byte_count) && file.byte_count > 0
        ? ` / ${formatByteCount(file.byte_count)}`
        : "";
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        `GGUF file listed: ${safeLocalModelName(file.file_name)}${size}. Rust can inspect any GGUF metadata, but conversion only accepts F32/F16/BF16/Q2_K/Q3_K/Q4_0/Q4_1/Q4_K/Q5_0/Q5_1/Q5_K/Q6_K/Q8_0/Q8_1/Q8_K tensors.`
      ));
    }
    if (ggufFiles.length > 2) {
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        `${ggufFiles.length - 2} more .gguf files listed; Rust review decides whether any tensor layout is compatible.`
      ));
    }
  }

  function appendHfSourceRiskNote(actions, view) {
    const risk = hfSourceByteRisk(view);
    if (risk === "large") {
      const size = hfSourceByteSummaryText(view);
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        `Large source warning: ${size}. Prefer P2P reuse when a current qualified announcement is listed; local conversion is explicit and may take a while.`
      ));
    } else if (risk === "unknown") {
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        "Source size unavailable in metadata. Review before local conversion; prefer P2P reuse when a current qualified announcement is listed."
      ));
    }
  }

  function appendHfSourceFileNotes(actions, view, options = {}) {
    const noSlmText = options.noSlmText || "No complete compatible composition is available to this app yet.";
    if (noSlmText) {
      actions.append(elementWithText("span", "model-result-meta", noSlmText));
    }
    if (view.safetensorsFiles.length) {
      appendHfSafetensorsFileNotes(actions, view.safetensorsFiles);
    } else if (view.ggufFiles.length) {
      appendHfGgufFileNotes(actions, view.ggufFiles);
    } else {
      appendHfSafetensorsFileNotes(actions, view.safetensorsFiles);
    }
    appendHfSourceRiskNote(actions, view);
  }

  // Offer only the current acquisition command or an explicit composition choice.
  function appendHfAdvancedActions(actions, entry, view) {
    actions.append(externalActionLink("Review Model Card", hfModelUrl(entry.modelId)));
    if (view.p2pMatch || hfCanStartConversion(view)) {
      actions.append(actionButton("Get model", () => getHfModel(entry), "primary-result-action"));
    } else if (view.matches.length > 1) {
      actions.append(actionButton("Choose in Models", () => toggleModelPopover(true)));
    } else {
      actions.append(elementWithText("span", "model-result-meta",
        "No signed P2P listing or supported Rust conversion path is available."));
    }
  }

  function renderAcceptedHfResults(accepted) {
    if (el.hfResults) {
      el.hfResults.replaceChildren();
      for (const entry of accepted) {
        const view = hfResultView(entry);
        const item = modelResultItem(entry.modelId);
        const status = elementWithText("span", hfCompatibilityClass(view), hfAdvancedStatusText(view));
        const meta = elementWithText("div", "model-result-meta", hfAdvancedMetaText(view));
        const actions = elementWithText("div", "model-result-actions", "");
        appendHfAdvancedActions(actions, entry, view);
        appendHfSourceFileNotes(actions, view);
        item.append(status, meta, actions);
        el.hfResults.append(item);
      }
    }
  }

  function pluralCount(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function hfAvailabilityCounts(accepted) {
    const summary = {
      p2pReady: 0,
      compositionChoiceNeeded: 0,
      conversionNeeded: 0,
      largeSourceReview: 0,
      unknownSourceReview: 0,
      noSupportedSource: 0
    };
    for (const entry of accepted) {
      const view = hfResultView(entry);
      if (view.p2pMatch) {
        summary.p2pReady += 1;
      } else if (view.matches.length > 1) {
        summary.compositionChoiceNeeded += 1;
      } else if (!hfCanStartConversion(view)) {
        summary.noSupportedSource += 1;
      } else if (hfPreferredSourceFormat(view) === "gguf") {
        summary.unknownSourceReview += 1;
      } else if (hfSourceByteRisk(view) === "large") {
        summary.largeSourceReview += 1;
      } else if (hfSourceByteRisk(view) === "unknown") {
        summary.unknownSourceReview += 1;
      } else {
        summary.conversionNeeded += 1;
      }
    }
    return summary;
  }

  function hfAvailabilitySummary(accepted) {
    const summary = hfAvailabilityCounts(accepted);
    const parts = [pluralCount(accepted.length, "external record")];
    if (summary.p2pReady) {
      parts.push(pluralCount(summary.p2pReady, "qualified model with a signed P2P listing"));
    }
    if (summary.compositionChoiceNeeded) {
      parts.push(`${pluralCount(summary.compositionChoiceNeeded, "source")} requires an exact choice in Models`);
    }
    if (summary.conversionNeeded) {
      parts.push(`${pluralCount(summary.conversionNeeded, "model")} ${summary.conversionNeeded === 1 ? "needs" : "need"} Rust conversion`);
    }
    if (summary.largeSourceReview) {
      parts.push(`${pluralCount(summary.largeSourceReview, "model")} ${summary.largeSourceReview === 1 ? "needs" : "need"} explicit large-source conversion review`);
    }
    if (summary.unknownSourceReview) {
      parts.push(`${pluralCount(summary.unknownSourceReview, "model")} ${summary.unknownSourceReview === 1 ? "needs" : "need"} source-size review`);
    }
    if (summary.noSupportedSource) {
      parts.push(`${pluralCount(summary.noSupportedSource, "model")} ${summary.noSupportedSource === 1 ? "has" : "have"} no supported source listed`);
    }
    return parts.join(" / ");
  }

  function hfResultActionRank(entry) {
    const view = hfResultView(entry);
    if (view.p2pMatch) {
      return 700;
    }
if (view.matches.length) {
      return 600;
    }
    if (hfCanStartConversion(view)) {
      const risk = hfSourceByteRisk(view);
      if (risk === "normal") {
        return 400;
      }
      if (risk === "unknown") {
        return 350;
      }
      return 300;
    }
    return 0;
  }

  function normalizeHfBrowseSort(value) {
    const key = String(value || "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(hfBrowseSortModes, key) ? key : "popular";
  }

  function selectedHfBrowseSort() {
    if (el.hfSortSelect) {
      return normalizeHfBrowseSort(el.hfSortSelect.value);
    }
    return "popular";
  }

  function hfResultDateMillis(result) {
    const raw = result && (result.createdAt || result.lastModified || result.lastModifiedAt);
    const millis = Date.parse(raw || "");
    return Number.isFinite(millis) ? millis : 0;
  }

  function prioritizeHfResults(candidates, options = {}) {
    const limit = Number.isFinite(options.limit) ? options.limit : hfSearchLimit;
    const order = options.order || "actionable";
    return candidates
      .map((entry, index) => ({
        entry,
        index,
        rank: hfResultActionRank(entry),
        downloads: Number.isFinite(entry.result && entry.result.downloads) ? entry.result.downloads : 0,
        createdAt: hfResultDateMillis(entry.result)
      }))
      .filter((item) => !options.viableOnly || item.rank > 0)
      .sort((left, right) => {
        if (order === "popular") {
          if (right.downloads !== left.downloads) {
            return right.downloads - left.downloads;
          }
          if (right.rank !== left.rank) {
            return right.rank - left.rank;
          }
          if (right.createdAt !== left.createdAt) {
            return right.createdAt - left.createdAt;
          }
          return left.index - right.index;
        }
        if (order === "new") {
          if (right.createdAt !== left.createdAt) {
            return right.createdAt - left.createdAt;
          }
          if (right.rank !== left.rank) {
            return right.rank - left.rank;
          }
          if (right.downloads !== left.downloads) {
            return right.downloads - left.downloads;
          }
          return left.index - right.index;
        }
        if (right.rank !== left.rank) {
          return right.rank - left.rank;
        }
        if (right.downloads !== left.downloads) {
          return right.downloads - left.downloads;
        }
        return left.index - right.index;
      })
      .slice(0, limit)
      .map((item) => item.entry);
  }

  function renderHfResults(results, options = {}) {
    clearHfResults();
    const candidates = [];
    for (const result of results) {
      const modelId = hfModelId(result);
      if (modelId) {
        candidates.push({ result, modelId });
      }
    }
    const accepted = prioritizeHfResults(candidates, options);
    state.hfLastAccepted = accepted;
    if (!accepted.length) {
      setHfStatus(
        options.viableOnly
          ? `no potential TinyRustLM sources found after scanning ${results.length} ${options.sortLabel || "Hugging Face"} model cards`
          : "no model records returned",
        false
      );
      return;
    }
    renderAcceptedHfResults(accepted);
    if (options.viableOnly) {
      setHfStatus(
        `${accepted.length} of up to ${hfBrowseLimit} potential TinyRustLM sources from ${results.length} scanned ${options.sortLabel || "Hugging Face"} model cards; ${hfAvailabilitySummary(accepted)}; local composition verification required`,
        false
      );
      return;
    }
    setHfStatus(`${hfAvailabilitySummary(accepted)}; local composition verification required`, false);
  }

  async function searchHuggingFaceModels() {
    const query = String(el.hfSearchInput && el.hfSearchInput.value ? el.hfSearchInput.value : "").trim();
    const browseMode = !query;
    const sortKey = selectedHfBrowseSort();
    const sortMode = hfBrowseSortModes[sortKey] || hfBrowseSortModes.popular;
    if (state.hfSearchAbort) {
      state.hfSearchAbort.abort();
    }
    clearHfResults();
    setHfStatus(
      browseMode
        ? `finding up to ${hfBrowseLimit} potential TinyRustLM sources from top ${hfBrowseApiLimit} ${sortMode.label} model-card metadata`
        : "searching model-card metadata",
      false
    );
    const controller = new AbortController();
    state.hfSearchAbort = controller;
    const url = new URL(`${hfOrigin()}/api/models`);
    if (query) {
      url.searchParams.set("search", query);
    }
    url.searchParams.set("filter", "text-generation");
    url.searchParams.set("sort", sortMode.sort);
    url.searchParams.set("direction", sortMode.direction);
    url.searchParams.set("limit", String(browseMode ? hfBrowseApiLimit : hfSearchApiLimit));
    url.searchParams.set("full", "true");
    const response = await fetch(url.toString(), {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`External model search failed (${response.status})`);
    }
    const results = await response.json();
    if (!Array.isArray(results)) {
      throw new Error("External model search returned an unexpected body");
    }
    renderHfResults(results, {
      viableOnly: browseMode,
      limit: browseMode ? hfBrowseLimit : hfSearchLimit,
      order: browseMode ? sortKey : "actionable",
      sortLabel: sortMode.label
    });
  }

  // Renders only evidence bound by the active six-member admission.
  function renderProvenance(status, fields, isError) {
    setText(el.provenanceState, status, isError);
    const model = paths.models[state.activeModelKey] || null;
    const source = model && model.browserComposition ? model.browserComposition : null;
    const admission = source ? source.admission : null;
    const qualification = admission ? admission.qualification : null;
    const value = (key) => fields && fields[key] ? String(fields[key]) : "unavailable";
    el.provenanceSourceKind.textContent = value("source_kind");
    el.provenanceSourceSnapshot.textContent = value("source_snapshot");
    el.provenanceSourceId.textContent = admission ? admission.modelId : value("source_id");
    el.provenanceSourceShape.textContent = value("model_shape");
    el.provenanceSourceReview.textContent = qualification
      ? qualification.sourceEvidenceSha256
      : value("source_review");
    el.provenanceSourceReviewRoutes.textContent = value("source_review_routes");
    el.provenanceSourceReviewArtifacts.textContent = qualification
      ? `structural=${qualification.structuralEvidenceSha256} / numerical=${qualification.numericalEvidenceSha256}`
      : value("source_review_artifacts");
    el.provenanceSourceTokenizerImport.textContent = admission
      ? admission.artifacts[1].sha256
      : "unavailable";
    el.provenanceSourceValidation.textContent = value("source_validation");
    el.provenanceAdmission.textContent = admission
      ? `${admission.schema} / ${source.admissionSha256}`
      : value("admission_status");
    el.provenanceQualityClaim.textContent = qualification
      ? `${qualification.qualityClaim} / ${qualification.qualityScope}`
      : value("quality_claim");
    applyModelTrustMetadata(el.provenanceQualityClaim, model);
    el.provenanceTrainedClaim.textContent = qualification
      ? qualification.receiptId
      : value("trained_quality_claim");
    for (const node of [
      el.provenanceGenome,
      el.provenanceSpecies,
      el.provenanceNovelty,
      el.provenancePopulation,
      el.provenanceMateSelection,
      el.provenanceOperator,
      el.provenanceSchedule,
      el.provenancePhenotype,
      el.provenanceArtifact
    ]) {
      node.textContent = "not part of the active composition contract";
    }
    el.provenanceFitness.textContent = qualification
      ? qualification.qualityEvidenceSha256
      : "unavailable";
    el.provenanceEvalCases.textContent = qualification
      ? qualification.evalCasesSha256
      : "unavailable";
    el.provenanceEvalChecksum.textContent = qualification
      ? qualification.qualityEvidenceSha256
      : "unavailable";
    el.provenanceChecksum.textContent = admission
      ? admission.artifacts[0].sha256
      : value("slm_checksum");
    el.provenanceNextGate.textContent = value("required_next_gate");
  }

  function clearBrowserAdmissionDiagnostics() {
    for (const key of [
      "activeBrowserAdmissionSha256",
      "activeCompositionGraphSha256",
      "activeQualificationReceiptId"
    ]) {
      delete document.documentElement.dataset[key];
    }
  }

  function setInteractive(enabled) {
    setControls(enabled, enabled);
  }

  function selectorCompositionRuntimeIdentityMatches() {
    const model = paths.models[state.activeModelKey] || null;
    const admission = model && model.browserComposition
      ? model.browserComposition.admission
      : null;
    const runtimeState = state.runtimeState;
    return Boolean(
      admission &&
      state.runtimeClient &&
      state.runtimeClient.status === "active" &&
      runtimeState &&
      runtimeState.state === "active-idle" &&
      runtimeState.operationId === admission.operationId &&
      runtimeState.activeComposition &&
      runtimeState.activeComposition.graphIdentitySha256 ===
        admission.composition.graphIdentitySha256 &&
      runtimeState.activeComposition.memberTableSha256 ===
        admission.composition.memberTableSha256
    );
  }

  function activeSelectorCompositionMatchesRuntime() {
    return Boolean(
      state.modelLoaded &&
      !state.modelActivationCommitPending &&
      selectorCompositionRuntimeIdentityMatches()
    );
  }

  function setControls(canGenerate, canSelectModel) {
    const generationEnabled = Boolean(canGenerate) && activeSelectorCompositionMatchesRuntime();
    const modelSelectionEnabled = Boolean(canSelectModel) &&
      !state.modelActivationCommitPending;
    state.controlsCanGenerate = generationEnabled;
    state.controlsCanSelectModel = modelSelectionEnabled;
    el.generateButton.disabled = state.generation.inFlight ? false : !generationEnabled;
    el.resetButton.disabled = !generationEnabled;
    el.modelSelect.disabled = state.generation.inFlight || !modelSelectionEnabled;
  }

  function setGenerationUi(status) {
    const active = status === "waiting" || status === "generating";
    state.generation.inFlight = active;
    if (el.appShell) {
      el.appShell.dataset.generationState = active ? status : "idle";
    }
    el.generateButton.dataset.action = active ? "stop" : "send";
    el.generateButton.setAttribute("aria-label", active ? "Stop response" : "Send message");
    el.generateButton.title = active ? "Stop response" : "Send message";
    el.generateButton.disabled = active ? false : !state.controlsCanGenerate;
    if (el.sendIcon) el.sendIcon.hidden = active;
    if (el.stopIcon) el.stopIcon.hidden = !active;
    el.modelSelect.disabled = active || !state.controlsCanSelectModel;
    if (el.composerHint && !state.conversationPersistenceBlocked) {
      el.composerHint.textContent = active
        ? (state.generation.stopRequested ? "Stopping local generation" : "Generating locally")
        : state.modelLoaded
          ? "Ready for a message"
          : "Choose a model to begin";
    }
  }

  function requestGenerationStop() {
    if (!state.generation.inFlight) return false;
    state.generation.stopRequested = true;
    if (state.generation.abortController) state.generation.abortController.abort();
    if (state.runtimeClient) state.runtimeClient.requestCancellation();
    setGenerationUi("generating");
    return true;
  }

  function nextBrowserPaint() {
    return new Promise((resolve) => window.requestAnimationFrame(resolve));
  }

  function startGeneration(assistantMessageId) {
    state.generation.sequence += 1;
    state.generation.assistantMessageId = assistantMessageId;
    state.generation.stopRequested = false;
    state.generation.abortController = new AbortController();
    state.generation.rawOutput = null;
    setText(el.runtimeStatus, "Generating", false);
    setGenerationUi("waiting");
    updateAssistantMessage(assistantMessageId, {
      status: "generating",
      text: "",
      errorCode: ""
    });
    setGenerationUi("generating");
    setControls(false, false);
    return state.generation.sequence;
  }

  function stopBeforeInference(assistantMessageId, sequence) {
    if (!state.generation.stopRequested || sequence !== state.generation.sequence) return false;
    updateAssistantMessage(assistantMessageId, {
      status: "stopped",
      text: "",
      errorCode: "stopped_by_user"
    });
    setText(el.runtimeStatus, "Stopped", false);
    setGenerationUi("idle");
    state.generation.assistantMessageId = "";
    state.generation.stopRequested = false;
    state.generation.abortController = null;
    setControls(state.modelLoaded, Object.keys(paths.models).length > 0);
    runPendingGenerationAction();
    return true;
  }

  function runPendingGenerationAction() {
    const action = state.generation.pendingAction;
    state.generation.pendingAction = "";
    if (action === "new-chat") window.requestAnimationFrame(startNewConversation);
  }

  // Settle only the owning generation, retaining exact empty or partial terminal output.
  async function deliverGeneratedOutput(assistantMessageId, output, failure, sequence) {
    if (sequence !== state.generation.sequence) return;
    if (failure) {
      const code = typeof failure.code === "string"
        ? failure.code
        : "model-runtime-client-generation-failed";
      const rejected = Number.isInteger(failure.status) && failure.status > 0;
      updateAssistantMessage(assistantMessageId, {
        status: rejected ? "rejected" : "failed",
        text: code,
        errorCode: code
      });
      setText(el.runtimeStatus, rejected ? "Generation rejected" : "Generate failed", true);
      setText(el.errorState, code, true);
    } else {
      const cancelled = output.status.kind === "cancelled";
      const contextLimited = output.status.kind === "context-limit";
      state.generation.rawOutput = output;
      state.lastMeasuredTokens = output.tokenIds.length;
      state.hasContext = !cancelled && output.committedKvBytes > 0;
      if (state.runtimeState) {
        state.runtimeState = Object.freeze({
          ...state.runtimeState,
          committedKvBytes: output.committedKvBytes
        });
      }
      updateAssistantMessage(assistantMessageId, {
        status: cancelled ? "stopped" : "completed",
        text: output.text,
        errorCode: cancelled ? "stopped_by_user" : ""
      });
      setText(el.runtimeStatus, cancelled ? "Stopped" : contextLimited ? "Context limit reached" : "Ready", false);
      setText(el.errorState, "none", false);
    }
    setGenerationUi("idle");
    state.generation.assistantMessageId = "";
    state.generation.stopRequested = false;
    state.generation.abortController = null;
    setControls(state.modelLoaded, Object.keys(paths.models).length > 0);
    renderDiagnostics();
    runPendingGenerationAction();
  }

  // Fetch only for a model operation; cancellation must not publish a late verified asset.
  async function ensureBrowserRuntimeAsset(signal) {
    throwIfAcquisitionAborted(signal);
    if (state.runtimeAsset && state.runtimeAsset.wasmBytes instanceof ArrayBuffer &&
        state.runtimeAsset.wasmBytes.byteLength > 0) {
      return state.runtimeAsset;
    }
    const asset = await browserRuntimeLoaderApi.load({
      manifestUrl: paths.runtimeWasmManifest,
      wasmUrl: paths.runtimeWasm,
      fetchFunction: window.fetch.bind(window),
      signal
    });
    throwIfAcquisitionAborted(signal);
    state.runtimeAsset = asset;
    state.runtimeVariant = "worker-owned-wasm";
    document.documentElement.dataset.runtimeVariant = state.runtimeVariant;
    setText(el.wasmState, "verified", false);
    renderDiagnostics();
    return state.runtimeAsset;
  }

  async function* storedCompositionChunks(storedComposition, fileName, signal) {
    let offset = 0;
    for await (const chunk of storedComposition.streamMember(fileName, { signal })) {
      if (!(chunk instanceof Uint8Array) || chunk.byteLength < 1) {
        throw new Error(`The cached ${fileName} member returned an invalid chunk`);
      }
      const bytes = chunk.byteOffset === 0 && chunk.byteLength === chunk.buffer.byteLength
        ? chunk.buffer
        : chunk.slice().buffer;
      yield Object.freeze({ offset, bytes });
      offset += chunk.byteLength;
    }
  }

  // A cached load receives a scoped reader that pins all six files until worker activation completes.
  function browserCompositionArtifacts(model, signal, storedReader) {
    const source = model && model.browserComposition;
    if (!source || !source.admission) {
      throw new Error("The selected model is not a complete browser composition");
    }
    if (source.storedComposition) {
      if (!storedReader || typeof storedReader.streamMember !== "function" ||
          storedReader.manifestSha256 !== source.storedComposition.manifestSha256) {
        throw new Error("The cached composition has no matching active read lease");
      }
      return modelRuntimeClientApi.ACTIVATION_ROLES.map((role) => {
        const artifact = source.admission.artifacts.find((entry) => entry.role === role);
        if (!artifact) {
          throw new Error(`The cached composition is missing the ${role} member`);
        }
        return {
          role,
          byteLength: artifact.byteCount,
          chunks: storedCompositionChunks(
            storedReader,
            artifact.fileName,
            signal
          )
        };
      });
    }
    if (!(source.filesByRole instanceof Map)) {
      throw new Error("The selected model has no readable composition members");
    }
    return modelRuntimeClientApi.ACTIVATION_ROLES.map((role) => {
      const file = source.filesByRole.get(role);
      const artifact = source.admission.artifacts.find((entry) => entry.role === role);
      if (!file || !artifact || file.name !== artifact.fileName ||
          file.size !== artifact.byteCount) {
        throw new Error(`The ${role} member no longer matches its admission`);
      }
      return {
        role,
        byteLength: file.size,
        chunks: modelRuntimeClientApi.chunksFromBlob(
          file,
          modelRuntimeClientApi.MAXIMUM_BINARY_CHUNK_BYTES,
          signal
        )
      };
    });
  }

  function requireActivatedComposition(stateReport, admission) {
    const active = stateReport && stateReport.activeComposition;
    const compositionArtifact = admission.artifacts[5];
    if (!active || stateReport.state !== "active-idle" ||
        stateReport.operationId !== admission.operationId ||
        active.graphIdentitySha256 !== admission.composition.graphIdentitySha256 ||
        active.memberTableSha256 !== admission.composition.memberTableSha256 ||
        active.artifactSha256 !== compositionArtifact.sha256 ||
        active.artifactBytes !== compositionArtifact.byteCount) {
      throw new Error("The worker activated a composition identity outside the admission");
    }
    return stateReport;
  }

  function throwIfModelActivationCancelled(loadId, signal) {
    if (loadId !== state.modelLoadSequence || (signal && signal.aborted)) {
      throw acquisitionAbortError("Composition activation was cancelled");
    }
  }

  function cancelActiveModelActivation() {
    const controller = state.modelActivationAbort;
    if (!controller) {
      return false;
    }
    state.modelActivationAbort = null;
    state.modelLoadSequence += 1;
    controller.abort();
    const client = state.runtimeClient;
    if (client && client.status !== "terminated") {
      client.terminate("model-runtime-client-activation-cancelled");
    }
    if (state.runtimeClient === client) {
      state.runtimeClient = null;
      state.runtimeState = null;
    }
    state.modelLoaded = false;
    state.activeComposition = null;
    state.activeModelKey = "";
    state.hasContext = false;
    document.documentElement.dataset.activeModel = "";
    setInteractive(false);
    setText(el.runtimeStatus, "Model activation cancelled", false);
    setText(el.modelState, "activation cancelled", false);
    setControls(false, true);
    return true;
  }

  async function activateBrowserComposition(model, loadId) {
    if (state.generation?.inFlight || state.turnAdmissionPending) {
      throw catalogQualificationError(
        "model-activation-generation-active",
        "Stop the current answer before choosing another model."
      );
    }
    const activationController = state.modelActivationAbort;
    const signal = activationController ? activationController.signal : null;
    throwIfModelActivationCancelled(loadId, signal);
    const admission = model.browserComposition.admission;
    assertAdmissionRuntime(admission);
    let client = state.runtimeClient;
    try {
      if (client && client.status === "active" &&
          client.operationId === admission.operationId &&
          client.compositionId === admission.composition.graphIdentitySha256 &&
          client.policy && Object.keys(admission.runtime.policy).every(
            (key) => client.policy[key] === admission.runtime.policy[key]
          )) {
          throwIfModelActivationCancelled(loadId, signal);
          const verifiedState = requireActivatedComposition(state.runtimeState, admission);
          requireCurrentBrowserComposition(model);
          return verifiedState;
      } else {
        // Worker policy is fixed at initialization; each new admission owns a fresh worker.
        if (client && client.status !== "terminated") {
          client.terminate("model-runtime-client-model-switch");
        }
        state.runtimeClient = null;
        state.runtimeState = null;
        const runtimeAsset = await ensureBrowserRuntimeAsset(signal);
        throwIfModelActivationCancelled(loadId, signal);
        client = modelRuntimeClientApi.createBrowserClient(paths.runtimeWorker, 10 * 60 * 1000);
        state.runtimeClient = client;
        state.runtimeState = await client.initialize({
          operationId: admission.operationId,
          compositionId: admission.composition.graphIdentitySha256,
          wasmBytes: runtimeAsset.wasmBytes,
          wasmSha256: runtimeAsset.manifest.sha256,
          policy: admission.runtime.policy,
          transcriptRevision: state.transcriptRevision
        });
        throwIfModelActivationCancelled(loadId, signal);
      }
      const transferController = new AbortController();
      const abortTransfer = () => transferController.abort();
      if (signal) {
        signal.addEventListener("abort", abortTransfer, { once: true });
      }
      let stateReport;
      try {
        // Keep immutable cached bytes pinned across all six member transfers to the worker.
        const transfer = storedReader => client.activate(
          browserCompositionArtifacts(model, transferController.signal, storedReader),
          (progress) => {
            if (loadId !== state.modelLoadSequence || (signal && signal.aborted)) {
              transferController.abort();
              return;
            }
            const percent = Math.floor((progress.completedBytes / progress.totalBytes) * 100);
            setText(el.modelState, `${progress.role} ${percent}%`, false);
          }
        );
        const stored = model.browserComposition.storedComposition;
        stateReport = stored
          ? await stored.withRead(transfer, { signal: transferController.signal })
          : await transfer(null);
      } finally {
        if (signal) {
          signal.removeEventListener("abort", abortTransfer);
        }
      }
      throwIfModelActivationCancelled(loadId, signal);
      const verifiedState = requireActivatedComposition(stateReport, admission);
      requireCurrentBrowserComposition(model);
      return verifiedState;
    } catch (error) {
      if (client && client.status !== "terminated") {
        client.terminate("model-runtime-client-activation-failed");
      }
      if (state.runtimeClient === client) {
        state.runtimeClient = null;
        state.runtimeState = null;
      }
      throw error;
    }
  }

  function browserCompositionProvenance(model) {
    const admission = model.browserComposition.admission;
    const quality = admission.qualification;
    const modelArtifact = admission.artifacts[0];
    return {
      source_kind: "qualified-six-member-local-composition",
      source_id: admission.modelId,
      source_snapshot: `operation=${admission.operationId}`,
      source_review: `source-evidence-sha256=${quality.sourceEvidenceSha256}`,
      source_review_routes: "content-addressed admission; no path authority",
      source_review_artifacts: `structural=${quality.structuralEvidenceSha256} / numerical=${quality.numericalEvidenceSha256}`,
      source_validation: "worker-recomputed-six-member-activation",
      model_shape: "slm2-composition-bound",
      tokenizer: "tokenizer2-composition-bound",
      quality_claim: quality.qualityClaim,
      trained_quality_claim: quality.receiptId,
      admission_status: "six-member-worker-activated",
      slm_checksum: modelArtifact.sha256,
      required_next_gate: "real-clean-profile-multi-turn-browser-round"
    };
  }

  async function loadSelectedBrowserComposition(parentSignal, activationToken) {
    throwIfAcquisitionAborted(parentSignal);
    if (state.generation?.inFlight || state.turnAdmissionPending) {
      throw catalogQualificationError(
        "model-activation-generation-active",
        "Stop the current answer before choosing another model."
      );
    }
    if (activationToken && !ownsStoredCompositionActivation(activationToken)) {
      throw catalogQualificationError(
        "model-cache-activation-owner-mismatch",
        "A newer model activation superseded this browser cache operation"
      );
    }
    if (state.modelActivationAbort) {
      cancelActiveModelActivation();
    }
    if (activationToken && !ownsStoredCompositionActivation(activationToken)) {
      throw catalogQualificationError(
        "model-cache-activation-owner-mismatch",
        "A newer model activation superseded this browser cache operation"
      );
    }
    const loadId = state.modelLoadSequence + 1;
    invalidateMemoryEndpointsRetrieval(true);
    renderMemoryEndpointsSearchResults();
    state.modelLoadSequence = loadId;
    if (activationToken) activationToken.loadId = loadId;
    const selectedModel = el.modelSelect.value;
    const model = paths.models[selectedModel] || null;
    clearBrowserAdmissionDiagnostics();
    if (!model) {
      state.modelLoaded = false;
      state.activeComposition = null;
      state.activeModelKey = "";
      setInteractive(false);
      setText(el.runtimeStatus, "Choose a qualified composition", false);
      setText(el.modelState, "choose six local members", false);
      setText(el.errorState, "none", false);
      renderProvenance("choose a qualified SLM2 composition", null, false);
      renderDiagnostics();
      return false;
    }
    if (!model.browserComposition || !model.browserComposition.admission) {
      setText(el.runtimeStatus, "Composition required", true);
      setText(el.modelState, "unsupported model entry", true);
      setText(el.errorState, "Only a qualified six-member SLM2 composition can run", true);
      setControls(false, true);
      return false;
    }
    const admission = model.browserComposition.admission;
    const activationController = new AbortController();
    const abortActivation = () => {
      if (state.modelActivationAbort === activationController) {
        cancelActiveModelActivation();
      } else {
        activationController.abort();
      }
    };
    state.modelActivationAbort = activationController;
    if (parentSignal) {
      parentSignal.addEventListener("abort", abortActivation, { once: true });
      if (parentSignal.aborted) {
        abortActivation();
      }
    }
    state.modelLoaded = false;
    state.hasContext = false;
    state.lastMeasuredTokens = 0;
    state.generation.rawOutput = null;
    setInteractive(false);
    setText(el.runtimeStatus, "Activating in isolated worker", false);
    setText(el.modelState, "verifying composition", false);
    setText(el.errorState, "none", false);
    const started = performance.now();
    try {
      state.runtimeState = await activateBrowserComposition(model, loadId);
      throwIfModelActivationCancelled(loadId, activationController.signal);
      if (activationToken) {
        requireStoredCompositionActivationOwner(
          model.browserComposition.storedComposition,
          activationToken
        );
      }
      requireCurrentBrowserComposition(model);
      state.modelLoadMs = Math.round(performance.now() - started);
      state.activeModelKey = selectedModel;
      state.activeComposition = Object.freeze({ ...admission.composition });
      state.modelManifest = browserCompositionProvenance(model);
      document.documentElement.dataset.activeModel = selectedModel;
      document.documentElement.dataset.activeBrowserAdmissionSha256 =
        model.browserComposition.admissionSha256;
      document.documentElement.dataset.activeCompositionGraphSha256 =
        admission.composition.graphIdentitySha256;
      document.documentElement.dataset.activeQualificationReceiptId =
        admission.qualification.receiptId;
      if (state.modelActivationCommitPending) {
        state.modelLoaded = false;
        setText(el.runtimeStatus, "Finalizing browser cache", false);
        setText(el.modelState, "worker verified; cache commit pending", false);
        setText(el.errorState, "none", false);
        renderProvenance(
          "qualification verified; browser cache commit pending",
          state.modelManifest,
          false
        );
        setControls(false, false);
        renderDiagnostics();
        return true;
      }
      state.modelLoaded = true;
      setText(el.runtimeStatus, "Ready", false);
      setText(el.modelState, `worker active (${state.modelLoadMs} ms)`, false);
      setText(el.errorState, "none", false);
      renderProvenance("qualified six-member composition", state.modelManifest, false);
      setLocalModelStatus(`${admission.modelId} activated in the isolated worker`, false);
      setControls(true, true);
      renderDiagnostics();
      return true;
    } catch (error) {
      latchRecoverableCompositionStoreError(error);
      if (loadId !== state.modelLoadSequence) return false;
      state.modelLoadMs = Math.round(performance.now() - started);
      state.modelLoaded = false;
      state.activeComposition = null;
      state.hasContext = false;
      document.documentElement.dataset.activeModel = "";
      const text = errorMessage(error);
      setText(el.runtimeStatus, "Composition rejected", true);
      setText(el.modelState, "activation failed", true);
      setText(el.errorState, text, true);
      renderProvenance("composition not active", null, true);
      setControls(false, true);
      renderDiagnostics();
      return false;
    } finally {
      if (parentSignal) {
        parentSignal.removeEventListener("abort", abortActivation);
      }
      if (state.modelActivationAbort === activationController) {
        state.modelActivationAbort = null;
      }
    }
  }

  // Keep transcript projection in the conversation owner; Rust owns template serialization.
  function prompt2ConversationMessages(assistantMessageId) {
    const conversation = activeConversation();
    if (!conversation) throw new Error("The active conversation is unavailable");
    return conversationApi.prompt2Messages(conversation, assistantMessageId);
  }

  function prompt2Sampling(admission) {
    const ui = readSamplingConfig();
    const defaults = admission.runtime.defaultSampling;
    const temperatureMillionths = Math.round(ui.temperature * 1000000);
    const greedy = temperatureMillionths === 0;
    const maximumNewTokens = Math.min(
      defaults.maximumNewTokens,
      admission.runtime.policy.maximumSequenceTokens,
      clampInteger(el.maxTokens.value, 1, 4096, defaults.maximumNewTokens)
    );
    el.maxTokens.value = String(maximumNewTokens);
    syncRangeControls();
    state.latestSampling = Object.freeze({
      temperature: temperatureMillionths / 1000000,
      topK: greedy ? 1 : ui.topK,
      topP: greedy ? 1 : ui.topP,
      seed: ui.seed,
      repetitionPenalty: defaults.repetitionPenaltyMillionths / 1000000
    });
    return Object.freeze({
      temperatureMillionths,
      topK: greedy ? 1 : ui.topK,
      topPMillionths: greedy ? 1000000 : Math.round(ui.topP * 1000000),
      repetitionPenaltyMillionths: defaults.repetitionPenaltyMillionths,
      repetitionWindow: defaults.repetitionWindow,
      maximumNewTokens
    });
  }

  async function submitBrowserConversation(event) {
    event.preventDefault();
    if (state.generation.inFlight) {
      requestGenerationStop();
      return;
    }
    if (state.turnAdmissionPending) return;
    if (state.modelAcquisitionCommand || state.modelActivationAbort ||
        state.modelActivationCommitPending) {
      setText(el.runtimeStatus, "Model preparation in progress", false);
      setText(el.errorState, "Wait for model preparation to finish before sending a message", false);
      return;
    }
    if (!activeSelectorCompositionMatchesRuntime()) {
      setText(el.runtimeStatus, "Composition required", true);
      setText(el.errorState, "Activate one qualified six-member composition before chatting", true);
      setControls(false, Object.keys(paths.models).length > 0);
      return;
    }
    if (el.appShell && el.appShell.dataset.mode === "simple") syncSemanticControls(true);
    const promptText = el.prompt.value;
    if (!promptText.trim()) {
      el.prompt.focus();
      return;
    }
    if (promptText.length > conversationApi.maxMessageCharacters) {
      setText(el.errorState, `prompt exceeds ${conversationApi.maxMessageCharacters} characters`, true);
      el.prompt.focus();
      return;
    }
    const model = paths.models[state.activeModelKey] || null;
    let admission;
    try {
      admission = requireCurrentBrowserComposition(model);
    } catch (error) {
      const text = errorMessage(error);
      discardRejectedStoredActivation();
      setText(el.runtimeStatus, "Model qualification expired", true);
      setText(el.modelState, "refresh the verified model list", true);
      setText(el.errorState, text, true);
      setSimpleModelPickerStatus(`${text} Refresh models before chatting.`, true);
      renderSimpleModelPicker();
      return;
    }
    state.modelPopoverHoldUntil = 0;
    toggleModelPopover(false);
    state.turnAdmissionPending = true;
    setControls(false, false);
    try {
      await nextBrowserPaint();
      admission = requireCurrentBrowserComposition(model);
    } catch (error) {
      const text = errorMessage(error);
      discardRejectedStoredActivation();
      setText(el.runtimeStatus, "Model qualification expired", true);
      setText(el.modelState, "refresh the verified model list", true);
      setText(el.errorState, text, true);
      setSimpleModelPickerStatus(`${text} Refresh models before chatting.`, true);
      renderSimpleModelPicker();
      return;
    } finally {
      state.turnAdmissionPending = false;
    }
    const assistantMessage = beginConversationTurn(promptText);
    const generationSequence = startGeneration(assistantMessage.id);
    if (stopBeforeInference(assistantMessage.id, generationSequence)) return;
    const conversation = activeConversation();
    const started = performance.now();
    let output = null;
    let failure = null;
    const generationClient = state.runtimeClient;
    let authorityFailure = null;
    let authorityTimer = null;
    const requireGenerationAuthority = () => {
      if (authorityFailure) throw authorityFailure;
      if (state.runtimeClient !== generationClient ||
          generationSequence !== state.generation.sequence) {
        throw Object.assign(new Error("The active model changed during generation"), {
          code: "model-generation-superseded", terminal: true
        });
      }
      return requireCurrentBrowserComposition(model);
    };
    try {
      admission = requireGenerationAuthority();
      // A stalled transfer or worker must not keep running after its authority expires.
      authorityTimer = setInterval(() => {
        try {
          requireGenerationAuthority();
        } catch (error) {
          authorityFailure = error;
          if (generationClient && generationClient.status !== "terminated") {
            generationClient.terminate("model-generation-authority-expired");
          }
        }
      }, 1000);
      if (state.transcriptRevision === ((1n << 64n) - 1n)) {
        throw new Error("The browser transcript revision is exhausted");
      }
      state.transcriptRevision += 1n;
      const conversationId = await modelRuntimeClientApi.identityFromText(
        "tinyrustlm.browser-conversation/1",
        conversation.id
      );
      const turnId = await modelRuntimeClientApi.identityFromText(
        "tinyrustlm.browser-turn/1",
        assistantMessage.turnId
      );
      const generationId = await modelRuntimeClientApi.identityFromText(
        "tinyrustlm.browser-generation/1",
        `${conversation.id}\n${assistantMessage.turnId}\n${assistantMessage.id}\n${generationSequence}`
      );
      const transcriptState = await generationClient.setTranscript(
        state.transcriptRevision,
        conversationId
      );
      admission = requireGenerationAuthority();
      state.runtimeState = transcriptState;
      const requestBytes = prompt2RequestApi.encodeRequest({
        messages: prompt2ConversationMessages(assistantMessage.id),
        sampling: prompt2Sampling(admission),
        seed: BigInt(state.latestSampling.seed)
      });
      admission = requireGenerationAuthority();
      const generatedOutput = await generationClient.generate({
        conversationId,
        turnId,
        generationId,
        promptRequest: requestBytes.buffer,
        signal: state.generation.abortController.signal,
        onStep(step) {
          requireGenerationAuthority();
          if (step.emittedTokenId !== null) state.lastMeasuredTokens += 1;
        }
      });
      requireGenerationAuthority();
      output = generatedOutput;
    } catch (error) {
      failure = authorityFailure || error;
      if (failure && failure.code === "model-generation-superseded" &&
          generationClient && generationClient.status !== "terminated") {
        generationClient.terminate("model-generation-superseded");
      }
      if (state.runtimeClient === generationClient && failure &&
          typeof failure.code === "string" && failure.code.startsWith("model-")) {
        discardRejectedStoredActivation();
      }
      if (state.runtimeClient === generationClient && failure && failure.terminal === true) {
        state.runtimeClient = null;
        state.runtimeState = null;
        state.modelLoaded = false;
        state.activeComposition = null;
        state.hasContext = false;
      }
    } finally {
      if (authorityTimer !== null) clearInterval(authorityTimer);
    }
    state.lastGenerateMs = Math.round(performance.now() - started);
    await deliverGeneratedOutput(assistantMessage.id, output, failure, generationSequence);
    const resultText = output ? output.text : errorMessage(failure);
    appendConsole(
      `worker_generate(status=${output ? output.status.kind : "failed"}, tokens=${output ? output.tokenIds.length : 0}) in ${state.lastGenerateMs} ms`
    );
    captureRun(promptText, resultText, Boolean(failure));
  }

  // Run once after safe startup; cancellation stops new work but awaits any durable mutation already issued.
  function scheduleCompositionCleanup() {
    if (state.compositionCleanupPromise) return state.compositionCleanupPromise;
    state.compositionCleanupPromise = Promise.resolve().then(async () => {
      const progress = { status: "running", passes: 0, removed_installed: 0, removed_staging: 0, error: null };
      state.compositionCleanup = progress;
      let lifetime = null;
      // Keep a stalled durable operation visible until storage settles and releases its lock.
      const onStop = () => {
        progress.status = "stopping";
        progress.error = lifetime.signal.reason.code;
        renderDiagnostics();
      };
      try {
        lifetime = operationLifetimeApi.create({
          timeoutMilliseconds: 60000,
          timeoutError: catalogQualificationError("model-cache-cleanup-timeout", "Finishing model storage cleanup timed out"),
          abortError: catalogQualificationError("model-cache-cleanup-aborted", "Model storage cleanup was cancelled"),
          optionsError: catalogQualificationError("model-cache-cleanup-unavailable", "Model storage cleanup timing is unavailable")
        });
        lifetime.signal.addEventListener("abort", onStop, { once: true });
        renderDiagnostics();
        // Bound work per visit even if another tab keeps creating candidates between cleanup passes.
        for (let pass = 0; pass < 16; pass += 1) {
          const result = await ensureModelCompositionStore().cleanup({ signal: lifetime.signal });
          progress.passes += 1;
          progress.removed_installed += result.removedInstalled;
          progress.removed_staging += result.removedStaging;
          if (lifetime.signal.aborted) throw lifetime.signal.reason;
          if (!result.truncated && result.remainingStaging === 0) {
            progress.status = "complete";
            return;
          }
        }
        throw catalogQualificationError("model-cache-cleanup-limit", "Model storage cleanup reached its pass limit");
      } catch (error) {
        const failure = lifetime && lifetime.signal.aborted ? lifetime.signal.reason : error;
        progress.status = "incomplete";
        progress.error = failure.code || errorMessage(failure);
        appendConsole(`model storage cleanup incomplete: ${progress.error}`);
      } finally {
        if (lifetime) {
          lifetime.signal.removeEventListener("abort", onStop);
          lifetime.dispose();
        }
        renderDiagnostics();
      }
    });
    return state.compositionCleanupPromise;
  }

  // Bound the read-only cache check, including lock/root acquisition, without deleting timed-out bytes.
  async function openStartupComposition() {
    const lifetime = operationLifetimeApi.create({
      timeoutMilliseconds: 60000,
      timeoutError: catalogQualificationError("model-cache-open-timeout", "Checking the saved model timed out"),
      abortError: catalogQualificationError("model-cache-open-aborted", "Checking the saved model was cancelled"),
      optionsError: catalogQualificationError("model-cache-open-unavailable", "Browser cache timing is unavailable")
    });
    try {
      return await lifetime.wait(() => ensureModelCompositionStore().openActive({ signal: lifetime.signal }));
    } finally {
      lifetime.dispose();
    }
  }

  // Verifies cached state before allowing the no-model path to auto-present the chooser.
  async function boot() {
    try {
      setInteractive(false);
      setText(el.runtimeStatus, "Checking browser model cache", false);
      let cachedComposition = null;
      let cacheError = null;
      try {
        cachedComposition = await openStartupComposition();
      } catch (error) {
        cacheError = error;
        state.compositionStoreError = error;
      }
      if (cachedComposition) restoreStoredCatalogAuthority(cachedComposition);
      setText(el.runtimeStatus, "Reconciling current model qualifications", false);
      await loadSimpleModelCatalog();
      if (cachedComposition) {
        try {
          setText(el.runtimeStatus, "Verifying cached composition", false);
          await activateStoredComposition(
            cachedComposition,
            "Your saved model is verified and ready."
          );
          state.initialModelRestored = true;
          state.initialModelBootComplete = true;
          scheduleCompositionCleanup();
          return;
        } catch (error) {
          cacheError = error;
          discardRejectedStoredActivation();
          appendConsole(`cached composition was not activated: ${errorMessage(error)}`);
        }
      }
      paths.models = Object.create(null);
      if (state.localModel) paths.models[localModelKey] = state.localModel;
      renderModelOptions(paths.models, false);
      setText(el.runtimeStatus, "Choose a qualified composition", false);
      setText(
        el.modelState,
        cacheError ? "browser cache unavailable" : "choose a model",
        Boolean(cacheError)
      );
      setText(
        el.errorState,
        cacheError ? cacheError.code || errorMessage(cacheError) : "none",
        Boolean(cacheError)
      );
      setControls(false, Object.keys(paths.models).length > 0);
      renderDiagnostics();
      if (cacheError) {
        setSimpleModelPickerStatus(friendlyError(cacheError.code || errorMessage(cacheError)), true);
      }
      state.initialModelRestored = false;
      state.initialModelBootComplete = true;
      if (!cacheError) scheduleCompositionCleanup();
      const bootstrap = chooseBootstrapModelRoute(simpleModelRouteViews());
      if (!cacheError && bootstrap && !simpleModelAcquisitionIsActive() && !state.modelLoaded &&
          !state.initialModelChooserAutoPresentSuppressed && el.appShell?.dataset.mode === "simple") {
        selectSimpleModelEntry(bootstrap.entry);
        setText(el.runtimeStatus, "Downloading your starter model from MiniModel.org", false);
        toggleModelPopover(true);
        await requestSimpleModelAcquisition(bootstrap.entry);
        if (state.modelLoaded) return;
      }
      maybePresentInitialModelChooser();
    } catch (error) {
      setText(el.runtimeStatus, "Boot failed", true);
      setText(el.modelState, "boot error", true);
      setText(el.errorState, errorMessage(error), true);
      state.initialModelRestored = false;
      state.initialModelBootComplete = true;
      maybePresentInitialModelChooser();
    }
  }

  el.form.addEventListener("submit", submitBrowserConversation);

  el.modelSelect.addEventListener("change", function () {
    invalidateMemoryEndpointsRetrieval(true);
    renderMemoryEndpointsSearchResults();
    loadSelectedModelWithConsent().catch((error) => {
      setText(el.runtimeStatus, "Model load failed", true);
      setText(el.modelState, "unexpected error", true);
      setText(el.errorState, errorMessage(error), true);
      setControls(false, Object.keys(paths.models).length > 0);
    });
  });

  el.importLocalModelButton.addEventListener("click", function () {
    importBrowserComposition().catch((error) => {
      const text = errorMessage(error);
      setLocalModelStatus(text, true);
      setText(el.errorState, text, true);
      setControls(state.modelLoaded, Object.keys(paths.models).length > 0);
    });
  });

  el.localModelFile.addEventListener("change", function () {
    try {
      const selection = selectedBrowserCompositionFiles();
      const selectionError = browserCompositionSelectionError(selection);
      if (selectionError) {
        setLocalModelStatus(selectionError, true);
        return;
      }
      if (selection.selected.length === 0) {
        setLocalModelStatus("waiting", false);
        return;
      }
      const totalBytes = Array.from(selection.artifactsByName.values())
        .reduce((sum, file) => sum + file.size, 0);
      setLocalModelStatus(
        `Complete six-member composition selected / ${formatByteCount(totalBytes)}`,
        false
      );
    } catch (error) {
      setLocalModelStatus(errorMessage(error), true);
    }
  });

  if (el.inspectLocalMemoryPackageButton) {
    el.inspectLocalMemoryPackageButton.addEventListener("click", function () {
      bindLocalMemoryPackage(el.localMemoryPackageFiles).catch((error) => {
        const text = errorMessage(error);
        state.localMemoryPackage = null;
        renderLocalMemoryPackageSummary(null);
        setLocalMemoryPackageStatus(text, true);
      });
    });
  }

  if (el.clearLocalMemoryPackageButton) {
    el.clearLocalMemoryPackageButton.addEventListener("click", function () {
      clearLocalMemoryPackage();
    });
  }

  if (el.localMemoryPackageFiles) {
    el.localMemoryPackageFiles.addEventListener("change", function () {
      setLocalMemorySelectionStatus(el.localMemoryPackageFiles);
    });
  }

  if (el.localMemoryPackageSetup) {
    el.localMemoryPackageSetup.addEventListener("change", function () {
      if (localMemorySelectedFiles(el.localMemoryPackageFiles).length) {
        setLocalMemorySelectionStatus(el.localMemoryPackageFiles);
      }
    });
  }

  if (el.memoryEndpointsEnabled) {
    el.memoryEndpointsEnabled.addEventListener("change", function () {
      invalidateMemoryEndpointsAuthorization();
      try {
        readMemoryEndpointsSettings();
        state.memoryEndpoints.connected = false;
        invalidateMemoryEndpointsRetrieval(true);
        renderMemoryEndpointsSearchResults();
        setMemoryEndpointsStatus(
          state.memoryEndpoints.enabled ? "web memory enabled; connect before use" : "web memory off",
          false
        );
      } catch (error) {
        setMemoryEndpointsStatus(errorMessage(error), true);
      }
    });
  }

  [el.memoryEndpointsBaseUrl, el.memoryEndpointsWorkspaceId, el.memoryEndpointsAgentId, el.memoryEndpointsAuthHeader].forEach((input) => {
    if (!input) {
      return;
    }
    input.addEventListener("input", invalidateMemoryEndpointsAuthorization);
    input.addEventListener("change", function () {
      invalidateMemoryEndpointsAuthorization();
      try {
        readMemoryEndpointsSettings();
        state.memoryEndpoints.connected = false;
        setMemoryEndpointsStatus("web memory settings saved; connect before use", false);
      } catch (error) {
        setMemoryEndpointsStatus(errorMessage(error), true);
      }
    });
  });

  if (el.memoryEndpointsToken) {
    el.memoryEndpointsToken.addEventListener("input", function () {
      const token = el.memoryEndpointsToken.value.trim();
      invalidateMemoryEndpointsAuthorization();
      el.memoryEndpointsToken.value = token;
      state.memoryEndpoints.bearerToken = token;
      state.memoryEndpoints.connected = false;
      setMemoryEndpointsStatus(
        state.memoryEndpoints.bearerToken ? "workspace key entered for this session" : "workspace key not stored",
        false
      );
    });
  }

  if (el.memoryEndpointsClaimButton) {
    el.memoryEndpointsClaimButton.addEventListener("click", function () {
      claimMemoryEndpointsEnrollment().catch((error) => {
        if (error.code === "enrollment_cancelled") return;
        state.memoryEndpoints.connected = false;
        setMemoryEndpointsStatus(`${errorMessage(error)}; use Create Agent again to retry this claim`, true);
      }).finally(() => {
        syncMemoryEndpointsEnrollmentButtons();
      });
      syncMemoryEndpointsEnrollmentButtons();
    });
  }

  if (el.memoryEndpointsReconnectButton) {
    el.memoryEndpointsReconnectButton.addEventListener("click", function () {
      reconnectMemoryEndpointsAgent().catch((error) => {
        if (error.code === "enrollment_cancelled") return;
        state.memoryEndpoints.connected = false;
        setMemoryEndpointsStatus(errorMessage(error), true);
      }).finally(() => {
        syncMemoryEndpointsEnrollmentButtons();
      });
      syncMemoryEndpointsEnrollmentButtons();
    });
  }

  if (el.memoryEndpointsCopyCredentialsButton) {
    el.memoryEndpointsCopyCredentialsButton.addEventListener("click", function () {
      copyMemoryEndpointsIssuedCredentials().catch((error) => {
        setMemoryEndpointsStatus(errorMessage(error), true);
      });
    });
  }

  if (el.memoryEndpointsConnectButton) {
    el.memoryEndpointsConnectButton.addEventListener("click", function () {
      cancelMemoryEndpointsEnrollment();
      connectMemoryEndpoints().catch((error) => {
        if (error.code === "memory_authority_changed") return;
        state.memoryEndpoints.connected = false;
        setMemoryEndpointsStatus(errorMessage(error), true);
      });
    });
  }

  if (el.memoryEndpointsSaveShortTermButton) {
    el.memoryEndpointsSaveShortTermButton.addEventListener("click", function () {
      saveMemoryEndpoints("short_term").catch((error) => {
        if (error.code === "memory_authority_changed") return;
        setMemoryEndpointsStatus(errorMessage(error), true);
      });
    });
  }

  if (el.memoryEndpointsSaveLongTermButton) {
    el.memoryEndpointsSaveLongTermButton.addEventListener("click", function () {
      saveMemoryEndpoints("long_term").catch((error) => {
        if (error.code === "memory_authority_changed") return;
        setMemoryEndpointsStatus(errorMessage(error), true);
      });
    });
  }

  if (el.memoryEndpointsSearchButton) {
    el.memoryEndpointsSearchButton.addEventListener("click", function () {
      searchMemoryEndpoints().catch((error) => {
        if (error.code === "memory_authority_changed") return;
        setMemoryEndpointsStatus(errorMessage(error), true);
      });
    });
  }

  if (el.memoryEndpointsSearchQuery) {
    el.memoryEndpointsSearchQuery.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      if (el.memoryEndpointsSearchButton) {
        el.memoryEndpointsSearchButton.click();
      }
    });
  }

  if (el.memoryEndpointsSearchTier) {
    el.memoryEndpointsSearchTier.addEventListener("change", function () {
      state.memoryEndpoints.searchTier = memoryEndpointsNormalizeSearchTier(el.memoryEndpointsSearchTier.value);
      invalidateMemoryEndpointsRetrieval(true);
      renderMemoryEndpointsSearchResults();
      persistMemoryEndpointsSettings();
      setMemoryEndpointsStatus("hosted memory search filter saved", false);
    });
  }

  if (el.memoryEndpointsClearButton) {
    el.memoryEndpointsClearButton.addEventListener("click", function () {
      clearMemoryEndpointsSettings();
    });
  }

  el.hfSearchButton.addEventListener("click", function () {
    searchHuggingFaceModels().catch((error) => {
      if (error && error.name === "AbortError") {
        return;
      }
      setHfStatus(errorMessage(error), true);
    });
  });

  el.hfSearchInput.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    el.hfSearchButton.click();
  });

  el.resetButton.addEventListener("click", function () {
    state.lastGenerateMs = 0;
    state.lastMeasuredTokens = 0;
    state.hasContext = false;
    state.generation.rawOutput = null;
    el.console.textContent = "Presentation context reset; the next request rebuilds Prompt2 context";
    renderDiagnostics();
    setControls(state.modelLoaded, true);
  });

  el.clearChatButton.addEventListener("click", function () {
    clearActiveConversation();
  });

window.addEventListener("online", function () {
    if (!state.memoryEndpoints.enabled || !state.memoryEndpoints.bearerToken) {
      if (state.memoryEndpoints.pendingCount > 0) {
        setMemoryEndpointsStatus(memoryEndpointsPendingStatus(state.memoryEndpoints.pendingCount), false);
      }
      return;
    }
    setMemoryEndpointsStatus("reconnecting web memory", false);
    drainMemoryEndpointsOutbox().then((result) => {
      setMemoryEndpointsStatus(
        result.pending > 0 ? memoryEndpointsPendingStatus(result.pending) : "web memory synchronized",
        false
      );
    }).catch((error) => {
      setMemoryEndpointsStatus(`web memory reconnect failed: ${errorMessage(error)}`, true);
    });
  });
  window.addEventListener("offline", function () {
    if (state.memoryEndpoints.pendingCount > 0) {
      setMemoryEndpointsStatus(memoryEndpointsPendingStatus(state.memoryEndpoints.pendingCount), false);
    }
  });
  window.addEventListener("pagehide", function () {
    persistConversations();
    clearMemoryEndpointsSessionSecrets();
    state.companion.pollSequence += 1;
    for (const record of state.companion.seedRecords.values()) {
      if (record.startRequest) {
        record.stopRequested = true;
      }
    }
    markKnownDirectSeedsForReconnect("direct-composition-seed-browser-reload");
    persistDirectCompositionSeedCustody();
    if (state.companion.streamAbort) {
      state.companion.streamAbort.abort();
      state.companion.streamAbort = null;
    }
    if (state.activeAcquisitionAbort) {
      state.activeAcquisitionAbort.abort();
      state.activeAcquisitionAbort = null;
    }
    cancelActiveModelActivation();
    if (state.companion.client) {
      state.companion.client.close();
    }
    if (state.memoryEndpoints.coordinator) {
      state.memoryEndpoints.coordinator.close();
      state.memoryEndpoints.coordinator = null;
    }
    if (state.memoryEndpoints.outboxStore) {
      state.memoryEndpoints.outboxStore.close().catch(() => {});
    }
  });
  initializeUiShell();
  restoreConversationStore();
  initializeMemoryEndpointsOutbox();
  installUiEventHandlers();
  observeCopyableFields();
  renderConversation();
  boot();
}());
