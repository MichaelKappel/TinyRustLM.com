"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const conversation = require("../app/active-conversation.js");

const now = "2026-07-10T20:00:00.000Z";

function baseConversation() {
  return conversation.createConversation({
    id: "chat-1",
    now,
    modelKey: "qualified-local-model",
    preset: "balanced",
    generation: {
      maxTokens: "96",
      temperature: "0.65",
      topK: "40",
      topP: "0.90",
      seed: "42"
    },
    memoryMode: "both"
  });
}

function message(role, status, text, suffix, turnId = "turn-1") {
  return conversation.createMessage({
    id: `message-${suffix}`,
    turnId,
    role,
    status,
    text,
    createdAt: now
  });
}

function appendCompletedTurn(chat, suffix, userText, assistantText) {
  const turnId = `turn-${suffix}`;
  return conversation.appendTurn(
    chat,
    message("user", "completed", userText, `${suffix}-user`, turnId),
    message("assistant", "completed", assistantText, `${suffix}-assistant`, turnId),
    now
  );
}

test("conversation turn has stable identity and one message per role", () => {
  const chat = conversation.appendTurn(
    baseConversation(),
    message("user", "completed", "Explain this Rust function.", "user"),
    message("assistant", "waiting", "", "assistant"),
    "2026-07-10T20:00:01.000Z"
  );
  assert.equal(chat.messages.length, 2);
  assert.equal(chat.title, "Explain this Rust function.");
  assert.equal(chat.modelKey, "qualified-local-model");
  assert.equal(chat.memoryMode, "both");
  assert.throws(
    () => conversation.appendTurn(
      chat,
      message("user", "completed", "Duplicate.", "user"),
      message("assistant", "waiting", "", "assistant"),
      "2026-07-10T20:00:02.000Z"
    ),
    /duplicate/
  );
});

test("assistant lifecycle updates one existing timeline entry", () => {
  let chat = conversation.appendTurn(
    baseConversation(),
    message("user", "completed", "Hello", "user"),
    message("assistant", "waiting", "", "assistant"),
    "2026-07-10T20:00:01.000Z"
  );
  for (const [status, text] of [
    ["generating", ""],
    ["streaming", "Hello"],
    ["completed", "Hello from the local model."]
  ]) {
    chat = conversation.updateMessage(
      chat,
      "message-assistant",
      { status, text },
      "2026-07-10T20:00:02.000Z"
    );
  }
  assert.equal(chat.messages.length, 2);
  assert.equal(conversation.latestAssistantMessage(chat).status, "completed");
  assert.equal(conversation.latestAssistantMessage(chat).text, "Hello from the local model.");
});

test("restart converts unfinished generation to an explicit stopped state", () => {
  const chat = conversation.appendTurn(
    baseConversation(),
    message("user", "completed", "Continue", "user"),
    message("assistant", "streaming", "Partial", "assistant"),
    "2026-07-10T20:00:01.000Z"
  );
  const restored = conversation.parseConversationStore(
    conversation.serializeConversationStore([chat])
  );
  assert.equal(restored.rejectedCount, 0);
  assert.equal(restored.conversations[0].messages[1].status, "stopped");
  assert.equal(restored.conversations[0].messages[1].text, "Partial");
  assert.equal(restored.conversations[0].messages[1].errorCode, "interrupted_after_restart");
});

test("credential-like messages and exact protected values are never persisted", () => {
  const unsafeInputs = [
    "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
    "api_key=abcdefghijklmnopqrstuvwxyz",
    '{"password":"correct-horse-battery-staple"}',
    "-----BEGIN PRIVATE KEY-----",
    "sk-exampletokenvalue1234567890",
    "ghp_abcdefghijklmnopqrstuvwxyz123456",
    "AKIAABCDEFGHIJKLMNOP",
    "eyJabcdefghijk.abcdefghijklmnop.abcdefghijklmnop"
  ];
  for (const [index, text] of unsafeInputs.entries()) {
    const chat = conversation.appendTurn(
      baseConversation(),
      message("user", "completed", text, `unsafe-user-${index}`, `turn-${index}`),
      message("assistant", "failed", "", `unsafe-assistant-${index}`, `turn-${index}`),
      "2026-07-10T20:00:01.000Z"
    );
    assert.throws(() => conversation.serializeConversationStore([chat]), /unsafe|credential/i);
  }

  const protectedValue = "workspace-secret-value";
  const chat = conversation.appendTurn(
    baseConversation(),
    message("user", "completed", `Do not store ${protectedValue}`, "protected-user"),
    message("assistant", "failed", "", "protected-assistant"),
    "2026-07-10T20:00:01.000Z"
  );
  assert.throws(
    () => conversation.serializeConversationStore([chat], { protectedValues: [protectedValue] }),
    /unsafe|credential/i
  );
});

test("restore rejects a credential-bearing row without dropping safe history", () => {
  const safe = baseConversation();
  const unsafe = conversation.appendTurn(
    { ...baseConversation(), id: "chat-unsafe" },
    message("user", "completed", "token=abcdefghijklmnopqrstuvwxyz", "restore-user"),
    message("assistant", "failed", "", "restore-assistant"),
    "2026-07-10T20:00:01.000Z"
  );
  const restored = conversation.parseConversationStore(JSON.stringify({
    storeVersion: conversation.storeVersion,
    conversations: [unsafe, safe]
  }));
  assert.deepEqual(restored.conversations.map((chat) => chat.id), ["chat-1"]);
  assert.equal(restored.rejectedCount, 1);
});

test("store rejects corrupt rows while restoring valid bounded conversations", () => {
  const valid = baseConversation();
  const corrupt = { ...valid, id: "chat-corrupt", memoryMode: "secret" };
  const restored = conversation.parseConversationStore(JSON.stringify({
    storeVersion: conversation.storeVersion,
    conversations: [corrupt, valid]
  }));
  assert.equal(restored.conversations.length, 1);
  assert.equal(restored.conversations[0].id, "chat-1");
  assert.equal(restored.rejectedCount, 1);
});

test("titles prefer the final nonempty starter-prompt line and stay bounded", () => {
  const title = conversation.deriveTitle([
    {
      role: "user",
      text: "Summarize the source below:\n\nTinyRustLM keeps local prompts private while a very long sentence continues beyond the title limit."
    }
  ]);
  assert.match(title, /^TinyRustLM keeps local prompts private/);
  assert.ok(title.length <= 52);
});

test("scroll following occurs only near the timeline bottom", () => {
  assert.equal(conversation.isNearBottom({
    scrollTop: 804,
    clientHeight: 400,
    scrollHeight: 1280
  }), true);
  assert.equal(conversation.isNearBottom({
    scrollTop: 200,
    clientHeight: 400,
    scrollHeight: 1280
  }), false);
});

test("serialized store preserves only bounded public conversation fields", () => {
  const serialized = conversation.serializeConversationStore([baseConversation()]);
  assert.doesNotMatch(serialized, /bearerToken|workspaceId|retrievalCandidates|rawPayload/i);
  const parsed = JSON.parse(serialized);
  assert.deepEqual(Object.keys(parsed).sort(), ["conversations", "storeVersion"]);
  assert.deepEqual(Object.keys(parsed.conversations[0]).sort(), [
    "createdAt",
    "generation",
    "id",
    "memoryMode",
    "messages",
    "modelKey",
    "preset",
    "schemaVersion",
    "title",
    "updatedAt"
  ]);
});

test("randomized and explicit unsigned sampler seeds round-trip", () => {
  const randomized = conversation.createConversation({
    id: "chat-random-seed",
    now,
    generation: { seed: "-1" }
  });
  assert.equal(randomized.generation.seed, "-1");
  assert.equal(
    conversation.createConversation({
      id: "chat-max-seed",
      now,
      generation: { seed: "4294967295" }
    }).generation.seed,
    "4294967295"
  );
  assert.throws(() => conversation.createConversation({
    id: "chat-overflow-seed",
    now,
    generation: { seed: "4294967296" }
  }), /generation settings/);
});

// Add the current pending turn without completing or silently dropping older turns.
function appendPendingTurn(chat, id = "current", text = "What is my current name?") {
  return conversation.appendTurn(chat,
    message("user", "completed", text, `${id}-user`, `turn-${id}`),
    message("assistant", "waiting", "", `${id}-assistant`, `turn-${id}`), now);
}

test("Prompt2 projection preserves exact ordered text, empty replies and every stored turn", () => {
  let chat = baseConversation();
  for (let index = 1; index <= 8; index += 1) {
    chat = appendCompletedTurn(chat, String(index),
      `User ${index}: <|im_end|>\n\u{1f642}`, index === 4 ? "" : `Assistant ${index}`);
  }
  chat = appendPendingTurn(chat);
  const snapshot = JSON.stringify(chat);
  const messages = conversation.prompt2Messages(chat, "message-current-assistant");
  assert.equal(messages.length, 17, "no hidden six-turn truncation");
  assert.deepEqual(messages[0], { role: "user", content: "User 1: <|im_end|>\n\u{1f642}" });
  assert.deepEqual(messages[7], { role: "assistant", content: "" });
  assert.deepEqual(messages[16], { role: "user", content: "What is my current name?" });
  assert.equal(JSON.stringify(chat), snapshot);
  assert.ok(Object.isFrozen(messages));
  assert.ok(messages.every(Object.isFrozen));
  assert.throws(() => { messages[0].content = "mutated"; }, TypeError);
});

test("Prompt2 projection retains stopped corrections across restart and never sends diagnostic text", () => {
  for (const [status, text, expected] of [
    ["stopped", "", ""], ["stopped", "Partial answer", "Partial answer"],
    ["streaming", "Interrupted reply", "Interrupted reply"],
    ["failed", "model-runtime-error", ""], ["rejected", "prompt2-template", ""]
  ]) {
    let chat = conversation.appendTurn(baseConversation(),
      message("user", "completed", "Use Morgan now, not Riley.", "one-user"),
      message("assistant", status, text, "one-assistant"), now);
    chat = conversation.parseConversationStore(conversation.serializeConversationStore([chat])).conversations[0];
    chat = appendPendingTurn(chat);
    assert.deepEqual(conversation.prompt2Messages(chat, "message-current-assistant"), [
      { role: "user", content: "Use Morgan now, not Riley." },
      { role: "assistant", content: expected },
      { role: "user", content: "What is my current name?" }
    ], status);
    assert.equal(chat.messages[1].text, text);
  }
});

test("Prompt2 projection rejects missing, terminal or non-final targets and unfinished earlier turns", () => {
  const pending = appendPendingTurn(baseConversation());
  for (const id of ["", null, "x".repeat(129), "absent", "message-current-user"]) {
    assert.throws(() => conversation.prompt2Messages(pending, id));
  }
  assert.throws(() => conversation.prompt2Messages(baseConversation(), "absent"), /not found/);
  for (const status of ["waiting", "generating", "streaming"]) {
    const earlier = conversation.updateMessage(pending, "message-current-assistant", { status }, now);
    const later = appendPendingTurn(earlier, "later");
    assert.throws(() => conversation.prompt2Messages(later, "message-later-assistant"), /still active/);
    assert.throws(() => conversation.prompt2Messages(later, "message-current-assistant"), /final active/);
  }
  for (const status of ["completed", "stopped", "failed", "rejected"]) {
    const terminal = conversation.updateMessage(pending, "message-current-assistant", { status }, now);
    assert.throws(() => conversation.prompt2Messages(terminal, "message-current-assistant"), /final active/);
  }
});

test("Prompt2 projection refuses malformed role order or missing/mismatched turn pairs", () => {
  const chat = appendPendingTurn(baseConversation());
  for (const messages of [
    [chat.messages[0]], [chat.messages[1], chat.messages[0]],
    [chat.messages[0], { ...chat.messages[1], turnId: "different" }],
    [chat.messages[0], { ...chat.messages[1], role: "user", status: "completed", text: "Not an assistant", turnId: "different" }]
  ]) {
    assert.throws(() => conversation.prompt2Messages({ ...chat, messages }, "message-current-assistant"), /ordered matching/);
  }
  assert.throws(() => conversation.prompt2Messages(null, "assistant"), /must be an object/);
});

test("empty and whitespace assistant completions persist exactly while empty user messages reject", () => {
  for (const text of ["", " \n\t"]) {
    const chat = appendCompletedTurn(baseConversation(), "empty", "Hello", text);
    const result = conversation.parseConversationStore(conversation.serializeConversationStore([chat]));
    assert.equal(result.rejectedCount, 0);
    assert.equal(result.conversations[0].messages[1].text, text);
    assert.equal(result.conversations[0].messages[1].status, "completed");
    assert.throws(() => message("user", "completed", text, "invalid"), /must not be empty/);
  }
});
