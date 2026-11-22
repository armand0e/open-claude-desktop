import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";

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

async function waitForReady(port, output, child) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(
        `Packaged Open-Claude exited before rendering (${child.exitCode}): ${output.join("")}`,
      );
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find(
        (target) =>
          target.type === "page" &&
          target.url.startsWith("app://localhost") &&
          !target.url.startsWith("app://localhost/blank"),
      );
      if (page) return page;
    } catch {
      // Electron publishes its target list shortly after launch.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Timed out waiting for packaged Open-Claude: ${output.join("")}`,
  );
}

const executable = path.resolve(
  process.argv[2] || path.join("release", "win-unpacked", "Open-Claude.exe"),
);
assert(existsSync(executable), `Packaged executable is missing: ${executable}`);
const appImage = executable.endsWith(".AppImage");
const resources = path.join(path.dirname(executable), "resources");
if (!appImage) {
  assert(
    existsSync(path.join(resources, "ion-dist", "index.html")),
    "The retained Claude UI is not bundled beside the packaged executable",
  );
  assert(existsSync(path.join(resources, "app.asar")), "app.asar is missing");
}

const testRoot = await mkdtemp(path.join(os.tmpdir(), "open-claude-package-"));
const profile = path.join(testRoot, "Open-Claude");
const port = await unusedPort();
const output = [];
const child = spawn(
  executable,
  [...(appImage ? ["--no-sandbox"] : []), `--remote-debugging-port=${port}`],
  {
    env: {
      ...process.env,
      OPEN_CLAUDE_USER_DATA_DIR: profile,
      CLAUDE_TRACE_APP_IDENTITY: "1",
      CLAUDE_DESKTOP_LOCAL_UI: "1",
      ...(appImage ? { TMPDIR: testRoot } : {}),
    },
    detached: appImage && process.platform !== "win32",
    windowsHide: false,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => output.push(chunk));

try {
  const page = await waitForReady(port, output, child);
  const identityMatch = output
    .join("")
    .match(/\[local-app-identity\] (\{[^\r\n]+\})/u);
  assert(
    identityMatch,
    `Packaged identity proof is missing: ${output.join("")}`,
  );
  const identity = JSON.parse(identityMatch[1]);
  assert(identity.name === "Open-Claude", `Wrong identity: ${identity.name}`);
  assert(
    path.resolve(identity.userData) === path.resolve(profile),
    `Packaged profile escaped its namespace: ${identity.userData}`,
  );
  assert(
    output.join("").includes("[local-navigation] document app://localhost") ||
      page.url.startsWith("app://localhost"),
    "Packaged app did not load the retained local UI",
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        executable,
        identity,
        page: page.url,
        bundledUi: true,
        appAsar: true,
        appImage,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  if (appImage && process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      if (child.exitCode === null) child.kill();
    }
  } else if (child.exitCode === null) child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  await rm(testRoot, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}
