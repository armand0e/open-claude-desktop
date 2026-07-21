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
  it("persists undelivered steering when the app shuts down", async () => {
    const providerRequests: Array<{
      messages: Array<{ role: string; content: unknown }>;
    }> = [];
    let resolveFirstRequest!: () => void;
    const firstRequest = new Promise<void>((resolve) => {
      resolveFirstRequest = resolve;
    });
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      providerRequests.push(JSON.parse(body));
      response.writeHead(200, { "Content-Type": "application/json" });
      if (providerRequests.length === 1) {
        response.flushHeaders();
        resolveFirstRequest();
        return;
      }
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: "Recovered steering after restart.",
              },
            },
          ],
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing provider test address");
    const directory = await mkdtemp(path.join(os.tmpdir(), "code-steer-disk-"));
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "code-steer-disk-ws-"),
    );
    temporaryDirectories.push(directory, workspace);
    const provider = () => ({
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      model: "test-model",
    });
    const manager = await LocalCodeSessionManager.create(
      directory,
      provider,
      () => undefined,
      () => undefined,
    );
    let reopened: LocalCodeSessionManager | undefined;
    try {
      const { sessionId } = (await manager.invoke("start", [
        { cwd: workspace, message: "initial task" },
      ])) as { sessionId: string };
      await manager.invoke("getTranscript", [sessionId]);
      await firstRequest;
      await manager.invoke("sendMessage", [
        sessionId,
        "persist this steering",
        undefined,
        undefined,
        undefined,
        "steer",
      ]);
      await manager.dispose();

      reopened = await LocalCodeSessionManager.create(
        directory,
        provider,
        () => undefined,
        () => undefined,
      );
      const transcript = await waitForResults(reopened, sessionId, 2);
      expect(JSON.stringify(transcript)).toContain(
        "Recovered steering after restart.",
      );
      const initialUser = transcript.find(
        (entry) =>
          entry.type === "user" &&
          JSON.stringify(entry.message).includes("initial task"),
      );
      const steeringUser = transcript.find(
        (entry) =>
          entry.type === "user" &&
          JSON.stringify(entry.message).includes("persist this steering"),
      );
      const interrupted = transcript.find(
        (entry) =>
          entry.type === "result" &&
          JSON.stringify(entry).includes("Generation interrupted"),
      );
      const recoveredAssistant = transcript.find(
        (entry) =>
          entry.type === "assistant" &&
          JSON.stringify(entry.message).includes("Recovered steering"),
      );
      expect(interrupted?.parentUuid).toBe(initialUser?.uuid);
      expect(steeringUser?.parentUuid).toBe(interrupted?.uuid);
      expect(recoveredAssistant?.parentUuid).toBe(steeringUser?.uuid);
      expect(
        providerRequests
          .at(-1)
          ?.messages.filter(
            (message) => message.content === "persist this steering",
          ),
      ).toHaveLength(1);
    } finally {
      await manager.dispose();
      await reopened?.dispose();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("injects a steering message exactly once on the next agent iteration", async () => {
    const providerRequests: Array<{
      messages: Array<{ role: string; content: unknown }>;
    }> = [];
    let resolveFirstRequest!: () => void;
    const firstRequest = new Promise<void>((resolve) => {
      resolveFirstRequest = resolve;
    });
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      const parsed = JSON.parse(body) as {
        messages: Array<{ role: string; content: unknown }>;
      };
      providerRequests.push(parsed);
      response.writeHead(200, { "Content-Type": "application/json" });
      if (providerRequests.length === 1) {
        resolveFirstRequest();
        await firstGate;
        response.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "",
                  tool_calls: [
                    {
                      id: "steering-read",
                      type: "function",
                      function: {
                        name: "Read",
                        arguments: JSON.stringify({ file_path: "missing.txt" }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        );
        return;
      }
      response.end(
        JSON.stringify({
          choices: [
            { message: { role: "assistant", content: "Steered once." } },
          ],
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing provider test address");
    const directory = await mkdtemp(path.join(os.tmpdir(), "code-steer-"));
    const workspace = await mkdtemp(path.join(os.tmpdir(), "code-steer-ws-"));
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
    try {
      const { sessionId } = (await manager.invoke("start", [
        { cwd: workspace, message: "initial task" },
      ])) as { sessionId: string };
      await manager.invoke("getTranscript", [sessionId]);
      await firstRequest;
      await manager.invoke("sendMessage", [
        sessionId,
        "steering guidance",
        undefined,
        undefined,
        undefined,
        "steer",
      ]);
      releaseFirst();
      await waitForResults(manager, sessionId, 1);

      expect(providerRequests).toHaveLength(2);
      expect(
        providerRequests[0].messages.filter(
          (message) => message.content === "steering guidance",
        ),
      ).toHaveLength(0);
      expect(
        providerRequests[1].messages.filter(
          (message) => message.content === "steering guidance",
        ),
      ).toHaveLength(1);
      const transcript = (await manager.invoke("getTranscript", [
        sessionId,
      ])) as Array<Record<string, unknown>>;
      const steeringUser = transcript.find(
        (entry) =>
          entry.type === "user" &&
          JSON.stringify(entry.message).includes("steering guidance"),
      );
      const steeredAssistant = transcript.find(
        (entry) =>
          entry.type === "assistant" &&
          JSON.stringify(entry.message).includes("Steered once"),
      );
      expect(steeredAssistant?.parentUuid).toBe(steeringUser?.uuid);
    } finally {
      releaseFirst();
      await manager.dispose();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it(
    "queues messages sent mid-run and supports cancel",
    { timeout: 30_000 },
    async () => {
      const providerRequests: Array<{
        messages: Array<{ role: string; content: unknown }>;
      }> = [];
      const server = createServer(async (request, response) => {
        let body = "";
        for await (const chunk of request) body += chunk;
        const parsed = JSON.parse(body) as {
          messages: Array<{ role: string; content: unknown }>;
        };
        providerRequests.push(parsed);
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
        const taskA = finished.find(
          (entry) =>
            entry.type === "user" &&
            JSON.stringify(entry.message).includes("task A"),
        );
        const taskB = finished.find(
          (entry) =>
            entry.type === "user" &&
            JSON.stringify(entry.message).includes("task B"),
        );
        const answerA = finished.find(
          (entry) =>
            entry.type === "assistant" && entry.parentUuid === taskA?.uuid,
        );
        const answerB = finished.find(
          (entry) =>
            entry.type === "assistant" && entry.parentUuid === taskB?.uuid,
        );
        expect(answerA).toBeDefined();
        expect(answerB).toBeDefined();
        expect(
          await manager.invoke("cancelQueuedMessage", [sessionId, "missing"]),
        ).toBe(false);

        // When two valid follow-ups are queued, the later user message must
        // not leak into the model context for the earlier queued turn.
        await manager.invoke("sendMessage", [sessionId, "task F"]);
        await manager.invoke("sendMessage", [sessionId, "task G"]);
        await waitForResults(manager, sessionId, 4);
        const taskFRequest = providerRequests.find(
          (candidate) =>
            candidate.messages.findLast((message) => message.role === "user")
              ?.content === "task F",
        );
        expect(taskFRequest).toBeDefined();
        expect(
          taskFRequest!.messages.some(
            (message) =>
              message.role === "user" && message.content === "task G",
          ),
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
        const resumed = await waitForResults(reopened, sessionId, 5);
        expect(JSON.stringify(resumed)).toContain("task E");
        expect(
          resumed.filter((message) => message.type === "result").length,
        ).toBeGreaterThanOrEqual(5);
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
