"use strict";

const fs = require("node:fs");

const { canonicalizeVnextJcsBytes } = require("../../tools/vnext-jcs.js");
const {
  inspectVnextProtectedEqualityCustody,
  scanVnextProtectedEqualityBytes
} = require("../../tools/vnext-protected-equality-custody.js");
const {
  loadVnextProtectedEqualityCustodyFromInheritedPipe,
  protectedEqualityPrivateLoaderProfileSha256,
  protectedEqualityPrivateLoaderSourceClosureSha256
} = require("../../tools/vnext-protected-equality-private-loader.js");

function writeResult(value) {
  process.stdout.write(canonicalizeVnextJcsBytes(value));
}

function inheritedDescriptorIsClosed() {
  try {
    fs.fstatSync(3);
    return false;
  } catch (error) {
    return error?.code === "EBADF";
  }
}

const trustBytes = Buffer.from(process.argv[2] || "", "base64");
const targetBytes = Buffer.from(process.argv[3] || "", "base64");
try {
  const custody = loadVnextProtectedEqualityCustodyFromInheritedPipe(trustBytes);
  const scan = scanVnextProtectedEqualityBytes(targetBytes, custody);
  writeResult({
    binding: inspectVnextProtectedEqualityCustody(custody),
    descriptorClosed: inheritedDescriptorIsClosed(),
    loaderProfileSha256: protectedEqualityPrivateLoaderProfileSha256,
    loaderSourceClosureSha256:
      protectedEqualityPrivateLoaderSourceClosureSha256,
    ok: true,
    scan: {
      findingClasses: scan.findingClasses,
      findingCount: scan.findingCount
    }
  });
} catch (error) {
  writeResult({
    causeCode: typeof error?.causeCode === "string" ? error.causeCode : null,
    code: typeof error?.code === "string" ? error.code : "internal_error",
    descriptorClosed: inheritedDescriptorIsClosed(),
    ok: false,
    step: typeof error?.step === "string" ? error.step : "internal"
  });
  process.exitCode = 1;
} finally {
  trustBytes.fill(0);
  targetBytes.fill(0);
}
