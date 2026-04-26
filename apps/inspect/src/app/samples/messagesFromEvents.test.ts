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
    // Mirrors the live bug scenario: walking events in stream order with a
    // Map keyed by id keeps original insertion positions, hoisting later
    // tool/user messages to the end instead of slotting them between the
    // assistants that produced them.
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
    expect(messages.map((m) => m.id)).toEqual([
      "u1",
      "a1",
      "t1",
      "u3",
      "a3",
    ]);
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

  it("returns [] for an empty event stream", () => {
    expect(messagesFromEvents([])).toEqual([]);
  });

  it("returns [] when every model event has an error", () => {
    const events = [
      makeModelEvent({
        error: "429 rate limit",
        inputId: "msg-1",
        outputId: "msg-err-1",
      }),
      makeModelEvent({
        error: "500 server error",
        inputId: "msg-1",
        outputId: "msg-err-2",
      }),
    ];
    expect(messagesFromEvents(events)).toEqual([]);
  });
});
