# Local Claude Code

This repository supplies an independently authored local implementation behind the installed desktop renderer's native **Code** surface. It does not execute Anthropic's proprietary Claude Code binary or require a Claude account. The current behavioral reference is Claude Code `2.1.210` and Agent SDK `0.3.210`, recovered from the locally installed and npm-published packages.

## Native flow

1. Open **Code** and choose a workspace from the native folder selector.
2. Enter a task in the native prompt composer.
3. `LocalSessions.start` creates a durable local session, emits the transcript/start events expected by the renderer, and runs the selected OpenAI-compatible model.
4. Tool requests are authorized and executed in the main process. Assistant, tool-result, filesystem, result, initialization, and session-update frames use the recovered Claude Code transcript shapes so the installed UI renders its normal cards, diffs, status rows, and completion state.
5. Sessions and transcripts are atomically stored in `local-code-sessions.json` under Electron's user-data directory and are recoverable after restart.

No account bootstrap, OAuth token, or Anthropic credential is used.

## Agent and tools

Code sends non-streaming OpenAI-compatible chat completions with function definitions. If an endpoint rejects function tools, the session retries with a documented `<tool_call>{...}</tool_call>` text contract. The loop is bounded to 24 model turns and can be interrupted.

| Tool                             | Local behavior                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Read`                           | UTF-8 workspace reads with offset/limit and a 10 MiB cap                                                                        |
| `Write`                          | Creates or replaces workspace files and emits native file/diff events                                                           |
| `Edit`                           | Exact-string replacement with ambiguity protection and structured patches                                                       |
| `Glob`                           | File discovery through ripgrep with a filesystem fallback                                                                       |
| `Grep`                           | Regex content search through ripgrep                                                                                            |
| `Bash`                           | Bounded workspace command execution with stdout/stderr results                                                                  |
| `Artifact`                       | Claude Code `2.1.210`-style publish/list for Markdown or HTML files                                                             |
| `mcp__desktop__present_artifact` | Built-in desktop bridge that creates a durable file under `.claude-artifacts` and exposes it to the native preview/file surface |

File tools resolve real paths and reject lexical or symlink escapes outside the selected workspace and explicitly added directories. `Bash` is intentionally a more powerful boundary and is therefore controlled by the permission mode.

## Permissions

The recovered permission modes are implemented: `default`, `acceptEdits`, `plan`, `bypassPermissions`, `dontAsk`, and `auto`. Mutating tools produce the native permission request card where required. The response supports allow-once, always-allow for the current session, and deny. Pending decisions are cancelled when a task stops.

`acceptEdits` permits file and artifact changes but still asks before `Bash`. `plan` and `dontAsk` fail closed when a tool would require approval.

## Terminal and desktop interoperability

The Terminal tile uses `node-pty` `1.2.0-beta.13`, matching the observed desktop dependency. The implementation supports:

- an interactive PowerShell ConPTY on Windows and the user's shell on Unix;
- multiple native terminal tabs using the recovered `sessionId::tabId` keys;
- resize, write, stop, replay buffer, live/busy probes, and bounded 1 MiB output history;
- recovered `shell_pty_data` and `shell_pty_close` events consumed by the packaged xterm renderer;
- clean shutdown when a session is deleted or the app exits.

The native file browser, media data URLs, atomic editor writes with hash conflicts, default-app/reveal actions, VS Code/editor launch, and git branch/status/diff/history calls are backed by the local workspace.

## Provider configuration

Use the **Local model** control or set:

```powershell
$env:CLAUDE_LOCAL_BASE_URL = "http://127.0.0.1:1234/v1"
$env:CLAUDE_LOCAL_MODEL = "my-model"
$env:CLAUDE_LOCAL_API_KEY = "optional-key"
npm start
```

The model needs enough instruction-following ability to choose tools and consume their results. Function-calling support gives the best behavior, but it is not mandatory.

## Verification

```powershell
npm test
npm run build
npm run smoke:local-code
npm run smoke:local-code-permission
npm run smoke:local-code-terminal
```

The packaged smokes use isolated profiles and a deterministic mock model. They drive the native Code tab, folder selector, composer, Send button, permission card, tool cards, completion state, Terminal control, PTY event stream, and xterm mount. They also verify provider-visible tool results and files written on disk.

For a running OpenAI-compatible model, the real-provider matrix additionally verifies model-selected tools, native approval, executed PTY output, file conflict handling, media reads, session archive/search/settings, git status/diff/history, both artifact adapters, and restart hydration:

```powershell
$env:CLAUDE_REAL_BASE_URL = "http://127.0.0.1:1234/v1"
$env:CLAUDE_REAL_MODEL = "llm"
npm run smoke:real-code
npm run smoke:real-code-permission
npm run smoke:real-code-terminal
npm run smoke:real-code-all-tools
```

`npm run smoke:real` runs the provider-settings, Chat, attachment, Chat artifact, and all Code real-provider checks as one sequential matrix. The all-tools check deliberately depends on the selected model following an eight-step tool instruction; a failure reports the actual tool sequence and proof-file contents so model noncompliance is distinguishable from an adapter defect.

## Current boundary

This is a local compatibility harness, not a byte-for-byte copy of Anthropic's source or hosted service. Remote Claude Code sessions, SSH/WSL/pool execution, worktrees, cloud GitHub review orchestration, proprietary subagents, usage/billing, and Anthropic inference are not implemented. Third-party MCP configurations are preserved by the settings service, while general stdio/HTTP MCP execution is not yet injected into Code turns; the built-in desktop artifact bridge is implemented directly.
