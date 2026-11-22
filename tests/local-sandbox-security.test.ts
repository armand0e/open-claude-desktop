import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalSandbox } from "../src/main/local-sandbox";

const roots: string[] = [];
const sandboxes: LocalSandbox[] = [];
const conversation = "00000000-0000-4000-8000-000000000321";

afterEach(async () => {
  await Promise.all(sandboxes.splice(0).map((sandbox) => sandbox.dispose()));
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture(): Promise<{
  root: string;
  sandbox: LocalSandbox;
  workspace: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-claude-sandbox-"));
  roots.push(root);
  const sandbox = new LocalSandbox(root);
  sandboxes.push(sandbox);
  const workspace = sandbox.workspaceDir(conversation);
  await mkdir(workspace, { recursive: true });
  return { root, sandbox, workspace };
}

describe("local sandbox host boundary", () => {
  it("removes every execution container after success and sweeps untracked leftovers on dispose", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "open-claude-sandbox-"));
    roots.push(root);
    const active = new Set<string>();
    const calls: string[][] = [];
    const docker = async (args: readonly string[]) => {
      calls.push([...args]);
      if (args[0] === "version")
        return { missing: false, code: 0, stdout: "27.0", stderr: "" };
      if (args[0] === "image")
        return { missing: false, code: 0, stdout: "ready", stderr: "" };
      if (args[0] === "ps")
        return {
          missing: false,
          code: 0,
          stdout: [...active].join("\n"),
          stderr: "",
        };
      if (args[0] === "run") {
        active.add(args[args.indexOf("--name") + 1]);
        return { missing: false, code: 0, stdout: "container", stderr: "" };
      }
      if (args[0] === "exec")
        return { missing: false, code: 0, stdout: "done", stderr: "" };
      if (args[0] === "rm") {
        for (const target of args.slice(2)) active.delete(target);
        return { missing: false, code: 0, stdout: "", stderr: "" };
      }
      return { missing: false, code: 0, stdout: "", stderr: "" };
    };
    const sandbox = new LocalSandbox(root, docker);
    sandboxes.push(sandbox);

    await sandbox.runCommand(conversation, "echo done", {
      allowNetwork: false,
      signal: new AbortController().signal,
    });
    expect(active).toEqual(new Set());
    expect(calls.filter((args) => args[0] === "run")).toHaveLength(1);
    const runArgs = calls.find((args) => args[0] === "run") ?? [];
    expect(runArgs).toContain("--read-only");
    expect(runArgs).toContain("/tmp:rw,nosuid,nodev,size=512m");
    expect(runArgs).toContain("core=0:0");
    expect(runArgs).toContain("fsize=209715200:209715200");
    expect(calls.filter((args) => args[0] === "rm").length).toBeGreaterThan(1);

    active.add("untracked-owner-container");
    await sandbox.dispose();
    expect(active).toEqual(new Set());
  });

  it("serializes executions for one conversation before removing their containers", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "open-claude-sandbox-"));
    roots.push(root);
    const active = new Set<string>();
    let concurrentExecs = 0;
    let peakConcurrentExecs = 0;
    const docker = async (args: readonly string[]) => {
      if (args[0] === "version" || args[0] === "image")
        return { missing: false, code: 0, stdout: "ready", stderr: "" };
      if (args[0] === "ps")
        return {
          missing: false,
          code: 0,
          stdout: [...active].join("\n"),
          stderr: "",
        };
      if (args[0] === "run") {
        active.add(args[args.indexOf("--name") + 1]);
        return { missing: false, code: 0, stdout: "container", stderr: "" };
      }
      if (args[0] === "exec") {
        concurrentExecs += 1;
        peakConcurrentExecs = Math.max(peakConcurrentExecs, concurrentExecs);
        await new Promise((resolve) => setTimeout(resolve, 25));
        concurrentExecs -= 1;
        return { missing: false, code: 0, stdout: "done", stderr: "" };
      }
      if (args[0] === "rm") {
        for (const target of args.slice(2)) active.delete(target);
        return { missing: false, code: 0, stdout: "", stderr: "" };
      }
      return { missing: false, code: 0, stdout: "", stderr: "" };
    };
    const sandbox = new LocalSandbox(root, docker);
    sandboxes.push(sandbox);
    const options = {
      allowNetwork: false,
      signal: new AbortController().signal,
    };

    await Promise.all([
      sandbox.runCommand(conversation, "echo first", options),
      sandbox.runCommand(conversation, "echo second", options),
    ]);

    expect(peakConcurrentExecs).toBe(1);
    expect(active).toEqual(new Set());
  });

  it("strips terminal escapes, control characters, and bidi overrides from output", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "open-claude-sandbox-"));
    roots.push(root);
    const docker = async (args: readonly string[]) => {
      if (args[0] === "version" || args[0] === "image")
        return { missing: false, code: 0, stdout: "ready", stderr: "" };
      if (args[0] === "exec")
        return {
          missing: false,
          code: 0,
          stdout:
            "\u001b]8;;https://example.com\u0007link\u001b]8;;\u0007 \u001b[31mred\u001b[0m safe\u202etxt\u0000",
          stderr: "",
        };
      return { missing: false, code: 0, stdout: "", stderr: "" };
    };
    const sandbox = new LocalSandbox(root, docker);
    sandboxes.push(sandbox);

    const result = await sandbox.runCommand(conversation, "true", {
      allowNetwork: false,
      signal: new AbortController().signal,
    });

    expect(result.output).toBe("link red safetxt");
  });

  it("coalesces stale-container reaping across concurrent conversations", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "open-claude-sandbox-"));
    roots.push(root);
    const calls: string[][] = [];
    const docker = async (args: readonly string[]) => {
      calls.push([...args]);
      if (args[0] === "ps")
        await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        missing: false,
        code: 0,
        stdout:
          args[0] === "version" ? "27.0" : args[0] === "inspect" ? "true" : "",
        stderr: "",
      };
    };
    const sandbox = new LocalSandbox(root, docker);
    sandboxes.push(sandbox);
    await Promise.all([
      sandbox.runCommand(conversation, "true", {
        allowNetwork: false,
        signal: new AbortController().signal,
      }),
      sandbox.runCommand("00000000-0000-4000-8000-000000000322", "true", {
        allowNetwork: false,
        signal: new AbortController().signal,
      }),
    ]);

    expect(calls.filter((args) => args[0] === "ps")).toHaveLength(1);
    expect(calls.filter((args) => args[0] === "run")).toHaveLength(2);
  });

  it("does not download through a workspace junction", async () => {
    const { root, sandbox, workspace } = await fixture();
    const outside = path.join(root, "outside");
    await mkdir(outside);
    await writeFile(path.join(outside, "secret.txt"), "host secret");
    await symlink(outside, path.join(workspace, "escape"), "junction");

    await expect(
      sandbox.workspaceFile(conversation, "escape/secret.txt"),
    ).resolves.toBeNull();
  });

  it("reconciles orphaned workspaces without following links", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "open-claude-sandbox-"));
    roots.push(root);
    const sandbox = new LocalSandbox(root);
    sandboxes.push(sandbox);
    const active = "00000000-0000-4000-8000-000000000401";
    const orphan = "00000000-0000-4000-8000-000000000402";
    const linked = "00000000-0000-4000-8000-000000000403";
    const activeWorkspace = sandbox.workspaceDir(active);
    const orphanWorkspace = sandbox.workspaceDir(orphan);
    const linkedWorkspace = sandbox.workspaceDir(linked);
    const outside = path.join(root, "outside");
    await mkdir(activeWorkspace, { recursive: true });
    await mkdir(orphanWorkspace, { recursive: true });
    await mkdir(outside);
    await writeFile(path.join(activeWorkspace, "keep.txt"), "active");
    await writeFile(path.join(orphanWorkspace, "remove.txt"), "orphan");
    await writeFile(path.join(outside, "keep.txt"), "outside");
    await symlink(outside, linkedWorkspace, "junction");

    await sandbox.reconcileWorkspaces([active]);

    await expect(
      readFile(path.join(activeWorkspace, "keep.txt"), "utf8"),
    ).resolves.toBe("active");
    await expect(
      readFile(path.join(orphanWorkspace, "remove.txt")),
    ).rejects.toThrow();
    await expect(
      readFile(path.join(outside, "keep.txt"), "utf8"),
    ).resolves.toBe("outside");
    await expect(lstat(linkedWorkspace)).rejects.toThrow();
  });

  it("rejects an upload directory redirected outside the workspace", async () => {
    const { root, sandbox, workspace } = await fixture();
    const outside = path.join(root, "outside");
    const source = path.join(root, "source.txt");
    await mkdir(outside);
    await writeFile(source, "upload");
    await symlink(outside, path.join(workspace, "uploads"), "junction");

    await expect(
      sandbox.stageUpload(conversation, "copied.txt", source),
    ).rejects.toThrow(/link|safe directory/i);
    await expect(readFile(path.join(outside, "copied.txt"))).rejects.toThrow();
  });

  it("replaces a linked upload target without modifying its host target", async () => {
    const { root, sandbox, workspace } = await fixture();
    const outside = path.join(root, "outside.txt");
    const source = path.join(root, "source.txt");
    const uploads = path.join(workspace, "uploads");
    await mkdir(uploads);
    await writeFile(outside, "keep me");
    await writeFile(source, "new upload");
    await symlink(outside, path.join(uploads, "copied.txt"), "file");

    await sandbox.stageUpload(conversation, "copied.txt", source);
    await expect(readFile(outside, "utf8")).resolves.toBe("keep me");
    await expect(
      readFile(path.join(uploads, "copied.txt"), "utf8"),
    ).resolves.toBe("new upload");
  });

  it("atomically exposes only active-branch uploads and preserves duplicate names", async () => {
    const { root, sandbox, workspace } = await fixture();
    const first = path.join(root, "first.csv");
    const second = path.join(root, "second.csv");
    const replacement = path.join(root, "replacement.csv");
    await writeFile(first, "first");
    await writeFile(second, "second");
    await writeFile(replacement, "replacement");

    await sandbox.stageUpload(conversation, "stale.csv", first);
    await sandbox.syncUploads(conversation, [
      { id: "first-id", fileName: "Report.csv", sourcePath: first },
      { id: "second-id", fileName: "report.csv", sourcePath: second },
    ]);

    const uploads = path.join(workspace, "uploads");
    expect((await readdir(uploads)).sort()).toEqual([
      "Report.csv",
      "_open_claude_manifest.json",
      "report (2).csv",
    ]);
    await expect(
      readFile(path.join(uploads, "Report.csv"), "utf8"),
    ).resolves.toBe("first");
    await expect(
      readFile(path.join(uploads, "report (2).csv"), "utf8"),
    ).resolves.toBe("second");
    const manifest = JSON.parse(
      await readFile(path.join(uploads, "_open_claude_manifest.json"), "utf8"),
    ) as { files: Array<{ id: string; original_name: string; path: string }> };
    expect(manifest.files).toEqual([
      {
        id: "first-id",
        original_name: "Report.csv",
        path: "/workspace/uploads/Report.csv",
        size_bytes: 5,
      },
      {
        id: "second-id",
        original_name: "report.csv",
        path: "/workspace/uploads/report (2).csv",
        size_bytes: 6,
      },
    ]);

    await sandbox.syncUploads(conversation, [
      {
        id: "replacement-id",
        fileName: "current.csv",
        sourcePath: replacement,
      },
    ]);
    expect((await readdir(uploads)).sort()).toEqual([
      "_open_claude_manifest.json",
      "current.csv",
    ]);
    await expect(readFile(path.join(uploads, "stale.csv"))).rejects.toThrow();
    await expect(readFile(path.join(uploads, "Report.csv"))).rejects.toThrow();
  });

  it("keeps the last good upload snapshot when reconciliation fails", async () => {
    const { root, sandbox, workspace } = await fixture();
    const original = path.join(root, "original.txt");
    const valid = path.join(root, "valid.txt");
    await writeFile(original, "original");
    await writeFile(valid, "valid");
    await sandbox.syncUploads(conversation, [
      { id: "original-id", fileName: "original.txt", sourcePath: original },
    ]);

    await expect(
      sandbox.syncUploads(conversation, [
        { id: "valid-id", fileName: "valid.txt", sourcePath: valid },
        {
          id: "missing-id",
          fileName: "missing.txt",
          sourcePath: path.join(root, "missing.txt"),
        },
      ]),
    ).rejects.toThrow();

    const uploads = path.join(workspace, "uploads");
    await expect(
      readFile(path.join(uploads, "original.txt"), "utf8"),
    ).resolves.toBe("original");
    await expect(readFile(path.join(uploads, "valid.txt"))).rejects.toThrow();
    expect(
      (await readdir(workspace)).filter((name) =>
        name.includes(".uploads.tmp"),
      ),
    ).toEqual([]);
  });

  it("validates all skill paths and sizes before staging any file", async () => {
    const { sandbox, workspace } = await fixture();
    await expect(
      sandbox.stageSkillFiles(conversation, "demo", [
        { path: "first.txt", content: "would be partial" },
        { path: "../escape.txt", content: "bad" },
      ]),
    ).rejects.toThrow("Invalid sandbox file path");
    await expect(
      readFile(path.join(workspace, "skills", "demo", "first.txt")),
    ).rejects.toThrow();
  });

  it("atomically replaces a skill tree and removes stale files", async () => {
    const { sandbox, workspace } = await fixture();
    await sandbox.stageSkillFiles(conversation, "demo", [
      { path: "SKILL.md", content: "version one" },
      { path: "stale.txt", content: "remove me" },
    ]);
    await sandbox.stageSkillFiles(conversation, "demo", [
      { path: "SKILL.md", content: "version two" },
      { path: "nested/kept.txt", content: "kept" },
    ]);
    const skillRoot = path.join(workspace, "skills", "demo");
    await expect(
      readFile(path.join(skillRoot, "SKILL.md"), "utf8"),
    ).resolves.toBe("version two");
    await expect(
      readFile(path.join(skillRoot, "nested", "kept.txt"), "utf8"),
    ).resolves.toBe("kept");
    await expect(readFile(path.join(skillRoot, "stale.txt"))).rejects.toThrow();
  });
});
