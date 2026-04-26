import type {
  ChatMessage,
  ChatMessageAssistant,
  ChatMessageSystem,
  ChatMessageTool,
  ChatMessageUser,
  Event,
  ModelEvent,
} from "@tsmono/inspect-common/types";

type ConversationMessage =
  | ChatMessageSystem
  | ChatMessageUser
  | ChatMessageAssistant
  | ChatMessageTool;

const isSuccessfulModelEvent = (e: Event): e is ModelEvent =>
  e.event === "model" && !e.error;

export const messagesFromEvents = (runningEvents: Event[]): ChatMessage[] => {
  const modelEvents = runningEvents.filter(isSuccessfulModelEvent);
  if (modelEvents.length === 0) return [];

  // The latest model event's input is the canonical conversation prefix:
  // it's the full conversation state at the time of the most recent model
  // call, already in order. Map.set keeps original insertion positions, so
  // walking events in stream order would hoist later tool/user messages to
  // the end of the list instead of slotting them between earlier assistants.
  const latest = modelEvents[modelEvents.length - 1]!;
  const ordered: ConversationMessage[] = [
    ...(latest.input as ConversationMessage[]),
  ];
  const seen = new Set<string>(
    ordered.map((m) => m.id).filter((id): id is string => Boolean(id)),
  );

  const latestOutput = latest.output.choices[0]!.message;
  if (latestOutput.id && !seen.has(latestOutput.id)) {
    ordered.push(latestOutput);
    seen.add(latestOutput.id);
  }

  // Defensive: include outputs from earlier events not yet folded into
  // latest.input (covers the brief streaming window between events).
  for (const e of modelEvents) {
    const out = e.output.choices[0]!.message;
    if (out.id && !seen.has(out.id)) {
      ordered.push(out);
      seen.add(out.id);
    }
  }

  return ordered;
};
