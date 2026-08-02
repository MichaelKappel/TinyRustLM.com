(() => {
  "use strict";

  const CHECKLIST_FIELDS = [
    "factuality",
    "instruction_following",
    "safety",
    "conciseness",
    "hidden_reasoning_absent",
  ];
  const PLACEHOLDER_REVIEWERS = new Set([
    "pending-reviewer",
    "reviewer",
    "human-reviewer",
    "todo",
    "tbd",
    "unknown",
  ]);
  const sessionMatch = window.location.pathname.match(/^\/s\/([^/]+)\//);
  const sessionToken = sessionMatch ? decodeURIComponent(sessionMatch[1]) : "";
  const apiRoot = sessionMatch ? `/s/${sessionMatch[1]}/api` : "";

  const state = {
    records: [],
    progress: null,
    currentId: null,
    current: null,
    expectedSha256: null,
    filter: "all",
    search: "",
    baseline: "",
    busy: false,
    loadGeneration: 0,
  };

  const elements = {
    progressLabel: byId("progress-label"),
    progressCounts: byId("progress-counts"),
    progressFill: byId("progress-fill"),
    connection: byId("connection-state"),
    visibleCount: byId("visible-count"),
    search: byId("record-search"),
    filters: byId("queue-filters"),
    recordList: byId("record-list"),
    recordPosition: byId("record-position"),
    recordTitle: byId("record-title"),
    recordMetadata: byId("record-metadata"),
    previous: byId("previous-record"),
    next: byId("next-record"),
    loading: byId("evidence-loading"),
    content: byId("evidence-content"),
    taskFamily: byId("task-family"),
    prompt: byId("prompt-text"),
    requirements: byId("response-requirements"),
    original: byId("original-response"),
    candidate: byId("candidate-response"),
    candidateOrigin: byId("candidate-origin"),
    agentConfidence: byId("agent-confidence"),
    agentRationale: byId("agent-rationale"),
    agentTags: byId("agent-tags"),
    findings: byId("automated-findings"),
    semantic: byId("semantic-references"),
    bindings: byId("evidence-bindings"),
    decisionState: byId("decision-state"),
    form: byId("decision-form"),
    response: byId("reviewed-response"),
    responseBytes: byId("response-byte-count"),
    responseRule: byId("response-rule"),
    checklist: Array.from(document.querySelectorAll("select[data-check]")),
    reviewerId: byId("reviewer-id"),
    reviewNote: byId("review-note"),
    noteCount: byId("note-count"),
    formStatus: byId("form-status"),
    reset: byId("reset-decision"),
    save: byId("save-decision"),
    resetDialog: byId("reset-dialog"),
    confirmReset: byId("confirm-reset"),
    fatal: byId("fatal-state"),
    fatalMessage: byId("fatal-message"),
    retry: byId("retry-load"),
  };

  function byId(id) {
    return document.getElementById(id);
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("X-TinyRustLM-Review-Session", sessionToken);
    if (options.body) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${apiRoot}${path}`, {
      ...options,
      headers,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch (_error) {
      payload = { message: "The workstation returned an unreadable response." };
    }
    if (!response.ok) {
      const error = new Error(payload.message || payload.error || "Request failed.");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function loadState() {
    if (!sessionToken) {
      showFatal("The local review session URL is incomplete.");
      return;
    }
    setConnection("loading", "Validating");
    elements.fatal.hidden = true;
    try {
      const summary = await api("/state");
      state.records = summary.records;
      state.progress = summary.progress;
      renderProgress();
      renderQueue();
      setConnection("ready", "Local and validated");
      const first =
        state.records.find((record) => record.action === "pending") ||
        state.records[0];
      if (first) {
        await selectRecord(first.id, true);
      }
    } catch (error) {
      setConnection("error", "Validation failed");
      showFatal(error.message || "The review handoff could not be validated.");
    }
  }

  async function selectRecord(recordId, force = false, notice = "") {
    if (!force && recordId === state.currentId) {
      return;
    }
    if (!force && isDirty()) {
      const discard = window.confirm(
        "Discard the unsaved changes to this review record?"
      );
      if (!discard) {
        return;
      }
    }
    const generation = ++state.loadGeneration;
    state.currentId = recordId;
    state.current = null;
    state.expectedSha256 = null;
    showRecordLoading();
    renderQueue();
    try {
      const record = await api(`/records/${encodeURIComponent(recordId)}`);
      if (generation !== state.loadGeneration) {
        return;
      }
      state.current = record;
      state.expectedSha256 = record.decisionFileSha256;
      populateRecord(record);
      renderQueue();
      if (notice) {
        showFormStatus(notice, "success");
      }
    } catch (error) {
      if (generation !== state.loadGeneration) {
        return;
      }
      showFatal(error.message || "The review record could not be loaded.");
    }
  }

  function populateRecord(record) {
    const review = record.review;
    const decision = record.decision;
    elements.loading.hidden = true;
    elements.content.hidden = false;
    elements.recordPosition.textContent = `Record ${record.position} of ${record.progress.record_count}`;
    elements.recordTitle.textContent = review.id;
    replaceTags(elements.recordMetadata, [
      review.priority,
      review.campaign_id,
      `batch ${review.batch_index}`,
      `${review.max_tokens} max tokens`,
    ]);
    elements.taskFamily.textContent = review.task_family;
    elements.prompt.textContent = review.prompt;
    replaceList(elements.requirements, review.response_requirements);
    elements.original.textContent = review.original_draft_response;
    elements.candidate.textContent = review.candidate_response;
    elements.candidateOrigin.textContent = humanize(review.candidate_origin);

    const evidence = review.agent_evidence;
    elements.agentConfidence.textContent = evidence
      ? humanize(evidence.confidence)
      : "No proposal";
    elements.agentRationale.textContent = evidence ? evidence.rationale : "";
    replaceTags(elements.agentTags, evidence ? evidence.evidence_tags : []);
    replaceList(elements.findings, [
      ...review.risk_flags.map((value) => `Risk: ${humanize(value)}`),
      ...review.contract_findings.map(
        (value) => `Contract: ${humanize(value)}`
      ),
    ]);
    replaceList(
      elements.semantic,
      review.semantic_clusters.map(semanticSummary)
    );
    replaceBindings(elements.bindings, [
      ["Context", review.context_sha256],
      ["Original response", review.draft_response_sha256],
      ["Candidate response", review.candidate_response_sha256],
      ["Source workbook", review.source_workbook_receipt_sha256],
      ["Assisted workbook", review.assisted_workbook_receipt_sha256],
    ]);

    const action = decision.action === "pending" ? "" : decision.action;
    setSelectedAction(action);
    elements.response.value = decision.reviewed_response;
    elements.reviewerId.value =
      action === ""
        ? storedReviewerId()
        : decision.reviewer_id;
    elements.reviewNote.value = action === "" ? "" : decision.review_note;
    for (const field of elements.checklist) {
      field.value = decision[field.dataset.check];
    }
    for (const radio of elements.form.elements.action) {
      radio.disabled = state.busy;
    }
    setDecisionState(decision.action);
    applyActionMode(action, true);
    showFormStatus("", "");
    updateCounts();
    state.baseline = formSnapshot();
    updateFormValidity();
    updateNavigation();
  }

  function showRecordLoading() {
    elements.loading.hidden = false;
    elements.content.hidden = true;
    elements.recordPosition.textContent = "Loading record";
    elements.recordTitle.textContent = state.currentId || "Review record";
    elements.recordMetadata.replaceChildren();
    setFormEnabled(false);
    updateNavigation();
  }

  function renderProgress() {
    if (!state.progress) {
      return;
    }
    const progress = state.progress;
    const percent = Math.round(progress.completion_ratio * 100);
    elements.progressLabel.textContent = progress.ready_for_merge
      ? "Explicit review complete"
      : `${percent}% reviewed`;
    elements.progressCounts.textContent = `${progress.resolved_count} of ${progress.record_count} resolved`;
    elements.progressFill.style.width = `${percent}%`;
    elements.progressFill.parentElement.setAttribute("aria-label", `${percent}% complete`);
  }

  function renderQueue() {
    const records = filteredRecords();
    elements.visibleCount.textContent = String(records.length);
    const fragment = document.createDocumentFragment();
    for (const record of records) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "record-item";
      button.setAttribute("role", "option");
      button.setAttribute(
        "aria-selected",
        String(record.id === state.currentId)
      );
      button.addEventListener("click", () => selectRecord(record.id));

      const status = document.createElement("span");
      status.className = `record-status ${record.action}`;
      status.setAttribute("aria-hidden", "true");
      const copy = document.createElement("span");
      copy.className = "record-copy";
      const id = document.createElement("strong");
      id.textContent = record.id;
      const detail = document.createElement("small");
      detail.textContent = `${humanize(record.taskFamily)} | ${humanize(record.action)}`;
      copy.append(id, detail);
      const priority = document.createElement("span");
      priority.className = `priority-mark ${record.priority}`;
      priority.textContent = record.priority;
      button.append(status, copy, priority);
      fragment.append(button);
    }
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "queue-empty";
      empty.textContent = "No records match this view.";
      fragment.append(empty);
    }
    elements.recordList.replaceChildren(fragment);
    updateNavigation();
  }

  function filteredRecords() {
    const query = state.search.trim().toLocaleLowerCase();
    return state.records.filter((record) => {
      const statusMatch =
        state.filter === "all" ||
        (state.filter === "pending" && record.action === "pending") ||
        (state.filter === "resolved" && record.action !== "pending");
      if (!statusMatch) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [record.id, record.taskFamily, record.campaignId, record.priority]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    });
  }

  function updateNavigation() {
    const records = filteredRecords();
    const index = records.findIndex((record) => record.id === state.currentId);
    elements.previous.disabled = state.busy || index <= 0;
    elements.next.disabled = state.busy || index < 0 || index >= records.length - 1;
  }

  function navigate(offset) {
    const records = filteredRecords();
    const index = records.findIndex((record) => record.id === state.currentId);
    const target = records[index + offset];
    if (target) {
      selectRecord(target.id);
    }
  }

  function setSelectedAction(action) {
    for (const radio of elements.form.elements.action) {
      radio.checked = radio.value === action;
    }
  }

  function selectedAction() {
    const checked = elements.form.querySelector('input[name="action"]:checked');
    return checked ? checked.value : "";
  }

  function actionChanged() {
    const previousAction = state.current?.decision.action || "pending";
    const action = selectedAction();
    if (action === "approve") {
      elements.response.value = state.current.review.candidate_response;
    } else if (action === "reject") {
      elements.response.value = "";
    } else if (
      action === "rewrite" &&
      (previousAction === "reject" || !elements.response.value)
    ) {
      elements.response.value = state.current.review.candidate_response;
    }
    applyActionMode(action, false);
    setDecisionState(action, true);
    showFormStatus("", "");
    updateCounts();
    updateFormValidity();
  }

  function applyActionMode(action, preserveResponse) {
    const active = Boolean(action) && !state.busy;
    for (const field of elements.checklist) {
      field.disabled = !active;
    }
    elements.reviewerId.disabled = !active;
    elements.reviewNote.disabled = !active;
    elements.response.disabled = !active || action === "reject";
    elements.response.readOnly = action === "approve";
    if (!preserveResponse) {
      if (action === "approve") {
        elements.response.value = state.current.review.candidate_response;
      } else if (action === "reject") {
        elements.response.value = "";
      }
    }
    if (action === "approve") {
      elements.responseRule.textContent = "Approval preserves the candidate exactly.";
      elements.responseRule.className = "field-message";
    } else if (action === "rewrite") {
      elements.responseRule.textContent = "Rewrite must be distinct, complete, and trimmed.";
      elements.responseRule.className = "field-message";
    } else if (action === "reject") {
      elements.responseRule.textContent = "Rejection stores no training response.";
      elements.responseRule.className = "field-message";
    } else {
      elements.responseRule.textContent = "Select an action.";
      elements.responseRule.className = "field-message";
    }
  }

  function formSnapshot() {
    return JSON.stringify({
      action: selectedAction(),
      response: elements.response.value,
      reviewer: elements.reviewerId.value,
      note: elements.reviewNote.value,
      checklist: Object.fromEntries(
        elements.checklist.map((field) => [field.dataset.check, field.value])
      ),
    });
  }

  function isDirty() {
    return Boolean(state.current) && state.baseline !== formSnapshot();
  }

  function validateForm() {
    if (!state.current) {
      return "No review record is loaded.";
    }
    const action = selectedAction();
    if (!action) {
      return "Select an explicit action.";
    }
    const reviewer = elements.reviewerId.value;
    if (
      !/^[A-Za-z0-9._-]{1,128}$/.test(reviewer) ||
      PLACEHOLDER_REVIEWERS.has(reviewer.toLocaleLowerCase())
    ) {
      return "Enter a stable reviewer ID using letters, numbers, dots, dashes, or underscores.";
    }
    const note = elements.reviewNote.value;
    if (
      note.length < 8 ||
      note.length > 512 ||
      note.trim() !== note ||
      /[\r\n\0]/.test(note)
    ) {
      return "Enter a single-line evidence note between 8 and 512 characters.";
    }
    const checklist = Object.fromEntries(
      elements.checklist.map((field) => [field.dataset.check, field.value])
    );
    if (Object.values(checklist).some((value) => value === "pending")) {
      return "Resolve every checklist field.";
    }
    if (
      (action === "approve" || action === "rewrite") &&
      Object.values(checklist).some((value) => value !== "pass")
    ) {
      return "Approved and rewritten responses must pass every checklist field.";
    }
    if (action === "reject" && !Object.values(checklist).includes("fail")) {
      return "A rejection must identify at least one failed checklist field.";
    }
    const response = elements.response.value;
    if (
      action === "approve" &&
      response !== state.current.review.candidate_response
    ) {
      return "Approval must preserve the candidate exactly.";
    }
    if (
      action === "rewrite" &&
      (!response ||
        response.trim() !== response ||
        response === state.current.review.candidate_response)
    ) {
      return "A rewrite must be distinct, non-empty, and trimmed.";
    }
    if (action === "reject" && response) {
      return "A rejection cannot carry a training response.";
    }
    if (new TextEncoder().encode(response).length > 1024 * 1024) {
      return "The reviewed response exceeds the one-megabyte limit.";
    }
    return "";
  }

  function decisionPayload() {
    return {
      action: selectedAction(),
      reviewedResponse: elements.response.value,
      reviewerId: elements.reviewerId.value,
      reviewNote: elements.reviewNote.value,
      checklist: Object.fromEntries(
        elements.checklist.map((field) => [field.dataset.check, field.value])
      ),
    };
  }

  function updateFormValidity() {
    const error = validateForm();
    elements.save.disabled = state.busy || Boolean(error);
    elements.save.title = error;
    elements.reset.disabled =
      state.busy ||
      !state.current ||
      (state.current.decision.action === "pending" && !isDirty());
    updateCounts();
  }

  function updateCounts() {
    const bytes = new TextEncoder().encode(elements.response.value).length;
    elements.responseBytes.textContent = `${bytes.toLocaleString()} bytes`;
    elements.noteCount.textContent = `${elements.reviewNote.value.length} / 512`;
  }

  async function saveDecision(event) {
    event.preventDefault();
    const validation = validateForm();
    if (validation || state.busy) {
      showFormStatus(validation || "A save is already in progress.", "error");
      return;
    }
    const recordId = state.current.review.id;
    const reviewerId = elements.reviewerId.value;
    setBusy(true, "Saving...");
    showFormStatus("Validating and saving this decision.", "info");
    try {
      const result = await api(
        `/records/${encodeURIComponent(recordId)}/decision`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedDecisionFileSha256: state.expectedSha256,
            decision: decisionPayload(),
          }),
        }
      );
      rememberReviewerId(reviewerId);
      updateRecordSummary(recordId, result.decision.action);
      state.progress = result.progress;
      renderProgress();
      renderQueue();
      state.current = result;
      state.expectedSha256 = result.decisionFileSha256;
      populateRecord(result);
      state.baseline = formSnapshot();
      const next = nextPendingRecord(recordId);
      if (next) {
        await selectRecord(next.id, true, "Previous decision saved and validated.");
      } else {
        showFormStatus(
          result.progress.ready_for_merge
            ? "All explicit decisions are complete and ready for fail-closed merge."
            : "Decision saved and validated.",
          "success"
        );
      }
    } catch (error) {
      if (error.status === 409) {
        showFormStatus(
          "This decision batch changed in another tab. Local edits were not saved.",
          "error"
        );
        const reload = window.confirm(
          "This batch changed in another tab. Reload this record and discard the local edits?"
        );
        if (reload) {
          await selectRecord(recordId, true);
        }
      } else {
        showFormStatus(error.message || "The decision was not saved.", "error");
      }
    } finally {
      setBusy(false);
      updateFormValidity();
    }
  }

  async function resetDecision(event) {
    event.preventDefault();
    elements.resetDialog.close();
    if (!state.current || state.busy) {
      return;
    }
    const recordId = state.current.review.id;
    setBusy(true, "Resetting...");
    try {
      const result = await api(`/records/${encodeURIComponent(recordId)}/reset`, {
        method: "POST",
        body: JSON.stringify({
          expectedDecisionFileSha256: state.expectedSha256,
        }),
      });
      updateRecordSummary(recordId, "pending");
      state.progress = result.progress;
      state.current = result;
      state.expectedSha256 = result.decisionFileSha256;
      renderProgress();
      renderQueue();
      populateRecord(result);
      showFormStatus("Decision reset to its exact pending template.", "success");
    } catch (error) {
      showFormStatus(error.message || "The decision was not reset.", "error");
    } finally {
      setBusy(false);
      updateFormValidity();
    }
  }

  function updateRecordSummary(recordId, action) {
    const record = state.records.find((item) => item.id === recordId);
    if (record) {
      record.action = action;
    }
  }

  function nextPendingRecord(currentId) {
    const pending = state.records.filter((record) => record.action === "pending");
    if (!pending.length) {
      return null;
    }
    const currentIndex = state.records.findIndex((record) => record.id === currentId);
    return (
      pending.find(
        (record) => state.records.findIndex((item) => item.id === record.id) > currentIndex
      ) || pending[0]
    );
  }

  function setBusy(busy, saveLabel = "Save and next") {
    state.busy = busy;
    elements.save.textContent = busy ? saveLabel : "Save and next";
    for (const radio of elements.form.elements.action) {
      radio.disabled = busy || !state.current;
    }
    const action = selectedAction();
    if (busy) {
      elements.response.disabled = true;
      elements.reviewerId.disabled = true;
      elements.reviewNote.disabled = true;
      for (const field of elements.checklist) {
        field.disabled = true;
      }
    } else {
      applyActionMode(action, true);
    }
    updateNavigation();
  }

  function setFormEnabled(enabled) {
    for (const fieldset of elements.form.querySelectorAll("fieldset")) {
      fieldset.disabled = false;
    }
    for (const field of elements.form.querySelectorAll(
      "input, textarea, select, button"
    )) {
      field.disabled = !enabled;
    }
    if (!enabled) {
      elements.save.disabled = true;
      elements.reset.disabled = true;
    }
  }

  function setDecisionState(action, draft = false) {
    elements.decisionState.className = `decision-state ${action}`;
    elements.decisionState.textContent = draft
      ? `${humanize(action)} draft`
      : humanize(action);
  }

  function showFormStatus(message, type) {
    elements.formStatus.textContent = message;
    elements.formStatus.className = `form-status ${type}`.trim();
  }

  function setConnection(status, label) {
    elements.connection.dataset.state = status;
    elements.connection.lastElementChild.textContent = label;
  }

  function showFatal(message) {
    elements.fatalMessage.textContent = message;
    elements.fatal.hidden = false;
  }

  function replaceList(container, values) {
    const fragment = document.createDocumentFragment();
    for (const value of values) {
      const item = document.createElement("li");
      item.textContent = String(value);
      fragment.append(item);
    }
    container.replaceChildren(fragment);
  }

  function replaceTags(container, values) {
    const fragment = document.createDocumentFragment();
    for (const value of values) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = humanize(String(value));
      fragment.append(tag);
    }
    container.replaceChildren(fragment);
  }

  function replaceBindings(container, values) {
    const fragment = document.createDocumentFragment();
    for (const [label, value] of values) {
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value;
      fragment.append(term, description);
    }
    container.replaceChildren(fragment);
  }

  function semanticSummary(value) {
    const cluster = value.cluster_id || value.clusterId || "cluster";
    const score = value.similarity || value.max_similarity || value.score;
    return score === undefined
      ? String(cluster)
      : `${cluster} | similarity ${Number(score).toFixed(3)}`;
  }

  function humanize(value) {
    if (!value) {
      return "Pending";
    }
    return String(value).replaceAll("_", " ").replaceAll("-", " ");
  }

  function storedReviewerId() {
    try {
      return window.sessionStorage.getItem("tinyrustlm-reviewer-id") || "";
    } catch (_error) {
      return "";
    }
  }

  function rememberReviewerId(reviewerId) {
    try {
      window.sessionStorage.setItem("tinyrustlm-reviewer-id", reviewerId);
    } catch (_error) {
      // The reviewer can continue when browser privacy policy blocks storage.
    }
  }

  elements.search.addEventListener("input", () => {
    state.search = elements.search.value;
    renderQueue();
  });
  elements.filters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) {
      return;
    }
    state.filter = button.dataset.filter;
    for (const candidate of elements.filters.querySelectorAll("button")) {
      candidate.setAttribute(
        "aria-pressed",
        String(candidate === button)
      );
    }
    renderQueue();
  });
  elements.previous.addEventListener("click", () => navigate(-1));
  elements.next.addEventListener("click", () => navigate(1));
  elements.form.addEventListener("submit", saveDecision);
  elements.form.addEventListener("input", () => {
    showFormStatus("", "");
    updateFormValidity();
  });
  elements.form.addEventListener("change", (event) => {
    if (event.target.matches('input[name="action"]')) {
      actionChanged();
    } else {
      showFormStatus("", "");
      updateFormValidity();
    }
  });
  elements.reset.addEventListener("click", () => elements.resetDialog.showModal());
  elements.confirmReset.addEventListener("click", resetDecision);
  elements.retry.addEventListener("click", loadState);
  window.addEventListener("beforeunload", (event) => {
    if (isDirty()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  setFormEnabled(false);
  loadState();
})();
