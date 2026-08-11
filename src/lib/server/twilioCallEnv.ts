import type { CallEnvTag } from "@/lib/callEnvTag";
import {
  collectUrlsFromCallEventRequest,
  inferEnvTagFromTexts,
} from "@/lib/callEnvTag";

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  }

  const workers = Array.from(
    { length: Math.min(Math.max(concurrency, 1), Math.max(items.length, 1)) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * Resolve env tag from Twilio Call Events (Request Inspector webhook URLs).
 * Events are available ~15m after a call ends; active/recent calls may return null.
 */
export async function fetchEnvTagFromCallEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  callSid: string
): Promise<CallEnvTag | null> {
  try {
    const events = await client.calls(callSid).events.list({ limit: 25 });
    const urls: string[] = [];
    for (const ev of events || []) {
      urls.push(...collectUrlsFromCallEventRequest(ev.request));
    }
    return inferEnvTagFromTexts(urls);
  } catch {
    return null;
  }
}

/** Batch-resolve env tags for Call SIDs (bounded concurrency). */
export async function fetchEnvTagsForCallSids(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  callSids: string[],
  concurrency = 12
): Promise<Record<string, CallEnvTag | null>> {
  const unique = [...new Set(callSids.map((s) => s.trim()).filter(Boolean))];
  const tags = await mapPool(unique, concurrency, async (sid) => {
    const tag = await fetchEnvTagFromCallEvents(client, sid);
    return [sid, tag] as const;
  });
  return Object.fromEntries(tags);
}
