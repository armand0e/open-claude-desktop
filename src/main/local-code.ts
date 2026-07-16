import {
  exec as execCallback,
  execFile as execFileCallback,
} from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import type { Dirent } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { shell } from "electron";
import { spawn as spawnPty, type IPty } from "node-pty";
import type { LocalProviderConfig } from "./local-backend";
import { BUILTIN_SKILL_NAMES, BUILTIN_SKILLS } from "./builtin-skills";
import { isPathInside } from "./file-access";
import { WEB_TOOLS, type WebToolRunner } from "./local-web-tools";

const execAsync = promisify(execCallback);
const execFileAsync = promisify(execFileCallback);

type JsonObject = Record<string, unknown>;
type PermissionMode =
  "default" | "acceptEdits" | "plan" | "bypassPermissions" | "dontAsk" | "auto";

interface ToolPermissionRequest {
  requestId: string;
  sessionId: string;
  toolName: string;
  description?: string;
  input?: JsonObject;
}

export interface CodeSession {
  sessionId: string;
  cwd: string;
  originCwd: string;
  isRunning: boolean;
  model?: string;
  effort?: string;
  createdAt: number;
  lastActivityAt: number;
  isArchived: boolean;
  title: string;
  homePath: string;
  folderExists: boolean;
  pendingToolPermissions: ToolPermissionRequest[];
  permissionMode: PermissionMode;
  rootDetected: boolean;
  additionalDirectories: string[];
  initialMessage?: string;
  error?: string;
  errorCategory?: string;
}

interface StoredCodeSession extends CodeSession {
  transcript: JsonObject[];
  artifacts: CodeArtifact[];
}

interface CodeArtifact {
  title: string;
  url: string;
  path: string;
  updatedAt: string;
  version: string;
}

interface CodeModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

interface CodeStore {
  version: 1;
  sessions: StoredCodeSession[];
}

type CustomizationKind = "skill" | "command" | "agent";
type CustomizationScope = "workspace" | "user";

interface ShellPtyRecord {
  readonly key: string;
  readonly sessionId: string;
  readonly pty: IPty;
  readonly exited: Promise<void>;
  readonly resolveExit: () => void;
  buffer: string;
  closed: boolean;
}

interface StartInfo {
  cwd: string;
  message: string;
  sessionId?: string;
  model?: string;
  title?: string;
  systemPrompt?: string;
  systemPromptAppend?: string;
  messageUuid?: string;
  permissionMode?: PermissionMode;
  effort?: string;
  additionalDirectories?: string[];
}

interface ToolCall {
  id: string;
  name: string;
  arguments: JsonObject;
}

interface ToolExecution {
  modelOutput: string;
  toolUseResult: unknown;
}

interface ModelTurn {
  text: string;
  reasoning?: string;
  toolCalls: ToolCall[];
  rawToolCalls?: JsonObject[];
  fallbackToolMode?: boolean;
  providerContent?: string;
  usage?: JsonObject;
}

interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonObject;
  };
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOOL_OUTPUT = 100_000;
const MAX_AGENT_TURNS = 24;
const MAX_PTY_BUFFER = 1024 * 1024;
const PERMISSION_MODES = new Set<PermissionMode>([
  "default",
  "acceptEdits",
  "plan",
  "bypassPermissions",
  "dontAsk",
  "auto",
]);

const CODE_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "Read",
      description:
        "Read a UTF-8 text file in the selected workspace. Use offset and limit for large files.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["file_path"],
        properties: {
          file_path: { type: "string" },
          offset: { type: "number", minimum: 1 },
          limit: { type: "number", minimum: 1, maximum: 5000 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "Write",
      description:
        "Create or completely replace a UTF-8 file inside the selected workspace.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["file_path", "content"],
        properties: {
          file_path: { type: "string" },
          content: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "Edit",
      description:
        "Replace an exact string in a UTF-8 workspace file. The old string must be unique unless replace_all is true.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["file_path", "old_string", "new_string"],
        properties: {
          file_path: { type: "string" },
          old_string: { type: "string" },
          new_string: { type: "string" },
          replace_all: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "Glob",
      description:
        "List workspace files matching a glob. Prefer patterns such as **/*.ts or src/**.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["pattern"],
        properties: {
          pattern: { type: "string" },
          path: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "Grep",
      description:
        "Search text in workspace files with ripgrep-compatible regular expressions.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["pattern"],
        properties: {
          pattern: { type: "string" },
          path: { type: "string" },
          glob: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "Bash",
      description:
        "Run a shell command in the selected workspace and return stdout, stderr, and exit code.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["command"],
        properties: {
          command: { type: "string" },
          timeout: { type: "number", minimum: 1000, maximum: 600000 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "Artifact",
      description:
        "Publish an existing Markdown or HTML workspace file into the desktop artifact surface, or list artifacts created in this workspace.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", enum: ["publish", "list"] },
          file_path: { type: "string" },
          favicon: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 100 },
          scope: { type: "string", enum: ["mine", "shared", "all"] },
          title: { type: "string" },
          description: { type: "string" },
          label: { type: "string" },
          url: { type: "string" },
          force: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mcp__desktop__present_artifact",
      description:
        "Create a durable artifact in the desktop Code workspace so the user can inspect or open it. Use for HTML, SVG, Markdown, Mermaid, React, reports, or substantial generated code.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["title", "content"],
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          type: {
            type: "string",
            enum: [
              "text/plain",
              "text/markdown",
              "text/html",
              "image/svg+xml",
              "application/vnd.ant.code",
              "application/vnd.ant.mermaid",
              "application/vnd.ant.react",
            ],
          },
          file_path: { type: "string" },
        },
      },
    },
  },
  ...WEB_TOOLS,
];

const CODE_SYSTEM_PROMPT = `You are a capable local coding agent embedded in a desktop Code UI. Work directly in the selected workspace and finish the user's task end to end. Inspect relevant files before editing, make focused changes, run proportionate verification, and report concrete outcomes. Use tools instead of guessing about workspace state. File tools are confined to selected roots. Bash may have broader effects, so keep commands scoped to the workspace. Use web_search and visit_website when current public web information is required; cite the returned URLs and distinguish source reliability. Use Artifact to publish an existing Markdown or HTML file, or mcp__desktop__present_artifact to create substantial visual or document output directly in the desktop workspace. Do not claim a command or edit succeeded unless its tool result says it did.`;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function reasoningRequest(effort: unknown): JsonObject {
  if (effort === "auto" || effort === undefined || effort === null) return {};
  if (effort === "off")
    return {
      thinking_budget_tokens: 0,
      reasoning_budget: 0,
      chat_template_kwargs: { enable_thinking: false },
    };
  if (["low", "medium", "high"].includes(String(effort)))
    return {
      reasoning_effort: effort,
      chat_template_kwargs: {
        enable_thinking: true,
        reasoning_effort: effort,
      },
    };
  return {};
}

function truncate(value: string, limit = MAX_TOOL_OUTPUT): string {
  return value.length <= limit
    ? value
    : `${value.slice(0, limit)}\n… output truncated (${value.length - limit} characters omitted)`;
}

function safeTitle(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 72) || "New Code session";
}

function publicSession(session: StoredCodeSession): CodeSession {
  const { transcript: _transcript, ...metadata } = session;
  return structuredClone(metadata);
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) =>
      isObject(block) && block.type === "text" ? stringValue(block.text) : "",
    )
    .filter(Boolean)
    .join("\n");
}

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function artifactExtension(type: string): string {
  const byType: Record<string, string> = {
    "text/plain": ".txt",
    "text/markdown": ".md",
    "text/html": ".html",
    "image/svg+xml": ".svg",
    "application/vnd.ant.code": ".txt",
    "application/vnd.ant.mermaid": ".mmd",
    "application/vnd.ant.react": ".tsx",
  };
  return byType[type] ?? ".md";
}

function artifactSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "artifact"
  );
}

function artifactId(sessionId: string, url: string): string {
  const hex = sha256(`${sessionId}\0${url}`).slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8).join(""),
    hex.slice(8, 12).join(""),
    hex.slice(12, 16).join(""),
    hex.slice(16, 20).join(""),
    hex.slice(20, 32).join(""),
  ].join("-");
}

function messageTimestamp(): string {
  return new Date().toISOString();
}

function localDateKey(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return localDateKey(new Date());
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function localDayNumber(value: string | number | Date): number {
  const date = value instanceof Date ? value : new Date(value);
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

function usageFromMessage(message: JsonObject): JsonObject {
  return isObject(message.usage) ? message.usage : {};
}

function userTranscriptMessage(
  sessionId: string,
  text: string,
  uuid: string = randomUUID(),
): JsonObject {
  return {
    type: "user",
    uuid,
    session_id: sessionId,
    sessionId,
    parent_tool_use_id: null,
    timestamp: messageTimestamp(),
    message: { role: "user", content: text },
  };
}

function assistantTranscriptMessage(
  sessionId: string,
  model: string,
  text: string,
  toolCalls: ToolCall[],
  usage: JsonObject = {},
  reasoning = "",
): JsonObject {
  const uuid = randomUUID();
  const timestamp = messageTimestamp();
  return {
    type: "assistant",
    uuid,
    session_id: sessionId,
    sessionId,
    parent_tool_use_id: null,
    timestamp,
    message: {
      id: uuid,
      type: "message",
      role: "assistant",
      model,
      content: [
        ...(reasoning
          ? [
              {
                type: "thinking",
                thinking: reasoning,
                signature: `local-openai:${randomUUID()}`,
                summaries: [],
                start_timestamp: timestamp,
                stop_timestamp: timestamp,
              },
            ]
          : []),
        ...(text ? [{ type: "text", text }] : []),
        ...toolCalls.map((call) => ({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.arguments,
        })),
      ],
      stop_reason: toolCalls.length > 0 ? "tool_use" : "end_turn",
      stop_sequence: null,
      usage: normalizedUsage(usage),
    },
  };
}

function toolResultTranscriptMessage(
  sessionId: string,
  call: ToolCall,
  execution: ToolExecution,
  isError: boolean,
  sourceAssistantUuid: string,
): JsonObject {
  return {
    type: "user",
    uuid: randomUUID(),
    session_id: sessionId,
    sessionId,
    parent_tool_use_id: null,
    sourceToolAssistantUUID: sourceAssistantUuid,
    timestamp: messageTimestamp(),
    message: {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: call.id,
          content: execution.modelOutput,
          is_error: isError,
        },
      ],
    },
    toolUseResult: execution.toolUseResult,
    tool_use_result: execution.toolUseResult,
  };
}

function normalizedUsage(usage: JsonObject = {}): JsonObject {
  return {
    input_tokens: numberValue(usage.input_tokens ?? usage.prompt_tokens, 0),
    output_tokens: numberValue(
      usage.output_tokens ?? usage.completion_tokens,
      0,
    ),
    cache_creation_input_tokens: numberValue(
      usage.cache_creation_input_tokens,
      0,
    ),
    cache_read_input_tokens: numberValue(usage.cache_read_input_tokens, 0),
  };
}

function resultTranscriptMessage(
  sessionId: string,
  result: string,
  startedAt: number,
  turns: number,
  isError = false,
): JsonObject {
  const base: JsonObject = {
    type: "result",
    subtype: isError ? "error_during_execution" : "success",
    uuid: randomUUID(),
    session_id: sessionId,
    sessionId,
    is_error: isError,
    duration_ms: Date.now() - startedAt,
    duration_api_ms: Date.now() - startedAt,
    num_turns: turns,
    stop_reason: isError ? null : "end_turn",
    total_cost_usd: 0,
    usage: normalizedUsage(),
    modelUsage: {},
    permission_denials: [],
  };
  return isError ? { ...base, errors: [result] } : { ...base, result };
}

function structuredPatch(before: string, after: string): JsonObject[] {
  const oldLines = before ? before.split(/\r?\n/) : [];
  const newLines = after ? after.split(/\r?\n/) : [];
  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  )
    prefix += 1;
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] ===
      newLines[newLines.length - 1 - suffix]
  )
    suffix += 1;
  const contextBefore = Math.min(3, prefix);
  const contextAfter = Math.min(3, suffix);
  const oldStartIndex = prefix - contextBefore;
  const oldEndIndex = oldLines.length - suffix + contextAfter;
  const newEndIndex = newLines.length - suffix + contextAfter;
  return [
    {
      oldStart: oldStartIndex + 1,
      oldLines: oldEndIndex - oldStartIndex,
      newStart: oldStartIndex + 1,
      newLines: newEndIndex - oldStartIndex,
      lines: [
        ...oldLines.slice(oldStartIndex, prefix).map((line) => ` ${line}`),
        ...oldLines
          .slice(prefix, oldLines.length - suffix)
          .map((line) => `-${line}`),
        ...newLines
          .slice(prefix, newLines.length - suffix)
          .map((line) => `+${line}`),
        ...newLines
          .slice(newLines.length - suffix, newEndIndex)
          .map((line) => ` ${line}`),
      ],
    },
  ];
}

function fallbackToolCalls(text: string): ToolCall[] {
  const candidates: unknown[] = [];
  const tagged = text.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/i);
  if (tagged) {
    try {
      candidates.push(JSON.parse(tagged[1]));
    } catch {
      // Invalid fallback syntax is treated as ordinary assistant text.
    }
  }
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (isObject(parsed) && Array.isArray(parsed.tool_calls))
        candidates.push(...parsed.tool_calls);
      else candidates.push(parsed);
    } catch {
      // Ordinary JSON in an answer is not necessarily a tool call.
    }
  }
  return candidates.flatMap((candidate) => {
    if (!isObject(candidate)) return [];
    const fn = isObject(candidate.function) ? candidate.function : candidate;
    const name = stringValue(fn.name);
    if (!name) return [];
    let args: unknown = fn.arguments ?? candidate.arguments ?? candidate.input;
    if (typeof args === "string") {
      try {
        args = JSON.parse(args);
      } catch {
        args = {};
      }
    }
    return [
      {
        id: stringValue(candidate.id) || `tool_${randomUUID()}`,
        name,
        arguments: isObject(args) ? args : {},
      },
    ];
  });
}

export class LocalCodeSessionManager {
  readonly filePath: string;
  readonly #provider: () => LocalProviderConfig | null;
  readonly #emitEvent: (event: JsonObject) => void;
  readonly #emitPermission: (request: ToolPermissionRequest) => void;
  readonly #webTools?: WebToolRunner;
  readonly #sessions = new Map<string, StoredCodeSession>();
  readonly #controllers = new Map<string, AbortController>();
  readonly #queues = new Map<string, Promise<void>>();
  readonly #permissionResolvers = new Map<string, (decision: string) => void>();
  readonly #approvedTools = new Map<string, Set<string>>();
  readonly #providerToolSupport = new Map<string, boolean>();
  readonly #shellPtys = new Map<string, ShellPtyRecord>();
  #writeChain = Promise.resolve();

  private constructor(
    filePath: string,
    provider: () => LocalProviderConfig | null,
    emitEvent: (event: JsonObject) => void,
    emitPermission: (request: ToolPermissionRequest) => void,
    webTools?: WebToolRunner,
  ) {
    this.filePath = filePath;
    this.#provider = provider;
    this.#emitEvent = emitEvent;
    this.#emitPermission = emitPermission;
    this.#webTools = webTools;
  }

  static async create(
    userDataPath: string,
    provider: () => LocalProviderConfig | null,
    emitEvent: (event: JsonObject) => void,
    emitPermission: (request: ToolPermissionRequest) => void,
    webTools?: WebToolRunner,
  ): Promise<LocalCodeSessionManager> {
    const manager = new LocalCodeSessionManager(
      path.join(userDataPath, "local-code-sessions.json"),
      provider,
      emitEvent,
      emitPermission,
      webTools,
    );
    try {
      const parsed: unknown = JSON.parse(
        await readFile(manager.filePath, "utf8"),
      );
      if (isObject(parsed) && Array.isArray(parsed.sessions)) {
        for (const candidate of parsed.sessions) {
          if (!isObject(candidate)) continue;
          const sessionId = stringValue(candidate.sessionId);
          const cwd = stringValue(candidate.cwd);
          if (!sessionId || !cwd) continue;
          const session = candidate as unknown as StoredCodeSession;
          session.isRunning = false;
          session.pendingToolPermissions = [];
          session.transcript = Array.isArray(candidate.transcript)
            ? (candidate.transcript as JsonObject[])
            : [];
          session.artifacts = Array.isArray(candidate.artifacts)
            ? (candidate.artifacts.filter(
                isObject,
              ) as unknown as CodeArtifact[])
            : [];
          manager.#sessions.set(sessionId, session);
        }
      }
    } catch {
      // First run or a corrupt store starts with an empty, recoverable history.
    }
    await manager.seedBuiltinSkills();
    return manager;
  }

  async invoke(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case "start":
        return this.start(args[0]);
      case "sendMessage":
        return this.sendMessage(args[0], args[1]);
      case "getAll":
        return this.getAll();
      case "getSession":
        return this.getSession(args[0]);
      case "getTranscript":
        return this.getTranscript(args[0]);
      case "interrupt":
      case "stop":
      case "stopTask":
        return this.stop(args[0]);
      case "respondToToolPermission":
        return this.respondToToolPermission(args[0], args[1]);
      case "getDefaultPermissionMode":
        return "acceptEdits";
      case "getPermissionMode":
        return this.session(args[0])?.permissionMode ?? "acceptEdits";
      case "setPermissionMode":
        return this.setPermissionMode(args[0], args[1]);
      case "getDefaultEffort":
        return "medium";
      case "getEffort":
        return this.session(args[0])?.effort ?? "medium";
      case "setEffort":
        return this.updateField(args[0], "effort", args[1]);
      case "setModel":
        return this.updateField(args[0], "model", args[1]);
      case "changeCwd":
        return this.changeCwd(args[0], args[1]);
      case "addDirectories":
        return this.addDirectories(args[0], args[1]);
      case "archive":
        return this.archive(args[0], true);
      case "unarchive":
        return this.archive(args[0], false);
      case "delete":
        return this.delete(args[0]);
      case "clearSession":
        return this.clear(args[0]);
      case "updateSession":
        return this.updateSession(args[0], args[1]);
      case "searchSessions":
        return this.searchSessions(args[0]);
      case "getDetectedProjects":
        return this.getDetectedProjects();
      case "checkTrust":
        return { trusted: true, sources: ["user_selected"] };
      case "saveTrust":
        return undefined;
      case "readSessionFile":
        return this.readSessionFile(args[0], args[1]);
      case "readFileAtCwd":
        return this.readFileAtCwd(args[0], args[1]);
      case "readSessionImageAsDataUrl":
      case "readSessionMediaAsDataUrl":
      case "readSessionPanelMediaAsDataUrl":
        return this.readSessionDataUrl(args[0], args[1]);
      case "writeSessionFile":
        return this.writeSessionFile(args[0], args[1], args[2], args[3]);
      case "resolveSessionFile":
        return this.resolveSessionFile(args[0], args[1]);
      case "listSessionDirectory":
        return this.listSessionDirectory(args[0], args[1]);
      case "runBashCommand":
        return this.runBashCommand(args[0], args[1]);
      case "startPty":
        return false;
      case "stopPty":
      case "resizePty":
      case "writePty":
        return undefined;
      case "startShellPty":
        return this.startShellPty(args[0], args[1], args[2]);
      case "stopShellPty":
        return this.stopShellPty(args[0]);
      case "resizeShellPty":
        return this.resizeShellPty(args[0], args[1], args[2]);
      case "writeShellPty":
        return this.writeShellPty(args[0], args[1]);
      case "getShellPtyBuffer":
        return this.getShellPtyBuffer(args[0]);
      case "getBusyShellPtyKeys":
        return this.getBusyShellPtyKeys(args[0]);
      case "getGitInfo":
        return this.getGitInfo(args[0]);
      case "getGitDiff":
        return this.getGitDiff(args[0], args[1], args[2], args[3]);
      case "getGitDiffStats":
        return this.getGitDiffStats(args[0], args[1], args[2]);
      case "getWorkingTreeStatus":
        return this.getWorkingTreeStatus(args[0]);
      case "getUncommittedChanges":
        return this.getUncommittedChanges(args[0]);
      case "isWorkingTreeDirty":
        return this.isWorkingTreeDirty(args[0]);
      case "getLocalBranches":
        return this.getLocalBranches(args[0]);
      case "getGitCommits":
        return this.getGitCommits(args[0], args[1], args[2]);
      case "getLocalMcpServers":
      case "getInstalledEditors":
      case "getSSHConfigs":
      case "getTrustedSSHHosts":
      case "listWslDistros":
      case "getBackgroundTaskSuggestions":
        return [];
      case "getAgents":
        return this.getAgents();
      case "getSupportedCommands":
        return this.getSupportedCommands(args[0]);
      case "checkGhAvailable":
        return this.commandAvailable("gh");
      case "isVSCodeInstalled":
        return this.commandAvailable("code");
      case "openInVSCode":
        return this.openEditor(args[0], "vscode", undefined);
      case "openInEditor":
        return this.openEditor(args[0], args[1], args[3]);
      case "getContextUsage":
        return this.getContextUsage(args[0]);
      case "getPlanForSession":
      case "getPeriodUsage":
        return null;
      case "getCodeStats":
        return this.getCodeStats();
      case "getAllArtifacts":
        return this.getAllArtifacts();
      case "readArtifact":
        return this.readArtifact(args[0], args[1]);
      case "readArtifactById":
        return this.readArtifactById(args[0]);
      case "deleteArtifactById":
        return this.deleteArtifactById(args[0]);
      case "getCustomization":
        return this.getCustomization(args[0]);
      case "saveCustomization":
        return this.saveCustomization(args[0]);
      case "deleteCustomization":
        return this.deleteCustomization(args[0]);
      case "listLocalSkills":
        return this.listLocalSkills();
      case "saveLocalSkill":
        return this.saveLocalSkill(args[0], args[1], args[2], args[3]);
      case "deleteLocalSkill":
        return this.deleteLocalSkill(args[0]);
      case "getLocalSkillFiles":
        return this.getLocalSkillFiles(args[0]);
      case "setLocalSkillEnabled":
        return this.setLocalSkillEnabled(args[0], args[1]);
      case "revealLocalSkill":
        return this.revealLocalSkill(args[0]);
      case "syncSkills":
        return this.listLocalSkills();
      case "setFocusedSession":
      case "setAvailableCodeModels":
      case "setFastMode":
      case "setMcpServers":
      case "replaceEnabledMcpTools":
      case "replaceRemoteMcpServers":
      case "applyFlagSettings":
      case "warmSession":
      case "reportComposerInp":
      case "reportStreamRender":
      case "reportSwitchTiming":
      case "logCliEvent":
        return undefined;
      default:
        return this.safeDefault(method);
    }
  }

  private async persist(): Promise<void> {
    const store: CodeStore = {
      version: 1,
      sessions: [...this.#sessions.values()],
    };
    const serialized = `${JSON.stringify(store, null, 2)}\n`;
    this.#writeChain = this.#writeChain.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${randomUUID()}.tmp`;
      await writeFile(temporary, serialized, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, this.filePath);
    });
    await this.#writeChain;
  }

  private session(value: unknown): StoredCodeSession | undefined {
    return typeof value === "string" ? this.#sessions.get(value) : undefined;
  }

  private emit(sessionId: string, event: Omit<JsonObject, "sessionId">): void {
    this.#emitEvent({ ...event, sessionId });
  }

  private append(session: StoredCodeSession, message: JsonObject): void {
    const previous = session.transcript.at(-1);
    if (!("parentUuid" in message))
      message.parentUuid = stringValue(previous?.uuid) || null;
    if (!("sessionId" in message)) message.sessionId = session.sessionId;
    if (!("isSidechain" in message)) message.isSidechain = false;
    session.transcript.push(message);
    session.lastActivityAt = Date.now();
    this.emit(session.sessionId, { type: "message", message });
  }

  private async start(input: unknown): Promise<{ sessionId: string }> {
    if (!isObject(input)) throw new Error("Code session details are required");
    const info = input as unknown as StartInfo;
    if (!info.cwd || !info.message)
      throw new Error("A workspace folder and message are required");
    const cwd = path.resolve(info.cwd);
    const cwdInfo = await stat(cwd);
    if (!cwdInfo.isDirectory()) throw new Error("Workspace is not a directory");
    const now = Date.now();
    const sessionId = info.sessionId || randomUUID();
    const provider = this.#provider();
    const session: StoredCodeSession = {
      sessionId,
      cwd,
      originCwd: cwd,
      isRunning: false,
      model: info.model || provider?.model || "local-model",
      effort: info.effort || "medium",
      createdAt: now,
      lastActivityAt: now,
      isArchived: false,
      title: info.title || safeTitle(info.message),
      homePath: os.homedir(),
      folderExists: true,
      pendingToolPermissions: [],
      permissionMode: PERMISSION_MODES.has(info.permissionMode ?? "acceptEdits")
        ? (info.permissionMode ?? "acceptEdits")
        : "acceptEdits",
      rootDetected: true,
      additionalDirectories: (info.additionalDirectories ?? []).map((entry) =>
        path.resolve(entry),
      ),
      initialMessage: info.message,
      transcript: [],
      artifacts: [],
    };
    this.#sessions.set(sessionId, session);
    const userMessage = userTranscriptMessage(
      sessionId,
      info.message,
      info.messageUuid,
    );
    this.append(session, userMessage);
    await this.persist();
    this.emit(sessionId, { type: "start", session: publicSession(session) });
    // Native Desktop navigates to the newly returned session ID after this IPC
    // call. Claude Code process startup normally provides this margin; the
    // in-process local harness must preserve it explicitly so the first model
    // and permission frames are observed instead of only recovered on reload.
    setTimeout(() => {
      if (this.#sessions.get(sessionId) === session)
        this.enqueue(
          session,
          info.message,
          info.systemPrompt,
          info.systemPromptAppend,
        );
    }, 750);
    return { sessionId };
  }

  private async sendMessage(
    sessionId: unknown,
    message: unknown,
  ): Promise<void> {
    const session = this.session(sessionId);
    if (!session) throw new Error("Code session was not found");
    if (typeof message !== "string" || !message.trim())
      throw new Error("Message is required");
    const userMessage = userTranscriptMessage(session.sessionId, message);
    this.append(session, userMessage);
    await this.persist();
    this.enqueue(session, message);
  }

  private enqueue(
    session: StoredCodeSession,
    prompt: string,
    systemPrompt?: string,
    systemPromptAppend?: string,
  ): void {
    const prior = this.#queues.get(session.sessionId) ?? Promise.resolve();
    const next = prior
      .catch(() => undefined)
      .then(() =>
        this.runAgent(session, prompt, systemPrompt, systemPromptAppend),
      );
    this.#queues.set(session.sessionId, next);
    void next.finally(() => {
      if (this.#queues.get(session.sessionId) === next)
        this.#queues.delete(session.sessionId);
    });
  }

  private async runAgent(
    session: StoredCodeSession,
    _prompt: string,
    systemPrompt?: string,
    systemPromptAppend?: string,
  ): Promise<void> {
    const provider = this.#provider();
    const startedAt = Date.now();
    let turns = 0;
    let finalText = "";
    if (!provider) {
      await this.finishWithError(
        session,
        "No local model provider is configured. Configure the OpenAI-compatible endpoint in Settings.",
        startedAt,
        turns,
      );
      return;
    }
    const controller = new AbortController();
    this.#controllers.set(session.sessionId, controller);
    session.isRunning = true;
    delete session.error;
    delete session.errorCategory;
    this.emit(session.sessionId, {
      type: "session_updated",
      session: publicSession(session),
    });
    this.emit(session.sessionId, {
      type: "initialization_status",
      initializationStatus: {
        step: "model",
        message: `Connecting to ${provider.model}`,
        isComplete: false,
      },
    });
    await this.persist();

    const localCustomization = await this.localCustomizationPrompt(session);
    const messages = this.providerHistory(
      session,
      systemPrompt,
      systemPromptAppend,
      localCustomization,
    );
    let emptyTurns = 0;
    try {
      for (; turns < MAX_AGENT_TURNS; turns += 1) {
        const turn = await this.modelTurn(
          provider,
          session,
          messages,
          controller.signal,
        );
        if (turns === 0)
          this.emit(session.sessionId, {
            type: "initialization_status",
            initializationStatus: {
              step: "model",
              message: `Connected to ${provider.model}`,
              isComplete: true,
            },
          });
        if (!turn.text.trim() && turn.toolCalls.length === 0) {
          emptyTurns += 1;
          if (emptyTurns > 2)
            throw new Error(
              "Provider returned no assistant content after three attempts",
            );
          messages.push({
            role: "user",
            content:
              "Your previous turn contained reasoning but no visible answer or tool call. Continue the unfinished task now. Call the next required tool, or provide the final answer if all work is complete.",
          });
          continue;
        }
        emptyTurns = 0;
        finalText = turn.text || finalText;
        const assistant = assistantTranscriptMessage(
          session.sessionId,
          session.model || provider.model,
          turn.text,
          turn.toolCalls,
          turn.usage,
          turn.reasoning,
        );
        this.append(session, assistant);
        messages.push(
          turn.fallbackToolMode && turn.toolCalls.length > 0
            ? {
                role: "assistant",
                content: turn.providerContent || "Requested a local tool.",
              }
            : {
                role: "assistant",
                content: turn.text || null,
                ...(turn.rawToolCalls && turn.rawToolCalls.length > 0
                  ? { tool_calls: turn.rawToolCalls }
                  : {}),
              },
        );
        await this.persist();

        if (turn.toolCalls.length === 0) break;
        for (const call of turn.toolCalls) {
          let execution: ToolExecution;
          let isError = false;
          try {
            await this.authorizeTool(session, call);
            execution = await this.executeTool(
              session,
              call,
              controller.signal,
            );
          } catch (error) {
            isError = true;
            const message =
              error instanceof Error ? error.message : String(error);
            execution = {
              modelOutput: message,
              toolUseResult: { error: message },
            };
          }
          execution.modelOutput = truncate(execution.modelOutput);
          const toolResult = toolResultTranscriptMessage(
            session.sessionId,
            call,
            execution,
            isError,
            stringValue(assistant.uuid),
          );
          this.append(session, toolResult);
          messages.push(
            turn.fallbackToolMode
              ? {
                  role: "user",
                  content: `Tool result for ${call.name}:\n${execution.modelOutput}`,
                }
              : {
                  role: "tool",
                  tool_call_id: call.id,
                  name: call.name,
                  content: execution.modelOutput,
                },
          );
          await this.persist();
        }
      }
      if (turns >= MAX_AGENT_TURNS)
        throw new Error(`Agent stopped after ${MAX_AGENT_TURNS} tool turns`);
      const result = resultTranscriptMessage(
        session.sessionId,
        finalText,
        startedAt,
        turns + 1,
      );
      this.append(session, result);
      session.isRunning = false;
      this.emit(session.sessionId, {
        type: "transcript_loaded",
        messages: structuredClone(session.transcript),
      });
      this.emit(session.sessionId, {
        type: "session_updated",
        session: publicSession(session),
      });
      await this.persist();
    } catch (error) {
      const message = controller.signal.aborted
        ? "Generation interrupted"
        : error instanceof Error
          ? error.message
          : String(error);
      await this.finishWithError(session, message, startedAt, turns);
    } finally {
      if (this.#controllers.get(session.sessionId) === controller)
        this.#controllers.delete(session.sessionId);
    }
  }

  private providerHistory(
    session: StoredCodeSession,
    systemPrompt?: string,
    systemPromptAppend?: string,
    localCustomization?: string,
  ): JsonObject[] {
    const workspaceContext = [
      "<workspace_context>",
      `Operating system: ${process.platform}`,
      `Current workspace root: ${session.cwd}`,
      "All relative file paths and shell commands start in that workspace. Never assume /home/user, /workspace, or another generic sandbox path. Prefer workspace-relative paths in tool calls.",
      session.additionalDirectories.length
        ? `Additional allowed roots: ${session.additionalDirectories.join(", ")}`
        : "Additional allowed roots: none",
      "</workspace_context>",
    ].join("\n");
    const messages: JsonObject[] = [
      {
        role: "system",
        content: [
          CODE_SYSTEM_PROMPT,
          workspaceContext,
          localCustomization,
          systemPrompt,
          systemPromptAppend,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ];
    for (const item of session.transcript) {
      if (item.type === "user" && isObject(item.message)) {
        const content = item.message.content;
        if (typeof content === "string")
          messages.push({ role: "user", content });
      } else if (item.type === "assistant" && isObject(item.message)) {
        const text = contentText(item.message.content);
        if (text) messages.push({ role: "assistant", content: text });
      }
    }
    return [messages[0], ...messages.slice(1).slice(-79)];
  }

  private async localCustomizationPrompt(
    session: StoredCodeSession,
  ): Promise<string> {
    try {
      const result = await this.getCustomization(session.cwd);
      const localSkillState = await this.readLocalSkillState();
      const entries = Array.isArray(result.entries)
        ? result.entries.filter(
            (entry) =>
              isObject(entry) &&
              !(
                entry.kind === "skill" &&
                entry.scope === "user" &&
                localSkillState[stringValue(entry.name)] === false
              ),
          )
        : [];
      const instructionFiles: Array<{ path: string; content: string }> = [];
      for (const file of [
        path.join(this.userCustomizationRoot(), "CLAUDE.md"),
        path.join(session.cwd, "CLAUDE.md"),
        path.join(session.cwd, ".claude", "CLAUDE.md"),
      ]) {
        try {
          instructionFiles.push({
            path: file,
            content: await readFile(file, "utf8"),
          });
        } catch {
          // Instruction files are optional.
        }
      }
      if (entries.length === 0 && instructionFiles.length === 0) return "";
      const sections: string[] = [
        "Local customization is enabled. Apply the following workspace/user instructions when they are relevant. A command named X is invoked when the user's message starts with /X. An agent entry is a role specification, not a separate cloud worker; follow that role directly when asked.",
      ];
      let remaining = 64_000;
      for (const instruction of instructionFiles) {
        const section = `<local-instructions path=${JSON.stringify(instruction.path)}>\n${instruction.content}\n</local-instructions>`;
        if (section.length > remaining) break;
        sections.push(section);
        remaining -= section.length;
      }
      for (const entry of entries) {
        const content = stringValue(entry.content);
        const header = `<local-${stringValue(entry.kind)} name=${JSON.stringify(stringValue(entry.name))} scope=${JSON.stringify(stringValue(entry.scope))}>`;
        const footer = `</local-${stringValue(entry.kind)}>`;
        const section = `${header}\n${content}\n${footer}`;
        if (section.length > remaining) break;
        sections.push(section);
        remaining -= section.length;
      }
      return sections.join("\n\n");
    } catch {
      return "";
    }
  }

  private async modelTurn(
    provider: LocalProviderConfig,
    session: StoredCodeSession,
    messages: JsonObject[],
    signal: AbortSignal,
  ): Promise<ModelTurn> {
    const request = async (withTools: boolean): Promise<Response> =>
      fetch(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          ...(provider.apiKey
            ? { Authorization: `Bearer ${provider.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: session.model || provider.model,
          stream: false,
          messages: withTools
            ? messages
            : [
                ...messages,
                {
                  role: "system",
                  content: `This endpoint does not accept OpenAI function tools. To call one, reply only with <tool_call>{"name":"Read","arguments":{"file_path":"README.md"}}</tool_call>. Available tool JSON schemas: ${JSON.stringify(CODE_TOOLS.map((tool) => tool.function))}`,
                },
              ],
          ...(withTools ? { tools: CODE_TOOLS, tool_choice: "auto" } : {}),
          ...reasoningRequest(session.effort),
        }),
      });

    const providerKey = provider.baseUrl.replace(/\/$/, "");
    let withTools = this.#providerToolSupport.get(providerKey) !== false;
    let response = await request(withTools);
    if ([400, 404, 405, 415, 422].includes(response.status)) {
      await response.body?.cancel().catch(() => undefined);
      withTools = false;
      this.#providerToolSupport.set(providerKey, false);
      response = await request(false);
    }
    if (!response.ok) {
      const detail = truncate(await response.text(), 2000);
      throw new Error(
        `Model provider returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }
    const body: unknown = await response.json();
    if (
      !isObject(body) ||
      !Array.isArray(body.choices) ||
      !isObject(body.choices[0])
    )
      throw new Error("Model provider returned an invalid chat completion");
    const message = isObject(body.choices[0].message)
      ? body.choices[0].message
      : {};
    const text = contentText(message.content);
    const reasoning =
      stringValue(message.reasoning_content || message.reasoning) ||
      (Array.isArray(message.reasoning_details)
        ? message.reasoning_details
            .flatMap((detail) => {
              if (typeof detail === "string") return [detail];
              if (!isObject(detail)) return [];
              return [
                stringValue(
                  detail.text ||
                    detail.content ||
                    detail.reasoning ||
                    detail.summary,
                ),
              ];
            })
            .filter(Boolean)
            .join("")
        : "");
    const rawCalls = Array.isArray(message.tool_calls)
      ? message.tool_calls.filter(isObject)
      : [];
    const toolCalls = withTools
      ? rawCalls.flatMap((raw): ToolCall[] => {
          const fn = isObject(raw.function) ? raw.function : {};
          const name = stringValue(fn.name);
          if (!name) return [];
          let parsed: unknown = fn.arguments;
          if (typeof parsed === "string") {
            try {
              parsed = JSON.parse(parsed);
            } catch {
              parsed = {};
            }
          }
          return [
            {
              id: stringValue(raw.id) || `tool_${randomUUID()}`,
              name,
              arguments: isObject(parsed) ? parsed : {},
            },
          ];
        })
      : fallbackToolCalls(text);
    if (withTools) this.#providerToolSupport.set(providerKey, true);
    return {
      text: toolCalls.length > 0 && !withTools ? "" : text,
      ...(reasoning ? { reasoning } : {}),
      toolCalls,
      ...(rawCalls.length > 0 ? { rawToolCalls: rawCalls } : {}),
      ...(!withTools ? { fallbackToolMode: true, providerContent: text } : {}),
      usage: isObject(body.usage) ? body.usage : {},
    };
  }

  private async finishWithError(
    session: StoredCodeSession,
    message: string,
    startedAt: number,
    turns: number,
  ): Promise<void> {
    session.isRunning = false;
    session.error = message;
    session.errorCategory = "local_agent";
    const result = resultTranscriptMessage(
      session.sessionId,
      message,
      startedAt,
      turns,
      true,
    );
    this.append(session, result);
    this.emit(session.sessionId, {
      type: "transcript_loaded",
      messages: structuredClone(session.transcript),
    });
    this.emit(session.sessionId, {
      type: "error",
      error: message,
      errorCategory: "local_agent",
    });
    this.emit(session.sessionId, {
      type: "session_updated",
      session: publicSession(session),
    });
    await this.persist();
  }

  private permissionRequired(
    session: StoredCodeSession,
    toolName: string,
  ): boolean {
    if (
      session.permissionMode === "bypassPermissions" ||
      session.permissionMode === "auto"
    )
      return false;
    if (this.#approvedTools.get(session.sessionId)?.has(toolName)) return false;
    const mutating = new Set([
      "Write",
      "Edit",
      "Bash",
      "Artifact",
      "mcp__desktop__present_artifact",
    ]);
    if (!mutating.has(toolName)) return false;
    if (session.permissionMode === "acceptEdits") return toolName === "Bash";
    return true;
  }

  private async authorizeTool(
    session: StoredCodeSession,
    call: ToolCall,
  ): Promise<void> {
    if (!this.permissionRequired(session, call.name)) return;
    if (
      session.permissionMode === "dontAsk" ||
      session.permissionMode === "plan"
    )
      throw new Error(
        `${call.name} is blocked in ${session.permissionMode} mode`,
      );
    // Fast local providers can request a tool before the packaged renderer has
    // committed the assistant row and armed its session-scoped permission
    // listener. Preserve the small handoff delay that a subprocess normally
    // introduces.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const request: ToolPermissionRequest = {
      requestId: randomUUID(),
      sessionId: session.sessionId,
      toolName: call.name,
      description: this.toolDescription(call),
      input: call.arguments,
    };
    const decisionPromise = new Promise<string>((resolve) => {
      this.#permissionResolvers.set(request.requestId, resolve);
    });
    session.pendingToolPermissions.push(request);
    this.#emitPermission(request);
    this.emit(session.sessionId, { type: "tool_permission_request", request });
    this.emit(session.sessionId, {
      type: "session_updated",
      session: publicSession(session),
    });
    await this.persist();
    const decision = await decisionPromise;
    session.pendingToolPermissions = session.pendingToolPermissions.filter(
      (candidate) => candidate.requestId !== request.requestId,
    );
    this.emit(session.sessionId, { type: "tool_permission_resolved", request });
    await this.persist();
    if (/^(always|allowAlways)$/i.test(decision)) {
      const approved =
        this.#approvedTools.get(session.sessionId) ?? new Set<string>();
      approved.add(call.name);
      this.#approvedTools.set(session.sessionId, approved);
    }
    if (!/^(once|always|allow|approve|accept|yes)/i.test(decision))
      throw new Error(`User denied ${call.name}`);
    // The permission sheet changes the active transcript subscription. Give the
    // renderer one animation frame to settle before publishing the tool result.
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  private toolDescription(call: ToolCall): string {
    if (call.name === "Bash")
      return truncate(stringValue(call.arguments.command), 240);
    if (call.name === "Write" || call.name === "Edit")
      return `Modify ${stringValue(call.arguments.file_path)}`;
    if (call.name === "Artifact")
      return `${stringValue(call.arguments.action) || "Publish"} artifact: ${stringValue(call.arguments.file_path) || stringValue(call.arguments.title)}`;
    if (call.name === "mcp__desktop__present_artifact")
      return `Create artifact: ${stringValue(call.arguments.title)}`;
    if (call.name === "web_search")
      return `Search the web: ${stringValue(call.arguments.query)}`;
    if (call.name === "visit_website")
      return `Read webpage: ${stringValue(call.arguments.url)}`;
    return call.name;
  }

  private respondToToolPermission(requestId: unknown, decision: unknown): void {
    if (typeof requestId !== "string" || typeof decision !== "string") return;
    const resolve = this.#permissionResolvers.get(requestId);
    if (!resolve) return;
    this.#permissionResolvers.delete(requestId);
    // Resolve after this IPC call has returned so Desktop can arm the resumed
    // turn before a fast local command emits its first completion frame.
    setTimeout(() => resolve(decision), 0);
  }

  private async executeTool(
    session: StoredCodeSession,
    call: ToolCall,
    signal: AbortSignal,
  ): Promise<ToolExecution> {
    switch (call.name) {
      case "Read":
        return this.toolRead(session, call.arguments);
      case "Write":
        return this.toolWrite(session, call.arguments);
      case "Edit":
        return this.toolEdit(session, call.arguments);
      case "Glob":
        return this.toolGlob(session, call.arguments);
      case "Grep":
        return this.toolGrep(session, call.arguments, signal);
      case "Bash":
        return this.toolBash(session, call.arguments, signal);
      case "Artifact":
        return this.toolSdkArtifact(session, call.arguments);
      case "mcp__desktop__present_artifact":
        return this.toolArtifact(session, call.arguments);
      case "web_search":
      case "visit_website": {
        if (!this.#webTools)
          throw new Error("Local web tools are not available in this runtime");
        const modelOutput = await this.#webTools.execute(
          call.name,
          call.arguments,
          signal,
        );
        return {
          modelOutput,
          toolUseResult: {
            name: call.name,
            input: call.arguments,
            output: modelOutput,
          },
        };
      }
      default:
        throw new Error(`Unknown tool: ${call.name}`);
    }
  }

  private roots(session: StoredCodeSession): string[] {
    return [session.cwd, ...session.additionalDirectories].map((root) =>
      path.resolve(root),
    );
  }

  private lexicalPath(session: StoredCodeSession, input: unknown): string {
    if (typeof input !== "string" || !input || input.includes("\0"))
      throw new Error("A valid file path is required");
    // Some OpenAI-compatible coding models have a learned `/home/user`
    // sandbox default. Treat only that exact placeholder root as the selected
    // local workspace; every other outside absolute path remains denied.
    const normalized = /^\/home\/user(?:\/|$)/u.test(input)
      ? input.replace(/^\/home\/user\/?/u, "") || "."
      : input;
    const candidate = path.resolve(session.cwd, normalized);
    if (!this.roots(session).some((root) => isPathInside(root, candidate)))
      throw new Error("Path is outside the selected workspace roots");
    return candidate;
  }

  private async securePath(
    session: StoredCodeSession,
    input: unknown,
    write = false,
  ): Promise<string> {
    const candidate = this.lexicalPath(session, input);
    const roots = await Promise.all(
      this.roots(session).map((root) => realpath(root).catch(() => root)),
    );
    const canonical = write
      ? path.join(
          await realpath(path.dirname(candidate)),
          path.basename(candidate),
        )
      : await realpath(candidate);
    if (!roots.some((root) => isPathInside(root, canonical)))
      throw new Error("Resolved path escapes the selected workspace roots");
    return candidate;
  }

  private async toolRead(
    session: StoredCodeSession,
    input: JsonObject,
  ): Promise<ToolExecution> {
    const file = await this.securePath(session, input.file_path);
    const info = await stat(file);
    if (!info.isFile()) throw new Error("Path is not a regular file");
    if (info.size > MAX_FILE_BYTES)
      throw new Error("File exceeds the 10 MiB tool limit");
    const lines = (await readFile(file, "utf8")).split(/\r?\n/);
    const offset = Math.max(1, Math.floor(numberValue(input.offset, 1)));
    const limit = Math.min(
      5000,
      Math.max(1, Math.floor(numberValue(input.limit, 2000))),
    );
    const selected = lines.slice(offset - 1, offset - 1 + limit);
    const modelOutput = selected
      .map((line, index) => `${offset + index}\t${line}`)
      .join("\n");
    return {
      modelOutput,
      toolUseResult: {
        type: "text",
        file: {
          filePath: file,
          content: selected.join("\n"),
          numLines: selected.length,
          startLine: offset,
          totalLines: lines.length,
        },
      },
    };
  }

  private async toolWrite(
    session: StoredCodeSession,
    input: JsonObject,
  ): Promise<ToolExecution> {
    const content = stringValue(input.content);
    const lexical = this.lexicalPath(session, input.file_path);
    await mkdir(path.dirname(lexical), { recursive: true });
    const file = await this.securePath(session, input.file_path, true);
    const originalFile = await readFile(file, "utf8").catch(() => null);
    await writeFile(file, content, "utf8");
    this.emitFsFile(session, file);
    return {
      modelOutput: `Wrote ${Buffer.byteLength(content)} bytes to ${path.relative(session.cwd, file)}`,
      toolUseResult: {
        type: originalFile === null ? "create" : "update",
        filePath: file,
        content,
        structuredPatch: structuredPatch(originalFile ?? "", content),
        originalFile,
        userModified: false,
      },
    };
  }

  private async toolEdit(
    session: StoredCodeSession,
    input: JsonObject,
  ): Promise<ToolExecution> {
    const file = await this.securePath(session, input.file_path);
    const before = await readFile(file, "utf8");
    const oldString = stringValue(input.old_string);
    const newString = stringValue(input.new_string);
    if (!oldString) throw new Error("old_string must not be empty");
    const matches = before.split(oldString).length - 1;
    if (matches === 0) throw new Error("old_string was not found");
    if (matches > 1 && input.replace_all !== true)
      throw new Error(
        `old_string matched ${matches} times; provide more context or set replace_all`,
      );
    const after =
      input.replace_all === true
        ? before.split(oldString).join(newString)
        : before.replace(oldString, newString);
    await writeFile(file, after, "utf8");
    this.emitFsFile(session, file);
    return {
      modelOutput: `Updated ${path.relative(session.cwd, file)} (${input.replace_all === true ? matches : 1} replacement${matches === 1 ? "" : "s"})`,
      toolUseResult: {
        filePath: file,
        oldString,
        newString,
        originalFile: before,
        structuredPatch: structuredPatch(before, after),
        userModified: false,
        replaceAll: input.replace_all === true,
      },
    };
  }

  private async toolGlob(
    session: StoredCodeSession,
    input: JsonObject,
  ): Promise<ToolExecution> {
    const root = input.path
      ? await this.securePath(session, input.path)
      : session.cwd;
    const pattern = stringValue(input.pattern) || "**/*";
    const startedAt = Date.now();
    let modelOutput: string;
    try {
      const { stdout } = await execFileAsync(
        "rg",
        ["--files", "--hidden", "-g", pattern, "-g", "!.git", root],
        { windowsHide: true, maxBuffer: MAX_TOOL_OUTPUT * 2 },
      );
      modelOutput = truncate(stdout.trim());
    } catch (error) {
      const stdout = isObject(error) ? stringValue(error.stdout) : "";
      modelOutput = stdout
        ? truncate(stdout.trim())
        : await this.walkFiles(root, pattern);
    }
    const filenames = modelOutput.split(/\r?\n/).filter(Boolean);
    return {
      modelOutput,
      toolUseResult: {
        durationMs: Date.now() - startedAt,
        numFiles: filenames.length,
        filenames,
        truncated: filenames.length >= 5000,
        totalMatches: filenames.length,
        countIsComplete: filenames.length < 5000,
      },
    };
  }

  private async walkFiles(root: string, pattern: string): Promise<string> {
    const suffix = pattern.startsWith("**/*.") ? pattern.slice(4) : "";
    const output: string[] = [];
    const queue = [root];
    while (queue.length > 0 && output.length < 5000) {
      const directory = queue.shift()!;
      const entries = await readdir(directory, { withFileTypes: true }).catch(
        () => [],
      );
      for (const entry of entries) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        const candidate = path.join(directory, entry.name);
        if (entry.isDirectory()) queue.push(candidate);
        else if (!suffix || entry.name.endsWith(suffix))
          output.push(path.relative(root, candidate));
      }
    }
    return output.join("\n");
  }

  private async toolGrep(
    session: StoredCodeSession,
    input: JsonObject,
    signal: AbortSignal,
  ): Promise<ToolExecution> {
    const root = input.path
      ? await this.securePath(session, input.path)
      : session.cwd;
    const args = ["-n", "--hidden", "--glob", "!.git", "--max-count", "2000"];
    if (stringValue(input.glob)) args.push("--glob", stringValue(input.glob));
    args.push("--", stringValue(input.pattern), root);
    let modelOutput: string;
    try {
      const { stdout, stderr } = await execFileAsync("rg", args, {
        windowsHide: true,
        maxBuffer: MAX_TOOL_OUTPUT * 2,
        signal,
      });
      modelOutput = truncate(stdout || stderr || "No matches");
    } catch (error) {
      if (isObject(error) && numberValue(error.code, 1) === 1) {
        modelOutput = "No matches";
      } else {
        const stdout = isObject(error) ? stringValue(error.stdout) : "";
        const stderr = isObject(error) ? stringValue(error.stderr) : "";
        if (!stdout && !stderr) throw error;
        modelOutput = truncate(`${stdout}${stderr}`);
      }
    }
    const content = modelOutput === "No matches" ? "" : modelOutput;
    const matchedLines = content.split(/\r?\n/).filter(Boolean);
    return {
      modelOutput,
      toolUseResult: {
        mode: "content",
        numFiles: 0,
        filenames: [],
        content,
        numLines: matchedLines.length,
        numMatches: matchedLines.length,
      },
    };
  }

  private async toolBash(
    session: StoredCodeSession,
    input: JsonObject,
    signal: AbortSignal,
  ): Promise<ToolExecution> {
    const command = stringValue(input.command);
    if (!command) throw new Error("command is required");
    const timeout = Math.min(
      600_000,
      Math.max(1000, numberValue(input.timeout, 120_000)),
    );
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: session.cwd,
        windowsHide: true,
        timeout,
        maxBuffer: MAX_TOOL_OUTPUT * 2,
        signal,
        shell: process.platform === "win32" ? process.env.ComSpec : "/bin/sh",
      });
      return {
        modelOutput: truncate(
          `Exit code: 0\n${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`,
        ),
        toolUseResult: {
          stdout: truncate(stdout),
          stderr: truncate(stderr),
          interrupted: false,
          isImage: false,
        },
      };
    } catch (error) {
      const stdout = isObject(error) ? stringValue(error.stdout) : "";
      const stderr = isObject(error) ? stringValue(error.stderr) : "";
      const code = isObject(error) ? (error.code ?? 1) : 1;
      return {
        modelOutput: truncate(
          `Exit code: ${String(code)}\n${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`,
        ),
        toolUseResult: {
          stdout: truncate(stdout),
          stderr: truncate(stderr),
          interrupted: signal.aborted,
          isImage: false,
        },
      };
    }
  }

  private async toolArtifact(
    session: StoredCodeSession,
    input: JsonObject,
  ): Promise<ToolExecution> {
    const title = stringValue(input.title) || "Artifact";
    const type = stringValue(input.type) || "text/markdown";
    const relative =
      stringValue(input.file_path) ||
      path.join(
        ".claude-artifacts",
        `${artifactSlug(title)}${artifactExtension(type)}`,
      );
    const lexical = this.lexicalPath(session, relative);
    await mkdir(path.dirname(lexical), { recursive: true });
    const file = await this.securePath(session, relative, true);
    await writeFile(file, stringValue(input.content), "utf8");
    this.emitFsFile(session, file);
    const result = {
      success: true,
      title,
      type,
      path: file,
      url: pathToFileURL(file).toString(),
      desktopArtifact: true,
      instruction: "The artifact is available in the workspace file preview.",
    };
    const version = sha256(stringValue(input.content)).slice(0, 12);
    session.artifacts = [
      ...session.artifacts.filter((artifact) => artifact.url !== result.url),
      {
        title,
        url: result.url,
        path: file,
        updatedAt: new Date().toISOString(),
        version,
      },
    ];
    return { modelOutput: JSON.stringify(result), toolUseResult: result };
  }

  private async toolSdkArtifact(
    session: StoredCodeSession,
    input: JsonObject,
  ): Promise<ToolExecution> {
    if (stringValue(input.action) === "list") {
      const limit = Math.max(
        1,
        Math.min(100, Math.floor(numberValue(input.limit, 25))),
      );
      const result = {
        artifacts: session.artifacts
          .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, limit)
          .map((artifact) => ({
            title: artifact.title,
            url: artifact.url,
            updatedAt: artifact.updatedAt,
            rel: "mine",
          })),
        scope: "mine",
        truncated: session.artifacts.length > limit,
      };
      return { modelOutput: JSON.stringify(result), toolUseResult: result };
    }

    const file = await this.securePath(session, input.file_path);
    const extension = path.extname(file).toLowerCase();
    if (
      extension !== ".html" &&
      extension !== ".md" &&
      extension !== ".markdown"
    )
      throw new Error(
        "Artifact publishes only Markdown or HTML workspace files",
      );
    const contents = await readFile(file, "utf8");
    const title =
      stringValue(input.title) ||
      contents.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      path.basename(file, extension);
    const requestedUrl = stringValue(input.url);
    const existing = requestedUrl
      ? session.artifacts.find((artifact) => artifact.url === requestedUrl)
      : session.artifacts.find((artifact) => artifact.path === file);
    const url = existing?.url || pathToFileURL(file).toString();
    const version = sha256(contents).slice(0, 12);
    const artifact: CodeArtifact = {
      title,
      url,
      path: file,
      updatedAt: new Date().toISOString(),
      version,
    };
    session.artifacts = [
      ...session.artifacts.filter((candidate) => candidate.url !== url),
      artifact,
    ];
    this.emitFsFile(session, file);
    const result = {
      url,
      path: file,
      title,
      version,
      contract: "local-desktop-artifact-v1",
      updated: Boolean(existing),
    };
    return { modelOutput: JSON.stringify(result), toolUseResult: result };
  }

  private emitFsFile(session: StoredCodeSession, file: string): void {
    this.emit(session.sessionId, {
      type: "fs_file",
      fsFile: {
        hostPath: file,
        fileName: path.basename(file),
        timestamp: Date.now(),
      },
    });
  }

  private getAll(): CodeSession[] {
    return [...this.#sessions.values()]
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      .map(publicSession);
  }

  private getCodeStats(): JsonObject {
    const activity = new Map<
      string,
      {
        date: string;
        sessionCount: number;
        messageCount: number;
        toolCallCount: number;
      }
    >();
    const dailyTokens = new Map<string, Record<string, number>>();
    const modelUsage: Record<string, CodeModelUsage> = {};
    const messageHours = Array.from({ length: 24 }, () => 0);

    const day = (date: string) => {
      let entry = activity.get(date);
      if (!entry) {
        entry = { date, sessionCount: 0, messageCount: 0, toolCallCount: 0 };
        activity.set(date, entry);
      }
      return entry;
    };

    for (const session of this.#sessions.values()) {
      day(localDateKey(session.createdAt)).sessionCount += 1;
      for (const event of session.transcript) {
        const timestamp = stringValue(event.timestamp);
        const eventDate = localDateKey(timestamp || session.lastActivityAt);
        const eventHour = new Date(
          timestamp || session.lastActivityAt,
        ).getHours();
        const message = isObject(event.message) ? event.message : null;
        if (!message) continue;

        if (event.type === "user" && typeof message.content === "string") {
          day(eventDate).messageCount += 1;
          if (Number.isInteger(eventHour)) messageHours[eventHour] += 1;
          continue;
        }
        if (event.type !== "assistant") continue;
        day(eventDate).messageCount += 1;
        const content = Array.isArray(message.content) ? message.content : [];
        day(eventDate).toolCallCount += content.filter(
          (block) => isObject(block) && block.type === "tool_use",
        ).length;

        const usage = usageFromMessage(message);
        const inputTokens = numberValue(usage.input_tokens, 0);
        const outputTokens = numberValue(usage.output_tokens, 0);
        const cacheReadInputTokens = numberValue(
          usage.cache_read_input_tokens,
          0,
        );
        const cacheCreationInputTokens = numberValue(
          usage.cache_creation_input_tokens,
          0,
        );
        const model =
          stringValue(message.model) || session.model || "local-model";
        const aggregate = (modelUsage[model] ??= {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
        });
        aggregate.inputTokens += inputTokens;
        aggregate.outputTokens += outputTokens;
        aggregate.cacheReadInputTokens += cacheReadInputTokens;
        aggregate.cacheCreationInputTokens += cacheCreationInputTokens;
        const tokensByModel = dailyTokens.get(eventDate) ?? {};
        tokensByModel[model] =
          (tokensByModel[model] ?? 0) +
          inputTokens +
          outputTokens +
          cacheReadInputTokens +
          cacheCreationInputTokens;
        dailyTokens.set(eventDate, tokensByModel);
      }
    }

    const activeDays = [...activity.values()]
      .filter((entry) => entry.messageCount > 0)
      .map((entry) => localDayNumber(`${entry.date}T12:00:00`))
      .sort((a, b) => a - b);
    const uniqueDays = [...new Set(activeDays)];
    let longestStreak = 0;
    let runningStreak = 0;
    let previousDay: number | undefined;
    for (const activeDay of uniqueDays) {
      runningStreak = previousDay === activeDay - 1 ? runningStreak + 1 : 1;
      longestStreak = Math.max(longestStreak, runningStreak);
      previousDay = activeDay;
    }
    const activeDaySet = new Set(uniqueDays);
    const today = localDayNumber(new Date());
    let cursor = activeDaySet.has(today) ? today : today - 1;
    let currentStreak = 0;
    while (activeDaySet.has(cursor)) {
      currentStreak += 1;
      cursor -= 1;
    }
    let peakActivityHour: number | null = null;
    const peakCount = Math.max(...messageHours);
    if (peakCount > 0) peakActivityHour = messageHours.indexOf(peakCount);

    return {
      dailyActivity: [...activity.values()].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
      dailyModelTokens: [...dailyTokens.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, tokensByModel]) => ({ date, tokensByModel })),
      modelUsage,
      streaks: { currentStreak, longestStreak },
      peakActivityHour,
    };
  }

  private getContextUsage(sessionId: unknown): JsonObject | undefined {
    const session = this.session(sessionId);
    if (!session) return undefined;
    const rawMaxTokens = this.#provider()?.contextWindow ?? 128_000;
    const assistants = session.transcript.filter(
      (event) => event.type === "assistant" && isObject(event.message),
    );
    const latestMessage = assistants.at(-1)?.message;
    const latestUsage = isObject(latestMessage)
      ? usageFromMessage(latestMessage)
      : {};
    let totalTokens =
      numberValue(latestUsage.input_tokens, 0) +
      numberValue(latestUsage.output_tokens, 0) +
      numberValue(latestUsage.cache_read_input_tokens, 0) +
      numberValue(latestUsage.cache_creation_input_tokens, 0);
    if (totalTokens === 0) {
      const characters = session.transcript.reduce((sum, event) => {
        if (!isObject(event.message)) return sum;
        return sum + contentText(event.message.content).length;
      }, 0);
      totalTokens = Math.ceil(characters / 4);
    }
    totalTokens = Math.min(totalTokens, rawMaxTokens);
    return {
      rawMaxTokens,
      totalTokens,
      percentage: rawMaxTokens > 0 ? (totalTokens / rawMaxTokens) * 100 : 0,
      categories: [
        { name: "Conversation", tokens: totalTokens },
        { name: "Free space", tokens: Math.max(0, rawMaxTokens - totalTokens) },
      ],
      mcpTools: [],
      memoryFiles: [],
      agents: [],
    };
  }

  private getAllArtifacts(): JsonObject[] {
    return [...this.#sessions.values()]
      .flatMap((session) =>
        session.artifacts.map((artifact) => ({
          ...artifact,
          id: artifactId(session.sessionId, artifact.url),
          sessionId: session.sessionId,
          sessionTitle: session.title,
          cwd: session.cwd,
        })),
      )
      .sort((a, b) =>
        stringValue(b.updatedAt).localeCompare(stringValue(a.updatedAt)),
      );
  }

  private async readArtifact(
    sessionId: unknown,
    artifactUrl: unknown,
  ): Promise<JsonObject | null> {
    const session = this.session(sessionId);
    if (!session || typeof artifactUrl !== "string") return null;
    const artifact = session.artifacts.find(
      (candidate) => candidate.url === artifactUrl,
    );
    if (!artifact) return null;
    const extension = path.extname(artifact.path).toLowerCase();
    const typeByExtension: Record<string, string> = {
      ".htm": "text/html",
      ".html": "text/html",
      ".md": "text/markdown",
      ".mmd": "application/vnd.ant.mermaid",
      ".svg": "image/svg+xml",
      ".tsx": "application/vnd.ant.react",
    };
    return {
      ...artifact,
      sessionId: session.sessionId,
      sessionTitle: session.title,
      cwd: session.cwd,
      type: typeByExtension[extension] ?? "text/plain",
      content: await readFile(artifact.path, "utf8"),
    };
  }

  private async readArtifactById(id: unknown): Promise<JsonObject | null> {
    if (typeof id !== "string") return null;
    for (const session of this.#sessions.values()) {
      const artifact = session.artifacts.find(
        (candidate) => artifactId(session.sessionId, candidate.url) === id,
      );
      if (artifact) return this.readArtifact(session.sessionId, artifact.url);
    }
    return null;
  }

  private async deleteArtifactById(id: unknown): Promise<boolean> {
    if (typeof id !== "string") return false;
    for (const session of this.#sessions.values()) {
      const next = session.artifacts.filter(
        (candidate) => artifactId(session.sessionId, candidate.url) !== id,
      );
      if (next.length === session.artifacts.length) continue;
      session.artifacts = next;
      await this.persist();
      return true;
    }
    return false;
  }

  private customizationRoot(cwd: string, scope: CustomizationScope): string {
    return scope === "user"
      ? this.userCustomizationRoot()
      : path.join(cwd, ".claude");
  }

  private userCustomizationRoot(): string {
    return path.join(path.dirname(this.filePath), ".claude");
  }

  private localSkillStatePath(): string {
    return path.join(this.userCustomizationRoot(), "skill-state.json");
  }

  private async readLocalSkillState(): Promise<Record<string, boolean>> {
    try {
      const parsed: unknown = JSON.parse(
        await readFile(this.localSkillStatePath(), "utf8"),
      );
      if (!isObject(parsed)) return {};
      return Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
        ),
      );
    } catch {
      return {};
    }
  }

  private async writeLocalSkillState(
    state: Record<string, boolean>,
  ): Promise<void> {
    const target = this.localSkillStatePath();
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, target);
  }

  private localSkillPath(nameValue: unknown): string {
    const name = stringValue(nameValue).trim();
    return this.customizationPath(
      path.dirname(this.filePath),
      "user",
      "skill",
      name,
    );
  }

  private async listLocalSkills(): Promise<JsonObject[]> {
    const root = path.join(this.userCustomizationRoot(), "skills");
    const enabled = await this.readLocalSkillState();
    let entries: Dirent<string>[] = [];
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      return [];
    }
    const skills: JsonObject[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(root, entry.name, "SKILL.md");
      try {
        const [content, details] = await Promise.all([
          readFile(skillMd, "utf8"),
          stat(skillMd),
        ]);
        skills.push({
          skillId: entry.name,
          name: entry.name,
          description: this.customizationDescription(content),
          updatedAt: details.mtime.toISOString(),
          enabled: enabled[entry.name] !== false,
          builtIn: BUILTIN_SKILL_NAMES.has(entry.name),
        });
      } catch {
        // Ignore incomplete skill directories.
      }
    }
    return skills.sort((a, b) =>
      stringValue(a.name).localeCompare(stringValue(b.name)),
    );
  }

  private async saveLocalSkill(
    nameValue: unknown,
    _description: unknown,
    skillMdValue: unknown,
    overwriteValue: unknown,
  ): Promise<JsonObject> {
    const file = this.localSkillPath(nameValue);
    const content = stringValue(skillMdValue);
    if (!content.trim()) return { ok: false, error: "Skill content is empty" };
    if (Buffer.byteLength(content, "utf8") > 1024 * 1024)
      return { ok: false, error: "Skill files are limited to 1 MiB" };
    const exists = await stat(file).then(
      () => true,
      () => false,
    );
    if (exists && overwriteValue !== true)
      return { ok: false, error: "already_exists" };
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, { encoding: "utf8", mode: 0o600 });
    const state = await this.readLocalSkillState();
    if (!(stringValue(nameValue) in state)) {
      state[stringValue(nameValue)] = true;
      await this.writeLocalSkillState(state);
    }
    return { ok: true };
  }

  private async seedBuiltinSkills(): Promise<void> {
    for (const skill of BUILTIN_SKILLS) {
      const file = this.localSkillPath(skill.name);
      const exists = await stat(file).then(
        () => true,
        () => false,
      );
      if (exists) {
        const existingContent = await readFile(file, "utf8").catch(() => "");
        const existingHash = createHash("sha256")
          .update(existingContent)
          .digest("hex");
        if (!skill.legacyContentHashes?.includes(existingHash)) continue;
      }
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, skill.content, {
        encoding: "utf8",
        mode: 0o600,
      });
    }
  }

  private async deleteLocalSkill(nameValue: unknown): Promise<JsonObject> {
    const file = this.localSkillPath(nameValue);
    const name = stringValue(nameValue).trim();
    await rm(path.dirname(file), { recursive: true, force: true });
    const state = await this.readLocalSkillState();
    delete state[name];
    await this.writeLocalSkillState(state);
    return { ok: true };
  }

  private async getLocalSkillFiles(nameValue: unknown): Promise<JsonObject[]> {
    const file = this.localSkillPath(nameValue);
    const root = path.dirname(file);
    const files: JsonObject[] = [];
    const visit = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) await visit(absolute);
        else if (entry.isFile()) {
          const details = await stat(absolute);
          if (details.size > 1024 * 1024) continue;
          files.push({
            path: path.relative(root, absolute).replaceAll("\\", "/"),
            content: await readFile(absolute, "utf8"),
          });
        }
      }
    };
    try {
      await visit(root);
    } catch {
      return [];
    }
    return files.sort((a, b) =>
      stringValue(a.path).localeCompare(stringValue(b.path)),
    );
  }

  private async setLocalSkillEnabled(
    nameValue: unknown,
    enabledValue: unknown,
  ): Promise<JsonObject> {
    const name = stringValue(nameValue).trim();
    this.localSkillPath(name);
    const state = await this.readLocalSkillState();
    state[name] = enabledValue !== false;
    await this.writeLocalSkillState(state);
    return { ok: true };
  }

  private async revealLocalSkill(nameValue: unknown): Promise<void> {
    shell.showItemInFolder(this.localSkillPath(nameValue));
  }

  private customizationPath(
    cwd: string,
    scope: CustomizationScope,
    kind: CustomizationKind,
    name: string,
  ): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name))
      throw new Error(
        "Names may contain letters, numbers, dots, underscores, and dashes",
      );
    const root = this.customizationRoot(cwd, scope);
    const directory = path.join(root, `${kind}s`);
    return kind === "skill"
      ? path.join(directory, name, "SKILL.md")
      : path.join(directory, `${name}.md`);
  }

  private async validateCustomizationCwd(value: unknown): Promise<string> {
    if (typeof value !== "string" || !value.trim())
      throw new Error("Select a workspace folder first");
    const cwd = path.resolve(value);
    if (!(await stat(cwd)).isDirectory())
      throw new Error("Workspace is not a directory");
    return cwd;
  }

  private async getCustomization(cwdValue: unknown): Promise<JsonObject> {
    const cwd = await this.validateCustomizationCwd(cwdValue);
    const entries: JsonObject[] = [];
    for (const scope of ["workspace", "user"] as const) {
      const root = this.customizationRoot(cwd, scope);
      for (const kind of ["skill", "command", "agent"] as const) {
        const directory = path.join(root, `${kind}s`);
        let names: string[] = [];
        try {
          names = (await readdir(directory, { withFileTypes: true })).flatMap(
            (entry) => {
              if (kind === "skill" && entry.isDirectory()) return [entry.name];
              if (
                kind !== "skill" &&
                entry.isFile() &&
                entry.name.endsWith(".md")
              )
                return [entry.name.slice(0, -3)];
              return [];
            },
          );
        } catch {
          // Missing customization directories are normal on a new workspace.
        }
        for (const name of names.sort((a, b) => a.localeCompare(b))) {
          const file = this.customizationPath(cwd, scope, kind, name);
          try {
            entries.push({
              kind,
              scope,
              name,
              path: file,
              content: await readFile(file, "utf8"),
            });
          } catch {
            // Ignore partially removed or unreadable entries.
          }
        }
      }
    }
    return { cwd, entries };
  }

  private async saveCustomization(input: unknown): Promise<JsonObject> {
    if (!isObject(input)) throw new Error("Customization details are required");
    const cwd = await this.validateCustomizationCwd(input.cwd);
    const kind = input.kind;
    const scope = input.scope;
    const name = stringValue(input.name).trim();
    const content = stringValue(input.content);
    if (!(["skill", "command", "agent"] as unknown[]).includes(kind))
      throw new Error("Unsupported customization kind");
    if (!(["workspace", "user"] as unknown[]).includes(scope))
      throw new Error("Unsupported customization scope");
    if (!content.trim()) throw new Error("Content cannot be empty");
    if (Buffer.byteLength(content, "utf8") > 1024 * 1024)
      throw new Error("Customization files are limited to 1 MiB");
    const file = this.customizationPath(
      cwd,
      scope as CustomizationScope,
      kind as CustomizationKind,
      name,
    );
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, { encoding: "utf8", mode: 0o600 });
    return { ok: true, cwd, kind, scope, name, path: file };
  }

  private async deleteCustomization(input: unknown): Promise<JsonObject> {
    if (!isObject(input)) throw new Error("Customization details are required");
    const cwd = await this.validateCustomizationCwd(input.cwd);
    const kind = input.kind;
    const scope = input.scope;
    const name = stringValue(input.name).trim();
    if (!(["skill", "command", "agent"] as unknown[]).includes(kind))
      throw new Error("Unsupported customization kind");
    if (!(["workspace", "user"] as unknown[]).includes(scope))
      throw new Error("Unsupported customization scope");
    const file = this.customizationPath(
      cwd,
      scope as CustomizationScope,
      kind as CustomizationKind,
      name,
    );
    await rm(kind === "skill" ? path.dirname(file) : file, {
      recursive: kind === "skill",
      force: true,
    });
    return { ok: true };
  }

  private customizationDescription(content: string): string {
    return (
      content.match(/^description:\s*["']?(.+?)["']?\s*$/im)?.[1]?.trim() ||
      content
        .replace(/^---[\s\S]*?---\s*/m, "")
        .split(/\r?\n/)
        .find((line) => line.trim() && !line.trim().startsWith("#"))
        ?.trim() ||
      "Local customization"
    );
  }

  private async getAgents(): Promise<JsonObject[]> {
    const roots = new Set<string>([
      process.cwd(),
      ...[...this.#sessions.values()].map((session) => session.cwd),
    ]);
    const agents = new Map<string, JsonObject>();
    for (const cwd of roots) {
      try {
        const result = await this.getCustomization(cwd);
        const entries = Array.isArray(result.entries)
          ? result.entries.filter(isObject)
          : [];
        for (const entry of entries) {
          if (entry.kind !== "agent") continue;
          const key = `${stringValue(entry.scope)}:${stringValue(entry.name)}`;
          agents.set(key, {
            source: "user",
            name: stringValue(entry.name),
            description: this.customizationDescription(
              stringValue(entry.content),
            ),
            path: stringValue(entry.path),
          });
        }
      } catch {
        // Ignore workspaces that disappeared since their last session.
      }
    }
    return [...agents.values()];
  }

  private async getSupportedCommands(input: unknown): Promise<JsonObject[]> {
    const details = isObject(input) ? input : {};
    const session = this.session(details.sessionId);
    const cwdValue = stringValue(details.cwd) || session?.cwd;
    if (!cwdValue) return [];
    try {
      const result = await this.getCustomization(cwdValue);
      const entries = Array.isArray(result.entries)
        ? result.entries.filter(isObject)
        : [];
      return entries.flatMap((entry) => {
        if (entry.kind !== "command" && entry.kind !== "skill") return [];
        return [
          {
            name: stringValue(entry.name),
            description: this.customizationDescription(
              stringValue(entry.content),
            ),
            argumentHint: "[arguments]",
            aliases: [],
            scope: "code",
            source: stringValue(entry.scope),
          },
        ];
      });
    } catch {
      return [];
    }
  }

  private getSession(sessionId: unknown): CodeSession | null {
    const session = this.session(sessionId);
    return session ? publicSession(session) : null;
  }

  private async getTranscript(sessionId: unknown): Promise<JsonObject[]> {
    // A result message is appended synchronously before its atomic store write
    // finishes. Do not let restart-sensitive callers observe that message until
    // the corresponding persistence queue has reached disk.
    await this.#writeChain;
    return structuredClone(this.session(sessionId)?.transcript ?? []);
  }

  private async stop(sessionId: unknown): Promise<void> {
    const session = this.session(sessionId);
    if (!session) return;
    this.#controllers.get(session.sessionId)?.abort();
    for (const request of session.pendingToolPermissions) {
      const resolve = this.#permissionResolvers.get(request.requestId);
      this.#permissionResolvers.delete(request.requestId);
      resolve?.("deny");
    }
    session.pendingToolPermissions = [];
    session.isRunning = false;
    this.emit(session.sessionId, {
      type: "stopped",
      session: publicSession(session),
    });
    await this.persist();
  }

  private async setPermissionMode(
    sessionId: unknown,
    mode: unknown,
  ): Promise<boolean> {
    const session = this.session(sessionId);
    if (
      !session ||
      typeof mode !== "string" ||
      !PERMISSION_MODES.has(mode as PermissionMode)
    )
      return false;
    session.permissionMode = mode as PermissionMode;
    this.emit(session.sessionId, {
      type: "permission_mode_changed",
      permissionMode: session.permissionMode,
      session: publicSession(session),
    });
    await this.persist();
    return true;
  }

  private async updateField(
    sessionId: unknown,
    field: "model" | "effort",
    value: unknown,
  ): Promise<void> {
    const session = this.session(sessionId);
    if (!session || typeof value !== "string") return;
    session[field] = value;
    this.emit(session.sessionId, {
      type: "session_updated",
      session: publicSession(session),
    });
    await this.persist();
  }

  private async changeCwd(
    sessionId: unknown,
    cwd: unknown,
  ): Promise<CodeSession | JsonObject> {
    const session = this.session(sessionId);
    if (!session || typeof cwd !== "string") return { ok: false };
    const resolved = path.resolve(cwd);
    if (!(await stat(resolved)).isDirectory())
      throw new Error("Workspace is not a directory");
    session.cwd = resolved;
    session.folderExists = true;
    this.emit(session.sessionId, {
      type: "session_updated",
      session: publicSession(session),
    });
    await this.persist();
    return publicSession(session);
  }

  private async addDirectories(
    sessionId: unknown,
    directories: unknown,
  ): Promise<boolean> {
    const session = this.session(sessionId);
    if (!session || !Array.isArray(directories)) return false;
    const added = directories
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => path.resolve(entry));
    session.additionalDirectories = [
      ...new Set([...session.additionalDirectories, ...added]),
    ];
    this.emit(session.sessionId, {
      type: "session_updated",
      session: publicSession(session),
    });
    await this.persist();
    return true;
  }

  private async archive(sessionId: unknown, archived: boolean): Promise<void> {
    const session = this.session(sessionId);
    if (!session) return;
    session.isArchived = archived;
    this.emit(session.sessionId, {
      type: archived ? "archived" : "unarchived",
      session: publicSession(session),
    });
    await this.persist();
  }

  private async delete(sessionId: unknown): Promise<void> {
    if (typeof sessionId !== "string") return;
    await this.stop(sessionId);
    for (const record of [...this.#shellPtys.values()]) {
      if (record.sessionId === sessionId) await this.stopShellPty(record.key);
    }
    this.#sessions.delete(sessionId);
    this.emit(sessionId, { type: "deleted" });
    await this.persist();
  }

  private async clear(sessionId: unknown): Promise<void> {
    const session = this.session(sessionId);
    if (!session) return;
    session.transcript = [];
    this.emit(session.sessionId, {
      type: "cleared",
      hasPreClearSession: false,
    });
    await this.persist();
  }

  private async updateSession(
    sessionId: unknown,
    update: unknown,
  ): Promise<void> {
    const session = this.session(sessionId);
    if (!session || !isObject(update)) return;
    if (typeof update.title === "string") session.title = update.title;
    if (typeof update.isStarred === "boolean")
      (session as unknown as JsonObject).isStarred = update.isStarred;
    this.emit(session.sessionId, {
      type: "session_updated",
      session: publicSession(session),
    });
    await this.persist();
  }

  private searchSessions(query: unknown): JsonObject[] {
    const normalized =
      typeof query === "string"
        ? query.toLowerCase()
        : isObject(query) && typeof query.query === "string"
          ? query.query.toLowerCase()
          : "";
    return [...this.#sessions.values()]
      .filter(
        (session) =>
          !normalized ||
          session.title.toLowerCase().includes(normalized) ||
          session.cwd.toLowerCase().includes(normalized),
      )
      .map((session) => ({
        sessionId: session.sessionId,
        snippet: session.title,
        lastActivityAt: session.lastActivityAt,
      }));
  }

  private getDetectedProjects(): JsonObject[] {
    const seen = new Set<string>();
    return [...this.#sessions.values()]
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      .filter((session) => {
        const key =
          process.platform === "win32"
            ? session.cwd.toLowerCase()
            : session.cwd;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 20)
      .map((session) => ({
        path: session.cwd,
        name: path.basename(session.cwd),
        lastActivity: session.lastActivityAt,
      }));
  }

  private async resolveSessionFile(
    sessionId: unknown,
    filePath: unknown,
  ): Promise<string | null> {
    const session = this.session(sessionId);
    if (!session) return null;
    try {
      return await this.securePath(session, filePath);
    } catch {
      return null;
    }
  }

  private async readSessionFile(
    sessionId: unknown,
    filePath: unknown,
  ): Promise<JsonObject | null> {
    const session = this.session(sessionId);
    if (!session) return null;
    try {
      const absPath = await this.securePath(session, filePath);
      const buffer = await readFile(absPath);
      if (buffer.byteLength > MAX_FILE_BYTES) return null;
      const contents = buffer.toString("utf8");
      return { contents, absPath, hash: sha256(buffer) };
    } catch {
      return null;
    }
  }

  private async readSessionDataUrl(
    sessionId: unknown,
    filePath: unknown,
  ): Promise<string | null> {
    const session = this.session(sessionId);
    if (!session) return null;
    try {
      const absPath = await this.securePath(session, filePath);
      const buffer = await readFile(absPath);
      if (buffer.byteLength > 50 * 1024 * 1024) return null;
      const mimeTypes: Record<string, string> = {
        ".avif": "image/avif",
        ".gif": "image/gif",
        ".jpeg": "image/jpeg",
        ".jpg": "image/jpeg",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".mp3": "audio/mpeg",
        ".mp4": "video/mp4",
        ".wav": "audio/wav",
        ".webm": "video/webm",
      };
      const mime =
        mimeTypes[path.extname(absPath).toLowerCase()] ??
        "application/octet-stream";
      return `data:${mime};base64,${buffer.toString("base64")}`;
    } catch {
      return null;
    }
  }

  private async readFileAtCwd(
    cwd: unknown,
    filePath: unknown,
  ): Promise<JsonObject | null> {
    if (typeof cwd !== "string") return null;
    const temporary: StoredCodeSession = {
      sessionId: "temporary",
      cwd: path.resolve(cwd),
      originCwd: path.resolve(cwd),
      isRunning: false,
      createdAt: 0,
      lastActivityAt: 0,
      isArchived: false,
      title: "",
      homePath: os.homedir(),
      folderExists: true,
      pendingToolPermissions: [],
      permissionMode: "acceptEdits",
      rootDetected: true,
      additionalDirectories: [],
      transcript: [],
      artifacts: [],
    };
    try {
      const absPath = await this.securePath(temporary, filePath);
      const contents = await readFile(absPath, "utf8");
      return { contents, absPath, hash: sha256(contents) };
    } catch {
      return null;
    }
  }

  private async writeSessionFile(
    sessionId: unknown,
    filePath: unknown,
    contents: unknown,
    expectedHash: unknown,
  ): Promise<JsonObject | null> {
    const session = this.session(sessionId);
    if (!session || typeof contents !== "string") return null;
    try {
      const lexical = this.lexicalPath(session, filePath);
      await mkdir(path.dirname(lexical), { recursive: true });
      const absPath = await this.securePath(session, filePath, true);
      if (typeof expectedHash === "string") {
        const current = await readFile(absPath).catch(() => Buffer.alloc(0));
        const currentHash = sha256(current);
        if (currentHash !== expectedHash)
          return { status: "conflict", currentHash };
      }
      await writeFile(absPath, contents, "utf8");
      this.emitFsFile(session, absPath);
      return { status: "ok", hash: sha256(contents) };
    } catch {
      return { status: "denied" };
    }
  }

  private async listSessionDirectory(
    sessionId: unknown,
    dirPath: unknown,
  ): Promise<JsonObject[]> {
    const session = this.session(sessionId);
    if (!session) return [];
    try {
      const directory = await this.securePath(
        session,
        typeof dirPath === "string" && dirPath ? dirPath : ".",
      );
      const entries = await readdir(directory, { withFileTypes: true });
      return entries.map((entry) => ({
        name: entry.name,
        path: path.join(directory, entry.name),
        isDirectory: entry.isDirectory(),
      }));
    } catch {
      return [];
    }
  }

  private async runBashCommand(
    sessionId: unknown,
    command: unknown,
  ): Promise<JsonObject> {
    const session = this.session(sessionId);
    if (!session || typeof command !== "string")
      return { stdout: "", stderr: "Session or command is invalid", code: 1 };
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: session.cwd,
        windowsHide: true,
        timeout: 120_000,
        maxBuffer: MAX_TOOL_OUTPUT * 2,
        shell: process.platform === "win32" ? process.env.ComSpec : "/bin/sh",
      });
      return { stdout: truncate(stdout), stderr: truncate(stderr), code: 0 };
    } catch (error) {
      return {
        stdout: isObject(error) ? truncate(stringValue(error.stdout)) : "",
        stderr: isObject(error)
          ? truncate(stringValue(error.stderr))
          : String(error),
        code: isObject(error) ? numberValue(error.code, 1) : 1,
      };
    }
  }

  private shellSession(
    ptyKey: unknown,
  ): { key: string; session: StoredCodeSession } | null {
    if (typeof ptyKey !== "string" || !ptyKey) return null;
    const exact = this.#sessions.get(ptyKey);
    if (exact) return { key: ptyKey, session: exact };
    for (const session of this.#sessions.values()) {
      if (ptyKey.startsWith(`${session.sessionId}::`))
        return { key: ptyKey, session };
    }
    return null;
  }

  private async startShellPty(
    ptyKey: unknown,
    columns: unknown,
    rows: unknown,
  ): Promise<JsonObject> {
    const target = this.shellSession(ptyKey);
    if (!target) return { ok: false, error: "Session not found" };
    const cols = Math.max(
      2,
      Math.min(500, Math.floor(numberValue(columns, 80))),
    );
    const rowCount = Math.max(
      1,
      Math.min(300, Math.floor(numberValue(rows, 24))),
    );
    const existing = this.#shellPtys.get(target.key);
    if (existing && !existing.closed) {
      try {
        existing.pty.resize(cols, rowCount);
      } catch {
        // The running shell can still be reused if ConPTY rejects a resize.
      }
      return {
        ok: true,
        buffered: existing.buffer,
        cols: existing.pty.cols,
        rows: existing.pty.rows,
      };
    }

    const shell =
      process.env.CLAUDE_CODE_SHELL ||
      process.env.SHELL ||
      (process.platform === "win32" ? "powershell.exe" : "/bin/bash");
    const shellName = path.basename(shell).toLowerCase();
    const shellArgs =
      process.platform === "win32" &&
      (shellName === "powershell.exe" || shellName === "pwsh.exe")
        ? ["-NoLogo"]
        : [];
    try {
      const pty = spawnPty(shell, shellArgs, {
        name: "xterm-256color",
        cols,
        rows: rowCount,
        cwd: target.session.cwd,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
          CLAUDE_DESKTOP: "1",
        },
      });
      let resolveExit!: () => void;
      const exited = new Promise<void>((resolve) => {
        resolveExit = resolve;
      });
      const record: ShellPtyRecord = {
        key: target.key,
        sessionId: target.session.sessionId,
        pty,
        exited,
        resolveExit,
        buffer: "",
        closed: false,
      };
      this.#shellPtys.set(target.key, record);
      pty.onData((data) => {
        if (record.closed) return;
        record.buffer = `${record.buffer}${data}`.slice(-MAX_PTY_BUFFER);
        this.#emitEvent({
          type: "shell_pty_data",
          sessionId: record.key,
          data,
        });
      });
      pty.onExit(({ exitCode, signal }) => {
        this.closeShellPty(
          record,
          exitCode,
          signal ? `Shell exited after signal ${signal}` : undefined,
        );
        record.resolveExit();
      });
      return { ok: true, buffered: "", cols, rows: rowCount };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private closeShellPty(
    record: ShellPtyRecord,
    code?: number,
    reason?: string,
  ): void {
    if (record.closed) return;
    record.closed = true;
    if (this.#shellPtys.get(record.key) === record)
      this.#shellPtys.delete(record.key);
    this.#emitEvent({
      type: "shell_pty_close",
      sessionId: record.key,
      ...(typeof code === "number" ? { code } : {}),
      ...(reason ? { reason } : {}),
    });
  }

  private async stopShellPty(ptyKey: unknown): Promise<void> {
    if (typeof ptyKey !== "string") return;
    const record = this.#shellPtys.get(ptyKey);
    if (!record) return;
    try {
      record.pty.kill();
    } catch {
      this.closeShellPty(record);
      record.resolveExit();
    }
    await Promise.race([
      record.exited,
      new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
    ]);
    this.closeShellPty(record);
  }

  private resizeShellPty(
    ptyKey: unknown,
    columns: unknown,
    rows: unknown,
  ): void {
    if (typeof ptyKey !== "string") return;
    const record = this.#shellPtys.get(ptyKey);
    if (!record || record.closed) return;
    const cols = Math.max(
      2,
      Math.min(500, Math.floor(numberValue(columns, record.pty.cols))),
    );
    const rowCount = Math.max(
      1,
      Math.min(300, Math.floor(numberValue(rows, record.pty.rows))),
    );
    try {
      record.pty.resize(cols, rowCount);
    } catch {
      // A resize race with process exit is harmless.
    }
  }

  private writeShellPty(ptyKey: unknown, data: unknown): void {
    if (typeof ptyKey !== "string" || typeof data !== "string") return;
    const record = this.#shellPtys.get(ptyKey);
    if (!record || record.closed) return;
    try {
      record.pty.write(data);
    } catch {
      // A write race with process exit is harmless.
    }
  }

  private getShellPtyBuffer(ptyKey: unknown): string | null {
    if (typeof ptyKey !== "string") return null;
    const record = this.#shellPtys.get(ptyKey);
    return record && !record.closed ? record.buffer : null;
  }

  private getBusyShellPtyKeys(sessionId: unknown): JsonObject {
    if (typeof sessionId !== "string")
      return { live: [], busy: [], probed: true };
    const records = [...this.#shellPtys.values()].filter(
      (record) => !record.closed && record.sessionId === sessionId,
    );
    const shellNames = new Set([
      "bash",
      "cmd",
      "cmd.exe",
      "fish",
      "nu",
      "pwsh",
      "pwsh.exe",
      "powershell",
      "powershell.exe",
      "sh",
      "zsh",
    ]);
    return {
      live: records.map((record) => record.key),
      busy: records
        .filter(
          (record) =>
            !shellNames.has(path.basename(record.pty.process).toLowerCase()),
        )
        .map((record) => record.key),
      probed: true,
    };
  }

  dispose(): void {
    for (const record of [...this.#shellPtys.values()])
      void this.stopShellPty(record.key);
  }

  private async git(cwd: unknown, args: string[]): Promise<string> {
    if (typeof cwd !== "string") throw new Error("cwd is required");
    const { stdout } = await execFileAsync("git", args, {
      cwd: path.resolve(cwd),
      windowsHide: true,
      maxBuffer: MAX_TOOL_OUTPUT * 2,
    });
    // Git's porcelain formats use leading columns to encode index/worktree
    // state. Preserve those columns while still removing the final newline.
    return stdout.trimEnd();
  }

  private async getGitInfo(cwd: unknown): Promise<JsonObject | null> {
    try {
      const root = await this.git(cwd, ["rev-parse", "--show-toplevel"]);
      const branch =
        (await this.git(cwd, ["branch", "--show-current"])) || "HEAD";
      const defaultBranch = await this.git(cwd, [
        "symbolic-ref",
        "--short",
        "refs/remotes/origin/HEAD",
      ])
        .then((value) => value.replace(/^origin\//, ""))
        .catch(() => "main");
      const repo = path.basename(root);
      return { repo, branch, defaultBranch, root };
    } catch {
      return null;
    }
  }

  private async getGitDiff(
    cwd: unknown,
    base: unknown,
    head: unknown,
    options: unknown,
  ): Promise<JsonObject | null> {
    if (typeof cwd !== "string" || typeof base !== "string") return null;
    try {
      const range =
        typeof head === "string" && head ? `${base}...${head}` : base;
      const nameStatus = await this.git(cwd, ["diff", "--numstat", range]);
      const files = nameStatus
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const [added, deleted, ...rest] = line.split("\t");
          return {
            filename: rest.join("\t"),
            status: "modified",
            additions: Number.parseInt(added, 10) || 0,
            deletions: Number.parseInt(deleted, 10) || 0,
            changes:
              (Number.parseInt(added, 10) || 0) +
              (Number.parseInt(deleted, 10) || 0),
          };
        });
      if (isObject(options) && options.includePatches === true) {
        for (const file of files)
          (file as JsonObject).patch = await this.git(cwd, [
            "diff",
            range,
            "--",
            file.filename,
          ]);
      }
      return {
        base_ref: base,
        head_ref: typeof head === "string" ? head : "HEAD",
        merge_base: await this.git(cwd, [
          "merge-base",
          base,
          typeof head === "string" ? head : "HEAD",
        ]).catch(() => base),
        files,
        ahead_by: 0,
        behind_by: 0,
        total_commits: 0,
      };
    } catch {
      return null;
    }
  }

  private async getGitDiffStats(
    cwd: unknown,
    base: unknown,
    head: unknown,
  ): Promise<JsonObject | null> {
    const diff = await this.getGitDiff(cwd, base, head, {});
    if (!diff || !Array.isArray(diff.files)) return null;
    const files = diff.files.filter(isObject);
    return {
      additions: files.reduce(
        (sum, file) => sum + numberValue(file.additions, 0),
        0,
      ),
      deletions: files.reduce(
        (sum, file) => sum + numberValue(file.deletions, 0),
        0,
      ),
      fileCount: files.length,
      ahead_by: 0,
      behind_by: 0,
    };
  }

  private async getWorkingTreeStatus(cwd: unknown): Promise<JsonObject | null> {
    try {
      const porcelain = await this.git(cwd, ["status", "--porcelain"]);
      const files = porcelain
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => ({
          path: line.slice(3),
          status: line.slice(0, 2).trim() || "modified",
        }));
      const numstat = await this.git(cwd, ["diff", "--numstat"]);
      let additions = 0;
      let deletions = 0;
      for (const line of numstat.split(/\r?\n/)) {
        const [added, deleted] = line.split("\t");
        additions += Number.parseInt(added, 10) || 0;
        deletions += Number.parseInt(deleted, 10) || 0;
      }
      return { files, additions, deletions };
    } catch {
      return null;
    }
  }

  private async getUncommittedChanges(sessionId: unknown): Promise<string[]> {
    const session = this.session(sessionId);
    if (!session) return [];
    const status = await this.getWorkingTreeStatus(session.cwd);
    return status && Array.isArray(status.files)
      ? status.files
          .filter(isObject)
          .map((file) => stringValue(file.path))
          .filter(Boolean)
      : [];
  }

  private async isWorkingTreeDirty(cwd: unknown): Promise<boolean> {
    try {
      return Boolean(await this.git(cwd, ["status", "--porcelain"]));
    } catch {
      return false;
    }
  }

  private async getLocalBranches(cwd: unknown): Promise<string[]> {
    try {
      return (await this.git(cwd, ["branch", "--format=%(refname:short)"]))
        .split(/\r?\n/)
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private async getGitCommits(
    cwd: unknown,
    base: unknown,
    head: unknown,
  ): Promise<JsonObject[]> {
    if (typeof base !== "string" || !base) return [];
    try {
      const revision =
        typeof head === "string" && head ? `${base}...${head}` : base;
      const output = await this.git(cwd, [
        "log",
        "-n",
        "50",
        "--format=%H%x1f%h%x1f%s%x1f%an%x1f%ae%x1f%ct",
        revision,
      ]);
      return output
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const [sha, shortSha, subject, authorName, authorEmail, timestamp] =
            line.split("\x1f");
          return {
            sha,
            shortSha,
            subject,
            authorName,
            authorEmail,
            date: Number(timestamp) * 1000,
          };
        });
    } catch {
      return [];
    }
  }

  private async commandAvailable(command: string): Promise<boolean> {
    const probe = process.platform === "win32" ? "where" : "which";
    return execFileAsync(probe, [command], { windowsHide: true }).then(
      () => true,
      () => false,
    );
  }

  private async openEditor(
    targetPath: unknown,
    editor: unknown,
    line: unknown,
  ): Promise<boolean> {
    if (typeof targetPath !== "string" || typeof editor !== "string")
      return false;
    const commandByEditor: Record<string, string> = {
      vscode: "code",
      cursor: "cursor",
      zed: "zed",
      windsurf: "windsurf",
      xcode: "xed",
    };
    const command = commandByEditor[editor];
    if (!command) return false;
    const args =
      typeof line === "number" && Number.isFinite(line)
        ? ["--goto", `${targetPath}:${Math.max(1, Math.floor(line))}`]
        : [targetPath];
    return execFileAsync(command, args, {
      windowsHide: true,
      timeout: 10_000,
    }).then(
      () => true,
      () => false,
    );
  }

  private safeDefault(method: string): unknown {
    if (
      /^(get|list|search).*(Branches|Commits|Comments|Checks|Issues|Suggestions|Resources|Annotations|Configs)$/.test(
        method,
      )
    )
      return [];
    if (/^(is|has|check|can|should)/.test(method)) return false;
    if (
      /^(set|report|notify|resize|write|stop|start|open|show|reveal|submit|replace|remove|add|apply|cancel|mark|dismiss|enable|disable|stash|commit|merge|reply|rerun|resolve|teleport)/.test(
        method,
      )
    )
      return undefined;
    return null;
  }
}
