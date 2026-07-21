// Starts the real Electron scheduler with an overdue routine and a local
// OpenAI-compatible provider, then proves the routine creates and completes a
// durable Code session without renderer interaction.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const profile = await mkdtemp(path.join(os.tmpdir(), "open-claude-routine-"));
const workspace = await mkdtemp(path.join(os.tmpdir(), "routine-workspace-"));
const prompt = "Return exactly SCHEDULED_RUNTIME_OK.";
const tasksFile = path.join(profile, "local-scheduled-tasks.json");
await writeFile(
  tasksFile,
  `${JSON.stringify(
    {
      version: 1,
      tasks: [
        {
          id: "runtime-proof",
          name: "runtime-proof",
          displayName: "Runtime proof",
          description: "End-to-end scheduler probe",
          prompt,
          cronExpression: "* * * * *",
          cwd: workspace,
          status: "active",
          createdAt: new Date().toISOString(),
          lastRunAt: null,
          nextRunAt: Date.now() - 60_000,
          pendingRunAt: null,
          runCount: 0,
        },
      ],
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const providerRequests = [];
const provider = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "routine-proof-model" }] }));
    return;
  }
  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    let body = "";
    for await (const chunk of request) body += chunk;
    providerRequests.push(JSON.parse(body));
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: "SCHEDULED_RUNTIME_OK",
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 4 },
      }),
    );
    return;
  }
  response.writeHead(404).end();
});
const providerPort = await new Promise((resolve, reject) => {
  provider
    .listen(0, "127.0.0.1", () => {
      const address = provider.address();
      if (!address || typeof address === "string")
        reject(new Error("Provider did not bind"));
      else resolve(address.port);
    })
    .once("error", reject);
});

const output = [];
const child = spawn(electron, ["."], {
  cwd: process.cwd(),
  windowsHide: false,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    OPEN_CLAUDE_USER_DATA_DIR: profile,
    CLAUDE_LOCAL_USER_DATA_DIR: profile,
    CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
    CLAUDE_DESKTOP_LOCAL_UI: "1",
    CLAUDE_LOCAL_BASE_URL: `http://127.0.0.1:${providerPort}/v1`,
    CLAUDE_LOCAL_MODEL: "routine-proof-model",
    CLAUDE_LOCAL_API_KEY: "routine-proof-key",
  },
});
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => output.push(chunk));

try {
  const deadline = Date.now() + 45_000;
  let proof;
  let lastError;
  let latest;
  while (!proof && Date.now() < deadline) {
    try {
      const tasks = JSON.parse(await readFile(tasksFile, "utf8"));
      const sessions = JSON.parse(
        await readFile(path.join(profile, "local-code-sessions.json"), "utf8"),
      );
      const task = tasks.tasks?.find((entry) => entry.id === "runtime-proof");
      const session = sessions.sessions?.find(
        (entry) => entry.sessionId === task?.lastRunSessionId,
      );
      const transcript = JSON.stringify(session?.transcript ?? []);
      const hasAssistantProof = session?.transcript?.some(
        (entry) =>
          entry?.type === "assistant" &&
          entry?.message?.content?.some(
            (block) =>
              block?.type === "text" &&
              block?.text?.includes("SCHEDULED_RUNTIME_OK"),
          ),
      );
      latest = { task, session, hasAssistantProof };
      if (
        task?.runCount === 1 &&
        task.pendingRunAt === null &&
        session?.isRunning === false &&
        session?.scheduledTaskId === "runtime-proof" &&
        hasAssistantProof
      )
        proof = { task, session, transcript };
    } catch (error) {
      lastError = error;
    }
    if (!proof) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!proof)
    throw new Error(
      `The scheduled Code session did not complete: ${JSON.stringify(latest ?? { lastError: String(lastError) })}`,
    );
  assert(
    providerRequests.length >= 1,
    "The routine did not reach the model provider",
  );
  assert(
    providerRequests.some((request) =>
      JSON.stringify(request?.messages ?? []).includes(prompt),
    ),
    "The scheduled prompt did not reach the model provider",
  );
  console.log(
    JSON.stringify(
      {
        scheduledTaskId: proof.task.id,
        runCount: proof.task.runCount,
        sessionId: proof.task.lastRunSessionId,
        sessionCompleted: !proof.session.isRunning,
        providerRequests: providerRequests.length,
        finalText: "SCHEDULED_RUNTIME_OK",
      },
      null,
      2,
    ),
  );
  console.log("SCHEDULED RUN PROBE OK");
} catch (error) {
  console.error(error);
  console.error(output.join(""));
  process.exitCode = 1;
} finally {
  if (child.exitCode === null) {
    child.kill();
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
  await new Promise((resolve) => provider.close(resolve));
  await rm(profile, { recursive: true, force: true });
  await rm(workspace, { recursive: true, force: true });
}
