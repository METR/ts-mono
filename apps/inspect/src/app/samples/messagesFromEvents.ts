import type {
  ChatMessage,
  Event,
  ModelEvent,
} from "@tsmono/inspect-common/types";

const isSuccessfulModelEvent = (e: Event): e is ModelEvent =>
  e.event === "model" && !e.error;

export const messagesFromEvents = (runningEvents: Event[]): ChatMessage[] => {
  const modelEvents = runningEvents.filter(isSuccessfulModelEvent);
  const latest = modelEvents.at(-1);
  if (!latest) return [];

  // The latest model event's input is the canonical conversation prefix:
  // it's the full conversation state at the time of the most recent model
  // call, already in order. Map.set keeps original insertion positions, so
  // walking events in stream order would hoist later tool/user messages to
  // the end of the list instead of slotting them between earlier assistants.
  const ordered: ChatMessage[] = [...latest.input];

  const latestOutput = latest.output.choices[0]?.message;
  if (latestOutput?.id && !ordered.some((m) => m.id === latestOutput.id)) {
    ordered.push(latestOutput);
  }

  return ordered;
};
