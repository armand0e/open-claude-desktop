import {
  access,
  open,
  readdir,
  realpath,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { constants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { app, dialog, net, protocol, shell } from "electron";
import { resolveInside } from "../shared/security";
import {
  isRemovedCoworkHttpPath,
  REMOVED_COWORK_MESSAGE,
} from "../shared/removed-product";
import {
  DISABLED_PATCH_IDS,
  LOCAL_CLIENT_PATCHES,
  patchedClientAssets,
} from "./client-patches";
import { growthbookFeatureKey } from "../shared/growthbook";
import { LocalBackend } from "./local-backend";
import { LocalCodeSessionManager } from "./local-code";
import {
  DEFAULT_EXPORT_OPTIONS,
  ExportCodeSession,
  ExportConversation,
  TrainingExportOptions,
  buildTrainingExport,
  conversationMarkdown,
  normalizeTrainingExportOptions,
  safeFileName,
} from "./local-export";
import {
  bundledWhisperPaths,
  transcribeWithBundledWhisper,
} from "./local-whisper";
import { LocalArtifactTunnel } from "./local-tunnel";
import { readResponseJson, readResponseText } from "./bounded-response";

const MAX_LOCAL_UI_JSON_BYTES = 8 * 1024 * 1024;
const MAX_DICTATION_BYTES = 25_000_000;
const MAX_TRANSCRIPTION_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_LOCAL_UI_ASSET_BYTES = 64 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function localArtifactRendererHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Local artifact renderer</title>
  <style>
    html,body,#mount{width:100%;height:100%;margin:0;overflow:auto;background:#fff;color:#181817}
    body{font:14px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    #mount>iframe{display:block;width:100%;height:100%;border:0;background:#fff}
    pre{box-sizing:border-box;min-height:100%;margin:0;padding:24px;white-space:pre-wrap;overflow:auto;font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}
    article{box-sizing:border-box;max-width:900px;margin:0 auto;padding:32px;font-size:16px;line-height:1.7}
    article pre{min-height:0;padding:16px;border-radius:10px;background:#f2f1ed}
    .notice{margin:16px;padding:12px 14px;border:1px solid #d8d5ce;border-radius:10px;background:#f7f6f2;color:#5f5d58}
  </style>
</head>
<body><div id="mount"></div>
<script>
(function(){
  "use strict";
  var EMPTY={"@type":"type.googleapis.com/google.protobuf.Empty"};
  var READY="anthropic.claude.usercontent.sandbox.ReadyForContent";
  var SET_CONTENT="anthropic.claude.usercontent.sandbox.SetContent";
  var DOM_LOADED="anthropic.claude.usercontent.sandbox.DOMContentLoaded";
  var parentOrigin=new URLSearchParams(location.search).get("parentOrigin")||"app://localhost";
  var channel=null;
  var mount=document.getElementById("mount");
  var currentContent="";
  var currentType="text/plain";
  var requestSequence=0;

  function send(message){
    if(channel) channel.postMessage(message);
    else window.parent.postMessage(message,parentOrigin);
  }
  function request(method,payload){
    send({channel:"request",requestId:"local-renderer-"+(++requestSequence)+"-"+Date.now(),method:method,payload:payload||EMPTY});
  }
  function respond(requestId,payload,status){
    send({channel:"response",requestId:requestId,status:status||200,payload:payload||EMPTY});
  }
  function escapeHtml(value){
    return String(value).replace(/[&<>\"]/g,function(character){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[character]});
  }
  function notifyRendered(){
    window.parent.postMessage({type:"local-artifact-rendered",artifactType:currentType,contentLength:currentContent.length},parentOrigin);
  }
  function renderMarkdown(content){
    var escaped=escapeHtml(content);
    var html=escaped
      .replace(/\`\`\`([\\w-]*)\\n([\\s\\S]*?)\`\`\`/g,"<pre><code>$2</code></pre>")
      .replace(/^### (.+)$/gm,"<h3>$1</h3>")
      .replace(/^## (.+)$/gm,"<h2>$1</h2>")
      .replace(/^# (.+)$/gm,"<h1>$1</h1>")
      .replace(/\\*\\*([^*]+)\\*\\*/g,"<strong>$1</strong>")
      .replace(/\\*([^*]+)\\*/g,"<em>$1</em>")
      .replace(/\\n{2,}/g,"</p><p>")
      .replace(/\\n/g,"<br>");
    mount.innerHTML="<article><p>"+html+"</p></article>";
  }
  function render(content,type){
    currentContent=typeof content==="string"?content:"";
    currentType=type||"text/plain";
    mount.replaceChildren();
    if(currentType==="text/html"||currentType==="image/svg+xml"){
      var frame=document.createElement("iframe");
      frame.setAttribute("sandbox","allow-scripts allow-forms allow-modals allow-popups allow-downloads");
      frame.setAttribute("title","Artifact preview content");
      frame.srcdoc=currentType==="image/svg+xml"
        ? "<!doctype html><style>html,body{margin:0;width:100%;height:100%}svg{max-width:100%;height:auto}</style>"+currentContent
        : currentContent;
      frame.addEventListener("load",function(){request(DOM_LOADED,EMPTY);notifyRendered();},{once:true});
      mount.appendChild(frame);
      return;
    }
    if(currentType==="text/markdown"){
      renderMarkdown(currentContent);
      request(DOM_LOADED,EMPTY);
      notifyRendered();
      return;
    }
    if(currentType==="application/vnd.ant.react"||currentType==="application/vnd.ant.mermaid"){
      var notice=document.createElement("div");
      notice.className="notice";
      notice.textContent=currentType==="application/vnd.ant.react"
        ? "Local React preview is shown as source until its imports can be resolved."
        : "Local Mermaid preview is shown as source.";
      var source=document.createElement("pre");
      source.textContent=currentContent;
      mount.append(notice,source);
      request(DOM_LOADED,EMPTY);
      notifyRendered();
      return;
    }
    var pre=document.createElement("pre");
    pre.textContent=currentContent;
    mount.appendChild(pre);
    request(DOM_LOADED,EMPTY);
    notifyRendered();
  }
  function handle(message){
    if(!message||message.channel!=="request"||typeof message.requestId!=="string") return;
    if(message.method===SET_CONTENT){
      render(message.payload&&message.payload.content,message.payload&&message.payload.type);
      respond(message.requestId,EMPTY);
      return;
    }
    if(message.method==="anthropic.claude.usercontent.sandbox.GetScreenshot"){
      respond(message.requestId,{"@type":"type.googleapis.com/anthropic.claude.usercontent.sandbox.GetScreenshotResponse",screenshot:null});
      return;
    }
    if(message.method==="anthropic.claude.usercontent.sandbox.CopyHtmlContent"){
      respond(message.requestId,{"@type":"type.googleapis.com/anthropic.claude.usercontent.sandbox.CopyHtmlContentResponse",reportHTMLContent:currentType==="text/html"?currentContent:mount.innerHTML});
      return;
    }
    if(message.method==="anthropic.claude.usercontent.sandbox.GetDOMSnapshot"){
      respond(message.requestId,{"@type":"type.googleapis.com/anthropic.claude.usercontent.sandbox.GetDOMSnapshotResponse",domSnapshot:mount.innerHTML});
      return;
    }
    respond(message.requestId,EMPTY);
  }
  window.addEventListener("message",function(event){
    if(event.origin!==parentOrigin||event.source!==window.parent) return;
    if(event.data&&event.data.type==="__sandbox_handshake__"&&event.ports&&event.ports[0]){
      channel=event.ports[0];
      channel.onmessage=function(portEvent){handle(portEvent.data);};
      channel.start();
      request(READY,EMPTY);
      return;
    }
    handle(event.data);
  });
  window.parent.postMessage({type:"__sandbox_handshake_request__"},parentOrigin);
  setTimeout(function(){if(!channel)request(READY,EMPTY);},250);
})();
<\/script></body></html>`;
}

export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "app",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: false,
      },
    },
    {
      scheme: "claude-local-preview",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
    {
      scheme: "claude-local-launch",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);
}

function pathIsInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}

async function canonicalRegularFile(
  canonicalRoot: string,
  candidate: string,
): Promise<string | null> {
  try {
    const canonical = await realpath(candidate);
    if (!pathIsInside(canonicalRoot, canonical)) return null;
    return (await stat(canonical)).isFile() ? canonical : null;
  } catch {
    return null;
  }
}

async function readLocalUiAsset(
  candidate: string,
  canonicalRoot: string,
): Promise<Buffer | null> {
  const handle = await open(
    candidate,
    constants.O_RDONLY |
      (process.platform === "win32" ? 0 : constants.O_NOFOLLOW),
  ).catch(() => null);
  if (!handle) return null;
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > MAX_LOCAL_UI_ASSET_BYTES) return null;
    const confirmed = await realpath(candidate);
    if (!pathIsInside(canonicalRoot, confirmed)) return null;
    const confirmedInfo = await stat(confirmed);
    if (confirmedInfo.dev !== info.dev || confirmedInfo.ino !== info.ino)
      return null;
    const source = await handle.readFile();
    return source.byteLength <= MAX_LOCAL_UI_ASSET_BYTES ? source : null;
  } finally {
    await handle.close().catch(() => undefined);
  }
}

const API_PREFIXES = [
  "/api/",
  "/edge-api/",
  "/v1/",
  "/v2/",
  "/mcp-registry/",
  "/sandbox/",
];

function isApiPath(pathname: string): boolean {
  return (
    !/\.(?:m?[jt]sx?|css|map)$/.test(pathname) &&
    API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function atomicExportWrite(
  filePath: string,
  content: string,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, filePath);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

async function uniqueExportDirectory(
  parent: string,
  name: string,
): Promise<string> {
  await mkdir(parent, { recursive: true });
  for (let suffix = 0; suffix < 10_000; suffix += 1) {
    const candidate = path.join(
      parent,
      suffix === 0 ? name : `${name}-${suffix}`,
    );
    try {
      await mkdir(candidate);
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new Error("Could not allocate a unique export directory");
}

class LocalUiRequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

async function readRequestBytes(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new LocalUiRequestError("Request body exceeds the safety limit", 413);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new LocalUiRequestError(
          "Request body exceeds the safety limit",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

async function readLocalJson(request: Request): Promise<unknown> {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      await readRequestBytes(request, MAX_LOCAL_UI_JSON_BYTES),
    );
  } catch (error) {
    if (error instanceof LocalUiRequestError) throw error;
    throw new LocalUiRequestError("Request body is not valid UTF-8");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new LocalUiRequestError("Request body is not valid JSON");
  }
}

function currentUserAccess(): Record<string, unknown> {
  return {
    features: [
      "chat",
      "claude_code",
      "claude_code_web",
      "claude_code_desktop",
      "skills",
      "cobalt_plinth",
      "web_search",
    ].map((feature) => ({
      feature,
      status: "available",
    })),
  };
}

const LOCAL_ORG_UUID = "00000000-0000-4000-8000-000000000001";
const LOCAL_ACCOUNT_UUID = "00000000-0000-4000-8000-000000000002";
const LOCAL_CREATED_AT = "2026-01-01T00:00:00.000Z";

let cachedLocalDisplayName: string | undefined;

function localDisplayName(): string {
  if (cachedLocalDisplayName) return cachedLocalDisplayName;
  const configured = process.env.CLAUDE_LOCAL_USER_NAME?.trim();
  if (configured) return (cachedLocalDisplayName = configured);
  if (process.platform === "win32") {
    try {
      const fullName = execFileSync(
        "powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "(Get-LocalUser -Name $env:USERNAME).FullName",
        ],
        {
          encoding: "utf8",
          timeout: 2_000,
          windowsHide: true,
          stdio: ["ignore", "pipe", "ignore"],
        },
      ).trim();
      const firstName = fullName.split(/\s+/u)[0]?.trim();
      if (firstName) return (cachedLocalDisplayName = firstName);
    } catch {
      // Fall through to the portable username-derived label.
    }
  }
  const username = (process.env.USERNAME || process.env.USER || "").trim();
  if (!username) return (cachedLocalDisplayName = "Local User");
  return (cachedLocalDisplayName = username
    .replace(/[._-]+/gu, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase()));
}

function personalizedGreeting(
  name = localDisplayName(),
): Array<Record<string, unknown>> {
  return [
    {
      surface: "chat",
      default_slots: [
        { until: 5, text: "Moonlit chat?" },
        { until: 11, text: `Good morning, ${name}.` },
        { until: 14, text: `What are we working on today, ${name}?` },
        { until: 18, text: `What’s next, ${name}?` },
        { until: 22, text: `Good evening, ${name}. What can I help with?` },
        { until: 24, text: "Moonlit chat?" },
      ],
    },
  ];
}

function localModelId(configuredModel?: string): string {
  return (
    process.env.CLAUDE_LOCAL_MODEL?.trim() || configuredModel || "local-model"
  );
}

function localOrganization(configuredModel?: string): Record<string, unknown> {
  const model = localModelId(configuredModel);
  return {
    uuid: LOCAL_ORG_UUID,
    id: 0,
    name: "Local",
    settings: {},
    parent_organization_uuid: null,
    capabilities: ["chat", "claude_pro"],
    billing_type: "stripe_subscription",
    free_credits_status: null,
    api_disabled_reason: null,
    api_disabled_until: null,
    rate_limit_tier: null,
    data_retention: null,
    raven_type: null,
    claude_ai_bootstrap_models_config: [
      { model, name: model, label_override: model },
    ],
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function localAccount(
  configuredModel?: string,
  profile: Record<string, unknown> = {},
  accountSettings: Record<string, unknown> = {},
): Record<string, unknown> {
  const fullName =
    (typeof profile.full_name === "string" && profile.full_name.trim()) ||
    localDisplayName();
  const displayName =
    (typeof profile.display_name === "string" && profile.display_name.trim()) ||
    fullName;
  return {
    ...profile,
    tagged_id: `local_${LOCAL_ACCOUNT_UUID}`,
    uuid: LOCAL_ACCOUNT_UUID,
    email_address: "local@localhost",
    full_name: fullName,
    display_name: displayName,
    created_at: LOCAL_CREATED_AT,
    updated_at: LOCAL_CREATED_AT,
    accepted_clickwrap_versions: {},
    is_verified: true,
    age_is_verified: true,
    memberships: [
      {
        role: "admin",
        seat_tier: "unassigned",
        created_at: LOCAL_CREATED_AT,
        updated_at: LOCAL_CREATED_AT,
        organization: localOrganization(configuredModel),
      },
    ],
    workspace_memberships: [],
    invites: [],
    settings: {
      enabled_geolocation: false,
      enabled_web_search: true,
      // The retained chat renderer gates the artifact pane on this account
      // flag when a stored conversation is rehydrated; without it, artifact
      // cards render but clicking them cannot open the panel after a restart
      // or when returning to an old chat.
      preview_feature_uses_artifacts: true,
      // Memory ("saffron") defaults on; the native Settings/Customize
      // toggles persist overrides through the account-settings endpoint.
      enabled_saffron: true,
      // Code execution ("wiggle"), browser use, and computer use default
      // off until enabled in the local Capabilities settings panel.
      enabled_wiggle: false,
      enabled_wiggle_egress: false,
      enabled_browser_use: false,
      enabled_computer_use: false,
      ...accountSettings,
    },
  };
}

function modelSelectorConfig(
  configuredModel?: string,
): Array<Record<string, unknown>> {
  const model = localModelId(configuredModel);
  const models = [
    {
      id: model,
      name: model,
      description: "Configured OpenAI-compatible model",
      thinking: {
        description: "Control whether the local model uses thinking",
        mode_options: [
          {
            id: "off",
            name: "Instant",
            description: "Respond without extended thinking",
          },
          {
            id: "extended",
            name: "Thinking",
            description: "Enable thinking for complex work",
          },
        ],
      },
    },
  ];
  return ["code", "chat"].map((id) => ({ id, models }));
}

function modelSelectorState(
  configuredModel?: string,
  enableThinking = false,
): Array<Record<string, unknown>> {
  const model = localModelId(configuredModel);
  const thinking = {
    type: "mode",
    mode: enableThinking ? "extended" : "off",
  };
  return ["code", "chat"].map((id) => ({
    id,
    model,
    source: "global_default",
    thinking,
    thinking_by_model: [{ id: model, thinking }],
  }));
}

function growthbookFeatures(configuredModel?: string): Record<string, unknown> {
  const enabled = (defaultValue: unknown) => ({ defaultValue });
  return {
    // Scheduled tasks on the Code surface (/epitaxy/scheduled) — backed by
    // the local claude.web.CCDScheduledTasks service.
    [growthbookFeatureKey("chilling_sloth_clocks")]: enabled(true),
    // Native Code-mode browser panel (tabs, address bar, screenshots, and
    // loopback dev-server previews) backed by LocalLaunchPreview.
    [growthbookFeatureKey("frontend_preview_external_domains")]: enabled(true),
    // Settings dialog "Customize" group: Skills / Connectors / Plugins
    // sections hosting the native customize pages (the legacy Connectors
    // section is a hard-coded "moved to Customize" stub in this build).
    [growthbookFeatureKey("claude_ai_tupelo")]: enabled(true),
    [growthbookFeatureKey("dramatic_shrimp_force_local")]: enabled(false),
    [growthbookFeatureKey("yukon_silver")]: enabled(false),
    "1101873029": enabled(false),
    "3150971238": enabled(false),
    "3007887412": enabled(false),
    "350336616": enabled(false),
    "1138175852": enabled(false),
    "954625922": enabled(true),
    "1441987769": enabled(false),
    "3086952380": enabled(false),
    "986399546": enabled(true),
    "2895944283": enabled(true),
    "2547348043": enabled(true),
    "1215221242": enabled(true),
    "1588340729": enabled(true),
    "4085357330": enabled(true),
    "3368286709": enabled(true),
    "3615229285": enabled(true),
    [growthbookFeatureKey("yukon_silver_clocks")]: enabled(false),
    [growthbookFeatureKey("cowork_scheduled_starter_templates")]:
      enabled(false),
    "700397605": enabled(true),
    [growthbookFeatureKey("yukon_silver_config")]: enabled(false),
    [growthbookFeatureKey("yukon_silver_settings")]: enabled(false),
    "4108768567": enabled(true),
    "3070110303": enabled(true),
    "2431502897": enabled("inherit"),
    "2973881027": enabled({
      model: localModelId(configuredModel),
      overrideSticky: false,
      nuxId: null,
    }),
  };
}

function bootstrapPayload(
  configuredModel?: string,
  profile: Record<string, unknown> = {},
  accountSettings: Record<string, unknown> = {},
  enableThinking = false,
): Record<string, unknown> {
  const account = localAccount(configuredModel, profile, accountSettings);
  return {
    account,
    current_user_access: currentUserAccess(),
    locale: null,
    statsig: {
      user: { userID: randomUUID() },
      values: {},
      values_hash: "custom3p",
    },
    growthbook: { features: growthbookFeatures(configuredModel) },
    model_selector_config: modelSelectorConfig(configuredModel),
    model_selector_state: modelSelectorState(configuredModel, enableThinking),
    personalized_greeting: personalizedGreeting(
      typeof account.display_name === "string"
        ? account.display_name
        : localDisplayName(),
    ),
    intercom_account_hash: null,
    system_prompts: {},
  };
}

function traceLocalApi(request: Request, pathname: string): void {
  if (process.env.CLAUDE_TRACE_LOCAL_API === "1")
    console.error(`[local-api] ${request.method} ${pathname}`);
}

async function localApiResponse(
  request: Request,
  url: URL,
  backend: LocalBackend,
  codeSessions: LocalCodeSessionManager,
): Promise<Response | null> {
  const pathname = url.pathname;
  traceLocalApi(request, pathname);
  const normalized = pathname.startsWith("/edge-api/")
    ? `/api/${pathname.slice(10)}`
    : pathname;
  try {
    if (normalized === "/api/frame/frames" && request.method === "GET") {
      const artifacts = (await codeSessions.invoke(
        "getAllArtifacts",
        [],
      )) as Array<Record<string, unknown>>;
      return jsonResponse({
        frames: artifacts.map((artifact) => ({
          slug: artifact.id,
          title: artifact.title,
          label: artifact.title,
          description: artifact.sessionTitle,
          source_surface: "code",
          rel: "mine",
          audience: "owner",
          updatedAt: artifact.updatedAt,
          created_at: artifact.updatedAt,
          last_viewed_at: artifact.updatedAt,
          softDeleted: false,
          starred: false,
        })),
        starsEnabled: false,
      });
    }
    if (normalized === "/api/frame/track" && request.method === "POST")
      return new Response(null, { status: 204 });
    if (
      request.method === "GET" &&
      normalized === "/api/published_artifacts/view_counts"
    )
      return jsonResponse([]);
    const localFrameMatch = normalized.match(
      /^\/api\/frame\/([0-9a-f-]{36})$/i,
    );
    if (localFrameMatch) {
      if (request.method === "DELETE") {
        const deleted = await codeSessions.invoke("deleteArtifactById", [
          localFrameMatch[1].toLowerCase(),
        ]);
        return new Response(null, { status: deleted ? 204 : 404 });
      }
      if (request.method === "GET") {
        const artifact = (await codeSessions.invoke("readArtifactById", [
          localFrameMatch[1].toLowerCase(),
        ])) as Record<string, unknown> | null;
        return artifact
          ? jsonResponse({
              uuid: localFrameMatch[1].toLowerCase(),
              title: artifact.title,
              updated_at: artifact.updatedAt,
              perm: {
                role: "owner",
                mode: "private",
                writersEnabled: false,
                assignableReadModes: ["private"],
                mayWiden: false,
              },
              author: { display_name: "Local User" },
            })
          : jsonResponse(
              { error: { type: "not_found_error", message: "Not found" } },
              404,
            );
      }
      return new Response(null, { status: 405 });
    }
    if (
      normalized === "/api/local/code/artifacts" &&
      request.method === "GET"
    ) {
      return jsonResponse({
        artifacts: await codeSessions.invoke("getAllArtifacts", []),
      });
    }
    if (normalized === "/api/local/code/artifact" && request.method === "GET") {
      const artifact = await codeSessions.invoke("readArtifact", [
        url.searchParams.get("sessionId"),
        url.searchParams.get("url"),
      ]);
      return artifact
        ? jsonResponse({ artifact })
        : jsonResponse({ error: { message: "Artifact not found" } }, 404);
    }
    if (
      normalized === "/api/local/code/artifact/open" &&
      request.method === "POST"
    ) {
      const input = objectValue(await readLocalJson(request));
      const artifact = (await codeSessions.invoke("readArtifact", [
        input.sessionId,
        input.url,
      ])) as Record<string, unknown> | null;
      if (!artifact || typeof artifact.path !== "string")
        return jsonResponse({ error: { message: "Artifact not found" } }, 404);
      const action = input.action === "reveal" ? "reveal" : "open";
      if (action === "reveal") shell.showItemInFolder(artifact.path);
      else {
        const error = await shell.openPath(artifact.path);
        if (error) return jsonResponse({ error: { message: error } }, 500);
      }
      return jsonResponse({ ok: true });
    }
    if (
      normalized === "/api/local/dictation/transcribe" &&
      request.method === "POST"
    ) {
      // Batch speech-to-text: the bundled whisper.cpp model transcribes fully
      // offline; a provider /audio/transcriptions endpoint is the fallback
      // when the bundled model is absent or fails.
      try {
        const provider = backend.provider();
        const audio = Buffer.from(
          await readRequestBytes(request, MAX_DICTATION_BYTES),
        );
        if (audio.length === 0)
          return jsonResponse({ error: { message: "Empty recording" } }, 400);
        if (audio.length > 25_000_000)
          return jsonResponse(
            { error: { message: "Recording too long" } },
            400,
          );
        const mime = request.headers.get("content-type") || "audio/webm";
        if (
          mime.includes("wav") &&
          bundledWhisperPaths() &&
          process.env.CLAUDE_LOCAL_TRANSCRIBE_PREFER !== "provider"
        ) {
          try {
            return jsonResponse({
              text: await transcribeWithBundledWhisper(audio, request.signal),
            });
          } catch {
            if (request.signal.aborted)
              throw new LocalUiRequestError("Transcription was cancelled", 499);
            // The provider path below is the fallback.
          }
        }
        const form = new FormData();
        form.append(
          "file",
          new Blob([audio], { type: mime }),
          mime.includes("ogg") ? "recording.ogg" : "recording.webm",
        );
        form.append(
          "model",
          process.env.CLAUDE_LOCAL_TRANSCRIBE_MODEL || "whisper-1",
        );
        const upstream = await fetch(
          `${provider.baseUrl}/audio/transcriptions`,
          {
            method: "POST",
            headers: provider.apiKey
              ? { Authorization: `Bearer ${provider.apiKey}` }
              : {},
            body: form,
            signal: AbortSignal.any([
              request.signal,
              AbortSignal.timeout(120_000),
            ]),
          },
        );
        if (!upstream.ok) {
          const detail = (
            await readResponseText(
              upstream,
              64 * 1024,
              "Transcription error response",
            ).catch(() => "")
          ).slice(0, 300);
          return jsonResponse(
            {
              error: {
                message:
                  upstream.status === 404
                    ? "The provider has no /audio/transcriptions endpoint. Run a Whisper-compatible server (for example faster-whisper-server) at the same base URL, or set CLAUDE_LOCAL_TRANSCRIBE_MODEL."
                    : `Transcription failed: HTTP ${upstream.status}${detail ? ` — ${detail}` : ""}`,
              },
            },
            502,
          );
        }
        const payload = (await readResponseJson(
          upstream,
          MAX_TRANSCRIPTION_RESPONSE_BYTES,
          "Transcription response",
        )) as { text?: unknown };
        return jsonResponse({
          text: typeof payload.text === "string" ? payload.text : "",
        });
      } catch (error) {
        return jsonResponse(
          {
            error: {
              message: error instanceof Error ? error.message : String(error),
            },
          },
          error instanceof LocalUiRequestError ? error.status : 502,
        );
      }
    }
    // Client telemetry batches have no local sink; acknowledge them so the
    // console stays free of 503 noise on every surface.
    if (normalized.startsWith("/api/event_logging/"))
      return request.method === "POST"
        ? jsonResponse({ ok: true })
        : new Response(null, { status: 405 });
    // The retained Code pane still resolves its workspace and title through
    // the canonical session endpoint even for locally owned sessions. Mirror
    // the local session metadata here so native preview/browser hooks have a
    // cwd and do not fall through to the third-party-mode 503 response.
    const localSessionMatch = /^\/v1\/sessions\/([^/]+)(\/events)?$/u.exec(
      normalized,
    );
    if (localSessionMatch && request.method === "GET") {
      let sessionId: string;
      try {
        sessionId = decodeURIComponent(localSessionMatch[1]);
      } catch {
        return new Response(null, { status: 400 });
      }
      const session = (await codeSessions.invoke("getSession", [
        sessionId,
      ])) as Record<string, unknown> | null;
      if (!session) return new Response(null, { status: 404 });
      if (localSessionMatch[2])
        return jsonResponse({ data: [], has_more: false, last_id: null });
      const createdAt = new Date(
        typeof session.createdAt === "number" ? session.createdAt : Date.now(),
      ).toISOString();
      const updatedAt = new Date(
        typeof session.lastActivityAt === "number"
          ? session.lastActivityAt
          : Date.now(),
      ).toISOString();
      return jsonResponse({
        uuid: session.sessionId,
        id: session.sessionId,
        title: session.title,
        cwd: session.cwd,
        worktreePath: session.cwd,
        worktree_path: session.cwd,
        created_at: createdAt,
        updated_at: updatedAt,
        is_archived: session.isArchived === true,
        model: session.model,
        effort: session.effort,
        permission_mode: session.permissionMode,
      });
    }
    if (normalized === "/api/local/export/conversations") {
      if (request.method !== "GET") return new Response(null, { status: 405 });
      return jsonResponse({
        conversations: backend
          .exportConversations()
          .filter((conversation) => !conversation.is_temporary)
          .map((conversation) => ({
            uuid: conversation.uuid,
            name: conversation.name || "Untitled chat",
            updated_at: conversation.updated_at,
            messages: conversation.chat_messages.length,
          })),
      });
    }
    if (normalized === "/api/local/export" && request.method === "POST") {
      try {
        const input = (await readLocalJson(
          request,
        )) as Partial<TrainingExportOptions>;
        const options = normalizeTrainingExportOptions(input);
        const conversations = backend
          .exportConversations()
          .filter(
            (conversation) => !conversation.is_temporary,
          ) as unknown as ExportConversation[];
        const stamp = new Date().toISOString().slice(0, 10);
        // Test harnesses point this at a directory to bypass the native file
        // dialogs, which would otherwise block an automated renderer.
        const unattendedDir = process.env.CLAUDE_LOCAL_EXPORT_DIR;
        if (options.format === "markdown") {
          const selected = conversations.filter(
            (conversation) =>
              !options.conversationUuid ||
              conversation.uuid === options.conversationUuid,
          );
          if (selected.length === 0)
            return jsonResponse(
              { error: { message: "No conversations to export" } },
              400,
            );
          if (selected.length === 1) {
            const { canceled, filePath } = unattendedDir
              ? {
                  canceled: false,
                  filePath: path.join(
                    unattendedDir,
                    `${safeFileName(selected[0].name)}.md`,
                  ),
                }
              : await dialog.showSaveDialog({
                  title: "Export chat as Markdown",
                  defaultPath: path.join(
                    app.getPath("downloads"),
                    `${safeFileName(selected[0].name)}.md`,
                  ),
                  filters: [{ name: "Markdown", extensions: ["md"] }],
                });
            if (canceled || !filePath) return jsonResponse({ canceled: true });
            await atomicExportWrite(
              filePath,
              conversationMarkdown(selected[0], options),
            );
            return jsonResponse({ path: filePath, conversations: 1 });
          }
          const { canceled, filePaths } = unattendedDir
            ? { canceled: false, filePaths: [unattendedDir] }
            : await dialog.showOpenDialog({
                title: "Choose a folder for the Markdown export",
                defaultPath: app.getPath("downloads"),
                properties: ["openDirectory", "createDirectory"],
              });
          if (canceled || filePaths.length === 0)
            return jsonResponse({ canceled: true });
          const target = await uniqueExportDirectory(
            filePaths[0],
            `open-claude-export-${stamp}`,
          );
          let written = 0;
          const used = new Set<string>();
          for (const conversation of selected) {
            if (conversation.chat_messages.length === 0) continue;
            let base = safeFileName(conversation.name);
            if (used.has(base))
              base = `${base}-${conversation.uuid.slice(0, 8)}`;
            used.add(base);
            await atomicExportWrite(
              path.join(target, `${base}.md`),
              conversationMarkdown(conversation, options),
            );
            written += 1;
          }
          return jsonResponse({ path: target, conversations: written });
        }
        const sessions = (
          options.includeCode
            ? await codeSessions.invoke("exportSessions", [])
            : []
        ) as ExportCodeSession[];
        const result = buildTrainingExport(conversations, sessions, options);
        if (result.rows.length === 0)
          return jsonResponse(
            {
              error: {
                message: `No conversations matched the filters (${result.skipped} skipped)`,
              },
            },
            400,
          );
        const { canceled, filePath } = unattendedDir
          ? {
              canceled: false,
              filePath: path.join(
                unattendedDir,
                `open-claude-training-${options.format}-${stamp}.jsonl`,
              ),
            }
          : await dialog.showSaveDialog({
              title: "Export training data",
              defaultPath: path.join(
                app.getPath("downloads"),
                `open-claude-training-${options.format}-${stamp}.jsonl`,
              ),
              filters: [{ name: "JSON Lines", extensions: ["jsonl"] }],
            });
        if (canceled || !filePath) return jsonResponse({ canceled: true });
        await atomicExportWrite(filePath, result.rows.join("\n") + "\n");
        return jsonResponse({
          path: filePath,
          conversations: result.conversations,
          skipped: result.skipped,
        });
      } catch (error) {
        return jsonResponse(
          {
            error: {
              message: error instanceof Error ? error.message : String(error),
            },
          },
          error instanceof LocalUiRequestError ? error.status : 500,
        );
      }
    }
    if (normalized === "/api/local/code/customization") {
      try {
        if (request.method === "GET") {
          return jsonResponse(
            await codeSessions.invoke("getCustomization", [
              url.searchParams.get("cwd"),
            ]),
          );
        }
        if (request.method === "PUT" || request.method === "DELETE") {
          const input = await readLocalJson(request);
          return jsonResponse(
            await codeSessions.invoke(
              request.method === "PUT"
                ? "saveCustomization"
                : "deleteCustomization",
              [input],
            ),
          );
        }
        return new Response(null, { status: 405 });
      } catch (error) {
        return jsonResponse(
          {
            error: {
              message: error instanceof Error ? error.message : String(error),
            },
          },
          error instanceof LocalUiRequestError ? error.status : 400,
        );
      }
    }
    if (
      (request.method === "GET" && normalized === "/api/bootstrap") ||
      (request.method === "GET" &&
        normalized.startsWith("/api/bootstrap/") &&
        normalized.endsWith("/app_start"))
    )
      return jsonResponse(
        bootstrapPayload(
          backend.provider().model,
          backend.accountProfile(),
          backend.accountSettings(),
          backend.provider().enableThinking ?? false,
        ),
      );
    if (
      request.method === "GET" &&
      normalized.startsWith("/api/bootstrap/") &&
      normalized.endsWith("/current_user_access")
    ) {
      return jsonResponse(currentUserAccess());
    }
    if (
      request.method === "GET" &&
      normalized.startsWith("/api/bootstrap/") &&
      normalized.endsWith("/system_prompts")
    ) {
      return jsonResponse({});
    }
    if (normalized === "/api/account_profile") {
      if (request.method === "PUT")
        await backend.updateAccountProfile(await readLocalJson(request));
      if (request.method === "GET" || request.method === "PUT")
        return jsonResponse({
          ...localAccount(
            backend.provider().model,
            backend.accountProfile(),
            backend.accountSettings(),
          ),
          locale: null,
        });
      return new Response(null, { status: 405 });
    }
    if (normalized === "/v1/privacy-consents")
      return request.method === "GET"
        ? jsonResponse({ consents: [] })
        : new Response(null, { status: 405 });
    if (normalized === "/api/account/settings") {
      if (request.method !== "PATCH")
        return new Response(null, { status: 405 });
      return jsonResponse(
        await backend.updateAccountSettings(await readLocalJson(request)),
      );
    }
    if (normalized === "/api/account") {
      if (request.method !== "PUT") return new Response(null, { status: 405 });
      const input = objectValue(await readLocalJson(request));
      await backend.updateAccountProfile(input);
      return jsonResponse(
        localAccount(
          backend.provider().model,
          backend.accountProfile(),
          backend.accountSettings(),
        ),
      );
    }
    if (isRemovedCoworkHttpPath(normalized))
      return jsonResponse(
        {
          error: {
            type: "removed_product_surface",
            message: REMOVED_COWORK_MESSAGE,
          },
        },
        410,
      );
    if (
      request.method === "GET" &&
      /^\/api\/organizations\/[^/]+\/notification\/preferences$/.test(
        normalized,
      )
    ) {
      return jsonResponse({
        preferences: { feature_preference: {} },
        push_reachability: null,
      });
    }
    if (
      request.method === "PATCH" &&
      /^\/api\/organizations\/[^/]+\/model_selector_state\/[^/]+$/.test(
        normalized,
      )
    ) {
      const surface = normalized.split("/").at(-1) ?? "chat";
      const input = (await readLocalJson(request).catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const thinking =
        input.thinking && typeof input.thinking === "object"
          ? (input.thinking as Record<string, unknown>)
          : null;
      const mode =
        typeof thinking?.mode === "string"
          ? thinking.mode.toLowerCase()
          : "off";
      const enableThinking = mode === "extended" || mode === "enabled";
      await backend.setThinkingEnabled(enableThinking);
      const model = backend.provider().model;
      const storedThinking = {
        type: "mode",
        mode: enableThinking ? "extended" : "off",
      };
      return jsonResponse({
        id: surface,
        model,
        source: "user_setting",
        thinking: storedThinking,
        thinking_by_model: [{ id: model, thinking: storedThinking }],
      });
    }
    if (normalized.endsWith("/plugins/list-plugins"))
      return jsonResponse({ plugins: [], has_more: false });
    if (normalized.includes("/marketplaces/list-"))
      return jsonResponse({ marketplaces: [] });
    if (normalized.endsWith("/dust/command_display_names"))
      return jsonResponse({ results: [] });
    // Session titles are normally generated by a cloud model; derive one
    // locally for retained session consumers.
    if (
      normalized.endsWith("/dust/generate_session_title") &&
      request.method === "POST"
    ) {
      const input = objectValue(await readLocalJson(request).catch(() => ({})));
      const message =
        typeof input.first_session_message === "string"
          ? input.first_session_message
          : "";
      const title = message.replace(/\s+/g, " ").trim().slice(0, 60);
      return jsonResponse({ title: title || "New task" });
    }
    if (normalized.startsWith("/v1/code/github/"))
      return jsonResponse({ branch_statuses: [] });
    // Cloud Claude Code Remote sessions do not exist locally.
    if (normalized === "/v1/code/sessions" && request.method === "GET")
      return jsonResponse({ data: [], next_cursor: null });
    if (pathname === "/healthcheck" && request.method === "GET")
      return jsonResponse({
        status: "healthy",
        timestamp: new Date().toISOString(),
      });
    const backendResponse = await backend.handle(request, url);
    if (backendResponse) return backendResponse;
    if (isApiPath(normalized)) {
      return jsonResponse(
        {
          error: {
            type: "custom_3p_not_available",
            message: "This functionality is not available in third-party mode.",
          },
        },
        503,
      );
    }
    return null;
  } catch (error) {
    return jsonResponse(
      {
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      },
      error instanceof LocalUiRequestError ? error.status : 500,
    );
  }
}

function inlineScriptHashes(html: string): string[] {
  return [
    ...html.matchAll(/<script(?![^>]*\ssrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi),
  ]
    .map((match) => match[1])
    .filter(Boolean)
    .map(
      (script) =>
        `'sha256-${createHash("sha256").update(script, "utf8").digest("base64")}'`,
    );
}

function contentSecurityPolicy(scriptHashes: readonly string[]): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${scriptHashes.join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src 'self' app://artifacts.local",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "block-all-mixed-content",
  ].join("; ");
}

export async function installLocalUiProtocol(
  root: string,
  backend: LocalBackend,
  codeSessions: LocalCodeSessionManager,
  tunnel?: LocalArtifactTunnel,
): Promise<void> {
  const absoluteRoot = path.resolve(root);
  const canonicalRoot = await realpath(absoluteRoot);
  const indexPath = path.join(absoluteRoot, "index.html");
  await access(indexPath);
  const canonicalIndex = await canonicalRegularFile(canonicalRoot, indexPath);
  if (!canonicalIndex) throw new Error("Local UI index escaped its asset root");
  // base-ui only unmounts a closing dialog after its exit transition ends,
  // and Chromium stops the frame clock entirely while a document is hidden
  // or fully occluded, so a Settings/publish dialog closed while the window
  // is covered would deadlock open. base-ui checks this global before
  // waiting on animations; keep it in sync with document visibility so
  // hidden closes complete instantly while visible closes stay animated.
  const visibilityGuard =
    '<script>(()=>{const sync=()=>{globalThis.BASE_UI_ANIMATIONS_DISABLED=document.visibilityState==="hidden"};document.addEventListener("visibilitychange",sync);sync()})();</script>';
  // The artifact pane bridge must run in the page's JavaScript world (React
  // fiber expandos are invisible from the isolated preload world). It fixes
  // two retained-client defects at their contract level:
  // 1. An inline artifact card rendered by a cold-mounted chat can capture a
  //    replaced dispatcher, so its click never reaches the live chat-resource
  //    reducer. The bridge locates the live context through React fibers and
  //    dispatches the app's own SELECT_ARTIFACT / CLEAR_SELECTED instead.
  // 2. The pane layout's width comes from a resize effect whose dependency
  //    list omits the open flag, so a pane opened without a simultaneous
  //    container resize stays at width zero. The bridge reconciles the
  //    drawer wrapper's inline flex with the open state the app exposes via
  //    aria-hidden — the same style channel the app's own resizer writes.
  // Published-artifact links copy as app://localhost URLs, which only work
  // inside this app. When the share tunnel is up, rewrite the copied link to
  // the public https URL (waiting briefly for the tunnel to establish after
  // a publish).
  const tunnelClipboard = `<script>(() => {
  "use strict";
  const original = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = async (text) => {
    try {
      if (typeof text === "string" && text.startsWith("app://localhost/public/artifacts/")) {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const status = await (await fetch("/api/local/tunnel/status")).json();
          if (status.url)
            return original(text.replace("app://localhost", status.url));
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } catch {}
    return original(text);
  };
})();</script>`;
  const artifactBridge = `<script>(() => {
  window.__localArtifactBridge = { ready: true, opens: 0, closes: 0 };
  const fiberOf = (element) => {
    const key = Object.keys(element).find((k) => k.startsWith("__reactFiber$"));
    return key ? element[key] : undefined;
  };
  const paneRegion = () =>
    document.querySelector('[role="region"][aria-label^="Artifact panel"]');
  const paneVisible = () => {
    const region = paneRegion();
    if (!region) return false;
    const rect = region.getBoundingClientRect();
    return rect.width > 40 && rect.height > 0;
  };
  const cardArtifactId = (button) => {
    let fiber = fiberOf(button);
    for (let depth = 0; fiber && depth < 80; depth += 1, fiber = fiber.return) {
      const properties = fiber.memoizedProps && fiber.memoizedProps.properties;
      if (properties && typeof properties.id === "string" && properties.id)
        return properties.id;
    }
    return null;
  };
  // The live chat tree provides two context values that together control the
  // artifact drawer: the chat-resource reducer (selection) and the drawer
  // context (expanded flag). Both are located from a live element because a
  // cached card element can hold handlers bound to an unmounted instance.
  const liveDrawerControls = (preferred) => {
    const controls = { dispatch: null, setExpanded: null };
    const roots = [
      preferred,
      document.querySelector(
        '[contenteditable="true"][aria-label="Write your prompt to Claude"]',
      ),
      paneRegion(),
      document.querySelector('button[aria-label="Close artifact"]'),
    ];
    for (const root of roots) {
      if (!root) continue;
      let fiber = fiberOf(root);
      for (let depth = 0; fiber && depth < 500; depth += 1, fiber = fiber.return) {
        const value = fiber.memoizedProps && fiber.memoizedProps.value;
        if (!value || typeof value !== "object") continue;
        if (!controls.dispatch && typeof value.dispatchChatResource === "function")
          controls.dispatch = value.dispatchChatResource;
        if (!controls.setExpanded && typeof value.setIsDrawerExpanded === "function")
          controls.setExpanded = value.setIsDrawerExpanded;
      }
      if (controls.dispatch && controls.setExpanded) break;
    }
    return controls;
  };
  // A card click on a cold-mounted chat can run a cached closure bound to a
  // replaced instance, so neither the selection nor the expanded flag gets
  // set. When the pane has not appeared shortly after a click, set both
  // through the live contexts — the same two writes the app's handler makes.
  const ensureOpen = (button) => {
    setTimeout(() => {
      if (paneVisible()) return;
      const artifactId = cardArtifactId(button);
      if (!artifactId) return;
      const { dispatch, setExpanded } = liveDrawerControls(button);
      if (!dispatch || !setExpanded) return;
      window.__localArtifactBridge.opens += 1;
      setExpanded(true);
      dispatch({ type: "SELECT_ARTIFACT", id: artifactId });
    }, 300);
  };
  const ensureClosed = () => {
    setTimeout(() => {
      if (!paneRegion() && !paneVisible()) return;
      const { dispatch, setExpanded } = liveDrawerControls(null);
      if (!dispatch) return;
      window.__localArtifactBridge.closes += 1;
      dispatch({ type: "CLEAR_SELECTED" });
      if (setExpanded) setExpanded(false);
    }, 300);
  };
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button[aria-label]");
      const label = (button && button.getAttribute("aria-label")) || "";
      if (label === "Close artifact") ensureClosed();
      else if (label.startsWith("View ") && label !== "View all" && button)
        ensureOpen(button);
    },
    true,
  );
  // When the route changes away from a chat, close any drawer the previous
  // route left open — unless the new route itself requests an artifact.
  let lastPath = location.pathname;
  const lifecycle = () => {
    window.__localArtifactBridge.ticks = (window.__localArtifactBridge.ticks || 0) + 1;
    const path = location.pathname;
    if (path === lastPath) return;
    const previous = lastPath;
    lastPath = path;
    window.__localArtifactBridge.pathChanges = (window.__localArtifactBridge.pathChanges || 0) + 1;
    // Only leaving an established chat closes its drawer; the /new to
    // /chat/<uuid> hop right after a conversation is created must not.
    if (!/^\\/chat\\/[0-9a-f-]{36}/i.test(previous)) return;
    if (new URLSearchParams(location.search).has("artifactId")) return;
    const close = document.querySelector(
      'button[aria-label="Close artifact"]',
    );
    if (!close) return;
    // The in-session close handler is reliable for a route the user just
    // left; the live-context dispatch reinforces it when the handler was a
    // cached closure.
    close.click();
    const { dispatch, setExpanded } = liveDrawerControls(close);
    if (dispatch) {
      dispatch({ type: "CLEAR_SELECTED" });
      if (setExpanded) setExpanded(false);
    }
  };
  let scheduled = false;
  const tick = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      lifecycle();
    }, 40);
  };
  const start = () => {
    new MutationObserver(tick).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    window.addEventListener("popstate", tick);
    tick();
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();</script>`;
  const indexSource = await readLocalUiAsset(canonicalIndex, canonicalRoot);
  if (!indexSource) throw new Error("Local UI index exceeds its safety limit");
  const indexHtml = indexSource
    .toString("utf8")
    .replace(
      "<head>",
      `<head>${visibilityGuard}${artifactBridge}${tunnelClipboard}`,
    );
  const csp = contentSecurityPolicy(inlineScriptHashes(indexHtml));
  const patchedAssets = await patchedClientAssets(
    absoluteRoot,
    indexHtml,
    LOCAL_CLIENT_PATCHES.filter((patch) => !DISABLED_PATCH_IDS.has(patch.id)),
  );
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    if (url.hostname === "artifacts.local") {
      if (request.method !== "GET" && request.method !== "HEAD")
        return new Response(null, { status: 405 });
      return new Response(
        request.method === "HEAD" ? null : localArtifactRendererHtml(),
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy": [
              "default-src 'none'",
              "script-src 'unsafe-inline'",
              "style-src 'unsafe-inline'",
              // Artifact content is untrusted and runs without network access;
              // remote images would otherwise create a tracking side channel.
              "img-src data: blob:",
              "frame-src data: blob:",
              "connect-src 'none'",
              "object-src 'none'",
              "base-uri 'none'",
            ].join("; "),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
          },
        },
      );
    }
    if (url.hostname !== "localhost")
      return new Response(null, { status: 404 });
    const origin = request.headers.get("Origin");
    if (origin && origin !== "app://localhost")
      return new Response(null, { status: 403 });

    if (url.pathname === "/api/local/tunnel/status") {
      if (request.method !== "GET" && request.method !== "HEAD")
        return new Response(null, { status: 405 });
      return new Response(
        request.method === "HEAD"
          ? null
          : JSON.stringify(tunnel?.status() ?? { url: null, active: false }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    const apiResponse = await localApiResponse(
      request,
      url,
      backend,
      codeSessions,
    );
    if (apiResponse) {
      // Publishing spins up the public share tunnel; it tears down whenever
      // nothing remains published — explicit unpublish OR deleting a chat
      // that owned the published artifact (even when the request 404s
      // because the content is already gone).
      if (tunnel) {
        if (
          apiResponse.status < 400 &&
          request.method === "POST" &&
          /\/publish_artifact$/.test(url.pathname)
        )
          void tunnel.ensureStarted();
        else if (
          request.method === "DELETE" &&
          /\/(published_artifacts|chat_conversations)\//.test(url.pathname)
        )
          tunnel.stopIfIdle();
      }
      return apiResponse;
    }

    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response(null, { status: 405 });

    const requested = resolveInside(absoluteRoot, url.pathname);
    if (!requested) return new Response(null, { status: 403 });
    const regularFile = await canonicalRegularFile(canonicalRoot, requested);
    // A missing versioned asset is a packaging error, not an SPA route. Do
    // not answer it with index.html and a misleading 200/text-html response.
    if (!regularFile && path.extname(url.pathname))
      return new Response(null, { status: 404 });
    const candidate = regularFile ?? canonicalIndex;
    const patchedAsset =
      patchedAssets.get(path.resolve(requested)) ??
      patchedAssets.get(path.resolve(candidate));
    // Asset URLs keep the same version-hashed filenames across Open-Claude
    // releases while their patched contents change, so the renderer must
    // never revive them from its profile HTTP cache after an upgrade.
    if (patchedAsset) {
      return new Response(
        request.method === "HEAD" ? null : patchedAsset.source,
        {
          status: 200,
          headers: {
            "Content-Type": MIME_TYPES[".js"],
            "Content-Security-Policy": csp,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Local-Claude-Patches": patchedAsset.ids.join(","),
          },
        },
      );
    }
    if (path.resolve(candidate) === path.resolve(canonicalIndex)) {
      return new Response(request.method === "HEAD" ? null : indexHtml, {
        status: 200,
        headers: {
          "Content-Type": MIME_TYPES[".html"],
          "Content-Security-Policy": csp,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const source = await readLocalUiAsset(candidate, canonicalRoot);
    if (!source) return new Response(null, { status: 404 });
    const headers = new Headers();
    const mime = MIME_TYPES[path.extname(candidate).toLowerCase()];
    if (mime) headers.set("Content-Type", mime);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Security-Policy", csp);
    return new Response(
      request.method === "HEAD" ? null : Uint8Array.from(source).buffer,
      {
        status: 200,
        headers,
      },
    );
  });
}
