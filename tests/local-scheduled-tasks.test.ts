import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LocalScheduledTasks,
  nextCronRun,
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
          return { sessionId: `session-${started.length}` };
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
        "paused",
      ]),
    ).toBe(true);
    const paused = (await manager.invoke("getAllScheduledTasks", [])) as Array<
      Record<string, unknown>
    >;
    expect(paused[0].enabled).toBe(false);
    expect(paused[0].nextRunAt).toBeNull();

    const content = (await manager.invoke("getScheduledTaskFileContent", [
      "nightly-review",
    ])) as string;
    expect(content).toContain("Review the repo");
    manager.dispose();

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
    for (let i = 0; i < 40 && started.length === 0; i += 1)
      await new Promise((resolve) => setTimeout(resolve, 50));
    expect(started).toHaveLength(1);
    expect(started[0].scheduledTaskId).toBe("missed-task");
    expect(started[0].message).toBe("Run the missed job.");
    const records = (await reopened.invoke(
      "getAllScheduledTasks",
      [],
    )) as Array<Record<string, unknown>>;
    expect(records[0].runCount).toBe(1);
    expect(records[0].lastRunSessionId).toBe("session-1");
    expect(records[0].nextRunAt).toBeGreaterThan(Date.now() - 60_000);
    expect(events.some((event) => event.type === "run_session_created")).toBe(
      true,
    );
    reopened.dispose();
  });
});
