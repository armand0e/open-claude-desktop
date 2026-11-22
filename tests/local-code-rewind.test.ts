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

async function waitForResult(
  manager: LocalCodeSessionManager,
  sessionId: string,
  minimumResults = 1,
): Promise<Array<Record<string, unknown>>> {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const transcript = (await manager.invoke("getTranscript", [
      sessionId,
    ])) as Array<Record<string, unknown>>;
    if (
      transcript.filter((message) => message.type === "result").length >=
      minimumResults
    )
      return transcript;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for local Code result");
}

describe("LocalCodeSessionManager rewind and fork", () => {
  it("rewinds to a user message and forks a session", async () => {
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
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
      const directory = await mkdtemp(path.join(os.tmpdir(), "code-rewind-"));
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "code-rewind-ws-"),
      );
      temporaryDirectories.push(directory, workspace);
      const events: Array<Record<string, unknown>> = [];
      const manager = await LocalCodeSessionManager.create(
        directory,
        () => ({
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          model: "test-model",
        }),
        (event) => events.push(event as Record<string, unknown>),
        () => undefined,
      );

      const { sessionId } = (await manager.invoke("start", [
        { cwd: workspace, message: "first request" },
      ])) as { sessionId: string };
      await waitForResult(manager, sessionId);
      await manager.invoke("sendMessage", [sessionId, "second request"]);
      const transcript = await waitForResult(manager, sessionId, 2);
      const secondUser = transcript.filter((entry) => entry.type === "user")[1];
      expect(secondUser).toBeDefined();

      // Fork before rewinding: the fork keeps the full history copy.
      const forked = (await manager.invoke("forkSession", [
        sessionId,
      ])) as Record<string, unknown>;
      expect(forked).not.toBeNull();
      const forkedId = String(forked.sessionId);
      expect(forkedId).not.toBe(sessionId);
      const forkedTranscript = (await manager.invoke("getTranscript", [
        forkedId,
      ])) as Array<Record<string, unknown>>;
      expect(forkedTranscript.length).toBe(transcript.length);
      expect(
        forkedTranscript.every((entry) => entry.sessionId === forkedId),
      ).toBe(true);

      // Rewind the original to the second user message.
      const rewound = await manager.invoke("rewind", [
        sessionId,
        secondUser.uuid,
      ]);
      expect(rewound).toBe("second request");
      const after = (await manager.invoke("getTranscript", [
        sessionId,
      ])) as Array<Record<string, unknown>>;
      expect(after.some((entry) => entry.uuid === secondUser.uuid)).toBe(false);
      expect(after.filter((entry) => entry.type === "user").length).toBe(1);
      // The client bucket was reset and replayed.
      expect(events.some((event) => event.type === "cleared")).toBe(true);

      // Unknown targets stay a null (client shows its toast).
      expect(await manager.invoke("rewind", [sessionId, "nope"])).toBeNull();
      // The fork was unaffected by the rewind.
      const forkedAfter = (await manager.invoke("getTranscript", [
        forkedId,
      ])) as Array<Record<string, unknown>>;
      expect(forkedAfter.length).toBe(transcript.length);

      // The current renderer uses rewindV2 and reads result.prefill. Keep the
      // legacy string contract separate so neither client generation loses
      // the selected prompt after the transcript has been truncated.
      await expect(
        manager.invoke("rewindV2", [forkedId, secondUser.uuid]),
      ).resolves.toEqual({ prefill: "second request" });
      await expect(
        manager.invoke("rewindV2", [forkedId, "nope"]),
      ).resolves.toBeNull();
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
