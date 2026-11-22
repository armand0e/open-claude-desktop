import { describe, expect, it, vi } from "vitest";
import {
  isPublicTunnelAddress,
  LocalArtifactTunnel,
} from "../src/main/local-tunnel";

const source = {
  publishedArtifacts: () => [
    {
      slug: "proof",
      title: "Proof",
      type: "text/plain",
      content: "proof",
    },
  ],
};

describe("LocalArtifactTunnel lifecycle", () => {
  it("rejects private, mapped, and documentation tunnel endpoints", () => {
    expect(isPublicTunnelAddress("127.0.0.1")).toBe(false);
    expect(isPublicTunnelAddress("169.254.169.254")).toBe(false);
    expect(isPublicTunnelAddress("192.0.2.1")).toBe(false);
    expect(isPublicTunnelAddress("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicTunnelAddress("2001:db8::1")).toBe(false);
    expect(isPublicTunnelAddress("8.8.8.8")).toBe(true);
    expect(isPublicTunnelAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("closes and forgets a relay that reports an error", async () => {
    const handlers = new Map<string, () => void>();
    const close = vi.fn(() => handlers.get("close")?.());
    const verify = vi.fn(async () => undefined);
    const tunnel = new LocalArtifactTunnel(
      source,
      async () => ({
        url: "https://proof.example/",
        close,
        on: (event, handler) => handlers.set(event, handler),
      }),
      30_000,
      verify,
    );

    await expect(tunnel.ensureStarted()).resolves.toBe("https://proof.example");
    expect(verify).toHaveBeenCalledWith(
      "https://proof.example/",
      "proof",
      expect.any(AbortSignal),
    );
    handlers.get("error")?.();
    expect(close).toHaveBeenCalledOnce();
    expect(tunnel.status()).toEqual({ url: null, active: false });
    tunnel.dispose();
  });

  it("revokes published state when an established relay disconnects", async () => {
    const handlers = new Map<string, () => void>();
    const revokePublishedArtifacts = vi.fn(async () => undefined);
    const close = vi.fn(() => handlers.get("close")?.());
    const tunnel = new LocalArtifactTunnel(
      { ...source, revokePublishedArtifacts },
      async () => ({
        url: "https://proof.example/",
        close,
        on: (event, handler) => handlers.set(event, handler),
      }),
      30_000,
      async () => undefined,
    );

    await expect(tunnel.ensureStarted()).resolves.toBe("https://proof.example");
    handlers.get("close")?.();
    await vi.waitFor(() =>
      expect(revokePublishedArtifacts).toHaveBeenCalledOnce(),
    );
    expect(tunnel.status()).toEqual({ url: null, active: false });
  });

  it("bounds tunnel startup and closes a relay that resolves after timeout", async () => {
    let resolveTunnel!: (tunnel: {
      url: string;
      close(): void;
      on(): void;
    }) => void;
    const close = vi.fn();
    const attempt = new Promise<{
      url: string;
      close(): void;
      on(): void;
    }>((resolve) => {
      resolveTunnel = resolve;
    });
    const tunnel = new LocalArtifactTunnel(source, () => attempt, 10);

    await expect(tunnel.ensureStarted()).resolves.toBeNull();
    resolveTunnel({ url: "https://late.example", close, on: () => undefined });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(close).toHaveBeenCalledOnce();
    expect(tunnel.status()).toEqual({ url: null, active: false });
    tunnel.dispose();
  });
});
