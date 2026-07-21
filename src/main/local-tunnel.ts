// Optional public sharing for published artifacts: a tiny local HTTP server
// exposes /public/artifacts/<slug> pages and a localtunnel relay makes them
// reachable at a public https URL. The tunnel exists only while at least one
// artifact is published — publish starts it, the last unpublish stops it.

import { createServer, Server } from "node:http";
import net from "node:net";
// Reuse localtunnel's socket cluster, but replace its unbounded Axios metadata
// retry loop with the bounded, abortable bootstrap below. The package does not
// expose this class or ship TypeScript declarations.
// @ts-expect-error -- untyped internal CommonJS module
import TunnelClient from "localtunnel/lib/Tunnel.js";

export interface TunnelArtifactSource {
  publishedArtifacts(): Array<{
    slug: string;
    title: string;
    type: string;
    content: string;
  }>;
}

interface ActiveTunnel {
  url: string;
  close(): void;
  on(event: string, handler: () => void): void;
}

type TunnelFactory = (options: {
  port: number;
  signal?: AbortSignal;
}) => Promise<ActiveTunnel>;

const TUNNEL_START_TIMEOUT_MS = 30_000;
const MAX_TUNNEL_METADATA_BYTES = 64 * 1024;

export function isPublicTunnelAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b, c] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }
  if (!net.isIPv6(address)) return false;
  const first = Number.parseInt(address.split(":", 1)[0] || "0", 16);
  const normalized = address.toLowerCase();
  return (
    first >= 0x2000 &&
    first <= 0x3fff &&
    !normalized.startsWith("2001:db8:") &&
    !normalized.startsWith("2002:") &&
    !normalized.startsWith("3fff:")
  );
}

type TunnelClientInstance = ActiveTunnel & {
  _getInfo(body: Record<string, unknown>): unknown;
  _init(
    callback: (error?: Error | null, info?: unknown) => void,
  ): void | Promise<void>;
  open(callback: (error?: Error | null) => void): void;
};

async function tunnelMetadata(
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetch("https://localtunnel.me/?new", {
    signal,
    redirect: "error",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Public tunnel service returned HTTP ${response.status}`);
  }
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_TUNNEL_METADATA_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Public tunnel metadata exceeded the safety limit");
  }
  if (!response.body) throw new Error("Public tunnel service returned no data");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_TUNNEL_METADATA_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("Public tunnel metadata exceeded the safety limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    throw new Error("Public tunnel service returned invalid metadata");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Public tunnel service returned invalid metadata");
  const value = parsed as Record<string, unknown>;
  const publicUrl = typeof value.url === "string" ? value.url : "";
  const remotePort = Number(value.port);
  const remoteIp = typeof value.ip === "string" ? value.ip : "";
  const id = typeof value.id === "string" ? value.id : "";
  let parsedPublicUrl: URL;
  try {
    parsedPublicUrl = new URL(publicUrl);
  } catch {
    throw new Error("Public tunnel service returned an invalid URL");
  }
  const publicHostname = parsedPublicUrl.hostname.toLowerCase();
  if (
    parsedPublicUrl.protocol !== "https:" ||
    !(
      publicHostname === "loca.lt" ||
      publicHostname.endsWith(".loca.lt") ||
      publicHostname === "localtunnel.me" ||
      publicHostname.endsWith(".localtunnel.me")
    ) ||
    !id ||
    id.length > 512 ||
    id.includes("\0") ||
    !remoteIp ||
    remoteIp.length > 253 ||
    remoteIp.includes("\0") ||
    !isPublicTunnelAddress(remoteIp) ||
    !Number.isInteger(remotePort) ||
    remotePort < 1 ||
    remotePort > 65_535
  )
    throw new Error("Public tunnel service returned unsafe metadata");
  return {
    ...value,
    id,
    ip: remoteIp,
    port: remotePort,
    url: parsedPublicUrl.toString(),
    // A malicious/buggy service response cannot create an unbounded socket
    // fan-out inside the desktop process.
    max_conn_count: Math.min(
      8,
      Math.max(1, Math.floor(Number(value.max_conn_count) || 1)),
    ),
  };
}

async function openBoundedTunnel(options: {
  port: number;
  signal?: AbortSignal;
}): Promise<ActiveTunnel> {
  const client = new TunnelClient({
    port: options.port,
  }) as TunnelClientInstance;
  client._init = (callback) => {
    void tunnelMetadata(options.signal).then(
      (metadata) => callback(null, client._getInfo(metadata)),
      (error) =>
        callback(error instanceof Error ? error : new Error(String(error))),
    );
  };
  if (options.signal?.aborted)
    throw new Error("Public tunnel startup was cancelled");
  const onAbort = () => client.close();
  options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await new Promise<ActiveTunnel>((resolve, reject) => {
      client.open((error) => (error ? reject(error) : resolve(client)));
    });
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ??
      character,
  );
}

function artifactPage(artifact: {
  title: string;
  type: string;
  content: string;
}): { body: string; contentType: string } {
  if (artifact.type === "text/html")
    return { body: artifact.content, contentType: "text/html; charset=utf-8" };
  if (artifact.type === "image/svg+xml")
    return {
      body: `<!doctype html><meta charset="utf-8"><title>${escapeHtml(artifact.title)}</title><style>html,body{margin:0;display:grid;place-items:center;min-height:100vh;background:#fff}svg{max-width:96vw;max-height:96vh}</style>${artifact.content}`,
      contentType: "text/html; charset=utf-8",
    };
  return {
    body: `<!doctype html><meta charset="utf-8"><title>${escapeHtml(artifact.title)}</title><style>body{margin:0;font:15px/1.6 ui-sans-serif,system-ui;padding:32px;max-width:900px;margin-inline:auto;color:#1a1915}pre{white-space:pre-wrap;font:13px/1.55 ui-monospace,monospace;background:#f6f5f1;padding:20px;border-radius:12px}</style><h1>${escapeHtml(artifact.title)}</h1><pre>${escapeHtml(artifact.content)}</pre>`,
    contentType: "text/html; charset=utf-8",
  };
}

export class LocalArtifactTunnel {
  #server: Server | null = null;
  #tunnel: ActiveTunnel | null = null;
  #url: string | null = null;
  #starting: Promise<string | null> | null = null;
  #startingRevision = -1;
  #startingAbort: AbortController | null = null;
  #revision = 0;

  constructor(
    private readonly source: TunnelArtifactSource,
    private readonly openTunnel: TunnelFactory = openBoundedTunnel,
    private readonly startTimeoutMs = TUNNEL_START_TIMEOUT_MS,
  ) {}

  status(): { url: string | null; active: boolean } {
    return { url: this.#url, active: Boolean(this.#tunnel) };
  }

  // Called after publish; starts the server + tunnel when needed.
  async ensureStarted(): Promise<string | null> {
    if (this.#url) return this.#url;
    if (this.#starting && this.#startingRevision === this.#revision)
      return this.#starting;
    const revision = this.#revision;
    let starting!: Promise<string | null>;
    starting = (async () => {
      try {
        let server = this.#server;
        if (!server) {
          server = createServer((request, response) => {
            if (request.method !== "GET" && request.method !== "HEAD") {
              response.writeHead(405, { Allow: "GET, HEAD" });
              response.end();
              return;
            }
            const match = (request.url ?? "").match(
              /^\/public\/artifacts\/([^/?#]+)\/?(?:[?#].*)?$/,
            );
            let slug: string | undefined;
            try {
              slug = match ? decodeURIComponent(match[1]) : undefined;
            } catch {
              slug = undefined;
            }
            const artifact = slug
              ? this.source
                  .publishedArtifacts()
                  .find((entry) => entry.slug === slug)
              : undefined;
            if (!artifact) {
              response.writeHead(404, {
                "Content-Type": "text/plain; charset=utf-8",
              });
              response.end("This artifact is no longer shared.");
              return;
            }
            const page = artifactPage(artifact);
            response.writeHead(200, {
              "Content-Type": page.contentType,
              "Cache-Control": "no-store",
              "X-Robots-Tag": "noindex",
              "X-Content-Type-Options": "nosniff",
              "Referrer-Policy": "no-referrer",
            });
            response.end(request.method === "HEAD" ? undefined : page.body);
          });
          this.#server = server;
          const listeningServer = server;
          await new Promise<void>((resolve, reject) =>
            listeningServer
              .listen(0, "127.0.0.1", resolve)
              .once("error", reject),
          );
        }
        if (revision !== this.#revision) return null;
        if (!server) throw new Error("Share server was not created");
        const address = server.address();
        const port =
          typeof address === "object" && address ? address.port : null;
        if (!port) throw new Error("Share server failed to bind");
        const startAbort = new AbortController();
        this.#startingAbort = startAbort;
        const attempt = this.openTunnel({
          port,
          signal: startAbort.signal,
        });
        let timeout: NodeJS.Timeout | undefined;
        let tunnel: ActiveTunnel;
        try {
          tunnel = await Promise.race([
            attempt,
            new Promise<never>((_resolve, reject) => {
              timeout = setTimeout(() => {
                startAbort.abort();
                reject(new Error("Public tunnel startup timed out"));
              }, this.startTimeoutMs);
              timeout.unref?.();
            }),
          ]);
        } catch (error) {
          // A tunnel library can resolve after our timeout. Close that late
          // relay so a caller that already saw failure cannot accidentally
          // leave a public endpoint alive.
          void attempt.then(
            (lateTunnel) => lateTunnel.close(),
            () => undefined,
          );
          throw error;
        } finally {
          if (timeout) clearTimeout(timeout);
          if (this.#startingAbort === startAbort) this.#startingAbort = null;
        }
        if (
          revision !== this.#revision ||
          this.source.publishedArtifacts().length === 0
        ) {
          tunnel.close();
          return null;
        }
        this.#tunnel = tunnel;
        this.#url = tunnel.url.replace(/\/$/, "");
        tunnel.on("close", () => {
          if (this.#tunnel === tunnel) {
            this.#tunnel = null;
            this.#url = null;
          }
        });
        tunnel.on("error", () => {
          if (this.#tunnel === tunnel) {
            tunnel.close();
            this.#tunnel = null;
            this.#url = null;
          }
        });
        return this.#url;
      } catch {
        return null;
      } finally {
        if (this.#starting === starting) {
          this.#starting = null;
          this.#startingRevision = -1;
        }
      }
    })();
    this.#starting = starting;
    this.#startingRevision = revision;
    return starting;
  }

  // Called after unpublish; tears everything down once nothing is shared.
  stopIfIdle(): void {
    if (this.source.publishedArtifacts().length > 0) return;
    this.dispose();
  }

  dispose(): void {
    this.#revision += 1;
    this.#startingAbort?.abort();
    this.#startingAbort = null;
    this.#tunnel?.close();
    this.#tunnel = null;
    this.#url = null;
    this.#server?.close();
    this.#server?.closeAllConnections();
    this.#server = null;
  }
}
