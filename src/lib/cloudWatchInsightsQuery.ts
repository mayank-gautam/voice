/**
 * Default CloudWatch Logs Insights query template for a project.
 * `{callId}` is replaced with the open call's Twilio Call SID at query time.
 *
 * NOTE: `SOURCE … START=… END=…` is CloudWatch Console syntax. The API uses
 * `logGroupNames` + `startTime`/`endTime` parameters instead — see
 * `stripConsoleInsightsPreamble` / `parseInsightsStartWindowMs`.
 *
 * Always include `@log` + `@logStream` so the UI can show a real Service name.
 */
export const DEFAULT_CLOUDWATCH_INSIGHTS_FILTER = `SOURCE logGroups(namePrefix: [], class: "STANDARD") START=-604800s END=0s |
fields @timestamp, @message, @logStream, @log
| filter @message like /{callId}/
| sort @timestamp desc
| limit 10000`;

/** Previous defaults — treat as unset so projects pick up the new template. */
const LEGACY_CLOUDWATCH_INSIGHTS_FILTERS = [
  `fields @timestamp, @message, @logStream, @log
| filter @message like /{callId}/
| sort @timestamp asc
| limit 200`,
  `fields @timestamp, @message, @logStream, @log
| filter @message like /{callId}/
| sort @timestamp asc
| limit 200
`,
  `SOURCE logGroups(namePrefix: [], class: "STANDARD") START=-604800s END=0s |
fields @timestamp, @message
| filter @message like /{callId}/
| sort @timestamp desc
| limit 10000`,
  `fields @timestamp, @message
| filter @message like /{callId}/
| sort @timestamp desc
| limit 10000`,
];

/** Normalize stored Insights filter; blank / legacy default → current default. */
export function resolveCloudWatchInsightsFilter(raw?: string | null): string {
  const trimmed = (raw ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!trimmed) return DEFAULT_CLOUDWATCH_INSIGHTS_FILTER;
  const normalized = trimmed.replace(/\r\n/g, "\n");
  if (LEGACY_CLOUDWATCH_INSIGHTS_FILTERS.some((d) => d.trim() === normalized)) {
    return DEFAULT_CLOUDWATCH_INSIGHTS_FILTER;
  }
  return trimmed;
}

/**
 * Ensure Insights `fields` includes `@log` and `@logStream` (needed for Service column).
 */
export function ensureInsightsIdentityFields(query: string): string {
  let q = query.replace(/\r\n/g, "\n").trim();
  const fieldsMatch = q.match(/\bfields\s+([^|\n]+)/i);
  if (!fieldsMatch) {
    return `fields @timestamp, @message, @logStream, @log\n| ${q}`.replace(/^\|\s*/, "");
  }

  const current = fieldsMatch[1];
  const extras: string[] = [];
  if (!/@logStream\b/i.test(current)) extras.push("@logStream");
  // (?!Stream) so @log does not match @logStream
  if (!/@log(?!Stream)\b/i.test(current)) extras.push("@log");
  if (extras.length === 0) return q;

  return q.replace(
    /\bfields\s+([^|\n]+)/i,
    (_m, fields: string) =>
      `fields ${fields.trim().replace(/,\s*$/, "")}, ${extras.join(", ")}`
  );
}

/**
 * Remove Console-only SOURCE / START / END preamble so the string is valid for
 * StartQueryCommand.queryString.
 */
export function stripConsoleInsightsPreamble(query: string): string {
  let q = query.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  // SOURCE logGroups(...) START=... END=... |
  q = q.replace(
    /^\s*SOURCE\s+logGroups\s*\([^)]*\)\s*(?:START\s*=\s*[^\s|]+)?\s*(?:END\s*=\s*[^\s|]+)?\s*\|?\s*/i,
    ""
  );
  // Or standalone START/END before first fields/filter
  q = q.replace(/^\s*START\s*=\s*[^\s|]+\s*(?:END\s*=\s*[^\s|]+)?\s*\|?\s*/i, "");
  q = q.replace(/^\s*END\s*=\s*[^\s|]+\s*\|?\s*/i, "");
  return q.trim().replace(/^\|+\s*/, "");
}

/** Parse `START=-604800s` (relative seconds) → lookback window in ms. Default 7d. */
export function parseInsightsStartWindowMs(query: string): number {
  const m = query.match(/START\s*=\s*(-?\d+)\s*s/i);
  if (m) {
    const secs = Math.abs(Number(m[1]));
    if (Number.isFinite(secs) && secs > 0) return secs * 1000;
  }
  return 7 * 24 * 60 * 60 * 1000;
}

export function insightsSortDescending(query: string): boolean {
  return /\|\s*sort\s+@timestamp\s+desc\b/i.test(query);
}

/**
 * Parse `namePrefix: [...]` from Console `SOURCE logGroups(...)`.
 * Empty array → []; missing SOURCE → [].
 */
export function parseNamePrefixesFromInsightsFilter(raw?: string | null): string[] {
  const text = (raw ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const m = text.match(
    /SOURCE\s+logGroups\s*\(\s*[^)]*namePrefix\s*:\s*(\[[^\]]*\])/i
  );
  if (!m) return [];
  const arr = m[1].trim();
  if (arr === "[]") return [];
  const prefixes: string[] = [];
  const re = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|\/[^\s,\]]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(arr)) !== null) {
    const value = (match[1] ?? match[2] ?? match[0]).replace(/\\"/g, '"').replace(/\\'/g, "'");
    if (value.trim()) prefixes.push(value.trim());
  }
  return prefixes;
}

/**
 * Normalize Insights `@log` value: `123456789012:/aws/lambda/foo` → `/aws/lambda/foo`.
 */
export function normalizeInsightsLogGroup(raw?: string | null): string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  const m = v.match(/^\d{10,}:(\/.+)$/);
  if (m) return m[1];
  return v;
}
