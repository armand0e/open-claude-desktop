import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
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

async function targetAt(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await response.json();
  return targets.find(
    (target) =>
      target.type === "page" &&
      target.url.startsWith("app://localhost") &&
      !target.url.startsWith("app://localhost/blank"),
  );
}

let commandId = 0;
async function cdp(target, method, params = {}) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("CDP connection timed out")),
      10_000,
    );
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener("error", reject, { once: true });
  });
  const id = ++commandId;
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${method} timed out`)),
        10_000,
      );
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        clearTimeout(timer);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  } finally {
    socket.close();
  }
}

async function evaluate(target, expression) {
  const result = await cdp(target, "Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Evaluation failed",
    );
  return result.result?.value;
}

async function eventually(port, operation, timeout = 35_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const target = await targetAt(port);
      if (target?.webSocketDebuggerUrl) return await operation(target);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError ?? new Error("Timed out waiting for the retained renderer");
}

async function click(target, rect) {
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
    button: "none",
  });
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
}

const sourceProfile =
  process.env.OPEN_CLAUDE_SEED_PROFILE ||
  path.join(process.env.APPDATA || "", "Open-Claude");
const sourceState = JSON.parse(
  await readFile(path.join(sourceProfile, "local-backend.json"), "utf8"),
);
const testSeededArtifact = process.env.OPEN_CLAUDE_TEST_SEEDED_ARTIFACT === "1";
const artifactConversationIds = new Set(
  sourceState.artifacts.map((artifact) => artifact.conversation_uuid),
);
const fixtureTime = new Date().toISOString();
for (const [index, conversation] of sourceState.conversations.entries()) {
  if (testSeededArtifact && artifactConversationIds.has(conversation.uuid)) {
    conversation.name = `Navigation artifact chat ${index + 1}`;
    conversation.updated_at = fixtureTime;
    continue;
  }
  const humanUuid = randomUUID();
  const assistantUuid = randomUUID();
  const marker = `CHAT_SWITCH_MARKER_${index + 1}`;
  conversation.name = `Navigation chat ${index + 1}`;
  conversation.updated_at = fixtureTime;
  conversation.current_leaf_message_uuid = assistantUuid;
  conversation.chat_messages = [
    {
      uuid: humanUuid,
      sender: "human",
      text: `Open navigation fixture ${index + 1}`,
      content: [
        {
          type: "text",
          text: `Open navigation fixture ${index + 1}`,
          citations: [],
        },
      ],
      created_at: fixtureTime,
      updated_at: fixtureTime,
      index: 0,
      attachments: [],
      files: [],
    },
    {
      uuid: assistantUuid,
      sender: "assistant",
      text: marker,
      content: [{ type: "text", text: marker, citations: [] }],
      created_at: fixtureTime,
      updated_at: fixtureTime,
      index: 1,
      parent_message_uuid: humanUuid,
      attachments: [],
      files: [],
    },
  ];
}
const selectedArtifactConversation = sourceState.conversations.find((item) =>
  artifactConversationIds.has(item.uuid),
);
const selectedConversationItems = [
  ...(selectedArtifactConversation ? [selectedArtifactConversation] : []),
  ...sourceState.conversations.filter(
    (item) => !artifactConversationIds.has(item.uuid),
  ),
].slice(0, 3);
const conversations = selectedConversationItems.map((item) => ({
  uuid: item.uuid,
  name: item.name,
  marker: (() => {
    const normalizedName = item.name.replace(/\s+/gu, " ").trim();
    const messages = item.chat_messages
      .map((message) => ({
        sender: message.sender,
        text: message.text?.replace(/\s+/gu, " ").trim() || "",
      }))
      .filter((message) => message.text);
    const human = messages.find(
      (message) =>
        message.sender === "human" &&
        !normalizedName.includes(message.text.slice(0, 36)),
    );
    if (human) return human.text.slice(0, 36);
    const assistant = messages.find(
      (message) =>
        message.sender === "assistant" &&
        !message.text.startsWith("```") &&
        !normalizedName.includes(message.text.slice(0, 48)),
    );
    return assistant?.text.slice(0, 48) || item.uuid;
  })(),
}));
assert(conversations.length >= 2, "The seed profile needs at least two chats");
const artifactConversation = sourceState.artifacts
  .slice()
  .reverse()
  .map((artifact) => ({
    conversation: conversations.find(
      (conversation) => conversation.uuid === artifact.conversation_uuid,
    ),
    title: artifact.title,
  }))
  .find((entry) => entry.conversation);

const profile = await mkdtemp(path.join(os.tmpdir(), "open-claude-chat-nav-"));
await writeFile(
  path.join(profile, "local-backend.json"),
  `${JSON.stringify(sourceState, null, 2)}\n`,
  "utf8",
);
const debuggerPort = await unusedPort();
const packagedExecutable = process.env.OPEN_CLAUDE_TEST_EXECUTABLE
  ? path.resolve(process.env.OPEN_CLAUDE_TEST_EXECUTABLE)
  : null;
const output = [];
const child = spawn(
  packagedExecutable ?? electron,
  [
    ...(packagedExecutable ? [] : ["."]),
    `--remote-debugging-port=${debuggerPort}`,
  ],
  {
    cwd: process.cwd(),
    windowsHide: false,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      OPEN_CLAUDE_USER_DATA_DIR: profile,
      CLAUDE_LOCAL_USER_DATA_DIR: profile,
      CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
      CLAUDE_DESKTOP_LOCAL_UI: "1",
      CLAUDE_TRACE_LOCAL_API: "1",
      CLAUDE_TRACE_LOCAL_UI: "1",
    },
  },
);
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => output.push(chunk));

try {
  const controls = await eventually(debuggerPort, async (target) => {
    const result = await evaluate(
      target,
      `(() => {
        const conversations = ${JSON.stringify(conversations)};
        const controls = conversations.map(conversation => {
          const byHref = [...document.querySelectorAll('a[href]')]
            .find(anchor => anchor.href.includes(conversation.uuid));
          const byText = [...document.querySelectorAll('a,button,[role="button"]')]
            .find(candidate => candidate.textContent?.includes(conversation.name.slice(0, 24)));
          const control = byHref || byText;
          return control ? {
            uuid: conversation.uuid,
            tag: control.tagName,
            href: control.getAttribute('href'),
            text: control.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 120),
            rect: control.getBoundingClientRect().toJSON()
          } : null;
        });
        return controls.every(Boolean) ? controls : null;
      })()`,
    );
    if (!result) throw new Error("Conversation controls are not ready");
    return result;
  });

  const sequence = testSeededArtifact
    ? [conversations[0], conversations[1], conversations[0]]
    : [
        conversations[0],
        conversations[1],
        conversations[0],
        conversations[1],
        ...(conversations[2] ? [conversations[2], conversations[0]] : []),
      ];
  const switched = [];
  for (const conversation of sequence) {
    const rect = await eventually(debuggerPort, async (target) => {
      const value = await evaluate(
        target,
        `(() => {
          const uuid = ${JSON.stringify(conversation.uuid)};
          const anchor = [...document.querySelectorAll('a[href]')]
            .find(candidate => candidate.href.includes(uuid));
          const textControl = [...document.querySelectorAll('a,button,[role="button"]')]
            .find(candidate => candidate.textContent?.includes(${JSON.stringify(conversation.name.slice(0, 24))}));
          return (anchor || textControl)?.getBoundingClientRect().toJSON() || null;
        })()`,
      );
      if (!value) throw new Error(`Missing chat control ${conversation.uuid}`);
      return value;
    });
    await click(await targetAt(debuggerPort), rect);
    const state = await eventually(debuggerPort, async (target) => {
      const value = await evaluate(
        target,
        `(() => ({
          href: location.href,
          path: location.pathname,
          markerVisible: document.body?.innerText?.includes(${JSON.stringify(conversation.marker)}) || false,
          titleVisible: document.body?.innerText?.includes(${JSON.stringify(conversation.name.slice(0, 24))}) || false,
          closeArtifactVisible: Boolean([...document.querySelectorAll('button[aria-label="Close artifact"]')]
            .find(button => button.getClientRects().length > 0))
        }))()`,
      );
      if (!value.href.includes(conversation.uuid) || !value.markerVisible)
        throw new Error(
          `Chat did not hydrate ${conversation.uuid}: ${JSON.stringify(value)}`,
        );
      return value;
    });
    switched.push({ uuid: conversation.uuid, ...state });
  }

  let artifactResult = {
    skipped: true,
    reason:
      "The navigation fixture copies only the local JSON store; live and persisted artifact lifecycle is covered by probe-real-chat.mjs artifact.",
  };
  if (testSeededArtifact) {
    assert(artifactConversation, "The seed profile needs a Chat artifact");
    const artifact = artifactConversation;
    const artifactControl = await eventually(debuggerPort, async (target) => {
      const value = await evaluate(
        target,
        `(() => {
        const uuid = ${JSON.stringify(artifact.conversation.uuid)};
        const anchor = [...document.querySelectorAll('a[href]')]
          .find(candidate => candidate.href.includes(uuid));
        const textControl = [...document.querySelectorAll('a,button,[role="button"]')]
          .find(candidate => candidate.textContent?.includes(${JSON.stringify(artifact.conversation.name.slice(0, 24))}));
        return (anchor || textControl)?.getBoundingClientRect().toJSON() || null;
      })()`,
      );
      if (!value) throw new Error("Artifact chat control is missing");
      return value;
    });
    await click(await targetAt(debuggerPort), artifactControl);
    await eventually(debuggerPort, async (target) => {
      const ready = await evaluate(
        target,
        `location.href.includes(${JSON.stringify(artifact.conversation.uuid)})`,
      );
      if (!ready) throw new Error("Artifact conversation is not open");
      return true;
    });

    const openArtifact = async () => {
      const open = await eventually(debuggerPort, async (target) => {
        const value = await evaluate(
          target,
          `(() => {
          const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).display !== 'none';
          const close = [...document.querySelectorAll('button[aria-label="Close artifact"]')].find(visible);
          if (close) return { alreadyOpen: true, rect: close.getBoundingClientRect().toJSON() };
           const title = ${JSON.stringify(artifact.title)};
           const candidates = [...document.querySelectorAll('button,[role="button"]')]
             .filter(visible);
           const matchesTitle = candidate => {
               const label = candidate.getAttribute('aria-label') || '';
               const text = candidate.textContent?.replace(/\\s+/g, ' ').trim() || '';
               return text.includes(title) || label.includes(title);
             };
           const control = candidates.find(candidate => candidate.getAttribute('aria-label') === 'View ' + title)
             || candidates.find(candidate => candidate.getAttribute('aria-label')?.includes(title))
             || candidates.find(matchesTitle);
           return control ? {
             alreadyOpen: false,
             rect: control.getBoundingClientRect().toJSON(),
             tag: control.tagName,
             label: control.getAttribute('aria-label'),
             text: control.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 160),
             html: control.outerHTML?.slice(0, 1200)
           } : {
             missing: true,
             href: location.href,
             bodyText: document.body?.innerText?.slice(-4000) || '',
             labeledButtons: candidates
               .map(candidate => ({
                 label: candidate.getAttribute('aria-label'),
                 text: candidate.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 160)
               }))
               .filter(candidate => candidate.label || candidate.text)
               .slice(-40)
           };
         })()`,
        );
        if (!value || value.missing)
          throw new Error(
            `Artifact open control is missing: ${JSON.stringify(value)}`,
          );
        return value;
      });
      if (!open.alreadyOpen)
        await eventually(debuggerPort, async (target) => {
          const clicked = await evaluate(
            target,
            `(() => {
            const title = ${JSON.stringify(artifact.title)};
            const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).display !== 'none';
            const candidates = [...document.querySelectorAll('button,[role="button"]')].filter(visible);
            const control = candidates.find(candidate => candidate.getAttribute('aria-label') === 'View ' + title)
              || candidates.find(candidate => candidate.getAttribute('aria-label')?.includes(title))
              || candidates.find(candidate => candidate.textContent?.includes(title));
            control?.click();
            return Boolean(control);
          })()`,
          );
          if (!clicked) throw new Error("Artifact open control disappeared");
          return true;
        });
      return eventually(debuggerPort, async (target) => {
        const value = await evaluate(
          target,
          `(() => {
          const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).display !== 'none';
          const close = [...document.querySelectorAll('button[aria-label="Close artifact"]')].find(visible);
          return close ? {
            rect: close.getBoundingClientRect().toJSON(),
            iframeCount: [...document.querySelectorAll('iframe[src^="app://artifacts.local"]')].filter(visible).length
          } : null;
        })()`,
        );
        if (!value) throw new Error("Artifact pane did not open");
        return value;
      });
    };

    const closeArtifact = async () => {
      const opened = await openArtifact();
      await click(await targetAt(debuggerPort), opened.rect);
      return eventually(debuggerPort, async (target) => {
        const value = await evaluate(
          target,
          `(() => {
          const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).display !== 'none';
          return {
            closeVisible: Boolean([...document.querySelectorAll('button[aria-label="Close artifact"]')].find(visible)),
            visibleIframes: [...document.querySelectorAll('iframe[src^="app://artifacts.local"]')].filter(visible).length
          };
        })()`,
        );
        if (value.closeVisible || value.visibleIframes)
          throw new Error(
            `Artifact pane stayed open: ${JSON.stringify(value)}`,
          );
        return value;
      });
    };

    const firstClose = await closeArtifact();
    const nonArtifactConversation = conversations.find(
      (conversation) => conversation.uuid !== artifact.conversation.uuid,
    );
    assert(nonArtifactConversation, "The seed profile needs a second chat");
    for (const destination of [
      nonArtifactConversation,
      artifact.conversation,
    ]) {
      const control = await eventually(debuggerPort, async (target) => {
        const value = await evaluate(
          target,
          `(() => {
            const uuid = ${JSON.stringify(destination.uuid)};
            const anchor = [...document.querySelectorAll('a[href]')]
              .find(candidate => candidate.href.includes(uuid));
            const textControl = [...document.querySelectorAll('a,button,[role="button"]')]
              .find(candidate => candidate.textContent?.includes(${JSON.stringify(destination.name.slice(0, 24))}));
            return (anchor || textControl)?.getBoundingClientRect().toJSON() || null;
          })()`,
        );
        if (!value) throw new Error(`Missing chat control ${destination.uuid}`);
        return value;
      });
      await click(await targetAt(debuggerPort), control);
      await eventually(debuggerPort, async (target) => {
        const ready = await evaluate(
          target,
          `location.href.includes(${JSON.stringify(destination.uuid)})`,
        );
        if (!ready) throw new Error(`Chat did not open ${destination.uuid}`);
        return true;
      });
    }
    const secondClose = await closeArtifact();
    artifactResult = {
      skipped: false,
      conversation: artifact.conversation.uuid,
      title: artifact.title,
      firstClose,
      secondClose,
      switchedAwayAndBack: true,
    };
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        runtime: packagedExecutable ? "packaged" : "development",
        controls,
        switchCount: switched.length,
        switched,
        artifact: artifactResult,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({ error: String(error), electronOutput: output.join("") }, null, 2)}\n`,
  );
  throw error;
} finally {
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  await rm(profile, { recursive: true, force: true });
}
