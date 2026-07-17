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
        button[data-mode="cowork"], button[aria-label="Cowork"] { display: none !important; }
        [data-local-cloud-only="true"] { display: none !important; }
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
        .checks { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; }
        .checks label { display: flex; gap: 7px; align-items: center; cursor: pointer; }
        .checks input[type="checkbox"] { width: auto; accent-color: #d97757; }
        .checks input[type="date"] { flex: 1; min-width: 130px; }
        #export-status { min-height: 18px; margin: 0; text-align: right; color: var(--cds-text-secondary, #6b675f); font-size: 12px; white-space: pre-wrap; }
        .actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 9px; padding: 18px 0 8px; }
        .actions button { border: 1px solid var(--cds-border, rgba(110,104,94,.3)); border-radius: 9px; padding: 8px 12px; cursor: pointer; background: var(--cds-bg-200, rgba(110,104,94,.16)); color: inherit; }
        .actions .primary { background: #d97757; border-color: #d97757; color: #fff; }
        #status { min-height: 18px; margin: 0; text-align: right; color: var(--cds-text-secondary, #6b675f); font-size: 12px; white-space: pre-wrap; }
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
    let activeLocalPanel: "model" | "export" = "model";
    const showLocalPanel = (panel: "model" | "export") => {
      activeLocalPanel = panel;
      modelPanel.hidden = panel !== "model";
      exportPanel.hidden = panel !== "export";
    };
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
      panel: "model" | "export" = "model",
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
        if (!isModelTab && !isExportTab) {
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
          isExportTab ? "export" : "model",
        );
      },
      true,
    );

    const wiredButtons = new WeakSet<HTMLButtonElement>();
    const localArtifactsRoute = "/epitaxy/local-artifacts";
    const localCustomizeRoute = "/epitaxy/local-customize";
    let artifactHost: HTMLDivElement | null = null;
    let customizationHost: HTMLDivElement | null = null;

    const updateOverlayHostBounds = (overlay: HTMLElement | null) => {
      if (!overlay || overlay.hidden) return;
      const content = document.querySelector<HTMLElement>(
        ".dframe-content-inner",
      );
      const sidebar = document.querySelector<HTMLElement>(".dframe-sidebar");
      const frame = document.querySelector<HTMLElement>(".dframe-root");
      const left = frame?.hasAttribute("data-collapsed")
        ? 0
        : Math.max(
            content?.getBoundingClientRect().left ?? 0,
            sidebar?.getBoundingClientRect().right ?? 0,
          );
      overlay.style.left = `${Math.max(0, Math.round(left))}px`;
    };

    const updateLocalOverlayBounds = () => {
      updateOverlayHostBounds(artifactHost);
      updateOverlayHostBounds(customizationHost);
    };

    const createArtifactHost = () => {
      if (artifactHost) return artifactHost;
      artifactHost = document.createElement("div");
      artifactHost.id = "local-code-artifacts";
      artifactHost.hidden = true;
      artifactHost.style.cssText =
        "position:fixed;top:0;right:0;bottom:0;z-index:24;background:var(--cds-bg-000,#f7f6f2);color:var(--cds-text-primary,#292724);overflow:hidden";
      const artifactRoot = artifactHost.attachShadow({ mode: "open" });
      artifactRoot.innerHTML = `
        <style>
          :host { display:block; height:100%; font:14px/1.45 ui-sans-serif,system-ui,sans-serif; }
          * { box-sizing:border-box; }
          button { font:inherit; color:inherit; }
          .page { height:100%; display:flex; flex-direction:column; background:var(--cds-bg-000,#f7f6f2); }
          header { min-height:64px; display:flex; align-items:center; gap:12px; padding:12px 24px; border-bottom:1px solid var(--cds-border,rgba(110,104,94,.18)); }
          h1 { margin:0; font:600 24px/1.2 ui-serif,Georgia,serif; flex:1; }
          .muted { color:var(--cds-text-secondary,#6b675f); }
          .toolbar { display:flex; gap:8px; }
          button { border:1px solid var(--cds-border,rgba(110,104,94,.25)); border-radius:9px; padding:7px 11px; background:var(--cds-bg-100,#fff); cursor:pointer; }
          button:hover { background:var(--cds-fill-ghost-hover,rgba(110,104,94,.08)); }
          main { min-height:0; flex:1; display:grid; grid-template-columns:minmax(260px,380px) minmax(0,1fr); }
          #library { overflow:auto; padding:20px; border-right:1px solid var(--cds-border,rgba(110,104,94,.18)); }
          #count { margin:0 0 14px; font-size:12px; }
          #cards { display:grid; gap:10px; }
          .card { width:100%; text-align:left; padding:14px; display:grid; gap:6px; background:var(--cds-bg-100,#fff); }
          .card[data-active="true"] { border-color:#d97757; box-shadow:0 0 0 1px #d97757; }
          .title { font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .path { font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          #preview { min-width:0; display:flex; flex-direction:column; }
          #preview-head { min-height:57px; display:flex; align-items:center; gap:9px; padding:10px 16px; border-bottom:1px solid var(--cds-border,rgba(110,104,94,.18)); }
          #preview-title { flex:1; min-width:0; font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          #preview-body { flex:1; min-height:0; overflow:auto; background:#fff; color:#181817; }
          iframe { width:100%; height:100%; border:0; display:block; background:#fff; }
          pre { min-height:100%; margin:0; padding:24px; white-space:pre-wrap; overflow-wrap:anywhere; font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace; }
          .empty { min-height:260px; display:grid; place-items:center; text-align:center; padding:36px; color:var(--cds-text-secondary,#6b675f); }
          @media (max-width:760px) { main { grid-template-columns:1fr; } #preview { display:none; } }
        </style>
        <section class="page" aria-label="Local artifacts library">
          <header><h1>Artifacts</h1><span class="muted">Created locally by Chat and Code</span><div class="toolbar"><button id="refresh" type="button">Refresh</button><button id="back" type="button">Back to Code</button></div></header>
          <main><section id="library"><p id="count" class="muted">Loading…</p><div id="cards"></div></section><section id="preview"><div id="preview-head"><span id="preview-title">Select an artifact</span><button id="open" type="button" hidden>Open</button><button id="reveal" type="button" hidden>Show in folder</button></div><div id="preview-body"><div class="empty">Select an artifact to preview it here.</div></div></section></main>
        </section>`;
      let selected: CodeArtifactSummary | null = null;
      const cards = artifactRoot.querySelector<HTMLElement>("#cards")!;
      const count = artifactRoot.querySelector<HTMLElement>("#count")!;
      const previewTitle =
        artifactRoot.querySelector<HTMLElement>("#preview-title")!;
      const previewBody =
        artifactRoot.querySelector<HTMLElement>("#preview-body")!;
      const openButton =
        artifactRoot.querySelector<HTMLButtonElement>("#open")!;
      const revealButton =
        artifactRoot.querySelector<HTMLButtonElement>("#reveal")!;

      const preview = async (artifact: CodeArtifactSummary) => {
        selected = artifact;
        for (const card of cards.querySelectorAll<HTMLElement>(".card"))
          card.dataset.active = String(card.dataset.url === artifact.url);
        previewTitle.textContent = artifact.title;
        previewBody.innerHTML = '<div class="empty">Loading preview…</div>';
        openButton.hidden = false;
        revealButton.hidden = false;
        try {
          const contents = await getCodeArtifact(
            artifact.sessionId,
            artifact.url,
          );
          previewBody.replaceChildren();
          if (
            contents.type === "text/html" ||
            contents.type === "image/svg+xml"
          ) {
            const frame = document.createElement("iframe");
            frame.title = `${contents.title} preview`;
            frame.setAttribute(
              "sandbox",
              "allow-scripts allow-forms allow-modals",
            );
            frame.srcdoc = contents.content;
            previewBody.append(frame);
          } else {
            const pre = document.createElement("pre");
            pre.textContent = contents.content;
            previewBody.append(pre);
          }
        } catch (error) {
          previewBody.innerHTML = `<div class="empty"></div>`;
          previewBody.firstElementChild!.textContent =
            error instanceof Error ? error.message : String(error);
        }
      };

      const loadArtifacts = async () => {
        cards.replaceChildren();
        count.textContent = "Loading…";
        try {
          const artifacts = await getCodeArtifacts();
          count.textContent = `${artifacts.length} local artifact${artifacts.length === 1 ? "" : "s"}`;
          if (artifacts.length === 0) {
            cards.innerHTML =
              '<div class="empty">Artifacts published by the local Code tools will appear here.</div>';
            return;
          }
          for (const artifact of artifacts) {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "card";
            card.dataset.url = artifact.url;
            const title = document.createElement("span");
            title.className = "title";
            title.textContent = artifact.title;
            const session = document.createElement("span");
            session.className = "muted";
            session.textContent = artifact.sessionTitle;
            const artifactPath = document.createElement("span");
            artifactPath.className = "path muted";
            artifactPath.textContent = artifact.path;
            card.append(title, session, artifactPath);
            card.addEventListener("click", () => void preview(artifact));
            cards.append(card);
          }
          if (artifacts[0]) void preview(artifacts[0]);
        } catch (error) {
          count.textContent =
            error instanceof Error ? error.message : String(error);
        }
      };
      artifactRoot
        .querySelector<HTMLButtonElement>("#refresh")!
        .addEventListener("click", () => void loadArtifacts());
      artifactRoot
        .querySelector<HTMLButtonElement>("#back")!
        .addEventListener("click", () =>
          location.assign("app://localhost/epitaxy"),
        );
      openButton.addEventListener("click", () => {
        if (selected)
          void openCodeArtifact(selected.sessionId, selected.url, "open");
      });
      revealButton.addEventListener("click", () => {
        if (selected)
          void openCodeArtifact(selected.sessionId, selected.url, "reveal");
      });
      document.documentElement.append(artifactHost);
      artifactHost.addEventListener(
        "local-artifacts-refresh",
        () => void loadArtifacts(),
      );
      return artifactHost;
    };

    const createCustomizationHost = () => {
      if (customizationHost) return customizationHost;
      customizationHost = document.createElement("div");
      customizationHost.id = "local-code-customization";
      customizationHost.hidden = true;
      customizationHost.style.cssText =
        "position:fixed;top:0;right:0;bottom:0;z-index:24;background:var(--cds-bg-000,#f7f6f2);color:var(--cds-text-primary,#292724);overflow:hidden";
      const customizeRoot = customizationHost.attachShadow({ mode: "open" });
      customizeRoot.innerHTML = `
        <style>
          :host { display:block; height:100%; font:14px/1.45 ui-sans-serif,system-ui,sans-serif; }
          * { box-sizing:border-box; }
          button,input,select,textarea { font:inherit; color:inherit; }
          .page { height:100%; display:flex; flex-direction:column; background:var(--cds-bg-000,#f7f6f2); }
          header { display:flex; align-items:center; gap:12px; padding:14px 24px; border-bottom:1px solid var(--cds-border,rgba(110,104,94,.18)); }
          h1 { margin:0; font:600 24px/1.2 ui-serif,Georgia,serif; }
          .lede { flex:1; color:var(--cds-text-secondary,#6b675f); }
          button,input,select,textarea { border:1px solid var(--cds-border,rgba(110,104,94,.28)); border-radius:9px; background:var(--cds-bg-100,#fff); }
          button { padding:7px 11px; cursor:pointer; }
          button:hover { background:var(--cds-fill-ghost-hover,rgba(110,104,94,.08)); }
          button.primary { background:#d97757; border-color:#d97757; color:#fff; }
          button.danger { color:#b33a2b; }
          .folder { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:10px; padding:12px 24px; border-bottom:1px solid var(--cds-border,rgba(110,104,94,.18)); }
          .folder input { width:100%; padding:8px 10px; font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace; }
          .tabs { display:flex; gap:6px; padding:10px 24px 0; }
          .tabs button[data-active="true"] { background:var(--cds-fill-ghost-hover,rgba(110,104,94,.1)); border-color:#d97757; }
          main { min-height:0; flex:1; display:grid; grid-template-columns:280px minmax(0,1fr); padding:12px 24px 24px; gap:14px; }
          .panel { min-height:0; border:1px solid var(--cds-border,rgba(110,104,94,.2)); border-radius:12px; background:var(--cds-bg-100,#fff); overflow:hidden; }
          .list-head,.editor-head { min-height:52px; display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid var(--cds-border,rgba(110,104,94,.18)); }
          #entry-count,#editor-title { flex:1; min-width:0; color:var(--cds-text-secondary,#6b675f); }
          #entries { height:calc(100% - 52px); overflow:auto; padding:8px; display:grid; align-content:start; gap:5px; }
          .entry { width:100%; display:grid; gap:2px; text-align:left; padding:9px 10px; }
          .entry[data-active="true"] { border-color:#d97757; box-shadow:0 0 0 1px #d97757; }
          .entry span:first-child { font-weight:620; }
          .meta { font-size:11px; color:var(--cds-text-secondary,#6b675f); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .editor { height:100%; display:flex; flex-direction:column; }
          .fields { padding:12px; display:grid; grid-template-columns:minmax(0,1fr) 150px; gap:10px; }
          .fields label { display:grid; gap:5px; font-size:12px; font-weight:600; }
          .fields input,.fields select { min-width:0; padding:8px 10px; }
          textarea { min-height:0; flex:1; margin:0 12px 12px; padding:14px; resize:none; outline:none; font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace; tab-size:2; }
          textarea:focus,input:focus,select:focus { border-color:#d97757; box-shadow:0 0 0 2px color-mix(in srgb,#d97757 22%,transparent); outline:none; }
          #status { min-height:20px; margin:0; padding:0 24px 8px; color:var(--cds-text-secondary,#6b675f); font-size:12px; }
          @media (max-width:760px) { main { grid-template-columns:1fr; } .panel:first-child { max-height:220px; } }
        </style>
        <section class="page" aria-label="Local customization">
          <header><h1>Customize</h1><span class="lede">Local skills, commands, and agents used by any configured model</span><button id="back" type="button">Back to Code</button></header>
          <div class="folder"><strong>Workspace</strong><input id="cwd" type="text" spellcheck="false" placeholder="Select a folder"><button id="browse" type="button">Select folder</button></div>
          <nav class="tabs" aria-label="Customization type"><button type="button" data-kind="skill" data-active="true">Skills</button><button type="button" data-kind="command">Commands</button><button type="button" data-kind="agent">Agents</button></nav>
          <main><section class="panel"><div class="list-head"><span id="entry-count">Select a workspace</span><button id="new" type="button">New</button></div><div id="entries"></div></section><section class="panel editor"><div class="editor-head"><span id="editor-title">New skill</span><button id="delete" class="danger" type="button" hidden>Delete</button><button id="save" class="primary" type="button">Save</button></div><div class="fields"><label>Name<input id="name" type="text" maxlength="64" spellcheck="false"></label><label>Scope<select id="scope"><option value="workspace">This workspace</option><option value="user">All workspaces</option></select></label></div><textarea id="content" spellcheck="false" aria-label="Customization content"></textarea></section></main><p id="status" role="status"></p>
        </section>`;

      const cwdInput = customizeRoot.querySelector<HTMLInputElement>("#cwd")!;
      const entries = customizeRoot.querySelector<HTMLElement>("#entries")!;
      const entryCount =
        customizeRoot.querySelector<HTMLElement>("#entry-count")!;
      const editorTitle =
        customizeRoot.querySelector<HTMLElement>("#editor-title")!;
      const nameInput = customizeRoot.querySelector<HTMLInputElement>("#name")!;
      const scopeInput =
        customizeRoot.querySelector<HTMLSelectElement>("#scope")!;
      const contentInput =
        customizeRoot.querySelector<HTMLTextAreaElement>("#content")!;
      const status = customizeRoot.querySelector<HTMLElement>("#status")!;
      const deleteButton =
        customizeRoot.querySelector<HTMLButtonElement>("#delete")!;
      let kind: CustomizationKind = "skill";
      let allEntries: CustomizationEntry[] = [];
      let selected: CustomizationEntry | null = null;

      const template = (value: CustomizationKind, name = "new-item") => {
        if (value === "skill")
          return `---\nname: ${name}\ndescription: Explain when this skill should be used.\n---\n\n# ${name}\n\nDescribe the reliable workflow for this skill.\n`;
        if (value === "agent")
          return `---\nname: ${name}\ndescription: Explain this agent's specialty.\n---\n\nYou are a focused ${name} agent. Describe the role, constraints, and output contract here.\n`;
        return `# ${name}\n\nDescribe the command workflow and expected output here.\n`;
      };

      const renderEntries = () => {
        entries.replaceChildren();
        const visible = allEntries.filter((entry) => entry.kind === kind);
        entryCount.textContent = `${visible.length} ${kind}${visible.length === 1 ? "" : "s"}`;
        for (const entry of visible) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "entry";
          button.dataset.active = String(
            selected?.kind === entry.kind &&
              selected.name === entry.name &&
              selected.scope === entry.scope,
          );
          const title = document.createElement("span");
          title.textContent = entry.name;
          const meta = document.createElement("span");
          meta.className = "meta";
          meta.textContent = `${entry.scope} · ${entry.path}`;
          button.append(title, meta);
          button.addEventListener("click", () => {
            selected = entry;
            nameInput.value = entry.name;
            scopeInput.value = entry.scope;
            contentInput.value = entry.content;
            editorTitle.textContent = `Edit ${entry.kind}`;
            deleteButton.hidden = false;
            renderEntries();
          });
          entries.append(button);
        }
      };

      const createNew = () => {
        selected = null;
        nameInput.value = "";
        scopeInput.value = "workspace";
        contentInput.value = template(kind);
        editorTitle.textContent = `New ${kind}`;
        deleteButton.hidden = true;
        renderEntries();
        nameInput.focus();
      };

      const load = async () => {
        const cwd = cwdInput.value.trim();
        if (!cwd) {
          allEntries = [];
          entryCount.textContent = "Select a workspace";
          entries.replaceChildren();
          return;
        }
        status.textContent = "Loading local customization…";
        try {
          const result = await getCustomization(cwd);
          cwdInput.value = result.cwd;
          localStorage.setItem("claude-local-customize-cwd", result.cwd);
          allEntries = result.entries;
          status.textContent = "";
          renderEntries();
        } catch (error) {
          status.textContent =
            error instanceof Error ? error.message : String(error);
        }
      };

      for (const tab of customizeRoot.querySelectorAll<HTMLButtonElement>(
        ".tabs button[data-kind]",
      )) {
        tab.addEventListener("click", () => {
          kind = tab.dataset.kind as CustomizationKind;
          for (const candidate of customizeRoot.querySelectorAll<HTMLElement>(
            ".tabs button[data-kind]",
          ))
            candidate.dataset.active = String(candidate === tab);
          createNew();
        });
      }
      customizeRoot
        .querySelector<HTMLButtonElement>("#back")!
        .addEventListener("click", () =>
          location.assign("app://localhost/epitaxy"),
        );
      customizeRoot
        .querySelector<HTMLButtonElement>("#browse")!
        .addEventListener("click", async () => {
          const selectedDirectory = await pickDirectory();
          if (!selectedDirectory) return;
          cwdInput.value = selectedDirectory;
          await load();
        });
      cwdInput.addEventListener("change", () => void load());
      customizeRoot
        .querySelector<HTMLButtonElement>("#new")!
        .addEventListener("click", createNew);
      customizeRoot
        .querySelector<HTMLButtonElement>("#save")!
        .addEventListener("click", async () => {
          status.textContent = "Saving…";
          try {
            await saveCustomization({
              cwd: cwdInput.value.trim(),
              kind,
              scope: scopeInput.value as CustomizationScope,
              name: nameInput.value.trim(),
              content: contentInput.value,
            });
            status.textContent = "Saved locally.";
            await load();
          } catch (error) {
            status.textContent =
              error instanceof Error ? error.message : String(error);
          }
        });
      deleteButton.addEventListener("click", async () => {
        if (!selected) return;
        status.textContent = "Deleting…";
        try {
          await deleteCustomization({
            cwd: cwdInput.value.trim(),
            kind: selected.kind,
            scope: selected.scope,
            name: selected.name,
          });
          createNew();
          await load();
          status.textContent = "Deleted.";
        } catch (error) {
          status.textContent =
            error instanceof Error ? error.message : String(error);
        }
      });
      customizationHost.addEventListener("local-customization-refresh", () => {
        cwdInput.value =
          localStorage.getItem("claude-local-customize-cwd") ?? cwdInput.value;
        void load();
      });
      document.documentElement.append(customizationHost);
      createNew();
      return customizationHost;
    };

    const showLocalOverlaysForRoute = () => {
      const isArtifacts = location.pathname === localArtifactsRoute;
      const artifacts = createArtifactHost();
      if (artifacts.hidden === isArtifacts) {
        artifacts.hidden = !isArtifacts;
        if (isArtifacts)
          artifacts.dispatchEvent(new CustomEvent("local-artifacts-refresh"));
      }
      const isCustomize = location.pathname === localCustomizeRoute;
      const customization = createCustomizationHost();
      if (customization.hidden === isCustomize) {
        customization.hidden = !isCustomize;
        if (isCustomize)
          customization.dispatchEvent(
            new CustomEvent("local-customization-refresh"),
          );
      }
      updateLocalOverlayBounds();
    };

    const wireLocalNavigation = () => {
      if (/cowork/i.test(location.pathname + location.search)) {
        location.replace("app://localhost/new?mode=chat&surface=chat");
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

      if (
        /^\/customize\/(connectors|plugins)(?:\/|$)/.test(location.pathname)
      ) {
        location.replace("app://localhost/customize/skills");
        return;
      }
      if (location.pathname.startsWith("/customize")) {
        const cloudOnlyLabels = new Set([
          "Connectors",
          "Personal plugins",
          "Browse plugins",
          "Connect your apps",
        ]);
        for (const candidate of document.querySelectorAll<HTMLElement>(
          "a,button,div,span",
        )) {
          const label =
            candidate.getAttribute("aria-label")?.trim() ??
            candidate.getAttribute("title")?.trim() ??
            candidate.textContent?.trim() ??
            "";
          if (!cloudOnlyLabels.has(label)) continue;
          const control = candidate.closest<HTMLElement>("a,button");
          (control ?? candidate).dataset.localCloudOnly = "true";
        }
      }

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
      const secureWorkspaceMessage = [
        ...document.querySelectorAll<HTMLElement>("div,p,span"),
      ].find((candidate) =>
        candidate.textContent?.includes(
          "A Windows feature needs to be enabled to give Claude a secure workspace.",
        ),
      );
      if (secureWorkspaceMessage) {
        const cloudToast =
          secureWorkspaceMessage.closest<HTMLElement>(
            '[role="alert"],[role="status"]',
          ) ?? secureWorkspaceMessage.parentElement;
        if (cloudToast) cloudToast.dataset.localCloudOnly = "true";
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

    // The Customize landing lists only its native sections; add a Memory row
    // that opens the (fully wired) /customize/memory page.
    const wireCustomizeMemoryEntry = () => {
      if (!location.pathname.startsWith("/customize")) {
        document
          .querySelector('[data-testid="local-customize-memory-row"]')
          ?.remove();
        return;
      }
      if (document.querySelector('[data-testid="local-customize-memory-row"]'))
        return;
      const skillsRow = [
        ...document.querySelectorAll<HTMLElement>("a,button,[role=button]"),
      ].find(
        (row) =>
          row.getClientRects().length > 0 &&
          (row.textContent ?? "").trim() === "Skills",
      );
      if (!skillsRow?.parentElement) return;
      const row = skillsRow.cloneNode(true) as HTMLElement;
      row.dataset.testid = "local-customize-memory-row";
      row.removeAttribute("id");
      for (const element of [row, ...row.querySelectorAll("*")])
        if (
          element.childElementCount === 0 &&
          (element.textContent ?? "").trim() === "Skills"
        )
          element.textContent = "Memory";
      row.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        history.pushState(history.state, "", "/customize/memory");
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: history.state }),
        );
      });
      skillsRow.parentElement.insertBefore(row, skillsRow.nextSibling);
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
        const cloudOnlySettings = new Set(["Privacy", "Connectors", "Cowork"]);
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
    // Local batch dictation: a mic button beside the composer records with
    // MediaRecorder and transcribes through the provider's OpenAI-compatible
    // /audio/transcriptions endpoint when the recording stops.
    let dictationRecorder: MediaRecorder | null = null;
    let dictationChunks: Blob[] = [];
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
    const stopDictation = async (button: HTMLButtonElement) => {
      const recorder = dictationRecorder;
      dictationRecorder = null;
      if (!recorder) return;
      button.dataset.state = "busy";
      button.style.color = "";
      const finished = new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
      });
      recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
      await finished;
      try {
        const recorded = new Blob(dictationChunks, {
          type: recorder.mimeType || "audio/webm",
        });
        dictationChunks = [];
        if (recorded.size === 0) return;
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
        if (payload.text?.trim()) dictationInsert(payload.text.trim());
      } catch (error) {
        button.title =
          error instanceof Error ? error.message : "Transcription failed";
      } finally {
        delete button.dataset.state;
      }
    };
    const startDictation = async (button: HTMLButtonElement) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        dictationChunks = [];
        const recorder = new MediaRecorder(stream);
        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) dictationChunks.push(event.data);
        });
        recorder.start();
        dictationRecorder = recorder;
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
      wireCustomizeMemoryEntry();
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
    window.addEventListener("resize", updateLocalOverlayBounds);
    window.dispatchEvent(new CustomEvent("local-claude-ready"));
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
}
