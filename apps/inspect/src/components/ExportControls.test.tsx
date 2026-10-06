import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JsonTab } from "../app/log-view/tabs/JsonTab";
import { setExportHandler } from "../exports";
import { initializeStore, updateCapabilities } from "../state/store";

import { DownloadLogButton } from "./DownloadLogButton";

const api = vi.hoisted(() => ({
  download_log: vi.fn(),
  download_file: vi.fn(),
}));
vi.mock("../app_config", () => ({ getApi: () => api }));

beforeEach(() => {
  initializeStore({
    downloadFiles: true,
    downloadLogs: true,
    streamSamples: true,
    webWorkers: true,
  });
  api.download_log.mockReset().mockResolvedValue(undefined);
  api.download_file.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  setExportHandler();
});

describe("export controls", () => {
  it("passes an explicit eval-file kind from the actual download button", async () => {
    const handler = vi.fn((_context, action: () => Promise<void>) => action());
    setExportHandler(handler);
    render(<DownloadLogButton log_file="set/log.eval" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(api.download_log).toHaveBeenCalledWith("set/log.eval")
    );
    expect(handler).toHaveBeenCalledWith(
      { kind: "eval_file", logFile: "set/log.eval" },
      expect.any(Function)
    );
  });

  it("removes the oversized-JSON export without rendering the enormous payload, and restores it", async () => {
    const handler = vi.fn((_context, action: () => Promise<void>) => action());
    setExportHandler(handler);
    const json = "x".repeat(10_000_001);
    render(<JsonTab selected logFile="set/log.eval" json={json} />);
    fireEvent.click(screen.getByRole("button", { name: "Download JSON File" }));
    await waitFor(() => expect(api.download_file).toHaveBeenCalledOnce());
    expect(handler).toHaveBeenCalledWith(
      { kind: "eval_json", logFile: "set/log.eval" },
      expect.any(Function)
    );
    act(() => updateCapabilities({ downloadFiles: false }));
    expect(
      screen.queryByRole("button", { name: "Download JSON File" })
    ).toBeNull();
    expect(screen.getByText(/Downloads are unavailable/)).toBeInTheDocument();
    expect(document.body.textContent.length).toBeLessThan(1000);
    act(() => updateCapabilities({ downloadFiles: true }));
    expect(
      screen.getByRole("button", { name: "Download JSON File" })
    ).toBeInTheDocument();
  });
});
