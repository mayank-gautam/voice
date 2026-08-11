import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  GetQueryResultsCommand,
  StartQueryCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import type { ProjectConfig } from "./projectStore";
import type { AwsCredentialHeaders } from "./api";
import {
  parseLogGroupPatterns,
  resolveLogGroupPatterns,
} from "@/lib/cloudWatchLogGroups";
import {
  DEFAULT_CLOUDWATCH_INSIGHTS_FILTER,
  resolveCloudWatchInsightsFilter,
  stripConsoleInsightsPreamble,
  ensureInsightsIdentityFields,
  parseInsightsStartWindowMs,
  insightsSortDescending,
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
};

/** @deprecated Use DEFAULT_CLOUDWATCH_INSIGHTS_FILTER — kept for existing imports. */
export const DEFAULT_LOGS_QUERY = DEFAULT_CLOUDWATCH_INSIGHTS_FILTER;

export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 500;
/** CloudWatch Logs Insights hard max — used by "Load all". */
export const ALL_LOGS_LIMIT = 10000;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type InsightsQueryOpts = {
  /** Page size for Insights `| limit` (1–10000). */
  limit?: number;
};

/** Build Insights query; always injects the open page Call SID into `{callId}` / `{CallSid}`. */
export function buildLogsInsightsQuery(
  callSid: string,
  template?: string,
  opts?: InsightsQueryOpts
): string {
  const safeId = escapeRegExp(callSid.trim());
  let query = resolveCloudWatchInsightsFilter(template);
  query = stripConsoleInsightsPreamble(query);

  // Legacy FilterLogEvents-style values → Insights default (API-safe body)
  const looksLikeInsights = /\bfields\b/i.test(query) || /\bfilter\s+@message\b/i.test(query);
  if (!looksLikeInsights) {
    query = stripConsoleInsightsPreamble(DEFAULT_CLOUDWATCH_INSIGHTS_FILTER);
  } else if (/^\s*filter\s+/i.test(query) && !/\bfields\b/i.test(query)) {
    query = `fields @timestamp, @message, @logStream, @log\n| ${query}\n| sort @timestamp desc\n| limit 10000`;
  }

  // Guarantee Call SID filter is present
  if (!/\{callId\}|\{CallSid\}/i.test(query) && !query.includes(safeId)) {
    query = `${query}\n| filter @message like /{callId}/`;
  }

  query = query
    .replace(/\{callId\}/gi, safeId)
    .replace(/\{CallSid\}/gi, safeId);

  // Always select log identity fields for Service column
  query = ensureInsightsIdentityFields(query);

  // Strip existing limit so we can apply page size safely
  query = query.replace(/\|\s*limit\s+\d+\s*/gi, "\n").trim();

  if (!/\|\s*sort\s+/i.test(query)) {
    query = `${query}\n| sort @timestamp desc`;
  }

  const limit = Math.min(Math.max(opts?.limit ?? ALL_LOGS_LIMIT, 1), ALL_LOGS_LIMIT);
  query = `${query}\n| limit ${limit}`;

  return query.replace(/\n{3,}/g, "\n").trim();
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

async function resolveLogGroups(
  client: CloudWatchLogsClient,
  pattern: string
): Promise<string[]> {
  if (!pattern.includes("*")) return [pattern];

  const prefix = pattern.split("*")[0];
  const re = patternToRegex(pattern);
  const names: string[] = [];
  let nextToken: string | undefined;

  do {
    const page = await client.send(
      new DescribeLogGroupsCommand({
        logGroupNamePrefix: prefix || undefined,
        nextToken,
        limit: 50,
        logGroupClass: "STANDARD",
      })
    );
    for (const g of page.logGroups || []) {
      const name = g.logGroupName;
      if (name && re.test(name)) names.push(name);
    }
    nextToken = page.nextToken;
  } while (nextToken && names.length < 100);

  return names;
}

/**
 * Console `namePrefix: []` → query recent STANDARD log groups (Insights max 50/query).
 */
async function discoverStandardLogGroups(
  client: CloudWatchLogsClient,
  maxGroups = 50
): Promise<string[]> {
  type Ranked = { name: string; lastEvent: number };
  const ranked: Ranked[] = [];
  let nextToken: string | undefined;
  // Cap pages so we don't scan an entire account forever
  for (let pageNum = 0; pageNum < 20; pageNum++) {
    const page = await client.send(
      new DescribeLogGroupsCommand({
        nextToken,
        limit: 50,
        logGroupClass: "STANDARD",
      })
    );
    for (const g of page.logGroups || []) {
      if (!g.logGroupName) continue;
      ranked.push({
        name: g.logGroupName,
        lastEvent: g.creationTime ?? 0,
      });
    }
    nextToken = page.nextToken;
    if (!nextToken) break;
  }

  return ranked
    .sort((a, b) => b.lastEvent - a.lastEvent)
    .slice(0, maxGroups)
    .map((g) => g.name);
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
    // seconds vs milliseconds
    if (asNum < 1e11) return Math.floor(asNum * 1000);
    return Math.floor(asNum);
  }
  // "2024-01-15 10:23:45.123" → ISO-ish
  let normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) {
    normalized = `${normalized}Z`;
  }
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function runInsightsQuery(
  client: CloudWatchLogsClient,
  logGroupNames: string[],
  queryString: string,
  start: number,
  end: number
): Promise<LogEvent[]> {
  const started = await client.send(
    new StartQueryCommand({
      logGroupNames,
      startTime: Math.floor(start / 1000),
      endTime: Math.floor(end / 1000),
      queryString,
    })
  );

  const queryId = started.queryId;
  if (!queryId) return [];

  for (let i = 0; i < 60; i++) {
    const result = await client.send(new GetQueryResultsCommand({ queryId }));
    const status = result.status;
    if (status === "Complete" || status === "Failed" || status === "Cancelled" || status === "Timeout") {
      if (status !== "Complete") {
        throw new Error(`CloudWatch Logs Insights query ${status?.toLowerCase()}`);
      }
      return (result.results || []).map((row) => {
        const get = (field: string) => row.find((c) => c.field === field)?.value ?? "";
        const ts = get("@timestamp");
        return {
          timestamp: parseInsightsTimestamp(ts),
          message: get("@message"),
          logStreamName: get("@logStream"),
          logGroupName: normalizeInsightsLogGroup(get("@log") || get("logGroupName")),
        };
      });
    }
    await sleep(500);
  }

  throw new Error("CloudWatch Logs Insights query timed out");
}

function eventKey(e: LogEvent): string {
  return `${e.timestamp}|${e.logStreamName}|${e.logGroupName || ""}|${e.message}`;
}

export async function fetchLogsForCall(
  project: ProjectConfig,
  callSid: string,
  credentials: AwsCredentialHeaders,
  opts?: {
    start?: number;
    end?: number;
    /** Page size returned to client (default 100). */
    limit?: number;
    /**
     * Number of events to skip (offset-based pagination).
     * Insights has no OFFSET — we fetch `offset + limit + 1` and slice.
     */
    offset?: number;
  }
): Promise<{
  configured: boolean;
  events: LogEvent[];
  logGroups?: string[];
  query?: string;
  message?: string;
  nextOffset?: number;
  hasMore?: boolean;
  pageSize?: number;
}> {
  if (!callSid?.trim()) {
    return {
      configured: true,
      events: [],
      hasMore: false,
      nextOffset: 0,
      message: "Call ID is required to filter logs.",
    };
  }

  const pageSize = Math.min(
    Math.max(opts?.limit ?? DEFAULT_PAGE_SIZE, 1),
    ALL_LOGS_LIMIT
  );
  const offset = Math.max(0, Math.floor(opts?.offset ?? 0));
  // Fetch through this page + one extra to detect hasMore (Insights max 10k)
  const fetchLimit = Math.min(offset + pageSize + 1, 10000);

  const filterResolved = resolveCloudWatchInsightsFilter(
    project.aws.cloudWatchFilterPattern
  );
  const patterns = resolveLogGroupPatterns(
    project.aws.cloudWatchLogGroup,
    filterResolved
  );

  const query = buildLogsInsightsQuery(callSid, project.aws.cloudWatchFilterPattern, {
    limit: fetchLimit,
  });
  const client = getCloudWatchClientFromCredentials(credentials, project.aws.region || "us-east-1");
  const end = opts?.end ?? Date.now();
  const lookbackMs = parseInsightsStartWindowMs(filterResolved);
  const start = opts?.start ?? end - lookbackMs;
  const sortDesc = insightsSortDescending(query);

  let uniqueGroups: string[];
  if (patterns.length === 0) {
    // Matches Console SOURCE namePrefix: [] — discover recent STANDARD groups
    uniqueGroups = await discoverStandardLogGroups(client, 50);
    if (uniqueGroups.length === 0) {
      return {
        configured: true,
        events: [],
        logGroups: [],
        query,
        hasMore: false,
        nextOffset: offset,
        pageSize,
        message:
          "No STANDARD CloudWatch log groups found in this AWS account/region. Add patterns in Project Settings or set namePrefix in the Insights SOURCE clause.",
      };
    }
  } else {
    const resolvedGroups = (
      await Promise.all(patterns.map((p) => resolveLogGroups(client, p)))
    ).flat();
    uniqueGroups = [...new Set(resolvedGroups)];
    if (uniqueGroups.length === 0) {
      return {
        configured: true,
        events: [],
        logGroups: [],
        query,
        hasMore: false,
        nextOffset: offset,
        pageSize,
        message: `No log groups matched: ${patterns.join(", ")}`,
      };
    }
  }

  // Insights accepts up to 50 log groups per query
  const groupBatches: string[][] = [];
  for (let i = 0; i < uniqueGroups.length; i += 50) {
    groupBatches.push(uniqueGroups.slice(i, i + 50));
  }

  const batches = await Promise.all(
    groupBatches.map((groups) => runInsightsQuery(client, groups, query, start, end))
  );

  const seen = new Set<string>();
  const merged: LogEvent[] = [];
  const sorted = batches.flat().sort((a, b) => {
    const byTime = sortDesc
      ? b.timestamp - a.timestamp
      : a.timestamp - b.timestamp;
    return byTime || a.message.localeCompare(b.message);
  });
  for (const e of sorted) {
    const key = eventKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(e);
  }

  const hasMore = merged.length > offset + pageSize;
  const events = merged.slice(offset, offset + pageSize);
  const nextOffset = offset + events.length;

  return {
    configured: true,
    events,
    logGroups: uniqueGroups,
    query,
    nextOffset,
    hasMore,
    pageSize,
  };
}
