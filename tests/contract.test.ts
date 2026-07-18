import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PRELOAD_CHANNELS,
  IPC_CHANNEL_COUNT,
  IPC_SERVICE_COUNT,
  IPC_SERVICES,
} from "../src/generated/ipc-contract";
import { parseChannel } from "../src/shared/channels";

describe("recovered IPC contract", () => {
  it("contains every unique recovered channel", () => {
    expect(IPC_CHANNEL_COUNT).toBe(842);
    expect(IPC_SERVICE_COUNT).toBe(71);
    expect(PRELOAD_CHANNELS).toHaveLength(842);
    expect(new Set(PRELOAD_CHANNELS.map((entry) => entry.channel)).size).toBe(
      842,
    );
    expect(Object.keys(IPC_SERVICES)).toHaveLength(71);
  });

  it("has a parseable service and one unambiguous public path for every channel", () => {
    for (const entry of PRELOAD_CHANNELS) {
      expect(parseChannel(entry.channel), entry.channel).not.toBeNull();
      expect(entry.publicPaths, entry.channel).toHaveLength(1);
      expect(entry.files.length, entry.channel).toBeGreaterThan(0);
    }
  });

  it("matches the observed main window and main view preload surfaces", () => {
    expect(
      PRELOAD_CHANNELS.filter((entry) =>
        (entry.files as readonly string[]).includes("mainView.js"),
      ),
    ).toHaveLength(817);
    expect(
      PRELOAD_CHANNELS.filter((entry) =>
        (entry.files as readonly string[]).includes("mainWindow.js"),
      ),
    ).toHaveLength(126);
  });

  it("retains the generated argument and result evidence", () => {
    const signatures = JSON.parse(
      readFileSync(path.resolve("analysis/ipc-signatures.json"), "utf8"),
    );
    expect(signatures.channelsWithValidation).toBe(747);
    expect(signatures.validationMessageCount).toBe(1701);
    expect(
      signatures.channels.reduce(
        (count: number, entry: { arguments: unknown[] }) =>
          count + entry.arguments.length,
        0,
      ),
    ).toBe(1168);
    expect(
      signatures.channels.filter((entry: { result: unknown }) => entry.result)
        .length,
    ).toBe(533);
  });
});
