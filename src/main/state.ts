import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
} from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isRemovedCoworkPreference } from "../shared/removed-product";

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
      // Desktop 1.22209 exposes Browser tools as a user setting. The local
      // browser ships ready, so enable it on first run while still honoring
      // an explicit user toggle through AppPreferences.
      launchEnabled: true,
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

const MAX_STATE_BYTES = 16 * 1024 * 1024;
class StateCorruptionError extends Error {}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function readStateFile(filePath: string): string {
  const expected = realpathSync(filePath);
  if (!samePath(expected, filePath))
    throw new Error("Persistent desktop state is not a safe regular file");
  const descriptor = openSync(
    expected,
    fsConstants.O_RDONLY |
      (process.platform === "win32" ? 0 : fsConstants.O_NOFOLLOW),
  );
  try {
    const info = fstatSync(descriptor);
    if (!info.isFile())
      throw new Error("Persistent desktop state is not a regular file");
    if (info.size > MAX_STATE_BYTES)
      throw new StateCorruptionError("Persistent desktop state is too large");
    const confirmed = realpathSync(expected);
    const confirmedInfo = statSync(confirmed);
    if (
      !samePath(expected, confirmed) ||
      confirmedInfo.dev !== info.dev ||
      confirmedInfo.ino !== info.ino
    )
      throw new Error("Persistent desktop state changed while opening");
    const bytes = readFileSync(descriptor);
    if (bytes.byteLength > MAX_STATE_BYTES)
      throw new StateCorruptionError("Persistent desktop state is too large");
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      throw new StateCorruptionError(
        "Persistent desktop state contains invalid UTF-8",
        { cause: error },
      );
    }
  } finally {
    closeSync(descriptor);
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function booleanRecord(value: unknown): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(objectValue(value)).filter(
      (entry): entry is [string, boolean] =>
        Boolean(entry[0]) && typeof entry[1] === "boolean",
    ),
  );
}

function normalizeState(value: unknown): PersistentState {
  const input = objectValue(value);
  // Do not carry removed product-surface state forward through the broad
  // object spread. Older profiles may still contain these keys; they are
  // intentionally forgotten on the next normalized write.
  const {
    coworkFilesRoot: _removedFilesRoot,
    coworkGlobalInstructions: _removedInstructions,
    ...currentInput
  } = input;
  const appConfig = objectValue(input.appConfig);
  const currentPreferences = Object.fromEntries(
    Object.entries(objectValue(appConfig.preferences)).filter(
      ([key]) =>
        key !== "localAgentModeTrustedFolders" &&
        !isRemovedCoworkPreference(key),
    ),
  );
  const inputStores = objectValue(input.stores);
  const supportBundleState = objectValue(inputStores.supportBundleState);
  return {
    ...structuredClone(DEFAULT_STATE),
    ...currentInput,
    globalShortcut:
      typeof input.globalShortcut === "string" &&
      input.globalShortcut.length <= 256 &&
      !input.globalShortcut.includes("\0")
        ? input.globalShortcut
        : DEFAULT_STATE.globalShortcut,
    menuBarEnabled:
      typeof input.menuBarEnabled === "boolean"
        ? input.menuBarEnabled
        : DEFAULT_STATE.menuBarEnabled,
    locale:
      typeof input.locale === "string" && input.locale.length <= 128
        ? input.locale
        : DEFAULT_STATE.locale,
    appConfig: {
      ...DEFAULT_STATE.appConfig,
      ...appConfig,
      features: booleanRecord(appConfig.features),
      mcpServers: objectValue(appConfig.mcpServers),
      preferences: {
        ...DEFAULT_STATE.appConfig.preferences,
        ...currentPreferences,
      },
      isUsingBuiltInNodeForMcp:
        typeof appConfig.isUsingBuiltInNodeForMcp === "boolean"
          ? appConfig.isUsingBuiltInNodeForMcp
          : DEFAULT_STATE.appConfig.isUsingBuiltInNodeForMcp,
      isDxtAutoUpdatesEnabled:
        typeof appConfig.isDxtAutoUpdatesEnabled === "boolean"
          ? appConfig.isDxtAutoUpdatesEnabled
          : DEFAULT_STATE.appConfig.isDxtAutoUpdatesEnabled,
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
  #closed = false;

  constructor(userDataPath: string) {
    mkdirSync(userDataPath, { recursive: true });
    this.filePath = path.join(userDataPath, "claude-local-desktop.json");
    try {
      this.#state = normalizeState(JSON.parse(readStateFile(this.filePath)));
    } catch (error) {
      // Preserve corrupt state instead of silently overwriting the only copy
      // on the next successful update. Missing first-run files are normal.
      let existing: ReturnType<typeof statSync> | null = null;
      try {
        existing = lstatSync(this.filePath);
      } catch (inspectError) {
        if ((inspectError as NodeJS.ErrnoException).code !== "ENOENT")
          throw error;
      }
      if (existing) {
        // Access errors and path changes are not evidence of corrupt content.
        // Keep the original profile in place and let startup report the failure.
        if (
          !existing.isFile() ||
          !(
            error instanceof SyntaxError ||
            error instanceof StateCorruptionError
          )
        )
          throw error;
        try {
          renameSync(
            this.filePath,
            `${this.filePath}.corrupt-${new Date()
              .toISOString()
              .replace(/[:.]/g, "-")}-${randomUUID()}`,
          );
        } catch (quarantineError) {
          throw new Error("Unable to quarantine corrupt desktop state", {
            cause: quarantineError,
          });
        }
      } else if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw error;
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
    if (this.#closed) throw new Error("Persistent desktop state is closed");
    let committed: PersistentState | undefined;
    const pending = this.#writeChain
      .catch(() => undefined)
      .then(async () => {
        const draft = this.snapshot();
        mutator(draft);
        const nextState = normalizeState(draft);
        const serialized = `${JSON.stringify(nextState, null, 2)}\n`;
        if (Buffer.byteLength(serialized, "utf8") > MAX_STATE_BYTES)
          throw new Error("Persistent desktop state is too large");
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

  async flush(): Promise<void> {
    await this.#writeChain;
  }

  async dispose(): Promise<void> {
    this.#closed = true;
    await this.flush();
  }
}
