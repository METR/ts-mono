import { describe, expect, it } from "vitest";

import type { ChatMessage, Event } from "@tsmono/inspect-common/types";

import { messagesFromEvents } from "./messagesFromEvents";

const makeModelEvent = (opts: {
  error?: string;
  input?: ChatMessage[];
  inputId?: string;
  outputId?: string;
}): Event =>
  ({
    event: "model",
    error: opts.error ?? null,
    input:
      opts.input ??
      (opts.inputId
        ? [{ id: opts.inputId, role: "user", content: "hello", source: null }]
        : []),
    output: {
      choices: [
        {
          message: {
            id: opts.outputId ?? null,
            role: "assistant",
            content: "response",
            source: "generate",
          },
        },
      ],
    },
  }) as unknown as Event;

const userMsg = (id: string): ChatMessage =>
  ({ id, role: "user", content: "u", source: null }) as unknown as ChatMessage;
const assistantMsg = (id: string): ChatMessage =>
  ({
    id,
    role: "assistant",
    content: "a",
    source: "generate",
  }) as unknown as ChatMessage;
const toolMsg = (id: string): ChatMessage =>
  ({
    id,
    role: "tool",
    content: "t",
    source: null,
  }) as unknown as ChatMessage;

describe("messagesFromEvents", () => {
  it("returns messages from successful model events", () => {
    const messages = messagesFromEvents([
      makeModelEvent({ inputId: "msg-1", outputId: "msg-2" }),
    ]);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.id).toBe("msg-1");
    expect(messages[1]!.id).toBe("msg-2");
  });

  it("skips model events with error set", () => {
    const messages = messagesFromEvents([
      makeModelEvent({
        error: "429 rate limit",
        inputId: "msg-1",
        outputId: "msg-err",
      }),
      makeModelEvent({ inputId: "msg-1", outputId: "msg-2" }),
    ]);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.id).toBe("msg-1");
    expect(messages[1]!.id).toBe("msg-2");
  });

  it("preserves conversation order when later events have new tool/user messages", () => {
    // Mirrors the live bug scenario: an intermediate model event's output
    // is not folded into the next event's input, so the buggy algorithm
    // hoists later tool/user messages to the end instead of slotting them
    // into their correct conversation positions.
    const events = [
      makeModelEvent({
        input: [userMsg("u1")],
        outputId: "a1",
      }),
      makeModelEvent({
        input: [userMsg("u1")],
        outputId: "a2",
      }),
      makeModelEvent({
        input: [
          userMsg("u1"),
          assistantMsg("a1"),
          toolMsg("t1"),
          userMsg("u3"),
        ],
        outputId: "a3",
      }),
    ];

    const messages = messagesFromEvents(events);
    const ids = messages.map((m) => m.id);

    // tool1 must immediately follow asst1 (its tool_calls owner), and u3
    // must come after tool1 — never hoisted past asst3.
    expect(ids.indexOf("t1")).toBe(ids.indexOf("a1") + 1);
    expect(ids.indexOf("u3")).toBeGreaterThan(ids.indexOf("t1"));
    expect(ids.indexOf("u3")).toBeLessThan(ids.indexOf("a3"));
  });

  it("includes the latest event's output when not yet folded into a later input", () => {
    const events = [
      makeModelEvent({
        input: [userMsg("u1")],
        outputId: "a1",
      }),
    ];
    const messages = messagesFromEvents(events);
    expect(messages.map((m) => m.id)).toEqual(["u1", "a1"]);
  });
});
