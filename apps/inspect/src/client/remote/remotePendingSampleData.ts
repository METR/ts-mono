import { asyncJsonParseBytes } from "../../utils/json-worker";
import { PendingSampleUrls, SampleData, SegmentRef } from "../api/types";
import { ApiError } from "../api/view-server/request";
import { openZipFileFromBuffer } from "./remoteZipFile";

// Cap the number of segments fetched per call. Long-running evals can produce
// thousands of segments; without a cap the renderer starves fetching/parsing
// them all before painting. With a cap the poll loop yields between chunks
// (via the polling helper's setTimeout(0) on "immediate") so React can paint
// and V8 can reclaim transient fetch/parse state. 25 was chosen empirically
// to keep each chunk under ~1s at typical segment sizes.
const SEGMENT_CAP_PER_CALL = 25;

export type GetPendingSampleDataUrls = (
  log_file: string,
  id: string | number,
  epoch: number,
  last_event?: number,
  last_attachment?: number,
  last_message_pool?: number,
  last_call_pool?: number,
  max_segments?: number
) => Promise<PendingSampleUrls>;

export interface DirectPendingResult {
  sampleData: SampleData;
  has_more: boolean;
}

/**
 * Fetch one chunk of pending-sample data by pulling segments directly from S3
 * via presigned URLs.
 *
 * Returns `undefined` only for "this transport isn't supported here": the URL
 * endpoint is missing (404, old server) or at least one segment lacks a
 * presigned URL (non-S3-backed buffer). All other failures (network, parse,
 * S3 errors) throw.
 *
 * The server caps the segment list at SEGMENT_CAP_PER_CALL and reports
 * `has_more`; callers are expected to re-invoke with advanced cursors.
 */
export const fetchPendingSampleDataDirect = async (
  getUrls: GetPendingSampleDataUrls,
  log_file: string,
  id: string | number,
  epoch: number,
  cursors: {
    last_event?: number;
    last_attachment?: number;
    last_message_pool?: number;
    last_call_pool?: number;
  }
): Promise<DirectPendingResult | undefined> => {
  let urls: PendingSampleUrls;
  try {
    urls = await getUrls(
      log_file,
      id,
      epoch,
      cursors.last_event,
      cursors.last_attachment,
      cursors.last_message_pool,
      cursors.last_call_pool,
      SEGMENT_CAP_PER_CALL
    );
  } catch (e) {
    // 404 = endpoint missing on this server; treat as "not supported".
    if (e instanceof ApiError && e.status === 404) {
      return undefined;
    }
    throw e;
  }

  if (urls.segments.length === 0) {
    return {
      sampleData: {
        events: [],
        attachments: [],
        message_pool: [],
        call_pool: [],
      },
      has_more: urls.has_more,
    };
  }

  const canDirect = urls.segments.every((s) => s.direct_url != null);
  if (!canDirect) {
    return undefined;
  }

  // Fetch concurrently but concatenate in segment order: segments complete
  // in network-arrival order, which has no relation to segment id, and
  // downstream code relies on events/attachments being appended in id order.
  const parts: SampleData[] = await Promise.all(
    urls.segments.map((seg: SegmentRef) => readSegment(seg))
  );
  const out: SampleData = {
    events: parts.flatMap((p) => p.events),
    attachments: parts.flatMap((p) => p.attachments),
    message_pool: parts.flatMap((p) => p.message_pool),
    call_pool: parts.flatMap((p) => p.call_pool),
  };
  return {
    sampleData: applyCursorFilter(out, cursors),
    has_more: urls.has_more,
  };
};

const readSegment = async (seg: SegmentRef): Promise<SampleData> => {
  const url = seg.direct_url as string;
  // Fetch the whole zip in one request. Presigned URLs point directly at S3
  // (no intermediary Content-Encoding concerns for binary zips), and segments
  // in practice contain one member per (sample, epoch), so the zip is ~the
  // member plus trivial framing — no savings from ranging.
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch segment: ${resp.status} ${resp.statusText}`);
  }
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const zip = await openZipFileFromBuffer(bytes);
  const memberBytes = await zip.readFile(seg.member_name);
  return (await asyncJsonParseBytes(memberBytes)) as SampleData;
};

// Over-inclusive segment filter -> per-item filter here. Mirrors
// SampleBufferFilestore.get_sample_data. `-1` acts as "no cursor".
const applyCursorFilter = (
  out: SampleData,
  cursors: {
    last_event?: number;
    last_attachment?: number;
    last_message_pool?: number;
    last_call_pool?: number;
  }
): SampleData => {
  const lastEvent = cursors.last_event ?? -1;
  const lastAttachment = cursors.last_attachment ?? -1;
  const lastMessagePool = cursors.last_message_pool ?? -1;
  const lastCallPool = cursors.last_call_pool ?? -1;
  out.events = out.events.filter((e) => e.id > lastEvent);
  out.attachments = out.attachments.filter((a) => a.id > lastAttachment);
  out.message_pool = out.message_pool.filter((m) => m.id > lastMessagePool);
  out.call_pool = out.call_pool.filter((c) => c.id > lastCallPool);
  return out;
};
