# Streaming and context engineering

## Mixed OpenAI-compatible stream fixture

Run the reusable mock provider on `127.0.0.1:1235`:

```powershell
npm run mock:openai
```

Configure Open-Claude to use `http://127.0.0.1:1235/v1` and model
`mock-stream-model`. The endpoint implements:

- `GET /health`;
- `GET /v1/models`;
- `POST /v1/chat/completions` in streaming and non-streaming forms;
- `GET /debug/requests` to inspect the exact provider-visible payload; and
- `DELETE /debug/requests` to clear captured requests.

The streaming response deliberately fragments every important channel. It sends
reasoning in two deltas, visible assistant content in three deltas, and an
`artifacts` function call whose name and JSON arguments are split across three
tool-call deltas. This catches parsers that assume a tool name or JSON arguments
arrive atomically.

Run the native end-to-end probe with:

```powershell
npm run probe:streaming-flow
```

The probe drives the retained Claude chat UI, expands the native Thought process
control, validates the sandboxed artifact, closes and reopens its pane, reloads
the conversation, and checks persisted thinking, text, tool-use, and artifact
version blocks. It also emits a UI timeline so buffering and batching are
visible rather than inferred from the final DOM.

Code has a separate native streaming probe:

```powershell
npm run probe:code-streaming
```

It holds the first provider response open after sending reasoning, visible
assistant text, and a fragmented tool call. The probe fails unless the retained
Code renderer paints both the partial assistant text and the native tool-use
activity before the provider closes that response. It then completes the
Read/Write loop and verifies the resulting file, thinking transcript, and native
tool cards.

## Chat request and response flow

1. The retained UI posts a Claude-shaped completion request to the local
   `app://localhost` API.
2. `LocalBackend` creates or reuses the human message and persists it before
   provider execution.
3. It selects the active parent-linked conversation branch, converts it to
   OpenAI `system`, `user`, and `assistant` messages, and calls
   `/v1/chat/completions` with `stream: true`.
4. OpenAI reasoning, text, and indexed tool-call fragments are parsed from SSE.
5. Reasoning is buffered until visible text begins. The backend then emits a
   native `thinking` content block followed by incremental `text_delta` events.
   This prevents the retained client from marking a reasoning-plus-tool-only
   artifact response as incomplete.
6. Tool-call names and argument strings are accumulated by `index`. Artifact
   JSON is materialized only after the provider stream finishes, then emitted
   as a native `tool_use` block and rendered in the local sandbox.
7. `message_delta` and `message_stop` finish the UI stream. The complete
   assistant message and artifact version are atomically persisted.

`web_search` and `visit_website` use an in-request agent loop of at most eight
provider turns. Their assistant tool-call frames and local tool results are
appended to the provider continuation before asking the model to continue.
Artifact calls are terminal UI output and are materialized locally instead of
being sent back to the model as tool results.

If a provider rejects function schemas with HTTP 400, 404, or 422, Chat retries
without OpenAI tools and asks for the supported `<antArtifact>` form. A response
containing only reasoning is retried up to three times with an explicit request
for visible text or a tool call. Provider requests have a 120-second timeout;
streams are limited to 32 MiB.

## Chat context construction

The Chat system prompt explains artifacts, inline Mermaid, and the private web
tools. It then includes only the active parent-linked branch—not every message
stored in the conversation. This is why retry/regenerate excludes the replaced
assistant response: the selected branch ends at the original human message.

Message projection follows these rules:

- human and assistant text becomes ordinary OpenAI content;
- saved thinking blocks are deliberately omitted from future prompts;
- text attachments are embedded as `<attached_file>` blocks;
- binary attachments are represented by name, kind, and byte size; and
- prior artifacts are embedded as `<artifact>` blocks with their content.

The request advertises `artifacts`, `web_search`, and `visit_website` with
`tool_choice: "auto"`. The UI's low/medium/high reasoning choice is translated
to `reasoning_effort` plus `chat_template_kwargs.enable_thinking`; Off sends
zero reasoning budgets and disables thinking in those template arguments.

Both Chat and Code compact context automatically. When the estimated prompt
(system prompt, tools, and history at ~4 characters per token) crosses 75% of
the configured context window, the older part of the conversation is folded
into a model-written summary and only a recent tail (up to ~25% of the window)
is kept verbatim. The summary is produced by the same configured provider with
a dedicated summarization prompt, cached — per conversation branch in Chat and
per session transcript index in Code — and persisted, so later requests reuse
it instead of re-summarizing. Stored transcripts are never modified; only the
provider payload is compacted. In Code the compaction check also runs before
every model turn inside an agent loop, so long tool runs compact mid-run, and
the previous hard character budget remains as a fallback when summarization
fails. Compaction decisions are logged with `CLAUDE_TRACE_LOCAL_API=1` as
`[local-compaction]` lines.

Current Chat context limitations are important:

- The profile-level “Instructions for Claude” value is persisted for UI
  compatibility but is not currently injected into Chat provider requests.
- Web-tool calls/results are available during their current loop but are not
  preserved as structured tool history for later user turns.

## Code context construction

Code has a separate local-agent harness. Its system context contains:

- the coding-agent operating contract and full local tool schemas;
- the real operating system and selected workspace root;
- the rule that relative paths start in that root, explicitly rejecting
  `/home/user` and generic sandbox assumptions;
- additional granted roots;
- optional caller system prompt/append text;
- user and workspace `CLAUDE.md` files; and
- enabled skills, commands, and agent definitions from user/workspace
  customization directories.

Customization injection is capped at 64,000 characters. Visible user and
assistant transcript text is then selected newest-first within a conservative
budget of roughly `contextWindow * 3 * 70%` characters, leaving room for tool
schemas and the next answer. Saved reasoning is not replayed.

Code requests `stream: true` and translates OpenAI SSE into the Claude Agent SDK
event contract already consumed by the retained renderer. It emits
`message_start`, incremental `thinking_delta` and `text_delta` blocks, native
`tool_use` starts with `input_json_delta` fragments, block stops,
`message_delta`, and `message_stop`. The durable assistant transcript is written
only after the provider turn is complete, using the same message UUID as the
partial stream, so reloads contain complete messages rather than ephemeral
fragments. Non-streaming JSON responses remain supported for compatible servers.

OpenAI tool-call names and argument strings are accumulated by tool index across
arbitrarily fragmented deltas. Once a supported tool name is complete, its
native card and incoming JSON are streamed immediately; execution still waits
until the full arguments parse. During one agent run, every completed assistant
tool-call frame and `role: tool` result is sent back to the model, for at most
the configured agent-turn limit. On a later user message, context is rebuilt
from visible transcript text, so old structured tool calls/results are not
replayed.

If the provider rejects function tools, Code retries without schemas and asks
for a strict `<tool_call>` JSON wrapper. That fallback response is buffered until
complete so protocol markup never flashes in the chat. Tool authorization
happens after model selection and before execution; Accept edits and Bypass
permissions affect that local authorization layer, not the provider payload.

## Observed mixed-stream UI flow

With 180 ms intentionally inserted between mock deltas, the native probe
observed this representative progression:

| Approximate time | Visible state                         |
| ---------------: | ------------------------------------- |
|             0 ms | Empty assistant turn/loading state    |
|           745 ms | Thought process control appears       |
|         1,071 ms | First assistant text fragment appears |
|         1,716 ms | Second text fragment appears          |
|         2,024 ms | Final text fragment appears           |
|         2,389 ms | Sandboxed artifact frame opens        |
|         2,954 ms | Inline artifact card appears          |
|         3,058 ms | Turn reports completion               |

These numbers are diagnostic rather than performance targets. They show that
text is genuinely incremental, reasoning is intentionally held until text is
safe to display, and tool UI waits for complete tool arguments.
