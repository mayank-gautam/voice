import { mapTwilioCall, type CallListItem } from "@/lib/server/twilio";

export const ACTIVE_CALL_STATUSES = ["in-progress", "ringing", "queued"] as const;

export const DEFAULT_CALLS_LIMIT = 1000;
export const MAX_CALLS_LIMIT = 2000;

/**
 * Twilio StartTime filters often omit ringing/queued (no start_time yet) and can
 * miss in-progress calls. Fetch active legs without a date filter.
 */
export async function listActiveCalls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  perStatusLimit = 100
): Promise<CallListItem[]> {
  const lists = await Promise.all(
    ACTIVE_CALL_STATUSES.map((status) => client.calls.list({ status, limit: perStatusLimit }))
  );
  const bySid = new Map<string, CallListItem>();
  for (const list of lists) {
    for (const call of list) {
      const mapped = mapTwilioCall(call);
      bySid.set(mapped.id, mapped);
    }
  }
  return [...bySid.values()];
}

export async function listCallsInRange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  opts: {
    after?: Date;
    before?: Date;
    limit?: number;
    status?: string;
  }
): Promise<CallListItem[]> {
  const calls = await client.calls.list({
    limit: opts.limit ?? DEFAULT_CALLS_LIMIT,
    ...(opts.status ? { status: opts.status as "completed" } : {}),
    ...(opts.after ? { startTimeAfter: opts.after } : {}),
    ...(opts.before ? { startTimeBefore: opts.before } : {}),
  });
  return calls.map(mapTwilioCall);
}

/** Merge active + ranged calls, dedupe by SID, active first, then newest. */
export function mergeCallsForPeriod(
  active: CallListItem[],
  ranged: CallListItem[],
  limit: number
): CallListItem[] {
  const bySid = new Map<string, CallListItem>();
  for (const call of active) bySid.set(call.id, call);
  for (const call of ranged) {
    if (!bySid.has(call.id)) bySid.set(call.id, call);
  }
  return [...bySid.values()]
    .sort((a, b) => {
      const aActive = a.status === "active" ? 1 : 0;
      const bActive = b.status === "active" ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    })
    .slice(0, limit);
}

/** Shared period fetch used by Calls list + Overview so counts stay aligned. */
export async function fetchCallsForPeriod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  opts: {
    after?: Date;
    before?: Date;
    limit?: number;
    status?: string;
    includeActive?: boolean;
  }
): Promise<{ items: CallListItem[]; rangedCount: number; activeMerged: number; truncated: boolean }> {
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_CALLS_LIMIT, 1), MAX_CALLS_LIMIT);
  const includeActive = opts.includeActive !== false && !opts.status;

  const [ranged, active] = await Promise.all([
    listCallsInRange(client, {
      after: opts.after,
      before: opts.before,
      limit,
      status: opts.status,
    }),
    includeActive ? listActiveCalls(client) : Promise.resolve([] as CallListItem[]),
  ]);

  const items = mergeCallsForPeriod(active, ranged, limit);
  return {
    items,
    rangedCount: ranged.length,
    activeMerged: items.filter((c) => c.status === "active").length,
    truncated: ranged.length >= limit,
  };
}
