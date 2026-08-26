"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const ownerRelativePath = "tinyrustlm/tools/qwen3-numerical-source-owner.py";
const ownerPath = path.join(repositoryRoot, ownerRelativePath);
const ownerSource = fs.readFileSync(ownerPath, "utf8");
const decisionSource = fs.readFileSync(path.join(repositoryRoot,
  "docs/architecture/2026-08-26-qwen3-source-model-load-isolation-correction.md"),
"utf8");
const profile = JSON.parse(fs.readFileSync(path.join(repositoryRoot,
  "contracts/vnext/qwen3-numerical-differential-profile.v1.json"), "utf8"));

test("source owner freezes one local IPv6 capability probe and denies alternatives", () => {
  const result = spawnSync("py", ["-3.12", "-I", "-B", ownerPath,
    "--isolation-self-test"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "pass",
    claim: "one-ipv6-loopback-capability-bind-only"
  });
});

test("source model load makes the clean-slate trust and isolation policy explicit", () => {
  assert.match(ownerSource, /trust_remote_code=False/u);
  assert.match(ownerSource, /class IsolationPolicy/u);
  assert.match(ownerSource, /maximum_loopback_capability_binds\s*=\s*1/u);
  assert.match(ownerSource, /socket\.AF_INET6/u);
  assert.match(ownerSource, /socket\.SOCK_STREAM/u);
  assert.match(ownerSource, /"::1"/u);
  assert.match(ownerSource, /"socket\.connect"/u);
  assert.match(ownerSource, /"socket\.getaddrinfo"/u);
  assert.doesNotMatch(ownerSource, /except SourceOwnerFailure:\s*fail\("source-trace-model-load"\)/u);
});

test("current numerical profile binds the exact non-egress capability probe", () => {
  assert.deepEqual(profile.implementations.publisherSourceOwner.localCapabilityProbe, {
    event: "socket.bind",
    addressFamily: "AF_INET6",
    socketType: "SOCK_STREAM",
    protocol: 0,
    host: "::1",
    port: 0,
    callerModule: "urllib3.util.connection",
    callerFunction: "_has_ipv6",
    maximumCount: 1,
    connectAllowed: false,
    listenAllowed: false,
    externalCommunication: false
  });
  assert.equal(profile.implementations.publisherSourceOwner.networkAllowed, false);
  assert.equal(profile.implementations.publisherSourceOwner.remoteCodeAllowed, false);
});

test("architecture decision preserves the old terminal and limits the new claim", () => {
  assert.match(decisionSource,
    /qwen3-numerical-c1899de-aece952-20260826-v1` remains immutable/u);
  assert.match(decisionSource, /overbroad isolation rule plus exception masking/u);
  assert.match(decisionSource, /must never\s+be invoked again/u);
  assert.match(decisionSource,
    /source tracing and\s+both numerical proof arrows remain unproven/u);
  assert.match(decisionSource,
    /Campaign counters remain exactly `0\/20`, `0\/50`, `0\/25`, `0\/40`, and `0\/20`/u);
});
