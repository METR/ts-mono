import { describe, expect, test, vi } from "vitest";

import { clientApi } from "./client-api";
import { LogViewAPI, SampleData, SampleDataResponse } from "./types";

const emptySampleData: SampleData = {
  events: [],
  attachments: [],
  message_pool: [],
  call_pool: [],
};

const okResponse = (has_more = false): SampleDataResponse => ({
  status: "OK",
  sampleData: emptySampleData,
  has_more,
});

const baseApi = (): LogViewAPI => ({
  client_events: vi.fn().mockResolvedValue([]),
  get_eval_set: vi.fn().mockResolvedValue(undefined),
  get_flow: vi.fn().mockResolvedValue(undefined),
  get_log_root: vi.fn().mockResolvedValue(undefined),
  get_log_contents: vi.fn(),
  get_log_info: vi.fn(),
  get_log_bytes: vi.fn(),
  get_log_summaries: vi.fn().mockResolvedValue([]),
  log_message: vi.fn(),
  download_file: vi.fn(),
  open_log_file: vi.fn(),
});

describe("clientApi.get_log_sample_data path selection", () => {
  test("pins to direct on the first call when the probe succeeds", async () => {
    const direct = vi.fn().mockResolvedValue(okResponse(true));
    const proxy = vi.fn().mockResolvedValue(okResponse());
    const api: LogViewAPI = {
      ...baseApi(),
      eval_log_sample_data: proxy,
      eval_log_sample_data_direct: direct,
    };
    const client = clientApi(api);

    const first = await client.get_log_sample_data!("log.eval", "s1", 0);
    const second = await client.get_log_sample_data!("log.eval", "s1", 0);

    expect(first?.has_more).toBe(true);
    expect(second?.has_more).toBe(true);
    expect(direct).toHaveBeenCalledTimes(2);
    expect(proxy).not.toHaveBeenCalled();
  });

  test("pins to proxy when the probe returns undefined and never probes again", async () => {
    const direct = vi.fn().mockResolvedValue(undefined);
    const proxy = vi.fn().mockResolvedValue(okResponse());
    const api: LogViewAPI = {
      ...baseApi(),
      eval_log_sample_data: proxy,
      eval_log_sample_data_direct: direct,
    };
    const client = clientApi(api);

    await client.get_log_sample_data!("log.eval", "s1", 0);
    await client.get_log_sample_data!("log.eval", "s1", 0);

    expect(direct).toHaveBeenCalledTimes(1);
    expect(proxy).toHaveBeenCalledTimes(2);
  });

  test("uses proxy when the API doesn't expose the direct method", async () => {
    const proxy = vi.fn().mockResolvedValue(okResponse());
    const api: LogViewAPI = {
      ...baseApi(),
      eval_log_sample_data: proxy,
    };
    const client = clientApi(api);

    await client.get_log_sample_data!("log.eval", "s1", 0);

    expect(proxy).toHaveBeenCalledTimes(1);
  });

  test("real errors from the direct probe bubble up and don't pin a path", async () => {
    const direct = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(okResponse());
    const proxy = vi.fn().mockResolvedValue(okResponse());
    const api: LogViewAPI = {
      ...baseApi(),
      eval_log_sample_data: proxy,
      eval_log_sample_data_direct: direct,
    };
    const client = clientApi(api);

    await expect(
      client.get_log_sample_data!("log.eval", "s1", 0)
    ).rejects.toThrow("network");

    // Next call retries the probe (no path was pinned).
    await client.get_log_sample_data!("log.eval", "s1", 0);
    expect(direct).toHaveBeenCalledTimes(2);
    expect(proxy).not.toHaveBeenCalled();
  });

  test("pins per-log_file independently", async () => {
    const direct = vi
      .fn()
      .mockResolvedValueOnce(okResponse()) // log A: probe ok
      .mockResolvedValueOnce(undefined) // log B: not supported
      .mockResolvedValueOnce(okResponse()); // log A: follow-up
    const proxy = vi.fn().mockResolvedValue(okResponse());
    const api: LogViewAPI = {
      ...baseApi(),
      eval_log_sample_data: proxy,
      eval_log_sample_data_direct: direct,
    };
    const client = clientApi(api);

    await client.get_log_sample_data!("a.eval", "s1", 0);
    await client.get_log_sample_data!("b.eval", "s1", 0);
    await client.get_log_sample_data!("a.eval", "s1", 0);
    await client.get_log_sample_data!("b.eval", "s1", 0);

    expect(direct).toHaveBeenCalledTimes(3); // a-probe, b-probe, a-followup
    expect(proxy).toHaveBeenCalledTimes(2); // b-first (after probe), b-followup
  });
});
