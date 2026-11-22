import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalBackend } from "../src/main/local-backend";
import { LocalCodeSessionManager } from "../src/main/local-code";

describe("provider stream completion", () => {
  it.each(["chat", "code", "chat-error"])(
    "settles %s without waiting for the upstream socket to close",
    async (surface) => {
      const root = await mkdtemp(
        path.join(os.tmpdir(), "provider-stream-lifecycle-"),
      );
      const server = createServer(async (request, response) => {
        for await (const _chunk of request) {
          /* Drain the request. */
        }
        response.writeHead(200, { "Content-Type": "text/event-stream" });
        response.write(
          surface === "chat-error"
            ? 'data: {"error":{"message":"Provider is overloaded"}}\n\n'
            : 'data: {"choices":[{"delta":{"content":"Completed answer"}}]}\n\ndata: [DONE]\n\n',
        );
        // The protocol completion signal must be sufficient on a kept-open body.
      });
      let backend: LocalBackend | undefined;
      let code: LocalCodeSessionManager | undefined;
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        await new Promise<void>((resolve) =>
          server.listen(0, "127.0.0.1", resolve),
        );
        const address = server.address();
        if (!address || typeof address === "string")
          throw new Error("Missing server address");
        const provider = {
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          model: "fixture",
        };
        const result = (async () => {
          if (surface === "code") {
            code = await LocalCodeSessionManager.create(
              root,
              () => provider,
              () => undefined,
              () => undefined,
            );
            const { sessionId } = (await code.invoke("start", [
              { cwd: root, message: "Answer" },
            ])) as { sessionId: string };
            for (;;) {
              const rows = (await code.invoke("getTranscript", [
                sessionId,
              ])) as Array<Record<string, unknown>>;
              if (rows.some((row) => row.type === "result"))
                return JSON.stringify(rows);
              await new Promise((resolve) => setTimeout(resolve, 20));
            }
          }
          backend = await LocalBackend.create(root);
          const send = (pathname: string, body: unknown, method = "POST") => {
            const url = new URL(`app://localhost${pathname}`);
            return backend!.handle(
              new Request(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }),
              url,
            );
          };
          await send("/api/local/config", provider, "PUT");
          await send("/api/organizations/org/chat_conversations", {
            uuid: "stream-fixture",
          });
          const response = await send(
            "/api/organizations/org/chat_conversations/stream-fixture/completion",
            { prompt: "Answer" },
          );
          return response!.text();
        })();
        const output = await Promise.race([
          result,
          new Promise<never>((_, reject) => {
            deadline = setTimeout(
              () => reject(new Error("Stream failed to complete")),
              2500,
            );
          }),
        ]);
        expect(output).toContain(
          surface === "chat-error"
            ? "Provider is overloaded"
            : "Completed answer",
        );
      } finally {
        clearTimeout(deadline);
        server.closeAllConnections();
        await backend?.dispose();
        await code?.dispose();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await rm(root, { recursive: true, force: true });
      }
    },
  );
});
