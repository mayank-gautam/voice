import { parseNamePrefixesFromInsightsFilter } from "@/lib/cloudWatchInsightsQuery";

/**
 * Split CloudWatch log-group config into patterns.
 * Supports newline, comma, or semicolon separators; normalizes Windows CRLF.
 * Patterns may include `*` wildcards (prefix match via DescribeLogGroups).
 */
export function parseLogGroupPatterns(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Canonical storage: semicolon-separated patterns. */
export function normalizeLogGroupPatterns(raw?: string): string {
  return parseLogGroupPatterns(raw).join("; ");
}

/**
 * Patterns from Project Settings, else `namePrefix` in the Insights SOURCE clause.
 * Empty → caller may discover STANDARD log groups (Console empty-namePrefix behavior).
 */
export function resolveLogGroupPatterns(
  logGroupField?: string | null,
  insightsFilter?: string | null
): string[] {
  const fromField = parseLogGroupPatterns(logGroupField ?? undefined);
  if (fromField.length > 0) return fromField;
  return parseNamePrefixesFromInsightsFilter(insightsFilter);
}
