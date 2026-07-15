import process from "node:process";

const [rawPort = "9225", targetPattern = "claude.ai", ...expressions] =
  process.argv.slice(2);
const port = Number.parseInt(rawPort, 10);
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(
  (response) => response.json(),
);
const target = targets.find((candidate) =>
  candidate.url.includes(targetPattern),
);
if (!target?.webSocketDebuggerUrl)
  throw new Error(`No CDP target matched ${targetPattern}`);

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
function send(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const listener = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener("message", listener);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    };
    socket.addEventListener("message", listener);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

for (const expression of expressions) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  process.stdout.write(
    `${JSON.stringify({ expression, result: result.result?.value }, null, 2)}\n`,
  );
}

socket.close();
