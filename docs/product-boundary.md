# Product Boundary

Open-Claude is a local desktop application, not a general-purpose emulator of
Anthropic's private cloud. The recovered renderer contract remains complete so
the retained UI can boot, but product support is defined by local value and an
auditable implementation rather than by the presence of a reference API name.

## Keep as first-class local product

| Capability                                                                              | Owner                                                       | Why it stays                                                                  |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Chat, artifacts, attachments, projects, memory, and export                              | `LocalBackend` plus the `app://` protocol                   | Durable, account-free workflows with clear local storage boundaries           |
| Code sessions, tools, permissions, terminal, git, preview, and routines                 | `LocalCodeSessionManager` and focused main-process managers | These need filesystem/process authority and a durable transcript              |
| Skills, plugins, and MCP connectors                                                     | Local plugin/skill stores and `LocalMcpManager`             | Extensibility is valuable locally when installation and execution are bounded |
| Browser use, Windows computer use, web tools, and Docker execution                      | Dedicated main-process managers                             | Powerful actions stay consent-gated, cancellable, and outside the renderer    |
| Settings, shortcuts, notifications, navigation, downloads, deep links, and find-in-page | `ServiceDispatcher` and Electron lifecycle code             | They map directly to operating-system or Electron primitives                  |
| The retained SPA and generated IPC contract                                             | Sandboxed view, isolated preload, generated files           | Compatibility layer only; it never owns local secrets or direct OS access     |

MCP tools are intentionally shared by Chat and Code. Code applies its normal
permission policy before a connector call, while Chat uses the conversation's
connector capability directly. Native find-in-page is implemented against the
active `WebContentsView`, where Electron owns the searchable document.

## Keep only as compatibility

All 842 recovered IPC paths remain exposed because the retained SPA may probe
them while rendering. A compatibility read returns an empty collection,
`false`, or `null` when absence is the truthful local state. A small set of
renderer synchronization signals is acknowledged without persistence.

Unsupported mutation-shaped calls fail with an explicit `unavailable in local
mode` error. They must never resolve successfully when nothing happened.
Event-only deep-link and menu services are reported separately from dispatcher
fallbacks because their producers live in application lifecycle code.

Hosted compatibility mode remains available only through an environment
switch. It is not the default product, does not share the official Claude
profile, and must not pull hosted assumptions into local managers.

## Trim from the active product

The following reference surfaces have no honest standalone implementation and
stay hidden or unavailable: Buddy/BLE transport, remote session pools and
device attestation, Office add-ins, mobile simulators, framebuffer streaming,
official feedback/support upload, Claude-account import/setup, proprietary
marketplaces, the Cowork product surface, quick-window/mini overlays, and macOS TCC
bridges on unsupported platforms.

Their IPC names remain in the generated compatibility contract; their UI gates
must remain off. A local feature should not be routed through one of these
services merely because a similarly named cloud feature exists.

The package also excludes development-only dependency trees. `node-pty`,
`playwright-core`, `playwright-extra`, and its stealth plugin are production
dependencies because the search proxy loads them externally at runtime.
React, Mermaid, PDF.js, localtunnel, and cross-spawn are bundled at build time.
The stealth wrapper is part of the supported persistent-Chrome search path,
not an unused browser dependency.

## Placement rules

- Electron/OS/network/process authority belongs in `src/main`. Managers own
  cancellation, resource limits, persistence, and disposal.
- Local HTTP/SSE compatibility belongs in `local-backend.ts` and
  `local-ui.ts`; it must not gain arbitrary filesystem authority.
- Agent session and workspace semantics belong in `local-code.ts`, while
  reusable transports such as MCP remain separate managers injected into it.
- Preloads may adapt presentation and route the retained UI, but may not
  become a second backend or persistent store.
- Generated contracts and analysis reports describe observed compatibility;
  they do not decide which features are supported.
- Reverse-engineering inputs, probes, tests, and build helpers stay in the
  development tree and are excluded from installers.
