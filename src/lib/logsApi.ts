import {
  buildAwsCredentialHeaders,
  getActiveCredentials,
} from "@/lib/get-active-credentials";

export const LOGS_CHUNK_SIZE = 200;

export type LogsApiEvent = {
  timestamp: number;
  message: string;
  logStreamName: string;
  logGroupName?: string;
  level?: string;
  service?: string;
};

export type FetchLogsParams = {
  /** When set, filters to that Call SID. When omitted, fetches all project logs. */
  callId?: string | null;
  projectId: string | null | undefined;
  offset?: number;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
};

export type FetchLogsResult = {
  events: LogsApiEvent[];
  hasMore: boolean;
  nextOffset: number | null;
  nextCursor: string | null;
  configured: boolean;
  projectId: string | null;
  callSid?: string | null;
  message?: string;
};

export type FetchCallLogsParams = FetchLogsParams & {
  callId: string;
};

export type FetchCallLogsResult = FetchLogsResult;

function buildLogsSearchParams(params: FetchLogsParams): URLSearchParams {
  const limit = params.limit ?? LOGS_CHUNK_SIZE;
  const search = new URLSearchParams();
  search.set("limit", String(limit));
  search.set("offset", String(Math.max(0, params.offset ?? 0)));
  if (params.projectId) search.set("projectId", params.projectId);
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.callId?.trim()) search.set("callId", params.callId.trim());
  return search;
}

async function parseLogsResponse(
  res: Response,
  params: FetchLogsParams,
): Promise<FetchLogsResult> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      (data as { error?: { message?: string } })?.error?.message ||
        "Failed to load logs",
    ) as Error & { code?: string; status?: number };
    err.status = res.status;
    err.code = (data as { error?: { code?: string } })?.error?.code;
    throw err;
  }

  const events = (data.events || []) as LogsApiEvent[];
  const requestedLimit = params.limit ?? LOGS_CHUNK_SIZE;
  // A short page (remainder < 200) means we are done, even if the API flag is wrong.
  const hasMore = Boolean(data.hasMore) && events.length >= requestedLimit;
  return {
    events,
    hasMore,
    nextOffset:
      typeof data.nextOffset === "number"
        ? data.nextOffset
        : (params.offset ?? 0) + events.length,
    nextCursor: (data.nextCursor as string | null | undefined) ?? null,
    configured: data.configured !== false,
    projectId: (data.projectId as string | null | undefined) ?? params.projectId ?? null,
    callSid: (data.callSid as string | null | undefined) ?? params.callId ?? null,
    message: typeof data.message === "string" ? data.message : undefined,
  };
}

/**
 * Fetch one chunk of CloudWatch logs for the current project.
 * Uses `/api/logs` (all logs) or `/api/logs?callId=` when a Call SID is provided.
 */
export async function fetchLogsChunk(
  params: FetchLogsParams,
): Promise<FetchLogsResult> {
  const creds = await getActiveCredentials();
  if (creds.ok === false) {
    const err = new Error(creds.message) as Error & { code?: string };
    err.code = "AUTH_REQUIRED";
    throw err;
  }

  const search = buildLogsSearchParams(params);
  const res = await fetch(`/api/logs?${search.toString()}`, {
    credentials: "include",
    headers: buildAwsCredentialHeaders(creds.aws, creds.credentials.accountId),
    signal: params.signal,
  });

  return parseLogsResponse(res, params);
}

/**
 * Fetch one chunk of CloudWatch logs for a Call SID via `/api/calls/[id]/logs`.
 */
export async function fetchCallLogsChunk(
  params: FetchCallLogsParams,
): Promise<FetchCallLogsResult> {
  const creds = await getActiveCredentials();
  if (creds.ok === false) {
    const err = new Error(creds.message) as Error & { code?: string };
    err.code = "AUTH_REQUIRED";
    throw err;
  }

  const callId = params.callId.trim();
  if (!callId) {
    const err = new Error("Call ID is required") as Error & { code?: string };
    err.code = "CALL_ID_REQUIRED";
    throw err;
  }

  const search = buildLogsSearchParams(params);
  search.delete("callId");

  const res = await fetch(
    `/api/calls/${encodeURIComponent(callId)}/logs?${search.toString()}`,
    {
      credentials: "include",
      headers: buildAwsCredentialHeaders(creds.aws, creds.credentials.accountId),
      signal: params.signal,
    },
  );

  return parseLogsResponse(res, params);
}
