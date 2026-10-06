import { afterEach, describe, expect, it, vi } from "vitest";

import { runExport, setExportHandler, type ExportKind } from "./exports";
import {
  initializeStore,
  storeImplementation,
  updateCapabilities,
} from "./state/store";

afterEach(() => setExportHandler());

describe("host export policy", () => {
  const kinds: ExportKind[] = [
    "eval_file",
    "eval_json",
    "sample_json",
    "sample_messages",
    "sample_transcript",
  ];

  it.each(kinds)("lets the host prevent preparation of %s", async (kind) => {
    const action = vi.fn<() => Promise<void>>();
    setExportHandler((context) => {
      expect(context).toEqual({ kind, logFile: "set/file.eval" });
      return Promise.reject(new Error("disabled"));
    });
    await expect(
      runExport({ kind, logFile: "set/file.eval" }, action)
    ).rejects.toThrow("disabled");
    expect(action).not.toHaveBeenCalled();
  });

  it("retains standalone behavior without a host handler", async () => {
    const action = vi.fn<() => Promise<void>>().mockResolvedValue();
    await runExport({ kind: "sample_json", logFile: "file.eval" }, action);
    expect(action).toHaveBeenCalledOnce();
  });

  it("wraps content preparation failures as well as the final save", async () => {
    const stages: string[] = [];
    setExportHandler(async (_context, action) => {
      stages.push("clicked");
      try {
        await action();
        stages.push("handed_off");
      } catch (error) {
        stages.push("failed");
        throw error;
      }
    });
    await expect(
      runExport({ kind: "sample_messages", logFile: "file.eval" }, () =>
        Promise.reject(new Error("chunk load failed"))
      )
    ).rejects.toThrow("chunk load failed");
    expect(stages).toEqual(["clicked", "failed"]);
  });

  it("changes capabilities without replacing viewer selection or loaded data", () => {
    initializeStore({
      downloadFiles: true,
      downloadLogs: true,
      streamSamples: true,
      webWorkers: true,
    });
    if (!storeImplementation) throw new Error("missing store");
    storeImplementation.setState((state) => {
      state.logs.selectedLogFile = "set/file.eval";
    });
    const before = storeImplementation.getState();
    updateCapabilities({ downloadFiles: false, downloadLogs: false });
    const after = storeImplementation.getState();
    expect(after.capabilities.downloadFiles).toBe(false);
    expect(after.capabilities.downloadLogs).toBe(false);
    expect(after.logs).toBe(before.logs);
    expect(after.log).toBe(before.log);
    expect(after.sample).toBe(before.sample);
    updateCapabilities({ downloadFiles: true, downloadLogs: true });
    expect(storeImplementation.getState().logs.selectedLogFile).toBe(
      "set/file.eval"
    );
  });
});
