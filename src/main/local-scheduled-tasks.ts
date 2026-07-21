// Scheduled tasks: cron-driven Code sessions run locally. Each firing
// starts a normal local code session in the task's folder with the task's
// prompt; the session carries scheduledTaskId so the native UI groups runs
// under the task. The scheduler survives restarts (next runs recompute on
// load) and runs a missed firing once instead of stacking them.

import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { localRoutinesDir } from "./local-code";
import {
  assertBoundedJson,
  readRecoverableBoundedJsonFile,
} from "./bounded-json-file";

type JsonObject = Record<string, unknown>;
const MAX_TASKS = 1_000;
const MAX_TASK_PROMPT_CHARS = 1_000_000;
const MAX_TASK_NAME_CHARS = 256;
const MAX_TASK_DESCRIPTION_CHARS = 20_000;
const MAX_TASK_MODEL_CHARS = 512;
const MAX_CRON_EXPRESSION_CHARS = 1_024;
const MAX_TASK_PATH_CHARS = 32_768;
const PERMISSION_MODES = new Set([
  "default",
  "acceptEdits",
  "plan",
  "bypassPermissions",
  "dontAsk",
  "auto",
]);

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
  pendingRunAt: number | null;
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

function finiteNonnegative(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(value, Number.MAX_SAFE_INTEGER)
    : fallback;
}

function scheduledRunSessionId(taskId: string, runAt: number): string {
  return `scheduled-${createHash("sha256")
    .update(`${taskId}\0${runAt}`)
    .digest("hex")
    .slice(0, 40)}`;
}

function optionalTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

// Next firing for the cron subset the native picker produces: numeric
// minute/hour/day-of-month/month/day-of-week fields, "*", steps, ranges,
// and comma lists. Returns null when the expression never matches.
export function nextCronRun(expression: string, after: number): number | null {
  if (
    typeof expression !== "string" ||
    expression.length > MAX_CRON_EXPRESSION_CHARS ||
    !Number.isFinite(after)
  )
    return null;
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const matcher = (
    field: string,
    min: number,
    max: number,
  ): ((v: number) => boolean) | null => {
    const matchPart = (part: string): ((v: number) => boolean) | null => {
      const [base, stepText, ...extra] = part.split("/");
      if (extra.length > 0) return null;
      const step = stepText === undefined ? 1 : Number(stepText);
      if (!Number.isInteger(step) || step < 1) return null;
      let start = min;
      let end = max;
      if (base !== "*") {
        const range = base.match(/^(\d+)-(\d+)$/);
        if (range) {
          start = Number(range[1]);
          end = Number(range[2]);
        } else if (/^\d+$/.test(base)) {
          start = Number(base);
          end = stepText === undefined ? start : max;
        } else {
          return null;
        }
      }
      if (start < min || end > max || start > end) return null;
      return (value) =>
        value >= start && value <= end && (value - start) % step === 0;
    };
    const parts = field.split(",");
    if (parts.some((part) => !part)) return null;
    const predicates = parts.map(matchPart);
    if (predicates.some((predicate) => predicate === null)) return null;
    return (value) => predicates.some((predicate) => predicate?.(value));
  };
  const minute = matcher(fields[0], 0, 59);
  const hour = matcher(fields[1], 0, 23);
  const dayOfMonth = matcher(fields[2], 1, 31);
  const month = matcher(fields[3], 1, 12);
  const dayOfWeek = matcher(fields[4], 0, 7);
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return null;
  const minutes = Array.from({ length: 60 }, (_, value) => value).filter(
    minute,
  );
  const hours = Array.from({ length: 24 }, (_, value) => value).filter(hour);
  const start = new Date(after);
  start.setSeconds(0, 0);
  const firstMinute = start.getTime() + 60_000;
  const candidateDay = new Date(firstMinute);
  candidateDay.setHours(0, 0, 0, 0);
  // Calendar matching avoids a multi-million-iteration minute scan for
  // sparse schedules. Eight years covers the longest possible wait in this
  // numeric five-field subset (including February 29 after a leap year).
  for (let dayOffset = 0; dayOffset <= 8 * 366; dayOffset += 1) {
    const candidate = new Date(candidateDay);
    candidate.setDate(candidateDay.getDate() + dayOffset);
    const dayOfMonthMatches = dayOfMonth(candidate.getDate());
    const dayOfWeekMatches =
      dayOfWeek(candidate.getDay()) ||
      dayOfWeek(candidate.getDay() === 0 ? 7 : candidate.getDay());
    // Vixie-cron semantics: when both day fields are restricted, either may
    // select the day. A field beginning with the wildcard (including */1 and
    // other stepped wildcards) leaves the other day field in control.
    const dayMatches =
      fields[2].startsWith("*") || fields[4].startsWith("*")
        ? dayOfMonthMatches && dayOfWeekMatches
        : dayOfMonthMatches || dayOfWeekMatches;
    if (!month(candidate.getMonth() + 1) || !dayMatches) continue;
    for (const candidateHour of hours) {
      for (const candidateMinute of minutes) {
        const firing = new Date(
          candidate.getFullYear(),
          candidate.getMonth(),
          candidate.getDate(),
          candidateHour,
          candidateMinute,
          0,
          0,
        );
        // Spring-forward gaps normalize to a different wall-clock time.
        if (
          firing.getHours() !== candidateHour ||
          firing.getMinutes() !== candidateMinute ||
          firing.getTime() < firstMinute
        )
          continue;
        return firing.getTime();
      }
    }
  }
  return null;
}

export class LocalScheduledTasks {
  readonly filePath: string;
  readonly #sessions: CodeSessionStarter;
  readonly #emitEvent: (event: JsonObject) => void;
  #tasks: ScheduledTask[] = [];
  #timer: ReturnType<typeof setTimeout> | null = null;
  #timerWork: Promise<void> = Promise.resolve();
  #writeChain = Promise.resolve();
  #operationChain = Promise.resolve();
  #loaded: Promise<void>;
  #disposed = false;

  constructor(
    userDataPath: string,
    sessions: CodeSessionStarter,
    emitEvent: (event: JsonObject) => void,
  ) {
    this.filePath = path.join(userDataPath, "local-scheduled-tasks.json");
    this.#sessions = sessions;
    this.#emitEvent = emitEvent;
    this.#loaded = this.#load();
    // Attach a rejection observer immediately. IPC calls still receive the
    // original rejected promise through their readiness await, but a delayed
    // first caller cannot turn a startup I/O failure into an unhandled
    // rejection warning in the meantime.
    void this.#loaded.catch(() => undefined);
  }

  async #replaceStore(temporary: string): Promise<void> {
    const retryable = new Set(["EACCES", "EBUSY", "EPERM"]);
    for (let attempt = 0; ; attempt += 1) {
      try {
        await rename(temporary, this.filePath);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code ?? "";
        if (
          process.platform !== "win32" ||
          !retryable.has(code) ||
          attempt >= 8
        )
          throw error;
        // Windows can deny replacement briefly while antivirus, indexing, or
        // another local reader has the old JSON file open. Keep the temp file
        // and retry the same atomic replacement with a short bounded backoff.
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(250, 10 * 2 ** attempt)),
        );
      }
    }
  }

  async #load(): Promise<void> {
    const parsed = await readRecoverableBoundedJsonFile(
      this.filePath,
      16 * 1024 * 1024,
      "local scheduled-task store",
    );
    if (isObject(parsed) && Array.isArray(parsed.tasks)) {
      const seen = new Set<string>();
      this.#tasks = parsed.tasks.slice(-MAX_TASKS).flatMap((value) => {
        const task = this.#normalizeTask(value);
        if (!task || seen.has(task.id)) return [];
        seen.add(task.id);
        return [task];
      });
    }
    const now = Date.now();
    for (const task of this.#tasks) {
      if (this.#disposed) return;
      if (task.status !== "active") {
        task.nextRunAt = null;
        task.pendingRunAt = null;
        continue;
      }
      if (task.pendingRunAt !== null) {
        // A persisted pending occurrence is an outbox entry. Its deterministic
        // session id lets recovery distinguish "not started" from "started
        // but the task record was not committed" without duplicating work.
        if (task.nextRunAt !== null && task.nextRunAt <= now)
          task.nextRunAt = nextCronRun(task.cronExpression, now);
        await this.#persist();
        await this.#fire(task);
        continue;
      }
      // A firing missed while the app was closed runs once, now.
      if (task.nextRunAt !== null && task.nextRunAt <= now) {
        task.lastRunNote = "missed while the app was closed — running now";
        task.pendingRunAt = task.nextRunAt;
        task.nextRunAt = nextCronRun(task.cronExpression, now);
        // Persist the new schedule before launching the external session. If
        // the process crashes after start(), the missed run is not repeated
        // on the next app launch.
        await this.#persist();
        // Loading is the scheduler's readiness barrier. Await the catch-up run
        // (including its atomic persistence) so callers cannot observe a
        // half-finished run or tear down the profile while its temp file is
        // still being renamed.
        await this.#fire(task);
        continue;
      }
      task.nextRunAt = nextCronRun(task.cronExpression, now);
    }
    if (!this.#disposed) this.#arm();
  }

  async #persist(): Promise<void> {
    const serialized = `${JSON.stringify({ version: 1, tasks: this.#tasks }, null, 2)}\n`;
    assertBoundedJson(
      serialized,
      16 * 1024 * 1024,
      "local scheduled-task store",
    );
    const pending = this.#writeChain
      .catch(() => undefined)
      .then(async () => {
        await mkdir(path.dirname(this.filePath), { recursive: true });
        const temporary = `${this.filePath}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, serialized, {
            encoding: "utf8",
            mode: 0o600,
          });
          await this.#replaceStore(temporary);
        } finally {
          await rm(temporary, { force: true }).catch(() => undefined);
        }
      });
    this.#writeChain = pending;
    await pending;
  }

  #arm(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    if (this.#disposed) return;
    const upcoming = this.#tasks
      .filter(
        (task) =>
          task.status === "active" &&
          (task.pendingRunAt !== null || task.nextRunAt !== null),
      )
      .sort(
        (a, b) =>
          (a.pendingRunAt !== null ? 0 : (a.nextRunAt ?? 0)) -
          (b.pendingRunAt !== null ? 0 : (b.nextRunAt ?? 0)),
      )[0];
    if (!upcoming) return;
    const delay =
      upcoming.pendingRunAt !== null
        ? 500
        : Math.max(500, (upcoming.nextRunAt ?? Date.now()) - Date.now());
    this.#timer = setTimeout(
      () => {
        this.#timer = null;
        this.#timerWork = this.#serialize(() => this.#tick())
          .catch((error) => {
            this.#emitEvent({
              type: "scheduler_error",
              error: error instanceof Error ? error.message : String(error),
            });
          })
          .finally(() => {
            if (!this.#disposed) this.#arm();
          });
      },
      Math.min(delay, 2_147_000_000),
    );
    this.#timer.unref?.();
  }

  async #tick(): Promise<void> {
    if (this.#disposed) return;
    const now = Date.now();
    for (const task of this.#tasks) {
      if (this.#disposed) return;
      if (task.status === "active" && task.pendingRunAt !== null) {
        await this.#persist();
        await this.#fire(task);
        continue;
      }
      if (
        task.status === "active" &&
        task.nextRunAt !== null &&
        task.nextRunAt <= now
      ) {
        task.pendingRunAt = task.nextRunAt;
        task.nextRunAt = nextCronRun(task.cronExpression, now);
        await this.#persist();
        await this.#fire(task);
      }
    }
  }

  async #fire(task: ScheduledTask): Promise<void> {
    if (this.#disposed || task.pendingRunAt === null) return;
    const requestedSessionId = scheduledRunSessionId(
      task.id,
      task.pendingRunAt,
    );
    const previous = { ...task };
    this.#emitEvent({ type: "run_started", scheduledTaskId: task.id });
    let terminalEvent: JsonObject;
    try {
      const existing = await this.#sessions.invoke("getSession", [
        requestedSessionId,
      ]);
      const started =
        isObject(existing) &&
        text(existing.sessionId) === requestedSessionId &&
        text(existing.scheduledTaskId) === task.id
          ? existing
          : ((await this.#sessions.invoke("start", [
              {
                sessionId: requestedSessionId,
                cwd: task.cwd,
                message: task.prompt,
                title: `${task.displayName} · ${new Date().toLocaleString()}`,
                scheduledTaskId: task.id,
                ...(task.model ? { model: task.model } : {}),
                // Scheduled runs are unattended: there is no one to approve
                // tool permission prompts, so a task that runs Bash would
                // otherwise stall forever. Auto-approve unless explicitly
                // pinned to a stricter mode.
                permissionMode: task.permissionMode ?? "bypassPermissions",
              },
            ])) as { sessionId?: string });
      const sessionId = isObject(started)
        ? text(started.sessionId).slice(0, 256)
        : "";
      if (!sessionId)
        throw new Error("Code session did not return a session id");
      if (sessionId !== requestedSessionId)
        throw new Error(
          "Code session did not honor the scheduler's deterministic session id",
        );
      task.lastRunAt = Date.now();
      task.runCount = Math.min(task.runCount + 1, Number.MAX_SAFE_INTEGER);
      task.lastRunSessionId = sessionId;
      task.pendingRunAt = null;
      if (!task.lastRunNote?.startsWith("missed while"))
        delete task.lastRunNote;
      terminalEvent = {
        type: "run_session_created",
        scheduledTaskId: task.id,
        sessionId: task.lastRunSessionId,
      };
    } catch (error) {
      task.pendingRunAt = null;
      task.lastRunNote =
        `run failed: ${error instanceof Error ? error.message : String(error)}`.slice(
          0,
          MAX_TASK_DESCRIPTION_CHARS,
        );
      terminalEvent = {
        type: "run_failed",
        scheduledTaskId: task.id,
        error: task.lastRunNote,
      };
    }
    try {
      await this.#persist();
    } catch (error) {
      Object.assign(task, previous);
      if (previous.lastRunSessionId === undefined) delete task.lastRunSessionId;
      if (previous.lastRunNote === undefined) delete task.lastRunNote;
      throw error;
    }
    this.#emitEvent(terminalEvent);
  }

  #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.#operationChain.catch(() => undefined).then(operation);
    this.#operationChain = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  #normalizeTask(value: unknown): ScheduledTask | null {
    if (!isObject(value)) return null;
    const id = text(value.id || value.name);
    const prompt = text(value.prompt);
    const cronExpression = text(value.cronExpression);
    const cwd = text(value.cwd);
    if (
      !id ||
      id.length > 256 ||
      !prompt ||
      prompt.length > MAX_TASK_PROMPT_CHARS ||
      !cronExpression ||
      cronExpression.length > MAX_CRON_EXPRESSION_CHARS ||
      nextCronRun(cronExpression, Date.now()) === null ||
      !cwd ||
      cwd.length > MAX_TASK_PATH_CHARS
    )
      return null;
    const status = ["active", "paused", "deleted"].includes(text(value.status))
      ? (text(value.status) as ScheduledTask["status"])
      : "paused";
    return {
      id,
      name: (text(value.name) || id).slice(0, MAX_TASK_NAME_CHARS),
      displayName: (text(value.displayName) || text(value.name) || id).slice(
        0,
        MAX_TASK_NAME_CHARS,
      ),
      description: text(value.description).slice(0, MAX_TASK_DESCRIPTION_CHARS),
      prompt,
      cronExpression,
      cwd: path.resolve(cwd),
      ...(text(value.model)
        ? { model: text(value.model).slice(0, MAX_TASK_MODEL_CHARS) }
        : {}),
      ...(PERMISSION_MODES.has(text(value.permissionMode))
        ? { permissionMode: text(value.permissionMode) }
        : {}),
      status,
      createdAt:
        typeof value.createdAt === "string" &&
        Number.isFinite(Date.parse(value.createdAt))
          ? value.createdAt
          : new Date(0).toISOString(),
      lastRunAt: optionalTimestamp(value.lastRunAt),
      nextRunAt: optionalTimestamp(value.nextRunAt),
      pendingRunAt: optionalTimestamp(value.pendingRunAt),
      runCount: Math.floor(finiteNonnegative(value.runCount, 0)),
      ...(text(value.lastRunSessionId)
        ? { lastRunSessionId: text(value.lastRunSessionId).slice(0, 256) }
        : {}),
      ...(text(value.lastRunNote)
        ? {
            lastRunNote: text(value.lastRunNote).slice(
              0,
              MAX_TASK_DESCRIPTION_CHARS,
            ),
          }
        : {}),
    };
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
    if (this.#disposed) throw new Error("Scheduled task manager is disposed");
    return this.#serialize(() => this.#invoke(method, args));
  }

  async #invoke(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case "getAllScheduledTasks":
        return this.#tasks
          .filter((task) => task.status !== "deleted")
          .map((task) => this.#record(task));
      case "createScheduledTask": {
        const params = isObject(args[0]) ? args[0] : {};
        const prompt = text(params.prompt);
        const cronExpression = text(params.cronExpression);
        const cwdInput = text(params.cwd);
        // The routine form's folder is optional; use an Open-Claude-owned
        // workspace when none was selected.
        const cwd = path.resolve(cwdInput || localRoutinesDir());
        if (
          !prompt ||
          prompt.length > MAX_TASK_PROMPT_CHARS ||
          !cronExpression ||
          cronExpression.length > MAX_CRON_EXPRESSION_CHARS ||
          cwdInput.length > MAX_TASK_PATH_CHARS ||
          (typeof params.permissionMode === "string" &&
            !PERMISSION_MODES.has(text(params.permissionMode))) ||
          this.#tasks.length >= MAX_TASKS
        )
          return null;
        if (nextCronRun(cronExpression, Date.now()) === null) return null;
        const name = text(params.name) || `task-${randomUUID().slice(0, 8)}`;
        if (
          name.length > MAX_TASK_NAME_CHARS ||
          this.#tasks.some((candidate) => candidate.id === name)
        )
          return null;
        try {
          await mkdir(cwd, { recursive: true });
          if (!(await stat(cwd)).isDirectory()) return null;
        } catch {
          return null;
        }
        const task: ScheduledTask = {
          id: name,
          name,
          displayName: (text(params.displayName) || name).slice(
            0,
            MAX_TASK_NAME_CHARS,
          ),
          description: text(params.description).slice(
            0,
            MAX_TASK_DESCRIPTION_CHARS,
          ),
          prompt,
          cronExpression,
          cwd,
          ...(text(params.model)
            ? { model: text(params.model).slice(0, MAX_TASK_MODEL_CHARS) }
            : {}),
          ...(PERMISSION_MODES.has(text(params.permissionMode))
            ? { permissionMode: text(params.permissionMode) }
            : {}),
          status: "active",
          createdAt: new Date().toISOString(),
          lastRunAt: null,
          nextRunAt: nextCronRun(cronExpression, Date.now()),
          pendingRunAt: null,
          runCount: 0,
        };
        this.#tasks.push(task);
        try {
          await this.#persist();
        } catch (error) {
          this.#tasks = this.#tasks.filter((candidate) => candidate !== task);
          throw error;
        }
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
        const updated = { ...task };
        if (text(params.displayName))
          updated.displayName = text(params.displayName).slice(
            0,
            MAX_TASK_NAME_CHARS,
          );
        if (typeof params.prompt === "string") {
          const prompt = text(params.prompt);
          if (!prompt || prompt.length > MAX_TASK_PROMPT_CHARS) return null;
          updated.prompt = prompt;
        }
        if (typeof params.description === "string")
          updated.description = params.description
            .trim()
            .slice(0, MAX_TASK_DESCRIPTION_CHARS);
        if (typeof params.cronExpression === "string") {
          const expression = text(params.cronExpression);
          if (
            !expression ||
            expression.length > MAX_CRON_EXPRESSION_CHARS ||
            nextCronRun(expression, Date.now()) === null
          )
            return null;
          updated.cronExpression = expression;
        }
        if (typeof params.cwd === "string") {
          const cwdInput = text(params.cwd);
          if (!cwdInput || cwdInput.length > MAX_TASK_PATH_CHARS) return null;
          const cwd = path.resolve(cwdInput);
          try {
            if (!(await stat(cwd)).isDirectory()) return null;
          } catch {
            return null;
          }
          updated.cwd = cwd;
        }
        if (typeof params.model === "string") {
          const model = text(params.model);
          if (model) updated.model = model.slice(0, MAX_TASK_MODEL_CHARS);
          else delete updated.model;
        }
        if (PERMISSION_MODES.has(text(params.permissionMode)))
          updated.permissionMode = text(params.permissionMode);
        else if (typeof params.permissionMode === "string") return null;
        updated.nextRunAt =
          updated.status === "active"
            ? nextCronRun(updated.cronExpression, Date.now())
            : null;
        const previous = { ...task };
        Object.assign(task, updated);
        try {
          await this.#persist();
        } catch (error) {
          Object.assign(task, previous);
          throw error;
        }
        this.#arm();
        this.#emitEvent({ type: "updated", scheduledTaskId: task.id });
        return this.#record(task);
      }
      case "updateScheduledTaskStatus": {
        const task = this.#tasks.find(
          (candidate) => candidate.id === text(args[0]),
        );
        const requestedStatus = text(args[1]);
        // The retained Scheduled details UI uses enabled/disabled while the
        // local scheduler historically used active/paused. Normalize both at
        // the IPC boundary so either the native UI or the local workbench can
        // control the same persisted task.
        const status =
          requestedStatus === "enabled"
            ? "active"
            : requestedStatus === "disabled"
              ? "paused"
              : requestedStatus;
        if (!task || !["active", "paused", "deleted"].includes(status))
          return false;
        const previousTasks = this.#tasks;
        const previousStatus = task.status;
        const previousNextRunAt = task.nextRunAt;
        const previousPendingRunAt = task.pendingRunAt;
        task.status = status as ScheduledTask["status"];
        task.nextRunAt =
          status === "active"
            ? nextCronRun(task.cronExpression, Date.now())
            : null;
        // A paused/deleted task cannot retain an outbox occurrence that would
        // be replayed if the record is later reactivated or recovered.
        if (status !== "active") task.pendingRunAt = null;
        if (status === "deleted")
          this.#tasks = this.#tasks.filter((candidate) => candidate !== task);
        try {
          await this.#persist();
        } catch (error) {
          this.#tasks = previousTasks;
          task.status = previousStatus;
          task.nextRunAt = previousNextRunAt;
          task.pendingRunAt = previousPendingRunAt;
          throw error;
        }
        this.#arm();
        this.#emitEvent({
          type: "status",
          scheduledTaskId: text(args[0]),
          status: task.status,
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
        const prompt = args[1].trim();
        if (!prompt || prompt.length > MAX_TASK_PROMPT_CHARS) return false;
        const previous = task.prompt;
        task.prompt = prompt;
        try {
          await this.#persist();
        } catch (error) {
          task.prompt = previous;
          throw error;
        }
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

  async dispose(): Promise<void> {
    this.#disposed = true;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    // Loading may include a missed catch-up run, while timerWork covers a
    // firing that began just before disposal. Await both and the final write
    // queue so tests, profile cleanup, and orderly shutdown cannot race the
    // atomic rename.
    await Promise.allSettled([
      this.#loaded,
      this.#timerWork,
      this.#operationChain,
    ]);
    await this.#writeChain.catch(() => undefined);
  }
}
