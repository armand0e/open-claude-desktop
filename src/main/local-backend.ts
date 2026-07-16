import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { WEB_TOOLS, type WebToolRunner } from "./local-web-tools";

export interface LocalProviderConfig {
  baseUrl: string;
  model: string;
  contextWindow?: number;
  apiKey?: string;
}

interface LocalMessage {
  uuid: string;
  sender: "human" | "assistant";
  content: LocalContentBlock[];
  text: string;
  created_at: string;
  updated_at: string;
  index: number;
  parent_message_uuid?: string;
  attachments: LocalAttachment[];
  files: LocalMessageFile[];
}

interface LocalAttachment {
  file_name: string;
  file_type: string;
  file_size: number;
  extracted_content: string;
  origin: string;
  kind: string;
  [key: string]: unknown;
}

interface LocalMessageFile {
  file_uuid: string;
  file_name: string;
  file_kind: string;
  size_bytes: number;
  path?: string;
  [key: string]: unknown;
}

interface LocalStoredFile {
  uuid: string;
  file_name: string;
  file_type: string;
  file_kind: "blob" | "image";
  size_bytes: number;
  storage_name: string;
  extracted_content?: string;
  created_at: string;
}

interface LocalTextBlock {
  type: "text";
  text: string;
  citations: never[];
}

interface LocalThinkingBlock {
  type: "thinking";
  thinking: string;
  signature: string;
  summaries: never[];
  start_timestamp: string;
  stop_timestamp?: string;
}

interface ArtifactToolInput {
  version_uuid?: string;
  command: "create" | "update" | "rewrite";
  id: string;
  title?: string;
  type?: ArtifactType;
  language?: string;
  content?: string;
  old_str?: string;
  new_str?: string;
  source?: "c" | "w";
}

interface LocalToolUseBlock {
  type: "tool_use";
  id: string;
  name: "artifacts";
  input: ArtifactToolInput;
}

type LocalContentBlock =
  LocalTextBlock | LocalThinkingBlock | LocalToolUseBlock;

type ArtifactType =
  | "text/plain"
  | "text/markdown"
  | "text/html"
  | "image/svg+xml"
  | "application/vnd.ant.code"
  | "application/vnd.ant.mermaid"
  | "application/vnd.ant.react";

interface LocalArtifactVersion {
  uuid: string;
  artifact_uuid: string;
  artifact_identifier: string;
  conversation_uuid: string;
  message_uuid: string;
  created_at: string;
  updated_at: string;
  title: string;
  artifact_type: ArtifactType;
  language?: string;
  content: string;
  command: ArtifactToolInput["command"];
  visibility: "private";
  published_artifact_uuid: null;
  published_artifact_deleted_at: null;
}

interface LocalArtifact {
  uuid: string;
  artifact_identifier: string;
  conversation_uuid: string;
  created_at: string;
  updated_at: string;
  title: string;
  artifact_type: ArtifactType;
  language?: string;
  versions: LocalArtifactVersion[];
}

interface LocalConversation {
  uuid: string;
  name: string;
  summary: string;
  model: string;
  created_at: string;
  updated_at: string;
  current_leaf_message_uuid?: string;
  is_starred: boolean;
  is_temporary: boolean;
  settings: Record<string, unknown>;
  project_uuid?: string;
  chat_messages: LocalMessage[];
}

interface LocalData {
  version: 3;
  provider: LocalProviderConfig;
  conversations: LocalConversation[];
  artifacts: LocalArtifact[];
  files: LocalStoredFile[];
}

type JsonObject = Record<string, unknown>;

const DEFAULT_PROVIDER: LocalProviderConfig = {
  baseUrl: "http://127.0.0.1:11434/v1",
  model: "local-model",
  contextWindow: 128_000,
};

const MAX_LOCAL_FILE_BYTES = 50 * 1024 * 1024;
const TEXT_FILE_EXTENSIONS = new Set([
  ".c",
  ".cpp",
  ".css",
  ".csv",
  ".go",
  ".h",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".log",
  ".md",
  ".mjs",
  ".py",
  ".rs",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

const ARTIFACT_TYPES = new Set<ArtifactType>([
  "text/plain",
  "text/markdown",
  "text/html",
  "image/svg+xml",
  "application/vnd.ant.code",
  "application/vnd.ant.mermaid",
  "application/vnd.ant.react",
]);

const ARTIFACT_SYSTEM_PROMPT = `You are running in a local desktop chat that supports Claude-style artifacts and private local web tools. Use web_search and visit_website when current public information is required, cite the returned URLs, and distinguish source reliability. When a user asks for a substantial document, code file, diagram, SVG, HTML page, or React component that benefits from a dedicated pane, call the artifacts function. Use command=create for a new artifact, rewrite for a complete replacement, and update with old_str/new_str for a precise edit. Keep ordinary conversational replies as text. For a diagram that should appear directly in the conversation, prefer a Mermaid fenced code block; reserve an artifact for substantial or interactive standalone output.`;

const ARTIFACT_TAG_SYSTEM_PROMPT = `${ARTIFACT_SYSTEM_PROMPT}\nThis provider does not accept function tools. Emit an artifact inline using exactly <antArtifact identifier="stable-id" type="text/markdown" title="Title">CONTENT</antArtifact>. Supported types are text/plain, text/markdown, text/html, image/svg+xml, application/vnd.ant.code, application/vnd.ant.mermaid, and application/vnd.ant.react.`;

const ARTIFACT_TOOL = {
  type: "function",
  function: {
    name: "artifacts",
    description:
      "Create or revise a persistent artifact shown in the desktop artifact pane.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        version_uuid: { type: "string" },
        command: { enum: ["create", "update", "rewrite"] },
        id: {
          type: "string",
          description:
            "Stable identifier. Reuse it when updating the same artifact.",
        },
        title: { type: "string" },
        type: {
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
        language: { type: "string" },
        content: { type: "string" },
        old_str: { type: "string" },
        new_str: { type: "string" },
      },
      required: ["command", "id"],
    },
  },
} as const;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function cleanFileName(value: string): string {
  const name = path.basename(value.replaceAll("\\", "/")).replaceAll("\0", "");
  return name.slice(0, 255) || "attachment";
}

function normalizeAttachment(value: unknown): LocalAttachment | null {
  if (!isObject(value)) return null;
  const extractedContent =
    typeof value.extracted_content === "string"
      ? value.extracted_content.replaceAll("\0", "")
      : undefined;
  if (extractedContent === undefined) return null;
  return {
    ...value,
    file_name: cleanFileName(stringValue(value.file_name) || "attachment.txt"),
    file_type: stringValue(value.file_type) || "text/plain",
    file_size:
      finiteNumber(value.file_size) ??
      new TextEncoder().encode(extractedContent).byteLength,
    extracted_content: extractedContent,
    origin: stringValue(value.origin) || "user_upload",
    kind: stringValue(value.kind) || "file",
};

}

const CHAT_TOOLS = [ARTIFACT_TOOL, ...WEB_TOOLS];

function reasoningRequest(body: JsonObject): JsonObject {
  const thinking = isObject(body.thinking) ? body.thinking : {};
  let effort =
    stringValue(body.reasoning_effort || body.effort || thinking.effort)
      ?.toLowerCase() ?? "";
  if (thinking.type === "disabled") effort = "off";
  if (!effort || effort === "auto") return {};
  if (effort === "off")
    return {
      thinking_budget_tokens: 0,
      reasoning_budget: 0,
      chat_template_kwargs: { enable_thinking: false },
    };
  if (["low", "medium", "high"].includes(effort))
    return {
      reasoning_effort: effort,
      chat_template_kwargs: { enable_thinking: true, reasoning_effort: effort },
    };
  return {};
}

function normalizeMessageFile(
  value: unknown,
  storedFiles: readonly LocalStoredFile[] = [],
): LocalMessageFile | null {
  if (typeof value === "string") {
    const stored = storedFiles.find((file) => file.uuid === value);
    return stored
      ? {
          file_uuid: stored.uuid,
          file_name: stored.file_name,
          file_kind: stored.file_kind,
          size_bytes: stored.size_bytes,
          path: `/mnt/user-data/uploads/${stored.file_name}`,
        }
      : {
          file_uuid: value,
          file_name: "attachment",
          file_kind: "blob",
          size_bytes: 0,
        };
  }
  if (!isObject(value)) return null;
  const uuid =
    stringValue(value.file_uuid) || stringValue(value.serverFileUuid);
  if (!uuid) return null;
  const stored = storedFiles.find((file) => file.uuid === uuid);
  return {
    ...value,
    file_uuid: uuid,
    file_name: cleanFileName(
      stringValue(value.file_name) || stored?.file_name || "attachment",
    ),
    file_kind: stringValue(value.file_kind) || stored?.file_kind || "blob",
    size_bytes:
      finiteNumber(value.size_bytes) ??
      finiteNumber(value.file_size) ??
      stored?.size_bytes ??
      0,
    ...(stringValue(value.path) ? { path: stringValue(value.path) } : {}),
  };
}

function normalizeAttachments(value: unknown): LocalAttachment[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const attachment = normalizeAttachment(entry);
        return attachment ? [attachment] : [];
      })
    : [];
}

function normalizeMessageFiles(
  value: unknown,
  storedFiles: readonly LocalStoredFile[] = [],
): LocalMessageFile[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const file = normalizeMessageFile(entry, storedFiles);
        return file ? [file] : [];
      })
    : [];
}

function extractLocalText(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): string | undefined {
  const extension = path.extname(fileName).toLowerCase();
  if (!mimeType.startsWith("text/") && !TEXT_FILE_EXTENSIONS.has(extension))
    return undefined;
  const encoding =
    bytes.length >= 2 &&
    ((bytes[0] === 0xff && bytes[1] === 0xfe) ||
      (bytes[0] === 0xfe && bytes[1] === 0xff))
      ? "utf-16"
      : "utf-8";
  try {
    return new TextDecoder(encoding, { fatal: true })
      .decode(bytes)
      .replaceAll("\0", "");
  } catch {
    return undefined;
  }
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Provider URL must use http or https");
  return url.toString().replace(/\/$/, "");
}

function configuredProvider(
  input?: Partial<LocalProviderConfig>,
): LocalProviderConfig {
  const configuredContextWindow = Number(
    process.env.CLAUDE_LOCAL_CONTEXT_WINDOW?.trim() || input?.contextWindow,
  );
  return {
    baseUrl: normalizeBaseUrl(
      process.env.CLAUDE_LOCAL_BASE_URL?.trim() ||
        input?.baseUrl ||
        DEFAULT_PROVIDER.baseUrl,
    ),
    model:
      process.env.CLAUDE_LOCAL_MODEL?.trim() ||
      input?.model?.trim() ||
      DEFAULT_PROVIDER.model,
    contextWindow:
      Number.isFinite(configuredContextWindow) && configuredContextWindow >= 1024
        ? Math.floor(configuredContextWindow)
        : DEFAULT_PROVIDER.contextWindow,
    ...(process.env.CLAUDE_LOCAL_API_KEY?.trim() || input?.apiKey
      ? {
          apiKey:
            process.env.CLAUDE_LOCAL_API_KEY?.trim() || input?.apiKey?.trim(),
        }
      : {}),
  };
}

function conversationSummary(conversation: LocalConversation): JsonObject {
  const { chat_messages: _messages, ...summary } = conversation;
  return summary;
}

function artifactVersionResponse(version: LocalArtifactVersion): JsonObject {
  return {
    uuid: version.uuid,
    artifact_uuid: version.artifact_uuid,
    artifact_identifier: version.artifact_identifier,
    message_uuid: version.message_uuid,
    conversation_uuid: version.conversation_uuid,
    title: version.title,
    type: version.artifact_type,
    language: version.language ?? null,
    result_state: version.content,
    citations: [],
    attachments: [],
    files: [],
    visibility: version.visibility,
    published_artifact_uuid: version.published_artifact_uuid,
    published_artifact_deleted_at: version.published_artifact_deleted_at,
    created_at: version.created_at,
    updated_at: version.updated_at,
  };
}

function messageText(
  message: LocalMessage,
  storedFiles: readonly LocalStoredFile[],
): string {
  const content = message.content
    .flatMap((block) => {
      if (block.type === "text") return [block.text];
      if (block.type === "thinking") return [];
      const input = block.input;
      return [
        `<artifact id=${JSON.stringify(input.id)} title=${JSON.stringify(input.title ?? "Untitled")} type=${JSON.stringify(input.type ?? "text/plain")}>\n${input.content ?? input.new_str ?? ""}\n</artifact>`,
      ];
    })
    .filter(Boolean)
    .join("\n");
  if (message.sender !== "human") return content;

  const attachments = message.attachments.map(
    (attachment) =>
      `<attached_file name=${JSON.stringify(attachment.file_name)} type=${JSON.stringify(attachment.file_type)}>\n${attachment.extracted_content}\n</attached_file>`,
  );
  const files = message.files.map((file) => {
    const stored = storedFiles.find(
      (candidate) => candidate.uuid === file.file_uuid,
    );
    return stored?.extracted_content
      ? `<attached_file name=${JSON.stringify(stored.file_name)} type=${JSON.stringify(stored.file_type)}>\n${stored.extracted_content}\n</attached_file>`
      : `<attached_file name=${JSON.stringify(file.file_name)} type=${JSON.stringify(stored?.file_type || file.file_kind)}>\n[Binary file: ${file.size_bytes} bytes]\n</attached_file>`;
  });
  return [content, ...attachments, ...files].filter(Boolean).join("\n\n");
}

function createMessage(
  conversation: LocalConversation,
  sender: LocalMessage["sender"],
  text: string,
  uuid: string,
  parentMessageUuid?: string,
): LocalMessage {
  const now = new Date().toISOString();
  return {
    uuid,
    sender,
    text,
    content: [{ type: "text", text, citations: [] }],
    created_at: now,
    updated_at: now,
    index: conversation.chat_messages.length,
    ...(parentMessageUuid ? { parent_message_uuid: parentMessageUuid } : {}),
    attachments: [],
    files: [],
  };
}

function messageBranch(
  conversation: LocalConversation,
  leafMessageUuid: string,
): LocalMessage[] {
  const byUuid = new Map(
    conversation.chat_messages.map((message) => [message.uuid, message]),
  );
  const branch: LocalMessage[] = [];
  const visited = new Set<string>();
  let cursor = byUuid.get(leafMessageUuid);
  while (cursor && !visited.has(cursor.uuid)) {
    visited.add(cursor.uuid);
    branch.unshift(cursor);
    cursor = cursor.parent_message_uuid
      ? byUuid.get(cursor.parent_message_uuid)
      : undefined;
  }
  return branch;
}

function artifactType(value: unknown): ArtifactType {
  return typeof value === "string" && ARTIFACT_TYPES.has(value as ArtifactType)
    ? (value as ArtifactType)
    : "text/plain";
}

function normalizeArtifactInput(value: unknown): ArtifactToolInput | null {
  if (!isObject(value)) return null;
  const command =
    value.command === "update" || value.command === "rewrite"
      ? value.command
      : "create";
  const id = stringValue(value.id) || `artifact-${randomUUID()}`;
  const input: ArtifactToolInput = {
    command,
    id,
    type: artifactType(value.type),
  };
  for (const key of [
    "version_uuid",
    "title",
    "language",
    "content",
    "old_str",
    "new_str",
  ] as const) {
    const part = stringValue(value[key]);
    if (part) input[key] = part;
  }
  if (value.source === "c" || value.source === "w") input.source = value.source;
  return input;
}

interface OpenAiTextDelta {
  type: "text";
  text: string;
}

interface OpenAiReasoningDelta {
  type: "reasoning";
  text: string;
}

interface OpenAiToolDelta {
  type: "tool";
  index: number;
  id?: string;
  name?: string;
  arguments?: string;
}

type OpenAiDelta = OpenAiTextDelta | OpenAiReasoningDelta | OpenAiToolDelta;

function reasoningText(delta: JsonObject): string {
  const direct = stringValue(delta.reasoning_content || delta.reasoning);
  if (direct) return direct;
  if (!Array.isArray(delta.reasoning_details)) return "";
  return delta.reasoning_details
    .flatMap((detail) => {
      if (typeof detail === "string") return [detail];
      if (!isObject(detail)) return [];
      return [
        stringValue(
          detail.text || detail.content || detail.reasoning || detail.summary,
        ),
      ];
    })
    .filter(Boolean)
    .join("");
}

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

function errorResponse(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({
      error: { type: "local_backend_error", message },
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function jsonBody(request: Request): Promise<JsonObject> {
  const value = await request.json();
  if (!isObject(value)) throw new Error("Request body must be a JSON object");
  return value;
}

async function* openAiDeltas(
  response: Response,
): AsyncGenerator<OpenAiDelta, void, void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        const event = JSON.parse(data) as JsonObject;
        const choices = Array.isArray(event.choices) ? event.choices : [];
        const choice = isObject(choices[0]) ? choices[0] : {};
        const delta = isObject(choice.delta) ? choice.delta : {};
        const reasoning = reasoningText(delta);
        if (reasoning) yield { type: "reasoning", text: reasoning };
        const text = stringValue(delta.content);
        if (text) yield { type: "text", text };
        const toolCalls = Array.isArray(delta.tool_calls)
          ? delta.tool_calls
          : [];
        for (const [fallbackIndex, candidate] of toolCalls.entries()) {
          if (!isObject(candidate)) continue;
          const fn = isObject(candidate.function) ? candidate.function : {};
          const index =
            typeof candidate.index === "number"
              ? candidate.index
              : fallbackIndex;
          yield {
            type: "tool",
            index,
            ...(stringValue(candidate.id)
              ? { id: stringValue(candidate.id) }
              : {}),
            ...(stringValue(fn.name) ? { name: stringValue(fn.name) } : {}),
            ...(typeof fn.arguments === "string"
              ? { arguments: fn.arguments }
              : {}),
          };
        }
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

export class LocalBackend {
  readonly filePath: string;
  #data: LocalData;
  readonly #webTools?: WebToolRunner;
  #writeChain = Promise.resolve();

  private constructor(
    filePath: string,
    data: LocalData,
    webTools?: WebToolRunner,
  ) {
    this.filePath = filePath;
    this.#data = data;
    this.#webTools = webTools;
  }

  static async create(
    userDataPath: string,
    webTools?: WebToolRunner,
  ): Promise<LocalBackend> {
    const filePath = path.join(userDataPath, "local-backend.json");
    let value: unknown;
    try {
      value = JSON.parse(await readFile(filePath, "utf8"));
    } catch {
      value = null;
    }
    const input = isObject(value) ? value : {};
    const provider = isObject(input.provider) ? input.provider : {};
    const conversations = Array.isArray(input.conversations)
      ? (input.conversations as LocalConversation[])
      : [];
    const artifacts = Array.isArray(input.artifacts)
      ? (input.artifacts as LocalArtifact[])
      : [];
    const files = Array.isArray(input.files)
      ? (input.files as LocalStoredFile[])
      : [];
    return new LocalBackend(
      filePath,
      {
        version: 3,
        provider: configuredProvider({
          baseUrl: stringValue(provider.baseUrl),
          model: stringValue(provider.model),
          contextWindow: Number(provider.contextWindow),
          apiKey: stringValue(provider.apiKey),
        }),
        conversations,
        artifacts,
        files,
      },
      webTools,
    );
  }

  provider(): LocalProviderConfig {
    return structuredClone(this.#data.provider);
  }

  async #persist(): Promise<void> {
    const serialized = `${JSON.stringify(this.#data, null, 2)}\n`;
    this.#writeChain = this.#writeChain.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${randomUUID()}.tmp`;
      await writeFile(temporary, serialized, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, this.filePath);
    });
    await this.#writeChain;
  }

  #conversation(uuid: string): LocalConversation | undefined {
    return this.#data.conversations.find(
      (conversation) => conversation.uuid === uuid,
    );
  }

  #artifact(
    conversationUuid: string,
    identifier: string,
  ): LocalArtifact | undefined {
    return this.#data.artifacts.find(
      (artifact) =>
        artifact.conversation_uuid === conversationUuid &&
        (artifact.artifact_identifier === identifier ||
          artifact.uuid === identifier),
    );
  }

  #storedFile(uuid: string): LocalStoredFile | undefined {
    return this.#data.files.find((file) => file.uuid === uuid);
  }

  #storedFilePath(file: LocalStoredFile): string {
    return path.join(
      path.dirname(this.filePath),
      "local-files",
      file.storage_name,
    );
  }

  async #storeUploadedFile(file: File): Promise<LocalStoredFile> {
    if (file.size > MAX_LOCAL_FILE_BYTES)
      throw new Error("Uploaded file is larger than the 50 MB local limit");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const uuid = randomUUID();
    const fileName = cleanFileName(file.name || "attachment");
    const fileType = file.type || "application/octet-stream";
    const extractedContent = extractLocalText(bytes, fileName, fileType);
    const stored: LocalStoredFile = {
      uuid,
      file_name: fileName,
      file_type: fileType,
      file_kind: fileType.startsWith("image/") ? "image" : "blob",
      size_bytes: bytes.byteLength,
      storage_name: uuid,
      ...(extractedContent !== undefined
        ? { extracted_content: extractedContent }
        : {}),
      created_at: new Date().toISOString(),
    };
    const destination = this.#storedFilePath(stored);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes, { mode: 0o600 });
    this.#data.files.push(stored);
    await this.#persist();
    return stored;
  }

  #fileResponse(file: LocalStoredFile): JsonObject {
    return {
      file_uuid: file.uuid,
      file_name: file.file_name,
      file_type: file.file_type,
      file_kind: file.file_kind,
      size_bytes: file.size_bytes,
      file_size: file.size_bytes,
      path: `/mnt/user-data/uploads/${file.file_name}`,
      created_at: file.created_at,
    };
  }

  async #uploadedFile(request: Request): Promise<File> {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Multipart file is required");
    return file;
  }

  #materializeArtifact(
    conversation: LocalConversation,
    messageUuid: string,
    input: ArtifactToolInput,
  ): ArtifactToolInput {
    const now = new Date().toISOString();
    let artifact = this.#artifact(conversation.uuid, input.id);
    if (!artifact) {
      artifact = {
        uuid: randomUUID(),
        artifact_identifier: input.id,
        conversation_uuid: conversation.uuid,
        created_at: now,
        updated_at: now,
        title: input.title || "Untitled",
        artifact_type: input.type || "text/plain",
        ...(input.language ? { language: input.language } : {}),
        versions: [],
      };
      this.#data.artifacts.push(artifact);
    }

    const previous = artifact.versions.at(-1)?.content ?? "";
    let content = input.content ?? "";
    if (input.command === "update" && !input.content) {
      const oldText = input.old_str ?? "";
      const newText = input.new_str ?? "";
      content =
        oldText && previous.includes(oldText)
          ? previous.replace(oldText, newText)
          : previous || newText;
    }
    const versionUuid = input.version_uuid || randomUUID();
    const title = input.title || artifact.title;
    const type = input.type || artifact.artifact_type;
    const language = input.language || artifact.language;
    const version: LocalArtifactVersion = {
      uuid: versionUuid,
      artifact_uuid: artifact.uuid,
      artifact_identifier: artifact.artifact_identifier,
      conversation_uuid: conversation.uuid,
      message_uuid: messageUuid,
      created_at: now,
      updated_at: now,
      title,
      artifact_type: type,
      ...(language ? { language } : {}),
      content,
      command: input.command,
      visibility: "private",
      published_artifact_uuid: null,
      published_artifact_deleted_at: null,
    };
    artifact.title = title;
    artifact.artifact_type = type;
    artifact.language = language;
    artifact.updated_at = now;
    artifact.versions.push(version);
    return {
      ...input,
      id: artifact.artifact_identifier,
      version_uuid: versionUuid,
      title,
      type,
      ...(language ? { language } : {}),
      ...(input.command === "update" && !input.content ? {} : { content }),
    };
  }

  async #providerCompletion(
    conversation: LocalConversation,
    history: readonly LocalMessage[],
    signal: AbortSignal,
    emptyRetry = false,
    continuation: readonly JsonObject[] = [],
    requestOptions: JsonObject = {},
  ): Promise<Response> {
    const provider = this.#data.provider;
    const send = (withTools: boolean) =>
      fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(provider.apiKey
            ? { Authorization: `Bearer ${provider.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: conversation.model || provider.model,
          stream: true,
          messages: [
            {
              role: "system",
              content: withTools
                ? ARTIFACT_SYSTEM_PROMPT
                : ARTIFACT_TAG_SYSTEM_PROMPT,
            },
            ...history.map((message) => ({
              role: message.sender === "human" ? "user" : "assistant",
              content: messageText(message, this.#data.files),
            })),
            ...(emptyRetry
              ? [
                  {
                    role: "user",
                    content:
                      "Your previous turn contained reasoning but no visible answer or artifact call. Reply visibly now, or call the artifacts tool if the request requires an artifact.",
                  },
                ]
              : []),
            ...continuation,
          ],
          ...(withTools ? { tools: CHAT_TOOLS, tool_choice: "auto" } : {}),
          ...requestOptions,
        }),
      });
    let response = await send(true);
    if ([400, 404, 422].includes(response.status)) {
      await response.body?.cancel().catch(() => undefined);
      response = await send(false);
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 2000);
      throw new Error(
        `Provider returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }
    return response;
  }

  async #completion(
    request: Request,
    conversationUuid: string,
    retryRequested = false,
  ): Promise<Response> {
    const body = await jsonBody(request);
    let conversation = this.#conversation(conversationUuid);
    const createsConversation = !conversation;
    if (!conversation) {
      const params = isObject(body.create_conversation_params)
        ? body.create_conversation_params
        : {};
      conversation = await this.#createConversation({
        ...params,
        uuid: conversationUuid,
      });
    }

    const prompt = stringValue(body.prompt) || stringValue(body.text) || "";
    const turnUuids = isObject(body.turn_message_uuids)
      ? body.turn_message_uuids
      : {};
    const humanUuid = stringValue(turnUuids.human_message_uuid) || randomUUID();
    const assistantUuid =
      stringValue(turnUuids.assistant_message_uuid) || randomUUID();
    let parentUuid =
      stringValue(body.parent_message_uuid) ||
      conversation.current_leaf_message_uuid;
    const attachments = normalizeAttachments(body.attachments);
    const files = normalizeMessageFiles(
      Array.isArray(body.files_v2) && body.files_v2.length > 0
        ? body.files_v2
        : body.files,
      this.#data.files,
    );
    let human = conversation.chat_messages.find(
      (message) => message.uuid === humanUuid,
    );
    const requestedParent = parentUuid
      ? conversation.chat_messages.find(
          (message) => message.uuid === parentUuid,
        )
      : undefined;
    const retryHuman =
      retryRequested || !prompt
        ? requestedParent?.sender === "human"
          ? requestedParent
          : requestedParent?.sender === "assistant" &&
              requestedParent.parent_message_uuid
            ? conversation.chat_messages.find(
                (message) =>
                  message.uuid === requestedParent.parent_message_uuid &&
                  message.sender === "human",
              )
            : undefined
        : undefined;
    if (!human && retryHuman) {
      human = retryHuman;
      parentUuid = human.parent_message_uuid;
    }
    if (!human) {
      human = createMessage(
        conversation,
        "human",
        prompt,
        humanUuid,
        parentUuid,
      );
      human.attachments = attachments;
      human.files = files;
      conversation.chat_messages.push(human);
      conversation.current_leaf_message_uuid = human.uuid;
      conversation.updated_at = human.updated_at;
      if (!conversation.name && prompt)
        conversation.name = prompt.replace(/\s+/g, " ").trim().slice(0, 80);
      await this.#persist();
    } else {
      conversation.current_leaf_message_uuid = human.uuid;
    }

    const providerHistory = messageBranch(conversation, human.uuid);

    const backend = this;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let assistantText = "";
        const assistantBlocks: LocalContentBlock[] = [];
        let toolCalls = new Map<
          number,
          { id: string; name: string; arguments: string }
        >();
        try {
          controller.enqueue(
            sse("message_start", {
              type: "message_start",
              message: {
                uuid: assistantUuid,
                parent_uuid: human.uuid,
                role: "assistant",
                model: conversation.model,
                content: [],
              },
            }),
          );
          if (createsConversation) {
            controller.enqueue(
              sse("conversation_ready", { type: "conversation_ready" }),
            );
          }
          let nextBlockIndex = 0;
          let textBlockIndex: number | undefined;
          const continuation: JsonObject[] = [];
          const providerOptions = reasoningRequest(body);
          let terminalTurn = false;
          let carriedReasoning = "";
          for (let providerTurn = 0; providerTurn < 8; providerTurn += 1) {
            const turnTextStart = assistantText.length;
            let pendingReasoning = carriedReasoning;
            carriedReasoning = "";
            const emitPendingReasoning = () => {
              if (!pendingReasoning) return;
              const blockIndex = nextBlockIndex++;
              const timestamp = new Date().toISOString();
              const thinkingBlock: LocalThinkingBlock = {
                type: "thinking",
                thinking: pendingReasoning,
                signature: `local-openai:${randomUUID()}`,
                summaries: [],
                start_timestamp: timestamp,
                stop_timestamp: timestamp,
              };
              assistantBlocks.push(thinkingBlock);
              controller.enqueue(
                sse("content_block_start", {
                  type: "content_block_start",
                  index: blockIndex,
                  content_block: {
                    ...thinkingBlock,
                    thinking: "",
                    signature: "",
                    stop_timestamp: undefined,
                  },
                }),
              );
              controller.enqueue(
                sse("content_block_delta", {
                  type: "content_block_delta",
                  index: blockIndex,
                  delta: {
                    type: "thinking_delta",
                    thinking: pendingReasoning,
                  },
                }),
              );
              controller.enqueue(
                sse("content_block_delta", {
                  type: "content_block_delta",
                  index: blockIndex,
                  delta: {
                    type: "signature_delta",
                    signature: thinkingBlock.signature,
                  },
                }),
              );
              controller.enqueue(
                sse("content_block_stop", {
                  type: "content_block_stop",
                  index: blockIndex,
                }),
              );
              pendingReasoning = "";
            };
            for (let attempt = 0; attempt < 3; attempt += 1) {
              toolCalls = new Map();
              if (attempt > 0) pendingReasoning = "";
              const attemptTextStart = assistantText.length;
              const providerResponse = await backend.#providerCompletion(
                conversation,
                providerHistory,
                request.signal,
                attempt > 0,
                continuation,
                providerOptions,
              );
              for await (const delta of openAiDeltas(providerResponse)) {
                if (delta.type === "reasoning") {
                  pendingReasoning += delta.text;
                  continue;
                }
                if (delta.type === "text") {
                  // The native client accepts thinking before a normal text
                  // answer, but marks thinking followed directly by a tool-only
                  // artifact response as incomplete. Buffer until visible text.
                  emitPendingReasoning();
                  if (textBlockIndex === undefined) {
                    textBlockIndex = nextBlockIndex++;
                    assistantBlocks.push({
                      type: "text",
                      text: "",
                      citations: [],
                    });
                    controller.enqueue(
                      sse("content_block_start", {
                        type: "content_block_start",
                        index: textBlockIndex,
                        content_block: { type: "text", text: "" },
                      }),
                    );
                  }
                  assistantText += delta.text;
                  const textBlock = assistantBlocks.find(
                    (block): block is LocalTextBlock => block.type === "text",
                  );
                  if (textBlock) textBlock.text += delta.text;
                  controller.enqueue(
                    sse("content_block_delta", {
                      type: "content_block_delta",
                      index: textBlockIndex,
                      delta: { type: "text_delta", text: delta.text },
                    }),
                  );
                  continue;
                }
                const accumulated = toolCalls.get(delta.index) ?? {
                  id: randomUUID(),
                  name: "",
                  arguments: "",
                };
                if (delta.id) accumulated.id = delta.id;
                if (delta.name) accumulated.name += delta.name;
                if (delta.arguments)
                  accumulated.arguments += delta.arguments;
                toolCalls.set(delta.index, accumulated);
              }
              const hasToolCall = [...toolCalls.values()].some(
                (toolCall) =>
                  toolCall.name.trim() && toolCall.arguments.trim(),
              );
              if (
                assistantText.slice(attemptTextStart).trim() ||
                hasToolCall
              )
                break;
              if (attempt === 2)
                throw new Error(
                  "Provider returned no visible assistant content after three attempts",
                );
            }

            const webCalls = [...toolCalls.values()].filter(
              (toolCall) =>
                toolCall.name === "web_search" ||
                toolCall.name === "visit_website",
            );
            if (webCalls.length === 0) {
              terminalTurn = true;
              break;
            }
            carriedReasoning = pendingReasoning;
            continuation.push({
              role: "assistant",
              content: assistantText.slice(turnTextStart) || null,
              tool_calls: webCalls.map((toolCall) => ({
                id: toolCall.id,
                type: "function",
                function: {
                  name: toolCall.name,
                  arguments: toolCall.arguments || "{}",
                },
              })),
            });
            for (const toolCall of webCalls) {
              let input: JsonObject = {};
              try {
                const parsed: unknown = JSON.parse(
                  toolCall.arguments || "{}",
                );
                if (isObject(parsed)) input = parsed;
              } catch {
                // The tool receives an empty object and returns a clear error.
              }
              let output: string;
              try {
                output = backend.#webTools
                  ? await backend.#webTools.execute(
                      toolCall.name,
                      input,
                      request.signal,
                    )
                  : "Local web tools are not available in this runtime.";
              } catch (error) {
                output = `Web tool error: ${error instanceof Error ? error.message : String(error)}`;
              }
              continuation.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolCall.name,
                content: output,
              });
            }
          }
          if (!terminalTurn)
            throw new Error("The local web-tool loop exceeded eight turns");
          if (textBlockIndex !== undefined) {
            controller.enqueue(
              sse("content_block_stop", {
                type: "content_block_stop",
                index: textBlockIndex,
              }),
            );
          }

          for (const [, toolCall] of [...toolCalls].sort(
            ([left], [right]) => left - right,
          )) {
            if (toolCall.name !== "artifacts") continue;
            let rawInput: unknown;
            try {
              rawInput = JSON.parse(toolCall.arguments || "{}");
            } catch {
              rawInput = null;
            }
            const parsed = normalizeArtifactInput(rawInput);
            if (!parsed) continue;
            const input = backend.#materializeArtifact(
              conversation,
              assistantUuid,
              parsed,
            );
            const block: LocalToolUseBlock = {
              type: "tool_use",
              id: toolCall.id,
              name: "artifacts",
              input,
            };
            assistantBlocks.push(block);
            const blockIndex = nextBlockIndex++;
            const partialJson = JSON.stringify(input);
            controller.enqueue(
              sse("content_block_start", {
                type: "content_block_start",
                index: blockIndex,
                content_block: {
                  type: "tool_use",
                  id: block.id,
                  name: block.name,
                  input: {},
                },
              }),
            );
            controller.enqueue(
              sse("content_block_delta", {
                type: "content_block_delta",
                index: blockIndex,
                delta: { type: "input_json_delta", partial_json: partialJson },
              }),
            );
            controller.enqueue(
              sse("content_block_stop", {
                type: "content_block_stop",
                index: blockIndex,
              }),
            );
          }

          if (assistantBlocks.length === 0) {
            assistantBlocks.push({ type: "text", text: "", citations: [] });
            controller.enqueue(
              sse("content_block_start", {
                type: "content_block_start",
                index: 0,
                content_block: { type: "text", text: "" },
              }),
            );
            controller.enqueue(
              sse("content_block_stop", {
                type: "content_block_stop",
                index: 0,
              }),
            );
          }
          controller.enqueue(
            sse("message_delta", {
              type: "message_delta",
              delta: {
                stop_reason: assistantBlocks.some(
                  (block) => block.type === "tool_use",
                )
                  ? "tool_use"
                  : "end_turn",
                stop_details: null,
              },
            }),
          );
          controller.enqueue(sse("message_stop", { type: "message_stop" }));

          const assistant = createMessage(
            conversation,
            "assistant",
            assistantText,
            assistantUuid,
            human.uuid,
          );
          assistant.content = assistantBlocks;
          const existingAssistantIndex = conversation.chat_messages.findIndex(
            (message) => message.uuid === assistant.uuid,
          );
          if (existingAssistantIndex >= 0)
            conversation.chat_messages[existingAssistantIndex] = assistant;
          else conversation.chat_messages.push(assistant);
          conversation.current_leaf_message_uuid = assistant.uuid;
          conversation.updated_at = assistant.updated_at;
          await backend.#persist();
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          controller.enqueue(
            sse("error", {
              type: "api_error",
              error: { type: "local_provider_error", message },
              message,
            }),
          );
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "request-id": randomUUID(),
      },
    });
  }

  async #createConversation(body: JsonObject): Promise<LocalConversation> {
    const now = new Date().toISOString();
    const uuid = stringValue(body.uuid) || randomUUID();
    const existing = this.#conversation(uuid);
    if (existing) return existing;
    const conversation: LocalConversation = {
      uuid,
      name: stringValue(body.name) || "",
      summary: "",
      model: stringValue(body.model) || this.#data.provider.model,
      created_at: now,
      updated_at: now,
      is_starred: false,
      is_temporary: body.is_temporary === true,
      settings: {},
      ...(stringValue(body.project_uuid)
        ? { project_uuid: stringValue(body.project_uuid) }
        : {}),
      chat_messages: [],
    };
    this.#data.conversations.unshift(conversation);
    await this.#persist();
    return conversation;
  }

  async handle(request: Request, url: URL): Promise<Response | null> {
    const pathname = url.pathname.startsWith("/edge-api/")
      ? `/api/${url.pathname.slice(10)}`
      : url.pathname;

    if (pathname === "/api/local/config") {
      if (request.method === "GET") {
        const { apiKey: _key, ...provider } = this.#data.provider;
        return new Response(
          JSON.stringify({ provider, hasApiKey: Boolean(_key) }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      if (request.method === "PUT") {
        try {
          const body = await jsonBody(request);
          const apiKey =
            body.apiKey === null
              ? undefined
              : stringValue(body.apiKey) || this.#data.provider.apiKey;
          this.#data.provider = configuredProvider({
            baseUrl: stringValue(body.baseUrl),
            model: stringValue(body.model),
            contextWindow: Number(body.contextWindow),
            apiKey,
          });
          await this.#persist();
          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return errorResponse(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
      return new Response(null, { status: 405 });
    }

    if (
      pathname === "/api/local/models" &&
      (request.method === "GET" || request.method === "POST")
    ) {
      try {
        const input = request.method === "POST" ? await jsonBody(request) : {};
        const requestedBaseUrl = stringValue(input.baseUrl);
        const requestedApiKey = stringValue(input.apiKey);
        const provider = requestedBaseUrl
          ? {
              baseUrl: normalizeBaseUrl(requestedBaseUrl),
              apiKey: requestedApiKey || this.#data.provider.apiKey,
            }
          : this.#data.provider;
        const response = await fetch(`${provider.baseUrl}/models`, {
          headers: provider.apiKey
            ? { Authorization: `Bearer ${provider.apiKey}` }
            : {},
        });
        if (!response.ok)
          throw new Error(`Provider returned HTTP ${response.status}`);
        const body = (await response.json()) as unknown;
        const data =
          isObject(body) && Array.isArray(body.data) ? body.data : [];
        const models = data.flatMap((entry) => {
          if (!isObject(entry)) return [];
          const id = stringValue(entry.id);
          return id ? [id] : [];
        });
        const contextWindows = Object.fromEntries(
          data.flatMap((entry) => {
            if (!isObject(entry)) return [];
            const id = stringValue(entry.id);
            const meta = isObject(entry.meta) ? entry.meta : {};
            const contextWindow = Number(
              meta.n_ctx ?? entry.context_length ?? entry.max_model_len,
            );
            return id && Number.isFinite(contextWindow) && contextWindow >= 1024
              ? [[id, Math.floor(contextWindow)]]
              : [];
          }),
        );
        return new Response(JSON.stringify({ models, contextWindows }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : String(error),
          502,
        );
      }
    }

    if (
      /^\/api\/organizations\/[^/]+\/convert_document$/.test(pathname) &&
      request.method === "POST"
    ) {
      try {
        const file = await this.#uploadedFile(request);
        if (file.size > MAX_LOCAL_FILE_BYTES)
          return errorResponse(
            "Uploaded file exceeds the 50 MB local limit",
            413,
          );
        const fileName = cleanFileName(file.name || "attachment");
        const fileType = file.type || "application/octet-stream";
        const bytes = new Uint8Array(await file.arrayBuffer());
        const extractedContent = extractLocalText(bytes, fileName, fileType);
        if (extractedContent === undefined)
          return new Response(
            JSON.stringify({
              error: {
                type: "invalid_file_type",
                message:
                  "This local build can extract text, code, CSV, JSON, HTML, SVG, and Markdown files.",
              },
            }),
            {
              status: 415,
              headers: { "Content-Type": "application/json" },
            },
          );
        return new Response(
          JSON.stringify({
            file_name: fileName,
            file_type: fileType,
            file_size: bytes.byteLength,
            extracted_content: extractedContent,
            origin: "user_upload",
            kind: "file",
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const uploadRoute =
      /^\/api\/[^/]+\/upload$/.test(pathname) ||
      /^\/api\/organizations\/[^/]+\/projects\/[^/]+\/upload$/.test(pathname) ||
      /^\/api\/organizations\/[^/]+\/conversations\/[^/]+\/wiggle\/upload-file$/.test(
        pathname,
      );
    if (uploadRoute && request.method === "POST") {
      try {
        const stored = await this.#storeUploadedFile(
          await this.#uploadedFile(request),
        );
        return new Response(JSON.stringify(this.#fileResponse(stored)), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResponse(message, message.includes("50 MB") ? 413 : 400);
      }
    }

    const fileRoute = pathname.match(
      /^\/api\/organizations\/[^/]+\/files\/([^/]+)(?:\/(download|content_preview))?$/,
    );
    if (fileRoute && request.method === "GET") {
      const file = this.#storedFile(decodeURIComponent(fileRoute[1]));
      if (!file) return errorResponse("File not found", 404);
      if (fileRoute[2] === "content_preview") {
        return new Response(
          JSON.stringify({
            file_type: "generic",
            file_name: file.file_name,
            content: file.extracted_content ?? null,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      try {
        const bytes = await readFile(this.#storedFilePath(file));
        return new Response(bytes, {
          headers: {
            "Content-Type": file.file_type,
            "Content-Length": String(file.size_bytes),
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
          },
        });
      } catch {
        return errorResponse("Stored file is unavailable", 404);
      }
    }

    const artifactVersion = pathname.match(
      /^\/api\/organizations\/[^/]+\/artifact-versions\/([^/]+)$/,
    );
    if (artifactVersion && request.method === "GET") {
      const uuid = decodeURIComponent(artifactVersion[1]);
      const version = this.#data.artifacts
        .flatMap((artifact) => artifact.versions)
        .find((candidate) => candidate.uuid === uuid);
      return version
        ? new Response(JSON.stringify(artifactVersionResponse(version)), {
            headers: { "Content-Type": "application/json" },
          })
        : errorResponse("Artifact version not found", 404);
    }

    const latestArtifactVersion = pathname.match(
      /^\/api\/organizations\/[^/]+\/artifact-versions\/by-artifact\/([^/]+)$/,
    );
    if (latestArtifactVersion && request.method === "GET") {
      const uuid = decodeURIComponent(latestArtifactVersion[1]);
      const artifact = this.#data.artifacts.find(
        (candidate) =>
          candidate.uuid === uuid || candidate.artifact_identifier === uuid,
      );
      const version = artifact?.versions.at(-1);
      return version
        ? new Response(JSON.stringify(artifactVersionResponse(version)), {
            headers: { "Content-Type": "application/json" },
          })
        : errorResponse("Artifact not found", 404);
    }

    if (
      /^\/api\/organizations\/[^/]+\/user_artifacts\/count$/.test(pathname) &&
      request.method === "GET"
    ) {
      return new Response(
        JSON.stringify({ count: this.#data.artifacts.length }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (
      /^\/api\/organizations\/[^/]+\/user_artifacts$/.test(pathname) &&
      request.method === "GET"
    ) {
      const artifacts = this.#data.artifacts
        .slice()
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
        .map((artifact) => {
          const latest = artifact.versions.at(-1);
          return {
            uuid: artifact.uuid,
            artifact_identifier: artifact.artifact_identifier,
            artifact_type: artifact.artifact_type,
            title: artifact.title,
            chat_conversation_uuid: artifact.conversation_uuid,
            preview: latest?.content.slice(0, 500) ?? "",
            updated_at: artifact.updated_at,
            latest_artifact_version_uuid: latest?.uuid ?? null,
            latest_published_artifact_uuid: null,
            visibility: "private",
          };
        });
      return new Response(JSON.stringify({ artifacts }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const collection = pathname.match(
      /^\/api\/organizations\/[^/]+\/chat_conversations(?:_v2)?$/,
    );
    if (collection) {
      if (request.method === "POST") {
        try {
          return new Response(
            JSON.stringify(
              conversationSummary(
                await this.#createConversation(await jsonBody(request)),
              ),
            ),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (error) {
          return errorResponse(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
      if (request.method === "GET") {
        const starred = url.searchParams.get("starred");
        const search = url.searchParams.get("searchQuery")?.toLowerCase();
        const offset = Number(url.searchParams.get("offset") || 0);
        const limit = Number(url.searchParams.get("limit") || 30);
        const filtered = this.#data.conversations.filter(
          (conversation) =>
            (starred === null ||
              conversation.is_starred === (starred === "true")) &&
            (!search || conversation.name.toLowerCase().includes(search)),
        );
        const data = filtered
          .slice(offset, offset + limit)
          .map(conversationSummary);
        return new Response(
          JSON.stringify({ data, has_more: offset + limit < filtered.length }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const item = pathname.match(
      /^\/api\/organizations\/[^/]+\/chat_conversations\/([^/]+)$/,
    );
    if (item) {
      const uuid = decodeURIComponent(item[1]);
      const conversation = this.#conversation(uuid);
      if (!conversation) return errorResponse("Conversation not found", 404);
      if (request.method === "GET")
        return new Response(JSON.stringify(conversation), {
          headers: { "Content-Type": "application/json" },
        });
      if (request.method === "DELETE") {
        const candidateFiles = new Set(
          conversation.chat_messages.flatMap((message) =>
            message.files.map((file) => file.file_uuid),
          ),
        );
        this.#data.conversations = this.#data.conversations.filter(
          (candidate) => candidate.uuid !== uuid,
        );
        this.#data.artifacts = this.#data.artifacts.filter(
          (artifact) => artifact.conversation_uuid !== uuid,
        );
        const retainedFileUuids = new Set(
          this.#data.conversations.flatMap((candidate) =>
            candidate.chat_messages.flatMap((message) =>
              message.files.map((file) => file.file_uuid),
            ),
          ),
        );
        const removedFiles = this.#data.files.filter(
          (file) =>
            candidateFiles.has(file.uuid) && !retainedFileUuids.has(file.uuid),
        );
        this.#data.files = this.#data.files.filter(
          (file) => !removedFiles.includes(file),
        );
        await Promise.all(
          removedFiles.map((file) =>
            rm(this.#storedFilePath(file), { force: true }).catch(
              () => undefined,
            ),
          ),
        );
        await this.#persist();
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (request.method === "PUT") {
        const body = await jsonBody(request);
        if (typeof body.name === "string") conversation.name = body.name;
        if (typeof body.is_starred === "boolean")
          conversation.is_starred = body.is_starred;
        if (isObject(body.settings))
          conversation.settings = {
            ...conversation.settings,
            ...body.settings,
          };
        conversation.updated_at = new Date().toISOString();
        await this.#persist();
        return new Response(JSON.stringify(conversationSummary(conversation)), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const completion = pathname.match(
      /^\/api\/organizations\/[^/]+\/chat_conversations\/([^/]+)\/(?:retry_)?completion2?$/,
    );
    if (completion && request.method === "POST") {
      try {
        return await this.#completion(
          request,
          decodeURIComponent(completion[1]),
          /\/retry_completion2?$/.test(pathname),
        );
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const title = pathname.match(
      /^\/api\/organizations\/[^/]+\/chat_conversations\/([^/]+)\/title2?$/,
    );
    if (title && request.method === "POST") {
      const conversation = this.#conversation(decodeURIComponent(title[1]));
      if (!conversation) return errorResponse("Conversation not found", 404);
      return new Response(JSON.stringify({ title: conversation.name }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return null;
  }
}
