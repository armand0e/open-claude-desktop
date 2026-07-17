// Optional public sharing for published artifacts: a tiny local HTTP server
// exposes /public/artifacts/<slug> pages and a localtunnel relay makes them
// reachable at a public https URL. The tunnel exists only while at least one
// artifact is published — publish starts it, the last unpublish stops it.

import { createServer, Server } from "node:http";
// localtunnel ships CommonJS without types.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import localtunnel from "localtunnel";

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

  constructor(private readonly source: TunnelArtifactSource) {}

  status(): { url: string | null; active: boolean } {
    return { url: this.#url, active: Boolean(this.#tunnel) };
  }

  // Called after publish; starts the server + tunnel when needed.
  async ensureStarted(): Promise<string | null> {
    if (this.#url) return this.#url;
    if (this.#starting) return this.#starting;
    this.#starting = (async () => {
      try {
        if (!this.#server) {
          this.#server = createServer((request, response) => {
            const match = (request.url ?? "").match(
              /^\/public\/artifacts\/([^/?#]+)/,
            );
            const artifact = match
              ? this.source
                  .publishedArtifacts()
                  .find((entry) => entry.slug === decodeURIComponent(match[1]))
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
            });
            response.end(page.body);
          });
          await new Promise<void>((resolve, reject) =>
            this.#server?.listen(0, "127.0.0.1", resolve).once("error", reject),
          );
        }
        const address = this.#server.address();
        const port =
          typeof address === "object" && address ? address.port : null;
        if (!port) throw new Error("Share server failed to bind");
        const tunnel = (await localtunnel({ port })) as ActiveTunnel;
        this.#tunnel = tunnel;
        this.#url = tunnel.url.replace(/\/$/, "");
        tunnel.on("close", () => {
          if (this.#tunnel === tunnel) {
            this.#tunnel = null;
            this.#url = null;
          }
        });
        return this.#url;
      } catch {
        return null;
      } finally {
        this.#starting = null;
      }
    })();
    return this.#starting;
  }

  // Called after unpublish; tears everything down once nothing is shared.
  stopIfIdle(): void {
    if (this.source.publishedArtifacts().length > 0) return;
    this.dispose();
  }

  dispose(): void {
    this.#tunnel?.close();
    this.#tunnel = null;
    this.#url = null;
    this.#server?.close();
    this.#server = null;
  }
}
