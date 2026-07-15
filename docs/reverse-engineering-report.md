# Reverse-engineering report

## Reference build

The reconstruction was derived from the locally installed, signed Windows build described in [`analysis/reference-metadata.json`](../analysis/reference-metadata.json):

- package `@ant/desktop`, product `Claude`, version `1.21459.0`;
- entry point `.vite/build/index.pre.js`;
- Sentry release `f7518fa0f482cfd68e6ef7fb78e3924e013b5160`;
- `app.asar` size 37,080,701 bytes;
- `app.asar` SHA-256 `d9a896beca555b86e6e773c065b75d3bc21c246f260578a42ca532e76fa155bd`;
- runtime evidence: Electron `42.5.1`, Chrome `148.0.7778.271`.

The ASAR inventory contains 210 files and 43,082,901 extracted bytes. The installed `ion-dist` inventory contains 1,175 files and 132,625,345 bytes, including 940 JavaScript files. Bundles contain 112 source-map references, but no `.map` files were shipped.

## Method

1. Locate the current Squirrel-style install under `ProgramData` and fingerprint `app.asar`.
2. Extract the ASAR locally with `@electron/asar`; do not commit its contents.
3. Inventory every ASAR and local-SPA file with byte length and SHA-256.
4. Parse all nine preloads with Babel and follow object methods/properties into `ipcRenderer.invoke`, `on`, `removeListener`, and `sendSync` calls.
5. Parse the main generated IPC module and derive argument names, positions, primitive/optional summaries, result summaries, and a hash of each original validation expression.
6. Trace the main-process bundle for window construction, view ownership, protocols, origin gates, navigation, permissions, updater, stores, local sessions, MCP/extensions, and filesystem behavior.
7. Reimplement high-confidence behavior in readable TypeScript and preserve unimplemented interfaces as explicit safe fallbacks.
8. Build each sandboxed preload as a self-contained CommonJS file. Shared preload chunks fail in Electron's sandbox, so dynamic chunk imports are deliberately prohibited.
9. Smoke the reconstructed app through Chromium's debugging protocol using isolated profiles, never the user's production profile.

The installed application rejects ordinary remote-debugging launch flags through its signed CDP authorization bootstrap. That protection was not bypassed. Static bundle evidence was sufficient, while live CDP verification was performed only against the reconstruction.

## Recovered interface evidence

The preload analysis found 831 distinct channels across 71 services with exactly one public path per channel:

- 726 Promise-returning invoke calls;
- 91 event subscriptions, each with listener removal behavior;
- 14 synchronous calls.

Generated validation messages yielded contracts for 737 channels, including 1,146 named arguments and 526 validated results. The remaining 94 channels are largely no-argument commands, outgoing events/store dispatchers, or registrations without a generated validation message.

## Runtime proof

Hosted-mode smoke verified:

- the shell at the exact local `file:///.../dist/index.html` path;
- `claude.settings` with 15 services, `claude.internal.ui` with 3, and `claude.hybrid` with 1 in the shell;
- the view with `claude.web` 44, `claude.settings` 15, `claude.hybrid` 1, and `electron_window` 1;
- all 18 recovered `FileSystem` methods;
- settings reads/writes persisted to an isolated profile;
- the 43-entry desktop feature matrix.

Local-SPA smoke verified `app://localhost/new`, the internal account-shaped compatibility bootstrap with no visible account UI, restored packaged chat composer and conversation renderer, all expected desktop namespaces, and valid JSON bootstrap responses. A full chat smoke enters a prompt through the real ProseMirror composer, observes the translated request at a fake OpenAI-compatible provider, renders the streamed response in the packaged UI, verifies both messages on disk, reloads the page, and verifies the persisted conversation renders again.

Separate packaged-UX smokes select a real disk file through the shipped upload input and prove local upload, extracted provider context, persistence, render, and reload. The artifact smoke proves OpenAI function-call translation into a native artifact block, split-pane rendering through `app://artifacts.local`, version persistence, and reload.

## Non-recoverable boundary

No static reverse-engineering method can reconstruct information absent from the shipped client. This repository therefore does not claim to contain:

- Anthropic's original authored TypeScript, comments, tests, build scripts, repository history, or source maps;
- server-side Claude, account, billing, inference, connector, or telemetry implementations;
- signing/notarization keys or release infrastructure;
- private source for native addons, Claude Code/agent SDK internals, VM images, Office integrations, mobile simulators, or device-attestation services;
- copied authentication tokens, cookies, credentials, user files, or encrypted secrets.

Those limits are recorded as implementation gaps rather than filled with invented code.
