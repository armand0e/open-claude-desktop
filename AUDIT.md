# Open-Claude repository audit

**Audit date:** 2026-08-03  
**Repository:** `C:\Users\aranr\Documents\claude-desktop-open-source`  
**Audit posture:** broad source, contract, lifecycle, security, persistence,
test, and packaging review. This is an audit of the current worktree, not a
claim of upstream Claude Desktop parity.

## Remediation outcome (2026-08-03)

The evidence and original verdict below describe the worktree before this
remediation pass. This table is the current disposition and supersedes older
“open” labels elsewhere in the historical finding text. No locally actionable
P0/P1 finding remains unresolved. External release identity and environment
matrices remain fail-closed instead of being relabeled as local successes.

| Finding                                         | Current disposition                          | End-to-end evidence                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-001 hosted renderer can start MCP children    | **Fixed**                                    | All three special MCP handlers require the local renderer; hosted-sender regression tests pass.                                                                                                                                                                                                                   |
| F-002 renderer/contract generation mismatch     | **Fixed**                                    | Renderer, reference root, generated contract, metadata, and package manifest are all pinned to `1.22209.0`; tree hashes and patch source are release-gated.                                                                                                                                                       |
| F-003 generic compatibility inference           | **Fixed**                                    | Compatibility behavior is generated as an exact 368-method/41-service policy; unknown services and methods fail closed.                                                                                                                                                                                           |
| F-004 brittle renderer patch manifest           | **Architecture fixed; 1.24012 port open**    | Stable patch intents now accept versioned anchors; candidate mode patches in memory and emits per-rule drift; promotion gates renderer, regenerated contract, and all patches. The latest retained 1.24012.9 report carries 32/124 (including one moved-chunk variant) and isolates the 92 remaining adaptations. |
| F-005 fake Claude provider transport            | **Fixed**                                    | The Claude preset uses Anthropic Messages, `x-api-key`, Anthropic versioning, native message/tool conversion, and native SSE translation; request, tool, thinking, and streaming fixtures pass.                                                                                                                   |
| F-006 stale release hashes/provenance/signature | **Locally fixed; signing identity external** | Attestation now binds commit, dirty state, artifact hashes, renderer/contract/patch hashes, and Authenticode. Fresh artifacts and hashes are produced below; verification intentionally remains red when the installer is unsigned or the worktree is dirty.                                                      |
| F-007 stop publishes before persistence         | **Fixed**                                    | Stop retries a transient store failure, emits `stopped` only after durable write, and emits `stop_persistence_failed` after persistent failure; both injected-fault tests pass.                                                                                                                                   |
| F-008 auto-port time-of-check/time-of-use race  | **Fixed**                                    | Launch detects a post-check `EADDRINUSE`, destroys the failed entry, selects a new port, and retries three times; a real competing child-process test passes.                                                                                                                                                     |
| F-009 diagnostics can leak user content         | **Fixed**                                    | Free-form strings, errors, paths, payloads, process output, commands, URLs, and renderer exceptions are reduced to bounded metadata/fingerprints; secret/path/error fixtures pass.                                                                                                                                |
| F-010 critical modules lack direct tests        | **Fixed for audited boundaries**             | Direct suites now cover child environments, runtime gates, bounded responses, skills, prompts, preview geometry/URLs, web-tool schema, tray lifecycle, diagnostics, compatibility policy, provider transport, publish/ZIP, and identity.                                                                          |
| F-011 incomplete lifecycle/fault matrix         | **Fixed for deterministic local lifecycle**  | Queue shutdown/recovery, stop-write faults, background cancellation/recovery, schedules, route audit, previews, browser, artifact, plugins, dictation, and packaged relaunch are release gates. OS power loss and unavailable platforms remain separate non-hermetic matrices.                                    |
| F-012 browser/sharing happy-path bias           | **Fixed locally; public relay external**     | Mixed DNS, rebinding, loopback/public policy, second-tab navigation, hidden-tab model screenshot, UI capture, close, relay false-success, rollback, and revoke tests pass. Public relay success still requires a reachable external relay.                                                                        |
| F-013 scheduler/platform clock edges            | **Fixed**                                    | Windows/Linux replacement policy and America/New_York DST spring-forward behavior are deterministic tests; a real scheduled Code run passes.                                                                                                                                                                      |
| F-014 formatting gate red                       | **Fixed**                                    | Prettier and the declared format gate are run after this ledger update.                                                                                                                                                                                                                                           |
| F-015 stale documentation                       | **Fixed**                                    | README, coverage, product boundary, local-mode, issue register, and this audit are synchronized to generated 1.22209 counts and current provider behavior.                                                                                                                                                        |
| F-016 packaged computer auto-consent            | **Fixed**                                    | The environment bypass was removed from runtime and probes; computer control always requires the native consent boundary.                                                                                                                                                                                         |
| F-017 preview host execution bypass             | **Fixed**                                    | `preview_start` is permission-gated and only permits an explicit development-runtime allowlist; shell interpreters are rejected.                                                                                                                                                                                  |
| F-018 ambient child-process environment         | **Fixed**                                    | Preview, Bash, PTY, MCP, plugins, web proxy, and dictation children receive an explicit OS-basics allowlist plus declared overrides, never ambient API keys/tokens.                                                                                                                                               |
| F-019 production dependency vulnerability       | **Fixed**                                    | The production dependency graph overrides the affected `brace-expansion`; `npm audit --omit=dev --audit-level=high` reports zero vulnerabilities.                                                                                                                                                                 |
| F-020 ASAR development/advisory baggage         | **Fixed**                                    | Package filters remove tests, fixtures, coverage, docs, source maps, and advisory files; both platform ASARs are inspected after build and fail on forbidden entries.                                                                                                                                             |
| F-021 arbitrary packaged profile override       | **Fixed**                                    | Development overrides remain available, while packaged overrides must be real descendants of the OS temporary directory; arbitrary/shared profile paths throw before startup.                                                                                                                                     |

During end-to-end execution the remediation gate itself exposed additional
defects: two missing npm-script aliases, probes coupled to 1.24012-only methods
and URL spellings, a model screenshot call missing its required `tabId`, and
inactive Browser tabs without a compositor surface. Those were fixed rather
than excluded from the matrix. Screenshot failures are now recorded in bounded
launch logs instead of returning an unexplained `null`.

### Current verification and artifacts

| Gate                        | Current result                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify`            | **Passed**: formatting, explicit compatibility policy, 42 test files / 256 tests, typecheck/build, renderer identity/patches, and the full source Electron workflow matrix.                                                          |
| Production dependency audit | **Passed**: zero vulnerabilities at high severity or above.                                                                                                                                                                          |
| Windows packaged matrix     | **Passed**: identity/boot, Chat, Code, background tasks, routes, Settings, Plugins, schedule execution, file preview, dev preview, Browser tabs/model screenshot, artifact toolbar, Moonshine, and dictation (14 gates, 210,524 ms). |
| Windows ASAR inspection     | **Passed**: 1,242 entries / 34,980,193 bytes; no test, docs, fixture, coverage, advisory, or source-map baggage.                                                                                                                     |
| Linux ASAR inspection       | **Passed**: 1,227 entries / 34,996,161 bytes; the same forbidden-content set is absent.                                                                                                                                              |
| AppImage smoke              | **Passed**: extraction, ELF identity, native PTY, native Moonshine, `AppRun`, and actual AppImage entry through `APPIMAGE_EXTRACT_AND_RUN=1`. Direct FUSE mounting is unavailable only because this WSL host lacks `libfuse.so.2`.   |
| Windows installer           | `release/Open-Claude-Setup-0.2.1.exe`, SHA-256 `8e80be06ebf8546e292510ec137ce979dec9e9a61e71709074481471947970b8`.                                                                                                                   |
| Linux AppImage              | `release/Open-Claude-0.2.1-x86_64.AppImage`, SHA-256 `5f49bfeb84c14024b81c187e4b131f7774d502e11f76699a09797610a772b425`.                                                                                                             |
| Release attestation         | **Correctly blocked**: provenance records the current dirty worktree, and Authenticode reports `NotSigned`. The gate will not label these artifacts publishable until a clean commit and signing identity exist.                     |

## Original executive verdict (pre-remediation)

Open-Claude is a substantial local-first Electron application with real Chat,
Code, tools, previews, browser controls, artifacts, plugins, MCP, scheduling,
dictation, persistence, and packaging implementations. The highest-risk
problems are at boundaries rather than in the happy-path managers:

1. **P1 security isolation:** the special `list-mcp-servers` and
   `connect-to-mcp-server` handlers trust every trusted hosted renderer, even
   though connecting starts a configured local child process and transfers a
   raw `MessagePort`. Generated IPC has a hosted-renderer service gate, but
   these special handlers do not.
2. **P1 contract drift:** the shipped retained renderer is explicitly
   `1.22209.0`, while the generated/preload contract is `1.24012.0`. Exact
   patch-count gates reduce the risk but cannot establish semantic
   compatibility.
3. **P1 compatibility breadth:** 270 methods across 38 services intentionally
   use generic compatibility behavior. Unknown services fail closed, but
   empty/false/null results can still be interpreted as real product state by
   a future renderer.
4. **P1 provider contract gap:** the `claude-code` preset points at
   `https://api.anthropic.com/v1`, while the only request implementation emits
   OpenAI-style `POST /chat/completions`, Bearer authentication, and OpenAI
   message/tool shapes. There is no separate Anthropic Messages adapter or
   endpoint-contract test.
5. **P0 release integrity:** the current EXE and AppImage hashes do not match
   `release/SHA256SUMS.txt`; `npm run release:attest` currently fails on that
   mismatch before signature and clean-worktree checks. The provenance file
   also records a dirty build.
6. **P2 verification gaps:** unit tests and typecheck are green, but format
   check is not; direct tests and process-level fault/restart coverage are
   missing for several critical managers. Browser, scheduler, OAuth, sharing,
   and upgrade matrices remain mostly happy-path or externally blocked.
7. **P2 diagnostics privacy:** the new durable debug log deliberately omits
   normal prompt/content fields, but `Error.message`, `Error.stack`, renderer
   exception payloads, and free-form `message` keys are not redacted. A
   support bundle can therefore contain user text or paths despite the
   “safe to share” intent in the diagnostics comments.
8. **P1 execution gates:** `CLAUDE_LOCAL_COMPUTER_AUTOCONSENT=1` bypasses the
   native computer-use dialog even in a packaged runtime, and `preview_start`
   launches a host `runtimeExecutable` without the normal Code permission
   decision. Both paths inherit the parent process environment.
9. **P2 shipped dependency/package hygiene:** the production ASAR includes
   the high `brace-expansion` audit finding plus test/coverage/advisory files;
   the build-only `fast-uri` and `tar` findings remain unresolved as well.

The result is **not release-ready without the P0/P1 items above**. It is a
credible local development harness when run with a known renderer snapshot,
local provider, and the tested Windows paths, but it should not imply full
native Claude Desktop feature parity or verified release provenance.

## Scope and method

### Inventory

- `git ls-files`: **549 tracked files**.
- Audit-scope inventory (`rg --files`) excluding `node_modules`, `dist`,
  `dist-electron`, and `release`: **561 files**. This includes tracked files,
  generated inputs, and current untracked diagnostic/test/tool files.
- Top-level audit scope: 8 root files, 9 analysis files, 336 asset/reference
  files, 9 docs, 37 tests, 64 tools, and 54 `src` files.
- `src`: 35 main-process files, 4 preload files, 10 shared files, 3 generated
  contract files, and 2 renderer entry/style files.
- The retained vendor snapshot under `.package-assets/ion-dist` and the
  reference screenshots/assets were inventoried by path, extension, size, and
  their use in the packaging/patch pipeline. Binary media was not treated as
  executable source; minified vendor JavaScript was traced through the patch
  table and runtime probes rather than manually pretending it was maintainable
  application source.
- A second, deeper inventory included ignored/generated/package material:
  `rg --files -uu -g '!.git/**' -g '!node_modules/.cache/**'` reports
  **32,698 files**. The top-level counts are `.package-assets` 1,502,
  `analysis` 1,152, `assets` 390, `dist*` 9, `docs` 9, `node_modules` 21,172,
  `reference` 6,144, `release` 2,130, `src` 54, `tests` 37, and `tools` 64.
  This exposed package/runtime material that the first pass had intentionally
  treated only as build evidence.
- `node_modules`, generated `dist*`, and existing `release` binaries were
  inspected for dependency lineage, shipped-file contents, packaging role,
  and smoke/attestation evidence. Binary payloads were checked by path,
  size, hash/manifest role, and package inclusion; they were not falsely
  represented as line-audited authored source.

### Deep artifact and dependency pass

- `package-lock.json` is lockfile v3 with 589 package entries (47 production,
  530 development, 89 optional, and 13 peer packages in the audit metadata).
  `npm audit --omit=dev --audit-level=moderate` reports a high
  `brace-expansion` vulnerability in the production dependency graph;
  full `npm audit` adds high `fast-uri` and moderate `tar` findings in the
  build graph.
- The production path is concrete, not merely a lockfile false positive:
  `src/main/local-search-proxy.cjs` loads `playwright-extra` and
  `puppeteer-extra-plugin-stealth`, whose user-data-dir cleanup reaches
  `rimraf -> glob -> minimatch -> brace-expansion@1.1.16`.
  `release/win-unpacked/resources/app.asar` contains that package and its
  vulnerable implementation.
- The unpacked Windows ASAR contains **1,287 entries**, including the
  production dependency's `.tap` coverage/processinfo files, an
  `ADVISORY-CVE-2026-14257.md`, 22 test-like files, and 30 source maps.
  This is packaging hygiene/bloat and metadata disclosure evidence; it is
  separate from the runtime vulnerability itself.
- The four retained/reference renderer generations, generated contracts,
  `dist*`, `.package-assets`, release payloads, and ignored dependencies were
  compared by role. They remain one release graph only when the exact
  renderer hash, patch table, generated contract, package metadata, and
  artifact provenance are rebuilt together; a successful TypeScript build
  does not establish that relationship.

### Evidence used

- Read the root README/package/build configuration, all authored source and
  tests in the audit scope, the generated contract/coverage reports, docs,
  tools, and the existing `ISSUES.md` register.
- Traced imports and runtime construction from Electron startup through
  preload, protocol handling, local HTTP APIs, IPC dispatch, persistence,
  provider streams, tools, child processes, and packaging.
- Current checks run during this audit:
  - `npm test`: **37 files, 232 tests passed**.
  - `npm run typecheck`: **passed**.
  - `npm run build`: **passed**.
  - `npm run format:check`: **failed** on
    `tests/local-code-background-tasks.test.ts`.
  - `npm run release:attest`: **failed** with checksum mismatch for the
    current Windows installer.
- The prior `ISSUES.md` is useful historical evidence but is dated 2026-07-22,
  claims 221 tests, and is therefore explicitly not treated as current truth
  where this audit has newer results.

## System map

### Process and request flow

```text
Electron main
  ├─ single-instance/deep-link/startup policy
  ├─ StateStore (atomic user profile)
  ├─ LocalBackend (Chat, artifacts, files, memory, provider, remote MCP)
  ├─ LocalCodeSessionManager (Code sessions, queue, tools, PTY, tasks)
  ├─ LocalLaunchPreview (managed servers, browser tabs, screenshots)
  ├─ LocalBrowserUse / LocalComputerUse / LocalSandbox
  ├─ LocalMcpManager / LocalMcpOAuth / LocalMcpPortBridge
  ├─ LocalPluginManager / LocalScheduledTasks / LocalTray
  ├─ LocalDiagnostics and export/handoff helpers
  ├─ ServiceDispatcher + generated IPC validation
  └─ BrowserWindow / WebContentsView creation and navigation policy
       │
       ├─ preload-shell.cjs: narrow shell/window bridge
       └─ preload-main-view.cjs: retained renderer API + local workbench hooks
              │
              └─ retained vendor renderer (staged ion-dist, exact patches)
                     │
                     ├─ app://localhost local UI protocol
                     ├─ local HTTP-compatible `/api/*` routes
                     ├─ generated `$eipc_*` IPC channels
                     └─ native views for browser/preview/artifact surfaces
```

### Startup and mode selection

`src/main/index.ts` owns startup. It registers the privileged `app`,
`claude-local-preview`, and `claude-local-launch` schemes, acquires the
single-instance lock, installs deep-link handling, creates diagnostics after
`app.whenReady()`, restores `StateStore`, and chooses the UI target:

- Local mode is selected by `CLAUDE_DESKTOP_LOCAL_UI=1`, or by default when
  `CLAUDE_DESKTOP_URL` is absent.
- Hosted mode is selected by `CLAUDE_DESKTOP_URL` after origin validation.
- Local mode requires a staged `ion-dist` renderer; missing assets fail startup.
- Development HTTP origins are allowed only for localhost/127.0.0.1 or
  `.ant.dev`, and only when unpackaged or explicitly enabled.
- The local backend, Code manager, previews, plugins, scheduler, MCP, sandbox,
  browser, computer, and diagnostics are constructed before IPC registration
  and the main window is shown.

### Local UI and HTTP compatibility layer

`src/main/local-ui.ts` serves the retained renderer from the `app://localhost`
protocol. It:

- constrains asset paths with decoded path containment and canonical regular
  file checks;
- applies exact vendor patches before serving JavaScript;
- uses `Cache-Control: no-store`, `nosniff`, CSP, and `frame-ancestors 'self'`;
- exposes local API routes through `localApiResponse` and then delegates to
  `LocalBackend.handle` and Code routes;
- returns explicit JSON 503/410/unavailable responses for unsupported hosted
  APIs instead of falling through to cloud calls;
- serves a separate `artifacts.local` sandbox with no network `connect-src`.

The local HTTP layer is an emulation boundary, not a general-purpose server:
it accepts requests from the local app origin and rejects non-local `Origin`
headers. The service layer is still reachable through IPC, so the protocol
and IPC gates must be reviewed together.

### Preload and IPC

`src/preload/main-view.ts` exposes the recovered desktop API and forwards
generated channels. `src/preload/local-workbench.ts` adds local Chat/Code,
dictation, browser/preview, artifact, settings, plugin, scheduler, and
diagnostic glue. `src/preload/shell.ts` handles the minimal shell bridge.

`src/main/ipc.ts` performs:

- parent-frame rejection;
- trusted-origin checks (`app://localhost`, approved Claude origins, and
  bounded development origins);
- local-only checks for explicitly local handlers;
- hosted-renderer rejection for all generated services except a small title
  bar/navigation/window-control allowlist;
- recovered argument and result validation for generated contract entries;
- shaped diagnostics and optional capability/code traces.

The special IPC handlers in `src/main/index.ts` are a separate policy surface
and do not automatically receive the generated service gate; see F-001.

### Persistence graph

Under Electron `app.getPath("userData")`:

| Store/path                   | Owner                     | Contents and protection                                                                                                              |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `claude-local-desktop.json`  | `StateStore`              | app config, preferences, menus, bootstrap, active servers; bounded, normalized, quarantines corrupt files, atomic `0600` replacement |
| `local-backend.json`         | `LocalBackend`            | provider config, encrypted API key envelope, conversations, artifacts, project/memory state; bounded recovery and atomic replacement |
| `local-files/`               | `LocalBackend`            | uploaded/local file blobs; safe names, bounded sizes, reconciliation against metadata                                                |
| `local-code-sessions.json`   | `LocalCodeSessionManager` | sessions, transcript, queued prompts, permissions, background task state; bounded normalization and atomic replacement               |
| `local-scheduled-tasks.json` | scheduler                 | routines, run state, missed-run information; recoverable bounded JSON                                                                |
| `local-mcp-oauth.json`       | OAuth manager             | safeStorage-encrypted tokens and connector state; fails closed when encryption is unavailable                                        |
| `plugins/`                   | plugin manager            | installed plugin staging, manifests, enable state, skill/MCP files; canonical path checks and archive validation                     |
| `sandbox/`                   | sandbox manager           | Docker/workspace state and uploads; per-conversation roots and bounded files                                                         |
| `logs/diagnostics.jsonl`     | diagnostics               | append-only control-flow events, 32 MiB rotation, local log permissions depend on OS profile                                         |

Writes generally use a temporary file followed by rename and serialize through
per-manager chains. The remaining uncertainty is forced termination, disk-full
and antivirus-lock behavior during every write, not the normal atomic path.

## Gates and trust boundaries

| Boundary            | Current gate                                                                                             | Residual concern                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Process startup     | single-instance lock, mode/origin validation, missing local UI fails startup                             | uncaught exception handler records but does not terminate/restart the potentially corrupted process                                          |
| Renderer navigation | trusted remote origins, `app://localhost`, external URL shell handoff, window-open allowlist             | hosted trusted content is still a high-value renderer principal; local capability exceptions must be local-only                              |
| Generated IPC       | sender/frame check, host-service allowlist, argument/result validation                                   | special handlers bypass the host-service allowlist; compatibility results still encode state by convention                                   |
| Local app protocol  | `app://localhost`, origin check, path canonicalization, CSP/no-store                                     | `local-ui` is a very large router with limited direct unit coverage                                                                          |
| Provider URL        | HTTP(S), no credentials/query/fragment, bounded URL/model/key/context                                    | no SSRF classification for arbitrary provider endpoints; this is intentional for local/custom providers but must be explicit in threat model |
| Provider stream     | bounded request/response/stream bytes, abort signal, context retry/compaction                            | endpoint/message-shape matrix is incomplete; provider-specific auth and SSE variants are unproven                                            |
| Code workspace      | canonical roots, path containment, symlink checks, bounded reads/writes, permission modes                | process restart and workspace replacement races need more fault tests                                                                        |
| Shell/PTY           | finite foreground shell tool, managed preview for resident servers, PTY process tracking                 | external command behavior and child-tree cleanup remain OS-specific                                                                          |
| Browser             | public HTTPS/loopback resolver, credential rejection, private-address/DNS checks, per-tab session policy | redirects, rebinding, downloads, cookies, crashes, and permissions are not end-to-end covered                                                |
| Preview/dev server  | `.open-claude/launch.json`, workspace-contained cwd/program, loopback readiness, managed process         | availability check is inherently TOCTOU against other processes; fixed-port contention across different configs can still race               |
| Computer use        | Windows-only implementation, per-conversation native consent, bounded input helpers                      | Linux is intentionally unsupported; native dialog and cancellation need packaged tests                                                       |
| MCP stdio bridge    | configured name, command/arg/env bounds, message/queue byte limits, child teardown                       | trusted hosted renderer can invoke this bridge through special IPC (F-001)                                                                   |
| OAuth               | safeStorage requirement, callback/origin handling, bounded token state                                   | external browser round trip and restart/revocation matrix is not proven                                                                      |
| Plugins/skills      | archive manifest/path checks, staging/backup, enabled state, skill content bounds                        | retained renderer uses exact minified patches and DOM surgery; version drift can hide or duplicate capabilities                              |
| Scheduler           | bounded persistent task state, explicit recovery of unfinished work                                      | DST, sleep/wake, clock changes, duplicate execution and crash resumption unproven                                                            |
| Sharing/tunnel      | publish verifies relay response and rolls back/revokes on failure                                        | external successful reachability and revocation are network-blocked in this environment                                                      |
| Packaging           | typecheck/build, client patch tests, electron-builder/AppImage scripts, attestation tool                 | current hashes are stale, installer is unsigned, worktree is dirty, and AppImage native execution requires FUSE on this host                 |

## Component-by-component assessment

### Chat and LocalBackend

**Implemented:** OpenAI-compatible streaming, thinking-tag parsing, context
compaction, tool schemas, artifacts, memory, files, web tools, browser and
computer gates, MCP tools, provider presets, conversation persistence, bounded
SSE/body/request sizes, and active-completion abort barriers. The current test
suite covers normal text, reasoning, artifacts, tool loops, attachments,
retry/compaction, connectors, and cancellation-adjacent behavior.

**Edge cases still open:** provider-specific non-streaming responses, split SSE
frames across all delimiters, malformed/partial tool JSON, auth expiry, slow
streams that ignore abort, context limits at multiple tokenizer families,
provider retries after a 4xx fallback, and concurrent edit/retry/send against a
conversation. A `claude-code` preset is not a native Claude Code session; it
is currently just a label over the OpenAI-compatible transport.

### Code sessions, queue, steering, and stop

**Implemented:** durable queued prompts, steering inbox, reorder/promote/cancel,
session serialization, restart recovery to stopped state, permission waits,
background task pool, PTY, tool contracts, transcript streaming/replay,
compaction, stop barriers, and immediate stopped-state publication. Current
tests cover four queue behaviors, cancellation, rewind, background concurrency,
provider output limits, tool loops, permissions, browser/preview, and session
recovery.

**Edge cases:** a stop emits terminal state before the persistence commit. If
the subsequent write fails, the caller sees an error after the renderer has
already received `stopped` and `session_updated`; the rollback restores queue
memory but cannot retract those UI events. Background cleanup is intentionally
detached from the user-facing stop operation, so late child/process failures
must be found in diagnostics. Forced process termination during a queue drain,
permission dialog, hook, MCP call, or PTY write remains unproven.

### Tools, workspaces, and sandbox

**Implemented:** canonical workspace roots, symlink/TOCTOU checks, bounded text
and binary files, managed finite shell commands, interactive PTY, Docker status
and build truthfulness, uploads, artifacts, plugin hooks, and explicit
permission modes.

**Edge cases:** disk-full/locked-file writes, executable replacement between
validation and spawn, shell command output truncation at multibyte boundaries,
child-tree teardown after hard kill, Docker daemon disappearance mid-run, and
workspace roots deleted or replaced while a tool is waiting.

### Preview and dev-server lifecycle

**Implemented:** launch configuration is read only from a canonical workspace
`.open-claude/launch.json`; program/cwd stay inside that workspace; auto-port,
PORT injection, readiness probing across IPv4/IPv6 loopback, process logs,
restart-on-config-change, tabs, screenshots, DOM inspection, and managed stop
are present. Focused launch tests cover coalescing, restart, auto-port, IPv6,
and commands that ignore `PORT`.

**Edge cases:** `isPortAvailable()` followed by spawn is a TOCTOU check, and
the second in-memory check cannot see another process that wins the port
between the check and child bind. A server that binds a non-loopback interface
is intentionally not adopted, but the user-facing error should clearly
distinguish “ignored public bind” from “did not start.” Readiness treats any
HTTP response as success and does not test redirect/auth/error pages as product
states.

### Browser and web tools

**Implemented:** separate browser session, loopback/public URL policy, DNS
private-address rejection, credential rejection, public HTTPS checks, tab
navigation/back/forward/refresh, snapshots, console logs, UI/model screenshots,
DOM inspect, and artifact element selection.

**Missing proof:** redirect chains, public DNS rebinding, cookie persistence and
clearing, downloads, popup/window policy, renderer crash/reload, permission
prompts, blocked private subresources, profile restart, and Chat's browser
controller (which is a different implementation from Code's embedded browser).

### MCP and OAuth

**Implemented:** local stdio JSON-RPC, streamable HTTP remote servers, OAuth
presets/callbacks, safeStorage token sealing, tool discovery, bounded messages,
plugin MCP contributions, and renderer MessagePort bridging.

**High-risk boundary:** `list-mcp-servers` and `connect-to-mcp-server` use only
`assertTrustedIpcSender`. Since trusted remote origins are accepted by that
function, a hosted renderer can request configured server names and cause the
main process to spawn the configured command and transfer a port. The bridge
does validate names/config shapes, but that is not an origin/capability gate.

**Missing proof:** OAuth browser round trip, token restart/decryption failure,
remote timeout/auth refresh, server disconnect/reconnect, plugin update and
rollback, duplicate server/skill names, and cancellation while a tool call is
waiting.

### Plugins, skills, and hooks

**Implemented:** safe archive extraction, manifest validation, staging/backup,
enable/disable/delete, local and plugin-owned skills, slash invocation, tool
loading, MCP declarations, and hook feedback for session/prompt/tool/stop
events.

**Risk:** much of the retained renderer behavior is exact-string minified
patching plus DOM intervention. A patch can still match its expected count and
silently target the wrong component after a vendor rebuild. The current probes
test the staged version, not an upgrade or a different renderer generation.

### Scheduler/routines

The scheduler has persistent task state, bounded records, a tray/navigation
surface, run/cancel APIs, and Code integration. It intentionally recovers
unfinished work rather than claiming it ran. It lacks a demonstrated matrix for
timezone/DST transitions, sleep/wake, clock rollback/forward, duplicate
execution, shutdown during a run, and process restart while a child provider
call is active.

### Dictation/computer/tray

Moonshine replaced the former batch Whisper path and has native fixture and
Electron probe coverage. Computer use is Windows-only, consent-first, and
bounded; Linux explicitly declines input. Tray and global shortcut restoration
are implemented but have no full cross-platform test matrix. Microphone device
loss, native dialog cancellation, DPI/layout changes, and startup shortcut
collisions remain ordinary user-facing edge cases.

### Sharing, export, and diagnostics

Export and handoff ZIP paths have bounded content and dedicated unit tests.
Publishing now verifies the local/relay result and rolls back on failure, but a
successful external relay fetch plus unpublish propagation is blocked by the
network in this environment.

Diagnostics are append-only, serialized, rotated, and intentionally exclude
stream deltas and normal request bodies. They are very useful for ordering
events such as `code.message.queued`, `session.stop.requested`, provider
request/response, tool begin/end, preview spawn/exit, and IPC duration. The
redaction implementation is key-based; `diagnosticError()` returns raw message
and stack strings and `sanitizeDiagnosticValue()` treats `Error` as already
sanitized. Renderer exception payloads are recorded under a non-secret
`payload` key. This is a privacy gap in a support artifact, not a reason to
remove debug logging: add message/stack/path scrubbing and a tested allowlist
of diagnostic fields.

## Findings

Severity uses the repository's convention: P0 release integrity/data loss or
unsafe false success; P1 core workflow/security/ship-blocking; P2 meaningful
partial behavior or missing boundary proof; P3 documentation/maintenance.

### F-001 — Hosted trusted renderer can start local MCP children (P1 security)

**Evidence:** `src/main/index.ts:702-712` calls
`assertTrustedIpcSender(event)` for `list-mcp-servers` and
`connect-to-mcp-server`; `src/main/ipc.ts:115-143` treats the approved Claude
remote origins as trusted; generated IPC additionally calls
`assertServiceAvailableToSender`, but these special handlers do not. The
connect path calls `LocalMcpPortBridge.connect`, which validates a configured
command and spawns it (`src/main/local-mcp-bridge.ts:49-103`) before transferring
a `MessagePort`.

**Impact:** a trusted hosted page, compromised hosted content, or XSS in an
approved remote origin can enumerate configured local MCP names and request
local process/port access. This crosses the local/hosted trust boundary.

**Fix:** make both handlers use `assertLocalIpcSender`, or add a narrowly scoped
capability token issued only to the local Connectors surface. Add a regression
test for every approved remote origin, development origin, child frame, local
origin, and destroyed sender.

### F-002 — Renderer and generated contract are different reference generations (P1)

`package.json:214-215` records renderer `1.22209.0` and contract
`1.24012.0`. `analysis/implementation-coverage.json` reports 879 channels, 74
services, 779 generated validations, and 554 validated results. Exact patch
counts are necessary, but matching a minified string does not verify event
ordering, store shape, feature flags, or route semantics.

**Fix:** freeze the complete contract to the retained renderer or migrate the
renderer as an explicit versioned port. Make the package gate fail if renderer,
generated contract, patch table, and coverage metadata disagree.

### F-003 — Generic compatibility fallback is still a product-state risk (P1)

`analysis/implementation-coverage.json` counts 38 explicit compatibility
services and 270 methods. `src/main/services.ts:550-588` maps method name
patterns to empty arrays, false, null, or unavailable errors. This is better
than an unbounded default and unknown services fail closed, but the renderer
can still interpret a syntactically valid empty/false result as “loaded,”
“no data,” or “success.”

**Fix:** return a typed `{available:false, reason}` envelope where the retained
contract allows it; otherwise maintain a machine-readable per-method policy
and add a test for every compatibility method's intended UI interpretation.

### F-004 — Exact minified renderer patches are version-sensitive (P1)

`src/main/client-patches.ts` and the local workbench use exact source fragments,
hashes/counts, selectors, and DOM surgery. A patch gate proves the expected
vendor snapshot, not future vendor compatibility. The plugin/skills surface is
especially exposed because visibility, cache, route, and mutation behavior are
patched in several places.

**Remediation:** renderer changes now use stable patch-intent IDs with labeled
version variants, a non-destructive compatibility analyzer, development-only
partial candidate launches, a machine-readable per-rule report, and an atomic
promotion command. Normal runtime and packaging remain fail-closed. Promotion
requires the canonical retained renderer, its contract tree, regenerated
contract metadata for the same version, and zero unresolved patches; it rolls
the pins and staging area back if strict verification fails.

The retained `1.24012.9` candidate currently carries 32 of 124 rules (31
unchanged and one moved-chunk variant) and reports 92 unresolved rules. That is an explicit incomplete port,
not a claimed upgrade. The report is
`analysis/renderer-migrations/1.22209.0-to-1.24012.9.json`; the operating
procedure is `docs/renderer-upgrades.md`.

### F-005 — `claude-code` preset has no native Anthropic transport (P1)

`src/main/local-backend.ts:394-410` labels the preset “Claude Code API key,”
uses `https://api.anthropic.com/v1`, and says it is OpenAI-compatible. The only
request path (`:3906-3990`) posts to `${baseUrl}/chat/completions` with Bearer
auth, OpenAI `messages`, `tools`, and SSE parsing. No Anthropic Messages
adapter, required Anthropic headers, or provider-specific contract test exists.

**Impact:** selecting this preset can fail at runtime or silently mis-handle
tools/content even though the Settings UI presents it as supported.

**Fix:** either make this preset explicitly “Anthropic-compatible proxy” and
require a proxy URL, or implement/test the Anthropic Messages API separately.
Do not call it Claude Code OAuth; the code correctly notes that a subscription
login is not used, but the transport must also be truthful.

### F-006 — Release hashes/provenance do not describe current artifacts (P0)

Current file hashes are:

```text
Open-Claude-Setup-0.2.1.exe       0C8FFED23E053E8FE0F482D952854BF3E191574B1FDD3FE784127F2357839BA9
Open-Claude-0.2.1-x86_64.AppImage 98A19914DF510161F2E92A9C607A8A3712F344A74A29B87FC0DF5228CD2FDE16
```

`release/SHA256SUMS.txt` contains different hashes, and
`npm run release:attest` fails with `Checksum mismatch for
Open-Claude-Setup-0.2.1.exe`. `release/build-provenance.json` records an older
build and `dirty:true`; the attestation script also requires a valid Windows
signature and a clean worktree.

**Fix:** build from a clean commit, generate checksums/provenance from those
exact bytes, sign the Windows installer, verify on a clean profile/machine,
and publish the matching checksum file. Do not attach the current binaries to
a release until the gate passes.

### F-007 — Stop publishes terminal UI before persistence success (P2)

`LocalCodeSessionManager.stopSession` aborts controllers, emits `stopped`,
`transcript_loaded`, and `session_updated`, then awaits `persist()`.
On persistence failure it rolls back in-memory queued state but cannot retract
the already emitted terminal events. This is a plausible source of confusing
“Stopping”/stopped state followed by an IPC error or a later queue replay.

**Fix:** persist a stop intent/state before terminal publication, or emit an
explicit `stop_persist_failed` recovery event and make the renderer re-fetch
authoritative session state. Add injected write-failure tests.

### F-008 — Preview port allocation remains TOCTOU-prone (P2)

`LocalLaunchPreview` checks `isPortAvailable`, optionally allocates an unused
port, checks again, then spawns the process with `PORT`. The in-memory duplicate
check cannot see another process outside this manager binding the port between
the final check and child startup.

**Fix:** treat bind/readiness as the authority, capture `EADDRINUSE`/child
exit distinctly, and retry auto-port allocation on bind collision. Add two
different configured services racing for one port and a server that binds only
after a delay.

### F-009 — Diagnostics redaction misses free-form error/user content (P2 privacy)

`src/main/local-diagnostics.ts:7-10,70-96` redacts keys matching
`prompt|content|body|token|...`, but `diagnosticError` returns raw `message` and
`stack`, and `Error` values bypass recursive key sanitization. The renderer
exception IPC records arbitrary `payload` under a non-secret key
(`src/main/index.ts` around the `open-claude-diagnostic-renderer` handler).

**Fix:** sanitize error messages/stacks and renderer payloads by default,
record only bounded type/length/URL/field metadata, add explicit opt-in local
verbose mode for raw diagnostics, and test prompt text in an Error message,
stack, payload, and nested `message` field.

### F-010 — Critical orchestration modules lack direct tests (P2)

There are no direct unit suites for important portions of `local-ui`,
`local-file-preview`, `local-web-tools`, `local-moonshine`, `local-tray`,
`ipc`, `index`, `builtin-skills`, `bounded-response`, and `runtime-prompt`.
Indirect Electron probes are valuable but do not isolate protocol/path/error
branches. A green 232-test suite therefore does not mean those modules are
covered.

**Fix:** add deterministic unit/contract tests for each router and security
helper, then retain a smaller process/renderer suite for integration.

### F-011 — Process-restart/fault matrix is incomplete (P2)

Current recovery tests normalize corrupt state and stop unfinished sessions;
many UI probes reload a renderer rather than terminate/relaunch Electron with
the same profile. Missing cases include forced kill during atomic writes,
plugin install/toggle, OAuth callback, tunnel startup, browser tabs/cookies,
scheduler runs, provider-token decryption, MCP calls, PTY teardown, and Docker
cleanup.

**Fix:** create a profile-driven lifecycle harness that can kill the main
process at named checkpoints, relaunch, and assert durable state plus owned
child-process cleanup.

### F-012 — Browser and public sharing are not externally complete (P2)

Browser code has strong URL gates and localhost tests, but no release matrix
for public redirects/downloads/cookies/crashes/rebinding/popups/permissions.
Publishing has rollback logic, but the required successful external relay fetch
and unpublish/revocation proof was blocked by a relay 502 in the available
environment.

**Fix:** use a deterministic local HTTPS/DNS test server for browser security
cases and a controllable relay fixture for publish/revoke/restart cases; keep
the real relay probe as a separate network-dependent gate.

### F-013 — Scheduler and OS integration edge cases are unbounded (P2)

Global shortcuts, startup-on-login, tray, microphone, computer consent,
safeStorage, native dialogs, DST/sleep/clock changes, and platform child
cleanup have only partial or platform-specific proof. Computer use correctly
fails closed on non-Windows, but that is an availability boundary the UI must
surface consistently.

**Fix:** add Windows fixture tests for native dialogs/shortcuts and a fake clock
plus timezone/sleep harness for scheduler behavior; add explicit Linux/macOS
unsupported-state assertions.

### F-014 — Format gate is currently red (P2 release hygiene)

`npm run format:check` reports
`tests/local-code-background-tasks.test.ts`. This may be an unrelated dirty
worktree edit, so it was not rewritten during the audit, but the repository's
declared `verify` command cannot be green until the owner formats or reverts
that file.

### F-015 — Documentation and issue register need a current-state refresh (P3)

`ISSUES.md` is dated 2026-07-22 and says 221 tests; the current suite is 232.
Some statuses in that register are historical claims and some remain open.
Generated coverage currently reports 879 channels / 74 services, which should
be the only source for counts in release documentation.

**Fix:** generate the issue/coverage summary from the current build and test
run, record environment-blocked probes separately, and include artifact hashes
and renderer/contract identities in every release report.

### F-016 — Computer-use consent has a packaged environment bypass (P1 security)

`src/main/index.ts:1248-1251` returns `true` from the native computer-use
consent callback whenever `CLAUDE_LOCAL_COMPUTER_AUTOCONSENT=1`. The check is
not restricted to tests, development builds, a signed probe executable, or an
explicit per-profile setting; it runs before the normal warning dialog even
when `app.isPackaged` is true.

**Impact:** an inherited environment variable, launcher configuration, or
copied troubleshooting command can make a model's screen capture, mouse, and
keyboard actions execute without the user-facing consent gate. This is a
control-plane bypass, not merely a test convenience.

**Fix:** remove the environment bypass from production code, or require an
unforgeable test capability supplied only by a dedicated probe build and
assert `!app.isPackaged`. Add a packaged regression that proves the dialog is
still required when the variable is present.

### F-017 — `preview_start` launches host executables without the normal permission gate (P1)

`LocalCodeSessionManager.permissionRequired()` only marks `Write`, `Edit`,
`Bash`, artifacts, and MCP calls as permission-bearing. `preview_start` is not
in that set (`src/main/local-code.ts:5296-5316`), yet its handler calls
`LocalLaunchPreview.startFromConfig` (`:5486-5503`), which executes
`crossSpawn(selected.command, launchArgs, { shell: false })` on the host
(`src/main/local-launch-preview.ts:2954-2965`). A model can write
`.open-claude/launch.json` and invoke this path in the default permission mode.
`runtimeExecutable` is allowed to be an arbitrary executable name/path; only a
workspace `program` is contained.

**Impact:** a managed-preview affordance becomes an unprompted host-process
launcher. It can run PowerShell, package managers, or other executables and
can read/write anything available to the inherited process account. This also
explains why a preview can appear to “work” while bypassing the same approval
semantics expected of a normal Code command.

**Fix:** either require the same permission decision as `Bash` for
`preview_start`, or constrain it to a small, explicit runtime allowlist and a
user-approved workspace command. Add tests for default/accept-edits/don't-ask/
bypass modes and for arbitrary `runtimeExecutable`/environment values.

### F-018 — Host child processes inherit the entire app environment (P1/P2 secret exposure)

The managed preview child merges `...process.env` with launch-config `env`
(`src/main/local-launch-preview.ts:2954-2963`), and the local MCP bridge does
the same (`src/main/local-mcp-bridge.ts:98-101`). The finite Code shell also
inherits the shell's environment through `exec` (`src/main/local-code.ts:937-987`).
That environment can contain `CLAUDE_LOCAL_API_KEY`, provider keys, cloud
credentials, CI tokens, or unrelated secrets supplied by the launcher.

**Impact:** any workspace code started by a preview, MCP command, or model
shell can print or forward those values. The preview path is especially
concerning because F-017 lets it run without a tool-approval prompt. This is
an environment-isolation failure even when the user intentionally configured
the executable.

**Fix:** construct an allowlisted child environment (safe locale/path/temp
variables plus explicit per-tool values), never copy provider/credential
variables by default, and add tests that seed sentinel secrets in the parent
environment and assert they are absent from preview/MCP/shell children.

### F-019 — High production dependency vulnerability is shipped in the ASAR (P2 supply chain)

`npm audit --omit=dev --audit-level=moderate` fails on high
`brace-expansion` versions `1.1.16`/the affected ranges. `npm explain`
shows the production chain
`puppeteer-extra-plugin-stealth -> puppeteer-extra-plugin-user-preferences ->
puppeteer-extra-plugin-user-data-dir -> rimraf@3 -> glob@7 -> minimatch@3 ->
brace-expansion@1.1.16`; the exact package is present in the shipped Windows
`app.asar`. The advisory describes unbounded expansion length and a small
brace pattern capable of exhausting the Node process.

**Impact:** a vulnerable runtime dependency is delivered to users. The
reachable exploit surface appears narrower than a general-purpose user glob
because the current proxy supplies fixed profile paths, but the package is
still loaded by production web tooling and remains a supply-chain/runtime DoS
risk.

**Fix:** upgrade or replace the dependency chain, verify the resolved tree with
`npm audit --omit=dev`, and add a packaging gate that rejects affected
versions before ASAR creation. Do not rely on the source `Glob` tool's own
`rg` implementation as proof that the transitive package is unreachable.

### F-020 — Production ASAR contains test/coverage/advisory baggage (P2 packaging)

`release/win-unpacked/resources/app.asar` contains 1,287 entries and ships
`node_modules/brace-expansion/.tap/coverage/*`, `.tap/processinfo/*`,
`ADVISORY-CVE-2026-14257.md`, 22 test-like files (including Puppeteer stealth
tests), and 30 source maps. The package configuration includes production
dependencies through Electron Builder's automatic dependency collection but
does not apply a production-file allowlist for these packages.

**Impact:** unnecessary install size, slower scanning/startup, disclosure of
test run identifiers and advisory metadata, and a weaker signal about what is
actually executable in the release. It also makes post-build vulnerability
review harder because dev/test material is indistinguishable from runtime
payload.

**Fix:** prune test, coverage, advisory, and source-map files from production
dependencies (or use explicit package filters), then inspect both Windows and
Linux ASARs in CI. Keep source maps in a separately permissioned diagnostics
artifact only when support requires them.

### F-021 — Profile override can defeat the app-identity separation (P2 isolation)

`src/shared/app-identity.ts:15-27` accepts `OPEN_CLAUDE_USER_DATA_DIR` and the
legacy `CLAUDE_LOCAL_USER_DATA_DIR` without a packaged-build guard or
containment check, and `src/main/index.ts:79-91` applies the resolved path to
`userData`, `sessionData`, cache, crash dumps, and logs. The test suite
explicitly accepts an arbitrary override (`tests/app-identity.test.ts:35`).

**Impact:** a copied environment setting can point Open-Claude at another
product's Electron profile or a shared/network path, causing state/cache/log
collisions and making the documented “cannot attach to Anthropic's profile”
separation false in that launch. This is a startup isolation footgun rather
than a remote exploit, but it can corrupt a profile before the user notices.

**Fix:** keep overrides behind an explicit development/test capability, or
require a dedicated child directory under the Open-Claude app-data root in
packaged builds. Emit a loud startup diagnostic when an override is active and
add cross-profile collision tests.

## Prior issue-register crosswalk (pre-remediation snapshot)

The existing `ISSUES.md` has 32 numbered entries. The table below prevents
those findings from disappearing into a new report. It records the audit's
original status before the fixes in the remediation table at the top of this
file; it is retained as change evidence rather than current release state.

|                        Register item | Pre-remediation status                                                                                                                                                                 |
| -----------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|                1 checksums/signature | **Open P0** — current hashes disagree with `SHA256SUMS.txt`; signature/clean-worktree checks are still required.                                                                       |
|            2 mixed renderer/contract | **Open P1** — contained by patch gates, not semantically solved.                                                                                                                       |
|       3 stale documentation/coverage | **Partially open P3** — generated counts are current, but the register itself says 221 instead of the current 232 tests.                                                               |
|              4 publish false success | **Locally hardened; external proof open P2** — relay success/revocation is network-blocked.                                                                                            |
|                5 sandbox false-ready | **Locally fixed; Docker matrix open P2** — absent/building/ready states are distinct, real daemon fault injection remains.                                                             |
|          6 fake Extensions lifecycle | **Removed/explicitly unavailable** — verify the retained renderer does not relabel it as supported.                                                                                    |
|           7 fake marketplace refresh | **Truthful snapshot behavior** — no remote marketplace sync is claimed.                                                                                                                |
|                   8 auto-update hook | **Contained; release infrastructure open** — no signed update feed/rollback product.                                                                                                   |
| 9 Settings modal/native-view overlap | **Fixed in tested path** — process restart and alternate view combinations remain useful.                                                                                              |
|    10 artifact toolbar disappearance | **Fixed in tested path** — retained renderer version sensitivity remains.                                                                                                              |
|           11 Bypass mode mid-session | **Fixed and unit-tested** — packaged/native permission matrix remains.                                                                                                                 |
|            12 stop + queued steering | **Fixed for normal path** — F-007 covers persistence-failure ordering.                                                                                                                 |
|      13 model-hostile tool contracts | **Core fixes present; adversarial matrix open P1/P2** — especially provider variants and malformed tools.                                                                              |
|        14 assistant prose/tool trace | **Fixed and tested** — keep a regression for every provider fallback format.                                                                                                           |
|           15 rewind composer prefill | **Contract fixed; native click/edit/resend proof open P2**.                                                                                                                            |
|              16 generic IPC fallback | **Open P1** — explicit inventory, but 270 methods still use compatibility semantics.                                                                                                   |
|         17 Code no-op mutation layer | **Improved/fixed for known live calls** — unknown future renderer methods can still expose gaps.                                                                                       |
|              18 recovered validation | **Default-on validation** — generated schema completeness remains a maintenance gate.                                                                                                  |
|    19 brittle Plugins/Skills patches | **Migration architecture fixed; 1.24012 adapters open** — stable intents and candidate reports avoid a full repatch, but unresolved feature adapters must still pass before promotion. |
|          20 late context compression | **Fixed for tested limits** — tokenizer/provider/large-tool-output matrix open.                                                                                                        |
|          21 verify no real workflows | **Script wiring improved** — this audit did not execute every runtime probe; archive per-artifact output.                                                                              |
|            22 timing-dependent tests | **Current baseline green (232 tests)** — repeated Windows stress is still needed.                                                                                                      |
|          23 packaged smoke boot-only | **Improved** — unpacked/AppImage evidence exists; installed NSIS upgrade path open.                                                                                                    |
|              24 orphaned live probes | **Wired in scripts** — invocation and result archival still need release evidence.                                                                                                     |
|           25 Whisper batch dictation | **Replaced by Moonshine path** — native microphone/device-loss matrix open.                                                                                                            |
|      26 sharing lacks external proof | **Open P2/external** — relay success and revocation are not reproducible here.                                                                                                         |
|    27 modules lack direct unit tests | **Open P2** — see F-010.                                                                                                                                                               |
|        28 reload vs process recovery | **Open P2** — see F-011.                                                                                                                                                               |
|     29 upgrade/cross-platform matrix | **Open P2** — Windows/Linux artifacts exist; populated upgrades/macOS are unverified.                                                                                                  |
|                30 browser happy path | **Open P2** — see F-012.                                                                                                                                                               |
|                 31 shutdown failures | **Observability improved; fault durability open P2** — disposal errors are logged, but injected durability proof is incomplete.                                                        |
|      32 dynamic workflow Task facade | **Implemented for tested pool/cancel/recovery path** — scheduler/provider/forced-kill interactions remain open.                                                                        |

### Deep-pass additions (pre-remediation)

| Finding                                          | Pre-remediation status                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| F-016 packaged computer auto-consent             | **Open P1** — environment bypass is not development/test gated.                                                   |
| F-017 preview host execution                     | **Open P1** — `preview_start` is absent from the normal permission set and accepts arbitrary runtime executables. |
| F-018 inherited child environment                | **Open P1/P2** — preview, MCP, and shell children inherit parent secrets.                                         |
| F-019 production `brace-expansion` vulnerability | **Open P2** — affected version is present in the production dependency chain and Windows ASAR.                    |
| F-020 ASAR test/advisory baggage                 | **Open P2** — package pruning/allowlist gate is missing.                                                          |
| F-021 profile override isolation                 | **Open P2** — arbitrary user-data override remains active in packaged startup.                                    |

## Original test and release matrix (pre-remediation)

| Check                          | Result on 2026-08-03                                             | Interpretation                                                             |
| ------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `npm test`                     | **37 files / 232 passed**                                        | strong deterministic unit/manager baseline; not full Electron parity       |
| `npm run typecheck`            | **passed**                                                       | TypeScript graph compiles                                                  |
| `npm run build`                | **passed**                                                       | current source produces main/preload/renderer bundles                      |
| `npm run format:check`         | **failed**                                                       | one test file is unformatted; `npm run verify` is therefore red            |
| `npm run release:attest`       | **failed**                                                       | stale checksum file before signature/clean-worktree checks                 |
| Windows installer hash         | computed                                                         | current EXE is not authenticated by the stale checksum file                |
| AppImage hash                  | computed                                                         | current AppImage is not authenticated by the stale checksum file           |
| AppImage native entry          | previously smoke-tested; direct FUSE execution is host-dependent | missing `libfuse.so.2` is an environment blocker, not proof of app failure |
| external publish/revoke        | blocked by relay response                                        | local rollback path is tested; external success remains open               |
| installed NSIS upgrade profile | not verified in this audit                                       | packaging path still needs clean install/upgrade/restart evidence          |
| macOS                          | not verified                                                     | platform availability/unsupported gates need explicit coverage             |

The package scripts are ambitious: `verify` includes runtime probes, and
`dist:win`/`dist:linux` include probe and packaging steps. Those scripts should
be treated as release jobs only after their environment prerequisites are
declared and their output is archived; a script existing in `package.json` is
not evidence that it ran for a particular artifact.

## Original prioritized remediation plan

### Before any release

1. Gate the two special MCP IPC handlers to the local renderer/capability
   token; add hosted-origin regression tests.
2. Resolve the renderer/contract generation strategy and fail builds on mixed
   identities.
3. Make provider presets transport-truthful; add OpenRouter/OpenAI/local and
   Anthropic/proxy request fixtures with tools, thinking, SSE, auth, and model
   discovery.
4. Remove the packaged computer auto-consent path, gate `preview_start`, and
   stop copying the full parent environment into host children.
5. Upgrade/prune affected production dependencies, remove ASAR test/advisory
   baggage, and add a package-content allowlist gate.
6. Rebuild from a clean commit, sign the installer, regenerate checksums and
   provenance, and make `release:attest` pass.
7. Format/fix the current failing test file, then run the entire declared
   `verify`/packaged matrix and archive logs/hashes.

### Next hardening increment

1. Add stop/persistence failure and forced-kill lifecycle tests.
2. Add direct tests for local UI routing/CSP, IPC policy, browser URL policy,
   preview port races, diagnostics redaction, scheduler clock behavior, and
   plugin/MCP lifecycle.
3. Replace compatibility defaults with explicit per-method availability
   records wherever the retained contract permits it.
4. Build deterministic local fixtures for public HTTPS, DNS rebinding,
   redirect/download/cookie/crash, relay publish/revoke, and OAuth callback.
5. Add old-profile/upgrade tests and process-level Windows/Linux/macOS
   unsupported-state checks.

### Continuous audit discipline

- Treat source, generated contracts, retained renderer snapshot, patches,
  assets, tests, probes, and package metadata as one versioned release unit.
- Keep a fixed/blocked/open checklist; never mark an externally blocked probe
  as passed because a local unit test is green.
- Preserve raw failure evidence and redact support bundles by schema, not only
  by key-name heuristics.
- Require a clean worktree and artifact hash/signature report before publishing
  any installer or AppImage.

## File/component inventory appendix

### Authored runtime

**Main process (35):** `index.ts`, `ipc.ts`, `services.ts`, `state.ts`,
`local-backend.ts`, `local-code.ts`, `local-ui.ts`, `local-browser.ts`,
`local-web-tools.ts`, `local-computer.ts`, `local-sandbox.ts`,
`local-launch-preview.ts`, `local-file-preview.ts`, `local-mcp.ts`,
`local-mcp-bridge.ts`, `local-mcp-oauth.ts`, `local-plugins.ts`,
`local-scheduled-tasks.ts`, `local-tunnel.ts`, `publish-share.ts`,
`local-export.ts`, `local-extract.ts`, `local-diagnostics.ts`,
`local-moonshine.ts`, `local-tray.ts`, `builtin-skills.ts`,
`bounded-json-file.ts`, `bounded-response.ts`, `context-compaction.ts`,
`file-access.ts`, `runtime-prompt.ts`, `thinking-tags.ts`, `zip-bundle.ts`,
and `local-search-proxy.cjs`.

**Preload/renderer/shared:** `main-view.ts`, `local-workbench.ts`,
`expose-contract.ts`, `shell.ts`, `renderer/main.tsx`, `renderer/styles.css`,
security/path/channel/validation/product-boundary/version/identity helpers,
and the connector/plugin directory snapshots.

**Generated contract:** `desktop-api.d.ts`, `ipc-contract.ts`, and
`ipc-validation.ts`; generated from the reference extraction/signature tools and
must be regenerated together.

### Verification and tooling

The 37 test files cover app/package identity, contracts/validation, state,
context compaction, local Chat/backend/connectors, Code queue/rewind/tools/
background tasks, launch configuration, sandbox/security, MCP stdio/remote/
bridge/OAuth, plugins, scheduler, export/tunnel/publish/ZIP/diagnostics,
search proxy, and client patches. The 64 tools include reference extraction and
generation, coverage reports, source/packaged/real probes, Moonshine/dictation,
background tasks, browser/preview/artifact/Settings/plugins/MCP/scheduler,
Linux/AppImage packaging, and release attestation.

### Reference/assets

The repository includes the staged retained vendor renderer, hashed JavaScript
and CSS, fonts, icons, screenshots, audio/video, Moonshine native/model assets,
connector/plugin directory snapshots, and package icons/metadata. The assets
are part of the runtime identity: a source change without re-staging and
re-running patch gates can produce a bundle that compiles but does not expose
the expected UI.

## Original bottom line (pre-remediation)

The application has real engineering depth and a good local security posture
in most authored managers. Its weak points are exactly the seams that produce
the user-visible “randomly stopped,” “tool call failed,” “preview/port is
already running,” and “the feature said it worked” experiences: renderer
generation drift, broad compatibility defaults, process/queue recovery,
permission bypasses, inherited child environments, and
external/packaging truthfulness. Fix F-001, F-005, F-006, F-016, F-017, and
the renderer identity gate first; then use the diagnostics event stream plus
the lifecycle matrix to drive the remaining edge cases instead of relying on
isolated green unit tests.
