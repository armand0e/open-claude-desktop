# Open-Claude

An independent, evidence-backed reconstruction of the Claude Desktop shell for Windows and Linux. Its retained, locally patched renderer and generated backend/preload contract are both release-gated to the same locally observed Desktop `1.22209.0` snapshot. It supplies readable TypeScript for the Electron main process, isolated preloads, persistence, protocol handling, and a small local window shell.

This is not Anthropic's original repository. Minification removes identifiers and source maps were not shipped, so the original TypeScript, comments, build system, signing keys, and Git history cannot be recovered byte-for-byte. The goal here is observable compatibility with an auditable implementation.

## What is recovered

- All 842 generated EIPC channels across 71 services.
- All public preload paths and their original preload membership.
- Generated argument/result evidence for 747 channels: 1,168 named arguments and 533 result contracts.
- The BrowserWindow plus WebContentsView architecture, trusted origins, navigation policy, permissions, single-instance behavior, deep links, local `app://` serving, and third-party API stubs.
- The packaged Claude chat UX in account-free local mode, including its bootstrap, conversation-list/tree, create/update/delete, completion, title, attachment, artifact-pane, and SSE event contracts.
- A persistent local backend with OpenAI Chat Completions and native Anthropic Messages transports, an in-app model/endpoint workbench, local files, and versioned artifacts.
- The packaged native Code UX with account-free workspace launch, persistent sessions and transcripts, provider-backed agent turns, permissions, file/search/shell tools, SDK-style and desktop artifact tools, git/file/editor adapters, an interactive multi-tab terminal, and the visible model-drivable multi-tab Browser from the gated Desktop 1.22209 contract.
- Functional settings, preferences, shortcuts, locale, window/navigation, notifications, downloads, capability-scoped files, MCP configuration, updater hooks, and selected desktop information services.
- Safe deterministic defaults for the remaining contract so every recovered preload method exists while unsupported deep services fail closed or return an empty state.

The extracted Anthropic bundles and installed `ion-dist` assets are analysis inputs only. They are ignored by Git and are not redistributed by this project.

## Run it

Requirements: Windows, Node.js 22+ or 24+, and npm.

```powershell
npm ci
npm run build
npm start
```

The normal development launch is account-free local mode. Release installers bundle the compatible retained UI snapshot, so an installed Open-Claude build does not depend on the official desktop app. Development runs can point at another extracted SPA with `CLAUDE_ION_DIST`. The compatibility bootstrap is entirely local and never extracts or reuses Claude credentials.

Renderer upgrades use a non-destructive migration lane: `npm run renderer:migrate -- 1.24012.9` applies every still-compatible patch in memory and writes a per-rule drift report without replacing the active snapshot; `npm run renderer:candidate:partial -- 1.24012.9` opens that candidate for development testing. Patch intents retain versioned alternate anchors, and promotion remains fail-closed until the patch, renderer, and regenerated contract gates all pass. See [`docs/renderer-upgrades.md`](docs/renderer-upgrades.md).

### Standalone identity and storage

The runtime product is **Open-Claude**, not Claude. Its Electron/Chromium profile, cookies, local storage, conversations, Code sessions, caches, logs, crash reports, single-instance lock, Windows taskbar identity, startup entry, notifications, and `open-claude://` deep links are isolated from Anthropic Claude Desktop. Mutable data defaults to `%AppData%\Open-Claude`; the official `%AppData%\Claude` profile is never opened for writes. `OPEN_CLAUDE_USER_DATA_DIR` can select an arbitrary development profile; packaged test profiles must resolve beneath the OS temporary directory, so an inherited override cannot attach the installed app to another product's profile.

Hosted compatibility mode is still available explicitly with `$env:CLAUDE_DESKTOP_LOCAL_UI = "0"`; it opens `https://claude.ai` in an isolated `WebContentsView` and may require a hosted account.

The default provider is an OpenAI-compatible endpoint at `http://127.0.0.1:11434/v1`. Configure it under **Settings → Model**, or set it before launch:

```powershell
$env:CLAUDE_LOCAL_BASE_URL = "http://127.0.0.1:1234/v1"
$env:CLAUDE_LOCAL_MODEL = "my-model"
$env:CLAUDE_LOCAL_API_KEY = "optional-key"
npm start
```

Ollama, LM Studio, vLLM, llama.cpp servers, OpenRouter, and other gateways work through the OpenAI Chat Completions transport. The Claude Code preset uses an explicitly supplied Anthropic Console API key and the native Anthropic Messages transport; it does not reuse Claude subscription credentials. The same configured provider powers Chat and Code. Code uses structured tools and automatically falls back to an explicit `<tool_call>` protocol for OpenAI-compatible endpoints that reject them. Local streamable-HTTP MCP connectors are supported, including guided Gmail, Google Drive, and Slack presets that use user-owned OAuth clients and encrypted on-device tokens. Claude-hosted billing and Anthropic-managed connectors remain unavailable. See [`docs/local-mode.md`](docs/local-mode.md) and [`docs/local-code.md`](docs/local-code.md) for the exact boundaries.

## Reproduce the analysis

With Claude Desktop installed locally:

```powershell
npm run reference:recover
```

That pipeline locates the newest install, extracts `app.asar`, fingerprints it, inventories the ASAR and SPA, recovers preload bindings with an AST parser, derives IPC validation signatures, and regenerates the TypeScript contracts. Raw extracted files stay under ignored `reference/`; derived reports stay under `analysis/`.

Important outputs:

- [`analysis/reference-metadata.json`](analysis/reference-metadata.json): exact observed package and ASAR fingerprint.
- [`analysis/ipc-contract.json`](analysis/ipc-contract.json): 842-channel, 71-service inventory.
- [`analysis/preload-api.json`](analysis/preload-api.json): preload files, operations, and public paths.
- [`analysis/ipc-signatures.json`](analysis/ipc-signatures.json): named parameters and derived validator summaries.
- [`analysis/implementation-coverage.json`](analysis/implementation-coverage.json): machine-readable service-specific and fallback dispatch coverage.
- [`src/generated/ipc-contract.ts`](src/generated/ipc-contract.ts): build-time contract.
- [`src/generated/ipc-validation.ts`](src/generated/ipc-validation.ts): runtime argument guards.
- [`src/generated/desktop-api.d.ts`](src/generated/desktop-api.d.ts): callable TypeScript declarations for all 11 exposed namespaces.

## Verify it

```powershell
npm test
npm run build
npm run dist:linux
npm audit
npm run smoke:local
npm run smoke:local-chat
npm run probe:streaming-flow
npm run probe:code-streaming
npm run smoke:local-artifact
npm run smoke:local-attachment
npm run smoke:local-code
npm run smoke:local-code-permission
npm run smoke:local-code-terminal
```

With a model running at `http://127.0.0.1:1234/v1` (model ID `llm`), run the complete live-provider matrix with:

```powershell
npm run smoke:real
```

Override `CLAUDE_REAL_BASE_URL` and `CLAUDE_REAL_MODEL` for another endpoint. The live matrix covers typing/discovery/persistence in the provider popup; Chat send, attachment, artifact sandbox, reload, rename/star/delete; and Code generation, every local tool, native approval, terminal execution/rendering, file/media/session/git adapters, both artifact bridges, and restart hydration.

Derived result checks are enabled by default. `CLAUDE_DISABLE_RESULT_VALIDATION=1` is reserved for diagnosis; release validation runs with recovered primitive, collection, and object-shape checks active.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) explains the process, view, preload, and security boundaries.
- [`docs/reverse-engineering-report.md`](docs/reverse-engineering-report.md) records evidence and methodology.
- [`docs/coverage.md`](docs/coverage.md) distinguishes exact contracts, functional reconstructions, and safe fallbacks.
- [`docs/product-boundary.md`](docs/product-boundary.md) records what stays local, what is compatibility-only, what is trimmed, and where code belongs.
- [`docs/local-mode.md`](docs/local-mode.md) explains the packaged UX patch layer, local API, provider configuration, and persistence.
- [`docs/local-code.md`](docs/local-code.md) explains the local Code harness, native UI integration, tools, terminal, permissions, and current boundaries.
- [`docs/streaming-and-context.md`](docs/streaming-and-context.md) documents the OpenAI-compatible stream translation, mock endpoint, native UI timing, and Chat/Code context construction.
