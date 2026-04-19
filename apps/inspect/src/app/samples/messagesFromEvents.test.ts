import { describe, expect, it } from "vitest";
import type { Event, ModelEvent } from "@tsmono/inspect-common/types";
import { messagesFromEvents } from "./messagesFromEvents";

const NULL_CONFIG = {} as ModelEvent["config"];

function makeModelEvent(options: {
  error?: string | null;
  inputIds?: string[];
  outputId?: string;
}): Event {
  const input = (options.inputIds ?? []).map((id) => ({
    id,
    role: "user" as const,
    content: "hello",
    source: null,
  }));

  return {
    event: "model",
    model: "test-model",
    input,
    input_refs: null,
    tools: [],
    tool_choice: "auto",
    config: NULL_CONFIG,
    output: {
      choices: [
        {
          message: {
            id: options.outputId ?? null,
            role: "assistant" as const,
            content: options.error ? "" : "response",
            source: "generate",
          },
          stop_reason: "stop",
        },
      ],
      completion: "",
      error: null,
      metadata: null,
      model: "test-model",
      time: 1,
      usage: {
        input_tokens: 10,
        output_tokens: 10,
        total_tokens: 20,
        input_tokens_cache_read: null,
        input_tokens_cache_write: null,
        reasoning_tokens: null,
        total_cost: null,
      },
    },
    timestamp: "2025-01-15T10:00:00Z",
    working_start: 0,
    working_time: 1,
    cache: null,
    call: null,
    completed: "2025-01-15T10:00:01Z",
    error: options.error ?? null,
    metadata: null,
    pending: null,
    retries: null,
    role: null,
    span_id: null,
    traceback: null,
    traceback_ansi: null,
    uuid: null,
  } as Event;
}

describe("messagesFromEvents", () => {
  it("returns messages from successful model events", () => {
    const events = [
      makeModelEvent({ inputIds: ["msg-1"], outputId: "msg-2" }),
    ];
    const messages = messagesFromEvents(events);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.id).toBe("msg-1");
    expect(messages[1]!.id).toBe("msg-2");
  });

  it("skips model events with error set", () => {
    const events = [
      makeModelEvent({
        error: "Error calling model: 429 rate limit",
        inputIds: ["msg-1"],
        outputId: "msg-err",
      }),
      makeModelEvent({ inputIds: ["msg-1"], outputId: "msg-2" }),
    ];
    const messages = messagesFromEvents(events);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.id).toBe("msg-1");
    expect(messages[1]!.id).toBe("msg-2");
  });

  it("returns empty array when all model events have errors", () => {
    const events = [
      makeModelEvent({
        error: "Error calling model: 429 rate limit",
        inputIds: ["msg-1"],
        outputId: "msg-err",
      }),
    ];
    const messages = messagesFromEvents(events);
    expect(messages).toHaveLength(0);
  });

  it("ignores non-model events", () => {
    const events = [
      { event: "tool", timestamp: "2025-01-15T10:00:00Z" } as Event,
      makeModelEvent({ inputIds: ["msg-1"], outputId: "msg-2" }),
    ];
    const messages = messagesFromEvents(events);
    expect(messages).toHaveLength(2);
  });
});
