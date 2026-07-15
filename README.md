# Claude Desktop open reconstruction

An independent, evidence-backed reconstruction of the Claude Desktop shell for Windows. It targets the locally observed Claude Desktop `1.21459.0` runtime and supplies readable TypeScript for the Electron main process, isolated preloads, generated IPC contracts, persistence, protocol handling, and a small local window shell.

This is not Anthropic's original repository. Minification removes identifiers and source maps were not shipped, so the original TypeScript, comments, build system, signing keys, and Git history cannot be recovered byte-for-byte. The goal here is observable compatibility with an auditable implementation.

## What is recovered

- All 831 generated EIPC channels across 71 services.
- All public preload paths and their original preload membership.
- 726 invoke methods, 91 event subscriptions, and 14 synchronous methods.
- Generated argument/result guards for 737 channels: 1,146 named arguments and 526 result contracts.
- The BrowserWindow plus WebContentsView architecture, trusted origins, navigation policy, permissions, single-instance behavior, deep links, local `app://` serving, and third-party API stubs.
- The packaged Claude chat UX in account-free local mode, including its bootstrap, conversation-list/tree, create/update/delete, completion, title, attachment, artifact-pane, and SSE event contracts.
- A persistent local backend and OpenAI-compatible provider adapter, with an in-app model/endpoint workbench, local files, and versioned artifacts.
- The packaged native Code UX with account-free workspace launch, persistent sessions and transcripts, provider-backed agent turns, permissions, file/search/shell tools, SDK-style and desktop artifact tools, git/file/editor adapters, and an interactive multi-tab terminal.
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

The normal launch is account-free local mode. The app searches the observed install location automatically, runs the installed SPA against this repository's local backend, and stores conversations in this reconstruction's Electron profile. Point it at another extracted SPA with `CLAUDE_ION_DIST`. The compatibility bootstrap is entirely local and never extracts or reuses Claude credentials.

Hosted compatibility mode is still available explicitly with `$env:CLAUDE_DESKTOP_LOCAL_UI = "0"`; it opens `https://claude.ai` in an isolated `WebContentsView` and may require a hosted account.

The default provider is an OpenAI-compatible endpoint at `http://127.0.0.1:11434/v1`. Use the **Local model** button in the lower-right corner, or configure it before launch:

```powershell
$env:CLAUDE_LOCAL_BASE_URL = "http://127.0.0.1:1234/v1"
$env:CLAUDE_LOCAL_MODEL = "my-model"
$env:CLAUDE_LOCAL_API_KEY = "optional-key"
npm start
```

Ollama, LM Studio, vLLM, llama.cpp servers, and hosted gateways work when they implement OpenAI's `/models` and `/chat/completions` shapes. The same provider powers both Chat and Code. Code first uses OpenAI function tools and automatically falls back to an explicit `<tool_call>` protocol for endpoints that reject them. Claude-hosted features such as billing, remote connectors, and Anthropic inference remain unavailable. See [`docs/local-mode.md`](docs/local-mode.md) and [`docs/local-code.md`](docs/local-code.md) for the exact boundaries.

## Reproduce the analysis

With Claude Desktop installed locally:

```powershell
npm run reference:recover
```

That pipeline locates the newest install, extracts `app.asar`, fingerprints it, inventories the ASAR and SPA, recovers preload bindings with an AST parser, derives IPC validation signatures, and regenerates the TypeScript contracts. Raw extracted files stay under ignored `reference/`; derived reports stay under `analysis/`.

Important outputs:

- [`analysis/reference-metadata.json`](analysis/reference-metadata.json): exact observed package and ASAR fingerprint.
- [`analysis/ipc-contract.json`](analysis/ipc-contract.json): 831-channel service inventory.
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
npm audit
npm run smoke:local
npm run smoke:local-chat
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

Strict derived result checks can be enabled while developing a service implementation with `CLAUDE_STRICT_RESULT_VALIDATION=1`. They are opt-in because safe fallback services do not claim to satisfy structural result schemas they do not implement.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) explains the process, view, preload, and security boundaries.
- [`docs/reverse-engineering-report.md`](docs/reverse-engineering-report.md) records evidence and methodology.
- [`docs/coverage.md`](docs/coverage.md) distinguishes exact contracts, functional reconstructions, and safe fallbacks.
- [`docs/local-mode.md`](docs/local-mode.md) explains the packaged UX patch layer, local API, provider configuration, and persistence.
- [`docs/local-code.md`](docs/local-code.md) explains the local Code harness, native UI integration, tools, terminal, permissions, and current boundaries.

## Project boundary

The code in this repository is independently authored. Claude, Claude Desktop, and Anthropic are trademarks of Anthropic. The MIT license covers this reconstruction's authored source only; it does not grant rights to Anthropic binaries, web assets, services, or trademarks.
