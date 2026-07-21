// Exercises the real authenticated search child with its persistent Chrome
// profile, stealth plugin, guarded egress proxy, provider fallbacks, and visit
// extraction. This catches package/runtime failures that source-only tests do
// not, including the former missing stealth dependencies and ERR_ABORTED loop.
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const profile = await mkdtemp(path.join(os.tmpdir(), "open-claude-search-"));
const token = `search-probe-${crypto.randomUUID()}`;
const output = [];
const packagedExecutable = process.env.OPEN_CLAUDE_TEST_EXECUTABLE
  ? path.resolve(process.env.OPEN_CLAUDE_TEST_EXECUTABLE)
  : null;
const proxyScript = packagedExecutable
  ? path.join(
      path.dirname(packagedExecutable),
      "resources",
      "app.asar",
      "src",
      "main",
      "local-search-proxy.cjs",
    )
  : "src/main/local-search-proxy.cjs";
const child = spawn(packagedExecutable ?? process.execPath, [proxyScript], {
  cwd: process.cwd(),
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    PORT: "0",
    PROFILE_DIR: profile,
    AUTH_TOKEN: token,
    CHANNEL: "chrome",
    ...(packagedExecutable ? { ELECTRON_RUN_AS_NODE: "1" } : {}),
  },
});
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.on("data", (chunk) => output.push(chunk));

async function baseUrl() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const match = output
      .join("")
      .match(/claude-local-search-proxy (http:\/\/127\.0\.0\.1:\d+)/u);
    if (match) return match[1];
    if (child.exitCode !== null)
      throw new Error(
        `Search proxy exited ${child.exitCode}: ${output.join("")}`,
      );
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Search proxy did not start: ${output.join("")}`);
}

async function request(base, route) {
  const response = await fetch(`${base}${route}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json();
  assert(response.ok, `${route} returned HTTP ${response.status}`);
  assert(payload.success, `${route} failed: ${payload.error}`);
  return payload;
}

try {
  const base = await baseUrl();
  const health = await request(base, "/health");
  assert(
    health.mode === "headless+stealth",
    `Unexpected browser mode: ${health.mode}`,
  );

  const queries = [
    "NVIDIA DGX Spark product",
    "DGX Spark AI computer",
    '"DGX Spark" NVIDIA AI computer 2025',
  ];
  const searches = [];
  for (const query of queries) {
    const payload = await request(
      base,
      `/search?q=${encodeURIComponent(query)}`,
    );
    assert(
      Array.isArray(payload.results) && payload.results.length >= 3,
      `Too few results for ${query}: ${JSON.stringify(payload)}`,
    );
    assert(
      payload.results.every((entry) => /^https?:\/\//u.test(entry.url)),
      `Search returned a non-web URL for ${query}`,
    );
    searches.push({ query, count: payload.results.length });
  }

  const first = await request(
    base,
    `/search?q=${encodeURIComponent("NVIDIA DGX Spark official")}`,
  );
  const nvidia = first.results.find((entry) =>
    /(^|\.)nvidia\.com$/u.test(new URL(entry.url).hostname),
  );
  assert(nvidia, "Search did not return an NVIDIA result to visit");
  const visited = await request(
    base,
    `/fetch?url=${encodeURIComponent(nvidia.url)}&q=${encodeURIComponent("DGX Spark")}`,
  );
  assert(
    typeof visited.content === "string" && visited.content.length > 200,
    "Visit extraction returned too little content",
  );

  console.log(
    JSON.stringify(
      {
        health,
        searches,
        visited: { url: visited.url, contentLength: visited.content.length },
      },
      null,
      2,
    ),
  );
  console.log("PROBE OK: search-proxy");
} catch (error) {
  console.error(error);
  console.error(output.join("").slice(-4_000));
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
}
