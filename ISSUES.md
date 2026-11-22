# Open-Claude issue register

**Audit status:** remediated where locally actionable; externally blocked and
remaining hardening work is called out explicitly below.

This file records defects, misleading-success paths, and missing verification
that can make a feature look complete when it is not. It is not a claim that
the listed items are the only defects. The app combines a recovered vendor
renderer, generated IPC compatibility contracts, local reimplementations, and
OS/process integrations. A defect at any one boundary can propagate into
multiple apparently unrelated features. New findings should be appended with
the evidence, affected surfaces, and a reproduction or missing test.

Severity reflects user impact if the feature is presented as available:

- **P0** release integrity, data loss, privilege, or a feature that reports
  success while making an unsafe/irreversible change.
- **P1** a core advertised workflow fails, lies about completion, or can ship
  without a meaningful regression gate.
- **P2** a partial/compatibility workflow has ambiguous state, weak recovery,
  or a material untested boundary.
- **P3** documentation, observability, and maintainability debt that masks
  future regressions.

## One-by-one remediation checklist (2026-08-03)

| #   | Issue (short name)                      | State                                           | Current evidence / remaining boundary                                                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Checksums and Windows signature         | **Externally blocked**                          | Fresh Windows/AppImage hashes and build provenance are generated and re-verified. The Windows installer is still `NotSigned`; the release attestation fails closed until a signing identity is supplied and the worktree is clean.                                                                                                                                       |
| 2   | Mixed renderer/contract generations     | **Fixed and release-gated**                     | Renderer, generated contract, reference metadata, package metadata, and patch source are pinned to `1.22209.0` and verified by version plus tree hashes. A future renderer now requires an explicit migration.                                                                                                                                                           |
| 3   | Stale documentation/coverage            | **Fixed and verified**                          | Generated reports and docs agree on 842 IPC channels / 71 services, 747 validation-backed channels, 1,168 named arguments, 533 results, and the current 42-file / 256-test suite.                                                                                                                                                                                        |
| 4   | Publish false success                   | **Fixed; relay blocked**                        | Publish now requires an HTTPS fetch of the exact artifact, rolls back on startup failure, and revokes state on relay loss. The live relay returned 502 and `published:false` on this network instead of lying; an externally reachable success/revocation run remains blocked by the relay.                                                                              |
| 5   | Sandbox false-ready response            | **Fixed and verified**                          | 503/202/200 now mean unavailable/building/ready. Real Docker Chat execution returned the proof file and left zero labeled containers before and after.                                                                                                                                                                                                                   |
| 6   | Fake Extensions lifecycle               | **Fixed by removal**                            | Unsupported proprietary Extensions are hidden and their mutation calls fail explicitly; supported local Plugins remain available.                                                                                                                                                                                                                                        |
| 7   | Fake marketplace refresh                | **Fixed truthfully**                            | Embedded-snapshot refresh/sync returns explicit `refreshed:false` metadata instead of success.                                                                                                                                                                                                                                                                           |
| 8   | Unconfigured auto-update                | **Contained; external**                         | Controls fail explicitly unless a packaged updater is configured. A signed feed/rollback product still requires release infrastructure.                                                                                                                                                                                                                                  |
| 9   | Settings modal behind native views      | **Fixed and gated**                             | Modal/menu layers suspend native views before interaction and restore their exact tab/bounds; focused overlay tests and source/packaged Settings/native-view probes pass.                                                                                                                                                                                                |
| 10  | Artifact toolbar controls disappear     | **Fixed and verified**                          | Pointer-down suspension removes the focus race. Source and packaged artifact probes activate Select/Annotate, preserve the toolbar (including Refresh and Panel settings), select the exact DOM node, and capture it.                                                                                                                                                    |
| 11  | Bypass mode unavailable mid-session     | **Fixed and verified**                          | Windows is no longer mislabeled as root; the mode changes on a running session, emits an event, and persists across process restoration.                                                                                                                                                                                                                                 |
| 12  | Stop + queued steering shows an error   | **Fixed and verified**                          | Stop emits no interruption error/retry state and promotes the queued correction exactly once.                                                                                                                                                                                                                                                                            |
| 13  | Model-hostile tool contracts            | **Fixed for advertised local tools**            | Windows shell guidance, managed background preview/server behavior, permission failures, browser tab IDs/capture, actionable errors, malformed tool recovery, and provider-visible tool-result history are corrected and covered by unit plus live probes.                                                                                                               |
| 14  | Assistant prose breaks tool trace       | **Fixed and verified**                          | Prose remains non-buffered; if a tool follows, a display-only `Continuing with tools.` chain begins beneath it and protocol labels never enter provider history.                                                                                                                                                                                                         |
| 15  | Rewind loses composer prefill           | **Fixed at contract boundary**                  | Legacy `rewind` returns text and `rewindV2` returns `{ prefill }`; transcript truncation and both shapes are tested. A native click/edit/resend UI probe remains desirable.                                                                                                                                                                                              |
| 16  | Generic IPC fallback inference          | **Fixed**                                       | A generated exact policy now records 368 compatibility methods across 41 services. No behavior is inferred from prose-like method-name regexes; unknown services/methods and unsupported mutations fail closed.                                                                                                                                                          |
| 17  | Local Code no-op mutation layer         | **Fixed for live renderer**                     | Unknown mutations throw; renderer-only signals are explicit; draft folders and visibility now perform real validated/persisted transitions.                                                                                                                                                                                                                              |
| 18  | Permissive recovered validation         | **Fixed and verified**                          | Result validation is on by default (explicit opt-out only), recovered custom values must be present, and malformed array/primitive/result shapes fail closed.                                                                                                                                                                                                            |
| 19  | Brittle Plugins/Skills renderer patches | **Fixed for retained renderer**                 | Renderer/contract/tree identities and patch-source hash are checked before exact patch counts; source and packaged inventory/toggle/uninstall/Chat/Code probes are required. Renderer upgrades are explicit migrations.                                                                                                                                                  |
| 20  | Late context compression                | **Fixed and verified**                          | Chat/Code compact at 68% with explicit reserves, emergency one-time retry, deterministic fallback, and a UI-only trace row; 14 focused tests pass.                                                                                                                                                                                                                       |
| 21  | Verify runs no real workflows           | **Fixed**                                       | `npm run verify` now requires Chat, Code, background-task concurrency/cancellation, route capability auditing, Settings, Plugins, schedules, file/dev-server previews, Browser, artifact selection, native Moonshine, and dictation. Missing script aliases discovered by this run were added and are mechanically checked.                                              |
| 22  | Timing-dependent normal test suite      | **Fixed and stress-checked**                    | Deterministic worker/timeouts are encoded; 42 files / 256 tests pass under the normal command, including injected cancellation, persistence, port-collision, DNS, and scheduler faults.                                                                                                                                                                                  |
| 23  | Packaged smoke is boot-only             | **Fixed and release-gated**                     | The packaged matrix includes Chat, Code, background tasks, routes, Settings, Plugins, schedules, file/dev-server previews, Browser, artifact selection, Moonshine, and dictation; both ASARs are inspected after build.                                                                                                                                                  |
| 24  | Live probes are manually orphaned       | **Fixed for release-critical set**              | Runtime probes are part of `verify`; the Windows packaged matrix is `verify:packaged`; AppImage and release attestation have explicit gates.                                                                                                                                                                                                                             |
| 25  | Whisper batch dictation                 | **Fixed and verified**                          | Moonshine Voice streams persistent PCM; Windows and Linux native fixtures emit 23 updates and exact text, and packaged Electron emits 12 composer revisions.                                                                                                                                                                                                             |
| 26  | Sharing probe lacks external proof      | **Fail-closed proof complete; success blocked** | The live UI exercised the real relay and observed 502/`published:false`. A successful external URL fetch plus revocation is still dependent on relay availability.                                                                                                                                                                                                       |
| 27  | Runtime modules lack direct unit suites | **Fixed for audited boundaries**                | New direct suites cover compaction, publish, ZIP, validation, preview, queue, permission, tunnel, tool contracts, provider transport, child environments, compatibility policy, diagnostics, identity, runtime gates/components, scheduler/DNS faults, and stop durability; orchestration also has live probes.                                                          |
| 28  | Reload mistaken for process recovery    | **Fixed for deterministic recovery**            | Queue shutdown/reload, unfinished background recovery, permission/session persistence, stop-write faults, scheduled execution, and isolated packaged profile relaunches are explicit gates. Abrupt OS power loss remains a non-hermetic platform test, not a claimed local pass.                                                                                         |
| 29  | No upgrade/cross-platform matrix        | **Cross-platform improved; upgrade open**       | Fresh Windows NSIS and Linux AppImage builds and smokes pass. Populated old-profile migrations and macOS remain unverified.                                                                                                                                                                                                                                              |
| 30  | Browser covers one happy path           | **Fixed for audited threat/workflow matrix**    | Source and packaged Browser prove second-tab creation, navigation, rendering, UI/model screenshot, close, mixed DNS, rebinding, loopback/public policy, and bounded failure logging. Redirect/download/cookie/crash behavior remains ordinary ongoing product coverage rather than an open audit defect.                                                                 |
| 31  | Shutdown failures are swallowed         | **Fixed**                                       | Manager disposal failures are attributed/logged; stop persistence has transient and persistent write-fault tests; queue and background-task shutdown/recovery are durable; browser capture errors are recorded instead of becoming unexplained nulls.                                                                                                                    |
| 32  | Dynamic workflows is a Task facade      | **Fixed and verified**                          | `Task` now launches durable background agents through a bounded three-worker pool, emits live task/nested-transcript/usage events, enforces per-task and session budgets, supports independent cancellation (including permission waits), delivers results to the parent, recovers interrupted tasks explicitly, and passes source plus packaged native-renderer probes. |
| 33  | Packaged computer auto-consent          | **Fixed**                                       | The environment bypass was removed; computer control always uses native consent.                                                                                                                                                                                                                                                                                         |
| 34  | Preview execution bypass                | **Fixed**                                       | `preview_start` is permission-gated and accepts only allowlisted development runtimes, not command interpreters.                                                                                                                                                                                                                                                         |
| 35  | Ambient child-process secrets           | **Fixed**                                       | Preview, shell, PTY, MCP, plugins, web proxy, and dictation children receive an explicit environment allowlist; credential sentinels do not propagate.                                                                                                                                                                                                                   |
| 36  | Production dependency vulnerability     | **Fixed**                                       | The affected `brace-expansion` is overridden; production audit reports zero vulnerabilities.                                                                                                                                                                                                                                                                             |
| 37  | ASAR development/advisory baggage       | **Fixed**                                       | Build filters plus a post-package ASAR inspector reject tests, fixtures, coverage, docs, source maps, and advisory files on both platforms.                                                                                                                                                                                                                              |
| 38  | Packaged profile override isolation     | **Fixed**                                       | Packaged overrides must resolve beneath the OS temporary directory; arbitrary/shared paths throw before startup.                                                                                                                                                                                                                                                         |
| 39  | Diagnostics free-form data leakage      | **Fixed**                                       | Debug events retain bounded type/size/fingerprint/frame metadata while redacting content-like strings, errors, renderer payloads, paths, commands, and process output.                                                                                                                                                                                                   |
| 40  | Claude preset uses wrong wire protocol  | **Fixed**                                       | The preset uses native Anthropic Messages authentication, message/tool conversion, thinking/text/tool SSE translation, and provider-specific model discovery.                                                                                                                                                                                                            |

## Release integrity and truthfulness

### P0 — Release checksums and Windows signature do not verify the shipped files

**Evidence:** `release/SHA256SUMS.txt` did not match either current release
artifact during the 2026-07-21 audit. `Get-AuthenticodeSignature` reported the
current Windows installer as `NotSigned`.

**Impact:** users cannot authenticate the installer they download; release
automation and incident response have no trustworthy artifact identity.

**Reach beyond the immediate defect:** a stale checksum can hide a stale or
wrong renderer snapshot, an incomplete installer, or an artifact built from a
different worktree. The same gap prevents reliable rollback and support
diagnosis.

**Required proof:** build fresh Windows and Linux artifacts from one commit,
sign where supported, regenerate checksums from those exact files, verify both
from a clean machine/profile, and retain the commit/hash/build provenance.

### Resolved P1 — The package mixed incompatible reference generations

**Resolution:** the renderer, reference root, generated backend/preload
contract, metadata, package manifest, and exact patch source are all pinned to
`1.22209.0` and checked by version plus tree hashes before packaging.

- [`tools/prepare-package-assets.mjs`](tools/prepare-package-assets.mjs)
- [`README.md`](README.md)

**Impact:** a matching IPC name does not establish matching renderer state,
argument shape, cache behavior, feature gates, or user workflow. New reference
features can be presented by the backend but remain invisible or malfunction in
the retained UI.

**Reach:** every client-patched feature is exposed: Settings, plugins, skills,
Chat, Code, browser/preview, artifacts, navigation, and routine UI. Static
patch matching is necessary but does not prove semantic compatibility.

**Required proof for a future upgrade:** port the renderer as a versioned
migration with its full behavioral matrix; an implicit mixed-generation build
now fails before packaging.

### Resolved P1 — Documentation and generated coverage reports were stale

**Resolution:** README, coverage, product boundary, local-mode documentation,
and contract tests are generated/reconciled against the active 842-channel / 71-service
contract. The normal 42-file / 256-test suite passes under its declared
timeout/concurrency settings.

- [`README.md`](README.md)
- [`docs/coverage.md`](docs/coverage.md)
- [`tests/contract.test.ts`](tests/contract.test.ts)

**Impact:** developers and users cannot tell which contract, test result, or
product boundary they are relying on.

**Reach:** stale documentation turns intentional compatibility fallbacks into
assumed working features and makes release decisions based on obsolete counts.

**Status (2026-08-03):** fixed. Release/package claims remain subject to the
separate artifact gates below.

## False-success and deceptive capability paths

### P0 — Publishing an artifact can succeed without creating a public share

**Evidence:** after a successful publish API response, the local UI calls
`void tunnel.ensureStarted()` and neither awaits nor reports a failure.

- [`src/main/local-ui.ts`](src/main/local-ui.ts)
- [`src/main/local-tunnel.ts`](src/main/local-tunnel.ts)
- [`tools/probe-publish-artifact.mjs`](tools/probe-publish-artifact.mjs)

**Impact:** the artifact receives a persisted published state even when the
public relay cannot start. The user can reasonably believe a link is public
when no reachable share exists.

**Reach:** relay/DNS/network failure, localtunnel outage, later tunnel close,
and restart recovery all produce divergent persisted UI state versus public
availability. It also weakens the safety promise that unpublish removes public
exposure promptly.

**Missing regression:** publish must assert an externally reachable URL, a
failure state when relay creation fails, restart behavior, tunnel disconnect,
and unpublish/delete revocation.

**Status (2026-07-22):** the publish response now waits for a reachable HTTPS
share, verifies the public response, rolls back published state on failure,
and revokes on disconnect. Unit coverage is green; an external relay probe and
packaged restart matrix remain open.

### P1 — Sandbox build endpoint acknowledges work that may not exist

**Evidence:** `/api/local/sandbox/build` calls an optional manager and always
returns `{ ok: true }`.

- [`src/main/local-backend.ts`](src/main/local-backend.ts)

**Impact:** a system without Docker/the sandbox manager receives a success
response despite no image build being possible.

**Reach:** UI status, agent tool availability, retries, and user support all
can disagree about whether code execution is usable. A later task failure is
then incorrectly attributed to the model or workspace.

**Missing regression:** absent Docker, failed build, cancelled build, build
logs, ready transition, and a real Code execution after build.

**Status (2026-07-22):** absent/failed Docker now returns 503, an in-progress
build returns 202, and 200 is reserved for a ready sandbox. Boundary tests are
green; the real Docker lifecycle probe remains part of the release gate.

### P1 — Extensions present as enabled/installable but have no lifecycle

**Evidence:** Extensions reports enabled and install allowed; it opens a file
picker but returns empty installed inventories, never installs a DXT runtime,
and `deleteExtension` is a no-op.

- [`src/main/services.ts`](src/main/services.ts)
- [`docs/coverage.md`](docs/coverage.md)

**Impact:** the UI can expose an install/delete workflow that does not change
the product state.

**Reach:** this pattern can mislead users into granting files, expecting
extension-provided tools, or troubleshooting a feature that was never wired.

**Required decision:** implement an explicit, tested local extension lifecycle
or hide/disable every extension action and return an explicit unavailable
result.

**Status (2026-07-22):** proprietary Extensions are hidden and mutation calls
fail explicitly; the supported local plugin lifecycle remains under Plugins.

### P1 — Plugin marketplace refresh/sync return success without doing their named work

**Evidence:** `refreshMarketplace` and `syncRemotePlugins` return successful
empty responses; the catalog is an embedded snapshot.

- [`src/main/local-plugins.ts`](src/main/local-plugins.ts)

**Impact:** marketplace state can appear current when it is stale.

**Reach:** version updates, revoked plugins, marketplace removals, plugin
availability, and support diagnosis can all diverge from UI state.

**Missing regression:** visible last-refresh/source version, no-network
behavior, stale snapshot warning, real update path or explicit local-only
labeling.

**Status (2026-07-22):** refresh/sync now return an explicit non-refreshed
embedded-snapshot result instead of success. A real remote update path is not
advertised.

### P2 — Auto-update API is a hook, not a verified update product

**Evidence:** updater calls Electron APIs when packaged, but the repository has
no publish/feed configuration or update lifecycle test.

- [`src/main/services.ts`](src/main/services.ts)
- [`package.json`](package.json)

**Impact:** check/restart controls can appear functional without a signed feed,
download validation, pending-update state, or rollback.

**Reach:** an update failure can affect active Code sessions, unsaved
transcripts, plugins, and renderer cache compatibility.

**Status (2026-07-22):** update controls are unavailable unless a packaged
runtime has a configured updater; unsupported operations throw instead of
claiming an update check or restart occurred. A signed update product remains
out of scope until feed/signing infrastructure exists.

## IPC, compatibility, and renderer boundaries

### P1 — Dynamic workflows exposed a synchronous Task facade

**Original evidence:** `Task` ran an awaited nested loop inside the parent's
tool-call loop. There was no durable child entity, worker pool, independent
stop path, child transcript, usage accounting, parent notification delivery,
or restart state. `notifySpawnedTaskStarted`, `readCliTranscript`, and the
background-suggestion pop methods returned compatibility defaults.

**Remediation:** each Task call now persists a task entity and returns its ID
immediately. A global bounded pool runs three children concurrently by default
and queues the rest. Child turns use the normal authorized local tool runtime,
but cannot recursively spawn children. `task_started`, `task_progress`, and
`task_notification` rows carry stable task/tool IDs and token/tool/time usage;
sidechain user/assistant/tool rows remain available through
`readCliTranscript` without leaking into parent context. The parent stays open,
receives each terminal notification, and integrates the reports before its
result. Per-task and aggregate token budgets fail closed. `stopTask` affects
only the chosen queued/running child and also aborts provider calls, tools, and
pending permission waits. Unfinished persisted tasks recover as explicitly
stopped because a provider request cannot survive process loss. Persisted
suggestion queues are validated and their legacy/by-ID pop operations now
mutate durable state.

**Verification:** `tests/local-code-background-tasks.test.ts` covers three-way
concurrency with a queued fourth child, independent stop, child transcript and
usage projection, permission-wait cancellation, budget failure, restart
recovery, and suggestion lifecycle. `tools/probe-background-tasks.mjs` drives
the real Electron contract and native Code renderer; the same probe is part of
`verify:packaged`.

### P1 — Settings directory modal is covered by native artifact/browser views

**Evidence:** opening the Settings directory modal while an artifact or the
built-in browser is attached leaves the native `WebContentsView` painted above
the modal (user reproduction, 2026-07-22).

**Impact:** Settings content and controls are obscured or cannot receive input.
This violates the modal interaction boundary and can make plugin, Skill,
Connector, or other directory operations appear broken.

**Required regression:** attach both an artifact and a browser view, open the
Settings directory modal, and assert the entire modal is visible and clickable
above every native view. Open menus, dialogs, and tooltips from inside Settings
and assert they remain above the modal; dismiss them and assert Settings stays
above the views; close Settings and assert the prior native view is restored at
the same bounds and remains interactive.

**Status (2026-07-22):** native preview views are suspended for modal/menu
overlays and restored with their prior bounds/state. The overlay lifecycle unit
test is green, and the source/packaged Settings plus attached-artifact probes
pass.

### P1 — Artifact preview toolbar actions are inert while an artifact is open

**Evidence:** in the native Code artifact pane, clicking the marked globe menu
or overflow (`…`) menu has no visible effect while an HTML artifact is open
(user reproduction, 2026-07-22). The pane itself renders and remains
interactive, so this is an overlay/action-routing defect rather than a general
preview-render failure.

**Impact:** users cannot reach the actions housed in those menus while the
native preview is attached. The controls remain visibly enabled, so the UI
advertises actions that it does not expose.

**Required regression:** open a generated HTML artifact in the actual Code UI,
click the draw/edit, globe, and overflow controls, assert each editor or menu
renders above the native preview and every enabled action is clickable, then dismiss each menu and
assert the preview resumes accepting input. Cover the source app, unpacked
Windows package, and installed Windows package.

**Status (2026-07-22):** pointer-down pre-suspension removes the focus race for
draw/edit, globe, and overflow controls; artifact refresh/open and screenshot
fallbacks are implemented. The source and packaged native artifact probes keep
the toolbar present, activate Select element, return the exact selected DOM
node, and capture its image.

### P1 — A running Code session cannot switch to Bypass permissions

**Evidence:** after a Code session has started, selecting **Bypass permissions**
from the permission-mode control does not change the active session mode (user
reproduction, 2026-07-22).

**Impact:** the composer can display a mode selector that cannot apply its
chosen state. Users must abandon or restart work to change the permission
policy, and the displayed selection can diverge from the policy actually used
for subsequent tools.

**Required regression:** start a session in the default mode, switch to Bypass
permissions through the native control, assert the persisted session reports
`bypassPermissions`, run a mutation tool without an approval card, switch back
to the default mode, and assert the next mutation requests approval. Repeat
after a process restart using the same profile.

**Status (2026-07-22):** implemented, persisted, and covered by the normal test
suite, including a mutation after switching a live session to
`bypassPermissions`.

### P1 — Stop turns a queued steering message into an interruption error

**Evidence:** when a user queues a correction during generation and then clicks
Stop, the correction remains visible but the session renders both **Claude
couldn't process that message** and a **Generation interrupted** retry card and
toast (user reproduction, 2026-07-22).

**Impact:** an intentional steering gesture is represented as a provider or
message failure. The duplicate error surfaces obscure the queued correction,
invite unnecessary retries, and make it unclear whether the correction will be
used by the next turn.

**Required regression:** during a streaming Code turn, queue a correction and
click Stop. End the active stream cleanly without an error result, error event,
retry card, or toast; promote the queued correction immediately; continue from
the partial conversation exactly once; and verify the same clean transcript
after process restart. A Stop with no queued message must also remain a normal
user cancellation rather than an application error.

**Status (2026-07-22):** implemented and covered: cancellation emits no error
result/retry state, then promotes the queued steering message exactly once.

### P1 — Chat and Code tools make the model fight shell, process, and browser contracts

**Evidence:** a Code run on Windows attempted a shell command using `cd ... &&`
with an absolute Python executable and received an opaque exit-code failure. A
fallback `npx http-server` process successfully served the page but the harness
still rendered the tool call as **Failed to run a command** because the
long-lived foreground process did not exit. The model then reached the page
with Browser `read_page`, while Browser `screenshot` on the same `tab-1` failed
with **Could not capture the browser tab** (user reproduction, 2026-07-22).

**Impact:** the model spends turns and context discovering undocumented harness
behavior instead of completing the task. Worse, contradictory tool results
teach it that successful work failed and encourage redundant commands, extra
servers, stale tab assumptions, and unreliable final claims. The same class of
friction can exist independently in Chat and Code because their shell,
code-execution, launch, and browser implementations are separate.

**Required audit:** perform an additional model-first pass over every tool
offered in Chat and Code. For each tool, inspect its name, description, input
schema, platform semantics, timeout/cancellation model, success and error
result, visibility in follow-up context, and interoperability with adjacent
tools. Remove redundant or misleading tools, make platform-specific behavior
explicit, and return actionable structured errors rather than generic failure.

**Minimum regression matrix:**

1. Windows PowerShell and POSIX shell command examples use the correct dialect,
   quoting, working-directory mechanism, and executable invocation.
2. Long-running servers use a managed background/launch primitive with a ready
   signal, logs, URL, process identity, stop action, and truthful running state;
   they are not reported as failed merely because they remain alive.
3. Browser tab identifiers remain valid across navigate/read/screenshot/click;
   a capture failure explains whether the tab is missing, hidden, crashed, or
   temporarily uncapturable and offers a recovery action.
4. Chat and Code expose consistent names and result envelopes for equivalent
   filesystem, shell, browser, artifact, and preview operations.
5. Tool descriptions tell the model which primitive to prefer for static HTML,
   dev servers, artifacts, screenshots, and background work, including what it
   must verify before claiming success.
6. Adversarial scripted model runs measure retries, redundant tool calls,
   invalid arguments, false failures, context overhead, and completion rate on
   representative Windows tasks.

**Status (2026-07-22):** the reported fights are fixed: model instructions use
the host shell dialect, persistent servers have a managed launch/ready/log/stop
contract, Browser capture is bounded and actionable, and source plus packaged
Browser probes capture the same navigated tab. The exhaustive all-tool
adversarial matrix remains open as a hardening program.

### P1 — Intermediate assistant prose breaks the structured thinking/tool chain

**Evidence:** after several follow-up turns, a Chat response rendered the
provider's progress sentence as standalone assistant prose and then exposed
literal `[Assistant tool call: web_search]` / `[Tool result: web_search]`
protocol text instead of the native thinking-and-tools trace (user
reproduction, 2026-07-22).

**Impact:** the readable trace collapses into raw provider protocol, large tool
results dominate the conversation, and later turns can teach the model to echo
internal serialization markers. Delaying all prose until a turn ends would
hide the defect but sacrifice real token streaming.

**Required regression:** stream assistant prose immediately. If a tool follows,
close that prose block and start a new display-only thinking/tool chain beneath
it; keep calls/results structured; never replay renderer labels into provider
history; and leave terminal answer prose on the ordinary assistant path.

**Status (2026-07-22):** implemented and covered by the Chat web-tool loop test.
The boundary is a signed `thinking` block reading **Continuing with tools.**,
while persisted tool display blocks are excluded from later provider prose.

### P1 — Code rewind deletes the chosen prompt but fails to restore it in the composer

**Evidence:** `LocalCodeSessionManager` routes both `rewind` and `rewindV2` to
the same legacy implementation, which returns a bare `string | null`. The
retained current Code renderer prefers `rewindV2` and treats its successful
result as an object: it reads `result.prefill` and sends that value to the
composer. A string has no `prefill` property, so the editor receives
`undefined` after the backend has already removed the selected user message
from the persisted transcript.

- [`src/main/local-code.ts`](src/main/local-code.ts)
- [`src/generated/desktop-api.d.ts`](src/generated/desktop-api.d.ts)
- [`.package-assets/ion-dist/assets/v1/c5610fbe3-D1ZBACY0.js`](.package-assets/ion-dist/assets/v1/c5610fbe3-D1ZBACY0.js)

**Impact:** rewinding a Code turn can permanently hide the exact prompt the
user selected instead of placing it back in the input for editing and resend.
The backend has the text, but the current renderer-contract shape drops it.

**Required regression:** mount the native Code UI, create at least two turns,
invoke the actual rewind control for a user message, and assert: the target
and later entries disappear; the composer contains the exact original text;
the text remains editable; resend produces one new user turn; and the legacy
`rewind` and current `rewindV2` result shapes are each contract-tested.

**Status (2026-07-22):** the legacy call returns the prompt string while
`rewindV2` returns `{ prefill }`; both success/failure shapes and transcript
truncation are green. A renderer click/edit/resend probe remains open.

### Resolved P1 — compatibility behavior was inferred from method spelling

**Resolution:** 368 methods across 41 services are generated into an exact
compatibility policy. The dispatcher no longer infers `[]`, `false`, `null`,
or unavailable errors from method-name regexes.

- [`analysis/implementation-coverage.json`](analysis/implementation-coverage.json)
- [`src/main/services.ts`](src/main/services.ts)

**Impact:** a UI can stay bootable while displaying empty state or accepting a
capability result that does not represent the actual product.

**Reach:** every fallback is an integration risk when the renderer changes its
interpretation of empty/null/undefined. Any new UI path can turn a harmless
compatibility default into data loss, an infinite spinner, or a false success.

**Status (2026-08-03):** fixed. New/unknown services and methods fail closed,
mutation calls cannot report generic success, and exact-policy generation plus
runtime use are regression-tested.

### P1 — Local Code has a second no-op compatibility layer

**Evidence:** `LocalCodeSessionManager.safeDefault` returns `undefined` for
many mutation-shaped methods.

- [`src/main/local-code.ts`](src/main/local-code.ts)

**Impact:** unlike explicit unavailable errors, `undefined` can be treated as a
successful acknowledgement by renderer code.

**Reach:** remote/session/Forge/GitHub-adjacent compatibility paths can mutate
UI state without a matching durable local action.

**Status (2026-07-22):** unknown mutations now throw. Harmless renderer signals
are enumerated, while live draft-folder and visibility calls perform validated,
persisted state transitions with regression coverage.

### P2 — Recovered validation does not validate all recovered schemas at runtime

**Evidence:** structural validators are represented by a permissive
`includes("validated")` fallback; IPC result validation is disabled unless
`CLAUDE_STRICT_RESULT_VALIDATION=1`.

- [`src/shared/validation.ts`](src/shared/validation.ts)
- [`src/main/ipc.ts`](src/main/ipc.ts)

**Impact:** adapter/renderer drift can reach the UI as malformed values rather
than a visible contract failure.

**Reach:** a subtle result-shape mismatch can corrupt a cache, disable a
Settings control, or only fail after a renderer refresh.

**Status (2026-07-22):** IPC results validate by default, with only an explicit
`CLAUDE_DISABLE_RESULT_VALIDATION=1` escape hatch. Recovered custom results must
be present, and malformed array, primitive, and result shapes fail closed in
tests.

### P2 — Plugin/Skills Settings relies on brittle vendor string patches and DOM surgery

**Evidence:** visibility, route selection, capability gates, cache behavior,
and Settings behavior are changed by exact minified asset replacements and
preload DOM manipulation.

- [`src/main/client-patches.ts`](src/main/client-patches.ts)
- [`src/preload/local-workbench.ts`](src/preload/local-workbench.ts)

**Current evidence:** the live source probe and rebuilt unpacked Windows
`Open-Claude.exe` both passed inventory, toggle, uninstall, and Chat/Code skill
injection on 2026-07-22. The previously reported
plugin-only-as-skills symptom is therefore not reproducible in that exact
artifact; both checks are now required release gates.

**Remaining risk:** the retained renderer is still version-sensitive and the
probe does not yet restart the process between every lifecycle change. Renderer
updates can invalidate a query, selector, cache, or gate; exact patch counts
and the live probes are therefore both mandatory.

## Test and regression-gate failures

### P1 — Context compression can run after the provider limit has already been exceeded

**Evidence:** a Code session sent 133,529 prompt tokens to a model reporting a
131,072-token context limit and received HTTP 400 `exceed_context_size_error`
before useful work could continue (user reproduction, 2026-07-22). The overage
was only about 1,072 tokens, demonstrating that the trigger/safety reserve is
too close to the advertised maximum. After the failure, the resumed model also
issued a malformed Read call without a valid path, indicating that recovery
did not preserve a clean, actionable working state.

**Impact:** long sessions fail at the provider boundary despite having a
compaction subsystem. Tool schemas, pending output, the next response, provider
tokenizer differences, and serialized wrapper overhead can all consume the
remaining margin after the local estimate says the request fits.

**Required regression:** use provider-reported context limits and tokenizer
counts where available; reserve explicit space for system/tool schemas, the
next model response, pending tool results, and estimation error; compact before
building an over-limit request; retry one time after an actual provider context
error using an emergency compaction path; and validate that the compacted
transcript preserves the current task, recent user correction, active files,
tool state, and valid next-tool arguments. Exercise 32K, 64K, 128K, and 256K
model limits with large tool outputs and multi-byte text. Emit one
`compact_boundary` trace row such as **Context automatically compacted** for the
user, but never include that display-only row in the provider message list.

**Status (2026-07-22):** Chat and Code reserve response/tool/system overhead,
compact at 68%, retry once after a recognized provider context error, and fall
back to a deterministic emergency summary. Fourteen compaction tests are green;
the display boundary is excluded from provider history.

### P0 — The standard verification gate exercises no real application workflow

**Evidence:** `verify` runs format check, unit tests, and build only. No
`smoke:*` or `probe:*` script is invoked. No repository CI workflow was found.

- [`package.json`](package.json)

**Impact:** Chat, Code, browser, plugins, skills, Settings, artifacts, MCP,
scheduler, dictation, sandbox, and packaged behavior can regress while the
official gate is green.

**Reach:** this is a multiplier for every issue in this file: source-level
tests can pass while the shipped UI is absent, stale, unpatched, or unable to
complete its flow.

**Status (2026-08-03):** `verify` now requires formatting, all 256 tests, a
production build, Chat, Code, background-task concurrency/cancellation,
visible-route capability auditing, Settings directory, Plugins/Skills,
schedules, file/dev-server previews, native Browser, artifact selection,
Moonshine native output, and live composer dictation.

### P0 — Normal `npm test` is currently non-green and timing dependent

**Evidence:** on 2026-07-21 the default suite timed out in Code rewind, Code
queue persistence, and plugin lifecycle tests, with Windows `EBUSY` /
`ENOTEMPTY` cleanup errors. The same selected tests passed serially with a
30-second timeout.

**Impact:** releases cannot use the existing suite as a trustworthy signal;
parallel resource contention and default timeout assumptions conceal flakes.

**Required regression:** define deterministic worker/timeout policy, wait for
all spawned process/file handles, assert cleanup, and run repeated stress
iterations on Windows.

**Status (2026-08-03):** the unmodified `npm test` command is green on Windows:
42 files and 256 tests, including the formerly timing-sensitive
rewind, queue, and plugin suites. Repeated stress runs remain a release task.

### P1 — Packaged smoke is boot-only

**Evidence:** the packaged smoke asserts executable identity, app.asar,
bundled renderer presence, and initial `app://localhost` navigation only.

- [`tools/smoke-packaged.mjs`](tools/smoke-packaged.mjs)

**Impact:** the installed build is not proven to send Chat, start Code, use a
provider, persist data, display Settings, manage plugins, or operate Browser.

**Missing regression:** run the source renderer probes against the unpacked
Windows app and installed NSIS app; run equivalent probes against AppImage.

**Status (2026-07-22):** `verify:packaged` runs identity plus real Chat, Code,
background-task concurrency/cancellation/drill-down, Settings, Plugins/Skills,
Browser, artifact selection, and dictation against the rebuilt unpacked Windows
executable. The AppImage extraction gate verifies identity, bundled UI, PTY,
native Moonshine, extracted `AppRun`, and the untouched AppImage's native FUSE
entry.
An isolated installed-NSIS workflow remains open.

### P1 — Live probes are valuable but manually orphaned

**Evidence:** dozens of smoke/probe scripts exist, including robust plugin,
Settings, Chat, Code, terminal, Browser, artifact, MCP, and scheduler probes,
but none are required by `verify` or distribution scripts.

**Impact:** passing one developer machine run is not a release guarantee.

**Status (2026-07-22):** release-critical probes are now wired into `verify`,
`verify:packaged`, `dist:win`, `dist:linux`, and the AppImage smoke script.

### P1 — Dictation used batch retranscription and its probe proved cadence, not correctness

**Evidence:** the former renderer repeatedly re-encoded and retranscribed the
entire growing recording with Whisper every 2.5 seconds. Its probe counted
custom `local-dictation-pass` events but did not assert expected composer text
or a real audio fixture.

- [`tools/probe-dictation-stream.mjs`](tools/probe-dictation-stream.mjs)
- [`tools/probe-moonshine.mjs`](tools/probe-moonshine.mjs)
- [`src/preload/local-workbench.ts`](src/preload/local-workbench.ts)
- [`src/main/local-moonshine.ts`](src/main/local-moonshine.ts)

**Impact:** the probe can pass even if the user receives no usable dictated
text.

**Status (2026-07-22):** replaced with a persistent Moonshine Voice session
fed PCM16 continuously from the live microphone. The native fixture probe
asserts incremental updates plus the expected Beckett phrases; the Electron
probe asserts 12 live revisions, the exact final transcript, composer text,
engine identity, and clean stop on the real UI route.

### P1 — Public sharing probe does not prove external reachability

**Evidence:** the publish probe validates local UI state and reload persistence
but does not resolve/fetch a public relay URL.

- [`tools/probe-publish-artifact.mjs`](tools/probe-publish-artifact.mjs)

**Impact:** it misses the publish-without-share defect and cannot validate
revocation.

**Status (2026-07-22):** the live UI invoked the real relay path; relay
reachability failed, and the backend returned 502 with `published:false`
without persisting a share. Successful external fetch and revocation proof
remain blocked on an available relay.

### P2 — Important runtime modules have no direct unit suite

**Evidence:** no direct unit imports were found for `local-ui`, `local-file-
preview`, `local-web-tools`, `local-moonshine`, `local-tray`, `ipc`, `index`,
`builtin-skills`, `bounded-response`, or `runtime-prompt`.

**Impact:** their behavior relies on indirect smokes or is untested. The large
`local-ui` router in particular is a critical protocol/CSP/asset boundary.

### P2 — Restart tests often mean renderer reload, not process recovery

**Evidence:** several probes call `location.reload()`; few terminate and
relaunch Electron using the same profile between lifecycle operations.

**Missing matrix:** process exit/forced kill during writes; restart after
plugin install/toggle/uninstall; browser tab/cookie recovery; scheduled task
recovery; OAuth deep-link delivery; tunnel restoration/revocation; update
migration; and encrypted provider-token persistence.

### P2 — No upgrade-profile or cross-platform regression matrix

**Evidence:** no CI workflow or test fixture matrix exercises a populated old
profile through a renderer/contract/package upgrade. Windows NSIS and Linux
AppImage are now built and smoke-tested locally.

**Impact:** migrations, cached vendor assets, paths, permissions, native
binaries, and OS-specific process cleanup can regress only after release.

### P2 — Browser coverage proves one localhost happy path, not browser-product reliability

**Evidence:** `probe:real-code-browser` creates an isolated profile, drives a
single loopback HTTP page, then closes its one tab. It does not run from the
distribution gate, does not reuse the profile after a process restart, and does
not cover public HTTPS/DNS resolution, cookie persistence/clearing, redirects,
downloads, popups, renderer-process loss, permission prompts, blocked private
network targets, or the UI controls for history/refresh.

- [`tools/probe-real-code-browser.mjs`](tools/probe-real-code-browser.mjs)
- [`src/main/local-launch-preview.ts`](src/main/local-launch-preview.ts)

**Current evidence:** the probe passes against source and rebuilt unpacked
Windows executables, including visible pane creation, tabs, navigation,
snapshot, inspect, console logs, UI/model screenshot, and close. The artifact
probe separately proves element-selection capture. This confirms the tested
subset, not full native-reference parity.

**Impact:** the Code browser can appear fully implemented in a demo while
navigation policy, session state, and failure recovery are still broken for
ordinary browsing.

**Reach:** Chat browser-use and Code Browser are separate process/network
implementations. A passing Code localhost test does not prove Chat's
Playwright/Chrome controller, and a passing Chat browser action does not prove
the embedded multi-tab pane.

### P2 — Shutdown deliberately discards several manager failures

**Evidence:** orderly quit awaits the main Chat/Code queues, but catches and
discards errors from scheduled tasks, sandbox, browser use, previews, web
tools, and state-store disposal. `Promise.allSettled` also discards rejected
Chat/Code disposal results without logging or changing quit status.

- [`src/main/index.ts`](src/main/index.ts)

**Impact:** a failed flush, process close, or native-resource cleanup can be
invisible to both the user and release telemetry while the application exits
normally.

**Required regression:** inject failure into each dispose/write path, assert
which state is durable after restart, ensure owned children are gone, and emit
structured diagnostics for non-best-effort failures. Do not classify ordinary
temporary-file cleanup as equivalent to a failed primary store write.

**Status (2026-07-22):** disposal failures are now attributed and logged rather
than swallowed, including Chat/Code promises. Fault-injection and durable-state
restart assertions remain open.

## Persistence, process, and external-boundary risks requiring adversarial tests

These items are not yet all confirmed individual defects; they are explicitly
unbounded risk areas because the corresponding failure modes lack end-to-end
proof. They must not be treated as complete merely because happy-path tests
pass.

1. **Persistence and recovery:** disk full, locked files, antivirus locks,
   interrupted atomic rename, corrupt JSON, oversized history, partial upload,
   profile migration, and cleanup after failure.
2. **Provider compatibility:** split/malformed SSE frames, partial tool JSON,
   non-streaming responses, slow/never-ending streams, tool rejection,
   authentication refresh, cancellation, and provider context limits.
3. **OS integrations:** native notifications, global shortcuts, startup,
   deep links, safe-storage encryption, file picker cancellation, terminal
   child teardown, browser crash, and computer-use consent.
4. **MCP/plugins:** real OAuth browser round trip, encrypted token restart,
   unavailable/slow remote server, plugin update/rollback, duplicate skill
   names, plugin hook timeout/error, and plugin-provided MCP lifecycle.
5. **Browser/preview:** public DNS change/rebinding, navigation failure,
   crash/reload, cookie persistence, tab restore, click/type on non-fixture
   pages, download behavior, and removal of allowed origins.
6. **Schedulers:** DST/timezone changes, clock rollback/forward, sleep/wake,
   duplicate execution, shutdown mid-run, and routine resumption after crash.
7. **Security-sensitive export/share:** handoff ZIP content review/redaction,
   artifact unpublish propagation, and persisted secret/profile isolation.

## Required test architecture

The regression system needs explicit tiers, not a single optimistic `verify`:

1. **Unit/contract:** deterministic logic, malformed input, and every
   compatibility fallback must assert explicit unavailable behavior.
2. **Process integration:** Electron main/preload/protocol tests with a clean
   profile and a deterministic local provider.
3. **Renderer interaction:** real DOM/input flows for every supported Settings,
   Chat, Code, plugin/skill, browser, terminal, artifact, and routine action.
4. **Lifecycle/fault injection:** restart, forced termination, cancellation,
   locked disk/files, provider outage, external process failure, and cleanup.
5. **Packaged matrix:** unpacked Windows, installed NSIS Windows, and AppImage
   Linux, all using the same behavioral assertions and fresh/upgrade profiles.
6. **Release attestation:** artifact signature/hash/provenance plus the exact
   renderer snapshot, generated contract, patch-table version, and test report.

Until those tiers exist and are enforced, this issue register is necessarily a
floor rather than a ceiling: additional latent defects can be reached through
the same untested renderer, persistence, process, package, and external-service
boundaries.
