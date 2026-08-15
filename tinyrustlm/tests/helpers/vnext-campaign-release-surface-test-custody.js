"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "../../..");
const vectorsPath = path.join(repositoryRoot, "contracts", "vnext",
  "campaign-projection-rust-vectors.v1.json");
const fixtureProfiles = Object.freeze({
  deploymentBinding: "release-surface-deployment-binding",
  empty: "release-surface-empty",
  secretAttestation: "release-surface-secret-attestation",
  unsafeChangelog: "release-surface-unsafe-changelog"
});
const deploymentBindingTest =
  "rejects caller deployment truth and deployment-attempt binding drift";
const deploymentBindingSecret = "deployment-receipt-protected-value";
const secretAttestationTest =
  "records only a public-safe redaction failure when an attestation contains a known secret";
const unsafeChangelogTest =
  "persists only public-safe failure evidence for an unsafe changelog";
const unsafeChangelogSecret = "release-secret-material-93c17f2a";

function exactStringArray(value, label) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0 ||
      Object.getOwnPropertyNames(value).length !== value.length + 1 ||
      value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new TypeError(`${label} must be an exact nonempty-string array`);
  }
  return Object.freeze([...value]);
}

function attestationSecret() {
  const vectors = JSON.parse(fs.readFileSync(vectorsPath, "utf8"));
  const entry = vectors.acceptedCases.find((candidate) =>
    candidate.name === "complete-capacity");
  const receiptId = entry?.receiptIds?.[0];
  if (typeof receiptId !== "string" ||
      !/^sha256:[a-f0-9]{64}$/u.test(receiptId)) {
    throw new Error("release surface secret fixture vector is invalid");
  }
  return receiptId.slice("sha256:".length, "sha256:".length + 20);
}

function knownSecretsForFixtureProfile(profileId) {
  switch (profileId) {
    case fixtureProfiles.deploymentBinding:
      return Object.freeze([deploymentBindingSecret]);
    case fixtureProfiles.empty:
      return Object.freeze([]);
    case fixtureProfiles.secretAttestation:
      return Object.freeze([attestationSecret()]);
    case fixtureProfiles.unsafeChangelog:
      return Object.freeze([unsafeChangelogSecret]);
    default:
      throw new Error("release surface custody fixture profile is invalid");
  }
}

function fixtureProfileForTestNames(rawNames) {
  const names = exactStringArray(rawNames, "release surface test names");
  const secretProfiles = [];
  if (names.includes(deploymentBindingTest)) {
    secretProfiles.push(fixtureProfiles.deploymentBinding);
  }
  if (names.includes(secretAttestationTest)) {
    secretProfiles.push(fixtureProfiles.secretAttestation);
  }
  if (names.includes(unsafeChangelogTest)) {
    secretProfiles.push(fixtureProfiles.unsafeChangelog);
  }
  if (secretProfiles.length === 0) return fixtureProfiles.empty;
  if (secretProfiles.length !== 1 || names.length !== 1) {
    throw new Error("secret-sensitive release tests require isolated shards");
  }
  return secretProfiles[0];
}

module.exports = Object.freeze({
  deploymentBindingSecret,
  deploymentBindingTest,
  fixtureProfileForTestNames,
  fixtureProfiles,
  knownSecretsForFixtureProfile,
  secretAttestationTest,
  unsafeChangelogSecret,
  unsafeChangelogTest
});
