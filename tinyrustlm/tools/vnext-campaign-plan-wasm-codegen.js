"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { parseStrictJson } = require("./strict-json.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const interfaceProfilePath = path.join(
  repositoryRoot,
  "contracts/vnext/campaign-plan-wasm-interface.v1.json"
);
const rustExportsPath = path.join(
  repositoryRoot,
  "rust/crates/tinyrustlm-evidence-wasm/src/generated_exports.rs"
);
const browserAdapterPath = path.join(
  repositoryRoot,
  "tinyrustlm/tools/generated/vnext-campaign-plan-wasm.js"
);
const maximumProfileBytes = 64 * 1024;
const exportNamePattern = /^[a-z][a-z0-9_]{2,79}$/u;

function invariant(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = "campaign_plan_wasm_profile_invalid";
    throw error;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertDataGraph(value, label = "campaign-plan WASM profile", depth = 0, seen = new Set()) {
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

function validateInterfaceProfile(profile) {
  assertDataGraph(profile);
  exactKeys(profile, [
    "schema",
    "profileId",
    "status",
    "versionPolicy",
    "campaignPlanSchema",
    "campaignProjectionProfileId",
    "rustCrate",
    "wasmTarget",
    "abiVersion",
    "maximumInputBytes",
    "maximumModuleBytes",
    "inputEncoding",
    "resultEncoding",
    "browserGlobal",
    "generatedRustPath",
    "generatedBrowserPath",
    "statusCodes",
    "exports",
    "requiredImports",
    "requiredExports",
    "ownership",
    "security"
  ], "campaign-plan WASM profile");
  invariant(
    profile.schema === "tinyrustlm.vnext.campaign_plan_wasm_interface.v1" &&
      profile.profileId === "tinyrustlm.vnext.campaign-plan-wasm.v1" &&
      profile.status === "frozen" &&
      profile.versionPolicy === "single-current-profile-clean-replacement" &&
      profile.campaignPlanSchema === "tinyrustlm.vnext.campaign_plan.v1" &&
      profile.campaignProjectionProfileId === "tinyrustlm.vnext.campaign-projection.v1" &&
      profile.rustCrate === "tinyrustlm-evidence-wasm" &&
      profile.wasmTarget === "wasm32-unknown-unknown" &&
      profile.abiVersion === 1 &&
      profile.maximumInputBytes === 1_048_576 &&
      Number.isSafeInteger(profile.maximumModuleBytes) &&
      profile.maximumModuleBytes >= 64 * 1024 &&
      profile.maximumModuleBytes <= 16 * 1024 * 1024 &&
      profile.inputEncoding === "exact-utf8-json-bytes" &&
      profile.resultEncoding === "exact-canonical-campaign-plan-bytes" &&
      profile.browserGlobal === "TinyRustLMCampaignPlanVerifier" &&
      profile.generatedRustPath ===
        "rust/crates/tinyrustlm-evidence-wasm/src/generated_exports.rs" &&
      profile.generatedBrowserPath ===
        "tinyrustlm/tools/generated/vnext-campaign-plan-wasm.js",
    "campaign-plan WASM profile identity is invalid"
  );

  exactKeys(profile.statusCodes, [
    "ok", "boundaryError", "verificationError", "internalError"
  ], "statusCodes");
  exactValue(profile.statusCodes, {
    ok: 0,
    boundaryError: 1,
    verificationError: 2,
    internalError: 3
  }, "statusCodes");

  const exportKeys = [
    "abiVersion",
    "maximumInputBytes",
    "allocate",
    "release",
    "finalizeCampaignPlan",
    "validateCampaignPlan",
    "resultLength",
    "copyResult",
    "errorLength",
    "copyError"
  ];
  exactKeys(profile.exports, exportKeys, "exports");
  const exportNames = exportKeys.map((key) => profile.exports[key]);
  invariant(
    exportNames.every((name) => exportNamePattern.test(name)) &&
      new Set(exportNames).size === exportNames.length,
    "WASM export names are invalid"
  );
  exactValue(profile.requiredImports, [], "requiredImports");
  invariant(Array.isArray(profile.requiredExports), "requiredExports must be an array");
  for (const [index, descriptor] of profile.requiredExports.entries()) {
    exactKeys(descriptor, ["name", "kind"], `requiredExports[${index}]`);
    invariant(
      typeof descriptor.name === "string" &&
        ["function", "global", "memory"].includes(descriptor.kind),
      `requiredExports[${index}] is invalid`
    );
  }
  const requiredNames = profile.requiredExports.map((value) => value.name);
  invariant(new Set(requiredNames).size === requiredNames.length, "requiredExports repeat a name");
  for (const name of ["memory", ...exportNames, "__data_end", "__heap_base"]) {
    invariant(requiredNames.includes(name), `requiredExports omit ${name}`);
  }
  invariant(
    requiredNames.length === exportNames.length + 3,
    "requiredExports contain an unknown surface"
  );

  exactKeys(profile.ownership, [
    "inputAllocation",
    "allocationIdentity",
    "resultCopy",
    "returnedPointers",
    "resultLifetime",
    "crossInstanceState"
  ], "ownership");
  exactValue(profile.ownership, {
    inputAllocation: "caller-allocates-writes-invokes-and-releases",
    allocationIdentity: "exact-pointer-and-length-pair",
    resultCopy: "caller-allocates-exact-length-copies-and-releases",
    returnedPointers: "none",
    resultLifetime: "until-next-verifier-invocation-on-same-instance",
    crossInstanceState: "none"
  }, "ownership");

  exactKeys(profile.security, [
    "networkAccess",
    "filesystemAccess",
    "clockAccess",
    "environmentAccess",
    "unknownImports",
    "unknownExports",
    "noncanonicalFinalWire",
    "responseRepair",
    "rawHostErrors"
  ], "security");
  exactValue(profile.security, {
    networkAccess: "forbidden",
    filesystemAccess: "forbidden",
    clockAccess: "forbidden",
    environmentAccess: "forbidden",
    unknownImports: "reject",
    unknownExports: "reject",
    noncanonicalFinalWire: "reject",
    responseRepair: "forbidden",
    rawHostErrors: "forbidden"
  }, "security");
  return profile;
}

function loadInterfaceProfile(filePath = interfaceProfilePath) {
  const bytes = requireBoundedRegularFile(
    filePath,
    maximumProfileBytes,
    "campaign-plan WASM profile"
  );
  const profile = validateInterfaceProfile(parseStrictJson(bytes, {
    maximumBytes: maximumProfileBytes,
    maximumDepth: 16,
    maximumTotalEntries: 256,
    maximumObjectMembers: 64,
    maximumArrayItems: 32,
    maximumStringCodeUnits: 4096,
    maximumTotalStringCodeUnits: 32 * 1024,
    maximumNumberCharacters: 16
  }));
  invariant(
    bytes.equals(Buffer.from(`${JSON.stringify(profile, null, 2)}\n`, "utf8")),
    "campaign-plan WASM profile bytes are not canonical pretty JSON"
  );
  return deepFreeze(profile);
}

function rustFunction(name, returnType, body, documentation, argumentsText = "") {
  return [
    `/// ${documentation}`,
    "#[no_mangle]",
    `pub extern \"C\" fn ${name}(${argumentsText}) -> ${returnType} {`,
    `    ${body}`,
    "}",
    ""
  ].join("\n");
}

function renderGeneratedRustExports(profile) {
  validateInterfaceProfile(profile);
  const names = profile.exports;
  const statuses = profile.statusCodes;
  const sections = [
    "//! Generated campaign-plan WebAssembly ABI exports.",
    "//!",
    "//! Regenerate with `node tinyrustlm/tools/vnext-campaign-plan-wasm-codegen.js --write`.",
    "//! Do not edit this file by hand.",
    "#![allow(unsafe_code)]",
    "",
    `/// The frozen ABI version from ${profile.profileId}.`,
    `pub const ABI_VERSION: u32 = ${profile.abiVersion};`,
    `/// The maximum accepted input byte count from ${profile.profileId}.`,
    `pub const MAXIMUM_INPUT_BYTES: u32 = ${profile.maximumInputBytes};`,
    "/// The successful boundary status.",
    `pub const STATUS_OK: u32 = ${statuses.ok};`,
    "/// The invalid ownership, length, or copy boundary status.",
    `pub const STATUS_BOUNDARY_ERROR: u32 = ${statuses.boundaryError};`,
    "/// The strict campaign-plan verification failure status.",
    `pub const STATUS_VERIFICATION_ERROR: u32 = ${statuses.verificationError};`,
    "/// The bounded internal-state failure status.",
    `pub const STATUS_INTERNAL_ERROR: u32 = ${statuses.internalError};`,
    ""
  ];
  sections.push(rustFunction(
    names.abiVersion,
    "u32",
    "ABI_VERSION",
    "Returns the exact generated ABI version."
  ));
  sections.push(rustFunction(
    names.maximumInputBytes,
    "u32",
    "MAXIMUM_INPUT_BYTES",
    "Returns the maximum accepted input and copy-buffer length."
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
    "Releases the exact pointer and length pair returned by the allocator.",
    "pointer: *mut u8, length: u32"
  ));
  sections.push(rustFunction(
    names.finalizeCampaignPlan,
    "u32",
    "crate::boundary::finalize_campaign_plan(pointer, length)",
    "Strictly finalizes one exact campaign-plan draft from caller-owned bytes.",
    "pointer: *const u8, length: u32"
  ));
  sections.push(rustFunction(
    names.validateCampaignPlan,
    "u32",
    "crate::boundary::validate_campaign_plan(pointer, length)",
    "Strictly validates one exact final canonical campaign-plan wire.",
    "pointer: *const u8, length: u32"
  ));
  sections.push(rustFunction(
    names.resultLength,
    "u32",
    "crate::boundary::result_length()",
    "Returns the exact byte length of the current successful result."
  ));
  sections.push(rustFunction(
    names.copyResult,
    "u32",
    "crate::boundary::copy_result(pointer, length)",
    "Copies the current result into one exact caller-owned transfer buffer.",
    "pointer: *mut u8, length: u32"
  ));
  sections.push(rustFunction(
    names.errorLength,
    "u32",
    "crate::boundary::error_length()",
    "Returns the exact byte length of the current stable error code."
  ));
  sections.push(rustFunction(
    names.copyError,
    "u32",
    "crate::boundary::copy_error(pointer, length)",
    "Copies the current stable error code into an exact caller-owned buffer.",
    "pointer: *mut u8, length: u32"
  ));
  return Buffer.from(`${sections.join("\n").trimEnd()}\n`, "utf8");
}

function renderGeneratedBrowserAdapter(profile) {
  validateInterfaceProfile(profile);
  const source = `"use strict";

// Generated by vnext-campaign-plan-wasm-codegen.js from ${profile.profileId}.
// This adapter transports exact bytes only; campaign-plan semantics remain in Rust.
(function installCampaignPlanVerifier(root, factory) {
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
  const maximumInputBytes = ${profile.maximumInputBytes};
  const maximumModuleBytes = ${profile.maximumModuleBytes};
  const statusCodes = Object.freeze(${JSON.stringify(profile.statusCodes)});
  const exportNames = Object.freeze(${JSON.stringify(profile.exports)});
  const requiredImports = Object.freeze(${JSON.stringify(profile.requiredImports)});
  const requiredExports = Object.freeze(${JSON.stringify(profile.requiredExports)});
  const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

  class CampaignPlanBoundaryError extends Error {
    constructor(code) {
      super(code);
      this.name = "CampaignPlanBoundaryError";
      this.code = code;
    }
  }

  class CampaignPlanVerificationError extends Error {
    constructor(code) {
      super(code);
      this.name = "CampaignPlanVerificationError";
      this.code = code;
    }
  }

  function exactDescriptors(actual, expected, label) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new CampaignPlanBoundaryError(label);
    }
  }

  function copyInputBytes(value) {
    if (!(value instanceof Uint8Array)) {
      throw new CampaignPlanBoundaryError("campaign_plan_input_type_invalid");
    }
    if (value.byteLength === 0 || value.byteLength > maximumInputBytes) {
      throw new CampaignPlanBoundaryError("campaign_plan_byte_limit");
    }
    return new Uint8Array(value);
  }

  function copyModuleBytes(value) {
    if (!(value instanceof Uint8Array)) {
      throw new CampaignPlanBoundaryError("campaign_plan_wasm_module_type_invalid");
    }
    if (value.byteLength === 0 || value.byteLength > maximumModuleBytes) {
      throw new CampaignPlanBoundaryError("campaign_plan_wasm_module_byte_limit");
    }
    return new Uint8Array(value);
  }

  class CampaignPlanVerifier {
    #exports;

    constructor(instance) {
      if (!(instance instanceof WebAssembly.Instance)) {
        throw new CampaignPlanBoundaryError("campaign_plan_wasm_instance_invalid");
      }
      this.#exports = instance.exports;
      if (!(this.#exports.memory instanceof WebAssembly.Memory)) {
        throw new CampaignPlanBoundaryError("campaign_plan_wasm_memory_invalid");
      }
      for (const name of Object.values(exportNames)) {
        if (typeof this.#exports[name] !== "function") {
          throw new CampaignPlanBoundaryError("campaign_plan_wasm_export_invalid");
        }
      }
      if ((this.#exports[exportNames.abiVersion]() >>> 0) !== abiVersion ||
          (this.#exports[exportNames.maximumInputBytes]() >>> 0) !== maximumInputBytes) {
        throw new CampaignPlanBoundaryError("campaign_plan_wasm_profile_mismatch");
      }
      Object.freeze(this);
    }

    finalizeCampaignPlan(bytes) {
      return this.#invoke(exportNames.finalizeCampaignPlan, bytes);
    }

    validateCampaignPlan(bytes) {
      return this.#invoke(exportNames.validateCampaignPlan, bytes);
    }

    #invoke(operationName, value) {
      const bytes = copyInputBytes(value);
      const pointer = this.#exports[exportNames.allocate](bytes.byteLength) >>> 0;
      if (pointer === 0) {
        throw new CampaignPlanBoundaryError(this.#readError("campaign_plan_allocation_failed"));
      }
      let releaseRequired = true;
      try {
        new Uint8Array(this.#exports.memory.buffer, pointer, bytes.byteLength).set(bytes);
        const status = this.#exports[operationName](pointer, bytes.byteLength) >>> 0;
        if (status === statusCodes.verificationError) {
          throw new CampaignPlanVerificationError(
            this.#readError("campaign_plan_verification_failed")
          );
        }
        if (status !== statusCodes.ok) {
          throw new CampaignPlanBoundaryError(this.#readError(
            status === statusCodes.internalError
              ? "campaign_plan_wasm_internal_error"
              : "campaign_plan_wasm_boundary_error"
          ));
        }
        return this.#copyOutput(
          exportNames.resultLength,
          exportNames.copyResult,
          "campaign_plan_wasm_result_invalid"
        );
      } finally {
        if (releaseRequired) {
          const releaseStatus = this.#exports[exportNames.release](pointer, bytes.byteLength) >>> 0;
          releaseRequired = false;
          if (releaseStatus !== statusCodes.ok) {
            throw new CampaignPlanBoundaryError("campaign_plan_wasm_release_failed");
          }
        }
      }
    }

    #readError(fallback) {
      const bytes = this.#copyOutput(exportNames.errorLength, exportNames.copyError, null);
      if (bytes.byteLength === 0) return fallback;
      try {
        const code = textDecoder.decode(bytes);
        return /^[a-z][a-z0-9_]{2,79}$/u.test(code) ? code : fallback;
      } catch (_error) {
        return fallback;
      }
    }

    #copyOutput(lengthName, copyName, emptyError) {
      const length = this.#exports[lengthName]() >>> 0;
      if (length === 0) {
        if (emptyError) throw new CampaignPlanBoundaryError(emptyError);
        return new Uint8Array();
      }
      if (length > maximumInputBytes) {
        throw new CampaignPlanBoundaryError("campaign_plan_wasm_output_limit");
      }
      const pointer = this.#exports[exportNames.allocate](length) >>> 0;
      if (pointer === 0) {
        throw new CampaignPlanBoundaryError("campaign_plan_allocation_failed");
      }
      try {
        const status = this.#exports[copyName](pointer, length) >>> 0;
        if (status !== statusCodes.ok) {
          throw new CampaignPlanBoundaryError("campaign_plan_wasm_copy_failed");
        }
        return new Uint8Array(new Uint8Array(this.#exports.memory.buffer, pointer, length));
      } finally {
        const releaseStatus = this.#exports[exportNames.release](pointer, length) >>> 0;
        if (releaseStatus !== statusCodes.ok) {
          throw new CampaignPlanBoundaryError("campaign_plan_wasm_release_failed");
        }
      }
    }
  }

  async function instantiateCampaignPlanVerifier(moduleBytes) {
    const bytes = copyModuleBytes(moduleBytes);
    const compiled = await WebAssembly.compile(bytes);
    exactDescriptors(
      WebAssembly.Module.imports(compiled),
      requiredImports,
      "campaign_plan_wasm_import_surface_invalid"
    );
    exactDescriptors(
      WebAssembly.Module.exports(compiled),
      requiredExports,
      "campaign_plan_wasm_export_surface_invalid"
    );
    const instance = await WebAssembly.instantiate(compiled, {});
    return new CampaignPlanVerifier(instance);
  }

  return Object.freeze({
    profileId,
    abiVersion,
    maximumInputBytes,
    CampaignPlanBoundaryError,
    CampaignPlanVerificationError,
    CampaignPlanVerifier,
    instantiateCampaignPlanVerifier
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
    "usage: node vnext-campaign-plan-wasm-codegen.js --write"
  );
  writeGeneratedFiles();
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Campaign-plan WASM code generation failed: ${error.message}\n`);
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
