// Scheduled tasks: cron-driven Code sessions run locally. Each firing
// starts a normal local code session in the task's folder with the task's
// prompt; the session carries scheduledTaskId so the native UI groups runs
// under the task. The scheduler survives restarts (next runs recompute on
// load) and runs a missed firing once instead of stacking them.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { coworkFilesDir } from "./local-code";

type JsonObject = Record<string, unknown>;

interface ScheduledTask {
  id: string;
  name: string;
  displayName: string;
  description: string;
  prompt: string;
  cronExpression: string;
  cwd: string;
  model?: string;
  permissionMode?: string;
  status: "active" | "paused" | "deleted";
  createdAt: string;
  lastRunAt: number | null;
  nextRunAt: number | null;
  runCount: number;
  lastRunSessionId?: string;
  lastRunNote?: string;
}

interface CodeSessionStarter {
  invoke(method: string, args: unknown[]): Promise<unknown> | unknown;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Next firing for the cron subset the native picker produces: numeric
// minute/hour/day-of-month/month/day-of-week fields, "*", "*/n", and
// comma lists. Returns null when the expression never matches.
export function nextCronRun(expression: string, after: number): number | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const matcher = (
    field: string,
    max: number,
  ): ((v: number) => boolean) | null => {
    if (field === "*") return () => true;
    const step = field.match(/^\*\/(\d{1,2})$/);
    if (step) {
      const n = Number(step[1]);
      return n >= 1 ? (v) => v % n === 0 : null;
    }
    const values = field.split(",").map((part) => Number(part));
    if (values.some((v) => !Number.isInteger(v) || v < 0 || v > max))
      return null;
    const set = new Set(values);
    return (v) => set.has(v);
  };
  const minute = matcher(fields[0], 59);
  const hour = matcher(fields[1], 23);
  const dayOfMonth = matcher(fields[2], 31);
  const month = matcher(fields[3], 12);
  const dayOfWeek = matcher(fields[4], 7);
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return null;
  const start = new Date(after);
  start.setSeconds(0, 0);
  const candidate = new Date(start.getTime() + 60_000);
  // Two years of minutes is the give-up horizon.
  for (let i = 0; i < 2 * 366 * 24 * 60; i += 1) {
    if (
      minute(candidate.getMinutes()) &&
      hour(candidate.getHours()) &&
      dayOfMonth(candidate.getDate()) &&
      month(candidate.getMonth() + 1) &&
      (dayOfWeek(candidate.getDay()) ||
        dayOfWeek(candidate.getDay() === 0 ? 7 : candidate.getDay()))
    )
      return candidate.getTime();
    candidate.setTime(candidate.getTime() + 60_000);
  }
  return null;
}

export class LocalScheduledTasks {
  readonly filePath: string;
  readonly #sessions: CodeSessionStarter;
  readonly #emitEvent: (event: JsonObject) => void;
  #tasks: ScheduledTask[] = [];
  #timer: ReturnType<typeof setTimeout> | null = null;
  #writeChain = Promise.resolve();
  #loaded: Promise<void>;

  constructor(
    userDataPath: string,
    sessions: CodeSessionStarter,
    emitEvent: (event: JsonObject) => void,
  ) {
    this.filePath = path.join(userDataPath, "local-scheduled-tasks.json");
    this.#sessions = sessions;
    this.#emitEvent = emitEvent;
    this.#loaded = this.#load();
  }

  async #load(): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
      if (isObject(parsed) && Array.isArray(parsed.tasks))
        this.#tasks = parsed.tasks.filter(
          isObject,
        ) as unknown as ScheduledTask[];
    } catch {
      // First run.
    }
    const now = Date.now();
    for (const task of this.#tasks) {
      if (task.status !== "active") {
        task.nextRunAt = null;
        continue;
      }
      // A firing missed while the app was closed runs once, now.
      if (task.nextRunAt !== null && task.nextRunAt <= now) {
        task.lastRunNote = "missed while the app was closed — running now";
        void this.#fire(task);
      }
      task.nextRunAt = nextCronRun(task.cronExpression, now);
    }
    this.#arm();
  }

  async #persist(): Promise<void> {
    const serialized = `${JSON.stringify({ version: 1, tasks: this.#tasks }, null, 2)}\n`;
    const pending = this.#writeChain
      .catch(() => undefined)
      .then(async () => {
        await mkdir(path.dirname(this.filePath), { recursive: true });
        const temporary = `${this.filePath}.${randomUUID()}.tmp`;
        await writeFile(temporary, serialized, "utf8");
        await rename(temporary, this.filePath);
        void rm(temporary, { force: true }).catch(() => undefined);
      });
    this.#writeChain = pending;
    await pending;
  }

  #arm(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    const upcoming = this.#tasks
      .filter((task) => task.status === "active" && task.nextRunAt !== null)
      .sort((a, b) => (a.nextRunAt ?? 0) - (b.nextRunAt ?? 0))[0];
    if (!upcoming || upcoming.nextRunAt === null) return;
    const delay = Math.max(500, upcoming.nextRunAt - Date.now());
    this.#timer = setTimeout(
      () => {
        void this.#tick();
      },
      Math.min(delay, 2_147_000_000),
    );
    this.#timer.unref?.();
  }

  async #tick(): Promise<void> {
    const now = Date.now();
    for (const task of this.#tasks) {
      if (
        task.status === "active" &&
        task.nextRunAt !== null &&
        task.nextRunAt <= now
      ) {
        task.nextRunAt = nextCronRun(task.cronExpression, now);
        await this.#fire(task);
      }
    }
    await this.#persist();
    this.#arm();
  }

  async #fire(task: ScheduledTask): Promise<void> {
    this.#emitEvent({ type: "run_started", scheduledTaskId: task.id });
    try {
      const started = (await this.#sessions.invoke("start", [
        {
          cwd: task.cwd,
          message: task.prompt,
          title: `${task.displayName} · ${new Date().toLocaleString()}`,
          scheduledTaskId: task.id,
          ...(task.model ? { model: task.model } : {}),
          ...(task.permissionMode
            ? { permissionMode: task.permissionMode }
            : {}),
        },
      ])) as { sessionId?: string };
      task.lastRunAt = Date.now();
      task.runCount += 1;
      task.lastRunSessionId = text(started?.sessionId) || undefined;
      this.#emitEvent({
        type: "run_session_created",
        scheduledTaskId: task.id,
        sessionId: task.lastRunSessionId,
      });
    } catch (error) {
      task.lastRunNote = `run failed: ${error instanceof Error ? error.message : String(error)}`;
      this.#emitEvent({
        type: "run_failed",
        scheduledTaskId: task.id,
        error: task.lastRunNote,
      });
    }
    await this.#persist();
  }

  #record(task: ScheduledTask): JsonObject {
    return {
      id: task.id,
      name: task.name,
      displayName: task.displayName,
      description: task.description,
      prompt: task.prompt,
      cronExpression: task.cronExpression,
      cwd: task.cwd,
      model: task.model ?? null,
      permissionMode: task.permissionMode ?? null,
      status: task.status,
      enabled: task.status === "active",
      createdAt: task.createdAt,
      lastRunAt: task.lastRunAt,
      nextRunAt: task.nextRunAt,
      fireAt: null,
      runCount: task.runCount,
      lastRunSessionId: task.lastRunSessionId ?? null,
      lastRunNote: task.lastRunNote ?? null,
      taskExists: true,
    };
  }

  async invoke(method: string, args: unknown[]): Promise<unknown> {
    await this.#loaded;
    switch (method) {
      case "getAllScheduledTasks":
        return this.#tasks
          .filter((task) => task.status !== "deleted")
          .map((task) => this.#record(task));
      case "createScheduledTask": {
        const params = isObject(args[0]) ? args[0] : {};
        const prompt = text(params.prompt);
        const cronExpression = text(params.cronExpression);
        // Routines created without an explicit folder run in the Cowork
        // files dir (the reference form's folder is optional).
        const cwd = text(params.cwd) || coworkFilesDir();
        if (!prompt) return null;
        await mkdir(cwd, { recursive: true }).catch(() => undefined);
        if (cronExpression && nextCronRun(cronExpression, Date.now()) === null)
          return null;
        const name = text(params.name) || `task-${randomUUID().slice(0, 8)}`;
        const task: ScheduledTask = {
          id: name,
          name,
          displayName: text(params.displayName) || name,
          description: text(params.description),
          prompt,
          cronExpression,
          cwd,
          ...(text(params.model) ? { model: text(params.model) } : {}),
          ...(text(params.permissionMode)
            ? { permissionMode: text(params.permissionMode) }
            : {}),
          status: "active",
          createdAt: new Date().toISOString(),
          lastRunAt: null,
          nextRunAt: cronExpression
            ? nextCronRun(cronExpression, Date.now())
            : null,
          runCount: 0,
        };
        this.#tasks.push(task);
        await this.#persist();
        this.#arm();
        this.#emitEvent({ type: "created", scheduledTaskId: task.id });
        return this.#record(task);
      }
      case "updateScheduledTask": {
        const params = isObject(args[0]) ? args[0] : {};
        const task = this.#tasks.find(
          (candidate) => candidate.id === text(params.scheduledTaskId),
        );
        if (!task) return null;
        if (text(params.displayName))
          task.displayName = text(params.displayName);
        if (text(params.prompt)) task.prompt = text(params.prompt);
        if (typeof params.description === "string")
          task.description = params.description.trim();
        if (text(params.cronExpression)) {
          if (nextCronRun(text(params.cronExpression), Date.now()) === null)
            return null;
          task.cronExpression = text(params.cronExpression);
        }
        if (text(params.cwd)) task.cwd = text(params.cwd);
        if (text(params.model)) task.model = text(params.model);
        if (text(params.permissionMode))
          task.permissionMode = text(params.permissionMode);
        task.nextRunAt =
          task.status === "active"
            ? nextCronRun(task.cronExpression, Date.now())
            : null;
        await this.#persist();
        this.#arm();
        this.#emitEvent({ type: "updated", scheduledTaskId: task.id });
        return this.#record(task);
      }
      case "updateScheduledTaskStatus": {
        const task = this.#tasks.find(
          (candidate) => candidate.id === text(args[0]),
        );
        const status = text(args[1]);
        if (!task || !["active", "paused", "deleted"].includes(status))
          return false;
        task.status = status as ScheduledTask["status"];
        task.nextRunAt =
          status === "active"
            ? nextCronRun(task.cronExpression, Date.now())
            : null;
        if (status === "deleted")
          this.#tasks = this.#tasks.filter((candidate) => candidate !== task);
        await this.#persist();
        this.#arm();
        this.#emitEvent({
          type: "status",
          scheduledTaskId: text(args[0]),
          status,
        });
        return true;
      }
      case "getScheduledTaskFileContent": {
        const task = this.#tasks.find(
          (candidate) => candidate.id === text(args[0]),
        );
        if (!task) return null;
        return `# ${task.displayName}\n\n${task.description ? `${task.description}\n\n` : ""}${task.prompt}\n`;
      }
      case "updateScheduledTaskFileContent": {
        const task = this.#tasks.find(
          (candidate) => candidate.id === text(args[0]),
        );
        if (!task || typeof args[1] !== "string") return false;
        task.prompt = args[1].trim();
        await this.#persist();
        return true;
      }
      case "getWatcherHistory":
        return [];
      case "markListenerReady":
        return true;
      case "clearChromePermissions":
      case "removeApprovedPermission":
        return false;
      default:
        return null;
    }
  }

  dispose(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }
}
