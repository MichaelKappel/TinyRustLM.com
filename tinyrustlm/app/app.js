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
  const companionBridgeApi = window.TinyRustLMCompanionBridge || null;
  const companionClient = companionBridgeApi
    ? new companionBridgeApi.CompanionBridgeClient({ timeoutMilliseconds: 10000 })
    : null;
  const memoryEndpointsEnrollmentApi = window.TinyRustLMMemoryEndpointsEnrollment || null;
  const browserModelAdmissionApi = window.TinyRustLMBrowserModelAdmission;
  if (!browserModelAdmissionApi) {
    throw new Error("TinyRustLM browser model admission module is unavailable");
  }

  const paths = {
    wasm: "../runtime/tinyrustlm.wasm",
    wasmManifest: "../runtime/tinyrustlm.wasm.manifest",
    wasmSimd: "../runtime/tinyrustlm-simd.wasm",
    wasmSimdManifest: "../runtime/tinyrustlm-simd.wasm.manifest",
    registry: "../models/selector.registry",
    models: Object.create(null)
  };
  const promptFormatRaw = "raw-completion-v1";
  const promptFormats = new Set([
    promptFormatRaw,
    "alpaca-instruct-v1",
    "chatml-v1",
    "qwen3-chatml-no-think-v1",
    "llama2-chat-v1"
  ]);
  const initialModels = paths.models;
  const localModelKey = "__local_slm_file";
  const ownedModelMaxBytes = 1024 * 1024 * 1024;
  const localModelMaxBytes = ownedModelMaxBytes;
  const localModelTransferChunkBytes = 4 * 1024 * 1024;
  const companionManifestMaxBytes = 4 * 1024 * 1024;
  const modelTrustTiers = Object.freeze({
    demo: "demo-fixture",
    experimental: "experimental",
    conversation: "conversation-proven",
    quality: "quality"
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
  const peerStatusRoute = "minimodel.peer_status.v0.json";
  const peerPieceSetRoute = "minimodel.peer_piece_set.v0";
  const peerCompanionStateRoute = "minimodel.peer_companion_state.v0.json";
  const miniModelImportReceiptNextGate = "user-selected-tinyrustlm-local-file-open";
  const docsTargets = {
    runtime: `${httpsScheme}TinyRustLM.MiRust.com/`,
    minimodel: `${httpsScheme}MiniModel.MiRust.com/`
  };
  const defaultCatalogUrl = `${httpsScheme}MiniModel.org/catalog/models.v0.json`;
  const svgNamespace = "http" + "://www.w3.org/2000/svg";
  const catalogTextByteBudget = 256 * 1024;
  const catalogMaxEntries = 64;
  const catalogMaxAnnouncementRoutes = 8;
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
  const blockedPeerHosts = new Set([
    "minimodel.org",
    "tinyrustlm.com",
    "slmcomposer.com",
    "lmcomposer.com",
    "mirust.com",
    "huggingface.co"
  ]);
  const blockedPeerHostSuffixes = [
    ".minimodel.org",
    ".tinyrustlm.com",
    ".slmcomposer.com",
    ".lmcomposer.com",
    ".mirust.com",
    ".huggingface.co"
  ];
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

  const selectorContextTokenLimit = 4096;
  const runtimeSamplerCandidateCap = 1024;
  const runtimePromptByteLimit = 4 * 1024;
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
  const runtimeWasmKind = "tinyrustlm-rust-wasm";
  const runtimeWasmStatus = "validated-local-runtime";
  const runtimeWasmNextGate = "instantiate-wasm-runtime";
  const selectorDefaultStrategy = "browser-frugal-quantized";
  const registryGenomeStrategy = "selector-admission-genome-v1";
  const registryGenomeLineageStatus = "admission-bound";
  const registrySpeciesStrategy = "selector-speciation-fit-v1";
  const registrySpeciesFitStatus = "browser-fit-bound";
  const registryNoveltyStrategy = "selector-novelty-sketch-v1";
  const registryNoveltyStatus = "behavior-sketch-bound";
  const registryPopulationStrategy = "selector-population-review-route-v1";
  const registryPopulationStatus = "population-review-bound";
  const registryMateSelectionStrategy = "selector-mate-selection-route-v1";
  const registryMateSelectionParentPoolStatus = "parent-pool-bound";
  const registryMateSelectionAdmissionStatus = "admission-only";
  const registryOperatorReceiptStatus = "receipt-bound";
  const registryEvolutionRecipeVersion = "1";
  const registryEvolutionRecipeStrategy = "population-based-parent-pool-replay-v1";
  const registryEvolutionRecipeStatus = "operator-family-planned";
  const registryEvolutionSelectionSource = "population-fitness-normalized-seed-weights";
  const registryEvolutionScheduleChecksumAlgorithm = "tinyrustlm-text-checksum-v1";
  const registryPhenotypeEvidenceStrategy = "selector-phenotype-evidence-v1";
  const registryPhenotypeEvidenceStatus = "runtime-eval-bound";
  const registryHeritableArtifactStrategy = "selector-heritable-artifact-v1";
  const registryHeritableArtifactStatus = "served-artifact-bound";
  const registryFitnessVectorStatus = "eval-bound";
  const registrySourceManifestKind = "trained-source-manifest";
  const registrySourceManifestStatus = "reviewed-source-snapshot";
  const registrySourceManifestLayout = "raw-f32-tensor-files-v1";
  const registrySourceReviewKind = "safetensors-candidate-review";
  const registrySourceReviewStatus = "validated-before-extraction";
  const registrySourceReviewRequiredNextGate = "extract-raw-f32-tensors";
  const registrySourceValidationGate = "validate-source";
  const registrySourceValidationStatus = "pass";
  const registrySourceValidationDecision = "accepted-for-conversion";
  const registrySourceValidationRequiredNextGate = "convert-raw-f32-source-to-slm";
  const registryAdmissionStatus = "admitted-for-browser-selector";
  const registryAdmissionPromotionStatus = "runtime-smoke-and-eval-passed";
  const registryAdmissionRuntimeSmokeStatus = "pass";
  const registryAdmissionEvalStatus = "pass";
  const registryAdmissionQualityGate = "assistant-quality";
  const registryAdmissionPromotionDecision = "accepted-for-browser-selector";
  const registryAdmissionBrowserSelectorStatus = "admitted";
  const registryAdmissionPublicClaimStatus = "bound-to-eval-scope";
  const registryAdmissionRequiredNextGate =
    "browser-selector-loads-model-and-activates-admitted-composition";
  const selectorRegistryRequiredNextGate =
    "browser-loads-model-and-activates-selector-composition-before-generation";
  const selectorModelByteBudget = 32 * 1024 * 1024;
  const selectorCompositionGraphByteBudget = 16 * 1024 * 1024;
  const selectorRegistryTextByteBudget = 256 * 1024;
  const manifestTextByteBudget = 64 * 1024;
  const receiptTextByteBudget = 128 * 1024;
  const evidenceTextByteBudget = 128 * 1024;
  const localFetchOptions = Object.freeze({ cache: "no-store" });
  const checksumMask = (1n << 64n) - 1n;
  const checksumPrime = 0x100000001b3n;

  const state = {
    instance: null,
    exports: null,
    encoder: new TextEncoder(),
    decoder: new TextDecoder(),
    modelLoadMs: 0,
    lastGenerateMs: 0,
    lastMeasuredTokens: 0,
    lastInferenceHistoryTurns: 0,
    modelLoadSequence: 0,
    largeModelConsents: new Set(),
    wasmMemoryInitialPages: 0,
    runtimeVariant: "unselected",
    activeModelKey: "",
    activeComposition: null,
    modelLoaded: false,
    modelManifest: null,
    selectorRegistry: null,
    selectorDefaultModelKey: "",
    localModel: null,
    catalogEntries: [],
    selectedCatalogEntry: null,
    importReceiptLedger: null,
    peerStatusCheck: null,
    peerCompanionInventory: null,
    localMemoryPackage: null,
    catalogFetchAbort: null,
    hfSearchAbort: null,
    hasContext: false,
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
      sequence: 0
    },
    runHistory: [],
    latestDiagnostics: null,
    latestSampling: null,
    consoleAutoScroll: true,
    simpleSourceOption: "local",
    modelPopoverHoldUntil: 0,
    p2pEnabled: true,
    peerBaseUrl: "",
    peerContactBookPeers: [],
    peerContactBookSourceName: "",
    companion: {
      client: companionClient,
      connectionState: companionClient ? "idle" : "unsupported",
      statusText: companionClient
        ? "Browser only / desktop companion not contacted"
        : "Browser only / desktop integration unavailable",
      statusIsError: false,
      runtime: null,
      models: [],
      activeOperationId: "",
      activeOperationKind: "",
      activeEntry: null,
      activeStatus: null,
      pendingAcquisition: null,
      pollSequence: 0,
      streamAbort: null,
      browserLoadBytes: 0,
      sharing: null,
      sharingBusy: false,
      sharingStatusText: "Fleet not initialized",
      sharingStatusIsError: false
    },
    memoryEndpoints: {
      enabled: false,
      baseUrl: memoryEndpointsDefaultBaseUrl,
      workspaceId: "",
      agentId: "tinyrustlm-agent",
      authHeader: memoryEndpointsDefaultAuthHeader,
      connectionMode: "workspace",
      enrollmentClient: null,
      enrollmentClientBaseUrl: "",
      searchTier: "all",
      bearerToken: "",
      connected: false,
      searchResults: [],
      retrievalResults: [],
      retrievalCandidates: [],
      packedContext: null,
      packedModelKey: "",
      retrievalReceipt: null,
      deviceId: "",
      outboxStore: null,
      outboxReady: false,
      coordinator: null,
      pendingCount: 0,
      quarantineCount: 0,
      drainPromise: null
    },
    localConnectApprovalMode: "ask",
    localConnectFullControlAcknowledged: false,
    localConnectCategoryRules: null,
    localConnectApprovedApps: [],
    localConnectApprovedAppCategories: Object.create(null),
    localConnectEndpointUrl: `${"http:"}//127.0.0.1:8711`,
    localConnectEndpointApps: null,
    hfLastAccepted: [],
    defaultCatalogCheckedForAvailability: false
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
    currentModelSummary: document.getElementById("currentModelSummary"),
    largeModelDialog: document.getElementById("largeModelDialog"),
    largeModelDialogModel: document.getElementById("largeModelDialogModel"),
    largeModelDialogDownload: document.getElementById("largeModelDialogDownload"),
    largeModelDialogMemory: document.getElementById("largeModelDialogMemory"),
    largeModelCancelButton: document.getElementById("largeModelCancelButton"),
    largeModelConfirmButton: document.getElementById("largeModelConfirmButton"),
    simpleDiscoveryPanel: document.getElementById("simpleDiscoveryPanel"),
    simpleLocalSourceButton: document.getElementById("simpleLocalSourceButton"),
    simpleHfSourceButton: document.getElementById("simpleHfSourceButton"),
    simpleP2pSourceButton: document.getElementById("simpleP2pSourceButton"),
    simpleChooseLocalButton: document.getElementById("simpleChooseLocalButton"),
    simpleImportLocalModelButton: document.getElementById("simpleImportLocalModelButton"),
    simpleHfSearchInput: document.getElementById("simpleHfSearchInput"),
    simpleHfSortSelect: document.getElementById("simpleHfSortSelect"),
    simpleHfSearchButton: document.getElementById("simpleHfSearchButton"),
    simpleHfP2pToggle: document.getElementById("simpleHfP2pToggle"),
    simpleHfP2pStatus: document.getElementById("simpleHfP2pStatus"),
    simpleHfP2pWarning: document.getElementById("simpleHfP2pWarning"),
    simpleHfFlowSummary: document.getElementById("simpleHfFlowSummary"),
    simplePeerBaseUrlInput: document.getElementById("simplePeerBaseUrlInput"),
    simpleSavePeerUrlButton: document.getElementById("simpleSavePeerUrlButton"),
    simpleCheckPeerStatusButton: document.getElementById("simpleCheckPeerStatusButton"),
    simplePeerUrlStatus: document.getElementById("simplePeerUrlStatus"),
    companionStatus: document.getElementById("companionStatus"),
    companionDetectButton: document.getElementById("companionDetectButton"),
    companionForgetButton: document.getElementById("companionForgetButton"),
    companionPairingControls: document.getElementById("companionPairingControls"),
    companionPairingCode: document.getElementById("companionPairingCode"),
    companionPairButton: document.getElementById("companionPairButton"),
    companionSharingConsent: document.getElementById("companionSharingConsent"),
    companionImportProgress: document.getElementById("companionImportProgress"),
    companionImportProgressBar: document.getElementById("companionImportProgressBar"),
    companionImportStage: document.getElementById("companionImportStage"),
    companionCancelImportButton: document.getElementById("companionCancelImportButton"),
    companionSharingControls: document.getElementById("companionSharingControls"),
    companionSharingStatus: document.getElementById("companionSharingStatus"),
    companionSharingInitializeRow: document.getElementById("companionSharingInitializeRow"),
    companionSharingFleetId: document.getElementById("companionSharingFleetId"),
    companionSharingInitializeButton: document.getElementById("companionSharingInitializeButton"),
    companionSharingModelSelect: document.getElementById("companionSharingModelSelect"),
    companionSharingLaneABind: document.getElementById("companionSharingLaneABind"),
    companionSharingLaneAUrl: document.getElementById("companionSharingLaneAUrl"),
    companionSharingLaneBBind: document.getElementById("companionSharingLaneBBind"),
    companionSharingLaneBUrl: document.getElementById("companionSharingLaneBUrl"),
    companionSharingAdmitButton: document.getElementById("companionSharingAdmitButton"),
    companionSharingEnableButton: document.getElementById("companionSharingEnableButton"),
    companionSharingDisableButton: document.getElementById("companionSharingDisableButton"),
    companionSharingRemoveButton: document.getElementById("companionSharingRemoveButton"),
    simplePeerContactCardFile: document.getElementById("simplePeerContactCardFile"),
    simpleApplyPeerContactCardButton: document.getElementById("simpleApplyPeerContactCardButton"),
    simplePeerContactBookFile: document.getElementById("simplePeerContactBookFile"),
    simpleApplyPeerContactBookButton: document.getElementById("simpleApplyPeerContactBookButton"),
    simplePeerContactBookPeers: document.getElementById("simplePeerContactBookPeers"),
    simpleCatalogResults: document.getElementById("simpleCatalogResults"),
    simpleHfResults: document.getElementById("simpleHfResults"),
    simpleLoadCatalogButton: document.getElementById("simpleLoadCatalogButton"),
    simpleLocalCatalogFile: document.getElementById("simpleLocalCatalogFile"),
    simpleImportLocalCatalogButton: document.getElementById("simpleImportLocalCatalogButton"),
    simplePeerAnnouncementFile: document.getElementById("simplePeerAnnouncementFile"),
    simpleApplyPeerAnnouncementButton: document.getElementById("simpleApplyPeerAnnouncementButton"),
    simpleImportReceiptLedgerFile: document.getElementById("simpleImportReceiptLedgerFile"),
    simpleImportReceiptLedgerButton: document.getElementById("simpleImportReceiptLedgerButton"),
    simpleImportReceiptLedgerStatus: document.getElementById("simpleImportReceiptLedgerStatus"),
    simpleImportReceiptLedgerEntries: document.getElementById("simpleImportReceiptLedgerEntries"),
    simplePeerStatusCheckFile: document.getElementById("simplePeerStatusCheckFile"),
    simplePeerStatusCheckButton: document.getElementById("simplePeerStatusCheckButton"),
    simplePeerStatusCheckStatus: document.getElementById("simplePeerStatusCheckStatus"),
    simplePeerCompanionInventoryFile: document.getElementById("simplePeerCompanionInventoryFile"),
    simplePeerCompanionInventoryButton: document.getElementById("simplePeerCompanionInventoryButton"),
    simplePeerCompanionInventoryStatus: document.getElementById("simplePeerCompanionInventoryStatus"),
    simpleLocalConnectApprovalsButton: document.getElementById("simpleLocalConnectApprovalsButton"),
    simpleLocalConnectStatus: document.getElementById("simpleLocalConnectStatus"),
    simpleOpenAdvancedDiscoveryButton: document.getElementById("simpleOpenAdvancedDiscoveryButton"),
    simpleDiscoveryStatus: document.getElementById("simpleDiscoveryStatus"),
    simpleLocalMemoryPackageFiles: document.getElementById("simpleLocalMemoryPackageFiles"),
    simpleInspectLocalMemoryPackageButton: document.getElementById("simpleInspectLocalMemoryPackageButton"),
    simpleLocalMemoryPackageStatus: document.getElementById("simpleLocalMemoryPackageStatus"),
    simpleMemoryEndpointsSettingsButton: document.getElementById("simpleMemoryEndpointsSettingsButton"),
    simpleMemoryEndpointsStatus: document.getElementById("simpleMemoryEndpointsStatus"),
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
    catalogUrlInput: document.getElementById("catalogUrlInput"),
    catalogLoadButton: document.getElementById("catalogLoadButton"),
    localCatalogFile: document.getElementById("localCatalogFile"),
    importLocalCatalogButton: document.getElementById("importLocalCatalogButton"),
    peerContactCardFile: document.getElementById("peerContactCardFile"),
    applyPeerContactCardButton: document.getElementById("applyPeerContactCardButton"),
    peerContactBookFile: document.getElementById("peerContactBookFile"),
    applyPeerContactBookButton: document.getElementById("applyPeerContactBookButton"),
    peerContactBookPeers: document.getElementById("peerContactBookPeers"),
    peerAnnouncementFile: document.getElementById("peerAnnouncementFile"),
    applyPeerAnnouncementButton: document.getElementById("applyPeerAnnouncementButton"),
    importReceiptLedgerFile: document.getElementById("importReceiptLedgerFile"),
    importReceiptLedgerButton: document.getElementById("importReceiptLedgerButton"),
    receiptLedgerStatus: document.getElementById("receiptLedgerStatus"),
    importReceiptLedgerEntries: document.getElementById("importReceiptLedgerEntries"),
    peerStatusCheckFile: document.getElementById("peerStatusCheckFile"),
    peerStatusCheckButton: document.getElementById("peerStatusCheckButton"),
    checkPeerStatusButton: document.getElementById("checkPeerStatusButton"),
    peerStatusCheckStatus: document.getElementById("peerStatusCheckStatus"),
    peerCompanionInventoryFile: document.getElementById("peerCompanionInventoryFile"),
    peerCompanionInventoryButton: document.getElementById("peerCompanionInventoryButton"),
    peerCompanionInventoryStatus: document.getElementById("peerCompanionInventoryStatus"),
    catalogStatus: document.getElementById("catalogStatus"),
    catalogResults: document.getElementById("catalogResults"),
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
    stepTokenButton: document.getElementById("stepTokenButton"),
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
    simpleSourceOption: "slmcomposer.ui.simpleSourceOption",
    p2pEnabled: "slmcomposer.ui.p2pEnabled",
    peerBaseUrl: "slmcomposer.ui.peerBaseUrl",
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
        : "Ready for a message";
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
    storageRemove(uiStorageKeys.simpleSourceOption);
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
    return storageGet(uiStorageKeys.mode, "simple");
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
    if (value.toLowerCase().includes("catalog")) {
      return "The model list could not be loaded. Check the URL or try a local JSON list.";
    }
    if (value.toLowerCase().includes("prompt byte limit")) {
      return "The prompt is too large for this browser-local model. Try a shorter prompt.";
    }
    if (value.toLowerCase().includes("model")) {
      return "The model could not be loaded. Try a smaller local model or check that the file is a valid .slm file.";
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
        ? "MemoryEndpoints.com keeps memory available worldwide and requires internet for new reads and writes; the local sync queue uploads after you reconnect."
        : "MemoryEndpoints.com requires internet and explicit opt-in setup; local sync changes can remain queued until you reconnect.");
    } else {
      parts.push("Local copied memory and the local sync queue remain optional. MemoryEndpoints.com is recommended for memory available worldwide and across devices when you are online.");
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
    if (!el.currentModelSummary || !el.modelSelect) {
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
        ? state.localModel.label || "Selected local .slm"
        : isPublicLocalOnlyHost() && Object.keys(paths.models || {}).length > 0
          ? "Choose a local or P2P .slm"
          : "Choose a local .slm";
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
    el.currentModelSummary.textContent = `${selected} / ${stateText || "waiting"}`;
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
  }

  function setSimpleSourceOption(option, reveal) {
    const nextOption = option === "huggingface" || option === "p2p" ? option : "local";
    state.simpleSourceOption = nextOption;
    if (reveal && el.simpleDiscoveryPanel) {
      el.simpleDiscoveryPanel.hidden = false;
    }
    document.querySelectorAll("[data-source-option]").forEach((button) => {
      const selected = button.dataset.sourceOption === nextOption;
      button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll("[data-sidebar-source]").forEach((button) => {
      const selected = button.dataset.sidebarSource === nextOption;
      button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll("[data-source-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.sourcePanel !== nextOption;
    });
    storageSet(uiStorageKeys.simpleSourceOption, nextOption);
    if (el.simpleDiscoveryStatus) {
      const messages = {
        local: "Choose a trusted local .slm file. No network is needed.",
        huggingface: "Search returns model cards. Rust conversion decides whether a source can become a runnable .slm.",
        p2p: "Use MiniModel manifests from a consenting peer. Rust fetches pieces, assembles, and revalidates before import."
      };
      el.simpleDiscoveryStatus.textContent = messages[nextOption];
      el.simpleDiscoveryStatus.classList.remove("error");
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
    if (el.simpleLocalConnectStatus) {
      el.simpleLocalConnectStatus.textContent = isFullControl ? modeWarning : statusText;
      el.simpleLocalConnectStatus.classList.toggle("error", isFullControl);
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

  function openLocalConnectApprovals() {
    setAppMode("advanced");
    setRailCollapsed(false);
    const drawer = document.querySelector('[data-panel-key="dashboard-local-connect-approvals"]');
    if (drawer) {
      drawer.open = true;
      drawer.scrollIntoView({ block: "nearest" });
    }
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

  function toggleModelPopover(forceOpen) {
    const panel = el.simpleDiscoveryPanel;
    const openers = document.querySelectorAll("[data-open-model-popover], #modelEditButton");
    if (!panel) {
      return;
    }
    const nextOpen = typeof forceOpen === "boolean" ? forceOpen : panel.hidden;
    panel.hidden = !nextOpen;
    openers.forEach((button) => button.setAttribute("aria-expanded", String(nextOpen)));
  }

  function holdModelPopoverOpen(durationMs = 1500) {
    state.modelPopoverHoldUntil = Math.max(
      state.modelPopoverHoldUntil || 0,
      Date.now() + durationMs
    );
    toggleModelPopover(true);
  }

  function updateHfP2pStatus() {
    const enabled = state.p2pEnabled !== false;
    if (el.simpleHfP2pToggle) {
      el.simpleHfP2pToggle.checked = enabled;
    }
    if (el.simpleHfP2pStatus) {
      el.simpleHfP2pStatus.textContent = enabled
        ? "P2P on. Get model prefers a complete verified peer and converts locally when none is available."
        : "P2P off. New conversions create a private local .slm only; sharing can be added later.";
    }
    if (el.simpleHfP2pWarning) {
      el.simpleHfP2pWarning.hidden = enabled;
    }
  }

  function normalizedPeerBaseUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    let parsed;
    try {
      parsed = new URL(raw);
    } catch (_error) {
      throw new Error(`Enter a full consenting peer URL, for example ${peerExampleUrl}`);
    }
    if (parsed.protocol !== "http:") {
      throw new Error("Known-peer import uses direct HTTP peer URLs only in this prototype.");
    }
    if (/[?#]/.test(raw)) {
      throw new Error("Known peer URL must be a plain HTTP path without query or fragment.");
    }
    const host = parsed.hostname.toLowerCase();
    const normalizedHost = host.replace(/\.+$/, "");
    if (!normalizedHost || normalizedHost.startsWith(".") || normalizedHost.includes("..")) {
      throw new Error("Known peer host must be plain DNS or IPv4 text.");
    }
    if (isBlockedPeerHost(normalizedHost)) {
      throw new Error("That host is not a peer. Project, docs, and Hugging Face hosts cannot serve model bytes.");
    }
    if (!/^[a-z0-9.-]+$/i.test(normalizedHost)) {
      throw new Error("Known peer host must be plain DNS or IPv4 text.");
    }
    parsed.hostname = normalizedHost;
    const rawPathMatch = raw.match(/^http:\/\/[^/]*(\/.*)?$/i);
    const rawPath = rawPathMatch ? rawPathMatch[1] || "/" : parsed.pathname;
    if (rawPath.includes("\\") || rawPath.includes("..") || /[\u0000-\u0020\u007f]/.test(rawPath)) {
      throw new Error("Known peer URL path must be a plain safe path.");
    }
    if (!parsed.pathname.endsWith("/")) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.href;
  }

  function isBlockedPeerHost(host) {
    const plainHost = host.startsWith("www.") ? host.slice(4) : host;
    return blockedPeerHosts.has(plainHost)
      || blockedPeerHostSuffixes.some((suffix) => plainHost.endsWith(suffix));
  }

  function updatePeerUrlStatus(message, isError = false) {
    if (el.simplePeerBaseUrlInput && el.simplePeerBaseUrlInput.value !== state.peerBaseUrl) {
      el.simplePeerBaseUrlInput.value = state.peerBaseUrl || "";
    }
    if (el.simplePeerUrlStatus) {
      const peerText = state.peerBaseUrl
        ? `Known peer set: ${state.peerBaseUrl}`
        : "Enter the consenting peer URL once; P2P imports will use it.";
      el.simplePeerUrlStatus.textContent = message || peerText;
      el.simplePeerUrlStatus.classList.toggle("error", Boolean(isError));
    }
  }

  function renderPeerContactBookPeerList(container) {
    if (!container) {
      return;
    }
    const peers = Array.isArray(state.peerContactBookPeers) ? state.peerContactBookPeers : [];
    container.replaceChildren();
    container.hidden = peers.length === 0;
    if (!peers.length) {
      return;
    }
    peers.forEach((peer, index) => {
      const isSelected = peer.peerBaseUrl === state.peerBaseUrl;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "peer-contact-book-peer";
      button.classList.toggle("selected", isSelected);
      button.setAttribute("role", "listitem");
      button.setAttribute("aria-pressed", String(isSelected));
      button.dataset.peerIndex = String(index);

      const label = document.createElement("strong");
      label.textContent = peer.peerLabel || `Peer ${index + 1}`;
      const url = document.createElement("span");
      url.className = "peer-contact-book-url";
      url.textContent = peer.peerBaseUrl;
      const stateText = document.createElement("small");
      stateText.textContent = isSelected ? "Selected peer" : "Use peer";

      button.append(label, url, stateText);
      button.addEventListener("click", () => selectPeerContactBookPeer(index));
      container.append(button);
    });
  }

  function renderPeerContactBookPeers() {
    renderPeerContactBookPeerList(el.simplePeerContactBookPeers);
    renderPeerContactBookPeerList(el.peerContactBookPeers);
  }

  function clearPeerContactBookPeers() {
    state.peerContactBookPeers = [];
    state.peerContactBookSourceName = "";
    renderPeerContactBookPeers();
  }

  function setPeerBaseUrl(value, options = {}) {
    const normalized = normalizedPeerBaseUrl(value);
    state.peerBaseUrl = normalized;
    storageSet(uiStorageKeys.peerBaseUrl, normalized);
    if (!options.keepPeerContactBook) {
      clearPeerContactBookPeers();
    }
    updatePeerUrlStatus(normalized ? `Known peer set: ${normalized}` : "", false);
    renderPeerContactBookPeers();
    refreshPeerAvailabilityViews();
    return normalized;
  }

  function selectPeerContactBookPeer(index) {
    const peers = Array.isArray(state.peerContactBookPeers) ? state.peerContactBookPeers : [];
    const peer = peers[index];
    if (!peer) {
      return;
    }
    setPeerBaseUrl(peer.peerBaseUrl, { keepPeerContactBook: true });
    const sourceText = state.peerContactBookSourceName ? ` from ${state.peerContactBookSourceName}` : "";
    updatePeerUrlStatus(
      `Peer contact book${sourceText}: using ${peer.peerLabel} (${peer.peerBaseUrl}); Rust reverify required`,
      false
    );
    setCatalogStatus(
      `Peer contact book peer selected: ${peer.peerLabel}; known peer is ${peer.peerBaseUrl}`,
      false
    );
    holdModelPopoverOpen(2500);
  }

  function refreshPeerAvailabilityViews() {
    if (state.hfLastAccepted && state.hfLastAccepted.length) {
      renderAcceptedHfResults(state.hfLastAccepted);
    }
    if (state.catalogEntries && state.catalogEntries.length) {
      renderCatalogResults(state.catalogEntries);
    }
  }

  function companionIsPaired() {
    return Boolean(state.companion.client && state.companion.client.isPaired);
  }

  function companionCanManageSharing() {
    return Boolean(
      companionIsPaired() &&
      state.companion.client.hasScope("sharing_manage")
    );
  }

  function companionAcquisitionIsActive(status) {
    const value = catalogText(status && status.state);
    return [
      "queued",
      "preflighting",
      "importing",
      "downloading",
      "reviewing",
      "converting",
      "validating"
    ].includes(value);
  }

  function companionAcquisitionStageText(status) {
    const value = catalogText(status && status.state);
    const errorCode = catalogText(status && status.error_code);
    if (!value) {
      return "Waiting";
    }
    const labels = {
      queued: "Queued locally",
      preflighting: "Verifying peer identities",
      importing: "Downloading and verifying peer pieces",
      downloading: "Downloading the immutable source revision",
      reviewing: "Reviewing source structure, tokenizer, and license evidence",
      converting: "Converting the model locally",
      validating: "Validating the assembled .slm receipt",
      available: "Verified model ready",
      resumable: errorCode
        ? `Paused safely; resume is available (${errorCode})`
        : "Paused safely; resume is available",
      failed: errorCode ? `Import rejected (${errorCode})` : "Import rejected"
    };
    if (value === "downloading") {
      const downloaded = Number(status.downloaded_source_byte_count);
      const total = Number(status.source_byte_count);
      if (Number.isSafeInteger(downloaded) && Number.isSafeInteger(total) && total > 0) {
        return `Downloading ${formatByteCount(downloaded)} of ${formatByteCount(total)}`;
      }
    }
    return labels[value] || value;
  }

  function companionVerifiedModels() {
    const models = Array.isArray(state.companion.models)
      ? state.companion.models.slice()
      : [];
    const activeOperationId = catalogText(state.companion.activeOperationId);
    if (
      activeOperationId &&
      catalogText(state.companion.activeStatus && state.companion.activeStatus.state) === "available" &&
      !models.some((model) => catalogText(model.operation_id) === activeOperationId)
    ) {
      models.push({
        operation_id: activeOperationId,
        model_id: catalogText(state.companion.activeStatus.model_id) ||
          catalogText(state.companion.activeEntry && state.companion.activeEntry.modelId) ||
          "verified local model"
      });
    }
    return models;
  }

  function renderCompanionSharingState() {
    const companion = state.companion;
    const allowed = companionCanManageSharing();
    if (el.companionSharingControls) {
      el.companionSharingControls.hidden = !allowed;
    }
    if (!allowed) {
      return;
    }
    const sharing = companion.sharing;
    const initialized = Boolean(sharing && sharing.initialized);
    if (el.companionSharingStatus) {
      el.companionSharingStatus.textContent = companion.sharingStatusText;
      el.companionSharingStatus.classList.toggle(
        "error",
        Boolean(companion.sharingStatusIsError)
      );
    }
    if (el.companionSharingInitializeRow) {
      el.companionSharingInitializeRow.hidden = initialized;
    }
    if (el.companionSharingInitializeButton) {
      el.companionSharingInitializeButton.disabled = companion.sharingBusy || initialized;
    }

    const models = companionVerifiedModels();
    const previousSelection = el.companionSharingModelSelect
      ? el.companionSharingModelSelect.value
      : "";
    if (el.companionSharingModelSelect) {
      el.companionSharingModelSelect.replaceChildren();
      if (!models.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No verified local models";
        el.companionSharingModelSelect.append(option);
      } else {
        for (const model of models) {
          const option = document.createElement("option");
          option.value = catalogText(model.operation_id);
          option.textContent = catalogText(model.model_id) || option.value;
          el.companionSharingModelSelect.append(option);
        }
        const preferred = models.some((model) =>
          catalogText(model.operation_id) === previousSelection)
          ? previousSelection
          : models.some((model) =>
            catalogText(model.operation_id) === catalogText(companion.activeOperationId))
            ? catalogText(companion.activeOperationId)
            : catalogText(models[0].operation_id);
        el.companionSharingModelSelect.value = preferred;
      }
    }

    const operationId = el.companionSharingModelSelect
      ? catalogText(el.companionSharingModelSelect.value)
      : "";
    const admitted = sharing && Array.isArray(sharing.models)
      ? sharing.models.find((model) => catalogText(model.operation_id) === operationId)
      : null;
    if (el.companionSharingAdmitButton) {
      el.companionSharingAdmitButton.disabled = Boolean(
        companion.sharingBusy || !initialized || !operationId || admitted
      );
      el.companionSharingAdmitButton.textContent = admitted
        ? "Already in fleet"
        : "Add verified import";
    }
    if (el.companionSharingEnableButton) {
      el.companionSharingEnableButton.disabled = Boolean(
        companion.sharingBusy || !admitted || admitted.enabled
      );
    }
    if (el.companionSharingDisableButton) {
      el.companionSharingDisableButton.disabled = Boolean(
        companion.sharingBusy || !admitted || !admitted.enabled
      );
    }
    if (el.companionSharingRemoveButton) {
      el.companionSharingRemoveButton.disabled = Boolean(
        companion.sharingBusy || !admitted
      );
    }
  }

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
    if (el.companionDetectButton) {
      el.companionDetectButton.disabled = companion.connectionState === "checking";
      el.companionDetectButton.textContent = paired
        ? "Refresh companion"
        : companion.connectionState === "detected"
          ? "Companion detected"
          : "Connect desktop companion";
    }
    if (el.companionForgetButton) {
      el.companionForgetButton.hidden = !paired;
      el.companionForgetButton.disabled = companion.connectionState === "checking";
    }
    if (el.companionPairingControls) {
      el.companionPairingControls.hidden = !(
        companion.connectionState === "detected" && !paired
      );
    }
    const activeStatus = companion.activeStatus;
    const showProgress = Boolean(activeStatus);
    if (el.companionImportProgress) {
      el.companionImportProgress.hidden = !showProgress;
    }
    if (el.companionImportProgressBar) {
      if (catalogText(activeStatus && activeStatus.state) === "available") {
        el.companionImportProgressBar.max = 1;
        el.companionImportProgressBar.value = 1;
      } else if (
        Number(activeStatus && activeStatus.source_byte_count) > 0 &&
        Number(activeStatus && activeStatus.downloaded_source_byte_count) >= 0
      ) {
        el.companionImportProgressBar.max = Number(activeStatus.source_byte_count);
        el.companionImportProgressBar.value = Math.min(
          Number(activeStatus.downloaded_source_byte_count),
          Number(activeStatus.source_byte_count)
        );
      } else {
        el.companionImportProgressBar.removeAttribute("value");
      }
    }
    if (el.companionImportStage) {
      const streamText = companion.browserLoadBytes > 0 && companion.activeEntry
        ? `Loading ${formatByteCount(companion.browserLoadBytes)} of ${formatByteCount(companion.activeEntry.artifactByteCount)} into browser memory`
        : companionAcquisitionStageText(activeStatus);
      el.companionImportStage.textContent = streamText;
      el.companionImportStage.classList.toggle(
        "error",
        catalogText(activeStatus && activeStatus.state) === "failed"
      );
    }
    if (el.companionCancelImportButton) {
      el.companionCancelImportButton.disabled = !(
        companionAcquisitionIsActive(activeStatus) || companion.streamAbort
      );
    }
    renderCompanionSharingState();
  }

  function setCompanionStatus(connectionState, text, isError) {
    state.companion.connectionState = connectionState;
    state.companion.statusText = text;
    state.companion.statusIsError = Boolean(isError);
    renderCompanionState();
  }

  function applyCompanionSharingStatus(sharing, message) {
    const companion = state.companion;
    companion.sharing = sharing;
    companion.sharingStatusIsError = false;
    if (message) {
      companion.sharingStatusText = message;
    } else if (!sharing.initialized) {
      companion.sharingStatusText = "Fleet not initialized";
    } else {
      companion.sharingStatusText =
        `${sharing.admitted_model_count}/20 models / ${sharing.advertisement_status} / outside proof required before publication`;
    }
    renderCompanionState();
  }

  async function refreshCompanionSharing() {
    const companion = state.companion;
    if (!companionCanManageSharing()) {
      companion.sharing = null;
      renderCompanionState();
      return null;
    }
    try {
      const sharing = await companion.client.getSharing();
      applyCompanionSharingStatus(sharing);
      return sharing;
    } catch (error) {
      companion.sharingStatusText = friendlyError(errorMessage(error));
      companion.sharingStatusIsError = true;
      renderCompanionState();
      return null;
    }
  }

  async function refreshCompanionActiveAcquisition() {
    const companion = state.companion;
    const operationId = catalogText(companion.activeOperationId);
    if (!operationId) {
      return null;
    }
    try {
      const status = companion.activeOperationKind === "conversion"
        ? await companion.client.getConversion(operationId)
        : await companion.client.getImport(operationId);
      companion.activeStatus = status;
      renderCompanionState();
      return status;
    } catch (error) {
      if (
        error &&
        (error.code === "bridge_import_not_found" || error.code === "bridge_conversion_not_found")
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
    const models = await companion.client.listModels();
    companion.runtime = runtime;
    companion.models = models;
    await refreshCompanionActiveAcquisition();
    if (companionCanManageSharing()) {
      await refreshCompanionSharing();
    } else {
      companion.sharing = null;
    }
    const modelCount = Number(runtime.model_count || models.length || 0);
    setCompanionStatus(
      "paired",
      `Connected / ${modelCount} verified local model${modelCount === 1 ? "" : "s"}`,
      false
    );
    return runtime;
  }

  async function detectCompanion() {
    const companion = state.companion;
    if (!companion.client) {
      setCompanionStatus("unsupported", "Companion bridge unavailable", true);
      return false;
    }
    setCompanionStatus("checking", "Contacting the optional desktop companion", false);
    try {
      const health = await companion.client.detect();
      if (catalogText(health && health.pairing_state) === "unpaired") {
        companion.pollSequence += 1;
      }
      setCompanionStatus("detected", "Companion detected; pairing required", false);
      if (companionIsPaired()) {
        try {
          await refreshCompanionRuntime();
        } catch (error) {
          if (companionIsPaired()) {
            throw error;
          }
          setCompanionStatus("detected", "Companion restarted; pair this browser again", false);
        }
      }
      refreshPeerAvailabilityViews();
      return true;
    } catch (_error) {
      setCompanionStatus(
        "unavailable",
        "Desktop companion not detected / browser-only mode remains ready",
        false
      );
      refreshPeerAvailabilityViews();
      return false;
    }
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
      const requestedScopes = [...companionBridgeApi.DEFAULT_SCOPES];
      if (el.companionSharingConsent && el.companionSharingConsent.checked) {
        requestedScopes.push("sharing_manage");
      }
      companion.pollSequence += 1;
      await companion.client.pair(code, requestedScopes);
      if (el.companionPairingCode) {
        el.companionPairingCode.value = "";
      }
      setCompanionStatus("paired", "Companion paired; checking local models", false);
      await refreshCompanionRuntime();
      refreshPeerAvailabilityViews();
      await resumePendingCompanionAcquisition();
      return true;
    } catch (error) {
      setCompanionStatus("detected", friendlyError(errorMessage(error)), true);
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
    companion.models = [];
    companion.activeOperationId = "";
    companion.activeOperationKind = "";
    companion.activeStatus = null;
    companion.activeEntry = null;
    companion.browserLoadBytes = 0;
    companion.sharing = null;
    companion.sharingBusy = false;
    companion.sharingStatusText = "Fleet not initialized";
    companion.sharingStatusIsError = false;
    if (el.companionSharingConsent) {
      el.companionSharingConsent.checked = false;
    }
  }

  async function forgetCompanionPairing() {
    const companion = state.companion;
    if (!companion.client || !companionIsPaired()) {
      clearCompanionSessionView();
      setCompanionStatus("detected", "Pair this browser to use the companion", false);
      refreshPeerAvailabilityViews();
      return false;
    }
    setCompanionStatus("checking", "Revoking this browser pairing", false);
    try {
      await companion.client.revoke();
      clearCompanionSessionView();
      setCompanionStatus("detected", "Pairing revoked; this browser no longer controls the companion", false);
      refreshPeerAvailabilityViews();
      return true;
    } catch (error) {
      clearCompanionSessionView();
      setCompanionStatus(
        "detected",
        `Pairing cleared in this browser; companion confirmation failed: ${friendlyError(errorMessage(error))}`,
        true
      );
      refreshPeerAvailabilityViews();
      return false;
    }
  }

  function selectedCompanionSharingOperationId() {
    const operationId = el.companionSharingModelSelect
      ? catalogText(el.companionSharingModelSelect.value)
      : "";
    if (!operationId) {
      throw new Error("Choose a verified local model first");
    }
    return operationId;
  }

  async function runCompanionSharingAction(action, pendingText, successText) {
    const companion = state.companion;
    if (!companionCanManageSharing() || companion.sharingBusy) {
      return false;
    }
    companion.sharingBusy = true;
    companion.sharingStatusText = pendingText;
    companion.sharingStatusIsError = false;
    renderCompanionState();
    try {
      const sharing = await action();
      applyCompanionSharingStatus(sharing, successText || "");
      return true;
    } catch (error) {
      companion.sharingStatusText = friendlyError(errorMessage(error));
      companion.sharingStatusIsError = true;
      return false;
    } finally {
      companion.sharingBusy = false;
      renderCompanionState();
    }
  }

  async function initializeCompanionSharing() {
    const fleetId = el.companionSharingFleetId
      ? String(el.companionSharingFleetId.value || "").trim()
      : "";
    return runCompanionSharingAction(
      () => state.companion.client.initializeSharing(fleetId),
      "Initializing the local two-lane fleet",
      "Local fleet initialized / no models admitted"
    );
  }

  function companionSharingLaneEndpoints() {
    return [
      {
        laneId: "seed-a",
        bindAddress: String(el.companionSharingLaneABind.value || "").trim(),
        publicBaseUrl: String(el.companionSharingLaneAUrl.value || "").trim()
      },
      {
        laneId: "seed-b",
        bindAddress: String(el.companionSharingLaneBBind.value || "").trim(),
        publicBaseUrl: String(el.companionSharingLaneBUrl.value || "").trim()
      }
    ];
  }

  async function admitCompanionImportForSharing() {
    return runCompanionSharingAction(
      () => state.companion.client.admitImportForSharing(
        selectedCompanionSharingOperationId(),
        companionSharingLaneEndpoints()),
      "Revalidating the import and preparing two local seed lanes",
      "Verified import added disabled / outside-network proof still required"
    );
  }

  async function setCompanionImportSharingEnabled(enabled) {
    return runCompanionSharingAction(
      () => state.companion.client.setImportSharingEnabled(
        selectedCompanionSharingOperationId(),
        enabled),
      enabled ? "Enabling the local fleet entry" : "Pausing the local fleet entry",
      enabled
        ? "Fleet entry enabled locally / outside-network proof still required"
        : "Fleet entry paused locally / model bytes retained"
    );
  }

  async function removeCompanionImportFromSharing() {
    return runCompanionSharingAction(
      () => state.companion.client.removeImportFromSharing(
        selectedCompanionSharingOperationId()),
      "Removing the fleet reference",
      "Removed from fleet / verified local model bytes retained"
    );
  }

  function companionPeerUrls(entry) {
    const values = [];
    const add = (value) => {
      if (!value || values.length >= 2) {
        return;
      }
      const normalized = normalizedPeerBaseUrl(value);
      if (!values.includes(normalized)) {
        values.push(normalized);
      }
    };
    add(state.peerBaseUrl);
    for (const peer of Array.isArray(state.peerContactBookPeers)
      ? state.peerContactBookPeers
      : []) {
      add(peer.peerBaseUrl);
    }
    for (const source of Array.isArray(entry && entry.peerSources) ? entry.peerSources : []) {
      add(source.peerBaseUrl);
    }
    return values;
  }

  async function fetchCompanionManifest(entry) {
    const url = catalogMetadataRouteUrl(
      entry.manifestRoute,
      entry.catalogBaseUrl,
      `${entry.modelId} manifest`
    );
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer"
    });
    if (!response.ok) {
      throw new Error(`MiniModel manifest request failed (${response.status})`);
    }
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > companionManifestMaxBytes) {
      throw new Error("MiniModel manifest exceeded the companion byte boundary");
    }
    const text = await response.text();
    if (!text.trim() || state.encoder.encode(text).byteLength > companionManifestMaxBytes) {
      throw new Error("MiniModel manifest size was invalid");
    }
    return text;
  }

  async function requireCompanionForAcquisition(entry, kind) {
    if (companionIsPaired()) {
      return true;
    }
    state.companion.pendingAcquisition = { entry, kind };
    setSimpleSourceOption("p2p", true);
    holdModelPopoverOpen(5000);
    if (state.companion.connectionState !== "detected") {
      await detectCompanion();
    }
    if (state.companion.connectionState === "detected" && el.companionPairingCode) {
      el.companionPairingCode.focus();
    } else {
      setCompanionStatus(
        state.companion.connectionState,
        "Start the TinyRustLM desktop companion to get this model",
        false
      );
    }
    return false;
  }

  async function resumePendingCompanionAcquisition() {
    const pending = state.companion.pendingAcquisition;
    if (!pending || !companionIsPaired()) {
      return false;
    }
    state.companion.pendingAcquisition = null;
    if (pending.kind === "p2p") {
      return startCompanionImport(pending.entry);
    }
    return getHfModel(pending.entry);
  }

  async function startCompanionImport(entry) {
    const companion = state.companion;
    if (!await requireCompanionForAcquisition(entry, "p2p")) {
      return false;
    }
    const peerUrls = companionPeerUrls(entry);
    if (!peerUrls.length) {
      requestKnownPeerForEntry(entry);
      return false;
    }
    const sequence = companion.pollSequence + 1;
    companion.pollSequence = sequence;
    companion.activeOperationKind = "import";
    companion.activeEntry = entry;
    companion.activeStatus = { state: "queued" };
    companion.browserLoadBytes = 0;
    renderCompanionState();
    try {
      const manifestText = await fetchCompanionManifest(entry);
      if (sequence !== companion.pollSequence) {
        return false;
      }
      const requests = peerUrls.map((peerUrl) =>
        JSON.stringify(peerImportRequest(entry, peerUrl))
      );
      let status = await companion.client.startImport(manifestText, requests);
      companion.activeOperationId = catalogText(status.operation_id);
      companion.activeOperationKind = "import";
      companion.activeStatus = status;
      renderCompanionState();
      while (sequence === companion.pollSequence) {
        const importState = catalogText(status.state);
        if (importState === "available") {
          await prepareCompanionModel(entry, status, sequence);
          return true;
        }
        if (importState === "failed" || importState === "resumable") {
          setCompanionStatus(
            "paired",
            importState === "resumable"
              ? "Import paused safely; select the model again to resume"
              : `Import rejected: ${catalogText(status.error_code) || "identity validation failed"}`,
            importState === "failed"
          );
          refreshPeerAvailabilityViews();
          return false;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        if (sequence !== companion.pollSequence) {
          return false;
        }
        status = await companion.client.getImport(companion.activeOperationId);
        companion.activeStatus = status;
        renderCompanionState();
      }
      return false;
    } catch (error) {
      if (sequence === companion.pollSequence) {
        const detail = errorMessage(error);
        companion.activeStatus = {
          state: "failed",
          error_code: error && error.code ? error.code : "bridge_import_failed"
        };
        setText(el.errorState, detail, true);
        appendConsole(`companion import rejected: ${detail}`);
        setCompanionStatus("paired", friendlyError(detail), true);
        renderCompanionState();
      }
      return false;
    }
  }

  function companionSha256(value, label) {
    const digest = catalogText(value).toLowerCase().replace(/^sha256:/, "");
    if (!/^[0-9a-f]{64}$/.test(digest)) {
      throw new Error(`${label} SHA-256 was invalid`);
    }
    return digest;
  }

  async function startCompanionConversion(entry) {
    const companion = state.companion;
    if (!await requireCompanionForAcquisition(entry, "conversion")) {
      return false;
    }
    const sequence = companion.pollSequence + 1;
    companion.pollSequence = sequence;
    companion.activeOperationKind = "conversion";
    companion.activeEntry = entry;
    companion.activeStatus = { state: "queued" };
    companion.browserLoadBytes = 0;
    setHfStatus(`Inspecting the immutable ${entry.modelId} revision`, false);
    renderCompanionState();
    try {
      const detail = await fetchHfImmutableDetail(entry);
      const request = hfDirectConversionRequest(entry, detail);
      if (sequence !== companion.pollSequence) {
        return false;
      }
      setHfStatus(
        `Getting ${entry.modelId} from revision ${request.source.revision.slice(0, 12)}`,
        false
      );
      let status = await companion.client.startConversion(`${JSON.stringify(request)}\n`);
      companion.activeOperationId = catalogText(status.operation_id);
      companion.activeOperationKind = "conversion";
      companion.activeStatus = status;
      renderCompanionState();
      while (sequence === companion.pollSequence) {
        const conversionState = catalogText(status.state);
        if (conversionState === "available") {
          await prepareCompanionConvertedModel(entry, status, sequence);
          return true;
        }
        if (conversionState === "failed" || conversionState === "resumable") {
          const code = catalogText(status.error_code) || "conversion did not complete";
          setHfStatus(
            conversionState === "resumable"
              ? `Conversion paused safely (${code}); Get model resumes it`
              : `Local conversion rejected (${code})`,
            conversionState === "failed"
          );
          setCompanionStatus(
            "paired",
            conversionState === "resumable" ? "Conversion is ready to resume" : `Conversion rejected: ${code}`,
            conversionState === "failed"
          );
          return false;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        if (sequence !== companion.pollSequence) {
          return false;
        }
        status = await companion.client.getConversion(companion.activeOperationId);
        companion.activeStatus = status;
        renderCompanionState();
      }
      return false;
    } catch (error) {
      if (sequence === companion.pollSequence) {
        const detail = errorMessage(error);
        companion.activeStatus = {
          state: "failed",
          error_code: error && error.code ? error.code : "bridge_conversion_failed"
        };
        setHfStatus(friendlyError(detail), true);
        setText(el.errorState, detail, true);
        appendConsole(`companion conversion rejected: ${detail}`);
        setCompanionStatus("paired", friendlyError(detail), true);
        renderCompanionState();
      }
      return false;
    }
  }

  async function prepareCompanionConvertedModel(entry, status, sequence) {
    const companion = state.companion;
    const operationId = catalogText(status.operation_id);
    const models = await companion.client.listModels();
    const model = models.find((value) => catalogText(value.operation_id) === operationId);
    if (!model || sequence !== companion.pollSequence) {
      throw new Error("The completed conversion was absent from the companion model inventory");
    }
    const artifactByteCount = Number(model.artifact_byte_count);
    const artifactSha256 = companionSha256(model.artifact_sha256, "Converted model");
    const compositionByteCount = Number(model.composition_graph_byte_count);
    const compositionSha256 = companionSha256(
      model.composition_graph_sha256,
      "Converted model composition"
    );
    const contract = hfSourceContract(entry.modelId);
    const baseModelId = catalogText(model.base_model_id);
    const compositionId = catalogText(model.composition_id);
    const routePolicyId = catalogText(model.route_policy_id);
    const kvFormatId = catalogText(model.kv_format_id);
    const compositionMemberCount = Number(model.composition_member_count);
    if (
      !Number.isSafeInteger(artifactByteCount) || artifactByteCount <= 0 ||
      !Number.isSafeInteger(compositionByteCount) || compositionByteCount <= 0 ||
      companionSha256(status.artifact_sha256, "Conversion receipt") !== artifactSha256 ||
      Number(status.artifact_byte_count) !== artifactByteCount ||
      catalogText(model.acquisition_kind) !== "conversion" ||
      !contract || catalogText(model.model_shape) !== contract.modelShape ||
      !/^[0-9a-f]{40}$/.test(catalogText(model.source_revision)) ||
      !isRegistryTypedContentId(baseModelId, "model-sha256-") ||
      !isRegistryTypedContentId(compositionId, "composition-sha256-") ||
      !isRegistryTypedContentId(routePolicyId, "route-sha256-") ||
      !isRegistryTypedContentId(kvFormatId, "kv-format-sha256-") ||
      compositionMemberCount !== 0
    ) {
      throw new Error("The converted model inventory disagreed with its completion receipt");
    }
    const catalogEntry = {
      modelId: catalogText(model.model_id) || entry.modelId,
      displayName: entry.modelId,
      sourceModelId: entry.modelId,
      sourceRevision: catalogText(model.source_revision),
      artifactByteCount,
      artifactSha256: `sha256:${artifactSha256}`,
      modelShape: catalogText(model.model_shape),
      quantization: catalogText(model.quantization),
      tokenizer: catalogText(model.tokenizer),
      contextLength: Number(model.context_length),
      promptFormat: catalogText(model.prompt_format) || promptFormatRaw,
      admissionStatus: "rust-conversion-receipt-validated",
      qualityEvalStatus: "not-run",
      qualityClaim: "not-claimed",
      trainedQualityClaim: "not-claimed",
      intendedUse: "user-requested-local-conversion",
      requiredNextGate: "independent-conversation-quality-evaluation",
      maxTokens: Math.min(512, Math.max(16, Number(model.context_length) - 1))
    };
    companion.models = models;
    companion.activeEntry = catalogEntry;
    state.localModel = {
      label: `${entry.modelId} (locally converted)` ,
      path: `companion:${operationId}`,
      maxTokens: catalogEntry.maxTokens,
      modelBytes: artifactByteCount,
      artifactSha256: `sha256:${artifactSha256}`,
      modelShape: catalogEntry.modelShape,
      quantization: catalogEntry.quantization,
      tokenizer: catalogEntry.tokenizer,
      contextLength: catalogEntry.contextLength,
      promptFormat: catalogEntry.promptFormat,
      estimatedWasmMemoryBytes: Math.ceil(artifactByteCount * 1.3),
      requiredDownloadConsent: false,
      composition: {
        companion: true,
        bytes: compositionByteCount,
        sha256: `sha256:${compositionSha256}`,
        baseModelId,
        compositionId,
        activeGraphSha256: `sha256:${companionSha256(model.active_graph_sha256, "Active graph")}`,
        routePolicyId,
        kvFormatId,
        positionPolicySha256: `sha256:${companionSha256(model.position_policy_sha256, "Position policy")}`,
        memberCount: compositionMemberCount
      },
      companionImport: {
        operationId,
        acquisitionKind: "conversion",
        catalogEntry,
        artifactByteCount,
        artifactSha256
      }
    };
    paths.models = modelsWithLocalModel(paths.models);
    renderModelOptions(paths.models, false, localModelKey);
    setHfStatus(`${entry.modelId} converted and verified locally`, false);
    setCompanionStatus("paired", "Converted model ready; loading into browser memory", false);
    const loadResult = state.exports
      ? await loadSelectedModelWithConsent()
      : { loaded: false, outcome: "runtime-unavailable", error: "The browser runtime is not ready" };
    if (loadResult.loaded) {
      setLocalModelStatus(`${entry.modelId} loaded from the local companion`, false);
    } else {
      setLocalModelStatus(
        `${entry.modelId} is converted and stored locally; browser load did not complete`,
        loadResult.outcome === "failed"
      );
    }
  }

  async function getHfModel(entry) {
    const view = hfResultView(entry);
    if (view.p2pMatch && canStartP2pImport(view.p2pMatch)) {
      return startCompanionImport(view.p2pMatch);
    }
    if (!hfCanStartConversion(view)) {
      setHfStatus("No verified P2P copy or supported immutable conversion source is available", true);
      return false;
    }
    return startCompanionConversion(entry);
  }

  async function prepareCompanionModel(entry, status, sequence) {
    const byteCount = Number(status.artifact_byte_count);
    const artifactSha256 = companionSha256(status.artifact_sha256, "P2P import");
    const expectedArtifactSha256 = companionSha256(entry.artifactSha256, "Catalog model");
    if (
      sequence !== state.companion.pollSequence ||
      byteCount !== entry.artifactByteCount ||
      artifactSha256 !== expectedArtifactSha256 ||
      !entry.composition
    ) {
      throw new Error("Companion import identity did not match the selected catalog model");
    }
    state.localModel = {
      label: `${entry.displayName} (${entry.modelId}, desktop companion)`,
      path: `companion:${status.operation_id}`,
      maxTokens: entry.maxTokens,
      modelBytes: byteCount,
      artifactSha256,
      slmChecksum: entry.slmChecksum || "",
      modelShape: entry.modelShape || "",
      quantization: entry.quantization || "",
      tokenizer: entry.tokenizer || "",
      tokenizerChecksum: entry.tokenizerChecksum || "",
      contextLength: catalogInteger(entry.contextLength) || 1024,
      outputContract: entry.outputContract || "",
      promptFormat: entry.promptFormat || promptFormatRaw,
      estimatedWasmMemoryBytes: Math.ceil(byteCount * 1.3),
      requiredDownloadConsent: true,
      composition: entry.composition,
      companionImport: {
        operationId: status.operation_id,
        acquisitionKind: "p2p",
        catalogEntry: entry,
        artifactByteCount: byteCount,
        artifactSha256
      }
    };
    paths.models = modelsWithLocalModel(paths.models);
    renderModelOptions(paths.models, false, localModelKey);
    setCatalogStatus(`${entry.displayName} verified by the desktop companion`, false);
    setCompanionStatus("paired", "Verified model ready for browser loading", false);
    let loadResult = {
      loaded: false,
      outcome: "runtime-unavailable",
      error: "The browser runtime is not ready"
    };
    try {
      if (state.exports) {
        loadResult = await loadSelectedModelWithConsent();
      }
    } catch (error) {
      loadResult = {
        loaded: false,
        outcome: "failed",
        error: errorMessage(error)
      };
      setText(el.runtimeStatus, "Model load failed", true);
      setText(el.modelState, "unexpected error", true);
      setText(el.errorState, loadResult.error, true);
    }
    if (loadResult.loaded && sequence === state.companion.pollSequence) {
      setLocalModelStatus(
        `${entry.displayName} loaded from a receipt-verified companion import`,
        false
      );
    } else if (
      sequence === state.companion.pollSequence &&
      (loadResult.outcome === "cancelled" || loadResult.outcome === "runtime-unavailable")
    ) {
      setLocalModelStatus(
        `${entry.displayName} is stored in the companion but not loaded in browser memory`,
        false
      );
      setCompanionStatus("paired", "Model stored in companion; choose it when ready to load", false);
    } else if (sequence === state.companion.pollSequence) {
      const detail = loadResult.error || "The browser runtime did not accept the verified model";
      setLocalModelStatus(
        `${entry.displayName} remains verified in the companion; browser load failed: ${friendlyError(detail)}`,
        true
      );
      setCompanionStatus(
        "paired",
        `Browser load failed; the verified companion copy is available to retry: ${friendlyError(detail)}`,
        true
      );
      appendConsole(`companion browser load failed: ${detail}`);
      renderDiagnostics();
    }
  }

  async function cancelCompanionImport() {
    const companion = state.companion;
    companion.pollSequence += 1;
    if (companion.streamAbort) {
      companion.streamAbort.abort();
      companion.streamAbort = null;
    }
    if (
      companion.activeOperationId &&
      companionIsPaired() &&
      companionAcquisitionIsActive(companion.activeStatus)
    ) {
      try {
        companion.activeStatus = companion.activeOperationKind === "conversion"
          ? await companion.client.cancelConversion(companion.activeOperationId)
          : await companion.client.cancelImport(companion.activeOperationId);
      } catch (error) {
        setCompanionStatus("paired", friendlyError(errorMessage(error)), true);
      }
    }
    companion.browserLoadBytes = 0;
    renderCompanionState();
  }

  function requireTrueMetadataFlag(raw, key, label) {
    if (!raw || raw[key] !== true) {
      throw new Error(`${label} must declare ${key}=true`);
    }
  }

  function validatePeerContactLabel(value, label) {
    const text = catalogText(value);
    if (!text || text.length > 96 || /[\u0000-\u001f\u007f]/.test(text)) {
      throw new Error(`${label} peer_label must be 1-96 printable characters`);
    }
    return text;
  }

  function peerContactCardFromRaw(raw, sourceLabel) {
    const label = sourceLabel || "peer contact card";
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`${label} must be a JSON object`);
    }
    if (catalogText(raw.card_kind) !== "minimodel.peer_contact_card") {
      throw new Error(`${label} card kind was unsupported`);
    }
    if (catalogInteger(raw.card_version) !== 0) {
      throw new Error(`${label} card version was unsupported`);
    }
    if (catalogText(raw.transfer_protocol) !== "direct-http-piece-server-v0") {
      throw new Error(`${label} transfer protocol was unsupported`);
    }
    if (catalogText(raw.contact_status) !== "operator-reviewed-consenting-peer") {
      throw new Error(`${label} must name an operator-reviewed consenting peer`);
    }
    if (catalogText(raw.intended_use) !== "known-peer-url-for-minimodel-peer-piece-import") {
      throw new Error(`${label} intended use was unsupported`);
    }
    const peerLabel = validatePeerContactLabel(raw.peer_label, label);
    const peerBaseUrl = normalizedPeerBaseUrl(raw.peer_base_url);
    requireFalseMetadataFlag(raw, "project_server_serves_model_bytes", label);
    requireFalseMetadataFlag(raw, "project_server_runs_model_bytes", label);
    requireFalseMetadataFlag(raw, "project_server_proxies_model_bytes", label);
    const boundary = raw.boundary;
    if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
      throw new Error(`${label} must include a boundary object`);
    }
    requireTrueMetadataFlag(boundary, "metadata_only", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "peer_contact_card_embeds_model_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "project_server_serves_model_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "project_server_runs_model_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "project_server_proxies_model_bytes", `${label} boundary`);
    requireTrueMetadataFlag(boundary, "requires_rust_reverify_before_browser_import", `${label} boundary`);
    return { peerLabel, peerBaseUrl };
  }

  function requirePeerContactBookBoundary(raw, label) {
    const boundary = raw && raw.boundary;
    if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
      throw new Error(`${label} must include a boundary object`);
    }
    requireTrueMetadataFlag(boundary, "metadata_only", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "peer_contact_book_embeds_model_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "peer_contact_book_embeds_peer_piece_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "peer_contact_book_contains_catalog_availability_claims", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "project_server_serves_model_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "project_server_runs_model_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "project_server_proxies_model_bytes", `${label} boundary`);
    requireTrueMetadataFlag(boundary, "requires_rust_reverify_before_browser_import", `${label} boundary`);
  }

  function requirePeerContactBookSha256(value, label) {
    const text = catalogText(value).toLowerCase();
    if (!/^sha256:[0-9a-f]{64}$/.test(text)) {
      throw new Error(`${label} must be a sha256 digest`);
    }
    return text;
  }

  async function peerContactBookFromRaw(raw, sourceLabel) {
    const label = sourceLabel || "peer contact book";
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`${label} must be a JSON object`);
    }
    if (catalogText(raw.book_kind) !== "minimodel.peer_contact_book.v0") {
      throw new Error(`${label} book kind was unsupported`);
    }
    if (catalogInteger(raw.book_version) !== 1) {
      throw new Error(`${label} book version was unsupported`);
    }
    const contacts = Array.isArray(raw.contacts) ? raw.contacts : null;
    if (!contacts || contacts.length < 1 || contacts.length > 64) {
      throw new Error(`${label} must include 1-64 contacts`);
    }
    if (catalogInteger(raw.contact_card_count) !== contacts.length) {
      throw new Error(`${label} contact_card_count must match contacts length`);
    }
    requirePeerContactBookBoundary(raw, label);

    const seenPeerUrls = new Set();
    const cards = [];
    for (const [index, contact] of contacts.entries()) {
      const contactLabel = `${label} contacts[${index}]`;
      if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
        throw new Error(`${contactLabel} must be a JSON object`);
      }
      const expectedCardSha256 = requirePeerContactBookSha256(contact.card_sha256, `${contactLabel}.card_sha256`);
      const card = peerContactCardFromRaw(contact.card, `${contactLabel}.card`);
      const actualCardSha256 = await sha256Text(`${JSON.stringify(contact.card, null, 2)}\n`);
      if (actualCardSha256 !== expectedCardSha256) {
        throw new Error(`${contactLabel}.card_sha256 mismatch; run MiniModel inspect-peer-contact-book`);
      }
      if (seenPeerUrls.has(card.peerBaseUrl)) {
        throw new Error(`${label} contains duplicate peer_base_url ${card.peerBaseUrl}`);
      }
      seenPeerUrls.add(card.peerBaseUrl);
      cards.push(card);
    }

    return {
      contactCount: cards.length,
      firstPeerLabel: cards[0].peerLabel,
      firstPeerBaseUrl: cards[0].peerBaseUrl,
      peerLabels: cards.map((card) => card.peerLabel),
      peers: cards.map((card, index) => ({
        index,
        peerLabel: card.peerLabel,
        peerBaseUrl: card.peerBaseUrl
      }))
    };
  }

  function setHfP2pEnabled(enabled) {
    state.p2pEnabled = Boolean(enabled);
    storageSet(uiStorageKeys.p2pEnabled, String(state.p2pEnabled));
    updateHfP2pStatus();
    if (state.hfLastAccepted && state.hfLastAccepted.length) {
      renderSimpleHfResults(state.hfLastAccepted);
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

  function openSidebarSource(option) {
    setAppMode("simple");
    setSimpleSourceOption(option, true);
    toggleModelPopover(true);
    holdModelPopoverOpen(2500);
  }

  function openSidebarAdvancedTools() {
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
  }

  function openMemoryEndpointsSettings() {
    setAppMode("advanced");
    setRailCollapsed(false);
    toggleModelPopover(false);
    const drawer = document.querySelector('[data-panel-key="dashboard-model-source"]');
    if (drawer && "open" in drawer) {
      drawer.open = true;
    }
    if (drawer && typeof drawer.scrollIntoView === "function") {
      drawer.scrollIntoView({ block: "nearest" });
    }
    const focusTarget = el.memoryEndpointsWorkspaceId || el.memoryEndpointsBaseUrl || el.memoryEndpointsToken;
    if (focusTarget && typeof focusTarget.focus === "function") {
      focusTarget.focus();
    }
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
    if (starter === "custom") {
      setSimpleSourceOption("local", true);
      if (el.localModelFile) {
        el.localModelFile.click();
        el.localModelFile.focus();
      }
      setLocalModelStatus("Choose a trusted local .slm file", false);
      return;
    }
    if (starter === "external") {
      setSimpleSourceOption("huggingface", true);
      return;
    }
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

  function setRailCollapsed(collapsed) {
    if (!el.appShell) {
      return;
    }
    el.appShell.dataset.railCollapsed = String(Boolean(collapsed));
    if (el.diagnosticsRailToggle) {
      el.diagnosticsRailToggle.setAttribute(
        "aria-label",
        collapsed ? "Show Advanced Options" : "Collapse Advanced Options"
      );
      el.diagnosticsRailToggle.setAttribute("aria-expanded", String(!collapsed));
    }
    if (el.mobileAdvancedButton) {
      el.mobileAdvancedButton.setAttribute("aria-expanded", String(!collapsed));
    }
    storageSet(uiStorageKeys.railCollapsed, String(Boolean(collapsed)));
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
    state.p2pEnabled = storageGet(uiStorageKeys.p2pEnabled, "true") !== "false";
    state.peerBaseUrl = storageGet(uiStorageKeys.peerBaseUrl, "");
    restoreMemoryEndpointsSettings();
    updateHfP2pStatus();
    updatePeerUrlStatus();
    renderCompanionState();
    setAppMode(initialAppMode());
    restoreSemanticPreferences();
    restoreLocalConnectPolicy();
    markStarterSelected(storageGet(uiStorageKeys.selectedStarter, ""));
    setSimpleSourceOption(storageGet(uiStorageKeys.simpleSourceOption, "local"), false);
    setActiveTab(storageGet(uiStorageKeys.activeTab, "runtime"));
    collapseSidebar(storageGet(uiStorageKeys.sidebarCollapsed, "false") === "true");
    const storedRailCollapsed = storageGet(uiStorageKeys.railCollapsed, null);
    const compactRail = window.matchMedia("(max-width: 1199px)");
    const shouldCollapseRail = compactRail.matches
      ? true
      : storedRailCollapsed !== null
      ? storedRailCollapsed === "true"
      : false;
    setRailCollapsed(shouldCollapseRail);
    compactRail.addEventListener("change", (event) => {
      if (event.matches) {
        setRailCollapsed(true);
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
      el.advancedModeButton.addEventListener("click", () => setAppMode("advanced"));
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
      button.addEventListener("click", () => toggleModelPopover());
    });
    if (el.simpleDiscoveryPanel) {
      el.simpleDiscoveryPanel.addEventListener("pointerdown", (event) => event.stopPropagation());
      el.simpleDiscoveryPanel.addEventListener("click", (event) => event.stopPropagation());
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        toggleModelPopover(false);
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
    document.querySelectorAll("[data-source-option]").forEach((button) => {
      button.addEventListener("click", () => setSimpleSourceOption(button.dataset.sourceOption, true));
    });
    document.querySelectorAll("[data-sidebar-source]").forEach((button) => {
      button.addEventListener("click", () => openSidebarSource(button.dataset.sidebarSource));
    });
    document.querySelectorAll('[data-sidebar-action="advanced"]').forEach((button) => {
      button.addEventListener("click", () => openSidebarAdvancedTools());
    });
    if (el.simpleChooseLocalButton) {
      el.simpleChooseLocalButton.addEventListener("click", () => {
        if (el.localModelFile) {
          el.localModelFile.click();
          el.localModelFile.focus();
        }
      });
    }
    if (el.simpleImportLocalModelButton) {
      el.simpleImportLocalModelButton.addEventListener("click", () => {
        importLocalModelFile().catch((error) => {
          const text = errorMessage(error);
          setLocalModelStatus(text, true);
          setText(el.errorState, text, true);
          if (state.exports) {
            setControls(state.modelLoaded, true);
          }
        });
      });
    }
    if (el.simpleInspectLocalMemoryPackageButton) {
      el.simpleInspectLocalMemoryPackageButton.addEventListener("click", () => {
        bindLocalMemoryPackage(el.simpleLocalMemoryPackageFiles, { setup: "auto" }).catch((error) => {
          const text = errorMessage(error);
          state.localMemoryPackage = null;
          renderLocalMemoryPackageSummary(null);
          setLocalMemoryPackageStatus(text, true);
        }).finally(() => {
          holdModelPopoverOpen(2500);
        });
      });
    }
    if (el.simpleLocalMemoryPackageFiles) {
      el.simpleLocalMemoryPackageFiles.addEventListener("change", () => {
        setLocalMemorySelectionStatus(el.simpleLocalMemoryPackageFiles);
        holdModelPopoverOpen(2000);
      });
    }
    if (el.simpleMemoryEndpointsSettingsButton) {
      el.simpleMemoryEndpointsSettingsButton.addEventListener("click", () => {
        openMemoryEndpointsSettings();
      });
    }
    document.querySelectorAll('input[name="simpleCreativity"], input[name="simpleLength"]').forEach((input) => {
      input.addEventListener("change", () => syncSemanticControls(true));
    });
    if (el.simpleLoadCatalogButton) {
      el.simpleLoadCatalogButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        if (el.catalogLoadButton) {
          el.catalogLoadButton.click();
        }
      });
    }
    if (el.simpleApplyPeerAnnouncementButton) {
      el.simpleApplyPeerAnnouncementButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        applyPeerSourceAnnouncementFile(el.simplePeerAnnouncementFile).catch((error) => {
          setCatalogStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simplePeerAnnouncementFile) {
      el.simplePeerAnnouncementFile.addEventListener("change", () => {
        const file = el.simplePeerAnnouncementFile.files && el.simplePeerAnnouncementFile.files[0];
        if (!file) {
          setCatalogStatus("choose a peer-source announcement or feed after loading metadata", false);
          return;
        }
        setCatalogStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer-source announcement/feed selected`, false);
        holdModelPopoverOpen(2500);
      });
    }
    if (el.simpleImportReceiptLedgerButton) {
      el.simpleImportReceiptLedgerButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        importReceiptLedgerFile(el.simpleImportReceiptLedgerFile).catch((error) => {
          setImportReceiptLedgerStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simpleImportReceiptLedgerFile) {
      el.simpleImportReceiptLedgerFile.addEventListener("change", () => {
        const file = el.simpleImportReceiptLedgerFile.files && el.simpleImportReceiptLedgerFile.files[0];
        if (!file) {
          setImportReceiptLedgerStatus("choose an import receipt ledger JSON file", false);
          return;
        }
        setImportReceiptLedgerStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} import receipt ledger selected`, false);
        holdModelPopoverOpen(2500);
      });
    }
    if (el.simplePeerStatusCheckButton) {
      el.simplePeerStatusCheckButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        importPeerStatusCheckFile(el.simplePeerStatusCheckFile).catch((error) => {
          setPeerStatusCheckStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simplePeerStatusCheckFile) {
      el.simplePeerStatusCheckFile.addEventListener("change", () => {
        const file = el.simplePeerStatusCheckFile.files && el.simplePeerStatusCheckFile.files[0];
        if (!file) {
          setPeerStatusCheckStatus("choose a peer status check JSON file", false);
          return;
        }
        setPeerStatusCheckStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer status check selected`, false);
        holdModelPopoverOpen(2500);
      });
    }
    if (el.simplePeerCompanionInventoryButton) {
      el.simplePeerCompanionInventoryButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        importPeerCompanionInventoryFile(el.simplePeerCompanionInventoryFile).catch((error) => {
          setPeerCompanionInventoryStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simplePeerCompanionInventoryFile) {
      el.simplePeerCompanionInventoryFile.addEventListener("change", () => {
        const file = el.simplePeerCompanionInventoryFile.files && el.simplePeerCompanionInventoryFile.files[0];
        if (!file) {
          setPeerCompanionInventoryStatus("choose a peer companion inventory JSON file", false);
          return;
        }
        setPeerCompanionInventoryStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer companion inventory selected`, false);
        holdModelPopoverOpen(2500);
      });
    }
    if (el.simpleLocalConnectApprovalsButton) {
      el.simpleLocalConnectApprovalsButton.addEventListener("click", () => {
        openLocalConnectApprovals();
      });
    }
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
        void cancelCompanionImport();
      });
    }
    if (el.companionSharingInitializeButton) {
      el.companionSharingInitializeButton.addEventListener("click", () => {
        void initializeCompanionSharing();
      });
    }
    if (el.companionSharingModelSelect) {
      el.companionSharingModelSelect.addEventListener("change", () => {
        renderCompanionState();
      });
    }
    if (el.companionSharingAdmitButton) {
      el.companionSharingAdmitButton.addEventListener("click", () => {
        void admitCompanionImportForSharing();
      });
    }
    if (el.companionSharingEnableButton) {
      el.companionSharingEnableButton.addEventListener("click", () => {
        void setCompanionImportSharingEnabled(true);
      });
    }
    if (el.companionSharingDisableButton) {
      el.companionSharingDisableButton.addEventListener("click", () => {
        void setCompanionImportSharingEnabled(false);
      });
    }
    if (el.companionSharingRemoveButton) {
      el.companionSharingRemoveButton.addEventListener("click", () => {
        void removeCompanionImportFromSharing();
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
        setSimpleSourceOption("p2p", true);
        checkLivePeerStatus().catch((error) => {
          setPeerStatusCheckStatus(errorMessage(error), true);
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
    if (el.simpleApplyPeerContactCardButton) {
      el.simpleApplyPeerContactCardButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        applyPeerContactCardFile(el.simplePeerContactCardFile).catch((error) => {
          updatePeerUrlStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simplePeerContactCardFile) {
      el.simplePeerContactCardFile.addEventListener("change", () => {
        const file = el.simplePeerContactCardFile.files && el.simplePeerContactCardFile.files[0];
        if (!file) {
          updatePeerUrlStatus("choose a peer contact card or enter a URL", false);
          return;
        }
        updatePeerUrlStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer contact card selected`, false);
        holdModelPopoverOpen(2500);
      });
    }
    if (el.simpleApplyPeerContactBookButton) {
      el.simpleApplyPeerContactBookButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        applyPeerContactBookFile(el.simplePeerContactBookFile).catch((error) => {
          updatePeerUrlStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simplePeerContactBookFile) {
      el.simplePeerContactBookFile.addEventListener("change", () => {
        const file = el.simplePeerContactBookFile.files && el.simplePeerContactBookFile.files[0];
        if (!file) {
          updatePeerUrlStatus("choose a peer contact book, peer contact card, or enter a URL", false);
          return;
        }
        updatePeerUrlStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer contact book selected`, false);
        holdModelPopoverOpen(2500);
      });
    }
    if (el.simpleHfSearchButton) {
      el.simpleHfSearchButton.addEventListener("pointerdown", () => holdModelPopoverOpen(3000));
      el.simpleHfSearchButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setSimpleSourceOption("huggingface", true);
        holdModelPopoverOpen(5000);
        if (el.hfSearchInput && el.simpleHfSearchInput) {
          el.hfSearchInput.value = el.simpleHfSearchInput.value;
        }
        if (el.hfSortSelect && el.simpleHfSortSelect) {
          el.hfSortSelect.value = normalizeHfBrowseSort(el.simpleHfSortSelect.value);
        }
        searchHuggingFaceModels({ keepSimplePopover: true }).catch((error) => {
          if (error && error.name === "AbortError") {
            return;
          }
          setHfStatus(errorMessage(error), true);
          holdModelPopoverOpen(2500);
        });
        holdModelPopoverOpen(5000);
      });
    }
    if (el.simpleHfSearchInput) {
      el.simpleHfSearchInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        if (el.simpleHfSearchButton) {
          el.simpleHfSearchButton.click();
        }
      });
    }
    if (el.simpleHfSortSelect && el.hfSortSelect) {
      el.simpleHfSortSelect.addEventListener("change", () => {
        el.hfSortSelect.value = normalizeHfBrowseSort(el.simpleHfSortSelect.value);
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
    if (el.simpleHfP2pToggle) {
      el.simpleHfP2pToggle.addEventListener("change", () => {
        setHfP2pEnabled(el.simpleHfP2pToggle.checked);
        holdModelPopoverOpen(2000);
        if (state.p2pEnabled && state.hfLastAccepted && state.hfLastAccepted.length) {
          ensureDefaultCatalogForHfAvailability().then(() => {
            renderSimpleHfResults(state.hfLastAccepted);
          }).catch((error) => {
            setHfStatus(errorMessage(error), true);
          });
        }
      });
    }
    if (el.simpleOpenAdvancedDiscoveryButton) {
      el.simpleOpenAdvancedDiscoveryButton.addEventListener("click", () => {
        setAppMode("advanced");
        setRailCollapsed(false);
        const panelKey = state.simpleSourceOption === "huggingface"
          ? "advanced-discovery"
          : state.simpleSourceOption === "local"
            ? "advanced-local-import"
            : "advanced-catalog";
        const drawer = document.querySelector(`[data-panel-key="${panelKey}"]`);
        if (drawer) {
          drawer.open = true;
          drawer.scrollIntoView({ block: "nearest" });
        }
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
        setRailCollapsed(false);
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

  function memory() {
    return new Uint8Array(state.exports.memory.buffer);
  }

  function readString(ptr, len) {
    return state.decoder.decode(memory().slice(ptr, ptr + len));
  }

  function readLastResult() {
    return readString(state.exports.last_result_ptr(), state.exports.last_result_len());
  }

  function readDiagnostics() {
    return readString(state.exports.get_diagnostics_ptr(), state.exports.get_diagnostics_len());
  }

  // Parses runtime diagnostics after immutable composition activation.
  function readDiagnosticsJson() {
    try {
      return JSON.parse(readDiagnostics());
    } catch (_error) {
      return null;
    }
  }

  function allocCopy(bytes) {
    const ptr = state.exports.alloc(bytes.length);
    if (!ptr) {
      throw new Error("WASM allocation failed");
    }
    memory().set(bytes, ptr);
    return ptr;
  }

  function release(ptr, len) {
    if (ptr) {
      state.exports.dealloc(ptr, len);
    }
  }

  function hasOwnedModelTransferAbi() {
    return Boolean(
      state.exports &&
      typeof state.exports.alloc_model === "function" &&
      typeof state.exports.dealloc_model === "function" &&
      typeof state.exports.load_model_owned === "function"
    );
  }

  function hasArtifactDigestAbi() {
    return Boolean(
      state.exports &&
      typeof state.exports.begin_artifact_digest === "function" &&
      typeof state.exports.update_artifact_digest === "function" &&
      typeof state.exports.finish_artifact_digest === "function"
    );
  }

  function allocateOwnedModelTransfer(byteCount) {
    if (
      !hasOwnedModelTransferAbi() ||
      !Number.isSafeInteger(byteCount) ||
      byteCount <= 0 ||
      byteCount > ownedModelMaxBytes
    ) {
      throw new Error("Owned WASM model transfer is unavailable for this artifact");
    }
    const ptr = state.exports.alloc_model(byteCount) >>> 0;
    if (!ptr) {
      throw new Error("Owned WASM model allocation failed");
    }
    return { ptr, byteCount, consumed: false };
  }

  function discardOwnedModelTransfer(transfer) {
    if (transfer && !transfer.consumed && transfer.ptr) {
      state.exports.dealloc_model(transfer.ptr, transfer.byteCount);
      transfer.consumed = true;
    }
  }

  function ownedModelTransferFromBytes(bytes) {
    const transfer = allocateOwnedModelTransfer(bytes.length);
    transfer.mode = "owned-copy";
    try {
      memory().set(bytes, transfer.ptr);
      return transfer;
    } catch (error) {
      discardOwnedModelTransfer(transfer);
      throw error;
    }
  }

  function consumeOwnedModelTransfer(transfer) {
    if (!transfer || transfer.consumed) {
      throw new Error("Owned WASM model transfer was already consumed");
    }
    transfer.consumed = true;
    return state.exports.load_model_owned(transfer.ptr, transfer.byteCount);
  }

  async function fetchOwnedModelTransfer(model, route, label, loadId) {
    const response = await fetch(route, localFetchOptions);
    if (!response.ok) {
      throw new Error(`Unable to fetch local ${label} (${response.status})`);
    }
    const declaredBytes = Number.isSafeInteger(model.modelBytes) ? model.modelBytes : 0;
    const contentLengthText = response.headers.get("content-length") || "";
    const contentLength = /^[1-9][0-9]*$/.test(contentLengthText)
      ? Number.parseInt(contentLengthText, 10)
      : 0;
    const byteCount = declaredBytes || contentLength;
    if (!Number.isSafeInteger(byteCount) || byteCount <= 0 || byteCount > ownedModelMaxBytes) {
      throw new Error("Local model response did not declare a supported byte count");
    }
    if (declaredBytes && contentLength && declaredBytes !== contentLength) {
      throw new Error("Selector model byte count did not match the response");
    }
    if (!response.body || typeof response.body.getReader !== "function") {
      throw new Error("Streaming model transfer is not supported by this browser");
    }

    const transfer = allocateOwnedModelTransfer(byteCount);
    transfer.mode = "owned-stream";
    const reader = response.body.getReader();
    let offset = 0;
    try {
      for (;;) {
        if (loadId !== state.modelLoadSequence) {
          throw new Error("Model load was superseded");
        }
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (!(value instanceof Uint8Array) || offset + value.length > byteCount) {
          throw new Error("Local model response exceeded its declared byte count");
        }
        memory().set(value, transfer.ptr + offset);
        offset += value.length;
      }
      if (offset !== byteCount) {
        throw new Error("Local model response ended before its declared byte count");
      }
      return transfer;
    } catch (error) {
      try {
        await reader.cancel();
      } catch (_cancelError) {
        // The transfer allocation is still deterministically released below.
      }
      discardOwnedModelTransfer(transfer);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  async function fetchCompanionModelTransfer(model, loadId) {
    const source = model && model.companionImport;
    if (!source || !companionIsPaired()) {
      throw new Error("Pair the desktop companion before loading this model");
    }
    const transfer = allocateOwnedModelTransfer(source.artifactByteCount);
    transfer.mode = "owned-companion-stream";
    const controller = new AbortController();
    state.companion.streamAbort = controller;
    state.companion.browserLoadBytes = 0;
    let lastRenderedBytes = 0;
    try {
      await state.companion.client.streamModel(source.operationId, {
        expectedByteCount: source.artifactByteCount,
        expectedArtifactSha256: source.artifactSha256,
        signal: controller.signal,
        onChunk(chunk, offset) {
          if (loadId !== state.modelLoadSequence) {
            throw new Error("Model load was superseded");
          }
          memory().set(chunk, transfer.ptr + offset);
          state.companion.browserLoadBytes = offset + chunk.byteLength;
          if (
            state.companion.browserLoadBytes - lastRenderedBytes >= 8 * 1024 * 1024 ||
            state.companion.browserLoadBytes === source.artifactByteCount
          ) {
            lastRenderedBytes = state.companion.browserLoadBytes;
            renderCompanionState();
          }
        }
      });
      return transfer;
    } catch (error) {
      discardOwnedModelTransfer(transfer);
      throw error;
    } finally {
      state.companion.streamAbort = null;
      state.companion.browserLoadBytes = 0;
      renderCompanionState();
    }
  }

  function requireArtifactDigestResult(result, expectedByteCount) {
    if (
      !result ||
      result.artifact_byte_count !== expectedByteCount ||
      !isCatalogSha256(result.artifact_sha256) ||
      !isRegistryHex64(result.artifact_checksum)
    ) {
      throw new Error("Rust/WASM artifact digest result was invalid");
    }
    return {
      byteLength: result.artifact_byte_count,
      sha256: result.artifact_sha256.toLowerCase(),
      checksum: result.artifact_checksum.toLowerCase()
    };
  }

  async function localFileModelTransfer(model, loadId) {
    const localFile = model && model.localFile;
    const file = localFile && localFile.file;
    if (
      !file ||
      !Number.isSafeInteger(file.size) ||
      file.size <= 0 ||
      file.size !== localFile.byteLength ||
      file.size > ownedModelMaxBytes
    ) {
      throw new Error("Local model file identity changed before transfer");
    }
    if (!hasOwnedModelTransferAbi() || !hasArtifactDigestAbi()) {
      throw new Error("Bounded local model transfer is unavailable in this runtime");
    }
    if (localModelTransferChunkBytes % peerShareChunkBytes !== 0) {
      throw new Error("Local model transfer and peer piece sizes are incompatible");
    }

    const transfer = allocateOwnedModelTransfer(file.size);
    transfer.mode = "owned-file-stream";
    const chunks = [];
    try {
      const beginCode = state.exports.begin_artifact_digest(file.size);
      if (beginCode !== 0) {
        throw new Error(`Rust/WASM artifact digest start failed: ${readLastResult()}`);
      }
      for (let offset = 0; offset < file.size; offset += localModelTransferChunkBytes) {
        if (loadId !== state.modelLoadSequence) {
          throw new Error("Model load was superseded");
        }
        const end = Math.min(file.size, offset + localModelTransferChunkBytes);
        const value = new Uint8Array(await file.slice(offset, end).arrayBuffer());
        if (loadId !== state.modelLoadSequence) {
          throw new Error("Model load was superseded");
        }
        if (value.length !== end - offset) {
          throw new Error("Local model file slice ended before its declared byte count");
        }
        memory().set(value, transfer.ptr + offset);
        const updateCode = state.exports.update_artifact_digest(transfer.ptr + offset, value.length);
        if (updateCode !== 0) {
          throw new Error(`Rust/WASM artifact digest update failed: ${readLastResult()}`);
        }
        for (let pieceOffset = 0; pieceOffset < value.length; pieceOffset += peerShareChunkBytes) {
          const pieceEnd = Math.min(value.length, pieceOffset + peerShareChunkBytes);
          const piece = value.subarray(pieceOffset, pieceEnd);
          const pieceSha256 = await sha256Hex(piece);
          if (loadId !== state.modelLoadSequence) {
            throw new Error("Model load was superseded");
          }
          chunks.push({
            index: chunks.length,
            offset: offset + pieceOffset,
            byte_count: piece.length,
            sha256: pieceSha256
          });
        }
      }
      if (loadId !== state.modelLoadSequence) {
        throw new Error("Model load was superseded");
      }
      const finishCode = state.exports.finish_artifact_digest();
      if (finishCode !== 0) {
        throw new Error(`Rust/WASM artifact digest finalization failed: ${readLastResult()}`);
      }
      let parsed;
      try {
        parsed = JSON.parse(readLastResult());
      } catch (_error) {
        throw new Error("Rust/WASM artifact digest result was not JSON");
      }
      const identity = requireArtifactDigestResult(parsed, file.size);
      validateCatalogArtifactMatch(localFile.catalogEntry, localFile.name, identity.byteLength, identity.sha256);
      validateLocalImportReceiptArtifact(localFile.importReceipt, identity.byteLength, identity.sha256);
      const admissionArtifact = model.browserAdmission &&
        model.browserAdmission.admission.artifact;
      if (!admissionArtifact ||
          identity.sha256.replace(/^sha256:/, "") !== admissionArtifact.sha256 ||
          identity.byteLength !== admissionArtifact.byteCount) {
        throw new Error("Local model bytes did not match the browser admission");
      }
      localFile.sha256 = identity.sha256;
      localFile.checksum = identity.checksum;
      localFile.chunks = chunks;
      document.documentElement.dataset.localFileReadMode = "bounded-slice-v1";
      return transfer;
    } catch (error) {
      discardOwnedModelTransfer(transfer);
      throw error;
    }
  }

  // Captures the static exported memory footprint before runtime init can grow it.
  function wasmMemoryInitialPages() {
    const pageBytes = 64 * 1024;
    const byteLength = state.exports.memory.buffer.byteLength;
    if (byteLength % pageBytes !== 0) {
      throw new Error("WASM memory byte length was not page aligned");
    }
    return byteLength / pageBytes;
  }

  function renderDiagnostics() {
    const diagnostics = readDiagnostics();
    el.diagnostics.textContent = diagnostics;
    el.developer.textContent = diagnostics;
    state.latestDiagnostics = latestDiagnosticsSnapshot();
    renderBenchmark(diagnostics);
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
      item.textContent = "No conversation yet. Messages appear only after a verified local .slm runs through Rust/WASM generation; use local import, P2P Import, or convert a model to create one.";
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

  function extendAssistantMessage(text) {
    if (!text) {
      return;
    }
    const conversation = activeConversation();
    const last = conversation ? conversationApi.latestAssistantMessage(conversation) : null;
    if (last && last.role === "assistant" && last.status !== "failed" && last.status !== "rejected") {
      updateAssistantMessage(last.id, { status: "completed", text: `${last.text}${text}` });
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

  function applySamplingConfig() {
    const config = readSamplingConfig();
    if (typeof state.exports.set_sampling_config_v2 !== "function") {
      throw new Error("WASM runtime does not expose model-bound repetition control");
    }
    const code = state.exports.set_sampling_config_v2(
      config.temperature,
      config.topK,
      config.topP,
      config.seed,
      config.repetitionPenalty
    );
    if (code !== 0) {
      throw new Error(readLastResult() || `sampling configuration failed (${code})`);
    }
    return config;
  }

  function parseManifest(text) {
    const fields = Object.create(null);
    const lines = text.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const trimmed = lines[lineIndex].trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const separator = trimmed.indexOf("=");
      if (separator <= 0) {
        throw new Error(`Manifest line ${lineIndex + 1} is missing '='`);
      }
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (!key || !value) {
        throw new Error(`Manifest line ${lineIndex + 1} has an empty key or value`);
      }
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        throw new Error(`Manifest contains duplicate key ${key}`);
      }
      fields[key] = value;
    }
    return fields;
  }

  async function fetchTextWithinBudget(route, byteBudget, label, allowMissing) {
    const response = await fetch(route, localFetchOptions);
    if (!response.ok) {
      if (allowMissing) {
        return null;
      }
      throw new Error(`Unable to fetch local ${label} (${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > byteBudget) {
      throw new Error(`${label} byte budget exceeded`);
    }
    return state.decoder.decode(bytes);
  }

  async function fetchAdmittedCompositionGraph(model, loadId) {
    const composition = model && model.composition ? model.composition : null;
    if (!composition) {
      throw new Error("Model is not authorized by an admitted composition graph");
    }
    if (composition.companion === true) {
      if (!companionIsPaired()) {
        throw new Error("Pair the desktop companion before loading this composition");
      }
      if (
        !Number.isSafeInteger(composition.bytes) ||
        composition.bytes <= 0 ||
        composition.bytes > selectorCompositionGraphByteBudget
      ) {
        throw new Error("Companion composition graph byte count was invalid");
      }
      const bytes = new Uint8Array(composition.bytes);
      await state.companion.client.streamComposition(model.companionImport.operationId, {
        expectedByteCount: composition.bytes,
        expectedSha256: String(composition.sha256 || "").replace(/^sha256:/, ""),
        signal: state.companion.streamAbort && state.companion.streamAbort.signal,
        onChunk(chunk, offset) {
          if (loadId !== state.modelLoadSequence) {
            throw new Error("Model load was superseded");
          }
          bytes.set(chunk, offset);
        }
      });
      const observedSha256 = await sha256Hex(bytes);
      if (observedSha256 !== composition.sha256) {
        throw new Error("Companion composition graph SHA-256 mismatch");
      }
      return bytes;
    }
    const response = await fetch(composition.path, localFetchOptions);
    if (!response.ok) {
      throw new Error(`Unable to fetch admitted composition graph (${response.status})`);
    }
    const contentLengthText = response.headers.get("content-length") || "";
    if (
      contentLengthText &&
      (!/^[1-9][0-9]*$/.test(contentLengthText) ||
        Number.parseInt(contentLengthText, 10) !== composition.bytes)
    ) {
      throw new Error("Admitted composition graph response byte count mismatch");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (loadId !== state.modelLoadSequence) {
      throw new Error("Model load was superseded");
    }
    if (
      bytes.length !== composition.bytes ||
      bytes.length > selectorCompositionGraphByteBudget
    ) {
      throw new Error("Admitted composition graph byte count mismatch");
    }
    const observedSha256 = await sha256Hex(bytes);
    if (observedSha256 !== composition.sha256) {
      throw new Error("Admitted composition graph SHA-256 mismatch");
    }
    return bytes;
  }

  function manifestValue(fields, key) {
    return fields && fields[key] ? fields[key] : "unavailable";
  }

  function verifiedAssistantQualityEvalField(model, evalEvidence, key) {
    if (
      !model ||
      modelTrustTier(model) !== modelTrustTiers.quality ||
      !evalEvidence ||
      !evalEvidence.verified ||
      !evalEvidence.fields
    ) {
      return "";
    }
    return evalEvidence.fields[key] || "";
  }

  // Returns a conversation-evidence field only after its declared checksum is verified.
  function verifiedConversationEvidenceField(model, key) {
    const evidence = model && model.conversationEvidence ? model.conversationEvidence : null;
    if (
      !model ||
      modelTrustTier(model) !== modelTrustTiers.conversation ||
      !evidence ||
      !evidence.verified ||
      !evidence.fields
    ) {
      return "";
    }
    return evidence.fields[key] || "";
  }

  function provenanceQualityClaimText(fields, model, evalEvidence) {
    return (
      verifiedAssistantQualityEvalField(model, evalEvidence, "quality_decision") ||
      verifiedConversationEvidenceField(model, "quality_claim") ||
      manifestValue(fields, "quality_claim")
    );
  }

  function provenanceTrainedClaimText(fields, model, evalEvidence) {
    const decision = verifiedAssistantQualityEvalField(model, evalEvidence, "quality_decision");
    if (decision === "accepted-for-assistant-quality") {
      return "converted-trained-eval-accepted";
    }
    if (verifiedConversationEvidenceField(model, "evidence_status") === "pass") {
      return "converted-trained-conversation-evidence";
    }
    return manifestValue(fields, "trained_quality_claim");
  }

  function provenanceNextGateText(fields, model, evalEvidence) {
    const decision = verifiedAssistantQualityEvalField(model, evalEvidence, "quality_decision");
    if (decision === "accepted-for-assistant-quality") {
      return "local-browser-assistant-quality-ready";
    }
    const conversationNextGate = verifiedConversationEvidenceField(model, "required_next_gate");
    if (conversationNextGate) {
      return conversationNextGate;
    }
    return manifestValue(fields, "required_next_gate");
  }

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
      placeholder.textContent = "Choose a local or P2P .slm";
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
        option.textContent = "Choose a local .slm file";
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

  function modelsWithoutLocalModel(models) {
    const result = Object.create(null);
    for (const key of Object.keys(models || {})) {
      if (key !== localModelKey && models[key] && models[key].companionOnly !== true) {
        result[key] = models[key];
      }
    }
    return result;
  }

  function modelsWithLocalModel(models) {
    const result = Object.create(null);
    if (!isPublicLocalOnlyHost()) {
      Object.assign(result, modelsWithoutLocalModel(models));
    }
    if (state.localModel) {
      result[localModelKey] = state.localModel;
    }
    return result;
  }

  // Restores only models imported during this page session when registry intake is unavailable.
  function restoreImportedModelOptions() {
    paths.models = modelsWithLocalModel(initialModels);
    state.selectorRegistry = null;
    state.selectorDefaultModelKey = "";
    renderModelOptions(paths.models, false);
  }

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
  async function loadSelectedModelWithConsent() {
    const requestedModelKey = el.modelSelect.value;
    const model = paths.models[requestedModelKey] || null;
    const previousModelKey = state.modelLoaded && paths.models[state.activeModelKey]
      ? state.activeModelKey
      : "";
    if (modelRequiresDownloadConsent(requestedModelKey, model)) {
      const accepted = await showLargeModelConsent(model);
      if (!accepted) {
        el.modelSelect.value = previousModelKey;
        updateModelSummary();
        setControls(state.modelLoaded, true);
        return { loaded: false, outcome: "cancelled", error: "" };
      }
      state.largeModelConsents.add(requestedModelKey);
    }
    const loaded = await loadSelectedModel();
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
    const cleaned = String(name || "local-model.slm")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim();
    return (cleaned || "local-model.slm").slice(0, 96);
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
    if (el.simpleLocalMemoryPackageStatus) {
      setText(el.simpleLocalMemoryPackageStatus, text, isError);
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
    if (el.simpleLocalMemoryPackageFiles) {
      el.simpleLocalMemoryPackageFiles.value = "";
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
    if (el.simpleMemoryEndpointsStatus) {
      el.simpleMemoryEndpointsStatus.textContent = message;
      el.simpleMemoryEndpointsStatus.classList.toggle("error", Boolean(isError));
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
          .then((store) => store.recoverPending(Date.now()))
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
      const recovery = await store.recoverPending(Date.now());
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
    state.memoryEndpoints.enrollmentClient = null;
    state.memoryEndpoints.enrollmentClientBaseUrl = "";
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

  function memoryEndpointsBrowserFetchError(error) {
    const text = errorMessage(error);
    if (/failed to fetch|load failed|networkerror|network error/i.test(text)) {
      return new Error("MemoryEndpoints browser access blocked by CORS or network policy");
    }
    return error instanceof Error ? error : new Error(text);
  }

  function memoryEndpointsEnrollmentClient() {
    if (!memoryEndpointsEnrollmentApi) {
      throw new Error("MemoryEndpoints agent enrollment support is unavailable");
    }
    const baseUrl = memoryEndpointsNormalizeBaseUrl(
      el.memoryEndpointsBaseUrl ? el.memoryEndpointsBaseUrl.value : state.memoryEndpoints.baseUrl,
      { required: true }
    );
    if (
      !state.memoryEndpoints.enrollmentClient ||
      state.memoryEndpoints.enrollmentClientBaseUrl !== baseUrl
    ) {
      state.memoryEndpoints.enrollmentClient =
        new memoryEndpointsEnrollmentApi.MemoryEndpointsEnrollmentClient({ baseUrl });
      state.memoryEndpoints.enrollmentClientBaseUrl = baseUrl;
    }
    state.memoryEndpoints.baseUrl = baseUrl;
    return state.memoryEndpoints.enrollmentClient;
  }

  async function activateMemoryEndpointsAgentSession(canonicalAgentName, agentToken) {
    const client = memoryEndpointsEnrollmentClient();
    const reconnect = await client.reconnect({ canonicalAgentName, agentToken });
    state.memoryEndpoints.enabled = true;
    state.memoryEndpoints.connectionMode = "agent";
    state.memoryEndpoints.workspaceId = reconnect.workspaceId;
    state.memoryEndpoints.agentId = reconnect.canonicalAgentName;
    state.memoryEndpoints.authHeader = memoryEndpointsDefaultAuthHeader;
    state.memoryEndpoints.bearerToken = agentToken;
    state.memoryEndpoints.connected = true;
    invalidateMemoryEndpointsRetrieval(true);
    if (el.memoryEndpointsEnabled) {
      el.memoryEndpointsEnabled.checked = true;
    }
    persistMemoryEndpointsSettings();
    syncMemoryEndpointsControls();
    const drain = await drainMemoryEndpointsOutbox();
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
    if (!invitationUrl) {
      throw new Error("One-time agent URL is required");
    }
    const client = memoryEndpointsEnrollmentClient();
    setMemoryEndpointsStatus("claiming one-time agent URL", false);
    const claim = await client.claim({
      invitationUrl,
      agreedAgentName,
      idempotencyKey: memoryEndpointsIdempotencyKey("tinyrustlm-agent-claim")
    });
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
    await activateMemoryEndpointsAgentSession(claim.canonicalAgentName, claim.agentToken);
    setMemoryEndpointsStatus("agent created; keep the displayed name and token", false);
  }

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
    if (!agentToken) {
      throw new Error("Agent token is required");
    }
    setMemoryEndpointsStatus("restoring agent memory", false);
    await activateMemoryEndpointsAgentSession(canonicalAgentName, agentToken);
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

  async function memoryEndpointsPost(path, payload, idempotencyPrefix, options = {}) {
    readMemoryEndpointsSettings({ requireEnabled: true, requireAuth: true });
    const idempotencyKey = options.idempotencyKey || memoryEndpointsIdempotencyKey(idempotencyPrefix);
    let response = null;
    try {
      response = await fetch(memoryEndpointsUrl(path), {
        method: "POST",
        cache: "no-store",
        headers: {
          ...memoryEndpointsAuthHeaders(),
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      throw memoryEndpointsBrowserFetchError(error);
    }
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`MemoryEndpoints request failed with HTTP ${response.status}`);
    }
    if (!responseText.trim()) {
      return { ok: true };
    }
    try {
      return JSON.parse(responseText);
    } catch (_error) {
      return { ok: true, text: responseText.slice(0, 1024) };
    }
  }

  async function memoryEndpointsGet(path, query) {
    readMemoryEndpointsSettings({ requireEnabled: true, requireAuth: true });
    const url = new URL(memoryEndpointsUrl(path), window.location.href);
    for (const [key, value] of Object.entries(query || {})) {
      if (value === null || value === undefined || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
    let response = null;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        headers: memoryEndpointsAuthHeaders()
      });
    } catch (error) {
      throw memoryEndpointsBrowserFetchError(error);
    }
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`MemoryEndpoints request failed with HTTP ${response.status}`);
    }
    if (!responseText.trim()) {
      return { ok: true };
    }
    try {
      return JSON.parse(responseText);
    } catch (_error) {
      return { ok: true, text: responseText.slice(0, 1024) };
    }
  }

  async function pullMemoryEndpointsSnapshot() {
    const sync = requireMemoryEndpointsSync();
    const response = await memoryEndpointsGet(memoryEndpointsListPath, {
      workspaceId: state.memoryEndpoints.workspaceId,
      agentId: state.memoryEndpoints.agentId,
      actorAgentId: state.memoryEndpoints.agentId,
      actor_agent_id: state.memoryEndpoints.agentId,
      scope: memoryEndpointsTinyRustLmScope,
      scopeId: memoryEndpointsTinyRustLmScopeId,
      limit: 10000
    });
    const snapshot = sync.normalizeMemoryEventsPull(response, {
      workspaceId: state.memoryEndpoints.workspaceId,
      pulledAtUnixMs: Date.now()
    });
    const store = await memoryEndpointsOutboxStore();
    await store.commitPullSnapshot(snapshot);
    return snapshot;
  }

  async function connectMemoryEndpoints() {
    if (el.memoryEndpointsEnabled) {
      el.memoryEndpointsEnabled.checked = true;
    }
    readMemoryEndpointsSettings({ requireAuth: true });
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
        safeSummary: "TinyRustLM.com browser client configured opt-in hosted MemoryEndpoints memory."
      },
      "tinyrustlm-register-agent"
    );
    state.memoryEndpoints.connected = true;
    const drain = await drainMemoryEndpointsOutbox();
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

  async function buildMemoryEndpointsRecord(scope) {
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
      workspaceId: state.memoryEndpoints.workspaceId,
      actorAgentId: state.memoryEndpoints.agentId,
      agentId: state.memoryEndpoints.agentId,
      kind: "tinyrustlm.memory_endpoints.memory_record.v0",
      version: 1,
      scope: memoryEndpointsTinyRustLmScope,
      scopeId: memoryEndpointsTinyRustLmScopeId,
      memoryType,
      subject: title,
      title,
      summary: safeSummary,
      safeSummary,
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
    if (state.memoryEndpoints.drainPromise) {
      return state.memoryEndpoints.drainPromise;
    }
    const leaderRun = async () => {
      const sync = requireMemoryEndpointsSync();
      const store = await memoryEndpointsOutboxStore();
      let recovery = await store.recoverPending(Date.now());
      const synchronizedEventIds = [];
      let lastError = "";
      if (!state.memoryEndpoints.enabled || !state.memoryEndpoints.bearerToken) {
        state.memoryEndpoints.pendingCount = recovery.pending.length;
        return { pending: recovery.pending.length, synchronizedEventIds, eventIds: synchronizedEventIds, lastError };
      }
      try {
        await pullMemoryEndpointsSnapshot();
      } catch (error) {
        lastError = `pull failed: ${errorMessage(error)}`;
        state.memoryEndpoints.pendingCount = recovery.pending.length;
        return { pending: recovery.pending.length, synchronizedEventIds, eventIds: synchronizedEventIds, lastError };
      }

      for (let entry of recovery.pending) {
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
            { idempotencyKey: entry.idempotencyKey }
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

      recovery = await store.recoverPending(Date.now());
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
        const recovery = await store.recoverPending(Date.now());
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
        state.memoryEndpoints.workspaceId,
        leaderRun
      );
      if (election.acquired) {
        return { ...election.value, leader: true };
      }
      const recovery = await store.recoverPending(Date.now());
      state.memoryEndpoints.pendingCount = recovery.pending.length;
      return {
        pending: recovery.pending.length,
        synchronizedEventIds: [],
        eventIds: [],
        lastError: "",
        leader: false
      };
    };
    state.memoryEndpoints.drainPromise = run().finally(() => {
      state.memoryEndpoints.drainPromise = null;
    });
    return state.memoryEndpoints.drainPromise;
  }

  async function saveMemoryEndpoints(scope) {
    readMemoryEndpointsSettings({ requireEnabled: true, requireIdentity: true });
    const sync = requireMemoryEndpointsSync();
    const store = await memoryEndpointsOutboxStore();
    const record = await buildMemoryEndpointsRecord(scope);
    const memoryTier = record.tinyrustlmMemoryTier || "short_term";
    const now = Date.now();
    const prepared = await sync.prepareOutboxEntry(record, {
      eventId: memoryEndpointsStableId("event"),
      deviceId: memoryEndpointsDeviceId(),
      committedAtUnixMs: now
    });
    await store.putPrepared(prepared);
    setMemoryEndpointsStatus(`${memoryTier.replace("_", "-")} web memory saved locally`, false);
    const queued = await store.transition(prepared.eventId, (entry) => sync.markQueued(entry, Date.now()));
    state.memoryEndpoints.pendingCount += 1;
    setMemoryEndpointsStatus(`${memoryTier.replace("_", "-")} web memory queued; saved locally`, false);
    if (!state.memoryEndpoints.bearerToken) {
      return queued.localReceipt;
    }
    const drain = await drainMemoryEndpointsOutbox();
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

  async function refreshMemoryEndpointsPackedContext() {
    const sync = requireMemoryEndpointsSync();
    const candidates = Array.isArray(state.memoryEndpoints.retrievalCandidates)
      ? state.memoryEndpoints.retrievalCandidates
      : [];
    if (!candidates.length) {
      state.memoryEndpoints.packedContext = null;
      state.memoryEndpoints.packedModelKey = "";
      state.memoryEndpoints.retrievalReceipt = null;
      state.memoryEndpoints.searchResults = state.memoryEndpoints.retrievalResults.map((result) => ({
        ...result,
        contextEligible: false
      })).slice(0, memoryEndpointsMaxPreviewResults);
      return null;
    }
    const tier = state.memoryEndpoints.searchTier;
    const packed = await sync.packMemoryContext(
      candidates,
      {
        scope: memoryEndpointsTinyRustLmScope,
        scopeId: memoryEndpointsTinyRustLmScopeId,
        allowShortTerm: tier === "all" || tier === "short_term",
        allowLongTerm: tier === "all" || tier === "long_term",
        requireReviewedHosted: true,
        maxCandidates: memoryEndpointsMaxSearchResults,
        maxSummaryChars: 2400
      },
      selectedModelHostedMemoryContextBudget()
    );
    state.memoryEndpoints.packedContext = packed;
    state.memoryEndpoints.packedModelKey = state.activeModelKey || el.modelSelect.value || "";
    state.memoryEndpoints.retrievalReceipt = packed.receipt;
    const selectedRevisionIds = new Set(packed.selected.map((item) => item.revisionId));
    state.memoryEndpoints.searchResults = state.memoryEndpoints.retrievalResults.map((result) => ({
      ...result,
      contextEligible: selectedRevisionIds.has(result.candidate.revisionId)
    })).sort((left, right) =>
      Number(right.contextEligible) - Number(left.contextEligible) || left.resultIndex - right.resultIndex
    ).slice(0, memoryEndpointsMaxPreviewResults);
    return packed;
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

  async function searchMemoryEndpoints() {
    const query = memoryEndpointsPublicText(
      el.memoryEndpointsSearchQuery && el.memoryEndpointsSearchQuery.value
        ? el.memoryEndpointsSearchQuery.value
        : "tinyrustlm hosted memory",
      "Hosted memory search query",
      { maxChars: 512 }
    );
    setMemoryEndpointsStatus("searching hosted memory", false);
    const searchTier = memoryEndpointsNormalizeSearchTier(
      el.memoryEndpointsSearchTier ? el.memoryEndpointsSearchTier.value : state.memoryEndpoints.searchTier
    );
    state.memoryEndpoints.searchTier = searchTier;
    persistMemoryEndpointsSettings();
    const memoryType = memoryEndpointsMemoryTypeForTier(searchTier);
    const queryParams = {
      workspaceId: state.memoryEndpoints.workspaceId,
      agentId: state.memoryEndpoints.agentId,
      actor_agent_id: state.memoryEndpoints.agentId,
      query,
      scope: memoryEndpointsTinyRustLmScope,
      scopeId: memoryEndpointsTinyRustLmScopeId,
      memory_type: memoryType,
      limit: memoryEndpointsMaxSearchResults
    };
    const response = await memoryEndpointsGet(memoryEndpointsSearchPath, queryParams);
    if (!response || typeof response !== "object" ||
        response.rawCredentialExposed === true || response.rawPayloadExposed === true ||
        response.valuesRedacted !== true) {
      throw new Error("MemoryEndpoints search response did not prove a redacted public-safe boundary");
    }
    const normalizedResults = (await Promise.all(memoryEndpointsResultArray(response)
      .slice(0, memoryEndpointsMaxRetrievedCandidates)
      .map(async (item, index) => {
        try {
          return await normalizeMemoryEndpointsResult(item, index, response);
        } catch (_error) {
          return null;
        }
      })))
      .filter(Boolean)
      .map((result, resultIndex) => ({ ...result, resultIndex }));
    state.memoryEndpoints.retrievalResults = normalizedResults;
    state.memoryEndpoints.searchResults = normalizedResults.slice(0, memoryEndpointsMaxPreviewResults);
    state.memoryEndpoints.retrievalCandidates = normalizedResults.map((result) => result.candidate);
    await refreshMemoryEndpointsPackedContext();
    state.memoryEndpoints.connected = true;
    renderMemoryEndpointsSearchResults();
    setMemoryEndpointsStatus(
      state.memoryEndpoints.searchResults.length
        ? `${state.memoryEndpoints.searchResults.length} hosted memory results loaded`
        : "no hosted memory results found",
      false
    );
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

  function hostedMemoryContextText() {
    return memoryEndpointsHostedContextActive()
      ? state.memoryEndpoints.packedContext.context
      : "";
  }

  function runtimeMemorySuffix() {
    const suffixes = [];
    if (state.lastInferenceHistoryTurns > 0) {
      suffixes.push(`conversation_history_turns=${state.lastInferenceHistoryTurns}`);
    }
    if (state.localMemoryPackage && state.localMemoryPackage.valid) {
      suffixes.push(`uaix_memory=${state.localMemoryPackage.setup}`);
    }
    if (
      state.memoryEndpoints &&
      memoryEndpointsHostedContextActive()
    ) {
      suffixes.push("memory_endpoints=hosted");
    }
    return suffixes.length ? `, ${suffixes.join(", ")}` : "";
  }

  function runtimePromptWithLocalMemory(promptText) {
    const prompt = String(promptText || "");
    const memory = state.localMemoryPackage;
    const hostedContext = hostedMemoryContextText();
    if ((!memory || !memory.valid || !memory.contextText) && !hostedContext) {
      return prompt;
    }
    const sections = [];
    if (memory && memory.valid && memory.contextText) {
      sections.push([
        "[UAIX memory context]",
        `setup=${memory.setup}`,
        "source=local user-selected .uai deck",
        "boundary=local-only; no project-server memory upload; do not mutate source persona",
        "",
        trimTextToByteLimit(memory.contextText, localMemoryContextByteLimit)
      ].join("\n"));
    }
    if (hostedContext) {
      sections.push([
        "[MemoryEndpoints hosted memory context]",
        `agent=${state.memoryEndpoints.agentId || "tinyrustlm-agent"}`,
        "source=MemoryEndpoints.com public-safe search results",
        "boundary=opt-in hosted summaries only; never infer hidden secrets or upload .slm/model bytes",
        "",
        hostedContext
      ].join("\n"));
    }
    const suffix = `\n[End TinyRustLM memory context]\n\n[User prompt]\n${prompt}`;
    const combined = `${sections.join("\n\n")}${suffix}`;
    if (state.encoder.encode(combined).length <= runtimePromptByteLimit) {
      return combined;
    }
    if (hostedContext && memory && memory.valid && memory.contextText) {
      const localOnly = `${sections[0]}${suffix}`;
      if (state.encoder.encode(localOnly).length <= runtimePromptByteLimit) {
        return localOnly;
      }
    }
    return prompt;
  }

  function modelPromptFormat() {
    const fields = state.modelManifest || {};
    const value = String(fields.prompt_format || promptFormatRaw).trim() || promptFormatRaw;
    if (!promptFormats.has(value)) {
      throw new Error(`Model prompt format was unsupported: ${value}`);
    }
    return value;
  }

  function modelSystemPrompt() {
    const fields = state.modelManifest || {};
    return String(fields.system_prompt || "").trim();
  }

  function applyModelPromptFormat(promptText, promptFormat, systemPrompt, history) {
    return conversationApi.formatInferencePrompt({
      prompt: String(promptText || ""),
      promptFormat,
      systemPrompt,
      history: Array.isArray(history) ? history : []
    });
  }

  function currentModelContextLength() {
    const manifestLength = Number(state.modelManifest && state.modelManifest.context_length);
    if (Number.isSafeInteger(manifestLength) && manifestLength > 0) {
      return manifestLength;
    }
    const selectedKey = state.activeModelKey || (el.modelSelect ? el.modelSelect.value : "");
    const selectedModel = paths.models[selectedKey] || null;
    const modelLength = Number(selectedModel && selectedModel.contextLength);
    return Number.isSafeInteger(modelLength) && modelLength > 0 ? modelLength : 0;
  }

  function conversationHistoryPromptByteLimit() {
    const contextLength = currentModelContextLength();
    if (!contextLength) {
      return runtimePromptByteLimit;
    }
    const requestedOutputTokens = Math.max(
      1,
      Math.min(512, Number.parseInt(el.maxTokens && el.maxTokens.value, 10) || 1)
    );
    const outputReserve = Math.min(
      requestedOutputTokens,
      Math.max(8, Math.floor(contextLength / 8))
    );
    return Math.max(
      1,
      Math.min(runtimePromptByteLimit, contextLength - outputReserve)
    );
  }

  function runtimePromptForModel(promptText, options) {
    const settings = options || {};
    const promptWithMemory = runtimePromptWithLocalMemory(promptText);
    const promptFormat = modelPromptFormat();
    const systemPrompt = modelSystemPrompt();
    let history = settings.includeHistory === false
      ? []
      : conversationApi.completedInferenceHistory(activeConversation());
    let formatted = applyModelPromptFormat(promptWithMemory, promptFormat, systemPrompt, history);
    const historyPromptByteLimit = conversationHistoryPromptByteLimit();
    while (history.length && state.encoder.encode(formatted).length > historyPromptByteLimit) {
      history = history.slice(2);
      formatted = applyModelPromptFormat(promptWithMemory, promptFormat, systemPrompt, history);
    }
    if (settings.trackHistory !== false) {
      state.lastInferenceHistoryTurns = history.length / 2;
    }
    return formatted;
  }

  function expectsJsonObjectPrompt(promptText) {
    const lower = String(promptText || "").toLowerCase();
    return lower.includes("json") &&
      lower.includes("status") &&
      lower.includes("reason") &&
      (lower.includes("object") || lower.includes("{"));
  }

  function jsonFieldContext(promptText) {
    const text = String(promptText || "").trim();
    const requestIndex = text.toLowerCase().lastIndexOf("request:");
    if (requestIndex >= 0) {
      return text.slice(requestIndex + "request:".length).trim();
    }
    const parts = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : text;
  }

  function statusReasonJsonFieldPrompt(promptText, key) {
    const context = jsonFieldContext(promptText);
    if (key === "status") {
      return `Choose the best single lowercase status label from this list: local, private, review, peer, ready, error.\nAnswer with exactly one label and no other words.\nSituation: ${context}`;
    }
    return `Choose the best reason phrase from this list: ${jsonReasonPhraseOptions(context).join("; ")}.\nAnswer with exactly one phrase from the list.\nSituation: ${context}\nReason:`;
  }

  function jsonReasonPhraseOptions(contextText) {
    const context = String(contextText || "");
    const words = jsonReasonWords(context);
    const options = [];
    pushJsonReasonPhrase(options, words.slice(0, 8));
    if (words.length > 5) {
      pushJsonReasonPhrase(options, words.slice(0, 5));
      pushJsonReasonPhrase(options, words.slice(-5));
    }
    if (!options.length) {
      options.push("provided context");
    }
    return options;
  }

  function pushJsonReasonPhrase(options, words) {
    if (!Array.isArray(words) || words.length < 2) {
      return;
    }
    const phrase = words.join(" ");
    if (!options.includes(phrase)) {
      options.push(phrase);
    }
  }

  function jsonReasonWords(contextText) {
    const stopWords = new Set([
      "the", "and", "for", "with", "this", "that", "from", "into", "where",
      "return", "json", "key", "keys", "status", "reason", "case", "situation",
      "answer", "choose", "best", "phrase", "list", "exactly", "single",
      "lowercase", "label", "object", "short", "plain", "english", "describe",
      "using", "words"
    ]);
    const words = [];
    for (const word of String(contextText || "").toLowerCase().split(/[^a-z0-9]+/)) {
      if (word.length < 3 || stopWords.has(word) || words.includes(word)) {
        continue;
      }
      words.push(word);
    }
    return words;
  }

  function statusReasonJsonFieldBudget(key, maxTokens) {
    const budget = key === "status" ? 8 : 18;
    return Math.max(1, Math.min(budget, maxTokens));
  }

  function expectsTwoSentencePrompt(promptText) {
    const lower = String(promptText || "").toLowerCase();
    return /\b(?:two|2)(?:\s+[a-z0-9-]+){0,4}\s+sentences\b/.test(lower) &&
      !/\bone\s+or\s+(?:two|2)(?:\s+[a-z0-9-]+){0,4}\s+sentences\b/.test(lower) &&
      lower.includes("summarize");
  }

  function twoSentenceContext(promptText) {
    const text = String(promptText || "").trim();
    const parts = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    const colonIndex = text.indexOf(":");
    return colonIndex >= 0 ? text.slice(colonIndex + 1).trim() : text;
  }

  function twoSentenceFieldPrompt(promptText, slot) {
    const pair = twoSentenceFieldPromptVariants(promptText)[0];
    return slot === "first" ? pair.first : pair.second;
  }

  function twoSentenceFieldPromptVariants(promptText) {
    const context = twoSentenceContext(promptText);
    const first = `Summarize this text in one short complete factual sentence. Use only details from the text. Do not mention the request.\n\n${context}`;
    return [
      {
        first: `State one concrete source fact in one short complete sentence. Do not mention private, privacy, provenance, inspection, evidence, or prompts staying private.\n\n${context}`,
        second: `State one privacy or provenance source fact in one short complete sentence. Use only details that appear in the source.\n\n${context}`
      },
      {
        first,
        second: `Write one short complete factual sentence from the text about prompts staying private, local inference, provenance, or inspectable evidence. Do not mention the request.\n\n${context}`
      },
      {
        first,
        second: `Use one short factual sentence about prompt privacy, provenance, developer inspection, or inspectable evidence. Do not mention the task.\n\n${context}`
      },
      {
        first,
        second: `State one distinct source fact about prompt privacy, provenance, or developer inspection. Start with Prompts or Developers when those source details are present. Use one short factual sentence and do not mention the task.\n\n${context}`
      },
      {
        first,
        second: `Write one short complete factual sentence using only the privacy, provenance, developer-inspection, or evidence detail from the source text. Do not mention the request. Do not answer with category names only.\n\n${context}`
      }
    ];
  }

  function twoSentenceFieldBudget(maxTokens) {
    const budget = Math.max(12, Math.floor(maxTokens / 2));
    return Math.max(1, Math.min(budget, maxTokens));
  }

  function twoSentenceCompleteSentences(text) {
    return String(text || "")
      .replace(/\.slm/gi, "<SLM>")
      .split(/[.!?]+/)
      .map((part) => part.replace(/<SLM>/g, ".slm").trim())
      .filter(Boolean);
  }

  function twoSentenceQualityWords(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\.slm/g, " slm ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((word) => word && !new Set(["a", "an", "and", "are", "as", "can", "for", "from", "in", "is", "it", "of", "or", "so", "that", "the", "this", "to", "with"]).has(word));
  }

  function twoSentenceLooksTooSimilar(first, second) {
    const left = new Set(twoSentenceQualityWords(first));
    const right = new Set(twoSentenceQualityWords(second));
    const smaller = Math.min(left.size, right.size);
    if (smaller < 5) {
      return false;
    }
    let shared = 0;
    for (const word of left) {
      if (right.has(word)) {
        shared += 1;
      }
    }
    return shared / smaller >= 0.75;
  }

  function twoSentenceOutputLooksUsable(text, promptText) {
    const normalized = String(text || "").toLowerCase().replace(/\s+/g, " ");
    if (!text || [
      "here's your",
      "here is your",
      "here's a concise",
      "here is a concise",
      "i've noticed",
      "i have noticed",
      "i'm sorry",
      "sorry to hear",
      "having trouble",
      "one concrete source fact",
      "source fact",
      "one privacy or provenance",
      "one short complete sentence",
      "concise factual sentence",
      "main subject and action",
      "another sentence",
      "yes that sentence",
      "yes, that sentence",
      "accurately describes",
      "from the text",
      "from this text",
      "category names",
      "privacy or provenance benefit"
    ].some((needle) => normalized.includes(needle))) {
      return false;
    }
    if (/\b(this matter pertains to|this matter is about|this text discusses|the text discusses|this text describes|the text describes|this article discusses|the article discusses|this article describes|the article describes|this note discusses|the note discusses|this note describes|the note describes|this text is about|the text is about)\b/i.test(text)) {
      return false;
    }
    const source = twoSentenceContext(promptText).toLowerCase().replace(/\s+/g, " ");
    if (
      (source.includes("local") || source.includes("locally") || source.includes("browser-local") || source.includes("browser local") || source.includes(".slm")) &&
      !source.includes("remote") &&
      (normalized.includes("remote") || normalized.includes("remotely"))
    ) {
      return false;
    }
    const sentences = twoSentenceCompleteSentences(text);
    if (sentences.length < 2) {
      return false;
    }
    if (twoSentenceQualityWords(sentences[0]).length < 5 || twoSentenceQualityWords(sentences[1]).length < 5) {
      return false;
    }
    return !twoSentenceLooksTooSimilar(sentences[0], sentences[1]);
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

  function appendActionIfPresent(parent, action) {
    if (action) {
      parent.append(action);
    }
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
      return "Local file selected. Click Import Selected .slm to validate it.";
    }
    if (lower.includes("reading")) {
      return "Reading local model file.";
    }
    if (lower.includes("choose")) {
      return "Choose a trusted local .slm file from this computer.";
    }
    if (lower.includes("0x")) {
      return "Local model imported and verified. You can generate now.";
    }
    if (lower.includes("sha256")) {
      return "Metadata selected. Choose the matching local .slm file, then import it.";
    }
    return value || "Waiting for a local model file.";
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

  function setCatalogStatus(text, isError) {
    if (el.catalogStatus) {
      setText(el.catalogStatus, text, isError);
    }
    if (el.simpleDiscoveryStatus && state.simpleSourceOption === "p2p") {
      el.simpleDiscoveryStatus.textContent = text;
      el.simpleDiscoveryStatus.classList.toggle("error", Boolean(isError));
    }
    if (String(text || "").toLowerCase().includes("loading") || String(text || "").toLowerCase().includes("metadata")) {
      updateSystemStatus("Fetching catalog", isError);
    }
  }

  function clearCatalogResults() {
    if (el.catalogResults) {
      el.catalogResults.replaceChildren();
    }
    if (el.simpleCatalogResults) {
      el.simpleCatalogResults.replaceChildren();
    }
  }

  function catalogText(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function catalogInteger(value) {
    if (typeof value === "number" && Number.isSafeInteger(value)) {
      return value;
    }
    const text = catalogText(value);
    if (!/^[0-9]+$/.test(text)) {
      return null;
    }
    const parsed = Number.parseInt(text, 10);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  function isCatalogModelId(value) {
    return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,179}$/.test(value || "");
  }

  function isCatalogSha256(value) {
    return /^sha256:[0-9a-f]{64}$/i.test(value || "");
  }

  function normalizeCatalogSha256(value) {
    const text = catalogText(value).toLowerCase();
    return isCatalogSha256(text) ? text : "";
  }

  function catalogEntryClaimsAssistantQuality(entry) {
    const text = [
      entry.qualityClaim,
      entry.trainedQualityClaim,
      entry.qualityEvalStatus,
      entry.admissionStatus
    ].filter(Boolean).join(" ").toLowerCase();
    return text.includes("assistant-quality") ||
      text.includes("quality-verified") ||
      text.includes("accepted-for-assistant-quality");
  }

  function validateCatalogEntryTrustEnvelope(entry) {
    if (!catalogEntryClaimsAssistantQuality(entry)) {
      return;
    }
    const missing = [];
    const requireValue = (key, value) => {
      if (!String(value || "").trim()) {
        missing.push(key);
      }
    };
    requireValue("slm_checksum", entry.slmChecksum);
    requireValue("model_shape", entry.modelShape);
    requireValue("quantization", entry.quantization);
    requireValue("tokenizer", entry.tokenizer);
    requireValue("tokenizer_checksum", entry.tokenizerChecksum);
    requireValue("context_length", entry.contextLength);
    requireValue("output_contract", entry.outputContract);
    requireValue("prompt_format", entry.promptFormat);
    requireValue("intended_use", entry.intendedUse);
    requireValue("license_route", entry.licenseRoute);
    requireValue("model_card_route", entry.modelCardRoute);
    requireValue("manifest_route", entry.manifestRoute);
    requireValue("evidence_route", entry.evidenceRoute);
    if (entry.admissionStatus === "catalog-metadata-only") {
      missing.push("evidence_admission_status");
    }
    if (missing.length) {
      throw new Error(`Catalog entry ${entry.modelId} claimed assistant quality without ${missing.join(", ")}`);
    }
  }

  function catalogRouteUrl(entry, route) {
    const text = catalogText(route);
    if (!text || text.includes("\n") || text.includes("\r")) {
      return "";
    }
    try {
      return new URL(text, entry.catalogBaseUrl || window.location.href).toString();
    } catch (_error) {
      return "";
    }
  }

  function catalogMetadataRouteUrl(route, catalogBaseUrl, label) {
    const text = catalogText(route);
    if (!text || text.includes("\n") || text.includes("\r")) {
      throw new Error(`${label} route was invalid`);
    }
    if (!catalogBaseUrl) {
      throw new Error(`${label} needs a catalog URL before route resolution`);
    }
    let catalogUrl;
    let routeUrl;
    try {
      catalogUrl = new URL(catalogBaseUrl, window.location.href);
      routeUrl = new URL(text, catalogUrl);
    } catch (_error) {
      throw new Error(`${label} route URL was invalid`);
    }
    if (routeUrl.protocol !== "https:" && routeUrl.protocol !== "http:") {
      throw new Error(`${label} route must use HTTP or HTTPS`);
    }
    if (routeUrl.origin !== catalogUrl.origin) {
      throw new Error(`${label} route must stay on the catalog origin`);
    }
    return routeUrl.toString();
  }

  function assertMetadataOnlyCatalogBoundary(raw, label) {
    if (raw && raw.project_server_serves_model_bytes === true) {
      throw new Error(`${label} declares server-served model bytes`);
    }
    if (raw && raw.project_server_runs_model_bytes === true) {
      throw new Error(`${label} declares server-side model execution`);
    }
    if (catalogText(raw && raw.artifact_project_server_url)) {
      throw new Error(`${label} declares a project-server model URL`);
    }
  }

  function catalogPeerSourcesFromRaw(raw, label) {
    const rawSources = Array.isArray(raw && raw.peer_sources) ? raw.peer_sources : [];
    const declaredCount = catalogInteger(raw && raw.peer_source_count);
    if (declaredCount !== null && declaredCount !== rawSources.length) {
      throw new Error(`${label} peer source count did not match peer_sources`);
    }
    if (rawSources.length > 8) {
      throw new Error(`${label} listed more than 8 peer sources`);
    }
    return rawSources.map((source, index) => {
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        throw new Error(`${label} peer source ${index + 1} was not an object`);
      }
      assertMetadataOnlyCatalogBoundary(source, `${label} peer source ${index + 1}`);
      const peerBaseUrl = normalizedPeerBaseUrl(source.peer_base_url);
      const sourceKind = catalogText(source.source_kind || source.kind);
      const transport = catalogText(source.transport);
      const consentStatus = catalogText(source.consent_status);
      if (sourceKind && sourceKind !== "known-direct-http-peer-v0") {
        throw new Error(`${label} peer source ${index + 1} kind was unsupported`);
      }
      if (transport && transport !== "direct-http-piece-server-v0") {
        throw new Error(`${label} peer source ${index + 1} transport was unsupported`);
      }
      if (consentStatus && consentStatus !== "publisher-declared-consenting-peer") {
        throw new Error(`${label} peer source ${index + 1} consent status was unsupported`);
      }
      return {
        sourceKind: sourceKind || "known-direct-http-peer-v0",
        transport: transport || "direct-http-piece-server-v0",
        peerBaseUrl,
        consentStatus: consentStatus || "publisher-declared-consenting-peer"
      };
    });
  }

  function catalogCompositionFromRaw(raw, modelId, catalogBaseUrl) {
    const route = catalogText(raw.composition_graph_route || raw.composition_graph_path);
    const declared = [
      route,
      raw.composition_graph_byte_count || raw.composition_graph_bytes,
      raw.composition_graph_sha256,
      raw.composition_base_model_id,
      raw.composition_id,
      raw.composition_active_graph_sha256,
      raw.composition_route_policy_id,
      raw.composition_kv_format_id,
      raw.composition_position_policy_sha256,
      raw.composition_member_count
    ];
    if (!declared.some(Boolean)) {
      return null;
    }
    const bytes = catalogInteger(raw.composition_graph_byte_count || raw.composition_graph_bytes);
    const sha256 = normalizeCatalogSha256(raw.composition_graph_sha256);
    const activeGraphSha256 = normalizeCatalogSha256(raw.composition_active_graph_sha256);
    const positionPolicySha256 = normalizeCatalogSha256(raw.composition_position_policy_sha256);
    const baseModelId = catalogText(raw.composition_base_model_id);
    const compositionId = catalogText(raw.composition_id);
    const routePolicyId = catalogText(raw.composition_route_policy_id);
    const kvFormatId = catalogText(raw.composition_kv_format_id);
    const memberCount = Number(raw.composition_member_count);
    if (
      !route || !bytes || bytes > selectorCompositionGraphByteBudget ||
      !sha256 || !activeGraphSha256 || !positionPolicySha256 ||
      !isRegistryTypedContentId(baseModelId, "model-sha256-") ||
      !isRegistryTypedContentId(compositionId, "composition-sha256-") ||
      !isRegistryTypedContentId(routePolicyId, "route-sha256-") ||
      !isRegistryTypedContentId(kvFormatId, "kv-format-sha256-") ||
      !Number.isSafeInteger(memberCount) || memberCount < 0 || memberCount > 64
    ) {
      throw new Error(`Catalog entry ${modelId} composition graph was incomplete or invalid`);
    }
    return {
      path: catalogMetadataRouteUrl(route, catalogBaseUrl, `${modelId} composition graph`),
      bytes,
      sha256,
      baseModelId,
      compositionId,
      activeGraphSha256,
      routePolicyId,
      kvFormatId,
      positionPolicySha256,
      memberCount
    };
  }

  function catalogEntryFromRaw(raw, index, catalogBaseUrl) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`Catalog entry ${index + 1} was not an object`);
    }
    assertMetadataOnlyCatalogBoundary(raw, `Catalog entry ${index + 1}`);
    const modelId = catalogText(raw.model_id || raw.id);
    if (!isCatalogModelId(modelId)) {
      throw new Error(`Catalog entry ${index + 1} model id was invalid`);
    }
    const artifactKind = catalogText(raw.artifact_kind || raw.kind).toLowerCase();
    if (artifactKind !== "slm") {
      throw new Error(`Catalog entry ${modelId} was not an .slm artifact`);
    }
    const artifactByteCount = catalogInteger(raw.artifact_byte_count || raw.artifact_bytes);
    if (!artifactByteCount || artifactByteCount > localModelMaxBytes) {
      throw new Error(`Catalog entry ${modelId} byte count was invalid`);
    }
    const artifactSha256 = normalizeCatalogSha256(raw.artifact_sha256 || raw.sha256);
    if (!artifactSha256) {
      throw new Error(`Catalog entry ${modelId} SHA-256 was invalid`);
    }
    const displayName = (catalogText(raw.display_name || raw.name) || modelId).slice(0, 96);
    const maxTokens = catalogInteger(raw.max_tokens);
    const fileNameHint = safeLocalModelName(
      raw.local_file_name_hint ||
      raw.artifact_file_name ||
      `${modelId.split("/").pop()}.slm`
    );
    const declaredPeerSources = catalogPeerSourcesFromRaw(raw, `Catalog entry ${modelId}`);
    const peerHintStatus = catalogText(raw.peer_hint_status || raw.p2p_status || raw.transfer_status) || "disabled";
    const peerImportStatus = catalogText(raw.peer_import_status || raw.peer_transfer_status || raw.import_status);
    const peerOfferRoute = catalogText(raw.peer_offer_route || raw.peer_offer_path);
    const peerOfferSha256 = normalizeCatalogSha256(raw.peer_offer_sha256 || raw.peer_offer_checksum);
    const peerOfferChunkCount = catalogInteger(raw.peer_offer_chunk_count);
    const peerOfferMerkleRootSha256 = normalizeCatalogSha256(raw.peer_offer_merkle_root_sha256 || raw.merkle_root_sha256);
    const hasPeerOfferFields = Boolean(peerOfferRoute || peerOfferSha256 || peerOfferChunkCount || peerOfferMerkleRootSha256);
    if (
      peerImportStatus === "request-script-ready" ||
      peerHintStatus === "peer-offer-ready-known-peer-needed" ||
      declaredPeerSources.length ||
      hasPeerOfferFields
    ) {
      const peerOfferKind = catalogText(raw.peer_offer_kind);
      const peerOfferChunkAlgorithm = catalogText(raw.peer_offer_chunk_algorithm);
      const peerOfferChunkSize = catalogInteger(raw.peer_offer_chunk_size);
      if (peerOfferKind !== "minimodel.peer_offer.v0") {
        throw new Error(`Catalog entry ${modelId} peer offer kind was invalid`);
      }
      if (peerOfferChunkAlgorithm !== "sha256-merkle-v0") {
        throw new Error(`Catalog entry ${modelId} peer offer chunk algorithm was invalid`);
      }
      if (!peerOfferRoute || peerOfferRoute.includes("\n") || peerOfferRoute.includes("\r")) {
        throw new Error(`Catalog entry ${modelId} peer offer route was invalid`);
      }
      if (!peerOfferSha256) {
        throw new Error(`Catalog entry ${modelId} peer offer SHA-256 was invalid`);
      }
      if (!peerOfferChunkSize || peerOfferChunkSize < 1) {
        throw new Error(`Catalog entry ${modelId} peer offer chunk size was invalid`);
      }
      if (!peerOfferChunkCount || peerOfferChunkCount < 1) {
        throw new Error(`Catalog entry ${modelId} peer offer chunk count was invalid`);
      }
      if (!peerOfferMerkleRootSha256) {
        throw new Error(`Catalog entry ${modelId} peer offer Merkle root was invalid`);
      }
    }
    const promptFormat = catalogText(raw.prompt_format || raw.slm_prompt_format) || promptFormatRaw;
    if (!promptFormats.has(promptFormat)) {
      throw new Error(`Catalog entry ${modelId} prompt format was unsupported`);
    }
    const entry = {
      raw,
      catalogBaseUrl,
      modelId,
      displayName,
      publisherId: catalogText(raw.publisher_id || raw.source_identity || raw.source_id),
      publisherKeyId: catalogText(raw.publisher_key_id || raw.publisher_key || raw.key_id),
      artifactKind,
      artifactByteCount,
      artifactSha256,
      slmChecksum: catalogText(raw.slm_checksum),
      modelShape: catalogText(raw.slm_model_shape || raw.model_shape),
      quantization: catalogText(raw.slm_quantization || raw.quantization),
      tokenizer: catalogText(raw.slm_tokenizer || raw.tokenizer),
      tokenizerChecksum: catalogText(raw.slm_tokenizer_checksum || raw.tokenizer_checksum),
      contextLength: catalogText(raw.slm_context_length || raw.context_length || raw.max_context),
      outputContract: catalogText(raw.slm_output_contract || raw.output_contract),
      promptFormat,
      instructionSupport: catalogText(raw.instruction_support || raw.slm_instruction_support),
      chatSupport: catalogText(raw.chat_support || raw.slm_chat_support),
      qualityEvalStatus: catalogText(raw.quality_eval_status || raw.slm_quality_eval_status),
      intendedUse: catalogText(raw.intended_use || raw.slm_intended_use),
      configChecksum: catalogText(raw.slm_config_checksum || raw.config_checksum),
      sourceKind: catalogText(raw.source_kind) || "catalog-local-file",
      sourceIdentity: catalogText(raw.source_identity || raw.source_id),
      sourceModelId: catalogText(raw.source_model_id || raw.upstream_model_id || raw.upstream_source_id),
      sourceHuggingFaceModelId: catalogText(raw.source_huggingface_model_id || raw.huggingface_model_id || raw.hf_model_id),
      sourceUrl: catalogText(raw.source_url || raw.huggingface_url || raw.upstream_url),
      peerHintStatus,
      peerImportStatus,
      peerOfferRoute,
      peerOfferSha256,
      peerOfferChunkCount,
      peerOfferMerkleRootSha256,
      peerSources: [],
      peerProofs: [],
      unprovenPeerClaimCount: declaredPeerSources.length,
      licenseRoute: catalogText(raw.license_route),
      modelCardRoute: catalogText(raw.model_card_route),
      manifestRoute: catalogText(raw.manifest_route),
      evidenceRoute: catalogText(
        raw.evaluation_evidence_route ||
        raw.conversation_evidence_route ||
        raw.evidence_admission_route ||
        raw.admission_route ||
        raw.eval_route
      ),
      admissionStatus: catalogText(raw.evidence_admission_status || raw.admission_status) || "catalog-metadata-only",
      qualityClaim: catalogText(raw.quality_claim) || "not-endorsed-by-project",
      trainedQualityClaim: catalogText(raw.trained_quality_claim) || "not-claimed",
      requiredNextGate: catalogText(raw.required_next_gate) || "user-local-file-import",
      fileNameHint,
      maxTokens: maxTokens && maxTokens > 0 && maxTokens <= 512 ? maxTokens : 16
    };
    entry.composition = catalogCompositionFromRaw(raw, modelId, catalogBaseUrl);
    validateCatalogEntryTrustEnvelope(entry);
    return entry;
  }

  function catalogPeerStateText(entry) {
    if (!entry.peerOfferRoute) {
      return entry.peerHintStatus && entry.peerHintStatus !== "disabled"
        ? entry.peerHintStatus
        : "local file required";
    }
    const sourceState = entry.peerSources.length
      ? "outside-network proof current"
      : entry.unprovenPeerClaimCount
        ? `${entry.unprovenPeerClaimCount} unproven peer claim ignored`
        : entry.peerImportStatus || "known peer URL required";
    return `peer proof ready / ${entry.peerOfferChunkCount || "chunk count unknown"} chunks / ${sourceState}`;
  }

  function simpleCatalogPeerStateText(entry) {
    if (!entry.peerOfferRoute) {
      return entry.sourceKind || "verified source pending";
    }
    return entry.peerSources.length
      ? "P2P proof current / direct peer available"
      : entry.unprovenPeerClaimCount
        ? `P2P proof required / ${entry.unprovenPeerClaimCount} unproven peer claim ignored`
        : `P2P proof ready / ${entry.peerImportStatus || "known peer URL required"}`;
  }

  function appendCatalogRouteLinks(actions, entry, routes) {
    for (const [label, route] of routes) {
      const href = catalogRouteUrl(entry, route);
      if (!href) {
        continue;
      }
      actions.append(externalActionLink(label, href));
    }
  }

  function catalogEntriesFromBody(body, sourceLabel, catalogBaseUrl) {
    if (!body || typeof body !== "object") {
      throw new Error(`${sourceLabel} was not a JSON object`);
    }
    assertMetadataOnlyCatalogBoundary(body, sourceLabel);
    const rawEntries = Array.isArray(body) ? body : Array.isArray(body.entries) ? body.entries : [body];
    if (rawEntries.length > catalogMaxEntries) {
      throw new Error(`${sourceLabel} listed more than ${catalogMaxEntries} models`);
    }
    const entries = rawEntries.map((entry, index) => catalogEntryFromRaw(entry, index, catalogBaseUrl));
    if (!entries.length) {
      throw new Error(`${sourceLabel} did not list any models`);
    }
    return entries;
  }

  function catalogAnnouncementRouteFromRaw(raw, index, catalogBaseUrl) {
    const label = `Catalog peer-source announcement route ${index + 1}`;
    let route = "";
    let sha256 = "";
    if (typeof raw === "string") {
      route = raw;
    } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      route = raw.route || raw.announcement_route || raw.url || raw.href;
      sha256 = normalizeCatalogSha256(
        raw.sha256 ||
        raw.checksum_sha256 ||
        raw.announcement_sha256 ||
        raw.peer_source_announcement_sha256
      );
    } else {
      throw new Error(`${label} was not a string or object`);
    }
    if (!sha256) {
      throw new Error(`${label} must include a SHA-256 checksum`);
    }
    return {
      route: catalogText(route),
      url: catalogMetadataRouteUrl(route, catalogBaseUrl, label),
      sha256
    };
  }

  function catalogAnnouncementRoutesFromBody(body, catalogBaseUrl) {
    if (!body || typeof body !== "object" || Array.isArray(body) || !catalogBaseUrl) {
      return [];
    }
    const rawRoutes = [];
    if (body.peer_source_announcement_route) {
      rawRoutes.push({
        route: body.peer_source_announcement_route,
        sha256: body.peer_source_announcement_sha256 || body.peer_source_announcement_checksum_sha256
      });
    }
    if (Array.isArray(body.peer_source_announcement_routes)) {
      rawRoutes.push(...body.peer_source_announcement_routes);
    }
    if (Array.isArray(body.peer_source_announcement_feeds)) {
      rawRoutes.push(...body.peer_source_announcement_feeds);
    }
    if (rawRoutes.length > catalogMaxAnnouncementRoutes) {
      throw new Error(`Catalog listed more than ${catalogMaxAnnouncementRoutes} peer-source announcement routes`);
    }
    return rawRoutes.map((route, index) => catalogAnnouncementRouteFromRaw(route, index, catalogBaseUrl));
  }

  function renderCatalogResults(entries) {
    clearCatalogResults();
    for (const entry of entries) {
      const item = document.createElement("li");
      item.className = "model-result";
      const title = document.createElement("strong");
      title.textContent = entry.displayName;
      const meta = document.createElement("div");
      meta.className = "model-result-meta";
      meta.textContent = [
        entry.modelId,
        formatByteCount(entry.artifactByteCount),
        entry.artifactSha256,
        entry.quantization || "quantization unavailable",
        catalogPeerStateText(entry)
      ].join(" / ");
      const actions = document.createElement("div");
      actions.className = "model-result-actions";
      const selectButton = document.createElement("button");
      selectButton.type = "button";
      selectButton.textContent = "Select";
      selectButton.addEventListener("click", function () {
        selectCatalogEntry(entry);
      });
      actions.append(selectButton);
      appendActionIfPresent(actions, p2pCatalogActionButton(entry));
      appendCatalogRouteLinks(actions, entry, [["Manifest", entry.manifestRoute], ["Model Card", entry.modelCardRoute], ["License", entry.licenseRoute]]);
      item.append(title, meta, actions);
      el.catalogResults.append(item);
    }
    renderSimpleCatalogResults(entries);
  }

  function renderSimpleCatalogResults(entries) {
    if (!el.simpleCatalogResults) {
      return;
    }
    el.simpleCatalogResults.replaceChildren();
    for (const entry of entries) {
      const item = document.createElement("li");
      item.className = "model-result";
      const title = document.createElement("strong");
      title.textContent = entry.displayName;
      const meta = document.createElement("div");
      meta.className = "model-result-meta";
      meta.textContent = [
        "MiniModel metadata",
        entry.modelId,
        formatByteCount(entry.artifactByteCount),
        simpleCatalogPeerStateText(entry)
      ].filter(Boolean).join(" / ");
      const actions = document.createElement("div");
      actions.className = "model-result-actions";
      appendActionIfPresent(actions, p2pCatalogActionButton(entry));
      const selectButton = document.createElement("button");
      selectButton.type = "button";
      selectButton.textContent = "Use Metadata";
      selectButton.addEventListener("click", function () {
        selectCatalogEntry(entry);
      });
      actions.append(selectButton);
      appendCatalogRouteLinks(actions, entry, [["Model Card", entry.modelCardRoute], ["License", entry.licenseRoute], ["Manifest", entry.manifestRoute]]);
      item.append(title, meta, actions);
      el.simpleCatalogResults.append(item);
    }
  }

  function selectCatalogEntry(entry) {
    state.selectedCatalogEntry = entry;
    setCatalogStatus(`${entry.displayName} selected`, false);
    setLocalModelStatus(
      `${entry.fileNameHint} / ${formatByteCount(entry.artifactByteCount)} / ${entry.artifactSha256}`,
      false
    );
    if (el.localModelFile) {
      el.localModelFile.value = "";
      el.localModelFile.focus();
    }
  }

  function catalogAnnouncementRouteStatusText(routeResult) {
    const appliedText = `${routeResult.appliedCount} peer-source announcement${routeResult.appliedCount === 1 ? "" : "s"} applied`;
    const duplicateText = routeResult.duplicateCount
      ? `; ${routeResult.duplicateCount} duplicate${routeResult.duplicateCount === 1 ? "" : "s"} already loaded`
      : "";
    const emptyText = routeResult.emptyFeedCount
      ? `; ${routeResult.emptyFeedCount} availability feed${routeResult.emptyFeedCount === 1 ? "" : "s"} checked with no peer sources`
      : "";
    return `${appliedText}${duplicateText}${emptyText}`;
  }

  async function loadCatalogFromUrl() {
    const rawUrl = catalogText(el.catalogUrlInput && el.catalogUrlInput.value);
    if (!rawUrl) {
      throw new Error("Enter a catalog URL");
    }
    let url = null;
    try {
      url = new URL(rawUrl, window.location.href);
    } catch (_error) {
      throw new Error("Catalog URL was invalid");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Catalog URL must use HTTP or HTTPS");
    }
    if (state.catalogFetchAbort) {
      state.catalogFetchAbort.abort();
    }
    clearCatalogResults();
    setCatalogStatus("loading metadata", false);
    const controller = new AbortController();
    state.catalogFetchAbort = controller;
    const response = await fetch(url.toString(), {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Catalog request failed (${response.status})`);
    }
    const text = await response.text();
    if (state.encoder.encode(text).length > catalogTextByteBudget) {
      throw new Error("Catalog metadata exceeded browser budget");
    }
    const body = JSON.parse(text);
    const entries = catalogEntriesFromBody(body, url.hostname, url.toString());
    const announcementRoutes = catalogAnnouncementRoutesFromBody(body, url.toString());
    state.catalogEntries = entries;
    state.defaultCatalogCheckedForAvailability = rawUrl === defaultCatalogUrl;
    renderCatalogResults(entries);
    if (announcementRoutes.length) {
      const routeResult = await applyCatalogAnnouncementRoutes(announcementRoutes, controller.signal);
      setCatalogStatus(`${entries.length} metadata entries; ${catalogAnnouncementRouteStatusText(routeResult)}`, false);
      return;
    }
    setCatalogStatus(`${entries.length} metadata entries`, false);
  }

  async function importLocalCatalogFile(input = el.localCatalogFile) {
    const file = input && input.files ? input.files[0] : null;
    if (!file) {
      throw new Error("Choose a local models.v0.json catalog snapshot");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Local catalog snapshot is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Local catalog snapshot exceeded browser budget");
    }
    clearCatalogResults();
    const fileName = safeLocalModelName(file.name);
    setCatalogStatus(`reading local metadata snapshot ${fileName}`, false);
    const text = await file.text();
    const body = JSON.parse(text);
    const entries = catalogEntriesFromBody(body, fileName, "");
    state.catalogEntries = entries;
    state.defaultCatalogCheckedForAvailability = false;
    renderCatalogResults(entries);
    setCatalogStatus(`${entries.length} local MiniModel metadata entries from ${fileName}`, false);
  }

  function catalogPeerSourceRaw(source) {
    return {
      source_kind: source.sourceKind || "known-direct-http-peer-v0",
      transport: source.transport || "direct-http-piece-server-v0",
      peer_base_url: source.peerBaseUrl,
      consent_status: source.consentStatus || "publisher-declared-consenting-peer",
      project_server_serves_model_bytes: false,
      project_server_runs_model_bytes: false
    };
  }

  function catalogPeerSourceKey(source) {
    return [
      source.sourceKind || "known-direct-http-peer-v0",
      source.transport || "direct-http-piece-server-v0",
      source.peerBaseUrl || "",
      source.consentStatus || "publisher-declared-consenting-peer"
    ].join("|");
  }

  function peerSourceAnnouncementFromRaw(raw, index) {
    const label = `Peer-source announcement ${index + 1}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`${label} was not a JSON object`);
    }
    const verifier = window.TinyRustLMMiniModelAnnouncement;
    if (!verifier || typeof verifier.validate !== "function") {
      throw new Error("MiniModel external-proof verifier was unavailable");
    }
    const verified = verifier.validate(raw, { normalizePeerUrl: normalizedPeerBaseUrl });
    const modelId = verified.modelId;
    const artifactByteCount = catalogInteger(raw.artifact_byte_count);
    if (!artifactByteCount || artifactByteCount > localModelMaxBytes) {
      throw new Error(`${label} byte count was invalid`);
    }
    const artifactSha256 = normalizeCatalogSha256(raw.artifact_sha256);
    const peerOfferSha256 = normalizeCatalogSha256(raw.peer_offer_sha256);
    const peerOfferMerkleRootSha256 = normalizeCatalogSha256(raw.peer_offer_merkle_root_sha256);
    const catalogEntrySha256 = normalizeCatalogSha256(raw.catalog_entry_sha256);
    if (!artifactSha256 || !peerOfferSha256 || !peerOfferMerkleRootSha256 || !catalogEntrySha256) {
      throw new Error(`${label} checksums were invalid`);
    }
    const peerOfferRoute = catalogText(raw.peer_offer_route);
    if (!peerOfferRoute || peerOfferRoute.includes("\n") || peerOfferRoute.includes("\r")) {
      throw new Error(`${label} peer offer route was invalid`);
    }
    const peerOfferChunkCount = catalogInteger(raw.peer_offer_chunk_count);
    if (!peerOfferChunkCount || peerOfferChunkCount < 1) {
      throw new Error(`${label} peer offer chunk count was invalid`);
    }
    return {
      raw,
      modelId,
      artifactByteCount,
      artifactSha256,
      peerOfferSha256,
      peerOfferMerkleRootSha256,
      peerOfferRoute,
      peerOfferChunkCount,
      catalogEntrySha256,
      peerSource: verified.peerSource,
      laneId: verified.laneId,
      receiptId: verified.receiptId,
      receiptSha256: verified.receiptSha256,
      proofCheckedUtc: verified.checkedUtc,
      proofExpiresUtc: verified.expiresUtc
    };
  }

  function isPeerSourceAnnouncementFeedBody(body) {
    return Boolean(
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      (
        Array.isArray(body.announcements) ||
        Object.prototype.hasOwnProperty.call(body, "announcement_catalog_kind") ||
        Object.prototype.hasOwnProperty.call(body, "announcement_catalog_version")
      )
    );
  }

  function requireFalseMetadataFlag(raw, key, label) {
    if (!raw || raw[key] !== false) {
      throw new Error(`${label} must declare ${key}=false`);
    }
  }

  function validatePeerSourceAnnouncementFeedEnvelope(body, sourceLabel) {
    if (catalogInteger(body.announcement_catalog_version) !== 0) {
      throw new Error(`${sourceLabel} announcement catalog version was unsupported`);
    }
    if (catalogText(body.announcement_catalog_kind) !== "minimodel.peer_source_announcement_catalog") {
      throw new Error(`${sourceLabel} announcement catalog kind was unsupported`);
    }
    requireFalseMetadataFlag(body, "project_server_serves_model_bytes", sourceLabel);
    requireFalseMetadataFlag(body, "project_server_runs_model_bytes", sourceLabel);
    requireFalseMetadataFlag(body, "project_server_proxies_model_bytes", sourceLabel);
    if (!Array.isArray(body.announcements)) {
      throw new Error(`${sourceLabel} announcement catalog must include an announcements array`);
    }
    if (body.announcements.length > catalogMaxEntries) {
      throw new Error(`${sourceLabel} listed too many peer-source announcements`);
    }
    return body.announcements;
  }

  function peerSourceAnnouncementsFromBody(body, sourceLabel) {
    const rawAnnouncements = Array.isArray(body)
      ? body
      : isPeerSourceAnnouncementFeedBody(body)
        ? validatePeerSourceAnnouncementFeedEnvelope(body, sourceLabel)
        : [body];
    if (rawAnnouncements.length > catalogMaxEntries) {
      throw new Error(`${sourceLabel} listed too many peer-source announcements`);
    }
    const announcements = rawAnnouncements.map((announcement, index) => (
      peerSourceAnnouncementFromRaw(announcement, index)
    ));
    const seen = new Set();
    for (const announcement of announcements) {
      const key = `${announcement.modelId}|${announcement.peerSource.peerBaseUrl}`;
      if (seen.has(key)) {
        throw new Error(`${sourceLabel} duplicated model id and peer URL in peer-source announcements`);
      }
      seen.add(key);
    }
    return announcements;
  }

  function assertPeerAnnouncementMatchesEntry(entry, announcement) {
    if (entry.artifactByteCount !== announcement.artifactByteCount) {
      throw new Error(`${announcement.modelId} peer-source announcement byte count did not match catalog metadata`);
    }
    if (entry.artifactSha256 !== announcement.artifactSha256) {
      throw new Error(`${announcement.modelId} peer-source announcement artifact checksum did not match catalog metadata`);
    }
    if (!entry.peerOfferRoute || entry.peerOfferRoute !== announcement.peerOfferRoute) {
      throw new Error(`${announcement.modelId} peer-source announcement peer-offer route did not match catalog metadata`);
    }
    if (entry.peerOfferSha256 !== announcement.peerOfferSha256) {
      throw new Error(`${announcement.modelId} peer-source announcement peer-offer checksum did not match catalog metadata`);
    }
    if (entry.peerOfferMerkleRootSha256 !== announcement.peerOfferMerkleRootSha256) {
      throw new Error(`${announcement.modelId} peer-source announcement Merkle root did not match catalog metadata`);
    }
    if (entry.peerOfferChunkCount !== announcement.peerOfferChunkCount) {
      throw new Error(`${announcement.modelId} peer-source announcement chunk count did not match catalog metadata`);
    }
  }

  function applyPeerSourceAnnouncements(announcements) {
    if (!state.catalogEntries.length) {
      throw new Error("Load MiniModel metadata or a local models.v0.json before applying peer-source announcements.");
    }
    const catalogByModelId = new Map();
    for (const entry of state.catalogEntries) {
      if (!catalogByModelId.has(entry.modelId)) {
        catalogByModelId.set(entry.modelId, entry);
      }
    }
    for (const announcement of announcements) {
      const entry = catalogByModelId.get(announcement.modelId);
      if (!entry) {
        throw new Error(`${announcement.modelId} did not match any loaded MiniModel metadata entry`);
      }
      assertPeerAnnouncementMatchesEntry(entry, announcement);
    }

    const announcementsByModelId = new Map();
    for (const announcement of announcements) {
      const list = announcementsByModelId.get(announcement.modelId) || [];
      list.push(announcement);
      announcementsByModelId.set(announcement.modelId, list);
    }

    let appliedCount = 0;
    let duplicateCount = 0;
    const nextEntries = state.catalogEntries.map((entry) => {
      const modelAnnouncements = announcementsByModelId.get(entry.modelId) || [];
      if (!modelAnnouncements.length) {
        return entry;
      }
      const peerSources = entry.peerSources.slice();
      const peerProofs = Array.isArray(entry.peerProofs) ? entry.peerProofs.slice() : [];
      const seen = new Set(peerSources.map(catalogPeerSourceKey));
      for (const announcement of modelAnnouncements) {
        const key = catalogPeerSourceKey(announcement.peerSource);
        if (seen.has(key)) {
          duplicateCount += 1;
          continue;
        }
        seen.add(key);
        peerSources.push(announcement.peerSource);
        peerProofs.push({
          laneId: announcement.laneId,
          receiptId: announcement.receiptId,
          receiptSha256: announcement.receiptSha256,
          checkedUtc: announcement.proofCheckedUtc,
          expiresUtc: announcement.proofExpiresUtc
        });
        appliedCount += 1;
      }
      if (peerSources.length === entry.peerSources.length) {
        return entry;
      }
      const rawPeerSources = peerSources.map(catalogPeerSourceRaw);
      return {
        ...entry,
        raw: {
          ...entry.raw,
          peer_source_count: rawPeerSources.length,
          peer_sources: rawPeerSources
        },
        peerSources,
        peerProofs,
        unprovenPeerClaimCount: 0,
        peerImportStatus: entry.peerImportStatus || "request-script-ready",
        peerHintStatus: entry.peerHintStatus === "disabled"
          ? "peer-source-externally-verified-metadata-only"
          : entry.peerHintStatus
      };
    });
    if (!appliedCount && !duplicateCount) {
      throw new Error("No peer-source announcements were applied.");
    }
    const selectedModelId = state.selectedCatalogEntry && state.selectedCatalogEntry.modelId;
    state.catalogEntries = nextEntries;
    if (selectedModelId) {
      state.selectedCatalogEntry = nextEntries.find((entry) => entry.modelId === selectedModelId) || state.selectedCatalogEntry;
    }
    renderCatalogResults(nextEntries);
    refreshHfResultsForCatalogChange();
    return { appliedCount, duplicateCount };
  }

  function selectedPeerAnnouncementFile(preferredInput) {
    if (preferredInput && preferredInput.files && preferredInput.files[0]) {
      return preferredInput.files[0];
    }
    if (el.peerAnnouncementFile && el.peerAnnouncementFile.files && el.peerAnnouncementFile.files[0]) {
      return el.peerAnnouncementFile.files[0];
    }
    if (el.simplePeerAnnouncementFile && el.simplePeerAnnouncementFile.files && el.simplePeerAnnouncementFile.files[0]) {
      return el.simplePeerAnnouncementFile.files[0];
    }
    return null;
  }

  function selectedPeerContactCardFile(preferredInput) {
    if (preferredInput && preferredInput.files && preferredInput.files[0]) {
      return preferredInput.files[0];
    }
    if (el.peerContactCardFile && el.peerContactCardFile.files && el.peerContactCardFile.files[0]) {
      return el.peerContactCardFile.files[0];
    }
    if (el.simplePeerContactCardFile && el.simplePeerContactCardFile.files && el.simplePeerContactCardFile.files[0]) {
      return el.simplePeerContactCardFile.files[0];
    }
    return null;
  }

  function selectedPeerContactBookFile(preferredInput) {
    if (preferredInput && preferredInput.files && preferredInput.files[0]) {
      return preferredInput.files[0];
    }
    if (el.peerContactBookFile && el.peerContactBookFile.files && el.peerContactBookFile.files[0]) {
      return el.peerContactBookFile.files[0];
    }
    if (el.simplePeerContactBookFile && el.simplePeerContactBookFile.files && el.simplePeerContactBookFile.files[0]) {
      return el.simplePeerContactBookFile.files[0];
    }
    return null;
  }

  async function applyPeerContactCardFile(preferredInput) {
    const file = selectedPeerContactCardFile(preferredInput);
    if (!file) {
      throw new Error("Choose a peer contact card JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Peer contact card file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Peer contact card exceeded browser metadata budget");
    }
    const fileName = safeLocalModelName(file.name);
    updatePeerUrlStatus(`reading peer contact card ${fileName}`, false);
    const body = JSON.parse(await file.text());
    const card = peerContactCardFromRaw(body, fileName);
    setPeerBaseUrl(card.peerBaseUrl);
    updatePeerUrlStatus(`Known peer card loaded: ${card.peerLabel} (${card.peerBaseUrl})`, false);
    setCatalogStatus(`Peer contact card loaded from ${fileName}; known peer is ${card.peerBaseUrl}`, false);
  }

  async function applyPeerContactBookFile(preferredInput) {
    const file = selectedPeerContactBookFile(preferredInput);
    if (!file) {
      throw new Error("Choose a peer contact book JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Peer contact book file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Peer contact book exceeded browser metadata budget");
    }
    const fileName = safeLocalModelName(file.name);
    updatePeerUrlStatus(`reading peer contact book ${fileName}`, false);
    const body = JSON.parse(await file.text());
    const book = await peerContactBookFromRaw(body, fileName);
    state.peerContactBookPeers = book.peers;
    state.peerContactBookSourceName = fileName;
    setPeerBaseUrl(book.firstPeerBaseUrl, { keepPeerContactBook: true });
    const peerText = book.contactCount === 1 ? "1 peer" : `${book.contactCount} peers`;
    updatePeerUrlStatus(
      `Known peer book loaded: ${peerText}; using ${book.firstPeerLabel} (${book.firstPeerBaseUrl}); Rust reverify required`,
      false
    );
    setCatalogStatus(
      `Peer contact book loaded from ${fileName}; ${peerText}; known peer is ${book.firstPeerBaseUrl}`,
      false
    );
  }

  async function applyPeerSourceAnnouncementFile(preferredInput) {
    const file = selectedPeerAnnouncementFile(preferredInput);
    if (!file) {
      throw new Error("Choose a peer-source announcement or feed JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Peer-source announcement/feed file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Peer-source announcement/feed exceeded browser metadata budget");
    }
    const fileName = safeLocalModelName(file.name);
    setCatalogStatus(`reading peer-source announcement/feed ${fileName}`, false);
    const text = await file.text();
    const body = JSON.parse(text);
    const announcements = peerSourceAnnouncementsFromBody(body, fileName);
    if (!announcements.length) {
      setCatalogStatus(`0 peer-source announcements found in ${fileName}`, false);
      return;
    }
    const result = applyPeerSourceAnnouncements(announcements);
    const appliedText = `${result.appliedCount} peer-source announcement${result.appliedCount === 1 ? "" : "s"} applied`;
    const duplicateText = result.duplicateCount
      ? `; ${result.duplicateCount} duplicate${result.duplicateCount === 1 ? "" : "s"} already loaded`
      : "";
    setCatalogStatus(`${appliedText}${duplicateText} from ${fileName}`, false);
  }

  async function applyCatalogAnnouncementRoutes(routes, signal) {
    let appliedCount = 0;
    let duplicateCount = 0;
    let emptyFeedCount = 0;
    for (const route of routes) {
      const response = await fetch(route.url, {
        cache: "no-store",
        credentials: "omit",
        signal
      });
      if (!response.ok) {
        throw new Error(`Peer-source announcement request failed (${response.status})`);
      }
      const text = await response.text();
      if (state.encoder.encode(text).length > catalogTextByteBudget) {
        throw new Error("Peer-source announcement metadata exceeded browser budget");
      }
      const actualSha256 = await sha256Text(text);
      if (actualSha256 !== route.sha256) {
        throw new Error("Peer-source announcement checksum did not match catalog metadata");
      }
      const body = JSON.parse(text);
      const announcements = peerSourceAnnouncementsFromBody(body, route.url);
      if (!announcements.length) {
        emptyFeedCount += 1;
        continue;
      }
      const result = applyPeerSourceAnnouncements(announcements);
      appliedCount += result.appliedCount;
      duplicateCount += result.duplicateCount;
    }
    return { routeCount: routes.length, appliedCount, duplicateCount, emptyFeedCount };
  }

  function setImportReceiptLedgerStatus(text, isError) {
    const targetText = text || "receipt ledger optional";
    for (const node of [el.receiptLedgerStatus, el.simpleImportReceiptLedgerStatus]) {
      if (node) {
        setText(node, targetText, isError);
      }
    }
    if (el.simpleDiscoveryStatus && state.simpleSourceOption === "p2p") {
      el.simpleDiscoveryStatus.textContent = targetText;
      el.simpleDiscoveryStatus.classList.toggle("error", Boolean(isError));
    }
  }

  function selectedImportReceiptLedgerFile(preferredInput) {
    if (preferredInput && preferredInput.files && preferredInput.files[0]) {
      return preferredInput.files[0];
    }
    if (el.importReceiptLedgerFile && el.importReceiptLedgerFile.files && el.importReceiptLedgerFile.files[0]) {
      return el.importReceiptLedgerFile.files[0];
    }
    if (el.simpleImportReceiptLedgerFile && el.simpleImportReceiptLedgerFile.files && el.simpleImportReceiptLedgerFile.files[0]) {
      return el.simpleImportReceiptLedgerFile.files[0];
    }
    return null;
  }

  function requireImportLedgerObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${label} must be a JSON object`);
    }
    return value;
  }

  function requireImportLedgerString(value, label, maxLength = 512) {
    if (typeof value !== "string" || !value || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error(`${label} was invalid`);
    }
    return value;
  }

  function requireImportLedgerPathHint(value, label) {
    const text = requireImportLedgerString(value, label, 1024);
    if (!text.trim() || text.includes("://")) {
      throw new Error(`${label} must be a local path hint`);
    }
    return text;
  }

  function requireImportLedgerSha(value, label) {
    const sha256 = normalizeCatalogSha256(value);
    if (!sha256) {
      throw new Error(`${label} must be a sha256 digest`);
    }
    return sha256;
  }

  function requireImportLedgerInteger(value, label, options = {}) {
    const parsed = catalogInteger(value);
    const minimum = options.minimum === undefined ? 0 : options.minimum;
    if (parsed === null || parsed < minimum) {
      throw new Error(`${label} was invalid`);
    }
    return parsed;
  }

  function requireImportLedgerBool(value, label, expected) {
    if (typeof value !== "boolean") {
      throw new Error(`${label} must be a boolean`);
    }
    if (expected !== undefined && value !== expected) {
      throw new Error(`${label} must be ${expected}`);
    }
    return value;
  }

  function optionalImportLedgerString(value, label, maxLength = 512) {
    if (value === null || value === undefined) {
      return null;
    }
    return requireImportLedgerString(value, label, maxLength);
  }

  function optionalImportLedgerSha(value, label) {
    if (value === null || value === undefined) {
      return null;
    }
    return requireImportLedgerSha(value, label);
  }

  function optionalImportLedgerInteger(value, label, options = {}) {
    if (value === null || value === undefined) {
      return null;
    }
    return requireImportLedgerInteger(value, label, options);
  }

  function validateImportReceiptLedgerBoundary(boundary, label) {
    const object = requireImportLedgerObject(boundary, label);
    requireImportLedgerBool(object.metadata_only, `${label}.metadata_only`, true);
    requireImportLedgerBool(object.contains_model_bytes, `${label}.contains_model_bytes`, false);
    requireImportLedgerBool(object.contains_peer_piece_bytes, `${label}.contains_peer_piece_bytes`, false);
    requireImportLedgerBool(object.project_server_serves_model_bytes, `${label}.project_server_serves_model_bytes`, false);
    requireImportLedgerBool(object.project_server_runs_model_bytes, `${label}.project_server_runs_model_bytes`, false);
    requireImportLedgerBool(object.project_server_proxies_huggingface_bytes, `${label}.project_server_proxies_huggingface_bytes`, false);
    requireImportLedgerBool(object.local_companion_receipt_index, `${label}.local_companion_receipt_index`, true);
    requireImportLedgerBool(object.rust_reverify_required_before_trust, `${label}.rust_reverify_required_before_trust`, true);
  }

  function validateImportReceiptLedgerEntry(entry, index) {
    const label = `Import receipt ledger entry ${index}`;
    const object = requireImportLedgerObject(entry, label);
    const entryIndex = requireImportLedgerInteger(object.entry_index, `${label}.entry_index`);
    if (entryIndex !== index) {
      throw new Error(`${label}.entry_index was ${entryIndex}, expected ${index}`);
    }
    if (catalogText(object.entry_kind) !== "minimodel.import_receipt_ledger_entry.v0") {
      throw new Error(`${label}.entry_kind was unsupported`);
    }
    const receiptPath = requireImportLedgerPathHint(object.receipt_path, `${label}.receipt_path`);
    const manifestPath = requireImportLedgerPathHint(object.manifest_path, `${label}.manifest_path`);
    const artifactPath = requireImportLedgerPathHint(object.artifact_path, `${label}.artifact_path`);
    const receiptSha256 = requireImportLedgerSha(object.receipt_sha256, `${label}.receipt_sha256`);
    const manifestSha256 = requireImportLedgerSha(object.manifest_sha256, `${label}.manifest_sha256`);
    const artifactSha256 = requireImportLedgerSha(object.artifact_sha256, `${label}.artifact_sha256`);
    const artifactByteCount = requireImportLedgerInteger(object.artifact_byte_count, `${label}.artifact_byte_count`, { minimum: 1 });
    const modelId = requireImportLedgerString(object.model_id, `${label}.model_id`, 180);
    if (!isCatalogModelId(modelId)) {
      throw new Error(`${label}.model_id was invalid`);
    }
    requireImportLedgerString(object.slm_model_shape, `${label}.slm_model_shape`, 512);
    const quantization = requireImportLedgerString(object.slm_quantization, `${label}.slm_quantization`, 64);
    if (!/^[A-Za-z0-9._-]+$/.test(quantization)) {
      throw new Error(`${label}.slm_quantization was invalid`);
    }
    const peerImport = requireImportLedgerBool(object.peer_import, `${label}.peer_import`);
    requireImportLedgerBool(object.project_server_serves_model_bytes, `${label}.project_server_serves_model_bytes`, false);
    requireImportLedgerBool(object.project_server_runs_model_bytes, `${label}.project_server_runs_model_bytes`, false);
    requireImportLedgerBool(object.project_server_proxies_huggingface_bytes, `${label}.project_server_proxies_huggingface_bytes`, false);
    if (peerImport) {
      if (object.receiver_validation_contract_status !== "validated") {
        throw new Error(`${label}.receiver_validation_contract_status was ${object.receiver_validation_contract_status}`);
      }
      requireImportLedgerBool(object.check_peer_status_before_piece_fetch, `${label}.check_peer_status_before_piece_fetch`, true);
      requireImportLedgerBool(object.preflight_fetches_piece_set_before_pieces, `${label}.preflight_fetches_piece_set_before_pieces`, true);
      requireImportLedgerBool(object.validate_advertised_companion_state_before_piece_fetch, `${label}.validate_advertised_companion_state_before_piece_fetch`, true);
      requireImportLedgerBool(object.import_receipt_required_before_browser_load, `${label}.import_receipt_required_before_browser_load`, true);
      const peerBaseUrl = normalizedPeerBaseUrl(requireImportLedgerString(object.peer_base_url, `${label}.peer_base_url`, 256));
      const companionStateStatus = requireImportLedgerString(object.companion_state_status, `${label}.companion_state_status`, 96);
      if (!["validated", "not-advertised"].includes(companionStateStatus)) {
        throw new Error(`${label}.companion_state_status was ${companionStateStatus}`);
      }
      const pieceCount = requireImportLedgerInteger(object.piece_count, `${label}.piece_count`, { minimum: 1 });
      const merkleRootSha256 = requireImportLedgerSha(object.merkle_root_sha256, `${label}.merkle_root_sha256`);
      requireImportLedgerBool(object.peer_piece_bytes_fetched, `${label}.peer_piece_bytes_fetched`, true);
      requireImportLedgerBool(object.artifact_assembled_from_peer_pieces, `${label}.artifact_assembled_from_peer_pieces`, true);
      return {
        receiptPath,
        manifestPath,
        artifactPath,
        receiptSha256,
        manifestSha256,
        artifactSha256,
        artifactByteCount,
        modelId,
        quantization,
        peerImport,
        peerBaseUrl,
        companionStateStatus,
        pieceCount,
        merkleRootSha256,
        receiverValidationContractStatus: "validated"
      };
    } else {
      const receiverValidationContractStatus = optionalImportLedgerString(object.receiver_validation_contract_status, `${label}.receiver_validation_contract_status`, 96);
      const peerBaseUrl = optionalImportLedgerString(object.peer_base_url, `${label}.peer_base_url`, 256);
      const companionStateStatus = optionalImportLedgerString(object.companion_state_status, `${label}.companion_state_status`, 96);
      const pieceCount = optionalImportLedgerInteger(object.piece_count, `${label}.piece_count`, { minimum: 1 });
      const merkleRootSha256 = optionalImportLedgerSha(object.merkle_root_sha256, `${label}.merkle_root_sha256`);
      requireImportLedgerBool(object.peer_piece_bytes_fetched, `${label}.peer_piece_bytes_fetched`, false);
      requireImportLedgerBool(object.artifact_assembled_from_peer_pieces, `${label}.artifact_assembled_from_peer_pieces`, false);
      return {
        receiptPath,
        manifestPath,
        artifactPath,
        receiptSha256,
        manifestSha256,
        artifactSha256,
        artifactByteCount,
        modelId,
        quantization,
        peerImport,
        peerBaseUrl,
        companionStateStatus,
        pieceCount,
        merkleRootSha256,
        receiverValidationContractStatus
      };
    }
  }

  function validateImportReceiptLedgerBody(body, ledgerSha256, sourceLabel) {
    const label = sourceLabel || "Import receipt ledger";
    const object = requireImportLedgerObject(body, label);
    if (catalogText(object.ledger_kind) !== "minimodel.import_receipt_ledger.v0") {
      throw new Error(`${label} kind was unsupported`);
    }
    if (catalogInteger(object.ledger_version) !== 1) {
      throw new Error(`${label} version was unsupported`);
    }
    const generatedAt = requireImportLedgerString(object.generated_at, `${label}.generated_at`, 32);
    if (!isStrictMiniModelUtcTimestamp(generatedAt)) {
      throw new Error(`${label}.generated_at was invalid`);
    }
    const entryCount = requireImportLedgerInteger(object.entry_count, `${label}.entry_count`, { minimum: 1 });
    const peerImportCount = requireImportLedgerInteger(object.peer_import_count, `${label}.peer_import_count`);
    const modelCount = requireImportLedgerInteger(object.model_count, `${label}.model_count`, { minimum: 1 });
    validateImportReceiptLedgerBoundary(object.boundary, `${label}.boundary`);
    if (!Array.isArray(object.entries) || object.entries.length > catalogMaxEntries) {
      throw new Error(`${label} entries were invalid`);
    }
    if (object.entries.length !== entryCount) {
      throw new Error(`${label}.entry_count was ${entryCount}, expected ${object.entries.length}`);
    }
    const seenReceipts = new Set();
    const seenModels = new Set();
    let actualPeerImportCount = 0;
    const entries = object.entries.map((entry, index) => {
      const parsed = validateImportReceiptLedgerEntry(entry, index);
      const receiptKey = parsed.receiptPath.toLowerCase();
      if (seenReceipts.has(receiptKey)) {
        throw new Error(`Import receipt ledger entry ${index}.receipt_path was duplicated`);
      }
      seenReceipts.add(receiptKey);
      seenModels.add(parsed.modelId);
      if (parsed.peerImport) {
        actualPeerImportCount += 1;
      }
      return parsed;
    });
    if (actualPeerImportCount !== peerImportCount) {
      throw new Error(`${label}.peer_import_count was ${peerImportCount}, expected ${actualPeerImportCount}`);
    }
    if (seenModels.size !== modelCount) {
      throw new Error(`${label}.model_count was ${modelCount}, expected ${seenModels.size}`);
    }
    return {
      sourceLabel: label,
      ledgerSha256,
      generatedAt,
      entryCount,
      peerImportCount,
      modelCount,
      entries
    };
  }

  function importReceiptLedgerStatusText(ledger) {
    if (!ledger) {
      return "receipt ledger optional";
    }
    const entryText = `${ledger.entryCount} entr${ledger.entryCount === 1 ? "y" : "ies"}`;
    const peerText = `${ledger.peerImportCount} peer import${ledger.peerImportCount === 1 ? "" : "s"}`;
    const modelText = `${ledger.modelCount} model${ledger.modelCount === 1 ? "" : "s"}`;
    return `Receipt ledger loaded: ${ledger.sourceLabel} / ${entryText} / ${peerText} / ${modelText} / ${ledger.ledgerSha256} / Rust reverify required`;
  }

  function renderImportReceiptLedgerEntriesIn(container) {
    if (!container) {
      return;
    }
    const ledger = state.importReceiptLedger;
    const entries = ledger && Array.isArray(ledger.entries) ? ledger.entries : [];
    container.replaceChildren();
    container.hidden = entries.length === 0;
    if (!entries.length) {
      return;
    }
    entries.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "receipt-ledger-entry";
      item.setAttribute("role", "listitem");

      const header = document.createElement("div");
      header.className = "receipt-ledger-entry-header";
      const title = elementWithText("strong", "", entry.modelId);
      const kind = elementWithText(
        "span",
        entry.peerImport ? "receipt-ledger-kind peer" : "receipt-ledger-kind local",
        entry.peerImport ? "Peer import" : "Local import"
      );
      header.append(title, kind);

      const facts = document.createElement("dl");
      facts.className = "receipt-ledger-entry-facts";
      const addFact = (term, value) => {
        if (value === null || value === undefined || value === "") {
          return;
        }
        facts.append(
          elementWithText("dt", "", term),
          elementWithText("dd", "", String(value))
        );
      };

      addFact("Receipt", safeLocalPathLeaf(entry.receiptPath, `receipt-${index + 1}`));
      addFact("Artifact", `${safeLocalPathLeaf(entry.artifactPath, "artifact.slm")} / ${formatByteCount(entry.artifactByteCount)} / ${entry.quantization}`);
      addFact("Artifact SHA-256", shortSha256(entry.artifactSha256));
      addFact("Receipt SHA-256", shortSha256(entry.receiptSha256));
      if (entry.peerImport) {
        addFact("Peer", entry.peerBaseUrl);
        addFact("Receiver", entry.receiverValidationContractStatus || "validated");
        addFact("Companion", entry.companionStateStatus);
        addFact("Pieces", `${entry.pieceCount} / ${shortSha256(entry.merkleRootSha256)}`);
      }

      item.append(header, facts);
      container.append(item);
    });
  }

  function renderImportReceiptLedgerEntries() {
    renderImportReceiptLedgerEntriesIn(el.simpleImportReceiptLedgerEntries);
    renderImportReceiptLedgerEntriesIn(el.importReceiptLedgerEntries);
  }

  async function importReceiptLedgerFile(preferredInput) {
    const file = selectedImportReceiptLedgerFile(preferredInput);
    if (!file) {
      throw new Error("Choose an import receipt ledger JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Import receipt ledger file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Import receipt ledger exceeded browser metadata budget");
    }
    const fileName = safeLocalModelName(file.name);
    state.importReceiptLedger = null;
    renderImportReceiptLedgerEntries();
    setImportReceiptLedgerStatus(`reading import receipt ledger ${fileName}`, false);
    const text = await file.text();
    if (state.encoder.encode(text).length > catalogTextByteBudget) {
      throw new Error("Import receipt ledger exceeded browser metadata budget");
    }
    const body = JSON.parse(text);
    const ledger = validateImportReceiptLedgerBody(body, await sha256Text(text), fileName);
    state.importReceiptLedger = ledger;
    renderImportReceiptLedgerEntries();
    setImportReceiptLedgerStatus(importReceiptLedgerStatusText(ledger), false);
    return ledger;
  }

  function setPeerStatusCheckStatus(text, isError) {
    const targetText = text || "peer status optional";
    for (const node of [el.peerStatusCheckStatus, el.simplePeerStatusCheckStatus]) {
      if (node) {
        setText(node, targetText, isError);
      }
    }
    if (el.simpleDiscoveryStatus && state.simpleSourceOption === "p2p") {
      el.simpleDiscoveryStatus.textContent = targetText;
      el.simpleDiscoveryStatus.classList.toggle("error", Boolean(isError));
    }
  }

  function selectedPeerStatusCheckFile(preferredInput) {
    if (preferredInput && preferredInput.files && preferredInput.files[0]) {
      return preferredInput.files[0];
    }
    if (el.peerStatusCheckFile && el.peerStatusCheckFile.files && el.peerStatusCheckFile.files[0]) {
      return el.peerStatusCheckFile.files[0];
    }
    if (el.simplePeerStatusCheckFile && el.simplePeerStatusCheckFile.files && el.simplePeerStatusCheckFile.files[0]) {
      return el.simplePeerStatusCheckFile.files[0];
    }
    return null;
  }

  function validatePeerStatusCheckBoundary(boundary, label) {
    const object = requireImportLedgerObject(boundary, label);
    requireImportLedgerBool(object.metadata_only, `${label}.metadata_only`, true);
    requireImportLedgerBool(object.peer_piece_bytes_fetched, `${label}.peer_piece_bytes_fetched`, false);
    requireImportLedgerBool(object.artifact_bytes_fetched, `${label}.artifact_bytes_fetched`, false);
    requireImportLedgerBool(object.project_server_serves_model_bytes, `${label}.project_server_serves_model_bytes`, false);
    requireImportLedgerBool(object.project_server_runs_model_bytes, `${label}.project_server_runs_model_bytes`, false);
    requireImportLedgerBool(object.project_server_proxies_model_bytes, `${label}.project_server_proxies_model_bytes`, false);
    requireImportLedgerBool(object.requires_rust_reverify_before_browser_import, `${label}.requires_rust_reverify_before_browser_import`, true);
  }

  function validatePeerStatusBoundary(boundary, label) {
    const object = requireImportLedgerObject(boundary, label);
    requireImportLedgerBool(object.metadata_only, `${label}.metadata_only`, true);
    requireImportLedgerBool(object.peer_status_embeds_model_bytes, `${label}.peer_status_embeds_model_bytes`, false);
    requireImportLedgerBool(object.peer_status_embeds_piece_bytes, `${label}.peer_status_embeds_piece_bytes`, false);
    requireImportLedgerBool(object.project_server_serves_model_bytes, `${label}.project_server_serves_model_bytes`, false);
    requireImportLedgerBool(object.project_server_runs_model_bytes, `${label}.project_server_runs_model_bytes`, false);
    requireImportLedgerBool(object.project_server_proxies_model_bytes, `${label}.project_server_proxies_model_bytes`, false);
    requireImportLedgerBool(object.requires_rust_reverify_before_browser_import, `${label}.requires_rust_reverify_before_browser_import`, true);
  }

  function validatePeerStatusBody(body, responseSha256, expectedPeerBaseUrl, sourceLabel) {
    const label = sourceLabel || "Live peer status";
    const object = requireImportLedgerObject(body, label);
    if (catalogText(object.status_kind) !== "minimodel.peer_status") {
      throw new Error(`${label}.status_kind was unsupported`);
    }
    if (catalogInteger(object.status_version) !== 0) {
      throw new Error(`${label}.status_version was unsupported`);
    }
    const createdAt = requireImportLedgerString(object.created_utc, `${label}.created_utc`, 32);
    if (!isStrictMiniModelUtcTimestamp(createdAt)) {
      throw new Error(`${label}.created_utc was invalid`);
    }
    if (requireImportLedgerString(object.share_status, `${label}.share_status`, 64) !== "ready-to-serve") {
      throw new Error(`${label}.share_status was unsupported`);
    }
    if (requireImportLedgerString(object.transfer_protocol, `${label}.transfer_protocol`, 128) !== "direct-http-piece-server-v0") {
      throw new Error(`${label}.transfer_protocol was unsupported`);
    }
    const peerBaseUrl = normalizedPeerBaseUrl(requireImportLedgerString(object.peer_base_url, `${label}.peer_base_url`, 256));
    if (expectedPeerBaseUrl && peerBaseUrl !== expectedPeerBaseUrl) {
      throw new Error(`${label}.peer_base_url did not match the known peer URL`);
    }
    const statusUrl = new URL(peerStatusRoute, peerBaseUrl).href;
    const modelId = requireImportLedgerString(object.model_id, `${label}.model_id`, 180);
    if (!isCatalogModelId(modelId)) {
      throw new Error(`${label}.model_id was invalid`);
    }
    const routes = requireImportLedgerObject(object.routes, `${label}.routes`);
    if (requireImportLedgerString(routes.peer_status, `${label}.routes.peer_status`, 128) !== peerStatusRoute) {
      throw new Error(`${label}.routes.peer_status was unsupported`);
    }
    if (requireImportLedgerString(routes.peer_piece_set, `${label}.routes.peer_piece_set`, 128) !== peerPieceSetRoute) {
      throw new Error(`${label}.routes.peer_piece_set was unsupported`);
    }
    const companionStateRoute = requireImportLedgerString(routes.peer_companion_state, `${label}.routes.peer_companion_state`, 128);
    if (companionStateRoute !== peerCompanionStateRoute && companionStateRoute !== "not-advertised") {
      throw new Error(`${label}.routes.peer_companion_state was unsupported`);
    }
    const manifest = requireImportLedgerObject(object.manifest, `${label}.manifest`);
    const manifestSha256 = requireImportLedgerSha(manifest.sha256, `${label}.manifest.sha256`);
    const artifact = requireImportLedgerObject(object.artifact, `${label}.artifact`);
    if (requireImportLedgerString(artifact.kind, `${label}.artifact.kind`, 32) !== "slm") {
      throw new Error(`${label}.artifact.kind was unsupported`);
    }
    const artifactByteCount = requireImportLedgerInteger(artifact.byte_count, `${label}.artifact.byte_count`, { minimum: 1 });
    const artifactSha256 = requireImportLedgerSha(artifact.sha256, `${label}.artifact.sha256`);
    const pieces = requireImportLedgerObject(object.pieces, `${label}.pieces`);
    if (requireImportLedgerString(pieces.piece_set_path_hint, `${label}.pieces.piece_set_path_hint`, 128) !== peerPieceSetRoute) {
      throw new Error(`${label}.pieces.piece_set_path_hint was unsupported`);
    }
    const pieceSetSha256 = requireImportLedgerSha(pieces.piece_set_sha256, `${label}.pieces.piece_set_sha256`);
    const pieceCount = requireImportLedgerInteger(pieces.piece_count, `${label}.pieces.piece_count`, { minimum: 1 });
    const merkleRootSha256 = requireImportLedgerSha(pieces.merkle_root_sha256, `${label}.pieces.merkle_root_sha256`);
    validatePeerStatusBoundary(object.boundary, `${label}.boundary`);
    return {
      sourceLabel: label,
      sourceKind: "live-peer-status",
      reportSha256: responseSha256,
      checkedAt: createdAt,
      modelId,
      peerBaseUrl,
      statusUrl,
      companionStateRoute,
      manifestSha256,
      artifactByteCount,
      artifactSha256,
      pieceSetSha256,
      pieceCount,
      merkleRootSha256
    };
  }

  function validatePeerStatusCheckBody(body, reportSha256, sourceLabel) {
    const label = sourceLabel || "Peer status check";
    const object = requireImportLedgerObject(body, label);
    if (catalogText(object.check_kind) !== "minimodel.peer_status_check") {
      throw new Error(`${label}.check_kind was unsupported`);
    }
    if (catalogInteger(object.check_version) !== 0) {
      throw new Error(`${label}.check_version was unsupported`);
    }
    const checkedAt = requireImportLedgerString(object.checked_utc, `${label}.checked_utc`, 32);
    if (!isStrictMiniModelUtcTimestamp(checkedAt)) {
      throw new Error(`${label}.checked_utc was invalid`);
    }
    const status = requireImportLedgerString(object.status, `${label}.status`, 64);
    if (status !== "validated") {
      throw new Error(`${label}.status was unsupported`);
    }
    const peerBaseUrl = normalizedPeerBaseUrl(requireImportLedgerString(object.peer_base_url, `${label}.peer_base_url`, 256));
    const statusUrl = requireImportLedgerString(object.status_url, `${label}.status_url`, 512);
    const expectedStatusUrl = new URL(peerStatusRoute, peerBaseUrl).href;
    if (statusUrl !== expectedStatusUrl) {
      throw new Error(`${label}.status_url did not match peer_base_url and ${peerStatusRoute}`);
    }
    const modelId = requireImportLedgerString(object.model_id, `${label}.model_id`, 180);
    if (!isCatalogModelId(modelId)) {
      throw new Error(`${label}.model_id was invalid`);
    }
    const routes = requireImportLedgerObject(object.routes, `${label}.routes`);
    if (requireImportLedgerString(routes.peer_status, `${label}.routes.peer_status`, 128) !== peerStatusRoute) {
      throw new Error(`${label}.routes.peer_status was unsupported`);
    }
    if (requireImportLedgerString(routes.peer_piece_set, `${label}.routes.peer_piece_set`, 128) !== peerPieceSetRoute) {
      throw new Error(`${label}.routes.peer_piece_set was unsupported`);
    }
    const companionStateRoute = requireImportLedgerString(routes.peer_companion_state, `${label}.routes.peer_companion_state`, 128);
    if (companionStateRoute !== peerCompanionStateRoute && companionStateRoute !== "not-advertised") {
      throw new Error(`${label}.routes.peer_companion_state was unsupported`);
    }
    const manifest = requireImportLedgerObject(object.manifest, `${label}.manifest`);
    const manifestSha256 = requireImportLedgerSha(manifest.sha256, `${label}.manifest.sha256`);
    const artifact = requireImportLedgerObject(object.artifact, `${label}.artifact`);
    if (requireImportLedgerString(artifact.kind, `${label}.artifact.kind`, 32) !== "slm") {
      throw new Error(`${label}.artifact.kind was unsupported`);
    }
    const artifactByteCount = requireImportLedgerInteger(artifact.byte_count, `${label}.artifact.byte_count`, { minimum: 1 });
    const artifactSha256 = requireImportLedgerSha(artifact.sha256, `${label}.artifact.sha256`);
    const pieces = requireImportLedgerObject(object.pieces, `${label}.pieces`);
    const pieceSetSha256 = requireImportLedgerSha(pieces.piece_set_sha256, `${label}.pieces.piece_set_sha256`);
    const pieceCount = requireImportLedgerInteger(pieces.piece_count, `${label}.pieces.piece_count`, { minimum: 1 });
    const merkleRootSha256 = requireImportLedgerSha(pieces.merkle_root_sha256, `${label}.pieces.merkle_root_sha256`);
    validatePeerStatusCheckBoundary(object.boundary, `${label}.boundary`);
    return {
      sourceLabel: label,
      sourceKind: "saved-peer-status-check",
      reportSha256,
      checkedAt,
      modelId,
      peerBaseUrl,
      statusUrl,
      companionStateRoute,
      manifestSha256,
      artifactByteCount,
      artifactSha256,
      pieceSetSha256,
      pieceCount,
      merkleRootSha256
    };
  }

  function peerStatusCheckStatusText(check) {
    if (!check) {
      return "peer status optional";
    }
    const pieceText = `${check.pieceCount} piece${check.pieceCount === 1 ? "" : "s"}`;
    const statusPrefix = check.sourceKind === "live-peer-status"
      ? "Live peer status loaded"
      : "Peer status check loaded";
    const digestText = check.sourceKind === "live-peer-status"
      ? `status ${check.reportSha256}`
      : check.reportSha256;
    return `${statusPrefix}: ${check.sourceLabel} / ${check.modelId} / ${pieceText} / ${formatByteCount(check.artifactByteCount)} artifact / ${check.peerBaseUrl} / status route ${peerStatusRoute} / companion ${check.companionStateRoute} / no peer bytes fetched / ${digestText} / Rust reverify required`;
  }

  async function importPeerStatusCheckFile(preferredInput) {
    const file = selectedPeerStatusCheckFile(preferredInput);
    if (!file) {
      throw new Error("Choose a peer status check JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Peer status check file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Peer status check exceeded browser metadata budget");
    }
    const fileName = safeLocalModelName(file.name);
    setPeerStatusCheckStatus(`reading peer status check ${fileName}`, false);
    const text = await file.text();
    if (state.encoder.encode(text).length > catalogTextByteBudget) {
      throw new Error("Peer status check exceeded browser metadata budget");
    }
    const body = JSON.parse(text);
    const check = validatePeerStatusCheckBody(body, await sha256Text(text), fileName);
    state.peerStatusCheck = check;
    setPeerStatusCheckStatus(peerStatusCheckStatusText(check), false);
    return check;
  }

  async function checkLivePeerStatus() {
    const rawPeerBaseUrl = (el.simplePeerBaseUrlInput && el.simplePeerBaseUrlInput.value.trim())
      || state.peerBaseUrl;
    const peerBaseUrl = normalizedPeerBaseUrl(rawPeerBaseUrl);
    if (!peerBaseUrl) {
      throw new Error("Enter a consenting known peer URL before checking peer status");
    }
    setPeerBaseUrl(peerBaseUrl, { keepPeerContactBook: true });
    const statusUrl = new URL(peerStatusRoute, peerBaseUrl).href;
    setPeerStatusCheckStatus(`checking live peer status metadata ${statusUrl}`, false);
    let response;
    try {
      response = await fetch(statusUrl, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        mode: "cors",
        redirect: "error"
      });
    } catch (error) {
      throw new Error(`Live peer status metadata check failed for ${statusUrl}: ${errorMessage(error)}. Restart the MiniModel peer with metadata CORS support if this is a local peer.`);
    }
    if (!response.ok) {
      throw new Error(`Live peer status metadata check failed: HTTP ${response.status}`);
    }
    const contentLength = Number(response.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > catalogTextByteBudget) {
      throw new Error("Live peer status exceeded browser metadata budget");
    }
    const text = await response.text();
    if (state.encoder.encode(text).length > catalogTextByteBudget) {
      throw new Error("Live peer status exceeded browser metadata budget");
    }
    const body = JSON.parse(text);
    const check = validatePeerStatusBody(body, await sha256Text(text), peerBaseUrl, "Live peer status");
    state.peerStatusCheck = check;
    setPeerStatusCheckStatus(peerStatusCheckStatusText(check), false);
    updatePeerUrlStatus(`Live peer status metadata validated: ${check.modelId} at ${check.peerBaseUrl}; Rust reverify required`, false);
    return check;
  }

  function setPeerCompanionInventoryStatus(text, isError) {
    const targetText = text || "companion inventory optional";
    for (const node of [el.peerCompanionInventoryStatus, el.simplePeerCompanionInventoryStatus]) {
      if (node) {
        setText(node, targetText, isError);
      }
    }
    if (el.simpleDiscoveryStatus && state.simpleSourceOption === "p2p") {
      el.simpleDiscoveryStatus.textContent = targetText;
      el.simpleDiscoveryStatus.classList.toggle("error", Boolean(isError));
    }
  }

  function selectedPeerCompanionInventoryFile(preferredInput) {
    if (preferredInput && preferredInput.files && preferredInput.files[0]) {
      return preferredInput.files[0];
    }
    if (el.peerCompanionInventoryFile && el.peerCompanionInventoryFile.files && el.peerCompanionInventoryFile.files[0]) {
      return el.peerCompanionInventoryFile.files[0];
    }
    if (el.simplePeerCompanionInventoryFile && el.simplePeerCompanionInventoryFile.files && el.simplePeerCompanionInventoryFile.files[0]) {
      return el.simplePeerCompanionInventoryFile.files[0];
    }
    return null;
  }

  function validatePeerCompanionInventoryBoundary(boundary, label) {
    const object = requireImportLedgerObject(boundary, label);
    requireImportLedgerBool(object.metadata_only, `${label}.metadata_only`, true);
    requireImportLedgerBool(object.user_run_local_software, `${label}.user_run_local_software`, true);
    requireImportLedgerBool(object.inventory_contains_model_bytes, `${label}.inventory_contains_model_bytes`, false);
    requireImportLedgerBool(object.inventory_contains_peer_piece_bytes, `${label}.inventory_contains_peer_piece_bytes`, false);
    requireImportLedgerBool(object.project_server_serves_model_bytes, `${label}.project_server_serves_model_bytes`, false);
    requireImportLedgerBool(object.project_server_runs_model_bytes, `${label}.project_server_runs_model_bytes`, false);
    requireImportLedgerBool(object.project_server_proxies_model_bytes, `${label}.project_server_proxies_model_bytes`, false);
    requireImportLedgerBool(object.local_piece_store_user_controlled, `${label}.local_piece_store_user_controlled`, true);
    requireImportLedgerBool(object.rust_reverify_required_before_trust, `${label}.rust_reverify_required_before_trust`, true);
    const importGate = requireImportLedgerString(object.tinyrustlm_import_gate, `${label}.tinyrustlm_import_gate`, 160);
    if (!importGate.includes("user-selected-local-slm") && !importGate.includes("user-selected-local")) {
      throw new Error(`${label}.tinyrustlm_import_gate must require a user-selected local .slm`);
    }
  }

  function validatePeerCompanionInventoryShareState(shareState, label, expectedPeerBaseUrl) {
    const object = requireImportLedgerObject(shareState, label);
    const statePath = requireImportLedgerPathHint(object.path, `${label}.path`);
    requireImportLedgerSha(object.sha256, `${label}.sha256`);
    const stateRoute = requireImportLedgerString(object.state_route, `${label}.state_route`, 128);
    if (stateRoute !== "minimodel.peer_companion_state.v0.json") {
      throw new Error(`${label}.state_route was unsupported`);
    }
    const manifestPath = requireImportLedgerPathHint(object.manifest_path, `${label}.manifest_path`);
    const manifestSha256 = requireImportLedgerSha(object.manifest_sha256, `${label}.manifest_sha256`);
    const pieceDirPath = requireImportLedgerPathHint(object.piece_dir_path, `${label}.piece_dir_path`);
    if (requireImportLedgerString(object.piece_set_path_hint, `${label}.piece_set_path_hint`, 128) !== "minimodel.peer_piece_set.v0") {
      throw new Error(`${label}.piece_set_path_hint was unsupported`);
    }
    const pieceSetSha256 = requireImportLedgerSha(object.piece_set_sha256, `${label}.piece_set_sha256`);
    const artifactSha256 = requireImportLedgerSha(object.artifact_sha256, `${label}.artifact_sha256`);
    const artifactByteCount = requireImportLedgerInteger(object.artifact_byte_count, `${label}.artifact_byte_count`, { minimum: 1 });
    const pieceCount = requireImportLedgerInteger(object.piece_count, `${label}.piece_count`, { minimum: 1 });
    const merkleRootSha256 = requireImportLedgerSha(object.merkle_root_sha256, `${label}.merkle_root_sha256`);
    return {
      expectedPeerBaseUrl,
      statePath,
      stateRoute,
      manifestPath,
      manifestSha256,
      pieceDirPath,
      pieceSetSha256,
      artifactSha256,
      artifactByteCount,
      pieceCount,
      merkleRootSha256
    };
  }

  function validatePeerCompanionInventoryPieceStore(pieceStore, label, shareState) {
    const object = requireImportLedgerObject(pieceStore, label);
    const directoryPath = requireImportLedgerPathHint(object.directory_path, `${label}.directory_path`);
    if (directoryPath.toLowerCase() !== shareState.pieceDirPath.toLowerCase()) {
      throw new Error(`${label}.directory_path did not match share_state.piece_dir_path`);
    }
    const byteCount = requireImportLedgerInteger(object.piece_store_byte_count, `${label}.piece_store_byte_count`, { minimum: 1 });
    const quotaBytes = requireImportLedgerInteger(object.piece_store_quota_bytes, `${label}.piece_store_quota_bytes`, { minimum: 1 });
    if (byteCount > quotaBytes) {
      throw new Error(`${label}.piece_store_byte_count exceeds quota`);
    }
    const pieceStoreSha256 = requireImportLedgerSha(object.piece_store_sha256, `${label}.piece_store_sha256`);
    if (requireImportLedgerString(object.quota_status, `${label}.quota_status`, 64) !== "within-quota") {
      throw new Error(`${label}.quota_status was not within-quota`);
    }
    requireImportLedgerBool(object.piece_store_user_controlled, `${label}.piece_store_user_controlled`, true);
    return { byteCount, quotaBytes, pieceStoreSha256 };
  }

  function validatePeerCompanionInventoryReceiptLedger(receiptLedger, label) {
    const object = requireImportLedgerObject(receiptLedger, label);
    requireImportLedgerPathHint(object.path, `${label}.path`);
    requireImportLedgerSha(object.sha256, `${label}.sha256`);
    const entryCount = requireImportLedgerInteger(object.entry_count, `${label}.entry_count`, { minimum: 1 });
    const peerImportCount = requireImportLedgerInteger(object.peer_import_count, `${label}.peer_import_count`);
    if (peerImportCount > entryCount) {
      throw new Error(`${label}.peer_import_count exceeded entry_count`);
    }
    requireImportLedgerInteger(object.model_count, `${label}.model_count`, { minimum: 1 });
    requireImportLedgerBool(object.contains_model_id, `${label}.contains_model_id`, true);
    return { entryCount, peerImportCount };
  }

  function validatePeerCompanionInventoryContactCards(contactCards, contactCardCount, peerBaseUrl, label) {
    if (!Array.isArray(contactCards) || contactCards.length > catalogMaxEntries) {
      throw new Error(`${label} were invalid`);
    }
    if (contactCards.length !== contactCardCount) {
      throw new Error(`${label} count was ${contactCardCount}, expected ${contactCards.length}`);
    }
    const seenPaths = new Set();
    for (const [index, card] of contactCards.entries()) {
      const cardLabel = `${label}.${index}`;
      const object = requireImportLedgerObject(card, cardLabel);
      const cardPath = requireImportLedgerPathHint(object.path, `${cardLabel}.path`);
      const cardPathKey = cardPath.toLowerCase();
      if (seenPaths.has(cardPathKey)) {
        throw new Error(`${cardLabel}.path was duplicated`);
      }
      seenPaths.add(cardPathKey);
      requireImportLedgerSha(object.sha256, `${cardLabel}.sha256`);
      requireImportLedgerString(object.peer_label, `${cardLabel}.peer_label`, 120);
      const cardPeerBaseUrl = normalizedPeerBaseUrl(requireImportLedgerString(object.peer_base_url, `${cardLabel}.peer_base_url`, 256));
      if (cardPeerBaseUrl !== peerBaseUrl) {
        throw new Error(`${cardLabel}.peer_base_url did not match inventory peer_base_url`);
      }
    }
  }

  function validatePeerCompanionInventoryCommands(commands, label) {
    const object = requireImportLedgerObject(commands, label);
    const requiredCommands = [
      ["inspect_inventory", "inspect-peer-companion-inventory"],
      ["inspect_state", "inspect-peer-companion-state"],
      ["inspect_receipt_ledger", "inspect-import-receipt-ledger"],
      ["serve_peer_companion", "serve-peer-companion"]
    ];
    for (const [field, expectedText] of requiredCommands) {
      const command = requireImportLedgerString(object[field], `${label}.${field}`, 1024);
      if (!command.includes(expectedText)) {
        throw new Error(`${label}.${field} must include ${expectedText}`);
      }
    }
  }

  function validatePeerCompanionInventoryServePlan(servePlan, label, peerBaseUrl, shareState) {
    const object = requireImportLedgerObject(servePlan, label);
    const status = requireImportLedgerString(object.status, `${label}.status`, 96);
    if (status !== "ready-after-rust-reverify") {
      throw new Error(`${label}.status was unsupported`);
    }
    if (requireImportLedgerString(object.transport, `${label}.transport`, 96) !== "direct-http-piece-server-v0") {
      throw new Error(`${label}.transport was unsupported`);
    }
    const planPeerBaseUrl = normalizedPeerBaseUrl(requireImportLedgerString(object.peer_base_url, `${label}.peer_base_url`, 256));
    if (planPeerBaseUrl !== peerBaseUrl) {
      throw new Error(`${label}.peer_base_url did not match inventory peer_base_url`);
    }
    const peerStatusRoute = requireImportLedgerString(object.peer_status_route, `${label}.peer_status_route`, 128);
    if (peerStatusRoute !== "minimodel.peer_status.v0.json") {
      throw new Error(`${label}.peer_status_route was unsupported`);
    }
    const peerPieceSetRoute = requireImportLedgerString(object.peer_piece_set_route, `${label}.peer_piece_set_route`, 128);
    if (peerPieceSetRoute !== "minimodel.peer_piece_set.v0") {
      throw new Error(`${label}.peer_piece_set_route was unsupported`);
    }
    const peerCompanionStateRoute = requireImportLedgerString(object.peer_companion_state_route, `${label}.peer_companion_state_route`, 128);
    if (peerCompanionStateRoute !== shareState.stateRoute) {
      throw new Error(`${label}.peer_companion_state_route did not match share_state.state_route`);
    }
    const statePath = requireImportLedgerPathHint(object.state_path, `${label}.state_path`);
    if (statePath.toLowerCase() !== shareState.statePath.toLowerCase()) {
      throw new Error(`${label}.state_path did not match share_state.path`);
    }
    const manifestPath = requireImportLedgerPathHint(object.manifest_path, `${label}.manifest_path`);
    if (manifestPath.toLowerCase() !== shareState.manifestPath.toLowerCase()) {
      throw new Error(`${label}.manifest_path did not match share_state.manifest_path`);
    }
    const pieceDirPath = requireImportLedgerPathHint(object.piece_dir_path, `${label}.piece_dir_path`);
    if (pieceDirPath.toLowerCase() !== shareState.pieceDirPath.toLowerCase()) {
      throw new Error(`${label}.piece_dir_path did not match share_state.piece_dir_path`);
    }
    const serveCommand = requireImportLedgerString(object.serve_command, `${label}.serve_command`, 1024);
    if (serveCommand !== "minimodel serve-peer-companion <state-json> <manifest> <piece-dir> <bind-addr>") {
      throw new Error(`${label}.serve_command was unsupported`);
    }
    const expectedPreflightCommands = [
      "minimodel inspect-peer-companion-inventory <inventory-json>",
      "minimodel inspect-peer-companion-state <state-json> <manifest> <piece-dir>",
      "minimodel inspect-import-receipt-ledger <ledger-json>"
    ];
    if (!Array.isArray(object.preflight_commands) || object.preflight_commands.length !== expectedPreflightCommands.length) {
      throw new Error(`${label}.preflight_commands were invalid`);
    }
    expectedPreflightCommands.forEach((expectedCommand, index) => {
      const command = requireImportLedgerString(object.preflight_commands[index], `${label}.preflight_commands.${index}`, 1024);
      if (command !== expectedCommand) {
        throw new Error(`${label}.preflight_commands.${index} was unsupported`);
      }
    });
    requireImportLedgerBool(object.requires_operator_consent, `${label}.requires_operator_consent`, true);
    requireImportLedgerBool(object.requires_loopback_or_direct_peer_url, `${label}.requires_loopback_or_direct_peer_url`, true);
    requireImportLedgerBool(object.rust_reverify_required_before_serving, `${label}.rust_reverify_required_before_serving`, true);
    requireImportLedgerBool(object.project_server_serves_model_bytes, `${label}.project_server_serves_model_bytes`, false);
    requireImportLedgerBool(object.project_server_runs_model_bytes, `${label}.project_server_runs_model_bytes`, false);
    requireImportLedgerBool(object.project_server_proxies_model_bytes, `${label}.project_server_proxies_model_bytes`, false);
    return {
      status,
      peerStatusRoute,
      peerPieceSetRoute,
      peerCompanionStateRoute
    };
  }

  function validatePeerCompanionInventoryBody(body, inventorySha256, sourceLabel) {
    const label = sourceLabel || "Peer companion inventory";
    const object = requireImportLedgerObject(body, label);
    if (catalogText(object.inventory_kind) !== "minimodel.peer_companion_inventory.v0") {
      throw new Error(`${label} kind was unsupported`);
    }
    if (catalogInteger(object.inventory_version) !== 1) {
      throw new Error(`${label} version was unsupported`);
    }
    const generatedAt = requireImportLedgerString(object.generated_at, `${label}.generated_at`, 32);
    if (!isStrictMiniModelUtcTimestamp(generatedAt)) {
      throw new Error(`${label}.generated_at was invalid`);
    }
    const modelId = requireImportLedgerString(object.model_id, `${label}.model_id`, 180);
    if (!isCatalogModelId(modelId)) {
      throw new Error(`${label}.model_id was invalid`);
    }
    const peerBaseUrl = normalizedPeerBaseUrl(requireImportLedgerString(object.peer_base_url, `${label}.peer_base_url`, 256));
    const shareState = validatePeerCompanionInventoryShareState(object.share_state, `${label}.share_state`, peerBaseUrl);
    const pieceStore = validatePeerCompanionInventoryPieceStore(object.piece_store, `${label}.piece_store`, shareState);
    const receiptLedger = validatePeerCompanionInventoryReceiptLedger(object.receipt_ledger, `${label}.receipt_ledger`);
    const contactCardCount = requireImportLedgerInteger(object.contact_card_count, `${label}.contact_card_count`);
    validatePeerCompanionInventoryContactCards(object.contact_cards, contactCardCount, peerBaseUrl, `${label}.contact_cards`);
    validatePeerCompanionInventoryCommands(object.commands, `${label}.commands`);
    const servePlan = validatePeerCompanionInventoryServePlan(object.serve_plan, `${label}.serve_plan`, peerBaseUrl, shareState);
    validatePeerCompanionInventoryBoundary(object.boundary, `${label}.boundary`);
    return {
      sourceLabel: label,
      inventorySha256,
      generatedAt,
      modelId,
      peerBaseUrl,
      servePlanStatus: servePlan.status,
      servePlanPeerStatusRoute: servePlan.peerStatusRoute,
      servePlanPeerPieceSetRoute: servePlan.peerPieceSetRoute,
      pieceCount: shareState.pieceCount,
      pieceStoreByteCount: pieceStore.byteCount,
      pieceStoreSha256: pieceStore.pieceStoreSha256,
      pieceStoreQuotaBytes: pieceStore.quotaBytes,
      receiptEntryCount: receiptLedger.entryCount,
      receiptPeerImportCount: receiptLedger.peerImportCount,
      contactCardCount
    };
  }

  function peerCompanionInventoryStatusText(inventory) {
    if (!inventory) {
      return "companion inventory optional";
    }
    const pieceText = `${inventory.pieceCount} piece${inventory.pieceCount === 1 ? "" : "s"}`;
    const receiptText = `${inventory.receiptEntryCount} receipt${inventory.receiptEntryCount === 1 ? "" : "s"}`;
    const contactText = `${inventory.contactCardCount} contact card${inventory.contactCardCount === 1 ? "" : "s"}`;
    return `Peer companion inventory loaded: ${inventory.sourceLabel} / ${inventory.modelId} / ${pieceText} / ${formatByteCount(inventory.pieceStoreByteCount)} store of ${formatByteCount(inventory.pieceStoreQuotaBytes)} quota / store ${inventory.pieceStoreSha256} / peer ${inventory.peerBaseUrl} / ${receiptText} / ${contactText} / serve plan ${inventory.servePlanStatus} / status route ${inventory.servePlanPeerStatusRoute} / ${inventory.inventorySha256} / Rust reverify required`;
  }

  async function importPeerCompanionInventoryFile(preferredInput) {
    const file = selectedPeerCompanionInventoryFile(preferredInput);
    if (!file) {
      throw new Error("Choose a peer companion inventory JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Peer companion inventory file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Peer companion inventory exceeded browser metadata budget");
    }
    const fileName = safeLocalModelName(file.name);
    setPeerCompanionInventoryStatus(`reading peer companion inventory ${fileName}`, false);
    const text = await file.text();
    if (state.encoder.encode(text).length > catalogTextByteBudget) {
      throw new Error("Peer companion inventory exceeded browser metadata budget");
    }
    const body = JSON.parse(text);
    const inventory = validatePeerCompanionInventoryBody(body, await sha256Text(text), fileName);
    state.peerCompanionInventory = inventory;
    setPeerBaseUrl(inventory.peerBaseUrl, { keepPeerContactBook: true });
    updatePeerUrlStatus(`Peer companion inventory loaded: known peer set to ${inventory.peerBaseUrl}; Rust reverify required`, false);
    setPeerCompanionInventoryStatus(peerCompanionInventoryStatusText(inventory), false);
    return inventory;
  }

  const peerShareChunkBytes = 1024 * 1024;

  function bytesToHex(bytes) {
    return Array.from(bytes)
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  }

  function hexToBytes(hex) {
    const clean = String(hex || "").replace(/^sha256:/i, "");
    if (!/^[0-9a-f]{64}$/i.test(clean)) {
      throw new Error("SHA-256 hex was invalid");
    }
    const bytes = new Uint8Array(32);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
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

  function validateCatalogArtifactMatch(entry, name, byteLength, sha256) {
    if (!entry) {
      return;
    }
    if (byteLength !== entry.artifactByteCount) {
      throw new Error("Catalog byte count mismatch");
    }
    if (sha256 !== entry.artifactSha256) {
      throw new Error("Catalog SHA-256 mismatch");
    }
    if (!/\.slm$/i.test(name)) {
      throw new Error("Catalog artifact must be a local .slm file");
    }
  }

  function localModelSelectedFiles() {
    const files = Array.from(el.localModelFile && el.localModelFile.files ? el.localModelFile.files : []);
    const slms = files.filter((file) => /\.slm$/i.test(safeLocalModelName(file.name)));
    const receipts = files.filter((file) => /\.minimodel-receipt$/i.test(safeLocalModelName(file.name)));
    const admissions = files.filter((file) =>
      /\.browser-model-admission\.json$/i.test(safeLocalModelName(file.name)));
    return {
      files,
      slms,
      receipts,
      admissions,
      slm: slms.length === 1 ? slms[0] : null,
      receipt: receipts.length === 1 ? receipts[0] : null,
      admission: admissions.length === 1 ? admissions[0] : null
    };
  }

  function localModelSelectionError(selectedFiles) {
    if (selectedFiles.slms.length > 1) {
      return "Choose exactly one local .slm file";
    }
    if (selectedFiles.receipts.length > 1) {
      return "Choose at most one MiniModel receipt sidecar";
    }
    if (selectedFiles.admissions.length !== 1) {
      return "Choose exactly one browser model admission sidecar";
    }
    if (selectedFiles.files.length > 0 && selectedFiles.slms.length === 0) {
      return `${selectedFiles.files.length} file(s) selected / choose one .slm file`;
    }
    if (selectedFiles.files.length !==
        selectedFiles.slms.length + selectedFiles.receipts.length +
          selectedFiles.admissions.length) {
      return "The local model bundle contains an unsupported file";
    }
    return "";
  }

  async function inspectBrowserModelAdmission(file, artifactName, artifactByteCount) {
    if (!file || !Number.isFinite(file.size) || file.size <= 0 ||
        file.size > browserModelAdmissionApi.maximumTextBytes) {
      throw new Error("Browser model admission sidecar size was invalid");
    }
    const name = safeLocalModelName(file.name);
    if (!/\.browser-model-admission\.json$/i.test(name)) {
      throw new Error("Browser model admission sidecar name was invalid");
    }
    const admissionText = await file.text();
    if (state.encoder.encode(admissionText).length > browserModelAdmissionApi.maximumTextBytes) {
      throw new Error("Browser model admission sidecar exceeded its byte budget");
    }
    const admission = browserModelAdmissionApi.parseAdmissionText(
      admissionText,
      { applicationOrigin: window.location.origin }
    );
    if (admission.artifact.fileName !== artifactName ||
        admission.artifact.byteCount !== artifactByteCount) {
      throw new Error("Browser model admission artifact identity changed");
    }
    const systemPromptSha256 =
      (await sha256Text(admission.runtime.systemPrompt)).replace(/^sha256:/, "");
    if (systemPromptSha256 !== admission.runtime.systemPromptSha256) {
      throw new Error("Browser model admission system prompt SHA-256 changed");
    }
    return Object.freeze({
      fileName: name,
      sha256: (await sha256Text(admissionText)).replace(/^sha256:/, ""),
      admission
    });
  }

  function requireMiniModelReceiptBool(fields, key, expected) {
    const actual = requireManifestField(fields, key, "MiniModel import receipt");
    if (actual !== "true" && actual !== "false") {
      throw new Error(`MiniModel import receipt field ${key} was ${actual}`);
    }
    const parsed = actual === "true";
    if (parsed !== expected) {
      throw new Error(`MiniModel import receipt field ${key} was ${actual}`);
    }
    return parsed;
  }

  function requireMiniModelReceiptSha(fields, key) {
    const value = normalizeCatalogSha256(requireManifestField(fields, key, "MiniModel import receipt"));
    if (!value) {
      throw new Error(`MiniModel import receipt field ${key} was invalid`);
    }
    return value;
  }

  function requireMiniModelReceiptOptionalBool(fields, key, expected) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) {
      return null;
    }
    return requireMiniModelReceiptBool(fields, key, expected);
  }

  function isMiniModelReceiptLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function miniModelReceiptDaysInMonth(year, month) {
    if ([1, 3, 5, 7, 8, 10, 12].includes(month)) {
      return 31;
    }
    if ([4, 6, 9, 11].includes(month)) {
      return 30;
    }
    if (month === 2) {
      return isMiniModelReceiptLeapYear(year) ? 29 : 28;
    }
    return 0;
  }

  function isStrictMiniModelUtcTimestamp(value) {
    const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})Z$/.exec(String(value || ""));
    if (!match) {
      return false;
    }
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    const hour = Number.parseInt(match[4], 10);
    const minute = Number.parseInt(match[5], 10);
    const second = Number.parseInt(match[6], 10);
    return (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= miniModelReceiptDaysInMonth(year, month) &&
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59 &&
      second >= 0 &&
      second <= 59
    );
  }

  function requireMiniModelReceiptTimestamp(fields, key) {
    const value = requireManifestField(fields, key, "MiniModel import receipt");
    if (!isStrictMiniModelUtcTimestamp(value)) {
      throw new Error(`MiniModel import receipt field ${key} was invalid`);
    }
    return value;
  }

  function requireMiniModelReceiptModelId(fields, key) {
    const value = requireManifestField(fields, key, "MiniModel import receipt");
    if (!/^[a-z0-9][a-z0-9._/-]{0,179}$/.test(value)) {
      throw new Error(`MiniModel import receipt field ${key} was invalid`);
    }
    return value;
  }

  function requireMiniModelReceiptPrintable(fields, key, maxLength) {
    const value = requireManifestField(fields, key, "MiniModel import receipt");
    if (value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error(`MiniModel import receipt field ${key} was invalid`);
    }
    return value;
  }

  function requireMiniModelReceiptToken(fields, key) {
    const value = requireMiniModelReceiptPrintable(fields, key, 96);
    if (!/^[A-Za-z0-9._-]+$/.test(value)) {
      throw new Error(`MiniModel import receipt field ${key} was invalid`);
    }
    return value;
  }

  function requireMiniModelReceiptPathHint(fields, key) {
    const value = requireMiniModelReceiptPrintable(fields, key, 128);
    if (
      value !== value.trim() ||
      value !== safeLocalModelName(value) ||
      value.startsWith(".") ||
      value.includes("..") ||
      /[\\/:*?"<>|\u0000-\u001f\u007f]/.test(value)
    ) {
      throw new Error(`MiniModel import receipt field ${key} was invalid`);
    }
    return value;
  }

  function requireMiniModelReceiptOneOf(fields, key, allowedValues) {
    const value = requireManifestField(fields, key, "MiniModel import receipt");
    if (!allowedValues.includes(value)) {
      throw new Error(`MiniModel import receipt field ${key} was ${value}`);
    }
    return value;
  }

  function requireMiniModelReceiptPeerBaseUrl(fields, key) {
    try {
      return normalizedPeerBaseUrl(requireManifestField(fields, key, "MiniModel import receipt"));
    } catch (error) {
      throw new Error(`MiniModel import receipt field ${key} was invalid: ${error.message || error}`);
    }
  }

  function miniModelPeerReceiptRouteUrl(peerBaseUrl, route) {
    return new URL(route, peerBaseUrl).href;
  }

  async function inspectLocalMiniModelImportReceipt(receiptFile, artifactName, artifactByteLength) {
    if (!receiptFile) {
      return null;
    }
    const receiptName = safeLocalModelName(receiptFile.name);
    if (!/\.minimodel-receipt$/i.test(receiptName)) {
      throw new Error("MiniModel receipt sidecar must use the .minimodel-receipt extension");
    }
    if (!Number.isFinite(receiptFile.size) || receiptFile.size <= 0 || receiptFile.size > receiptTextByteBudget) {
      throw new Error("MiniModel receipt sidecar size was invalid");
    }
    const text = await receiptFile.text();
    if (state.encoder.encode(text).length > receiptTextByteBudget) {
      throw new Error("MiniModel receipt sidecar exceeded the receipt byte budget");
    }
    const fields = parseManifest(text);
    requireManifestEqual(fields, "receipt.version", "0", "MiniModel import receipt");
    requireManifestEqual(fields, "receipt.kind", "minimodel.import_receipt", "MiniModel import receipt");
    const receiptCreatedUtc = requireMiniModelReceiptTimestamp(fields, "receipt.created_utc");
    const manifestSha256 = requireMiniModelReceiptSha(fields, "manifest.sha256");
    const modelId = requireMiniModelReceiptModelId(fields, "manifest.model_id");
    requireManifestEqual(fields, "artifact.local_path_hint", artifactName, "MiniModel import receipt");
    const receiptByteCount = catalogInteger(requireManifestField(fields, "artifact.byte_count", "MiniModel import receipt"));
    if (receiptByteCount !== artifactByteLength) {
      throw new Error("MiniModel import receipt artifact.byte_count mismatch");
    }
    const receiptArtifactSha256 = requireMiniModelReceiptSha(fields, "artifact.sha256");
    requireManifestEqual(fields, "slm.validation_status", "passed", "MiniModel import receipt");
    const slmModelShape = requireMiniModelReceiptPrintable(fields, "slm.model_shape", 512);
    const quantization = requireMiniModelReceiptToken(fields, "slm.quantization");
    const evidenceStatus = requireMiniModelReceiptToken(fields, "evidence.status");
    requireManifestEqual(fields, "import.next_gate", miniModelImportReceiptNextGate, "MiniModel import receipt");
    for (const key of [
      "project_server_serves_model_bytes",
      "project_server_runs_model_bytes",
      "project_server_proxies_huggingface_bytes"
    ]) {
      requireMiniModelReceiptOptionalBool(fields, key, false);
    }
    const peerImport = Boolean(
      fields["peer_import.transport"] ||
      fields["peer_import.verification_status"] ||
      fields["peer.base_url"] ||
      fields["peer_piece_bytes_fetched"] ||
      fields["artifact.assembled_from_peer_pieces"]
    );
    let peerBaseUrl = "unavailable";
    let companionStateStatus = "unavailable";
    let receiverValidationContractStatus = "unavailable";
    let pieceCount = null;
    if (peerImport) {
      requireManifestEqual(fields, "peer_import.transport", "known-direct-http-peer-v0", "MiniModel import receipt");
      requireManifestEqual(fields, "peer_import.verification_status", "passed", "MiniModel import receipt");
      receiverValidationContractStatus = requireMiniModelReceiptOneOf(fields, "receiver_validation_contract.status", ["validated"]);
      requireMiniModelReceiptBool(fields, "receiver_validation.check_peer_status_before_piece_fetch", true);
      requireMiniModelReceiptBool(fields, "receiver_validation.preflight_fetches_piece_set_before_pieces", true);
      requireMiniModelReceiptBool(fields, "receiver_validation.validate_advertised_companion_state_before_piece_fetch", true);
      requireMiniModelReceiptBool(fields, "receiver_validation.import_receipt_required_before_browser_load", true);
      requireMiniModelReceiptPathHint(fields, "peer_import.request_path_hint");
      peerBaseUrl = requireMiniModelReceiptPeerBaseUrl(fields, "peer.base_url");
      requireMiniModelReceiptPathHint(fields, "peer.piece_dir_path_hint");
      requireManifestEqual(fields, "peer.piece_set_path_hint", peerPieceSetRoute, "MiniModel import receipt");
      requireMiniModelReceiptSha(fields, "peer.piece_set_sha256");
      const companionStateUrl = requireManifestField(fields, "peer.companion_state_url", "MiniModel import receipt");
      const expectedCompanionStateUrl = miniModelPeerReceiptRouteUrl(peerBaseUrl, peerCompanionStateRoute);
      if (companionStateUrl !== expectedCompanionStateUrl) {
        throw new Error("MiniModel import receipt peer.companion_state_url mismatch");
      }
      companionStateStatus = requireMiniModelReceiptOneOf(fields, "peer.companion_state_status", ["validated", "not-advertised"]);
      requireManifestEqual(fields, "chunks.mode", "fixed-size-merkle-v0", "MiniModel import receipt");
      requireMiniModelReceiptSha(fields, "chunks.merkle_root_sha256");
      pieceCount = catalogInteger(requireManifestField(fields, "chunks.count", "MiniModel import receipt"));
      if (!pieceCount) {
        throw new Error("MiniModel import receipt chunks.count was invalid");
      }
      requireMiniModelReceiptBool(fields, "peer_piece_set_metadata_fetched", true);
      requireMiniModelReceiptBool(fields, "peer_companion_state_metadata_fetched", companionStateStatus === "validated");
      requireMiniModelReceiptBool(fields, "peer_piece_bytes_fetched", true);
      requireMiniModelReceiptBool(fields, "artifact.assembled_from_peer_pieces", true);
      requireMiniModelReceiptBool(fields, "project_server_serves_model_bytes", false);
      requireMiniModelReceiptBool(fields, "project_server_runs_model_bytes", false);
      requireMiniModelReceiptBool(fields, "project_server_proxies_huggingface_bytes", false);
    }
    return {
      fileName: receiptName,
      receiptSha256: await sha256Text(text),
      fields,
      receiptCreatedUtc,
      modelId,
      manifestSha256,
      artifactByteCount: receiptByteCount,
      artifactSha256: receiptArtifactSha256,
      slmModelShape,
      quantization,
      evidenceStatus,
      nextGate: miniModelImportReceiptNextGate,
      peerImport,
      peerBaseUrl,
      receiverValidationContractStatus,
      companionStateStatus,
      pieceCount
    };
  }

  function validateLocalImportReceiptArtifact(receipt, artifactByteLength, artifactSha256) {
    if (!receipt) {
      return;
    }
    if (receipt.artifactByteCount !== artifactByteLength) {
      throw new Error("MiniModel import receipt artifact.byte_count mismatch");
    }
    if (receipt.artifactSha256 !== artifactSha256) {
      throw new Error("MiniModel import receipt artifact.sha256 mismatch");
    }
  }

  function localImportReceiptSummary(receipt) {
    if (!receipt) {
      return "";
    }
    if (receipt.peerImport) {
      return `MiniModel P2P receipt / ${receipt.companionStateStatus} / ${receipt.pieceCount || "unknown"} chunks`;
    }
    return "MiniModel import receipt";
  }

  function localImportReceiptProvenanceSnapshot(receipt) {
    if (!receipt) {
      return "";
    }
    const parts = [
      localImportReceiptSummary(receipt),
      `receipt ${receipt.receiptSha256}`,
      `created ${receipt.receiptCreatedUtc}`
    ];
    if (receipt.peerImport) {
      parts.push(
        `receiver validation ${receipt.receiverValidationContractStatus}`,
        `peer ${receipt.peerBaseUrl}`,
        `companion ${receipt.companionStateStatus}`,
        `${receipt.pieceCount || "unknown"} chunks`
      );
    } else {
      parts.push(`manifest ${receipt.manifestSha256}`);
    }
    return parts.filter(Boolean).join(" / ");
  }

  function localImportReceiptReviewSummary(receipt) {
    if (!receipt) {
      return "";
    }
    return [
      `receipt ${receipt.fileName}`,
      `evidence ${receipt.evidenceStatus}`,
      `manifest ${receipt.manifestSha256}`,
      receipt.peerImport ? `receiver validation ${receipt.receiverValidationContractStatus}` : "",
      `quantization ${receipt.quantization}`
    ].filter(Boolean).join(" / ");
  }

  function localImportReceiptRouteSummary(receipt) {
    if (!receipt) {
      return "";
    }
    return receipt.peerImport
      ? `receipt=${receipt.fileName} / receiver-validation=${receipt.receiverValidationContractStatus} / peer=${receipt.peerBaseUrl} / companion=minimodel.peer_companion_state.v0.json`
      : `receipt=${receipt.fileName}`;
  }

  function localImportReceiptArtifactSummary(receipt, byteLength) {
    if (!receipt) {
      return "";
    }
    return `artifact=${receipt.artifactSha256} / bytes=${byteLength}`;
  }

  function localImportReceiptValidationSummary(receipt) {
    if (!receipt) {
      return "";
    }
    if (receipt.peerImport) {
      return [
        "receipt-chain-ready-for-browser-load",
        `receiver validation ${receipt.receiverValidationContractStatus}`,
        `peer ${receipt.peerBaseUrl}`,
        `companion ${receipt.companionStateStatus}`,
        `chunks ${receipt.pieceCount || "unknown"}`,
        `artifact ${receipt.artifactSha256}`
      ].join(" / ");
    }
    return `receipt-ready-for-browser-load / artifact ${receipt.artifactSha256}`;
  }

  function setLocalFileVerificationState(model, verified) {
    if (model && model.localFile) {
      model.localFile.verified = Boolean(verified);
    }
  }
  async function importLocalModelFile() {
    const selectedFiles = localModelSelectedFiles();
    const selectionError = localModelSelectionError(selectedFiles);
    if (selectionError) {
      throw new Error(selectionError);
    }
    const file = selectedFiles.slm;
    if (!file) {
      throw new Error("Choose a local .slm file");
    }
    const name = safeLocalModelName(file.name);
    if (!/\.slm$/i.test(name)) {
      throw new Error("Local model must use the .slm extension");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Local model file is empty");
    }
    if (file.size > localModelMaxBytes) {
      throw new Error(`Local model exceeds ${formatByteCount(localModelMaxBytes)} browser limit`);
    }
    if (!state.exports) {
      throw new Error("Rust/WASM runtime must be loaded before local model import");
    }
    setLocalModelStatus(`preparing bounded validation for ${name}`, false);
    const receiptArtifactName = String(file.name || name);
    const importReceipt = await inspectLocalMiniModelImportReceipt(selectedFiles.receipt, receiptArtifactName, file.size);
    const browserAdmission = await inspectBrowserModelAdmission(
      selectedFiles.admission,
      receiptArtifactName,
      file.size
    );
    const admitted = browserAdmission.admission;
    const catalogEntry = state.selectedCatalogEntry;
    const stagedModel = {
      candidateId: admitted.modelId,
      label: `${catalogEntry ? catalogEntry.displayName : admitted.modelId} (${importReceipt && importReceipt.peerImport ? "P2P receipt" : "qualified local bundle"})`,
      path: `local-file:${name}`,
      maxTokens: Math.min(1024, admitted.runtime.contextLength - 1),
      modelBytes: admitted.artifact.byteCount,
      artifactSha256: `sha256:${admitted.artifact.sha256}`,
      contextLength: admitted.runtime.contextLength,
      promptFormat: admitted.runtime.promptFormat,
      repetitionPenalty: admitted.runtime.repetitionPenalty,
      browserAdmission,
      composition: {
        path: admitted.composition.url,
        bytes: admitted.composition.byteCount,
        sha256: `sha256:${admitted.composition.sha256}`,
        baseModelId: admitted.composition.baseModelId,
        compositionId: admitted.composition.compositionId,
        activeGraphSha256: `sha256:${admitted.composition.activeGraphSha256}`,
        routePolicyId: admitted.composition.routePolicyId,
        kvFormatId: admitted.composition.kvFormatId,
        positionPolicySha256: `sha256:${admitted.composition.positionPolicySha256}`,
        memberCount: admitted.composition.memberCount
      },
      localFile: {
        file,
        name,
        byteLength: file.size,
        checksum: "",
        sha256: "",
        chunks: null,
        catalogEntry,
        importReceipt,
        browserAdmissionSha256: browserAdmission.sha256,
        verified: false
      }
    };
    const transferLoadId = state.modelLoadSequence + 1;
    state.modelLoadSequence = transferLoadId;
    stagedModel.localFile.pendingTransfer = await localFileModelTransfer(stagedModel, transferLoadId);
    try {
      state.localModel = stagedModel;
      paths.models = modelsWithLocalModel(paths.models);
      renderModelOptions(paths.models, false, localModelKey);
      const receiptSummary = localImportReceiptSummary(importReceipt);
      setLocalModelStatus(
        `${name} / ${formatByteCount(file.size)} / ${stagedModel.localFile.sha256} / ${stagedModel.localFile.checksum}${receiptSummary ? ` / ${receiptSummary}` : ""} / Rust validation pending`,
        false
      );
      setText(el.errorState, "none", false);
      const loaded = await loadSelectedModel();
      if (!loaded) {
        throw new Error(el.errorState.textContent || "Local .slm failed Rust/WASM validation");
      }
    } catch (error) {
      discardOwnedModelTransfer(stagedModel.localFile.pendingTransfer);
      stagedModel.localFile.pendingTransfer = null;
      throw error;
    }
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

  async function fetchHfImmutableDetail(entry) {
    const modelPath = String(entry.modelId || "")
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const url = new URL(`${hfOrigin()}/api/models/${modelPath}`);
    url.searchParams.set("blobs", "true");
    const response = await fetch(url.toString(), {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer"
    });
    if (!response.ok) {
      throw new Error(`Unable to inspect the immutable model revision (${response.status})`);
    }
    const detail = await response.json();
    const canonicalModelId = hfModelId(detail);
    if (
      !canonicalModelId ||
      normalizeModelIdentity(canonicalModelId) !== normalizeModelIdentity(entry.modelId)
    ) {
      throw new Error("Hugging Face model detail identity changed");
    }
    if (!/^[0-9a-f]{40}$/i.test(String(detail.sha || ""))) {
      throw new Error("Hugging Face did not return an immutable 40-hex model revision");
    }
    return detail;
  }

  function hfDetailLicenseId(detail) {
    const tags = Array.isArray(detail && detail.tags) ? detail.tags : [];
    const tagged = tags.find((value) => /^license:/i.test(String(value || "")));
    const value = String(
      detail && detail.cardData && detail.cardData.license ||
      detail && detail.license ||
      tagged && String(tagged).slice("license:".length) ||
      ""
    ).trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9.+_-]{0,95}$/.test(value) || value === "other" || value === "unknown") {
      throw new Error("The pinned model revision lacks an unambiguous license identifier");
    }
    return value;
  }

  function hfDetailFiles(detail) {
    const siblings = Array.isArray(detail && detail.siblings) ? detail.siblings : [];
    return siblings.map((sibling) => ({
      file_name: hfSiblingFileName(sibling),
      byte_count: hfSiblingByteCount(sibling),
      sha256: hfSiblingSha256(sibling)
    })).filter((file) => file.file_name && Number.isSafeInteger(file.byte_count) && file.byte_count > 0);
  }

  function hfDirectConversionRequest(entry, detail) {
    const contract = hfSourceContract(entry.modelId);
    if (!contract) {
      throw new Error("This model architecture is not supported by the local Rust converter");
    }
    const files = hfDetailFiles(detail);
    const sources = files.filter((file) => /\.safetensors$/i.test(file.file_name));
    if (!sources.length || sources.some((file) => !file.sha256)) {
      throw new Error("The pinned model revision lacks complete safetensors size and SHA-256 metadata");
    }
    const metadataByName = new Map(
      files
        .filter((file) => !file.file_name.includes("/"))
        .map((file) => [file.file_name.toLowerCase(), file])
    );
    const licenseFile = ["license", "license.txt", "license.md", "readme.md"]
      .map((name) => metadataByName.get(name))
      .find(Boolean);
    const metadata = [
      metadataByName.get("config.json"),
      metadataByName.get("tokenizer.json"),
      licenseFile
    ];
    if (metadata.some((file) => !file)) {
      throw new Error("The pinned revision lacks config, tokenizer, or license/model-card metadata");
    }
    const revision = String(detail.sha).toLowerCase();
    return {
      request_kind: "minimodel.huggingface_conversion_request.v1",
      source: {
        kind: "huggingface_model",
        model_id: hfModelId(detail),
        revision,
        license_id: hfDetailLicenseId(detail),
        metadata_files: metadata.map((file) => ({
          file_name: file.file_name,
          sha256: file.sha256,
          byte_count: file.byte_count
        }))
      },
      requested_artifact: {
        kind: "slm",
        supported_source_shapes: [contract.modelShape],
        default_source_shape: contract.modelShape,
        default_quantization: contract.quantization,
        runtime_target: "TinyRustLM Rust/WASM browser-local runtime",
        browser_import_rule: "The paired companion streams the receipt-verified local .slm into browser memory."
      },
      local_conversion: {
        source_format: "safetensors",
        source_input_mode: sources.length === 1
          ? "single-safetensors-file"
          : "safetensors-shard-directory",
        suggested_source_safetensors_file: sources[0].file_name,
        suggested_source_safetensors_files: sources.map((file) => ({
          file_name: file.file_name,
          sha256: file.sha256,
          byte_count: file.byte_count
        }))
      }
    };
  }

  function setHfStatus(text, isError) {
    if (el.hfStatus) {
      setText(el.hfStatus, text, isError);
    }
    if (el.simpleDiscoveryStatus && state.simpleSourceOption === "huggingface") {
      el.simpleDiscoveryStatus.textContent = text;
      el.simpleDiscoveryStatus.classList.toggle("error", Boolean(isError));
    }
  }

  function clearHfResults() {
    if (el.hfResults) {
      el.hfResults.replaceChildren();
    }
    if (el.simpleHfResults) {
      el.simpleHfResults.replaceChildren();
    }
    if (el.simpleHfFlowSummary) {
      el.simpleHfFlowSummary.replaceChildren();
      el.simpleHfFlowSummary.hidden = true;
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

  function hfSlmSiblings(result) {
    const siblings = result && Array.isArray(result.siblings) ? result.siblings : [];
    return siblings
      .map(hfSiblingFileName)
      .filter((fileName) => /\.slm$/i.test(fileName) && !fileName.includes("\\"))
      .slice(0, 3);
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

  function catalogEntryMatchesHfModel(entry, modelId) {
    const target = normalizeModelIdentity(modelId);
    if (!target || !entry) {
      return false;
    }
    const raw = entry.raw || {};
    const candidates = [
      entry.sourceHuggingFaceModelId,
      entry.sourceModelId,
      entry.sourceIdentity,
      entry.sourceUrl,
      raw.source_huggingface_model_id,
      raw.huggingface_model_id,
      raw.hf_model_id,
      raw.source_model_id,
      raw.upstream_model_id,
      raw.source_url
    ].map(normalizeModelIdentity).filter(Boolean);
    return candidates.some((candidate) => candidate === target);
  }

  function hfP2pMatches(modelId) {
    return state.catalogEntries.filter((entry) => catalogEntryMatchesHfModel(entry, modelId));
  }

  function firstPeerOfferMatch(matches) {
    return matches.find((match) => Boolean(match.peerOfferRoute)) || null;
  }

  function catalogPeerBaseUrl(entry) {
    return entry && Array.isArray(entry.peerSources) && entry.peerSources.length
      ? entry.peerSources[0].peerBaseUrl
      : "";
  }

  function p2pImportBaseUrl(entry, explicitPeerBaseUrl = state.peerBaseUrl) {
    if (explicitPeerBaseUrl) {
      return normalizedPeerBaseUrl(explicitPeerBaseUrl);
    }
    return catalogPeerBaseUrl(entry);
  }

  function canStartP2pImport(entry) {
    return Boolean(
      entry &&
      entry.peerOfferRoute &&
      entry.composition &&
      p2pImportBaseUrl(entry)
    );
  }

  function p2pCatalogActionButton(entry) {
    if (!entry || !entry.peerOfferRoute || !entry.composition) {
      return null;
    }
    const canImport = canStartP2pImport(entry);
    const sameResumableImport = Boolean(
      state.companion.activeEntry &&
      state.companion.activeEntry.modelId === entry.modelId &&
      catalogText(state.companion.activeStatus && state.companion.activeStatus.state) === "resumable"
    );
    const label = !canImport
      ? "Set Peer URL"
      : sameResumableImport ? "Resume model" : "Get model";
    return actionButton(
      label,
      () => startP2pImportOrRequestPeer(entry),
      "primary-result-action"
    );
  }

  function requestKnownPeerForEntry(entry) {
    selectCatalogEntry(entry);
    setSimpleSourceOption("p2p", true);
    updatePeerUrlStatus("Enter the consenting peer URL once, then use P2P Import.", false);
    holdModelPopoverOpen(4000);
  }

  async function startP2pImportOrRequestPeer(entry) {
    if (canStartP2pImport(entry)) {
      await startCompanionImport(entry);
      return;
    }
    requestKnownPeerForEntry(entry);
  }

  function hfP2pImportMatch(matches) {
    if (state.p2pEnabled === false) {
      return null;
    }
    return matches.find((match) => canStartP2pImport(match)) || null;
  }

  function peerImportFileStem(modelId) {
    return conversionFileStem(modelId || "minimodel-peer-import");
  }

  function peerImportRequest(match, peerBaseUrl = state.peerBaseUrl) {
    const normalizedPeerUrl = p2pImportBaseUrl(match, peerBaseUrl);
    if (!normalizedPeerUrl) {
      throw new Error("Set a known consenting peer URL before starting P2P Import.");
    }
    return {
      request_kind: "minimodel.peer_import_request.v0",
      request_version: 0,
      model: {
        model_id: match.modelId,
        artifact_kind: match.artifactKind,
        artifact_byte_count: match.artifactByteCount,
        artifact_sha256: match.artifactSha256
      },
      local_peer_piece_contract: {
        expected_piece_set_kind: "minimodel.peer_piece_set.v0",
        expected_peer_base_url: normalizedPeerUrl,
        expected_piece_dir: `${peerImportFileStem(match.modelId)}-peer-pieces`,
        assembled_output_slm: match.fileNameHint,
        metadata_routes: {
          peer_status: "minimodel.peer_status.v0.json",
          peer_piece_set: "minimodel.peer_piece_set.v0",
          peer_companion_state: "minimodel.peer_companion_state.v0.json"
        },
        receiver_validation_contract: {
          check_peer_status_before_piece_fetch: true,
          preflight_fetches_piece_set_before_pieces: true,
          validate_advertised_companion_state_before_piece_fetch: true,
          import_receipt_required_before_browser_load: true
        }
      },
      boundary: {
        project_server_serves_model_bytes: false,
        project_server_runs_model_bytes: false,
        project_server_proxies_huggingface_bytes: false,
        transfer_requires_user_consent_and_local_reverify: true
      }
    };
  }

  function hfCountText(value, unit) {
    return Number.isFinite(value) ? `${value} ${unit}` : `${unit} unavailable`;
  }

  function hfResultView(entry) {
    const matches = hfP2pMatches(entry.modelId);
    const slmFiles = hfSlmSiblings(entry.result);
    const safetensorsFiles = hfSafetensorsSiblings(entry.result);
    const ggufFiles = hfGgufSiblings(entry.result);
    return {
      entry,
      matches,
      slmFiles,
      safetensorsFiles,
      ggufFiles,
      hasPeerOffer: matches.some((match) => Boolean(match.peerOfferRoute)),
      peerOfferMatch: firstPeerOfferMatch(matches),
      p2pMatch: hfP2pImportMatch(matches),
      downloads: hfCountText(entry.result.downloads, "downloads"),
      likes: hfCountText(entry.result.likes, "likes")
    };
  }

  function hfCanStartConversion(view) {
    return Boolean(
      view &&
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

  function hfPrimarySafetensorsFile(view) {
    return view && Array.isArray(view.safetensorsFiles) && view.safetensorsFiles.length
      ? view.safetensorsFiles[0]
      : null;
  }

  function hfPrimaryGgufFile(view) {
    return view && Array.isArray(view.ggufFiles) && view.ggufFiles.length
      ? view.ggufFiles[0]
      : null;
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

  function hfConversionSummaryLabel() {
    return "Local conversion fallback";
  }

  function hfCompatibilityClass(view) {
    return view.matches.length || view.slmFiles.length
      ? "compatibility-pill candidate"
      : "compatibility-pill convert";
  }

  function hfAdvancedStatusText(view) {
    if (view.matches.length) {
      return view.p2pMatch
        ? "P2P available"
        : view.hasPeerOffer
          ? "P2P proof ready; peer URL required"
        : "Catalog match, local .slm needed";
    }
    if (view.slmFiles.length) {
      return "External .slm listed, verify locally";
    }
    if (!hfCanStartConversion(view)) {
      return "No supported source listed";
    }
    if (hfSourceByteRisk(view) === "large") {
      return "Large source; P2P preferred";
    }
    if (hfSourceByteRisk(view) === "unknown") {
      return "Source size unknown";
    }
    return "Converts locally";
  }

  function hfAdvancedMetaText(view) {
    const sourceState = view.matches.length
      ? view.p2pMatch
        ? "MiniModel metadata lists a peer source; Rust must fetch, assemble, and reverify before import"
        : view.hasPeerOffer
          ? "MiniModel metadata has a peer-offer proof; enter a consenting peer URL before Rust fetches, assembles, and reverifies"
        : "MiniModel metadata only; choose the matching local .slm before running"
      : hfCanStartConversion(view)
        ? hfPreferredSourceFormat(view) === "gguf"
          ? "model card only; GGUF source listed, Rust can convert F32/F16/BF16/Q2_K/Q3_K/Q4_0/Q4_1/Q4_K/Q5_0/Q5_1/Q5_K/Q6_K/Q8_0/Q8_1/Q8_K tensors after local review"
          : hfSourceByteRisk(view) === "large"
            ? "model card only; large source listed, so P2P reuse is preferred before local conversion"
            : hfSourceByteRisk(view) === "unknown"
              ? "model card only; source size unknown, so review before local conversion"
              : "model card only; not runnable here until Rust conversion and local .slm verification"
        : "model card only; no .safetensors or reviewable .gguf source listed for the Rust converter";
    return `${view.downloads} / ${view.likes} / ${sourceState}`;
  }

  function hfSimpleMetaText(view) {
    if (view.matches.length) {
      if (state.p2pEnabled === false) {
        return `Hugging Face model card / ${view.downloads} / P2P disabled; local conversion path selected`;
      }
      if (view.p2pMatch) {
        return `Hugging Face model card / ${view.downloads} / P2P source listed; Rust reverify required`;
      }
      return `Hugging Face model card / ${view.downloads} / ${view.hasPeerOffer ? "P2P proof ready; consenting peer URL required" : "MiniModel metadata found; local .slm needed"}`;
    }
    if (!hfCanStartConversion(view)) {
      return `Hugging Face model card / ${view.downloads} / no supported .safetensors or reviewable .gguf source listed`;
    }
    if (hfPreferredSourceFormat(view) === "gguf") {
      return `Hugging Face model card / ${view.downloads} / GGUF source listed; Rust tensor review required`;
    }
    if (hfSourceByteRisk(view) === "large") {
      return `Hugging Face model card / ${view.downloads} / large source listed; P2P preferred before local conversion`;
    }
    if (hfSourceByteRisk(view) === "unknown") {
      return `Hugging Face model card / ${view.downloads} / source size unknown; review before local conversion`;
    }
    return `Hugging Face model card / ${view.downloads} / Get model converts the pinned source locally`;
  }

  function hfSimpleCompatibilityText(view) {
    if (view.p2pMatch) {
      return "P2P available";
    }
    if (view.matches.length && state.p2pEnabled === false) {
      return hfCanStartConversion(view) ? "Private conversion" : "Local .slm needed";
    }
    if (view.matches.length) {
      return view.hasPeerOffer
        ? "P2P proof ready"
        : "Catalog match, local .slm needed";
    }
    if (view.slmFiles.length) {
      return "External .slm listed, verify locally";
    }
    if (!hfCanStartConversion(view)) {
      return "No supported source listed";
    }
    if (hfSourceByteRisk(view) === "large") {
      return "Large source; P2P preferred";
    }
    if (hfSourceByteRisk(view) === "unknown") {
      return "Source size unknown";
    }
    return "Converts locally";
  }

  function hfSimpleFallbackNote(view) {
    if (view.p2pMatch) {
      return "Already converted by a verified peer. Get model imports and reverifies it through the local companion.";
    }
    if (view.matches.length && state.p2pEnabled === false) {
      return "The local companion can convert and validate this model without publishing it.";
    }
    if (view.hasPeerOffer) {
      return "MiniModel has a peer-offer proof. Enter one consenting peer URL in P2P Exchange to import without repeating source conversion.";
    }
    if (!hfCanStartConversion(view)) {
      return "No converted peer, .safetensors source, or reviewable .gguf source is listed yet. Review the model card before choosing a local conversion path.";
    }
    if (hfPreferredSourceFormat(view) === "gguf") {
      return "This GGUF is visible for model-card review, but automatic acquisition requires a supported immutable safetensors source or a complete verified P2P copy.";
    }
    if (hfSourceByteRisk(view) === "large") {
      const size = hfSourceByteSummaryText(view);
      return `Large source listed (${size}). Prefer a MiniModel P2P import when available; local conversion should be an explicit reviewed choice because it may require a large Hugging Face download.`;
    }
    if (hfSourceByteRisk(view) === "unknown") {
      return "Source size is unavailable from metadata. Review the model card before local conversion; P2P reuse is preferred when a verified peer entry appears.";
    }
    return "Get model asks the paired companion to download the pinned source revision, convert it, validate the .slm and activation graph, and load both into this browser.";
  }

  function appendHfSlmFileNotes(actions, slmFiles, actionWord) {
    for (const fileName of slmFiles) {
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        `${safeLocalModelName(fileName)} is listed externally; ${actionWord} only after local review and Rust validation.`
      ));
    }
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
        `Large source warning: ${size}. Prefer P2P reuse if a verified peer becomes available; local conversion is explicit and may take a while.`
      ));
    } else if (risk === "unknown") {
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        "Source size unavailable in metadata. Review before local conversion; prefer P2P reuse when available."
      ));
    }
  }

  function appendHfSourceFileNotes(actions, view, options = {}) {
    if (view.slmFiles.length) {
      appendHfSlmFileNotes(actions, view.slmFiles, options.slmActionWord || "import");
      return;
    }
    const noSlmText = options.noSlmText || "No compatible .slm is available to this app yet.";
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

  function hfEnabledP2pActionMatch(view) {
    if (state.p2pEnabled === false) {
      return null;
    }
    return view.p2pMatch || view.peerOfferMatch || null;
  }

  function appendHfAdvancedActions(actions, entry, view) {
    actions.append(externalActionLink("Review Model Card", hfModelUrl(entry.modelId)));
    if (view.p2pMatch || hfCanStartConversion(view)) {
      actions.append(actionButton("Get model", () => getHfModel(entry), "primary-result-action"));
    }
    if (view.matches.length) {
      for (const match of view.matches.slice(0, 2)) {
        actions.append(actionButton("Use MiniModel Metadata", () => selectCatalogEntry(match)));
      }
      return;
    }
    if (!hfCanStartConversion(view)) {
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        "No verified P2P copy or supported Rust conversion path is available."
      ));
    }
  }

  function appendHfSimpleActions(actions, entry, view) {
    actions.append(externalActionLink("Review Model Card", hfModelUrl(entry.modelId)));
    actions.append(elementWithText("span", hfCompatibilityClass(view), hfSimpleCompatibilityText(view)));
    if (!view.p2pMatch && !hfCanStartConversion(view)) {
      return;
    }
    actions.append(actionButton("Get model", () => getHfModel(entry), "primary-result-action"));
  }

  async function ensureDefaultCatalogForHfAvailability() {
    if (state.p2pEnabled === false) {
      return;
    }
    if (state.catalogEntries.length || state.defaultCatalogCheckedForAvailability) {
      return;
    }
    state.defaultCatalogCheckedForAvailability = true;
    try {
      const response = await fetch(defaultCatalogUrl, {
        cache: "no-store",
        credentials: "omit"
      });
      if (!response.ok) {
        return;
      }
      const text = await response.text();
      if (state.encoder.encode(text).length > catalogTextByteBudget) {
        return;
      }
      const body = JSON.parse(text);
      const announcementRoutes = catalogAnnouncementRoutesFromBody(body, defaultCatalogUrl);
      state.catalogEntries = catalogEntriesFromBody(body, "MiniModel.org", defaultCatalogUrl);
      if (announcementRoutes.length) {
        try {
          const routeResult = await applyCatalogAnnouncementRoutes(announcementRoutes);
          setCatalogStatus(`${state.catalogEntries.length} metadata entries; ${catalogAnnouncementRouteStatusText(routeResult)}`, false);
        } catch (error) {
          // Keep the base proof-ready metadata, but fail closed on optional peer sources.
          const message = error && error.message ? error.message : "peer-source announcement metadata unavailable";
          setCatalogStatus(`${state.catalogEntries.length} metadata entries; peer-source announcement feed ignored: ${message}`, true);
        }
      } else {
        setCatalogStatus(`${state.catalogEntries.length} metadata entries`, false);
      }
    } catch (_error) {
      state.catalogEntries = [];
    }
  }

  function supportedSourceShapes() {
    return [
      "tiny-fixture",
      "tiny-fixture-tied",
      "tiny-fixture-bpe",
      "tinylm16",
      "tinylm16-tied",
      "tinylm16-bpe",
      "stories15m-bpe",
      "smollm2-135m-instruct-bpe",
      "smollm2-360m-instruct-bpe",
      "qwen3-0.6b-bpe",
      "qwen2.5-1.5b-bpe"
    ];
  }

  function hfDefaultSourceShape(modelId) {
    const normalized = String(modelId || "").toLowerCase();
    if (
      normalized === "xenova/llama2.c-stories15m" ||
      normalized === "modelcloud/tinyllama-15m-stories"
    ) {
      return "stories15m-bpe";
    }
    if (normalized === "huggingfacetb/smollm2-135m-instruct") {
      return "smollm2-135m-instruct-bpe";
    }
    if (normalized === "huggingfacetb/smollm2-360m-instruct") {
      return "smollm2-360m-instruct-bpe";
    }
    if (normalized === "qwen/qwen3-0.6b") {
      return "qwen3-0.6b-bpe";
    }
    if (normalized === "qwen/qwen2.5-1.5b-instruct") {
      return "qwen2.5-1.5b-bpe";
    }
    return "";
  }

  function hfDefaultQuantization(modelId) {
    const normalized = String(modelId || "").toLowerCase();
    if (normalized === "qwen/qwen2.5-1.5b-instruct") {
      return "q4_0";
    }
    return "q8_0";
  }

  function conversionFileStem(modelId) {
    const stem = String(modelId || "huggingface-model")
      .replace(/[\\/]+/g, "__")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
    return stem || "huggingface-model";
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
    renderSimpleHfResults(accepted);
  }

  function pluralCount(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function hfAvailabilityCounts(accepted) {
    const summary = {
      p2pReady: 0,
      peerUrlNeeded: 0,
      localSlmNeeded: 0,
      externalSlmListed: 0,
      conversionNeeded: 0,
      largeSourceReview: 0,
      unknownSourceReview: 0,
      noSupportedSource: 0
    };
    for (const entry of accepted) {
      const view = hfResultView(entry);
      if (view.p2pMatch) {
        summary.p2pReady += 1;
      } else if (view.hasPeerOffer && state.p2pEnabled !== false) {
        summary.peerUrlNeeded += 1;
      } else if (view.matches.length) {
        summary.localSlmNeeded += 1;
      } else if (view.slmFiles.length) {
        summary.externalSlmListed += 1;
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
      parts.push(pluralCount(summary.p2pReady, "P2P-ready match"));
    }
    if (summary.peerUrlNeeded) {
      parts.push(`${pluralCount(summary.peerUrlNeeded, "proof-ready match", "proof-ready matches")} ${summary.peerUrlNeeded === 1 ? "needs" : "need"} peer URL`);
    }
    if (summary.localSlmNeeded) {
      parts.push(`${pluralCount(summary.localSlmNeeded, "metadata match", "metadata matches")} ${summary.localSlmNeeded === 1 ? "needs" : "need"} local .slm`);
    }
    if (summary.externalSlmListed) {
      parts.push(`${pluralCount(summary.externalSlmListed, "external .slm listing")} ${summary.externalSlmListed === 1 ? "needs" : "need"} local review`);
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
    if (state.p2pEnabled === false) {
      parts.push("P2P off");
    }
    return parts.join(" / ");
  }

  function appendFlowSummaryChip(parent, label, value, tone = "") {
    const chip = document.createElement("span");
    chip.className = `source-flow-chip${tone ? ` ${tone}` : ""}`;
    chip.append(
      elementWithText("strong", "", label),
      elementWithText("small", "", value)
    );
    parent.append(chip);
  }

  function renderSimpleHfFlowSummary(accepted) {
    if (!el.simpleHfFlowSummary) {
      return;
    }
    el.simpleHfFlowSummary.replaceChildren();
    if (!accepted.length) {
      el.simpleHfFlowSummary.hidden = true;
      return;
    }
    const counts = hfAvailabilityCounts(accepted);
    const header = elementWithText("div", "source-flow-summary-header", "Search summary");
    const chips = elementWithText("div", "source-flow-chip-row", "");
    if (counts.p2pReady) {
      appendFlowSummaryChip(chips, "P2P Import", pluralCount(counts.p2pReady, "ready match"), "ready");
    }
    if (counts.peerUrlNeeded) {
      appendFlowSummaryChip(chips, "Set Peer URL", pluralCount(counts.peerUrlNeeded, "proof-ready match", "proof-ready matches"), "peer-needed");
    }
    if (counts.conversionNeeded) {
      appendFlowSummaryChip(chips, hfConversionSummaryLabel(), pluralCount(counts.conversionNeeded, "source-backed model"), "convert");
    }
    if (counts.largeSourceReview || counts.unknownSourceReview) {
      appendFlowSummaryChip(
        chips,
        "Review First",
        pluralCount(counts.largeSourceReview + counts.unknownSourceReview, "source"),
        "review"
      );
    }
    if (counts.localSlmNeeded || counts.externalSlmListed) {
      appendFlowSummaryChip(
        chips,
        "Local .slm",
        pluralCount(counts.localSlmNeeded + counts.externalSlmListed, "metadata match", "metadata matches"),
        "local"
      );
    }
    if (counts.noSupportedSource) {
      appendFlowSummaryChip(chips, "No Source", pluralCount(counts.noSupportedSource, "model"), "blocked");
    }
    if (state.p2pEnabled === false) {
      appendFlowSummaryChip(chips, "P2P Off", "private .slm now; P2P later", "blocked");
    }
    const note = elementWithText(
      "p",
      "source-flow-summary-note",
      "Get model uses a complete verified P2P copy when available; otherwise the local companion pins and converts the source revision."
    );
    el.simpleHfFlowSummary.append(header, chips, note);
    el.simpleHfFlowSummary.hidden = false;
  }

  function refreshHfResultsForCatalogChange() {
    if (state.hfLastAccepted && state.hfLastAccepted.length) {
      renderAcceptedHfResults(state.hfLastAccepted);
    }
  }

  function hfResultActionRank(entry) {
    const view = hfResultView(entry);
    if (view.p2pMatch) {
      return 700;
    }
    if (view.hasPeerOffer) {
      return 650;
    }
    if (view.matches.length) {
      return 600;
    }
    if (view.slmFiles.length) {
      return 500;
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
    if (el.simpleHfSortSelect) {
      return normalizeHfBrowseSort(el.simpleHfSortSelect.value);
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
          ? `no TinyRustLM-ready candidates found after scanning ${results.length} ${options.sortLabel || "Hugging Face"} model cards`
          : "no model records returned",
        false
      );
      return;
    }
    renderAcceptedHfResults(accepted);
    if (options.viableOnly) {
      setHfStatus(
        `${accepted.length} of up to ${hfBrowseLimit} TinyRustLM-ready candidates from ${results.length} scanned ${options.sortLabel || "Hugging Face"} model cards; ${hfAvailabilitySummary(accepted)}; local .slm verification required`,
        false
      );
      return;
    }
    setHfStatus(`${hfAvailabilitySummary(accepted)}; local .slm verification required`, false);
  }

  function renderSimpleHfResults(accepted) {
    if (!el.simpleHfResults) {
      return;
    }
    renderSimpleHfFlowSummary(accepted);
    el.simpleHfResults.replaceChildren();
    for (const entry of accepted) {
      const view = hfResultView(entry);
      const item = modelResultItem(entry.modelId);
      const meta = elementWithText("div", "model-result-meta", hfSimpleMetaText(view));
      const actions = elementWithText("div", "model-result-actions", "");
      appendHfSimpleActions(actions, entry, view);
      appendHfSourceFileNotes(actions, view, {
        slmActionWord: "use it",
        noSlmText: hfSimpleFallbackNote(view)
      });
      item.append(meta, actions);
      el.simpleHfResults.append(item);
    }
  }

  function revealFirstSimpleHfResult() {
    if (!el.simpleDiscoveryPanel || !el.simpleHfResults) {
      return;
    }
    requestAnimationFrame(() => {
      const firstResult = el.simpleHfResults.querySelector("li");
      if (!firstResult || el.simpleDiscoveryPanel.hidden) {
        return;
      }
      const panelRect = el.simpleDiscoveryPanel.getBoundingClientRect();
      const controls = el.simpleDiscoveryPanel.querySelector(".source-search-controls");
      const controlsRect = controls ? controls.getBoundingClientRect() : null;
      const resultRect = firstResult.getBoundingClientRect();
      const visibleTop = Math.max(panelRect.top + 8, controlsRect ? controlsRect.bottom + 8 : panelRect.top + 8);
      const visibleBottom = Math.min(panelRect.bottom - 8, window.innerHeight - 8);
      if (resultRect.top < visibleTop || resultRect.bottom > visibleBottom) {
        el.simpleDiscoveryPanel.scrollTop += resultRect.top - visibleTop;
      }
    });
  }

  async function searchHuggingFaceModels(options = {}) {
    const keepSimplePopover = Boolean(options.keepSimplePopover);
    if (keepSimplePopover) {
      setSimpleSourceOption("huggingface", true);
      holdModelPopoverOpen(5000);
    }
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
        ? `finding up to ${hfBrowseLimit} TinyRustLM-ready candidates from top ${hfBrowseApiLimit} ${sortMode.label} model-card metadata`
        : "searching model-card metadata",
      false
    );
    const controller = new AbortController();
    state.hfSearchAbort = controller;
    const catalogAvailability = ensureDefaultCatalogForHfAvailability();
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
    await catalogAvailability;
    renderHfResults(results, {
      viableOnly: browseMode,
      limit: browseMode ? hfBrowseLimit : hfSearchLimit,
      order: browseMode ? sortKey : "actionable",
      sortLabel: sortMode.label
    });
    if (keepSimplePopover) {
      holdModelPopoverOpen(3000);
      revealFirstSimpleHfResult();
    }
  }

  function isSafeRegistryModelPath(value) {
    if (!value || !value.startsWith("../models/") || !value.endsWith(".slm")) {
      return false;
    }
    if (value.includes("\\") || value.includes("://") || value.includes("//")) {
      return false;
    }
    const rest = value.slice("../models/".length);
    return rest.split("/").every((part) => part && part !== "." && part !== "..");
  }

  function isSafeEvidencePath(value) {
    if (!value || !value.startsWith("../evidence/")) {
      return false;
    }
    if (value.includes("\\") || value.includes("://") || value.includes("//")) {
      return false;
    }
    const rest = value.slice("../evidence/".length);
    return rest.split("/").every((part) => part && part !== "." && part !== "..");
  }

  function isSafeRegistrySourceManifestPath(candidateId, value) {
    if (!isRegistrySlug(candidateId)) {
      return false;
    }
    const expected = `../evidence/${candidateId}/converted-trained.source.manifest`;
    if (value !== expected) {
      return false;
    }
    return isSafeEvidencePath(value);
  }

  function isSafeRegistrySourceReviewPath(candidateId, value) {
    if (!isRegistrySlug(candidateId)) {
      return false;
    }
    const expected = `../evidence/${candidateId}/converted-trained.source.review`;
    if (value !== expected) {
      return false;
    }
    return isSafeEvidencePath(value);
  }

  function isSafeRegistrySourceValidationPath(candidateId, value) {
    if (!isRegistrySlug(candidateId)) {
      return false;
    }
    const expected = `../evidence/${candidateId}/converted-trained.source.validation`;
    if (value !== expected) {
      return false;
    }
    return isSafeEvidencePath(value);
  }

  function isSafeRegistryAdmissionPath(candidateId, value) {
    if (!isRegistrySlug(candidateId)) {
      return false;
    }
    const expected = `../evidence/${candidateId}/converted-trained.admission`;
    if (value !== expected) {
      return false;
    }
    return isSafeEvidencePath(value);
  }

  function isSafeRegistryEvalEvidencePath(candidateId, value) {
    if (!isRegistrySlug(candidateId)) {
      return false;
    }
    const expected = `../evidence/${candidateId}/converted-trained.eval`;
    if (value !== expected) {
      return false;
    }
    return isSafeEvidencePath(value);
  }

  function isSafeRegistryRuntimeSmokePath(candidateId, value) {
    if (!isRegistrySlug(candidateId)) {
      return false;
    }
    const expected = `../evidence/${candidateId}/converted-trained.runtime`;
    if (value !== expected) {
      return false;
    }
    return isSafeEvidencePath(value);
  }

  function isRegistryHex64(value) {
    return /^0x[0-9a-fA-F]{16}$/.test(value || "");
  }

  function isRegistrySha256(value) {
    return /^sha256:[0-9a-f]{64}$/.test(value || "");
  }

  function isRegistryTypedContentId(value, prefix) {
    const text = String(value || "");
    if (!text.startsWith(prefix)) {
      return false;
    }
    const digest = text.slice(prefix.length);
    return /^[0-9a-f]{64}$/.test(digest) && !/^0{64}$/.test(digest);
  }

  function isSourceModelSha(value) {
    const text = String(value || "");
    if (/^sha256:[0-9a-f]{64}$/i.test(text) || /^sha1:[0-9a-f]{40}$/i.test(text)) {
      return true;
    }
    return /^[0-9a-f]{40}$/i.test(text) || /^[0-9a-f]{64}$/i.test(text);
  }

  function isRegistrySlug(value) {
    return /^[A-Za-z0-9._-]{1,96}$/.test(value || "");
  }

  function rotateLeft64(value, bits) {
    return ((value << bits) | (value >> (64n - bits))) & checksumMask;
  }

  function textChecksumHex(text) {
    const bytes = state.encoder.encode(text);
    return bytesChecksumHex(bytes);
  }

  function evalCaseEvidenceChecksum(fields) {
    // Replays the Rust eval-case evidence digest over fetched sidecar case rows.
    const caseCount = registryDecimalCount(fields.case_count);
    if (caseCount === null) {
      throw new Error("eval evidence case_count mismatch");
    }
    const lines = [];
    for (const key of [
      "fixed_case_count",
      "holdout_case_count",
      "holdout_seed",
      "case_count",
      "cases_passed",
      "cases_failed"
    ]) {
      if (fields[key]) {
        lines.push(`${key}=${fields[key]}`);
      } else if (key === "case_count" || key === "cases_passed" || key === "cases_failed") {
        lines.push(`${key}=${requireManifestField(fields, key, "eval evidence")}`);
      }
    }
    for (let index = 0; index < caseCount; index += 1) {
      const prefix = `case.${index}`;
      for (const suffix of ["status", "expected", "actual", "error"]) {
        const key = `${prefix}.${suffix}`;
        lines.push(`${key}=${requireManifestField(fields, key, "eval evidence")}`);
      }
      for (const suffix of [
        "prompt",
        "origin",
        "runtime_prompt",
        "max_new_tokens",
        "required_result",
        "output_format",
        "required_json_keys",
        "quality_failures",
        "diagnostics"
      ]) {
        const key = `${prefix}.${suffix}`;
        if (fields[key]) {
          lines.push(`${key}=${fields[key]}`);
        }
      }
    }
    return textChecksumHex(`${lines.join("\n")}\n`);
  }

  function bytesChecksumHex(bytes) {
    let acc = 0x4d595df4d0f33173n;
    for (let index = 0; index < bytes.length; index += 1) {
      acc ^= BigInt(bytes[index]) + (BigInt(index) << 2n);
      acc = (rotateLeft64(acc, 9n) * checksumPrime) & checksumMask;
    }
    return `0x${acc.toString(16).padStart(16, "0")}`;
  }

  function requireManifestField(fields, key, source) {
    const value = fields[key];
    if (!value) {
      throw new Error(`Missing ${source || "receipt"} field ${key}`);
    }
    return value;
  }

  function requireManifestEqual(fields, key, expected, source) {
    const actual = requireManifestField(fields, key, source ? source.toLowerCase() : undefined);
    if (actual !== expected) {
      throw new Error(`${source || "Receipt"} field ${key} was ${actual}`);
    }
  }

  function requireManifestOneOf(fields, key, expectedValues, source) {
    const actual = requireManifestField(fields, key, source ? source.toLowerCase() : undefined);
    if (!expectedValues.includes(actual)) {
      throw new Error(`${source || "Receipt"} field ${key} was ${actual}`);
    }
  }

  // Validates 64-bit checksum text before using a manifest field as a route contract.
  function requireHex64ManifestField(fields, key, source) {
    const actual = requireManifestField(fields, key, source ? source.toLowerCase() : undefined);
    if (!isRegistryHex64(actual)) {
      throw new Error(`${source || "Receipt"} field ${key} was ${actual}`);
    }
    return actual;
  }

  function requireSourceModelShaManifestField(fields, key, source) {
    const actual = requireManifestField(fields, key, source ? source.toLowerCase() : undefined);
    if (!isSourceModelSha(actual)) {
      throw new Error(`${source || "Receipt"} field ${key} was ${actual}`);
    }
    return actual;
  }

  function requireOptionalSourceReviewArtifact(fields, prefix) {
    // Validates optional candidate-review artifact rows before showing them in provenance.
    const status = fields[`${prefix}_artifact_status`];
    if (!status) {
      return null;
    }
    const kind = requireManifestField(fields, `${prefix}_artifact_kind`, "source review artifact");
    const checksum = requireManifestField(fields, `${prefix}_artifact_checksum`, "source review artifact");
    const bytesText = requireManifestField(fields, `${prefix}_artifact_bytes`, "source review artifact");
    const detail = requireManifestField(fields, `${prefix}_artifact_detail`, "source review artifact");
    if (status === "not-local") {
      for (const [label, value] of [["kind", kind], ["checksum", checksum], ["bytes", bytesText], ["detail", detail]]) {
        if (value !== "not-local") {
          throw new Error(`source review artifact ${prefix} ${label} was ${value}`);
        }
      }
      return { status, kind, checksum, bytesText, detail };
    }
    if (!/^[a-z0-9._-]+$/.test(status) || !/^[a-z0-9._-]+$/.test(kind)) {
      throw new Error(`source review artifact ${prefix} identity was invalid`);
    }
    if (!isRegistryHex64(checksum)) {
      throw new Error(`source review artifact ${prefix} checksum was ${checksum}`);
    }
    if (registryDecimalCount(bytesText) === null) {
      throw new Error(`source review artifact ${prefix} bytes was ${bytesText}`);
    }
    if (!detail || detail.includes("\n") || detail.includes("\r")) {
      throw new Error(`source review artifact ${prefix} detail was invalid`);
    }
    return { status, kind, checksum, bytesText, detail };
  }

  function requireSourceReviewTokenizerImport(fields) {
    // Binds imported tokenizer rows to the fetched source-review sidecar.
    const status = requireManifestField(fields, "source_tokenizer_import_status", "source review");
    const tokenCountText = requireManifestField(fields, "source_tokenizer_import_token_count", "source review");
    const mergeCountText = requireManifestField(fields, "source_tokenizer_import_merge_count", "source review");
    const checksum = requireHex64ManifestField(fields, "source_tokenizer_import_checksum", "source review");
    const tokenCount = registryDecimalIndex(tokenCountText);
    const mergeCount = registryDecimalIndex(mergeCountText);
    if (tokenCount === null || mergeCount === null) {
      throw new Error(`source review tokenizer import counts were ${tokenCountText}/${mergeCountText}`);
    }
    if (status === "not-imported") {
      if (tokenCount !== 0 || mergeCount !== 0 || checksum !== "0x0000000000000000") {
        throw new Error("source review tokenizer import not-imported row had imported evidence");
      }
      return { status, tokenCount, mergeCount, checksum };
    }
    if (status !== "byte-fallback-bpe-compatible") {
      throw new Error(`source review tokenizer import status was ${status}`);
    }
    if (tokenCount < 1 || mergeCount < 1 || checksum === "0x0000000000000000") {
      throw new Error("source review tokenizer import compatible row was empty");
    }
    return { status, tokenCount, mergeCount, checksum };
  }

  function requireChecksumEqual(actual, expected, label) {
    if (!isRegistryHex64(actual) || actual.toLowerCase() !== String(expected || "").toLowerCase()) {
      throw new Error(`${label} checksum mismatch`);
    }
  }

  // Maps a receipt operator kind to the exact schedule family fields the browser accepts.
  function expectedEvolutionScheduleFamily(operatorKind) {
    if (operatorKind === "seed-weighted-parent-pool-soup") {
      return {
        familyIndex: 1,
        familyCommand: "soup-candidate",
        familySelectionRule: "seed-weighted-direct-parameter-average",
        familyOutputGate: "candidate-manifest-plus-runtime-smoke-plus-eval"
      };
    }
    if (operatorKind === "sign-aware-parent-pool-merge") {
      return {
        familyIndex: 0,
        familyCommand: "sign-merge-candidate",
        familySelectionRule: "seed-weighted-delta-sign-consensus",
        familyOutputGate: "candidate-manifest-plus-runtime-smoke-plus-eval"
      };
    }
    return null;
  }

  // Reads selector genome routing fields before a registry entry can become selectable.
  function registryGenomeEntry(fields, prefix) {
    const genomeId = fields[`${prefix}.genome_id`];
    const strategy = fields[`${prefix}.genome_strategy`];
    const lineageStatus = fields[`${prefix}.genome_lineage_status`];
    const lineageChecksum = fields[`${prefix}.genome_lineage_checksum`];
    if (
      !isRegistryHex64(genomeId) ||
      strategy !== registryGenomeStrategy ||
      lineageStatus !== registryGenomeLineageStatus ||
      !isRegistryHex64(lineageChecksum)
    ) {
      return null;
    }
    return {
      id: genomeId,
      strategy,
      lineageStatus,
      lineageChecksum
    };
  }

  // Reads selector species-fit fields that group candidates by browser-compatible traits.
  function registrySpeciesEntry(fields, prefix) {
    const speciesId = fields[`${prefix}.species_id`];
    const strategy = fields[`${prefix}.species_strategy`];
    const fitStatus = fields[`${prefix}.species_fit_status`];
    const fitChecksum = fields[`${prefix}.species_fit_checksum`];
    if (
      !isRegistryHex64(speciesId) ||
      strategy !== registrySpeciesStrategy ||
      fitStatus !== registrySpeciesFitStatus ||
      !isRegistryHex64(fitChecksum)
    ) {
      return null;
    }
    return {
      id: speciesId,
      strategy,
      fitStatus,
      fitChecksum
    };
  }

  // Reads selector novelty sketches that preserve behavior variety across candidates.
  function registryNoveltyEntry(fields, prefix) {
    const noveltyId = fields[`${prefix}.novelty_id`];
    const strategy = fields[`${prefix}.novelty_strategy`];
    const status = fields[`${prefix}.novelty_status`];
    const checksum = fields[`${prefix}.novelty_checksum`];
    if (
      !isRegistryHex64(noveltyId) ||
      strategy !== registryNoveltyStrategy ||
      status !== registryNoveltyStatus ||
      !isRegistryHex64(checksum)
    ) {
      return null;
    }
    return {
      id: noveltyId,
      strategy,
      status,
      checksum
    };
  }

  // Reads selector population review routes that connect candidates to population context.
  function registryPopulationEntry(fields, prefix) {
    const populationId = fields[`${prefix}.population_id`];
    const strategy = fields[`${prefix}.population_strategy`];
    const status = fields[`${prefix}.population_status`];
    const checksum = fields[`${prefix}.population_checksum`];
    if (
      !isRegistryHex64(populationId) ||
      strategy !== registryPopulationStrategy ||
      status !== registryPopulationStatus ||
      !isRegistryHex64(checksum)
    ) {
      return null;
    }
    return {
      id: populationId,
      strategy,
      status,
      checksum
    };
  }

  // Reads selector mate-selection routes that bind parent-pool recipes to provenance.
  function registryMateSelectionEntry(fields, prefix) {
    const mateSelectionId = fields[`${prefix}.mate_selection_id`];
    const strategy = fields[`${prefix}.mate_selection_strategy`];
    const status = fields[`${prefix}.mate_selection_status`];
    const parentCount = registryDecimalByteCount(fields[`${prefix}.mate_selection_parent_count`]);
    const checksum = fields[`${prefix}.mate_selection_checksum`];
    const isKnownStatus =
      status === registryMateSelectionParentPoolStatus ||
      status === registryMateSelectionAdmissionStatus;
    if (
      !isRegistryHex64(mateSelectionId) ||
      strategy !== registryMateSelectionStrategy ||
      !isKnownStatus ||
      parentCount === null ||
      !isRegistryHex64(checksum)
    ) {
      return null;
    }
    if (status === registryMateSelectionParentPoolStatus && parentCount < 2) {
      return null;
    }
    if (status === registryMateSelectionAdmissionStatus && parentCount !== 1) {
      return null;
    }
    return {
      id: mateSelectionId,
      strategy,
      status,
      parentCount,
      checksum
    };
  }

  // Reads copied operator receipt metadata and checks generated route kind agreement.
  function registryOperatorReceiptEntry(fields, prefix, modelBytes, slmChecksum) {
    const suffixes = [
      "operator_receipt_status",
      "operator_receipt_path",
      "operator_receipt_checksum",
      "operator_receipt_operator_id",
      "operator_receipt_operator_kind",
      "operator_receipt_candidate_slm_checksum",
      "operator_receipt_candidate_artifact_bytes"
    ];
    const hasReceiptField = suffixes.some((suffix) => fields[`${prefix}.${suffix}`] !== undefined);
    if (!hasReceiptField) {
      return undefined;
    }
    const status = fields[`${prefix}.operator_receipt_status`];
    const path = fields[`${prefix}.operator_receipt_path`];
    const checksum = fields[`${prefix}.operator_receipt_checksum`];
    const operatorId = fields[`${prefix}.operator_receipt_operator_id`];
    const operatorKind = fields[`${prefix}.operator_receipt_operator_kind`];
    const candidateSlmChecksum = fields[`${prefix}.operator_receipt_candidate_slm_checksum`];
    const candidateArtifactBytes = registryDecimalByteCount(
      fields[`${prefix}.operator_receipt_candidate_artifact_bytes`]
    );
    if (
      status !== registryOperatorReceiptStatus ||
      !path ||
      !isRegistryHex64(checksum) ||
      !operatorId ||
      !operatorKind ||
      candidateSlmChecksum !== slmChecksum ||
      candidateArtifactBytes !== modelBytes
    ) {
      return null;
    }
    return {
      status,
      path,
      checksum,
      operatorId,
      operatorKind,
      candidateSlmChecksum,
      candidateArtifactBytes
    };
  }

  // Reads copied parent-pool schedule metadata and binds it to the accepted operator receipt.
  function registryEvolutionScheduleEntry(fields, prefix, operatorReceipt) {
    const suffixes = [
      "evolution_recipe_version",
      "evolution_recipe_strategy",
      "evolution_recipe_status",
      "evolution_selection_source",
      "evolution_relatedness_contract_checksum",
      "evolution_schedule_checksum_algorithm",
      "evolution_schedule_checksum",
      "scheduled_operator_family_index",
      "scheduled_operator_family_kind",
      "scheduled_operator_family_command",
      "scheduled_operator_family_selection_rule",
      "scheduled_operator_family_output_gate"
    ];
    const hasScheduleField = suffixes.some((suffix) => fields[`${prefix}.${suffix}`] !== undefined);
    if (!hasScheduleField) {
      return undefined;
    }
    if (!operatorReceipt) {
      return null;
    }
    const recipeVersion = fields[`${prefix}.evolution_recipe_version`];
    const recipeStrategy = fields[`${prefix}.evolution_recipe_strategy`];
    const recipeStatus = fields[`${prefix}.evolution_recipe_status`];
    const selectionSource = fields[`${prefix}.evolution_selection_source`];
    const relatednessContractChecksum = fields[`${prefix}.evolution_relatedness_contract_checksum`];
    const scheduleChecksumAlgorithm = fields[`${prefix}.evolution_schedule_checksum_algorithm`];
    const scheduleChecksum = fields[`${prefix}.evolution_schedule_checksum`];
    const familyIndex = registryDecimalIndex(fields[`${prefix}.scheduled_operator_family_index`]);
    const familyKind = fields[`${prefix}.scheduled_operator_family_kind`];
    const familyCommand = fields[`${prefix}.scheduled_operator_family_command`];
    const familySelectionRule = fields[`${prefix}.scheduled_operator_family_selection_rule`];
    const familyOutputGate = fields[`${prefix}.scheduled_operator_family_output_gate`];
    const expectedFamily = expectedEvolutionScheduleFamily(operatorReceipt.operatorKind);
    if (
      recipeVersion !== registryEvolutionRecipeVersion ||
      recipeStrategy !== registryEvolutionRecipeStrategy ||
      recipeStatus !== registryEvolutionRecipeStatus ||
      selectionSource !== registryEvolutionSelectionSource ||
      !isRegistryHex64(relatednessContractChecksum) ||
      scheduleChecksumAlgorithm !== registryEvolutionScheduleChecksumAlgorithm ||
      !isRegistryHex64(scheduleChecksum) ||
      familyIndex === null ||
      !isRegistrySlug(familyKind) ||
      !isRegistrySlug(familyCommand) ||
      !isRegistrySlug(familySelectionRule) ||
      !isRegistrySlug(familyOutputGate) ||
      familyKind !== operatorReceipt.operatorKind ||
      !expectedFamily ||
      familyIndex !== expectedFamily.familyIndex ||
      familyCommand !== expectedFamily.familyCommand ||
      familySelectionRule !== expectedFamily.familySelectionRule ||
      familyOutputGate !== expectedFamily.familyOutputGate
    ) {
      return null;
    }
    return {
      recipeVersion,
      recipeStrategy,
      recipeStatus,
      selectionSource,
      relatednessContractChecksum,
      scheduleChecksumAlgorithm,
      scheduleChecksum,
      familyIndex,
      familyKind,
      familyCommand,
      familySelectionRule,
      familyOutputGate
    };
  }

  // Reads selector phenotype evidence that binds runtime and eval observations to provenance.
  function registryPhenotypeEvidenceEntry(fields, prefix) {
    const phenotypeEvidenceId = fields[`${prefix}.phenotype_evidence_id`];
    const strategy = fields[`${prefix}.phenotype_evidence_strategy`];
    const status = fields[`${prefix}.phenotype_evidence_status`];
    const checksum = fields[`${prefix}.phenotype_evidence_checksum`];
    if (
      !isRegistryHex64(phenotypeEvidenceId) ||
      strategy !== registryPhenotypeEvidenceStrategy ||
      status !== registryPhenotypeEvidenceStatus ||
      !isRegistryHex64(checksum)
    ) {
      return null;
    }
    return {
      id: phenotypeEvidenceId,
      strategy,
      status,
      checksum
    };
  }

  // Reads selector heritable artifact metadata that binds served model identity to provenance.
  function registryHeritableArtifactEntry(fields, prefix) {
    const artifactId = fields[`${prefix}.heritable_artifact_id`];
    const strategy = fields[`${prefix}.heritable_artifact_strategy`];
    const status = fields[`${prefix}.heritable_artifact_status`];
    const checksum = fields[`${prefix}.heritable_artifact_checksum`];
    if (
      !isRegistryHex64(artifactId) ||
      strategy !== registryHeritableArtifactStrategy ||
      status !== registryHeritableArtifactStatus ||
      !isRegistryHex64(checksum)
    ) {
      return null;
    }
    return {
      id: artifactId,
      strategy,
      status,
      checksum
    };
  }

  // Reads scoped eval facts as a compact fitness vector for selector provenance.
  function registryEvalEvidenceEntry(fields, prefix, candidateId) {
    const path = fields[`${prefix}.eval_path`] || "";
    const checksum = fields[`${prefix}.eval_case_evidence_checksum`];
    const manifestChecksum = fields[`${prefix}.eval_manifest_checksum`];
    const casesPassed = registryDecimalByteCount(fields[`${prefix}.cases_passed`]);
    const fitnessVectorStatus = fields[`${prefix}.fitness_vector_status`];
    const fitnessVectorChecksum = fields[`${prefix}.fitness_vector_checksum`];
    if (
      (path && !isSafeRegistryEvalEvidencePath(candidateId, path)) ||
      !isRegistryHex64(checksum) ||
      !isRegistryHex64(manifestChecksum) ||
      casesPassed === null ||
      fitnessVectorStatus !== registryFitnessVectorStatus ||
      !isRegistryHex64(fitnessVectorChecksum)
    ) {
      return null;
    }
    return {
      path,
      checksum,
      manifestChecksum,
      casesPassed,
      fitnessVectorStatus,
      fitnessVectorChecksum,
      qualityScope: fields[`${prefix}.quality_scope`] || "",
      qualityBoundary: fields[`${prefix}.quality_boundary`] || "",
      evalDataset: fields[`${prefix}.eval_dataset`] || ""
    };
  }

  function registryRuntimeSmokeEvidenceEntry(fields, prefix, candidateId) {
    // Reads an optional converted-trained runtime-smoke sidecar route for browser verification.
    const path = fields[`${prefix}.runtime_smoke_path`] || "";
    const manifestChecksum = fields[`${prefix}.runtime_smoke_manifest_checksum`] || "";
    if (
      (path && !isSafeRegistryRuntimeSmokePath(candidateId, path)) ||
      !isRegistryHex64(manifestChecksum)
    ) {
      return null;
    }
    return {
      path,
      manifestChecksum,
      verified: false,
      fields: null
    };
  }

  function registrySourceManifestEntry(fields, prefix, candidateId) {
    // Reads selector-carried source snapshot identity so browser fetches can bind to it.
    const keys = [
      "source_manifest_path",
      "source_manifest_checksum",
      "source_manifest_kind",
      "source_manifest_status",
      "source_manifest_source_kind",
      "source_manifest_source_id",
      "source_manifest_model_shape",
      "source_review_kind",
      "source_review_path",
      "source_review_status",
      "source_review_checksum",
      "source_review_required_next_gate"
    ];
    const hasSourceManifest = keys.some((key) => fields[`${prefix}.${key}`]);
    if (!hasSourceManifest) {
      return undefined;
    }
    const path = fields[`${prefix}.source_manifest_path`] || "";
    const checksum = fields[`${prefix}.source_manifest_checksum`] || "";
    const kind = fields[`${prefix}.source_manifest_kind`] || "";
    const status = fields[`${prefix}.source_manifest_status`] || "";
    const sourceKind = fields[`${prefix}.source_manifest_source_kind`] || "";
    const sourceId = fields[`${prefix}.source_manifest_source_id`] || "";
    const modelShape = fields[`${prefix}.source_manifest_model_shape`] || "";
    const reviewKeys = [
      "source_review_kind",
      "source_review_path",
      "source_review_status",
      "source_review_checksum",
      "source_review_required_next_gate"
    ];
    const hasSourceReview = reviewKeys.some((key) => fields[`${prefix}.${key}`]);
    let sourceReview = null;
    if (hasSourceReview) {
      const reviewKind = fields[`${prefix}.source_review_kind`] || "";
      const reviewPath = fields[`${prefix}.source_review_path`] || "";
      const reviewStatus = fields[`${prefix}.source_review_status`] || "";
      const reviewChecksum = fields[`${prefix}.source_review_checksum`] || "";
      const reviewRequiredNextGate =
        fields[`${prefix}.source_review_required_next_gate`] || "";
      if (
        reviewKind !== registrySourceReviewKind ||
        !isSafeRegistrySourceReviewPath(candidateId, reviewPath) ||
        reviewStatus !== registrySourceReviewStatus ||
        !isRegistryHex64(reviewChecksum) ||
        reviewRequiredNextGate !== registrySourceReviewRequiredNextGate
      ) {
        return null;
      }
      sourceReview = {
        kind: reviewKind,
        path: reviewPath,
        status: reviewStatus,
        checksum: reviewChecksum,
        requiredNextGate: reviewRequiredNextGate
      };
    }
    if (
      !isSafeRegistrySourceManifestPath(candidateId, path) ||
      !isRegistryHex64(checksum) ||
      kind !== registrySourceManifestKind ||
      status !== registrySourceManifestStatus ||
      !["trained-source-fixture", "trained-export"].includes(sourceKind) ||
      !isRegistrySlug(sourceId) ||
      !isRegistrySlug(modelShape)
    ) {
      return null;
    }
    return { path, checksum, kind, status, sourceKind, sourceId, modelShape, sourceReview };
  }

  function registrySourceValidationEntry(fields, prefix, candidateId) {
    // Reads the converted-trained validate-source sidecar route when a registry entry exposes it.
    const path = fields[`${prefix}.source_validation_path`] || "";
    const checksum = fields[`${prefix}.source_validation_checksum`] || "";
    if (!path && !checksum) {
      return undefined;
    }
    if (!isSafeRegistrySourceValidationPath(candidateId, path) || !isRegistryHex64(checksum)) {
      return null;
    }
    return {
      path,
      checksum,
      verified: false,
      fields: null
    };
  }

  function registryAdmissionEvidenceEntry(fields, prefix, candidateId) {
    // Reads the selector admission sidecar route when converted-trained entries expose it.
    const path = fields[`${prefix}.admission_path`] || "";
    const checksum = fields[`${prefix}.admission_checksum`] || "";
    if (!path) {
      return undefined;
    }
    if (!isSafeRegistryAdmissionPath(candidateId, path) || !isRegistryHex64(checksum)) {
      return null;
    }
    return {
      path,
      checksum,
      verified: false,
      fields: null
    };
  }

  function registryModelEntries(fields) {
    if (!fields || fields.tinyrustlm_selector_registry_version !== "2") {
      return null;
    }
    if (
      fields.registry_status !== "admitted-records-only" ||
      fields.required_next_gate !== selectorRegistryRequiredNextGate
    ) {
      return null;
    }
    const registryByteBudget = registrySelectorModelByteBudget(fields.selector_model_byte_budget);
    if (registryByteBudget === null) {
      return null;
    }
    if (
      !registryExactByteBudget(
        fields.selector_composition_graph_byte_budget,
        selectorCompositionGraphByteBudget
      )
    ) {
      return null;
    }
    if (!registryTextSidecarBudgets(fields)) {
      return null;
    }
    const entryCount = Number.parseInt(fields.entry_count || "0", 10);
    if (!Number.isInteger(entryCount) || entryCount < 1 || entryCount > 64) {
      return null;
    }
    const models = Object.create(null);
    for (let index = 0; index < entryCount; index += 1) {
      const prefix = `entry.${index}`;
      if (fields[`${prefix}.selector_status`] !== "admitted") {
        return null;
      }
      const modelPath = fields[`${prefix}.model_path`];
      if (!isSafeRegistryModelPath(modelPath)) {
        return null;
      }
      const candidateId = fields[`${prefix}.candidate_id`];
      if (!candidateId) {
        return null;
      }
      if (models[candidateId]) {
        return null;
      }
      const maxTokens = clampInteger(fields[`${prefix}.max_tokens`], 1, 512, 8);
      const modelBytes = registryModelBytes(fields[`${prefix}.model_bytes`], registryByteBudget);
      if (modelBytes === null) {
        return null;
      }
      const modelShape = fields[`${prefix}.model_shape`] || "";
      const contextTokenLimit = registryModelShapeContextTokenLimit(modelShape);
      if (contextTokenLimit === null || contextTokenLimit < maxTokens) {
        return null;
      }
      const tokenizerChecksum = fields[`${prefix}.tokenizer_checksum`] || "";
      if (tokenizerChecksum && !isRegistryHex64(tokenizerChecksum)) {
        return null;
      }
      const slmChecksum = fields[`${prefix}.slm_checksum`] || "";
      if (!isRegistryHex64(slmChecksum)) {
        return null;
      }
      const sourceManifest = registrySourceManifestEntry(fields, prefix, candidateId);
      if (sourceManifest === null) {
        return null;
      }
      const sourceValidation = registrySourceValidationEntry(fields, prefix, candidateId);
      if (sourceValidation === null) {
        return null;
      }
      const composition = registryCompositionEntry(fields, prefix, modelPath);
      if (composition === null) {
        return null;
      }
      if (registryEntryDeclaresMutableAssembly(fields, prefix)) {
        return null;
      }
      const admissionEvidence = registryAdmissionEvidenceEntry(fields, prefix, candidateId);
      if (admissionEvidence === null) {
        return null;
      }
      const quantization = fields[`${prefix}.quantization`] || "";
      const genome = registryGenomeEntry(fields, prefix);
      if (!genome) {
        return null;
      }
      const species = registrySpeciesEntry(fields, prefix);
      if (!species) {
        return null;
      }
      const novelty = registryNoveltyEntry(fields, prefix);
      if (!novelty) {
        return null;
      }
      const population = registryPopulationEntry(fields, prefix);
      if (!population) {
        return null;
      }
      const mateSelection = registryMateSelectionEntry(fields, prefix);
      if (!mateSelection) {
        return null;
      }
      const operatorReceipt = registryOperatorReceiptEntry(
        fields,
        prefix,
        modelBytes,
        slmChecksum
      );
      if (operatorReceipt === null) {
        return null;
      }
      const evolutionSchedule = registryEvolutionScheduleEntry(fields, prefix, operatorReceipt);
      if (evolutionSchedule === null) {
        return null;
      }
      const phenotypeEvidence = registryPhenotypeEvidenceEntry(fields, prefix);
      if (!phenotypeEvidence) {
        return null;
      }
      const heritableArtifact = registryHeritableArtifactEntry(fields, prefix);
      if (!heritableArtifact) {
        return null;
      }
      const runtimeSmokeEvidence = registryRuntimeSmokeEvidenceEntry(fields, prefix, candidateId);
      if (!runtimeSmokeEvidence) {
        return null;
      }
      const evalEvidence = registryEvalEvidenceEntry(fields, prefix, candidateId);
      if (!evalEvidence) {
        return null;
      }
      models[candidateId] = {
        candidateId,
        label: fields[`${prefix}.display_name`] || candidateId,
        path: modelPath,
        modelBytes,
        slmChecksum,
        modelShape,
        maxTokens,
        contextTokenLimit,
        tokenizerChecksum,
        quantization,
        composition,
        genome,
        species,
        novelty,
        population,
        mateSelection,
        operatorReceipt: operatorReceipt || null,
        evolutionSchedule: evolutionSchedule || null,
        phenotypeEvidence,
        heritableArtifact,
        admissionEvidence: admissionEvidence || null,
        runtimeSmokeEvidence,
        evalEvidence,
        sourceManifest: sourceManifest || null,
        sourceValidation: sourceValidation || null,
      };
    }
    const defaultModelKey = registryDefaultModelKey(fields, models);
    if (defaultModelKey === null) {
      return null;
    }
    return { models, defaultModelKey };
  }

  function registrySelectorModelByteBudget(value) {
    const byteBudget = registryDecimalByteCount(value);
    if (byteBudget === null || byteBudget > selectorModelByteBudget) {
      return null;
    }
    return byteBudget;
  }

  function registryEntryDeclaresMutableAssembly(fields, prefix) {
    const forbiddenPrefixes = [
      `${prefix}.adapter`,
      `${prefix}.assembly`,
      `${prefix}.module_plan`
    ];
    return Object.keys(fields).some((key) =>
      forbiddenPrefixes.some((forbidden) => key.startsWith(forbidden))
    );
  }

  function registryCompositionEntry(fields, prefix, modelPath) {
    const path = fields[`${prefix}.composition_graph_path`] || "";
    const bytes = registryDecimalByteCount(fields[`${prefix}.composition_graph_bytes`]);
    const sha256 = fields[`${prefix}.composition_graph_sha256`] || "";
    const baseModelId = fields[`${prefix}.composition_base_model_id`] || "";
    const compositionId = fields[`${prefix}.composition_id`] || "";
    const activeGraphSha256 = fields[`${prefix}.composition_active_graph_sha256`] || "";
    const routePolicyId = fields[`${prefix}.composition_route_policy_id`] || "";
    const kvFormatId = fields[`${prefix}.composition_kv_format_id`] || "";
    const positionPolicySha256 =
      fields[`${prefix}.composition_position_policy_sha256`] || "";
    const memberCount = registryDecimalIndex(fields[`${prefix}.composition_member_count`]);
    if (
      path !== `${modelPath}.acg1` ||
      bytes === null ||
      bytes > selectorCompositionGraphByteBudget ||
      !isRegistrySha256(sha256) ||
      !isRegistryTypedContentId(baseModelId, "model-sha256-") ||
      !isRegistryTypedContentId(compositionId, "composition-sha256-") ||
      !isRegistrySha256(activeGraphSha256) ||
      !isRegistryTypedContentId(routePolicyId, "route-sha256-") ||
      !isRegistryTypedContentId(kvFormatId, "kv-format-sha256-") ||
      !isRegistrySha256(positionPolicySha256) ||
      memberCount === null ||
      memberCount > 64
    ) {
      return null;
    }
    return {
      path,
      bytes,
      sha256,
      baseModelId,
      compositionId,
      activeGraphSha256,
      routePolicyId,
      kvFormatId,
      positionPolicySha256,
      memberCount
    };
  }

  function registryTextSidecarBudgets(fields) {
    return registryExactByteBudget(
      fields.selector_registry_text_byte_budget,
      selectorRegistryTextByteBudget
    ) &&
      registryExactByteBudget(fields.manifest_text_byte_budget, manifestTextByteBudget) &&
      registryExactByteBudget(fields.receipt_text_byte_budget, receiptTextByteBudget) &&
      registryExactByteBudget(fields.evidence_text_byte_budget, evidenceTextByteBudget);
  }

  function registryExactByteBudget(value, expected) {
    const byteBudget = registryDecimalByteCount(value);
    return byteBudget !== null && byteBudget === expected;
  }

  function registryModelBytes(value, byteBudget) {
    const modelBytes = registryDecimalByteCount(value);
    if (modelBytes === null || modelBytes > byteBudget) {
      return null;
    }
    return modelBytes;
  }

  function runtimeWasmManifestBytes(value) {
    const byteCount = registryDecimalByteCount(value);
    if (byteCount === null || byteCount < 1) {
      return null;
    }
    return byteCount;
  }

  function registryDecimalCount(value) {
    // Accepts exact positive decimal registry fields without whitespace or leading zero drift.
    if (!value) {
      return null;
    }
    const count = Number.parseInt(value, 10);
    if (
      !Number.isSafeInteger(count) ||
      String(count) !== value ||
      count < 1
    ) {
      return null;
    }
    return count;
  }

  function registryDecimalIndex(value) {
    // Accepts exact zero-based decimal indices for ordered schedule families.
    if (!value) {
      return null;
    }
    const index = Number.parseInt(value, 10);
    if (
      !Number.isSafeInteger(index) ||
      String(index) !== value ||
      index < 0
    ) {
      return null;
    }
    return index;
  }

  function registryDecimalByteCount(value) {
    return registryDecimalCount(value);
  }

  function registryModelShapeContextTokenLimit(modelShape) {
    const match = String(modelShape || "").match(/(?:^|,)(?:context|ctx)=(\d+)(?:,|$)/);
    if (!match) {
      return null;
    }
    const tokens = registryDecimalCount(match[1]);
    if (tokens === null || tokens > selectorContextTokenLimit) {
      return null;
    }
    return tokens;
  }

  function registryDefaultModelKey(fields, models) {
    const keys = [
      "selector_default_strategy",
      "selector_default_candidate_id",
      "selector_default_quantization"
    ];
    const hasDefault = keys.some((key) => fields[key]);
    if (!hasDefault) {
      return "";
    }
    if (fields.selector_default_strategy !== selectorDefaultStrategy) {
      return null;
    }
    const candidateId = fields.selector_default_candidate_id;
    const model = models[candidateId];
    if (!model || fields.selector_default_quantization !== model.quantization) {
      return null;
    }
    return candidateId;
  }

  // Loads the optional generated selector registry before the first model is chosen.
  async function loadSelectorRegistry() {
    if (isPublicLocalOnlyHost()) {
      return;
    }
    try {
      const text = await fetchTextWithinBudget(
        paths.registry,
        selectorRegistryTextByteBudget,
        "selector registry",
        true
      );
      if (text === null) {
        return;
      }
      const fields = parseManifest(text);
      const registry = registryModelEntries(fields);
      if (!registry) {
        restoreImportedModelOptions();
        return;
      }
      paths.models = modelsWithLocalModel(registry.models);
      state.selectorRegistry = fields;
      state.selectorDefaultModelKey = registry.defaultModelKey || "";
      renderModelOptions(paths.models, Boolean(state.selectorDefaultModelKey));
    } catch (_error) {
      restoreImportedModelOptions();
    }
  }

  async function loadVerifiedRuntimeWasmVariant(wasmPath, manifestPath, allowMissing) {
    const manifestText = await fetchTextWithinBudget(
      manifestPath,
      manifestTextByteBudget,
      "WASM manifest",
      allowMissing
    );
    if (manifestText === null) {
      return null;
    }
    const fields = parseManifest(manifestText);
    requireManifestEqual(fields, "tinyrustlm_wasm_manifest_version", "1", "WASM manifest");
    requireManifestEqual(fields, "runtime_kind", runtimeWasmKind, "WASM manifest");
    requireManifestEqual(fields, "runtime_status", runtimeWasmStatus, "WASM manifest");
    requireManifestEqual(fields, "runtime_wasm_path", wasmPath, "WASM manifest");
    requireManifestEqual(fields, "required_next_gate", runtimeWasmNextGate, "WASM manifest");
    const expectedBytes = runtimeWasmManifestBytes(
      requireManifestField(fields, "runtime_wasm_bytes", "WASM manifest")
    );
    if (expectedBytes === null) {
      throw new Error("WASM manifest field runtime_wasm_bytes was invalid");
    }
    const expectedChecksum = requireManifestField(fields, "runtime_wasm_checksum", "WASM manifest");
    const response = await fetch(wasmPath, localFetchOptions);
    if (!response.ok) {
      throw new Error(`Unable to fetch WASM runtime (${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== expectedBytes) {
      throw new Error("WASM runtime byte length mismatch");
    }
    requireChecksumEqual(bytesChecksumHex(bytes), expectedChecksum, "WASM runtime");
    return bytes;
  }

  async function loadRuntimeWasmBytes() {
    const simdBytes = await loadVerifiedRuntimeWasmVariant(
      paths.wasmSimd,
      paths.wasmSimdManifest,
      true
    );
    if (simdBytes && WebAssembly.validate(simdBytes)) {
      state.runtimeVariant = "simd128";
      document.documentElement.dataset.runtimeVariant = state.runtimeVariant;
      appendConsole("runtime_variant=simd128");
      return simdBytes;
    }
    if (simdBytes) {
      appendConsole("runtime_variant=scalar; simd128 unsupported by this browser");
    }

    const scalarBytes = await loadVerifiedRuntimeWasmVariant(
      paths.wasm,
      paths.wasmManifest,
      false
    );
    if (!scalarBytes || !WebAssembly.validate(scalarBytes)) {
      throw new Error("WASM runtime validation failed");
    }
    state.runtimeVariant = "scalar";
    document.documentElement.dataset.runtimeVariant = state.runtimeVariant;
    appendConsole("runtime_variant=scalar");
    return scalarBytes;
  }

  // Renders manifest provenance and the selector evidence that was validated before model bytes.
  function renderProvenance(status, fields, isError) {
    setText(el.provenanceState, status, isError);
    const model = paths.models[state.activeModelKey] || null;
    const sourceManifest = model && model.sourceManifest ? model.sourceManifest : null;
    const sourceReview = sourceManifest && sourceManifest.sourceReview ? sourceManifest.sourceReview : null;
    const sourceValidation = model && model.sourceValidation ? model.sourceValidation : null;
    const genome = model && model.genome ? model.genome : null;
    const species = model && model.species ? model.species : null;
    const novelty = model && model.novelty ? model.novelty : null;
    const population = model && model.population ? model.population : null;
    const mateSelection = model && model.mateSelection ? model.mateSelection : null;
    const operatorReceipt = model && model.operatorReceipt ? model.operatorReceipt : null;
    const evolutionSchedule = model && model.evolutionSchedule ? model.evolutionSchedule : null;
    const phenotypeEvidence = model && model.phenotypeEvidence ? model.phenotypeEvidence : null;
    const heritableArtifact = model && model.heritableArtifact ? model.heritableArtifact : null;
    const admissionEvidence = model && model.admissionEvidence ? model.admissionEvidence : null;
    const evalEvidence = model && model.evalEvidence ? model.evalEvidence : null;
    const conversationEvidence = model && model.conversationEvidence ? model.conversationEvidence : null;
    el.provenanceSourceKind.textContent = manifestValue(fields, "source_kind");
    el.provenanceSourceSnapshot.textContent = sourceManifest
      ? sourceManifest.sourceKind
      : manifestValue(fields, "source_snapshot");
    el.provenanceSourceId.textContent = sourceManifest
      ? sourceManifest.sourceId
      : manifestValue(fields, "source_id");
    el.provenanceSourceShape.textContent = sourceManifest
      ? sourceManifest.modelShape
      : manifestValue(fields, "model_shape");
    el.provenanceSourceReview.textContent = sourceReview
      ? [
          sourceReview.status,
          sourceReview.requiredNextGate,
          sourceReview.checksum,
          sourceReview.sourceModelId,
          sourceReview.sourceModelSha
        ].filter(Boolean).join(" / ")
      : manifestValue(fields, "source_review");
    el.provenanceSourceReviewRoutes.textContent = sourceReview
      ? sourceReviewRouteSummary(sourceReview)
      : manifestValue(fields, "source_review_routes");
    el.provenanceSourceReviewArtifacts.textContent = sourceReview
      ? sourceReviewArtifactSummary(sourceReview)
      : manifestValue(fields, "source_review_artifacts");
    el.provenanceSourceTokenizerImport.textContent = sourceReviewTokenizerImportSummary(sourceReview);
    el.provenanceSourceValidation.textContent = sourceValidation
      ? sourceValidationSummary(sourceValidation)
      : manifestValue(fields, "source_validation");
    el.provenanceAdmission.textContent = admissionEvidenceSummary(admissionEvidence, fields);
    el.provenanceQualityClaim.textContent = provenanceQualityClaimText(fields, model, evalEvidence);
    applyModelTrustMetadata(el.provenanceQualityClaim, model);
    el.provenanceTrainedClaim.textContent = provenanceTrainedClaimText(fields, model, evalEvidence);
    el.provenanceGenome.textContent = genome ? genome.id : "unavailable";
    el.provenanceSpecies.textContent = species
      ? `${species.fitStatus} / ${species.id} / ${species.fitChecksum}`
      : "unavailable";
    el.provenanceNovelty.textContent = novelty
      ? `${novelty.status} / ${novelty.id} / ${novelty.checksum}`
      : "unavailable";
    el.provenancePopulation.textContent = population
      ? `${population.status} / ${population.id} / ${population.checksum}`
      : "unavailable";
    el.provenanceMateSelection.textContent = mateSelection
      ? `${mateSelection.status} / ${mateSelection.parentCount} parents / ${mateSelection.id} / ${mateSelection.checksum}`
      : "unavailable";
    el.provenanceOperator.textContent = operatorReceipt
      ? `${operatorReceipt.status} / ${operatorReceipt.operatorKind} / ${operatorReceipt.checksum}`
      : "unavailable";
    el.provenanceSchedule.textContent = evolutionSchedule
      ? `${evolutionSchedule.recipeStatus} / family ${evolutionSchedule.familyIndex} / ${evolutionSchedule.familyCommand} / ${evolutionSchedule.familySelectionRule} / ${evolutionSchedule.familyOutputGate} / ${evolutionSchedule.scheduleChecksum}`
      : "unavailable";
    el.provenancePhenotype.textContent = phenotypeEvidence
      ? `${phenotypeEvidence.status} / ${phenotypeEvidence.id} / ${phenotypeEvidence.checksum}`
      : "unavailable";
    el.provenanceArtifact.textContent = heritableArtifact
      ? `${heritableArtifact.status} / ${heritableArtifact.id} / ${heritableArtifact.checksum}`
      : "unavailable";
    el.provenanceFitness.textContent = evalEvidence
      ? `${evalEvidence.fitnessVectorStatus} / ${evalEvidence.fitnessVectorChecksum}`
      : conversationEvidence && conversationEvidence.verified
        ? `${conversationEvidence.strictEvalCasesPassed} of ${conversationEvidence.strictEvalCasesPassed + conversationEvidence.strictEvalCasesFailed} strict cases / not admitted`
        : "unavailable";
    el.provenanceEvalCases.textContent = evalEvidence
      ? `${evalEvidence.casesPassed} passed`
      : conversationEvidence && conversationEvidence.verified
        ? `${conversationEvidence.turnsPassed} conversation turns passed / strict JSON limited`
        : "unavailable";
    el.provenanceEvalChecksum.textContent = evalEvidence
      ? evalEvidence.checksum
      : conversationEvidence && conversationEvidence.verified
        ? conversationEvidence.manifestChecksum
        : "unavailable";
    el.provenanceChecksum.textContent = manifestValue(fields, "slm_checksum");
    el.provenanceNextGate.textContent = provenanceNextGateText(fields, model, evalEvidence);
  }

  function sourceReviewRouteSummary(sourceReview) {
    if (!sourceReview || !sourceReview.fields) {
      return "unavailable";
    }
    return [
      `license=${sourceReview.sourceLicenseRoute}`,
      `prompt=${sourceReview.referencePromptRoute}`,
      `reference=${sourceReview.referenceOutputChecksum}`,
      `eval=${sourceReview.evalCasesRoute}`
    ].join(" / ");
  }

  function sourceReviewArtifactSummary(sourceReview) {
    if (!sourceReview || !sourceReview.artifacts) {
      return "unavailable";
    }
    const parts = [];
    for (const [label, artifact] of Object.entries(sourceReview.artifacts)) {
      if (!artifact) {
        continue;
      }
      if (artifact.status === "not-local") {
        parts.push(`${label}=not-local`);
      } else {
        parts.push(`${label}=${artifact.status}@${artifact.checksum}`);
      }
    }
    return parts.length > 0 ? parts.join(" / ") : "unavailable";
  }

  function sourceReviewTokenizerImportSummary(sourceReview) {
    if (!sourceReview || !sourceReview.tokenizerImport) {
      return "unavailable";
    }
    const tokenizerImport = sourceReview.tokenizerImport;
    return [
      tokenizerImport.status,
      `tokens=${tokenizerImport.tokenCount}`,
      `merges=${tokenizerImport.mergeCount}`,
      tokenizerImport.checksum
    ].join(" / ");
  }

  function sourceValidationSummary(sourceValidation) {
    if (!sourceValidation || !sourceValidation.verified || !sourceValidation.fields) {
      return "unavailable";
    }
    return [
      sourceValidation.fields.source_validation_status,
      sourceValidation.fields.required_next_gate,
      sourceValidation.checksum
    ].filter(Boolean).join(" / ");
  }

  function admissionEvidenceSummary(admissionEvidence, fields) {
    if (!admissionEvidence || !admissionEvidence.verified || !admissionEvidence.fields) {
      return manifestValue(fields, "admission_status");
    }
    return [
      admissionEvidence.fields.admission_status,
      admissionEvidence.fields.required_next_gate,
      admissionEvidence.checksum
    ].filter(Boolean).join(" / ");
  }

  function clearBrowserAdmissionDiagnostics() {
    for (const key of [
      "activeBrowserAdmissionSha256",
      "activeArtifactSha256",
      "activeManifestSha256",
      "activeQualityEvidenceSha256",
      "activeQualificationReceiptId",
      "activePromptFormat",
      "activeSystemPromptSha256",
      "activeModelSamplingProfile"
    ]) {
      delete document.documentElement.dataset[key];
    }
  }

  async function loadModelManifest(model) {
    if (model.companionImport) {
      const entry = model.companionImport.catalogEntry;
      const converted = model.companionImport.acquisitionKind === "conversion";
      const fields = {
        source_kind: converted
          ? "huggingface-desktop-companion-conversion"
          : "minimodel-desktop-companion-import",
        source_id: entry.sourceModelId || entry.modelId,
        source_snapshot: converted
          ? `revision=${entry.sourceRevision || "unavailable"} / rust-receipt-revalidated-before-loopback-stream`
          : "rust-receipt-revalidated-before-loopback-stream",
        source_review: entry.admissionStatus || (converted ? "immutable-source-reviewed" : "catalog-metadata-only"),
        source_review_routes: entry.manifestRoute || "",
        source_review_artifacts: `artifact=${model.companionImport.artifactSha256} / bytes=${model.companionImport.artifactByteCount}`,
        source_validation: converted
          ? "conversion-preflight-receipt-and-composition-revalidated-before-browser-load"
          : "peer-import-receipt-chain-validated-before-browser-load",
        model_shape: entry.modelShape || "runtime-validated-by-wasm",
        tokenizer: entry.tokenizer || "runtime-validated-by-wasm",
        tokenizer_checksum: entry.tokenizerChecksum || "",
        context_length: entry.contextLength || "",
        output_contract: entry.outputContract || "",
        prompt_format: entry.promptFormat || promptFormatRaw,
        instruction_support: entry.instructionSupport || "not-declared",
        chat_support: entry.chatSupport || "not-declared",
        quality_eval_status: entry.qualityEvalStatus || "not-run",
        intended_use: entry.intendedUse || "user-selected-peer-import",
        quality_claim: entry.qualityClaim || "not-claimed",
        trained_quality_claim: entry.trainedQualityClaim || "not-claimed",
        admission_status: converted
          ? "conversion-structure-and-receipt-validated-quality-unqualified"
          : "peer-import-receipt-validated",
        slm_checksum: entry.slmChecksum || "",
        artifact_sha256: model.companionImport.artifactSha256,
        artifact_bytes: String(model.companionImport.artifactByteCount),
        required_next_gate: entry.requiredNextGate || "browser-runtime-validation"
      };
      state.modelManifest = fields;
      renderProvenance("desktop companion", fields, false);
      return;
    }
    if (model.localFile) {
      const importReceipt = model.localFile.importReceipt || null;
      const browserAdmission = model.browserAdmission;
      if (!browserAdmission || !browserAdmission.admission) {
        throw new Error("Local model lacks a validated browser admission");
      }
      const admission = browserAdmission.admission;
      const fields = {
        source_kind: importReceipt && importReceipt.peerImport
          ? "minimodel-p2p-browser-admission"
          : "qualified-local-browser-admission",
        source_id: admission.modelId,
        source_snapshot: `admission=${browserAdmission.sha256} / qualification=${admission.qualification.receiptId}`,
        source_review: `source-evidence-sha256=${admission.qualification.sourceEvidenceSha256}`,
        source_review_routes: importReceipt ? localImportReceiptRouteSummary(importReceipt) : "",
        source_review_artifacts: `manifest-sha256=${admission.qualification.manifestSha256} / quality-evidence-sha256=${admission.qualification.qualityEvidenceSha256}`,
        source_validation: importReceipt
          ? localImportReceiptValidationSummary(importReceipt)
          : "browser-admission-and-wasm-artifact-digest-validated",
        model_shape: importReceipt && importReceipt.slmModelShape !== "unavailable"
          ? importReceipt.slmModelShape
          : "runtime-validated-by-wasm",
        tokenizer: "runtime-validated-by-wasm",
        tokenizer_checksum: "",
        context_length: String(admission.runtime.contextLength),
        output_contract: "runtime-validated-by-wasm",
        prompt_format: admission.runtime.promptFormat,
        system_prompt: admission.runtime.systemPrompt,
        sampling_profile: admission.runtime.modelSamplingProfile,
        sampling_temperature: String(admission.runtime.temperature),
        sampling_top_k: String(admission.runtime.topK),
        sampling_top_p: String(admission.runtime.topP),
        sampling_repetition_penalty: String(admission.runtime.repetitionPenalty),
        instruction_support: "qualification-receipt-bound",
        chat_support: "qualification-receipt-bound",
        quality_eval_status: "external-receipt-validation-required",
        intended_use: "campaign-bound-local-browser-execution",
        quality_claim: "external-qualification-receipt-required",
        trained_quality_claim: "external-qualification-receipt-required",
        admission_status: "runtime-admitted-local-bundle",
        slm_checksum: model.localFile.checksum,
        artifact_sha256: model.localFile.sha256,
        artifact_bytes: String(model.localFile.byteLength),
        required_next_gate: "validate-content-addressed-qualification-parent"
      };
      state.modelManifest = fields;
      document.documentElement.dataset.activeBrowserAdmissionSha256 =
        browserAdmission.sha256;
      document.documentElement.dataset.activeArtifactSha256 =
        admission.artifact.sha256;
      document.documentElement.dataset.activeManifestSha256 =
        admission.qualification.manifestSha256;
      document.documentElement.dataset.activeQualityEvidenceSha256 =
        admission.qualification.qualityEvidenceSha256;
      document.documentElement.dataset.activeQualificationReceiptId =
        admission.qualification.receiptId;
      document.documentElement.dataset.activePromptFormat =
        admission.runtime.promptFormat;
      document.documentElement.dataset.activeSystemPromptSha256 =
        admission.runtime.systemPromptSha256;
      document.documentElement.dataset.activeModelSamplingProfile =
        admission.runtime.modelSamplingProfile;
      renderProvenance("qualified local bundle", fields, false);
      return;
    }
    const manifestPath = `${model.path}.manifest`;
    try {
      const text = await fetchTextWithinBudget(
        manifestPath,
        manifestTextByteBudget,
        ".slm manifest"
      );
      const fields = parseManifest(text);
      state.modelManifest = fields;
      renderProvenance("loaded", fields, false);
    } catch (error) {
      state.modelManifest = null;
      renderProvenance(errorMessage(error), null, true);
    }
  }

  async function loadSourceManifest(model) {
    // Verifies reviewed trained-source evidence before converted model bytes are fetched.
    if (!model.sourceManifest) {
      return "source manifest unavailable";
    }
    model.sourceManifestVerified = false;
    model.sourceManifestFields = null;
    const text = await fetchTextWithinBudget(
      model.sourceManifest.path,
      evidenceTextByteBudget,
      "source manifest"
    );
    requireChecksumEqual(textChecksumHex(text), model.sourceManifest.checksum, "source manifest");
    const fields = parseManifest(text);
    requireManifestEqual(fields, "tinyrustlm_trained_source_version", "1", "source manifest");
    requireManifestEqual(fields, "model_family", "tinyrustlm", "source manifest");
    requireManifestEqual(fields, "layout", registrySourceManifestLayout, "source manifest");
    requireManifestEqual(fields, "source_dtype", "f32", "source manifest");
    requireManifestField(fields, "source_kind", "source manifest");
    requireManifestField(fields, "source_id", "source manifest");
    requireManifestEqual(
      fields,
      "source_kind",
      model.sourceManifest.sourceKind,
      "source manifest identity"
    );
    requireManifestEqual(
      fields,
      "source_id",
      model.sourceManifest.sourceId,
      "source manifest identity"
    );
    requireManifestEqual(
      fields,
      "model_shape",
      model.sourceManifest.modelShape,
      "source manifest identity"
    );
    const sourceReviewKeys = [
      "source_review_kind",
      "source_review_status",
      "source_review_checksum",
      "source_review_required_next_gate"
    ];
    const manifestHasSourceReview = sourceReviewKeys.some((key) => fields[key]);
    if (manifestHasSourceReview && !model.sourceManifest.sourceReview) {
      throw new Error("source review identity missing from selector");
    }
    if (model.sourceManifest.sourceReview) {
      requireManifestEqual(
        fields,
        "source_review_kind",
        model.sourceManifest.sourceReview.kind,
        "source review identity"
      );
      requireManifestEqual(
        fields,
        "source_review_status",
        model.sourceManifest.sourceReview.status,
        "source review identity"
      );
      requireManifestEqual(
        fields,
        "source_review_checksum",
        model.sourceManifest.sourceReview.checksum,
        "source review identity"
      );
      requireManifestEqual(
        fields,
        "source_review_required_next_gate",
        model.sourceManifest.sourceReview.requiredNextGate,
        "source review identity"
      );
    }
    const tensorCount = registryDecimalCount(
      requireManifestField(fields, "tensor_count", "source manifest")
    );
    if (tensorCount === null) {
      throw new Error("source manifest tensor count mismatch");
    }
    model.sourceManifestFields = fields;
    model.sourceManifestVerified = true;
    return "source manifest verified";
  }

  async function loadSourceReviewEvidence(model) {
    // Fetches the reviewed safetensors candidate report before model bytes are requested.
    const sourceReview =
      model.sourceManifest && model.sourceManifest.sourceReview
        ? model.sourceManifest.sourceReview
        : null;
    if (!sourceReview) {
      return "source review unavailable";
    }
    sourceReview.verified = false;
    sourceReview.fields = null;
    const text = await fetchTextWithinBudget(
      sourceReview.path,
      evidenceTextByteBudget,
      "source review"
    );
    requireChecksumEqual(textChecksumHex(text), sourceReview.checksum, "source review");
    const fields = parseManifest(text);
    requireManifestEqual(
      fields,
      "tinyrustlm_safetensors_candidate_review_version",
      "1",
      "source review"
    );
    requireManifestEqual(
      fields,
      "review_layout",
      "safetensors-real-trained-candidate-review-v1",
      "source review"
    );
    requireManifestEqual(
      fields,
      "target_model_shape",
      model.sourceManifest.modelShape,
      "source review"
    );
    const sourceModelId = requireManifestField(fields, "source_model_id", "source review");
    const sourceModelSha = requireSourceModelShaManifestField(
      fields,
      "source_model_sha",
      "source review"
    );
    const sourceConfigChecksum = requireHex64ManifestField(fields, "source_config_checksum", "source review");
    const sourceTokenizerChecksum = requireHex64ManifestField(fields, "source_tokenizer_checksum", "source review");
    const sourceLicenseRoute = requireManifestField(fields, "source_license_route", "source review");
    const referencePromptRoute = requireManifestField(fields, "reference_prompt_route", "source review");
    const referenceOutputChecksum = requireHex64ManifestField(fields, "reference_output_checksum", "source review");
    const evalCasesRoute = requireManifestField(fields, "eval_cases_route", "source review");
    const artifacts = {
      config: requireOptionalSourceReviewArtifact(fields, "source_config"),
      tokenizer: requireOptionalSourceReviewArtifact(fields, "source_tokenizer"),
      license: requireOptionalSourceReviewArtifact(fields, "source_license"),
      prompt: requireOptionalSourceReviewArtifact(fields, "reference_prompt"),
      eval: requireOptionalSourceReviewArtifact(fields, "eval_cases")
    };
    const tokenizerImport = requireSourceReviewTokenizerImport(fields);
    if (artifacts.config && artifacts.config.status !== "not-local") {
      requireChecksumEqual(artifacts.config.checksum, sourceConfigChecksum, "source config artifact");
    }
    if (artifacts.tokenizer && artifacts.tokenizer.status !== "not-local") {
      requireChecksumEqual(artifacts.tokenizer.checksum, sourceTokenizerChecksum, "source tokenizer artifact");
    }
    requireManifestEqual(
      fields,
      "required_next_gate",
      sourceReview.requiredNextGate,
      "source review"
    );
    sourceReview.sourceModelId = sourceModelId;
    sourceReview.sourceModelSha = sourceModelSha;
    sourceReview.sourceConfigChecksum = sourceConfigChecksum;
    sourceReview.sourceTokenizerChecksum = sourceTokenizerChecksum;
    sourceReview.sourceLicenseRoute = sourceLicenseRoute;
    sourceReview.referencePromptRoute = referencePromptRoute;
    sourceReview.referenceOutputChecksum = referenceOutputChecksum;
    sourceReview.evalCasesRoute = evalCasesRoute;
    sourceReview.artifacts = artifacts;
    sourceReview.tokenizerImport = tokenizerImport;
    sourceReview.fields = fields;
    sourceReview.verified = true;
    return "source review verified";
  }

  async function loadSourceValidationEvidence(model) {
    // Verifies the converted-trained validate-source gate before runtime smoke, eval, or model bytes.
    const sourceValidation = model.sourceValidation;
    if (!sourceValidation || !sourceValidation.path) {
      return "source validation unavailable";
    }
    if (!model.sourceManifest || !model.sourceManifestVerified || !model.sourceManifestFields) {
      throw new Error("source validation requires verified source manifest");
    }
    sourceValidation.verified = false;
    sourceValidation.fields = null;
    const text = await fetchTextWithinBudget(
      sourceValidation.path,
      evidenceTextByteBudget,
      "source validation"
    );
    requireChecksumEqual(textChecksumHex(text), sourceValidation.checksum, "source validation");
    const fields = parseManifest(text);
    requireManifestEqual(
      fields,
      "tinyrustlm_source_validation_version",
      "1",
      "source validation"
    );
    requireManifestEqual(
      fields,
      "source_validation_gate",
      registrySourceValidationGate,
      "source validation"
    );
    requireManifestEqual(
      fields,
      "source_validation_status",
      registrySourceValidationStatus,
      "source validation"
    );
    requireManifestEqual(
      fields,
      "source_validation_decision",
      registrySourceValidationDecision,
      "source validation"
    );
    requireManifestEqual(
      fields,
      "source_manifest_path",
      model.sourceManifest.path,
      "source validation"
    );
    requireChecksumEqual(
      requireManifestField(fields, "source_manifest_checksum", "source validation"),
      model.sourceManifest.checksum,
      "source validation source manifest"
    );
    requireManifestEqual(
      fields,
      "source_kind",
      model.sourceManifest.sourceKind,
      "source validation"
    );
    requireManifestEqual(
      fields,
      "source_id",
      model.sourceManifest.sourceId,
      "source validation"
    );
    requireManifestEqual(
      fields,
      "model_shape",
      model.sourceManifest.modelShape,
      "source validation"
    );
    requireManifestEqual(fields, "source_dtype", "f32", "source validation");
    requireManifestEqual(
      fields,
      "tied_output",
      requireManifestField(model.sourceManifestFields, "tied_output", "source manifest"),
      "source validation"
    );
    requireManifestEqual(
      fields,
      "tensor_count",
      requireManifestField(model.sourceManifestFields, "tensor_count", "source manifest"),
      "source validation"
    );
    if (
      registryDecimalCount(requireManifestField(fields, "tensor_count", "source validation")) ===
      null
    ) {
      throw new Error("source validation tensor count mismatch");
    }
    if (model.sourceManifest.sourceReview) {
      requireChecksumEqual(
        requireManifestField(fields, "source_review_checksum", "source validation"),
        model.sourceManifest.sourceReview.checksum,
        "source validation source review"
      );
    }
    requireManifestEqual(
      fields,
      "required_next_gate",
      registrySourceValidationRequiredNextGate,
      "source validation"
    );
    sourceValidation.fields = fields;
    sourceValidation.verified = true;
    return "source validation verified";
  }

  async function loadEvalEvidence(model) {
    // Binds converted-trained provenance rows to the eval sidecar fetched by this browser load.
    const evalEvidence = model.evalEvidence;
    if (!evalEvidence || !evalEvidence.path) {
      if (model.sourceManifest) {
        throw new Error("converted-trained eval evidence route missing");
      }
      return "eval evidence unavailable";
    }
    evalEvidence.verified = false;
    evalEvidence.fields = null;
    const text = await fetchTextWithinBudget(
      evalEvidence.path,
      evidenceTextByteBudget,
      "eval evidence"
    );
    requireChecksumEqual(textChecksumHex(text), evalEvidence.manifestChecksum, "eval evidence");
    const fields = parseManifest(text);
    requireManifestEqual(fields, "tinyrustlm_eval_manifest_version", "1", "eval evidence");
    requireManifestEqual(fields, "gate", "assistant-quality", "eval evidence");
    requireManifestEqual(fields, "eval_status", "pass", "eval evidence");
    requireManifestEqual(fields, "task_eval_status", "pass", "eval evidence");
    requireManifestEqual(fields, "cases_failed", "0", "eval evidence");
    requireManifestEqual(fields, "cases_passed", String(evalEvidence.casesPassed), "eval evidence");
    requireManifestEqual(fields, "quality_scope", evalEvidence.qualityScope, "eval evidence");
    requireManifestEqual(fields, "quality_boundary", evalEvidence.qualityBoundary, "eval evidence");
    requireManifestEqual(fields, "eval_dataset", evalEvidence.evalDataset, "eval evidence");
    requireChecksumEqual(
      requireManifestField(fields, "slm_checksum", "eval evidence"),
      model.slmChecksum,
      "eval evidence model"
    );
    requireManifestEqual(fields, "model_shape", model.modelShape, "eval evidence");
    if (model.slmManifestChecksum) {
      requireChecksumEqual(
        requireManifestField(fields, "manifest_checksum", "eval evidence"),
        model.slmManifestChecksum,
        "eval evidence manifest"
      );
    }
    if (model.promptFormat) {
      requireManifestEqual(fields, "prompt_format", model.promptFormat, "eval evidence");
    }
    requireManifestEqual(
      fields,
      "quality_gate_policy",
      "honest-assistant-quality-v1",
      "eval evidence"
    );
    requireManifestEqual(fields, "quality_decision", "accepted-for-assistant-quality", "eval evidence");
    requireManifestEqual(fields, "safety_review_status", "pass", "eval evidence");
    requireManifestEqual(fields, "no_cheat_status", "pass", "eval evidence");
    requireManifestEqual(fields, "no_cheat_failure_count", "0", "eval evidence");
    for (const key of [
      "quality_scope",
      "evaluator",
      "eval_dataset",
      "eval_summary",
      "quality_boundary"
    ]) {
      const value = requireManifestField(fields, key, "eval evidence");
      if (
        value.length < 8 ||
        value === "pending" ||
        value === "not-reviewed" ||
        value === "not-provided"
      ) {
        throw new Error(`Eval evidence field ${key} did not contain reviewed evidence`);
      }
    }
    for (const key of ["quality_scope", "quality_boundary", "eval_summary"]) {
      const value = requireManifestField(fields, key, "eval evidence").toLowerCase();
      if (
        value.includes("fixture") ||
        value.includes("plumbing") ||
        value.includes("not-product-assistant-quality")
      ) {
        throw new Error(`Eval evidence field ${key} contained non-product evidence`);
      }
    }
    requireCompositionEvidenceFields(fields, model, "eval evidence");
    const caseCount = registryDecimalCount(requireManifestField(fields, "case_count", "eval evidence"));
    const fixedCaseCount = registryDecimalCount(requireManifestField(fields, "fixed_case_count", "eval evidence"));
    const holdoutCaseCount = registryDecimalCount(requireManifestField(fields, "holdout_case_count", "eval evidence"));
    const holdoutSeed = registryDecimalCount(requireManifestField(fields, "holdout_seed", "eval evidence"));
    if (
      caseCount !== evalEvidence.casesPassed ||
      !fixedCaseCount ||
      !holdoutCaseCount ||
      !holdoutSeed ||
      fixedCaseCount + holdoutCaseCount !== caseCount
    ) {
      throw new Error("eval evidence fixed and holdout case counts were invalid");
    }
    let observedFixedCases = 0;
    let observedHoldoutCases = 0;
    for (let index = 0; index < caseCount; index += 1) {
      requireManifestEqual(fields, `case.${index}.status`, "pass", "eval evidence");
      const origin = requireManifestField(fields, `case.${index}.origin`, "eval evidence");
      if (origin === "fixed") {
        observedFixedCases += 1;
      } else if (origin === "holdout") {
        observedHoldoutCases += 1;
      } else {
        throw new Error(`eval evidence case ${index} origin was ${origin}`);
      }
      requireManifestField(fields, `case.${index}.prompt`, "eval evidence");
      requireManifestField(fields, `case.${index}.runtime_prompt`, "eval evidence");
      requireManifestField(fields, `case.${index}.raw_actual`, "eval evidence");
      requireManifestField(fields, `case.${index}.actual`, "eval evidence");
      requireManifestEqual(fields, `case.${index}.error`, "ok", "eval evidence");
      requireManifestEqual(fields, `case.${index}.quality_failures`, "none", "eval evidence");
      const diagnostics = requireManifestField(fields, `case.${index}.diagnostics`, "eval evidence");
      if (
        !diagnostics.includes('"model_loaded": true') ||
        !diagnostics.includes('"last_error": "ok"') ||
        !diagnostics.includes('"active_quantization_mode"')
      ) {
        throw new Error(`eval evidence case ${index} diagnostics were incomplete`);
      }
    }
    if (observedFixedCases !== fixedCaseCount || observedHoldoutCases !== holdoutCaseCount) {
      throw new Error("eval evidence case origins did not match fixed and holdout counts");
    }
    const sourceReview =
      model.sourceManifest && model.sourceManifest.sourceReview
        ? model.sourceManifest.sourceReview
        : null;
    if (sourceReview && sourceReview.verified) {
      requireManifestEqual(
        fields,
        "eval_cases_route",
        sourceReview.evalCasesRoute,
        "eval evidence route"
      );
    }
    requireChecksumEqual(evalCaseEvidenceChecksum(fields), evalEvidence.checksum, "eval case evidence");
    evalEvidence.fields = fields;
    evalEvidence.verified = true;
    return "eval evidence verified";
  }

  // Fetches and verifies conversation evidence before any associated model bytes are requested.
  async function loadConversationEvidence(model) {
    const evidence = model && model.conversationEvidence ? model.conversationEvidence : null;
    if (!evidence || !evidence.path) {
      return "conversation evidence unavailable";
    }
    evidence.verified = false;
    evidence.fields = null;
    const text = await fetchTextWithinBudget(
      evidence.path,
      evidenceTextByteBudget,
      "conversation evidence"
    );
    requireChecksumEqual(
      textChecksumHex(text),
      evidence.manifestChecksum,
      "conversation evidence"
    );
    const fields = parseManifest(text);
    requireManifestEqual(
      fields,
      "tinyrustlm_conversation_evidence_version",
      "1",
      "conversation evidence"
    );
    requireManifestEqual(fields, "evidence_status", "pass", "conversation evidence");
    requireManifestEqual(
      fields,
      "evidence_scope",
      evidence.qualityScope,
      "conversation evidence"
    );
    requireManifestEqual(
      fields,
      "quality_claim",
      "coherent-multi-turn-conversation-evidence-not-full-assistant-quality",
      "conversation evidence"
    );
    requireManifestEqual(fields, "source_identity", model.sourceIdentity, "conversation evidence");
    requireManifestEqual(fields, "source_revision", model.sourceRevision, "conversation evidence");
    requireManifestEqual(fields, "source_license", model.sourceLicense, "conversation evidence");
    requireManifestEqual(
      fields,
      "source_license_path",
      model.sourceLicensePath,
      "conversation evidence"
    );
    requireManifestEqual(
      fields,
      "source_license_sha256",
      model.sourceLicenseSha256,
      "conversation evidence"
    );
    requireManifestEqual(
      fields,
      "modification_notice_path",
      model.modificationNoticePath,
      "conversation evidence"
    );
    requireManifestEqual(fields, "artifact_path", model.path, "conversation evidence");
    requireManifestEqual(fields, "artifact_bytes", String(model.modelBytes), "conversation evidence");
    requireManifestEqual(fields, "artifact_sha256", model.artifactSha256, "conversation evidence");
    requireChecksumEqual(
      requireManifestField(fields, "slm_checksum", "conversation evidence"),
      model.slmChecksum,
      "conversation evidence model"
    );
    requireManifestEqual(
      fields,
      "manifest_path",
      `${model.path}.manifest`,
      "conversation evidence"
    );
    requireChecksumEqual(
      requireManifestField(fields, "manifest_checksum", "conversation evidence"),
      model.slmManifestChecksum,
      "conversation evidence manifest"
    );
    requireManifestEqual(fields, "model_shape", model.modelShape, "conversation evidence");
    requireManifestEqual(fields, "quantization", model.quantization, "conversation evidence");
    requireManifestEqual(fields, "prompt_format", model.promptFormat, "conversation evidence");
    requireManifestEqual(fields, "model_transfer", "owned-stream", "conversation evidence");
    requireManifestEqual(fields, "browser_load_status", "pass", "conversation evidence");
    requireManifestEqual(
      fields,
      "browser_load_bytes",
      String(model.modelBytes),
      "conversation evidence"
    );
    requireManifestEqual(
      fields,
      "browser_wasm_memory_bytes",
      String(model.estimatedWasmMemoryBytes),
      "conversation evidence"
    );
    requireManifestEqual(
      fields,
      "conversation_turn_count",
      String(evidence.turnsPassed),
      "conversation evidence"
    );
    for (let index = 0; index < evidence.turnsPassed; index += 1) {
      requireManifestField(fields, `turn.${index}.intent`, "conversation evidence");
      requireManifestField(fields, `turn.${index}.response`, "conversation evidence");
      requireManifestEqual(
        fields,
        `turn.${index}.output_transform`,
        "none",
        "conversation evidence"
      );
      requireManifestEqual(fields, `turn.${index}.status`, "pass", "conversation evidence");
    }
    requireManifestEqual(fields, "history_recall_status", "pass", "conversation evidence");
    requireManifestEqual(fields, "response_duplication", "false", "conversation evidence");
    requireManifestEqual(fields, "preference_reversal", "false", "conversation evidence");
    requireManifestEqual(
      fields,
      "conversation_output_integrity_status",
      "pass-real-wasm-output-no-substitution",
      "conversation evidence"
    );
    requireManifestEqual(
      fields,
      "no_prompt_specific_runtime_branches",
      "true",
      "conversation evidence"
    );
    requireManifestEqual(
      fields,
      "no_canned_response_substitution",
      "true",
      "conversation evidence"
    );
    requireManifestEqual(
      fields,
      "strict_eval_cases_passed",
      String(evidence.strictEvalCasesPassed),
      "conversation evidence"
    );
    requireManifestEqual(
      fields,
      "strict_eval_cases_failed",
      String(evidence.strictEvalCasesFailed),
      "conversation evidence"
    );
    requireManifestEqual(fields, "strict_eval_status", "not-admitted", "conversation evidence");
    requireManifestEqual(fields, "strict_eval_no_cheat_status", "fail", "conversation evidence");
    requireManifestEqual(fields, "known_limitation", "strict-json", "conversation evidence");
    requireManifestEqual(fields, "required_user_consent", "true", "conversation evidence");
    requireManifestEqual(fields, "default_model_status", "not-promoted", "conversation evidence");
    evidence.fields = fields;
    evidence.verified = true;
    return "conversation evidence verified";
  }

  function admissionArtifactMatchesModelPath(admissionArtifactPath, modelPath) {
    // Compares local admission artifact paths with the served browser model route suffix.
    if (!isSafeRegistryModelPath(modelPath)) {
      return false;
    }
    const rest = modelPath.slice("../models/".length);
    const normalized = String(admissionArtifactPath || "").replaceAll("\\", "/");
    return normalized === `../models/${rest}` || normalized.endsWith(`tinyrustlm/models/${rest}`);
  }

  function requireCompositionEvidenceFields(fields, model, source) {
    const composition = model && model.composition ? model.composition : null;
    if (!composition) {
      throw new Error(`${source} requires a selector composition graph`);
    }
    const graphFile = composition.path.split("/").pop();
    if (!graphFile || graphFile.length > 255) {
      throw new Error(`${source} composition graph path was invalid`);
    }
    requireManifestEqual(
      fields,
      "composition_graph_activation_status",
      "activated-before-eval",
      source
    );
    requireManifestEqual(fields, "composition_graph_file", graphFile, source);
    requireManifestEqual(fields, "composition_graph_bytes", String(composition.bytes), source);
    requireManifestEqual(fields, "composition_graph_sha256", composition.sha256, source);
    requireManifestEqual(fields, "composition_base_model_id", composition.baseModelId, source);
    requireManifestEqual(fields, "composition_id", composition.compositionId, source);
    requireManifestEqual(
      fields,
      "composition_active_graph_sha256",
      composition.activeGraphSha256,
      source
    );
    requireManifestEqual(
      fields,
      "composition_route_policy_id",
      composition.routePolicyId,
      source
    );
    requireManifestEqual(fields, "composition_kv_format_id", composition.kvFormatId, source);
    requireManifestEqual(
      fields,
      "composition_position_policy_sha256",
      composition.positionPolicySha256,
      source
    );
    requireManifestEqual(
      fields,
      "composition_member_count",
      String(composition.memberCount),
      source
    );
  }

  async function loadAdmissionEvidence(model) {
    // Verifies the selector admission record after all referenced evidence and before model bytes.
    const admission = model.admissionEvidence;
    if (!admission || !admission.path) {
      return "admission evidence unavailable";
    }
    if (model.sourceValidation && !model.sourceValidation.verified) {
      throw new Error("admission evidence requires verified source validation");
    }
    if (!model.runtimeSmokeEvidence || !model.runtimeSmokeEvidence.verified) {
      throw new Error("admission evidence requires verified runtime smoke evidence");
    }
    if (!model.evalEvidence || !model.evalEvidence.verified) {
      throw new Error("admission evidence requires verified eval evidence");
    }
    admission.verified = false;
    admission.fields = null;
    const text = await fetchTextWithinBudget(
      admission.path,
      evidenceTextByteBudget,
      "admission evidence"
    );
    requireChecksumEqual(textChecksumHex(text), admission.checksum, "admission evidence");
    const fields = parseManifest(text);
    requireManifestEqual(
      fields,
      "tinyrustlm_selector_admission_version",
      "2",
      "admission evidence"
    );
    requireManifestEqual(fields, "selector_id", "browser-local-selector", "admission evidence");
    requireManifestEqual(fields, "candidate_id", model.candidateId, "admission evidence");
    requireManifestEqual(fields, "admission_path", admission.path, "admission evidence");
    requireManifestEqual(
      fields,
      "admission_status",
      registryAdmissionStatus,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "promotion_status",
      registryAdmissionPromotionStatus,
      "admission evidence"
    );
    if (
      !admissionArtifactMatchesModelPath(
        requireManifestField(fields, "candidate_artifact_path", "admission evidence"),
        model.path
      )
    ) {
      throw new Error("admission evidence candidate artifact path mismatch");
    }
    requireManifestEqual(
      fields,
      "candidate_artifact_bytes",
      String(model.modelBytes),
      "admission evidence"
    );
    requireChecksumEqual(
      requireManifestField(fields, "candidate_slm_checksum", "admission evidence"),
      model.slmChecksum,
      "admission evidence candidate"
    );
    requireManifestEqual(
      fields,
      "candidate_model_shape",
      model.modelShape,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "candidate_quantization",
      model.quantization,
      "admission evidence"
    );
    requireChecksumEqual(
      requireManifestField(fields, "candidate_tokenizer_checksum", "admission evidence"),
      model.tokenizerChecksum,
      "admission evidence tokenizer"
    );
    if (model.sourceManifest) {
      requireManifestEqual(
        fields,
        "source_manifest_path",
        model.sourceManifest.path,
        "admission evidence"
      );
      requireChecksumEqual(
        requireManifestField(fields, "source_manifest_checksum", "admission evidence"),
        model.sourceManifest.checksum,
        "admission evidence source manifest"
      );
      if (model.sourceManifest.sourceReview) {
        requireManifestEqual(
          fields,
          "source_review_path",
          model.sourceManifest.sourceReview.path,
          "admission evidence"
        );
        requireChecksumEqual(
          requireManifestField(fields, "source_review_checksum", "admission evidence"),
          model.sourceManifest.sourceReview.checksum,
          "admission evidence source review"
        );
      }
    }
    if (model.sourceValidation) {
      requireManifestEqual(
        fields,
        "source_validation_path",
        model.sourceValidation.path,
        "admission evidence"
      );
      requireChecksumEqual(
        requireManifestField(fields, "source_validation_checksum", "admission evidence"),
        model.sourceValidation.checksum,
        "admission evidence source validation"
      );
    }
    requireManifestEqual(
      fields,
      "runtime_smoke_path",
      model.runtimeSmokeEvidence.path,
      "admission evidence"
    );
    requireChecksumEqual(
      requireManifestField(fields, "runtime_smoke_manifest_checksum", "admission evidence"),
      model.runtimeSmokeEvidence.manifestChecksum,
      "admission evidence runtime smoke"
    );
    requireManifestEqual(fields, "eval_path", model.evalEvidence.path, "admission evidence");
    requireChecksumEqual(
      requireManifestField(fields, "eval_manifest_checksum", "admission evidence"),
      model.evalEvidence.manifestChecksum,
      "admission evidence eval"
    );
    requireChecksumEqual(
      requireManifestField(fields, "eval_case_evidence_checksum", "admission evidence"),
      model.evalEvidence.checksum,
      "admission evidence eval cases"
    );
    requireManifestEqual(
      fields,
      "runtime_smoke_status",
      registryAdmissionRuntimeSmokeStatus,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "eval_status",
      registryAdmissionEvalStatus,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "quality_gate",
      registryAdmissionQualityGate,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "quality_scope",
      model.evalEvidence.qualityScope,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "quality_boundary",
      model.evalEvidence.qualityBoundary,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "eval_dataset",
      model.evalEvidence.evalDataset,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "cases_passed",
      String(model.evalEvidence.casesPassed),
      "admission evidence"
    );
    requireManifestEqual(fields, "cases_failed", "0", "admission evidence");
    requireManifestEqual(
      fields,
      "promotion_decision",
      registryAdmissionPromotionDecision,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "browser_selector_status",
      registryAdmissionBrowserSelectorStatus,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "public_claim_status",
      registryAdmissionPublicClaimStatus,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "required_next_gate",
      registryAdmissionRequiredNextGate,
      "admission evidence"
    );
    requireCompositionEvidenceFields(fields, model, "admission evidence");
    admission.fields = fields;
    admission.verified = true;
    return "admission evidence verified";
  }

  function setInteractive(enabled) {
    setControls(enabled, enabled);
  }

  function activeSelectorCompositionMatchesRuntime() {
    const composition = state.activeComposition;
    const diagnostics = state.exports ? readDiagnosticsJson() : null;
    return Boolean(
      state.modelLoaded &&
      composition &&
      diagnostics &&
      diagnostics.model_loaded === true &&
      diagnostics.composition_active === true &&
      diagnostics.active_composition_bundle_sha256 === composition.sha256 &&
      diagnostics.active_composition_id === composition.compositionId &&
      diagnostics.active_composition_graph_sha256 === composition.activeGraphSha256 &&
      diagnostics.active_route_policy_id === composition.routePolicyId &&
      diagnostics.active_kv_format_id === composition.kvFormatId &&
      diagnostics.active_composition_member_count === composition.memberCount
    );
  }

  function setControls(canGenerate, canSelectModel) {
    const generationEnabled = Boolean(canGenerate) && activeSelectorCompositionMatchesRuntime();
    state.controlsCanGenerate = generationEnabled;
    state.controlsCanSelectModel = Boolean(canSelectModel);
    el.generateButton.disabled = state.generation.inFlight ? false : !generationEnabled;
    el.stepTokenButton.disabled = !generationEnabled || !state.hasContext;
    el.resetButton.disabled = !generationEnabled;
    el.modelSelect.disabled = state.generation.inFlight || !canSelectModel || !state.exports;
  }

  function setGenerationUi(status) {
    const active = status === "waiting" || status === "generating" || status === "streaming";
    state.generation.inFlight = active;
    if (el.appShell) {
      el.appShell.dataset.generationState = active ? status : "idle";
    }
    if (el.generateButton) {
      el.generateButton.dataset.action = active ? "stop" : "send";
      el.generateButton.setAttribute("aria-label", active ? "Stop response" : "Send message");
      el.generateButton.title = active ? "Stop response" : "Send message";
      el.generateButton.disabled = active ? false : !state.controlsCanGenerate;
    }
    if (el.sendIcon) {
      el.sendIcon.hidden = active;
    }
    if (el.stopIcon) {
      el.stopIcon.hidden = !active;
    }
    if (el.modelSelect) {
      el.modelSelect.disabled = active || !state.controlsCanSelectModel || !state.exports;
    }
    if (el.composerHint && !state.conversationPersistenceBlocked) {
      el.composerHint.textContent = active
        ? (state.generation.stopRequested ? "Stopping after the current local operation" : "Generating locally")
        : "Ready for a message";
    }
  }

  function requestGenerationStop() {
    if (!state.generation.inFlight) {
      return false;
    }
    state.generation.stopRequested = true;
    setGenerationUi(el.appShell ? el.appShell.dataset.generationState : "streaming");
    return true;
  }

  function nextBrowserPaint() {
    return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  function startGeneration(assistantMessageId) {
    state.generation.sequence += 1;
    state.generation.assistantMessageId = assistantMessageId;
    state.generation.stopRequested = false;
    setText(el.runtimeStatus, "Generating", false);
    setGenerationUi("waiting");
    updateAssistantMessage(assistantMessageId, { status: "generating", text: "", errorCode: "" });
    setGenerationUi("generating");
    setControls(false, false);
    return state.generation.sequence;
  }

  function stopBeforeInference(assistantMessageId, sequence) {
    if (!state.generation.stopRequested || sequence !== state.generation.sequence) {
      return false;
    }
    updateAssistantMessage(assistantMessageId, {
      status: "stopped",
      text: "",
      errorCode: "stopped_by_user"
    });
    setText(el.runtimeStatus, "Stopped", false);
    setGenerationUi("idle");
    state.generation.assistantMessageId = "";
    state.generation.stopRequested = false;
    setControls(state.modelLoaded, Boolean(state.exports));
    runPendingGenerationAction();
    return true;
  }

  function runPendingGenerationAction() {
    const action = state.generation.pendingAction;
    state.generation.pendingAction = "";
    if (action === "new-chat") {
      window.requestAnimationFrame(startNewConversation);
    }
  }

  function rejectedGeneration(text) {
    return /\b(?:rejected|quality gate|degenerate|output contract|unusable)\b/i.test(String(text || ""));
  }

  async function deliverGeneratedOutput(assistantMessageId, output, code, sequence) {
    const text = String(output || "");
    if (sequence !== state.generation.sequence) {
      return;
    }
    if (code !== 0) {
      const rejected = rejectedGeneration(text);
      updateAssistantMessage(assistantMessageId, {
        status: rejected ? "rejected" : "failed",
        text,
        errorCode: rejected ? "generation_rejected" : "generation_failed"
      });
      setText(el.runtimeStatus, rejected ? "Generation rejected" : "Generate failed", true);
      renderSimpleError("", false);
      setGenerationUi("idle");
      state.generation.assistantMessageId = "";
      state.generation.stopRequested = false;
      setControls(state.modelLoaded, Boolean(state.exports));
      runPendingGenerationAction();
      return;
    }

    // WASM returns synchronously; progressive delivery reveals only that returned output.
    updateAssistantMessage(assistantMessageId, { status: "streaming", text: "", errorCode: "" }, false);
    setGenerationUi("streaming");
    const characters = Array.from(text);
    const chunkSize = Math.max(4, Math.ceil(characters.length / 24));
    let delivered = "";
    for (let index = 0; index < characters.length; index += chunkSize) {
      if (state.generation.stopRequested || sequence !== state.generation.sequence) {
        if (state.exports && typeof state.exports.reset_context === "function") {
          state.exports.reset_context();
        }
        state.hasContext = false;
        updateAssistantMessage(assistantMessageId, {
          status: "stopped",
          text: delivered,
          errorCode: "stopped_by_user"
        });
        setText(el.runtimeStatus, "Stopped", false);
        setGenerationUi("idle");
        state.generation.assistantMessageId = "";
        state.generation.stopRequested = false;
        setControls(state.modelLoaded, Boolean(state.exports));
        runPendingGenerationAction();
        return;
      }
      delivered += characters.slice(index, index + chunkSize).join("");
      updateAssistantMessage(assistantMessageId, { status: "streaming", text: delivered }, false);
      await nextBrowserPaint();
    }
    updateAssistantMessage(assistantMessageId, { status: "completed", text, errorCode: "" });
    setText(el.runtimeStatus, "Ready", false);
    setGenerationUi("idle");
    state.generation.assistantMessageId = "";
    state.generation.stopRequested = false;
    setControls(state.modelLoaded, Boolean(state.exports));
    runPendingGenerationAction();
  }

  function freeLoadedModelForSwitch(previousModelKey, selectedModel, wasModelLoaded) {
    if (!state.exports || typeof state.exports.free_model !== "function" || !wasModelLoaded) {
      return true;
    }
    const code = state.exports.free_model();
    const text = readLastResult() || `free_model returned ${code}`;
    appendConsole(`free_model(${previousModelKey || "unknown"} -> ${selectedModel}) -> ${code}\n${text}`);
    renderDiagnostics();
    if (code !== 0) {
      throw new Error(text);
    }
    state.activeComposition = null;
    return true;
  }

  function resetRuntimeBeforeComposition(selectedModel) {
    if (!state.exports || typeof state.exports.reset_context !== "function") {
      throw new Error("WASM runtime does not expose context reset");
    }
    const code = state.exports.reset_context();
    const text = readLastResult() || `reset_context returned ${code}`;
    appendConsole(`reset_context(${selectedModel}) -> ${code}\n${text}`);
    renderDiagnostics();
    if (code !== 0) {
      throw new Error(text);
    }
    state.hasContext = false;
    state.lastMeasuredTokens = 0;
    return true;
  }

  function activateAdmittedComposition(model, graphBytes) {
    const composition = model && model.composition ? model.composition : null;
    if (!composition || !(graphBytes instanceof Uint8Array)) {
      throw new Error("Admitted composition graph was not available for activation");
    }
    if (
      !state.exports ||
      typeof state.exports.validate_composition_graph !== "function" ||
      typeof state.exports.activate_composition_graph !== "function"
    ) {
      throw new Error("WASM runtime does not expose immutable composition activation");
    }
    const digestBytes = hexToBytes(composition.sha256);
    let graphPtr = 0;
    let digestPtr = 0;
    try {
      graphPtr = allocCopy(graphBytes);
      digestPtr = allocCopy(digestBytes);
      const validateCode = state.exports.validate_composition_graph(
        graphPtr,
        graphBytes.length,
        digestPtr,
        digestBytes.length
      );
      const validateText =
        readLastResult() || `validate_composition_graph returned ${validateCode}`;
      appendConsole(
        `validate_composition_graph(${model.candidateId || model.label || model.path}) -> ${validateCode}\n${validateText}`
      );
      if (validateCode !== 0) {
        throw new Error(validateText);
      }
      const activateCode = state.exports.activate_composition_graph(
        graphPtr,
        graphBytes.length,
        digestPtr,
        digestBytes.length
      );
      const activateText =
        readLastResult() || `activate_composition_graph returned ${activateCode}`;
      appendConsole(
        `activate_composition_graph(${model.candidateId || model.label || model.path}) -> ${activateCode}\n${activateText}`
      );
      if (activateCode !== 0) {
        throw new Error(activateText);
      }
    } finally {
      release(digestPtr, digestBytes.length);
      release(graphPtr, graphBytes.length);
    }
    const diagnostics = readDiagnosticsJson();
    if (
      !diagnostics ||
      diagnostics.model_loaded !== true ||
      diagnostics.composition_active !== true ||
      diagnostics.active_composition_bundle_sha256 !== composition.sha256 ||
      diagnostics.active_composition_id !== composition.compositionId ||
      diagnostics.active_composition_graph_sha256 !== composition.activeGraphSha256 ||
      diagnostics.active_route_policy_id !== composition.routePolicyId ||
      diagnostics.active_kv_format_id !== composition.kvFormatId ||
      diagnostics.active_composition_member_count !== composition.memberCount
    ) {
      throw new Error("Activated composition diagnostics did not match the admission");
    }
    state.activeComposition = Object.freeze({ ...composition });
    renderDiagnostics();
  }

  async function loadSelectedModel() {
    const loadId = state.modelLoadSequence + 1;
    state.modelLoadSequence = loadId;
    const selectedValue = el.modelSelect.value;
    const selectedModel = paths.models[selectedValue]
      ? selectedValue
      : isPublicLocalOnlyHost() && !state.localModel
        ? ""
        : paths.models[localModelKey]
          ? localModelKey
          : Object.keys(paths.models)[0] || "";
    if (!selectedModel) {
      state.activeModelKey = "";
      state.activeComposition = null;
      state.modelLoaded = false;
      state.hasContext = false;
      setInteractive(false);
      renderProvenance("choose a local or P2P .slm", null, false);
      setText(el.runtimeStatus, state.exports ? "Runtime ready" : "Booting", false);
      setText(el.modelState, "choose a local or P2P .slm", false);
      setText(el.errorState, "none", false);
      renderDiagnostics();
      setControls(false, Boolean(state.exports && Object.keys(paths.models).length > 0));
      return false;
    }
    const model = paths.models[selectedModel];
    const previousModelKey = state.activeModelKey;
    const releaseLoadedModel = state.modelLoaded === true;
    el.modelSelect.value = selectedModel;
    const modelPath = model.path;
    if (el.maxTokens && !el.maxTokens.dataset.userEdited && !el.maxTokens.dataset.presetApplied) {
      el.maxTokens.value = el.maxTokens.value || String(model.maxTokens);
    }
    syncRangeControls();
    state.activeModelKey = selectedModel;
    if (state.memoryEndpoints.packedModelKey && state.memoryEndpoints.packedModelKey !== selectedModel) {
      state.memoryEndpoints.packedContext = null;
      state.memoryEndpoints.packedModelKey = "";
      state.memoryEndpoints.retrievalReceipt = null;
      state.memoryEndpoints.searchResults = state.memoryEndpoints.retrievalResults.map((result) => ({
        ...result,
        contextEligible: false
      })).slice(0, memoryEndpointsMaxPreviewResults);
    }
    state.modelLoaded = false;
    state.activeComposition = null;
    state.hasContext = false;
    state.lastMeasuredTokens = 0;
    document.documentElement.dataset.modelTransfer = "loading";
    if (model.sourceManifest) {
      model.sourceManifestVerified = false;
      model.sourceManifestFields = null;
      if (model.sourceManifest.sourceReview) {
        model.sourceManifest.sourceReview.verified = false;
        model.sourceManifest.sourceReview.fields = null;
      }
    }
    if (model.sourceValidation) {
      model.sourceValidation.verified = false;
      model.sourceValidation.fields = null;
    }
    if (model.runtimeSmokeEvidence) {
      model.runtimeSmokeEvidence.verified = false;
      model.runtimeSmokeEvidence.fields = null;
    }
    if (model.evalEvidence) {
      model.evalEvidence.verified = false;
      model.evalEvidence.fields = null;
    }
    if (model.conversationEvidence) {
      model.conversationEvidence.verified = false;
      model.conversationEvidence.fields = null;
    }
    if (model.admissionEvidence) {
      model.admissionEvidence.verified = false;
      model.admissionEvidence.fields = null;
    }
    setLocalFileVerificationState(model, false);
    setInteractive(false);
    el.response.textContent = "";
    el.console.textContent = "";
    if (releaseLoadedModel) {
      freeLoadedModelForSwitch(previousModelKey, selectedModel, releaseLoadedModel);
    }
    state.modelManifest = null;
    clearBrowserAdmissionDiagnostics();
    renderProvenance("waiting for accepted model", null, false);
    setText(el.runtimeStatus, "Loading local model");
    setText(el.modelState, "loading");
    const started = performance.now();
    let modelTransfer = null;
    let compositionGraphBytes = null;
    try {
      if (model.companionImport) {
        modelTransfer = await fetchCompanionModelTransfer(model, loadId);
        compositionGraphBytes = await fetchAdmittedCompositionGraph(model, loadId);
      } else if (model.localFile) {
        modelTransfer = model.localFile.pendingTransfer || null;
        model.localFile.pendingTransfer = null;
        if (!modelTransfer || modelTransfer.consumed) {
          throw new Error("Local import transfer was not available");
        }
        compositionGraphBytes = await fetchAdmittedCompositionGraph(model, loadId);
      } else {
        await loadSourceManifest(model);
        await loadSourceReviewEvidence(model);
        await loadSourceValidationEvidence(model);
        await loadRuntimeSmokeEvidence(model);
        await loadEvalEvidence(model);
        await loadConversationEvidence(model);
        await loadAdmissionEvidence(model);
        compositionGraphBytes = await fetchAdmittedCompositionGraph(model, loadId);
        modelTransfer = await fetchOwnedModelTransfer(
        model,
        modelPath,
        ".slm model",
        loadId
      );
      }
    } catch (error) {
      discardOwnedModelTransfer(modelTransfer);
      if (loadId !== state.modelLoadSequence) {
        return false;
      }
      state.modelLoadMs = Math.round(performance.now() - started);
      state.lastGenerateMs = 0;
      state.modelLoaded = false;
      state.activeComposition = null;
      state.hasContext = false;
      state.lastMeasuredTokens = 0;
      setText(el.modelState, "fetch error", true);
      setText(el.runtimeStatus, "Model load failed", true);
      setText(el.errorState, errorMessage(error), true);
      renderProvenance("model not loaded", null, true);
      setLocalFileVerificationState(model, false);
      setControls(false, true);
      renderDiagnostics();
      return false;
    }
    if (loadId !== state.modelLoadSequence) {
      discardOwnedModelTransfer(modelTransfer);
      return false;
    }
    if (!modelTransfer) {
      throw new Error("Admitted model transfer was not created");
    }
    document.documentElement.dataset.modelTransfer = modelTransfer.mode || "owned-transfer";
    const loadCode = consumeOwnedModelTransfer(modelTransfer);
    if (loadId !== state.modelLoadSequence) {
      return false;
    }
    state.modelLoadMs = Math.round(performance.now() - started);
    state.lastGenerateMs = 0;
    state.modelLoaded = false;
    state.activeComposition = null;
    document.documentElement.dataset.activeModel = "";
    state.hasContext = false;
    state.lastMeasuredTokens = 0;
    setText(
      el.modelState,
      loadCode === 0 ? "activating composition" : `error ${loadCode}`,
      loadCode !== 0
    );
    setText(
      el.runtimeStatus,
      loadCode === 0 ? "Activating composition" : "Model rejected",
      loadCode !== 0
    );
    setText(el.errorState, loadCode === 0 ? "none" : readLastResult(), loadCode !== 0);
    if (loadCode === 0) {
      try {
        resetRuntimeBeforeComposition(selectedModel);
        activateAdmittedComposition(model, compositionGraphBytes);
      } catch (error) {
        const text = errorMessage(error);
        if (typeof state.exports.free_model === "function") {
          state.exports.free_model();
        }
        state.modelLoaded = false;
        state.activeComposition = null;
        state.hasContext = false;
        state.lastMeasuredTokens = 0;
        setText(el.modelState, "composition activation rejected", true);
        setText(el.runtimeStatus, "Model load failed", true);
        setText(el.errorState, text, true);
        renderProvenance("model not loaded", null, true);
        setLocalFileVerificationState(model, false);
        setControls(false, true);
        renderDiagnostics();
        return false;
      }
      state.modelLoaded = true;
      document.documentElement.dataset.activeModel = selectedModel;
      setText(el.modelState, `loaded (${state.modelLoadMs} ms)`, false);
      setText(el.runtimeStatus, "Ready", false);
      setText(el.errorState, "none", false);
      if (model.localFile) {
        const receiptSummary = localImportReceiptSummary(model.localFile.importReceipt);
        setLocalModelStatus(
          `${model.localFile.name} / ${formatByteCount(model.localFile.byteLength)} / ${model.localFile.sha256} / ${model.localFile.checksum}${receiptSummary ? ` / ${receiptSummary}` : ""} / loaded`,
          false
        );
      }
      renderProvenance("loading local manifest", null, false);
      await loadModelManifest(model);
      if (loadId !== state.modelLoadSequence) {
        return false;
      }
    } else {
      renderProvenance("model rejected", null, true);
    }
    setLocalFileVerificationState(model, loadCode === 0);
    if (loadCode === 0 && state.memoryEndpoints.retrievalCandidates.length > 0) {
      await refreshMemoryEndpointsPackedContext();
      renderMemoryEndpointsSearchResults();
    }
    if (model.companionImport) {
      setCompanionStatus(
        "paired",
        loadCode === 0
          ? `${model.label} loaded from verified companion storage`
          : `${model.label} was rejected by the browser runtime`,
        loadCode !== 0
      );
    }
    setControls(loadCode === 0, true);
    renderDiagnostics();
    return loadCode === 0;
  }

  async function boot() {
    try {
      setText(el.runtimeStatus, "Loading runtime");
      setInteractive(false);
      const wasmBytes = await loadRuntimeWasmBytes();
      state.instance = await WebAssembly.instantiate(wasmBytes, {});
      state.exports = state.instance.instance.exports;
      state.wasmMemoryInitialPages = wasmMemoryInitialPages();
      const initCode = state.exports.init_runtime();
      setText(el.wasmState, initCode === 0 ? "loaded" : `error ${initCode}`, initCode !== 0);
      if (initCode !== 0) {
        setText(el.runtimeStatus, "Runtime rejected", true);
        setText(el.errorState, readLastResult(), true);
        renderDiagnostics();
        return;
      }
      restoreImportedModelOptions();
      await loadSelectorRegistry();
      await loadSelectedModel();
    } catch (error) {
      setText(el.runtimeStatus, "Boot failed", true);
      setText(el.modelState, "boot error", true);
      setText(el.errorState, errorMessage(error), true);
    }
  }

  el.form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (state.generation.inFlight) {
      requestGenerationStop();
      return;
    }
    if (!state.exports) {
      return;
    }
    if (!activeSelectorCompositionMatchesRuntime()) {
      setText(el.runtimeStatus, "Composition required", true);
      setText(
        el.errorState,
        "Generation requires the exact admitted selector composition",
        true
      );
      setControls(false, Boolean(state.exports));
      return;
    }
    if (el.appShell && el.appShell.dataset.mode === "simple") {
      syncSemanticControls(true);
    }
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
    state.modelPopoverHoldUntil = 0;
    toggleModelPopover(false);
    const assistantMessage = beginConversationTurn(promptText);
    const generationSequence = startGeneration(assistantMessage.id);
    await nextBrowserPaint();
    if (stopBeforeInference(assistantMessage.id, generationSequence)) {
      return;
    }
    state.lastInferenceHistoryTurns = 0;
    const calculatorRequest = calculatorApi.parseRequest(promptText);
    if (calculatorRequest && typeof state.exports.calculate === "function") {
      const expressionBytes = state.encoder.encode(calculatorRequest.expression);
      let ptr = 0;
      let code = 1;
      let result = "";
      const started = performance.now();
      try {
        ptr = allocCopy(expressionBytes);
        code = state.exports.calculate(ptr, expressionBytes.length);
        result = readLastResult();
      } catch (error) {
        result = errorMessage(error);
      } finally {
        if (ptr) {
          release(ptr, expressionBytes.length);
        }
      }
      const text = code === 0
        ? calculatorApi.formatResponse(calculatorRequest.expression, result)
        : result || "calculator failed";
      state.lastGenerateMs = Math.round(performance.now() - started);
      state.lastMeasuredTokens = 0;
      const memorySuffix = runtimeMemorySuffix();
      el.console.textContent = `calculate(route=${calculatorRequest.route}${memorySuffix}) -> ${code} in ${state.lastGenerateMs} ms\n${text}`;
      setText(el.errorState, code === 0 ? "none" : text, code !== 0);
      await deliverGeneratedOutput(assistantMessage.id, text, code, generationSequence);
      renderDiagnostics();
      captureRun(promptText, text, code !== 0);
      return;
    }
    let runtimePromptText = "";
    try {
      runtimePromptText = runtimePromptForModel(promptText);
    } catch (error) {
      const text = errorMessage(error);
      setText(el.errorState, text, true);
      el.console.textContent = text;
      await deliverGeneratedOutput(assistantMessage.id, text, 1, generationSequence);
      renderDiagnostics();
      captureRun(promptText, text, true);
      return;
    }
    const bytes = state.encoder.encode(runtimePromptText);
    // Keeps prompt transfer bytes inside the runtime input envelope.
    if (bytes.length > runtimePromptByteLimit) {
      const text = "prompt byte limit exceeded";
      setText(el.errorState, text, true);
      el.console.textContent = text;
      await deliverGeneratedOutput(assistantMessage.id, text, 1, generationSequence);
      renderDiagnostics();
      captureRun(promptText, text, true);
      return;
    }
    let ptr = 0;
    try {
      ptr = allocCopy(bytes);
    } catch (error) {
      const text = errorMessage(error);
      setText(el.errorState, text, true);
      el.console.textContent = text;
      await deliverGeneratedOutput(assistantMessage.id, text, 1, generationSequence);
      renderDiagnostics();
      captureRun(promptText, text, true);
      return;
    }
    const maxTokens = Math.max(1, Math.min(512, Number.parseInt(el.maxTokens.value, 10) || 1));
    el.maxTokens.value = String(maxTokens);
    syncRangeControls();
    let sampling = null;
    try {
      sampling = applySamplingConfig();
    } catch (error) {
      release(ptr, bytes.length);
      const text = errorMessage(error);
      setText(el.errorState, text, true);
      el.console.textContent = text;
      await deliverGeneratedOutput(assistantMessage.id, text, 1, generationSequence);
      renderDiagnostics();
      captureRun(promptText, text, true);
      return;
    }
    if (expectsTwoSentencePrompt(promptText) && typeof state.exports.generate_two_sentence_text === "function") {
      release(ptr, bytes.length);
      state.lastInferenceHistoryTurns = 0;
      setControls(false, false);
      setText(el.runtimeStatus, "Generating", false);
      const started = performance.now();
      let code = 0;
      let text = "";
      let firstBytes = null;
      let secondBytes = null;
      let firstPtr = 0;
      let secondPtr = 0;
      let variantIndex = 0;
      try {
        const variants = twoSentenceFieldPromptVariants(promptText);
        for (let index = 0; index < variants.length; index += 1) {
          variantIndex = index;
          const firstPrompt = runtimePromptForModel(variants[index].first, {
            includeHistory: false,
            trackHistory: false
          });
          const secondPrompt = runtimePromptForModel(variants[index].second, {
            includeHistory: false,
            trackHistory: false
          });
          firstBytes = state.encoder.encode(firstPrompt);
          secondBytes = state.encoder.encode(secondPrompt);
          if (
            firstBytes.length > runtimePromptByteLimit ||
            secondBytes.length > runtimePromptByteLimit
          ) {
            throw new Error("two-sentence prompt byte limit exceeded");
          }
          firstPtr = allocCopy(firstBytes);
          secondPtr = allocCopy(secondBytes);
          code = state.exports.generate_two_sentence_text(
            firstPtr,
            firstBytes.length,
            secondPtr,
            secondBytes.length,
            twoSentenceFieldBudget(maxTokens),
            twoSentenceFieldBudget(maxTokens)
          );
          text = readLastResult();
          release(firstPtr, firstBytes.length);
          release(secondPtr, secondBytes.length);
          firstPtr = 0;
          secondPtr = 0;
          firstBytes = null;
          secondBytes = null;
          if (code === 0 && twoSentenceOutputLooksUsable(text, promptText)) {
            break;
          }
        }
      } catch (error) {
        code = 1;
        text = errorMessage(error);
      } finally {
        if (firstPtr && firstBytes) {
          release(firstPtr, firstBytes.length);
        }
        if (secondPtr && secondBytes) {
          release(secondPtr, secondBytes.length);
        }
      }
      state.lastGenerateMs = Math.round(performance.now() - started);
      state.lastMeasuredTokens = 0;
      state.latestSampling = sampling;
      state.hasContext = false;
      const memorySuffix = runtimeMemorySuffix();
      el.console.textContent = `generate_two_sentence_text(variant=${variantIndex}, max_new_tokens=${maxTokens}, temperature=${sampling.temperature}, top_k=${sampling.topK}, top_p=${sampling.topP}, seed=${sampling.seed}${memorySuffix}) -> ${code} in ${state.lastGenerateMs} ms\n${text}`;
      setText(el.errorState, code === 0 ? "none" : text, code !== 0);
      await deliverGeneratedOutput(assistantMessage.id, text, code, generationSequence);
      renderDiagnostics();
      captureRun(promptText, text, code !== 0);
      return;
    }
    if (expectsJsonObjectPrompt(promptText) && typeof state.exports.generate_status_reason_json === "function") {
      release(ptr, bytes.length);
      state.lastInferenceHistoryTurns = 0;
      setControls(false, false);
      setText(el.runtimeStatus, "Generating", false);
      const started = performance.now();
      let code = 0;
      let text = "";
      let statusBytes = null;
      let reasonBytes = null;
      let statusPtr = 0;
      let reasonPtr = 0;
      try {
        const statusPrompt = runtimePromptForModel(statusReasonJsonFieldPrompt(promptText, "status"), {
          includeHistory: false,
          trackHistory: false
        });
        const reasonPrompt = runtimePromptForModel(statusReasonJsonFieldPrompt(promptText, "reason"), {
          includeHistory: false,
          trackHistory: false
        });
        statusBytes = state.encoder.encode(statusPrompt);
        reasonBytes = state.encoder.encode(reasonPrompt);
        if (
          statusBytes.length > runtimePromptByteLimit ||
          reasonBytes.length > runtimePromptByteLimit
        ) {
          throw new Error("structured JSON prompt byte limit exceeded");
        }
        statusPtr = allocCopy(statusBytes);
        reasonPtr = allocCopy(reasonBytes);
        code = state.exports.generate_status_reason_json(
          statusPtr,
          statusBytes.length,
          reasonPtr,
          reasonBytes.length,
          statusReasonJsonFieldBudget("status", maxTokens),
          statusReasonJsonFieldBudget("reason", maxTokens)
        );
        text = readLastResult();
      } catch (error) {
        code = 1;
        text = errorMessage(error);
      } finally {
        if (statusPtr && statusBytes) {
          release(statusPtr, statusBytes.length);
        }
        if (reasonPtr && reasonBytes) {
          release(reasonPtr, reasonBytes.length);
        }
      }
      state.lastGenerateMs = Math.round(performance.now() - started);
      state.lastMeasuredTokens = 0;
      state.latestSampling = sampling;
      state.hasContext = false;
      const memorySuffix = runtimeMemorySuffix();
      el.console.textContent = `generate_status_reason_json(max_new_tokens=${maxTokens}, temperature=${sampling.temperature}, top_k=${sampling.topK}, top_p=${sampling.topP}, seed=${sampling.seed}${memorySuffix}) -> ${code} in ${state.lastGenerateMs} ms\n${text}`;
      setText(el.errorState, code === 0 ? "none" : text, code !== 0);
      await deliverGeneratedOutput(assistantMessage.id, text, code, generationSequence);
      renderDiagnostics();
      captureRun(promptText, text, code !== 0);
      return;
    }
    setControls(false, false);
    setText(el.runtimeStatus, "Generating", false);
    const started = performance.now();
    let code = 1;
    let text = "";
    try {
      code = state.exports.generate(ptr, bytes.length, maxTokens);
      text = readLastResult();
    } catch (error) {
      text = errorMessage(error);
    } finally {
      release(ptr, bytes.length);
    }
    state.lastGenerateMs = Math.round(performance.now() - started);
    state.lastMeasuredTokens = 0;
    state.latestSampling = sampling;
    state.hasContext = code === 0;
    const memorySuffix = runtimeMemorySuffix();
    el.console.textContent = `generate(max_new_tokens=${maxTokens}, temperature=${sampling.temperature}, top_k=${sampling.topK}, top_p=${sampling.topP}, seed=${sampling.seed}, repetition_penalty=${sampling.repetitionPenalty}${memorySuffix}) -> ${code} in ${state.lastGenerateMs} ms\n${text}`;
    setText(el.errorState, code === 0 ? "none" : text, code !== 0);
    await deliverGeneratedOutput(assistantMessage.id, text, code, generationSequence);
    renderDiagnostics();
    captureRun(promptText, text, code !== 0);
  });

  el.stepTokenButton.addEventListener("click", function () {
    if (!state.exports || !state.hasContext || !activeSelectorCompositionMatchesRuntime()) {
      return;
    }
    let sampling = null;
    try {
      sampling = applySamplingConfig();
    } catch (error) {
      const text = errorMessage(error);
      setText(el.errorState, text, true);
      appendConsole(text);
      renderDiagnostics();
      setControls(true, true);
      return;
    }
    setControls(false, false);
    setText(el.runtimeStatus, "Generating", false);
    const started = performance.now();
    const code = state.exports.generate_next_token();
    state.lastGenerateMs = Math.round(performance.now() - started);
    const text = readLastResult();
    const resultText = text || `generate_next_token failed (${code})`;
    const consoleText = `generate_next_token(temperature=${sampling.temperature}, top_k=${sampling.topK}, top_p=${sampling.topP}, seed=${sampling.seed}, repetition_penalty=${sampling.repetitionPenalty}) -> ${code} in ${state.lastGenerateMs} ms\n${resultText}`;
    state.lastMeasuredTokens = code === 0 ? 1 : 0;
    state.hasContext = code === 0;
    appendConsole(consoleText);
    if (code === 0) {
      setText(el.errorState, "none", false);
      setText(el.runtimeStatus, "Ready", false);
      extendAssistantMessage(text);
    } else {
      setText(el.errorState, resultText, true);
      setText(el.runtimeStatus, "Step token failed", true);
      const conversation = activeConversation();
      const latestAssistant = conversation ? conversationApi.latestAssistantMessage(conversation) : null;
      if (latestAssistant) {
        updateAssistantMessage(latestAssistant.id, {
          status: "failed",
          text: latestAssistant.text ? `${latestAssistant.text}\n\n${resultText}` : resultText,
          errorCode: "step_token_failed"
        });
      }
    }
    renderDiagnostics();
    captureRun(el.prompt ? el.prompt.value : "", resultText, code !== 0);
    setControls(true, true);
  });

  el.modelSelect.addEventListener("change", function () {
    if (!state.exports) {
      return;
    }
    loadSelectedModelWithConsent().catch((error) => {
      setText(el.runtimeStatus, "Model load failed", true);
      setText(el.modelState, "unexpected error", true);
      setText(el.errorState, errorMessage(error), true);
      setControls(false, Boolean(state.exports));
    });
  });

  el.importLocalModelButton.addEventListener("click", function () {
    importLocalModelFile().catch((error) => {
      const text = errorMessage(error);
      setLocalModelStatus(text, true);
      setText(el.errorState, text, true);
      if (state.exports) {
        setControls(state.modelLoaded, true);
      }
    });
  });

  el.localModelFile.addEventListener("change", function () {
    const selectedFiles = localModelSelectedFiles();
    const selectionError = localModelSelectionError(selectedFiles);
    if (selectionError) {
      setLocalModelStatus(selectionError, true);
      return;
    }
    const file = selectedFiles.slm;
    if (!file) {
      setLocalModelStatus("waiting", false);
      return;
    }
    const name = safeLocalModelName(file.name);
    const expected = state.selectedCatalogEntry
      ? ` / expecting ${state.selectedCatalogEntry.displayName}`
      : "";
    const receipt = selectedFiles.receipt ? " / MiniModel receipt selected" : "";
    setLocalModelStatus(`${name} / ${formatByteCount(file.size)} selected${receipt}${expected}`, false);
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
    input.addEventListener("change", function () {
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
      state.memoryEndpoints.bearerToken = el.memoryEndpointsToken.value.trim();
      state.memoryEndpoints.connected = false;
      setMemoryEndpointsStatus(
        state.memoryEndpoints.bearerToken ? "workspace key entered for this session" : "workspace key not stored",
        false
      );
    });
  }

  if (el.memoryEndpointsClaimButton) {
    el.memoryEndpointsClaimButton.addEventListener("click", function () {
      el.memoryEndpointsClaimButton.disabled = true;
      claimMemoryEndpointsEnrollment().catch((error) => {
        state.memoryEndpoints.connected = false;
        setMemoryEndpointsStatus(errorMessage(error), true);
      }).finally(() => {
        el.memoryEndpointsClaimButton.disabled = false;
      });
    });
  }

  if (el.memoryEndpointsReconnectButton) {
    el.memoryEndpointsReconnectButton.addEventListener("click", function () {
      el.memoryEndpointsReconnectButton.disabled = true;
      reconnectMemoryEndpointsAgent().catch((error) => {
        state.memoryEndpoints.connected = false;
        setMemoryEndpointsStatus(errorMessage(error), true);
      }).finally(() => {
        el.memoryEndpointsReconnectButton.disabled = false;
      });
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
      connectMemoryEndpoints().catch((error) => {
        state.memoryEndpoints.connected = false;
        setMemoryEndpointsStatus(errorMessage(error), true);
      });
    });
  }

  if (el.memoryEndpointsSaveShortTermButton) {
    el.memoryEndpointsSaveShortTermButton.addEventListener("click", function () {
      saveMemoryEndpoints("short_term").catch((error) => {
        setMemoryEndpointsStatus(errorMessage(error), true);
      });
    });
  }

  if (el.memoryEndpointsSaveLongTermButton) {
    el.memoryEndpointsSaveLongTermButton.addEventListener("click", function () {
      saveMemoryEndpoints("long_term").catch((error) => {
        setMemoryEndpointsStatus(errorMessage(error), true);
      });
    });
  }

  if (el.memoryEndpointsSearchButton) {
    el.memoryEndpointsSearchButton.addEventListener("click", function () {
      searchMemoryEndpoints().catch((error) => {
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

  el.catalogLoadButton.addEventListener("click", function () {
    loadCatalogFromUrl().catch((error) => {
      if (error && error.name === "AbortError") {
        return;
      }
      setCatalogStatus(errorMessage(error), true);
    });
  });

  el.catalogUrlInput.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    el.catalogLoadButton.click();
  });

  el.importLocalCatalogButton.addEventListener("click", function () {
    importLocalCatalogFile().catch((error) => {
      setCatalogStatus(errorMessage(error), true);
    });
  });

  el.simpleImportLocalCatalogButton.addEventListener("click", function () {
    importLocalCatalogFile(el.simpleLocalCatalogFile).catch((error) => {
      setCatalogStatus(errorMessage(error), true);
    });
  });

  el.localCatalogFile.addEventListener("change", function () {
    const file = el.localCatalogFile.files && el.localCatalogFile.files[0];
    if (!file) {
      setCatalogStatus("idle", false);
      return;
    }
    setCatalogStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} local catalog selected`, false);
  });

  el.simpleLocalCatalogFile.addEventListener("change", function () {
    const file = el.simpleLocalCatalogFile.files && el.simpleLocalCatalogFile.files[0];
    if (!file) {
      setCatalogStatus("idle", false);
      return;
    }
    setCatalogStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} local catalog selected`, false);
  });

  el.applyPeerContactCardButton.addEventListener("click", function () {
    applyPeerContactCardFile(el.peerContactCardFile).catch((error) => {
      updatePeerUrlStatus(errorMessage(error), true);
    });
  });

  el.peerContactCardFile.addEventListener("change", function () {
    const file = el.peerContactCardFile.files && el.peerContactCardFile.files[0];
    if (!file) {
      updatePeerUrlStatus("choose a peer contact card or enter a URL", false);
      return;
    }
    updatePeerUrlStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer contact card selected`, false);
  });

  el.applyPeerContactBookButton.addEventListener("click", function () {
    applyPeerContactBookFile(el.peerContactBookFile).catch((error) => {
      updatePeerUrlStatus(errorMessage(error), true);
    });
  });

  el.peerContactBookFile.addEventListener("change", function () {
    const file = el.peerContactBookFile.files && el.peerContactBookFile.files[0];
    if (!file) {
      updatePeerUrlStatus("choose a peer contact book, peer contact card, or enter a URL", false);
      return;
    }
    updatePeerUrlStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer contact book selected`, false);
  });

  el.applyPeerAnnouncementButton.addEventListener("click", function () {
    applyPeerSourceAnnouncementFile(el.peerAnnouncementFile).catch((error) => {
      setCatalogStatus(errorMessage(error), true);
    });
  });

  el.peerAnnouncementFile.addEventListener("change", function () {
    const file = el.peerAnnouncementFile.files && el.peerAnnouncementFile.files[0];
    if (!file) {
      setCatalogStatus("choose a peer-source announcement or feed after loading metadata", false);
      return;
    }
    setCatalogStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer-source announcement/feed selected`, false);
  });

  el.importReceiptLedgerButton.addEventListener("click", function () {
    importReceiptLedgerFile(el.importReceiptLedgerFile).catch((error) => {
      setImportReceiptLedgerStatus(errorMessage(error), true);
    });
  });

  el.importReceiptLedgerFile.addEventListener("change", function () {
    const file = el.importReceiptLedgerFile.files && el.importReceiptLedgerFile.files[0];
    if (!file) {
      setImportReceiptLedgerStatus("choose an import receipt ledger JSON file", false);
      return;
    }
    setImportReceiptLedgerStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} import receipt ledger selected`, false);
  });

  el.peerStatusCheckButton.addEventListener("click", function () {
    importPeerStatusCheckFile(el.peerStatusCheckFile).catch((error) => {
      setPeerStatusCheckStatus(errorMessage(error), true);
    });
  });

  if (el.checkPeerStatusButton) {
    el.checkPeerStatusButton.addEventListener("click", function () {
      checkLivePeerStatus().catch((error) => {
        setPeerStatusCheckStatus(errorMessage(error), true);
      });
    });
  }

  el.peerStatusCheckFile.addEventListener("change", function () {
    const file = el.peerStatusCheckFile.files && el.peerStatusCheckFile.files[0];
    if (!file) {
      setPeerStatusCheckStatus("choose a peer status check JSON file", false);
      return;
    }
    setPeerStatusCheckStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer status check selected`, false);
  });

  el.peerCompanionInventoryButton.addEventListener("click", function () {
    importPeerCompanionInventoryFile(el.peerCompanionInventoryFile).catch((error) => {
      setPeerCompanionInventoryStatus(errorMessage(error), true);
    });
  });

  el.peerCompanionInventoryFile.addEventListener("change", function () {
    const file = el.peerCompanionInventoryFile.files && el.peerCompanionInventoryFile.files[0];
    if (!file) {
      setPeerCompanionInventoryStatus("choose a peer companion inventory JSON file", false);
      return;
    }
    setPeerCompanionInventoryStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer companion inventory selected`, false);
  });

  el.hfSearchButton.addEventListener("click", function () {
    if (el.simpleHfSortSelect && el.hfSortSelect) {
      el.simpleHfSortSelect.value = normalizeHfBrowseSort(el.hfSortSelect.value);
    }
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

  if (el.hfSortSelect && el.simpleHfSortSelect) {
    el.hfSortSelect.addEventListener("change", () => {
      el.simpleHfSortSelect.value = normalizeHfBrowseSort(el.hfSortSelect.value);
    });
  }

  el.resetButton.addEventListener("click", function () {
    if (state.exports) {
      state.exports.reset_context();
      state.lastGenerateMs = 0;
      state.lastMeasuredTokens = 0;
      state.hasContext = false;
      el.console.textContent = "context reset";
      renderDiagnostics();
      setControls(true, true);
    }
  });

  el.clearChatButton.addEventListener("click", function () {
    clearActiveConversation();
  });

  if (el.catalogUrlInput && !catalogText(el.catalogUrlInput.value)) {
    el.catalogUrlInput.value = defaultCatalogUrl;
  }
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
    if (state.companion.streamAbort) {
      state.companion.streamAbort.abort();
      state.companion.streamAbort = null;
    }
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
