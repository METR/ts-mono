// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  ExtendedFindProvider,
  useExtendedFind,
  type MatchLocatorFn,
} from "./ExtendedFindContext";

interface SourceSpec {
  id: string;
  count?: number;
  locator?: MatchLocatorFn;
}

function renderSources(sources: SourceSpec[]) {
  const { result } = renderHook(useExtendedFind, {
    wrapper: ExtendedFindProvider,
  });
  const api = result.current;
  for (const { id, count, locator } of sources) {
    if (count !== undefined) api.registerMatchCounter(id, () => count);
    if (locator) api.registerMatchLocator(id, locator);
  }
  return { ...api, ordinal: api.ordinalAtSelection };
}

describe("ordinalAtSelection", () => {
  afterEach(cleanup);

  it("returns the locator's index directly for the first source", () => {
    const { ordinal } = renderSources([
      { id: "a", count: 7, locator: () => 3 },
      { id: "b", count: 5 },
    ]);

    expect(ordinal("needle")).toBe(3);
  });

  it("offsets a later source's index by the earlier sources' counts", () => {
    const { ordinal } = renderSources([
      { id: "a", count: 7 },
      { id: "b", count: 5, locator: () => 2 },
    ]);

    expect(ordinal("needle")).toBe(9);
  });

  it("returns null when no locator claims the selection", () => {
    const { ordinal } = renderSources([
      { id: "a", count: 7 },
      { id: "b", count: 5, locator: () => null },
    ]);

    expect(ordinal("needle")).toBeNull();
  });

  it("keeps offsets stable when a source re-registers", () => {
    const api = renderSources([]);
    const unregister = api.registerMatchCounter("a", () => 7);
    api.registerMatchCounter("b", () => 5);
    api.registerMatchLocator("b", () => 2);
    expect(api.ordinal("needle")).toBe(9);

    // Re-registration must not move "a" behind "b" in enumeration order.
    unregister();
    api.registerMatchCounter("a", () => 7);

    expect(api.ordinal("needle")).toBe(9);
  });

  it("ignores a locator registered without a counter", () => {
    // Offsets are meaningless without a count, so such a source is skipped
    // rather than silently reporting an index into the wrong total.
    const { ordinal } = renderSources([
      { id: "a", count: 7 },
      { id: "orphan", locator: () => 0 },
    ]);

    expect(ordinal("needle")).toBeNull();
  });
});
