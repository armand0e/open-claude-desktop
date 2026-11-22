import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  desktopCapturer: { getSources: vi.fn() },
  screen: { getPrimaryDisplay: vi.fn() },
}));

import {
  LocalBrowserUse,
  publicBrowserUrl,
  withAbort,
} from "../src/main/local-browser";
import { LocalComputerUse } from "../src/main/local-computer";

const roots: string[] = [];
const browsers: LocalBrowserUse[] = [];
const computers: LocalComputerUse[] = [];
const conversation = "00000000-0000-4000-8000-000000000410";

afterEach(async () => {
  await Promise.all(browsers.splice(0).map((browser) => browser.dispose()));
  for (const computer of computers.splice(0)) computer.dispose();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function root(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "local-control-"));
  roots.push(directory);
  return directory;
}

describe("browser-use network boundary", () => {
  it("closes the page before reporting a cancelled mutating action", async () => {
    const controller = new AbortController();
    let closeCalls = 0;
    const action = withAbort(
      controller.signal,
      {
        close: async () => {
          closeCalls += 1;
        },
      } as never,
      () => new Promise<never>(() => undefined),
    );
    controller.abort();

    await expect(action).rejects.toThrow(/cancelled/i);
    expect(closeCalls).toBe(1);
  });

  it("rejects local, credentialed, and non-web navigation", async () => {
    await expect(publicBrowserUrl("http://localhost/admin")).rejects.toThrow(
      /local network/i,
    );
    await expect(
      publicBrowserUrl("https://user:secret@example.com/"),
    ).rejects.toThrow(/credentials/i);
    await expect(publicBrowserUrl("file:///etc/passwd")).rejects.toThrow(
      /HTTP and HTTPS/i,
    );
    await expect(
      publicBrowserUrl("http://[0:0:0:0:0:0:0:1]/admin"),
    ).rejects.toThrow(/local network/i);
    await expect(
      publicBrowserUrl("http://[::ffff:127.0.0.1]/admin"),
    ).rejects.toThrow(/local network/i);
    await expect(
      publicBrowserUrl("https://[2606:4700:4700::1111]/"),
    ).resolves.toBeInstanceOf(URL);
  });

  it("fails closed on mixed DNS answers and simulated rebinding", async () => {
    await expect(
      publicBrowserUrl("https://mixed.example/", async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]),
    ).rejects.toThrow(/local network/i);

    let lookupCount = 0;
    const rebindingResolver = async () => {
      lookupCount += 1;
      return lookupCount === 1
        ? [{ address: "93.184.216.34", family: 4 }]
        : [{ address: "169.254.169.254", family: 4 }];
    };
    await expect(
      publicBrowserUrl("https://rebind.example/", rebindingResolver),
    ).resolves.toBeInstanceOf(URL);
    await expect(
      publicBrowserUrl("https://rebind.example/next", rebindingResolver),
    ).rejects.toThrow(/local network/i);
  });
});

describe("control screenshot boundary", () => {
  it.runIf(process.platform === "win32")(
    "maps model scroll direction to a bounded Win32 wheel delta",
    async () => {
      const directory = await root();
      const scripts: string[] = [];
      const computer = new LocalComputerUse(
        directory,
        async () => true,
        async (script) => {
          scripts.push(script);
        },
      );
      computers.push(computer);

      await expect(
        computer.run(
          conversation,
          "computer_scroll",
          { delta_y: 500 },
          new AbortController().signal,
        ),
      ).resolves.toEqual(
        expect.objectContaining({ output: expect.stringContaining("down") }),
      );
      expect(scripts[0]).toContain("[LocalInput]::Scroll(-500)");
      await expect(
        computer.run(
          conversation,
          "computer_scroll",
          { delta_y: 10_001 },
          new AbortController().signal,
        ),
      ).rejects.toThrow(/between/);
    },
  );

  it("does not expose a linked browser screenshot", async () => {
    const directory = await root();
    const browser = new LocalBrowserUse(directory);
    browsers.push(browser);
    const shots = path.join(directory, "browser-use", "shots", conversation);
    const outside = path.join(directory, "outside.png");
    await mkdir(shots, { recursive: true });
    await writeFile(outside, "not a screenshot");
    await symlink(outside, path.join(shots, "shot-1-1.png"), "file");
    await expect(
      browser.shotFile(conversation, "shot-1-1.png"),
    ).resolves.toBeNull();
  });

  it("does not expose screenshots through a linked conversation directory", async () => {
    const directory = await root();
    const browser = new LocalBrowserUse(directory);
    browsers.push(browser);
    const shotsRoot = path.join(directory, "browser-use", "shots");
    const outside = path.join(directory, "outside-browser-shots");
    await mkdir(shotsRoot, { recursive: true });
    await mkdir(outside);
    await writeFile(path.join(outside, "shot-1-1.png"), "not a screenshot");
    await symlink(outside, path.join(shotsRoot, conversation), "dir");
    await expect(
      browser.shotFile(conversation, "shot-1-1.png"),
    ).resolves.toBeNull();
  });

  it("does not expose a linked computer screenshot", async () => {
    const directory = await root();
    const computer = new LocalComputerUse(directory, async () => true);
    computers.push(computer);
    const shots = path.join(directory, "computer-use", "shots", conversation);
    const outside = path.join(directory, "outside.png");
    await mkdir(shots, { recursive: true });
    await writeFile(outside, "not a screenshot");
    await symlink(outside, path.join(shots, "shot-1-1.png"), "file");
    await expect(
      computer.shotFile(conversation, "shot-1-1.png"),
    ).resolves.toBeNull();
  });

  it("invalidates consent dialogs that outlive their conversation", async () => {
    const directory = await root();
    let resolveFirst!: (granted: boolean) => void;
    let confirmations = 0;
    const computer = new LocalComputerUse(directory, async () => {
      confirmations += 1;
      if (confirmations > 1) return true;
      return new Promise<boolean>((resolve) => {
        resolveFirst = resolve;
      });
    });
    computers.push(computer);
    const action = computer.run(
      conversation,
      "unknown_action",
      {},
      new AbortController().signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await computer.removeConversation(conversation);
    resolveFirst(true);
    await expect(action).rejects.toThrow(/consent was cancelled/i);

    await expect(
      computer.run(
        conversation,
        "unknown_action",
        {},
        new AbortController().signal,
      ),
    ).rejects.toThrow(/unknown computer tool/i);
    expect(confirmations).toBe(2);
  });
});
