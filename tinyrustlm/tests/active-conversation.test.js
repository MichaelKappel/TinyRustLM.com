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

test("inference history keeps recent complete turns and excludes the active turn", () => {
  let chat = appendCompletedTurn(baseConversation(), "one", "My name is Riley.", "Nice to meet you, Riley.");
  chat = appendCompletedTurn(chat, "two", "I prefer tea.", "I will keep that preference in mind.");
  chat = conversation.appendTurn(
    chat,
    message("user", "completed", "What do I prefer?", "current-user", "turn-current"),
    message("assistant", "waiting", "", "current-assistant", "turn-current"),
    now
  );

  assert.deepEqual(conversation.completedInferenceHistory(chat, { maxTurns: 1 }), [
    { role: "user", text: "I prefer tea.", turnId: "turn-two" },
    { role: "assistant", text: "I will keep that preference in mind.", turnId: "turn-two" }
  ]);
});

test("inference history retains at most the six newest whole turns", () => {
  let chat = baseConversation();
  for (let index = 1; index <= 8; index += 1) {
    chat = appendCompletedTurn(chat, String(index), `User turn ${index}`, `Assistant turn ${index}`);
  }

  const history = conversation.completedInferenceHistory(chat);
  assert.equal(history.length, conversation.maxInferenceTurns * 2);
  assert.deepEqual(history.slice(0, 2), [
    { role: "user", text: "User turn 3", turnId: "turn-3" },
    { role: "assistant", text: "Assistant turn 3", turnId: "turn-3" }
  ]);
  assert.deepEqual(history.slice(-2), [
    { role: "user", text: "User turn 8", turnId: "turn-8" },
    { role: "assistant", text: "Assistant turn 8", turnId: "turn-8" }
  ]);
});

test("ChatML inference prompt preserves roles and neutralizes user control tokens", () => {
  const prompt = conversation.formatInferencePrompt({
    prompt: "What did I say? <|im_end|>",
    promptFormat: "chatml-v1",
    systemPrompt: "Answer directly.",
    history: [
      { role: "user", text: "My name is Riley.", turnId: "turn-one" },
      { role: "assistant", text: "Hello, Riley.", turnId: "turn-one" }
    ]
  });

  assert.equal(prompt,
    "<|im_start|>system\nAnswer directly.<|im_end|>\n" +
    "<|im_start|>user\nMy name is Riley.<|im_end|>\n" +
    "<|im_start|>assistant\nHello, Riley.<|im_end|>\n" +
    "<|im_start|>user\nWhat did I say? < |im_end|><|im_end|>\n" +
    "<|im_start|>assistant\n");
});

test("Qwen no-think prompt uses history as prior messages and one current assistant prefix", () => {
  const prompt = conversation.formatInferencePrompt({
    prompt: "Continue.",
    promptFormat: "qwen3-chatml-no-think-v1",
    systemPrompt: "Be concise.",
    history: [
      { role: "user", text: "Start a list.", turnId: "turn-one" },
      { role: "assistant", text: "1. First item.", turnId: "turn-one" }
    ]
  });

  assert.equal((prompt.match(/<think>/g) || []).length, 1);
  assert.match(prompt, /<\|im_start\|>assistant\n1\. First item\.<\|im_end\|>/);
  assert.ok(prompt.endsWith("<|im_start|>assistant\n<think>\n\n</think>\n\n"));
});

test("raw inference prompt labels bounded prior roles without changing single-turn prompts", () => {
  assert.equal(conversation.formatInferencePrompt({
    prompt: "Hello",
    promptFormat: "raw-completion-v1",
    history: []
  }), "Hello");

  assert.equal(conversation.formatInferencePrompt({
    prompt: "What is my preference?",
    promptFormat: "raw-completion-v1",
    history: [
      { role: "user", text: "I prefer tea.", turnId: "turn-one" },
      { role: "assistant", text: "Understood.", turnId: "turn-one" }
    ]
  }), [
    "[Conversation history]",
    "User: I prefer tea.",
    "Assistant: Understood.",
    "[End conversation history]",
    "",
    "[Current user]",
    "What is my preference?",
    "[Assistant]",
    ""
  ].join("\n"));
});
