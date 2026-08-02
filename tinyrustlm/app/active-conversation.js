(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TinyRustLMConversation = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const schemaVersion = "tinyrustlm.local_conversation.v1";
  const storeVersion = "tinyrustlm.local_conversation_store.v1";
  const storageKey = "tinyrustlm.chat.conversations.v1";
  const maxConversations = 20;
  const maxMessages = 200;
  const maxMessageCharacters = 32 * 1024;
  const maxSerializedBytes = 1024 * 1024;
  const maxInferenceTurns = 6;
  const maxInferencePromptCharacters = 64 * 1024;
  const titleCharacters = 52;
  const allowedRoles = new Set(["user", "assistant"]);
  const allowedStatuses = new Set([
    "waiting",
    "generating",
    "streaming",
    "completed",
    "stopped",
    "rejected",
    "failed"
  ]);
  const activeStatuses = new Set(["waiting", "generating", "streaming"]);
  const allowedMemoryModes = new Set(["none", "local", "hosted", "both"]);
  const credentialPatterns = Object.freeze([
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
    /\bauthorization\s*[:=]\s*bearer\s+\S+/i,
    /\bbearer\s+[A-Za-z0-9._~+/=-]{16,}/i,
    /\b(?:sk|rk|pk)-[A-Za-z0-9_-]{16,}\b/i,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/i,
    /\bAKIA[A-Z0-9]{16}\b/,
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
    /\b(?:api|access|workspace|secret)[_-]?(?:key|token)\s*[:=]\s*["']?\S{8,}/i,
    /\b(?:token|credential)\s*[:=]\s*["']?\S{12,}/i,
    /["'](?:apiKey|accessToken|workspaceKey|secretKey|token|password)["']\s*:\s*["'][^"']{8,}["']/i,
    /\bpassword\s*[:=]\s*["']?\S{8,}/i
  ]);

  function requireString(value, name, maxCharacters, allowEmpty) {
    if (typeof value !== "string") {
      throw new TypeError(`${name} must be a string`);
    }
    if (!allowEmpty && !value.trim()) {
      throw new TypeError(`${name} must not be empty`);
    }
    if (value.length > maxCharacters) {
      throw new RangeError(`${name} exceeds ${maxCharacters} characters`);
    }
    return value;
  }

  function requireTimestamp(value, name) {
    const text = requireString(value, name, 64, false);
    if (!Number.isFinite(Date.parse(text))) {
      throw new TypeError(`${name} must be an ISO-compatible timestamp`);
    }
    return text;
  }

  function normalizeGeneration(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const normalized = {
      maxTokens: String(source.maxTokens || "80"),
      temperature: String(source.temperature || "0.65"),
      topK: String(source.topK || "40"),
      topP: String(source.topP || "0.90"),
      seed: String(source.seed || "1")
    };
    if (
      !/^\d{1,3}$/.test(normalized.maxTokens) ||
      Number(normalized.maxTokens) < 1 ||
      Number(normalized.maxTokens) > 512 ||
      !/^\d+(?:\.\d+)?$/.test(normalized.temperature) ||
      Number(normalized.temperature) < 0 ||
      Number(normalized.temperature) > 2 ||
      !/^\d{1,3}$/.test(normalized.topK) ||
      Number(normalized.topK) < 1 ||
      Number(normalized.topK) > 512 ||
      !/^\d+(?:\.\d+)?$/.test(normalized.topP) ||
      Number(normalized.topP) <= 0 ||
      Number(normalized.topP) > 1 ||
      !/^(?:-1|\d{1,10})$/.test(normalized.seed) ||
      Number(normalized.seed) > 4294967295
    ) {
      throw new TypeError("conversation generation settings are invalid");
    }
    return normalized;
  }

  function deriveTitle(messages) {
    const firstUser = (Array.isArray(messages) ? messages : [])
      .find((message) => message && message.role === "user" && String(message.text || "").trim());
    if (!firstUser) {
      return "New conversation";
    }
    const lines = String(firstUser.text)
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const source = lines.length > 1 ? lines[lines.length - 1] : lines[0];
    if (source.length <= titleCharacters) {
      return source;
    }
    return `${source.slice(0, titleCharacters - 3).trimEnd()}...`;
  }

  function containsCredentialMaterial(value, protectedValues) {
    const text = String(value || "");
    if (!text) {
      return false;
    }
    for (const protectedValue of Array.isArray(protectedValues) ? protectedValues : []) {
      const secret = String(protectedValue || "");
      if (secret.length >= 4 && text.includes(secret)) {
        return true;
      }
    }
    return credentialPatterns.some((pattern) => pattern.test(text));
  }

  function normalizeMessage(value, options) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("conversation message must be an object");
    }
    const role = requireString(value.role, "message.role", 16, false);
    const originalStatus = requireString(value.status, "message.status", 16, false);
    if (!allowedRoles.has(role) || !allowedStatuses.has(originalStatus)) {
      throw new TypeError("conversation message role or status is unsupported");
    }
    let status = originalStatus;
    let errorCode = typeof value.errorCode === "string" ? value.errorCode : "";
    if (options && options.recoverInterrupted && activeStatuses.has(status)) {
      status = "stopped";
      errorCode = "interrupted_after_restart";
    }
    const text = requireString(
      value.text,
      "message.text",
      maxMessageCharacters,
      role === "assistant" && status !== "completed"
    );
    if (role === "user" && status !== "completed") {
      throw new TypeError("user messages must be completed");
    }
    return {
      id: requireString(value.id, "message.id", 128, false),
      turnId: requireString(value.turnId, "message.turnId", 128, false),
      role,
      text,
      status,
      createdAt: requireTimestamp(value.createdAt, "message.createdAt"),
      errorCode: requireString(errorCode, "message.errorCode", 128, true)
    };
  }

  function validateTurnUniqueness(messages) {
    const messageIds = new Set();
    const turns = new Map();
    for (const message of messages) {
      if (messageIds.has(message.id)) {
        throw new TypeError("conversation contains a duplicate message id");
      }
      messageIds.add(message.id);
      const roles = turns.get(message.turnId) || new Set();
      if (roles.has(message.role)) {
        throw new TypeError("conversation contains a duplicate role for one turn");
      }
      roles.add(message.role);
      turns.set(message.turnId, roles);
    }
  }

  function normalizeConversation(value, options) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("conversation must be an object");
    }
    if (value.schemaVersion !== schemaVersion) {
      throw new TypeError("conversation schema is unsupported");
    }
    if (!Array.isArray(value.messages) || value.messages.length > maxMessages) {
      throw new RangeError("conversation message count is invalid");
    }
    const messages = value.messages.map((message) => normalizeMessage(message, options));
    validateTurnUniqueness(messages);
    const protectedValues = options && options.protectedValues;
    if (
      options &&
      options.rejectCredentials &&
      messages.some((message) => containsCredentialMaterial(message.text, protectedValues))
    ) {
      throw new TypeError("conversation contains credential-like material");
    }
    const memoryMode = requireString(value.memoryMode, "conversation.memoryMode", 16, false);
    if (!allowedMemoryModes.has(memoryMode)) {
      throw new TypeError("conversation memory mode is unsupported");
    }
    const title = deriveTitle(messages);
    return {
      schemaVersion,
      id: requireString(value.id, "conversation.id", 128, false),
      title,
      createdAt: requireTimestamp(value.createdAt, "conversation.createdAt"),
      updatedAt: requireTimestamp(value.updatedAt, "conversation.updatedAt"),
      modelKey: requireString(value.modelKey || "", "conversation.modelKey", 128, true),
      preset: requireString(value.preset || "balanced", "conversation.preset", 32, false),
      generation: normalizeGeneration(value.generation),
      memoryMode,
      messages
    };
  }

  function createConversation(options) {
    const source = options || {};
    const now = requireTimestamp(source.now, "conversation.now");
    return normalizeConversation({
      schemaVersion,
      id: source.id,
      title: "New conversation",
      createdAt: now,
      updatedAt: now,
      modelKey: source.modelKey || "",
      preset: source.preset || "balanced",
      generation: source.generation || {},
      memoryMode: source.memoryMode || "none",
      messages: []
    });
  }

  function createMessage(options) {
    const source = options || {};
    return normalizeMessage({
      id: source.id,
      turnId: source.turnId,
      role: source.role,
      text: source.text || "",
      status: source.status || (source.role === "user" ? "completed" : "waiting"),
      createdAt: source.createdAt,
      errorCode: source.errorCode || ""
    });
  }

  function appendTurn(conversation, userMessage, assistantMessage, now, options) {
    const normalized = normalizeConversation(conversation, options);
    const user = normalizeMessage(userMessage, options);
    const assistant = normalizeMessage(assistantMessage, options);
    if (
      user.role !== "user" ||
      assistant.role !== "assistant" ||
      user.turnId !== assistant.turnId
    ) {
      throw new TypeError("conversation turn must contain one matching user and assistant message");
    }
    const messages = normalized.messages.concat([user, assistant]);
    validateTurnUniqueness(messages);
    return normalizeConversation({
      ...normalized,
      updatedAt: requireTimestamp(now, "conversation.updatedAt"),
      messages
    }, options);
  }

  function updateMessage(conversation, messageId, patch, now, options) {
    const normalized = normalizeConversation(conversation, options);
    let found = false;
    const messages = normalized.messages.map((message) => {
      if (message.id !== messageId) {
        return message;
      }
      found = true;
      return normalizeMessage({
        ...message,
        ...(patch || {}),
        id: message.id,
        turnId: message.turnId,
        role: message.role,
        createdAt: message.createdAt
      }, options);
    });
    if (!found) {
      throw new TypeError("conversation message was not found");
    }
    return normalizeConversation({
      ...normalized,
      updatedAt: requireTimestamp(now, "conversation.updatedAt"),
      messages
    }, options);
  }

  function updateConversationMetadata(conversation, patch, now, options) {
    const normalized = normalizeConversation(conversation, options);
    return normalizeConversation({
      ...normalized,
      modelKey: patch && Object.prototype.hasOwnProperty.call(patch, "modelKey")
        ? patch.modelKey
        : normalized.modelKey,
      preset: patch && Object.prototype.hasOwnProperty.call(patch, "preset")
        ? patch.preset
        : normalized.preset,
      generation: patch && patch.generation ? patch.generation : normalized.generation,
      memoryMode: patch && patch.memoryMode ? patch.memoryMode : normalized.memoryMode,
      updatedAt: requireTimestamp(now, "conversation.updatedAt")
    }, options);
  }

  function normalizeStore(value, options) {
    if (!value || typeof value !== "object" || Array.isArray(value) || value.storeVersion !== storeVersion) {
      throw new TypeError("conversation store schema is unsupported");
    }
    if (!Array.isArray(value.conversations)) {
      throw new TypeError("conversation store must contain conversations");
    }
    const conversations = [];
    let rejectedCount = 0;
    const ids = new Set();
    for (const candidate of value.conversations.slice(0, maxConversations)) {
      try {
        const conversation = normalizeConversation(candidate, options);
        if (ids.has(conversation.id)) {
          throw new TypeError("duplicate conversation id");
        }
        ids.add(conversation.id);
        conversations.push(conversation);
      } catch (_error) {
        rejectedCount += 1;
      }
    }
    conversations.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id));
    return { storeVersion, conversations, rejectedCount };
  }

  function parseConversationStore(serialized, options) {
    if (!serialized) {
      return { storeVersion, conversations: [], rejectedCount: 0 };
    }
    if (typeof serialized !== "string" || serialized.length > maxSerializedBytes) {
      return { storeVersion, conversations: [], rejectedCount: 1 };
    }
    try {
      return normalizeStore(JSON.parse(serialized), {
        ...(options || {}),
        rejectCredentials: true,
        recoverInterrupted: true
      });
    } catch (_error) {
      return { storeVersion, conversations: [], rejectedCount: 1 };
    }
  }

  function serializeConversationStore(conversations, options) {
    const normalized = normalizeStore({
      storeVersion,
      conversations: Array.isArray(conversations) ? conversations : []
    }, {
      ...(options || {}),
      rejectCredentials: true
    });
    if (normalized.rejectedCount) {
      throw new TypeError("unsafe or invalid conversations cannot be persisted");
    }
    const text = JSON.stringify({
      storeVersion,
      conversations: normalized.conversations.slice(0, maxConversations)
    });
    if (new TextEncoder().encode(text).length > maxSerializedBytes) {
      throw new RangeError("conversation store exceeds its byte budget");
    }
    return text;
  }

  function latestAssistantMessage(conversation) {
    const messages = conversation && Array.isArray(conversation.messages)
      ? conversation.messages
      : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") {
        return messages[index];
      }
    }
    return null;
  }

  function previousUserMessage(conversation, assistantMessage) {
    const messages = conversation && Array.isArray(conversation.messages)
      ? conversation.messages
      : [];
    const targetTurn = assistantMessage && assistantMessage.turnId;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user" && (!targetTurn || messages[index].turnId === targetTurn)) {
        return messages[index];
      }
    }
    return null;
  }

  function completedInferenceHistory(conversation, options) {
    if (!conversation) {
      return [];
    }
    const normalized = normalizeConversation(conversation);
    const requestedMaxTurns = options && options.maxTurns !== undefined
      ? Number(options.maxTurns)
      : maxInferenceTurns;
    if (!Number.isInteger(requestedMaxTurns) || requestedMaxTurns < 0 || requestedMaxTurns > maxInferenceTurns) {
      throw new RangeError(`inference history maxTurns must be between 0 and ${maxInferenceTurns}`);
    }
    if (requestedMaxTurns === 0) {
      return [];
    }

    const turns = [];
    const byId = new Map();
    for (const message of normalized.messages) {
      let turn = byId.get(message.turnId);
      if (!turn) {
        turn = { turnId: message.turnId, user: null, assistant: null };
        byId.set(message.turnId, turn);
        turns.push(turn);
      }
      turn[message.role] = message;
    }

    return turns
      .filter((turn) =>
        turn.user &&
        turn.assistant &&
        turn.user.status === "completed" &&
        turn.assistant.status === "completed" &&
        turn.user.text.trim() &&
        turn.assistant.text.trim())
      .slice(-requestedMaxTurns)
      .flatMap((turn) => [
        { role: "user", text: turn.user.text, turnId: turn.turnId },
        { role: "assistant", text: turn.assistant.text, turnId: turn.turnId }
      ]);
  }

  function normalizeInferenceHistory(history) {
    const messages = Array.isArray(history) ? history : [];
    if (messages.length > maxInferenceTurns * 2 || messages.length % 2 !== 0) {
      throw new TypeError("inference history must contain bounded complete turns");
    }
    const normalized = [];
    for (let index = 0; index < messages.length; index += 2) {
      const user = messages[index];
      const assistant = messages[index + 1];
      if (
        !user ||
        !assistant ||
        user.role !== "user" ||
        assistant.role !== "assistant" ||
        typeof user.turnId !== "string" ||
        user.turnId !== assistant.turnId
      ) {
        throw new TypeError("inference history roles or turn identity are invalid");
      }
      normalized.push(
        {
          role: "user",
          text: requireString(user.text, "inference history user text", maxMessageCharacters, false),
          turnId: requireString(user.turnId, "inference history turnId", 128, false)
        },
        {
          role: "assistant",
          text: requireString(assistant.text, "inference history assistant text", maxMessageCharacters, false),
          turnId: user.turnId
        }
      );
    }
    return normalized;
  }

  function neutralizeTemplateControlTokens(value) {
    return String(value || "")
      .replaceAll("<|im_start|>", "< |im_start|>")
      .replaceAll("<|im_end|>", "< |im_end|>")
      .replaceAll("[INST]", "[ INST]")
      .replaceAll("[/INST]", "[/ INST]")
      .replaceAll("<<SYS>>", "<< SYS>>")
      .replaceAll("<</SYS>>", "<</ SYS>>");
  }

  function plainPromptWithHistory(prompt, history) {
    if (!history.length) {
      return prompt;
    }
    const transcript = history.map((message) =>
      `${message.role === "user" ? "User" : "Assistant"}: ${neutralizeTemplateControlTokens(message.text)}`);
    return [
      "[Conversation history]",
      ...transcript,
      "[End conversation history]",
      "",
      "[Current user]",
      neutralizeTemplateControlTokens(prompt),
      "[Assistant]",
      ""
    ].join("\n");
  }

  function formatInferencePrompt(options) {
    const source = options || {};
    const prompt = requireString(source.prompt, "inference prompt", maxInferencePromptCharacters, false);
    const promptFormat = requireString(source.promptFormat, "inference prompt format", 64, false);
    const systemPrompt = requireString(
      source.systemPrompt || "",
      "inference system prompt",
      maxInferencePromptCharacters,
      true
    );
    const history = normalizeInferenceHistory(source.history);
    const currentPrompt = neutralizeTemplateControlTokens(prompt);

    switch (promptFormat) {
      case "raw-completion-v1":
        return plainPromptWithHistory(currentPrompt, history);
      case "alpaca-instruct-v1":
        return `### Instruction:\n${plainPromptWithHistory(currentPrompt, history)}\n\n### Response:\n`;
      case "chatml-v1":
      case "qwen3-chatml-no-think-v1": {
        const sections = [];
        if (systemPrompt) {
          sections.push(`<|im_start|>system\n${systemPrompt}<|im_end|>\n`);
        }
        for (const message of history) {
          sections.push(
            `<|im_start|>${message.role}\n${neutralizeTemplateControlTokens(message.text)}<|im_end|>\n`
          );
        }
        sections.push(`<|im_start|>user\n${currentPrompt}<|im_end|>\n`);
        sections.push(
          promptFormat === "qwen3-chatml-no-think-v1"
            ? "<|im_start|>assistant\n<think>\n\n</think>\n\n"
            : "<|im_start|>assistant\n"
        );
        return sections.join("");
      }
      case "llama2-chat-v1":
        return `[INST] ${plainPromptWithHistory(currentPrompt, history)} [/INST]`;
      default:
        throw new TypeError(`inference prompt format is unsupported: ${promptFormat}`);
    }
  }

  function isNearBottom(metrics, threshold) {
    const source = metrics || {};
    const distance = Number(source.scrollHeight || 0) -
      Number(source.clientHeight || 0) -
      Number(source.scrollTop || 0);
    return distance <= (Number.isFinite(threshold) ? threshold : 96);
  }

  return Object.freeze({
    schemaVersion,
    storeVersion,
    storageKey,
    maxConversations,
    maxMessages,
    maxMessageCharacters,
    maxInferenceTurns,
    allowedStatuses: Object.freeze(Array.from(allowedStatuses)),
    createConversation,
    createMessage,
    appendTurn,
    updateMessage,
    updateConversationMetadata,
    normalizeConversation,
    parseConversationStore,
    serializeConversationStore,
    containsCredentialMaterial,
    deriveTitle,
    latestAssistantMessage,
    previousUserMessage,
    completedInferenceHistory,
    formatInferencePrompt,
    isNearBottom
  });
}));
