import { describe, expect, it } from "vitest";
import { removedProductRouteRedirect } from "../src/preload/local-workbench";
import {
  isRemovedCoworkHttpPath,
  isRemovedCoworkService,
} from "../src/shared/removed-product";

describe("removed Cowork routes", () => {
  it("redirects stale sessions into LocalSessions-backed Code views", () => {
    expect(removedProductRouteRedirect("/cowork/session-123")).toBe(
      "/epitaxy/session-123",
    );
    expect(removedProductRouteRedirect("/task/session%20name")).toBe(
      "/epitaxy/session%20name",
    );
  });

  it("redirects stale landings and settings without touching live routes", () => {
    expect(removedProductRouteRedirect("/cowork")).toBe("/new");
    expect(removedProductRouteRedirect("/cowork/new")).toBe("/new");
    expect(removedProductRouteRedirect("/task/new")).toBe("/new");
    expect(removedProductRouteRedirect("/settings/cowork")).toBe(
      "/settings/claude-code",
    );
    expect(removedProductRouteRedirect("/epitaxy/session-123")).toBeNull();
    expect(removedProductRouteRedirect("/chat/session-123")).toBeNull();
  });

  it("routes every stale Cowork HTTP path to the explicit 410 tombstone", () => {
    expect(isRemovedCoworkHttpPath("/cowork/scheduled_tasks")).toBe(true);
    expect(
      isRemovedCoworkHttpPath(
        "/api/organizations/org-1/cowork/scheduled_tasks",
      ),
    ).toBe(true);
    expect(isRemovedCoworkHttpPath("/api/COWORK/session-1")).toBe(true);
    expect(isRemovedCoworkHttpPath("/api/conversations")).toBe(false);
  });

  it("removes obsolete desktop services while retaining LocalSessions", () => {
    expect(isRemovedCoworkService("claude.web", "LocalAgentModeSessions")).toBe(
      false,
    );
    expect(isRemovedCoworkService("claude.web", "CoworkScheduledTasks")).toBe(
      true,
    );
    expect(isRemovedCoworkService("claude.cowork", "SessionFiles")).toBe(true);
    expect(isRemovedCoworkService("claude.web", "ClaudeVM")).toBe(true);
    expect(isRemovedCoworkService("claude.web", "LocalSessions")).toBe(false);
  });
});
