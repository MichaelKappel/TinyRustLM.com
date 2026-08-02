"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const calculator = require("../app/calculator-tool.js");

test("calculator routes explicit and expression-only arithmetic", () => {
  assert.deepEqual(calculator.parseRequest("/calc (2 + 3) * 4"), {
    expression: "(2 + 3) * 4",
    route: "slash-command"
  });
  assert.deepEqual(calculator.parseRequest("What is 2 + 2?"), {
    expression: "2 + 2",
    route: "natural-language"
  });
  assert.deepEqual(calculator.parseRequest("9 / 3"), {
    expression: "9 / 3",
    route: "expression-only"
  });
});

test("calculator leaves word problems and ordinary conversation for the model", () => {
  for (const prompt of [
    "What is the practical difference between q4 and q8?",
    "Calculate the cost after a fifteen percent discount.",
    "I have 2 apples and buy 3 more. How many do I have?",
    "42",
    "hello"
  ]) {
    assert.equal(calculator.parseRequest(prompt), null, prompt);
  }
});

test("calculator rejects code-like or oversized input before the WASM boundary", () => {
  for (const prompt of [
    "/calc print(1)",
    "/calc x + 1",
    "/calc 2 < 3",
    `\/calc ${"1".repeat(calculator.maxExpressionCharacters + 1)}`
  ]) {
    assert.equal(calculator.parseRequest(prompt), null, prompt);
  }
});

test("calculator labels tool-derived results", () => {
  assert.equal(calculator.formatResponse("2 + 2", "4"), "Calculator: 2 + 2 = 4");
  assert.throws(() => calculator.formatResponse("2 + 2", "4\nspoofed"), /invalid/);
});
