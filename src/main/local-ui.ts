import { access, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { net, protocol, shell } from "electron";
import { resolveInside } from "../shared/security";
import { LocalBackend } from "./local-backend";
import { LocalCodeSessionManager } from "./local-code";

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

interface ClientPatch {
  id: string;
  find: string;
  replace: string;
  assetUrlPath?: string;
}

// The packaged desktop web client defaults /new into Cowork's VM-backed task
// flow. Local mode needs the ordinary web-chat route, whose HTTP/SSE contract
// can be implemented by LocalBackend. Apply this only while serving our private
// in-memory copy; the installed Anthropic asset is never modified.
const LOCAL_CLIENT_PATCHES: readonly ClientPatch[] = [
  {
    id: "define-local-chat-route-component",
    find: "lts={withSidebar:[],root:[]},cts=(()=>",
    replace:
      "lts={withSidebar:[],root:[]},Lcs=()=>{const{uuid:e}=hR();return t.jsx(m2t,{uuid:e})},cts=(()=>",
  },
  {
    id: "restore-web-chat-routes",
    find: "t=t=>q$({getParentRoute:()=>A7n,path:t,beforeLoad:e})",
    replace:
      't=t=>q$({getParentRoute:()=>A7n,path:t,...("new"===t?{component:K3t}:"chat/$uuid"===t?{component:Lcs}:{beforeLoad:e})})',
  },
  {
    id: "keep-new-route-in-web-chat",
    find: "}(l);e.useEffect(()=>{u&&!l&&d.replace(u)},[u,l,d]);",
    replace: "}(true);e.useEffect(()=>{u&&!l&&d.replace(u)},[u,l,d]);",
  },
  {
    id: "dispatch-local-chat-after-navigation",
    find: "j=N&&void 0!==r&&void 0!==p?.uuid&&!w&&!t.skipNavigation&&!b&&!(!1===d?.settings?.has_finished_claudeai_onboarding)",
    replace: "j=!1",
  },
  {
    id: "disable-service-workers-on-app-protocol",
    find: 'qdn="undefined"!=typeof navigator&&"serviceWorker"in navigator',
    replace: "qdn=!1",
  },
  {
    id: "enable-local-chat-tree-fetch",
    find: "enabled:!!a&&!!e&&r&&!l,forceExplicitCache:!0,meta:",
    replace:
      "enabled:!!a&&!!e&&r&&!l,custom3pCompatible:!0,forceExplicitCache:!0,meta:",
  },
  {
    id: "use-local-artifact-renderer",
    find: 'userContentRendererUrl:"https://www.claudeusercontent.com"',
    replace: 'userContentRendererUrl:"app://artifacts.local"',
  },
  {
    id: "derive-local-chat-attachments",
    find: "wiggleEnabled:dn,targetStore:void 0,isLocalAgentMode:W||G",
    replace: 'wiggleEnabled:dn,targetStore:"org",isLocalAgentMode:W||G',
  },
  {
    id: "enable-local-claude-code-surface",
    find: 'claude_code_web:FL({feature:"claude_code_web",useClientSideGate:()=>(av("bad_moon_rising"),!1)})',
    replace:
      'claude_code_web:FL({feature:"claude_code_web",useClientSideGate:()=>!0})',
  },
  {
    id: "enable-native-local-code-artifacts",
    assetUrlPath: "/assets/v1/ca82bcec9-BHaPdnp0.js",
    find: "function pn(){const e=At(),{data:t}=G(),a=void 0===t;return e||a?",
    replace: "function pn(){const e=!0,{data:t}=G(),a=void 0===t;return e||a?",
  },
  {
    id: "enable-local-artifact-gallery-data",
    assetUrlPath: "/assets/v1/c47ad434c-D_dYPjVp.js",
    find: 'function ne(){const e=Boolean(""),{isAvailable:t}=i("cobalt_plinth");return!d(()=>!1,!1)&&(e||t)}',
    replace: "function ne(){return!0}",
  },
  {
    id: "bind-native-artifact-gallery-to-local-desktop-store",
    assetUrlPath: "/assets/v1/c47ad434c-D_dYPjVp.js",
    find:
      'function ie(e=!1,t){const r=!0===t?.starredOnly,a=!1!==t?.enabled,{activeOrganization:s}=u(),o=F(),n=s?.uuid,i=c(),d=ne(),p=f(',
    replace:
      'function ie(e=!1,t){const r=c(),[a,s]=g.useState({artifacts:[],isPending:!0,isError:!1});return g.useEffect(()=>{let e=!1;const t=window["claude.web"]?.CoworkArtifacts?.getAllArtifacts?.();return Promise.resolve(t).then(t=>{e||s({artifacts:Array.isArray(t)?t:[],isPending:!1,isError:!1})}).catch(()=>{e||s({artifacts:[],isPending:!1,isError:!0})}),()=>{e=!0}},[]),{enabled:!0,includeShared:!1,items:a.artifacts.map(e=>({key:`frame:${e.id}`,source:"frame",rel:"mine",title:e.title??"Artifact",description:e.sessionTitle,extraSearchText:[e.sessionTitle,e.path].filter(e=>"string"==typeof e),href:`/code/artifact/${e.id}?org=00000000-0000-4000-8000-000000000001&open_in_browser=1`,newTab:r,updatedAtMs:e.updatedAt?Date.parse(e.updatedAt):void 0,createdAtMs:e.updatedAt?Date.parse(e.updatedAt):void 0,audience:"owner",softDeleted:!1,starred:!1})),isPending:a.isPending,isError:a.isError,capped:!1,isPartial:!1,isPartialError:!1,starsEnabled:!1}}function ieCloudUnused(e=!1,t){const r=!0===t?.starredOnly,a=!1!==t?.enabled,{activeOrganization:s}=u(),o=F(),n=s?.uuid,i=c(),d=ne(),p=f(',
  },
  {
    id: "use-local-code-artifact-gallery-source",
    assetUrlPath: "/assets/v1/ce569194f-YKjvV2xt.js",
    find: 'function Je(){const e=z(),s=i(),r=Ke("chat",{relTabs:!0});',
    replace:
      'function Je(){const e=z(),s=i(),r=Ke("frame",{relTabs:!0});',
  },
  {
    id: "defer-local-terminal-pty-delivery",
    find: 'for(const n of nBn)try{n(e)}catch(t){dt.error(ut.DESKTOP_API,"localShellPtyTransport subscriber threw",{err:t})}',
    replace:
      'for(const n of nBn)setTimeout(()=>{try{n(e)}catch(t){dt.error(ut.DESKTOP_API,"localShellPtyTransport subscriber threw",{err:t})}},0)',
  },
];

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

function moduleAssetPaths(indexHtml: string): string[] {
  const paths = new Set<string>();
  for (const match of indexHtml.matchAll(
    /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/gi,
  )) {
    if (match[1]) paths.add(match[1]);
  }
  for (const match of indexHtml.matchAll(
    /<link\b[^>]*\brel=["']modulepreload["'][^>]*\bhref=["']([^"']+)["']/gi,
  )) {
    if (match[1]) paths.add(match[1]);
  }
  if (paths.size === 0)
    throw new Error("Packaged UI module assets were not found");
  return [...paths];
}

async function patchedClientAssets(
  root: string,
  indexHtml: string,
  patches: readonly ClientPatch[],
): Promise<Map<string, { source: string; ids: string[] }>> {
  const sources = new Map<string, string>();
  for (const assetUrlPath of moduleAssetPaths(indexHtml)) {
    const assetPath = resolveInside(root, assetUrlPath);
    if (!assetPath || !(await regularFile(assetPath)))
      throw new Error(`Packaged UI module is unavailable: ${assetUrlPath}`);
    sources.set(path.resolve(assetPath), await readFile(assetPath, "utf8"));
  }
  for (const assetUrlPath of new Set(
    patches.map((patch) => patch.assetUrlPath).filter(Boolean) as string[],
  )) {
    const assetPath = resolveInside(root, assetUrlPath);
    if (!assetPath || !(await regularFile(assetPath)))
      throw new Error(
        `Packaged UI patch asset is unavailable: ${assetUrlPath}`,
      );
    sources.set(path.resolve(assetPath), await readFile(assetPath, "utf8"));
  }

  const idsByPath = new Map<string, string[]>();
  for (const patch of patches) {
    let occurrences = 0;
    let matchedPath: string | undefined;
    for (const [assetPath, source] of sources) {
      const count = source.split(patch.find).length - 1;
      occurrences += count;
      if (count > 0) matchedPath = assetPath;
    }
    if (occurrences !== 1 || !matchedPath) {
      throw new Error(
        `Client patch ${patch.id} expected exactly one match, found ${occurrences}`,
      );
    }
    sources.set(
      matchedPath,
      sources.get(matchedPath)!.replace(patch.find, patch.replace),
    );
    idsByPath.set(matchedPath, [
      ...(idsByPath.get(matchedPath) ?? []),
      patch.id,
    ]);
  }

  return new Map(
    [...idsByPath].map(([assetPath, ids]) => [
      assetPath,
      { source: sources.get(assetPath)!, ids },
    ]),
  );
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

async function regularFile(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
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

function currentUserAccess(): Record<string, unknown> {
  return {
    features: [
      "chat",
      "claude_code",
      "claude_code_web",
      "claude_code_desktop",
      "skills",
      "cobalt_plinth",
    ].map((feature) => ({
      feature,
      status: "available",
    })),
  };
}

const LOCAL_ORG_UUID = "00000000-0000-4000-8000-000000000001";
const LOCAL_ACCOUNT_UUID = "00000000-0000-4000-8000-000000000002";
const LOCAL_CREATED_AT = "2026-01-01T00:00:00.000Z";

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
      { model, name: model, label_override: "Local model" },
    ],
  };
}

function localAccount(configuredModel?: string): Record<string, unknown> {
  return {
    tagged_id: `local_${LOCAL_ACCOUNT_UUID}`,
    uuid: LOCAL_ACCOUNT_UUID,
    email_address: "local@localhost",
    full_name: "Local User",
    display_name: "Local User",
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
      name: "Local model",
      description: "Configured OpenAI-compatible model",
    },
  ];
  return ["cowork", "code", "chat"].map((id) => ({ id, models }));
}

function modelSelectorState(
  configuredModel?: string,
): Array<Record<string, unknown>> {
  const model = localModelId(configuredModel);
  return ["cowork", "code", "chat"].map((id) => ({
    id,
    model,
    source: "global_default",
  }));
}

function growthbookFeatures(configuredModel?: string): Record<string, unknown> {
  const enabled = (defaultValue: unknown) => ({ defaultValue });
  return {
    "574905726": enabled(true),
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
    "3353525254": enabled(true),
    "700397605": enabled(true),
    "3356268835": enabled({
      showGsuiteConnectors: false,
      enableAdditionalDirectoriesClaudeMd: true,
    }),
    "1868684740": enabled(true),
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

function bootstrapPayload(configuredModel?: string): Record<string, unknown> {
  return {
    account: localAccount(configuredModel),
    current_user_access: currentUserAccess(),
    locale: null,
    statsig: {
      user: { userID: randomUUID() },
      values: {},
      values_hash: "custom3p",
    },
    growthbook: { features: growthbookFeatures(configuredModel) },
    model_selector_config: modelSelectorConfig(configuredModel),
    model_selector_state: modelSelectorState(configuredModel),
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
    /^\/api\/organizations\/[^/]+\/user_artifacts$/.test(normalized)
  )
    return jsonResponse({ artifacts: [] });
  if (
    request.method === "GET" &&
    /^\/api\/organizations\/[^/]+\/user_artifacts\/count$/.test(normalized)
  )
    return jsonResponse({ count: 0 });
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
  }
  if (normalized === "/api/local/code/artifacts" && request.method === "GET") {
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
    const input = (await request.json()) as Record<string, unknown>;
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
        const input = await request.json();
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
        400,
      );
    }
  }
  if (
    normalized === "/api/bootstrap" ||
    (normalized.startsWith("/api/bootstrap/") &&
      normalized.endsWith("/app_start"))
  )
    return jsonResponse(bootstrapPayload(backend.provider().model));
  if (
    normalized.startsWith("/api/bootstrap/") &&
    normalized.endsWith("/current_user_access")
  ) {
    return jsonResponse(currentUserAccess());
  }
  if (
    normalized.startsWith("/api/bootstrap/") &&
    normalized.endsWith("/system_prompts")
  ) {
    return jsonResponse({});
  }
  if (normalized === "/api/account_profile" && request.method === "GET")
    return jsonResponse({
      ...localAccount(backend.provider().model),
      locale: null,
    });
  if (normalized === "/v1/privacy-consents") {
    return request.method === "GET"
      ? jsonResponse({ consents: [] })
      : jsonResponse({});
  }
  if (normalized === "/api/account/settings" && request.method === "PATCH")
    return jsonResponse({});
  if (
    request.method === "GET" &&
    /^\/api\/organizations\/[^/]+\/notification\/preferences$/.test(normalized)
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
    const model = backend.provider().model;
    return jsonResponse({
      id: surface,
      model,
      source: "user_setting",
      thinking: null,
      thinking_by_model: null,
    });
  }
  if (normalized.endsWith("/plugins/list-plugins"))
    return jsonResponse({ plugins: [], has_more: false });
  if (normalized.includes("/marketplaces/list-"))
    return jsonResponse({ marketplaces: [] });
  if (normalized.endsWith("/dust/command_display_names"))
    return jsonResponse({ results: [] });
  if (normalized.startsWith("/v1/code/github/"))
    return jsonResponse({ branch_statuses: [] });
  if (pathname === "/healthcheck")
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
    `script-src 'self' 'wasm-unsafe-eval' https://a-cdn.anthropic.com ${scriptHashes.join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https: wss:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "frame-src 'self' app://artifacts.local https:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "block-all-mixed-content",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function installLocalUiProtocol(
  root: string,
  backend: LocalBackend,
  codeSessions: LocalCodeSessionManager,
): Promise<void> {
  const indexPath = path.join(root, "index.html");
  await access(indexPath);
  const absoluteRoot = path.resolve(root);
  const indexHtml = await readFile(indexPath, "utf8");
  const csp = contentSecurityPolicy(inlineScriptHashes(indexHtml));
  const patchedAssets = await patchedClientAssets(
    absoluteRoot,
    indexHtml,
    LOCAL_CLIENT_PATCHES,
  );
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    if (url.hostname === "artifacts.local") {
      if (request.method !== "GET") return new Response(null, { status: 405 });
      return new Response(localArtifactRendererHtml(), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": [
            "default-src 'none'",
            "script-src 'unsafe-inline'",
            "style-src 'unsafe-inline'",
            "img-src data: blob: https:",
            "frame-src data: blob:",
            "connect-src 'none'",
            "object-src 'none'",
            "base-uri 'none'",
          ].join("; "),
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
        },
      });
    }
    if (url.hostname !== "localhost")
      return new Response(null, { status: 404 });
    const origin = request.headers.get("Origin");
    if (origin && origin !== "app://localhost")
      return new Response(null, { status: 403 });

    const apiResponse = await localApiResponse(
      request,
      url,
      backend,
      codeSessions,
    );
    if (apiResponse) return apiResponse;

    const requested = resolveInside(absoluteRoot, url.pathname);
    if (!requested) return new Response(null, { status: 403 });
    const candidate = (await regularFile(requested))
      ? requested
      : path.join(absoluteRoot, "index.html");
    const patchedAsset = patchedAssets.get(path.resolve(candidate));
    if (patchedAsset) {
      return new Response(patchedAsset.source, {
        status: 200,
        headers: {
          "Content-Type": MIME_TYPES[".js"],
          "Content-Security-Policy": csp,
          "X-Content-Type-Options": "nosniff",
          "X-Local-Claude-Patches": patchedAsset.ids.join(","),
        },
      });
    }
    const response = await net.fetch(pathToFileURL(candidate).href);
    const headers = new Headers(response.headers);
    const mime = MIME_TYPES[path.extname(candidate).toLowerCase()];
    if (mime) headers.set("Content-Type", mime);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Security-Policy", csp);
    return new Response(response.body, { status: response.status, headers });
  });
}
