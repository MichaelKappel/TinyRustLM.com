"use strict";

const codePattern = /^[a-z][a-z0-9_]{2,79}$/u;
const stepPattern = /^[a-z][a-z0-9_-]{2,63}$/u;

class VnextEvidenceError extends Error {
  constructor(code, step, causeCode = null) {
    const boundedCode = codePattern.test(String(code || "")) ? String(code) : "internal_error";
    const boundedStep = stepPattern.test(String(step || "")) ? String(step) : "internal";
    super(`vNext evidence ${boundedStep} failed: ${boundedCode}`);
    this.name = "VnextEvidenceError";
    this.code = boundedCode;
    this.step = boundedStep;
    this.causeCode = causeCode !== null && codePattern.test(String(causeCode))
      ? String(causeCode)
      : null;
  }
}

function failEvidence(code, step, causeCode = null) {
  throw new VnextEvidenceError(code, step, causeCode);
}

function asEvidenceError(error, code, step) {
  if (error instanceof VnextEvidenceError) return error;
  const candidateCauseCode = String(error?.code || "").toLowerCase();
  const causeCode = codePattern.test(candidateCauseCode)
    ? candidateCauseCode
    : null;
  return new VnextEvidenceError(code, step, causeCode);
}

module.exports = Object.freeze({
  VnextEvidenceError,
  asEvidenceError,
  failEvidence
});
