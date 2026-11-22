import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const executable = path.resolve(
  process.argv[2] || path.join("release", "win-unpacked", "Open-Claude.exe"),
);
if (!existsSync(executable))
  throw new Error(`Packaged executable is missing: ${executable}`);

function run(script, args = [], packaged = true) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: process.cwd(),
      stdio: "inherit",
      windowsHide: false,
      env: packaged
        ? {
            ...process.env,
            OPEN_CLAUDE_TEST_EXECUTABLE: executable,
            OPEN_CLAUDE_MOONSHINE_ROOT: path.join(
              path.dirname(executable),
              "resources",
              "moonshine",
            ),
          }
        : process.env,
    });
    const timer = setTimeout(() => {
      if (process.platform === "win32")
        spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      else child.kill("SIGTERM");
      reject(new Error(`${script} timed out after 180000ms`));
    }, 180_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${script} failed${signal ? ` with ${signal}` : ` with exit code ${code}`}`,
          ),
        );
    });
  });
}

const gates = [
  ["tools/smoke-packaged.mjs", [executable], false],
  ["tools/smoke-local-chat.mjs", [], true],
  ["tools/smoke-local-code.mjs", [], true],
  ["tools/probe-background-tasks.mjs", [], true],
  ["tools/probe-route-audit.mjs", [], true],
  ["tools/probe-settings-directory.mjs", [], true],
  ["tools/probe-plugins.mjs", [], true],
  ["tools/probe-scheduled-run.mjs", [], true],
  ["tools/probe-real-file-preview.mjs", [], true],
  ["tools/probe-real-launch-preview.mjs", [], true],
  ["tools/probe-real-code-browser.mjs", [], true],
  ["tools/probe-real-code-artifact-selection.mjs", [], true],
  ["tools/probe-moonshine.mjs", [], true],
  ["tools/probe-dictation-stream.mjs", [], true],
];
const startedAt = Date.now();
for (const [script, args, packaged] of gates) {
  process.stdout.write(`\n[packaged-gate] ${script}\n`);
  await run(script, args, packaged);
}
process.stdout.write(
  `${JSON.stringify(
    {
      executable,
      gates: gates.map(([script]) => script),
      elapsedMs: Date.now() - startedAt,
    },
    null,
    2,
  )}\n`,
);
