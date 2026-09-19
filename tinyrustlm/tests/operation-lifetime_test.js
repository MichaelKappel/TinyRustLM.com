"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const api = require("../app/operation-lifetime.js");
const source = fs.readFileSync(path.resolve(__dirname, "../app/operation-lifetime.js"), "utf8");

// Control the one deadline without wall-clock sleeps or persistent timer handles.
function fixture(overrides = {}) {
  const timers = new Map();
  const context = vm.createContext({ AbortController,
    setTimeout: (callback, delay) => { timers.set(1, { callback, delay }); return 1; },
    clearTimeout: id => timers.delete(id), ...overrides });
  vm.runInContext(source, context);
  const controller = new AbortController();
  const options = { signal: controller.signal, timeoutMilliseconds: 37,
    abortError: new Error("caller stopped"), timeoutError: new Error("deadline"),
    optionsError: new Error("host unsupported") };
  return { timers, controller, options, create: context.TinyRustLMOperationLifetime.create };
}

test("lifetime shares one deadline across actions and disposes after success", async () => {
  const f = fixture();
  const lifetime = f.create(f.options);
  assert.equal(f.timers.get(1).delay, 37);
  assert.equal(await lifetime.wait(() => 1), 1);
  assert.equal(await lifetime.wait(async () => 2), 2);
  assert.equal(f.timers.size, 1);
  lifetime.dispose();
  assert.equal(f.timers.size, 0);
  f.controller.abort();
  assert.equal(lifetime.signal.aborted, false);
  assert.equal(typeof api.create, "function");
});

test("deadline releases an ignored action and remains the first terminal reason", async () => {
  const f = fixture();
  const lifetime = f.create(f.options);
  let complete;
  const result = lifetime.wait(() => new Promise(resolve => { complete = resolve; }));
  await Promise.resolve();
  f.timers.get(1).callback();
  f.controller.abort();
  await assert.rejects(result, error => error === f.options.timeoutError);
  assert.equal(lifetime.signal.reason, f.options.timeoutError);
  complete(9);
  await assert.rejects(lifetime.wait(() => assert.fail("late action")),
    error => error === f.options.timeoutError);
  lifetime.dispose(f.options.timeoutError);
  assert.equal(f.timers.size, 0);
});

test("pre-abort and abort between scheduling and invocation prevent dependency calls", async () => {
  for (const preAborted of [true, false]) {
    const f = fixture();
    if (preAborted) f.controller.abort();
    const lifetime = f.create(f.options);
    const result = lifetime.wait(() => assert.fail("aborted dependency called"));
    if (!preAborted) f.controller.abort();
    f.timers.get(1).callback();
    await assert.rejects(result, error => error === f.options.abortError);
    lifetime.dispose(f.options.abortError);
  }
});

test("dependency failures survive cleanup and abort the owned signal", async () => {
  const f = fixture();
  const lifetime = f.create({ ...f.options, signal: null });
  const failure = new Error("validation failed");
  await assert.rejects(lifetime.wait(() => { throw failure; }), error => error === failure);
  lifetime.dispose(failure);
  assert.equal(lifetime.signal.reason, failure);
  assert.equal(f.timers.size, 0);
});

test("unsupported hosts retain the caller's typed configuration error", () => {
  for (const missing of ["AbortController", "setTimeout", "clearTimeout"]) {
    const f = fixture({ [missing]: undefined });
    assert.throws(() => f.create(f.options), error => error === f.options.optionsError);
  }
});
