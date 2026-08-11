import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  GetQueryResultsCommand,
  StartQueryCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import type { ProjectConfig } from "./projectStore";
import type { AwsCredentialHeaders } from "./api";
import {
  DEFAULT_CLOUDWATCH_INSIGHTS_FILTER,
  resolveCloudWatchInsightsFilter,
  stripConsoleInsightsPreamble,
  ensureInsightsIdentityFields,
  normalizeInsightsLogGroup,
} from "@/lib/cloudWatchInsightsQuery";

export { parseLogGroupPatterns, resolveLogGroupPatterns } from "@/lib/cloudWatchLogGroups";
export {
  DEFAULT_CLOUDWATCH_INSIGHTS_FILTER,
  resolveCloudWatchInsightsFilter,
} from "@/lib/cloudWatchInsightsQuery";

export function getCloudWatchClientFromCredentials(
  credentials: AwsCredentialHeaders,
  fallbackRegion = "us-east-1",
) {
  return new CloudWatchLogsClient({
    region: credentials.region || fallbackRegion,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });
}

export type LogEvent = {
  timestamp: number;
  message: string;
  logStreamName: string;
  logGroupName?: string;
  /** Parsed level label when available (INFO/WARN/…). */
  level?: string;
  /** Derived service name from the log group path. */
  service?: string;
};

/** @deprecated Use DEFAULT_CLOUDWATCH_INSIGHTS_FILTER — kept for existing imports. */
export const DEFAULT_LOGS_QUERY = DEFAULT_CLOUDWATCH_INSIGHTS_FILTER;

export const DEFAULT_PAGE_SIZE = 200;
export const MAX_PAGE_SIZE = 500;
/** CloudWatch Logs Insights hard max — used by "Load all". */
export const ALL_LOGS_LIMIT = 10000;

/**
 * Hardcoded project/account → tenant id fragment used in log group names.
 * Matches the Fastify ECS logs filter (extend later from account-hierarchy).
 */
export const CLIENT_TENANT_IDS: Record<string, string> = {
  bcs: "06edeab4",
  lfs: "06edese3",
  lfc: "06edese3",
  chc: "066gvee4",
  cgs: "066gvee4",
};

/** Log group name prefixes (Fastify used ecs / awslambda). */
const LOG_GROUP_PREFIXES = ["/ecs", "/aws/lambda"];

/** Always required substring in matching log groups. */
const BASE_LOG_KEYWORDS = ["agai"];

const LOG_GROUP_CACHE_TTL_MS = 5 * 60 * 1000;
const logGroupCache = new Map<string, { names: string[]; expiresAt: number }>();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

function resolveTenantAccountKey(project: ProjectConfig): string {
  return (project.id || project.name || "").trim().toLowerCase();
}

export function resolveTenantIdForProject(project: ProjectConfig): string | null {
  const key = resolveTenantAccountKey(project);
  if (CLIENT_TENANT_IDS[key]) return CLIENT_TENANT_IDS[key];
  const byName = Object.keys(CLIENT_TENANT_IDS).find((k) => key.includes(k));
  return byName ? CLIENT_TENANT_IDS[byName] : null;
}

/** Derive a service label from a log group path (Fastify getServiceValue). */
export function getServiceValue(logGroupName: string): string {
  const normalized = normalizeInsightsLogGroup(logGroupName || "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return "unknown";
  return parts[parts.length - 1] || normalized;
}

/** List + cache STANDARD log groups for the credential/region pair. */
async function getCachedLogGroups(
  client: CloudWatchLogsClient,
  cacheKey: string,
): Promise<string[]> {
  const hit = logGroupCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.names;
  }

  const names: string[] = [];
  let nextToken: string | undefined;
  for (let pageNum = 0; pageNum < 40; pageNum++) {
    const page = await client.send(
      new DescribeLogGroupsCommand({
        nextToken,
        limit: 50,
        logGroupClass: "STANDARD",
      }),
    );
    for (const group of page.logGroups || []) {
      if (group.logGroupName) names.push(group.logGroupName);
    }
    nextToken = page.nextToken;
    if (!nextToken) break;
  }

  logGroupCache.set(cacheKey, {
    names,
    expiresAt: Date.now() + LOG_GROUP_CACHE_TTL_MS,
  });
  return names;
}

/**
 * Fastify filter:
 * prefixes (/ecs, /aws/lambda) AND keywords (agai + tenant id) all present.
 */
export function filterEcsLambdaLogGroups(
  logGroups: string[],
  tenantId: string,
): string[] {
  const keywords = [...BASE_LOG_KEYWORDS, tenantId];
  return logGroups.filter(
    (group) =>
      LOG_GROUP_PREFIXES.some((prefix) => group.startsWith(prefix)) &&
      keywords.every((keyword) => group.includes(keyword)),
  );
}

export type InsightsQueryOpts = {
  /** Page size for Insights `| limit` (1–10000). */
  limit?: number;
};

/** Build Insights query used by the Fastify-style ECS logs path. */
export function getLogQuery(callSid: string | null | undefined, pageSize: number): string {
  const limit = Math.min(Math.max(pageSize, 1), ALL_LOGS_LIMIT);
  const parts = ["fields @timestamp, @message, @logStream, @log"];
  const trimmed = callSid?.trim();
  if (trimmed) {
    parts.push(`| filter @message like /${escapeRegExp(trimmed)}/`);
  }
  parts.push("| sort @timestamp asc", `| limit ${limit}`);
  return parts.join("\n");
}

/** Build Insights query; always injects the open page Call SID into `{callId}` / `{CallSid}`. */
export function buildLogsInsightsQuery(
  callSid: string,
  template?: string,
  opts?: InsightsQueryOpts,
): string {
  const safeId = escapeRegExp(callSid.trim());
  let query = resolveCloudWatchInsightsFilter(template);
  query = stripConsoleInsightsPreamble(query);

  const looksLikeInsights = /\bfields\b/i.test(query) || /\bfilter\s+@message\b/i.test(query);
  if (!looksLikeInsights) {
    query = stripConsoleInsightsPreamble(DEFAULT_CLOUDWATCH_INSIGHTS_FILTER);
  } else if (/^\s*filter\s+/i.test(query) && !/\bfields\b/i.test(query)) {
    query = `fields @timestamp, @message, @logStream, @log\n| ${query}\n| sort @timestamp desc\n| limit 10000`;
  }

  if (!/\{callId\}|\{CallSid\}/i.test(query) && !query.includes(safeId)) {
    query = `${query}\n| filter @message like /{callId}/`;
  }

  query = query
    .replace(/\{callId\}/gi, safeId)
    .replace(/\{CallSid\}/gi, safeId);

  query = ensureInsightsIdentityFields(query);
  query = query.replace(/\|\s*limit\s+\d+\s*/gi, "\n").trim();

  if (!/\|\s*sort\s+/i.test(query)) {
    query = `${query}\n| sort @timestamp desc`;
  }

  const limit = Math.min(Math.max(opts?.limit ?? ALL_LOGS_LIMIT, 1), ALL_LOGS_LIMIT);
  query = `${query}\n| limit ${limit}`;

  return query.replace(/\n{3,}/g, "\n").trim();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parse CloudWatch Insights @timestamp (epoch ms/sec or date string). */
export function parseInsightsTimestamp(ts: string): number {
  if (!ts?.trim()) return 0;
  const raw = ts.trim();
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum > 0) {
    if (asNum < 1e11) return Math.floor(asNum * 1000);
    return Math.floor(asNum);
  }
  let normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) {
    normalized = `${normalized}Z`;
  }
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCursorToEpochMs(cursor: string): number | null {
  const trimmed = cursor.trim();
  if (!trimmed) return null;
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum) && asNum > 0) {
    return asNum < 1e11 ? Math.floor(asNum * 1000) : Math.floor(asNum);
  }
  let normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) {
    normalized = `${normalized}Z`;
  }
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

type InsightsRow = { field?: string; value?: string }[];

async function runQueryForGroups(
  client: CloudWatchLogsClient,
  logGroupNames: string[],
  queryString: string,
  startTimeSec: number,
  endTimeSec: number,
): Promise<InsightsRow[]> {
  if (logGroupNames.length === 0) return [];

  const started = await client.send(
    new StartQueryCommand({
      logGroupNames,
      startTime: startTimeSec,
      endTime: endTimeSec,
      queryString,
    }),
  );

  const queryId = started.queryId;
  if (!queryId) return [];

  for (let i = 0; i < 60; i++) {
    const result = await client.send(new GetQueryResultsCommand({ queryId }));
    const status = result.status;
    if (
      status === "Complete" ||
      status === "Failed" ||
      status === "Cancelled" ||
      status === "Timeout"
    ) {
      if (status !== "Complete") {
        throw new Error(`CloudWatch Logs Insights query ${status?.toLowerCase()}`);
      }
      return (result.results || []) as InsightsRow[];
    }
    await sleep(500);
  }

  throw new Error("CloudWatch Logs Insights query timed out");
}

const LEVEL_MAP: Record<string, string> = {
  "10": "TRACE",
  "20": "DEBUG",
  "30": "INFO",
  "40": "WARN",
  "50": "ERROR",
  "60": "FATAL",
};

function rowField(row: InsightsRow, field: string): string {
  return row.find((cell) => cell.field === field)?.value ?? "";
}

/**
 * Parse Insights rows like the Fastify ECS logs handler.
 * Always returns LogEvent for the UI; keeps a readable message for display.
 */
function parseInsightsRows(rows: InsightsRow[]): LogEvent[] {
  return rows.map((row) => {
    const timestampRaw = rowField(row, "@timestamp");
    const messageRaw = rowField(row, "@message");
    const logGroupRaw = normalizeInsightsLogGroup(rowField(row, "@log"));
    const logStreamName = rowField(row, "@logStream");
    const timestamp = parseInsightsTimestamp(timestampRaw);
    const service = getServiceValue(logGroupRaw);

    try {
      const log = JSON.parse(messageRaw || "{}") as Record<string, unknown>;

      if (log.event && typeof log.event === "string") {
        try {
          const eventJson = JSON.parse(log.event) as Record<string, unknown>;
          if (eventJson.metadata && typeof eventJson.metadata === "string") {
            try {
              eventJson.metadata = JSON.parse(eventJson.metadata);
            } catch {
              /* keep string metadata */
            }
          }
          log.event = eventJson;
        } catch {
          /* keep event string */
        }
      }

      const levelValue = log.level;
      const level =
        levelValue != null
          ? LEVEL_MAP[String(levelValue)] || String(levelValue)
          : undefined;

      return {
        timestamp,
        // Keep raw CloudWatch @message so the UI can show full JSON + extract display text.
        message: messageRaw,
        logStreamName,
        logGroupName: logGroupRaw,
        service,
        level,
      };
    } catch {
      return {
        timestamp,
        message: messageRaw,
        logStreamName,
        logGroupName: logGroupRaw,
        service,
      };
    }
  });
}

function eventKey(e: LogEvent): string {
  return `${e.timestamp}|${e.logStreamName}|${e.logGroupName || ""}|${e.message}`;
}

export type FetchLogsResult = {
  configured: boolean;
  events: LogEvent[];
  logGroups?: string[];
  query?: string;
  message?: string;
  nextOffset?: number;
  nextCursor?: string | null;
  hasMore?: boolean;
  pageSize?: number;
  tenantId?: string;
  callSid?: string | null;
};

export type FetchLogsOpts = {
  start?: number;
  end?: number;
  /** Page size returned to client (default 200). */
  limit?: number;
  /**
   * Number of events to skip (offset-based pagination).
   * Insights has no OFFSET — we fetch a window and slice.
   */
  offset?: number;
  /**
   * Fastify-style cursor: previous page's last raw @timestamp.
   * When set, Insights startTime begins at this cursor.
   */
  cursor?: string | null;
};

/**
 * Fetch CloudWatch logs for the current project tenant.
 * When `callSid` is set, filters Insights `@message` by that Call SID (Fastify `getLogQuery`).
 * When omitted, returns all matching ECS/Lambda project logs.
 */
export async function fetchLogs(
  project: ProjectConfig,
  credentials: AwsCredentialHeaders,
  opts?: FetchLogsOpts & { callSid?: string | null },
): Promise<FetchLogsResult> {
  const callSid = opts?.callSid?.trim() || null;
  const pageSize = Math.min(
    Math.max(opts?.limit ?? DEFAULT_PAGE_SIZE, 1),
    ALL_LOGS_LIMIT,
  );
  const offset = Math.max(0, Math.floor(opts?.offset ?? 0));

  const tenantId = resolveTenantIdForProject(project);
  if (!tenantId) {
    return {
      configured: false,
      events: [],
      hasMore: false,
      nextOffset: offset,
      nextCursor: null,
      pageSize,
      callSid,
      message: `Invalid account/project "${project.id}". No tenant mapping for ECS/Lambda log filter.`,
    };
  }

  const region = credentials.region || project.aws.region || "us-east-1";
  const client = getCloudWatchClientFromCredentials(credentials, region);
  const cacheKey = `${region}:${credentials.accessKeyId}:${tenantId}`;

  const allGroups = await getCachedLogGroups(client, cacheKey);
  const filteredGroups = filterEcsLambdaLogGroups(allGroups, tenantId);

  const query = getLogQuery(callSid, Math.min(offset + pageSize + 1, ALL_LOGS_LIMIT));
  const endMs = opts?.end ?? Date.now();
  const endTimeSec = Math.floor(endMs / 1000);

  let startTimeSec = 0;
  if (opts?.cursor) {
    const cursorMs = parseCursorToEpochMs(opts.cursor);
    if (cursorMs == null) {
      return {
        configured: true,
        events: [],
        hasMore: false,
        nextOffset: offset,
        nextCursor: null,
        pageSize,
        tenantId,
        callSid,
        message: "Invalid cursor",
      };
    }
    startTimeSec = Math.floor(cursorMs / 1000);
  } else if (opts?.start != null) {
    startTimeSec = Math.floor(opts.start / 1000);
  } else {
    // Fastify used 0; use a 14-day lookback to avoid huge first queries.
    startTimeSec = Math.floor((endMs - 14 * 24 * 60 * 60 * 1000) / 1000);
  }

  if (filteredGroups.length === 0) {
    return {
      configured: true,
      events: [],
      logGroups: [],
      query,
      hasMore: false,
      nextOffset: offset,
      nextCursor: null,
      pageSize,
      tenantId,
      callSid,
      message: `No /ecs or /aws/lambda log groups matched keywords [${BASE_LOG_KEYWORDS.join(", ")}, ${tenantId}] for project ${project.id}.`,
    };
  }

  const chunks = chunkArray(filteredGroups, 20);
  const chunkRows = await mapPool(chunks, 5, (groupChunk) =>
    runQueryForGroups(client, groupChunk, query, startTimeSec, endTimeSec),
  );

  const parsedLogs = parseInsightsRows(chunkRows.flat());
  parsedLogs.sort((a, b) => {
    const byTime = a.timestamp - b.timestamp;
    return byTime || a.message.localeCompare(b.message);
  });

  const seen = new Set<string>();
  const unique: LogEvent[] = [];
  for (const event of parsedLogs) {
    const key = eventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(event);
  }

  const window = unique.slice(offset);
  const hasMore = window.length > pageSize;
  const events = window.slice(0, pageSize);
  const nextOffset = offset + events.length;
  const nextCursor =
    events.length > 0 ? String(events[events.length - 1].timestamp) : null;

  return {
    configured: true,
    events,
    logGroups: filteredGroups,
    query,
    nextOffset,
    nextCursor,
    hasMore,
    pageSize,
    tenantId,
    callSid,
  };
}

/** @deprecated Prefer `fetchLogs({ callSid })` — kept for existing call-detail routes. */
export async function fetchLogsForCall(
  project: ProjectConfig,
  callSid: string,
  credentials: AwsCredentialHeaders,
  opts?: FetchLogsOpts,
): Promise<FetchLogsResult> {
  return fetchLogs(project, credentials, { ...opts, callSid });
}
