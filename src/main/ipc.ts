import { app, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRELOAD_CHANNELS } from "../generated/ipc-contract";
import { IPC_VALIDATION } from "../generated/ipc-validation";
import { parseChannel } from "../shared/channels";
import { isTrustedRendererUrl, originOf } from "../shared/security";
import {
  assertContractArguments,
  contractValueMatches,
} from "../shared/validation";
import { ServiceDispatcher } from "./services";

function senderUrl(event: IpcMainEvent | IpcMainInvokeEvent): string {
  return event.senderFrame?.url ?? event.sender.getURL();
}

const CODE_TRACE_SERVICES = new Set([
  "ClaudeCode",
  "LocalSessions",
  "LocalAgentModeSessions",
]);

const REMOTE_RENDERER_SERVICES = new Set([
  "claude.internal.ui.MainWindowTitleBar",
  "claude.web.BrowserNavigation",
  "claude.web.WindowControl",
  "claude.web.WindowState",
]);

function tracedArgumentShape(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value))
    return {
      type: "array",
      length: value.length,
      items: value.slice(0, 3).map(tracedArgumentShape),
    };
  if (typeof value === "object")
    return {
      type: "object",
      keys: Object.keys(value as Record<string, unknown>).sort(),
      fields: Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .slice(0, 24)
          .map(([key, field]) => [key, tracedArgumentShape(field)]),
      ),
    };
  if (typeof value === "string")
    return { type: "string", length: value.length };
  return { type: typeof value, value };
}

function traceCodeIpc(
  parsed: ReturnType<typeof parseChannel>,
  args: unknown[],
): void {
  if (
    process.env.CLAUDE_TRACE_CODE_IPC !== "1" ||
    !parsed ||
    !CODE_TRACE_SERVICES.has(parsed.service)
  )
    return;
  console.error(
    `[code-ipc] ${parsed.service}.${parsed.method} ${JSON.stringify(args.map(tracedArgumentShape))}`,
  );
}

export function assertTrustedIpcSender(
  event: IpcMainEvent | IpcMainInvokeEvent,
): void {
  if (event.senderFrame?.parent) {
    throw new Error("Blocked desktop IPC from a child frame");
  }
  const url = senderUrl(event);
  const allowDevelopment =
    !app.isPackaged || process.env.CLAUDE_ALLOW_DEV_ORIGINS === "1";
  let trusted = isTrustedRendererUrl(url, allowDevelopment);
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") {
      const actual = path.resolve(fileURLToPath(parsed));
      const expected = path.resolve(app.getAppPath(), "dist", "index.html");
      trusted =
        process.platform === "win32"
          ? actual.toLowerCase() === expected.toLowerCase()
          : actual === expected;
    }
  } catch {
    trusted = false;
  }
  if (!trusted) {
    throw new Error(
      `Blocked desktop IPC from untrusted renderer: ${url || "[unknown]"}`,
    );
  }
}

export function assertLocalIpcSender(
  event: IpcMainEvent | IpcMainInvokeEvent,
): void {
  assertTrustedIpcSender(event);
  const url = senderUrl(event);
  if (originOf(url) !== "app://localhost")
    throw new Error(
      `Blocked local desktop IPC from non-local renderer: ${url}`,
    );
}

function assertServiceAvailableToSender(
  event: IpcMainEvent | IpcMainInvokeEvent,
  parsed: NonNullable<ReturnType<typeof parseChannel>>,
): void {
  const origin = originOf(senderUrl(event));
  if (
    origin?.startsWith("https://") &&
    !REMOTE_RENDERER_SERVICES.has(`${parsed.namespace}.${parsed.service}`)
  )
    throw new Error(
      `Blocked privileged ${parsed.namespace}.${parsed.service} IPC from hosted renderer`,
    );
}

export function registerGeneratedIpc(
  dispatcher: ServiceDispatcher,
): () => void {
  const cleanups: Array<() => void> = [];

  for (const contract of PRELOAD_CHANNELS) {
    const parsed = parseChannel(contract.channel);
    if (!parsed) continue;

    if ((contract.rendererOperations as readonly string[]).includes("invoke")) {
      ipcMain.removeHandler(contract.channel);
      ipcMain.handle(contract.channel, async (event, ...args) => {
        assertTrustedIpcSender(event);
        assertServiceAvailableToSender(event, parsed);
        const validation =
          IPC_VALIDATION[contract.channel as keyof typeof IPC_VALIDATION];
        if (validation)
          assertContractArguments(contract.channel, args, validation.arguments);
        traceCodeIpc(parsed, args);
        const result = await dispatcher.invoke(parsed, args, event);
        if (
          process.env.CLAUDE_STRICT_RESULT_VALIDATION === "1" &&
          validation?.result &&
          !contractValueMatches(result, validation.result.validation)
        )
          throw new TypeError(
            `Result failed recovered validation (${validation.result.validation}) for ${contract.channel}`,
          );
        return result;
      });
      cleanups.push(() => ipcMain.removeHandler(contract.channel));
    }

    if (
      (contract.rendererOperations as readonly string[]).includes("sendSync")
    ) {
      const listener = (event: IpcMainEvent, ...args: unknown[]) => {
        try {
          assertTrustedIpcSender(event);
          assertServiceAvailableToSender(event, parsed);
          const validation =
            IPC_VALIDATION[contract.channel as keyof typeof IPC_VALIDATION];
          if (validation)
            assertContractArguments(
              contract.channel,
              args,
              validation.arguments,
            );
          traceCodeIpc(parsed, args);
          const result = dispatcher.invoke(parsed, args);
          if (result instanceof Promise)
            throw new Error("Synchronous IPC handler returned a Promise");
          if (
            process.env.CLAUDE_STRICT_RESULT_VALIDATION === "1" &&
            validation?.result &&
            !contractValueMatches(result, validation.result.validation)
          )
            throw new TypeError(
              `Result failed recovered validation (${validation.result.validation}) for ${contract.channel}`,
            );
          event.returnValue = { result };
        } catch (error) {
          event.returnValue = {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      };
      ipcMain.on(contract.channel, listener);
      cleanups.push(() => ipcMain.removeListener(contract.channel, listener));
    }
  }

  return () => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  };
}
