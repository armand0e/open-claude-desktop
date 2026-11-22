import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {},
  dialog: {},
  net: {},
  protocol: {},
  shell: {},
}));

import { localArtifactRendererHtml } from "../src/main/local-ui";

describe("local artifact renderer sandbox", () => {
  it("keeps scripts interactive without granting popup, download, or form powers", () => {
    const html = localArtifactRendererHtml();
    expect(html).toContain('frame.setAttribute("sandbox","allow-scripts")');
    expect(html).not.toContain("allow-downloads");
    expect(html).not.toContain("allow-popups");
    expect(html).not.toContain("allow-modals");
    expect(html).not.toContain("allow-forms");
  });
});
