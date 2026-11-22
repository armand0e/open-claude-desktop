import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LocalScheduledTasks,
  nextCronRun,
  shouldRetryScheduledStoreReplace,
} from "../src/main/local-scheduled-tasks";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("nextCronRun", () => {
  it("computes upcoming firings for the supported subset", () => {
    const base = new Date("2026-07-17T10:30:30Z").getTime();
    const everyMinute = nextCronRun("* * * * *", base)!;
    expect(everyMinute).toBeGreaterThan(base);
    expect(everyMinute - base).toBeLessThanOrEqual(90_000);
    const daily = new Date(nextCronRun("0 9 * * *", base)!);
    expect(daily.getHours()).toBe(9);
    expect(daily.getMinutes()).toBe(0);
    expect(nextCronRun("*/15 * * * *", base)! % (60_000 * 15)).toBeDefined();
    expect(nextCronRun("nonsense", base)).toBeNull();
    expect(nextCronRun("99 * * * *", base)).toBeNull();
    expect(nextCronRun(`${"*".repeat(1_025)} * * * *`, base)).toBeNull();
  });

  it("accepts weekday ranges emitted by the native routine picker", () => {
    const friday = new Date(2026, 6, 17, 12, 0, 0).getTime();
    const next = new Date(nextCronRun("30 8 * * 1-5", friday)!);
    expect(next.getDay()).toBe(1);
    expect(next.getHours()).toBe(8);
    expect(next.getMinutes()).toBe(30);
  });

  it("implements cron day-field and numeric-step semantics", () => {
    const wednesday = new Date(2026, 6, 1, 0, 0, 0).getTime();
    const mondayOrFifteenth = new Date(nextCronRun("0 9 15 * 1", wednesday)!);
    expect(mondayOrFifteenth.getDay()).toBe(1);
    expect(mondayOrFifteenth.getDate()).toBe(6);

    const afterSix = new Date(2026, 6, 1, 10, 6, 0).getTime();
    const stepped = new Date(nextCronRun("5/20 * * * *", afterSix)!);
    expect(stepped.getMinutes()).toBe(25);

    const tuesday = new Date(2026, 6, 7, 10, 0, 0).getTime();
    const wildcardStepWithMonday = new Date(
      nextCronRun("0 9 */1 * 1", tuesday)!,
    );
    expect(wildcardStepWithMonday.getDay()).toBe(1);
    expect(wildcardStepWithMonday.getDate()).toBe(13);
    expect(nextCronRun("* * * * *", Number.NaN)).toBeNull();
  });

  it("finds leap-day schedules more than two years away", () => {
    const afterLeapDay = new Date(2028, 2, 1, 0, 0, 0).getTime();
    const next = new Date(nextCronRun("0 9 29 2 *", afterLeapDay)!);
    expect(next.getFullYear()).toBe(2032);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(29);
    expect(next.getHours()).toBe(9);
  });

  it("skips nonexistent wall-clock times across a DST spring-forward gap", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const beforeGap = new Date(2026, 2, 8, 1, 59, 0).getTime();
      const next = new Date(nextCronRun("30 2 * * *", beforeGap)!);
      expect(next.getDate()).toBe(9);
      expect(next.getHours()).toBe(2);
      expect(next.getMinutes()).toBe(30);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it("makes the Windows atomic-replace retry matrix explicit", () => {
    expect(shouldRetryScheduledStoreReplace("win32", "EACCES", 0)).toBe(true);
    expect(shouldRetryScheduledStoreReplace("win32", "EBUSY", 7)).toBe(true);
    expect(shouldRetryScheduledStoreReplace("win32", "EPERM", 8)).toBe(false);
    expect(shouldRetryScheduledStoreReplace("win32", "ENOSPC", 0)).toBe(false);
    expect(shouldRetryScheduledStoreReplace("linux", "EACCES", 0)).toBe(false);
  });
});

describe("LocalScheduledTasks", () => {
  it("creates, lists, updates, and runs missed tasks on load", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "sched-"));
    temporaryDirectories.push(directory);
    const started: Array<Record<string, unknown>> = [];
    const events: Array<Record<string, unknown>> = [];
    const starter = {
      invoke: async (method: string, args: unknown[]) => {
        if (method === "start") {
          started.push(args[0] as Record<string, unknown>);
          return { sessionId: String(started.at(-1)?.sessionId) };
        }
        return undefined;
      },
    };

    const manager = new LocalScheduledTasks(directory, starter, (event) =>
      events.push(event as Record<string, unknown>),
    );
    const created = (await manager.invoke("createScheduledTask", [
      {
        name: "nightly-review",
        prompt: "Review the repo and summarize changes.",
        description: "Nightly",
        cronExpression: "0 3 * * *",
        cwd: directory,
      },
    ])) as Record<string, unknown>;
    expect(created).not.toBeNull();
    expect(created.status).toBe("active");
    expect(created.nextRunAt).toBeGreaterThan(Date.now());
    expect(
      await manager.invoke("createScheduledTask", [
        { name: "never-runs", prompt: "No schedule", cwd: directory },
      ]),
    ).toBeNull();
    expect(
      await manager.invoke("createScheduledTask", [
        {
          name: "invalid-permissions",
          prompt: "Must not silently broaden permissions",
          cronExpression: "0 4 * * *",
          cwd: directory,
          permissionMode: "unrestricted",
        },
      ]),
    ).toBeNull();
    expect(
      await manager.invoke("createScheduledTask", [
        {
          name: "nightly-review",
          prompt: "Duplicate",
          cronExpression: "0 4 * * *",
          cwd: directory,
        },
      ]),
    ).toBeNull();

    const all = (await manager.invoke("getAllScheduledTasks", [])) as Array<
      Record<string, unknown>
    >;
    expect(all).toHaveLength(1);
    expect(all[0].displayName).toBe("nightly-review");

    const updated = (await manager.invoke("updateScheduledTask", [
      { scheduledTaskId: "nightly-review", displayName: "Nightly review" },
    ])) as Record<string, unknown>;
    expect(updated.displayName).toBe("Nightly review");

    expect(
      await manager.invoke("updateScheduledTaskStatus", [
        "nightly-review",
        "disabled",
      ]),
    ).toBe(true);
    const paused = (await manager.invoke("getAllScheduledTasks", [])) as Array<
      Record<string, unknown>
    >;
    expect(paused[0].enabled).toBe(false);
    expect(paused[0].nextRunAt).toBeNull();

    expect(
      await manager.invoke("updateScheduledTaskStatus", [
        "nightly-review",
        "enabled",
      ]),
    ).toBe(true);
    const reenabled = (await manager.invoke(
      "getAllScheduledTasks",
      [],
    )) as Array<Record<string, unknown>>;
    expect(reenabled[0].enabled).toBe(true);
    expect(reenabled[0].status).toBe("active");
    expect(reenabled[0].nextRunAt).toEqual(expect.any(Number));

    expect(
      await manager.invoke("updateScheduledTaskStatus", [
        "nightly-review",
        "not-a-status",
      ]),
    ).toBe(false);

    const content = (await manager.invoke("getScheduledTaskFileContent", [
      "nightly-review",
    ])) as string;
    expect(content).toContain("Review the repo");
    await manager.dispose();

    // A task whose firing was missed while the app was closed runs once on
    // load and reschedules.
    const missedStore = {
      version: 1,
      tasks: [
        {
          id: "missed-task",
          name: "missed-task",
          displayName: "Missed task",
          description: "",
          prompt: "Run the missed job.",
          cronExpression: "* * * * *",
          cwd: directory,
          status: "active",
          createdAt: new Date().toISOString(),
          lastRunAt: null,
          nextRunAt: Date.now() - 60_000,
          runCount: 0,
        },
      ],
    };
    const directory2 = await mkdtemp(path.join(os.tmpdir(), "sched2-"));
    temporaryDirectories.push(directory2);
    await writeFile(
      path.join(directory2, "local-scheduled-tasks.json"),
      JSON.stringify(missedStore),
    );
    const reopened = new LocalScheduledTasks(directory2, starter, (event) =>
      events.push(event as Record<string, unknown>),
    );
    // invoke() is the readiness barrier: the catch-up run and its persistence
    // must be complete before records are returned.
    const records = (await reopened.invoke(
      "getAllScheduledTasks",
      [],
    )) as Array<Record<string, unknown>>;
    expect(started).toHaveLength(1);
    expect(started[0].scheduledTaskId).toBe("missed-task");
    expect(started[0].message).toBe("Run the missed job.");
    expect(records[0].runCount).toBe(1);
    expect(records[0].lastRunSessionId).toMatch(/^scheduled-[a-f0-9]{40}$/);
    expect(records[0].nextRunAt).toBeGreaterThan(Date.now() - 60_000);
    expect(events.some((event) => event.type === "run_session_created")).toBe(
      true,
    );
    await reopened.dispose();
  });

  it("quarantines malformed and duplicate persisted task records", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "sched-bad-"));
    temporaryDirectories.push(directory);
    const valid = {
      id: "valid",
      name: "valid",
      displayName: "Valid",
      description: "",
      prompt: "Do the work",
      cronExpression: "0 9 * * 1-5",
      cwd: directory,
      status: "paused",
      createdAt: new Date().toISOString(),
      lastRunAt: null,
      nextRunAt: null,
      runCount: 0,
    };
    await writeFile(
      path.join(directory, "local-scheduled-tasks.json"),
      JSON.stringify({
        version: 1,
        tasks: [
          { id: "broken", status: "active" },
          valid,
          { ...valid, displayName: "Duplicate" },
        ],
      }),
    );
    const manager = new LocalScheduledTasks(
      directory,
      { invoke: async () => ({ sessionId: "unexpected" }) },
      () => undefined,
    );
    const tasks = (await manager.invoke("getAllScheduledTasks", [])) as Array<
      Record<string, unknown>
    >;
    expect(tasks).toHaveLength(1);
    expect(tasks[0].displayName).toBe("Valid");
    await manager.dispose();
  });

  it("records a failed run when session creation returns no id", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "sched-no-id-"));
    temporaryDirectories.push(directory);
    await writeFile(
      path.join(directory, "local-scheduled-tasks.json"),
      JSON.stringify({
        version: 1,
        tasks: [
          {
            id: "missing-session",
            name: "missing-session",
            displayName: "Missing session",
            description: "",
            prompt: "Run",
            cronExpression: "* * * * *",
            cwd: directory,
            status: "active",
            createdAt: new Date().toISOString(),
            lastRunAt: null,
            nextRunAt: Date.now() - 60_000,
            runCount: 0,
          },
        ],
      }),
    );
    const events: Array<Record<string, unknown>> = [];
    const manager = new LocalScheduledTasks(
      directory,
      { invoke: async () => ({}) },
      (event) => events.push(event),
    );
    const tasks = (await manager.invoke("getAllScheduledTasks", [])) as Array<
      Record<string, unknown>
    >;
    expect(tasks[0].runCount).toBe(0);
    expect(tasks[0].lastRunAt).toBeNull();
    expect(tasks[0].lastRunNote).toMatch(/did not return a session id/);
    expect(events.some((event) => event.type === "run_failed")).toBe(true);
    await manager.dispose();
  });

  it("recovers a persisted pending run without duplicating its Code session", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "sched-recover-"));
    temporaryDirectories.push(directory);
    const pendingRunAt = Date.now() - 60_000;
    await writeFile(
      path.join(directory, "local-scheduled-tasks.json"),
      JSON.stringify({
        version: 1,
        tasks: [
          {
            id: "recover-me",
            name: "recover-me",
            displayName: "Recover me",
            description: "",
            prompt: "Run exactly once",
            cronExpression: "* * * * *",
            cwd: directory,
            status: "active",
            createdAt: new Date().toISOString(),
            lastRunAt: null,
            nextRunAt: Date.now() + 60_000,
            pendingRunAt,
            runCount: 0,
          },
        ],
      }),
    );
    let recoveredSessionId = "";
    let startCalls = 0;
    const manager = new LocalScheduledTasks(
      directory,
      {
        invoke: async (method, args) => {
          if (method === "getSession") {
            recoveredSessionId = String(args[0]);
            return {
              sessionId: recoveredSessionId,
              scheduledTaskId: "recover-me",
            };
          }
          if (method === "start") startCalls += 1;
          return undefined;
        },
      },
      () => undefined,
    );
    const tasks = (await manager.invoke("getAllScheduledTasks", [])) as Array<
      Record<string, unknown>
    >;
    expect(recoveredSessionId).toMatch(/^scheduled-[a-f0-9]{40}$/);
    expect(startCalls).toBe(0);
    expect(tasks[0].runCount).toBe(1);
    expect(tasks[0].lastRunSessionId).toBe(recoveredSessionId);
    await manager.dispose();
  });

  it("fails closed when Code does not honor the deterministic run id", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "sched-id-"));
    temporaryDirectories.push(directory);
    await writeFile(
      path.join(directory, "local-scheduled-tasks.json"),
      JSON.stringify({
        version: 1,
        tasks: [
          {
            id: "wrong-id",
            name: "wrong-id",
            displayName: "Wrong id",
            description: "",
            prompt: "Run once",
            cronExpression: "* * * * *",
            cwd: directory,
            status: "active",
            createdAt: new Date().toISOString(),
            lastRunAt: null,
            nextRunAt: Date.now() - 60_000,
            runCount: 0,
          },
        ],
      }),
    );
    const manager = new LocalScheduledTasks(
      directory,
      {
        invoke: async (method) =>
          method === "start" ? { sessionId: "unexpected-session" } : null,
      },
      () => undefined,
    );
    const tasks = (await manager.invoke("getAllScheduledTasks", [])) as Array<
      Record<string, unknown>
    >;
    expect(tasks[0].runCount).toBe(0);
    expect(tasks[0].lastRunSessionId).toBeNull();
    expect(tasks[0].lastRunNote).toMatch(/deterministic session id/);
    await manager.dispose();
  });
});
