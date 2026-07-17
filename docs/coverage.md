# Coverage

Coverage is reported at three separate levels so an exact interface does not get confused with an exact service implementation.

The same counts and per-service lists are available in [`analysis/implementation-coverage.json`](../analysis/implementation-coverage.json).

| Layer                                |          Recovered | Notes                                                  |
| ------------------------------------ | -----------------: | ------------------------------------------------------ |
| Distinct IPC channels                |          831 / 831 | Exact observed channel strings                         |
| Services                             |            71 / 71 | Exact namespace and service membership                 |
| Public preload paths                 |          831 / 831 | One unambiguous path each                              |
| Callable TypeScript declarations     |      11 namespaces | All recovered services and nested store APIs           |
| Preload operations                   |          831 / 831 | 726 invoke, 91 event, 14 sync                          |
| Generated validation evidence        | 737 / 831 channels | 1,146 arguments, 526 results                           |
| Explicit dispatcher service branches |   29 / 71 services | 527 contract methods enter a service-specific adapter  |
| Build and unit tests                 |            Passing | Typecheck, unit tests, production bundle               |
| Hosted and local-SPA smoke           |            Passing | Isolated Electron profiles                             |
| Local packaged-UX chat smoke         |            Passing | Provider stream, disk persistence, and reload render   |
| Local artifact-pane smoke            |            Passing | Native tool block, sandbox render, persistence, reload |
| Local attachment smoke               |            Passing | Disk picker, upload, provider context, reload          |
| Native local-Code generation smoke   |            Passing | Launcher, Read/Write loop, transcript, completion UI   |
| Native local-Code permission smoke   |            Passing | Approval card, one-time decision, Bash result          |
| Native local-Code terminal smoke     |            Passing | Terminal pane, ConPTY, event stream, rendered xterm    |
| Live localhost provider matrix       |            Passing | Settings, Chat, files, artifacts, Code tools, restart  |

## Functional desktop adapters

The following service families have concrete behavior rather than only a generic fallback:

- settings: `AppConfig`, `AppFeatures`, `AppPreferences`, `Startup`, `GlobalShortcut`, `FilePickers`, `DesktopInfo`, `MCP`, and `Extensions`;
- hybrid/internal UI: locale, About, and main title-bar controls;
- web shell: window controls/state, browser navigation, trusted navigation, external authentication, updater hooks, notifications, filesystem, local environment, Claude Code availability, Launch and artifact panes, and plugin MCP listing;
- local Code: durable `LocalSessions`, native launcher, transcript events, OpenAI-compatible agent loop, permission decisions, workspace file/search/shell tools, artifact tools, terminal PTYs, git status/diff/history, file previews, and editor launch;
- window manager: state query, focus, and close actions.

Some branches are intentionally partial. For example, Extensions exposes settings and folders but does not install proprietary DXT runtimes; configured third-party MCP transports are stored but are not yet injected into local Code turns; AutoUpdater delegates only where Electron supplies an updater.

## Safe fallbacks

The remaining services still exist at every recovered preload path, but return stable empty, false, null, or unavailable states where a real implementation would require missing private components. The largest groups are:

- remote/pool/SSH Code sessions;
- Claude VM, framebuffer, computer-use, simulator, and device registry;
- Cowork sessions, schedules, spaces, and feedback;
- Office add-ins and connected-document funnels;
- GitHub operations that depend on a live agent session;
- wake scheduling, feedback upload, support bundles, and native buddy transport.

Mutation-shaped fallback methods are no-ops. Enumeration-shaped methods return empty lists. Capability and status checks return false, null, or an explicit unavailable feature state. This is deliberate: a stub must not claim that work occurred.

## Validation scope

Primitive, optional, nullable, and array validators are enforced before dispatch. The report preserves a SHA-256 identity for every observed generated validation expression. Minified custom validator function names are not treated as recovered public schemas, so those values are marked `custom schema validated` and allowed through to the service implementation.

Result validation is available through `CLAUDE_STRICT_RESULT_VALIDATION=1`. It is disabled by default because generic fallback services intentionally do not fabricate complex result objects merely to satisfy a structural validator.

## Definition of done for a deeper service

A service should move out of fallback status only when all of the following are available:

1. argument and result shapes derived from generated guards or observed calls;
2. main-process control flow traced to its actual runtime dependencies;
3. security and persistence boundaries matched;
4. a test for success, invalid input, cancellation, and restart behavior;
5. a live smoke against the target Windows runtime.
