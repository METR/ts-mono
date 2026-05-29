import { describe, expect, it } from "vitest";

import { resolveToolInput } from "./tool";

describe("resolveToolInput", () => {
  it("renders deepagent lifecycle tool output as markdown", () => {
    for (const fn of [
      "agent_status",
      "agent_wait",
      "agent_cancel",
      "agent_list",
    ]) {
      expect(resolveToolInput(fn, {}).contentType).toBe("markdown");
    }
  });

  it("renders agent dispatch output as markdown", () => {
    expect(
      resolveToolInput("agent", { subagent_type: "research" }).contentType
    ).toBe("markdown");
  });

  it("leaves unknown tools without a markdown content type", () => {
    expect(resolveToolInput("some_other_tool", {}).contentType).not.toBe(
      "markdown"
    );
  });
});
