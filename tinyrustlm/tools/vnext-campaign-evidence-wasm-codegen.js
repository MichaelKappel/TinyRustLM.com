"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const interfaceProfilePath = path.join(
  repositoryRoot,
  "contracts/vnext/campaign-evidence-wasm-interface.v1.json"
);
const rustExportsPath = path.join(
  repositoryRoot,
  "rust/crates/tinyrustlm-evidence-wasm/src/generated_exports.rs"
);
const browserAdapterPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/generated/vnext-campaign-evidence-wasm.js"
);
const maximumProfileBytes = 64 * 1024;
const exportNamePattern = /^[a-z][a-z0-9_]{2,79}$/u;

function invariant(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = "campaign_evidence_wasm_profile_invalid";
    throw error;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertDataGraph(value, label = "campaign-evidence WASM profile", depth = 0, seen = new Set()) {
  invariant(depth <= 24, `${label} exceeds its depth limit`);
  if (value === null || ["string", "boolean", "number"].includes(typeof value)) return;
  invariant(Array.isArray(value) || isPlainObject(value), `${label} has an invalid prototype`);
  invariant(!seen.has(value), `${label} contains a cycle`);
  seen.add(value);
  invariant(Object.getOwnPropertySymbols(value).length === 0, `${label} contains symbol fields`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    invariant(
      Object.hasOwn(descriptor, "value") &&
        descriptor.get === undefined && descriptor.set === undefined,
      `${label}.${key} must be a data property`
    );
    assertDataGraph(descriptor.value, `${label}.${key}`, depth + 1, seen);
  }
  seen.delete(value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function exactKeys(value, expected, label) {
  invariant(isPlainObject(value), `${label} must be an object`);
  invariant(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()),
    `${label} fields are invalid`
  );
}

function exactValue(actual, expected, label) {
  invariant(JSON.stringify(actual) === JSON.stringify(expected), `${label} is invalid`);
}

function requireBoundedRegularFile(filePath, maximumBytes, label) {
  const stat = fs.lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink(), `${label} is not a regular file`);
  invariant(stat.size > 0 && stat.size <= maximumBytes, `${label} byte length is invalid`);
  return fs.readFileSync(filePath);
}

const profileKeys = [
  "schema",
  "profileId",
  "status",
  "versionPolicy",
  "campaignPlanSchema",
  "phaseInvalidationProfileId",
  "phaseInvalidationProfileSha256",
  "campaignProjectionProfileId",
  "campaignProjectionProfileSha256",
  "campaignProjectionResultSchema",
  "projectionMetadataFields",
  "rustCrate",
  "wasmTarget",
  "abiVersion",
  "limits",
  "inputEncoding",
  "resultEncoding",
  "browserGlobal",
  "generatedRustPath",
  "generatedBrowserPath",
  "statusCodes",
  "exports",
  "requiredImports",
  "requiredExports",
  "staging",
  "ownership",
  "security"
];

const limitValues = Object.freeze({
  maximumTransferBytes: 4_194_304,
  maximumResultBytes: 4_194_304,
  maximumModuleBytes: 8_388_608,
  maximumLiveAllocations: 4,
  maximumLiveAllocationBytes: 8_388_608,
  maximumPlanBytes: 1_048_576,
  maximumProjectionMetadataBytes: 65_536,
  maximumReceiptBytes: 262_144,
  maximumSubjectBytes: 2_097_152,
  maximumReceiptInputs: 2_048,
  maximumSubjectInputs: 2_048,
  maximumTotalReceiptBytes: 67_108_864,
  maximumTotalSubjectBytes: 67_108_864
});

const exportKeys = [
  "abiVersion",
  "maximumTransferBytes",
  "allocate",
  "release",
  "finalizeCampaignPlan",
  "validateCampaignPlan",
  "beginPhaseInvalidation",
  "beginCampaignProjection",
  "appendReceipt",
  "appendSubject",
  "executeStaged",
  "reset",
  "validateCampaignProjectionResult",
  "resultLength",
  "copyResult",
  "errorLength",
  "copyError"
];

function expectedExportDescriptors(profile) {
  return [
    { name: "memory", kind: "memory" },
    ...Object.values(profile.exports)
      .slice()
      .sort()
      .map((name) => ({ name, kind: "function" })),
    { name: "__data_end", kind: "global" },
    { name: "__heap_base", kind: "global" }
  ];
}

function validateInterfaceProfile(profile) {
  assertDataGraph(profile);
  exactKeys(profile, profileKeys, "campaign-evidence WASM profile");
  invariant(
    profile.schema === "tinyrustlm.vnext.campaign_evidence_wasm_interface.v1" &&
      profile.profileId === "tinyrustlm.vnext.campaign-evidence-wasm.v1" &&
      profile.status === "frozen" &&
      profile.versionPolicy === "single-current-profile-clean-replacement" &&
      profile.campaignPlanSchema === "tinyrustlm.vnext.campaign_plan.v1" &&
      profile.phaseInvalidationProfileId === "tinyrustlm.vnext.phase-invalidation.v1" &&
      profile.phaseInvalidationProfileSha256 ===
        "4f9c0f02f9e7fc55c2793ca9bbf9edd9e659b5737cc23eda98e40cc675074875" &&
      profile.campaignProjectionProfileId === "tinyrustlm.vnext.campaign-projection.v1" &&
      profile.campaignProjectionProfileSha256 ===
        "de42d142af608c921a9343155ffd321eaeb71ae9086ee51762dc2bf3f8c5e5eb" &&
      profile.campaignProjectionResultSchema ===
        "tinyrustlm.vnext.campaign_projection_result.v1" &&
      profile.rustCrate === "tinyrustlm-evidence-wasm" &&
      profile.wasmTarget === "wasm32-unknown-unknown" &&
      profile.abiVersion === 1 &&
      profile.inputEncoding === "exact-utf8-and-canonical-json-bytes" &&
      profile.resultEncoding === "exact-canonical-verifier-result-bytes" &&
      profile.browserGlobal === "TinyRustLMCampaignEvidence" &&
      profile.generatedRustPath ===
        "rust/crates/tinyrustlm-evidence-wasm/src/generated_exports.rs" &&
      profile.generatedBrowserPath ===
        "tinyrustlm/tools/generated/vnext-campaign-evidence-wasm.js",
    "campaign-evidence WASM profile identity is invalid"
  );
  exactValue(profile.projectionMetadataFields, [
    "expectedCampaignId",
    "expectedCampaignPlanSha256",
    "expectedEnvironment",
    "expectedTerminalRegistryReceiptId",
    "trustedRootRegistryReceiptId",
    "verificationTimeUtc"
  ], "projectionMetadataFields");
  exactKeys(profile.limits, Object.keys(limitValues), "limits");
  exactValue(profile.limits, limitValues, "limits");
  exactKeys(profile.statusCodes, [
    "ok", "boundaryError", "verificationError", "internalError"
  ], "statusCodes");
  exactValue(profile.statusCodes, {
    ok: 0,
    boundaryError: 1,
    verificationError: 2,
    internalError: 3
  }, "statusCodes");
  exactKeys(profile.exports, exportKeys, "exports");
  const exportNames = exportKeys.map((key) => profile.exports[key]);
  invariant(
    exportNames.every((name) => exportNamePattern.test(name)) &&
      new Set(exportNames).size === exportNames.length,
    "WASM export names are invalid"
  );
  exactValue(profile.requiredImports, [], "requiredImports");
  exactValue(profile.requiredExports, expectedExportDescriptors(profile), "requiredExports");
  exactKeys(profile.staging, [
    "operationKinds",
    "beginReplacesPriorState",
    "failureClearsStage",
    "executeConsumesStage",
    "resetClearsStageResultAndError",
    "declaredCountsMustMatch",
    "aggregateLimitsCheckedBeforeCommit",
    "crossInstanceState"
  ], "staging");
  exactValue(profile.staging, {
    operationKinds: ["phase-invalidation", "campaign-projection"],
    beginReplacesPriorState: true,
    failureClearsStage: true,
    executeConsumesStage: true,
    resetClearsStageResultAndError: true,
    declaredCountsMustMatch: true,
    aggregateLimitsCheckedBeforeCommit: true,
    crossInstanceState: "none"
  }, "staging");
  exactKeys(profile.ownership, [
    "inputAllocation",
    "allocationIdentity",
    "resultCopy",
    "returnedPointers",
    "resultLifetime",
    "stagedEvidence"
  ], "ownership");
  exactValue(profile.ownership, {
    inputAllocation: "caller-allocates-writes-invokes-and-releases",
    allocationIdentity: "exact-pointer-and-length-pair",
    resultCopy: "caller-allocates-exact-length-copies-and-releases",
    returnedPointers: "none",
    resultLifetime: "until-next-operation-or-reset-on-same-instance",
    stagedEvidence: "owned-rust-copies-consumed-by-execute"
  }, "ownership");
  exactKeys(profile.security, [
    "networkAccess",
    "filesystemAccess",
    "clockAccess",
    "environmentAccess",
    "randomAccess",
    "unknownImports",
    "unknownExports",
    "noncanonicalFinalWire",
    "responseRepair",
    "bestOfN",
    "rawHostErrors",
    "javascriptCampaignSemantics",
    "offlineBundleVerdictAsProjectionInput"
  ], "security");
  exactValue(profile.security, {
    networkAccess: "forbidden",
    filesystemAccess: "forbidden",
    clockAccess: "forbidden",
    environmentAccess: "forbidden",
    randomAccess: "forbidden",
    unknownImports: "reject",
    unknownExports: "reject",
    noncanonicalFinalWire: "reject",
    responseRepair: "forbidden",
    bestOfN: "forbidden",
    rawHostErrors: "forbidden",
    javascriptCampaignSemantics: "forbidden",
    offlineBundleVerdictAsProjectionInput: "forbidden"
  }, "security");
  return profile;
}

function loadInterfaceProfile(filePath = interfaceProfilePath) {
  const bytes = requireBoundedRegularFile(filePath, maximumProfileBytes, "interface profile");
  const profile = parseStrictJson(bytes, {
    maximumBytes: maximumProfileBytes,
    maximumDepth: 16,
    maximumTotalEntries: 512,
    maximumObjectMembers: 64,
    maximumArrayItems: 128,
    maximumStringCodeUnits: 1024,
    maximumTotalStringCodeUnits: 32 * 1024,
    maximumNumberCharacters: 16
  });
  validateInterfaceProfile(profile);
  return deepFreeze(profile);
}

function rustFunction(name, returnType, body, documentation, parameters = "") {
  const signature = parameters.includes("\n")
    ? `pub extern \"C\" fn ${name}(\n${parameters}\n) -> ${returnType} {`
    : `pub extern \"C\" fn ${name}(${parameters}) -> ${returnType} {`;
  const bodyLines = body.split("\n").map((line) => `    ${line}`);
  return [
    `/// ${documentation}`,
    "#[no_mangle]",
    signature,
    ...bodyLines,
    "}"
  ].join("\n");
}

function renderGeneratedRustExports(profile) {
  validateInterfaceProfile(profile);
  const names = profile.exports;
  const limits = profile.limits;
  const statuses = profile.statusCodes;
  const sections = [
    "//! Generated campaign-evidence WebAssembly ABI exports.",
    "//!",
    "//! Regenerate with `node tinyrustlm/tools/vnext-campaign-evidence-wasm-codegen.js --write`.",
    "//! Do not edit this file by hand.",
    "#![allow(unsafe_code)]",
    "",
    `/// The frozen ABI version from ${profile.profileId}.`,
    `pub const ABI_VERSION: u32 = ${profile.abiVersion};`,
    "/// Maximum one-buffer transfer allocation.",
    `pub const MAXIMUM_TRANSFER_BYTES: u32 = ${limits.maximumTransferBytes};`,
    "/// Maximum successful verifier result bytes.",
    `pub const MAXIMUM_RESULT_BYTES: u32 = ${limits.maximumResultBytes};`,
    "/// Maximum simultaneously live transfer allocations.",
    `pub const MAXIMUM_LIVE_ALLOCATIONS: usize = ${limits.maximumLiveAllocations};`,
    "/// Maximum aggregate bytes across live transfer allocations.",
    `pub const MAXIMUM_LIVE_ALLOCATION_BYTES: usize = ${limits.maximumLiveAllocationBytes};`,
    "/// Maximum campaign-plan bytes.",
    `pub const MAXIMUM_PLAN_BYTES: u32 = ${limits.maximumPlanBytes};`,
    "/// Maximum projection metadata bytes.",
    `pub const MAXIMUM_PROJECTION_METADATA_BYTES: u32 = ${limits.maximumProjectionMetadataBytes};`,
    "/// Maximum one-receipt bytes.",
    `pub const MAXIMUM_RECEIPT_BYTES: u32 = ${limits.maximumReceiptBytes};`,
    "/// Maximum one-subject bytes.",
    `pub const MAXIMUM_SUBJECT_BYTES: u32 = ${limits.maximumSubjectBytes};`,
    "/// Maximum receipt count.",
    `pub const MAXIMUM_RECEIPT_INPUTS: u32 = ${limits.maximumReceiptInputs};`,
    "/// Maximum subject count.",
    `pub const MAXIMUM_SUBJECT_INPUTS: u32 = ${limits.maximumSubjectInputs};`,
    "/// Maximum aggregate receipt bytes.",
    `pub const MAXIMUM_TOTAL_RECEIPT_BYTES: usize = ${limits.maximumTotalReceiptBytes};`,
    "/// Maximum aggregate subject bytes.",
    `pub const MAXIMUM_TOTAL_SUBJECT_BYTES: usize = ${limits.maximumTotalSubjectBytes};`,
    "/// Successful boundary status.",
    `pub const STATUS_OK: u32 = ${statuses.ok};`,
    "/// Invalid ownership, resource, or stage-protocol status.",
    `pub const STATUS_BOUNDARY_ERROR: u32 = ${statuses.boundaryError};`,
    "/// Strict evidence-verification failure status.",
    `pub const STATUS_VERIFICATION_ERROR: u32 = ${statuses.verificationError};`,
    "/// Bounded internal-state failure status.",
    `pub const STATUS_INTERNAL_ERROR: u32 = ${statuses.internalError};`,
    ""
  ];
  sections.push(rustFunction(
    names.abiVersion, "u32", "ABI_VERSION", "Returns the generated ABI version."
  ));
  sections.push(rustFunction(
    names.maximumTransferBytes,
    "u32",
    "MAXIMUM_TRANSFER_BYTES",
    "Returns the maximum one-buffer transfer allocation."
  ));
  sections.push(rustFunction(
    names.allocate,
    "*mut u8",
    "crate::boundary::allocate(length)",
    "Allocates one bounded caller-owned transfer buffer.",
    "length: u32"
  ));
  sections.push(rustFunction(
    names.release,
    "u32",
    "crate::boundary::release(pointer, length)",
    "Releases one exact pointer-length allocation.",
    "pointer: *mut u8, length: u32"
  ));
  sections.push(rustFunction(
    names.finalizeCampaignPlan,
    "u32",
    "crate::boundary::finalize_campaign_plan(pointer, length)",
    "Finalizes one exact campaign-plan draft.",
    "pointer: *const u8, length: u32"
  ));
  sections.push(rustFunction(
    names.validateCampaignPlan,
    "u32",
    "crate::boundary::validate_campaign_plan(pointer, length)",
    "Validates one exact final campaign plan.",
    "pointer: *const u8, length: u32"
  ));
  sections.push(rustFunction(
    names.beginPhaseInvalidation,
    "u32",
    "crate::boundary::begin_phase_invalidation(campaign_pointer, campaign_length, receipt_count)",
    "Begins one destructive staged semantic-currentness operation.",
    "    campaign_pointer: *const u8,\n    campaign_length: u32,\n    receipt_count: u32,"
  ));
  sections.push(rustFunction(
    names.beginCampaignProjection,
    "u32",
    "crate::boundary::begin_campaign_projection(\n    metadata_pointer,\n    metadata_length,\n    plan_pointer,\n    plan_length,\n    receipt_count,\n    subject_count,\n)",
    "Begins one destructive staged campaign-projection operation.",
    "    metadata_pointer: *const u8,\n    metadata_length: u32,\n    plan_pointer: *const u8,\n    plan_length: u32,\n    receipt_count: u32,\n    subject_count: u32,"
  ));
  sections.push(rustFunction(
    names.appendReceipt,
    "u32",
    "crate::boundary::append_receipt(pointer, length)",
    "Appends one exact canonical receipt wire to the active stage.",
    "pointer: *const u8, length: u32"
  ));
  sections.push(rustFunction(
    names.appendSubject,
    "u32",
    "crate::boundary::append_subject(pointer, length)",
    "Appends one exact canonical identity-subject wire to the projection stage.",
    "pointer: *const u8, length: u32"
  ));
  sections.push(rustFunction(
    names.executeStaged,
    "u32",
    "crate::boundary::execute_staged()",
    "Consumes and executes the active staged operation."
  ));
  sections.push(rustFunction(
    names.reset,
    "u32",
    "crate::boundary::reset()",
    "Clears stage, result, and error state without stealing transfer allocations."
  ));
  sections.push(rustFunction(
    names.validateCampaignProjectionResult,
    "u32",
    "crate::boundary::validate_campaign_projection_result(\n    result_pointer,\n    result_length,\n    plan_pointer,\n    plan_length,\n)",
    "Validates one projection result against one exact campaign plan.",
    "    result_pointer: *const u8,\n    result_length: u32,\n    plan_pointer: *const u8,\n    plan_length: u32,"
  ));
  sections.push(rustFunction(
    names.resultLength,
    "u32",
    "crate::boundary::result_length()",
    "Returns the exact current successful-result length."
  ));
  sections.push(rustFunction(
    names.copyResult,
    "u32",
    "crate::boundary::copy_result(pointer, length)",
    "Copies the current result into one exact caller-owned buffer.",
    "pointer: *mut u8, length: u32"
  ));
  sections.push(rustFunction(
    names.errorLength,
    "u32",
    "crate::boundary::error_length()",
    "Returns the exact current stable-error length."
  ));
  sections.push(rustFunction(
    names.copyError,
    "u32",
    "crate::boundary::copy_error(pointer, length)",
    "Copies the current stable error into one exact caller-owned buffer.",
    "pointer: *mut u8, length: u32"
  ));
  return Buffer.from(`${sections.join("\n").trimEnd()}\n`, "utf8");
}

function renderGeneratedBrowserAdapter(profile) {
  validateInterfaceProfile(profile);
  const source = `"use strict";

// Generated by vnext-campaign-evidence-wasm-codegen.js from ${profile.profileId}.
// This adapter transports exact bytes only; all evidence semantics remain in Rust.
(function installCampaignEvidence(root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  } else {
    Object.defineProperty(root, ${JSON.stringify(profile.browserGlobal)}, {
      value: api,
      configurable: false,
      enumerable: true,
      writable: false
    });
  }
}(typeof globalThis === "object" ? globalThis : this, function createApi() {
  const profileId = ${JSON.stringify(profile.profileId)};
  const abiVersion = ${profile.abiVersion};
  const limits = Object.freeze(${JSON.stringify(profile.limits)});
  const statusCodes = Object.freeze(${JSON.stringify(profile.statusCodes)});
  const exportNames = Object.freeze(${JSON.stringify(profile.exports)});
  const requiredImports = Object.freeze(${JSON.stringify(profile.requiredImports)});
  const requiredExports = Object.freeze(${JSON.stringify(profile.requiredExports)});
  const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
  const typedArrayByteLength = Object.getOwnPropertyDescriptor(
    typedArrayPrototype, "byteLength"
  ).get;
  const typedArrayLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, "length").get;
  const typedArrayBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer").get;
  const arrayBufferByteLength = Object.getOwnPropertyDescriptor(
    ArrayBuffer.prototype, "byteLength"
  ).get;
  const typedArraySet = Uint8Array.prototype.set;

  class CampaignEvidenceBoundaryError extends Error {
    constructor(code) {
      super(code);
      this.name = "CampaignEvidenceBoundaryError";
      this.code = code;
    }
  }

  class CampaignEvidenceVerificationError extends Error {
    constructor(code) {
      super(code);
      this.name = "CampaignEvidenceVerificationError";
      this.code = code;
    }
  }

  function exactDescriptors(actual, expected, code) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new CampaignEvidenceBoundaryError(code);
    }
  }

  function copyBytes(value, maximumBytes, typeCode, limitCode) {
    let byteLength;
    let elementLength;
    let buffer;
    try {
      byteLength = typedArrayByteLength.call(value);
      elementLength = typedArrayLength.call(value);
      buffer = typedArrayBuffer.call(value);
      arrayBufferByteLength.call(buffer);
    } catch (_error) {
      throw new CampaignEvidenceBoundaryError(typeCode);
    }
    if (byteLength !== elementLength) {
      throw new CampaignEvidenceBoundaryError(typeCode);
    }
    if (byteLength === 0 || byteLength > maximumBytes) {
      throw new CampaignEvidenceBoundaryError(limitCode);
    }
    const copy = new Uint8Array(byteLength);
    typedArraySet.call(copy, value);
    return copy;
  }

  function denseDataArray(value, maximumItems, code) {
    if (!Array.isArray(value) || value.length > maximumItems ||
        Object.getOwnPropertySymbols(value).length !== 0) {
      throw new CampaignEvidenceBoundaryError(code);
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const entries = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.hasOwn(descriptor, "value") ||
          descriptor.get !== undefined || descriptor.set !== undefined) {
        throw new CampaignEvidenceBoundaryError(code);
      }
      entries.push(descriptor.value);
    }
    const keys = Object.keys(descriptors).filter((key) => key !== "length");
    if (keys.length !== value.length) throw new CampaignEvidenceBoundaryError(code);
    return entries;
  }

  function projectionRecord(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value) ||
        Object.getOwnPropertySymbols(value).length !== 0) {
      throw new CampaignEvidenceBoundaryError("campaign_evidence_projection_input_invalid");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const expected = ["campaignPlanBytes", "metadataBytes", "receiptBytes", "subjectBytes"];
    if (JSON.stringify(Object.keys(descriptors).sort()) !== JSON.stringify(expected)) {
      throw new CampaignEvidenceBoundaryError("campaign_evidence_projection_input_invalid");
    }
    const output = {};
    for (const key of expected) {
      const descriptor = descriptors[key];
      if (!Object.hasOwn(descriptor, "value") || descriptor.get !== undefined ||
          descriptor.set !== undefined) {
        throw new CampaignEvidenceBoundaryError("campaign_evidence_projection_input_invalid");
      }
      output[key] = descriptor.value;
    }
    return output;
  }

  function copyModuleBytes(value) {
    return copyBytes(
      value,
      limits.maximumModuleBytes,
      "campaign_evidence_wasm_module_type_invalid",
      "campaign_evidence_wasm_module_byte_limit"
    );
  }

  class CampaignEvidenceVerifier {
    #exports;

    constructor(instance) {
      if (!(instance instanceof WebAssembly.Instance)) {
        throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_instance_invalid");
      }
      this.#exports = instance.exports;
      if (!(this.#exports.memory instanceof WebAssembly.Memory)) {
        throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_memory_invalid");
      }
      for (const name of Object.values(exportNames)) {
        if (typeof this.#exports[name] !== "function") {
          throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_export_invalid");
        }
      }
      if ((this.#exports[exportNames.abiVersion]() >>> 0) !== abiVersion ||
          (this.#exports[exportNames.maximumTransferBytes]() >>> 0) !==
            limits.maximumTransferBytes) {
        throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_profile_mismatch");
      }
      Object.freeze(this);
    }

    finalizeCampaignPlan(value) {
      return this.#directOne(
        exportNames.finalizeCampaignPlan,
        value,
        limits.maximumPlanBytes,
        "campaign_evidence_plan_input_type_invalid",
        "campaign_plan_byte_limit"
      );
    }

    validateCampaignPlan(value) {
      return this.#directOne(
        exportNames.validateCampaignPlan,
        value,
        limits.maximumPlanBytes,
        "campaign_evidence_plan_input_type_invalid",
        "campaign_plan_byte_limit"
      );
    }

    classifyPhaseReceipts(campaignIdBytes, receiptValues) {
      const receipts = denseDataArray(
        receiptValues,
        limits.maximumReceiptInputs,
        "campaign_evidence_receipt_list_invalid"
      );
      let output;
      let failure;
      try {
        this.#withInput(
          campaignIdBytes,
          limits.maximumProjectionMetadataBytes,
          "campaign_evidence_campaign_id_type_invalid",
          "campaign_evidence_campaign_id_byte_limit",
          (pointer, length) => this.#requireStatus(
            this.#exports[exportNames.beginPhaseInvalidation](
              pointer, length, receipts.length
            ) >>> 0,
            false
          )
        );
        for (const receipt of receipts) this.#appendReceipt(receipt);
        output = this.#complete(this.#exports[exportNames.executeStaged]() >>> 0);
      } catch (error) {
        failure = error;
      }
      const resetStatus = this.#exports[exportNames.reset]() >>> 0;
      if (failure) throw failure;
      if (resetStatus !== statusCodes.ok) {
        throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_reset_failed");
      }
      return output;
    }

    projectCampaign(value) {
      const input = projectionRecord(value);
      const receipts = denseDataArray(
        input.receiptBytes,
        limits.maximumReceiptInputs,
        "campaign_evidence_receipt_list_invalid"
      );
      const subjects = denseDataArray(
        input.subjectBytes,
        limits.maximumSubjectInputs,
        "campaign_evidence_subject_list_invalid"
      );
      let output;
      let failure;
      try {
        this.#withInput(
          input.metadataBytes,
          limits.maximumProjectionMetadataBytes,
          "campaign_evidence_projection_metadata_type_invalid",
          "campaign_evidence_projection_metadata_byte_limit",
          (metadataPointer, metadataLength) => this.#withInput(
            input.campaignPlanBytes,
            limits.maximumPlanBytes,
            "campaign_evidence_plan_input_type_invalid",
            "campaign_plan_byte_limit",
            (planPointer, planLength) => this.#requireStatus(
              this.#exports[exportNames.beginCampaignProjection](
                metadataPointer,
                metadataLength,
                planPointer,
                planLength,
                receipts.length,
                subjects.length
              ) >>> 0,
              false
            )
          )
        );
        for (const receipt of receipts) this.#appendReceipt(receipt);
        for (const subject of subjects) this.#appendSubject(subject);
        output = this.#complete(this.#exports[exportNames.executeStaged]() >>> 0);
      } catch (error) {
        failure = error;
      }
      const resetStatus = this.#exports[exportNames.reset]() >>> 0;
      if (failure) throw failure;
      if (resetStatus !== statusCodes.ok) {
        throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_reset_failed");
      }
      return output;
    }

    validateCampaignProjectionResult(resultBytes, campaignPlanBytes) {
      let output;
      let failure;
      try {
        this.#withInput(
          resultBytes,
          limits.maximumResultBytes,
          "campaign_evidence_projection_result_type_invalid",
          "campaign_projection_result_byte_limit",
          (resultPointer, resultLength) => this.#withInput(
            campaignPlanBytes,
            limits.maximumPlanBytes,
            "campaign_evidence_plan_input_type_invalid",
            "campaign_plan_byte_limit",
            (planPointer, planLength) => {
              const status = this.#exports[exportNames.validateCampaignProjectionResult](
                resultPointer, resultLength, planPointer, planLength
              ) >>> 0;
              output = this.#complete(status);
            }
          )
        );
      } catch (error) {
        failure = error;
      }
      const resetStatus = this.#exports[exportNames.reset]() >>> 0;
      if (failure) throw failure;
      if (resetStatus !== statusCodes.ok) {
        throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_reset_failed");
      }
      return output;
    }

    reset() {
      const status = this.#exports[exportNames.reset]() >>> 0;
      if (status !== statusCodes.ok) {
        throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_reset_failed");
      }
    }

    #appendReceipt(value) {
      this.#withInput(
        value,
        limits.maximumReceiptBytes,
        "campaign_evidence_receipt_type_invalid",
        "campaign_evidence_receipt_byte_limit",
        (pointer, length) => this.#requireStatus(
          this.#exports[exportNames.appendReceipt](pointer, length) >>> 0,
          false
        )
      );
    }

    #appendSubject(value) {
      this.#withInput(
        value,
        limits.maximumSubjectBytes,
        "campaign_evidence_subject_type_invalid",
        "campaign_evidence_subject_byte_limit",
        (pointer, length) => this.#requireStatus(
          this.#exports[exportNames.appendSubject](pointer, length) >>> 0,
          false
        )
      );
    }

    #directOne(operationName, value, maximumBytes, typeCode, limitCode) {
      let output;
      let failure;
      try {
        this.#withInput(value, maximumBytes, typeCode, limitCode, (pointer, length) => {
          output = this.#complete(this.#exports[operationName](pointer, length) >>> 0);
        });
      } catch (error) {
        failure = error;
      }
      const resetStatus = this.#exports[exportNames.reset]() >>> 0;
      if (failure) throw failure;
      if (resetStatus !== statusCodes.ok) {
        throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_reset_failed");
      }
      return output;
    }

    #withInput(value, maximumBytes, typeCode, limitCode, callback) {
      const bytes = copyBytes(value, maximumBytes, typeCode, limitCode);
      const pointer = this.#exports[exportNames.allocate](bytes.byteLength) >>> 0;
      if (pointer === 0) {
        throw new CampaignEvidenceBoundaryError(
          this.#readError("campaign_evidence_allocation_failed")
        );
      }
      let failure;
      let output;
      try {
        new Uint8Array(this.#exports.memory.buffer, pointer, bytes.byteLength).set(bytes);
        output = callback(pointer, bytes.byteLength);
      } catch (error) {
        failure = error;
      }
      const releaseStatus = this.#exports[exportNames.release](
        pointer, bytes.byteLength
      ) >>> 0;
      if (failure) throw failure;
      if (releaseStatus !== statusCodes.ok) {
        throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_release_failed");
      }
      return output;
    }

    #complete(status) {
      this.#requireStatus(status, true);
      return this.#copyOutput(
        exportNames.resultLength,
        exportNames.copyResult,
        "campaign_evidence_wasm_result_invalid"
      );
    }

    #requireStatus(status, verificationAllowed) {
      if (status === statusCodes.ok) return;
      if (verificationAllowed && status === statusCodes.verificationError) {
        throw new CampaignEvidenceVerificationError(
          this.#readError("campaign_evidence_verification_failed")
        );
      }
      throw new CampaignEvidenceBoundaryError(this.#readError(
        status === statusCodes.internalError
          ? "campaign_evidence_wasm_internal_error"
          : "campaign_evidence_wasm_boundary_error"
      ));
    }

    #readError(fallback) {
      const bytes = this.#copyOutput(exportNames.errorLength, exportNames.copyError, null);
      if (bytes.byteLength === 0) return fallback;
      try {
        const code = textDecoder.decode(bytes);
        return /^[a-z][a-z0-9_]{2,95}$/u.test(code) ? code : fallback;
      } catch (_error) {
        return fallback;
      }
    }

    #copyOutput(lengthName, copyName, emptyError) {
      const length = this.#exports[lengthName]() >>> 0;
      if (length === 0) {
        if (emptyError) throw new CampaignEvidenceBoundaryError(emptyError);
        return new Uint8Array();
      }
      if (length > limits.maximumResultBytes) {
        throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_output_limit");
      }
      const pointer = this.#exports[exportNames.allocate](length) >>> 0;
      if (pointer === 0) {
        throw new CampaignEvidenceBoundaryError("campaign_evidence_allocation_failed");
      }
      let failure;
      let output;
      try {
        const status = this.#exports[copyName](pointer, length) >>> 0;
        if (status !== statusCodes.ok) {
          throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_copy_failed");
        }
        output = new Uint8Array(
          new Uint8Array(this.#exports.memory.buffer, pointer, length)
        );
      } catch (error) {
        failure = error;
      }
      const releaseStatus = this.#exports[exportNames.release](pointer, length) >>> 0;
      if (failure) throw failure;
      if (releaseStatus !== statusCodes.ok) {
        throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_release_failed");
      }
      return output;
    }
  }

  async function instantiateCampaignEvidence(moduleBytes) {
    const bytes = copyModuleBytes(moduleBytes);
    let compiled;
    try {
      compiled = await WebAssembly.compile(bytes);
    } catch (_error) {
      throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_compile_failed");
    }
    exactDescriptors(
      WebAssembly.Module.imports(compiled),
      requiredImports,
      "campaign_evidence_wasm_import_surface_invalid"
    );
    exactDescriptors(
      WebAssembly.Module.exports(compiled),
      requiredExports,
      "campaign_evidence_wasm_export_surface_invalid"
    );
    let instance;
    try {
      instance = await WebAssembly.instantiate(compiled, {});
    } catch (_error) {
      throw new CampaignEvidenceBoundaryError("campaign_evidence_wasm_instantiate_failed");
    }
    return new CampaignEvidenceVerifier(instance);
  }

  return Object.freeze({
    profileId,
    abiVersion,
    limits,
    CampaignEvidenceBoundaryError,
    CampaignEvidenceVerificationError,
    CampaignEvidenceVerifier,
    instantiateCampaignEvidence
  });
}));
`;
  return Buffer.from(source, "utf8");
}

function writeGeneratedFile(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes);
}

function writeGeneratedFiles() {
  const profile = loadInterfaceProfile();
  writeGeneratedFile(rustExportsPath, renderGeneratedRustExports(profile));
  writeGeneratedFile(browserAdapterPath, renderGeneratedBrowserAdapter(profile));
  return Object.freeze({ rustExportsPath, browserAdapterPath });
}

function main(argumentsList) {
  invariant(
    argumentsList.length === 1 && argumentsList[0] === "--write",
    "usage: node vnext-campaign-evidence-wasm-codegen.js --write"
  );
  writeGeneratedFiles();
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Campaign-evidence WASM code generation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  browserAdapterPath,
  interfaceProfilePath,
  loadInterfaceProfile,
  renderGeneratedBrowserAdapter,
  renderGeneratedRustExports,
  rustExportsPath,
  validateInterfaceProfile,
  writeGeneratedFiles
});
