import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalCodeSessionManager } from "../src/main/local-code";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function waitForResults(
  manager: LocalCodeSessionManager,
  sessionId: string,
  minimumResults: number,
): Promise<Array<Record<string, unknown>>> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const transcript = (await manager.invoke("getTranscript", [
      sessionId,
    ])) as Array<Record<string, unknown>>;
    if (
      transcript.filter((message) => message.type === "result").length >=
      minimumResults
    )
      return transcript;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for local Code results");
}

describe("LocalCodeSessionManager message queue", () => {
  it(
    "queues messages sent mid-run and supports cancel",
    { timeout: 30_000 },
    async () => {
      const server = createServer(async (request, response) => {
        let body = "";
        for await (const chunk of request) body += chunk;
        const parsed = JSON.parse(body) as {
          messages: Array<{ role: string; content: unknown }>;
        };
        const lastUser = parsed.messages.findLast(
          (message) => message.role === "user",
        );
        // "task D" hangs forever: it simulates a run cut off by a hard app
        // restart while a later message sits in the queue.
        if (lastUser?.content === "task D") return;
        // Slow enough that follow-up sends land while the run is active.
        await new Promise((resolve) => setTimeout(resolve, 300));
        response.writeHead(200, { "Content-Type": "text/event-stream" });
        response.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: "Done." } }] })}\n\n`,
        );
        response.end("data: [DONE]\n\n");
      });
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing provider test address");

      try {
        const directory = await mkdtemp(path.join(os.tmpdir(), "code-queue-"));
        const workspace = await mkdtemp(
          path.join(os.tmpdir(), "code-queue-ws-"),
        );
        temporaryDirectories.push(directory, workspace);
        const manager = await LocalCodeSessionManager.create(
          directory,
          () => ({
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: "test-model",
          }),
          () => undefined,
          () => undefined,
        );

        const { sessionId } = (await manager.invoke("start", [
          { cwd: workspace, message: "task A" },
        ])) as { sessionId: string };
        // Give the deferred initial run a moment to begin.
        await new Promise((resolve) => setTimeout(resolve, 150));
        await manager.invoke("sendMessage", [sessionId, "task B"]);
        await manager.invoke("sendMessage", [sessionId, "task C"]);

        const transcript = (await manager.invoke("getTranscript", [
          sessionId,
        ])) as Array<Record<string, unknown>>;
        const queuedC = transcript.find(
          (entry) =>
            entry.type === "user" &&
            JSON.stringify(entry.message).includes("task C"),
        );
        expect(queuedC).toBeDefined();
        expect(
          await manager.invoke("cancelQueuedMessage", [
            sessionId,
            queuedC!.uuid,
          ]),
        ).toBe(true);

        // A and B run to completion; the cancelled C never does.
        const finished = await waitForResults(manager, sessionId, 2);
        await new Promise((resolve) => setTimeout(resolve, 500));
        const settled = (await manager.invoke("getTranscript", [
          sessionId,
        ])) as Array<Record<string, unknown>>;
        expect(
          settled.filter((message) => message.type === "result").length,
        ).toBe(2);
        expect(JSON.stringify(settled)).not.toContain("task C");
        expect(finished.length).toBeGreaterThan(0);
        expect(
          await manager.invoke("cancelQueuedMessage", [sessionId, "missing"]),
        ).toBe(false);

        // Restart resilience: task D hangs mid-run (simulating a hard app
        // exit) while task E sits in the persisted queue. A fresh manager on
        // the same store must resume E when the session is next opened.
        await manager.invoke("sendMessage", [sessionId, "task D"]);
        await new Promise((resolve) => setTimeout(resolve, 100));
        await manager.invoke("sendMessage", [sessionId, "task E"]);
        await new Promise((resolve) => setTimeout(resolve, 200));
        const reopened = await LocalCodeSessionManager.create(
          directory,
          () => ({
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: "test-model",
          }),
          () => undefined,
          () => undefined,
        );
        // Opening the session (getTranscript) resumes the persisted queue.
        const resumed = await waitForResults(reopened, sessionId, 3);
        expect(JSON.stringify(resumed)).toContain("task E");
        expect(
          resumed.filter((message) => message.type === "result").length,
        ).toBeGreaterThanOrEqual(3);
      } finally {
        // The deliberately hung "task D" connection would keep close() waiting,
        // and severing it makes that run fail and persist — let those writes
        // settle before afterEach deletes the store directory.
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    },
  );
});
