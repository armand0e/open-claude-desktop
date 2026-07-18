import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface PersistentState {
  appConfig: {
    features: Record<string, boolean>;
    mcpServers: Record<string, unknown>;
    preferences: Record<string, unknown>;
    isUsingBuiltInNodeForMcp: boolean;
    isDxtAutoUpdatesEnabled: boolean;
  };
  globalShortcut: string;
  menuBarEnabled: boolean;
  locale: string;
  stores: Record<string, unknown>;
  localSessionEnvironment: unknown;
  // Root folder for Cowork task files (settings > Cowork files).
  // undefined means the ~/Claude default.
  coworkFilesRoot?: string;
  // Global instructions applied to every Cowork session (settings > Cowork).
  coworkGlobalInstructions?: string;
}

const DEFAULT_STATE: PersistentState = {
  appConfig: {
    features: {},
    mcpServers: {},
    preferences: {
      // Local Code has no organization policy layer. Keep its explicit,
      // user-visible bypass option available; the confirmation dialog still
      // communicates the risk before a session starts in this mode.
      bypassPermissionsModeEnabled: true,
    },
    isUsingBuiltInNodeForMcp: true,
    isDxtAutoUpdatesEnabled: true,
  },
  globalShortcut: "",
  menuBarEnabled: false,
  locale: "en-US",
  stores: {
    updaterState: { status: "idle", updateAvailable: false },
    navigationState: { canGoBack: false, canGoForward: false },
    apiReachability: { reachable: true },
    attachment: null,
    bootstrapState: {
      configured: false,
      origin: "none",
      health: "never",
      suppliedKeys: [],
      suppliedValues: {},
      bootstrapRefetchRevision: 0,
    },
    // 1.22209 shape: the Office add-in bridge applies this state object
    // verbatim (`_setFiles(state.files)`), so `files` must be an array.
    connectedFilesState: {
      files: [],
      selectedFileId: null,
      isFeatureEnabled: false,
    },
    grandPrixStatus: { status: "disconnected" },
    interactiveAuth: { status: "idle" },
    sessionsBridgeStatus: { status: "disconnected" },
    // The packaged renderer expects SupportBundle's discriminant to be
    // `stage`, not `status`. Any value other than `closed` opens its modal.
    supportBundleState: { stage: "closed" },
    activeServers: [],
  },
  localSessionEnvironment: null,
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeState(value: unknown): PersistentState {
  const input = objectValue(value);
  const appConfig = objectValue(input.appConfig);
  const inputStores = objectValue(input.stores);
  const supportBundleState = objectValue(inputStores.supportBundleState);
  return {
    ...structuredClone(DEFAULT_STATE),
    ...input,
    globalShortcut:
      typeof input.globalShortcut === "string"
        ? input.globalShortcut
        : DEFAULT_STATE.globalShortcut,
    menuBarEnabled:
      typeof input.menuBarEnabled === "boolean"
        ? input.menuBarEnabled
        : DEFAULT_STATE.menuBarEnabled,
    locale:
      typeof input.locale === "string" ? input.locale : DEFAULT_STATE.locale,
    appConfig: {
      ...DEFAULT_STATE.appConfig,
      ...appConfig,
      features: objectValue(appConfig.features),
      mcpServers: objectValue(appConfig.mcpServers),
      preferences: {
        ...DEFAULT_STATE.appConfig.preferences,
        ...objectValue(appConfig.preferences),
      },
    },
    stores: {
      ...DEFAULT_STATE.stores,
      ...inputStores,
      // Migrate profiles created before the SupportBundle store contract was
      // recovered. `{ status: "idle" }` left a non-dismissible diagnostic
      // report over the entire local UI on every launch.
      supportBundleState:
        typeof supportBundleState.stage === "string"
          ? supportBundleState
          : structuredClone(DEFAULT_STATE.stores.supportBundleState),
      // Migrate the pre-1.22209 array shape; the renderer now reads
      // `state.files` off this store and crashes on an array.
      connectedFilesState: Array.isArray(inputStores.connectedFilesState)
        ? structuredClone(DEFAULT_STATE.stores.connectedFilesState)
        : (inputStores.connectedFilesState ??
          structuredClone(DEFAULT_STATE.stores.connectedFilesState)),
    },
  } as PersistentState;
}

export class StateStore {
  readonly filePath: string;
  #state: PersistentState;
  #writeChain = Promise.resolve();

  constructor(userDataPath: string) {
    mkdirSync(userDataPath, { recursive: true });
    this.filePath = path.join(userDataPath, "claude-local-desktop.json");
    try {
      this.#state = normalizeState(
        JSON.parse(readFileSync(this.filePath, "utf8")),
      );
    } catch {
      this.#state = structuredClone(DEFAULT_STATE);
    }
  }

  snapshot(): PersistentState {
    return structuredClone(this.#state);
  }

  get<K extends keyof PersistentState>(key: K): PersistentState[K] {
    return structuredClone(this.#state[key]);
  }

  async update(
    mutator: (draft: PersistentState) => void,
  ): Promise<PersistentState> {
    let committed: PersistentState | undefined;
    const pending = this.#writeChain
      .catch(() => undefined)
      .then(async () => {
        const draft = this.snapshot();
        mutator(draft);
        const nextState = normalizeState(draft);
        const serialized = `${JSON.stringify(nextState, null, 2)}\n`;
        const directory = path.dirname(this.filePath);
        await mkdir(directory, { recursive: true });
        const temporary = `${this.filePath}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, serialized, {
            encoding: "utf8",
            mode: 0o600,
          });
          await rename(temporary, this.filePath);
        } finally {
          await rm(temporary, { force: true }).catch(() => undefined);
        }
        this.#state = nextState;
        committed = this.snapshot();
      });
    this.#writeChain = pending;
    await pending;
    return committed ?? this.snapshot();
  }
}
