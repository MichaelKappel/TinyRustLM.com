# 1. Public-site observation log

- **TinyRustLM.com (July 13, 2026)** – Viewed on a desktop browser (≈1920×1080). The interface shows a “Local Only – System Ready – Browser-local runtime” banner, emphasizing “Local browser inference – No prompts sent to a server”. No chats exist yet (“No saved chats”), and initial prompt suggestion cards (“Summarize this article… Explain code…”) are visible. The **Model Setup** panel offers “Local .slm Import”, “Hugging Face Find sources” and “P2P import” buttons. By default P2P is off: the UI reads “P2P is off. Convert only for me creates a private local .slm”. There are fields for importing a local `.slm` (Choose Local .slm Import). The memory section is visible (showing “UAIX memory deck optional” and a placeholder “MemoryEndpoints.com hosted memory” URL). The **Local Connect** section is present but inactive, stating “Local Connect asks before app control”. At the bottom, a note says “TinyRustLM.com Browser-local Rust/WASM runtime… A tiny verified demo model loads from MiniModel.org”, indicating that a test model was autoloaded via MiniModel (though no model is yet running). The “Load a larger local model?” button is visible but disabled (no model selected). 

- **MiniModel.org (July 13, 2026)** – Attempting to browse MiniModel.org failed (DNS resolution error). No public catalog was accessible. (If deployed, MiniModel.org is expected to host the P2P model catalog, but it was not reachable at observation time.)

- **UAIX.org (July 13, 2026)** – The UAIX website is operational. For context, the **Memory Firewall** page shows public standards (e.g. “imported packets are quarantined public data until validation”). The UAIX **.NET NuGet Package** page lists official UAIX package versions (e.g. UAIX.UAI 1.0.5). Michael Kappel’s NuGet profile confirms recent package updates (e.g. *UAIX.LmRuntime.LocalEndpoint* v3.3.28 updated 6/26/2026).

- **NuGet.org (July 13, 2026)** – Public NuGet pages under the UAIX organization are up-to-date. For instance, the *UAIX.LmRuntime.LocalEndpoint* package (a runtime integration library) shows version 3.3.28 (June 26, 2026). The *UAIX.UAI* package (UAI-1 envelope primitives) is at version 1.0.5 (same date). (These indicate active maintenance but no direct UI clues for TinyRustLM.)

*Limitations:* We could not see MiniModel.org or any private companion UI. The TinyRustLM page did not reveal Companion status (no indicator of “companion installed” vs not), and no files or logs could be accessed. We observed only the browser-based interface; any local host bindings or companion service information were not visible.  

# 2. Product responsibility map

- **TinyRustLM.com (Web UI)**: Manages the chat interface and conversation. It handles prompt entry, display of history, model selection controls, P2P toggle, and invocation of memory endpoints. It runs inference in-browser (via WebAssembly) when no companion is present. It imports local `.slm` files, converts HuggingFace models to `.slm`, and coordinates with the companion for P2P actions (but it does *not* itself perform networking or storage beyond the browser). TinyRustLM.com also displays system status, logs, and the memory deck UI. It must clearly indicate states (browser-only inference, companion-paired, or remote-needed) in the UI.

- **MiniModel.org (Catalog)**: Hosts the shared model metadata/catalog. Its home page should list available public models with descriptions, source links, license, quantization, quality tier, and peer availability (number of seeders). It provides manifest and receipt files for each model, and shows when a model is stale or revoked. It is *not* an inference endpoint; it simply catalogs models for discovery and proof generation. MiniModel.org’s responsibilities include search/filter/sort of models, displaying peer counts (by lane), size, and reliability. It should distinguish test fixtures from actual conversation models, and should *not* merely mirror HuggingFace metadata without `.slm` peers.

- **TinyRustLM Companion (Desktop Service)**: Implements P2P networking, local model storage, conversions, and a loopback bridge to the browser. It is a headless service (with CLI and/or optional minimal dashboard) that: 
  - Downloads and stores `.slm` model files on the local disk.
  - Validates model integrity (using receipts/signatures).
  - Converts new models to `.slm` and (if P2P enabled) prepares and seeds the P2P share kit.
  - Maintains two “seed lanes” per model (two independent P2P connections to increase availability).
  - Hosts a local HTTP/WebSocket service for the browser UI (“Local Bridge”), on localhost only.
  - Manages a service lifecycle (install/uninstall, start/stop) and updates.
  - Coordinates publishing announcements to peers (advertisements for P2P).
  - Handles security of the local endpoint (pairing tokens, allowlists).
  It does **not** include a rich UI; any dashboard is secondary and optional. The companion runs independently of the web UI and is responsible for all filesystem/network operations.  

# 3. End-to-end journey maps and state transitions

- **First visit (no companion)**: User browses TinyRustLM.com over HTTPS. The center column shows prompt suggestions and an empty conversation. Model Setup shows “Local Only” mode. P2P is off by default, memory is off. The composer is focused with “Enter to send” instructions. No chat history exists.

- **Browser-only chat**: User selects a built-in model (e.g. “TinyLM-16M q4_0”) from the model dropdown and enters a prompt. The intro cards (“Summarize this article…”) disappear. Conversation history fills the center column with user and bot messages, streamed if applicable (see spec below). Composer stays anchored at bottom. All inference runs via WebAssembly in-browser; no external requests are made (“No data sent to a server”). If generation is slow, a progress indicator or spinner shows. The user can cancel generation, retry the last prompt, copy text, or regenerate. Model metrics (token count, memory usage) update in the UI. 

- **Installing the companion**: User downloads the TinyRustLM Companion installer from an official source and runs it. Companion sets up a local service (on a loopback-only port). It generates a random pairing token or QR code. Installation guide instructs user to connect the companion. 

- **Connecting an existing companion**: In TinyRustLM.com, the user opens the “Local Connect” section and clicks “Pair with local companion”. The UI prompts for the one-time token (or reads a QR code displayed by the companion). Upon successful pairing, the UI updates (e.g. status “Companion connected – [version]”). The companion records the browser origin as allowed. From now on, TinyRustLM.com can call the local API without extra prompts (subject to the chosen approval policy).

- **Importing a local `.slm`**: User clicks “Choose Local .slm” in Model Setup and selects a file. The UI shows it is importing/validating. Companion (or browser) checks the manifest/checksum. If valid, the model appears in the dropdown of available models. 

- **Finding a MiniModel catalog model**: On MiniModel.org (or via the TinyRustLM “Hugging Face metadata” search) user searches models. Results show model name, description, license, size, quantization, quality tier, last verified date, and “Peers: X” indicating available seeders (possibly broken down by local vs global). The user selects a desired model and obtains its share metadata (e.g. a URL or file with manifest). 

- **Converting privately vs preparing for P2P**: Back on TinyRustLM.com, if P2P is still off, converting or importing a model yields “Convert only for me” wording and results in a private `.slm` stored locally. If user enables P2P (toggle “Enable P2P import and sharing”), the action says “Prepare model for P2P”. That conversion includes generating and announcing a share kit. The UI makes clear which mode is in effect by the button label (e.g. “Convert for me” vs “Convert for P2P”). 

- **Downloading from peers**: With P2P on and known peer URLs configured, user can “Load Peer models”: the UI provides a field to enter a consenting peer’s address or apply a peer feed. When downloading, the UI shows a “Download” button next to the selected model name. Clicking it prompts the companion to fetch chunks from peers (via two seed lanes). The status shows “Download (waiting)… The download starts only after approval”. Once complete, the model is added to local storage.

- **Loading into chat**: After a model is available (via import or P2P download), it appears in the “Selected model” area. The user clicks “Load model” to activate it. The center column (conversation view) becomes active (if not already) and uses that model for generation.

- **Enabling two seed lanes**: By default, the companion uses two network connections (“lanes”) when seeding a model for P2P. In companion settings (or an advanced UI), the user can toggle two-lane mode. Each lane contacts different peers or trackers to maximize availability. The status page shows “2 lanes active” when enabled.

- **Verifying local health**: The companion continuously monitors model integrity. The UI can display model health (e.g. checksums okay). If a health check fails, the UI shows an error banner (e.g. “Model corrupted – please re-import”) and disables that model.

- **Obtaining outside proof & publishing announcement**: When P2P is enabled, upon preparing a share kit, the companion also sends an “announcement” to an external discovery mechanism (e.g. a global registry or DHT). The web UI might indicate “Published to P2P network” or similar. Verification time-stamps (proofs) are updated.

- **Stopping/revoking sharing**: User can choose “Stop sharing” for a model. Companion then ceases seeding and may remove the announcement. The UI updates to indicate the model is no longer public. Any existing peer proofs in MiniModel.org would remain record of past availability (showing “stale”).

- **Changing browsers/multiple profiles**: Pairing is per browser profile. If the user opens TinyRustLM.com in a new browser or private window, it will not automatically trust the companion; the pairing process must be repeated (via a new code/token). Sessions are isolated per profile.

- **Upgrading**: Companion updates (new version) are handled by its installer/launcher. The web UI detects version mismatches if the companion becomes out-of-date, prompting a “Upgrade required” message.

- **Uninstalling (retain models)**: If the companion is uninstalled, local model files remain on disk. Upon reinstallation (or a new device), the user can re-import `.slm` files from that folder or reconnect to peers to re-sync. The TinyRustLM web interface will detect no companion on uninstall and revert to browser-only mode; it must not delete the user’s local models silently.

# 4. Local bridge threat model and recommended protocol

Communications between the browser and companion occur over a loopback HTTP/WebSocket interface. Key security measures include:

- **Bind address and port**: The companion listens only on `127.0.0.1` (loopback), never on `0.0.0.0`. We avoid using the wildcard address because the “0.0.0.0 Day” research shows browsers may treat `0.0.0.0` specially, allowing public sites to reach it. Use a randomized high port (above 1024) to reduce port-collision attacks (no static known port).

- **HTTPS vs HTTP**: We will use plain HTTP on loopback. TLS adds little benefit here (browsers cannot get a trusted cert for localhost) and complicates deployment. Instead, we rely on other mitigations (origin checks, tokens). Modern browsers treat `http://localhost` as a secure context, so mixed-content blocks do not apply.

- **Browser Local Network Access (LNA)**: Browsers now require secure contexts for local network requests. Since TinyRustLM.com is served over HTTPS, the user can request the LNA permission or use the new `fetch(..., {targetAddressSpace:'loopback'})` option (Edge/Chrome) to exempt loopback requests from mixed-content restrictions. This ensures the web page can reach `http://127.0.0.1`.

- **Origin allowlists and CORS**: The companion’s HTTP server should enforce a strict allowlist of origins. It will only serve requests if `Origin` matches TinyRustLM.com. We will *not* use a wildcard CORS setting. As noted in security guidance, enabling CORS on a local server is dangerous unless a real TLS cert is used. Instead, the companion’s middleware will explicitly check `Origin`. All APIs will reject requests lacking the correct origin or a valid session token.

- **DNS rebinding and Host validation**: The companion must verify the HTTP `Host` header to ensure it is not tricked by DNS rebinding (e.g. a malicious site redirecting `companion.local` to loopback). At minimum, it should require `Host: 127.0.0.1:<port>` or `Host: localhost:<port>`. Any request with a mismatched host or unknown address should be dropped.

- **One-time pairing and tokens**: On first connection, the companion will generate a short one-time token. The browser shows a pairing UI (or accepts a QR code). The user inputs this token in TinyRustLM.com, proving physical access. After that, the companion issues a session token (short-lived or in memory only) that the page uses for subsequent calls. No long-lived bearer tokens are exposed to JavaScript; any token is stored in memory or secure browser storage and rotated on each new session. The companion supports explicit revocation (e.g. “forget all paired sessions”).

- **CSRF and XSS protection**: Since the companion is on localhost with a custom protocol, CSRF in the traditional sense is less relevant (requests from other sites will lack correct origin). Still, we can include anti-CSRF headers (e.g. require a custom header like `X-Locally-Signed` on state-changing requests). The UI must also guard against XSS: it should not reflect untrusted content from the companion without encoding. The companion will use a strict CSP (Content Security Policy) allowing only `localhost` and `tinyrustlm.com`.

- **Request limits and denial-of-service**: The companion will throttle requests (e.g. limit to 10 requests per second per client), and limit payload sizes. Large file uploads (models, receipts) require explicit user approval. Streaming responses will send data gradually (WebSockets or SSE) to avoid blocking. 

- **Protection from arbitrary local pages**: By default, the companion will refuse unknown requests. It will only bind endpoints needed for these tasks (model import, query, announcement). Any attempt by other local webpages (e.g. `file://` or another site) to call the companion will fail CORS/origin checks.

- **Multiple browser profiles and incognito**: Pairing is per origin and profile. We’ll not use global state; a browser in incognito will treat the companion as unpaired and require its own token. Sessions do not persist across browsers or profiles without re-pairing.

- **Local file access**: The companion will only access user-specified files (for import) or its own model folder. It will not expose arbitrary filesystem or OS-level commands to the browser. All file I/O is internal to the companion; the web page only sends models or receives data through the authenticated API.

In summary, no broad file or service control is granted to the page. The flow is “explicit consent (pairing) → short-lived credentials → CORS/origin-checked loopback HTTP → scoped APIs”. This prevents malicious sites from commandeering the companion or accessing other local resources.

# 5. Center-column active-conversation specification

- **Initial empty state**: Until the user sends the first message, the center column shows no past messages, only the prompt box and any suggestion cards (e.g. “Summarize…”, “Explain code” from the original UI). The composer remains visible at the bottom.

- **First send transition**: When the user sends a prompt, the suggestion cards and any placeholder help text disappear. The composer shifts to a minimal mode (no top cards), and the conversation history appears.

- **Conversation history**: The history occupies full height of the center column (scrolling as needed). Each message is appended in order. The most recent user or model message is always visible at the bottom. 

- **Streaming vs final output**: Both streamed tokens and final output use a single rendering path. The UI shows partial output as it arrives (e.g. character-by-character or sentence blocks), then finalizes it. Internally, there is no distinction; the same DOM element updates. Once complete, no duplicate text appears.

- **Composer anchoring**: The input box stays pinned at the bottom. If the user scrolls up into history, new messages should not force-scroll the view (unless the user is already at the bottom). Upon new bot output finishing, if the user had not scrolled up, auto-scroll resumes.

- **Cancel and retry**: A “Cancel” button appears during generation. If clicked, it stops the model. The user can then either edit the prompt or click “Retry” to resend it (using the same or different model). A “Regenerate” option appears next to past model messages, allowing re-run of the last prompt with a fresh generation (clearing the partial output and starting anew).

- **Copy and share**: Each message has a small “Copy” icon to copy text to clipboard. Long model outputs have a “Collapse/Expand” if very large.

- **Loading progress**: While waiting for the companion or WASM to start, a spinner or progress bar is shown at the top of the column (we saw “Loading demo WASM” in the UI). If a companion is converting a model, a progress modal might appear.

- **Model switching**: If the user changes the selected model mid-conversation, the current conversation is preserved but a warning might display (“Switching models; subsequent responses will come from *NewModel*”). Only messages sent after the switch use the new model.

- **Memory status**: A small indicator (e.g. “Web Memory: off” or “Short-term memory: saved”) shows current memory configuration. If the user turns memory on/off, an unobtrusive banner explains its effect.

- **Mobile layout**: On narrow viewports, the side panels collapse into top/bottom drawers. The center column still fills the available width; the composer spans full width. Keyboard focus and button sizes are adjusted for touch.

- **Keyboard accessibility**: All controls are reachable via Tab. The prompt box can be submitted with Ctrl+Enter. Buttons have `aria-label`s. Long model names use truncated text with full tooltip or screen-reader label. 

- **No overlapping columns**: The UI does not overlay content. Instead, sidebars shrink or collapse when needed; no column overlaps the conversation.

By design, after the first user message, the center column is entirely dedicated to the dialog and composer (as specified). The existing look (fonts, colors, layout) remains, but interactive behaviors (auto-scroll, cancellation, etc.) and labels are refined.

# 6. MiniModel catalog information architecture

MiniModel.org’s homepage should prominently display the **shared P2P model catalog**. For each model, show a card or row with:
- **Name/Title** and a brief **description** (role or domain).
- **Source model** (e.g. “Based on LLaMA v2 7B”).
- **Size and quantization** (e.g. “Size: 1.5GB (q4_0)”).
- **Quality tier or rating** (maybe a number or star rating).
- **License** (e.g. MIT, CC-BY).
- **Peer availability**: Total number of seeders, broken down by local LAN vs global peers (“Peers: 3 local / 12 global”).
- **Two-lane reachability**: Icons or text indicating if at least two independent paths are serving it.
- **Last verified** timestamp (when someone last confirmed model integrity).
- **Stale/revoked flag**: If a model’s proof is too old or revoked, show a banner (“Stale data” or “Revoked”).
- **Manifest/Receipt inspection**: A “View manifest” button that shows the model’s cryptographic receipt and metadata in a popup.
- **Search/Filter/Sort**: At top, users can search by name or description, filter by license or quality tier, and sort by peer count, size, or recency. Filters for quantization (f32 vs q4 vs q8) and model family (TinyLM, SmolLM, etc.) should be available.
- **Separate test vs conv models**: Clearly mark tiny “fixture” or test models, perhaps under an “Examples” category, distinct from serious conversation models.

Importantly, do *not* display raw HuggingFace lists or unreleased weights. Only models that have at least one P2P seeder (proof-ready .slm peers) should appear, since the site’s purpose is discovery of models available via P2P.

# 7. Desktop companion command/dashboard scope

The companion itself should remain mostly CLI/service-based. A small **operational dashboard or tray icon** is optional only if it improves user tasks (status, updates, diagnostics). This UI would be a thin client calling the same typed library APIs; it should *not* duplicate the web UI’s state machine.

- **CLI**: By default, the companion is controlled via command-line (for advanced users). Commands cover install, update, start/stop, set ports, manage config (port, data folder), view logs, and run health checks.
  
- **Dashboard/Tray**: A minimal status window (e.g. system tray icon) may show service health (green/yellow/red), current download progress (if active), and links to open the TinyRustLM web UI or to log files. The dashboard is *not* a fully interactive UI; heavy tasks (like model import) still happen via the browser page or CLI.

- **When GUI is needed**: A simple GUI becomes necessary only if it materially simplifies tasks for non-CLI users (e.g. Windows installers that show progress, or a first-run pairing dialog). Otherwise, the companion can assume a dev-style user.

- **Typed service APIs**: All functionality is exposed via an HTTP/WebSocket API with typed contracts (e.g. JSON schemas). The companion logic is centralized in its service core, not split between UI and core.

- **Updates and diagnostics**: The companion should support automatic or manual updates (e.g. through the tray icon). It logs to files; the browser UI can fetch logs via the local API for troubleshooting.

In summary, the companion’s UI footprint is minimal: use CLI for power, optional GUI only for status and installer. It remains a “thin client” on top of its core runtime library.

# 8. Error, recovery, and support model

**User-facing errors** should be clear and actionable, with friendly language and optional technical detail on demand. Example scenarios:

- *No companion found*: If the web UI tries to connect locally and fails, display “Local Companion not detected. Continuing with browser-only mode.” Provide a “Pair now” button or link to companion download.
- *Conversion/import error*: As seen now (“Something needs attention. Check the selected model and try again.”), refine this to “Model import failed: [specific reason]. Please select a valid .slm file.” 
- *Model validation failure*: “Error: Model checksum mismatch. This model may be corrupted or outdated.” Offer “Re-import model” or “Load from peers” options.
- *P2P download issues*: If peers unreachable, show e.g. “Unable to download model from peers (network error). Try again later or select a different source.”
- *API failures*: On local bridge timeouts, show “Connection to local service failed. Ensure the Companion app is running and try again.”
- *Unknown errors*: A generic banner “An unexpected error occurred. [Details]”. Provide a “View details” link that expands error code and stack trace (for support).
- *Recovery actions*: Include “Retry” and “Reset to defaults” buttons where appropriate. For instance, if pairing token is wrong, allow re-entering. For stale proof, suggest “Refresh model catalog”.
- *Support and logs*: Offer a “Get support” link that collects logs and opens a help page. If an operation is canceled by the user, show “Operation canceled by user” as info (not an error).

All messages should avoid technical jargon for end-users (use second person). Technical details (stack traces, checksums) are hidden under “Advanced” sections. Also, tooltips or a help icon (`?`) can explain cryptographic terms (like receipt, proof) in lay terms.

# 9. Accessibility and responsive requirements

- **Responsive design**: The layout must adapt to narrow screens. On mobile, side panels (Model Setup, Advanced Tools) become collapsible drawers. Buttons and text scale for touch. The conversation column uses full width, with composer spanning bottom. Ensure no elements overlap when view is small.
- **Keyboard-only**: All controls (chat input, send button, model dropdown, P2P toggle) are reachable by Tab. The composer input is a multiline textarea with Enter to send. Buttons have visible focus outlines. Provide `aria-label`s on icon buttons (e.g. “Copy message”).
- **Screen readers**: Use semantic HTML: `<nav>`, `<main>`, `<button>`, etc. The conversation uses `<article>` or similar for messages, with `role="log"` on the history. Announce new messages to screen readers. Ensure “New conversation” and “Prompt” fields have associated labels. Long model names should have full text in `title` and `aria-label`.
- **High contrast / theming**: Color choices should meet WCAG contrast for text on background. Avoid relying solely on color to indicate states (e.g. P2P on/off should have text labels, not just green/red).
- **Reduced motion**: Animations (e.g. scrolling, fading) should respect user’s OS “reduced motion” setting. Use simple fades or none.
- **Offline and reconnect**: If the network drops during P2P download, show a banner “Offline: retry when network is available”. If the companion restarts mid-operation, detect broken connection and allow resume.
- **Companion restart**: If the local service crashes/restarts, the UI should catch the error and prompt “Local service restarted; please retry.”
- **Multiple tabs**: If the user has the UI open in two tabs, incoming model outputs should appear only in the originating tab’s conversation. (Or disable duplicate output in secondary tabs to avoid double messages.)
- **Duplicate-response prevention**: If the companion accidentally sends the same model response twice (due to a bug), ensure the UI displays only one copy (e.g. by deduplication on identical content).
- **Import/cancel progress**: Show a progress bar during large file import or conversion, with ability to cancel. If canceled, revert to idle state cleanly.
- **Stale proof**: If a model’s proof (or outside network reachability) is stale, indicate this near the model name (“Proof age: 30+ days (outdated)”). Provide a “Refresh proof” button that re-announces.
- **Malicious-origin attempts**: The local bridge must detect if a request claims a non-allowed origin. In that case, it rejects with 403. The UI (if somehow connected to a malicious page via CORS) should not show privileged information.

# 10. Detailed browser, integration, and security test matrix

Test cases should cover:

- **Browser compatibility**: Chrome, Firefox, Edge on desktop/mobile. Verify loopback requests work (LNA prompts, targetAddressSpace). Fallback for browsers without LNA (HTTP-only).
- **Initial visit**: UI loads, no local companion. All elements render. Try mobile/desktop viewports.
- **Browser-only chat**: Send prompts. Test short, long, special-character input. Verify conversation and scroll. Test cancel/regenerate.
- **Compassion connect**: With companion running, test pairing flow: use correct token, wrong token, expired token. Try pairing twice.
- **Import local model**: Select a valid `.slm` – success; invalid `.slm` – error; cancel during import; very large file.
- **HuggingFace search**: Leave search empty, check 100 results load. Use search term filter.
- **P2P toggle**: Enable/disable P2P. Verify button text changes (“Convert only for me” vs “Prepare for P2P”).
- **Download from peers**: With a running companion and fake peer server, initiate download. Test one-lane vs two-lane. Interrupt download (network off) and resume. Cancel in progress.
- **Load model into chat**: After import/download, check it appears and can be used for chat. Switch to a different model mid-conversation.
- **Memory endpoints**: Configure invalid URL or token -> expect error. Configure valid and use short-term save. Ensure web memory entries appear under Hosted memory search.
- **Multiple tabs**: Open TinyRustLM.com in two tabs; perform actions in one and see no cross-talk. Chat in both tabs separately.
- **Private/incognito**: Repeat pairing – should require new token. Check memory and settings do not leak between incognito and normal.
- **Network resilience**: Simulate network offline during P2P or HF search. App should fail gracefully (error banners, retries).
- **Companion restart**: While downloading or seeding, kill the companion. The UI should show failure, and retry after companion restarts.
- **Permission models**: For each web-native security case: 
  - **CSRF**: Attempt a forged request (manipulate form to send without correct token/origin) – must fail.
  - **CORS**: From a different origin (e.g. a test page on evil.com), try fetching the companion API – expect blocked by same-origin policy.
  - **DNS rebinding**: Simulate a response with host header changed (127.0.0.2) – companion rejects.
  - **0.0.0.0**: Attempt to fetch `http://0.0.0.0:port` from the web page – should not work (modern browsers will block).
- **Authentication and session**: After pairing, close and reopen browser, ensure session persists (if designed so), or test forced re-pairing if not. Try “forget” action and re-pair.
- **Upgrade path**: Install older companion, then upgrade, test if user models remain and session still works.
- **Off-line UI**: Without network, the site should still allow local chat with imported models. Inform the user that catalog updates won’t work offline.
- **Malicious scenario**: Open a random local HTML file (or `file://`) that tries to call `localhost` APIs – confirm it is denied by origin check.

Each test should verify visible outcome (message, state change) and backend logs if available (for developers). All interactive elements should be tested with keyboard, touch, and mouse. Automated tests (e.g. Selenium) can script flows like “import model -> pair -> chat”.

# 11. Prioritized implementation plan with acceptance criteria

1. **Local bridge and companion service (Security foundation)**:  
   - *Implement* loopback HTTP API with strict origin checks, host validation, and pairing token logic.  
   - *Acceptance:* Browser can successfully pair (valid token) and make authorized API calls; all tests from section 10 pass for security (CORS, CSRF, host). Insecure attempts are blocked (e.g. wrong origin gets 403).  
2. **P2P networking and model handling**:  
   - *Implement* model storage, conversion to `.slm`, two-lane seeding, manifest/announcement publishing.  
   - *Acceptance:* User can import a model and it seeds; user can toggle P2P mode and see correct button wording; share kit files generate.  
3. **Web UI integration**:  
   - *Tie* the web interface to the local API. Show companion status in UI. Populate “Download” behavior and P2P conversion options.  
   - *Acceptance:* UI updates live with companion state; enabling P2P and downloading from peers works end-to-end (per tests).  
4. **Center-column UX polish**:  
   - *Remove* intro cards after first send; anchor composer; unify streaming output.  
   - *Acceptance:* After first user message, initial suggestions (e.g. “Summarize…”) no longer appear, and history is prioritized as per spec.  
5. **MiniModel.org redesign**:  
   - *Build* searchable catalog UI with metadata (peers, license, etc.).  
   - *Acceptance:* Model entries show peer count, size, license. Search/filter works. HuggingFace models without `.slm` peers are excluded.  
6. **Error/recovery flows**:  
   - *Implement* user-friendly error messages for key cases (import fail, partner lost).  
   - *Acceptance:* All negative scenarios have clear banners (“check model”, “companion not found”) and a retry path.  
7. **Accessibility and responsiveness**:  
   - *Audit* and fix UI for keyboard/screen reader. Adjust layout for mobile.  
   - *Acceptance:* WCAG compliance check (contrast, alt text, aria labels). Interface usable via keyboard only.  
8. **Testing and iteration**:  
   - *Develop* automated tests for journeys and security.  
   - *Acceptance:* CI passes end-to-end tests and all security checks (see section 10).  

Each step’s criteria are measurable (e.g. *100% of security tests pass*; *UI shows correct text and buttons*; *AXE accessibility score above threshold*).

# 12. Facts requiring local code or application access

- **Companion implementation details**: We cannot confirm which port scheme the companion uses, or exactly how it generates pairing tokens. We assume it will follow standard practice (random high port, ephemeral token), but the source code is needed to be sure.
- **Two-lane P2P mechanics**: The specifics of how the companion connects to two peers per model (protocol, failure modes) cannot be examined publicly.
- **Internal data formats**: The `.slm` file structure, model manifest/receipt formats, and conversion process are not documented externally.
- **MemoryEndpoints integration**: We inferred field usage from the UI, but the protocol (how credentials are exchanged, how memory is saved) is proprietary. Only the companion code knows for sure.
- **Browser extension alternative**: The text suggests “extension alternatives”, but without code or planning docs, we do not know if an official extension exists or is planned.
- **Approval policy storage**: The UI shows “Always approved apps” and JSON export, but we can’t see where or how these policies persist.
- **Certificate or named pipes**: The security plan mentions named pipes as an alternative, but we have no evidence if the companion might use them; public pages only show HTTP bridge.
- **Exact UI labels in companion**: We have no interface images of the companion itself (if any), so we rely on TinyRustLM.com’s wording. Any companion UI (tray/dashboard) details are unknown.

# 13. Direct links to current authoritative sources and public observations

- TinyRustLM web UI (observed July 13, 2026): local-inference chat interface.  
- TinyRustLM footer note about MiniModel autoload (same date).  
- Security analysis “0.0.0.0 Day” – Oligo Security (Aug 2024).  
- Chromium/Edge Local Network Access docs (MS Learn).  
- MDN/W3C secure contexts (StackOverflow quote).  
- StackExchange: TLS on loopback and CORS warning.  
- UAIX Memory Firewall (UAIX.org) – public standards.  
- UAIX .NET NuGet Package page.  
- NuGet gallery (Michael Kappel) listing UAIX.LmRuntime.LocalEndpoint.  
- TinyRustLM blog/developer portal (tinyrustlm.mirust.com link in UI) – no public content.  

Each citation above links to a publicly accessible resource showing the quoted content.