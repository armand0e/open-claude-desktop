import { describe, expect, it, vi } from "vitest";
import { finalizePublishedShare } from "../src/main/publish-share";

function publishedResponse(): Response {
  return new Response(
    JSON.stringify({
      published_artifact_uuid: "proof",
      slug: "proof",
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

describe("published artifact acknowledgement", () => {
  it("returns success only after the relay proves reachability", async () => {
    const revoke = vi.fn(async () => true);
    const response = await finalizePublishedShare(publishedResponse(), {
      ensureReachable: async () => "https://proof.example",
      revoke,
    });
    expect(response.status).toBe(200);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("revokes persisted state when public relay creation fails", async () => {
    const revoke = vi.fn(async () => true);
    const response = await finalizePublishedShare(publishedResponse(), {
      ensureReachable: async () => null,
      revoke,
    });
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ published: false, error: expect.any(String) }),
    );
    expect(revoke).toHaveBeenCalledWith("proof");
  });

  it("surfaces rollback failure as a release-integrity error", async () => {
    const response = await finalizePublishedShare(publishedResponse(), {
      ensureReachable: async () => null,
      revoke: async () => false,
    });
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toMatch(/could not be revoked/i);
  });
});
