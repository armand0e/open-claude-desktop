import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) =>
    server.listen(0, "127.0.0.1", resolve).once("error", reject),
  );
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return typeof address === "object" && address ? address.port : 0;
}

async function waitForIdentity(output, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(
        `Claude Local exited before identity proof (${child.exitCode})`,
      );
    const match = output
      .join("")
      .match(/\[local-app-identity\] (\{[^\r\n]+\})/);
    if (match) return JSON.parse(match[1]);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for Claude Local identity proof");
}

async function waitForPage(port, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(
        `Claude Local exited before rendering (${child.exitCode})`,
      );
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      if (
        targets.some(
          (target) =>
            target.type === "page" && target.url.startsWith("app://localhost"),
        )
      )
        return;
    } catch {
      // Chromium publishes the target list shortly after binding the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for the standalone app page");
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}

const appData = await mkdtemp(path.join(os.tmpdir(), "claude-local-identity-"));
const expectedUserData = path.join(appData, "Claude Local");
const output = [];
const firstPort = await unusedPort();
const env = {
  ...process.env,
  CLAUDE_LOCAL_USER_DATA_DIR: expectedUserData,
  CLAUDE_TRACE_APP_IDENTITY: "1",
  CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
};
delete env.CLAUDE_USER_DATA_DIR;

const first = spawn(electron, [".", `--remote-debugging-port=${firstPort}`], {
  cwd: process.cwd(),
  env,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
first.stdout.setEncoding("utf8");
first.stdout.on("data", (chunk) => output.push(chunk));
first.stderr.setEncoding("utf8");
first.stderr.on("data", (chunk) => output.push(chunk));

let second;
try {
  const identity = await waitForIdentity(output, first);
  await waitForPage(firstPort, first);
  assert(identity.name === "Claude Local", `Wrong app name: ${identity.name}`);
  assert(
    path.resolve(identity.userData) === path.resolve(expectedUserData),
    `Wrong userData path: ${identity.userData}`,
  );
  for (const key of ["sessionData", "cache", "logs", "crashDumps"]) {
    const relative = path.relative(expectedUserData, identity[key]);
    assert(
      relative && !relative.startsWith("..") && !path.isAbsolute(relative),
      `${key} escaped the Claude Local profile: ${identity[key]}`,
    );
  }
  assert(
    !existsSync(path.join(appData, "Claude")),
    "Standalone launch created an official Claude profile",
  );

  const secondPort = await unusedPort();
  second = spawn(electron, [".", `--remote-debugging-port=${secondPort}`], {
    cwd: process.cwd(),
    env,
    windowsHide: true,
    stdio: "ignore",
  });
  const secondExit = await Promise.race([
    new Promise((resolve) => second.once("exit", (code) => resolve(code))),
    new Promise((resolve) => setTimeout(() => resolve("timeout"), 10_000)),
  ]);
  assert(
    secondExit !== "timeout",
    "Claude Local single-instance lock did not engage",
  );
  assert(
    first.exitCode === null,
    "Second local launch terminated the first instance",
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        identity,
        officialProfileCreated: false,
        localSingleInstanceLock: true,
        firstStillRunning: true,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  if (second) await stop(second);
  await stop(first);
  const resolved = path.resolve(appData);
  assert(
    path.dirname(resolved) === path.resolve(os.tmpdir()) &&
      path.basename(resolved).startsWith("claude-local-identity-"),
    `Refusing to remove unexpected identity test directory: ${resolved}`,
  );
  await rm(resolved, { recursive: true, force: true });
}
