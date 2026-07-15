interface PublicProviderConfig {
  provider: { baseUrl: string; model: string };
  hasApiKey: boolean;
}

interface ModelList {
  models: string[];
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
  return (
    await responseJson<ModelList>(
      await fetch("/api/local/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input ?? {}),
      }),
    )
  ).models;
}

export const localClaudeApi = {
  getConfig,
  setConfig,
  listModels,
  version: 1,
};

export function installLocalWorkbench(): void {
  const install = () => {
    if (!document.getElementById("local-claude-chrome-style")) {
      const style = document.createElement("style");
      style.id = "local-claude-chrome-style";
      style.textContent = `
        /* The retained client requires an internal identity object to build
           conversation queries, but local mode has no user account. */
        [data-testid="user-menu-button"] { display: none !important; }
      `;
      document.head.append(style);
    }
    if (document.getElementById("local-claude-workbench")) return;
    const host = document.createElement("div");
    host.id = "local-claude-workbench";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        button, input { font: inherit; }
        #trigger { position: fixed; right: 18px; bottom: 18px; z-index: 2147483646; border: 1px solid rgba(110,104,94,.28); border-radius: 999px; background: #f7f5f0; color: #3d3a35; padding: 9px 13px; box-shadow: 0 4px 18px rgba(0,0,0,.13); cursor: pointer; font: 600 12px/1.2 ui-sans-serif,system-ui,sans-serif; }
        #trigger:hover { background: #fff; }
        #panel { position: fixed; inset: auto 18px 62px auto; margin: 0; z-index: 2147483647; width: min(390px, calc(100vw - 36px)); max-width: none; padding: 18px; border: 1px solid rgba(110,104,94,.25); border-radius: 16px; background: #f7f5f0; color: #292724; box-shadow: 0 16px 50px rgba(0,0,0,.22); font: 13px/1.45 ui-sans-serif,system-ui,sans-serif; }
        #panel::backdrop { background: rgba(34, 31, 27, .16); }
        header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 13px; }
        h2 { font: 600 17px/1.2 ui-serif,Georgia,serif; margin: 0; }
        .close { border: 0; background: transparent; font-size: 20px; cursor: pointer; color: inherit; }
        label { display: grid; gap: 5px; margin-top: 11px; font-weight: 600; }
        input { width: 100%; border: 1px solid rgba(110,104,94,.32); border-radius: 9px; padding: 8px 10px; background: #fff; color: #292724; }
        .hint { margin: 4px 0 0; color: #6b675f; font-size: 11px; }
        .actions { display: flex; gap: 8px; margin-top: 15px; }
        .actions button { border: 1px solid rgba(110,104,94,.3); border-radius: 9px; padding: 8px 11px; cursor: pointer; background: #fff; color: inherit; }
        .actions .primary { background: #d97757; border-color: #d97757; color: #fff; }
        #status { min-height: 18px; margin: 10px 0 0; color: #6b675f; font-size: 12px; white-space: pre-wrap; }
        #models { max-height: 120px; overflow: auto; margin-top: 8px; display: grid; gap: 4px; }
        #models button { text-align: left; border: 0; border-radius: 7px; padding: 5px 7px; background: rgba(110,104,94,.08); cursor: pointer; color: inherit; }
      </style>
      <button id="trigger" type="button" aria-label="Local model settings">Local model</button>
      <dialog id="panel" aria-label="Local model settings">
        <header><h2>Local model</h2><button class="close" type="button" aria-label="Close local model settings">×</button></header>
        <label>OpenAI-compatible URL<input id="base-url" type="url" spellcheck="false"></label>
        <p class="hint">Ollama: http://127.0.0.1:11434/v1 · LM Studio: http://127.0.0.1:1234/v1</p>
        <label>Model<input id="model" type="text" spellcheck="false"></label>
        <label>API key<input id="api-key" type="password" autocomplete="off" placeholder="Leave blank to keep current key"></label>
        <div class="actions"><button id="models-button" type="button">Discover models</button><button id="save" class="primary" type="button">Save and reload</button></div>
        <div id="models"></div><p id="status" role="status"></p>
      </dialog>`;
    document.documentElement.append(host);

    const element = <T extends HTMLElement>(selector: string) => {
      const value = root.querySelector<T>(selector);
      if (!value) throw new Error(`Missing workbench element ${selector}`);
      return value;
    };
    const panel = element<HTMLDialogElement>("#panel");
    const status = element<HTMLElement>("#status");
    const baseUrl = element<HTMLInputElement>("#base-url");
    const model = element<HTMLInputElement>("#model");
    const apiKey = element<HTMLInputElement>("#api-key");
    const models = element<HTMLElement>("#models");
    const showError = (error: unknown) => {
      status.textContent =
        error instanceof Error ? error.message : String(error);
    };

    let configLoad = 0;
    element("#trigger").addEventListener("click", async () => {
      const load = ++configLoad;
      status.textContent = "Loading…";
      try {
        const config = await getConfig();
        if (load !== configLoad) return;
        baseUrl.value = config.provider.baseUrl;
        model.value = config.provider.model;
        apiKey.placeholder = config.hasApiKey
          ? "Key stored — leave blank to keep it"
          : "Optional";
        status.textContent = "";
      } catch (error) {
        showError(error);
      } finally {
        if (load === configLoad) {
          if (!panel.open) panel.showModal();
          baseUrl.focus();
          baseUrl.select();
        }
      }
    });
    element(".close").addEventListener("click", () => {
      configLoad += 1;
      panel.close();
    });
    element("#models-button").addEventListener("click", async () => {
      status.textContent = "Contacting provider…";
      models.replaceChildren();
      try {
        const available = await listModels({
          baseUrl: baseUrl.value.trim(),
          ...(apiKey.value ? { apiKey: apiKey.value } : {}),
        });
        for (const id of available) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = id;
          button.addEventListener("click", () => {
            model.value = id;
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
          ...(apiKey.value ? { apiKey: apiKey.value } : {}),
        });
        location.reload();
      } catch (error) {
        showError(error);
      }
    });
    window.dispatchEvent(new CustomEvent("local-claude-ready"));
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
}
