// electron-builder cannot reliably assemble AppImages from a Windows host: it
// may hang unpacking Electron and selects a non-Windows mksquashfs helper. Use
// the installed WSL2 Linux toolchain on Windows; other hosts run the builder
// directly. Arguments are fixed and WSL's native --cd option selects the
// workspace without interpolating it into a shell command.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${command} failed${signal ? ` with ${signal}` : ` with exit code ${code}`}`,
          ),
        );
    });
  });
}

function windowsPathToWsl(candidate) {
  const match = candidate.match(/^([A-Za-z]):[\\/](.*)$/u);
  if (!match)
    throw new Error(`Expected a Windows path, received: ${candidate}`);
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
}

if (process.platform === "win32") {
  const wslWorkspace = windowsPathToWsl(process.cwd());
  const npmCandidates = [
    process.env.npm_execpath,
    path.join(
      path.dirname(process.execPath),
      "node_modules",
      "npm",
      "bin",
      "npm-cli.js",
    ),
  ].filter((candidate) => typeof candidate === "string" && candidate.length);
  const npmCli = npmCandidates.find((candidate) => existsSync(candidate));
  if (!npmCli)
    throw new Error(
      `The active Windows Node/npm installation has no npm CLI at: ${npmCandidates.join(", ")}`,
    );
  const wslNpmCli = windowsPathToWsl(npmCli);
  const wslPath = `${wslWorkspace}/tools/wsl-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`;
  // Do not let WSL import the Windows PATH here. In particular, a user-level
  // `node_modules/.bin/node` shim can precede WSL's native Node and later make
  // electron-builder's dependency collector execute a Windows package shim as
  // a Linux script. Pin both the runtime and child-process PATH to WSL-native
  // binaries while packaging.
  await run("wsl.exe", [
    "--cd",
    wslWorkspace,
    "--",
    "/usr/bin/env",
    `PATH=${wslPath}`,
    "/usr/bin/node",
    "tools/fetch-moonshine.mjs",
  ]);
  await run("wsl.exe", [
    "--cd",
    wslWorkspace,
    "--",
    "/usr/bin/env",
    `PATH=${wslPath}`,
    `OPEN_CLAUDE_WSL_NPM_CLI=${wslNpmCli}`,
    "/usr/bin/node",
    "./node_modules/electron-builder/out/cli/cli.js",
    "--linux",
    "AppImage",
    "--x64",
  ]);
} else {
  await run(
    path.join(process.cwd(), "node_modules", ".bin", "electron-builder"),
    ["--linux", "AppImage", "--x64"],
  );
}
