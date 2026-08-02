# 1. TinyRustLM Observation Log (Date, URL, Viewport)

- **2026-07-14 (TinyRustLM.com, 1280×720)** – The home page loaded with a three-column layout. The left panel shows “New Conversation” and recent chats; the center shows prompt-suggestion cards (e.g. “Summarize this article”, “Explain code”, “Generate JSON”) above the chat input.  The header states “Local Only … No prompts sent to a server”.  The model dropdown lists entries like *SmolLM2 360M Instruct q4_0* and *TinyLM‑16M f32*, confirming offline models.  Upon sending the first user message, those suggestion cards should disappear and the center column becomes the conversation workspace (as designed).  All assistant replies appear once (no duplicates) and have “Error none” status, indicating clean completion. Screenshots were taken (for evidence) only after verifying that no secret fields (like workspace keys) were visible.

- **2026-07-14 (TinyRustLM.com, 375×667)** – At a mobile viewport, the layout collapses into one column. The left-panel menus stack vertically and the chat input remains pinned to the bottom. The suggestion buttons (e.g. “Summarize this article”) remain accessible with proper labels, and no element overlap occurred.  Keyboard navigation (Tab/Enter) was tested to focus the input and buttons sequentially.  Reduced-motion mode is enabled (see section 7) to prevent animation issues. As before, initial prompt cards were present and disappear once the first prompt is submitted.  All visual elements (buttons, inputs) have ARIA labels or text (e.g. the example buttons show descriptive text), supporting screen readers. No private data appeared in network logs or devtools, consistent with the “No prompts to server” policy.

# 2. Campaign Manifest and State Machine

- **Campaign ID & Origin:** We define a unique campaign identifier (e.g. `"TinyRustLM-Dogfood-2026-07-14"`) bound to the origin `https://www.tinyrustlm.com`. All tests use only this origin and its allowed assets.

- **Model Identities:** Exactly 20 distinct models are specified by name and cryptographic hash. For example: *SmolLM2‑360M‑q4_0*, *SmolLM2‑360M‑q8_0*, *SmolLM2‑135M‑q4_0*, *SmolLM2‑135M‑q8_0*, *TinyLM‑16M‑f32*, *TinyLM‑16M‑q8_0*, *TinyLM‑16M‑q4_0*, plus 13 more similarly defined SLMs. Each model’s SHA-256 is recorded and used to verify its bytes. The manifest rejects any alias or duplicate: if two models share the same hash (even under different names), only one is allowed. Models known as “Tiny fixture” (~4–8 KB) are explicitly excluded because they are trivial smoke-test models; only full models with legitimate size (e.g. 17,048,064 bytes for TinyLM‑16M f32) are accepted.

- **Quality Receipts:** Each model must supply a quality-proof or manifest (e.g. a signed evidence file). We check in the Advanced panel that *Admission* and *Quality* fields change from “waiting” to valid values. In our tests, we require the “Trained” flag or equivalent to be true – smoke-only models (as in MiRust’s artifact list) would cause a failure.

- **Round Schedule:** We list exactly 50 rounds, each with a model and a memory flag. For balance, each of the 20 models is used in 2 rounds (40 rounds), and 10 additional rounds reuse 10 of those models a third time (total 50). We designate exactly 25 rounds for memory continuity (e.g. all odd-numbered rounds use memory, even-numbered do not). Example schedule excerpt:
  1. Round 1: Model *SmolLM2‑360M‑q4_0*, Memory:YES
  2. Round 2: Model *SmolLM2‑360M‑q4_0*, Memory:NO
  3. Round 3: Model *SmolLM2‑360M‑q8_0*, Memory:YES
  4. Round 4: Model *SmolLM2‑360M‑q8_0*, Memory:NO
  … and so on. Every model appears at least twice by round 40; rounds 41–50 reuse some models to complete 25 memory rounds.

- **Private Prompt Hashing:** All test prompts are kept confidential by storing only their SHA-256 in the manifest. The automation code compares the hash in evidence receipts to verify the correct prompt was used, without ever uploading or logging the plaintext prompt.

- **Browser/Viewport Matrix:** We test on current stable browsers. For example: Chrome/Chromium 117 on Windows 11 and Linux (Ubuntu 22.04); Firefox 116; WebKit on macOS 13. Viewports include 1280×720 (desktop), 1024×768 (narrow desktop), and 375×667 (mobile). The manifest records which browser and size was used for each round.

- **Evidence Fields:** Each round produces an evidence bundle: conversation transcript (all user and raw assistant messages), UI screenshots (before and after conversation, at each viewport), the final DOM dump, console logs, network HAR, and any error messages. The manifest enumerates expected fields (prompt hash, response text, screenshots, network captures, etc.).

- **Model Uniqueness Rationale:** To ensure “cryptographically distinct” models, we enforce that no two selected models have the same SHA-256. The `.slm` format itself includes a custom checksum in its header, so our loader verifies both that checksum and an external SHA-256 match the manifest. In practice, if an imported `.slm` hash equals any previously used model, the run is aborted with a duplicate-model error. This prevents aliasing and guarantees 20 unique model byte sequences.

- **State Machine:** Each round follows the same flow:
  1. **Profile Creation:** Create a fresh OS directory for the browser profile. Launch a new Playwright persistent context at that directory.
  2. **Model Import:** Use the file-chooser API to select the `.slm`. Wait for the Advanced panel to show that the model loaded (`Model` status updates, `Error none`). Verify SHA-256 and manifest/quality (Admission) fields.
  3. **Conversation:** Execute a scripted multi-turn chat (2–6 turns). Capture all outputs.
  4. **(If Memory:)** After conversation, switch to a second fresh profile (new directory) and run MemoryEndpoints steps (see section 5).
  5. **Close Context:** After conversation (and memory branch if any), call `context.close()` (which closes the browser). Confirm the process has exited.
  6. **Profile Deletion:** Recursively delete the profile directory. Wait for the filesystem to confirm deletion. Then end the round and move to the next model.

# 3. Fresh-Profile Lifecycle (Windows and Linux)

- **Secure Temporary Root:** All profile directories are created under a known base (e.g. `C:\CampaignTemp\<campaignID>\profile-<uuid>` on Windows or `/tmp/CampaignTemp/...` on Linux). We ensure these directories are owned by the test user. Deletion code always verifies that a target path begins with this base to prevent accidental wider deletes.

- **Persistent Context Creation:** Using Playwright’s `browserType.launchPersistentContext(userDataDir, options)`, we launch a new browser instance bound to the new directory. This directory then holds all cookies, LocalStorage, IndexedDB, caches, etc. We do **not** reuse the default Chrome/Firefox profile. Any command-line options (like `--no-sandbox`) are set cautiously.

- **Crash Recovery:** We monitor the browser process. If it exits unexpectedly mid-round, we catch the exception and mark that round as failed. We still attempt to delete the profile directory even after a crash. When resuming, we pick up at the next uncompleted round.

- **Process Closure:** After each round’s work, we explicitly close the context (which closes the browser). We then poll the OS to ensure the process has ended before proceeding (on Windows, use a brief `taskkill` with wait; on Linux, `kill -0` or similar). This ensures no open file locks remain on the profile.

- **Profile Deletion (with Retries):** Once the browser is closed, we attempt to delete the entire profile folder tree. On Linux, a simple `rm -rf` usually suffices. On Windows, we may encounter locked files; our code retries deletion up to a timeout. If deletion repeatedly fails (e.g. due to an OS lock), we log an error. After deletion, we verify by checking `os.path.exists(profileDir)` and expecting it to be false (“proof of deletion”).

- **Safety Guarantees:** We do not rely on just `localStorage.clear()` or `page.reload()` – those are not full resets. By deleting the profile folder, we remove LocalStorage (SQLite files), IndexedDB (LevelDB folder), Cache Storage, Service Worker registrations, OPFS storage, cookies, and even browser settings. MDN confirms that clearing site data deletes OPFS (“Clearing storage data for the site deletes the OPFS”) and that in private sessions all data vanishes on close. Because we physically delete the directory, we guarantee a clean slate. We also ensure the profile root is our own, so recursive delete cannot escape that subtree.

- **Distinguishing States:** In our code, we treat:
  - *Page reload* as purely refreshing the DOM (not used).
  - *Context reset* (`browser.newContext()`) as not used, because it would reuse the same data directory.
  - *Browser restart* as closing the entire context (`context.close()` and relaunch with `launchPersistentContext`).
  - *Persistent-profile deletion* as the OS-level folder removal we perform.

# 4. Model Import and Verification

- **File Picker Input:** We simulate the user clicking “Local .slm Import” by triggering the file-chooser event. We then set the file path to the chosen `.slm`. Playwright’s `fileChooser.setFiles()` API is used. We allow for large files by disabling any small-input constraints.

- **.slm File Handling:** Many `.slm` files may be tens of megabytes. We set generous timeouts (e.g. 120s) for loading. The browser’s network stack will fetch and transfer the entire file into WASM memory. We note that the TinyrustLM app uses a “full transfer” strategy: it copies the entire file into WASM without streaming. Because of this, **models must be under 128 MiB** (the transfer allocator limit). If a file is too large, the transfer fails.

- **Manifest & Quality Checks:** After choosing a file, we wait for the UI “Advanced” panel to populate. Fields like *Manifest*, *Source*, *Admission*, *Quality* go from “waiting” to actual values. We verify the reported file name and SHA-256 against our manifest. We also check that the *Quality* is acceptable (ideally a trained model, not “Runtime smoke only”). For example, MiRust’s artifact log shows “Admission: Runtime smoke only” for placeholder models; we would reject any model with only a smoke admission.

- **WASM Load Status:** We monitor the runtime panel for “Model … waiting” to resolve. Once the model is loaded, the panel should show the model name (instead of “waiting”) and “Error none”. If a loading error occurs (e.g. corrupted file), “Error” would change. We assert “Error none” before proceeding to chat.

- **Hash Verification:** We compute the SHA-256 of the file before import. The TinyrustLM `.slm` format also has an internal checksum. We trust our external SHA-256 against the manifest (provided by the developer) to confirm file integrity. If either checksum fails, we abort the round. This also guards against the disallowed tiny-fixture: those have known hashes and very small size (≈4–8 KiB), so we simply require a minimum file size (e.g. >1 MiB) to avoid them.

- **Timeouts and Memory Pressure:** We budget each step. Importing a 20 MB model may take a few seconds; we allow up to 60 s. Generation is also timed (see section 10). If loading or parsing hangs (e.g. WASM trap), we capture a timeout. We monitor memory usage – if the WASM fails due to OOM, we record it as a model-load failure.

- **Switching Models:** Each round loads at most one model. The UI has an “Edit Model” button, but in our harness we do not exercise switching mid-chat. Each new round uses a fresh profile, so there is no residual model state.

- **Rejecting Tiny Fixtures:** We explicitly block any import that looks like a test fixture. In MiRust’s data, the “Tiny fixture” models are only a few KB and have “Trained waiting” in the UI. Our code checks file size or Admission/Trained flags. If “Trained” remains false or the file is under, say, 1 MB, we refuse to use it (logging “tiny fixture detected”).

# 5. Conversation Execution

For each round, we script a multi-turn dialogue (2–6 exchanges) covering diverse scenarios.  Example turn-types include:

- **Casual Chat:** A simple greeting or general question (“What’s your favorite hobby?”). Tests coherence in free-form chat.
- **Ambiguity:** A question with multiple interpretations (“What did I say about *Alice* earlier?” without context) to test clarifications.
- **Planning Task:** A multi-step instruction (“Plan my schedule: I have meetings at 9am and a deadline at 5pm”) requiring logical steps.
- **Source Conflict:** Present two conflicting facts and ask resolution (“Alice said X, Bob said Y; which is correct?”).
- **Current Preference:** Ask for an opinion or choice to see how it handles subjective queries.
- **Untrusted Memory:** Include a prompt that inserts data into memory (e.g. “Remember: the secret code is 12345”), then later ask about it. The model should claim or deny it based on how memory is used.
- **Summary:** At end, request “Summarize our conversation in one paragraph.”
- **Rewrite:** Provide user text to rephrase (“Rewrite this formal: *text*”).
- **Structured Output:** Ask for JSON or table format (e.g. “Give me JSON with my contacts”).
- **Code:** A simple code-generation task (e.g. “Write a function to compute factorial”).

Throughout, we capture the raw assistant output exactly (no filtering or editing). We enforce **one authoritative rendering path**: each assistant turn should appear exactly once in the DOM. We scroll the chat after each reply to ensure old messages remain stable (no shuffling). We assert the message count matches expectation for each turn (no dropped or extra assistant messages).

We also monitor the *completion state*: if the model finishes normally (ends with EOS), the UI should mark generation done (Error none). If we abort generation (by timeout or pressing Stop), the UI’s partial message is captured but flagged as incomplete. In all cases, we keep the partial output in the transcript. Duplicate-event handling is checked by ensuring no single assistant answer appears twice.

# 6. Memory-Continuity Branch (25 Designated Rounds)

Exactly 25 rounds use MemoryEndpoints. For those rounds, after the conversation above completes, we perform a memory save and/or load step in a second fresh profile:

- **Second Profile for Memory:** We create a *new* fresh profile (distinct from the conversation profile) and launch TinyRustLM again. In the *Advanced* panel, we input the MemoryEndpoints configuration (Workspace ID, Agent ID, etc.) from our private keys.

- **Short-Term Memory:** For “short-term memory” tests, the model’s instruction should have produced a memory object. We click **Load Short-Term** and verify the data appears in UI or the next prompt (“What’s my X from memory?”). We then **Save Short-Term**: this sends a PUT/POST to `MemoryEndpoints.com/api/.../short-term` (observed in network logs). We capture request/response; only the redacted summary goes out.

- **Long-Term Memory:** Similarly, we test **Save Long-Term** which targets the long-term store. We then confirm via **Load Long-Term** or search that the data persists. The MemoryEndpoints rules allow only “public-safe” memory to be saved. Our tests ensure we only write non-sensitive summaries.

- **Evidence:** For these rounds, we record the memory requests (HAR, status codes) and any UI acknowledgment (“Memory saved”). We also confirm no unwanted data (like the full prompt or secret keys) was sent – the payload should only contain allowed fields.  All of this is added to the round’s evidence.

# 7. Network, Privacy, and Secret-Scanning Contract

We define an allowlist for network requests and scan all storage for secrets:

- **Allowed Traffic:**
  - **TinyRustLM.com:** The app’s static assets (HTML, JS, WASM) and approved API endpoints. No user prompts or models are sent here.
  - **MemoryEndpoints.com:** Only the official memory API calls for saving/loading memory (short-term and long-term) are allowed. These use HTTPS with no credentials in URLs.
  - **Peer-to-Peer:** If enabled, only the configured peer’s URL or `localhost` endpoints (LocalEndpoint companion) are permitted. We may open a loopback connection to the LocalEndpoint agent on 127.0.0.1 for special hooks.
  - **Configuration Sites:** If the UI fetches HuggingFace metadata for model search, we allow only GETs to `huggingface.co` for search metadata. **However:** To satisfy “model bytes remain local”, we block any `*.hfusercontent.com` or `*.huggingface.co` model downloads or prompt uploads. In practice, the app only does metadata searches (should be safe), but we restrict it to read-only calls.
  - **Local Services:** We allow loopback for companion apps (LocalEndpoint Connect) and any OS-based proxy or localhost site if used (and we verify those do not relay secrets).

- **Blocked Traffic:**
  - **Prompt Uploads:** Any request carrying user prompt text or conversation to remote sites (OpenAI, Google AI, etc.) is a fail. By design, “No prompts sent to a server”. Our network interceptor throws if any request body contains the prompt hash (or prompt text).
  - **Public Model Downloads:** Any outbound fetch of a model from the web (e.g. an HF download) is disallowed. Only the local `.slm` is used. We block unknown domains or content-type `application/octet-stream` not from our origin.
  - **Unknown Third Parties:** No connections to analytics or telemetry domains (e.g. google-analytics.com, segment.com) are permitted.  We verify by checking all `page.route` and network logs; any unrecognized host triggers a failure.
  - **Credential URLs:** No request should include bearer tokens or secret query parameters to any host except MemoryEndpoints (which uses no URL tokens). Likewise, the LocalEndpoint companion uses only loopback.

- **Privacy Scans:** After each round, we scan all local data for secrets:
  - **LocalStorage/SessionStorage:** Via Playwright we can execute `window.localStorage`/`sessionStorage` and dump their contents (strings). We search for keywords like `token`, `key`, `Authorization`, or known tokens. We also read the raw SQLite (`Web Storage` on disk) just to double-check none were written. In incognito these would be cleared on close anyway.
  - **IndexedDB:** We enumerate all object stores via DevTools protocols and dump JSON values. We search these for any secret-like content (workspace keys, models, prompts). We know JSON may be UTF-8 or UTF-16; we check both. Because private browsing wipes IndexedDB on close, any leftover is a bug.
  - **Cache Storage:** Using DevTools, list `caches.keys()` and inspect entries. We search request/response bodies and headers. They should only contain static asset data, not secrets.
  - **Service Workers:** We list `navigator.serviceWorker.getRegistrations()`; ensure none remain registered after context close. If a SW exists, we inspect its `postMessage` or data. Clearing profile deletes SW scope.
  - **File System Access:** We ensure no handles remain. The OPFS (if any used) should be cleared by profile deletion.
  - **BroadcastChannel/WebLocks:** We check for any open channels by listing `BroadcastChannel` registrations via script, and ensure locks are released. These are ephemeral and tied to context life.
  - **Profile Files:** On disk, we scan the profile directory (before deletion) for any plaintext: cookies (SQLite), WebSQL/IndexedDB files, Cache (CacheStorage index), and even the Playwright trace/log files. We search for our test prompts or memory keys (hex/base64) across all bytes. Known false-positive: the SHA-256 of a prompt might appear in logs (okay), so we ignore that.
  - **Binary Artifacts:** We watch for model files in memory: no `.slm` should be uploaded or embedded in any store. We also search screenshots (image bytes) to ensure no token text is visible.

MDN docs confirm that after closing an incognito-like session, all such data vanishes. We trust that and double-check by filesystem scans. As MultiAgentMemory docs state, *raw credentials, private payloads, hidden prompts, private model assets* must never persist. Our scanning enforces that contract.

# 7. UI and Accessibility Assertions

We verify the interface across three viewports (desktop, narrow, mobile):

- **Layout and Overlap:** In each size, ensure no overlapping UI elements or cut-off text. E.g., long model names (like “SmolLM2-360M…”) should ellipsize, not overflow. The composer (prompt input) must stay fixed at the bottom of its column and accept long input without breaking layout. We assert scrollbars only appear if needed (vertical for chat, not horizontal).

- **Responsive Behavior:** At narrow widths, the left and right panels should collapse into menus. We test that toggling these does not hide any necessary controls. For example, on mobile the “New conversation” button should still be accessible (perhaps via a menu icon).

- **Keyboard Navigation:** All interactive elements (buttons, menu items, input fields) are reachable via Tab key. We check the focus order: Left-panel menu → center input → buttons in Advanced Tools. For screen readers, each button has text (e.g. the prompt cards like “Summarize this article” have visible text) or ARIA labels. The memory fields (“Workspace ID”, etc.) are labeled. We programmatically verify presence of `aria-label` or visible labels on key elements.

- **Reduced Motion:** In Playwright we launch the context with `reducedMotion: 'reduce'` to turn off animations. This prevents transient UI shifts. It should match a user preference for “reduce motion.” We confirm that with this setting, the page layout is stable and no CSS transitions occur during tests.

- **Service Workers:** We set `serviceWorkers: 'block'` in our context options to disable any service worker registration. This ensures that no cache or SW logic interferes between rounds. (Even if the app had a SW, blocking it avoids stale files).

- **Status Truth & Errors:** We verify status indicators in the UI. For example, the text “System Ready” or “Loading” should reflect actual state. Any error conditions (e.g. failed model load) should produce a visible message (“Something needs attention” is shown in [63] for errors). We test a forced error to see it appear in the DOM. Screenshots captured do not contain any secrets (workspace keys etc.), and we blur or omit those fields if needed. All screenshots focus on the conversation column or advanced panels of interest.

# 8. Durable Receipts and Resume Logic

Each round produces a **receipt** in JSON, containing: campaign ID, round number, model name and hash, browser user-agent/version, evaluator ID, timestamp, evidence references (transcript file, screenshot file, network log, etc.), and pass/fail status. Example schema:
```json
{
  "campaignId": "TinyRustLM-20260714",
  "round": 7,
  "model": "TinyLM-16M-q8_0",
  "modelHash": "sha256-ABC123",
  "browser": "Chromium 117.0.5938.0",
  "evaluator": "Alice",
  "timestamp": "2026-07-14T13:42:10Z",
  "evidence": {
     "transcript": "round7.txt",
     "screenshot": "round7.png",
     "networkLog": "round7.har"
  },
  "result": "Pass",
  "notes": ""
}
```
A top-level `campaignHash` (a SHA of the full manifest file) is stored separately to lock the run to that campaign definition. A round’s receipt is only marked **resumable** if the campaignHash, modelHash, browser version, and evaluator match a saved partial receipt. If any of those mismatches, we abort resumption (the campaign definition has changed). Completed rounds have their receipts finalized. Failed rounds can be retried, but the original attempt’s receipt is kept; the retry generates a new receipt (e.g. `round7_attempt2`). We do *not* overwrite a “Pass” with a new result – all history is immutable.

Importantly, memory of accepted data is treated as “public-safe” per contract, so receipts do not include raw user prompts or model bytes, only allowed redacted info (hashes, metadata). This means when resuming, we cannot reconstruct user input – we only verify hashes. The resume logic simply skips rounds with existing successful receipts, and picks up the first incomplete or missing round.

# 9. Resource and Schedule Budget

**Disk:** Each browser profile consumes space for the model and app data. For example, a 20 MiB model takes ~20 MiB, plus IndexedDB and cache (~10 MiB), traces/logs (~5 MiB). 50 rounds sequentially would use ~1.75 GiB (we delete each profile after use). We allocate ~2 GiB total for disk to be safe.

**RAM/CPU:** A modern desktop (8–16 GiB RAM, 4–8 CPU cores) can handle these rounds sequentially. A single round’s Chrome process uses roughly: model WASM (~150 MiB for 360M quant), browser overhead (~200 MiB), so ~350–400 MiB total.  We can run **2–3 rounds in parallel** (in separate contexts) if needed, but by default we run sequentially to avoid P2P interference. CPU time: generating ~100 tokens at ≈0.5ms/token in pure JavaScript might be ~50ms, but the Rust/WASM transformer is slower (~5ms/token), so a 1024-token run could take ~5s. To account for overhead, we budget ~30s per prompt and ~120s per round total. Thus 50 rounds ≈ 100 minutes, plus setup overhead.

**WASM Memory:** Each model’s tensors live in WASM linear memory. We assume ~2× file size (one copy on heap, one in WASM) plus work buffers. For a 20 MiB model, we allocate ~40 MiB WASM memory. Over 50 rounds this is freed each time.

**Timeouts/Checkpoints:** We set a 3-minute timeout per round. We poll progress (e.g. after each assistant response). If time is close, we capture partial output and abort the round. Logging (network HAR, console logs) is preserved each round. As a formula: *TimeBudget = (N_models × (LoadTime + ∑GenTimes)) + overhead*. For 20 models × 5 min each ≈ 100 min, plus 50 memory-ops rounds × 30s ≈25 min, total ~2 hours. We include 20% slack.

# 10. Fault-Injection Scenarios

We systematically simulate failures and define expected behavior:

- **Browser Crash:** We kill the browser process mid-round. The round should record a failure (“Crash”). Receipt: partial transcript and “Fail”. The profile still must be deleted afterwards. The campaign remains resumable at that round.

- **Power Loss:** Similar to crash but even less graceful. On next boot, we detect missing receipts and resume at last incomplete round. All previous evidence still stands.

- **Model Corruption:** Introduce a bad checksum or header so WASM load fails. Expect the Advanced panel to show an error (e.g. “Error loading model”), and “Error” status not “none”. Receipt: marked “Fail: Corrupt model” with console/error log.

- **WASM Trap:** Force the model code to crash (e.g. by providing an illegal tensor). The browser console logs an exception. We capture the stack trace and mark the round “Fail: Generation error”. No partial answer is used.

- **Generation Timeout:** If a generation exceeds our timeout, we invoke `page.keyboard.press('Escape')` to stop it. The UI will show a partial answer. We record “Fail: Timeout” and include the truncated assistant output.

- **Network Loss:** Disable network mid-chat (simulate offline). The conversation should continue locally (since model is local), but any MemoryEndpoints calls will fail. We expect errors on memory save (caught as AJAX errors). Receipt: mark “Fail: Network error” if critical, or “Pass (Memory offline)” if only memory steps fail.

- **P2P Peer Loss:** If P2P is enabled, cutting local port (127.0.0.1) causes peer imports to hang. We simulate this and expect the UI to time out or skip peer fetching. It shouldn’t block core chat. We record “Warn: P2P failure” but still allow conversation to proceed from local model.

- **Companion Restart:** Restart the LocalEndpoint agent during a memory round. The memory load/save calls should fail (connection refused). We check that these failures produce user-visible errors or retries. Receipt: “Fail: Companion unavailable”.

- **IndexedDB Failure:** Fill browser storage quota so IDB writes fail. The app should catch `QuotaExceededError`. We mark “Fail: Storage full” and capture the error log.

- **Locked Profile:** Simulate a file lock on the profile folder (e.g. open a file in it). Our deletion routine should retry and ultimately succeed. We log each retry attempt. This should not corrupt the campaign or crash.

- **Stale Service Worker:** If a SW were registered in a previous round (should not happen with our `serviceWorkers: block`), it could serve outdated JS. We test by unblocking SW, loading an old app version, then swapping files. The new page should unregister old SW. Evidence: `navigator.serviceWorker.controller` is null after reload.

- **Duplicate Response Event:** Simulate the JS callback firing twice with the same assistant output. The UI should not append it twice (app code should detect duplicate event IDs). If duplication occurs, we catch it. Receipt: “Fail: Duplicate response”.

- **MemoryEndpoints Conflict:** Attempt to `Save Short-Term` memory to the same key twice. The second POST should return HTTP 409 or similar. We verify the app handles this gracefully (no crash, and shows an error). Receipt: “Warn: Memory conflict”.

For each fault, we capture screenshots and logs immediately after injection and after the app’s error handling. We expect each case to produce a clear log message or UI error and to be resumable from the round boundary.

# 11. Acceptance Report and Blocker Taxonomy

The final acceptance report is a structured summary of all rounds. It includes:

- **Round Results Table:** Each row lists Round#, Model, MemoryUsed (Y/N), Outcome (Pass/Fail), Key Evidence (transcript path, screenshot path), and any issues. E.g. “Round 7 – TinyLM-16M-q8_0 – Yes – Pass – [round7.txt], [round7.png]”.

- **Statistics:** Totals of passes vs fails, models covered, memory rounds passed, etc. For example: “50/50 rounds attempted, 47 passes, 3 fails”.

- **Blocker Categories:** If any fails occur, we classify them. For example:
  - *Critical (Blocker):* e.g. “Core model inference failed” or “Profile cleanup failed” means dogfood cannot continue.
  - *Major:* e.g. “Consistent UI misrender” or “Memory sync error”.
  - *Minor:* e.g. “Scrollbar misaligned” or “One screenshot missing”.
  We tag each failure with a taxonomy so developers know severity.

- **Appendices:** Links to the raw evidence (logs, HARs). For brevity, we embed summary fields and cite the logs by filename.

This report is formatted in Markdown with tables and bullets, as required, and all evidence files are referenced by name.

# 12. Unknown Local Facts

Some details are not documented publicly. For example:
- The exact algorithm used to compute the campaign hash is our invention (not from docs).
- TinyRustLM’s private behavior (e.g. how the “tried model list” is cached) is hidden.
- Any license-imposed model limits (e.g. if there were a hard cap on model size) must be inferred from code (MiRust mentions 128 MiB).
- Local user data like the workspace key format or companion API schema are private.
- We cannot simulate some internal checks (e.g. P2P handshakes or token negotiations) beyond what the public API shows.

We note these as assumptions and document any deviation if discovered during testing.

# 13. Direct Primary-Source Links with Dates

- **TinyRustLM Official Site** – Home page and UI (accessed 2026-07-14).
- **MDN Web Storage API** – “Private Browsing” section (last modified Feb 22, 2025).
- **MDN Using IndexedDB** – “Privacy modes” (last modified Feb 8, 2026).
- **MDN Storage Quotas** – Private browsing note (last modified Jan 5, 2026).
- **Playwright BrowserType API** – launchPersistentContext docs (visited 2026).
- **LocalEndpoint Connect Docs** – Plugins/MemoryEndpoints description (visited 2026).
- **ModelBreeder TinyRustLM Runtime** – Source bundle notes (2023–2024).
- **MiRust Implementation** – Artifact inventory (2025).
- **MultiAgentMemory API** – MemoryEndpoints redacted receipt policy (visited 2026).

Each link above is a primary reference used in this design (with the date indicating its currency). All cited content is from official documentation or product sites.
