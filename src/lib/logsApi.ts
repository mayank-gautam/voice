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

export type FetchCallLogsParams = {
  callId: string;
  projectId: string | null | undefined;
  offset?: number;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
};

export type FetchCallLogsResult = {
  events: LogsApiEvent[];
  hasMore: boolean;
  nextOffset: number | null;
  nextCursor: string | null;
  configured: boolean;
  projectId: string | null;
  message?: string;
};

/**
 * Fetch one chunk of CloudWatch logs for a Call SID + current project.
 * Uses existing `/api/calls/[id]/logs` (offset + optional cursor).
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

  const limit = params.limit ?? LOGS_CHUNK_SIZE;
  const search = new URLSearchParams();
  search.set("limit", String(limit));
  search.set("offset", String(Math.max(0, params.offset ?? 0)));
  if (params.projectId) search.set("projectId", params.projectId);
  if (params.cursor) search.set("cursor", params.cursor);

  const res = await fetch(
    `/api/calls/${encodeURIComponent(params.callId)}/logs?${search.toString()}`,
    {
      credentials: "include",
      headers: buildAwsCredentialHeaders(creds.aws, creds.credentials.accountId),
      signal: params.signal,
    },
  );

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
  return {
    events,
    hasMore: Boolean(data.hasMore),
    nextOffset:
      typeof data.nextOffset === "number"
        ? data.nextOffset
        : (params.offset ?? 0) + events.length,
    nextCursor: (data.nextCursor as string | null | undefined) ?? null,
    configured: data.configured !== false,
    projectId: (data.projectId as string | null | undefined) ?? params.projectId ?? null,
    message: typeof data.message === "string" ? data.message : undefined,
  };
}
