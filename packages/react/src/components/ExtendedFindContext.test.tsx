// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { FC, useEffect } from "react";
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

const Source: FC<SourceSpec> = ({ id, count, locator }) => {
  const { registerMatchCounter, registerMatchLocator } = useExtendedFind();

  useEffect(() => {
    if (count === undefined) return;
    return registerMatchCounter(id, () => count);
  }, [id, count, registerMatchCounter]);

  useEffect(() => {
    if (!locator) return;
    return registerMatchLocator(id, locator);
  }, [id, locator, registerMatchLocator]);

  return null;
};

/**
 * Renders the sources in array order, which is the order they register in —
 * `ordinalAtSelection` walks counters in registration order, so the array
 * order is what the offset arithmetic is defined against.
 */
function renderSources(
  sources: SourceSpec[]
): (term: string) => number | null {
  let ordinalAtSelection: ((term: string) => number | null) | null = null;
  const Probe: FC = () => {
    const { ordinalAtSelection: fn } = useExtendedFind();
    useEffect(() => {
      ordinalAtSelection = fn;
    });
    return null;
  };
  render(
    <ExtendedFindProvider>
      <Probe />
      {sources.map((s) => (
        <Source key={s.id} {...s} />
      ))}
    </ExtendedFindProvider>
  );
  if (!ordinalAtSelection) throw new Error("probe did not render");
  return ordinalAtSelection;
}

describe("ordinalAtSelection", () => {
  afterEach(cleanup);

  it("returns the locator's index directly for the first source", () => {
    const ordinal = renderSources([
      { id: "a", count: 7, locator: () => 3 },
      { id: "b", count: 5 },
    ]);

    expect(ordinal("needle")).toBe(3);
  });

  it("offsets a later source's index by the earlier sources' counts", () => {
    const ordinal = renderSources([
      { id: "a", count: 7 },
      { id: "b", count: 5, locator: () => 2 },
    ]);

    expect(ordinal("needle")).toBe(9);
  });

  it("returns null when no locator claims the selection", () => {
    const ordinal = renderSources([
      { id: "a", count: 7 },
      { id: "b", count: 5, locator: () => null },
    ]);

    expect(ordinal("needle")).toBeNull();
  });

  it("ignores a locator registered without a counter", () => {
    // Offsets are meaningless without a count, so such a source is skipped
    // rather than silently reporting an index into the wrong total.
    const ordinal = renderSources([
      { id: "a", count: 7 },
      { id: "orphan", locator: () => 0 },
    ]);

    expect(ordinal("needle")).toBeNull();
  });
});
