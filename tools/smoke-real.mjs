import { spawnSync } from "node:child_process";

const baseUrl = process.env.CLAUDE_REAL_BASE_URL || "http://127.0.0.1:1234/v1";
const modelsResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/models`);
if (!modelsResponse.ok)
  throw new Error(
    `Real provider model discovery returned HTTP ${modelsResponse.status}`,
  );
const modelsBody = await modelsResponse.json();
const discovered = Array.isArray(modelsBody?.data)
  ? modelsBody.data.find((entry) => typeof entry?.id === "string")?.id
  : undefined;
const model = process.env.CLAUDE_REAL_MODEL || discovered;
if (!model) throw new Error("Real provider did not advertise a model ID");

const checks = [
  ["provider settings", ["tools/probe-real-settings.mjs"]],
  ["Chat", ["tools/probe-real-chat.mjs"]],
  ["Chat attachment", ["tools/probe-real-chat.mjs", "attachment"]],
  ["Chat artifact", ["tools/probe-real-chat.mjs", "artifact"]],
  ["Code", ["tools/smoke-local-code.mjs", "real"]],
  ["Code permission", ["tools/smoke-local-code.mjs", "real", "permission"]],
  ["Code terminal", ["tools/smoke-local-code.mjs", "real", "terminal"]],
  ["Code all tools", ["tools/smoke-local-code.mjs", "real", "all-tools"]],
];

process.stdout.write(
  `Live provider: ${baseUrl}\nModel: ${model}\nChecks: ${checks.length}\n`,
);
for (const [label, args] of checks) {
  process.stdout.write(`\n[real-smoke] ${label}\n`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CLAUDE_REAL_BASE_URL: baseUrl,
      CLAUDE_REAL_MODEL: model,
    },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${label} failed with exit code ${result.status}`);
}

process.stdout.write("\nAll live-provider checks passed.\n");
