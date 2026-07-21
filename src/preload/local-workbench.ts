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

export interface LocalWorkbenchServices {
  // LocalSessions.start, resolved in the preload world where the claude.web
  // namespace lives (the workbench runs isolated from the page's window).
  startLocalSession?: (
    input: unknown,
  ) => Promise<{ sessionId?: string } | null | undefined>;
  // FileSystem.browseFolder — opens the native folder picker and grants the
  // chosen root, returning its path.
  pickFolder?: () => Promise<string | null | undefined>;
  scheduledTasks?: {
    getAllScheduledTasks: () => Promise<unknown>;
    createScheduledTask: (input: unknown) => Promise<unknown>;
    updateScheduledTaskStatus: (
      scheduledTaskId: string,
      status: string,
    ) => Promise<unknown>;
  };
  localSkills?: {
    listLocalSkills: () => Promise<unknown>;
    saveLocalSkill: (
      name: string,
      description: string,
      content: string,
      overwrite: boolean,
    ) => Promise<unknown>;
    setLocalSkillEnabled: (name: string, enabled: boolean) => Promise<unknown>;
  };
  localPlugins?: {
    getPlugins: () => Promise<unknown>;
    installCatalogPlugin: (catalogId: string) => Promise<unknown>;
  };
  connectorOAuth?: {
    listPresets: () => Promise<unknown>;
    start: (input: unknown) => Promise<unknown>;
    openSetup: (preset: string) => Promise<unknown>;
    openDocs: (preset: string) => Promise<unknown>;
    cancel: (uuid: string) => Promise<unknown>;
    disconnect: (uuid: string) => Promise<unknown>;
  };
  listConfiguredMcpServers?: () => Promise<unknown>;
}

export function removedProductRouteRedirect(pathname: string): string | null {
  if (pathname === "/settings/cowork") return "/settings/claude-code";
  const session = pathname.match(/^\/(?:cowork|task)\/([^/]+)$/);
  if (session && session[1] !== "new") {
    try {
      return `/epitaxy/${encodeURIComponent(decodeURIComponent(session[1]))}`;
    } catch {
      return "/new";
    }
  }
  if (
    pathname === "/cowork" ||
    pathname === "/cowork/new" ||
    pathname === "/task" ||
    pathname === "/task/new" ||
    pathname.startsWith("/task/")
  )
    return "/new";
  return null;
}

export function installLocalWorkbench(
  services: LocalWorkbenchServices = {},
): void {
  const install = () => {
    if (!document.getElementById("local-claude-chrome-style")) {
      const style = document.createElement("style");
      style.id = "local-claude-chrome-style";
      style.textContent = `
        /* The retained client requires an internal identity object to build
           conversation queries, but local mode has no user account. */
        [data-testid="user-menu-button"] { display: none !important; }
        /* Keep the removed native task mode out of the Home | Code switcher. */
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
        #panel, #memory-panel, #export-panel { width: 100%; padding: 0 24px 32px; }
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
        .memory-head { display:flex;align-items:center;justify-content:flex-end;gap:12px;padding:6px 0 20px; }
        .memory-head > span { display:flex;align-items:center;gap:8px; }
        .memory-head h1 { padding:0; }
        .memory-switch-row { display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:center;padding:15px 4px;border-bottom:1px solid var(--cds-border,rgba(110,104,94,.18)); }
        .memory-switch-row .label { display:block; }
        .memory-switch-row .hint { display:block;margin-top:3px;font-size:14px; }
        .memory-button { border:0;border-radius:9px;padding:9px 14px;background:var(--cds-bg-300,rgba(110,104,94,.22));color:inherit;font-weight:600;cursor:pointer; }
        .memory-button:hover { background:var(--cds-bg-400,rgba(110,104,94,.3)); }
        .memory-delete { margin-left:auto; }
        .memory-topics-title { margin:22px 4px 6px;font-weight:650; }
        #memory-topics { display:grid; }
        .memory-topic { width:100%;display:grid;grid-template-columns:210px minmax(0,1fr) 180px;gap:18px;align-items:center;text-align:left;border:0;border-bottom:1px solid var(--cds-border,rgba(110,104,94,.18));padding:13px 4px;background:transparent;color:inherit;cursor:pointer; }
        .memory-topic:hover { background:var(--cds-fill-ghost-hover,rgba(110,104,94,.08)); }
        .memory-topic-name { font-weight:650; }
        .memory-topic-summary,.memory-topic-updated { color:var(--cds-text-secondary,#8a8781);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .memory-empty { color:var(--cds-text-secondary,#8a8781);padding:24px 4px; }
        .memory-composer { position:sticky;bottom:0;display:flex;gap:8px;align-items:center;margin-top:28px;padding:8px;border:1px solid var(--cds-border,rgba(110,104,94,.25));border-radius:999px;background:var(--cds-bg-100,#f7f6f2);box-shadow:0 -12px 30px var(--cds-bg-100,#f7f6f2); }
        .memory-composer input { flex:1;border-radius:999px;background:transparent;box-shadow:none!important; }
        .memory-send { width:34px;height:34px;border:0;border-radius:50%;background:var(--cds-bg-300,rgba(110,104,94,.28));color:inherit;cursor:pointer;font-size:18px; }
        .memory-send:disabled { opacity:.45;cursor:default; }
        .memory-detail-title { margin:6px 0 30px;font-size:20px;font-weight:650; }
        .memory-detail-label { margin:0 0 8px;font-weight:650; }
        .memory-detail-summary { margin:0 0 26px; }
        #memory-detail-list { margin:0;padding-left:26px;line-height:1.8; }
        .memory-back { border:0;background:transparent;color:inherit;font-weight:650;cursor:pointer;padding:0; }
        @media (prefers-color-scheme:dark) { .memory-composer { background:var(--cds-bg-100,#2f2e2b);box-shadow:0 -12px 30px var(--cds-bg-100,#2f2e2b); } }
        @media (max-width:720px) { .memory-topic { grid-template-columns:1fr;gap:3px; }.memory-topic-updated { display:none; } }
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
        <div id="memory-list-view">
          <div class="memory-head"><span><button id="memory-regenerate" class="memory-button" type="button">Refresh memory</button></span></div>
          <div class="memory-switch-row"><span class="copy"><span class="label">Search and reference chats</span><span class="hint">Allow Claude to search for relevant details in past chats.</span></span><span class="checks"><input id="memory-search" type="checkbox" aria-label="Search and reference chats"></span></div>
          <div class="memory-switch-row"><span class="copy"><span class="label">Generate memory from chats</span><span class="hint">Allow Claude to generate memory from your chats. Incognito chats are never used.</span></span><span class="checks"><input id="memory-auto" type="checkbox" aria-label="Generate memory from chats"></span></div>
          <div class="memory-switch-row"><span class="copy"><span class="label">Import memory from other AI providers</span><span class="hint">Bring relevant context and data from another AI provider to Claude.</span></span><button id="memory-import" class="memory-button" type="button">Start import</button></div>
          <div class="memory-topics-title">Topics</div>
          <div id="memory-topics" aria-live="polite"></div>
        </div>
        <div id="memory-detail-view" hidden>
          <div class="memory-head"><button id="memory-back" class="memory-back" type="button">&larr; Memory</button><span><button id="memory-delete-topic" class="memory-button memory-delete" type="button">Delete</button></span></div>
          <div id="memory-detail-title" class="memory-detail-title"></div>
          <div class="memory-detail-label">Summary</div><p id="memory-detail-summary" class="memory-detail-summary"></p>
          <div class="memory-detail-label">Details</div><ul id="memory-detail-list"></ul>
        </div>
        <form id="memory-control-form" class="memory-composer"><input id="memory-control" type="text" autocomplete="off" placeholder="Tell Claude what to remember"><button id="memory-control-submit" class="memory-send" type="submit" aria-label="Save memory instruction">&uarr;</button></form>
        <p id="memory-status" role="status"></p>
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
    const memoryListView = element<HTMLElement>("#memory-list-view");
    const memoryDetailView = element<HTMLElement>("#memory-detail-view");
    const memoryTopics = element<HTMLElement>("#memory-topics");
    const memorySearch = element<HTMLInputElement>("#memory-search");
    const memoryAuto = element<HTMLInputElement>("#memory-auto");
    const memoryControl = element<HTMLInputElement>("#memory-control");
    const memoryControlSubmit = element<HTMLButtonElement>(
      "#memory-control-submit",
    );
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
    type MemoryPayload = {
      memory?: string;
      controls?: string[] | null;
      updated_at?: string | null;
      error?: { message?: string };
    };
    type MemoryTopic = { name: string; details: string[] };
    let currentMemory: MemoryPayload = {};
    let currentMemoryTopics: MemoryTopic[] = [];
    let activeMemoryTopic: string | null = null;
    const parseMemoryTopics = (memory: string): MemoryTopic[] => {
      const topics = new Map<string, string[]>();
      let section = "Profile";
      const add = (name: string, detail: string) => {
        const cleaned = detail.replace(/^[-*]\s+/, "").trim();
        if (!cleaned) return;
        const key = name.trim() || "General";
        const values = topics.get(key) ?? [];
        if (!values.includes(cleaned)) values.push(cleaned);
        topics.set(key, values);
      };
      for (const rawLine of memory.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const tagged = line.match(/^[-*]\s*\[([^\]]+)\]\s*(.+)$/);
        if (tagged) {
          add(tagged[1], tagged[2]);
          continue;
        }
        const heading = line.match(/^#{1,6}\s+(.+)$/);
        if (heading) {
          section = heading[1].replace(/[:.]$/, "").trim() || "Profile";
          continue;
        }
        const boldHeading = line.match(/^\*\*([^*]+)\*\*:?[\s]*$/);
        if (boldHeading) {
          section = boldHeading[1].replace(/[:.]$/, "").trim() || "Profile";
          continue;
        }
        add(section, line);
      }
      return [...topics.entries()].map(([name, details]) => ({
        name,
        details,
      }));
    };
    const memoryUpdatedLabel = (value: string | null | undefined) => {
      if (!value) return "";
      const elapsed = Math.max(0, Date.now() - Date.parse(value));
      const minutes = Math.floor(elapsed / 60_000);
      if (minutes < 1) return "Updated just now";
      if (minutes < 60) return `Updated ${minutes} min ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24)
        return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
      const days = Math.floor(hours / 24);
      return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
    };
    const showMemoryList = () => {
      activeMemoryTopic = null;
      memoryListView.hidden = false;
      memoryDetailView.hidden = true;
      memoryControl.placeholder =
        currentMemory.controls?.[0] || "Tell Claude what to remember";
    };
    const showMemoryDetail = (topicName: string) => {
      const topic = currentMemoryTopics.find(({ name }) => name === topicName);
      if (!topic) return;
      activeMemoryTopic = topic.name;
      memoryListView.hidden = true;
      memoryDetailView.hidden = false;
      element("#memory-detail-title").textContent = topic.name;
      element("#memory-detail-summary").textContent =
        topic.details[0] || `Things Claude remembers about ${topic.name}.`;
      const list = element<HTMLUListElement>("#memory-detail-list");
      list.replaceChildren();
      for (const detail of topic.details) {
        const item = document.createElement("li");
        item.textContent = detail;
        list.append(item);
      }
      memoryControl.placeholder = "Tell Claude what to change or remove";
    };
    const renderMemoryTopics = () => {
      currentMemoryTopics = parseMemoryTopics(currentMemory.memory ?? "");
      memoryTopics.replaceChildren();
      if (currentMemoryTopics.length === 0) {
        const empty = document.createElement("div");
        empty.className = "memory-empty";
        empty.textContent =
          "No memory topics yet. Claude can build them as you chat, or you can import existing context.";
        memoryTopics.append(empty);
        return;
      }
      for (const topic of currentMemoryTopics) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "memory-topic";
        const summary = topic.details.join(" · ");
        button.innerHTML = `<span class="memory-topic-name"></span><span class="memory-topic-summary"></span><span class="memory-topic-updated"></span>`;
        button.querySelector<HTMLElement>(".memory-topic-name")!.textContent =
          topic.name;
        button.querySelector<HTMLElement>(
          ".memory-topic-summary",
        )!.textContent = summary;
        button.querySelector<HTMLElement>(
          ".memory-topic-updated",
        )!.textContent = memoryUpdatedLabel(currentMemory.updated_at);
        button.addEventListener("click", () => showMemoryDetail(topic.name));
        memoryTopics.append(button);
      }
    };
    const loadMemoryPage = async () => {
      try {
        const [settings, payload] = await Promise.all([
          fetch("/api/organizations/local/memory/settings").then((response) =>
            response.json(),
          ) as Promise<{
            enabled_saffron?: unknown;
            enabled_saffron_search?: unknown;
          }>,
          fetch("/api/organizations/local/memory").then((response) =>
            response.json(),
          ) as Promise<MemoryPayload>,
        ]);
        currentMemory = payload;
        memoryAuto.checked = settings.enabled_saffron !== false;
        memorySearch.checked = settings.enabled_saffron_search !== false;
        memoryStatus.textContent = "";
        renderMemoryTopics();
        showMemoryList();
      } catch (error) {
        memoryStatus.textContent =
          error instanceof Error ? error.message : String(error);
      }
    };
    const updateMemorySetting = async (key: string, value: boolean) => {
      const response = await fetch("/api/organizations/local/memory/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) throw new Error("Could not update memory settings.");
    };
    memorySearch.addEventListener("change", async () => {
      try {
        await updateMemorySetting(
          "enabled_saffron_search",
          memorySearch.checked,
        );
        memoryStatus.textContent = memorySearch.checked
          ? "Past-chat search is on."
          : "Past-chat search is off.";
      } catch (error) {
        memorySearch.checked = !memorySearch.checked;
        memoryStatus.textContent =
          error instanceof Error ? error.message : String(error);
      }
    });
    memoryAuto.addEventListener("change", async () => {
      try {
        await updateMemorySetting("enabled_saffron", memoryAuto.checked);
        memoryStatus.textContent = memoryAuto.checked
          ? "Auto-generated memories are on."
          : "Auto-generated memories are off. Existing memory stays until you reset it.";
      } catch (error) {
        memoryAuto.checked = !memoryAuto.checked;
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
        currentMemory = payload;
        renderMemoryTopics();
        showMemoryList();
        memoryStatus.textContent = payload.memory?.trim()
          ? "Memory regenerated."
          : "Nothing to summarize yet — have a few chats first.";
      } catch (error) {
        memoryStatus.textContent =
          error instanceof Error ? error.message : String(error);
      }
    });
    element("#memory-import").addEventListener("click", async () => {
      const imported = prompt(
        "Paste the memory or profile you exported from another AI provider:",
      )?.trim();
      if (!imported) return;
      try {
        const next = currentMemory.memory?.trim()
          ? `${currentMemory.memory.trim()}\n- [Imported] ${imported.replace(/\s*\n+\s*/g, " ")}`
          : `- [Imported] ${imported.replace(/\s*\n+\s*/g, " ")}`;
        const response = await fetch("/api/organizations/local/memory", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memory: next }),
        });
        currentMemory = (await response.json()) as MemoryPayload;
        renderMemoryTopics();
        memoryStatus.textContent = "Imported memory saved locally.";
      } catch (error) {
        memoryStatus.textContent =
          error instanceof Error ? error.message : String(error);
      }
    });
    element("#memory-back").addEventListener("click", showMemoryList);
    element("#memory-delete-topic").addEventListener("click", async () => {
      if (!activeMemoryTopic) return;
      if (!confirm(`Delete the ${activeMemoryTopic} memory topic?`)) return;
      try {
        const remaining = currentMemoryTopics.filter(
          ({ name }) => name !== activeMemoryTopic,
        );
        const memory = remaining
          .flatMap(({ name, details }) =>
            details.map((detail) => `- [${name}] ${detail}`),
          )
          .join("\n");
        const response = await fetch("/api/organizations/local/memory", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memory }),
        });
        currentMemory = (await response.json()) as MemoryPayload;
        renderMemoryTopics();
        showMemoryList();
        memoryStatus.textContent = "Memory topic deleted.";
      } catch (error) {
        memoryStatus.textContent =
          error instanceof Error ? error.message : String(error);
      }
    });
    element<HTMLFormElement>("#memory-control-form").addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        const instruction = memoryControl.value.trim();
        if (!instruction) return;
        memoryControlSubmit.disabled = true;
        try {
          const controls = [
            ...(currentMemory.controls ?? []),
            activeMemoryTopic
              ? `${activeMemoryTopic}: ${instruction}`
              : instruction,
          ];
          const response = await fetch(
            "/api/organizations/local/memory/controls",
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ controls }),
            },
          );
          currentMemory = (await response.json()) as MemoryPayload;
          memoryControl.value = "";
          memoryStatus.textContent =
            "Memory instruction saved. It will be applied during the next refresh.";
        } catch (error) {
          memoryStatus.textContent =
            error instanceof Error ? error.message : String(error);
        } finally {
          memoryControlSubmit.disabled = false;
        }
      },
    );
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
    let memoryChromeTitle: { element: HTMLElement; text: string } | null = null;
    const memoryChromeHidden: Array<{
      element: HTMLElement;
      value: string;
      priority: string;
    }> = [];

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
      if (memoryChromeTitle) {
        memoryChromeTitle.element.textContent = memoryChromeTitle.text;
        memoryChromeTitle = null;
      }
      for (const { element, value, priority } of memoryChromeHidden.splice(0))
        if (value) element.style.setProperty("display", value, priority);
        else element.style.removeProperty("display");
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

    const prepareMemoryChrome = (navigation: HTMLElement) => {
      const contentPane = navigation.nextElementSibling;
      if (!(contentPane instanceof HTMLElement)) return;
      const labels = new Set([
        "Skills",
        "Connectors",
        "Plugins",
        "Memory",
        "General",
      ]);
      const title = [
        ...contentPane.querySelectorAll<HTMLElement>("h1,h2,h3,div,span"),
      ].find(
        (candidate) =>
          candidate.childElementCount === 0 &&
          labels.has((candidate.textContent ?? "").trim()) &&
          candidate.getClientRects().length > 0,
      );
      if (title && (title.textContent ?? "").trim() !== "Memory") {
        memoryChromeTitle = {
          element: title,
          text: title.textContent ?? "",
        };
        title.textContent = "Memory";
      }
      for (const control of contentPane.querySelectorAll<HTMLElement>(
        "button",
      )) {
        const text = (control.textContent ?? "").trim();
        const label = control.getAttribute("aria-label") ?? "";
        if (text !== "Add" && text !== "Browse" && !/^search/i.test(label))
          continue;
        memoryChromeHidden.push({
          element: control,
          value: control.style.getPropertyValue("display"),
          priority: control.style.getPropertyPriority("display"),
        });
        control.style.setProperty("display", "none", "important");
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
      if (panel === "memory") prepareMemoryChrome(navigationRoot);
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
        void loadMemoryPage();
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
        const interactive = target.closest<HTMLElement>(
          "button, a, [role=button]",
        );
        const navigation = interactive?.closest<HTMLElement>(
          'nav[aria-label="Settings"]',
        );
        if (!interactive || !navigation) return;
        // Native 1.22 uses links for some Customize sections and buttons for
        // the Desktop sections. Treat both as navigation controls so the
        // local Memory pane cannot fall through to the older summary page.
        const button = interactive as HTMLButtonElement;
        const isModelTab = Boolean(
          button.closest("[data-local-model-settings]"),
        );
        const isExportTab = Boolean(
          button.closest("[data-local-export-settings]"),
        );
        const isMemoryTab =
          Boolean(button.closest("[data-local-memory-settings]")) ||
          (
            button.querySelector<HTMLElement>(".truncate")?.textContent ??
            button.textContent ??
            ""
          ).trim() === "Memory";
        if (isMemoryTab && !button.closest("[data-local-memory-settings]")) {
          // Let the retained router establish the 1.22 Memory chrome and hash;
          // the hashchange/mutation route hook replaces only its cloud-backed
          // body with the local topic-aware implementation.
          if (activeScroll && !host.hidden) restoreNativeSettings();
          return;
        }
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
      // All routines now live on the normal local Code surface.
      if (
        location.pathname === "/scheduled" ||
        location.pathname === "/scheduled-task"
      ) {
        history.replaceState(history.state, "", "/epitaxy/scheduled");
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: history.state }),
        );
        return;
      }
      const removedRoute = removedProductRouteRedirect(location.pathname);
      if (removedRoute) {
        history.replaceState(history.state, "", removedRoute);
        window.dispatchEvent(
          new PopStateEvent("popstate", { state: history.state }),
        );
        return;
      }
      // Every settings surface lives in the modal: the fullscreen
      // /customize/* and /settings/* pages are retired. Navigating to either
      // bounces to /new and opens the dialog at the matching section (the
      // dialog's own section switching never changes the pathname, so this
      // cannot loop).
      const settingsLabelForSection = (section: string): string | null => {
        const customize: Record<string, string> = {
          skills: "Skills",
          connectors: "Connectors",
          plugins: "Plugins",
          memory: "Memory",
        };
        const settings: Record<string, string> = {
          general: "General",
          capabilities: "Capabilities",
          "claude-code": "Claude Code",
          model: "Model",
          "data-export": "Data export",
          extensions: "Extensions",
          developer: "Developer",
        };
        return customize[section] ?? settings[section] ?? null;
      };
      const isCustomize =
        location.pathname === "/customize" ||
        location.pathname.startsWith("/customize/");
      const isFullscreenSettings =
        location.pathname === "/settings" ||
        location.pathname.startsWith("/settings/");
      if (isCustomize || isFullscreenSettings) {
        const rawSection =
          location.pathname.split("/")[2] ?? (isCustomize ? "skills" : "");
        const label =
          settingsLabelForSection(rawSection) ??
          (isCustomize ? "Skills" : null);
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
            if (!label) return;
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
      const removedMode = pills?.querySelector<HTMLButtonElement>(
        'button[data-mode="cowork"]',
      );
      if (pills && chat && code) {
        pills.dataset.pills = "2";
        pills.dataset.localModes = "true";
        if (removedMode) removedMode.dataset.localCloudOnly = "true";
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
          const limit = (secureWorkspaceMessage.textContent?.length ?? 0) + 60;
          while (
            cloudNotice.parentElement &&
            cloudNotice.parentElement !== document.body &&
            (cloudNotice.parentElement.textContent?.length ?? Infinity) <= limit
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

    // Capabilities is now a native settings-nav entry (see the
    // add-capabilities-settings-nav-entry client patch), so it opens inside
    // the settings modal like every other section. This only marks the
    // cloud-only Privacy row.
    const wireCapabilitiesNavigation = () => {
      for (const nav of document.querySelectorAll<HTMLElement>(
        'nav[aria-label="Settings"]',
      )) {
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
      }
    };

    // Inject a home-sidebar shortcut to the working Code-surface routines
    // page because the retained chat sidebar has no local routines entry.
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
        if (element.childElementCount === 0 && stripped(element) === "Projects")
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
        const cloudOnlySettings = new Set(["Cowork", "Privacy"]);
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

        // Memory is a native Customize section backed by the local /memory
        // API. An older local-only Desktop entry duplicated it and left the
        // native content header on the previously selected section (for
        // example, "Connectors") while showing local memory controls. Remove
        // any stale injected copy and keep the single reference navigation.
        desktopList
          .querySelector<HTMLElement>("[data-local-memory-settings]")
          ?.remove();

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
    // The exact text this dictation has written into the composer, and the
    // editor node it wrote into. Every pass REPLACES this run rather than
    // appending: whisper re-transcribes the whole growing buffer each pass
    // and freely revises earlier words, so an append-by-count strategy
    // duplicates and loops. Replacing our own run in place is idempotent and
    // self-correcting, and tracking the specific editor node stops a prior
    // session's text from leaking into a freshly mounted composer.
    let dictationRendered = "";
    let dictationEditor: HTMLElement | null = null;
    let dictationTimer: ReturnType<typeof setInterval> | null = null;
    let dictationBusy = false;
    let dictationGeneration = 0;
    const findDictationEditor = (): HTMLElement | null =>
      [
        ...document.querySelectorAll<HTMLElement>('[contenteditable="true"]'),
      ].find((candidate) => {
        const label = candidate.getAttribute("aria-label") ?? "";
        return (
          candidate.getClientRects().length > 0 &&
          (label === "Write your prompt to Claude" || label === "Prompt")
        );
      }) ?? null;
    // Render the full dictated text, replacing whatever this dictation wrote
    // last. Selects our previous run (verifying it still matches, so a user
    // edit mid-dictation is left alone) and overwrites it.
    const renderDictation = (text: string) => {
      const editor = findDictationEditor();
      if (!editor) return;
      if (editor !== dictationEditor) {
        dictationEditor = editor;
        dictationRendered = "";
      }
      editor.focus();
      const selection = window.getSelection();
      if (dictationRendered.length > 0 && selection) {
        selection.collapseToEnd();
        for (let index = 0; index < dictationRendered.length; index += 1)
          selection.modify("extend", "backward", "character");
        // If the selection no longer equals our run the user edited in the
        // middle of it; leave their text and start a fresh run at the cursor.
        if (selection.toString() !== dictationRendered) {
          selection.collapseToEnd();
          dictationRendered = "";
        }
      }
      document.execCommand("insertText", false, text);
      dictationRendered = text;
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
    // Render the transcript, replacing our previous run. Partial passes drop
    // the trailing two words because whisper keeps revising the end of a
    // still-growing recording; the final pass renders everything.
    const dictationAppend = (transcript: string, finalPass: boolean) => {
      const words = transcript.split(/\s+/).filter(Boolean);
      const usable = finalPass ? words : words.slice(0, -2);
      if (usable.length === 0) return;
      renderDictation(usable.join(" "));
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
        // The dictated run is now the user's text; a new dictation starts a
        // fresh run rather than reselecting this one.
        dictationRendered = "";
        dictationEditor = null;
        delete button.dataset.state;
      }
    };
    const startDictation = async (button: HTMLButtonElement) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        dictationChunks = [];
        dictationRendered = "";
        dictationEditor = null;
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
    type LocalRoutineRecord = {
      id: string;
      displayName: string;
      description: string;
      prompt: string;
      cronExpression: string;
      cwd: string;
      status: "active" | "paused" | "deleted";
      enabled: boolean;
      nextRunAt: number | null;
      runCount: number;
    };

    const routineTemplates = [
      {
        id: "monitor-topic",
        icon: "⌘",
        iconName: "monitor",
        name: "Monitor a topic",
        description:
          "Watch for news or mentions of a topic, competitor, or keyword.",
        schedule: "Every day at 9:00 AM",
        worksWith: "",
        cronExpression: "0 9 * * *",
        prompt:
          "Check for new information, news, or mentions relevant to the current project and its competitors. Summarize only meaningful changes and include source links when available.",
      },
      {
        id: "inbox-triage",
        icon: "✉",
        iconName: "inbox",
        name: "Inbox triage",
        description:
          "Categorize your inbox and draft replies to anything urgent.",
        schedule: "Weekdays at 8:00 AM",
        worksWith: "Gmail",
        cronExpression: "0 8 * * 1-5",
        prompt:
          "Triage new inbox material available through my configured connectors. Group it by urgency, summarize every actionable item, and draft replies for anything that needs a response today.",
      },
      {
        id: "meeting-prep",
        icon: "□",
        iconName: "calendar",
        name: "Meeting prep",
        description:
          "A short brief before each meeting on your calendar, covering attendees, context, and agenda.",
        schedule: "Weekdays at 8:00 AM",
        worksWith: "Google Calendar",
        cronExpression: "0 8 * * 1-5",
        prompt:
          "Prepare a concise brief for today's meetings using my calendar and available context. Cover attendees, agenda, relevant documents or messages, and anything I should prepare.",
      },
      {
        id: "weekly-review",
        icon: "☷",
        iconName: "checklist",
        name: "Weekly review",
        description: "A Friday summary of what happened this week.",
        schedule: "Every Friday at 4:00 PM",
        worksWith: "",
        cronExpression: "0 16 * * 5",
        prompt:
          "Write a concise weekly summary of accomplishments, decisions, open work, and next steps using the information available in this project and my configured connectors.",
      },
      {
        id: "content-ideas",
        icon: "◇",
        iconName: "ideas",
        name: "Content ideas",
        description:
          "Draft a few post ideas each week from the latest news in your industry.",
        schedule: "Every Monday at 9:00 AM",
        worksWith: "",
        cronExpression: "0 9 * * 1",
        prompt:
          "Draft several timely content ideas based on recent developments relevant to this project and industry. Give each idea a concise angle, supporting context, and suggested format.",
      },
      {
        id: "briefing",
        icon: "☀",
        iconName: "briefing",
        name: "Daily briefing",
        description:
          "What needs your attention today across calendar, email, and messages.",
        schedule: "Weekdays at 8:00 AM",
        worksWith: "Google Calendar · Gmail · Slack",
        cronExpression: "0 8 * * 1-5",
        prompt:
          "Prepare a short, scannable weekday briefing using the information available through my calendar, inbox, messages, and project context. Cover today's schedule, urgent items, and anything that needs my attention.",
      },
    ] as const;

    let routineRenderGeneration = 0;

    const escapeRoutineMarkup = (value: unknown) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    const routineScheduleLabel = (task: LocalRoutineRecord) => {
      if (!task.cronExpression) return "Manual";
      if (!task.enabled || task.status !== "active") return "Paused";
      if (task.nextRunAt)
        return `Next run ${new Date(task.nextRunAt).toLocaleString([], {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        })}`;
      return task.cronExpression;
    };

    const renderCodeRoutines = async (host: HTMLElement): Promise<void> => {
      const generation = ++routineRenderGeneration;
      const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
      const scheduled = services.scheduledTasks;
      let tasks: LocalRoutineRecord[] = [];
      let loadError = "";
      if (scheduled) {
        try {
          const records = await scheduled.getAllScheduledTasks();
          if (Array.isArray(records))
            tasks = records.filter((record): record is LocalRoutineRecord =>
              Boolean(
                record &&
                typeof record === "object" &&
                typeof (record as { id?: unknown }).id === "string",
              ),
            );
        } catch (error) {
          loadError = error instanceof Error ? error.message : String(error);
        }
      } else loadError = "The local scheduler is unavailable.";
      if (generation !== routineRenderGeneration || !host.isConnected) return;

      const taskMarkup = tasks.length
        ? `<section class="routine-list" aria-label="Local routines">
            ${tasks
              .map(
                (
                  task,
                ) => `<article class="routine-row" data-routine-id="${escapeRoutineMarkup(task.id)}">
                  <div class="routine-row-copy">
                    <strong>${escapeRoutineMarkup(task.displayName || task.id)}</strong>
                    <span>${escapeRoutineMarkup(task.description || task.prompt)}</span>
                    <small>◷ ${escapeRoutineMarkup(routineScheduleLabel(task))}${task.runCount ? ` · ${task.runCount} run${task.runCount === 1 ? "" : "s"}` : ""}</small>
                  </div>
                  <div class="routine-actions">
                    <button type="button" data-action="run">Run now</button>
                    <button type="button" data-action="toggle">${task.enabled && task.status === "active" ? "Pause" : "Resume"}</button>
                    <button type="button" data-action="delete" class="danger">Delete</button>
                  </div>
                </article>`,
              )
              .join("")}
          </section>`
        : `<div class="routine-empty"><span class="clock">◷</span><span>No routines yet.</span></div>`;

      shadow.innerHTML = `<style>
        :host { display:block; min-height:100%; color:var(--cds-text-primary,#e8e6e3); font:14px/1.38 ui-sans-serif,system-ui,sans-serif; }
        * { box-sizing:border-box; }
        button,textarea,input,select { font:inherit; }
        button { color:inherit; }
        .page { width:min(1410px,calc(100% - 48px)); margin:0 auto; padding:34px 0 56px; }
        .heading { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
        h1 { margin:0; font-size:17px; font-weight:650; display:flex; align-items:center; gap:9px; }
        .bolt { font-size:19px; color:var(--accent-brand,#d97757); }
        .subtitle { margin:4px 0 15px; color:var(--cds-text-secondary,#99958f); }
        .primary,.secondary,.routine-actions button,.suggestion { border:0; border-radius:8px; background:var(--cds-bg-200,rgba(255,255,255,.08)); padding:7px 11px; cursor:pointer; }
        .primary { background:var(--accent-brand,#d97757); color:white; font-weight:600; }
        .primary:disabled { opacity:.45; cursor:default; }
        .draft { border:1px solid var(--cds-border,rgba(255,255,255,.12)); border-radius:10px; background:var(--cds-bg-200,rgba(255,255,255,.08)); overflow:hidden; }
        textarea { display:block; width:100%; min-height:54px; resize:vertical; border:0; outline:0; padding:13px; color:inherit; background:transparent; }
        .draft-footer { display:flex; gap:6px; align-items:center; padding:0 10px 10px; }
        .suggestion { padding:4px 9px; color:var(--cds-text-secondary,#aaa6a0); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .draft-footer .primary { margin-left:auto; }
        .routine-empty { height:220px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:9px; color:var(--cds-text-secondary,#99958f); }
        .clock { font-size:27px; }
        .routine-list { display:grid; gap:8px; padding:24px 0; }
        .routine-row { display:flex; align-items:center; gap:20px; padding:13px 15px; border:1px solid var(--cds-border,rgba(255,255,255,.12)); border-radius:10px; background:var(--cds-bg-100,rgba(255,255,255,.035)); }
        .routine-row-copy { min-width:0; flex:1; display:grid; gap:3px; }
        .routine-row-copy span { color:var(--cds-text-secondary,#aaa6a0); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .routine-row-copy small { color:var(--cds-text-tertiary,#77736e); }
        .routine-actions { display:flex; gap:6px; }
        .routine-actions .danger { color:#ef8b80; }
        .divider { color:var(--cds-text-tertiary,#77736e); margin:0 0 8px; }
        .templates { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
        .template { display:grid; grid-template-columns:22px minmax(0,1fr); gap:10px; min-height:112px; padding:13px; border:1px solid transparent; border-radius:9px; background:var(--cds-bg-200,rgba(255,255,255,.055)); cursor:pointer; text-align:left; color:inherit; }
        .template:hover,.template:focus-visible { background:var(--cds-bg-300,rgba(255,255,255,.095)); border-color:var(--cds-border,rgba(255,255,255,.15)); outline:0; }
        .template-icon { font-size:17px; color:var(--cds-text-secondary,#aaa6a0); }
        .template-copy { min-width:0; display:grid; align-content:start; gap:4px; }
        .template-copy strong { font-size:14px; }
        .template-copy span,.template-copy small { color:var(--cds-text-secondary,#99958f); }
        .template-copy small { font-size:12px; }
        .error,.status { min-height:18px; margin:8px 0 0; color:#ef8b80; }
        .status { color:var(--cds-text-secondary,#99958f); }
        .modal-backdrop { position:fixed; inset:0; z-index:10000; display:grid; place-items:center; padding:24px; background:rgba(0,0,0,.58); }
        .modal { width:min(620px,100%); max-height:calc(100vh - 48px); overflow:auto; border:1px solid var(--cds-border,rgba(255,255,255,.14)); border-radius:14px; padding:20px; background:var(--cds-bg-100,#2c2b29); box-shadow:0 22px 70px rgba(0,0,0,.45); }
        .modal h2 { margin:0 0 4px; font-size:18px; }
        .modal p { margin:0 0 16px; color:var(--cds-text-secondary,#99958f); }
        label { display:grid; gap:6px; margin:12px 0; font-weight:600; }
        label span { color:var(--cds-text-secondary,#99958f); font-size:12px; font-weight:400; }
        input,select,.modal textarea { width:100%; border:1px solid var(--cds-border,rgba(255,255,255,.13)); border-radius:8px; padding:9px 10px; outline:0; color:inherit; background:var(--cds-bg-200,rgba(255,255,255,.065)); }
        .modal textarea { min-height:125px; }
        .folder-row { display:flex; gap:8px; }
        .folder-row input { flex:1; }
        .modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:18px; }
        @media(max-width:850px){ .templates{grid-template-columns:1fr}.draft-footer{flex-wrap:wrap}.routine-row{align-items:flex-start;flex-direction:column}.routine-actions{width:100%} }
      </style>
      <main class="page">
        <div class="heading">
          <div><h1><span class="bolt">ϟ</span> Routines</h1><p class="subtitle">Create local routines that can be run whenever you need them or on a schedule.</p></div>
          <button type="button" class="secondary" data-new-routine>New routine⌄</button>
        </div>
        <section class="draft" aria-label="Draft a routine">
          <textarea data-routine-prompt placeholder="What do you want automated?"></textarea>
          <div class="draft-footer">
            <button type="button" class="suggestion" data-prompt="Summarize my open PRs every weekday morning">Summarize my open PRs every weekday morning</button>
            <button type="button" class="suggestion" data-prompt="Triage new issues and flag duplicates each morning">Triage new issues and flag duplicates each morning</button>
            <button type="button" class="suggestion" data-prompt="Draft release notes from recently merged changes">Draft release notes whenever a PR merges</button>
            <button type="button" class="primary" data-draft disabled>Draft routine</button>
          </div>
        </section>
        <p class="error" role="alert">${escapeRoutineMarkup(loadError)}</p>
        ${taskMarkup}
        <p class="divider">Or start from a template</p>
        <section class="templates" aria-label="Routine templates">
          ${routineTemplates
            .map(
              (
                template,
              ) => `<button type="button" class="template" data-template="${template.id}">
                <span class="template-icon" aria-hidden="true">${template.icon}</span>
                <span class="template-copy"><strong>${template.name}</strong><span>${template.description}</span><small>◷ ${template.schedule}${template.worksWith ? `<br>Works with ${template.worksWith}` : ""}</small></span>
              </button>`,
            )
            .join("")}
        </section>
        <p class="status" role="status"></p>
      </main>`;

      const prompt = shadow.querySelector<HTMLTextAreaElement>(
        "[data-routine-prompt]",
      );
      const draft = shadow.querySelector<HTMLButtonElement>("[data-draft]");
      const status = shadow.querySelector<HTMLElement>(".status");
      const setStatus = (message: string, error = false) => {
        if (!status) return;
        status.textContent = message;
        status.style.color = error ? "#ef8b80" : "";
      };

      type RoutineEditorInitial = {
        name?: string;
        prompt?: string;
        cronExpression?: string;
        description?: string;
        schedule?: string;
      };
      const openEditor = (initial?: RoutineEditorInitial) => {
        shadow.querySelector(".modal-backdrop")?.remove();
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        const suggestedName =
          initial?.name ??
          initial?.prompt?.split(/\s+/).slice(0, 5).join(" ") ??
          "New routine";
        backdrop.innerHTML = `<form class="modal">
          <h2>Create local routine</h2>
          <p>Runs through the configured local model and persists on this device.</p>
          <label>Name<input name="name" required maxlength="80" value="${escapeRoutineMarkup(suggestedName)}"></label>
          <label>Description<input name="description" maxlength="180" value="${escapeRoutineMarkup(initial?.description ?? "")}"></label>
          <label>Instructions<textarea name="prompt" required>${escapeRoutineMarkup(initial?.prompt ?? "")}</textarea></label>
          <label>Schedule
            <select name="schedule">
              <option value="${escapeRoutineMarkup(initial?.cronExpression ?? "0 9 * * 1-5")}">Template schedule${initial?.schedule ? ` — ${escapeRoutineMarkup(initial.schedule)}` : ""}</option>
              <option value="0 9 * * *">Every day at 9:00 AM</option>
              <option value="0 9 * * 1-5">Weekdays at 9:00 AM</option>
              <option value="0 9 * * 1">Every Monday at 9:00 AM</option>
              <option value="">Manual only</option>
            </select>
            <span>You can edit the exact cron schedule from the routine detail page.</span>
          </label>
          <label>Working folder
            <span class="folder-row"><input name="cwd" placeholder="Optional — defaults to the Open-Claude routines folder" readonly><button type="button" class="secondary" data-pick-folder>Choose…</button></span>
          </label>
          <p class="error" data-editor-error></p>
          <div class="modal-actions"><button type="button" class="secondary" data-cancel>Cancel</button><button type="submit" class="primary">Create routine</button></div>
        </form>`;
        shadow.append(backdrop);
        const form = backdrop.querySelector<HTMLFormElement>("form")!;
        const folder = form.elements.namedItem("cwd") as HTMLInputElement;
        backdrop
          .querySelector<HTMLButtonElement>("[data-pick-folder]")
          ?.addEventListener("click", async () => {
            const picked = await services.pickFolder?.();
            if (picked) folder.value = picked;
          });
        const close = () => backdrop.remove();
        backdrop
          .querySelector<HTMLButtonElement>("[data-cancel]")
          ?.addEventListener("click", close);
        backdrop.addEventListener("click", (event) => {
          if (event.target === backdrop) close();
        });
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          const submit = form.querySelector<HTMLButtonElement>(
            'button[type="submit"]',
          )!;
          const error = form.querySelector<HTMLElement>("[data-editor-error]")!;
          const data = new FormData(form);
          const name = String(data.get("name") ?? "").trim();
          const instructions = String(data.get("prompt") ?? "").trim();
          if (!name || !instructions) return;
          if (!scheduled) {
            error.textContent =
              "Local scheduled-task services are unavailable.";
            return;
          }
          submit.disabled = true;
          submit.textContent = "Creating…";
          const idBase = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 42);
          void scheduled
            .createScheduledTask({
              name: `${idBase || "routine"}-${crypto.randomUUID().slice(0, 8)}`,
              displayName: name,
              description: String(data.get("description") ?? "").trim(),
              prompt: instructions,
              cronExpression: String(data.get("schedule") ?? ""),
              cwd: String(data.get("cwd") ?? "").trim(),
            })
            .then((created) => {
              if (!created)
                throw new Error("The routine could not be created.");
              close();
              setStatus(`Created “${name}”.`);
              return renderCodeRoutines(host);
            })
            .catch((reason) => {
              error.textContent =
                reason instanceof Error ? reason.message : String(reason);
              submit.disabled = false;
              submit.textContent = "Create routine";
            });
        });
        window.setTimeout(
          () =>
            form.querySelector<HTMLInputElement>('input[name="name"]')?.focus(),
          0,
        );
      };

      prompt?.addEventListener("input", () => {
        if (draft) draft.disabled = !prompt.value.trim();
      });
      draft?.addEventListener("click", () =>
        openEditor({ prompt: prompt?.value.trim() ?? "" }),
      );
      shadow
        .querySelector<HTMLButtonElement>("[data-new-routine]")
        ?.addEventListener("click", () => openEditor());
      for (const suggestion of shadow.querySelectorAll<HTMLButtonElement>(
        "[data-prompt]",
      ))
        suggestion.addEventListener("click", () => {
          if (prompt) {
            prompt.value = suggestion.dataset.prompt ?? "";
            prompt.dispatchEvent(new Event("input"));
            prompt.focus();
          }
        });
      for (const card of shadow.querySelectorAll<HTMLButtonElement>(
        "[data-template]",
      ))
        card.addEventListener("click", () => {
          const template = routineTemplates.find(
            (candidate) => candidate.id === card.dataset.template,
          );
          if (template) openEditor(template);
        });
      for (const row of shadow.querySelectorAll<HTMLElement>(
        "[data-routine-id]",
      )) {
        const task = tasks.find(
          (candidate) => candidate.id === row.dataset.routineId,
        );
        if (!task) continue;
        row
          .querySelector<HTMLButtonElement>('[data-action="run"]')
          ?.addEventListener("click", () => {
            setStatus(`Starting “${task.displayName || task.id}”…`);
            void services
              .startLocalSession?.({
                cwd: task.cwd,
                message: task.prompt,
                title: `${task.displayName || task.id} · ${new Date().toLocaleString()}`,
                scheduledTaskId: task.id,
                permissionMode: "bypassPermissions",
              })
              .then((started) => {
                if (!started?.sessionId)
                  throw new Error("The local session did not start.");
                setStatus(`Started “${task.displayName || task.id}”.`);
              })
              .catch((reason) =>
                setStatus(
                  reason instanceof Error ? reason.message : String(reason),
                  true,
                ),
              );
          });
        row
          .querySelector<HTMLButtonElement>('[data-action="toggle"]')
          ?.addEventListener("click", () => {
            const next =
              task.enabled && task.status === "active" ? "paused" : "active";
            void scheduled
              ?.updateScheduledTaskStatus(task.id, next)
              .then(() => renderCodeRoutines(host))
              .catch((reason) =>
                setStatus(
                  reason instanceof Error ? reason.message : String(reason),
                  true,
                ),
              );
          });
        row
          .querySelector<HTMLButtonElement>('[data-action="delete"]')
          ?.addEventListener("click", () => {
            if (!window.confirm(`Delete “${task.displayName || task.id}”?`))
              return;
            void scheduled
              ?.updateScheduledTaskStatus(task.id, "deleted")
              .then(() => renderCodeRoutines(host))
              .catch((reason) =>
                setStatus(
                  reason instanceof Error ? reason.message : String(reason),
                  true,
                ),
              );
          });
      }
    };

    const wireCodeRoutinesPage = () => {
      document.getElementById("local-code-routines")?.remove();
      for (const native of document.querySelectorAll<HTMLElement>(
        '[data-local-routines-native="true"]',
      )) {
        native.hidden = false;
        delete native.dataset.localRoutinesNative;
      }
    };

    const scheduledReferenceIcon = (name: string) => {
      const paths: Record<string, string> = {
        monitor:
          '<path d="M8 7 5 5m11 2 3-2M7 9l-2 8m12-8 2 8M8 10h8M7 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>',
        inbox: '<path d="M4 5h16v13H4zM4 13h4l2 3h4l2-3h4M8 8h8"/>',
        calendar:
          '<path d="M5 6h14v14H5zM8 3v6m8-6v6M5 10h14M8 14h3m2 0h3m-8 3h3"/>',
        checklist:
          '<path d="m5 7 1.5 1.5L9 5.5M12 7h7M5 13l1.5 1.5L9 11.5M12 13h7M5 19l1.5 1.5L9 17.5M12 19h7"/>',
        ideas:
          '<path d="M9 18h6m-5 3h4m3-11a5 5 0 1 0-8.5 3.6c.9.9 1.5 1.8 1.5 3.4h4c0-1.6.6-2.5 1.5-3.4A5 5 0 0 0 17 10Z"/>',
        briefing:
          '<path d="M4 18h16M6 18a6 6 0 0 1 12 0M12 4v3M5.6 7.6l2.1 2.1m10.7-2.1-2.1 2.1"/>',
      };
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.briefing}</svg>`;
    };

    const wireNativeScheduledPresets = () => {
      const existing = document.querySelector<HTMLElement>(
        '[data-local-scheduled-presets="true"]',
      );
      if (location.pathname !== "/epitaxy/scheduled") {
        existing?.remove();
        return;
      }

      const title = [
        ...document.querySelectorAll<HTMLElement>("h1, h2, p, span"),
      ].find(
        (element) =>
          element.getClientRects().length > 0 &&
          element.textContent?.trim() === "Scheduled tasks",
      );
      const headingCopy = title?.closest<HTMLElement>(".flex.flex-col.gap-g3");
      const header = headingCopy?.parentElement;
      const page = header?.parentElement;
      if (!title || !headingCopy || !header || !page) return;

      page.dataset.localScheduledReferencePage = "true";
      header.dataset.localScheduledReferenceHeader = "true";
      title.dataset.localScheduledReferenceTitle = "true";
      const subtitle = [
        ...headingCopy.querySelectorAll<HTMLElement>("p, span"),
      ].find((element) =>
        element.textContent?.trim().startsWith("Run tasks on a schedule"),
      );
      if (subtitle && !subtitle.dataset.localScheduledReferenceSubtitle) {
        subtitle.dataset.localScheduledReferenceSubtitle = "true";
        subtitle.innerHTML =
          "Run tasks on a schedule or whenever you need them. Type <code>/schedule</code> in any existing task to set one up.";
      }

      if (!document.getElementById("local-scheduled-reference-style")) {
        const style = document.createElement("style");
        style.id = "local-scheduled-reference-style";
        style.textContent = `
          [data-local-scheduled-reference-page="true"] {
            gap: 0 !important;
            padding-top: 68px !important;
            padding-bottom: 48px !important;
          }
          [data-local-scheduled-reference-header="true"] {
            display: block !important;
            position: relative;
            align-items: flex-start !important;
            margin-bottom: 22px;
          }
          [data-local-scheduled-reference-title="true"] {
            font-family: "Anthropic Serif", Georgia, serif !important;
            font-size: 30px !important;
            font-weight: 500 !important;
            line-height: 1.12 !important;
            letter-spacing: -.02em;
          }
          [data-local-scheduled-reference-subtitle="true"] {
            font-size: 15px !important;
            line-height: 1.45 !important;
          }
          [data-local-scheduled-reference-subtitle="true"] code {
            border-radius: 5px;
            padding: 1px 6px;
            background: var(--cds-bg-200, rgba(255,255,255,.07));
            color: var(--cds-text-primary, inherit);
            font: 13px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
          }
          [data-local-scheduled-reference-header="true"] > button:last-child::after {
            content: "⌄";
            margin-left: 8px;
            font-size: 13px;
          }
          [data-local-scheduled-reference-header="true"] > button:last-child {
            position: absolute;
            top: 0;
            right: 0;
          }
          .local-scheduled-sort {
            position: absolute;
            top: 0;
            right: 126px;
            white-space: nowrap;
            border: 0;
            border-radius: 9px;
            padding: 9px 13px;
            background: var(--cds-bg-200, rgba(255,255,255,.08));
            color: var(--cds-text-secondary, #9a9690);
            font: inherit;
            cursor: default;
          }
          .local-scheduled-sort strong {
            color: var(--cds-text-primary, inherit);
            font-weight: 650;
          }
          .local-scheduled-search {
            display: flex;
            align-items: center;
            gap: 11px;
            width: 100%;
            height: 48px;
            margin-bottom: 4px;
            padding: 0 16px;
            border: 1px solid var(--cds-border, rgba(255,255,255,.14));
            border-radius: 11px;
            background: var(--cds-bg-200, rgba(255,255,255,.075));
            color: var(--cds-text-secondary, #9a9690);
          }
          .local-scheduled-search:focus-within {
            border-color: #4f9cf9;
            box-shadow: 0 0 0 1px #4f9cf9;
          }
          .local-scheduled-search svg { width: 18px; height: 18px; flex: 0 0 auto; }
          .local-scheduled-search input {
            min-width: 0;
            flex: 1;
            border: 0;
            outline: 0;
            background: transparent;
            color: var(--cds-text-primary, inherit);
            font: inherit;
          }
          .local-scheduled-search input::placeholder { color: var(--cds-text-secondary, #9a9690); }
          [data-local-scheduled-reference-empty="true"] {
            min-height: 264px;
            gap: 20px !important;
            padding: 48px 0 54px !important;
            font-size: 15px !important;
          }
          [data-local-scheduled-reference-empty="true"] > svg {
            width: 92px !important;
            height: 92px !important;
            stroke-width: 1.25 !important;
          }
          [data-local-scheduled-presets="true"] {
            display: flex;
            flex-direction: column;
            width: 100%;
            padding-bottom: 28px;
          }
          .local-scheduled-wave {
            display: block;
            width: 100%;
            height: 6px;
            margin-bottom: 34px;
            overflow: hidden;
            color: var(--cds-border, rgba(255,255,255,.14));
          }
          .local-scheduled-wave svg { display: block; width: 100%; height: 6px; }
          .local-scheduled-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 42px;
            row-gap: 0;
          }
          .local-scheduled-preset {
            display: grid;
            grid-template-columns: 42px minmax(0,1fr);
            align-items: start;
            gap: 16px;
            min-height: 126px;
            border: 0;
            border-radius: 10px;
            padding: 16px 10px;
            background: transparent;
            color: inherit;
            text-align: left;
            cursor: pointer;
          }
          .local-scheduled-preset:hover,
          .local-scheduled-preset:focus-visible {
            background: var(--cds-bg-200, rgba(255,255,255,.055));
            outline: 0;
          }
          .local-scheduled-preset:disabled { opacity: .55; cursor: wait; }
          .local-scheduled-preset-icon {
            display: grid;
            width: 42px;
            height: 42px;
            place-items: center;
            border-radius: 9px;
            background: var(--cds-bg-200, rgba(255,255,255,.075));
            color: var(--cds-text-secondary, #aaa6a0);
          }
          .local-scheduled-preset-icon svg { width: 22px; height: 22px; }
          .local-scheduled-preset-copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
          .local-scheduled-preset-copy strong { font-size: 15px; font-weight: 650; line-height: 1.25; }
          .local-scheduled-preset-description {
            color: var(--cds-text-secondary, #aaa6a0);
            font-size: 15px;
            line-height: 1.35;
          }
          .local-scheduled-preset-schedule {
            margin-top: 2px;
            color: var(--cds-text-tertiary, #77736e);
            font-size: 13px;
            line-height: 1.3;
          }
          .local-scheduled-status {
            min-height: 18px;
            margin: 0 10px;
            color: var(--cds-text-secondary, #aaa6a0);
            font-size: 12px;
          }
          @media (max-width: 760px) {
            [data-local-scheduled-reference-page="true"] { padding-top: 36px !important; }
            .local-scheduled-sort { display: none; }
            .local-scheduled-grid { grid-template-columns: 1fr; }
          }
        `;
        document.head.append(style);
      }

      const newTask = [
        ...header.querySelectorAll<HTMLButtonElement>("button"),
      ].find((button) => button.textContent?.trim() === "New task");
      if (newTask && !header.querySelector(".local-scheduled-sort")) {
        const sort = document.createElement("button");
        sort.type = "button";
        sort.className = "local-scheduled-sort";
        sort.innerHTML = "Sort by <strong>Next run</strong>⌄";
        header.insertBefore(sort, newTask);
      }

      const emptyState = [...page.querySelectorAll<HTMLElement>("div")].find(
        (element) =>
          element.parentElement === page &&
          element.textContent?.trim() === "No scheduled tasks yet.",
      );
      if (!emptyState) {
        existing?.remove();
        return;
      }
      emptyState.dataset.localScheduledReferenceEmpty = "true";
      if (!emptyState.dataset.localScheduledReferenceStopwatch) {
        emptyState.dataset.localScheduledReferenceStopwatch = "true";
        emptyState.innerHTML =
          '<svg viewBox="0 0 96 104" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M38 7h20v10H38zM33 12h30"/><circle cx="48" cy="60" r="35"/><path d="M48 34v27l17-10"/></svg><span>No scheduled tasks yet.</span>';
      }

      let search = page.querySelector<HTMLElement>(".local-scheduled-search");
      if (!search) {
        search = document.createElement("label");
        search.className = "local-scheduled-search";
        search.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input type="search" aria-label="Search scheduled tasks" placeholder="Search scheduled tasks…">';
        page.insertBefore(search, emptyState);
      }
      if (existing) return;

      const section = document.createElement("section");
      section.dataset.localScheduledPresets = "true";
      const wave = document.createElement("span");
      wave.className = "local-scheduled-wave";
      wave.setAttribute("aria-hidden", "true");
      wave.innerHTML = `<svg viewBox="0 0 1200 6" preserveAspectRatio="none" fill="none"><path d="M 0 3 q 3 -3 6 0${" t 6 0".repeat(199)}" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>`;
      const grid = document.createElement("div");
      grid.className = "local-scheduled-grid";
      const status = document.createElement("p");
      status.className = "local-scheduled-status";
      status.setAttribute("role", "status");

      for (const template of routineTemplates) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.localScheduledPreset = template.id;
        button.className = "local-scheduled-preset";
        const icon = document.createElement("span");
        icon.className = "local-scheduled-preset-icon";
        icon.innerHTML = scheduledReferenceIcon(template.iconName);
        const copy = document.createElement("span");
        copy.className = "local-scheduled-preset-copy";
        const name = document.createElement("strong");
        name.textContent = template.name;
        const description = document.createElement("span");
        description.className = "local-scheduled-preset-description";
        description.textContent = template.description;
        const schedule = document.createElement("small");
        schedule.className = "local-scheduled-preset-schedule";
        schedule.textContent = `◷  ${template.schedule}`;
        copy.append(name, description, schedule);
        button.append(icon, copy);
        button.addEventListener("click", () => {
          const scheduled = services.scheduledTasks;
          if (!scheduled) {
            status.textContent = "The local scheduler is unavailable.";
            return;
          }
          button.disabled = true;
          status.textContent = `Creating “${template.name}”…`;
          void scheduled
            .createScheduledTask({
              name: template.id,
              displayName: template.name,
              description: template.description,
              prompt: template.prompt,
              cronExpression: template.cronExpression,
              cwd: "",
              useWorktree: false,
            })
            .then((created) => {
              if (!created || typeof created !== "object")
                throw new Error("The preset could not be created.");
              const id =
                "id" in created && typeof created.id === "string"
                  ? created.id
                  : template.id;
              history.pushState(
                history.state,
                "",
                `/epitaxy/scheduled/${encodeURIComponent(id)}`,
              );
              window.dispatchEvent(
                new PopStateEvent("popstate", { state: history.state }),
              );
            })
            .catch((error) => {
              status.textContent =
                error instanceof Error ? error.message : String(error);
              button.disabled = false;
            });
        });
        grid.append(button);
      }
      section.append(wave, grid, status);
      page.insertBefore(section, emptyState.nextSibling);

      const searchInput = search.querySelector<HTMLInputElement>("input");
      searchInput?.addEventListener("input", () => {
        const query = searchInput.value.trim().toLowerCase();
        for (const card of grid.querySelectorAll<HTMLButtonElement>("button"))
          card.hidden = Boolean(
            query && !card.textContent?.toLowerCase().includes(query),
          );
      });
    };

    const wireLocalMemoryRoute = () => {
      if (!host.hidden && activeLocalPanel === "memory") return;
      const navigation = document.querySelector<HTMLElement>(
        'nav[aria-label="Settings"]',
      );
      if (!navigation) return;
      const memoryNavigation = [
        ...navigation.querySelectorAll<HTMLElement>("button, a, [role=button]"),
      ].find(
        (candidate) =>
          (
            candidate.querySelector<HTMLElement>(".truncate")?.textContent ??
            candidate.textContent ??
            ""
          ).trim() === "Memory",
      );
      const routeTargetsMemory =
        location.hash.includes("settings/customize-memory") ||
        location.pathname === "/customize/memory";
      const navigationTargetsMemory =
        memoryNavigation?.getAttribute("aria-current") === "page" ||
        memoryNavigation?.getAttribute("aria-selected") === "true";
      if (!routeTargetsMemory && !navigationTargetsMemory) return;
      const contentPane = navigation.nextElementSibling;
      const scroll =
        contentPane?.querySelector<HTMLElement>(".overflow-y-auto") ??
        (contentPane instanceof HTMLElement ? contentPane : null);
      if (!memoryNavigation || !scroll) return;
      activateLocalSettings(
        scroll,
        memoryNavigation as HTMLButtonElement,
        navigation,
        "memory",
      );
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
      wireCodeRoutinesPage();
      wireNativeScheduledPresets();
      wireLocalMemoryRoute();
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
