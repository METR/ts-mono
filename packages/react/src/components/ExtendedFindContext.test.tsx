// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ExtendedFindProvider, useExtendedFind } from "./ExtendedFindContext";

function renderFindContext() {
  return renderHook(useExtendedFind, { wrapper: ExtendedFindProvider }).result;
}

describe("ordinalAtSelection", () => {
  afterEach(cleanup);

  it("returns the locator's index directly for the first source", () => {
    const context = renderFindContext().current;
    context.registerMatchCounter("a", () => 7);
    context.registerMatchLocator("a", () => 3);
    context.registerMatchCounter("b", () => 5);

    expect(context.ordinalAtSelection("needle")).toBe(3);
  });

  it("offsets a later source's index by the earlier sources' counts", () => {
    const context = renderFindContext().current;
    context.registerMatchCounter("a", () => 7);
    context.registerMatchCounter("b", () => 5);
    context.registerMatchLocator("b", () => 2);

    expect(context.ordinalAtSelection("needle")).toBe(9);
  });

  it("returns null when no locator claims the selection", () => {
    const context = renderFindContext().current;
    context.registerMatchCounter("a", () => 7);
    context.registerMatchCounter("b", () => 5);
    context.registerMatchLocator("b", () => null);

    expect(context.ordinalAtSelection("needle")).toBeNull();
  });

  it("keeps offsets stable when a source re-registers", () => {
    const context = renderFindContext().current;
    const unregister = context.registerMatchCounter("a", () => 7);
    context.registerMatchCounter("b", () => 5);
    context.registerMatchLocator("b", () => 2);
    expect(context.ordinalAtSelection("needle")).toBe(9);

    // A counter with a new identity must retain its original offset even
    // though deleting and reinserting a Map key changes iteration order.
    unregister();
    context.registerMatchCounter("a", () => 7);

    expect(context.ordinalAtSelection("needle")).toBe(9);
  });

  it("ignores a locator registered without a counter", () => {
    const context = renderFindContext().current;
    context.registerMatchCounter("a", () => 7);
    context.registerMatchLocator("orphan", () => 0);

    expect(context.ordinalAtSelection("needle")).toBeNull();
  });
});
