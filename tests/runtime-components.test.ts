import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
  destroyed: 0,
  tooltip: "",
  template: [] as Array<Record<string, unknown>>,
  handlers: new Map<string, () => void>(),
}));

vi.mock("electron", () => ({
  BrowserWindow: class {},
  WebContentsView: class {},
  session: {
    fromPartition: () => ({
      webRequest: { onBeforeRequest: vi.fn() },
      protocol: { handle: vi.fn(), unhandle: vi.fn() },
      on: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
      setPermissionRequestHandler: vi.fn(),
      setProxy: vi.fn(async () => undefined),
    }),
  },
  nativeImage: {
    createFromPath: () => ({
      isEmpty: () => false,
      setTemplateImage: vi.fn(),
    }),
  },
  Menu: {
    buildFromTemplate: (template: Array<Record<string, unknown>>) => {
      electron.template = template;
      return template;
    },
  },
  Tray: class {
    setToolTip(value: string) {
      electron.tooltip = value;
    }
    setContextMenu() {}
    on(name: string, callback: () => void) {
      electron.handlers.set(name, callback);
    }
    isDestroyed() {
      return false;
    }
    destroy() {
      electron.destroyed += 1;
    }
  },
}));

import {
  readResponseJson,
  readResponseText,
  writeResponseFile,
} from "../src/main/bounded-response";
import {
  BUILTIN_SKILLS,
  BUILTIN_SKILL_NAMES,
} from "../src/main/builtin-skills";
import {
  localFilePreviewUrl,
  previewRectangle,
} from "../src/main/local-file-preview";
import { runtimePromptContext } from "../src/main/runtime-prompt";
import { LocalTrayController } from "../src/main/local-tray";
import { WEB_TOOLS } from "../src/main/local-web-tools";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
  electron.destroyed = 0;
  electron.handlers.clear();
});

describe("bounded provider responses", () => {
  it("rejects oversized, invalid UTF-8, and invalid JSON bodies", async () => {
    await expect(
      readResponseText(new Response("too large"), 3, "Fixture"),
    ).rejects.toThrow(/exceeded/);
    await expect(
      readResponseText(new Response(Uint8Array.from([0xc3, 0x28])), 10),
    ).rejects.toThrow(/invalid UTF-8/);
    await expect(readResponseJson(new Response("{"), 10)).rejects.toThrow(
      /invalid JSON/,
    );
  });

  it("removes a partial destination when a streamed download crosses its cap", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bounded-response-"));
    roots.push(root);
    const destination = path.join(root, "partial.bin");
    await expect(
      writeResponseFile(new Response("123456"), destination, 4, "Download"),
    ).rejects.toThrow(/exceeded/);
    await expect(readFile(destination)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

describe("small runtime components", () => {
  it("keeps built-in skill metadata unique and internally consistent", () => {
    expect(BUILTIN_SKILL_NAMES.size).toBe(BUILTIN_SKILLS.length);
    for (const skill of BUILTIN_SKILLS) {
      expect(skill.content).toContain(`name: ${skill.name}`);
      expect(skill.content).toContain("description:");
    }
  });

  it("builds runtime context without copying environment values", () => {
    process.env.OPENAI_API_KEY = "runtime-context-secret";
    try {
      const prompt = runtimePromptContext();
      expect(prompt).toContain("<runtime_context>");
      expect(prompt).toContain(process.platform);
      expect(prompt).not.toContain("runtime-context-secret");
    } finally {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it("bounds preview rectangles and encodes file paths", () => {
    expect(
      previewRectangle({ x: -10, y: 2.4, width: 0, height: 99_999 }),
    ).toEqual({ x: 0, y: 2, width: 1, height: 32_768 });
    expect(localFilePreviewUrl("token", path.join("a b", "x#.html"))).toBe(
      "claude-local-preview://token/a%20b/x%23.html",
    );
  });

  it("declares bounded web tools with object schemas", () => {
    expect(WEB_TOOLS.map((tool) => tool.function.name)).toEqual([
      "web_search",
      "visit_website",
    ]);
    for (const tool of WEB_TOOLS)
      expect(tool.function.parameters).toMatchObject({ type: "object" });
  });

  it("creates an idempotent tray and wires every operating-system action", () => {
    const open = vi.fn();
    const routines = vi.fn();
    const quit = vi.fn();
    const tray = new LocalTrayController({
      iconPath: "fixture.png",
      openMainWindow: open,
      openRoutines: routines,
      quit,
    });
    tray.setEnabled(true);
    tray.setEnabled(true);
    expect(electron.tooltip).toBe("Open-Claude");
    expect(
      electron.template.map((entry) => entry.label).filter(Boolean),
    ).toEqual(["Open Open-Claude", "Routines", "Quit"]);
    electron.handlers.get("click")?.();
    expect(open).toHaveBeenCalledOnce();
    tray.dispose();
    expect(electron.destroyed).toBe(1);
  });
});
