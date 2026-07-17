import { spawnSync } from "node:child_process";

const baseUrl = process.env.CLAUDE_REAL_BASE_URL || "http://127.0.0.1:1234/v1";
const apiKey = process.env.CLAUDE_LOCAL_API_KEY;
const modelsResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
  headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
});
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
  ["top navigation", ["tools/probe-real-navigation.mjs"]],
  ["conversation switching", ["tools/probe-real-chat-navigation.mjs"]],
  ["file preview", ["tools/probe-real-file-preview.mjs"]],
  ["launch preview", ["tools/probe-real-launch-preview.mjs"]],
  ["artifact gallery", ["tools/probe-real-artifact-gallery.mjs"]],
  ["Chat", ["tools/probe-real-chat.mjs"]],
  ["Chat attachment", ["tools/probe-real-chat.mjs", "attachment"]],
  ["Chat artifact", ["tools/probe-real-chat.mjs", "artifact"]],
  ["Code", ["tools/smoke-local-code.mjs", "real"]],
  ["Code permission", ["tools/smoke-local-code.mjs", "real", "permission"]],
  ["Code bypass", ["tools/smoke-local-code.mjs", "real", "bypass"]],
  ["Code terminal", ["tools/smoke-local-code.mjs", "real", "terminal"]],
];
const diagnostics = [
  [
    "tiny-model all-tools stress",
    ["tools/smoke-local-code.mjs", "real", "all-tools"],
  ],
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
    windowsHide: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${label} failed with exit code ${result.status}`);
}

process.stdout.write("\nAll live-provider checks passed.\n");
for (const [label, args] of diagnostics) {
  process.stdout.write(`\n[real-diagnostic] ${label}\n`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CLAUDE_REAL_BASE_URL: baseUrl,
      CLAUDE_REAL_MODEL: model,
    },
    stdio: "inherit",
    windowsHide: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    process.stdout.write(
      `[real-diagnostic] ${label} was not completed by ${model}; deterministic tool-contract coverage remains release-blocking.\n`,
    );
}
