import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("node:fs", () => ({ existsSync: () => true }));
import { LocalMoonshine } from "../src/main/local-moonshine";

function childProcess(stalled = false) {
  const child = Object.assign(new EventEmitter(), {
    stdin: new Writable({
      write(_chunk, _encoding, done) {
        if (!stalled) done();
      },
    }),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(() => {
      child.emit("close", null, "SIGKILL");
      return true;
    }),
  });
  mocks.spawn.mockReturnValue(child);
  return child;
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Moonshine process lifecycle", () => {
  it("settles a failed spawn and releases its session", async () => {
    vi.useFakeTimers();
    const child = childProcess();
    const manager = new LocalMoonshine();
    const { sessionId } = manager.start();
    child.emit("error", new Error("spawn ENOENT"));
    child.emit("close", -2);
    const stopped = manager.stop(sessionId);
    await expect(stopped).resolves.toMatchObject({
      final: true,
      error: "spawn ENOENT",
    });
    expect(vi.getTimerCount()).toBe(0);
    await manager.dispose();
  });

  it("drains trailing stdout before acknowledging process completion", async () => {
    const child = childProcess();
    const manager = new LocalMoonshine();
    const { sessionId } = manager.start();
    const stopped = manager.stop(sessionId);
    child.emit("exit", 0);
    await Promise.resolve();
    await Promise.resolve();
    child.stdout.write('{"text":"last words","final":true}\n');
    child.emit("close", 0);
    await expect(stopped).resolves.toMatchObject({
      text: "last words",
      final: true,
    });
    await manager.dispose();
  });

  it("bounds shutdown even when a pending audio write never drains", async () => {
    vi.useFakeTimers();
    const child = childProcess(true);
    const manager = new LocalMoonshine();
    const { sessionId } = manager.start();
    const audio = manager
      .audio(sessionId, Buffer.alloc(512_000))
      .catch(() => undefined);
    await Promise.resolve();
    const stopped = manager.stop(sessionId);
    const again = manager.stop(sessionId);
    await expect(manager.audio(sessionId, Buffer.alloc(2))).rejects.toThrow(
      /ended|stopping/,
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(stopped).resolves.toMatchObject({ final: true });
    await expect(again).resolves.toMatchObject({ final: true });
    expect(child.kill).toHaveBeenCalledOnce();
    child.stdin.destroy();
    await audio;
    expect(vi.getTimerCount()).toBe(0);
    await manager.dispose();
  });

  it("records asynchronous stdin failures instead of emitting an unhandled error", async () => {
    const child = childProcess();
    const manager = new LocalMoonshine();
    const { sessionId } = manager.start();
    expect(() => child.stdin.emit("error", new Error("EPIPE"))).not.toThrow();
    expect(manager.status(sessionId)).toMatchObject({ error: "EPIPE" });
    child.emit("close", 1);
    await manager.stop(sessionId);
    await manager.dispose();
  });
});
