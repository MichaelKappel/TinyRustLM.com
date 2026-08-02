"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createPendingAttempt,
  finalizePendingAttempt,
  loadPendingAttempt,
  pendingIdentity,
  pendingSchema,
  removePendingAttempt,
  runAfterPendingAttempt,
  validatePendingAttempt
} = require("../tools/vector-diagnostic-pending-journal.js");

function body() {
  return {
    schema: pendingSchema,
    diagnosticId: "portable-affine-u8-successor-diagnostic",
    attemptOrdinal: 1,
    sourceRevision: "1".repeat(40),
    preregistrationSha256: "2".repeat(64),
    startedAtUtc: "2026-07-26T13:00:00.000Z",
    maximumProcessInvocationCount: 1,
    processInvocationCountAtJournalWrite: 0,
    setupStartedAtJournalWrite: false
  };
}

function temporaryDirectory() {
  return fs.mkdtempSync(
    path.join(os.tmpdir(), "tinyrustlm-vector-diagnostic-journal-")
  );
}

test("pending identity is deterministic and field sensitive", () => {
  const first = finalizePendingAttempt(body());
  const second = finalizePendingAttempt(body());
  assert.deepEqual(first, second);
  assert.deepEqual(pendingIdentity(first), {
    id: first.pendingAttemptId,
    hash: first.pendingAttemptContentHash
  });
  const changed = body();
  changed.startedAtUtc = "2026-07-26T13:00:01.000Z";
  assert.notEqual(
    finalizePendingAttempt(changed).pendingAttemptContentHash,
    first.pendingAttemptContentHash
  );
});

test("writes and reopens a canonical pending attempt before setup", async () => {
  const directory = temporaryDirectory();
  const filePath = path.join(directory, "pending.json");
  try {
    let setupObservedPending = false;
    const result = await runAfterPendingAttempt(filePath, body(), (pending) => {
      setupObservedPending = fs.existsSync(filePath);
      assert.deepEqual(loadPendingAttempt(filePath).pending, pending);
      return "setup-result";
    });
    assert.equal(result, "setup-result");
    assert.equal(setupObservedPending, true);
    const reopened = loadPendingAttempt(filePath);
    removePendingAttempt(filePath, reopened.pending);
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("setup failure leaves the already durable pending attempt recoverable", async () => {
  const directory = temporaryDirectory();
  const filePath = path.join(directory, "pending.json");
  try {
    await assert.rejects(
      runAfterPendingAttempt(filePath, body(), () => {
        assert.equal(fs.existsSync(filePath), true);
        throw new Error("synthetic setup rejection");
      }),
      /synthetic setup rejection/u
    );
    const reopened = loadPendingAttempt(filePath);
    assert.equal(reopened.pending.processInvocationCountAtJournalWrite, 0);
    assert.equal(reopened.pending.setupStartedAtJournalWrite, false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects a journal written after setup or process invocation", () => {
  const setup = body();
  setup.setupStartedAtJournalWrite = true;
  assert.throws(
    () => validatePendingAttempt(finalizePendingAttempt(setup)),
    /pending attempt ordering boundary is invalid/u
  );

  const process = body();
  process.processInvocationCountAtJournalWrite = 1;
  assert.throws(
    () => validatePendingAttempt(finalizePendingAttempt(process)),
    /pending attempt ordering boundary is invalid/u
  );
});

test("rejects tampering, unknown fields, replacement, and mismatched removal", () => {
  const directory = temporaryDirectory();
  const filePath = path.join(directory, "pending.json");
  try {
    const created = createPendingAttempt(filePath, body());
    assert.throws(
      () => createPendingAttempt(filePath, body()),
      /pending attempt already exists/u
    );

    const mismatch = structuredClone(created.pending);
    mismatch.pendingAttemptContentHash = "3".repeat(64);
    assert.throws(
      () => removePendingAttempt(filePath, mismatch),
      /pending attempt removal identity changed/u
    );

    const tampered = JSON.parse(fs.readFileSync(filePath, "utf8"));
    tampered.sourceRevision = "4".repeat(40);
    fs.writeFileSync(filePath, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");
    assert.throws(
      () => loadPendingAttempt(filePath),
      /pending attempt content identity is invalid/u
    );

    const unknown = structuredClone(finalizePendingAttempt(body()));
    unknown.privatePath = "synthetic-private-path";
    assert.throws(
      () => validatePendingAttempt(unknown),
      /pending attempt fields are invalid/u
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
