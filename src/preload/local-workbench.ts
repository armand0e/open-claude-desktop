import { ipcRenderer } from "electron";

interface PublicProviderConfig {
  provider: { baseUrl: string; model: string; contextWindow: number };
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
  version: 1,
};

let mermaidModule: Promise<(typeof import("mermaid"))["default"]> | null =
  null;
let mermaidDiagramId = 0;

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
  if (pre.dataset.localMermaidState) return;

  const source = code.textContent?.trim();
  if (!source) return;
  pre.dataset.localMermaidState = "rendering";

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
  }
}

function wireInlineMermaidDiagrams(): void {
  for (const code of document.querySelectorAll<HTMLElement>(
    "pre > code.language-mermaid",
  )) {
    void renderMermaidCodeBlock(code);
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
        button[data-mode="cowork"] { display: none !important; }
        [data-local-cloud-only="true"] { display: none !important; }
      `;
      document.head.append(style);
    }
    if (document.getElementById("local-claude-workbench")) return;

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
        #panel { width: min(100%, 660px); padding: 4px 0 28px; }
        h1 { margin: 0 0 6px; font: 600 24px/1.25 ui-serif, Georgia, serif; }
        .lede { margin: 0 0 24px; color: var(--cds-text-secondary, #6b675f); }
        .section { display: grid; gap: 14px; padding: 20px; border: 1px solid var(--cds-border, rgba(110,104,94,.22)); border-radius: 14px; background: var(--cds-surface-1, rgba(255,255,255,.38)); }
        label { display: grid; gap: 6px; font-weight: 600; }
        input { width: 100%; border: 1px solid var(--cds-border, rgba(110,104,94,.32)); border-radius: 9px; padding: 9px 11px; background: var(--cds-bg-000, #fff); color: inherit; outline: none; }
        input:focus { border-color: #d97757; box-shadow: 0 0 0 2px color-mix(in srgb, #d97757 25%, transparent); }
        .hint { margin: -7px 0 0; color: var(--cds-text-secondary, #6b675f); font-size: 12px; }
        .actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 2px; }
        .actions button { border: 1px solid var(--cds-border, rgba(110,104,94,.3)); border-radius: 9px; padding: 8px 12px; cursor: pointer; background: var(--cds-bg-000, #fff); color: inherit; }
        .actions .primary { background: #d97757; border-color: #d97757; color: #fff; }
        #status { min-height: 18px; margin: 0; color: var(--cds-text-secondary, #6b675f); font-size: 12px; white-space: pre-wrap; }
        #models { max-height: 160px; overflow: auto; display: grid; gap: 5px; }
        #models:empty { display: none; }
        #models button { text-align: left; border: 0; border-radius: 7px; padding: 6px 8px; background: var(--cds-fill-ghost-hover, rgba(110,104,94,.08)); cursor: pointer; color: inherit; }
      </style>
      <section id="panel" aria-label="Local model settings">
        <h1>Local model</h1>
        <p class="lede">Configure the OpenAI-compatible provider used by both Chat and Code.</p>
        <div class="section">
          <label>OpenAI-compatible URL<input id="base-url" type="url" spellcheck="false"></label>
          <p class="hint">Ollama: http://127.0.0.1:11434/v1 · LM Studio: http://127.0.0.1:1234/v1</p>
          <label>Model<input id="model" type="text" spellcheck="false"></label>
          <label>Context window (tokens)<input id="context-window" type="number" min="1024" step="1024" inputmode="numeric"></label>
          <p class="hint">Used by Code for its live context meter. Match the context length configured in your local model server.</p>
          <label>API key<input id="api-key" type="password" autocomplete="off" placeholder="Leave blank to keep current key"></label>
          <div class="actions"><button id="models-button" type="button">Discover models</button><button id="save" class="primary" type="button">Save</button></div>
          <div id="models"></div><p id="status" role="status"></p>
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
    const apiKey = element<HTMLInputElement>("#api-key");
    const models = element<HTMLElement>("#models");
    const showError = (error: unknown) => {
      status.textContent =
        error instanceof Error ? error.message : String(error);
    };

    let configLoad = 0;
    let activeScroll: HTMLElement | null = null;
    let localNavigationButton: HTMLButtonElement | null = null;
    let inactiveNavigationClass = "";
    let activeNavigationClass = "";
    const nativeDisplay = new WeakMap<
      HTMLElement,
      { value: string; priority: string }
    >();

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
        contextWindow.value = String(config.provider.contextWindow);
        apiKey.value = "";
        apiKey.placeholder = config.hasApiKey
          ? "Key stored — leave blank to keep it"
          : "Optional";
        status.textContent = "";
      } catch (error) {
        showError(error);
      }
    };

    const activateLocalSettings = (
      scroll: HTMLElement,
      navigationButton: HTMLButtonElement,
      navigationRoot: HTMLElement,
    ) => {
      restoreNativeSettings();
      activeScroll = scroll;
      localNavigationButton = navigationButton;
      hideNativeSettings(scroll);
      if (host.parentElement !== scroll) scroll.append(host);
      host.hidden = false;
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
      void loadConfiguration().finally(() => {
        if (!host.hidden) {
          baseUrl.focus();
          baseUrl.select();
        }
      });
    };

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

      const customize = [
        ...document.querySelectorAll<HTMLButtonElement>("button"),
      ].find((button) =>
        [...button.querySelectorAll<HTMLElement>(".truncate")].some(
          (label) => label.textContent?.trim() === "Customize",
        ),
      );
      const actions = customize?.parentElement;
      if (
        customize &&
        actions &&
        !actions.querySelector("[data-local-artifacts-button]")
      ) {
        const artifactsButton = customize.cloneNode(true) as HTMLButtonElement;
        artifactsButton.dataset.localArtifactsButton = "";
        artifactsButton.removeAttribute("aria-current");
        artifactsButton.removeAttribute("data-selected");
        artifactsButton.setAttribute("aria-label", "Artifacts");
        const artifactLabel =
          artifactsButton.querySelector<HTMLElement>(".truncate");
        if (artifactLabel) artifactLabel.textContent = "Artifacts";
        const icon =
          artifactsButton.querySelector<HTMLElement>("[data-cds='Icon']");
        if (icon) icon.textContent = "◫";
        artifactsButton.addEventListener("click", () =>
          location.assign("app://localhost/epitaxy/apps"),
        );
        actions.insertBefore(artifactsButton, customize);
      }

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
          if (!cloudOnlyLabels.has(label))
            continue;
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
        const desktopList = desktopLabel?.nextElementSibling;
        if (!(desktopList instanceof HTMLUListElement)) continue;
        const contentPane = navigation.nextElementSibling;
        const scroll =
          contentPane?.querySelector<HTMLElement>(".overflow-y-auto");
        if (!scroll) continue;

        const existingButtons = [
          ...navigation.querySelectorAll<HTMLButtonElement>("button"),
        ];
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
          button.innerHTML = `<span aria-hidden="true" style="width:1em;height:1em;display:flex;align-items:center;justify-content:center;font-size:17px">&#9881;</span><span class="min-w-0 flex-1 truncate">Local model</span>`;
          item.append(button);
          desktopList.prepend(item);
        }
        const localButton = item.querySelector<HTMLButtonElement>("button");
        if (!localButton) continue;
        localNavigationButton = localButton;
        if (!wiredButtons.has(localButton)) {
          wiredButtons.add(localButton);
          localButton.addEventListener("click", () =>
            activateLocalSettings(scroll, localButton, navigation),
          );
        }

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
          ...(apiKey.value ? { apiKey: apiKey.value } : {}),
        });
        apiKey.value = "";
        apiKey.placeholder = "Key stored — leave blank to keep it";
        status.textContent = "Saved.";
      } catch (error) {
        showError(error);
      }
    });

    document.documentElement.append(host);
    const wireLocalUi = () => {
      wireLocalNavigation();
      wireSidebarSettings();
      wireSettingsDialog();
      wireInlineMermaidDiagrams();
    };
    const observer = new MutationObserver(wireLocalUi);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    wireLocalUi();
    window.addEventListener("popstate", wireLocalUi);
    window.addEventListener("resize", updateLocalOverlayBounds);
    window.dispatchEvent(new CustomEvent("local-claude-ready"));
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
}
