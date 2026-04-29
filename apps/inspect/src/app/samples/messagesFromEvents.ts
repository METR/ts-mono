import type {
  ChatMessage,
  Event,
  ModelEvent,
} from "@tsmono/inspect-common/types";

const isSuccessfulModelEvent = (e: Event): e is ModelEvent =>
  e.event === "model" && !e.error;

/**
 * Reconstruct the conversation message list shown in the running-sample
 * Messages tab from a stream of events.
 *
 * The conversation almost always grows by appending: each model event's
 * input is the prior input plus the prior output and any new tool/user
 * turns. We exploit that fast path with a "skip-prefix" mode that walks
 * only the suffix of each event's input. We fall back to a full walk
 * whenever any of these signals indicates the input isn't a clean
 * extension of the prior one:
 *
 *  - A CompactionEvent appeared between this and the previous model
 *    event (catches edit-style compaction that keeps length and
 *    last-id stable but modifies messages mid-history);
 *  - The new input is shorter than the previous one (catches summary
 *    and trim compaction);
 *  - The id at position prev.length - 1 in the new input doesn't match
 *    the previous event's last input id (catches the original
 *    "21 assistants then a late tool fold" pattern);
 *  - The id at position prev.length in the new input doesn't match the
 *    previous event's output id (catches the intermediate-output case
 *    where the prior output was never folded back into the conversation).
 *
 * Any of those forces a full walk: known ids re-anchor a cursor to
 * their position without re-inserting; new ids splice at cursor + 1;
 * the output appends at the tail and dedupes by id. The full walk also
 * handles the load-bearing edge cases: the end-of-list cursor default
 * lets a fresh first message in a post-compaction event land after the
 * existing prefix rather than prepend, and the output-at-tail rule
 * keeps the post-compaction assistant after its summary.
 */
export const messagesFromEvents = (events: Event[]): ChatMessage[] => {
  const result: ChatMessage[] = [];
  const positions = new Map<string, number>();

  // State carried across consecutive successful model events.
  let prevInputLength = 0;
  let prevLastInputId: string | null = null;
  let prevOutputId: string | null = null;
  let pendingFullWalk = true;

  const insertAt = (index: number, m: ChatMessage) => {
    result.splice(index, 0, m);
    for (let i = index; i < result.length; i++) {
      const id = result[i]!.id;
      if (id) positions.set(id, i);
    }
  };

  for (const ev of events) {
    if (ev.event === "compaction") {
      pendingFullWalk = true;
      continue;
    }
    if (!isSuccessfulModelEvent(ev)) continue;

    let needsFullWalk = pendingFullWalk;
    if (!needsFullWalk) {
      if (ev.input.length < prevInputLength) {
        needsFullWalk = true;
      } else if (
        prevInputLength > 0 &&
        ev.input[prevInputLength - 1]?.id !== prevLastInputId
      ) {
        needsFullWalk = true;
      } else if (
        ev.input.length > prevInputLength &&
        prevOutputId != null &&
        ev.input[prevInputLength]?.id !== prevOutputId
      ) {
        needsFullWalk = true;
      }
    }

    if (needsFullWalk) {
      let cursor = result.length - 1;
      const seenInEvent = new Set<string>();
      for (const m of ev.input) {
        if (!m.id || seenInEvent.has(m.id)) continue;
        seenInEvent.add(m.id);
        const known = positions.get(m.id);
        if (known !== undefined) {
          cursor = known;
        } else {
          cursor += 1;
          insertAt(cursor, m);
        }
      }
    } else {
      // Skip-prefix: trust ev.input[0..prevInputLength - 1] is identical
      // to the prior event's input. Walk only the suffix and append new
      // messages at the end of the result.
      let cursor = result.length - 1;
      for (let i = prevInputLength; i < ev.input.length; i++) {
        const m = ev.input[i]!;
        if (!m.id || positions.has(m.id)) continue;
        cursor += 1;
        insertAt(cursor, m);
      }
    }

    const out = ev.output.choices[0]?.message;
    if (out?.id && !positions.has(out.id)) {
      positions.set(out.id, result.length);
      result.push(out);
    }

    prevInputLength = ev.input.length;
    prevLastInputId =
      ev.input.length > 0 ? (ev.input[ev.input.length - 1]?.id ?? null) : null;
    prevOutputId = out?.id ?? null;
    pendingFullWalk = false;
  }

  return result;
};
