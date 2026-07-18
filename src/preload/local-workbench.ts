import { ipcRenderer } from "electron";

interface PublicProviderConfig {
  provider: {
    baseUrl: string;
    model: string;
    contextWindow: number;
    thinkingStartTag: string;
    thinkingEndTag: string;
  };
  hasApiKey: boolean;
}

interface ModelList {
  models: string[];
  contextWindows?: Record<string, number>;
}

interface CodeArtifactSummary {
  title: string;
  url: string;
  path: string;
  updatedAt: string;
  version: string;
  sessionId: string;
  sessionTitle: string;
  cwd: string;
}

interface CodeArtifactContents extends CodeArtifactSummary {
  type: string;
  content: string;
}

type CustomizationKind = "skill" | "command" | "agent";
type CustomizationScope = "workspace" | "user";

interface CustomizationEntry {
  kind: CustomizationKind;
  scope: CustomizationScope;
  name: string;
  path: string;
  content: string;
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & {
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(body.error?.message || `HTTP ${response.status}`);
  return body;
}

async function getConfig(): Promise<PublicProviderConfig> {
  return responseJson<PublicProviderConfig>(await fetch("/api/local/config"));
}

async function setConfig(input: {
  baseUrl: string;
  model: string;
  contextWindow: number;
  apiKey?: string | null;
  thinkingStartTag: string;
  thinkingEndTag: string;
}): Promise<void> {
  await responseJson(
    await fetch("/api/local/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

async function listModels(input?: {
  baseUrl?: string;
  apiKey?: string;
}): Promise<string[]> {
  return (await modelCatalog(input)).models;
}

async function modelCatalog(input?: {
  baseUrl?: string;
  apiKey?: string;
}): Promise<ModelList> {
  return responseJson<ModelList>(
    await fetch("/api/local/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    }),
  );
}

async function getCodeArtifacts(): Promise<CodeArtifactSummary[]> {
  return (
    await responseJson<{ artifacts: CodeArtifactSummary[] }>(
      await fetch("/api/local/code/artifacts"),
    )
  ).artifacts;
}

async function getCodeArtifact(
  sessionId: string,
  url: string,
): Promise<CodeArtifactContents> {
  const query = new URLSearchParams({ sessionId, url });
  return (
    await responseJson<{ artifact: CodeArtifactContents }>(
      await fetch(`/api/local/code/artifact?${query}`),
    )
  ).artifact;
}

async function openCodeArtifact(
  sessionId: string,
  url: string,
  action: "open" | "reveal" = "open",
): Promise<void> {
  await responseJson(
    await fetch("/api/local/code/artifact/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, url, action }),
    }),
  );
}

async function pickDirectory(): Promise<string | null> {
  return ipcRenderer.invoke("local-pick-directory") as Promise<string | null>;
}

// Rasterizes artifact content offscreen in the main process for the publish
// modal's preview (the local sandbox renderer cannot screenshot itself).
async function captureArtifactScreenshot(payload?: {
  content?: string;
  type?: string;
}): Promise<string | null> {
  if (!payload || typeof payload.content !== "string") return null;
  return ipcRenderer.invoke("local-artifact-screenshot", {
    content: payload.content,
    type: payload.type,
  }) as Promise<string | null>;
}

async function getCustomization(
  cwd: string,
): Promise<{ cwd: string; entries: CustomizationEntry[] }> {
  return responseJson(
    await fetch(
      `/api/local/code/customization?${new URLSearchParams({ cwd })}`,
    ),
  );
}

async function saveCustomization(input: {
  cwd: string;
  kind: CustomizationKind;
  scope: CustomizationScope;
  name: string;
  content: string;
}): Promise<void> {
  await responseJson(
    await fetch("/api/local/code/customization", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

async function deleteCustomization(input: {
  cwd: string;
  kind: CustomizationKind;
  scope: CustomizationScope;
  name: string;
}): Promise<void> {
  await responseJson(
    await fetch("/api/local/code/customization", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export const localClaudeApi = {
  getConfig,
  setConfig,
  listModels,
  getCodeArtifacts,
  getCodeArtifact,
  openCodeArtifact,
  pickDirectory,
  getCustomization,
  saveCustomization,
  deleteCustomization,
  captureArtifactScreenshot,
  version: 1,
};

const CODE_ACTIVITY_WORDS = [
  "Accomplishing",
  "Actioning",
  "Actualizing",
  "Architecting",
  "Baking",
  "Beaming",
  "Beboppin'",
  "Befuddling",
  "Billowing",
  "Blanching",
  "Bloviating",
  "Boogieing",
  "Boondoggling",
  "Booping",
  "Bootstrapping",
  "Brewing",
  "Burrowing",
  "Calculating",
  "Canoodling",
  "Caramelizing",
  "Cascading",
  "Catapulting",
  "Cerebrating",
  "Channeling",
  "Channelling",
  "Choreographing",
  "Churning",
  "Clauding",
  "Coalescing",
  "Cogitating",
  "Combobulating",
  "Composing",
  "Computing",
  "Concocting",
  "Considering",
  "Contemplating",
  "Cooking",
  "Crafting",
  "Creating",
  "Crunching",
  "Crystallizing",
  "Cultivating",
  "Deciphering",
  "Deliberating",
  "Determining",
  "Dilly-dallying",
  "Discombobulating",
  "Doing",
  "Doodling",
  "Drizzling",
  "Ebbing",
  "Effecting",
  "Elucidating",
  "Embellishing",
  "Enchanting",
  "Envisioning",
  "Evaporating",
  "Fermenting",
  "Fiddle-faddling",
  "Finagling",
  "Flambeing",
  "Flibbertigibbeting",
  "Flowing",
  "Flummoxing",
  "Fluttering",
  "Forging",
  "Forming",
  "Frolicking",
  "Frosting",
  "Gallivanting",
  "Galloping",
  "Garnishing",
  "Generating",
  "Germinating",
  "Gitifying",
  "Grooving",
  "Gusting",
  "Harmonizing",
  "Hashing",
  "Hatching",
  "Herding",
  "Honking",
  "Hullaballooing",
  "Hyperspacing",
  "Ideating",
  "Imagining",
  "Improvising",
  "Incubating",
  "Inferring",
  "Infusing",
  "Ionizing",
  "Jitterbugging",
  "Julienning",
  "Kneading",
  "Leavening",
  "Levitating",
  "Lollygagging",
  "Manifesting",
  "Marinating",
  "Meandering",
  "Metamorphosing",
  "Misting",
  "Moonwalking",
  "Moseying",
  "Mulling",
  "Mustering",
  "Musing",
  "Nebulizing",
  "Nesting",
  "Newspapering",
  "Noodling",
  "Nucleating",
  "Orbiting",
  "Orchestrating",
  "Osmosing",
  "Perambulating",
  "Percolating",
  "Perusing",
  "Philosophising",
  "Photosynthesizing",
  "Pollinating",
  "Pondering",
  "Pontificating",
  "Pouncing",
  "Precipitating",
  "Prestidigitating",
  "Processing",
  "Proofing",
  "Propagating",
  "Puttering",
  "Puzzling",
  "Quantumizing",
  "Razzle-dazzling",
  "Razzmatazzing",
  "Recombobulating",
  "Reticulating",
  "Roosting",
  "Ruminating",
  "Sauteing",
  "Scampering",
  "Schlepping",
  "Scurrying",
  "Seasoning",
  "Shenaniganing",
  "Shimmying",
  "Simmering",
  "Skedaddling",
  "Sketching",
  "Slithering",
  "Smooshing",
  "Sock-hopping",
  "Spelunking",
  "Spinning",
  "Sprouting",
  "Stewing",
  "Sublimating",
  "Swirling",
  "Swooping",
  "Symbioting",
  "Synthesizing",
  "Tempering",
  "Thinking",
  "Thundering",
  "Tinkering",
  "Tomfoolering",
  "Topsy-turvying",
  "Transfiguring",
  "Transmuting",
  "Twisting",
  "Undulating",
  "Unfurling",
  "Unravelling",
  "Vibing",
  "Waddling",
  "Wandering",
  "Warping",
  "Whatchamacalliting",
  "Whirlpooling",
  "Whirring",
  "Whisking",
  "Wibbling",
  "Working",
  "Wrangling",
  "Zesting",
  "Zigzagging",
] as const;

function chooseCodeActivityWord(): string {
  const current = document.documentElement.dataset.openClaudeActivityWord;
  const index = Math.floor(Math.random() * CODE_ACTIVITY_WORDS.length);
  const selected =
    CODE_ACTIVITY_WORDS[index] === current
      ? CODE_ACTIVITY_WORDS[(index + 1) % CODE_ACTIVITY_WORDS.length]
      : CODE_ACTIVITY_WORDS[index];
  document.documentElement.dataset.openClaudeActivityWord = selected;
  return selected;
}

let mermaidModule: Promise<(typeof import("mermaid"))["default"]> | null = null;
let mermaidDiagramId = 0;
const mermaidRenderTimers = new WeakMap<HTMLElement, number>();

function loadMermaid(): Promise<(typeof import("mermaid"))["default"]> {
  mermaidModule ??= import("mermaid").then((module) => module.default);
  return mermaidModule;
}

function nativeUiIsDark(): boolean {
  const root = document.documentElement;
  const colorScheme = getComputedStyle(root).colorScheme;
  return (
    root.classList.contains("dark") ||
    colorScheme.split(/\s+/u).includes("dark") ||
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

async function renderMermaidCodeBlock(code: HTMLElement): Promise<void> {
  const pre = code.parentElement;
  if (!(pre instanceof HTMLPreElement)) return;
  if (pre.dataset.localMermaidState === "rendering") return;

  const source = code.textContent?.trim();
  if (!source) return;
  if (
    pre.dataset.localMermaidState === "error" &&
    pre.dataset.localMermaidSource === source
  )
    return;
  pre.dataset.localMermaidState = "rendering";
  pre.dataset.localMermaidSource = source;

  try {
    const mermaid = await loadMermaid();
    const dark = nativeUiIsDark();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      suppressErrorRendering: true,
      theme: dark ? "dark" : "neutral",
      flowchart: { htmlLabels: false, useMaxWidth: true },
    });
    const id = `claude-local-mermaid-${++mermaidDiagramId}`;
    const { svg, bindFunctions } = await mermaid.render(id, source);
    if (!code.isConnected || code.textContent?.trim() !== source) {
      delete pre.dataset.localMermaidState;
      wireInlineMermaidDiagrams();
      return;
    }
    const diagram = document.createElement("div");
    diagram.className = "local-inline-mermaid";
    diagram.dataset.localMermaidSource = source;
    diagram.setAttribute("role", "img");
    diagram.setAttribute("aria-label", "Mermaid diagram");
    Object.assign(diagram.style, {
      background: dark ? "rgba(255, 255, 255, 0.025)" : "rgba(0, 0, 0, 0.018)",
      border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
      borderRadius: "12px",
      margin: "1rem 0",
      maxWidth: "100%",
      overflow: "auto",
      padding: "16px",
    });
    diagram.innerHTML = svg;
    const renderedSvg = diagram.querySelector<SVGElement>("svg");
    if (renderedSvg) {
      renderedSvg.style.display = "block";
      renderedSvg.style.height = "auto";
      renderedSvg.style.margin = "auto";
      renderedSvg.style.maxWidth = "100%";
    }
    pre.replaceWith(diagram);
    bindFunctions?.(diagram);
  } catch (error) {
    pre.dataset.localMermaidState = "error";
    pre.title =
      error instanceof Error
        ? `Could not render diagram: ${error.message}`
        : "Could not render diagram";
    if (code.textContent?.trim() !== source) {
      delete pre.dataset.localMermaidState;
      wireInlineMermaidDiagrams();
    }
  }
}

function wireInlineMermaidDiagrams(): void {
  for (const code of document.querySelectorAll<HTMLElement>(
    "pre > code.language-mermaid",
  )) {
    const pre = code.parentElement;
    if (!(pre instanceof HTMLPreElement)) continue;
    const source = code.textContent?.trim();
    if (!source || pre.dataset.localMermaidState === "rendering") continue;
    if (
      (pre.dataset.localMermaidState === "pending" ||
        pre.dataset.localMermaidState === "error") &&
      pre.dataset.localMermaidSource === source
    )
      continue;
    const pending = mermaidRenderTimers.get(code);
    if (pending !== undefined) window.clearTimeout(pending);
    pre.dataset.localMermaidState = "pending";
    pre.dataset.localMermaidSource = source;
    mermaidRenderTimers.set(
      code,
      window.setTimeout(() => {
        mermaidRenderTimers.delete(code);
        void renderMermaidCodeBlock(code);
      }, 180),
    );
  }
}

export function installLocalWorkbench(): void {
  const install = () => {
    if (!document.getElementById("local-claude-chrome-style")) {
      const style = document.createElement("style");
      style.id = "local-claude-chrome-style";
      style.textContent = `
        /* The retained client requires an internal identity object to build
           conversation queries, but local mode has no user account. */
        [data-testid="user-menu-button"] { display: none !important; }
        /* The reference top switcher shows Home | Code only; Cowork lives in
           the composer's Chat | Cowork mode pills, which must stay visible. */
        .df-pills[data-segmented="true"] > button[data-mode="cowork"] { display: none !important; }
        [data-local-cloud-only="true"] { display: none !important; }
        /* The desktop top bar already carries the incognito ghost; the
           floating in-content duplicate is hidden in the official shell by a
           top-bar presence check our frame does not satisfy. */
        button[aria-label="Use incognito"], button[aria-label="Exit incognito"] { display: none !important; }
        button[aria-label="Menu"],
        button[aria-label="Collapse sidebar"],
        button[aria-label="Expand sidebar"],
        button[aria-label="Search"],
        button[aria-label="Back"],
        button[aria-label="Forward"] {
          -webkit-app-region: no-drag !important;
          pointer-events: auto !important;
          position: relative;
          z-index: 3;
        }
      `;
      document.head.append(style);
    }
    if (document.getElementById("local-claude-workbench")) return;

    chooseCodeActivityWord();
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest<HTMLButtonElement>('button[aria-label="Send"]')
        )
          chooseCodeActivityWord();
      },
      true,
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key !== "Enter" ||
          event.shiftKey ||
          event.isComposing ||
          !(event.target instanceof Element) ||
          !event.target.closest('[contenteditable="true"][aria-label="Prompt"]')
        )
          return;
        chooseCodeActivityWord();
      },
      true,
    );

    // Sandbox output files: download in place. Left to the SPA these links
    // would either route through the client-side router (breaking the chat
    // view) or be handed to the external-link opener, where an app://
    // URL cannot resolve.
    document.addEventListener(
      "click",
      (event) => {
        const anchor = (event.target as Element | null)?.closest?.("a");
        if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) return;
        let url: URL;
        try {
          url = new URL(anchor.href);
        } catch {
          return;
        }
        if (!url.pathname.startsWith("/api/local/sandbox/files/")) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        void (async () => {
          const response = await fetch(url.pathname);
          if (!response.ok) return;
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = objectUrl;
          try {
            link.download = decodeURIComponent(
              url.pathname.split("/").at(-1) || "download",
            );
          } catch {
            link.download = "download";
          }
          link.click();
          setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
        })();
      },
      true,
    );

    const host = document.createElement("div");
    host.id = "local-claude-workbench";
    host.hidden = true;
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { display: block; color: var(--cds-text-primary, #292724); font: 14px/1.45 ui-sans-serif, system-ui, sans-serif; }
        :host([hidden]) { display: none !important; }
        * { box-sizing: border-box; }
        button, input { font: inherit; }
        #panel { width: 100%; padding: 0 24px 32px; }
        h1 { margin: 0; padding: 6px 0 26px; font: 650 16px/1.3 ui-sans-serif, system-ui, sans-serif; }
        .row { display: grid; grid-template-columns: minmax(170px, 1fr) minmax(260px, 1.45fr); gap: 28px; align-items: center; min-height: 72px; padding: 14px 0; border-bottom: 1px solid var(--cds-border, rgba(110,104,94,.18)); }
        .row:last-of-type { border-bottom: 0; }
        .copy { display: grid; gap: 4px; min-width: 0; }
        .label { font-weight: 600; font-size: 15px; }
        input { width: 100%; border: 0; border-radius: 10px; padding: 10px 12px; background: var(--cds-bg-200, rgba(110,104,94,.16)); color: inherit; outline: none; }
        input:focus { border-color: #d97757; box-shadow: 0 0 0 2px color-mix(in srgb, #d97757 25%, transparent); }
        .hint { margin: 0; color: var(--cds-text-secondary, #8a8781); font-size: 13px; font-weight: 400; line-height: 1.4; }
        select { width: 100%; border: 0; border-radius: 10px; padding: 10px 12px; background: var(--cds-bg-200, rgba(110,104,94,.16)); color: inherit; outline: none; }
        .checks { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; justify-content: flex-end; }
        .checks label { display: flex; gap: 9px; align-items: center; cursor: pointer; }
        /* Native-style toggle switch, rendered straight from the checkbox. */
        .checks input[type="checkbox"] { appearance: none; -webkit-appearance: none; margin: 0; width: 38px; height: 22px; flex-shrink: 0; border: 0; border-radius: 999px; padding: 0; background: var(--cds-bg-300, rgba(110,104,94,.32)); position: relative; cursor: pointer; transition: background .15s ease; }
        .checks input[type="checkbox"]::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform .15s ease; }
        .checks input[type="checkbox"]:checked { background: #d97757; }
        .checks input[type="checkbox"]:checked::after { transform: translateX(16px); }
        .checks input[type="checkbox"]:focus-visible { outline: none; box-shadow: 0 0 0 2px color-mix(in srgb, #d97757 40%, transparent); }
        .checks input[type="date"] { flex: 1; min-width: 130px; }
        .checks button { border: 1px solid var(--cds-border, rgba(110,104,94,.28)); border-radius: 8px; padding: 7px 13px; font-weight: 500; cursor: pointer; background: var(--cds-bg-200, rgba(110,104,94,.14)); color: inherit; transition: background .12s ease; }
        .checks button:hover { background: var(--cds-bg-300, rgba(110,104,94,.24)); }
        #export-status { min-height: 18px; margin: 0; text-align: right; color: var(--cds-text-secondary, #6b675f); font-size: 12px; white-space: pre-wrap; }
        .actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 9px; padding: 18px 0 8px; }
        .actions button { border: 1px solid var(--cds-border, rgba(110,104,94,.28)); border-radius: 8px; padding: 8px 14px; font-weight: 500; cursor: pointer; background: var(--cds-bg-200, rgba(110,104,94,.14)); color: inherit; transition: background .12s ease; }
        .actions button:hover { background: var(--cds-bg-300, rgba(110,104,94,.24)); }
        .actions .primary { background: #d97757; border-color: #d97757; color: #fff; }
        .actions .primary:hover { background: #c96647; }
        #status { min-height: 18px; margin: 0; text-align: right; color: var(--cds-text-secondary, #6b675f); font-size: 12px; white-space: pre-wrap; }
        .subhead { padding: 30px 0 14px; }
        #sandbox-status { min-height: 18px; margin: 0; text-align: right; color: var(--cds-text-secondary, #6b675f); font-size: 12px; white-space: pre-wrap; }
        #sandbox-status.ok { color: #2e7d43; }
        #sandbox-status.bad { color: #c0392b; }
        #sandbox-status .spin { display: inline-block; width: 11px; height: 11px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; margin-right: 6px; vertical-align: -1px; animation: sandbox-spin .8s linear infinite; }
        @keyframes sandbox-spin { to { transform: rotate(360deg); } }
        #models { max-height: 160px; overflow: auto; display: grid; gap: 5px; }
        #models:empty { display: none; }
        #models button { text-align: left; border: 0; border-radius: 7px; padding: 6px 8px; background: var(--cds-fill-ghost-hover, rgba(110,104,94,.08)); cursor: pointer; color: inherit; }
        @media (max-width: 720px) { .row { grid-template-columns: 1fr; gap: 8px; } }
      </style>
      <section id="panel" aria-label="Model settings">
        <h1>Model</h1>
        <div class="section">
          <label class="row"><span class="copy"><span class="label">OpenAI-compatible URL</span><span class="hint">LM Studio usually uses http://127.0.0.1:1234/v1</span></span><input id="base-url" type="url" spellcheck="false"></label>
          <label class="row"><span class="copy"><span class="label">Model</span><span class="hint">The model ID exposed by your local server</span></span><input id="model" type="text" spellcheck="false"></label>
          <label class="row"><span class="copy"><span class="label">Context window</span><span class="hint">Used by Code for its live context meter</span></span><input id="context-window" type="number" min="1024" step="1024" inputmode="numeric"></label>
          <label class="row"><span class="copy"><span class="label">Thinking start tag</span><span class="hint">Defaults to &lt;think&gt;. Set both tags blank to disable parsing.</span></span><input id="thinking-start-tag" type="text" spellcheck="false" autocomplete="off"></label>
          <label class="row"><span class="copy"><span class="label">Thinking end tag</span><span class="hint">Change these for model-specific formats such as Gemma channel markers.</span></span><input id="thinking-end-tag" type="text" spellcheck="false" autocomplete="off"></label>
          <label class="row"><span class="copy"><span class="label">API key</span><span class="hint">Optional for local OpenAI-compatible servers</span></span><input id="api-key" type="password" autocomplete="off" placeholder="Leave blank to keep current key"></label>
          <div class="actions"><button id="models-button" type="button">Discover models</button><button id="save" class="primary" type="button">Save changes</button></div>
          <div id="models"></div><p id="status" role="status"></p>
        </div>
        <h1 class="subhead">Capabilities</h1>
        <div class="section">
          <div class="row"><span class="copy"><span class="label">Code execution</span><span class="hint">Requires Docker. Lets chat run commands in an isolated Linux container with Python and Node; generated files become downloadable.</span></span>
            <span class="checks"><input id="sandbox-enabled" type="checkbox" aria-label="Code execution"></span></div>
          <div class="row"><span class="copy"><span class="label">Sandbox internet access</span><span class="hint">Off keeps sandbox containers fully offline. Applies to containers started after the change.</span></span>
            <span class="checks"><input id="sandbox-egress" type="checkbox" aria-label="Sandbox internet access"></span></div>
          <p id="sandbox-status" role="status"></p>
          <div class="row"><span class="copy"><span class="label">Browser use</span><span class="hint">Lets chat drive a visible Chrome window: open pages, read them, click, type, and take screenshots.</span></span>
            <span class="checks"><input id="browser-use-enabled" type="checkbox" aria-label="Browser use"></span></div>
          <div class="row"><span class="copy"><span class="label">Computer use</span><span class="hint">Lets chat see your screen and send real clicks and keystrokes. Off by default; each conversation also asks for confirmation before its first action.</span></span>
            <span class="checks"><input id="computer-use-enabled" type="checkbox" aria-label="Computer use"></span></div>
        </div>
      </section>
      <section id="memory-panel" aria-label="Memory" hidden>
        <h1>Memory</h1>
        <div class="section">
          <div class="row"><span class="copy"><span class="label">Auto-generate memories</span><span class="hint">Summarize your recent chats into memory in the background. Incognito chats are never used.</span></span>
            <span class="checks"><input id="memory-auto" type="checkbox" aria-label="Auto-generate memories"></span></div>
          <div class="row"><span class="copy"><span class="label">Maintenance</span><span class="hint">Regenerate rebuilds the summary from recent chats; reset clears everything Claude remembers.</span></span>
            <span class="checks"><button id="memory-regenerate" type="button">Regenerate now</button><button id="memory-reset" type="button">Reset memory…</button></span></div>
          <p id="memory-status" role="status"></p>
        </div>
      </section>
      <section id="export-panel" aria-label="Data export" hidden>
        <h1>Data export</h1>
        <div class="section">
          <label class="row"><span class="copy"><span class="label">Format</span><span class="hint">Markdown for reading; JSONL rows for fine-tuning</span></span>
            <select id="export-format">
              <option value="markdown">Markdown files</option>
              <option value="openai" selected>Training JSONL — OpenAI messages</option>
              <option value="sharegpt">Training JSONL — ShareGPT</option>
            </select></label>
          <label class="row"><span class="copy"><span class="label">Conversation</span><span class="hint">Export one chat or everything</span></span>
            <select id="export-conversation"><option value="">All conversations</option></select></label>
          <div class="row"><span class="copy"><span class="label">Sources</span><span class="hint">Incognito chats are never included</span></span>
            <span class="checks"><label><input id="export-chat" type="checkbox" checked> Chats</label><label><input id="export-code" type="checkbox"> Code sessions</label></span></div>
          <div class="row"><span class="copy"><span class="label">Include</span><span class="hint">Thinking uses &lt;thinking&gt; tags; tool activity uses &lt;tool_call&gt;/&lt;tool_result&gt;</span></span>
            <span class="checks"><label><input id="export-thinking" type="checkbox"> Thinking</label><label><input id="export-tools" type="checkbox"> Tool calls</label></span></div>
          <div class="row"><span class="copy"><span class="label">Date range</span><span class="hint">By last activity; leave blank for all time</span></span>
            <span class="checks"><input id="export-after" type="date" aria-label="From date"><input id="export-before" type="date" aria-label="To date"></span></div>
          <label class="row"><span class="copy"><span class="label">Minimum assistant turns</span><span class="hint">Skip near-empty chats in training exports</span></span><input id="export-min-turns" type="number" min="1" step="1" value="1" inputmode="numeric"></label>
          <div class="actions"><button id="export-run" class="primary" type="button">Export…</button></div>
          <p id="export-status" role="status"></p>
        </div>
      </section>`;

    const element = <T extends HTMLElement>(selector: string) => {
      const value = root.querySelector<T>(selector);
      if (!value) throw new Error(`Missing workbench element ${selector}`);
      return value;
    };
    const status = element<HTMLElement>("#status");
    const baseUrl = element<HTMLInputElement>("#base-url");
    const model = element<HTMLInputElement>("#model");
    const contextWindow = element<HTMLInputElement>("#context-window");
    const thinkingStartTag = element<HTMLInputElement>("#thinking-start-tag");
    const thinkingEndTag = element<HTMLInputElement>("#thinking-end-tag");
    const apiKey = element<HTMLInputElement>("#api-key");
    const models = element<HTMLElement>("#models");
    const showError = (error: unknown) => {
      status.textContent =
        error instanceof Error ? error.message : String(error);
    };
    const modelPanel = element<HTMLElement>("#panel");
    const exportPanel = element<HTMLElement>("#export-panel");
    const exportStatus = element<HTMLElement>("#export-status");
    const exportFormat = element<HTMLSelectElement>("#export-format");
    const exportConversation = element<HTMLSelectElement>(
      "#export-conversation",
    );
    const exportChat = element<HTMLInputElement>("#export-chat");
    const exportCode = element<HTMLInputElement>("#export-code");
    const exportThinking = element<HTMLInputElement>("#export-thinking");
    const exportTools = element<HTMLInputElement>("#export-tools");
    const exportAfter = element<HTMLInputElement>("#export-after");
    const exportBefore = element<HTMLInputElement>("#export-before");
    const exportMinTurns = element<HTMLInputElement>("#export-min-turns");
    const memoryPanel = element<HTMLElement>("#memory-panel");
    const memoryAuto = element<HTMLInputElement>("#memory-auto");
    const memoryStatus = element<HTMLElement>("#memory-status");
    const sandboxEnabled = element<HTMLInputElement>("#sandbox-enabled");
    const sandboxEgress = element<HTMLInputElement>("#sandbox-egress");
    const sandboxStatus = element<HTMLElement>("#sandbox-status");
    const renderSandboxStatus = (payload: {
      enabled?: unknown;
      egress?: unknown;
      docker?: unknown;
      image?: unknown;
      detail?: unknown;
    }) => {
      sandboxEnabled.checked = payload.enabled === true;
      sandboxEgress.checked = payload.egress === true;
      sandboxStatus.classList.remove("ok", "bad");
      sandboxStatus.replaceChildren();
      if (payload.enabled !== true) return;
      const detail = typeof payload.detail === "string" ? payload.detail : "";
      if (payload.docker === "missing") {
        sandboxStatus.classList.add("bad");
        sandboxStatus.textContent =
          "✗ Docker is not installed. Install Docker Desktop to use code execution.";
      } else if (payload.docker === "stopped") {
        sandboxStatus.classList.add("bad");
        sandboxStatus.textContent = "✗ Docker is not running — start it.";
      } else if (payload.image === "building") {
        const spinner = document.createElement("span");
        spinner.className = "spin";
        sandboxStatus.append(
          spinner,
          document.createTextNode(
            detail || "Building the code execution image (one time)…",
          ),
        );
      } else if (payload.image === "ready") {
        sandboxStatus.classList.add("ok");
        sandboxStatus.textContent = "✓ Code execution environment is ready.";
      } else {
        sandboxStatus.classList.add("bad");
        sandboxStatus.textContent = `✗ ${detail || "The code execution image is not built yet."}`;
      }
    };
    const refreshSandboxStatus = async () => {
      try {
        const payload = (await (
          await fetch("/api/local/sandbox/status")
        ).json()) as Record<string, unknown>;
        renderSandboxStatus(payload);
      } catch {
        // The next poll retries; keep whatever is shown.
      }
    };
    sandboxEnabled.addEventListener("change", async () => {
      try {
        await fetch("/api/account/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled_wiggle: sandboxEnabled.checked }),
        });
        if (sandboxEnabled.checked)
          await fetch("/api/local/sandbox/build", { method: "POST" });
        await refreshSandboxStatus();
      } catch (error) {
        sandboxStatus.classList.remove("ok");
        sandboxStatus.classList.add("bad");
        sandboxStatus.textContent =
          error instanceof Error ? error.message : String(error);
      }
    });
    sandboxEgress.addEventListener("change", async () => {
      try {
        await fetch("/api/account/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled_wiggle_egress: sandboxEgress.checked,
          }),
        });
      } catch {
        sandboxEgress.checked = !sandboxEgress.checked;
      }
    });
    const wireCapabilityToggle = (id: string, settingKey: string) => {
      const toggle = element<HTMLInputElement>(id);
      toggle.addEventListener("change", async () => {
        try {
          await fetch("/api/account/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [settingKey]: toggle.checked }),
          });
        } catch {
          toggle.checked = !toggle.checked;
        }
      });
      return toggle;
    };
    const browserUseToggle = wireCapabilityToggle(
      "#browser-use-enabled",
      "enabled_browser_use",
    );
    const computerUseToggle = wireCapabilityToggle(
      "#computer-use-enabled",
      "enabled_computer_use",
    );
    const loadCapabilityToggles = async () => {
      try {
        const profile = (await (
          await fetch("/api/account_profile")
        ).json()) as { settings?: Record<string, unknown> };
        browserUseToggle.checked =
          profile.settings?.enabled_browser_use === true;
        computerUseToggle.checked =
          profile.settings?.enabled_computer_use === true;
      } catch {
        // Leave whatever is shown; the next open retries.
      }
    };
    let activeLocalPanel: "model" | "export" | "memory" = "model";
    const showLocalPanel = (panel: "model" | "export" | "memory") => {
      activeLocalPanel = panel;
      modelPanel.hidden = panel !== "model";
      exportPanel.hidden = panel !== "export";
      memoryPanel.hidden = panel !== "memory";
      if (panel === "model") {
        void refreshSandboxStatus();
        void loadCapabilityToggles();
      }
    };
    // Keep the three-state Docker/image indicator live while the panel is
    // open (missing/stopped → building → ready).
    setInterval(() => {
      if (host.hidden || activeLocalPanel !== "model" || modelPanel.hidden)
        return;
      void refreshSandboxStatus();
    }, 2_500);
    const loadMemorySettings = async () => {
      try {
        const settings = (await (
          await fetch("/api/organizations/local/memory/settings")
        ).json()) as { enabled_saffron?: unknown };
        memoryAuto.checked = settings.enabled_saffron !== false;
        memoryStatus.textContent = "";
      } catch (error) {
        memoryStatus.textContent =
          error instanceof Error ? error.message : String(error);
      }
    };
    memoryAuto.addEventListener("change", async () => {
      try {
        await fetch("/api/organizations/local/memory/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled_saffron: memoryAuto.checked }),
        });
        memoryStatus.textContent = memoryAuto.checked
          ? "Auto-generated memories are on."
          : "Auto-generated memories are off. Existing memory stays until you reset it.";
      } catch (error) {
        memoryStatus.textContent =
          error instanceof Error ? error.message : String(error);
      }
    });
    element("#memory-regenerate").addEventListener("click", async () => {
      memoryStatus.textContent = "Regenerating memory…";
      try {
        const response = await fetch(
          "/api/organizations/local/memory/synthesize",
          { method: "POST" },
        );
        const payload = (await response.json()) as {
          memory?: string;
          error?: { message?: string };
        };
        if (payload.error?.message) throw new Error(payload.error.message);
        memoryStatus.textContent = payload.memory?.trim()
          ? "Memory regenerated."
          : "Nothing to summarize yet — have a few chats first.";
      } catch (error) {
        memoryStatus.textContent =
          error instanceof Error ? error.message : String(error);
      }
    });
    element("#memory-reset").addEventListener("click", async () => {
      if (!confirm("Clear everything Claude remembers about you?")) return;
      try {
        await fetch("/api/organizations/local/memory/reset", {
          method: "POST",
        });
        memoryStatus.textContent = "Memory cleared.";
      } catch (error) {
        memoryStatus.textContent =
          error instanceof Error ? error.message : String(error);
      }
    });
    const loadExportConversations = async () => {
      try {
        const payload = (await (
          await fetch("/api/local/export/conversations")
        ).json()) as {
          conversations?: Array<{
            uuid: string;
            name: string;
            messages: number;
          }>;
        };
        const previous = exportConversation.value;
        exportConversation.replaceChildren();
        const all = document.createElement("option");
        all.value = "";
        all.textContent = "All conversations";
        exportConversation.append(all);
        for (const row of payload.conversations ?? []) {
          if (row.messages === 0) continue;
          const option = document.createElement("option");
          option.value = row.uuid;
          option.textContent = row.name;
          exportConversation.append(option);
        }
        exportConversation.value = previous;
        if (exportConversation.selectedIndex < 0)
          exportConversation.selectedIndex = 0;
      } catch {
        // The picker degrades to "All conversations".
      }
    };
    element("#export-run").addEventListener("click", async () => {
      exportStatus.textContent = "Exporting…";
      try {
        const response = await fetch("/api/local/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format: exportFormat.value,
            includeChat: exportChat.checked,
            includeCode: exportCode.checked,
            includeThinking: exportThinking.checked,
            includeToolCalls: exportTools.checked,
            minAssistantTurns: Math.max(1, Number(exportMinTurns.value) || 1),
            ...(exportAfter.value ? { after: exportAfter.value } : {}),
            ...(exportBefore.value ? { before: exportBefore.value } : {}),
            ...(exportConversation.value
              ? { conversationUuid: exportConversation.value }
              : {}),
          }),
        });
        const payload = (await response.json()) as {
          path?: string;
          conversations?: number;
          skipped?: number;
          canceled?: boolean;
          error?: { message?: string };
        };
        if (payload.error?.message) throw new Error(payload.error.message);
        exportStatus.textContent = payload.canceled
          ? "Export canceled."
          : `Exported ${payload.conversations ?? 0} conversation${payload.conversations === 1 ? "" : "s"}${payload.skipped ? ` (${payload.skipped} skipped by filters)` : ""} to\n${payload.path ?? ""}`;
      } catch (error) {
        exportStatus.textContent =
          error instanceof Error ? error.message : String(error);
      }
    });

    let configLoad = 0;
    let configuredModelLabel = "local-model";
    const modelLabelAliases = new Set(["Local model", "local-model"]);
    let activeScroll: HTMLElement | null = null;
    let localNavigationButton: HTMLButtonElement | null = null;
    let inactiveNavigationClass = "";
    let activeNavigationClass = "";
    const nativeDisplay = new WeakMap<
      HTMLElement,
      { value: string; priority: string }
    >();

    const wireConfiguredModelLabels = () => {
      if (!configuredModelLabel) return;
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      let node = walker.nextNode();
      while (node) {
        const value = node.nodeValue ?? "";
        const label = value.trim();
        if (label !== configuredModelLabel && modelLabelAliases.has(label))
          node.nodeValue = value.replace(label, configuredModelLabel);
        node = walker.nextNode();
      }
    };

    const restoreNativeSettings = () => {
      if (activeScroll)
        for (const child of activeScroll.children) {
          if (!(child instanceof HTMLElement) || child === host) continue;
          if (child.dataset.localClaudeSettingsHidden === "true") {
            const display = nativeDisplay.get(child);
            if (display?.value)
              child.style.setProperty(
                "display",
                display.value,
                display.priority,
              );
            else child.style.removeProperty("display");
            nativeDisplay.delete(child);
            delete child.dataset.localClaudeSettingsHidden;
          }
        }
      host.hidden = true;
      if (localNavigationButton) {
        localNavigationButton.removeAttribute("aria-current");
        if (inactiveNavigationClass)
          localNavigationButton.className = inactiveNavigationClass;
      }
      activeScroll = null;
    };

    const hideNativeSettings = (scroll: HTMLElement) => {
      for (const child of scroll.children) {
        if (!(child instanceof HTMLElement) || child === host || child.hidden)
          continue;
        nativeDisplay.set(child, {
          value: child.style.getPropertyValue("display"),
          priority: child.style.getPropertyPriority("display"),
        });
        child.dataset.localClaudeSettingsHidden = "true";
        child.style.setProperty("display", "none", "important");
      }
    };

    const loadConfiguration = async () => {
      const load = ++configLoad;
      status.textContent = "Loading…";
      try {
        const config = await getConfig();
        if (load !== configLoad) return;
        baseUrl.value = config.provider.baseUrl;
        model.value = config.provider.model;
        modelLabelAliases.add(configuredModelLabel);
        configuredModelLabel = config.provider.model;
        contextWindow.value = String(config.provider.contextWindow);
        thinkingStartTag.value = config.provider.thinkingStartTag;
        thinkingEndTag.value = config.provider.thinkingEndTag;
        apiKey.value = "";
        apiKey.placeholder = config.hasApiKey
          ? "Key stored — leave blank to keep it"
          : "Optional";
        status.textContent = "";
        wireConfiguredModelLabels();
      } catch (error) {
        showError(error);
      }
    };

    const activateLocalSettings = (
      scroll: HTMLElement,
      navigationButton: HTMLButtonElement,
      navigationRoot: HTMLElement,
      panel: "model" | "export" | "memory" = "model",
    ) => {
      restoreNativeSettings();
      activeScroll = scroll;
      localNavigationButton = navigationButton;
      hideNativeSettings(scroll);
      if (host.parentElement !== scroll) scroll.append(host);
      host.hidden = false;
      showLocalPanel(panel);
      for (const button of navigationRoot.querySelectorAll<HTMLButtonElement>(
        "button[aria-current]",
      )) {
        if (button !== navigationButton) {
          button.removeAttribute("aria-current");
          if (inactiveNavigationClass)
            button.className = inactiveNavigationClass;
        }
      }
      navigationButton.setAttribute("aria-current", "page");
      if (activeNavigationClass)
        navigationButton.className = activeNavigationClass;
      if (panel === "export") {
        exportStatus.textContent = "";
        void loadExportConversations();
        return;
      }
      if (panel === "memory") {
        void loadMemorySettings();
        return;
      }
      void loadConfiguration().finally(() => {
        if (!host.hidden && activeLocalPanel === "model") {
          baseUrl.focus();
          baseUrl.select();
        }
      });
    };

    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest<HTMLButtonElement>(
          'nav[aria-label="Settings"] button',
        );
        const navigation = button?.closest<HTMLElement>(
          'nav[aria-label="Settings"]',
        );
        if (!button || !navigation) return;
        const isModelTab = Boolean(
          button.closest("[data-local-model-settings]"),
        );
        const isExportTab = Boolean(
          button.closest("[data-local-export-settings]"),
        );
        const isMemoryTab = Boolean(
          button.closest("[data-local-memory-settings]"),
        );
        if (!isModelTab && !isExportTab && !isMemoryTab) {
          if (activeScroll && !host.hidden) restoreNativeSettings();
          return;
        }
        const contentPane = navigation.nextElementSibling;
        const scroll =
          contentPane?.querySelector<HTMLElement>(".overflow-y-auto") ??
          (contentPane instanceof HTMLElement ? contentPane : null);
        if (!scroll) return;
        // The retained settings router replaces sidebar nodes between tabs.
        // Delegate from the stable document root and own the local route in
        // capture phase so neither a stale node nor the cloud router can make
        // the click fall through to the previously selected tab.
        event.preventDefault();
        event.stopImmediatePropagation();
        activateLocalSettings(
          scroll,
          button,
          navigation,
          isMemoryTab ? "memory" : isExportTab ? "export" : "model",
        );
      },
      true,
    );

    const wiredButtons = new WeakSet<HTMLButtonElement>();

    const wireLocalNavigation = () => {
      // The home-level scheduled surface lives at /scheduled-task in this
      // snapshot; a bare /scheduled still 404s.
      if (location.pathname === "/scheduled") {
        history.replaceState(history.state, "", "/scheduled-task");
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: history.state }),
        );
        return;
      }
      // The fullscreen /customize surface is retired: Skills / Connectors /
      // Plugins / Memory are managed in the settings dialog's Customize
      // group. Any navigation there (sidebar rows, in-app links) bounces
      // back and opens the dialog at the matching section. The dialog's own
      // section switching never changes the pathname, so this cannot loop.
      if (
        location.pathname === "/customize" ||
        location.pathname.startsWith("/customize/")
      ) {
        const section = location.pathname.split("/")[2] ?? "skills";
        const label =
          section === "connectors"
            ? "Connectors"
            : section === "plugins"
              ? "Plugins"
              : section === "memory"
                ? "Memory"
                : "Skills";
        history.replaceState(history.state, "", "/new");
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: history.state }),
        );
        // On a cold load the settings button itself is injected later, so
        // retry the whole open sequence until the section is reached.
        const deadline = Date.now() + 15000;
        let openedDialog = false;
        const openSection = () => {
          const dialog = [
            ...document.querySelectorAll<HTMLElement>('[role="dialog"]'),
          ].find((candidate) => candidate.getBoundingClientRect().width > 0);
          if (dialog) {
            const target = [
              ...dialog.querySelectorAll<HTMLButtonElement>(
                'nav[aria-label="Settings"] button',
              ),
            ]
              .filter(
                (button) =>
                  (button.querySelector(".truncate")?.textContent?.trim() ??
                    button.textContent?.trim()) === label,
              )
              .pop();
            if (target) {
              target.click();
              return;
            }
          } else if (!openedDialog) {
            const settings = document.querySelector<HTMLButtonElement>(
              '[data-testid="local-settings-sidebar-button"]',
            );
            if (settings) {
              settings.click();
              openedDialog = true;
            }
          }
          if (Date.now() < deadline) setTimeout(openSection, 150);
        };
        openSection();
        return;
      }
      const pills = document.querySelector<HTMLElement>(
        ".df-pills[data-segmented='true']",
      );
      const chat = pills?.querySelector<HTMLButtonElement>(
        'button[data-mode="chat"]',
      );
      const code = pills?.querySelector<HTMLButtonElement>(
        'button[data-mode="code"]',
      );
      const cowork = pills?.querySelector<HTMLButtonElement>(
        'button[data-mode="cowork"]',
      );
      if (pills && chat && code) {
        pills.dataset.pills = "2";
        pills.dataset.localModes = "true";
        if (cowork) cowork.dataset.localCloudOnly = "true";
        chat.setAttribute("aria-label", "Home");
        const label = chat.querySelector<HTMLElement>(".df-pill-label");
        if (label && label.textContent !== "Home") label.textContent = "Home";
        const active = code.hasAttribute("data-active") ? code : chat;
        pills.dataset.step = active === code ? "2" : "1";
        requestAnimationFrame(() => {
          const indicator =
            pills.querySelector<HTMLElement>(".df-pill-indicator");
          if (!indicator) return;
          indicator.style.transform = `translateX(${active.offsetLeft}px)`;
          indicator.style.width = `${active.offsetWidth}px`;
          indicator.style.visibility = "visible";
        });
      }

      // Older local builds injected a second Artifacts row. The retained client
      // now has its own native entry, so remove any stale injected copy.
      document.querySelector("[data-local-artifacts-button]")?.remove();
      document
        .querySelector('[data-testid="local-artifacts-sidebar-button"]')
        ?.remove();

      for (const candidate of document.querySelectorAll<HTMLElement>(
        "div,aside,section",
      )) {
        const text = candidate.innerText;
        if (
          text?.includes("Try the Slack app") &&
          text.includes("Install") &&
          candidate.children.length < 12
        ) {
          candidate.dataset.localCloudOnly = "true";
          break;
        }
      }
      // The sandbox-setup notice (toast in older snapshots, inline card on
      // /task/new in 1.22209) is cloud-runner guidance that local sessions
      // never need. Mark the smallest container that holds just the notice:
      // matching the FIRST element containing the text would select the app
      // root (textContent includes descendants) and hide the whole page.
      const secureWorkspaceText =
        "A Windows feature needs to be enabled to give Claude a secure workspace.";
      const secureWorkspaceMessage = [
        ...document.querySelectorAll<HTMLElement>("div,p,span"),
      ].find(
        (candidate) =>
          candidate.textContent?.includes(secureWorkspaceText) &&
          ![...candidate.children].some((child) =>
            child.textContent?.includes(secureWorkspaceText),
          ),
      );
      if (secureWorkspaceMessage) {
        let cloudNotice = secureWorkspaceMessage.closest<HTMLElement>(
          '[role="alert"],[role="status"]',
        );
        if (!cloudNotice) {
          cloudNotice = secureWorkspaceMessage;
          const limit =
            (secureWorkspaceMessage.textContent?.length ?? 0) + 60;
          while (
            cloudNotice.parentElement &&
            cloudNotice.parentElement !== document.body &&
            (cloudNotice.parentElement.textContent?.length ?? Infinity) <=
              limit
          )
            cloudNotice = cloudNotice.parentElement;
        }
        cloudNotice.dataset.localCloudOnly = "true";
      }
    };

    const wireSidebarSettings = () => {
      const userMenu = document.querySelector<HTMLButtonElement>(
        '[data-testid="user-menu-button"]',
      );
      const container = userMenu?.parentElement;
      if (!userMenu || !container) return;
      if (
        container.querySelector('[data-testid="local-settings-sidebar-button"]')
      )
        return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.testid = "local-settings-sidebar-button";
      button.className = userMenu.className;
      button.setAttribute("aria-label", "Settings");
      button.innerHTML = `<span class="relative flex w-[var(--df-leading-slot)] shrink-0 items-center justify-center" aria-hidden="true" style="font-size:17px">&#9881;</span><span class="df-footer-suffix flex min-w-0 items-baseline gap-1 overflow-hidden text-[length:var(--df-row-font)]"><span class="max-w-full shrink-0 whitespace-nowrap text-text-300">Settings</span></span>`;
      button.addEventListener("click", () => {
        void ipcRenderer.invoke("local-open-settings");
      });
      container.prepend(button);
    };

    // The dframe chat sidebar has no native Artifacts entry (the retained
    // desktop build only ships one in the Code sidebar), so mirror it: same
    // glyph, routed to the chat-surface /artifacts gallery. The row is
    // removed again whenever a native Artifacts row is visible so a Code
    // mode transition can never show two.
    const wireSidebarArtifacts = () => {
      const stripped = (element: Element) =>
        (element.textContent ?? "").replace(/[\uE000-\uF8FF]/gu, "").trim();
      const rows = [
        ...document.querySelectorAll<HTMLElement>("a,button"),
      ].filter((row) => row.getClientRects().length > 0);
      const injected = document.querySelector<HTMLElement>(
        '[data-testid="local-chat-artifacts-button"]',
      );
      const nativeVisible = rows.some(
        (row) => stripped(row) === "Artifacts" && !row.dataset.testid,
      );
      const isChatSidebar = rows.some((row) =>
        /New ?chat/u.test(stripped(row)),
      );
      if (nativeVisible || !isChatSidebar) {
        injected?.remove();
        return;
      }
      if (injected) return;
      const customize = rows.find((row) => stripped(row) === "Customize");
      if (!customize?.parentElement) return;
      const button = customize.cloneNode(true) as HTMLElement;
      button.dataset.testid = "local-chat-artifacts-button";
      button.setAttribute("aria-label", "Artifacts");
      button.removeAttribute("id");
      for (const element of [button, ...button.querySelectorAll("*")])
        if (
          element.childElementCount === 0 &&
          stripped(element) === "Customize"
        )
          element.textContent = "Artifacts";
      // Copy the native Artifacts glyph from the (possibly hidden) Code
      // sidebar row; sidebar icons are icon-font glyphs, not SVGs. The native
      // row only exists in Code mode, so fall back to its known glyph
      // (U+E017) when injecting into the chat sidebar.
      const nativeRow = [
        ...document.querySelectorAll<HTMLElement>("a,button"),
      ].find((row) => stripped(row) === "Artifacts" && !row.dataset.testid);
      const glyphOf = (element: Element | undefined | null) =>
        element?.textContent?.match(/[\uE000-\uF8FF]/u)?.[0];
      const nativeGlyph = glyphOf(nativeRow) ?? "\uE017";
      const iconHost = [...button.querySelectorAll<HTMLElement>("*")].find(
        (element) =>
          element.childElementCount === 0 &&
          /^[\uE000-\uF8FF]$/u.test(element.textContent ?? ""),
      );
      if (iconHost) iconHost.textContent = nativeGlyph;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        history.pushState(history.state, "", "/artifacts");
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: history.state }),
        );
      });
      customize.parentElement.insertBefore(button, customize.nextSibling);
    };

    // The local sidebar is bespoke, so native nav registrations (Projects)
    // never mount; inject the row beside Artifacts and route through the
    // SPA history like the gallery row does.
    const wireSidebarProjects = () => {
      const stripped = (element: Element) =>
        (element.textContent ?? "").replace(/[-]/gu, "").trim();
      const rows = [
        ...document.querySelectorAll<HTMLElement>("a,button"),
      ].filter((row) => row.getClientRects().length > 0);
      const isChatSidebar = rows.some((row) =>
        /New ?chat/u.test(stripped(row)),
      );
      const injected = document.querySelector<HTMLElement>(
        '[data-testid="local-projects-button"]',
      );
      if (!isChatSidebar) {
        document.documentElement.dataset.projectsWire = "no-sidebar";
        injected?.remove();
        return;
      }
      if (injected) {
        document.documentElement.dataset.projectsWire = "present";
        return;
      }
      const template =
        document.querySelector<HTMLElement>(
          '[data-testid="local-chat-artifacts-button"]',
        ) ?? rows.find((row) => stripped(row) === "Customize");
      if (!template?.parentElement) {
        document.documentElement.dataset.projectsWire = "no-template";
        return;
      }
      document.documentElement.dataset.projectsWire = "injecting";
      const button = template.cloneNode(true) as HTMLElement;
      button.dataset.testid = "local-projects-button";
      button.setAttribute("aria-label", "Projects");
      button.removeAttribute("id");
      for (const element of [button, ...button.querySelectorAll("*")])
        if (
          element.childElementCount === 0 &&
          ["Artifacts", "Customize"].includes(stripped(element))
        )
          element.textContent = "Projects";
      const iconHost = [...button.querySelectorAll<HTMLElement>("*")].find(
        (element) =>
          element.childElementCount === 0 &&
          /^[-]$/u.test(element.textContent ?? ""),
      );
      // Anthropicons "Projects" glyph; the cloned span keeps the native
      // variable-weight hover animation.
      if (iconHost) iconHost.textContent = "\uE0C9";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        history.pushState(history.state, "", "/projects");
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: history.state }),
        );
      });
      template.parentElement.insertBefore(button, template.nextSibling);
    };

    // The Capabilities settings section ships assembled but has no nav entry
    // in this build (see the unlock-capabilities-settings-page client patch).
    // Inject one into every settings nav, routed to the full-page section.
    const wireCapabilitiesNavigation = () => {
      for (const nav of document.querySelectorAll<HTMLElement>(
        'nav[aria-label="Settings"]',
      )) {
        // The full-page settings nav renders outside the dialog wiring that
        // normally marks cloud-only sections; mark them here too.
        for (const button of nav.querySelectorAll<HTMLButtonElement>(
          "button, a",
        )) {
          const label =
            button.querySelector(".truncate")?.textContent?.trim() ??
            button.textContent?.trim() ??
            "";
          if (label === "Privacy")
            (button.closest("li") ?? button).dataset.localCloudOnly = "true";
        }
        if (nav.querySelector("[data-local-capabilities-settings]")) continue;
        const buttons = [...nav.querySelectorAll<HTMLButtonElement>("button")];
        const claudeCode = buttons.find(
          (button) =>
            (button.querySelector(".truncate")?.textContent?.trim() ??
              button.textContent?.trim()) === "Claude Code",
        );
        const host = claudeCode?.closest("li") ?? claudeCode;
        if (!claudeCode || !host?.parentElement) continue;
        const item = document.createElement("li");
        item.dataset.localCapabilitiesSettings = "";
        const button = document.createElement("button");
        button.type = "button";
        button.className = claudeCode.className;
        button.innerHTML = `<span aria-hidden="true" style="width:1em;height:1em;display:flex;align-items:center;justify-content:center;font-size:15px">&#9707;</span><span class="min-w-0 flex-1 truncate">Capabilities</span>`;
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          const dialog = button.closest<HTMLElement>('[role="dialog"]');
          dialog
            ?.querySelector<HTMLButtonElement>(
              'button[aria-label="Close"], button[aria-label="Close settings"]',
            )
            ?.click();
          history.pushState(history.state, "", "/settings/capabilities");
          window.dispatchEvent(
            new PopStateEvent("popstate", { state: history.state }),
          );
        });
        item.append(button);
        host.before(item);
      }
    };

    // The home sidebar's native Scheduled entry is Cowork-gated, so the local
    // build injects one (mirroring the Projects injection) that routes to the
    // working Code-surface routines page.
    const wireSidebarScheduled = () => {
      const stripped = (element: Element) =>
        (element.textContent ?? "").replace(/[-]/gu, "").trim();
      const rows = [
        ...document.querySelectorAll<HTMLElement>("a,button"),
      ].filter((row) => row.getClientRects().length > 0);
      const isChatSidebar = rows.some((row) =>
        /New ?chat/u.test(stripped(row)),
      );
      const injected = document.querySelector<HTMLElement>(
        '[data-testid="local-scheduled-button"]',
      );
      if (!isChatSidebar) {
        injected?.remove();
        return;
      }
      if (injected) return;
      const template = document.querySelector<HTMLElement>(
        '[data-testid="local-projects-button"]',
      );
      if (!template?.parentElement) return;
      const button = template.cloneNode(true) as HTMLElement;
      button.dataset.testid = "local-scheduled-button";
      button.setAttribute("aria-label", "Scheduled");
      button.removeAttribute("id");
      for (const element of [button, ...button.querySelectorAll("*")])
        if (
          element.childElementCount === 0 &&
          stripped(element) === "Projects"
        )
          element.textContent = "Scheduled";
      const iconHost = [...button.querySelectorAll<HTMLElement>("*")].find(
        (element) =>
          element.childElementCount === 0 &&
          /^[-]$/u.test(element.textContent ?? ""),
      );
      // Anthropicons "Clock" glyph — the icon the native Scheduled tab uses.
      if (iconHost) iconHost.textContent = "";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        history.pushState(history.state, "", "/scheduled-task");
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: history.state }),
        );
      });
      template.parentElement.insertBefore(button, template.nextSibling);
    };

    // save_memory tool pills re-render as the native "Saved memory" chain
    // row: memory glyph, breadcrumb to the topic, content line beneath, and
    // a link to the memory page.
    const wireMemorySaveRows = () => {
      // Only the innermost row whose own text IS the save-memory label may
      // transform: outer chain pills contain the same text plus thinking and
      // other steps, and replacing those destroys the chain.
      const candidates = [
        ...document.querySelectorAll<HTMLElement>("button"),
      ].filter((button) => {
        const text = button.textContent ?? "";
        if (!text.includes("Saved memory") || !text.includes("⁣")) return false;
        if (
          [...button.querySelectorAll("button")].some((inner) =>
            (inner.textContent ?? "").includes("⁣"),
          )
        )
          return false;
        const match = text.match(/^\s*Saved memory(?: · (.*?))?⁣(.*?)\s*$/s);
        return Boolean(match);
      });
      const pills = candidates.filter(
        (button) =>
          // React re-renders restore the original label; re-apply whenever
          // our rebuilt markup is missing, regardless of the marker.
          !button.querySelector("[data-local-memory-content]"),
      );
      for (const pill of pills) {
        const match = (pill.textContent ?? "").match(
          /^\s*Saved memory(?: · (.*?))?⁣(.*?)\s*$/s,
        );
        if (!match) continue;
        const topic = (match[1] ?? "").trim();
        const content = (match[2] ?? "").trim();
        pill.dataset.localMemoryRow = "1";
        pill.style.display = "block";
        pill.style.width = "100%";
        pill.style.textAlign = "left";
        pill.style.cursor = "default";
        pill.innerHTML = `
          <div class="transition-colors rounded-lg duration-150">
            <div class="flex flex-row items-center py-1">
              <div class="w-[20px] flex justify-center shrink-0 text-text-500">
                <span aria-hidden="true" data-local-memory-glyph style="font-family: var(--font-anthropicons, Anthropicons-Variable); font-feature-settings: 'liga' 0; font-optical-sizing: auto; font-style: normal; line-height: 1; width: 1em; height: 1em; display: flex; align-items: center; justify-content: center; flex-shrink: 0; user-select: none; font-size: 16px; font-weight: 533.3;"></span>
              </div>
              <div class="flex-1 min-w-0">
                <a href="/customize/memory" data-local-memory-link class="group/row flex flex-row items-center rounded-lg px-2.5 w-full justify-between text-text-300 cursor-pointer transition-colors duration-200 hover:text-text-200">
                  <div class="flex flex-row items-center gap-2 min-w-0 flex-1">
                    <div class="text-body text-text-500 text-left truncate w-0 flex-grow">
                      <span class="flex min-w-0 items-baseline gap-2 truncate">
                        <span class="truncate text-text-500">Saved memory</span>
                        <span class="inline-flex min-w-0 items-baseline gap-1 overflow-hidden whitespace-nowrap text-xs leading-[1.4] text-text-500">
                          <span class="truncate">Topics</span>
                          <span aria-hidden="true">›</span>
                          <span class="truncate" data-local-memory-topic></span>
                        </span>
                      </span>
                    </div>
                  </div>
                </a>
              </div>
            </div>
            <div class="flex flex-row">
              <div class="w-[20px] flex justify-center shrink-0">
                <div class="w-[1px] h-full duration-150 bg-border-300"></div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="truncate px-2.5 pt-1 !font-base text-text-400" data-local-memory-content></div>
              </div>
            </div>
          </div>`;
        const glyphHost = pill.querySelector<HTMLElement>(
          "[data-local-memory-glyph]",
        );
        // Anthropicons "Memory" glyph (U+E0A8).
        if (glyphHost) glyphHost.textContent = String.fromCharCode(0xe0a8);
        const topicHost = pill.querySelector<HTMLElement>(
          "[data-local-memory-topic]",
        );
        if (topicHost) topicHost.textContent = topic || "General";
        const contentHost = pill.querySelector<HTMLElement>(
          "[data-local-memory-content]",
        );
        if (contentHost) contentHost.textContent = content;
        pill
          .querySelector<HTMLAnchorElement>("[data-local-memory-link]")
          ?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            history.pushState(history.state, "", "/customize/memory");
            window.dispatchEvent(
              new PopStateEvent("popstate", { state: history.state }),
            );
          });
        if (!pill.dataset.localMemoryRowWired) {
          pill.dataset.localMemoryRowWired = "1";
          pill.addEventListener(
            "click",
            (event) => {
              if (
                !(event.target as Element | null)?.closest(
                  "[data-local-memory-link]",
                )
              ) {
                event.preventDefault();
                event.stopImmediatePropagation();
              }
            },
            true,
          );
        }
      }
    };

    // The Customize landing lists only its native sections; add a Memory row
    // that opens the (fully wired) /customize/memory page.
    const wireCustomizeMemoryEntry = () => {
      // Connectors needs no injected row: the native Customize navigation
      // renders its own Connectors entry, backed by the local MCP remote
      // server endpoints.
      const entries = [
        {
          testid: "local-customize-memory-row",
          label: "Memory",
          href: "/customize/memory",
        },
      ];
      if (!location.pathname.startsWith("/customize")) {
        for (const entry of entries)
          document.querySelector(`[data-testid="${entry.testid}"]`)?.remove();
        return;
      }
      const skillsRow = [
        ...document.querySelectorAll<HTMLElement>("a,button,[role=button]"),
      ].find(
        (row) =>
          row.getClientRects().length > 0 &&
          (row.textContent ?? "").trim() === "Skills",
      );
      if (!skillsRow?.parentElement) return;
      let anchor: HTMLElement = skillsRow;
      for (const entry of entries) {
        if (document.querySelector(`[data-testid="${entry.testid}"]`)) {
          const existing = document.querySelector<HTMLElement>(
            `[data-testid="${entry.testid}"]`,
          );
          if (existing) anchor = existing;
          continue;
        }
        const row = skillsRow.cloneNode(true) as HTMLElement;
        row.dataset.testid = entry.testid;
        row.removeAttribute("id");
        for (const element of [row, ...row.querySelectorAll("*")])
          if (
            element.childElementCount === 0 &&
            (element.textContent ?? "").trim() === "Skills"
          )
            element.textContent = entry.label;
        row.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          history.pushState(history.state, "", entry.href);
          window.dispatchEvent(
            new PopStateEvent("popstate", { state: history.state }),
          );
        });
        anchor.parentElement?.insertBefore(row, anchor.nextSibling);
        anchor = row;
      }
    };

    const wireSettingsDialog = () => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      for (const dialog of dialogs) {
        const navigation = dialog.querySelector<HTMLElement>(
          'nav[aria-label="Settings"]',
        );
        if (!navigation) continue;
        const sectionLabels = [
          ...navigation.querySelectorAll<HTMLElement>("div"),
        ];
        const desktopLabel = sectionLabels.find(
          (candidate) => candidate.textContent?.trim() === "Desktop app",
        );
        const groupedDesktopList = desktopLabel?.nextElementSibling;
        const navigationLists = [
          ...navigation.querySelectorAll<HTMLUListElement>("ul"),
        ];
        const desktopList =
          (groupedDesktopList instanceof HTMLUListElement
            ? groupedDesktopList
            : null) ??
          navigationLists.find((list) => {
            const labels = [
              ...list.querySelectorAll<HTMLElement>("button .truncate"),
            ].map((label) => label.textContent?.trim());
            return labels.includes("General") && labels.includes("Claude Code");
          }) ??
          navigationLists[0];
        if (!desktopList) continue;
        const contentPane = navigation.nextElementSibling;
        const scroll =
          contentPane?.querySelector<HTMLElement>(".overflow-y-auto") ??
          (contentPane instanceof HTMLElement ? contentPane : null);
        if (!scroll) continue;

        const existingButtons = [
          ...navigation.querySelectorAll<HTMLButtonElement>("button"),
        ];
        // Cowork is locally backed now; only Privacy stays cloud-only.
        const cloudOnlySettings = new Set(["Privacy"]);
        for (const button of existingButtons) {
          const label =
            button
              .querySelector<HTMLElement>(".truncate")
              ?.textContent?.trim() ??
            button.textContent?.trim() ??
            "";
          if (cloudOnlySettings.has(label))
            (button.closest("li") ?? button).dataset.localCloudOnly = "true";
        }
        const instructionCopy = [
          ...dialog.querySelectorAll<HTMLElement>("div,p,span"),
        ]
          .filter((candidate) =>
            candidate.textContent?.includes(
              "Claude will keep these in mind across chats and Cowork",
            ),
          )
          .sort(
            (left, right) =>
              (left.textContent?.length ?? 0) -
              (right.textContent?.length ?? 0),
          )[0];
        if (instructionCopy)
          instructionCopy.textContent =
            "Open-Claude will keep these in mind across chats on this device.";
        const activeTemplate = existingButtons.find((button) =>
          button.hasAttribute("aria-current"),
        );
        const inactiveTemplate = existingButtons.find(
          (button) => !button.hasAttribute("aria-current"),
        );
        activeNavigationClass =
          activeTemplate?.className || activeNavigationClass;
        inactiveNavigationClass =
          inactiveTemplate?.className || inactiveNavigationClass;

        let item = desktopList.querySelector<HTMLElement>(
          "[data-local-model-settings]",
        );
        if (!item) {
          item = document.createElement("li");
          item.dataset.localModelSettings = "";
          const button = document.createElement("button");
          button.type = "button";
          button.className = inactiveNavigationClass;
          button.innerHTML = `<span aria-hidden="true" style="width:1em;height:1em;display:flex;align-items:center;justify-content:center;font-size:17px">&#9881;</span><span class="min-w-0 flex-1 truncate">Model</span>`;
          item.append(button);
          desktopList.prepend(item);
        }
        const localButton = item.querySelector<HTMLButtonElement>("button");
        if (!localButton) continue;
        const localLabel = localButton.querySelector<HTMLElement>(".truncate");
        if (localLabel && localLabel.textContent?.trim() !== "Model")
          localLabel.textContent = "Model";
        if (host.hidden || !localNavigationButton)
          localNavigationButton = localButton;
        wiredButtons.add(localButton);

        let exportItem = desktopList.querySelector<HTMLElement>(
          "[data-local-export-settings]",
        );
        if (!exportItem) {
          exportItem = document.createElement("li");
          exportItem.dataset.localExportSettings = "";
          const button = document.createElement("button");
          button.type = "button";
          button.className = inactiveNavigationClass;
          button.innerHTML = `<span aria-hidden="true" style="width:1em;height:1em;display:flex;align-items:center;justify-content:center;font-size:15px">&#10515;</span><span class="min-w-0 flex-1 truncate">Data export</span>`;
          exportItem.append(button);
          item.after(exportItem);
        }
        const exportButton =
          exportItem.querySelector<HTMLButtonElement>("button");
        if (exportButton) wiredButtons.add(exportButton);

        let memoryItem = desktopList.querySelector<HTMLElement>(
          "[data-local-memory-settings]",
        );
        if (!memoryItem) {
          memoryItem = document.createElement("li");
          memoryItem.dataset.localMemorySettings = "";
          const button = document.createElement("button");
          button.type = "button";
          button.className = inactiveNavigationClass;
          button.innerHTML = `<span aria-hidden="true" style="width:1em;height:1em;display:flex;align-items:center;justify-content:center;font-size:15px;font-family:var(--font-anthropicons, Anthropicons-Variable)">&#57512;</span><span class="min-w-0 flex-1 truncate">Memory</span>`;
          memoryItem.append(button);
          exportItem.after(memoryItem);
        }
        const memoryButton =
          memoryItem.querySelector<HTMLButtonElement>("button");
        if (memoryButton) wiredButtons.add(memoryButton);

        for (const button of existingButtons) {
          if (wiredButtons.has(button)) continue;
          wiredButtons.add(button);
          button.addEventListener("click", restoreNativeSettings, {
            capture: true,
          });
        }
        if (activeScroll === scroll && !host.hidden) hideNativeSettings(scroll);
      }
    };

    element("#models-button").addEventListener("click", async () => {
      status.textContent = "Contacting provider…";
      models.replaceChildren();
      try {
        const catalog = await modelCatalog({
          baseUrl: baseUrl.value.trim(),
          ...(apiKey.value ? { apiKey: apiKey.value } : {}),
        });
        const available = catalog.models;
        for (const id of available) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = id;
          button.addEventListener("click", () => {
            model.value = id;
            const detectedContextWindow = catalog.contextWindows?.[id];
            if (detectedContextWindow)
              contextWindow.value = String(detectedContextWindow);
          });
          models.append(button);
        }
        status.textContent = available.length
          ? `${available.length} model${available.length === 1 ? "" : "s"} found.`
          : "The provider returned no models.";
      } catch (error) {
        showError(error);
      }
    });
    element("#save").addEventListener("click", async () => {
      status.textContent = "Saving…";
      try {
        await setConfig({
          baseUrl: baseUrl.value.trim(),
          model: model.value.trim(),
          contextWindow: Number(contextWindow.value),
          thinkingStartTag: thinkingStartTag.value,
          thinkingEndTag: thinkingEndTag.value,
          ...(apiKey.value ? { apiKey: apiKey.value } : {}),
        });
        modelLabelAliases.add(configuredModelLabel);
        configuredModelLabel = model.value.trim();
        wireConfiguredModelLabels();
        apiKey.value = "";
        apiKey.placeholder = "Key stored — leave blank to keep it";
        status.textContent = "Saved.";
      } catch (error) {
        showError(error);
      }
    });

    // The artifact pane open/close bridge lives in the page-world runtime
    // script injected by local-ui.ts: React fiber internals are invisible
    // from this isolated preload world. Only DOM-level shims remain here.
    let openedCodeArtifactId: string | null = null;
    const wireCodeArtifactRoute = () => {
      const id = new URL(location.href).searchParams.get("open_local_artifact");
      if (!id) {
        openedCodeArtifactId = null;
        return;
      }
      if (openedCodeArtifactId === id) return;
      openedCodeArtifactId = id;
      const open = async () => {
        const deadline = Date.now() + 5_000;
        const requestedUrl = `/code/artifact/${encodeURIComponent(id)}`;
        document.documentElement.dataset.openClaudeCodeArtifact = requestedUrl;
        while (Date.now() < deadline) {
          window.dispatchEvent(new Event("open-claude-code-artifact"));
          if (
            document.documentElement.dataset.openClaudeCodeArtifact !==
            requestedUrl
          )
            return;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        delete document.documentElement.dataset.openClaudeCodeArtifact;
        openedCodeArtifactId = null;
      };
      setTimeout(() => void open(), 250);
    };
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const anchor = target.closest<HTMLAnchorElement>("a[href]");
        if (
          anchor &&
          event.button === 0 &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          (!anchor.target || anchor.target === "_self")
        ) {
          const destination = new URL(anchor.href, location.href);
          if (
            destination.protocol === "app:" &&
            destination.hostname === "localhost" &&
            destination.pathname.startsWith("/chat/") &&
            destination.searchParams.has("artifactId")
          ) {
            // Native gallery cards are rendered as plain anchors. Letting the
            // browser follow one replaces the whole renderer and destroys any
            // in-flight retry/stream state. Route through the retained SPA's
            // popstate listener so the old chat and artifact hydrate in place.
            event.preventDefault();
            event.stopImmediatePropagation();
            history.pushState(
              history.state,
              "",
              `${destination.pathname}${destination.search}${destination.hash}`,
            );
            window.dispatchEvent(
              new PopStateEvent("popstate", { state: history.state }),
            );
          }
        }
      },
      true,
    );

    document.documentElement.append(host);
    // Local streaming dictation: a mic button beside the composer records
    // with MediaRecorder and re-transcribes the growing buffer every couple
    // of seconds, appending newly stabilized words to the composer so the
    // text streams in while the mic stays on — the user can leave dictation
    // running and hit send whenever. whisper.cpp is batch-only, so partial
    // passes hold back the last words (they change while audio grows) and
    // the final pass on stop commits everything.
    let dictationRecorder: MediaRecorder | null = null;
    let dictationChunks: Blob[] = [];
    let dictationCommitted: string[] = [];
    let dictationTimer: ReturnType<typeof setInterval> | null = null;
    let dictationBusy = false;
    let dictationGeneration = 0;
    const dictationInsert = (text: string) => {
      const editor = [
        ...document.querySelectorAll<HTMLElement>('[contenteditable="true"]'),
      ].find((candidate) => {
        const label = candidate.getAttribute("aria-label") ?? "";
        return (
          candidate.getClientRects().length > 0 &&
          (label === "Write your prompt to Claude" || label === "Prompt")
        );
      });
      if (!editor) return;
      editor.focus();
      document.execCommand("insertText", false, text);
    };
    // whisper.cpp consumes 16 kHz mono PCM16 WAV; decode and resample the
    // recording with the Web Audio API so the backend needs no ffmpeg.
    const dictationWav = async (blob: Blob): Promise<Blob> => {
      const decodeContext = new AudioContext();
      let decoded: AudioBuffer;
      try {
        decoded = await decodeContext.decodeAudioData(await blob.arrayBuffer());
      } finally {
        void decodeContext.close();
      }
      const offline = new OfflineAudioContext(
        1,
        Math.max(1, Math.ceil(decoded.duration * 16_000)),
        16_000,
      );
      const source = offline.createBufferSource();
      source.buffer = decoded;
      source.connect(offline.destination);
      source.start();
      const rendered = await offline.startRendering();
      const samples = rendered.getChannelData(0);
      const wav = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(wav);
      const writeAscii = (offset: number, text: string) => {
        for (let index = 0; index < text.length; index += 1)
          view.setUint8(offset + index, text.charCodeAt(index));
      };
      writeAscii(0, "RIFF");
      view.setUint32(4, 36 + samples.length * 2, true);
      writeAscii(8, "WAVE");
      writeAscii(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, 16_000, true);
      view.setUint32(28, 32_000, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeAscii(36, "data");
      view.setUint32(40, samples.length * 2, true);
      for (let index = 0; index < samples.length; index += 1) {
        const sample = Math.max(-1, Math.min(1, samples[index]));
        view.setInt16(
          44 + index * 2,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true,
        );
      }
      return new Blob([wav], { type: "audio/wav" });
    };
    const transcribeChunks = async (
      chunks: Blob[],
      mimeType: string,
    ): Promise<string> => {
      const recorded = new Blob(chunks, { type: mimeType || "audio/webm" });
      if (recorded.size === 0) return "";
      const blob = await dictationWav(recorded);
      const response = await fetch("/api/local/dictation/transcribe", {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      const payload = (await response.json()) as {
        text?: string;
        error?: { message?: string };
      };
      if (payload.error?.message) throw new Error(payload.error.message);
      return (payload.text ?? "").trim();
    };
    // Preload fetches are invisible to the page realm; announce passes as
    // DOM events so probes (and future UI) can observe streaming progress.
    const announceDictationPass = (phase: "partial" | "final") => {
      document.dispatchEvent(
        new CustomEvent("local-dictation-pass", { detail: { phase } }),
      );
    };
    // Append the transcript's words beyond what was already committed.
    // Partial passes drop the trailing two words: whisper keeps revising
    // the end of a still-growing recording, and the composer text must
    // only ever grow — never rewrite what the user already sees.
    const dictationAppend = (transcript: string, finalPass: boolean) => {
      const words = transcript.split(/\s+/).filter(Boolean);
      const usable = finalPass ? words : words.slice(0, -2);
      if (usable.length <= dictationCommitted.length) return;
      const fresh = usable.slice(dictationCommitted.length);
      dictationInsert(
        (dictationCommitted.length > 0 ? " " : "") + fresh.join(" "),
      );
      dictationCommitted = usable;
    };
    const dictationTick = async () => {
      const recorder = dictationRecorder;
      if (!recorder || dictationBusy) return;
      const generation = dictationGeneration;
      dictationBusy = true;
      try {
        recorder.requestData();
        // Let the flushed dataavailable event land before snapshotting.
        await new Promise((resolve) => setTimeout(resolve, 60));
        const text = await transcribeChunks(
          dictationChunks.slice(),
          recorder.mimeType,
        );
        // A stop while this pass was in flight owns the final append.
        if (generation === dictationGeneration && dictationRecorder) {
          dictationAppend(text, false);
          announceDictationPass("partial");
        }
      } catch {
        // Partial passes are best effort; the final pass reports errors.
      } finally {
        dictationBusy = false;
      }
    };
    const stopDictation = async (button: HTMLButtonElement) => {
      const recorder = dictationRecorder;
      dictationRecorder = null;
      if (!recorder) return;
      dictationGeneration += 1;
      if (dictationTimer !== null) {
        clearInterval(dictationTimer);
        dictationTimer = null;
      }
      button.dataset.state = "busy";
      button.style.color = "";
      const finished = new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
      });
      recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
      await finished;
      // Wait out an in-flight partial pass so the final append wins.
      const busyDeadline = Date.now() + 15_000;
      while (dictationBusy && Date.now() < busyDeadline)
        await new Promise((resolve) => setTimeout(resolve, 100));
      try {
        const text = await transcribeChunks(dictationChunks, recorder.mimeType);
        dictationChunks = [];
        if (text) dictationAppend(text, true);
        announceDictationPass("final");
      } catch (error) {
        button.title =
          error instanceof Error ? error.message : "Transcription failed";
      } finally {
        dictationCommitted = [];
        delete button.dataset.state;
      }
    };
    const startDictation = async (button: HTMLButtonElement) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        dictationChunks = [];
        dictationCommitted = [];
        const recorder = new MediaRecorder(stream);
        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) dictationChunks.push(event.data);
        });
        // Timesliced so partial passes always have decodable audio.
        recorder.start(1_000);
        dictationRecorder = recorder;
        dictationTimer = setInterval(() => void dictationTick(), 2_500);
        button.dataset.state = "recording";
        button.style.color = "#d97757";
      } catch (error) {
        button.title =
          error instanceof Error ? error.message : "Microphone unavailable";
      }
    };
    const wireDictationButton = () => {
      if (document.querySelector('[data-testid="local-dictate-button"]'))
        return;
      const anchor = [
        ...document.querySelectorAll<HTMLButtonElement>("button"),
      ].find(
        (candidate) =>
          candidate.getClientRects().length > 0 &&
          candidate.getAttribute("aria-label") ===
            "Add files, connectors, and more",
      );
      if (!anchor?.parentElement) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.testid = "local-dictate-button";
      button.setAttribute("aria-label", "Dictate");
      button.title = "Dictate (on-device transcription)";
      button.className = anchor.className;
      button.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
      // A route change remounts the composer while a recording may still be
      // live; the fresh button must show the active state, not idle.
      if (dictationRecorder) {
        button.dataset.state = "recording";
        button.style.color = "#d97757";
      }
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.dataset.state === "busy") return;
        if (dictationRecorder) void stopDictation(button);
        else void startDictation(button);
      });
      anchor.parentElement.insertBefore(button, anchor.nextSibling);
    };
    // A Skill row in the Code chain links to /customize/skills?skill=<name>.
    // The native Customize page has no deep-link support, so select the
    // matching row once it renders.
    let customizeSkillHandledUrl = "";
    const wireCustomizeSkillSelection = () => {
      if (location.pathname !== "/customize/skills") return;
      const requested = new URLSearchParams(location.search).get("skill");
      if (!requested) return;
      const url = `${location.pathname}${location.search}`;
      if (customizeSkillHandledUrl === url) return;
      const normalize = (value: string) =>
        value.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const wanted = normalize(requested);
      if (!wanted) return;
      const candidates = [
        ...document.querySelectorAll<HTMLElement>('button, [role="button"]'),
      ].filter((element) =>
        normalize(element.textContent ?? "").includes(wanted),
      );
      if (candidates.length === 0) return;
      // The tightest match is the row itself rather than a page container.
      candidates.sort(
        (a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0),
      );
      customizeSkillHandledUrl = url;
      candidates[0].click();
    };
    // Directory-grouped Code sidebar: the native session-groups feature is
    // cloud-only, so the Recents list on the Code surface is regrouped here —
    // an un-indented, expandable directory header per working directory with
    // its sessions indented beneath.
    interface CodeSidebarSession {
      sessionId: string;
      title: string;
      cwd: string;
      lastActivityAt: number;
      isRunning: boolean;
      isArchived: boolean;
    }
    let codeSidebarSessions: CodeSidebarSession[] = [];
    let codeSidebarSignature = "";
    let codeSidebarFetching = false;
    let codeSidebarFetchedAt = 0;
    const collapsedCodeDirs = new Set<string>(
      (() => {
        try {
          const stored = JSON.parse(
            localStorage.getItem("local-code-dir-collapsed") ?? "[]",
          ) as unknown;
          return Array.isArray(stored)
            ? stored.filter(
                (entry): entry is string => typeof entry === "string",
              )
            : [];
        } catch {
          return [];
        }
      })(),
    );
    const persistCollapsedCodeDirs = () => {
      try {
        localStorage.setItem(
          "local-code-dir-collapsed",
          JSON.stringify([...collapsedCodeDirs]),
        );
      } catch {
        // Collapse state is a convenience only.
      }
    };
    const refreshCodeSidebarSessions = async () => {
      if (codeSidebarFetching) return;
      codeSidebarFetching = true;
      try {
        const payload = (await (
          await fetch("/api/local/code/sessions")
        ).json()) as { sessions?: CodeSidebarSession[] };
        codeSidebarSessions = (payload.sessions ?? []).filter(
          (session) => !session.isArchived && session.cwd,
        );
        codeSidebarFetchedAt = Date.now();
      } catch {
        // The next poll retries.
      } finally {
        codeSidebarFetching = false;
      }
    };
    const renderCodeSidebarGroups = (tree: HTMLElement) => {
      const groups = new Map<string, CodeSidebarSession[]>();
      for (const session of codeSidebarSessions) {
        const bucket = groups.get(session.cwd) ?? [];
        bucket.push(session);
        groups.set(session.cwd, bucket);
      }
      const ordered = [...groups.entries()]
        .map(([cwd, sessions]) => ({
          cwd,
          sessions: sessions.sort(
            (left, right) => right.lastActivityAt - left.lastActivityAt,
          ),
          latest: Math.max(...sessions.map((s) => s.lastActivityAt)),
        }))
        .sort((left, right) => right.latest - left.latest);
      const activeId = location.pathname.split("/")[2] ?? "";
      const signature = JSON.stringify([
        ordered.map((group) => [
          group.cwd,
          collapsedCodeDirs.has(group.cwd),
          group.sessions.map((s) => [s.sessionId, s.title, s.isRunning]),
        ]),
        activeId,
      ]);
      if (tree.dataset.signature === signature) return;
      tree.dataset.signature = signature;
      tree.replaceChildren();
      const baseName = (cwd: string) =>
        cwd.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? cwd;
      for (const group of ordered) {
        const collapsed = collapsedCodeDirs.has(group.cwd);
        const header = document.createElement("button");
        header.type = "button";
        header.setAttribute("aria-expanded", String(!collapsed));
        header.title = group.cwd;
        header.style.cssText =
          "display:flex;align-items:center;gap:6px;width:100%;padding:4px 8px;border:0;background:none;color:var(--cds-text-secondary,#8a8781);font:inherit;font-size:var(--df-row-font,13px);cursor:pointer;border-radius:8px;text-align:left;";
        header.innerHTML = `<span aria-hidden="true" style="width:10px;display:inline-flex;justify-content:center">${collapsed ? "▸" : "▾"}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">${""}</span><span style="margin-left:auto;font-size:11px;opacity:.7">${group.sessions.length}</span>`;
        (header.children[1] as HTMLElement).textContent = baseName(group.cwd);
        header.addEventListener("click", () => {
          if (collapsedCodeDirs.has(group.cwd))
            collapsedCodeDirs.delete(group.cwd);
          else collapsedCodeDirs.add(group.cwd);
          persistCollapsedCodeDirs();
          delete tree.dataset.signature;
          renderCodeSidebarGroups(tree);
        });
        tree.append(header);
        if (collapsed) continue;
        for (const session of group.sessions) {
          const row = document.createElement("button");
          row.type = "button";
          row.dataset.sessionId = session.sessionId;
          const active = session.sessionId === activeId;
          row.style.cssText = `display:flex;align-items:center;gap:7px;width:calc(100% - 16px);margin-left:16px;padding:4px 8px;border:0;background:${active ? "var(--cds-bg-300,rgba(110,104,94,.18))" : "none"};color:${active ? "var(--cds-text-primary,#292724)" : "var(--cds-text-secondary,#6b675f)"};font:inherit;font-size:var(--df-row-font,13px);cursor:pointer;border-radius:8px;text-align:left;`;
          const dot = document.createElement("span");
          dot.setAttribute("aria-hidden", "true");
          dot.style.cssText = `width:6px;height:6px;border-radius:50%;flex-shrink:0;background:${session.isRunning ? "#4caf50" : "var(--cds-border,rgba(110,104,94,.35))"};`;
          const label = document.createElement("span");
          label.style.cssText =
            "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
          label.textContent = session.title || "Untitled session";
          row.append(dot, label);
          row.addEventListener("mouseenter", () => {
            if (!active)
              row.style.background = "var(--cds-bg-200,rgba(110,104,94,.1))";
          });
          row.addEventListener("mouseleave", () => {
            if (!active) row.style.background = "none";
          });
          row.addEventListener("click", () => {
            history.pushState(
              history.state,
              "",
              `/epitaxy/${encodeURIComponent(session.sessionId)}`,
            );
            window.dispatchEvent(
              new PopStateEvent("popstate", { state: history.state }),
            );
          });
          tree.append(row);
        }
      }
      if (ordered.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText =
          "padding:4px 8px;color:var(--cds-text-secondary,#8a8781);font-size:12px;";
        empty.textContent = "No sessions yet";
        tree.append(empty);
      }
    };
    const wireCodeSidebarGroups = () => {
      const onCode = location.pathname.startsWith("/epitaxy");
      const existing = document.querySelector<HTMLElement>(
        '[data-testid="local-code-dir-groups"]',
      );
      const hiddenNative = document.querySelector<HTMLElement>(
        "[data-local-hidden-for-groups]",
      );
      if (!onCode) {
        existing?.remove();
        if (hiddenNative) {
          hiddenNative.style.display = "";
          delete hiddenNative.dataset.localHiddenForGroups;
        }
        return;
      }
      const recentsHeader = [
        ...document.querySelectorAll<HTMLElement>("button"),
      ].find(
        (button) =>
          button.getClientRects().length > 0 &&
          (button.textContent ?? "").replace(/[\uE000-\uF8FF]/gu, "").trim() ===
            "Recents",
      );
      if (!recentsHeader) return;
      let sectionRoot: HTMLElement | null = recentsHeader;
      while (
        sectionRoot &&
        !(sectionRoot.className ?? "").includes("group/section")
      )
        sectionRoot = sectionRoot.parentElement;
      if (!sectionRoot) return;
      // Hide the native flat rows; our grouped tree renders in their place.
      for (const child of [...sectionRoot.children]) {
        if (
          child instanceof HTMLElement &&
          !child.contains(recentsHeader) &&
          !child.dataset.testid?.includes("local-code-dir-groups")
        ) {
          child.dataset.localHiddenForGroups = "1";
          child.style.display = "none";
        }
      }
      let tree = sectionRoot.querySelector<HTMLElement>(
        '[data-testid="local-code-dir-groups"]',
      );
      if (!tree) {
        tree = document.createElement("div");
        tree.dataset.testid = "local-code-dir-groups";
        tree.style.cssText = "display:flex;flex-direction:column;gap:1px;";
        sectionRoot.append(tree);
      }
      if (Date.now() - codeSidebarFetchedAt > 3_000)
        void refreshCodeSidebarSessions().then(() => {
          const current = document.querySelector<HTMLElement>(
            '[data-testid="local-code-dir-groups"]',
          );
          if (current) renderCodeSidebarGroups(current);
        });
      renderCodeSidebarGroups(tree);
    };
    const wireLocalUi = () => {
      wireLocalNavigation();
      wireSidebarSettings();
      wireSidebarArtifacts();
      wireSettingsDialog();
      wireConfiguredModelLabels();
      wireInlineMermaidDiagrams();
      wireCodeArtifactRoute();
      wireCustomizeSkillSelection();
      wireDictationButton();
      wireSidebarProjects();
      wireSidebarScheduled();
      wireCapabilitiesNavigation();
      wireCustomizeMemoryEntry();
      wireMemorySaveRows();
      wireCodeSidebarGroups();
    };
    const observer = new MutationObserver(wireLocalUi);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    wireLocalUi();
    window.addEventListener("popstate", wireLocalUi);
    window.addEventListener("hashchange", () => {
      // Native Settings tabs are same-document hash routes. React may replace
      // the navigation subtree before its click reaches a node-level handler,
      // so restore the native pane from the stable location event as well.
      if (activeScroll && !host.hidden) restoreNativeSettings();
      wireLocalUi();
    });
    window.dispatchEvent(new CustomEvent("local-claude-ready"));
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
}
