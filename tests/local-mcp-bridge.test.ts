import { describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
  channels: [] as Array<{
    port1: {
      closed: boolean;
      on(event: string, handler: (event?: unknown) => void): void;
      postMessage(message: unknown): void;
      start(): void;
      close(): void;
    };
    port2: {
      closed: boolean;
      on(event: string, handler: (event?: unknown) => void): void;
      postMessage(message: unknown): void;
      start(): void;
      close(): void;
    };
  }>,
}));

vi.mock("electron", () => {
  class FakePort {
    closed = false;
    handlers = new Map<string, (event?: unknown) => void>();
    on(event: string, handler: (event?: unknown) => void): void {
      this.handlers.set(event, handler);
    }
    postMessage(): void {}
    start(): void {}
    close(): void {
      if (this.closed) return;
      this.closed = true;
      this.handlers.get("close")?.();
    }
  }
  return {
    MessageChannelMain: class {
      port1 = new FakePort();
      port2 = new FakePort();
      constructor() {
        electron.channels.push(this);
      }
    },
  };
});

import { LocalMcpPortBridge } from "../src/main/local-mcp-bridge";

describe("LocalMcpPortBridge lifecycle", () => {
  it("isolates the same MCP server across renderer windows", async () => {
    const bridge = new LocalMcpPortBridge(() => ({
      fixture: {
        command: process.execPath,
        args: ["-e", "process.stdin.resume()"],
      },
    }));
    const firstTarget = { id: 1, postMessage: vi.fn() };
    const secondTarget = { id: 2, postMessage: vi.fn() };
    try {
      bridge.connect(firstTarget as never, "fixture");
      bridge.connect(secondTarget as never, "fixture");
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(firstTarget.postMessage).toHaveBeenCalledOnce();
      expect(secondTarget.postMessage).toHaveBeenCalledOnce();
      expect(electron.channels).toHaveLength(2);
      expect(electron.channels[0].port1.closed).toBe(false);
      expect(electron.channels[1].port1.closed).toBe(false);

      bridge.connect(firstTarget as never, "fixture");
      expect(electron.channels[0].port1.closed).toBe(true);
      expect(electron.channels[1].port1.closed).toBe(false);
    } finally {
      bridge.disposeAll();
    }
    expect(electron.channels.at(-1)?.port1.closed).toBe(true);
  });
});
