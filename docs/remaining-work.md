# Remaining Work

Detailed outline of what's left to build. Everything below is scoped from the
reference bundle (`.package-assets/ion-dist`) plus the patterns already
established in `src/main/local-backend.ts`,
`src/main/local-ui.ts` (the `LOCAL_CLIENT_PATCHES` array), and
`src/preload/local-workbench.ts`.

## Cross-cutting facts to remember

- **The `custom3pCompatible` kill-switch**: the retained client's shared
  react-query wrapper force-disables any query not flagged
  `custom3pCompatible:!0`. Every cloud query surfaced locally needs a
  per-callsite patch adding that flag (see the memory/projects query patches
  for the pattern). Symptom when missed: UI renders but never fetches.
- **The local sidebar is bespoke**, so native nav registrations never mount.
  New entry points must be injected in the preload (see the Projects sidebar
  row and the Customize Memory row).
- **Read-only/ownership gating**: cloud surfaces treat objects whose creator
  UUID doesn't match the account as read-only (this is what made local
  projects show up archived). Local API responses must echo the fixed local
  account UUID `00000000-0000-4000-8000-000000000002` as creator.
- **Feature gates** live as minified helpers in `c6eedc03a-*.js` and the
  route table in `c63a78ed4-*.js`; patch them to `!0`/`!1` as needed.
- Always rebuild BOTH installers (`npm run dist:win` + the WSL AppImage
  script) and run `npm run smoke:packaged` before declaring a fix shipped.

---

## 1. Connectors surface (partially started)

**Goal:** a working Customize → Connectors page that manages the local MCP
servers, replacing the current "Connectors have moved to Customize" dead end.

**Status:** The MCP _client_ is fully built and connectors already work in
chat. Only the management _page_ is missing. The route gate is already patched
(`keep-customize-connectors-route`), but the page component (`_l` in
`c63a78ed4`) still bounces to `/customize/skills` through a second internal
availability gate that needs tracing.

**To do:**

- Trace `_l`'s origin (it's not a plain import in `c63a78ed4`; likely a
  lazy-loaded chunk) and find the second gate that redirects it. Patch that
  gate on.
- Back the connectors list/add/remove UI against the existing desktop MCP
  server config (`state.appConfig.mcpServers`) — the same config the MCP
  client already reads. The native page's CRUD calls need to map to
  local endpoints or the existing MCP settings service.
- Surface connection status (connected / failed to start) per server, reusing
  the MCP client's per-server lifecycle.
- Re-add the Settings tab entry and the Customize row (both were reverted to
  avoid shipping dead links; re-enable once the page renders).
- Probe: open the page, add a server, confirm it appears and its tools reach
  chat.

**Estimated effort:** small–medium (client already exists; this is UI plumbing
plus one gate trace).

---

## 2. Scheduled tasks

**Goal:** let the user schedule a prompt to run on a cadence (the native
"Scheduled tasks" feature), backed entirely locally.

**Reference:** the desktop service is `CoworkScheduledTasks`
(`src/generated/desktop-api.d.ts`): `createScheduledTask`,
`getAllScheduledTasks`, `updateScheduledTask`, `updateScheduledTaskStatus`,
`getScheduledTaskFileContent`, `onOnScheduledTaskEvent`, etc. The native UI
strings live across several chunks (search "Scheduled task"). There's a
capability gate and a "restart the desktop app to enable this" fallback string
to unlock.

**To do:**

- **Task store**: add a `scheduledTasks` array to `LocalData` (persisted in
  `local-backend.json`): id, name, prompt, schedule (cron-ish or interval),
  enabled, last-run, next-run, created-at, and per-run history/output refs.
- **Scheduler**: a main-process timer (like the memory-synthesis debounce)
  that wakes on the nearest due task, runs a normal chat completion against
  the configured provider in a dedicated (or hidden) conversation, and records
  the result. Must survive app restarts (recompute next-run on load) and skip
  missed runs gracefully (there's a native "missed at … Running now" string).
- **Service backing**: implement the `CoworkScheduledTasks` methods locally in
  `services.ts` (or a new `local-scheduled-tasks.ts`), wired through the IPC
  dispatcher, returning the local task store shape. Emit
  `onOnScheduledTaskEvent` on run start/finish so the native UI updates live.
- **Unlock the UI**: patch the capability gate and route so the native
  scheduled-tasks surface renders; add a sidebar/entry point if the native one
  doesn't mount (bespoke-sidebar rule).
- **Output surfacing**: scheduled runs should produce a viewable transcript /
  file output the user can open (native `getScheduledTaskFileContent`).
- Probe: create a task with a short interval, confirm it fires, produces
  output, and the row updates.

**Estimated effort:** medium (store + scheduler + service + UI unlock).

---

## 3. Computer use & Browser use — DONE (2026-07-17)

Shipped. Browser use: headed persistent Chrome (playwright-core, external
in the electron build) with browser_navigate/read_page/click/type/
screenshot chat tools, one tab per conversation, screenshots served via
`/api/local/browser/shots/...`. Computer use (Windows): desktopCapturer
screenshots in physical pixels + user32 PowerShell input helper
(click/type/key), native per-conversation consent dialog before the first
action, `CLAUDE_LOCAL_COMPUTER_AUTOCONSENT=1` for probes (which never
send input). Both behind off-by-default Capabilities toggles
(`enabled_browser_use` / `enabled_computer_use`), fail closed when off.
Probe: `probe:device-use`. Linux computer-use input remains unimplemented
(clear error).

### Original plan (for reference)

**Goal:** enable the native "Computer use" and "Browser use" capability
toggles and back them locally.

**Reference:** capability keys exist in the native capability map
(`code_execution`, `memory`, `web_search`, and a `claude_brow…` /
computer-use entry). i18n has the macOS permission strings ("Computer use
needs two macOS permissions…", "Computer use is on. To finish setup, grant
the macOS permissions below."), we can also make this more possible on windows and linux by using something like open-computer-use or other similar tools for those platforms. Playwright is already a dependency
(`playwright-core`, `playwright-extra`, stealth plugin) and there's existing
launch-preview/element-picker infrastructure in
`src/main/local-launch-preview.ts`.

**To do — Browser use (do this first; lower risk):**

- Add a tool (or tool set) the chat loop exposes when browser use is on:
  navigate, click, type, read page, screenshot — backed by the existing
  Playwright stack.
- Drive a dedicated Playwright browser context; stream screenshots/results
  back as tool-result blocks the chain can render.
- Add the settings toggle (General capabilities) and gate the tool on it.
- Reuse the element-picker/launch-preview plumbing where possible.

**To do — Computer use (harder; platform-specific):**

- Screen capture + input injection (mouse/keyboard) at the OS level. On
  Windows this is native input APIs; the native app's macOS flow needs two
  system permissions (Accessibility + Screen Recording) — replicate the
  equivalent permission request/guidance per platform.
- Implement the computer-use tool contract (screenshot, click at coords, type,
  key, scroll) the model expects, gated behind the toggle and an explicit
  per-session user confirmation.
- **Safety**: this injects real input. Must be off by default, clearly
  indicated when active, and interruptible.

**Estimated effort:** browser use = medium; computer use = large + platform
work + safety review.

---

## 4. Chat-mode code execution sandbox (Docker) — DONE (2026-07-17)

Shipped. Implementation notes vs. the original plan below:

- `src/main/local-sandbox.ts` embeds the Dockerfile (python:3.12-slim +
  node 22 + uv/pip with pandas/numpy/openpyxl/pillow/matplotlib/requests +
  ffmpeg/git/zip/jq) and builds it via `docker build -` from stdin — no
  packaged asset file needed. Image tag `open-claude-sandbox`.
- Per-conversation containers bind-mount `userData/sandbox/<uuid>` at
  `/workspace` (no docker cp), run `--network none` unless the
  `enabled_wiggle_egress` account setting is on, with 2 GB / 2 CPU / pids
  limits, in-container `timeout 180`, 30-min idle reaping, label-based
  stale-container cleanup, and disposal on quit.
- Chat tool `bash_code_execution` is exposed only when `enabled_wiggle` is
  true; hallucinated calls while disabled fail closed like disabled web
  search. Uploads copy to `/workspace/uploads` before each completion; a
  loaded skill's files stage to `/workspace/skills/<name>` (new optional
  `files()` on LocalSkillSource). New/changed files after each run are
  listed in the tool result with `/api/local/sandbox/files/{conv}/{path}`
  download links (route validates traversal, serves as attachment).
- Chain rows reuse the proven generic `mcp_tool` display path with
  `description: "Ran code · <command>"` rather than gambling on the native
  wiggle renderer expecting `server_tool_use` shapes.
- Settings toggle lives in the injected Model settings panel under a
  "Capabilities" heading (bespoke-panel pattern), with the three status
  states (red ✗ missing/stopped, spinner while building, green ✓ ready)
  polled from `/api/local/sandbox/status` every 2.5 s while the panel is
  open, plus a separate "Sandbox internet access" toggle
  (`enabled_wiggle_egress`; allowed-hosts restriction not implemented).
- Tests: `tests/local-sandbox-wiring.test.ts` (status route, tool
  execution + generated-file links, fail-closed gating, download
  traversal), plus a real-Docker end-to-end drive of build/run/staging.

### Original plan (for reference)

**Goal:** a "Code execution" general setting (requires Docker) that gives chat
a sandboxed runtime with node/npm, python/uv, and common packages preinstalled,
so the model can run scripts, process uploaded/generated files, and produce
downloadable outputs — including running scripts that skills provide.

**Reference (from research):** the native feature is codenamed **"wiggle"**.

- Feature gate: `wiggle` (rbac entitlement `code_execution`).
- Account/org setting: `enabled_wiggle` (displayed as `code_execution_enabled`).
- Network egress controls: `enabled_wiggle_egress` +
  `wiggle_egress_allowed_hosts` (displayed as `code_execution_network_egress_*`).
- Settings label in the capabilities list: "Code execution and file creation".
- The chat file sidebar IS the wiggle file browser — the `AQt` hook exposes
  `wiggleFiles`, `refetchWiggleRoot`, `selectWiggleFile`,
  `wiggleSharedArtifacts` (index chunk ~@4014628); `WiggleSharingModals` lives
  in `cf774f0c4`.
- The client already accepts `server_tool_use` content blocks (`c30db9bec`
  `hM()` treats `tool_use` / `server_tool_use` / `mcp_tool_use` alike).

**To do:**

- **Runtime image** (`assets/sandbox/Dockerfile`): base with node+npm,
  python3 + uv/pip, and common packages (pandas, numpy, openpyxl, pillow,
  matplotlib, requests, ffmpeg, etc.). Tag e.g. `open-claude-sandbox`. Keep it
  reasonably small; document what's preinstalled.
- **Sandbox manager** (`src/main/local-sandbox.ts`):
  - Docker availability probe (`docker version`) → distinguishes not-installed
    vs. not-running.
  - Build-once: build the image if absent, streaming progress; cache the
    "ready" state.
  - Per-conversation container: `docker run -d` with `--network=none` unless
    egress is enabled (then restrict to allowed hosts), a `/workspace`
    working dir, resource limits, and auto-cleanup.
  - Exec: `docker exec` with a timeout and captured stdout/stderr.
  - File I/O: list `/workspace` after each run; expose generated files as
    downloadable attachments; copy uploaded chat files into
    `/workspace/uploads`.
- **Chat tools**: a `bash_code_execution` (and/or python) tool exposed only
  when the setting is on; results stream as tool-use/tool-result blocks;
  generated files become downloadable via a local endpoint
  (`/api/local/sandbox/files/{conversation}/{path}`).
- **Skill scripts**: when a skill is loaded, copy its support files into the
  sandbox (`/workspace/skills/<name>`) so skill-provided scripts are runnable.
- **Settings toggle** (General): "Code execution (requires Docker)" with the
  **three status states** the user specified, shown beneath the toggle:
  - red ✗ — "Docker is not installed" / "Docker is not running — start it".
  - gray spinner — "Building the code execution image (one time)…".
  - green ✓ — "Code execution environment is ready".
  - Backed by `/api/local/sandbox/status` returning
    `{ docker: "missing" | "stopped" | "ok", image: "absent" | "building" | "ready" }`,
    polled while the panel is open.
- Set `enabled_wiggle: true` in account settings when the toggle is on so any
  native wiggle UI (the file sidebar, sharing modals) unlocks.
- Probe: toggle on → status resolves green → send a prompt that writes a file
  → confirm it's downloadable and that an uploaded file is readable inside the
  sandbox.

**Estimated effort:** large (Docker orchestration + file bridging + tool
wiring + status UI), but the plan is fully scoped and the wiggle UI hooks
already exist in the client.

---

## 5. Project-wide file uploads (knowledge base) — DONE (2026-07-17)

Shipped. Notes vs. the plan below:

- The native Files card and instructions editor were hidden by the
  permissions hook (`hasKBEditPermissions`), whose membership/permissions
  queries the `custom3pCompatible` kill-switch never runs locally — every
  project rendered read-only. Fixed with the
  `grant-local-project-edit-permissions` patch in `c6eedc03a` (single local
  user owns every project); `/accounts` and `/permissions` routes also
  return a real "user" membership as belt-and-braces.
- The native upload control extracts client-side and POSTs `/docs` — that
  path now works end to end (probed: file lands in the Files card list).
  `/projects/{id}/upload` and `/projects/{id}/files` (+ `delete_many`,
  single DELETE) are additionally backed with real blob storage and
  extraction; `kb/stats` returns real counts/bytes; `/sync` (singular) no
  longer 404s.
- Injection: docs AND uploaded files inject into every chat of the project
  through the budget-capped `<project_knowledge>` block
  (`tests/local-project-files.test.ts` proves a fresh project chat sees
  uploaded content without attaching).
- The composer's project chip can now also remove/assign a chat's project
  (conversation PUT handles `project_uuid`, including null).
- Probe: `tools/probe-project-page.mjs`.

### Original plan (for reference)

**Goal:** projects should accept real file uploads at the project level that
are automatically referenced across _every_ chat started in that project — a
persistent project knowledge base, not just per-chat attachments.

**Status:** Projects already exist with a text-only `docs` array that injects
into project chats as `<project_knowledge>`. This item upgrades that to real
file uploads with extraction.

**Reference:** the native project detail page already has the upload UI and
endpoints — `/projects/{id}/upload`, `/projects/{id}/files`,
`/projects/{id}/docs` (and `docs/delete_many`, `files/delete_many`), plus a
`kb/stats` endpoint for knowledge-base size.

**To do:**

- **Upload handling**: back `/projects/{id}/upload` and `/projects/{id}/files`
  locally — accept a file, store it in the project's directory under the
  profile, and extract its text (reuse the chat attachment extraction path:
  txt/md/code direct, PDF/docx/xlsx via the same extractors used for chat
  uploads, images noted by name).
- **Storage model**: extend the project store so a project owns uploaded files
  (uuid, filename, mime, size, extracted text, stored path) alongside the
  existing text docs. Wire the delete endpoints (single + `delete_many`).
- **Injection**: every chat whose `project_uuid` matches injects the project's
  files (budget-capped, like the current `<project_knowledge>`) into the
  system prompt, so the knowledge is available in all project chats without
  re-attaching.
- **Knowledge-base stats**: back `kb/stats` with real counts/size so the UI's
  capacity indicator works.
- **UI**: confirm the native upload control and file list render on the project
  detail page (unlock any gate; inject an entry if the bespoke sidebar hides
  it). Files should be listed, viewable, and removable.
- Probe: create a project, upload a file, start a fresh chat in the project,
  confirm the file's content is referenced without attaching it to that chat.

**Estimated effort:** medium (mostly reuses the attachment-extraction pipeline
and the existing project store + knowledge injection).

---

## Suggested order

1. ~~**Code execution sandbox**~~ — done 2026-07-17.
2. **Project-wide file uploads** — reuses the attachment pipeline + existing
   project store; high value, moderate effort.
3. **Browser use** — reuses the existing Playwright stack.
4. **Scheduled tasks** — self-contained, clear service contract.
5. **Connectors page** — smallest, but blocked on one gate trace.
6. **Computer use** — largest and needs a safety pass; do last.

## Done in this project so far (for context)

Export/training-data, incognito chats, memory (+ save_memory chain rows +
settings tab + editing), local projects, publish screenshots, MCP connectors
in chat, artifact share tunnel (localtunnel), built-in whisper.cpp dictation,
the occlusion-throttling fix (stabilized artifacts), cache no-store on
upgrades, the native toggle/button styling on custom settings screens, and
the Docker code-execution sandbox (bash_code_execution chat tool + settings
toggle with live Docker/image status).

Also (2026-07-17, second pass): streaming dictation (partial transcripts
while recording); code-mode rewind/fork/context-meter/queue+steer (queue
persisted across restarts, resumed on session open); PDF/docx/xlsx/pptx
extraction (`src/main/local-extract.ts`, pdfjs bundled into main);
project knowledge-base uploads + Files card/instructions unlock
(`grant-local-project-edit-permissions`); publish-artifact modal fixed —
the kill-switched published-artifacts list query is enabled
(`enable-local-published-artifacts-query`) and `GET /published_artifacts`
is backed, so publishing flips the modal to "Artifact published" with the
link and a working Unpublish, surviving reloads (probe
`probe:publish-artifact`).
